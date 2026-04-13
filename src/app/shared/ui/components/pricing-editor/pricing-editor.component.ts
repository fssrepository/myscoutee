import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { PricingBuilder } from '../../../core/base/builders';
import type * as AppTypes from '../../../core/base/models';
import { PricingSlotPanelComponent } from '../pricing-slot-panel';

interface PricingPreviewState {
  basePrice: number;
  slotOverridePrice: number | null;
  demandDelta: number;
  timeDelta: number;
  finalPrice: number;
  demandNotes: string[];
  timeNotes: string[];
}

type PricingScopedRule = AppTypes.PricingDemandRule | AppTypes.PricingTimeRule;

interface RuleScopePickerState {
  kind: 'demand' | 'time';
  ruleId: string;
  appliesTo: AppTypes.PricingRuleScope;
  slotIds: string[];
}

@Component({
  selector: 'app-pricing-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    PricingSlotPanelComponent
  ],
  templateUrl: './pricing-editor.component.html',
  styleUrl: './pricing-editor.component.scss'
})
export class PricingEditorComponent implements OnChanges {
  @Input() pricing: AppTypes.PricingConfig | null | undefined = null;
  @Output() readonly pricingChange = new EventEmitter<AppTypes.PricingConfig>();

  @Input() context: 'event' | 'asset' | 'subevent' = 'event';
  @Input() presentation: 'inline' | 'popup-summary' = 'inline';
  @Input() slotCatalog: readonly AppTypes.PricingSlotReference[] = [];
  @Input() readOnly = false;
  @Input() title = 'Pricing';
  @Input() subtitle = '';
  @Input() showAudienceSection: boolean | null = null;
  @Input() showPreview: boolean | null = null;
  @Input() allowSlotFeatures: boolean | null = null;

  protected workingPricing: AppTypes.PricingConfig = PricingBuilder.createDefaultPricingConfig('event');

  protected readonly modeOptions: readonly AppTypes.PricingMode[] = ['fixed', 'demand-based', 'time-based', 'hybrid'];
  protected readonly currencyOptions = ['USD', 'EUR', 'GBP', 'CZK'];
  protected readonly taxModeOptions: readonly AppTypes.PricingTaxMode[] = ['excluded', 'included'];
  protected readonly roundingOptions: readonly AppTypes.PricingRoundingMode[] = ['none', 'whole', 'half'];
  protected readonly demandOperatorOptions: readonly AppTypes.PricingDemandOperator[] = ['gte', 'lte'];
  protected readonly actionKindOptions: readonly AppTypes.PricingRuleActionKind[] = ['increase_percent', 'decrease_percent', 'set_exact_price'];
  protected readonly ruleScopeOptions: readonly AppTypes.PricingRuleScope[] = ['all_slots', 'selected_slots'];
  protected readonly timeTriggerOptions: readonly AppTypes.PricingTimeRuleTrigger[] = ['days_before_start', 'hours_before_start', 'specific_date'];
  protected readonly soldOutLabelOptions = ['Show "Sold Out"', 'Hide from list', 'Show "Waitlist"'];
  protected resolvedChargeTypeOptions: readonly AppTypes.PricingChargeType[] = ['per_attendee', 'per_booking', 'per_slot'];
  protected resolvedAllowSlotFeatures = true;
  protected resolvedShowAudienceSection = true;
  protected resolvedShowPreview = true;
  protected resolvedPresentation: 'inline' | 'popup-summary' = 'inline';
  protected wizardOpen = false;

  private idSequence = 0;
  private ruleScopePickerState: RuleScopePickerState | null = null;

