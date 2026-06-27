import type { EventFeedbackPersistedState } from '../entity/event.entity';
import { EVENT_FEEDBACK_TABLE_NAME } from '../entity/event.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
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
    const ownedEventIds = ownedEventIdsInput
      ? new Set([...ownedEventIdsInput].map(eventId => eventId.trim()).filter(Boolean))
      : new Set(
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
      nextAnswersByCardId[cardId] = {
        cardId,
        eventId: normalizedEventId,
        kind: card.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: card.targetUserId?.trim() || null,
        targetRole: card.targetRole === 'Admin' || card.targetRole === 'Manager' ? card.targetRole : 'Member',
        primaryValue: card.answerPrimary?.trim() ?? '',
        secondaryValue: card.answerSecondary?.trim() ?? '',
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
