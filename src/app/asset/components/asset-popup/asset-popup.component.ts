import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DoCheck, HostListener, OnDestroy, ViewChild, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { AssetFacadeService } from '../../asset-facade.service';
import { AssetPopupStateService } from '../../asset-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';
import { AssetCardBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppContext } from '../../../shared/ui';
import { AssetTicketsService, ShareTokensService } from '../../../shared/core';
import { AssetFormPopupComponent } from '../asset-form-popup/asset-form-popup.component';
import { AssetTicketCodePopupComponent } from '../asset-ticket-code-popup/asset-ticket-code-popup.component';
import { AssetTicketScannerPopupComponent } from '../asset-ticket-scanner-popup/asset-ticket-scanner-popup.component';
import {
  AppMenuComponent,
  AppMenuDispatcher,
  AppMenuOutletComponent,
  AppMenuTriggerComponent,
  BasketComponent,
  InfoCardComponent,
  ProgressIndicatorComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type BasketChip,
  type InfoCardData,
  type InfoCardMenuActionEvent,
  type InfoCardResolvedMenuAction,
  type ListQuery,
  type SingleRowData,
  type SmartListConfig,
  type SmartListStateChange,
  ConfirmationDialogComponent
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { I18nService } from '../../../shared/core';
import { I18nPipe } from '../../../shared/ui';

import type * as AppDTOs from '../../../shared/core/base/dto';
import type * as AppConstants from '../../../shared/core/common/constants';
interface AssetTicketListFilters {
  userId?: string;
  order?: AppConstants.AssetTicketOrder;
}

interface OwnedAssetListFilters {
  userId?: string;
  type?: AppConstants.AssetType;
  refreshToken?: number;
}

type AssetSupplyRequestFilter = 'all' | 'active-items' | 'pending-requests' | 'borrowed-items';
type AssetSupplyRequestRowAction = Extract<AppConstants.AssetRequestAction, 'accept' | 'remove' | 'makeManager'>;

interface AssetSupplyRequestRow extends SingleRowData {
  status: AppConstants.AssetRequestStatus | 'assigned';
  menuActions?: readonly AssetSupplyRequestRowAction[];
}

type AssetPopupMenuContext =
  | { menu: 'ticket-order'; order: AppConstants.AssetTicketOrder }
  | { menu: 'asset-filter'; filter: AppConstants.AssetFilterType }
  | { menu: 'supply-request-filter'; filter: AssetSupplyRequestFilter }
  | { menu: 'supply-request-action'; row: AssetSupplyRequestRow; action: AssetSupplyRequestRowAction }
  | {
      menu: 'asset-info-card';
      assetCard: AppDTOs.AssetCardDTO;
      card: InfoCardData;
      action: InfoCardResolvedMenuAction;
    };

@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    AppMenuTriggerComponent,
    BasketComponent,
    InfoCardComponent,
    ProgressIndicatorComponent,
    SmartListComponent,
    ConfirmationDialogComponent,
    I18nPipe,
    AssetFormPopupComponent,
    AssetTicketCodePopupComponent,
    AssetTicketScannerPopupComponent
  ],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.scss'
})
export class AssetPopupComponent implements DoCheck, OnDestroy {
  private readonly assetFacade = inject(AssetFacadeService);
  private readonly appCtx = inject(AppContext);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly assetPopup = inject(AssetPopupStateService);
  protected readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private lastAssetListContextKey = '';
  private lastAssetCardsSignature = '';
  private lastAssetCardCount = 0;
  private assetListReady = false;
  private assetListVisibleCount = 0;
  protected showSupplyRequestList = false;
  protected selectedSupplyAssetId: string | null = null;
  protected supplyRequestFilter: AssetSupplyRequestFilter = 'all';
  protected supplyRequestBusyKey = '';
  protected readonly retryTicketScanner = (event?: Event): void => this.assetPopup.retryTicketScanner(event);
  protected readonly closeOwnedAssetForm = (): void => this.ownedAssets.closeAssetForm();
  protected readonly saveOwnedAssetCard = (): void => { void this.ownedAssets.saveAssetCard(); };
  protected readonly setOwnedAssetFormRouteStop = (index: number, value: string): void =>
    this.ownedAssets.setAssetFormRouteStop(index, value);
  protected readonly openOwnedAssetFormRouteStopMap = (index: number, event?: Event): void =>
    this.ownedAssets.openAssetFormRouteStopMap(index, event);
  protected readonly refreshOwnedAssetFromSourceLink = (): void => { void this.ownedAssets.refreshAssetFromSourceLink(); };
  protected readonly onOwnedAssetImageFileSelected = (file: File): void => this.ownedAssets.applyAssetImageFile(file);
  protected readonly cancelOwnedAssetDelete = (): void => this.ownedAssets.cancelAssetDelete();
  protected readonly confirmOwnedAssetDelete = (): void => { void this.ownedAssets.confirmAssetDelete(); };
  protected readonly supplyRequestFilters: Array<{ key: AssetSupplyRequestFilter; labelKey: string; icon: string }> = [
    { key: 'all', labelKey: 'all', icon: 'view_list' },
    { key: 'active-items', labelKey: 'asset.requests.filter.active.items', icon: 'inventory_2' },
    { key: 'pending-requests', labelKey: 'asset.requests.filter.pending.requests', icon: 'pending_actions' },
    { key: 'borrowed-items', labelKey: 'asset.requests.filter.borrowed.items', icon: 'assignment_returned' }
  ];
  protected assetSmartListQuery: Partial<ListQuery<OwnedAssetListFilters>> = {};
  protected ticketSmartListQuery: Partial<ListQuery<AssetTicketListFilters>> = {};
  private assetSmartListQueryKey = '';
  private assetSmartListQueryRevision = 0;
  private ticketSmartListQueryKey = '';
  private ticketSmartListQueryRevision = 0;
  @ViewChild('assetSmartList')
  private assetSmartList?: SmartListComponent<AppDTOs.AssetCardDTO, OwnedAssetListFilters>;

