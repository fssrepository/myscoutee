import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import {
  APP_DEMO_DATA,
  DEMO_EVENT_DATES_BY_ID,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER
} from '../../../demo-data';
import { AppMemoryDb } from '../../base/db';
import { DemoEventsRepositoryBuilder } from '../builders';
import {
  EVENTS_TABLE_NAME,
  type DemoEventRecord,
  type DemoEventScopeFilter,
  type DemoRepositoryEventItemType
} from '../models/events.model';
import type { ActivitiesEventSyncPayload } from '../../../activities-models';

@Injectable({
  providedIn: 'root'
})
export class DemoEventsRepository {
  private static readonly MIN_DEMO_EVENT_ITEMS_PER_USER = 30;
  private readonly memoryDb = inject(AppMemoryDb);

  constructor() {
    this.init();
  }

  init(): void {
    const state = this.memoryDb.read();
    if (state[EVENTS_TABLE_NAME].ids.length > 0) {
      return;
    }

    const records = DemoEventsRepositoryBuilder.buildRecordCollection({
      invitationsByUser: DEMO_INVITATIONS_BY_USER,
      eventsByUser: DEMO_EVENTS_BY_USER,
      hostingByUser: DEMO_HOSTING_BY_USER,
      publishedById: APP_DEMO_DATA.hostingPublishedById
    });

    this.memoryDb.write(currentState => ({
      ...currentState,
      [EVENTS_TABLE_NAME]: records
    }));
  }

  queryItemsByUser(userId: string): DemoEventRecord[] {
    return this.queryUserRecords(userId);
  }

  queryInvitationItemsByUser(userId: string): DemoEventRecord[] {
    return this.queryUserRecords(userId).filter(record => record.isInvitation);
  }

  queryEventItemsByUser(userId: string): DemoEventRecord[] {
    return this.queryUserRecords(userId).filter(record => record.type === 'events');
  }

  queryHostingItemsByUser(userId: string): DemoEventRecord[] {
    return this.queryUserRecords(userId).filter(record => record.type === 'hosting');
  }

  queryTrashedItemsByUser(userId: string): DemoEventRecord[] {
    return this.queryUserRecords(userId).filter(record => record.isTrashed);
  }

  queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): DemoEventRecord[] {
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

  queryExploreItems(userId: string): DemoEventRecord[] {
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

  syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): void {
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
    this.updateItemState(userId, type, sourceId, {
      isTrashed: true,
      trashedAtIso: new Date().toISOString()
    });
  }

  restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): void {
    this.updateItemState(userId, type, sourceId, {
      isTrashed: false,
      trashedAtIso: null
    });
  }

  isItemTrashed(userId: string, type: DemoRepositoryEventItemType, sourceId: string): boolean {
    const record = this.findItem(userId, type, sourceId);
    return record?.isTrashed === true;
  }

  countTicketItemsByUser(userId: string): number {
    const eventItems = this.queryEventItemsByUser(userId);
    const hostingItems = this.queryHostingItemsByUser(userId);
    return (
      eventItems.filter(item => APP_DEMO_DATA.eventTicketingById[item.id] === true).length +
      hostingItems.filter(item => APP_DEMO_DATA.eventTicketingById[item.id] === true).length
    );
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
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
    if (!(record.type === 'hosting' || record.isAdmin === true)) {
      return false;
    }
    if (record.visibility === 'Invitation only') {
      return false;
    }
    if (record.visibility === 'Friends only') {
      return AppDemoGenerators.isFriendOfActiveUser(record.creatorUserId, activeUserId);
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
      capacityMin: this.normalizeCount(payload.capacityMin) ?? existing?.capacityMin ?? 0,
      capacityMax: this.normalizeCount(payload.capacityMax) ?? existing?.capacityMax ?? context.capacityTotal,
      capacityTotal: context.capacityTotal,
      acceptedMembers: context.acceptedMembers,
      pendingMembers: context.pendingMembers,
      acceptedMemberUserIds: [...context.acceptedMemberUserIds],
      pendingMemberUserIds: [...context.pendingMemberUserIds],
      topics,
      rating,
      relevance
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
}
