import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import {
  NOTIFICATIONS_TABLE_NAME,
  type NotificationRecord
} from '../../source/entity/notification.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../../source/entity/user.entity';
import { SeedNotificationsBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedNotificationsRepository {
  private static readonly SEED_VERSION = 'notification-center-v3';

  private readonly memoryDb = inject(LocalMemoryDb);

  seedForUser(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const snapshot = this.memoryDb.read();
    if (!snapshot[USERS_TABLE_NAME].byId[normalizedUserId]) {
      return false;
    }
    const seedMarker = `${SeedNotificationsRepository.SEED_VERSION}:${normalizedUserId}`;
    if (snapshot[NOTIFICATIONS_TABLE_NAME].seededUserIds.includes(seedMarker)) {
      return false;
    }
    const users = snapshot[USERS_TABLE_NAME].ids
      .map(id => snapshot[USERS_TABLE_NAME].byId[id])
      .filter((user): user is UserRecord => Boolean(user));
    const seedRecords = SeedNotificationsBuilder.buildForUser(normalizedUserId, users);
    if (seedRecords.length === 0) {
      return false;
    }

    this.memoryDb.write(state => {
      const table = state[NOTIFICATIONS_TABLE_NAME];
      const byId = { ...table.byId };
      const ids = [...table.ids];
      const recipientIds = [...(table.idsByRecipientUserId[normalizedUserId] ?? [])];
      for (const record of seedRecords) {
        if (byId[record.id]) {
          continue;
        }
        byId[record.id] = this.cloneRecord(record);
        ids.push(record.id);
        recipientIds.push(record.id);
      }
      const normalizedRecipientIds = [...new Set(recipientIds)];
      const unreadCount = normalizedRecipientIds
        .map(id => byId[id])
        .filter(record => record && !record.readAtIso)
        .length;
      const user = state[USERS_TABLE_NAME].byId[normalizedUserId];
      return {
        ...state,
        [NOTIFICATIONS_TABLE_NAME]: {
          ...table,
          byId,
          ids: [...new Set(ids)],
          idsByRecipientUserId: {
            ...table.idsByRecipientUserId,
            [normalizedUserId]: normalizedRecipientIds
          },
          mutedByUserId: {
            ...table.mutedByUserId,
            [normalizedUserId]: table.mutedByUserId[normalizedUserId] === true
          },
          seededUserIds: [...new Set([...table.seededUserIds, seedMarker])]
        },
        [USERS_TABLE_NAME]: {
          ...state[USERS_TABLE_NAME],
          byId: {
            ...state[USERS_TABLE_NAME].byId,
            [normalizedUserId]: {
              ...user,
              notificationPreferences: {
                ...user.notificationPreferences,
                muted: table.mutedByUserId[normalizedUserId] === true
              },
              activities: {
                ...user.activities,
                notifications: unreadCount
              }
            }
          }
        }
      };
    });
    return true;
  }

  private cloneRecord(record: NotificationRecord): NotificationRecord {
    return {
      ...record,
      payload: record.payload ? { ...record.payload } : null
    };
  }
}
