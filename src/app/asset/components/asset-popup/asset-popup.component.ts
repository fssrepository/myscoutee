import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, OnDestroy, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

import { AssetFacadeService } from '../../asset-facade.service';
import { AssetPopupStateService } from '../../asset-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppContext, AssetsService, AssetTicketsService } from '../../../shared/core';
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
  styleUrl: './asset-popup.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class AssetPopupComponent implements DoCheck, OnDestroy {
  private readonly assetFacade = inject(AssetFacadeService);
  private readonly appCtx = inject(AppContext);
  private readonly assetsService = inject(AssetsService);
  private readonly assetTicketsService = inject(AssetTicketsService);
  protected readonly assetPopup = inject(AssetPopupStateService);
  protected readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  protected readonly assetFilterOpen = signal(false);
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
    if (event.actionId === 'delete') {
      this.ownedAssets.runAssetItemDeleteAction(card);
      return;
    }
    this.ownedAssets.runAssetItemEditAction(card);
  }

  protected onOwnedAssetMediaEndClick(card: AppTypes.AssetCard, selectMode: boolean): void {
    if (!selectMode) {
      return;
    }
    this.assetPopup.host()?.toggleSubEventAssetAssignCard(card.id);
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
    this.ownedAssets.selectAssetFilter(filter);
    this.assetSmartListQuery = {
      filters: {
        userId: this.activeUserId(),
        type: filter === 'Ticket' ? 'Car' : filter,
        refreshToken: this.ownedAssets.assetListRevision()
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

  protected onAssetFilterMenuOpenChange(isOpen: boolean): void {
    this.assetFilterOpen.set(isOpen);
  }

  protected closeAssetPopup(event?: Event): void {
    event?.stopPropagation();
    const host = this.assetPopup.host();
    if (host?.isSubEventAssetAssignPopup()) {
      host.closeSubEventAssetAssignPopup(false);
      return;
    }
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
    const basketCardsKey = basketMode
      ? this.ownedAssets.assetCards
        .filter(card => card.type === assetType)
        .map(card => card.id)
        .join('|')
      : '';
    const assetKey = basketMode
      ? `${activeUserId}:${assetType}:basket:${basketCardsKey}`
      : `${activeUserId}:${assetType}:assets:${this.ownedAssets.assetListRevision()}`;
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
    return this.appCtx.activeUserId().trim() || 'u1';
  }

  private currentAssetSmartListType(): AppTypes.AssetType {
    const currentFilter = this.ownedAssets.assetFilter;
    return currentFilter === 'Accommodation' || currentFilter === 'Supplies' ? currentFilter : 'Car';
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
    const cards = await this.assetsService.queryOwnedAssetsByUser(userId);
    const selectedAssetIds = this.isBasketMode()
      ? new Set((this.assetPopup.host()?.selectedSubEventAssetAssignChips() ?? []).map(card => card.id.trim()).filter(Boolean))
      : null;
    const filtered = cards
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
      requests: card.requests.map(request => ({ ...request }))
    };
  }
}
