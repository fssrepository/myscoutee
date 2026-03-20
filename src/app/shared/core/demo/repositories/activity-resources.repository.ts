import { Injectable, inject } from '@angular/core';

import { ActivityResourceBuilder } from '../../base/builders';
import { AppMemoryDb } from '../../base/db';
import type * as AppTypes from '../../../core/base/models';
import { DemoAssetsRepository } from './assets.repository';
import { HttpActivityResourcesRepository } from '../../http/repositories/activity-resources.repository';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type DemoActivityResourcesRecordCollection,
  type DemoActivitySubEventResourceRecord
} from '../models/activity-resources.model';
import type { DemoEventRecord } from '../models/events.model';
import { DemoEventsRepository } from './events.repository';
import { DemoUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityResourcesRepository extends HttpActivityResourcesRepository {
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly assetsRepository = inject(DemoAssetsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);

  init(ownerUserIds?: readonly string[]): void {
    if (!ownerUserIds) {
      this.usersRepository.init();
    }

    const normalizedUserIds = Array.from(new Set(
      (ownerUserIds ?? this.usersRepository.queryAvailableDemoUsers().map(user => user.id))
        .map(userId => userId.trim())
    ))
      .filter(userId => userId.length > 0);
    if (normalizedUserIds.length === 0) {
      return;
    }

    this.eventsRepository.init();
    this.assetsRepository.init(normalizedUserIds);

    let nextTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    let changed = false;

    for (const userId of normalizedUserIds) {
      for (const record of this.buildSeededRecordsForUser(userId)) {
        if (nextTable.byId[record.id]) {
          continue;
        }
        nextTable = this.upsertRecordCollection(nextTable, record);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    this.memoryDb.write(state => ({
      ...state,
      [ACTIVITY_RESOURCES_TABLE_NAME]: nextTable
    }));
  }

  override peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    this.ensureSeededState(normalizedRef);
    return this.readState(normalizedRef);
  }

  override async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    return this.peekSubEventResourceState(ref);
  }

  override async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    this.ensureSeededState(normalizedState);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      const recordId = ActivityResourceBuilder.recordId(normalizedState);
      const existing = table.byId[recordId];
      const nextRecord: DemoActivitySubEventResourceRecord = {
        id: recordId,
        ownerKey: ActivityResourceBuilder.ownerKey(normalizedState),
        ownerId: normalizedState.ownerId,
        subEventId: normalizedState.subEventId,
        assetOwnerUserId: normalizedState.assetOwnerUserId,
        assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(normalizedState.assetAssignmentIds),
        assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(normalizedState.assetSettingsByType),
        supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
          normalizedState.supplyContributionEntriesByAssetId
        ),
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs,
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso
      };
      return {
        ...currentState,
        [ACTIVITY_RESOURCES_TABLE_NAME]: this.upsertRecordCollection(table, nextRecord)
      };
    });
    return this.readState(normalizedState);
  }

  private ensureSeededState(ref: AppTypes.ActivitySubEventResourceStateRef): void {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const recordId = ActivityResourceBuilder.recordId(normalizedRef);
    if (table.byId[recordId]) {
      return;
    }
    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedRef.assetOwnerUserId);
    const seededState = ActivityResourceBuilder.buildSeededState(normalizedRef, assets);
    const createdMs = Date.now();
    const createdAtIso = new Date(createdMs).toISOString();
    const seededRecord: DemoActivitySubEventResourceRecord = {
      id: recordId,
      ownerKey: ActivityResourceBuilder.ownerKey(normalizedRef),
      ownerId: normalizedRef.ownerId,
      subEventId: normalizedRef.subEventId,
      assetOwnerUserId: normalizedRef.assetOwnerUserId,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(seededState.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(seededState.assetSettingsByType),
      supplyContributionEntriesByAssetId: {},
      createdMs,
      updatedMs: createdMs,
      createdAtIso,
      updatedAtIso: createdAtIso
    };
    this.memoryDb.write(currentState => ({
      ...currentState,
      [ACTIVITY_RESOURCES_TABLE_NAME]: this.upsertRecordCollection(
        this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]),
        seededRecord
      )
    }));
  }

  private readState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const record = table.byId[ActivityResourceBuilder.recordId(normalizedRef)];
    if (!record) {
      return null;
    }
    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedRef.assetOwnerUserId);
    const eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>> = {
      Car: new Set(assets.filter(card => card.type === 'Car').map(card => card.id)),
      Accommodation: new Set(assets.filter(card => card.type === 'Accommodation').map(card => card.id)),
      Supplies: new Set(assets.filter(card => card.type === 'Supplies').map(card => card.id))
    };
    const normalizedState = ActivityResourceBuilder.normalizeState({
      ownerId: record.ownerId,
      subEventId: record.subEventId,
      assetOwnerUserId: record.assetOwnerUserId,
      assetAssignmentIds: {
        Car: (record.assetAssignmentIds.Car ?? []).filter(id => eligibleIdsByType.Car?.has(id)),
        Accommodation: (record.assetAssignmentIds.Accommodation ?? []).filter(id => eligibleIdsByType.Accommodation?.has(id)),
        Supplies: (record.assetAssignmentIds.Supplies ?? []).filter(id => eligibleIdsByType.Supplies?.has(id))
      },
      assetSettingsByType: this.filterSettingsByEligibleIds(record.assetSettingsByType, eligibleIdsByType),
      supplyContributionEntriesByAssetId: Object.fromEntries(
        Object.entries(record.supplyContributionEntriesByAssetId ?? {})
          .filter(([assetId]) => eligibleIdsByType.Supplies?.has(assetId))
      )
    }, normalizedRef);
    return normalizedState ? ActivityResourceBuilder.cloneState(normalizedState) : null;
  }

  private filterSettingsByEligibleIds(
    source: AppTypes.ActivitySubEventAssetSettingsByType,
    eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>>
  ): AppTypes.ActivitySubEventAssetSettingsByType {
    const next: AppTypes.ActivitySubEventAssetSettingsByType = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const settings = source?.[type];
      const eligible = eligibleIdsByType[type];
      if (!settings || !eligible) {
        continue;
      }
      const entries = Object.entries(settings).filter(([assetId]) => eligible.has(assetId));
      if (entries.length > 0) {
        next[type] = Object.fromEntries(entries.map(([assetId, value]) => [assetId, { ...value, routes: [...(value.routes ?? [])] }]));
      }
    }
    return next;
  }

  private buildSeededRecordsForUser(userId: string): DemoActivitySubEventResourceRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedUserId);
    const sourceRecords = this.collectSourceRecordsForUser(normalizedUserId);
    const seenRecordIds = new Set<string>();
    const nextRecords: DemoActivitySubEventResourceRecord[] = [];
    let createdMs = Date.now();

    for (const record of sourceRecords) {
      for (const subEvent of record.subEvents ?? []) {
        const normalizedRef = this.normalizeRef({
          ownerId: record.id,
          subEventId: subEvent.id,
          assetOwnerUserId: normalizedUserId
        });
        if (!normalizedRef) {
          continue;
        }
        const recordId = ActivityResourceBuilder.recordId(normalizedRef);
        if (seenRecordIds.has(recordId)) {
          continue;
        }
        seenRecordIds.add(recordId);

        const seededState = ActivityResourceBuilder.buildSeededState(normalizedRef, assets);
        const createdAtIso = new Date(createdMs).toISOString();
        nextRecords.push({
          id: recordId,
          ownerKey: ActivityResourceBuilder.ownerKey(normalizedRef),
          ownerId: normalizedRef.ownerId,
          subEventId: normalizedRef.subEventId,
          assetOwnerUserId: normalizedRef.assetOwnerUserId,
          assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(seededState.assetAssignmentIds),
          assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(seededState.assetSettingsByType),
          supplyContributionEntriesByAssetId: {},
          createdMs,
          updatedMs: createdMs,
          createdAtIso,
          updatedAtIso: createdAtIso
        });
        createdMs += 1;
      }
    }

    return nextRecords;
  }

  private collectSourceRecordsForUser(userId: string): DemoEventRecord[] {
    const seenIds = new Set<string>();
    const nextRecords: DemoEventRecord[] = [];

    for (const record of [
      ...this.eventsRepository.queryItemsByUser(userId),
      ...this.eventsRepository.queryExploreItems(userId)
    ]) {
      if (!record.id || seenIds.has(record.id)) {
        continue;
      }
      seenIds.add(record.id);
      nextRecords.push(record);
    }

    return nextRecords;
  }

  private normalizeCollection(value: unknown): DemoActivityResourcesRecordCollection {
    const source = value as Partial<DemoActivityResourcesRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, DemoActivitySubEventResourceRecord>) }
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
    table: DemoActivityResourcesRecordCollection,
    record: DemoActivitySubEventResourceRecord
  ): DemoActivityResourcesRecordCollection {
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
