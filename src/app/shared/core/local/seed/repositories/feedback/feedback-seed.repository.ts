import { ActivityMembersBuilder } from '../../../../base/builders/events/activity-members.builder';
import { FEEDBACK_STATES_TABLE_NAME } from '../../../source/entity/feedback/feedback.entity';
import type { FeedbackStateRecord } from '../../../source/entity/feedback/feedback.entity';
import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../../common/app-static-data';
import { LocalMemoryDb } from '../../../../common/app.db';
import { ACTIVITY_MEMBERS_TABLE_NAME, type ActivityMemberRecord } from '../../../source/entity/common/activity.entity';
import type { UserRecord } from '../../../source/entity/accounts/user.entity';
import type { ActivityEventRecord } from '../../../../contracts/common/activity.interface';
import { SeedFeedbackBuilder } from '../../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedFeedbackRepository {
  private static readonly FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private static readonly ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT = 3;

  private readonly memoryDb = inject(LocalMemoryDb);

  seedDefaults(
    seedUsers: readonly UserRecord[],
    eventItemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    itemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): boolean {
    const users = [...seedUsers];
    if (users.length === 0) {
      return false;
    }

    const currentTable = this.memoryDb.read()[FEEDBACK_STATES_TABLE_NAME];
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;

    for (const activeUser of users) {
      const eventRecords = [...(eventItemsByUserId.get(activeUser.id) ?? [])];
      if (eventRecords.length === 0) {
        continue;
      }
      const seededRecords = SeedFeedbackBuilder.buildSeededPersistedStates({
        eventRecords,
        users,
        activeUser,
        feedbackUnlockDelayMs: SeedFeedbackRepository.FEEDBACK_UNLOCK_DELAY_MS,
        eventOverallOptions: APP_STATIC_DATA.feedbackEventOverallOptions,
        hostImproveOptions: APP_STATIC_DATA.feedbackHostImproveOptions,
        attendeeCollabOptions: APP_STATIC_DATA.feedbackAttendeeCollabOptions,
        attendeeRejoinOptions: APP_STATIC_DATA.feedbackAttendeeRejoinOptions,
        personalityTraitOptions: APP_STATIC_DATA.feedbackPersonalityTraitOptions
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
      return false;
    }

    this.memoryDb.write(state => ({
      ...state,
      [FEEDBACK_STATES_TABLE_NAME]: {
        byId: nextById,
        ids: nextIds
      }
    }));
    return true;
  }

  private seedOrganizerFeedbackShowcaseRecords(
    users: UserRecord[],
    nextById: Record<string, FeedbackStateRecord>,
    nextIds: string[],
    itemsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): boolean {
    const usersById = new Map(users.map(user => [user.id, user]));
    const hostedEventById = new Map<string, ActivityEventRecord>();
    let changed = false;

    for (const user of users) {
      for (const record of itemsByUserId.get(user.id) ?? []) {
        const eventId = record.id?.trim() ?? '';
        if (!eventId || !this.isEventAdminRecord(record, user.id) || record.status === 'T') {
          continue;
        }
        const current = hostedEventById.get(eventId);
        if (
          !current
          || (!this.isPublishedEventStatus(current.status) && this.isPublishedEventStatus(record.status))
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
      if (visibleEntryCount >= SeedFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
        continue;
      }

      const feedbackEventSnapshot = this.toFeedbackEventSnapshotForViewers(record, viewerUserIds);
      for (const viewerUserId of viewerUserIds) {
        if (visibleEntryCount >= SeedFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
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
        const seededRecord = SeedFeedbackBuilder.buildSeededSubmittedState({
          eventRecord: feedbackEventSnapshot,
          users,
          activeUser: viewer,
          feedbackUnlockDelayMs: SeedFeedbackRepository.FEEDBACK_UNLOCK_DELAY_MS,
          eventOverallOptions: APP_STATIC_DATA.feedbackEventOverallOptions,
          hostImproveOptions: APP_STATIC_DATA.feedbackHostImproveOptions,
          attendeeCollabOptions: APP_STATIC_DATA.feedbackAttendeeCollabOptions,
          attendeeRejoinOptions: APP_STATIC_DATA.feedbackAttendeeRejoinOptions,
          personalityTraitOptions: APP_STATIC_DATA.feedbackPersonalityTraitOptions,
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

  private hasOrganizerVisibleFeedback(record: FeedbackStateRecord | undefined): boolean {
    if (!record) {
      return false;
    }
    return Boolean(record.organizerNote?.trim()) || Object.keys(record.answersByCardId ?? {}).length > 0;
  }

  private organizerFeedbackShowcaseViewerUserIds(
    record: ActivityEventRecord,
    users: readonly UserRecord[],
    hostUserId: string,
    usersById: ReadonlyMap<string, UserRecord>
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
    for (let index = 0; index < candidates.length && selected.length < SeedFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT; index += 1) {
      const candidate = candidates[(seed + (index * 5)) % candidates.length];
      if (!candidate || selected.includes(candidate)) {
        continue;
      }
      selected.push(candidate);
    }
    return selected;
  }

  private toFeedbackEventSnapshotForViewers(record: ActivityEventRecord, viewerUserIds: readonly string[] = []): ActivityEventRecord {
    const summary = this.activityMemberSummaryByOwner('event', record.id);
    const acceptedMemberUserIds = [...new Set([
      ...(summary.acceptedMemberUserIds ?? []),
      ...viewerUserIds
    ].map(userId => `${userId}`.trim()).filter(Boolean))];
    const pendingMemberUserIds = (summary.pendingMemberUserIds ?? [])
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    return {
      ...record,
      activity: 0,
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
      hash |= 0; // NOSONAR S7767: intentional signed 32-bit overflow for stable seed IDs; Math.trunc changes the hash.
    }
    return Math.abs(hash);
  }

  private isPublishedEventStatus(status: ActivityEventRecord['status'] | null | undefined): boolean {
    return `${status ?? 'A'}`.trim() === 'A';
  }

  private isEventAdminRecord(record: ActivityEventRecord, userId: string): boolean {
    return ActivityMembersBuilder.isEventAdminRecord(record, userId);
  }

  private normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    return ActivityMembersBuilder.normalizeUserIds(userIds);
  }
}
