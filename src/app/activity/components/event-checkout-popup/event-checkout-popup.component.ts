import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, effect, inject, signal } from '@angular/core';
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
import { EventCheckoutDraftStore, type EventCheckoutDraft } from '../../../shared/ui/context/stores/event-checkout-draft.store';
import { EventCheckoutDialogStore, type EventCheckoutDialogState } from '../../../shared/ui/context/stores/event-checkout-dialog.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { EventEditorPopupStore } from '../../../shared/ui/context/stores/event-editor-popup.store';
import {
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '../../../shared/ui/components/core/menu';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';

import type * as AppConstants from '../../../shared/core/common/constants';
type PricingSnapshot = {
  amount: number;
  currency: string;
  rows: ActivityContracts.EventCheckoutPricingSummaryRow[];
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
    PopupComponent,
    IndicatorComponent
  ],
  templateUrl: './event-checkout-popup.component.html',
  styleUrl: './event-checkout-popup.component.scss'
})
export class EventCheckoutPopupComponent {
  private static readonly MAX_VISIBLE_SLOTS = 10;
  private static readonly CHECKOUT_BASKET_TTL_MS = 20 * 60 * 1000;
  protected readonly environment = environment;
  protected readonly dialogStore = inject(EventCheckoutDialogStore);
  private readonly eventEditorStore = inject(EventEditorPopupStore);
  private readonly eventsService = inject(EventsService);
  private readonly checkoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly confirmationDialogStore = inject(DialogStore);

  protected selectedSlotSourceId: string | null = null;
  protected selectedSlotDateValue: Date | null = null;
  protected slotPageIndex = 0;
  protected selectedOptionalSubEventIds = new Set<string>();
  protected acceptedPolicyIds = new Set<string>();
  protected paymentStep = false;
  protected busy = false;
  protected errorMessage = '';

  private renderedDialogId = 0;
  private checkoutReviewDialogId = 0;
  private readonly checkoutReviewBodyLoading = signal(false);
  private checkoutBusyActionId: string | null = null;
  private checkoutSessionId: string | null = null;
  private checkoutBasket: ActivityContracts.EventCheckoutBasket | null = null;
  private availableSlotsCache: ContractTypes.EventSlotOccurrenceDTO[] = [];
  private availableSlotDateEntriesCache: Array<{ key: string; value: Date; label: string; count: number }> = [];
  private availableSlotDateKeySet = new Set<string>();

