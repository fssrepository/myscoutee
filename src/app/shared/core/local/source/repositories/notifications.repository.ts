import { Injectable, inject } from '@angular/core';

import type {
  NotificationBucket,
  NotificationListFilters
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
      readAtIso: new Date().toISOString()
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
          nextById[id] = { ...record, readAtIso };
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
      payload: record.payload ? { ...record.payload } : null
    };
  }
}
