import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { PricingBuilder } from '../../../core/base/builders';
import type {
  ActivitiesEventSyncPayload,
  EventCheckoutAssetSelection,
  EventCheckoutRequest,
  EventCheckoutSession,
  EventFeedbackReceivedEventDto,
  EventFeedbackNoteRequestDto,
  EventFeedbackStateDto,
  EventFeedbackSubmitRequestDto
} from '../../../core/base/models';
import type {
  DemoEventActivitiesQuery,
  DemoEventActivitiesQueryResult,
  DemoEventExploreQuery,
  DemoEventExploreQueryResult,
  DemoEventRecord,
  DemoEventScopeFilter,
  DemoRepositoryEventItemType
} from '../../demo/models/events.model';

interface HttpEventsFilterRequest {
  userId: string;
  filter: DemoEventScopeFilter;
  hostingPublicationFilter: 'all' | 'drafts';
  secondaryFilter?: 'recent' | 'relevant' | 'past';
  sort?: 'date' | 'distance' | 'relevance';
  view?: 'month' | 'week' | 'day' | 'distance';
  limit?: number;
  cursor?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpEventsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.getRecords('/activities/events', userId);
  }

  peekItemsByUser(_userId: string): DemoEventRecord[] {
    return [];
  }

  async queryInvitationItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.getRecords('/activities/events/invitations', userId);
  }

  async queryEventItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.getRecords('/activities/events/attending', userId);
  }

  async queryHostingItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.getRecords('/activities/events/hosting', userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.getRecords('/activities/events/trash', userId);
  }

  async queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): Promise<DemoEventRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .post<DemoEventRecord[] | null>(`${this.apiBaseUrl}/activities/events/filter`, {
          userId: normalizedUserId,
          filter,
          hostingPublicationFilter
        } satisfies HttpEventsFilterRequest)
        .toPromise();
      return this.cloneRecords(response);
    } catch {
      return [];
    }
  }

  async queryActivitiesEventPage(query: DemoEventActivitiesQuery): Promise<DemoEventActivitiesQueryResult> {
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
        .post<DemoEventRecord[] | DemoEventActivitiesQueryResult | null>(
          `${this.apiBaseUrl}/activities/events/filter`,
          {
            userId: normalizedUserId,
            filter: query.filter,
            hostingPublicationFilter: query.hostingPublicationFilter ?? 'all',
            secondaryFilter: query.secondaryFilter,
            sort: query.sort,
            view: query.view,
            limit: query.limit,
            cursor: query.cursor ?? null
          } satisfies HttpEventsFilterRequest
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

  async queryExploreItems(userId: string): Promise<DemoEventRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .post<DemoEventRecord[] | null>(`${this.apiBaseUrl}/activities/events/explore`, {
          userId: normalizedUserId
        })
        .toPromise();
      return this.cloneRecords(response);
    } catch {
      return [];
    }
  }

  peekExploreItems(_userId: string): DemoEventRecord[] {
    return [];
  }

  async queryEventExplorePage(query: DemoEventExploreQuery): Promise<DemoEventExploreQueryResult> {
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
        .post<DemoEventRecord[] | DemoEventExploreQueryResult | null>(
          `${this.apiBaseUrl}/activities/events/explore`,
          {
            ...query,
            userId: normalizedUserId
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

  peekEventExplorePage(_query: DemoEventExploreQuery): DemoEventExploreQueryResult {
    return {
      records: [],
      total: 0,
      nextCursor: null
    };
  }

  async trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/trash', { userId: userId.trim(), type, sourceId: sourceId.trim() });
  }

  async publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/publish', { userId: userId.trim(), type, sourceId: sourceId.trim() });
  }

  async restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/restore', { userId: userId.trim(), type, sourceId: sourceId.trim() });
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
    } = {}
  ): Promise<DemoEventRecord | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    try {
      const response = await this.http
        .post<DemoEventRecord | null>(`${this.apiBaseUrl}/activities/events/join`, {
          userId: normalizedUserId,
          type: 'events',
          sourceId: normalizedSourceId,
          slotSourceId: options.slotSourceId?.trim() || null,
          optionalSubEventIds: [...(options.optionalSubEventIds ?? [])],
          assetSelections: [...(options.assetSelections ?? [])],
          acceptedPolicyIds: [...(options.acceptedPolicyIds ?? [])],
          paymentSessionId: options.paymentSessionId?.trim() || null,
          bookingConfirmed: options.bookingConfirmed === true
        })
        .toPromise();
      return response ? this.cloneRecords([response])[0] ?? null : null;
    } catch {
      return null;
    }
  }

  async createCheckoutSession(request: EventCheckoutRequest): Promise<EventCheckoutSession | null> {
    try {
      return await this.http
        .post<EventCheckoutSession | null>(`${this.apiBaseUrl}/activities/events/checkout`, request)
        .toPromise() ?? null;
    } catch {
      return null;
    }
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

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.postVoid('/activities/events/sync', payload);
  }

  private async getRecords(route: string, userId: string): Promise<DemoEventRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<DemoEventRecord[] | null>(`${this.apiBaseUrl}${route}`, {
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

  private cloneRecords(records: DemoEventRecord[] | null | undefined): DemoEventRecord[] {
    if (!Array.isArray(records)) {
      return [];
    }
    return records.map(record => ({
      ...record,
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      topics: [...(record.topics ?? [])],
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      subEvents: (record.subEvents ?? []).map(item => ({
        ...item,
        groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
      }))
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
}
