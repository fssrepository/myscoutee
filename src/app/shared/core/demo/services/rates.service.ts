import { Injectable, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateMenuItem } from '../../../demo-data';
import type { ActivityRateRecordQuery } from '../../base/interfaces/game.interface';
import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoRatesService {
  private static readonly RATES_ROUTE = '/activities/rates';
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.usersRatingsRepository.peekRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    return this.usersRatingsRepository.queryActivityRateItemsPage(
      this.toActivityRateRecordQuery(userId, request)
    );
  }

  private async waitForRouteDelay(route: string): Promise<void> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(route);
    if (additionalDelayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), additionalDelayMs);
    });
  }

  private toActivityRateRecordQuery(userId: string, request: ActivitiesPageRequest): ActivityRateRecordQuery {
    const [mode, displayDirection] = request.rateFilter.split('-') as [
      'individual' | 'pair',
      'given' | 'received' | 'mutual' | 'met'
    ];
    const normalizedSort = request.sort === 'distance' || request.sort === 'relevance'
      ? request.sort
      : 'happenedAt';
    const sortDirection = request.direction === 'asc' || request.direction === 'desc'
      ? request.direction
      : (normalizedSort === 'distance' ? 'asc' : 'desc');

    return {
      ownerUserId: userId,
      mode: mode === 'pair' ? 'pair' : 'single',
      displayDirection,
      sort: normalizedSort,
      sortDirection,
      cursor: request.cursor,
      limit: Math.max(1, Math.trunc(request.pageSize)),
      rangeStartIso: request.rangeStart,
      rangeEndIso: request.rangeEnd
    };
  }
}
