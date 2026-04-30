import { computed, Injectable, inject } from '@angular/core';

import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { DemoUserListItemDto, UserDto } from '../../base/interfaces/user.interface';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME
} from '../models/users.model';
import { AppMemoryDb } from '../../base/db';
import { DemoUserFilterPreferencesBuilder, DemoUserSeedBuilder, DemoUsersRepositoryBuilder } from '../builders';
import { CHATS_TABLE_NAME } from '../models/chats.model';
import type { DemoMemorySchema } from '../models/memory.model';
import { DemoChatsRepository } from './chats.repository';
import { DemoEventsRepository } from './events.repository';
import { DemoUsersRatingsRepository } from './users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 30;
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

  readonly usersTable = computed(() => this.memoryDb.read()[USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());
  private initialized = false;

  init(users?: readonly UserDto[]): UserDto[] {
    if (this.initialized) {
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }
    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      this.initialized = true;
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }

    const sourceUsers = users ?? DemoUserSeedBuilder.buildExpandedDemoUsers(DemoUsersRepository.DEFAULT_DEMO_USERS_COUNT);
    const seededUsersTable = DemoUsersRepositoryBuilder.buildRecordCollection(
      sourceUsers.map(user => this.applySeededActivityCounts(DemoUsersRepositoryBuilder.cloneUser(user)))
    );

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: seededUsersTable
    }));
    this.initialized = true;

    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  queryAvailableDemoUsers(): DemoUserListItemDto[] {
    return this.queryAllUsers()
      .map(user => DemoUsersRepositoryBuilder.toDemoUserListItem(user));
  }

  queryAllUsers(): UserDto[] {
    this.init();
    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  queryUserById(userId: string): UserDto | null {
    this.init();
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId];
    if (!user) {
      return null;
    }
    return DemoUsersRepositoryBuilder.cloneUser(user);
  }

  upsertUser(user: UserDto): UserDto {
    this.init();
    const normalizedUser = DemoUsersRepositoryBuilder.cloneUser(user);
    normalizedUser.images = this.normalizeImages(normalizedUser.images);
    normalizedUser.affinity = DemoUserSeedBuilder.resolveUserAffinity({
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
    return DemoUsersRepositoryBuilder.cloneUser(normalizedUser);
  }

  purgeUser(userId: string): void {
    this.init();
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
      })) as DemoMemorySchema[typeof CHATS_TABLE_NAME]['byId'];
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
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const table = this.memoryDb.read()[USER_FILTER_PREFERENCES_TABLE_NAME];
    const preferences = table.byId[normalizedUserId];
    if (!preferences) {
      return null;
    }
    return DemoUsersRepositoryBuilder.cloneFilterPreferences(preferences);
  }

  upsertUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): void {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPreferences = DemoUsersRepositoryBuilder.cloneFilterPreferences(preferences);
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

  seedDefaultUserFilterPreferencesForUser(userId: string): boolean {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const state = this.memoryDb.read();
    const user = state[USERS_TABLE_NAME].byId[normalizedUserId];
    const filterTable = state[USER_FILTER_PREFERENCES_TABLE_NAME];
    if (!user || Object.prototype.hasOwnProperty.call(filterTable.byId, normalizedUserId)) {
      return false;
    }

    this.memoryDb.write(current => {
      const currentFilterTable = current[USER_FILTER_PREFERENCES_TABLE_NAME];
      if (Object.prototype.hasOwnProperty.call(currentFilterTable.byId, normalizedUserId)) {
        return current;
      }
      return {
        ...current,
        [USER_FILTER_PREFERENCES_TABLE_NAME]: {
          byId: {
            ...currentFilterTable.byId,
            [normalizedUserId]: DemoUserFilterPreferencesBuilder.buildDefaultFilterPreferences(user)
          },
          ids: currentFilterTable.ids.includes(normalizedUserId)
            ? [...currentFilterTable.ids]
            : [...currentFilterTable.ids, normalizedUserId]
        }
      };
    });
    return true;
  }

  queryGameStackUsers(raterUserId?: string): UserDto[] {
    this.init();
    const users = this.queryUsersFromTable(USERS_TABLE_NAME);
    const normalizedRaterId = raterUserId?.trim() ?? '';
    if (!normalizedRaterId) {
      return users;
    }
    const ratedUserIds = new Set(this.usersRatingsRepository.queryRatedGameCardUserIds(normalizedRaterId, 'single'));
    return users
      .filter(user => user.id !== normalizedRaterId)
      .filter(user => !ratedUserIds.has(user.id));
  }

  private queryUsersFromTable(tableName: typeof USERS_TABLE_NAME): UserDto[] {
    const users = this.memoryDb.read()[tableName];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => DemoUsersRepositoryBuilder.cloneUser(user));
  }

  private normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

  private applySeededActivityCounts(user: UserDto): UserDto {
    return DemoUsersRepositoryBuilder.applySeededActivityCounts(user, {
      chatItems: this.chatsRepository.queryChatItemsByUser(user.id),
      invitationItems: this.eventsRepository.queryInvitationItemsByUser(user.id),
      eventItems: this.eventsRepository.queryEventItemsByUser(user.id),
      hostingItems: this.eventsRepository.queryHostingItemsByUser(user.id),
      minDemoEventItemsPerUser: DemoUsersRepository.MIN_DEMO_EVENT_ITEMS_PER_USER
    });
  }
}
