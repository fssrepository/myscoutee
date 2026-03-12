import { computed, Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import type { DemoUserListItemDto, UserDto, UserRateOutboxRecord, UserRateRecord } from '../../user.interface';
import {
  type DemoUsersMemorySchema,
  USERS_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME
} from '../models/users.model';
import { DemoUsersMemoryDb } from '../models/db';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
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
      const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];
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
      const outboxId = `upsert:${recordId}`;
      const previousOutbox = outboxTable.byId[outboxId];
      const nextOutboxRecord: UserRateOutboxRecord = {
        id: outboxId,
        rateId: recordId,
        action: 'upsert',
        payload: nextRecord,
        status: 'pending',
        retryCount: previousOutbox?.retryCount ?? 0,
        queuedAtIso: previousOutbox?.queuedAtIso ?? nowIso,
        updatedAtIso: nowIso,
        lastTriedAtIso: previousOutbox?.lastTriedAtIso ?? null,
        syncedAtIso: null,
        lastError: null
      };
      return {
        ...state,
        [USER_RATES_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordId]: nextRecord
          },
          ids: previous ? table.ids : [...table.ids, recordId]
        },
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
