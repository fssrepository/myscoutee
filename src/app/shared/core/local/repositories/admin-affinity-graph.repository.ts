import { Injectable, inject } from '@angular/core';

import type { AdminAffinityGraphDto } from '../../contracts/admin.interface';
import { LocalMemoryDb } from '../../base/db';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

const ADMIN_AFFINITY_GRAPH_STORE_KEY = APP_INDEXED_DB_KEYS.adminAffinityGraph;

@Injectable({
  providedIn: 'root'
})
export class LocalAdminAffinityGraphRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async readGraphSnapshot(): Promise<AdminAffinityGraphDto | null> {
    await this.memoryDb.whenReady();
    return this.memoryDb.readIndexedDbTableEntry<AdminAffinityGraphDto>(ADMIN_AFFINITY_GRAPH_STORE_KEY);
  }
}
