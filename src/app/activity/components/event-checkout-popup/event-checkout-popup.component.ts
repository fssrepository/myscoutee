import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';

import { environment } from '../../../../environments/environment';
import { AppUtils } from '../../../shared/app-utils';
import { PricingBuilder } from '../../../shared/core/base/builders';
import type * as ContractTypes from '../../../shared/core/contracts';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import { EventsService } from '../../../shared/core/base/services/events.service';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import { EventCheckoutDraftStore } from '../../../shared/ui/context/stores/event-checkout-draft.store';
import { EventCheckoutDialogStore, type EventCheckoutDialogState } from '../../../shared/ui/context/stores/event-checkout-dialog.store';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui/components/core/menu';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';

import type * as AppConstants from '../../../shared/core/common/constants';
type PricingSnapshot = {
  amount: number;
  currency: string;
};

type CancellationPreview = {
  refundAmount: number;
  refundLabel: string;
  note: string;
};

@Component({
  selector: 'app-event-checkout-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    AppMenuComponent,
    PopupComponent,
    IndicatorComponent
  ],
  templateUrl: './event-checkout-popup.component.html',
  styleUrl: './event-checkout-popup.component.scss'
})
export class EventCheckoutPopupComponent {
  private static readonly MAX_VISIBLE_SLOTS = 10;
  protected readonly environment = environment;
  protected readonly dialogStore = inject(EventCheckoutDialogStore);
  private readonly eventsService = inject(EventsService);
  private readonly checkoutDraftStore = inject(EventCheckoutDraftStore);

  protected selectedSlotSourceId: string | null = null;
  protected selectedSlotDateValue: Date | null = null;
  protected slotPageIndex = 0;
  protected selectedOptionalSubEventIds = new Set<string>();
  protected acceptedPolicyIds = new Set<string>();
  protected paymentStep = false;
  protected busy = false;
  protected errorMessage = '';

  private renderedDialogId = 0;
  private checkoutSessionId: string | null = null;
  private availableSlotsCache: ContractTypes.EventSlotOccurrenceDTO[] = [];
  private availableSlotDateEntriesCache: Array<{ key: string; value: Date; label: string; count: number }> = [];
  private availableSlotDateKeySet = new Set<string>();

