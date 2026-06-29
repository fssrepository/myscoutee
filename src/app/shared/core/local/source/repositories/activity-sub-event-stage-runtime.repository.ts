import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { LocalActivitySubEventStageRuntimeMapper } from '../mappers';
import {
  ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME,
  type ActivitySubEventStageRuntimeRecord,
  type ActivitySubEventStageRuntimeRecordCollection
} from '../entity/activity.entity';

import type * as AppDTOs from '../../../contracts';

@Injectable({
  providedIn: 'root'
})
export class LocalActivitySubEventStageRuntimeRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryRecordsByRefs(
    refs: readonly AppDTOs.ActivitySubEventStageRuntimeStateRefDTO[]
  ): ActivitySubEventStageRuntimeRecord[] {
    const normalizedRefs = (refs ?? [])
      .map(ref => LocalActivitySubEventStageRuntimeMapper.normalizeRef(ref))
      .filter((ref): ref is AppDTOs.ActivitySubEventStageRuntimeStateRefDTO => Boolean(ref));
    if (normalizedRefs.length === 0) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
    const recordIds = new Set(normalizedRefs.map(ref => LocalActivitySubEventStageRuntimeMapper.recordId(ref)));
    const ids = Array.from(new Set(
      normalizedRefs.flatMap(ref => table.idsByOwnerKey[LocalActivitySubEventStageRuntimeMapper.ownerKey(ref)] ?? [])
    ));
    return ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventStageRuntimeRecord => Boolean(record) && recordIds.has(record.id))
      .map(record => LocalActivitySubEventStageRuntimeMapper.cloneRecord(record));
  }

  peekRecord(
    ref: AppDTOs.ActivitySubEventStageRuntimeStateRefDTO
  ): ActivitySubEventStageRuntimeRecord | null {
    const normalizedRef = LocalActivitySubEventStageRuntimeMapper.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
    const record = table.byId[LocalActivitySubEventStageRuntimeMapper.recordId(normalizedRef)];
    return record ? LocalActivitySubEventStageRuntimeMapper.cloneRecord(record) : null;
  }

  replaceRecord(
    record: ActivitySubEventStageRuntimeRecord
  ): ActivitySubEventStageRuntimeRecord | null {
    const normalizedRef = LocalActivitySubEventStageRuntimeMapper.normalizeRef(record);
    if (!normalizedRef) {
      return null;
    }
    const recordClone = LocalActivitySubEventStageRuntimeMapper.cloneRecord(record);
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
      return {
        ...currentState,
        [ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]: this.upsertRecordCollection(table, recordClone)
      };
    });
    return this.peekRecord(normalizedRef);
  }

  private normalizeCollection(value: unknown): ActivitySubEventStageRuntimeRecordCollection {
    const source = value as Partial<ActivitySubEventStageRuntimeRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivitySubEventStageRuntimeRecord>) }
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
    table: ActivitySubEventStageRuntimeRecordCollection,
    record: ActivitySubEventStageRuntimeRecord
  ): ActivitySubEventStageRuntimeRecordCollection {
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
