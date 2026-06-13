import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../base/db';
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

  async resetAndSeedAdminStores<
    TModeration,
    TNotification,
    TMonitoring,
    TStats,
    TParams
  >(
    stores: SeedAdminStores<TModeration, TNotification, TMonitoring, TStats, TParams>
  ): Promise<SeedAdminMenuCounterState<TNotification, TMonitoring>> {
    await Promise.all([
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminModeration, stores.moderation),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminNotificationRules, stores.notificationCenter),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring, stores.monitoring),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats, stores.stats),
      this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminParams, stores.params)
    ]);
    return {
      notificationCenter: stores.notificationCenter,
      monitoring: stores.monitoring
    };
  }
}
