import { adminGraphStatistics } from '../builders/admin-graph-statistics.builder';
import type { AdminStatsDashboardDto, AdminStatsBreakdownItemDto, AdminAffinityGraphDto } from "../../../contracts/admin.interface";
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminStatsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore<T>(groupId: string | null = null): Promise<T | null> {
    const root = await this.memoryDb.readIndexedDbTableEntry<T & { baseGroups?: Record<string, T> }>(APP_INDEXED_DB_KEYS.adminStats);
    if (groupId) return root?.baseGroups?.[groupId] ?? null;
    if (!root) return null;
    const { baseGroups: _groups, ...snapshot } = root;
    return snapshot as T;
  }

  groupForAdmin(adminUserId?: string | null): string | null {
    return this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId ?? null;
  }

  /** Local statistics project the same selected base profiles as the other app-admin queries. */
  projectGroupSnapshot(template: AdminStatsDashboardDto, groupId: string | null, graph?: AdminAffinityGraphDto | null): AdminStatsDashboardDto {
    const state = this.memoryDb.read();
    const users = Object.values(state.users.byId).filter(u => (u.workspaceGroupId ?? null) === groupId && !u.admin && !u.operator);
    const ids = new Set(users.map(u => u.id));
    const events = [...new Map(Object.values(state.events.byId).filter(e => ids.has(e.creatorUserId)).map(e => [e.id, e])).values()];
    const assets = Object.values(state.assets.byId).filter(a => ids.has(a.ownerUserId));
    const rates = Object.values(state.userRates.byId).filter(r => ids.has(r.ownerUserId ?? '') && ids.has(r.toUserId) && ids.has(r.fromUserId));
    const active = users.filter(u => ['public', 'friends only', 'host only'].includes(u.profileStatus ?? '')).length;
    const onboarding = users.filter(u => u.profileStatus === 'onboarding').length;
    const inactive = users.filter(u => u.profileStatus === 'inactive').length;
    const deleted = users.filter(u => u.profileStatus === 'deleted').length;
    const values: Record<string, number> = {
      'active-profiles': active, 'onboarding-users': onboarding, 'inactive-profiles': inactive,
      'departed-users': deleted, 'active-events': events.filter(e => e.status === 'A').length,
      'all-events': events.length, 'all-assets': assets.length,
      'profile.registered': users.length, 'profile.active': active, 'profile.onboarding': onboarding,
      'profile.inactive': inactive, 'profile.deleted': deleted, 'tried-users': users.length,
      'profile-fill-average': users.length ? Math.round(users.reduce((sum, u) => sum + (u.completion ?? 0), 0) / users.length) : 0,
      'rates.synced': rates.length, profiles: users.length, matching: rates.length, events: events.length, assets: assets.length
    };
    const breakdown = (counts: Map<string, number>, total: number, icon: string): AdminStatsBreakdownItemDto[] =>
      [...counts].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ key: label, labelKey: '', label, value, total, icon, tone: 'blue' }));
    const count = (items: string[]) => {
      const result = new Map<string, number>();
      for (const item of items.filter(Boolean)) result.set(item, (result.get(item) ?? 0) + 1);
      return result;
    };
    const messages = [...new Map(Object.values(state.chatMessages.byId).filter(message => ids.has(message.ownerUserId))
      .map(message => [message.messageId, message])).values()];
    const members = Object.values(state.activityMembers.byId).filter(member => ids.has(member.userId));
    values['chat.message.sent'] = messages.length;
    values['chats'] = messages.length;
    const today = new Date();
    const timeline = Array.from({ length: 14 }, (_, i) => {
      const dateKey = new Date(today.getTime() - (13 - i) * 86400000).toISOString().slice(0, 10);
      const dailyRates = rates.filter(r => (r.updatedAtIso ?? r.createdAtIso).slice(0, 10) === dateKey);
      return { dateKey, label: dateKey, registrations: 0, activeUsers: new Set(dailyRates.map(r => r.ownerUserId)).size,
        ratings: dailyRates.length, events: events.filter(e => e.startAtIso.slice(0, 10) === dateKey).length,
        assets: assets.filter(asset => asset.createdAtIso.slice(0, 10) === dateKey).length,
        messages: messages.filter(message => message.sentAtIso.slice(0, 10) === dateKey).length, moderation: 0 };
    });
    values['active-users'] = new Set(rates.filter(r => Date.parse(r.updatedAtIso ?? r.createdAtIso) >= today.getTime() - 7 * 86400000).map(r => r.ownerUserId)).size;
    values['active-users-7d'] = values['active-users'];
    const health = Math.min(100, 92 + Math.floor((users.length + rates.length + events.length) / 25));
    return { ...template, generatedAtIso: today.toISOString(), healthScore: health, healthLabelKey: 'stats.health.good',
      kpis: template.kpis.map(m => ({ ...m, value: values[m.key] ?? 0, valueLabel: `${values[m.key] ?? 0}`, caption: '', percent: users.length ? Math.min(100, Math.round((values[m.key] ?? 0) * 100 / users.length)) : 0 })),
      segments: template.segments.map(s => ({ ...s, summary: '', total: s.items.reduce((sum, item) => sum + (values[item.key] ?? 0), 0),
        healthPercent: 0, items: s.items.map(i => ({ ...i, value: values[i.key] ?? 0, total: Math.max(users.length, values[i.key] ?? 0) })) })),
      attention: [], topCities: breakdown(count(users.map(u => u.city)), users.length, 'location_on'),
      topTopics: breakdown(count(events.flatMap(e => e.topics)), events.length, 'local_offer'),
      eventTypes: breakdown(count(events.map(e => e.mode ?? 'Casual')), events.length, 'category'), timeline,
      activityMix: template.activityMix.map(m => ({ ...m, value: values[m.key] ?? 0, total: template.activityMix.reduce((sum, item) => sum + (values[item.key] ?? 0), 0) })),
      graph: adminGraphStatistics(template.graph, graph, users, rates, members, today)
    };
  }

  async writeStore(store: AdminStatsDashboardDto, groupId: string | null = null): Promise<void> {
    await this.memoryDb.updateIndexedDbTableEntry<AdminStatsDashboardDto & { baseGroups?: Record<string, AdminStatsDashboardDto> }>(APP_INDEXED_DB_KEYS.adminStats,
      root => groupId ? { ...root!, baseGroups: { ...root?.baseGroups, [groupId]: store } } : { ...store, baseGroups: root?.baseGroups });
  }

  async refreshGroup(groupId: string | null, graph: AdminAffinityGraphDto | null): Promise<void> {
    const previous = await this.readStore<AdminStatsDashboardDto & { projectionSource?: string }>(groupId);
    const template = previous ?? await this.readStore<AdminStatsDashboardDto>();
    if (!template) throw new Error('Demo stats snapshot is not bootstrapped.');
    const next = this.projectGroupSnapshot(template, groupId, graph);
    const today = next.generatedAtIso.slice(0, 10);
    if (previous?.projectionSource === 'local-records-v1') next.graph.timeline = next.graph.timeline.map(day => day.dateKey === today ? day
      : previous.graph.timeline.find(saved => saved.dateKey === day.dateKey) ?? day);
    await this.writeStore(Object.assign(next, { projectionSource: 'local-records-v1' }), groupId);
  }

  async clearStore(): Promise<void> {
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats);
  }
}
