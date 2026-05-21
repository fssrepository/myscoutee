import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateRecord } from '../../base/models/rate.model';
import type { ActivityRatePageResult } from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import { HttpUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpRatesService {
  private static readonly USER_RATES_ROUTE = '/activities/rates';
  private static readonly USER_RATES_PAGE_ROUTE = '/activities/rates/page';

  private readonly usersRatingsRepository = inject(HttpUsersRatingsRepository);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  recordActivityRate(
    ownerUserId: string,
    item: RateRecord,
    rating: number,
    direction?: RateRecord['direction'] | null
  ): void {
    this.usersRatingsRepository.enqueueActivityRateOutbox(ownerUserId, item, rating, direction);
  }

  peekRateItemsByUser(userId: string): RateRecord[] {
    return this.usersRatingsRepository.peekRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateRecord[]> {
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResult> {
    this.throwIfAborted(signal);
    try {
      await this.usersRatingsRepository.flushPendingUserRatesOutboxBatch();
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

    const response = await this.requestWithAbort(
      this.http.get<{
        items?: RateRecord[] | null;
        total?: number | null;
        nextCursor?: string | null;
        users?: UserDto[] | null;
      } | null>(`${this.apiBaseUrl}${HttpRatesService.USER_RATES_PAGE_ROUTE}`, { params }),
      signal
    );

    return {
      items: Array.isArray(response?.items) ? response.items.map(item => ({ ...item })) : [],
      total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0,
      nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor.trim()
        : null,
      users: Array.isArray(response?.users) ? response.users.map(user => this.cloneUser(user)) : []
    };
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
        tickets: user.activities?.tickets ?? 0,
        feedback: user.activities?.feedback ?? 0
      }
    };
  }
}
