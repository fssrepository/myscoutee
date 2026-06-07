import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../base/db';
import { appMemoryDbStorageKey, demoActiveUserStorageKey, scopedSessionStorageKey } from '../../base/storage-scope';
import type { IdeaPost } from '../../base/models';
import { EVENTS_TABLE_NAME, type ActivityEventRecord } from '../../base/models/events.model';
import { IDEA_POSTS_TABLE_NAME } from '../../base/models/idea-posts.model';
import { USERS_TABLE_NAME } from '../../base/models/users.model';
import { LocalAdminAffinityGraphRepository } from '../repositories/admin-affinity-graph.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalLandingContentService } from './landing-content.service';

describe('Demo bootstrap seeding', () => {
  let memoryDb: LocalMemoryDb;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
  });

  afterEach(() => {
    localStorage.removeItem(scopedSessionStorageKey('http'));
    TestBed.resetTestingModule();
  });

  it('keeps bulk event handoffs equivalent to per-user event queries', () => {
    const usersRepository = TestBed.inject(LocalUsersRepository);
    const eventsRepository = TestBed.inject(LocalEventsRepository);
    const userIds = usersRepository.init()
      .map(user => user.id)
      .filter(Boolean)
      .slice(0, 8);

    const eventItemsByUserId = eventsRepository.queryEventItemsByUsers(userIds);
    const itemsByUserId = eventsRepository.queryItemsByUsers(userIds);

    for (const userId of userIds) {
      expect(signatures(eventItemsByUserId.get(userId) ?? [])).toEqual(
        signatures(eventsRepository.queryEventItemsByUser(userId))
      );
      expect(signatures(itemsByUserId.get(userId) ?? [])).toEqual(
        signatures(eventsRepository.queryItemsByUser(userId))
      );
    }
  });

  it('flushes seeded demo tables to IndexedDB, not only the outbox', async () => {
    const usersRepository = TestBed.inject(LocalUsersRepository);
    const eventsRepository = TestBed.inject(LocalEventsRepository);

    usersRepository.init();
    eventsRepository.init();
    expect(memoryDb.read()[USERS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(memoryDb.read()[EVENTS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    await memoryDb.writeIndexedDbTableEntry('probeSimple', { ids: ['probe'] });
    const probeSimple = await memoryDb.readIndexedDbTableEntry<{ ids: string[] }>('probeSimple');
    if ((probeSimple?.ids.length ?? 0) === 0) {
      return;
    }
    await memoryDb.flushToIndexedDb();

    const storedUsers = await memoryDb.readIndexedDbTableEntry<{ ids: string[] }>(USERS_TABLE_NAME);
    const storedEvents = await memoryDb.readIndexedDbTableEntry<{ ids: string[] }>(EVENTS_TABLE_NAME);

    expect(storedUsers?.ids.length ?? 0).toBeGreaterThan(0);
    expect(storedEvents?.ids.length ?? 0).toBeGreaterThan(0);
  });

  it('clears stale demo article storage before landing content seeds articles', async () => {
    memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: {
          stale: staleIdeaPost()
        },
        ids: ['stale']
      }
    }));

    const landingContent = TestBed.inject(LocalLandingContentService);
    const content = await landingContent.loadContent();
    const table = memoryDb.read()[IDEA_POSTS_TABLE_NAME];

    expect(table.ids).not.toContain('stale');
    expect(content.ideas.some(post => post.id === 'stale')).toBe(false);
    expect(content.ideas.length).toBeGreaterThan(0);
    expect(content.privacy.activeRevision?.documentKind).toBe('privacy');
    expect(content.terms.activeRevision?.documentKind).toBe('terms');
  });

  it('builds the admin affinity graph from bootstrap ratings with two demo clusters', async () => {
    const usersRepository = TestBed.inject(LocalUsersRepository);
    const usersRatingsRepository = TestBed.inject(LocalUsersRatingsRepository);
    const affinityGraphRepository = TestBed.inject(LocalAdminAffinityGraphRepository);

    const seededUsers = usersRepository.init();
    usersRatingsRepository.init(seededUsers);
    const snapshot = await affinityGraphRepository.buildGraphSnapshot();

    expect(snapshot.nodes.length).toBe(48);
    expect(componentSizes(snapshot.nodes.map(node => node.id), snapshot.edges)).toEqual([32, 16]);
  });

  it('resets demo bootstrap tables without touching http-scoped storage', async () => {
    localStorage.setItem(appMemoryDbStorageKey('demo'), 'stale-demo-memory');
    localStorage.setItem(scopedSessionStorageKey('http'), 'keep-http-session');
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: {},
        ids: ['stale-user']
      },
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: {
          landing: staleIdeaPost('landing')
        },
        ids: ['landing']
      }
    }));

    await memoryDb.resetStoragePreservingTables([IDEA_POSTS_TABLE_NAME]);

    expect(memoryDb.read()[USERS_TABLE_NAME].ids).toEqual([]);
    expect(memoryDb.read()[IDEA_POSTS_TABLE_NAME].ids).toEqual(['landing']);
    expect(localStorage.getItem(appMemoryDbStorageKey('demo'))).toBeNull();
    expect(localStorage.getItem(scopedSessionStorageKey('http'))).toBe('keep-http-session');
  });

  it('full demo reset clears demo-scoped browser keys without touching http-scoped storage', async () => {
    localStorage.setItem(scopedSessionStorageKey('demo'), 'drop-demo-session');
    localStorage.setItem(scopedSessionStorageKey('http'), 'keep-http-session');
    sessionStorage.setItem(demoActiveUserStorageKey('demo'), 'drop-demo-active-user');

    await memoryDb.resetStorage();

    expect(localStorage.getItem(scopedSessionStorageKey('demo'))).toBeNull();
    expect(sessionStorage.getItem(demoActiveUserStorageKey('demo'))).toBeNull();
    expect(localStorage.getItem(scopedSessionStorageKey('http'))).toBe('keep-http-session');
  });
});

