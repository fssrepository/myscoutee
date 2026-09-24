import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export interface SeedAdminStores<
  TModeration = unknown,
  TNotification = unknown,
  TMonitoring = unknown,
  TStats = unknown,
  TParams = unknown
> {
  moderation: TModeration;
  notificationCenter: TNotification;
  monitoring: TMonitoring;
  stats: TStats;
  params: TParams;
}

export interface SeedAdminMenuCounterState<TNotification = unknown, TMonitoring = unknown> {
  notificationCenter: TNotification;
  monitoring: TMonitoring;
}

@Injectable({
  providedIn: 'root'
})
export class SeedAdminStoreRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async seedNotificationCenter<T>(create: () => T): Promise<T> {
    const existing = await this.memoryDb.readIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminNotificationRules);
    if (existing) return existing;
    const state = create();
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminNotificationRules, state);
    return state;
  }

  async resetAndSeedAdminStores<
    TModeration,
    TNotification,
    TMonitoring,
    TStats,
    TParams
  >(
    stores: SeedAdminStores<TModeration, TNotification, TMonitoring, TStats, TParams>
  ): Promise<SeedAdminMenuCounterState<TNotification, TMonitoring>> {
    const notificationCenter = await this.seedNotificationCenter(() => stores.notificationCenter);
    await Promise.all([
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminModeration, stores.moderation),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring, stores.monitoring),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats, stores.stats),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminParams, stores.params)
    ]);
    return {
      notificationCenter,
      monitoring: stores.monitoring
    };
  }
}
