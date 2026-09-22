import type { AppMemorySchema } from '../../common/memory.schema';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { UserProfileState } from '../../../common/user-profile-state';

export function isCurrentFollowedEvent(record: ActivityEventRecord, viewer: string, now: number): boolean {
  return record.status === 'A' && !record.generated && !record.parentEventId
    && record.eventType !== 'tournament-room'
    && record.creatorUserId !== viewer && record.visibility !== 'Invitation only'
    && (record.visibility !== 'Friends only' || UserProfileState.isFriendOfActiveUser(record.creatorUserId, viewer))
    && Date.parse(record.endAtIso || record.startAtIso) > now;
}

/** Pure write-side maintenance; never used to reconstruct a badge in a read adapter. */
export function maintainFollowingState(previous: AppMemorySchema, next: AppMemorySchema, now = Date.now()): AppMemorySchema {
  const eventsChanged = previous[EVENTS_TABLE_NAME] !== next[EVENTS_TABLE_NAME];
  const users = next[USERS_TABLE_NAME];
  let byId = users.byId;
  for (const user of Object.values(users.byId)) {
    const following = user.following;
    if (!following) continue;
    const due = !!following.nextExpiryAtIso && Date.parse(following.nextExpiryAtIso) <= now;
    if (!eventsChanged && previous[USERS_TABLE_NAME].byId[user.id]?.following === following && !due) continue;
    const organizers = new Set(following.organizerIds);
    const events = new Map<string, ActivityEventRecord>();
    for (const record of Object.values(next[EVENTS_TABLE_NAME].byId)) {
      if (organizers.has(record.creatorUserId) && isCurrentFollowedEvent(record, user.id, now)) events.set(record.id, record);
    }
    const boundaries = [...events.values()].map(event => Date.parse(event.endAtIso || event.startAtIso));
    if (byId === users.byId) byId = { ...byId };
    byId[user.id] = { ...user, following: { ...following, eventCount: events.size,
      nextExpiryAtIso: boundaries.length ? new Date(Math.min(...boundaries)).toISOString() : null } };
  }
  return byId === users.byId ? next : { ...next, [USERS_TABLE_NAME]: { ...users, byId } };
}
