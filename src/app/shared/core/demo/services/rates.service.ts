import { Injectable, inject } from '@angular/core';

import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoRatesRepository } from '../repositories/rates.repository';
import type { DemoRateRecord } from '../models/rates.model';

@Injectable({
  providedIn: 'root'
})
export class DemoRatesService {
  private static readonly RATES_ROUTE = '/activities/rates';
  private readonly ratesRepository = inject(DemoRatesRepository);

  async queryRateItemsByUser(userId: string): Promise<DemoRateRecord[]> {
    await this.waitForRouteDelay(DemoRatesService.RATES_ROUTE);
    return this.ratesRepository.queryRateItemsByUser(userId);
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
