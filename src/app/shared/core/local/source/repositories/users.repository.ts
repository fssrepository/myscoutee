import { USER_FILTER_PREFERENCES_TABLE_NAME, type UserFilterPreferencesRecord } from '../entity/rate.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';
import { CHATS_TABLE_NAME } from '../entity/chat.entity';
import type { AppMemorySchema } from '../../common/memory.schema';
import { computed, Injectable, inject } from '@angular/core';

import type { UserSelectorRole, UserDto } from '../../../contracts/user.interface';

import { LocalMemoryDb } from '../../../common/app.db';
import { UserProfileStateBuilder } from '../../../base/builders';


import { LocalUsersMapper } from '../mappers/user.mapper';
import { LocalRatesRepository } from './rates.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalUsersRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly ratesRepository = inject(LocalRatesRepository);

  readonly usersTable = computed(() => this.memoryDb.read()[USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryAvailableDemoUsers(selectorRole: UserSelectorRole = 'member'): UserRecord[] {
    return this.queryUserRecordsFromTable(USERS_TABLE_NAME)
      .filter(user => this.matchesSelectorRole(user, selectorRole))
      .sort((left, right) => this.compareSelectableDemoUsers(left, right));
  }

  private matchesSelectorRole(user: UserRecord, selectorRole: UserSelectorRole): boolean {
    const adminUser = user.admin === true
      || `${user.id ?? ''}`.trim().startsWith('admin-demo-')
      || `${user.hostTier ?? ''}`.trim().toLowerCase() === 'admin';
    return selectorRole === 'admin' ? adminUser : !adminUser;
  }

  private compareSelectableDemoUsers(left: UserRecord, right: UserRecord): number {
    const nameDelta = this.demoSelectorSortText(left.name, left.id)
      .localeCompare(this.demoSelectorSortText(right.name, right.id), 'en', { sensitivity: 'base' });
    if (nameDelta !== 0) {
      return nameDelta;
    }
    return `${left.id ?? ''}`.trim()
      .localeCompare(`${right.id ?? ''}`.trim(), 'en', { sensitivity: 'base' });
  }

  private demoSelectorSortText(name: string | null | undefined, userId: string | null | undefined): string {
    return `${name ?? ''}`.trim() || `${userId ?? ''}`.trim();
  }

  queryAllUsers(): UserDto[] {
    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  queryUserById(userId: string): UserRecord | null {
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId];
    if (!user) {
      return null;
    }
    return user;
  }

  upsertUser(user: UserRecord): UserRecord {
    this.memoryDb.write(state => {
      const usersTable = state[USERS_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(usersTable.byId, user.id);
      return {
        ...state,
        [USERS_TABLE_NAME]: {
          byId: {
            ...usersTable.byId,
            [user.id]: user
          },
          ids: exists ? [...usersTable.ids] : [...usersTable.ids, user.id]
        }
      };
    });
    return user;
  }

  purgeUser(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.memoryDb.write(state => {
      const usersTable = state[USERS_TABLE_NAME];
      const { [normalizedUserId]: _removedUser, ...nextUsersById } = usersTable.byId;
      const chatsTable = state[CHATS_TABLE_NAME];
      const nextChatsById = Object.fromEntries(chatsTable.ids.map(id => {
        const record = chatsTable.byId[id];
        if (!record) {
          return [id, record];
        }
        return [id, {
          ...record,
          memberIds: (record.memberIds ?? []).filter(memberId => memberId !== normalizedUserId),
          messages: (record.messages ?? []).map(message => {
            if (message.senderAvatar?.id !== normalizedUserId) {
              return message;
            }
            return {
              ...message,
              sender: 'Deleted user',
              senderAvatar: {
                ...message.senderAvatar,
                initials: this.deletedUserInitials(normalizedUserId)
              }
            };
          })
        }];
      })) as AppMemorySchema[typeof CHATS_TABLE_NAME]['byId'];
      return {
        ...state,
        [USERS_TABLE_NAME]: {
          byId: nextUsersById,
          ids: usersTable.ids.filter(id => id !== normalizedUserId)
        },
        [CHATS_TABLE_NAME]: {
          ...chatsTable,
          byId: nextChatsById
        }
      };
    });
  }

  private deletedUserInitials(userId: string): string {
    const hash = [...userId].reduce((total, char) => total + char.charCodeAt(0), 0);
    return `D${(hash % 9) + 1}`;
  }

  queryUserFilterPreferences(userId: string): UserFilterPreferencesRecord | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const table = this.memoryDb.read()[USER_FILTER_PREFERENCES_TABLE_NAME];
    return table.byId[normalizedUserId] ?? null;
  }

  upsertUserFilterPreferences(userId: string, preferences: UserFilterPreferencesRecord): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[USER_FILTER_PREFERENCES_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(table.byId, normalizedUserId);
      return {
        ...state,
        [USER_FILTER_PREFERENCES_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [normalizedUserId]: preferences
          },
          ids: exists ? [...table.ids] : [...table.ids, normalizedUserId]
        }
      };
    });
  }

  queryGameStackUsers(raterUserId?: string): UserDto[] {
    const users = this.queryUsersFromTable(USERS_TABLE_NAME)
      .filter(user => !UserProfileStateBuilder.isEmptyOnboardingProfileUserId(user.id))
      .filter(user => UserProfileStateBuilder.isPublicGameProfile(user));
    const normalizedRaterId = raterUserId?.trim() ?? '';
    if (!normalizedRaterId) {
      return users;
    }
    const ratedUserIds = new Set(this.ratesRepository.queryRatedGameCardUserIds(normalizedRaterId, 'single'));
    return users
      .filter(user => user.id !== normalizedRaterId)
      .filter(user => !ratedUserIds.has(user.id));
  }

  private queryUsersFromTable(tableName: typeof USERS_TABLE_NAME): UserDto[] {
    return this.queryUserRecordsFromTable(tableName)
      .map(user => LocalUsersMapper.toDto(user));
  }

  private queryUserRecordsFromTable(tableName: typeof USERS_TABLE_NAME): UserRecord[] {
    const users = this.memoryDb.read()[tableName];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserRecord => Boolean(user));
  }

}
