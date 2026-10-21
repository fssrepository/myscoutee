import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { type RatingSnapshot, type ListQuery } from '@fssrepository/myscoutee-components';
import { Injectable, inject } from '@angular/core';

import type { ActivitiesFeedFilters } from '../../../contracts';
import type { ActivityRateDTO, ActivityRatePageResultDTO } from '../../../contracts/common/activity.interface';
import type { IRatesService } from '../../../contracts/common/activity.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';
import { GameService } from '../accounts/game.service';
import { RateOutboxService } from './rate-outbox.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService extends BaseRouteModeService implements IRatesService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localRatesService = this.transportAdapters.reference(LOCAL_ADAPTER.RATES);
  private readonly httpRatesService = this.transportAdapters.reference(HTTP_ADAPTER.RATES);
  private readonly gameService = inject(GameService);
  private readonly rateOutboxService = inject(RateOutboxService);

  private get ratesService(): AdapterInstance<typeof LOCAL_ADAPTER.RATES> | AdapterInstance<typeof HTTP_ADAPTER.RATES> {
    return this.resolveRouteService('/activities/rates', this.localRatesService, this.httpRatesService);
  }

  recordActivityRate(
    ownerUserId: string,
    item: ActivityRateDTO,
    rating: number,
    direction?: ActivityRateDTO['direction'] | null,
    ratingSnapshot?: RatingSnapshot
  ): void {
    this.rateOutboxService.enqueueActivityRateOutbox(ownerUserId, item, rating, direction, ratingSnapshot);
    this.gameService.resetUserGameCardsStack(ownerUserId);
    this.gameService.kickUserRatesOutboxSync();
  }

  peekRateItemsByUser(userId: string, campaignId?: string | null): ActivityRateDTO[] {
    return this.ratesService.peekRateItemsByUser(userId, campaignId);
  }

  async queryRateItemsByUser(userId: string): Promise<ActivityRateDTO[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO> {
    return this.ratesService.queryActivitiesRatePage(userId, query, signal);
  }
}
