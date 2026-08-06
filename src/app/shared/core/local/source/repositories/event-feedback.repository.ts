import type { EventFeedbackPersistedState, EventFeedbackStatRecord } from '../entity/event.entity';
import { EVENT_FEEDBACK_TABLE_NAME, EVENTS_TABLE_NAME } from '../entity/event.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import type { AppMemorySchema } from '../../common/memory.schema';
import { EventFeedbackDetailDto } from '../../../contracts/activity.interface';
import type {
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto
} from '../../../contracts/activity.interface';


import { LocalEventsRepository } from './events.repository';
import { LocalUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalEventFeedbackRepository {
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

  queryReceivedEventFeedback(userId: string, ownedEventIdsInput?: Iterable<string>): EventFeedbackReceivedEventDto[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ownedEventIds = this.ownedEventIds(normalizedUserId, ownedEventIdsInput);
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

  queryReceivedEventFeedbackStatRecords(userId: string, eventId: string): EventFeedbackStatRecord[] {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return [];
    }
    const ownedEventIds = this.ownedEventIds(normalizedUserId);
    if (!ownedEventIds.has(normalizedEventId)) {
      return [];
    }

    const table = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const records: EventFeedbackStatRecord[] = [];
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.userId === normalizedUserId || record.eventId !== normalizedEventId) {
        continue;
      }
      const answers = Object.values(this.cloneEventFeedbackAnswersByCardId(record.answersByCardId));
      const organizerNote = record.organizerNote.trim();
      if (!organizerNote && answers.length === 0) {
        continue;
      }
      const eventAnswer = answers.find(answer => answer.kind === 'event') ?? null;
      records.push({
        eventId: normalizedEventId,
        viewerUserId: record.userId,
        submittedAtIso: record.submittedAtIso ?? eventAnswer?.submittedAtIso ?? '',
        updatedAtIso: record.submittedAtIso ?? eventAnswer?.submittedAtIso ?? '',
        overallValue: eventAnswer?.primaryValue?.trim() ?? '',
        improveValue: eventAnswer?.secondaryValue?.trim() ?? '',
        personalityTraitIds: (eventAnswer?.personalityTraitIds ?? [])
          .map(traitId => traitId.trim())
          .filter(Boolean)
      });
    }

    return records.sort((left, right) =>
      (right.updatedAtIso || right.submittedAtIso).localeCompare(left.updatedAtIso || left.submittedAtIso)
    );
  }

  submitEventFeedback(userId: string, request: EventFeedbackDetailDto): void {
    const feedback = new EventFeedbackDetailDto(request);
    const normalizedUserId = userId.trim();
    const normalizedEventId = feedback.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    const submittedAtIso = feedback.submittedAtIso || new Date().toISOString();
    const nextAnswersByCardId: Record<string, EventFeedbackPersistedState['answersByCardId'][string]> = {};
    for (const card of feedback.cards) {
      const cardId = card.id.trim();
      if (!cardId) {
        continue;
      }
      const eventComment = card.kind === 'event' ? card.eventComment?.trim() ?? '' : '';
      if ([...eventComment].length > 160) {
        throw new Error('Event feedback comments may contain at most 160 characters.');
      }
      nextAnswersByCardId[cardId] = {
        cardId,
        eventId: normalizedEventId,
        kind: card.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: card.targetUserId?.trim() || null,
        targetRole: card.targetRole === 'Admin' || card.targetRole === 'Manager' ? card.targetRole : 'Member',
        primaryValue: card.answerPrimary?.trim() ?? '',
        secondaryValue: card.answerSecondary?.trim() ?? '',
        eventComment,
        personalityTraitIds: (card.selectedTraitIds ?? []).map(traitId => traitId.trim()).filter(Boolean),
        tags: [],
        submittedAtIso
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

  private ownedEventIds(userId: string, ownedEventIdsInput?: Iterable<string>): Set<string> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return new Set<string>();
    }
    if (ownedEventIdsInput) {
      return new Set([...ownedEventIdsInput].map(eventId => eventId.trim()).filter(Boolean));
    }
    return new Set(
      this.eventsRepository.queryItemsByUser(normalizedUserId)
        .filter(record =>
          record.type !== 'invitations'
          && record.status !== 'T'
          && (
            record.creatorUserId === normalizedUserId
            || (record.adminIds ?? []).includes(normalizedUserId)
          )
        )
        .map(record => record.id.trim())
        .filter(Boolean)
    );
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
      const feedbackDeltas = new Map<string, FeedbackCounterDelta>();
      const previousBucket = this.feedbackBucket(existing);
      const nextBucket = this.feedbackBucket(nextRecord);
      if (previousBucket !== nextBucket) {
        this.addFeedbackCounterDelta(feedbackDeltas, normalizedUserId, previousBucket, -1);
        this.addFeedbackCounterDelta(feedbackDeltas, normalizedUserId, nextBucket, 1);
      }
      const wasActiveSubmission = Boolean(existing.submittedAtIso?.trim()) && !existing.removed;
      const isActiveSubmission = Boolean(nextRecord.submittedAtIso?.trim()) && !nextRecord.removed;
      if (wasActiveSubmission !== isActiveSubmission) {
        const ownEventDelta = isActiveSubmission ? 1 : -1;
        for (const ownerUserId of this.feedbackAdminUserIds(current, normalizedEventId)) {
          this.addFeedbackCounterDelta(feedbackDeltas, ownerUserId, 'ownEvents', ownEventDelta);
        }
      }
      return {
        ...current,
        [EVENT_FEEDBACK_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordId]: nextRecord
          },
          ids: table.ids.includes(recordId) ? table.ids : [...table.ids, recordId]
        },
        [USERS_TABLE_NAME]: this.applyFeedbackCounterDeltas(current[USERS_TABLE_NAME], feedbackDeltas)
      };
    });
  }

  private feedbackBucket(record: EventFeedbackPersistedState): FeedbackCounterBucket {
    if (record.removed) {
      return 'removed';
    }
    return record.submittedAtIso?.trim() ? 'feedbacked' : 'pending';
  }

  private feedbackAdminUserIds(state: AppMemorySchema, eventId: string): string[] {
    const userIds = new Set<string>();
    const eventsTable = state[EVENTS_TABLE_NAME];
    for (const recordId of eventsTable.ids) {
      const event = eventsTable.byId[recordId];
      if (!event || event.id.trim() !== eventId) {
        continue;
      }
      const creatorUserId = event.creatorUserId?.trim();
      if (creatorUserId) {
        userIds.add(creatorUserId);
      }
      for (const adminUserId of event.adminIds ?? []) {
        const normalizedAdminUserId = adminUserId.trim();
        if (normalizedAdminUserId) {
          userIds.add(normalizedAdminUserId);
        }
      }
    }
    return [...userIds];
  }

  private addFeedbackCounterDelta(
    deltas: Map<string, FeedbackCounterDelta>,
    userId: string,
    bucket: FeedbackCounterBucket,
    amount: number
  ): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || amount === 0) {
      return;
    }
    const current = deltas.get(normalizedUserId) ?? this.emptyFeedbackCounterDelta();
    deltas.set(normalizedUserId, {
      ...current,
      [bucket]: current[bucket] + amount
    });
  }

  private applyFeedbackCounterDeltas(
    usersTable: AppMemorySchema[typeof USERS_TABLE_NAME],
    deltas: ReadonlyMap<string, FeedbackCounterDelta>
  ): AppMemorySchema[typeof USERS_TABLE_NAME] {
    if (deltas.size === 0) {
      return usersTable;
    }
    const byId = { ...usersTable.byId };
    for (const [userId, delta] of deltas) {
      const user = byId[userId];
      if (!user) {
        continue;
      }
      byId[userId] = this.withFeedbackCounterDelta(user, delta);
    }
    return { ...usersTable, byId };
  }

  private withFeedbackCounterDelta(user: UserRecord, delta: FeedbackCounterDelta): UserRecord {
    const current = user.activities.eventFeedback;
    const ownEvents = this.counter(current?.ownEvents) + delta.ownEvents;
    const pending = this.counter(current?.pending) + delta.pending;
    const feedbacked = this.counter(current?.feedbacked) + delta.feedbacked;
    const removed = this.counter(current?.removed) + delta.removed;
    const nextOwnEvents = Math.max(0, ownEvents);
    const nextPending = Math.max(0, pending);
    return {
      ...user,
      activities: {
        ...user.activities,
        feedback: nextPending + nextOwnEvents,
        eventFeedback: {
          ownEvents: nextOwnEvents,
          pending: nextPending,
          feedbacked: Math.max(0, feedbacked),
          removed: Math.max(0, removed)
        }
      }
    };
  }

  private counter(value: number | null | undefined): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private emptyFeedbackCounterDelta(): FeedbackCounterDelta {
    return { ownEvents: 0, pending: 0, feedbacked: 0, removed: 0 };
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
        eventComment: answer.kind === 'event' ? answer.eventComment?.trim() ?? '' : '',
        personalityTraitIds: (answer.personalityTraitIds ?? []).map(traitId => traitId.trim()).filter(Boolean),
        tags: (answer.tags ?? []).map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso?.trim() ?? ''
      };
    }
    return next;
  }
}

type FeedbackCounterBucket = 'ownEvents' | 'pending' | 'feedbacked' | 'removed';

interface FeedbackCounterDelta {
  ownEvents: number;
  pending: number;
  feedbacked: number;
  removed: number;
}