function signatures(records: readonly ActivityEventRecord[]): string[] {
  return records.map(record => [
    record.userId,
    record.type,
    record.id,
    record.isAdmin ? 'admin' : 'member',
    record.isInvitation ? 'invitation' : 'direct',
    record.pendingReason ?? ''
  ].join('|'));
}

function staleIdeaPost(id = 'stale'): IdeaPost {
  return {
    id,
    contentKey: id,
    lang: 'en',
    languageLabel: 'English',
    title: 'Stale article',
    excerpt: 'Should be cleared before demo landing bootstrap.',
    contentHtml: '<p>Should be cleared before demo landing bootstrap.</p>',
    imageUrl: '',
    imageUrls: [],
    featured: false,
    published: true,
    trashed: false,
    trashedAtIso: '',
    trashedByUserId: '',
    submittedAtIso: '2026-01-01T00:00:00.000Z',
    createdAtIso: '2026-01-01T00:00:00.000Z',
    createdByUserId: 'test',
    updatedAtIso: '2026-01-01T00:00:00.000Z',
    updatedByUserId: 'test'
  };
}

function componentSizes(nodes: readonly string[], edges: readonly { source: string; target: string }[]): number[] {
  const parent = new Map(nodes.map(nodeId => [nodeId, nodeId]));
  const find = (nodeId: string): string => {
    const parentId = parent.get(nodeId) ?? nodeId;
    if (parentId === nodeId) {
      return nodeId;
    }
    const rootId = find(parentId);
    parent.set(nodeId, rootId);
    return rootId;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };
  const nodeIds = new Set(nodes);
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      union(edge.source, edge.target);
    }
  }
  const counts = new Map<string, number>();
  for (const nodeId of nodes) {
    const rootId = find(nodeId);
    counts.set(rootId, (counts.get(rootId) ?? 0) + 1);
  }
  return [...counts.values()].sort((left, right) => right - left);
}
