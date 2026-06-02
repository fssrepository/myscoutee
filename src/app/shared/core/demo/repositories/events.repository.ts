import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type { DemoEventSeedItem } from '../models/event-seed-item.model';
import { DemoMemoryDb } from '../../base/db';
import { EVENT_FEEDBACK_TABLE_NAME } from '../models/event-feedback.model';
import { DemoEventSeedBuilder, DemoEventsRepositoryBuilder, DemoSeedScheduleBuilder, DemoUserSeedBuilder } from '../builders';
import {
  EVENTS_TABLE_NAME,
  type DemoEventActivitiesListQueryResult,
  type DemoEventActivitiesQuery,
  type DemoEventExploreQuery,
  type DemoEventExploreQueryResult,
  type DemoEventListItem,
  type DemoEventRecord,
  type DemoEventRecordCollection,
  type DemoEventScopeFilter,
  type DemoRepositoryEventItemType
} from '../models/events.model';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type DemoActivityMemberRecord,
  type DemoActivityMembersRecordCollection
} from '../models/activity-members.model';
import type * as AppTypes from '../../../core/base/models';
import type { ActivitiesEventSyncPayload } from '../../../core/base/models';
import { EventEditorBuilder } from '../../../core/base/builders';
import { PricingBuilder } from '../../../core/base/builders/pricing.builder';
import { USERS_TABLE_NAME } from '../models/users.model';
import type { LocationCoordinates } from '../../base/interfaces';

interface DemoEventActivitiesCursor {
  id: string;
  distanceMeters: number;
  boost: number;
  startAtMs: number;
}

type DemoEventExploreSortTuple = readonly [number, number, number, number];

interface DemoEventExploreCursor {
  id: string;
  tuple: DemoEventExploreSortTuple;
}

@Injectable({
  providedIn: 'root'
})
export class DemoEventsRepository {
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 15;
  private static readonly AFFINITY_DISTANCE_BOOST_SCALE = 10_000;
  private static readonly SYNTHETIC_EVENT_TITLE_PREFIXES = [
    'Lantern',
    'Harbor',
    'Mosaic',
    'Skyline',
    'Bluebird',
    'Cinder',
    'Sunday',
    'Signal',
    'Northstar',
    'Wildflower',
    'Sidecar',
    'Velvet'
  ] as const;
  private static readonly SYNTHETIC_EVENT_TITLE_SUFFIXES = [
    'Social',
    'Circuit',
    'Session',
    'Shuffle',
    'Exchange',
    'Sprint',
    'Gathering',
    'Meetup',
    'Studio',
    'Walk',
    'Brunch',
    'Mixer'
  ] as const;
  private readonly memoryDb = inject(DemoMemoryDb);
  private initialized = false;

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  init(): void {
    if (this.initialized) {
      return;
    }
    const state = this.memoryDb.read();
    const seededRecords = this.buildSeededRecords();
    const currentTable = state[EVENTS_TABLE_NAME];

    if (currentTable.ids.length === 0) {
      this.memoryDb.write(currentState => ({
        ...currentState,
        [EVENTS_TABLE_NAME]: seededRecords
      }));
      this.initialized = true;
      return;
    }

    const migration = this.mergeSeededRecords(currentTable, seededRecords);
    if (!migration.changed) {
      this.initialized = true;
      return;
    }

    this.memoryDb.write(currentState => ({
      ...currentState,
      [EVENTS_TABLE_NAME]: migration.table
    }));
    this.initialized = true;
  }

  queryItemsByUser(userId: string): DemoEventRecord[] {
    this.init();
    this.materializeSlotRecords();
    return this.queryUserRecords(userId);
  }

  queryInvitationItemsByUser(userId: string): DemoEventRecord[] {
    this.init();
    return this.queryUserRecords(userId).filter(record => record.isInvitation);
  }

  queryEventItemsByUser(userId: string): DemoEventRecord[] {
    this.init();
    return this.queryUserRecords(userId).filter(record => record.type === 'events');
  }

  queryHostingItemsByUser(userId: string): DemoEventRecord[] {
    this.init();
    return this.queryUserRecords(userId).filter(record => record.type === 'hosting');
  }

  queryTrashedItemsByUser(userId: string): DemoEventRecord[] {
    this.init();
    return this.queryUserRecords(userId).filter(record => this.isTrashScopeStatus(record));
  }

