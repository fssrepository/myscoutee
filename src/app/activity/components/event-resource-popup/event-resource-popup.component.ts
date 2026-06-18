import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, Input, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { of } from 'rxjs';

import {
  AppMenuComponent,
  AppMenuDispatcher,
  AppMenuOutletComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  CounterBadgePipe,
  CARD_MENU_ACTIONS,
  InfoCardComponent,
  ProgressIndicatorComponent,
  SmartListComponent,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type CardResolvedMenuAction,
  type ListQuery,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import { AppUtils } from '../../../shared/app-utils';
import { AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import { ShareTokensService } from '../../../shared/core';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';

import type * as AppDTOs from '../../../shared/core/base/dto';
import type * as AppConstants from '../../../shared/core/common/constants';
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
  mode: 'view' | 'edit';
  routes: string[];
  routeRowIds: string[];
  busy: boolean;
  error: string | null;
}

interface PendingResourceDeleteState {
  title: string;
  busy: boolean;
  error: string | null;
}

export interface ResourceAssetViewState {
  card: AppDTOs.SubEventResourceCardDTO;
  mode: 'view' | 'edit';
  source: AppDTOs.AssetCardDTO | null;
  memberLabel: string;
  memberCount: number;
  pendingCount: number;
  canOpenMembers: boolean;
  canEditCapacity: boolean;
  canEditRoute: boolean;
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

type EventResourceMenuContext =
  | { menu: 'resource-filter'; filter: AppConstants.AssetType }
  | { menu: 'quick-action'; action: 'assign' | 'explore' }
  | { menu: 'asset-explore-order'; order: AssetExploreOrder }
  | { menu: 'asset-explore-category'; category: AppConstants.AssetCategory }
  | {
      menu: 'resource-card';
      card: AppDTOs.SubEventResourceCardDTO;
      infoCard: InfoCardData;
      action: CardResolvedMenuAction;
    }
  | {
      menu: 'asset-explore-card';
      card: AppDTOs.AssetCardDTO;
      infoCard: InfoCardData;
      action: CardResolvedMenuAction;
    };

const ASSET_EXPLORE_ORDER_OPTIONS: readonly AssetExploreOrderOption[] = [
  { key: 'availability', label: 'Available first', icon: 'inventory_2' },
  { key: 'lowest-price', label: 'Lowest price', icon: 'payments' },
  { key: 'fewest-policies', label: 'Fewest policies', icon: 'policy' }
] as const;

export interface AssetExplorePopupViewState {
  title: string;
  subtitle: string;
  type: AppConstants.AssetType;
  category: AppConstants.AssetCategory;
  categoryDisplay: string;
  categoryOptions: readonly AppConstants.AssetCategory[];
  startDate: Date | null;
  endDate: Date | null;
  windowStartDate: Date | null;
  windowEndDate: Date | null;
  startTime: string;
  endTime: string;
  loading: boolean;
  error: string | null;
  cards: AppDTOs.AssetCardDTO[];
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
  lineItems: ActivityContracts.EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  bookingStartAtIso: string;
  cancellationPolicy: ContractTypes.PricingCancellationPolicy | null;
  policies: ContractTypes.EventPolicyItem[];
  acceptedPolicyIds: string[];
  payable: boolean;
  paymentStep: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
}

export interface AssignedAssetJoinDialogViewState {
  title: string;
  subtitle: string;
  timeframe: string;
  pathLabel: string;
  memberSummary: string;
  lineItems: ActivityContracts.EventCheckoutLineItem[];
  totalAmount: number;
  shareAmount: number;
  shareMemberCount: number;
  currency: string;
  shareLabel: string;
  shareHint: string;
  policies: ContractTypes.EventPolicyItem[];
  acceptedPolicyIds: string[];
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
  resourceFilter(): AppConstants.AssetType;
  resourceFilterOptions(): readonly AppConstants.AssetType[];
  resourceFilterCount(type: AppConstants.AssetType): number;
  resourceTypeClass(type: AppConstants.SubEventResourceFilter): string;
  resourceTypeIcon(type: AppConstants.SubEventResourceFilter): string;
  resourceTypeLabel(type: AppConstants.SubEventResourceFilter): string;
  cards(): AppDTOs.SubEventResourceCardDTO[];
  resourceAssetView(): ResourceAssetViewState | null;
  standaloneResourceAssetView(): boolean;
  assetExploreOnly(): boolean;
  capacityEditor(): CapacityEditorState | null;
  routeEditor(): RouteEditorState | null;
  pendingDeleteCard(): PendingResourceDeleteState | null;
  assetExplorePopup(): AssetExplorePopupViewState | null;
  assetExploreBorrowDialog(): AssetExploreBorrowDialogViewState | null;
  joinDialog(): AssignedAssetJoinDialogViewState | null;
  assetExploreBorrowDrafts(): AssetExploreBorrowDraftViewState[];
  close(): void;
  selectResourceFilter(filter: AppConstants.SubEventResourceFilter): void;
  openAssignPopup(event?: Event): void;
  openExplorePopup(event?: Event): void;
  closeExplorePopup(event?: Event): void;
  selectAssetExploreCategory(category: AppConstants.AssetCategory, event?: Event): void;
  setAssetExploreDateRange(start: Date | null, end: Date | null): void;
  setAssetExploreTime(edge: 'start' | 'end', value: string): void;
  assetExploreAvailableQuantity(card: AppDTOs.AssetCardDTO): number;
  assetExploreAvailabilityLabel(card: AppDTOs.AssetCardDTO): string;
  assetExploreCanBorrow(card: AppDTOs.AssetCardDTO): boolean;
  assetExploreInfoCard(card: AppDTOs.AssetCardDTO, options?: { groupLabel?: string | null }): InfoCardData;
  openAssetExploreAssetView(card: AppDTOs.AssetCardDTO, event?: Event): void;
  openAssetExploreBorrowDialog(card: AppDTOs.AssetCardDTO, event?: Event): void;
  openAssetExploreServiceChat(card: AppDTOs.AssetCardDTO, event?: Event): void;
  canReportAssetExploreOwner(card: AppDTOs.AssetCardDTO): boolean;
  reportAssetExploreOwner(card: AppDTOs.AssetCardDTO, event?: Event): void;
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
  trackByCard(index: number, card: AppDTOs.SubEventResourceCardDTO): string;
  canOpenMap(card: AppDTOs.SubEventResourceCardDTO): boolean;
  openMap(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void;
  canOpenBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): boolean;
  openBadgeDetails(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void;
  occupancyLabel(card: AppDTOs.SubEventResourceCardDTO): string;
  resourceInfoCard(card: AppDTOs.SubEventResourceCardDTO, options?: { groupLabel?: string | null }): InfoCardData;
  canOpenAssetMembers(card: AppDTOs.SubEventResourceCardDTO): boolean;
  openAssetMembers(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void;
  openResourceAssetView(card: AppDTOs.SubEventResourceCardDTO, mode: 'view' | 'edit', event?: Event): void;
  closeResourceAssetView(event?: Event): void;
  openAssetViewRouteEditor(view: ResourceAssetViewState, event: Event, mode?: 'view' | 'edit'): void;
  canJoin(card: AppDTOs.SubEventResourceCardDTO): boolean;
  join(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  canLeave(card: AppDTOs.SubEventResourceCardDTO): boolean;
  leave(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  closeJoinDialog(event?: Event): void;
  toggleJoinPolicy(policyId: string): void;
  canSubmitJoin(): boolean;
  confirmJoin(event?: Event): void;
  canEditCapacity(card: AppDTOs.SubEventResourceCardDTO): boolean;
  openCapacityEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  canEditRoute(card: AppDTOs.SubEventResourceCardDTO): boolean;
  routeMenuLabel(card: AppDTOs.SubEventResourceCardDTO): string;
  openRouteEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event, mode?: 'view' | 'edit'): void;
  openResourceServiceChat(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  canReportResourceManager(card: AppDTOs.SubEventResourceCardDTO): boolean;
  reportResourceManager(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  delete(card: AppDTOs.SubEventResourceCardDTO, event: Event): void;
  closeCapacityEditor(event?: Event): void;
  canSubmitCapacityEditor(): boolean;
  onCapacityMinChange(value: number | string): void;
  onCapacityMaxChange(value: number | string): void;
  saveCapacityEditor(event?: Event): void;
  closeRouteEditor(event?: Event): void;
  routeEditorSupportsMultiRoute(): boolean;
  routeEditorReadOnly(): boolean;
  openRouteMap(event?: Event): void;
  addRouteStop(): void;
  dropRouteStop(event: unknown): void;
  updateRouteStop(index: number, value: string): void;
  openRouteStopMap(index: number, event?: Event): void;
  removeRouteStop(index: number): void;
  canSubmitRouteEditor(): boolean;
  saveRouteEditor(event?: Event): void;
  isCapacitySavePending(): boolean;
  capacitySaveErrorMessage(): string;
  isRouteSavePending(): boolean;
  routeSaveErrorMessage(): string;
  cancelDeleteCard(): void;
  deleteCardLabel(): string;
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
    AppMenuComponent,
    AppMenuOutletComponent,
    MatTimepickerModule,
    SmartListComponent,
    InfoCardComponent,
    ProgressIndicatorComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss'],
  providers: [AppMenuDispatcher]
})
export class EventResourcePopupComponent implements DoCheck {
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);

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

  protected showAssetExploreBorrowBasket = false;
  protected showAssetViewPoliciesPopup = false;
  protected assetExploreOrder: AssetExploreOrder = 'availability';
  protected readonly assetExploreOrderOptions = ASSET_EXPLORE_ORDER_OPTIONS;

  protected routeStopTrackId(stopIndex: number): string {
    return this.host.routeEditor()?.routeRowIds[stopIndex] ?? `route-stop-${stopIndex}`;
  }

  protected routeEditorVisibleStops(editor: RouteEditorState): string[] {
    return editor.mode === 'view'
      ? editor.routes.map(stop => stop.trim()).filter(Boolean)
      : editor.routes;
  }

  protected openRouteEditorStopMap(editor: RouteEditorState, stop: string, stopIndex: number, event: Event): void {
    if (editor.mode === 'view') {
      this.openAssetViewRouteStopMap(stop, event);
      return;
    }
    this.host.openRouteStopMap(stopIndex, event);
  }

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
  private resourceSmartList?: SmartListComponent<AppDTOs.SubEventResourceCardDTO, ResourceSmartListFilters>;

  @ViewChild('assetExploreSmartList')
  private assetExploreSmartList?: SmartListComponent<AppDTOs.AssetCardDTO, ResourceSmartListFilters>;

  protected readonly resourceSmartListLoadPage: SmartListLoadPage<AppDTOs.SubEventResourceCardDTO, ResourceSmartListFilters> = (
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

  protected readonly resourceSmartListConfig: SmartListConfig<AppDTOs.SubEventResourceCardDTO, ResourceSmartListFilters> = {
    pageSize: 18,
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

  protected readonly assetExploreSmartListLoadPage: SmartListLoadPage<AppDTOs.AssetCardDTO, ResourceSmartListFilters> = (
    query
  ) => {
    const cards = this.assetExploreCardsForView();
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const basePageSize = Math.max(
      1,
      Math.trunc(Number(query.pageSize) || Number(this.assetExploreSmartListConfig.pageSize) || 1)
    );
    const initialPageSize = this.assetExploreInitialPageSize(basePageSize);
    const start = page === 0 ? 0 : initialPageSize + ((page - 1) * basePageSize);
    const size = page === 0 ? Math.max(pageSize, initialPageSize) : pageSize;
    return of({
      items: cards.slice(start, start + size),
      total: cards.length
    });
  };

  protected readonly assetExploreSmartListConfig: SmartListConfig<AppDTOs.AssetCardDTO, ResourceSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
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
    if (!this.host?.resourceAssetView?.()) {
      this.showAssetViewPoliciesPopup = false;
    }

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
    change: SmartListStateChange<AppDTOs.SubEventResourceCardDTO, ResourceSmartListFilters>
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
    change: SmartListStateChange<AppDTOs.AssetCardDTO, ResourceSmartListFilters>
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
    card: AppDTOs.SubEventResourceCardDTO,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return this.host.resourceInfoCard(card, options);
  }

  protected openResourceCardMap(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.host.canOpenMap(card)) {
      return;
    }
    this.host.openMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.host.canOpenBadgeDetails(card)) {
      return;
    }
    this.host.openBadgeDetails(card);
  }

  protected openAssetViewMembers(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (!view.canOpenMembers) {
      return;
    }
    this.host.openAssetMembers(view.card, event);
  }

  protected closeResourceShellBackdrop(event: Event): void {
    if (this.host.assetExploreOnly() && this.host.resourceAssetView()) {
      this.host.closeResourceAssetView(event);
      return;
    }
    this.host.close();
  }

  protected assetViewTitle(view: ResourceAssetViewState): string {
    return view.mode === 'edit' ? 'Edit Asset' : 'View Asset';
  }

  protected assetViewCategoryLabel(view: ResourceAssetViewState): string {
    return AssetDefaultsBuilder.assetCategoryLabel(view.source?.category);
  }

  protected assetViewCategoryClass(view: ResourceAssetViewState): string {
    return AssetDefaultsBuilder.assetCategoryClass(view.source?.category);
  }

  protected assetViewCategoryIcon(view: ResourceAssetViewState): string {
    return AssetDefaultsBuilder.assetCategoryIcon(view.source?.category);
  }

  protected assetViewTotalCapacity(view: ResourceAssetViewState): number {
    return Math.max(1, Number(view.source?.capacityTotal ?? view.card.capacityTotal) || 1);
  }

  protected assetViewQuantity(view: ResourceAssetViewState): number {
    return Math.max(1, Number(view.source?.quantity ?? 1) || 1);
  }

  protected assetViewSourceLink(view: ResourceAssetViewState): string {
    return `${view.source?.sourceLink ?? view.card.sourceLink ?? ''}`.trim();
  }

  protected assetViewImageUrl(view: ResourceAssetViewState): string {
    return `${view.source?.imageUrl ?? view.card.imageUrl ?? ''}`.trim();
  }

  protected assetViewPolicies(view: ResourceAssetViewState): readonly ContractTypes.EventPolicyItem[] {
    return view.source?.policies ?? [];
  }

  protected assetViewRequiredPoliciesCount(view: ResourceAssetViewState): number {
    return this.assetViewPolicies(view).filter(policy => policy.required !== false).length;
  }

  protected assetViewOptionalPoliciesCount(view: ResourceAssetViewState): number {
    return Math.max(0, this.assetViewPolicies(view).length - this.assetViewRequiredPoliciesCount(view));
  }

  protected assetViewPolicyRequirementLabel(policy: ContractTypes.EventPolicyItem): string {
    return policy.required === false ? 'Optional' : 'Required';
  }

  protected assetViewPolicyMetaLabel(policy: ContractTypes.EventPolicyItem): string {
    return policy.required === false ? 'Optional policy' : 'Required approval';
  }

  protected assetViewPolicyPreview(policy: ContractTypes.EventPolicyItem): string {
    const description = policy.description.trim();
    if (description.length > 0) {
      return description;
    }
    return policy.required === false
      ? 'Borrowers can review this policy before sending the request.'
      : 'Borrowers must approve this lending policy before sending the request.';
  }

  protected openAssetViewPoliciesPopup(event: Event): void {
    event.stopPropagation();
    this.showAssetViewPoliciesPopup = true;
  }

  protected closeAssetViewPoliciesPopup(event?: Event): void {
    event?.stopPropagation();
    this.showAssetViewPoliciesPopup = false;
  }

  protected openAssetViewRoutePopup(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (!this.assetViewHasRoute(view)) {
      return;
    }
    this.host.openAssetViewRouteEditor(view, event, 'view');
  }

  protected assetViewRouteStops(view: ResourceAssetViewState): readonly string[] {
    return view.card.routes.map(stop => stop.trim()).filter(Boolean);
  }

  protected assetViewHasRoute(view: ResourceAssetViewState): boolean {
    return this.assetViewRouteStops(view).length > 0;
  }

  protected assetViewRouteSummaryTitle(view: ResourceAssetViewState): string {
    const count = this.assetViewRouteStops(view).length;
    if (count === 0) {
      return 'No route';
    }
    return `${count} ${count === 1 ? 'stop' : 'stops'}`;
  }

  protected assetViewRouteSummaryMeta(view: ResourceAssetViewState): string {
    const stops = this.assetViewRouteStops(view);
    if (stops.length === 0) {
      return 'No route is set for this event asset.';
    }
    return `${stops[0]}${stops.length > 1 ? ' · ' + stops[stops.length - 1] : ''}`;
  }

  protected assetViewPricingEnabled(view: ResourceAssetViewState): boolean {
    return Boolean(view.source?.pricing?.enabled);
  }

  protected assetViewPricingModeLabel(view: ResourceAssetViewState): string {
    const mode = view.source?.pricing?.mode ?? 'fixed';
    return mode
      .split('-')
      .map(part => part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
      .join(' ');
  }

  protected assetViewPricingBaseLabel(view: ResourceAssetViewState): string {
    const pricing = view.source?.pricing;
    return this.assetExploreBorrowFormatMoney(Number(pricing?.basePrice) || 0, pricing?.currency || 'USD');
  }

  protected assetViewPricingChargeLabel(view: ResourceAssetViewState): string {
    switch (view.source?.pricing?.chargeType) {
      case 'per_attendee':
        return 'per attendee';
      case 'per_slot':
        return 'per slot';
      case 'per_booking':
      default:
        return 'per booking';
    }
  }

  protected assetViewPricingWhyLabel(view: ResourceAssetViewState): string {
    const pricing = view.source?.pricing;
    if (!pricing?.enabled) {
      return 'Pricing is currently disabled for this asset.';
    }
    if (pricing.mode === 'fixed') {
      return `Pricing Mode is set to Fixed, so demand and time rules are not changing the amount yet.`;
    }
    const activeRules = [
      pricing.demandRulesEnabled ? 'demand rules' : '',
      pricing.timeRulesEnabled ? 'time rules' : ''
    ].filter(Boolean);
    return activeRules.length > 0
      ? `This preview uses the base price and can be adjusted by ${activeRules.join(' and ')}.`
      : `This preview is currently showing the base price.`;
  }

  protected openAssetViewRouteSetup(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (view.mode !== 'edit' || !view.canEditRoute) {
      return;
    }
    this.host.openAssetViewRouteEditor(view, event, 'edit');
  }

  protected openAssetViewRouteMap(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    const routes = view.card.routes.filter(stop => stop.trim().length > 0);
    if (routes.length === 0 || typeof window === 'undefined') {
      return;
    }
    const destination = routes[routes.length - 1];
    const waypoints = routes.slice(0, -1);
    const params = new URLSearchParams({
      api: '1',
      destination
    });
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.join('|'));
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  protected openAssetViewRouteStopMap(stop: string, event: Event): void {
    event.stopPropagation();
    const query = stop.trim();
    if (!query || typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams({ api: '1', query });
    window.open(`https://www.google.com/maps/search/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  protected resourceFilterMenuTrigger(): AppMenuTrigger {
    const filter = this.host.resourceFilter();
    const count = this.host.resourceFilterCount(filter);
    return {
      label: this.host.resourceTypeLabel(filter).toLowerCase(),
      icon: this.host.resourceTypeIcon(filter),
      ariaLabel: 'Open asset filter',
      palette: this.resourceTypePalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      shape: 'pill'
    };
  }

  protected resourceFilterMenuItems(): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    const active = this.host.resourceFilter();
    return this.host.resourceFilterOptions().map(option => {
      const count = this.host.resourceFilterCount(option);
      return {
        id: `resource-filter-${option}`,
        label: this.host.resourceTypeLabel(option).toLowerCase(),
        icon: this.host.resourceTypeIcon(option),
        kind: 'radio',
        active: option === active,
        checked: option === active,
        palette: this.resourceTypePalette(option),
        surface: 'tinted',
        counter: count > 0 ? { value: count, max: 99 } : null,
        context: { menu: 'resource-filter', filter: option }
      };
    });
  }

  protected quickActionsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      ariaLabel: 'Open sub-event asset actions',
      hideLabel: true,
      palette: 'green',
      shape: 'icon'
    };
  }

  protected quickActionsMenuItems(): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    return [
      {
        id: 'quick-assign',
        label: 'Assign',
        icon: 'assignment_ind',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'quick-action', action: 'assign' }
      },
      {
        id: 'quick-explore',
        label: 'Explore',
        icon: 'explore',
        palette: 'green',
        surface: 'tinted',
        context: { menu: 'quick-action', action: 'explore' }
      }
    ];
  }

  protected assetExploreOrderMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetExploreOrderLabel(),
      icon: this.assetExploreOrderIcon(),
      ariaLabel: 'Open asset explore order',
      palette: this.assetExploreOrderPalette(this.assetExploreOrder),
      shape: 'pill'
    };
  }

  protected assetExploreOrderMenuItems(): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    return this.assetExploreOrderOptions.map(option => ({
      id: `asset-explore-order-${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === this.assetExploreOrder,
      checked: option.key === this.assetExploreOrder,
      palette: this.assetExploreOrderPalette(option.key),
      surface: 'tinted',
      context: { menu: 'asset-explore-order', order: option.key }
    }));
  }

  protected assetExploreCategoryMenuTrigger(explore: AssetExplorePopupViewState): AppMenuTrigger {
    return {
      label: this.assetExploreCategoryLabel(explore.categoryDisplay),
      icon: this.assetExploreCategoryIcon(explore.category),
      ariaLabel: 'Open asset explore category',
      palette: this.assetCategoryPalette(explore.category),
      shape: 'field'
    };
  }

  protected assetExploreCategoryMenuItems(
    explore: AssetExplorePopupViewState
  ): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    return explore.categoryOptions.map(option => ({
      id: `asset-explore-category-${option}`,
      label: this.assetExploreCategoryLabel(option),
      icon: this.assetExploreCategoryIcon(option),
      kind: 'radio',
      active: option === explore.category,
      checked: option === explore.category,
      palette: this.assetCategoryPalette(option),
      surface: 'tinted',
      context: { menu: 'asset-explore-category', category: option }
    }));
  }

  protected onEventResourceMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventResourceMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'resource-filter':
        event.sourceEvent.stopPropagation();
        this.host.selectResourceFilter(context.filter);
        return;
      case 'quick-action':
        if (context.action === 'assign') {
          this.host.openAssignPopup(event.sourceEvent);
          return;
        }
        this.host.openExplorePopup(event.sourceEvent);
        return;
      case 'asset-explore-order':
        this.selectAssetExploreOrder(context.order, event.sourceEvent);
        return;
      case 'asset-explore-category':
        event.sourceEvent.stopPropagation();
        this.host.selectAssetExploreCategory(context.category, event.sourceEvent);
        return;
      case 'resource-card':
        this.onResourceCardMenuAction(context.card, {
          id: context.infoCard.id,
          actionId: context.action.id,
          action: context.action,
          card: context.infoCard
        });
        return;
      case 'asset-explore-card':
        this.onAssetExploreCardMenuAction(context.card, {
          id: context.infoCard.id,
          actionId: context.action.id,
          action: context.action,
          card: context.infoCard
        });
        return;
      default:
        return;
    }
  }

  protected openResourceInfoCardMenu(
    card: AppDTOs.SubEventResourceCardDTO,
    request: CardMenuRequestEvent<InfoCardData>
  ): void {
    const menuId = `event-resource-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(card, request, 'resource-card'),
      triggerRect: request.triggerRect,
      openUp: request.openUp,
      panelAlign: 'auto',
      closeOnSelect: true,
      onClose: request.closeTrigger
    }, null);
  }

  protected openAssetExploreInfoCardMenu(
    card: AppDTOs.AssetCardDTO,
    request: CardMenuRequestEvent<InfoCardData>
  ): void {
    const menuId = `asset-explore-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(card, request, 'asset-explore-card'),
      triggerRect: request.triggerRect,
      openUp: request.openUp,
      panelAlign: 'auto',
      closeOnSelect: true,
      onClose: request.closeTrigger
    }, null);
  }

  private infoCardMenuTitle(card: InfoCardData): string | null {
    if (card.menuTitle === null) {
      return null;
    }
    return `${card.menuTitle ?? card.title ?? ''}`.trim();
  }

  private infoCardMenuItems(
    card: AppDTOs.SubEventResourceCardDTO | AppDTOs.AssetCardDTO,
    request: CardMenuRequestEvent<InfoCardData>,
    menu: 'resource-card' | 'asset-explore-card'
  ): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    return (request.actions ?? []).flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardResolvedMenuAction = {
        id: actionId,
        ...config
      };
      const context: EventResourceMenuContext = menu === 'resource-card'
        ? {
            menu,
            card: card as AppDTOs.SubEventResourceCardDTO,
            infoCard: request.card,
            action
          }
        : {
            menu,
            card: card as AppDTOs.AssetCardDTO,
            infoCard: request.card,
            action
          };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.infoCardActionPalette(config.tone),
        surface: 'tinted',
        context
      }];
    });
  }

  private infoCardActionPalette(tone: CardResolvedMenuAction['tone']): AppMenuPalette {
    switch (tone) {
      case 'accent':
        return 'green';
      case 'review':
        return 'violet';
      case 'warning':
        return 'warning';
      case 'destructive':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected assetExploreInfoCard(
    card: AppDTOs.AssetCardDTO,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return this.host.assetExploreInfoCard(card, options);
  }

  protected openAssetExploreBorrowFromBadge(card: AppDTOs.AssetCardDTO): void {
    if (!this.host.assetExploreCanBorrow(card)) {
      return;
    }
    this.showAssetExploreBorrowBasket = false;
    this.host.openAssetExploreBorrowDialog(card);
  }

  protected onAssetExploreCardMenuAction(card: AppDTOs.AssetCardDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (event.actionId === 'viewAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.host.openAssetExploreAssetView(card, new Event('click'));
      return;
    }
    if (event.actionId === 'contactOwner') {
      this.showAssetExploreBorrowBasket = false;
      this.host.openAssetExploreServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.openAssetExploreShareDialog(card);
      return;
    }
    if (event.actionId === 'reportOwner') {
      this.showAssetExploreBorrowBasket = false;
      this.host.reportAssetExploreOwner(card, new Event('click'));
      return;
    }
    if (event.actionId === 'borrowAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.host.openAssetExploreBorrowDialog(card, new Event('click'));
    }
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

  protected showAssetExploreBorrowCancellationPolicyCard(dialog: AssetExploreBorrowDialogViewState): boolean {
    return dialog.totalAmount > 0
      && dialog.cancellationPolicy?.enabled === true
      && (dialog.cancellationPolicy.rules?.length ?? 0) > 0;
  }

  protected assetExploreBorrowCancellationPreview(
    dialog: AssetExploreBorrowDialogViewState
  ): { refundLabel: string; note: string } | null {
    if (!this.showAssetExploreBorrowCancellationPolicyCard(dialog)) {
      return null;
    }
    const applicableRule = this.assetExploreBorrowApplicableCancellationRule(dialog);
    if (!applicableRule) {
      return {
        refundLabel: 'No refund right now',
        note: 'The selected borrow window is already inside the last reimbursement window.'
      };
    }

    const refundAmount = this.assetExploreBorrowCancellationRefundAmount(applicableRule, dialog.totalAmount);
    return {
      refundLabel: refundAmount > 0
        ? `${this.assetExploreBorrowFormatMoney(refundAmount, dialog.currency)} refundable right now`
        : 'No refund right now',
      note: this.assetExploreBorrowDescribeCancellationRule(applicableRule, dialog.currency)
    };
  }

  protected assetExploreBorrowCancellationRules(
    dialog: AssetExploreBorrowDialogViewState
  ): ContractTypes.PricingCancellationRule[] {
    return dialog.cancellationPolicy?.rules ?? [];
  }

  protected assetExploreBorrowCancellationRuleWindowLabel(rule: ContractTypes.PricingCancellationRule): string {
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

  protected assetExploreBorrowCancellationRuleRefundLabel(
    rule: ContractTypes.PricingCancellationRule,
    currency = 'USD'
  ): string {
    if (rule.refundKind === 'full') {
      return 'Full refund';
    }
    if (rule.refundKind === 'none') {
      return 'No refund';
    }
    if (rule.refundKind === 'fixed_amount') {
      return this.assetExploreBorrowFormatMoney(Number(rule.refundValue) || 0, currency);
    }
    return `${Math.max(0, Number(rule.refundValue) || 0)}% refund`;
  }

  private assetExploreBorrowApplicableCancellationRule(
    dialog: AssetExploreBorrowDialogViewState
  ): ContractTypes.PricingCancellationRule | null {
    const bookingStart = AppUtils.isoLocalDateTimeToDate(dialog.bookingStartAtIso);
    if (!bookingStart) {
      return null;
    }

    let bestRule: ContractTypes.PricingCancellationRule | null = null;
    let bestDeadlineMs = Number.NEGATIVE_INFINITY;
    for (const rule of this.assetExploreBorrowCancellationRules(dialog)) {
      const deadlineMs = this.assetExploreBorrowCancellationRuleDeadlineMs(rule, bookingStart);
      if (!Number.isFinite(deadlineMs) || Date.now() > deadlineMs) {
        continue;
      }
      if (deadlineMs > bestDeadlineMs) {
        bestDeadlineMs = deadlineMs;
        bestRule = rule;
      }
    }
    return bestRule;
  }

  private assetExploreBorrowCancellationRuleDeadlineMs(
    rule: ContractTypes.PricingCancellationRule,
    bookingStart: Date
  ): number {
    const deadline = new Date(bookingStart.getTime());
    const offsetValue = Math.max(0, Number(rule.offsetValue) || 0);
    switch (rule.offsetUnit) {
      case 'hours':
        deadline.setHours(deadline.getHours() - offsetValue);
        break;
      case 'weeks':
        deadline.setDate(deadline.getDate() - (offsetValue * 7));
        break;
      case 'months':
        deadline.setMonth(deadline.getMonth() - offsetValue);
        break;
      default:
        deadline.setDate(deadline.getDate() - offsetValue);
        break;
    }
    return deadline.getTime();
  }

  private assetExploreBorrowCancellationRefundAmount(
    rule: ContractTypes.PricingCancellationRule,
    totalAmount: number
  ): number {
    if (rule.refundKind === 'full') {
      return Math.round(totalAmount * 100) / 100;
    }
    if (rule.refundKind === 'none') {
      return 0;
    }
    if (rule.refundKind === 'fixed_amount') {
      return Math.min(totalAmount, Math.round((Number(rule.refundValue) || 0) * 100) / 100);
    }
    return Math.round(totalAmount * ((Math.max(0, Math.min(100, Number(rule.refundValue) || 0))) / 100) * 100) / 100;
  }

  private assetExploreBorrowDescribeCancellationRule(
    rule: ContractTypes.PricingCancellationRule,
    currency: string
  ): string {
    return `${this.assetExploreBorrowCancellationRuleRefundLabel(rule, currency)} when cancelled at least ${this.assetExploreBorrowCancellationRuleWindowLabel(rule)}.`;
  }

  protected assetExploreBorrowDrafts(): AssetExploreBorrowDraftViewState[] {
    return this.host.assetExploreBorrowDrafts();
  }

  protected assetExploreBorrowDraftCount(): number {
    return this.assetExploreBorrowDrafts().length;
  }

  protected toggleAssetExploreBorrowBasket(event?: Event): void {
    event?.stopPropagation();
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

  protected assetExploreHeaderStickyLabel(): string {
    return this.assetExploreStickyLabel || 'No items';
  }

  protected assetExploreCategoryClass(option: AppConstants.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryClass(option);
  }

  protected assetExploreCategoryIcon(option: AppConstants.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryIcon(option);
  }

  protected assetExploreCategoryLabel(option: AppConstants.AssetCategory): string {
    return AssetDefaultsBuilder.assetCategoryLabel(option);
  }

  private resourceTypePalette(type: AppConstants.SubEventResourceFilter): AppMenuPalette {
    switch (type) {
      case 'Members':
        return 'blue';
      case 'Car':
        return 'sky';
      case 'Accommodation':
        return 'green';
      case 'Supplies':
        return 'brown';
      default:
        return 'default';
    }
  }

  private assetCategoryPalette(category: AppConstants.AssetCategory): AppMenuPalette {
    return this.resourceTypePalette(AssetDefaultsBuilder.assetCategoryType(category));
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

  protected onResourceCardMenuAction(card: AppDTOs.SubEventResourceCardDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (event.actionId === 'viewAsset') {
      this.host.openResourceAssetView(card, 'view', new Event('click'));
      return;
    }
    if (event.actionId === 'editAsset') {
      this.host.openResourceAssetView(card, 'edit', new Event('click'));
      return;
    }
    if (event.actionId === 'joinResource') {
      this.host.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'leaveResource') {
      this.host.leave(card, new Event('click'));
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
    if (event.actionId === 'contactOrganizer') {
      this.host.openResourceServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.openResourceShareDialog(card);
      return;
    }
    if (event.actionId === 'reportManager' || event.actionId === 'reportOrganizer') {
      this.host.reportResourceManager(card, new Event('click'));
      return;
    }
    if (event.actionId === 'removeAssignment' || event.actionId === 'delete') {
      this.host.delete(card, new Event('click'));
    }
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
    if (this.host.joinDialog()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeJoinDialog();
      return;
    }
    if (this.host.resourceAssetView()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeResourceAssetView();
      return;
    }
    if (this.showAssetExploreBorrowBasket) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showAssetExploreBorrowBasket = false;
      return;
    }
    if (this.host.assetExplorePopup()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeExplorePopup();
      return;
    }
  }

  protected selectAssetExploreOrder(order: AssetExploreOrder, event: Event): void {
    event.stopPropagation();
    this.assetExploreOrder = order;
  }

  protected assetExploreOrderLabel(order: AssetExploreOrder = this.assetExploreOrder): string {
    return this.assetExploreOrderOptions.find(option => option.key === order)?.label ?? 'Available first';
  }

  protected assetExploreOrderIcon(order: AssetExploreOrder = this.assetExploreOrder): string {
    return this.assetExploreOrderOptions.find(option => option.key === order)?.icon ?? 'inventory_2';
  }

  private assetExploreOrderPalette(order: AssetExploreOrder): AppMenuPalette {
    if (order === 'lowest-price') {
      return 'gold';
    }
    if (order === 'fewest-policies') {
      return 'violet';
    }
    return 'green';
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this.showAssetExploreBorrowBasket && !target.closest('.asset-explore-basket')) {
      this.showAssetExploreBorrowBasket = false;
    }
  }

  private syncVisibleResourceCards(
    cards: AppDTOs.SubEventResourceCardDTO[],
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
    cards: AppDTOs.AssetCardDTO[],
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

  private assetExploreCardsForView(source: readonly AppDTOs.AssetCardDTO[] = this.host?.assetExplorePopup?.()?.cards ?? []): AppDTOs.AssetCardDTO[] {
    const availability = (card: AppDTOs.AssetCardDTO) => this.host.assetExploreAvailableQuantity(card);
    const cards = [...source].filter(card => availability(card) > 0);
    const price = (card: AppDTOs.AssetCardDTO) => this.assetExplorePriceAmount(card);
    const policyCount = (card: AppDTOs.AssetCardDTO) => (card.policies ?? []).length;

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

  private assetExploreGroupLabel(card: AppDTOs.AssetCardDTO): string {
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

  private assetExplorePriceAmount(card: AppDTOs.AssetCardDTO): number {
    if (!card.pricing?.enabled) {
      return 0;
    }
    return Math.max(0, Number(card.pricing.basePrice) || 0);
  }

  private assetExplorePriceLabel(card: AppDTOs.AssetCardDTO): string {
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

  private assetExplorePolicyLabel(card: AppDTOs.AssetCardDTO): string {
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
    return window.matchMedia('(max-width: 760px)').matches;
  }

  private assetExploreInitialPageSize(basePageSize: number): number {
    const configuredInitialPageSize = Math.max(
      basePageSize,
      Math.trunc(Number(this.assetExploreSmartListConfig.initialPageSize ?? basePageSize))
    );
    if (!this.isMobileResourceFilterSheetViewport()) {
      return configuredInitialPageSize;
    }
    return basePageSize;
  }

  private openAssetExploreShareDialog(card: AppDTOs.AssetCardDTO): void {
    void this.shareTokensService.createToken({
      kind: 'asset',
      entityId: card.id,
      assetType: card.type,
      ownerUserId: card.ownerUserId ?? null
    }).then(token => this.openShareLinkDialog('Share asset', token));
  }

  private openResourceShareDialog(card: AppDTOs.SubEventResourceCardDTO): void {
    const sourceAssetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation' && card.type !== 'Supplies')) {
      void this.shareTokensService.createToken({
        kind: 'asset',
        entityId: card.id,
        assetType: card.type as AppConstants.AssetType
      }).then(token => this.openShareLinkDialog('Share asset', token));
      return;
    }
    void this.shareTokensService.createToken({
      kind: 'asset',
      entityId: sourceAssetId,
      assetType: card.type
    }).then(token => this.openShareLinkDialog('Share asset', token));
  }

  private openShareLinkDialog(title: string, shareToken: string): void {
    this.confirmationDialogService.open({
      title,
      message: shareToken,
      confirmLabel: 'Copy link',
      cancelLabel: 'Cancel',
      confirmTone: 'accent',
      onConfirm: async () => {
        await navigator.clipboard?.writeText(shareToken);
      }
    });
  }
}
