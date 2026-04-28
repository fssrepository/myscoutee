import { Injectable, inject } from '@angular/core';

import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../core/base/models';
import { ActivityMembersBuilder } from '../../base/builders/activity-members.builder';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../../base/interfaces/user.interface';
import type { EventMenuItem, HostingMenuItem } from '../../base/interfaces/activity-feed.interface';
import { HttpActivityMembersRepository } from '../../http/repositories/activity-members.repository';
import type { UserGameMode, UserGameSocialCard } from '../../base/interfaces/game.interface';
import type { DemoEventRecord, DemoEventRecordCollection } from '../models/events.model';
import { EVENTS_TABLE_NAME } from '../models/events.model';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type DemoActivityMemberRecord,
  type DemoActivityMembersRecordCollection
} from '../models/activity-members.model';
import { DemoEventSeedBuilder, DemoUserSeedBuilder } from '../builders';
import { DemoAssetsRepository } from './assets.repository';
import { DemoEventsRepository } from './events.repository';
import { DemoUsersRepository } from './users.repository';

export interface DemoAcceptedEventMemberGroup {
  eventId: string;
  eventName: string;
  userIds: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DemoActivityMembersRepository extends HttpActivityMembersRepository {
  private readonly demoAssetsRepository = inject(DemoAssetsRepository);
  private readonly demoEventsRepository = inject(DemoEventsRepository);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private lastInitToken = '';
  private isInitialized = false;
  private readonly ownerCapacityByKey = new Map<string, number>();
  private demoActivityMemberUsersSnapshot: DemoUser[] | null = null;
  private preferredEventRecordsSnapshot: DemoEventRecord[] | null = null;
  private invitationPreviewRecordsSnapshot: DemoEventRecord[] | null = null;
  private eventCapacitySnapshotByEventId: Map<string, { acceptedMembers: number | null; capacityTotal: number | null }> | null = null;
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

  init(ownerUserIds?: readonly string[]): void {
    console.log(Date.now() + "start - activity members");
    this.demoEventsRepository.init();
    const normalizedOwnerUserIds = Array.from(new Set(
      (ownerUserIds ?? this.demoUsersRepository.queryAvailableDemoUsers().map(user => user.id))
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
    ));
    if (normalizedOwnerUserIds.length > 0) {
      this.demoAssetsRepository.init(normalizedOwnerUserIds);
    }

    console.log(Date.now() + "events read - activity members");

    const eventsTable = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const initToken = `${eventsTable.ids.length}:${currentTable.ids.length}:${Object.keys(currentTable.idsByOwnerKey).length}:${normalizedOwnerUserIds.join('|')}`;
    if (this.lastInitToken === initToken) {
      return;
    }

    console.log(Date.now() + "seeded read - activity members");

    this.demoActivityMemberUsersSnapshot = this.demoUsersRepository.queryAllUsers() as DemoUser[];
    this.preferredEventRecordsSnapshot = this.computePreferredEventRecords(eventsTable);
    this.invitationPreviewRecordsSnapshot = this.computeInvitationPreviewRecords(eventsTable);
    this.eventCapacitySnapshotByEventId = this.buildEventCapacitySnapshot(eventsTable);
    this.seededSubEventsSnapshotByEventId.clear();

    try {
      const existingOwnerKeys = new Set(
        Object.keys(currentTable.idsByOwnerKey)
          .filter(ownerKey => ownerKey.length > 0)
      );
      let nextById: Record<string, DemoActivityMemberRecord> | null = null;
      let nextIds: string[] | null = null;
      let nextIdsByOwnerKey: Record<string, string[]> | null = null;
      let changed = false;

      const appendSeededRecords = (records: readonly DemoActivityMemberRecord[]): void => {
        for (const record of records) {
          if (existingOwnerKeys.has(record.ownerKey)) {
            continue;
          }
          if (!changed) {
            nextById = { ...currentTable.byId };
            nextIds = [...currentTable.ids];
            nextIdsByOwnerKey = this.cloneOwnerKeyIndex(currentTable.idsByOwnerKey);
            changed = true;
          }
          nextById![record.id] = { ...record };
          nextIds!.push(record.id);
          const ownerBucket = nextIdsByOwnerKey![record.ownerKey] ?? [];
          ownerBucket.push(record.id);
          nextIdsByOwnerKey![record.ownerKey] = ownerBucket;
          existingOwnerKeys.add(record.ownerKey);
        }
      };

      appendSeededRecords(this.buildSeededEventOwnerRecords(existingOwnerKeys));
      appendSeededRecords(this.buildSeededInvitationOwnerRecords(existingOwnerKeys));
      for (const userId of normalizedOwnerUserIds) {
        appendSeededRecords(this.buildSeededAssetOwnerRecordsForUser(userId, existingOwnerKeys));
      }
      appendSeededRecords(this.buildSeededSubEventAndGroupOwnerRecords(existingOwnerKeys));

      console.log(Date.now() + "db write read - activity members");

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

      console.log(Date.now() + "db write end - activity members");

      const batchState = this.memoryDb.read();
      let activityMembersTable = this.normalizeCollection(batchState[ACTIVITY_MEMBERS_TABLE_NAME]);
      
      this.batchRefreshInvalidSeededRecordOwners(activityMembersTable);
      
      this.syncEventSummariesFromMembers();
      
      const finalTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
      this.refreshGameSocialCardsCache(finalTable);
      this.lastInitToken = `${eventsTable.ids.length}:${finalTable.ids.length}:${Object.keys(finalTable.idsByOwnerKey).length}:${normalizedOwnerUserIds.join('|')}`;
      this.isInitialized = true;
    } finally {
      this.demoActivityMemberUsersSnapshot = null;
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
    if (!this.isInitialized) {
      this.init();
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
    table: DemoActivityMembersRecordCollection
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

  private refreshGameSocialCardsCache(table: DemoActivityMembersRecordCollection): void {
    const groups = this.acceptedEventMemberGroupsFromTable(table);
    const graph = this.buildAcceptedMemberGraph(groups);
    const graphToken = this.gameSocialCardsCacheTokenForTable(table);
    this.acceptedMemberGraphCache = graph;
    this.acceptedMemberGraphCacheToken = graphToken;
    this.gameSocialCardsByUserId.clear();
    for (const activeUserId of [...graph.neighborsByUserId.keys()].sort()) {
      const activeNeighbors = [...(graph.neighborsByUserId.get(activeUserId) ?? new Set<string>())]
        .filter(userId => userId !== activeUserId)
        .sort();
      const cards: Record<'friends-in-common' | 'separated-friends', UserGameSocialCard[]> = {
        'friends-in-common': [],
        'separated-friends': []
      };
      for (let leftIndex = 0; leftIndex < activeNeighbors.length; leftIndex += 1) {
        const leftUserId = activeNeighbors[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < activeNeighbors.length; rightIndex += 1) {
          const rightUserId = activeNeighbors[rightIndex];
          const key = this.sortedPairKey(leftUserId, rightUserId);
          const isConnected = graph.neighborsByUserId.get(leftUserId)?.has(rightUserId) ?? false;
          const mode: Extract<UserGameMode, 'friends-in-common' | 'separated-friends'> = isConnected
            ? 'friends-in-common'
            : 'separated-friends';
          cards[mode].push({
            id: `${mode}:${activeUserId}:${key}`,
            userId: leftUserId,
            secondaryUserId: rightUserId,
            bridgeUserId: rightUserId,
            socialContext: mode,
            bridgeCount: isConnected ? 1 : 2,
            eventName: isConnected
              ? (graph.edgeEventNameByKey.get(key) ?? 'Connected Friends')
              : (
                graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, leftUserId))
                ?? graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, rightUserId))
                ?? 'Unconnected Friends'
              )
          });
        }
      }
      cards['friends-in-common'].sort((left, right) => left.id.localeCompare(right.id));
      cards['separated-friends'].sort((left, right) => left.id.localeCompare(right.id));
      this.gameSocialCardsByUserId.set(activeUserId, cards);
    }
    this.gameSocialCardsCacheToken = graphToken;
  }

