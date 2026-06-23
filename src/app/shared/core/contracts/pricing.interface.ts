import type * as AppConstants from '../common/constants';

export interface PricingAction {
  kind: AppConstants.PricingRuleActionKind;
  value: number;
}

export interface PricingSlotReference {
  id: string;
  label: string;
  startAt?: string | null;
  endAt?: string | null;
}

export interface PricingSlotOverride {
  id: string;
  slotId?: string | null;
  label: string;
  startAt?: string | null;
  endAt?: string | null;
  price: number | null;
  currency?: string | null;
}

export interface PricingDemandRule {
  id: string;
  operator: AppConstants.PricingDemandOperator;
  capacityFilledPercent: number;
  action: PricingAction;
  appliesTo: AppConstants.PricingRuleScope;
  slotIds: string[];
}

export interface PricingTimeRule {
  id: string;
  trigger: AppConstants.PricingTimeRuleTrigger;
  offsetValue: number | null;
  specificDateStart?: string | null;
  specificDateEnd?: string | null;
  action: PricingAction;
  appliesTo: AppConstants.PricingRuleScope;
  slotIds: string[];
}

export interface PricingPromoCode {
  id: string;
  code: string;
  action: PricingAction;
}

export interface PricingCancellationRule {
  id: string;
  offsetUnit: AppConstants.PricingCancellationUnit;
  offsetValue: number | null;
  refundKind: AppConstants.PricingCancellationRefundKind;
  refundValue: number | null;
}

export interface PricingCancellationPolicy {
  enabled: boolean;
  rules: PricingCancellationRule[];
}

export interface PricingAudienceSettings {
  enabled: boolean;
  memberPrice: number | null;
  vipPrice: number | null;
  inviteOnlyDiscountPercent: number | null;
  promoCodes: PricingPromoCode[];
  soldOutLabel: string;
}

export interface PricingConfig {
  enabled: boolean;
  mode: AppConstants.PricingMode;
  basePrice: number;
  currency: string;
  taxMode: AppConstants.PricingTaxMode;
  chargeType: AppConstants.PricingChargeType;
  minPrice: number | null;
  maxPrice: number | null;
  rounding: AppConstants.PricingRoundingMode;
  demandRulesEnabled: boolean;
  demandRules: PricingDemandRule[];
  timeRulesEnabled: boolean;
  timeRules: PricingTimeRule[];
  cancellationPolicy: PricingCancellationPolicy;
  slotPricingEnabled: boolean;
  slotOverrides: PricingSlotOverride[];
  audience: PricingAudienceSettings;
}

export interface PricingPreviewContext {
  capacityFilledPercent?: number | null;
  hoursUntilStart?: number | null;
  activeSlotId?: string | null;
}
