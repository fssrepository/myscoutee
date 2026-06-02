import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { AppMemoryDb, HttpMemoryDb } from '../../base/db';
import type { UserRateRecord, UserRatesSyncResult } from '../../base/interfaces/game.interface';
import type { RateRecord } from '../../base/models/rate.model';
import { BaseUsersRatingsRepository } from '../../base/repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersRatingsRepository extends BaseUsersRatingsRepository {
  private static readonly USER_RATES_SYNC_ROUTE = '/user-rates/sync';
  private static readonly USER_RATES_ROUTE = '/activities/rates';

  protected override readonly memoryDb: AppMemoryDb = inject(HttpMemoryDb);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRatesByUserId: Record<string, RateRecord[]> = {};

  peekRateItemsByUserId(userId: string): RateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRateItems(
      this.mergePendingOutboxRateItems(normalizedUserId, this.cachedRatesByUserId[normalizedUserId] ?? [])
    );
  }

  async queryRateItemsByUserId(userId: string): Promise<RateRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<RateRecord[] | null>(`${this.apiBaseUrl}${HttpUsersRatingsRepository.USER_RATES_ROUTE}`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const items = this.mergePendingOutboxRateItems(normalizedUserId, Array.isArray(response) ? response : []);
      this.cachedRatesByUserId[normalizedUserId] = this.cloneRateItems(items);
      return this.cloneRateItems(items);
    } catch {
      return this.peekRateItemsByUserId(normalizedUserId);
    }
  }

  protected override async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    const payloadRates: UserRateRecord[] = [];
    const invalidRateIds: string[] = [];
    for (const rate of rates) {
      const payload = this.toUserRateSyncPayload(rate);
      if (payload) {
        payloadRates.push(payload);
      } else if (rate.id?.trim()) {
        invalidRateIds.push(rate.id.trim());
      }
    }
    if (payloadRates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: this.dedupeIds([...invalidRateIds, ...rates.map(rate => rate.id)]),
        error: 'No valid user rates to sync'
      };
    }
    try {
      const response = await this.http
        .post<{ syncedRateIds?: string[]; failedRateIds?: string[] } | null>(
          `${this.apiBaseUrl}${HttpUsersRatingsRepository.USER_RATES_SYNC_ROUTE}`,
          { rates: payloadRates }
        )
        .toPromise();
      if (!response) {
        return {
          syncedRateIds: [],
          failedRateIds: this.dedupeIds([...payloadRates.map(rate => rate.id), ...invalidRateIds]),
          error: 'Empty sync response'
        };
      }
      const syncedRateIds = Array.isArray(response.syncedRateIds)
        ? response.syncedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      const failedRateIds = Array.isArray(response.failedRateIds)
        ? response.failedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      return {
        syncedRateIds,
        failedRateIds: this.dedupeIds([...failedRateIds, ...invalidRateIds]),
        error: null
      };
    } catch {
      return {
        syncedRateIds: [],
        failedRateIds: this.dedupeIds([...payloadRates.map(rate => rate.id), ...invalidRateIds]),
        error: 'User rates sync request failed'
      };
    }
  }
}
