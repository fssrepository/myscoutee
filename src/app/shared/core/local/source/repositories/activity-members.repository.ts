import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type { ActivityMemberOwnerRef, ActivityMembersSummary, UserGameMode, UserGameSocialCard } from '../../../contracts/activity.interface';
import { LocalMemoryDb } from '../../../base/db';
import type { ActivityEventRecord } from '../../../base/models/events.model';

import { ACTIVITY_MEMBERS_TABLE_NAME, type ActivityMemberRecord, type ActivityMembersRecordCollection } from '../entity/activity.entity';
import { UserProfileStateBuilder } from '../../../base/builders';
import { LocalUsersRepository } from './users.repository';

export interface DemoAcceptedEventMemberGroup {
  eventId: string;
  eventName: string;
  userIds: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LocalActivityMembersRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly localUsersRepository = inject(LocalUsersRepository);
  private readonly ownerCapacityByKey = new Map<string, number>();
  private gameSocialCardsCacheToken = '';
  private acceptedMemberGraphCacheToken = '';
  private acceptedMemberGraphCache: {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } | null = null;
  private readonly gameSocialCardsByUserId = new Map<string, Record<'friends-in-common' | 'separated-friends', UserGameSocialCard[]>>();

  peekRecordsByOwner(owner: ActivityMemberOwnerRef): ActivityMemberRecord[] {
    return this.readRecordsByOwner(owner);
  }

  async queryRecordsByOwner(owner: ActivityMemberOwnerRef): Promise<ActivityMemberRecord[]> {
    return this.readRecordsByOwner(owner);
  }

  queryAcceptedEventMemberGroups(): DemoAcceptedEventMemberGroup[] {
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return this.acceptedEventMemberGroupsFromTable(table);
  }

  queryGameSocialCards(activeUserId: string, mode: Extract<UserGameMode, 'friends-in-common' | 'separated-friends'>): UserGameSocialCard[] {
    const normalizedUserId = activeUserId.trim();
    if (!normalizedUserId) {
      return [];
    }
    this.ensureGameSocialCardsCache();
    return (this.gameSocialCardsByUserId.get(normalizedUserId)?.[mode] ?? [])
      .map(card => ({ ...card }));
  }

  queryMetUserIds(activeUserId: string): string[] {
    const normalizedUserId = activeUserId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const graph = this.queryAcceptedMemberGraph();
    return [...(graph.neighborsByUserId.get(normalizedUserId) ?? new Set<string>())]
      .filter(userId => userId !== normalizedUserId)
      .sort((left, right) => left.localeCompare(right));
  }

  didUsersMeet(leftUserId: string, rightUserId: string): boolean {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (
      !normalizedLeftUserId
      || !normalizedRightUserId
      || normalizedLeftUserId === normalizedRightUserId
    ) {
      return false;
    }
    const graph = this.queryAcceptedMemberGraph();
    return graph.neighborsByUserId.get(normalizedLeftUserId)?.has(normalizedRightUserId) ?? false;
  }

  private acceptedEventMemberGroupsFromTable(
    table: ActivityMembersRecordCollection
  ): DemoAcceptedEventMemberGroup[] {
    const groupsByEventId = new Map<string, { eventName: string; userIds: Set<string> }>();
    for (const id of table.ids) {
      const record = table.byId[id];
      const activityOwnerType = record?.ownerType === 'event' || record?.ownerType === 'subEvent' || record?.ownerType === 'group'
        ? record.ownerType
        : null;
      const eventId = activityOwnerType ? `${activityOwnerType}:${record?.ownerId.trim() ?? ''}` : '';
      const userId = record?.userId.trim() ?? '';
      if (!record || record.status !== 'accepted' || !eventId || !userId) {
        continue;
      }
      const group = groupsByEventId.get(eventId) ?? {
        eventName: record.metWhere?.trim() || eventId,
        userIds: new Set<string>()
      };
      group.userIds.add(userId);
      if (!group.eventName && record.metWhere?.trim()) {
        group.eventName = record.metWhere.trim();
      }
      groupsByEventId.set(eventId, group);
    }
    return [...groupsByEventId.entries()]
      .map(([eventId, group]) => ({
        eventId,
        eventName: group.eventName || eventId,
        userIds: [...group.userIds].sort()
      }))
      .filter(group => group.userIds.length > 1)
      .sort((left, right) => left.eventId.localeCompare(right.eventId));
  }

