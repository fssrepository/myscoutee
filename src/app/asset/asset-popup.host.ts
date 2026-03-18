import type * as AppTypes from '../shared/core/base/models';

export interface AssetPopupHost {
  isMobileView(): boolean;
  isSubEventAssetAssignPopup(): boolean;
  assetTypeIcon(type: AppTypes.AssetFilterType): string;
  assetTypeClass(type: AppTypes.AssetFilterType): string;
  activityImageUrl(row: AppTypes.ActivityListRow): string;
  activitySourceLink(row: AppTypes.ActivityListRow): string;
  activitySourceAvatarClass(row: AppTypes.ActivityListRow): string;
  activitySourceAvatarLabel(row: AppTypes.ActivityListRow): string;
  activityLeadingIconCircleClass(row: AppTypes.ActivityListRow): string;
  activityLeadingIcon(row: AppTypes.ActivityListRow): string;
  ticketCardMetaLine(row: AppTypes.ActivityListRow): string;
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
