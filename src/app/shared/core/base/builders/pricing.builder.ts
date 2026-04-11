import type * as AppTypes from '../models';

export class PricingBuilder {
  static createDefaultPricingConfig(
    context: 'event' | 'asset' | 'subevent' = 'event'
  ): AppTypes.PricingConfig {
    return {
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
    mode: AppTypes.PricingMode = 'hybrid'
  ): AppTypes.PricingConfig {
    return {
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
          specificDate: null,
          action: {
            kind: 'decrease_percent',
            value: 5
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ],
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
    pricing: AppTypes.PricingConfig | null | undefined
  ): AppTypes.PricingConfig {
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

  static normalizePricingConfig(
    value: unknown,
    options: {
      context?: 'event' | 'asset' | 'subevent';
      slotCatalog?: readonly AppTypes.PricingSlotReference[];
    } = {}
  ): AppTypes.PricingConfig {
    const fallback = this.createDefaultPricingConfig(options.context ?? 'event');
    const source = (typeof value === 'object' && value !== null)
      ? value as Record<string, unknown>
      : {};
    const audienceSource = (typeof source['audience'] === 'object' && source['audience'] !== null)
      ? source['audience'] as Record<string, unknown>
      : {};

    const normalized: AppTypes.PricingConfig = {
      mode: this.normalizeMode(source['mode']),
      basePrice: this.normalizeMoney(source['basePrice'] ?? source['amount']) ?? fallback.basePrice,
      currency: this.normalizeCurrency(source['currency']) || fallback.currency,
      taxMode: this.normalizeTaxMode(source['taxMode']) ?? fallback.taxMode,
      chargeType: this.normalizeChargeType(source['chargeType']) ?? fallback.chargeType,
      minPrice: this.normalizeMoney(source['minPrice']),
      maxPrice: this.normalizeMoney(source['maxPrice']),
      rounding: this.normalizeRounding(source['rounding']) ?? fallback.rounding,
      demandRulesEnabled: this.normalizeBoolean(
        source['demandRulesEnabled'],
        Array.isArray(source['demandRules']) && source['demandRules'].length > 0
      ),
      demandRules: this.normalizeDemandRules(source['demandRules']),
      timeRulesEnabled: this.normalizeBoolean(
        source['timeRulesEnabled'],
        Array.isArray(source['timeRules']) && source['timeRules'].length > 0
      ),
      timeRules: this.normalizeTimeRules(source['timeRules']),
      slotPricingEnabled: this.normalizeBoolean(
        source['slotPricingEnabled'],
        Array.isArray(source['slotOverrides']) && source['slotOverrides'].length > 0
      ),
      slotOverrides: this.normalizeSlotOverrides(source['slotOverrides']),
      audience: {
        enabled: this.normalizeBoolean(
          audienceSource['enabled'],
          Array.isArray(audienceSource['promoCodes']) && audienceSource['promoCodes'].length > 0
        ),
        memberPrice: this.normalizeMoney(audienceSource['memberPrice']),
        vipPrice: this.normalizeMoney(audienceSource['vipPrice']),
        inviteOnlyDiscountPercent: this.normalizePercent(audienceSource['inviteOnlyDiscountPercent']),
        promoCodes: this.normalizePromoCodes(audienceSource['promoCodes']),
        soldOutLabel: this.normalizeText(audienceSource['soldOutLabel']) || fallback.audience.soldOutLabel
      }
    };

    if (normalized.maxPrice !== null && normalized.minPrice !== null && normalized.maxPrice < normalized.minPrice) {
      normalized.maxPrice = normalized.minPrice;
    }

    return this.syncSlotOverrides(normalized, options.slotCatalog ?? []);
  }

  static syncSlotOverrides(
    pricing: AppTypes.PricingConfig | null | undefined,
    slotCatalog: readonly AppTypes.PricingSlotReference[] = []
  ): AppTypes.PricingConfig {
    const next = this.clonePricingConfig(pricing);
    const catalogById = new Map(
      slotCatalog.map(item => [this.normalizeText(item.id), item] as const).filter(entry => Boolean(entry[0]))
    );

    next.slotOverrides = next.slotOverrides
      .map((item, index) => {
        const slotId = this.normalizeText(item.slotId);
        const linked = slotId ? catalogById.get(slotId) ?? null : null;
        const label = linked?.label?.trim() || this.normalizeText(item.label) || `Slot ${index + 1}`;
        return {
          ...item,
          id: this.normalizeText(item.id) || `slot-override-${index + 1}`,
          slotId: slotId || null,
          label,
          startAt: linked?.startAt ?? item.startAt ?? null,
          endAt: linked?.endAt ?? item.endAt ?? null,
          currency: this.normalizeCurrency(item.currency) || next.currency,
          price: this.normalizeMoney(item.price)
        };
      })
      .filter((item, index, source) => source.findIndex(candidate => candidate.id === item.id) === index);

    return next;
  }

  static slotOverrideFromReference(
    reference: AppTypes.PricingSlotReference,
    price: number | null = null,
    currency = 'USD'
  ): AppTypes.PricingSlotOverride {
    return {
      id: `slot-override-${reference.id}`,
      slotId: reference.id,
      label: reference.label,
      startAt: reference.startAt ?? null,
      endAt: reference.endAt ?? null,
      price,
      currency
    };
  }

  static slotCatalogFromEventSlotTemplates(
    slots: readonly Pick<AppTypes.EventSlotTemplate, 'id' | 'startAt' | 'endAt'>[]
  ): AppTypes.PricingSlotReference[] {
    return slots.map((slot, index) => ({
      id: `${slot.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
      label: `Slot ${index + 1}`,
      startAt: `${slot.startAt ?? ''}`.trim() || null,
      endAt: `${slot.endAt ?? ''}`.trim() || null
    }));
  }

  private static normalizeDemandRules(value: unknown): AppTypes.PricingDemandRule[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry, index) => {
      const source = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      return {
        id: this.normalizeText(source['id']) || `demand-rule-${index + 1}`,
        operator: this.normalizeDemandOperator(source['operator']) ?? 'gte',
        capacityFilledPercent: this.normalizePercent(source['capacityFilledPercent']) ?? 50,
        action: this.normalizeAction(source['action'], source['actionKind'], source['value']),
        appliesTo: this.normalizeRuleScope(source['appliesTo']) ?? 'all_slots',
        slotIds: this.normalizeStringArray(source['slotIds'])
      };
    });
  }

  private static normalizeTimeRules(value: unknown): AppTypes.PricingTimeRule[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry, index) => {
      const source = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      return {
        id: this.normalizeText(source['id']) || `time-rule-${index + 1}`,
        trigger: this.normalizeTimeTrigger(source['trigger']) ?? 'days_before_start',
        offsetValue: this.normalizeOffset(source['offsetValue']),
        specificDate: this.normalizeDate(source['specificDate']),
        action: this.normalizeAction(source['action'], source['actionKind'], source['value']),
        appliesTo: this.normalizeRuleScope(source['appliesTo']) ?? 'all_slots',
        slotIds: this.normalizeStringArray(source['slotIds'])
      };
    });
  }

  private static normalizeSlotOverrides(value: unknown): AppTypes.PricingSlotOverride[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry, index) => {
      const source = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      return {
        id: this.normalizeText(source['id']) || `slot-override-${index + 1}`,
        slotId: this.normalizeText(source['slotId']) || null,
        label: this.normalizeText(source['label']) || `Slot ${index + 1}`,
        startAt: this.normalizeText(source['startAt']) || null,
        endAt: this.normalizeText(source['endAt']) || null,
        price: this.normalizeMoney(source['price']),
        currency: this.normalizeCurrency(source['currency']) || null
      };
    });
  }

  private static normalizePromoCodes(value: unknown): AppTypes.PricingPromoCode[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry, index) => {
      const source = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      return {
        id: this.normalizeText(source['id']) || `promo-code-${index + 1}`,
        code: this.normalizeText(source['code']).toUpperCase(),
        action: this.normalizeAction(source['action'], source['actionKind'], source['value'])
      };
    }).filter(item => item.code.length > 0);
  }

  private static normalizeAction(
    actionValue: unknown,
    actionKindValue: unknown,
    rawValue: unknown
  ): AppTypes.PricingAction {
    const source = (typeof actionValue === 'object' && actionValue !== null) ? actionValue as Record<string, unknown> : {};
    return {
      kind: this.normalizeActionKind(source['kind'] ?? actionKindValue) ?? 'increase_percent',
      value: this.normalizeMoney(source['value'] ?? rawValue) ?? 0
    };
  }

  private static normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => this.normalizeText(item))
      .filter((item, index, source) => item.length > 0 && source.indexOf(item) === index);
  }

  private static normalizeBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'on' || normalized === 'enabled') {
        return true;
      }
      if (normalized === 'false' || normalized === 'off' || normalized === 'disabled') {
        return false;
      }
    }
    return fallback;
  }

  private static normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private static normalizeMoney(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.round(parsed * 100) / 100;
  }

  private static normalizePercent(value: unknown): number | null {
    const parsed = this.normalizeMoney(value);
    if (parsed === null) {
      return null;
    }
    return Math.max(0, Math.min(100, parsed));
  }

  private static normalizeOffset(value: unknown): number | null {
    const parsed = this.normalizeMoney(value);
    if (parsed === null) {
      return null;
    }
    return Math.max(0, parsed);
  }

  private static normalizeCurrency(value: unknown): string {
    return this.normalizeText(value).toUpperCase().slice(0, 8);
  }

  private static normalizeDate(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  private static normalizeMode(value: unknown): AppTypes.PricingMode {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'demand-based' || normalized === 'demand') {
      return 'demand-based';
    }
    if (normalized === 'time-based' || normalized === 'time') {
      return 'time-based';
    }
    if (normalized === 'hybrid') {
      return 'hybrid';
    }
    return 'fixed';
  }

  private static normalizeTaxMode(value: unknown): AppTypes.PricingTaxMode | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'included') {
      return 'included';
    }
    if (normalized === 'excluded') {
      return 'excluded';
    }
    return null;
  }

  private static normalizeChargeType(value: unknown): AppTypes.PricingChargeType | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'per_booking' || normalized === 'booking') {
      return 'per_booking';
    }
    if (normalized === 'per_slot' || normalized === 'slot') {
      return 'per_slot';
    }
    if (normalized === 'per_attendee' || normalized === 'attendee' || normalized === 'person') {
      return 'per_attendee';
    }
    return null;
  }

  private static normalizeRounding(value: unknown): AppTypes.PricingRoundingMode | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'whole' || normalized === 'whole_number') {
      return 'whole';
    }
    if (normalized === 'half' || normalized === '0.5') {
      return 'half';
    }
    if (normalized === 'none' || normalized === 'no_rounding') {
      return 'none';
    }
    return null;
  }

  private static normalizeActionKind(value: unknown): AppTypes.PricingRuleActionKind | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'set_exact_price' || normalized === 'exact_price') {
      return 'set_exact_price';
    }
    if (normalized === 'decrease_percent' || normalized === 'discount') {
      return 'decrease_percent';
    }
    if (normalized === 'increase_percent' || normalized === 'increase') {
      return 'increase_percent';
    }
    return null;
  }

  private static normalizeRuleScope(value: unknown): AppTypes.PricingRuleScope | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'selected_slots' || normalized === 'selected') {
      return 'selected_slots';
    }
    if (normalized === 'all_slots' || normalized === 'all') {
      return 'all_slots';
    }
    return null;
  }

  private static normalizeDemandOperator(value: unknown): AppTypes.PricingDemandOperator | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'lte' || normalized === '<=' || normalized === 'lt') {
      return 'lte';
    }
    if (normalized === 'gte' || normalized === '>=' || normalized === 'gt') {
      return 'gte';
    }
    return null;
  }

  private static normalizeTimeTrigger(value: unknown): AppTypes.PricingTimeRuleTrigger | null {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'hours_before_start' || normalized === 'hours') {
      return 'hours_before_start';
    }
    if (normalized === 'specific_date' || normalized === 'date') {
      return 'specific_date';
    }
    if (normalized === 'days_before_start' || normalized === 'days') {
      return 'days_before_start';
    }
    return null;
  }
}
