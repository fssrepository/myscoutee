import type { AppMemorySchema } from '../../../common/memory.schema';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../entity/common/activity.entity';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import { COMMUNITY_ANNOUNCEMENTS_TABLE_NAME, type CommunityAnnouncementRecord } from '../../entity/community/community-announcement.entity';

@Injectable({ providedIn: 'root' })
export class LocalCommunityAnnouncementsRepository {
  private readonly db = inject(LocalMemoryDb);
  ready() { return this.db.whenReady(); }
  flush() { return this.db.flushToIndexedDb(); }
  find(id: string) { return this.db.read()[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME].byId[id] ?? null; }
  records() { const t = this.db.read()[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME]; return t.ids.map(id => t.byId[id]); }
  static withVoteCounterWrite(state: AppMemorySchema, record: CommunityAnnouncementRecord, now = Date.now()): AppMemorySchema {
    const table = state[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME], old = table.byId[record.id];
    const group = state.communityGroups.byId[record.communityId], members = state[ACTIVITY_MEMBERS_TABLE_NAME];
    const voted = new Set(record.ballots.map(b => b.voterAccountId));
    const active = group?.groupType === 'community' && !['deleted', 'under-review'].includes(group.lifecycleStatus ?? '');
    const open = active && record.voting && record.status === 'published' && !record.closedAtIso && !!record.deadlineIso && Date.parse(record.deadlineIso) > now;
    const owners = new Set<string>(), listOwners: Record<string, string> = {};
    const bucket = `announcement_${record.status}_${record.voting ? 'votes' : 'notices'}`;
    if (active) for (const memberId of members.ids) {
      const m = members.byId[memberId], profileId = `group:${record.communityId}:${m.userId}`;
      if (m.ownerType !== 'community' || m.ownerId !== record.communityId || m.status !== 'accepted' || !state.users.byId[profileId]) continue;
      if (record.status === 'published' || m.role === 'Admin') listOwners[profileId] = bucket;
      if (open && m.votingEligible && !voted.has(m.userId)) owners.add(profileId);
    }
    const before = new Set(old?.voteCounterOwners ?? []), byId = { ...state.users.byId };
    const oldList = old?.announcementCounterOwners ?? {};
    for (const id of new Set([...before, ...owners, ...Object.keys(oldList), ...Object.keys(listOwners)])) {
      const delta = Number(owners.has(id)) - Number(before.has(id));
      const user = byId[id]; if (!user || !delta && oldList[id] === listOwners[id]) continue;
      const counts = { ...user.menuCounters };
      if (delta) counts['votes'] = (counts['votes'] ?? 0) + delta;
      if (oldList[id] !== listOwners[id]) {
        if (oldList[id]) counts[oldList[id]] = (counts[oldList[id]] ?? 0) - 1;
        if (listOwners[id]) counts[listOwners[id]] = (counts[listOwners[id]] ?? 0) + 1;
      }
      byId[id] = { ...user, menuCounters: counts };
    }
    return { ...state, users: { ...state.users, byId }, [COMMUNITY_ANNOUNCEMENTS_TABLE_NAME]: {
      ids: old ? table.ids : [...table.ids, record.id], byId: { ...table.byId, [record.id]: { ...structuredClone(record), voteCounterOwners: [...owners], announcementCounterOwners: listOwners } }
    } };
  }
  membersChanged(groupId: string): void {
    this.db.write(state => state[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME].ids.map(id => state[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME].byId[id])
      .filter(a => a.communityId === groupId).reduce((next, a) => LocalCommunityAnnouncementsRepository.withVoteCounterWrite(next, a), state));
  }
  expireVotes(now = Date.now()): void {
    const expired = this.records().filter(a => a.voteCounterOwners?.length && a.deadlineIso && Date.parse(a.deadlineIso) <= now);
    if (expired.length) this.db.write(state => expired.reduce((next, a) => LocalCommunityAnnouncementsRepository.withVoteCounterWrite(next, a, now), state));
  }
  save(record: CommunityAnnouncementRecord, expected?: number): CommunityAnnouncementRecord {
    this.db.write(state => {
      const t = state[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME];
      if (t.byId[record.id]?.version !== expected) throw new Error('announcement.changed');
      return LocalCommunityAnnouncementsRepository.withVoteCounterWrite(state, record);
    }); return record;
  }
}
