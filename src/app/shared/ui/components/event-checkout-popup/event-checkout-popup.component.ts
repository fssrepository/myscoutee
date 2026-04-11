import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';
import { PricingBuilder } from '../../../core/base/builders';
import type * as AppTypes from '../../../core/base/models';
import { EventsService } from '../../../core/base/services/events.service';
import type { DemoEventRecord } from '../../../core/demo/models/events.model';
import { EventCheckoutDialogService, type EventCheckoutDialogState } from '../../services/event-checkout-dialog.service';

type ResourceOption = {
  key: string;
  subEventId: string;
  resourceType: AppTypes.EventCheckoutAssetSelection['resourceType'];
  label: string;
  description: string;
};

type PricingSnapshot = {
  amount: number;
  currency: string;
};

@Component({
  selector: 'app-event-checkout-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './event-checkout-popup.component.html',
  styleUrl: './event-checkout-popup.component.scss'
})
export class EventCheckoutPopupComponent {
  protected readonly environment = environment;
  protected readonly dialogService = inject(EventCheckoutDialogService);
  private readonly eventsService = inject(EventsService);

  protected selectedSlotSourceId: string | null = null;
  protected selectedOptionalSubEventIds = new Set<string>();
  protected selectedAssetKeys = new Set<string>();
  protected acceptedPolicyIds = new Set<string>();
  protected paymentStep = false;
  protected busy = false;
  protected errorMessage = '';

  private renderedDialogId = 0;

