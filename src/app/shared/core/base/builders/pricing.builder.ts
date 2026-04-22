import type * as AppTypes from '../models';

export class PricingBuilder {
  static createDefaultPricingConfig(
    context: 'event' | 'asset' | 'subevent' = 'event'
  ): AppTypes.PricingConfig {
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
    mode: AppTypes.PricingMode = 'hybrid'
  ): AppTypes.PricingConfig {
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
      cancellationPolicy: {
        enabled: normalized.cancellationPolicy?.enabled === true,
        rules: (normalized.cancellationPolicy?.rules ?? []).map(rule => ({
          ...rule
        }))
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

  static normalizePricingConfig(
    value: unknown,
    options: {
      context?: 'event' | 'asset' | 'subevent';
      slotCatalog?: readonly AppTypes.PricingSlotReference[];
      allowSlotFeatures?: boolean;
      allowedChargeTypes?: readonly AppTypes.PricingChargeType[];
      preserveEmptyPromoCodes?: boolean;
    } = {}
  ): AppTypes.PricingConfig {
    const context = options.context ?? 'event';
    const allowSlotFeatures = options.allowSlotFeatures ?? context === 'event';
    const slotCatalog = allowSlotFeatures ? (options.slotCatalog ?? []) : [];
    const fallback = this.createDefaultPricingConfig(context);
    const source = (typeof value === 'object' && value !== null)
      ? value as Record<string, unknown>
      : {};
    const audienceSource = (typeof source['audience'] === 'object' && source['audience'] !== null)
      ? source['audience'] as Record<string, unknown>
      : {};

    const normalized: AppTypes.PricingConfig = {
      enabled: this.normalizeBoolean(
        source['enabled'],
        this.hasMeaningfulPricingContent(source, context)
      ),
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
      cancellationPolicy: this.normalizeCancellationPolicy(source['cancellationPolicy']),
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
        promoCodes: this.normalizePromoCodes(
          audienceSource['promoCodes'],
          options.preserveEmptyPromoCodes === true
        ),
        soldOutLabel: this.normalizeText(audienceSource['soldOutLabel']) || fallback.audience.soldOutLabel
      }
    };

    const allowedChargeTypes = this.allowedChargeTypesForContext(
      context,
      allowSlotFeatures,
      options.allowedChargeTypes
    );
    normalized.chargeType = allowedChargeTypes.includes(normalized.chargeType)
      ? normalized.chargeType
      : allowedChargeTypes[0] ?? fallback.chargeType;

    const slotCatalogIds = new Set(
      slotCatalog
        .map(item => this.normalizeText(item.id))
        .filter(item => item.length > 0)
    );
    normalized.demandRules = normalized.demandRules.map(rule =>
      this.sanitizeRuleScope(rule, slotCatalogIds, allowSlotFeatures)
    );
    normalized.timeRules = normalized.timeRules.map(rule =>
      this.sanitizeRuleScope(rule, slotCatalogIds, allowSlotFeatures)
    );

    if (!allowSlotFeatures || slotCatalogIds.size === 0) {
      normalized.slotPricingEnabled = false;
      normalized.slotOverrides = [];
    }

    if (normalized.maxPrice !== null && normalized.minPrice !== null && normalized.maxPrice < normalized.minPrice) {
      normalized.maxPrice = normalized.minPrice;
    }

    return this.syncSlotOverrides(normalized, slotCatalog);
  }

  static compactPricingConfig(
    pricing: AppTypes.PricingConfig | null | undefined,
    options: {
      context?: 'event' | 'asset' | 'subevent';
      slotCatalog?: readonly AppTypes.PricingSlotReference[];
      allowSlotFeatures?: boolean;
      allowedChargeTypes?: readonly AppTypes.PricingChargeType[];
    } = {}
  ): AppTypes.PricingConfig {
    return this.normalizePricingConfig(pricing, {
      ...options,
      preserveEmptyPromoCodes: false
    });
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

  private static hasMeaningfulPricingContent(
    source: Readonly<Record<string, unknown>>,
    context: 'event' | 'asset' | 'subevent'
  ): boolean {
    const basePrice = this.normalizeMoney(source['basePrice'] ?? source['amount']) ?? (context === 'asset' ? 10 : 0);
    const demandRules = Array.isArray(source['demandRules']) ? source['demandRules'].length : 0;
    const timeRules = Array.isArray(source['timeRules']) ? source['timeRules'].length : 0;
    const slotOverrides = Array.isArray(source['slotOverrides']) ? source['slotOverrides'].length : 0;
    const cancellationPolicySource = (typeof source['cancellationPolicy'] === 'object' && source['cancellationPolicy'] !== null)
      ? source['cancellationPolicy'] as Record<string, unknown>
      : {};
    const cancellationRules = Array.isArray(cancellationPolicySource['rules']) ? cancellationPolicySource['rules'].length : 0;
    const audienceSource = (typeof source['audience'] === 'object' && source['audience'] !== null)
      ? source['audience'] as Record<string, unknown>
      : {};
    const promoCodes = Array.isArray(audienceSource['promoCodes']) ? audienceSource['promoCodes'].length : 0;
    const memberPrice = this.normalizeMoney(audienceSource['memberPrice']);
    const vipPrice = this.normalizeMoney(audienceSource['vipPrice']);
    const inviteOnlyDiscount = this.normalizePercent(audienceSource['inviteOnlyDiscountPercent']);

    return basePrice > 0
      || demandRules > 0
      || timeRules > 0
      || cancellationRules > 0
      || slotOverrides > 0
      || promoCodes > 0
      || memberPrice !== null
      || vipPrice !== null
      || inviteOnlyDiscount !== null;
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

  private static allowedChargeTypesForContext(
    context: 'event' | 'asset' | 'subevent',
    allowSlotFeatures: boolean,
    override?: readonly AppTypes.PricingChargeType[]
  ): readonly AppTypes.PricingChargeType[] {
    const normalizedOverride = (override ?? []).filter((value, index, source) =>
      (value === 'per_attendee' || value === 'per_booking' || value === 'per_slot')
      && source.indexOf(value) === index
    );
    if (normalizedOverride.length > 0) {
      return allowSlotFeatures
        ? normalizedOverride
        : normalizedOverride.filter(value => value !== 'per_slot');
    }

    const defaults: AppTypes.PricingChargeType[] = context === 'asset'
      ? ['per_booking', 'per_attendee']
      : ['per_attendee', 'per_booking'];
    if (allowSlotFeatures) {
      defaults.push('per_slot');
    }
    return defaults;
  }

  private static sanitizeRuleScope<T extends { appliesTo: AppTypes.PricingRuleScope; slotIds: string[] }>(
    rule: T,
    slotCatalogIds: ReadonlySet<string>,
    allowSlotFeatures: boolean
  ): T {
    if (!allowSlotFeatures || slotCatalogIds.size === 0 || rule.appliesTo !== 'selected_slots') {
      return {
        ...rule,
        appliesTo: 'all_slots',
        slotIds: []
      };
    }

    const slotIds = (rule.slotIds ?? [])
      .map(item => this.normalizeText(item))
      .filter(item => slotCatalogIds.has(item));

    if (slotIds.length === 0) {
      return {
        ...rule,
        appliesTo: 'all_slots',
        slotIds: []
      };
    }

    return {
      ...rule,
      slotIds
    };
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
        ...this.normalizeTimeRuleDateRange({
          id: this.normalizeText(source['id']) || `time-rule-${index + 1}`,
          trigger: this.normalizeTimeTrigger(source['trigger']) ?? 'days_before_start',
          offsetValue: this.normalizeOffset(source['offsetValue']),
          specificDateStart: this.normalizeDate(source['specificDateStart']),
          specificDateEnd: this.normalizeDate(source['specificDateEnd']),
          action: this.normalizeAction(source['action'], source['actionKind'], source['value']),
          appliesTo: this.normalizeRuleScope(source['appliesTo']) ?? 'all_slots',
          slotIds: this.normalizeStringArray(source['slotIds'])
        })
      };
    });
  }

