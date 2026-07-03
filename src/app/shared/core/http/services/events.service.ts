import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PricingBuilder } from '../../../core/base/builders';
import type { ActivityPendingReason } from '../../common/constants';
import type {
  EventTournamentGroupDeleteRequestDTO,
  EventTournamentGroupsQueryDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentGroupDTO,
  EventTournamentGroupUpsertRequestDTO,
  EventTournamentStageGroupsQueryDTO,
  EventTournamentStageDTO,
  SubEventLeaderboardEntryUpsertRequestDTO,
  SubEventLeaderboardState
} from '../../contracts/event.interface';
import {
  ActivityEventDetailDTO,
  EventFeedbackDetailDto,
  EventFeedbackPageResultDto,
  type ActivityEventDTO
} from '../../contracts/activity.interface';
import type { ActivitiesFeedFilters, ListQuery } from '../../contracts';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventParticipationActionResultDTO,
  EventFeedbackQueryDto,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackPageQueryDto,
  EventFeedbackStatDto,
  EventFeedbackStatQueryDto,
  EventFeedbackStateDto
} from '../../contracts/activity.interface';
import type {
  UserMenuCounterDeltasDto
} from '../../contracts/user.interface';
import type {
  ActivityEventStageActionRequestDTO,
  ActivityEventStageActionResultDTO,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventRecord,
  ActivityEventSubEventsQueryDTO,
  SubEventsSlotDTO,
  ActivityEventSubEventsResultDTO,
  ActivityEventScopeFilter
} from '../../contracts/activity.interface';
import type { IEventsService } from '../../contracts/activity.interface';

