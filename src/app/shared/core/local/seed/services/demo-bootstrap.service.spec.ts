import { EVENTS_TABLE_NAME, EVENT_FEEDBACK_TABLE_NAME } from '../../source/entity/event.entity';
import { CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import { CONTACTS_TABLE_NAME, PROFILE_EXPERIENCES_TABLE_NAME } from '../../source/entity/profile.entity';
import { HELP_CENTER_TABLE_NAME, IDEA_POSTS_TABLE_NAME } from '../../source/entity/content.entity';
import { USER_RATES_TABLE_NAME } from '../../source/entity/rate.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { LocalMemoryDb } from '../../../common/app.db';
import { appMemoryDbStorageKey, demoActiveUserStorageKey, scopedSessionStorageKey } from '../../../common/storage-scope';
import type { IdeaPostDto } from '../../../contracts/content.interface';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { ACTIVITY_MEMBERS_TABLE_NAME, ACTIVITY_RESOURCES_TABLE_NAME } from '../../source/entity/activity.entity';
import { ASSETS_TABLE_NAME } from '../../source/entity/asset.entity';







import { SeedDemoBootstrapService, SeedAdminAffinityGraphRepository, SeedEventsRepository, SeedStaticContentService, SeedUsersRatingsRepository, SeedUsersRepository } from '..';
import { LocalEventsRepository } from '../../source/repositories/events.repository';
import { LocalLandingContentService } from '../../source/services/landing-content.service';

describe('Demo bootstrap seeding', () => {
  let memoryDb: LocalMemoryDb;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('flushes member bootstrap tables per step without a broad IndexedDB flush', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const broadFlushSpy = vi.spyOn(memoryDb, 'flushToIndexedDb');

    await bootstrap.ensureDemoSelectorReady('member');

    const flushedTables = tableWriteSpy.mock.calls.map(([tableName]: [string, unknown]) => tableName);
    expect(broadFlushSpy).not.toHaveBeenCalled();
    expect(flushedTables).not.toContain(HELP_CENTER_TABLE_NAME);
    expect(flushedTables).not.toContain(IDEA_POSTS_TABLE_NAME);
    expect(flushedTables).toContain(CHATS_TABLE_NAME);
    expect(flushedTables).toContain(USERS_TABLE_NAME);
    expect(flushedTables).toContain(CONTACTS_TABLE_NAME);
    expect(flushedTables).toContain(PROFILE_EXPERIENCES_TABLE_NAME);
    expect(flushedTables).toContain(EVENT_FEEDBACK_TABLE_NAME);
    expect(flushedTables).toContain(USER_RATES_TABLE_NAME);
    expect(flushedTables).toContain(ACTIVITY_MEMBERS_TABLE_NAME);
    expect(flushedTables).toContain(EVENTS_TABLE_NAME);
    expect(flushedTables).toContain(ACTIVITY_RESOURCES_TABLE_NAME);
    expect(flushedTables).toContain(ASSETS_TABLE_NAME);
    expect(flushedTables.filter(tableName => tableName === EVENTS_TABLE_NAME).length).toBe(1);
    expect(flushedTables.indexOf(EVENTS_TABLE_NAME)).toBeGreaterThan(flushedTables.indexOf(ACTIVITY_MEMBERS_TABLE_NAME));
    expect(flushedTables.filter(tableName => tableName === ASSETS_TABLE_NAME).length).toBe(1);
    expect(flushedTables.indexOf(ASSETS_TABLE_NAME)).toBeGreaterThan(flushedTables.indexOf(ACTIVITY_RESOURCES_TABLE_NAME));
  });

  it('seeds common collections before admin-specific support data', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);

    await bootstrap.ensureDemoSelectorReady('admin');

    const state = memoryDb.read();
    expect(state[USERS_TABLE_NAME].ids).toContain('u1');
    expect(state[USERS_TABLE_NAME].ids).toContain('admin-demo-ava');
    expect(state[USERS_TABLE_NAME].byId['u1']?.admin).not.toBe(true);
    expect(state[USERS_TABLE_NAME].byId['admin-demo-ava']?.admin).toBe(true);
    expect(state[CHATS_TABLE_NAME].ids).toContain('u1:c1');
    expect(state[CHATS_TABLE_NAME].ids).toContain('admin-demo-ava:c-admin-service-help-u1');
    expect(state[EVENTS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[ASSETS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[ACTIVITY_RESOURCES_TABLE_NAME].ids.length).toBeGreaterThan(0);
  });

  it('adds admin-specific support data after member common collections without reseeding common tables', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');

    await bootstrap.ensureDemoSelectorReady('member');
    tableWriteSpy.mockClear();

    await bootstrap.ensureDemoSelectorReady('admin');

    const state = memoryDb.read();
    const flushedTables = tableWriteSpy.mock.calls.map(([tableName]: [string, unknown]) => tableName);
    expect(state[USERS_TABLE_NAME].ids).toContain('u1');
    expect(state[USERS_TABLE_NAME].ids).toContain('admin-demo-ava');
    expect(state[USERS_TABLE_NAME].byId['u1']?.admin).not.toBe(true);
    expect(state[USERS_TABLE_NAME].byId['admin-demo-ava']?.admin).toBe(true);
    expect(state[CHATS_TABLE_NAME].ids).toContain('u1:c1');
    expect(state[CHATS_TABLE_NAME].ids).toContain('admin-demo-ava:c-admin-service-help-u1');
    expect(flushedTables).not.toContain(EVENTS_TABLE_NAME);
    expect(flushedTables).not.toContain(ACTIVITY_RESOURCES_TABLE_NAME);
    expect(flushedTables).toContain(USERS_TABLE_NAME);
    expect(flushedTables).toContain(CHATS_TABLE_NAME);
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
