import { Injectable, signal } from '@angular/core';

import type {
  ActivityRateRecordQuery,
  ActivityRateRecordQueryResult,
  UserRateOutboxRecord,
  UserRateRecord
} from '../interfaces/game.interface';
import { ASSETS_TABLE_NAME } from '../../demo/models/assets.model';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../demo/models/activity-members.model';
import { ACTIVITY_RESOURCES_TABLE_NAME } from '../../demo/models/activity-resources.model';
import { CHATS_TABLE_NAME } from '../../demo/models/chats.model';
import { EVENT_FEEDBACK_TABLE_NAME } from '../../demo/models/event-feedback.model';
import { EVENTS_TABLE_NAME } from '../../demo/models/events.model';
import { HELP_CENTER_TABLE_NAME } from '../../demo/models/help-center.model';
import { IDEA_POSTS_TABLE_NAME } from '../../demo/models/idea-posts.model';
import { PROFILE_EXPERIENCES_TABLE_NAME } from '../../demo/models/profile-experiences.model';
import { SHARE_TOKENS_TABLE_NAME } from '../../demo/models/share-tokens.model';
import type { DemoMemorySchema } from '../../demo/models/memory.model';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME
} from '../../demo/models/users.model';
import {
  type AppStorageScope,
  APP_STORAGE_SCOPE,
  APP_SCOPED_INDEXED_DB_VERSION,
  APP_TABLES_STORE,
  appScopedIndexedDbName,
  createAppScopedObjectStores,
  scopedStorageKey
} from '../storage-scope';

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
    PROFILE_EXPERIENCES_TABLE_NAME,
    SHARE_TOKENS_TABLE_NAME,
    EVENTS_TABLE_NAME
  ] as const;
  private readonly _tables = signal<DemoMemorySchema>(this.loadInitialState());
  private pendingPersistState: DemoMemorySchema | null = null;
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;
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

  read(): DemoMemorySchema {
    return this._tables();
  }

  async whenReady(): Promise<void> {
    try {
      await this.hydrationReady;
    } catch {
      // Keep callers unblocked if IndexedDB hydration fails.
    }
  }

  write(updater: (current: DemoMemorySchema) => DemoMemorySchema): void {
    const next = this.normalizeState(updater(this._tables()));
    this._tables.set(next);
    if (!this.hydrationComplete || !this.storageEnabled) {
      return;
    }
    this.schedulePersist(next);
  }

  async flushToIndexedDb(): Promise<void> {
    await this.whenReady();
    if (!this.storageEnabled) {
      return;
    }
    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
      this.persistTimerId = null;
    }
    const pendingState = this.pendingPersistState ?? this._tables();
    this.pendingPersistState = null;
    this.persist(pendingState);
    await this.persistToIndexedDb(pendingState);
  }

  async readIndexedDbTableEntry<T = unknown>(key: string): Promise<T | null> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return null;
    }
    const db = await this.openIndexedDb();
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
    const db = await this.openIndexedDb();
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      tx.objectStore(APP_TABLES_STORE).put(this.indexedDbEntryForPersistence(normalizedKey, value), normalizedKey);
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

  private loadInitialState(): DemoMemorySchema {
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

  private persist(state: DemoMemorySchema): void {
    if (!this.canUseStorage()) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stateForLocalStoragePersistence(state)));
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

  private mergeHydratedStateWithCurrent(incoming: DemoMemorySchema, current: DemoMemorySchema): DemoMemorySchema {
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

  private async readFromIndexedDb(): Promise<DemoMemorySchema | null> {
    const primaryDb = await this.openIndexedDb();
    if (primaryDb) {
      const primarySnapshot = await this.readStateFromIndexedDb(primaryDb);
      if (primarySnapshot) {
        return primarySnapshot;
      }
    }
    return null;
  }

  private async readStateFromIndexedDb(db: IDBDatabase): Promise<DemoMemorySchema | null> {
    const outbox = await this.readIndexedDbEntry(db, USER_RATES_OUTBOX_TABLE_NAME);
    if (outbox === null) {
      return null;
    }

    const partialState: Partial<DemoMemorySchema> = {};
    partialState[USER_RATES_OUTBOX_TABLE_NAME] = outbox as DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME];
    return this.normalizeState(partialState, this.createEmptyState());
  }

  private async persistToIndexedDb(state: DemoMemorySchema): Promise<void> {
    const db = await this.openIndexedDb();
    if (!db) {
      return;
    }
    const persistedState = this.stateForIndexedDbPersistence(state);
    await new Promise<void>(resolve => {
      const tx = db.transaction(APP_TABLES_STORE, 'readwrite');
      const tablesStore = tx.objectStore(APP_TABLES_STORE);
      for (const key of AppMemoryDb.SCHEMA_TABLE_KEYS) {
        if (key !== USER_RATES_OUTBOX_TABLE_NAME) {
          tablesStore.delete(key);
        }
      }
      tablesStore.put(persistedState[USER_RATES_OUTBOX_TABLE_NAME], USER_RATES_OUTBOX_TABLE_NAME);

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private indexedDbEntryForPersistence(key: string, value: unknown): unknown {
    return key === EVENTS_TABLE_NAME
      ? this.eventsTableForPersistence(value as DemoMemorySchema[typeof EVENTS_TABLE_NAME])
      : value;
  }

  private stateForIndexedDbPersistence(state: DemoMemorySchema): DemoMemorySchema {
    return {
      ...this.createEmptyState(),
      [USER_RATES_OUTBOX_TABLE_NAME]: state[USER_RATES_OUTBOX_TABLE_NAME]
    };
  }

  private stateForLocalStoragePersistence(state: DemoMemorySchema): Partial<DemoMemorySchema> {
    return {
      [USER_RATES_OUTBOX_TABLE_NAME]: state[USER_RATES_OUTBOX_TABLE_NAME]
    };
  }

  private eventsTableForPersistence(
    table: DemoMemorySchema[typeof EVENTS_TABLE_NAME]
  ): DemoMemorySchema[typeof EVENTS_TABLE_NAME] {
    const byId: DemoMemorySchema[typeof EVENTS_TABLE_NAME]['byId'] = {};
    for (const [id, record] of Object.entries(table?.byId ?? {})) {
      const next = { ...(record as unknown as Record<string, unknown>) };
      delete next['acceptedMemberUserIds'];
      delete next['pendingMemberUserIds'];
      byId[id] = next as unknown as DemoMemorySchema[typeof EVENTS_TABLE_NAME]['byId'][string];
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

  private openIndexedDb(): Promise<IDBDatabase | null> {
    if (!this.storageEnabled || typeof indexedDB === 'undefined') {
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

  private normalizeState(value: unknown, fallback = this.createEmptyState()): DemoMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<DemoMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const assetsSource = source[ASSETS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined;
    const activityMembersSource = source[ACTIVITY_MEMBERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined;
    const activityResourcesSource = source[ACTIVITY_RESOURCES_TABLE_NAME] as Partial<DemoMemorySchema[typeof ACTIVITY_RESOURCES_TABLE_NAME]> | undefined;
    const ratesSource = source[USER_RATES_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined;
    const outboxSource = source[USER_RATES_OUTBOX_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]> | undefined;
    const filterPreferencesSource = source[USER_FILTER_PREFERENCES_TABLE_NAME] as Partial<DemoMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME]> | undefined;
    const chatsSource = source[CHATS_TABLE_NAME] as Partial<DemoMemorySchema[typeof CHATS_TABLE_NAME]> | undefined;
    const eventFeedbackSource = source[EVENT_FEEDBACK_TABLE_NAME] as Partial<DemoMemorySchema[typeof EVENT_FEEDBACK_TABLE_NAME]> | undefined;
    const helpCenterSource = source[HELP_CENTER_TABLE_NAME] as Partial<DemoMemorySchema[typeof HELP_CENTER_TABLE_NAME]> | undefined;
    const ideaPostsSource = source[IDEA_POSTS_TABLE_NAME] as Partial<DemoMemorySchema[typeof IDEA_POSTS_TABLE_NAME]> | undefined;
    const profileExperiencesSource = source[PROFILE_EXPERIENCES_TABLE_NAME] as Partial<DemoMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]> | undefined;
    const shareTokensSource = source[SHARE_TOKENS_TABLE_NAME] as Partial<DemoMemorySchema[typeof SHARE_TOKENS_TABLE_NAME]> | undefined;
    const eventsSource = source[EVENTS_TABLE_NAME] as Partial<DemoMemorySchema[typeof EVENTS_TABLE_NAME]> | undefined;
    const userRatesOutboxById = this.normalizeUserRatesOutboxById(
      outboxSource?.byId,
      fallback[USER_RATES_OUTBOX_TABLE_NAME].byId
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
    return scopedStorageKey('memory.db.v1', this.storageScope);
  }

  private get indexedDbName(): string {
    return appScopedIndexedDbName(this.storageScope);
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

  private normalizeUserRatesById(
    value: unknown,
    fallback: DemoMemorySchema[typeof USER_RATES_TABLE_NAME]['byId']
  ): DemoMemorySchema[typeof USER_RATES_TABLE_NAME]['byId'] {
    const source = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : fallback as Record<string, unknown>;
    const next: DemoMemorySchema[typeof USER_RATES_TABLE_NAME]['byId'] = {};
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
    fallback: DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId']
  ): DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId'] {
    const source = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : fallback as Record<string, unknown>;
    const next: DemoMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]['byId'] = {};
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
    fallback: DemoMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId']
  ): DemoMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'] {
    if (!value || typeof value !== 'object') {
      return { ...fallback };
    }

    const next: DemoMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'] = {};
    for (const [userId, entries] of Object.entries(value as Record<string, unknown>)) {
      if (!userId.trim() || !Array.isArray(entries)) {
        continue;
      }
      next[userId] = entries
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map(entry => ({
          id: `${entry['id'] ?? ''}`.trim(),
          type: `${entry['type'] ?? 'Workspace'}`.trim() as DemoMemorySchema[typeof PROFILE_EXPERIENCES_TABLE_NAME]['byUserId'][string][number]['type'],
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
export class DemoMemoryDb extends AppMemoryDb {
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
