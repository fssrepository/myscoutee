import { Injectable, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { ActivityRatePageResult, ActivityRateRecordQuery } from '../../base/interfaces/game.interface';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoUsersRepository } from '../repositories/users.repository';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoRatesService extends DemoRouteDelayService {
  private static readonly RATES_ROUTE = '/activities/rates';
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

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
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<ActivityRatePageResult> {
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    const page = await this.usersRatingsRepository.queryActivityRateItemsPage(
      this.toActivityRateRecordQuery(userId, request)
    );
    const usersById = new Map(this.usersRepository.queryAllUsers().map(user => [user.id, { ...user }]));
    const userIds = new Set<string>();
    for (const item of page.items) {
      if (item.userId?.trim()) {
        userIds.add(item.userId.trim());
      }
      if (item.secondaryUserId?.trim()) {
        userIds.add(item.secondaryUserId.trim());
      }
      if (item.bridgeUserId?.trim()) {
        userIds.add(item.bridgeUserId.trim());
      }
    }
    return {
      ...page,
      users: [...userIds]
        .map(userId => usersById.get(userId) ?? null)
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
    };
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
