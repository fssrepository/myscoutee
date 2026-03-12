import { Injectable, signal } from '@angular/core';

import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME,
  type DemoUsersMemorySchema
} from './demo/models/users.model';

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
  private readonly _tables = signal<DemoUsersMemorySchema>(this.loadInitialState());

  readonly tables = this._tables.asReadonly();

  constructor() {
    void this.hydrateFromIndexedDb();
  }

  read(): DemoUsersMemorySchema {
    return this._tables();
  }

  write(updater: (current: DemoUsersMemorySchema) => DemoUsersMemorySchema): void {
    const next = this.normalizeState(updater(this._tables()));
    this._tables.set(next);
    this.persist(next);
    void this.persistToIndexedDb(next);
  }

  private createEmptyState(): DemoUsersMemorySchema {
    return {
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
      }
    };
  }

  private loadInitialState(): DemoUsersMemorySchema {
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

  private persist(state: DemoUsersMemorySchema): void {
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

  private async readFromIndexedDb(): Promise<DemoUsersMemorySchema | null> {
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

  private async readStateFromIndexedDb(db: IDBDatabase): Promise<DemoUsersMemorySchema | null> {
    const users = await this.readIndexedDbEntry(db, USERS_TABLE_NAME);
    const rates = await this.readIndexedDbEntry(db, USER_RATES_TABLE_NAME);
    const outbox = await this.readIndexedDbEntry(db, USER_RATES_OUTBOX_TABLE_NAME);
    const filterPreferences = await this.readIndexedDbEntry(db, USER_FILTER_PREFERENCES_TABLE_NAME);

    const hasSegmentedState = users !== null
      || rates !== null
      || outbox !== null
      || filterPreferences !== null;
    if (!hasSegmentedState) {
      const legacy = await this.readIndexedDbEntry(db, AppMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);
      if (legacy !== null) {
        return this.normalizeState(legacy, this.createEmptyState());
      }
      return null;
    }

    const partialState: Partial<DemoUsersMemorySchema> = {};
    if (users !== null) {
      partialState[USERS_TABLE_NAME] = users as DemoUsersMemorySchema[typeof USERS_TABLE_NAME];
    }
    if (rates !== null) {
      partialState[USER_RATES_TABLE_NAME] = rates as DemoUsersMemorySchema[typeof USER_RATES_TABLE_NAME];
    }
    if (outbox !== null) {
      partialState[USER_RATES_OUTBOX_TABLE_NAME] = outbox as DemoUsersMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME];
    }
    if (filterPreferences !== null) {
      partialState[USER_FILTER_PREFERENCES_TABLE_NAME] = filterPreferences as DemoUsersMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME];
    }
    return this.normalizeState(partialState, this.createEmptyState());
  }

  private async persistToIndexedDb(state: DemoUsersMemorySchema): Promise<void> {
    const db = await this.openIndexedDb(AppMemoryDb.INDEXED_DB_NAME, true);
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(AppMemoryDb.INDEXED_DB_STORE, 'readwrite');
      const store = tx.objectStore(AppMemoryDb.INDEXED_DB_STORE);
      store.put(state[USERS_TABLE_NAME], USERS_TABLE_NAME);
      store.put(state[USER_RATES_TABLE_NAME], USER_RATES_TABLE_NAME);
      store.put(state[USER_RATES_OUTBOX_TABLE_NAME], USER_RATES_OUTBOX_TABLE_NAME);
      store.put(state[USER_FILTER_PREFERENCES_TABLE_NAME], USER_FILTER_PREFERENCES_TABLE_NAME);
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

  private normalizeState(value: unknown, fallback = this.createEmptyState()): DemoUsersMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<DemoUsersMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const ratesSource = source[USER_RATES_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined;
    const outboxSource = source[USER_RATES_OUTBOX_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]> | undefined;
    const filterPreferencesSource = source[USER_FILTER_PREFERENCES_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME]> | undefined;
    return {
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
      }
    };
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
