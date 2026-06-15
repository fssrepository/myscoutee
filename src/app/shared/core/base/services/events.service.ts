import { Injectable, inject } from '@angular/core';

import type { ActivityEventSaveDTO } from '../../contracts';
import type { SubEventLeaderboardState } from '../../contracts/event.interface';
import type { ActivityPendingReason } from '../../common/constants';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackDeckQueryDto,
  EventFeedbackDeckResultDto,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackPageQueryDto,
  EventFeedbackPageResultDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../contracts/activity.interface';
import { LocalEventsService } from '../../local';
import { HttpEventsService } from '../../http';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventActivitiesQuery,
  ActivityEventDTO,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord
} from '../../contracts/activity.interface';
import type { IEventsService } from '../../contracts/activity.interface';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService extends BaseRouteModeService implements IEventsService {
  private readonly localEventsService = inject(LocalEventsService);
  private readonly httpEventsService = inject(HttpEventsService);

  get localModeEnabled(): boolean {
    return this.isLocalRouteEnabled('/activities/events');
  }

  private get eventsService(): LocalEventsService | HttpEventsService {
    return this.resolveRouteService('/activities/events', this.localEventsService, this.httpEventsService);
  }

  queryItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryItemsByUser(userId);
  }

  peekItemsByUser(userId: string): ActivityEventRecord[] {
    return this.eventsService.peekItemsByUser(userId);
  }

  queryInvitationItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryInvitationItemsByUser(userId);
  }

  queryEventItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryEventItemsByUser(userId);
  }

  queryTrashedItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryTrashedItemsByUser(userId);
  }

  async queryActivitiesEventListPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventActivitiesListQueryResult> {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.queryActivitiesEventListPage(query, signal);
    }
    return this.httpEventsService.queryActivitiesEventListPage(query, signal);
  }

  async queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.queryActivitiesEventDTOPage(query, signal);
    }
    return this.httpEventsService.queryActivitiesEventDTOPage(query, signal);
  }

  async saveActivityEvent(
    payload: ActivityEventSaveDTO
  ): Promise<ActivityEventDTO | null> {
    return this.eventsService.saveActivityEvent(payload);
  }

  queryExploreItems(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): ActivityEventRecord[] {
    return this.eventsService.peekExploreItems(userId);
  }

  async queryEventExplorePage(query: ActivityEventExploreQuery): Promise<ActivityEventExploreQueryResult> {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.queryEventExplorePage(query);
    }
    return this.httpEventsService.queryEventExplorePage(query);
  }

  peekEventExplorePage(query: ActivityEventExploreQuery): ActivityEventExploreQueryResult {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.peekEventExplorePage(query);
    }
    return this.httpEventsService.peekEventExplorePage(query);
  }

  peekKnownItemById(userId: string, itemId: string): ActivityEventRecord | null {
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

  peekKnownItemDTOById(userId: string, itemId: string): ActivityEventDTO | null {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId || !this.isLocalRouteEnabled('/activities/events')) {
      return null;
    }
    return this.localEventsService.peekKnownItemDTOById(userId, normalizedItemId);
  }

  async queryKnownItemById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
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

  trashItem(userId: string, sourceId: string): Promise<void> {
    return this.eventsService.trashItem(userId, sourceId);
  }

  publishItem(userId: string, sourceId: string): Promise<void> {
    return this.eventsService.publishItem(userId, sourceId);
  }

  unpublishItem(userId: string, sourceId: string): Promise<void> {
    return this.eventsService.unpublishItem(userId, sourceId);
  }

  restoreItem(userId: string, sourceId: string): Promise<void> {
    return this.eventsService.restoreItem(userId, sourceId);
  }

  takeOverItem(userId: string, sourceId: string): Promise<void> {
    return this.eventsService.takeOverItem(userId, sourceId);
  }

  waitForEventMutationDelay(): Promise<void> {
    return this.eventsService.waitForEventMutationDelay();
  }

  applyStageAction(request: {
    userId: string;
    sourceId: string;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): Promise<ActivityEventRecord | null> {
    return this.eventsService.applyStageAction(request);
  }

  querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    return this.eventsService.querySubEventLeaderboard(eventId, subEventId);
  }

  requestJoin(
    userId: string,
    sourceId: string,
    options: {
      slotSourceId?: string | null;
      optionalSubEventIds?: string[];
      assetSelections?: EventCheckoutAssetSelection[];
      acceptedPolicyIds?: string[];
      paymentSessionId?: string | null;
      bookingConfirmed?: boolean;
      pendingReason?: ActivityPendingReason;
    } = {}
  ): Promise<ActivityEventRecord | null> {
    return this.eventsService.requestJoin(userId, sourceId, options);
  }

  createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    return this.eventsService.createCheckoutSession(request);
  }

  payCheckoutSession(request: EventCheckoutRequest, paymentSessionId: string): Promise<EventCheckoutSession | null> {
    return this.eventsService.payCheckoutSession(request, paymentSessionId);
  }

  queryEventFeedbackStates(userId: string): Promise<EventFeedbackStateDto[]> {
    return this.eventsService.queryEventFeedbackStates(userId);
  }

  queryReceivedEventFeedback(userId: string): Promise<EventFeedbackReceivedEventDto[]> {
    return this.eventsService.queryReceivedEventFeedback(userId);
  }

  loadEventFeedbackPage(query: EventFeedbackPageQueryDto): Promise<EventFeedbackPageResultDto> {
    return this.eventsService.loadEventFeedbackPage(query);
  }

  loadEventFeedbackDeck(query: EventFeedbackDeckQueryDto): Promise<EventFeedbackDeckResultDto> {
    return this.eventsService.loadEventFeedbackDeck(query);
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

  async syncEventSnapshot(payload: ActivityEventSaveDTO): Promise<ActivityEventRecord | null> {
    return this.eventsService.syncEventSnapshot(payload);
  }
}
