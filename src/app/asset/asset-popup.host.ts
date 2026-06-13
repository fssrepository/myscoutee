import type * as AppTypes from '../shared/core/base/models';

import type * as AppDTOs from '../shared/core/base/dto';
import type * as AppConstants from '../shared/core/common/constants';
export interface AssetPopupHost {
  isMobileView(): boolean;
  isSubEventAssetAssignPopup(): boolean;
  assetTypeIcon(type: AppConstants.AssetFilterType): string;
  assetTypeClass(type: AppConstants.AssetFilterType): string;
  subEventAssetAssignHeaderTitle(): string;
  subEventAssetAssignHeaderSubtitle(): string;
  canConfirmSubEventAssetAssignSelection(): boolean;
  isSubEventAssetAssignPending(): boolean;
  subEventAssetAssignErrorMessage(): string;
  closeSubEventAssetAssignPopup(apply?: boolean): void;
  confirmSubEventAssetAssignSelection(event?: Event): void;
  subEventAssetAssignCandidates(): AppDTOs.AssetCardDTO[];
  selectedSubEventAssetAssignChips(): AppDTOs.AssetCardDTO[];
  toggleSubEventAssetAssignCard(cardId: string, event?: Event): void;
  isSubEventAssetAssignCardSelected(cardId: string): boolean;
}