  constructor() {
    effect(() => {
      const dialog = this.dialogService.dialog();
      if (!dialog) {
        this.resetDialogState();
        return;
      }
      if (dialog.id === this.renderedDialogId) {
        return;
      }
      this.renderedDialogId = dialog.id;
      this.initializeDialogState(dialog);
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const dialog = this.dialog();
    if (!dialog || keyboardEvent.defaultPrevented || !dialog.allowEscapeClose || this.busy) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.paymentStep) {
      this.paymentStep = false;
      return;
    }
    this.close();
  }

  protected dialog(): EventCheckoutDialogState | null {
    return this.dialogService.dialog();
  }

  protected closeFromBackdrop(event: Event): void {
    event.stopPropagation();
    const dialog = this.dialog();
    if (!dialog || this.busy || !dialog.allowBackdropClose) {
      return;
    }
    this.close();
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    if (this.busy) {
      return;
    }
    this.dialogService.close();
  }

  protected sectionTitle(): string {
    const dialog = this.dialog();
    if (!dialog) {
      return 'Checkout';
    }
    if (dialog.mode === 'invitation') {
      return this.totalAmount() > 0 ? 'Accept Invitation & Pay' : 'Accept Invitation';
    }
    return this.totalAmount() > 0 ? 'Review Booking & Pay' : 'Join Event';
  }

  protected sectionSubtitle(): string {
    const dialog = this.dialog();
    if (!dialog) {
      return '';
    }
    return dialog.record.timeframe || dialog.subtitle;
  }

  protected availableSlots(): readonly AppTypes.EventSlotOccurrence[] {
    return this.dialog()?.record.upcomingSlots ?? [];
  }

  protected selectedSlot(): AppTypes.EventSlotOccurrence | null {
    const slots = this.availableSlots();
    if (slots.length === 0) {
      return null;
    }
    return slots.find(item => item.id === this.selectedSlotSourceId) ?? slots[0] ?? null;
  }

  protected requiresSlotSelection(): boolean {
    return this.availableSlots().length > 0;
  }

  protected optionalSubEvents(): AppTypes.SubEventFormItem[] {
    return (this.dialog()?.record.subEvents ?? []).filter(item => item.optional);
  }

  protected resourceOptions(): ResourceOption[] {
    const options: ResourceOption[] = [];
    for (const subEvent of this.optionalSubEvents()) {
      if (!this.selectedOptionalSubEventIds.has(subEvent.id)) {
        continue;
      }
      const capacityRows: Array<[AppTypes.EventCheckoutAssetSelection['resourceType'], number | undefined, string]> = [
        ['Car', subEvent.carsCapacityMax, 'Transport / Car'],
        ['Accommodation', subEvent.accommodationCapacityMax, 'Accommodation'],
        ['Supplies', subEvent.suppliesCapacityMax, 'Supplies']
      ];
      for (const [resourceType, capacityMax, label] of capacityRows) {
        if (!Number.isFinite(Number(capacityMax)) || Number(capacityMax) <= 0) {
          continue;
        }
        options.push({
          key: `${subEvent.id}:${resourceType}`,
          subEventId: subEvent.id,
          resourceType,
          label,
          description: `${subEvent.name} · request ${label.toLowerCase()}`
        });
      }
    }
    return options;
  }

  protected policies(): AppTypes.EventPolicyItem[] {
    return this.dialog()?.record.policies ?? [];
  }

  protected requiredPolicyIds(): string[] {
    return this.policies().filter(item => item.required !== false).map(item => item.id);
  }

  protected missingRequiredPolicies(): boolean {
    return this.requiredPolicyIds().some(id => !this.acceptedPolicyIds.has(id));
  }

  protected toggleSlot(slotId: string): void {
    this.selectedSlotSourceId = this.selectedSlotSourceId === slotId ? null : slotId;
  }

  protected isSelectedOptionalSubEvent(id: string): boolean {
    return this.selectedOptionalSubEventIds.has(id);
  }

  protected toggleOptionalSubEvent(id: string): void {
    if (this.selectedOptionalSubEventIds.has(id)) {
      this.selectedOptionalSubEventIds.delete(id);
      for (const option of this.resourceOptions()) {
        if (option.subEventId === id) {
          this.selectedAssetKeys.delete(option.key);
        }
      }
    } else {
      this.selectedOptionalSubEventIds.add(id);
    }
  }

  protected isSelectedAsset(key: string): boolean {
    return this.selectedAssetKeys.has(key);
  }

  protected toggleAsset(key: string): void {
    if (this.selectedAssetKeys.has(key)) {
      this.selectedAssetKeys.delete(key);
      return;
    }
    this.selectedAssetKeys.add(key);
  }

  protected isAcceptedPolicy(id: string): boolean {
    return this.acceptedPolicyIds.has(id);
  }

  protected togglePolicy(id: string): void {
    if (this.acceptedPolicyIds.has(id)) {
      this.acceptedPolicyIds.delete(id);
      return;
    }
    this.acceptedPolicyIds.add(id);
  }

  protected lineItems(): AppTypes.EventCheckoutLineItem[] {
    const dialog = this.dialog();
    if (!dialog) {
      return [];
    }
    const slot = this.selectedSlot();
    const slotId = slot?.slotTemplateId ?? null;
    const eventPricing = this.resolvePricing(dialog.record.pricing, dialog.record, slotId, slot);
    const items: AppTypes.EventCheckoutLineItem[] = [
      {
        id: `event:${dialog.record.id}`,
        kind: 'event',
        label: dialog.record.title,
        detail: slot?.timeframe || dialog.record.timeframe || 'Main event',
        amount: eventPricing.amount,
        currency: eventPricing.currency
      }
    ];

    for (const subEvent of this.optionalSubEvents()) {
      if (!this.selectedOptionalSubEventIds.has(subEvent.id)) {
        continue;
      }
      const pricing = this.resolvePricing(subEvent.pricing, dialog.record, null, slot);
      items.push({
        id: `subevent:${subEvent.id}`,
        kind: 'sub_event',
        label: subEvent.name,
        detail: subEvent.description || 'Optional sub event',
        amount: pricing.amount,
        currency: pricing.currency
      });
    }

    for (const option of this.resourceOptions()) {
      if (!this.selectedAssetKeys.has(option.key)) {
        continue;
      }
      items.push({
        id: `resource:${option.key}`,
        kind: 'resource',
        label: option.label,
        detail: option.description,
        amount: 0,
        currency: this.currency()
      });
    }

    return items;
  }

  protected totalAmount(): number {
    return Math.round(this.lineItems().reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
  }

  protected currency(): string {
    return this.lineItems().find(item => item.currency)?.currency
      ?? this.dialog()?.record.pricing?.currency
      ?? 'USD';
  }

  protected formatMoney(amount: number, currency = this.currency()): string {
    const symbol = this.currencySymbol(currency);
    return `${symbol}${(Number(amount) || 0).toFixed(2)}`;
  }

  protected currencySymbol(currency: string): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return 'EUR ';
      case 'GBP':
        return 'GBP ';
      default:
        return '$';
    }
  }

