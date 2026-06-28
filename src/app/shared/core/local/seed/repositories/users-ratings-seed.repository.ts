import { USER_RATES_TABLE_NAME } from '../../source/entity/rate.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import type { UserRecord } from '../../source/entity/user.entity';
import type { UserRatesRecordCollection } from '../../source/entity/rate.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import type { UserRateRecord } from '../../source/entity/rate.entity';

import { UserProfileState } from '../../../common/user-profile-state';
import { SeedUserBuilder, SeedUserRatesBuilder } from '../builders';
import { LocalUserRatesMapper } from '../../source/mappers';

@Injectable({
  providedIn: 'root'
})
export class SeedUsersRatingsRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_ACTIVITY_RATE_CONNECTIONS = 8;
  private static readonly DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO = 0.25;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT = 3;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 4;
  private static readonly DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 1;
  private static readonly MAX_DEMO_ACTIVITY_RATE_BOOTSTRAP_RECORDS = 1000;

  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(seedUsers?: readonly UserRecord[]): void {
    if (this.initialized) {
      return;
    }
    const users = seedUsers?.length ? [...seedUsers] : this.querySeedUsers();
    const visibleSeedUsers = users.filter(user => UserProfileState.isActivityRateVisibleProfile(user));
    const ownerIdsToSeed = this.collectOwnerIdsNeedingActivityRateSeed(visibleSeedUsers);
    const currentRatesCount = this.memoryDb.read()[USER_RATES_TABLE_NAME].ids.length;
    const remainingBootstrapSlots = Math.max(
      0,
      SeedUsersRatingsRepository.MAX_DEMO_ACTIVITY_RATE_BOOTSTRAP_RECORDS - currentRatesCount
    );
    if (ownerIdsToSeed.length === 0 || remainingBootstrapSlots <= 0) {
      this.initialized = true;
      return;
    }

    const records: UserRateRecord[] = [];
    for (let ownerIndex = 0; ownerIndex < ownerIdsToSeed.length; ownerIndex += 1) {
      const ownerUserId = ownerIdsToSeed[ownerIndex];
      if (!ownerUserId) {
        continue;
      }
      const ownerGraphCohortUsers = this.graphSeedCohortUsers(visibleSeedUsers, ownerUserId);
      const ownerRecords = SeedUserRatesBuilder.buildGeneratedRateItemsForUser(ownerGraphCohortUsers, ownerUserId, {
        extraSingleGivenCount: ownerIndex < SeedUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT
          ? SeedUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT
          : SeedUsersRatingsRepository.DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT,
        userCoverageRatio: SeedUsersRatingsRepository.DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO
      })
        .map(item => LocalUserRatesMapper.toRecord(ownerUserId, item));
      if (records.length + ownerRecords.length > remainingBootstrapSlots) {
        break;
      }
      records.push(...ownerRecords);
    }
    if (records.length === 0) {
      this.initialized = true;
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
        [USER_RATES_TABLE_NAME]: this.rebuildUserRatesTableIndex({
          ...current,
          byId,
          ids
        })
      };
    });
    this.initialized = true;
  }

  private querySeedUsers(): UserRecord[] {
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      return usersTable.ids
        .map(id => usersTable.byId[id])
        .filter((user): user is UserRecord => Boolean(user?.id?.trim()));
    }
    return SeedUserBuilder.buildExpandedDemoUsers(SeedUsersRatingsRepository.DEFAULT_DEMO_USERS_COUNT);
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
      if (!record) {
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
      .filter(([, counterpartIds]) => counterpartIds.size < SeedUsersRatingsRepository.MIN_ACTIVITY_RATE_CONNECTIONS)
      .map(([ownerUserId]) => ownerUserId);
  }

  private graphSeedCohortUsers<TUser extends { id: string }>(users: readonly TUser[], ownerUserId: string): readonly TUser[] {
    if (users.length < SeedUsersRatingsRepository.MIN_ACTIVITY_RATE_CONNECTIONS * 2) {
      return users;
    }
    const midpoint = Math.ceil(users.length * 2 / 3);
    const ownerIndex = users.findIndex(user => user.id.trim() === ownerUserId.trim());
    if (ownerIndex < 0) {
      return users;
    }
    const cohortStart = ownerIndex < midpoint ? 0 : midpoint;
    const cohortEnd = ownerIndex < midpoint ? midpoint : users.length;
    return users.slice(cohortStart, cohortEnd);
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

  private rebuildUserRatesTableIndex(table: UserRatesRecordCollection): UserRatesRecordCollection {
    const idsByRelevantUserId: Record<string, string[]> = {};
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record) {
        continue;
      }
      for (const userId of this.relevantUserRateUserIds(record)) {
        const bucket = idsByRelevantUserId[userId] ?? [];
        bucket.push(id);
        idsByRelevantUserId[userId] = bucket;
      }
    }
    for (const ids of Object.values(idsByRelevantUserId)) {
      ids.sort((leftId, rightId) => {
        const left = table.byId[leftId];
        const right = table.byId[rightId];
        return this.dynamicRecordDateValue(right) - this.dynamicRecordDateValue(left);
      });
    }
    return {
      ...table,
      idsByRelevantUserId
    };
  }

  private relevantUserRateUserIds(record: UserRateRecord): string[] {
    return [...new Set([record.ownerUserId, record.fromUserId, record.toUserId]
      .map(value => `${value ?? ''}`.trim())
      .filter(Boolean))];
  }

  private dynamicRecordDateValue(record: UserRateRecord | null | undefined): number {
    return AppUtils.toSortableDate(record?.happenedAtIso ?? record?.updatedAtIso ?? record?.createdAtIso ?? '');
  }
}
