import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
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
    item: RateMenuItem,
    rating: number,
    direction?: RateMenuItem['direction'] | null
  ): void {
    this.usersRatingsRepository.enqueueActivityRateOutbox(ownerUserId, item, rating, direction);
  }

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.usersRatingsRepository.peekRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    await this.queryRateItemsByUser(userId);
    const [mode, direction] = request.rateFilter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
    let params = new HttpParams()
      .set('userId', userId)
      .set('mode', mode === 'pair' ? 'pair' : 'single')
      .set('direction', direction)
      .set('sort', request.sort ?? 'happenedAt')
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

    const response = await this.http.get<{
      items?: RateMenuItem[] | null;
      total?: number | null;
      nextCursor?: string | null;
    } | null>(`${this.apiBaseUrl}${HttpRatesService.USER_RATES_PAGE_ROUTE}`, { params }).toPromise();

    return {
      items: Array.isArray(response?.items) ? response.items.map(item => ({ ...item })) : [],
      total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0,
      nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor.trim()
        : null
    };
  }
}
