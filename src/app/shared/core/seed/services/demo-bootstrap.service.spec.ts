import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../base/db';
import { appMemoryDbStorageKey, demoActiveUserStorageKey, scopedSessionStorageKey } from '../../base/storage-scope';
import type { IdeaPostDto } from '../../contracts/content.interface';
import { EVENTS_TABLE_NAME, type ActivityEventRecord } from '../../base/models/events.model';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../base/models/activity-members.model';
import { IDEA_POSTS_TABLE_NAME } from '../../base/models/idea-posts.model';
import { USERS_TABLE_NAME } from '../../base/models/users.model';
import {
  SeedDemoBootstrapService,
  SeedAdminAffinityGraphRepository,
  SeedEventsRepository,
  SeedStaticContentService,
  SeedUsersRatingsRepository,
  SeedUsersRepository
} from '..';
import { LocalEventsRepository } from '../../local/repositories/events.repository';
import { LocalLandingContentService } from '../../local/services/landing-content.service';

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
    const usersSeed = TestBed.inject(SeedUsersRepository);
    const eventsSeed = TestBed.inject(SeedEventsRepository);
    const eventsRepository = TestBed.inject(LocalEventsRepository);
    const userIds = usersSeed.seedDefaults()
      .map(user => user.id)
      .filter(Boolean)
      .slice(0, 8);
    eventsSeed.seedDefaults();

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
    const usersSeed = TestBed.inject(SeedUsersRepository);
    const eventsSeed = TestBed.inject(SeedEventsRepository);

    usersSeed.seedDefaults();
    eventsSeed.seedDefaults();
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

  it('preboot static content seed does not clear unrelated demo tables', async () => {
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: {},
        ids: ['stale-user']
      },
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: {
          stale: staleIdeaPost()
        },
        ids: ['stale']
      }
    }));

    const staticContentSeed = TestBed.inject(SeedStaticContentService);
    await staticContentSeed.ensureReady();

    const landingContent = TestBed.inject(LocalLandingContentService);
    const content = await landingContent.loadContent();
    const table = memoryDb.read()[IDEA_POSTS_TABLE_NAME];

    expect(memoryDb.read()[USERS_TABLE_NAME].ids).toEqual(['stale-user']);
    expect(table.ids).toContain('stale');
    expect(content.ideas.some(post => post.id === 'stale')).toBe(true);
    expect(content.ideas.length).toBeGreaterThan(0);
    expect(content.privacy.activeRevision?.documentKind).toBe('privacy');
    expect(content.terms.activeRevision?.documentKind).toBe('terms');
  });

  it('builds the admin affinity graph from bootstrap ratings with two demo clusters', async () => {
    const usersSeed = TestBed.inject(SeedUsersRepository);
    const usersRatingsSeed = TestBed.inject(SeedUsersRatingsRepository);
    const affinityGraphRepository = TestBed.inject(SeedAdminAffinityGraphRepository);

    const seededUsers = usersSeed.seedDefaults();
    usersRatingsSeed.seedDefaults(seededUsers);
    const snapshot = await affinityGraphRepository.buildGraphSnapshot();

    expect(snapshot.nodes.length).toBe(48);
    expect(componentSizes(snapshot.nodes.map(node => node.id), snapshot.edges)).toEqual([32, 16]);
  });

  it('seeds member rows for event cards that advertise accepted members', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);

    await bootstrap.ensureDemoSelectorReady('member');

    const state = memoryDb.read();
    const brunchRotation = Object.values(state[EVENTS_TABLE_NAME].byId)
      .find(record => record?.title === 'Brunch Rotation' && record.acceptedMembers > 0);
    expect(brunchRotation).toBeTruthy();

    const ownerKey = `event:${brunchRotation!.id}`;
    const memberIds = state[ACTIVITY_MEMBERS_TABLE_NAME].idsByOwnerKey[ownerKey] ?? [];
    const members = memberIds
      .map(id => state[ACTIVITY_MEMBERS_TABLE_NAME].byId[id])
      .filter(Boolean);

    expect(members.filter(member => member.status === 'accepted').length).toBe(brunchRotation!.acceptedMembers);
    expect(members.filter(member => member.status === 'pending').length).toBe(brunchRotation!.pendingMembers);
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

function staleIdeaPost(id = 'stale'): IdeaPostDto {
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
