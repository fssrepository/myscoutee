import { Injectable, Injector, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateMenuItem } from '../interfaces/activity-feed.interface';
import { DemoRatesService } from '../../demo';
import { HttpRatesService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { GameService } from './game.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService extends BaseRouteModeService {
  private readonly injector = inject(Injector);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly gameService = inject(GameService);
  private demoRatesServiceRef: DemoRatesService | null = null;

  private get demoRatesService(): DemoRatesService {
    if (!this.demoRatesServiceRef) {
      this.demoRatesServiceRef = this.injector.get(DemoRatesService);
    }
    return this.demoRatesServiceRef;
  }

  private get ratesService(): DemoRatesService | HttpRatesService {
    return this.resolveRouteService('/activities/rates', this.demoRatesService, this.httpRatesService);
  }

  recordActivityRate(
    ownerUserId: string,
    item: RateMenuItem,
    rating: number,
    direction?: RateMenuItem['direction'] | null
  ): void {
    this.ratesService.recordActivityRate(ownerUserId, item, rating, direction);
    this.gameService.kickUserRatesOutboxSync();
  }

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    if (this.isDemoModeEnabled('/activities/rates')) {
      return this.demoRatesService.queryActivitiesRatePage(userId, request);
    }
    return this.httpRatesService.queryActivitiesRatePage(userId, request);
  }
}
