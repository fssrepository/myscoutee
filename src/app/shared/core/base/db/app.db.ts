import { Injectable, signal } from '@angular/core';

import type {
  ActivityRateRecordQuery,
  ActivityRateRecordQueryResult,
  UserRateRecord
} from '../interfaces/game.interface';
import { ASSETS_TABLE_NAME } from '../../demo/models/assets.model';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../demo/models/activity-members.model';
import { ACTIVITY_RESOURCES_TABLE_NAME } from '../../demo/models/activity-resources.model';
import { CHATS_TABLE_NAME } from '../../demo/models/chats.model';
import { EVENTS_TABLE_NAME } from '../../demo/models/events.model';
import type { DemoMemorySchema } from '../../demo/models/memory.model';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME
} from '../../demo/models/users.model';

interface IndexedUserRateRecord extends UserRateRecord {
  ownerUserIdNormalized: string;
  sourceNormalized: UserRateRecord['source'];
  modeNormalized: UserRateRecord['mode'];
  displayDirectionNormalized: NonNullable<UserRateRecord['displayDirection']> | '';
  happenedAtMs: number;
  distanceMetersNormalized: number;
  relevanceScore: number;
}

interface ActivityRateCursorPayload {
  id: string;
  happenedAtMs: number;
  distanceMeters: number;
  relevanceScore: number;
}