  private static normalizeCancellationPolicy(value: unknown): AppTypes.PricingCancellationPolicy {
    const source = (typeof value === 'object' && value !== null) ? value as Record<string, unknown> : {};
    const rules = this.normalizeCancellationRules(source['rules']);
    return {
      enabled: this.normalizeBoolean(source['enabled'], rules.length > 0),
      rules
    };
  }

  private static normalizeCancellationRules(value: unknown): AppTypes.PricingCancellationRule[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry, index) => {
      const source = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      const refundKind = this.normalizeCancellationRefundKind(source['refundKind']) ?? 'percent';
      return {
        id: this.normalizeText(source['id']) || `cancellation-rule-${index + 1}`,
        offsetUnit: this.normalizeCancellationUnit(source['offsetUnit']) ?? 'days',
        offsetValue: this.normalizeOffset(source['offsetValue']),
        refundKind,
        refundValue: refundKind === 'percent'
          ? this.normalizePercent(source['refundValue'])
          : refundKind === 'fixed_amount'
            ? this.normalizeMoney(source['refundValue'])
            : null
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

  private static normalizePromoCodes(
    value: unknown,
    preserveEmpty = false
  ): AppTypes.PricingPromoCode[] {
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
    }).filter(item => preserveEmpty || item.code.length > 0);
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

  private static normalizeCancellationUnit(value: unknown): AppTypes.PricingCancellationUnit | null {
    const normalized = this.normalizeText(value);
    return normalized === 'hours' || normalized === 'days' || normalized === 'weeks' || normalized === 'months'
      ? normalized
      : null;
  }

  private static normalizeCancellationRefundKind(value: unknown): AppTypes.PricingCancellationRefundKind | null {
    const normalized = this.normalizeText(value);
    return normalized === 'percent'
      || normalized === 'fixed_amount'
      || normalized === 'full'
      || normalized === 'none'
      ? normalized
      : null;
  }

  private static normalizeDate(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  private static normalizeTimeRuleDateRange(rule: AppTypes.PricingTimeRule): AppTypes.PricingTimeRule {
    const start = rule.specificDateStart;
    const end = rule.specificDateEnd;
    if (!start && !end) {
      return {
        ...rule,
        specificDateStart: null,
        specificDateEnd: null
      };
    }
    if (start && !end) {
      return {
        ...rule,
        specificDateStart: start,
        specificDateEnd: start
      };
    }
    if (!start && end) {
      return {
        ...rule,
        specificDateStart: end,
        specificDateEnd: end
      };
    }
    if ((start ?? '') > (end ?? '')) {
      return {
        ...rule,
        specificDateStart: end,
        specificDateEnd: start
      };
    }
    return rule;
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
