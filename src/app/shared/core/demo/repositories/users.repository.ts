import { computed, Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import {
  DEMO_CHAT_BY_USER,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER
} from '../../../demo-data';
import type {
  UserGameFilterPreferencesDto,
  UserRateOutboxRecord,
  UserRateRecord
} from '../../base/interfaces/game.interface';
import type {
  DemoUserListItemDto,
  UserDto
} from '../../base/interfaces/user.interface';
import {
  type DemoUsersMemorySchema,
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME
} from '../models/users.model';
import { AppMemoryDb } from '../../base/db';
import { DemoUsersRatingsRepository } from './users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 30;
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

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
        const reseededUsersTable = this.buildRecordCollection(users.map(user => this.applySeededActivityCounts(this.cloneUser(user))));
        this.memoryDb.write(currentState => this.reseedUsersAndPruneRelations(currentState, reseededUsersTable));
      }
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }

    const seededUsersTable = this.buildRecordCollection(users.map(user => this.applySeededActivityCounts(this.cloneUser(user))));

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
      },
      [USER_FILTER_PREFERENCES_TABLE_NAME]: {
        byId: Object.fromEntries(
          state[USER_FILTER_PREFERENCES_TABLE_NAME].ids
            .filter(userId => validUserIds.has(userId))
            .map(userId => [userId, { ...state[USER_FILTER_PREFERENCES_TABLE_NAME].byId[userId] }])
        ) as DemoUsersMemorySchema[typeof USER_FILTER_PREFERENCES_TABLE_NAME]['byId'],
        ids: state[USER_FILTER_PREFERENCES_TABLE_NAME].ids.filter(userId => validUserIds.has(userId))
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

  upsertUser(user: UserDto): UserDto {
    const normalizedUser = this.cloneUser(user);
    normalizedUser.images = this.normalizeImages(normalizedUser.images);
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
    return this.cloneUser(normalizedUser);
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
    return this.cloneFilterPreferences(preferences);
  }

  upsertUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPreferences = this.cloneFilterPreferences(preferences);
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
    const users = this.queryUsersFromTable(USERS_TABLE_NAME);
    const normalizedRaterId = raterUserId?.trim() ?? '';
    if (!normalizedRaterId) {
      return users;
    }
    const ratedUserIds = new Set(this.usersRatingsRepository.queryRatedGameCardUserIds(normalizedRaterId));
    return users
      .filter(user => user.id !== normalizedRaterId)
      .filter(user => !ratedUserIds.has(user.id));
  }

  private queryUsersFromTable(tableName: typeof USERS_TABLE_NAME): UserDto[] {
    const users = this.memoryDb.read()[tableName];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.cloneUser(user));
  }

  private normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

  private cloneUser(user: UserDto): UserDto {
    const { impressions: _ignoredImpressions, ...rest } = user;
    return {
      ...rest,
      languages: [...(rest.languages ?? [])],
      images: [...(rest.images ?? [])],
      activities: {
        ...rest.activities
      }
    };
  }

  private applySeededActivityCounts(user: UserDto): UserDto {
    const chatItems = DEMO_CHAT_BY_USER[user.id];
    const invitationItems = DEMO_INVITATIONS_BY_USER[user.id];
    const eventItems = DEMO_EVENTS_BY_USER[user.id];
    const hostingItems = DEMO_HOSTING_BY_USER[user.id];

    return {
      ...user,
      activities: {
        ...user.activities,
        chat: chatItems
          ? AppDemoGenerators.resolveSectionBadge(chatItems.map(item => item.unread), chatItems.length)
          : user.activities.chat,
        invitations: invitationItems
          ? AppDemoGenerators.resolveSectionBadge(invitationItems.map(item => item.unread), invitationItems.length)
          : user.activities.invitations,
        events: eventItems
          ? (
            AppDemoGenerators.resolveSectionBadge(eventItems.map(item => item.activity), eventItems.length) +
            AppDemoGenerators.syntheticEventActivityTotal(
              eventItems.length,
              DemoUsersRepository.MIN_DEMO_EVENT_ITEMS_PER_USER
            )
          )
          : user.activities.events,
        hosting: hostingItems
          ? AppDemoGenerators.resolveSectionBadge(hostingItems.map(item => item.activity), hostingItems.length)
          : user.activities.hosting
      }
    };
  }

  private cloneFilterPreferences(preferences: UserGameFilterPreferencesDto): UserGameFilterPreferencesDto {
    return {
      ...preferences,
      interests: [...(preferences.interests ?? [])],
      values: [...(preferences.values ?? [])],
      physiques: [...(preferences.physiques ?? [])],
      languages: [...(preferences.languages ?? [])],
      genders: [...(preferences.genders ?? [])],
      horoscopes: [...(preferences.horoscopes ?? [])],
      traitLabels: [...(preferences.traitLabels ?? [])],
      smoking: [...(preferences.smoking ?? [])],
      drinking: [...(preferences.drinking ?? [])],
      workout: [...(preferences.workout ?? [])],
      pets: [...(preferences.pets ?? [])],
      familyPlans: [...(preferences.familyPlans ?? [])],
      children: [...(preferences.children ?? [])],
      loveStyles: [...(preferences.loveStyles ?? [])],
      communicationStyles: [...(preferences.communicationStyles ?? [])],
      sexualOrientations: [...(preferences.sexualOrientations ?? [])],
      religions: [...(preferences.religions ?? [])]
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
