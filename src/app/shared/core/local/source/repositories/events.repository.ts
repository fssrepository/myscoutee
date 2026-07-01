import { EVENT_FEEDBACK_TABLE_NAME, EVENTS_TABLE_NAME } from '../entity/event.entity';
import type { ActivityEventRecordCollection } from '../entity/event.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalActivitySubEventStageRuntimeMapper } from '../mappers/activity.mapper';
import { LocalActivityEventsMapper } from '../mappers/event.mapper';

import { UserProfileState } from '../../../common/user-profile-state';
import {
  ActivityEventDetailDTO,
  type ActivityEventExploreQuery,
  type ActivityEventExploreQueryResult,
  type ActivityEventRecord,
  type ActivityEventSubEventsQueryDTO,
  type ActivityEventScopeFilter,
  type ActivityEventRepositoryItemType
} from '../../../contracts/activity.interface';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME,
  ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME,
  type ActivityMemberRecord,
  type ActivityMembersRecordCollection,
  type ActivitySubEventGroupRecord,
  type ActivitySubEventGroupsRecordCollection,
  type ActivitySubEventStageRuntimeRecord,
  type ActivitySubEventStageRuntimeRecordCollection
} from '../entity/activity.entity';
import type * as ContractTypes from '../../../contracts';

import type { LocationCoordinates } from '../../../contracts/user.interface';
import type * as ActivityContracts from '../../../contracts/activity.interface';

import type * as AppConstants from '../../../common/constants';
interface ActivityEventActivitiesCursor {
  id: string;
  distanceMeters: number;
  boost: number;
  startAtMs: number;
}

interface ActivityEventActivitiesRecordQueryResult {
  records: ActivityEventRecord[];
  total: number;
  nextCursor: string | null;
}

interface ActivityEventActivitiesPageOptions {
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter;
  sort: ContractTypes.ActivityEventActivitiesSort;
  view: ContractTypes.ActivitiesView;
}

interface ActivityEventSubEventsRecordResult {
  parentEventId: string;
  parentRecord: ActivityEventRecord;
}

type ActivityEventExploreSortTuple = readonly [number, number, number, number];

interface ActivityEventExploreCursor {
  id: string;
  tuple: ActivityEventExploreSortTuple;
}

