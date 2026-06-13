import { CHATS_TABLE_NAME } from '../../local/source/entity/chat.entity';
import { EVENT_FEEDBACK_TABLE_NAME, EVENTS_TABLE_NAME } from '../../local/source/entity/event.entity';
import { HELP_CENTER_TABLE_NAME, IDEA_POSTS_TABLE_NAME } from '../../local/source/entity/content.entity';
import { CONTACTS_TABLE_NAME, PROFILE_EXPERIENCES_TABLE_NAME } from '../../local/source/entity/profile.entity';
import { SHARE_TOKENS_TABLE_NAME } from '../../local/source/entity/sharing.entity';
import { USER_FILTER_PREFERENCES_TABLE_NAME, USER_RATES_TABLE_NAME, USER_RATES_OUTBOX_TABLE_NAME } from '../../local/source/entity/rate.entity';
import { USERS_TABLE_NAME } from '../../local/source/entity/user.entity';
import { ASSETS_TABLE_NAME } from '../../local/source/entity/asset.entity';
import { ACTIVITY_MEMBERS_TABLE_NAME, ACTIVITY_RESOURCES_TABLE_NAME } from '../../local/source/entity/activity.entity';
import type { AppMemorySchema } from '../../local/common/memory.schema';
import { Injectable, signal } from '@angular/core';

