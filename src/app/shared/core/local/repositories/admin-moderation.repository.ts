import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import type { AdminModerationStore } from '../../contracts/admin.interface';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminModerationRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore(): Promise<AdminModerationStore | null> {
    return await this.memoryDb.readIndexedDbTableEntry<AdminModerationStore>(APP_INDEXED_DB_KEYS.adminModeration);
  }
}
