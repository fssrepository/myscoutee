import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { LocalMemoryDb } from '../../base/db';
import type { UserDto } from '../../contracts/user.interface';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMemberRecord
} from '../../local/entity/activity.entity';
import type { ActivityEventSeedItem } from '../../base/models/event-seed-item.model';
import { EVENT_FEEDBACK_TABLE_NAME } from '../../base/models/event-feedback.model';
import type {
  EventFeedbackPersistedState
} from '../../base/models';
import type { ActivityEventRecord } from '../../base/models/events.model';
import { SeedEventFeedbackBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedEventFeedbackRepository {
  private static readonly EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private static readonly ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT = 3;

  private readonly memoryDb = inject(LocalMemoryDb);

  seedDefaults(
    seedUsers: readonly UserDto[],
    eventItemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    itemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): void {
    const users = [...seedUsers];
    if (users.length === 0) {
      return;
    }

    const currentTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;

    for (const activeUser of users) {
      const eventRecords = [...(eventItemsByUserId.get(activeUser.id) ?? [])];
      if (eventRecords.length === 0) {
        continue;
      }
      const seededRecords = SeedEventFeedbackBuilder.buildSeededPersistedStates({
        eventItems: eventRecords.map(record => this.toDemoEventSeedItem(record)),
        users,
        activeUser,
        eventDatesById: Object.fromEntries(eventRecords.map(record => [record.id, record.startAtIso])),
        activityImageById: Object.fromEntries(eventRecords.map(record => [record.id, record.imageUrl ?? ''])),
        eventFeedbackUnlockDelayMs: SeedEventFeedbackRepository.EVENT_FEEDBACK_UNLOCK_DELAY_MS,
        eventOverallOptions: APP_STATIC_DATA.eventFeedbackEventOverallOptions,
        hostImproveOptions: APP_STATIC_DATA.eventFeedbackHostImproveOptions,
        attendeeCollabOptions: APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions,
        attendeeRejoinOptions: APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions,
        personalityTraitOptions: APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions
      });

      for (const record of seededRecords) {
        if (nextById[record.id]) {
          continue;
        }
        nextById[record.id] = {
          ...record,
          answersByCardId: { ...(record.answersByCardId ?? {}) }
        };
        nextIds.push(record.id);
        changed = true;
      }
    }

    if (this.seedOrganizerFeedbackShowcaseRecords(users, nextById, nextIds, itemsByUserId)) {
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.memoryDb.write(state => ({
      ...state,
      [EVENT_FEEDBACK_TABLE_NAME]: {
        byId: nextById,
        ids: nextIds
      }
    }));
  }

  private seedOrganizerFeedbackShowcaseRecords(
    users: UserDto[],
    nextById: Record<string, EventFeedbackPersistedState>,
    nextIds: string[],
    itemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): boolean {
    const usersById = new Map(users.map(user => [user.id, user]));
    const hostedEventById = new Map<string, ActivityEventRecord>();
    let changed = false;

    for (const user of users) {
      for (const record of itemsByUserId.get(user.id) ?? []) {
        const eventId = record.id?.trim() ?? '';
        if (!eventId || record.isAdmin !== true || record.isInvitation || record.isTrashed) {
          continue;
        }
        const current = hostedEventById.get(eventId);
        if (
          !current
          || (current.type !== 'hosting' && record.type === 'hosting')
          || (current.published === false && record.published !== false)
        ) {
          hostedEventById.set(eventId, record);
        }
      }
    }

    for (const record of hostedEventById.values()) {
      const hostUserId = record.creatorUserId?.trim() || record.userId?.trim();
      const hostUser = hostUserId ? usersById.get(hostUserId) : null;
      if (!hostUser) {
        continue;
      }

      const viewerUserIds = this.organizerFeedbackShowcaseViewerUserIds(record, users, hostUser.id, usersById);
      if (viewerUserIds.length === 0) {
        continue;
      }

      let visibleEntryCount = viewerUserIds.filter(userId =>
        this.hasOrganizerVisibleFeedback(nextById[`${userId}::${record.id}`])
      ).length;
      if (visibleEntryCount >= SeedEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
        continue;
      }

      const feedbackItem = this.toFeedbackViewerDemoEventSeedItem(record, viewerUserIds);
      for (const viewerUserId of viewerUserIds) {
        if (visibleEntryCount >= SeedEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
          break;
        }
        const existingRecord = nextById[`${viewerUserId}::${record.id}`];
        if (this.hasOrganizerVisibleFeedback(existingRecord)) {
          continue;
        }
        const viewer = usersById.get(viewerUserId);
        if (!viewer) {
          continue;
        }
        const seededRecord = SeedEventFeedbackBuilder.buildSeededSubmittedState({
          eventItem: feedbackItem,
          users,
          activeUser: viewer,
          eventDatesById: {
            [record.id]: record.startAtIso
          },
          activityImageById: {
            [record.id]: record.imageUrl ?? ''
          },
          eventFeedbackUnlockDelayMs: SeedEventFeedbackRepository.EVENT_FEEDBACK_UNLOCK_DELAY_MS,
          eventOverallOptions: APP_STATIC_DATA.eventFeedbackEventOverallOptions,
          hostImproveOptions: APP_STATIC_DATA.eventFeedbackHostImproveOptions,
          attendeeCollabOptions: APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions,
          attendeeRejoinOptions: APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions,
          personalityTraitOptions: APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions,
          seedKey: `organizer-showcase:${record.id}:${viewerUserId}`
        });
        if (!seededRecord) {
          continue;
        }
        nextById[seededRecord.id] = {
          ...seededRecord,
          answersByCardId: { ...(seededRecord.answersByCardId ?? {}) }
        };
        if (!nextIds.includes(seededRecord.id)) {
          nextIds.push(seededRecord.id);
        }
        visibleEntryCount += 1;
        changed = true;
      }
    }

    return changed;
  }

  private hasOrganizerVisibleFeedback(record: EventFeedbackPersistedState | undefined): boolean {
    if (!record) {
      return false;
    }
    return Boolean(record.organizerNote?.trim()) || Object.keys(record.answersByCardId ?? {}).length > 0;
  }

  private organizerFeedbackShowcaseViewerUserIds(
    record: ActivityEventRecord,
    users: readonly UserDto[],
    hostUserId: string,
    usersById: ReadonlyMap<string, UserDto>
  ): string[] {
    const summary = this.activityMemberSummaryByOwner('event', record.id);
    const memberUserIds = [...new Set([
      ...(summary.acceptedMemberUserIds ?? []),
      ...(summary.pendingMemberUserIds ?? [])
    ].map(userId => `${userId}`.trim()).filter(Boolean))]
      .filter(userId => userId !== hostUserId && usersById.has(userId));
    if (memberUserIds.length > 0) {
      return memberUserIds;
    }

    const candidates = users
      .map(user => user.id.trim())
      .filter(userId => userId && userId !== hostUserId);
    if (candidates.length === 0) {
      return [];
    }

    const seed = this.hashText(`organizer-feedback-viewers:${record.id}`);
    const selected: string[] = [];
    for (let index = 0; index < candidates.length && selected.length < SeedEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT; index += 1) {
      const candidate = candidates[(seed + (index * 5)) % candidates.length];
      if (!candidate || selected.includes(candidate)) {
        continue;
      }
      selected.push(candidate);
    }
    return selected;
  }

  private toFeedbackViewerDemoEventSeedItem(record: ActivityEventRecord, viewerUserIds: readonly string[] = []): ActivityEventSeedItem {
    const summary = this.activityMemberSummaryByOwner('event', record.id);
    const acceptedMemberUserIds = [...new Set([
      ...(summary.acceptedMemberUserIds ?? []),
      ...viewerUserIds
    ].map(userId => `${userId}`.trim()).filter(Boolean))];
    const pendingMemberUserIds = (summary.pendingMemberUserIds ?? [])
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    return {
      ...this.toDemoEventSeedItem(record),
      activity: 0,
      isAdmin: false,
      acceptedMembers: Math.max(record.acceptedMembers, acceptedMemberUserIds.length),
      capacityTotal: Math.max(record.capacityTotal, acceptedMemberUserIds.length),
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
  }

  private activityMemberSummaryByOwner(ownerType: 'event' | 'asset', ownerId: string): {
    acceptedMemberUserIds: string[];
    pendingMemberUserIds: string[];
  } {
    const ownerKey = `${ownerType}:${ownerId.trim()}`;
    const table = this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    const records = (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record));
    return {
      acceptedMemberUserIds: records
        .filter(record => record.status === 'accepted')
        .map(record => record.userId),
      pendingMemberUserIds: records
        .filter(record => record.status === 'pending')
        .map(record => record.userId)
    };
  }

  private hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private toDemoEventSeedItem(record: ActivityEventRecord): ActivityEventSeedItem {
    return {
      id: record.id,
      avatar: record.creatorInitials,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: record.isAdmin,
      creatorUserId: record.creatorUserId,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      capacityTotal: record.capacityTotal,
      visibility: record.visibility,
      blindMode: record.blindMode,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      ticketing: record.ticketing,
      topics: [...record.topics],
      rating: record.rating,
      boost: record.boost,
      published: record.published
    };
  }
}
