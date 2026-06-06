import { computed, Injectable, inject } from '@angular/core';

import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { UserSelectorListItemDto, UserDto } from '../../base/interfaces/user.interface';
import {
  USER_FILTER_PREFERENCES_TABLE_NAME,
  USERS_TABLE_NAME,
  type UsersRecordCollection
} from '../../base/models/users.model';
import { LocalMemoryDb } from '../../base/db';
import {
  LocalUserFilterPreferencesBuilder,
  LocalUserImpressionsSeedBuilder,
  LocalUserSeedBuilder,
  LocalUsersRepositoryBuilder
} from '../builders';
import { CHATS_TABLE_NAME } from '../../base/models/chats.model';
import type { AppMemorySchema } from '../../base/models/memory.model';
import { LocalChatsRepository } from './chats.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalUsersRatingsRepository } from './users-ratings.repository';
import {
  ASSETS_TABLE_NAME,
  type AssetRecord,
  type AssetsRecordCollection
} from '../../base/models/assets.model';

@Injectable({
  providedIn: 'root'
})
export class LocalUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 30;
  private static readonly INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly usersRatingsRepository = inject(LocalUsersRatingsRepository);

  readonly usersTable = computed(() => this.memoryDb.read()[USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());
  private initialized = false;

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  init(users?: readonly UserDto[]): UserDto[] {
    if (this.initialized) {
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }
    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    const sourceUsers = users ?? LocalUserSeedBuilder.buildExpandedDemoUsers(LocalUsersRepository.DEFAULT_DEMO_USERS_COUNT);
    const seededUsers = sourceUsers.map(user => LocalUsersRepositoryBuilder.cloneUser(user));
    if (usersTable.ids.length > 0) {
      const migration = this.mergeSeededUsers(usersTable, seededUsers);
      if (migration.changed) {
        this.memoryDb.write(currentState => ({
          ...currentState,
          [USERS_TABLE_NAME]: migration.table
        }));
      }
      this.initialized = true;
      return this.queryUsersFromTable(USERS_TABLE_NAME);
    }

    const seededUsersTable = LocalUsersRepositoryBuilder.buildRecordCollection(
      seededUsers
    );

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: seededUsersTable
    }));
    this.initialized = true;

    return this.queryUsersFromTable(USERS_TABLE_NAME);
  }

  stampSeededActivityCountsForUser(userId: string): boolean {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const table = this.memoryDb.read()[USERS_TABLE_NAME];
    const user = table.byId[normalizedUserId];
    if (!user) {
      return false;
    }
    const stampedUser = this.applySeededActivityCounts(LocalUsersRepositoryBuilder.cloneUser(user));
    if (this.sameActivityCounts(user, stampedUser)) {
      return false;
    }

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: {
        byId: {
          ...currentState[USERS_TABLE_NAME].byId,
          [normalizedUserId]: stampedUser
        },
        ids: [...currentState[USERS_TABLE_NAME].ids]
      }
    }));
    return true;
  }

  stampSeededImpressionsForUser(userId: string): boolean {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const table = this.memoryDb.read()[USERS_TABLE_NAME];
    const user = table.byId[normalizedUserId];
    if (!user) {
      return false;
    }
    const stampedUser = LocalUserImpressionsSeedBuilder.withSeededImpressions(
      LocalUsersRepositoryBuilder.cloneUser(user)
    );
    if (this.sameImpressions(user, stampedUser)) {
      return false;
    }

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: {
        byId: {
          ...currentState[USERS_TABLE_NAME].byId,
          [normalizedUserId]: stampedUser
        },
        ids: [...currentState[USERS_TABLE_NAME].ids]
      }
    }));
    return true;
  }

  private mergeSeededUsers(
    currentTable: UsersRecordCollection,
    seededUsers: readonly UserDto[]
  ): { table: UsersRecordCollection; changed: boolean } {
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;

    for (const seededUser of seededUsers) {
      const userId = seededUser.id.trim();
      if (!userId) {
        continue;
      }
      const existing = currentTable.byId[userId];
      if (!existing) {
        nextById[userId] = LocalUsersRepositoryBuilder.cloneUser(seededUser);
        nextIds.push(userId);
        changed = true;
        continue;
      }
      if (this.shouldStampCurrentProfileFormVersion(existing, seededUser)) {
        nextById[userId] = {
          ...existing,
          profileFormVersion: seededUser.profileFormVersion
        };
        changed = true;
      }
    }

    return {
      table: {
        byId: nextById,
        ids: [...new Set(nextIds)]
      },
      changed
    };
  }

  private shouldStampCurrentProfileFormVersion(existing: UserDto, seeded: UserDto): boolean {
    const existingVersion = Math.trunc(Number(existing.profileFormVersion) || 0);
    const seededVersion = Math.trunc(Number(seeded.profileFormVersion) || 0);
    return existingVersion <= 0
      && seededVersion > 0
      && this.hasRequiredProfileFields(existing);
  }

  private hasRequiredProfileFields(user: UserDto): boolean {
    return Boolean(
      user.name?.trim()
      && user.birthday?.trim()
      && user.city?.trim()
      && user.height?.trim()
      && user.physique?.trim()
      && (user.languages ?? []).some(language => language.trim().length > 0)
    );
  }

  queryAvailableDemoUsers(): UserSelectorListItemDto[] {
    return this.queryAllUsers()
      .sort((left, right) => this.compareSelectableDemoUsers(left, right))
      .map(user => LocalUsersRepositoryBuilder.toDemoUserListItem(user));
  }

  private compareSelectableDemoUsers(left: UserDto, right: UserDto): number {
    const affinityDelta = Math.trunc(Number(right.affinity) || 0) - Math.trunc(Number(left.affinity) || 0);
    if (affinityDelta !== 0) {
      return affinityDelta;
    }
    return left.id.localeCompare(right.id);
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
    return LocalUsersRepositoryBuilder.cloneUser(user);
  }

  upsertUser(user: UserDto): UserDto {
    this.init();
    const normalizedUser = LocalUsersRepositoryBuilder.cloneUser(user);
    normalizedUser.images = this.normalizeImages(normalizedUser.images);
    normalizedUser.affinity = LocalUserSeedBuilder.resolveUserAffinity({
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
    return LocalUsersRepositoryBuilder.cloneUser(normalizedUser);
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
    return LocalUsersRepositoryBuilder.cloneFilterPreferences(preferences);
  }

  upsertUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): void {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPreferences = LocalUsersRepositoryBuilder.cloneFilterPreferences(preferences);
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
            [normalizedUserId]: LocalUserFilterPreferencesBuilder.buildDefaultFilterPreferences(user)
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
    const users = this.queryUsersFromTable(USERS_TABLE_NAME)
      .filter(user => !LocalUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id))
      .filter(user => LocalUserSeedBuilder.isPublicGameProfile(user));
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
      .map(user => LocalUsersRepositoryBuilder.cloneUser(user));
  }

  private normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

  private applySeededActivityCounts(user: UserDto): UserDto {
    if (LocalUserSeedBuilder.isEmptyOnboardingProfile(user)) {
      return {
        ...user,
        activities: {
          game: 0,
          chat: 0,
          invitations: 0,
          events: 0,
          hosting: 0,
          cars: 0,
          accommodation: 0,
          supplies: 0,
          tickets: 0,
          contacts: 0,
          feedback: 0,
          event: {
            all: 0,
            active: 0,
            pending: 0,
            invitations: 0,
            hosting: 0,
            drafts: 0,
            trash: 0,
          },
          asset: {
            cars: 0,
            accommodation: 0,
            supplies: 0,
            tickets: 0,
          },
          eventFeedback: {
            ownEvents: 0,
            pending: 0,
            feedbacked: 0,
            removed: 0,
          },
          adminJobs: user.activities?.adminJobs ?? 0,
          adminMetrics: user.activities?.adminMetrics ?? 0
        }
      };
    }
    return LocalUsersRepositoryBuilder.applySeededActivityCounts(user, {
      chatItems: this.chatsRepository.queryChatItemsByUser(user.id),
      invitationItems: this.eventsRepository.queryInvitationItemsByUser(user.id)
        .filter(item => !item.isTrashed),
      eventsCount: this.eventsRepository.countUpcomingActiveEventItemsByUser(user.id),
      hostingItems: this.eventsRepository.queryHostingItemsByUser(user.id)
        .filter(item => !item.isTrashed)
        .filter(item => item.isAdmin === true),
      rateItems: this.usersRatingsRepository.queryActivityRateItemsByUserId(user.id),
      ...this.countOwnedAssetsByType(user.id),
      ticketsCount: this.eventsRepository.countTicketItemsByUser(user.id),
      contactsCount: user.activities?.contacts ?? 0,
      feedbackCount: this.eventsRepository.countPendingEventFeedbackByUser(
        user.id,
        LocalUsersRepository.INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS
      ),
      minDemoEventItemsPerUser: LocalUsersRepository.MIN_DEMO_EVENT_ITEMS_PER_USER
    });
  }

  private countOwnedAssetsByType(userId: string): {
    carsCount: number;
    accommodationCount: number;
    suppliesCount: number;
  } {
    const normalizedUserId = userId.trim();
    const table = this.normalizeAssetsCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const counts = {
      carsCount: 0,
      accommodationCount: 0,
      suppliesCount: 0
    };
    if (!normalizedUserId) {
      return counts;
    }
    for (const id of table.idsByOwnerUserId[normalizedUserId] ?? []) {
      const record = table.byId[id];
      if (!record || this.isSuppressedAssetStatus(record.status)) {
        continue;
      }
      if (record.type === 'Car') {
        counts.carsCount += 1;
      } else if (record.type === 'Accommodation') {
        counts.accommodationCount += 1;
      } else if (record.type === 'Supplies') {
        counts.suppliesCount += 1;
      }
    }
    return counts;
  }

  private isSuppressedAssetStatus(status: string | null | undefined): boolean {
    const normalized = this.normalizeAssetStatus(status);
    return normalized === 'UR' || normalized === 'B' || normalized === 'D' || normalized === 'I' || normalized === 'T';
  }

  private normalizeAssetStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'active':
        return 'A';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      case 'trashed':
      case 'trash':
        return 'T';
      default:
        return normalized || 'A';
    }
  }

  private normalizeAssetsCollection(value: unknown): AssetsRecordCollection {
    const source = value as Partial<AssetsRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, AssetRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => String(id))
      : [];
    const idsByOwnerUserId: Record<string, string[]> = {};
    if (source?.idsByOwnerUserId && typeof source.idsByOwnerUserId === 'object') {
      for (const [ownerUserId, ownerIds] of Object.entries(source.idsByOwnerUserId)) {
        const normalizedOwnerUserId = ownerUserId.trim();
        if (!normalizedOwnerUserId || !Array.isArray(ownerIds)) {
          continue;
        }
        idsByOwnerUserId[normalizedOwnerUserId] = ownerIds
          .map(id => String(id))
          .filter(id => Boolean(byId[id]));
      }
    }
    for (const id of ids) {
      const record = byId[id];
      const ownerUserId = `${record?.ownerUserId ?? ''}`.trim();
      if (!ownerUserId) {
        continue;
      }
      const bucket = idsByOwnerUserId[ownerUserId] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerUserId[ownerUserId] = bucket;
    }
    return {
      byId,
      ids,
      idsByOwnerUserId
    };
  }

  private sameActivityCounts(left: UserDto, right: UserDto): boolean {
    const normalizeCounter = (value: number | undefined | null): number => {
      return Number.isFinite(Math.trunc(Number(value))) ? Math.trunc(Number(value)) : 0;
    };
    const leftEvent = left.activities.event;
    const rightEvent = right.activities.event;
    const leftAsset = left.activities.asset;
    const rightAsset = right.activities.asset;
    const leftEventFeedback = left.activities.eventFeedback;
    const rightEventFeedback = right.activities.eventFeedback;

    return left.activities.game === right.activities.game
      && left.activities.chat === right.activities.chat
      && left.activities.invitations === right.activities.invitations
      && left.activities.events === right.activities.events
      && left.activities.hosting === right.activities.hosting
      && (left.activities.cars ?? 0) === (right.activities.cars ?? 0)
      && (left.activities.accommodation ?? 0) === (right.activities.accommodation ?? 0)
      && (left.activities.supplies ?? 0) === (right.activities.supplies ?? 0)
      && (left.activities.tickets ?? 0) === (right.activities.tickets ?? 0)
      && (left.activities.contacts ?? 0) === (right.activities.contacts ?? 0)
      && (left.activities.feedback ?? 0) === (right.activities.feedback ?? 0)
      && Boolean(left.activities.event) === Boolean(right.activities.event)
      && normalizeCounter(leftEvent?.all) === normalizeCounter(rightEvent?.all)
      && normalizeCounter(leftEvent?.active) === normalizeCounter(rightEvent?.active)
      && normalizeCounter(leftEvent?.pending) === normalizeCounter(rightEvent?.pending)
      && normalizeCounter(leftEvent?.invitations) === normalizeCounter(rightEvent?.invitations)
      && normalizeCounter(leftEvent?.hosting) === normalizeCounter(rightEvent?.hosting)
      && normalizeCounter(leftEvent?.drafts) === normalizeCounter(rightEvent?.drafts)
      && normalizeCounter(leftEvent?.trash) === normalizeCounter(rightEvent?.trash)
      && Boolean(left.activities.asset) === Boolean(right.activities.asset)
      && normalizeCounter(leftAsset?.cars) === normalizeCounter(rightAsset?.cars)
      && normalizeCounter(leftAsset?.accommodation) === normalizeCounter(rightAsset?.accommodation)
      && normalizeCounter(leftAsset?.supplies) === normalizeCounter(rightAsset?.supplies)
      && normalizeCounter(leftAsset?.tickets) === normalizeCounter(rightAsset?.tickets)
      && Boolean(left.activities.eventFeedback) === Boolean(right.activities.eventFeedback)
      && normalizeCounter(leftEventFeedback?.ownEvents) === normalizeCounter(rightEventFeedback?.ownEvents)
      && normalizeCounter(leftEventFeedback?.pending) === normalizeCounter(rightEventFeedback?.pending)
      && normalizeCounter(leftEventFeedback?.feedbacked) === normalizeCounter(rightEventFeedback?.feedbacked)
      && normalizeCounter(leftEventFeedback?.removed) === normalizeCounter(rightEventFeedback?.removed)
      && normalizeCounter(left.activities.adminJobs) === normalizeCounter(right.activities.adminJobs)
      && normalizeCounter(left.activities.adminMetrics) === normalizeCounter(right.activities.adminMetrics);
  }

  private sameImpressions(left: UserDto, right: UserDto): boolean {
    return JSON.stringify(left.impressions ?? null) === JSON.stringify(right.impressions ?? null);
  }
}
