import { Injectable, inject } from '@angular/core';

import type {
  ActivitiesEventSyncPayload,
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackCard,
  EventFeedbackEventCard,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto,
  SubEventLeaderboardState
} from '../../../core/base/models';
import { LocalEventsService } from '../../local';
import { HttpEventsService } from '../../http';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventActivitiesQuery,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord,
  ActivityEventRepositoryItemType
} from '../models/events.model';
import type { InfoCardData, InfoCardMenuAction } from '../../../ui';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService extends BaseRouteModeService {
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

  queryHostingItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.eventsService.queryHostingItemsByUser(userId);
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

  trashItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    return this.eventsService.trashItem(userId, type, sourceId);
  }

  publishItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    return this.eventsService.publishItem(userId, type, sourceId);
  }

  unpublishItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    return this.eventsService.unpublishItem(userId, type, sourceId);
  }

  restoreItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    return this.eventsService.restoreItem(userId, type, sourceId);
  }

  takeOverItem(userId: string, type: ActivityEventRepositoryItemType, sourceId: string): Promise<void> {
    return this.eventsService.takeOverItem(userId, type, sourceId);
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
      pendingReason?: 'approval' | 'waitlist' | null;
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

  eventFeedbackInfoCard(
    item: EventFeedbackEventCard,
    options: { hasOrganizerNote?: boolean } = {}
  ): InfoCardData {
    if (item.isOwnEvent) {
      return this.organizerEventFeedbackInfoCard({
        eventId: item.eventId,
        title: item.title,
        subtitle: item.subtitle,
        timeframe: item.timeframe,
        imageUrl: item.imageUrl,
        responseCount: item.pendingCards,
        noteCount: 0
      });
    }
    const startAvailable = this.isEventFeedbackStartAvailable(item);
    const detailRows = item.isFeedbacked
      ? [item.timeframe]
      : [item.timeframe, this.eventFeedbackItemStatusLine(item)];
    return {
      id: item.eventId,
      status: item.isRemoved ? 'removed' : item.isFeedbacked ? 'feedbacked' : 'pending',
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows,
      leadingIcon: {
        icon: this.eventFeedbackLeadingIcon(item)
      },
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.eventFeedbackStartBadgeLabel(item),
        interactive: startAvailable,
        ariaLabel: startAvailable
          ? 'Start event feedback'
          : 'Event feedback unavailable'
      },
      menuActions: this.eventFeedbackMenuActions(item, options.hasOrganizerNote === true),
      clickable: false
    };
  }

  eventFeedbackCarouselInfoCard(card: EventFeedbackCard): InfoCardData {
    const detailRows = [card.identityTitle].filter((row): row is string => !!row?.trim());
    return {
      id: card.id,
      title: card.heading,
      imageUrl: card.imageUrl,
      metaRows: [card.subheading],
      metaRowsLimit: 1,
      detailRows,
      leadingIcon: {
        icon: card.icon
      },
      clickable: false
    };
  }

  organizerEventFeedbackInfoCard(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }): InfoCardData {
    return this.organizerEventFeedbackCardData(item, true);
  }

  organizerEventFeedbackDetailInfoCard(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }): InfoCardData {
    return this.organizerEventFeedbackCardData(item, false);
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<ActivityEventRecord | null> {
    return this.eventsService.syncEventSnapshot(payload);
  }

  private isEventFeedbackStartAvailable(item: EventFeedbackEventCard): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  private eventFeedbackItemStatusLine(item: EventFeedbackEventCard): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  private eventFeedbackLeadingIcon(item: EventFeedbackEventCard): string {
    if (item.isOwnEvent) {
      return 'stadium';
    }
    if (item.isFeedbacked) {
      return 'task_alt';
    }
    if (item.isRemoved) {
      return 'delete_outline';
    }
    return 'rate_review';
  }

  private eventFeedbackStartBadgeLabel(item: EventFeedbackEventCard): string {
    if (item.isOwnEvent) {
      return 'View Feedbacks';
    }
    if (item.isRemoved) {
      return 'Removed';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked';
    }
    return 'Start Feedback';
  }

  private eventFeedbackMenuActions(
    item: EventFeedbackEventCard,
    hasOrganizerNote: boolean
  ): readonly InfoCardMenuAction[] {
    if (item.isOwnEvent) {
      return [];
    }
    const actions: InfoCardMenuAction[] = [];

    if (this.isEventFeedbackStartAvailable(item)) {
      actions.push('startFeedback');
    }

    if (!item.isRemoved && !item.isFeedbacked) {
      actions.push('removeFeedback');
    }

    if (item.isRemoved) {
      actions.push('restoreFeedback');
    }

    actions.push(hasOrganizerNote ? 'editOrganizerNote' : 'addOrganizerNote');

    return actions;
  }

  private organizerEventFeedbackCardData(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }, showAction: boolean): InfoCardData {
    return {
      id: item.eventId,
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows: [item.timeframe],
      leadingIcon: {
        icon: 'stadium'
      },
      mediaEnd: showAction
        ? {
          variant: 'badge',
          tone: 'default',
          label: 'View Feedbacks',
          pendingCount: item.responseCount,
          interactive: true,
          ariaLabel: `Open feedback details for ${item.title}`
        }
        : null,
      clickable: false
    };
  }
}
