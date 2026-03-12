import { computed, Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import type { DemoUserListItemDto, UserDto } from '../../user.interface';
import { USERS_TABLE_NAME, USER_RATES_TABLE_NAME, type UserRateRecord } from '../models/users.model';
import { DemoUsersMemoryDb } from '../models/db';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 51;
  private readonly memoryDb = inject(DemoUsersMemoryDb);

  readonly usersTable = computed(() => this.memoryDb.read()[USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());

  constructor() {
    this.init();
  }

  init(users: readonly UserDto[] = AppDemoGenerators.buildExpandedDemoUsers(DemoUsersRepository.DEFAULT_DEMO_USERS_COUNT)): UserDto[] {
    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }

    const seededUsersTable = this.buildRecordCollection(users.map(user => this.cloneUser(user)));

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: seededUsersTable
    }));

    return this.queryUsersFromTable(USERS_TABLE_NAME);
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

  upsertGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    const normalizedRaterId = raterUserId.trim();
    const normalizedRatedUserId = ratedUserId.trim();
    if (!normalizedRaterId || !normalizedRatedUserId || normalizedRaterId === normalizedRatedUserId) {
      return;
    }
    const normalizedRating = Math.max(1, Math.min(10, Math.trunc(Number(rating) || 0)));
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[USER_RATES_TABLE_NAME];
      const nowIso = new Date().toISOString();
      const recordId = `game-card:${normalizedRaterId}:${normalizedRatedUserId}`;
      const previous = table.byId[recordId];
      const nextRecord: UserRateRecord = {
        id: recordId,
        fromUserId: normalizedRaterId,
        toUserId: normalizedRatedUserId,
        rate: normalizedRating,
        mode: mode === 'pair' ? 'pair' : 'single',
        source: 'game-card',
        createdAtIso: previous?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso
      };
      return {
        ...state,
        [USER_RATES_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordId]: nextRecord
          },
          ids: previous ? table.ids : [...table.ids, recordId]
        }
      };
    });
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
