import type {
  AssetCategory,
  AssetLifecycleStatus,
  AssetRequestKind,
  AssetRequestStatus,
  AssetType,
  EventVisibility,
  PricingCancellationRefundKind,
  PricingCancellationUnit,
  PricingChargeType,
  PricingDemandOperator,
  PricingMode,
  PricingRoundingMode,
  PricingRuleActionKind,
  PricingRuleScope,
  PricingTaxMode,
  PricingTimeRuleTrigger,
  SubEventResourceFilter,
  UserGender
} from '../../common/constants';

export interface EventPolicyItemDTO {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export interface PricingActionDTO {
  kind: PricingRuleActionKind;
  value: number;
}

export interface PricingSlotOverrideDTO {
  id: string;
  slotId?: string | null;
  label: string;
  startAt?: string | null;
  endAt?: string | null;
  price: number | null;
  currency?: string | null;
}

export interface PricingDemandRuleDTO {
  id: string;
  operator: PricingDemandOperator;
  capacityFilledPercent: number;
  action: PricingActionDTO;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface PricingTimeRuleDTO {
  id: string;
  trigger: PricingTimeRuleTrigger;
  offsetValue: number | null;
  specificDateStart?: string | null;
  specificDateEnd?: string | null;
  action: PricingActionDTO;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface PricingPromoCodeDTO {
  id: string;
  code: string;
  action: PricingActionDTO;
}

export interface PricingCancellationRuleDTO {
  id: string;
  offsetUnit: PricingCancellationUnit;
  offsetValue: number | null;
  refundKind: PricingCancellationRefundKind;
  refundValue: number | null;
}

export interface PricingCancellationPolicyDTO {
  enabled: boolean;
  rules: PricingCancellationRuleDTO[];
}

export interface PricingAudienceSettingsDTO {
  enabled: boolean;
  memberPrice: number | null;
  vipPrice: number | null;
  inviteOnlyDiscountPercent: number | null;
  promoCodes: PricingPromoCodeDTO[];
  soldOutLabel: string;
}

export interface PricingConfigDTO {
  enabled: boolean;
  mode: PricingMode;
  basePrice: number;
  currency: string;
  taxMode: PricingTaxMode;
  chargeType: PricingChargeType;
  minPrice: number | null;
  maxPrice: number | null;
  rounding: PricingRoundingMode;
  demandRulesEnabled: boolean;
  demandRules: PricingDemandRuleDTO[];
  timeRulesEnabled: boolean;
  timeRules: PricingTimeRuleDTO[];
  cancellationPolicy: PricingCancellationPolicyDTO;
  slotPricingEnabled: boolean;
  slotOverrides: PricingSlotOverrideDTO[];
  audience: PricingAudienceSettingsDTO;
}

export interface AssetHireRequestBookingDTO {
  eventId?: string;
  eventTitle?: string;
  subEventId?: string;
  subEventTitle?: string;
  slotKey?: string;
  slotLabel?: string;
  timeframe?: string;
  startAtIso?: string;
  endAtIso?: string;
  quantity?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  acceptedPolicyIds?: string[];
  paymentSessionId?: string | null;
  inventoryApplied?: boolean | null;
}

export interface AssetMemberRequestDTO {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: UserGender;
  status: AssetRequestStatus;
  note: string;
  requestKind?: AssetRequestKind;
  requestedAtIso?: string;
  booking?: AssetHireRequestBookingDTO | null;
  menuActions?: string[];
}

export interface AssetCardDTO {
  id: string;
  type: AssetType;
  title: string;
  subtitle: string;
  category?: AssetCategory;
  city: string;
  capacityTotal: number;
  quantity: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  topics?: string[];
  policies?: EventPolicyItemDTO[];
  pricing?: PricingConfigDTO | null;
  visibility?: EventVisibility;
  status?: AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[];
  menuActions?: string[];
}

export interface AssetExploreQueryDTO {
  userId: string;
  type: AssetType;
  category?: AssetCategory;
  startAtIso?: string;
  endAtIso?: string;
}

export interface AssetSourcePreviewDTO {
  enabled: boolean;
  supported: boolean;
  normalizedUrl: string;
  title: string;
  subtitle: string;
  details: string;
  imageUrl: string;
}

export interface SubEventResourceCardDTO {
  id: string;
  type: SubEventResourceFilter;
  sourceAssetId: string | null;
  title: string;
  subtitle: string;
  city: string;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes: string[];
  capacityTotal: number;
  accepted: number;
  pending: number;
  isMembers: boolean;
}

export interface SubEventAssignedAssetSettingsDTO {
  capacityMin: number;
  capacityMax: number;
  addedByUserId: string;
  routes: string[];
}

export interface SubEventAssetMembersContextDTO {
  subEventId: string;
  assetId: string;
  type: 'Car' | 'Accommodation';
  ownerUserId: string | null;
}

export interface SubEventSupplyContributionEntryDTO {
  id: string;
  userId: string;
  quantity: number;
  addedAtIso: string;
}

export interface SubEventSupplyContributionRowDTO {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserGender;
  age: number;
  city: string;
  addedAtIso: string;
  quantity: number;
}