  protected continueLabel(): string {
    const dialog = this.dialog();
    if (!dialog) {
      return 'Continue';
    }
    if (this.paymentStep) {
      return 'Pay & confirm';
    }
    if (this.totalAmount() > 0) {
      return 'Review payment';
    }
    return dialog.confirmLabel;
  }

  protected canContinue(): boolean {
    if (this.busy) {
      return false;
    }
    if (this.requiresSlotSelection() && !this.selectedSlot()) {
      return false;
    }
    if (this.missingRequiredPolicies()) {
      return false;
    }
    return true;
  }

  protected async submit(event?: Event): Promise<void> {
    event?.stopPropagation();
    const dialog = this.dialog();
    if (!dialog || !this.canContinue()) {
      return;
    }
    if (!this.paymentStep && this.totalAmount() > 0) {
      this.paymentStep = true;
      this.errorMessage = '';
      return;
    }

    this.busy = true;
    this.errorMessage = '';
    try {
      let paymentSessionId: string | null = null;
      if (this.totalAmount() > 0) {
        if (environment.paymentIntegrationEnabled) {
          const session = await this.eventsService.createCheckoutSession(this.buildCheckoutRequest());
          if (!session?.id) {
            throw new Error('Unable to start payment.');
          }
          paymentSessionId = session.id;
        } else {
          paymentSessionId = `dummy-${Date.now()}`;
        }
      }
      await Promise.resolve(dialog.onSubmit(this.buildSelection(paymentSessionId)));
      this.dialogService.close();
    } catch (error) {
      this.errorMessage = this.resolveErrorMessage(error, dialog.failureMessage);
    } finally {
      this.busy = false;
    }
  }

  protected backToDetails(event?: Event): void {
    event?.stopPropagation();
    if (this.busy) {
      return;
    }
    this.paymentStep = false;
    this.errorMessage = '';
  }

  protected trackLineItem(_index: number, item: AppTypes.EventCheckoutLineItem): string {
    return item.id;
  }

  protected trackPolicy(_index: number, item: AppTypes.EventPolicyItem): string {
    return item.id;
  }

  protected trackOptionalSubEvent(_index: number, item: AppTypes.SubEventFormItem): string {
    return item.id;
  }

  protected trackResource(_index: number, item: ResourceOption): string {
    return item.key;
  }

  protected trackSlot(_index: number, item: AppTypes.EventSlotOccurrence): string {
    return item.id;
  }

  private initializeDialogState(dialog: EventCheckoutDialogState): void {
    const firstSlot = dialog.record.upcomingSlots?.[0] ?? null;
    this.selectedSlotSourceId = firstSlot?.id ?? null;
    this.selectedOptionalSubEventIds = new Set<string>();
    this.selectedAssetKeys = new Set<string>();
    this.acceptedPolicyIds = new Set<string>();
    this.paymentStep = false;
    this.busy = false;
    this.errorMessage = '';
  }

  private resetDialogState(): void {
    this.renderedDialogId = 0;
    this.selectedSlotSourceId = null;
    this.selectedOptionalSubEventIds = new Set<string>();
    this.selectedAssetKeys = new Set<string>();
    this.acceptedPolicyIds = new Set<string>();
    this.paymentStep = false;
    this.busy = false;
    this.errorMessage = '';
  }

  private buildSelection(paymentSessionId: string | null): AppTypes.EventCheckoutSelection {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    return {
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: this.resourceOptions()
        .filter(option => this.selectedAssetKeys.has(option.key))
        .map(option => ({
          subEventId: option.subEventId,
          resourceType: option.resourceType
        })),
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      paymentSessionId
    };
  }

