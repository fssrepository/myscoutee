import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../../core/base';
import type {
  ActivitiesEventSyncPayload,
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto,
  SubEventLeaderboardState
} from '../../../core/base/models';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { DemoEventsRepository } from '../repositories/events.repository';
import type {
  DemoEventActivitiesListQueryResult,
  DemoEventActivitiesQuery,
  DemoEventExploreQuery,
  DemoEventExploreQueryResult,
  DemoEventRecord,
  DemoRepositoryEventItemType
} from '../models/events.model';

@Injectable({
  providedIn: 'root'
})
export class DemoEventsService extends DemoRouteDelayService {
  private static readonly EVENTS_ROUTE = '/activities/events';
  private static readonly EVENTS_EXPLORE_ROUTE = '/activities/events/explore';
  private static readonly EVENTS_CHECKOUT_ROUTE = '/activities/events/checkout';
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly eventFeedbackRepository = inject(DemoEventFeedbackRepository);
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

  async queryActivitiesEventListPage(
    query: DemoEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<DemoEventActivitiesListQueryResult> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE, signal);
    return this.eventsRepository.queryActivitiesEventListPage(query);
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
    return this.eventFeedbackRepository.queryEventFeedbackStates(userId);
  }

  async queryReceivedEventFeedback(userId: string): Promise<EventFeedbackReceivedEventDto[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventFeedbackRepository.queryReceivedEventFeedback(userId);
  }

  async submitEventFeedback(request: EventFeedbackSubmitRequestDto): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.submitEventFeedback(request);
    await this.memoryDb.flushToIndexedDb();
  }

  async saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.saveEventFeedbackNote(request);
    await this.memoryDb.flushToIndexedDb();
  }

  async removeEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.removeEventFeedbackEvent(userId, eventId);
    await this.memoryDb.flushToIndexedDb();
  }

  async restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.restoreEventFeedbackEvent(userId, eventId);
    await this.memoryDb.flushToIndexedDb();
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<DemoEventRecord | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.syncEventSnapshot(payload);
    await this.memoryDb.flushToIndexedDb();
    return record;
  }

  async trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.trashItem(userId, type, sourceId);
  }

  async publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.publishItem(userId, type, sourceId);
  }

  async unpublishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.unpublishItem(userId, type, sourceId);
  }

  async restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.restoreItem(userId, type, sourceId);
  }

  async takeOverItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.takeOverItem(userId, type, sourceId);
  }

  waitForEventMutationDelay(): Promise<void> {
    return this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
  }

  async applyStageAction(request: {
    userId: string;
    sourceId: string;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): Promise<DemoEventRecord | null> {
    await this.waitForEventMutationDelay();
    const record = this.eventsRepository.applyStageAction(request);
    await this.memoryDb.flushToIndexedDb();
    return record;
  }

  async querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.querySubEventLeaderboard(eventId, subEventId);
  }

  async requestJoin(
    userId: string,
    sourceId: string,
    options: {
      slotSourceId?: string | null;
      optionalSubEventIds?: string[];
      assetSelections?: EventCheckoutAssetSelection[];
      acceptedPolicyIds?: string[];
      paymentSessionId?: string | null;
      bookingConfirmed?: boolean;
      pendingReason?: 'approval' | 'waitlist' | null;
    } = {}
  ): Promise<DemoEventRecord | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.requestJoin(
      userId,
      sourceId,
      options.slotSourceId ?? null,
      options.bookingConfirmed === true && options.pendingReason !== 'approval' && options.pendingReason !== 'waitlist',
      options.pendingReason === 'waitlist'
    );
    await this.memoryDb.flushToIndexedDb();
    return record;
  }

  async createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_CHECKOUT_ROUTE);
    return {
      id: `checkout-${Date.now()}`,
      provider: 'dummy',
      mode: 'dummy',
      status: 'approved',
      amount: Math.max(0, Number(request.totalAmount) || 0),
      currency: request.currency?.trim() || 'USD',
      paymentUrl: null
    };
  }

  async payCheckoutSession(
    request: EventCheckoutRequest,
    paymentSessionId: string
  ): Promise<EventCheckoutSession | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_CHECKOUT_ROUTE);
    return {
      id: paymentSessionId.trim() || `checkout-${Date.now()}`,
      provider: 'dummy',
      mode: 'dummy',
      status: 'approved',
      amount: Math.max(0, Number(request.totalAmount) || 0),
      currency: request.currency?.trim() || 'USD',
      paymentUrl: null
    };
  }

  countTicketItemsByUser(userId: string): number {
    return this.eventsRepository.countTicketItemsByUser(userId);
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    return this.eventsRepository.countPendingEventFeedbackByUser(userId, feedbackUnlockDelayMs);
  }
}
