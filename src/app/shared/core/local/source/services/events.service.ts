import { Injectable, inject } from '@angular/core';

import type { ActivityPendingReason } from '../../../common/constants';
import type {
  EventTournamentGroupDeleteRequestDTO,
  EventTournamentGroupsQueryDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentGroupDTO,
  EventTournamentGroupUpsertRequestDTO,
  EventTournamentStageGroupsQueryDTO,
  SubEventLeaderboardEntryUpsertRequestDTO,
  SubEventLeaderboardState
} from '../../../contracts/event.interface';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventParticipationActionResultDTO,
  EventFeedbackQueryDto,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackPageQueryDto,
  EventFeedbackStateDto
} from '../../../contracts/activity.interface';
import { EventFeedbackDetailDto, EventFeedbackPageResultDto } from '../../../contracts/activity.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import {
  LocalActivityEventDetailsMapper,
  LocalActivityEventsMapper,
  LocalEventFeedbackMapper,
  LocalEventParticipationActionMapper
} from '../mappers';
import type {
  ActivityEventActivitiesQuery,
  ActivityEventDetailDTO,
  ActivityEventDTO,
  ActivityEventStageActionRequestDTO,
  ActivityEventStageActionResultDTO,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord,
  ActivityEventSubEventsQueryDTO,
  ActivityEventSubEventsResultDTO
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

  async queryHostingItemsByUser(userId: string): Promise<ActivityEventDTO[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return LocalActivityEventsMapper.toDtoList(this.eventsRepository.queryHostingItemsByUser(userId));
  }

  async queryTrashedItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTrashedItemsByUser(userId);
  }

  async queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE, signal);
    const page = this.eventsRepository.queryActivitiesEventRecordPage({
      ...query,
      userId: this.resolveDemoActivityUserId(query.userId)
    });
    return LocalActivityEventsMapper.toDtoPage(page);
  }

  async loadEventDetailById(userId: string, eventId: string): Promise<ActivityEventDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.queryEventRecordById(normalizedUserId, normalizedEventId);
    return record ? LocalActivityEventDetailsMapper.toDto(record) : null;
  }

  async loadSubEventsById(
    userId: string,
    eventId: string,
    query?: ActivityEventSubEventsQueryDTO
  ): Promise<ActivityEventSubEventsResultDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const result = this.eventsRepository.querySubEventsByEventId(normalizedUserId, normalizedEventId, query);
    return result
      ? {
        event: LocalActivityEventDetailsMapper.toDto(result.event),
        items: result.items
      }
      : null;
  }

  async queryExploreItems(userId: string): Promise<ActivityEventRecord[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): ActivityEventRecord[] {
    return this.eventsRepository.queryExploreItems(userId);
  }

  peekKnownItemById(userId: string, itemId: string): ActivityEventDTO | null {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const record = [
      ...this.peekItemsByUser(userId),
      ...this.peekExploreItems(userId)
    ].find(item => item.id === normalizedItemId);
    return record ? LocalActivityEventsMapper.toDto(record) : null;
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

  async loadEventFeedbackPage(query: EventFeedbackPageQueryDto): Promise<EventFeedbackPageResultDto> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return new EventFeedbackPageResultDto();
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const records = this.eventsRepository.queryItemsByUser(normalizedUserId);
    const events = LocalActivityEventsMapper.toDtoList(records);
    const users = this.usersRepository.queryAllUsers();
    const activeUser = this.usersRepository.queryUserById(normalizedUserId) ?? users[0] ?? null;
    if (!activeUser) {
      return new EventFeedbackPageResultDto();
    }
    return LocalEventFeedbackMapper.toPageResult({
      query,
      events,
      users,
      activeUser,
      states: this.eventFeedbackRepository.queryEventFeedbackStates(normalizedUserId),
      receivedEvents: this.eventFeedbackRepository.queryReceivedEventFeedback(normalizedUserId)
    });
  }

  async loadEventFeedback(query: EventFeedbackQueryDto): Promise<EventFeedbackDetailDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return new EventFeedbackDetailDto({ eventId: normalizedEventId });
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const records = this.eventsRepository.queryItemsByUser(normalizedUserId);
    const events = LocalActivityEventsMapper.toDtoList(records);
    const users = this.usersRepository.queryAllUsers();
    const activeUser = this.usersRepository.queryUserById(normalizedUserId) ?? users[0] ?? null;
    if (!activeUser) {
      return new EventFeedbackDetailDto({ eventId: normalizedEventId });
    }
    return LocalEventFeedbackMapper.toDetail({
      query: {
        userId: normalizedUserId,
        eventId: normalizedEventId
      },
      events,
      users,
      activeUser
    });
  }

  async submitEventFeedback(userId: string, request: EventFeedbackDetailDto): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventFeedbackRepository.submitEventFeedback(userId, request);
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

  async syncEventSnapshot(payload: ActivityEventDetailDTO): Promise<ActivityEventRecord | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = LocalActivityEventDetailsMapper.toRecord(payload);
    const savedRecord = this.eventsRepository.saveEventSnapshot(record);
    await this.eventsRepository.flushToIndexedDb();
    return savedRecord;
  }

  async saveActivityEvent(payload: ActivityEventDetailDTO): Promise<ActivityEventDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = LocalActivityEventDetailsMapper.toRecord(payload);
    const savedRecord = this.eventsRepository.saveEventSnapshot(record);
    await this.eventsRepository.flushToIndexedDb();
    return savedRecord ? LocalActivityEventsMapper.toDto(savedRecord) : null;
  }

  async trashItem(userId: string, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.trashItem(userId, sourceId);
  }

  async publishItem(userId: string, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.publishItem(userId, sourceId);
  }

  async unpublishItem(userId: string, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.unpublishItem(userId, sourceId);
  }

  async restoreItem(userId: string, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.restoreItem(userId, sourceId);
  }

  async takeOverItem(userId: string, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    this.eventsRepository.takeOverItem(userId, sourceId);
  }

  waitForEventMutationDelay(): Promise<void> {
    return this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
  }

  async applyStageAction(request: ActivityEventStageActionRequestDTO): Promise<ActivityEventStageActionResultDTO | null> {
    await this.waitForEventMutationDelay();
    const result = this.eventsRepository.applyStageAction(request);
    await this.eventsRepository.flushToIndexedDb();
    return result;
  }

  async querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.querySubEventLeaderboard(eventId, subEventId);
  }

  async queryTournamentGroups(query: EventTournamentGroupsQueryDTO): Promise<EventTournamentGroupsStateDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTournamentGroups(query);
  }

  async queryTournamentStageGroups(query: EventTournamentStageGroupsQueryDTO): Promise<EventTournamentGroupDTO[]> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTournamentStageGroups(query);
  }

  async saveTournamentGroup(request: EventTournamentGroupUpsertRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const state = this.eventsRepository.saveTournamentGroup(request);
    await this.eventsRepository.flushToIndexedDb();
    return state;
  }

  async deleteTournamentGroup(request: EventTournamentGroupDeleteRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const state = this.eventsRepository.deleteTournamentGroup(request);
    await this.eventsRepository.flushToIndexedDb();
    return state;
  }

  async upsertSubEventLeaderboardEntry(request: SubEventLeaderboardEntryUpsertRequestDTO): Promise<SubEventLeaderboardState | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return this.eventsRepository.upsertSubEventLeaderboardEntry(request);
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
  ): Promise<EventParticipationActionResultDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.requestJoin(
      userId,
      sourceId,
      options.slotSourceId ?? null,
      options.bookingConfirmed === true && options.pendingReason !== 'approval' && options.pendingReason !== 'waitlist',
      options.pendingReason === 'waitlist'
    );
    await this.eventsRepository.flushToIndexedDb();
    return record
      ? LocalEventParticipationActionMapper.toResult(record, this.resolveDemoActivityUserId(userId), options)
      : null;
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
