import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { DemoUserRatesBuilder } from '../../demo/builders';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserGameMode, UserRateOutboxRecord, UserRateRecord, UserRatesSyncResult } from '../../base/interfaces/game.interface';
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

  queryPendingRatedGameCardUserIds(raterUserId: string, mode: UserGameMode = 'single'): string[] {
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId) {
      return [];
    }
    const collectPairUsers = mode !== 'single';
    const ratedUserIds = new Set<string>();
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      const payload = outboxRecord?.payload;
      if (!payload || outboxRecord.status !== 'pending') {
        continue;
      }
      if (payload.source === 'game-card') {
        if (payload.mode === 'pair' && payload.ownerUserId?.trim() === normalizedRaterId) {
          if (!collectPairUsers) {
            continue;
          }
          const firstUserId = payload.fromUserId.trim();
          const secondUserId = payload.toUserId.trim();
          if (firstUserId) {
            ratedUserIds.add(firstUserId);
          }
          if (secondUserId) {
            ratedUserIds.add(secondUserId);
          }
          continue;
        }
        if (mode === 'single' && payload.fromUserId.trim() === normalizedRaterId) {
          const ratedUserId = payload.toUserId.trim();
          if (ratedUserId) {
            ratedUserIds.add(ratedUserId);
          }
        }
        continue;
      }
      if (payload.source !== 'activity-rate') {
        continue;
      }
      const item = this.toRateMenuItem(payload, normalizedRaterId);
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

  queryRatedGameCardPairKeys(ownerUserId: string): string[] {
    return this.queryPendingRatedGameCardPairKeys(ownerUserId);
  }

  queryPendingRatedGameCardPairKeys(ownerUserId: string): string[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return [];
    }
    const pairKeys = new Set<string>();
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      const payload = outboxRecord?.payload;
      if (
        !payload
        || outboxRecord.status !== 'pending'
      ) {
        continue;
      }
      let firstUserId = '';
      let secondUserId = '';
      if (payload.source === 'game-card') {
        if (payload.mode !== 'pair' || payload.ownerUserId?.trim() !== normalizedOwnerUserId) {
          continue;
        }
        firstUserId = payload.fromUserId.trim();
        secondUserId = payload.toUserId.trim();
      } else if (payload.source === 'activity-rate') {
        const item = this.toRateMenuItem(payload, normalizedOwnerUserId);
        if (!this.shouldExcludePendingItemFromHome(item) || item.mode !== 'pair') {
          continue;
        }
        firstUserId = item.userId.trim();
        secondUserId = item.secondaryUserId?.trim() ?? '';
      } else {
        continue;
      }
      const pairKey = this.toSortedPairKey(firstUserId, secondUserId);
      if (pairKey) {
        pairKeys.add(pairKey);
      }
    }
    return [...pairKeys];
  }

  peekRateItemsByUserId(userId: string): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRateItems(
      this.mergePendingOutboxRateItems(normalizedUserId, this.cachedRatesByUserId[normalizedUserId] ?? [])
    );
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
      const items = this.mergePendingOutboxRateItems(normalizedUserId, Array.isArray(response) ? response : []);
      this.cachedRatesByUserId[normalizedUserId] = this.cloneRateItems(items);
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
    this.enqueueNormalizedRateOutbox(nextRecord);
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
    this.enqueueNormalizedRateOutbox(nextRecord);
  }

  enqueueActivityRateOutbox(
    ownerUserId: string,
    item: RateMenuItem,
    rating: number,
    direction?: RateMenuItem['direction'] | null
  ): void {
    const nextRecord = this.buildNormalizedActivityRateRecord(ownerUserId, item, rating, direction);
    if (!nextRecord) {
      return;
    }
    this.enqueueNormalizedRateOutbox(nextRecord);
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
    return DemoUserRatesBuilder.toActivityRateRecord(normalizedRaterId, {
      id: `game-card:${normalizedRaterId}:${normalizedRatedUserId}`,
      userId: normalizedRatedUserId,
      mode: mode === 'pair' ? 'pair' : 'individual',
      direction: 'given',
      socialContext: mode === 'pair' ? 'separated-friends' : undefined,
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Single rate',
      happenedAt: nowIso,
      distanceKm: 0
    });
  }

  protected buildNormalizedActivityRateRecord(
    ownerUserId: string,
    item: RateMenuItem,
    rating: number,
    direction?: RateMenuItem['direction'] | null
  ): UserRateRecord | null {
    const normalizedOwnerUserId = ownerUserId.trim();
    const normalizedUserId = item.userId.trim();
    if (!normalizedOwnerUserId || !normalizedUserId) {
      return null;
    }
    const nextDirection = this.normalizeRateDirection(direction ?? item.direction);
    if (!nextDirection) {
      return null;
    }
    return DemoUserRatesBuilder.toActivityRateRecord(normalizedOwnerUserId, {
      ...item,
      userId: normalizedUserId,
      secondaryUserId: item.secondaryUserId?.trim() || undefined,
      direction: nextDirection,
      socialContext: item.socialContext,
      bridgeUserId: item.bridgeUserId?.trim() || undefined,
      bridgeCount: Number.isFinite(item.bridgeCount) ? Math.max(0, Math.trunc(Number(item.bridgeCount))) : undefined,
      scoreGiven: this.normalizeRateScore(rating),
      scoreReceived: this.normalizeRateScore(item.scoreReceived),
      eventName: item.eventName?.trim() || 'Rate',
      happenedAt: item.happenedAt?.trim() || new Date().toISOString(),
      distanceKm: Number.isFinite(item.distanceKm) ? Number(item.distanceKm) : 0,
      distanceMetersExact: Number.isFinite(item.distanceMetersExact)
        ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
        : undefined
    });
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
    return DemoUserRatesBuilder.toActivityRateRecord(normalizedOwnerUserId, {
      id: `game-card-pair:${normalizedOwnerUserId}:${fromUserId}:${toUserId}`,
      userId: fromUserId,
      secondaryUserId: toUserId,
      mode: 'pair',
      direction: 'given',
      socialContext: 'separated-friends',
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Pair rate',
      happenedAt: nowIso,
      distanceKm: 0
    });
  }

  private enqueueNormalizedRateOutbox(nextRecord: UserRateRecord): void {
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
    void this.memoryDb.flushToIndexedDb();
  }

  private mergePendingOutboxRateItems(userId: string, items: readonly RateMenuItem[]): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const itemsById = new Map<string, RateMenuItem>();
    for (const item of items) {
      const normalizedId = item.id.trim();
      if (!normalizedId) {
        continue;
      }
      itemsById.set(normalizedId, { ...item });
    }
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    for (const id of outboxTable.ids) {
      const record = outboxTable.byId[id];
      const item = record?.payload ? this.toRateMenuItem(record.payload, normalizedUserId) : null;
      if (!item?.id?.trim()) {
        continue;
      }
      itemsById.set(item.id.trim(), { ...item });
    }
    return [...itemsById.values()]
      .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt) || left.id.localeCompare(right.id));
  }

  private toRateMenuItem(record: UserRateRecord, ownerUserId: string): RateMenuItem | null {
    if (record.source === 'activity-rate') {
      return DemoUserRatesBuilder.toRateMenuItem(record);
    }
    return DemoUserRatesBuilder.toGameCardRateMenuItem(record, ownerUserId);
  }

  private normalizeRateDirection(direction: RateMenuItem['direction'] | string | null | undefined): RateMenuItem['direction'] | null {
    if (direction === 'given' || direction === 'received' || direction === 'mutual' || direction === 'met') {
      return direction;
    }
    return null;
  }

  private normalizeRateScore(value: number): number {
    return Math.max(1, Math.min(10, Math.trunc(Number(value) || 0)));
  }

  private shouldExcludePendingItemFromHome(item: RateMenuItem | null): item is RateMenuItem {
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
