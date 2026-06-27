import { CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import { EVENT_FEEDBACK_TABLE_NAME, EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import { USER_FILTER_PREFERENCES_TABLE_NAME, USER_RATES_OUTBOX_TABLE_NAME, USER_RATES_TABLE_NAME } from '../../source/entity/rate.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import type { UserRecord, UsersRecordCollection } from '../../source/entity/user.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { ASSETS_TABLE_NAME, type AssetRecord, type AssetsRecordCollection } from '../../source/entity/asset.entity';


import {
  defaultUserGameFilterPreferences,
  type ActivityEventRecord
} from '../../../contracts/activity.interface';

import { UserProfileStateBuilder } from '../../../base/builders';
import { LocalUserFilterPreferencesMapper } from '../../source/mappers';
import { SeedUserBuilder, SeedUserImpressionsBuilder } from '../builders';

interface SeededActivityCountSources {
  chatItems?: ReadonlyArray<{ unread: number }>;
  invitationItems?: ReadonlyArray<{ unread: number }>;
  eventsCount?: number;
  hostingItems?: ReadonlyArray<{ activity: number }>;
  rateItems?: readonly unknown[];
  carsCount?: number;
  accommodationCount?: number;
  suppliesCount?: number;
  ticketsCount?: number;
  contactsCount?: number;
  feedbackCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SeedUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;

  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  queryUserById(userId: string): UserRecord | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId];
    return user ?? null;
  }

  upsertUser(user: UserRecord): UserRecord {
    const userId = `${user.id ?? ''}`.trim();
    if (!userId) {
      return user;
    }
    const saved = user.id === userId ? user : { ...user, id: userId };
    this.memoryDb.write(currentState => {
      const usersTable = currentState[USERS_TABLE_NAME];
      return {
        ...currentState,
        [USERS_TABLE_NAME]: {
          byId: {
            ...usersTable.byId,
            [userId]: saved
          },
          ids: usersTable.ids.includes(userId)
            ? [...usersTable.ids]
            : [...usersTable.ids, userId]
        }
      };
    });
    return saved;
  }

  seedDefaults(): UserRecord[] {
    if (this.initialized) {
      return this.queryUsersFromTable();
    }
    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    const seededUsers = SeedUserBuilder.buildExpandedDemoUsers(
      SeedUsersRepository.DEFAULT_DEMO_USERS_COUNT
    );
    if (usersTable.ids.length > 0) {
      const migration = this.mergeSeededUsers(usersTable, seededUsers);
      if (migration.changed) {
        this.memoryDb.write(currentState => ({
          ...currentState,
          [USERS_TABLE_NAME]: migration.table
        }));
      }
      this.initialized = true;
      return this.queryUsersFromTable();
    }

    this.memoryDb.write(currentState => ({
      ...currentState,
      [USERS_TABLE_NAME]: this.buildUsersTable(seededUsers)
    }));
    this.initialized = true;

    return this.queryUsersFromTable();
  }

  seedDefaultUserFilterPreferencesForUser(userId: string): boolean {
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
            [normalizedUserId]: LocalUserFilterPreferencesMapper.toRecord(defaultUserGameFilterPreferences())
          },
          ids: currentFilterTable.ids.includes(normalizedUserId)
            ? [...currentFilterTable.ids]
            : [...currentFilterTable.ids, normalizedUserId]
        }
      };
    });
    return true;
  }

  stampSeededActivityCountsForUser(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const table = this.memoryDb.read()[USERS_TABLE_NAME];
    const user = table.byId[normalizedUserId];
    if (!user) {
      return false;
    }
    const stampedUser = this.applySeededActivityCounts(user);
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
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const table = this.memoryDb.read()[USERS_TABLE_NAME];
    const user = table.byId[normalizedUserId];
    if (!user) {
      return false;
    }
    const stampedUser = SeedUserImpressionsBuilder.withSeededImpressions(user) as UserRecord;
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
    seededUsers: readonly UserRecord[]
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
        nextById[userId] = seededUser;
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

  private buildUsersTable(users: readonly UserRecord[]): UsersRecordCollection {
    const byId: UsersRecordCollection['byId'] = {};
    const ids: string[] = [];
    for (const user of users) {
      const userId = user.id.trim();
      if (!userId) {
        continue;
      }
      byId[userId] = user;
      ids.push(userId);
    }
    return {
      byId,
      ids
    };
  }

  private shouldStampCurrentProfileFormVersion(existing: UserRecord, seeded: UserRecord): boolean {
    const existingVersion = Math.trunc(Number(existing.profileFormVersion) || 0);
    const seededVersion = Math.trunc(Number(seeded.profileFormVersion) || 0);
    return existingVersion <= 0
      && seededVersion > 0
      && this.hasRequiredProfileFields(existing);
  }

  private hasRequiredProfileFields(user: UserRecord): boolean {
    return Boolean(
      user.name?.trim()
      && user.birthday?.trim()
      && user.city?.trim()
      && user.height?.trim()
      && user.physique?.trim()
      && (user.languages ?? []).some(language => language.trim().length > 0)
    );
  }

  private queryUsersFromTable(): UserRecord[] {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserRecord => Boolean(user));
  }

  private applySeededActivityCounts(user: UserRecord): UserRecord {
    if (UserProfileStateBuilder.isEmptyOnboardingProfile(user)) {
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
    return this.applyDerivedActivityCounts(user, {
      chatItems: this.queryChatItemsByUser(user.id),
      invitationItems: this.queryInvitationItemsByUser(user.id),
      eventsCount: this.countUpcomingActiveEventItemsByUser(user.id),
      hostingItems: this.queryHostingItemsByUser(user.id),
      rateItems: this.queryActivityRateItemsByUserId(user.id),
      ...this.countOwnedAssetsByType(user.id),
      ticketsCount: this.countTicketItemsByUser(user.id),
      contactsCount: user.activities?.contacts ?? 0,
      feedbackCount: this.countPendingEventFeedbackByUser(
        user.id,
        SeedUsersRepository.INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS
      )
    });
  }

  private applyDerivedActivityCounts(
    user: UserRecord,
    sources: SeededActivityCountSources
  ): UserRecord {
    const normalizeCounter = (value: unknown): number => {
      const count = Number(value);
      return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    };

    const activities = user.activities;
    const chat = sources.chatItems
      ? this.resolveSectionBadge(sources.chatItems.map(item => item.unread), sources.chatItems.length)
      : activities.chat;
    const invitations = sources.invitationItems ? sources.invitationItems.length : activities.invitations;
    const events = Number.isFinite(sources.eventsCount)
      ? normalizeCounter(sources.eventsCount)
      : activities.events;
    const hosting = sources.hostingItems ? sources.hostingItems.length : activities.hosting;
    const game = sources.rateItems ? sources.rateItems.length : activities.game;
    const cars = Number.isFinite(sources.carsCount) ? normalizeCounter(sources.carsCount) : activities.cars;
    const accommodation = Number.isFinite(sources.accommodationCount) ? normalizeCounter(sources.accommodationCount) : activities.accommodation;
    const supplies = Number.isFinite(sources.suppliesCount) ? normalizeCounter(sources.suppliesCount) : activities.supplies;
    const tickets = Number.isFinite(sources.ticketsCount) ? normalizeCounter(sources.ticketsCount) : activities.tickets;
    const contacts = Number.isFinite(sources.contactsCount) ? normalizeCounter(sources.contactsCount) : activities.contacts;
    const feedback = Number.isFinite(sources.feedbackCount) ? normalizeCounter(sources.feedbackCount) : activities.feedback;
    const event = activities.event;
    const asset = activities.asset;
    const eventFeedback = activities.eventFeedback;
    const hasEventSources = Boolean(sources.invitationItems)
      || Number.isFinite(sources.eventsCount)
      || Boolean(sources.hostingItems);
    const eventPending = normalizeCounter(event?.pending);
    const eventDrafts = normalizeCounter(event?.drafts);
    const eventTrash = normalizeCounter(event?.trash);
    const eventActive = hasEventSources ? events : normalizeCounter(event?.active ?? events);
    const eventInvitations = hasEventSources ? invitations : normalizeCounter(event?.invitations ?? invitations);
    const eventHosting = hasEventSources ? hosting : normalizeCounter(event?.hosting ?? hosting);
    const eventAll = hasEventSources
      ? eventActive + eventPending + eventInvitations + eventHosting + eventDrafts
      : normalizeCounter(event?.all ?? events + invitations + hosting);
    const assetCars = Number.isFinite(sources.carsCount) ? cars : normalizeCounter(asset?.cars ?? cars);
    const assetAccommodation = Number.isFinite(sources.accommodationCount)
      ? accommodation
      : normalizeCounter(asset?.accommodation ?? accommodation);
    const assetSupplies = Number.isFinite(sources.suppliesCount) ? supplies : normalizeCounter(asset?.supplies ?? supplies);
    const assetTickets = Number.isFinite(sources.ticketsCount) ? tickets : normalizeCounter(asset?.tickets ?? tickets);
    const eventFeedbackPending = Number.isFinite(sources.feedbackCount)
      ? feedback
      : normalizeCounter(eventFeedback?.pending ?? feedback);

    return {
      ...user,
      activities: {
        ...activities,
        chat,
        invitations,
        events,
        hosting,
        game,
        cars,
        accommodation,
        supplies,
        tickets,
        contacts,
        feedback,
        event: {
          all: eventAll,
          active: eventActive,
          pending: eventPending,
          invitations: eventInvitations,
          hosting: eventHosting,
          drafts: eventDrafts,
          trash: eventTrash,
        },
        asset: {
          cars: assetCars,
          accommodation: assetAccommodation,
          supplies: assetSupplies,
          tickets: assetTickets,
        },
        eventFeedback: {
          ownEvents: normalizeCounter(eventFeedback?.ownEvents),
          pending: eventFeedbackPending,
          feedbacked: normalizeCounter(eventFeedback?.feedbacked),
          removed: normalizeCounter(eventFeedback?.removed),
        }
      }
    };
  }

  private resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  private queryChatItemsByUser(userId: string): ReadonlyArray<{ unread: number }> {
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter(record => record?.ownerUserId === userId)
      .map(record => ({ unread: Math.max(0, Math.trunc(Number(record.unread) || 0)) }));
  }

  private queryInvitationItemsByUser(userId: string): ReadonlyArray<{ unread: number }> {
    return this.queryUserEventRecords(userId)
      .filter(record => this.eventInvitedMemberUserIds(record).includes(userId.trim()))
      .filter(record => record.status !== 'T')
      .map(record => ({ unread: Math.max(0, Math.trunc(Number(record.unread) || 0)) }));
  }

  private queryHostingItemsByUser(userId: string): ReadonlyArray<{ activity: number }> {
    return this.queryUserEventRecords(userId)
      .filter(record => this.isEventAdminRecord(record, userId))
      .filter(record => record.status !== 'T')
      .map(record => ({ activity: Math.max(0, Math.trunc(Number(record.activity) || 0)) }));
  }

  private countUpcomingActiveEventItemsByUser(userId: string): number {
    return this.queryUserEventRecords(userId)
      .filter(record => !this.isEventAdminRecord(record, userId))
      .filter(record => !this.eventInvitedMemberUserIds(record).includes(userId.trim()))
      .filter(record => record.status !== 'T')
      .filter(record => this.isPublishedEventStatus(record.status))
      .length;
  }

  private isPublishedEventStatus(status: ActivityEventRecord['status'] | null | undefined): boolean {
    return `${status ?? 'A'}`.trim() === 'A';
  }

  private countTicketItemsByUser(userId: string): number {
    return this.queryUserEventRecords(userId)
      .filter(record => !this.eventInvitedMemberUserIds(record).includes(userId.trim()))
      .filter(record => record.status !== 'T')
      .filter(record => record.ticketing === true)
      .length;
  }

  private countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    const feedbackTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nowMs = Date.now();
    return this.queryUserEventRecords(normalizedUserId).filter(item => {
      if (
        this.isEventAdminRecord(item, normalizedUserId)
        || this.eventInvitedMemberUserIds(item).includes(normalizedUserId)
        || item.status === 'T'
      ) {
        return false;
      }
      const startMs = new Date(item.startAtIso ?? '').getTime();
      if (!Number.isFinite(startMs) || nowMs < startMs + feedbackUnlockDelayMs) {
        return false;
      }
      const feedbackRecord = feedbackTable.byId[`${normalizedUserId}::${item.id}`];
      if (!feedbackRecord) {
        return true;
      }
      if (feedbackRecord.removed) {
        return false;
      }
      return !(feedbackRecord.submittedAtIso?.trim());
    }).length;
  }

  private queryActivityRateItemsByUserId(userId: string): readonly unknown[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || UserProfileStateBuilder.isEmptyOnboardingProfileUserId(normalizedUserId)) {
      return [];
    }
    const state = this.memoryDb.read();
    const ratesTable = state[USER_RATES_TABLE_NAME];
    const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];
    const ids = new Set(ratesTable.idsByRelevantUserId[normalizedUserId] ?? []);
    for (const id of outboxTable.ids) {
      const record = outboxTable.byId[id];
      if (record?.payload?.fromUserId === normalizedUserId || record?.payload?.toUserId === normalizedUserId) {
        ids.add(record.payload.id);
      }
    }
    return [...ids];
  }

  private queryUserEventRecords(userId: string): ActivityEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const records = table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivityEventRecord => Boolean(record))
      .filter(record => !this.isGeneratedSlotRecord(record))
      .filter(record =>
        this.isEventAdminRecord(record, normalizedUserId)
        || this.eventAcceptedMemberUserIds(record).includes(normalizedUserId)
        || this.eventPendingRequestMemberUserIds(record).includes(normalizedUserId)
        || this.eventInvitedMemberUserIds(record).includes(normalizedUserId)
      );
    return this.aggregateUserEventRecords(records, normalizedUserId);
  }

  private aggregateUserEventRecords(
    records: readonly ActivityEventRecord[],
    userId: string
  ): ActivityEventRecord[] {
    const byEventId = new Map<string, ActivityEventRecord>();
    for (const record of records) {
      const eventId = `${record.id ?? ''}`.trim();
      if (!eventId) {
        continue;
      }
      const existing = byEventId.get(eventId);
      if (!existing || this.eventRecordPreference(record, userId) > this.eventRecordPreference(existing, userId)) {
        byEventId.set(eventId, record);
      }
    }
    return [...byEventId.values()];
  }

  private eventRecordPreference(record: ActivityEventRecord, userId: string): number {
    return (this.isEventAdminRecord(record, userId) ? 40 : 0)
      + (this.eventInvitedMemberUserIds(record).includes(userId) ? 30 : 0)
      + (this.eventPendingRequestMemberUserIds(record).includes(userId) ? 20 : 0)
      + (this.eventAcceptedMemberUserIds(record).includes(userId) ? 10 : 0)
      + (this.isPublishedEventStatus(record.status) ? 1 : 0);
  }

  private isGeneratedSlotRecord(record: ActivityEventRecord | null | undefined): boolean {
    return Boolean(record?.generated) || record?.eventType === 'slot' || Boolean(record?.parentEventId);
  }

  private isEventAdminRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return false;
    }
    return this.normalizeUserIds([record.creatorUserId, ...(record.adminIds ?? [])]).includes(normalizedUserId);
  }

  private eventAcceptedMemberUserIds(record: ActivityEventRecord): string[] {
    return this.normalizeUserIds(record.acceptedMemberUserIds);
  }

  private eventInvitedMemberUserIds(record: ActivityEventRecord): string[] {
    return this.normalizeUserIds(record.invitedMemberUserIds);
  }

  private eventPendingRequestMemberUserIds(record: ActivityEventRecord): string[] {
    return this.normalizeUserIds(record.pendingRequestMemberUserIds);
  }

  private normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    return Array.from(new Set((userIds ?? [])
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
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

  private sameActivityCounts(left: UserRecord, right: UserRecord): boolean {
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

  private sameImpressions(left: UserRecord, right: UserRecord): boolean {
    return JSON.stringify(left.impressions ?? null) === JSON.stringify(right.impressions ?? null);
  }
}
