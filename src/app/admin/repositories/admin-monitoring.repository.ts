import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../shared/core/base/db';
import { APP_INDEXED_DB_KEYS } from '../../shared/core/base/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(): Promise<T | null> {
    return await this.memoryDb.readIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminMonitoring);
  }

  async writeStore<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring, store);
  }
}
