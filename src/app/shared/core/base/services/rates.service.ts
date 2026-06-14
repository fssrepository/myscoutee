import { Injectable, inject } from '@angular/core';

import type { ActivitiesPageRequest } from '../../contracts';
import type { ActivityRateDTO, ActivityRatePageResultDTO } from '../../contracts/activity.interface';
import type { IRatesService } from '../../contracts/activity.interface';
import { LocalRatesService } from '../../local';
import { HttpRatesService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { GameService } from './game.service';
import { RateOutboxService } from './rate-outbox.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService extends BaseRouteModeService implements IRatesService {
  private readonly localRatesService = inject(LocalRatesService);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly gameService = inject(GameService);
  private readonly rateOutboxService = inject(RateOutboxService);

  private get ratesService(): LocalRatesService | HttpRatesService {
    return this.resolveRouteService('/activities/rates', this.localRatesService, this.httpRatesService);
  }

  recordActivityRate(
    ownerUserId: string,
    item: ActivityRateDTO,
    rating: number,
    direction?: ActivityRateDTO['direction'] | null
  ): void {
    this.rateOutboxService.enqueueActivityRateOutbox(ownerUserId, item, rating, direction);
    this.gameService.resetUserGameCardsStack(ownerUserId);
    this.gameService.kickUserRatesOutboxSync();
  }

  peekRateItemsByUser(userId: string): ActivityRateDTO[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<ActivityRateDTO[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO> {
    return this.ratesService.queryActivitiesRatePage(userId, request, signal);
  }
}
