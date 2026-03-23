import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserRateOutboxRecord, UserRateRecord, UserRatesSyncResult } from '../../base/interfaces/game.interface';
import {
  USER_RATES_OUTBOX_TABLE_NAME
} from '../../demo/models/users.model';
import { AppMemoryDb } from '../../base/db';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersRatingsRepository {
  private static readonly USER_RATES_SYNC_ROUTE = '/user-rates/sync';
  private static readonly USER_RATES_ROUTE = '/activities/rates';

  protected readonly memoryDb = inject(AppMemoryDb);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRatesByUserId: Record<string, RateMenuItem[]> = {};

  queryPendingUserRatesOutbox(limit = 50): UserRateOutboxRecord[] {
    const maxItems = Math.max(1, Math.trunc(Number(limit) || 50));
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    return outboxTable.ids
      .map(id => outboxTable.byId[id])
      .filter((record): record is UserRateOutboxRecord => Boolean(record))
      .filter(record => record.status === 'pending')
      .sort((left, right) => left.queuedAtIso.localeCompare(right.queuedAtIso))
      .slice(0, maxItems)
      .map(record => ({
        ...record,
        payload: { ...record.payload }
      }));
  }

  async flushPendingUserRatesOutboxBatch(limit = 50): Promise<void> {
    const batch = this.queryPendingUserRatesOutbox(limit);
    if (batch.length === 0) {
      return;
    }
    const syncResult = await this.syncUserRatesBatch(
      batch.map(item => ({ ...item.payload }))
    );
    this.applyUserRatesSyncResult(batch, syncResult.syncedRateIds, syncResult.failedRateIds, syncResult.error);
  }

  peekRateItemsByUserId(userId: string): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRateItems(this.cachedRatesByUserId[normalizedUserId] ?? []);
  }

  async queryRateItemsByUserId(userId: string): Promise<RateMenuItem[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<RateMenuItem[] | null>(`${this.apiBaseUrl}${HttpUsersRatingsRepository.USER_RATES_ROUTE}`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const items = this.cloneRateItems(Array.isArray(response) ? response : []);
      this.cachedRatesByUserId[normalizedUserId] = items;
      return this.cloneRateItems(items);
    } catch {
      return this.peekRateItemsByUserId(normalizedUserId);
    }
  }

  markUserRatesOutboxSynced(outboxIds: string[]): void {
    const normalizedIds = outboxIds
      .map(id => id.trim())
      .filter(id => id.length > 0);
    if (normalizedIds.length === 0) {
      return;
    }
    const lookup = new Set(normalizedIds);
    this.memoryDb.write(state => {
      const table = state[USER_RATES_OUTBOX_TABLE_NAME];
      const byId = { ...table.byId };
      const nextIds: string[] = [];
      for (const id of table.ids) {
        if (lookup.has(id)) {
          delete byId[id];
          continue;
        }
        nextIds.push(id);
      }
      return {
        ...state,
        [USER_RATES_OUTBOX_TABLE_NAME]: {
          byId,
          ids: nextIds
        }
      };
    });
  }

  markUserRatesOutboxFailed(outboxIds: string[], message?: string): void {
    const normalizedIds = outboxIds
      .map(id => id.trim())
      .filter(id => id.length > 0);
    if (normalizedIds.length === 0) {
      return;
    }
    const lookup = new Set(normalizedIds);
    this.memoryDb.write(state => {
      const table = state[USER_RATES_OUTBOX_TABLE_NAME];
      const byId = { ...table.byId };
      const nowIso = new Date().toISOString();
      for (const id of table.ids) {
        if (!lookup.has(id)) {
          continue;
        }
        const record = byId[id];
        if (!record) {
          continue;
        }
        byId[id] = {
          ...record,
          status: 'pending',
          updatedAtIso: nowIso,
          lastTriedAtIso: nowIso,
          retryCount: record.retryCount + 1,
          lastError: message?.trim() || 'Sync failed'
        };
      }
      return {
        ...state,
        [USER_RATES_OUTBOX_TABLE_NAME]: {
          byId,
          ids: [...table.ids]
        }
      };
    });
  }

  requeueFailedUserRatesOutbox(outboxIds: string[]): void {
    const normalizedIds = outboxIds
      .map(id => id.trim())
      .filter(id => id.length > 0);
    if (normalizedIds.length === 0) {
      return;
    }
    const lookup = new Set(normalizedIds);
    this.memoryDb.write(state => {
      const table = state[USER_RATES_OUTBOX_TABLE_NAME];
      const byId = { ...table.byId };
      const nowIso = new Date().toISOString();
      for (const id of table.ids) {
        if (!lookup.has(id)) {
          continue;
        }
        const record = byId[id];
        if (!record) {
          continue;
        }
        byId[id] = {
          ...record,
          status: 'pending',
          updatedAtIso: nowIso,
          lastError: null
        };
      }
      return {
        ...state,
        [USER_RATES_OUTBOX_TABLE_NAME]: {
          byId,
          ids: [...table.ids]
        }
      };
    });
  }

  enqueueGameCardRatingOutbox(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    const nextRecord = this.buildNormalizedRateRecord(raterUserId, ratedUserId, rating, mode);
    if (!nextRecord) {
      return;
    }
    this.memoryDb.write(state => {
      const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];
      const outboxId = `upsert:${nextRecord.id}`;
      const previousOutbox = outboxTable.byId[outboxId];
      const nextOutboxRecord: UserRateOutboxRecord = {
        id: outboxId,
        rateId: nextRecord.id,
        action: 'upsert',
        payload: nextRecord,
        status: 'pending',
        retryCount: previousOutbox?.retryCount ?? 0,
        queuedAtIso: previousOutbox?.queuedAtIso ?? nextRecord.updatedAtIso,
        updatedAtIso: nextRecord.updatedAtIso,
        lastTriedAtIso: previousOutbox?.lastTriedAtIso ?? null,
        syncedAtIso: null,
        lastError: null
      };
      return {
        ...state,
        [USER_RATES_OUTBOX_TABLE_NAME]: {
          byId: {
            ...outboxTable.byId,
            [outboxId]: nextOutboxRecord
          },
          ids: previousOutbox ? outboxTable.ids : [...outboxTable.ids, outboxId]
        }
      };
    });
  }

  enqueueGameCardPairRatingOutbox(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number
  ): void {
    const nextRecord = this.buildNormalizedPairRateRecord(raterUserId, firstRatedUserId, secondRatedUserId, rating);
    if (!nextRecord) {
      return;
    }
    this.memoryDb.write(state => {
      const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];
      const outboxId = `upsert:${nextRecord.id}`;
      const previousOutbox = outboxTable.byId[outboxId];
      const nextOutboxRecord: UserRateOutboxRecord = {
        id: outboxId,
        rateId: nextRecord.id,
        action: 'upsert',
        payload: nextRecord,
        status: 'pending',
        retryCount: previousOutbox?.retryCount ?? 0,
        queuedAtIso: previousOutbox?.queuedAtIso ?? nextRecord.updatedAtIso,
        updatedAtIso: nextRecord.updatedAtIso,
        lastTriedAtIso: previousOutbox?.lastTriedAtIso ?? null,
        syncedAtIso: null,
        lastError: null
      };
      return {
        ...state,
        [USER_RATES_OUTBOX_TABLE_NAME]: {
          byId: {
            ...outboxTable.byId,
            [outboxId]: nextOutboxRecord
          },
          ids: previousOutbox ? outboxTable.ids : [...outboxTable.ids, outboxId]
        }
      };
    });
  }

  protected async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    try {
      const response = await this.http
        .post<{ syncedRateIds?: string[]; failedRateIds?: string[] } | null>(
          `${this.apiBaseUrl}${HttpUsersRatingsRepository.USER_RATES_SYNC_ROUTE}`,
          { rates }
        )
        .toPromise();
      if (!response) {
        return {
          syncedRateIds: [],
          failedRateIds: rates.map(rate => rate.id),
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
        failedRateIds,
        error: null
      };
    } catch {
      return {
        syncedRateIds: [],
        failedRateIds: rates.map(rate => rate.id),
        error: 'User rates sync request failed'
      };
    }
  }

  protected buildNormalizedRateRecord(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair'
  ): UserRateRecord | null {
    const normalizedRaterId = raterUserId.trim();
    const normalizedRatedUserId = ratedUserId.trim();
    if (!normalizedRaterId || !normalizedRatedUserId || normalizedRaterId === normalizedRatedUserId) {
      return null;
    }
    const normalizedRating = Math.max(1, Math.min(10, Math.trunc(Number(rating) || 0)));
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      return null;
    }
    const nowIso = new Date().toISOString();
    return {
      id: `game-card:${normalizedRaterId}:${normalizedRatedUserId}`,
      fromUserId: normalizedRaterId,
      toUserId: normalizedRatedUserId,
      rate: normalizedRating,
      mode: mode === 'pair' ? 'pair' : 'single',
      source: 'game-card',
      createdAtIso: nowIso,
      updatedAtIso: nowIso
    };
  }

  protected buildNormalizedPairRateRecord(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number
  ): UserRateRecord | null {
    const normalizedOwnerUserId = raterUserId.trim();
    const normalizedFirstUserId = firstRatedUserId.trim();
    const normalizedSecondUserId = secondRatedUserId.trim();
    if (
      !normalizedOwnerUserId
      || !normalizedFirstUserId
      || !normalizedSecondUserId
      || normalizedFirstUserId === normalizedSecondUserId
      || normalizedFirstUserId === normalizedOwnerUserId
      || normalizedSecondUserId === normalizedOwnerUserId
    ) {
      return null;
    }
    const normalizedRating = Math.max(1, Math.min(10, Math.trunc(Number(rating) || 0)));
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      return null;
    }
    const [fromUserId, toUserId] = [normalizedFirstUserId, normalizedSecondUserId].sort((left, right) => left.localeCompare(right));
    const nowIso = new Date().toISOString();
    return {
      id: `game-card-pair:${normalizedOwnerUserId}:${fromUserId}:${toUserId}`,
      fromUserId,
      toUserId,
      rate: normalizedRating,
      mode: 'pair',
      source: 'game-card',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      ownerUserId: normalizedOwnerUserId
    };
  }

  private applyUserRatesSyncResult(
    batch: UserRateOutboxRecord[],
    syncedRateIds: string[],
    failedRateIds: string[],
    error: string | null
  ): void {
    const outboxIdByRateId = new Map<string, string>();
    for (const item of batch) {
      outboxIdByRateId.set(item.rateId, item.id);
    }
    const syncedOutboxIds = syncedRateIds
      .map(rateId => outboxIdByRateId.get(rateId) ?? null)
      .filter((id): id is string => Boolean(id));
    const failedOutboxIds = failedRateIds
      .map(rateId => outboxIdByRateId.get(rateId) ?? null)
      .filter((id): id is string => Boolean(id));

    const touched = new Set([...syncedOutboxIds, ...failedOutboxIds]);
    const unresolvedOutboxIds = batch
      .map(item => item.id)
      .filter(id => !touched.has(id));

    if (syncedOutboxIds.length > 0) {
      this.markUserRatesOutboxSynced(syncedOutboxIds);
    }

    const allFailedOutboxIds = [...failedOutboxIds, ...unresolvedOutboxIds];
    if (allFailedOutboxIds.length > 0) {
      this.markUserRatesOutboxFailed(allFailedOutboxIds, error ?? undefined);
    }
  }

  private cloneRateItems(items: readonly RateMenuItem[]): RateMenuItem[] {
    return items.map(item => ({ ...item }));
  }
}
