import { Injectable, inject } from '@angular/core';

import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary
} from '../../../core/base/models';
import { ActivityMembersBuilder } from '../../base/builders/activity-members.builder';
import { toActivityEventRow } from '../../base/converters/activities-event.converter';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../base/interfaces/user.interface';
import type { ActivityEventSeedItem, ActivityHostingSeedItem } from '../../base/models/event-seed-item.model';
import { HttpActivityMembersRepository } from '../../http/repositories/activity-members.repository';
import type { UserGameMode, UserGameSocialCard } from '../../base/interfaces/game.interface';
import type { ActivityEventRecord, ActivityEventRecordCollection } from '../../base/models/events.model';
import { EVENTS_TABLE_NAME } from '../../base/models/events.model';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMemberRecord,
  type ActivityMembersRecordCollection
} from '../../base/models/activity-members.model';
import { LocalEventsRepositoryBuilder, LocalEventSeedBuilder, LocalSeedScheduleBuilder, LocalUserSeedBuilder } from '../builders';
import { LocalAssetsRepository } from './assets.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalUsersRepository } from './users.repository';

export interface DemoAcceptedEventMemberGroup {
  eventId: string;
  eventName: string;
  userIds: string[];
}

interface ExplicitSeedMemberUserIds {
  accepted: string[];
  pending: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LocalActivityMembersRepository extends HttpActivityMembersRepository {
  private static readonly MAX_BOOTSTRAP_RECORDS = 1000;
  private static readonly MAX_SEEDED_ASSETS_PER_USER = 2;
  private static readonly MAX_SEEDED_ASSET_REQUESTS_PER_OWNER = 1;
  private static readonly MAX_SEEDED_SUB_EVENT_PARENT_EVENTS = 14;
  private static readonly MAX_SEEDED_SUB_EVENTS_PER_EVENT = 2;
  private static readonly MAX_SEEDED_GROUPS_PER_SUB_EVENT = 2;
  private readonly localAssetsRepository = inject(LocalAssetsRepository);
  private readonly localEventsRepository = inject(LocalEventsRepository);
  private readonly localUsersRepository = inject(LocalUsersRepository);
  private lastInitToken = '';
  private readonly ownerCapacityByKey = new Map<string, number>();
  private localActivityMemberUsersSnapshot: UserDto[] | null = null;
  private preferredEventRecordsSnapshot: ActivityEventRecord[] | null = null;
  private invitationPreviewRecordsSnapshot: ActivityEventRecord[] | null = null;
  private eventCapacitySnapshotByEventId: Map<string, { acceptedMembers: number | null; capacityTotal: number | null }> | null = null;
  private explicitSeedMemberUserIdsByEventId: Map<string, ExplicitSeedMemberUserIds> | null = null;
  private readonly seededSubEventsSnapshotByEventId = new Map<string, AppTypes.SubEventFormItem[]>();
  private gameSocialCardsCacheToken = '';
  private acceptedMemberGraphCacheToken = '';
  private acceptedMemberGraphCache: {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } | null = null;
  private readonly gameSocialCardsByUserId = new Map<string, Record<'friends-in-common' | 'separated-friends', UserGameSocialCard[]>>();

  constructor() {
    super();
  }

  init(
    ownerUserIds?: readonly string[],
    assetsByUserId?: ReadonlyMap<string, readonly AppTypes.AssetCard[]>
  ): void {
    this.localEventsRepository.init();
    const normalizedOwnerUserIds = Array.from(new Set(
      (ownerUserIds ?? this.localUsersRepository.queryAvailableDemoUsers().map(user => user.id))
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
        .filter(userId => !LocalUserSeedBuilder.isEmptyOnboardingProfileUserId(userId))
    ));
    if (normalizedOwnerUserIds.length > 0) {
      this.localAssetsRepository.init(normalizedOwnerUserIds);
    }

    const eventsTable = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const initToken = `${eventsTable.ids.length}:${currentTable.ids.length}:${Object.keys(currentTable.idsByOwnerKey).length}:${normalizedOwnerUserIds.join('|')}`;
    if (this.lastInitToken === initToken) {
      return;
    }

    this.localActivityMemberUsersSnapshot = (this.localUsersRepository.queryAllUsers() as UserDto[])
      .filter(user => !LocalUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));
    this.preferredEventRecordsSnapshot = this.computePreferredEventRecords(eventsTable);
    this.invitationPreviewRecordsSnapshot = this.computeInvitationPreviewRecords(eventsTable);
    this.eventCapacitySnapshotByEventId = this.buildEventCapacitySnapshot(eventsTable);
    this.seededSubEventsSnapshotByEventId.clear();

    try {
      const existingOwnerKeys = new Set(
        Object.keys(currentTable.idsByOwnerKey)
          .filter(ownerKey => ownerKey.length > 0)
      );
      let nextById: Record<string, ActivityMemberRecord> | null = null;
      let nextIds: string[] | null = null;
      let nextIdsByOwnerKey: Record<string, string[]> | null = null;
      let changed = false;

      const appendSeededRecords = (records: readonly ActivityMemberRecord[]): void => {
        const recordsByOwnerKey = new Map<string, ActivityMemberRecord[]>();
        for (const record of records) {
          const ownerKey = record.ownerKey?.trim() ?? '';
          if (!ownerKey) {
            continue;
          }
          const bucket = recordsByOwnerKey.get(ownerKey) ?? [];
          bucket.push(record);
          recordsByOwnerKey.set(ownerKey, bucket);
        }
        for (const [ownerKey, ownerRecords] of recordsByOwnerKey.entries()) {
          if (existingOwnerKeys.has(ownerKey)) {
            continue;
          }
          if ((nextIds ?? currentTable.ids).length + ownerRecords.length > LocalActivityMembersRepository.MAX_BOOTSTRAP_RECORDS) {
            return;
          }
          if (!changed) {
            nextById = { ...currentTable.byId };
            nextIds = [...currentTable.ids];
            nextIdsByOwnerKey = this.cloneOwnerKeyIndex(currentTable.idsByOwnerKey);
            changed = true;
          }
          const ownerBucket = nextIdsByOwnerKey![ownerKey] ?? [];
          for (const record of ownerRecords) {
            nextById![record.id] = { ...record };
            nextIds!.push(record.id);
            ownerBucket.push(record.id);
          }
          nextIdsByOwnerKey![ownerKey] = ownerBucket;
          existingOwnerKeys.add(ownerKey);
        }
      };

      appendSeededRecords(this.buildSeededEventOwnerRecords(existingOwnerKeys));
      appendSeededRecords(this.buildSeededInvitationOwnerRecords(existingOwnerKeys));
      appendSeededRecords(this.buildSeededHomeSocialBridgeRecords(existingOwnerKeys));
      for (const userId of normalizedOwnerUserIds) {
        appendSeededRecords(this.buildSeededAssetOwnerRecordsForUser(
          userId,
          existingOwnerKeys,
          assetsByUserId?.get(userId)
        ));
      }
      appendSeededRecords(this.buildSeededSubEventAndGroupOwnerRecords(existingOwnerKeys));

      if (changed) {
        this.memoryDb.write(state => ({
          ...state,
          [ACTIVITY_MEMBERS_TABLE_NAME]: {
            byId: nextById!,
            ids: nextIds!,
            idsByOwnerKey: nextIdsByOwnerKey!
          }
        }));
      }

      const batchState = this.memoryDb.read();
      let activityMembersTable = this.normalizeCollection(batchState[ACTIVITY_MEMBERS_TABLE_NAME]);
      
      if (currentTable.ids.length > 0) {
        this.batchRefreshInvalidSeededRecordOwners(activityMembersTable);
      }
      
      this.syncEventSummariesFromMembers();
      
      const finalTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
      this.refreshGameSocialCardsCache(finalTable);
      this.lastInitToken = `${eventsTable.ids.length}:${finalTable.ids.length}:${Object.keys(finalTable.idsByOwnerKey).length}:${normalizedOwnerUserIds.join('|')}`;
    } finally {
      this.localActivityMemberUsersSnapshot = null;
      this.preferredEventRecordsSnapshot = null;
      this.invitationPreviewRecordsSnapshot = null;
      this.eventCapacitySnapshotByEventId = null;
      this.seededSubEventsSnapshotByEventId.clear();
    }
  }

