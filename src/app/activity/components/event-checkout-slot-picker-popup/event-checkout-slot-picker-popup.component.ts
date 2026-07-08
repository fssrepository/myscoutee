import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { from, of } from 'rxjs';

import { AppUtils } from '../../../shared/app-utils';
import { PricingBuilder } from '../../../shared/core/base/builders';
import {
  EventsService,
  type EventCheckoutBasket,
  type EventCheckoutBasketItem,
  type EventCheckoutLineItem,
  type EventCheckoutPricingSummaryRow,
  type EventCheckoutSlot,
  type EventCheckoutSlotDay,
  type EventCheckoutState,
  type PageResult,
  type SubEventDTO
} from '../../../shared/core';
import {
  DateInputComponent,
  DialogStore,
  EventCheckoutDraftStore,
  EventCheckoutSlotPickerStore,
  IndicatorComponent,
  PopupComponent,
  SmartListComponent,
  TextCardComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type DateInputModel,
  type DateInputValue,
  type ListQuery,
  type PopupActionEvent,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SmartListCalendarCounter,
  type SmartListCalendarDateRange,
  type SmartListCalendarDay,
  type SmartListConfig,
  type SmartListItemSelectEvent
} from '../../../shared/ui';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';

interface SlotPickerFilters {
  dateKey: string;
  basketOnly: boolean;
}

interface SlotPickerMonthFilters {
  anchor: string;
}

interface SlotSelection {
  slot: EventCheckoutSlot;
  optionalSubEventIds: string[];
}

type SlotMenuContext =
  | { menu: 'slot'; slot: EventCheckoutSlot }
  | { menu: 'basket'; itemId?: string | null };

