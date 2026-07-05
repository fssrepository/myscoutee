import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject
} from '@angular/core';
import { from, map } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AssetCardBuilder } from '../../../shared/core/base/builders';
import {
  AssetsService
} from '../../../shared/core';
import type * as AppConstants from '../../../shared/core/common/constants';
import type * as AppDTOs from '../../../shared/core/contracts';
import {
  PopupComponent,
  SingleRowComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuPalette,
  type AppMenuTrigger,
  type CardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SingleRowData,
  type SmartListCalendarCounter,
  type SmartListCalendarDateRange,
  type SmartListCalendarDay,
  type SmartListConfig,
  type SmartListItemSelectEvent,
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
  UserProfileStore
} from '../../../shared/ui/context/stores/user-profile.store';

type AssetAvailabilityListItem = AppDTOs.AssetOccupancyStatDTO | AppDTOs.AssetOccupancyRowDTO;

interface AssetAvailabilityListFilters {
  revision: number;
  filter: AppDTOs.AssetAvailabilityFilter;
  dateIso?: string | null;
  requestKey: string;
}

type AssetAvailabilityPopupMenuContext =
  | { menu: 'view'; view: AppDTOs.AssetAvailabilityView }
  | { menu: 'filter'; target: 'availability' | 'day-list'; filter: AppDTOs.AssetAvailabilityFilter };

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
  private readonly assetsService = inject(AssetsService);
  private readonly assetStore = inject(AssetStore);
  private readonly userProfileStore = inject(UserProfileStore);
  protected readonly availabilityPopupStore = inject(AssetAvailabilityPopupStore);
  private readonly cdr = inject(ChangeDetectorRef);

  protected availabilityView: AppDTOs.AssetAvailabilityView = 'month';
  protected availabilityFilter: AppDTOs.AssetAvailabilityFilter = 'all';
  protected dayListFilter: AppDTOs.AssetAvailabilityFilter = 'all';
  protected availabilityQuery: Partial<ListQuery<AssetAvailabilityListFilters>> = this.buildQuery(
    'month',
    'all',
    null,
    'initial'
  );
  protected dayListQuery: Partial<ListQuery<AssetAvailabilityListFilters>> = this.buildQuery(
    'day',
    'all',
    null,
    'initial-day-list'
  );
  protected header: AssetAvailabilityHeaderState | null = null;
  protected rowBusyKey = '';
  protected readonly availabilityViewChangeHandler = (view: string): void => this.onViewChange(view);
  protected readonly availabilityItemSelectHandler = (
    event: SmartListItemSelectEvent<unknown, AssetAvailabilityListFilters>
  ): void => this.onCalendarItemSelect(event as SmartListItemSelectEvent<AssetAvailabilityListItem, AssetAvailabilityListFilters>);
  protected readonly noopViewChangeHandler = (_view: string): void => {};
  protected readonly noopItemSelectHandler = (
    _event: SmartListItemSelectEvent<unknown, AssetAvailabilityListFilters>
  ): void => {};

  private availabilityRevision = 0;
  private dayListRevision = 0;
  private lastAvailabilityRequestKey = '';
  private lastDayListRequestKey = '';

  protected readonly availabilitySmartListConfig: SmartListConfig<AssetAvailabilityListItem, AssetAvailabilityListFilters> = {
    pageSize: 40,
    initialPageSize: 40,
    defaultView: 'month',
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
    emptyLabel: 'No availability items',
    emptyDescription: '',
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
    emptyLabel: 'No items for this day',
    emptyDescription: '',
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'proximity',
    showStickyHeader: false,
    showGroupMarker: () => false,
    groupBy: item => this.groupLabelForDate(item.dateIso, 'day'),
    trackBy: (_index, item) => item.id
  };

  constructor() {
    effect(() => {
      const request = this.availabilityPopupStore.availabilityPopup();
      if (!request) {
        return;
      }
      const requestKey = this.requestKey(request);
      if (requestKey === this.lastAvailabilityRequestKey) {
        return;
      }
      this.lastAvailabilityRequestKey = requestKey;
      this.availabilityView = request.view;
      this.availabilityFilter = request.filter;
      this.header = this.availabilityPopupStore.availabilityHeader();
      this.availabilityRevision += 1;
      this.availabilityQuery = this.buildQuery(
        this.availabilityView,
        this.availabilityFilter,
        request.initialDateIso ?? null,
        requestKey,
        this.availabilityRevision
      );
      this.cdr.markForCheck();
    });

    effect(() => {
      const request = this.availabilityPopupStore.dayListPopup();
      if (!request) {
        return;
      }
      const requestKey = this.requestKey(request);
      if (requestKey === this.lastDayListRequestKey) {
        return;
      }
      this.lastDayListRequestKey = requestKey;
      this.dayListFilter = request.filter;
      this.header = this.availabilityPopupStore.dayListHeader() ?? this.availabilityPopupStore.availabilityHeader();
      this.dayListRevision += 1;
      this.dayListQuery = this.buildQuery(
        'day',
        this.dayListFilter,
        request.initialDateIso ?? null,
        requestKey,
        this.dayListRevision
      );
      this.cdr.markForCheck();
    });
  }

  protected isAvailabilityOpen(): boolean {
    return this.availabilityPopupStore.availabilityPopup() !== null;
  }

  protected isDayListOpen(): boolean {
    return this.availabilityPopupStore.dayListPopup() !== null;
  }

  protected availabilityPopupModel(): PopupModel<AssetAvailabilityPopupMenuContext> {
    return {
      title: this.header?.title ?? 'Asset availability',
      subtitle: this.availabilitySubtitle(),
      secondarySubtitle: this.header ? `${this.header.capacity} capacity` : null,
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
    return {
      title: this.dayListTitle(),
      subtitle: this.header?.title ?? null,
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      closeAriaLabel: 'Close day availability',
      toolbarControls: this.dayListToolbarControls(),
      onClose: () => this.availabilityPopupStore.closeDayListPopup(),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected readonly availabilitySmartListLoadPage: SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters> =
    (query): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      if (query.view === 'week' || query.view === 'month') {
        return this.loadStatsPage(query);
      }
      return this.loadRowsPage(query);
    };

  private readonly loadStatsPage: SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters> =
    (query): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      const request = this.availabilityPopupStore.availabilityPopup();
      if (!request) {
        return from([this.emptyPage<AssetAvailabilityListItem>()]);
      }
      return from(this.assetsService.loadStatByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        rangeStart: query.rangeStart ?? query.filters?.dateIso ?? undefined,
        rangeEnd: query.rangeEnd ?? query.filters?.dateIso ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      })).pipe(map(result => ({
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor ?? null
        })));
    };

  private readonly loadRowsPage: SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters> =
    (query): ReturnType<SmartListLoadPage<AssetAvailabilityListItem, AssetAvailabilityListFilters>> => {
      const request = this.requestForQuery(query);
      if (!request) {
        return from([this.emptyPage<AssetAvailabilityListItem>()]);
      }
      return from(this.assetsService.loadOccupancyByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        dateIso: query.filters?.dateIso ?? request.initialDateIso ?? undefined,
        filter: query.filters?.filter ?? request.filter,
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      })).pipe(map(result => ({
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor ?? null
        })));
    };

  protected readonly dayListSmartListLoadPage: SmartListLoadPage<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters> =
    (query): ReturnType<SmartListLoadPage<AppDTOs.AssetOccupancyRowDTO, AssetAvailabilityListFilters>> => {
      const request = this.requestForQuery(query);
      if (!request) {
        return from([this.emptyPage<AppDTOs.AssetOccupancyRowDTO>()]);
      }
      return from(this.assetsService.loadOccupancyByAssetId({
        userId: request.ownerUserId,
        assetId: request.assetId,
        dateIso: query.filters?.dateIso ?? request.initialDateIso ?? undefined,
        filter: query.filters?.filter ?? request.filter,
        page: query.page,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null
      })).pipe(map(result => ({
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
    const converted = AssetAvailabilitySingleRowConverter.convert(row, { groupLabel });
    return {
      ...converted,
      menuActions: this.rowMenuActions(row)
    };
  }

  protected async onRowMenuAction(
    event: CardMenuActionEvent<SingleRowData>
  ): Promise<void> {
    const row = this.rowDetail(event.card.eagerDetail);
    const action = event.actionId as AppConstants.AssetRequestAction;
    if (!row || (action !== 'accept' && action !== 'remove' && action !== 'makeManager')) {
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

  protected onCalendarItemSelect(event: SmartListItemSelectEvent<AssetAvailabilityListItem, AssetAvailabilityListFilters>): void {
    const request = this.availabilityPopupStore.availabilityPopup();
    const dateIso = `${event.item.dateIso ?? ''}`.trim();
    if (!request || !dateIso) {
      return;
    }
    this.availabilityPopupStore.openDayListPopup(
      {
        instanceId: `asset-availability-day:${request.assetId}:${dateIso}`,
        assetId: request.assetId,
        ownerUserId: request.ownerUserId,
        initialDateIso: dateIso,
        filter: this.availabilityFilter,
        view: 'day',
        source: 'calendar-cell'
      },
      this.header
    );
    void this.availabilityPopupStore.ensureAssetAvailabilityPopupLoaded();
  }

  protected dispatchViewChange(
    view: string,
    handler: ((view: string) => void) | null | undefined
  ): void {
    handler?.(view);
  }

  protected dispatchItemSelect(
    event: SmartListItemSelectEvent<unknown, AssetAvailabilityListFilters>,
    handler: ((event: SmartListItemSelectEvent<unknown, AssetAvailabilityListFilters>) => void) | null | undefined
  ): void {
    handler?.(event);
  }

  protected onViewChange(view: string): void {
    if (view === 'day' || view === 'week' || view === 'month') {
      this.selectAvailabilityView(view);
    }
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<AssetAvailabilityPopupMenuContext>): void {
    const context = event.itemSelect.item?.context;
    if (!context) {
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
    if (this.availabilityView === view) {
      return;
    }
    this.availabilityView = view;
    this.availabilityRevision += 1;
    const request = this.availabilityPopupStore.availabilityPopup();
    this.availabilityQuery = this.buildQuery(
      view,
      this.availabilityFilter,
      request?.initialDateIso ?? null,
      this.requestKey(request),
      this.availabilityRevision
    );
    this.cdr.markForCheck();
  }

  private selectAvailabilityFilter(filter: AppDTOs.AssetAvailabilityFilter): void {
    if (this.availabilityFilter === filter) {
      return;
    }
    this.availabilityFilter = filter;
    this.availabilityRevision += 1;
    const request = this.availabilityPopupStore.availabilityPopup();
    this.availabilityQuery = this.buildQuery(
      this.availabilityView,
      filter,
      request?.initialDateIso ?? null,
      this.requestKey(request),
      this.availabilityRevision
    );
    this.cdr.markForCheck();
  }

  private selectDayListFilter(filter: AppDTOs.AssetAvailabilityFilter): void {
    if (this.dayListFilter === filter) {
      return;
    }
    this.dayListFilter = filter;
    this.dayListRevision += 1;
    const request = this.availabilityPopupStore.dayListPopup();
    this.dayListQuery = this.buildQuery(
      'day',
      filter,
      request?.initialDateIso ?? null,
      this.requestKey(request),
      this.dayListRevision
    );
    this.cdr.markForCheck();
  }

  private availabilityHeaderControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'view',
      trigger: this.viewMenuTrigger(),
      items: this.viewMenuItems()
    }];
  }

  private availabilityToolbarControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'filter',
      align: 'end',
      trigger: this.filterMenuTrigger(this.availabilityFilter),
      items: this.filterMenuItems('availability')
    }];
  }

  private dayListToolbarControls(): PopupControl<AssetAvailabilityPopupMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'day-list-filter',
      align: 'end',
      trigger: this.filterMenuTrigger(this.dayListFilter),
      items: this.filterMenuItems('day-list')
    }];
  }

  private viewMenuTrigger(): AppMenuTrigger {
    const option = APP_STATIC_DATA.activitiesViewOptions.find(item => item.key === this.availabilityView);
    return this.selectTrigger({
      label: option?.label ?? 'View',
      icon: option?.icon ?? 'view_agenda',
      palette: this.viewPalette(this.availabilityView),
      ariaLabel: 'Open availability view'
    });
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
        active: view === this.availabilityView,
        palette: this.viewPalette(view),
        surface: 'tinted',
        context: { menu: 'view', view }
      };
      });
  }

  private filterMenuTrigger(filter: AppDTOs.AssetAvailabilityFilter): AppMenuTrigger {
    const option = this.filterOptions().find(item => item.key === filter) ?? this.filterOptions()[0];
    return this.selectTrigger({
      label: option.label,
      icon: option.icon,
      palette: this.filterPalette(filter),
      ariaLabel: 'asset.requests.filter.open'
    });
  }

  private filterMenuItems(
    target: 'availability' | 'day-list'
  ): readonly AppMenuItem<string, AssetAvailabilityPopupMenuContext>[] {
    const activeFilter = target === 'day-list' ? this.dayListFilter : this.availabilityFilter;
    return this.filterOptions().map(option => ({
      id: `asset-availability-filter:${target}:${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === activeFilter,
      palette: this.filterPalette(option.key),
      surface: 'tinted',
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

  private selectTrigger(input: {
    label: string;
    icon: string;
    palette: AppMenuPalette;
    ariaLabel: string;
  }): AppMenuTrigger {
    return {
      label: input.label,
      icon: input.icon,
      palette: input.palette,
      layout: 'pill',
      ariaLabel: input.ariaLabel
    };
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
    const capacity = stat.capacity > 0 ? stat.capacity : (this.header?.capacity ?? 0);
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
    this.availabilityRevision += 1;
    this.dayListRevision += 1;
    const availabilityRequest = this.availabilityPopupStore.availabilityPopup();
    const dayListRequest = this.availabilityPopupStore.dayListPopup();
    this.availabilityQuery = this.buildQuery(
      this.availabilityView,
      this.availabilityFilter,
      availabilityRequest?.initialDateIso ?? null,
      this.requestKey(availabilityRequest),
      this.availabilityRevision
    );
    this.dayListQuery = this.buildQuery(
      'day',
      this.dayListFilter,
      dayListRequest?.initialDateIso ?? null,
      this.requestKey(dayListRequest),
      this.dayListRevision
    );
  }

  private requestForQuery(
    query: ListQuery<AssetAvailabilityListFilters>
  ): AssetAvailabilityPopupRequest | null {
    const requestKey = `${query.filters?.requestKey ?? ''}`.trim();
    const dayList = this.availabilityPopupStore.dayListPopup();
    if (dayList && this.requestKey(dayList) === requestKey) {
      return dayList;
    }
    return this.availabilityPopupStore.availabilityPopup();
  }

  private emptyPage<T>(): PageResult<T> {
    return { items: [], total: 0, nextCursor: null };
  }

  private buildQuery(
    view: AppDTOs.AssetAvailabilityView,
    filter: AppDTOs.AssetAvailabilityFilter,
    dateIso: string | null,
    requestKey: string,
    revision = 0
  ): Partial<ListQuery<AssetAvailabilityListFilters>> {
    return {
      view,
      filters: {
        revision,
        filter,
        dateIso: `${dateIso ?? ''}`.trim() || null,
        requestKey
      }
    };
  }

  private requestKey(request: AssetAvailabilityPopupRequest | null | undefined): string {
    if (!request) {
      return '';
    }
    return [
      request.instanceId,
      request.assetId,
      request.ownerUserId,
      request.initialDateIso ?? '',
      request.filter,
      request.view,
      request.updatedMs
    ].join(':');
  }

  private availabilityItemKey(item: AssetAvailabilityListItem, index: number): string {
    return `${item.assetId}:${item.dateIso}:${item.id}:${index}`;
  }

  private availabilitySubtitle(): string | null {
    if (!this.header) {
      return 'Time-based requests and assignments';
    }
    return this.header.subtitle || 'Time-based requests and assignments';
  }

  private dayListTitle(): string {
    const request = this.availabilityPopupStore.dayListPopup();
    const dateIso = `${request?.initialDateIso ?? ''}`.trim();
    return dateIso ? this.groupLabelForDate(dateIso, 'day') : 'Availability items';
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
