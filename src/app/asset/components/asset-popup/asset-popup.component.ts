import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, ViewChild, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { SubEventResourcePopupController } from '../../../activity/services/sub-event-resource-popup.controller';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import { AppContext, AssetInfoCardConverter, AssetTicketInfoCardConverter, type ActivityCounterKey } from '../../../shared/ui';
import { AssetsService, AssetTicketsService, ExplanationGuideService, ShareTokensService } from '../../../shared/core';
import { AssetEditorPopupComponent } from '../asset-editor-popup/asset-editor-popup.component';
import { AssetTicketScanPopupComponent } from '../asset-ticket-scan-popup/asset-ticket-scan-popup.component';
import {
  AppMenuComponent,
  AppMenuDispatcher,
  AppMenuOutletComponent,
  AppMenuTriggerComponent,
  InfoCardComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuAction,
  type ListQuery,
  type SingleRowData,
  type SmartListConfig,
  type SmartListItemSelectEvent,
  type SmartListStateChange,
  ConfirmationDialogComponent
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { AssetPopupStore } from '../../../shared/ui/context/stores/asset-popup.store';
import { OwnedAssetsStore, type OwnedAssetsVisibleListPatch } from '../../../shared/ui/context/stores/owned-assets.store';
import { SubEventResourcePopupStore } from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import { I18nService } from '../../../shared/core';
import { I18nPipe } from '../../../shared/ui';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';
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
  | { menu: 'asset-assign-basket'; assetCard: AppDTOs.AssetDTO }
  | { menu: 'asset-assign-confirm' }
  | { menu: 'supply-request-filter'; filter: AssetSupplyRequestFilter }
  | { menu: 'supply-request-action'; row: AssetSupplyRequestRow; action: AssetSupplyRequestRowAction }
  | {
      menu: 'asset-info-card';
      assetCard: AppDTOs.AssetDTO;
      card: InfoCardData;
      action: CardMenuAction;
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
    InfoCardComponent,
    SmartListComponent,
    ConfirmationDialogComponent,
    I18nPipe,
    AssetEditorPopupComponent,
    AssetTicketScanPopupComponent
  ],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.scss',
  providers: [AppMenuDispatcher]
})
export class AssetPopupComponent {
  private readonly appCtx = inject(AppContext);
  private readonly assetsService = inject(AssetsService);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly assetPopupStore = inject(AssetPopupStore);
  protected readonly ownedAssetsStore = inject(OwnedAssetsStore);
  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly subEventResources = inject(SubEventResourcePopupController);
  private readonly explanationGuide = inject(ExplanationGuideService);
  protected showSupplyRequestList = false;
  protected selectedSupplyAssetId: string | null = null;
  protected supplyRequestFilter: AssetSupplyRequestFilter = 'all';
  protected supplyRequestBusyKey = '';
  protected readonly cancelOwnedAssetDelete = (): void => this.ownedAssetsStore.cancelAssetDelete();
  protected readonly confirmOwnedAssetDelete = (): void => { void this.confirmOwnedAssetDeleteAction(); };
  protected readonly assetFilterOptions = APP_STATIC_DATA.assetFilterOptions;
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
  private trackedAssetRefreshToken = 0;
  private trackedAssetRefreshOwnerUserId = '';
  private trackedAssetRefreshPromise: Promise<void> | null = null;
  private assetsExplanationContextKey: string | null = null;
  private unregisterAssetsExplanationContext: (() => void) | null = null;
  @ViewChild('assetSmartList')
  private assetSmartList?: SmartListComponent<AppDTOs.AssetDTO, OwnedAssetListFilters>;