import type { ActivityRateRecordQuery, ActivityRateRecordQueryResult, UserRateOutboxRecord, UserRateRecord } from '../../contracts/activity.interface';
import type { ContactMethodDraft, ContactMethodType, StoredContact } from '../../contracts/contact.interface';
import { type AppStorageScope, APP_STORAGE_SCOPE, APP_SCOPED_INDEXED_DB_VERSION, APP_I18N_BUNDLES_STORE, APP_TABLES_STORE, appMemoryDbStorageKey, appScopedIndexedDbName, createAppScopedObjectStores, removeScopedStorageEntries } from '../../common/storage-scope';

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
  private static readonly SCHEMA_TABLE_KEYS = [
    USERS_TABLE_NAME,
    ASSETS_TABLE_NAME,
    ACTIVITY_MEMBERS_TABLE_NAME,
    ACTIVITY_RESOURCES_TABLE_NAME,
    USER_RATES_TABLE_NAME,
    USER_RATES_OUTBOX_TABLE_NAME,
    USER_FILTER_PREFERENCES_TABLE_NAME,
    CHATS_TABLE_NAME,
    EVENT_FEEDBACK_TABLE_NAME,
    HELP_CENTER_TABLE_NAME,
    IDEA_POSTS_TABLE_NAME,
    CONTACTS_TABLE_NAME,
    PROFILE_EXPERIENCES_TABLE_NAME,
    SHARE_TOKENS_TABLE_NAME,
    EVENTS_TABLE_NAME
  ] as const;
  private readonly _tables = signal<AppMemorySchema>(this.loadInitialState());
  private pendingPersistState: AppMemorySchema | null = null;
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;
  private resetStoragePromise: Promise<void> | null = null;
  private storageResetComplete = false;
  private hydrationComplete = false;
  private readonly hydrationReady: Promise<void>;

  protected get storageScope(): AppStorageScope {
    return APP_STORAGE_SCOPE;
  }

  protected get storageEnabled(): boolean {
    return this.storageScope === APP_STORAGE_SCOPE;
  }

  readonly tables = this._tables.asReadonly();

  constructor() {
    this.hydrationReady = this.storageEnabled
      ? this.hydrateFromIndexedDb()
      : this.completeInactiveHydration();
  }

  read(): AppMemorySchema {
    return this._tables();
  }

  async whenReady(): Promise<void> {
    try {
      await this.hydrationReady;
    } catch {
      // Keep callers unblocked if IndexedDB hydration fails.
    }
  }

  write(updater: (current: AppMemorySchema) => AppMemorySchema): void {
    const next = this.normalizeState(updater(this._tables()));
    this._tables.set(next);
    if (!this.hydrationComplete || !this.storageEnabled) {
      return;
    }
    this.schedulePersist(next);
  }

  async flushToIndexedDb(): Promise<void> {
    await this.whenReady();
    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
      this.persistTimerId = null;
    }
    const pendingState = this.pendingPersistState ?? this._tables();
    this.pendingPersistState = null;
    if (this.storageEnabled) {
      this.persist(pendingState);
    }
    await this.persistToIndexedDb(pendingState, true);
  }

  async resetStorage(): Promise<void> {
    await this.resetStoragePreservingTables([]);
  }

  async resetStoragePreservingTables(preservedTableNames: readonly string[]): Promise<void> {
    await this.whenReady();
    const preservedTableNameSet = new Set(preservedTableNames.map(tableName => tableName.trim()).filter(Boolean));
    const fullReset = preservedTableNameSet.size === 0;
    const currentState = this._tables();
    const nextState = this.createEmptyState();
    for (const tableName of AppMemoryDb.SCHEMA_TABLE_KEYS) {
      if (preservedTableNameSet.has(tableName)) {
        (nextState as Record<string, unknown>)[tableName] = (currentState as Record<string, unknown>)[tableName];
      }
    }

    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
      this.persistTimerId = null;
    }
    this.pendingPersistState = null;
    this._tables.set(nextState);

    if (typeof localStorage !== 'undefined') {
      try {
        if (fullReset) {
          removeScopedStorageEntries(localStorage, this.storageScope);
        } else {
          localStorage.removeItem(this.storageKey);
        }
      } catch {
        // A blocked localStorage should not break demo bootstrap.
      }
    }
    if (fullReset && typeof sessionStorage !== 'undefined') {
      try {
        removeScopedStorageEntries(sessionStorage, this.storageScope);
      } catch {
        // A blocked sessionStorage should not break demo bootstrap.
      }
    }

    const db = await this.openIndexedDb(true);
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      tx.objectStore(APP_TABLES_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    if (fullReset && db.objectStoreNames.contains(APP_I18N_BUNDLES_STORE)) {
      await new Promise<void>(resolve => {
        const tx = db.transaction(APP_I18N_BUNDLES_STORE, 'readwrite');
        tx.objectStore(APP_I18N_BUNDLES_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    }
  }

  async resetStorageOnce(): Promise<void> {
    if (this.storageResetComplete) {
      return;
    }
    if (!this.resetStoragePromise) {
      this.resetStoragePromise = this.resetStorage()
        .finally(() => {
          this.storageResetComplete = true;
          this.resetStoragePromise = null;
        });
    }
    await this.resetStoragePromise;
  }

  async readIndexedDbTableEntry<T = unknown>(key: string): Promise<T | null> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return null;
    }
    const db = await this.openIndexedDb(true);
    if (!db) {
      return null;
    }
    return await this.readIndexedDbEntry(db, normalizedKey) as T | null;
  }

  async writeIndexedDbTableEntry(key: string, value: unknown): Promise<void> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }
    const db = await this.openIndexedDb(true);
    if (!db) {
      return;
    }
    await this.putIndexedDbEntry(db, normalizedKey, this.indexedDbEntryForPersistence(normalizedKey, value));
  }

  async deleteIndexedDbTableEntry(key: string): Promise<void> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }
    const db = await this.openIndexedDb(true);
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      tx.objectStore(APP_TABLES_STORE).delete(normalizedKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  async queryActivityRateRecords(query: ActivityRateRecordQuery): Promise<ActivityRateRecordQueryResult> {
    const normalizedQuery = this.normalizeActivityRateRecordQuery(query);
    if (!normalizedQuery) {
      return {
        records: [],
        total: 0
      };
    }
    return this.queryActivityRateRecordsFromMemory(normalizedQuery);
  }

  private createEmptyState(): AppMemorySchema {
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
      [EVENT_FEEDBACK_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [HELP_CENTER_TABLE_NAME]: {
        seeded: false,
        activeRevisionId: null,
        seededKinds: {},
        activeRevisionIdsByKind: {},
        revisionsById: {},
        revisionIds: [],
        auditById: {},
        auditIds: [],
        privacyConsentsById: {},
        privacyConsentIds: []
      },
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: false,
        byId: {},
        ids: []
      },
      [CONTACTS_TABLE_NAME]: {
        byOwnerUserId: {},
        ownerUserIds: []
      },
      [PROFILE_EXPERIENCES_TABLE_NAME]: {
        byUserId: {},
        userIds: []
      },
      [SHARE_TOKENS_TABLE_NAME]: {
        byToken: {},
        tokens: []
      },
      [EVENTS_TABLE_NAME]: {
        byId: {},
        ids: []
      }
    };
  }

  private loadInitialState(): AppMemorySchema {
    const fallback = this.createEmptyState();
    if (!this.canUseStorage()) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeState(parsed, fallback);
    } catch {
      return fallback;
    }
  }

  private persist(state: AppMemorySchema): void {
    if (!this.canUseStorage()) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stateForLocalStoragePersistence(state)));
    } catch {
      // Ignore quota/private-mode write failures in demo mode.
    }
  }

  private schedulePersist(state: AppMemorySchema): void {
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

  private async completeInactiveHydration(): Promise<void> {
    this.hydrationComplete = true;
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    try {
      const snapshot = await this.readFromIndexedDb();
      if (!snapshot) {
        return;
      }
      const normalized = this.mergeHydratedStateWithCurrent(this.normalizeState(snapshot), this._tables());
      const current = this._tables();
      const currentHasUsers = current[USERS_TABLE_NAME].ids.length > 0;
      const incomingHasUsers = normalized[USERS_TABLE_NAME].ids.length > 0;
      if (currentHasUsers && !incomingHasUsers) {
        return;
      }
      this._tables.set(normalized);
    } finally {
      if (this.persistTimerId !== null) {
        clearTimeout(this.persistTimerId);
        this.persistTimerId = null;
      }
      this.pendingPersistState = null;
      this.hydrationComplete = true;
    }
  }

  private mergeHydratedStateWithCurrent(incoming: AppMemorySchema, current: AppMemorySchema): AppMemorySchema {
    const currentHelpCenter = current[HELP_CENTER_TABLE_NAME];
    const incomingHelpCenter = incoming[HELP_CENTER_TABLE_NAME];
    const currentPrivacyConsentsById = currentHelpCenter.privacyConsentsById ?? {};
    const incomingPrivacyConsentsById = incomingHelpCenter.privacyConsentsById ?? {};
    const mergedPrivacyConsentsById = {
      ...currentPrivacyConsentsById,
      ...incomingPrivacyConsentsById
    };
    const mergedPrivacyConsentIds = [
      ...(currentHelpCenter.privacyConsentIds ?? []),
      ...(incomingHelpCenter.privacyConsentIds ?? [])
    ];
    return {
      ...incoming,
      [HELP_CENTER_TABLE_NAME]: {
        ...incomingHelpCenter,
        privacyConsentsById: mergedPrivacyConsentsById,
        privacyConsentIds: [...new Set([
          ...mergedPrivacyConsentIds,
          ...Object.keys(mergedPrivacyConsentsById)
        ])]
      }
    };
  }

  private async readFromIndexedDb(): Promise<AppMemorySchema | null> {
    const primaryDb = await this.openIndexedDb();
    if (primaryDb) {
      const primarySnapshot = await this.readStateFromIndexedDb(primaryDb);
      if (primarySnapshot) {
        return primarySnapshot;
      }
    }
    return null;
  }

  private async readStateFromIndexedDb(db: IDBDatabase): Promise<AppMemorySchema | null> {
    const partialState: Record<string, unknown> = {};
    let hasStoredTable = false;
    await Promise.all(AppMemoryDb.SCHEMA_TABLE_KEYS.map(async key => {
      const entry = await this.readIndexedDbEntry(db, key);
      if (entry === null) {
        return;
      }
      partialState[key] = entry;
      hasStoredTable = true;
    }));

    if (!hasStoredTable) {
      return null;
    }

    return this.normalizeState(partialState, this.createEmptyState());
  }

  private async persistToIndexedDb(state: AppMemorySchema, force = false): Promise<void> {
    const db = await this.openIndexedDb(force);
    if (!db) {
      return;
    }
    const persistedState = this.stateForIndexedDbPersistence(state);
    await Promise.all(AppMemoryDb.SCHEMA_TABLE_KEYS.map(key => {
      const value = this.indexedDbEntryForPersistence(key, persistedState[key]);
      return this.shouldPersistIndexedDbTable(key, value)
        ? this.putIndexedDbEntry(db, key, value)
        : this.deleteIndexedDbEntry(db, key);
    }));
  }

  private indexedDbEntryForPersistence(key: string, value: unknown): unknown {
    const entry = key === EVENTS_TABLE_NAME
      ? this.eventsTableForPersistence(value as AppMemorySchema[typeof EVENTS_TABLE_NAME])
      : value;
    return this.indexedDbPlainValue(entry);
  }

  private indexedDbPlainValue(value: unknown): unknown {
    return this.toIndexedDbPlainValue(value, new WeakSet<object>());
  }

  private shouldPersistIndexedDbTable(key: string, value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const table = value as Record<string, unknown>;
    if (key === HELP_CENTER_TABLE_NAME) {
      return Boolean(
        `${table['activeRevisionId'] ?? ''}`.trim()
        || this.hasEntries(table['revisionIds'])
        || this.hasEntries(table['auditIds'])
        || this.hasEntries(table['privacyConsentIds'])
      );
    }
    if (key === CONTACTS_TABLE_NAME) {
      return this.hasEntries(table['ownerUserIds']);
    }
    if (key === PROFILE_EXPERIENCES_TABLE_NAME) {
      return this.hasEntries(table['userIds']);
    }
    if (key === SHARE_TOKENS_TABLE_NAME) {
      return this.hasEntries(table['tokens']);
    }
    if ('ids' in table) {
      return this.hasEntries(table['ids']);
    }
    return Object.keys(table).length > 0;
  }

  private hasEntries(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  private toIndexedDbPlainValue(value: unknown, seen: WeakSet<object>): unknown {
    if (
      value === null
      || typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
    ) {
      return value;
    }
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      return null;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(item => this.toIndexedDbPlainValue(item, seen));
    }
    if (typeof value !== 'object') {
      return null;
    }
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol') {
        continue;
      }
      next[key] = this.toIndexedDbPlainValue(entry, seen);
    }
    seen.delete(value);
    return next;
  }

  private stateForIndexedDbPersistence(state: AppMemorySchema): AppMemorySchema {
    return state;
  }

  private stateForLocalStoragePersistence(state: AppMemorySchema): Partial<AppMemorySchema> {
    return {
      [USER_RATES_OUTBOX_TABLE_NAME]: state[USER_RATES_OUTBOX_TABLE_NAME]
    };
  }

  private eventsTableForPersistence(
    table: AppMemorySchema[typeof EVENTS_TABLE_NAME]
  ): AppMemorySchema[typeof EVENTS_TABLE_NAME] {
    const byId: AppMemorySchema[typeof EVENTS_TABLE_NAME]['byId'] = {};
    for (const [id, record] of Object.entries(table?.byId ?? {})) {
      const next = { ...(record as unknown as Record<string, unknown>) };
      delete next['acceptedMemberUserIds'];
      delete next['pendingMemberUserIds'];
      byId[id] = next as unknown as AppMemorySchema[typeof EVENTS_TABLE_NAME]['byId'][string];
    }
    return {
      byId,
      ids: Array.isArray(table?.ids) ? [...table.ids] : []
    };
  }

  private readIndexedDbEntry(db: IDBDatabase, key: string): Promise<unknown | null> {
    return new Promise<unknown | null>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readonly');
      const store = tx.objectStore(APP_TABLES_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  private putIndexedDbEntry(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      tx.objectStore(APP_TABLES_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private deleteIndexedDbEntry(db: IDBDatabase, key: string): Promise<void> {
    return new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      tx.objectStore(APP_TABLES_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private openIndexedDb(force = false): Promise<IDBDatabase | null> {
    if ((!force && !this.storageEnabled) || typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise<IDBDatabase | null>(resolve => {
      const request = indexedDB.open(this.indexedDbName, APP_SCOPED_INDEXED_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        createAppScopedObjectStores(db);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  private queryActivityRateRecordsFromMemory(query: NormalizedActivityRateRecordQuery): ActivityRateRecordQueryResult {
    const ratesTable = this._tables()[USER_RATES_TABLE_NAME];
    const filtered = ratesTable.ids
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
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

  private normalizeState(value: unknown, fallback = this.createEmptyState()): AppMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<AppMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<AppMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const assetsSource = source[ASSETS_TABLE_NAME] as Partial<AppMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined;
    const activityMembersSource = source[ACTIVITY_MEMBERS_TABLE_NAME] as Partial<AppMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined;
    const activityResourcesSource = source[ACTIVITY_RESOURCES_TABLE_NAME] as Partial<AppMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]> | undefined;
    const ratesSource = source[USER_RATES_TABLE_NAME] as Partial<AppMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined;
    const outboxSource = source[USER_RATES_OUTBOX_TABLE_NAME] as Partial<AppMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]> | undefined;
    const filterPreferencesSource = source[USER_FILTER_PREFERENCES_TABLE_NAME] as Partial<AppMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME]> | undefined;
    const chatsSource = source[CHATS_TABLE_NAME] as Partial<AppMemorySchema[typeof CHATS_TABLE_NAME]> | undefined;
    const eventFeedbackSource = source[EVENT_FEEDBACK_TABLE_NAME] as Partial<AppMemorySchema[typeof EVENT_FEEDBACK_TABLE_NAME]> | undefined;
    const helpCenterSource = source[HELP_CENTER_TABLE_NAME] as Partial<AppMemorySchema[typeof HELP_CENTER_TABLE_NAME]> | undefined;
    const ideaPostsSource = source[IDEA_POSTS_TABLE_NAME] as Partial<AppMemorySchema[typeof IDEA_POSTS_TABLE_NAME]> | undefined;
    const contactsSource = source[CONTACTS_TABLE_NAME] as Partial<AppMemorySchema[typeof CONTACTS_TABLE_NAME]> | undefined;
    const profileExperiencesSource = source[PROFILE_EXPERIENCES_TABLE_NAME] as Partial<AppMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]> | undefined;
    const shareTokensSource = source[SHARE_TOKENS_TABLE_NAME] as Partial<AppMemorySchema[typeof SHARE_TOKENS_TABLE_NAME]> | undefined;
    const eventsSource = source[EVENTS_TABLE_NAME] as Partial<AppMemorySchema[typeof EVENTS_TABLE_NAME]> | undefined;
    const userRatesOutboxById = this.normalizeUserRatesOutboxById(
      outboxSource?.byId,
      fallback[USER_RATES_OUTBOX_TABLE_NAME].byId
    );
    const contactsByOwnerUserId = this.normalizeContactsByOwnerUserId(
      contactsSource?.byOwnerUserId,
      fallback[CONTACTS_TABLE_NAME].byOwnerUserId
    );
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
        byId: this.normalizeUserRatesById(ratesSource?.byId, fallback[USER_RATES_TABLE_NAME].byId),
        ids: Array.isArray(ratesSource?.ids)
          ? ratesSource.ids.map(id => String(id))
          : [...fallback[USER_RATES_TABLE_NAME].ids],
        idsByRelevantUserId: this.normalizeUserRatesIdsByRelevantUserId(ratesSource)
      },
      [USER_RATES_OUTBOX_TABLE_NAME]: {
        byId: userRatesOutboxById,
        ids: Array.isArray(outboxSource?.ids)
          ? outboxSource.ids.map(id => String(id)).filter(id => Boolean(userRatesOutboxById[id]))
          : fallback[USER_RATES_OUTBOX_TABLE_NAME].ids.filter(id => Boolean(userRatesOutboxById[id]))
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
      [EVENT_FEEDBACK_TABLE_NAME]: {
        byId: eventFeedbackSource?.byId && typeof eventFeedbackSource.byId === 'object'
          ? { ...eventFeedbackSource.byId }
          : { ...fallback[EVENT_FEEDBACK_TABLE_NAME].byId },
        ids: Array.isArray(eventFeedbackSource?.ids)
          ? eventFeedbackSource.ids.map(id => String(id))
          : [...fallback[EVENT_FEEDBACK_TABLE_NAME].ids]
      },
      [HELP_CENTER_TABLE_NAME]: {
        seeded: helpCenterSource?.seeded === true || fallback[HELP_CENTER_TABLE_NAME].seeded === true,
        activeRevisionId: typeof helpCenterSource?.activeRevisionId === 'string'
          ? helpCenterSource.activeRevisionId
          : fallback[HELP_CENTER_TABLE_NAME].activeRevisionId,
        seededKinds: helpCenterSource?.seededKinds && typeof helpCenterSource.seededKinds === 'object'
          ? { ...helpCenterSource.seededKinds }
          : { ...(fallback[HELP_CENTER_TABLE_NAME].seededKinds ?? {}) },
        activeRevisionIdsByKind: helpCenterSource?.activeRevisionIdsByKind && typeof helpCenterSource.activeRevisionIdsByKind === 'object'
          ? { ...helpCenterSource.activeRevisionIdsByKind }
          : { ...(fallback[HELP_CENTER_TABLE_NAME].activeRevisionIdsByKind ?? {}) },
        revisionsById: helpCenterSource?.revisionsById && typeof helpCenterSource.revisionsById === 'object'
          ? { ...helpCenterSource.revisionsById }
          : { ...fallback[HELP_CENTER_TABLE_NAME].revisionsById },
        revisionIds: Array.isArray(helpCenterSource?.revisionIds)
          ? helpCenterSource.revisionIds.map(id => String(id))
          : [...fallback[HELP_CENTER_TABLE_NAME].revisionIds],
        auditById: helpCenterSource?.auditById && typeof helpCenterSource.auditById === 'object'
          ? { ...helpCenterSource.auditById }
          : { ...fallback[HELP_CENTER_TABLE_NAME].auditById },
        auditIds: Array.isArray(helpCenterSource?.auditIds)
          ? helpCenterSource.auditIds.map(id => String(id))
          : [...fallback[HELP_CENTER_TABLE_NAME].auditIds],
        privacyConsentsById: helpCenterSource?.privacyConsentsById && typeof helpCenterSource.privacyConsentsById === 'object'
          ? { ...helpCenterSource.privacyConsentsById }
          : { ...(fallback[HELP_CENTER_TABLE_NAME].privacyConsentsById ?? {}) },
        privacyConsentIds: Array.isArray(helpCenterSource?.privacyConsentIds)
          ? helpCenterSource.privacyConsentIds.map(id => String(id))
          : [...(fallback[HELP_CENTER_TABLE_NAME].privacyConsentIds ?? [])]
      },
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: ideaPostsSource?.seeded === true || fallback[IDEA_POSTS_TABLE_NAME].seeded === true,
        byId: ideaPostsSource?.byId && typeof ideaPostsSource.byId === 'object'
          ? { ...ideaPostsSource.byId }
          : { ...fallback[IDEA_POSTS_TABLE_NAME].byId },
        ids: Array.isArray(ideaPostsSource?.ids)
          ? ideaPostsSource.ids.map(id => String(id))
          : [...fallback[IDEA_POSTS_TABLE_NAME].ids]
      },
      [CONTACTS_TABLE_NAME]: {
        byOwnerUserId: contactsByOwnerUserId,
        ownerUserIds: Object.keys(contactsByOwnerUserId)
      },
      [PROFILE_EXPERIENCES_TABLE_NAME]: {
        byUserId: this.normalizeProfileExperiencesByUserId(profileExperiencesSource?.byUserId, fallback[PROFILE_EXPERIENCES_TABLE_NAME].byUserId),
        userIds: Array.isArray(profileExperiencesSource?.userIds)
          ? profileExperiencesSource.userIds.map(id => String(id))
          : [...fallback[PROFILE_EXPERIENCES_TABLE_NAME].userIds]
      },
      [SHARE_TOKENS_TABLE_NAME]: {
        byToken: shareTokensSource?.byToken && typeof shareTokensSource.byToken === 'object'
          ? { ...shareTokensSource.byToken }
          : { ...fallback[SHARE_TOKENS_TABLE_NAME].byToken },
        tokens: Array.isArray(shareTokensSource?.tokens)
          ? shareTokensSource.tokens.map(token => String(token))
          : [...fallback[SHARE_TOKENS_TABLE_NAME].tokens]
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
    return this.storageEnabled && typeof localStorage !== 'undefined';
  }

  private get storageKey(): string {
    return appMemoryDbStorageKey(this.storageScope);
  }

  private get indexedDbName(): string {
    return appScopedIndexedDbName(this.storageScope);
  }

  private normalizeActivityMembersById(
    value: unknown,
    fallback: AppMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId']
  ): AppMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as AppMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeActivityResourcesById(
    value: unknown,
    fallback: AppMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId']
  ): AppMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as AppMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeAssetsById(
    value: unknown,
    fallback: AppMemorySchema[typeof ASSETS_TABLE_NAME]['byId']
  ): AppMemorySchema[typeof ASSETS_TABLE_NAME]['byId'] {
    return value && typeof value === 'object'
      ? { ...(value as AppMemorySchema[typeof ASSETS_TABLE_NAME]['byId']) }
      : { ...fallback };
  }

  private normalizeUserRatesById(
    value: unknown,
    fallback: AppMemorySchema[typeof USER_RATES_TABLE_NAME]['byId']
  ): AppMemorySchema[typeof USER_RATES_TABLE_NAME]['byId'] {
    const source = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : fallback as Record<string, unknown>;
    const next: AppMemorySchema[typeof USER_RATES_TABLE_NAME]['byId'] = {};
    for (const [id, record] of Object.entries(source)) {
      const normalized = this.normalizeUserRateRecord(record);
      if (normalized) {
        next[id] = normalized;
      }
    }
    return next;
  }

  private normalizeUserRatesOutboxById(
    value: unknown,
    fallback: AppMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId']
  ): AppMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId'] {
    const source = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : fallback as Record<string, unknown>;
    const next: AppMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId'] = {};
    for (const [id, record] of Object.entries(source)) {
      if (!record || typeof record !== 'object') {
        continue;
      }
      const outboxRecord = record as UserRateOutboxRecord;
      const payload = this.normalizeUserRateRecord(outboxRecord.payload);
      if (!payload) {
        continue;
      }
      next[id] = {
        ...outboxRecord,
        payload
      };
    }
    return next;
  }

  private normalizeUserRateRecord(value: unknown): UserRateRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const source = value as Partial<UserRateRecord>;
    const normalized: UserRateRecord = {
      id: this.normalizeRateText(source.id),
      fromUserId: this.normalizeRateText(source.fromUserId),
      toUserId: this.normalizeRateText(source.toUserId),
      rate: this.normalizeRateNumber(source.rate),
      mode: source.mode === 'pair' ? 'pair' : 'single',
      createdAtIso: this.normalizeRateText(source.createdAtIso),
      updatedAtIso: this.normalizeRateText(source.updatedAtIso)
    };
    const ownerUserId = this.normalizeRateText(source.ownerUserId);
    if (ownerUserId) {
      normalized.ownerUserId = ownerUserId;
    }
    const displayId = this.normalizeRateText(source.displayId);
    if (displayId) {
      normalized.displayId = displayId;
    }
    if (
      source.displayDirection === 'given'
      || source.displayDirection === 'received'
      || source.displayDirection === 'mutual'
      || source.displayDirection === 'met'
    ) {
      normalized.displayDirection = source.displayDirection;
    }
    if (source.socialContext === 'separated-friends' || source.socialContext === 'friends-in-common') {
      normalized.socialContext = source.socialContext;
    }
    const bridgeUserId = this.normalizeRateText(source.bridgeUserId);
    if (bridgeUserId) {
      normalized.bridgeUserId = bridgeUserId;
    }
    if (Number.isFinite(Number(source.bridgeCount))) {
      normalized.bridgeCount = Math.max(0, Math.trunc(Number(source.bridgeCount)));
    }
    if (Number.isFinite(Number(source.scoreGiven))) {
      normalized.scoreGiven = this.normalizeRateNumber(source.scoreGiven);
    }
    if (Number.isFinite(Number(source.scoreReceived))) {
      normalized.scoreReceived = this.normalizeRateNumber(source.scoreReceived);
    }
    const eventName = this.normalizeRateText(source.eventName);
    if (eventName) {
      normalized.eventName = eventName;
    }
    const happenedAtIso = this.normalizeRateText(source.happenedAtIso);
    if (happenedAtIso) {
      normalized.happenedAtIso = happenedAtIso;
    }
    if (Number.isFinite(Number(source.distanceMetersExact))) {
      normalized.distanceMetersExact = Math.max(0, Math.trunc(Number(source.distanceMetersExact)));
    } else {
      normalized.distanceMetersExact = 0;
    }
    return normalized;
  }

  private normalizeRateText(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private normalizeRateNumber(value: unknown): number {
    if (!Number.isFinite(Number(value))) {
      return 0;
    }
    return Math.trunc(Number(value));
  }

  private normalizeProfileExperiencesByUserId(
    value: unknown,
    fallback: AppMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId']
  ): AppMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'] {
    if (!value || typeof value !== 'object') {
      return { ...fallback };
    }

    const next: AppMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'] = {};
    for (const [userId, entries] of Object.entries(value as Record<string, unknown>)) {
      if (!userId.trim() || !Array.isArray(entries)) {
        continue;
      }
      next[userId] = entries
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map(entry => ({
          id: `${entry['id'] ?? ''}`.trim(),
          type: `${entry['type'] ?? 'Workspace'}`.trim() as AppMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'][string][number]['type'],
          title: `${entry['title'] ?? ''}`.trim(),
          org: `${entry['org'] ?? ''}`.trim(),
          city: `${entry['city'] ?? ''}`.trim(),
          dateFrom: `${entry['dateFrom'] ?? ''}`.trim(),
          dateTo: `${entry['dateTo'] ?? ''}`.trim(),
          description: `${entry['description'] ?? ''}`.trim()
        }))
        .filter(entry => entry.id.length > 0);
    }
    return next;
  }

  private normalizeContactsByOwnerUserId(
    value: unknown,
    fallback: AppMemorySchema[typeof CONTACTS_TABLE_NAME]['byOwnerUserId']
  ): AppMemorySchema[typeof CONTACTS_TABLE_NAME]['byOwnerUserId'] {
    if (!value || typeof value !== 'object') {
      return { ...fallback };
    }

    const next: AppMemorySchema[typeof CONTACTS_TABLE_NAME]['byOwnerUserId'] = {};
    for (const [ownerUserId, contacts] of Object.entries(value as Record<string, unknown>)) {
      const normalizedOwnerUserId = ownerUserId.trim();
      if (!normalizedOwnerUserId || !Array.isArray(contacts)) {
        continue;
      }
      const normalizedContacts = contacts
        .filter((contact): contact is Record<string, unknown> => !!contact && typeof contact === 'object')
        .map(contact => this.normalizeContact(contact))
        .filter((contact): contact is StoredContact => Boolean(contact));
      if (normalizedContacts.length > 0) {
        next[normalizedOwnerUserId] = normalizedContacts;
      }
    }
    return next;
  }

  private normalizeContact(value: Record<string, unknown>): StoredContact | null {
    const id = `${value['id'] ?? ''}`.trim();
    const userId = `${value['userId'] ?? ''}`.trim();
    if (!id && !userId) {
      return null;
    }
    return {
      id: id || userId,
      userId,
      name: `${value['name'] ?? ''}`.trim() || 'Contact',
      initials: `${value['initials'] ?? ''}`.trim(),
      gender: value['gender'] === 'woman' ? 'woman' : 'man',
      city: `${value['city'] ?? ''}`.trim(),
      avatarUrl: `${value['avatarUrl'] ?? ''}`.trim(),
      headline: `${value['headline'] ?? ''}`.trim(),
      createdAtIso: `${value['createdAtIso'] ?? ''}`.trim(),
      updatedAtIso: `${value['updatedAtIso'] ?? ''}`.trim(),
      methods: (Array.isArray(value['methods']) ? value['methods'] : [])
        .filter((method): method is Record<string, unknown> => !!method && typeof method === 'object')
        .map(method => this.normalizeContactMethod(method))
        .filter((method): method is ContactMethodDraft => Boolean(method))
    };
  }

  private normalizeContactMethod(value: Record<string, unknown>): ContactMethodDraft | null {
    const type = `${value['type'] ?? ''}`.trim() as ContactMethodType;
    const methodType: ContactMethodType = [
      'phone',
      'sms',
      'whatsapp',
      'email',
      'facebook',
      'instagram',
      'telegram',
      'linkedin',
      'website'
    ].includes(type) ? type : 'phone';
    const methodValue = `${value['value'] ?? ''}`.trim();
    if (!methodValue) {
      return null;
    }
    return {
      id: `${value['id'] ?? ''}`.trim(),
      type: methodType,
      value: methodValue
    };
  }

  private normalizeIdList(value: unknown, fallback: readonly string[]): string[] {
    return Array.isArray(value)
      ? value.map(id => String(id))
      : [...fallback];
  }

  private normalizeActivityMembersIdsByOwnerKey(
    source: Partial<AppMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined
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
    source: Partial<AppMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]> | undefined
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
    source: Partial<AppMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined
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
    source: Partial<AppMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined
  ): Record<string, string[]> {
    const normalizedById = this.normalizeUserRatesById(source?.byId, {});
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

  private userRateDistanceValue(record: { distanceMetersExact?: number } | null | undefined): number {
    if (Number.isFinite(record?.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(record?.distanceMetersExact)));
    }
    return 0;
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

@Injectable({
  providedIn: 'root'
})
export class LocalMemoryDb extends AppMemoryDb {
  protected override get storageScope(): AppStorageScope {
    return 'demo';
  }
}

@Injectable({
  providedIn: 'root'
})
export class HttpMemoryDb extends AppMemoryDb {
  protected override get storageScope(): AppStorageScope {
    return 'http';
  }
}
