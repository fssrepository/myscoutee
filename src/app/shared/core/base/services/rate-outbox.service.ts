import { Injectable, inject } from '@angular/core';

import type { UserGameMode, UserRatesSyncResult } from '../../contracts/activity.interface';
import type { ActivityRateDTO } from '../dto';
import type { UserRateOutboxRecord, UserRateRecord } from '../../local/source/entity/rate.entity';
import { HttpRatesService } from '../../http/services/rates.service';
import { LocalRatesRepository } from '../../local/source/repositories/rates.repository';
import { RateOutboxRepository } from '../repositories/rate-outbox.repository';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class RateOutboxService extends BaseRouteModeService {
  private readonly rateOutboxRepository = inject(RateOutboxRepository);
  private readonly localRatesRepository = inject(LocalRatesRepository);
  private readonly httpRatesService = inject(HttpRatesService);

  enqueueGameCardRatingOutbox(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single',
    socialContext?: UserRateRecord['socialContext'],
    bridgeUserId?: string,
    bridgeCount?: number
  ): void {
    this.rateOutboxRepository.enqueueGameCardRatingOutbox(
      raterUserId,
      ratedUserId,
      rating,
      mode,
      socialContext,
      bridgeUserId,
      bridgeCount
    );
  }

  enqueueGameCardPairRatingOutbox(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number,
    socialContext?: UserRateRecord['socialContext']
  ): void {
    this.rateOutboxRepository.enqueueGameCardPairRatingOutbox(
      raterUserId,
      firstRatedUserId,
      secondRatedUserId,
      rating,
      socialContext
    );
  }

  enqueueActivityRateOutbox(
    ownerUserId: string,
    item: ActivityRateDTO,
    rating: number,
    direction?: ActivityRateDTO['direction'] | null
  ): void {
    this.rateOutboxRepository.enqueueActivityRateOutbox(ownerUserId, item, rating, direction);
  }

  queryPendingRatedGameCardUserIds(raterUserId: string, mode: UserGameMode = 'single'): string[] {
    return this.rateOutboxRepository.queryPendingRatedGameCardUserIds(raterUserId, mode);
  }

  queryPendingRatedGameCardPairKeys(ownerUserId: string): string[] {
    return this.rateOutboxRepository.queryPendingRatedGameCardPairKeys(ownerUserId);
  }

  queryPendingUserRatesOutbox(limit = 50): UserRateOutboxRecord[] {
    return this.rateOutboxRepository.queryPendingUserRatesOutbox(limit);
  }

  async flushPendingUserRatesOutboxBatch(limit = 50): Promise<void> {
    if (this.isLocalRouteEnabled('/activities/rates')) {
      await this.localRatesRepository.flushPendingUserRatesOutboxBatch(limit);
      return;
    }
    await this.httpRatesService.flushPendingUserRatesOutboxBatch(limit);
  }

  applyUserRatesSyncResult(batch: readonly UserRateOutboxRecord[], result: UserRatesSyncResult): void {
    this.rateOutboxRepository.applyUserRatesSyncResult(batch, result);
  }

  mergePendingOutboxRateItems(userId: string, items: readonly ActivityRateDTO[]): ActivityRateDTO[] {
    return this.rateOutboxRepository.mergePendingOutboxRateItems(userId, items);
  }

  toUserRateSyncPayload(record: UserRateRecord): UserRateRecord | null {
    return this.rateOutboxRepository.toUserRateSyncPayload(record);
  }
}
