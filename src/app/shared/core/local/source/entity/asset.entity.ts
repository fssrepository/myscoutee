import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
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
  UserGender
} from '../../../common/constants';

export const ASSETS_TABLE_NAME = APP_INDEXED_DB_KEYS.assets;

export interface AssetHireRequestBookingRecord {
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

export interface AssetMemberRequestRecord {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: UserGender;
  status: AssetRequestStatus;
  note: string;
  requestKind?: AssetRequestKind;
  requestedAtIso?: string;
  booking?: AssetHireRequestBookingRecord | null;
  menuActions?: string[];
}

export interface AssetPolicyRecord {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export interface AssetPricingActionRecord {
  kind: PricingRuleActionKind;
  value: number;
}

export interface AssetPricingSlotOverrideRecord {
  id: string;
  slotId?: string | null;
  label: string;
  startAt?: string | null;
  endAt?: string | null;
  price: number | null;
  currency?: string | null;
}

export interface AssetPricingDemandRuleRecord {
  id: string;
  operator: PricingDemandOperator;
  capacityFilledPercent: number;
  action: AssetPricingActionRecord;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface AssetPricingTimeRuleRecord {
  id: string;
  trigger: PricingTimeRuleTrigger;
  offsetValue: number | null;
  specificDateStart?: string | null;
  specificDateEnd?: string | null;
  action: AssetPricingActionRecord;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface AssetPricingPromoCodeRecord {
  id: string;
  code: string;
  action: AssetPricingActionRecord;
}

export interface AssetPricingCancellationRuleRecord {
  id: string;
  offsetUnit: PricingCancellationUnit;
  offsetValue: number | null;
  refundKind: PricingCancellationRefundKind;
  refundValue: number | null;
}

export interface AssetPricingCancellationPolicyRecord {
  enabled: boolean;
  rules: AssetPricingCancellationRuleRecord[];
}

export interface AssetPricingAudienceSettingsRecord {
  enabled: boolean;
  memberPrice: number | null;
  vipPrice: number | null;
  inviteOnlyDiscountPercent: number | null;
  promoCodes: AssetPricingPromoCodeRecord[];
  soldOutLabel: string;
}

export interface AssetPricingConfigRecord {
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
  demandRules: AssetPricingDemandRuleRecord[];
  timeRulesEnabled: boolean;
  timeRules: AssetPricingTimeRuleRecord[];
  cancellationPolicy: AssetPricingCancellationPolicyRecord;
  slotPricingEnabled: boolean;
  slotOverrides: AssetPricingSlotOverrideRecord[];
  audience: AssetPricingAudienceSettingsRecord;
}

export interface AssetSnapshotRecord {
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
  policies?: AssetPolicyRecord[];
  pricing?: AssetPricingConfigRecord | null;
  visibility?: EventVisibility;
  status?: AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestRecord[];
  menuActions?: string[];
}

export interface AssetRecord {
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
  policies?: AssetPolicyRecord[];
  pricing?: AssetPricingConfigRecord | null;
  ownerUserId: string;
  ownerName?: string;
  requests: AssetMemberRequestRecord[];
  menuActions?: string[];
  visibility: EventVisibility;
  status?: AssetLifecycleStatus | string;
  statusBeforeSuppression?: AssetLifecycleStatus | string | null;
  affinity?: number;
  boost?: number;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AssetsRecordCollection {
  byId: Record<string, AssetRecord>;
  ids: string[];
  idsByOwnerUserId: Record<string, string[]>;
}

export type AssetsMemorySchema = Record<typeof ASSETS_TABLE_NAME, AssetsRecordCollection>;
