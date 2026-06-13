import { EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import type { ActivityEventRecordCollection } from '../../source/entity/event.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../base/db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { SeedEventsBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedEventsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(): void {
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
    if (migration.changed) {
      this.memoryDb.write(currentState => ({
        ...currentState,
        [EVENTS_TABLE_NAME]: migration.table
      }));
    }
    this.initialized = true;
  }

  queryItemsByUser(userId: string): ActivityEventRecord[] {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivityEventRecord => Boolean(record))
      .filter(record => record.userId === normalizedUserId)
      .map(record => SeedEventsBuilder.cloneRecord(record));
  }

  queryItemsByUsers(userIds: readonly string[]): Map<string, ActivityEventRecord[]> {
    const normalizedUserIds = [...new Set(
      userIds
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0)
    )];
    const result = new Map<string, ActivityEventRecord[]>(
      normalizedUserIds.map(userId => [userId, []])
    );
    if (normalizedUserIds.length === 0) {
      return result;
    }
    const userIdSet = new Set(normalizedUserIds);
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || !userIdSet.has(record.userId)) {
        continue;
      }
      result.get(record.userId)?.push(SeedEventsBuilder.cloneRecord(record));
    }
    return result;
  }

  queryEventItemsByUsers(userIds: readonly string[]): Map<string, ActivityEventRecord[]> {
    const recordsByUserId = this.queryItemsByUsers(userIds);
    return new Map(
      [...recordsByUserId.entries()].map(([userId, records]) => [
        userId,
        records.filter(record => record.type === 'events')
      ])
    );
  }

  private buildSeededRecords(): ActivityEventRecordCollection {
    return SeedEventsBuilder.buildRecordCollection({
      invitationsByUser: SeedEventsBuilder.buildSeedInvitationItemsByUser(),
      eventsByUser: SeedEventsBuilder.buildSeedEventItemsByUser(),
      hostingByUser: SeedEventsBuilder.buildSeedHostingItemsByUser(),
      publishedById: SeedEventsBuilder.buildSeedPublishedById()
    });
  }

  private mergeSeededRecords(
    current: ActivityEventRecordCollection,
    seeded: ActivityEventRecordCollection
  ): { table: ActivityEventRecordCollection; changed: boolean } {
    const nextById: Record<string, ActivityEventRecord> = { ...current.byId };
    const nextIds = [...current.ids];
    const existingIds = new Set(nextIds);
    let changed = false;

    for (const recordKey of seeded.ids) {
      const seededRecord = seeded.byId[recordKey];
      if (!seededRecord || existingIds.has(recordKey)) {
        continue;
      }
      nextById[recordKey] = SeedEventsBuilder.cloneRecord(seededRecord);
      nextIds.push(recordKey);
      existingIds.add(recordKey);
      changed = true;
    }

    return {
      table: {
        byId: nextById,
        ids: nextIds
      },
      changed
    };
  }
}
