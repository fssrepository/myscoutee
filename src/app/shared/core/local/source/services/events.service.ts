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
import type { ActivitiesFeedFilters, ListQuery } from '../../../contracts';
import type { UserMenuCounterDeltasDto } from '../../../contracts/user.interface';
import { EventFeedbackDetailDto, EventFeedbackPageResultDto } from '../../../contracts/activity.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalUsersService } from './users.service';
import {
  LocalActivityEventDetailsMapper,
  LocalActivitySubEventStageRuntimeMapper,
  LocalActivityResourcesMapper,
  LocalActivityEventsMapper,
  LocalEventFeedbackMapper,
  LocalEventParticipationActionMapper,
  LocalUsersMapper
} from '../mappers';
import type {
  ActivityEventDetailDTO,
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
    const baseSlots = LocalActivityEventsMapper.toSubEventsSlots(result.parentEventId, result.parentRecord, query);
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
      slots: LocalActivityEventsMapper.withSubEventStates(baseSlots, resourceStatesByKey, stageRuntimeByKey, normalizedUserId)
    };
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
      skipLocalRouteDelay?: boolean;
      counterDelta?: UserMenuCounterDeltasDto | null;
    } = {}
  ): Promise<EventParticipationActionResultDTO | null> {
    const record = this.eventsRepository.requestJoin(
      userId,
      sourceId,
      options.slotSourceId ?? null,
      options.bookingConfirmed === true && options.pendingReason !== 'approval' && options.pendingReason !== 'waitlist',
      options.pendingReason === 'waitlist'
    );
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
    await this.eventsRepository.flushToIndexedDb();
    if (options.skipLocalRouteDelay !== true) {
      await this.waitForRouteDelay(LocalEventsService.EVENTS_ROUTE);
    }
    return record
      ? LocalEventParticipationActionMapper.toResult(record, this.resolveDemoActivityUserId(userId), options)
      : null;
  }

  async leaveEvent(
    userId: string,
    sourceId: string,
    options: {
      counterDelta?: UserMenuCounterDeltasDto | null;
    } = {}
  ): Promise<EventParticipationActionResultDTO | null> {
    const record = this.eventsRepository.leaveEvent(userId, sourceId);
    await this.patchLocalUserActivityCounterDeltas(userId, options.counterDelta ?? null);
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