  protected readonly assetSmartListLoadPage = (query: ListQuery<OwnedAssetListFilters>) =>
    from(this.loadOwnedAssetSmartListPage(query));
  protected readonly ticketSmartListLoadPage = (query: ListQuery<AssetTicketListFilters>) =>
    from(this.loadTicketSmartListPage(query));
  protected readonly assetSmartListConfig: SmartListConfig<AppDTOs.AssetCardDTO, OwnedAssetListFilters> = {
    pageSize: 18,
    defaultView: 'list',
    emptyLabel: query => this.assetFacade.ownedAssetEmptyLabel(query.filters?.type ?? 'Car'),
    emptyDescription: query => this.assetFacade.ownedAssetEmptyDescription(query.filters?.type ?? 'Car'),
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.isOnline() ? 'active' : 'inactive'
    },
    showStickyHeader: false,
    showGroupMarker: () => false,
    selectMode: () => this.isBasketMode(),
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'owned-assets-scroll-list': true
    },
    trackBy: (_index, card) => card.id
  };
  protected readonly ticketSmartListConfig: SmartListConfig<AppTypes.ActivityListRow, AssetTicketListFilters> = {
    pageSize: 18,
    defaultView: 'list',
    emptyLabel: 'No ticketed events',
    emptyDescription: 'Enable Ticketing On in an event to generate a ticket here.',
    emptyStickyLabel: 'No tickets',
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.isOnline() ? 'active' : 'inactive'
    },
    showStickyHeader: true,
    stickyHeaderClass: 'activities-sticky-header',
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.8rem',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'activities-scroll-list': true,
      'activities-scroll-list-event-snap': true,
      'tickets-scroll-list': true
    },
    trackBy: (_index, row) => `${row.type}:${row.id}`,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: row => this.assetFacade.ticketGroupLabel(row.dateIso)
  };

  constructor() {
    this.syncSmartListQueries();
    effect(() => {
      this.ownedAssets.assetListRevision();
      this.ownedAssets.assetListReloadRevision();
      this.syncSmartListQueries();
      this.cdr.markForCheck();
    });
  }

  ngDoCheck(): void {
    this.syncSmartListQueries();
    this.syncVisibleOwnedAssets();
  }

  protected isBasketMode(): boolean {
    const host = this.assetPopup.host();
    return !!host && host.isSubEventAssetAssignPopup();
  }

  protected assetPopupTitle(): string {
    const host = this.assetPopup.host();
    if (host?.isSubEventAssetAssignPopup()) {
      return host.subEventAssetAssignHeaderTitle();
    }
    return this.ownedAssets.popupTitle();
  }

  protected assetPopupSubtitle(): string {
    const host = this.assetPopup.host();
    if (host?.isSubEventAssetAssignPopup()) {
      return host.subEventAssetAssignHeaderSubtitle();
    }
    return this.ownedAssets.isTicketPopup() ? this.assetPopup.ticketHeaderSummary() : '';
  }

  protected basketChips(): BasketChip[] {
    const host = this.assetPopup.host();
    if (!host?.isSubEventAssetAssignPopup()) {
      return [];
    }
    return host.selectedSubEventAssetAssignChips().map(card => ({
      id: card.id,
      label: card.title,
      icon: this.ownedAssets.assetTypeIcon(card.type)
    }));
  }

  protected canConfirmBasketSelection(): boolean {
    const host = this.assetPopup.host();
    return !!host && host.isSubEventAssetAssignPopup() && host.canConfirmSubEventAssetAssignSelection();
  }

  protected isBasketSavePending(): boolean {
    const host = this.assetPopup.host();
    return !!host && host.isSubEventAssetAssignPopup() && host.isSubEventAssetAssignPending();
  }

  protected basketSaveErrorMessage(): string {
    const host = this.assetPopup.host();
    return host?.isSubEventAssetAssignPopup() ? host.subEventAssetAssignErrorMessage() : '';
  }

  protected ownedAssetInfoCard(
    card: AppDTOs.AssetCardDTO,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ) {
    return this.assetFacade.ownedAssetInfoCard(card, options);
  }

  protected isAssetAssignCardSelected(cardId: string): boolean {
    const host = this.assetPopup.host();
    return !!host && host.isSubEventAssetAssignPopup() && host.isSubEventAssetAssignCardSelected(cardId);
  }

  protected onOwnedAssetInfoCardMenuAction(card: AppDTOs.AssetCardDTO, event: InfoCardMenuActionEvent): void {
    if (this.isBasketMode()) {
      return;
    }
    if (event.actionId === 'shareAsset' || event.actionId === 'share') {
      this.openOwnedAssetShareDialog(card);
      return;
    }
    if (event.actionId === 'delete') {
      this.ownedAssets.runAssetItemDeleteAction(card);
      return;
    }
    if (event.actionId === 'takeOver') {
      this.confirmationDialogService.open({
        title: 'Take over asset?',
        message: card.title,
        cancelLabel: 'Cancel',
        confirmLabel: 'Take Over',
        busyConfirmLabel: 'Taking over...',
        confirmTone: 'accent',
        failureMessage: 'Unable to take over asset.',
        onConfirm: () => this.ownedAssets.takeOverAssetCardById(card.id)
      });
      return;
    }
    if (event.actionId === 'editAsset' || event.actionId === 'edit') {
      this.ownedAssets.runAssetItemEditAction(card);
    }
  }

  protected ticketOrderMenuTrigger(): AppMenuTrigger {
    return {
      label: () => this.assetPopup.ticketDateOrderLabel(),
      icon: () => this.assetPopup.ticketDateOrderIcon(),
      palette: 'blue',
      shape: 'pill',
      ariaLabel: 'Open ticket date ordering'
    };
  }

  protected ticketOrderMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    const selectedOrder = this.assetPopup.ticketDateOrder();
    return [
      {
        id: 'ticket-order-upcoming',
        label: 'Upcoming',
        icon: 'schedule',
        kind: 'radio',
        active: selectedOrder === 'upcoming',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'ticket-order', order: 'upcoming' }
      },
      {
        id: 'ticket-order-past',
        label: 'Past',
        icon: 'history',
        kind: 'radio',
        active: selectedOrder === 'past',
        palette: 'slate',
        surface: 'tinted',
        context: { menu: 'ticket-order', order: 'past' }
      }
    ];
  }

  protected assetFilterMenuTrigger(): AppMenuTrigger {
    const filter = this.ownedAssets.assetFilter;
    const count = this.ownedAssets.assetFilterCount(filter);
    return {
      label: this.ownedAssets.assetTypeLabel(filter),
      icon: this.ownedAssets.assetTypeIcon(filter),
      palette: this.assetFilterPalette(filter),
      counter: count > 0 ? count : null,
      ariaLabel: 'Open asset filter'
    };
  }

  protected assetFilterMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    return this.ownedAssets.assetFilterOptions.map(option => {
      const count = this.ownedAssets.assetFilterCount(option);
      return {
        id: `asset-filter-${option}`,
        label: this.ownedAssets.assetTypeLabel(option),
        icon: this.ownedAssets.assetTypeIcon(option),
        kind: 'radio',
        active: option === this.ownedAssets.assetFilter,
        palette: this.assetFilterPalette(option),
        surface: 'tinted',
        counter: count > 0 ? count : null,
        context: { menu: 'asset-filter', filter: option }
      };
    });
  }

  protected supplyRequestFilterMenuTrigger(): AppMenuTrigger {
    return {
      label: () => this.supplyRequestFilterLabel(),
      icon: () => this.supplyRequestFilterIcon(),
      palette: this.supplyRequestFilterPalette(this.supplyRequestFilter),
      counter: () => this.supplyRequestFilterCount(),
      shape: 'pill',
      ariaLabel: 'asset.requests.filter.open'
    };
  }

  protected supplyRequestFilterMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    return this.supplyRequestFilters.map(option => ({
      id: `supply-request-filter-${option.key}`,
      label: option.labelKey,
      icon: option.icon,
      kind: 'radio',
      active: option.key === this.supplyRequestFilter,
      palette: this.supplyRequestFilterPalette(option.key),
      surface: 'tinted',
      counter: () => this.supplyRequestFilterCount(option.key),
      context: { menu: 'supply-request-filter', filter: option.key }
    }));
  }

  protected supplyRequestRowActionMenuId(row: AssetSupplyRequestRow): string {
    return `asset-supply-request:${row.id}`;
  }

  protected supplyRequestRowActionMenuTrigger(row: AssetSupplyRequestRow): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      shape: 'icon',
      palette: 'slate',
      disabled: () => this.isSupplyRequestRowBusy(row, 'accept')
        || this.isSupplyRequestRowBusy(row, 'remove')
        || this.isSupplyRequestRowBusy(row, 'makeManager'),
      ariaLabel: 'asset.requests.actions.open'
    };
  }

  protected supplyRequestRowActionMenuItems(row: AssetSupplyRequestRow): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    const items: AppMenuItem<string, AssetPopupMenuContext>[] = [];
    if ((row.menuActions ?? []).includes('accept')) {
      items.push({
        id: `${row.id}:accept`,
        label: () => this.isSupplyRequestRowBusy(row, 'accept') ? 'accepting' : 'accept',
        icon: 'check_circle',
        palette: 'green',
        surface: 'tinted',
        disabled: () => this.isSupplyRequestRowBusy(row, 'accept'),
        context: { menu: 'supply-request-action', row, action: 'accept' }
      });
    }
    if (this.canPromoteSupplyRequestRowToManager(row)) {
      items.push({
        id: `${row.id}:makeManager`,
        label: () => this.isSupplyRequestRowBusy(row, 'makeManager')
          ? 'asset.requests.promoting'
          : 'asset.requests.promote.to.manager',
        icon: 'manage_accounts',
        palette: 'blue',
        surface: 'tinted',
        disabled: () => this.isSupplyRequestRowBusy(row, 'makeManager'),
        context: { menu: 'supply-request-action', row, action: 'makeManager' }
      });
    }
    if ((row.menuActions ?? []).includes('remove')) {
      items.push({
        id: `${row.id}:remove`,
        label: () => this.isSupplyRequestRowBusy(row, 'remove') ? 'asset.requests.rejecting' : 'reject',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted',
        disabled: () => this.isSupplyRequestRowBusy(row, 'remove'),
        context: { menu: 'supply-request-action', row, action: 'remove' }
      });
    }
    return items;
  }

  protected onAssetPopupMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AssetPopupMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'ticket-order':
        this.assetPopup.selectTicketDateOrder(context.order, event.sourceEvent);
        return;
      case 'asset-filter':
        this.onAssetFilterChange(context.filter);
        return;
      case 'supply-request-filter':
        this.selectSupplyRequestFilter(context.filter, event.sourceEvent);
        return;
      default:
        return;
    }
  }

  protected onAssetDispatchedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AssetPopupMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'supply-request-action') {
      void this.runSupplyRequestRowAction(context.row, context.action, event.sourceEvent);
      return;
    }
    if (context.menu === 'asset-info-card') {
      this.onOwnedAssetInfoCardMenuAction(context.assetCard, {
        id: context.card.id,
        actionId: context.action.id,
        action: context.action,
        card: context.card
      });
    }
  }

  private async runSupplyRequestRowAction(
    row: AssetSupplyRequestRow,
    action: AssetSupplyRequestRowAction,
    event: Event
  ): Promise<void> {
    if (action === 'accept') {
      await this.approveSupplyRequestRow(row, event);
      return;
    }
    if (action === 'remove') {
      await this.rejectSupplyRequestRow(row, event);
      return;
    }
    await this.promoteSupplyRequestRowToManager(row, event);
  }

  private assetFilterPalette(filter: AppConstants.AssetFilterType): AppMenuPalette {
    if (filter === 'Accommodation') {
      return 'green';
    }
    if (filter === 'Supplies') {
      return 'brown';
    }
    if (filter === 'Ticket') {
      return 'sky';
    }
    return 'blue';
  }

  private supplyRequestFilterPalette(filter: AssetSupplyRequestFilter): AppMenuPalette {
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

  private openOwnedAssetShareDialog(card: AppDTOs.AssetCardDTO): void {
    void this.shareTokensService.createToken({
      kind: 'asset',
      entityId: card.id,
      assetType: card.type,
      ownerUserId: card.ownerUserId ?? null
    }).then(token => {
      this.confirmationDialogService.open({
        title: 'Share asset',
        message: token,
        confirmLabel: 'Copy link',
        cancelLabel: 'Cancel',
        confirmTone: 'accent',
        onConfirm: async () => {
          await navigator.clipboard?.writeText(token);
        }
      });
    });
  }

  protected onOwnedAssetMediaEndClick(card: AppDTOs.AssetCardDTO, selectMode: boolean): void {
    if (!selectMode) {
      this.openSupplyRequestList(card);
      return;
    }
    this.assetPopup.host()?.toggleSubEventAssetAssignCard(card.id);
  }

  protected openSupplyRequestList(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (this.isBasketMode()) {
      return;
    }
    this.selectedSupplyAssetId = card.id;
    this.showSupplyRequestList = true;
    this.supplyRequestFilter = 'all';
    this.supplyRequestBusyKey = '';
    this.appMenuDispatcher.close();
  }

  protected closeSupplyRequestList(event?: Event): void {
    event?.stopPropagation();
    this.showSupplyRequestList = false;
    this.selectedSupplyAssetId = null;
    this.supplyRequestBusyKey = '';
    this.appMenuDispatcher.close();
  }

  protected selectedSupplyAsset(): AppDTOs.AssetCardDTO | null {
    const assetId = `${this.selectedSupplyAssetId ?? ''}`.trim();
    if (!assetId) {
      return null;
    }
    return this.ownedAssets.assetCards.find(card => card.id === assetId) ?? null;
  }

  protected assetRequestListSubtitle(): string {
    return 'asset.requests.subtitle';
  }

  protected selectedSupplyTotalQuantity(): number {
    const asset = this.selectedSupplyAsset();
    return asset ? AssetCardBuilder.quantityValue(asset) : 0;
  }

  protected selectSupplyRequestFilter(filter: AssetSupplyRequestFilter, event?: Event): void {
    event?.stopPropagation();
    this.supplyRequestFilter = filter;
    this.appMenuDispatcher.close();
  }

  protected supplyRequestFilterCount(filter = this.supplyRequestFilter): number {
    return this.supplyRequestsForFilter(filter).length;
  }

  protected supplyRequestFilterLabel(): string {
    return this.supplyRequestFilters.find(option => option.key === this.supplyRequestFilter)?.labelKey ?? 'all';
  }

  protected supplyRequestFilterIcon(): string {
    return this.supplyRequestFilters.find(option => option.key === this.supplyRequestFilter)?.icon ?? 'view_list';
  }

  protected supplyRequestRows(): AssetSupplyRequestRow[] {
    return this.supplyRequestsForFilter(this.supplyRequestFilter).map(request => this.toSupplyRequestRow(request));
  }

  protected supplyRequestRowInventoryState(row: AssetSupplyRequestRow): 'available' | 'empty' | 'over' | 'unset' {
    const request = this.supplyRequestForRow(row);
    return request ? this.supplyRequestInventoryState(request) : 'unset';
  }

  protected supplyRequestRowInventoryLabel(row: AssetSupplyRequestRow): string {
    const request = this.supplyRequestForRow(row);
    return request ? this.supplyRequestInventoryLabel(request) : '';
  }

  protected isSupplyRequestRowBusy(row: AssetSupplyRequestRow, action: AppConstants.AssetRequestAction): boolean {
    return this.supplyRequestBusyKey === `${row.id}:${action}`;
  }

  protected hasSupplyRequestRowActions(row: AssetSupplyRequestRow): boolean {
    const request = this.supplyRequestForRow(row);
    return request ? this.hasSupplyRequestActions(request) : false;
  }

  protected canPromoteSupplyRequestRowToManager(row: AssetSupplyRequestRow): boolean {
    const request = this.supplyRequestForRow(row);
    return request ? this.canPromoteSupplyRequestToManager(request) : false;
  }

  protected async approveSupplyRequestRow(row: AssetSupplyRequestRow, event: Event): Promise<void> {
    const request = this.supplyRequestForRow(row);
    if (request) {
      await this.approveSupplyRequest(request, event);
    }
  }

  protected async rejectSupplyRequestRow(row: AssetSupplyRequestRow, event: Event): Promise<void> {
    const request = this.supplyRequestForRow(row);
    if (request) {
      await this.rejectSupplyRequest(request, event);
    }
  }

  protected async promoteSupplyRequestRowToManager(row: AssetSupplyRequestRow, event: Event): Promise<void> {
    const request = this.supplyRequestForRow(row);
    if (request) {
      await this.promoteSupplyRequestToManager(request, event);
    }
  }

  protected supplyRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    const raw = Number(request.booking?.quantity);
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
  }

  protected supplyRequestReservationLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    if (this.isAssignedSupplyRequest(request)) {
      return this.translateTemplate('asset.requests.reservation.assigned', 'Assigned {quantity}', {
        quantity: quantityLabel
      });
    }
    if (request.status === 'accepted') {
      return this.translateTemplate('asset.requests.reservation.borrowed', 'Borrowed {quantity}', {
        quantity: quantityLabel
      });
    }
    return this.translateTemplate('asset.requests.reservation.borrow.request', 'Borrow request for {quantity}', {
      quantity: quantityLabel
    });
  }

  protected supplyRequestEventLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    return [
      `${request.booking?.eventTitle ?? ''}`.trim(),
      `${request.booking?.subEventTitle ?? ''}`.trim()
    ].filter(Boolean).join(' · ');
  }

  protected supplyRequestScheduleLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    const start = this.parseIsoDate(request.booking?.startAtIso);
    const end = this.parseIsoDate(request.booking?.endAtIso);
    if (start && end) {
      return this.formatSupplyRequestDateRange(start, end);
    }
    const timeframe = `${request.booking?.timeframe ?? ''}`.trim();
    if (timeframe) {
      return timeframe;
    }
    return `${request.booking?.slotLabel ?? ''}`.trim();
  }

  protected supplyRequestDisplayNote(request: AppDTOs.AssetMemberRequestDTO): string {
    const note = `${request.note ?? ''}`.trim();
    if (!note || this.isSystemSupplyRequestNote(note)) {
      return '';
    }
    return note;
  }

  protected supplyRequestInventoryLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    const total = this.selectedSupplyTotalQuantity();
    if (total <= 0) {
      return this.translateTemplate('asset.requests.inventory.no.quantity', '{quantity} requested. No quantity configured.', {
        quantity: quantityLabel
      });
    }
    const remaining = this.selectedSupplyRemainingQuantityForRequest(request);
    if (remaining < 0) {
      return this.translateTemplate('asset.requests.inventory.over', '{quantity} requested. {count} over the limit for this time.', {
        quantity: quantityLabel,
        count: `${Math.abs(remaining)}`
      });
    }
    return this.translateTemplate('asset.requests.inventory.left', '{quantity} requested. {count} left for this time.', {
      quantity: quantityLabel,
      count: `${Math.max(0, remaining)}`
    });
  }

  protected supplyRequestInventoryBadgeLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    const total = this.selectedSupplyTotalQuantity();
    if (total <= 0) {
      return this.translateTemplate('asset.requests.inventory.badge.no.quantity', '{quantity} / no qty', {
        quantity: quantityLabel
      });
    }
    const remaining = this.selectedSupplyRemainingQuantityForRequest(request);
    if (remaining < 0) {
      return this.translateTemplate('asset.requests.inventory.badge.over', '{quantity} / {count} over', {
        quantity: quantityLabel,
        count: `${Math.abs(remaining)}`
      });
    }
    return this.translateTemplate('asset.requests.inventory.badge.left', '{quantity} / {count} left', {
      quantity: quantityLabel,
      count: `${Math.max(0, remaining)}`
    });
  }

  protected supplyRequestInventoryState(request: AppDTOs.AssetMemberRequestDTO): 'available' | 'empty' | 'over' | 'unset' {
    const total = this.selectedSupplyTotalQuantity();
    if (total <= 0) {
      return 'unset';
    }
    const remaining = this.selectedSupplyRemainingQuantityForRequest(request);
    if (remaining < 0) {
      return 'over';
    }
    if (remaining === 0) {
      return 'empty';
    }
    return 'available';
  }

  protected supplyRequestStatusLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    if (this.isAssignedSupplyRequest(request)) {
      return 'asset.requests.status.assigned';
    }
    return request.status === 'accepted' ? 'asset.requests.status.borrowed' : 'asset.requests.status.pending';
  }

  protected supplyRequestRowStatusLabel(row: AssetSupplyRequestRow): string {
    if (row.status === 'assigned') {
      return 'asset.requests.status.assigned';
    }
    return row.status === 'accepted' ? 'asset.requests.status.borrowed' : 'asset.requests.status.pending';
  }

  protected isSupplyRequestBusy(request: AppDTOs.AssetMemberRequestDTO, action: AppConstants.AssetRequestAction): boolean {
    return this.supplyRequestBusyKey === `${request.id}:${action}`;
  }

  protected hasSupplyRequestActions(request: AppDTOs.AssetMemberRequestDTO): boolean {
    return (request.status === 'pending' && !this.isAssignedSupplyRequest(request))
      || this.canPromoteSupplyRequestToManager(request);
  }

  protected canPromoteSupplyRequestToManager(request: AppDTOs.AssetMemberRequestDTO): boolean {
    return (request.menuActions ?? []).includes('makeManager');
  }

  protected async approveSupplyRequest(request: AppDTOs.AssetMemberRequestDTO, event: Event): Promise<void> {
    event.stopPropagation();
    const asset = this.selectedSupplyAsset();
    if (!asset || request.status !== 'pending') {
      return;
    }
    this.appMenuDispatcher.close();
    this.supplyRequestBusyKey = `${request.id}:accept`;
    try {
      await this.ownedAssets.applyAssetRequestAction(asset.id, request.id, 'accept');
    } finally {
      this.supplyRequestBusyKey = '';
    }
  }

  protected async rejectSupplyRequest(request: AppDTOs.AssetMemberRequestDTO, event: Event): Promise<void> {
    event.stopPropagation();
    const asset = this.selectedSupplyAsset();
    if (!asset) {
      return;
    }
    this.appMenuDispatcher.close();
    this.supplyRequestBusyKey = `${request.id}:remove`;
    try {
      await this.ownedAssets.applyAssetRequestAction(asset.id, request.id, 'remove');
    } finally {
      this.supplyRequestBusyKey = '';
    }
  }

  protected async promoteSupplyRequestToManager(request: AppDTOs.AssetMemberRequestDTO, event: Event): Promise<void> {
    event.stopPropagation();
    const asset = this.selectedSupplyAsset();
    if (!asset || !this.canPromoteSupplyRequestToManager(request)) {
      return;
    }
    this.appMenuDispatcher.close();
    this.supplyRequestBusyKey = `${request.id}:makeManager`;
    try {
      await this.ownedAssets.promoteAssetRequestToManager(asset.id, request.id);
    } finally {
      this.supplyRequestBusyKey = '';
    }
  }

  protected supplyRequestEmptyLabel(): string {
    if (this.selectedSupplyTotalQuantity() <= 0) {
      return 'asset.requests.empty.no.quantity';
    }
    return 'asset.requests.empty.no.activity';
  }

  private isAssignedSupplyRequest(request: AppDTOs.AssetMemberRequestDTO): boolean {
    return request.requestKind === 'manual';
  }

  private supplyRequestsForFilter(filter: AssetSupplyRequestFilter): AppDTOs.AssetMemberRequestDTO[] {
    const requests = [...(this.selectedSupplyAsset()?.requests ?? [])];
    const ordered = requests.sort((left, right) => {
      const leftOrder = this.supplyRequestBucketOrder(left);
      const rightOrder = this.supplyRequestBucketOrder(right);
      return leftOrder - rightOrder
        || this.toSupplyRequestSortTime(right) - this.toSupplyRequestSortTime(left)
        || left.id.localeCompare(right.id);
    });
    if (filter === 'pending-requests') {
      return ordered.filter(request => request.status === 'pending' && !this.isAssignedSupplyRequest(request));
    }
    if (filter === 'borrowed-items') {
      return ordered.filter(request => request.status === 'accepted' && !this.isAssignedSupplyRequest(request));
    }
    if (filter === 'active-items') {
      return ordered.filter(request => request.status === 'accepted' || this.isAssignedSupplyRequest(request));
    }
    return ordered;
  }

  private toSupplyRequestRow(request: AppDTOs.AssetMemberRequestDTO): AssetSupplyRequestRow {
    const eventLabel = this.supplyRequestEventLabel(request);
    const scheduleLabel = this.supplyRequestScheduleLabel(request);
    const note = this.supplyRequestDisplayNote(request);
    return {
      id: request.id,
      status: this.isAssignedSupplyRequest(request) ? 'assigned' : request.status,
      title: request.name,
      subtitle: eventLabel,
      detail: note || scheduleLabel,
      dateIso: request.requestedAtIso ?? request.booking?.startAtIso ?? '',
      avatarInitials: request.initials,
      sideLabel: this.supplyRequestInventoryBadgeLabel(request),
      metaRows: [scheduleLabel].filter(Boolean),
      menuActions: this.supplyRequestMenuActions(request)
    };
  }

  private supplyRequestMenuActions(request: AppDTOs.AssetMemberRequestDTO): readonly AssetSupplyRequestRowAction[] {
    if (request.status === 'pending' && !this.isAssignedSupplyRequest(request)) {
      return this.canPromoteSupplyRequestToManager(request)
        ? ['accept', 'makeManager', 'remove']
        : ['accept', 'remove'];
    }
    return this.canPromoteSupplyRequestToManager(request) ? ['makeManager'] : [];
  }

  private supplyRequestForRow(row: AssetSupplyRequestRow): AppDTOs.AssetMemberRequestDTO | null {
    return (this.selectedSupplyAsset()?.requests ?? []).find(request => request.id === row.id) ?? null;
  }

  private supplyRequestBucketOrder(request: AppDTOs.AssetMemberRequestDTO): number {
    if (request.status === 'pending' && !this.isAssignedSupplyRequest(request)) {
      return 0;
    }
    if (request.status === 'accepted' && !this.isAssignedSupplyRequest(request)) {
      return 1;
    }
    return 2;
  }

  private toSupplyRequestSortTime(request: AppDTOs.AssetMemberRequestDTO): number {
    const parsed = this.parseIsoDate(request.requestedAtIso)
      ?? this.parseIsoDate(request.booking?.startAtIso)
      ?? this.parseIsoDate(request.booking?.endAtIso);
    return parsed ? parsed.getTime() : 0;
  }

  private selectedSupplyRemainingQuantityForRequest(request: AppDTOs.AssetMemberRequestDTO): number {
    const overlappingCommitted = (this.selectedSupplyAsset()?.requests ?? [])
      .filter(other => this.isCommittedSupplyRequest(other))
      .filter(other => this.isSupplyRequestTimeOverlap(request, other))
      .reduce((sum, other) => sum + this.supplyRequestQuantity(other), 0);
    const pendingCurrentQuantity = this.isCommittedSupplyRequest(request) ? 0 : this.supplyRequestQuantity(request);
    return this.selectedSupplyTotalQuantity() - overlappingCommitted - pendingCurrentQuantity;
  }

  private isCommittedSupplyRequest(request: AppDTOs.AssetMemberRequestDTO): boolean {
    return request.status === 'accepted' || this.isAssignedSupplyRequest(request);
  }

  private isSupplyRequestTimeOverlap(
    left: AppDTOs.AssetMemberRequestDTO,
    right: AppDTOs.AssetMemberRequestDTO
  ): boolean {
    if (left.id === right.id) {
      return true;
    }
    const leftStart = this.parseIsoDateMs(left.booking?.startAtIso);
    const leftEnd = this.parseIsoDateMs(left.booking?.endAtIso);
    const rightStart = this.parseIsoDateMs(right.booking?.startAtIso);
    const rightEnd = this.parseIsoDateMs(right.booking?.endAtIso);
    if (leftStart !== null && leftEnd !== null && rightStart !== null && rightEnd !== null) {
      return leftStart < rightEnd && rightStart < leftEnd;
    }
    const leftSlotKey = `${left.booking?.slotKey ?? ''}`.trim();
    const rightSlotKey = `${right.booking?.slotKey ?? ''}`.trim();
    if (leftSlotKey && rightSlotKey) {
      return leftSlotKey === rightSlotKey;
    }
    const leftWindow = this.requestTimeWindowKey(left);
    const rightWindow = this.requestTimeWindowKey(right);
    if (leftWindow && rightWindow) {
      return leftWindow === rightWindow;
    }
    return true;
  }

  private requestTimeWindowKey(request: AppDTOs.AssetMemberRequestDTO): string {
    return [
      `${request.booking?.eventId ?? ''}`.trim(),
      `${request.booking?.subEventId ?? ''}`.trim(),
      `${request.booking?.slotLabel ?? ''}`.trim(),
      `${request.booking?.timeframe ?? ''}`.trim()
    ].filter(Boolean).join('|');
  }

  private supplyRequestQuantityLabel(request: AppDTOs.AssetMemberRequestDTO): string {
    const quantity = this.supplyRequestQuantity(request);
    return this.translateTemplate(
      quantity === 1 ? 'asset.requests.quantity.one' : 'asset.requests.quantity.many',
      quantity === 1 ? '{count} item' : '{count} items',
      { count: `${quantity}` }
    );
  }

  private translateTemplate(key: string, fallback: string, values: Record<string, string>): string {
    this.i18n.revision();
    const template = this.i18n.translate(key, fallback);
    return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, valueKey: string) => values[valueKey] ?? match);
  }

  private isSystemSupplyRequestNote(note: string): boolean {
    return note === 'Awaiting owner confirmation.'
      || note === 'Approved and synced with the plan.'
      || note === 'Reserved and assigned by the owner.'
      || note === 'Borrow request approved by the owner.';
  }

  private formatSupplyRequestDateRange(start: Date, end: Date): string {
    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
      return `${this.formatSupplyRequestDate(start)} ${this.formatSupplyRequestTime(start)} - ${this.formatSupplyRequestTime(end)}`;
    }
    return `${this.formatSupplyRequestDate(start)} ${this.formatSupplyRequestTime(start)} - ${this.formatSupplyRequestDate(end)} ${this.formatSupplyRequestTime(end)}`;
  }

  private formatSupplyRequestDate(value: Date): string {
    const year = value.getFullYear();
    const month = value.toLocaleDateString('en-US', { month: 'short' });
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year} ${month} ${day}`;
  }

  private formatSupplyRequestTime(value: Date): string {
    return value.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private parseIsoDate(value: string | null | undefined): Date | null {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseIsoDateMs(value: string | null | undefined): number | null {
    return this.parseIsoDate(value)?.getTime() ?? null;
  }

  protected openOwnedAssetMap(card: AppDTOs.AssetCardDTO): void {
    if (!this.assetFacade.canOpenOwnedAssetMap(card)) {
      return;
    }
    this.ownedAssets.openAssetMap(card);
  }

  protected onAssetFilterChange(filter: AppConstants.AssetFilterType): void {
    if (this.isBasketMode()) {
      return;
    }
    this.ownedAssets.selectAssetFilter(filter);
    this.assetSmartListQuery = {
      filters: {
        userId: this.activeUserId(),
        type: filter === 'Ticket' ? 'Car' : filter,
        refreshToken: this.ownedAssets.assetListReloadRevision()
      }
    };
  }

  protected ticketInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ) {
    return this.assetFacade.ticketInfoCard(row, options);
  }

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.assetPopup.setTicketScannerVideoElement(element);
  }

  protected onTicketSmartListStateChange(change: SmartListStateChange<AppTypes.ActivityListRow, AssetTicketListFilters>): void {
    this.assetPopup.updateTicketListState(change);
  }

  protected onAssetSmartListStateChange(change: SmartListStateChange<AppDTOs.AssetCardDTO, OwnedAssetListFilters>): void {
    this.assetListVisibleCount = change.items.length;
    this.assetListReady = !change.initialLoading;
    if (!this.assetListReady || this.ownedAssets.isTicketPopup()) {
      return;
    }
    const cards = this.orderedOwnedAssetCards(this.currentAssetSmartListType());
    if (change.total !== cards.length) {
      this.syncVisibleOwnedAssetCards(cards, change.total);
    }
  }

  protected closeAssetPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.showSupplyRequestList) {
      this.closeSupplyRequestList();
      return;
    }
    const host = this.assetPopup.host();
    if (host?.isSubEventAssetAssignPopup()) {
      host.closeSubEventAssetAssignPopup(false);
      return;
    }
    this.appMenuDispatcher.close();
    this.ownedAssets.closePopup();
  }

  protected confirmBasketSelection(event?: Event): void {
    const host = this.assetPopup.host();
    if (!host?.isSubEventAssetAssignPopup()) {
      return;
    }
    host.confirmSubEventAssetAssignSelection(event);
  }

  protected onBasketChipClick(payload: { chip: BasketChip; event: Event }): void {
    const host = this.assetPopup.host();
    if (!host?.isSubEventAssetAssignPopup()) {
      return;
    }
    host.toggleSubEventAssetAssignCard(payload.chip.id, payload.event);
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.assetPopup.ticketOverlayMode()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.assetPopup.closeTicketOverlay();
      return;
    }
    if (this.appMenuDispatcher.activeMenu()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.appMenuDispatcher.close();
      return;
    }
    if (this.showSupplyRequestList) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeSupplyRequestList();
      return;
    }
    if (this.ownedAssets.pendingAssetDeleteCardId) {
      return;
    }
    if (this.ownedAssets.isPopupOpen()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeAssetPopup();
    }
  }

  ngOnDestroy(): void {
    this.assetPopup.setTicketScannerVideoElement(null);
  }


  private syncSmartListQueries(): void {
    const activeUserId = this.activeUserId();
    const assetType = this.currentAssetSmartListType();
    const basketMode = this.isBasketMode();
    const assetKey = `${activeUserId}:${assetType}:${basketMode ? 'basket' : 'assets'}:${this.ownedAssets.assetListReloadRevision()}`;
    if (assetKey !== this.assetSmartListQueryKey) {
      this.assetSmartListQueryKey = assetKey;
      this.assetSmartListQueryRevision += 1;
      this.assetSmartListQuery = {
        filters: {
          userId: activeUserId,
          type: assetType,
          refreshToken: this.assetSmartListQueryRevision
        }
      };
    }

    const ticketOrder = this.assetPopup.ticketDateOrder();
    const ticketKey = `${activeUserId}:${ticketOrder}`;
    if (ticketKey !== this.ticketSmartListQueryKey) {
      this.ticketSmartListQueryKey = ticketKey;
      this.ticketSmartListQueryRevision += 1;
      this.ticketSmartListQuery = {
        filters: {
          userId: activeUserId,
          order: ticketOrder
        },
        page: 0
      };
    }
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
  }

  private currentAssetSmartListType(): AppConstants.AssetType {
    const currentFilter = this.ownedAssets.assetFilter;
    return currentFilter === 'Accommodation' || currentFilter === 'Supplies' ? currentFilter : 'Car';
  }

  private syncVisibleOwnedAssets(): void {
    if (!this.ownedAssets.isPopupOpen() || this.ownedAssets.isTicketPopup()) {
      this.lastAssetListContextKey = '';
      this.lastAssetCardsSignature = '';
      this.lastAssetCardCount = 0;
      this.assetListReady = false;
      this.assetListVisibleCount = 0;
      return;
    }

    const activeUserId = this.activeUserId();
    const assetType = this.currentAssetSmartListType();
    const selectedAssetKey = this.isBasketMode()
      ? (this.assetPopup.host()?.selectedSubEventAssetAssignChips() ?? []).map(card => card.id).join('|')
      : '';
    const contextKey = `${activeUserId}:${assetType}:${this.isBasketMode() ? `basket:${selectedAssetKey}` : 'assets'}`;
    const cards = this.orderedOwnedAssetCards(assetType);
    const signature = `${contextKey}:${cards.map(card => [
      card.id,
      card.type,
      card.title,
      card.subtitle,
      card.city,
      card.capacityTotal,
      card.quantity,
      card.details,
      card.imageUrl,
      card.sourceLink,
      card.visibility ?? '',
      card.status ?? '',
      card.ownerUserId ?? '',
      card.ownerName ?? '',
      (card.menuActions ?? []).join(','),
      JSON.stringify(card.pricing ?? null),
      ...(card.routes ?? []),
      card.requests.map(request => [
        request.id,
        request.status,
        request.note,
        request.requestKind ?? '',
        request.booking?.quantity ?? '',
        request.booking?.inventoryApplied ?? '',
        (request.menuActions ?? []).join(',')
      ].join('/')).join(',')
    ].join(':')).join('|')}`;

    if (contextKey !== this.lastAssetListContextKey) {
      this.lastAssetListContextKey = contextKey;
      this.lastAssetCardsSignature = signature;
      this.lastAssetCardCount = cards.length;
      this.assetListReady = false;
      this.assetListVisibleCount = 0;
      return;
    }

    if (signature === this.lastAssetCardsSignature) {
      return;
    }

    const previousCardCount = this.lastAssetCardCount;
    this.lastAssetCardsSignature = signature;
    this.lastAssetCardCount = cards.length;
    this.syncVisibleOwnedAssetCards(cards, previousCardCount);
  }

  private syncVisibleOwnedAssetCards(cards: AppDTOs.AssetCardDTO[], previousCardCount: number): void {
    if (!this.assetListReady || !this.assetSmartList) {
      return;
    }

    const visibleCount = Math.max(this.assetListVisibleCount, this.assetSmartList.itemsSnapshot().length);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + 1);
    }

    this.assetSmartList.replaceVisibleItems(cards.slice(0, nextVisibleCount).map(card => this.cloneOwnedAsset(card)), {
      total: cards.length
    });
  }

  private orderedOwnedAssetCards(type: AppConstants.AssetType): AppDTOs.AssetCardDTO[] {
    const selectedAssetIds = this.isBasketMode()
      ? new Set((this.assetPopup.host()?.selectedSubEventAssetAssignChips() ?? []).map(card => card.id.trim()).filter(Boolean))
      : null;
    return this.ownedAssets.assetCards
      .filter(card => card.type === type)
      .sort((left, right) => {
        if (selectedAssetIds) {
          const selectedDelta = Number(selectedAssetIds.has(right.id)) - Number(selectedAssetIds.has(left.id));
          if (selectedDelta !== 0) {
            return selectedDelta;
          }
        }
        return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      });
  }

  private async loadTicketSmartListPage(
    query: ListQuery<AssetTicketListFilters>
  ): Promise<{ items: AppTypes.ActivityListRow[]; total: number }> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    if (!userId) {
      return {
        items: [],
        total: 0
      };
    }
    const page = await this.assetTicketsService.queryTicketPage({
      userId,
      page: Math.max(0, Math.trunc(Number(query.page) || 0)),
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1)),
      order: query.filters?.order === 'past' ? 'past' : 'upcoming'
    });
    return {
      items: page.items.map(row => ({ ...row })),
      total: page.total
    };
  }

  private async loadOwnedAssetSmartListPage(
    query: ListQuery<OwnedAssetListFilters>
  ): Promise<{ items: AppDTOs.AssetCardDTO[]; total: number }> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    const type = query.filters?.type;
    if (!userId || (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies')) {
      return {
        items: [],
        total: 0
      };
    }
    await this.ownedAssets.waitForAssetListLoad(userId);
    const filtered = this.orderedOwnedAssetCards(type);
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map(card => this.cloneOwnedAsset(card)),
      total: filtered.length
    };
  }

  private cloneOwnedAsset(card: AppDTOs.AssetCardDTO): AppDTOs.AssetCardDTO {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }))
    };
  }
}
