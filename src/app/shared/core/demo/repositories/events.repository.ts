import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
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
  DEMO_EVENTS_TABLE_NAME,
  type DemoEventRecord,
  type DemoEventScopeFilter,
  type DemoRepositoryEventItemType
} from '../models/events.model';

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
    if (state[DEMO_EVENTS_TABLE_NAME].ids.length > 0) {
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
      [DEMO_EVENTS_TABLE_NAME]: records
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
      const table = state[DEMO_EVENTS_TABLE_NAME];
      const current = table.byId[recordKey];
      if (!current) {
        return state;
      }
      return {
        ...state,
        [DEMO_EVENTS_TABLE_NAME]: {
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
    const record = this.memoryDb.read()[DEMO_EVENTS_TABLE_NAME].byId[recordKey];
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
    const table = this.memoryDb.read()[DEMO_EVENTS_TABLE_NAME];
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
    const table = this.memoryDb.read()[DEMO_EVENTS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoEventRecord => Boolean(record))
      .filter(record => record.userId === normalizedUserId)
      .map(record => DemoEventsRepositoryBuilder.cloneRecord(record));
  }
}
