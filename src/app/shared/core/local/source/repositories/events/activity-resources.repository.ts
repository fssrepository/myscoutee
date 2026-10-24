import { updateCollectionRecords } from '../../../common/record-collection';
import { subEventDeletionSelection } from '../../../common/record-collection';
import { upsertOwnerCollection } from '../../../common/record-collection';
import { normalizeOwnerCollection } from '../../../common/record-collection';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../../common/app.db';
import { ActivityResourceBuilder } from '../../../../base/builders/events/activity-resource.builder';
import { LocalActivityResourcesMapper } from '../../mappers';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type ActivityResourcesRecordCollection,
  type ActivitySubEventResourceRecord
} from '../../entity/common/activity.entity';

import type * as AppDTOs from '../../../../contracts';
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
    const record = table.ids
      .map(id => table.byId[id])
      .filter((item): item is ActivitySubEventResourceRecord => Boolean(item)
        && !LocalActivityResourcesMapper.isDeleted(item)
        && item.ownerId === normalizedRef.ownerId
        && item.subEventId === normalizedRef.subEventId
        && item.assetOwnerUserId === normalizedRef.assetOwnerUserId)
      .sort((left, right) => right.updatedMs - left.updatedMs)[0];
    return record
      ? LocalActivityResourcesMapper.cloneRecord(record)
      : null;
  }

  async querySubEventResourceRecord(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<ActivitySubEventResourceRecord | null> {
    return this.peekSubEventResourceRecord(ref);
  }

  peekSubEventResourceRecords(ownerId: string, subEventId: string): ActivitySubEventResourceRecord[] {
    const normalizedOwnerId = ownerId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedOwnerId || !normalizedSubEventId) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord => Boolean(record)
        && record.ownerId === normalizedOwnerId
        && record.subEventId === normalizedSubEventId
        && !LocalActivityResourcesMapper.isDeleted(record))
      .map(record => LocalActivityResourcesMapper.cloneRecord(record));
  }

  async querySupplyContributionPage(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO,
    assetId: string,
    page: number,
    pageSize: number
  ): Promise<AppDTOs.SubEventSupplyContributionPageDTO> {
    const normalizedRef = LocalActivityResourcesMapper.normalizeRef(ref);
    const normalizedAssetId = assetId.trim();
    const normalizedPage = Math.max(0, Math.trunc(page) || 0);
    const normalizedPageSize = Math.max(1, Math.trunc(pageSize) || 1);
    if (!normalizedRef || !normalizedAssetId) {
      return { items: [], total: 0, page: normalizedPage, pageSize: normalizedPageSize };
    }
    const storedTable = await this.memoryDb.readIndexedDbTableEntry<ActivityResourcesRecordCollection>(
      ACTIVITY_RESOURCES_TABLE_NAME
    );
    const table = this.normalizeCollection(
      storedTable ?? this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]
    );
    const entries = table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord => Boolean(record)
        && !LocalActivityResourcesMapper.isDeleted(record)
        && record.ownerId === normalizedRef.ownerId
        && record.subEventId === normalizedRef.subEventId)
      .flatMap(record => record.supplyContributionEntriesByAssetId[normalizedAssetId] ?? [])
      .sort((left, right) => Date.parse(right.addedAtIso) - Date.parse(left.addedAtIso));
    const start = normalizedPage * normalizedPageSize;
    return {
      items: entries.slice(start, start + normalizedPageSize).map(entry => ({ ...entry })),
      total: entries.length,
      page: normalizedPage,
      pageSize: normalizedPageSize
    };
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
    const scopeIds = new Set(normalizedRefs.map(ref => ActivityResourceBuilder.scopeId(ref)));
    const ids = Array.from(new Set(
      normalizedRefs.flatMap(ref => table.idsByOwnerKey[LocalActivityResourcesMapper.ownerKey(ref)] ?? [])
    ));
    return Array.from(new Set(ids))
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord =>
        Boolean(record)
        && scopeIds.has(ActivityResourceBuilder.scopeId(record))
        && !LocalActivityResourcesMapper.isDeleted(record))
      .map(record => LocalActivityResourcesMapper.cloneRecord(record));
  }

  queryRecordsByOwnerIds(ownerIds: readonly string[]): ActivitySubEventResourceRecord[] {
    const normalizedOwnerIds = new Set(
      (ownerIds ?? []).map(ownerId => `${ownerId ?? ''}`.trim()).filter(Boolean)
    );
    if (normalizedOwnerIds.size === 0) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord =>
        Boolean(record)
        && normalizedOwnerIds.has(`${record.ownerId ?? ''}`.trim())
        && !LocalActivityResourcesMapper.isDeleted(record))
      .map(record => LocalActivityResourcesMapper.cloneRecord(record));
  }

  peekActiveRecordsByEventScope(eventId: string): ActivitySubEventResourceRecord[] {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (!normalizedEventId) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ActivitySubEventResourceRecord => Boolean(record)
        && !LocalActivityResourcesMapper.isDeleted(record)
        && (record.ownerId === normalizedEventId || record.ownerId.startsWith(`${normalizedEventId}:`)))
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
    return LocalActivityResourcesMapper.cloneRecord(recordClone);
  }

  markRecordsDeletedByParentSubEventIds(parentEventId: string, subEventIds: readonly string[]): number {
    const selection = subEventDeletionSelection(parentEventId, subEventIds);
    if (!selection)
      return 0;
    const { normalizedParentEventId, normalizedSubEventIds, nowMs, nowIso } = selection;
    let changedCount = 0;
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      const updated = updateCollectionRecords(table, record => !(LocalActivityResourcesMapper.isDeleted(record)
        || !this.isRuntimeOwnerRecord(record.ownerId, normalizedParentEventId)
        || !normalizedSubEventIds.has(`${record.subEventId ?? ''}`.trim())), record => ({
          ...record,
          status: LocalActivityResourcesRepository.STATUS_DELETED,
          updatedMs: nowMs,
          updatedAtIso: nowIso
        }));
      changedCount = updated.changedCount;
      return {
        ...currentState,
        [ACTIVITY_RESOURCES_TABLE_NAME]: {
          ...table,
          byId: updated.byId
        }
      };
    });
    return changedCount;
  }

  private normalizeCollection(value: unknown): ActivityResourcesRecordCollection {
    return normalizeOwnerCollection<ActivitySubEventResourceRecord>(value);
  }

  private upsertRecordCollection(
    table: ActivityResourcesRecordCollection,
    record: ActivitySubEventResourceRecord
  ): ActivityResourcesRecordCollection {
    return upsertOwnerCollection(table, record);
  }

  private isRuntimeOwnerRecord(ownerId: string | null | undefined, parentEventId: string): boolean {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    return normalizedOwnerId === parentEventId || normalizedOwnerId.startsWith(`${parentEventId}:`);
  }
}
