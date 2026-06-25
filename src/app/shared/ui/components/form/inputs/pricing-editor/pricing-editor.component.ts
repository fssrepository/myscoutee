import { CommonModule } from '@angular/common';
import { Component, DoCheck, forwardRef, HostListener, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { PricingBuilder } from '../../../../../core/base/builders';
import type * as AppTypes from '../../../../../core/base/models';
import type * as ContractTypes from '../../../../../core/contracts';
import { PricingSlotPanelComponent } from '../../popups/pricing-slot-panel';

import type * as AppConstants from '../../../../../core/common/constants';
interface PricingPreviewState {
  basePrice: number;
  slotOverridePrice: number | null;
  demandDelta: number;
  timeDelta: number;
  finalPrice: number;
  demandNotes: string[];
  timeNotes: string[];
}

type PricingScopedRule = ContractTypes.PricingDemandRule | ContractTypes.PricingTimeRule;

interface RuleScopePickerState {
  kind: 'demand' | 'time';
  ruleId: string;
  appliesTo: AppConstants.PricingRuleScope;
  slotIds: string[];
}

export type PricingEditorContext = 'event' | 'asset' | 'subevent';
export type PricingEditorPresentation = 'inline' | 'popup-summary';
export type PricingEditorSubtitleKey = 'none' | 'event-enabled' | 'event-disabled' | 'asset' | 'subevent';
export type PricingEditorConfigValue<TValue> = TValue | (() => TValue);

export interface PricingEditorConfig {
  context?: PricingEditorConfigValue<PricingEditorContext>;
  presentation?: PricingEditorConfigValue<PricingEditorPresentation>;
  slotCatalog?: PricingEditorConfigValue<readonly ContractTypes.PricingSlotReference[]>;
  showAudienceSection?: PricingEditorConfigValue<boolean | null>;
  showPreview?: PricingEditorConfigValue<boolean | null>;
  allowSlotFeatures?: PricingEditorConfigValue<boolean | null>;
}

interface ResolvedPricingEditorConfig {
  context: PricingEditorContext;
  presentation: PricingEditorPresentation;
  slotCatalog: readonly ContractTypes.PricingSlotReference[];
  showAudienceSection: boolean;
  showPreview: boolean;
  allowSlotFeatures: boolean;
  chargeTypeOptions: readonly AppConstants.PricingChargeType[];
}

@Component({
  selector: 'app-pricing-editor-input',
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
  styleUrl: './pricing-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PricingEditorInputComponent),
      multi: true
    }
  ]
})
export class PricingEditorInputComponent implements OnChanges, DoCheck, ControlValueAccessor {
  private static readonly MOBILE_SCOPE_SHEET_BREAKPOINT_PX = 760;

  @Input() config: PricingEditorConfig = {};
  @Input() readOnly = false;

  protected workingPricing: ContractTypes.PricingConfig = PricingBuilder.createDefaultPricingConfig('event');

  protected readonly currencyOptions = ['USD', 'EUR', 'GBP', 'CZK'];
  protected readonly taxModeOptions: readonly AppConstants.PricingTaxMode[] = ['excluded', 'included'];
  protected readonly roundingOptions: readonly AppConstants.PricingRoundingMode[] = ['none', 'whole', 'half'];
  protected readonly demandOperatorOptions: readonly AppConstants.PricingDemandOperator[] = ['gte', 'lte'];
  protected readonly actionKindOptions: readonly AppConstants.PricingRuleActionKind[] = ['increase_percent', 'decrease_percent', 'set_exact_price'];
  protected readonly ruleScopeOptions: readonly AppConstants.PricingRuleScope[] = ['all_slots', 'selected_slots'];
  protected readonly timeTriggerOptions: readonly AppConstants.PricingTimeRuleTrigger[] = ['days_before_start', 'hours_before_start', 'specific_date'];
  protected readonly cancellationUnitOptions: readonly AppConstants.PricingCancellationUnit[] = ['hours', 'days', 'weeks', 'months'];
  protected readonly cancellationRefundKindOptions: readonly AppConstants.PricingCancellationRefundKind[] = ['percent', 'fixed_amount', 'full', 'none'];
  protected readonly soldOutLabelOptions = ['Show "Sold Out"', 'Hide from list', 'Show "Waitlist"'];
  protected resolvedConfig: ResolvedPricingEditorConfig = this.resolveConfig();
  protected wizardOpen = false;