interface HttpEventsFilterRequest {
  userId: string;
  filter: ActivityEventScopeFilter;
  hostingPublicationFilter: 'all' | 'drafts';
  secondaryFilter?: 'recent' | 'relevant' | 'past';
  sort?: 'date' | 'distance' | 'relevance';
  view?: 'month' | 'week' | 'day' | 'distance';
  limit?: number;
  cursor?: string | null;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HttpEventsService implements IEventsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events', userId);
  }

  peekItemsByUser(_userId: string): ActivityEventRecord[] {
    return [];
  }

  async queryInvitationItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events/invitations', userId);
  }

  async queryEventItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events/attending', userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events/trash', userId);
  }

  async queryActivitiesEventDTOPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    try {
      const response = await this.requestWithAbort(
        this.http.post<ActivityEventDTO[] | ActivityEventPageResultDTO | null>(
          `${this.apiBaseUrl}/activities/events/filter`,
          this.toHttpEventsFilterRequest(normalizedUserId, query)
        ),
        signal
      );
      if (Array.isArray(response)) {
        const items = this.cloneDTOs(response);
        return {
          items,
          total: items.length,
          nextCursor: null
        };
      }
      const items = this.cloneDTOs(response?.items);
      return {
        items,
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : items.length,
        nextCursor: typeof response?.nextCursor === 'string' ? response.nextCursor : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  private toHttpEventsFilterRequest(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>
  ): HttpEventsFilterRequest {
    const view = this.activitiesView(query);
    const secondaryFilter = this.activitiesSecondaryFilter(query);
    return {
      userId,
      filter: this.activitiesEventScopeFilter(query),
      hostingPublicationFilter: this.activitiesHostingPublicationFilter(query),
      secondaryFilter,
      sort: this.activitiesSort(query, view, secondaryFilter),
      view,
      limit: Math.max(1, Math.trunc(Number(query.pageSize) || 10)),
      cursor: query.cursor ?? null,
      anchorDate: query.anchorDate,
      rangeStart: query.rangeStart,
      rangeEnd: query.rangeEnd
    };
  }

  private activitiesEventScopeFilter(query: ListQuery<ActivitiesFeedFilters>): ActivityEventScopeFilter {
    const value = query.filters?.eventScopeFilter;
    if (
      value === 'all'
      || value === 'active-events'
      || value === 'pending'
      || value === 'invitations'
      || value === 'my-events'
      || value === 'drafts'
      || value === 'trash'
    ) {
      return value;
    }
    return 'active-events';
  }

  private activitiesHostingPublicationFilter(query: ListQuery<ActivitiesFeedFilters>): HttpEventsFilterRequest['hostingPublicationFilter'] {
    return query.filters?.hostingPublicationFilter === 'drafts' ? 'drafts' : 'all';
  }

  private activitiesSecondaryFilter(query: ListQuery<ActivitiesFeedFilters>): HttpEventsFilterRequest['secondaryFilter'] {
    const value = query.filters?.secondaryFilter;
    return value === 'relevant' || value === 'past' ? value : 'recent';
  }

  private activitiesView(query: ListQuery<ActivitiesFeedFilters>): HttpEventsFilterRequest['view'] {
    const value = query.view;
    return value === 'month' || value === 'week' || value === 'distance' ? value : 'day';
  }

  private activitiesSort(
    query: ListQuery<ActivitiesFeedFilters>,
    view: HttpEventsFilterRequest['view'],
    secondaryFilter: HttpEventsFilterRequest['secondaryFilter']
  ): HttpEventsFilterRequest['sort'] {
    const value = query.sort;
    if (value === 'date' || value === 'distance' || value === 'relevance') {
      return value;
    }
    if (view === 'distance') {
      return 'distance';
    }
    return secondaryFilter === 'relevant' ? 'relevance' : 'date';
  }

  async loadEventDetailById(userId: string, eventId: string): Promise<ActivityEventDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    try {
      const response = await this.http
        .get<Partial<ActivityEventDetailDTO> | null>(`${this.apiBaseUrl}/activities/events/detail`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('eventId', normalizedEventId)
        })
        .toPromise();
      return response ? new ActivityEventDetailDTO().apply(response) : null;
    } catch {
      return null;
    }
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
    try {
      const response = await this.http
        .post<{ mode?: string | null; slots?: SubEventsSlotDTO[] | null } | null>(
          `${this.apiBaseUrl}/activities/events/sub-events`,
          {
            ...(query ?? {}),
            userId: normalizedUserId,
            eventId: normalizedEventId
          }
        )
        .toPromise();
      const mode = response?.mode;
      if (mode !== 'Casual' && mode !== 'Tournament') {
        return null;
      }
      return {
        mode,
        slots: response?.slots ?? []
      };
    } catch {
      return null;
    }
  }

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let settled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request$.subscribe({
        next: value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        },
        complete: () => cleanup()
      });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  async queryExploreItems(userId: string): Promise<ActivityEventRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .post<ActivityEventRecord[] | null>(`${this.apiBaseUrl}/activities/events/explore`, {
          userId: normalizedUserId
        })
        .toPromise();
      return this.cloneRecords(response);
    } catch {
      return [];
    }
  }

  peekExploreItems(_userId: string): ActivityEventRecord[] {
    return [];
  }

  peekKnownItemById(_userId: string, _itemId: string): ActivityEventDTO | null {
    return null;
  }

  async queryEventExplorePage(query: ActivityEventExploreQuery): Promise<ActivityEventExploreQueryResult> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }
    try {
      const response = await this.http
        .post<ActivityEventRecord[] | ActivityEventExploreQueryResult | null>(
          `${this.apiBaseUrl}/activities/events/explore`,
          {
            ...query,
            userId: normalizedUserId,
            excludedSourceIds: this.normalizeSourceIds(query.excludedSourceIds)
          }
        )
        .toPromise();
      if (Array.isArray(response)) {
        const records = this.cloneRecords(response);
        return {
          records,
          total: records.length,
          nextCursor: null
        };
      }
      const records = this.cloneRecords(response?.records);
      return {
        records,
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : records.length,
        nextCursor: typeof response?.nextCursor === 'string' ? response.nextCursor : null
      };
    } catch {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  peekEventExplorePage(_query: ActivityEventExploreQuery): ActivityEventExploreQueryResult {
    return {
      records: [],
      total: 0,
      nextCursor: null
    };
  }

  async trashItem(
    userId: string,
    sourceId: string,
    _options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    await this.postVoid('/activities/events/trash', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async publishItem(
    userId: string,
    sourceId: string,
    _options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    await this.postVoid('/activities/events/publish', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async unpublishItem(
    userId: string,
    sourceId: string,
    _options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    await this.postVoid('/activities/events/unpublish', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async restoreItem(
    userId: string,
    sourceId: string,
    _options: { counterDelta?: UserMenuCounterDeltasDto | null } = {}
  ): Promise<void> {
    await this.postVoid('/activities/events/restore', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async takeOverItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/take-over', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  waitForEventMutationDelay(): Promise<void> {
    return Promise.resolve();
  }

  async applyStageAction(request: ActivityEventStageActionRequestDTO): Promise<ActivityEventStageActionResultDTO | null> {
    const rawSubEventIndex = Number(request.subEventIndex);
    const response = await this.http
      .post<ActivityEventStageActionResultDTO | null>(`${this.apiBaseUrl}/activities/events/stage-action`, {
        userId: request.userId.trim(),
        sourceId: request.sourceId.trim(),
        slotSourceId: request.slotSourceId?.trim() || null,
        subEventId: request.subEventId?.trim() || null,
        subEventIndex: Number.isFinite(rawSubEventIndex)
          ? Math.max(0, Math.trunc(rawSubEventIndex))
          : null,
        action: request.action.trim(),
        reason: request.reason?.trim() || null
      })
      .toPromise();
    return response ?? null;
  }

  async querySubEventLeaderboard(eventId: string, subEventId: string): Promise<SubEventLeaderboardState | null> {
    const normalizedEventId = eventId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedEventId || !normalizedSubEventId) {
      return null;
    }
    const response = await this.http
      .get<SubEventLeaderboardState | null>(`${this.apiBaseUrl}/activities/events/leaderboard`, {
        params: new HttpParams()
          .set('eventId', normalizedEventId)
          .set('subEventId', normalizedSubEventId)
      })
      .toPromise();
    return this.normalizeLeaderboardState(response, normalizedEventId, normalizedSubEventId);
  }

  async queryTournamentGroups(query: EventTournamentGroupsQueryDTO): Promise<EventTournamentGroupsStateDTO | null> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    const response = await this.http
      .get<EventTournamentGroupsStateDTO | null>(`${this.apiBaseUrl}/activities/events/tournament-groups`, {
        params: new HttpParams()
          .set('userId', normalizedUserId)
          .set('eventId', normalizedEventId)
      })
      .toPromise();
    return this.normalizeTournamentGroupsState(response, normalizedEventId);
  }

  async queryTournamentStageGroups(query: EventTournamentStageGroupsQueryDTO): Promise<EventTournamentGroupDTO[]> {
    const normalizedEventId = query.eventId.trim();
    const normalizedSlotId = `${query.slotId ?? ''}`.trim();
    const normalizedStageId = query.stageId.trim();
    if (!normalizedEventId || !normalizedStageId) {
      return [];
    }
    let params = new HttpParams()
      .set('eventId', normalizedEventId)
      .set('stageId', normalizedStageId);
    if (normalizedSlotId) {
      params = params.set('slotId', normalizedSlotId);
    }
    const response = await this.http
      .get<EventTournamentGroupDTO[] | null>(`${this.apiBaseUrl}/activities/events/tournament-groups/stage-groups`, {
        params
      })
      .toPromise();
    return this.normalizeTournamentGroupList(response, normalizedStageId);
  }

  async saveTournamentGroup(request: EventTournamentGroupUpsertRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    const response = await this.http
      .post<EventTournamentGroupsStateDTO | null>(`${this.apiBaseUrl}/activities/events/tournament-groups/group`, {
        actorUserId: request.actorUserId.trim(),
        eventId: request.eventId.trim(),
        slotId: request.slotId?.trim() || null,
        subEventId: request.subEventId.trim(),
        groupId: request.groupId?.trim() || null,
        name: request.name.trim(),
        capacityMin: Math.max(0, Math.trunc(Number(request.capacityMin) || 0)),
        capacityMax: Math.max(0, Math.trunc(Number(request.capacityMax) || 0))
      })
      .toPromise();
    return this.normalizeTournamentGroupsState(response, request.slotId?.trim() || request.eventId);
  }

  async deleteTournamentGroup(request: EventTournamentGroupDeleteRequestDTO): Promise<EventTournamentGroupsStateDTO | null> {
    const response = await this.http
      .post<EventTournamentGroupsStateDTO | null>(`${this.apiBaseUrl}/activities/events/tournament-groups/group/delete`, {
        actorUserId: request.actorUserId.trim(),
        eventId: request.eventId.trim(),
        slotId: request.slotId?.trim() || null,
        subEventId: request.subEventId.trim(),
        groupId: request.groupId.trim()
      })
      .toPromise();
    return this.normalizeTournamentGroupsState(response, request.slotId?.trim() || request.eventId);
  }

  async upsertSubEventLeaderboardEntry(request: SubEventLeaderboardEntryUpsertRequestDTO): Promise<SubEventLeaderboardState | null> {
    const normalizedEventId = request.eventId.trim();
    const normalizedSubEventId = request.subEventId.trim();
    if (!normalizedEventId || !normalizedSubEventId || !request.groupId.trim()) {
      return null;
    }
    const response = await this.http
      .post<SubEventLeaderboardState | null>(`${this.apiBaseUrl}/activities/events/leaderboard/entry`, {
        actorUserId: request.actorUserId.trim(),
        eventId: normalizedEventId,
        subEventId: normalizedSubEventId,
        groupId: request.groupId.trim(),
        mode: request.mode === 'Fifa' ? 'Fifa' : 'Score',
        memberId: request.memberId?.trim() || null,
        scoreValue: request.scoreValue === null || request.scoreValue === undefined
          ? null
          : Math.trunc(Number(request.scoreValue) || 0),
        note: request.note?.trim() || '',
        homeMemberId: request.homeMemberId?.trim() || null,
        awayMemberId: request.awayMemberId?.trim() || null,
        homeScore: request.homeScore === null || request.homeScore === undefined
          ? null
          : Math.max(0, Math.trunc(Number(request.homeScore) || 0)),
        awayScore: request.awayScore === null || request.awayScore === undefined
          ? null
          : Math.max(0, Math.trunc(Number(request.awayScore) || 0))
      })
      .toPromise();
    return this.normalizeLeaderboardState(response, normalizedEventId, normalizedSubEventId);
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
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    const response = await this.http
      .post<EventParticipationActionResultDTO | null>(`${this.apiBaseUrl}/activities/events/join`, {
        userId: normalizedUserId,
        type: 'events',
        sourceId: normalizedSourceId,
        slotSourceId: options.slotSourceId?.trim() || null,
        optionalSubEventIds: [...(options.optionalSubEventIds ?? [])],
        assetSelections: [...(options.assetSelections ?? [])],
        acceptedPolicyIds: [...(options.acceptedPolicyIds ?? [])],
        paymentSessionId: options.paymentSessionId?.trim() || null,
        bookingConfirmed: options.bookingConfirmed === true,
        pendingReason: options.pendingReason === 'waitlist'
          ? 'waitlist'
          : (options.pendingReason === 'approval' ? 'approval' : null)
      })
      .toPromise();
    return this.normalizeParticipationActionResult(response);
  }

  async leaveEvent(
    userId: string,
    sourceId: string,
    _options: {
      counterDelta?: UserMenuCounterDeltasDto | null;
    } = {}
  ): Promise<EventParticipationActionResultDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    await this.postVoid('/activities/events/trash', {
      userId: normalizedUserId,
      type: 'events',
      sourceId: normalizedSourceId
    });
    return {
      sourceId: normalizedSourceId,
      slotSourceId: null,
      action: 'leave',
      membershipStatus: 'trashed',
      pendingReason: null,
      acceptedMembers: 0,
      pendingMembers: 0,
      capacityTotal: 0,
      full: false,
      paymentSessionId: null
    };
  }

  async createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    return await this.http
      .post<EventCheckoutSession | null>(
        `${this.apiBaseUrl}/activities/events/checkout`,
        request
      )
      .toPromise() ?? null;
  }

  async payCheckoutSession(
    request: EventCheckoutRequest,
    paymentSessionId: string
  ): Promise<EventCheckoutSession | null> {
    const normalizedPaymentSessionId = paymentSessionId.trim();
    if (!normalizedPaymentSessionId) {
      return this.createCheckoutSession(request);
    }
    return await this.http
      .post<EventCheckoutSession | null>(
        `${this.apiBaseUrl}/activities/events/pay`,
        request,
        {
          params: {
            paymentSessionId: normalizedPaymentSessionId
          }
        }
      )
      .toPromise() ?? null;
  }

  async queryEventFeedbackStates(userId: string): Promise<EventFeedbackStateDto[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<EventFeedbackStateDto[] | null>(`${this.apiBaseUrl}/activities/events/feedback`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      return Array.isArray(response)
        ? response.map(item => ({
            eventId: item.eventId?.trim() ?? '',
            removed: Boolean(item.removed),
            submittedAtIso: item.submittedAtIso?.trim() ?? '',
            removedAtIso: item.removedAtIso?.trim() ?? '',
            organizerNote: item.organizerNote?.trim() ?? '',
            answersByCardId: this.cloneEventFeedbackAnswersByCardId(item.answersByCardId)
          })).filter(item => item.eventId)
        : [];
    } catch {
      return [];
    }
  }

  async queryReceivedEventFeedback(userId: string): Promise<EventFeedbackReceivedEventDto[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
          .get<EventFeedbackReceivedEventDto[] | null>(`${this.apiBaseUrl}/activities/events/feedback/received`, {
            params: new HttpParams().set('userId', normalizedUserId)
          })
          .toPromise();
      return Array.isArray(response)
        ? response.map(item => ({
            eventId: item.eventId?.trim() ?? '',
            entries: (item.entries ?? []).map(entry => ({
              viewerUserId: entry.viewerUserId?.trim() ?? '',
              viewerName: entry.viewerName?.trim() ?? '',
              viewerInitials: entry.viewerInitials?.trim() ?? '',
              viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
              viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
              eventId: entry.eventId?.trim() ?? item.eventId?.trim() ?? '',
              submittedAtIso: entry.submittedAtIso?.trim() ?? '',
              updatedAtIso: entry.updatedAtIso?.trim() ?? '',
              organizerNote: entry.organizerNote?.trim() ?? '',
              answers: Object.values(this.cloneEventFeedbackAnswersByCardId(
                Object.fromEntries((entry.answers ?? []).map(answer => [answer.cardId ?? '', answer]))
              ))
            })).filter(entry => entry.viewerUserId && entry.eventId)
          })).filter(item => item.eventId)
        : [];
    } catch {
      return [];
    }
  }

  async loadEventFeedbackPage(query: EventFeedbackPageQueryDto): Promise<EventFeedbackPageResultDto> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return new EventFeedbackPageResultDto();
    }
    try {
      const response = await this.http
        .post<EventFeedbackPageResultDto | null>(`${this.apiBaseUrl}/activities/events/feedback/page`, {
          userId: normalizedUserId,
          filter: query.filter,
          page: Math.max(0, Math.trunc(Number(query.page) || 0)),
          pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
        })
        .toPromise();
      return new EventFeedbackPageResultDto(response);
    } catch {
      return new EventFeedbackPageResultDto();
    }
  }

  async loadEventFeedbackStatById(query: EventFeedbackStatQueryDto): Promise<EventFeedbackStatDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return this.emptyEventFeedbackStat(normalizedEventId);
    }
    try {
      const response = await this.http
        .post<Partial<EventFeedbackStatDto> | null>(`${this.apiBaseUrl}/activities/events/feedback/stat`, {
          userId: normalizedUserId,
          eventId: normalizedEventId
        })
        .toPromise();
      return this.normalizeEventFeedbackStat(response, normalizedEventId);
    } catch {
      return this.emptyEventFeedbackStat(normalizedEventId);
    }
  }

  async loadEventFeedback(query: EventFeedbackQueryDto): Promise<EventFeedbackDetailDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return new EventFeedbackDetailDto({ eventId: normalizedEventId });
    }
    try {
      const response = await this.http
        .post<EventFeedbackDetailDto | null>(`${this.apiBaseUrl}/activities/events/feedback/detail`, {
          userId: normalizedUserId,
          eventId: normalizedEventId
        })
        .toPromise();
      return new EventFeedbackDetailDto({
        ...(response ?? {}),
        eventId: response?.eventId?.trim() || normalizedEventId
      });
    } catch {
      return new EventFeedbackDetailDto({ eventId: normalizedEventId });
    }
  }

  async submitEventFeedback(_userId: string, request: EventFeedbackDetailDto): Promise<void> {
    await this.postVoid('/activities/events/feedback/submit', request);
  }

  async saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void> {
    await this.postVoid('/activities/events/feedback/note', request);
  }

  async removeEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.postVoid('/activities/events/feedback/remove', { userId: userId.trim(), eventId: eventId.trim() });
  }

  async restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void> {
    await this.postVoid('/activities/events/feedback/restore', { userId: userId.trim(), eventId: eventId.trim() });
  }

  private normalizeEventFeedbackStat(
    response: Partial<EventFeedbackStatDto> | null | undefined,
    fallbackEventId: string
  ): EventFeedbackStatDto {
    const eventId = response?.eventId?.trim() || fallbackEventId;
    const sections = (response?.sections ?? [])
      .map(section => {
        const key = section?.key;
        if (key !== 'overall' && key !== 'improve' && key !== 'traits') {
          return null;
        }
        return {
          key,
          responseCount: Math.max(0, Math.trunc(Number(section.responseCount) || 0)),
          options: (section.options ?? [])
            .map(option => ({
              key: option.key?.trim() ?? '',
              count: Math.max(0, Math.trunc(Number(option.count) || 0))
            }))
            .filter(option => option.key.length > 0 && option.count > 0)
        };
      })
      .filter((section): section is EventFeedbackStatDto['sections'][number] => Boolean(section));
    const maxSectionResponses = sections.reduce((max, section) => Math.max(max, section.responseCount), 0);
    return {
      eventId,
      totalResponses: Math.max(0, Math.trunc(Number(response?.totalResponses) || maxSectionResponses)),
      sections
    };
  }

  private emptyEventFeedbackStat(eventId: string): EventFeedbackStatDto {
    return {
      eventId: eventId.trim(),
      totalResponses: 0,
      sections: []
    };
  }

  async syncEventSnapshot(payload: ActivityEventDetailDTO): Promise<ActivityEventRecord | null> {
    try {
      const response = await this.http
        .post<ActivityEventRecord | null>(`${this.apiBaseUrl}/activities/events/sync`, payload)
        .toPromise();
      return this.cloneRecords(response ? [response] : [])[0] ?? null;
    } catch {
      return null;
    }
  }

  async saveActivityEvent(payload: ActivityEventDetailDTO): Promise<ActivityEventDTO | null> {
    try {
      const response = await this.http
        .post<ActivityEventDTO | null>(`${this.apiBaseUrl}/activities/events/sync`, payload)
        .toPromise();
      return this.cloneDTOs(response ? [response] : [])[0] ?? null;
    } catch {
      return null;
    }
  }

  private async getRecords(route: string, userId: string): Promise<ActivityEventRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<ActivityEventRecord[] | null>(`${this.apiBaseUrl}${route}`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      return this.cloneRecords(response);
    } catch {
      return [];
    }
  }

  private async postVoid(route: string, payload: unknown): Promise<void> {
    try {
      await this.http.post<void>(`${this.apiBaseUrl}${route}`, payload).toPromise();
    } catch {
      // Keep UI optimistic until concrete backend endpoints land.
    }
  }

  private normalizeLeaderboardState(
    state: SubEventLeaderboardState | null | undefined,
    fallbackEventId: string,
    fallbackSubEventId: string
  ): SubEventLeaderboardState | null {
    if (!state) {
      return null;
    }
    const eventId = `${state.eventId ?? fallbackEventId}`.trim() || fallbackEventId;
    const subEventId = `${state.subEventId ?? fallbackSubEventId}`.trim() || fallbackSubEventId;
    return {
      eventId,
      subEventId,
      title: `${state.title ?? ''}`.trim(),
      leaderboardType: state.leaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      groups: (state.groups ?? []).map((group, index) => {
        const groupId = `${group.groupId ?? `group-${index + 1}`}`.trim() || `group-${index + 1}`;
        return {
          groupId,
          title: `${group.title ?? `Group ${index + 1}`}`.trim() || `Group ${index + 1}`,
          memberCount: Math.max(0, Math.trunc(Number(group.memberCount) || 0)),
          advancePerGroup: Math.max(0, Math.trunc(Number(group.advancePerGroup) || 0)),
          advancingMemberIds: (group.advancingMemberIds ?? []).map(value => `${value ?? ''}`.trim()).filter(Boolean),
          members: (group.members ?? []).map(member => {
            const rawMember = member as { id?: string; name?: string; memberId?: string; memberName?: string };
            return {
              id: `${rawMember.id ?? rawMember.memberId ?? ''}`.trim(),
              name: `${rawMember.name ?? rawMember.memberName ?? 'Member'}`.trim() || 'Member'
            };
          }).filter(member => member.id),
          scoreEntries: (group.scoreEntries ?? []).map(entry => ({
            id: `${entry.id ?? ''}`.trim(),
            stageId: subEventId,
            groupId,
            memberId: `${entry.memberId ?? ''}`.trim(),
            value: Math.trunc(Number(entry.value) || 0),
            note: `${entry.note ?? ''}`.trim(),
            createdAtMs: Math.max(0, Math.trunc(Number(entry.createdAtMs) || 0))
          })).filter(entry => entry.id && entry.memberId),
          fifaMatches: (group.fifaMatches ?? []).map(match => ({
            id: `${match.id ?? ''}`.trim(),
            stageId: subEventId,
            groupId,
            homeMemberId: `${match.homeMemberId ?? ''}`.trim(),
            awayMemberId: `${match.awayMemberId ?? ''}`.trim(),
            homeScore: Math.max(0, Math.trunc(Number(match.homeScore) || 0)),
            awayScore: Math.max(0, Math.trunc(Number(match.awayScore) || 0)),
            note: `${match.note ?? ''}`.trim(),
            createdAtMs: Math.max(0, Math.trunc(Number(match.createdAtMs) || 0))
          })).filter(match => match.id && match.homeMemberId && match.awayMemberId),
          scoreRows: (group.scoreRows ?? []).map(row => ({
            memberId: `${row.memberId ?? ''}`.trim(),
            memberName: `${row.memberName ?? 'Member'}`.trim() || 'Member',
            total: Math.trunc(Number(row.total) || 0),
            updates: Math.max(0, Math.trunc(Number(row.updates) || 0))
          })).filter(row => row.memberId),
          fifaRows: (group.fifaRows ?? []).map(row => ({
            memberId: `${row.memberId ?? ''}`.trim(),
            memberName: `${row.memberName ?? 'Member'}`.trim() || 'Member',
            points: Math.trunc(Number(row.points) || 0),
            played: Math.max(0, Math.trunc(Number(row.played) || 0)),
            wins: Math.max(0, Math.trunc(Number(row.wins) || 0)),
            draws: Math.max(0, Math.trunc(Number(row.draws) || 0)),
            losses: Math.max(0, Math.trunc(Number(row.losses) || 0)),
            goalsFor: Math.trunc(Number(row.goalsFor) || 0),
            goalsAgainst: Math.trunc(Number(row.goalsAgainst) || 0),
            goalDiff: Math.trunc(Number(row.goalDiff) || 0)
          })).filter(row => row.memberId)
        };
      })
    };
  }

  private normalizeTournamentGroupsState(
    state: EventTournamentGroupsStateDTO | null | undefined,
    fallbackEventId: string
  ): EventTournamentGroupsStateDTO | null {
    if (!state) {
      return null;
    }
    const eventId = `${state.eventId ?? fallbackEventId}`.trim() || fallbackEventId.trim();
    return {
      eventId,
      title: `${state.title ?? ''}`.trim(),
      subtitle: `${state.subtitle ?? ''}`.trim(),
      canManage: state.canManage === true,
      stages: (state.stages ?? []).map((stage, index) => this.normalizeTournamentStage(stage, index))
        .filter(stage => stage.subEventId)
    };
  }

  private normalizeTournamentStage(
    stage: Partial<EventTournamentStageDTO> | null | undefined,
    index: number
  ): EventTournamentStageDTO {
    const subEventId = `${stage?.subEventId ?? ''}`.trim();
    const stageNumber = Math.max(1, Math.trunc(Number(stage?.stageNumber) || index + 1));
    return {
      subEventId,
      title: `${stage?.title ?? `Stage ${stageNumber}`}`.trim() || `Stage ${stageNumber}`,
      description: `${stage?.description ?? ''}`.trim(),
      location: `${stage?.location ?? ''}`.trim(),
      startAt: `${stage?.startAt ?? ''}`.trim(),
      endAt: `${stage?.endAt ?? ''}`.trim(),
      stageNumber,
      stageStatus: `${stage?.stageStatus ?? ''}`.trim(),
      leaderboardType: stage?.leaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      advancePerGroup: Math.max(0, Math.trunc(Number(stage?.advancePerGroup) || 0)),
      groups: this.normalizeTournamentGroupList(stage?.groups, subEventId || 'stage')
    };
  }

  private normalizeTournamentGroupList(
    groups: readonly Partial<EventTournamentGroupDTO>[] | null | undefined,
    fallbackStageId: string
  ): EventTournamentGroupDTO[] {
    return (groups ?? [])
      .map((group, groupIndex) => this.normalizeTournamentGroup(group, groupIndex, fallbackStageId))
      .filter(group => group.id);
  }

  private normalizeTournamentGroup(
    group: Partial<EventTournamentGroupDTO> | null | undefined,
    groupIndex: number,
    fallbackStageId: string
  ): EventTournamentGroupDTO {
    const capacityMin = Math.max(0, Math.trunc(Number(group?.capacityMin) || 0));
    const capacityMax = Math.max(capacityMin, Math.trunc(Number(group?.capacityMax) || capacityMin));
    return {
      id: `${group?.id ?? `${fallbackStageId || 'stage'}-group-${groupIndex + 1}`}`.trim(),
      name: `${group?.name ?? `Group ${groupIndex + 1}`}`.trim() || `Group ${groupIndex + 1}`,
      source: `${group?.source ?? 'generated'}`.trim() || 'generated',
      capacityMin,
      capacityMax,
      membersAccepted: Math.max(0, Math.trunc(Number(group?.membersAccepted) || 0)),
      membersPending: Math.max(0, Math.trunc(Number(group?.membersPending) || 0))
    };
  }

  private normalizeParticipationActionResult(
    result: EventParticipationActionResultDTO | null | undefined
  ): EventParticipationActionResultDTO | null {
    if (!result) {
      return null;
    }
    const sourceId = `${result.sourceId ?? ''}`.trim();
    if (!sourceId) {
      return null;
    }
    const acceptedMembers = Math.max(0, Math.trunc(Number(result.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(result.pendingMembers) || 0));
    const capacityTotal = Math.max(acceptedMembers, Math.trunc(Number(result.capacityTotal) || 0));
    const pendingReason: ActivityPendingReason = result.pendingReason === 'waitlist'
      ? 'waitlist'
      : result.pendingReason === 'approval'
        ? 'approval'
        : null;
    const membershipStatus = `${result.membershipStatus ?? ''}`.trim() || (pendingReason ? 'pending' : 'accepted');
    return {
      sourceId,
      slotSourceId: `${result.slotSourceId ?? ''}`.trim() || null,
      action: `${result.action ?? ''}`.trim() || 'join',
      membershipStatus,
      pendingReason,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      full: result.full === true || (capacityTotal > 0 && acceptedMembers >= capacityTotal),
      paymentSessionId: `${result.paymentSessionId ?? ''}`.trim() || null
    };
  }

  private cloneRecords(records: ActivityEventRecord[] | null | undefined): ActivityEventRecord[] {
    if (!Array.isArray(records)) {
      return [];
    }
    return records.map(record => {
      const normalizedRecord = {
        id: `${record.id ?? ''}`.trim(),
        userId: `${record.userId ?? ''}`.trim(),
        type: record.type ?? 'events',
        status: record.status,
        adminIds: [...(record.adminIds ?? [])],
        avatar: `${record.avatar ?? ''}`.trim(),
        title: `${record.title ?? ''}`.trim(),
        subtitle: `${record.subtitle ?? ''}`.trim(),
        timeframe: `${record.timeframe ?? ''}`.trim(),
        inviter: record.inviter ?? null,
        unread: Math.max(0, Math.trunc(Number(record.unread) || 0)),
        activity: Math.max(0, Math.trunc(Number(record.activity) || 0)),
        trashedAtIso: record.trashedAtIso ?? null,
        creatorUserId: `${record.creatorUserId ?? ''}`.trim(),
        creatorName: `${record.creatorName ?? ''}`.trim(),
        creatorInitials: `${record.creatorInitials ?? ''}`.trim(),
        creatorGender: record.creatorGender === 'woman' ? 'woman' : 'man',
        creatorCity: `${record.creatorCity ?? ''}`.trim(),
        visibility: record.visibility ?? 'Public',
        blindMode: record.blindMode ?? 'Open Event',
        startAtIso: `${record.startAtIso ?? ''}`.trim(),
        endAtIso: `${record.endAtIso ?? ''}`.trim(),
        distanceKm: Math.max(0, Number(record.distanceKm) || 0),
        imageUrl: `${record.imageUrl ?? ''}`.trim(),
        sourceLink: `${record.sourceLink ?? ''}`.trim(),
        location: `${record.location ?? ''}`.trim(),
        locationCoordinates: record.locationCoordinates ?? null,
        capacityMin: record.capacityMin ?? null,
        capacityMax: record.capacityMax ?? null,
        capacityTotal: Math.max(0, Math.trunc(Number(record.capacityTotal) || 0)),
        autoInviter: record.autoInviter === true,
        frequency: record.frequency ?? '',
        ticketing: record.ticketing === true,
        pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
        policiesEnabled: record.policiesEnabled === true,
        policies: (record.policies ?? []).map(item => ({ ...item })),
        slotsEnabled: record.slotsEnabled === true,
        slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
        parentEventId: record.parentEventId ?? null,
        slotTemplateId: record.slotTemplateId ?? null,
        generated: record.generated === true,
        eventType: record.eventType ?? 'main',
        nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
        upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
        acceptedMembers: Math.max(0, Math.trunc(Number(record.acceptedMembers) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(record.pendingMembers) || 0)),
        pendingReason: record.pendingReason ?? null,
        topics: [...(record.topics ?? [])],
        subEvents: (record.subEvents ?? []).map(item => ({
          ...item,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
        })),
        mode: ActivityEventDetailDTO.normalizeMode(record.mode),
        rating: Math.max(0, Number(record.rating) || 0),
        boost: Math.max(0, Number(record.boost) || 0),
        affinity: Math.max(0, Number(record.affinity) || 0)
      } satisfies ActivityEventRecord;
      return normalizedRecord;
    });
  }

  private cloneDTOs(items: readonly ActivityEventDTO[] | null | undefined): ActivityEventDTO[] {
    if (!Array.isArray(items)) {
      return [];
    }
    return items.map(item => ({
      ...item,
      adminIds: [...(item.adminIds ?? [])],
      acceptedMemberUserIds: [...(item.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(item.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(item.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(item.pendingRequestMemberUserIds ?? [])]
    }));
  }

  private cloneEventFeedbackAnswersByCardId(
    answersByCardId: EventFeedbackStateDto['answersByCardId']
  ): NonNullable<EventFeedbackStateDto['answersByCardId']> {
    const next: NonNullable<EventFeedbackStateDto['answersByCardId']> = {};
    for (const [cardId, answer] of Object.entries(answersByCardId ?? {})) {
      const normalizedCardId = cardId.trim();
      if (!normalizedCardId || !answer) {
        continue;
      }
      next[normalizedCardId] = {
        ...answer,
        cardId: answer.cardId?.trim() || normalizedCardId,
        eventId: answer.eventId?.trim() ?? '',
        kind: answer.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: answer.targetUserId?.trim() || null,
        targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
        primaryValue: answer.primaryValue?.trim() ?? '',
        secondaryValue: answer.secondaryValue?.trim() ?? '',
        personalityTraitIds: (answer.personalityTraitIds ?? []).map(traitId => traitId.trim()).filter(Boolean),
        tags: (answer.tags ?? []).map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso?.trim() ?? ''
      };
    }
    return next;
  }

  private normalizeSourceIds(sourceIds: readonly string[] | null | undefined): string[] {
    if (!Array.isArray(sourceIds)) {
      return [];
    }
    return [...new Set(sourceIds
      .map(sourceId => `${sourceId ?? ''}`.trim())
      .filter(sourceId => sourceId.length > 0))];
  }
}
