import { describe, expect, it } from 'vitest';

import type { PricingConfig } from '../../contracts';
import { PricingBuilder } from './pricing.builder';

describe('PricingBuilder', () => {
  it('keeps new asset pricing off with a zero base price', () => {
    expect(PricingBuilder.createDefaultPricingConfig('asset')).toMatchObject({
      enabled: false,
      mode: 'fixed',
      basePrice: 0,
      currency: 'USD',
      chargeType: 'per_attendee'
    });

    expect(PricingBuilder.normalizePricingConfig(undefined, {
      context: 'asset',
      allowSlotFeatures: false
    })).toMatchObject({
      enabled: false,
      basePrice: 0
    });
  });

  it('preserves every asset pricing field through save normalization', () => {
    const pricing: PricingConfig = {
      enabled: true,
      mode: 'hybrid',
      basePrice: 37.5,
      currency: 'EUR',
      taxMode: 'included',
      chargeType: 'per_attendee',
      quantityRulesEnabled: true,
      quantityRules: [{
        id: 'quantity-1',
        minQuantity: 3,
        action: { kind: 'decrease_amount', value: 2.5 }
      }],
      minPrice: 12,
      maxPrice: 80,
      rounding: 'half',
      demandRulesEnabled: true,
      demandRules: [{
        id: 'demand-1',
        operator: 'lte',
        capacityFilledPercent: 65,
        action: { kind: 'increase_percent', value: 7 },
        appliesTo: 'all_slots',
        slotIds: []
      }],
      timeRulesEnabled: true,
      timeRules: [{
        id: 'time-1',
        trigger: 'hours_before_start',
        offsetValue: 48,
        specificDateStart: null,
        specificDateEnd: null,
        action: { kind: 'decrease_percent', value: 11 },
        appliesTo: 'all_slots',
        slotIds: []
      }],
      cancellationPolicy: {
        enabled: true,
        rules: [{
          id: 'cancel-1',
          offsetUnit: 'weeks',
          offsetValue: 2,
          refundKind: 'fixed_amount',
          refundValue: 18.25
        }]
      },
      slotPricingEnabled: false,
      slotOverrides: [],
      audience: {
        enabled: true,
        memberPrice: 31,
        vipPrice: 25,
        inviteOnlyDiscountPercent: 9,
        promoCodes: [{
          id: 'promo-1',
          code: 'SAVE9',
          action: { kind: 'decrease_percent', value: 9 }
        }],
        soldOutLabel: 'Show "Waitlist"'
      }
    };

    expect(PricingBuilder.compactPricingConfig(pricing, {
      context: 'asset',
      allowSlotFeatures: false
    })).toEqual(pricing);
  });

  it('does not charge for a disabled asset even when a legacy base price exists', () => {
    expect(PricingBuilder.resolveAssetBorrowPricing({
      pricing: {
        ...PricingBuilder.createDefaultPricingConfig('asset'),
        enabled: false,
        basePrice: 10
      },
      totalQuantity: 1,
      requestedQuantity: 1,
      startAtIso: '2026-08-01T10:00:00',
      endAtIso: '2026-08-01T11:00:00'
    })).toEqual({
      amount: 0,
      currency: 'USD',
      rows: []
    });
  });

  it('applies cumulative time conditions per item and doubles quantity two', () => {
    const pricing: PricingConfig = {
      ...PricingBuilder.createDefaultPricingConfig('asset'),
      enabled: true,
      mode: 'time-based',
      basePrice: 12,
      chargeType: 'per_attendee',
      minPrice: 10,
      maxPrice: 30,
      rounding: 'whole',
      timeRulesEnabled: true,
      timeRules: [
        {
          id: 'date-uplift',
          trigger: 'specific_date',
          offsetValue: null,
          specificDateStart: '2020-07-23',
          specificDateEnd: '2020-07-25',
          action: { kind: 'increase_percent', value: 25 },
          appliesTo: 'all_slots',
          slotIds: []
        },
        {
          id: 'last-24-hours',
          trigger: 'hours_before_start',
          offsetValue: 24,
          specificDateStart: null,
          specificDateEnd: null,
          action: { kind: 'increase_amount', value: 5 },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ]
    };

    const oneItem = PricingBuilder.resolveAssetBorrowPricing({
      pricing,
      totalQuantity: 4,
      requestedQuantity: 1,
      startAtIso: '2020-07-23T08:30:00',
      endAtIso: '2020-07-23T09:15:00'
    });
    const twoItems = PricingBuilder.resolveAssetBorrowPricing({
      pricing,
      totalQuantity: 4,
      requestedQuantity: 2,
      startAtIso: '2020-07-23T08:30:00',
      endAtIso: '2020-07-23T09:15:00'
    });

    expect(oneItem.amount).toBe(20);
    expect(twoItems.amount).toBe(40);
    expect(twoItems.rows).toMatchObject([
      { key: 'base', amount: 12 },
      { key: 'time:date-uplift', amount: 3 },
      { key: 'time:last-24-hours', amount: 5 },
      { key: 'quantity', amount: 20, multiplier: 2 }
    ]);
  });

  it('charges every started 24-hour period for every requested item', () => {
    const preview = PricingBuilder.resolveAssetBorrowPricing({
      pricing: {
        ...PricingBuilder.createDefaultPricingConfig('asset'),
        enabled: true,
        basePrice: 12,
        chargeType: 'per_attendee',
        minPrice: 12,
        maxPrice: 12,
        rounding: 'whole'
      },
      totalQuantity: 4,
      requestedQuantity: 2,
      startAtIso: '2026-06-01T14:00:00',
      endAtIso: '2026-07-23T15:00:00'
    });

    expect(preview.amount).toBe(1272);
    expect(preview.rows).toMatchObject([
      { key: 'base', amount: 12 },
      { key: 'duration', amount: 624, multiplier: 53 },
      { key: 'quantity', amount: 636, multiplier: 2 }
    ]);
  });

  it('applies configured quantity rules before multiplying by item count', () => {
    const preview = PricingBuilder.resolveAssetBorrowPricing({
      pricing: {
        ...PricingBuilder.createDefaultPricingConfig('asset'),
        enabled: true,
        basePrice: 12,
        chargeType: 'per_attendee',
        quantityRulesEnabled: true,
        quantityRules: [{
          id: 'two-item-uplift',
          minQuantity: 2,
          action: { kind: 'increase_amount', value: 3 }
        }]
      },
      totalQuantity: 4,
      requestedQuantity: 2,
      startAtIso: '2026-07-23T08:30:00',
      endAtIso: '2026-07-23T09:15:00'
    });

    expect(preview.amount).toBe(30);
    expect(preview.rows).toMatchObject([
      { key: 'base', amount: 12 },
      { key: 'quantity-rule:two-item-uplift', amount: 3 },
      { key: 'quantity', amount: 15, multiplier: 2 }
    ]);
  });
});
