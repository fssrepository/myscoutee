import { Injectable, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../../contracts';
import type { ActivityRateDTO, ActivityRatePageResultDTO } from '../../../base/dto';
import type { ActivityRateRecordQuery } from '../entity/rate.entity';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRatesRepository } from '../repositories/rates.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalRatesService extends LocalRouteDelayService {
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
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO> {
    await this.waitForRouteDelay(LocalRatesService.RATES_ROUTE, signal);
    const ownerUserId = this.resolveDemoActivityUserId(userId);
    const page = await this.ratesRepository.queryActivityRateItemsPage(
      this.toActivityRateRecordQuery(ownerUserId, request)
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
      socialBadgeEnabled: request.rateSocialBadgeEnabled === true,
      sort: normalizedSort,
      sortDirection,
      cursor: request.cursor,
      limit: Math.max(1, Math.trunc(request.pageSize)),
      rangeStartIso: request.rangeStart,
      rangeEndIso: request.rangeEnd
    };
  }
}
