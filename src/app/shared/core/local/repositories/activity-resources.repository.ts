import { Injectable, inject } from '@angular/core';

import { ActivityResourceBuilder } from '../../base/builders';
import { LocalMemoryDb } from '../../base/db';
import type * as AppTypes from '../../../core/base/models';
import { LocalAssetsRepository } from './assets.repository';
import { HttpActivityResourcesRepository } from '../../http/repositories/activity-resources.repository';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type ActivityResourcesRecordCollection,
  type ActivitySubEventResourceRecord
} from '../../base/models/activity-resources.model';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityResourcesRepository extends HttpActivityResourcesRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly assetsRepository = inject(LocalAssetsRepository);

  override peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
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
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      const recordId = ActivityResourceBuilder.recordId(normalizedState);
      const existing = table.byId[recordId];
      const nextRecord: ActivitySubEventResourceRecord = {
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
        fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(
          normalizedState.fallbackAssetCardsByType
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
    const fallbackCardsByType = ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType);
    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedRef.assetOwnerUserId);
    const eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>> = {
      Car: new Set([
        ...assets.filter(card => card.type === 'Car').map(card => card.id),
        ...(fallbackCardsByType.Car ?? []).map(card => card.id)
      ]),
      Accommodation: new Set([
        ...assets.filter(card => card.type === 'Accommodation').map(card => card.id),
        ...(fallbackCardsByType.Accommodation ?? []).map(card => card.id)
      ]),
      Supplies: new Set([
        ...assets.filter(card => card.type === 'Supplies').map(card => card.id),
        ...(fallbackCardsByType.Supplies ?? []).map(card => card.id)
      ])
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
      ),
      fallbackAssetCardsByType: {
        Car: (fallbackCardsByType.Car ?? []).filter(card => eligibleIdsByType.Car?.has(card.id)),
        Accommodation: (fallbackCardsByType.Accommodation ?? []).filter(card => eligibleIdsByType.Accommodation?.has(card.id)),
        Supplies: (fallbackCardsByType.Supplies ?? []).filter(card => eligibleIdsByType.Supplies?.has(card.id))
      }
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
