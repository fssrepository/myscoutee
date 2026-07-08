import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import {
  EventsService,
  type EventCheckoutBasket,
  type EventCheckoutBasketItem,
  type EventCheckoutLineItem,
  type EventCheckoutOptionalSubEvent,
  type EventCheckoutPricingSummaryRow,
  type EventCheckoutSlot,
  type EventCheckoutSlotDay,
  type EventCheckoutState,
  type EventCheckoutSlotsResult,
  type PageResult
} from '../../../shared/core';
import {
  EventCheckoutDraftStore,
  EventCheckoutSlotPickerStore,
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
  type SmartListItemSelectEvent,
  type TextCardStatusTone,
  type TextCardTone
} from '../../../shared/ui';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import {
  EventBasketInputComponent,
  type EventBasketInputItem
} from '../event-editor-popup/event-basket-input/event-basket-input.component';

interface SlotPickerFilters {
  dateKey: string;
  view: SlotListView;
  revision: number;
}

interface SlotPickerMonthFilters {
  anchor: string;
}

interface SlotSelection {
  slot: EventCheckoutSlot;
  optionalSubEventIds: string[];
}

type SlotListView = 'day' | 'basket';

@Component({
  selector: 'app-event-checkout-slot-picker-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PopupComponent,
    SmartListComponent,
    TextCardComponent,
    EventBasketInputComponent
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
  private readonly cdr = inject(ChangeDetectorRef);

  protected selectedDateKey = this.todayKey();
  protected basketMode = false;
  protected monthOverlayOpen = false;
  protected saving = false;
  protected errorMessage = '';
  protected pricingSummarySlot: EventCheckoutSlot | null = null;
  protected monthAnchor = this.monthStart(this.selectedDateKey);
  protected monthListQuery: Partial<ListQuery<SlotPickerMonthFilters>> = this.buildMonthListQuery();
  private selectionRevision = 0;
  private readonly selectionsBySlotId = new Map<string, SlotSelection>();
  private baselineSelectionSignature = '';
  private optionalSubEventOptions: EventCheckoutOptionalSubEvent[] = [];
  private checkoutBasketHydrated = false;

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
    selectMode: true,
    headerProgress: {
      enabled: true
    },
    loadingDelayMs: 0,
    showBackgroundLoadingProgress: true,
    emptyLabel: () => this.basketMode
      ? 'No basket items yet.'
      : 'No available slots for this date.',
    trackBy: (_index, item) => item.id,
    groupBy: item => this.formatDateGroup(item.startAtIso),
    showGroupMarker: ({ groupIndex }) => groupIndex > 0,
    containerClass: {
      'event-checkout-slot-picker-list': true
    }
  };

  protected readonly monthListConfig: SmartListConfig<EventCheckoutSlotDay, SlotPickerMonthFilters> = {
    pageSize: 240,
    initialPageSize: 240,
    defaultView: 'month',
    views: [
      { key: 'month', label: 'Month', mode: 'month', pageSize: 240 }
    ],
    calendarVariant: 'counter',
    calendar: {
      weekdayLabels: APP_STATIC_DATA.calendarWeekdayLabels,
      weekStartHour: 0,
      weekEndHour: 23,
      anchorRadius: 2,
      counterGranularity: 'day',
      initialAnchor: query => query.filters?.anchor ?? this.monthAnchor,
      resolveDateRange: item => this.monthDateRange(item),
      dayCounter: day => this.monthDayCounter(day)
    },
    headerProgress: {
      enabled: true
    },
    loadingDelayMs: 0,
    showBackgroundLoadingProgress: true,
    showStickyHeader: true,
    trackBy: (_index, item) => item.dateKey,
    emptyLabel: 'No slots in this month.'
  };

  protected readonly slotLoadPage = (query: ListQuery<SlotPickerFilters>) =>
    this.basketMode
      ? from(this.loadBasketSlotPage(query))
      : from(this.loadSlotPage(query));

  protected readonly monthLoadPage = (_query: ListQuery<SlotPickerMonthFilters>) =>
    from(this.loadMonthPage(_query));

  constructor() {
    effect(() => {
      const state = this.store.popup();
      if (!state) {
        return;
      }
      this.initializeFromState(state.record, state.checkoutBasket ?? null, state.selectedDateKey ?? null);
    });
  }

  protected popupState() {
    return this.store.popup();
  }

  protected popupModel(): PopupModel {
    const state = this.popupState();
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
          kind: 'menu',
          id: 'slot-picker-actions',
          align: 'end',
          menuKind: 'inline',
          items: this.headerMenuItems(),
          panelAlign: 'end',
          mobileBreakpointPx: 900,
          closeOnSelect: false
        }
      ],
      toolbarControls: [
        {
          kind: 'date-input',
          id: 'slot-picker-date',
          align: 'end',
          model: this.dateInputModel,
          value: this.selectedDateValue()
        },
        {
          id: 'slot-picker-calendar',
          align: 'end',
          icon: 'calendar_month',
          ariaLabel: 'Open slot calendar',
          palette: this.monthOverlayOpen ? 'teal' : 'neutral',
          active: this.monthOverlayOpen
        }
      ],
      onClose: event => this.close(event),
      onAction: event => this.onPopupAction(event),
      onMenuSelect: event => this.onPopupMenuSelect(event),
      onDateInputChange: event => {
        if (event.control.id === 'slot-picker-date') {
          this.onDateChange(event.value);
        }
      }
    };
  }

  protected selectedCount(): number {
    return this.selectionsBySlotId.size;
  }

  protected headerMenuItems(): readonly AppMenuItem<string, unknown>[] {
    const selectedCount = this.selectedCount();
    return [
      {
        id: 'basket',
        icon: 'shopping_basket',
        kind: 'action',
        palette: this.basketMode ? 'blue' : 'neutral',
        counter: selectedCount,
        active: this.basketMode,
        closeOnSelect: false,
        ariaLabel: selectedCount === 1 ? 'Show selected basket item' : `Show ${selectedCount} selected basket items`
      },
      {
        id: 'save',
        icon: 'done',
        kind: 'action',
        palette: this.errorMessage ? 'danger' : 'success',
        disabled: this.saving || !this.hasSelectionChanges(),
        closeOnSelect: false,
        ariaLabel: 'Save basket',
        progress: {
          state: () => this.saving ? 'loading' : (this.errorMessage ? 'error' : null),
          shape: 'circle'
        }
      }
    ];
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
    this.basketMode = false;
    this.monthOverlayOpen = false;
    this.refreshSlotQuery();
    this.refreshMonthQuery();
  }

  protected toggleMonthView(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.monthOverlayOpen = !this.monthOverlayOpen;
    if (this.monthOverlayOpen && this.basketMode) {
      this.basketMode = false;
      this.refreshSlotQuery();
    }
    this.refreshMonthQuery();
  }

  protected toggleBasketView(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.basketMode = !this.basketMode;
    if (this.basketMode) {
      this.monthOverlayOpen = false;
    }
    this.refreshSlotQuery();
  }

  protected onMonthDaySelect(event: SmartListItemSelectEvent<EventCheckoutSlotDay, SlotPickerMonthFilters>): void {
    this.selectMonthSummaryDay(event.item, event.sourceEvent);
  }

  protected onSlotItemSelect(event: SmartListItemSelectEvent<EventCheckoutSlot, SlotPickerFilters>): void {
    if (!event.selectMode) {
      return;
    }
    this.toggleSlot(event.item, event.sourceEvent);
  }

  protected selectMonthSummaryDay(day: EventCheckoutSlotDay | null, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!day) {
      return;
    }
    this.selectedDateKey = day.dateKey;
    this.monthAnchor = this.monthStart(day.dateKey);
    this.basketMode = false;
    this.monthOverlayOpen = false;
    this.refreshSlotQuery();
    this.refreshMonthQuery();
  }

  protected isMonthView(): boolean {
    return this.monthOverlayOpen;
  }

  protected isSelected(slot: EventCheckoutSlot): boolean {
    return this.selectionsBySlotId.has(slot.id);
  }

  protected isSlotUnavailable(slot: EventCheckoutSlot): boolean {
    return !this.isSelected(slot) && this.slotAvailableCount(slot) <= 0;
  }

  protected slotCardTone(slot: EventCheckoutSlot): TextCardTone {
    return this.isSlotUnavailable(slot) ? 'muted' : 'slot';
  }

  protected slotCapacityBadge(slot: EventCheckoutSlot): string {
    const capacity = this.slotCapacityTotal(slot);
    const available = this.slotAvailableCount(slot);
    const availableIncludingSelection = available + (this.isSelected(slot) ? 1 : 0);
    if (capacity <= 0 || availableIncludingSelection <= 0) {
      return 'Unavailable';
    }
    const used = capacity - available + (this.isSelected(slot) ? 1 : 0);
    return `${Math.max(0, Math.min(capacity, used))} / ${capacity}`;
  }

  protected slotCapacityBadgeTone(slot: EventCheckoutSlot): TextCardStatusTone {
    return 'muted';
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
    if (this.isSlotUnavailable(slot)) {
      return;
    }
    if (this.selectionsBySlotId.has(slot.id)) {
      this.selectionsBySlotId.delete(slot.id);
    } else {
      this.selectionsBySlotId.set(slot.id, {
        slot,
        optionalSubEventIds: []
      });
    }
    this.selectionRevision += 1;
    if (this.basketMode) {
      this.refreshSlotQuery();
      return;
    }
    this.cdr.markForCheck();
  }

  protected slotMenuItems(slot: EventCheckoutSlot): readonly AppMenuItem<string, unknown>[] {
    const selection = this.selectionsBySlotId.get(slot.id);
    const optionalItems = this.optionalSubEvents().map(subEvent => {
      const selected = selection?.optionalSubEventIds.includes(subEvent.id) === true;
      const unavailable = this.isOptionalSubEventDisabled(slot, subEvent) && !selected;
      return {
        id: `optional:${subEvent.id}`,
        label: subEvent.name || subEvent.id,
        description: subEvent.description || null,
        icon: unavailable ? 'block' : selected ? 'check_box' : 'check_box_outline_blank',
        kind: 'checkbox' as const,
        checked: () => this.selectionsBySlotId.get(slot.id)?.optionalSubEventIds.includes(subEvent.id) === true,
        showCheck: false,
        disabled: () => this.isOptionalSubEventDisabled(slot, subEvent),
        palette: unavailable ? 'muted' as const : 'mint' as const,
        surface: 'tinted' as const,
        headerBadge: this.optionalSubEventPriceLabel(subEvent),
        counter: unavailable ? 'Unavailable' : this.optionalSubEventCapacityBadge(subEvent),
        detail: unavailable ? null : undefined,
        closeOnSelect: false,
        context: { menu: 'slot' as const, slot }
      };
    });
    return [
      ...optionalItems,
      ...(optionalItems.length > 0 ? [{
        id: `divider:${slot.id}`,
        kind: 'divider' as const,
        context: { menu: 'slot' as const, slot }
      }] : []),
      {
        id: 'pricing',
        label: 'Price summary',
        icon: 'price_check',
        palette: 'gold',
        surface: 'tinted',
        headerBadge: this.slotPriceLabel(slot),
        context: { menu: 'slot', slot }
      }
    ];
  }

  protected onSlotMenuSelect(slot: EventCheckoutSlot, event: AppMenuItemSelectEvent<string, unknown>): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id === 'pricing') {
      this.openPricingSummary(slot, event.sourceEvent);
      return;
    }
    if (event.id.startsWith('optional:')) {
      this.toggleOptionalSlotEvent(slot, event.id.slice('optional:'.length));
    }
  }

  protected slotPriceLabel(slot: EventCheckoutSlot): string {
    return this.formatMoney(this.slotTotalAmount(slot), this.slotCurrency(slot));
  }

  protected slotAvailabilityLabel(slot: EventCheckoutSlot): string {
    return this.slotCapacityBadge(slot);
  }

  private initializeFromState(
    record: ActivityEventRecord,
    basket: EventCheckoutBasket | null,
    selectedDateKey: string | null
  ): void {
    this.selectionsBySlotId.clear();
    this.optionalSubEventOptions = [];
    this.selectionRevision = 0;
    this.checkoutBasketHydrated = false;
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
    this.basketMode = false;
    this.monthOverlayOpen = false;
    this.pricingSummarySlot = null;
    this.errorMessage = '';
    this.saving = false;
    this.baselineSelectionSignature = this.selectionSignature();
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
      view: 'day',
      order: 'upcoming',
      rangeStart: this.selectedDateKey,
      rangeEnd: this.selectedDateKey,
      limit: query.pageSize || 15,
      cursor: query.cursor ?? null
    });
    this.applyCheckoutSlotsContext(state.record, result);
    return {
      items: result?.slots ?? [],
      total: result?.total ?? 0,
      nextCursor: result?.nextCursor ?? null
    };
  }

  private async loadBasketSlotPage(query: ListQuery<SlotPickerFilters>): Promise<PageResult<EventCheckoutSlot>> {
    const state = this.popupState();
    if (!state) {
      return { items: [], total: 0 };
    }
    const result = await this.eventsService.loadCheckoutSlots({
      userId: state.userId,
      eventId: state.record.id,
      view: 'basket',
      order: 'upcoming',
      limit: query.pageSize || 15,
      cursor: query.cursor ?? null
    });
    this.applyCheckoutSlotsContext(state.record, result);
    const mergedById = new Map<string, EventCheckoutSlot>();
    for (const slot of result?.slots ?? []) {
      mergedById.set(slot.id, slot);
    }
    for (const slot of this.selectedSlotsPage().items) {
      mergedById.set(slot.id, mergedById.get(slot.id) ?? slot);
    }
    const items = [...mergedById.values()]
      .sort((left, right) => this.sortableDateMs(left.startAtIso) - this.sortableDateMs(right.startAtIso));
    return {
      items,
      total: Math.max(result?.total ?? 0, items.length),
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

  private applyCheckoutSlotsContext(
    record: ActivityEventRecord,
    result: EventCheckoutSlotsResult | null | undefined
  ): void {
    if (Array.isArray(result?.optionalSubEvents)) {
      this.optionalSubEventOptions = result.optionalSubEvents;
    }
    if (!this.checkoutBasketHydrated) {
      this.hydrateSelectionsFromBasket(record, result?.checkoutBasket ?? null, result?.slots ?? []);
      this.checkoutBasketHydrated = true;
      if (this.selectionRevision === 0) {
        this.baselineSelectionSignature = this.selectionSignature();
      }
    }
    this.cdr.markForCheck();
  }

  private hydrateSelectionsFromBasket(
    record: ActivityEventRecord,
    basket: EventCheckoutBasket | null,
    slots: readonly EventCheckoutSlot[]
  ): void {
    const activeItems = (basket?.items ?? [])
      .filter(item => item.resultState !== 'deleted' && item.resultState !== 'succeeded');
    const slotsById = new Map(slots.map(slot => [slot.id, slot]));
    for (const item of activeItems.filter(candidate => candidate.kind === 'event' && candidate.slotSourceId?.trim())) {
      const slotId = item.slotSourceId!.trim();
      const slot = slotsById.get(slotId) ?? this.slotFromBasketItem(record, item);
      if (!slot) {
        continue;
      }
      const selectedOptionalIds = activeItems
        .filter(candidate => candidate.kind === 'sub_event' && candidate.slotSourceId === slotId && candidate.subEventId)
        .map(candidate => candidate.subEventId!)
        .filter(Boolean);
      const existing = this.selectionsBySlotId.get(slot.id);
      this.selectionsBySlotId.set(slot.id, {
        slot,
        optionalSubEventIds: [...new Set([
          ...(existing?.optionalSubEventIds ?? []),
          ...selectedOptionalIds
        ])]
      });
    }
  }

  private async loadMonthPage(query: ListQuery<SlotPickerMonthFilters>): Promise<PageResult<EventCheckoutSlotDay>> {
    const state = this.popupState();
    if (!state) {
      return { items: [], total: 0 };
    }
    const anchor = query.anchorDate ?? query.filters?.anchor ?? this.monthAnchor;
    const rangeStart = query.rangeStart ?? this.monthStart(anchor);
    const rangeEnd = query.rangeEnd ?? this.monthEnd(anchor);
    const result = await this.eventsService.loadCheckoutSlots({
      userId: state.userId,
      eventId: state.record.id,
      view: 'day',
      order: 'upcoming',
      rangeStart,
      rangeEnd,
      limit: 1
    });
    this.applyCheckoutSlotsContext(state.record, result);
    return {
      items: result?.days ?? [],
      total: result?.days?.length ?? 0
    };
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
      toneClass: availableSlots > 0 ? null : 'calendar-counter-full'
    };
  }

  private onPopupAction(event: PopupActionEvent): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'slot-picker-calendar') {
      this.toggleMonthView(event.sourceEvent);
    }
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent): void {
    event.itemSelect.sourceEvent.preventDefault();
    event.itemSelect.sourceEvent.stopPropagation();
    if (event.itemSelect.id === 'save') {
      void this.saveBasket();
      return;
    }
    if (event.itemSelect.id === 'basket') {
      this.toggleBasketView(event.itemSelect.sourceEvent);
    }
  }

  protected openPricingSummary(slot: EventCheckoutSlot, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.pricingSummarySlot = slot;
    this.cdr.markForCheck();
  }

  protected pricingSummaryPopupModel(): PopupModel {
    const slot = this.pricingSummarySlot;
    return {
      title: 'Price summary',
      subtitle: slot?.title ?? null,
      secondarySubtitle: slot?.timeframe ?? null,
      ariaLabel: 'Slot price summary',
      closeAriaLabel: 'Close price summary',
      closeOnBackdrop: true,
      showClose: true,
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      onClose: event => this.closePricingSummary(event)
    };
  }

  protected pricingSummaryRows(slot: EventCheckoutSlot | null): EventCheckoutPricingSummaryRow[] {
    if (!slot) {
      return [];
    }
    const slotRows = (slot.pricingSummaryRows ?? []).length > 0
      ? slot.pricingSummaryRows
      : [{
      key: `slot:${slot.id}:base`,
      label: 'Base price',
      detail: null,
      amount: slot.amount,
      currency: slot.currency,
      multiplier: 1
    }];
    return [
      ...slotRows,
      ...this.selectedOptionalSubEvents(slot).flatMap(subEvent => this.resolveOptionalSubEventPricing(subEvent).rows)
    ];
  }

  protected pricingSummaryItems(slot: EventCheckoutSlot | null): EventBasketInputItem[] {
    if (!slot) {
      return [];
    }
    const items: EventBasketInputItem[] = [{
      id: `event:${slot.parentEventId}:${slot.id}`,
      title: slot.title || 'Selected slot',
      meta: slot.timeframe || this.formatDateGroup(slot.startAtIso),
      detail: null,
      amount: slot.amount,
      currency: slot.currency,
      quantity: 1,
      status: this.isSelected(slot) ? 'confirmed' : 'draft',
      pricingSummaryRows: (slot.pricingSummaryRows ?? []).length > 0
        ? slot.pricingSummaryRows
        : this.pricingSummaryRows(slot).filter(row => `${row.key ?? ''}`.startsWith(`slot:${slot.id}`))
    }];
    for (const subEvent of this.selectedOptionalSubEvents(slot)) {
      const pricing = this.resolveOptionalSubEventPricing(subEvent);
      items.push({
        id: `subevent:${subEvent.id}:${slot.id}`,
        title: subEvent.name || 'Optional sub event',
        meta: 'Optional add-on',
        detail: subEvent.description || null,
        amount: pricing.amount,
        currency: pricing.currency,
        quantity: 1,
        status: 'draft',
        pricingSummaryRows: pricing.rows
      });
    }
    return items;
  }

  protected pricingSummaryTotalAmount(slot: EventCheckoutSlot | null): number {
    return slot ? this.slotTotalAmount(slot) : 0;
  }

  protected pricingSummaryCurrency(slot: EventCheckoutSlot | null): string {
    return slot ? this.slotCurrency(slot) : 'USD';
  }

  private closePricingSummary(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.pricingSummarySlot = null;
    this.cdr.markForCheck();
  }

  private toggleOptionalSlotEvent(slot: EventCheckoutSlot, subEventId: string): void {
    const option = this.optionalSubEvents().find(item => item.id === subEventId);
    if (option && this.isOptionalSubEventDisabled(slot, option)) {
      return;
    }
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
    this.selectionRevision += 1;
    this.cdr.markForCheck();
  }

  private slotCapacityTotal(slot: EventCheckoutSlot): number {
    return Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
  }

  private slotAvailableCount(slot: EventCheckoutSlot): number {
    return Math.max(0, Math.trunc(Number(slot.availableSlots) || 0));
  }

  private optionalSubEventCapacityTotal(subEvent: EventCheckoutOptionalSubEvent): number {
    return Math.max(0, Math.trunc(Number(subEvent.capacityTotal) || 0));
  }

  private optionalSubEventUsedCount(subEvent: EventCheckoutOptionalSubEvent): number {
    const reserved = Math.max(0, Math.trunc(Number(subEvent.reservedCount) || 0));
    return reserved + this.selectedOptionalSubEventCount(subEvent.id);
  }

  private optionalSubEventAvailableCount(subEvent: EventCheckoutOptionalSubEvent): number {
    const capacity = this.optionalSubEventCapacityTotal(subEvent);
    return Math.max(0, capacity - this.optionalSubEventUsedCount(subEvent));
  }

  private optionalSubEventCapacityBadge(subEvent: EventCheckoutOptionalSubEvent): string {
    const capacity = this.optionalSubEventCapacityTotal(subEvent);
    if (capacity <= 0) {
      return 'Unavailable';
    }
    return `${Math.min(capacity, this.optionalSubEventUsedCount(subEvent))} / ${capacity}`;
  }

  private optionalSubEventPriceLabel(subEvent: EventCheckoutOptionalSubEvent): string {
    return this.formatMoney(subEvent.amount, subEvent.currency);
  }

  private selectedOptionalSubEvents(slot: EventCheckoutSlot): EventCheckoutOptionalSubEvent[] {
    const selectedIds = this.selectionsBySlotId.get(slot.id)?.optionalSubEventIds ?? [];
    if (selectedIds.length === 0) {
      return [];
    }
    const selectedIdSet = new Set(selectedIds);
    return this.optionalSubEvents().filter(item => selectedIdSet.has(item.id));
  }

  private selectedOptionalSubEventAmount(slot: EventCheckoutSlot): number {
    return this.selectedOptionalSubEvents(slot)
      .reduce((sum, subEvent) => sum + (Number(subEvent.amount) || 0), 0);
  }

  private slotTotalAmount(slot: EventCheckoutSlot): number {
    return this.roundMoney((Number(slot.amount) || 0) + this.selectedOptionalSubEventAmount(slot));
  }

  private slotCurrency(slot: EventCheckoutSlot): string {
    return slot.currency || this.selectedOptionalSubEvents(slot).find(item => item.currency)?.currency || 'USD';
  }

  private selectedOptionalSubEventCount(subEventId: string): number {
    return [...this.selectionsBySlotId.values()]
      .filter(selection => selection.optionalSubEventIds.includes(subEventId))
      .length;
  }

  private isOptionalSubEventDisabled(slot: EventCheckoutSlot, subEvent: EventCheckoutOptionalSubEvent): boolean {
    const selectedIds = this.selectionsBySlotId.get(slot.id)?.optionalSubEventIds ?? [];
    if (selectedIds.includes(subEvent.id)) {
      return false;
    }
    return this.isSlotUnavailable(slot) || this.optionalSubEventAvailableCount(subEvent) <= 0;
  }

  private hasSelectionChanges(): boolean {
    return this.selectionSignature() !== this.baselineSelectionSignature;
  }

  private selectionSignature(): string {
    return [...this.selectionsBySlotId.values()]
      .map(selection => {
        const optionals = [...new Set(selection.optionalSubEventIds)]
          .map(item => item.trim())
          .filter(Boolean)
          .sort();
        return `${selection.slot.id}::${optionals.join(',')}`;
      })
      .sort()
      .join('|');
  }

  private async saveBasket(): Promise<void> {
    const state = this.popupState();
    if (!state || this.saving || !this.hasSelectionChanges()) {
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
      this.baselineSelectionSignature = this.selectionSignature();
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

  private resolveOptionalSubEventPricing(
    subEvent: EventCheckoutOptionalSubEvent
  ): { amount: number; currency: string; rows: EventCheckoutPricingSummaryRow[] } {
    const amount = Math.max(0, Number(subEvent.amount) || 0);
    const currency = subEvent.currency || 'USD';
    return {
      amount,
      currency,
      rows: subEvent.pricingSummaryRows?.length
        ? subEvent.pricingSummaryRows
        : [{
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
        availableSlots: Math.max(0, existing.capacityTotal - existing.acceptedMembers - existing.pendingMembers),
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

  private optionalSubEvents(): EventCheckoutOptionalSubEvent[] {
    return this.optionalSubEventOptions;
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
        view: this.basketMode ? 'basket' : 'day',
        revision: this.selectionRevision
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
