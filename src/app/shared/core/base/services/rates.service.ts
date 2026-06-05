import { Injectable, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateRecord } from '../models/rate.model';
import type { ActivityRatePageResult } from '../interfaces/game.interface';
import { LocalRatesService } from '../../local';
import { HttpRatesService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { GameService } from './game.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService extends BaseRouteModeService {
  private readonly localRatesService = inject(LocalRatesService);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly gameService = inject(GameService);

  private get ratesService(): LocalRatesService | HttpRatesService {
    return this.resolveRouteService('/activities/rates', this.localRatesService, this.httpRatesService);
  }

  recordActivityRate(
    ownerUserId: string,
    item: RateRecord,
    rating: number,
    direction?: RateRecord['direction'] | null
  ): void {
    this.ratesService.recordActivityRate(ownerUserId, item, rating, direction);
    this.gameService.resetUserGameCardsStack(ownerUserId);
    this.gameService.kickUserRatesOutboxSync();
  }

  peekRateItemsByUser(userId: string): RateRecord[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateRecord[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResult> {
    return this.ratesService.queryActivitiesRatePage(userId, request, signal);
  }
}
