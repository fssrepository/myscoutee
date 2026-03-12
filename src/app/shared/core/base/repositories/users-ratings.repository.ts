import { Injectable, inject } from '@angular/core';

import type { UserRateOutboxRecord, UserRateRecord } from '../../user.interface';
import {
  USER_RATES_OUTBOX_TABLE_NAME
} from '../../demo/models/users.model';
import { AppMemoryDb } from '../../app.db';

@Injectable({
  providedIn: 'root'
})
export class UsersRatingsRepository {
  protected readonly memoryDb = inject(AppMemoryDb);

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
}
