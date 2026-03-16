import { Injectable, inject } from '@angular/core';

import type { RateMenuItem } from '../../../demo-data';
import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoRatesService {
  private static readonly RATES_ROUTE = '/activities/rates';
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
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
}
