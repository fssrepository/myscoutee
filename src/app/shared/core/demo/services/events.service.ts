import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../../core/base';
import type {
  ActivitiesEventSyncPayload,
  EventFeedbackPersistedState,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../../core/base/models';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoEventsRepository } from '../repositories/events.repository';
import { EVENT_FEEDBACK_TABLE_NAME } from '../models/event-feedback.model';
import type {
  DemoEventActivitiesQuery,
  DemoEventActivitiesQueryResult,
  DemoEventExploreQuery,
  DemoEventExploreQueryResult,
  DemoEventRecord,
  DemoEventScopeFilter,
  DemoRepositoryEventItemType
} from '../models/events.model';

@Injectable({
  providedIn: 'root'
})
export class DemoEventsService extends DemoRouteDelayService {
  private static readonly EVENTS_ROUTE = '/activities/events';
  private static readonly EVENTS_EXPLORE_ROUTE = '/activities/events/explore';
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly memoryDb = inject(AppMemoryDb);

  async queryItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryItemsByUser(userId);
  }

  peekItemsByUser(userId: string): DemoEventRecord[] {
    return this.eventsRepository.queryItemsByUser(userId);
  }

  async queryInvitationItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryInvitationItemsByUser(userId);
  }

  async queryEventItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryEventItemsByUser(userId);
  }

  async queryHostingItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryHostingItemsByUser(userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTrashedItemsByUser(userId);
  }

  async queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryEventItemsByFilter(userId, filter, hostingPublicationFilter);
  }

  async queryActivitiesEventPage(query: DemoEventActivitiesQuery): Promise<DemoEventActivitiesQueryResult> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryActivitiesEventPage(query);
  }

  async queryExploreItems(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): DemoEventRecord[] {
    return this.eventsRepository.queryExploreItems(userId);
  }

  async queryEventExplorePage(query: DemoEventExploreQuery): Promise<DemoEventExploreQueryResult> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryEventExplorePage(query);
  }

  peekEventExplorePage(query: DemoEventExploreQuery): DemoEventExploreQueryResult {
    return this.eventsRepository.queryEventExplorePage(query);
  }

  async queryEventFeedbackStates(userId: string): Promise<EventFeedbackStateDto[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readEventFeedbackStates(normalizedUserId).map(record => ({
      eventId: record.eventId,
      removed: record.removed,
      submittedAtIso: record.submittedAtIso ?? '',
      organizerNote: record.organizerNote
    }));
  }

  async submitEventFeedback(request: EventFeedbackSubmitRequestDto): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
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
        tags: answer.tags.map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso.trim() || submittedAtIso
      };
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false,
      submittedAtIso,
      answersByCardId: {
        ...current.answersByCardId,
        ...nextAnswersByCardId
      }
    }));
    await this.memoryDb.flushToIndexedDb();
  }

  async saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const normalizedUserId = request.userId.trim();
    const normalizedEventId = request.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false,
      organizerNote: request.text.trim()
    }));
    await this.memoryDb.flushToIndexedDb();
  }

  async removeEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: true
    }));
    await this.memoryDb.flushToIndexedDb();
  }

  async restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.updateEventFeedbackState(normalizedUserId, normalizedEventId, current => ({
      ...current,
      removed: false
    }));
    await this.memoryDb.flushToIndexedDb();
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.syncEventSnapshot(payload);
    await this.memoryDb.flushToIndexedDb();
  }

  async trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.trashItem(userId, type, sourceId);
  }

  async publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.publishItem(userId, type, sourceId);
  }

  async restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.restoreItem(userId, type, sourceId);
  }

  async requestJoin(userId: string, sourceId: string): Promise<DemoEventRecord | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.requestJoin(userId, sourceId);
    await this.memoryDb.flushToIndexedDb();
    return record;
  }

  countTicketItemsByUser(userId: string): number {
    return this.eventsRepository.countTicketItemsByUser(userId);
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    return this.eventsRepository.countPendingEventFeedbackByUser(userId, feedbackUnlockDelayMs);
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
        answersByCardId: { ...(record.answersByCardId ?? {}) }
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
        answersByCardId: { ...(existing.answersByCardId ?? {}) }
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
      organizerNote: '',
      answersByCardId: {}
    };
  }

  private eventFeedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

}
