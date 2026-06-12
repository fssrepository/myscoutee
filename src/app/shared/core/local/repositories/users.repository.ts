import { computed, Injectable, inject } from '@angular/core';

import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { UserSelectorListItemDto, UserDto } from '../../base/interfaces/user.interface';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
} from '../../base/models/users.model';
import { LocalMemoryDb } from '../../base/db';
import { UserProfileStateBuilder, UserRecordsBuilder } from '../../base/builders';
import { CHATS_TABLE_NAME } from '../../base/models/chats.model';
import type { AppMemorySchema } from '../../base/models/memory.model';
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

  queryAvailableDemoUsers(): UserSelectorListItemDto[] {
    return this.queryAllUsers()
      .sort((left, right) => this.compareSelectableDemoUsers(left, right))
      .map(user => UserRecordsBuilder.toDemoUserListItem(user));
  }

  private compareSelectableDemoUsers(left: UserDto, right: UserDto): number {
    const affinityDelta = Math.trunc(Number(right.affinity) || 0) - Math.trunc(Number(left.affinity) || 0);
    if (affinityDelta !== 0) {
      return affinityDelta;
    }
    return left.id.localeCompare(right.id);
  }

  queryAllUsers(): UserDto[] {
    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  queryUserById(userId: string): UserDto | null {
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId];
    if (!user) {
      return null;
    }
    return UserRecordsBuilder.cloneUser(user);
  }

  upsertUser(user: UserDto): UserDto {
    const normalizedUser = UserRecordsBuilder.cloneUser(user);
    normalizedUser.images = this.normalizeImages(normalizedUser.images);
    normalizedUser.affinity = UserProfileStateBuilder.resolveUserAffinity({
      id: normalizedUser.id,
      name: normalizedUser.name,
      age: normalizedUser.age,
      city: normalizedUser.city,
      height: normalizedUser.height,
      physique: normalizedUser.physique,
      languages: normalizedUser.languages,
      horoscope: normalizedUser.horoscope,
      gender: normalizedUser.gender,
      hostTier: normalizedUser.hostTier,
      traitLabel: normalizedUser.traitLabel,
      completion: normalizedUser.completion
    });
    this.memoryDb.write(state => {
      const usersTable = state[USERS_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(usersTable.byId, normalizedUser.id);
      return {
        ...state,
        [USERS_TABLE_NAME]: {
          byId: {
            ...usersTable.byId,
            [normalizedUser.id]: normalizedUser
          },
          ids: exists ? [...usersTable.ids] : [...usersTable.ids, normalizedUser.id]
        }
      };
    });
    return UserRecordsBuilder.cloneUser(normalizedUser);
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

  queryUserFilterPreferences(userId: string): UserGameFilterPreferencesDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const table = this.memoryDb.read()[USER_FILTER_PREFERENCES_TABLE_NAME];
    const preferences = table.byId[normalizedUserId];
    if (!preferences) {
      return null;
    }
    return UserRecordsBuilder.cloneFilterPreferences(preferences);
  }

  upsertUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPreferences = UserRecordsBuilder.cloneFilterPreferences(preferences);
    this.memoryDb.write(state => {
      const table = state[USER_FILTER_PREFERENCES_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(table.byId, normalizedUserId);
      return {
        ...state,
        [USER_FILTER_PREFERENCES_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [normalizedUserId]: normalizedPreferences
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
    const users = this.memoryDb.read()[tableName];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => UserRecordsBuilder.cloneUser(user));
  }

  private normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

}