  constructor() {
    effect(() => {
      const dialog = this.dialogStore.dialog();
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
    return this.dialogStore.dialog();
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    if (this.busy) {
      return;
    }
    this.dialogStore.close();
  }

  protected sectionTitle(): string {
    const dialog = this.dialog();
    if (!dialog) {
      return 'Checkout';
    }
    if (dialog.mode === 'invitation') {
      return this.totalAmount() > 0 ? 'Accept Invitation & Pay' : 'Accept Invitation';
    }
    if (this.isWaitingListSelection()) {
      return 'Join Waiting List';
    }
    if (this.shouldAwaitApprovalBeforePayment()) {
      return 'Review Join Request';
    }
    return this.totalAmount() > 0 ? 'Review Booking & Pay' : 'Join Event';
  }

  protected checkoutPopupModel(state: EventCheckoutDialogState): PopupModel {
    const title = this.sectionTitle();
    return {
      title,
      subtitle: state.record.title,
      ariaLabel: title,
      closeAriaLabel: 'Close checkout',
      closeOnBackdrop: state.allowBackdropClose && !this.busy,
      showClose: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected availableSlots(): readonly ContractTypes.EventSlotOccurrenceDTO[] {
    return this.availableSlotsCache;
  }

  protected selectedSlot(): ContractTypes.EventSlotOccurrenceDTO | null {
    if (!this.selectedSlotSourceId) {
      return null;
    }
    return this.availableSlots().find(item => item.id === this.selectedSlotSourceId) ?? null;
  }

  protected requiresSlotSelection(): boolean {
    return this.availableSlots().length > 0;
  }

  protected optionalSubEvents(): ContractTypes.SubEventDTO[] {
    return (this.dialog()?.record.subEvents ?? []).filter(item => item.optional);
  }

  protected slotCalendarFilter = (value: Date | null): boolean => {
    if (!value) {
      return false;
    }
    return this.availableSlotDateKeySet.has(this.slotDateKeyFromDate(value));
  };

  protected availableSlotDateEntries(): Array<{ key: string; value: Date; label: string; count: number }> {
    return this.availableSlotDateEntriesCache;
  }

  protected filteredSlots(): ContractTypes.EventSlotOccurrenceDTO[] {
    const selectedDateKey = this.selectedSlotDateKey();
    const all = [...this.availableSlots()];
    if (!selectedDateKey) {
      return all;
    }
    return all.filter(slot => this.slotDateKeyFromIso(slot.startAtIso) === selectedDateKey);
  }

  protected pagedSlots(): ContractTypes.EventSlotOccurrenceDTO[] {
    const offset = this.slotPageIndex * EventCheckoutPopupComponent.MAX_VISIBLE_SLOTS;
    return this.filteredSlots().slice(offset, offset + EventCheckoutPopupComponent.MAX_VISIBLE_SLOTS);
  }

  protected slotPageCount(): number {
    return Math.max(1, Math.ceil(this.filteredSlots().length / EventCheckoutPopupComponent.MAX_VISIBLE_SLOTS));
  }

  protected canGoToPreviousSlotPage(): boolean {
    return this.slotPageIndex > 0;
  }

  protected canGoToNextSlotPage(): boolean {
    return this.slotPageIndex < this.slotPageCount() - 1;
  }

  protected previousSlotPage(): void {
    if (!this.canGoToPreviousSlotPage()) {
      return;
    }
    this.slotPageIndex -= 1;
  }

  protected nextSlotPage(): void {
    if (!this.canGoToNextSlotPage()) {
      return;
    }
    this.slotPageIndex += 1;
  }

  protected slotPageSummary(): string {
    const filtered = this.filteredSlots();
    if (filtered.length === 0) {
      return 'No slots';
    }
    const from = (this.slotPageIndex * EventCheckoutPopupComponent.MAX_VISIBLE_SLOTS) + 1;
    const to = Math.min(filtered.length, from + EventCheckoutPopupComponent.MAX_VISIBLE_SLOTS - 1);
    return `${from}-${to} of ${filtered.length}`;
  }

  protected selectedSlotDateLabel(): string {
    const key = this.selectedSlotDateKey();
    if (!key) {
      return 'All dates';
    }
    const parsed = this.selectedSlotDateValue ?? this.availableSlotDateEntries().find(item => item.key === key)?.value ?? null;
    if (!parsed) {
      return key;
    }
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  protected selectedSlotBadgeLabel(): string {
    const slot = this.selectedSlot();
    if (!slot) {
      const dateLabel = this.selectedSlotDateLabel();
      return dateLabel === 'All dates' ? 'Choose a slot' : `${dateLabel} · choose a slot`;
    }
    const start = AppUtils.isoLocalDateTimeToDate(slot.startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(slot.endAtIso);
    if (!start || !end) {
      return slot.timeframe || 'Choose a slot';
    }
    const dateLabel = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    return `${dateLabel} · ${startTime} - ${endTime}`;
  }

  protected onSlotDateChange(value: Date | null): void {
    const normalized = value
      ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
      : null;
    if (normalized && !this.slotCalendarFilter(normalized)) {
      return;
    }
    this.selectedSlotDateValue = normalized;
    this.slotPageIndex = 0;
    this.invalidateCheckoutDraft();
  }

  protected policies(): ContractTypes.EventPolicyDTO[] {
    const record = this.dialog()?.record ?? null;
    return record?.policiesEnabled === true ? record.policies ?? [] : [];
  }

  protected requiredPolicyIds(): string[] {
    return this.policies().filter(item => item.required !== false).map(item => item.id);
  }

  protected missingRequiredPolicies(): boolean {
    return this.requiredPolicyIds().some(id => !this.acceptedPolicyIds.has(id));
  }

  protected toggleSlot(slotId: string): void {
    this.selectedSlotSourceId = this.selectedSlotSourceId === slotId ? null : slotId;
    this.invalidateCheckoutDraft();
  }

  protected isSelectedOptionalSubEvent(id: string): boolean {
    return this.selectedOptionalSubEventIds.has(id);
  }

  protected toggleOptionalSubEvent(id: string): void {
    if (this.selectedOptionalSubEventIds.has(id)) {
      this.selectedOptionalSubEventIds.delete(id);
    } else {
      this.selectedOptionalSubEventIds.add(id);
    }
    this.invalidateCheckoutDraft();
  }

  protected isAcceptedPolicy(id: string): boolean {
    return this.acceptedPolicyIds.has(id);
  }

  protected togglePolicy(id: string): void {
    if (this.acceptedPolicyIds.has(id)) {
      this.acceptedPolicyIds.delete(id);
    } else {
      this.acceptedPolicyIds.add(id);
    }
    if (this.checkoutSessionId) {
      this.persistCheckoutDraft();
    }
  }

  protected lineItems(): ActivityContracts.EventCheckoutLineItem[] {
    const dialog = this.dialog();
    if (!dialog) {
      return [];
    }
    const slot = this.selectedSlot();
    const slotId = slot?.slotTemplateId ?? null;
    const eventPricing = this.resolvePricing(dialog.record.pricing, dialog.record, slotId, slot);
    const items: ActivityContracts.EventCheckoutLineItem[] = [
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

    return items;
  }

  protected totalAmount(): number {
    return Math.round(this.lineItems().reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
  }

  protected showCancellationPolicyCard(): boolean {
    if (this.totalAmount() <= 0) {
      return false;
    }
    const dialog = this.dialog();
    if (!dialog) {
      return false;
    }
    const policy = PricingBuilder.compactPricingConfig(dialog.record.pricing, {
      context: 'event',
      slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(dialog.record.slotTemplates ?? []),
      allowSlotFeatures: (dialog.record.slotTemplates?.length ?? 0) > 0
    }).cancellationPolicy;
    return policy.enabled && policy.rules.length > 0;
  }

  protected cancellationPreview(): CancellationPreview | null {
    const dialog = this.dialog();
    if (!dialog || this.totalAmount() <= 0) {
      return null;
    }
    const policy = PricingBuilder.compactPricingConfig(dialog.record.pricing, {
      context: 'event',
      slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(dialog.record.slotTemplates ?? []),
      allowSlotFeatures: (dialog.record.slotTemplates?.length ?? 0) > 0
    }).cancellationPolicy;
    if (!policy.enabled || policy.rules.length === 0) {
      return null;
    }

    const startAtIso = this.selectedSlot()?.startAtIso ?? dialog.record.startAtIso;
    if (!startAtIso) {
      return null;
    }
    const applicableRule = this.resolveApplicableCancellationRule(policy.rules, startAtIso);
    if (!applicableRule) {
      return {
        refundAmount: 0,
        refundLabel: 'No refund right now',
        note: 'The selected booking is already inside the last reimbursement window.'
      };
    }

    const refundAmount = this.calculateCancellationRefundAmount(applicableRule, this.totalAmount());
    return {
      refundAmount,
      refundLabel: refundAmount > 0
        ? `${this.formatMoney(refundAmount)} refundable right now`
        : 'No refund right now',
      note: this.describeCancellationRule(applicableRule)
    };
  }

  protected cancellationRules(): ContractTypes.PricingCancellationRule[] {
    const dialog = this.dialog();
    if (!dialog) {
      return [];
    }
    const policy = PricingBuilder.compactPricingConfig(dialog.record.pricing, {
      context: 'event',
      slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(dialog.record.slotTemplates ?? []),
      allowSlotFeatures: (dialog.record.slotTemplates?.length ?? 0) > 0
    }).cancellationPolicy;
    return policy.rules;
  }

  protected cancellationRuleWindowLabel(rule: ContractTypes.PricingCancellationRule): string {
    const value = Math.max(0, Number(rule.offsetValue) || 0);
    const unit = rule.offsetUnit === 'hours'
      ? (value === 1 ? 'hour' : 'hours')
      : rule.offsetUnit === 'weeks'
        ? (value === 1 ? 'week' : 'weeks')
        : rule.offsetUnit === 'months'
          ? (value === 1 ? 'month' : 'months')
          : (value === 1 ? 'day' : 'days');
    return `${value} ${unit} before start`;
  }

  protected cancellationRuleRefundLabel(rule: ContractTypes.PricingCancellationRule): string {
    if (rule.refundKind === 'full') {
      return 'Full refund';
    }
    if (rule.refundKind === 'none') {
      return 'No refund';
    }
    if (rule.refundKind === 'fixed_amount') {
      return this.formatMoney(Number(rule.refundValue) || 0, this.currency());
    }
    return `${Math.max(0, Number(rule.refundValue) || 0)}% refund`;
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
      return 'Checkout';
    }
    if (this.shouldAwaitApprovalBeforePayment() || this.isWaitingListSelection()) {
      return dialog.confirmLabel;
    }
    if (this.totalAmount() > 0) {
      return dialog.confirmLabel;
    }
    return dialog.confirmLabel;
  }

  protected busyLabel(): string {
    const dialog = this.dialog();
    if (!dialog) {
      return 'Working...';
    }
    if (this.shouldAwaitApprovalBeforePayment() || this.isWaitingListSelection()) {
      return dialog.busyConfirmLabel;
    }
    if (this.totalAmount() > 0) {
      return this.paymentStep
        ? (this.paymentDisabled() ? dialog.busyConfirmLabel : 'Buying...')
        : 'Checking out...';
    }
    return dialog.busyConfirmLabel;
  }

  protected checkoutFooterMenuItems(): readonly AppMenuItem<string>[] {
    const hasError = !this.busy && !!this.errorMessage;
    const continueLabel = this.busy ? this.busyLabel() : this.continueLabel();
    return [
      {
        id: this.paymentStep ? 'checkout-back' : 'checkout-cancel',
        label: this.paymentStep ? 'Back' : 'Cancel',
        layout: 'action',
        palette: 'neutral',
        disabled: this.busy,
        ariaLabel: this.paymentStep ? 'Back' : 'Cancel'
      },
      {
        id: 'checkout-confirm',
        label: continueLabel,
        layout: 'action',
        palette: hasError ? 'danger' : 'blue',
        disabled: !this.canContinue() || this.busy,
        ariaLabel: continueLabel,
        progress: this.busy || hasError
          ? {
              state: this.busy ? 'loading' : 'error',
              shape: 'button'
            }
          : null
      }
    ];
  }

  protected onCheckoutActionMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id === 'checkout-back') {
      this.backToDetails(event.sourceEvent);
      return;
    }
    if (event.id === 'checkout-cancel') {
      this.close(event.sourceEvent);
      return;
    }
    if (event.id === 'checkout-confirm') {
      void this.submit(event.sourceEvent);
    }
  }

  protected paymentDisabled(): boolean {
    return !environment.paymentIntegrationEnabled;
  }

  protected canContinue(): boolean {
    if (this.busy || this.dialog()?.loading) {
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

  protected shouldAwaitApprovalBeforePayment(): boolean {
    const dialog = this.dialog();
    if (!dialog) {
      return false;
    }
    return dialog.requiresApprovalBeforePayment && !dialog.approvalGranted && this.totalAmount() > 0;
  }

  protected isWaitingListSelection(): boolean {
    const dialog = this.dialog();
    if (!dialog || dialog.approvalGranted) {
      return false;
    }
    const slot = this.selectedSlot();
    if (slot) {
      return this.isSlotFull(slot);
    }
    if (this.requiresSlotSelection()) {
      return dialog.pendingReason === 'waitlist';
    }
    return this.isRecordFull(dialog.record) || dialog.pendingReason === 'waitlist';
  }

  protected pendingNoticeTitle(): string {
    return this.isWaitingListSelection() ? 'Waiting List' : 'Approval Required';
  }

  protected pendingNoticeText(): string {
    if (this.isWaitingListSelection()) {
      return 'Send the wait request now. Payment stays locked in the basket until a spot opens and the system invites you to finish checkout.';
    }
    return 'Send the request now. Payment unlocks in the basket after the event admin approves it.';
  }

  protected slotCapacityLabel(slot: ContractTypes.EventSlotOccurrenceDTO): string {
    return this.isSlotFull(slot)
      ? `${slot.acceptedMembers} / ${slot.capacityTotal} · full`
      : `${slot.acceptedMembers} / ${slot.capacityTotal}`;
  }

  protected async submit(event?: Event): Promise<void> {
    event?.stopPropagation();
    const dialog = this.dialog();
    if (!dialog || !this.canContinue()) {
      return;
    }
    if (!this.paymentStep && (this.shouldAwaitApprovalBeforePayment() || this.isWaitingListSelection())) {
      this.busy = true;
      this.errorMessage = '';
      try {
        await Promise.resolve(dialog.onSubmit(this.buildSelection(null, false)));
        this.persistCheckoutDraft();
        this.dialogStore.close();
      } catch (error) {
        this.errorMessage = this.resolveErrorMessage(error, dialog.failureMessage);
      } finally {
        this.busy = false;
      }
      return;
    }
    if (!this.paymentStep && this.totalAmount() > 0) {
      this.busy = true;
      this.errorMessage = '';
      try {
        const session = await this.eventsService.createCheckoutSession(this.buildCheckoutRequest());
        if (!session?.id) {
          throw new Error('Unable to start checkout.');
        }
        this.checkoutSessionId = session.id;
        this.persistCheckoutDraft();
        this.paymentStep = true;
      } catch (error) {
        this.errorMessage = this.resolveErrorMessage(error, 'Unable to start checkout.');
      } finally {
        this.busy = false;
      }
      return;
    }

    this.busy = true;
    this.errorMessage = '';
    try {
      let paymentSessionId = this.checkoutSessionId;
      if (this.totalAmount() > 0) {
        if (!paymentSessionId) {
          const session = await this.eventsService.createCheckoutSession(this.buildCheckoutRequest());
          if (!session?.id) {
            throw new Error('Unable to start payment.');
          }
          paymentSessionId = session.id;
        }
        const paymentSession = await this.eventsService.payCheckoutSession(
          this.buildCheckoutRequest(),
          paymentSessionId
        );
        if (!paymentSession?.id) {
          throw new Error('Unable to start payment.');
        }
        paymentSessionId = paymentSession.id;
        this.checkoutSessionId = paymentSessionId;
      }
      await Promise.resolve(dialog.onSubmit(this.buildSelection(paymentSessionId)));
      this.clearCheckoutDraft();
      this.dialogStore.close();
    } catch (error) {
      if (await this.recoverStalePaymentSession(error)) {
        return;
      }
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

  protected trackLineItem(_index: number, item: ActivityContracts.EventCheckoutLineItem): string {
    return item.id;
  }

  protected trackPolicy(_index: number, item: ContractTypes.EventPolicyDTO): string {
    return item.id;
  }

  protected trackOptionalSubEvent(_index: number, item: ContractTypes.SubEventDTO): string {
    return item.id;
  }

  protected trackSlot(_index: number, item: ContractTypes.EventSlotOccurrenceDTO): string {
    return item.id;
  }

  private initializeDialogState(dialog: EventCheckoutDialogState): void {
    this.rebuildSlotCaches(dialog.record.upcomingSlots ?? []);
    const firstSlot = dialog.record.upcomingSlots?.[0] ?? null;
    const draft = this.checkoutDraftStore.read(dialog.userId, dialog.record.id);
    const validOptionalIds = new Set(this.optionalSubEvents().map(item => item.id));
    const validPolicyIds = new Set(this.policies().map(item => item.id));
    const validSlotIds = new Set(this.availableSlots().map(item => item.id));
    this.selectedSlotSourceId = draft?.slotSourceId && validSlotIds.has(draft.slotSourceId)
      ? draft.slotSourceId
      : null;
    const selectedSlot = this.selectedSlotSourceId
      ? this.availableSlots().find(item => item.id === this.selectedSlotSourceId) ?? null
      : null;
    this.selectedSlotDateValue = selectedSlot
      ? this.slotDateValueFromIso(selectedSlot.startAtIso)
      : (draft?.selectedDateKey ? this.slotDateValueFromKey(draft.selectedDateKey) : null)
        ?? (firstSlot ? this.slotDateValueFromIso(firstSlot.startAtIso) : null);
    this.slotPageIndex = 0;
    this.selectedOptionalSubEventIds = new Set((draft?.optionalSubEventIds ?? []).filter(item => validOptionalIds.has(item)));
    this.acceptedPolicyIds = new Set((draft?.acceptedPolicyIds ?? []).filter(item => validPolicyIds.has(item)));
    this.paymentStep = Boolean(draft?.checkoutSessionId);
    this.checkoutSessionId = draft?.checkoutSessionId ?? null;
    this.busy = false;
    this.errorMessage = '';
  }

  private resetDialogState(): void {
    this.renderedDialogId = 0;
    this.availableSlotsCache = [];
    this.availableSlotDateEntriesCache = [];
    this.availableSlotDateKeySet = new Set<string>();
    this.selectedSlotSourceId = null;
    this.selectedSlotDateValue = null;
    this.slotPageIndex = 0;
    this.selectedOptionalSubEventIds = new Set<string>();
    this.acceptedPolicyIds = new Set<string>();
    this.paymentStep = false;
    this.checkoutSessionId = null;
    this.busy = false;
    this.errorMessage = '';
  }

  private buildSelection(
    paymentSessionId: string | null,
    bookingConfirmed = true
  ): ActivityContracts.EventCheckoutSelection {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    return {
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: [],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      paymentSessionId,
      bookingConfirmed,
      pendingReason: this.isWaitingListSelection() ? 'waitlist' : (this.shouldAwaitApprovalBeforePayment() ? 'approval' : null)
    };
  }

  private buildCheckoutRequest(): ActivityContracts.EventCheckoutRequest {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: [],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      pendingReason: this.isWaitingListSelection() ? 'waitlist' : (this.shouldAwaitApprovalBeforePayment() ? 'approval' : null)
    };
  }

  protected resolvePricing(
    pricing: ContractTypes.PricingConfig | null | undefined,
    record: ActivityEventRecord,
    slotId: string | null,
    slot: ContractTypes.EventSlotOccurrenceDTO | null
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
    rule: ContractTypes.PricingDemandRule,
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
    rule: ContractTypes.PricingTimeRule,
    hoursUntilStart: number,
    slotId: string | null,
    comparisonIso: string
  ): boolean {
    if (rule.appliesTo === 'selected_slots' && (!slotId || !(rule.slotIds ?? []).includes(slotId))) {
      return false;
    }
    if (rule.trigger === 'specific_date') {
      const start = (rule.specificDateStart ?? '').trim();
      const end = (rule.specificDateEnd ?? '').trim();
      if (!start || !end || !comparisonIso) {
        return false;
      }
      const comparisonDate = comparisonIso.slice(0, 10);
      return comparisonDate >= start && comparisonDate <= end;
    }
    if (rule.trigger === 'hours_before_start') {
      return hoursUntilStart <= Math.max(0, Number(rule.offsetValue) || 0);
    }
    const dayWindowHours = Math.max(0, Number(rule.offsetValue) || 0) * 24;
    return hoursUntilStart <= dayWindowHours;
  }

  private applyPricingAction(currentPrice: number, action: ContractTypes.PricingAction): number {
    const value = Number(action.value) || 0;
    if (action.kind === 'set_exact_price') {
      return Math.max(0, value);
    }
    if (action.kind === 'increase_amount') {
      return Math.max(0, currentPrice + value);
    }
    if (action.kind === 'decrease_amount') {
      return Math.max(0, currentPrice - value);
    }
    const percent = value / 100;
    if (action.kind === 'decrease_percent') {
      return Math.max(0, currentPrice * (1 - percent));
    }
    return Math.max(0, currentPrice * (1 + percent));
  }

  private applyRounding(price: number, rounding: AppConstants.PricingRoundingMode): number {
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

  private resolveApplicableCancellationRule(
    rules: readonly ContractTypes.PricingCancellationRule[],
    startAtIso: string
  ): ContractTypes.PricingCancellationRule | null {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    if (!start) {
      return null;
    }

    const now = Date.now();
    let bestRule: ContractTypes.PricingCancellationRule | null = null;
    let bestDeadlineMs = Number.POSITIVE_INFINITY;
    for (const rule of rules) {
      const deadline = this.cancellationRuleDeadlineMs(rule, start);
      if (deadline === null || now > deadline) {
        continue;
      }
      if (deadline < bestDeadlineMs) {
        bestRule = rule;
        bestDeadlineMs = deadline;
      }
    }
    return bestRule;
  }

  private cancellationRuleDeadlineMs(
    rule: ContractTypes.PricingCancellationRule,
    start: Date
  ): number | null {
    const value = Math.max(0, Math.trunc(Number(rule.offsetValue) || 0));
    const next = new Date(start.getTime());
    if (rule.offsetUnit === 'hours') {
      next.setHours(next.getHours() - value);
      return next.getTime();
    }
    if (rule.offsetUnit === 'weeks') {
      next.setDate(next.getDate() - (value * 7));
      return next.getTime();
    }
    if (rule.offsetUnit === 'months') {
      next.setMonth(next.getMonth() - value);
      return next.getTime();
    }
    next.setDate(next.getDate() - value);
    return next.getTime();
  }

  private calculateCancellationRefundAmount(
    rule: ContractTypes.PricingCancellationRule,
    totalAmount: number
  ): number {
    const amount = Math.max(0, totalAmount);
    if (rule.refundKind === 'full') {
      return amount;
    }
    if (rule.refundKind === 'none') {
      return 0;
    }
    if (rule.refundKind === 'fixed_amount') {
      return Math.min(amount, Math.round((Number(rule.refundValue) || 0) * 100) / 100);
    }
    return Math.round(amount * ((Math.max(0, Math.min(100, Number(rule.refundValue) || 0))) / 100) * 100) / 100;
  }

  private describeCancellationRule(rule: ContractTypes.PricingCancellationRule): string {
    return `${this.cancellationRuleRefundLabel(rule)} when cancelled at least ${this.cancellationRuleWindowLabel(rule)}.`;
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }
    if (this.isPaymentSessionConflict(error)) {
      return 'Checkout details changed. A fresh payment session is needed.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message.trim();
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return fallback;
  }

  private async recoverStalePaymentSession(error: unknown): Promise<boolean> {
    if (!this.isPaymentSessionConflict(error) || this.totalAmount() <= 0) {
      return false;
    }
    this.clearCheckoutDraft();
    try {
      const session = await this.eventsService.createCheckoutSession(this.buildCheckoutRequest());
      if (!session?.id) {
        this.errorMessage = 'Checkout details changed. Start checkout again.';
        return true;
      }
      this.checkoutSessionId = session.id;
      this.paymentStep = true;
      this.persistCheckoutDraft();
      this.errorMessage = 'Checkout details changed. A fresh payment session is ready.';
      return true;
    } catch (recoveryError) {
      this.errorMessage = this.resolveErrorMessage(recoveryError, 'Checkout details changed. Start checkout again.');
      return true;
    }
  }

  private isPaymentSessionConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }

  private availableSlotDateKeys(): string[] {
    return this.availableSlotDateEntries().map(item => item.key);
  }

  private selectedSlotDateKey(): string {
    return this.selectedSlotDateValue
      ? this.slotDateKeyFromDate(this.selectedSlotDateValue)
      : (this.availableSlotDateKeys()[0] ?? '');
  }

  private slotDateValueFromIso(value: string): Date | null {
    const parsed = AppUtils.isoLocalDateTimeToDate(value);
    if (!parsed) {
      return null;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private slotDateValueFromKey(value: string): Date | null {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private slotDateKeyFromIso(value: string): string {
    const parsed = AppUtils.isoLocalDateTimeToDate(value);
    return parsed ? this.slotDateKeyFromDate(parsed) : '';
  }

  private slotDateKeyFromDate(value: Date): string {
    return `${value.getFullYear()}-${AppUtils.pad2(value.getMonth() + 1)}-${AppUtils.pad2(value.getDate())}`;
  }

  private persistCheckoutDraft(): void {
    const dialog = this.dialog();
    if (!dialog || (this.totalAmount() <= 0 && !this.isWaitingListSelection())) {
      return;
    }
    this.checkoutDraftStore.save({
      userId: dialog.userId,
      sourceId: dialog.record.id,
      eventTitle: dialog.record.title,
      eventTimeframe: dialog.record.timeframe,
      slotSourceId: this.selectedSlotSourceId,
      selectedDateKey: this.selectedSlotDateValue ? this.slotDateKeyFromDate(this.selectedSlotDateValue) : null,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      checkoutSessionId: this.checkoutSessionId,
      pendingReason: this.isWaitingListSelection() ? 'waitlist' : (this.shouldAwaitApprovalBeforePayment() ? 'approval' : null),
      updatedAtMs: Date.now()
    });
  }

  private clearCheckoutDraft(): void {
    const dialog = this.dialog();
    if (!dialog) {
      return;
    }
    this.checkoutDraftStore.clear(dialog.userId, dialog.record.id);
    this.checkoutSessionId = null;
  }

  private invalidateCheckoutDraft(): void {
    if (!this.checkoutSessionId) {
      return;
    }
    this.clearCheckoutDraft();
  }

  private rebuildSlotCaches(slots: readonly ContractTypes.EventSlotOccurrenceDTO[]): void {
    this.availableSlotsCache = [...slots].sort((left, right) => {
      const leftMs = AppUtils.isoLocalDateTimeToDate(left.startAtIso)?.getTime() ?? 0;
      const rightMs = AppUtils.isoLocalDateTimeToDate(right.startAtIso)?.getTime() ?? 0;
      return leftMs - rightMs;
    });

    const grouped = new Map<string, { value: Date; count: number }>();
    for (const slot of this.availableSlotsCache) {
      const parsed = AppUtils.isoLocalDateTimeToDate(slot.startAtIso);
      if (!parsed) {
        continue;
      }
      const key = this.slotDateKeyFromDate(parsed);
      if (!grouped.has(key)) {
        grouped.set(key, {
          value: new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
          count: 0
        });
      }
      grouped.get(key)!.count += 1;
    }

    this.availableSlotDateEntriesCache = [...grouped.entries()].map(([key, item]) => ({
      key,
      value: item.value,
      label: item.value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      count: item.count
    }));
    this.availableSlotDateKeySet = new Set(this.availableSlotDateEntriesCache.map(item => item.key));
  }

  private isRecordFull(record: ActivityEventRecord): boolean {
    return Math.max(0, Math.trunc(Number(record.capacityTotal) || 0)) > 0
      && Math.max(0, Math.trunc(Number(record.acceptedMembers) || 0)) >= Math.max(0, Math.trunc(Number(record.capacityTotal) || 0));
  }

  private isSlotFull(slot: ContractTypes.EventSlotOccurrenceDTO): boolean {
    return Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0)) > 0
      && Math.max(0, Math.trunc(Number(slot.acceptedMembers) || 0)) >= Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
  }
}
