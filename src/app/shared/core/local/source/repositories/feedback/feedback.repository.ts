import { LocalMingleRepository } from '../events/mingle.repository';
import type { ActivityEventRecord } from '../../../../contracts/common/activity.interface';
import type { FeedbackStateRecord, FeedbackStatRecord } from '../../entity/feedback/feedback.entity';
import { FEEDBACK_STATES_TABLE_NAME } from '../../entity/feedback/feedback.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../../entity/accounts/user.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../base/app-utils';
import { LocalMemoryDb } from '../../../../common/app.db';
import type { AppMemorySchema } from '../../../common/memory.schema';
import { FeedbackDetailDto } from '../../../../contracts/feedback/feedback.interface';
import type { FeedbackReceivedEventDto, FeedbackNoteRequestDto, FeedbackStateDto } from '../../../../contracts/feedback/feedback.interface';


import { LocalEventsRepository } from '../events/events.repository';
import { LocalUsersRepository } from '../accounts/users.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalFeedbackRepository {
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly mingleRepository = inject(LocalMingleRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly memoryDb = inject(LocalMemoryDb);

  queryMinglePeers(userId: string, events: readonly ActivityEventRecord[]): Record<string, string[]> {
    return this.mingleRepository.completedPeers(userId, events.filter(event => event.mode === 'Mingle').map(event => event.id));
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryFeedbackStates(userId: string): FeedbackStateDto[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readFeedbackStates(normalizedUserId).map(record => ({
      eventId: record.eventId,
      removed: record.removed,
      submittedAtIso: record.submittedAtIso ?? '',
      removedAtIso: record.removedAtIso ?? '',
      organizerNote: record.organizerNote,
      answersByCardId: this.cloneFeedbackAnswersByCardId(record.answersByCardId)
    }));
  }

  queryReceivedFeedback(userId: string, ownedEventIdsInput?: Iterable<string>): FeedbackReceivedEventDto[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ownedEventIds = this.ownedEventIds(normalizedUserId, ownedEventIdsInput);
    if (ownedEventIds.size === 0) {
      return [];
    }

    const table = this.memoryDb.read()[FEEDBACK_STATES_TABLE_NAME];
    const byEventId = new Map<string, FeedbackReceivedEventDto['entries']>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.userId === normalizedUserId || !ownedEventIds.has(record.eventId)) {
        continue;
      }
      const answers = Object.values(this.cloneFeedbackAnswersByCardId(record.answersByCardId));
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

  queryReceivedFeedbackStatRecords(userId: string, eventId: string): FeedbackStatRecord[] {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return [];
    }
    const ownedEventIds = this.ownedEventIds(normalizedUserId);
    if (!ownedEventIds.has(normalizedEventId)) {
      return [];
    }

    const table = this.memoryDb.read()[FEEDBACK_STATES_TABLE_NAME];
    const records: FeedbackStatRecord[] = [];
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.userId === normalizedUserId || record.eventId !== normalizedEventId) {
        continue;
      }
      const answers = Object.values(this.cloneFeedbackAnswersByCardId(record.answersByCardId));
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

  submitFeedback(userId: string, request: FeedbackDetailDto): void {
    const feedback = new FeedbackDetailDto(request);
    const normalizedUserId = userId.trim();
    const normalizedEventId = feedback.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    const submittedAtIso = feedback.submittedAtIso || new Date().toISOString();
    const nextAnswersByCardId: Record<string, FeedbackStateRecord['answersByCardId'][string]> = {};
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
    this.updateFeedbackState(normalizedUserId, normalizedEventId, current => ({
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

  saveFeedbackNote(request: FeedbackNoteRequestDto): void {
    const normalizedUserId = request.userId.trim();
    const normalizedEventId = request.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      organizerNote: request.text.trim()
    }));
  }

  removeFeedbackEvent(userId: string, eventId: string): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: true,
      removedAtIso: new Date().toISOString()
    }));
  }

  restoreFeedbackEvent(userId: string, eventId: string): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false,
      removedAtIso: null
    }));
  }

  private readFeedbackStates(userId: string): FeedbackStateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[FEEDBACK_STATES_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is FeedbackStateRecord => Boolean(record) && record.userId === normalizedUserId)
      .map(record => ({
        ...record,
        answersByCardId: this.cloneFeedbackAnswersByCardId(record.answersByCardId)
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

  private updateFeedbackState(
    userId: string,
    eventId: string,
    updater: (current: FeedbackStateRecord) => FeedbackStateRecord
  ): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.memoryDb.write(current => {
      const table = current[FEEDBACK_STATES_TABLE_NAME];
      const recordId = this.feedbackStateRecordId(normalizedUserId, normalizedEventId);
      const existing = table.byId[recordId] ?? this.createEmptyFeedbackState(normalizedUserId, normalizedEventId);
      const nextRecord = updater({
        ...existing,
        answersByCardId: this.cloneFeedbackAnswersByCardId(existing.answersByCardId)
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
        for (const ownerUserId of this.feedbackAdminUserIds(normalizedEventId)) {
          this.addFeedbackCounterDelta(feedbackDeltas, ownerUserId, 'ownEvents', ownEventDelta);
        }
      }
      return {
        ...current,
        [FEEDBACK_STATES_TABLE_NAME]: {
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

  private feedbackBucket(record: FeedbackStateRecord): FeedbackCounterBucket {
    if (record.removed) {
      return 'removed';
    }
    return record.submittedAtIso?.trim() ? 'feedbacked' : 'pending';
  }

  private feedbackAdminUserIds(eventId: string): string[] {
    return this.eventsRepository.feedbackAdminUserIds(eventId);
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
    const current = user.activities.feedbackCounts;
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
        feedback: Math.max(0, this.counter(user.activities.feedback) + nextPending - this.counter(current?.pending)
          + nextOwnEvents - this.counter(current?.ownEvents)),
        feedbackCounts: {
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

  private createEmptyFeedbackState(userId: string, eventId: string): FeedbackStateRecord {
    return {
      id: this.feedbackStateRecordId(userId, eventId),
      userId,
      eventId,
      removed: false,
      submittedAtIso: null,
      removedAtIso: null,
      organizerNote: '',
      answersByCardId: {}
    };
  }

  private feedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

  private cloneFeedbackAnswersByCardId(
    answersByCardId: FeedbackStateRecord['answersByCardId'] | undefined
  ): FeedbackStateRecord['answersByCardId'] {
    const next: FeedbackStateRecord['answersByCardId'] = {};
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
