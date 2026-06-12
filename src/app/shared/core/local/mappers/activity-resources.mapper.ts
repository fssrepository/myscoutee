import { ActivityResourceBuilder } from '../../base/builders';
import type * as AppTypes from '../../../core/base/models';
import type { ActivitySubEventResourceRecord } from '../../base/models/activity-resources.model';

export class LocalActivityResourcesMapper {
  static normalizeRef(
    ref: AppTypes.ActivitySubEventResourceStateRef | null | undefined
  ): AppTypes.ActivitySubEventResourceStateRef | null {
    const ownerId = `${ref?.ownerId ?? ''}`.trim();
    const subEventId = `${ref?.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref?.assetOwnerUserId ?? ''}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId
    };
  }

  static recordId(ref: AppTypes.ActivitySubEventResourceStateRef): string {
    return ActivityResourceBuilder.recordId(ref);
  }

  static ownerKey(ref: AppTypes.ActivitySubEventResourceStateRef): string {
    return ActivityResourceBuilder.ownerKey(ref);
  }

  static normalizeState(
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    fallbackRef?: AppTypes.ActivitySubEventResourceStateRef | null
  ): AppTypes.ActivitySubEventResourceState | null {
    return ActivityResourceBuilder.normalizeState(state, fallbackRef);
  }

  static toRecord(
    state: AppTypes.ActivitySubEventResourceState,
    existing?: ActivitySubEventResourceRecord | null
  ): ActivitySubEventResourceRecord {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    return {
      id: this.recordId(state),
      ownerKey: this.ownerKey(state),
      ownerId: state.ownerId,
      subEventId: state.subEventId,
      assetOwnerUserId: state.assetOwnerUserId,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(state.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(state.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        state.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(state.fallbackAssetCardsByType),
      createdMs: existing?.createdMs ?? nowMs,
      updatedMs: nowMs,
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso
    };
  }

  static toState(
    record: ActivitySubEventResourceRecord,
    availableAssets: readonly AppTypes.AssetCard[]
  ): AppTypes.ActivitySubEventResourceState | null {
    const fallbackCardsByType = ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType);
    const eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>> = {
      Car: new Set([
        ...availableAssets.filter(card => card.type === 'Car').map(card => card.id),
        ...(fallbackCardsByType.Car ?? []).map(card => card.id)
      ]),
      Accommodation: new Set([
        ...availableAssets.filter(card => card.type === 'Accommodation').map(card => card.id),
        ...(fallbackCardsByType.Accommodation ?? []).map(card => card.id)
      ]),
      Supplies: new Set([
        ...availableAssets.filter(card => card.type === 'Supplies').map(card => card.id),
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
    }, record);
    return normalizedState ? ActivityResourceBuilder.cloneState(normalizedState) : null;
  }

  static cloneRecord(record: ActivitySubEventResourceRecord): ActivitySubEventResourceRecord {
    return {
      ...record,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(record.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(record.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        record.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType)
    };
  }

  private static filterSettingsByEligibleIds(
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
        next[type] = Object.fromEntries(entries.map(([assetId, value]) => [
          assetId,
          { ...value, routes: [...(value.routes ?? [])] }
        ]));
      }
    }
    return next;
  }
}
