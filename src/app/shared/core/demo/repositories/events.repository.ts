import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import {
  APP_DEMO_DATA,
  DEMO_EVENT_DATES_BY_ID,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  type EventMenuItem
} from '../../../demo-data';
import { AppMemoryDb } from '../../base/db';
import { DemoEventsRepositoryBuilder } from '../builders';
import {
  EVENTS_TABLE_NAME,
  type DemoEventActivitiesQuery,
  type DemoEventActivitiesQueryResult,
  type DemoEventExploreQuery,
  type DemoEventExploreQueryResult,
  type DemoEventRecord,
  type DemoEventRecordCollection,
  type DemoEventScopeFilter,
  type DemoRepositoryEventItemType
} from '../models/events.model';
import type { ActivitiesEventSyncPayload } from '../../../activities-models';
import { USERS_TABLE_NAME } from '../models/users.model';
import type { LocationCoordinates } from '../../base/interfaces';

interface DemoEventActivitiesCursor {
  id: string;
  distanceMeters: number;
  relevance: number;
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
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 30;
  private readonly memoryDb = inject(AppMemoryDb);
  private initialized = false;

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
    return this.queryUserRecords(userId).filter(record => record.isTrashed);
  }

  queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): DemoEventRecord[] {
    this.init();
    const userItems = this.queryUserRecords(userId);
    const activeEventItems = userItems
      .filter(record => record.type === 'events')
      .filter(record => !record.isAdmin)
      .filter(record => !record.isTrashed);
    const invitationItems = userItems
      .filter(record => record.isInvitation)
      .filter(record => !record.isTrashed);
    const myEventItems = userItems
      .filter(record => record.type === 'events')
      .filter(record => record.isAdmin)
      .filter(record => !record.isTrashed);
    const draftItems = myEventItems.filter(record => record.published === false);

    if (filter === 'all') {
      return [...activeEventItems, ...invitationItems, ...myEventItems];
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
      return userItems.filter(record => record.isTrashed);
    }
    return activeEventItems;
  }

  queryActivitiesEventPage(query: DemoEventActivitiesQuery): DemoEventActivitiesQueryResult {
    this.init();
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }

    const filteredRecords = this.queryEventItemsByFilter(
      normalizedUserId,
      query.filter,
      query.hostingPublicationFilter ?? 'all'
    );
    const viewerCoordinates = this.queryUserLocationCoordinates(normalizedUserId);
    const normalizedRecords = filteredRecords
      .map(record => this.withResolvedDistance(record, viewerCoordinates))
      .sort((left, right) => this.compareActivitiesRecords(left, right, query));
    const total = normalizedRecords.length;

    if (query.view === 'week' || query.view === 'month') {
      return {
        records: normalizedRecords,
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
      records,
      total,
      nextCursor
    };
  }

  queryExploreItems(userId: string): DemoEventRecord[] {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const byEventId = new Map<string, DemoEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || !this.shouldIncludeExploreRecord(record, normalizedUserId)) {
        continue;
      }
      const existing = byEventId.get(record.id);
      if (!existing || this.shouldPreferExploreRecord(record, existing)) {
        byEventId.set(record.id, DemoEventsRepositoryBuilder.cloneRecord(record));
      }
    }

    return [...byEventId.values()].map(record => DemoEventsRepositoryBuilder.cloneRecord(record));
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
    const normalizedRecords = this.queryExploreItems(normalizedUserId)
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

  syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): void {
    this.init();
    const normalizedId = payload.id.trim();
    const creatorUserId = payload.creatorUserId?.trim() ?? '';
    if (!normalizedId || !creatorUserId) {
      return;
    }

    const creatorName = payload.creatorName?.trim() || 'Unknown Host';
    const creatorInitials = payload.creatorInitials?.trim() || AppUtils.initialsFromText(creatorName);
    const startAtIso = payload.startAt?.trim() || new Date().toISOString();
    const endAtIso = payload.endAt?.trim()
      || new Date(new Date(startAtIso).getTime() + (2 * 60 * 60 * 1000)).toISOString();
    const acceptedMemberUserIds = this.normalizeUserIds(payload.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(payload.pendingMemberUserIds);
    const acceptedMembers = this.normalizeCount(payload.acceptedMembers) ?? acceptedMemberUserIds.length;
    const pendingMembers = this.normalizeCount(payload.pendingMembers) ?? pendingMemberUserIds.length;
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
        capacityTotal,
        acceptedMemberUserIds,
        pendingMemberUserIds
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
      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });
  }

  trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      isTrashed: true,
      trashedAtIso: new Date().toISOString()
    });
  }

  restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.init();
    this.updateItemState(userId, type, sourceId, {
      isTrashed: false,
      trashedAtIso: null
    });
  }

  isItemTrashed(userId: string, type: DemoRepositoryEventItemType, sourceId: string): boolean {
    this.init();
    const record = this.findItem(userId, type, sourceId);
    return record?.isTrashed === true;
  }

  countTicketItemsByUser(userId: string): number {
    this.init();
    const eventItems = this.queryEventItemsByUser(userId);
    const hostingItems = this.queryHostingItemsByUser(userId);
    return (
      eventItems.filter(item => APP_DEMO_DATA.eventTicketingById[item.id] === true).length +
      hostingItems.filter(item => APP_DEMO_DATA.eventTicketingById[item.id] === true).length
    );
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    this.init();
    const eventItems = this.queryEventItemsByUser(userId);
    const nowMs = Date.now();
    const basePendingCount = eventItems.filter(item => {
      if (item.isAdmin) {
        return false;
      }
      const startMs = new Date(DEMO_EVENT_DATES_BY_ID[item.id] ?? '').getTime();
      return Number.isFinite(startMs) && nowMs >= startMs + feedbackUnlockDelayMs;
    }).length;

    return basePendingCount + AppDemoGenerators.syntheticPendingEventFeedbackCount(
      eventItems.length,
      DemoEventsRepository.MIN_DEMO_EVENT_ITEMS_PER_USER,
      nowMs,
      feedbackUnlockDelayMs
    );
  }

  private updateItemState(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string,
    updates: Pick<DemoEventRecord, 'isTrashed' | 'trashedAtIso'>
  ): void {
    const recordKey = this.resolveRecordKey(userId, type, sourceId);
    if (!recordKey) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const current = table.byId[recordKey];
      if (!current) {
        return state;
      }
      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordKey]: {
              ...current,
              ...updates
            }
          },
          ids: [...table.ids]
        }
      };
    });
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
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoEventRecord => Boolean(record))
      .filter(record => record.userId === normalizedUserId)
      .map(record => DemoEventsRepositoryBuilder.cloneRecord(record));
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
          || this.relevanceOrderValue(left) - this.relevanceOrderValue(right)
          || this.timestampOrderValue(right) - this.timestampOrderValue(left)
          || this.compareRecordIdentity(left, right);
      }
      return this.distanceOrderValue(left) - this.distanceOrderValue(right)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    if (query.secondaryFilter === 'relevant') {
      return this.dayOrderValue(left) - this.dayOrderValue(right)
        || this.relevanceOrderValue(left) - this.relevanceOrderValue(right)
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
      relevance: cursor.relevance,
      startAtIso: new Date(cursor.startAtMs).toISOString()
    };
    return this.compareActivitiesRecords(record, cursorRecord, query);
  }

  private buildActivitiesCursor(record: DemoEventRecord): DemoEventActivitiesCursor {
    return {
      id: record.id,
      distanceMeters: this.distanceOrderValue(record),
      relevance: this.relevanceOrderValue(record),
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
        || !Number.isFinite(parsed.relevance)
        || !Number.isFinite(parsed.startAtMs)
      ) {
        return null;
      }
      return {
        id: parsed.id,
        distanceMeters: Math.max(0, Math.trunc(Number(parsed.distanceMeters))),
        relevance: Math.max(0, Number(parsed.relevance)),
        startAtMs: Math.trunc(Number(parsed.startAtMs))
      };
    } catch {
      return null;
    }
  }

  private distanceOrderValue(record: DemoEventRecord): number {
    return Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000));
  }

  private relevanceOrderValue(record: DemoEventRecord): number {
    return Math.max(0, Number(record.relevance) || 0);
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
        return [distanceMeters, isPast, affinityDistance, startAtMs];
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
      return [isPast, dayKey, affinityDistance, startAtMs];
    }
    return [isPast, dayKey, startAtMs, distanceMeters];
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
      ...record.acceptedMemberUserIds
    ].some(userId =>
      userId !== activeUserId && AppDemoGenerators.isFriendOfActiveUser(userId, activeUserId)
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
    if (record.published === false) {
      return false;
    }
    if (record.creatorUserId === activeUserId) {
      return false;
    }
    if (record.visibility === 'Invitation only') {
      return false;
    }
    if (record.visibility === 'Friends only' && !AppDemoGenerators.isFriendOfActiveUser(record.creatorUserId, activeUserId)) {
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
      acceptedMemberUserIds: string[];
      pendingMemberUserIds: string[];
    }
  ): DemoEventRecord {
    const existing = this.findItem(context.userId, context.type, payload.id) ?? this.findItem(context.userId, 'events', payload.id);
    const visibility = payload.visibility ?? existing?.visibility ?? (context.isHosting ? 'Invitation only' : 'Public');
    const blindMode = payload.blindMode ?? existing?.blindMode ?? 'Open Event';
    const topics = this.normalizeTopics(payload.topics ?? existing?.topics ?? []);
    const rating = existing?.rating ?? (6 + ((AppDemoGenerators.hashText(`${context.type}:${payload.id}:${payload.title}`) % 35) / 10));
    const relevance = existing?.relevance ?? (50 + (AppDemoGenerators.hashText(`${context.type}:${payload.id}:${payload.title}`) % 51));
    const usersTable = this.memoryDb.read()[USERS_TABLE_NAME];
    const creator = usersTable.byId[context.userId] ?? null;
    const acceptedUsers = context.acceptedMemberUserIds
      .map(userId => usersTable.byId[userId] ?? null);
    const affinity = AppDemoGenerators.resolveEventAffinity({
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
      isAdmin: true,
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
      acceptedMembers: context.acceptedMembers,
      pendingMembers: context.pendingMembers,
      acceptedMemberUserIds: [...context.acceptedMemberUserIds],
      pendingMemberUserIds: [...context.pendingMemberUserIds],
      topics,
      rating,
      relevance,
      affinity
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

  private normalizeUserIds(userIds: readonly string[] | undefined): string[] {
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

  private buildSeededRecords(): DemoEventRecordCollection {
    const eventsByUser = this.buildEventsByUserWithSyntheticSeed();
    return DemoEventsRepositoryBuilder.buildRecordCollection({
      invitationsByUser: DEMO_INVITATIONS_BY_USER,
      eventsByUser,
      hostingByUser: DEMO_HOSTING_BY_USER,
      publishedById: APP_DEMO_DATA.hostingPublishedById
    });
  }

  private buildEventsByUserWithSyntheticSeed(): Record<string, readonly EventMenuItem[]> {
    const users = AppDemoGenerators.buildExpandedDemoUsers(50);
    const userById = new Map(users.map(user => [user.id, user]));
    const seeded: Record<string, readonly EventMenuItem[]> = {};
    const featuredFriendsOnlyByUser = this.buildFeaturedFriendsOnlyEvents(userById);
    const userIds = Array.from(new Set([
      ...Object.keys(DEMO_EVENTS_BY_USER),
      ...Object.keys(featuredFriendsOnlyByUser)
    ]));

    for (const userId of userIds) {
      const items = DEMO_EVENTS_BY_USER[userId] ?? [];
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
      const synthetic: EventMenuItem[] = [];
      const needed = DemoEventsRepository.MIN_DEMO_EVENT_ITEMS_PER_USER - baseItems.length;

      for (let index = 0; index < needed; index += 1) {
        const seq = baseItems.length + index + 1;
        const id = `ex-${userId}-${seq}`;
        const start = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0);
        const end = new Date(start.getTime() + ((2 + (index % 3)) * 60 * 60 * 1000));
        const visibility = seq === 12
          ? 'Friends only'
          : ((index % 2) === 0 ? 'Friends only' : 'Public');
        const blindMode = (index % 5) === 0 ? 'Blind Event' : 'Open Event';
        const seed = AppDemoGenerators.hashText(`${userId}:${id}:${seq}`);

        synthetic.push({
          id,
          avatar: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Synthetic Event'),
          title: `Pagination Test Event ${seq}`,
          shortDescription: `Synthetic feed item ${seq} to validate activities infinite loading.`,
          timeframe: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          activity: (index % 5) + 1,
          isAdmin: (seq % 4) === 0,
          creatorUserId: userId,
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
          relevance: 50 + (seed % 51)
        });
      }

      seeded[userId] = [...baseItems, ...synthetic];
    }

    return seeded;
  }

  private buildFeaturedFriendsOnlyEvents(
    userById: Map<string, { initials: string; city: string }>
  ): Record<string, EventMenuItem[]> {
    const buildItem = (
      userId: string,
      id: string,
      title: string,
      shortDescription: string,
      startAt: string,
      endAt: string,
      topics: string[]
    ): EventMenuItem => {
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
        relevance: 96
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
    const nextIds = [...current.ids];
    let changed = false;

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

  private mergeSeededRecord(current: DemoEventRecord, seeded: DemoEventRecord): DemoEventRecord {
    const creatorUserId = this.resolveSeededCreatorUserId(current, seeded);
    const creatorChanged = creatorUserId !== current.creatorUserId;
    const shouldPreferSeededVisibility = current.id.startsWith('ex-');
    const shouldPreferSeededTopics = current.id.startsWith('ex-');
    const acceptedMemberUserIds = this.normalizeUserIds(current.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(current.pendingMemberUserIds);
    const topics = this.normalizeTopics(current.topics ?? []);

    return {
      ...current,
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
      startAtIso: current.startAtIso?.trim() || seeded.startAtIso,
      endAtIso: current.endAtIso?.trim() || seeded.endAtIso,
      distanceKm: Number.isFinite(current.distanceKm) ? current.distanceKm : seeded.distanceKm,
      imageUrl: current.imageUrl?.trim() || seeded.imageUrl,
      sourceLink: current.sourceLink?.trim() || seeded.sourceLink,
      location: current.location?.trim() || seeded.location,
      locationCoordinates: this.normalizeLocationCoordinates(current.locationCoordinates)
        ?? this.normalizeLocationCoordinates(seeded.locationCoordinates),
      capacityMin: this.normalizeCount(current.capacityMin) ?? seeded.capacityMin,
      capacityMax: this.normalizeCount(current.capacityMax) ?? seeded.capacityMax,
      capacityTotal: this.normalizeCount(current.capacityTotal) ?? seeded.capacityTotal,
      acceptedMembers: this.normalizeCount(current.acceptedMembers) ?? seeded.acceptedMembers,
      pendingMembers: this.normalizeCount(current.pendingMembers) ?? seeded.pendingMembers,
      acceptedMemberUserIds: acceptedMemberUserIds.length > 0
        ? acceptedMemberUserIds
        : [...seeded.acceptedMemberUserIds],
      pendingMemberUserIds: pendingMemberUserIds.length > 0
        ? pendingMemberUserIds
        : [...seeded.pendingMemberUserIds],
      topics: shouldPreferSeededTopics
        ? [...seeded.topics]
        : (topics.length > 0 ? topics : [...seeded.topics]),
      rating: Number.isFinite(current.rating) ? Number(current.rating) : seeded.rating,
      relevance: Number.isFinite(current.relevance) ? Number(current.relevance) : seeded.relevance,
      affinity: Number.isFinite(current.affinity)
        ? Math.max(0, Math.trunc(Number(current.affinity)))
        : seeded.affinity
    };
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
