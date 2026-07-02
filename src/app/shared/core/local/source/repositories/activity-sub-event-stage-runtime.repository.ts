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
  private static readonly STATUS_DELETED = 'D';
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
      .filter((record): record is ActivitySubEventStageRuntimeRecord =>
        Boolean(record) && recordIds.has(record.id) && !LocalActivitySubEventStageRuntimeMapper.isDeleted(record))
      .map(record => LocalActivitySubEventStageRuntimeMapper.cloneRecord(record));
  }

  queryRecordsByOwnerIds(ownerIds: readonly string[]): ActivitySubEventStageRuntimeRecord[] {
    const normalizedOwnerIds = new Set(
      (ownerIds ?? []).map(ownerId => `${ownerId ?? ''}`.trim()).filter(Boolean)
    );
    if (normalizedOwnerIds.size === 0) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventStageRuntimeRecord =>
        Boolean(record)
        && normalizedOwnerIds.has(`${record.ownerId ?? ''}`.trim())
        && !LocalActivitySubEventStageRuntimeMapper.isDeleted(record))
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
    return record && !LocalActivitySubEventStageRuntimeMapper.isDeleted(record)
      ? LocalActivitySubEventStageRuntimeMapper.cloneRecord(record)
      : null;
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
      const table = this.normalizeCollection(currentState[ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]);
      const byId = { ...table.byId };
      for (const id of table.ids) {
        const record = byId[id];
        if (!record
          || LocalActivitySubEventStageRuntimeMapper.isDeleted(record)
          || !this.isRuntimeOwnerRecord(record.ownerId, normalizedParentEventId)
          || !normalizedSubEventIds.has(`${record.subEventId ?? ''}`.trim())) {
          continue;
        }
        byId[id] = {
          ...record,
          status: LocalActivitySubEventStageRuntimeRepository.STATUS_DELETED,
          updatedMs: nowMs,
          updatedAtIso: nowIso
        };
        changedCount += 1;
      }
      return {
        ...currentState,
        [ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME]: {
          ...table,
          byId
        }
      };
    });
    return changedCount;
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

  private isRuntimeOwnerRecord(ownerId: string | null | undefined, parentEventId: string): boolean {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    return normalizedOwnerId === parentEventId || normalizedOwnerId.startsWith(`${parentEventId}:`);
  }
}