  protected currentPreview!: PricingPreviewState;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['pricing']
      || changes['slotCatalog']
      || changes['context']
      || changes['allowSlotFeatures']
      || changes['showAudienceSection']
      || changes['showPreview']
      || changes['presentation']
    ) {
      this.syncResolvedCapabilities();
      this.syncWorkingPricing();
    }
  }

  protected setMode(mode: AppTypes.PricingMode): void {
    if (this.readOnly || this.workingPricing.mode === mode) {
      return;
    }
    this.workingPricing.mode = mode;
    const supportsDemand = mode === 'demand-based' || mode === 'hybrid';
    const supportsTime = mode === 'time-based' || mode === 'hybrid';
    this.workingPricing.demandRulesEnabled = supportsDemand
      ? (this.workingPricing.demandRulesEnabled || this.workingPricing.demandRules.length > 0)
      : false;
    this.workingPricing.timeRulesEnabled = supportsTime
      ? (this.workingPricing.timeRulesEnabled || this.workingPricing.timeRules.length > 0)
      : false;
    if (supportsDemand && this.workingPricing.demandRules.length === 0) {
      this.workingPricing.demandRules = [this.createDefaultDemandRule()];
      this.workingPricing.demandRulesEnabled = true;
    }
    if (supportsTime && this.workingPricing.timeRules.length === 0) {
      this.workingPricing.timeRules = [this.createDefaultTimeRule()];
      this.workingPricing.timeRulesEnabled = true;
    }
    this.emitPricing();
  }

  protected modeLabel(mode: AppTypes.PricingMode): string {
    switch (mode) {
      case 'demand-based':
        return 'Demand-based';
      case 'time-based':
        return 'Time-based';
      case 'hybrid':
        return 'Hybrid';
      default:
        return 'Fixed';
    }
  }

  protected actionLabel(action: AppTypes.PricingRuleActionKind): string {
    switch (action) {
      case 'decrease_percent':
        return 'Decrease by %';
      case 'set_exact_price':
        return 'Set exact price';
      default:
        return 'Increase by %';
    }
  }

  protected chargeTypeLabel(chargeType: AppTypes.PricingChargeType): string {
    switch (chargeType) {
      case 'per_booking':
        return 'Per booking';
      case 'per_slot':
        return 'Per slot';
      default:
        return 'Per attendee';
    }
  }

  protected chargeTypeFieldLabel(): string {
    return this.context === 'asset' ? 'Charge Basis' : 'Charge Type';
  }

  protected roundingLabel(rounding: AppTypes.PricingRoundingMode): string {
    switch (rounding) {
      case 'whole':
        return 'Whole number';
      case 'half':
        return '0.50 steps';
      default:
        return 'No rounding';
    }
  }

  protected taxModeLabel(mode: AppTypes.PricingTaxMode): string {
    return mode === 'included' ? 'Included' : 'Excluded';
  }

  protected operatorLabel(operator: AppTypes.PricingDemandOperator): string {
    return operator === 'lte' ? '<=' : '>=';
  }

  protected ruleScopeLabel(scope: AppTypes.PricingRuleScope): string {
    return scope === 'selected_slots' ? 'Selected slots' : 'All slots';
  }

  protected timeTriggerLabel(trigger: AppTypes.PricingTimeRuleTrigger): string {
    switch (trigger) {
      case 'hours_before_start':
        return 'Before event start by hours';
      case 'specific_date':
        return 'During date range';
      default:
        return 'Before event start by days';
    }
  }

  protected currencySymbol(currency: string): string {
    switch (`${currency ?? ''}`.trim().toUpperCase()) {
      case 'EUR':
        return 'EUR';
      case 'GBP':
        return 'GBP';
      case 'CZK':
        return 'CZK';
      default:
        return '$';
    }
  }

  protected showDemandSection(): boolean {
    return this.workingPricing.mode === 'demand-based' || this.workingPricing.mode === 'hybrid';
  }

  protected showTimeSection(): boolean {
    return this.workingPricing.mode === 'time-based' || this.workingPricing.mode === 'hybrid';
  }

  protected showSlotSection(): boolean {
    return this.resolvedAllowSlotFeatures;
  }

  protected isDynamicMode(): boolean {
    return this.workingPricing.mode !== 'fixed';
  }

  protected isPricingEnabled(): boolean {
    return this.workingPricing.enabled === true;
  }

  protected usesSummaryPopup(): boolean {
    return this.resolvedPresentation === 'popup-summary';
  }

  protected openWizard(): void {
    if (this.readOnly || !this.usesSummaryPopup()) {
      return;
    }
    this.wizardOpen = true;
  }

  protected closeWizard(): void {
    this.wizardOpen = false;
    this.closeRuleScopePicker();
  }

  protected togglePricingEnabled(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.enabled = !this.workingPricing.enabled;
    if (!this.workingPricing.enabled) {
      this.closeWizard();
    }
    this.emitPricing();
  }

  protected onStringFieldChange(): void {
    this.emitPricing();
  }

  protected onBasePriceChange(value: number | string): void {
    this.workingPricing.basePrice = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onNullableMoneyFieldChange(field: 'minPrice' | 'maxPrice', value: number | string): void {
    this.workingPricing[field] = this.parseMoney(value);
    this.normalizePriceBounds();
    this.emitPricing();
  }

  protected onAudienceMoneyFieldChange(field: 'memberPrice' | 'vipPrice', value: number | string): void {
    this.workingPricing.audience[field] = this.parseMoney(value);
    this.emitPricing();
  }

  protected onAudienceDiscountChange(value: number | string): void {
    this.workingPricing.audience.inviteOnlyDiscountPercent = this.parsePercent(value);
    this.emitPricing();
  }

  protected toggleDemandRulesEnabled(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.demandRulesEnabled = !this.workingPricing.demandRulesEnabled;
    if (this.workingPricing.demandRulesEnabled && this.workingPricing.demandRules.length === 0) {
      this.workingPricing.demandRules = [this.createDefaultDemandRule()];
    }
    this.emitPricing();
  }

  protected toggleTimeRulesEnabled(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.timeRulesEnabled = !this.workingPricing.timeRulesEnabled;
    if (this.workingPricing.timeRulesEnabled && this.workingPricing.timeRules.length === 0) {
      this.workingPricing.timeRules = [this.createDefaultTimeRule()];
    }
    this.emitPricing();
  }

  protected toggleAudienceEnabled(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.audience.enabled = !this.workingPricing.audience.enabled;
    this.emitPricing();
  }

  protected addDemandRule(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.demandRules = [
      ...this.workingPricing.demandRules,
      this.createDefaultDemandRule()
    ];
    this.workingPricing.demandRulesEnabled = true;
    this.emitPricing();
  }

  protected removeDemandRule(index: number): void {
    if (this.readOnly || index < 0 || index >= this.workingPricing.demandRules.length) {
      return;
    }
    this.workingPricing.demandRules = this.workingPricing.demandRules.filter((_, itemIndex) => itemIndex !== index);
    this.emitPricing();
  }

  protected addTimeRule(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.timeRules = [
      ...this.workingPricing.timeRules,
      this.createDefaultTimeRule()
    ];
    this.workingPricing.timeRulesEnabled = true;
    this.emitPricing();
  }

  protected removeTimeRule(index: number): void {
    if (this.readOnly || index < 0 || index >= this.workingPricing.timeRules.length) {
      return;
    }
    this.workingPricing.timeRules = this.workingPricing.timeRules.filter((_, itemIndex) => itemIndex !== index);
    this.emitPricing();
  }

  protected addPromoCode(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.audience.promoCodes = [
      ...this.workingPricing.audience.promoCodes,
      {
        id: this.nextId('promo'),
        code: '',
        action: {
          kind: 'decrease_percent',
          value: 10
        }
      }
    ];
    this.workingPricing.audience.enabled = true;
    this.emitPricing();
  }

  protected removePromoCode(index: number): void {
    if (this.readOnly || index < 0 || index >= this.workingPricing.audience.promoCodes.length) {
      return;
    }
    this.workingPricing.audience.promoCodes = this.workingPricing.audience.promoCodes.filter((_, itemIndex) => itemIndex !== index);
    this.emitPricing();
  }

  protected onDemandRuleThresholdChange(rule: AppTypes.PricingDemandRule, value: number | string): void {
    rule.capacityFilledPercent = this.parsePercent(value) ?? rule.capacityFilledPercent;
    this.emitPricing();
  }

  protected onDemandRuleActionValueChange(rule: AppTypes.PricingDemandRule, value: number | string): void {
    rule.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onDemandRuleScopeChange(rule: AppTypes.PricingDemandRule, scope: AppTypes.PricingRuleScope): void {
    rule.appliesTo = scope;
    if (scope === 'all_slots') {
      rule.slotIds = [];
    }
    this.emitPricing();
  }

  protected onDemandRuleSlotIdsChange(rule: AppTypes.PricingDemandRule, value: string[] | null | undefined): void {
    rule.slotIds = Array.isArray(value) ? value.map(item => `${item}`.trim()).filter(item => item.length > 0) : [];
    this.emitPricing();
  }

  protected onTimeRuleOffsetChange(rule: AppTypes.PricingTimeRule, value: number | string): void {
    rule.offsetValue = this.parseInteger(value);
    this.emitPricing();
  }

  protected timeRuleRangeStartDate(rule: AppTypes.PricingTimeRule): Date | null {
    return this.isoDateToDate(rule.specificDateStart);
  }

  protected timeRuleRangeEndDate(rule: AppTypes.PricingTimeRule): Date | null {
    return this.isoDateToDate(rule.specificDateEnd);
  }

  protected onTimeRuleRangeStartChange(rule: AppTypes.PricingTimeRule, value: Date | null): void {
    const normalized = this.dateToIsoDate(value);
    rule.specificDateStart = normalized;
    if (!normalized) {
      rule.specificDateEnd = null;
      this.emitPricing();
      return;
    }
    if (!rule.specificDateEnd || rule.specificDateEnd < normalized) {
      rule.specificDateEnd = normalized;
    }
    this.emitPricing();
  }

  protected onTimeRuleRangeEndChange(rule: AppTypes.PricingTimeRule, value: Date | null): void {
    const normalized = this.dateToIsoDate(value);
    rule.specificDateEnd = normalized;
    if (!normalized) {
      rule.specificDateStart = null;
      this.emitPricing();
      return;
    }
    if (!rule.specificDateStart || rule.specificDateStart > normalized) {
      rule.specificDateStart = normalized;
    }
    this.emitPricing();
  }

  protected onTimeRuleActionValueChange(rule: AppTypes.PricingTimeRule, value: number | string): void {
    rule.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onTimeRuleScopeChange(rule: AppTypes.PricingTimeRule, scope: AppTypes.PricingRuleScope): void {
    rule.appliesTo = scope;
    if (scope === 'all_slots') {
      rule.slotIds = [];
    }
    this.emitPricing();
  }

  protected onTimeRuleSlotIdsChange(rule: AppTypes.PricingTimeRule, value: string[] | null | undefined): void {
    rule.slotIds = Array.isArray(value) ? value.map(item => `${item}`.trim()).filter(item => item.length > 0) : [];
    this.emitPricing();
  }

  protected onPromoCodeTextChange(code: AppTypes.PricingPromoCode, value: string | null | undefined): void {
    code.code = `${value ?? ''}`.trim().toUpperCase();
    this.emitPricing();
  }

  protected onPromoCodeActionValueChange(code: AppTypes.PricingPromoCode, value: number | string): void {
    code.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onSlotPricingEnabledChange(value: boolean): void {
    this.workingPricing.slotPricingEnabled = value;
    this.emitPricing();
  }

  protected onSlotOverridesChange(overrides: AppTypes.PricingSlotOverride[]): void {
    this.workingPricing.slotOverrides = overrides.map(item => ({ ...item }));
    this.emitPricing();
  }

  protected toggleRuleScopePicker(
    kind: 'demand' | 'time',
    rule: PricingScopedRule,
    event?: Event
  ): void {
    event?.stopPropagation();
    if (this.readOnly) {
      return;
    }
    if (this.isRuleScopePickerOpen(kind, rule)) {
      this.closeRuleScopePicker();
      return;
    }
    this.ruleScopePickerState = {
      kind,
      ruleId: rule.id,
      appliesTo: rule.appliesTo,
      slotIds: [...(rule.slotIds ?? [])]
    };
  }

  protected isRuleScopePickerOpen(kind: 'demand' | 'time', rule: PricingScopedRule): boolean {
    return this.ruleScopePickerState?.kind === kind && this.ruleScopePickerState.ruleId === rule.id;
  }

  protected ruleScopeButtonLabel(rule: PricingScopedRule): string {
    if (rule.appliesTo !== 'selected_slots') {
      return 'All slots';
    }
    if ((rule.slotIds?.length ?? 0) === 0) {
      return 'Specific slots';
    }
    if (rule.slotIds.length === 1) {
      return this.slotLabelById(rule.slotIds[0]) || 'Specific slots';
    }
    return `${rule.slotIds.length} slots selected`;
  }

  protected currentRuleScopeDraftMode(): AppTypes.PricingRuleScope {
    return this.ruleScopePickerState?.appliesTo ?? 'all_slots';
  }

  protected currentRuleScopeDraftSlotIds(): string[] {
    return [...(this.ruleScopePickerState?.slotIds ?? [])];
  }

  protected selectRuleScopeDraftMode(scope: AppTypes.PricingRuleScope, event?: Event): void {
    event?.stopPropagation();
    if (!this.ruleScopePickerState) {
      return;
    }
    this.ruleScopePickerState = {
      ...this.ruleScopePickerState,
      appliesTo: scope,
      slotIds: scope === 'all_slots'
        ? []
        : (this.ruleScopePickerState.slotIds.length > 0 ? [...this.ruleScopePickerState.slotIds] : this.defaultDraftSlotIds())
    };
  }

  protected toggleRuleScopeDraftSlot(slotId: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.ruleScopePickerState || this.ruleScopePickerState.appliesTo !== 'selected_slots') {
      return;
    }
    const normalizedSlotId = `${slotId}`.trim();
    if (!normalizedSlotId) {
      return;
    }
    const slotIds = new Set(this.ruleScopePickerState.slotIds);
    if (slotIds.has(normalizedSlotId)) {
      slotIds.delete(normalizedSlotId);
    } else {
      slotIds.add(normalizedSlotId);
    }
    this.ruleScopePickerState = {
      ...this.ruleScopePickerState,
      slotIds: [...slotIds]
    };
  }

  protected isRuleScopeDraftSlotSelected(slotId: string): boolean {
    return this.ruleScopePickerState?.slotIds.includes(`${slotId}`.trim()) ?? false;
  }

  protected canApplyRuleScopeDraft(): boolean {
    if (!this.ruleScopePickerState) {
      return false;
    }
    return this.ruleScopePickerState.appliesTo === 'all_slots' || this.ruleScopePickerState.slotIds.length > 0;
  }

  protected applyRuleScopeDraft(rule: PricingScopedRule, event?: Event): void {
    event?.stopPropagation();
    if (!this.ruleScopePickerState || !this.canApplyRuleScopeDraft()) {
      return;
    }
    rule.appliesTo = this.ruleScopePickerState.appliesTo;
    rule.slotIds = rule.appliesTo === 'selected_slots'
      ? [...this.ruleScopePickerState.slotIds]
      : [];
    this.closeRuleScopePicker();
    this.emitPricing();
  }

  protected slotScopeWindowLabel(slot: AppTypes.PricingSlotReference): string {
    const start = this.formatSlotTime(slot.startAt);
    const end = this.formatSlotTime(slot.endAt);
    if (!start && !end) {
      return 'Time follows this slot.';
    }
    if (!start) {
      return `Ends ${end}`;
    }
    if (!end) {
      return `Starts ${start}`;
    }
    return `${start} - ${end}`;
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.closeRuleScopePicker();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.ruleScopePickerState && !this.wizardOpen) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.ruleScopePickerState) {
      this.closeRuleScopePicker();
      return;
    }
    if (this.wizardOpen) {
      this.closeWizard();
    }
  }

  protected calculatePreviewState(): PricingPreviewState {
    const normalized = this.normalizePricingWithCapabilities(this.workingPricing);
    const activeSlotOverride = normalized.slotPricingEnabled
      ? normalized.slotOverrides.find(item => item.price !== null) ?? null
      : null;
    const previewSlotId = activeSlotOverride?.slotId ?? null;
    let runningPrice = activeSlotOverride?.price ?? normalized.basePrice;
    const basePrice = runningPrice;
    const demandNotes: string[] = [];
    const timeNotes: string[] = [];

    if (this.showDemandSection() && normalized.demandRulesEnabled) {
      for (const rule of normalized.demandRules) {
        if (!this.matchesDemandRule(rule, 50, previewSlotId)) {
          continue;
        }
        const nextPrice = this.applyRuleAction(runningPrice, rule.action);
        demandNotes.push(this.describeDemandRule(rule));
        runningPrice = nextPrice;
      }
    }
    const priceAfterDemand = runningPrice;

    if (this.showTimeSection() && normalized.timeRulesEnabled) {
      for (const rule of normalized.timeRules) {
        if (!this.matchesTimeRule(rule, 72, previewSlotId)) {
          continue;
        }
        const nextPrice = this.applyRuleAction(runningPrice, rule.action);
        timeNotes.push(this.describeTimeRule(rule));
        runningPrice = nextPrice;
      }
    }

    const clamped = this.clampPrice(runningPrice);
    const finalPrice = this.applyRounding(clamped);
    return {
      basePrice,
      slotOverridePrice: activeSlotOverride?.price ?? null,
      demandDelta: priceAfterDemand - basePrice,
      timeDelta: clamped - priceAfterDemand,
      finalPrice,
      demandNotes,
      timeNotes
    };
  }

  protected previewExplanationLines(): string[] {
    const preview = this.calculatePreviewState();
    return [
      ...(preview.slotOverridePrice !== null ? [`A slot override is active, so this preview starts from ${this.formatMoney(preview.slotOverridePrice)} instead of the global base price.`] : []),
      ...preview.demandNotes,
      ...preview.timeNotes
    ];
  }

  protected previewFallbackLines(): string[] {
    const lines: string[] = [];
    if (this.workingPricing.basePrice <= 0) {
      lines.push('The base price is still set to $0, so the current preview is showing a free entry.');
    } else {
      lines.push(`The preview is currently showing the base price of ${this.formatMoney(this.workingPricing.basePrice)}.`);
    }

    if (!this.isDynamicMode()) {
      lines.push('Pricing Mode is set to Fixed, so demand and time rules are not changing the amount yet.');
    } else {
      if (this.showDemandSection() && !this.workingPricing.demandRulesEnabled) {
        lines.push('Demand rules are available in this mode, but they are currently turned off.');
      }
      if (this.showTimeSection() && !this.workingPricing.timeRulesEnabled) {
        lines.push('Time rules are available in this mode, but they are currently turned off.');
      }
    }

    if (this.resolvedAllowSlotFeatures) {
      if (this.slotCatalog.length === 0) {
        lines.push('Slot-specific pricing is unavailable until the event has at least one slot in the Slots section.');
      } else if (!this.workingPricing.slotPricingEnabled || this.workingPricing.slotOverrides.length === 0) {
        lines.push('Slot overrides are off, so every slot is still using the same main event price.');
      }
    }

    if (this.resolvedShowAudienceSection && !this.workingPricing.audience.enabled) {
      lines.push('Audience pricing is off, so members, VIP guests, and promo codes are not changing the public price.');
    }

    return lines;
  }

  protected trackByRule(index: number, rule: { id: string }): string {
    return rule.id || `rule-${index}`;
  }

  private syncWorkingPricing(): void {
    this.workingPricing = this.normalizePricingWithCapabilities(this.pricing);
    this.currentPreview = this.calculatePreviewState();
  }

  protected emitPricing(): void {
    this.normalizePriceBounds();
    this.workingPricing = this.normalizePricingWithCapabilities(this.workingPricing);
    this.currentPreview = this.calculatePreviewState();
    this.pricingChange.emit(PricingBuilder.clonePricingConfig(this.workingPricing));
  }

  private syncResolvedCapabilities(): void {
    this.resolvedAllowSlotFeatures = this.allowSlotFeatures ?? this.context === 'event';
    this.resolvedShowAudienceSection = this.showAudienceSection ?? this.context === 'event';
    this.resolvedShowPreview = this.showPreview ?? true;
    this.resolvedPresentation = this.presentation ?? 'inline';
    this.resolvedChargeTypeOptions = this.resolveChargeTypeOptions();
    if (!this.usesSummaryPopup()) {
      this.wizardOpen = false;
    }
  }

  private resolveChargeTypeOptions(): readonly AppTypes.PricingChargeType[] {
    const base: AppTypes.PricingChargeType[] = this.context === 'asset'
      ? ['per_booking', 'per_attendee']
      : ['per_attendee', 'per_booking'];
    if (this.resolvedAllowSlotFeatures) {
      base.push('per_slot');
    }
    return base;
  }

  private normalizePricingWithCapabilities(
    value: AppTypes.PricingConfig | null | undefined
  ): AppTypes.PricingConfig {
    return PricingBuilder.normalizePricingConfig(value, {
      context: this.context,
      slotCatalog: this.resolvedAllowSlotFeatures ? this.slotCatalog : [],
      allowSlotFeatures: this.resolvedAllowSlotFeatures,
      allowedChargeTypes: this.resolvedChargeTypeOptions,
      preserveEmptyPromoCodes: true
    });
  }

  private normalizePriceBounds(): void {
    if (this.workingPricing.minPrice !== null && this.workingPricing.minPrice < 0) {
      this.workingPricing.minPrice = 0;
    }
    if (this.workingPricing.maxPrice !== null && this.workingPricing.maxPrice < 0) {
      this.workingPricing.maxPrice = 0;
    }
    if (
      this.workingPricing.minPrice !== null
      && this.workingPricing.maxPrice !== null
      && this.workingPricing.maxPrice < this.workingPricing.minPrice
    ) {
      this.workingPricing.maxPrice = this.workingPricing.minPrice;
    }
  }

  private createDefaultDemandRule(): AppTypes.PricingDemandRule {
    return {
      id: this.nextId('demand-rule'),
      operator: 'gte',
      capacityFilledPercent: 50,
      action: {
        kind: 'increase_percent',
        value: 10
      },
      appliesTo: 'all_slots',
      slotIds: []
    };
  }

  private createDefaultTimeRule(): AppTypes.PricingTimeRule {
    return {
      id: this.nextId('time-rule'),
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
    };
  }

  private nextId(prefix: string): string {
    this.idSequence += 1;
    return `${prefix}-${Date.now()}-${this.idSequence}`;
  }

  private closeRuleScopePicker(): void {
    this.ruleScopePickerState = null;
  }

  private defaultDraftSlotIds(): string[] {
    const firstSlotId = `${this.slotCatalog[0]?.id ?? ''}`.trim();
    return firstSlotId ? [firstSlotId] : [];
  }

  private slotLabelById(slotId: string | null | undefined): string {
    const normalizedSlotId = `${slotId ?? ''}`.trim();
    if (!normalizedSlotId) {
      return '';
    }
    return this.slotCatalog.find(slot => slot.id === normalizedSlotId)?.label ?? '';
  }

  private formatSlotTime(value: string | null | undefined): string {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return '';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private parseMoney(value: number | string): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.round(parsed * 100) / 100);
  }

  private parsePercent(value: number | string): number | null {
    const parsed = this.parseMoney(value);
    if (parsed === null) {
      return null;
    }
    return Math.max(0, Math.min(100, parsed));
  }

  private parseInteger(value: number | string): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private matchesDemandRule(
    rule: AppTypes.PricingDemandRule,
    capacityFilledPercent: number,
    activeSlotId: string | null
  ): boolean {
    if (rule.appliesTo === 'selected_slots') {
      if (!activeSlotId || !rule.slotIds.includes(activeSlotId)) {
        return false;
      }
    }
    if (rule.operator === 'lte') {
      return capacityFilledPercent <= rule.capacityFilledPercent;
    }
    return capacityFilledPercent >= rule.capacityFilledPercent;
  }

  private matchesTimeRule(
    rule: AppTypes.PricingTimeRule,
    hoursUntilStart: number,
    activeSlotId: string | null
  ): boolean {
    if (rule.appliesTo === 'selected_slots') {
      if (!activeSlotId || !rule.slotIds.includes(activeSlotId)) {
        return false;
      }
    }
    if (rule.trigger === 'specific_date') {
      const start = `${rule.specificDateStart ?? ''}`.trim();
      const end = `${rule.specificDateEnd ?? ''}`.trim();
      if (!start || !end) {
        return false;
      }
      const today = new Date();
      const normalizedToday = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;
      return normalizedToday >= start && normalizedToday <= end;
    }
    const offset = Math.max(0, Math.trunc(Number(rule.offsetValue) || 0));
    if (rule.trigger === 'hours_before_start') {
      return hoursUntilStart <= offset;
    }
    return hoursUntilStart <= (offset * 24);
  }

  private applyRuleAction(price: number, action: AppTypes.PricingAction): number {
    const value = Math.max(0, Number(action.value) || 0);
    switch (action.kind) {
      case 'decrease_percent':
        return Math.max(0, price - ((price * value) / 100));
      case 'set_exact_price':
        return value;
      default:
        return price + ((price * value) / 100);
    }
  }

  private clampPrice(price: number): number {
    const min = this.workingPricing.minPrice;
    const max = this.workingPricing.maxPrice;
    let nextPrice = price;
    if (min !== null) {
      nextPrice = Math.max(min, nextPrice);
    }
    if (max !== null) {
      nextPrice = Math.min(max, nextPrice);
    }
    return Math.max(0, nextPrice);
  }

  private applyRounding(price: number): number {
    switch (this.workingPricing.rounding) {
      case 'whole':
        return Math.round(price);
      case 'half':
        return Math.round(price * 2) / 2;
      default:
        return Math.round(price * 100) / 100;
    }
  }

  private describeDemandRule(rule: AppTypes.PricingDemandRule): string {
    return `Demand rule active: when capacity filled is ${rule.operator === 'lte' ? '<=' : '>='} ${rule.capacityFilledPercent}%, ${this.describeAction(rule.action)}${this.describeRuleScope(rule)}.`;
  }

  private describeTimeRule(rule: AppTypes.PricingTimeRule): string {
    if (rule.trigger === 'specific_date') {
      const start = `${rule.specificDateStart ?? ''}`.trim();
      const end = `${rule.specificDateEnd ?? ''}`.trim();
      const rangeLabel = start && end
        ? start === end ? start : `${start} - ${end}`
        : 'the selected range';
      return `Time rule active: during ${rangeLabel}, ${this.describeAction(rule.action)}${this.describeRuleScope(rule)}.`;
    }
    const offset = Math.max(0, Math.trunc(Number(rule.offsetValue) || 0));
    const triggerText = rule.trigger === 'hours_before_start'
      ? `${offset} hours before the event starts`
      : `${offset} days before the event starts`;
    return `Time rule active: ${triggerText}, ${this.describeAction(rule.action)}${this.describeRuleScope(rule)}.`;
  }

  private formatMoney(value: number | null | undefined): string {
    const amount = Math.max(0, Number(value) || 0);
    const currency = this.workingPricing.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'CZK' ? 0 : 2
      }).format(amount);
    } catch {
      return `${this.currencySymbol(currency)}${amount.toFixed(2)}`;
    }
  }

  private describeAction(action: AppTypes.PricingAction): string {
    const value = Math.max(0, Number(action.value) || 0);
    switch (action.kind) {
      case 'decrease_percent':
        return `the price decreases by ${value}%`;
      case 'set_exact_price':
        return `the price is set to ${this.formatMoney(value)}`;
      default:
        return `the price increases by ${value}%`;
    }
  }

  private describeRuleScope(rule: PricingScopedRule): string {
    if (rule.appliesTo !== 'selected_slots') {
      return ' for all slots';
    }
    if ((rule.slotIds?.length ?? 0) === 0) {
      return ' for the selected slots';
    }
    if (rule.slotIds.length === 1) {
      return ` for ${this.slotLabelById(rule.slotIds[0]) || 'the selected slot'}`;
    }
    return ` for ${rule.slotIds.length} selected slots`;
  }

  private isoDateToDate(value: string | null | undefined): Date | null {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    const parsed = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private dateToIsoDate(value: Date | null | undefined): string | null {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return null;
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