  override peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    return this.readMembersByOwner(owner);
  }

  override async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    return this.readMembersByOwner(owner);
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
      if (!LocalUserSeedBuilder.isPublicGameProfile(usersById.get(activeUserId))) {
        continue;
      }
      const activeNeighbors = [...(graph.neighborsByUserId.get(activeUserId) ?? new Set<string>())]
        .filter(userId => userId !== activeUserId)
        .filter(userId => LocalUserSeedBuilder.isInsideNetworkGameProfile(usersById.get(userId)))
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
          || !LocalUserSeedBuilder.isPublicGameProfile(usersById.get(candidateUserId))
        ) {
          continue;
        }
        const candidateNeighbors = graph.neighborsByUserId.get(candidateUserId) ?? new Set<string>();
        const bridgeUserIds = activeNeighbors
          .filter(bridgeUserId => candidateNeighbors.has(bridgeUserId))
          .filter(bridgeUserId => LocalUserSeedBuilder.isInsideNetworkGameProfile(usersById.get(bridgeUserId)))
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

  override peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    return this.readSummaryByOwner(owner);
  }

  override async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    return this.normalizeOwners(owners)
      .map(owner => this.readSummaryByOwner(owner))
      .filter((summary): summary is ActivityMembersSummary => Boolean(summary));
  }

  override async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null,
    actorUserId = ''
  ): Promise<void> {
    void actorUserId;
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    const summary = this.writeOwnerMembers(normalizedOwner, members, capacityTotal, true);
    this.cacheMembers(normalizedOwner, members, summary.capacityTotal);
  }

  override async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'disqualify' | 'reinstate',
    reason?: string | null
  ): Promise<AppTypes.ActivityMemberEntry[]> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedOwner || !normalizedTargetUserId) {
      return normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [];
    }
    const previousMembers = this.readMembersByOwner(normalizedOwner);
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const nextMembers = previousMembers.map(member => {
      if (member.userId !== normalizedTargetUserId) {
        return member;
      }
      if (action === 'disqualify' && member.status === 'accepted') {
        return {
          ...member,
          status: 'disqualified' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'reinstate' && member.status === 'disqualified') {
        return {
          ...member,
          status: 'accepted' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      return member;
    });
    const changed = nextMembers.some((member, index) => member.status !== previousMembers[index]?.status);
    if (!changed) {
      return this.cloneEntries(previousMembers);
    }
    const summary = this.writeOwnerMembers(normalizedOwner, nextMembers, undefined, true);
    this.cacheMembers(normalizedOwner, nextMembers, summary.capacityTotal);
    return this.cloneEntries(nextMembers);
  }

  private readMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record))
      .map(record => this.toMemberEntry(record))
      .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));
  }

  private get localActivityMemberUsers(): UserDto[] {
    return this.localActivityMemberUsersSnapshot
      ?? (this.localUsersRepository.queryAllUsers() as UserDto[])
        .filter(user => !LocalUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));
  }

  private readSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const members = this.readMembersByOwner(normalizedOwner);
    const acceptedMembers = members.filter(member => member.status === 'accepted').length;
    const capacityTotal = this.resolveOwnerCapacityTotal(normalizedOwner, acceptedMembers);
    return this.buildSummary(normalizedOwner, members, capacityTotal);
  }

  private writeOwnerMembers(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null,
    syncUserIds = true
  ): ActivityMembersSummary {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return this.buildSummary({ ownerType: 'event', ownerId: '' }, [], 0);
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const normalizedMembers = this.cloneEntries(members);
    const summary = this.buildSummary(
      normalizedOwner,
      normalizedMembers,
      capacityTotal ?? this.readSummaryByOwner(normalizedOwner)?.capacityTotal ?? null
    );

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
      const nextById = { ...table.byId };
      const nextIds: string[] = [];
      const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(table.idsByOwnerKey);
      const existingOwnerRecordsById: Record<string, ActivityMemberRecord> = {};

      for (const id of table.ids) {
        const current = table.byId[id];
        if (current?.ownerKey === ownerKey) {
          existingOwnerRecordsById[id] = current;
          delete nextById[id];
          continue;
        }
        nextIds.push(id);
      }

      delete nextIdsByOwnerKey[ownerKey];

      for (const member of normalizedMembers) {
        const record = this.toRecord(normalizedOwner, member, existingOwnerRecordsById[member.id]);
        nextById[record.id] = record;
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

    return summary;
  }

  private syncEventSummariesFromMembers(): void {
    const state = this.memoryDb.read();
    const table = this.normalizeCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
    const eventTable = state[EVENTS_TABLE_NAME];
    
    const eventIds = Object.keys(table.idsByOwnerKey)
      .filter(ownerKey => ownerKey.startsWith('event:'))
      .map(ownerKey => ownerKey.slice('event:'.length))
      .filter(eventId => eventId.length > 0);

    const summariesByEventId = new Map<string, ActivityMembersSummary>();
    for (const eventId of eventIds) {
      const owner: ActivityMemberOwnerRef = { ownerType: 'event', ownerId: eventId };
      const members = (table.idsByOwnerKey[this.ownerKey(owner)] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is ActivityMemberRecord => Boolean(record))
        .map(record => this.toMemberEntry(record))
        .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));
      
      const acceptedMembers = members.filter(member => member.status === 'accepted').length;
      const capacityTotal = this.resolveOwnerCapacityTotal(owner, acceptedMembers);
          
      summariesByEventId.set(eventId, this.buildSummary(owner, members, capacityTotal));
    }

    if (summariesByEventId.size > 0) {
      this.memoryDb.write(currentState => {
        const currentEventTable = currentState[EVENTS_TABLE_NAME];
        const nextById = { ...currentEventTable.byId };
        let changed = false;

        for (const id of currentEventTable.ids) {
          const current = currentEventTable.byId[id];
          if (!current || !summariesByEventId.has(current.id)) {
            continue;
          }
          const summary = summariesByEventId.get(current.id)!;
          
          // Check if sync actually needed
          if (current.acceptedMembers === summary.acceptedMembers && 
              current.pendingMembers === summary.pendingMembers &&
              current.capacityTotal === Math.max(summary.acceptedMembers, summary.capacityTotal)) {
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

        if (!changed) return currentState;

        return {
          ...currentState,
          [EVENTS_TABLE_NAME]: {
            byId: nextById,
            ids: [...currentEventTable.ids]
          }
        };
      });
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

  private buildSeededEventOwnerRecords(existingOwnerKeys: ReadonlySet<string> = new Set()): ActivityMemberRecord[] {
    const records: ActivityMemberRecord[] = [];
    for (const eventRecord of this.preferredEventRecords()) {
      const ownerKey = this.ownerKey({
        ownerType: 'event',
        ownerId: eventRecord.id
      });
      if (existingOwnerKeys.has(ownerKey)) {
        continue;
      }
      records.push(...this.buildSeededRecordsForEvent(eventRecord));
    }
    return records;
  }

  private buildSeededInvitationOwnerRecords(existingOwnerKeys: ReadonlySet<string> = new Set()): ActivityMemberRecord[] {
    const records: ActivityMemberRecord[] = [];
    for (const invitationRecord of this.invitationPreviewRecords()) {
      const ownerKey = this.ownerKey({
        ownerType: 'event',
        ownerId: invitationRecord.id
      });
      if (existingOwnerKeys.has(ownerKey)) {
        continue;
      }
      records.push(...this.buildSeededRecordsForInvitation(invitationRecord));
    }
    return records;
  }

  private buildSeededHomeSocialBridgeRecords(existingOwnerKeys: ReadonlySet<string> = new Set()): ActivityMemberRecord[] {
    const seedGroups: Array<{ ownerId: string; metWhere: string; userIds: [string, string] }> = [
      { ownerId: 'demo-home-fic-u1-bridge', metWhere: 'Coffee Social Bridge', userIds: ['u1', 'u2'] },
      { ownerId: 'demo-home-fic-u1-candidate', metWhere: 'Coffee Social Bridge', userIds: ['u2', 'u42'] },
      { ownerId: 'demo-home-fic-u4-bridge', metWhere: 'Workshop Social Bridge', userIds: ['u4', 'u3'] },
      { ownerId: 'demo-home-fic-u4-candidate', metWhere: 'Workshop Social Bridge', userIds: ['u3', 'u43'] },
      { ownerId: 'demo-home-fic-u6-bridge', metWhere: 'Gallery Social Bridge', userIds: ['u6', 'u8'] },
      { ownerId: 'demo-home-fic-u6-candidate', metWhere: 'Gallery Social Bridge', userIds: ['u8', 'u46'] }
    ];
    const records: ActivityMemberRecord[] = [];
    for (const group of seedGroups) {
      const owner: ActivityMemberOwnerRef = { ownerType: 'group', ownerId: group.ownerId };
      if (existingOwnerKeys.has(this.ownerKey(owner))) {
        continue;
      }
      for (const userId of group.userIds) {
        records.push(this.toRecord(owner, this.buildSeededHomeSocialBridgeEntry(userId, group.ownerId, group.metWhere)));
      }
    }
    return records;
  }

  private buildSeededHomeSocialBridgeEntry(userId: string, ownerId: string, metWhere: string): AppTypes.ActivityMemberEntry {
    const user = this.resolveDemoUser(userId);
    const metAtIso = LocalSeedScheduleBuilder.rebaseDateTime('2026-03-22T18:00:00.000Z') ?? '2026-03-22T18:00:00.000Z';
    return {
      id: `home-fic-seed:${ownerId}:${user.id}`.toLowerCase().replace(/[^a-z0-9:-]+/g, '-'),
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: 'Met at event.',
      role: 'Member',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByActiveUser: false,
      invitedByUserId: null,
      metAtIso,
      actionAtIso: metAtIso,
      metWhere,
      avatarUrl: user.images?.[0] ?? '',
      profile: user
    };
  }

  private batchRefreshInvalidSeededRecordOwners(table: ActivityMembersRecordCollection): void {
    const updates: Array<{ owner: ActivityMemberOwnerRef; members: AppTypes.ActivityMemberEntry[]; capacityTotal: number | null }> = [];

    for (const eventRecord of this.preferredEventRecords()) {
      const owner: ActivityMemberOwnerRef = {
        ownerType: 'event',
        ownerId: eventRecord.id
      };
      const ownerKey = this.ownerKey(owner);
      const currentMembers = (table.idsByOwnerKey[ownerKey] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is ActivityMemberRecord => Boolean(record))
        .map(record => this.toMemberEntry(record))
        .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));

      if (!this.shouldRefreshSeededEventOwner(eventRecord, currentMembers)) {
        continue;
      }

      const nextMembers = this.buildSeededRecordsForEvent(eventRecord).map(record => this.toMemberEntry(record));
      updates.push({ owner, members: nextMembers, capacityTotal: eventRecord.capacityTotal });
    }

    for (const invitationRecord of this.invitationPreviewRecords()) {
      const owner: ActivityMemberOwnerRef = {
        ownerType: 'event',
        ownerId: invitationRecord.id
      };
      const ownerKey = this.ownerKey(owner);
      const currentMembers = (table.idsByOwnerKey[ownerKey] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is ActivityMemberRecord => Boolean(record))
        .map(record => this.toMemberEntry(record))
        .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));

      if (!this.shouldRefreshSeededEventOwner(invitationRecord, currentMembers)) {
        continue;
      }

      const nextMembers = this.buildSeededRecordsForInvitation(invitationRecord).map(record => this.toMemberEntry(record));
      updates.push({ owner, members: nextMembers, capacityTotal: invitationRecord.capacityTotal });
    }

    if (updates.length > 0) {
      this.memoryDb.write(currentState => {
        let nextTable = this.normalizeCollection(currentState[ACTIVITY_MEMBERS_TABLE_NAME]);
        let nextById = { ...nextTable.byId };
        let nextIds = [...nextTable.ids];
        let nextIdsByOwnerKey = this.cloneOwnerKeyIndex(nextTable.idsByOwnerKey);

        for (const update of updates) {
          const ownerKey = this.ownerKey(update.owner);
          const existingOwnerRecordsById: Record<string, ActivityMemberRecord> = {};
          
          const filteredIds: string[] = [];
          for (const id of nextIds) {
            const current = nextById[id];
            if (current?.ownerKey === ownerKey) {
              existingOwnerRecordsById[id] = current;
              delete nextById[id];
              continue;
            }
            filteredIds.push(id);
          }
          nextIds = filteredIds;
          delete nextIdsByOwnerKey[ownerKey];

          for (const member of update.members) {
            const record = this.toRecord(update.owner, member, existingOwnerRecordsById[member.id]);
            nextById[record.id] = record;
            nextIds.push(record.id);
            const ownerBucket = nextIdsByOwnerKey[ownerKey] ?? [];
            ownerBucket.push(record.id);
            nextIdsByOwnerKey[ownerKey] = ownerBucket;
          }
          
          this.ownerCapacityByKey.set(ownerKey, update.capacityTotal ?? 0);
        }

        return {
          ...currentState,
          [ACTIVITY_MEMBERS_TABLE_NAME]: {
            byId: nextById,
            ids: nextIds,
            idsByOwnerKey: nextIdsByOwnerKey
          }
        };
      });
    }
  }

  private shouldRefreshSeededEventOwner(
    record: ActivityEventRecord,
    currentMembers: readonly AppTypes.ActivityMemberEntry[]
  ): boolean {
    const expectedAcceptedCount = Math.max(0, this.normalizeMemberCount(record.acceptedMembers) ?? 0);
    const expectedPendingCount = Math.max(0, this.normalizeMemberCount(record.pendingMembers) ?? 0);
    const actualAcceptedCount = currentMembers.filter(member => member.status === 'accepted').length;
    const actualPendingCount = currentMembers.filter(member => member.status === 'pending').length;
    return actualAcceptedCount !== expectedAcceptedCount || actualPendingCount !== expectedPendingCount;
  }

  private preferredEventRecords(): ActivityEventRecord[] {
    return this.preferredEventRecordsSnapshot
      ?? this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
  }

  private invitationPreviewRecords(): ActivityEventRecord[] {
    return this.invitationPreviewRecordsSnapshot
      ?? this.computeInvitationPreviewRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
  }

  private computePreferredEventRecords(table: ActivityEventRecordCollection): ActivityEventRecord[] {
    const preferredRecordByEventId = new Map<string, ActivityEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.isInvitation) {
        continue;
      }
      const current = preferredRecordByEventId.get(record.id);
      if (!current || this.shouldPreferRecord(record, current)) {
        preferredRecordByEventId.set(record.id, record);
      }
    }

    return [...preferredRecordByEventId.values()];
  }

  private computeInvitationPreviewRecords(table: ActivityEventRecordCollection): ActivityEventRecord[] {
    const preferredRecordByInvitationId = new Map<string, ActivityEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || !record.isInvitation) {
        continue;
      }
      const current = preferredRecordByInvitationId.get(record.id);
      if (!current || this.shouldPreferRecord(record, current)) {
        preferredRecordByInvitationId.set(record.id, record);
      }
    }

    return [...preferredRecordByInvitationId.values()];
  }

  private buildEventCapacitySnapshot(
    table: ActivityEventRecordCollection
  ): Map<string, { acceptedMembers: number | null; capacityTotal: number | null }> {
    const next = new Map<string, { acceptedMembers: number | null; capacityTotal: number | null }>();

    for (const id of table.ids) {
      const record = table.byId[id];
      const eventId = record?.id?.trim() ?? '';
      if (!record || !eventId) {
        continue;
      }
      const current = next.get(eventId);
      const acceptedMembers = this.normalizeMemberCount(record.acceptedMembers);
      const capacityTotal = this.normalizeMemberCount(record.capacityTotal);
      next.set(eventId, {
        acceptedMembers: current
          ? this.maxNullableCount(current.acceptedMembers, acceptedMembers)
          : acceptedMembers,
        capacityTotal: current
          ? this.maxNullableCount(current.capacityTotal, capacityTotal)
          : capacityTotal
      });
    }

    return next;
  }

  private findPreferredEventRecord(eventId: string): ActivityEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.preferredEventRecords().find(record => record.id === normalizedEventId) ?? null;
  }

  private findInvitationPreviewRecord(ownerId: string): ActivityEventRecord | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    return this.invitationPreviewRecords().find(record => record.id === normalizedOwnerId) ?? null;
  }

  private buildSeededAssetOwnerRecordsForUser(
    userId: string,
    existingOwnerKeys: ReadonlySet<string> = new Set(),
    seedAssets?: readonly AppTypes.AssetCard[]
  ): ActivityMemberRecord[] {
    const nextRecords: ActivityMemberRecord[] = [];
    for (const asset of (seedAssets ?? this.localAssetsRepository.peekOwnedAssetsByUser(userId)).slice(
      0,
      LocalActivityMembersRepository.MAX_SEEDED_ASSETS_PER_USER
    )) {
      const owner: ActivityMemberOwnerRef = {
        ownerType: 'asset',
        ownerId: asset.id
      };
      const ownerKey = this.ownerKey(owner);
      if (existingOwnerKeys.has(ownerKey)) {
        continue;
      }
      for (const member of this.buildSeededEntriesForAsset(userId, asset)) {
        nextRecords.push(this.toRecord(owner, member));
      }
    }
    return nextRecords;
  }

  private buildSeededSubEventAndGroupOwnerRecords(
    existingOwnerKeys: ReadonlySet<string> = new Set()
  ): ActivityMemberRecord[] {
    const nextRecords: ActivityMemberRecord[] = [];
    const seenOwnerKeys = new Set<string>(existingOwnerKeys);
    const appendMembersForOwner = (
      owner: ActivityMemberOwnerRef,
      members: readonly AppTypes.ActivityMemberEntry[]
    ): void => {
      if (members.length === 0) {
        return;
      }
      for (const member of members) {
        nextRecords.push(this.toRecord(owner, member));
      }
    };

    let parentEventCount = 0;
    for (const record of this.preferredEventRecords()) {
      if (parentEventCount >= LocalActivityMembersRepository.MAX_SEEDED_SUB_EVENT_PARENT_EVENTS) {
        break;
      }
      const seededSubEvents = this.seededSubEventsForEvent(record).slice(
        0,
        LocalActivityMembersRepository.MAX_SEEDED_SUB_EVENTS_PER_EVENT
      );
      if (seededSubEvents.length === 0) {
        continue;
      }
      parentEventCount += 1;
      for (const subEvent of seededSubEvents) {
        const subEventOwner: ActivityMemberOwnerRef = {
          ownerType: 'subEvent',
          ownerId: subEvent.id
        };
        const subEventOwnerKey = this.ownerKey(subEventOwner);
        if (!seenOwnerKeys.has(subEventOwnerKey)) {
          const seededSubEvent = this.buildSeededSubEventOwnerSeed(record, subEvent);
          appendMembersForOwner(subEventOwner, seededSubEvent.members);
          seenOwnerKeys.add(subEventOwnerKey);
        }

        for (const group of (subEvent.groups ?? []).slice(
          0,
          LocalActivityMembersRepository.MAX_SEEDED_GROUPS_PER_SUB_EVENT
        )) {
          const groupOwner: ActivityMemberOwnerRef = {
            ownerType: 'group',
            ownerId: group.id
          };
          const groupOwnerKey = this.ownerKey(groupOwner);
          if (seenOwnerKeys.has(groupOwnerKey)) {
            continue;
          }
          const seededGroup = this.buildSeededGroupOwnerSeed(record, subEvent, group);
          appendMembersForOwner(groupOwner, seededGroup.members);
          seenOwnerKeys.add(groupOwnerKey);
        }
      }
    }

    return nextRecords;
  }

  private collectSourceRecordsForUser(userId: string): ActivityEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const seenIds = new Set<string>();
    const nextRecords: ActivityEventRecord[] = [];

    for (const record of [
      ...this.localEventsRepository.queryItemsByUser(normalizedUserId),
      ...this.localEventsRepository.queryExploreItems(normalizedUserId)
    ]) {
      if (!record.id || seenIds.has(record.id)) {
        continue;
      }
      seenIds.add(record.id);
      nextRecords.push(record);
    }

    return nextRecords;
  }

  private findSeededAssetOwner(ownerId: string): { ownerUserId: string; asset: AppTypes.AssetCard } | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }

    const ownerHint = normalizedOwnerId.split(':')[0]?.trim() ?? '';
    if (ownerHint) {
      const ownedAsset = this.localAssetsRepository.peekOwnedAssetsByUser(ownerHint).find(asset => asset.id === normalizedOwnerId);
      if (ownedAsset) {
        return {
          ownerUserId: ownerHint,
          asset: ownedAsset
        };
      }
    }

    for (const user of this.localUsersRepository.queryAvailableDemoUsers().filter(item => !LocalUserSeedBuilder.isEmptyOnboardingProfileUserId(item.id))) {
      const ownedAsset = this.localAssetsRepository.peekOwnedAssetsByUser(user.id).find(asset => asset.id === normalizedOwnerId);
      if (ownedAsset) {
        return {
          ownerUserId: user.id,
          asset: ownedAsset
        };
      }
    }

    return null;
  }

  private buildSeededEntriesForAsset(ownerUserId: string, asset: AppTypes.AssetCard): AppTypes.ActivityMemberEntry[] {
    const requests = asset.requests.length > 0
      ? [...asset.requests]
      : this.buildFallbackAssetRequests(ownerUserId, asset);
    const seedBaseDate = LocalSeedScheduleBuilder.shiftDate(new Date('2026-02-24T12:00:00.000Z'));
    const owner = this.resolveDemoUser(ownerUserId, asset.ownerName?.trim() || 'Asset owner', '', asset.city);
    const ownerEntry: AppTypes.ActivityMemberEntry = {
      id: `${asset.id}:owner`,
      userId: owner.id,
      name: owner.name,
      initials: owner.initials,
      gender: owner.gender,
      city: owner.city || asset.city,
      statusText: 'Responsible manager for this asset.',
      role: 'Manager',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByActiveUser: false,
      metAtIso: asset.ownerUserId === owner.id ? (asset as { updatedAtIso?: string }).updatedAtIso ?? seedBaseDate.toISOString() : seedBaseDate.toISOString(),
      actionAtIso: asset.ownerUserId === owner.id ? (asset as { updatedAtIso?: string }).updatedAtIso ?? seedBaseDate.toISOString() : seedBaseDate.toISOString(),
      metWhere: asset.title,
      avatarUrl: AppUtils.firstImageUrl(owner.images),
      profile: owner
    };
    const requestEntries = requests
      .slice(0, LocalActivityMembersRepository.MAX_SEEDED_ASSET_REQUESTS_PER_OWNER)
      .map((request, index): AppTypes.ActivityMemberEntry => {
        const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.localActivityMemberUsers);
        const matchedUser = this.localActivityMemberUsers.find(user => user.id === requestUserId)
          ?? AppUtils.findUserByName(this.localActivityMemberUsers, request.name)
          ?? this.resolveDemoUser(requestUserId, request.name, request.initials, asset.city, request.gender);
        const seed = AppUtils.hashText(`asset-members:${asset.id}:${request.id}:${matchedUser.id}:${index}`);
        const actionAtIso = AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -((seed % 90) + 1)));
        const status: AppTypes.ActivityMemberStatus = request.status === 'pending' ? 'pending' : 'accepted';
        return {
          id: request.id?.trim() || `${asset.id}:member:${index + 1}`,
          userId: matchedUser.id,
          name: request.name,
          initials: request.initials,
          gender: request.gender,
          city: matchedUser.city || asset.city,
          statusText: request.note?.trim() || (status === 'pending' ? 'Waiting for owner confirmation.' : 'Accepted for this asset.'),
          role: status === 'accepted' && index === 1 ? 'Manager' : 'Member',
          status,
          pendingSource: status === 'pending' ? 'admin' : null,
          requestKind: status === 'pending' ? 'invite' : null,
          invitedByActiveUser: false,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: asset.title,
          avatarUrl: AppUtils.firstImageUrl(matchedUser.images),
          profile: matchedUser
        };
      })
      .sort((left, right) => AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso));
    return [ownerEntry, ...requestEntries];
  }

  private buildFallbackAssetRequests(ownerUserId: string, asset: AppTypes.AssetCard): AppTypes.AssetMemberRequest[] {
    const fallbackUsers = LocalUserSeedBuilder.friendUsersForActiveUser(this.localActivityMemberUsers, ownerUserId, 4);
    const requestUsers = fallbackUsers.length > 0
      ? fallbackUsers
      : this.localActivityMemberUsers.filter(user => user.id !== ownerUserId).slice(0, 2);
    return requestUsers.slice(0, 2).map((user, index) => ({
      id: `${asset.id}:request:${index + 1}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status: index === 0 ? 'pending' : 'accepted',
      note: index === 0 ? 'Waiting for owner confirmation.' : 'Accepted for this asset.'
    }));
  }

  private findSeededSubEventOwner(ownerId: string): { record: ActivityEventRecord; subEvent: AppTypes.SubEventFormItem } | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    for (const record of this.preferredEventRecords()) {
      for (const subEvent of this.seededSubEventsForEvent(record)) {
        if (subEvent.id === normalizedOwnerId) {
          return { record, subEvent };
        }
      }
    }
    return null;
  }

  private findSeededGroupOwner(ownerId: string): { record: ActivityEventRecord; subEvent: AppTypes.SubEventFormItem; group: AppTypes.SubEventGroupItem } | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    for (const record of this.preferredEventRecords()) {
      for (const subEvent of this.seededSubEventsForEvent(record)) {
        for (const group of subEvent.groups ?? []) {
          if (group.id === normalizedOwnerId) {
            return { record, subEvent, group };
          }
        }
      }
    }
    return null;
  }

  private buildSeededSubEventOwnerSeed(
    record: ActivityEventRecord,
    subEvent: AppTypes.SubEventFormItem
  ): { members: AppTypes.ActivityMemberEntry[]; capacityTotal: number } {
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const row = this.buildDerivedActivityRow(
      record,
      subEvent.id,
      subEvent.name,
      record.title,
      subEvent.description?.trim() || record.subtitle,
      subEvent.startAt || record.startAtIso
    );
    const entryContext = this.buildEntryContext(row, creator);
    const acceptedTarget = Math.max(1, this.normalizeMemberCount(subEvent.membersAccepted) ?? 0);
    const pendingTarget = Math.max(1, this.normalizeMemberCount(subEvent.membersPending) ?? 0);
    const owner: ActivityMemberOwnerRef = {
      ownerType: 'subEvent',
      ownerId: subEvent.id
    };
    const members = this.buildEntriesFromUserIds(owner, entryContext, undefined, undefined, acceptedTarget, pendingTarget);
    const capacityTotal = Math.max(
      acceptedTarget,
      pendingTarget + acceptedTarget,
      this.normalizeMemberCount(subEvent.capacityMax) ?? 0
    );
    return {
      members,
      capacityTotal
    };
  }

  private buildSeededGroupOwnerSeed(
    record: ActivityEventRecord,
    subEvent: AppTypes.SubEventFormItem,
    group: AppTypes.SubEventGroupItem
  ): { members: AppTypes.ActivityMemberEntry[]; capacityTotal: number } {
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const capacityMin = this.normalizeMemberCount(group.capacityMin) ?? 0;
    const capacityMax = Math.max(capacityMin, this.normalizeMemberCount(group.capacityMax) ?? capacityMin);
    const acceptedTarget = capacityMax > 0
      ? Math.max(1, Math.min(capacityMax, Math.max(capacityMin, Math.floor(capacityMax * 0.6))))
      : 0;
    const pendingTarget = capacityMax > acceptedTarget
      ? Math.max(1, Math.min(capacityMax - acceptedTarget, Math.ceil(capacityMax * 0.25)))
      : 0;
    const row = this.buildDerivedActivityRow(
      record,
      group.id,
      group.name,
      `${record.title} · ${subEvent.name}`,
      'Group members',
      subEvent.startAt || record.startAtIso
    );
    const entryContext = this.buildEntryContext(row, creator);
    const owner: ActivityMemberOwnerRef = {
      ownerType: 'group',
      ownerId: group.id
    };
    const members = this.buildEntriesFromUserIds(owner, entryContext, undefined, undefined, acceptedTarget, pendingTarget);
    return {
      members,
      capacityTotal: Math.max(acceptedTarget + pendingTarget, capacityMax)
    };
  }

  private seededSubEventsForEvent(record: ActivityEventRecord): AppTypes.SubEventFormItem[] {
    const normalizedEventId = record.id.trim();
    const cached = normalizedEventId
      ? this.seededSubEventsSnapshotByEventId.get(normalizedEventId)
      : null;
    if (cached) {
      return cached;
    }

    let nextSubEvents: AppTypes.SubEventFormItem[];
    if ((record.subEvents?.length ?? 0) > 0) {
      nextSubEvents = record.subEvents!.map(item => ({
        ...item,
        groups: (item.groups ?? []).map(group => ({ ...group }))
      }));
    } else {
      const source = {
        id: record.id,
        title: record.title,
        shortDescription: record.subtitle
      } as ActivityEventSeedItem | ActivityHostingSeedItem;
      const capacityMax = Math.max(
        this.normalizeMemberCount(record.capacityMax) ?? 0,
        this.normalizeMemberCount(record.capacityTotal) ?? 0,
        this.normalizeMemberCount(record.acceptedMembers) ?? 0
      );

      nextSubEvents = LocalEventSeedBuilder.buildSeededSubEventsForEvent(source, {
        isHosting: record.type === 'hosting',
        activityDateTimeRangeById: {
          [record.id]: {
            startIso: record.startAtIso,
            endIso: record.endAtIso
          }
        },
        hostingDatesById: {
          [record.id]: record.startAtIso
        },
        eventDatesById: {
          [record.id]: record.startAtIso
        },
        eventCapacityById: {
          [record.id]: {
            min: Math.max(0, this.normalizeMemberCount(record.capacityMin) ?? 0),
            max: Math.max(1, capacityMax)
          }
        },
        activityCapacityById: {
          [record.id]: `${Math.max(0, this.normalizeMemberCount(record.acceptedMembers) ?? 0)} / ${Math.max(1, this.normalizeMemberCount(record.capacityTotal) ?? capacityMax)}`
        },
        defaultStartIso: record.startAtIso,
        activeUserId: record.creatorUserId
      });
    }

    if (normalizedEventId) {
      this.seededSubEventsSnapshotByEventId.set(normalizedEventId, nextSubEvents);
    }
    return nextSubEvents;
  }

  private buildDerivedActivityRow(
    record: ActivityEventRecord,
    ownerId: string,
    title: string,
    subtitle: string,
    detail: string,
    dateIso: string
  ): AppTypes.ActivityListRow {
    const baseRow = this.buildActivityRowFromEventRecord(record);
    return {
      ...baseRow,
      id: ownerId,
      title,
      subtitle,
      detail,
      dateIso,
      startAt: dateIso
    };
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

  private shouldPreferRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    if (next.isAdmin !== current.isAdmin) {
      return next.isAdmin;
    }
    return next.acceptedMembers >= current.acceptedMembers;
  }

  private seedMemberUserIdsForEventRecord(record: ActivityEventRecord): {
    acceptedMemberUserIds: string[];
    pendingMemberUserIds: string[];
  } {
    const acceptedTarget = Math.max(0, this.normalizeMemberCount(record.acceptedMembers) ?? 0);
    const pendingTarget = Math.max(0, this.normalizeMemberCount(record.pendingMembers) ?? 0);
    const ownerUserId = record.userId.trim();
    const explicit = this.explicitSeedMemberUserIdsForEventId(record.id);
    const seedActiveUserId = record.isInvitation
      ? record.creatorUserId || ownerUserId
      : ownerUserId || record.creatorUserId;
    const seededMemberUserIds = LocalEventSeedBuilder.seededEventMemberIds(
      record.id,
      Math.max(acceptedTarget + pendingTarget, acceptedTarget, 1),
      this.localActivityMemberUsers,
      seedActiveUserId
    );
    const usedUserIds = new Set<string>();
    const explicitAcceptedUserIds = explicit ? this.normalizeMemberUserIds(explicit.accepted) : [];
    const explicitPendingUserIds = explicit
      ? this.normalizeMemberUserIds(explicit.pending).filter(userId => !explicitAcceptedUserIds.includes(userId))
      : [];

    const acceptedSource = explicit
      ? [
          ...(!record.isInvitation
            && record.type === 'events'
            && ownerUserId
            && !explicitPendingUserIds.includes(ownerUserId)
            && !explicitAcceptedUserIds.includes(ownerUserId)
              ? [ownerUserId]
              : []),
          ...explicitAcceptedUserIds
        ]
      : this.normalizeMemberUserIds(seededMemberUserIds)
          .filter(userId => !record.isInvitation || userId !== ownerUserId);

    const acceptedMemberUserIds = this.collectTargetMemberUserIds(
      acceptedSource,
      seededMemberUserIds,
      acceptedTarget,
      usedUserIds
    );

    const pendingSource = explicit
      ? [
          ...(record.isInvitation && ownerUserId && !explicitPendingUserIds.includes(ownerUserId)
            ? [ownerUserId]
            : []),
          ...explicitPendingUserIds
        ]
      : [
          ...(record.isInvitation && ownerUserId ? [ownerUserId] : []),
          ...seededMemberUserIds
        ];

    const pendingMemberUserIds = this.collectTargetMemberUserIds(
      pendingSource,
      seededMemberUserIds,
      pendingTarget,
      usedUserIds
    );

    return {
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
  }

  private collectTargetMemberUserIds(
    sourceUserIds: readonly string[],
    fallbackUserIds: readonly string[],
    target: number,
    usedUserIds: Set<string>
  ): string[] {
    const next: string[] = [];
    for (const userId of this.normalizeMemberUserIds([...sourceUserIds, ...fallbackUserIds])) {
      if (next.length >= target) {
        break;
      }
      if (usedUserIds.has(userId)) {
        continue;
      }
      next.push(userId);
      usedUserIds.add(userId);
    }
    return next;
  }

  private explicitSeedMemberUserIdsForEventId(eventId: string): ExplicitSeedMemberUserIds | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.explicitSeedMemberUserIdsByEventIdMap().get(normalizedEventId) ?? null;
  }

  private explicitSeedMemberUserIdsByEventIdMap(): Map<string, ExplicitSeedMemberUserIds> {
    if (this.explicitSeedMemberUserIdsByEventId) {
      return this.explicitSeedMemberUserIdsByEventId;
    }

    const next = new Map<string, ExplicitSeedMemberUserIds>();
    const absorb = (item: {
      id?: string;
      acceptedMemberUserIds?: readonly string[];
      pendingMemberUserIds?: readonly string[];
    }): void => {
      const eventId = `${item.id ?? ''}`.trim();
      if (!eventId) {
        return;
      }
      const accepted = this.normalizeMemberUserIds(item.acceptedMemberUserIds);
      const pending = this.normalizeMemberUserIds(item.pendingMemberUserIds)
        .filter(userId => !accepted.includes(userId));
      if (accepted.length === 0 && pending.length === 0) {
        return;
      }
      const current = next.get(eventId) ?? { accepted: [], pending: [] };
      const mergedAccepted = this.normalizeMemberUserIds([...current.accepted, ...accepted]);
      const mergedPending = this.normalizeMemberUserIds([...current.pending, ...pending])
        .filter(userId => !mergedAccepted.includes(userId));
      next.set(eventId, {
        accepted: mergedAccepted,
        pending: mergedPending
      });
    };

    for (const items of Object.values(LocalEventsRepositoryBuilder.buildSeedInvitationItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }
    for (const items of Object.values(LocalEventsRepositoryBuilder.buildSeedEventItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }
    for (const items of Object.values(LocalEventsRepositoryBuilder.buildSeedHostingItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }

    this.explicitSeedMemberUserIdsByEventId = next;
    return next;
  }

  private buildSeededRecordsForEvent(record: ActivityEventRecord): ActivityMemberRecord[] {
    const owner: ActivityMemberOwnerRef = {
      ownerType: 'event',
      ownerId: record.id
    };
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const row = this.buildActivityRowFromEventRecord(record);
    const entryContext = this.buildEntryContext(row, creator);
    const {
      acceptedMemberUserIds,
      pendingMemberUserIds
    } = this.seedMemberUserIdsForEventRecord(record);
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      acceptedMemberUserIds,
      pendingMemberUserIds,
      acceptedMemberUserIds.length,
      pendingMemberUserIds.length,
      {
        allowAcceptedBackfill: false,
        allowPendingBackfill: false
      }
    );
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private buildSeededRecordsForInvitation(record: ActivityEventRecord): ActivityMemberRecord[] {
    const owner: ActivityMemberOwnerRef = {
      ownerType: 'event',
      ownerId: record.id
    };
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const row = this.buildActivityRowFromInvitationRecord(record);
    const entryContext = this.buildEntryContext(row, creator);
    const {
      acceptedMemberUserIds,
      pendingMemberUserIds
    } = this.seedMemberUserIdsForEventRecord(record);
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      acceptedMemberUserIds,
      pendingMemberUserIds,
      acceptedMemberUserIds.length,
      pendingMemberUserIds.length,
      {
        allowAcceptedBackfill: false,
        allowPendingBackfill: false
      }
    );
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private buildEntriesFromUserIds(
    owner: ActivityMemberOwnerRef,
    context: {
      row: AppTypes.ActivityListRow;
      rowKey: string;
      creator: UserDto;
      generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
      generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    },
    acceptedMemberUserIds: readonly string[] | undefined,
    pendingMemberUserIds: readonly string[] | undefined,
    acceptedTarget: number,
    pendingTarget: number,
    options: {
      allowAcceptedBackfill?: boolean;
      allowPendingBackfill?: boolean;
    } = {}
  ): AppTypes.ActivityMemberEntry[] {
    const allowAcceptedBackfill = options.allowAcceptedBackfill !== false;
    const allowPendingBackfill = options.allowPendingBackfill !== false;
    const usedUserIds = new Set<string>();
    const acceptedEntries: AppTypes.ActivityMemberEntry[] = [];
    const pendingEntries: AppTypes.ActivityMemberEntry[] = [];

    for (const userId of this.normalizeMemberUserIds(acceptedMemberUserIds)) {
      const entry = this.buildEntryForUserId(context, userId, 'accepted');
      if (usedUserIds.has(entry.userId)) {
        continue;
      }
      acceptedEntries.push(entry);
      usedUserIds.add(entry.userId);
    }

    if (allowAcceptedBackfill && acceptedEntries.length < acceptedTarget) {
      const forcedEntries = ActivityMembersBuilder.buildForcedAcceptedMembers(
        context.row,
        context.rowKey,
        Math.max(acceptedTarget, 1),
        this.localActivityMemberUsers,
        context.creator,
        APP_STATIC_DATA.activityMemberDefaults.forcedMetWhere
      );
      for (const entry of forcedEntries) {
        if (acceptedEntries.length >= acceptedTarget) {
          break;
        }
        if (usedUserIds.has(entry.userId)) {
          continue;
        }
        acceptedEntries.push({
          ...entry,
          role: entry.userId === context.creator.id ? 'Admin' : 'Member'
        });
        usedUserIds.add(entry.userId);
      }
    }

    for (const userId of this.normalizeMemberUserIds(pendingMemberUserIds)) {
      const entry = this.buildEntryForUserId(context, userId, 'pending');
      if (usedUserIds.has(entry.userId)) {
        continue;
      }
      pendingEntries.push(entry);
      usedUserIds.add(entry.userId);
    }

    if (allowPendingBackfill && pendingEntries.length < pendingTarget) {
      for (const entry of context.generatedPendingByUserId.values()) {
        if (pendingEntries.length >= pendingTarget) {
          break;
        }
        if (usedUserIds.has(entry.userId)) {
          continue;
        }
        pendingEntries.push({
          ...entry,
          role: entry.userId === context.creator.id ? 'Admin' : 'Member'
        });
        usedUserIds.add(entry.userId);
      }
    }

    if (allowPendingBackfill && pendingEntries.length < pendingTarget) {
      const prioritizedFallbackCandidates = [
        ...LocalUserSeedBuilder.friendUsersForActiveUser(this.localActivityMemberUsers, context.creator.id, Math.max(pendingTarget * 3, pendingTarget)),
        ...this.localActivityMemberUsers
      ].filter((user, index, arr) => arr.findIndex(candidate => candidate.id === user.id) === index)
        .filter(user => !usedUserIds.has(user.id));
      for (const user of prioritizedFallbackCandidates) {
        if (pendingEntries.length >= pendingTarget) {
          break;
        }
        const base = ActivityMembersBuilder.toActivityMemberEntry(
          user,
          context.row,
          context.rowKey,
          context.creator.id,
          {
            status: 'pending',
            pendingSource: 'admin',
            invitedByActiveUser: false
          },
          APP_STATIC_DATA.activityMemberMetPlaces
        );
        pendingEntries.push({
          ...base,
          role: user.id === context.creator.id ? 'Admin' : 'Member',
          requestKind: 'invite',
          statusText: 'Invitation pending.'
        });
        usedUserIds.add(user.id);
      }
    }

    return [...acceptedEntries, ...pendingEntries];
  }

  private buildEntryContext(row: AppTypes.ActivityListRow, creator: UserDto): {
    row: AppTypes.ActivityListRow;
    rowKey: string;
    creator: UserDto;
    generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
  } {
    const rowKey = `${row.type}:${row.id}`;
    const generated = ActivityMembersBuilder.generateActivityMembersForRow(
      row,
      rowKey,
      this.localActivityMemberUsers,
      creator,
      APP_STATIC_DATA.activityMemberMetPlaces
    );
    return {
      row,
      rowKey,
      creator,
      generatedAcceptedByUserId: new Map(
        generated
          .filter(entry => entry.status === 'accepted')
          .map(entry => [entry.userId, { ...entry, role: entry.userId === creator.id ? 'Admin' : 'Member' }])
      ),
      generatedPendingByUserId: new Map(
        generated
          .filter(entry => entry.status === 'pending')
          .map(entry => [entry.userId, { ...entry, role: entry.userId === creator.id ? 'Admin' : 'Member' }])
      )
    };
  }

  private buildEntryForUserId(
    context: {
      row: AppTypes.ActivityListRow;
      rowKey: string;
      creator: UserDto;
      generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
      generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    },
    userId: string,
    status: AppTypes.ActivityMemberStatus
  ): AppTypes.ActivityMemberEntry {
    const generated = status === 'accepted'
      ? context.generatedAcceptedByUserId.get(userId)
      : context.generatedPendingByUserId.get(userId);
    if (generated) {
      return {
        ...generated,
        status,
        pendingSource: status === 'accepted' ? null : generated.pendingSource ?? 'admin',
        requestKind: status === 'accepted' ? null : generated.requestKind ?? 'invite',
        role: userId === context.creator.id ? 'Admin' : 'Member'
      };
    }

    const user = this.resolveDemoUser(userId);
    const base = ActivityMembersBuilder.toActivityMemberEntry(
      user,
      context.row,
      context.rowKey,
      context.creator.id,
      {
        status,
        pendingSource: status === 'accepted' ? null : 'admin',
        invitedByActiveUser: false
      },
      APP_STATIC_DATA.activityMemberMetPlaces
    );

    return {
      ...base,
      role: user.id === context.creator.id ? 'Admin' : 'Member',
      requestKind: status === 'accepted' ? null : 'invite',
      pendingSource: status === 'accepted' ? null : 'admin',
      statusText: status === 'accepted' ? base.statusText : 'Invitation pending.'
    };
  }

  private buildActivityRowFromEventRecord(record: ActivityEventRecord): AppTypes.ActivityListRow {
    return toActivityEventRow({ ...record, isAdmin: true });
  }

  private buildActivityRowFromInvitationRecord(record: ActivityEventRecord): AppTypes.ActivityListRow {
    return toActivityEventRow({ ...record, isInvitation: true, type: 'invitations', isAdmin: false });
  }

  private resolveEventCapacityTotal(eventId: string, acceptedMembers: number): number {
    const sampleCapacity = this.parseSampleCapacityLabel(eventId).capacityTotal ?? 0;
    return Math.max(acceptedMembers, sampleCapacity, 4);
  }

  private resolveOwnerCapacityTotal(owner: ActivityMemberOwnerRef, acceptedMembers: number): number {
    const ownerKey = this.ownerKey(owner);
    const storedCapacity = this.ownerCapacityByKey.get(ownerKey);
    if (owner.ownerType === 'event') {
      const invitationRecord = this.findInvitationPreviewRecord(owner.ownerId);
      if (invitationRecord) {
        return Math.max(
          acceptedMembers,
          storedCapacity
            ?? this.normalizeMemberCount(invitationRecord.capacityTotal)
            ?? this.normalizeMemberCount(invitationRecord.capacityMax)
            ?? 0
        );
      }
      return this.resolveEventCapacityTotal(owner.ownerId, acceptedMembers);
    }
    return Math.max(
      acceptedMembers,
      storedCapacity ?? this.parseSampleCapacityLabel(owner.ownerId).capacityTotal ?? 0
    );
  }

  private parseSampleCapacityLabel(eventId: string): { acceptedMembers: number | null; capacityTotal: number | null } {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return { acceptedMembers: null, capacityTotal: null };
    }
    const cached = this.eventCapacitySnapshotByEventId?.get(normalizedEventId);
    if (cached) {
      return cached;
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

  private resolveDemoUser(
    userId: string,
    fallbackName = 'Unknown User',
    fallbackInitials = AppUtils.initialsFromText(fallbackName),
    fallbackCity = '',
    fallbackGender: UserDto['gender'] = 'man'
  ): UserDto {
    const normalizedUserId = userId.trim();
    const byId = this.localActivityMemberUsers.find(user => user.id === normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppUtils.hashText(`${normalizedUserId}:${fallbackName}`);
    const demoUsers = this.localActivityMemberUsers;
    const template = demoUsers[templateSeed % demoUsers.length];
    return {
      ...(template ?? demoUsers[0]),
      id: normalizedUserId || template?.id || 'unknown-user',
      name: fallbackName || template?.name || 'Unknown User',
      initials: fallbackInitials || template?.initials || 'UN',
      city: fallbackCity || template?.city || '',
      gender: fallbackGender || template?.gender || 'man'
    };
  }

  private toRecord(
    owner: ActivityMemberOwnerRef,
    member: AppTypes.ActivityMemberEntry,
    existingRecord?: ActivityMemberRecord | null
  ): ActivityMemberRecord {
    const normalizedOwner = this.normalizeOwnerRef(owner)!;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const invitedByUserId = member.status === 'pending'
      && (member.requestKind === 'invite' || member.requestKind === 'waitlist-invite')
      ? member.invitedByUserId?.trim() || null
      : null;
    return {
      ...member,
      invitedByUserId,
      invitedByActiveUser: invitedByUserId ? member.invitedByActiveUser === true : false,
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      ownerKey: this.ownerKey(normalizedOwner),
      createdMs: Number.isFinite(Number(existingRecord?.createdMs)) ? Number(existingRecord?.createdMs) : nowMs,
      updatedMs: nowMs,
      createdAtIso: existingRecord?.createdAtIso?.trim() || nowIso,
      updatedAtIso: nowIso
    };
  }

  private toMemberEntry(record: ActivityMemberRecord): AppTypes.ActivityMemberEntry {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      initials: record.initials,
      gender: record.gender,
      city: record.city,
      statusText: record.statusText,
      role: record.role,
      status: record.status,
      pendingSource: record.pendingSource,
      requestKind: record.requestKind,
      invitedByActiveUser: record.invitedByActiveUser,
      invitedByUserId: record.invitedByUserId ?? null,
      metAtIso: record.metAtIso,
      actionAtIso: record.actionAtIso,
      metWhere: record.metWhere,
      avatarUrl: record.avatarUrl,
      profile: this.resolveDemoUser(record.userId, record.name, record.initials, record.city, record.gender)
    };
  }

  private normalizeMemberUserIds(userIds: readonly string[] | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private normalizeMemberCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private maxNullableCount(left: number | null, right: number | null): number | null {
    if (left === null) {
      return right;
    }
    if (right === null) {
      return left;
    }
    return Math.max(left, right);
  }
}
