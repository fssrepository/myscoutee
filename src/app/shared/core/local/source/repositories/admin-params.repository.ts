import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminParamsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(adminUserId?: string | null): Promise<T | null> {
    const groupId = this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId;
    const store = await this.memoryDb.readIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminParams);
    if (groupId) return store?.baseGroups?.[groupId] ?? null;
    if (!store) return null;
    const { baseGroups: _baseGroups, ...baseStore } = store;
    return baseStore as T;
  }

  async writeStore<T>(store: T, adminUserId?: string | null): Promise<void> {
    const groupId = this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId;
    await this.memoryDb.updateIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminParams, current => {
      if (!current) throw new Error('Demo params store is not bootstrapped.');
      return groupId ? { ...current, baseGroups: { ...current.baseGroups, [groupId]: store } }
        : { ...store, baseGroups: current.baseGroups };
    });
  }

  async clearStore(): Promise<void> {
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminParams);
  }
}
