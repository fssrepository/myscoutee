import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import { LocalMemoryDb } from '../../base/db';
import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  EventFeedbackPersistedState,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../../core/base/models';
import { LocalEventFeedbackBuilder } from '../builders';
import type { ActivityEventSeedItem } from '../../base/models/event-seed-item.model';
import { EVENT_FEEDBACK_TABLE_NAME } from '../../base/models/event-feedback.model';
import type { ActivityEventRecord } from '../../base/models/events.model';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalEventFeedbackRepository {
  private static readonly EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private static readonly ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT = 3;
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryEventFeedbackStates(userId: string): EventFeedbackStateDto[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readEventFeedbackStates(normalizedUserId).map(record => ({
      eventId: record.eventId,
      removed: record.removed,
      submittedAtIso: record.submittedAtIso ?? '',
      removedAtIso: record.removedAtIso ?? '',
      organizerNote: record.organizerNote,
      answersByCardId: this.cloneEventFeedbackAnswersByCardId(record.answersByCardId)
    }));
  }

  queryReceivedEventFeedback(userId: string): EventFeedbackReceivedEventDto[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ownedEventIds = new Set(
      this.eventsRepository.queryItemsByUser(normalizedUserId)
        .filter(record => record.isAdmin === true && !record.isInvitation && !record.isTrashed)
        .map(record => record.id.trim())
        .filter(Boolean)
    );
    if (ownedEventIds.size === 0) {
      return [];
    }

    const table = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const byEventId = new Map<string, EventFeedbackReceivedEventDto['entries']>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.userId === normalizedUserId || !ownedEventIds.has(record.eventId)) {
        continue;
      }
      const answers = Object.values(this.cloneEventFeedbackAnswersByCardId(record.answersByCardId));
      const organizerNote = record.organizerNote.trim();
      if (!organizerNote && answers.length === 0) {
        continue;
      }
      const viewer = this.usersRepository.queryUserById(record.userId);
      const entries = byEventId.get(record.eventId) ?? [];
      entries.push({
        viewerUserId: record.userId,
        viewerName: viewer?.name?.trim() || record.userId,
        viewerInitials: viewer?.initials?.trim() || AppUtils.initialsFromText(viewer?.name?.trim() || record.userId),
        viewerGender: (viewer?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
        viewerImageUrl: AppUtils.firstImageUrl(viewer?.images),
        eventId: record.eventId,
        submittedAtIso: record.submittedAtIso ?? '',
        updatedAtIso: record.submittedAtIso ?? '',
        organizerNote,
        answers
      });
      byEventId.set(record.eventId, entries);
    }

    return [...byEventId.entries()]
      .map(([eventId, entries]) => ({
        eventId,
        entries: [...entries].sort((left, right) =>
          (right.updatedAtIso || right.submittedAtIso).localeCompare(left.updatedAtIso || left.submittedAtIso)
        )
      }))
      .sort((left, right) => right.eventId.localeCompare(left.eventId));
  }

  submitEventFeedback(request: EventFeedbackSubmitRequestDto): void {
    const normalizedUserId = request.userId.trim();
    const normalizedEventId = request.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    const submittedAtIso = request.answers
      .map(answer => answer.submittedAtIso.trim())
      .find(Boolean) ?? new Date().toISOString();
    const nextAnswersByCardId: Record<string, EventFeedbackPersistedState['answersByCardId'][string]> = {};
    for (const answer of request.answers) {
      const cardId = answer.cardId.trim();
      if (!cardId) {
        continue;
      }
      nextAnswersByCardId[cardId] = {
        cardId,
        eventId: normalizedEventId,
        kind: answer.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: answer.targetUserId?.trim() || null,
        targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
        primaryValue: answer.primaryValue.trim(),
        secondaryValue: answer.secondaryValue.trim(),
        personalityTraitIds: answer.personalityTraitIds.map(traitId => traitId.trim()).filter(Boolean),
        tags: answer.tags.map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso.trim() || submittedAtIso
      };
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false,
      removedAtIso: null,
      submittedAtIso,
      answersByCardId: {
        ...current.answersByCardId,
        ...nextAnswersByCardId
      }
    }));
  }

  saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): void {
    const normalizedUserId = request.userId.trim();
    const normalizedEventId = request.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      organizerNote: request.text.trim()
    }));
  }

  removeEventFeedbackEvent(userId: string, eventId: string): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: true,
      removedAtIso: new Date().toISOString()
    }));
  }

  restoreEventFeedbackEvent(userId: string, eventId: string): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false,
      removedAtIso: null
    }));
  }

  seedEventFeedbackStates(
    seedUsers?: readonly UserDto[],
    eventItemsByUserId?: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    itemsByUserId?: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): void {
    const users = seedUsers?.length ? [...seedUsers] : this.usersRepository.queryAllUsers();
    if (users.length === 0) {
      return;
    }

    const currentTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;

    for (const activeUser of users) {
      const eventRecords = [
        ...(eventItemsByUserId?.get(activeUser.id) ?? this.eventsRepository.queryEventItemsByUser(activeUser.id))
      ];
      if (eventRecords.length === 0) {
        continue;
      }
      const seededRecords = LocalEventFeedbackBuilder.buildSeededPersistedStates({
        eventItems: eventRecords.map(record => this.toDemoEventSeedItem(record)),
        users,
        activeUser,
        eventDatesById: Object.fromEntries(eventRecords.map(record => [record.id, record.startAtIso])),
        activityImageById: Object.fromEntries(eventRecords.map(record => [record.id, record.imageUrl ?? ''])),
        eventFeedbackUnlockDelayMs: LocalEventFeedbackRepository.EVENT_FEEDBACK_UNLOCK_DELAY_MS,
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
    itemsByUserId?: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): boolean {
    const usersById = new Map(users.map(user => [user.id, user]));
    const hostedEventById = new Map<string, ActivityEventRecord>();
    let changed = false;

    for (const user of users) {
      for (const record of itemsByUserId?.get(user.id) ?? this.eventsRepository.queryItemsByUser(user.id)) {
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
      if (visibleEntryCount >= LocalEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
        continue;
      }

      const feedbackItem = this.toFeedbackViewerDemoEventSeedItem(record, viewerUserIds);
      for (const viewerUserId of viewerUserIds) {
        if (visibleEntryCount >= LocalEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT) {
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
        const seededRecord = LocalEventFeedbackBuilder.buildSeededSubmittedState({
          eventItem: feedbackItem,
          users,
          activeUser: viewer,
          eventDatesById: {
            [record.id]: record.startAtIso
          },
          activityImageById: {
            [record.id]: record.imageUrl ?? ''
          },
          eventFeedbackUnlockDelayMs: LocalEventFeedbackRepository.EVENT_FEEDBACK_UNLOCK_DELAY_MS,
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
    const summary = this.activityMembersRepository.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: record.id
    });
    const memberUserIds = [...new Set([
      ...(summary?.acceptedMemberUserIds ?? []),
      ...(summary?.pendingMemberUserIds ?? [])
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
    for (let index = 0; index < candidates.length && selected.length < LocalEventFeedbackRepository.ORGANIZER_FEEDBACK_SHOWCASE_TARGET_COUNT; index += 1) {
      const candidate = candidates[(seed + (index * 5)) % candidates.length];
      if (!candidate || selected.includes(candidate)) {
        continue;
      }
      selected.push(candidate);
    }
    return selected;
  }

  private toFeedbackViewerDemoEventSeedItem(record: ActivityEventRecord, viewerUserIds: readonly string[] = []): ActivityEventSeedItem {
    const summary = this.activityMembersRepository.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: record.id
    });
    const acceptedMemberUserIds = [...new Set([
      ...(summary?.acceptedMemberUserIds ?? []),
      ...viewerUserIds
    ].map(userId => `${userId}`.trim()).filter(Boolean))];
    const pendingMemberUserIds = (summary?.pendingMemberUserIds ?? [])
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

  private readEventFeedbackStates(userId: string): EventFeedbackPersistedState[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is EventFeedbackPersistedState => Boolean(record) && record.userId === normalizedUserId)
      .map(record => ({
        ...record,
        answersByCardId: this.cloneEventFeedbackAnswersByCardId(record.answersByCardId)
      }));
  }

  private updateEventFeedbackState(
    userId: string,
    eventId: string,
    updater: (current: EventFeedbackPersistedState) => EventFeedbackPersistedState
  ): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.memoryDb.write(current => {
      const table = current[EVENT_FEEDBACK_TABLE_NAME];
      const recordId = this.eventFeedbackStateRecordId(normalizedUserId, normalizedEventId);
      const existing = table.byId[recordId] ?? this.createEmptyEventFeedbackState(normalizedUserId, normalizedEventId);
      const nextRecord = updater({
        ...existing,
        answersByCardId: this.cloneEventFeedbackAnswersByCardId(existing.answersByCardId)
      });
      return {
        ...current,
        [EVENT_FEEDBACK_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordId]: nextRecord
          },
          ids: table.ids.includes(recordId) ? table.ids : [...table.ids, recordId]
        }
      };
    });
  }

  private createEmptyEventFeedbackState(userId: string, eventId: string): EventFeedbackPersistedState {
    return {
      id: this.eventFeedbackStateRecordId(userId, eventId),
      userId,
      eventId,
      removed: false,
      submittedAtIso: null,
      removedAtIso: null,
      organizerNote: '',
      answersByCardId: {}
    };
  }

  private eventFeedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

  private cloneEventFeedbackAnswersByCardId(
    answersByCardId: EventFeedbackPersistedState['answersByCardId'] | undefined
  ): EventFeedbackPersistedState['answersByCardId'] {
    const next: EventFeedbackPersistedState['answersByCardId'] = {};
    for (const [cardId, answer] of Object.entries(answersByCardId ?? {})) {
      const normalizedCardId = cardId.trim();
      if (!normalizedCardId || !answer) {
        continue;
      }
      next[normalizedCardId] = {
        ...answer,
        cardId: answer.cardId?.trim() || normalizedCardId,
        eventId: answer.eventId?.trim() ?? '',
        kind: answer.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: answer.targetUserId?.trim() || null,
        targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
        primaryValue: answer.primaryValue?.trim() ?? '',
        secondaryValue: answer.secondaryValue?.trim() ?? '',
        personalityTraitIds: (answer.personalityTraitIds ?? []).map(traitId => traitId.trim()).filter(Boolean),
        tags: (answer.tags ?? []).map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso?.trim() ?? ''
      };
    }
    return next;
  }
}
