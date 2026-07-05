import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { from, map } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AssetCardBuilder } from '../../../shared/core/base/builders';
import {
  AssetsService,
  I18nService
} from '../../../shared/core';
import type * as AppConstants from '../../../shared/core/common/constants';
import type * as AppDTOs from '../../../shared/core/contracts';
import {
  PopupComponent,
  SingleRowComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type CardMenuActionEvent,
  type DateInputModel,
  type DateInputRangeValue,
  type DateInputValue,
  type ListQuery,
  type PageResult,
  type PopupControl,
  type PopupDateInputChangeEvent,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SingleRowData,
  type SmartListCalendarCounter,
  type SmartListCalendarDateRange,
  type SmartListCalendarDay,
  type SmartListConfig,
  type SmartListItemSelectEvent,
  type SmartListLoadContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  AssetAvailabilitySingleRowConverter
} from '../../../shared/ui/converters';
import {
  AssetAvailabilityPopupStore,
  type AssetAvailabilityHeaderState,
  type AssetAvailabilityPopupRequest
} from '../../../shared/ui/context/stores/asset-availability-popup.store';
import {
  AssetStore
} from '../../../shared/ui/context/stores/asset.store';
import {
  SubEventResourcePopupStore,
  type SubEventResourceMetricsUpdate
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';

type AssetAvailabilityListItem = AppDTOs.AssetOccupancyStatDTO | AppDTOs.AssetOccupancyRowDTO;

interface AssetAvailabilityListFilters {
  revision: number;
  filter: AppDTOs.AssetAvailabilityFilter;
  order?: AppDTOs.AssetAvailabilityOrder;
  dateIso?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
}

type AssetAvailabilityPopupMenuContext =
  | { menu: 'order'; order: AppDTOs.AssetAvailabilityOrder }
  | { menu: 'view'; view: AppDTOs.AssetAvailabilityView }
  | { menu: 'filter'; target: 'availability' | 'day-list'; filter: AppDTOs.AssetAvailabilityFilter };

interface AssetAvailabilityScopedOverride<T> {
  requestIdentity: string;
  value: T;
}

@Component({
  selector: 'app-asset-availability-popup',
  standalone: true,
  imports: [
    CommonModule,
    PopupComponent,
    SmartListComponent,
    SingleRowComponent
  ],
  templateUrl: './asset-availability-popup.component.html',
  styleUrl: './asset-availability-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetAvailabilityPopupComponent {
  protected readonly availabilityPopupZIndex = 12100;
  protected readonly dayListPopupZIndex = 12200;
  private readonly assetsService = inject(AssetsService);
  private readonly i18n = inject(I18nService);
  private readonly assetStore = inject(AssetStore);
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  protected readonly availabilityPopupStore = inject(AssetAvailabilityPopupStore);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly availabilityRevision = signal(0);
  private readonly dayListRevision = signal(0);
  private readonly availabilityViewOverride = signal<AssetAvailabilityScopedOverride<AppDTOs.AssetAvailabilityView> | null>(null);
  private readonly availabilityOrderOverride = signal<AssetAvailabilityScopedOverride<AppDTOs.AssetAvailabilityOrder> | null>(null);
  private readonly availabilityFilterOverride = signal<AssetAvailabilityScopedOverride<AppDTOs.AssetAvailabilityFilter> | null>(null);
  private readonly dayListFilterOverride = signal<AssetAvailabilityScopedOverride<AppDTOs.AssetAvailabilityFilter> | null>(null);
  @ViewChild('availabilitySmartList') private availabilitySmartList?: SmartListComponent<AssetAvailabilityListItem, AssetAvailabilityListFilters>;
  @ViewChild('dayListSmartList') private dayListSmartList?: SmartListComponent<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters>;

  protected readonly availabilityView = computed<AppDTOs.AssetAvailabilityView>(() => {
    const request = this.availabilityPopupStore.availabilityPopup();
    return this.scopedOverrideValue(
      this.availabilityViewOverride(),
      this.requestIdentity(request),
      request?.view ?? 'day'
    );
  });
  protected readonly availabilityOrder = computed<AppDTOs.AssetAvailabilityOrder>(() => {
    const request = this.availabilityPopupStore.availabilityPopup();
    return this.scopedOverrideValue(
      this.availabilityOrderOverride(),
      this.requestIdentity(request),
      'later'
    );
  });
  protected readonly availabilityFilter = computed<AppDTOs.AssetAvailabilityFilter>(() => {
    const request = this.availabilityPopupStore.availabilityPopup();
    return this.scopedOverrideValue(
      this.availabilityFilterOverride(),
      this.requestIdentity(request),
      request?.filter ?? 'all'
    );
  });
  protected readonly dayListFilter = computed<AppDTOs.AssetAvailabilityFilter>(() => {
    const request = this.availabilityPopupStore.dayListPopup();
    return this.scopedOverrideValue(
      this.dayListFilterOverride(),
      this.requestIdentity(request),
      request?.filter ?? 'all'
    );
  });
  protected readonly availabilityQuery = computed<Partial<ListQuery<AssetAvailabilityListFilters>>>(() => {
    const request = this.availabilityPopupStore.availabilityPopup();
    const view = this.availabilityView();
    return this.buildQuery(
      view,
      this.availabilityFilter(),
      request?.initialDateIso ?? null,
      request?.rangeStart ?? null,
      request?.rangeEnd ?? null,
      this.availabilityRevision(),
      this.isCalendarAvailabilityView(view) ? null : this.availabilityOrder()
    );
  });
  protected readonly dayListQuery = computed<Partial<ListQuery<AssetAvailabilityListFilters>>>(() => {
    const request = this.availabilityPopupStore.dayListPopup();
    return this.buildQuery(
      'day',
      this.dayListFilter(),
      request?.initialDateIso ?? null,
      request?.rangeStart ?? null,
      request?.rangeEnd ?? null,
      this.dayListRevision(),
      this.availabilityOrder()
    );
  });
  protected readonly availabilityHeader = computed<AssetAvailabilityHeaderState | null>(
    () => this.availabilityPopupStore.availabilityHeader()
  );
  protected readonly dayListHeader = computed<AssetAvailabilityHeaderState | null>(
    () => this.availabilityPopupStore.dayListHeader() ?? this.availabilityPopupStore.availabilityHeader()
  );
  private readonly dayListDateRangeInputModel: DateInputModel = {
    mode: 'range',
    precision: 'date',
    valueFormat: 'iso-date',
    range: {
      layout: 'compact',
      start: {
        placeholder: 'Start date'
      },
      end: {
        placeholder: 'End date'
      }
    }
  };
  private readonly dayListDateRangeInputValue = computed<DateInputRangeValue>(() => {
    const request = this.availabilityPopupStore.dayListPopup();
    const fallback = this.dateInputDateKey(request?.initialDateIso) ?? AppUtils.toIsoDate(new Date());
    const startAt = this.dateInputDateKey(request?.rangeStart) ?? fallback;
    const endAt = this.dateInputDateKey(request?.rangeEnd) ?? startAt;
    return {
      startAt,
      endAt,
      precision: 'date'
    };
  });
  protected readonly resourcePopupOutletInputs = computed(() => ({
    parentZIndex: this.resourcePopupParentZIndex()
  }));
  protected readonly assetExplorePopupOutletInputs = computed(() => ({
    parentZIndex: this.resourcePopupParentZIndex()
  }));
  protected rowBusyKey = '';

  constructor() {
    effect(() => {
      const request = this.resourcePopupStore.subEventResourcePopupRequest();
      if (!request || !this.isAnyAvailabilityPopupOpen()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      if (!this.shouldHostResourcePopup()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      if (!this.shouldHostResourcePopup() || !this.resourcePopupStore.assetExplorePopupRef()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourceAssetExploreLoaded();
    });

    effect(() => {
      if (!this.shouldHostSupplyContributionsPopup()) {
        return;
      }
      void this.resourcePopupStore.ensureEventSupplyContributionsPopupLoaded();
    });

    effect(() => {
      const update = this.resourcePopupStore.subEventResourceMetricsUpdate();
      if (!update || !this.isAnyAvailabilityPopupOpen()) {
        return;
      }
      this.applyResourceAssignmentQuantityUpdate(update);
    });
  }

  protected readonly availabilitySmartListConfig: SmartListConfig<AssetAvailabilityListItem, AssetAvailabilityListFilters> = {
    pageSize: 40,
    initialPageSize: 40,
    defaultView: 'day',
    views: [
      { key: 'month', label: 'Month', mode: 'month', pageSize: 42 },
      { key: 'week', label: 'Week', mode: 'week', pageSize: 14 },
      { key: 'day', label: 'Day', mode: 'list', pageSize: 20 }
    ],
    calendarVariant: query => query.view === 'week' || query.view === 'month' ? 'counter' : 'default',
    calendar: {
      weekdayLabels: APP_STATIC_DATA.calendarWeekdayLabels,
      weekStartHour: 0,
      weekEndHour: 23,
      anchorRadius: 1,
      counterGranularity: 'day',
      initialAnchor: query => query.filters?.dateIso ?? null,
      resolveDateRange: item => this.availabilityDateRange(item),
      dayCounter: day => this.availabilityDayCounter(day)
    },
    emptyLabel: 'asset.requests.empty.availability.label',
    emptyDescription: query => this.assetAvailabilityEmptyDescription(query),
    headerProgress: {
      enabled: true,
      state: 'active'
    },
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'mandatory',
    showStickyHeader: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: (item, query) => this.groupLabelForItem(item, query.view as AppDTOs.AssetAvailabilityView),
    trackBy: (index, item) => this.availabilityItemKey(item, index)
  };

  protected readonly dayListSmartListConfig: SmartListConfig<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters> = {
    pageSize: 20,
    defaultView: 'day',
    views: [
      { key: 'day', label: 'Day', mode: 'list', pageSize: 20 }
    ],
    emptyLabel: 'asset.requests.empty.day.label',
    emptyDescription: query => this.assetAvailabilityEmptyDescription(query),
    headerProgress: {
      enabled: true,
      state: 'active'
    },
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'proximity',
    showStickyHeader: false,
    showGroupMarker: () => false,
    groupBy: item => this.groupLabelForDate(item.dateIso, 'day'),
    trackBy: (_index, item) => item.id
  };

  protected isAvailabilityOpen(): boolean {
    return this.availabilityPopupStore.availabilityPopup() !== null;
  }

  protected isDayListOpen(): boolean {
    return this.availabilityPopupStore.dayListPopup() !== null;
  }

  protected shouldHostResourcePopup(): boolean {
    return this.isAnyAvailabilityPopupOpen()
      && (this.resourcePopupStore.subEventResourcePopupRequest() !== null
        || this.resourcePopupStore.popupContextRef()?.origin === 'subEventResource');
  }

  protected shouldHostSupplyContributionsPopup(): boolean {
    return this.shouldHostResourcePopup()
      && !this.resourcePopupStore.assetExploreOnlyRef()
      && this.resourcePopupStore.supplyPopupRef() !== null;
  }

  private isAnyAvailabilityPopupOpen(): boolean {
    return this.isAvailabilityOpen() || this.isDayListOpen();
  }

  private resourcePopupParentZIndex(): number {
    return Math.max(this.availabilityPopupZIndex, this.dayListPopupZIndex);
  }

  protected availabilityPopupModel(): PopupModel<AssetAvailabilityPopupMenuContext> {
    const header = this.availabilityHeader();
    return {
      title: header?.title ?? 'Asset availability',
      subtitle: this.availabilitySubtitle(),
      secondarySubtitle: null,
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      closeAriaLabel: 'Close asset availability',
      headerControls: this.availabilityHeaderControls(),
      toolbarControls: this.availabilityToolbarControls(),
      onClose: () => this.availabilityPopupStore.closeAvailabilityPopup(),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected dayListPopupModel(): PopupModel<AssetAvailabilityPopupMenuContext> {
    const header = this.dayListHeader();
    return {
      title: header?.title ?? 'Availability items',
      subtitle: header?.subtitle ?? null,
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      closeAriaLabel: 'Close day availability',
      toolbarControls: this.dayListToolbarControls(),
      onClose: () => this.availabilityPopupStore.closeDayListPopup(),
      onMenuSelect: event => this.onPopupMenuSelect(event),
      onDateInputChange: event => this.onPopupDateInputChange(event)
    };
  }

  protected readonly availabilitySmartListLoadPage: SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters> =
    (query, context): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      if (query.view === 'week' || query.view === 'month') {
        return this.loadStatsPage(query, context);
      }
      return this.loadRowsPage(query, context);
    };

  private readonly loadStatsPage = (
    query: ListQuery<AssetAvailabilityListFilters>,
    context?: SmartListLoadContext
  ): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      const request = this.availabilityPopupStore.availabilityPopup();
      if (!request) {
        return from([this.emptyPage<AssetAvailabilityListItem>()]);
      }
      return from(this.assetsService.loadStatByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        rangeStart: query.rangeStart ?? query.filters?.dateIso ?? undefined,
        rangeEnd: query.rangeEnd ?? query.filters?.dateIso ?? undefined,
        filter: query.filters?.filter ?? request.filter,
        order: undefined,
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      }, { signal: context?.signal })).pipe(map(result => ({
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor ?? null
        })));
    };

  private readonly loadRowsPage = (
    query: ListQuery<AssetAvailabilityListFilters>,
    context?: SmartListLoadContext
  ): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      const request = this.availabilityPopupStore.availabilityPopup();
      if (!request) {
        return from([this.emptyPage<AssetAvailabilityListItem>()]);
      }
      return from(this.assetsService.loadOccupancyByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        dateIso: query.filters?.dateIso ?? request.initialDateIso ?? undefined,
        rangeStart: query.rangeStart ?? query.filters?.rangeStart ?? request.rangeStart ?? undefined,
        rangeEnd: query.rangeEnd ?? query.filters?.rangeEnd ?? request.rangeEnd ?? undefined,
        filter: query.filters?.filter ?? request.filter,
        order: query.filters?.order ?? this.orderFromDirection(query.direction),
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      }, { signal: context?.signal })).pipe(map(result => ({
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor ?? null
        })));
    };

  protected readonly dayListSmartListLoadPage: SmartListLoadPage<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters> =
    (query, context): ReturnType<SmartListLoadPage<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters>> => {
      const request = this.availabilityPopupStore.dayListPopup();
      if (!request) {
        return from([this.emptyPage<AppDTOs.AssetOccupancyRowDTO>()]);
      }
      return from(this.assetsService.loadOccupancyByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        dateIso: query.filters?.dateIso ?? request.initialDateIso ?? undefined,
        rangeStart: query.rangeStart ?? query.filters?.rangeStart ?? request.rangeStart ?? undefined,
        rangeEnd: query.rangeEnd ?? query.filters?.rangeEnd ?? request.rangeEnd ?? undefined,
        filter: query.filters?.filter ?? request.filter,
        order: query.filters?.order ?? this.orderFromDirection(query.direction),
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      }, { signal: context?.signal })).pipe(map(result => ({
        items: result.items,
        total: result.total,
        nextCursor: result.nextCursor ?? null
        })));
    };

  protected isAvailabilityRow(item: AssetAvailabilityListItem): item is AppDTOs.AssetOccupancyRowDTO {
    return 'requestKind' in item;
  }

  protected availabilityRow(
    row: AppDTOs.AssetOccupancyRowDTO,
    groupLabel: string | null | undefined
  ): SingleRowData<AppDTOs.AssetOccupancyRowDTO> {
    const converted = AssetAvailabilitySingleRowConverter.convert(row, {
      groupLabel,
      translate: (key, fallback) => this.i18n.translate(key, fallback)
    });
    return {
      ...converted,
      menuActions: this.rowMenuActions(row)
    };
  }

  private applyResourceAssignmentQuantityUpdate(update: SubEventResourceMetricsUpdate): void {
    const updates = update.assignmentQuantityUpdates ?? [];
    if (updates.length === 0) {
      return;
    }
    let patched = false;
    for (const item of updates) {
      const assetId = `${item.assetId ?? ''}`.trim();
      const subEventId = `${item.subEventId ?? ''}`.trim();
      const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      if (!assetId || !subEventId) {
        continue;
      }
      const patchRow = (row: AppDTOs.AssetOccupancyRowDTO): AppDTOs.AssetOccupancyRowDTO => {
        const previousQuantity = Math.max(1, Math.trunc(Number(row.quantity) || 1));
        const previousCapacity = Math.max(0, Math.trunc(Number(row.capacity) || 0));
        const baseCapacity = Math.max(0, Math.trunc(previousCapacity / previousQuantity));
        const capacity = baseCapacity * quantity;
        const occupied = Math.max(0, Math.trunc(Number(row.occupied) || 0));
        return {
          ...row,
          quantity,
          capacity,
          occupied,
          remaining: Math.max(0, capacity - occupied)
        };
      };
      const predicate = (row: AppDTOs.AssetOccupancyRowDTO): boolean =>
        `${row.assetId ?? ''}`.trim() === assetId
        && `${row.subEventId ?? ''}`.trim() === subEventId
        && row.requestKind === 'manual';
      patched = this.availabilitySmartList?.patchVisibleItem(
        (row): row is AppDTOs.AssetOccupancyRowDTO => this.isAvailabilityRow(row) && predicate(row),
        row => this.isAvailabilityRow(row) ? patchRow(row) : row
      ) === true || patched;
      patched = this.dayListSmartList?.patchVisibleItem(
        row => predicate(row),
        row => patchRow(row)
      ) === true || patched;
    }
    if (this.isCalendarAvailabilityView(this.availabilityView())) {
      this.availabilityRevision.update(revision => revision + 1);
    }
    if (patched) {
      this.cdr.markForCheck();
    }
  }

  protected async onRowMenuAction(
    event: CardMenuActionEvent<SingleRowData>
  ): Promise<void> {
    const row = this.rowDetail(event.card.eagerDetail);
    const action = event.actionId as AppConstants.AssetRequestAction;
    if (!row || (action !== 'accept' && action !== 'remove' && action !== 'makeManager' && action !== 'manage')) {
      return;
    }
    if (action === 'manage') {
      this.openAvailabilityResourceManager(row);
      return;
    }
    const busyKey = `${row.assetId}:${row.id}:${action}`;
    this.rowBusyKey = busyKey;
    this.cdr.markForCheck();
    try {
      if (action === 'makeManager') {
        await this.promoteAssetRequestToManager(row);
      } else {
        await this.applyAssetRequestAction(row, action);
      }
      this.reloadLists();
    } finally {
      if (this.rowBusyKey === busyKey) {
        this.rowBusyKey = '';
      }
      this.cdr.markForCheck();
    }
  }

  protected onSharedRowMenuAction(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as {
      row?: SingleRowData;
      card?: SingleRowData;
      action?: { id?: string };
    } | null | undefined;
    const row = context?.row ?? context?.card ?? null;
    const actionId = `${context?.action?.id ?? event.id ?? ''}`.trim();
    if (!row || !actionId) {
      return;
    }
    void this.onRowMenuAction({
      id: row.id,
      actionId,
      action: {
        id: actionId
      } as CardMenuActionEvent<SingleRowData>['action'],
      card: row
    });
  }

  protected onCalendarItemSelect(event: SmartListItemSelectEvent<AssetAvailabilityListItem, AssetAvailabilityListFilters>): void {
    const request = this.availabilityPopupStore.availabilityPopup();
    const dateIso = this.dateInputDateKey(event.calendarDateIso ?? event.calendarDate)
      ?? this.dateInputDateKey(event.item.dateIso)
      ?? `${event.item.dateIso ?? ''}`.trim();
    if (!request || !dateIso) {
      return;
    }
    const rangeStart = this.dateInputDateKey(dateIso) ?? dateIso;
    const rangeEnd = rangeStart;
    this.availabilityPopupStore.openDayListPopup(
      {
        instanceId: `asset-availability-day:${request.assetId}:${rangeStart}:${rangeEnd}`,
        assetId: request.assetId,
        ownerUserId: request.ownerUserId,
        initialDateIso: rangeStart,
        rangeStart,
        rangeEnd,
        filter: this.availabilityFilter(),
        view: 'day',
        source: 'calendar-cell'
      },
      this.availabilityHeader()
    );
    void this.availabilityPopupStore.ensureAssetAvailabilityPopupLoaded();
  }

  protected onViewChange(view: string): void {
    if (view === 'day' || view === 'week' || view === 'month') {
      this.selectAvailabilityView(view);
    }
  }

  private onPopupDateInputChange(event: PopupDateInputChangeEvent<AssetAvailabilityPopupMenuContext>): void {
    if (event.control.id !== 'day-list-date-range') {
      return;
    }
    this.selectDayListRange(event.value);
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<AssetAvailabilityPopupMenuContext>): void {
    const context = event.itemSelect.item?.context;
    if (!context) {
      return;
    }
    if (context.menu === 'order') {
      this.selectAvailabilityOrder(context.order);
      return;
    }
    if (context.menu === 'view') {
      this.selectAvailabilityView(context.view);
      return;
    }
    if (context.menu === 'filter') {
      if (context.target === 'day-list') {
        this.selectDayListFilter(context.filter);
        return;
      }
      this.selectAvailabilityFilter(context.filter);
    }
  }

  private selectAvailabilityView(view: AppDTOs.AssetAvailabilityView): void {
    if (this.availabilityView() === view) {
      return;
    }
    const request = this.availabilityPopupStore.availabilityPopup();
    this.availabilityViewOverride.set({
      requestIdentity: this.requestIdentity(request),
      value: view
    });
    this.availabilityRevision.update(revision => revision + 1);
  }

  private selectAvailabilityOrder(order: AppDTOs.AssetAvailabilityOrder): void {
    if (this.availabilityOrder() === order) {
      return;
    }
    const request = this.availabilityPopupStore.availabilityPopup();
    this.availabilityOrderOverride.set({
      requestIdentity: this.requestIdentity(request),
      value: order
    });
    this.availabilityRevision.update(revision => revision + 1);
    this.dayListRevision.update(revision => revision + 1);
  }

  private selectAvailabilityFilter(filter: AppDTOs.AssetAvailabilityFilter): void {
    if (this.availabilityFilter() === filter) {
      return;
    }
    const request = this.availabilityPopupStore.availabilityPopup();
    this.availabilityFilterOverride.set({
      requestIdentity: this.requestIdentity(request),
      value: filter
    });
    this.availabilityRevision.update(revision => revision + 1);
  }

  private selectDayListFilter(filter: AppDTOs.AssetAvailabilityFilter): void {
    if (this.dayListFilter() === filter) {
      return;
    }
    const request = this.availabilityPopupStore.dayListPopup();
    this.dayListFilterOverride.set({
      requestIdentity: this.requestIdentity(request),
      value: filter
    });
    this.dayListRevision.update(revision => revision + 1);
  }

  private selectDayListRange(value: DateInputValue): void {
    if (!this.isDateInputRangeValue(value)) {
      return;
    }
    const startAt = this.dateInputDateKey(value.startAt) ?? this.dateInputDateKey(value.endAt);
    const endAt = this.dateInputDateKey(value.endAt) ?? startAt;
    if (!startAt || !endAt) {
      return;
    }
    const request = this.availabilityPopupStore.dayListPopup();
    if (
      this.dateInputDateKey(request?.rangeStart) === startAt
      && this.dateInputDateKey(request?.rangeEnd) === endAt
    ) {
      return;
    }
    this.availabilityPopupStore.updateDayListRange(startAt, endAt, this.dayListFilter());
  }

  private availabilityHeaderControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    const controls: PopupControl<AssetAvailabilityPopupMenuContext>[] = [];
    if (this.availabilityView() === 'day') {
      controls.push({
        kind: 'menu',
        id: 'order',
        trigger: this.orderMenuTrigger(),
        items: this.orderMenuItems()
      });
    }
    controls.push({
      kind: 'menu',
      id: 'view',
      trigger: this.viewMenuTrigger(),
      items: this.viewMenuItems()
    });
    return controls;
  }

  private availabilityToolbarControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'filter',
      align: 'end',
      trigger: this.filterMenuTrigger(this.availabilityFilter(), 'availability'),
      items: this.filterMenuItems('availability')
    }];
  }

  private dayListToolbarControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    return [
      {
        kind: 'date-input',
        id: 'day-list-date-range',
        model: this.dayListDateRangeInputModel,
        value: this.dayListDateRangeInputValue()
      },
      {
        kind: 'menu',
        id: 'day-list-filter',
        align: 'end',
        trigger: this.filterMenuTrigger(this.dayListFilter(), 'day-list'),
        items: this.filterMenuItems('day-list')
      }
    ];
  }

  private viewMenuTrigger(): AppMenuTrigger {
    const view = this.availabilityView();
    const option = APP_STATIC_DATA.activitiesViewOptions.find(item => item.key === view);
    return this.availabilitySelectTrigger({
      label: option?.label ?? 'View',
      icon: option?.icon ?? 'view_agenda',
      palette: this.viewPalette(view),
      ariaLabel: 'Open availability view',
      collapsible: true
    });
  }

  private orderMenuTrigger(): AppMenuTrigger {
    const order = this.availabilityOrder();
    const option = this.orderMenuOptions().find(item => item.key === order) ?? this.orderMenuOptions()[0];
    return this.availabilitySelectTrigger({
      label: option.label,
      icon: option.icon,
      palette: this.orderPalette(order),
      ariaLabel: 'asset.requests.order.open',
      collapsible: true
    });
  }

  private orderMenuItems(): readonly AppMenuItem<string, AssetAvailabilityPopupMenuContext>[] {
    const activeOrder = this.availabilityOrder();
    return this.orderMenuOptions().map(option => ({
      id: `asset-availability-order:${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === activeOrder,
      palette: this.orderPalette(option.key),
      surface: 'tinted',
      context: { menu: 'order', order: option.key }
    }));
  }

  private orderMenuOptions(): Array<{ key: AppDTOs.AssetAvailabilityOrder; label: string; icon: string }> {
    return [
      { key: 'earlier', label: 'asset.requests.order.earlier', icon: 'history' },
      { key: 'later', label: 'asset.requests.order.later', icon: 'schedule' }
    ];
  }

  private viewMenuItems(): readonly AppMenuItem<string, AssetAvailabilityPopupMenuContext>[] {
    return APP_STATIC_DATA.activitiesViewOptions
      .filter(option => option.key === 'month' || option.key === 'week' || option.key === 'day')
      .map(option => {
        const view = option.key as AppDTOs.AssetAvailabilityView;
        return {
        id: `availability-view:${option.key}`,
        label: option.label,
        icon: option.icon,
        kind: 'radio',
        active: view === this.availabilityView(),
        palette: this.viewPalette(view),
        surface: 'tinted',
        context: { menu: 'view', view }
      };
      });
  }

  private filterMenuTrigger(
    filter: AppDTOs.AssetAvailabilityFilter,
    target: 'availability' | 'day-list'
  ): AppMenuTrigger {
    const option = this.filterOptions().find(item => item.key === filter) ?? this.filterOptions()[0];
    return this.availabilitySelectTrigger({
      label: option.label,
      icon: option.icon,
      palette: this.filterPalette(filter),
      ariaLabel: 'asset.requests.filter.open',
      counter: this.filterCounter(filter, target)
    });
  }

  private filterMenuItems(
    target: 'availability' | 'day-list'
  ): readonly AppMenuItem<string, AssetAvailabilityPopupMenuContext>[] {
    const activeFilter = target === 'day-list' ? this.dayListFilter() : this.availabilityFilter();
    return this.filterOptions().map(option => ({
      id: `asset-availability-filter:${target}:${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === activeFilter,
      palette: this.filterPalette(option.key),
      surface: 'tinted',
      counter: this.menuCounter(this.filterCounter(option.key, target)),
      context: { menu: 'filter', target, filter: option.key }
    }));
  }

  private filterOptions(): Array<{ key: AppDTOs.AssetAvailabilityFilter; label: string; icon: string }> {
    return [
      { key: 'all', label: 'all', icon: 'view_list' },
      { key: 'active-items', label: 'asset.requests.filter.active.items', icon: 'inventory_2' },
      { key: 'pending-requests', label: 'asset.requests.filter.pending.requests', icon: 'pending_actions' },
      { key: 'borrowed-items', label: 'asset.requests.filter.borrowed.items', icon: 'assignment_returned' }
    ];
  }

  private availabilitySelectTrigger(options: {
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    layout?: AppMenuTrigger['layout'];
    hideLabel?: boolean;
    collapsible?: boolean;
    ariaLabel?: string;
  }): AppMenuTrigger {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      layout: options.layout ?? 'pill',
      hideLabel: options.hideLabel,
      collapsible: options.collapsible,
      ariaLabel: options.ariaLabel,
      counter: counter > 0 ? { value: counter, max: 99 } : null
    };
  }

  private menuCounter(count: number): AppMenuItem<string, AssetAvailabilityPopupMenuContext>['counter'] {
    const normalized = Math.max(0, Math.trunc(Number(count) || 0));
    return normalized > 0 ? { value: normalized, max: 99 } : null;
  }

  private filterCounter(
    filter: AppDTOs.AssetAvailabilityFilter,
    target: 'availability' | 'day-list'
  ): number {
    if (target !== 'availability') {
      return 0;
    }
    const metrics = this.availabilityHeader()?.metrics;
    if (!metrics) {
      return 0;
    }
    switch (filter) {
      case 'active-items':
        return this.normalizeCount(metrics.activeItems);
      case 'pending-requests':
        return this.normalizeCount(metrics.pendingItems);
      case 'borrowed-items':
        return this.normalizeCount(metrics.borrowedItems);
      case 'all':
      default:
        return this.normalizeCount(metrics.activeItems) + this.normalizeCount(metrics.pendingItems);
    }
  }

  private normalizeCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  }

  private viewPalette(view: string): AppMenuPalette {
    switch (view) {
      case 'month':
        return 'blue';
      case 'week':
        return 'violet';
      case 'day':
        return 'green';
      default:
        return 'default';
    }
  }

  private orderPalette(order: AppDTOs.AssetAvailabilityOrder): AppMenuPalette {
    return order === 'later' ? 'blue' : 'slate';
  }

  private assetAvailabilityEmptyDescription(query: ListQuery<AssetAvailabilityListFilters>): string {
    if (this.isCalendarAvailabilityView(query.view as AppDTOs.AssetAvailabilityView)) {
      return '';
    }
    const order = query.filters?.order ?? this.orderFromDirection(query.direction);
    return order === 'earlier'
      ? 'asset.requests.empty.earlier.description'
      : 'asset.requests.empty.later.description';
  }

  private filterPalette(filter: AppDTOs.AssetAvailabilityFilter): AppMenuPalette {
    switch (filter) {
      case 'pending-requests':
        return 'amber';
      case 'borrowed-items':
        return 'violet';
      case 'active-items':
        return 'green';
      case 'all':
      default:
        return 'blue';
    }
  }

  private availabilityDayCounter(day: SmartListCalendarDay<AssetAvailabilityListItem>): SmartListCalendarCounter | null {
    const stat = day.items.find(item => this.isAvailabilityStat(item)) ?? null;
    if (!stat) {
      return null;
    }
    const capacity = stat.capacity > 0 ? stat.capacity : (this.availabilityHeader()?.capacity ?? 0);
    return {
      label: `${stat.occupied}/${capacity}`,
      ariaLabel: `${stat.occupied} occupied of ${capacity} capacity`,
      alertLabel: stat.pendingCount > 0 ? `${stat.pendingCount}` : null,
      alertAriaLabel: stat.pendingCount > 0 ? `${stat.pendingCount} pending` : null,
      toneClass: this.counterTone(stat, capacity)
    };
  }

  private counterTone(stat: AppDTOs.AssetOccupancyStatDTO, capacity = stat.capacity): string {
    if (stat.occupied <= 0) {
      return 'calendar-counter-empty';
    }
    if (stat.occupied > capacity) {
      return 'calendar-counter-over';
    }
    if (capacity > 0 && stat.occupied >= capacity) {
      return 'calendar-counter-full';
    }
    return '';
  }

  private availabilityDateRange(item: AssetAvailabilityListItem): SmartListCalendarDateRange | null {
    const start = AppUtils.parseDate(item.startAtIso) ?? AppUtils.parseDateOnlyLocal(item.dateIso);
    if (!start) {
      return null;
    }
    if (this.isAvailabilityStat(item)) {
      const day = AppUtils.parseDateOnlyLocal(item.dateIso) ?? AppUtils.dateOnly(start);
      return { start: day, end: day };
    }
    const end = AppUtils.parseDate(item.endAtIso) ?? AppUtils.addDays(start, 1);
    return { start, end };
  }

  private isAvailabilityStat(item: AssetAvailabilityListItem): item is AppDTOs.AssetOccupancyStatDTO {
    return 'itemCount' in item;
  }

  private rowMenuActions(row: AppDTOs.AssetOccupancyRowDTO): AppConstants.AssetRequestAction[] {
    const actions = row.menuActions ?? [];
    if (!this.rowBusyKey.startsWith(`${row.assetId}:${row.id}:`)) {
      return [...actions];
    }
    return [];
  }

  private openAvailabilityResourceManager(row: AppDTOs.AssetOccupancyRowDTO): void {
    const ownerId = `${row.eventId ?? ''}`.trim();
    const subEventId = `${row.subEventId ?? ''}`.trim();
    const type = this.availabilityResourceType(row);
    if (!ownerId || !subEventId || !type) {
      return;
    }
    const eventTitle = `${row.eventTitle ?? ''}`.trim() || this.availabilityHeader()?.title || 'Event';
    const subEventTitle = `${row.subEventTitle ?? ''}`.trim() || 'Sub Event';
    const startAt = `${row.subEventStartAtIso ?? row.startAtIso ?? ''}`.trim();
    const endAt = `${row.subEventEndAtIso ?? row.endAtIso ?? ''}`.trim();
    const timeframe = AppUtils.dateTimeRangeLabel(startAt, endAt, '');
    this.resourcePopupStore.requestSubEventResourcePopup({
      type,
      ownerId,
      parentTitle: eventTitle,
      subEventId,
      popupHeader: {
        title: this.joinDistinctResourcePopupHeaderLabels([eventTitle, subEventTitle]) || eventTitle,
        subtitle: timeframe || null
      },
      subEventHeader: {
        name: subEventTitle,
        title: subEventTitle,
        startAt: startAt || null,
        endAt: endAt || null
      }
    });
    void this.resourcePopupStore.ensureEventResourcePopupLoaded();
  }

  private joinDistinctResourcePopupHeaderLabels(parts: readonly string[]): string {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const part of parts) {
      const value = `${part ?? ''}`.trim();
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) {
        continue;
      }
      seen.add(key);
      labels.push(value);
    }
    return labels.join(' - ');
  }

  private availabilityResourceType(row: AppDTOs.AssetOccupancyRowDTO): AppConstants.AssetType | null {
    const headerType = `${this.availabilityHeader()?.type ?? this.dayListHeader()?.type ?? ''}`.trim();
    if (this.isAssetResourceType(headerType)) {
      return headerType;
    }
    const assetType = this.assetStore.findAsset(row.assetId)?.type ?? '';
    return this.isAssetResourceType(assetType) ? assetType : null;
  }

  private isAssetResourceType(value: string): value is AppConstants.AssetType {
    return value === 'Car' || value === 'Accommodation' || value === 'Supplies';
  }

  private async applyAssetRequestAction(
    row: AppDTOs.AssetOccupancyRowDTO,
    action: Extract<AppConstants.AssetRequestAction, 'accept' | 'remove'>
  ): Promise<void> {
    const assetDetail = await this.assetsService.loadOwnedAssetDetailById(row.ownerUserId, row.assetId);
    if (!assetDetail) {
      return;
    }
    let nextQuantity = AssetCardBuilder.storedQuantityValue(assetDetail);
    const nextRequests = assetDetail.requests
      .map(request => AssetCardBuilder.cloneRequest(request))
      .filter(request => {
        if (request.id !== row.id) {
          return true;
        }
        if (action === 'remove') {
          return false;
        }
        request.status = 'accepted';
        request.note = request.requestKind === 'manual'
          ? 'Reserved and assigned by the owner.'
          : 'Borrow request approved by the owner.';
        if (request.requestKind !== 'manual' && request.booking?.inventoryApplied !== true) {
          nextQuantity = Math.max(0, nextQuantity - this.assetRequestQuantity(request));
          request.booking = request.booking
            ? {
                ...request.booking,
                inventoryApplied: true
              }
            : null;
        }
        return true;
      });
    const savedCard = await this.assetsService.saveOwnedAsset(row.ownerUserId, {
      ...assetDetail,
      quantity: nextQuantity,
      requests: nextRequests
    });
    this.replaceAssetCardIfVisible(savedCard, row.ownerUserId);
  }

  private async promoteAssetRequestToManager(row: AppDTOs.AssetOccupancyRowDTO): Promise<void> {
    const assetDetail = await this.assetsService.loadOwnedAssetDetailById(row.ownerUserId, row.assetId);
    const targetUserId = `${this.assetRequestById(row)?.userId
      ?? assetDetail?.requests.find(request => request.id === row.id)?.userId
      ?? ''}`.trim();
    if (!targetUserId || !assetDetail) {
      return;
    }
    const savedCard = await this.assetsService.makeAssetManager(row.ownerUserId, row.assetId, targetUserId);
    if (savedCard) {
      this.replaceAssetCardIfVisible(savedCard, row.ownerUserId);
    }
  }

  private assetRequestById(row: AppDTOs.AssetOccupancyRowDTO): AppDTOs.AssetMemberRequestDTO | null {
    const visible = this.assetStore.findAsset(row.assetId)?.requests.find(request => request.id === row.id) ?? null;
    if (visible) {
      return visible;
    }
    return null;
  }

  private replaceAssetCardIfVisible(card: AppDTOs.AssetDTO, ownerUserId: string): void {
    if (this.assetStore.isActiveOwnerUser(ownerUserId)) {
      this.assetStore.replaceAssetCard(card, { reloadList: false, mutation: true });
      this.assetStore.touchUiState();
    }
  }

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }

  private reloadLists(): void {
    this.availabilityRevision.update(revision => revision + 1);
    this.dayListRevision.update(revision => revision + 1);
  }

  private emptyPage<T>(): PageResult<T> {
    return { items: [], total: 0, nextCursor: null };
  }

  private buildQuery(
    view: AppDTOs.AssetAvailabilityView,
    filter: AppDTOs.AssetAvailabilityFilter,
    dateIso: string | null,
    rangeStart: string | null,
    rangeEnd: string | null,
    revision = 0,
    order: AppDTOs.AssetAvailabilityOrder | null = 'later'
  ): Partial<ListQuery<AssetAvailabilityListFilters>> {
    const isCalendarView = this.isCalendarAvailabilityView(view);
    const normalizedRangeStart = `${rangeStart ?? ''}`.trim() || undefined;
    const normalizedRangeEnd = `${rangeEnd ?? ''}`.trim() || undefined;
    return {
      view,
      direction: isCalendarView ? undefined : (order === 'earlier' ? 'desc' : 'asc'),
      ...(normalizedRangeStart ? { rangeStart: normalizedRangeStart } : {}),
      ...(normalizedRangeEnd ? { rangeEnd: normalizedRangeEnd } : {}),
      filters: {
        revision,
        filter,
        ...(isCalendarView || !order ? {} : { order }),
        dateIso: `${dateIso ?? ''}`.trim() || null,
        rangeStart: normalizedRangeStart ?? null,
        rangeEnd: normalizedRangeEnd ?? null
      }
    };
  }

  private isCalendarAvailabilityView(view: AppDTOs.AssetAvailabilityView): boolean {
    return view === 'week' || view === 'month';
  }

  private orderFromDirection(direction: string | null | undefined): AppDTOs.AssetAvailabilityOrder {
    return direction === 'desc' ? 'earlier' : 'later';
  }

  private isDateInputRangeValue(value: DateInputValue): value is DateInputRangeValue {
    return !!value
      && typeof value === 'object'
      && 'startAt' in value
      && 'endAt' in value;
  }

  private dateInputDateKey(value: unknown): string | null {
    const parsed = AppUtils.parseDateOnlyLocal(value);
    return parsed ? AppUtils.toIsoDate(parsed) : null;
  }

  private scopedOverrideValue<T>(
    override: AssetAvailabilityScopedOverride<T> | null,
    requestIdentity: string,
    fallback: T
  ): T {
    return override?.requestIdentity === requestIdentity ? override.value : fallback;
  }

  private requestIdentity(request: AssetAvailabilityPopupRequest | null | undefined): string {
    if (!request) {
      return '';
    }
    return [
      request.instanceId,
      request.assetId,
      request.ownerUserId,
      request.initialDateIso ?? '',
      request.rangeStart ?? '',
      request.rangeEnd ?? '',
      request.filter,
      request.view,
      request.updatedMs
    ].join(':');
  }

  private availabilityItemKey(item: AssetAvailabilityListItem, index: number): string {
    return `${item.assetId}:${item.dateIso}:${item.id}:${index}`;
  }

  private availabilitySubtitle(): string | null {
    const header = this.availabilityHeader();
    if (!header) {
      return 'Time-based requests and assignments';
    }
    return header.subtitle || 'Time-based requests and assignments';
  }

  private groupLabelForItem(
    item: AssetAvailabilityListItem,
    view: AppDTOs.AssetAvailabilityView
  ): string {
    return this.groupLabelForDate(item.dateIso, view);
  }

  private groupLabelForDate(dateIso: string, view: AppDTOs.AssetAvailabilityView): string {
    const parsed = AppUtils.parseDateOnlyLocal(dateIso) ?? AppUtils.parseDate(dateIso);
    if (!parsed) {
      return 'Availability';
    }
    if (view === 'month') {
      return parsed.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  private rowDetail(value: unknown): AppDTOs.AssetOccupancyRowDTO | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return 'requestKind' in value && 'assetId' in value && 'ownerUserId' in value
      ? value as AppDTOs.AssetOccupancyRowDTO
      : null;
  }
}
