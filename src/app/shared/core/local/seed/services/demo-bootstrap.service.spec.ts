import { EVENTS_TABLE_NAME, EVENT_FEEDBACK_TABLE_NAME } from '../../source/entity/event.entity';
import { CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import { CONTACTS_TABLE_NAME, PROFILE_EXPERIENCES_TABLE_NAME } from '../../source/entity/profile.entity';
import { HELP_CENTER_TABLE_NAME, IDEA_POSTS_TABLE_NAME } from '../../source/entity/content.entity';
import { SHARE_TOKENS_TABLE_NAME } from '../../source/entity/sharing.entity';
import { USER_RATES_TABLE_NAME } from '../../source/entity/rate.entity';
import { NOTIFICATIONS_TABLE_NAME } from '../../source/entity/notification.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { LocalMemoryDb } from '../../../common/app.db';
import {
  APP_INDEXED_DB_KEYS,
  appMemoryDbStorageKey,
  demoActiveUserStorageKey,
  scopedSessionStorageKey
} from '../../../common/storage-scope';
import type { IdeaPostDto } from '../../../contracts/content.interface';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { ACTIVITY_MEMBERS_TABLE_NAME, ACTIVITY_RESOURCES_TABLE_NAME } from '../../source/entity/activity.entity';
import { ASSETS_TABLE_NAME } from '../../source/entity/asset.entity';



import {
  SeedAdminAffinityGraphRepository,
  SeedAdminBootstrapRepository,
  SeedDemoBootstrapService,
  SeedEventsRepository,
  SeedOperatorRegistryRepository,
  SeedStaticContentService,
  SeedUsersRatingsRepository,
  SeedUsersRepository
} from '..';
import { SeedOperatorRegistryBuilder } from '../builders/operator-registry-seed.builder';
import { LocalOperatorRegistryMapper } from '../../source/mappers/operator-registry.mapper';
import { LocalOperatorRegistryRepository } from '../../source/repositories/operator-registry.repository';
import { LocalOperatorRegistryService } from '../../source/services/operator-registry.service';
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
    expect(flushedTables).not.toContain(EVENT_FEEDBACK_TABLE_NAME);
    expect(flushedTables).toContain(USER_RATES_TABLE_NAME);
    expect(flushedTables).toContain(ACTIVITY_MEMBERS_TABLE_NAME);
    expect(flushedTables).toContain(EVENTS_TABLE_NAME);
    expect(flushedTables).toContain(ACTIVITY_RESOURCES_TABLE_NAME);
    expect(flushedTables).toContain(ASSETS_TABLE_NAME);
    expect(flushedTables.filter(tableName => tableName === EVENTS_TABLE_NAME).length).toBe(2);
    expect(flushedTables.lastIndexOf(EVENTS_TABLE_NAME)).toBeGreaterThan(flushedTables.indexOf(ACTIVITY_MEMBERS_TABLE_NAME));
    expect(flushedTables.filter(tableName => tableName === ASSETS_TABLE_NAME).length).toBe(1);
    expect(flushedTables.indexOf(ASSETS_TABLE_NAME)).toBeGreaterThan(flushedTables.indexOf(ACTIVITY_RESOURCES_TABLE_NAME));
  });

  it('seeds event feedback state for a selected demo session without rewriting events', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');

    await bootstrap.ensureDemoSelectorReady('member');
    const eventsBefore = memoryDb.read()[EVENTS_TABLE_NAME];
    const eventIdsBefore = [...eventsBefore.ids];
    const eventRecordsBefore = JSON.stringify(eventsBefore.byId);
    tableWriteSpy.mockClear();

    await bootstrap.ensureUserReady('u3', 'member');

    const state = memoryDb.read();
    const flushedTables = tableWriteSpy.mock.calls.map(([tableName]: [string, unknown]) => tableName);
    expect(flushedTables).toContain(EVENT_FEEDBACK_TABLE_NAME);
    expect(flushedTables).toContain(NOTIFICATIONS_TABLE_NAME);
    expect(flushedTables).toContain(USERS_TABLE_NAME);
    expect(flushedTables).not.toContain(EVENTS_TABLE_NAME);
    expect(state[EVENT_FEEDBACK_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[NOTIFICATIONS_TABLE_NAME].idsByRecipientUserId['u3']?.length).toBe(32);
    expect(state[USERS_TABLE_NAME].byId['u3']?.activities.notifications).toBe(24);
    expect(state[EVENTS_TABLE_NAME].ids).toEqual(eventIdsBefore);
    expect(JSON.stringify(state[EVENTS_TABLE_NAME].byId)).toBe(eventRecordsBefore);
  });

  it('seeds common collections and admin users for the admin selector without workspace data', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);

    await bootstrap.ensureDemoSelectorReady('admin');

    const state = memoryDb.tables();
    expect(state[USERS_TABLE_NAME].ids).toContain('u1');
    expect(state[USERS_TABLE_NAME].ids).toContain('admin-demo-ava');
    expect(state[USERS_TABLE_NAME].ids).not.toContain('operator-demo-dev');
    expect(state[USERS_TABLE_NAME].byId['u1']?.admin).not.toBe(true);
    expect(state[USERS_TABLE_NAME].byId['admin-demo-ava']?.admin).toBe(true);
    expect(state[CHATS_TABLE_NAME].ids).toContain('u1:c1');
    expect(state[CHATS_TABLE_NAME].ids).not.toContain('admin-demo-ava:c-admin-service-help-u1');
    expect(state[EVENTS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[ASSETS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[ACTIVITY_RESOURCES_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[HELP_CENTER_TABLE_NAME].revisionIds.length).toBe(0);
    expect(state[IDEA_POSTS_TABLE_NAME].ids.length).toBe(0);
  });

  it('hydrates the operator seed once and flushes both steps sequentially', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const operatorSeed = TestBed.inject(SeedOperatorRegistryRepository);
    const runtimeRepository = TestBed.inject(LocalOperatorRegistryRepository);
    const adminSeed = TestBed.inject(SeedAdminBootstrapRepository);
    const usersSeed = TestBed.inject(SeedUsersRepository);
    const whenReadySpy = vi.spyOn(memoryDb, 'whenReady');
    const memoryReadSpy = vi.spyOn(memoryDb, 'read');
    const memoryWriteSpy = vi.spyOn(memoryDb, 'write');
    const registryReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const broadFlushSpy = vi.spyOn(memoryDb, 'flushToIndexedDb');
    const bootstrapBuilderSpy = vi.spyOn(SeedOperatorRegistryBuilder, 'buildBootstrapMemory');
    const seedMapperSpy = vi.spyOn(LocalOperatorRegistryMapper, 'toSeedRecord');
    const adminSeedSpy = vi.spyOn(adminSeed, 'seedDemoAdminUsers');
    const memberSeedSpy = vi.spyOn(usersSeed, 'seedDefaults');
    const runtimeRepositoryReadSpy = vi.spyOn(LocalOperatorRegistryRepository.prototype, 'read');
    const runtimeRepositoryWriteSpy = vi.spyOn(LocalOperatorRegistryRepository.prototype, 'write');
    const runtimeServiceLoadSpy = vi.spyOn(LocalOperatorRegistryService.prototype, 'loadStatus');
    const prepareOperatorSeedSpy = vi.spyOn(operatorSeed, 'prepareBootstrap');
    const seedOperatorUsersSpy = vi.spyOn(operatorSeed, 'seedUsers');
    const seedOperatorRegistrySpy = vi.spyOn(operatorSeed, 'seedRegistry');

    await bootstrap.ensureDemoSelectorReady('operator');
    await bootstrap.ensureDemoSelectorReady('operator');
    await runtimeRepository.read();
    await runtimeRepository.read();

    const state = memoryDb.tables();
    const operator = state[USERS_TABLE_NAME].byId['operator-demo-dev'];
    const registryWrites = tableWriteSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    );
    const userWrites = tableWriteSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === USERS_TABLE_NAME
    );

    expect(operator?.operator).toBe(true);
    expect(operator?.admin).not.toBe(true);
    expect(operator?.hostTier).toBe('Operator');
    expect(state[USERS_TABLE_NAME].ids).toEqual(['operator-demo-dev']);
    expect(state[EVENTS_TABLE_NAME].ids).toEqual([]);
    expect(state[CHATS_TABLE_NAME].ids).toEqual([]);

    expect(whenReadySpy).toHaveBeenCalledTimes(1);
    expect(memoryReadSpy).toHaveBeenCalledTimes(1);
    expect(memoryWriteSpy).toHaveBeenCalledTimes(1);
    expect(registryReadSpy).toHaveBeenCalledTimes(1);
    expect(registryReadSpy).toHaveBeenCalledWith(APP_INDEXED_DB_KEYS.operatorRegistry);
    expect(registryReadSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      tableWriteSpy.mock.invocationCallOrder[0]!
    );
    expect(registryWrites).toHaveLength(1);
    expect(userWrites).toHaveLength(1);
    expect(broadFlushSpy).not.toHaveBeenCalled();

    expect(bootstrapBuilderSpy).toHaveBeenCalledTimes(1);
    expect(prepareOperatorSeedSpy).toHaveBeenCalledTimes(1);
    expect(seedOperatorUsersSpy).toHaveBeenCalledTimes(1);
    expect(seedOperatorRegistrySpy).toHaveBeenCalledTimes(1);
    expect(seedOperatorUsersSpy.mock.calls[0]?.[0]).toBe(
      seedOperatorRegistrySpy.mock.calls[0]?.[0]
    );
    expect(seedOperatorUsersSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      seedOperatorRegistrySpy.mock.invocationCallOrder[0]!
    );
    expect(seedMapperSpy).toHaveBeenCalledTimes(1);
    expect(seedMapperSpy.mock.calls[0]?.[0]).toBe(bootstrapBuilderSpy.mock.calls[0]?.[0]);
    expect(bootstrapBuilderSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      memoryWriteSpy.mock.invocationCallOrder[0]!
    );
    expect(bootstrapBuilderSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      tableWriteSpy.mock.invocationCallOrder[0]!
    );
    expect(userWrites[0] && registryWrites[0]).toBeTruthy();
    expect(
      tableWriteSpy.mock.invocationCallOrder[
        tableWriteSpy.mock.calls.findIndex(([key]) => key === USERS_TABLE_NAME)
      ]!
    ).toBeLessThan(
      tableWriteSpy.mock.invocationCallOrder[
        tableWriteSpy.mock.calls.findIndex(
          ([key]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
        )
      ]!
    );

    expect(adminSeedSpy).not.toHaveBeenCalled();
    expect(memberSeedSpy).not.toHaveBeenCalled();
    expect(runtimeRepositoryReadSpy).toHaveBeenCalledTimes(3);
    expect(runtimeRepositoryWriteSpy).toHaveBeenCalledTimes(1);
    expect(runtimeServiceLoadSpy).not.toHaveBeenCalled();

    const registryRecord = registryWrites[0]?.[1] as {
      status?: { lifecycle?: string; simulation?: boolean };
      ledger?: Array<{ id: string; claimed: boolean; verifiedWeight: number }>;
      leaderboard?: Array<{
        id: string;
        claimed: boolean;
        verifiedWeight: number;
        group: string;
        operatorGroupId?: string | null;
        deploymentCount?: number;
      }>;
      auditHistory?: Array<{ kind: string }>;
      community?: {
        providers?: Array<{
          id: string;
          purpose: string;
          configured: boolean;
          available: boolean;
        }>;
        announcements?: Array<{
          kind: string;
          status: string;
          update?: {
            version?: string;
            artifact?: {
              downloadUrl?: string;
              downloadUrlVerified?: boolean;
            };
          } | null;
        }>;
      };
    };
    expect(registryRecord.status?.lifecycle).toBe('UNCONFIGURED');
    expect(registryRecord.status?.simulation).toBe(true);
    expect(registryRecord.auditHistory?.some(item => item.kind === 'SEED')).toBe(true);
    expect(registryRecord.leaderboard).toHaveLength(7);
    for (const ledgerEntry of (registryRecord.ledger ?? []).filter(
      item => item.id === 'founder' || !item.claimed
    )) {
      expect(registryRecord.leaderboard?.find(item => item.id === ledgerEntry.id)).toEqual(
        expect.objectContaining({
          claimed: ledgerEntry.claimed,
          verifiedWeight: ledgerEntry.verifiedWeight
        })
      );
    }
    expect(registryRecord.leaderboard?.find(
      item => item.operatorGroupId === 'operator-group-campus'
    )).toEqual(expect.objectContaining({
      claimed: true,
      verifiedWeight: 65_000,
      deploymentCount: 2
    }));
    expect(registryRecord.community?.providers).toEqual([
      expect.objectContaining({
        id: 'discord',
        purpose: 'operator.community.provider.discord.purpose',
        configured: false,
        available: true
      }),
      expect.objectContaining({
        id: 'discourse',
        purpose: 'operator.community.provider.discourse.purpose',
        configured: false,
        available: true
      })
    ]);
    expect(registryRecord.community?.announcements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'UPDATE',
        status: 'PUBLISHED',
        update: expect.objectContaining({
          version: '1.1.0',
          artifact: expect.objectContaining({
            downloadUrl: 'https://github.com/fssrepository/myscoutee/releases/download/v1.1.0/myscoutee_1.1.0_amd64.deb',
            downloadUrlVerified: true
          })
        })
      }),
      expect.objectContaining({
        kind: 'MAINTENANCE',
        status: 'PUBLISHED'
      })
    ]));
  });

  it('flushes unchanged operator seed steps without reading persisted state again', async () => {
    const operatorSeed = TestBed.inject(SeedOperatorRegistryRepository);
    const runtimeRepository = TestBed.inject(LocalOperatorRegistryRepository);
    const registryReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const memoryReadSpy = vi.spyOn(memoryDb, 'read');
    const runtimeRepositoryReadSpy = vi.spyOn(runtimeRepository, 'read');
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const broadFlushSpy = vi.spyOn(memoryDb, 'flushToIndexedDb');

    const initialContext = await operatorSeed.prepareBootstrap();
    await operatorSeed.seedUsers(initialContext);
    await operatorSeed.seedRegistry(initialContext);

    const unchangedContext = await operatorSeed.prepareBootstrap();
    expect(unchangedContext.result.usersChanged).toBe(false);
    expect(unchangedContext.result.registryChanged).toBe(false);

    const persistedReadCount = registryReadSpy.mock.calls.length;
    const memoryReadCount = memoryReadSpy.mock.calls.length;
    const repositoryReadCount = runtimeRepositoryReadSpy.mock.calls.length;
    tableWriteSpy.mockClear();

    await operatorSeed.seedUsers(unchangedContext);
    await operatorSeed.seedRegistry(unchangedContext);

    const flushedTableNames = tableWriteSpy.mock.calls.map(
      ([tableName]: [string, unknown]) => tableName
    );
    expect(flushedTableNames).toEqual([
      USERS_TABLE_NAME,
      APP_INDEXED_DB_KEYS.operatorRegistry
    ]);
    expect(registryReadSpy).toHaveBeenCalledTimes(persistedReadCount);
    expect(memoryReadSpy).toHaveBeenCalledTimes(memoryReadCount);
    expect(runtimeRepositoryReadSpy).toHaveBeenCalledTimes(repositoryReadCount);
    expect(broadFlushSpy).not.toHaveBeenCalled();
  });

  it('migrates a v2 payment catalog with one prepare read and targeted v3 writes', async () => {
    const staleRecord = SeedOperatorRegistryBuilder.buildInitialRecord(
      new Date('2026-07-28T18:00:00.000Z')
    );
    staleRecord.seedVersion = 'operator-workspace-v2';
    staleRecord.configuration = {
      ...staleRecord.configuration,
      payment: {
        availableProviders: [
          {
            id: 'paypal',
            label: 'PayPal',
            logoUrl: null,
            logoAlt: null,
            palette: 'slate'
          },
          {
            id: 'adyen',
            label: 'Adyen',
            logoUrl: null,
            logoAlt: null,
            palette: 'slate'
          }
        ],
        providerId: 'paypal',
        credentialConfigured: true,
        credentialMask: '••••live'
      }
    };
    await memoryDb.writeIndexedDbTableEntry(
      APP_INDEXED_DB_KEYS.operatorRegistry,
      staleRecord
    );

    const registryReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const broadFlushSpy = vi.spyOn(memoryDb, 'flushToIndexedDb');
    const operatorSeed = TestBed.inject(SeedOperatorRegistryRepository);
    const runtimeRepository = TestBed.inject(LocalOperatorRegistryRepository);

    const context = await operatorSeed.prepareBootstrap();
    await operatorSeed.seedUsers(context);
    await operatorSeed.seedRegistry(context);
    const migrated = await runtimeRepository.read();
    await runtimeRepository.read();

    expect(context.result.registryChanged).toBe(true);
    expect(migrated?.seedVersion).toBe('operator-workspace-v3');
    expect(migrated?.configuration.payment).toEqual({
      availableProviders: [
        {
          id: 'stripe',
          label: 'Stripe',
          logoUrl: 'assets/payment-providers/stripe.svg',
          logoAlt: 'Stripe',
          palette: 'violet'
        },
        {
          id: 'barion',
          label: 'Barion',
          logoUrl: 'assets/payment-providers/barion.svg',
          logoAlt: 'Barion',
          palette: 'blue'
        }
      ],
      providerId: null,
      credentialConfigured: false,
      credentialMask: null
    });
    expect(registryReadSpy).toHaveBeenCalledTimes(1);
    expect(tableWriteSpy.mock.calls.map(
      ([tableName]: [string, unknown]) => tableName
    )).toEqual([
      USERS_TABLE_NAME,
      APP_INDEXED_DB_KEYS.operatorRegistry
    ]);
    expect(broadFlushSpy).not.toHaveBeenCalled();
  });

  it('includes the operator user and registry state in the union selector bootstrap', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const registryReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');

    await bootstrap.ensureDemoSelectorReady('union');
    await bootstrap.ensureDemoSelectorReady('union');

    const state = memoryDb.read();
    const registryWriteIndex = tableWriteSpy.mock.calls.findIndex(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    );
    const lastUsersWriteIndex = tableWriteSpy.mock.calls.reduce(
      (result, [key], index) => key === USERS_TABLE_NAME ? index : result,
      -1
    );
    expect(state[USERS_TABLE_NAME].ids).toContain('u1');
    expect(state[USERS_TABLE_NAME].ids).toContain('admin-demo-ava');
    expect(state[USERS_TABLE_NAME].ids).toContain('operator-demo-dev');
    expect(state[USERS_TABLE_NAME].byId['operator-demo-dev']?.operator).toBe(true);
    expect(tableWriteSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toHaveLength(1);
    expect(registryReadSpy).toHaveBeenCalledTimes(1);
    expect(registryReadSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      tableWriteSpy.mock.invocationCallOrder[0]!
    );
    expect(lastUsersWriteIndex).toBeGreaterThanOrEqual(0);
    expect(registryWriteIndex).toBeGreaterThan(lastUsersWriteIndex);
  });

  it('adds admin selector users after member common collections without reseeding common tables', async () => {
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
    expect(state[CHATS_TABLE_NAME].ids).not.toContain('admin-demo-ava:c-admin-service-help-u1');
    expect(flushedTables).not.toContain(EVENTS_TABLE_NAME);
    expect(flushedTables).not.toContain(ACTIVITY_RESOURCES_TABLE_NAME);
    expect(flushedTables).toContain(USERS_TABLE_NAME);
    expect(flushedTables).not.toContain(CHATS_TABLE_NAME);
  });

  it('runs admin workspace bootstrap when an admin demo user is selected', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);
    const tableWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');

    await bootstrap.ensureDemoSelectorReady('union');
    tableWriteSpy.mockClear();

    await bootstrap.ensureUserReady('admin-demo-ava', 'admin');

    const state = memoryDb.read();
    const flushedTables = tableWriteSpy.mock.calls.map(([tableName]: [string, unknown]) => tableName);
    expect(state[CHATS_TABLE_NAME].ids).toContain('admin-demo-ava:c-admin-service-help-u1');
    expect(state[HELP_CENTER_TABLE_NAME].revisionIds.length).toBeGreaterThan(0);
    expect(state[IDEA_POSTS_TABLE_NAME].ids.length).toBeGreaterThan(0);
    expect(state[SHARE_TOKENS_TABLE_NAME].tokens.length).toBeGreaterThan(0);
    expect(flushedTables).toContain(HELP_CENTER_TABLE_NAME);
    expect(flushedTables).toContain(IDEA_POSTS_TABLE_NAME);
    expect(flushedTables).toContain(USERS_TABLE_NAME);
    expect(flushedTables).toContain(CHATS_TABLE_NAME);
    expect(flushedTables).toContain(SHARE_TOKENS_TABLE_NAME);
    expect(flushedTables).not.toContain(EVENTS_TABLE_NAME);
    expect(flushedTables).not.toContain(ACTIVITY_RESOURCES_TABLE_NAME);
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
    expect(content.ideas.some(post => post.id === 'stale')).toBe(false);
    expect(content.ideas.every(post => post.featured === true)).toBe(true);
    expect(content.ideas.length).toBeLessThanOrEqual(8);
    expect(content.ideasTotal).toBe(table.ids
      .map(id => table.byId[id])
      .filter(post => post?.published === true && post.trashed !== true && post.lang === 'en')
      .length);
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

  it('distributes accepted parent members across seeded tournament groups', async () => {
    const bootstrap = TestBed.inject(SeedDemoBootstrapService);

    await bootstrap.ensureDemoSelectorReady('member');

    const state = memoryDb.read();
    const tournamentEvent = Object.values(state[EVENTS_TABLE_NAME].byId)
      .find(record => record?.subEvents?.some(subEvent =>
        subEvent.optional !== true && Math.trunc(Number(subEvent.groupsCount) || 0) > 1
      ));
    const tournamentStage = tournamentEvent?.subEvents?.find(subEvent =>
      subEvent.optional !== true && Math.trunc(Number(subEvent.groupsCount) || 0) > 1
    );
    expect(tournamentEvent).toBeTruthy();
    expect(tournamentStage).toBeTruthy();

    const parentOwnerKey = `event:${tournamentEvent!.id}`;
    const acceptedParentUserIds = (state[ACTIVITY_MEMBERS_TABLE_NAME].idsByOwnerKey[parentOwnerKey] ?? [])
      .map(id => state[ACTIVITY_MEMBERS_TABLE_NAME].byId[id])
      .filter(member => member?.status === 'accepted')
      .map(member => member!.userId);
    const groupsCount = Math.trunc(Number(tournamentStage!.groupsCount) || 0);
    const groupUserIds = Array.from({ length: groupsCount }, (_, groupIndex) => {
      const groupId = `${tournamentStage!.id}-group-${groupIndex + 1}`;
      const ownerKey = `group:${tournamentEvent!.id}:${tournamentStage!.id}:${groupId}`;
      return (state[ACTIVITY_MEMBERS_TABLE_NAME].idsByOwnerKey[ownerKey] ?? [])
        .map(id => state[ACTIVITY_MEMBERS_TABLE_NAME].byId[id])
        .filter(member => member?.status === 'accepted')
        .map(member => member!.userId);
    });

    expect(groupUserIds.some(userIds => userIds.length > 0)).toBe(true);
    expect(groupUserIds.flat().sort()).toEqual([...acceptedParentUserIds].sort());
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
    record.adminIds?.join(',') ?? '',
    record.inviter ? 'invitation' : 'direct',
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
