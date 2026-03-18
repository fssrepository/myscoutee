import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ActivitiesEventSyncPayload } from '../../../activities-models';
import type {
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

  async restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.postVoid('/activities/events/restore', { userId: userId.trim(), type, sourceId: sourceId.trim() });
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
      topics: [...(record.topics ?? [])]
    }));
  }
}
