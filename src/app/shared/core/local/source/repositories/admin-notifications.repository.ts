import type { AdminNotificationCenterState, AdminNotificationRule } from '../../../contracts/admin.interface';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminNotificationsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  groupForAdmin(adminUserId?: string | null): string | null {
    return this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId ?? null;
  }

  async groupIds(): Promise<(string | null)[]> {
    const store = await this.memoryDb.readIndexedDbTableEntry<{ baseGroups?: Record<string, unknown> }>(APP_INDEXED_DB_KEYS.adminNotificationRules);
    return store ? [null, ...Object.keys(store.baseGroups ?? {})] : [];
  }

  async readStore<T>(groupId: string | null = null): Promise<T | null> {
    const store = await this.memoryDb.readIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminNotificationRules);
    if (groupId) return store?.baseGroups?.[groupId] ?? null;
    if (!store) return null;
    const { baseGroups: _groups, ...base } = store;
    return base as T;
  }

  async writeStore<T>(store: T, groupId: string | null = null): Promise<void> {
    await this.memoryDb.updateIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminNotificationRules, current => {
      if (!current) throw new Error('Demo notification center is not bootstrapped.');
      return groupId ? { ...current, baseGroups: { ...current.baseGroups, [groupId]: store } }
        : { ...store, baseGroups: current.baseGroups };
    });
    await this.refreshJobCounter(groupId);
  }

  async updateRule(key: string, update: (rule: AdminNotificationRule) => AdminNotificationRule, groupId: string | null): Promise<void> {
    await this.memoryDb.updateIndexedDbTableEntry<AdminNotificationCenterState & { baseGroups?: Record<string, AdminNotificationCenterState> }>(APP_INDEXED_DB_KEYS.adminNotificationRules, root => {
      const current = groupId ? root?.baseGroups?.[groupId] : root;
      if (!current?.rules.some(rule => rule.ruleKey === key)) throw new Error('Job is not seeded for this group.');
      const next = { ...current, rules: current.rules.map(rule => rule.ruleKey === key ? update(rule) : rule), updatedDate: new Date().toISOString() };
      return groupId ? { ...root!, baseGroups: { ...root?.baseGroups, [groupId]: next } } : next;
    });
    await this.refreshJobCounter(groupId);
  }

  private async refreshJobCounter(groupId: string | null): Promise<void> {
    const store = await this.readStore<AdminNotificationCenterState>(groupId);
    const failure = (value: string) => /failed|error|missed|timeout|hiany|hiba/i.test(value ?? '');
    const count = store?.rules.filter(rule => failure(rule.runState.currentStatus) || failure(rule.runState.lastRunStatus)).length ?? 0;
    this.memoryDb.write(state => {
      const byId = { ...state.users.byId };
      for (const user of Object.values(byId)) if (user.admin && (user.workspaceGroupId ?? null) === groupId) {
        byId[user.id] = { ...user, activities: { ...user.activities, adminJobs: count } };
      }
      return { ...state, users: { ...state.users, byId } };
    });
    await this.memoryDb.flushToIndexedDb();
  }

  async clearStore(): Promise<void> {
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminNotificationRules);
  }
}
