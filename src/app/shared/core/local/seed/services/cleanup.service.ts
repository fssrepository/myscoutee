import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';

@Injectable({
  providedIn: 'root'
})
export class SeedCleanupService {
  private readonly memoryDb = inject(LocalMemoryDb);

  async resetDemoStorage(): Promise<void> {
    await this.memoryDb.resetStorage();
  }

  async resetDemoStoragePreservingTables(tableNames: readonly string[]): Promise<void> {
    await this.memoryDb.resetStoragePreservingTables(tableNames);
  }
}
