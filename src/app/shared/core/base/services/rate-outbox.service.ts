import { Injectable, inject } from '@angular/core';

import type { UserGameMode, UserRatesSyncResult } from '../../contracts/activity.interface';
import type { ActivityRateDTO } from '../../contracts/activity.interface';
import type { UserRateOutboxRecord } from '../../local/source/entity/rate.entity';
import { HttpRatesService } from '../../http/services/rates.service';
import { LocalRatesRepository } from '../../local/source/repositories/rates.repository';
import {
  BaseUserRatesMapper,
  type UserRateGameCardPairRecordDTO,
  type UserRateGameCardRecordDTO
} from '../mappers';
import { RateOutboxRepository } from '../repositories/rate-outbox.repository';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class RateOutboxService extends BaseRouteModeService {
  private readonly rateOutboxRepository = inject(RateOutboxRepository);
  private readonly localRatesRepository = inject(LocalRatesRepository);
  private readonly httpRatesService = inject(HttpRatesService);

  enqueueGameCardRatingOutbox(input: UserRateGameCardRecordDTO): void {
    const nextRecord = BaseUserRatesMapper.toRecord(input);
    if (nextRecord) {
      this.rateOutboxRepository.enqueueUserRateOutbox(nextRecord);
    }
  }

  enqueueGameCardPairRatingOutbox(input: UserRateGameCardPairRecordDTO): void {
    const nextRecord = BaseUserRatesMapper.toRecord(input);
    if (nextRecord) {
      this.rateOutboxRepository.enqueueUserRateOutbox(nextRecord);
    }
  }

  enqueueActivityRateOutbox(
    ownerUserId: string,
    item: ActivityRateDTO,
    rating: number,
    direction?: ActivityRateDTO['direction'] | null
  ): void {
    const nextRecord = BaseUserRatesMapper.toRecord({
      kind: 'activity-rate',
      ownerUserId,
      item,
      rating,
      direction
    });
    if (nextRecord) {
      this.rateOutboxRepository.enqueueUserRateOutbox(nextRecord);
    }
  }

  queryPendingRatedGameCardUserIds(raterUserId: string, mode: UserGameMode = 'single'): string[] {
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId) {
      return [];
    }
    const ratedUserIds = new Set<string>();
    for (const record of this.rateOutboxRepository.queryPendingUserRateRecords()) {
      if (record.ownerUserId?.trim() !== normalizedRaterId) {
        continue;
      }
      const item = BaseUserRatesMapper.toDto(record);
      if (!this.shouldExcludePendingItemFromHome(item)) {
        continue;
      }
      if (mode === 'single' && item.mode !== 'individual') {
        continue;
      }
      if (mode !== 'single' && item.mode !== 'pair') {
        continue;
      }
      const primaryUserId = item.userId.trim();
      const secondaryUserId = item.secondaryUserId?.trim() ?? '';
      if (primaryUserId && primaryUserId !== normalizedRaterId) {
        ratedUserIds.add(primaryUserId);
      }
      if (secondaryUserId && secondaryUserId !== normalizedRaterId) {
        ratedUserIds.add(secondaryUserId);
      }
    }
    return [...ratedUserIds];
  }

  queryPendingRatedGameCardPairKeys(ownerUserId: string): string[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return [];
    }
    const pairKeys = new Set<string>();
    for (const record of this.rateOutboxRepository.queryPendingUserRateRecords()) {
      if (record.ownerUserId?.trim() !== normalizedOwnerUserId) {
        continue;
      }
      const item = BaseUserRatesMapper.toDto(record);
      if (!this.shouldExcludePendingItemFromHome(item) || item.mode !== 'pair') {
        continue;
      }
      const pairKey = this.toSortedPairKey(item.userId, item.secondaryUserId ?? '');
      if (pairKey) {
        pairKeys.add(pairKey);
      }
    }
    return [...pairKeys];
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
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const itemsById = new Map<string, ActivityRateDTO>();
    for (const item of items) {
      const normalizedId = item.id.trim();
      if (!normalizedId) {
        continue;
      }
      itemsById.set(normalizedId, { ...item });
    }
    for (const record of this.rateOutboxRepository.queryPendingUserRateRecords()) {
      if (record.ownerUserId?.trim() !== normalizedUserId) {
        continue;
      }
      const item = BaseUserRatesMapper.toDto(record);
      if (!item?.id?.trim()) {
        continue;
      }
      itemsById.set(item.id.trim(), { ...item });
    }
    return [...itemsById.values()]
      .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt) || left.id.localeCompare(right.id));
  }

  private shouldExcludePendingItemFromHome(item: ActivityRateDTO | null): item is ActivityRateDTO {
    if (!item) {
      return false;
    }
    if (item.direction === 'met') {
      return true;
    }
    return Number.isFinite(item.scoreGiven) && item.scoreGiven > 0;
  }

  private toSortedPairKey(leftUserId: string, rightUserId: string): string | null {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (!normalizedLeftUserId || !normalizedRightUserId || normalizedLeftUserId === normalizedRightUserId) {
      return null;
    }
    return [normalizedLeftUserId, normalizedRightUserId]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }
}
