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
  private readonly memoryDb = inject(LocalMemoryDb);

  peekSubEventResourceRecord(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): ActivitySubEventResourceRecord | null {
    const normalizedRef = LocalActivityResourcesMapper.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const record = table.byId[LocalActivityResourcesMapper.recordId(normalizedRef)];
    return record ? LocalActivityResourcesMapper.cloneRecord(record) : null;
  }

  async querySubEventResourceRecord(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<ActivitySubEventResourceRecord | null> {
    return this.peekSubEventResourceRecord(ref);
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
}