  private resolvedConfigSignature = this.buildResolvedConfigSignature(this.resolvedConfig);
  private idSequence = 0;
  private ruleScopePickerState: RuleScopePickerState | null = null;
  private mobileScopeSheetViewport = this.resolveMobileScopeSheetViewport();
  private pricingValue: ContractTypes.PricingConfig | null | undefined = null;
  private onModelChange: (value: ContractTypes.PricingConfig) => void = () => {};
  private onModelTouched: () => void = () => {};

  protected currentPreview!: PricingPreviewState;
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  protected currentExplanationLines: string[] = [];
  protected currentFallbackLines: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.syncResolvedConfig();
      this.cdr.markForCheck();
    }
  }

  ngDoCheck(): void {
    this.syncResolvedConfig();
  }

  writeValue(value: ContractTypes.PricingConfig | null | undefined): void {
    this.pricingValue = value;
    this.syncWorkingPricing();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: ContractTypes.PricingConfig) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readOnly = isDisabled;
    this.cdr.markForCheck();
  }



  protected actionLabel(action: AppConstants.PricingRuleActionKind): string {
    switch (action) {
      case 'decrease_percent':
        return 'Decrease by %';
      case 'set_exact_price':
        return 'Set exact price';
      default:
        return 'Increase by %';
    }
  }

  protected chargeTypeLabel(chargeType: AppConstants.PricingChargeType): string {
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
    return this.resolvedConfig.context === 'asset' ? 'Charge Basis' : 'Charge Type';
  }

  protected roundingLabel(rounding: AppConstants.PricingRoundingMode): string {
    switch (rounding) {
      case 'whole':
        return 'Whole number';
      case 'half':
        return '0.50 steps';
      default:
        return 'No rounding';
    }
  }

  protected taxModeLabel(mode: AppConstants.PricingTaxMode): string {
    return mode === 'included' ? 'Included' : 'Excluded';
  }

  protected operatorLabel(operator: AppConstants.PricingDemandOperator): string {
    return operator === 'lte' ? '<=' : '>=';
  }

  protected ruleScopeLabel(scope: AppConstants.PricingRuleScope): string {
    return scope === 'selected_slots' ? 'Selected slots' : 'All slots';
  }

  protected timeTriggerLabel(trigger: AppConstants.PricingTimeRuleTrigger): string {
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
    return true;
  }

  protected showTimeSection(): boolean {
    return true;
  }

  protected showSlotSection(): boolean {
    return this.resolvedConfig.allowSlotFeatures;
  }

  protected showCancellationSection(): boolean {
    return this.resolvedConfig.context === 'event' || this.resolvedConfig.context === 'asset';
  }

  protected isDynamicMode(): boolean {
    return this.workingPricing.mode !== 'fixed';
  }

  protected isPricingEnabled(): boolean {
    return this.workingPricing.enabled === true;
  }

  protected usesSummaryPopup(): boolean {
    return this.resolvedConfig.presentation === 'popup-summary';
  }

  protected subtitleKey(): PricingEditorSubtitleKey {
    if (this.readOnly) {
      return 'none';
    }
    switch (this.resolvedConfig.context) {
      case 'asset':
        return 'asset';
      case 'subevent':
        return 'subevent';
      default:
        return this.isPricingEnabled() ? 'event-enabled' : 'event-disabled';
    }
  }

  protected openWizard(): void {
    if (this.readOnly || !this.usesSummaryPopup()) {
      return;
    }
    this.wizardOpen = true;
    this.cdr.markForCheck();
  }

  protected closeWizard(): void {
    this.wizardOpen = false;
    this.closeRuleScopePicker();
    this.cdr.markForCheck();
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

  protected toggleCancellationPolicyEnabled(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.cancellationPolicy.enabled = !this.workingPricing.cancellationPolicy.enabled;
    if (this.workingPricing.cancellationPolicy.enabled && this.workingPricing.cancellationPolicy.rules.length === 0) {
      this.workingPricing.cancellationPolicy.rules = [this.createDefaultCancellationRule()];
    }
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

  protected addCancellationRule(): void {
    if (this.readOnly) {
      return;
    }
    this.workingPricing.cancellationPolicy.rules = [
      ...this.workingPricing.cancellationPolicy.rules,
      this.createDefaultCancellationRule()
    ];
    this.workingPricing.cancellationPolicy.enabled = true;
    this.emitPricing();
  }

  protected removeCancellationRule(index: number): void {
    if (this.readOnly || index < 0 || index >= this.workingPricing.cancellationPolicy.rules.length) {
      return;
    }
    this.workingPricing.cancellationPolicy.rules = this.workingPricing.cancellationPolicy.rules
      .filter((_, itemIndex) => itemIndex !== index);
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

  protected onDemandRuleThresholdChange(rule: ContractTypes.PricingDemandRule, value: number | string): void {
    rule.capacityFilledPercent = this.parsePercent(value) ?? rule.capacityFilledPercent;
    this.emitPricing();
  }

  protected onDemandRuleActionValueChange(rule: ContractTypes.PricingDemandRule, value: number | string): void {
    rule.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onDemandRuleScopeChange(rule: ContractTypes.PricingDemandRule, scope: AppConstants.PricingRuleScope): void {
    rule.appliesTo = scope;
    if (scope === 'all_slots') {
      rule.slotIds = [];
    }
    this.emitPricing();
  }

  protected onDemandRuleSlotIdsChange(rule: ContractTypes.PricingDemandRule, value: string[] | null | undefined): void {
    rule.slotIds = Array.isArray(value) ? value.map(item => `${item}`.trim()).filter(item => item.length > 0) : [];
    this.emitPricing();
  }

  protected onTimeRuleOffsetChange(rule: ContractTypes.PricingTimeRule, value: number | string): void {
    rule.offsetValue = this.parseInteger(value);
    this.emitPricing();
  }

  protected timeRuleRangeStartDate(rule: ContractTypes.PricingTimeRule): Date | null {
    return this.isoDateToDate(rule.specificDateStart);
  }

  protected timeRuleRangeEndDate(rule: ContractTypes.PricingTimeRule): Date | null {
    return this.isoDateToDate(rule.specificDateEnd);
  }

  protected onTimeRuleRangeStartChange(rule: ContractTypes.PricingTimeRule, value: Date | null): void {
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

  protected onTimeRuleRangeEndChange(rule: ContractTypes.PricingTimeRule, value: Date | null): void {
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

  protected onTimeRuleActionValueChange(rule: ContractTypes.PricingTimeRule, value: number | string): void {
    rule.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected cancellationUnitLabel(unit: AppConstants.PricingCancellationUnit): string {
    switch (unit) {
      case 'hours':
        return 'Hours before start';
      case 'weeks':
        return 'Weeks before start';
      case 'months':
        return 'Months before start';
      default:
        return 'Days before start';
    }
  }

  protected cancellationRefundKindLabel(kind: AppConstants.PricingCancellationRefundKind): string {
    switch (kind) {
      case 'fixed_amount':
        return 'Fixed refund';
      case 'full':
        return 'Full refund';
      case 'none':
        return 'No refund';
      default:
        return 'Refund %';
    }
  }

  protected cancellationRuleNeedsValue(rule: ContractTypes.PricingCancellationRule): boolean {
    return rule.refundKind === 'percent' || rule.refundKind === 'fixed_amount';
  }

  protected cancellationRuleValueSuffix(rule: ContractTypes.PricingCancellationRule): string {
    if (rule.refundKind === 'percent') {
      return '%';
    }
    if (rule.refundKind === 'fixed_amount') {
      return this.workingPricing.currency;
    }
    return 'Auto';
  }

  protected onCancellationRuleOffsetChange(rule: ContractTypes.PricingCancellationRule, value: number | string): void {
    rule.offsetValue = this.parseInteger(value);
    this.emitPricing();
  }

  protected onCancellationRuleRefundKindChange(
    rule: ContractTypes.PricingCancellationRule,
    value: AppConstants.PricingCancellationRefundKind
  ): void {
    rule.refundKind = value;
    if (value === 'percent') {
      rule.refundValue = rule.refundValue ?? 100;
    } else if (value === 'fixed_amount') {
      rule.refundValue = rule.refundValue ?? this.workingPricing.basePrice;
    } else {
      rule.refundValue = null;
    }
    this.emitPricing();
  }

  protected onCancellationRuleRefundValueChange(rule: ContractTypes.PricingCancellationRule, value: number | string): void {
    rule.refundValue = rule.refundKind === 'percent'
      ? this.parsePercent(value)
      : this.parseMoney(value);
    this.emitPricing();
  }

  protected onTimeRuleScopeChange(rule: ContractTypes.PricingTimeRule, scope: AppConstants.PricingRuleScope): void {
    rule.appliesTo = scope;
    if (scope === 'all_slots') {
      rule.slotIds = [];
    }
    this.emitPricing();
  }

  protected onTimeRuleSlotIdsChange(rule: ContractTypes.PricingTimeRule, value: string[] | null | undefined): void {
    rule.slotIds = Array.isArray(value) ? value.map(item => `${item}`.trim()).filter(item => item.length > 0) : [];
    this.emitPricing();
  }

  protected onPromoCodeTextChange(code: ContractTypes.PricingPromoCode, value: string | null | undefined): void {
    code.code = `${value ?? ''}`.trim().toUpperCase();
    this.emitPricing();
  }

  protected onPromoCodeActionValueChange(code: ContractTypes.PricingPromoCode, value: number | string): void {
    code.action.value = this.parseMoney(value) ?? 0;
    this.emitPricing();
  }

  protected onSlotPricingEnabledChange(value: boolean): void {
    this.workingPricing.slotPricingEnabled = value;
    this.emitPricing();
  }

  protected onSlotOverridesChange(overrides: ContractTypes.PricingSlotOverride[]): void {
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
    this.cdr.markForCheck();
  }

  protected shouldUseMobileRuleScopeSheet(): boolean {
    return this.mobileScopeSheetViewport;
  }

  protected showMobileRuleScopeSheet(): boolean {
    return this.mobileScopeSheetViewport && !!this.ruleScopePickerState;
  }

  protected isRuleScopePickerOpen(kind: 'demand' | 'time', rule: PricingScopedRule): boolean {
    return this.ruleScopePickerState?.kind === kind && this.ruleScopePickerState.ruleId === rule.id;
  }

  protected currentRuleScopeSheetTitle(): string {
    return this.ruleScopePickerState?.kind === 'time' ? 'Time Rule Slots' : 'Demand Rule Slots';
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

  protected currentRuleScopeDraftMode(): AppConstants.PricingRuleScope {
    return this.ruleScopePickerState?.appliesTo ?? 'all_slots';
  }

  protected currentRuleScopeDraftSlotIds(): string[] {
    return [...(this.ruleScopePickerState?.slotIds ?? [])];
  }

  protected selectRuleScopeDraftMode(scope: AppConstants.PricingRuleScope, event?: Event): void {
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

  protected applyCurrentRuleScopeDraft(event?: Event): void {
    event?.stopPropagation();
    const rule = this.currentRuleScopeRule();
    if (!rule || !this.ruleScopePickerState || !this.canApplyRuleScopeDraft()) {
      return;
    }
    rule.appliesTo = this.ruleScopePickerState.appliesTo;
    rule.slotIds = rule.appliesTo === 'selected_slots'
      ? [...this.ruleScopePickerState.slotIds]
      : [];
    this.closeRuleScopePicker();
    this.emitPricing();
  }

  protected slotScopeWindowLabel(slot: ContractTypes.PricingSlotReference): string {
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

  @HostListener('window:resize')
  protected onWindowResize(): void {
    const nextViewport = this.resolveMobileScopeSheetViewport();
    if (nextViewport === this.mobileScopeSheetViewport) {
      return;
    }
    this.mobileScopeSheetViewport = nextViewport;
    this.cdr.markForCheck();
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

    if (this.resolvedConfig.allowSlotFeatures) {
      if (this.resolvedConfig.slotCatalog.length === 0) {
        lines.push('Slot-specific pricing is unavailable until the event has at least one slot in the Slots section.');
      } else if (!this.workingPricing.slotPricingEnabled || this.workingPricing.slotOverrides.length === 0) {
        lines.push('Slot overrides are off, so every slot is still using the same main event price.');
      }
    }

    if (this.resolvedConfig.showAudienceSection && !this.workingPricing.audience.enabled) {
      lines.push('Audience pricing is off, so members, VIP guests, and promo codes are not changing the public price.');
    }

    if (this.showCancellationSection()) {
      if (!this.workingPricing.cancellationPolicy.enabled) {
        lines.push('Cancellation reimbursement is off, so leaving after booking will not follow a configured refund schedule yet.');
      } else if (this.workingPricing.cancellationPolicy.rules.length === 0) {
        lines.push('Cancellation reimbursement is on, but add at least one rule so the refund window is explicit.');
      }
    }

    return lines;
  }

  protected trackByRule(index: number, rule: { id: string }): string {
    return rule.id || `rule-${index}`;
  }

  private syncWorkingPricing(): void {
    this.workingPricing = this.normalizePricingWithCapabilities(this.pricingValue);
    this.currentPreview = this.calculatePreviewState();
    // Cache the lines here
    this.currentExplanationLines = this.previewExplanationLines();
    this.currentFallbackLines = this.previewFallbackLines();
  }

  protected emitPricing(): void {
    this.normalizePriceBounds();
    this.syncMode();
    this.workingPricing = this.normalizePricingWithCapabilities(this.workingPricing);
    this.currentPreview = this.calculatePreviewState();
    // Cache the lines here
    this.currentExplanationLines = this.previewExplanationLines();
    this.currentFallbackLines = this.previewFallbackLines();

    const nextPricing = PricingBuilder.clonePricingConfig(this.workingPricing);
    this.pricingValue = nextPricing;
    this.onModelChange(nextPricing);
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  private syncMode(): void {
    const hasDemand = this.workingPricing.demandRulesEnabled;
    const hasTime = this.workingPricing.timeRulesEnabled;
    if (hasDemand && hasTime) {
      this.workingPricing.mode = 'hybrid';
    } else if (hasDemand) {
      this.workingPricing.mode = 'demand-based';
    } else if (hasTime) {
      this.workingPricing.mode = 'time-based';
    } else {
      this.workingPricing.mode = 'fixed';
    }
  }

  private syncResolvedConfig(): void {
    const nextConfig = this.resolveConfig();
    const nextSignature = this.buildResolvedConfigSignature(nextConfig);
    if (nextSignature === this.resolvedConfigSignature) {
      return;
    }
    this.resolvedConfig = nextConfig;
    this.resolvedConfigSignature = nextSignature;
    if (!this.usesSummaryPopup()) {
      this.wizardOpen = false;
    }
    this.syncWorkingPricing();
  }

  private resolveConfig(): ResolvedPricingEditorConfig {
    const context = this.resolveConfigValue(this.config.context, 'event');
    const allowSlotFeatures = this.resolveConfigValue(this.config.allowSlotFeatures, context === 'event') ?? context === 'event';
    return {
      context,
      presentation: this.resolveConfigValue(this.config.presentation, 'inline'),
      slotCatalog: this.resolveConfigValue(this.config.slotCatalog, []),
      showAudienceSection: this.resolveConfigValue(this.config.showAudienceSection, context === 'event') ?? context === 'event',
      showPreview: this.resolveConfigValue(this.config.showPreview, true) ?? true,
      allowSlotFeatures,
      chargeTypeOptions: this.resolveChargeTypeOptions(context, allowSlotFeatures)
    };
  }

  private resolveConfigValue<TValue>(
    value: PricingEditorConfigValue<TValue> | null | undefined,
    fallback: TValue
  ): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)() ?? fallback;
    }
    return value ?? fallback;
  }

  private buildResolvedConfigSignature(config: ResolvedPricingEditorConfig): string {
    return JSON.stringify({
      context: config.context,
      presentation: config.presentation,
      showAudienceSection: config.showAudienceSection,
      showPreview: config.showPreview,
      allowSlotFeatures: config.allowSlotFeatures,
      chargeTypeOptions: config.chargeTypeOptions,
      slotCatalog: config.slotCatalog.map(slot => ({
        id: slot.id,
        label: slot.label,
        startAt: slot.startAt,
        endAt: slot.endAt
      }))
    });
  }

  private resolveChargeTypeOptions(
    context: PricingEditorContext,
    allowSlotFeatures: boolean
  ): readonly AppConstants.PricingChargeType[] {
    const base: AppConstants.PricingChargeType[] = context === 'asset'
      ? ['per_booking', 'per_attendee']
      : ['per_attendee', 'per_booking'];
    if (allowSlotFeatures) {
      base.push('per_slot');
    }
    return base;
  }

  private normalizePricingWithCapabilities(
    value: ContractTypes.PricingConfig | null | undefined
  ): ContractTypes.PricingConfig {
    return PricingBuilder.normalizePricingConfig(value, {
      context: this.resolvedConfig.context,
      slotCatalog: this.resolvedConfig.allowSlotFeatures ? this.resolvedConfig.slotCatalog : [],
      allowSlotFeatures: this.resolvedConfig.allowSlotFeatures,
      allowedChargeTypes: this.resolvedConfig.chargeTypeOptions,
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

  private createDefaultDemandRule(): ContractTypes.PricingDemandRule {
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

  private createDefaultTimeRule(): ContractTypes.PricingTimeRule {
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

  private createDefaultCancellationRule(): ContractTypes.PricingCancellationRule {
    return {
      id: this.nextId('cancellation-rule'),
      offsetUnit: 'days',
      offsetValue: 7,
      refundKind: 'percent',
      refundValue: 50
    };
  }

  private nextId(prefix: string): string {
    this.idSequence += 1;
    return `${prefix}-${Date.now()}-${this.idSequence}`;
  }

  protected closeRuleScopePicker(event?: Event): void {
    event?.stopPropagation();
    this.ruleScopePickerState = null;
    this.cdr.markForCheck();
  }

  private currentRuleScopeRule(): PricingScopedRule | null {
    const state = this.ruleScopePickerState;
    if (!state) {
      return null;
    }
    const rules = state.kind === 'demand'
      ? this.workingPricing.demandRules
      : this.workingPricing.timeRules;
    return rules.find(rule => rule.id === state.ruleId) ?? null;
  }

  private defaultDraftSlotIds(): string[] {
    const firstSlotId = `${this.resolvedConfig.slotCatalog[0]?.id ?? ''}`.trim();
    return firstSlotId ? [firstSlotId] : [];
  }

  private resolveMobileScopeSheetViewport(): boolean {
    return typeof window !== 'undefined'
      && window.innerWidth <= PricingEditorInputComponent.MOBILE_SCOPE_SHEET_BREAKPOINT_PX;
  }

  private slotLabelById(slotId: string | null | undefined): string {
    const normalizedSlotId = `${slotId ?? ''}`.trim();
    if (!normalizedSlotId) {
      return '';
    }
    return this.resolvedConfig.slotCatalog.find(slot => slot.id === normalizedSlotId)?.label ?? '';
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
    rule: ContractTypes.PricingDemandRule,
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
    rule: ContractTypes.PricingTimeRule,
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

  private applyRuleAction(price: number, action: ContractTypes.PricingAction): number {
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

  private describeDemandRule(rule: ContractTypes.PricingDemandRule): string {
    return `Demand rule active: when capacity filled is ${rule.operator === 'lte' ? '<=' : '>='} ${rule.capacityFilledPercent}%, ${this.describeAction(rule.action)}${this.describeRuleScope(rule)}.`;
  }

  private describeTimeRule(rule: ContractTypes.PricingTimeRule): string {
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

  private describeAction(action: ContractTypes.PricingAction): string {
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