  private ensureGameSocialCardsCache(): void {
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const token = this.gameSocialCardsCacheTokenForTable(table);
    if (token === this.gameSocialCardsCacheToken) {
      return;
    }
    this.refreshGameSocialCardsCache(table);
  }

  private refreshGameSocialCardsCache(table: ActivityMembersRecordCollection): void {
    const groups = this.acceptedEventMemberGroupsFromTable(table);
    const graph = this.buildAcceptedMemberGraph(groups);
    const graphToken = this.gameSocialCardsCacheTokenForTable(table);
    this.acceptedMemberGraphCache = graph;
    this.acceptedMemberGraphCacheToken = graphToken;
    this.gameSocialCardsByUserId.clear();
    const graphUserIds = [...graph.neighborsByUserId.keys()].sort();
    const usersById = new Map(this.localActivityMemberUsers.map(user => [user.id, user] as const));
    for (const activeUserId of graphUserIds) {
      if (!UserProfileStateBuilder.isPublicGameProfile(usersById.get(activeUserId))) {
        continue;
      }
      const activeNeighbors = [...(graph.neighborsByUserId.get(activeUserId) ?? new Set<string>())]
        .filter(userId => userId !== activeUserId)
        .filter(userId => UserProfileStateBuilder.isInsideNetworkGameProfile(usersById.get(userId)))
        .sort();
      const activeNeighborIds = new Set(activeNeighbors);
      const cards: Record<'friends-in-common' | 'separated-friends', UserGameSocialCard[]> = {
        'friends-in-common': [],
        'separated-friends': []
      };
      for (let leftIndex = 0; leftIndex < activeNeighbors.length; leftIndex += 1) {
        const leftUserId = activeNeighbors[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < activeNeighbors.length; rightIndex += 1) {
          const rightUserId = activeNeighbors[rightIndex];
          const key = this.sortedPairKey(leftUserId, rightUserId);
          if (graph.neighborsByUserId.get(leftUserId)?.has(rightUserId)) {
            continue;
          }
          cards['separated-friends'].push({
            id: `separated-friends:${activeUserId}:${key}`,
            userId: leftUserId,
            secondaryUserId: rightUserId,
            socialContext: 'separated-friends',
            bridgeCount: 2,
            eventName: graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, leftUserId))
              ?? graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, rightUserId))
              ?? 'Inside Network'
          });
        }
      }
      for (const candidateUserId of graphUserIds) {
        if (
          candidateUserId === activeUserId
          || activeNeighborIds.has(candidateUserId)
          || !UserProfileStateBuilder.isPublicGameProfile(usersById.get(candidateUserId))
        ) {
          continue;
        }
        const candidateNeighbors = graph.neighborsByUserId.get(candidateUserId) ?? new Set<string>();
        const bridgeUserIds = activeNeighbors
          .filter(bridgeUserId => candidateNeighbors.has(bridgeUserId))
          .filter(bridgeUserId => UserProfileStateBuilder.isInsideNetworkGameProfile(usersById.get(bridgeUserId)))
          .sort();
        if (bridgeUserIds.length === 0) {
          continue;
        }
        const bridgeUserId = this.strongestBridgeUserId(bridgeUserIds, usersById);
        cards['friends-in-common'].push({
          id: `friends-in-common:${activeUserId}:${candidateUserId}`,
          userId: candidateUserId,
          socialContext: 'friends-in-common',
          bridgeUserId,
          bridgeCount: bridgeUserIds.length,
          eventName: graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, bridgeUserId))
            ?? graph.edgeEventNameByKey.get(this.sortedPairKey(candidateUserId, bridgeUserId))
            ?? 'Friends in Common'
        });
      }
      cards['friends-in-common'].sort((left, right) => {
        const bridgeDelta = (right.bridgeCount ?? 0) - (left.bridgeCount ?? 0);
        if (bridgeDelta !== 0) {
          return bridgeDelta;
        }
        const scoreDelta = this.singleDistanceScore(activeUserId, right, usersById)
          - this.singleDistanceScore(activeUserId, left, usersById);
        return scoreDelta !== 0 ? scoreDelta : left.id.localeCompare(right.id);
      });
      cards['separated-friends'].sort((left, right) => {
        const scoreDelta = this.pairDistanceScore(activeUserId, right, usersById)
          - this.pairDistanceScore(activeUserId, left, usersById);
        return scoreDelta !== 0 ? scoreDelta : left.id.localeCompare(right.id);
      });
      this.gameSocialCardsByUserId.set(activeUserId, cards);
    }
    this.gameSocialCardsCacheToken = graphToken;
  }

  private pairDistanceScore(
    activeUserId: string,
    card: UserGameSocialCard,
    usersById: ReadonlyMap<string, UserDto>
  ): number {
    const activeUser = usersById.get(activeUserId);
    const leftUser = usersById.get(card.userId.trim());
    const rightUser = usersById.get((card.secondaryUserId ?? '').trim());
    const pairScore = this.distanceBucketScore(leftUser, rightUser);
    const triangleScore = (
      this.distanceBucketScore(activeUser, leftUser)
      + this.distanceBucketScore(activeUser, rightUser)
    ) / 2;
    return pairScore + (triangleScore * 0.35);
  }

  private singleDistanceScore(
    activeUserId: string,
    card: UserGameSocialCard,
    usersById: ReadonlyMap<string, UserDto>
  ): number {
    return this.distanceBucketScore(usersById.get(activeUserId), usersById.get(card.userId.trim()));
  }

  private distanceBucketScore(left: UserDto | undefined, right: UserDto | undefined): number {
    const distanceMeters = this.distanceMeters(left?.locationCoordinates, right?.locationCoordinates);
    if (distanceMeters === null) {
      return 0;
    }
    const bucketIndex = Math.floor(Math.max(0, distanceMeters / 1000) / 5);
    return Math.max(0, 1 - (Math.min(bucketIndex, 12) / 12));
  }

  private distanceMeters(
    left: UserDto['locationCoordinates'] | undefined,
    right: UserDto['locationCoordinates'] | undefined
  ): number | null {
    const leftLat = Number(left?.latitude);
    const leftLon = Number(left?.longitude);
    const rightLat = Number(right?.latitude);
    const rightLon = Number(right?.longitude);
    if (![leftLat, leftLon, rightLat, rightLon].every(Number.isFinite)) {
      return null;
    }
    const earthRadiusMeters = 6371000;
    const latitudeDelta = this.toRadians(rightLat - leftLat);
    const longitudeDelta = this.toRadians(rightLon - leftLon);
    const leftLatitude = this.toRadians(leftLat);
    const rightLatitude = this.toRadians(rightLat);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(leftLatitude) * Math.cos(rightLatitude) * (Math.sin(longitudeDelta / 2) ** 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }

  private strongestBridgeUserId(
    bridgeUserIds: readonly string[],
    usersById: ReadonlyMap<string, UserDto>
  ): string {
    return [...bridgeUserIds]
      .sort((left, right) => {
        const affinityDelta = this.resolveUserAffinity(usersById.get(right)) - this.resolveUserAffinity(usersById.get(left));
        return affinityDelta !== 0 ? affinityDelta : left.localeCompare(right);
      })[0] ?? '';
  }

  private resolveUserAffinity(user: UserDto | undefined): number {
    const value = Number(user?.affinity);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private queryAcceptedMemberGraph(): {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } {
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const token = this.gameSocialCardsCacheTokenForTable(table);
    if (this.acceptedMemberGraphCache && this.acceptedMemberGraphCacheToken === token) {
      return this.acceptedMemberGraphCache;
    }
    const graph = this.buildAcceptedMemberGraph(this.acceptedEventMemberGroupsFromTable(table));
    this.acceptedMemberGraphCache = graph;
    this.acceptedMemberGraphCacheToken = token;
    return graph;
  }

  private buildAcceptedMemberGraph(groups: readonly DemoAcceptedEventMemberGroup[]): {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } {
    const neighborsByUserId = new Map<string, Set<string>>();
    const edgeEventNameByKey = new Map<string, string>();
    for (const group of groups) {
      for (let leftIndex = 0; leftIndex < group.userIds.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < group.userIds.length; rightIndex += 1) {
          this.registerAcceptedMemberEdge(
            neighborsByUserId,
            edgeEventNameByKey,
            group.userIds[leftIndex] ?? '',
            group.userIds[rightIndex] ?? '',
            group.eventName
          );
        }
      }
    }
    return { neighborsByUserId, edgeEventNameByKey };
  }

  private registerAcceptedMemberEdge(
    neighborsByUserId: Map<string, Set<string>>,
    edgeEventNameByKey: Map<string, string>,
    leftUserId: string,
    rightUserId: string,
    eventName?: string
  ): void {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (!normalizedLeftUserId || !normalizedRightUserId || normalizedLeftUserId === normalizedRightUserId) {
      return;
    }
    if (!neighborsByUserId.has(normalizedLeftUserId)) {
      neighborsByUserId.set(normalizedLeftUserId, new Set<string>());
    }
    if (!neighborsByUserId.has(normalizedRightUserId)) {
      neighborsByUserId.set(normalizedRightUserId, new Set<string>());
    }
    neighborsByUserId.get(normalizedLeftUserId)?.add(normalizedRightUserId);
    neighborsByUserId.get(normalizedRightUserId)?.add(normalizedLeftUserId);
    const key = this.sortedPairKey(normalizedLeftUserId, normalizedRightUserId);
    if (eventName?.trim()) {
      edgeEventNameByKey.set(key, eventName.trim());
    }
  }

  private sortedPairKey(leftUserId: string, rightUserId: string): string {
    return [leftUserId.trim(), rightUserId.trim()].sort((left, right) => left.localeCompare(right)).join(':');
  }

  private gameSocialCardsCacheTokenForTable(table: ActivityMembersRecordCollection): string {
    const latestUpdatedMs = table.ids.reduce((latest, id) => {
      const record = table.byId[id];
      return Math.max(latest, Number.isFinite(Number(record?.updatedMs)) ? Number(record?.updatedMs) : 0);
    }, 0);
    return `${table.ids.length}:${Object.keys(table.idsByOwnerKey).length}:${latestUpdatedMs}`;
  }

  replaceRecordsByOwner(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    summary: ActivityMembersSummary,
    syncUserIds = true
  ): void {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    this.writeOwnerRecords(normalizedOwner, records, summary, syncUserIds);
  }

  normalizeOwnerRef(owner: ActivityMemberOwnerRef | null | undefined): ActivityMemberOwnerRef | null {
    const ownerType = owner?.ownerType;
    const ownerId = owner?.ownerId?.trim() ?? '';
    if ((ownerType !== 'event' && ownerType !== 'subEvent' && ownerType !== 'group' && ownerType !== 'asset') || !ownerId) {
      return null;
    }
    return {
      ownerType,
      ownerId
    };
  }

  normalizeOwners(owners: readonly ActivityMemberOwnerRef[]): ActivityMemberOwnerRef[] {
    const next: ActivityMemberOwnerRef[] = [];
    const seen = new Set<string>();
    for (const owner of owners) {
      const normalizedOwner = this.normalizeOwnerRef(owner);
      if (!normalizedOwner) {
        continue;
      }
      const key = this.ownerKey(normalizedOwner);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      next.push(normalizedOwner);
    }
    return next;
  }

  ownerKey(owner: ActivityMemberOwnerRef): string {
    return `${owner.ownerType}:${owner.ownerId}`;
  }

  resolveOwnerCapacityTotal(owner: ActivityMemberOwnerRef, acceptedMembers: number): number {
    const ownerKey = this.ownerKey(owner);
    const storedCapacity = this.ownerCapacityByKey.get(ownerKey);
    if (owner.ownerType === 'event') {
      return Math.max(
        acceptedMembers,
        storedCapacity ?? this.resolveEventCapacityTotal(owner.ownerId, acceptedMembers)
      );
    }
    return Math.max(
      acceptedMembers,
      storedCapacity ?? this.parseSampleCapacityLabel(owner.ownerId).capacityTotal ?? 0
    );
  }

  private readRecordsByOwner(owner: ActivityMemberOwnerRef): ActivityMemberRecord[] {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record))
      .map(record => this.cloneRecord(record));
  }

  private get localActivityMemberUsers(): UserDto[] {
    return (this.localUsersRepository.queryAllUsers() as UserDto[])
      .filter(user => !UserProfileStateBuilder.isEmptyOnboardingProfileUserId(user.id));
  }

  private writeOwnerRecords(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    summary: ActivityMembersSummary,
    syncUserIds = true
  ): void {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const normalizedRecords = records.map(record => ({
      ...this.cloneRecord(record),
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      ownerKey
    }));

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
      const nextById = { ...table.byId };
      const nextIds: string[] = [];
      const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(table.idsByOwnerKey);

      for (const id of table.ids) {
        const current = table.byId[id];
        if (current?.ownerKey === ownerKey) {
          delete nextById[id];
          continue;
        }
        nextIds.push(id);
      }

      delete nextIdsByOwnerKey[ownerKey];

      for (const record of normalizedRecords) {
        nextById[record.id] = this.cloneRecord(record);
        nextIds.push(record.id);
        const ownerBucket = nextIdsByOwnerKey[ownerKey] ?? [];
        ownerBucket.push(record.id);
        nextIdsByOwnerKey[ownerKey] = ownerBucket;
      }

      return {
        ...state,
        [ACTIVITY_MEMBERS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds,
          idsByOwnerKey: nextIdsByOwnerKey
        }
      };
    });

    this.ownerCapacityByKey.set(ownerKey, summary.capacityTotal);
    if (normalizedOwner.ownerType === 'event') {
      this.syncSingleEventSummary(normalizedOwner.ownerId, summary, syncUserIds);
    }
  }

  private syncSingleEventSummary(eventId: string, summary: ActivityMembersSummary, syncUserIds: boolean): void {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      let changed = false;

      for (const id of table.ids) {
        const current = table.byId[id];
        if (!current || current.id !== normalizedEventId) {
          continue;
        }
        nextById[id] = {
          ...current,
          acceptedMembers: summary.acceptedMembers,
          pendingMembers: summary.pendingMembers,
          capacityTotal: Math.max(summary.acceptedMembers, summary.capacityTotal)
        };
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: [...table.ids]
        }
      };
    });
  }

  private normalizeCollection(
    table: ActivityMembersRecordCollection
  ): ActivityMembersRecordCollection {
    const nextById = { ...(table.byId ?? {}) };
    const nextIds = Array.isArray(table.ids) ? table.ids.map(id => String(id)) : [];
    const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(table.idsByOwnerKey);

    for (const id of nextIds) {
      const record = nextById[id];
      const ownerKey = typeof record?.ownerKey === 'string' ? record.ownerKey.trim() : '';
      if (!ownerKey) {
        continue;
      }
      const ownerBucket = nextIdsByOwnerKey[ownerKey];
      if (!ownerBucket) {
        nextIdsByOwnerKey[ownerKey] = [id];
      } else if (!ownerBucket.includes(id)) {
        ownerBucket.push(id);
      }
    }

    return {
      byId: nextById,
      ids: nextIds,
      idsByOwnerKey: nextIdsByOwnerKey
    };
  }

  private cloneOwnerKeyIndex(index: Record<string, string[] | readonly string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      if (!ownerKey.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerKey] = ids.map(id => String(id));
    }
    return next;
  }

  private resolveEventCapacityTotal(eventId: string, acceptedMembers: number): number {
    const sampleCapacity = this.parseSampleCapacityLabel(eventId).capacityTotal ?? 0;
    return Math.max(acceptedMembers, sampleCapacity, 4);
  }

  private parseSampleCapacityLabel(eventId: string): { acceptedMembers: number | null; capacityTotal: number | null } {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return { acceptedMembers: null, capacityTotal: null };
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const record = table.ids
      .map(id => table.byId[id])
      .filter((value): value is ActivityEventRecord => Boolean(value))
      .find(value => value.id === normalizedEventId);
    if (!record) {
      return { acceptedMembers: null, capacityTotal: null };
    }
    return {
      acceptedMembers: this.normalizeMemberCount(record.acceptedMembers),
      capacityTotal: this.normalizeMemberCount(record.capacityTotal)
    };
  }

  private cloneRecord(record: ActivityMemberRecord): ActivityMemberRecord {
    return {
      ...record,
      profile: record.profile ? { ...record.profile } : record.profile
    };
  }

  private normalizeMemberCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}
