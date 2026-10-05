import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { ActivityEventDetailDTO } from '../../../contracts/activity.interface';
import { WORK_BASE_GROUP_ID } from '../../../contracts/group-type';
import { LocalActivityEventDetailsMapper } from '../../source/mappers/event.mapper';
import { BaseUserRatesMapper } from '../../../base/mappers/rate.mapper';
import { LocalRatesRepository } from '../../source/repositories/rates.repository';
import { LocalEventsRepository } from '../../source/repositories/events.repository';
import type { ActivityMemberRecord } from '../../source/entity/activity.entity';
import source from '../data/work-activity.json';

@Injectable({ providedIn: 'root' })
export class SeedWorkActivityRepository {
  private readonly db = inject(LocalMemoryDb);
  private readonly rates = inject(LocalRatesRepository);
  private readonly events = inject(LocalEventsRepository);
  seedDefaults(): void {
    const state = this.db.read();
    const users = new Map(Object.values(state.users.byId).filter(u => u.workspaceGroupId === WORK_BASE_GROUP_ID).map(u => [u.name, u]));
    const date = '2026-10-01T10:00:00.000Z';
    const rates = source.ratings.map(r => BaseUserRatesMapper.toRecord({ kind: 'game-card', raterUserId: users.get(r.from)!.id,
      ratedUserId: users.get(r.to)!.id, campaignId: r.campaignId, rating: r.rating })!)
      .filter(r => !state.userRates.byId[r.id]).map(r => ({ ...r, createdAtIso: date, updatedAtIso: date, happenedAtIso: date }));
    this.rates.upsertGameCardRatings(rates);
    const affectedUsers = new Set<string>();
    for (const template of source.events) {
      if (Object.values(state.events.byId).some(e => e.id === template.id)) continue;
      const campaign = state.campaigns.byId[template.campaignId];
      const owner = state.users.byId[campaign.ownerUserId];
      const roster = [owner, ...template.participants.map(name => users.get(name)!)];
      roster.forEach(user => affectedUsers.add(user.id));
      const event = new ActivityEventDetailDTO();
      Object.assign(event, template, { userId: owner.id, type: 'hosting', status: 'A', published: true,
        creatorUserId: owner.id, organizerUserId: owner.id, creatorName: owner.name, creatorInitials: owner.initials,
        creatorCity: owner.city, creatorGender: owner.gender, adminIds: [owner.id], subtitle: campaign.description,
        capacityTotal: template.capacity, capacityMax: template.capacity, capacityMin: 1, location: owner.city,
        locationCoordinates: owner.locationCoordinates, acceptedMembers: roster.length, acceptedMemberUserIds: roster.map(u => u.id),
        subEventsEnabled: false, visibility: 'Invitation only', mode: 'Casual' });
      this.events.saveEventSnapshot(LocalActivityEventDetailsMapper.toRecord(event));
      const members: ActivityMemberRecord[] = roster.map(user => ({
        id: `event:${event.id}:${user.id}`, ownerKey: `event:${event.id}`, ownerType: 'event', ownerId: event.id, userId: user.id,
        name: user.name, initials: user.initials, gender: user.gender, city: user.city, statusText: '',
        role: user === owner ? 'Admin' : 'Member', status: 'accepted', requestKind: null, pendingSource: null,
        invitedByActiveUser: false, invitedByUserId: owner.id, metWhere: event.title, metAtIso: date, actionAtIso: date,
        avatarUrl: user.images?.[0] ?? '', organizerOnly: false, createdMs: Date.parse(date), updatedMs: Date.parse(date),
        createdAtIso: date, updatedAtIso: date
      }));
      this.db.write(current => {
        const table = current.activityMembers;
        return { ...current, activityMembers: { byId: { ...table.byId, ...Object.fromEntries(members.map(m => [m.id, m])) },
          ids: [...new Set([...table.ids, ...members.map(m => m.id)])],
          idsByOwnerKey: { ...table.idsByOwnerKey, [`event:${event.id}`]: members.map(m => m.id) } } };
      });
    }
    const counters = new Map([...affectedUsers].map(id => [id, this.events.queryUserEventCounterSnapshot(id)]));
    if (counters.size) this.db.write(current => ({ ...current, users: { ...current.users, byId: {
      ...current.users.byId, ...Object.fromEntries([...counters].map(([id, eventCounters]) => [id, {
        ...current.users.byId[id], activities: { ...current.users.byId[id].activities, ...eventCounters }
      }]))
    } } }));
  }
}
