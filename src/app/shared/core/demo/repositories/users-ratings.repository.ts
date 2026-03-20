import { Injectable } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import { DemoUserRatesBuilder } from '../builders';
import type { RateMenuItem } from '../../../demo-data';
import type {
  ActivityRateRecordQuery,
  UserRateRecord,
  UserRatesSyncResult
} from '../../base/interfaces/game.interface';
import { HttpUsersRatingsRepository } from '../../http/repositories/users-ratings.repository';
import {
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME
} from '../models/users.model';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRatingsRepository extends HttpUsersRatingsRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }
    const table = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    const hasActivityRateSeed = table.ids.some(id => table.byId[id]?.source === 'activity-rate');
    if (hasActivityRateSeed) {
      this.initialized = true;
      return;
    }
    const users = AppDemoGenerators.buildExpandedDemoUsers(DemoUsersRatingsRepository.DEFAULT_DEMO_USERS_COUNT);
    const records = DemoUserRatesBuilder.buildActivityRateSeedRecords(users, { extraSingleGivenCount: 20 });
    if (records.length === 0) {
      return;
    }
    this.memoryDb.write(state => {
      const current = state[USER_RATES_TABLE_NAME];
      const byId = { ...current.byId };
      const ids = [...current.ids];
      const existingIds = new Set(ids);
      for (const record of records) {
        byId[record.id] = { ...record };
        if (!existingIds.has(record.id)) {
          existingIds.add(record.id);
          ids.push(record.id);
        }
      }
      return {
        ...state,
        [USER_RATES_TABLE_NAME]: {
          ...current,
          byId,
          ids
        }
      };
    });
    this.initialized = true;
  }

  queryRatedGameCardUserIds(raterUserId: string): string[] {
    this.init();
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId) {
      return [];
    }
    const state = this.memoryDb.read();
    const ratesTable = state[USER_RATES_TABLE_NAME];
    const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];

    const ratedUserIds = new Set<string>();

    for (const id of ratesTable.ids) {
      const record = ratesTable.byId[id];
      if (record && record.source === 'game-card') {
        if (record.mode === 'pair' && record.ownerUserId?.trim() === normalizedRaterId) {
          ratedUserIds.add(record.fromUserId.trim());
          ratedUserIds.add(record.toUserId.trim());
        } else if (record.fromUserId === normalizedRaterId) {
          ratedUserIds.add(record.toUserId.trim());
        }
      }
    }

    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      if (outboxRecord?.payload && outboxRecord.payload.source === 'game-card' && outboxRecord.status === 'pending') {
        const payload = outboxRecord.payload;
        if (payload.mode === 'pair' && payload.ownerUserId?.trim() === normalizedRaterId) {
          ratedUserIds.add(payload.fromUserId.trim());
          ratedUserIds.add(payload.toUserId.trim());
        } else if (payload.fromUserId === normalizedRaterId) {
          ratedUserIds.add(payload.toUserId.trim());
        }
      }
    }

    return Array.from(ratedUserIds).filter(id => id.length > 0);
  }

  queryActivityRateItemsByUserId(userId: string): RateMenuItem[] {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    return ratesTable.ids
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record => record.source === 'activity-rate')
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => DemoUserRatesBuilder.toRateMenuItem(record))
      .filter((item): item is RateMenuItem => Boolean(item));
  }

  override peekRateItemsByUserId(userId: string): RateMenuItem[] {
    this.init();
    return this.buildRateItemsByUserId(userId);
  }

  override async queryRateItemsByUserId(userId: string): Promise<RateMenuItem[]> {
    this.init();
    return this.buildRateItemsByUserId(userId);
  }

  async queryActivityRateItemsPage(query: ActivityRateRecordQuery): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    this.init();
    const result = await this.memoryDb.queryActivityRateRecords(query);
    const items = result.records
      .map(record => DemoUserRatesBuilder.toRateMenuItem(record))
      .filter((item): item is RateMenuItem => Boolean(item));

    return {
      items,
      total: result.total,
      nextCursor: result.nextCursor ?? null
    };
  }

  private buildRateItemsByUserId(userId: string): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    const recordsById = new Map<string, UserRateRecord>();
    const indexedIds = ratesTable.idsByRelevantUserId[normalizedUserId] ?? [];
    for (const id of indexedIds) {
      const record = ratesTable.byId[id];
      if (record) {
        recordsById.set(record.id, record);
      }
    }
    for (const id of outboxTable.ids) {
      const record = outboxTable.byId[id];
      if (!record?.payload) {
        continue;
      }
      recordsById.set(record.payload.id, record.payload);
    }
    return [...recordsById.values()]
      .filter((record): record is UserRateRecord => Boolean(record))
      .flatMap(record => {
        if (record.source === 'activity-rate') {
          if (record.ownerUserId !== normalizedUserId) {
            return [];
          }
          const item = DemoUserRatesBuilder.toRateMenuItem(record);
          return item ? [item] : [];
        }
        const item = DemoUserRatesBuilder.toGameCardRateMenuItem(record, normalizedUserId);
        return item ? [item] : [];
      })
      .sort((left, right) => AppUtils.toSortableDate(right.happenedAt) - AppUtils.toSortableDate(left.happenedAt));
  }

  queryUserRatesByUserId(userId: string): UserRateRecord[] {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    const indexedIds = ratesTable.idsByRelevantUserId[normalizedUserId] ?? [];
    return indexedIds
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record =>
        record.fromUserId === normalizedUserId
        || record.toUserId === normalizedUserId
        || record.ownerUserId === normalizedUserId
      )
      .map(record => ({ ...record }));
  }

  upsertGameCardRatings(records: readonly UserRateRecord[]): string[] {
    this.init();
    const normalizedRecords = records
      .map(record => this.normalizeIncomingRateRecord(record))
      .filter((record): record is UserRateRecord => Boolean(record));
    if (normalizedRecords.length === 0) {
      return [];
    }
    this.memoryDb.write(state => {
      const table = state[USER_RATES_TABLE_NAME];
      const byId = { ...table.byId };
      const ids = [...table.ids];
      const existingIds = new Set(ids);
      for (const record of normalizedRecords) {
        const previous = byId[record.id];
        if (previous) {
          record.createdAtIso = previous.createdAtIso;
        }
        byId[record.id] = record;
        if (!existingIds.has(record.id)) {
          existingIds.add(record.id);
          ids.push(record.id);
        }
      }
      return {
        ...state,
        [USER_RATES_TABLE_NAME]: {
          ...table,
          byId,
          ids
        }
      };
    });
    return normalizedRecords.map(record => record.id);
  }

  protected override async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    const syncedRateIds = this.upsertGameCardRatings(rates);
    const syncedIds = new Set(syncedRateIds);
    const failedRateIds = rates
      .map(rate => rate.id.trim())
      .filter(rateId => rateId.length > 0 && !syncedIds.has(rateId));
    return {
      syncedRateIds,
      failedRateIds,
      error: failedRateIds.length > 0 ? 'Invalid demo rate payload' : null
    };
  }

  private normalizeIncomingRateRecord(record: UserRateRecord): UserRateRecord | null {
    const normalized = record.mode === 'pair' && record.ownerUserId
      ? this.buildNormalizedPairRateRecord(
          record.ownerUserId,
          record.fromUserId,
          record.toUserId,
          record.rate
        )
      : this.buildNormalizedRateRecord(
          record.fromUserId,
          record.toUserId,
          record.rate,
          record.mode
        );
    if (!normalized) {
      return null;
    }
    const createdAtIso = typeof record.createdAtIso === 'string' && record.createdAtIso.trim().length > 0
      ? record.createdAtIso
      : normalized.createdAtIso;
    const updatedAtIso = typeof record.updatedAtIso === 'string' && record.updatedAtIso.trim().length > 0
      ? record.updatedAtIso
      : normalized.updatedAtIso;
    return {
      ...normalized,
      ownerUserId: record.mode === 'pair' ? record.ownerUserId?.trim() || normalized.ownerUserId : normalized.ownerUserId,
      createdAtIso,
      updatedAtIso
    };
  }
}