  private buildCheckoutRequest(): AppTypes.EventCheckoutRequest {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: this.resourceOptions()
        .filter(option => this.selectedAssetKeys.has(option.key))
        .map(option => ({
          subEventId: option.subEventId,
          resourceType: option.resourceType
        })),
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency()
    };
  }

  protected resolvePricing(
    pricing: AppTypes.PricingConfig | null | undefined,
    record: DemoEventRecord,
    slotId: string | null,
    slot: AppTypes.EventSlotOccurrence | null
  ): PricingSnapshot {
    const slotCatalog = PricingBuilder.slotCatalogFromEventSlotTemplates(record.slotTemplates ?? []);
    const normalized = PricingBuilder.compactPricingConfig(pricing, {
      context: 'event',
      slotCatalog,
      allowSlotFeatures: slotCatalog.length > 0
    });
    if (!normalized.enabled) {
      return {
        amount: 0,
        currency: normalized.currency || 'USD'
      };
    }

    const previewBase = normalized.slotPricingEnabled && slotId
      ? normalized.slotOverrides.find(item => item.slotId === slotId)?.price ?? normalized.basePrice
      : normalized.basePrice;
    const capacityFilledPercent = record.capacityTotal > 0
      ? Math.round((record.acceptedMembers / record.capacityTotal) * 100)
      : 0;
    const hoursUntilStart = this.resolveHoursUntilStart(slot?.startAtIso ?? record.startAtIso);

    let nextPrice = previewBase;
    if ((normalized.mode === 'demand-based' || normalized.mode === 'hybrid') && normalized.demandRulesEnabled) {
      for (const rule of normalized.demandRules) {
        if (!this.matchesDemandRule(rule, capacityFilledPercent, slotId)) {
          continue;
        }
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
      }
    }
    if ((normalized.mode === 'time-based' || normalized.mode === 'hybrid') && normalized.timeRulesEnabled) {
      for (const rule of normalized.timeRules) {
        if (!this.matchesTimeRule(rule, hoursUntilStart, slotId, slot?.startAtIso ?? record.startAtIso)) {
          continue;
        }
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
      }
    }

    if (normalized.minPrice !== null) {
      nextPrice = Math.max(normalized.minPrice, nextPrice);
    }
    if (normalized.maxPrice !== null) {
      nextPrice = Math.min(normalized.maxPrice, nextPrice);
    }

    return {
      amount: this.applyRounding(nextPrice, normalized.rounding),
      currency: normalized.currency || 'USD'
    };
  }

  private matchesDemandRule(
    rule: AppTypes.PricingDemandRule,
    capacityFilledPercent: number,
    slotId: string | null
  ): boolean {
    if (rule.appliesTo === 'selected_slots' && (!slotId || !(rule.slotIds ?? []).includes(slotId))) {
      return false;
    }
    if (rule.operator === 'lte') {
      return capacityFilledPercent <= rule.capacityFilledPercent;
    }
    return capacityFilledPercent >= rule.capacityFilledPercent;
  }

  private matchesTimeRule(
    rule: AppTypes.PricingTimeRule,
    hoursUntilStart: number,
    slotId: string | null,
    comparisonIso: string
  ): boolean {
    if (rule.appliesTo === 'selected_slots' && (!slotId || !(rule.slotIds ?? []).includes(slotId))) {
      return false;
    }
    if (rule.trigger === 'specific_date') {
      const specific = (rule.specificDate ?? '').trim();
      if (!specific || !comparisonIso) {
        return false;
      }
      return comparisonIso.slice(0, 10) === specific;
    }
    if (rule.trigger === 'hours_before_start') {
      return hoursUntilStart <= Math.max(0, Number(rule.offsetValue) || 0);
    }
    const dayWindowHours = Math.max(0, Number(rule.offsetValue) || 0) * 24;
    return hoursUntilStart <= dayWindowHours;
  }

  private applyPricingAction(currentPrice: number, action: AppTypes.PricingAction): number {
    const value = Number(action.value) || 0;
    if (action.kind === 'set_exact_price') {
      return Math.max(0, value);
    }
    const percent = value / 100;
    if (action.kind === 'decrease_percent') {
      return Math.max(0, currentPrice * (1 - percent));
    }
    return Math.max(0, currentPrice * (1 + percent));
  }

  private applyRounding(price: number, rounding: AppTypes.PricingRoundingMode): number {
    if (rounding === 'whole') {
      return Math.round(price);
    }
    if (rounding === 'half') {
      return Math.round(price * 2) / 2;
    }
    return Math.round(price * 100) / 100;
  }

  private resolveHoursUntilStart(startAtIso: string): number {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    if (!start) {
      return 0;
    }
    return Math.max(0, Math.round((start.getTime() - Date.now()) / (60 * 60 * 1000)));
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return fallback;
  }
}