  private queryAcceptedMemberGraph(): {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } {
    if (!this.isInitialized) {
      this.init();
    }
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

  private gameSocialCardsCacheTokenForTable(table: DemoActivityMembersRecordCollection): string {
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
    capacityTotal?: number | null
  ): Promise<void> {
    if (!this.isInitialized) {
      this.init();
    }
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    const summary = this.writeOwnerMembers(normalizedOwner, members, capacityTotal, true);
    this.cacheMembers(normalizedOwner, members, summary.capacityTotal);
  }

  override async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    this.ensureLightweightSyncReady();
    const eventId = payload.id.trim();
    if (!eventId) {
      return;
    }

    const owner: ActivityMemberOwnerRef = {
      ownerType: 'event',
      ownerId: eventId
    };
    const row = this.buildActivityRowFromPayload(payload);
    const creator = this.resolveDemoUser(
      payload.creatorUserId?.trim() || 'u1',
      payload.creatorName?.trim() || payload.title,
      payload.creatorInitials?.trim() || AppUtils.initialsFromText(payload.title),
      payload.creatorCity?.trim() || '',
      payload.creatorGender === 'woman' ? 'woman' : 'man'
    );
    const entryContext = this.buildEntryContext(row, creator);
    const acceptedTarget = this.normalizeMemberCount(payload.acceptedMembers)
      ?? this.normalizeMemberUserIds(payload.acceptedMemberUserIds).length;
    const pendingTarget = this.normalizeMemberCount(payload.pendingMembers)
      ?? this.normalizeMemberUserIds(payload.pendingMemberUserIds).length;
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      payload.acceptedMemberUserIds,
      payload.pendingMemberUserIds,
      acceptedTarget,
      pendingTarget
    );
    const summary = this.writeOwnerMembers(
      owner,
      entries,
      this.normalizeMemberCount(payload.capacityTotal)
        ?? this.normalizeMemberCount(payload.capacityMax)
        ?? Math.max(acceptedTarget, entries.filter(entry => entry.status === 'accepted').length),
      true
    );
    this.cacheMembers(owner, entries, summary.capacityTotal);
  }

  private ensureLightweightSyncReady(): void {
    this.demoEventsRepository.init();
    const state = this.memoryDb.read();
    const table = state[ACTIVITY_MEMBERS_TABLE_NAME] as DemoActivityMembersRecordCollection | undefined;
    if (table && typeof table === 'object' && table.byId && Array.isArray(table.ids) && table.idsByOwnerKey) {
      return;
    }
    this.memoryDb.write(currentState => ({
      ...currentState,
      [ACTIVITY_MEMBERS_TABLE_NAME]: {
        byId: {},
        ids: [],
        idsByOwnerKey: {}
      }
    }));
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
      .filter((record): record is DemoActivityMemberRecord => Boolean(record))
      .map(record => this.toMemberEntry(record))
      .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));
  }

  private get demoActivityMemberUsers(): DemoUser[] {
    return this.demoActivityMemberUsersSnapshot
      ?? this.demoUsersRepository.queryAllUsers() as DemoUser[];
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
      const existingOwnerRecordsById: Record<string, DemoActivityMemberRecord> = {};

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
        .filter((record): record is DemoActivityMemberRecord => Boolean(record))
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
          capacityTotal: Math.max(summary.acceptedMembers, summary.capacityTotal),
          acceptedMemberUserIds: syncUserIds
            ? [...summary.acceptedMemberUserIds]
            : [...current.acceptedMemberUserIds],
          pendingMemberUserIds: syncUserIds
            ? [...summary.pendingMemberUserIds]
            : [...current.pendingMemberUserIds]
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

  private buildSeededEventOwnerRecords(existingOwnerKeys: ReadonlySet<string> = new Set()): DemoActivityMemberRecord[] {
    const records: DemoActivityMemberRecord[] = [];
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

  private buildSeededInvitationOwnerRecords(existingOwnerKeys: ReadonlySet<string> = new Set()): DemoActivityMemberRecord[] {
    const records: DemoActivityMemberRecord[] = [];
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

  private batchRefreshInvalidSeededRecordOwners(table: DemoActivityMembersRecordCollection): void {
    const updates: Array<{ owner: ActivityMemberOwnerRef; members: AppTypes.ActivityMemberEntry[]; capacityTotal: number | null }> = [];

    for (const eventRecord of this.preferredEventRecords()) {
      const owner: ActivityMemberOwnerRef = {
        ownerType: 'event',
        ownerId: eventRecord.id
      };
      const ownerKey = this.ownerKey(owner);
      const currentMembers = (table.idsByOwnerKey[ownerKey] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is DemoActivityMemberRecord => Boolean(record))
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
        .filter((record): record is DemoActivityMemberRecord => Boolean(record))
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
          const existingOwnerRecordsById: Record<string, DemoActivityMemberRecord> = {};
          
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
    record: DemoEventRecord,
    currentMembers: readonly AppTypes.ActivityMemberEntry[]
  ): boolean {
    const expectedAcceptedUserIds = this.normalizeMemberUserIds(record.acceptedMemberUserIds);
    const expectedPendingUserIds = this.normalizeMemberUserIds(record.pendingMemberUserIds);
    const actualAcceptedUserIds = currentMembers
      .filter(member => member.status === 'accepted')
      .map(member => member.userId);
    const actualPendingUserIds = currentMembers
      .filter(member => member.status === 'pending')
      .map(member => member.userId);
    const expectedAcceptedMembers = this.normalizeMemberCount(record.acceptedMembers) ?? expectedAcceptedUserIds.length;
    const expectedPendingMembers = this.normalizeMemberCount(record.pendingMembers) ?? expectedPendingUserIds.length;
    if (actualAcceptedUserIds.length < expectedAcceptedMembers || actualPendingUserIds.length < expectedPendingMembers) {
      return true;
    }
    if (expectedAcceptedUserIds.some(userId => !actualAcceptedUserIds.includes(userId))) {
      return true;
    }
    return expectedPendingUserIds.some(userId => !actualPendingUserIds.includes(userId));
  }

  private preferredEventRecords(): DemoEventRecord[] {
    return this.preferredEventRecordsSnapshot
      ?? this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
  }

  private invitationPreviewRecords(): DemoEventRecord[] {
    return this.invitationPreviewRecordsSnapshot
      ?? this.computeInvitationPreviewRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
  }

  private computePreferredEventRecords(table: DemoEventRecordCollection): DemoEventRecord[] {
    const preferredRecordByEventId = new Map<string, DemoEventRecord>();

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

  private computeInvitationPreviewRecords(table: DemoEventRecordCollection): DemoEventRecord[] {
    const preferredRecordByInvitationId = new Map<string, DemoEventRecord>();

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
    table: DemoEventRecordCollection
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

  private findPreferredEventRecord(eventId: string): DemoEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.preferredEventRecords().find(record => record.id === normalizedEventId) ?? null;
  }

  private findInvitationPreviewRecord(ownerId: string): DemoEventRecord | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    return this.invitationPreviewRecords().find(record => record.id === normalizedOwnerId) ?? null;
  }

  private buildSeededAssetOwnerRecordsForUser(
    userId: string,
    existingOwnerKeys: ReadonlySet<string> = new Set()
  ): DemoActivityMemberRecord[] {
    const nextRecords: DemoActivityMemberRecord[] = [];
    for (const asset of this.demoAssetsRepository.peekOwnedAssetsByUser(userId)) {
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
  ): DemoActivityMemberRecord[] {
    const nextRecords: DemoActivityMemberRecord[] = [];
    const seenOwnerKeys = new Set<string>(existingOwnerKeys);

    for (const record of this.preferredEventRecords()) {
      for (const subEvent of this.seededSubEventsForEvent(record)) {
        const subEventOwner: ActivityMemberOwnerRef = {
          ownerType: 'subEvent',
          ownerId: subEvent.id
        };
        const subEventOwnerKey = this.ownerKey(subEventOwner);
        if (!seenOwnerKeys.has(subEventOwnerKey)) {
          const seededSubEvent = this.buildSeededSubEventOwnerSeed(record, subEvent);
          for (const member of seededSubEvent.members) {
            nextRecords.push(this.toRecord(subEventOwner, member));
          }
          seenOwnerKeys.add(subEventOwnerKey);
        }

        for (const group of subEvent.groups ?? []) {
          const groupOwner: ActivityMemberOwnerRef = {
            ownerType: 'group',
            ownerId: group.id
          };
          const groupOwnerKey = this.ownerKey(groupOwner);
          if (seenOwnerKeys.has(groupOwnerKey)) {
            continue;
          }
          const seededGroup = this.buildSeededGroupOwnerSeed(record, subEvent, group);
          for (const member of seededGroup.members) {
            nextRecords.push(this.toRecord(groupOwner, member));
          }
          seenOwnerKeys.add(groupOwnerKey);
        }
      }
    }

    return nextRecords;
  }

  private collectSourceRecordsForUser(userId: string): DemoEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const seenIds = new Set<string>();
    const nextRecords: DemoEventRecord[] = [];

    for (const record of [
      ...this.demoEventsRepository.queryItemsByUser(normalizedUserId),
      ...this.demoEventsRepository.queryExploreItems(normalizedUserId)
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
      const ownedAsset = this.demoAssetsRepository.peekOwnedAssetsByUser(ownerHint).find(asset => asset.id === normalizedOwnerId);
      if (ownedAsset) {
        return {
          ownerUserId: ownerHint,
          asset: ownedAsset
        };
      }
    }

    for (const user of this.demoUsersRepository.queryAvailableDemoUsers()) {
      const ownedAsset = this.demoAssetsRepository.peekOwnedAssetsByUser(user.id).find(asset => asset.id === normalizedOwnerId);
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
    const seedBaseDate = new Date('2026-02-24T12:00:00.000Z');
    return requests
      .map((request, index): AppTypes.ActivityMemberEntry => {
        const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.demoActivityMemberUsers);
        const matchedUser = this.demoActivityMemberUsers.find(user => user.id === requestUserId)
          ?? AppUtils.findUserByName(this.demoActivityMemberUsers, request.name)
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
          role: matchedUser.id === ownerUserId ? 'Admin' : 'Member',
          status,
          pendingSource: status === 'pending' ? 'admin' : null,
          requestKind: status === 'pending' ? 'invite' : null,
          invitedByActiveUser: false,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: asset.title,
          relevance: 48 + (seed % 46),
          avatarUrl: AppUtils.firstImageUrl(matchedUser.images)
        };
      })
      .sort((left, right) => AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso));
  }

  private buildFallbackAssetRequests(ownerUserId: string, asset: AppTypes.AssetCard): AppTypes.AssetMemberRequest[] {
    const fallbackUsers = DemoUserSeedBuilder.friendUsersForActiveUser(this.demoActivityMemberUsers, ownerUserId, 4);
    const requestUsers = fallbackUsers.length > 0
      ? fallbackUsers
      : this.demoActivityMemberUsers.filter(user => user.id !== ownerUserId).slice(0, 2);
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

  private findSeededSubEventOwner(ownerId: string): { record: DemoEventRecord; subEvent: AppTypes.SubEventFormItem } | null {
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

  private findSeededGroupOwner(ownerId: string): { record: DemoEventRecord; subEvent: AppTypes.SubEventFormItem; group: AppTypes.SubEventGroupItem } | null {
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
    record: DemoEventRecord,
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
    record: DemoEventRecord,
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

  private seededSubEventsForEvent(record: DemoEventRecord): AppTypes.SubEventFormItem[] {
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
      } as EventMenuItem | HostingMenuItem;
      const capacityMax = Math.max(
        this.normalizeMemberCount(record.capacityMax) ?? 0,
        this.normalizeMemberCount(record.capacityTotal) ?? 0,
        this.normalizeMemberCount(record.acceptedMembers) ?? 0
      );

      nextSubEvents = DemoEventSeedBuilder.buildSeededSubEventsForEvent(source, {
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
    record: DemoEventRecord,
    ownerId: string,
    title: string,
    subtitle: string,
    detail: string,
    dateIso: string
  ): AppTypes.ActivityListRow {
    const baseRow = this.buildActivityRowFromEventRecord(record);
    const baseSource = (baseRow.source ?? {}) as unknown as Record<string, unknown>;
    return {
      ...baseRow,
      id: ownerId,
      title,
      subtitle,
      detail,
      dateIso,
      source: {
        ...baseSource,
        id: ownerId,
        title,
        shortDescription: subtitle,
        timeframe: detail,
        startAt: dateIso
      } as AppTypes.ActivityListRow['source']
    };
  }

  private normalizeCollection(
    table: DemoActivityMembersRecordCollection
  ): DemoActivityMembersRecordCollection {
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

  private shouldPreferRecord(next: DemoEventRecord, current: DemoEventRecord): boolean {
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

  private buildSeededRecordsForEvent(record: DemoEventRecord): DemoActivityMemberRecord[] {
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
    const sampleCapacity = this.parseSampleCapacityLabel(record.id);
    const acceptedTarget = Math.max(
      this.normalizeMemberCount(record.acceptedMembers) ?? 0,
      sampleCapacity.acceptedMembers ?? 0
    );
    const pendingTarget = this.normalizeMemberCount(record.pendingMembers) ?? 0;
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      record.acceptedMemberUserIds,
      record.pendingMemberUserIds,
      acceptedTarget,
      pendingTarget
    );
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private buildSeededRecordsForInvitation(record: DemoEventRecord): DemoActivityMemberRecord[] {
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
    const acceptedMemberUserIds = this.normalizeMemberUserIds(record.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeMemberUserIds(record.pendingMemberUserIds)
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    const acceptedTarget = acceptedMemberUserIds.length > 0
      ? acceptedMemberUserIds.length
      : (this.normalizeMemberCount(record.acceptedMembers) ?? 0);
    const pendingTarget = pendingMemberUserIds.length > 0
      ? pendingMemberUserIds.length
      : (this.normalizeMemberCount(record.pendingMembers) ?? 0);
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      acceptedMemberUserIds,
      pendingMemberUserIds,
      acceptedTarget,
      pendingTarget
    );
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private buildEntriesFromUserIds(
    owner: ActivityMemberOwnerRef,
    context: {
      row: AppTypes.ActivityListRow;
      rowKey: string;
      creator: DemoUser;
      generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
      generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    },
    acceptedMemberUserIds: readonly string[] | undefined,
    pendingMemberUserIds: readonly string[] | undefined,
    acceptedTarget: number,
    pendingTarget: number
  ): AppTypes.ActivityMemberEntry[] {
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

    if (acceptedEntries.length < acceptedTarget) {
      const forcedEntries = ActivityMembersBuilder.buildForcedAcceptedMembers(
        context.row,
        context.rowKey,
        Math.max(acceptedTarget, 1),
        this.demoActivityMemberUsers,
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

    if (pendingEntries.length < pendingTarget) {
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

    if (pendingEntries.length < pendingTarget) {
      const prioritizedFallbackCandidates = [
        ...DemoUserSeedBuilder.friendUsersForActiveUser(this.demoActivityMemberUsers, context.creator.id, Math.max(pendingTarget * 3, pendingTarget)),
        ...this.demoActivityMemberUsers
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

  private buildEntryContext(row: AppTypes.ActivityListRow, creator: DemoUser): {
    row: AppTypes.ActivityListRow;
    rowKey: string;
    creator: DemoUser;
    generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
  } {
    const rowKey = `${row.type}:${row.id}`;
    const generated = ActivityMembersBuilder.generateActivityMembersForRow(
      row,
      rowKey,
      this.demoActivityMemberUsers,
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
      creator: DemoUser;
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

  private buildActivityRowFromEventRecord(record: DemoEventRecord): AppTypes.ActivityListRow {
    return {
      id: record.id,
      type: record.type === 'hosting' ? 'hosting' : 'events',
      title: record.title,
      subtitle: record.subtitle,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      unread: record.activity,
      metricScore: record.relevance,
      isAdmin: true,
      source: {
        id: record.id,
        avatar: record.creatorInitials,
        title: record.title,
        shortDescription: record.subtitle,
        timeframe: record.timeframe,
        activity: record.activity,
        isAdmin: true,
        creatorUserId: record.creatorUserId,
        startAt: record.startAtIso,
        endAt: record.endAtIso,
        distanceKm: record.distanceKm,
        visibility: record.visibility,
        blindMode: record.blindMode,
        imageUrl: record.imageUrl,
        sourceLink: record.sourceLink,
        location: record.location,
        capacityMin: record.capacityMin,
        capacityMax: record.capacityMax,
        topics: [...record.topics],
        rating: record.rating,
        relevance: record.relevance,
        published: record.published
      } as AppTypes.ActivityListRow['source']
    };
  }

  private buildActivityRowFromInvitationRecord(record: DemoEventRecord): AppTypes.ActivityListRow {
    return {
      id: record.id,
      type: 'invitations',
      title: record.title,
      subtitle: record.inviter?.trim() || record.creatorName,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      unread: Math.max(0, Math.trunc(Number(record.unread) || 0)),
      metricScore: Math.max(0, Number(record.relevance) || 0),
      isAdmin: false,
      source: {
        id: record.id,
        avatar: record.avatar,
        inviter: record.inviter?.trim() || record.creatorName,
        description: record.title,
        when: record.timeframe,
        unread: Math.max(0, Math.trunc(Number(record.unread) || 0)),
        acceptedMembers: record.acceptedMembers,
        pendingMembers: record.pendingMembers,
        capacityTotal: record.capacityTotal,
        acceptedMemberUserIds: [...record.acceptedMemberUserIds],
        pendingMemberUserIds: [...record.pendingMemberUserIds],
        startAt: record.startAtIso,
        endAt: record.endAtIso,
        distanceKm: record.distanceKm,
        imageUrl: record.imageUrl,
        sourceLink: record.sourceLink,
        location: record.location,
        locationCoordinates: record.locationCoordinates,
        policies: (record.policies ?? []).map(item => ({ ...item }))
      } as AppTypes.ActivityListRow['source']
    };
  }

  private buildActivityRowFromPayload(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): AppTypes.ActivityListRow {
    return {
      id: payload.id,
      type: payload.target === 'hosting' ? 'hosting' : 'events',
      title: payload.title,
      subtitle: payload.shortDescription,
      detail: payload.timeframe,
      dateIso: payload.startAt,
      distanceKm: Math.max(0, Number(payload.distanceKm) || 0),
      unread: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
      metricScore: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
      isAdmin: true,
      source: {
        id: payload.id,
        avatar: payload.creatorInitials?.trim() || AppUtils.initialsFromText(payload.title),
        title: payload.title,
        shortDescription: payload.shortDescription,
        timeframe: payload.timeframe,
        activity: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
        isAdmin: true,
        creatorUserId: payload.creatorUserId,
        startAt: payload.startAt,
        endAt: payload.endAt,
        distanceKm: payload.distanceKm,
        visibility: payload.visibility,
        blindMode: payload.blindMode,
        imageUrl: payload.imageUrl,
        sourceLink: payload.sourceLink,
        location: payload.location,
        capacityMin: payload.capacityMin,
        capacityMax: payload.capacityMax,
        topics: payload.topics ? [...payload.topics] : payload.topics,
        published: payload.published
      } as AppTypes.ActivityListRow['source']
    };
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
      .filter((value): value is DemoEventRecord => Boolean(value))
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
    fallbackGender: DemoUser['gender'] = 'man'
  ): DemoUser {
    const normalizedUserId = userId.trim();
    const byId = this.demoActivityMemberUsers.find(user => user.id === normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppUtils.hashText(`${normalizedUserId}:${fallbackName}`);
    const demoUsers = this.demoActivityMemberUsers;
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
    existingRecord?: DemoActivityMemberRecord | null
  ): DemoActivityMemberRecord {
    const normalizedOwner = this.normalizeOwnerRef(owner)!;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const invitedByUserId = member.status === 'pending' && member.requestKind === 'invite'
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

  private toMemberEntry(record: DemoActivityMemberRecord): AppTypes.ActivityMemberEntry {
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
      relevance: record.relevance,
      avatarUrl: record.avatarUrl
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
