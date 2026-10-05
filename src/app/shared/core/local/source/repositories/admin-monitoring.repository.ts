import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminMonitoringRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(adminUserId?: string | null): Promise<T | null> {
    const groupId = this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId;
    const store = await this.memoryDb.readIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminMonitoring);
    if (groupId) return store?.baseGroups?.[groupId] ?? null;
    if (!store) return null;
    const { baseGroups: _baseGroups, ...baseStore } = store;
    return baseStore as T;
  }

  async writeStore<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring, store);
  }

  async clearStore(): Promise<void> {
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring);
  }
}
