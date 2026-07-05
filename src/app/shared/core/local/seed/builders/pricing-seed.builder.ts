import type * as ContractTypes from '../../../contracts';
import type * as AppConstants from '../../../common/constants';

export class SeedPricingBuilder {
  static createDefaultPricingConfig(
    context: 'event' | 'asset' | 'subevent' = 'event'
  ): ContractTypes.PricingConfig {
    return {
      enabled: context === 'asset',
      mode: 'fixed',
      basePrice: context === 'asset' ? 10 : 0,
      currency: 'USD',
      taxMode: 'excluded',
      chargeType: context === 'asset' ? 'per_booking' : 'per_attendee',
      minPrice: null,
      maxPrice: null,
      rounding: 'none',
      demandRulesEnabled: false,
      demandRules: [],
      timeRulesEnabled: false,
      timeRules: [],
      cancellationPolicy: {
        enabled: false,
        rules: []
      },
      slotPricingEnabled: false,
      slotOverrides: [],
      audience: {
        enabled: false,
        memberPrice: null,
        vipPrice: null,
        inviteOnlyDiscountPercent: null,
        promoCodes: [],
        soldOutLabel: 'Show "Sold Out"'
      }
    };
  }

  static createSamplePricingConfig(
    mode: AppConstants.PricingMode = 'hybrid'
  ): ContractTypes.PricingConfig {
    return {
      enabled: true,
      mode,
      basePrice: 25,
      currency: 'USD',
      taxMode: 'excluded',
      chargeType: 'per_attendee',
      minPrice: 15,
      maxPrice: 60,
      rounding: 'whole',
      demandRulesEnabled: mode === 'demand-based' || mode === 'hybrid',
      demandRules: [
        {
          id: 'demand-rule-1',
          operator: 'gte',
          capacityFilledPercent: 50,
          action: {
            kind: 'increase_percent',
            value: 10
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ],
      timeRulesEnabled: mode === 'time-based' || mode === 'hybrid',
      timeRules: [
        {
          id: 'time-rule-1',
          trigger: 'days_before_start',
          offsetValue: 7,
          specificDateStart: null,
          specificDateEnd: null,
          action: {
            kind: 'decrease_percent',
            value: 5
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ],
      cancellationPolicy: {
        enabled: true,
        rules: [
          {
            id: 'cancellation-rule-1',
            offsetUnit: 'days',
            offsetValue: 7,
            refundKind: 'percent',
            refundValue: 50
          },
          {
            id: 'cancellation-rule-2',
            offsetUnit: 'hours',
            offsetValue: 24,
            refundKind: 'none',
            refundValue: null
          }
        ]
      },
      slotPricingEnabled: false,
      slotOverrides: [],
      audience: {
        enabled: false,
        memberPrice: 20,
        vipPrice: 15,
        inviteOnlyDiscountPercent: 25,
        promoCodes: [
          {
            id: 'promo-code-1',
            code: 'EARLY',
            action: {
              kind: 'decrease_percent',
              value: 10
            }
          }
        ],
        soldOutLabel: 'Show "Sold Out"'
      }
    };
  }

  static clonePricingConfig(
    pricing: ContractTypes.PricingConfig | null | undefined
  ): ContractTypes.PricingConfig {
    const normalized = pricing ?? this.createDefaultPricingConfig();
    return {
      ...normalized,
      demandRules: (normalized.demandRules ?? []).map(rule => ({
        ...rule,
        action: { ...rule.action },
        slotIds: [...(rule.slotIds ?? [])]
      })),
      timeRules: (normalized.timeRules ?? []).map(rule => ({
        ...rule,
        action: { ...rule.action },
        slotIds: [...(rule.slotIds ?? [])]
      })),
      cancellationPolicy: {
        enabled: normalized.cancellationPolicy?.enabled === true,
        rules: (normalized.cancellationPolicy?.rules ?? []).map(rule => ({ ...rule }))
      },
      slotOverrides: (normalized.slotOverrides ?? []).map(item => ({ ...item })),
      audience: {
        ...normalized.audience,
        promoCodes: (normalized.audience?.promoCodes ?? []).map(code => ({
          ...code,
          action: { ...code.action }
        }))
      }
    };
  }
}
