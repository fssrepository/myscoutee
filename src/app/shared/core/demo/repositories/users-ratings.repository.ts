import { Injectable } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import { DemoUserRatesBuilder, DemoUserSeedBuilder } from '../builders';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  ActivityRateRecordQuery,
  UserGameMode,
  UserRateRecord,
  UserRatesSyncResult
} from '../../base/interfaces/game.interface';
import { HttpUsersRatingsRepository } from '../../http/repositories/users-ratings.repository';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
} from '../models/activity-members.model';
import {
  type UserRatesRecordCollection,
  USER_RATES_OUTBOX_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  USERS_TABLE_NAME
} from '../models/users.model';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRatingsRepository extends HttpUsersRatingsRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private static readonly MIN_ACTIVITY_RATE_CONNECTIONS = 12;
  private static readonly DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO = 0.5;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT = 4;
  private static readonly FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 15;
  private static readonly DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT = 5;
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }
    const users = this.querySeedUsers();
    const visibleSeedUsers = users.filter(user => DemoUserSeedBuilder.isActivityRateVisibleProfile(user));
    const ownerIdsToSeed = this.collectOwnerIdsNeedingActivityRateSeed(visibleSeedUsers);
    if (ownerIdsToSeed.length === 0) {
      this.initialized = true;
      return;
    }
    const records = ownerIdsToSeed.flatMap((ownerUserId, ownerIndex) =>
      DemoUserRatesBuilder.buildGeneratedRateItemsForUser(visibleSeedUsers, ownerUserId, {
        extraSingleGivenCount: ownerIndex < DemoUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_OWNER_COUNT
          ? DemoUsersRatingsRepository.FEATURED_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT
          : DemoUsersRatingsRepository.DEFAULT_DEMO_ACTIVITY_RATE_EXTRA_SINGLE_GIVEN_COUNT,
        userCoverageRatio: DemoUsersRatingsRepository.DEMO_ACTIVITY_RATE_SEED_COVERAGE_RATIO
      })
        .map(item => DemoUserRatesBuilder.toActivityRateRecord(ownerUserId, item))
    );
    if (records.length === 0) {
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

  private querySeedUsers(): UserDto[] {
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    if (usersTable.ids.length > 0) {
      return usersTable.ids
        .map(id => usersTable.byId[id])
        .filter((user): user is UserDto => Boolean(user?.id?.trim()))
        .filter(user => !DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));
    }
    return DemoUserSeedBuilder.buildExpandedDemoUsers(DemoUsersRatingsRepository.DEFAULT_DEMO_USERS_COUNT)
      .filter(user => !DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));
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
      .filter(([, counterpartIds]) => counterpartIds.size < DemoUsersRatingsRepository.MIN_ACTIVITY_RATE_CONNECTIONS)
      .map(([ownerUserId]) => ownerUserId);
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

  queryRatedGameCardUserIds(raterUserId: string, mode: UserGameMode = 'single'): string[] {
    this.init();
    const normalizedRaterId = raterUserId.trim();
    if (!normalizedRaterId || DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(normalizedRaterId)) {
      return [];
    }
    const state = this.memoryDb.read();
    const ratesTable = state[USER_RATES_TABLE_NAME];
    const outboxTable = state[USER_RATES_OUTBOX_TABLE_NAME];

    const ratedUserIds = new Set<string>();

    for (const id of ratesTable.ids) {
      const record = ratesTable.byId[id];
      if (!record) {
        continue;
      }
      if (record.ownerUserId?.trim() !== normalizedRaterId) {
        continue;
      }
      const item = DemoUserRatesBuilder.toRateMenuItem(record);
      if (!item || (item.direction !== 'met' && item.scoreGiven <= 0)) {
        continue;
      }
      if (mode === 'single' && item.mode !== 'individual') {
        continue;
      }
      if (mode !== 'single' && item.mode !== 'pair') {
        continue;
      }
      ratedUserIds.add(item.userId.trim());
      if (item.secondaryUserId?.trim()) {
        ratedUserIds.add(item.secondaryUserId.trim());
      }
    }

    for (const id of outboxTable.ids) {
      const outboxRecord = outboxTable.byId[id];
      const payload = outboxRecord?.payload;
      if (!payload || outboxRecord.status !== 'pending') {
        continue;
      }
      if (payload.ownerUserId?.trim() !== normalizedRaterId) {
        continue;
      }
      const item = DemoUserRatesBuilder.toRateMenuItem(payload);
      if (!item || (item.direction !== 'met' && item.scoreGiven <= 0)) {
        continue;
      }
      if (mode === 'single' && item.mode !== 'individual') {
        continue;
      }
      if (mode !== 'single' && item.mode !== 'pair') {
        continue;
      }
      ratedUserIds.add(item.userId.trim());
      if (item.secondaryUserId?.trim()) {
        ratedUserIds.add(item.secondaryUserId.trim());
      }
    }

    return Array.from(ratedUserIds)
      .filter(id => id.length > 0)
      .filter(id => !DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(id));
  }

  override queryRatedGameCardPairKeys(ownerUserId: string): string[] {
    this.init();
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId || DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(normalizedOwnerUserId)) {
      return [];
    }
    const pairKeys = new Set(this.queryPendingRatedGameCardPairKeys(normalizedOwnerUserId));
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    for (const id of ratesTable.ids) {
      const record = ratesTable.byId[id];
      if (!record) {
        continue;
      }
      if (record.ownerUserId?.trim() !== normalizedOwnerUserId) {
        continue;
      }
      const item = DemoUserRatesBuilder.toRateMenuItem(record);
      if (!item || item.mode !== 'pair' || (item.direction !== 'met' && item.scoreGiven <= 0)) {
        continue;
      }
      const pairKey = this.sortedPairKey(item.userId, item.secondaryUserId ?? '');
      if (pairKey) {
        pairKeys.add(pairKey);
      }
    }
    return [...pairKeys];
  }

  private sortedPairKey(leftUserId: string, rightUserId: string): string | null {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (!normalizedLeftUserId || !normalizedRightUserId || normalizedLeftUserId === normalizedRightUserId) {
      return null;
    }
    return [normalizedLeftUserId, normalizedRightUserId]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }

  queryActivityRateItemsByUserId(userId: string): RateMenuItem[] {
    this.init();
    return this.buildRateItemsByUserId(userId);
  }

  override peekRateItemsByUserId(userId: string): RateMenuItem[] {
    this.init();
    return this.buildRateItemsByUserId(userId);
  }

  override async queryRateItemsByUserId(userId: string): Promise<RateMenuItem[]> {
    this.init();
    return this.buildRateItemsByUserId(userId);
  }

  async queryActivityRateItemsPage(query: ActivityRateRecordQuery): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    this.init();
    const normalizedOwnerUserId = query.ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    const mode = query.mode === 'pair' ? 'pair' : 'individual';
    const filtered = this.buildRateItemsByUserId(normalizedOwnerUserId)
      .filter(item => item.mode === mode)
      .filter(item => item.direction === query.displayDirection)
      .filter(item => this.matchesDynamicRateRange(item, query))
      .filter(item => this.matchesDynamicSocialFilter(item, query.socialBadgeEnabled === true))
      .sort((left, right) => this.compareDynamicRateItems(left, right, query));
    const cursorId = this.resolveDynamicRateCursorId(query.cursor);
    const limit = Math.max(1, Math.trunc(Number(query.limit) || 50));
    const startIndex = cursorId
      ? Math.max(0, filtered.findIndex(item => item.id === cursorId) + 1)
      : 0;
    const items = filtered
      .slice(startIndex, startIndex + limit)
      .map(item => ({ ...item }));

    return {
      items,
      total: filtered.length,
      nextCursor: filtered.length > startIndex + items.length && items.length > 0
        ? items[items.length - 1]?.id ?? null
        : null
    };
  }

  private buildRateItemsByUserId(userId: string): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(normalizedUserId)) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    const outboxTable = this.memoryDb.read()[USER_RATES_OUTBOX_TABLE_NAME];
    const recordsById = new Map<string, UserRateRecord>();
    const usersById = this.usersById();
    const indexedIds = ratesTable.idsByRelevantUserId[normalizedUserId] ?? [];
    for (const id of indexedIds) {
      const record = ratesTable.byId[id];
      if (record) {
        recordsById.set(record.id, record);
      }
    }
    for (const id of outboxTable.ids) {
      const record = outboxTable.byId[id];
      if (!record?.payload) {
        continue;
      }
      recordsById.set(record.payload.id, record.payload);
    }
    return [...recordsById.values()]
      .filter((record): record is UserRateRecord => Boolean(record))
      .flatMap(record => this.buildDynamicRateItemsForUser(record, normalizedUserId))
      .filter(item => !this.referencesEmptyOnboardingProfile(item))
      .filter(item => this.activityRateItemUsersAreVisible(item, normalizedUserId, usersById))
      .sort((left, right) => AppUtils.toSortableDate(right.happenedAt) - AppUtils.toSortableDate(left.happenedAt));
  }

  private referencesEmptyOnboardingProfile(item: RateMenuItem): boolean {
    return DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(item.userId)
      || DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(item.secondaryUserId ?? '')
      || DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(item.bridgeUserId ?? '');
  }

  private activityRateItemUsersAreVisible(
    item: RateMenuItem,
    ownerUserId: string,
    usersById: ReadonlyMap<string, UserDto>
  ): boolean {
    const normalizedOwnerUserId = ownerUserId.trim();
    const displayedUserIds = [
      item.userId?.trim() ?? '',
      item.secondaryUserId?.trim() ?? '',
      item.bridgeUserId?.trim() ?? ''
    ].filter((userId, index, ids) =>
      userId.length > 0
      && userId !== normalizedOwnerUserId
      && ids.indexOf(userId) === index
    );
    return displayedUserIds.every(userId =>
      DemoUserSeedBuilder.isActivityRateVisibleProfile(usersById.get(userId))
    );
  }

  private usersById(): Map<string, UserDto> {
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    return new Map(usersTable.ids
      .map(id => usersTable.byId[id])
      .filter((user): user is UserDto => Boolean(user?.id?.trim()))
      .map(user => [user.id, user] as const));
  }

  private buildDynamicRateItemsForUser(record: UserRateRecord, normalizedUserId: string): RateMenuItem[] {
    if (record.mode === 'pair') {
      return this.buildDynamicPairRateItemsForUser(record, normalizedUserId);
    }

    return this.buildDynamicSingleRateItemsForUser(record, normalizedUserId);
  }

  private buildDynamicSingleRateItemsForUser(record: UserRateRecord, normalizedUserId: string): RateMenuItem[] {
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (!ownerUserId) {
      return [];
    }

    const relatedUserId = this.resolveSingleRelatedUserId(record, ownerUserId);
    if (!relatedUserId || relatedUserId === ownerUserId) {
      return [];
    }

    const scoreGiven = this.dynamicScoreGiven(record);
    const scoreReceived = this.dynamicScoreReceived(record);
    const happenedAt = record.happenedAtIso?.trim() || record.updatedAtIso;
    const socialContext = this.resolveStoredSingleSocialContext(record);

    if (ownerUserId === normalizedUserId) {
      const direction = this.deriveOwnerSingleDirection(record, scoreGiven, scoreReceived);
      if (!direction) {
        return [];
      }
      if (direction === 'met' && !this.didUsersMeetFromIndexedDb(normalizedUserId, relatedUserId)) {
        return [];
      }
      return [{
        id: record.displayId?.trim() || record.id,
        userId: relatedUserId,
        mode: 'individual',
        direction,
        ...(socialContext ? { socialContext } : {}),
        bridgeUserId: record.bridgeUserId,
        bridgeCount: record.bridgeCount,
        scoreGiven,
        scoreReceived,
        eventName: record.eventName?.trim() || (direction === 'met' ? 'Met' : 'Rate'),
        happenedAt,
        distanceMetersExact: this.dynamicDistanceMetersExact(record)
      }];
    }

    if (record.fromUserId.trim() !== normalizedUserId && record.toUserId.trim() !== normalizedUserId) {
      return [];
    }

    const incomingScore = scoreGiven > 0 ? scoreGiven : scoreReceived;
    if (incomingScore <= 0) {
      return [];
    }
    return [{
      id: `${record.displayId?.trim() || record.id}:received:${normalizedUserId}`,
      userId: ownerUserId,
      mode: 'individual',
      direction: 'received',
      ...(socialContext ? { socialContext } : {}),
      bridgeUserId: record.bridgeUserId,
      bridgeCount: record.bridgeCount,
      scoreGiven: 0,
      scoreReceived: incomingScore,
      eventName: record.eventName?.trim() || 'Rate',
      happenedAt,
      distanceMetersExact: this.dynamicDistanceMetersExact(record)
    }];
  }

  private buildDynamicPairRateItemsForUser(record: UserRateRecord, normalizedUserId: string): RateMenuItem[] {
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    const pairUserIds = this.resolvePairUserIdsFromRecord(record);
    if (!ownerUserId || pairUserIds === null) {
      return [];
    }

    const items: RateMenuItem[] = [];
    const pairSocialContext = this.resolveStoredPairSocialContext(record)
      ?? this.resolveDynamicPairSocialContext(ownerUserId, pairUserIds[0], pairUserIds[1]);

    const scoreGiven = this.dynamicScoreGiven(record);
    const scoreReceived = this.dynamicScoreReceived(record);
    const isParticipant = pairUserIds.includes(normalizedUserId);

    if (ownerUserId === normalizedUserId) {
      if (isParticipant && scoreGiven <= 0 && scoreReceived > 0) {
        const receivedItem = this.buildDynamicReceivedPairItem(record, normalizedUserId, ownerUserId, pairUserIds, pairSocialContext);
        return receivedItem ? [receivedItem] : [];
      }
      if (scoreGiven > 0 || scoreReceived > 0) {
        items.push({
          id: record.displayId?.trim() || record.id,
          userId: pairUserIds[0],
          secondaryUserId: pairUserIds[1],
          mode: 'pair',
          direction: 'given',
          ...(pairSocialContext ? { socialContext: pairSocialContext } : {}),
          bridgeUserId: pairSocialContext ? ownerUserId : undefined,
          bridgeCount: pairSocialContext === 'separated-friends' ? 2 : undefined,
          scoreGiven,
          scoreReceived,
          eventName: record.eventName?.trim() || 'Pair rate',
          happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
          distanceMetersExact: this.dynamicDistanceMetersExact(record)
        });
      }
      return items;
    }

    const receivedItem = this.buildDynamicReceivedPairItem(record, normalizedUserId, ownerUserId, pairUserIds, pairSocialContext);
    return receivedItem ? [receivedItem] : [];
  }

  private buildDynamicReceivedPairItem(
    record: UserRateRecord,
    normalizedUserId: string,
    ownerUserId: string,
    pairUserIds: [string, string],
    socialContext: RateMenuItem['socialContext'] | null
  ): RateMenuItem | null {
    const [firstUserId, secondUserId] = pairUserIds;
    if (
      firstUserId !== normalizedUserId
      && secondUserId !== normalizedUserId
    ) {
      return null;
    }

    const otherUserId = firstUserId === normalizedUserId ? secondUserId : firstUserId;
    const scoreReceived = this.normalizeDynamicRateScore(
      Number.isFinite(Number(record.scoreGiven)) && Number(record.scoreGiven) > 0
        ? Number(record.scoreGiven)
        : Number.isFinite(Number(record.scoreReceived)) && Number(record.scoreReceived) > 0
          ? Number(record.scoreReceived)
        : record.rate
    );
    if (scoreReceived <= 0) {
      return null;
    }

    return {
      id: `${record.id}:received:${normalizedUserId}`,
      userId: otherUserId,
      secondaryUserId: normalizedUserId,
      mode: 'pair',
      direction: 'received',
      ...(socialContext ? { socialContext } : {}),
      bridgeUserId: socialContext ? ownerUserId : undefined,
      bridgeCount: socialContext === 'separated-friends' ? 2 : undefined,
      scoreGiven: 0,
      scoreReceived,
      eventName: record.eventName?.trim() || 'Pair rate',
      happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
      distanceMetersExact: this.dynamicDistanceMetersExact(record)
    };
  }

  private resolveSingleRelatedUserId(record: UserRateRecord, ownerUserId: string): string | null {
    const fromUserId = record.fromUserId.trim();
    const toUserId = record.toUserId.trim();
    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      return null;
    }
    if (fromUserId === ownerUserId) {
      return toUserId;
    }
    if (toUserId === ownerUserId) {
      return fromUserId;
    }
    return toUserId;
  }

  private deriveOwnerSingleDirection(
    record: UserRateRecord,
    scoreGiven: number,
    scoreReceived: number
  ): RateMenuItem['direction'] | null {
    if (record.displayDirection === 'met') {
      return 'met';
    }
    if (scoreGiven > 0 && scoreReceived > 0) {
      return 'mutual';
    }
    if (scoreGiven > 0) {
      return 'given';
    }
    if (scoreReceived > 0) {
      return 'received';
    }
    return null;
  }

  private resolvePairUserIdsFromRecord(record: UserRateRecord): [string, string] | null {
    const firstUserId = record.fromUserId.trim();
    const secondUserId = record.toUserId.trim();
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      return null;
    }
    return [firstUserId, secondUserId];
  }

  private resolveDynamicPairSocialContext(
    ownerUserId: string,
    firstUserId: string,
    secondUserId: string
  ): RateMenuItem['socialContext'] | null {
    const normalizedOwnerUserId = ownerUserId.trim();
    const normalizedFirstUserId = firstUserId.trim();
    const normalizedSecondUserId = secondUserId.trim();
    if (
      !normalizedOwnerUserId
      || !normalizedFirstUserId
      || !normalizedSecondUserId
      || normalizedFirstUserId === normalizedSecondUserId
      || normalizedOwnerUserId === normalizedFirstUserId
      || normalizedOwnerUserId === normalizedSecondUserId
    ) {
      return null;
    }

    const ownerMetFirst = this.didUsersMeetFromIndexedDb(normalizedOwnerUserId, normalizedFirstUserId);
    const ownerMetSecond = this.didUsersMeetFromIndexedDb(normalizedOwnerUserId, normalizedSecondUserId);
    if (ownerMetFirst && ownerMetSecond) {
      return 'separated-friends';
    }

    return null;
  }

  private resolveStoredPairSocialContext(record: UserRateRecord): RateMenuItem['socialContext'] | null {
    return record.socialContext === 'separated-friends' ? 'separated-friends' : null;
  }

  private resolveStoredSingleSocialContext(record: UserRateRecord): RateMenuItem['socialContext'] | null {
    return record.socialContext === 'friends-in-common' ? 'friends-in-common' : null;
  }

  private didUsersMeetFromIndexedDb(leftUserId: string, rightUserId: string): boolean {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (
      !normalizedLeftUserId
      || !normalizedRightUserId
      || normalizedLeftUserId === normalizedRightUserId
    ) {
      return false;
    }

    const table = this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    const groupsByOwnerKey = new Map<string, Set<string>>();
    for (const id of table.ids) {
      const record = table.byId[id];
      const ownerType = record?.ownerType === 'event' || record?.ownerType === 'subEvent' || record?.ownerType === 'group'
        ? record.ownerType
        : null;
      const ownerId = record?.ownerId?.trim() ?? '';
      const userId = record?.userId?.trim() ?? '';
      if (!ownerType || !ownerId || !userId || record.status !== 'accepted') {
        continue;
      }
      const ownerKey = `${ownerType}:${ownerId}`;
      const bucket = groupsByOwnerKey.get(ownerKey) ?? new Set<string>();
      bucket.add(userId);
      groupsByOwnerKey.set(ownerKey, bucket);
    }

    for (const members of groupsByOwnerKey.values()) {
      if (members.has(normalizedLeftUserId) && members.has(normalizedRightUserId)) {
        return true;
      }
    }

    return false;
  }

  private matchesDynamicRateRange(item: RateMenuItem, query: ActivityRateRecordQuery): boolean {
    const happenedAtMs = AppUtils.toSortableDate(item.happenedAt ?? '');
    const rangeStartMs = query.rangeStartIso ? AppUtils.toSortableDate(query.rangeStartIso) : null;
    const rangeEndMs = query.rangeEndIso ? AppUtils.toSortableDate(query.rangeEndIso) : null;
    if (rangeStartMs !== null && happenedAtMs < rangeStartMs) {
      return false;
    }
    if (rangeEndMs !== null && happenedAtMs > rangeEndMs) {
      return false;
    }
    return true;
  }

  private matchesDynamicSocialFilter(item: RateMenuItem, socialBadgeEnabled: boolean): boolean {
    if (item.mode === 'individual') {
      const friendsInCommon = item.socialContext === 'friends-in-common';
      return socialBadgeEnabled ? friendsInCommon : !friendsInCommon;
    }
    if (item.mode === 'pair') {
      const insideNetwork = item.socialContext === 'separated-friends';
      return socialBadgeEnabled ? insideNetwork : !insideNetwork;
    }
    return true;
  }

  private compareDynamicRateItems(left: RateMenuItem, right: RateMenuItem, query: ActivityRateRecordQuery): number {
    if (query.sort === 'distance') {
      const distanceDelta = this.dynamicDistanceValue(left) - this.dynamicDistanceValue(right);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
      return left.id.localeCompare(right.id);
    }

    if (query.sort === 'relevance') {
      const relevanceDelta = this.dynamicRelevanceScore(right) - this.dynamicRelevanceScore(left);
      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }
      return right.id.localeCompare(left.id);
    }

    const sortDirection = query.sortDirection === 'asc' || query.sortDirection === 'desc'
      ? query.sortDirection
      : 'desc';
    const happenedAtDelta = sortDirection === 'asc'
      ? AppUtils.toSortableDate(left.happenedAt ?? '') - AppUtils.toSortableDate(right.happenedAt ?? '')
      : AppUtils.toSortableDate(right.happenedAt ?? '') - AppUtils.toSortableDate(left.happenedAt ?? '');
    if (happenedAtDelta !== 0) {
      return happenedAtDelta;
    }
    return sortDirection === 'asc'
      ? left.id.localeCompare(right.id)
      : right.id.localeCompare(left.id);
  }

  private dynamicDistanceMetersExact(record: UserRateRecord): number {
    if (Number.isFinite(record.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(record.distanceMetersExact)));
    }
    return 0;
  }

  private dynamicDistanceValue(item: RateMenuItem): number {
    if (Number.isFinite(item.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
    }
    return 0;
  }

  private dynamicRelevanceScore(item: RateMenuItem): number {
    const scoreGiven = Number.isFinite(item.scoreGiven)
      ? Math.max(0, Math.round(Number(item.scoreGiven)))
      : 0;
    const scoreReceived = Number.isFinite(item.scoreReceived)
      ? Math.max(0, Math.round(Number(item.scoreReceived)))
      : 0;
    if (item.direction === 'mutual') {
      return scoreGiven + scoreReceived;
    }
    return scoreGiven > 0 ? scoreGiven : 5;
  }

  private dynamicScoreGiven(record: UserRateRecord): number {
    if (Number.isFinite(Number(record.scoreGiven))) {
      return this.normalizeDynamicRateScore(Number(record.scoreGiven));
    }
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (record.fromUserId.trim() === ownerUserId && Number.isFinite(Number(record.rate))) {
      return this.normalizeDynamicRateScore(Number(record.rate));
    }
    return 0;
  }

  private dynamicScoreReceived(record: UserRateRecord): number {
    if (Number.isFinite(Number(record.scoreReceived))) {
      return this.normalizeDynamicRateScore(Number(record.scoreReceived));
    }
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (record.toUserId.trim() === ownerUserId && Number.isFinite(Number(record.rate))) {
      return this.normalizeDynamicRateScore(Number(record.rate));
    }
    return 0;
  }

  private normalizeDynamicRateScore(value: number): number {
    return Math.min(10, Math.max(0, Math.round(Number(value) || 0)));
  }

  private resolveDynamicRateCursorId(cursor: string | null | undefined): string | null {
    const normalizedCursor = `${cursor ?? ''}`.trim();
    if (!normalizedCursor) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalizedCursor) as { id?: string };
      return typeof parsed.id === 'string' && parsed.id.trim().length > 0
        ? parsed.id.trim()
        : normalizedCursor;
    } catch {
      return normalizedCursor;
    }
  }

  queryUserRatesByUserId(userId: string): UserRateRecord[] {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const ratesTable = this.memoryDb.read()[USER_RATES_TABLE_NAME];
    const indexedIds = ratesTable.idsByRelevantUserId[normalizedUserId] ?? [];
    return indexedIds
      .map(id => ratesTable.byId[id])
      .filter((record): record is UserRateRecord => Boolean(record))
      .filter(record =>
        record.fromUserId === normalizedUserId
        || record.toUserId === normalizedUserId
        || record.ownerUserId === normalizedUserId
      )
      .map(record => ({ ...record }));
  }

  upsertGameCardRatings(records: readonly UserRateRecord[]): string[] {
    this.init();
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
        [USER_RATES_TABLE_NAME]: this.rebuildUserRatesTableIndex({
          ...table,
          byId,
          ids
        })
      };
    });
    return normalizedRecords.map(record => record.id);
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

  protected override async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    const syncedRateIds = this.upsertGameCardRatings(rates);
    const syncedIds = new Set(syncedRateIds);
    const failedRateIds = rates
      .map(rate => rate.id.trim())
      .filter(rateId => rateId.length > 0 && !syncedIds.has(rateId));
    return {
      syncedRateIds,
      failedRateIds,
      error: failedRateIds.length > 0 ? 'Invalid demo rate payload' : null
    };
  }

  private normalizeIncomingRateRecord(record: UserRateRecord): UserRateRecord | null {
    return this.normalizeIncomingActivityRateRecord(record);
  }

  private normalizeIncomingActivityRateRecord(record: UserRateRecord): UserRateRecord | null {
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (!ownerUserId) {
      return null;
    }
    const item = DemoUserRatesBuilder.toRateMenuItem(record);
    if (!item) {
      return null;
    }
    const normalized = this.buildNormalizedActivityRateRecord(
      ownerUserId,
      item,
      Number.isFinite(Number(record.scoreGiven)) && Number(record.scoreGiven) > 0
        ? Number(record.scoreGiven)
        : record.rate,
      record.displayDirection ?? item.direction
    );
    if (!normalized) {
      return null;
    }
    return {
      ...normalized,
      id: record.id,
      displayId: record.displayId?.trim() || record.id,
      createdAtIso: typeof record.createdAtIso === 'string' && record.createdAtIso.trim().length > 0
        ? record.createdAtIso
        : normalized.createdAtIso,
      updatedAtIso: typeof record.updatedAtIso === 'string' && record.updatedAtIso.trim().length > 0
        ? record.updatedAtIso
        : normalized.updatedAtIso
    };
  }
}
