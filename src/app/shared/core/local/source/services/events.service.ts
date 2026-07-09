import { Injectable, inject } from '@angular/core';

import type { ActivityPendingReason } from '../../../common/constants';
import type {
  EventTournamentGroupDeleteRequestDTO,
  EventTournamentGroupsQueryDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentGroupDTO,
  EventTournamentGroupUpsertRequestDTO,
  EventSlotOccurrenceDTO,
  EventTournamentStageGroupsQueryDTO,
  SubEventLeaderboardEntryUpsertRequestDTO,
  SubEventLeaderboardState
} from '../../../contracts/event.interface';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutBasket,
  EventCheckoutBasketItem,
  EventCheckoutLineItem,
  EventCheckoutOptionalSubEvent,
  EventCheckoutPricingSummaryRow,
  EventCheckoutRequest,
  EventCheckoutResultState,
  EventCheckoutState,
  EventCheckoutStateChangeRequest,
  EventCheckoutSession,
  EventCheckoutSlot,
  EventCheckoutSlotDay,
  EventCheckoutSlotsQuery,
  EventCheckoutSlotsResult,
  EventParticipationActionResultDTO,
  EventFeedbackQueryDto,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackPageQueryDto,
  EventFeedbackStatDto,
  EventFeedbackStatQueryDto,
  EventFeedbackStateDto
} from '../../../contracts/activity.interface';
import type { ActivitiesFeedFilters, ListQuery } from '../../../contracts';
import type { UserMenuCounterDeltasDto } from '../../../contracts/user.interface';
import { PricingBuilder } from '../../../base/builders';
import { ActivityEventDetailDTO, EventFeedbackDetailDto, EventFeedbackPageResultDto } from '../../../contracts/activity.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalUsersService } from './users.service';
import {
  LocalActivityEventDetailsMapper,
  LocalActivitySubEventStageRuntimeMapper,
  LocalActivityResourcesMapper,
  LocalActivityEventsMapper,
  LocalEventCheckoutBasketsMapper,
  LocalEventFeedbackMapper,
  LocalEventParticipationActionMapper,
  LocalUsersMapper
} from '../mappers';
import type {
  ActivityEventDTO,
  ActivityEventStageActionRequestDTO,
  ActivityEventStageActionResultDTO,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord,
  ActivityEventSubEventsQueryDTO,
  ActivityEventSubEventsResultDTO,
  ActivitySubEventStageRuntimeStateDTO,
  ActivitySubEventResourceStateDTO,
  SubEventDefinitionDTO
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
  private readonly activityResourcesRepository = inject(LocalActivityResourcesRepository);
  private readonly activitySubEventStageRuntimeRepository = inject(LocalActivitySubEventStageRuntimeRepository);
  private readonly eventCheckoutBasketsRepository = inject(LocalEventCheckoutBasketsRepository);
  private readonly eventFeedbackRepository = inject(LocalEventFeedbackRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly usersService = inject(LocalUsersService);

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
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE, signal);
    const page = this.eventsRepository.queryActivitiesEventRecordPage(
      this.resolveDemoActivityUserId(userId),
      query
    );
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
    if (!result) {
      return null;
    }
    const mode = result.parentRecord.mode;
    if (mode !== 'Casual' && mode !== 'Tournament') {
      return null;
    }
    const baseSlots = this.eventsRepository.filterSubEventsSlotsForParticipant(
      normalizedUserId,
      LocalActivityEventsMapper.toSubEventsSlots(result.parentEventId, result.parentRecord, query),
      query?.participantOnly === true
    );
    const { resourceLookups, stageRuntimeLookups } = LocalActivityEventsMapper.subEventStateLookups(baseSlots, normalizedUserId);
    const resourceStates = this.activityResourcesRepository.querySubEventResourceRecordsByRefs(resourceLookups)
      .map(record => LocalActivityResourcesMapper.toState(record))
      .filter((state): state is ActivitySubEventResourceStateDTO => Boolean(state));
    const resourceStatesByKey = new Map(
      resourceStates.map(state => [
        LocalActivityEventsMapper.subEventResourceRecordKey(state),
        state
      ])
    );
    const stageRuntimeStates = this.activitySubEventStageRuntimeRepository.queryRecordsByRefs(stageRuntimeLookups)
      .map(record => LocalActivitySubEventStageRuntimeMapper.toState(record))
      .filter((state): state is ActivitySubEventStageRuntimeStateDTO => Boolean(state));
    const stageRuntimeByKey = new Map(
      stageRuntimeStates.map(state => [
        LocalActivityEventsMapper.subEventStageRuntimeRecordKey(state),
        state
      ])
    );
    return {
      mode,
      slots: LocalActivityEventsMapper.withSubEventStates(
        baseSlots,
        resourceStatesByKey,
        stageRuntimeByKey,
        normalizedUserId
      )
    };
  }

  async loadCheckoutSlots(query: EventCheckoutSlotsQuery): Promise<EventCheckoutSlotsResult | null> {
    const normalizedUserId = query.userId?.trim();
    const normalizedEventId = query.eventId?.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    const selectedRecord = this.eventsRepository.queryEventRecordById(normalizedUserId, normalizedEventId);
    const parentEventId = selectedRecord?.parentEventId?.trim() || selectedRecord?.id || normalizedEventId;
    const record = this.eventsRepository.queryEventRecordById(normalizedUserId, parentEventId) ?? selectedRecord;
    if (!record) {
      return null;
    }
    const checkoutBasketRecord = await this.eventCheckoutBasketsRepository.loadBasketByEvent(normalizedUserId, record.id);
    const checkoutBasket = LocalEventCheckoutBasketsMapper.toDto(checkoutBasketRecord);
    const activeReservationItems = LocalEventCheckoutBasketsMapper.itemRecordsToDtos(
      await this.eventCheckoutBasketsRepository.loadActiveItemsByEvent(record.id)
    );
    const slotReservations = this.checkoutReservationCounts(activeReservationItems, 'slot');
    const optionalReservations = this.checkoutReservationCounts(activeReservationItems, 'optional');
    const direction = query.order === 'past' ? -1 : 1;
    const basketView = query.view === 'basket';
    const allSlots = (record.upcomingSlots ?? [])
      .filter(slot => this.checkoutSlotMatchesOrder(slot, query))
      .filter(slot => basketView || this.checkoutSlotOverlapsRange(slot, query))
      .sort((left, right) => direction * (this.sortableDateMs(left.startAtIso) - this.sortableDateMs(right.startAtIso)));
    const bookedSlotIds = this.eventsRepository.queryAcceptedEventOwnerIdsByUser(
      allSlots.map(slot => slot.id),
      normalizedUserId
    );
    const allSlotDtos = allSlots
      .map(slot => this.toCheckoutSlot(record, slot, slotReservations.get(slot.id) ?? 0, bookedSlotIds.has(slot.id)));
    const days = this.checkoutSlotDays(allSlotDtos);
    const allSlotsById = new Map(allSlotDtos.map(slot => [slot.id, slot]));
    const basketSlots = (checkoutBasket?.items ?? [])
      .filter(item => this.isActiveCheckoutItem(item) && item.kind === 'event' && !!item.slotSourceId?.trim())
      .map(item => allSlotsById.get(item.slotSourceId!.trim()) ?? this.checkoutSlotFromBasketItem(record, item))
      .filter((slot): slot is EventCheckoutSlot => Boolean(slot))
      .sort((left, right) => direction * (this.sortableDateMs(left.startAtIso) - this.sortableDateMs(right.startAtIso)));
    const pageSource = basketView ? basketSlots : allSlotDtos;
    const offset = this.checkoutCursorOffset(query.cursor);
    const limit = Math.max(1, Math.min(60, Math.trunc(Number(query.limit) || 15)));
    const page = pageSource.slice(offset, offset + limit);
    const currency = pageSource.find(slot => slot.currency)?.currency
      ?? allSlotDtos.find(slot => slot.currency)?.currency
      ?? record.pricing?.currency
      ?? 'USD';
    return {
      eventId: record.id,
      mode: record.mode,
      days,
      slots: page,
      total: pageSource.length,
      nextCursor: offset + limit < pageSource.length ? `${offset + limit}` : null,
      currency,
      optionalSubEvents: this.checkoutOptionalSubEvents(record, optionalReservations, currency),
      checkoutBasket
    };
  }

  async loadCheckoutBasketByEvent(userId: string, sourceId: string): Promise<EventCheckoutBasket | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    return LocalEventCheckoutBasketsMapper.toDto(
      await this.eventCheckoutBasketsRepository.loadBasketByEvent(normalizedUserId, normalizedSourceId)
    );
  }

  async saveCheckoutBasket(request: EventCheckoutRequest): Promise<EventCheckoutBasket | null> {
    const normalizedUserId = request.userId?.trim();
    const normalizedSourceId = request.sourceId?.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    return this.saveCheckoutBasketRecord({
      ...request,
      userId: normalizedUserId,
      sourceId: normalizedSourceId
    });
  }

  async updateCheckoutBasketState(request: EventCheckoutStateChangeRequest): Promise<EventCheckoutBasket | null> {
    const normalizedUserId = request.userId?.trim();
    const normalizedSourceId = request.sourceId?.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    return this.updateCheckoutBasketStateRecord({
      ...request,
      userId: normalizedUserId,
      sourceId: normalizedSourceId
    });
  }

  private async saveCheckoutBasketRecord(request: EventCheckoutRequest): Promise<EventCheckoutBasket | null> {
    const record = LocalEventCheckoutBasketsMapper.toRecordFromRequest(request);
    if (!record) {
      return null;
    }
    return LocalEventCheckoutBasketsMapper.toDto(
      await this.eventCheckoutBasketsRepository.saveBasket(record)
    );
  }

  private async updateCheckoutBasketStateRecord(
    request: EventCheckoutStateChangeRequest
  ): Promise<EventCheckoutBasket | null> {
    const record = LocalEventCheckoutBasketsMapper.toStatePatchRecord(request);
    if (!record) {
      return null;
    }
    return LocalEventCheckoutBasketsMapper.toDto(
      await this.eventCheckoutBasketsRepository.updateBasketState(record)
    );
  }

  async payEventCheckout(request: EventCheckoutStateChangeRequest): Promise<EventParticipationActionResultDTO | null> {
    const normalizedUserId = request.userId?.trim();
    const normalizedSourceId = request.sourceId?.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    const basket = await this.eventCheckoutBasketsRepository.loadBasketByEvent(normalizedUserId, normalizedSourceId);
    if (!basket) {
      return null;
    }
    const slotSourceId = basket.slotSourceId ?? request.slotSourceId ?? null;
    const checkoutSessionId = `checkout-${Date.now()}`;
    const record = this.eventsRepository.requestJoin(
      normalizedUserId,
      normalizedSourceId,
      slotSourceId,
      true,
      false,
      false
    );
    const result = record
      ? LocalEventParticipationActionMapper.toResult(record, this.resolveDemoActivityUserId(normalizedUserId), {
          slotSourceId,
          paymentSessionId: checkoutSessionId,
          pendingReason: null
        })
      : null;
    await this.updateCheckoutBasketStateRecord({
      userId: normalizedUserId,
      sourceId: normalizedSourceId,
      checkoutState: result?.membershipStatus === 'accepted'
        ? 'pay'
        : result?.pendingReason === 'waitlist'
          ? 'waiting'
          : 'approval-pending',
      resultState: result?.membershipStatus === 'accepted' ? 'succeeded' : null,
      checkoutSessionId
    });
    await this.patchLocalUserActivityCounterDeltas(normalizedUserId, request.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    return result;
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
    const records = this.eventsRepository.queryFeedbackCandidateItemsByUser(normalizedUserId);
    const organizerRecords = this.eventsRepository.queryHostingItemsByUser(normalizedUserId);
    const events = LocalActivityEventsMapper.toDtoList(records);
    const organizerEvents = LocalActivityEventsMapper.toDtoList(organizerRecords);
    const users = this.usersRepository.queryAllUsers();
    const activeUserRecord = this.usersRepository.queryUserById(normalizedUserId);
    const activeUser = activeUserRecord ? LocalUsersMapper.toDto(activeUserRecord) : users[0] ?? null;
    if (!activeUser) {
      return new EventFeedbackPageResultDto();
    }
    return LocalEventFeedbackMapper.toPageResult({
      query,
      events,
      organizerEvents,
      users,
      activeUser,
      states: this.eventFeedbackRepository.queryEventFeedbackStates(normalizedUserId),
      receivedEvents: this.eventFeedbackRepository.queryReceivedEventFeedback(normalizedUserId)
    });
  }

  async loadEventFeedbackStatById(query: EventFeedbackStatQueryDto): Promise<EventFeedbackStatDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return {
        eventId: normalizedEventId,
        totalResponses: 0,
        sections: []
      };
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return LocalEventFeedbackMapper.toStat({
      query: {
        userId: normalizedUserId,
        eventId: normalizedEventId
      },
      records: this.eventFeedbackRepository.queryReceivedEventFeedbackStatRecords(
        normalizedUserId,
        normalizedEventId
      )
    });
  }

  async loadEventFeedback(query: EventFeedbackQueryDto): Promise<EventFeedbackDetailDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return new EventFeedbackDetailDto({ eventId: normalizedEventId });
    }
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const records = this.eventsRepository.queryFeedbackCandidateItemsByUser(normalizedUserId);
    const events = LocalActivityEventsMapper.toDtoList(records);
    const users = this.usersRepository.queryAllUsers();
    const activeUserRecord = this.usersRepository.queryUserById(normalizedUserId);
    const activeUser = activeUserRecord ? LocalUsersMapper.toDto(activeUserRecord) : users[0] ?? null;
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
    const existingRecord = this.eventsRepository.queryEventRecordById(record.userId, record.id);
    const savedRecord = this.eventsRepository.saveEventSnapshot(record);
    const runtimeChanged = this.markDeletedRuntimeStateForRemovedDefinitions(existingRecord, savedRecord ?? record);
    await this.eventsRepository.flushToIndexedDb();
    if (runtimeChanged) {
      await this.activityResourcesRepository.flushToIndexedDb();
      await this.activitySubEventStageRuntimeRepository.flushToIndexedDb();
    }
    return savedRecord;
  }

  async saveActivityEvent(payload: ActivityEventDetailDTO): Promise<ActivityEventDTO | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    const record = LocalActivityEventDetailsMapper.toRecord(payload);
    const existingRecord = this.eventsRepository.queryEventRecordById(record.userId, record.id);
    const savedRecord = this.eventsRepository.saveEventSnapshot(record);
    const runtimeChanged = this.markDeletedRuntimeStateForRemovedDefinitions(existingRecord, savedRecord ?? record);
    await this.eventsRepository.flushToIndexedDb();
    if (runtimeChanged) {
      await this.activityResourcesRepository.flushToIndexedDb();
      await this.activitySubEventStageRuntimeRepository.flushToIndexedDb();
    }
    return savedRecord ? LocalActivityEventsMapper.toDto(savedRecord) : null;
  }

  private markDeletedRuntimeStateForRemovedDefinitions(
    previous: ActivityEventRecord | null,
    next: ActivityEventRecord | null
  ): boolean {
    if (!previous || !next) {
      return false;
    }
    const removedSubEventIds = this.removedSubEventDefinitionIds(previous, next);
    if (removedSubEventIds.length === 0) {
      return false;
    }
    const parentEventId = `${next.id ?? previous.id ?? ''}`.trim();
    if (!parentEventId) {
      return false;
    }
    const resourceChanges = this.activityResourcesRepository.markRecordsDeletedByParentSubEventIds(
      parentEventId,
      removedSubEventIds
    );
    const stageRuntimeChanges = this.activitySubEventStageRuntimeRepository.markRecordsDeletedByParentSubEventIds(
      parentEventId,
      removedSubEventIds
    );
    const groupChanges = this.eventsRepository.markTournamentGroupsDeletedByParentSubEventIds(
      parentEventId,
      removedSubEventIds
    );
    return resourceChanges > 0 || stageRuntimeChanges > 0 || groupChanges > 0;
  }

  private removedSubEventDefinitionIds(
    previous: ActivityEventRecord,
    next: ActivityEventRecord
  ): string[] {
    const nextIds = new Set(this.subEventDefinitionIds(next));
    return this.subEventDefinitionIds(previous).filter(id => !nextIds.has(id));
  }

  private subEventDefinitionIds(record: ActivityEventRecord): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const addIds = (definitions: readonly SubEventDefinitionDTO[] | null | undefined): void => {
      (definitions ?? []).forEach((definition, index) => {
        const id = `${definition?.id ?? ''}`.trim() || this.fallbackSubEventId(index);
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
    };
    addIds(record.subEventDefinitions);
    (record.slotTemplates ?? []).forEach(template => addIds(template.subEventDefinitions));
    return ids;
  }

  private fallbackSubEventId(index: number): string {
    return `subevent-${Math.max(1, index + 1)}`;
  }

  async trashItem(
    userId: string,
    sourceId: string,
    options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    this.eventsRepository.trashItem(userId, sourceId);
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
  }

  async publishItem(
    userId: string,
    sourceId: string,
    options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    this.eventsRepository.publishItem(userId, sourceId);
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
  }

  async unpublishItem(
    userId: string,
    sourceId: string,
    options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    this.eventsRepository.unpublishItem(userId, sourceId);
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
  }

  async restoreItem(
    userId: string,
    sourceId: string,
    options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    this.eventsRepository.restoreItem(userId, sourceId);
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
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
    if (result?.subEventId) {
      const existing = this.activitySubEventStageRuntimeRepository.peekRecord({
        ownerId: result.sourceId,
        subEventId: result.subEventId
      });
      this.activitySubEventStageRuntimeRepository.replaceRecord(LocalActivitySubEventStageRuntimeMapper.toRecord({
        ownerId: result.sourceId,
        subEventId: result.subEventId,
        stageStatus: result.stageStatus,
        stageStatusReason: result.stageStatusReason ?? null,
        stageStatusUpdatedAt: result.stageStatusUpdatedAt ?? null,
        stageFinalizedAt: result.stageFinalizedAt ?? null,
        stageFinalizedByUserId: result.stageFinalizedByUserId ?? null
      }, existing));
    }
    await this.eventsRepository.flushToIndexedDb();
    await this.activitySubEventStageRuntimeRepository.flushToIndexedDb();
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
      checkoutState?: EventCheckoutState;
      basketItems?: EventCheckoutBasketItem[];
      pricingSummaryRows?: EventCheckoutPricingSummaryRow[];
      lineItems?: EventCheckoutLineItem[];
      totalAmount?: number | null;
      currency?: string | null;
      skipLocalRouteDelay?: boolean;
      counterDelta?: UserMenuCounterDeltasDto | null;
    } = {}
  ): Promise<EventParticipationActionResultDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    let checkoutPayloadSaved = false;
    if (options.checkoutState) {
      if (options.basketItems?.length) {
        await this.saveCheckoutBasketRecord({
          userId: normalizedUserId,
          sourceId: normalizedSourceId,
          slotSourceId: options.slotSourceId ?? null,
          optionalSubEventIds: options.optionalSubEventIds ?? [],
          assetSelections: options.assetSelections ?? [],
          acceptedPolicyIds: options.acceptedPolicyIds ?? [],
          basketItems: options.basketItems,
          pricingSummaryRows: options.pricingSummaryRows ?? [],
          checkoutState: options.checkoutState,
          lineItems: options.lineItems ?? [],
          totalAmount: Number(options.totalAmount) || 0,
          currency: options.currency?.trim() || 'USD',
          pendingReason: options.pendingReason
        });
        checkoutPayloadSaved = true;
      } else {
        await this.updateCheckoutBasketStateRecord({
          userId: normalizedUserId,
          sourceId: normalizedSourceId,
          checkoutState: options.checkoutState,
          resultState: null,
          checkoutSessionId: options.paymentSessionId ?? null
        });
      }
    }
    const existingCheckoutMembership = checkoutPayloadSaved
      ? this.existingCheckoutMembershipRecord(normalizedUserId, normalizedSourceId, options.slotSourceId ?? null)
      : null;
    if (existingCheckoutMembership) {
      const result = LocalEventParticipationActionMapper.toResult(
        existingCheckoutMembership,
        this.resolveDemoActivityUserId(normalizedUserId),
        options
      );
      if (result.membershipStatus === 'accepted' && options.checkoutState) {
        await this.updateCheckoutBasketStateRecord({
          userId: normalizedUserId,
          sourceId: normalizedSourceId,
          checkoutState: options.checkoutState,
          resultState: 'succeeded',
          checkoutSessionId: options.paymentSessionId ?? null
        });
      }
      await this.patchLocalUserActivityCounterDeltas(normalizedUserId, options.counterDelta ?? null);
      await this.eventsRepository.flushToIndexedDb();
      if (options.skipLocalRouteDelay !== true) {
        await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
      }
      return result;
    }
    const record = this.eventsRepository.requestJoin(
      normalizedUserId,
      normalizedSourceId,
      options.slotSourceId ?? null,
      options.bookingConfirmed === true && options.pendingReason !== 'approval' && options.pendingReason !== 'waitlist',
      options.pendingReason === 'waitlist',
      options.pendingReason === 'approval'
    );
    const result = record
      ? LocalEventParticipationActionMapper.toResult(record, this.resolveDemoActivityUserId(normalizedUserId), options)
      : null;
    if (result?.membershipStatus === 'accepted' && options.checkoutState) {
      await this.updateCheckoutBasketStateRecord({
        userId: normalizedUserId,
        sourceId: normalizedSourceId,
        checkoutState: options.checkoutState,
        resultState: 'succeeded',
        checkoutSessionId: options.paymentSessionId ?? null
      });
    }
    await this.patchLocalUserActivityCounterDeltas(normalizedUserId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    if (options.skipLocalRouteDelay !== true) {
      await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    }
    return result;
  }

  private existingCheckoutMembershipRecord(
    userId: string,
    sourceId: string,
    slotSourceId: string | null
  ): ActivityEventRecord | null {
    const normalizedUserId = userId.trim();
    const sourceRecord = this.eventsRepository.queryEventRecordById(normalizedUserId, sourceId.trim());
    const slotRecord = slotSourceId?.trim()
      ? this.eventsRepository.queryEventRecordById(normalizedUserId, slotSourceId.trim())
      : null;
    return [slotRecord, sourceRecord].find(record => this.hasExistingCheckoutMembership(record, normalizedUserId)) ?? null;
  }

  private hasExistingCheckoutMembership(record: ActivityEventRecord | null, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!record || !normalizedUserId) {
      return false;
    }
    return (record.acceptedMemberUserIds ?? []).some(item => item.trim() === normalizedUserId)
      || (record.pendingMemberUserIds ?? []).some(item => item.trim() === normalizedUserId)
      || (record.pendingRequestMemberUserIds ?? []).some(item => item.trim() === normalizedUserId);
  }

  async leaveEvent(
    userId: string,
    sourceId: string,
    options: {
      slotSourceId?: string | null;
      removeMembershipOnly?: boolean;
      checkoutState?: EventCheckoutState | null;
      checkoutResultState?: EventCheckoutResultState | null;
      checkoutSessionId?: string | null;
      counterDelta?: UserMenuCounterDeltasDto | null;
    } = {}
  ): Promise<EventParticipationActionResultDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    if (options.checkoutState) {
      await this.updateCheckoutBasketStateRecord({
        userId: normalizedUserId,
        sourceId: normalizedSourceId,
        checkoutState: options.checkoutState,
        resultState: options.checkoutResultState ?? null,
        checkoutSessionId: options.checkoutSessionId ?? null
      });
    }
    const record = this.eventsRepository.leaveEvent(userId, sourceId, {
      slotSourceId: options.slotSourceId ?? null,
      removeMembershipOnly: options.removeMembershipOnly === true
    });
    await this.patchLocalUserActivityCounterDeltas(normalizedUserId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    return record ? this.leftEventResult(record) : null;
  }

  private leftEventResult(record: ActivityEventRecord): EventParticipationActionResultDTO {
    const acceptedMembers = Math.max(0, Math.trunc(Number(record.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(record.pendingMembers) || 0));
    const capacityTotal = Math.max(acceptedMembers, Math.trunc(Number(record.capacityTotal) || 0));
    return {
      sourceId: record.id,
      slotSourceId: null,
      action: 'leave',
      membershipStatus: 'trashed',
      pendingReason: null,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      full: capacityTotal > 0 && acceptedMembers >= capacityTotal,
      paymentSessionId: null
    };
  }

  private toCheckoutSlot(
    record: ActivityEventRecord,
    slot: EventSlotOccurrenceDTO,
    reservedCount = 0,
    bookedByViewer = false
  ): EventCheckoutSlot {
    const pricing = this.resolveCheckoutSlotPricing(record, slot);
    const capacityTotal = Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
    const acceptedMembers = Math.max(0, Math.trunc(Number(slot.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(slot.pendingMembers) || 0));
    const activeReservations = Math.max(0, Math.trunc(Number(reservedCount) || 0));
    return {
      id: slot.id,
      parentEventId: slot.parentEventId || record.id,
      slotSourceId: slot.id,
      slotTemplateId: slot.slotTemplateId ?? null,
      title: slot.title || record.title,
      timeframe: slot.timeframe || this.formatCheckoutSlotTimeframe(slot),
      startAtIso: slot.startAtIso,
      endAtIso: slot.endAtIso,
      capacityTotal,
      acceptedMembers,
      pendingMembers,
      availableSlots: Math.max(0, capacityTotal - acceptedMembers - pendingMembers - activeReservations),
      bookedByViewer,
      amount: pricing.amount,
      currency: pricing.currency,
      pricingSummaryRows: pricing.rows
    };
  }

  private checkoutSlotFromBasketItem(
    record: ActivityEventRecord,
    item: EventCheckoutBasketItem
  ): EventCheckoutSlot | null {
    const slotId = item.slotSourceId?.trim();
    if (!slotId) {
      return null;
    }
    const selectedDateKey = item.selectedDateKey?.trim() || '';
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    return {
      id: slotId,
      parentEventId: record.id,
      slotSourceId: slotId,
      slotTemplateId: item.slotTemplateId ?? null,
      title: record.title,
      timeframe: item.detail || record.timeframe || 'Selected slot',
      startAtIso: selectedDateKey ? `${selectedDateKey}T00:00:00.000Z` : record.startAtIso,
      endAtIso: selectedDateKey ? `${selectedDateKey}T23:59:59.000Z` : record.endAtIso,
      capacityTotal: quantity,
      acceptedMembers: 0,
      pendingMembers: 0,
      availableSlots: quantity,
      bookedByViewer: item.resultState === 'succeeded',
      amount: Math.max(0, Number(item.amount) || 0),
      currency: item.currency || record.pricing?.currency || 'USD',
      pricingSummaryRows: item.pricingSummaryRows ?? []
    };
  }

  private checkoutReservationCounts(
    items: readonly EventCheckoutBasketItem[],
    kind: 'slot' | 'optional'
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!this.isActiveCheckoutItem(item)) {
        continue;
      }
      const key = kind === 'slot'
        ? (item.kind === 'event' ? item.slotSourceId?.trim() : '')
        : (item.kind === 'sub_event' ? item.subEventId?.trim() : '');
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + Math.max(1, Math.trunc(Number(item.quantity) || 1)));
    }
    return counts;
  }

  private isActiveCheckoutItem(item: EventCheckoutBasketItem | null | undefined): item is EventCheckoutBasketItem {
    if (!item) {
      return false;
    }
    if (item.resultState === 'deleted') {
      return false;
    }
    return item.status === 'draft'
      || item.status === 'confirmed'
      || item.status === 'waiting'
      || item.status === 'approval-pending'
      || item.status === 'approved'
      || item.status === 'pay';
  }

  private checkoutOptionalSubEvents(
    record: ActivityEventRecord,
    reservedCounts: ReadonlyMap<string, number>,
    fallbackCurrency: string
  ): EventCheckoutOptionalSubEvent[] {
    if (record.subEventsEnabled === false) {
      return [];
    }
    const definitionsById = new Map<string, SubEventDefinitionDTO>();
    const addDefinitions = (items: readonly SubEventDefinitionDTO[] | null | undefined): void => {
      for (let index = 0; index < (items?.length ?? 0); index += 1) {
        const item = items?.[index];
        const id = `${item?.id ?? ''}`.trim() || this.fallbackSubEventId(index);
        if (!item || !id || definitionsById.has(id)) {
          continue;
        }
        definitionsById.set(id, { ...item, id });
      }
    };
    addDefinitions(record.subEventDefinitions);
    for (const template of record.slotTemplates ?? []) {
      addDefinitions(template.subEventDefinitions);
    }
    return [...definitionsById.values()]
      .filter(item => item.optional === true)
      .map(item => this.toCheckoutOptionalSubEvent(item, reservedCounts.get(item.id) ?? 0, fallbackCurrency));
  }

  private toCheckoutOptionalSubEvent(
    definition: SubEventDefinitionDTO,
    reservedCount: number,
    fallbackCurrency: string
  ): EventCheckoutOptionalSubEvent {
    const pricing = this.resolveCheckoutOptionalSubEventPricing(definition, fallbackCurrency);
    const capacityTotal = Math.max(0, Math.trunc(Number(definition.capacityMax) || 0));
    const normalizedReservedCount = Math.max(0, Math.trunc(Number(reservedCount) || 0));
    return {
      id: definition.id,
      name: definition.name || definition.id,
      description: definition.description || null,
      startAt: null,
      endAt: null,
      capacityTotal,
      reservedCount: normalizedReservedCount,
      availableCount: Math.max(0, capacityTotal - normalizedReservedCount),
      amount: pricing.amount,
      currency: pricing.currency,
      pricingSummaryRows: pricing.rows
    };
  }

  private checkoutSlotDays(slots: readonly EventCheckoutSlot[]): EventCheckoutSlotDay[] {
    const grouped = new Map<string, EventCheckoutSlotDay>();
    for (const slot of slots) {
      const dateKey = this.checkoutDateKey(slot.startAtIso);
      if (!dateKey) {
        continue;
      }
      const existing = grouped.get(dateKey);
      if (!existing) {
        grouped.set(dateKey, {
          dateKey,
          slotCount: 1,
          availableSlots: Math.max(0, Math.trunc(Number(slot.availableSlots) || 0)),
          lowestAmount: Math.max(0, Number(slot.amount) || 0),
          currency: slot.currency || 'USD'
        });
        continue;
      }
      grouped.set(dateKey, {
        ...existing,
        slotCount: existing.slotCount + 1,
        availableSlots: existing.availableSlots + Math.max(0, Math.trunc(Number(slot.availableSlots) || 0)),
        lowestAmount: Math.min(existing.lowestAmount, Math.max(0, Number(slot.amount) || 0)),
        currency: slot.currency || existing.currency
      });
    }
    return [...grouped.values()];
  }

  private resolveCheckoutSlotPricing(
    record: ActivityEventRecord,
    slot: EventSlotOccurrenceDTO
  ): { amount: number; currency: string; rows: EventCheckoutPricingSummaryRow[] } {
    const normalized = PricingBuilder.compactPricingConfig(record.pricing, {
      context: 'event',
      slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(record.slotTemplates ?? []),
      allowSlotFeatures: (record.slotTemplates?.length ?? 0) > 0
    });
    const currency = normalized.currency || 'USD';
    if (!normalized.enabled) {
      return {
        amount: 0,
        currency,
        rows: []
      };
    }
    const slotTemplateId = slot.slotTemplateId ?? null;
    const previewBase = normalized.slotPricingEnabled && slotTemplateId
      ? normalized.slotOverrides.find(item => item.slotId === slotTemplateId)?.price ?? normalized.basePrice
      : normalized.basePrice;
    const rows: EventCheckoutPricingSummaryRow[] = [{
      key: normalized.slotPricingEnabled && slotTemplateId ? `base:${slotTemplateId}` : 'base',
      label: normalized.slotPricingEnabled && slotTemplateId ? 'Slot base price' : 'Base price',
      detail: null,
      amount: previewBase,
      currency,
      multiplier: 1
    }];
    const capacityTotal = Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
    const capacityFilledPercent = capacityTotal > 0
      ? Math.round((Math.max(0, Math.trunc(Number(slot.acceptedMembers) || 0)) / capacityTotal) * 100)
      : 0;
    const hoursUntilStart = this.resolveHoursUntilStart(slot.startAtIso);
    let nextPrice = previewBase;
    if ((normalized.mode === 'demand-based' || normalized.mode === 'hybrid') && normalized.demandRulesEnabled) {
      for (const rule of normalized.demandRules) {
        if (!this.matchesPricingDemandRule(rule, capacityFilledPercent, slotTemplateId)) {
          continue;
        }
        const previousPrice = nextPrice;
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
        rows.push({
          key: `demand:${rule.id}`,
          label: 'Demand pricing',
          detail: this.describePricingAction(rule.action),
          amount: this.roundMoney(nextPrice - previousPrice),
          currency,
          multiplier: 1
        });
      }
    }
    if ((normalized.mode === 'time-based' || normalized.mode === 'hybrid') && normalized.timeRulesEnabled) {
      for (const rule of normalized.timeRules) {
        if (!this.matchesPricingTimeRule(rule, hoursUntilStart, slotTemplateId, slot.startAtIso)) {
          continue;
        }
        const previousPrice = nextPrice;
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
        rows.push({
          key: `time:${rule.id}`,
          label: 'Time pricing',
          detail: this.describePricingAction(rule.action),
          amount: this.roundMoney(nextPrice - previousPrice),
          currency,
          multiplier: 1
        });
      }
    }
    if (normalized.minPrice !== null) {
      nextPrice = Math.max(normalized.minPrice, nextPrice);
    }
    if (normalized.maxPrice !== null) {
      nextPrice = Math.min(normalized.maxPrice, nextPrice);
    }
    return {
      amount: this.roundMoney(this.applyPricingRounding(nextPrice, normalized.rounding)),
      currency,
      rows
    };
  }

  private resolveCheckoutOptionalSubEventPricing(
    definition: SubEventDefinitionDTO,
    fallbackCurrency: string
  ): { amount: number; currency: string; rows: EventCheckoutPricingSummaryRow[] } {
    const normalized = PricingBuilder.compactPricingConfig(definition.pricing, {
      context: 'subevent',
      allowSlotFeatures: false
    });
    const currency = normalized.currency || fallbackCurrency || 'USD';
    if (!normalized.enabled) {
      return { amount: 0, currency, rows: [] };
    }
    const amount = Math.max(0, Number(normalized.basePrice) || 0);
    return {
      amount,
      currency,
      rows: [{
        key: `subevent:${definition.id}:base`,
        label: definition.name || 'Optional sub event',
        detail: null,
        amount,
        currency,
        multiplier: 1
      }]
    };
  }

  private matchesPricingDemandRule(
    rule: { operator: string; capacityFilledPercent: number; appliesTo: string; slotIds: string[] },
    capacityFilledPercent: number,
    slotTemplateId: string | null
  ): boolean {
    if (rule.appliesTo === 'selected_slots' && (!slotTemplateId || !(rule.slotIds ?? []).includes(slotTemplateId))) {
      return false;
    }
    return rule.operator === 'lte'
      ? capacityFilledPercent <= rule.capacityFilledPercent
      : capacityFilledPercent >= rule.capacityFilledPercent;
  }

  private matchesPricingTimeRule(
    rule: { trigger: string; offsetValue: number | null; specificDateStart?: string | null; specificDateEnd?: string | null; appliesTo: string; slotIds: string[] },
    hoursUntilStart: number,
    slotTemplateId: string | null,
    comparisonIso: string
  ): boolean {
    if (rule.appliesTo === 'selected_slots' && (!slotTemplateId || !(rule.slotIds ?? []).includes(slotTemplateId))) {
      return false;
    }
    if (rule.trigger === 'specific_date') {
      const start = (rule.specificDateStart ?? '').trim();
      const end = (rule.specificDateEnd ?? '').trim();
      const comparisonDate = comparisonIso.slice(0, 10);
      return Boolean(start && end && comparisonDate && comparisonDate >= start && comparisonDate <= end);
    }
    if (rule.trigger === 'hours_before_start') {
      return hoursUntilStart <= Math.max(0, Number(rule.offsetValue) || 0);
    }
    return hoursUntilStart <= Math.max(0, Number(rule.offsetValue) || 0) * 24;
  }

  private applyPricingAction(currentPrice: number, action: { kind: string; value: number }): number {
    const value = Number(action.value) || 0;
    if (action.kind === 'set_exact_price') {
      return Math.max(0, value);
    }
    if (action.kind === 'increase_amount') {
      return Math.max(0, currentPrice + value);
    }
    if (action.kind === 'decrease_amount') {
      return Math.max(0, currentPrice - value);
    }
    if (action.kind === 'decrease_percent') {
      return Math.max(0, currentPrice * (1 - (value / 100)));
    }
    return Math.max(0, currentPrice * (1 + (value / 100)));
  }

  private describePricingAction(action: { kind: string; value: number }): string {
    const value = Number(action.value) || 0;
    if (action.kind === 'set_exact_price') {
      return `Set to ${value}`;
    }
    if (action.kind === 'increase_amount') {
      return `+${value}`;
    }
    if (action.kind === 'decrease_amount') {
      return `-${value}`;
    }
    if (action.kind === 'decrease_percent') {
      return `-${value}%`;
    }
    return `+${value}%`;
  }

  private applyPricingRounding(price: number, rounding: string): number {
    if (rounding === 'whole') {
      return Math.round(price);
    }
    if (rounding === 'half') {
      return Math.round(price * 2) / 2;
    }
    return this.roundMoney(price);
  }

  private checkoutSlotMatchesOrder(slot: EventSlotOccurrenceDTO, query: EventCheckoutSlotsQuery): boolean {
    const endMs = this.sortableDateMs(slot.endAtIso || slot.startAtIso);
    if (!endMs) {
      return false;
    }
    const past = endMs <= Date.now();
    return query.order === 'past' ? past : !past;
  }

  private checkoutSlotOverlapsRange(slot: EventSlotOccurrenceDTO, query: EventCheckoutSlotsQuery): boolean {
    const start = this.dateOnlyMs((query.rangeStart || query.anchorDate || '').slice(0, 10));
    let end = this.dateOnlyMs((query.rangeEnd || '').slice(0, 10));
    if (this.checkoutQueryIsUpcomingFromDate(query, start, end)) {
      end = 0;
    }
    if (!start && !end) {
      return true;
    }
    const slotStart = this.sortableDateMs(slot.startAtIso);
    const slotEnd = this.sortableDateMs(slot.endAtIso || slot.startAtIso) || slotStart;
    if (start && slotEnd < start) {
      return false;
    }
    if (end && slotStart > end + 86_399_999) {
      return false;
    }
    return true;
  }

  private checkoutQueryIsUpcomingFromDate(query: EventCheckoutSlotsQuery, start: number, end: number): boolean {
    return start > 0
      && end > 0
      && start === end
      && query.view === 'day'
      && query.order !== 'past';
  }

  private checkoutCursorOffset(cursor: string | null | undefined): number {
    return Math.max(0, Math.trunc(Number(cursor) || 0));
  }

  private checkoutDateKey(value: string | null | undefined): string {
    const ms = this.sortableDateMs(value);
    return ms ? new Date(ms).toISOString().slice(0, 10) : '';
  }

  private dateOnlyMs(value: string): number {
    if (!value) {
      return 0;
    }
    const ms = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : 0;
  }

  private sortableDateMs(value: string | null | undefined): number {
    const ms = Date.parse(`${value ?? ''}`.trim());
    return Number.isFinite(ms) ? ms : 0;
  }

  private resolveHoursUntilStart(startAtIso: string): number {
    const startMs = this.sortableDateMs(startAtIso);
    return startMs ? Math.max(0, Math.round((startMs - Date.now()) / (60 * 60 * 1000))) : 0;
  }

  private formatCheckoutSlotTimeframe(slot: EventSlotOccurrenceDTO): string {
    const start = this.sortableDateMs(slot.startAtIso);
    const end = this.sortableDateMs(slot.endAtIso);
    if (!start || !end) {
      return slot.timeframe || '';
    }
    return `${new Date(start).toLocaleDateString('en-US')} · ${new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private async patchLocalUserActivityCounterDeltas(
    userId: string,
    delta: UserMenuCounterDeltasDto | null
  ): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !delta) {
      return;
    }
    await this.usersService.patchUserActivityCounterDeltas(normalizedUserId, delta);
  }

  async createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    const session: EventCheckoutSession = {
      id: `checkout-${Date.now()}`,
      provider: 'dummy',
      mode: 'dummy',
      status: 'approved',
      amount: Math.max(0, Number(request.totalAmount) || 0),
      currency: request.currency?.trim() || 'USD',
      paymentUrl: null
    };
    await this.saveCheckoutBasketRecord(
      this.withCheckoutBasketState(request, 'confirmed', session.id)
    );
    return session;
  }

  async payCheckoutSession(
    request: EventCheckoutRequest,
    paymentSessionId: string
  ): Promise<EventCheckoutSession | null> {
    await this.waitForRouteDelay(LocalEventsService.EVENTS_CHECKOUT_ROUTE);
    const session: EventCheckoutSession = {
      id: paymentSessionId.trim() || `checkout-${Date.now()}`,
      provider: 'dummy',
      mode: 'dummy',
      status: 'approved',
      amount: Math.max(0, Number(request.totalAmount) || 0),
      currency: request.currency?.trim() || 'USD',
      paymentUrl: null
    };
    await this.saveCheckoutBasketRecord(
      this.withCheckoutBasketState(request, 'pay', session.id)
    );
    return session;
  }

  private withCheckoutBasketState(
    request: EventCheckoutRequest,
    checkoutState: EventCheckoutState,
    checkoutSessionId: string
  ): EventCheckoutRequest {
    const normalizedSessionId = checkoutSessionId.trim();
    return {
      ...request,
      checkoutState,
      basketItems: (request.basketItems ?? []).map(item => ({
        ...item,
        status: checkoutState ?? item.status,
        checkoutSessionId: item.checkoutSessionId?.trim() || normalizedSessionId
      }))
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
