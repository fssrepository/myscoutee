import { computed, Injectable } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { environment } from '../../../../../environments/environment';
import type { DemoUserListItemDto, UserDto, UserRateOutboxRecord, UserRateRecord } from '../../user.interface';
import {
  type DemoUsersMemorySchema,
  USERS_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME
} from '../models/users.model';
import { UsersRatingsRepository } from '../../base/repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository extends UsersRatingsRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;

  readonly usersTable = computed(() => this.memoryDb.read()[USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());

  constructor() {
    super();
    if (environment.loginEnabled) {
      this.prepareHttpModeStorage();
      return;
    }
    this.init();
  }

  init(users: readonly UserDto[] = AppDemoGenerators.buildExpandedDemoUsers(DemoUsersRepository.DEFAULT_DEMO_USERS_COUNT)): UserDto[] {
    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      if (usersTable.ids.length !== DemoUsersRepository.DEFAULT_DEMO_USERS_COUNT) {
        const reseededUsersTable = this.buildRecordCollection(users.map(user => this.cloneUser(user)));
        this.memoryDb.write(currentState => this.reseedUsersAndPruneRelations(currentState, reseededUsersTable));
      }
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }

    const seededUsersTable = this.buildRecordCollection(users.map(user => this.cloneUser(user)));

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: seededUsersTable
    }));

    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  private reseedUsersAndPruneRelations(
    state: DemoUsersMemorySchema,
    usersTable: { byId: Record<string, UserDto>; ids: string[] }
  ): DemoUsersMemorySchema {
    const validUserIds = new Set(usersTable.ids);
    const currentRates = state[USER_RATES_TABLE_NAME];
    const nextRatesById: Record<string, UserRateRecord> = {};
    const nextRateIds: string[] = [];
    for (const rateId of currentRates.ids) {
      const record = currentRates.byId[rateId];
      if (!record) {
        continue;
      }
      if (!validUserIds.has(record.fromUserId) || !validUserIds.has(record.toUserId)) {
        continue;
      }
      nextRatesById[rateId] = { ...record };
      nextRateIds.push(rateId);
    }
    const validRateIds = new Set(nextRateIds);
    const currentOutbox = state[USER_RATES_OUTBOX_TABLE_NAME];
    const nextOutboxById: Record<string, UserRateOutboxRecord> = {};
    const nextOutboxIds: string[] = [];
    for (const outboxId of currentOutbox.ids) {
      const record = currentOutbox.byId[outboxId];
      if (!record) {
        continue;
      }
      if (!validRateIds.has(record.rateId)) {
        continue;
      }
      if (!validUserIds.has(record.payload.fromUserId) || !validUserIds.has(record.payload.toUserId)) {
        continue;
      }
      nextOutboxById[outboxId] = {
        ...record,
        payload: { ...record.payload }
      };
      nextOutboxIds.push(outboxId);
    }
    return {
      ...state,
      [USERS_TABLE_NAME]: usersTable,
      [USER_RATES_TABLE_NAME]: {
        byId: nextRatesById,
        ids: nextRateIds
      },
      [USER_RATES_OUTBOX_TABLE_NAME]: {
        byId: nextOutboxById,
        ids: nextOutboxIds
      }
    };
  }

  private buildRecordCollection(users: readonly UserDto[]): { byId: Record<string, UserDto>; ids: string[] } {
    const byId: Record<string, UserDto> = {};
    const ids: string[] = [];
    for (const user of users) {
      byId[user.id] = this.cloneUser(user);
      ids.push(user.id);
    }
    return { byId, ids };
  }

  queryAvailableDemoUsers(): DemoUserListItemDto[] {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.toDemoUserListItem(user));
  }

  queryUserById(userId: string): UserDto | null {
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId];
    if (!user) {
      return null;
    }
    return this.cloneUser(user);
  }

  queryGameStackUsers(raterUserId?: string): UserDto[] {
    const users = this.queryUsersFromTable(USERS_TABLE_NAME);
    const normalizedRaterId = raterUserId?.trim() ?? '';
    if (!normalizedRaterId) {
      return users;
    }
    const ratedUserIds = new Set(this.queryRatedGameCardUserIds(normalizedRaterId));
    return users
      .filter(user => user.id !== normalizedRaterId)
      .filter(user => !ratedUserIds.has(user.id));
  }

  queryRatedGameCardUserIds(raterUserId: string): string[] {
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    return ratesTable.ids
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record => record.fromUserId === normalizedRaterId)
      .map(record => record.toUserId.trim())
      .filter(id => id.length > 0);
  }

  queryUserRatesByUserId(userId: string): UserRateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    return ratesTable.ids
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record => record.fromUserId === normalizedUserId || record.toUserId === normalizedUserId)
      .map(record => ({ ...record }));
  }

  upsertGameCardRatings(records: readonly UserRateRecord[]): string[] {
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
          byId,
          ids
        }
      };
    });
    return normalizedRecords.map(record => record.id);
  }

  private normalizeIncomingRateRecord(record: UserRateRecord): UserRateRecord | null {
    const normalized = this.buildNormalizedRateRecord(
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
      createdAtIso,
      updatedAtIso
    };
  }

  private prepareHttpModeStorage(): void {
    this.memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: {},
        ids: []
      },
      [USER_RATES_TABLE_NAME]: {
        byId: {},
        ids: []
      }
    }));
  }

  private queryUsersFromTable(tableName: typeof USERS_TABLE_NAME): UserDto[] {
    const users = this.memoryDb.read()[tableName];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.cloneUser(user));
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...user.languages],
      images: [...(user.images ?? [])],
      activities: {
        ...user.activities
      }
    };
  }

  private toDemoUserListItem(user: UserDto): DemoUserListItemDto {
    return {
      id: user.id,
      name: user.name,
      city: user.city,
      initials: user.initials,
      gender: user.gender
    };
  }
}
