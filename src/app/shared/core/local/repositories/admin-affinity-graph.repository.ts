import { Injectable, inject } from '@angular/core';

import type { AdminAffinityGraphDto } from '../../base/interfaces/admin-affinity-graph.interface';
import { ADMIN_AFFINITY_GRAPH_STORE_KEY } from '../../base/interfaces/admin-affinity-graph.interface';
import { LocalMemoryDb } from '../../base/db';

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
