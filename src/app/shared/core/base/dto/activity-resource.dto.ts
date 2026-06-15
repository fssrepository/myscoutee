import type {
  AssetCardDTO,
  SubEventAssignedAssetSettingsDTO,
  SubEventSupplyContributionEntryDTO
} from './asset.dto';
import type { AssetType } from '../../common/constants';

export type ActivitySubEventAssetAssignmentIdsDTO = Partial<Record<AssetType, string[]>>;
export type ActivitySubEventAssetSettingsByTypeDTO = Partial<
  Record<AssetType, Record<string, SubEventAssignedAssetSettingsDTO>>
>;
export type ActivitySubEventSupplyContributionsByAssetIdDTO = Record<string, SubEventSupplyContributionEntryDTO[]>;

export interface ActivitySubEventResourceStateRefDTO {
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

export interface ActivitySubEventResourceStateDTO extends ActivitySubEventResourceStateRefDTO {
  assetAssignmentIds: ActivitySubEventAssetAssignmentIdsDTO;
  assetSettingsByType: ActivitySubEventAssetSettingsByTypeDTO;
  supplyContributionEntriesByAssetId: ActivitySubEventSupplyContributionsByAssetIdDTO;
  fallbackAssetCardsByType?: Partial<Record<AssetType, AssetCardDTO[]>>;
}
