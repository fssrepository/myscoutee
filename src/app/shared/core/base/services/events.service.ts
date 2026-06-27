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
import type { ActivitiesFeedFilters, ListQuery, PageResult } from '../../contracts';
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
import { AppContext } from '../../../ui/context';
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
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localEventsService.queryActivitiesEventDTOPage(userId, query, signal);
    }
    return this.httpEventsService.queryActivitiesEventDTOPage(userId, query, signal);
  }

  async loadActivityEvents(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PageResult<ActivityEventDTO>> {
    const activeUserId = this.resolveActiveUserId();
    const page = await this.queryActivitiesEventDTOPage(
      activeUserId,
      query,
      options.signal
    );
    if (this.isCalendarActivitiesView(query.view)) {
      const items = AppUtils.filterItemsByDateOnlyRange(
        page.items,
        query.rangeStart,
        query.rangeEnd,
        item => item.startAtIso,
        item => item.endAtIso
      );
      return {
        items,
        total: items.length
      };
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

  peekKnownItemById(userId: string, itemId: string): ActivityEventDTO | null {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    return this.eventsService.peekKnownItemById(userId, normalizedItemId);
  }

  peekKnownRecordById(userId: string, itemId: string): ActivityEventRecord | null {
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

  async queryKnownRecordById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const cached = this.peekKnownRecordById(userId, normalizedItemId);
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

  private isCalendarActivitiesView(view: string | undefined): boolean {
    return view === 'week' || view === 'month';
  }
}