  protected readonly assetSmartListLoadPage = (query: ListQuery<OwnedAssetListFilters>) =>
    from(this.loadOwnedAssetSmartListPage(query));
  protected readonly ticketSmartListLoadPage = (query: ListQuery<AssetTicketListFilters>) =>
    from(this.loadTicketSmartListPage(query));
  protected readonly assetSmartListConfig: SmartListConfig<AppDTOs.AssetDTO, OwnedAssetListFilters> = {
    pageSize: 18,
    defaultView: 'list',
    emptyLabel: query => AssetDefaultsBuilder.ownedAssetEmptyLabel(query.filters?.type ?? 'Car'),
    emptyDescription: query => AssetDefaultsBuilder.ownedAssetEmptyDescription(query.filters?.type ?? 'Car'),
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.runtimeStore.isOnline() ? 'active' : 'inactive'
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
  protected readonly ticketSmartListConfig: SmartListConfig<AssetContracts.AssetTicketDTO, AssetTicketListFilters> = {
    pageSize: 18,
    defaultView: 'list',
    emptyLabel: 'No ticketed events',
    emptyDescription: 'Enable Ticketing On in an event to generate a ticket here.',
    emptyStickyLabel: 'No tickets',
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.runtimeStore.isOnline() ? 'active' : 'inactive'
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
    groupBy: row => AssetTicketInfoCardConverter.groupLabel(row.dateIso)
  };

  constructor() {
    this.syncSmartListQueries();
    effect(() => {
      this.initializeOwnedAssetsFromUser(this.appCtx.userProfileStore.activeUserProfile()?.id?.trim() || this.appCtx.userProfileStore.activeUserId().trim());
    });
    effect(() => {
      const activeFilter = this.ownedAssetsStore.activePopupFilter();
      if (!activeFilter) {
        return;
      }
      if (activeFilter === 'Ticket') {
        this.assetPopupStore.prepareTicketPopupOpen(
          this.assetTicketsService.peekTicketCountByUser(this.appCtx.userProfileStore.activeUserId().trim())
        );
      } else {
        void this.refreshOwnedAssetsFromRepository(
          this.ownedAssetsStore.activeOwnerUserIdRef().trim() || this.appCtx.userProfileStore.getActiveUserId().trim(),
          { trackLoading: true }
        );
      }
      this.setAssetsExplanationContext(this.assetExplanationContextForFilter(activeFilter));
      this.assetPopupStore.primaryVisibleRef.set(true);
      this.ownedAssetsStore.touchUiState();
    });
    effect(() => {
      this.ownedAssetsStore.assetListRevision();
      this.ownedAssetsStore.assetListReloadRevision();
      this.assetPopupStore.primaryVisibleRef();
      this.resourcePopupStore.assignContextRef();
      this.resourcePopupStore.selectedAssignAssetIdsRef();
      this.syncSmartListQueries();
      this.syncVisibleOwnedAssetListFromStore();
      this.cdr.markForCheck();
    });
  }

  protected isBasketMode(): boolean {
    return this.resourcePopupStore.assignContextRef() !== null;
  }

  protected assetPopupTitle(): string {
    const context = this.resourcePopupStore.assignContextRef();
    if (context) {
      const stageLabel = this.subEventStageLabel(this.resourcePopupStore.popupContextRef()?.subEvent);
      return stageLabel ? `Assign ${context.type} - ${stageLabel}` : `Assign ${context.type}`;
    }
    const filter = this.ownedAssetsStore.activePopupFilter() ?? this.ownedAssetsStore.assetFilter();
    return `Assets · ${AssetDefaultsBuilder.assetTypeLabel(filter)}`;
  }

  protected assetPopupSubtitle(): string {
    if (this.isBasketMode()) {
      const context = this.resourcePopupStore.popupContextRef();
      if (!context) {
        return 'Event';
      }
      const subEventName = this.subEventDisplayName(context.subEvent);
      if (context.parentTitle && subEventName) {
        return `${context.parentTitle} - ${subEventName}`;
      }
      return context.parentTitle || subEventName || 'Event';
    }
    return this.ownedAssetsStore.ticketPopup() ? this.assetPopupStore.ticketHeaderSummary() : '';
  }

  protected pendingOwnedAssetDeleteLabel(): string {
    const pendingLabel = this.ownedAssetsStore.pendingAssetDeleteLabel();
    if (pendingLabel) {
      return pendingLabel;
    }
    const pendingCardId = this.ownedAssetsStore.pendingAssetDeleteCardId();
    if (!pendingCardId) {
      return '';
    }
    const card = this.ownedAssetsStore.findAsset(pendingCardId);
    return card ? `Delete ${card.title}?` : 'Delete this item?';
  }

  protected assetAssignBasketCount(): number {
    return this.assetAssignBasketCards().length;
  }

  protected assetAssignBasketActionItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    const type = this.currentAssetSmartListType();
    const count = this.assetAssignBasketCount();
    const items: AppMenuItem<string, AssetPopupMenuContext>[] = [];
    if (count > 0) {
      items.push({
        id: 'asset-assign-basket',
        icon: AssetDefaultsBuilder.assetTypeIcon(type),
        openIcon: AssetDefaultsBuilder.assetTypeIcon(type),
        palette: this.assetFilterPalette(type),
        kind: 'branch',
        counter: count,
        ariaLabel: 'Open selected assets',
        items: this.assetAssignBasketMenuItems()
      });
    }
    items.push({
      id: 'asset-assign-confirm',
      icon: 'done',
      kind: 'action',
      palette: this.basketSaveErrorMessage() ? 'danger' : 'success',
      disabled: () => !this.canConfirmBasketSelection(),
      ariaLabel: 'Save selected assets',
      progress: {
        state: () => this.isBasketSavePending()
          ? 'loading'
          : this.basketSaveErrorMessage()
            ? 'error'
            : null
      },
      context: { menu: 'asset-assign-confirm' }
    });
    return items;
  }

