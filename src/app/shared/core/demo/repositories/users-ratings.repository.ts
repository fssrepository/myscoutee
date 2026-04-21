import { Injectable } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import { DemoUserRatesBuilder, DemoUserSeedBuilder } from '../builders';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  ActivityRateRecordQuery,
  UserRateRecord,
  UserRatesSyncResult
} from '../../base/interfaces/game.interface';
import { HttpUsersRatingsRepository } from '../../http/repositories/users-ratings.repository';
import {
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USERS_TABLE_NAME
} from '../models/users.model';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRatingsRepository extends HttpUsersRatingsRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_ACTIVITY_RATE_CONNECTIONS = 12;
  private static readonly DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO = 0.5;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT = 4;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 15;
  private static readonly DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 5;

  init(): void {
    const users = this.querySeedUsers();
    const ownerIdsToSeed = this.collectOwnerIdsNeedingActivityRateSeed(users);
    if (ownerIdsToSeed.length === 0) {
      return;
    }
    const records = ownerIdsToSeed.flatMap((ownerUserId, ownerIndex) =>
      DemoUserRatesBuilder.buildGeneratedRateItemsForUser(users, ownerUserId, {
        extraSingleGivenCount: ownerIndex < DemoUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT
          ? DemoUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT
          : DemoUsersRatingsRepository.DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT,
        userCoverageRatio: DemoUsersRatingsRepository.DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO
      })
        .map(item => DemoUserRatesBuilder.toActivityRateRecord(ownerUserId, item))
    );
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
  }

  private querySeedUsers(): UserDto[] {
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      return usersTable.ids
        .map(id => usersTable.byId[id])
        .filter((user): user is UserDto => Boolean(user?.id?.trim()));
    }
    return DemoUserSeedBuilder.buildExpandedDemoUsers(DemoUsersRatingsRepository.DEFAULT_DEMO_USERS_COUNT);
  }

  private collectOwnerIdsNeedingActivityRateSeed(
    users: readonly { id: string; gender?: 'woman' | 'man' }[]
  ): string[] {
    const counterpartIdsByOwner = new Map<string, Set<string>>();
    for (const user of users) {
      const ownerUserId = user.id.trim();
      if (!ownerUserId) {
        continue;
      }
      counterpartIdsByOwner.set(ownerUserId, new Set<string>());
    }

    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    for (const id of ratesTable.ids) {
      const record = ratesTable.byId[id];
      if (!record || record.source !== 'activity-rate') {
        continue;
      }
      const ownerUserId = record.ownerUserId?.trim() ?? '';
      const bucket = counterpartIdsByOwner.get(ownerUserId);
      if (!bucket) {
        continue;
      }
      for (const counterpartUserId of this.activityRateCounterpartUserIds(record, ownerUserId)) {
        if (counterpartUserId) {
          bucket.add(counterpartUserId);
        }
      }
    }

    return [...counterpartIdsByOwner.entries()]
      .filter(([, counterpartIds]) => counterpartIds.size < DemoUsersRatingsRepository.MIN_ACTIVITY_RATE_CONNECTIONS)
      .map(([ownerUserId]) => ownerUserId);
  }

  private activityRateCounterpartUserIds(record: UserRateRecord, ownerUserId: string): string[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return [];
    }
    if (record.mode === 'pair' && record.ownerUserId?.trim() === normalizedOwnerUserId) {
      return [record.fromUserId.trim(), record.toUserId.trim()]
        .filter(userId => userId.length > 0 && userId !== normalizedOwnerUserId);
    }
    if (record.fromUserId.trim() === normalizedOwnerUserId) {
      return [record.toUserId.trim()].filter(Boolean);
    }
    if (record.toUserId.trim() === normalizedOwnerUserId) {
      return [record.fromUserId.trim()].filter(Boolean);
    }
    return [];
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
      if (!record) {
        continue;
      }
      if (record.source === 'game-card') {
        if (record.mode === 'pair' && record.ownerUserId?.trim() === normalizedRaterId) {
          ratedUserIds.add(record.fromUserId.trim());
          ratedUserIds.add(record.toUserId.trim());
        } else if (record.fromUserId === normalizedRaterId) {
          ratedUserIds.add(record.toUserId.trim());
        }
        continue;
      }
      if (record.source !== 'activity-rate' || record.ownerUserId?.trim() !== normalizedRaterId) {
        continue;
      }
      const item = DemoUserRatesBuilder.toRateMenuItem(record);
      if (!item || (item.direction !== 'met' && item.scoreGiven <= 0)) {
        continue;
      }
      ratedUserIds.add(item.userId.trim());
      if (item.secondaryUserId?.trim()) {
        ratedUserIds.add(item.secondaryUserId.trim());
      }
    }

    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      const payload = outboxRecord?.payload;
      if (!payload || outboxRecord.status !== 'pending') {
        continue;
      }
      if (payload.source === 'game-card') {
        if (payload.mode === 'pair' && payload.ownerUserId?.trim() === normalizedRaterId) {
          ratedUserIds.add(payload.fromUserId.trim());
          ratedUserIds.add(payload.toUserId.trim());
        } else if (payload.fromUserId === normalizedRaterId) {
          ratedUserIds.add(payload.toUserId.trim());
        }
        continue;
      }
      if (payload.source !== 'activity-rate' || payload.ownerUserId?.trim() !== normalizedRaterId) {
        continue;
      }
      const item = DemoUserRatesBuilder.toRateMenuItem(payload);
      if (!item || (item.direction !== 'met' && item.scoreGiven <= 0)) {
        continue;
      }
      ratedUserIds.add(item.userId.trim());
      if (item.secondaryUserId?.trim()) {
        ratedUserIds.add(item.secondaryUserId.trim());
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
    if (record.source === 'activity-rate') {
      return this.normalizeIncomingActivityRateRecord(record);
    }
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

  private normalizeIncomingActivityRateRecord(record: UserRateRecord): UserRateRecord | null {
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (!ownerUserId) {
      return null;
    }
    const item = DemoUserRatesBuilder.toRateMenuItem(record);
    if (!item) {
      return null;
    }
    const normalized = this.buildNormalizedActivityRateRecord(
      ownerUserId,
      item,
      Number.isFinite(Number(record.scoreGiven)) && Number(record.scoreGiven) > 0
        ? Number(record.scoreGiven)
        : record.rate,
      record.displayDirection ?? item.direction
    );
    if (!normalized) {
      return null;
    }
    return {
      ...normalized,
      id: record.id,
      displayId: record.displayId?.trim() || record.id,
      createdAtIso: typeof record.createdAtIso === 'string' && record.createdAtIso.trim().length > 0
        ? record.createdAtIso
        : normalized.createdAtIso,
      updatedAtIso: typeof record.updatedAtIso === 'string' && record.updatedAtIso.trim().length > 0
        ? record.updatedAtIso
        : normalized.updatedAtIso
    };
  }
}
