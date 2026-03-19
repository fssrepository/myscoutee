import type * as AppTypes from '../shared/core/base/models';

export interface AssetPopupHost {
  isMobileView(): boolean;
  isSubEventAssetAssignPopup(): boolean;
  assetTypeIcon(type: AppTypes.AssetFilterType): string;
  assetTypeClass(type: AppTypes.AssetFilterType): string;
  subEventAssetAssignHeaderTitle(): string;
  subEventAssetAssignHeaderSubtitle(): string;
  canConfirmSubEventAssetAssignSelection(): boolean;
  closeSubEventAssetAssignPopup(apply?: boolean): void;
  confirmSubEventAssetAssignSelection(event?: Event): void;
  subEventAssetAssignCandidates(): AppTypes.AssetCard[];
  selectedSubEventAssetAssignChips(): AppTypes.AssetCard[];
  toggleSubEventAssetAssignCard(cardId: string, event?: Event): void;
  isSubEventAssetAssignCardSelected(cardId: string): boolean;
}
