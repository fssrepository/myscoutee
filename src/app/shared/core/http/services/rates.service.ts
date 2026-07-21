import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesFeedFilters, ListQuery } from '../../contracts';
import type {
  ActivityRateDTO,
  ActivityRatePageResultDTO,
  UserRateSyncPayloadDTO,
  UserRatesSyncRequestDTO,
  UserRatesSyncResponseDTO
} from '../../contracts/activity.interface';
import type { UserRatesSyncResult } from '../../contracts/activity.interface';
import type { IRatesService } from '../../contracts/activity.interface';
import type { UserDto } from '../../contracts/user.interface';
import { compareActivityRateItems, resolveActivityRateOrder } from '../../base/activity-rate-order';
import { BaseUserRatesMapper } from '../../base/mappers';
import { RateOutboxRepository } from '../../base/repositories/rate-outbox.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpRatesService implements IRatesService {
  private static readonly USER_RATES_SYNC_ROUTE = '/user-rates/sync';
  private static readonly USER_RATES_ROUTE = '/activities/rates';
  private static readonly USER_RATES_PAGE_ROUTE = '/activities/rates/page';

  private readonly rateOutboxRepository = inject(RateOutboxRepository);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRatesByUserId: Record<string, ActivityRateDTO[]> = {};

  peekRateItemsByUser(userId: string): ActivityRateDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRateItems(
      this.mergePendingOutboxRateItems(
        normalizedUserId,
        this.cachedRatesByUserId[normalizedUserId] ?? []
      )
    );
  }

  async queryRateItemsByUser(userId: string): Promise<ActivityRateDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<ActivityRateDTO[] | null>(`${this.apiBaseUrl}${HttpRatesService.USER_RATES_ROUTE}`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const items = this.mergePendingOutboxRateItems(
        normalizedUserId,
        Array.isArray(response) ? response : []
      );
      this.cachedRatesByUserId[normalizedUserId] = this.cloneRateItems(items);
      return this.cloneRateItems(items);
    } catch {
      return this.peekRateItemsByUser(normalizedUserId);
    }
  }

  async flushPendingUserRatesOutboxBatch(limit = 50): Promise<void> {
    const batch = this.rateOutboxRepository.queryPendingUserRatesOutbox(limit);
    if (batch.length === 0) {
      return;
    }
    const payloadRates: UserRateSyncPayloadDTO[] = [];
    const invalidRateIds: string[] = [];
    const sourceRateIds: string[] = [];
    for (const item of batch) {
      const rate = item.payload;
      const rateId = `${rate?.id ?? item.rateId ?? ''}`.trim();
      if (rateId) {
        sourceRateIds.push(rateId);
      }
      const payload = BaseUserRatesMapper.toSyncPayload(rate);
      if (payload) {
        payloadRates.push(payload);
      } else if (rateId) {
        invalidRateIds.push(rateId);
      }
    }
    const syncResult = await this.syncUserRatesBatch(payloadRates, invalidRateIds, sourceRateIds);
    this.rateOutboxRepository.applyUserRatesSyncResult(batch, syncResult);
  }

  async queryActivitiesRatePage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO> {
    this.throwIfAborted(signal);
    try {
      await this.flushPendingUserRatesOutboxBatch();
    } catch {
      // Fall through to the mixed server/cache read below.
    }
    this.throwIfAborted(signal);
    await this.queryRateItemsByUser(userId);
    this.throwIfAborted(signal);
    const [mode, direction] = this.activitiesRateFilter(query).split('-') as ['individual' | 'pair', ActivityRateDTO['direction']];
    const order = resolveActivityRateOrder(query);
    let params = new HttpParams()
      .set('userId', userId)
      .set('mode', mode === 'pair' ? 'pair' : 'single')
      .set('direction', direction)
      .set('sort', order.sort)
      .set('socialBadgeEnabled', query.filters?.rateSocialBadgeEnabled === true ? 'true' : 'false')
      .set('limit', String(Math.max(1, Math.trunc(query.pageSize || 10))));
    const secondaryFilter = order.secondaryFilter;
    if (secondaryFilter === 'recent' || secondaryFilter === 'past' || secondaryFilter === 'relevant') {
      params = params.set('secondaryFilter', secondaryFilter);
    }
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    if (query.rangeStart) {
      params = params.set('rangeStartIso', query.rangeStart);
    }
    if (query.rangeEnd) {
      params = params.set('rangeEndIso', query.rangeEnd);
    }

    try {
      const response = await this.requestWithAbort(
        this.http.get<{
          items?: ActivityRateDTO[] | null;
          total?: number | null;
          nextCursor?: string | null;
          users?: UserDto[] | null;
        } | null>(`${this.apiBaseUrl}${HttpRatesService.USER_RATES_PAGE_ROUTE}`, { params }),
        signal
      );

      const page = {
        items: Array.isArray(response?.items) ? response.items.map(item => ({ ...item })) : [],
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0,
        nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
          ? response.nextCursor.trim()
          : null,
        users: Array.isArray(response?.users) ? response.users.map(user => this.cloneUser(user)) : []
      };
      return this.shouldUseCachedActivitiesRatePage(page, userId)
        ? this.buildCachedActivitiesRatePage(userId, query)
        : page;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return this.buildCachedActivitiesRatePage(userId, query);
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

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw this.createAbortError();
    }
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private shouldUseCachedActivitiesRatePage(page: ActivityRatePageResultDTO, userId: string): boolean {
    return page.items.length === 0
      && page.total === 0
      && this.peekRateItemsByUser(userId).length > 0;
  }

  private mergePendingOutboxRateItems(userId: string, items: readonly ActivityRateDTO[]): ActivityRateDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const itemsById = new Map<string, ActivityRateDTO>();
    for (const item of items) {
      const normalizedId = item.id.trim();
      if (!normalizedId) {
        continue;
      }
      itemsById.set(normalizedId, { ...item });
    }
    for (const record of this.rateOutboxRepository.queryPendingUserRateRecords()) {
      if (record.ownerUserId?.trim() !== normalizedUserId) {
        continue;
      }
      const item = BaseUserRatesMapper.toDto(record);
      if (!item?.id?.trim()) {
        continue;
      }
      itemsById.set(item.id.trim(), { ...item });
    }
    return [...itemsById.values()]
      .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt) || left.id.localeCompare(right.id));
  }

  private activitiesRateFilter(query: ListQuery<ActivitiesFeedFilters>): NonNullable<ActivitiesFeedFilters['rateFilter']> {
    const value = query.filters?.rateFilter;
    return value === 'individual-received'
      || value === 'individual-mutual'
      || value === 'individual-met'
      || value === 'pair-given'
      || value === 'pair-received'
      ? value
      : 'individual-given';
  }

  private buildCachedActivitiesRatePage(userId: string, query: ListQuery<ActivitiesFeedFilters>): ActivityRatePageResultDTO {
    const [mode, direction] = this.activitiesRateFilter(query).split('-') as ['individual' | 'pair', ActivityRateDTO['direction']];
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const pageIndex = Math.max(0, Math.trunc(Number(query.page) || 0));
    const filtered = this.peekRateItemsByUser(userId)
      .filter(item => item.mode === mode && item.direction === direction)
      .filter(item => this.matchesRateSocialFilter(item, query.filters?.rateSocialBadgeEnabled === true))
      .filter(item => this.matchesRateRange(item, query))
      .sort((left, right) => this.compareRateItems(left, right, query));
    const cursorId = this.resolveRateCursorId(query.cursor);
    const startIndex = cursorId
      ? Math.max(0, filtered.findIndex(item => item.id === cursorId) + 1)
      : pageIndex * pageSize;
    const pageItems = filtered
      .slice(startIndex, startIndex + pageSize)
      .map(item => ({ ...item }));

    return {
      items: pageItems,
      total: filtered.length,
      nextCursor: filtered.length > startIndex + pageItems.length && pageItems.length > 0
        ? pageItems[pageItems.length - 1]?.id ?? null
        : null,
      users: []
    };
  }

  private matchesRateRange(item: ActivityRateDTO, query: ListQuery<ActivitiesFeedFilters>): boolean {
    const happenedAtMs = AppUtils.toSortableDate(item.happenedAt ?? '');
    const rangeStartMs = query.rangeStart ? AppUtils.toSortableDate(query.rangeStart) : null;
    const rangeEndMs = query.rangeEnd ? AppUtils.toSortableDate(query.rangeEnd) : null;
    if (rangeStartMs !== null && happenedAtMs < rangeStartMs) {
      return false;
    }
    if (rangeEndMs !== null && happenedAtMs > rangeEndMs) {
      return false;
    }
    return true;
  }

  private matchesRateSocialFilter(item: ActivityRateDTO, socialBadgeEnabled: boolean): boolean {
    if (item.mode === 'individual') {
      const friendsInCommon = item.socialContext === 'friends-in-common';
      return socialBadgeEnabled ? friendsInCommon : !friendsInCommon;
    }
    if (item.mode === 'pair') {
      const insideNetwork = item.socialContext === 'separated-friends';
      return socialBadgeEnabled ? insideNetwork : !insideNetwork;
    }
    return true;
  }

  private compareRateItems(left: ActivityRateDTO, right: ActivityRateDTO, query: ListQuery<ActivitiesFeedFilters>): number {
    return compareActivityRateItems(left, right, resolveActivityRateOrder(query));
  }

  private resolveRateCursorId(cursor: string | null | undefined): string | null {
    const normalizedCursor = `${cursor ?? ''}`.trim();
    if (!normalizedCursor) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalizedCursor) as { id?: string };
      return typeof parsed.id === 'string' && parsed.id.trim().length > 0
        ? parsed.id.trim()
        : normalizedCursor;
    } catch {
      return normalizedCursor;
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      locationCoordinates: user.locationCoordinates
        ? {
            latitude: Number(user.locationCoordinates.latitude),
            longitude: Number(user.locationCoordinates.longitude)
          }
        : undefined,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: user.activities?.game ?? 0,
        chats: user.activities?.chats ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0,
        cars: user.activities?.cars ?? 0,
        accommodation: user.activities?.accommodation ?? 0,
        supplies: user.activities?.supplies ?? 0,
        tickets: user.activities?.tickets ?? 0,
        contacts: user.activities?.contacts ?? 0,
        feedback: user.activities?.feedback ?? 0
      }
    };
  }

  private async syncUserRatesBatch(
    rates: readonly UserRateSyncPayloadDTO[],
    invalidRateIds: readonly string[],
    sourceRateIds: readonly string[]
  ): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: this.dedupeIds([...invalidRateIds, ...sourceRateIds]),
        error: 'No valid user rates to sync'
      };
    }
    try {
      const response = await this.http
        .post<UserRatesSyncResponseDTO | null>(
          `${this.apiBaseUrl}${HttpRatesService.USER_RATES_SYNC_ROUTE}`,
          { rates: rates.map(rate => ({ ...rate })) } satisfies UserRatesSyncRequestDTO
        )
        .toPromise();
      if (!response) {
        return {
          syncedRateIds: [],
          failedRateIds: this.dedupeIds([...rates.map(rate => rate.id), ...invalidRateIds]),
          error: 'Empty sync response'
        };
      }
      const syncedRateIds = Array.isArray(response.syncedRateIds)
        ? response.syncedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      const failedRateIds = Array.isArray(response.failedRateIds)
        ? response.failedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      return {
        syncedRateIds,
        failedRateIds: this.dedupeIds([...failedRateIds, ...invalidRateIds]),
        error: null
      };
    } catch {
      return {
        syncedRateIds: [],
        failedRateIds: this.dedupeIds([...rates.map(rate => rate.id), ...invalidRateIds]),
        error: 'User rates sync request failed'
      };
    }
  }

  private dedupeIds(ids: readonly string[]): string[] {
    return [...new Set(ids
      .map(id => `${id ?? ''}`.trim())
      .filter(id => id.length > 0))];
  }

  private cloneRateItems(items: readonly ActivityRateDTO[]): ActivityRateDTO[] {
    return items.map(item => ({ ...item }));
  }
}
