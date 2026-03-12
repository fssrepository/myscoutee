import { Injectable, signal } from '@angular/core';

import {
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME,
  type DemoUsersMemorySchema
} from './users.model';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersMemoryDb {
  private static readonly STORAGE_KEY = 'myscoutee.demo.db.v1';
  private static readonly INDEXED_DB_NAME = 'myscoutee-demo-db';
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
      }
    };
  }

  private loadInitialState(): DemoUsersMemorySchema {
    const fallback = this.createEmptyState();
    if (!this.canUseStorage()) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(DemoUsersMemoryDb.STORAGE_KEY);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeState(parsed, fallback);
    } catch {
      return fallback;
    }
  }

  private persist(state: DemoUsersMemorySchema): void {
    if (!this.canUseStorage()) {
      return;
    }
    try {
      localStorage.setItem(DemoUsersMemoryDb.STORAGE_KEY, JSON.stringify(state));
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
    this._tables.set(normalized);
    this.persist(normalized);
  }

  private async readFromIndexedDb(): Promise<DemoUsersMemorySchema | null> {
    const db = await this.openIndexedDb();
    if (!db) {
      return null;
    }
    const users = await this.readIndexedDbEntry(db, USERS_TABLE_NAME);
    const rates = await this.readIndexedDbEntry(db, USER_RATES_TABLE_NAME);
    const outbox = await this.readIndexedDbEntry(db, USER_RATES_OUTBOX_TABLE_NAME);

    const hasSegmentedState = users !== null || rates !== null || outbox !== null;
    if (!hasSegmentedState) {
      const legacy = await this.readIndexedDbEntry(db, DemoUsersMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);
      if (legacy !== null) {
        return this.normalizeState(legacy, this.createEmptyState());
      }
      return this.createEmptyState();
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
    return this.normalizeState(partialState, this.createEmptyState());
  }

  private async persistToIndexedDb(state: DemoUsersMemorySchema): Promise<void> {
    const db = await this.openIndexedDb();
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(DemoUsersMemoryDb.INDEXED_DB_STORE, 'readwrite');
      const store = tx.objectStore(DemoUsersMemoryDb.INDEXED_DB_STORE);
      store.put(state[USERS_TABLE_NAME], USERS_TABLE_NAME);
      store.put(state[USER_RATES_TABLE_NAME], USER_RATES_TABLE_NAME);
      store.put(state[USER_RATES_OUTBOX_TABLE_NAME], USER_RATES_OUTBOX_TABLE_NAME);
      store.delete(DemoUsersMemoryDb.LEGACY_INDEXED_DB_STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private readIndexedDbEntry(db: IDBDatabase, key: string): Promise<unknown | null> {
    return new Promise<unknown | null>(resolve => {
      const tx = db.transaction(DemoUsersMemoryDb.INDEXED_DB_STORE, 'readonly');
      const store = tx.objectStore(DemoUsersMemoryDb.INDEXED_DB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  private openIndexedDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise<IDBDatabase | null>(resolve => {
      const request = indexedDB.open(
        DemoUsersMemoryDb.INDEXED_DB_NAME,
        DemoUsersMemoryDb.INDEXED_DB_VERSION
      );
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DemoUsersMemoryDb.INDEXED_DB_STORE)) {
          db.createObjectStore(DemoUsersMemoryDb.INDEXED_DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  private normalizeState(value: unknown, fallback = this.createEmptyState()): DemoUsersMemorySchema {
    const source = (value && typeof value === 'object') ? value as Partial<DemoUsersMemorySchema> : {};
    const usersSource = source[USERS_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USERS_TABLE_NAME]> | undefined;
    const ratesSource = source[USER_RATES_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USER_RATES_TABLE_NAME]> | undefined;
    const outboxSource = source[USER_RATES_OUTBOX_TABLE_NAME] as Partial<DemoUsersMemorySchema[typeof USER_RATES_OUTBOX_TABLE_NAME]> | undefined;
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
      }
    };
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
