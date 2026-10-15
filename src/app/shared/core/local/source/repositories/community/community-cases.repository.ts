import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import type { AppMemorySchema } from '../../../common/memory.schema';
import type { CaseListContext } from '../../../../contracts/community/community-case.interface';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../entity/common/activity.entity';
import { COMMUNITY_BASE_GROUP_ID } from '../../../../contracts/groups/group-type';
import { COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME, caseMembershipStatus, type CommunityCaseRecord, type CommunityTaskRecord } from '../../entity/community/community-case.entity';

@Injectable({ providedIn: 'root' })
export class LocalCommunityCasesRepository {
  private readonly db = inject(LocalMemoryDb);
  ready(): Promise<void> { return this.db.whenReady(); }
  flush(): Promise<void> { return this.db.flushToIndexedDb(); }
  cases(): CommunityCaseRecord[] { const table = this.db.read()[COMMUNITY_CASES_TABLE_NAME]; return table.ids.map(id => table.byId[id]); }
  tasks(): CommunityTaskRecord[] { const table = this.db.read()[COMMUNITY_TASKS_TABLE_NAME]; return table.ids.map(id => table.byId[id]); }
  visibleCases(accountId: string, managedGroups: ReadonlySet<string>): CommunityCaseRecord[] {
    return this.cases().filter(c => c.baseGroupId === COMMUNITY_BASE_GROUP_ID
      && (c.participantAccountIds.includes(accountId) && caseMembershipStatus(c, accountId) !== 'removed'
        || !!c.communityId && managedGroups.has(c.communityId)));
  }
  context(accountId: string): CaseListContext {
    const values = this.db.read().users.byId[accountId]?.menuCounters ?? {};
    const context: CaseListContext = { total: values['communityCases'] ?? 0 };
    for (const [key, value] of Object.entries(values)) if (key.startsWith('communityCase_')) {
      const [status, type] = key.slice('communityCase_'.length).split('__');
      if (status && type) context[`${status.replaceAll('_', '-')}:${type.replaceAll('_', '-')}`] = value;
    }
    return context;
  }
  static withCounterWrite(state: AppMemorySchema, record: CommunityCaseRecord): AppMemorySchema {
    const old = state[COMMUNITY_CASES_TABLE_NAME].byId[record.id];
    const group = record.communityId ? state.communityGroups.byId[record.communityId] : null;
    const members = state[ACTIVITY_MEMBERS_TABLE_NAME];
    const admins = group && group.groupType === 'community' && !['deleted', 'under-review'].includes(group.lifecycleStatus ?? '')
      ? members.ids.map(id => members.byId[id]).filter(m => m.ownerType === 'community' && m.ownerId === group.id
        && m.status === 'accepted' && m.role === 'Admin').map(m => m.userId) : [];
    const visible = new Set([...record.participantAccountIds.filter(id => caseMembershipStatus(record, id) !== 'removed'), ...admins]);
    const bucket = `communityCase_${record.status.replaceAll('-', '_')}__${record.caseType.replaceAll('-', '_')}`;
    const nextOwners = Object.fromEntries([...visible].map(id => [id, bucket]));
    const byId = { ...state.users.byId };
    const active = (key: string | undefined) => key && !key.startsWith('communityCase_trash__') ? 1 : 0;
    for (const id of new Set([...Object.keys(old?.counterOwners ?? {}), ...visible])) {
      const user = byId[id]; if (!user) throw new Error('Case account not found');
      const before = old?.counterOwners?.[id], after = nextOwners[id];
      if (before === after) continue;
      const values = { ...user.menuCounters };
      if (before) values[before] = (values[before] ?? 0) - 1;
      if (after) values[after] = (values[after] ?? 0) + 1;
      values['communityCases'] = (values['communityCases'] ?? 0) + active(after) - active(before);
      byId[id] = { ...user, menuCounters: values };
    }
    const feedbackOwners: Record<string, number> = {};
    const feedbackBuckets: Record<string, Record<string, number>> = {};
    const contribute = (accountId: string, bucket: string) => {
      const values = feedbackBuckets[accountId] ??= {};
      values[bucket] = (values[bucket] ?? 0) + 1;
    };
    for (const feedback of record.feedback ?? []) {
      contribute(feedback.viewerAccountId, feedback.status);
      if (feedback.status === 'feedbacked') contribute(feedback.providerAccountId, 'received');
    }
    for (const id of new Set([...Object.keys(old?.feedbackCounterBuckets ?? {}), ...Object.keys(feedbackBuckets)])) {
      const user = byId[id];
      if (!user) continue;
      const values = { ...user.menuCounters };
      for (const bucket of ['pending', 'feedbacked', 'removed', 'received']) {
        const delta = (feedbackBuckets[id]?.[bucket] ?? 0) - (old?.feedbackCounterBuckets?.[id]?.[bucket] ?? 0);
        if (delta) values[`serviceFeedback_${bucket}`] = (values[`serviceFeedback_${bucket}`] ?? 0) + delta;
      }
      byId[id] = { ...user, menuCounters: values };
    }
    for (const feedback of record.feedback ?? []) if (feedback.status === 'pending')
      feedbackOwners[feedback.viewerAccountId] = (feedbackOwners[feedback.viewerAccountId] ?? 0) + 1;
    for (const id of new Set([...Object.keys(old?.feedbackCounterOwners ?? {}), ...Object.keys(feedbackOwners)])) {
      const profileId = `group:${COMMUNITY_BASE_GROUP_ID}:${id}`, user = byId[profileId];
      const delta = (feedbackOwners[id] ?? 0) - (old?.feedbackCounterOwners?.[id] ?? 0);
      const menuDelta = (feedbackOwners[id] ?? 0) - (old?.feedbackCounterBuckets ? old.feedbackCounterOwners?.[id] ?? 0 : 0);
      if (user && (delta || menuDelta)) byId[profileId] = { ...user, menuCounters: { ...user.menuCounters, feedback: (user.menuCounters?.['feedback'] ?? 0) + menuDelta },
        activities: { ...user.activities, feedback: (user.activities.feedback ?? 0) + delta } };
    }
    return { ...state, users: { ...state.users, byId }, [COMMUNITY_CASES_TABLE_NAME]: {
      byId: { ...state[COMMUNITY_CASES_TABLE_NAME].byId, [record.id]: { ...structuredClone(record), counterOwners: nextOwners, feedbackCounterOwners: feedbackOwners, feedbackCounterBuckets: feedbackBuckets } },
      ids: old ? state[COMMUNITY_CASES_TABLE_NAME].ids : [...state[COMMUNITY_CASES_TABLE_NAME].ids, record.id]
    } };
  }
  static withTaskCounterWrite(state: AppMemorySchema, record: CommunityTaskRecord): AppMemorySchema {
    const table = state[COMMUNITY_TASKS_TABLE_NAME], old = table.byId[record.id];
    const group = record.communityId ? state.communityGroups.byId[record.communityId] : null;
    const members = state[ACTIVITY_MEMBERS_TABLE_NAME];
    const visible = new Set(!record.communityId ? [record.ownerAccountId]
      : group?.groupType === 'community' && !['deleted', 'under-review'].includes(group.lifecycleStatus ?? '')
        ? members.ids.map(id => members.byId[id]).filter(m => m.ownerType === 'community' && m.ownerId === record.communityId
          && m.status === 'accepted' && (m.role === 'Admin' || record.audienceAll || record.audienceAccountIds.includes(m.userId))).map(m => m.userId) : []);
    const bucket = `communityTask_${record.deleted ? 'trash' : record.enabled ? 'active' : 'paused'}`;
    const owners = Object.fromEntries([...visible].map(id => [id, bucket]));
    const byId = { ...state.users.byId };
    for (const id of new Set([...Object.keys(old?.counterOwners ?? {}), ...visible])) {
      const before = old?.counterOwners?.[id], after = owners[id];
      if (before === after) continue;
      const user = byId[id]; if (!user) throw new Error('Task account not found');
      const values = { ...user.menuCounters };
      if (before) values[before] = (values[before] ?? 0) - 1;
      if (after) values[after] = (values[after] ?? 0) + 1;
      byId[id] = { ...user, menuCounters: values };
    }
    return { ...state, users: { ...state.users, byId }, [COMMUNITY_TASKS_TABLE_NAME]: {
      ids: old ? table.ids : [...table.ids, record.id], byId: { ...table.byId, [record.id]: { ...structuredClone(record), counterOwners: owners } }
    } };
  }
  groupAdminsChanged(groupId: string): void {
    this.db.write(state => {
      const cases = state[COMMUNITY_CASES_TABLE_NAME].ids.map(id => state[COMMUNITY_CASES_TABLE_NAME].byId[id])
        .filter(c => c.communityId === groupId).reduce((next, c) => LocalCommunityCasesRepository.withCounterWrite(next, c), state);
      return state[COMMUNITY_TASKS_TABLE_NAME].ids.map(id => state[COMMUNITY_TASKS_TABLE_NAME].byId[id])
        .filter(t => t.communityId === groupId).reduce((next, t) => LocalCommunityCasesRepository.withTaskCounterWrite(next, t), cases);
    });
  }
  saveFeedback(id:string,feedback:NonNullable<CommunityCaseRecord['feedback']>,feedbackWork:CommunityCaseRecord['feedbackWork']):void {
    this.db.write(state=>{const table=state[COMMUNITY_CASES_TABLE_NAME],current=table.byId[id];if(!current)return state;
      return LocalCommunityCasesRepository.withCounterWrite(state, {...current,feedback:structuredClone(feedback),feedbackWork:structuredClone(feedbackWork)});
    });
  }
  findCase(id: string): CommunityCaseRecord | null { return this.db.read()[COMMUNITY_CASES_TABLE_NAME].byId[id] ?? null; }
  findTask(id: string): CommunityTaskRecord | null { return this.db.read()[COMMUNITY_TASKS_TABLE_NAME].byId[id] ?? null; }
  saveCase(record: CommunityCaseRecord, expectedVersion?: number): CommunityCaseRecord {
    this.db.write(state => {
      const table = state[COMMUNITY_CASES_TABLE_NAME];
      if (table.byId[record.id]?.version !== expectedVersion) throw new Error('case.changed');
      return LocalCommunityCasesRepository.withCounterWrite(state, record);
    }); return record;
  }
  saveTask(record: CommunityTaskRecord, expectedVersion?: number): CommunityTaskRecord {
    this.db.write(state => {
      const table = state[COMMUNITY_TASKS_TABLE_NAME];
      if (table.byId[record.id]?.version !== expectedVersion) throw new Error('case.changed');
      return LocalCommunityCasesRepository.withTaskCounterWrite(state, record);
    }); return record;
  }

}
