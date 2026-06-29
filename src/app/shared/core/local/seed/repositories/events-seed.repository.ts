import { EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import type { ActivityEventRecordCollection } from '../../source/entity/event.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { SeedEventsBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedEventsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(): boolean {
    if (this.initialized) {
      return false;
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
      return true;
    }

    const migration = this.mergeSeededRecords(currentTable, seededRecords);
    if (migration.changed) {
      this.memoryDb.write(currentState => ({
        ...currentState,
        [EVENTS_TABLE_NAME]: migration.table
      }));
    }
    this.initialized = true;
    return migration.changed;
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
      statusById: SeedEventsBuilder.buildSeedStatusById()
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
        if (seededRecord) {
          const currentRecord = current.byId[recordKey];
          const migratedRecord = currentRecord
            ? this.withSeededStructure(currentRecord, seededRecord)
            : null;
          if (migratedRecord && !this.sameRecord(currentRecord, migratedRecord)) {
            nextById[recordKey] = migratedRecord;
            changed = true;
          }
        }
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

  private withSeededStructure(existing: ActivityEventRecord, seeded: ActivityEventRecord): ActivityEventRecord {
    const existingSlotTemplates = existing.slotTemplates ?? [];
    const seededSlotTemplates = seeded.slotTemplates ?? [];
    const existingDefinitions = existing.subEventDefinitions ?? [];
    const seededDefinitions = seeded.subEventDefinitions ?? [];
    const shouldAdoptSeedDefinitions = existingDefinitions.length === 0 && seededDefinitions.length > 0;
    const shouldAdoptSeedSlots = existingSlotTemplates.length === 0 && seededSlotTemplates.length > 0;

    return SeedEventsBuilder.cloneRecord({
      ...existing,
      pricing: existing.pricing ?? seeded.pricing,
      policiesEnabled: existing.policiesEnabled ?? seeded.policiesEnabled,
      policies: (existing.policies?.length ?? 0) > 0 ? existing.policies : seeded.policies,
      slotsEnabled: existing.slotsEnabled ?? seeded.slotsEnabled,
      slotTemplates: shouldAdoptSeedSlots
        ? seededSlotTemplates
        : this.withSeededSlotTemplateDefinitions(existingSlotTemplates, seededSlotTemplates),
      parentEventId: existing.parentEventId ?? seeded.parentEventId,
      slotTemplateId: existing.slotTemplateId ?? seeded.slotTemplateId,
      eventType: existing.eventType ?? seeded.eventType,
      subEventsEnabled: existing.subEventsEnabled ?? seeded.subEventsEnabled,
      subEventDefinitions: shouldAdoptSeedDefinitions ? seededDefinitions : existingDefinitions,
      subEvents: [],
      mode: seeded.mode ?? existing.mode
    });
  }

  private withSeededSlotTemplateDefinitions(
    existing: readonly NonNullable<ActivityEventRecord['slotTemplates']>[number][],
    seeded: readonly NonNullable<ActivityEventRecord['slotTemplates']>[number][]
  ): ActivityEventRecord['slotTemplates'] {
    if (existing.length === 0 || seeded.length === 0) {
      return existing.map(item => ({ ...item }));
    }
    const seededById = new Map(seeded.map(item => [item.id, item]));
    const next = existing.map(item => {
      const seededItem = seededById.get(item.id);
      if (!seededItem || (item.subEventDefinitions?.length ?? 0) > 0 || (seededItem.subEventDefinitions?.length ?? 0) === 0) {
        return { ...item };
      }
      return {
        ...item,
        subEventDefinitions: seededItem.subEventDefinitions?.map(definition => ({
          ...definition,
          groups: (definition.groups ?? []).map(group => ({ ...group }))
        }))
      };
    });
    const existingIds = new Set(existing.map(item => item.id));
    for (const seededItem of seeded) {
      if (!existingIds.has(seededItem.id)) {
        next.push({
          ...seededItem,
          subEventDefinitions: (seededItem.subEventDefinitions ?? []).map(definition => ({
            ...definition,
            groups: (definition.groups ?? []).map(group => ({ ...group }))
          }))
        });
      }
    }
    return next;
  }

  private sameRecord(left: ActivityEventRecord, right: ActivityEventRecord): boolean {
    return JSON.stringify(this.seedMigrationComparableRecord(left)) === JSON.stringify(this.seedMigrationComparableRecord(right));
  }

  private seedMigrationComparableRecord(record: ActivityEventRecord): ActivityEventRecord {
    const comparable = SeedEventsBuilder.cloneRecord(record);
    delete comparable.acceptedMemberUserIds;
    delete comparable.pendingMemberUserIds;
    return comparable;
  }
}
