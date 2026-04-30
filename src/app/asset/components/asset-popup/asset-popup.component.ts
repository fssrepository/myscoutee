import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

import { AssetFacadeService } from '../../asset-facade.service';
import { AssetPopupStateService } from '../../asset-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';
import { AssetCardBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppContext, AssetTicketsService, ShareTokensService } from '../../../shared/core';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import { AssetFormPopupComponent } from '../asset-form-popup/asset-form-popup.component';
import { AssetTicketCodePopupComponent } from '../asset-ticket-code-popup/asset-ticket-code-popup.component';
import { AssetTicketScannerPopupComponent } from '../asset-ticket-scanner-popup/asset-ticket-scanner-popup.component';
import {
  BasketComponent,
  InfoCardComponent,
  SmartListComponent,
  type BasketChip,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type SmartListConfig,
  type SmartListStateChange,
  ConfirmationDialogComponent
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';

interface AssetTicketListFilters {
  userId?: string;
  order?: AppTypes.AssetTicketOrder;
}

interface OwnedAssetListFilters {
  userId?: string;
  type?: AppTypes.AssetType;
  refreshToken?: number;
}

@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    BasketComponent,
    InfoCardComponent,
    SmartListComponent,
    ConfirmationDialogComponent,
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
  protected readonly assetPopup = inject(AssetPopupStateService);
  protected readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  protected readonly assetFilterOpen = signal(false);
  protected showMobileAssetFilterPicker = false;
  private lastAssetListContextKey = '';
  private lastAssetCardsSignature = '';
  private lastAssetCardCount = 0;
  private assetListReady = false;
  private assetListVisibleCount = 0;
  protected showSupplyRequestList = false;
  protected selectedSupplyAssetId: string | null = null;
  protected supplyRequestActionMenu: { id: string; openUp: boolean } | null = null;
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
  protected assetSmartListQuery: Partial<ListQuery<OwnedAssetListFilters>> = {};
  protected ticketSmartListQuery: Partial<ListQuery<AssetTicketListFilters>> = {};
  private assetSmartListQueryKey = '';
  private assetSmartListQueryRevision = 0;
  private ticketSmartListQueryKey = '';
  private ticketSmartListQueryRevision = 0;
  @ViewChild('assetSmartList')
  private assetSmartList?: SmartListComponent<AppTypes.AssetCard, OwnedAssetListFilters>;

  protected readonly assetSmartListLoadPage = (query: ListQuery<OwnedAssetListFilters>) =>
    from(this.loadOwnedAssetSmartListPage(query));
  protected readonly ticketSmartListLoadPage = (query: ListQuery<AssetTicketListFilters>) =>
    from(this.loadTicketSmartListPage(query));
  protected readonly assetSmartListConfig: SmartListConfig<AppTypes.AssetCard, OwnedAssetListFilters> = {
    pageSize: 18,
    loadingDelayMs: resolveCurrentRouteDelayMs('/assets'),
    defaultView: 'list',
    emptyLabel: query => this.assetFacade.ownedAssetEmptyLabel(query.filters?.type ?? 'Car'),
    emptyDescription: query => this.assetFacade.ownedAssetEmptyDescription(query.filters?.type ?? 'Car'),
    headerProgress: {
      enabled: true
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
    loadingDelayMs: resolveCurrentRouteDelayMs('/assets/tickets'),
    defaultView: 'list',
    emptyLabel: 'No ticketed events',
    emptyDescription: 'Enable Ticketing On in an event to generate a ticket here.',
    emptyStickyLabel: 'No tickets',
    headerProgress: {
      enabled: true
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

  protected basketSaveRingPerimeter(): number {
    const host = this.assetPopup.host();
    return host?.isSubEventAssetAssignPopup() ? host.subEventAssetAssignRingPerimeter() : 100;
  }

  protected ownedAssetInfoCard(
    card: AppTypes.AssetCard,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ) {
    return this.assetFacade.ownedAssetInfoCard(card, options);
  }

  protected isAssetAssignCardSelected(cardId: string): boolean {
    const host = this.assetPopup.host();
    return !!host && host.isSubEventAssetAssignPopup() && host.isSubEventAssetAssignCardSelected(cardId);
  }

  protected onOwnedAssetInfoCardMenuAction(card: AppTypes.AssetCard, event: InfoCardMenuActionEvent): void {
    if (this.isBasketMode()) {
      return;
    }
    if (event.actionId === 'share') {
      this.openOwnedAssetShareDialog(card);
      return;
    }
    if (event.actionId === 'delete') {
      this.ownedAssets.runAssetItemDeleteAction(card);
      return;
    }
    this.ownedAssets.runAssetItemEditAction(card);
  }

  private openOwnedAssetShareDialog(card: AppTypes.AssetCard): void {
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

  protected onOwnedAssetMediaEndClick(card: AppTypes.AssetCard, selectMode: boolean): void {
    if (!selectMode) {
      this.openSupplyRequestList(card);
      return;
    }
    this.assetPopup.host()?.toggleSubEventAssetAssignCard(card.id);
  }

  protected openSupplyRequestList(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    if (this.isBasketMode()) {
      return;
    }
    this.selectedSupplyAssetId = card.id;
    this.showSupplyRequestList = true;
    this.supplyRequestActionMenu = null;
    this.supplyRequestBusyKey = '';
  }

  protected closeSupplyRequestList(event?: Event): void {
    event?.stopPropagation();
    this.showSupplyRequestList = false;
    this.selectedSupplyAssetId = null;
    this.supplyRequestActionMenu = null;
    this.supplyRequestBusyKey = '';
  }

  protected selectedSupplyAsset(): AppTypes.AssetCard | null {
    const assetId = `${this.selectedSupplyAssetId ?? ''}`.trim();
    if (!assetId) {
      return null;
    }
    return this.ownedAssets.assetCards.find(card => card.id === assetId) ?? null;
  }

  protected assetRequestListSubtitle(): string {
    return 'Requests and assignments with time-based availability';
  }

  protected selectedSupplySummaryPending(): number {
    return this.supplyPendingRequests().reduce((sum, request) => sum + this.supplyRequestQuantity(request), 0);
  }

  protected selectedSupplyTotalQuantity(): number {
    const asset = this.selectedSupplyAsset();
    return asset ? AssetCardBuilder.quantityValue(asset) : 0;
  }

  protected supplyPendingRequests(): AppTypes.AssetMemberRequest[] {
    return (this.selectedSupplyAsset()?.requests ?? [])
      .filter(request => request.status === 'pending' && !this.isAssignedSupplyRequest(request));
  }

  protected supplyBorrowedRequests(): AppTypes.AssetMemberRequest[] {
    return (this.selectedSupplyAsset()?.requests ?? [])
      .filter(request => request.status === 'accepted' && !this.isAssignedSupplyRequest(request));
  }

  protected supplyAssignedRequests(): AppTypes.AssetMemberRequest[] {
    return (this.selectedSupplyAsset()?.requests ?? [])
      .filter(request => this.isAssignedSupplyRequest(request));
  }

  protected supplyRequestQuantity(request: AppTypes.AssetMemberRequest): number {
    const raw = Number(request.booking?.quantity);
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
  }

  protected supplyRequestReservationLabel(request: AppTypes.AssetMemberRequest): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    if (this.isAssignedSupplyRequest(request)) {
      return `Assigned ${quantityLabel}`;
    }
    if (request.status === 'accepted') {
      return `Borrowed ${quantityLabel}`;
    }
    return `Borrow request for ${quantityLabel}`;
  }

  protected supplyRequestEventLabel(request: AppTypes.AssetMemberRequest): string {
    return [
      `${request.booking?.eventTitle ?? ''}`.trim(),
      `${request.booking?.subEventTitle ?? ''}`.trim()
    ].filter(Boolean).join(' · ');
  }

  protected supplyRequestScheduleLabel(request: AppTypes.AssetMemberRequest): string {
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

  protected supplyRequestDisplayNote(request: AppTypes.AssetMemberRequest): string {
    const note = `${request.note ?? ''}`.trim();
    if (!note || this.isSystemSupplyRequestNote(note)) {
      return '';
    }
    return note;
  }

  protected supplyRequestInventoryLabel(request: AppTypes.AssetMemberRequest): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    const total = this.selectedSupplyTotalQuantity();
    if (total <= 0) {
      return `${quantityLabel} requested. No quantity configured.`;
    }
    const remaining = this.selectedSupplyRemainingQuantityForRequest(request);
    if (remaining < 0) {
      return `${quantityLabel} requested. ${Math.abs(remaining)} over the limit for this time.`;
    }
    return `${quantityLabel} requested. ${Math.max(0, remaining)} left for this time.`;
  }

  protected supplyRequestInventoryBadgeLabel(request: AppTypes.AssetMemberRequest): string {
    const quantityLabel = this.supplyRequestQuantityLabel(request);
    const total = this.selectedSupplyTotalQuantity();
    if (total <= 0) {
      return `${quantityLabel} / no qty`;
    }
    const remaining = this.selectedSupplyRemainingQuantityForRequest(request);
    if (remaining < 0) {
      return `${quantityLabel} / ${Math.abs(remaining)} over`;
    }
    return `${quantityLabel} / ${Math.max(0, remaining)} left`;
  }

  protected supplyRequestInventoryState(request: AppTypes.AssetMemberRequest): 'available' | 'empty' | 'over' | 'unset' {
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

  protected supplyRequestStatusLabel(request: AppTypes.AssetMemberRequest): string {
    if (this.isAssignedSupplyRequest(request)) {
      return 'Assigned';
    }
    return request.status === 'accepted' ? 'Borrowed' : 'Pending';
  }

  protected toggleSupplyRequestActionMenu(request: AppTypes.AssetMemberRequest, event: Event): void {
    event.stopPropagation();
    if (request.status !== 'pending' || this.isAssignedSupplyRequest(request)) {
      return;
    }
    if (this.supplyRequestActionMenu?.id === request.id) {
      this.supplyRequestActionMenu = null;
      return;
    }
    this.supplyRequestActionMenu = {
      id: request.id,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isSupplyRequestActionMenuOpen(request: AppTypes.AssetMemberRequest): boolean {
    return this.supplyRequestActionMenu?.id === request.id;
  }

  protected isSupplyRequestActionMenuOpenUp(request: AppTypes.AssetMemberRequest): boolean {
    return this.supplyRequestActionMenu?.id === request.id && this.supplyRequestActionMenu.openUp;
  }

  protected isSupplyRequestBusy(request: AppTypes.AssetMemberRequest, action: AppTypes.AssetRequestAction): boolean {
    return this.supplyRequestBusyKey === `${request.id}:${action}`;
  }

  protected async approveSupplyRequest(request: AppTypes.AssetMemberRequest, event: Event): Promise<void> {
    event.stopPropagation();
    const asset = this.selectedSupplyAsset();
    if (!asset || request.status !== 'pending') {
      return;
    }
    this.supplyRequestActionMenu = null;
    this.supplyRequestBusyKey = `${request.id}:accept`;
    try {
      await this.ownedAssets.applyAssetRequestAction(asset.id, request.id, 'accept');
    } finally {
      this.supplyRequestBusyKey = '';
    }
  }

  protected async rejectSupplyRequest(request: AppTypes.AssetMemberRequest, event: Event): Promise<void> {
    event.stopPropagation();
    const asset = this.selectedSupplyAsset();
    if (!asset) {
      return;
    }
    this.supplyRequestActionMenu = null;
    this.supplyRequestBusyKey = `${request.id}:remove`;
    try {
      await this.ownedAssets.applyAssetRequestAction(asset.id, request.id, 'remove');
    } finally {
      this.supplyRequestBusyKey = '';
    }
  }

  protected supplyRequestEmptyLabel(): string {
    if (this.selectedSupplyTotalQuantity() <= 0) {
      return 'No quantity entered yet.';
    }
    return 'No borrow or assignment activity yet.';
  }

  private isAssignedSupplyRequest(request: AppTypes.AssetMemberRequest): boolean {
    return request.requestKind === 'manual';
  }

  private selectedSupplyRemainingQuantityForRequest(request: AppTypes.AssetMemberRequest): number {
    const overlappingCommitted = (this.selectedSupplyAsset()?.requests ?? [])
      .filter(other => this.isCommittedSupplyRequest(other))
      .filter(other => this.isSupplyRequestTimeOverlap(request, other))
      .reduce((sum, other) => sum + this.supplyRequestQuantity(other), 0);
    const pendingCurrentQuantity = this.isCommittedSupplyRequest(request) ? 0 : this.supplyRequestQuantity(request);
    return this.selectedSupplyTotalQuantity() - overlappingCommitted - pendingCurrentQuantity;
  }

  private isCommittedSupplyRequest(request: AppTypes.AssetMemberRequest): boolean {
    return request.status === 'accepted' || this.isAssignedSupplyRequest(request);
  }

  private isSupplyRequestTimeOverlap(
    left: AppTypes.AssetMemberRequest,
    right: AppTypes.AssetMemberRequest
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

  private requestTimeWindowKey(request: AppTypes.AssetMemberRequest): string {
    return [
      `${request.booking?.eventId ?? ''}`.trim(),
      `${request.booking?.subEventId ?? ''}`.trim(),
      `${request.booking?.slotLabel ?? ''}`.trim(),
      `${request.booking?.timeframe ?? ''}`.trim()
    ].filter(Boolean).join('|');
  }

  private supplyRequestQuantityLabel(request: AppTypes.AssetMemberRequest): string {
    const quantity = this.supplyRequestQuantity(request);
    return quantity === 1 ? '1 item' : `${quantity} items`;
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

  protected openOwnedAssetMap(card: AppTypes.AssetCard): void {
    if (!this.assetFacade.canOpenOwnedAssetMap(card)) {
      return;
    }
    this.ownedAssets.openAssetMap(card);
  }

  protected onAssetFilterChange(filter: AppTypes.AssetFilterType): void {
    if (this.isBasketMode()) {
      return;
    }
    this.showMobileAssetFilterPicker = false;
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

  protected onAssetSmartListStateChange(change: SmartListStateChange<AppTypes.AssetCard, OwnedAssetListFilters>): void {
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

  protected onAssetFilterMenuOpenChange(isOpen: boolean): void {
    this.assetFilterOpen.set(isOpen);
  }

  protected openMobileAssetFilterSelector(event: Event): void {
    if (!this.isMobileAssetFilterSheetViewport() || this.isBasketMode()) {
      return;
    }
    event.stopPropagation();
    this.assetFilterOpen.set(false);
    this.showMobileAssetFilterPicker = !this.showMobileAssetFilterPicker;
  }

  protected selectMobileAssetFilter(filter: AppTypes.AssetFilterType, event?: Event): void {
    event?.stopPropagation();
    this.onAssetFilterChange(filter);
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
    this.showMobileAssetFilterPicker = false;
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
    if (this.showMobileAssetFilterPicker) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showMobileAssetFilterPicker = false;
      return;
    }
    if (this.showSupplyRequestList) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      if (this.supplyRequestActionMenu) {
        this.supplyRequestActionMenu = null;
        return;
      }
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

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.popup-mobile-filter-picker')) {
      this.showMobileAssetFilterPicker = false;
    }
    if (!target.closest('.asset-supply-request-menu-anchor')) {
      this.supplyRequestActionMenu = null;
    }
    if (target.closest('.item-action-menu') || target.closest('.experience-action-menu-trigger')) {
      return;
    }
    this.ownedAssets.closeAssetItemActionMenu();
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

  private currentAssetSmartListType(): AppTypes.AssetType {
    const currentFilter = this.ownedAssets.assetFilter;
    return currentFilter === 'Accommodation' || currentFilter === 'Supplies' ? currentFilter : 'Car';
  }

  protected isMobileAssetFilterSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
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
      card.details,
      card.imageUrl,
      card.sourceLink,
      JSON.stringify(card.pricing ?? null),
      ...(card.routes ?? []),
      String(card.requests.length)
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

  private syncVisibleOwnedAssetCards(cards: AppTypes.AssetCard[], previousCardCount: number): void {
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

  private orderedOwnedAssetCards(type: AppTypes.AssetType): AppTypes.AssetCard[] {
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
  ): Promise<{ items: AppTypes.AssetCard[]; total: number }> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    const type = query.filters?.type;
    if (!userId || (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies')) {
      return {
        items: [],
        total: 0
      };
    }
    const filtered = this.orderedOwnedAssetCards(type);
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map(card => this.cloneOwnedAsset(card)),
      total: filtered.length
    };
  }

  private cloneOwnedAsset(card: AppTypes.AssetCard): AppTypes.AssetCard {
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

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileAssetFilterSheetViewport() || typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const actionWrap = (trigger?.closest('.asset-supply-request-menu-anchor') as HTMLElement | null) ?? trigger;
    if (!actionWrap) {
      return false;
    }
    const rect = actionWrap.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 220;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }
}
