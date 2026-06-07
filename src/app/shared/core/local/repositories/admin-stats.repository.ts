import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminStatsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(): Promise<T | null> {
    return await this.memoryDb.readIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminStats);
  }

  async writeStore<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats, store);
  }

  async clearStore(): Promise<void> {
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats);
  }
}
