export type PricingMode = 'fixed' | 'demand-based' | 'time-based' | 'hybrid';
export type PricingTaxMode = 'excluded' | 'included';
export type PricingChargeType = 'per_attendee' | 'per_booking' | 'per_slot';
export type PricingRoundingMode = 'none' | 'whole' | 'half';
export type PricingRuleActionKind = 'increase_percent' | 'decrease_percent' | 'set_exact_price';
export type PricingRuleScope = 'all_slots' | 'selected_slots';
export type PricingDemandOperator = 'gte' | 'lte';
export type PricingTimeRuleTrigger = 'days_before_start' | 'hours_before_start' | 'specific_date';
export type PricingCancellationUnit = 'hours' | 'days' | 'weeks' | 'months';
export type PricingCancellationRefundKind = 'percent' | 'fixed_amount' | 'full' | 'none';

export interface PricingAction {
  kind: PricingRuleActionKind;
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
  operator: PricingDemandOperator;
  capacityFilledPercent: number;
  action: PricingAction;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface PricingTimeRule {
  id: string;
  trigger: PricingTimeRuleTrigger;
  offsetValue: number | null;
  specificDateStart?: string | null;
  specificDateEnd?: string | null;
  action: PricingAction;
  appliesTo: PricingRuleScope;
  slotIds: string[];
}

export interface PricingPromoCode {
  id: string;
  code: string;
  action: PricingAction;
}

export interface PricingCancellationRule {
  id: string;
  offsetUnit: PricingCancellationUnit;
  offsetValue: number | null;
  refundKind: PricingCancellationRefundKind;
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
  mode: PricingMode;
  basePrice: number;
  currency: string;
  taxMode: PricingTaxMode;
  chargeType: PricingChargeType;
  minPrice: number | null;
  maxPrice: number | null;
  rounding: PricingRoundingMode;
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
