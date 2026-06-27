import type * as AppConstants from '../../core/common/constants';
import type * as AppDTOs from '../../core/contracts';
import type * as ContractTypes from '../../core/contracts';

export type ResourceAssetDTO = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
  sourceLink?: string;
  routes?: string[];
  topics?: string[];
  policies?: AppDTOs.EventPolicyItemDTO[];
  pricing?: AppDTOs.PricingConfig | null;
  locationLabel?: string;
  priceLabel?: string;
  policyCount?: number;
};

export interface ResourcePopupContext {
  origin: 'chat' | 'eventEditor';
  ownerId: string;
  parentTitle: string;
  subEvent: ContractTypes.SubEventDTO;
  groupId?: string;
  groupName?: string;
  fallbackCardsByType: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>;
}

export interface CapacityEditorState {
  subEventId: string;
  type: AppConstants.AssetType;
  assetId: string;
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
  busy: boolean;
  error: string | null;
}

export interface RouteEditorState {
  subEventId: string;
  type: 'Car';
  assetId: string;
  title: string;
  mode: 'view' | 'edit';
  routes: string[];
  routeRowIds: string[];
  busy: boolean;
  error: string | null;
}

export interface SupplyContributionPopupState {
  subEventId: string;
  assetId: string;
  title: string;
}

export interface PendingSupplyDeleteState {
  subEventId: string;
  assetId: string;
  entryId: string;
  label: string;
  busy: boolean;
  error: string | null;
}

export interface PendingResourceDeleteState {
  assetId: string;
  type: AppConstants.AssetType;
  title: string;
  busy: boolean;
  error: string | null;
}

export interface PendingAssignSaveState {
  subEventId: string;
  type: AppConstants.AssetType;
  busy: boolean;
  error: string | null;
}

export interface AssetExplorePopupState {
  subEventId: string;
  type: AppConstants.AssetType;
  category: AppConstants.AssetCategory;
  startAtIso: string;
  endAtIso: string;
  loading: boolean;
  error: string | null;
  cards: ResourceAssetDTO[];
}

export interface AssetExploreBorrowDialogState {
  cardId: string;
  ownerUserId: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  availableQuantity: number;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  busy: boolean;
  error: string | null;
}

export interface AssignedAssetJoinDialogState {
  cardId: string;
  type: 'Car' | 'Accommodation';
  sourceAssetId: string;
  acceptedPolicyIds: string[];
  busy: boolean;
  error: string | null;
}

export interface AssetExploreBorrowDraftState {
  userId: string;
  subEventId: string;
  cardId: string;
  ownerUserId: string;
  title: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  updatedAtMs: number;
}

export interface AssetExploreBorrowPricingPreview {
  amount: number;
  currency: string;
}

export interface SupplyBringDialogState {
  subEventId: string;
  cardId: string;
  title: string;
  quantity: number;
  min: number;
  max: number;
  busy: boolean;
  error: string | null;
}

export interface AssignedAssetJoinPricingPreview {
  totalAmount: number;
  shareAmount: number;
  shareMemberCount: number;
  currency: string;
  chargeType: AppConstants.PricingChargeType | null;
}
