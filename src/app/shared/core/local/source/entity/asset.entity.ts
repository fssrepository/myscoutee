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
export const ASSET_REQUESTS_TABLE_NAME = APP_INDEXED_DB_KEYS.assetRequests;

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

export interface AssetRequestRecord extends AssetMemberRequestRecord {
  assetId: string;
  ownerUserId: string;
  ownerKey: string;
  assetCapacity: number;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export type AssetAvailabilityFilterRecord = 'all' | 'active-items' | 'pending-requests' | 'borrowed-items';

export interface AssetAvailabilityDateRangeRecord {
  start: Date;
  end: Date;
}

export interface AssetAvailabilityRecordPageQuery {
  userId: string;
  assetId: string;
  dateIso?: string | null;
  filter?: AssetAvailabilityFilterRecord | null;
  page?: number;
  pageSize: number;
  cursor?: string | null;
}

export interface AssetAvailabilityStatRecordPageQuery {
  userId: string;
  assetId: string;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  filter?: AssetAvailabilityFilterRecord | null;
  page?: number;
  pageSize: number;
  cursor?: string | null;
}

export interface AssetAvailabilityRowRecord {
  request: AssetRequestRecord;
  requests: readonly AssetRequestRecord[];
  dateRange: AssetAvailabilityDateRangeRecord | null;
}

export interface AssetAvailabilityStatRecord {
  assetId: string;
  ownerUserId: string;
  assetCapacity: number;
  date: Date;
  requests: readonly AssetRequestRecord[];
}

export interface AssetAvailabilityRecordPageResult {
  records: AssetAvailabilityRowRecord[];
  total: number;
  nextCursor: string | null;
}

export interface AssetAvailabilityStatRecordPageResult {
  records: AssetAvailabilityStatRecord[];
  total: number;
  nextCursor: string | null;
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
  policiesEnabled?: boolean;
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
  policiesEnabled?: boolean;
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

export interface AssetRequestsRecordCollection {
  byId: Record<string, AssetRequestRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type AssetsMemorySchema = Record<typeof ASSETS_TABLE_NAME, AssetsRecordCollection>;
export type AssetRequestsMemorySchema = Record<typeof ASSET_REQUESTS_TABLE_NAME, AssetRequestsRecordCollection>;
