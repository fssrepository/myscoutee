import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateRecord } from '../../contracts/rate.interface';
import type {
  ActivityRatePageResult,
  UserRateRecord,
  UserRatesSyncResult
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import { RateOutboxRepository } from '../../base/repositories/rate-outbox.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpRatesService {
  private static readonly USER_RATES_SYNC_ROUTE = '/user-rates/sync';
  private static readonly USER_RATES_ROUTE = '/activities/rates';
  private static readonly USER_RATES_PAGE_ROUTE = '/activities/rates/page';

  private readonly rateOutboxRepository = inject(RateOutboxRepository);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRatesByUserId: Record<string, RateRecord[]> = {};

  peekRateItemsByUser(userId: string): RateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRateItems(
      this.rateOutboxRepository.mergePendingOutboxRateItems(
        normalizedUserId,
        this.cachedRatesByUserId[normalizedUserId] ?? []
      )
    );
  }

  async queryRateItemsByUser(userId: string): Promise<RateRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<RateRecord[] | null>(`${this.apiBaseUrl}${HttpRatesService.USER_RATES_ROUTE}`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const items = this.rateOutboxRepository.mergePendingOutboxRateItems(
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
    const syncResult = await this.syncUserRatesBatch(batch.map(item => ({ ...item.payload })));
    this.rateOutboxRepository.applyUserRatesSyncResult(batch, syncResult);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResult> {
    this.throwIfAborted(signal);
    try {
      await this.flushPendingUserRatesOutboxBatch();
    } catch {
      // Fall through to the mixed server/cache read below.
    }
    this.throwIfAborted(signal);
    await this.queryRateItemsByUser(userId);
    this.throwIfAborted(signal);
    const [mode, direction] = request.rateFilter.split('-') as ['individual' | 'pair', RateRecord['direction']];
    let params = new HttpParams()
      .set('userId', userId)
      .set('mode', mode === 'pair' ? 'pair' : 'single')
      .set('direction', direction)
      .set('sort', request.sort ?? 'happenedAt')
      .set('socialBadgeEnabled', request.rateSocialBadgeEnabled === true ? 'true' : 'false')
      .set('limit', String(Math.max(1, Math.trunc(request.pageSize || 10))));
    if (request.secondaryFilter === 'recent' || request.secondaryFilter === 'past' || request.secondaryFilter === 'relevant') {
      params = params.set('secondaryFilter', request.secondaryFilter);
    }
    if (request.cursor) {
      params = params.set('cursor', request.cursor);
    }
    if (request.rangeStart) {
      params = params.set('rangeStartIso', request.rangeStart);
    }
    if (request.rangeEnd) {
      params = params.set('rangeEndIso', request.rangeEnd);
    }

    try {
      const response = await this.requestWithAbort(
        this.http.get<{
          items?: RateRecord[] | null;
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
        ? this.buildCachedActivitiesRatePage(userId, request)
        : page;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return this.buildCachedActivitiesRatePage(userId, request);
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

  private shouldUseCachedActivitiesRatePage(page: ActivityRatePageResult, userId: string): boolean {
    return page.items.length === 0
      && page.total === 0
      && this.peekRateItemsByUser(userId).length > 0;
  }

  private buildCachedActivitiesRatePage(userId: string, request: ActivitiesPageRequest): ActivityRatePageResult {
    const [mode, direction] = request.rateFilter.split('-') as ['individual' | 'pair', RateRecord['direction']];
    const pageSize = Math.max(1, Math.trunc(Number(request.pageSize) || 10));
    const pageIndex = Math.max(0, Math.trunc(Number(request.page) || 0));
    const filtered = this.peekRateItemsByUser(userId)
      .filter(item => item.mode === mode && item.direction === direction)
      .filter(item => this.matchesRateSocialFilter(item, request.rateSocialBadgeEnabled === true))
      .filter(item => this.matchesRateRange(item, request))
      .sort((left, right) => this.compareRateItems(left, right, request));
    const cursorId = this.resolveRateCursorId(request.cursor);
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

  private matchesRateRange(item: RateRecord, request: ActivitiesPageRequest): boolean {
    const happenedAtMs = AppUtils.toSortableDate(item.happenedAt ?? '');
    const rangeStartMs = request.rangeStart ? AppUtils.toSortableDate(request.rangeStart) : null;
    const rangeEndMs = request.rangeEnd ? AppUtils.toSortableDate(request.rangeEnd) : null;
    if (rangeStartMs !== null && happenedAtMs < rangeStartMs) {
      return false;
    }
    if (rangeEndMs !== null && happenedAtMs > rangeEndMs) {
      return false;
    }
    return true;
  }

  private matchesRateSocialFilter(item: RateRecord, socialBadgeEnabled: boolean): boolean {
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

  private compareRateItems(left: RateRecord, right: RateRecord, request: ActivitiesPageRequest): number {
    if (request.sort === 'distance') {
      const distanceDelta = this.rateDistanceValue(left) - this.rateDistanceValue(right);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
      return left.id.localeCompare(right.id);
    }

    if (request.sort === 'relevance') {
      const relevanceDelta = this.rateRelevanceScore(right) - this.rateRelevanceScore(left);
      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }
      return right.id.localeCompare(left.id);
    }

    const sortDirection = request.direction === 'asc' || request.direction === 'desc'
      ? request.direction
      : 'desc';
    const happenedAtDelta = sortDirection === 'asc'
      ? AppUtils.toSortableDate(left.happenedAt ?? '') - AppUtils.toSortableDate(right.happenedAt ?? '')
      : AppUtils.toSortableDate(right.happenedAt ?? '') - AppUtils.toSortableDate(left.happenedAt ?? '');
    if (happenedAtDelta !== 0) {
      return happenedAtDelta;
    }
    return sortDirection === 'asc'
      ? left.id.localeCompare(right.id)
      : right.id.localeCompare(left.id);
  }

  private rateDistanceValue(item: RateRecord): number {
    if (Number.isFinite(item.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
    }
    return 0;
  }

  private rateRelevanceScore(item: RateRecord): number {
    const scoreGiven = Number.isFinite(item.scoreGiven)
      ? Math.max(0, Math.round(Number(item.scoreGiven)))
      : 0;
    const scoreReceived = Number.isFinite(item.scoreReceived)
      ? Math.max(0, Math.round(Number(item.scoreReceived)))
      : 0;
    if (item.direction === 'mutual') {
      return scoreGiven + scoreReceived;
    }
    return scoreGiven > 0 ? scoreGiven : 5;
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
        chat: user.activities?.chat ?? 0,
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

  private async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    const payloadRates: UserRateRecord[] = [];
    const invalidRateIds: string[] = [];
    for (const rate of rates) {
      const payload = this.rateOutboxRepository.toUserRateSyncPayload(rate);
      if (payload) {
        payloadRates.push(payload);
      } else if (rate.id?.trim()) {
        invalidRateIds.push(rate.id.trim());
      }
    }
    if (payloadRates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: this.dedupeIds([...invalidRateIds, ...rates.map(rate => rate.id)]),
        error: 'No valid user rates to sync'
      };
    }
    try {
      const response = await this.http
        .post<{ syncedRateIds?: string[]; failedRateIds?: string[] } | null>(
          `${this.apiBaseUrl}${HttpRatesService.USER_RATES_SYNC_ROUTE}`,
          { rates: payloadRates }
        )
        .toPromise();
      if (!response) {
        return {
          syncedRateIds: [],
          failedRateIds: this.dedupeIds([...payloadRates.map(rate => rate.id), ...invalidRateIds]),
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
        failedRateIds: this.dedupeIds([...payloadRates.map(rate => rate.id), ...invalidRateIds]),
        error: 'User rates sync request failed'
      };
    }
  }

  private dedupeIds(ids: readonly string[]): string[] {
    return [...new Set(ids
      .map(id => `${id ?? ''}`.trim())
      .filter(id => id.length > 0))];
  }

  private cloneRateItems(items: readonly RateRecord[]): RateRecord[] {
    return items.map(item => ({ ...item }));
  }
}