@Injectable({
  providedIn: 'root'
})
export class LocalEventsRepository {
  private static readonly AFFINITY_DISTANCE_BOOST_SCALE = 10_000;
  private static readonly SLOT_READ_MODEL_USER_ID = '__slot_read_model__';
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly localScoreEntriesByGroupKey = new Map<string, ContractTypes.SubEventLeaderboardScoreEntry[]>();
  private readonly localFifaMatchesByGroupKey = new Map<string, ContractTypes.SubEventLeaderboardFifaMatch[]>();

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId);
  }

  queryInvitationItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId).filter(record => this.isInvitationRecordForUser(record, userId));
  }

  queryEventItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId)
      .filter(record => !this.isEventAdminRecord(record, userId))
      .filter(record => !this.isInvitationRecordForUser(record, userId));
  }

  queryFeedbackCandidateItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId)
      .filter(record => !this.isTrashStatus(record))
      .filter(record => !this.isInvitationRecordForUser(record, userId))
      .filter(record => this.isAcceptedEventRecord(record, userId));
  }

  queryItemsByUsers(userIds: readonly string[]): Map<string, ActivityEventRecord[]> {
    return this.queryUserRecordsByUsers(userIds, this.memoryDb.read()[EVENTS_TABLE_NAME]);
  }

  queryEventItemsByUsers(userIds: readonly string[]): Map<string, ActivityEventRecord[]> {
    const recordsByUserId = this.queryUserRecordsByUsers(userIds, this.memoryDb.read()[EVENTS_TABLE_NAME]);
    return new Map(
      [...recordsByUserId.entries()].map(([userId, records]) => [
        userId,
        records
          .filter(record => !this.isEventAdminRecord(record, userId))
          .filter(record => !this.isInvitationRecordForUser(record, userId))
      ])
    );
  }

  queryHostingItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId).filter(record => this.isEventAdminRecord(record, userId));
  }

  queryTrashedItemsByUser(userId: string): ActivityEventRecord[] {
    return this.queryUserRecords(userId).filter(record => this.isTrashStatus(record));
  }

  private queryEventRecordsByFilter(
    userId: string,
    filter: ActivityEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): ActivityEventRecord[] {
    const userItems = this.queryUserRecords(userId);
    const memberEventItems = userItems
      .filter(record => !this.isEventAdminRecord(record, userId))
      .filter(record => !this.isInvitationRecordForUser(record, userId))
      .filter(record => !this.isTrashStatus(record))
      .filter(record => this.isAcceptedEventRecord(record, userId) || this.isPendingEventRecord(record, userId));
    const pendingEventItems = memberEventItems
      .filter(record => this.isPendingEventRecord(record, userId) || this.isPendingReviewStatus(record));
    const activeEventItems = memberEventItems
      .filter(record => this.isAcceptedEventRecord(record, userId) && !this.isPendingReviewStatus(record));
    const invitationItems = userItems
      .filter(record => this.isInvitationRecordForUser(record, userId))
      .filter(record => !this.isTrashStatus(record));
    const myEventItems = userItems
      .filter(record => this.isEventAdminRecord(record, userId))
      .filter(record => !this.isTrashStatus(record));
    const draftItems = myEventItems.filter(record => this.isDraftStatus(record.status));
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
      return userItems.filter(record => this.isTrashStatus(record));
    }
    return activeEventItems;
  }

  private isPendingEventRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isEventAdminRecord(record, normalizedUserId)) {
      return false;
    }
    if (this.eventAcceptedMemberUserIds(record).includes(normalizedUserId)) {
      return false;
    }
    return this.eventPendingRequestMemberUserIds(record).includes(normalizedUserId);
  }

  private isPendingReviewStatus(record: ActivityEventRecord): boolean {
    const status = this.normalizeEventStatus(record.status);
    return status === 'UR' || status === 'B';
  }

  private isTrashStatus(record: ActivityEventRecord): boolean {
    const status = this.normalizeEventStatus(record.status);
    return status === 'T';
  }

  private restoredStatusForRecord(record: ActivityEventRecord): ActivityEventRecord['status'] {
    const previous = this.normalizeEventStatus(record.statusBeforeSuppression);
    if (previous && !['UR', 'B', 'D', 'I', 'T'].includes(previous)) {
      return previous as ActivityEventRecord['status'];
    }
    return 'A';
  }

  private normalizeEventStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'A':
        return 'A';
      case 'DR':
        return 'DR';
      case 'T':
        return 'T';
      case 'UR':
        return 'UR';
      case 'B':
        return 'B';
      case 'D':
        return 'D';
      case 'I':
        return 'I';
      default:
        return 'A';
    }
  }

  private isPublishedStatus(status: string | null | undefined): boolean {
    return this.normalizeEventStatus(status) === 'A';
  }

  private isDraftStatus(status: string | null | undefined): boolean {
    return this.normalizeEventStatus(status) === 'DR';
  }

  private resolveStageActionTarget(action: string, reason?: string | null): {
    action: string;
    nextStatus: ContractTypes.TournamentStageStatus;
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

  private canApplyStageAction(action: string, stages: readonly ContractTypes.SubEventDTO[], stageIndex: number): boolean {
    const stage = stages[stageIndex];
    const status = this.normalizeStageStatus(stage?.stageStatus);
    switch (action) {
      case 'start-tournament':
        return status === 'RS' && this.hasStageDatePassed(stage?.startAt);
      case 'close-stage':
        return (status === 'A' || status === 'RS') && this.hasStageDatePassed(stage?.endAt);
      case 'finalize-stage':
        return status === 'SR';
      case 'reopen-scores':
        return status === 'F' && this.canReopenScores(stages, stageIndex);
      case 'suspend-tournament':
        return status === 'A' && this.isStageInScheduleWindow(stage);
      case 'resume-tournament':
        return status === 'S';
      default:
        return false;
    }
  }

  private stageActionNextStatus(
    actionTarget: {
      action: string;
      nextStatus: ContractTypes.TournamentStageStatus;
    },
    stage: ContractTypes.SubEventDTO | null | undefined
  ): ContractTypes.TournamentStageStatus {
    return actionTarget.action === 'resume-tournament' && !this.hasStageDatePassed(stage?.endAt)
      ? 'A'
      : actionTarget.nextStatus;
  }

  private isStageStartAllowed(stages: readonly ContractTypes.SubEventDTO[], stageIndex: number): boolean {
    if (stageIndex < 0 || stageIndex >= stages.length) {
      return false;
    }
    if (stageIndex === 0) {
      return true;
    }
    return this.normalizeStageStatus(stages[stageIndex - 1]?.stageStatus) === 'F';
  }

  private canReopenScores(stages: readonly ContractTypes.SubEventDTO[], stageIndex: number): boolean {
    return stageIndex >= 0 && stageIndex < stages.length;
  }

  private isStageInScheduleWindow(stage: ContractTypes.SubEventDTO | null | undefined): boolean {
    const startMs = Date.parse(`${stage?.startAt ?? ''}`);
    const endMs = Date.parse(`${stage?.endAt ?? ''}`);
    const nowMs = Date.now();
    return Number.isFinite(startMs)
      && Number.isFinite(endMs)
      && startMs <= nowMs
      && nowMs <= endMs;
  }

  private hasStageDatePassed(value: string | null | undefined): boolean {
    const parsed = Date.parse(`${value ?? ''}`);
    return Number.isFinite(parsed) && parsed <= Date.now();
  }

  private toStageActionResult(
    sourceId: string,
    stage: ContractTypes.SubEventDTO | null | undefined,
    stageIndex: number,
    action: string,
    autoInviter?: boolean | null
  ): ActivityContracts.ActivityEventStageActionResultDTO | null {
    if (!stage) {
      return null;
    }
    return {
      sourceId,
      subEventId: `${stage.id ?? ''}`.trim() || null,
      subEventIndex: Math.max(0, Math.trunc(Number(stageIndex) || 0)),
      action,
      stageStatus: `${stage.stageStatus ?? ''}`.trim() || 'RS',
      stageStatusReason: `${stage.stageStatusReason ?? ''}`.trim() || null,
      stageStatusUpdatedAt: `${stage.stageStatusUpdatedAt ?? ''}`.trim() || null,
      stageFinalizedAt: `${stage.stageFinalizedAt ?? ''}`.trim() || null,
      stageFinalizedByUserId: `${stage.stageFinalizedByUserId ?? ''}`.trim() || null,
      autoInviter: autoInviter ?? null
    };
  }

  private resolveStageIndex(
    stages: readonly ContractTypes.SubEventDTO[],
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

  private normalizeStageStatus(status: string | null | undefined): ContractTypes.TournamentStageStatus {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    if (normalized === 'A' || normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S') {
      return normalized;
    }
    return 'RS';
  }

  private isAcceptedEventRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isEventAdminRecord(record, normalizedUserId)) {
      return false;
    }
    return this.eventAcceptedMemberUserIds(record).includes(normalizedUserId);
  }

  queryActivitiesEventRecordPage(
    userId: string,
    query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>
  ): ActivityEventActivitiesRecordQueryResult {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }

    const secondaryFilter = this.activitiesSecondaryFilter(query);
    const view = this.activitiesView(query);
    const pageOptions: ActivityEventActivitiesPageOptions = {
      secondaryFilter,
      view,
      sort: this.activitiesSort(query, view, secondaryFilter)
    };
    const filteredRecords = this.queryEventRecordsByFilter(
      normalizedUserId,
      this.activitiesEventScopeFilter(query),
      this.activitiesHostingPublicationFilter(query)
    );
    const viewerCoordinates = this.queryUserLocationCoordinates(normalizedUserId);
    const normalizedRecords = filteredRecords
      .map(record => this.withResolvedDistance(record, viewerCoordinates))
      .filter(record => this.matchesActivitiesSecondaryFilter(record, secondaryFilter))
      .sort((left, right) => this.compareActivitiesRecords(left, right, pageOptions));
    const total = normalizedRecords.length;

    if (view === 'week' || view === 'month') {
      return {
        records: normalizedRecords,
        total,
        nextCursor: null
      };
    }

    const cursor = this.parseActivitiesCursor(query.cursor);
    const remaining = cursor
      ? normalizedRecords.filter(record => this.compareRecordToCursor(record, cursor, pageOptions) > 0)
      : normalizedRecords;
    const limit = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
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

  private activitiesEventScopeFilter(
    query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>
  ): ActivityEventScopeFilter {
    const value = query.filters?.eventScopeFilter;
    if (
      value === 'all'
      || value === 'active-events'
      || value === 'pending'
      || value === 'invitations'
      || value === 'my-events'
      || value === 'drafts'
      || value === 'trash'
    ) {
      return value;
    }
    return 'active-events';
  }

  private activitiesHostingPublicationFilter(
    query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>
  ): ContractTypes.HostingPublicationFilter {
    return query.filters?.hostingPublicationFilter === 'drafts' ? 'drafts' : 'all';
  }

  private activitiesSecondaryFilter(
    query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>
  ): ContractTypes.ActivitiesSecondaryFilter {
    const value = query.filters?.secondaryFilter;
    return value === 'relevant' || value === 'past' ? value : 'recent';
  }

  private activitiesView(query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>): ContractTypes.ActivitiesView {
    const value = query.view;
    return value === 'month' || value === 'week' || value === 'distance' ? value : 'day';
  }

  private activitiesSort(
    query: ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>,
    view: ContractTypes.ActivitiesView,
    secondaryFilter: ContractTypes.ActivitiesSecondaryFilter
  ): ContractTypes.ActivityEventActivitiesSort {
    const value = query.sort;
    if (value === 'date' || value === 'distance' || value === 'relevance') {
      return value;
    }
    if (view === 'distance') {
      return 'distance';
    }
    return secondaryFilter === 'relevant' ? 'relevance' : 'date';
  }

  queryExploreItems(userId: string): ActivityEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const byEventId = new Map<string, ActivityEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || this.isGeneratedSlotRecord(record) || !this.shouldIncludeExploreRecord(record, normalizedUserId)) {
        continue;
      }
      const existing = byEventId.get(record.id);
      if (!existing || this.shouldPreferExploreRecord(record, existing)) {
        byEventId.set(record.id, this.withResolvedSlotContext(record, table));
      }
    }

    return [...byEventId.values()];
  }

  queryEventRecordById(userId: string, eventId: string): ActivityEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const record = this.computePreferredEventRecords(table)
      .find(item => item.id === normalizedEventId);
    if (!record) {
      return null;
    }
    const viewerCoordinates = this.queryUserLocationCoordinates(userId);
    return this.withResolvedDistance(
      this.withResolvedSlotContext(record, table),
      viewerCoordinates
    );
  }

  querySubEventsByEventId(
    userId: string,
    eventId: string,
    _query?: ActivityEventSubEventsQueryDTO
  ): ActivityEventSubEventsRecordResult | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const records = table.ids
      .map(id => this.normalizePersistedEventRecord(table.byId[id]))
      .filter((record): record is ActivityEventRecord => Boolean(record));
    const selectedRecord = this.preferredSubEventsDefinitionRecord(
      records.filter(item => item.id === normalizedEventId),
      userId
    );
    if (!selectedRecord) {
      return null;
    }
    const parentEventId = this.isGeneratedSlotRecord(selectedRecord)
      ? `${selectedRecord.parentEventId ?? ''}`.trim() || selectedRecord.id
      : selectedRecord.id;
    const parentRecord = this.preferredSubEventsDefinitionRecord(
      records.filter(item => item.id === parentEventId && !this.isGeneratedSlotRecord(item)),
      userId
    ) ?? selectedRecord;
    return {
      parentEventId,
      parentRecord
    };
  }

  private preferredSubEventsDefinitionRecord(
    records: readonly ActivityEventRecord[],
    userId: string
  ): ActivityEventRecord | null {
    const normalizedUserId = userId.trim();
    let best: ActivityEventRecord | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const record of records) {
      const score = this.subEventsDefinitionRecordScore(record, normalizedUserId);
      if (!best || score > bestScore) {
        best = record;
        bestScore = score;
      }
    }
    return best;
  }

  private subEventsDefinitionRecordScore(record: ActivityEventRecord, userId: string): number {
    const slotTemplateCount = record.slotTemplates?.length ?? 0;
    const definitionCount = record.subEventDefinitions?.length ?? 0;
    const runtimeItemCount = record.subEvents?.length ?? 0;
    return (
      (this.isGeneratedSlotRecord(record) ? -10_000 : 0)
      + (record.userId === userId && record.type === 'hosting' ? 2_000 : 0)
      + (record.creatorUserId === userId ? 1_000 : 0)
      + (record.type === 'hosting' ? 400 : 0)
      + (record.subEventsEnabled === false ? -500 : 100)
      + (record.slotsEnabled === true ? 500 : 0)
      + (slotTemplateCount * 100)
      + (definitionCount * 40)
      + (runtimeItemCount * 10)
      + (this.normalizeEventStatus(record.status) === 'A' ? 5 : 0)
    );
  }

  peekKnownItemById(userId: string, itemId: string): ActivityEventRecord | null {
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

  queryEventExplorePage(query: ActivityEventExploreQuery): ActivityEventExploreQueryResult {
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

  saveEventSnapshot(record: ActivityEventRecord): ActivityEventRecord | null {
    if (!record.id || !record.creatorUserId) {
      return null;
    }

    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      this.upsertRecord(nextById, nextIds, record);
      this.removeResolvedInvitationRecords(nextById, nextIds, record);
      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });
    this.materializeSlotRecords();
    this.syncStageRuntimeGroupCountsForDefinitions(record.id);
    return this.peekKnownItemById(record.creatorUserId, record.id);
  }

  trashItem(userId: string, sourceId: string): void {
    const trashedAtIso = new Date().toISOString();
    this.updateItemStateFromCurrent(userId, sourceId, current => {
      const currentStatus = this.normalizeEventStatus(current.status) as ActivityEventRecord['status'];
      return {
        status: 'T',
        statusBeforeSuppression: currentStatus === 'T'
          ? current.statusBeforeSuppression ?? null
          : currentStatus,
        trashedAtIso
      };
    });
  }

  publishItem(userId: string, sourceId: string): void {
    this.updateItemState(userId, sourceId, {
      status: 'A'
    });
  }

  unpublishItem(userId: string, sourceId: string): void {
    this.updateItemState(userId, sourceId, {
      status: 'DR'
    });
  }

  restoreItem(userId: string, sourceId: string): void {
    this.updateItemStateFromCurrent(userId, sourceId, current => ({
      status: this.restoredStatusForRecord(current),
      statusBeforeSuppression: null,
      trashedAtIso: null
    }));
  }

  private updateItemState(
    userId: string,
    sourceId: string,
    updates: Partial<ActivityEventRecord>
  ): void {
    this.updateItemStateFromCurrent(userId, sourceId, () => updates);
  }

  private updateItemStateFromCurrent(
    userId: string,
    sourceId: string,
    resolveUpdates: (record: ActivityEventRecord) => Partial<ActivityEventRecord>
  ): void {
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      const recordKeys = this.resolveStateRecordKeysFromTable(table, userId, sourceId);
      let changed = false;

      for (const recordKey of recordKeys) {
        const current = table.byId[recordKey];
        if (!current) {
          continue;
        }
        nextById[recordKey] = {
          ...current,
          ...resolveUpdates(current)
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
          ids: nextIds
        }
      };
    });
  }

  takeOverItem(userId: string, sourceId: string): void {
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
          statusBeforeSuppression: null
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

  applyStageAction(request: {
    userId: string;
    sourceId: string;
    slotSourceId?: string | null;
    subEventId?: string | null;
    subEventIndex?: number | null;
    action: string;
    reason?: string | null;
  }): ActivityContracts.ActivityEventStageActionResultDTO | null {
    const normalizedUserId = request.userId.trim();
    const normalizedSourceId = request.sourceId.trim();
    const normalizedSlotSourceId = `${request.slotSourceId ?? ''}`.trim();
    const runtimeOwnerId = normalizedSlotSourceId || normalizedSourceId;
    const actionTarget = this.resolveStageActionTarget(request.action, request.reason);
    if (!normalizedUserId || !normalizedSourceId || !actionTarget) {
      return null;
    }
    let result: ActivityContracts.ActivityEventStageActionResultDTO | null = null;
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const preferred = this.computePreferredEventRecords(table)
        .find(record => record.id === normalizedSourceId);
      if (!preferred || !this.isEventAdminRecord(preferred, normalizedUserId)) {
        return state;
      }
      const preferredSubEvents = normalizedSlotSourceId
        ? this.generatedSlotSubEvents(table, normalizedSourceId, normalizedSlotSourceId)
        : (this.cloneSubEvents(preferred?.subEvents) ?? []);
      const preferredIndex = this.resolveStageIndex(preferredSubEvents, request.subEventId, request.subEventIndex);
      if (preferredIndex < 0 || !this.canApplyStageAction(actionTarget.action, preferredSubEvents, preferredIndex)) {
        if (preferredIndex >= 0) {
          result = this.toStageActionResult(
            runtimeOwnerId,
            preferredSubEvents[preferredIndex],
            preferredIndex,
            actionTarget.action,
            preferred.autoInviter
          );
        }
        return state;
      }

      const nowIso = new Date().toISOString();
      const targetStageId = `${preferredSubEvents[preferredIndex]?.id ?? ''}`.trim();
      if (normalizedSlotSourceId) {
        const nextStatus = this.stageActionNextStatus(actionTarget, preferredSubEvents[preferredIndex]);
        const updatedStage = {
          ...preferredSubEvents[preferredIndex],
          stageStatus: nextStatus,
          stageStatusReason: actionTarget.reason,
          stageStatusUpdatedAt: nowIso,
          stageFinalizedAt: nextStatus === 'F' ? nowIso : null,
          stageFinalizedByUserId: nextStatus === 'F' ? normalizedUserId : null
        };
        result = this.toStageActionResult(
          runtimeOwnerId,
          updatedStage,
          preferredIndex,
          actionTarget.action,
          actionTarget.action === 'start-tournament' ? false : preferred.autoInviter
        );
        if (actionTarget.action !== 'start-tournament') {
          return state;
        }
        const nextById = { ...table.byId };
        let changed = false;
        for (const id of table.ids) {
          const current = table.byId[id];
          if (!current || current.id !== normalizedSourceId) {
            continue;
          }
          nextById[id] = {
            ...current,
            autoInviter: false
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
      }
      const nextById = { ...table.byId };
      let changed = false;
      for (const id of table.ids) {
        const current = table.byId[id];
        if (!current || current.id !== runtimeOwnerId) {
          continue;
        }
        const subEvents = this.cloneSubEvents(current.subEvents) ?? [];
        const stageIndex = this.resolveStageIndex(subEvents, targetStageId, preferredIndex);
        if (stageIndex < 0 || !subEvents[stageIndex]) {
          continue;
        }
        const nextStatus = this.stageActionNextStatus(actionTarget, subEvents[stageIndex]);
        const updatedStage = {
          ...subEvents[stageIndex],
          stageStatus: nextStatus,
          stageStatusReason: actionTarget.reason,
          stageStatusUpdatedAt: nowIso,
          stageFinalizedAt: nextStatus === 'F' ? nowIso : null,
          stageFinalizedByUserId: nextStatus === 'F' ? normalizedUserId : null
        };
        subEvents[stageIndex] = updatedStage;
        if (!result) {
          result = this.toStageActionResult(
            runtimeOwnerId,
            updatedStage,
            stageIndex,
            actionTarget.action,
            actionTarget.action === 'start-tournament' ? false : current.autoInviter
          );
        }
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
    return result;
  }

  private generatedSlotSubEvents(
    table: ActivityEventRecordCollection,
    parentEventId: string,
    slotSourceId: string
  ): ContractTypes.SubEventDTO[] {
    const parentRecord = this.computePreferredEventRecords(table)
      .find(record => record.id === parentEventId) ?? null;
    const slotRecord = table.ids
      .map(id => table.byId[id])
      .find(record => record?.id === slotSourceId && record.parentEventId === parentEventId);
    if (slotRecord) {
      const persisted = this.cloneSubEvents(slotRecord.subEvents) ?? [];
      if (persisted.length > 0) {
        return this.withStageRuntimeStates(persisted, slotSourceId, parentRecord ?? slotRecord);
      }
      const generated = LocalActivityEventsMapper.toSubEventsSlots(parentEventId, slotRecord, null)[0] ?? null;
      if (generated) {
        return this.withStageRuntimeStates(this.cloneSubEvents(generated.subEventItems) ?? [], slotSourceId, parentRecord ?? slotRecord);
      }
    }
    if (!parentRecord) {
      return [];
    }
    const slotDate = this.generatedSlotDateFromSourceId(parentEventId, slotSourceId);
    const queries: ActivityEventSubEventsQueryDTO[] = slotDate
      ? [
          { userId: '', eventId: parentEventId, order: 'upcoming', view: 'day', anchorDate: slotDate, rangeStart: slotDate, rangeEnd: slotDate },
          { userId: '', eventId: parentEventId, order: 'past', view: 'day', anchorDate: slotDate, rangeStart: slotDate, rangeEnd: slotDate }
        ]
      : [
          { userId: '', eventId: parentEventId, order: 'upcoming', view: 'day', anchorDate: null, rangeStart: null, rangeEnd: null },
          { userId: '', eventId: parentEventId, order: 'past', view: 'day', anchorDate: null, rangeStart: null, rangeEnd: null }
        ];
    for (const query of queries) {
      const slot = LocalActivityEventsMapper.toSubEventsSlots(parentEventId, parentRecord, query)
        .find(candidate => candidate.slotSourceId === slotSourceId || candidate.id === slotSourceId) ?? null;
      if (slot) {
        return this.withStageRuntimeStates(this.cloneSubEvents(slot.subEventItems) ?? [], slotSourceId, parentRecord);
      }
    }
    return [];
  }

  private withStageRuntimeStates(
    items: ContractTypes.SubEventDTO[],
    ownerId: string,
    eventRecord: ActivityEventRecord | null = null
  ): ContractTypes.SubEventDTO[] {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    if (!normalizedOwnerId || items.length === 0) {
      return items;
    }
    const table = this.memoryDb.read()[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME] as Partial<ActivitySubEventStageRuntimeRecordCollection> | undefined;
    const byId = table?.byId ?? {};
    return items.map(item => {
      const subEventId = `${item.id ?? ''}`.trim();
      if (!subEventId) {
        return item;
      }
      const record = byId[`${normalizedOwnerId}:${subEventId}`];
      const state = record ? LocalActivitySubEventStageRuntimeMapper.toState(record) : null;
      const groupsCount = this.autoTournamentGroupCount(item, items, eventRecord)
        + this.manualGroupRecords(normalizedOwnerId, subEventId).length;
      return {
        ...item,
        stageStatus: `${state?.stageStatus ?? ''}`.trim() || item.stageStatus,
        stageStatusReason: `${state?.stageStatusReason ?? ''}`.trim() || item.stageStatusReason,
        stageStatusUpdatedAt: `${state?.stageStatusUpdatedAt ?? ''}`.trim() || item.stageStatusUpdatedAt,
        stageFinalizedAt: `${state?.stageFinalizedAt ?? ''}`.trim() || item.stageFinalizedAt,
        stageFinalizedByUserId: `${state?.stageFinalizedByUserId ?? ''}`.trim() || item.stageFinalizedByUserId,
        groupsCount
      };
    });
  }

  private generatedSlotDateFromSourceId(parentEventId: string, slotSourceId: string): string | null {
    const prefix = `${parentEventId}:slot:`;
    if (!slotSourceId.startsWith(prefix)) {
      return null;
    }
    const sourceTail = slotSourceId.slice(prefix.length);
    const dateStart = sourceTail.indexOf(':');
    if (dateStart < 0) {
      return null;
    }
    const date = AppUtils.parseDate(sourceTail.slice(dateStart + 1));
    return date ? date.toISOString().slice(0, 10) : null;
  }

  querySubEventLeaderboard(eventId: string, subEventId: string): ContractTypes.SubEventLeaderboardState | null {
    const normalizedEventId = eventId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedEventId || !normalizedSubEventId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const record = this.computePreferredEventRecords(table)
      .find(item => item.id === normalizedEventId);
    const subEvents = this.runtimeSubEvents(record);
    const stage = subEvents.find(item => `${item.id ?? ''}`.trim() === normalizedSubEventId) ?? null;
    if (!record || !stage) {
      return null;
    }
    const leaderboardType = stage.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score';
    const groups = this.stageGroupsForDisplay(normalizedEventId, stage, subEvents, record).map((group, groupIndex) => {
      const groupId = `${group.id ?? `${normalizedSubEventId}-group-${groupIndex + 1}`}`.trim();
      const memberCount = Math.max(2, Math.trunc(Number(group.capacityMax ?? stage.tournamentGroupCapacityMax ?? stage.capacityMax) || 4));
      const advancePerGroup = Math.max(1, Math.trunc(Number(stage.tournamentAdvancePerGroup) || 1));
      const members = Array.from({ length: memberCount }, (_, memberIndex) => ({
        id: `${groupId}-member-${memberIndex + 1}`,
        name: `Member ${memberIndex + 1}`
      }));
      const scoreEntries = this.localScoreEntriesByGroupKey.get(this.leaderboardGroupKey(normalizedEventId, normalizedSubEventId, groupId)) ?? [];
      const fifaMatches = this.localFifaMatchesByGroupKey.get(this.leaderboardGroupKey(normalizedEventId, normalizedSubEventId, groupId)) ?? [];
      return {
        groupId,
        title: `${group.name ?? `Group ${groupIndex + 1}`}`.trim() || `Group ${groupIndex + 1}`,
        memberCount,
        advancePerGroup,
        advancingMemberIds: this.localAdvancingMemberIds(stage, members, scoreEntries, fifaMatches).slice(0, advancePerGroup),
        members,
        scoreEntries: scoreEntries.map(entry => ({ ...entry })),
        fifaMatches: fifaMatches.map(match => ({ ...match })),
        scoreRows: this.localScoreRows(members, scoreEntries),
        fifaRows: this.localFifaRows(members, fifaMatches)
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

  queryTournamentGroups(query: ContractTypes.EventTournamentGroupsQueryDTO): ContractTypes.EventTournamentGroupsStateDTO | null {
    const normalizedUserId = `${query.userId ?? ''}`.trim();
    const normalizedEventId = `${query.eventId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return null;
    }
    const record = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME])
      .find(item => item.id === normalizedEventId) ?? null;
    return this.buildTournamentGroupsState(normalizedUserId, normalizedEventId, record);
  }

  queryTournamentStageGroups(
    query: ContractTypes.EventTournamentStageGroupsQueryDTO
  ): ContractTypes.EventTournamentGroupDTO[] {
    const normalizedEventId = `${query.eventId ?? ''}`.trim();
    const normalizedSlotId = `${query.slotId ?? ''}`.trim();
    const ownerSourceId = normalizedSlotId || normalizedEventId;
    const normalizedStageId = `${query.stageId ?? ''}`.trim();
    if (!ownerSourceId || !normalizedStageId) {
      return [];
    }
    const records = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
    const record = records
      .find(item => item.id === ownerSourceId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === ownerSourceId)
      ?? (normalizedSlotId
        ? records.find(item => item.id === normalizedEventId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === normalizedEventId) ?? null
        : null);
    const stage = this.runtimeSubEvents(record)
      .find(item => `${item.id ?? ''}`.trim() === normalizedStageId) ?? null;
    if (!stage) {
      return [];
    }
    const stages = this.runtimeSubEvents(record);
    return this.stageGroupsForDisplay(ownerSourceId, stage, stages, record)
      .map((group, groupIndex) => this.tournamentGroupDto(stage, group, groupIndex));
  }

  saveTournamentGroup(request: ContractTypes.EventTournamentGroupUpsertRequestDTO): ContractTypes.EventTournamentGroupsStateDTO | null {
    const actorUserId = `${request.actorUserId ?? ''}`.trim();
    const eventId = `${request.eventId ?? ''}`.trim();
    const slotId = `${request.slotId ?? ''}`.trim();
    const ownerSourceId = slotId || eventId;
    const subEventId = `${request.subEventId ?? ''}`.trim();
    const name = `${request.name ?? ''}`.trim();
    if (!actorUserId || !ownerSourceId || !subEventId || !name) {
      return this.buildTournamentGroupsState(actorUserId, ownerSourceId, null);
    }

    const preferredRecords = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
    const ownerRecord = preferredRecords
      .find(item => item.id === ownerSourceId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === ownerSourceId) ?? null;
    const parentRecord = eventId
      ? preferredRecords.find(item => item.id === eventId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === eventId) ?? null
      : null;
    const definitionRecord = ownerRecord ?? (slotId ? parentRecord : null);
    const permissionRecord = parentRecord ?? ownerRecord;
    if (!definitionRecord || !permissionRecord || !this.isEventAdminRecord(permissionRecord, actorUserId)) {
      return this.buildTournamentGroupsState(actorUserId, ownerSourceId, definitionRecord);
    }

    const groupId = `${request.groupId ?? ''}`.trim();
    const capacityMin = Math.max(0, Math.trunc(Number(request.capacityMin) || 0));
    const capacityMax = Math.max(capacityMin, Math.trunc(Number(request.capacityMax) || capacityMin));
    const stages = this.runtimeSubEvents(definitionRecord);
    const stage = stages
      .find(item => `${item.id ?? ''}`.trim() === subEventId) ?? null;
    this.memoryDb.write(state => {
      const groupsTable = this.normalizeSubEventGroupsCollection(state[ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]);
      const nextGroupId = groupId || this.nextTournamentGroupId(ownerSourceId, subEventId, groupsTable);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const groupOwnerId = this.manualGroupOwnerId(ownerSourceId, subEventId);
      const recordId = this.manualGroupRecordId(ownerSourceId, subEventId, nextGroupId);
      const existing = groupsTable.byId[recordId] ?? null;
      const record: ActivitySubEventGroupRecord = {
        id: recordId,
        status: 'A',
        ownerId: groupOwnerId,
        groupId: nextGroupId,
        name,
        capacityMin,
        capacityMax,
        ownerKey: groupOwnerId,
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs,
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso
      };
      const nextGroupsTable = this.upsertSubEventGroupRecordCollection(groupsTable, record);
      const nextStageRuntimeTable = this.upsertStageRuntimeGroupsCountCollection(
        state[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME],
        nextGroupsTable,
        ownerSourceId,
        subEventId,
        stage,
        stages,
        definitionRecord,
        nowMs,
        nowIso
      );
      return {
        ...state,
        [ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]: nextGroupsTable,
        [ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]: nextStageRuntimeTable
      };
    });
    return this.buildTournamentGroupsState(actorUserId, ownerSourceId, definitionRecord);
  }

  deleteTournamentGroup(request: ContractTypes.EventTournamentGroupDeleteRequestDTO): ContractTypes.EventTournamentGroupsStateDTO | null {
    const actorUserId = `${request.actorUserId ?? ''}`.trim();
    const eventId = `${request.eventId ?? ''}`.trim();
    const slotId = `${request.slotId ?? ''}`.trim();
    const ownerSourceId = slotId || eventId;
    const subEventId = `${request.subEventId ?? ''}`.trim();
    const groupId = `${request.groupId ?? ''}`.trim();
    const preferredRecords = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME]);
    const ownerRecord = preferredRecords
      .find(item => item.id === ownerSourceId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === ownerSourceId) ?? null;
    const parentRecord = eventId
      ? preferredRecords.find(item => item.id === eventId || `${(item as { sourceId?: string }).sourceId ?? ''}`.trim() === eventId) ?? null
      : null;
    const definitionRecord = ownerRecord ?? (slotId ? parentRecord : null);
    const permissionRecord = parentRecord ?? ownerRecord;
    if (!actorUserId || !ownerSourceId || !subEventId || !groupId || !definitionRecord || !permissionRecord || !this.isEventAdminRecord(permissionRecord, actorUserId)) {
      return this.buildTournamentGroupsState(actorUserId, ownerSourceId, definitionRecord);
    }

    const stages = this.runtimeSubEvents(definitionRecord);
    const stage = stages
      .find(item => `${item.id ?? ''}`.trim() === subEventId) ?? null;
    this.memoryDb.write(state => {
      const groupsTable = this.normalizeSubEventGroupsCollection(state[ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]);
      const recordId = this.manualGroupRecordId(ownerSourceId, subEventId, groupId);
      const existing = groupsTable.byId[recordId] ?? null;
      if (!existing) {
        return state;
      }
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const nextGroupsTable = this.upsertSubEventGroupRecordCollection(groupsTable, {
        ...existing,
        status: 'D',
        updatedMs: nowMs,
        updatedAtIso: nowIso
      });
      const nextStageRuntimeTable = this.upsertStageRuntimeGroupsCountCollection(
        state[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME],
        nextGroupsTable,
        ownerSourceId,
        subEventId,
        stage,
        stages,
        definitionRecord,
        nowMs,
        nowIso
      );
      return {
        ...state,
        [ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]: nextGroupsTable,
        [ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]: nextStageRuntimeTable
      };
    });
    this.localScoreEntriesByGroupKey.delete(this.leaderboardGroupKey(ownerSourceId, subEventId, groupId));
    this.localFifaMatchesByGroupKey.delete(this.leaderboardGroupKey(ownerSourceId, subEventId, groupId));
    return this.buildTournamentGroupsState(actorUserId, ownerSourceId, definitionRecord);
  }

  markTournamentGroupsDeletedByParentSubEventIds(parentEventId: string, subEventIds: readonly string[]): number {
    const normalizedParentId = `${parentEventId ?? ''}`.trim();
    const removed = new Set((subEventIds ?? []).map(id => `${id ?? ''}`.trim()).filter(Boolean));
    if (!normalizedParentId || removed.size === 0) {
      return 0;
    }
    let changedCount = 0;
    this.memoryDb.write(state => {
      const table = this.normalizeSubEventGroupsCollection(state[ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]);
      const runtimeTable = this.normalizeStageRuntimeCollection(state[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
      const runtimeGroupOwnerIds = new Set(runtimeTable.ids
        .map(id => runtimeTable.byId[id])
        .filter((record): record is ActivitySubEventStageRuntimeRecord => Boolean(record))
        .filter(record => `${record.status ?? 'A'}`.trim() !== 'D')
        .filter(record => this.isRuntimeOwnerRecord(record.ownerId, normalizedParentId))
        .filter(record => removed.has(`${record.subEventId ?? ''}`.trim()))
        .map(record => record.id));
      let nextTable = table;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      for (const id of table.ids) {
        const record = table.byId[id];
        if (!record || `${record.status ?? 'A'}`.trim() === 'D') {
          continue;
        }
        if (!runtimeGroupOwnerIds.has(record.ownerId)) {
          continue;
        }
        nextTable = this.upsertSubEventGroupRecordCollection(nextTable, {
          ...record,
          status: 'D',
          updatedMs: nowMs,
          updatedAtIso: nowIso
        });
        changedCount += 1;
      }
      return changedCount > 0
        ? {
            ...state,
            [ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]: nextTable
          }
        : state;
    });
    return changedCount;
  }

  private isRuntimeOwnerRecord(ownerId: string, parentEventId: string): boolean {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    const normalizedParentId = `${parentEventId ?? ''}`.trim();
    return Boolean(normalizedOwnerId && normalizedParentId)
      && (normalizedOwnerId === normalizedParentId || normalizedOwnerId.startsWith(`${normalizedParentId}:`));
  }

  upsertSubEventLeaderboardEntry(request: ContractTypes.SubEventLeaderboardEntryUpsertRequestDTO): ContractTypes.SubEventLeaderboardState | null {
    const eventId = `${request.eventId ?? ''}`.trim();
    const subEventId = `${request.subEventId ?? ''}`.trim();
    const groupId = `${request.groupId ?? ''}`.trim();
    if (!eventId || !subEventId || !groupId) {
      return null;
    }
    const key = this.leaderboardGroupKey(eventId, subEventId, groupId);
    if (request.mode === 'Fifa') {
      const homeMemberId = `${request.homeMemberId ?? ''}`.trim();
      const awayMemberId = `${request.awayMemberId ?? ''}`.trim();
      if (!homeMemberId || !awayMemberId || homeMemberId === awayMemberId) {
        return this.querySubEventLeaderboard(eventId, subEventId);
      }
      const pairKey = [homeMemberId, awayMemberId].sort().join(':');
      const matches = [...(this.localFifaMatchesByGroupKey.get(key) ?? [])];
      const index = matches.findIndex(match => [match.homeMemberId, match.awayMemberId].sort().join(':') === pairKey);
      const nextMatch: ContractTypes.SubEventLeaderboardFifaMatch = {
        id: index >= 0 ? matches[index].id : `local-fifa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        stageId: subEventId,
        groupId,
        homeMemberId,
        awayMemberId,
        homeScore: Math.max(0, Math.trunc(Number(request.homeScore) || 0)),
        awayScore: Math.max(0, Math.trunc(Number(request.awayScore) || 0)),
        note: `${request.note ?? ''}`.trim(),
        createdAtMs: Date.now()
      };
      if (index >= 0) {
        matches[index] = nextMatch;
      } else {
        matches.push(nextMatch);
      }
      this.localFifaMatchesByGroupKey.set(key, matches);
      return this.querySubEventLeaderboard(eventId, subEventId);
    }

    const memberId = `${request.memberId ?? ''}`.trim();
    if (!memberId || request.scoreValue === null || request.scoreValue === undefined) {
      return this.querySubEventLeaderboard(eventId, subEventId);
    }
    const scoreEntries = [...(this.localScoreEntriesByGroupKey.get(key) ?? [])];
    scoreEntries.push({
      id: `local-score-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stageId: subEventId,
      groupId,
      memberId,
      value: Math.trunc(Number(request.scoreValue) || 0),
      note: `${request.note ?? ''}`.trim(),
      createdAtMs: Date.now()
    });
    this.localScoreEntriesByGroupKey.set(key, scoreEntries);
    return this.querySubEventLeaderboard(eventId, subEventId);
  }

  requestJoin(
    userId: string,
    sourceId: string,
    slotSourceId: string | null = null,
    accepted = false,
    waitingList = false
  ): ActivityEventRecord | null {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    const normalizedSlotSourceId = slotSourceId?.trim() || '';
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }

    const preferredRecord = this.computePreferredEventRecords(this.memoryDb.read()[EVENTS_TABLE_NAME])
      .find(record => record.id === normalizedSourceId);
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
          .find(record => record?.id === joinedId);
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
        if (!current || !idsToJoin.includes(current.id)) {
          continue;
        }
        const acceptedMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, current.id, 'accepted');
        const pendingMemberUserIds = this.eventMemberUserIdsByStatusFromTable(membersTable, current.id, 'pending');
        const invitedMemberUserIds = this.eventMemberUserIdsByPredicate(membersTable, current.id, member =>
          member.status === 'pending' && this.isInvitationMember(member)
        );
        const pendingRequestMemberUserIds = this.eventMemberUserIdsByPredicate(membersTable, current.id, member =>
          member.status === 'pending' && !this.isInvitationMember(member)
        );
        nextById[recordKey] = {
          ...current,
          acceptedMembers: acceptedMemberUserIds.length,
          pendingMembers: pendingMemberUserIds.length,
          acceptedMemberUserIds,
          pendingMemberUserIds,
          invitedMemberUserIds,
          pendingRequestMemberUserIds,
          capacityTotal: Math.max(acceptedMemberUserIds.length, current.capacityTotal)
        };
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
      .find(record => record.id === (normalizedSlotSourceId || normalizedSourceId))
      ?? preferredRecord;
    return this.buildMembershipProjectionRecord(normalizedUserId, refreshed);
  }

  isItemTrashed(userId: string, sourceId: string): boolean {
    const record = this.findItem(userId, sourceId);
    return !!record && this.isTrashStatus(record);
  }

  countTicketItemsByUser(userId: string): number {
    return this.queryUserRecords(userId)
      .filter(record => !this.isInvitationRecordForUser(record, userId))
      .filter(record => !this.isTrashStatus(record))
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
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    const eventItems = this.queryFeedbackCandidateItemsByUser(normalizedUserId);
    const feedbackTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nowMs = Date.now();
    return eventItems.filter(item => {
      if (this.isEventAdminRecord(item, normalizedUserId)) {
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

  private resolveStateRecordKeys(
    userId: string,
    sourceId: string
  ): string[] {
    return this.resolveStateRecordKeysFromTable(this.memoryDb.read()[EVENTS_TABLE_NAME], userId, sourceId);
  }

  private resolveStateRecordKeysFromTable(
    table: ActivityEventRecordCollection,
    userId: string,
    sourceId: string
  ): string[] {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return [];
    }
    return table.ids
      .filter((recordKey, index, recordKeys) => recordKeys.indexOf(recordKey) === index)
      .filter(recordKey => {
        const record = table.byId[recordKey];
        return !!record
          && record.id === normalizedSourceId
          && (this.isEventAdminRecord(record, normalizedUserId) || record.userId === normalizedUserId);
      });
  }

  private findItem(
    userId: string,
    sourceId: string
  ): ActivityEventRecord | null {
    const recordKey = this.resolveRecordKey(userId, sourceId);
    if (!recordKey) {
      return null;
    }
    const record = this.memoryDb.read()[EVENTS_TABLE_NAME].byId[recordKey];
    return record ? record : null;
  }

  private resolveRecordKey(
    userId: string,
    sourceId: string
  ): string | null {
    const normalizedUserId = userId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedSourceId) {
      return null;
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    return table.ids.find(recordKey => {
      const record = table.byId[recordKey];
      return !!record
        && record.id === normalizedSourceId
        && (
          this.isEventAdminRecord(record, normalizedUserId)
          || record.userId === normalizedUserId
          || this.hasTrackedUserParticipation(record, normalizedUserId)
        );
    }) ?? null;
  }

  private queryUserRecords(userId: string): ActivityEventRecord[] {
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
      .filter((record): record is ActivityEventRecord => Boolean(record))
      .filter(record => record.userId === normalizedUserId)
      .filter(record => this.shouldIncludeUserDirectRecord(record, normalizedUserId, preferredRecordByEventId.get(record.id)))
      .map(record => this.withResolvedSlotContext(record, table));
    const directIds = new Set(directRecords.map(record => record.id));
    const membershipRecords = preferredRecords
      .filter(record => record.creatorUserId !== normalizedUserId)
      .filter(record => !this.isTrashStatus(record))
      .filter(record => !directIds.has(record.id))
      .filter(record => this.hasTrackedUserParticipation(record, normalizedUserId))
      .map(record => this.buildMembershipProjectionRecord(normalizedUserId, this.withResolvedSlotContext(record, table)));
    return [...directRecords, ...membershipRecords];
  }

  private queryUserRecordsByUsers(
    userIds: readonly string[],
    table: ActivityEventRecordCollection
  ): Map<string, ActivityEventRecord[]> {
    const normalizedUserIds = [...new Set(
      userIds
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
        .filter(userId => !this.isSetupRequiredDemoProfile(userId))
    )];
    const recordsByUserId = new Map<string, ActivityEventRecord[]>(
      normalizedUserIds.map(userId => [userId, []])
    );
    if (normalizedUserIds.length === 0) {
      return recordsByUserId;
    }

    const userIdSet = new Set(normalizedUserIds);
    const preferredRecords = this.computePreferredEventRecords(table);
    const preferredRecordByEventId = new Map(preferredRecords.map(record => [record.id, record]));
    const directIdsByUserId = new Map<string, Set<string>>();

    for (const id of table.ids) {
      const record = this.normalizePersistedEventRecord(table.byId[id]);
      const recordUserId = record?.userId?.trim() ?? '';
      if (!record || !userIdSet.has(recordUserId)) {
        continue;
      }
      if (!this.shouldIncludeUserDirectRecord(record, recordUserId, preferredRecordByEventId.get(record.id))) {
        continue;
      }
      recordsByUserId.get(recordUserId)?.push(
        this.withResolvedSlotContext(record, table)
      );
      const directIds = directIdsByUserId.get(recordUserId) ?? new Set<string>();
      directIds.add(record.id);
      directIdsByUserId.set(recordUserId, directIds);
    }

    for (const userId of normalizedUserIds) {
      const directIds = directIdsByUserId.get(userId) ?? new Set<string>();
      const membershipRecords = preferredRecords
        .filter(record => record.creatorUserId !== userId)
        .filter(record => !this.isTrashStatus(record))
        .filter(record => !directIds.has(record.id))
        .filter(record => this.hasTrackedUserParticipation(record, userId))
        .map(record => this.buildMembershipProjectionRecord(userId, this.withResolvedSlotContext(record, table)));
      recordsByUserId.get(userId)?.push(...membershipRecords);
    }

    return recordsByUserId;
  }

  private buildMembershipProjectionRecord(userId: string, record: ActivityEventRecord): ActivityEventRecord {
    const normalizedUserId = userId.trim();
    const pending = this.eventPendingRequestMemberUserIds(record).includes(normalizedUserId);
    return {
      ...record,
      userId,
      type: 'events',
      pendingReason: pending ? (record.pendingReason ?? 'approval') : null
    };
  }

  private shouldIncludeUserDirectRecord(
    record: ActivityEventRecord,
    userId: string,
    preferredRecord: ActivityEventRecord | undefined
  ): boolean {
    if (this.isInvitationRecordForUser(record, userId)) {
      return true;
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    if (this.isEventAdminRecord(record, normalizedUserId)) {
      return true;
    }
    return this.hasTrackedUserParticipation(preferredRecord ?? record, normalizedUserId);
  }

  private hasTrackedUserParticipation(
    record: ActivityEventRecord,
    userId: string
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return false;
    }
    return this.eventAcceptedMemberUserIds(record).includes(normalizedUserId)
      || this.eventPendingRequestMemberUserIds(record).includes(normalizedUserId)
      || this.eventInvitedMemberUserIds(record).includes(normalizedUserId);
  }

  private isSetupRequiredDemoProfile(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId] ?? null;
    return user ? UserProfileState.isEmptyOnboardingProfile(user) : false;
  }

  private computePreferredEventRecords(table: ActivityEventRecordCollection): ActivityEventRecord[] {
    const preferredRecordByEventId = new Map<string, ActivityEventRecord>();

    for (const id of table.ids) {
      const record = this.normalizePersistedEventRecord(table.byId[id]);
      if (!record) {
        continue;
      }
      const current = preferredRecordByEventId.get(record.id);
      if (!current || this.shouldPreferRecord(record, current)) {
        preferredRecordByEventId.set(record.id, record);
      }
    }

    return [...preferredRecordByEventId.values()];
  }

  private shouldPreferRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    const nextActive = this.normalizeEventStatus(next.status) === 'A';
    const currentActive = this.normalizeEventStatus(current.status) === 'A';
    if (nextActive !== currentActive) {
      return nextActive;
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
    record: ActivityEventRecord,
    viewerCoordinates: LocationCoordinates | null
  ): ActivityEventRecord {
    const eventCoordinates = this.normalizeLocationCoordinates(record.locationCoordinates);
    if (!viewerCoordinates || !eventCoordinates) {
      return record;
    }
    const distanceMeters = this.haversineDistanceMeters(viewerCoordinates, eventCoordinates);
    return {
      ...record,
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10
    };
  }

  private compareActivitiesRecords(
    left: ActivityEventRecord,
    right: ActivityEventRecord,
    options: ActivityEventActivitiesPageOptions
  ): number {
    if (options.view === 'distance' || options.sort === 'distance') {
      if (options.secondaryFilter === 'relevant') {
        return this.distanceOrderValue(left) - this.distanceOrderValue(right)
          || this.boostOrderValue(right) - this.boostOrderValue(left)
          || this.timestampOrderValue(right) - this.timestampOrderValue(left)
          || this.compareRecordIdentity(left, right);
      }
      return this.distanceOrderValue(left) - this.distanceOrderValue(right)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    if (options.secondaryFilter === 'relevant') {
      return this.dayOrderValue(left) - this.dayOrderValue(right)
        || this.boostOrderValue(right) - this.boostOrderValue(left)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    if (options.secondaryFilter === 'past') {
      return this.dayOrderValue(right) - this.dayOrderValue(left)
        || this.timestampOrderValue(right) - this.timestampOrderValue(left)
        || this.compareRecordIdentity(left, right);
    }

    return this.dayOrderValue(left) - this.dayOrderValue(right)
      || this.timestampOrderValue(left) - this.timestampOrderValue(right)
      || this.compareRecordIdentity(left, right);
  }

  private compareRecordToCursor(
    record: ActivityEventRecord,
    cursor: ActivityEventActivitiesCursor,
    options: ActivityEventActivitiesPageOptions
  ): number {
    const cursorRecord: ActivityEventRecord = {
      ...record,
      id: cursor.id,
      distanceKm: cursor.distanceMeters / 1000,
      boost: cursor.boost,
      startAtIso: new Date(cursor.startAtMs).toISOString()
    };
    return this.compareActivitiesRecords(record, cursorRecord, options);
  }

  private buildActivitiesCursor(record: ActivityEventRecord): ActivityEventActivitiesCursor {
    return {
      id: record.id,
      distanceMeters: this.distanceOrderValue(record),
      boost: this.boostOrderValue(record),
      startAtMs: this.timestampOrderValue(record)
    };
  }

  private serializeActivitiesCursor(cursor: ActivityEventActivitiesCursor): string {
    return JSON.stringify(cursor);
  }

  private parseActivitiesCursor(value: string | null | undefined): ActivityEventActivitiesCursor | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as Partial<ActivityEventActivitiesCursor>;
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

  private distanceOrderValue(record: ActivityEventRecord): number {
    return Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000));
  }

  private boostOrderValue(record: ActivityEventRecord): number {
    return Math.max(0, Number(record.boost) || 0);
  }

  private resolveActivitiesEndTimestamp(record: ActivityEventRecord): number {
    const endAtMs = AppUtils.toSortableDate(record.endAtIso);
    if (Number.isFinite(endAtMs) && endAtMs > 0) {
      return endAtMs;
    }
    return this.timestampOrderValue(record);
  }

  private isPastActivitiesRecord(record: ActivityEventRecord): boolean {
    return this.resolveActivitiesEndTimestamp(record) <= Date.now();
  }

  private matchesActivitiesSecondaryFilter(
    record: ActivityEventRecord,
    secondaryFilter: ContractTypes.ActivitiesSecondaryFilter
  ): boolean {
    if (secondaryFilter === 'past') {
      return this.isPastActivitiesRecord(record);
    }
    if (secondaryFilter === 'recent' || secondaryFilter === 'relevant') {
      return !this.isPastActivitiesRecord(record);
    }
    return true;
  }

  private timestampOrderValue(record: ActivityEventRecord): number {
    return AppUtils.toSortableDate(record.startAtIso);
  }

  private dayOrderValue(record: ActivityEventRecord): number {
    const timestamp = this.timestampOrderValue(record);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }
    return AppUtils.dateOnly(new Date(timestamp)).getTime();
  }

  private compareRecordIdentity(left: ActivityEventRecord, right: ActivityEventRecord): number {
    return left.id.localeCompare(right.id);
  }

  private compareExploreRecords(
    left: ActivityEventRecord,
    right: ActivityEventRecord,
    query: ActivityEventExploreQuery,
    viewerAffinity: number
  ): number {
    return this.compareExploreSortTuple(
      this.buildEventExploreSortTuple(left, query, viewerAffinity),
      this.buildEventExploreSortTuple(right, query, viewerAffinity)
    ) || this.compareRecordIdentity(left, right);
  }

  private compareEventExploreRecordToCursor(
    record: ActivityEventRecord,
    cursor: ActivityEventExploreCursor,
    query: ActivityEventExploreQuery,
    viewerAffinity: number
  ): number {
    return this.compareExploreSortTuple(
      this.buildEventExploreSortTuple(record, query, viewerAffinity),
      cursor.tuple
    ) || record.id.localeCompare(cursor.id);
  }

  private buildEventExploreCursor(
    record: ActivityEventRecord,
    query: ActivityEventExploreQuery,
    viewerAffinity: number
  ): ActivityEventExploreCursor {
    return {
      id: record.id,
      tuple: this.buildEventExploreSortTuple(record, query, viewerAffinity)
    };
  }

  private serializeEventExploreCursor(cursor: ActivityEventExploreCursor): string {
    return JSON.stringify({
      id: cursor.id,
      tuple: [...cursor.tuple]
    });
  }

  private parseEventExploreCursor(value: string | null | undefined): ActivityEventExploreCursor | null {
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
    record: ActivityEventRecord,
    query: ActivityEventExploreQuery,
    viewerAffinity: number
  ): ActivityEventExploreSortTuple {
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

  private boostAffinityRank(record: ActivityEventRecord, affinityDistance: number): number {
    const score = this.boostOrderValue(record)
      - (Math.max(0, affinityDistance) / LocalEventsRepository.AFFINITY_DISTANCE_BOOST_SCALE);
    return -Math.round(score * 1_000_000);
  }

  private compareExploreSortTuple(
    left: ActivityEventExploreSortTuple,
    right: ActivityEventExploreSortTuple
  ): number {
    for (let index = 0; index < left.length; index += 1) {
      const delta = left[index] - right[index];
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private affinityOrderValue(record: ActivityEventRecord): number {
    return Math.max(0, Math.trunc(Number(record.affinity) || 0));
  }

  private exploreHasFriendGoing(record: ActivityEventRecord, activeUserId: string): boolean {
    return [
      record.creatorUserId,
      ...this.eventAcceptedMemberUserIds(record)
    ].some(userId =>
      userId !== activeUserId && UserProfileState.isFriendOfActiveUser(userId, activeUserId)
    );
  }

  private exploreHasOpenSpots(record: ActivityEventRecord): boolean {
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

  private shouldIncludeExploreRecord(record: ActivityEventRecord, activeUserId: string): boolean {
    if (this.isTrashStatus(record) || this.isInvitationRecordForUser(record, activeUserId)) {
      return false;
    }
    if (!this.isPublishedStatus(record.status)) {
      return false;
    }
    if (record.creatorUserId === activeUserId) {
      return false;
    }
    const acceptedMemberUserIds = this.eventAcceptedMemberUserIds(record);
    const pendingRequestMemberUserIds = this.eventPendingRequestMemberUserIds(record);
    if (acceptedMemberUserIds.includes(activeUserId) || pendingRequestMemberUserIds.includes(activeUserId)) {
      return false;
    }
    if (record.visibility === 'Invitation only') {
      return false;
    }
    if (record.visibility === 'Friends only' && !UserProfileState.isFriendOfActiveUser(record.creatorUserId, activeUserId)) {
      return false;
    }
    return true;
  }

  private shouldPreferExploreRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    const nextPublished = this.isPublishedStatus(next.status);
    const currentPublished = this.isPublishedStatus(current.status);
    if (nextPublished !== currentPublished) {
      return nextPublished;
    }
    return next.activity >= current.activity;
  }

  private upsertRecord(
    byId: Record<string, ActivityEventRecord>,
    ids: string[],
    record: ActivityEventRecord
  ): void {
    const recordKey = `${record.userId}:${record.type}:${record.id}`;
    byId[recordKey] = record;
    if (!ids.includes(recordKey)) {
      ids.push(recordKey);
    }
  }

  private removeResolvedInvitationRecords(
    byId: Record<string, ActivityEventRecord>,
    ids: string[],
    record: ActivityEventRecord
  ): void {
    if (record.type === 'invitations') {
      return;
    }
    const invitedUserIds = new Set(this.eventInvitedMemberUserIds(record));
    const resolvedUserIds = new Set([
      ...this.eventAcceptedMemberUserIds(record),
      ...this.eventPendingRequestMemberUserIds(record)
    ].filter(userId => !invitedUserIds.has(userId)));
    if (resolvedUserIds.size === 0) {
      return;
    }
    const staleRecordKeys = ids.filter(recordKey => {
      const current = byId[recordKey];
      return !!current
        && current.id === record.id
        && current.type === 'invitations'
        && !this.isTrashStatus(current)
        && resolvedUserIds.has(current.userId);
    });
    for (const recordKey of staleRecordKeys) {
      delete byId[recordKey];
      const index = ids.indexOf(recordKey);
      if (index >= 0) {
        ids.splice(index, 1);
      }
    }
  }

  private normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private normalizePersistedEventRecord(record: ActivityEventRecord | null | undefined): ActivityEventRecord | null {
    if (!record) {
      return null;
    }
    return {
      ...record,
      acceptedMembers: this.normalizeCount(record.acceptedMembers) ?? 0,
      pendingMembers: this.normalizeCount(record.pendingMembers) ?? 0,
      acceptedMemberUserIds: this.normalizeUserIds(record.acceptedMemberUserIds),
      pendingMemberUserIds: this.normalizeUserIds(record.pendingMemberUserIds),
      invitedMemberUserIds: this.normalizeUserIds(record.invitedMemberUserIds),
      pendingRequestMemberUserIds: this.normalizeUserIds(record.pendingRequestMemberUserIds),
      policiesEnabled: record.policiesEnabled === true,
      policies: ActivityEventDetailDTO.normalizePolicies(record.policies ?? []),
      slotTemplates: ActivityEventDetailDTO.normalizeSlotTemplates(record.slotTemplates ?? []),
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      topics: this.normalizeTopics(record.topics ?? []),
      subEventsEnabled: record.subEventsEnabled !== false,
      subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(record.subEventDefinitions ?? []),
      subEvents: this.cloneSubEvents(record.subEvents)
    };
  }

  private normalizeActivityMembersCollection(
    table: ActivityMembersRecordCollection | null | undefined
  ): ActivityMembersRecordCollection {
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
    table: ActivityMembersRecordCollection,
    event: ActivityEventRecord,
    userId: string,
    status: AppConstants.ActivityMemberStatus,
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
    const record: ActivityMemberRecord = {
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
      profile: profile ? { ...profile, id: normalizedUserId } as ActivityContracts.ActivityMemberDTO['profile'] : null,
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
    status: AppConstants.ActivityMemberStatus
  ): string[] {
    return this.eventMemberUserIdsByStatusFromTable(
      this.normalizeActivityMembersCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]),
      eventId,
      status
    );
  }

  private eventAcceptedMemberUserIds(record: ActivityEventRecord): string[] {
    const projected = this.normalizeUserIds(record.acceptedMemberUserIds);
    return projected.length > 0 ? projected : this.eventMemberUserIdsByStatus(record.id, 'accepted');
  }

  private eventInvitedMemberUserIds(record: ActivityEventRecord): string[] {
    const projected = this.normalizeUserIds(record.invitedMemberUserIds);
    if (projected.length > 0) {
      return projected;
    }
    const table = this.normalizeActivityMembersCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return this.eventMemberUserIdsByPredicate(table, record.id, member =>
      member.status === 'pending' && this.isInvitationMember(member)
    );
  }

  private eventPendingRequestMemberUserIds(record: ActivityEventRecord): string[] {
    const projected = this.normalizeUserIds(record.pendingRequestMemberUserIds);
    if (projected.length > 0) {
      return projected;
    }
    const table = this.normalizeActivityMembersCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return this.eventMemberUserIdsByPredicate(table, record.id, member =>
      member.status === 'pending' && !this.isInvitationMember(member)
    );
  }

  private isInvitationRecordForUser(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    return !!normalizedUserId && this.eventInvitedMemberUserIds(record).includes(normalizedUserId);
  }

  private isEventAdminRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    return record.creatorUserId === normalizedUserId
      || (record.adminIds ?? []).includes(normalizedUserId);
  }

  private eventMemberUserIdsByStatusFromTable(
    table: ActivityMembersRecordCollection,
    eventId: string,
    status: AppConstants.ActivityMemberStatus
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

  private eventMemberUserIdsByPredicate(
    table: ActivityMembersRecordCollection,
    eventId: string,
    predicate: (member: ActivityMemberRecord) => boolean
  ): string[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    const ownerKey = `event:${normalizedEventId}`;
    const userIds = (table?.idsByOwnerKey?.[ownerKey] ?? [])
      .map(id => table?.byId?.[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record))
      .filter(predicate)
      .map(record => `${record.userId ?? ''}`.trim())
      .filter(Boolean);
    return this.normalizeUserIds(userIds);
  }

  private isInvitationMember(member: ActivityMemberRecord): boolean {
    return member.pendingSource === 'admin'
      || member.requestKind === 'invite'
      || member.requestKind === 'waitlist-invite';
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

  private cloneSubEvents(items: readonly ContractTypes.SubEventDTO[] | undefined): ContractTypes.SubEventDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return ActivityEventDetailDTO.normalizeSubEvents(items);
  }

  private runtimeSubEvents(record: ActivityEventRecord | null | undefined): ContractTypes.SubEventDTO[] {
    const persisted = this.cloneSubEvents(record?.subEvents) ?? [];
    if (persisted.length > 0 || !record) {
      return persisted;
    }
    const definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(record.subEventDefinitions ?? []);
    if (definitions.length === 0) {
      return [];
    }
    const slotStart = AppUtils.parseDate(`${record.startAtIso ?? ''}`.trim()) ?? new Date();
    const items = this.subEventDefinitionTimeline(definitions)
      .map(({ item, startOffsetMinutes, durationMinutes }, index): ContractTypes.SubEventDTO => {
        const stageId = `${item.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`;
        const startAt = new Date(slotStart.getTime() + (startOffsetMinutes * 60 * 1000));
        const endAt = new Date(startAt.getTime() + (durationMinutes * 60 * 1000));
        const isTournamentStage = this.isGeneratedTournamentStageDefinition(item);
        return {
          id: stageId,
          name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
          description: `${item.description ?? ''}`.trim(),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          location: `${item.location ?? ''}`.trim(),
          tournamentGroupCapacityMin: item.tournamentGroupCapacityMin,
          tournamentGroupCapacityMax: item.tournamentGroupCapacityMax,
          tournamentLeaderboardType: item.tournamentLeaderboardType,
          tournamentAdvancePerGroup: item.tournamentAdvancePerGroup,
          optional: item.optional,
          pricing: item.pricing,
          capacityMin: item.capacityMin,
          capacityMax: item.capacityMax,
          membersAccepted: 0,
          membersPending: 0,
          carsPending: 0,
          accommodationPending: 0,
          suppliesPending: 0,
          slotStartOffsetMinutes: startOffsetMinutes,
          slotDurationMinutes: durationMinutes,
          stageStatus: isTournamentStage ? 'RS' : undefined,
          stageStatusReason: isTournamentStage ? 'awaiting-tournament-start' : undefined
        };
      });
    return items.map(item => ({
      ...item,
      groupsCount: this.autoTournamentGroupCount(item, items, record)
    }));
  }

  private buildTournamentGroupsState(
    userId: string,
    eventId: string,
    record: ActivityEventRecord | null
  ): ContractTypes.EventTournamentGroupsStateDTO | null {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (!normalizedEventId || !record) {
      return null;
    }
    const subEvents = this.runtimeSubEvents(record);
    const stages = subEvents
      .map((stage, index) => ({ stage, index }))
      .filter(entry => this.isGeneratedTournamentStage(entry.stage))
      .map(({ stage, index }) => this.tournamentStageDto(normalizedEventId, stage, index, subEvents, record));
    return {
      eventId: normalizedEventId,
      title: `${record.title ?? ''}`.trim(),
      subtitle: `${record.subtitle ?? record.timeframe ?? ''}`.trim(),
      canManage: this.isEventAdminRecord(record, `${userId ?? ''}`.trim()),
      stages
    };
  }

  private tournamentStageDto(
    ownerSourceId: string,
    stage: ContractTypes.SubEventDTO,
    index: number,
    stages: readonly ContractTypes.SubEventDTO[],
    eventRecord: ActivityEventRecord | null
  ): ContractTypes.EventTournamentStageDTO {
    const subEventId = `${stage.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`;
    return {
      subEventId,
      title: `${stage.name ?? `Stage ${index + 1}`}`.trim() || `Stage ${index + 1}`,
      description: `${stage.description ?? ''}`.trim(),
      location: `${stage.location ?? ''}`.trim(),
      startAt: `${stage.startAt ?? ''}`.trim(),
      endAt: `${stage.endAt ?? ''}`.trim(),
      stageNumber: index + 1,
      stageStatus: `${stage.stageStatus ?? ''}`.trim(),
      leaderboardType: stage.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      advancePerGroup: Math.max(0, Math.trunc(Number(stage.tournamentAdvancePerGroup) || 0)),
      groups: this.stageGroupsForDisplay(ownerSourceId, stage, stages, eventRecord)
        .map((group, groupIndex) => this.tournamentGroupDto(stage, group, groupIndex))
    };
  }

  private tournamentGroupDto(
    stage: ContractTypes.SubEventDTO,
    group: ContractTypes.SubEventGroupDTO,
    groupIndex: number
  ): ContractTypes.EventTournamentGroupDTO {
    const capacityMin = Math.max(0, Math.trunc(Number(group.capacityMin) || 0));
    const capacityMax = Math.max(capacityMin, Math.trunc(Number(group.capacityMax) || capacityMin));
    const accepted = 0;
    return {
      id: `${group.id ?? `${stage.id ?? 'stage'}-group-${groupIndex + 1}`}`.trim(),
      name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
      source: group.source === 'manual' ? 'manual' : 'generated',
      capacityMin,
      capacityMax,
      membersAccepted: accepted,
      membersPending: Math.max(0, capacityMax - accepted)
    };
  }

  private stageGroupsForMutation(
    stage: ContractTypes.SubEventDTO,
    stages?: readonly ContractTypes.SubEventDTO[] | null,
    eventRecord?: ActivityEventRecord | null
  ): ContractTypes.SubEventGroupDTO[] {
    const generatedGroups = this.hasTournamentGroupCapacityRule(stage)
      ? this.localGeneratedGroups(stage, stages, eventRecord)
      : [];
    const groups = generatedGroups;
    return groups
      .map((group, index): ContractTypes.SubEventGroupDTO => {
        const capacityMin = Math.max(0, Math.trunc(Number(group.capacityMin ?? stage.tournamentGroupCapacityMin ?? 0) || 0));
        const capacityMax = Math.max(
          capacityMin,
          Math.trunc(Number(group.capacityMax ?? stage.tournamentGroupCapacityMax ?? capacityMin) || capacityMin)
        );
        return {
          id: `${group.id ?? `${stage.id ?? 'stage'}-group-${index + 1}`}`.trim(),
          name: `${group.name ?? `Group ${String.fromCharCode(65 + (index % 26))}`}`.trim(),
          source: group.source === 'manual' ? 'manual' : 'generated',
          capacityMin,
          capacityMax
        };
      })
      .filter(group => group.id && group.name);
  }

  private stageGroupsForDisplay(
    ownerSourceId: string,
    stage: ContractTypes.SubEventDTO,
    stages?: readonly ContractTypes.SubEventDTO[] | null,
    eventRecord?: ActivityEventRecord | null
  ): ContractTypes.SubEventGroupDTO[] {
    const generated: ContractTypes.SubEventGroupDTO[] = this.stageGroupsForMutation(stage, stages, eventRecord).map(group => ({
      ...group,
      source: group.source === 'manual' ? 'manual' as const : 'generated' as const
    }));
    const stageId = `${stage.id ?? ''}`.trim();
    if (!ownerSourceId.trim() || !stageId) {
      return generated;
    }
    const manual = this.manualGroupRecords(ownerSourceId, stageId)
      .map(record => this.manualGroupToDto(record))
      .filter((group): group is ContractTypes.SubEventGroupDTO => Boolean(group));
    return [...generated, ...manual];
  }

  private nextTournamentGroupId(
    ownerSourceId: string,
    subEventId: string,
    table: ActivitySubEventGroupsRecordCollection
  ): string {
    const prefix = `${this.manualGroupOwnerId(ownerSourceId, subEventId) || 'stage'}:manual-group:`;
    let index = Math.max(1, this.manualGroupRecords(ownerSourceId, subEventId, table).length + 1);
    while (this.manualGroupRecords(ownerSourceId, subEventId, table).some(group => group.groupId === `${prefix}${index}`)) {
      index += 1;
    }
    return `${prefix}${index}`;
  }

  private manualGroupRecordId(ownerSourceId: string, subEventId: string, groupId: string): string {
    return `${this.manualGroupOwnerId(ownerSourceId, subEventId)}:${groupId.trim()}`;
  }

  private manualGroupOwnerId(ownerSourceId: string, subEventId: string): string {
    return `${ownerSourceId ?? ''}`.trim() && `${subEventId ?? ''}`.trim()
      ? `${ownerSourceId.trim()}:${subEventId.trim()}`
      : '';
  }

  private manualGroupRecords(
    _ownerSourceId: string,
    subEventId: string,
    sourceTable?: ActivitySubEventGroupsRecordCollection
  ): ActivitySubEventGroupRecord[] {
    const table = sourceTable ?? this.normalizeSubEventGroupsCollection(this.memoryDb.read()[ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]);
    const ownerKey = this.manualGroupOwnerId(_ownerSourceId, subEventId);
    if (!ownerKey) {
      return [];
    }
    return (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventGroupRecord => Boolean(record))
      .filter(record => `${record.status ?? 'A'}`.trim() !== 'D')
      .filter(record => record.ownerId === ownerKey)
      .sort((left, right) => left.createdMs - right.createdMs || left.groupId.localeCompare(right.groupId))
      .map(record => ({ ...record }));
  }

  private manualGroupToDto(record: ActivitySubEventGroupRecord | null | undefined): ContractTypes.SubEventGroupDTO | null {
    if (!record || `${record.status ?? 'A'}`.trim() === 'D' || !record.groupId.trim()) {
      return null;
    }
    const capacityMin = Math.max(0, Math.trunc(Number(record.capacityMin) || 0));
    return {
      id: record.groupId.trim(),
      name: record.name.trim() || 'Group',
      source: 'manual',
      capacityMin,
      capacityMax: Math.max(capacityMin, Math.trunc(Number(record.capacityMax) || capacityMin))
    };
  }

  private normalizeSubEventGroupsCollection(value: unknown): ActivitySubEventGroupsRecordCollection {
    const source = value as Partial<ActivitySubEventGroupsRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivitySubEventGroupRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => `${id ?? ''}`.trim()).filter(id => Boolean(byId[id]))
      : Object.keys(byId);
    const idsByOwnerKey: Record<string, string[]> = {};
    for (const id of ids) {
      const ownerKey = `${byId[id]?.ownerKey ?? byId[id]?.ownerId ?? ''}`.trim();
      if (!ownerKey) {
        continue;
      }
      const bucket = idsByOwnerKey[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private upsertSubEventGroupRecordCollection(
    table: ActivitySubEventGroupsRecordCollection,
    record: ActivitySubEventGroupRecord
  ): ActivitySubEventGroupsRecordCollection {
    const byId = {
      ...table.byId,
      [record.id]: { ...record }
    };
    const ids = table.ids.includes(record.id) ? [...table.ids] : [...table.ids, record.id];
    const idsByOwnerKey = { ...table.idsByOwnerKey };
    const ownerKey = record.ownerKey.trim();
    if (ownerKey) {
      const bucket = idsByOwnerKey[ownerKey] ? [...idsByOwnerKey[ownerKey]] : [];
      if (!bucket.includes(record.id)) {
        bucket.push(record.id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private normalizeStageRuntimeCollection(value: unknown): ActivitySubEventStageRuntimeRecordCollection {
    const source = value as Partial<ActivitySubEventStageRuntimeRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivitySubEventStageRuntimeRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => `${id ?? ''}`.trim()).filter(id => Boolean(byId[id]))
      : Object.keys(byId);
    const idsByOwnerKey: Record<string, string[]> = {};
    for (const id of ids) {
      const ownerKey = `${byId[id]?.ownerKey ?? byId[id]?.ownerId ?? ''}`.trim();
      if (!ownerKey) {
        continue;
      }
      const bucket = idsByOwnerKey[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private upsertStageRuntimeGroupsCountCollection(
    value: unknown,
    groupsTable: ActivitySubEventGroupsRecordCollection,
    ownerSourceId: string,
    subEventId: string,
    stage: ContractTypes.SubEventDTO | null,
    stages: readonly ContractTypes.SubEventDTO[] | null | undefined,
    eventRecord: ActivityEventRecord | null | undefined,
    nowMs: number,
    nowIso: string
  ): ActivitySubEventStageRuntimeRecordCollection {
    const table = this.normalizeStageRuntimeCollection(value);
    const id = `${ownerSourceId.trim()}:${subEventId.trim()}`;
    const existing = table.byId[id] ?? null;
    const groupsCount = this.autoTournamentGroupCount(stage, stages, eventRecord)
      + this.manualGroupRecords(ownerSourceId, subEventId, groupsTable).length;
    const record: ActivitySubEventStageRuntimeRecord = {
      id,
      status: 'A',
      ownerId: ownerSourceId.trim(),
      subEventId: subEventId.trim(),
      stageStatus: existing?.stageStatus ?? null,
      stageStatusReason: existing?.stageStatusReason ?? null,
      stageStatusUpdatedAt: existing?.stageStatusUpdatedAt ?? null,
      stageFinalizedAt: existing?.stageFinalizedAt ?? null,
      stageFinalizedByUserId: existing?.stageFinalizedByUserId ?? null,
      groupsCount: Math.max(0, groupsCount),
      ownerKey: ownerSourceId.trim(),
      createdMs: existing?.createdMs ?? nowMs,
      updatedMs: nowMs,
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso
    };
    const byId = {
      ...table.byId,
      [id]: record
    };
    const ids = table.ids.includes(id) ? [...table.ids] : [...table.ids, id];
    const idsByOwnerKey = { ...table.idsByOwnerKey };
    const bucket = idsByOwnerKey[record.ownerKey] ? [...idsByOwnerKey[record.ownerKey]] : [];
    if (!bucket.includes(id)) {
      bucket.push(id);
    }
    idsByOwnerKey[record.ownerKey] = bucket;
    return { byId, ids, idsByOwnerKey };
  }

  private syncStageRuntimeGroupCountsForDefinitions(parentEventId: string): void {
    const normalizedParentId = parentEventId.trim();
    if (!normalizedParentId) {
      return;
    }
    this.memoryDb.write(state => {
      const runtimeTable = this.normalizeStageRuntimeCollection(state[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
      const groupsTable = this.normalizeSubEventGroupsCollection(state[ACTIVITY_SUB_EVENT_GROUPS_TABLE_NAME]);
      const records = runtimeTable.ids
        .map(id => runtimeTable.byId[id])
        .filter((record): record is ActivitySubEventStageRuntimeRecord => Boolean(record))
        .filter(record => `${record.status ?? 'A'}`.trim() !== 'D')
        .filter(record => record.ownerId === normalizedParentId || record.ownerId.startsWith(`${normalizedParentId}:`));
      if (records.length === 0) {
        return state;
      }
      const eventsBySourceId = new Map<string, ActivityEventRecord>();
      for (const eventRecord of this.computePreferredEventRecords(state[EVENTS_TABLE_NAME])) {
        const sourceId = `${eventRecord.id ?? ''}`.trim();
        if (sourceId) {
          eventsBySourceId.set(sourceId, eventRecord);
        }
      }
      const parentEventRecord = eventsBySourceId.get(normalizedParentId) ?? null;
      const autoCountByStageKey = new Map<string, number>();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      let changed = false;
      let nextTable = runtimeTable;
      for (const record of records) {
        const eventRecord = record.ownerId === normalizedParentId
          ? parentEventRecord
          : parentEventRecord ?? eventsBySourceId.get(record.ownerId) ?? null;
        const autoCountKey = `${eventRecord?.id ?? normalizedParentId}:${record.subEventId}`;
        let autoCount = autoCountByStageKey.get(autoCountKey);
        if (autoCount === undefined) {
          const stages = this.runtimeSubEvents(eventRecord);
          const stage = stages
            .find(item => `${item.id ?? ''}`.trim() === record.subEventId) ?? null;
          if (!stage) {
            continue;
          }
          autoCount = this.autoTournamentGroupCount(stage, stages, eventRecord);
          autoCountByStageKey.set(autoCountKey, autoCount);
        }
        const groupsCount = autoCount
          + this.manualGroupRecords(record.ownerId, record.subEventId, groupsTable).length;
        if (record.groupsCount === groupsCount) {
          continue;
        }
        nextTable = this.upsertStageRuntimeRecordCollection(nextTable, {
          ...record,
          groupsCount,
          updatedMs: nowMs,
          updatedAtIso: nowIso
        });
        changed = true;
      }
      return changed
        ? {
            ...state,
            [ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]: nextTable
          }
        : state;
    });
  }

  private upsertStageRuntimeRecordCollection(
    table: ActivitySubEventStageRuntimeRecordCollection,
    record: ActivitySubEventStageRuntimeRecord
  ): ActivitySubEventStageRuntimeRecordCollection {
    const byId = {
      ...table.byId,
      [record.id]: { ...record }
    };
    const ids = table.ids.includes(record.id) ? [...table.ids] : [...table.ids, record.id];
    const idsByOwnerKey = { ...table.idsByOwnerKey };
    const ownerKey = record.ownerKey.trim();
    if (ownerKey) {
      const bucket = idsByOwnerKey[ownerKey] ? [...idsByOwnerKey[ownerKey]] : [];
      if (!bucket.includes(record.id)) {
        bucket.push(record.id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private leaderboardGroupKey(eventId: string, subEventId: string, groupId: string): string {
    return `${eventId.trim()}::${subEventId.trim()}::${groupId.trim()}`;
  }

  private localScoreRows(
    members: readonly ContractTypes.SubEventLeaderboardMember[],
    entries: readonly ContractTypes.SubEventLeaderboardScoreEntry[]
  ): ContractTypes.SubEventLeaderboardScoreStandingRow[] {
    const rows = new Map<string, ContractTypes.SubEventLeaderboardScoreStandingRow>();
    for (const member of members) {
      rows.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        total: 0,
        updates: 0
      });
    }
    for (const entry of entries) {
      const row = rows.get(entry.memberId);
      if (!row) {
        continue;
      }
      row.total += Math.trunc(Number(entry.value) || 0);
      row.updates += 1;
    }
    return [...rows.values()].sort((left, right) => {
      if (left.total !== right.total) {
        return right.total - left.total;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  private localFifaRows(
    members: readonly ContractTypes.SubEventLeaderboardMember[],
    matches: readonly ContractTypes.SubEventLeaderboardFifaMatch[]
  ): ContractTypes.SubEventLeaderboardFifaStandingRow[] {
    const rows = new Map<string, ContractTypes.SubEventLeaderboardFifaStandingRow>();
    for (const member of members) {
      rows.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0
      });
    }
    for (const match of matches) {
      const home = rows.get(match.homeMemberId);
      const away = rows.get(match.awayMemberId);
      if (!home || !away) {
        continue;
      }
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;
      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    }
    for (const row of rows.values()) {
      row.goalDiff = row.goalsFor - row.goalsAgainst;
    }
    return [...rows.values()].sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }
      if (left.goalDiff !== right.goalDiff) {
        return right.goalDiff - left.goalDiff;
      }
      if (left.goalsFor !== right.goalsFor) {
        return right.goalsFor - left.goalsFor;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  private localAdvancingMemberIds(
    stage: ContractTypes.SubEventDTO,
    members: readonly ContractTypes.SubEventLeaderboardMember[],
    scoreEntries: readonly ContractTypes.SubEventLeaderboardScoreEntry[],
    fifaMatches: readonly ContractTypes.SubEventLeaderboardFifaMatch[]
  ): string[] {
    const rows = stage.tournamentLeaderboardType === 'Fifa'
      ? this.localFifaRows(members, fifaMatches)
      : this.localScoreRows(members, scoreEntries);
    return rows.map(row => row.memberId).filter(Boolean);
  }

  private localGeneratedGroups(
    stage: ContractTypes.SubEventDTO,
    stages?: readonly ContractTypes.SubEventDTO[] | null,
    eventRecord?: ActivityEventRecord | null
  ): ContractTypes.SubEventGroupDTO[] {
    const groupCount = this.autoTournamentGroupCount(stage, stages, eventRecord);
    if (groupCount <= 0) {
      return [];
    }
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

  private autoTournamentGroupCount(
    stage: ContractTypes.SubEventDTO | null | undefined,
    stages?: readonly ContractTypes.SubEventDTO[] | null,
    eventRecord?: ActivityEventRecord | null
  ): number {
    if (!stage) {
      return 0;
    }
    const sequence = stages?.length ? stages : [stage];
    let incomingCapacityMax = Math.max(
      this.toNonNegativeInteger((eventRecord as { capacityMax?: number | null } | null | undefined)?.capacityMax),
      this.toNonNegativeInteger(stage.capacityMax)
    );
    for (const candidate of sequence) {
      const groupCount = this.autoTournamentGroupCountForIncoming(candidate, incomingCapacityMax);
      if (this.sameStage(candidate, stage)) {
        return groupCount;
      }
      if (this.hasTournamentStageConfig(candidate) && groupCount > 0) {
        const advancePerGroup = this.toNonNegativeInteger(candidate.tournamentAdvancePerGroup);
        incomingCapacityMax = advancePerGroup > 0 ? groupCount * advancePerGroup : 0;
      }
    }
    return this.autoTournamentGroupCountForIncoming(stage, incomingCapacityMax);
  }

  private autoTournamentGroupCountForIncoming(
    stage: ContractTypes.SubEventDTO | null | undefined,
    incomingCapacityMax: number
  ): number {
    if (!stage) {
      return 0;
    }
    const groupMin = Math.max(0, Math.trunc(Number(stage.tournamentGroupCapacityMin) || 0));
    const groupMax = Math.max(groupMin, Math.trunc(Number(stage.tournamentGroupCapacityMax) || groupMin));
    if (groupMin > 0 || groupMax > 0) {
      const divisor = Math.max(1, groupMax > 0 ? groupMax : groupMin);
      const stageMax = incomingCapacityMax > 0
        ? incomingCapacityMax
        : Math.max(0, Math.trunc(Number(stage.capacityMax) || 0));
      return stageMax > 0 ? Math.max(1, Math.ceil(stageMax / divisor)) : 0;
    }
    return 0;
  }

  private hasTournamentGroupCapacityRule(stage: ContractTypes.SubEventDTO | null | undefined): boolean {
    return this.toNonNegativeInteger(stage?.tournamentGroupCapacityMin) > 0
      || this.toNonNegativeInteger(stage?.tournamentGroupCapacityMax) > 0;
  }

  private sameStage(left: ContractTypes.SubEventDTO | null | undefined, right: ContractTypes.SubEventDTO | null | undefined): boolean {
    const leftId = `${left?.id ?? ''}`.trim();
    const rightId = `${right?.id ?? ''}`.trim();
    return Boolean(leftId && leftId === rightId);
  }

  private hasTournamentStageConfig(stage: ContractTypes.SubEventDTO | null | undefined): boolean {
    return Boolean(stage)
      && stage?.optional !== true
      && (
        this.toNonNegativeInteger(stage?.tournamentGroupCapacityMin) > 0
        || this.toNonNegativeInteger(stage?.tournamentGroupCapacityMax) > 0
        || stage?.tournamentLeaderboardType === 'Score'
        || stage?.tournamentLeaderboardType === 'Fifa'
      );
  }

  private toNonNegativeInteger(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private subEventDefinitionTimeline(
    items: readonly ActivityContracts.SubEventDefinitionDTO[] | undefined
  ): Array<{ item: ActivityContracts.SubEventDefinitionDTO; startOffsetMinutes: number; durationMinutes: number }> {
    const definitions = items ?? [];
    let previousStartOffsetMinutes = 0;
    let previousEndOffsetMinutes = 0;
    let hasPrevious = false;
    return definitions.map(item => {
      const durationMinutes = Math.max(0, Math.trunc(Number(item.durationMinutes) || 0));
      const offsetMinutes = Math.max(0, Math.trunc(Number(item.offsetMinutes) || 0));
      const timing = ActivityEventDetailDTO.normalizeSubEventDefinitionTiming(item.timing);
      const startOffsetMinutes = !hasPrevious
        ? offsetMinutes
        : timing === 'During'
          ? previousStartOffsetMinutes + offsetMinutes
          : previousEndOffsetMinutes + offsetMinutes;
      previousStartOffsetMinutes = startOffsetMinutes;
      previousEndOffsetMinutes = startOffsetMinutes + durationMinutes;
      hasPrevious = true;
      return { item, startOffsetMinutes, durationMinutes };
    });
  }

  private subEventDefinitionsDurationMinutes(items: readonly ActivityContracts.SubEventDefinitionDTO[] | undefined): number {
    return this.subEventDefinitionTimeline(items)
      .reduce((total, entry) => Math.max(total, entry.startOffsetMinutes + entry.durationMinutes), 0);
  }

  private slotTemplateSubEventDefinitions(
    parent: ActivityContracts.ActivityEventRecord,
    template: ContractTypes.EventSlotTemplateDTO
  ): ActivityContracts.SubEventDefinitionDTO[] {
    if (parent.subEventsEnabled !== true) {
      return [];
    }
    const overrideDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(template.subEventDefinitions ?? []);
    return overrideDefinitions.length > 0
      ? overrideDefinitions
      : ActivityEventDetailDTO.normalizeSubEventDefinitions(parent.subEventDefinitions ?? []);
  }

  private isGeneratedTournamentStage(item: ContractTypes.SubEventDTO): boolean {
    return !item.optional
      && (
        (item.tournamentGroupCapacityMin ?? 0) > 0
        || (item.tournamentGroupCapacityMax ?? 0) > 0
        || item.tournamentLeaderboardType === 'Score'
        || item.tournamentLeaderboardType === 'Fifa'
      );
  }

  private isGeneratedTournamentStageDefinition(item: ActivityContracts.SubEventDefinitionDTO): boolean {
    return item.optional !== true
      && (
        (item.tournamentGroupCapacityMin ?? 0) > 0
        || (item.tournamentGroupCapacityMax ?? 0) > 0
        || item.tournamentLeaderboardType === 'Score'
        || item.tournamentLeaderboardType === 'Fifa'
      );
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
      const generatedBySourceId = new Map(generatedRecords.map(record => [record.id, record]));
      const staleRecordKeys = nextIds.filter(recordKey => {
        const current = nextById[recordKey];
        if (!this.isGeneratedSlotRecord(current) || current?.parentEventId !== parent.id) {
          return false;
        }
        const desired = generatedBySourceId.get(current.id);
        if (!desired) {
          return true;
        }
        return recordKey !== `${desired.userId}:${desired.type}:${desired.id}`;
      });
      for (const recordKey of staleRecordKeys) {
        delete nextById[recordKey];
        changed = true;
      }
      for (const record of generatedRecords) {
        const recordKey = `${record.userId}:${record.type}:${record.id}`;
        const current = nextById[recordKey];
        if (!current || JSON.stringify(current) !== JSON.stringify(record)) {
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
        ids: nextIds.filter(id => Boolean(nextById[id]))
      }
    }));
  }

  private buildGeneratedSlotRecordsForParent(
    parent: ActivityEventRecord,
    table: ActivityEventRecordCollection
  ): ActivityEventRecord[] {
    const parentStart = this.parseEventDate(parent.startAtIso);
    const parentEnd = this.parseEventDate(parent.endAtIso);
    if (!parentStart || !parentEnd) {
      return [];
    }

    const scheduleAnchorMs = AppUtils.anchorDate(environment.bootstrapOffsetInDays).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const horizonStart = new Date(Math.max(parentStart.getTime(), scheduleAnchorMs - dayMs));
    const horizonEnd = new Date(Math.min(parentEnd.getTime(), scheduleAnchorMs + (45 * dayMs)));
    if (horizonEnd.getTime() < horizonStart.getTime()) {
      return [];
    }

    const records: ActivityEventRecord[] = [];
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
      if (!templateStart) {
        continue;
      }
      const definitions = this.slotTemplateSubEventDefinitions(parent, template);
      const definitionDurationMs = Math.max(0, this.subEventDefinitionsDurationMinutes(definitions)) * 60 * 1000;
      const starts = this.generateSlotOccurrenceStarts(parent.frequency ?? 'One-time', templateStart, horizonStart, horizonEnd);
      for (const startAt of starts) {
        const occurrenceDateKey = this.slotOccurrenceAnchorDateKey(startAt, templateStart, parentStart);
        if (occurrenceDateKey && overrideDates.has(occurrenceDateKey)) {
          continue;
        }
        const endAt = new Date(startAt.getTime() + definitionDurationMs);
        if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
          continue;
        }
        const sourceId = this.buildGeneratedSlotSourceId(parent.id, template.id, startAt);
        const existing = this.computePreferredEventRecords(table)
          .find(record => record.id === sourceId && this.isGeneratedSlotRecord(record))
          ?? null;
        const capacityTotal = Math.max(0, parent.capacityTotal);
        const acceptedMembers = Math.max(0, Math.trunc(Number(existing?.acceptedMembers) || 0));
        const pendingMembers = Math.max(0, Math.trunc(Number(existing?.pendingMembers) || 0));
        records.push({
          id: sourceId,
          userId: LocalEventsRepository.SLOT_READ_MODEL_USER_ID,
          type: 'events',
          status: parent.status,
          avatar: parent.avatar,
          title: parent.title,
          subtitle: parent.subtitle,
          timeframe: this.buildGeneratedSlotTimeframe(startAt, endAt),
          inviter: null,
          unread: 0,
          activity: 0,
          trashedAtIso: null,
          creatorUserId: LocalEventsRepository.SLOT_READ_MODEL_USER_ID,
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
          acceptedMembers,
          pendingMembers,
          acceptedMemberUserIds: [],
          pendingMemberUserIds: [],
          invitedMemberUserIds: [],
          pendingRequestMemberUserIds: [],
          topics: [...parent.topics],
          subEventsEnabled: false,
          subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(definitions),
          subEvents: [],
          mode: parent.mode,
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
      if (!templateStart) {
        continue;
      }
      const definitions = this.slotTemplateSubEventDefinitions(parent, template);
      const definitionDurationMs = Math.max(0, this.subEventDefinitionsDurationMinutes(definitions)) * 60 * 1000;
      const startAt = new Date(templateStart);
      const endAt = new Date(startAt.getTime() + definitionDurationMs);
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
      const capacityTotal = Math.max(0, parent.capacityTotal);
      const acceptedMembers = Math.max(0, Math.trunc(Number(existing?.acceptedMembers) || 0));
      const pendingMembers = Math.max(0, Math.trunc(Number(existing?.pendingMembers) || 0));
      records.push({
        id: sourceId,
        userId: LocalEventsRepository.SLOT_READ_MODEL_USER_ID,
        type: 'events',
        status: parent.status,
        avatar: parent.avatar,
        title: parent.title,
        subtitle: parent.subtitle,
        timeframe: this.buildGeneratedSlotTimeframe(startAt, endAt),
        inviter: null,
        unread: 0,
        activity: 0,
        trashedAtIso: null,
        creatorUserId: LocalEventsRepository.SLOT_READ_MODEL_USER_ID,
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
        acceptedMembers,
        pendingMembers,
        acceptedMemberUserIds: [],
        pendingMemberUserIds: [],
        invitedMemberUserIds: [],
        pendingRequestMemberUserIds: [],
        topics: [...parent.topics],
        subEventsEnabled: false,
        subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(definitions),
        subEvents: [],
        mode: parent.mode,
        rating: parent.rating,
        boost: parent.boost,
        affinity: parent.affinity
      });
    }
    return records;
  }

  private withResolvedSlotContext(record: ActivityEventRecord, table: ActivityEventRecordCollection): ActivityEventRecord {
    if (!this.isSlotParentRecord(record)) {
      return {
        ...record,
        nextSlot: null,
        upcomingSlots: []
      };
    }
    const upcomingSlots = this.resolveUpcomingSlotOccurrences(record, table);
    return {
      ...record,
      nextSlot: upcomingSlots[0] ?? null,
      upcomingSlots
    };
  }

  private resolveUpcomingSlotOccurrences(
    parent: ActivityEventRecord,
    table: ActivityEventRecordCollection
  ): ContractTypes.EventSlotOccurrenceDTO[] {
    const parentEventId = parent.id;
    const nowMs = Date.now() - (60 * 60 * 1000);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivityEventRecord => Boolean(record))
      .filter(record => this.isGeneratedSlotRecord(record) && record.parentEventId === parentEventId)
      .filter(record => !this.isTrashStatus(record))
      .filter(record => this.generatedSlotFitsParentRange(record, parent))
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

  private generatedSlotFitsParentRange(record: ActivityEventRecord, parent: ActivityEventRecord): boolean {
    const parentStart = this.parseEventDate(parent.startAtIso);
    const parentEnd = this.parseEventDate(parent.endAtIso);
    const recordStart = this.parseEventDate(record.startAtIso);
    const recordEnd = this.parseEventDate(record.endAtIso);
    if (!parentStart || !parentEnd || !recordStart || !recordEnd) {
      return false;
    }
    return recordStart.getTime() >= parentStart.getTime()
      && recordEnd.getTime() <= parentEnd.getTime();
  }

  private isGeneratedSlotRecord(record: ActivityEventRecord | null | undefined): boolean {
    return Boolean(record?.generated) || record?.eventType === 'slot' || Boolean(record?.parentEventId);
  }

  private isSlotParentRecord(record: ActivityEventRecord | null | undefined): boolean {
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
    if (normalizedFrequency === 'one-time' || normalizedFrequency === 'custom' || !normalizedFrequency) {
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

  private toDateMs(value: string | null | undefined): number {
    return this.parseEventDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
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

  private normalizeLocationCoordinates(value: unknown): ActivityEventRecord['locationCoordinates'] {
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
