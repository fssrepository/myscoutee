import { Injectable, inject } from '@angular/core';

import type {
  NotificationBucket,
  NotificationListFilters,
  NotificationSyncRequestDto
} from '../../../contracts/notification.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import { LocalMemoryDb } from '../../../common/app.db';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import {
  NOTIFICATIONS_TABLE_NAME,
  type NotificationRecord
} from '../entity/notification.entity';

interface NotificationCursorPayload {
  bucket: NotificationBucket;
  createdAtIso: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocalNotificationsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  append(records: readonly NotificationRecord[]): NotificationRecord[] {
    const currentTable = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const seenIds = new Set(Object.keys(currentTable.byId));
    const additions = records
      .map(record => this.cloneRecord(record))
      .filter(record => {
        const id = record.id.trim();
        const recipientUserId = record.recipientUserId.trim();
        if (!id || !recipientUserId || seenIds.has(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      });
    if (additions.length === 0) {
      return [];
    }
    this.memoryDb.write(state => {
      const table = state[NOTIFICATIONS_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      const nextIdsByRecipientUserId = { ...table.idsByRecipientUserId };
      const affectedUserIds = new Set<string>();
      additions.forEach(record => {
        nextById[record.id] = record;
        nextIds.push(record.id);
        nextIdsByRecipientUserId[record.recipientUserId] = [
          ...(nextIdsByRecipientUserId[record.recipientUserId] ?? []),
          record.id
        ];
        affectedUserIds.add(record.recipientUserId);
      });
      const nextNotificationsTable = {
        ...table,
        byId: nextById,
        ids: nextIds,
        idsByRecipientUserId: nextIdsByRecipientUserId
      };
      let nextUsersTable = state[USERS_TABLE_NAME];
      affectedUserIds.forEach(userId => {
        nextUsersTable = this.withUserUnreadCount(
          nextUsersTable,
          userId,
          this.unreadCountFromTable(nextNotificationsTable, userId)
        );
      });
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: nextNotificationsTable,
        [USERS_TABLE_NAME]: nextUsersTable
      };
    });
    return additions.map(record => this.cloneRecord(record));
  }

  appendAggregated(record: NotificationRecord): NotificationRecord | null {
    const normalized = this.cloneRecord(record);
    const recipientUserId = normalized.recipientUserId.trim();
    const aggregationGroup = `${normalized.payload?.['notification_aggregation_key'] ?? ''}`.trim();
    if (!recipientUserId || !aggregationGroup) {
      return this.append([normalized])[0] ?? null;
    }
    const currentTable = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const existing = (currentTable.idsByRecipientUserId[recipientUserId] ?? [])
      .map(id => currentTable.byId[id])
      .find(item => `${item?.payload?.['notification_aggregation_key'] ?? ''}`.trim() === aggregationGroup)
      ?? null;
    if (!existing) {
      return this.append([{ ...normalized, occurrenceCount: 1 }])[0] ?? null;
    }

    const nextRecord: NotificationRecord = {
      ...existing,
      ...normalized,
      id: existing.id,
      readAtIso: null,
      occurrenceCount: Math.max(1, Math.trunc(Number(existing.occurrenceCount ?? 1)) || 1) + 1,
      revision: Math.max(1, Math.trunc(Number(existing.revision) || 1)) + 1,
      payload: normalized.payload ? { ...normalized.payload } : null
    };
    this.memoryDb.write(state => {
      const table = state[NOTIFICATIONS_TABLE_NAME];
      const nextTable = {
        ...table,
        byId: {
          ...table.byId,
          [existing.id]: nextRecord
        }
      };
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: nextTable,
        [USERS_TABLE_NAME]: this.withUserUnreadCount(
          state[USERS_TABLE_NAME],
          recipientUserId,
          this.unreadCountFromTable(nextTable, recipientUserId)
        )
      };
    });
    return this.cloneRecord(nextRecord);
  }

  queryPage(
    userId: string,
    query: ListQuery<NotificationListFilters>
  ): {
    records: NotificationRecord[];
    total: number;
    nextCursor: string | null;
    unreadCount: number;
    muted: boolean;
  } {
    const normalizedUserId = userId.trim();
    const bucket = query.filters?.bucket === 'new' ? 'new' : 'all';
    const table = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const records = (table.idsByRecipientUserId[normalizedUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is NotificationRecord => Boolean(record))
      .filter(record => bucket === 'all' || !record.readAtIso)
      .sort((left, right) => this.compareRecords(left, right));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 20)));
    const startIndex = this.resolveStartIndex(records, bucket, query.cursor);
    const endIndex = Math.min(records.length, startIndex + pageSize);
    const lastRecord = records[endIndex - 1] ?? null;
    return {
      records: records.slice(startIndex, endIndex).map(record => this.cloneRecord(record)),
      total: records.length,
      nextCursor: endIndex < records.length && lastRecord
        ? this.encodeCursor({
            bucket,
            createdAtIso: lastRecord.createdAtIso,
            id: lastRecord.id
          })
        : null,
      unreadCount: this.unreadCount(normalizedUserId),
      muted: table.mutedByUserId[normalizedUserId] === true
    };
  }

  markRead(userId: string, notificationId: string): NotificationRecord | null {
    const normalizedUserId = userId.trim();
    const normalizedNotificationId = notificationId.trim();
    if (!normalizedUserId || !normalizedNotificationId) {
      return null;
    }
    const currentRecord = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME].byId[normalizedNotificationId];
    if (!currentRecord || currentRecord.recipientUserId !== normalizedUserId) {
      return null;
    }
    if (currentRecord.readAtIso) {
      return this.cloneRecord(currentRecord);
    }
    const nextRecord: NotificationRecord = {
      ...currentRecord,
      readAtIso: new Date().toISOString(),
      revision: Math.max(1, Math.trunc(Number(currentRecord.revision) || 1)) + 1
    };
    this.memoryDb.write(state => {
      const table = state[NOTIFICATIONS_TABLE_NAME];
      const unreadCount = Math.max(0, this.unreadCountFromTable(
        table,
        normalizedUserId
      ) - 1);
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [normalizedNotificationId]: nextRecord
          }
        },
        [USERS_TABLE_NAME]: this.withUserUnreadCount(
          state[USERS_TABLE_NAME],
          normalizedUserId,
          unreadCount
        )
      };
    });
    return this.cloneRecord(nextRecord);
  }

  markUnreadBySource(
    userId: string,
    kind: string,
    sourceType: string,
    sourceId: string
  ): number {
    const normalizedUserId = userId.trim();
    const normalizedKind = kind.trim();
    const normalizedSourceType = sourceType.trim();
    const normalizedSourceId = sourceId.trim();
    if (!normalizedUserId || !normalizedKind || !normalizedSourceType || !normalizedSourceId) {
      return 0;
    }
    const table = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const matchingIds = (table.idsByRecipientUserId[normalizedUserId] ?? [])
      .filter(id => {
        const record = table.byId[id];
        return record
          && !record.readAtIso
          && record.kind === normalizedKind
          && record.sourceType === normalizedSourceType
          && record.sourceId === normalizedSourceId;
      });
    if (matchingIds.length === 0) {
      return 0;
    }
    const readAtIso = new Date().toISOString();
    this.memoryDb.write(state => {
      const currentTable = state[NOTIFICATIONS_TABLE_NAME];
      const nextById = { ...currentTable.byId };
      matchingIds.forEach(id => {
        const record = currentTable.byId[id];
        if (record) {
          nextById[id] = {
            ...record,
            readAtIso,
            revision: Math.max(1, Math.trunc(Number(record.revision) || 1)) + 1
          };
        }
      });
      const unreadCount = Math.max(
        0,
        this.unreadCountFromTable(currentTable, normalizedUserId) - matchingIds.length
      );
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: {
          ...currentTable,
          byId: nextById
        },
        [USERS_TABLE_NAME]: this.withUserUnreadCount(
          state[USERS_TABLE_NAME],
          normalizedUserId,
          unreadCount
        )
      };
    });
    return matchingIds.length;
  }

  setMuted(userId: string, muted: boolean): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    this.memoryDb.write(state => {
      const table = state[NOTIFICATIONS_TABLE_NAME];
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: {
          ...table,
          mutedByUserId: {
            ...table.mutedByUserId,
            [normalizedUserId]: muted === true
          }
        },
        [USERS_TABLE_NAME]: this.withUserNotificationMuted(
          state[USERS_TABLE_NAME],
          normalizedUserId,
          muted === true
        )
      };
    });
    return muted === true;
  }

  unreadCount(userId: string): number {
    return this.unreadCountFromTable(
      this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME],
      userId.trim()
    );
  }

  muted(userId: string): boolean {
    return this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME].mutedByUserId[userId.trim()] === true;
  }

  sync(
    userId: string,
    request: NotificationSyncRequestDto
  ): {
    upserts: NotificationRecord[];
    removedIds: string[];
    total: number;
    unreadCount: number;
    muted: boolean;
  } {
    const normalizedUserId = userId.trim();
    const bucket = request.bucket === 'new' ? 'new' : 'all';
    const table = this.memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const records = (table.idsByRecipientUserId[normalizedUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is NotificationRecord => Boolean(record))
      .filter(record => bucket === 'all' || !record.readAtIso)
      .sort((left, right) => this.compareRecords(left, right));
    const currentById = new Map(records.map(record => [record.id, record]));
    const knownRevisions = new Map(
      request.knownItems.map(item => [
        `${item.id}`.trim(),
        Math.max(1, Math.trunc(Number(item.revision) || 1))
      ])
    );
    const removedIds = [...knownRevisions.keys()].filter(id => !currentById.has(id));
    const upsertsById = new Map<string, NotificationRecord>();
    for (const [id, revision] of knownRevisions.entries()) {
      const current = currentById.get(id);
      if (current && Math.max(1, Math.trunc(Number(current.revision) || 1)) !== revision) {
        upsertsById.set(id, current);
      }
    }

    const tail = request.loadedTail;
    const windowLimit = Math.max(
      1,
      request.knownItems.length + Math.trunc(Number(request.limit) || 20)
    );
    const loadedWindow = tail?.createdAtIso && tail.id
      ? records.filter(current => this.compareRecords(current, {
          ...current,
          id: tail.id,
          createdAtIso: tail.createdAtIso
        }) <= 0).slice(0, windowLimit)
      : records.slice(0, Math.max(1, Math.trunc(Number(request.limit) || 20)));
    for (const current of loadedWindow) {
      const knownRevision = knownRevisions.get(current.id);
      const currentRevision = Math.max(1, Math.trunc(Number(current.revision) || 1));
      if (knownRevision === undefined || knownRevision !== currentRevision) {
        upsertsById.set(current.id, current);
      }
    }
    return {
      upserts: [...upsertsById.values()].map(record => this.cloneRecord(record)),
      removedIds,
      total: records.length,
      unreadCount: this.unreadCount(normalizedUserId),
      muted: table.mutedByUserId[normalizedUserId] === true
    };
  }

  private unreadCountFromTable(
    table: ReturnType<LocalMemoryDb['read']>[typeof NOTIFICATIONS_TABLE_NAME],
    userId: string
  ): number {
    return (table.idsByRecipientUserId[userId] ?? [])
      .map(id => table.byId[id])
      .filter(record => record && !record.readAtIso)
      .length;
  }

  private withUserUnreadCount(
    users: ReturnType<LocalMemoryDb['read']>[typeof USERS_TABLE_NAME],
    userId: string,
    unreadCount: number
  ): ReturnType<LocalMemoryDb['read']>[typeof USERS_TABLE_NAME] {
    const user = users.byId[userId];
    if (!user) {
      return users;
    }
    return {
      ...users,
      byId: {
        ...users.byId,
        [userId]: {
          ...user,
          activities: {
            ...user.activities,
            notifications: Math.max(0, Math.trunc(Number(unreadCount) || 0))
          }
        }
      }
    };
  }

  private withUserNotificationMuted(
    users: ReturnType<LocalMemoryDb['read']>[typeof USERS_TABLE_NAME],
    userId: string,
    muted: boolean
  ): ReturnType<LocalMemoryDb['read']>[typeof USERS_TABLE_NAME] {
    const user = users.byId[userId];
    if (!user) {
      return users;
    }
    return {
      ...users,
      byId: {
        ...users.byId,
        [userId]: {
          ...user,
          notificationPreferences: {
            ...user.notificationPreferences,
            muted
          }
        }
      }
    };
  }

  private compareRecords(left: NotificationRecord, right: NotificationRecord): number {
    const dateDelta = Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
    return dateDelta !== 0 ? dateDelta : right.id.localeCompare(left.id);
  }

  private resolveStartIndex(
    records: readonly NotificationRecord[],
    bucket: NotificationBucket,
    cursor: string | null | undefined
  ): number {
    const payload = this.decodeCursor(cursor);
    if (!payload || payload.bucket !== bucket) {
      return 0;
    }
    const cursorCreatedAtMs = Date.parse(payload.createdAtIso);
    if (!Number.isFinite(cursorCreatedAtMs)) {
      return 0;
    }
    const nextIndex = records.findIndex(record => {
      const createdAtMs = Date.parse(record.createdAtIso);
      return createdAtMs < cursorCreatedAtMs
        || (createdAtMs === cursorCreatedAtMs && record.id.localeCompare(payload.id) < 0);
    });
    return nextIndex >= 0 ? nextIndex : records.length;
  }

  private encodeCursor(payload: NotificationCursorPayload): string {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    try {
      return globalThis.btoa(encoded)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch {
      return encoded;
    }
  }

  private decodeCursor(value: string | null | undefined): NotificationCursorPayload | null {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    try {
      const padded = normalized
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = normalized.startsWith('%')
        ? decodeURIComponent(normalized)
        : decodeURIComponent(globalThis.atob(padded));
      const parsed = JSON.parse(decoded) as Partial<NotificationCursorPayload>;
      const bucket = parsed.bucket === 'new' ? 'new' : parsed.bucket === 'all' ? 'all' : null;
      const createdAtIso = `${parsed.createdAtIso ?? ''}`.trim();
      const id = `${parsed.id ?? ''}`.trim();
      return bucket && createdAtIso && id
        ? { bucket, createdAtIso, id }
        : null;
    } catch {
      return null;
    }
  }

  private cloneRecord(record: NotificationRecord): NotificationRecord {
    return {
      ...record,
      payload: record.payload ? { ...record.payload } : null,
      revision: Math.max(1, Math.trunc(Number(record.revision) || 1))
    };
  }
}