  constructor() {
    effect(() => {
      const dialog = this.dialogStore.dialog();
      if (!dialog) {
        this.closeCheckoutReviewEditor();
        this.resetDialogState();
        return;
      }
      if (dialog.id === this.renderedDialogId) {
        return;
      }
      this.renderedDialogId = dialog.id;
      this.initializeDialogState(dialog);
      if (!dialog.loading) {
        void this.openCheckoutReviewEditor(dialog);
      }
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
    this.closeCheckoutDialog();
  }

  private async openCheckoutReviewEditor(dialog: EventCheckoutDialogState): Promise<void> {
    const dialogId = dialog.id;
    this.checkoutReviewDialogId = dialogId;
    this.checkoutReviewBodyLoading.set(true);
    this.openCheckoutReviewEditorShell(dialog);
    await this.eventEditorStore.ensureEventEditorPopupLoaded();
    if (this.dialogStore.dialog()?.id !== dialogId) {
      return;
    }
    this.openCheckoutReviewEditorShell(dialog);
    await this.loadRuntimeCheckoutBasket(dialog);
    if (this.dialogStore.dialog()?.id !== dialogId) {
      return;
    }
    this.checkoutReviewBodyLoading.set(false);
    this.openCheckoutReviewEditorShell(dialog);
  }

  private openCheckoutReviewEditorShell(dialog: EventCheckoutDialogState): void {
    this.eventEditorStore.openCheckoutReview({
      ...dialog.record,
      checkoutBasket: this.checkoutBasket
    }, {
      title: this.sectionTitle(),
      subtitle: dialog.record.title,
      checkoutPhase: this.paymentStep ? 'payment' : 'review',
      hideSubEventsPanel: true,
      hideSlotsPanel: true,
      loading: () => this.checkoutReviewBodyLoading(),
      basketItems: () => this.checkoutBasketPresentationItems(),
      basketPricingSummaryRows: () => this.checkoutBasketPricingSummaryRows(),
      basketTotalAmount: () => this.totalAmount(),
      basketCurrency: () => this.currency(),
      basketAddDisabled: () => this.checkoutBasketAddDisabled(),
      onBasketAdd: event => this.addCheckoutBasketSlot(event),
      onBasketItemMenuSelect: (item, event) => this.onCheckoutBasketItemMenuSelect(item, event),
      footerItems: this.checkoutFooterMenuItems(),
      footerMessage: () => this.errorMessage,
      onFooterItemSelect: event => this.onCheckoutActionMenuSelect(event),
      onClose: () => this.onCheckoutReviewEditorClose()
    });
  }

  private closeCheckoutDialog(): void {
    this.dialogStore.close();
    this.closeCheckoutReviewEditor();
  }

  private closeCheckoutReviewEditor(): void {
    if (!this.checkoutReviewDialogId) {
      return;
    }
    this.checkoutReviewDialogId = 0;
    this.checkoutReviewBodyLoading.set(false);
    if (this.eventEditorStore.presentation().mode === 'checkout-review') {
      this.eventEditorStore.close();
    }
  }

  private onCheckoutReviewEditorClose(): void {
    if (!this.checkoutReviewDialogId) {
      return;
    }
    this.checkoutReviewDialogId = 0;
    this.checkoutReviewBodyLoading.set(false);
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
      this.busy = true;
      this.checkoutBusyActionId = null;
      void this.persistCheckoutDraft()
        .catch(error => {
          const dialog = this.dialog();
          this.errorMessage = this.resolveErrorMessage(error, dialog?.failureMessage ?? 'Unable to update checkout.');
        })
        .finally(() => {
          this.busy = false;
          this.checkoutBusyActionId = null;
        });
    }
  }

  protected lineItems(): ActivityContracts.EventCheckoutLineItem[] {
    const basket = this.checkoutBasketSnapshot();
    if (basket) {
      return basket.lineItems.map(item => ({ ...item }));
    }
    const dialog = this.dialog();
    if (!dialog) {
      return [];
    }
    if (this.requiresSlotSelection()) {
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

  private checkoutBasketItems(
    statusOverride?: ActivityContracts.EventCheckoutState,
    resultStateOverride?: ActivityContracts.EventCheckoutResultState
  ): ActivityContracts.EventCheckoutBasketItem[] {
    return this.checkoutBasketSnapshot()?.items.map(item => ({
      ...item,
      status: statusOverride ?? item.status,
      resultState: resultStateOverride ?? item.resultState ?? 'pending',
      pricingSummaryRows: [...(item.pricingSummaryRows ?? [])]
    })) ?? [];
  }

  private activeCheckoutBasketItems(): ActivityContracts.EventCheckoutBasketItem[] {
    const activeItems = (this.checkoutBasket?.items ?? [])
      .filter(item => !this.isInactiveCheckoutResultState(item.resultState));
    return activeItems.map(item => ({ ...item, pricingSummaryRows: [...(item.pricingSummaryRows ?? [])] }));
  }

  private checkoutBasketSnapshot(): ActivityContracts.EventCheckoutBasket | null {
    if (this.checkoutBasket?.items?.some(item => !this.isInactiveCheckoutResultState(item.resultState))) {
      return this.checkoutBasket;
    }
    if (this.requiresSlotSelection()) {
      return null;
    }
    const basket = this.buildRuntimeBasketFromCurrentSelection();
    this.checkoutBasket = basket;
    return basket;
  }

  private isInactiveCheckoutResultState(resultState: ActivityContracts.EventCheckoutResultState | string | null | undefined): boolean {
    return resultState === 'deleted' || resultState === 'succeeded';
  }

  private buildBasketItemsFromCurrentSelection(): ActivityContracts.EventCheckoutBasketItem[] {
    const dialog = this.dialog();
    if (!dialog) {
      return [];
    }
    const slot = this.selectedSlot();
    if (this.requiresSlotSelection() && !slot) {
      return [];
    }
    const slotId = slot?.slotTemplateId ?? null;
    const selectedDateKey = slot?.startAtIso ? this.slotDateKeyFromIso(slot.startAtIso) : this.selectedSlotDateKey() || null;
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + EventCheckoutPopupComponent.CHECKOUT_BASKET_TTL_MS).toISOString();
    const eventPricing = this.resolvePricing(dialog.record.pricing, dialog.record, slotId, slot);
    const selectedOptionalSubEvents = this.optionalSubEvents()
      .filter(subEvent => this.selectedOptionalSubEventIds.has(subEvent.id))
      .map(subEvent => ({
        subEvent,
        pricing: this.resolvePricing(subEvent.pricing, dialog.record, null, slot)
      }));
    const totalAmount = Math.round((
      eventPricing.amount
      + selectedOptionalSubEvents.reduce((sum, item) => sum + item.pricing.amount, 0)
    ) * 100) / 100;
    const state = this.currentCheckoutState(totalAmount);
    const items: ActivityContracts.EventCheckoutBasketItem[] = [
      {
        id: `event:${dialog.record.id}:${slot?.id ?? 'main'}`,
        kind: 'event',
        sourceId: dialog.record.id,
        slotSourceId: slot?.id ?? null,
        slotTemplateId: slot?.slotTemplateId ?? null,
        selectedDateKey,
        subEventId: null,
        resourceType: null,
        label: dialog.record.title,
        detail: slot?.timeframe || dialog.record.timeframe || 'Main event',
        amount: eventPricing.amount,
        currency: eventPricing.currency,
        quantity: 1,
        status: state,
        resultState: 'pending',
        pricingSummaryRows: eventPricing.rows,
        checkoutSessionId: this.checkoutSessionId,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        expiresAtIso
      }
    ];

    for (const { subEvent, pricing } of selectedOptionalSubEvents) {
      items.push({
        id: `subevent:${subEvent.id}:${slot?.id ?? 'main'}`,
        kind: 'sub_event',
        sourceId: dialog.record.id,
        slotSourceId: slot?.id ?? null,
        slotTemplateId: slot?.slotTemplateId ?? null,
        selectedDateKey,
        subEventId: subEvent.id,
        resourceType: null,
        label: subEvent.name,
        detail: subEvent.description || 'Optional sub event',
        amount: pricing.amount,
        currency: pricing.currency,
        quantity: 1,
        status: state,
        resultState: 'pending',
        pricingSummaryRows: pricing.rows,
        checkoutSessionId: this.checkoutSessionId,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        expiresAtIso
      });
    }
    return items;
  }

  private checkoutBasketPresentationItems(): readonly {
    id: string;
    title: string;
    meta: string;
    detail: string | null;
    amount: number;
    currency: string;
    quantity: number;
    status: string;
    pricingSummaryRows: readonly ActivityContracts.EventCheckoutPricingSummaryRow[];
  }[] {
    return this.checkoutBasketItems().map(item => ({
      id: item.id,
      title: item.label,
      meta: item.detail,
      detail: null,
      amount: item.amount,
      currency: item.currency,
      quantity: item.quantity,
      status: item.status,
      pricingSummaryRows: item.pricingSummaryRows
    }));
  }

  private checkoutBasketPricingSummaryRows(): ActivityContracts.EventCheckoutPricingSummaryRow[] {
    return (this.checkoutBasketSnapshot()?.pricingSummaryRows ?? []).map(row => ({ ...row }));
  }

  private checkoutBasketAddDisabled(): boolean {
    return !this.requiresSlotSelection()
      || this.availableSlots().length === 0
      || this.nextAvailableCheckoutBasketSlot() === null
      || this.busy
      || this.checkoutReviewBodyLoading();
  }

  private async addCheckoutBasketSlot(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.checkoutBasketAddDisabled()) {
      return;
    }
    const nextSlot = this.nextAvailableCheckoutBasketSlot();
    if (!nextSlot) {
      return;
    }
    this.selectedSlotSourceId = nextSlot.id;
    this.selectedSlotDateValue = this.slotDateValueFromIso(nextSlot.startAtIso);
    const current = this.activeCheckoutBasketItems();
    const nextItems = [
      ...current,
      ...this.buildBasketItemsFromCurrentSelection().filter(item => !current.some(existing => existing.id === item.id))
    ];
    this.resetCheckoutSubmissionForEdit();
    this.checkoutBasket = this.buildRuntimeBasketFromItems(nextItems);
    this.busy = true;
    this.checkoutBusyActionId = null;
    this.errorMessage = '';
    try {
      await this.persistCheckoutDraft(true, null, 'draft');
    } catch (error) {
      this.errorMessage = this.resolveErrorMessage(error, 'Unable to update checkout basket.');
    } finally {
      this.busy = false;
      this.checkoutBusyActionId = null;
    }
  }

  private nextAvailableCheckoutBasketSlot(): ContractTypes.EventSlotOccurrenceDTO | null {
    const selectedSlotIds = new Set(
      this.activeCheckoutBasketItems()
        .map(item => item.slotSourceId?.trim() ?? '')
        .filter(Boolean)
    );
    return [...this.filteredSlots(), ...this.availableSlots()]
      .find(slot => !selectedSlotIds.has(slot.id)) ?? null;
  }

  private onCheckoutBasketItemMenuSelect(
    item: { id: string },
    event: AppMenuItemSelectEvent<string>
  ): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id === 'remove') {
      this.requestRemoveCheckoutBasketItem(item.id);
    }
  }

  private requestRemoveCheckoutBasketItem(itemId: string): void {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return;
    }
    const item = this.activeCheckoutBasketItems().find(current => current.id === normalizedItemId);
    if (!item) {
      return;
    }
    this.confirmationDialogStore.open({
      title: 'Remove checkout item?',
      message: item.label,
      warningMessage: 'The item will be removed from the basket and from the runtime price summary.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Eltávolítás',
      busyConfirmLabel: 'Eltávolítás...',
      confirmTone: 'danger',
      confirmPalette: 'danger',
      failureMessage: 'Unable to remove this checkout item.',
      onConfirm: async () => this.removeCheckoutBasketItem(normalizedItemId)
    });
  }

  private async removeCheckoutBasketItem(itemId: string): Promise<void> {
    const normalizedItemId = itemId.trim();
    const dialog = this.dialog();
    if (!dialog || !normalizedItemId) {
      return;
    }
    const remainingItems = this.activeCheckoutBasketItems()
      .filter(item => item.id !== normalizedItemId);
    this.resetCheckoutSubmissionForEdit();
    this.checkoutBasket = this.buildRuntimeBasketFromItems(remainingItems);
    this.selectedSlotSourceId = remainingItems[0]?.slotSourceId ?? null;
    const savedBasket = await this.eventsService.saveCheckoutBasket(this.buildCheckoutRequest({
      checkoutState: 'draft',
      pendingReason: null
    }));
    this.checkoutBasket = savedBasket ?? this.checkoutBasket;
    if (remainingItems.length === 0) {
      this.selectedSlotSourceId = null;
      this.clearCheckoutDraft();
      return;
    }
    await this.persistCheckoutDraft(false, null, 'draft');
  }

  private buildRuntimeBasketFromCurrentSelection(): ActivityContracts.EventCheckoutBasket | null {
    const dialog = this.dialog();
    if (!dialog) {
      return null;
    }
    const items = this.buildBasketItemsFromCurrentSelection();
    if (items.length === 0) {
      return null;
    }
    const lineItems = this.lineItemsFromBasketItems(items);
    const totalAmount = this.totalAmountFromLineItems(lineItems);
    const currency = items.find(item => item.currency)?.currency ?? dialog.record.pricing?.currency ?? 'USD';
    const state = this.currentCheckoutState(totalAmount);
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      status: state,
      items: items.map(item => ({ ...item, status: state })),
      pricingSummaryRows: this.aggregatePricingSummaryRows(items.flatMap(item => item.pricingSummaryRows ?? []), currency),
      lineItems,
      totalAmount,
      currency,
      slotSourceId: items[0]?.slotSourceId ?? null,
      selectedDateKey: items[0]?.selectedDateKey ?? null,
      checkoutSessionId: this.checkoutSessionId,
      expiresAtIso: items.find(item => item.expiresAtIso)?.expiresAtIso ?? null
    };
  }

  private buildRuntimeBasketFromItems(
    items: readonly ActivityContracts.EventCheckoutBasketItem[]
  ): ActivityContracts.EventCheckoutBasket | null {
    const dialog = this.dialog();
    if (!dialog || items.length === 0) {
      return null;
    }
    const lineItems = this.lineItemsFromBasketItems(items);
    const totalAmount = this.totalAmountFromLineItems(lineItems);
    const currency = items.find(item => item.currency)?.currency ?? dialog.record.pricing?.currency ?? 'USD';
    const state = this.currentCheckoutState(totalAmount);
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      status: state,
      items: items.map(item => ({ ...item, status: state })),
      pricingSummaryRows: this.aggregatePricingSummaryRows(items.flatMap(item => item.pricingSummaryRows ?? []), currency),
      lineItems,
      totalAmount,
      currency,
      slotSourceId: items[0]?.slotSourceId ?? null,
      selectedDateKey: items[0]?.selectedDateKey ?? null,
      checkoutSessionId: this.checkoutSessionId,
      expiresAtIso: items.find(item => item.expiresAtIso)?.expiresAtIso ?? null
    };
  }

  private lineItemsFromBasketItems(
    items: readonly ActivityContracts.EventCheckoutBasketItem[]
  ): ActivityContracts.EventCheckoutLineItem[] {
    return items.map(item => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      amount: Math.round((Number(item.amount) || 0) * Math.max(1, Math.trunc(Number(item.quantity) || 1)) * 100) / 100,
      currency: item.currency
    }));
  }

  private totalAmountFromLineItems(items: readonly ActivityContracts.EventCheckoutLineItem[]): number {
    return Math.round(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
  }

  private aggregatePricingSummaryRows(
    rows: readonly ActivityContracts.EventCheckoutPricingSummaryRow[],
    fallbackCurrency: string
  ): ActivityContracts.EventCheckoutPricingSummaryRow[] {
    const grouped = new Map<string, ActivityContracts.EventCheckoutPricingSummaryRow>();
    for (const row of rows) {
      const label = `${row.label ?? ''}`.trim();
      if (!label) {
        continue;
      }
      const detail = `${row.detail ?? ''}`.trim();
      const amount = Number.isFinite(row.amount) ? Number(row.amount) : null;
      const currency = `${row.currency ?? fallbackCurrency ?? 'USD'}`.trim() || 'USD';
      const key = `${row.key || label}::${detail}::${amount ?? 'none'}::${currency}`;
      const multiplier = Math.max(1, Math.trunc(Number(row.multiplier) || 1));
      const existing = grouped.get(key);
      if (existing) {
        const nextMultiplier = Math.max(1, Math.trunc(Number(existing.multiplier) || 1)) + multiplier;
        grouped.set(key, {
          ...existing,
          multiplier: nextMultiplier,
          amount: existing.amount !== null && amount !== null
            ? Math.round((Number(existing.amount) + (amount * multiplier)) * 100) / 100
            : existing.amount ?? amount
        });
        continue;
      }
      grouped.set(key, {
        key,
        label,
        detail: detail || null,
        amount: amount === null ? null : Math.round(amount * multiplier * 100) / 100,
        currency,
        multiplier
      });
    }
    return [...grouped.values()];
  }

  protected totalAmount(): number {
    return this.checkoutBasketSnapshot()?.totalAmount
      ?? Math.round(this.lineItems().reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
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
    return this.checkoutBasketSnapshot()?.currency
      ?? this.lineItems().find(item => item.currency)?.currency
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
    if (this.checkoutDecisionPending()) {
      return this.checkoutDecisionPendingReason() === 'waitlist' ? 'Várólistán' : 'Jóváhagyásra vár';
    }
    if (this.paymentStep) {
      return 'Fizetés';
    }
    return 'Megerősítés';
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
        ? 'Fizetés...'
        : 'Megerősítés...';
    }
    return dialog.busyConfirmLabel;
  }

  private checkoutActionsDisabled(): boolean {
    return this.busy || this.dialog()?.loading === true || this.checkoutReviewBodyLoading();
  }

  private checkoutActionProgressState(actionId: string): 'loading' | null {
    return this.checkoutBusyActionId === actionId ? 'loading' : null;
  }

  protected checkoutFooterMenuItems(): readonly AppMenuItem<string>[] {
    const items: AppMenuItem<string>[] = [
      {
        id: 'checkout-secondary',
        label: () => this.paymentStep ? 'Vissza' : 'Mégse',
        layout: 'action',
        palette: 'neutral',
        disabled: () => this.checkoutActionsDisabled(),
        ariaLabel: () => this.paymentStep ? 'Vissza' : 'Mégse'
      }
    ];
    if (this.showCheckoutLifecycleCancel()) {
      items.push({
        id: 'checkout-cancel-lifecycle',
        label: () => this.checkoutLifecycleCancelLabel(),
        layout: 'action',
        palette: 'danger',
        disabled: () => this.checkoutActionsDisabled(),
        ariaLabel: () => this.checkoutLifecycleCancelLabel(),
        progress: {
          state: () => this.checkoutActionProgressState('checkout-cancel-lifecycle'),
          shape: 'button'
        }
      });
    }
    items.push(
      {
        id: 'checkout-confirm',
        label: () => this.checkoutBusyActionId === 'checkout-confirm' ? this.busyLabel() : this.continueLabel(),
        layout: 'action',
        palette: this.checkoutConfirmPalette(),
        disabled: () => !this.canContinue() || this.checkoutActionsDisabled(),
        ariaLabel: () => this.checkoutBusyActionId === 'checkout-confirm' ? this.busyLabel() : this.continueLabel(),
        progress: {
          state: () => this.checkoutBusyActionId === 'checkout-confirm' ? 'loading' : (!this.busy && this.errorMessage ? 'error' : null),
          shape: 'button'
        }
      }
    );
    return items;
  }

  private checkoutConfirmPalette(): AppMenuPalette {
    if (!this.checkoutDecisionPending()) {
      return 'blue';
    }
    return this.checkoutDecisionPendingReason() === 'waitlist' ? 'amber' : 'orange';
  }

  private showCheckoutLifecycleCancel(): boolean {
    if (this.activeCheckoutBasketItems().some(item => item.status === 'pay')) {
      return false;
    }
    return Boolean(this.checkoutSessionId)
      || this.checkoutDecisionPending()
      || this.checkoutBasketItems().length > 0
      || this.totalAmount() > 0;
  }

  private checkoutLifecycleCancelLabel(): string {
    if (this.checkoutDecisionPendingReason() === 'approval') {
      return 'Cancel request';
    }
    if (this.checkoutDecisionPendingReason() === 'waitlist') {
      return 'Leave waitlist';
    }
    if (this.paymentStep || this.checkoutSessionId) {
      return 'Cancel payment';
    }
    return 'Cancel checkout';
  }

  private requestCancelCheckoutLifecycle(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.busy || !this.showCheckoutLifecycleCancel()) {
      return;
    }
    this.confirmationDialogStore.open({
      title: `${this.checkoutLifecycleCancelLabel()}?`,
      message: this.dialog()?.record.title ?? 'Checkout',
      warningMessage: 'The current checkout lifecycle will be closed and kept as a cancelled audit record.',
      cancelLabel: 'Back',
      confirmLabel: this.checkoutLifecycleCancelLabel(),
      busyConfirmLabel: 'Cancelling...',
      confirmTone: 'danger',
      confirmPalette: 'danger',
      failureMessage: 'Unable to cancel this checkout.',
      onConfirm: async () => this.cancelCheckoutLifecycle()
    });
  }

  private async cancelCheckoutLifecycle(): Promise<void> {
    const dialog = this.dialog();
    if (!dialog || this.activeCheckoutBasketItems().some(item => item.status === 'pay')) {
      return;
    }
    const basket = this.checkoutBasketSnapshot();
    if (basket?.items?.length) {
      if (this.runtimeCheckoutBasketExists()) {
        await this.eventsService.updateCheckoutBasketState(this.buildCheckoutStateChangeRequest(
          'cancelled',
          'succeeded',
          null,
          this.checkoutSessionId
        ));
      } else {
        await this.eventsService.saveCheckoutBasket(this.buildCheckoutRequest({
          checkoutState: 'cancelled',
          resultState: 'succeeded',
          pendingReason: null
        }));
      }
    }
    this.checkoutDraftStore.clear(dialog.userId, dialog.record.id);
    this.paymentStep = false;
    this.checkoutSessionId = null;
    this.checkoutBasket = null;
    this.closeCheckoutDialog();
  }

  private async persistCheckoutLifecycleState(
    checkoutState: ActivityContracts.EventCheckoutState,
    resultState: ActivityContracts.EventCheckoutResultState,
    pendingReason: AppConstants.ActivityPendingReason = null
  ): Promise<void> {
    const basket = this.checkoutBasketSnapshot();
    if (!basket?.items?.length) {
      return;
    }
    if (this.runtimeCheckoutBasketExists()) {
      await this.eventsService.updateCheckoutBasketState(this.buildCheckoutStateChangeRequest(
        checkoutState,
        resultState,
        pendingReason,
        this.checkoutSessionId
      ));
      return;
    }
    await this.eventsService.saveCheckoutBasket(this.buildCheckoutRequest({
      checkoutState,
      resultState,
      pendingReason
    }));
  }

  private async markCheckoutFailed(): Promise<void> {
    try {
      await this.persistCheckoutLifecycleState(
        this.currentCheckoutState(this.totalAmount()),
        'failed',
        this.checkoutDecisionPendingReason()
      );
    } catch {
      // Keep the local draft visible; the next successful sync can repair the runtime state.
    }
  }

  private successfulCheckoutLifecycleState(paymentSessionId: string | null): ActivityContracts.EventCheckoutState {
    if (paymentSessionId || this.checkoutSessionId || this.totalAmount() > 0) {
      return 'pay';
    }
    if (this.isApprovedAfterOwnerReview()) {
      return 'approved';
    }
    return 'confirmed';
  }

  private resetCheckoutSubmissionForEdit(): void {
    const dialog = this.dialog();
    if (this.activeCheckoutBasketItems().some(item => item.status === 'pay')) {
      return;
    }
    this.paymentStep = false;
    this.checkoutSessionId = null;
    if (dialog) {
      this.checkoutDraftStore.clear(dialog.userId, dialog.record.id);
    }
    if (!this.checkoutBasket) {
      return;
    }
    this.checkoutBasket = {
      ...this.checkoutBasket,
      status: 'draft',
      checkoutSessionId: null,
      items: this.checkoutBasket.items.map(item => this.isInactiveCheckoutResultState(item.resultState)
        ? item
        : {
            ...item,
            status: 'draft',
            resultState: 'pending',
            checkoutSessionId: null
          })
    };
  }

  protected onCheckoutActionMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id === 'checkout-secondary') {
      if (this.paymentStep) {
        this.backToDetails(event.sourceEvent);
      } else {
        this.close(event.sourceEvent);
      }
      return;
    }
    if (event.id === 'checkout-cancel-lifecycle') {
      this.requestCancelCheckoutLifecycle(event.sourceEvent);
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
    if (this.busy || this.dialog()?.loading || this.checkoutReviewBodyLoading()) {
      return false;
    }
    if (this.checkoutDecisionPending()) {
      return false;
    }
    if (this.requiresSlotSelection() && !this.selectedSlot() && this.checkoutBasketItems().length === 0) {
      return false;
    }
    return true;
  }

  private currentCheckoutState(
    _totalAmount?: number,
    pendingReasonOverride?: AppConstants.ActivityPendingReason
  ): ActivityContracts.EventCheckoutState {
    if (this.activeCheckoutBasketItems().some(item => item.status === 'pay')) {
      return 'pay';
    }
    if (this.activeCheckoutBasketItems().some(item => item.status === 'waiting')) {
      return 'waiting';
    }
    const pendingReason = pendingReasonOverride === undefined
      ? this.checkoutDecisionPendingReason()
      : pendingReasonOverride;
    if (pendingReason === 'approval') {
      return 'approval-pending';
    }
    if (pendingReason === 'waitlist') {
      return 'waiting';
    }
    if (this.isApprovedAfterOwnerReview()) {
      return 'approved';
    }
    if (this.paymentStep || this.checkoutSessionId) {
      return 'confirmed';
    }
    return 'draft';
  }

  private isApprovedAfterOwnerReview(): boolean {
    const dialog = this.dialog();
    if (!dialog?.approvalGranted) {
      return false;
    }
    const draft = this.checkoutDraftStore.read(dialog.userId, dialog.record.id);
    return draft?.pendingReason === 'approval'
      || draft?.checkoutState === 'approval-pending'
      || draft?.checkoutState === 'approved'
      || this.checkoutBasket?.status === 'approval-pending'
      || this.checkoutBasket?.status === 'approved';
  }

  protected shouldAwaitApprovalBeforePayment(): boolean {
    return this.shouldAwaitApprovalBeforePaymentForAmount(this.totalAmount());
  }

  private shouldAwaitApprovalBeforePaymentForAmount(_totalAmount: number): boolean {
    const dialog = this.dialog();
    if (!dialog) {
      return false;
    }
    return dialog.requiresApprovalBeforePayment && !dialog.approvalGranted;
  }

  private checkoutDecisionPending(): boolean {
    return this.checkoutDecisionPendingReason() !== null;
  }

  private pendingReasonForJoinRequest(): AppConstants.ActivityPendingReason {
    if (this.isWaitingListSelection()) {
      return 'waitlist';
    }
    return this.shouldAwaitApprovalBeforePayment() ? 'approval' : null;
  }

  private checkoutDecisionPendingReason(): AppConstants.ActivityPendingReason {
    const dialog = this.dialog();
    if (!dialog || dialog.approvalGranted) {
      return null;
    }
    const draft = this.checkoutDraftStore.read(dialog.userId, dialog.record.id);
    if (draft?.pendingReason === 'approval' || draft?.pendingReason === 'waitlist') {
      return draft.pendingReason;
    }
    if (draft?.checkoutState === 'waiting' || this.checkoutBasket?.status === 'waiting') {
      return 'waitlist';
    }
    if (this.checkoutBasket?.status === 'approval-pending') {
      return 'approval';
    }
    return null;
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
    let keepCheckoutReviewOpen = false;
    if (!this.paymentStep && (this.shouldAwaitApprovalBeforePayment() || this.isWaitingListSelection())) {
      this.busy = true;
      this.checkoutBusyActionId = 'checkout-confirm';
      this.errorMessage = '';
      try {
        const pendingReason = this.pendingReasonForJoinRequest();
        const checkoutState: ActivityContracts.EventCheckoutState = pendingReason === 'approval'
          ? 'approval-pending'
          : pendingReason === 'waitlist'
            ? 'waiting'
          : 'confirmed';
        await dialog.onSubmit(this.buildSelection(null, false, {
          checkoutState,
          pendingReason,
          includeBasketPayload: !this.runtimeCheckoutBasketExists()
        }));
        await this.persistCheckoutDraft(false, pendingReason, checkoutState);
        keepCheckoutReviewOpen = pendingReason === 'waitlist';
        if (!keepCheckoutReviewOpen) {
          this.closeCheckoutDialog();
        }
      } catch (error) {
        this.errorMessage = this.resolveErrorMessage(error, dialog.failureMessage);
      } finally {
        this.busy = false;
        this.checkoutBusyActionId = null;
        if (keepCheckoutReviewOpen && this.dialog()?.id === dialog.id) {
          this.paymentStep = false;
          this.openCheckoutReviewEditorShell(dialog);
        }
      }
      return;
    }
    if (!this.paymentStep && this.totalAmount() > 0) {
      this.busy = true;
      this.checkoutBusyActionId = 'checkout-confirm';
      this.errorMessage = '';
      try {
        this.checkoutSessionId = null;
        await this.persistCheckoutDraft(true, null, 'confirmed');
        this.paymentStep = true;
        this.openCheckoutReviewEditorShell(dialog);
      } catch (error) {
        this.errorMessage = this.resolveErrorMessage(error, dialog.failureMessage);
      } finally {
        this.busy = false;
        this.checkoutBusyActionId = null;
      }
      return;
    }

    this.busy = true;
    this.checkoutBusyActionId = 'checkout-confirm';
    this.errorMessage = '';
    try {
      const joinResult = await this.eventsService.payEventCheckout(this.buildCheckoutStateChangeRequest(
        'pay',
        'succeeded',
        null
      ));
      if (!joinResult || joinResult.membershipStatus !== 'accepted') {
        throw new Error(dialog.failureMessage);
      }
      this.checkoutSessionId = joinResult.paymentSessionId ?? null;
      this.clearCheckoutDraft();
      this.closeCheckoutDialog();
    } catch (error) {
      this.errorMessage = this.resolveErrorMessage(error, dialog.failureMessage);
    } finally {
      this.busy = false;
      this.checkoutBusyActionId = null;
    }
  }

  protected backToDetails(event?: Event): void {
    event?.stopPropagation();
    if (this.busy) {
      return;
    }
    this.releaseUnpaidPaymentSession();
    const dialog = this.dialog();
    if (dialog) {
      this.openCheckoutReviewEditorShell(dialog);
    }
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
    this.paymentStep = this.shouldOpenPaymentStepFromDraft(draft);
    this.checkoutSessionId = draft?.checkoutSessionId ?? null;
    this.checkoutBasket = draft?.basketItems?.length
      ? {
        userId: dialog.userId,
        sourceId: dialog.record.id,
        status: draft.checkoutState,
        items: draft.basketItems,
        pricingSummaryRows: draft.pricingSummaryRows,
        lineItems: draft.lineItems,
        totalAmount: draft.totalAmount,
        currency: draft.currency,
        slotSourceId: draft.slotSourceId,
        selectedDateKey: draft.selectedDateKey,
        checkoutSessionId: draft.checkoutSessionId,
        expiresAtIso: draft.expiresAtIso
      }
      : null;
    this.busy = false;
    this.checkoutBusyActionId = null;
    this.errorMessage = '';
  }

  private async loadRuntimeCheckoutBasket(dialog: EventCheckoutDialogState): Promise<void> {
    let queriedBasket: ActivityContracts.EventCheckoutBasket | null = null;
    try {
      queriedBasket = await this.eventsService.loadCheckoutBasketByEvent(dialog.userId, dialog.record.id);
    } catch {
      queriedBasket = null;
    }
    const basket = queriedBasket ?? this.checkoutBasket;
    this.checkoutBasket = basket;
    if (!basket || basket.items.length === 0) {
      return;
    }
    const firstSlotSourceId = basket.items.find(item => item.slotSourceId?.trim())?.slotSourceId?.trim() ?? null;
    const validSlotIds = new Set(this.availableSlots().map(item => item.id));
    this.selectedSlotSourceId = firstSlotSourceId && validSlotIds.has(firstSlotSourceId)
      ? firstSlotSourceId
      : this.selectedSlotSourceId;
    const selectedDateKey = basket.selectedDateKey
      ?? basket.items.find(item => item.selectedDateKey?.trim())?.selectedDateKey
      ?? null;
    if (selectedDateKey) {
      this.selectedSlotDateValue = this.slotDateValueFromKey(selectedDateKey) ?? this.selectedSlotDateValue;
    }
    this.checkoutSessionId = basket.checkoutSessionId ?? this.checkoutSessionId;
    this.paymentStep = this.shouldOpenPaymentStepFromBasket(basket);
  }

  private shouldOpenPaymentStepFromDraft(draft: EventCheckoutDraft | null): boolean {
    if (!draft) {
      return false;
    }
    if (Boolean(draft.checkoutSessionId?.trim())) {
      return true;
    }
    return draft.checkoutState === 'confirmed'
      && !draft.pendingReason
      && Math.max(0, Number(draft.totalAmount) || 0) > 0;
  }

  private shouldOpenPaymentStepFromBasket(basket: ActivityContracts.EventCheckoutBasket | null): boolean {
    if (!basket) {
      return this.paymentStep;
    }
    if (Boolean(basket.checkoutSessionId?.trim())) {
      return true;
    }
    return basket.status === 'confirmed'
      && Math.max(0, Number(basket.totalAmount) || 0) > 0;
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
    this.checkoutBasket = null;
    this.busy = false;
    this.checkoutBusyActionId = null;
    this.errorMessage = '';
  }

  private buildSelection(
    paymentSessionId: string | null,
    bookingConfirmed = true,
    options: {
      checkoutState?: ActivityContracts.EventCheckoutState;
      resultState?: ActivityContracts.EventCheckoutResultState;
      pendingReason?: AppConstants.ActivityPendingReason;
      includeBasketPayload?: boolean;
    } = {}
  ): ActivityContracts.EventCheckoutSelection {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    const pendingReason = options.pendingReason === undefined
      ? (bookingConfirmed === false ? this.pendingReasonForJoinRequest() : null)
      : options.pendingReason;
    const checkoutState = options.checkoutState
      ?? this.currentCheckoutState(this.totalAmount(), pendingReason);
    const includeBasketPayload = options.includeBasketPayload !== false;
    return {
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: [],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      ...(includeBasketPayload ? {
        basketItems: this.checkoutBasketItems(checkoutState, options.resultState),
        pricingSummaryRows: this.checkoutBasketPricingSummaryRows()
      } : {}),
      checkoutState,
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      paymentSessionId,
      bookingConfirmed,
      pendingReason
    };
  }

  private buildCheckoutRequest(options: {
    checkoutState?: ActivityContracts.EventCheckoutState;
    resultState?: ActivityContracts.EventCheckoutResultState;
    pendingReason?: AppConstants.ActivityPendingReason;
  } = {}): ActivityContracts.EventCheckoutRequest {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    const pendingReason = options.pendingReason === undefined
      ? this.checkoutDecisionPendingReason()
      : options.pendingReason;
    const checkoutState = options.checkoutState
      ?? this.currentCheckoutState(this.totalAmount(), pendingReason);
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      slotSourceId: this.selectedSlotSourceId,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      assetSelections: [],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      basketItems: this.checkoutBasketItems(checkoutState, options.resultState),
      pricingSummaryRows: this.checkoutBasketPricingSummaryRows(),
      checkoutState,
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      pendingReason
    };
  }

  private buildCheckoutStateChangeRequest(
    checkoutState: ActivityContracts.EventCheckoutState,
    resultState: ActivityContracts.EventCheckoutResultState | null = null,
    pendingReason: AppConstants.ActivityPendingReason = null,
    checkoutSessionId: string | null = null
  ): ActivityContracts.EventCheckoutStateChangeRequest {
    const dialog = this.dialog();
    if (!dialog) {
      throw new Error('Checkout session is not available.');
    }
    return {
      userId: dialog.userId,
      sourceId: dialog.record.id,
      checkoutState,
      resultState,
      pendingReason,
      checkoutSessionId
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
        currency: normalized.currency || 'USD',
        rows: []
      };
    }

    const currency = normalized.currency || 'USD';
    const previewBase = normalized.slotPricingEnabled && slotId
      ? normalized.slotOverrides.find(item => item.slotId === slotId)?.price ?? normalized.basePrice
      : normalized.basePrice;
    const rows: ActivityContracts.EventCheckoutPricingSummaryRow[] = [{
      key: normalized.slotPricingEnabled && slotId ? `base:${slotId}` : 'base',
      label: normalized.slotPricingEnabled && slotId ? 'Slot base price' : 'Base price',
      detail: null,
      amount: previewBase,
      currency,
      multiplier: 1
    }];
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
        const previousPrice = nextPrice;
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
        rows.push({
          key: `demand:${rule.id}`,
          label: 'Demand pricing',
          detail: this.describePricingAction(rule.action),
          amount: Math.round((nextPrice - previousPrice) * 100) / 100,
          currency,
          multiplier: 1
        });
      }
    }
    if ((normalized.mode === 'time-based' || normalized.mode === 'hybrid') && normalized.timeRulesEnabled) {
      for (const rule of normalized.timeRules) {
        if (!this.matchesTimeRule(rule, hoursUntilStart, slotId, slot?.startAtIso ?? record.startAtIso)) {
          continue;
        }
        const previousPrice = nextPrice;
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
        rows.push({
          key: `time:${rule.id}`,
          label: 'Time pricing',
          detail: this.describePricingAction(rule.action),
          amount: Math.round((nextPrice - previousPrice) * 100) / 100,
          currency,
          multiplier: 1
        });
      }
    }

    if (normalized.minPrice !== null) {
      const previousPrice = nextPrice;
      nextPrice = Math.max(normalized.minPrice, nextPrice);
      if (nextPrice !== previousPrice) {
        rows.push({
          key: 'min-price',
          label: 'Minimum price',
          detail: null,
          amount: Math.round((nextPrice - previousPrice) * 100) / 100,
          currency,
          multiplier: 1
        });
      }
    }
    if (normalized.maxPrice !== null) {
      const previousPrice = nextPrice;
      nextPrice = Math.min(normalized.maxPrice, nextPrice);
      if (nextPrice !== previousPrice) {
        rows.push({
          key: 'max-price',
          label: 'Maximum price',
          detail: null,
          amount: Math.round((nextPrice - previousPrice) * 100) / 100,
          currency,
          multiplier: 1
        });
      }
    }

    const roundedPrice = this.applyRounding(nextPrice, normalized.rounding);
    if (roundedPrice !== nextPrice) {
      rows.push({
        key: 'rounding',
        label: 'Rounding',
        detail: null,
        amount: Math.round((roundedPrice - nextPrice) * 100) / 100,
        currency,
        multiplier: 1
      });
    }
    return {
      amount: roundedPrice,
      currency,
      rows
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

  private describePricingAction(action: ContractTypes.PricingAction): string {
    const value = Number(action.value) || 0;
    switch (action.kind) {
      case 'set_exact_price':
        return `Set to ${value}`;
      case 'increase_amount':
        return `+${value}`;
      case 'decrease_amount':
        return `-${value}`;
      case 'decrease_percent':
        return `-${value}%`;
      default:
        return `+${value}%`;
    }
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
      await this.persistCheckoutDraft(false);
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

  private async persistCheckoutDraft(
    syncRuntimeBasket = true,
    pendingReasonOverride: AppConstants.ActivityPendingReason | undefined = undefined,
    checkoutStateOverride?: ActivityContracts.EventCheckoutState
  ): Promise<void> {
    const dialog = this.dialog();
    const pendingReason = pendingReasonOverride === undefined
      ? this.checkoutDecisionPendingReason()
      : pendingReasonOverride;
    const checkoutState = checkoutStateOverride ?? this.currentCheckoutState(this.totalAmount(), pendingReason);
    const basketItems = this.checkoutBasketItems(checkoutState);
    if (!dialog || (basketItems.length === 0 && this.totalAmount() <= 0 && !pendingReason)) {
      return;
    }
    const basket = this.checkoutBasketSnapshot();
    this.checkoutDraftStore.save({
      userId: dialog.userId,
      sourceId: dialog.record.id,
      eventTitle: dialog.record.title,
      eventTimeframe: dialog.record.timeframe,
      slotSourceId: this.selectedSlotSourceId,
      selectedDateKey: this.selectedSlotDateValue ? this.slotDateKeyFromDate(this.selectedSlotDateValue) : null,
      optionalSubEventIds: [...this.selectedOptionalSubEventIds],
      acceptedPolicyIds: [...this.acceptedPolicyIds],
      basketItems,
      pricingSummaryRows: this.checkoutBasketPricingSummaryRows(),
      checkoutState,
      lineItems: this.lineItems(),
      totalAmount: this.totalAmount(),
      currency: this.currency(),
      checkoutSessionId: this.checkoutSessionId,
      expiresAtIso: basket?.expiresAtIso ?? null,
      pendingReason,
      updatedAtMs: Date.now()
    });
    if (syncRuntimeBasket) {
      await this.syncRuntimeCheckoutBasket(checkoutState, pendingReason);
    }
  }

  private async syncRuntimeCheckoutBasket(
    checkoutStateOverride?: ActivityContracts.EventCheckoutState,
    pendingReasonOverride: AppConstants.ActivityPendingReason | undefined = undefined
  ): Promise<void> {
    const dialog = this.dialog();
    const basketItems = this.checkoutBasketItems();
    if (!dialog || basketItems.length === 0) {
      return;
    }
    try {
      const shouldMutateStoredBasket = this.runtimeCheckoutBasketExists()
        && checkoutStateOverride != null
        && checkoutStateOverride !== 'draft';
      const basket = shouldMutateStoredBasket
        ? await this.eventsService.updateCheckoutBasketState(this.buildCheckoutStateChangeRequest(
            checkoutStateOverride,
            null,
            pendingReasonOverride === undefined ? null : pendingReasonOverride,
            this.checkoutSessionId
          ))
        : await this.eventsService.saveCheckoutBasket(this.buildCheckoutRequest({
            checkoutState: checkoutStateOverride,
            pendingReason: pendingReasonOverride
          }));
      if (basket) {
        this.checkoutBasket = basket;
      }
    } catch {
      // Local draft remains the immediate source of truth if runtime basket sync fails.
    }
  }

  private runtimeCheckoutBasketExists(): boolean {
    return (this.checkoutBasket?.items ?? []).some(item =>
      item.resultState !== 'deleted'
      && item.resultState !== 'succeeded'
      && Boolean(item.id?.trim())
    );
  }

  private clearCheckoutDraft(): void {
    const dialog = this.dialog();
    if (!dialog) {
      return;
    }
    this.checkoutDraftStore.clear(dialog.userId, dialog.record.id);
    this.checkoutSessionId = null;
    this.checkoutBasket = null;
  }

  private releaseUnpaidPaymentSession(): void {
    const paidItems = this.activeCheckoutBasketItems().some(item => item.status === 'pay');
    if (paidItems) {
      return;
    }
    const hadSession = this.paymentStep || Boolean(this.checkoutSessionId);
    this.paymentStep = false;
    this.checkoutSessionId = null;
    if (!hadSession || !this.checkoutBasket) {
      return;
    }
    const nextStatus = this.currentCheckoutState(this.checkoutBasket.totalAmount);
    this.checkoutBasket = {
      ...this.checkoutBasket,
      status: nextStatus,
      checkoutSessionId: null,
      items: this.checkoutBasket.items.map(item => ({
        ...item,
        status: nextStatus,
        checkoutSessionId: null
      }))
    };
  }

  private invalidateCheckoutDraft(): void {
    this.checkoutBasket = null;
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
