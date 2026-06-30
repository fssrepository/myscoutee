import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { LocalActivityResourcesMapper } from '../mappers';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type ActivityResourcesRecordCollection,
  type ActivitySubEventResourceRecord
} from '../entity/activity.entity';

import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class LocalActivityResourcesRepository {
  private static readonly STATUS_DELETED = 'D';
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  peekSubEventResourceRecord(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): ActivitySubEventResourceRecord | null {
    const normalizedRef = LocalActivityResourcesMapper.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const record = table.byId[LocalActivityResourcesMapper.recordId(normalizedRef)];
    return record && !LocalActivityResourcesMapper.isDeleted(record)
      ? LocalActivityResourcesMapper.cloneRecord(record)
      : null;
  }

  async querySubEventResourceRecord(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<ActivitySubEventResourceRecord | null> {
    return this.peekSubEventResourceRecord(ref);
  }

  querySubEventResourceRecordsByRefs(
    refs: readonly AppDTOs.ActivitySubEventResourceStateRefDTO[]
  ): ActivitySubEventResourceRecord[] {
    const normalizedRefs = (refs ?? [])
      .map(ref => LocalActivityResourcesMapper.normalizeRef(ref))
      .filter((ref): ref is AppDTOs.ActivitySubEventResourceStateRefDTO => Boolean(ref));
    if (normalizedRefs.length === 0) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const recordIds = new Set(normalizedRefs.map(ref => LocalActivityResourcesMapper.recordId(ref)));
    const ids = Array.from(new Set(
      normalizedRefs.flatMap(ref => table.idsByOwnerKey[LocalActivityResourcesMapper.ownerKey(ref)] ?? [])
    ));
    return Array.from(new Set(ids))
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord =>
        Boolean(record) && recordIds.has(record.id) && !LocalActivityResourcesMapper.isDeleted(record))
      .map(record => LocalActivityResourcesMapper.cloneRecord(record));
  }

  async replaceSubEventResourceRecord(
    record: ActivitySubEventResourceRecord
  ): Promise<ActivitySubEventResourceRecord | null> {
    const normalizedRef = LocalActivityResourcesMapper.normalizeRef(record);
    if (!normalizedRef) {
      return null;
    }
    const recordClone = LocalActivityResourcesMapper.cloneRecord(record);
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      return {
        ...currentState,
        [ACTIVITY_RESOURCES_TABLE_NAME]: this.upsertRecordCollection(table, recordClone)
      };
    });
    return this.peekSubEventResourceRecord(normalizedRef);
  }

  markRecordsDeletedByParentSubEventIds(parentEventId: string, subEventIds: readonly string[]): number {
    const normalizedParentEventId = `${parentEventId ?? ''}`.trim();
    const normalizedSubEventIds = new Set(
      (subEventIds ?? []).map(id => `${id ?? ''}`.trim()).filter(Boolean)
    );
    if (!normalizedParentEventId || normalizedSubEventIds.size === 0) {
      return 0;
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let changedCount = 0;
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      const byId = { ...table.byId };
      for (const id of table.ids) {
        const record = byId[id];
        if (!record
          || LocalActivityResourcesMapper.isDeleted(record)
          || !this.isRuntimeOwnerRecord(record.ownerId, normalizedParentEventId)
          || !normalizedSubEventIds.has(`${record.subEventId ?? ''}`.trim())) {
          continue;
        }
        byId[id] = {
          ...record,
          status: LocalActivityResourcesRepository.STATUS_DELETED,
          updatedMs: nowMs,
          updatedAtIso: nowIso
        };
        changedCount += 1;
      }
      return {
        ...currentState,
        [ACTIVITY_RESOURCES_TABLE_NAME]: {
          ...table,
          byId
        }
      };
    });
    return changedCount;
  }

  private normalizeCollection(value: unknown): ActivityResourcesRecordCollection {
    const source = value as Partial<ActivityResourcesRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivitySubEventResourceRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => `${id}`)
      : Object.keys(byId);
    const idsByOwnerKey = source?.idsByOwnerKey && typeof source.idsByOwnerKey === 'object'
      ? Object.fromEntries(
          Object.entries(source.idsByOwnerKey).map(([ownerKey, recordIds]) => [
            ownerKey,
            Array.isArray(recordIds) ? recordIds.map(id => `${id}`) : []
          ])
        )
      : {};

    for (const id of ids) {
      const record = byId[id];
      const ownerKey = `${record?.ownerKey ?? ''}`.trim();
      if (!ownerKey) {
        continue;
      }
      const bucket = idsByOwnerKey[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }

    return {
      byId,
      ids,
      idsByOwnerKey
    };
  }

  private upsertRecordCollection(
    table: ActivityResourcesRecordCollection,
    record: ActivitySubEventResourceRecord
  ): ActivityResourcesRecordCollection {
    const byId = {
      ...table.byId,
      [record.id]: record
    };
    const ids = table.ids.includes(record.id)
      ? [...table.ids]
      : [...table.ids, record.id];
    const idsByOwnerKey = {
      ...table.idsByOwnerKey
    };
    const bucket = idsByOwnerKey[record.ownerKey] ?? [];
    if (!bucket.includes(record.id)) {
      idsByOwnerKey[record.ownerKey] = [...bucket, record.id];
    }
    return {
      byId,
      ids,
      idsByOwnerKey
    };
  }

  private isRuntimeOwnerRecord(ownerId: string | null | undefined, parentEventId: string): boolean {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    return normalizedOwnerId === parentEventId || normalizedOwnerId.startsWith(`${parentEventId}:`);
  }
}
