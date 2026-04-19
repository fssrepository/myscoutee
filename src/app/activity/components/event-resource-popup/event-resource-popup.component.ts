import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelect } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { of } from 'rxjs';

import {
  CounterBadgePipe,
  InfoCardComponent,
  SmartListComponent,
  type HeaderProgressBarConfig,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import { resolveCurrentDemoDelayMs, resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';

interface CapacityEditorState {
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
  busy: boolean;
  error: string | null;
}

interface RouteEditorState {
  title: string;
  routes: string[];
  busy: boolean;
  error: string | null;
}

interface PendingResourceDeleteState {
  title: string;
  busy: boolean;
  error: string | null;
}

interface ResourceSmartListFilters {
  revision?: number;
  contextKey?: string;
}

type AssetExploreOrder = 'availability' | 'lowest-price' | 'fewest-policies';

type AssetExploreOrderOption = {
  key: AssetExploreOrder;
  label: string;
  icon: string;
};

const ASSET_EXPLORE_ORDER_OPTIONS: readonly AssetExploreOrderOption[] = [
  { key: 'availability', label: 'Available first', icon: 'inventory_2' },
  { key: 'lowest-price', label: 'Lowest price', icon: 'payments' },
  { key: 'fewest-policies', label: 'Fewest policies', icon: 'policy' }
] as const;

export interface AssetExplorePopupViewState {
  title: string;
  subtitle: string;
  type: AppTypes.AssetType;
  category: AppTypes.AssetCategory;
  categoryDisplay: string;
  categoryOptions: readonly AppTypes.AssetCategory[];
  startDate: Date | null;
  endDate: Date | null;
  windowStartDate: Date | null;
  windowEndDate: Date | null;
  startTime: string;
  endTime: string;
  loading: boolean;
  error: string | null;
  cards: AppTypes.AssetCard[];
}

export interface AssetExploreBorrowDialogViewState {
  title: string;
  subtitle: string;
  timeframe: string;
  quantity: number;
  availableQuantity: number;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  lineItems: AppTypes.EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  policies: AppTypes.EventPolicyItem[];
  acceptedPolicyIds: string[];
  payable: boolean;
  paymentStep: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
}

export interface AssetExploreBorrowDraftViewState {
  cardId: string;
  title: string;
  timeframe: string;
  quantity: number;
  availabilityLabel: string;
}

export interface EventResourcePopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  isMobileView(): boolean;
  isMobilePopupSheetViewport(): boolean;
  resourceFilter(): AppTypes.AssetType;
  resourceFilterOptions(): readonly AppTypes.AssetType[];
  resourceFilterPanelWidth(): string;
  resourceFilterCount(type: AppTypes.AssetType): number;
  resourceTypeClass(type: AppTypes.SubEventResourceFilter): string;
  resourceTypeIcon(type: AppTypes.SubEventResourceFilter): string;
  resourceTypeLabel(type: AppTypes.SubEventResourceFilter): string;
  cards(): AppTypes.SubEventResourceCard[];
  capacityEditor(): CapacityEditorState | null;
  routeEditor(): RouteEditorState | null;
  pendingDeleteCard(): PendingResourceDeleteState | null;
  assetExplorePopup(): AssetExplorePopupViewState | null;
  assetExploreBorrowDialog(): AssetExploreBorrowDialogViewState | null;
  assetExploreBorrowDrafts(): AssetExploreBorrowDraftViewState[];
  close(): void;
  selectResourceFilter(filter: AppTypes.SubEventResourceFilter): void;
  onResourceFilterOpened(isOpen: boolean, select: MatSelect): void;
  openMobileResourceFilterSelector(event?: Event): void;
  openAssignPopup(event?: Event): void;
  openExplorePopup(event?: Event): void;
  closeExplorePopup(event?: Event): void;
  selectAssetExploreCategory(category: AppTypes.AssetCategory, event?: Event): void;
  setAssetExploreDateRange(start: Date | null, end: Date | null): void;
  setAssetExploreTime(edge: 'start' | 'end', value: string): void;
  assetExploreAvailableQuantity(card: AppTypes.AssetCard): number;
  assetExploreAvailabilityLabel(card: AppTypes.AssetCard): string;
  assetExploreCanBorrow(card: AppTypes.AssetCard): boolean;
  openAssetExploreBorrowDialog(card: AppTypes.AssetCard, event?: Event): void;
  closeAssetExploreBorrowDialog(event?: Event): void;
  setAssetExploreBorrowDateRange(start: Date | null, end: Date | null): void;
  setAssetExploreBorrowTime(edge: 'start' | 'end', value: string): void;
  onAssetExploreBorrowQuantityChange(value: number | string): void;
  normalizeAssetExploreBorrowQuantityOnBlur(value: number | string): void;
  toggleAssetExploreBorrowPolicy(policyId: string): void;
  backAssetExploreBorrowToDetails(event?: Event): void;
  canSubmitAssetExploreBorrow(): boolean;
  confirmAssetExploreBorrow(event?: Event): void;
  resumeAssetExploreBorrowDraft(cardId: string, event?: Event): void;
  clearAssetExploreBorrowDraft(cardId: string, event?: Event): void;
  assetExploreBorrowRingPerimeter(): number;
  trackByCard(index: number, card: AppTypes.SubEventResourceCard): string;
  canOpenMap(card: AppTypes.SubEventResourceCard): boolean;
  openMap(card: AppTypes.SubEventResourceCard, event?: Event): void;
  canOpenBadgeDetails(card: AppTypes.SubEventResourceCard): boolean;
  openBadgeDetails(card: AppTypes.SubEventResourceCard, event?: Event): void;
  occupancyLabel(card: AppTypes.SubEventResourceCard): string;
  canOpenAssetMembers(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpen(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpenUp(card: AppTypes.SubEventResourceCard): boolean;
  toggleItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void;
  canJoin(card: AppTypes.SubEventResourceCard): boolean;
  join(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditCapacity(card: AppTypes.SubEventResourceCard): boolean;
  openCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditRoute(card: AppTypes.SubEventResourceCard): boolean;
  routeMenuLabel(card: AppTypes.SubEventResourceCard): string;
  openRouteEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  delete(card: AppTypes.SubEventResourceCard, event: Event): void;
  closeCapacityEditor(event?: Event): void;
  canSubmitCapacityEditor(): boolean;
  onCapacityMinChange(value: number | string): void;
  onCapacityMaxChange(value: number | string): void;
  saveCapacityEditor(event?: Event): void;
  closeRouteEditor(event?: Event): void;
  routeEditorSupportsMultiRoute(): boolean;
  openRouteMap(event?: Event): void;
  addRouteStop(): void;
  dropRouteStop(event: unknown): void;
  updateRouteStop(index: number, value: string): void;
  openRouteStopMap(index: number, event?: Event): void;
  removeRouteStop(index: number): void;
  canSubmitRouteEditor(): boolean;
  saveRouteEditor(event?: Event): void;
  editorSaveRingPerimeter(): number;
  isCapacitySavePending(): boolean;
  capacitySaveErrorMessage(): string;
  isRouteSavePending(): boolean;
  routeSaveErrorMessage(): string;
  cancelDeleteCard(): void;
  deleteCardLabel(): string;
  deleteCardConfirmRingPerimeter(): number;
  isDeleteCardPending(): boolean;
  deleteCardErrorMessage(): string;
  confirmDeleteCard(): void;
}

@Component({
  selector: 'app-event-resource-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTimepickerModule,
    SmartListComponent,
    InfoCardComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent implements DoCheck {
  private lastCardsSignature = '';
  private lastContextKey = '';
  private lastCardCount = 0;
  private resourceListReady = false;
  private resourceListVisibleCount = 0;
  private lastAssetExploreCardsSignature = '';
  private lastAssetExploreContextKey = '';
  private lastAssetExploreCardCount = 0;
  private assetExploreListReady = false;
  private assetExploreListVisibleCount = 0;
  private assetExploreHeaderProgress = 0;
  private assetExploreHeaderProgressLoading = false;
  private assetExploreHeaderLoadingProgress = 0;
  private assetExploreHeaderLoadingOverdue = false;
  private assetExploreStickyLabel = 'No items';

  @Input({ required: true }) host!: EventResourcePopupHost;

  protected resourceFilterOpen = false;
  protected showMobileResourceFilterPicker = false;
  protected showQuickActionsMenu = false;
  protected showAssetExploreCategoryPicker = false;
  protected showAssetExploreOrderPicker = false;
  protected showAssetExploreBorrowBasket = false;
  protected assetExploreOrder: AssetExploreOrder = 'availability';
  protected readonly assetExploreOrderOptions = ASSET_EXPLORE_ORDER_OPTIONS;

  protected resourceSmartListQuery: Partial<ListQuery<ResourceSmartListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  protected assetExploreSmartListQuery: Partial<ListQuery<ResourceSmartListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  @ViewChild('resourceSmartList')
  private resourceSmartList?: SmartListComponent<AppTypes.SubEventResourceCard, ResourceSmartListFilters>;

  @ViewChild('assetExploreSmartList')
  private assetExploreSmartList?: SmartListComponent<AppTypes.AssetCard, ResourceSmartListFilters>;

  protected resourceItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, ResourceSmartListFilters>>;

  @ViewChild('resourceItemTemplate', { read: TemplateRef })
  private set resourceItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, ResourceSmartListFilters>> | undefined
  ) {
    this.resourceItemTemplateRef = value;
  }

  protected assetExploreItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.AssetCard, ResourceSmartListFilters>>;

  @ViewChild('assetExploreItemTemplate', { read: TemplateRef })
  private set assetExploreItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.AssetCard, ResourceSmartListFilters>> | undefined
  ) {
    this.assetExploreItemTemplateRef = value;
  }

  protected readonly resourceSmartListLoadPage: SmartListLoadPage<AppTypes.SubEventResourceCard, ResourceSmartListFilters> = (
    query
  ) => {
    const cards = this.host?.cards?.() ?? [];
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return of({
      items: cards.slice(start, start + pageSize),
      total: cards.length
    });
  };

  protected readonly resourceSmartListConfig: SmartListConfig<AppTypes.SubEventResourceCard, ResourceSmartListFilters> = {
    pageSize: 18,
    loadingDelayMs: resolveCurrentDemoDelayMs(1500),
    loadingWindowMs: 3000,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'No assigned resources yet.',
    emptyDescription: 'Assign current-user assets to see them here.',
    showStickyHeader: false,
    showGroupMarker: () => false,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'subevent-resource-card-list': true
    },
    trackBy: (_index, card) => card.id
  };

  protected readonly assetExploreSmartListLoadPage: SmartListLoadPage<AppTypes.AssetCard, ResourceSmartListFilters> = (
    query
  ) => {
    const cards = this.assetExploreCardsForView();
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const basePageSize = Math.max(1, Math.trunc(Number(this.assetExploreSmartListConfig.pageSize) || pageSize));
    const initialPageSize = Math.max(
      basePageSize,
      Math.trunc(Number(this.assetExploreSmartListConfig.initialPageSize ?? basePageSize))
    );
    const start = page === 0 ? 0 : initialPageSize + ((page - 1) * basePageSize);
    const size = page === 0 ? Math.max(pageSize, initialPageSize) : pageSize;
    return of({
      items: cards.slice(start, start + size),
      total: cards.length
    });
  };

  protected readonly assetExploreSmartListConfig: SmartListConfig<AppTypes.AssetCard, ResourceSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/events', resolveCurrentDemoDelayMs(1500)),
    defaultView: 'list',
    presentation: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'No visible assets right now.',
    emptyDescription: 'Try another date range or category.',
    showStickyHeader: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: card => this.assetExploreGroupLabel(card),
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    stickyHeaderClass: 'asset-explore-sticky-header',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'asset-explore-card-list': true
    },
    trackBy: (_index, card) => card.id
  };

  ngDoCheck(): void {
    const cards = this.host?.cards?.() ?? [];
    const contextKey = `${this.host?.title?.() ?? ''}:${this.host?.subtitle?.() ?? ''}:${this.host?.resourceFilter?.() ?? ''}`;
    const signature = `${contextKey}:${cards.map(card => [
      card.id,
      card.accepted,
      card.pending,
      card.capacityTotal,
      ...(card.routes ?? [])
    ].join(':')).join('|')}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      this.lastCardsSignature = signature;
      this.lastCardCount = cards.length;
      this.resourceListReady = false;
      this.resourceListVisibleCount = 0;
      this.resourceSmartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey
        }
      };
    } else if (signature !== this.lastCardsSignature) {
      const previousCardCount = this.lastCardCount;
      this.lastCardsSignature = signature;
      this.lastCardCount = cards.length;
      this.syncVisibleResourceCards(cards, previousCardCount);
    }

    const explore = this.host?.assetExplorePopup?.() ?? null;
    if (!explore) {
      this.showAssetExploreCategoryPicker = false;
      this.showAssetExploreOrderPicker = false;
      this.showAssetExploreBorrowBasket = false;
    }
    const assetExploreCards = explore?.cards ?? [];
    const assetExploreContextKey = explore
      ? [
          explore.title,
          explore.subtitle,
          explore.type,
          explore.category,
          this.assetExploreOrder,
          explore.startDate?.getTime() ?? 'start',
          explore.endDate?.getTime() ?? 'end',
          explore.startTime,
          explore.endTime
        ].join(':')
      : '';
    const assetExploreSignature = `${assetExploreContextKey}:${assetExploreCards.map(card => [
      card.id,
      card.quantity ?? '',
      card.capacityTotal,
      card.requests.length,
      this.host?.assetExploreAvailabilityLabel?.(card) ?? ''
    ].join(':')).join('|')}`;

    if (assetExploreContextKey !== this.lastAssetExploreContextKey) {
      this.lastAssetExploreContextKey = assetExploreContextKey;
      this.lastAssetExploreCardsSignature = assetExploreSignature;
      this.lastAssetExploreCardCount = assetExploreCards.length;
      this.assetExploreListReady = false;
      this.assetExploreListVisibleCount = 0;
      this.resetAssetExploreHeaderState(Boolean(explore?.loading));
      this.assetExploreSmartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey: assetExploreContextKey
        }
      };
      return;
    }

    if (assetExploreSignature === this.lastAssetExploreCardsSignature) {
      return;
    }

    const previousAssetExploreCardCount = this.lastAssetExploreCardCount;
    this.lastAssetExploreCardsSignature = assetExploreSignature;
    this.lastAssetExploreCardCount = assetExploreCards.length;
    this.syncVisibleAssetExploreCards(assetExploreCards, previousAssetExploreCardCount);
  }

  protected onResourceSmartListStateChange(
    change: SmartListStateChange<AppTypes.SubEventResourceCard, ResourceSmartListFilters>
  ): void {
    this.resourceListVisibleCount = change.items.length;
    this.resourceListReady = !change.initialLoading;
    if (!this.resourceListReady) {
      return;
    }
    const cards = this.host?.cards?.() ?? [];
    if (change.total !== cards.length) {
      this.syncVisibleResourceCards(cards, change.total);
    }
  }

  protected onAssetExploreSmartListStateChange(
    change: SmartListStateChange<AppTypes.AssetCard, ResourceSmartListFilters>
  ): void {
    this.assetExploreHeaderProgress = change.progress;
    this.assetExploreHeaderProgressLoading = change.loading;
    this.assetExploreHeaderLoadingProgress = change.loadingProgress;
    this.assetExploreHeaderLoadingOverdue = change.loadingOverdue;
    this.assetExploreStickyLabel = change.stickyLabel || 'No items';
    this.assetExploreListVisibleCount = change.items.length;
    this.assetExploreListReady = !change.initialLoading;
    if (!this.assetExploreListReady) {
      return;
    }
    const cards = this.assetExploreCardsForView();
    if (change.total !== cards.length) {
      this.syncVisibleAssetExploreCards(cards, change.total);
    }
  }

  protected resourceInfoCard(
    card: AppTypes.SubEventResourceCard,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      rowId: card.id,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [`${card.type} · ${card.subtitle} · ${card.city}`],
      description: card.details,
      leadingIcon: {
        icon: this.host.resourceTypeIcon(card.type)
      },
      mediaStart: this.resourceMediaStart(card),
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.host.occupancyLabel(card),
        interactive: this.host.canOpenBadgeDetails(card),
        pendingCount: card.pending,
        ariaLabel: this.host.canOpenAssetMembers(card)
          ? 'Open member requests'
          : 'Open resource details'
      },
      menuActions: this.resourceMenuActions(card),
      clickable: false
    };
  }

  protected openResourceCardMap(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenMap(card)) {
      return;
    }
    this.host.openMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenBadgeDetails(card)) {
      return;
    }
    this.host.openBadgeDetails(card);
  }

  protected onResourceFilterOpenedChange(isOpen: boolean, select: MatSelect): void {
    this.resourceFilterOpen = isOpen;
    this.host.onResourceFilterOpened(isOpen, select);
  }

  protected openMobileResourceFilterSelector(event: Event): void {
    if (!this.isMobileResourceFilterSheetViewport()) {
      return;
    }
    event.stopPropagation();
    this.resourceFilterOpen = false;
    this.showMobileResourceFilterPicker = !this.showMobileResourceFilterPicker;
  }

  protected toggleQuickActionsMenu(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = !this.showQuickActionsMenu;
  }

  protected toggleAssetExploreCategoryPicker(event: Event): void {
    if (!this.isMobileResourceFilterSheetViewport()) {
      return;
    }
    event.stopPropagation();
    this.showAssetExploreOrderPicker = false;
    this.showAssetExploreBorrowBasket = false;
    this.showAssetExploreCategoryPicker = !this.showAssetExploreCategoryPicker;
  }

  protected openAssignQuickAction(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = false;
    this.host.openAssignPopup(event);
  }

  protected openExploreQuickAction(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = false;
    this.host.openExplorePopup(event);
  }

  protected selectMobileResourceFilter(filter: AppTypes.AssetType, event?: Event): void {
    event?.stopPropagation();
    this.showMobileResourceFilterPicker = false;
    this.host.selectResourceFilter(filter);
  }

  protected selectMobileAssetExploreCategory(category: AppTypes.AssetCategory, event?: Event): void {
    event?.stopPropagation();
    this.showAssetExploreCategoryPicker = false;
    this.host.selectAssetExploreCategory(category);
  }

  protected assetExploreInfoCard(
    card: AppTypes.AssetCard,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    const visibility = card.visibility === 'Friends only'
      ? 'Friends only'
      : card.visibility === 'Invitation only'
        ? 'Invitation only'
        : 'Public';
    const canBorrow = this.host.assetExploreCanBorrow(card);
    const priceLabel = this.assetExplorePriceLabel(card);
    const policyLabel = this.assetExplorePolicyLabel(card);
    return {
      rowId: `asset-explore:${card.id}`,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [[
        this.host.resourceTypeLabel(card.type),
        card.category ?? '',
        card.city
      ].filter(Boolean).join(' · ')],
      description: card.details,
      detailRows: [[
        card.ownerName?.trim() || 'Unknown owner',
        visibility
      ].filter(Boolean).join(' · ')],
      footerChips: [
        { label: priceLabel },
        { label: policyLabel }
      ],
      leadingIcon: {
        icon: visibility === 'Friends only'
          ? 'groups'
          : visibility === 'Invitation only'
            ? 'mail_lock'
            : 'public',
        tone: visibility === 'Friends only'
          ? 'friends'
          : visibility === 'Invitation only'
            ? 'invitation'
            : 'public'
      },
      mediaStart: {
        variant: 'avatar',
        tone: `tone-${(AppUtils.hashText(`${card.ownerUserId ?? card.id}:${card.ownerName ?? card.title}`) % 8) + 1}` as NonNullable<InfoCardData['mediaStart']>['tone'],
        label: AppUtils.initialsFromText(card.ownerName?.trim() || card.title),
        interactive: false,
        ariaLabel: null
      },
      mediaEnd: {
        variant: 'badge',
        tone: canBorrow ? 'default' : 'inactive',
        label: this.host.assetExploreAvailabilityLabel(card),
        interactive: canBorrow,
        disabled: !canBorrow,
        ariaLabel: canBorrow ? 'Borrow asset' : 'Asset unavailable for this time'
      },
      menuActions: canBorrow ? [{
        id: 'borrow',
        label: 'Borrow',
        icon: 'volunteer_activism',
        tone: 'accent'
      }] : [],
      clickable: false
    };
  }

  protected openAssetExploreBorrowFromBadge(card: AppTypes.AssetCard): void {
    if (!this.host.assetExploreCanBorrow(card)) {
      return;
    }
    this.showAssetExploreBorrowBasket = false;
    this.host.openAssetExploreBorrowDialog(card);
  }

  protected onAssetExploreInfoCardMenuAction(card: AppTypes.AssetCard, event: InfoCardMenuActionEvent): void {
    if (event.actionId !== 'borrow') {
      return;
    }
    this.showAssetExploreBorrowBasket = false;
    this.host.openAssetExploreBorrowDialog(card, new Event('click'));
  }

  protected onAssetExploreDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.host.setAssetExploreDateRange(start, end);
  }

  protected onAssetExploreBorrowDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.host.setAssetExploreBorrowDateRange(start, end);
  }

  protected assetExploreBorrowFormatMoney(amount: number, currency = 'USD'): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return `EUR ${(Number(amount) || 0).toFixed(2)}`;
      case 'GBP':
        return `GBP ${(Number(amount) || 0).toFixed(2)}`;
      default:
        return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  protected assetExploreBorrowDrafts(): AssetExploreBorrowDraftViewState[] {
    return this.host.assetExploreBorrowDrafts();
  }

  protected assetExploreBorrowDraftCount(): number {
    return this.assetExploreBorrowDrafts().length;
  }

  protected toggleAssetExploreBorrowBasket(event?: Event): void {
    event?.stopPropagation();
    this.showAssetExploreCategoryPicker = false;
    this.showAssetExploreOrderPicker = false;
    if (this.assetExploreBorrowDraftCount() <= 0) {
      this.showAssetExploreBorrowBasket = false;
      return;
    }
    this.showAssetExploreBorrowBasket = !this.showAssetExploreBorrowBasket;
  }

  protected continueAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    this.showAssetExploreBorrowBasket = false;
    this.host.resumeAssetExploreBorrowDraft(cardId, event);
  }

  protected clearAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    this.host.clearAssetExploreBorrowDraft(cardId, event);
  }

  protected assetExploreHeaderProgressBarConfig(): HeaderProgressBarConfig {
    return {
      position: this.assetExploreHeaderProgressLoading
        ? this.assetExploreHeaderLoadingProgress
        : this.assetExploreHeaderProgress,
      state: this.assetExploreHeaderProgressLoading
        ? (this.assetExploreHeaderLoadingOverdue ? 'loading-overdue' : 'loading')
        : 'scrolling',
      placement: 'edge'
    };
  }

  protected assetExploreHeaderStickyLabel(): string {
    return this.assetExploreStickyLabel || 'No items';
  }

  protected assetExploreCategoryClass(option: AppTypes.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryClass(option);
  }

  protected assetExploreCategoryIcon(option: AppTypes.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryIcon(option);
  }

  protected assetExploreCategoryLabel(option: AppTypes.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryLabel(option);
  }

  protected readonly assetExploreDateFilter = (date: Date | null): boolean => {
    const explore = this.host?.assetExplorePopup?.();
    if (!date || !explore?.windowStartDate || !explore.windowEndDate) {
      return false;
    }
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const min = new Date(
      explore.windowStartDate.getFullYear(),
      explore.windowStartDate.getMonth(),
      explore.windowStartDate.getDate()
    ).getTime();
    const max = new Date(
      explore.windowEndDate.getFullYear(),
      explore.windowEndDate.getMonth(),
      explore.windowEndDate.getDate()
    ).getTime();
    return candidate >= min && candidate <= max;
  };

  protected onResourceCardMenuAction(card: AppTypes.SubEventResourceCard, event: InfoCardMenuActionEvent): void {
    if (event.actionId === 'join') {
      this.host.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'capacity') {
      this.host.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.host.openRouteEditor(card, new Event('click'));
      return;
    }
    this.host.delete(card, new Event('click'));
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.host.assetExploreBorrowDialog()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      if (this.host.assetExploreBorrowDialog()?.paymentStep) {
        this.host.backAssetExploreBorrowToDetails();
        return;
      }
      this.host.closeAssetExploreBorrowDialog();
      return;
    }
    if (this.showAssetExploreBorrowBasket) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showAssetExploreBorrowBasket = false;
      return;
    }
    if (this.showAssetExploreCategoryPicker) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showAssetExploreCategoryPicker = false;
      return;
    }
    if (this.showAssetExploreOrderPicker) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showAssetExploreOrderPicker = false;
      return;
    }
    if (this.host.assetExplorePopup()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeExplorePopup();
      return;
    }
    if (this.showQuickActionsMenu) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showQuickActionsMenu = false;
      return;
    }
    if (!this.showMobileResourceFilterPicker) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.showMobileResourceFilterPicker = false;
  }

  protected toggleAssetExploreOrderPicker(event: Event): void {
    event.stopPropagation();
    this.showAssetExploreCategoryPicker = false;
    this.showAssetExploreBorrowBasket = false;
    this.showAssetExploreOrderPicker = !this.showAssetExploreOrderPicker;
  }

  protected selectAssetExploreOrder(order: AssetExploreOrder, event: Event): void {
    event.stopPropagation();
    this.assetExploreOrder = order;
    this.showAssetExploreOrderPicker = false;
  }

  protected assetExploreOrderLabel(order: AssetExploreOrder = this.assetExploreOrder): string {
    return this.assetExploreOrderOptions.find(option => option.key === order)?.label ?? 'Available first';
  }

  protected assetExploreOrderIcon(order: AssetExploreOrder = this.assetExploreOrder): string {
    return this.assetExploreOrderOptions.find(option => option.key === order)?.icon ?? 'inventory_2';
  }

  protected assetExploreOrderClass(order: AssetExploreOrder = this.assetExploreOrder): string {
    if (order === 'lowest-price') {
      return 'asset-explore-order-lowest-price';
    }
    if (order === 'fewest-policies') {
      return 'asset-explore-order-fewest-policies';
    }
    return 'asset-explore-order-availability';
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this.showAssetExploreOrderPicker && !target.closest('.asset-explore-order-picker')) {
      this.showAssetExploreOrderPicker = false;
    }
    if (this.showAssetExploreBorrowBasket && !target.closest('.asset-explore-basket')) {
      this.showAssetExploreBorrowBasket = false;
    }
    if (!target.closest('.popup-mobile-filter-picker')) {
      this.showMobileResourceFilterPicker = false;
      this.showAssetExploreCategoryPicker = false;
    }
    if (!target.closest('.subevent-assets-quick-actions')) {
      this.showQuickActionsMenu = false;
    }
  }

  private syncVisibleResourceCards(
    cards: AppTypes.SubEventResourceCard[],
    previousCardCount: number
  ): void {
    if (!this.resourceListReady || !this.resourceSmartList) {
      return;
    }

    const visibleCount = Math.max(this.resourceListVisibleCount, this.resourceSmartList.itemsSnapshot().length);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + (cards.length - previousCardCount));
    }

    this.resourceSmartList.replaceVisibleItems(cards.slice(0, nextVisibleCount), {
      total: cards.length
    });
  }

  private syncVisibleAssetExploreCards(
    cards: AppTypes.AssetCard[],
    previousCardCount: number
  ): void {
    if (!this.assetExploreListReady || !this.assetExploreSmartList) {
      return;
    }

    const visibleCount = Math.max(this.assetExploreListVisibleCount, this.assetExploreSmartList.itemsSnapshot().length);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + (cards.length - previousCardCount));
    }

    const orderedCards = this.assetExploreCardsForView(cards);
    this.assetExploreSmartList.replaceVisibleItems(orderedCards.slice(0, nextVisibleCount), {
      total: orderedCards.length
    });
  }

  private resetAssetExploreHeaderState(loading = false): void {
    this.assetExploreHeaderProgress = 0;
    this.assetExploreHeaderProgressLoading = loading;
    this.assetExploreHeaderLoadingProgress = loading ? 0.02 : 0;
    this.assetExploreHeaderLoadingOverdue = false;
    this.assetExploreStickyLabel = 'No items';
  }

  private assetExploreCardsForView(source: readonly AppTypes.AssetCard[] = this.host?.assetExplorePopup?.()?.cards ?? []): AppTypes.AssetCard[] {
    const availability = (card: AppTypes.AssetCard) => this.host.assetExploreAvailableQuantity(card);
    const cards = [...source].filter(card => availability(card) > 0);
    const price = (card: AppTypes.AssetCard) => this.assetExplorePriceAmount(card);
    const policyCount = (card: AppTypes.AssetCard) => (card.policies ?? []).length;

    cards.sort((left, right) => {
      if (this.assetExploreOrder === 'lowest-price') {
        const priceDelta = price(left) - price(right);
        if (priceDelta !== 0) {
          return priceDelta;
        }
        const availabilityDelta = availability(right) - availability(left);
        if (availabilityDelta !== 0) {
          return availabilityDelta;
        }
      } else if (this.assetExploreOrder === 'fewest-policies') {
        const policyDelta = policyCount(left) - policyCount(right);
        if (policyDelta !== 0) {
          return policyDelta;
        }
        const availabilityDelta = availability(right) - availability(left);
        if (availabilityDelta !== 0) {
          return availabilityDelta;
        }
      } else {
        const availabilityDelta = availability(right) - availability(left);
        if (availabilityDelta !== 0) {
          return availabilityDelta;
        }
        const priceDelta = price(left) - price(right);
        if (priceDelta !== 0) {
          return priceDelta;
        }
      }
      return left.title.localeCompare(right.title)
        || (left.ownerName ?? '').localeCompare(right.ownerName ?? '')
        || left.id.localeCompare(right.id);
    });

    return cards;
  }

  private assetExploreGroupLabel(card: AppTypes.AssetCard): string {
    if (this.assetExploreOrder === 'lowest-price') {
      const amount = this.assetExplorePriceAmount(card);
      if (amount <= 0) {
        return 'Free borrow';
      }
      if (amount < 20) {
        return 'Under $20';
      }
      if (amount < 40) {
        return '$20 - $39';
      }
      return '$40 and up';
    }
    if (this.assetExploreOrder === 'fewest-policies') {
      const count = (card.policies ?? []).length;
      if (count <= 0) {
        return 'No policies';
      }
      if (count === 1) {
        return '1 policy';
      }
      return '2+ policies';
    }
    const available = this.host.assetExploreAvailableQuantity(card);
    if (available <= 0) {
      return 'Booked out';
    }
    if (available === 1) {
      return '1 left';
    }
    if (available <= 3) {
      return '2-3 left';
    }
    return '4+ left';
  }

  private assetExplorePriceAmount(card: AppTypes.AssetCard): number {
    if (!card.pricing?.enabled) {
      return 0;
    }
    return Math.max(0, Number(card.pricing.basePrice) || 0);
  }

  private assetExplorePriceLabel(card: AppTypes.AssetCard): string {
    const amount = this.assetExplorePriceAmount(card);
    const currency = card.pricing?.currency || 'USD';
    if (amount <= 0) {
      return 'Free borrow';
    }
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  private assetExplorePolicyLabel(card: AppTypes.AssetCard): string {
    const count = (card.policies ?? []).length;
    if (count <= 0) {
      return 'No policy';
    }
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected isMobileResourceFilterSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  private resourceMediaStart(card: AppTypes.SubEventResourceCard): NonNullable<InfoCardData['mediaStart']> | null {
    if (!this.host.canOpenMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: card.type === 'Car' ? 'Open route map' : 'Open accommodation map'
    };
  }

  private resourceMenuActions(card: AppTypes.SubEventResourceCard): readonly InfoCardMenuAction[] {
    const actions: InfoCardMenuAction[] = [];
    if (this.host.canJoin(card)) {
      actions.push({
        id: 'join',
        label: 'Join',
        icon: 'login',
        tone: 'accent'
      });
    }
    if (this.host.canEditCapacity(card)) {
      actions.push({
        id: 'capacity',
        label: 'Edit Capacity',
        icon: 'edit'
      });
    }
    if (this.host.canEditRoute(card)) {
      actions.push({
        id: 'route',
        label: this.host.routeMenuLabel(card),
        icon: 'route'
      });
    }
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      tone: 'destructive'
    });
    return actions;
  }
}
