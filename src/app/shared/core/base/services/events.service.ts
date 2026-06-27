import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type {
  EventTournamentGroupDeleteRequestDTO,
  EventTournamentGroupsQueryDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentGroupDTO,
  EventTournamentGroupUpsertRequestDTO,
  EventTournamentStageGroupsQueryDTO,
  SubEventLeaderboardEntryUpsertRequestDTO,
  SubEventLeaderboardState
} from '../../contracts/event.interface';
import type { ActivityPendingReason } from '../../common/constants';
import type { ActivitiesFeedFilters, ActivitiesPageRequest } from '../../contracts';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackQueryDto,
  EventFeedbackDetailDto,
  EventParticipationActionResultDTO,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackPageQueryDto,
  EventFeedbackPageResultDto,
  EventFeedbackStateDto
} from '../../contracts/activity.interface';
import { LocalEventsService } from '../../local';
import { HttpEventsService } from '../../http';
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
} from '../../contracts/activity.interface';
import type { IEventsService } from '../../contracts/activity.interface';
import type { ListQuery, PageResult } from '../../../ui';
import { AppContext } from '../../../ui/context';
import { toActivitiesPageRequest, toActivityEventActivitiesQuery } from '../mappers';
import { BaseRouteModeService } from './base-route-mode.service';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService extends BaseRouteModeService implements IEventsService {
  private readonly localEventsService = inject(LocalEventsService);
  private readonly httpEventsService = inject(HttpEventsService);
  private readonly appCtx = inject(AppContext);
  private readonly usersService = inject(UsersService);

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

  async queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.queryActivitiesEventDTOPage(query, signal);
    }
    return this.httpEventsService.queryActivitiesEventDTOPage(query, signal);
  }

  async loadActivityEvents(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PageResult<ActivityEventDTO>> {
    const request = toActivitiesPageRequest(query);
    const activeUserId = this.resolveActiveUserId();
    const page = await this.queryActivitiesEventDTOPage(
      toActivityEventActivitiesQuery(request, activeUserId),
      options.signal
    );
    if (this.isCalendarActivitiesView(request.view)) {
      return this.paginateActivityEventDTOs(page.items, request);
    }
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  async saveActivityEvent(
    payload: ActivityEventDetailDTO
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

  async loadEventDetailById(userId: string, eventId: string): Promise<ActivityEventDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    return this.eventsService.loadEventDetailById(normalizedUserId, normalizedEventId);
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
    return this.eventsService.loadSubEventsById(normalizedUserId, normalizedEventId, query);
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

  applyStageAction(request: ActivityEventStageActionRequestDTO): Promise<ActivityEventStageActionResultDTO | null> {
    return this.eventsService.applyStageAction(request);
  }

  querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    return this.eventsService.querySubEventLeaderboard(eventId, subEventId);
  }

  queryTournamentGroups(query: EventTournamentGroupsQueryDTO): Promise<EventTournamentGroupsStateDTO | null> {
    return this.eventsService.queryTournamentGroups(query);
  }

  queryTournamentStageGroups(query: EventTournamentStageGroupsQueryDTO): Promise<EventTournamentGroupDTO[]> {
    return this.eventsService.queryTournamentStageGroups(query);
  }

  saveTournamentGroup(request: EventTournamentGroupUpsertRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    return this.eventsService.saveTournamentGroup(request);
  }

  deleteTournamentGroup(request: EventTournamentGroupDeleteRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    return this.eventsService.deleteTournamentGroup(request);
  }

  upsertSubEventLeaderboardEntry(request: SubEventLeaderboardEntryUpsertRequestDTO): Promise<SubEventLeaderboardState | null> {
    return this.eventsService.upsertSubEventLeaderboardEntry(request);
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
  ): Promise<EventParticipationActionResultDTO | null> {
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

  loadEventFeedback(query: EventFeedbackQueryDto): Promise<EventFeedbackDetailDto> {
    return this.eventsService.loadEventFeedback(query);
  }

  submitEventFeedback(userId: string, request: EventFeedbackDetailDto): Promise<void> {
    return this.eventsService.submitEventFeedback(userId, request);
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

  async syncEventSnapshot(payload: ActivityEventDetailDTO): Promise<ActivityEventRecord | null> {
    return this.eventsService.syncEventSnapshot(payload);
  }

  private resolveActiveUserId(): string {
    const activeUserProfileId = this.appCtx.activeUserProfile()?.id?.trim();
    if (activeUserProfileId) {
      return activeUserProfileId;
    }
    const activeUserId = this.appCtx.getActiveUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo' && session.userId.trim().length > 0) {
      return session.userId.trim();
    }
    if (session?.kind === 'firebase' && session.profile.id.trim().length > 0) {
      return session.profile.id.trim();
    }
    return this.usersService.peekCachedUsers()[0]?.id ?? '';
  }

  private paginateActivityEventDTOs(
    items: readonly ActivityEventDTO[],
    request: ActivitiesPageRequest
  ): PageResult<ActivityEventDTO> {
    if (this.isCalendarActivitiesView(request.view)) {
      const range = this.activitiesQueryRange(request);
      const filteredItems = range
        ? items.filter(item => this.doesActivityEventDTOOverlapRange(item, range.start, range.end))
        : [...items];
      return {
        items: filteredItems,
        total: filteredItems.length
      };
    }

    const startIndex = request.page * request.pageSize;
    return {
      items: items.slice(startIndex, startIndex + request.pageSize),
      total: items.length
    };
  }

  private activitiesQueryRange(request: ActivitiesPageRequest): { start: Date; end: Date } | null {
    const start = this.parseSmartListDate(request.rangeStart);
    const end = this.parseSmartListDate(request.rangeEnd);
    if (!start || !end) {
      return null;
    }
    return {
      start,
      end: AppUtils.dateOnly(end)
    };
  }

  private doesActivityEventDTOOverlapRange(item: ActivityEventDTO, start: Date, end: Date): boolean {
    const range = this.resolveActivityEventDTORange(item);
    if (!range) {
      return false;
    }
    return this.dateRangeOverlaps(
      AppUtils.dateOnly(range.start),
      AppUtils.dateOnly(range.end),
      start,
      end
    );
  }

  private dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
  }

  private resolveActivityEventDTORange(item: ActivityEventDTO): { start: Date; end: Date } | null {
    const start = new Date(item.startAtIso);
    const end = new Date(item.endAtIso || new Date(start.getTime() + (2 * 60 * 60 * 1000)).toISOString());
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return end.getTime() > start.getTime()
      ? { start, end }
      : { start, end: new Date(start.getTime() + (2 * 60 * 60 * 1000)) };
  }

  private isCalendarActivitiesView(view: ActivitiesPageRequest['view']): boolean {
    return view === 'week' || view === 'month';
  }

  private parseSmartListDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10) - 1;
      const day = Number.parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return AppUtils.dateOnly(parsed);
  }
}
