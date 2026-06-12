import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { UserRatesBuilder } from '../builders/user-rates.builder';
import { type AppMemoryDb, HttpMemoryDb, LocalMemoryDb } from '../db';
import { resolveRouteConfig } from '../config';
import type {
  UserGameMode,
  UserRateOutboxRecord,
  UserRateRecord,
  UserRatesSyncResult
} from '../../contracts/activity.interface';
import type { RateRecord } from '../../contracts/activity.interface';
import {
  USER_RATES_OUTBOX_TABLE_NAME
} from '../models/users.model';
import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root'
})
export class RateOutboxRepository {
  private readonly localMemoryDb = inject(LocalMemoryDb);
  private readonly httpMemoryDb = inject(HttpMemoryDb);
  private readonly sessionService = inject(SessionService);

  protected get memoryDb(): AppMemoryDb {
    return this.isLocalRouteEnabled('/activities/rates')
      ? this.localMemoryDb
      : this.httpMemoryDb;
  }

  private isLocalRouteEnabled(route: string): boolean {
    const routeConfig = resolveRouteConfig(route);
    if (routeConfig.http) {
      return false;
    }
    return environment.activitiesDataSource !== 'http'
      && (this.sessionService.currentSession()?.kind === 'demo' || !environment.firebaseLoginEnabled);
  }

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

  queryPendingUserRateRecords(limit = Number.MAX_SAFE_INTEGER): UserRateRecord[] {
    return this.queryPendingUserRatesOutbox(limit)
      .map(record => ({ ...record.payload }));
  }

