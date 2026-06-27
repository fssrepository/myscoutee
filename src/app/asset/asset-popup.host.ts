import type * as AppDTOs from '../shared/core/contracts';

export interface AssetPopupHost {
  isMobileView(): boolean;
  isSubEventAssetAssignPopup(): boolean;
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
