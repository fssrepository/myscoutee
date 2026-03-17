import { Injectable, signal } from '@angular/core';

import { ASSETS_TABLE_NAME } from '../../demo/models/assets.model';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../demo/models/activity-members.model';
import { CHATS_TABLE_NAME } from '../../demo/models/chats.model';
import { EVENTS_TABLE_NAME } from '../../demo/models/events.model';
import type { DemoMemorySchema } from '../../demo/models/memory.model';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME
} from '../../demo/models/users.model';

@Injectable({
  providedIn: 'root'
})
export class AppMemoryDb {
  private static readonly STORAGE_KEY = 'myscoutee.memory.db.v1';
  private static readonly LEGACY_STORAGE_KEYS = ['myscoutee.demo.db.v1'];
  private static readonly INDEXED_DB_NAME = 'myscoutee-memory-db';
  private static readonly LEGACY_INDEXED_DB_NAMES = ['myscoutee-demo-db'];
  private static readonly INDEXED_DB_VERSION = 1;
  private static readonly INDEXED_DB_STORE = 'tables';
  private static readonly LEGACY_INDEXED_DB_STATE_KEY = 'current';
  private readonly _tables = signal<DemoMemorySchema>(this.loadInitialState());

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
    this.persist(next);
    void this.persistToIndexedDb(next);
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
      [USERS_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [USER_RATES_TABLE_NAME]: {
        byId: {},
        ids: []
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

  private async hydrateFromIndexedDb(): Promise<void> {
    const snapshot = await this.readFromIndexedDb();
    if (!snapshot) {
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
    const rates = await this.readIndexedDbEntry(db, USER_RATES_TABLE_NAME);
    const outbox = await this.readIndexedDbEntry(db, USER_RATES_OUTBOX_TABLE_NAME);
    const filterPreferences = await this.readIndexedDbEntry(db, USER_FILTER_PREFERENCES_TABLE_NAME);
    const chats = await this.readIndexedDbEntry(db, CHATS_TABLE_NAME);
    const events = await this.readIndexedDbEntry(db, EVENTS_TABLE_NAME)
      ?? await this.readIndexedDbEntry(db, 'demoEvents');

    const hasSegmentedState = users !== null
      || activityMembers !== null
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
      const tx = db.transaction(AppMemoryDb.INDEXED_DB_STORE, 'readwrite');
      const store = tx.objectStore(AppMemoryDb.INDEXED_DB_STORE);
      store.put(state[USERS_TABLE_NAME], USERS_TABLE_NAME);
      store.put(state[ASSETS_TABLE_NAME], ASSETS_TABLE_NAME);
      store.put(state[ACTIVITY_MEMBERS_TABLE_NAME], ACTIVITY_MEMBERS_TABLE_NAME);
      store.put(state[USER_RATES_TABLE_NAME], USER_RATES_TABLE_NAME);
      store.put(state[USER_RATES_OUTBOX_TABLE_NAME], USER_RATES_OUTBOX_TABLE_NAME);
      store.put(state[USER_FILTER_PREFERENCES_TABLE_NAME], USER_FILTER_PREFERENCES_TABLE_NAME);
      store.put(state[CHATS_TABLE_NAME], CHATS_TABLE_NAME);
      store.put(state[EVENTS_TABLE_NAME], EVENTS_TABLE_NAME);
      store.delete('demoEvents');
      store.delete('rates');
      store.delete(AppMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);
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

  private normalizeState(value: unknown, fallback = this.createEmptyState()): DemoMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<DemoMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const assetsSource = source[ASSETS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ASSETS_TABLE_NAME]> | undefined;
    const activityMembersSource = source[ACTIVITY_MEMBERS_TABLE_NAME] as Partial<DemoMemorySchema[typeof ACTIVITY_MEMBERS_TABLE_NAME]> | undefined;
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
          : [...fallback[USER_RATES_TABLE_NAME].ids]
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
}
