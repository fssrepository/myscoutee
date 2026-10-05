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
    const seed = create();
    type Catalog = { rules: { ruleKey: string }[]; baseGroups?: Record<string, Catalog> };
    const merge = (current: Catalog, incoming: Catalog): Catalog => {
      const keys = new Set(current.rules.map(rule => rule.ruleKey));
      const rules = [...current.rules, ...incoming.rules.filter(rule => !keys.has(rule.ruleKey))];
      const baseGroups = { ...current.baseGroups };
      for (const [id, scoped] of Object.entries(incoming.baseGroups ?? {})) baseGroups[id] = baseGroups[id] ? merge(baseGroups[id], scoped) : scoped;
      return { ...current, rules, ...(Object.keys(baseGroups).length?{baseGroups}:{}) };
    };
    return await this.memoryDb.updateIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminNotificationRules,
      current => current ? merge(current as unknown as Catalog, seed as unknown as Catalog) as T : seed);
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
    const [, monitoring] = await Promise.all([
      this.seedStore(APP_INDEXED_DB_KEYS.adminModeration, stores.moderation),
      this.seedStore(APP_INDEXED_DB_KEYS.adminMonitoring, stores.monitoring),
      this.seedStore(APP_INDEXED_DB_KEYS.adminStats, stores.stats),
      this.seedStore(APP_INDEXED_DB_KEYS.adminParams, stores.params)
    ]);
    return {
      notificationCenter,
      monitoring
    };
  }
  private async seedStore<T>(key: string, seed: T): Promise<T> {
    const existing = await this.memoryDb.readIndexedDbTableEntry<T>(key);
    if (!existing) { await this.memoryDb.writeIndexedDbTableEntry(key, seed); return seed; }
    const scopes = seed as T & { baseGroups?: Record<string, unknown> };
    const retained = existing as T & { baseGroups?: Record<string, unknown> };
    const missing = Object.entries(scopes.baseGroups ?? {}).filter(([id]) => !retained.baseGroups?.[id]);
    if (!missing.length) return existing;
    const next = { ...existing, baseGroups: { ...retained.baseGroups, ...Object.fromEntries(missing) } };
    await this.memoryDb.writeIndexedDbTableEntry(key, next);
    return next;
  }

}
