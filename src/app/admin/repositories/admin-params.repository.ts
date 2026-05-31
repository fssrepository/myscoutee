import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../shared/core/base/db';

const ADMIN_PARAMS_STORE_KEY = 'adminParams';

@Injectable({
  providedIn: 'root'
})
export class AdminParamsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(): Promise<T | null> {
    return await this.memoryDb.readIndexedDbTableEntry<T>(ADMIN_PARAMS_STORE_KEY);
  }

  async writeStore<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_PARAMS_STORE_KEY, store);
  }
}
