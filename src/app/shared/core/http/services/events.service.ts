import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PricingBuilder } from '../../../core/base/builders';
import type { ActivityEventSaveDTO } from '../../contracts';
import type { ActivityPendingReason } from '../../common/constants';
import type { SubEventLeaderboardState } from '../../contracts/event.interface';
import type {
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../contracts/activity.interface';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventActivitiesQuery,
  ActivityEventDTO,
  ActivityEventPageResultDTO,
  ActivityEventExploreQuery,
  ActivityEventExploreQueryResult,
  ActivityEventListItem,
  ActivityEventRecord,
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

type HttpActivityEventPolicyDTO = NonNullable<ActivityEventDTO['policies']>[number];
type HttpActivityEventSlotTemplateDTO = NonNullable<ActivityEventDTO['slotTemplates']>[number];
type HttpActivityEventSlotOccurrenceDTO = NonNullable<ActivityEventDTO['upcomingSlots']>[number];
type HttpActivityEventSubEventDTO = NonNullable<ActivityEventDTO['subEvents']>[number];
type HttpActivityEventSubEventGroupDTO = NonNullable<HttpActivityEventSubEventDTO['groups']>[number];

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

  async queryHostingItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events/hosting', userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<ActivityEventRecord[]> {
    return this.getRecords('/activities/events/trash', userId);
  }

  async queryActivitiesEventListPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventActivitiesListQueryResult> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }
    try {
      const response = await this.requestWithAbort(
        this.http.post<ActivityEventListItem[] | ActivityEventActivitiesListQueryResult | null>(
          `${this.apiBaseUrl}/activities/events/filter`,
          {
            userId: normalizedUserId,
            filter: query.filter,
            hostingPublicationFilter: query.hostingPublicationFilter ?? 'all',
            secondaryFilter: query.secondaryFilter,
            sort: query.sort,
            view: query.view,
            limit: query.limit,
            cursor: query.cursor ?? null,
            anchorDate: query.anchorDate,
            rangeStart: query.rangeStart,
            rangeEnd: query.rangeEnd
          } satisfies HttpEventsFilterRequest
        ),
        signal
      );
      if (Array.isArray(response)) {
        const records = this.cloneListItems(response);
        return {
          records,
          total: records.length,
          nextCursor: null
        };
      }
      const records = this.cloneListItems(response?.records);
      return {
        records,
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : records.length,
        nextCursor: typeof response?.nextCursor === 'string' ? response.nextCursor : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  async queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO> {
    const normalizedUserId = query.userId.trim();
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
          {
            userId: normalizedUserId,
            filter: query.filter,
            hostingPublicationFilter: query.hostingPublicationFilter ?? 'all',
            secondaryFilter: query.secondaryFilter,
            sort: query.sort,
            view: query.view,
            limit: query.limit,
            cursor: query.cursor ?? null,
            anchorDate: query.anchorDate,
            rangeStart: query.rangeStart,
            rangeEnd: query.rangeEnd
          } satisfies HttpEventsFilterRequest
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

  async trashItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/trash', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async publishItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/publish', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async unpublishItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/unpublish', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async restoreItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/restore', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  async takeOverItem(userId: string, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/take-over', { userId: userId.trim(), sourceId: sourceId.trim() });
  }

  waitForEventMutationDelay(): Promise<void> {
    return Promise.resolve();
  }

  async applyStageAction(request: {
    userId: string;
    sourceId: string;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): Promise<ActivityEventRecord | null> {
    const rawSubEventIndex = Number(request.subEventIndex);
    const response = await this.http
      .post<ActivityEventRecord | null>(`${this.apiBaseUrl}/activities/events/stage-action`, {
        userId: request.userId.trim(),
        sourceId: request.sourceId.trim(),
        subEventId: request.subEventId?.trim() || null,
        subEventIndex: Number.isFinite(rawSubEventIndex)
          ? Math.max(0, Math.trunc(rawSubEventIndex))
          : null,
        action: request.action.trim(),
        reason: request.reason?.trim() || null
      })
      .toPromise();
    return response ? this.cloneRecords([response])[0] ?? null : null;
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
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    const response = await this.http
      .post<ActivityEventRecord | null>(`${this.apiBaseUrl}/activities/events/join`, {
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
    return response ? this.cloneRecords([response])[0] ?? null : null;
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

  async submitEventFeedback(request: EventFeedbackSubmitRequestDto): Promise<void> {
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

  async syncEventSnapshot(payload: ActivityEventSaveDTO): Promise<ActivityEventRecord | null> {
    try {
      const response = await this.http
        .post<ActivityEventRecord | null>(`${this.apiBaseUrl}/activities/events/sync`, payload)
        .toPromise();
      return this.cloneRecords(response ? [response] : [])[0] ?? null;
    } catch {
      return null;
    }
  }

  async saveActivityEvent(payload: ActivityEventSaveDTO): Promise<ActivityEventDTO | null> {
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
          groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
        })),
        subEventsDisplayMode: record.subEventsDisplayMode ?? 'Casual',
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
      locationCoordinates: item.locationCoordinates ? { ...item.locationCoordinates } : item.locationCoordinates,
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
      policies: (item.policies ?? []).map((policy: HttpActivityEventPolicyDTO) => ({ ...policy })),
      slotTemplates: (item.slotTemplates ?? []).map((template: HttpActivityEventSlotTemplateDTO) => ({ ...template })),
      nextSlot: item.nextSlot ? { ...item.nextSlot } : item.nextSlot,
      upcomingSlots: (item.upcomingSlots ?? []).map((slot: HttpActivityEventSlotOccurrenceDTO) => ({ ...slot })),
      topics: [...(item.topics ?? [])],
      subEvents: (item.subEvents ?? []).map((subEvent: HttpActivityEventSubEventDTO) => ({
        ...subEvent,
        groups: (subEvent.groups ?? []).map((group: HttpActivityEventSubEventGroupDTO) => ({ ...group })),
        pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : subEvent.pricing
      }))
    }));
  }

  private cloneListItems(records: ActivityEventListItem[] | null | undefined): ActivityEventListItem[] {
    if (!Array.isArray(records)) {
      return [];
    }
    return records.map(record => ({
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
      creatorUserId: `${record.creatorUserId ?? ''}`.trim(),
      creatorName: `${record.creatorName ?? ''}`.trim(),
      creatorInitials: `${record.creatorInitials ?? ''}`.trim(),
      creatorCity: `${record.creatorCity ?? ''}`.trim(),
      visibility: record.visibility ?? 'Public',
      startAtIso: `${record.startAtIso ?? ''}`.trim(),
      endAtIso: `${record.endAtIso ?? ''}`.trim(),
      distanceKm: Math.max(0, Number(record.distanceKm) || 0),
      imageUrl: `${record.imageUrl ?? ''}`.trim(),
      location: `${record.location ?? ''}`.trim(),
      capacityMin: record.capacityMin ?? null,
      capacityMax: record.capacityMax ?? null,
      capacityTotal: Math.max(0, Math.trunc(Number(record.capacityTotal) || 0)),
      ticketing: record.ticketing === true,
      eventType: record.eventType ?? 'main',
      acceptedMembers: Math.max(0, Math.trunc(Number(record.acceptedMembers) || 0)),
      pendingMembers: Math.max(0, Math.trunc(Number(record.pendingMembers) || 0)),
      pendingReason: record.pendingReason ?? null,
      topics: [...(record.topics ?? [])],
      rating: Math.max(0, Number(record.rating) || 0),
      boost: Math.max(0, Number(record.boost) || 0),
      affinity: Math.max(0, Number(record.affinity) || 0)
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
