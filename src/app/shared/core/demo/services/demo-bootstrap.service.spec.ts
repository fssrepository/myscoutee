import { TestBed } from '@angular/core/testing';

import { DemoMemoryDb } from '../../base/db';
import { scopedStorageKey } from '../../base/storage-scope';
import type { IdeaPost } from '../../base/models';
import { EVENTS_TABLE_NAME, type DemoEventRecord } from '../models/events.model';
import { IDEA_POSTS_TABLE_NAME } from '../models/idea-posts.model';
import { USERS_TABLE_NAME } from '../models/users.model';
import { DemoEventsRepository } from '../repositories/events.repository';
import { DemoUsersRepository } from '../repositories/users.repository';
import { DemoLandingContentService } from './landing-content.service';

describe('Demo bootstrap seeding', () => {
  let memoryDb: DemoMemoryDb;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(DemoMemoryDb);
    await memoryDb.resetStorage();
  });

  afterEach(() => {
    localStorage.removeItem(scopedStorageKey('session.v1', 'http'));
    TestBed.resetTestingModule();
  });

  it('keeps bulk event handoffs equivalent to per-user event queries', () => {
    const usersRepository = TestBed.inject(DemoUsersRepository);
    const eventsRepository = TestBed.inject(DemoEventsRepository);
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
    const usersRepository = TestBed.inject(DemoUsersRepository);
    const eventsRepository = TestBed.inject(DemoEventsRepository);

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

    const landingContent = TestBed.inject(DemoLandingContentService);
    const content = await landingContent.loadContent();
    const table = memoryDb.read()[IDEA_POSTS_TABLE_NAME];

    expect(table.ids).not.toContain('stale');
    expect(content.ideas.some(post => post.id === 'stale')).toBe(false);
    expect(content.ideas.length).toBeGreaterThan(0);
  });

  it('resets demo bootstrap tables without touching http-scoped storage', async () => {
    localStorage.setItem(scopedStorageKey('memory.db.v1', 'demo'), 'stale-demo-memory');
    localStorage.setItem(scopedStorageKey('session.v1', 'http'), 'keep-http-session');
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
    expect(localStorage.getItem(scopedStorageKey('memory.db.v1', 'demo'))).toBeNull();
    expect(localStorage.getItem(scopedStorageKey('session.v1', 'http'))).toBe('keep-http-session');
  });

  it('full demo reset clears demo-scoped browser keys without touching http-scoped storage', async () => {
    localStorage.setItem(scopedStorageKey('session.v1', 'demo'), 'drop-demo-session');
    localStorage.setItem(scopedStorageKey('session.v1', 'http'), 'keep-http-session');
    sessionStorage.setItem(scopedStorageKey('demo.active-user.v1', 'demo'), 'drop-demo-active-user');

    await memoryDb.resetStorage();

    expect(localStorage.getItem(scopedStorageKey('session.v1', 'demo'))).toBeNull();
    expect(sessionStorage.getItem(scopedStorageKey('demo.active-user.v1', 'demo'))).toBeNull();
    expect(localStorage.getItem(scopedStorageKey('session.v1', 'http'))).toBe('keep-http-session');
  });
});

function signatures(records: readonly DemoEventRecord[]): string[] {
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
