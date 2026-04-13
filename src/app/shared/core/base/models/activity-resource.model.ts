import type {
  AssetCard,
  AssetType,
  SubEventAssignedAssetSettings,
  SubEventSupplyContributionEntry
} from './asset.model';

export type ActivitySubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type ActivitySubEventAssetSettingsByType = Partial<
  Record<AssetType, Record<string, SubEventAssignedAssetSettings>>
>;
export type ActivitySubEventSupplyContributionsByAssetId = Record<string, SubEventSupplyContributionEntry[]>;

export interface ActivitySubEventResourceStateRef {
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

export interface ActivitySubEventResourceState extends ActivitySubEventResourceStateRef {
  assetAssignmentIds: ActivitySubEventAssetAssignmentIds;
  assetSettingsByType: ActivitySubEventAssetSettingsByType;
  supplyContributionEntriesByAssetId: ActivitySubEventSupplyContributionsByAssetId;
  fallbackAssetCardsByType?: Partial<Record<AssetType, AssetCard[]>>;
}