interface NormalizedActivityRateRecordQuery {
  ownerUserId: string;
  mode: 'single' | 'pair';
  displayDirection: 'given' | 'received' | 'mutual' | 'met';
  sort: 'happenedAt' | 'distance' | 'relevance';
  sortDirection: 'asc' | 'desc';
  cursor: ActivityRateCursorPayload | null;
  limit: number;
  rangeStartMs: number | null;
  rangeEndMs: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AppMemoryDb {
  private static readonly STORAGE_KEY = 'myscoutee.memory.db.v1';
  private static readonly LEGACY_STORAGE_KEYS = ['myscoutee.demo.db.v1'];
  private static readonly INDEXED_DB_NAME = 'myscoutee-memory-db';
  private static readonly LEGACY_INDEXED_DB_NAMES = ['myscoutee-demo-db'];
  private static readonly INDEXED_DB_VERSION = 4;
  private static readonly INDEXED_DB_STORE = 'tables';
  private static readonly USER_RATES_RECORDS_STORE = 'userRateRecords';
  private static readonly USER_RATES_ACTIVITY_DATE_INDEX = 'activityRatesByDate';
  private static readonly USER_RATES_ACTIVITY_DISTANCE_INDEX = 'activityRatesByDistance';
  private static readonly USER_RATES_ACTIVITY_RELEVANCE_INDEX = 'activityRatesByRelevance';
  private static readonly LEGACY_INDEXED_DB_STATE_KEY = 'current';
  private readonly _tables = signal<DemoMemorySchema>(this.loadInitialState());
  private pendingPersistState: DemoMemorySchema | null = null;
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly tables = this._tables.asReadonly();

  constructor() {
    void this.hydrateFromIndexedDb();
  }

  read(): DemoMemorySchema {
    return this._tables();
  }

  write(updater: (current: DemoMemorySchema) => DemoMemorySchema): void {
    const next = this.normalizeState(updater(this._tables()));
    this._tables.set(next);
    this.schedulePersist(next);
  }

  async queryActivityRateRecords(query: ActivityRateRecordQuery): Promise<ActivityRateRecordQueryResult> {
    const normalizedQuery = this.normalizeActivityRateRecordQuery(query);
    if (!normalizedQuery) {
      return {
        records: [],
        total: 0
      };
    }

    const db = await this.openIndexedDb(AppMemoryDb.INDEXED_DB_NAME, true);
    if (!db || !db.objectStoreNames.contains(AppMemoryDb.USER_RATES_RECORDS_STORE)) {
      return this.queryActivityRateRecordsFromMemory(normalizedQuery);
    }

    try {
      const result = await this.queryActivityRateRecordsFromIndexedDb(db, normalizedQuery);
      if (result.total > 0 || !this.hasActivityRateRecordsInMemory(normalizedQuery)) {
        return result;
      }
      return this.queryActivityRateRecordsFromMemory(normalizedQuery);
    } catch {
      return this.queryActivityRateRecordsFromMemory(normalizedQuery);
    }
  }

  private createEmptyState(): DemoMemorySchema {
    return {
      [ASSETS_TABLE_NAME]: {
        byId: {},
        ids: [],
        idsByOwnerUserId: {}
      },
      [ACTIVITY_MEMBERS_TABLE_NAME]: {
        byId: {},
        ids: [],
        idsByOwnerKey: {}
      },
      [ACTIVITY_RESOURCES_TABLE_NAME]: {
        byId: {},
        ids: [],
        idsByOwnerKey: {}
      },
      [USERS_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [USER_RATES_TABLE_NAME]: {
        byId: {},
        ids: [],
        idsByRelevantUserId: {}
      },
      [USER_RATES_OUTBOX_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [USER_FILTER_PREFERENCES_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [CHATS_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [EVENTS_TABLE_NAME]: {
        byId: {},
        ids: []
      }
    };
  }

  private loadInitialState(): DemoMemorySchema {
    const fallback = this.createEmptyState();
    if (!this.canUseStorage()) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(AppMemoryDb.STORAGE_KEY) ?? this.readLegacyStorageRaw();
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeState(parsed, fallback);
    } catch {
      return fallback;
    }
  }

  private readLegacyStorageRaw(): string | null {
    for (const key of AppMemoryDb.LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        return raw;
      }
    }
    return null;
  }

  private persist(state: DemoMemorySchema): void {
    if (!this.canUseStorage()) {
      return;
    }
    try {
      localStorage.setItem(AppMemoryDb.STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota/private-mode write failures in demo mode.
    }
  }

  private schedulePersist(state: DemoMemorySchema): void {
    this.pendingPersistState = state;
    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
    }
    this.persistTimerId = setTimeout(() => {
      this.persistTimerId = null;
      const pendingState = this.pendingPersistState;
      this.pendingPersistState = null;
      if (!pendingState) {
        return;
      }
      this.persist(pendingState);
      void this.persistToIndexedDb(pendingState);
    }, 32);
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    const snapshot = await this.readFromIndexedDb();
    if (!snapshot) {
      void this.persistToIndexedDb(this._tables());
      return;
    }
    const normalized = this.normalizeState(snapshot);
    const current = this._tables();
    const currentHasUsers = current[USERS_TABLE_NAME].ids.length > 0;
    const incomingHasUsers = normalized[USERS_TABLE_NAME].ids.length > 0;
    if (currentHasUsers && !incomingHasUsers) {
      return;
    }
    this._tables.set(normalized);
    this.persist(normalized);
    void this.persistToIndexedDb(normalized);
  }

  private async readFromIndexedDb(): Promise<DemoMemorySchema | null> {
    const primaryDb = await this.openIndexedDb(AppMemoryDb.INDEXED_DB_NAME, true);
    if (primaryDb) {
      const primarySnapshot = await this.readStateFromIndexedDb(primaryDb);
      if (primarySnapshot) {
        return primarySnapshot;
      }
    }

    for (const legacyDbName of AppMemoryDb.LEGACY_INDEXED_DB_NAMES) {
      const legacyDb = await this.openIndexedDb(legacyDbName, false);
      if (!legacyDb) {
        continue;
      }
      const legacySnapshot = await this.readStateFromIndexedDb(legacyDb);
      if (legacySnapshot) {
        return legacySnapshot;
      }
    }

    return null;
  }

  private async readStateFromIndexedDb(db: IDBDatabase): Promise<DemoMemorySchema | null> {
    const users = await this.readIndexedDbEntry(db, USERS_TABLE_NAME);
    const assets = await this.readIndexedDbEntry(db, ASSETS_TABLE_NAME);
    const activityMembers = await this.readIndexedDbEntry(db, ACTIVITY_MEMBERS_TABLE_NAME);
    const activityResources = await this.readIndexedDbEntry(db, ACTIVITY_RESOURCES_TABLE_NAME);
    const rates = await this.readIndexedDbEntry(db, USER_RATES_TABLE_NAME);
    const outbox = await this.readIndexedDbEntry(db, USER_RATES_OUTBOX_TABLE_NAME);
    const filterPreferences = await this.readIndexedDbEntry(db, USER_FILTER_PREFERENCES_TABLE_NAME);
    const chats = await this.readIndexedDbEntry(db, CHATS_TABLE_NAME);
    const events = await this.readIndexedDbEntry(db, EVENTS_TABLE_NAME)
      ?? await this.readIndexedDbEntry(db, 'demoEvents');

    const hasSegmentedState = users !== null
      || activityMembers !== null
      || activityResources !== null
      || assets !== null
      || rates !== null
      || outbox !== null
      || filterPreferences !== null
      || chats !== null
      || events !== null;
    if (!hasSegmentedState) {
      const legacy = await this.readIndexedDbEntry(db, AppMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);
      if (legacy !== null) {
        return this.normalizeState(legacy, this.createEmptyState());
      }
      return null;
    }

    const partialState: Partial<DemoMemorySchema> = {};
    if (users !== null) {
      partialState[USERS_TABLE_NAME] = users as DemoMemorySchema[typeof USERS_TABLE_NAME];
    }
    if (assets !== null) {
      partialState[ASSETS_TABLE_NAME] = assets as DemoMemorySchema[typeof ASSETS_TABLE_NAME];
    }
    if (activityMembers !== null) {
      partialState[ACTIVITY_MEMBERS_TABLE_NAME] = activityMembers as DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME];
    }
    if (activityResources !== null) {
      partialState[ACTIVITY_RESOURCES_TABLE_NAME] = activityResources as DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME];
    }
    if (rates !== null) {
      partialState[USER_RATES_TABLE_NAME] = rates as DemoMemorySchema[typeof USER_RATES_TABLE_NAME];
    }
    if (outbox !== null) {
      partialState[USER_RATES_OUTBOX_TABLE_NAME] = outbox as DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME];
    }
    if (filterPreferences !== null) {
      partialState[USER_FILTER_PREFERENCES_TABLE_NAME] = filterPreferences as DemoMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME];
    }
    if (chats !== null) {
      partialState[CHATS_TABLE_NAME] = chats as DemoMemorySchema[typeof CHATS_TABLE_NAME];
    }
    if (events !== null) {
      partialState[EVENTS_TABLE_NAME] = events as DemoMemorySchema[typeof EVENTS_TABLE_NAME];
    }
    return this.normalizeState(partialState, this.createEmptyState());
  }

  private async persistToIndexedDb(state: DemoMemorySchema): Promise<void> {
    const db = await this.openIndexedDb(AppMemoryDb.INDEXED_DB_NAME, true);
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(
        [AppMemoryDb.INDEXED_DB_STORE, AppMemoryDb.USER_RATES_RECORDS_STORE],
        'readwrite'
      );
      const tablesStore = tx.objectStore(AppMemoryDb.INDEXED_DB_STORE);
      tablesStore.put(state[USERS_TABLE_NAME], USERS_TABLE_NAME);
      tablesStore.put(state[ASSETS_TABLE_NAME], ASSETS_TABLE_NAME);
      tablesStore.put(state[ACTIVITY_MEMBERS_TABLE_NAME], ACTIVITY_MEMBERS_TABLE_NAME);
      tablesStore.put(state[ACTIVITY_RESOURCES_TABLE_NAME], ACTIVITY_RESOURCES_TABLE_NAME);
      tablesStore.put(state[USER_RATES_TABLE_NAME], USER_RATES_TABLE_NAME);
      tablesStore.put(state[USER_RATES_OUTBOX_TABLE_NAME], USER_RATES_OUTBOX_TABLE_NAME);
      tablesStore.put(state[USER_FILTER_PREFERENCES_TABLE_NAME], USER_FILTER_PREFERENCES_TABLE_NAME);
      tablesStore.put(state[CHATS_TABLE_NAME], CHATS_TABLE_NAME);
      tablesStore.put(state[EVENTS_TABLE_NAME], EVENTS_TABLE_NAME);
      tablesStore.delete('demoEvents');
      tablesStore.delete('rates');
      tablesStore.delete(AppMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);

      const userRatesStore = tx.objectStore(AppMemoryDb.USER_RATES_RECORDS_STORE);
      userRatesStore.clear();
      const ratesTable = state[USER_RATES_TABLE_NAME];
      for (const id of ratesTable.ids) {
        const record = ratesTable.byId[id];
        if (!record) {
          continue;
        }
        userRatesStore.put(this.toIndexedUserRateRecord(record));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private readIndexedDbEntry(db: IDBDatabase, key: string): Promise<unknown | null> {
    return new Promise<unknown | null>(resolve => {
      const tx = db.transaction(AppMemoryDb.INDEXED_DB_STORE, 'readonly');
      const store = tx.objectStore(AppMemoryDb.INDEXED_DB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  private openIndexedDb(dbName: string, createIfMissing: boolean): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise<IDBDatabase | null>(resolve => {
      const request = indexedDB.open(dbName, AppMemoryDb.INDEXED_DB_VERSION);
      let rejectedMissingDb = false;
      request.onupgradeneeded = () => {
        if (!createIfMissing) {
          rejectedMissingDb = true;
          request.transaction?.abort();
          return;
        }
        const db = request.result;
        if (!db.objectStoreNames.contains(AppMemoryDb.INDEXED_DB_STORE)) {
          db.createObjectStore(AppMemoryDb.INDEXED_DB_STORE);
        }
        this.ensureUserRatesRecordsStore(db, request.transaction);
      };
      request.onsuccess = () => {
        if (rejectedMissingDb) {
          request.result.close();
          resolve(null);
          return;
        }
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  private ensureUserRatesRecordsStore(db: IDBDatabase, upgradeTransaction: IDBTransaction | null): void {
    const store = db.objectStoreNames.contains(AppMemoryDb.USER_RATES_RECORDS_STORE)
      ? upgradeTransaction?.objectStore(AppMemoryDb.USER_RATES_RECORDS_STORE)
      : db.createObjectStore(AppMemoryDb.USER_RATES_RECORDS_STORE, { keyPath: 'id' });

    if (!store) {
      return;
    }

    if (!store.indexNames.contains(AppMemoryDb.USER_RATES_ACTIVITY_DATE_INDEX)) {
      store.createIndex(
        AppMemoryDb.USER_RATES_ACTIVITY_DATE_INDEX,
        ['ownerUserIdNormalized', 'sourceNormalized', 'modeNormalized', 'displayDirectionNormalized', 'happenedAtMs', 'id']
      );
    }

    if (!store.indexNames.contains(AppMemoryDb.USER_RATES_ACTIVITY_DISTANCE_INDEX)) {
      store.createIndex(
        AppMemoryDb.USER_RATES_ACTIVITY_DISTANCE_INDEX,
        ['ownerUserIdNormalized', 'sourceNormalized', 'modeNormalized', 'displayDirectionNormalized', 'distanceMetersNormalized', 'id']
      );
    }

    if (!store.indexNames.contains(AppMemoryDb.USER_RATES_ACTIVITY_RELEVANCE_INDEX)) {
      store.createIndex(
        AppMemoryDb.USER_RATES_ACTIVITY_RELEVANCE_INDEX,
        ['ownerUserIdNormalized', 'sourceNormalized', 'modeNormalized', 'displayDirectionNormalized', 'relevanceScore', 'id']
      );
    }
  }

  private queryActivityRateRecordsFromIndexedDb(
    db: IDBDatabase,
    query: NormalizedActivityRateRecordQuery
  ): Promise<ActivityRateRecordQueryResult> {
    return new Promise<ActivityRateRecordQueryResult>(resolve => {
      const tx = db.transaction(AppMemoryDb.USER_RATES_RECORDS_STORE, 'readonly');
      const store = tx.objectStore(AppMemoryDb.USER_RATES_RECORDS_STORE);
      const index = store.index(this.activityRateIndexName(query.sort));
      const countRequest = index.count(this.activityRateIndexRange(query));
      const request = index.openCursor(this.activityRatePageRange(query), this.activityRateCursorDirection(query));
      const records: UserRateRecord[] = [];
      let total = 0;
      let nextCursor: string | null = null;
      let countReady = false;
      let cursorComplete = false;

      const finish = () => {
        if (!countReady || !cursorComplete) {
          return;
        }
        resolve({
          records,
          total,
          nextCursor
        });
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          cursorComplete = true;
          finish();
          return;
        }

        const indexedRecord = cursor.value as IndexedUserRateRecord | undefined;
        const record = indexedRecord ? this.toUserRateRecord(indexedRecord) : null;
        if (record && this.matchesActivityRateRange(record, query.rangeStartMs, query.rangeEndMs)) {
          if (records.length < query.limit) {
            records.push(record);
            cursor.continue();
            return;
          }
          nextCursor = this.serializeActivityRateCursor(records[records.length - 1]);
          cursorComplete = true;
          finish();
          return;
        }
        cursor.continue();
      };

      countRequest.onsuccess = () => {
        total = Number.isFinite(countRequest.result) ? Math.max(0, Math.trunc(Number(countRequest.result))) : 0;
        countReady = true;
        finish();
      };

      request.onerror = () => {
        resolve(this.queryActivityRateRecordsFromMemory(query));
      };
      countRequest.onerror = () => {
        resolve(this.queryActivityRateRecordsFromMemory(query));
      };
      tx.onerror = () => {
        resolve(this.queryActivityRateRecordsFromMemory(query));
      };
      tx.onabort = () => {
        resolve(this.queryActivityRateRecordsFromMemory(query));
      };
    });
  }

  private queryActivityRateRecordsFromMemory(query: NormalizedActivityRateRecordQuery): ActivityRateRecordQueryResult {
    const ratesTable = this._tables()[USER_RATES_TABLE_NAME];
    const filtered = ratesTable.ids
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record => record.source === 'activity-rate')
      .filter(record => (record.ownerUserId?.trim() ?? '') === query.ownerUserId)
      .filter(record => record.mode === query.mode)
      .filter(record => (record.displayDirection ?? '') === query.displayDirection)
      .filter(record => this.matchesActivityRateRange(record, query.rangeStartMs, query.rangeEndMs))
      .sort((left, right) => this.compareActivityRates(left, right, query));
    const startIndex = query.cursor
      ? Math.max(0, filtered.findIndex(record => record.id === query.cursor?.id) + 1)
      : 0;
    const pageRecords = filtered
      .slice(startIndex, startIndex + query.limit)
      .map(record => ({ ...record }));

    return {
      records: pageRecords,
      total: filtered.length,
      nextCursor: filtered.length > startIndex + pageRecords.length && pageRecords.length > 0
        ? this.serializeActivityRateCursor(pageRecords[pageRecords.length - 1])
        : null
    };
  }

  private hasActivityRateRecordsInMemory(query: NormalizedActivityRateRecordQuery): boolean {
    const ratesTable = this._tables()[USER_RATES_TABLE_NAME];
    return ratesTable.ids.some(id => {
      const record = ratesTable.byId[id];
      return Boolean(record)
        && record.source === 'activity-rate'
        && (record.ownerUserId?.trim() ?? '') === query.ownerUserId
        && record.mode === query.mode
        && (record.displayDirection ?? '') === query.displayDirection;
    });
  }

  private normalizeActivityRateRecordQuery(query: ActivityRateRecordQuery): NormalizedActivityRateRecordQuery | null {
    const ownerUserId = query.ownerUserId.trim();
    if (!ownerUserId) {
      return null;
    }

    const limit = Math.max(1, Math.trunc(Number(query.limit) || 50));
    const sort = query.sort;
    const sortDirection = query.sortDirection === 'asc' || query.sortDirection === 'desc'
      ? query.sortDirection
      : (sort === 'distance' ? 'asc' : 'desc');
    const rangeStartMs = this.parseSortableTimestamp(query.rangeStartIso);
    const rangeEndMs = this.parseSortableTimestamp(query.rangeEndIso);
    const cursor = this.parseActivityRateCursor(query.cursor);

    if (
      rangeStartMs !== null
      && rangeEndMs !== null
      && rangeStartMs > rangeEndMs
    ) {
      return null;
    }

    return {
      ownerUserId,
      mode: query.mode,
      displayDirection: query.displayDirection,
      sort,
      sortDirection,
      cursor,
      limit,
      rangeStartMs,
      rangeEndMs
    };
  }

  private toIndexedUserRateRecord(record: UserRateRecord): IndexedUserRateRecord {
    return {
      ...record,
      ownerUserIdNormalized: record.ownerUserId?.trim() ?? '',
      sourceNormalized: record.source,
      modeNormalized: record.mode,
      displayDirectionNormalized: record.displayDirection ?? '',
      happenedAtMs: this.userRateSortValue(record),
      distanceMetersNormalized: this.userRateDistanceValue(record),
      relevanceScore: this.userRateRelevanceScore(record)
    };
  }

  private toUserRateRecord(record: IndexedUserRateRecord): UserRateRecord {
    const {
      ownerUserIdNormalized: _ownerUserIdNormalized,
      sourceNormalized: _sourceNormalized,
      modeNormalized: _modeNormalized,
      displayDirectionNormalized: _displayDirectionNormalized,
      happenedAtMs: _happenedAtMs,
      distanceMetersNormalized: _distanceMetersNormalized,
      relevanceScore: _relevanceScore,
      ...baseRecord
    } = record;
    return {
      ...baseRecord
    };
  }

  private activityRateIndexName(sort: NormalizedActivityRateRecordQuery['sort']): string {
    if (sort === 'distance') {
      return AppMemoryDb.USER_RATES_ACTIVITY_DISTANCE_INDEX;
    }
    if (sort === 'relevance') {
      return AppMemoryDb.USER_RATES_ACTIVITY_RELEVANCE_INDEX;
    }
    return AppMemoryDb.USER_RATES_ACTIVITY_DATE_INDEX;
  }

  private activityRateIndexRange(query: NormalizedActivityRateRecordQuery): IDBKeyRange {
    if (query.sort === 'distance') {
      return IDBKeyRange.bound(
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, 0, ''],
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, Number.MAX_SAFE_INTEGER, '\uffff']
      );
    }

    if (query.sort === 'relevance') {
      return IDBKeyRange.bound(
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, 0, ''],
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, Number.MAX_SAFE_INTEGER, '\uffff']
      );
    }

    return IDBKeyRange.bound(
      [
        query.ownerUserId,
        'activity-rate',
        query.mode,
        query.displayDirection,
        query.rangeStartMs ?? 0,
        ''
      ],
      [
        query.ownerUserId,
        'activity-rate',
        query.mode,
        query.displayDirection,
        query.rangeEndMs ?? Number.MAX_SAFE_INTEGER,
        '\uffff'
      ]
    );
  }

  private activityRatePageRange(query: NormalizedActivityRateRecordQuery): IDBKeyRange {
    const fullRange = this.activityRateIndexRange(query);
    const cursorKey = this.activityRateCursorKey(query);
    if (!cursorKey) {
      return fullRange;
    }

    const [lower, upper] = this.activityRateRangeBounds(query);
    if (query.sortDirection === 'asc') {
      return IDBKeyRange.bound(cursorKey, upper, true, false);
    }
    return IDBKeyRange.bound(lower, cursorKey, false, true);
  }

  private activityRateRangeBounds(query: NormalizedActivityRateRecordQuery): [IDBValidKey, IDBValidKey] {
    if (query.sort === 'distance') {
      return [
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, 0, ''],
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, Number.MAX_SAFE_INTEGER, '\uffff']
      ];
    }

    if (query.sort === 'relevance') {
      return [
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, 0, ''],
        [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, Number.MAX_SAFE_INTEGER, '\uffff']
      ];
    }

    return [
      [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, query.rangeStartMs ?? 0, ''],
      [query.ownerUserId, 'activity-rate', query.mode, query.displayDirection, query.rangeEndMs ?? Number.MAX_SAFE_INTEGER, '\uffff']
    ];
  }

  private activityRateCursorKey(query: NormalizedActivityRateRecordQuery): IDBValidKey | null {
    if (!query.cursor) {
      return null;
    }

    if (query.sort === 'distance') {
      return [
        query.ownerUserId,
        'activity-rate',
        query.mode,
        query.displayDirection,
        query.cursor.distanceMeters,
        query.cursor.id
      ];
    }

    if (query.sort === 'relevance') {
      return [
        query.ownerUserId,
        'activity-rate',
        query.mode,
        query.displayDirection,
        query.cursor.relevanceScore,
        query.cursor.id
      ];
    }

    return [
      query.ownerUserId,
      'activity-rate',
      query.mode,
      query.displayDirection,
      query.cursor.happenedAtMs,
      query.cursor.id
    ];
  }

  private activityRateCursorDirection(query: NormalizedActivityRateRecordQuery): IDBCursorDirection {
    return query.sortDirection === 'asc' ? 'next' : 'prev';
  }

  private matchesActivityRateRange(
    record: UserRateRecord,
    rangeStartMs: number | null,
    rangeEndMs: number | null
  ): boolean {
    if (rangeStartMs === null && rangeEndMs === null) {
      return true;
    }
    const happenedAtMs = this.userRateSortValue(record);
    if (rangeStartMs !== null && happenedAtMs < rangeStartMs) {
      return false;
    }
    if (rangeEndMs !== null && happenedAtMs > rangeEndMs) {
      return false;
    }
    return true;
  }

  private compareActivityRates(
    left: UserRateRecord,
    right: UserRateRecord,
    query: NormalizedActivityRateRecordQuery
  ): number {
    if (query.sort === 'distance') {
      const distanceDelta = this.userRateDistanceValue(left) - this.userRateDistanceValue(right);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
      return left.id.localeCompare(right.id);
    }

    if (query.sort === 'relevance') {
      const relevanceDelta = this.userRateRelevanceScore(right) - this.userRateRelevanceScore(left);
      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }
      return right.id.localeCompare(left.id);
    }

    const happenedAtDelta = query.sortDirection === 'asc'
      ? this.userRateSortValue(left) - this.userRateSortValue(right)
      : this.userRateSortValue(right) - this.userRateSortValue(left);
    if (happenedAtDelta !== 0) {
      return happenedAtDelta;
    }
    return query.sortDirection === 'asc'
      ? left.id.localeCompare(right.id)
      : right.id.localeCompare(left.id);
  }

  private parseSortableTimestamp(value: string | undefined): number | null {
    if (!value) {
      return null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseActivityRateCursor(value: string | null | undefined): ActivityRateCursorPayload | null {
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as Partial<ActivityRateCursorPayload>;
      const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
      if (!id) {
        return null;
      }
      return {
        id,
        happenedAtMs: Number.isFinite(parsed.happenedAtMs) ? Math.max(0, Math.trunc(Number(parsed.happenedAtMs))) : 0,
        distanceMeters: Number.isFinite(parsed.distanceMeters) ? Math.max(0, Math.trunc(Number(parsed.distanceMeters))) : 0,
        relevanceScore: Number.isFinite(parsed.relevanceScore) ? Math.max(0, Math.trunc(Number(parsed.relevanceScore))) : 0
      };
    } catch {
      return null;
    }
  }

  private serializeActivityRateCursor(record: UserRateRecord): string {
    return JSON.stringify({
      id: record.id,
      happenedAtMs: this.userRateSortValue(record),
      distanceMeters: this.userRateDistanceValue(record),
      relevanceScore: this.userRateRelevanceScore(record)
    } satisfies ActivityRateCursorPayload);
  }

  private normalizeState(value: unknown, fallback = this.createEmptyState()): DemoMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<DemoMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const assetsSource = source[ASSETS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined;
    const activityMembersSource = source[ACTIVITY_MEMBERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined;
    const activityResourcesSource = source[ACTIVITY_RESOURCES_TABLE_NAME] as Partial<DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]> | undefined;
    const ratesSource = source[USER_RATES_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined;
    const outboxSource = source[USER_RATES_OUTBOX_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]> | undefined;
    const filterPreferencesSource = source[USER_FILTER_PREFERENCES_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME]> | undefined;
    const legacySource = source as Record<string, unknown>;
    const chatsSource = source[CHATS_TABLE_NAME] as Partial<DemoMemorySchema[typeof CHATS_TABLE_NAME]> | undefined;
    const eventsSource = (
      source[EVENTS_TABLE_NAME]
      ?? legacySource['demoEvents']
    ) as Partial<DemoMemorySchema[typeof EVENTS_TABLE_NAME]> | undefined;
    return {
      [ASSETS_TABLE_NAME]: {
        byId: this.normalizeAssetsById(assetsSource?.byId, fallback[ASSETS_TABLE_NAME].byId),
        ids: this.normalizeIdList(assetsSource?.ids, fallback[ASSETS_TABLE_NAME].ids),
        idsByOwnerUserId: this.normalizeAssetsIdsByOwnerUserId(assetsSource)
      },
      [ACTIVITY_MEMBERS_TABLE_NAME]: {
        byId: this.normalizeActivityMembersById(activityMembersSource?.byId, fallback[ACTIVITY_MEMBERS_TABLE_NAME].byId),
        ids: this.normalizeIdList(activityMembersSource?.ids, fallback[ACTIVITY_MEMBERS_TABLE_NAME].ids),
        idsByOwnerKey: this.normalizeActivityMembersIdsByOwnerKey(activityMembersSource)
      },
      [ACTIVITY_RESOURCES_TABLE_NAME]: {
        byId: this.normalizeActivityResourcesById(activityResourcesSource?.byId, fallback[ACTIVITY_RESOURCES_TABLE_NAME].byId),
        ids: this.normalizeIdList(activityResourcesSource?.ids, fallback[ACTIVITY_RESOURCES_TABLE_NAME].ids),
        idsByOwnerKey: this.normalizeActivityResourcesIdsByOwnerKey(activityResourcesSource)
      },
      [USERS_TABLE_NAME]: {
        byId: usersSource?.byId && typeof usersSource.byId === 'object'
          ? { ...usersSource.byId }
          : { ...fallback[USERS_TABLE_NAME].byId },
        ids: Array.isArray(usersSource?.ids)
          ? usersSource.ids.map(id => String(id))
          : [...fallback[USERS_TABLE_NAME].ids]
      },
      [USER_RATES_TABLE_NAME]: {
        byId: ratesSource?.byId && typeof ratesSource.byId === 'object'
          ? { ...ratesSource.byId }
          : { ...fallback[USER_RATES_TABLE_NAME].byId },
        ids: Array.isArray(ratesSource?.ids)
          ? ratesSource.ids.map(id => String(id))
          : [...fallback[USER_RATES_TABLE_NAME].ids],
        idsByRelevantUserId: this.normalizeUserRatesIdsByRelevantUserId(ratesSource)
      },
      [USER_RATES_OUTBOX_TABLE_NAME]: {
        byId: outboxSource?.byId && typeof outboxSource.byId === 'object'
          ? { ...outboxSource.byId }
          : { ...fallback[USER_RATES_OUTBOX_TABLE_NAME].byId },
        ids: Array.isArray(outboxSource?.ids)
          ? outboxSource.ids.map(id => String(id))
          : [...fallback[USER_RATES_OUTBOX_TABLE_NAME].ids]
      },
      [USER_FILTER_PREFERENCES_TABLE_NAME]: {
        byId: filterPreferencesSource?.byId && typeof filterPreferencesSource.byId === 'object'
          ? { ...filterPreferencesSource.byId }
          : { ...fallback[USER_FILTER_PREFERENCES_TABLE_NAME].byId },
        ids: Array.isArray(filterPreferencesSource?.ids)
          ? filterPreferencesSource.ids.map(id => String(id))
          : [...fallback[USER_FILTER_PREFERENCES_TABLE_NAME].ids]
      },
      [CHATS_TABLE_NAME]: {
        byId: chatsSource?.byId && typeof chatsSource.byId === 'object'
          ? { ...chatsSource.byId }
          : { ...fallback[CHATS_TABLE_NAME].byId },
        ids: Array.isArray(chatsSource?.ids)
          ? chatsSource.ids.map(id => String(id))
          : [...fallback[CHATS_TABLE_NAME].ids]
      },
      [EVENTS_TABLE_NAME]: {
        byId: eventsSource?.byId && typeof eventsSource.byId === 'object'
          ? { ...eventsSource.byId }
          : { ...fallback[EVENTS_TABLE_NAME].byId },
        ids: Array.isArray(eventsSource?.ids)
          ? eventsSource.ids.map(id => String(id))
          : [...fallback[EVENTS_TABLE_NAME].ids]
      }
    };
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private normalizeActivityMembersById(
    value: unknown,
    fallback: DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId']
  ): DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeActivityResourcesById(
    value: unknown,
    fallback: DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId']
  ): DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeAssetsById(
    value: unknown,
    fallback: DemoMemorySchema[typeof ASSETS_TABLE_NAME]['byId']
  ): DemoMemorySchema[typeof ASSETS_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as DemoMemorySchema[typeof ASSETS_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeIdList(value: unknown, fallback: readonly string[]): string[] {
    return Array.isArray(value)
      ? value.map(id => String(id))
      : [...fallback];
  }

  private normalizeActivityMembersIdsByOwnerKey(
    source: Partial<DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined
  ): Record<string, string[]> {
    const normalizedById = this.normalizeActivityMembersById(source?.byId, {});
    const normalizedIds = this.normalizeIdList(source?.ids, []);
    const next: Record<string, string[]> = {};

    const rawIndex = source?.idsByOwnerKey;
    if (rawIndex && typeof rawIndex === 'object') {
      for (const [ownerKey, ids] of Object.entries(rawIndex)) {
        if (!Array.isArray(ids) || !ownerKey.trim()) {
          continue;
        }
        next[ownerKey] = ids
          .map(id => String(id))
          .filter(id => Boolean(normalizedById[id]));
      }
    }

    for (const id of normalizedIds) {
      const record = normalizedById[id];
      const ownerKey = typeof record?.ownerKey === 'string' ? record.ownerKey.trim() : '';
      if (!ownerKey) {
        continue;
      }
      const bucket = next[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      next[ownerKey] = bucket;
    }

    return next;
  }

  private normalizeActivityResourcesIdsByOwnerKey(
    source: Partial<DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]> | undefined
  ): Record<string, string[]> {
    const normalizedById = this.normalizeActivityResourcesById(source?.byId, {});
    const normalizedIds = this.normalizeIdList(source?.ids, []);
    const next: Record<string, string[]> = {};

    const rawIndex = source?.idsByOwnerKey;
    if (rawIndex && typeof rawIndex === 'object') {
      for (const [ownerKey, ids] of Object.entries(rawIndex)) {
        if (!Array.isArray(ids) || !ownerKey.trim()) {
          continue;
        }
        next[ownerKey] = ids
          .map(id => String(id))
          .filter(id => Boolean(normalizedById[id]));
      }
    }

    for (const id of normalizedIds) {
      const record = normalizedById[id];
      const ownerKey = typeof record?.ownerKey === 'string' ? record.ownerKey.trim() : '';
      if (!ownerKey) {
        continue;
      }
      const bucket = next[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      next[ownerKey] = bucket;
    }

    return next;
  }

  private normalizeAssetsIdsByOwnerUserId(
    source: Partial<DemoMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined
  ): Record<string, string[]> {
    const normalizedById = this.normalizeAssetsById(source?.byId, {});
    const normalizedIds = this.normalizeIdList(source?.ids, []);
    const next: Record<string, string[]> = {};

    const rawIndex = source?.idsByOwnerUserId;
    if (rawIndex && typeof rawIndex === 'object') {
      for (const [ownerUserId, ids] of Object.entries(rawIndex)) {
        if (!Array.isArray(ids) || !ownerUserId.trim()) {
          continue;
        }
        next[ownerUserId] = ids
          .map(id => String(id))
          .filter(id => Boolean(normalizedById[id]));
      }
    }

    for (const id of normalizedIds) {
      const record = normalizedById[id];
      const ownerUserId = typeof record?.ownerUserId === 'string' ? record.ownerUserId.trim() : '';
      if (!ownerUserId) {
        continue;
      }
      const bucket = next[ownerUserId] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      next[ownerUserId] = bucket;
    }

    return next;
  }

  private normalizeUserRatesIdsByRelevantUserId(
    source: Partial<DemoMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined
  ): Record<string, string[]> {
    const normalizedById = source?.byId && typeof source.byId === 'object'
      ? { ...source.byId }
      : {};
    const normalizedIds = this.normalizeIdList(source?.ids, []);
    const next: Record<string, string[]> = {};

    const rawIndex = source?.idsByRelevantUserId;
    if (rawIndex && typeof rawIndex === 'object') {
      for (const [userId, ids] of Object.entries(rawIndex)) {
        if (!Array.isArray(ids) || !userId.trim()) {
          continue;
        }
        next[userId] = ids
          .map(id => String(id))
          .filter(id => Boolean(normalizedById[id]));
      }
    }

    for (const id of normalizedIds) {
      const record = normalizedById[id];
      if (!record) {
        continue;
      }
      const relevantUserIds = new Set(
        [record.ownerUserId, record.fromUserId, record.toUserId]
          .map(value => typeof value === 'string' ? value.trim() : '')
          .filter(Boolean)
      );

      for (const userId of relevantUserIds) {
        const bucket = next[userId] ?? [];
        if (!bucket.includes(id)) {
          bucket.push(id);
        }
        next[userId] = bucket;
      }
    }

    for (const ids of Object.values(next)) {
      ids.sort((leftId, rightId) => {
        const left = normalizedById[leftId];
        const right = normalizedById[rightId];
        return this.userRateSortValue(right) - this.userRateSortValue(left);
      });
    }

    return next;
  }

  private userRateSortValue(record: { happenedAtIso?: string; updatedAtIso?: string; createdAtIso?: string } | null | undefined): number {
    const value = record?.happenedAtIso ?? record?.updatedAtIso ?? record?.createdAtIso ?? '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private userRateDistanceValue(record: { distanceKm?: number; distanceMetersExact?: number } | null | undefined): number {
    if (Number.isFinite(record?.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(record?.distanceMetersExact)));
    }
    return Number.isFinite(record?.distanceKm)
      ? Math.max(0, Math.round(Number(record?.distanceKm) * 1000))
      : 0;
  }

  private userRateRelevanceScore(record: UserRateRecord | null | undefined): number {
    const scoreGiven = Number.isFinite(record?.scoreGiven)
      ? Math.max(0, Math.round(Number(record?.scoreGiven)))
      : (Number.isFinite(record?.rate) ? Math.max(0, Math.round(Number(record?.rate))) : 0);
    const scoreReceived = Number.isFinite(record?.scoreReceived)
      ? Math.max(0, Math.round(Number(record?.scoreReceived)))
      : 0;

    if (record?.displayDirection === 'mutual') {
      return scoreGiven + scoreReceived;
    }

    return scoreGiven > 0 ? scoreGiven : 5;
  }
}
