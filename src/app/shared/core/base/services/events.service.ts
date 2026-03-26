import { Injectable, inject } from '@angular/core';

import type {
  ActivitiesEventSyncPayload,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../../core/base/models';
import { DemoEventsService } from '../../demo';
import { HttpEventsService } from '../../http';
import type {
  DemoEventActivitiesQuery,
  DemoEventActivitiesQueryResult,
  DemoEventExploreQuery,
  DemoEventExploreQueryResult,
  DemoEventRecord,
  DemoEventScopeFilter,
  DemoRepositoryEventItemType
} from '../../demo/models/events.model';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService extends BaseRouteModeService {
  private readonly demoEventsService = inject(DemoEventsService);
  private readonly httpEventsService = inject(HttpEventsService);

  get demoModeEnabled(): boolean {
    return this.isDemoModeEnabled('/activities/events');
  }

  private get eventsService(): DemoEventsService | HttpEventsService {
    return this.resolveRouteService('/activities/events', this.demoEventsService, this.httpEventsService);
  }

  queryItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryItemsByUser(userId);
  }

  peekItemsByUser(userId: string): DemoEventRecord[] {
    return this.eventsService.peekItemsByUser(userId);
  }

  queryInvitationItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryInvitationItemsByUser(userId);
  }

  queryEventItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryEventItemsByUser(userId);
  }

  queryHostingItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryHostingItemsByUser(userId);
  }

  queryTrashedItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryTrashedItemsByUser(userId);
  }

  queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): Promise<DemoEventRecord[]> {
    return this.eventsService.queryEventItemsByFilter(userId, filter, hostingPublicationFilter);
  }

  async queryActivitiesEventPage(query: DemoEventActivitiesQuery): Promise<DemoEventActivitiesQueryResult> {
    if (this.isDemoModeEnabled('/activities/events')) {
      return this.demoEventsService.queryActivitiesEventPage(query);
    }
    return this.httpEventsService.queryActivitiesEventPage(query);
  }

  queryExploreItems(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): DemoEventRecord[] {
    return this.eventsService.peekExploreItems(userId);
  }

  async queryEventExplorePage(query: DemoEventExploreQuery): Promise<DemoEventExploreQueryResult> {
    if (this.isDemoModeEnabled('/activities/events')) {
      return this.demoEventsService.queryEventExplorePage(query);
    }
    return this.httpEventsService.queryEventExplorePage(query);
  }

  peekEventExplorePage(query: DemoEventExploreQuery): DemoEventExploreQueryResult {
    if (this.isDemoModeEnabled('/activities/events')) {
      return this.demoEventsService.peekEventExplorePage(query);
    }
    return this.httpEventsService.peekEventExplorePage(query);
  }

  peekKnownItemById(userId: string, itemId: string): DemoEventRecord | null {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const known = [
      ...this.eventsService.peekItemsByUser(userId),
      ...this.eventsService.peekExploreItems(userId)
    ];
    return known.find(record => record.id === normalizedItemId) ?? null;
  }

  async queryKnownItemById(userId: string, itemId: string): Promise<DemoEventRecord | null> {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const cached = this.peekKnownItemById(userId, normalizedItemId);
    if (cached) {
      return cached;
    }
    const [owned, explore] = await Promise.all([
      this.eventsService.queryItemsByUser(userId),
      this.eventsService.queryExploreItems(userId)
    ]);
    return [...owned, ...explore].find(record => record.id === normalizedItemId) ?? null;
  }

  trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    return this.eventsService.trashItem(userId, type, sourceId);
  }

  publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    return this.eventsService.publishItem(userId, type, sourceId);
  }

  restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    return this.eventsService.restoreItem(userId, type, sourceId);
  }

  requestJoin(userId: string, sourceId: string): Promise<DemoEventRecord | null> {
    return this.eventsService.requestJoin(userId, sourceId);
  }

  queryEventFeedbackStates(userId: string): Promise<EventFeedbackStateDto[]> {
    return this.eventsService.queryEventFeedbackStates(userId);
  }

  submitEventFeedback(request: EventFeedbackSubmitRequestDto): Promise<void> {
    return this.eventsService.submitEventFeedback(request);
  }

  saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void> {
    return this.eventsService.saveEventFeedbackNote(request);
  }

  removeEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    return this.eventsService.removeEventFeedbackEvent(userId, eventId);
  }

  restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    return this.eventsService.restoreEventFeedbackEvent(userId, eventId);
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.eventsService.syncEventSnapshot(payload);
  }
}
