import { Injectable, inject } from '@angular/core';

import type { ActivitiesEventSyncPayload } from '../../../contracts';
import type { ActivityPendingReason } from '../../../common/constants';
import type { SubEventLeaderboardState } from '../../../contracts/event.interface';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../../contracts/activity.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityEventsMapper } from '../mappers';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventActivitiesQuery,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord,
  ActivityEventRepositoryItemType
} from '../../../contracts/activity.interface';
import type { IEventsService } from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalEventsService extends LocalRouteDelayService implements IEventsService {
  private static readonly EVENTS_ROUTE = '/activities/events';
  private static readonly EVENTS_EXPLORE_ROUTE = '/activities/events/explore';
  private static readonly EVENTS_CHECKOUT_ROUTE = '/activities/events/checkout';
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly eventFeedbackRepository = inject(LocalEventFeedbackRepository);
  private readonly usersRepository = inject(LocalUsersRepository);

  async queryItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryItemsByUser(userId);
  }

  peekItemsByUser(userId: string): ActivityEventRecord[] {
    return this.eventsRepository.queryItemsByUser(userId);
  }

  async queryInvitationItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryInvitationItemsByUser(userId);
  }

  async queryEventItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryEventItemsByUser(userId);
  }

  async queryHostingItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryHostingItemsByUser(userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTrashedItemsByUser(userId);
  }

  async queryActivitiesEventListPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventActivitiesListQueryResult> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE, signal);
    return this.eventsRepository.queryActivitiesEventListPage({
      ...query,
      userId: this.resolveDemoActivityUserId(query.userId)
    });
  }

  async queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE, signal);
    return LocalActivityEventsMapper.toDTOPage(this.eventsRepository.queryActivitiesEventListPage({
      ...query,
      userId: this.resolveDemoActivityUserId(query.userId)
    }));
  }

  async queryExploreItems(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): ActivityEventRecord[] {
    return this.eventsRepository.queryExploreItems(userId);
  }

  async queryEventExplorePage(query: ActivityEventExploreQuery): Promise<ActivityEventExploreQueryResult> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryEventExplorePage({
      ...query,
      userId: this.resolveDemoActivityUserId(query.userId)
    });
  }

  peekEventExplorePage(query: ActivityEventExploreQuery): ActivityEventExploreQueryResult {
    return this.eventsRepository.queryEventExplorePage({
      ...query,
      userId: this.resolveDemoActivityUserId(query.userId)
    });
  }

  async queryEventFeedbackStates(userId: string): Promise<EventFeedbackStateDto[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventFeedbackRepository.queryEventFeedbackStates(userId);
  }

  async queryReceivedEventFeedback(userId: string): Promise<EventFeedbackReceivedEventDto[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventFeedbackRepository.queryReceivedEventFeedback(userId);
  }

  async submitEventFeedback(request: EventFeedbackSubmitRequestDto): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.submitEventFeedback(request);
    await this.eventFeedbackRepository.flushToIndexedDb();
  }

  async saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.saveEventFeedbackNote(request);
    await this.eventFeedbackRepository.flushToIndexedDb();
  }

  async removeEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.removeEventFeedbackEvent(userId, eventId);
    await this.eventFeedbackRepository.flushToIndexedDb();
  }

  async restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.restoreEventFeedbackEvent(userId, eventId);
    await this.eventFeedbackRepository.flushToIndexedDb();
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<ActivityEventRecord | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.syncEventSnapshot(payload);
    await this.eventsRepository.flushToIndexedDb();
    return record;
  }

  async trashItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.trashItem(userId, type, sourceId);
  }

  async publishItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.publishItem(userId, type, sourceId);
  }

  async unpublishItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.unpublishItem(userId, type, sourceId);
  }

  async restoreItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.restoreItem(userId, type, sourceId);
  }

  async takeOverItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.takeOverItem(userId, type, sourceId);
  }

  waitForEventMutationDelay(): Promise<void> {
    return this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
  }

  async applyStageAction(request: {
    userId: string;
    sourceId: string;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): Promise<ActivityEventRecord | null> {
    await this.waitForEventMutationDelay();
    const record = this.eventsRepository.applyStageAction(request);
    await this.eventsRepository.flushToIndexedDb();
    return record;
  }

  async querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
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
      pendingReason?: ActivityPendingReason;
    } = {}
  ): Promise<ActivityEventRecord | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.requestJoin(
      userId,
      sourceId,
      options.slotSourceId ?? null,
      options.bookingConfirmed === true && options.pendingReason !== 'approval' && options.pendingReason !== 'waitlist',
      options.pendingReason === 'waitlist'
    );
    await this.eventsRepository.flushToIndexedDb();
    return record;
  }

  async createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
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
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
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

  private resolveDemoActivityUserId(userId: string): string {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return normalizedUserId;
    }
    return this.usersRepository.queryAllUsers()[0]?.id ?? '';
  }
}