  protected assetAssignBasketMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    return this.assetAssignBasketCards().map(card => ({
      id: `asset-assign-basket-${card.id}`,
      label: card.title,
      description: this.assetAssignBasketItemDescription(card),
      icon: AssetDefaultsBuilder.assetTypeIcon(card.type),
      kind: 'action',
      palette: this.assetFilterPalette(card.type),
      surface: 'tinted',
      removable: true,
      removeIcon: 'close',
      removeAriaLabel: `Remove ${card.title}`,
      closeOnSelect: false,
      context: { menu: 'asset-assign-basket', assetCard: card }
    }));
  }

  private assetAssignBasketCards(): AppDTOs.AssetDTO[] {
    const selected = new Set(this.resourcePopupStore.selectedAssignAssetIdsRef());
    return this.assetAssignCandidates().filter(card => selected.has(card.id));
  }

  private assetAssignCandidates(): AppDTOs.AssetDTO[] {
    const context = this.resourcePopupStore.assignContextRef();
    if (!context) {
      return [];
    }
    const assignedIds = new Set(this.currentAssignedAssetIds(context.subEventId, context.type));
    return this.ownedAssetsStore.assetCards()
      .filter(card => card.type === context.type)
      .sort((left, right) => {
        const assignedDelta = Number(assignedIds.has(right.id)) - Number(assignedIds.has(left.id));
        if (assignedDelta !== 0) {
          return assignedDelta;
        }
        return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      });
  }

  private currentAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const eligibleIds = new Set([
      ...this.ownedAssetsStore.assetCards().filter(card => card.type === type).map(card => card.id),
      ...(this.resourcePopupStore.popupContextRef()?.subEvent.id === subEventId
        ? this.resourcePopupStore.popupContextRef()?.fallbackCardsByType[type]?.map(card => card.id) ?? []
        : [])
    ]);
    return (this.resourcePopupStore.assignedAssetIdsByKey[this.assetAssignmentKey(subEventId, type)] ?? [])
      .filter(id => eligibleIds.has(id));
  }

  private normalizedSelectedAssignAssetIds(type: AppConstants.AssetType): string[] {
    const allowedIds = new Set(this.ownedAssetsStore.assetCards().filter(card => card.type === type).map(card => card.id));
    return this.resourcePopupStore.selectedAssignAssetIdsRef()
      .filter((id, index, ids) => allowedIds.has(id) && ids.indexOf(id) === index);
  }

  private assetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private subEventDisplayName(subEvent: AppDTOs.SubEventDTO | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: AppDTOs.SubEventDTO | null | undefined): string {
    return this.subEventDisplayName(subEvent) || 'Sub Event';
  }

  private assetAssignBasketItemDescription(card: AppDTOs.AssetDTO): string {
    return [
      AssetDefaultsBuilder.assetTypeLabel(card.type),
      card.subtitle,
      card.city
    ].map(value => `${value ?? ''}`.trim()).filter(Boolean).join(' · ');
  }

  protected canConfirmBasketSelection(): boolean {
    const context = this.resourcePopupStore.assignContextRef();
    if (!context || this.resourcePopupStore.pendingAssignSaveRef()?.busy === true) {
      return false;
    }
    const currentIds = [...this.currentAssignedAssetIds(context.subEventId, context.type)].sort();
    const nextIds = [...this.normalizedSelectedAssignAssetIds(context.type)].sort();
    if (currentIds.length !== nextIds.length) {
      return true;
    }
    return currentIds.some((assetId, index) => assetId !== nextIds[index]);
  }

  protected isBasketSavePending(): boolean {
    return this.resourcePopupStore.pendingAssignSaveRef()?.busy === true;
  }

  protected basketSaveErrorMessage(): string {
    return this.resourcePopupStore.pendingAssignSaveRef()?.error?.trim() ?? '';
  }

  protected ownedAssetInfoCard(
    card: AppDTOs.AssetDTO,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ) {
    return AssetInfoCardConverter.convert(card, options);
  }

  protected isAssetAssignCardSelected(cardId: string): boolean {
    return this.resourcePopupStore.selectedAssignAssetIdsRef().includes(cardId);
  }

  protected onOwnedAssetCardMenuAction(
    card: AppDTOs.AssetDTO,
    event: CardMenuActionEvent<InfoCardData>,
    selectItem?: (() => void) | null
  ): void {
    if (event.actionId === 'toggleSelection') {
      selectItem?.();
      return;
    }
    if (this.isBasketMode()) {
      return;
    }
    if (event.actionId === 'shareAsset' || event.actionId === 'share') {
      this.openOwnedAssetShareDialog(card);
      return;
    }
    if (event.actionId === 'delete') {
      this.ownedAssetsStore.requestAssetDelete(card);
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
        onConfirm: () => this.takeOverAssetCardById(card.id)
      });
      return;
    }
    if (event.actionId === 'editAsset' || event.actionId === 'edit') {
      void this.openAssetEditor(card);
    }
  }

  private async openAssetEditor(card: AppDTOs.AssetDTO): Promise<void> {
    const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
      || this.appCtx.userProfileStore.getActiveUserId().trim();
    const generation = this.ownedAssetsStore.openAssetEditorEdit({
      cardId: card.id,
      form: AssetCardBuilder.buildAssetFormFromCard(card),
      visibility: AssetCardBuilder.visibilityFromCard(card),
      loading: Boolean(ownerUserId)
    });

    if (!ownerUserId) {
      this.ownedAssetsStore.setAssetEditorLoading(false);
      return;
    }

    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, card.id);
      if (!this.ownedAssetsStore.isCurrentAssetEditorLoad(generation, card.id)) {
        return;
      }
      if (loadedCard) {
        this.ownedAssetsStore.replaceAssetCard(loadedCard, { reloadList: false });
        this.ownedAssetsStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.ownedAssetsStore.setAssetEditorLoading(false);
    } catch {
      if (this.ownedAssetsStore.isCurrentAssetEditorLoad(generation, card.id)) {
        this.ownedAssetsStore.setAssetEditorLoading(false);
      }
    }
  }

  protected openAssetEditorCreate(): void {
    this.ownedAssetsStore.openAssetEditorCreate(
      AssetCardBuilder.buildEmptyAssetForm(AssetCardBuilder.activeAssetTypeFromFilter(this.ownedAssetsStore.assetFilter())),
      `asset-${Date.now()}`
    );
  }

  private async confirmOwnedAssetDeleteAction(): Promise<void> {
    const pendingCardId = this.ownedAssetsStore.beginAssetDelete();
    if (!pendingCardId) {
      return;
    }
    try {
      await this.deleteAssetCardById(pendingCardId);
      this.ownedAssetsStore.completeAssetDelete();
    } catch (error) {
      this.ownedAssetsStore.failAssetDelete(this.resolveAssetDeleteErrorMessage(error));
    }
  }

  private resolveAssetDeleteErrorMessage(error: unknown): string {
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = `${(error as { message?: unknown }).message ?? ''}`.trim();
      if (message) {
        return message;
      }
    }
    return 'Unable to delete asset right now.';
  }

  private async applyAssetRequestAction(
    assetId: string,
    requestId: string,
    action: AppConstants.AssetRequestAction
  ): Promise<void> {
    const normalizedAssetId = assetId.trim();
    const normalizedRequestId = requestId.trim();
    if (!normalizedAssetId || !normalizedRequestId || (action !== 'accept' && action !== 'remove')) {
      return;
    }
    const existing = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedAssetId) ?? null;
    if (!existing) {
      return;
    }

    let nextQuantity = AssetCardBuilder.storedQuantityValue(existing);
    const nextRequests = existing.requests
      .map(request => AssetCardBuilder.cloneRequest(request))
      .filter(request => {
        if (request.id !== normalizedRequestId) {
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

    const nextCard: AppDTOs.AssetDTO = {
      ...existing,
      quantity: nextQuantity,
      requests: nextRequests
    };

    const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
      || this.appCtx.userProfileStore.getActiveUserId().trim();
    this.ownedAssetsStore.applyAssetCards(this.ownedAssetsStore.assetCards().map(card => (
      card.id === normalizedAssetId ? nextCard : card
    )), { reloadList: false, mutation: true });
    if (!ownerUserId) {
      return;
    }
    const assetDetail = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, normalizedAssetId);
    if (!assetDetail) {
      return;
    }
    const savedCard = await this.assetsService.saveOwnedAsset(ownerUserId, {
      ...assetDetail,
      quantity: nextQuantity,
      requests: nextRequests
    });
    if (this.ownedAssetsStore.isActiveOwnerUser(ownerUserId)) {
      this.ownedAssetsStore.replaceAssetCard(savedCard, { reloadList: false });
    }
  }

  private async promoteAssetRequestToManager(assetId: string, requestId: string): Promise<void> {
    const normalizedAssetId = assetId.trim();
    const normalizedRequestId = requestId.trim();
    if (!normalizedAssetId || !normalizedRequestId) {
      return;
    }
    const existing = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedAssetId) ?? null;
    const request = existing?.requests.find(item => item.id === normalizedRequestId) ?? null;
    const targetUserId = `${request?.userId ?? ''}`.trim();
    const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
      || this.appCtx.userProfileStore.getActiveUserId().trim();
    if (!existing || !request || !targetUserId || !ownerUserId) {
      return;
    }
    const savedCard = await this.assetsService.makeAssetManager(ownerUserId, normalizedAssetId, targetUserId);
    if (!savedCard) {
      return;
    }
    this.ownedAssetsStore.replaceAssetCard(savedCard, { reloadList: false, mutation: true });
    this.ownedAssetsStore.touchUiState();
  }

  private async deleteAssetCardById(cardId: string): Promise<boolean> {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId || !this.ownedAssetsStore.assetCards().some(card => card.id === normalizedCardId)) {
      return false;
    }
    const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
      || this.appCtx.userProfileStore.getActiveUserId().trim();
    if (ownerUserId) {
      await this.assetsService.deleteOwnedAsset(ownerUserId, normalizedCardId);
    }
    this.ownedAssetsStore.removeAssetCard(normalizedCardId, { reloadList: false, mutation: true });
    this.ownedAssetsStore.recordAssetDeleted(normalizedCardId);
    return true;
  }

  private async takeOverAssetCardById(cardId: string): Promise<void> {
    const normalizedCardId = cardId.trim();
    const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
      || this.appCtx.userProfileStore.getActiveUserId().trim();
    if (!normalizedCardId || !ownerUserId) {
      return;
    }
    const current = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedCardId);
    if (!current) {
      return;
    }
    const nextStatus = AssetCardBuilder.restoredAssetStatus(current);
    const ownerName = this.appCtx.userProfileStore.activeUserProfile()?.name?.trim() || current.ownerName;
    const nextCard: AppDTOs.AssetDTO = {
      ...current,
      ownerUserId,
      ownerName,
      status: nextStatus,
      menuActions: this.restoredTakeOverMenuActions(current, null)
    };
    this.ownedAssetsStore.replaceAssetCard(nextCard, { reloadList: false, mutation: true });
    this.ownedAssetsStore.touchUiState();

    const savedCard = await this.assetsService.takeOverOwnedAsset(ownerUserId, normalizedCardId);
    if (
      (this.ownedAssetsStore.activeOwnerUserIdRef().trim() || this.appCtx.userProfileStore.getActiveUserId().trim()) !== ownerUserId
      || !savedCard
    ) {
      return;
    }
    const resolvedStatus = AssetCardBuilder.normalizeAssetStatus(savedCard.status);
    this.ownedAssetsStore.replaceAssetCard({
      ...nextCard,
      ...savedCard,
      ownerUserId: savedCard.ownerUserId ?? ownerUserId,
      ownerName: savedCard.ownerName ?? ownerName,
      status: resolvedStatus === 'UR' ? nextStatus : resolvedStatus,
      menuActions: this.restoredTakeOverMenuActions(nextCard, savedCard)
    }, { reloadList: false });
    this.ownedAssetsStore.touchUiState();
  }

  private restoredTakeOverMenuActions(
    current: AppDTOs.AssetDTO,
    savedCard: AppDTOs.AssetDTO | null | undefined
  ): string[] {
    const savedStatus = AssetCardBuilder.normalizeAssetStatus(savedCard?.status);
    const savedActions = (savedCard?.menuActions ?? [])
      .map(action => `${action ?? ''}`.trim())
      .filter(action => action.length > 0 && action !== 'takeOver');
    if (savedStatus !== 'UR' && savedActions.length > 0) {
      return savedActions;
    }
    const currentActions = current.menuActions ?? [];
    const shareAction = currentActions.includes('shareAsset') ? 'shareAsset' : 'share';
    const editAction = currentActions.includes('editAsset') ? 'editAsset' : 'edit';
    return [shareAction, editAction, 'delete'];
  }

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }

  protected ticketOrderMenuTrigger(): AppMenuTrigger {
    return {
      label: () => this.assetPopupStore.ticketDateOrderLabel(),
      icon: () => this.assetPopupStore.ticketDateOrderIcon(),
      palette: 'blue',
      layout: 'pill',
      ariaLabel: 'Open ticket date ordering'
    };
  }

  protected ticketOrderMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    const selectedOrder = this.assetPopupStore.ticketDateOrder();
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
    const filter = this.ownedAssetsStore.assetFilter();
    const count = this.assetFilterCount(filter);
    return {
      label: AssetDefaultsBuilder.assetTypeLabel(filter),
      icon: AssetDefaultsBuilder.assetTypeIcon(filter),
      palette: this.assetFilterPalette(filter),
      counter: count > 0 ? count : null,
      ariaLabel: 'Open asset filter'
    };
  }

  protected assetFilterMenuItems(): readonly AppMenuItem<string, AssetPopupMenuContext>[] {
    return this.assetFilterOptions.map(option => {
      const count = this.assetFilterCount(option);
      return {
        id: `asset-filter-${option}`,
        label: AssetDefaultsBuilder.assetTypeLabel(option),
        icon: AssetDefaultsBuilder.assetTypeIcon(option),
        kind: 'radio',
        active: option === this.ownedAssetsStore.assetFilter(),
        palette: this.assetFilterPalette(option),
        surface: 'tinted',
        counter: count > 0 ? count : null,
        context: { menu: 'asset-filter', filter: option }
      };
    });
  }

  protected assetFilterCount(type: AppConstants.AssetFilterType): number {
    const ownerUserId = this.appCtx.userProfileStore.activeUserProfile()?.id?.trim()
      || this.appCtx.userProfileStore.activeUserId().trim();
    const source = this.appCtx.userProfileStore.getUserProfile(ownerUserId);
    const activeUser = source ?? this.appCtx.userProfileStore.activeUserProfile();
    const overrides = ownerUserId ? this.appCtx.activityStore.getUserCounterOverrides(ownerUserId) : {};
    const grouped = overrides.asset ?? activeUser?.activities?.asset;
    const key = this.assetFilterCounterKey(type);
    switch (key) {
      case 'cars':
        return this.normalizeAssetFilterCount(grouped?.cars ?? overrides.cars ?? activeUser?.activities?.cars);
      case 'accommodation':
        return this.normalizeAssetFilterCount(grouped?.accommodation ?? overrides.accommodation ?? activeUser?.activities?.accommodation);
      case 'supplies':
        return this.normalizeAssetFilterCount(grouped?.supplies ?? overrides.supplies ?? activeUser?.activities?.supplies);
      case 'tickets':
        return this.normalizeAssetFilterCount(grouped?.tickets ?? overrides.tickets ?? activeUser?.activities?.tickets);
      default:
        return key ? this.normalizeAssetFilterCount(overrides[key] ?? activeUser?.activities?.[key]) : 0;
    }
  }

  private assetFilterCounterKey(
    type: AppConstants.AssetFilterType
  ): Extract<ActivityCounterKey, 'cars' | 'accommodation' | 'supplies' | 'tickets'> | null {
    switch (type) {
      case 'Car':
        return 'cars';
      case 'Accommodation':
        return 'accommodation';
      case 'Supplies':
        return 'supplies';
      case 'Ticket':
        return 'tickets';
      default:
        return null;
    }
  }

  private normalizeAssetFilterCount(value: unknown): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.trunc(numericValue));
  }

  protected supplyRequestFilterMenuTrigger(): AppMenuTrigger {
    return {
      label: () => this.supplyRequestFilterLabel(),
      icon: () => this.supplyRequestFilterIcon(),
      palette: this.supplyRequestFilterPalette(this.supplyRequestFilter),
      counter: () => this.supplyRequestFilterCount(),
      layout: 'pill',
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
      layout: 'icon',
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
        this.selectTicketDateOrder(context.order, event.sourceEvent);
        return;
      case 'asset-filter':
        this.onAssetFilterChange(context.filter);
        return;
      case 'asset-assign-basket':
        if (event.action === 'remove') {
          this.toggleAssetAssignBasketCard(context.assetCard.id, event.sourceEvent);
        }
        return;
      case 'asset-assign-confirm':
        this.confirmBasketSelection(event.sourceEvent);
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
      this.onOwnedAssetCardMenuAction(context.assetCard, {
        id: context.card.id,
        actionId: context.action.id,
        action: context.action,
        card: context.card
      });
    }
  }

  protected onAssetSmartListItemSelect(event: SmartListItemSelectEvent<AppDTOs.AssetDTO, OwnedAssetListFilters>): void {
    if (!event.selectMode || !this.isBasketMode()) {
      return;
    }
    this.toggleAssetAssignBasketCard(event.item.id, event.sourceEvent);
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

  private openOwnedAssetShareDialog(card: AppDTOs.AssetDTO): void {
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

  private toggleAssetAssignBasketCard(cardId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.resourcePopupStore.pendingAssignSaveRef()?.busy === true) {
      return;
    }
    if (this.resourcePopupStore.pendingAssignSaveRef()?.error) {
      this.resourcePopupStore.pendingAssignSaveRef.set(null);
    }
    const selectedIds = this.resourcePopupStore.selectedAssignAssetIdsRef();
    if (selectedIds.includes(cardId)) {
      this.resourcePopupStore.selectedAssignAssetIdsRef.set(selectedIds.filter(id => id !== cardId));
      return;
    }
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([...selectedIds, cardId]);
  }

  protected openSupplyRequestList(card: AppDTOs.AssetDTO, event?: Event): void {
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

  protected selectedSupplyAsset(): AppDTOs.AssetDTO | null {
    const assetId = `${this.selectedSupplyAssetId ?? ''}`.trim();
    if (!assetId) {
      return null;
    }
    return this.ownedAssetsStore.findAsset(assetId);
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
      await this.applyAssetRequestAction(asset.id, request.id, 'accept');
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
      await this.applyAssetRequestAction(asset.id, request.id, 'remove');
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
      await this.promoteAssetRequestToManager(asset.id, request.id);
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

  protected openOwnedAssetMap(card: AppDTOs.AssetDTO): void {
    if (!AssetCardBuilder.canOpenMap(card)) {
      return;
    }
    const query = AssetCardBuilder.primaryLocation(card).trim();
    if (!query) {
      return;
    }
    AppUtils.openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  protected onAssetFilterChange(filter: AppConstants.AssetFilterType): void {
    if (this.isBasketMode()) {
      return;
    }
    this.ownedAssetsStore.selectAssetFilter(filter);
    this.assetSmartListQuery = {
      filters: {
        userId: this.appCtx.userProfileStore.activeUserId().trim(),
        type: filter === 'Ticket' ? 'Car' : filter,
        refreshToken: this.ownedAssetsStore.assetListReloadRevision()
      }
    };
  }

  protected selectTicketDateOrder(order: 'upcoming' | 'past', event?: Event): void {
    event?.stopPropagation();
    this.assetPopupStore.selectTicketDateOrder(
      order,
      this.assetTicketsService.peekTicketCountByUser(this.appCtx.userProfileStore.activeUserId().trim())
    );
  }

  protected openTicketCodePopup(row: AssetContracts.AssetTicketDTO, event?: Event): void {
    event?.stopPropagation();
    this.assetPopupStore.openTicketCode(row, '');
  }

  protected openTicketScannerPopup(event?: Event): void {
    event?.stopPropagation();
    this.assetPopupStore.openTicketScanner();
  }

  protected ticketInfoCard(
    row: AssetContracts.AssetTicketDTO,
    options: { groupLabel?: string | null } = {}
  ) {
    return AssetTicketInfoCardConverter.convert(row, options);
  }

  protected onTicketSmartListStateChange(change: SmartListStateChange<AssetContracts.AssetTicketDTO, AssetTicketListFilters>): void {
    this.assetPopupStore.updateTicketList(change.items, change.total);
  }

  protected onAssetSmartListStateChange(change: SmartListStateChange<AppDTOs.AssetDTO, OwnedAssetListFilters>): void {
    if (this.ownedAssetsStore.ticketPopup()) {
      return;
    }
    const cards = this.orderedOwnedAssetCards(this.currentAssetSmartListType());
    this.applyVisibleOwnedAssetPatch(
      this.ownedAssetsStore.trackVisibleAssetListState(change, cards)
    );
  }

  protected closeAssetPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.showSupplyRequestList) {
      this.closeSupplyRequestList();
      return;
    }
    if (this.isBasketMode()) {
      this.subEventResources.closeAssignPopup(false);
      return;
    }
    this.appMenuDispatcher.close();
    this.ownedAssetsStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.clearAssetsExplanationContext();
    this.assetPopupStore.primaryVisibleRef.set(false);
    this.ownedAssetsStore.touchUiState();
  }

  protected confirmBasketSelection(event?: Event): void {
    if (!this.isBasketMode()) {
      return;
    }
    this.subEventResources.confirmAssignPopup(event);
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.assetPopupStore.ticketScanMode()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.assetPopupStore.closeTicketScan();
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
    if (this.ownedAssetsStore.pendingAssetDeleteCardId()) {
      return;
    }
    if (this.ownedAssetsStore.popupOpen()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeAssetPopup();
    }
  }

  private syncSmartListQueries(): void {
    const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
    const assetType = this.currentAssetSmartListType();
    const basketMode = this.isBasketMode();
    const assetKey = `${activeUserId}:${assetType}:${basketMode ? 'basket' : 'assets'}:${this.ownedAssetsStore.assetListReloadRevision()}`;
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

    const ticketOrder = this.assetPopupStore.ticketDateOrder();
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

  private initializeOwnedAssetsFromUser(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!this.ownedAssetsStore.setActiveOwnerUserId(normalizedUserId)) {
      return;
    }
    this.ownedAssetsStore.resetAssetDeleteDialog();
    if (!normalizedUserId) {
      this.ownedAssetsStore.applyAssetCards([], { reloadList: false });
      return;
    }
    this.ownedAssetsStore.applyAssetCards(this.assetsService.peekOwnedAssetsByUser(normalizedUserId), { reloadList: false });
    void this.refreshOwnedAssetsFromRepository(normalizedUserId);
  }

  private async waitForAssetListLoad(ownerUserId: string): Promise<void> {
    const normalizedOwnerUserId = ownerUserId.trim();
    const refreshPromise = normalizedOwnerUserId
      && normalizedOwnerUserId === this.trackedAssetRefreshOwnerUserId
      ? this.trackedAssetRefreshPromise
      : null;
    if (refreshPromise) {
      await refreshPromise;
    }
  }

  private refreshOwnedAssetsFromRepository(
    ownerUserId: string,
    options: { trackLoading?: boolean } = {}
  ): Promise<void> {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return Promise.resolve();
    }
    const requestMutationVersion = this.ownedAssetsStore.currentAssetMutationVersion();
    const trackLoading = options.trackLoading === true;
    const trackedToken = trackLoading ? ++this.trackedAssetRefreshToken : 0;
    if (trackLoading) {
      this.trackedAssetRefreshOwnerUserId = normalizedOwnerUserId;
      this.ownedAssetsStore.setAssetListLoading(true);
    }
    const refreshPromise = (async () => {
      try {
        const cards = await this.assetsService.queryOwnedAssetsByUser(normalizedOwnerUserId);
        if (
          !this.ownedAssetsStore.isActiveOwnerUser(normalizedOwnerUserId)
          || requestMutationVersion !== this.ownedAssetsStore.currentAssetMutationVersion()
        ) {
          return;
        }
        this.ownedAssetsStore.applyAssetCards(cards, { reloadList: false });
      } catch {
        // Keep the popup usable with the already-peeked cache if the refresh fails.
      } finally {
        if (trackLoading && this.trackedAssetRefreshToken === trackedToken) {
          this.trackedAssetRefreshPromise = null;
          this.trackedAssetRefreshOwnerUserId = '';
          this.ownedAssetsStore.setAssetListLoading(false);
        }
      }
    })();
    if (trackLoading) {
      this.trackedAssetRefreshPromise = refreshPromise;
    }
    return refreshPromise;
  }

  private assetExplanationContextForFilter(filter: AppConstants.AssetFilterType): string {
    switch (filter) {
      case 'Accommodation':
        return 'assets.accommodation';
      case 'Supplies':
        return 'assets.supplies';
      case 'Ticket':
        return 'assets.tickets';
      case 'Car':
      default:
        return 'assets.car';
    }
  }

  private setAssetsExplanationContext(contextKey: string): void {
    if (this.assetsExplanationContextKey === contextKey) {
      return;
    }
    this.clearAssetsExplanationContext();
    this.assetsExplanationContextKey = contextKey;
    this.unregisterAssetsExplanationContext = this.explanationGuide.registerContext(contextKey);
  }

  private clearAssetsExplanationContext(): void {
    this.unregisterAssetsExplanationContext?.();
    this.unregisterAssetsExplanationContext = null;
    this.assetsExplanationContextKey = null;
  }

  private currentAssetSmartListType(): AppConstants.AssetType {
    const assignType = this.resourcePopupStore.assignContextRef()?.type;
    if (assignType) {
      return assignType;
    }
    const currentFilter = this.ownedAssetsStore.assetFilter();
    return currentFilter === 'Accommodation' || currentFilter === 'Supplies' ? currentFilter : 'Car';
  }

  private syncVisibleOwnedAssetListFromStore(): void {
    const active = this.ownedAssetsStore.popupOpen() && !this.ownedAssetsStore.ticketPopup();
    const assetType = this.currentAssetSmartListType();
    const selectedAssetKey = this.isBasketMode()
      ? this.assetAssignBasketCards().map(card => card.id).join('|')
      : '';
    const contextKey = `${this.appCtx.userProfileStore.activeUserId().trim()}:${assetType}:${this.isBasketMode() ? `basket:${selectedAssetKey}` : 'assets'}`;
    this.applyVisibleOwnedAssetPatch(
      this.ownedAssetsStore.syncVisibleAssetList({
        active,
        contextKey,
        cards: this.orderedOwnedAssetCards(assetType),
        renderedCount: this.assetSmartList?.itemsSnapshot().length ?? 0
      })
    );
  }

  private applyVisibleOwnedAssetPatch(patch: OwnedAssetsVisibleListPatch | null): void {
    if (!patch || !this.assetSmartList) {
      return;
    }

    this.assetSmartList.replaceVisibleItems(patch.items.map(card => this.cloneOwnedAsset(card)), {
      total: patch.total
    });
  }

  private orderedOwnedAssetCards(type: AppConstants.AssetType): AppDTOs.AssetDTO[] {
    const selectedAssetIds = this.isBasketMode()
      ? new Set(this.resourcePopupStore.selectedAssignAssetIdsRef().map(id => id.trim()).filter(Boolean))
      : null;
    return this.ownedAssetsStore.orderedCardsByType(type, selectedAssetIds);
  }

  private async loadTicketSmartListPage(
    query: ListQuery<AssetTicketListFilters>
  ): Promise<{ items: AssetContracts.AssetTicketDTO[]; total: number }> {
    const userId = query.filters?.userId?.trim() || this.appCtx.userProfileStore.activeUserId().trim();
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
  ): Promise<{ items: AppDTOs.AssetDTO[]; total: number }> {
    const userId = query.filters?.userId?.trim() || this.appCtx.userProfileStore.activeUserId().trim();
    const type = query.filters?.type;
    if (!userId || (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies')) {
      return {
        items: [],
        total: 0
      };
    }
    await this.waitForAssetListLoad(userId);
    const filtered = this.orderedOwnedAssetCards(type);
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map(card => this.cloneOwnedAsset(card)),
      total: filtered.length
    };
  }

  private cloneOwnedAsset(card: AppDTOs.AssetDTO): AppDTOs.AssetDTO {
    return {
      ...card,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    };
  }
}