@Component({
  selector: 'app-event-checkout-slot-picker-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    DateInputComponent,
    IndicatorComponent,
    PopupComponent,
    SmartListComponent,
    TextCardComponent
  ],
  templateUrl: './event-checkout-slot-picker-popup.component.html',
  styleUrl: './event-checkout-slot-picker-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventCheckoutSlotPickerPopupComponent {
  private static readonly CHECKOUT_BASKET_TTL_MS = 20 * 60 * 1000;

  private readonly store = inject(EventCheckoutSlotPickerStore);
  private readonly eventsService = inject(EventsService);
  private readonly checkoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly cdr = inject(ChangeDetectorRef);

  protected selectedDateKey = this.todayKey();
  protected basketOnly = false;
  protected monthOverlayOpen = false;
  protected saving = false;
  protected errorMessage = '';
  protected monthDays: EventCheckoutSlotDay[] = [];
  protected monthAnchor = this.monthStart(this.selectedDateKey);
  protected monthListQuery: Partial<ListQuery<SlotPickerMonthFilters>> = this.buildMonthListQuery();
  private readonly selectionsBySlotId = new Map<string, SlotSelection>();

  protected slotListQuery: Partial<ListQuery<SlotPickerFilters>> = this.buildSlotListQuery();

  protected readonly dateInputModel: DateInputModel = {
    mode: 'single',
    precision: 'date',
    valueFormat: 'iso-date',
    field: {
      placeholder: 'YYYY/MM/DD'
    }
  };

  protected readonly slotListConfig: SmartListConfig<EventCheckoutSlot, SlotPickerFilters> = {
    pageSize: 15,
    initialPageSize: 15,
    defaultView: 'list',
    presentation: 'list',
    listLayout: 'card-grid',
    desktopColumns: 3,
    emptyLabel: () => this.basketOnly ? 'No selected slots yet.' : 'No available slots for this date.',
    trackBy: (_index, item) => item.id,
    groupBy: item => this.formatDateGroup(item.startAtIso),
    showGroupMarker: ({ groupIndex }) => groupIndex > 0,
    containerClass: {
      'event-checkout-slot-picker-list': true
    }
  };

  protected readonly monthListConfig: SmartListConfig<EventCheckoutSlotDay, SlotPickerMonthFilters> = {
    pageSize: 42,
    initialPageSize: 42,
    defaultView: 'month',
    views: [
      { key: 'month', label: 'Month', mode: 'month', pageSize: 42 }
    ],
    calendarVariant: 'counter',
    calendar: {
      weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      anchorRadius: 0,
      counterGranularity: 'day',
      initialAnchor: query => query.filters?.anchor ?? this.monthAnchor,
      resolveDateRange: item => this.monthDateRange(item),
      dayCounter: day => this.monthDayCounter(day)
    },
    showStickyHeader: false,
    trackBy: (_index, item) => item.dateKey,
    containerClass: {
      'event-checkout-slot-picker-month-list': true
    },
    emptyLabel: 'No slots in this month.'
  };

  protected readonly slotLoadPage = (query: ListQuery<SlotPickerFilters>) =>
    this.basketOnly
      ? of(this.selectedSlotsPage())
      : from(this.loadSlotPage(query));

  protected readonly monthLoadPage = (_query: ListQuery<SlotPickerMonthFilters>) =>
    of({
      items: this.monthDays,
      total: this.monthDays.length
    });

  constructor() {
    effect(() => {
      const state = this.store.popup();
      if (!state) {
        return;
      }
      this.initializeFromState(state.record, state.checkoutBasket ?? null, state.selectedDateKey ?? null);
      void this.loadMonthDays();
    });
  }

  protected popupState() {
    return this.store.popup();
  }

  protected popupModel(): PopupModel<SlotMenuContext> {
    const state = this.popupState();
    const selectedCount = this.selectedCount();
    return {
      title: state?.record.title ?? 'Slots',
      subtitle: state?.record.timeframe ?? this.formatRecordRange(state?.record ?? null),
      ariaLabel: 'Select checkout slots',
      closeAriaLabel: 'Close slot picker',
      closeOnBackdrop: !this.saving,
      showClose: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerControls: [
        {
          id: 'basket',
          kind: 'menu',
          align: 'end',
          menuKind: 'select',
          title: 'Basket',
          trigger: {
            icon: 'shopping_basket',
            closeIcon: 'close',
            hideLabel: true,
            layout: 'icon',
            palette: this.basketOnly ? 'danger' : 'orange',
            counter: selectedCount,
            ariaLabel: selectedCount === 1 ? 'Open selected basket item' : `Open ${selectedCount} selected basket items`
          },
          items: this.basketMenuItems(),
          panelAlign: 'end',
          mobileBreakpointPx: 900,
          closeOnSelect: false
        }
      ],
      headerActions: [
        {
          id: 'save',
          icon: 'done',
          ariaLabel: 'Save basket',
          palette: 'success',
          disabled: this.saving || selectedCount === 0
        }
      ],
      onClose: event => this.close(event),
      onAction: event => this.onPopupAction(event),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected selectedCount(): number {
    return this.selectionsBySlotId.size;
  }

  protected selectedDateValue(): string {
    return this.selectedDateKey;
  }

  protected onDateChange(value: DateInputValue): void {
    const dateKey = typeof value === 'string' ? value.slice(0, 10) : '';
    if (!dateKey) {
      return;
    }
    this.selectedDateKey = dateKey;
    this.monthAnchor = this.monthStart(dateKey);
    this.monthOverlayOpen = false;
    this.refreshSlotQuery();
    this.refreshMonthQuery();
    void this.loadMonthDays();
  }

  protected toggleMonthOverlay(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.monthOverlayOpen = !this.monthOverlayOpen;
    if (this.monthOverlayOpen) {
      void this.loadMonthDays();
    }
  }

  protected onMonthDaySelect(event: SmartListItemSelectEvent<EventCheckoutSlotDay, SlotPickerMonthFilters>): void {
    this.selectMonthSummaryDay(event.item, event.sourceEvent);
  }

  protected selectMonthSummaryDay(day: EventCheckoutSlotDay | null, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!day) {
      return;
    }
    this.selectedDateKey = day.dateKey;
    this.monthAnchor = this.monthStart(day.dateKey);
    this.monthOverlayOpen = false;
    this.refreshSlotQuery();
  }

  protected moveMonth(delta: -1 | 1, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const anchor = this.parseDateKey(this.monthAnchor) ?? new Date();
    anchor.setUTCMonth(anchor.getUTCMonth() + delta);
    this.monthAnchor = this.dateKey(anchor);
    this.refreshMonthQuery();
    void this.loadMonthDays();
  }

  protected isSelected(slot: EventCheckoutSlot): boolean {
    return this.selectionsBySlotId.has(slot.id);
  }

  protected selectedOptionalLabel(slot: EventCheckoutSlot): string {
    const selectedIds = this.selectionsBySlotId.get(slot.id)?.optionalSubEventIds ?? [];
    if (selectedIds.length === 0) {
      return '';
    }
    const names = this.optionalSubEvents()
      .filter(item => selectedIds.includes(item.id))
      .map(item => item.name || item.id);
    return names.length ? `Optional: ${names.join(', ')}` : '';
  }

  protected toggleSlot(slot: EventCheckoutSlot, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.selectionsBySlotId.has(slot.id)) {
      this.selectionsBySlotId.delete(slot.id);
    } else {
      this.selectionsBySlotId.set(slot.id, {
        slot,
        optionalSubEventIds: []
      });
    }
    this.refreshSlotQuery(false);
  }

  protected slotMenuItems(slot: EventCheckoutSlot): readonly AppMenuItem<string, unknown>[] {
    const selection = this.selectionsBySlotId.get(slot.id);
    const optionalItems = this.optionalSubEvents().map(subEvent => ({
      id: `optional:${subEvent.id}`,
      label: subEvent.name || subEvent.id,
      description: subEvent.description || null,
      icon: selection?.optionalSubEventIds.includes(subEvent.id) ? 'check_box' : 'check_box_outline_blank',
      kind: 'checkbox' as const,
      checked: () => this.selectionsBySlotId.get(slot.id)?.optionalSubEventIds.includes(subEvent.id) === true,
      palette: 'teal' as const,
      closeOnSelect: false,
      context: { menu: 'slot' as const, slot }
    }));
    return [
      ...optionalItems,
      ...(optionalItems.length > 0 ? [{
        id: `divider:${slot.id}`,
        kind: 'divider' as const,
        context: { menu: 'slot' as const, slot }
      }] : []),
      {
        id: 'delete',
        label: 'Eltavolitas',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted',
        disabled: () => !this.selectionsBySlotId.has(slot.id),
        context: { menu: 'slot', slot }
      }
    ];
  }

  protected onSlotMenuSelect(slot: EventCheckoutSlot, event: AppMenuItemSelectEvent<string, unknown>): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id === 'delete') {
      this.requestRemoveSlot(slot);
      return;
    }
    if (event.id.startsWith('optional:')) {
      this.toggleOptionalSlotEvent(slot, event.id.slice('optional:'.length));
    }
  }

  protected slotPriceLabel(slot: EventCheckoutSlot): string {
    return this.formatMoney(slot.amount, slot.currency);
  }

  protected slotAvailabilityLabel(slot: EventCheckoutSlot): string {
    return `${slot.availableSlots} available`;
  }

  protected monthTitle(): string {
    const anchor = this.parseDateKey(this.monthAnchor) ?? new Date();
    return anchor.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  private initializeFromState(
    record: ActivityEventRecord,
    basket: EventCheckoutBasket | null,
    selectedDateKey: string | null
  ): void {
    this.selectionsBySlotId.clear();
    const activeItems = (basket?.items ?? [])
      .filter(item => item.resultState !== 'deleted' && item.resultState !== 'succeeded');
    const eventItems = activeItems.filter(item => item.kind === 'event' && item.slotSourceId?.trim());
    for (const item of eventItems) {
      const slot = this.slotFromBasketItem(record, item);
      if (!slot) {
        continue;
      }
      const optionalSubEventIds = activeItems
        .filter(candidate => candidate.kind === 'sub_event' && candidate.slotSourceId === item.slotSourceId && candidate.subEventId)
        .map(candidate => candidate.subEventId!)
        .filter(Boolean);
      this.selectionsBySlotId.set(slot.id, { slot, optionalSubEventIds });
    }
    this.selectedDateKey = selectedDateKey?.slice(0, 10)
      || basket?.selectedDateKey?.slice(0, 10)
      || eventItems[0]?.selectedDateKey?.slice(0, 10)
      || this.todayKey();
    this.monthAnchor = this.monthStart(this.selectedDateKey);
    this.errorMessage = '';
    this.saving = false;
    this.refreshSlotQuery();
  }

  private async loadSlotPage(query: ListQuery<SlotPickerFilters>): Promise<PageResult<EventCheckoutSlot>> {
    const state = this.popupState();
    if (!state) {
      return { items: [], total: 0 };
    }
    const result = await this.eventsService.loadCheckoutSlots({
      userId: state.userId,
      eventId: state.record.id,
      order: 'upcoming',
      rangeStart: this.selectedDateKey,
      rangeEnd: this.selectedDateKey,
      limit: query.pageSize || 15,
      cursor: query.cursor ?? null
    });
    return {
      items: result?.slots ?? [],
      total: result?.total ?? 0,
      nextCursor: result?.nextCursor ?? null
    };
  }

  private selectedSlotsPage(): PageResult<EventCheckoutSlot> {
    const items = [...this.selectionsBySlotId.values()]
      .map(selection => selection.slot)
      .sort((left, right) => this.sortableDateMs(left.startAtIso) - this.sortableDateMs(right.startAtIso));
    return {
      items,
      total: items.length
    };
  }

  private async loadMonthDays(): Promise<void> {
    const state = this.popupState();
    if (!state) {
      return;
    }
    const result = await this.eventsService.loadCheckoutSlots({
      userId: state.userId,
      eventId: state.record.id,
      order: 'upcoming',
      rangeStart: this.monthAnchor,
      rangeEnd: this.monthEnd(this.monthAnchor),
      limit: 1
    });
    this.monthDays = result?.days ?? [];
    this.refreshMonthQuery();
    this.cdr.markForCheck();
  }

  private monthDateRange(day: EventCheckoutSlotDay): SmartListCalendarDateRange | null {
    const date = this.parseDateKey(day.dateKey);
    if (!date) {
      return null;
    }
    return { start: date, end: date };
  }

  private monthDayCounter(day: SmartListCalendarDay<EventCheckoutSlotDay>): SmartListCalendarCounter | null {
    const summary = day.items[0] ?? null;
    if (!summary) {
      return null;
    }
    const priceLabel = this.formatMoney(summary.lowestAmount, summary.currency);
    const availableSlots = Math.max(0, Math.trunc(Number(summary.availableSlots) || 0));
    return {
      label: priceLabel,
      ariaLabel: `${priceLabel}, ${availableSlots} available slots`,
      alertLabel: `${availableSlots}`,
      alertAriaLabel: `${availableSlots} available slots`,
      toneClass: availableSlots > 0
        ? 'event-checkout-slot-picker__calendar-counter--available'
        : 'event-checkout-slot-picker__calendar-counter--full'
    };
  }

  private basketMenuItems(): readonly AppMenuItem<string, SlotMenuContext>[] {
    const selectedItems = [...this.selectionsBySlotId.values()];
    return [
      {
        id: 'toggle-filter',
        label: this.basketOnly ? 'Show all slots' : 'Selected only',
        icon: this.basketOnly ? 'filter_alt_off' : 'filter_alt',
        palette: this.basketOnly ? 'danger' : 'orange',
        surface: 'tinted',
        context: { menu: 'basket' }
      },
      ...(selectedItems.length > 0 ? [{
        id: 'basket-divider',
        kind: 'divider' as const,
        context: { menu: 'basket' as const }
      }] : []),
      ...selectedItems.map(selection => ({
        id: `basket:${selection.slot.id}`,
        label: selection.slot.timeframe || selection.slot.title || selection.slot.id,
        description: this.slotPriceLabel(selection.slot),
        icon: 'event_seat',
        palette: 'teal' as const,
        surface: 'tinted' as const,
        removable: true,
        removeIcon: 'delete',
        removeAriaLabel: 'Remove selected slot',
        context: { menu: 'basket' as const, itemId: selection.slot.id }
      }))
    ];
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<SlotMenuContext>): void {
    const itemEvent = event.itemSelect;
    itemEvent.sourceEvent.preventDefault();
    itemEvent.sourceEvent.stopPropagation();
    if (itemEvent.id === 'toggle-filter') {
      this.basketOnly = !this.basketOnly;
      this.refreshSlotQuery();
      return;
    }
    if (itemEvent.action === 'remove' && itemEvent.context?.menu === 'basket' && itemEvent.context.itemId) {
      this.requestRemoveSelectedSlot(itemEvent.context.itemId);
    }
  }

  private onPopupAction(event: PopupActionEvent): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'save') {
      void this.saveBasket();
    }
  }

  private toggleOptionalSlotEvent(slot: EventCheckoutSlot, subEventId: string): void {
    const current = this.selectionsBySlotId.get(slot.id) ?? {
      slot,
      optionalSubEventIds: []
    };
    const optionalSubEventIds = current.optionalSubEventIds.includes(subEventId)
      ? current.optionalSubEventIds.filter(item => item !== subEventId)
      : [...current.optionalSubEventIds, subEventId];
    this.selectionsBySlotId.set(slot.id, {
      slot,
      optionalSubEventIds
    });
    this.refreshSlotQuery(false);
  }

  private requestRemoveSlot(slot: EventCheckoutSlot): void {
    this.requestRemoveSelectedSlot(slot.id);
  }

  private requestRemoveSelectedSlot(slotId: string): void {
    const selection = this.selectionsBySlotId.get(slotId);
    if (!selection) {
      return;
    }
    this.dialogStore.open({
      title: 'Remove checkout item?',
      message: selection.slot.timeframe || selection.slot.title || 'Selected slot',
      warningMessage: 'The slot will be removed from the draft basket.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Eltavolitas',
      busyConfirmLabel: 'Removing...',
      confirmTone: 'danger',
      confirmPalette: 'danger',
      failureMessage: 'Unable to remove this checkout item.',
      onConfirm: () => {
        this.selectionsBySlotId.delete(slotId);
        this.refreshSlotQuery();
      }
    });
  }

  private async saveBasket(): Promise<void> {
    const state = this.popupState();
    if (!state || this.saving || this.selectionsBySlotId.size === 0) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      const request = this.buildCheckoutRequest(state.userId, state.record);
      const savedBasket = await this.eventsService.saveCheckoutBasket(request);
      this.checkoutDraftStore.save({
        userId: state.userId,
        sourceId: state.record.id,
        eventTitle: state.record.title,
        eventTimeframe: state.record.timeframe,
        slotSourceId: request.slotSourceId ?? null,
        selectedDateKey: request.basketItems?.[0]?.selectedDateKey ?? this.selectedDateKey,
        optionalSubEventIds: request.optionalSubEventIds,
        acceptedPolicyIds: [],
        basketItems: request.basketItems ?? [],
        pricingSummaryRows: request.pricingSummaryRows ?? [],
        checkoutState: request.checkoutState ?? 'draft',
        lineItems: request.lineItems,
        totalAmount: request.totalAmount,
        currency: request.currency,
        checkoutSessionId: null,
        expiresAtIso: request.basketItems?.find(item => item.expiresAtIso)?.expiresAtIso ?? null,
        pendingReason: null,
        updatedAtMs: Date.now()
      });
      await state.onSave?.(savedBasket, request.basketItems ?? []);
      this.store.close();
    } catch (error) {
      this.errorMessage = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Unable to save checkout basket.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private buildCheckoutRequest(userId: string, record: ActivityEventRecord) {
    const items = this.buildBasketItems(record);
    const lineItems = this.lineItemsFromBasketItems(items);
    const currency = items.find(item => item.currency)?.currency ?? record.pricing?.currency ?? 'USD';
    return {
      userId,
      sourceId: record.id,
      slotSourceId: items.find(item => item.slotSourceId)?.slotSourceId ?? null,
      optionalSubEventIds: [...new Set(items.map(item => item.subEventId).filter((item): item is string => Boolean(item)))],
      assetSelections: [],
      acceptedPolicyIds: [],
      basketItems: items,
      pricingSummaryRows: this.aggregatePricingSummaryRows(items.flatMap(item => item.pricingSummaryRows ?? []), currency),
      checkoutState: 'draft' as EventCheckoutState,
      lineItems,
      totalAmount: this.totalAmountFromLineItems(lineItems),
      currency,
      pendingReason: null
    };
  }

  private buildBasketItems(record: ActivityEventRecord): EventCheckoutBasketItem[] {
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + EventCheckoutSlotPickerPopupComponent.CHECKOUT_BASKET_TTL_MS).toISOString();
    const items: EventCheckoutBasketItem[] = [];
    for (const selection of this.selectionsBySlotId.values()) {
      const slot = selection.slot;
      const selectedDateKey = this.checkoutDateKey(slot.startAtIso);
      items.push({
        id: `event:${record.id}:${slot.id}`,
        kind: 'event',
        sourceId: record.id,
        slotSourceId: slot.id,
        slotTemplateId: slot.slotTemplateId ?? null,
        selectedDateKey,
        subEventId: null,
        resourceType: null,
        label: record.title,
        detail: slot.timeframe || record.timeframe || 'Main event',
        amount: slot.amount,
        currency: slot.currency,
        quantity: 1,
        status: 'draft',
        resultState: 'pending',
        pricingSummaryRows: slot.pricingSummaryRows ?? [],
        checkoutSessionId: null,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        expiresAtIso
      });
      for (const subEvent of this.optionalSubEvents().filter(item => selection.optionalSubEventIds.includes(item.id))) {
        const pricing = this.resolveOptionalSubEventPricing(subEvent);
        items.push({
          id: `subevent:${subEvent.id}:${slot.id}`,
          kind: 'sub_event',
          sourceId: record.id,
          slotSourceId: slot.id,
          slotTemplateId: slot.slotTemplateId ?? null,
          selectedDateKey,
          subEventId: subEvent.id,
          resourceType: null,
          label: subEvent.name,
          detail: subEvent.description || 'Optional sub event',
          amount: pricing.amount,
          currency: pricing.currency,
          quantity: 1,
          status: 'draft',
          resultState: 'pending',
          pricingSummaryRows: pricing.rows,
          checkoutSessionId: null,
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
          expiresAtIso
        });
      }
    }
    return items;
  }

  private resolveOptionalSubEventPricing(subEvent: SubEventDTO): { amount: number; currency: string; rows: EventCheckoutPricingSummaryRow[] } {
    const normalized = PricingBuilder.compactPricingConfig(subEvent.pricing, {
      context: 'subevent',
      allowSlotFeatures: false
    });
    const currency = normalized.currency || 'USD';
    if (!normalized.enabled) {
      return { amount: 0, currency, rows: [] };
    }
    const amount = Math.max(0, Number(normalized.basePrice) || 0);
    return {
      amount,
      currency,
      rows: [{
        key: `subevent:${subEvent.id}:base`,
        label: subEvent.name || 'Optional sub event',
        detail: null,
        amount,
        currency,
        multiplier: 1
      }]
    };
  }

  private lineItemsFromBasketItems(items: readonly EventCheckoutBasketItem[]): EventCheckoutLineItem[] {
    return items.map(item => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      amount: this.roundMoney((Number(item.amount) || 0) * Math.max(1, Math.trunc(Number(item.quantity) || 1))),
      currency: item.currency
    }));
  }

  private aggregatePricingSummaryRows(
    rows: readonly EventCheckoutPricingSummaryRow[],
    fallbackCurrency: string
  ): EventCheckoutPricingSummaryRow[] {
    const grouped = new Map<string, EventCheckoutPricingSummaryRow>();
    for (const row of rows) {
      const label = `${row.label ?? ''}`.trim();
      if (!label) {
        continue;
      }
      const amount = Number.isFinite(row.amount) ? Number(row.amount) : null;
      const currency = `${row.currency ?? fallbackCurrency ?? 'USD'}`.trim() || 'USD';
      const detail = `${row.detail ?? ''}`.trim();
      const key = `${row.key || label}:${detail}:${amount ?? 'none'}:${currency}`;
      const multiplier = Math.max(1, Math.trunc(Number(row.multiplier) || 1));
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          key,
          label,
          detail: detail || null,
          amount: amount === null ? null : this.roundMoney(amount * multiplier),
          currency,
          multiplier
        });
        continue;
      }
      grouped.set(key, {
        ...existing,
        multiplier: Math.max(1, Math.trunc(Number(existing.multiplier) || 1)) + multiplier,
        amount: existing.amount !== null && amount !== null
          ? this.roundMoney(Number(existing.amount) + (amount * multiplier))
          : existing.amount ?? amount
      });
    }
    return [...grouped.values()];
  }

  private totalAmountFromLineItems(items: readonly EventCheckoutLineItem[]): number {
    return this.roundMoney(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  }

  private slotFromBasketItem(record: ActivityEventRecord, item: EventCheckoutBasketItem): EventCheckoutSlot | null {
    const slotId = item.slotSourceId?.trim();
    if (!slotId) {
      return null;
    }
    const existing = (record.upcomingSlots ?? []).find(slot => slot.id === slotId);
    if (existing) {
      return {
        id: existing.id,
        parentEventId: existing.parentEventId || record.id,
        slotSourceId: existing.id,
        slotTemplateId: existing.slotTemplateId ?? null,
        title: existing.title || record.title,
        timeframe: existing.timeframe || item.detail,
        startAtIso: existing.startAtIso,
        endAtIso: existing.endAtIso,
        capacityTotal: existing.capacityTotal,
        acceptedMembers: existing.acceptedMembers,
        pendingMembers: existing.pendingMembers,
        availableSlots: Math.max(0, existing.capacityTotal - existing.acceptedMembers),
        amount: item.amount,
        currency: item.currency,
        pricingSummaryRows: item.pricingSummaryRows ?? []
      };
    }
    return {
      id: slotId,
      parentEventId: record.id,
      slotSourceId: slotId,
      slotTemplateId: item.slotTemplateId ?? null,
      title: record.title,
      timeframe: item.detail,
      startAtIso: item.selectedDateKey ? `${item.selectedDateKey}T00:00:00.000Z` : record.startAtIso,
      endAtIso: item.selectedDateKey ? `${item.selectedDateKey}T23:59:59.000Z` : record.endAtIso,
      capacityTotal: 0,
      acceptedMembers: 0,
      pendingMembers: 0,
      availableSlots: 0,
      amount: item.amount,
      currency: item.currency,
      pricingSummaryRows: item.pricingSummaryRows ?? []
    };
  }

  private optionalSubEvents(): SubEventDTO[] {
    return (this.popupState()?.record.subEvents ?? []).filter(item => item.optional);
  }

  private refreshSlotQuery(reset = true): void {
    this.slotListQuery = this.buildSlotListQuery(reset ? null : this.slotListQuery.cursor ?? null);
    this.cdr.markForCheck();
  }

  private refreshMonthQuery(): void {
    this.monthListQuery = this.buildMonthListQuery();
    this.cdr.markForCheck();
  }

  private buildSlotListQuery(cursor: string | null = null): Partial<ListQuery<SlotPickerFilters>> {
    return {
      cursor,
      filters: {
        dateKey: this.selectedDateKey,
        basketOnly: this.basketOnly
      }
    };
  }

  private buildMonthListQuery(): Partial<ListQuery<SlotPickerMonthFilters>> {
    return {
      filters: {
        anchor: this.monthAnchor
      }
    };
  }

  private close(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.saving) {
      return;
    }
    this.store.close();
  }

  private formatRecordRange(record: ActivityEventRecord | null): string {
    if (!record) {
      return '';
    }
    return record.timeframe || this.formatDateGroup(record.startAtIso);
  }

  private formatDateGroup(value: string): string {
    const parsed = AppUtils.isoLocalDateTimeToDate(value);
    return parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : value.slice(0, 10);
  }

  private formatMoney(amount: number, currency: string): string {
    const normalizedCurrency = `${currency || 'USD'}`.trim().toUpperCase();
    if (normalizedCurrency === 'EUR') {
      return `EUR ${this.roundMoney(amount).toFixed(2)}`;
    }
    if (normalizedCurrency === 'GBP') {
      return `GBP ${this.roundMoney(amount).toFixed(2)}`;
    }
    return `$${this.roundMoney(amount).toFixed(2)}`;
  }

  private monthStart(dateKey: string): string {
    const date = this.parseDateKey(dateKey) ?? new Date();
    return this.dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  }

  private monthEnd(dateKey: string): string {
    const date = this.parseDateKey(dateKey) ?? new Date();
    return this.dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  }

  private todayKey(): string {
    return this.dateKey(new Date());
  }

  private parseDateKey(value: string): Date | null {
    const ms = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }

  private checkoutDateKey(value: string | null | undefined): string {
    const ms = this.sortableDateMs(value);
    return ms ? this.dateKey(new Date(ms)) : '';
  }

  private dateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private sortableDateMs(value: string | null | undefined): number {
    const ms = Date.parse(`${value ?? ''}`.trim());
    return Number.isFinite(ms) ? ms : 0;
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
