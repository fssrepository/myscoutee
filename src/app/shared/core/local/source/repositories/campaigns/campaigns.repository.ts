import type { UserRateRecord } from '../../entity/affinity/rate.entity';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import { CAMPAIGNS_TABLE_NAME, type CampaignRecord } from '../../entity/campaigns/campaign.entity';

@Injectable({ providedIn: 'root' })
export class LocalCampaignsRepository {
  private readonly db = inject(LocalMemoryDb);
  ready(): Promise<void> { return this.db.whenReady(); }
  records(workspaceGroupId: string): CampaignRecord[] {
    const table = this.db.read()[CAMPAIGNS_TABLE_NAME];
    return table.ids.map(id => table.byId[id]).filter(record => record?.workspaceGroupId === workspaceGroupId);
  }
  counts(workspaceGroupId: string | undefined, ownerUserId: string) {
    const user = this.db.read().users.byId[ownerUserId];
    const counts = user?.workspaceGroupId === workspaceGroupId ? user.menuCounters : undefined;
    return { published: counts?.['campaignsPublished'] ?? 0, draft: counts?.['campaignsDrafts'] ?? 0, trash: counts?.['campaignsTrash'] ?? 0 };
  }
  static withCounterWrite(state: import('../../../common/memory.schema').AppMemorySchema, record: CampaignRecord) {
    const previous = state.campaigns.byId[record.id];
    const owner = state.users.byId[record.ownerUserId];
    if (!owner || owner.workspaceGroupId !== record.workspaceGroupId) throw new Error('Campaign owner not found');
    const values = { ...owner.menuCounters };
    const key = (status: CampaignRecord['status']) => ({ published: 'campaignsPublished', draft: 'campaignsDrafts', trash: 'campaignsTrash' })[status];
    if (previous?.counterApplied) values[key(previous.status)] = (values[key(previous.status)] ?? 0) - 1;
    values[key(record.status)] = (values[key(record.status)] ?? 0) + 1;
    return { ...state,
      users: { ...state.users, byId: { ...state.users.byId, [owner.id]: { ...owner, menuCounters: values } } },
      campaigns: { byId: { ...state.campaigns.byId, [record.id]: { ...structuredClone(record), counterApplied: true } },
        ids: previous ? state.campaigns.ids : [...state.campaigns.ids, record.id] }
    };
  }
  interactionDates(userId: string, targetUserId: string): Map<string, string> {
    const state = this.db.read();
    const dates = new Map<string, string>();
    const remember = (id: string | null | undefined, date: string | null | undefined) => {
      const ms = Date.parse(date ?? '');
      if (!id || !Number.isFinite(ms)) return;
      const iso = new Date(ms).toISOString();
      if (!dates.has(id) || iso > dates.get(id)!) dates.set(id, iso);
    };
    for (const id of state.userRates.ids) {
      const rate = state.userRates.byId[id];
      if (rate?.mode === 'single' && ((rate.fromUserId === userId && rate.toUserId === targetUserId)
        || (rate.fromUserId === targetUserId && rate.toUserId === userId))) {
        remember(rate.campaignId, rate.updatedAtIso || rate.createdAtIso);
      }
    }
    for (const id of state.chats.ids) {
      const chat = state.chats.byId[id];
      if (chat?.ownerUserId === userId && chat.channelType === 'campaign'
        && chat.memberIds.includes(userId) && chat.memberIds.includes(targetUserId)) remember(chat.ownerId, chat.dateIso);
    }
    return dates;
  }
  ratingEvidenceByCampaign(userId: string): Map<string, UserRateRecord> {
    const rates = this.db.read().userRates;
    const result = new Map<string, UserRateRecord>();
    for (const id of rates.ids) {
      const rate = rates.byId[id];
      if (rate?.ownerUserId !== userId || !rate.campaignId || rate.mode !== 'single') continue;
      const previous = result.get(rate.campaignId);
      if (!previous || rate.updatedAtIso >= previous.updatedAtIso) result.set(rate.campaignId, rate);
    }
    return result;
  }
  ratingsByCampaign(userId: string): Map<string, number> {
    return new Map([...this.ratingEvidenceByCampaign(userId)].map(([id, rate]) => [id, rate.scoreGiven ?? rate.rate]));
  }
  find(id: string): CampaignRecord | null { return this.db.read()[CAMPAIGNS_TABLE_NAME].byId[id] ?? null; }
  save(record: CampaignRecord, expectedVersion?: number): CampaignRecord {
    this.db.write(state => {
      const table = state[CAMPAIGNS_TABLE_NAME];
      if (table.byId[record.id]?.version !== expectedVersion) throw new Error('Campaign changed');
      return LocalCampaignsRepository.withCounterWrite(state, record);
    });
    return record;
  }
}