  private queryEventRecordsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): DemoEventRecord[] {
    this.init();
    this.materializeSlotRecords();
    const userItems = this.queryUserRecords(userId);
    const memberEventItems = userItems
      .filter(record => record.type === 'events')
      .filter(record => record.isAdmin !== true)
      .filter(record => !this.isTrashScopeStatus(record))
      .filter(record => this.isAcceptedEventRecord(record, userId) || this.isPendingEventRecord(record, userId));
    const pendingEventItems = memberEventItems
      .filter(record => this.isPendingEventRecord(record, userId) || this.isPendingReviewStatus(record));
    const activeEventItems = memberEventItems
      .filter(record => this.isAcceptedEventRecord(record, userId) && !this.isPendingReviewStatus(record));
    const invitationItems = userItems
      .filter(record => record.isInvitation)
      .filter(record => !this.isTrashScopeStatus(record));
    const myEventItems = userItems
      .filter(record => record.type === 'hosting')
      .filter(record => record.isAdmin)
      .filter(record => !this.isTrashScopeStatus(record));
    const draftItems = myEventItems.filter(record => record.published === false);
    const reviewItems = myEventItems.filter(record => this.isPendingReviewStatus(record));

    if (filter === 'all') {
      return [...activeEventItems, ...pendingEventItems, ...invitationItems, ...myEventItems];
    }
    if (filter === 'pending') {
      return [...pendingEventItems, ...reviewItems];
    }
    if (filter === 'invitations') {
      return invitationItems;
    }
    if (filter === 'my-events') {
      return hostingPublicationFilter === 'drafts' ? draftItems : myEventItems;
    }
    if (filter === 'drafts') {
      return draftItems;
    }
    if (filter === 'trash') {
      return userItems.filter(record => this.isTrashScopeStatus(record));
    }
    return activeEventItems;
  }

  private isPendingEventRecord(record: DemoEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || record.type !== 'events' || record.isAdmin === true) {
      return false;
    }
    if (this.eventMemberUserIdsByStatus(record.id, 'accepted').includes(normalizedUserId)) {
      return false;
    }
    return this.eventMemberUserIdsByStatus(record.id, 'pending').includes(normalizedUserId);
  }

  private isPendingReviewStatus(record: DemoEventRecord): boolean {
    const status = this.normalizeEventStatus(record.status);
    return status === 'UR' || status === 'B';
  }

  private isTrashScopeStatus(record: DemoEventRecord): boolean {
    if (record.isTrashed) {
      return true;
    }
    const status = this.normalizeEventStatus(record.status);
    return status === 'T' || status === 'D' || status === 'I';
  }

  private restoredStatusForRecord(record: DemoEventRecord): DemoEventRecord['status'] {
    const previous = this.normalizeEventStatus(record.statusBeforeSuppression);
    if (previous && !['UR', 'B', 'D', 'I', 'T'].includes(previous)) {
      return previous as DemoEventRecord['status'];
    }
    return record.type === 'hosting' ? 'H' : 'A';
  }

  private normalizeEventStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'active':
        return 'A';
      case 'hosting':
        return 'H';
      case 'invitation':
        return 'INV';
      case 'draft':
        return 'DR';
      case 'trashed':
      case 'trash':
        return 'T';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      default:
        return normalized || 'A';
    }
  }

  private resolveStageActionTarget(action: string, reason?: string | null): {
    action: string;
    nextStatus: AppTypes.TournamentStageStatus;
    reason: string;
  } | null {
    const normalizedAction = `${action ?? ''}`.trim();
    const normalizedReason = `${reason ?? ''}`.trim();
    switch (normalizedAction) {
      case 'start-tournament':
        return { action: normalizedAction, nextStatus: 'A', reason: normalizedReason || 'tournament-started' };
      case 'close-stage':
        return { action: normalizedAction, nextStatus: 'SR', reason: normalizedReason || 'stage-closed' };
      case 'finalize-stage':
        return { action: normalizedAction, nextStatus: 'F', reason: normalizedReason || 'stage-finalized' };
      case 'reopen-scores':
        return { action: normalizedAction, nextStatus: 'SR', reason: normalizedReason || 'scores-reopened' };
      case 'suspend-tournament':
        return { action: normalizedAction, nextStatus: 'S', reason: normalizedReason || 'manual-suspension' };
      case 'resume-tournament':
        return { action: normalizedAction, nextStatus: 'SR', reason: normalizedReason || 'manual-resume' };
      default:
        return null;
    }
  }

  private canApplyStageAction(action: string, stages: readonly AppTypes.SubEventFormItem[], stageIndex: number): boolean {
    const stage = stages[stageIndex];
    const status = this.normalizeStageStatus(stage?.stageStatus);
    switch (action) {
      case 'start-tournament':
        return stageIndex === 0 && status === 'RS';
      case 'close-stage':
        return status === 'A';
      case 'finalize-stage':
        return status === 'SR';
      case 'reopen-scores':
        return status === 'F' && this.canReopenScores(stages, stageIndex);
      case 'suspend-tournament':
        return status !== 'RS' && status !== 'S' && status !== 'F';
      case 'resume-tournament':
        return status === 'S';
      default:
        return false;
    }
  }

  private canReopenScores(stages: readonly AppTypes.SubEventFormItem[], stageIndex: number): boolean {
    const nextStage = stages[stageIndex + 1];
    if (!nextStage) {
      return true;
    }
    if (this.normalizeStageStatus(nextStage.stageStatus) !== 'A') {
      return false;
    }
    const nextStartMs = Date.parse(`${nextStage.startAt ?? ''}`);
    return !Number.isFinite(nextStartMs) || nextStartMs > Date.now();
  }

  private resolveStageIndex(
    stages: readonly AppTypes.SubEventFormItem[],
    subEventId: string | null | undefined,
    fallbackIndex: number | null | undefined
  ): number {
    const normalizedSubEventId = `${subEventId ?? ''}`.trim();
    if (normalizedSubEventId) {
      const index = stages.findIndex(stage => `${stage?.id ?? ''}`.trim() === normalizedSubEventId);
      if (index >= 0) {
        return index;
      }
    }
    const index = Math.trunc(Number(fallbackIndex));
    return Number.isFinite(index) && index >= 0 && index < stages.length ? index : -1;
  }

  private normalizeStageStatus(status: string | null | undefined): AppTypes.TournamentStageStatus {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    if (normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S') {
      return normalized;
    }
    return 'A';
  }

  private isAcceptedEventRecord(record: DemoEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || record.type !== 'events' || record.isAdmin === true) {
      return false;
    }
    return this.eventMemberUserIdsByStatus(record.id, 'accepted').includes(normalizedUserId);
  }

  queryActivitiesEventListPage(query: DemoEventActivitiesQuery): DemoEventActivitiesListQueryResult {
    this.init();
    this.materializeSlotRecords();
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }

    const filteredRecords = this.queryEventRecordsByFilter(
      normalizedUserId,
      query.filter,
      query.hostingPublicationFilter ?? 'all'
    );
    const viewerCoordinates = this.queryUserLocationCoordinates(normalizedUserId);
    const normalizedRecords = filteredRecords
      .map(record => this.withResolvedDistance(record, viewerCoordinates))
      .filter(record => this.matchesActivitiesSecondaryFilter(record, query.secondaryFilter))
      .sort((left, right) => this.compareActivitiesRecords(left, right, query));
    const total = normalizedRecords.length;

    if (query.view === 'week' || query.view === 'month') {
      return {
        records: normalizedRecords.map(record => this.toEventListItem(record)),
        total,
        nextCursor: null
      };
    }

    const cursor = this.parseActivitiesCursor(query.cursor);
    const remaining = cursor
      ? normalizedRecords.filter(record => this.compareRecordToCursor(record, cursor, query) > 0)
      : normalizedRecords;
    const limit = Math.max(1, Math.trunc(query.limit));
    const records = remaining.slice(0, limit);
    const nextCursor = remaining.length > limit && records.length > 0
      ? this.serializeActivitiesCursor(this.buildActivitiesCursor(records[records.length - 1]))
      : null;

    return {
      records: records.map(record => this.toEventListItem(record)),
      total,
      nextCursor
    };
  }

  private toEventListItem(record: DemoEventRecord): DemoEventListItem {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      status: record.status,
      avatar: record.avatar,
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      inviter: record.inviter,
      unread: record.unread,
      activity: record.activity,
      isAdmin: record.isAdmin,
      isInvitation: record.isInvitation,
      isHosting: record.isHosting,
      isTrashed: record.isTrashed,
      published: record.published,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorCity: record.creatorCity,
      visibility: record.visibility,
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      capacityTotal: record.capacityTotal,
      ticketing: record.ticketing,
      eventType: record.eventType,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      pendingReason: record.pendingReason,
      topics: [...record.topics],
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity
    };
  }

  queryExploreItems(userId: string): DemoEventRecord[] {
    this.init();
    this.materializeSlotRecords();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const byEventId = new Map<string, DemoEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || this.isGeneratedSlotRecord(record) || !this.shouldIncludeExploreRecord(record, normalizedUserId)) {
        continue;
      }
      const existing = byEventId.get(record.id);
      if (!existing || this.shouldPreferExploreRecord(record, existing)) {
        byEventId.set(record.id, this.withResolvedSlotContext(DemoEventsRepositoryBuilder.cloneRecord(record), table));
      }
    }

    return [...byEventId.values()].map(record => DemoEventsRepositoryBuilder.cloneRecord(record));
  }

  peekKnownItemById(userId: string, itemId: string): DemoEventRecord | null {
    const normalizedUserId = userId.trim();
    const normalizedItemId = itemId.trim();
    if (!normalizedUserId || !normalizedItemId) {
      return null;
    }
    const known = [
      ...this.queryItemsByUser(normalizedUserId),
      ...this.queryExploreItems(normalizedUserId)
    ];
    return known.find(record => record.id === normalizedItemId) ?? null;
  }

  queryEventExplorePage(query: DemoEventExploreQuery): DemoEventExploreQueryResult {
    this.init();
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }

    const selectedTopic = this.normalizeExploreTopic(query.topic);
    const viewerCoordinates = this.queryUserLocationCoordinates(normalizedUserId);
    const viewerAffinity = this.queryUserAffinity(normalizedUserId);
    const excludedSourceIds = new Set(this.normalizeUserIds(query.excludedSourceIds));
    const normalizedRecords = this.queryExploreItems(normalizedUserId)
      .filter(record => !excludedSourceIds.has(record.id))
      .map(record => this.withResolvedDistance(record, viewerCoordinates))
      .filter(record => !query.friendsOnly || this.exploreHasFriendGoing(record, normalizedUserId))
      .filter(record => !query.openSpotsOnly || this.exploreHasOpenSpots(record))
      .filter(record => !selectedTopic || record.topics.some(topic => this.normalizeExploreTopic(topic) === selectedTopic))
      .sort((left, right) => this.compareExploreRecords(left, right, query, viewerAffinity));
    const total = normalizedRecords.length;
    const cursor = this.parseEventExploreCursor(query.cursor);
    const remaining = cursor
      ? normalizedRecords.filter(record => this.compareEventExploreRecordToCursor(record, cursor, query, viewerAffinity) > 0)
      : normalizedRecords;
    const limit = Math.max(1, Math.trunc(Number(query.limit) || 10));
    const records = remaining.slice(0, limit);
    const nextCursor = remaining.length > limit && records.length > 0
      ? this.serializeEventExploreCursor(this.buildEventExploreCursor(records[records.length - 1], query, viewerAffinity))
      : null;

    return {
      records,
      total,
      nextCursor
    };
  }

  syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): DemoEventRecord | null {
    this.init();
    const normalizedId = payload.id.trim();
    const creatorUserId = payload.creatorUserId?.trim() ?? '';
    if (!normalizedId || !creatorUserId) {
      return null;
    }

    const creatorName = payload.creatorName?.trim() || 'Unknown Host';
    const creatorInitials = payload.creatorInitials?.trim() || AppUtils.initialsFromText(creatorName);
    const startAtIso = payload.startAt?.trim() || new Date().toISOString();
    const endAtIso = payload.endAt?.trim()
      || new Date(new Date(startAtIso).getTime() + (2 * 60 * 60 * 1000)).toISOString();
    const acceptedMembers = this.normalizeCount(payload.acceptedMembers)
      ?? this.eventMemberUserIdsByStatus(normalizedId, 'accepted').length;
    const pendingMembers = this.normalizeCount(payload.pendingMembers)
      ?? this.eventMemberUserIdsByStatus(normalizedId, 'pending').length;
    const capacityTotal = Math.max(
      acceptedMembers,
      this.normalizeCount(payload.capacityTotal)
        ?? this.normalizeCount(payload.capacityMax)
        ?? acceptedMembers
    );
    const baseRecord = this.buildSyncedRecord(
      payload,
      {
        userId: creatorUserId,
        type: payload.target,
        isHosting: payload.target === 'hosting',
        creatorName,
        creatorInitials,
        startAtIso,
        endAtIso,
        acceptedMembers,
        pendingMembers,
        capacityTotal
      }
    );

    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      this.upsertRecord(nextById, nextIds, baseRecord);
      if (payload.target === 'hosting') {
        this.upsertRecord(nextById, nextIds, {
          ...baseRecord,
          type: 'events',
          isHosting: false
        });
      }
      this.processDemoWaitlistForRecord(table, nextById, nextIds, normalizedId, true);
      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });
    this.materializeSlotRecords();
    return this.peekKnownItemById(creatorUserId, normalizedId);
  }

  trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      status: 'T',
      isTrashed: true,
      trashedAtIso: new Date().toISOString()
    });
  }

  publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      status: type === 'hosting' ? 'H' : 'A',
      published: true
    });
  }

  unpublishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      status: 'DR',
      published: false
    });
  }

  restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      status: type === 'hosting' ? 'H' : 'A',
      statusBeforeSuppression: null,
      isTrashed: false,
      trashedAtIso: null
    });
  }

  takeOverItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      let changed = false;
      for (const id of table.ids) {
        const current = table.byId[id];
        if (!current || current.id !== normalizedSourceId || this.normalizeEventStatus(current.status) !== 'UR') {
          continue;
        }
        const restoredStatus = this.restoredStatusForRecord(current);
        nextById[id] = {
          ...current,
          status: restoredStatus,
          statusBeforeSuppression: null,
          isTrashed: false,
          trashedAtIso: null,
          published: restoredStatus !== 'DR'
        };
        changed = true;
      }
      return changed
        ? {
            ...state,
            [EVENTS_TABLE_NAME]: {
              ...table,
              byId: nextById
            }
          }
        : state;
    });
  }

  applyStageAction(request: {
    userId: string;
    sourceId: string;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): DemoEventRecord | null {
    this.init();
    const normalizedUserId = request.userId.trim();
    const normalizedSourceId = request.sourceId.trim();
    const actionTarget = this.resolveStageActionTarget(request.action, request.reason);
    if (!normalizedUserId || !normalizedSourceId || !actionTarget) {
      return null;
    }
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const preferred = this.computePreferredEventRecords(table)
        .find(record => record.id === normalizedSourceId && !record.isInvitation);
      const preferredSubEvents = this.cloneSubEvents(preferred?.subEvents) ?? [];
      const preferredIndex = this.resolveStageIndex(preferredSubEvents, request.subEventId, request.subEventIndex);
      if (!preferred || preferredIndex < 0 || !this.canApplyStageAction(actionTarget.action, preferredSubEvents, preferredIndex)) {
        return state;
      }

      const nowIso = new Date().toISOString();
      const targetStageId = `${preferredSubEvents[preferredIndex]?.id ?? ''}`.trim();
      const nextById = { ...table.byId };
      let changed = false;
      for (const id of table.ids) {
        const current = table.byId[id];
        if (!current || current.id !== normalizedSourceId || current.isInvitation) {
          continue;
        }
        const subEvents = this.cloneSubEvents(current.subEvents) ?? [];
        const stageIndex = this.resolveStageIndex(subEvents, targetStageId, preferredIndex);
        if (stageIndex < 0 || !subEvents[stageIndex]) {
          continue;
        }
        subEvents[stageIndex] = {
          ...subEvents[stageIndex],
          stageStatus: actionTarget.nextStatus,
          stageStatusReason: actionTarget.reason,
          stageStatusUpdatedAt: nowIso,
          stageFinalizedAt: actionTarget.nextStatus === 'F' ? nowIso : null,
          stageFinalizedByUserId: actionTarget.nextStatus === 'F' ? normalizedUserId : null
        };
        nextById[id] = {
          ...current,
          autoInviter: actionTarget.action === 'start-tournament' ? false : current.autoInviter,
          subEvents
        };
        changed = true;
      }
      return changed
        ? {
            ...state,
            [EVENTS_TABLE_NAME]: {
              ...table,
              byId: nextById
            }
          }
        : state;
    });
    return this.peekKnownItemById(normalizedUserId, normalizedSourceId);
  }

  querySubEventLeaderboard(eventId: string, subEventId: string): AppTypes.SubEventLeaderboardState | null {
    this.init();
    const normalizedEventId = eventId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedEventId || !normalizedSubEventId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const record = this.computePreferredEventRecords(table)
      .find(item => item.id === normalizedEventId && !item.isInvitation);
    const subEvents = this.cloneSubEvents(record?.subEvents) ?? [];
    const stage = subEvents.find(item => `${item.id ?? ''}`.trim() === normalizedSubEventId) ?? null;
    if (!record || !stage) {
      return null;
    }
    const leaderboardType = stage.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score';
    const groups = (stage.groups?.length ? stage.groups : this.demoGeneratedGroups(stage)).map((group, groupIndex) => {
      const groupId = `${group.id ?? `${normalizedSubEventId}-group-${groupIndex + 1}`}`.trim();
      const memberCount = Math.max(2, Math.trunc(Number(group.capacityMax ?? stage.tournamentGroupCapacityMax ?? stage.capacityMax) || 4));
      const advancePerGroup = Math.max(1, Math.trunc(Number(stage.tournamentAdvancePerGroup) || 1));
      const members = Array.from({ length: memberCount }, (_, memberIndex) => ({
        id: `${groupId}-member-${memberIndex + 1}`,
        name: `Member ${memberIndex + 1}`
      }));
      const scoreRows = members
        .map((member, memberIndex) => ({
          memberId: member.id,
          memberName: member.name,
          total: Math.max(0, 48 - groupIndex * 4 - memberIndex * 5),
          updates: 2 + ((groupIndex + memberIndex) % 3)
        }))
        .sort((left, right) => right.total - left.total || left.memberName.localeCompare(right.memberName));
      const fifaRows = members
        .map((member, memberIndex) => {
          const points = Math.max(0, 12 - groupIndex - memberIndex * 2);
          const goalsFor = Math.max(0, 9 - memberIndex);
          const goalsAgainst = Math.max(0, 3 + memberIndex);
          return {
            memberId: member.id,
            memberName: member.name,
            points,
            played: 3,
            wins: Math.max(0, Math.min(3, Math.floor(points / 3))),
            draws: points % 3 === 1 ? 1 : 0,
            losses: Math.max(0, 3 - Math.floor(points / 3) - (points % 3 === 1 ? 1 : 0)),
            goalsFor,
            goalsAgainst,
            goalDiff: goalsFor - goalsAgainst
          };
        })
        .sort((left, right) => right.points - left.points || right.goalDiff - left.goalDiff || left.memberName.localeCompare(right.memberName));
      const advancingSource = leaderboardType === 'Fifa' ? fifaRows : scoreRows;
      return {
        groupId,
        title: `${group.name ?? `Group ${groupIndex + 1}`}`.trim() || `Group ${groupIndex + 1}`,
        memberCount,
        advancePerGroup,
        advancingMemberIds: advancingSource.slice(0, advancePerGroup).map(row => row.memberId),
        members,
        scoreEntries: [],
        fifaMatches: [],
        scoreRows: leaderboardType === 'Score' ? scoreRows : [],
        fifaRows: leaderboardType === 'Fifa' ? fifaRows : []
      };
    });
    return {
      eventId: normalizedEventId,
      subEventId: normalizedSubEventId,
      title: `${stage.name ?? 'Stage results'}`.trim(),
      leaderboardType,
      groups
    };
  }

  requestJoin(
    userId: string,
    sourceId: string,
    slotSourceId: string | null = null,
    accepted = false,
    waitingList = false
  ): DemoEventRecord | null {
    this.init();
    this.materializeSlotRecords();
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    const normalizedSlotSourceId = slotSourceId?.trim() || '';
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }

    const preferredRecord = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME])
      .find(record => record.id === normalizedSourceId && !record.isInvitation);
    if (!preferredRecord) {
      return null;
    }

    const idsToJoin = Array.from(new Set([
      normalizedSourceId,
      normalizedSlotSourceId
    ].filter(Boolean)));
    if (idsToJoin.length === 0) {
      return null;
    }

    this.memoryDb.write(state => {
      const eventTable = state[EVENTS_TABLE_NAME];
      const usersTable = state[USERS_TABLE_NAME];
      const nextMembersTable = this.normalizeActivityMembersCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);

      for (const joinedId of idsToJoin) {
        const current = eventTable.ids
          .map(recordKey => eventTable.byId[recordKey])
          .find(record => record?.id === joinedId && !record.isInvitation);
        if (!current) {
          continue;
        }
        this.upsertEventActivityMember(
          nextMembersTable,
          current,
          normalizedUserId,
          accepted ? 'accepted' : 'pending',
          waitingList,
          usersTable.byId[normalizedUserId] ?? null
        );
      }

      return {
        ...state,
        [ACTIVITY_MEMBERS_TABLE_NAME]: nextMembersTable
      };
    });

    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const membersTable = this.normalizeActivityMembersCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];

      for (const recordKey of table.ids) {
        const current = table.byId[recordKey];
        if (!current || current.isInvitation || !idsToJoin.includes(current.id)) {
          continue;
        }
        const acceptedMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, current.id, 'accepted');
        const pendingMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, current.id, 'pending');
        nextById[recordKey] = {
          ...current,
          acceptedMembers: acceptedMemberUserIds.length,
          pendingMembers: pendingMemberUserIds.length,
          capacityTotal: Math.max(acceptedMemberUserIds.length, current.capacityTotal)
        };
      }

      if (accepted && !waitingList) {
        for (const joinedId of idsToJoin) {
          this.processDemoWaitlistForRecord(table, nextById, nextIds, joinedId, true, membersTable);
        }
      }

      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });

    this.materializeSlotRecords();
    const refreshed = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME])
      .find(record => record.id === (normalizedSlotSourceId || normalizedSourceId) && !record.isInvitation)
      ?? preferredRecord;
    return this.buildMembershipProjectionRecord(normalizedUserId, refreshed);
  }

  isItemTrashed(userId: string, type: DemoRepositoryEventItemType, sourceId: string): boolean {
    this.init();
    const record = this.findItem(userId, type, sourceId);
    return record?.isTrashed === true;
  }

  countTicketItemsByUser(userId: string): number {
    this.init();
    return this.queryUserRecords(userId)
      .filter(record => !record.isInvitation)
      .filter(record => !record.isTrashed)
      .filter(record => record.ticketing === true)
      .length;
  }

  countUpcomingActiveEventItemsByUser(userId: string): number {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    return this.queryEventRecordsByFilter(normalizedUserId, 'active-events')
      .filter(record => this.matchesActivitiesSecondaryFilter(record, 'recent'))
      .length;
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    const eventItems = this.queryEventItemsByUser(normalizedUserId);
    const feedbackTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nowMs = Date.now();
    return eventItems.filter(item => {
      if (item.isAdmin) {
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

  private updateItemState(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string,
    updates: Partial<DemoEventRecord>
  ): void {
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      const recordKeys = this.resolveStateRecordKeysFromTable(table, userId, type, sourceId);
      let changed = false;

      for (const recordKey of recordKeys) {
        const current = table.byId[recordKey];
        if (!current) {
          continue;
        }
        nextById[recordKey] = {
          ...current,
          ...updates
        };
        changed = true;
      }

      if (!changed) {
        const overlayRecord = this.buildUserStateOverlayRecord(table, userId, type, sourceId, updates);
        if (!overlayRecord) {
          return state;
        }
        const overlayKey = DemoEventsRepositoryBuilder.buildRecordKey(overlayRecord.userId, overlayRecord.type, overlayRecord.id);
        nextById[overlayKey] = overlayRecord;
        if (!nextIds.includes(overlayKey)) {
          nextIds.push(overlayKey);
        }
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });
  }

  private resolveStateRecordKeys(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string[] {
    return this.resolveStateRecordKeysFromTable(this.memoryDb.read()[EVENTS_TABLE_NAME], userId, type, sourceId);
  }

  private resolveStateRecordKeysFromTable(
    table: DemoEventRecordCollection,
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string[] {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return [];
    }
    const candidateTypes: DemoRepositoryEventItemType[] = type === 'invitations'
      ? ['invitations']
      : ['events', 'hosting'];
    return candidateTypes
      .map(candidateType => DemoEventsRepositoryBuilder.buildRecordKey(normalizedUserId, candidateType, normalizedSourceId))
      .filter((recordKey, index, recordKeys) => recordKeys.indexOf(recordKey) === index && Boolean(table.byId[recordKey]));
  }

  private buildUserStateOverlayRecord(
    table: DemoEventRecordCollection,
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string,
    updates: Partial<DemoEventRecord>
  ): DemoEventRecord | null {
    if (type === 'invitations') {
      return null;
    }

    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }

    const preferredRecord = this.computePreferredEventRecords(table)
      .find(record => record.id === normalizedSourceId && !record.isInvitation);
    if (!preferredRecord) {
      return null;
    }

    const overlayType: DemoRepositoryEventItemType = type === 'hosting' ? 'hosting' : 'events';
    const baseRecord = DemoEventsRepositoryBuilder.cloneRecord(preferredRecord);
    return {
      ...baseRecord,
      userId: normalizedUserId,
      type: overlayType,
      isAdmin: overlayType === 'hosting',
      isHosting: overlayType === 'hosting',
      isInvitation: false,
      ...updates
    };
  }

  private findItem(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): DemoEventRecord | null {
    const recordKey = this.resolveRecordKey(userId, type, sourceId);
    if (!recordKey) {
      return null;
    }
    const record = this.memoryDb.read()[EVENTS_TABLE_NAME].byId[recordKey];
    return record ? DemoEventsRepositoryBuilder.cloneRecord(record) : null;
  }

  private resolveRecordKey(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string | null {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const directKey = DemoEventsRepositoryBuilder.buildRecordKey(normalizedUserId, type, normalizedSourceId);
    if (table.byId[directKey]) {
      return directKey;
    }
    if (type === 'hosting') {
      const adminEventKey = DemoEventsRepositoryBuilder.buildRecordKey(normalizedUserId, 'events', normalizedSourceId);
      if (table.byId[adminEventKey]?.isAdmin === true) {
        return adminEventKey;
      }
    }
    return null;
  }

  private queryUserRecords(userId: string): DemoEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const preferredRecords = this.computePreferredEventRecords(table);
    const preferredRecordByEventId = new Map(preferredRecords.map(record => [record.id, record]));
    const directRecords = table.ids
      .map(id => this.normalizePersistedEventRecord(table.byId[id]))
      .filter((record): record is DemoEventRecord => Boolean(record))
      .filter(record => record.userId === normalizedUserId)
      .filter(record => this.shouldIncludeUserDirectRecord(record, normalizedUserId, preferredRecordByEventId.get(record.id)))
      .map(record => this.withResolvedSlotContext(DemoEventsRepositoryBuilder.cloneRecord(record), table));
    const directIds = new Set(directRecords.map(record => record.id));
    const membershipRecords = preferredRecords
      .filter(record => record.creatorUserId !== normalizedUserId)
      .filter(record => !record.isTrashed)
      .filter(record => !directIds.has(record.id))
      .filter(record => this.hasTrackedUserParticipation(record, normalizedUserId))
      .map(record => this.buildMembershipProjectionRecord(normalizedUserId, this.withResolvedSlotContext(record, table)));
    return [...directRecords, ...membershipRecords];
  }

  private buildMembershipProjectionRecord(userId: string, record: DemoEventRecord): DemoEventRecord {
    const normalizedUserId = userId.trim();
    const pending = this.eventMemberUserIdsByStatus(record.id, 'pending').includes(normalizedUserId);
    return {
      ...DemoEventsRepositoryBuilder.cloneRecord(record),
      userId,
      type: 'events',
      isAdmin: false,
      isInvitation: false,
      isHosting: false,
      pendingReason: pending ? (record.pendingReason ?? 'approval') : null
    };
  }

  private shouldIncludeUserDirectRecord(
    record: DemoEventRecord,
    userId: string,
    preferredRecord: DemoEventRecord | undefined
  ): boolean {
    if (record.type !== 'events' || record.isInvitation) {
      return true;
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    if (record.creatorUserId === normalizedUserId || record.isAdmin === true) {
      return true;
    }
    return this.hasTrackedUserParticipation(preferredRecord ?? record, normalizedUserId);
  }

  private hasTrackedUserParticipation(
    record: Pick<DemoEventRecord, 'id'>,
    userId: string
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return false;
    }
    return this.eventMemberUserIdsByStatus(record.id, 'accepted').includes(normalizedUserId)
      || this.eventMemberUserIdsByStatus(record.id, 'pending').includes(normalizedUserId);
  }

  private isSetupRequiredDemoProfile(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId] ?? null;
    return user
      ? DemoUserSeedBuilder.isEmptyOnboardingProfile(user)
      : DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(normalizedUserId);
  }

  private computePreferredEventRecords(table: DemoEventRecordCollection): DemoEventRecord[] {
    const preferredRecordByEventId = new Map<string, DemoEventRecord>();

    for (const id of table.ids) {
      const record = this.normalizePersistedEventRecord(table.byId[id]);
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

  private queryUserLocationCoordinates(userId: string): LocationCoordinates | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId];
    return this.normalizeLocationCoordinates(user?.locationCoordinates);
  }

  private queryUserAffinity(userId: string): number {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId];
    return Math.max(0, Math.trunc(Number(user?.affinity) || 0));
  }

  private withResolvedDistance(
    record: DemoEventRecord,
    viewerCoordinates: LocationCoordinates | null
  ): DemoEventRecord {
    const eventCoordinates = this.normalizeLocationCoordinates(record.locationCoordinates);
    if (!viewerCoordinates || !eventCoordinates) {
      return DemoEventsRepositoryBuilder.cloneRecord(record);
    }
    const distanceMeters = this.haversineDistanceMeters(viewerCoordinates, eventCoordinates);
    return {
      ...DemoEventsRepositoryBuilder.cloneRecord(record),
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10
    };
  }

  private compareActivitiesRecords(
    left: DemoEventRecord,
    right: DemoEventRecord,
    query: DemoEventActivitiesQuery
  ): number {
    if (query.view === 'distance' || query.sort === 'distance') {
      if (query.secondaryFilter === 'relevant') {
        return this.distanceOrderValue(left) - this.distanceOrderValue(right)
          || this.boostOrderValue(right) - this.boostOrderValue(left)
          || this.timestampOrderValue(right) - this.timestampOrderValue(left)
          || this.compareRecordIdentity(left, right);
      }
      return this.distanceOrderValue(left) - this.distanceOrderValue(right)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    if (query.secondaryFilter === 'relevant') {
      return this.dayOrderValue(left) - this.dayOrderValue(right)
        || this.boostOrderValue(right) - this.boostOrderValue(left)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    if (query.secondaryFilter === 'past') {
      return this.dayOrderValue(right) - this.dayOrderValue(left)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    return this.dayOrderValue(left) - this.dayOrderValue(right)
      || this.timestampOrderValue(left) - this.timestampOrderValue(right)
      || this.compareRecordIdentity(left, right);
  }

  private compareRecordToCursor(
    record: DemoEventRecord,
    cursor: DemoEventActivitiesCursor,
    query: DemoEventActivitiesQuery
  ): number {
    const cursorRecord: DemoEventRecord = {
      ...DemoEventsRepositoryBuilder.cloneRecord(record),
      id: cursor.id,
      distanceKm: cursor.distanceMeters / 1000,
      boost: cursor.boost,
      startAtIso: new Date(cursor.startAtMs).toISOString()
    };
    return this.compareActivitiesRecords(record, cursorRecord, query);
  }

  private buildActivitiesCursor(record: DemoEventRecord): DemoEventActivitiesCursor {
    return {
      id: record.id,
      distanceMeters: this.distanceOrderValue(record),
      boost: this.boostOrderValue(record),
      startAtMs: this.timestampOrderValue(record)
    };
  }

  private serializeActivitiesCursor(cursor: DemoEventActivitiesCursor): string {
    return JSON.stringify(cursor);
  }

  private parseActivitiesCursor(value: string | null | undefined): DemoEventActivitiesCursor | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as Partial<DemoEventActivitiesCursor>;
      if (
        typeof parsed.id !== 'string'
        || !Number.isFinite(parsed.distanceMeters)
        || !Number.isFinite(parsed.boost)
        || !Number.isFinite(parsed.startAtMs)
      ) {
        return null;
      }
      return {
        id: parsed.id,
        distanceMeters: Math.max(0, Math.trunc(Number(parsed.distanceMeters))),
        boost: Math.max(0, Number(parsed.boost)),
        startAtMs: Math.trunc(Number(parsed.startAtMs))
      };
    } catch {
      return null;
    }
  }

  private distanceOrderValue(record: DemoEventRecord): number {
    return Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000));
  }

  private boostOrderValue(record: DemoEventRecord): number {
    return Math.max(0, Number(record.boost) || 0);
  }

  private resolveActivitiesEndTimestamp(record: DemoEventRecord): number {
    const endAtMs = AppUtils.toSortableDate(record.endAtIso);
    if (Number.isFinite(endAtMs) && endAtMs > 0) {
      return endAtMs;
    }
    return this.timestampOrderValue(record);
  }

  private isPastActivitiesRecord(record: DemoEventRecord): boolean {
    return this.resolveActivitiesEndTimestamp(record) <= Date.now();
  }

  private matchesActivitiesSecondaryFilter(
    record: DemoEventRecord,
    secondaryFilter: DemoEventActivitiesQuery['secondaryFilter']
  ): boolean {
    if (secondaryFilter === 'past') {
      return this.isPastActivitiesRecord(record);
    }
    if (secondaryFilter === 'recent' || secondaryFilter === 'relevant') {
      return !this.isPastActivitiesRecord(record);
    }
    return true;
  }

  private timestampOrderValue(record: DemoEventRecord): number {
    return AppUtils.toSortableDate(record.startAtIso);
  }

  private dayOrderValue(record: DemoEventRecord): number {
    const timestamp = this.timestampOrderValue(record);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }
    return AppUtils.dateOnly(new Date(timestamp)).getTime();
  }

  private compareRecordIdentity(left: DemoEventRecord, right: DemoEventRecord): number {
    return left.id.localeCompare(right.id);
  }

  private compareExploreRecords(
    left: DemoEventRecord,
    right: DemoEventRecord,
    query: DemoEventExploreQuery,
    viewerAffinity: number
  ): number {
    return this.compareExploreSortTuple(
      this.buildEventExploreSortTuple(left, query, viewerAffinity),
      this.buildEventExploreSortTuple(right, query, viewerAffinity)
    ) || this.compareRecordIdentity(left, right);
  }

  private compareEventExploreRecordToCursor(
    record: DemoEventRecord,
    cursor: DemoEventExploreCursor,
    query: DemoEventExploreQuery,
    viewerAffinity: number
  ): number {
    return this.compareExploreSortTuple(
      this.buildEventExploreSortTuple(record, query, viewerAffinity),
      cursor.tuple
    ) || record.id.localeCompare(cursor.id);
  }

  private buildEventExploreCursor(
    record: DemoEventRecord,
    query: DemoEventExploreQuery,
    viewerAffinity: number
  ): DemoEventExploreCursor {
    return {
      id: record.id,
      tuple: this.buildEventExploreSortTuple(record, query, viewerAffinity)
    };
  }

  private serializeEventExploreCursor(cursor: DemoEventExploreCursor): string {
    return JSON.stringify({
      id: cursor.id,
      tuple: [...cursor.tuple]
    });
  }

  private parseEventExploreCursor(value: string | null | undefined): DemoEventExploreCursor | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as { id?: unknown; tuple?: unknown };
      if (typeof parsed.id !== 'string' || !Array.isArray(parsed.tuple) || parsed.tuple.length !== 4) {
        return null;
      }
      const tuple = parsed.tuple.map(item => Number(item));
      if (tuple.some(item => !Number.isFinite(item))) {
        return null;
      }
      return {
        id: parsed.id,
        tuple: [
          tuple[0] ?? 0,
          tuple[1] ?? 0,
          tuple[2] ?? 0,
          tuple[3] ?? 0
        ]
      };
    } catch {
      return null;
    }
  }

  private buildEventExploreSortTuple(
    record: DemoEventRecord,
    query: DemoEventExploreQuery,
    viewerAffinity: number
  ): DemoEventExploreSortTuple {
    const startAtMs = this.timestampOrderValue(record);
    const dayKey = this.dayOrderValue(record);
    const distanceMeters = this.distanceOrderValue(record);
    const ratingValue = -Math.round(AppUtils.clampNumber(Number(record.rating) || 0, 0, 10) * 100);
    const affinityDistance = Math.abs(this.affinityOrderValue(record) - viewerAffinity);
    const boostAffinityRank = this.boostAffinityRank(record, affinityDistance);
    const isPast = startAtMs < Date.now() ? 1 : 0;
    const pastPriority = isPast === 1 ? 0 : 1;

    if (query.view === 'distance') {
      if (query.order === 'past-events') {
        return [distanceMeters, pastPriority, -startAtMs, affinityDistance];
      }
      if (query.order === 'nearby') {
        return [distanceMeters, isPast, startAtMs, affinityDistance];
      }
      if (query.order === 'top-rated') {
        return [distanceMeters, isPast, ratingValue, startAtMs];
      }
      if (query.order === 'most-relevant') {
        return [distanceMeters, isPast, boostAffinityRank, startAtMs];
      }
      return [distanceMeters, isPast, startAtMs, affinityDistance];
    }

    if (query.order === 'past-events') {
      return [pastPriority, -dayKey, -startAtMs, distanceMeters];
    }
    if (query.order === 'nearby') {
      return [isPast, dayKey, distanceMeters, startAtMs];
    }
    if (query.order === 'top-rated') {
      return [isPast, dayKey, ratingValue, startAtMs];
    }
    if (query.order === 'most-relevant') {
      return [isPast, dayKey, boostAffinityRank, startAtMs];
    }
    return [isPast, dayKey, startAtMs, distanceMeters];
  }

  private boostAffinityRank(record: DemoEventRecord, affinityDistance: number): number {
    const score = this.boostOrderValue(record)
      - (Math.max(0, affinityDistance) / DemoEventsRepository.AFFINITY_DISTANCE_BOOST_SCALE);
    return -Math.round(score * 1_000_000);
  }

  private compareExploreSortTuple(
    left: DemoEventExploreSortTuple,
    right: DemoEventExploreSortTuple
  ): number {
    for (let index = 0; index < left.length; index += 1) {
      const delta = left[index] - right[index];
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private affinityOrderValue(record: DemoEventRecord): number {
    return Math.max(0, Math.trunc(Number(record.affinity) || 0));
  }

  private exploreHasFriendGoing(record: DemoEventRecord, activeUserId: string): boolean {
    return [
      record.creatorUserId,
      ...this.eventMemberUserIdsByStatus(record.id, 'accepted')
    ].some(userId =>
      userId !== activeUserId && DemoUserSeedBuilder.isFriendOfActiveUser(userId, activeUserId)
    );
  }

  private exploreHasOpenSpots(record: DemoEventRecord): boolean {
    return record.capacityTotal > record.acceptedMembers;
  }

  private normalizeExploreTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private haversineDistanceMeters(
    from: LocationCoordinates,
    to: LocationCoordinates
  ): number {
    const earthRadiusMeters = 6_371_000;
    const latitudeDelta = this.toRadians(to.latitude - from.latitude);
    const longitudeDelta = this.toRadians(to.longitude - from.longitude);
    const fromLatitude = this.toRadians(from.latitude);
    const toLatitude = this.toRadians(to.latitude);
    const sinLatitude = Math.sin(latitudeDelta / 2);
    const sinLongitude = Math.sin(longitudeDelta / 2);
    const a = (sinLatitude * sinLatitude)
      + (Math.cos(fromLatitude) * Math.cos(toLatitude) * sinLongitude * sinLongitude);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusMeters * c);
  }

  private toRadians(value: number): number {
    return value * (Math.PI / 180);
  }

  private shouldIncludeExploreRecord(record: DemoEventRecord, activeUserId: string): boolean {
    if (record.isTrashed || record.isInvitation) {
      return false;
    }
    if (this.normalizeEventStatus(record.status) !== 'A') {
      return false;
    }
    if (record.published === false) {
      return false;
    }
    if (record.creatorUserId === activeUserId) {
      return false;
    }
    const acceptedMemberUserIds = this.eventMemberUserIdsByStatus(record.id, 'accepted');
    const pendingMemberUserIds = this.eventMemberUserIdsByStatus(record.id, 'pending');
    if (acceptedMemberUserIds.includes(activeUserId) || pendingMemberUserIds.includes(activeUserId)) {
      return false;
    }
    if (record.visibility === 'Invitation only') {
      return false;
    }
    if (record.visibility === 'Friends only' && !DemoUserSeedBuilder.isFriendOfActiveUser(record.creatorUserId, activeUserId)) {
      return false;
    }
    return true;
  }

  private shouldPreferExploreRecord(next: DemoEventRecord, current: DemoEventRecord): boolean {
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    if (next.published !== current.published) {
      return next.published;
    }
    return next.activity >= current.activity;
  }

  private buildSyncedRecord(
    payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>,
    context: {
      userId: string;
      type: 'events' | 'hosting';
      isHosting: boolean;
      creatorName: string;
      creatorInitials: string;
      startAtIso: string;
      endAtIso: string;
      acceptedMembers: number;
      pendingMembers: number;
      capacityTotal: number;
    }
  ): DemoEventRecord {
    const existing = this.findItem(context.userId, context.type, payload.id) ?? this.findItem(context.userId, 'events', payload.id);
    const visibility = payload.visibility ?? existing?.visibility ?? (context.isHosting ? 'Invitation only' : 'Public');
    const blindMode = payload.blindMode ?? existing?.blindMode ?? 'Open Event';
    const topics = this.normalizeTopics(payload.topics ?? existing?.topics ?? []);
    const subEvents = this.cloneSubEvents(payload.subEvents ?? existing?.subEvents);
    const policies = EventEditorBuilder.cloneEventEditorPolicies(payload.policies ?? existing?.policies ?? []);
    const ticketing = payload.ticketing ?? existing?.ticketing ?? false;
    const pricing = PricingBuilder.syncSlotOverrides(
      PricingBuilder.normalizePricingConfig(payload.pricing ?? existing?.pricing, {
        context: 'event',
        slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(payload.slotTemplates ?? existing?.slotTemplates ?? [])
      }),
      PricingBuilder.slotCatalogFromEventSlotTemplates(payload.slotTemplates ?? existing?.slotTemplates ?? [])
    );
    const rating = existing?.rating ?? (6 + ((AppUtils.hashText(`${context.type}:${payload.id}:${payload.title}`) % 35) / 10));
    const boost = existing?.boost ?? (50 + (AppUtils.hashText(`${context.type}:${payload.id}:${payload.title}`) % 51));
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    const creator = usersTable.byId[context.userId] ?? null;
    const acceptedUsers = this.eventMemberUserIdsByStatus(payload.id, 'accepted')
      .map(userId => usersTable.byId[userId] ?? null);
    const affinity = DemoEventsRepositoryBuilder.resolveEventAffinity({
      id: payload.id,
      title: payload.title,
      subtitle: payload.shortDescription,
      topics,
      visibility,
      blindMode,
      creator,
      acceptedUsers,
      rating,
      acceptedMembers: context.acceptedMembers,
      capacityTotal: context.capacityTotal
    });
    return {
      id: payload.id,
      userId: context.userId,
      type: context.type,
      avatar: context.creatorInitials,
      title: payload.title,
      subtitle: payload.shortDescription,
      timeframe: payload.timeframe,
      inviter: null,
      unread: 0,
      activity: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
      isAdmin: payload.isAdmin ?? existing?.isAdmin ?? context.isHosting,
      isInvitation: false,
      isHosting: context.isHosting,
      isTrashed: existing?.isTrashed ?? false,
      published: context.isHosting ? (payload.published !== false) : true,
      trashedAtIso: existing?.trashedAtIso ?? null,
      creatorUserId: context.userId,
      creatorName: context.creatorName,
      creatorInitials: context.creatorInitials,
      creatorGender: payload.creatorGender ?? existing?.creatorGender ?? 'man',
      creatorCity: payload.creatorCity ?? existing?.creatorCity ?? '',
      visibility,
      blindMode,
      startAtIso: context.startAtIso,
      endAtIso: context.endAtIso,
      distanceKm: Math.max(0, Number(payload.distanceKm) || 0),
      imageUrl: payload.imageUrl?.trim() || existing?.imageUrl || `https://picsum.photos/seed/event-explore-${payload.id}/1200/700`,
      sourceLink: payload.sourceLink?.trim() || existing?.sourceLink || '',
      location: payload.location?.trim() || existing?.location || '',
      locationCoordinates: this.normalizeLocationCoordinates(payload.locationCoordinates)
        ?? this.normalizeLocationCoordinates(existing?.locationCoordinates),
      capacityMin: this.normalizeCount(payload.capacityMin) ?? existing?.capacityMin ?? 0,
      capacityMax: this.normalizeCount(payload.capacityMax) ?? existing?.capacityMax ?? context.capacityTotal,
      capacityTotal: context.capacityTotal,
      autoInviter: typeof payload.autoInviter === 'boolean'
        ? payload.autoInviter
        : (typeof existing?.autoInviter === 'boolean' ? existing.autoInviter : false),
      frequency: payload.frequency?.trim() || existing?.frequency || 'One-time',
      ticketing,
      pricing,
      policies,
      slotsEnabled: payload.slotsEnabled ?? existing?.slotsEnabled ?? false,
      slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(payload.slotTemplates ?? existing?.slotTemplates ?? []),
      parentEventId: payload.parentEventId ?? existing?.parentEventId ?? null,
      slotTemplateId: payload.slotTemplateId ?? existing?.slotTemplateId ?? null,
      generated: payload.generated ?? existing?.generated ?? false,
      eventType: payload.eventType ?? existing?.eventType ?? 'main',
      nextSlot: payload.nextSlot ? { ...payload.nextSlot } : (existing?.nextSlot ? { ...existing.nextSlot } : null),
      upcomingSlots: (payload.upcomingSlots ?? existing?.upcomingSlots ?? []).map(item => ({ ...item })),
      acceptedMembers: context.acceptedMembers,
      pendingMembers: context.pendingMembers,
      topics,
      subEvents,
      subEventsDisplayMode: payload.subEventsDisplayMode
        ?? existing?.subEventsDisplayMode
        ?? (subEvents ? DemoEventSeedBuilder.inferredSubEventsDisplayMode(subEvents) : 'Casual'),
      rating,
      boost,
      affinity
    };
  }

  private processDemoWaitlistForRecord(
    table: DemoEventRecordCollection,
    nextById: Record<string, DemoEventRecord>,
    nextIds: string[],
    sourceId: string,
    promoteSingle: boolean,
    membersTable: DemoActivityMembersRecordCollection = this.normalizeActivityMembersCollection(
      this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]
    )
  ): void {
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) {
      return;
    }
    const nextTable: DemoEventRecordCollection = {
      byId: nextById,
      ids: nextIds
    };
    const preferredRecord = this.computePreferredEventRecords(nextTable)
      .find(record => record.id === normalizedSourceId && !record.isInvitation);
    if (!preferredRecord) {
      return;
    }
    const acceptedMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, normalizedSourceId, 'accepted');
    const pendingMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, normalizedSourceId, 'pending')
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    const capacityTotal = Math.max(0, this.normalizeCount(preferredRecord.capacityTotal) ?? 0);
    if (capacityTotal <= 0 || pendingMemberUserIds.length === 0) {
      return;
    }

    if (acceptedMemberUserIds.length >= capacityTotal) {
      this.deleteDemoWaitlistInvitationRecords(table, nextById, nextIds, normalizedSourceId, pendingMemberUserIds);
      return;
    }

    const pendingWithoutInvitation = pendingMemberUserIds.filter(userId =>
      !nextById[DemoEventsRepositoryBuilder.buildRecordKey(userId, 'invitations', normalizedSourceId)]
    );
    const usersToInvite = promoteSingle
      ? pendingWithoutInvitation.slice(0, 1)
      : pendingWithoutInvitation;
    for (const userId of usersToInvite) {
      this.upsertRecord(nextById, nextIds, this.buildDemoWaitlistInvitationRecord(preferredRecord, userId));
    }
  }

  private deleteDemoWaitlistInvitationRecords(
    table: DemoEventRecordCollection,
    nextById: Record<string, DemoEventRecord>,
    nextIds: string[],
    sourceId: string,
    userIds: readonly string[]
  ): void {
    for (const userId of this.normalizeUserIds(userIds)) {
      const recordKey = DemoEventsRepositoryBuilder.buildRecordKey(userId, 'invitations', sourceId);
      if (!table.byId[recordKey] && !nextById[recordKey]) {
        continue;
      }
      delete nextById[recordKey];
      const index = nextIds.indexOf(recordKey);
      if (index >= 0) {
        nextIds.splice(index, 1);
      }
    }
  }

  private buildDemoWaitlistInvitationRecord(record: DemoEventRecord, userId: string): DemoEventRecord {
    return {
      ...DemoEventsRepositoryBuilder.cloneRecord(record),
      userId,
      type: 'invitations',
      status: 'INV',
      inviter: record.creatorName,
      unread: Math.max(1, record.unread),
      isAdmin: false,
      isInvitation: true,
      isHosting: false,
      isTrashed: false,
      trashedAtIso: null,
      published: true
    };
  }

  private upsertRecord(
    byId: Record<string, DemoEventRecord>,
    ids: string[],
    record: DemoEventRecord
  ): void {
    const recordKey = DemoEventsRepositoryBuilder.buildRecordKey(record.userId, record.type, record.id);
    byId[recordKey] = DemoEventsRepositoryBuilder.cloneRecord(record);
    if (!ids.includes(recordKey)) {
      ids.push(recordKey);
    }
  }

  private normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private normalizePersistedEventRecord(record: DemoEventRecord | null | undefined): DemoEventRecord | null {
    if (!record) {
      return null;
    }
    return {
      ...record,
      acceptedMembers: this.normalizeCount(record.acceptedMembers) ?? 0,
      pendingMembers: this.normalizeCount(record.pendingMembers) ?? 0,
      policies: EventEditorBuilder.cloneEventEditorPolicies(record.policies ?? []),
      slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(record.slotTemplates ?? []),
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      topics: this.normalizeTopics(record.topics ?? []),
      subEvents: this.cloneSubEvents(record.subEvents)
    };
  }

  private normalizeActivityMembersCollection(
    table: DemoActivityMembersRecordCollection | null | undefined
  ): DemoActivityMembersRecordCollection {
    if (table && typeof table === 'object' && table.byId && Array.isArray(table.ids) && table.idsByOwnerKey) {
      return {
        byId: { ...table.byId },
        ids: [...table.ids],
        idsByOwnerKey: Object.fromEntries(
          Object.entries(table.idsByOwnerKey)
            .map(([ownerKey, ids]) => [ownerKey, Array.isArray(ids) ? [...ids] : []])
        )
      };
    }
    return {
      byId: {},
      ids: [],
      idsByOwnerKey: {}
    };
  }

  private upsertEventActivityMember(
    table: DemoActivityMembersRecordCollection,
    event: DemoEventRecord,
    userId: string,
    status: AppTypes.ActivityMemberStatus,
    waitingList: boolean,
    profile: {
      id?: string;
      name?: string;
      initials?: string;
      gender?: 'woman' | 'man';
      city?: string;
      statusText?: string;
      images?: readonly string[];
    } | null
  ): void {
    const normalizedEventId = event.id.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedEventId || !normalizedUserId) {
      return;
    }
    const ownerKey = `event:${normalizedEventId}`;
    const ownerBucket = [...(table.idsByOwnerKey[ownerKey] ?? [])];
    const existingId = ownerBucket.find(id => table.byId[id]?.userId === normalizedUserId);
    const id = existingId ?? `${ownerKey}:${normalizedUserId}`;
    const existing = existingId ? table.byId[existingId] : null;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const name = profile?.name?.trim() || 'Unknown User';
    const initials = profile?.initials?.trim() || AppUtils.initialsFromText(name);
    const nextStatus = status === 'pending' && existing?.status === 'accepted'
      ? 'accepted'
      : status;
    const pending = nextStatus === 'pending';
    const record: DemoActivityMemberRecord = {
      id,
      userId: normalizedUserId,
      name,
      initials,
      gender: profile?.gender === 'woman' ? 'woman' : 'man',
      city: profile?.city?.trim() || '',
      statusText: pending ? (waitingList ? 'Wait-list request pending.' : 'Join request pending.') : 'Going.',
      role: normalizedUserId === event.creatorUserId ? 'Admin' : 'Member',
      status: nextStatus,
      pendingSource: pending ? 'member' : null,
      requestKind: pending ? (waitingList ? 'waitlist' : 'join') : null,
      invitedByActiveUser: false,
      invitedByUserId: null,
      metAtIso: existing?.metAtIso?.trim() || nowIso,
      actionAtIso: nowIso,
      metWhere: existing?.metWhere?.trim() || event.title,
      avatarUrl: profile?.images ? AppUtils.firstImageUrl(profile.images) : '',
      profile: profile ? { ...profile, id: normalizedUserId } as AppTypes.ActivityMemberEntry['profile'] : null,
      ownerType: 'event',
      ownerId: normalizedEventId,
      ownerKey,
      createdMs: Number.isFinite(Number(existing?.createdMs)) ? Number(existing?.createdMs) : nowMs,
      updatedMs: nowMs,
      createdAtIso: existing?.createdAtIso?.trim() || nowIso,
      updatedAtIso: nowIso
    };
    table.byId[id] = record;
    if (!table.ids.includes(id)) {
      table.ids.push(id);
    }
    if (!ownerBucket.includes(id)) {
      ownerBucket.push(id);
    }
    table.idsByOwnerKey[ownerKey] = ownerBucket;
  }

  private eventMemberUserIdsByStatus(
    eventId: string,
    status: AppTypes.ActivityMemberStatus
  ): string[] {
    return this.eventMemberUserIdsByStatusFromTable(
      this.normalizeActivityMembersCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]),
      eventId,
      status
    );
  }

  private eventMemberUserIdsByStatusFromTable(
    table: DemoActivityMembersRecordCollection,
    eventId: string,
    status: AppTypes.ActivityMemberStatus
  ): string[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    const ownerKey = `event:${normalizedEventId}`;
    const userIds = (table?.idsByOwnerKey?.[ownerKey] ?? [])
      .map(id => table?.byId?.[id])
      .filter(record => record?.status === status)
      .map(record => `${record?.userId ?? ''}`.trim())
      .filter(Boolean);
    return this.normalizeUserIds(userIds);
  }

  private normalizeUserIds(userIds: readonly string[] | null | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private normalizeTopics(topics: readonly string[]): string[] {
    return Array.from(new Set(topics
      .map(topic => `${topic ?? ''}`.trim().replace(/^#+/, ''))
      .filter(topic => topic.length > 0)
      .slice(0, 5)));
  }

  private cloneSubEvents(items: readonly AppTypes.SubEventFormItem[] | undefined): AppTypes.SubEventFormItem[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      location: typeof item.location === 'string' ? item.location : '',
      groups: Array.isArray(item.groups)
        ? item.groups.map((group: AppTypes.SubEventGroupItem) => ({ ...group }))
        : []
    }));
  }

  private demoGeneratedGroups(stage: AppTypes.SubEventFormItem): AppTypes.SubEventGroupItem[] {
    const groupCount = Math.max(1, Math.trunc(Number(stage.tournamentGroupCount) || 1));
    const min = Math.max(1, Math.trunc(Number(stage.tournamentGroupCapacityMin ?? stage.capacityMin) || 2));
    const max = Math.max(min, Math.trunc(Number(stage.tournamentGroupCapacityMax ?? stage.capacityMax) || min));
    return Array.from({ length: groupCount }, (_, index) => {
      const letter = String.fromCharCode(65 + (index % 26));
      return {
        id: `${stage.id ?? 'stage'}-group-${index + 1}`,
        name: `Group ${letter}`,
        capacityMin: min,
        capacityMax: max,
        source: 'generated'
      };
    });
  }

  private materializeSubEventsForSlotOccurrence(
    items: readonly AppTypes.SubEventFormItem[] | undefined,
    occurrenceStart: Date,
    occurrenceEnd: Date
  ): AppTypes.SubEventFormItem[] | undefined {
    const subEvents = this.cloneSubEvents(items);
    if (!subEvents?.length) {
      return subEvents;
    }

    const slotDurationMinutes = Math.max(1, Math.round((occurrenceEnd.getTime() - occurrenceStart.getTime()) / 60000));
    return subEvents.map(item => {
      const rawStart = this.parseEventDate(item.startAt);
      const rawEnd = this.parseEventDate(item.endAt);
      const explicitOffset = Number(item.slotStartOffsetMinutes);
      const explicitDuration = Number(item.slotDurationMinutes);

      const offsetMinutes = Number.isFinite(explicitOffset)
        ? Math.max(0, Math.trunc(explicitOffset))
        : Math.max(
          0,
          rawStart
            ? ((rawStart.getHours() * 60) + rawStart.getMinutes()) - ((occurrenceStart.getHours() * 60) + occurrenceStart.getMinutes())
            : 0
        );
      const durationMinutes = Number.isFinite(explicitDuration)
        ? Math.max(1, Math.trunc(explicitDuration))
        : Math.max(
          1,
          rawStart && rawEnd
            ? Math.round((rawEnd.getTime() - rawStart.getTime()) / 60000)
            : slotDurationMinutes
        );

      const safeOffsetMinutes = AppUtils.clampNumber(offsetMinutes, 0, Math.max(0, slotDurationMinutes - 1));
      const safeDurationMinutes = AppUtils.clampNumber(
        durationMinutes,
        1,
        Math.max(1, slotDurationMinutes - safeOffsetMinutes)
      );
      const startAt = new Date(occurrenceStart.getTime() + (safeOffsetMinutes * 60 * 1000));
      const endAt = new Date(startAt.getTime() + (safeDurationMinutes * 60 * 1000));

      return {
        ...item,
        startAt: AppUtils.toIsoDateTimeLocal(startAt),
        endAt: AppUtils.toIsoDateTimeLocal(endAt),
        slotStartOffsetMinutes: safeOffsetMinutes,
        slotDurationMinutes: safeDurationMinutes
      };
    });
  }

  private buildSeededRecords(): DemoEventRecordCollection {
    const eventsByUser = this.buildEventsByUserWithSyntheticSeed();
    return DemoEventsRepositoryBuilder.buildRecordCollection({
      invitationsByUser: DemoEventsRepositoryBuilder.buildSeedInvitationItemsByUser(),
      eventsByUser,
      hostingByUser: DemoEventsRepositoryBuilder.buildSeedHostingItemsByUser(),
      publishedById: DemoEventsRepositoryBuilder.buildSeedPublishedById()
    });
  }

  private buildEventsByUserWithSyntheticSeed(): Record<string, readonly DemoEventSeedItem[]> {
    const users = DemoUserSeedBuilder.buildExpandedDemoUsers(50)
      .filter(user => !DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));
    const userById = new Map(users.map(user => [user.id, user]));
    const seeded: Record<string, readonly DemoEventSeedItem[]> = {};
    const seedEventsByUser = DemoEventsRepositoryBuilder.buildSeedEventItemsByUser();
    const featuredFriendsOnlyByUser = this.buildFeaturedFriendsOnlyEvents(userById);
    const userIds = Array.from(new Set([
      ...Object.keys(seedEventsByUser),
      ...Object.keys(featuredFriendsOnlyByUser)
    ]));

    for (const userId of userIds) {
      const items = seedEventsByUser[userId] ?? [];
      const baseItems = [
        ...(featuredFriendsOnlyByUser[userId] ?? []),
        ...items.map(item => ({
          ...item,
          topics: item.topics ? [...item.topics] : item.topics
        }))
      ].map(item => ({
        ...item,
        topics: item.topics ? [...item.topics] : item.topics
      }));
      if (baseItems.length >= DemoEventsRepository.MIN_DEMO_EVENT_ITEMS_PER_USER) {
        seeded[userId] = baseItems;
        continue;
      }

      const user = userById.get(userId);
      const synthetic: DemoEventSeedItem[] = [];
      const needed = DemoEventsRepository.MIN_DEMO_EVENT_ITEMS_PER_USER - baseItems.length;
      const creatorCandidates = users.filter(candidate => candidate.id !== userId);

      for (let index = 0; index < needed; index += 1) {
        const seq = baseItems.length + index + 1;
        const id = `ex-${userId}-${seq}`;
        const seed = AppUtils.hashText(`${userId}:${id}:${seq}`);
        const isJoinedMemberSeed = index >= 3 && index <= 5;
        const isOwnedHostingSeed = index === 6;
        const start = DemoSeedScheduleBuilder.buildDeterministicStartDate(seed, index);
        const end = new Date(start.getTime() + ((2 + (index % 3)) * 60 * 60 * 1000));
        const visibility = seq === 12
          ? 'Friends only'
          : ((index % 2) === 0 ? 'Friends only' : 'Public');
        const blindMode = (index % 5) === 0 ? 'Blind Event' : 'Open Event';
        const creatorUserId = isJoinedMemberSeed && creatorCandidates.length > 0
          ? (creatorCandidates[(seed + (index * 5)) % creatorCandidates.length]?.id ?? userId)
          : userId;
        const title = this.buildSyntheticEventTitle(user, seq, seed);
        const defaultDescription = this.buildSyntheticEventDescription(user, seq, seed);
        const checkoutVariation = this.buildSyntheticCheckoutVariation(id, index);

        synthetic.push({
          id,
          avatar: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Synthetic Event'),
          title,
          shortDescription: checkoutVariation?.shortDescription ?? defaultDescription,
          timeframe: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          activity: (index % 5) + 1,
          isAdmin: isJoinedMemberSeed ? false : (isOwnedHostingSeed ? true : (seq % 4) === 0),
          creatorUserId,
          startAt: start.toISOString().slice(0, 19),
          endAt: end.toISOString().slice(0, 19),
          distanceKm: 3 + (index % 42),
          visibility,
          blindMode,
          imageUrl: `https://picsum.photos/seed/event-${id}/1200/700`,
          sourceLink: `https://example.com/events/${id}`,
          location: user?.city ? `${user.city} · Community Hub` : 'Community Hub',
          capacityMin: 6 + (index % 10),
          capacityMax: 12 + (index % 18),
          rating: 6 + ((seed % 35) / 10),
          boost: 50 + (seed % 51),
          generated: true,
          ...checkoutVariation
        });
      }

      seeded[userId] = [...baseItems, ...synthetic];
    }

    return seeded;
  }

  private buildSyntheticEventTitle(
    user: { city?: string; initials?: string } | undefined,
    seq: number,
    seed: number
  ): string {
    const city = user?.city?.trim() || 'Austin';
    const prefix = DemoEventsRepository.SYNTHETIC_EVENT_TITLE_PREFIXES[
      seed % DemoEventsRepository.SYNTHETIC_EVENT_TITLE_PREFIXES.length
    ] ?? 'Lantern';
    const suffix = DemoEventsRepository.SYNTHETIC_EVENT_TITLE_SUFFIXES[
      ((seed >> 4) + seq) % DemoEventsRepository.SYNTHETIC_EVENT_TITLE_SUFFIXES.length
    ] ?? 'Social';
    const initials = (user?.initials?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'EV').slice(0, 2) || 'EV';
    const badge = `${initials}${seq.toString().padStart(2, '0')}${(seed % 36).toString(36).toUpperCase()}`;
    return `${city} ${prefix} ${suffix} ${badge}`;
  }

  private buildSyntheticEventDescription(
    user: { city?: string } | undefined,
    seq: number,
    seed: number
  ): string {
    const city = user?.city?.trim() || 'Austin';
    const variations = [
      'Rotating intros with light structure and quick regroup rounds.',
      'Loose small-group pacing with fresh pairings each half hour.',
      'Casual social format built for drop-ins, loops, and new conversations.',
      'Compact city meetup with easy check-in flow and mellow energy.'
    ] as const;
    const variation = variations[(seed >> 7) % variations.length] ?? variations[0];
    return `${city} synthetic event ${seq} with ${variation.toLowerCase()}`;
  }

  private buildSyntheticCheckoutVariation(
    sourceId: string,
    index: number
  ): Partial<DemoEventSeedItem> | null {
    if (index === 0) {
      const slotTemplates: AppTypes.EventSlotTemplate[] = [
        {
          id: `${sourceId}-slot-1`,
          startAt: '2026-04-18T18:30:00',
          endAt: '2026-04-18T20:00:00'
        },
        {
          id: `${sourceId}-slot-2`,
          startAt: '2026-04-18T20:15:00',
          endAt: '2026-04-18T22:15:00'
        }
      ].map(slot => this.rebaseSeedSlotTemplate(slot));
      return {
        timeframe: 'Every Sat · Apr 18 - Jun 20',
        startAt: this.rebaseSeedDateTime('2026-04-18T18:00:00'),
        endAt: this.rebaseSeedDateTime('2026-06-20T23:00:00'),
        frequency: 'Weekly',
        ticketing: true,
        visibility: 'Public',
        slotsEnabled: true,
        slotTemplates,
        pricing: this.buildSyntheticCheckoutPricing(38, slotTemplates),
        policies: this.buildSyntheticPolicies(),
        subEvents: this.buildSyntheticCheckoutSubEvents({
          sourceId,
          firstSlotStartAt: slotTemplates[0]?.startAt ?? this.rebaseSeedDateTime('2026-04-18T18:30:00'),
          firstSlotEndAt: slotTemplates[0]?.endAt ?? this.rebaseSeedDateTime('2026-04-18T20:00:00'),
          includePaidOptional: true
        }),
        shortDescription: 'Weekly tasting series with optional paid extras and host approval before payment.'
      };
    }

    if (index === 1) {
      const firstSlotStartAt = this.rebaseSeedDateTime('2026-05-03T19:10:00');
      const firstSlotEndAt = this.rebaseSeedDateTime('2026-05-03T20:30:00');
      return {
        timeframe: 'May 3 · 7:00 PM - 10:00 PM',
        startAt: this.rebaseSeedDateTime('2026-05-03T19:00:00'),
        endAt: this.rebaseSeedDateTime('2026-05-03T22:00:00'),
        frequency: 'One-time',
        ticketing: true,
        visibility: 'Public',
        slotsEnabled: false,
        slotTemplates: [],
        pricing: this.buildSyntheticCheckoutPricing(22),
        policies: this.buildSyntheticPolicies(),
        subEvents: this.buildSyntheticCheckoutSubEvents({
          sourceId,
          firstSlotStartAt,
          firstSlotEndAt,
          includePaidOptional: true
        }),
        shortDescription: 'Late-night tasting event with optional add-ons and host approval before payment.'
      };
    }

    if (index === 2) {
      const slotTemplates: AppTypes.EventSlotTemplate[] = [
        {
          id: `${sourceId}-slot-1`,
          startAt: '2026-04-19T13:00:00',
          endAt: '2026-04-19T14:15:00'
        },
        {
          id: `${sourceId}-slot-2`,
          startAt: '2026-04-19T15:00:00',
          endAt: '2026-04-19T16:30:00'
        }
      ].map(slot => this.rebaseSeedSlotTemplate(slot));
      return {
        timeframe: 'Every Sun · Apr 19 - May 31',
        startAt: this.rebaseSeedDateTime('2026-04-19T12:30:00'),
        endAt: this.rebaseSeedDateTime('2026-05-31T18:00:00'),
        frequency: 'Weekly',
        ticketing: false,
        visibility: 'Public',
        slotsEnabled: true,
        slotTemplates,
        pricing: PricingBuilder.createDefaultPricingConfig('event'),
        policies: [],
        subEvents: this.buildSyntheticCheckoutSubEvents({
          sourceId,
          firstSlotStartAt: slotTemplates[0]?.startAt ?? this.rebaseSeedDateTime('2026-04-19T13:00:00'),
          firstSlotEndAt: slotTemplates[0]?.endAt ?? this.rebaseSeedDateTime('2026-04-19T14:15:00'),
          includePaidOptional: false
        }),
        shortDescription: 'Checkout demo: free recurring event with multiple slots, so you can test slot picking and join requests only.'
      };
    }

    return null;
  }

  private rebaseSeedSlotTemplate(slot: AppTypes.EventSlotTemplate): AppTypes.EventSlotTemplate {
    return {
      ...slot,
      startAt: this.rebaseSeedDateTime(slot.startAt),
      endAt: this.rebaseSeedDateTime(slot.endAt)
    };
  }

  private rebaseSeedDateTime(value: string): string {
    return DemoSeedScheduleBuilder.rebaseDateTime(value) ?? value;
  }

  private buildSyntheticPolicies(): AppTypes.EventPolicyItem[] {
    return [
      {
        id: 'policy-checkin-window',
        title: 'Check-in window',
        description: 'Arrive within the first 15 minutes of your selected slot so the organizer can release late spots.',
        required: true
      },
      {
        id: 'policy-cancellation',
        title: 'Cancellation',
        description: 'Optional extras are refundable only until 24 hours before the selected slot starts.',
        required: true
      },
      {
        id: 'policy-media',
        title: 'Photos & recap',
        description: 'Highlights may be shared privately with attendees after the event.',
        required: false
      }
    ];
  }

  private buildSyntheticCheckoutPricing(
    basePrice: number,
    slotTemplates: readonly AppTypes.EventSlotTemplate[] = []
  ): AppTypes.PricingConfig {
    const pricing = PricingBuilder.createSamplePricingConfig(slotTemplates.length > 0 ? 'hybrid' : 'fixed');
    pricing.enabled = true;
    pricing.basePrice = basePrice;
    pricing.minPrice = Math.max(0, basePrice - 12);
    pricing.maxPrice = basePrice + 48;
    pricing.currency = 'USD';
    pricing.chargeType = 'per_attendee';
    pricing.audience.enabled = false;
    pricing.audience.promoCodes = [];
    if (slotTemplates.length > 0) {
      pricing.slotPricingEnabled = true;
      pricing.slotOverrides = slotTemplates.map((slot, index) => ({
        id: `${slot.id}-override`,
        slotId: slot.id,
        label: `Slot ${index + 1}`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        price: basePrice + (index * 6),
        currency: 'USD'
      }));
    } else {
      pricing.slotPricingEnabled = false;
      pricing.slotOverrides = [];
    }
    return pricing;
  }

  private buildSyntheticCheckoutSubEvents(options: {
    sourceId: string;
    firstSlotStartAt: string;
    firstSlotEndAt: string;
    includePaidOptional: boolean;
  }): AppTypes.SubEventFormItem[] {
    const includedPricing = PricingBuilder.createDefaultPricingConfig('subevent');
    const addOnPricing = PricingBuilder.createDefaultPricingConfig('subevent');
    addOnPricing.enabled = true;
    addOnPricing.basePrice = options.includePaidOptional ? 16 : 0;
    addOnPricing.currency = 'USD';
    addOnPricing.chargeType = 'per_booking';
    addOnPricing.minPrice = options.includePaidOptional ? 12 : 0;
    addOnPricing.maxPrice = options.includePaidOptional ? 24 : 0;

    const transportPricing = PricingBuilder.createDefaultPricingConfig('subevent');
    transportPricing.enabled = true;
    transportPricing.basePrice = 8;
    transportPricing.currency = 'USD';
    transportPricing.chargeType = 'per_attendee';
    transportPricing.minPrice = 6;
    transportPricing.maxPrice = 12;

    return [
      {
        id: `${options.sourceId}-main-session`,
        name: 'Main Session',
        description: 'Included in the event price and aligned to the selected slot.',
        startAt: options.firstSlotStartAt,
        endAt: options.firstSlotEndAt,
        optional: false,
        capacityMin: 0,
        capacityMax: 24,
        membersAccepted: 0,
        membersPending: 0,
        carsPending: 0,
        accommodationPending: 0,
        suppliesPending: 0,
        pricing: includedPricing,
        slotStartOffsetMinutes: 0,
        slotDurationMinutes: 75
      },
      {
        id: `${options.sourceId}-vip-lounge`,
        name: options.includePaidOptional ? 'VIP Lounge Access' : 'Community Lounge Access',
        description: options.includePaidOptional
          ? 'Optional add-on with a separate basket line and room request support.'
          : 'Optional free add-on for the free slot flow.',
        startAt: options.firstSlotStartAt,
        endAt: options.firstSlotEndAt,
        optional: true,
        capacityMin: 0,
        capacityMax: 10,
        membersAccepted: 0,
        membersPending: 0,
        carsPending: 0,
        accommodationPending: 0,
        suppliesPending: 0,
        accommodationCapacityMin: 0,
        accommodationCapacityMax: options.includePaidOptional ? 4 : 0,
        pricing: addOnPricing,
        slotStartOffsetMinutes: 20,
        slotDurationMinutes: 45
      },
      {
        id: `${options.sourceId}-ride-share`,
        name: 'Ride-share Pickup',
        description: 'Optional transport add-on so the checkout can show an asset-style request too.',
        startAt: options.firstSlotStartAt,
        endAt: options.firstSlotEndAt,
        optional: true,
        capacityMin: 0,
        capacityMax: 12,
        membersAccepted: 0,
        membersPending: 0,
        carsPending: 0,
        accommodationPending: 0,
        suppliesPending: 0,
        carsCapacityMin: 0,
        carsCapacityMax: 3,
        pricing: options.includePaidOptional ? transportPricing : includedPricing,
        slotStartOffsetMinutes: 0,
        slotDurationMinutes: 20
      }
    ];
  }

  private buildFeaturedFriendsOnlyEvents(
    userById: Map<string, { initials: string; city: string }>
  ): Record<string, DemoEventSeedItem[]> {
    const buildItem = (
      userId: string,
      id: string,
      title: string,
      shortDescription: string,
      startAt: string,
      endAt: string,
      topics: string[]
    ): DemoEventSeedItem => {
      const user = userById.get(userId);
      const start = new Date(startAt);
      const end = new Date(endAt);
      return {
        id,
        avatar: user?.initials ?? AppUtils.initialsFromText(title),
        title,
        shortDescription,
        timeframe: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        activity: 2,
        isAdmin: false,
        creatorUserId: userId,
        startAt,
        endAt,
        distanceKm: 4,
        visibility: 'Friends only',
        blindMode: 'Open Event',
        imageUrl: `https://picsum.photos/seed/${id}/1200/700`,
        sourceLink: `https://example.com/events/${id}`,
        location: user?.city ? `${user.city} · Friends Circle` : 'Friends Circle',
        capacityMin: 6,
        capacityMax: 14,
        topics,
        rating: 8.4,
        boost: 96
      };
    };

    return {
      u2: [
        buildItem(
          'u2',
          'fx-u2-1',
          'Friends Circle Supper',
          'Small-table meetup for close connections and plus-ones.',
          '2026-03-17T18:30:00',
          '2026-03-17T21:30:00',
          ['#StreetFood', '#GoingOut']
        )
      ],
      u3: [
        buildItem(
          'u3',
          'fx-u3-1',
          'Studio Friends Jam',
          'Invite-only creative session with music and critique rounds.',
          '2026-03-17T19:30:00',
          '2026-03-17T22:00:00',
          ['#Music', '#Creativity']
        )
      ],
      u4: [
        buildItem(
          'u4',
          'fx-u4-1',
          'Friends Wellness Walk',
          'Relaxed sunset walk for friends of friends from recent events.',
          '2026-03-17T20:00:00',
          '2026-03-17T22:00:00',
          ['#Meditation', '#Spirituality']
        )
      ]
    };
  }

  private mergeSeededRecords(
    current: DemoEventRecordCollection,
    seeded: DemoEventRecordCollection
  ): { table: DemoEventRecordCollection; changed: boolean } {
    const nextById: Record<string, DemoEventRecord> = { ...current.byId };
    const seededRecordKeys = new Set(seeded.ids);
    const nextIds = current.ids.filter(recordKey => {
      const currentRecord = current.byId[recordKey];
      if (!currentRecord) {
        return false;
      }
      if (this.isGeneratedSlotRecord(currentRecord)) {
        delete nextById[recordKey];
        return false;
      }
      if (seededRecordKeys.has(recordKey) || !this.isObsoleteSyntheticSeededRecord(currentRecord)) {
        return true;
      }
      delete nextById[recordKey];
      return false;
    });
    let changed = false;

    if (nextIds.length !== current.ids.length) {
      changed = true;
    }

    for (const recordKey of seeded.ids) {
      const seededRecord = seeded.byId[recordKey];
      if (!seededRecord) {
        continue;
      }
      const currentRecord = current.byId[recordKey];
      if (!currentRecord) {
        nextById[recordKey] = DemoEventsRepositoryBuilder.cloneRecord(seededRecord);
        nextIds.push(recordKey);
        changed = true;
        continue;
      }
      const mergedRecord = this.mergeSeededRecord(currentRecord, seededRecord);
      if (JSON.stringify(currentRecord) !== JSON.stringify(mergedRecord)) {
        nextById[recordKey] = mergedRecord;
        changed = true;
      }
    }

    return {
      table: {
        byId: nextById,
        ids: nextIds
      },
      changed
    };
  }

  private isObsoleteSyntheticSeededRecord(record: DemoEventRecord): boolean {
    return record.type === 'events' && record.id.startsWith('ex-');
  }

  private mergeSeededRecord(current: DemoEventRecord, seeded: DemoEventRecord): DemoEventRecord {
    const creatorUserId = this.resolveSeededCreatorUserId(current, seeded);
    const creatorChanged = creatorUserId !== current.creatorUserId;
    const shouldPreferSeededSyntheticIdentity = current.id.startsWith('ex-');
    const shouldPreferSeededVisibility = current.id.startsWith('ex-');
    const shouldPreferSeededTopics = current.id.startsWith('ex-');
    const shouldPreferSeededSchedule = shouldPreferSeededSyntheticIdentity
      || this.hasSeededScheduleChanged(current, seeded);
    const topics = this.normalizeTopics(current.topics ?? []);

    return {
      ...current,
      avatar: shouldPreferSeededSyntheticIdentity ? seeded.avatar : current.avatar,
      title: shouldPreferSeededSyntheticIdentity ? seeded.title : current.title,
      subtitle: shouldPreferSeededSyntheticIdentity ? seeded.subtitle : current.subtitle,
      timeframe: shouldPreferSeededSchedule ? seeded.timeframe : current.timeframe,
      creatorUserId,
      creatorName: creatorChanged || !current.creatorName?.trim() ? seeded.creatorName : current.creatorName,
      creatorInitials: creatorChanged || !current.creatorInitials?.trim() ? seeded.creatorInitials : current.creatorInitials,
      creatorGender: current.creatorGender === 'woman' || current.creatorGender === 'man'
        ? current.creatorGender
        : seeded.creatorGender,
      creatorCity: current.creatorCity?.trim() || seeded.creatorCity,
      visibility: shouldPreferSeededVisibility
        ? seeded.visibility
        : this.normalizeVisibility(current.visibility, seeded.visibility),
      blindMode: this.normalizeBlindMode(current.blindMode, seeded.blindMode),
      startAtIso: shouldPreferSeededSchedule ? seeded.startAtIso : (current.startAtIso?.trim() || seeded.startAtIso),
      endAtIso: shouldPreferSeededSchedule ? seeded.endAtIso : (current.endAtIso?.trim() || seeded.endAtIso),
      distanceKm: Number.isFinite(current.distanceKm) ? current.distanceKm : seeded.distanceKm,
      imageUrl: current.imageUrl?.trim() || seeded.imageUrl,
      sourceLink: current.sourceLink?.trim() || seeded.sourceLink,
      location: current.location?.trim() || seeded.location,
      locationCoordinates: this.normalizeLocationCoordinates(current.locationCoordinates)
        ?? this.normalizeLocationCoordinates(seeded.locationCoordinates),
      capacityMin: this.normalizeCount(current.capacityMin) ?? seeded.capacityMin,
      capacityMax: this.normalizeCount(current.capacityMax) ?? seeded.capacityMax,
      capacityTotal: this.normalizeCount(current.capacityTotal) ?? seeded.capacityTotal,
      autoInviter: shouldPreferSeededSchedule
        ? seeded.autoInviter
        : (typeof current.autoInviter === 'boolean' ? current.autoInviter : seeded.autoInviter),
      frequency: shouldPreferSeededSchedule ? seeded.frequency : (current.frequency?.trim() || seeded.frequency),
      ticketing: shouldPreferSeededSchedule
        ? seeded.ticketing
        : (typeof current.ticketing === 'boolean' ? current.ticketing : seeded.ticketing),
      pricing: shouldPreferSeededSchedule
        ? (seeded.pricing ? PricingBuilder.clonePricingConfig(seeded.pricing) : null)
        : (current.pricing
            ? PricingBuilder.clonePricingConfig(current.pricing)
            : (seeded.pricing ? PricingBuilder.clonePricingConfig(seeded.pricing) : null)),
      policies: shouldPreferSeededSchedule
        ? EventEditorBuilder.cloneEventEditorPolicies(seeded.policies ?? [])
        : EventEditorBuilder.cloneEventEditorPolicies(current.policies ?? seeded.policies ?? []),
      slotsEnabled: shouldPreferSeededSchedule
        ? seeded.slotsEnabled
        : (typeof current.slotsEnabled === 'boolean' ? current.slotsEnabled : seeded.slotsEnabled),
      slotTemplates: shouldPreferSeededSchedule
        ? EventEditorBuilder.cloneEventEditorSlotTemplates(seeded.slotTemplates ?? [])
        : (current.slotTemplates ?? []).length > 0
        ? EventEditorBuilder.cloneEventEditorSlotTemplates(current.slotTemplates ?? [])
        : EventEditorBuilder.cloneEventEditorSlotTemplates(seeded.slotTemplates ?? []),
      parentEventId: current.parentEventId ?? seeded.parentEventId ?? null,
      slotTemplateId: current.slotTemplateId ?? seeded.slotTemplateId ?? null,
      generated: typeof current.generated === 'boolean' ? current.generated : seeded.generated,
      eventType: current.eventType ?? seeded.eventType ?? 'main',
      nextSlot: current.nextSlot ? { ...current.nextSlot } : (seeded.nextSlot ? { ...seeded.nextSlot } : null),
      upcomingSlots: (current.upcomingSlots ?? seeded.upcomingSlots ?? []).map(item => ({ ...item })),
      isAdmin: current.isAdmin,
      acceptedMembers: this.normalizeCount(current.acceptedMembers) ?? seeded.acceptedMembers,
      pendingMembers: this.normalizeCount(current.pendingMembers) ?? seeded.pendingMembers,
      topics: shouldPreferSeededTopics
        ? [...seeded.topics]
        : (topics.length > 0 ? topics : [...seeded.topics]),
      subEvents: shouldPreferSeededSchedule
        ? this.cloneSubEvents(seeded.subEvents)
        : (this.cloneSubEvents(current.subEvents) ?? this.cloneSubEvents(seeded.subEvents)),
      subEventsDisplayMode: shouldPreferSeededSchedule
        ? (seeded.subEventsDisplayMode
          ?? (this.cloneSubEvents(seeded.subEvents)?.length
            ? DemoEventSeedBuilder.inferredSubEventsDisplayMode(this.cloneSubEvents(seeded.subEvents)!)
            : 'Casual'))
        : (current.subEventsDisplayMode
        ?? seeded.subEventsDisplayMode
        ?? (this.cloneSubEvents(current.subEvents)?.length
          ? DemoEventSeedBuilder.inferredSubEventsDisplayMode(this.cloneSubEvents(current.subEvents)!)
          : 'Casual')),
      rating: Number.isFinite(current.rating) ? Number(current.rating) : seeded.rating,
      boost: Number.isFinite(current.boost) ? Number(current.boost) : seeded.boost,
      affinity: Number.isFinite(current.affinity)
        ? Math.max(0, Math.trunc(Number(current.affinity)))
        : seeded.affinity
    };
  }

  private hasSeededScheduleChanged(current: DemoEventRecord, seeded: DemoEventRecord): boolean {
    return current.timeframe !== seeded.timeframe
      || current.startAtIso !== seeded.startAtIso
      || current.endAtIso !== seeded.endAtIso
      || `${current.frequency ?? ''}` !== `${seeded.frequency ?? ''}`
      || current.ticketing !== seeded.ticketing
      || current.autoInviter !== seeded.autoInviter
      || current.slotsEnabled !== seeded.slotsEnabled
      || JSON.stringify(current.slotTemplates ?? []) !== JSON.stringify(seeded.slotTemplates ?? [])
      || JSON.stringify(current.subEvents ?? []) !== JSON.stringify(seeded.subEvents ?? [])
      || JSON.stringify(current.policies ?? []) !== JSON.stringify(seeded.policies ?? [])
      || JSON.stringify(current.pricing ?? null) !== JSON.stringify(seeded.pricing ?? null);
  }

  private resolveSeededCreatorUserId(current: DemoEventRecord, seeded: DemoEventRecord): string {
    const currentCreatorUserId = current.creatorUserId?.trim() ?? '';
    if (!currentCreatorUserId) {
      return seeded.creatorUserId;
    }
    if (!current.isAdmin && current.type !== 'hosting' && currentCreatorUserId === current.userId && seeded.creatorUserId !== current.userId) {
      return seeded.creatorUserId;
    }
    return currentCreatorUserId;
  }

  private normalizeVisibility(
    value: DemoEventRecord['visibility'] | undefined,
    fallback: DemoEventRecord['visibility']
  ): DemoEventRecord['visibility'] {
    if (value === 'Public' || value === 'Friends only' || value === 'Invitation only') {
      return value;
    }
    return fallback;
  }

  private normalizeBlindMode(
    value: DemoEventRecord['blindMode'] | undefined,
    fallback: DemoEventRecord['blindMode']
  ): DemoEventRecord['blindMode'] {
    if (value === 'Open Event' || value === 'Blind Event') {
      return value;
    }
    return fallback;
  }

  private materializeSlotRecords(): void {
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const preferredParents = this.computePreferredEventRecords(table)
      .filter(record => this.isSlotParentRecord(record));
    if (preferredParents.length === 0) {
      return;
    }

    const nextById = { ...table.byId };
    const nextIds = [...table.ids];
    let changed = false;

    for (const parent of preferredParents) {
      const generatedRecords = this.buildGeneratedSlotRecordsForParent(parent, table);
      for (const record of generatedRecords) {
        const recordKey = DemoEventsRepositoryBuilder.buildRecordKey(record.userId, record.type, record.id);
        const current = nextById[recordKey];
        if (!current) {
          nextById[recordKey] = record;
          if (!nextIds.includes(recordKey)) {
            nextIds.push(recordKey);
          }
          changed = true;
        }
      }
    }

    if (!changed) {
      return;
    }

    this.memoryDb.write(currentState => ({
      ...currentState,
      [EVENTS_TABLE_NAME]: {
        byId: nextById,
        ids: nextIds
      }
    }));
  }

  private buildGeneratedSlotRecordsForParent(
    parent: DemoEventRecord,
    table: DemoEventRecordCollection
  ): DemoEventRecord[] {
    const parentStart = this.parseEventDate(parent.startAtIso);
    const parentEnd = this.parseEventDate(parent.endAtIso);
    if (!parentStart || !parentEnd) {
      return [];
    }

    const scheduleAnchorMs = DemoSeedScheduleBuilder.anchorDate().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const horizonStart = new Date(Math.max(parentStart.getTime(), scheduleAnchorMs - dayMs));
    const horizonEnd = new Date(Math.min(parentEnd.getTime(), scheduleAnchorMs + (45 * dayMs)));
    if (horizonEnd.getTime() < horizonStart.getTime()) {
      return [];
    }

    const records: DemoEventRecord[] = [];
    const templates = parent.slotTemplates ?? [];
    const overrideDates = new Set(
      templates
        .map(template => this.slotOverrideDateKey(template.overrideDate))
        .filter((value): value is string => Boolean(value))
    );
    for (const template of templates) {
      if (this.slotOverrideDateKey(template.overrideDate) || template.closed === true) {
        continue;
      }
      const templateStart = this.parseEventDate(template.startAt);
      const templateEnd = this.parseEventDate(template.endAt);
      if (!templateStart || !templateEnd) {
        continue;
      }
      const durationMs = Math.max(60 * 60 * 1000, templateEnd.getTime() - templateStart.getTime());
      const starts = this.generateSlotOccurrenceStarts(parent.frequency ?? 'One-time', templateStart, horizonStart, horizonEnd);
      for (const startAt of starts) {
        const occurrenceDateKey = this.slotOccurrenceAnchorDateKey(startAt, templateStart, parentStart);
        if (occurrenceDateKey && overrideDates.has(occurrenceDateKey)) {
          continue;
        }
        const endAt = new Date(startAt.getTime() + durationMs);
        if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
          continue;
        }
        const sourceId = this.buildGeneratedSlotSourceId(parent.id, template.id, startAt);
        const existing = this.computePreferredEventRecords(table)
          .find(record => record.id === sourceId && this.isGeneratedSlotRecord(record))
          ?? null;
        if (existing) {
          continue;
        }
        const capacityTotal = Math.max(0, parent.capacityTotal);
        records.push({
          id: sourceId,
          userId: parent.creatorUserId || parent.userId,
          type: 'events',
          avatar: parent.avatar,
          title: parent.title,
          subtitle: parent.subtitle,
          timeframe: this.buildGeneratedSlotTimeframe(startAt, endAt),
          inviter: null,
          unread: 0,
          activity: 0,
          isAdmin: true,
          isInvitation: false,
          isHosting: false,
          isTrashed: false,
          published: parent.published,
          trashedAtIso: null,
          creatorUserId: parent.creatorUserId,
          creatorName: parent.creatorName,
          creatorInitials: parent.creatorInitials,
          creatorGender: parent.creatorGender,
          creatorCity: parent.creatorCity,
          visibility: parent.visibility,
          blindMode: parent.blindMode,
          startAtIso: startAt.toISOString(),
          endAtIso: endAt.toISOString(),
          distanceKm: parent.distanceKm,
          imageUrl: parent.imageUrl,
          sourceLink: parent.sourceLink,
          location: parent.location,
          locationCoordinates: this.normalizeLocationCoordinates(parent.locationCoordinates),
          capacityMin: parent.capacityMin,
          capacityMax: parent.capacityMax,
          capacityTotal,
          autoInviter: parent.autoInviter,
          frequency: parent.frequency,
          ticketing: parent.ticketing,
          slotsEnabled: false,
          slotTemplates: [],
          parentEventId: parent.id,
          slotTemplateId: template.id,
          generated: true,
          eventType: 'slot',
          nextSlot: null,
          upcomingSlots: [],
          acceptedMembers: 0,
          pendingMembers: 0,
          topics: [...parent.topics],
          subEvents: this.materializeSubEventsForSlotOccurrence(parent.subEvents, startAt, endAt) ?? undefined,
          subEventsDisplayMode: parent.subEventsDisplayMode,
          rating: parent.rating,
          boost: parent.boost,
          affinity: parent.affinity
        });
      }
    }
    for (const template of templates) {
      const overrideDateKey = this.slotOverrideDateKey(template.overrideDate);
      if (!overrideDateKey) {
        continue;
      }
      if (template.closed === true) {
        continue;
      }
      const templateStart = this.parseEventDate(template.startAt);
      const templateEnd = this.parseEventDate(template.endAt);
      if (!templateStart || !templateEnd) {
        continue;
      }
      const startAt = new Date(templateStart);
      const endAt = new Date(templateEnd);
      if (endAt.getTime() <= startAt.getTime()) {
        endAt.setTime(startAt.getTime() + (60 * 60 * 1000));
      }
      if (startAt.getTime() < horizonStart.getTime() || startAt.getTime() > horizonEnd.getTime()) {
        continue;
      }
      if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
        continue;
      }
      const sourceId = this.buildGeneratedSlotSourceId(parent.id, template.id, startAt);
      const existing = this.computePreferredEventRecords(table)
        .find(record => record.id === sourceId && this.isGeneratedSlotRecord(record))
        ?? null;
      if (existing) {
        continue;
      }
      const capacityTotal = Math.max(0, parent.capacityTotal);
      records.push({
        id: sourceId,
        userId: parent.creatorUserId || parent.userId,
        type: 'events',
        avatar: parent.avatar,
        title: parent.title,
        subtitle: parent.subtitle,
        timeframe: this.buildGeneratedSlotTimeframe(startAt, endAt),
        inviter: null,
        unread: 0,
        activity: 0,
        isAdmin: true,
        isInvitation: false,
        isHosting: false,
        isTrashed: false,
        published: parent.published,
        trashedAtIso: null,
        creatorUserId: parent.creatorUserId,
        creatorName: parent.creatorName,
        creatorInitials: parent.creatorInitials,
        creatorGender: parent.creatorGender,
        creatorCity: parent.creatorCity,
        visibility: parent.visibility,
        blindMode: parent.blindMode,
        startAtIso: startAt.toISOString(),
        endAtIso: endAt.toISOString(),
        distanceKm: parent.distanceKm,
        imageUrl: parent.imageUrl,
        sourceLink: parent.sourceLink,
        location: parent.location,
        locationCoordinates: this.normalizeLocationCoordinates(parent.locationCoordinates),
        capacityMin: parent.capacityMin,
        capacityMax: parent.capacityMax,
        capacityTotal,
        autoInviter: parent.autoInviter,
        frequency: parent.frequency,
        ticketing: parent.ticketing,
        slotsEnabled: false,
        slotTemplates: [],
        parentEventId: parent.id,
        slotTemplateId: template.id,
        generated: true,
        eventType: 'slot',
        nextSlot: null,
        upcomingSlots: [],
        acceptedMembers: 0,
        pendingMembers: 0,
        topics: [...parent.topics],
        subEvents: this.materializeSubEventsForSlotOccurrence(parent.subEvents, startAt, endAt) ?? undefined,
        subEventsDisplayMode: parent.subEventsDisplayMode,
        rating: parent.rating,
        boost: parent.boost,
        affinity: parent.affinity
      });
    }
    return records;
  }

  private withResolvedSlotContext(record: DemoEventRecord, table: DemoEventRecordCollection): DemoEventRecord {
    if (!this.isSlotParentRecord(record)) {
      return {
        ...record,
        nextSlot: null,
        upcomingSlots: []
      };
    }
    const upcomingSlots = this.resolveUpcomingSlotOccurrences(record.id, table);
    return {
      ...record,
      nextSlot: upcomingSlots[0] ?? null,
      upcomingSlots
    };
  }

  private resolveUpcomingSlotOccurrences(
    parentEventId: string,
    table: DemoEventRecordCollection
  ): AppTypes.EventSlotOccurrence[] {
    const nowMs = Date.now() - (60 * 60 * 1000);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoEventRecord => Boolean(record))
      .filter(record => this.isGeneratedSlotRecord(record) && record.parentEventId === parentEventId)
      .filter(record => !record.isTrashed)
      .filter(record => new Date(record.endAtIso).getTime() >= nowMs)
      .sort((left, right) => new Date(left.startAtIso).getTime() - new Date(right.startAtIso).getTime())
      .map(record => ({
        id: record.id,
        parentEventId,
        slotTemplateId: record.slotTemplateId ?? '',
        title: record.title,
        timeframe: record.timeframe,
        startAtIso: record.startAtIso,
        endAtIso: record.endAtIso,
        capacityTotal: record.capacityTotal,
        acceptedMembers: record.acceptedMembers,
        pendingMembers: record.pendingMembers
      }));
  }

  private isGeneratedSlotRecord(record: DemoEventRecord | null | undefined): boolean {
    return Boolean(record?.generated) || record?.eventType === 'slot' || Boolean(record?.parentEventId);
  }

  private isSlotParentRecord(record: DemoEventRecord | null | undefined): boolean {
    return Boolean(record?.slotsEnabled) && !this.isGeneratedSlotRecord(record) && (record?.slotTemplates?.length ?? 0) > 0;
  }

  private buildGeneratedSlotSourceId(parentEventId: string, slotTemplateId: string, startAt: Date): string {
    return `${parentEventId}:slot:${slotTemplateId}:${startAt.toISOString()}`;
  }

  private buildGeneratedSlotTimeframe(startAt: Date, endAt: Date): string {
    const dateLabel = startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startLabel = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endLabel = endAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateLabel} · ${startLabel} - ${endLabel}`;
  }

  private generateSlotOccurrenceStarts(
    frequency: string,
    templateStart: Date,
    horizonStart: Date,
    horizonEnd: Date
  ): Date[] {
    const normalizedFrequency = `${frequency ?? ''}`.trim().toLowerCase();
    if (normalizedFrequency === 'one-time' || !normalizedFrequency) {
      return templateStart.getTime() >= horizonStart.getTime() && templateStart.getTime() <= horizonEnd.getTime()
        ? [new Date(templateStart)]
        : [];
    }

    const starts: Date[] = [];
    const cursor = new Date(horizonStart);
    cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(horizonEnd);
    endDate.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endDate.getTime()) {
      if (this.matchesSlotFrequency(cursor, templateStart, normalizedFrequency)) {
        const next = new Date(cursor);
        next.setHours(templateStart.getHours(), templateStart.getMinutes(), templateStart.getSeconds(), templateStart.getMilliseconds());
        if (next.getTime() >= horizonStart.getTime() && next.getTime() <= horizonEnd.getTime()) {
          starts.push(next);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return starts;
  }

  private matchesSlotFrequency(date: Date, templateStart: Date, frequency: string): boolean {
    if (frequency === 'daily') {
      return true;
    }
    if (frequency === 'weekly') {
      return date.getDay() === templateStart.getDay();
    }
    if (frequency === 'bi-weekly' || frequency === 'biweekly') {
      if (date.getDay() !== templateStart.getDay()) {
        return false;
      }
      const diffDays = Math.floor((date.getTime() - templateStart.getTime()) / (24 * 60 * 60 * 1000));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    }
    if (frequency === 'monthly') {
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    if (frequency === 'yearly' || frequency === 'annual' || frequency === 'annually') {
      if (date.getMonth() !== templateStart.getMonth()) {
        return false;
      }
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    return false;
  }

  private parseEventDate(value: string | null | undefined): Date | null {
    if (!value?.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private slotOverrideDateKey(value: string | null | undefined): string | null {
    const parsed = this.parseEventDate(value?.includes('T') ? value : `${value ?? ''}T00:00`);
    if (!parsed) {
      return null;
    }
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private slotOccurrenceAnchorDateKey(occurrenceStart: Date, templateStart: Date, parentStart: Date): string | null {
    const templateOffsetMs = templateStart.getTime() - parentStart.getTime();
    return this.slotOverrideDateKey(new Date(occurrenceStart.getTime() - templateOffsetMs).toISOString());
  }

  private normalizeLocationCoordinates(value: unknown): DemoEventRecord['locationCoordinates'] {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const latitude = Number((value as { latitude?: unknown }).latitude);
    const longitude = Number((value as { longitude?: unknown }).longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return {
      latitude,
      longitude
    };
  }
}
