import { Injectable, inject } from '@angular/core';

import type { ActivitiesFeedFilters, ListQuery } from '../../../contracts';
import type { ActivityRateDTO, ActivityRatePageResultDTO } from '../../../contracts/activity.interface';
import type { IRatesService } from '../../../contracts/activity.interface';
import type { ActivityRateRecordQuery } from '../entity/rate.entity';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRatesRepository } from '../repositories/rates.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalRatesService extends LocalRouteDelayService implements IRatesService {
  private static readonly RATES_ROUTE = '/activities/rates';
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly ratesRepository = inject(LocalRatesRepository);

  peekRateItemsByUser(userId: string): ActivityRateDTO[] {
    return this.ratesRepository.peekRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<ActivityRateDTO[]> {
    await this.waitForRouteDelay(LocalRatesService.RATES_ROUTE);
    return this.ratesRepository.queryRateItemsByUserId(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO> {
    await this.waitForRouteDelay(LocalRatesService.RATES_ROUTE, signal);
    const ownerUserId = this.resolveDemoActivityUserId(userId);
    const page = await this.ratesRepository.queryActivityRateItemsPage(
      this.toActivityRateRecordQuery(ownerUserId, query)
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


  private resolveDemoActivityUserId(userId: string): string {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return normalizedUserId;
    }
    return this.usersRepository.queryAllUsers()[0]?.id ?? '';
  }

  private toActivityRateRecordQuery(userId: string, query: ListQuery<ActivitiesFeedFilters>): ActivityRateRecordQuery {
    const [mode, displayDirection] = this.activitiesRateFilter(query).split('-') as [
      'individual' | 'pair',
      'given' | 'received' | 'mutual' | 'met'
    ];
    const normalizedSort = query.sort === 'distance' || query.sort === 'relevance'
      ? query.sort
      : 'happenedAt';
    const sortDirection = query.direction === 'asc' || query.direction === 'desc'
      ? query.direction
      : (normalizedSort === 'distance' ? 'asc' : 'desc');

    return {
      ownerUserId: userId,
      mode: mode === 'pair' ? 'pair' : 'single',
      displayDirection,
      socialBadgeEnabled: query.filters?.rateSocialBadgeEnabled === true,
      sort: normalizedSort,
      sortDirection,
      cursor: query.cursor,
      limit: Math.max(1, Math.trunc(query.pageSize)),
      rangeStartIso: query.rangeStart,
      rangeEndIso: query.rangeEnd
    };
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
}