  queryPendingRatedGameCardUserIds(raterUserId: string, mode: UserGameMode = 'single'): string[] {
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId) {
      return [];
    }
    const ratedUserIds = new Set<string>();
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      const payload = outboxRecord?.payload;
      if (!payload || outboxRecord.status !== 'pending') {
        continue;
      }
      const item = this.toRateRecord(payload);
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
      const item = this.toRateRecord(payload);
      if (!this.shouldExcludePendingItemFromHome(item) || item.mode !== 'pair') {
        continue;
      }
      const firstUserId = item.userId.trim();
      const secondUserId = item.secondaryUserId?.trim() ?? '';
      const pairKey = this.toSortedPairKey(firstUserId, secondUserId);
      if (pairKey) {
        pairKeys.add(pairKey);
      }
    }
    return [...pairKeys];
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
    mode: 'single' | 'pair' = 'single',
    socialContext?: UserRateRecord['socialContext'],
    bridgeUserId?: string,
    bridgeCount?: number
  ): void {
    const nextRecord = this.buildNormalizedRateRecord(
      raterUserId,
      ratedUserId,
      rating,
      mode,
      socialContext,
      bridgeUserId,
      bridgeCount
    );
    if (!nextRecord) {
      return;
    }
    this.enqueueNormalizedRateOutbox(nextRecord);
  }

  enqueueGameCardPairRatingOutbox(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number,
    socialContext?: UserRateRecord['socialContext']
  ): void {
    const nextRecord = this.buildNormalizedPairRateRecord(
      raterUserId,
      firstRatedUserId,
      secondRatedUserId,
      rating,
      socialContext
    );
    if (!nextRecord) {
      return;
    }
    this.enqueueNormalizedRateOutbox(nextRecord);
  }

  enqueueActivityRateOutbox(
    ownerUserId: string,
    item: RateRecord,
    rating: number,
    direction?: RateRecord['direction'] | null
  ): void {
    const nextRecord = this.buildNormalizedActivityRateRecord(ownerUserId, item, rating, direction);
    if (!nextRecord) {
      return;
    }
    this.enqueueNormalizedRateOutbox(nextRecord);
  }

  protected buildNormalizedRateRecord(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair',
    socialContext?: UserRateRecord['socialContext'],
    bridgeUserId?: string,
    bridgeCount?: number
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
    const normalizedSocialContext = this.normalizeRateSocialContext(mode, socialContext);
    const normalizedBridgeUserId = normalizedSocialContext === 'friends-in-common'
      ? bridgeUserId?.trim() ?? ''
      : '';
    const normalizedBridgeCount = normalizedSocialContext === 'friends-in-common' && Number.isFinite(Number(bridgeCount))
      ? Math.max(1, Math.trunc(Number(bridgeCount)))
      : undefined;
    return UserRatesBuilder.toActivityRateRecord(normalizedRaterId, {
      id: `game-card:${normalizedRaterId}:${normalizedRatedUserId}`,
      userId: normalizedRatedUserId,
      mode: mode === 'pair' ? 'pair' : 'individual',
      direction: 'given',
      socialContext: normalizedSocialContext ?? undefined,
      ...(normalizedBridgeUserId ? { bridgeUserId: normalizedBridgeUserId } : {}),
      ...(normalizedBridgeCount ? { bridgeCount: normalizedBridgeCount } : {}),
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Single rate',
      happenedAt: nowIso,
      distanceMetersExact: 0
    });
  }

  buildNormalizedActivityRateRecord(
    ownerUserId: string,
    item: RateRecord,
    rating: number,
    direction?: RateRecord['direction'] | null
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
    return UserRatesBuilder.toActivityRateRecord(normalizedOwnerUserId, {
      ...item,
      userId: normalizedUserId,
      secondaryUserId: item.secondaryUserId?.trim() || undefined,
      direction: nextDirection,
      socialContext: item.socialContext,
      bridgeUserId: item.bridgeUserId?.trim() || undefined,
      bridgeCount: Number.isFinite(item.bridgeCount) ? Math.max(0, Math.trunc(Number(item.bridgeCount))) : undefined,
      scoreGiven: this.normalizeRateScore(rating),
      scoreReceived: this.normalizeOptionalRateScore(item.scoreReceived),
      eventName: item.eventName?.trim() || 'Rate',
      happenedAt: item.happenedAt?.trim() || new Date().toISOString(),
      distanceMetersExact: Number.isFinite(item.distanceMetersExact)
        ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
        : 0
    });
  }

  protected buildNormalizedPairRateRecord(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number,
    socialContext?: UserRateRecord['socialContext']
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
    return UserRatesBuilder.toActivityRateRecord(normalizedOwnerUserId, {
      id: `game-card-pair:${normalizedOwnerUserId}:${fromUserId}:${toUserId}`,
      userId: fromUserId,
      secondaryUserId: toUserId,
      mode: 'pair',
      direction: 'given',
      socialContext: this.normalizeRateSocialContext('pair', socialContext) ?? undefined,
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Pair rate',
      happenedAt: nowIso,
      distanceMetersExact: 0
    });
  }

  protected enqueueNormalizedRateOutbox(nextRecord: UserRateRecord): void {
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

  mergePendingOutboxRateItems(userId: string, items: readonly RateRecord[]): RateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const itemsById = new Map<string, RateRecord>();
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
      const item = record?.payload ? this.toRateRecord(record.payload) : null;
      if (!item?.id?.trim()) {
        continue;
      }
      itemsById.set(item.id.trim(), { ...item });
    }
    return [...itemsById.values()]
      .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt) || left.id.localeCompare(right.id));
  }

  protected toRateRecord(record: UserRateRecord): RateRecord | null {
    return UserRatesBuilder.toRateRecord(record);
  }

  protected normalizeRateDirection(direction: RateRecord['direction'] | string | null | undefined): RateRecord['direction'] | null {
    if (direction === 'given' || direction === 'received' || direction === 'mutual' || direction === 'met') {
      return direction;
    }
    return null;
  }

  protected normalizeRateScore(value: number): number {
    return Math.max(1, Math.min(10, Math.trunc(Number(value) || 0)));
  }

  protected normalizeOptionalRateScore(value: unknown): number {
    if (!Number.isFinite(Number(value))) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }

  toUserRateSyncPayload(record: UserRateRecord): UserRateRecord | null {
    const id = record.id?.trim() ?? '';
    const fromUserId = record.fromUserId?.trim() ?? '';
    const toUserId = record.toUserId?.trim() ?? '';
    const mode = record.mode === 'pair' ? 'pair' : record.mode === 'single' ? 'single' : null;
    if (!id || !fromUserId || !toUserId || !mode || fromUserId === toUserId) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const createdAtIso = record.createdAtIso?.trim() || record.happenedAtIso?.trim() || record.updatedAtIso?.trim() || nowIso;
    const updatedAtIso = record.updatedAtIso?.trim() || createdAtIso;
    const payload: UserRateRecord = {
      id,
      fromUserId,
      toUserId,
      rate: this.normalizeOptionalRateScore(record.rate),
      mode,
      createdAtIso,
      updatedAtIso
    };
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (ownerUserId) {
      payload.ownerUserId = ownerUserId;
    }
    const displayId = record.displayId?.trim() ?? '';
    if (displayId) {
      payload.displayId = displayId;
    }
    const displayDirection = this.normalizeRateDirection(record.displayDirection);
    if (displayDirection) {
      payload.displayDirection = displayDirection;
    }
    const socialContext = this.normalizeRateSocialContext(mode, record.socialContext);
    if (socialContext) {
      payload.socialContext = socialContext;
    }
    const bridgeUserId = record.bridgeUserId?.trim() ?? '';
    if (bridgeUserId) {
      payload.bridgeUserId = bridgeUserId;
    }
    if (Number.isFinite(Number(record.bridgeCount))) {
      payload.bridgeCount = Math.max(0, Math.trunc(Number(record.bridgeCount)));
    }
    payload.scoreGiven = this.normalizeOptionalRateScore(record.scoreGiven);
    payload.scoreReceived = this.normalizeOptionalRateScore(record.scoreReceived);
    const eventName = record.eventName?.trim() ?? '';
    if (eventName) {
      payload.eventName = eventName;
    }
    const happenedAtIso = record.happenedAtIso?.trim() ?? '';
    if (happenedAtIso) {
      payload.happenedAtIso = happenedAtIso;
    }
    if (Number.isFinite(Number(record.distanceMetersExact))) {
      payload.distanceMetersExact = Math.max(0, Math.trunc(Number(record.distanceMetersExact)));
    }
    return payload;
  }

  protected normalizeRateSocialContext(
    mode: 'single' | 'pair',
    value: unknown
  ): UserRateRecord['socialContext'] | null {
    if (mode === 'single') {
      return value === 'friends-in-common' ? 'friends-in-common' : null;
    }
    return value === 'separated-friends' ? 'separated-friends' : null;
  }

  protected dedupeIds(ids: readonly string[]): string[] {
    return [...new Set(ids
      .map(id => `${id ?? ''}`.trim())
      .filter(id => id.length > 0))];
  }

  protected cloneRateItems(items: readonly RateRecord[]): RateRecord[] {
    return items.map(item => ({ ...item }));
  }

  private shouldExcludePendingItemFromHome(item: RateRecord | null): item is RateRecord {
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

  applyUserRatesSyncResult(batch: readonly UserRateOutboxRecord[], result: UserRatesSyncResult): void {
    this.applyUserRatesSyncOutcome(batch, result.syncedRateIds, result.failedRateIds, result.error);
  }

  private applyUserRatesSyncOutcome(
    batch: readonly UserRateOutboxRecord[],
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
}
