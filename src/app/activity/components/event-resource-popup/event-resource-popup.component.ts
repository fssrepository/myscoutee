import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, ViewChild, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { from } from 'rxjs';

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
  type CardMenuAction,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';
import { AppContext, AppPopupContext, AssetInfoCardConverter, type ActivitiesNavigationRequest } from '../../../shared/ui';
import type * as ContractTypes from '../../../shared/core/contracts';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import { AppUtils } from '../../../shared/app-utils';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import {
  ActivityMembersService,
  ActivityResourceBuilder,
  ActivityResourcesService,
  AssetsService as SharedAssetsService,
  EventsService,
  ShareTokensService,
  UsersService,
  type UserDto
} from '../../../shared/core';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import { OwnedAssetsStore } from '../../../shared/ui/context/stores/owned-assets.store';
import { AssetPopupStore } from '../../../shared/ui/context/stores/asset-popup.store';
import { NavigatorService } from '../../../navigator';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { SubEventResourcePopupStore } from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { EventEditorSubEventResourcePopupRequest } from '../../../shared/ui/context/event-editor-popup.types';
import type {
  AssetExploreBorrowDialogState,
  AssetExploreBorrowDraftState,
  AssetExploreBorrowPricingPreview,
  AssetExplorePopupState,
  AssignedAssetJoinDialogState,
  AssignedAssetJoinPricingPreview,
  CapacityEditorState,
  PendingResourceDeleteState,
  PendingSupplyDeleteState,
  ResourcePopupContext,
  RouteEditorState as PopupRouteEditorState,
  SupplyBringDialogState
} from '../../../shared/ui/context/sub-event-resource-popup.types';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AppConstants from '../../../shared/core/common/constants';
interface RouteEditorState {
  title: string;
  mode: 'view' | 'edit';
  routes: string[];
  routeRowIds: string[];
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
      action: CardMenuAction;
    }
  | {
      menu: 'asset-explore-card';
      card: AppDTOs.AssetCardDTO;
      infoCard: InfoCardData;
      action: CardMenuAction;
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
  policies: ContractTypes.EventPolicyDTO[];
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
  policies: ContractTypes.EventPolicyDTO[];
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
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly ownedAssetsStore = inject(OwnedAssetsStore);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly activityResourcesService = inject(ActivityResourcesService);

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): AppDTOs.AssetDTO[] {
    return this.ownedAssetsStore.assetCards();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

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
  private pendingCapacitySaveAbortController: AbortController | null = null;
  private pendingCapacitySaveRequestVersion = 0;
  private pendingRouteSaveAbortController: AbortController | null = null;
  private pendingRouteSaveRequestVersion = 0;
  private routeEditorRowIdSequence = 0;
  private pendingAssignSaveAbortController: AbortController | null = null;
  private pendingAssignSaveRequestVersion = 0;
  private pendingAssetExploreRequestVersion = 0;
  private pendingAssetExploreBorrowRequestVersion = 0;
  private assetExploreLoadScheduled = false;
  private readonly assetExploreWarmCacheByKey = new Map<string, AppDTOs.AssetCardDTO[]>();
  private readonly localAssetExploreReservationsByKey = new Map<string, {
    startAtIso: string;
    endAtIso: string;
    quantity: number;
  }>();
  private readonly pendingAssetExploreWarmupKeys = new Set<string>();

  protected showAssetExploreBorrowBasket = false;
  protected showAssetViewPoliciesPopup = false;
  protected assetExploreOrder: AssetExploreOrder = 'availability';
  protected readonly assetExploreOrderOptions = ASSET_EXPLORE_ORDER_OPTIONS;
  protected readonly resourceFilterOptions: readonly AppConstants.AssetType[] = ['Car', 'Accommodation', 'Supplies'];

  protected routeStopTrackId(stopIndex: number): string {
    return this.resourcePopupStore.routeEditorRef()?.routeRowIds[stopIndex] ?? `route-stop-${stopIndex}`;
  }

  protected resourceTypeClass(type: AppConstants.SubEventResourceFilter): string {
    return AssetDefaultsBuilder.assetTypeClass(type === 'Members' ? 'Car' : type);
  }

  protected resourceTypeIcon(type: AppConstants.SubEventResourceFilter): string {
    return type === 'Members' ? 'groups' : AssetDefaultsBuilder.assetTypeIcon(type);
  }

  protected resourceTypeLabel(type: AppConstants.SubEventResourceFilter): string {
    return APP_STATIC_DATA.subEventResourceFilterLabels[type];
  }

  protected routeEditorSupportsMultiRoute(): boolean {
    return this.resourcePopupStore.routeEditorRef() !== null;
  }

  protected routeEditorReadOnly(): boolean {
    return this.resourcePopupStore.routeEditorRef()?.mode === 'view';
  }

  protected isCapacitySavePending(): boolean {
    return this.resourcePopupStore.capacityEditorRef()?.busy === true;
  }

  protected capacitySaveErrorMessage(): string {
    return this.resourcePopupStore.capacityEditorRef()?.error?.trim() ?? '';
  }

  protected isRouteSavePending(): boolean {
    return this.resourcePopupStore.routeEditorRef()?.busy === true;
  }

  protected routeSaveErrorMessage(): string {
    return this.resourcePopupStore.routeEditorRef()?.error?.trim() ?? '';
  }

  protected isDeleteCardPending(): boolean {
    return this.resourcePopupStore.pendingResourceDeleteRef()?.busy === true;
  }

  protected deleteCardErrorMessage(): string {
    return this.resourcePopupStore.pendingResourceDeleteRef()?.error?.trim() ?? '';
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
    this.openRouteStopMap(stopIndex, event);
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
  ) => from(this.loadResourceSmartListPage(query));

  private async loadResourceSmartListPage(
    query: ListQuery<ResourceSmartListFilters>
  ): Promise<PageResult<AppDTOs.SubEventResourceCardDTO>> {
    await this.activityResourcesService.waitForResourceRouteDelay();
    const cards = this.resourceCards();
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: cards.slice(start, start + pageSize),
      total: cards.length
    };
  }

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
  ) => from(this.loadAssetExploreSmartListPage(query));

  private async loadAssetExploreSmartListPage(
    query: ListQuery<ResourceSmartListFilters>
  ): Promise<PageResult<AppDTOs.AssetCardDTO>> {
    await this.activityResourcesService.waitForResourceRouteDelay();
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
    return {
      items: cards.slice(start, start + size),
      total: cards.length
    };
  }

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
    if (!this.resourceAssetView()) {
      this.showAssetViewPoliciesPopup = false;
    }

    const pendingExplore = this.resourcePopupStore.assetExplorePopupRef();
    if (pendingExplore?.loading === true && !this.assetExploreLoadScheduled) {
      this.scheduleAssetExploreCardsLoad();
    }

    const cards = this.resourceCards();
    const contextKey = `${this.popupTitle()}:${this.popupSubtitle()}:${this.resourcePopupStore.resourceFilterRef()}`;
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

    const explore = this.assetExplorePopupViewState();
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
      this.assetExploreAvailabilityLabel(card)
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
    const cards = this.resourceCards();
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
    return this.activityResourcesService.subEventResourceInfoCard(card, {
      groupLabel: options?.groupLabel ?? null,
      canOpenMap: this.canOpenResourceMap(card),
      occupancyLabel: this.occupancyLabel(card),
      canOpenBadgeDetails: this.canOpenResourceBadgeDetails(card),
      canOpenAssetMembers: this.canOpenAssetMembers(card),
      canEditRoute: this.canEditRoute(card),
      canJoin: this.canJoin(card),
      canLeave: this.canLeave(card),
      canReportResourceManager: this.canReportResourceManager(card)
    });
  }

  protected openResourceCardMap(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    this.openResourceMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.canOpenResourceBadgeDetails(card)) {
      return;
    }
    this.openResourceBadgeDetails(card);
  }

  protected openAssetViewMembers(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (!view.canOpenMembers) {
      return;
    }
    this.openAssetMembersPopup(view.card, event);
  }

  protected closeResourceShellBackdrop(event: Event): void {
    if (this.resourcePopupStore.assetExploreOnlyRef() && this.resourceAssetView()) {
      this.closeResourceAssetView(event);
      return;
    }
    this.closeResourcePopup();
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

  protected assetViewPolicies(view: ResourceAssetViewState): readonly ContractTypes.EventPolicyDTO[] {
    return view.source?.policies ?? [];
  }

  protected assetViewRequiredPoliciesCount(view: ResourceAssetViewState): number {
    return this.assetViewPolicies(view).filter(policy => policy.required !== false).length;
  }

  protected assetViewOptionalPoliciesCount(view: ResourceAssetViewState): number {
    return Math.max(0, this.assetViewPolicies(view).length - this.assetViewRequiredPoliciesCount(view));
  }

  protected assetViewPolicyRequirementLabel(policy: ContractTypes.EventPolicyDTO): string {
    return policy.required === false ? 'Optional' : 'Required';
  }

  protected assetViewPolicyMetaLabel(policy: ContractTypes.EventPolicyDTO): string {
    return policy.required === false ? 'Optional policy' : 'Required approval';
  }

  protected assetViewPolicyPreview(policy: ContractTypes.EventPolicyDTO): string {
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
    this.openAssetViewRouteEditor(view, event, 'view');
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
    this.openAssetViewRouteEditor(view, event, 'edit');
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
    const filter = this.resourcePopupStore.resourceFilterRef();
    const count = this.resourceFilterCount(filter);
    return {
      label: this.resourceTypeLabel(filter).toLowerCase(),
      icon: this.resourceTypeIcon(filter),
      ariaLabel: 'Open asset filter',
      palette: this.resourceTypePalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      layout: 'pill'
    };
  }

  protected resourceFilterMenuItems(): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    const active = this.resourcePopupStore.resourceFilterRef();
    return this.resourceFilterOptions.map(option => {
      const count = this.resourceFilterCount(option);
      return {
        id: `resource-filter-${option}`,
        label: this.resourceTypeLabel(option).toLowerCase(),
        icon: this.resourceTypeIcon(option),
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
      layout: 'icon'
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
      layout: 'pill'
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
      label: AssetDefaultsBuilder.assetCategoryLabel(explore.category),
      icon: AssetDefaultsBuilder.assetCategoryIcon(explore.category),
      ariaLabel: 'Open asset explore category',
      palette: this.assetCategoryPalette(explore.category),
      layout: 'field'
    };
  }

  protected assetExploreCategoryMenuItems(
    explore: AssetExplorePopupViewState
  ): readonly AppMenuItem<string, EventResourceMenuContext>[] {
    return explore.categoryOptions.map(option => this.assetExploreCategoryMenuItem(option, explore.category));
  }

  private assetExploreCategoryMenuItem(
    option: AppConstants.AssetCategory,
    activeCategory: AppConstants.AssetCategory
  ): AppMenuItem<string, EventResourceMenuContext> {
    return {
      id: `asset-explore-category-${option}`,
      label: AssetDefaultsBuilder.assetCategoryLabel(option),
      icon: AssetDefaultsBuilder.assetCategoryIcon(option),
      kind: 'radio',
      active: option === activeCategory,
      checked: option === activeCategory,
      palette: this.assetCategoryPalette(option),
      surface: 'tinted',
      context: { menu: 'asset-explore-category', category: option }
    };
  }

  protected onEventResourceMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventResourceMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'resource-filter':
        event.sourceEvent.stopPropagation();
        this.selectResourceFilter(context.filter);
        return;
      case 'quick-action':
        if (context.action === 'assign') {
          this.openAssignPopup(event.sourceEvent);
          return;
        }
        this.openExplorePopup(event.sourceEvent);
        return;
      case 'asset-explore-order':
        this.selectAssetExploreOrder(context.order, event.sourceEvent);
        return;
      case 'asset-explore-category':
        event.sourceEvent.stopPropagation();
        this.selectAssetExploreCategory(context.category, event.sourceEvent);
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
      const action: CardMenuAction = {
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

  private infoCardActionPalette(tone: CardMenuAction['tone']): AppMenuPalette {
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
    return AssetInfoCardConverter.convert(card, {
      variant: 'explore',
      groupLabel: options?.groupLabel ?? null,
      availabilityLabel: this.assetExploreAvailabilityLabel(card),
      canBorrow: this.assetExploreAvailableQuantity(card) > 0,
      canReportOwner: this.canReportAssetExploreOwner(card)
    });
  }

  protected openAssetExploreBorrowFromBadge(card: AppDTOs.AssetCardDTO): void {
    if (this.assetExploreAvailableQuantity(card) <= 0) {
      return;
    }
    this.showAssetExploreBorrowBasket = false;
    this.openAssetExploreBorrowDialog(card);
  }

  protected onAssetExploreCardMenuAction(card: AppDTOs.AssetCardDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (event.actionId === 'viewAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.openAssetExploreAssetView(card, new Event('click'));
      return;
    }
    if (event.actionId === 'contactOwner') {
      this.showAssetExploreBorrowBasket = false;
      this.openAssetExploreServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.openAssetExploreShareDialog(card);
      return;
    }
    if (event.actionId === 'reportOwner') {
      this.showAssetExploreBorrowBasket = false;
      this.reportAssetExploreOwner(card, new Event('click'));
      return;
    }
    if (event.actionId === 'borrowAsset') {
      this.showAssetExploreBorrowBasket = false;
      this.openAssetExploreBorrowDialog(card, new Event('click'));
    }
  }

  protected onAssetExploreDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.setAssetExploreDateRange(start, end);
  }

  protected onAssetExploreBorrowDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.setAssetExploreBorrowDateRange(start, end);
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
    return this.assetExploreBorrowDraftsViewState();
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
    this.resumeAssetExploreBorrowDraft(cardId, event);
  }

  protected assetExploreHeaderStickyLabel(): string {
    return this.assetExploreStickyLabel || 'No items';
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
    const explore = this.assetExplorePopupViewState();
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
      this.openResourceAssetView(card, 'view', new Event('click'));
      return;
    }
    if (event.actionId === 'editAsset') {
      this.openResourceAssetView(card, 'edit', new Event('click'));
      return;
    }
    if (event.actionId === 'joinResource') {
      this.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'leaveResource') {
      this.leave(card, new Event('click'));
      return;
    }
    if (event.actionId === 'capacity') {
      this.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.openRouteEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'contactOrganizer') {
      this.openResourceServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.openResourceShareDialog(card);
      return;
    }
    if (event.actionId === 'reportManager' || event.actionId === 'reportOrganizer') {
      this.reportResourceManager(card, new Event('click'));
      return;
    }
    if (event.actionId === 'removeAssignment' || event.actionId === 'delete') {
      this.requestDeleteResourceCard(card, new Event('click'));
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.assetExploreBorrowDialogViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      if (this.assetExploreBorrowDialogViewState()?.paymentStep) {
        this.backAssetExploreBorrowToDetails();
        return;
      }
      this.closeAssetExploreBorrowDialog();
      return;
    }
    if (this.assignedAssetJoinDialogViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeAssignedAssetJoinDialog();
      return;
    }
    if (this.resourceAssetView()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeResourceAssetView();
      return;
    }
    if (this.showAssetExploreBorrowBasket) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showAssetExploreBorrowBasket = false;
      return;
    }
    if (this.assetExplorePopupViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeExplorePopup();
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

  private assetExploreCardsForView(source: readonly AppDTOs.AssetCardDTO[] = this.assetExplorePopupViewState()?.cards ?? []): AppDTOs.AssetCardDTO[] {
    const availability = (card: AppDTOs.AssetCardDTO) => this.assetExploreAvailableQuantity(card);
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
    const available = this.assetExploreAvailableQuantity(card);
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

  private activeUser(): UserDto {
    const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
    return this.appCtx.userProfileStore.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private applyPersistedPopupState(state: AppDTOs.ActivitySubEventResourceStateDTO): void {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return;
    }
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    ) {
      this.resourcePopupStore.popupContextRef.set({
        ...activeContext,
        fallbackCardsByType: this.mergePersistedFallbackCards(
          activeContext.fallbackCardsByType,
          normalizedState.fallbackAssetCardsByType,
          normalizedState.subEventId
        )
      });
    }
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = [
        ...(normalizedState.assetAssignmentIds[type] ?? [])
      ];
      this.resourcePopupStore.assignedAssetSettingsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = {
        ...(normalizedState.assetSettingsByType[type] ?? {})
      };
    }
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.startsWith(`${normalizedState.subEventId}:`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const [assetId, entries] of Object.entries(normalizedState.supplyContributionEntriesByAssetId)) {
      this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(normalizedState.subEventId, assetId)] = entries
        .map(entry => ({ ...entry }));
    }
  }

  private persistPopupResourceState(context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()): void {
    const nextState = this.buildPopupResourceState(context);
    if (!nextState) {
      return;
    }
    void this.activityResourcesService.replaceSubEventResourceState(nextState);
  }

  private buildPopupResourceState(
    context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    if (!context) {
      return null;
    }
    const ownerId = context.ownerId.trim();
    const subEventId = context.subEvent.id.trim();
    const assetOwnerUserId = this.activeUser().id;
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId,
      assetAssignmentIds: {
        Car: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Car')],
        Accommodation: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Accommodation')],
        Supplies: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Supplies')]
      },
      assetSettingsByType: {
        Car: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Car') },
        Accommodation: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Accommodation') },
        Supplies: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Supplies') }
      },
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveSubEventAssignedAssetIds(subEventId, 'Supplies').map(assetId => [
          assetId,
          this.subEventSupplyContributionEntries(subEventId, assetId).map(entry => ({ ...entry }))
        ])
      ),
      fallbackAssetCardsByType: {
        Car: this.persistedAssignedFallbackCards(context, 'Car'),
        Accommodation: this.persistedAssignedFallbackCards(context, 'Accommodation'),
        Supplies: this.persistedAssignedFallbackCards(context, 'Supplies')
      }
    };
  }

  closeResourcePopup(): void {
    this.abortPendingCapacitySaveRequest();
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.closeResourcePopup();
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    this.resourcePopupStore.assignContextRef.set(null);
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([]);
    this.assetPopupStore.basketVisibleRef.set(false);
    this.ownedAssets.closePopup();
  }

  popupTitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    const subEvent = context?.subEvent;
    const typeLabel = APP_STATIC_DATA.assetTypeLabels[this.resourcePopupStore.resourceFilterRef()];
    if (!context || !subEvent) {
      return typeLabel;
    }
    const stageLabel = this.subEventStageLabel(subEvent);
    return stageLabel ? `${typeLabel} - ${stageLabel}` : typeLabel;
  }

  popupSubtitle(): string {
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

  popupSummary(): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return '0 members';
    }
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, this.resourcePopupStore.resourceFilterRef());
    if (metrics.pending <= 0) {
      return `${metrics.joined} members`;
    }
    return `${metrics.joined} members · ${metrics.pending} pending`;
  }

  canOpenAssetMembers(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  canOpenResourceBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  openResourceBadgeDetails(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceBadgeDetails(card)) {
      return;
    }
    if (card.type === 'Car' || card.type === 'Accommodation') {
      void this.openAssetMembersPopup(card);
      return;
    }
    this.openSupplyContributionsPopup(card, event);
  }

  resourceAssetView(): ResourceAssetViewState | null {
    const viewId = `${this.resourcePopupStore.resourceAssetViewIdRef() ?? ''}`.trim();
    if (!viewId) {
      return null;
    }
    const context = this.resourcePopupStore.popupContextRef();
    const card = this.resourceCards().find(item => item.id === viewId || `${item.sourceAssetId ?? ''}`.trim() === viewId) ?? null;
    if (card && context) {
      const source = card.sourceAssetId
        ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
        : null;
      return {
        card,
        mode: this.resourcePopupStore.resourceAssetViewModeRef(),
        source,
        memberLabel: this.occupancyLabel(card),
        memberCount: Math.max(0, Math.trunc(Number(card.accepted) || 0)),
        pendingCount: Math.max(0, Math.trunc(Number(card.pending) || 0)),
        canOpenMembers: this.canOpenAssetMembers(card),
        canEditCapacity: this.canEditCapacity(card),
        canEditRoute: this.canEditRoute(card)
      };
    }
    const exploreCard = this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === viewId) ?? null;
    if (!exploreCard || !context) {
      return null;
    }
    const exploreResourceCard = this.assetExploreCardToResourceCard(exploreCard, context.subEvent.id);
    const managerUserId = `${exploreCard.ownerUserId ?? ''}`.trim() || null;
    return {
      card: exploreResourceCard,
      mode: 'view',
      source: this.cloneAsset(exploreCard),
      memberLabel: this.assetExploreAvailabilityLabel(exploreCard),
      memberCount: Math.max(0, Math.trunc(Number(exploreResourceCard.accepted) || 0)),
      pendingCount: this.assetPendingCount(exploreCard, context.subEvent.id, managerUserId),
      canOpenMembers: false,
      canEditCapacity: false,
      canEditRoute: false
    };
  }

  private assetExploreCardToResourceCard(
    card: AppDTOs.AssetCardDTO,
    subEventId: string
  ): AppDTOs.SubEventResourceCardDTO {
    const managerUserId = `${card.ownerUserId ?? ''}`.trim() || null;
    return {
      id: `asset-explore-view-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: card.details,
      imageUrl: card.imageUrl,
      sourceLink: card.sourceLink,
      routes: this.normalizeAssetRoutes(card.type, card.routes),
      capacityTotal: Math.max(0, card.capacityTotal),
      accepted: card.type === 'Supplies'
        ? this.subEventSupplyProvidedCount(card.id, subEventId)
        : this.assetAcceptedCount(card, subEventId, managerUserId),
      pending: this.assetPendingCount(card, subEventId, managerUserId),
      isMembers: false
    };
  }

  openAssetExploreAssetView(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.resourcePopupStore.assetExplorePopupRef()) {
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(card.id);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
    this.resourcePopupStore.resourceAssetViewReturnToChatRef.set(false);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
  }

  openResourceAssetView(
    card: AppDTOs.SubEventResourceCardDTO,
    mode: 'view' | 'edit',
    event?: Event
  ): void {
    event?.stopPropagation();
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!assetId) {
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(assetId);
    this.resourcePopupStore.resourceAssetViewModeRef.set(mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view');
    this.resourcePopupStore.resourceAssetViewReturnToChatRef.set(false);
    this.resourcePopupStore.pendingResourceDeleteRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  closeResourceAssetView(event?: Event): void {
    event?.stopPropagation();
    if (this.resourcePopupStore.resourceAssetViewReturnToChatRef()) {
      this.closeResourcePopup();
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(null);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
  }

  async openAssetMembersPopup(card: AppDTOs.SubEventResourceCardDTO, event?: Event): Promise<void> {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation' && card.type !== 'Supplies')) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const assetType: AppConstants.AssetType = card.type;
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, assetType);
    const managerUserId = settings[card.sourceAssetId]?.addedByUserId?.trim() || null;
    const fallbackMembers = this.assetMemberEntries(sourceCard, managerUserId, context.subEvent.id);
    const acceptedMembers = fallbackMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = fallbackMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = settings[card.sourceAssetId]?.capacityMax ?? Math.max(0, sourceCard.capacityTotal);
    this.popupCtx.popupStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: sourceCard.id,
      ownerType: 'asset',
      subtitle: `${sourceCard.title} · ${this.subEventDisplayName(context.subEvent) || 'Sub Event'}`,
      canManage: this.isAssetOwnedByActiveUser(sourceCard),
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      members: fallbackMembers,
      onMembersChanged: nextMembers => this.syncAssetRequestsFromMembers(sourceCard.id, assetType, nextMembers)
    });
  }

  openSupplyContributionsPopup(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || card.type !== 'Supplies' || !card.sourceAssetId) {
      return;
    }
    this.resourcePopupStore.supplyPopupRef.set({
      subEventId: context.subEvent.id,
      assetId: card.sourceAssetId,
      title: card.title
    });
    this.resourcePopupStore.pendingSupplyDeleteRef.set(null);
    this.resourcePopupStore.bringDialogRef.set(null);
  }

  selectResourceFilter(filter: AppConstants.SubEventResourceFilter): void {
    if (filter === 'Members') {
      return;
    }
    this.resourcePopupStore.resourceFilterRef.set(filter);
    this.resourcePopupStore.resourceAssetViewIdRef.set(null);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
    this.resourcePopupStore.capacityEditorRef.set(null);
    this.resourcePopupStore.routeEditorRef.set(null);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  resourceCards(): AppDTOs.SubEventResourceCardDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return [];
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const assignedIds = this.resolveSubEventAssignedAssetIds(context.subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const fallbackCards = context.fallbackCardsByType[type] ?? [];
    const fallbackCardById = new Map(fallbackCards.map(card => [card.id, card] as const));

    return assignedIds
      .map(id => (
        this.ownedAssetCards().find(card => card.id === id && card.type === type)
        ?? fallbackCardById.get(id)
        ?? null
      ))
      .filter((card): card is AppDTOs.AssetCardDTO => card !== null)
      .map(card => {
      const managerUserId = (type === 'Car' || type === 'Accommodation' || type === 'Supplies')
        ? (`${settings[card.id]?.addedByUserId ?? ''}`.trim() || null)
        : null;
      return ({
      id: `subevent-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: card.details,
      imageUrl: card.imageUrl,
      sourceLink: card.sourceLink,
      routes: card.type === 'Accommodation'
        ? this.normalizeAssetRoutes(card.type, card.routes)
        : this.normalizeAssetRoutes(card.type, settings[card.id]?.routes ?? card.routes),
      capacityTotal: settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal),
      accepted: card.type === 'Supplies'
        ? this.subEventSupplyProvidedCount(card.id, context.subEvent.id)
        : this.assetAcceptedCount(card, context.subEvent.id, managerUserId),
      pending: this.assetPendingCount(card, context.subEvent.id, managerUserId),
      isMembers: false
      });
      });
  }

  occupancyLabel(card: AppDTOs.SubEventResourceCardDTO): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (card.type === 'Supplies' && card.sourceAssetId && context) {
      return `${this.subEventSupplyProvidedCount(card.sourceAssetId, context.subEvent.id)} / 1 - ${card.capacityTotal}`;
    }
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  private isAssignedAssetOwnedByActiveUser(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    const ownerUserId = `${sourceCard.ownerUserId ?? ''}`.trim();
    const activeUserId = this.activeUser().id.trim();
    return this.isAssetOwnedByActiveUser(sourceCard, activeUserId, ownerUserId);
  }

  private assignedAssetManagerUserId(
    subEventId: string,
    type: 'Car' | 'Accommodation',
    assetId: string
  ): string | null {
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const managerUserId = `${settings[assetId]?.addedByUserId ?? ''}`.trim();
    return managerUserId || null;
  }

  private isAssignedAssetManagedByActiveUser(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId) === this.activeUser().id;
  }

  private isAssetOwnedByActiveUser(
    card: AppDTOs.AssetCardDTO,
    activeUserId = this.activeUser().id.trim(),
    ownerUserId = `${card.ownerUserId ?? ''}`.trim()
  ): boolean {
    return ownerUserId.length > 0
      ? ownerUserId === activeUserId
      : this.ownedAssetCards().some(item => item.id === card.id && item.type === card.type);
  }

  private isSubEventScopedAssetRequest(request: AppDTOs.AssetMemberRequestDTO, subEventId: string): boolean {
    return ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId);
  }

  private subEventScopedAssetRequests(
    card: AppDTOs.AssetCardDTO,
    subEventId: string
  ): AppDTOs.AssetMemberRequestDTO[] {
    return card.requests
      .filter(request => this.isSubEventScopedAssetRequest(request, subEventId))
      .map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }));
  }

  private findAssignedAssetJoinRequest(
    card: AppDTOs.AssetCardDTO,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppDTOs.AssetMemberRequestDTO | null {
    return this.subEventScopedAssetRequests(card, subEventId)
      .find(request =>
        request.requestKind !== 'manual'
        && AppUtils.resolveAssetRequestUserId(request, this.users) === activeUserId
      ) ?? null;
  }

  private assignedAssetJoinMemberCounts(
    card: AppDTOs.AssetCardDTO,
    subEventId: string,
    activeUserId = this.activeUser().id,
    managerUserId: string | null = null
  ): { accepted: number; pending: number; shareMemberCount: number } {
    const relevantRequests = this.assetRequestsForView(card, subEventId, managerUserId);
    const relevantUserIds = new Set(
      relevantRequests
        .filter(request => request.status === 'accepted' || request.status === 'pending' || request.requestKind === 'manual')
        .map(request => AppUtils.resolveAssetRequestUserId(request, this.users) || request.userId || request.id)
        .filter(value => `${value ?? ''}`.trim().length > 0)
    );
    if (`${activeUserId ?? ''}`.trim().length > 0) {
      relevantUserIds.add(activeUserId);
    }
    return {
      accepted: relevantRequests.filter(request => request.status === 'accepted').length,
      pending: relevantRequests.filter(request => request.status === 'pending').length,
      shareMemberCount: Math.max(1, relevantUserIds.size)
    };
  }

  private assetRequestsForView(
    card: AppDTOs.AssetCardDTO,
    subEventId: string,
    managerUserId: string | null = null
  ): AppDTOs.AssetMemberRequestDTO[] {
    const requests = this.subEventScopedAssetRequests(card, subEventId);
    const normalizedManagerUserId = `${managerUserId ?? ''}`.trim();
    if (!normalizedManagerUserId) {
      return requests;
    }
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    const managerOwnsAsset = this.isAssetOwnedByActiveUser(card, normalizedManagerUserId, ownerUserId);
    const visibleRequests = managerOwnsAsset
      ? requests.filter(request => {
          const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.users) || `${request.userId ?? ''}`.trim();
          if (requestUserId !== normalizedManagerUserId) {
            return true;
          }
          return request.status === 'accepted' || request.requestKind === 'manual';
        })
      : requests;
    const hasManagerRequest = visibleRequests.some(request =>
      AppUtils.resolveAssetRequestUserId(request, this.users) === normalizedManagerUserId
      || `${request.userId ?? ''}`.trim() === normalizedManagerUserId
    );
    if (hasManagerRequest) {
      return visibleRequests;
    }
    const managerUser = this.userById.get(normalizedManagerUserId) ?? this.createFallbackUser(normalizedManagerUserId);
    return [
      {
        id: `manual:${subEventId}:${card.id}`,
        userId: managerUser.id,
        name: managerUser.name,
        initials: managerUser.initials,
        gender: managerUser.gender,
        status: managerOwnsAsset ? 'accepted' : 'pending',
        note: managerOwnsAsset ? 'Managing this asset for the sub-event.' : 'Waiting for lender approval.',
        requestKind: managerOwnsAsset ? 'manual' : 'borrow',
        requestedAtIso: '',
        booking: {
          subEventId
        }
      },
      ...visibleRequests
    ];
  }

  private resolveAssignedAssetJoinPricing(
    card: AppDTOs.AssetCardDTO,
    subEvent: ContractTypes.SubEventDTO,
    activeUserId = this.activeUser().id,
    managerUserId: string | null = null
  ): AssignedAssetJoinPricingPreview {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    const normalized = PricingBuilder.compactPricingConfig(card.pricing, {
      context: 'asset',
      allowSlotFeatures: false
    });
    const basePricing = this.resolveAssetExploreBorrowPricing(card, startAtIso, endAtIso, 1);
    const shareMemberCount = this.assignedAssetJoinMemberCounts(card, subEvent.id, activeUserId, managerUserId).shareMemberCount;
    if (!normalized.enabled || basePricing.amount <= 0) {
      return {
        totalAmount: 0,
        shareAmount: 0,
        shareMemberCount,
        currency: basePricing.currency,
        chargeType: normalized.chargeType ?? null
      };
    }
    const totalAmount = normalized.chargeType === 'per_attendee'
      ? Math.round(basePricing.amount * shareMemberCount * 100) / 100
      : basePricing.amount;
    const shareAmount = normalized.chargeType === 'per_attendee'
      ? basePricing.amount
      : Math.round((totalAmount / Math.max(1, shareMemberCount)) * 100) / 100;
    return {
      totalAmount,
      shareAmount,
      shareMemberCount,
      currency: basePricing.currency,
      chargeType: normalized.chargeType ?? null
    };
  }

  canOpenResourceMap(card: AppDTOs.SubEventResourceCardDTO): boolean {
    if (!card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes).some(stop => stop.trim().length > 0);
  }

  openResourceMap(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type as AppConstants.AssetType, card.routes);
    if (card.type === 'Accommodation') {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }

  canJoin(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    return !this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
  }

  join(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !this.canJoin(card) || !card.sourceAssetId) {
      return;
    }
    const type = card.type === 'Car' || card.type === 'Accommodation' ? card.type : null;
    if (!type) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const existingRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    const validPolicyIds = new Set((sourceCard.policies ?? []).map(policy => policy.id));
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      cardId: card.id,
      type,
      sourceAssetId: sourceCard.id,
      acceptedPolicyIds: [...new Set(existingRequest?.booking?.acceptedPolicyIds ?? [])]
        .map(item => `${item ?? ''}`.trim())
        .filter(item => item.length > 0 && validPolicyIds.has(item)),
      busy: false,
      error: null
    });
  }

  canLeave(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    return !!this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
  }

  leave(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const currentRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    if (!currentRequest) {
      return;
    }
    const nextRequests = sourceCard.requests
      .filter(request => request.id !== currentRequest.id)
      .map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }));
    if (this.resourcePopupStore.assignedAssetJoinDialogRef()?.sourceAssetId === sourceCard.id) {
      this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    }
    if (this.isAssetOwnedByActiveUser(sourceCard)) {
      this.ownedAssets.applyAssetCards(this.ownedAssetCards().map(asset => (
        asset.id === sourceCard.id && asset.type === sourceCard.type
          ? {
              ...asset,
              requests: nextRequests
            }
          : asset
      )), { persist: true, reloadList: false });
      this.syncPopupSubEventMetrics();
      return;
    }
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
      return;
    }
    const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
    const existingCards = nextFallbackCards[sourceCard.type] ?? [];
    const nextFallbackAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
      ...sourceCard,
      requests: nextRequests
    });
    nextFallbackCards[sourceCard.type] = existingCards.some(item => item.id === sourceCard.id)
      ? existingCards.map(item => item.id === sourceCard.id ? nextFallbackAsset : item)
      : [...existingCards, nextFallbackAsset];
    const nextContext = {
      ...activeContext,
      fallbackCardsByType: nextFallbackCards
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(nextContext);
  }

  closeAssignedAssetJoinDialog(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
  }

  toggleAssignedAssetJoinPolicy(policyId: string): void {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const normalizedPolicyId = `${policyId ?? ''}`.trim();
    if (!normalizedPolicyId) {
      return;
    }
    const nextAccepted = new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean));
    if (nextAccepted.has(normalizedPolicyId)) {
      nextAccepted.delete(normalizedPolicyId);
    } else {
      nextAccepted.add(normalizedPolicyId);
    }
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  canSubmitAssignedAssetJoin(): boolean {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context || dialog.busy) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    const acceptedPolicyIds = new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean));
    return !(sourceCard.policies ?? [])
      .some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
  }

  confirmAssignedAssetJoin(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      this.resourcePopupStore.assignedAssetJoinDialogRef.set({
        ...dialog,
        busy: false,
        error: 'This asset is no longer available in the resource popup.'
      });
      return;
    }
    if (!this.canSubmitAssignedAssetJoin()) {
      return;
    }
    const activeUser = this.activeUser();
    const pricing = this.resolveAssignedAssetJoinPricing(sourceCard, context.subEvent, activeUser.id);
    const validPolicyIds = new Set((sourceCard.policies ?? []).map(policy => policy.id));
    const acceptedPolicyIds = [...new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean))]
      .filter(item => validPolicyIds.has(item));
    const existingRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, activeUser.id);
    const startAtIso = `${context.subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${context.subEvent.endAt ?? ''}`.trim();
    const nextRequest: AppDTOs.AssetMemberRequestDTO = {
      id: existingRequest?.id ?? `borrow:${activeUser.id}:${sourceCard.id}:${context.subEvent.id}`,
      userId: activeUser.id,
      name: activeUser.name,
      initials: activeUser.initials,
      gender: activeUser.gender,
      status: 'pending',
      note: 'Join request from sub-event assets.',
      requestKind: 'borrow',
      requestedAtIso: existingRequest?.requestedAtIso ?? new Date().toISOString(),
      booking: this.assetRequestBookingForRange(
        context.subEvent,
        context.ownerId,
        context.parentTitle,
        startAtIso,
        endAtIso,
        1,
        {
          totalAmount: pricing.shareAmount,
          currency: pricing.currency,
          acceptedPolicyIds
        }
      )
    };
    const nextRequests: AppDTOs.AssetMemberRequestDTO[] = [
      nextRequest,
      ...sourceCard.requests
        .filter(request =>
          request.id !== nextRequest.id
          && AppUtils.resolveAssetRequestUserId(request, this.users) !== activeUser.id
        )
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }))
    ];
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds,
      busy: true,
      error: null
    });
    if (this.isAssetOwnedByActiveUser(sourceCard)) {
      this.ownedAssets.applyAssetCards(this.ownedAssetCards().map(asset => (
        asset.id === sourceCard.id && asset.type === sourceCard.type
          ? {
              ...asset,
              requests: nextRequests
            }
          : asset
      )), { persist: true, reloadList: false });
      this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
      this.syncPopupSubEventMetrics();
      return;
    }

    const activeContext = this.resourcePopupStore.popupContextRef();
    if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
      return;
    }
    const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
    const existingCards = nextFallbackCards[sourceCard.type] ?? [];
    const nextFallbackAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
      ...sourceCard,
      requests: nextRequests
    });
    nextFallbackCards[sourceCard.type] = existingCards.some(card => card.id === sourceCard.id)
      ? existingCards.map(card => card.id === sourceCard.id ? nextFallbackAsset : card)
      : [...existingCards, nextFallbackAsset];
    const nextContext = {
      ...activeContext,
      fallbackCardsByType: nextFallbackCards
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(nextContext);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
  }

  canEditCapacity(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return this.isAssignedAssetOwnedByActiveUser(card);
  }

  canEditRoute(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return card.type === 'Car' && this.canEditCapacity(card);
  }

  openCapacityEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || !this.canEditCapacity(card)) {
      return;
    }
    const type = card.type as AppConstants.AssetType;
    const source = this.ownedAssetCards().find(item => item.id === card.sourceAssetId && item.type === type);
    if (!source) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const current = settings[card.sourceAssetId];
    const capacityLimit = Math.max(0, source.capacityTotal);
    const capacityMax = AppUtils.clampNumber(Math.trunc(current?.capacityMax ?? capacityLimit), 0, capacityLimit);
    const capacityMin = AppUtils.clampNumber(Math.trunc(current?.capacityMin ?? 0), 0, capacityMax);
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set({
      subEventId: context.subEvent.id,
      type,
      assetId: card.sourceAssetId,
      title: card.title,
      capacityMin,
      capacityMax,
      capacityLimit,
      busy: false,
      error: null
    });
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set(null);
    this.resourcePopupStore.pendingResourceDeleteRef.set(null);
  }

  closeCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
  }

  canSubmitCapacityEditor(): boolean {
    const editor = this.resourcePopupStore.capacityEditorRef();
    return !!editor
      && !editor.busy
      && editor.capacityMin >= 0
      && editor.capacityMax >= editor.capacityMin
      && editor.capacityMax <= editor.capacityLimit;
  }

  onCapacityMinChange(value: number | string): void {
    const editor = this.resourcePopupStore.capacityEditorRef();
    if (!editor || editor.busy) {
      return;
    }
    const parsed = Number(value);
    this.resourcePopupStore.capacityEditorRef.set({
      ...editor,
      capacityMin: AppUtils.clampNumber(
        Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMin,
        0,
        editor.capacityMax
      ),
      error: null
    });
  }

  onCapacityMaxChange(value: number | string): void {
    const editor = this.resourcePopupStore.capacityEditorRef();
    if (!editor || editor.busy) {
      return;
    }
    const parsed = Number(value);
    const capacityMax = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMax,
      0,
      editor.capacityLimit
    );
    this.resourcePopupStore.capacityEditorRef.set({
      ...editor,
      capacityMin: Math.min(editor.capacityMin, capacityMax),
      capacityMax,
      error: null
    });
  }

  saveCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.capacityEditorRef();
    if (!editor || editor.busy || !this.canSubmitCapacityEditor()) {
      return;
    }
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }
    const nextSettings = {
      ...(nextState.assetSettingsByType[editor.type] ?? {})
    };
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: editor.capacityLimit,
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      capacityMin: editor.capacityMin,
      capacityMax: editor.capacityMax
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [editor.type]: nextSettings
    };

    const requestVersion = ++this.pendingCapacitySaveRequestVersion;
    const abortController = new AbortController();
    this.pendingCapacitySaveAbortController = abortController;
    this.resourcePopupStore.capacityEditorRef.set({
      ...editor,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingCapacitySaveAbortController === abortController) {
          this.pendingCapacitySaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingCapacitySaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.resourcePopupStore.capacityEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingCapacitySaveAbortController === abortController) {
          this.pendingCapacitySaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingCapacitySaveRequestVersion) {
          return;
        }
        const currentEditor = this.resourcePopupStore.capacityEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.resourcePopupStore.capacityEditorRef.set({
          ...currentEditor,
          busy: false,
          error: 'Unable to save capacity changes.'
        });
      });
  }

  private abortPendingCapacitySaveRequest(): void {
    this.pendingCapacitySaveRequestVersion += 1;
    const controller = this.pendingCapacitySaveAbortController;
    this.pendingCapacitySaveAbortController = null;
    controller?.abort();
  }

  openRouteEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event, mode: 'view' | 'edit' = 'edit'): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || card.type !== 'Car' || !card.sourceAssetId) {
      return;
    }
    const resolvedMode: 'view' | 'edit' = mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view';
    if (mode === 'edit' && resolvedMode !== 'edit') {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = this.ownedAssetCards().find(item => item.id === card.sourceAssetId && item.type === 'Car')
      ?? this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === card.sourceAssetId && item.type === 'Car')
      ?? null;
    const routes = this.resolveViewableCarRoutes(settings[card.sourceAssetId]?.routes, card.routes, source?.routes);
    if (resolvedMode === 'view' && routes.every(stop => stop.trim().length === 0)) {
      return;
    }
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set({
      subEventId: context.subEvent.id,
      type: 'Car',
      assetId: card.sourceAssetId,
      title: card.title,
      mode: resolvedMode,
      routes,
      routeRowIds: this.buildRouteEditorRowIds(routes),
      busy: false,
      error: null
    });
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
    this.resourcePopupStore.pendingResourceDeleteRef.set(null);
  }

  openAssetViewRouteEditor(
    view: ResourceAssetViewState,
    event: Event,
    mode: 'view' | 'edit' = 'view'
  ): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const card = view.card;
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!context || card.type !== 'Car' || !assetId) {
      return;
    }
    const resolvedMode: 'view' | 'edit' = mode === 'edit' && view.canEditRoute ? 'edit' : 'view';
    if (mode === 'edit' && resolvedMode !== 'edit') {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = view.source?.type === 'Car'
      ? view.source
      : this.ownedAssetCards().find(item => item.id === assetId && item.type === 'Car')
        ?? this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === assetId && item.type === 'Car')
        ?? null;
    const routes = this.resolveViewableCarRoutes(settings[assetId]?.routes, card.routes, source?.routes);
    if (resolvedMode === 'view' && routes.every(stop => stop.trim().length === 0)) {
      return;
    }
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set({
      subEventId: context.subEvent.id,
      type: 'Car',
      assetId,
      title: card.title,
      mode: resolvedMode,
      routes,
      routeRowIds: this.buildRouteEditorRowIds(routes),
      busy: false,
      error: null
    });
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
    this.resourcePopupStore.pendingResourceDeleteRef.set(null);
  }

  private resolveViewableCarRoutes(
    settingsRoutes: string[] | undefined,
    cardRoutes: string[] | undefined,
    sourceRoutes: string[] | undefined
  ): string[] {
    const candidates = [settingsRoutes, cardRoutes, sourceRoutes]
      .map(routes => this.normalizeAssetRoutes('Car', routes).filter(stop => stop.trim().length > 0));
    return candidates.find(routes => routes.length > 0) ?? [''];
  }

  openResourceServiceChat(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
      : null;
    const managerUserId = sourceCard?.ownerUserId?.trim() || (
      card.type === 'Car' || card.type === 'Accommodation'
        ? this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId || '')
        : null
    );
    const titlePrefix = sourceCard ? 'Asset Service' : 'Event Service';
    const chat = this.buildServiceChatItem({
      id: sourceCard
        ? `c-service-asset-${sourceCard.id}-${context.subEvent.id}-${activeUserId}`
        : `c-service-event-resource-${context.ownerId}-${context.subEvent.id}-${card.id}-${activeUserId}`,
      title: `${titlePrefix} · ${card.title}`,
      lastMessage: sourceCard
        ? `Service chat with the ${card.type.toLowerCase()} manager for ${card.title}.`
        : `Service chat with the organizer for ${context.parentTitle}.`,
      eventId: context.ownerId,
      subEventId: context.subEvent.id,
      memberIds: [activeUserId, managerUserId].filter((id): id is string => `${id ?? ''}`.trim().length > 0),
      lastSenderId: managerUserId || activeUserId,
      avatarSource: sourceCard?.ownerName || sourceCard?.title || card.title
    });
    this.activitiesStore.openEventChat(chat);
  }

  canReportAssetExploreOwner(card: AppDTOs.AssetCardDTO): boolean {
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    return !!this.resourcePopupStore.popupContextRef() && !!ownerUserId && ownerUserId !== activeUserId;
  }

  reportAssetExploreOwner(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    if (!context || !ownerUserId || ownerUserId === activeUserId) {
      return;
    }
    this.navigatorService.openReportUserPopup({
      targetUserId: ownerUserId,
      targetName: card.ownerName?.trim() || this.reportTargetName(ownerUserId, 'Owner'),
      eventId: context.ownerId,
      eventTitle: card.title,
      eventStartAtIso: context.subEvent.startAt,
      eventTimeframe: this.reportContextTimeframe(context),
      ownerType: 'asset'
    });
  }

  canReportResourceManager(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const target = this.resolveResourceReportTarget(card);
    return !!target && target.userId !== this.activeUser().id.trim();
  }

  reportResourceManager(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const target = this.resolveResourceReportTarget(card);
    if (!context || !target || target.userId === this.activeUser().id.trim()) {
      return;
    }
    this.navigatorService.openReportUserPopup({
      targetUserId: target.userId,
      targetName: target.name,
      eventId: context.ownerId,
      eventTitle: target.ownerType === 'asset' ? card.title : context.parentTitle,
      eventStartAtIso: context.subEvent.startAt,
      eventTimeframe: this.reportContextTimeframe(context),
      ownerType: target.ownerType
    });
  }

  private resolveResourceReportTarget(card: AppDTOs.SubEventResourceCardDTO): {
    userId: string;
    name: string;
    ownerType: AppConstants.ActivityMemberOwnerType;
  } | null {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return null;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
      : null;
    const managerUserId = sourceCard?.ownerUserId?.trim() || (
      card.type === 'Car' || card.type === 'Accommodation'
        ? this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId || '')
        : ''
    );
    if (managerUserId) {
      return {
        userId: managerUserId,
        name: sourceCard?.ownerName?.trim() || this.reportTargetName(managerUserId, 'Manager'),
        ownerType: 'asset'
      };
    }
    const eventRecord = this.eventsService.peekKnownRecordById(this.activeUser().id.trim(), context.ownerId);
    const organizerUserId = `${eventRecord?.creatorUserId ?? context.subEvent.createdByUserId ?? ''}`.trim();
    if (!organizerUserId) {
      return null;
    }
    return {
      userId: organizerUserId,
      name: eventRecord?.creatorName?.trim() || this.reportTargetName(organizerUserId, 'Organizer'),
      ownerType: 'event'
    };
  }

  private reportTargetName(userId: string, fallback: string): string {
    const normalizedUserId = userId.trim();
    return this.appCtx.userProfileStore.getUserProfile(normalizedUserId)?.name?.trim()
      || (normalizedUserId === this.activeUser().id.trim() ? this.activeUser().name?.trim() : '')
      || fallback;
  }

  private reportContextTimeframe(context: ResourcePopupContext): string {
    const start = context.subEvent.startAt?.trim();
    const end = context.subEvent.endAt?.trim();
    if (start && end) {
      return `${start} - ${end}`;
    }
    return start || end || '';
  }

  closeRouteEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set(null);
  }

  addRouteStop(): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view') {
      return;
    }
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes: [...editor.routes, ''],
      routeRowIds: [...editor.routeRowIds, this.nextRouteEditorRowId()],
      error: null
    });
  }

  removeRouteStop(index: number): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes: editor.routes.filter((_stop, stopIndex) => stopIndex !== index),
      routeRowIds: editor.routeRowIds.filter((_routeRowId, stopIndex) => stopIndex !== index),
      error: null
    });
  }

  dropRouteStop(event: CdkDragDrop<string[]>): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || event.previousIndex === event.currentIndex) {
      return;
    }
    const routes = [...editor.routes];
    const routeRowIds = [...editor.routeRowIds];
    const [moved] = routes.splice(event.previousIndex, 1);
    const [movedRouteRowId] = routeRowIds.splice(event.previousIndex, 1);
    routes.splice(event.currentIndex, 0, moved);
    routeRowIds.splice(event.currentIndex, 0, movedRouteRowId);
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes,
      routeRowIds,
      error: null
    });
  }

  updateRouteStop(index: number, value: string): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    const routes = [...editor.routes];
    routes[index] = value;
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes,
      error: null
    });
  }

  openRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsSearch(editor.routes[index] ?? '');
  }

  openRouteMap(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsDirections(editor.routes);
  }

  canSubmitRouteEditor(): boolean {
    const editor = this.resourcePopupStore.routeEditorRef();
    return !!editor && editor.mode !== 'view' && !editor.busy && editor.routes.some(stop => stop.trim().length > 0);
  }

  saveRouteEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || !this.canSubmitRouteEditor()) {
      return;
    }
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }
    const nextSettings = {
      ...(nextState.assetSettingsByType[editor.type] ?? {})
    };
    const source = this.ownedAssetCards().find(item => item.id === editor.assetId && item.type === editor.type);
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source?.capacityTotal ?? 0),
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      routes: this.normalizeAssetRoutes(editor.type, editor.routes)
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [editor.type]: nextSettings
    };

    const requestVersion = ++this.pendingRouteSaveRequestVersion;
    const abortController = new AbortController();
    this.pendingRouteSaveAbortController = abortController;
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingRouteSaveAbortController === abortController) {
          this.pendingRouteSaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingRouteSaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.resourcePopupStore.routeEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingRouteSaveAbortController === abortController) {
          this.pendingRouteSaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingRouteSaveRequestVersion) {
          return;
        }
        const currentEditor = this.resourcePopupStore.routeEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.resourcePopupStore.routeEditorRef.set({
          ...currentEditor,
          busy: false,
          error: 'Unable to save route changes.'
        });
      });
  }

  private abortPendingRouteSaveRequest(): void {
    this.pendingRouteSaveRequestVersion += 1;
    const controller = this.pendingRouteSaveAbortController;
    this.pendingRouteSaveAbortController = null;
    controller?.abort();
  }

  private abortPendingAssignSaveRequest(): void {
    this.pendingAssignSaveRequestVersion += 1;
    const controller = this.pendingAssignSaveAbortController;
    this.pendingAssignSaveAbortController = null;
    controller?.abort();
  }

  requestDeleteResourceCard(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId || !this.isAssignableAssetType(card.type)) {
      return;
    }
    this.resourcePopupStore.pendingResourceDeleteRef.set({
      assetId: card.sourceAssetId,
      type: card.type,
      title: card.title,
      busy: false,
      error: null
    });
  }

  confirmDeleteResourceCard(): void {
    const pending = this.resourcePopupStore.pendingResourceDeleteRef();
    if (!pending || pending.busy) {
      return;
    }
    const nextState = this.buildResourceAssignmentRemovalState(pending);
    if (!nextState) {
      this.resourcePopupStore.pendingResourceDeleteRef.set({
        ...pending,
        busy: false,
        error: 'Unable to remove assignment.'
      });
      return;
    }
    this.resourcePopupStore.pendingResourceDeleteRef.set({
      ...pending,
      busy: true,
      error: null
    });
    void this.activityResourcesService.replaceSubEventResourceState(nextState)
      .then(savedState => {
        const currentPending = this.resourcePopupStore.pendingResourceDeleteRef();
        if (!currentPending || currentPending.assetId !== pending.assetId) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.syncPopupSubEventMetrics({ persistAssetRequests: true });
        this.resourcePopupStore.pendingResourceDeleteRef.set(null);
      })
      .catch(() => {
        const currentPending = this.resourcePopupStore.pendingResourceDeleteRef();
        if (!currentPending || currentPending.assetId !== pending.assetId) {
          return;
        }
        this.resourcePopupStore.pendingResourceDeleteRef.set({
          ...currentPending,
          busy: false,
          error: 'Unable to remove assignment.'
        });
      });
  }

  cancelDeleteResourceCard(): void {
    const pending = this.resourcePopupStore.pendingResourceDeleteRef();
    if (pending?.busy) {
      return;
    }
    this.resourcePopupStore.pendingResourceDeleteRef.set(null);
  }

  resourceDeleteCardLabel(): string {
    const pending = this.resourcePopupStore.pendingResourceDeleteRef();
    return pending ? `Remove "${pending.title}" from this event assignment?` : '';
  }

  private buildResourceAssignmentRemovalState(
    pending: PendingResourceDeleteState
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const context = this.resourcePopupStore.popupContextRef();
    const nextState = this.buildPopupResourceState(context);
    if (!context || !nextState) {
      return null;
    }
    const currentIds = nextState.assetAssignmentIds[pending.type] ?? [];
    const nextIds = currentIds.filter(assetId => assetId !== pending.assetId);
    if (nextIds.length === currentIds.length) {
      return null;
    }
    const nextSettings = { ...(nextState.assetSettingsByType[pending.type] ?? {}) };
    delete nextSettings[pending.assetId];
    nextState.assetAssignmentIds = {
      ...nextState.assetAssignmentIds,
      [pending.type]: nextIds
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [pending.type]: nextSettings
    };
    if (pending.type === 'Supplies') {
      const nextSupplyEntries = { ...nextState.supplyContributionEntriesByAssetId };
      delete nextSupplyEntries[pending.assetId];
      nextState.supplyContributionEntriesByAssetId = nextSupplyEntries;
    }
    return nextState;
  }

  private isAssignableAssetType(type: AppConstants.SubEventResourceFilter): type is AppConstants.AssetType {
    return type === 'Car' || type === 'Accommodation' || type === 'Supplies';
  }

  openAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    const type = this.resourcePopupStore.resourceFilterRef();
    this.resourcePopupStore.assignContextRef.set({ subEventId: context.subEvent.id, type });
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([...this.resolveSubEventAssignedAssetIds(context.subEvent.id, type)]);
    this.ownedAssets.openPopup(type);
    this.assetPopupStore.primaryVisibleRef.set(true);
    this.assetPopupStore.stackedVisibleRef.set(false);
    this.assetPopupStore.basketVisibleRef.set(true);
  }

  openExplorePopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const { startAtIso, endAtIso } = this.defaultAssetExploreRange(context.subEvent);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      subEventId: context.subEvent.id,
      type,
      category: AssetDefaultsBuilder.defaultCategory(type),
      startAtIso,
      endAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  closeExplorePopup(event?: Event): void {
    event?.stopPropagation();
    if (this.resourcePopupStore.assetExploreOnlyRef()) {
      this.closeResourcePopup();
      return;
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  readonly assetExplorePopupViewState = computed<AssetExplorePopupViewState | null>(() => {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!popup || !context) {
      return null;
    }
    const stageLabel = this.subEventStageLabel(context.subEvent);
    const windowRange = this.defaultAssetExploreRange(context.subEvent);
    return {
      title: stageLabel ? `Explore - ${stageLabel}` : `Explore`,
      subtitle: this.popupSubtitle(),
      type: popup.type,
      category: popup.category,
      categoryOptions: [
        ...AssetDefaultsBuilder.assetCategoryOptions('Car'),
        ...AssetDefaultsBuilder.assetCategoryOptions('Accommodation'),
        ...AssetDefaultsBuilder.assetCategoryOptions('Supplies')
      ],
      startDate: AppUtils.isoLocalDateTimeToDate(popup.startAtIso),
      endDate: AppUtils.isoLocalDateTimeToDate(popup.endAtIso),
      windowStartDate: AppUtils.isoLocalDateTimeToDate(windowRange.startAtIso),
      windowEndDate: AppUtils.isoLocalDateTimeToDate(windowRange.endAtIso),
      startTime: AppUtils.isoLocalTimePart(popup.startAtIso),
      endTime: AppUtils.isoLocalTimePart(popup.endAtIso),
      loading: popup.loading,
      error: popup.error,
      cards: popup.cards
    };
  });

  readonly assetExploreBorrowDialogViewState = computed<AssetExploreBorrowDialogViewState | null>(() => {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !popup || !context) {
      return null;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      return null;
    }
    const timeframe = this.assetRequestTimeframeLabel(dialog.startAtIso, dialog.endAtIso);
    const pricing = this.resolveAssetExploreBorrowPricing(card, dialog.startAtIso, dialog.endAtIso, dialog.quantity);
    const detail = dialog.quantity > 1
      ? `${timeframe} · Qty ${dialog.quantity}`
      : timeframe;
    const cancellationPolicy = PricingBuilder.compactPricingConfig(card.pricing, {
      context: 'asset',
      allowSlotFeatures: false
    }).cancellationPolicy;
    return {
      title: `Borrow ${card.title}`,
      subtitle: this.popupSubtitle(),
      timeframe,
      quantity: dialog.quantity,
      availableQuantity: dialog.availableQuantity,
      startDate: AppUtils.isoLocalDateTimeToDate(dialog.startAtIso),
      endDate: AppUtils.isoLocalDateTimeToDate(dialog.endAtIso),
      startTime: AppUtils.isoLocalTimePart(dialog.startAtIso),
      endTime: AppUtils.isoLocalTimePart(dialog.endAtIso),
      lineItems: [
        {
          id: `resource:${card.id}`,
          kind: 'resource',
          label: card.title,
          detail: detail || 'Borrow request',
          amount: pricing.amount,
          currency: pricing.currency
        }
      ],
      totalAmount: pricing.amount,
      currency: pricing.currency,
      bookingStartAtIso: dialog.startAtIso,
      cancellationPolicy,
      policies: (card.policies ?? []).map(item => ({ ...item })),
      acceptedPolicyIds: [...dialog.acceptedPolicyIds],
      payable: pricing.amount > 0,
      paymentStep: dialog.paymentStep,
      submitLabel: pricing.amount > 0
        ? (dialog.paymentStep ? 'Buy' : 'Checkout')
        : 'Send borrow request',
      busyLabel: pricing.amount > 0
        ? (dialog.paymentStep ? 'Buying...' : 'Checking out...')
        : 'Sending request...',
      busy: dialog.busy,
      error: dialog.error
    };
  });

  readonly assignedAssetJoinDialogViewState = computed<AssignedAssetJoinDialogViewState | null>(() => {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context) {
      return null;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      return null;
    }
    const timeframe = this.assetRequestTimeframeLabel(
      `${context.subEvent.startAt ?? ''}`.trim(),
      `${context.subEvent.endAt ?? ''}`.trim()
    );
    const isOwnedAsset = this.isAssetOwnedByActiveUser(sourceCard);
    const managerUserId = this.assignedAssetManagerUserId(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    const pricing = this.resolveAssignedAssetJoinPricing(sourceCard, context.subEvent, this.activeUser().id, managerUserId);
    const memberCounts = this.assignedAssetJoinMemberCounts(sourceCard, context.subEvent.id, this.activeUser().id, managerUserId);
    const shareLabel = pricing.chargeType === 'per_attendee'
      ? 'Per-member price'
      : (pricing.shareMemberCount === 1 ? 'Current share' : `Estimated share for ${pricing.shareMemberCount} members`);
    const shareHint = pricing.totalAmount > 0
      ? (pricing.chargeType === 'per_attendee'
          ? 'This asset charges per member, so your join keeps the same price even as the member list changes.'
          : 'This asset is priced as a shared booking, so the preview is split across the current member count for this subevent.')
      : 'No asset pricing is configured for this join request.';
    return {
      title: `Join ${sourceCard.title}`,
      subtitle: this.popupSubtitle(),
      timeframe: timeframe || 'Sub-event timeframe',
      pathLabel: isOwnedAsset ? 'Assigned own asset' : 'Borrowed item',
      memberSummary: memberCounts.pending > 0
        ? `${memberCounts.accepted} accepted · ${memberCounts.pending} pending`
        : `${memberCounts.accepted} accepted`,
      lineItems: [
        {
          id: `resource:${sourceCard.id}`,
          kind: 'resource',
          label: sourceCard.title,
          detail: isOwnedAsset ? 'Assigned asset join' : 'Borrowed item join',
          amount: pricing.shareAmount,
          currency: pricing.currency
        }
      ],
      totalAmount: pricing.totalAmount,
      shareAmount: pricing.shareAmount,
      shareMemberCount: pricing.shareMemberCount,
      currency: pricing.currency,
      shareLabel,
      shareHint,
      policies: (sourceCard.policies ?? []).map(item => ({ ...item })),
      acceptedPolicyIds: [...dialog.acceptedPolicyIds],
      submitLabel: 'Send join request',
      busyLabel: 'Sending request...',
      busy: dialog.busy,
      error: dialog.error
    };
  });

  readonly assetExploreBorrowDraftsViewState = computed<AssetExploreBorrowDraftViewState[]>(() => {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!popup || !context || !activeUserId) {
      return [];
    }
    return this.listAssetExploreBorrowDrafts(activeUserId, context.subEvent.id)
      .map(draft => {
        const card = popup.cards.find(item => item.id === draft.cardId) ?? null;
        return {
          cardId: draft.cardId,
          title: card?.title ?? draft.title,
          timeframe: this.assetRequestTimeframeLabel(
            draft.startAtIso || popup.startAtIso,
            draft.endAtIso || popup.endAtIso
          ),
          quantity: Math.max(1, Math.trunc(Number(draft.quantity) || 1)),
          availabilityLabel: card ? this.assetExploreAvailabilityLabel(card) : 'Unavailable for this time'
        } satisfies AssetExploreBorrowDraftViewState;
      })
      .filter((entry): entry is AssetExploreBorrowDraftViewState => Boolean(entry))
      .sort((left, right) => left.title.localeCompare(right.title) || left.cardId.localeCompare(right.cardId));
  });

  selectAssetExploreCategory(category: string, event?: Event): void {
    event?.stopPropagation();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    const normalizedCategory = AssetDefaultsBuilder.assetCategoryLabel(category);
    let nextType = popup.type;
    let nextCategory = popup.category;
    nextType = AssetDefaultsBuilder.assetCategoryType(normalizedCategory);
    nextCategory = AssetDefaultsBuilder.normalizeCategory(nextType, normalizedCategory);

    if (nextType === popup.type && nextCategory === popup.category) {
      return;
    }
    this.resourcePopupStore.assetExplorePopupRef.set({
      ...popup,
      type: nextType,
      category: nextCategory,
      loading: true,
      error: null
    });
    this.scheduleAssetExploreCardsLoad();
  }

  setAssetExploreDateRange(start: Date | null, end: Date | null): void {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    const nextStartAtIso = AppUtils.applyDatePartToIsoLocal(popup.startAtIso, start);
    const nextEndAtIso = AppUtils.applyDatePartToIsoLocal(popup.endAtIso, end);
    this.resourcePopupStore.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      ...popup,
      startAtIso: nextStartAtIso,
      endAtIso: nextEndAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  setAssetExploreTime(edge: 'start' | 'end', value: string): void {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    this.resourcePopupStore.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      ...popup,
      startAtIso: edge === 'start' ? AppUtils.applyTimePartToIsoLocal(popup.startAtIso, value) : popup.startAtIso,
      endAtIso: edge === 'end' ? AppUtils.applyTimePartToIsoLocal(popup.endAtIso, value) : popup.endAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  private async loadAssetExploreCards(): Promise<void> {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    const query = this.assetExploreQueryFromPopup(popup);
    const queryKey = this.assetExploreQueryKey(query);
    const requestVersion = ++this.pendingAssetExploreRequestVersion;
    try {
      const cards = await this.assetsService.queryVisibleAssets(query);
      const sortedCards = this.sortAssetExploreCards(cards, query.startAtIso ?? '', query.endAtIso ?? '');
      this.storeAssetExploreWarmCache(queryKey, sortedCards);
      const current = this.resourcePopupStore.assetExplorePopupRef();
      if (!current || requestVersion !== this.pendingAssetExploreRequestVersion) {
        return;
      }
      if (this.assetExploreQueryKey(this.assetExploreQueryFromPopup(current)) !== queryKey) {
        return;
      }
      this.resourcePopupStore.assetExplorePopupRef.set({
        ...current,
        loading: false,
        error: null,
        cards: sortedCards.map(card => this.cloneAsset(card))
      });
    } catch {
      const current = this.resourcePopupStore.assetExplorePopupRef();
      if (!current || requestVersion !== this.pendingAssetExploreRequestVersion) {
        return;
      }
      this.resourcePopupStore.assetExplorePopupRef.set({
        ...current,
        loading: false,
        error: current.cards.length > 0 ? null : 'Unable to load visible assets right now.'
      });
    }
  }

  private resolveAssetExplorePopupState(
    popup: Pick<AssetExplorePopupState, 'subEventId' | 'type' | 'category' | 'startAtIso' | 'endAtIso'>
  ): AssetExplorePopupState {
    const cachedCards = this.peekAssetExploreWarmCache(this.assetExploreQueryFromPopup(popup));
    return {
      ...popup,
      loading: cachedCards === null,
      error: null,
      cards: cachedCards ?? []
    };
  }

  private scheduleAssetExploreCardsLoad(): void {
    if (this.assetExploreLoadScheduled) {
      return;
    }
    this.assetExploreLoadScheduled = true;
    this.runAfterAssetExploreNextPaint(() => {
      this.assetExploreLoadScheduled = false;
      if (!this.resourcePopupStore.assetExplorePopupRef()) {
        return;
      }
      void this.loadAssetExploreCards();
    });
  }

  private scheduleAssetExploreWarmup(
    type: AppConstants.AssetType = this.resourcePopupStore.resourceFilterRef(),
    context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()
  ): void {
    if (!context) {
      return;
    }
    const userId = this.activeUser().id.trim();
    if (!userId) {
      return;
    }
    const { startAtIso, endAtIso } = this.defaultAssetExploreRange(context.subEvent);
    const query: AppDTOs.AssetExploreQueryDTO = {
      userId,
      type,
      category: AssetDefaultsBuilder.defaultCategory(type),
      startAtIso,
      endAtIso
    };
    this.runAfterAssetExploreNextPaint(() => {
      void this.prewarmAssetExploreQuery(query);
    });
  }

  private async prewarmAssetExploreQuery(query: AppDTOs.AssetExploreQueryDTO): Promise<void> {
    const queryKey = this.assetExploreQueryKey(query);
    if (this.assetExploreWarmCacheByKey.has(queryKey) || this.pendingAssetExploreWarmupKeys.has(queryKey)) {
      return;
    }
    this.pendingAssetExploreWarmupKeys.add(queryKey);
    try {
      const cards = await this.assetsService.queryVisibleAssets(query);
      this.storeAssetExploreWarmCache(queryKey, this.sortAssetExploreCards(cards, query.startAtIso ?? '', query.endAtIso ?? ''));
    } catch {
      // Keep warm-up best-effort so the popup still opens immediately.
    } finally {
      this.pendingAssetExploreWarmupKeys.delete(queryKey);
    }
  }

  private assetExploreQueryFromPopup(
    popup: Pick<AssetExplorePopupState, 'type' | 'category' | 'startAtIso' | 'endAtIso'>
  ): AppDTOs.AssetExploreQueryDTO {
    return {
      userId: this.activeUser().id,
      type: popup.type,
      category: popup.category,
      startAtIso: popup.startAtIso,
      endAtIso: popup.endAtIso
    };
  }

  private assetExploreQueryKey(query: AppDTOs.AssetExploreQueryDTO): string {
    return [
      query.userId.trim(),
      query.type,
      `${query.category ?? ''}`.trim(),
      `${query.startAtIso ?? ''}`.trim(),
      `${query.endAtIso ?? ''}`.trim()
    ].join('|');
  }

  private peekAssetExploreWarmCache(query: AppDTOs.AssetExploreQueryDTO): AppDTOs.AssetCardDTO[] | null {
    const cached = this.assetExploreWarmCacheByKey.get(this.assetExploreQueryKey(query));
    return cached ? cached.map(card => this.cloneAsset(card)) : null;
  }

  private storeAssetExploreWarmCache(queryKey: string, cards: readonly AppDTOs.AssetCardDTO[]): void {
    this.assetExploreWarmCacheByKey.set(queryKey, cards.map(card => this.cloneAsset(card)));
    if (this.assetExploreWarmCacheByKey.size <= 18) {
      return;
    }
    const oldestKey = this.assetExploreWarmCacheByKey.keys().next().value;
    if (oldestKey) {
      this.assetExploreWarmCacheByKey.delete(oldestKey);
    }
  }

  private sortAssetExploreCards(
    cards: readonly AppDTOs.AssetCardDTO[],
    startAtIso: string,
    endAtIso: string
  ): AppDTOs.AssetCardDTO[] {
    return cards
      .map(card => this.cloneAsset(card))
      .sort((left, right) => {
        const availabilityDelta = this.assetExploreAvailableQuantityForWindow(right, startAtIso, endAtIso)
          - this.assetExploreAvailableQuantityForWindow(left, startAtIso, endAtIso);
        if (availabilityDelta !== 0) {
          return availabilityDelta;
        }
        return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      });
  }

  private runAfterAssetExploreNextPaint(task: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(task));
      return;
    }
    setTimeout(task, 0);
  }

  assetExploreAvailabilityLabel(card: AppDTOs.AssetCardDTO): string {
    const available = this.assetExploreAvailableQuantity(card);
    if (available <= 0) {
      return '0 left';
    }
    return `${available} left`;
  }

  assetExploreAvailableQuantity(card: AppDTOs.AssetCardDTO): number {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return 0;
    }
    return this.assetExploreAvailableQuantityForWindow(card, popup.startAtIso, popup.endAtIso);
  }

  private assetExploreAvailableQuantityForWindow(
    card: AppDTOs.AssetCardDTO,
    startAtIso: string,
    endAtIso: string
  ): number {
    const totalQuantity = AssetCardBuilder.storedQuantityValue(card);
    const overlappingCommitted = card.requests
      .filter(request => request.status === 'accepted' || request.requestKind === 'manual')
      .filter(request => request.booking?.inventoryApplied !== true)
      .filter(request => this.isAssetExploreWindowOverlap(request, startAtIso, endAtIso))
      .reduce((sum, request) => sum + this.assetRequestQuantity(request), 0);
    const locallyReserved = this.assetExploreLocalReservedQuantity(card, startAtIso, endAtIso);
    return Math.max(0, totalQuantity - overlappingCommitted - locallyReserved);
  }

  private assetExploreLocalReservedQuantity(
    card: AppDTOs.AssetCardDTO,
    startAtIso: string,
    endAtIso: string
  ): number {
    const subEventId = `${this.resourcePopupStore.popupContextRef()?.subEvent.id ?? ''}`.trim();
    if (!subEventId) {
      return 0;
    }
    const reservationKey = this.assetExploreLocalReservationKey(subEventId, card.id);
    const reservation = this.localAssetExploreReservationsByKey.get(reservationKey);
    if (!reservation) {
      return 0;
    }
    return this.isAssetExploreRangeOverlap(reservation.startAtIso, reservation.endAtIso, startAtIso, endAtIso)
      ? reservation.quantity
      : 0;
  }

  private assetExploreLocalReservationKey(subEventId: string, assetId: string): string {
    return `${subEventId}:${assetId}`;
  }

  private rememberLocalAssetExploreReservation(
    subEventId: string,
    assetId: string,
    startAtIso: string,
    endAtIso: string,
    quantity: number
  ): void {
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedSubEventId || !normalizedAssetId) {
      return;
    }
    this.localAssetExploreReservationsByKey.set(
      this.assetExploreLocalReservationKey(normalizedSubEventId, normalizedAssetId),
      {
        startAtIso: startAtIso.trim(),
        endAtIso: endAtIso.trim(),
        quantity: Math.max(1, Math.trunc(Number(quantity) || 1))
      }
    );
  }

  private clearLocalAssetExploreReservation(subEventId: string, assetId: string): void {
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedSubEventId || !normalizedAssetId) {
      return;
    }
    this.localAssetExploreReservationsByKey.delete(this.assetExploreLocalReservationKey(normalizedSubEventId, normalizedAssetId));
  }

  openAssetExploreServiceChat(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    if (!context || !activeUserId) {
      return;
    }
    const chat = this.buildServiceChatItem({
      id: `c-service-asset-${card.id}-${context.subEvent.id}-${activeUserId}`,
      title: `Asset Service · ${card.title}`,
      lastMessage: `Service chat with the ${card.type.toLowerCase()} manager for ${card.title}.`,
      eventId: context.ownerId,
      subEventId: context.subEvent.id,
      memberIds: [activeUserId, ownerUserId].filter(Boolean),
      lastSenderId: ownerUserId || activeUserId,
      avatarSource: card.ownerName || card.title
    });
    this.activitiesStore.openEventChat(chat);
  }

  private buildServiceChatItem(input: {
    id: string;
    title: string;
    lastMessage: string;
    eventId: string;
    subEventId?: string;
    memberIds: string[];
    lastSenderId: string;
    avatarSource: string;
  }): ChatDTO & { ownerUserId?: string } {
    const activeUserId = this.activeUser().id.trim();
    return {
      id: input.id,
      avatar: AppUtils.initialsFromText(input.avatarSource || input.title),
      title: input.title,
      lastMessage: input.lastMessage,
      lastSenderId: input.lastSenderId || activeUserId,
      memberIds: [...new Set(input.memberIds.map(id => `${id ?? ''}`.trim()).filter(Boolean))],
      unread: 0,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: input.title.startsWith('Asset Service') ? 'asset' : 'event',
      eventId: input.eventId,
      subEventId: input.subEventId,
      ownerUserId: activeUserId
    };
  }

  openAssetExploreBorrowDialog(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!popup || !context) {
      return;
    }
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    if (!ownerUserId) {
      return;
    }
    const activeUserId = this.activeUser().id.trim();
    const draft = this.readAssetExploreBorrowDraft(activeUserId, context.subEvent.id, card.id);
    const existingRequest = this.findPendingAssetExploreBorrowRequest(card, context.subEvent.id);
    const startAtIso = `${draft?.startAtIso ?? existingRequest?.booking?.startAtIso ?? popup.startAtIso}`.trim() || popup.startAtIso;
    const endAtIso = `${draft?.endAtIso ?? existingRequest?.booking?.endAtIso ?? popup.endAtIso}`.trim() || popup.endAtIso;
    const availableQuantity = this.assetExploreAvailableQuantityForWindow(card, startAtIso, endAtIso);
    const requestedQuantity = Math.max(1, Math.trunc(Number(draft?.quantity ?? existingRequest?.booking?.quantity) || 1));
    const validPolicyIds = new Set((card.policies ?? []).map(policy => policy.id));
    if (popup.error) {
      this.resourcePopupStore.assetExplorePopupRef.set({
        ...popup,
        error: null
      });
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      cardId: card.id,
      ownerUserId,
      quantity: AppUtils.clampNumber(requestedQuantity, 1, Math.max(1, availableQuantity)),
      startAtIso,
      endAtIso,
      availableQuantity,
      acceptedPolicyIds: [...(draft?.acceptedPolicyIds ?? existingRequest?.booking?.acceptedPolicyIds ?? [])]
        .filter(policyId => validPolicyIds.has(policyId)),
      checkoutSessionId: `${draft?.checkoutSessionId ?? ''}`.trim() || null,
      paymentStep: Boolean(draft?.paymentStep),
      busy: false,
      error: this.assetExploreBorrowAvailabilityError(requestedQuantity, availableQuantity)
    });
  }

  closeAssetExploreBorrowDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (dialog && context && !dialog.busy && this.shouldPersistAssetExploreBorrowDraft(dialog, context.subEvent.id, activeUserId)) {
      this.saveAssetExploreBorrowDraft(activeUserId, context.subEvent.id, dialog);
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
  }

  setAssetExploreBorrowDateRange(start: Date | null, end: Date | null): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog) {
      return;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      return;
    }
    const startAtIso = AppUtils.applyDatePartToIsoLocal(dialog.startAtIso, start);
    const endAtIso = AppUtils.applyDatePartToIsoLocal(dialog.endAtIso, end);
    const availableQuantity = this.assetExploreAvailableQuantityForWindow(card, startAtIso, endAtIso);
    const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  setAssetExploreBorrowTime(edge: 'start' | 'end', value: string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog) {
      return;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      return;
    }
    const startAtIso = edge === 'start' ? AppUtils.applyTimePartToIsoLocal(dialog.startAtIso, value) : dialog.startAtIso;
    const endAtIso = edge === 'end' ? AppUtils.applyTimePartToIsoLocal(dialog.endAtIso, value) : dialog.endAtIso;
    const availableQuantity = this.assetExploreAvailableQuantityForWindow(card, startAtIso, endAtIso);
    const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  onAssetExploreBorrowQuantityChange(value: number | string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
    const requestedQuantity = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
      1,
      Number.MAX_SAFE_INTEGER
    );
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity: requestedQuantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(requestedQuantity, dialog.availableQuantity)
    });
  }

  normalizeAssetExploreBorrowQuantityOnBlur(value: number | string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
    const normalizedQuantity = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
      1,
      Math.max(1, dialog.availableQuantity)
    );
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity: normalizedQuantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(normalizedQuantity, dialog.availableQuantity)
    });
  }

  toggleAssetExploreBorrowPolicy(policyId: string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const normalizedPolicyId = `${policyId ?? ''}`.trim();
    if (!normalizedPolicyId) {
      return;
    }
    const nextAccepted = new Set(dialog.acceptedPolicyIds);
    if (nextAccepted.has(normalizedPolicyId)) {
      nextAccepted.delete(normalizedPolicyId);
    } else {
      nextAccepted.add(normalizedPolicyId);
    }
    const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  backAssetExploreBorrowToDetails(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy || !dialog.paymentStep) {
      return;
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...dialog,
      paymentStep: false,
      error: null
    });
  }

  private invalidateAssetExploreBorrowCheckout(
    dialog: AssetExploreBorrowDialogState
  ): AssetExploreBorrowDialogState {
    if (!dialog.paymentStep && !dialog.checkoutSessionId) {
      return dialog;
    }
    return {
      ...dialog,
      checkoutSessionId: null,
      paymentStep: false
    };
  }

  canSubmitAssetExploreBorrow(): boolean {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy || dialog.availableQuantity <= 0 || dialog.quantity > dialog.availableQuantity) {
      return false;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      return false;
    }
    const acceptedPolicyIds = new Set(dialog.acceptedPolicyIds);
    const missingRequiredPolicy = (card.policies ?? [])
      .some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
    if (missingRequiredPolicy) {
      return false;
    }
    return this.isValidAssetExploreWindow(dialog.startAtIso, dialog.endAtIso);
  }

  private assetExploreBorrowAvailabilityError(
    requestedQuantity: number,
    availableQuantity: number
  ): string | null {
    if (availableQuantity <= 0) {
      return 'This asset is no longer available for the selected date range.';
    }
    if (requestedQuantity > availableQuantity) {
      return availableQuantity === 1
        ? 'Only 1 item is still available for the selected date range.'
        : `Only ${availableQuantity} items are still available for the selected date range.`;
    }
    return null;
  }

  confirmAssetExploreBorrow(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !popup || !context) {
      return;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      this.resourcePopupStore.assetExplorePopupRef.set({
        ...popup,
        error: 'This basket item is no longer available for the selected date range.'
      });
      this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
      return;
    }
    const availableQuantity = this.assetExploreAvailableQuantityForWindow(card, dialog.startAtIso, dialog.endAtIso);
    const availabilityError = this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity);
    if (availabilityError) {
      const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
      this.resourcePopupStore.assetExploreBorrowDialogRef.set({
        ...invalidated,
        availableQuantity,
        quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
        acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
        error: availabilityError
      });
      return;
    }
    if (!this.canSubmitAssetExploreBorrow()) {
      return;
    }
    const activeUser = this.activeUser();
    const existingRequest = this.findPendingAssetExploreBorrowRequest(card, context.subEvent.id, activeUser.id);
    const requestVersion = ++this.pendingAssetExploreBorrowRequestVersion;
    const pricing = this.resolveAssetExploreBorrowPricing(card, dialog.startAtIso, dialog.endAtIso, dialog.quantity);
    const inventoryApplied = pricing.amount > 0;
    const lineItems: ActivityContracts.EventCheckoutLineItem[] = [
      {
        id: `resource:${card.id}`,
        kind: 'resource',
        label: card.title,
        detail: dialog.quantity > 1
          ? `${this.assetRequestTimeframeLabel(dialog.startAtIso, dialog.endAtIso)} · Qty ${dialog.quantity}`
          : this.assetRequestTimeframeLabel(dialog.startAtIso, dialog.endAtIso) || 'Borrow request',
        amount: pricing.amount,
        currency: pricing.currency
      }
    ];
    const checkoutRequest = inventoryApplied
      ? {
          userId: activeUser.id,
          sourceId: card.id,
          slotSourceId: null,
          optionalSubEventIds: [],
          assetSelections: [
            {
              subEventId: context.subEvent.id,
              resourceType: card.type
            }
          ],
          acceptedPolicyIds: [...dialog.acceptedPolicyIds],
          lineItems,
          totalAmount: pricing.amount,
          currency: pricing.currency
        } satisfies ActivityContracts.EventCheckoutRequest
      : null;

    if (inventoryApplied && !dialog.paymentStep) {
      this.resourcePopupStore.assetExploreBorrowDialogRef.set({
        ...dialog,
        busy: true,
        error: null
      });
      void this.eventsService.createCheckoutSession(checkoutRequest!)
        .then(session => {
          if (!session?.id) {
            throw new Error('Unable to start checkout.');
          }
          const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
          if (!currentDialog || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
            return;
          }
          const nextDialog: AssetExploreBorrowDialogState = {
            ...currentDialog,
            checkoutSessionId: session.id,
            paymentStep: true,
            busy: false,
            error: null
          };
          this.resourcePopupStore.assetExploreBorrowDialogRef.set(nextDialog);
          this.saveAssetExploreBorrowDraft(activeUser.id, context.subEvent.id, nextDialog);
        })
        .catch(error => {
          const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
          if (!currentDialog || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
            return;
          }
          this.resourcePopupStore.assetExploreBorrowDialogRef.set({
            ...currentDialog,
            busy: false,
            error: this.resolveAssetExploreBorrowErrorMessage(error, 'Unable to start checkout.')
          });
        });
      return;
    }

    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...dialog,
      busy: true,
      error: null
    });
    const checkoutSessionPromise = inventoryApplied && !dialog.checkoutSessionId
      ? this.eventsService.createCheckoutSession(checkoutRequest!)
      : Promise.resolve(dialog.checkoutSessionId ? {
          id: dialog.checkoutSessionId,
          provider: 'dummy',
          mode: 'dummy',
          status: 'approved',
          amount: pricing.amount,
          currency: pricing.currency,
          paymentUrl: null
        } satisfies ActivityContracts.EventCheckoutSession : null);

    void checkoutSessionPromise
      .then(async session => {
        if (inventoryApplied && (!session || !session.id)) {
          throw new Error('Unable to start payment.');
        }
        const nextRequest: AppDTOs.AssetMemberRequestDTO = {
          id: existingRequest?.id ?? `borrow:${activeUser.id}:${card.id}:${context.subEvent.id}`,
          userId: activeUser.id,
          name: activeUser.name,
          initials: activeUser.initials,
          gender: activeUser.gender,
          status: 'pending',
          note: pricing.amount > 0
            ? 'Payment approved. Awaiting owner confirmation.'
            : 'Awaiting owner confirmation.',
          requestKind: 'borrow',
          requestedAtIso: new Date().toISOString(),
          booking: this.assetRequestBookingForRange(
            context.subEvent,
            context.ownerId,
            context.parentTitle,
            dialog.startAtIso,
            dialog.endAtIso,
            dialog.quantity,
            {
              totalAmount: pricing.amount,
              currency: pricing.currency,
              acceptedPolicyIds: dialog.acceptedPolicyIds,
              paymentSessionId: session?.id ?? dialog.checkoutSessionId ?? null,
              inventoryApplied
            }
          )
        };
        const nextCard: AppDTOs.AssetCardDTO = {
          ...card,
          quantity: inventoryApplied
            ? Math.max(0, AssetCardBuilder.storedQuantityValue(card) - dialog.quantity)
            : AssetCardBuilder.storedQuantityValue(card),
          requests: [
            nextRequest,
            ...card.requests
              .filter(request => request.id !== nextRequest.id)
              .map(request => ({
                ...request,
                booking: request.booking
                  ? {
                      ...request.booking,
                      acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
                    }
                  : null
              }))
          ]
        };
        return this.assetsService.saveOwnedAsset(dialog.ownerUserId, nextCard);
      })
      .then(savedCard => {
        const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
        const currentPopup = this.resourcePopupStore.assetExplorePopupRef();
        if (!currentDialog || !currentPopup || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
          return;
        }
        this.clearAssetExploreBorrowDraftState(activeUser.id, context.subEvent.id, currentDialog.cardId);
        this.attachBoughtAssetToSubEventLocally(context, savedCard, currentDialog.quantity);
        if (inventoryApplied) {
          this.clearLocalAssetExploreReservation(context.subEvent.id, savedCard.id);
        } else {
          this.rememberLocalAssetExploreReservation(
            context.subEvent.id,
            savedCard.id,
            currentDialog.startAtIso,
            currentDialog.endAtIso,
            currentDialog.quantity
          );
        }
        const remainingAvailability = this.assetExploreAvailableQuantityForWindow(
          savedCard,
          currentDialog.startAtIso,
          currentDialog.endAtIso
        );
        const nextCards = remainingAvailability <= 0
          ? currentPopup.cards.filter(cardItem => cardItem.id !== savedCard.id)
          : currentPopup.cards.map(cardItem => cardItem.id === savedCard.id ? this.cloneAsset(savedCard) : cardItem);
        this.resourcePopupStore.assetExplorePopupRef.set({
          ...currentPopup,
          cards: nextCards
        });
        this.storeAssetExploreWarmCache(
          this.assetExploreQueryKey(this.assetExploreQueryFromPopup(currentPopup)),
          nextCards
        );
        this.closeAssetExploreBorrowDialog();
      })
      .catch(error => {
        const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
        if (!currentDialog || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
          return;
        }
        this.resourcePopupStore.assetExploreBorrowDialogRef.set({
          ...currentDialog,
          busy: false,
          error: this.resolveAssetExploreBorrowErrorMessage(error, 'Unable to send the borrow request.')
        });
      });
  }

  resumeAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.resolveAssetExploreCard(cardId);
    if (!card) {
      const popup = this.resourcePopupStore.assetExplorePopupRef();
      if (popup) {
        this.resourcePopupStore.assetExplorePopupRef.set({
          ...popup,
          error: 'This basket item is no longer available for the selected date range.'
        });
      }
      return;
    }
    this.openAssetExploreBorrowDialog(card, event);
  }

  clearAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    this.clearAssetExploreBorrowDraftState(activeUserId, context.subEvent.id, cardId);
    if (this.resourcePopupStore.assetExploreBorrowDialogRef()?.cardId === cardId) {
      this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    }
  }

  listAssetExploreBorrowDrafts(
    userId: string,
    subEventId: string
  ): AssetExploreBorrowDraftState[] {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedUserId || !normalizedSubEventId) {
      return [];
    }
    return Object.values(this.resourcePopupStore.assetExploreBorrowDraftsRef())
      .filter(draft => draft.userId === normalizedUserId && draft.subEventId === normalizedSubEventId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  private readAssetExploreBorrowDraft(
    userId: string,
    subEventId: string,
    cardId: string
  ): AssetExploreBorrowDraftState | null {
    const key = this.assetExploreBorrowDraftKey(userId, subEventId, cardId);
    return key ? this.resourcePopupStore.assetExploreBorrowDraftsRef()[key] ?? null : null;
  }

  private saveAssetExploreBorrowDraft(
    userId: string,
    subEventId: string,
    dialog: AssetExploreBorrowDialogState
  ): void {
    const key = this.assetExploreBorrowDraftKey(userId, subEventId, dialog.cardId);
    if (!key) {
      return;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    const next: AssetExploreBorrowDraftState = {
      userId: userId.trim(),
      subEventId: subEventId.trim(),
      cardId: dialog.cardId,
      ownerUserId: dialog.ownerUserId,
      title: card?.title?.trim() || 'Borrow draft',
      quantity: Math.max(1, Math.trunc(Number(dialog.quantity) || 1)),
      startAtIso: dialog.startAtIso,
      endAtIso: dialog.endAtIso,
      acceptedPolicyIds: [...new Set(dialog.acceptedPolicyIds)].map(item => item.trim()).filter(Boolean),
      checkoutSessionId: dialog.checkoutSessionId?.trim() || null,
      paymentStep: dialog.paymentStep,
      updatedAtMs: Date.now()
    };
    this.resourcePopupStore.assetExploreBorrowDraftsRef.set({
      ...this.resourcePopupStore.assetExploreBorrowDraftsRef(),
      [key]: next
    });
  }

  private clearAssetExploreBorrowDraftState(
    userId: string,
    subEventId: string,
    cardId: string
  ): void {
    const key = this.assetExploreBorrowDraftKey(userId, subEventId, cardId);
    if (!key || !this.resourcePopupStore.assetExploreBorrowDraftsRef()[key]) {
      return;
    }
    const next = { ...this.resourcePopupStore.assetExploreBorrowDraftsRef() };
    delete next[key];
    this.resourcePopupStore.assetExploreBorrowDraftsRef.set(next);
  }

  private shouldPersistAssetExploreBorrowDraft(
    dialog: AssetExploreBorrowDialogState,
    subEventId: string,
    userId: string
  ): boolean {
    return Boolean(
      dialog.checkoutSessionId
      || dialog.paymentStep
      || this.readAssetExploreBorrowDraft(userId, subEventId, dialog.cardId)
    );
  }

  private assetExploreBorrowDraftKey(
    userId: string,
    subEventId: string,
    cardId: string
  ): string {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    const normalizedCardId = cardId.trim();
    if (!normalizedUserId || !normalizedSubEventId || !normalizedCardId) {
      return '';
    }
    return `${normalizedUserId}::${normalizedSubEventId}::${normalizedCardId}`;
  }

  resourceFilterCount(type: AppConstants.AssetType): number {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return 0;
    }
    return this.subEventAssetCapacityMetrics(context.subEvent, type).pending;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppConstants.AssetType): AppDTOs.AssetCardDTO[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(id => this.resolveSubEventAssignedAssetCard(subEventId, type, id))
      .filter((card): card is AppDTOs.AssetCardDTO => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppConstants.AssetType): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
    for (const assetId of assignedIds) {
      const source = this.resolveSubEventAssignedAssetCard(subEventId, type, assetId);
      if (!source) {
        continue;
      }
      const previous = existing[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      next[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(type, previous?.routes)
      };
    }
    this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = [
      ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
      ...this.subEventFallbackAssetCards(subEventId, type).map(card => card.id)
    ];
    const eligible = new Set(eligibleIds);
    const stored = this.resourcePopupStore.assignedAssetIdsByKey[key];
    if (!stored) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [];
      return [];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length !== stored.length) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private resolveSubEventAssignedAssetCard(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string
  ): AppDTOs.AssetCardDTO | null {
    return this.ownedAssetCards().find(card => card.id === assetId && card.type === type)
      ?? this.subEventFallbackAssetCards(subEventId, type).find(card => card.id === assetId && card.type === type)
      ?? null;
  }

  private subEventFallbackAssetCards(
    subEventId: string,
    type: AppConstants.AssetType
  ): AppDTOs.AssetCardDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (context?.subEvent.id !== subEventId) {
      return [];
    }
    return context.fallbackCardsByType[type] ?? [];
  }

  private seedAssignmentsFromRequest(
    subEventId: string,
    assetAssignmentIds: Partial<Record<AppConstants.AssetType, string[]>> | undefined,
    fallbackCardsByType: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>>
  ): void {
    if (!subEventId || !assetAssignmentIds) {
      return;
    }
    const types: AppConstants.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const raw = assetAssignmentIds[type];
      if (!Array.isArray(raw)) {
        continue;
      }
      const allowedIds = new Set([
        ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
        ...(fallbackCardsByType[type] ?? []).map(card => card.id)
      ]);
      const normalized = raw.filter((id, index, arr): id is string =>
        typeof id === 'string' && arr.indexOf(id) === index && allowedIds.has(id)
      );
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEventId, type)] = [...normalized];
    }
  }

  private subEventAssetCapacityMetrics(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = type === 'Supplies'
      ? 0
      : cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'pending')
      ), 0);
    if (type === 'Supplies') {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    return {
      joined: cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'accepted')
      ), 0),
      capacityMin,
      capacityMax,
      pending
    };
  }

  private syncPopupSubEventMetrics(options: boolean | { persistResourceState?: boolean; persistAssetRequests?: boolean } = false): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const persistResourceState = typeof options === 'boolean' ? options : options.persistResourceState === true;
    const persistAssetRequests = typeof options === 'boolean' ? options : options.persistAssetRequests === true;
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.subEventAssetCapacityMetrics(nextSubEvent, 'Car');
    const accommodation = this.subEventAssetCapacityMetrics(nextSubEvent, 'Accommodation');
    const supplies = this.subEventAssetCapacityMetrics(nextSubEvent, 'Supplies');
    nextSubEvent.carsAccepted = cars.joined;
    nextSubEvent.carsPending = cars.pending;
    nextSubEvent.carsCapacityMin = cars.capacityMin;
    nextSubEvent.carsCapacityMax = cars.capacityMax;
    nextSubEvent.accommodationAccepted = accommodation.joined;
    nextSubEvent.accommodationPending = accommodation.pending;
    nextSubEvent.accommodationCapacityMin = accommodation.capacityMin;
    nextSubEvent.accommodationCapacityMax = accommodation.capacityMax;
    nextSubEvent.suppliesAccepted = supplies.joined;
    nextSubEvent.suppliesPending = supplies.pending;
    nextSubEvent.suppliesCapacityMin = supplies.capacityMin;
    nextSubEvent.suppliesCapacityMax = supplies.capacityMax;
    this.resourcePopupStore.popupContextRef.set({
      ...context,
      subEvent: nextSubEvent
    });
    this.syncSubEventManualAssetRequests(nextSubEvent, persistAssetRequests);
    if (persistResourceState) {
      this.persistPopupResourceState({
        ...context,
        subEvent: nextSubEvent
      });
    }
  }

  private syncAssetRequestsFromMembers(
    assetId: string,
    assetType: AppConstants.AssetType,
    members: readonly ActivityContracts.ActivityMemberEntry[]
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    const asset = this.ownedAssetCards().find(card => card.id === assetId && card.type === assetType)
      ?? (context ? this.subEventFallbackAssetCards(context.subEvent.id, assetType).find(card => card.id === assetId) ?? null : null);
    if (!asset) {
      return;
    }
    const isOwnedAsset = this.ownedAssetCards().some(card => card.id === asset.id && card.type === assetType);
    const existingById = new Map(asset.requests.map(request => [request.id, request] as const));
    const existingByUserId = new Map(
      asset.requests.map(request => [AppUtils.resolveAssetRequestUserId(request, this.users), request] as const)
    );
    const existingByName = new Map(asset.requests.map(request => [request.name.toLowerCase(), request] as const));
    const now = Date.now();
    const booking = this.currentAssetRequestBooking(1);
    const syncableMembers = members.filter(entry => entry.status === 'accepted' || entry.status === 'pending');
    const memberRequests: AppDTOs.AssetMemberRequestDTO[] = syncableMembers.map((entry, index) => {
      const existing =
        existingById.get(entry.id)
        ?? existingByUserId.get(entry.userId)
        ?? existingByName.get(entry.name.toLowerCase())
        ?? null;
      const requestId = existing?.id ?? (entry.id.trim() || `asset-member-${now}-${index}`);
      const note = entry.status !== 'pending'
        ? (existing?.note ?? 'Accepted for this asset.')
        : (entry.pendingSource === 'admin'
          ? 'Waiting for event admin approval.'
          : 'Waiting for owner approval.');
      const requestStatus: AppConstants.AssetRequestStatus = entry.status === 'pending' ? 'pending' : 'accepted';
      return {
        id: requestId,
        userId: entry.userId,
        name: entry.name,
        initials: entry.initials,
        gender: entry.gender,
        status: requestStatus,
        note,
        requestKind: existing?.requestKind ?? (isOwnedAsset ? 'borrow' : 'manual'),
        requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
        booking: existing?.booking
          ? {
              ...existing.booking,
              acceptedPolicyIds: [...(existing.booking.acceptedPolicyIds ?? [])]
            }
          : booking
      };
    });
    const manualRequests = isOwnedAsset
      ? asset.requests
        .filter(request => request.requestKind === 'manual')
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }))
      : [];
    const nextRequests: AppDTOs.AssetMemberRequestDTO[] = [...manualRequests, ...memberRequests];
    const currentSignature = JSON.stringify(asset.requests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    const nextSignature = JSON.stringify(nextRequests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    if (currentSignature === nextSignature) {
      return;
    }
    if (!isOwnedAsset) {
      if (!context) {
        return;
      }
      const activeContext = this.resourcePopupStore.popupContextRef();
      if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
        return;
      }
      const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
      const nextCards = nextFallbackCards[assetType] ?? [];
      const nextAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
        ...asset,
        requests: nextRequests
      });
      nextFallbackCards[assetType] = nextCards.some(card => card.id === assetId)
        ? nextCards.map(card => card.id === assetId ? nextAsset : card)
        : [...nextCards, nextAsset];
      const nextContext = {
        ...activeContext,
        fallbackCardsByType: nextFallbackCards
      };
      this.resourcePopupStore.popupContextRef.set(nextContext);
      this.syncPopupSubEventMetrics(false);
      this.persistPopupResourceState(nextContext);
      return;
    }
    this.ownedAssets.applyAssetCards(this.ownedAssetCards().map(card =>
      card.id === asset.id && card.type === asset.type
        ? { ...card, requests: nextRequests }
        : card
    ), { persist: true, reloadList: false });
    this.syncPopupSubEventMetrics();
  }

  private currentAssetRequestBooking(quantity: number): AppDTOs.AssetHireRequestBookingDTO | null {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return null;
    }
    const startAtIso = `${context.subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${context.subEvent.endAt ?? ''}`.trim();
    return this.assetRequestBookingForRange(
      context.subEvent,
      context.ownerId,
      context.parentTitle,
      startAtIso,
      endAtIso,
      quantity
    );
  }

  private assetRequestBookingForSubEvent(
    subEvent: ContractTypes.SubEventDTO,
    quantity: number,
    ownerId: string,
    parentTitle: string
  ): AppDTOs.AssetHireRequestBookingDTO | null {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    return this.assetRequestBookingForRange(subEvent, ownerId, parentTitle, startAtIso, endAtIso, quantity);
  }

  private assetRequestBookingForRange(
    subEvent: ContractTypes.SubEventDTO,
    ownerId: string,
    parentTitle: string,
    startAtIso: string,
    endAtIso: string,
    quantity: number,
    options: {
      totalAmount?: number | null;
      currency?: string | null;
      acceptedPolicyIds?: string[];
      paymentSessionId?: string | null;
      inventoryApplied?: boolean | null;
    } = {}
  ): AppDTOs.AssetHireRequestBookingDTO | null {
    return {
      eventId: ownerId,
      eventTitle: parentTitle,
      subEventId: subEvent.id,
      subEventTitle: subEvent.name,
      slotKey: subEvent.id,
      slotLabel: subEvent.name,
      timeframe: this.assetRequestTimeframeLabel(startAtIso, endAtIso),
      startAtIso: startAtIso || undefined,
      endAtIso: endAtIso || undefined,
      quantity,
      totalAmount: options.totalAmount ?? null,
      currency: options.currency ?? null,
      acceptedPolicyIds: [...(options.acceptedPolicyIds ?? [])],
      paymentSessionId: options.paymentSessionId ?? null,
      inventoryApplied: options.inventoryApplied === true ? true : null
    };
  }

  private syncSubEventManualAssetRequests(subEvent: ContractTypes.SubEventDTO, persist = false): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const activeUser = this.activeUser();
    let changed = false;
    const dirtyCards: AppDTOs.AssetCardDTO[] = [];
    const nextCards = this.ownedAssetCards().map(card => {
      const nextManualRequest = this.buildManualAssignmentRequest(card, subEvent, context.ownerId, context.parentTitle, activeUser);
      const preservedRequests: AppDTOs.AssetMemberRequestDTO[] = card.requests
        .filter(request => !ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id))
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }));
      if (nextManualRequest) {
        preservedRequests.unshift(nextManualRequest);
      }
      const sameRequests = preservedRequests.length === card.requests.length
        && preservedRequests.every((request, index) => ActivityResourceBuilder.assetRequestSyncSignature(request) === ActivityResourceBuilder.assetRequestSyncSignature(card.requests[index]));
      if (sameRequests) {
        return card;
      }
      changed = true;
      const nextCard = {
        ...card,
        requests: preservedRequests
      };
      dirtyCards.push(nextCard);
      return nextCard;
    });
    if (changed) {
      this.ownedAssets.applyAssetCards(nextCards, { persist });
      if (persist) {
        for (const dirtyCard of dirtyCards) {
          void this.assetsService.saveOwnedAsset(activeUser.id, dirtyCard);
        }
      }
    }
  }

  private buildManualAssignmentRequest(
    card: AppDTOs.AssetCardDTO,
    subEvent: ContractTypes.SubEventDTO,
    ownerId: string,
    parentTitle: string,
    activeUser: UserDto
  ): AppDTOs.AssetMemberRequestDTO | null {
    if (card.type === 'Supplies') {
      const assignedSupplyIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies'));
      if (!assignedSupplyIds.has(card.id)) {
        return null;
      }
      const settings = this.getSubEventAssignedAssetSettings(subEvent.id, 'Supplies')[card.id];
      const quantity = this.subEventSupplyProvidedCount(card.id, subEvent.id)
        || Math.max(0, Math.trunc(Number(settings?.capacityMax ?? card.capacityTotal) || 0));
      if (quantity <= 0) {
        return null;
      }
      const existing = card.requests.find(request => ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id)) ?? null;
      return {
        id: existing?.id ?? `manual:${subEvent.id}:${card.id}`,
        userId: activeUser.id,
        name: activeUser.name,
        initials: activeUser.initials,
        gender: activeUser.gender,
        status: 'accepted',
        note: 'Reserved and assigned by the owner.',
        requestKind: 'manual',
        requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
        booking: this.assetRequestBookingForSubEvent(subEvent, quantity, ownerId, parentTitle)
      };
    }
    if (card.type !== 'Car' && card.type !== 'Accommodation') {
      return null;
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, card.type));
    if (!assignedIds.has(card.id)) {
      return null;
    }
    const existing = card.requests.find(request => ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id)) ?? null;
    return {
      id: existing?.id ?? `manual:${subEvent.id}:${card.id}`,
      userId: activeUser.id,
      name: activeUser.name,
      initials: activeUser.initials,
      gender: activeUser.gender,
      status: 'accepted',
      note: 'Reserved and assigned by the owner.',
      requestKind: 'manual',
      requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
      booking: this.assetRequestBookingForSubEvent(subEvent, 1, ownerId, parentTitle)
    };
  }

  private assetRequestTimeframeLabel(startAtIso: string, endAtIso: string): string {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(endAtIso);
    if (!start || !end) {
      return '';
    }
    const sameDay = start.toDateString() === end.toDateString();
    const startDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return sameDay
      ? `${startDate} · ${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  private defaultAssetExploreRange(
    subEvent: ContractTypes.SubEventDTO
  ): { startAtIso: string; endAtIso: string } {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim() || AppUtils.toIsoDateTimeLocal(new Date());
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    if (endAtIso) {
      return {
        startAtIso,
        endAtIso
      };
    }
    const base = AppUtils.isoLocalDateTimeToDate(startAtIso) ?? new Date();
    const nextEnd = new Date(base);
    nextEnd.setHours(nextEnd.getHours() + 2);
    return {
      startAtIso,
      endAtIso: AppUtils.toIsoDateTimeLocal(nextEnd)
    };
  }

  private resolveAssetExploreCard(cardId: string): AppDTOs.AssetCardDTO | null {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return null;
    }
    return this.resourcePopupStore.assetExplorePopupRef()?.cards.find(card => card.id === normalizedCardId) ?? null;
  }

  private isValidAssetExploreWindow(startAtIso: string, endAtIso: string): boolean {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(endAtIso);
    return !!start && !!end && start.getTime() < end.getTime();
  }

  private resolveAssetExploreBorrowPricing(
    card: AppDTOs.AssetCardDTO,
    startAtIso: string,
    endAtIso: string,
    quantity: number
  ): AssetExploreBorrowPricingPreview {
    const normalized = PricingBuilder.compactPricingConfig(card.pricing, {
      context: 'asset',
      allowSlotFeatures: false
    });
    const currency = normalized.currency?.trim() || 'USD';
    if (!normalized.enabled) {
      return {
        amount: 0,
        currency
      };
    }

    const totalQuantity = Math.max(1, AssetCardBuilder.storedQuantityValue(card));
    const overlappingCommitted = card.requests
      .filter(request => request.status === 'accepted' || request.requestKind === 'manual')
      .filter(request => request.booking?.inventoryApplied !== true)
      .filter(request => this.isAssetExploreWindowOverlap(request, startAtIso, endAtIso))
      .reduce((sum, request) => sum + this.assetRequestQuantity(request), 0);
    const capacityFilledPercent = Math.round(
      (Math.min(totalQuantity, overlappingCommitted + Math.max(1, quantity)) / totalQuantity) * 100
    );
    const hoursUntilStart = this.resolveHoursUntilStart(startAtIso);

    let nextPrice = normalized.basePrice;
    if ((normalized.mode === 'demand-based' || normalized.mode === 'hybrid') && normalized.demandRulesEnabled) {
      for (const rule of normalized.demandRules) {
        if (!this.matchesPricingDemandRule(rule, capacityFilledPercent)) {
          continue;
        }
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
      }
    }
    if ((normalized.mode === 'time-based' || normalized.mode === 'hybrid') && normalized.timeRulesEnabled) {
      for (const rule of normalized.timeRules) {
        if (!this.matchesPricingTimeRule(rule, hoursUntilStart, startAtIso)) {
          continue;
        }
        nextPrice = this.applyPricingAction(nextPrice, rule.action);
      }
    }

    if (normalized.minPrice !== null) {
      nextPrice = Math.max(normalized.minPrice, nextPrice);
    }
    if (normalized.maxPrice !== null) {
      nextPrice = Math.min(normalized.maxPrice, nextPrice);
    }

    const roundedUnitPrice = this.applyPricingRounding(nextPrice, normalized.rounding);
    const multiplier = normalized.chargeType === 'per_attendee'
      ? Math.max(1, Math.trunc(Number(quantity) || 1))
      : 1;
    return {
      amount: Math.round(roundedUnitPrice * multiplier * 100) / 100,
      currency
    };
  }

  private matchesPricingDemandRule(
    rule: ContractTypes.PricingDemandRule,
    capacityFilledPercent: number
  ): boolean {
    if (rule.operator === 'lte') {
      return capacityFilledPercent <= rule.capacityFilledPercent;
    }
    return capacityFilledPercent >= rule.capacityFilledPercent;
  }

  private matchesPricingTimeRule(
    rule: ContractTypes.PricingTimeRule,
    hoursUntilStart: number,
    comparisonIso: string
  ): boolean {
    if (rule.trigger === 'specific_date') {
      const start = `${rule.specificDateStart ?? ''}`.trim();
      const end = `${rule.specificDateEnd ?? ''}`.trim();
      if (!start || !end || !comparisonIso) {
        return false;
      }
      const comparisonDate = comparisonIso.slice(0, 10);
      return comparisonDate >= start && comparisonDate <= end;
    }
    if (rule.trigger === 'hours_before_start') {
      return hoursUntilStart <= Math.max(0, Number(rule.offsetValue) || 0);
    }
    const dayWindowHours = Math.max(0, Number(rule.offsetValue) || 0) * 24;
    return hoursUntilStart <= dayWindowHours;
  }

  private applyPricingAction(currentPrice: number, action: ContractTypes.PricingAction): number {
    const value = Number(action.value) || 0;
    if (action.kind === 'set_exact_price') {
      return Math.max(0, value);
    }
    const percent = value / 100;
    if (action.kind === 'decrease_percent') {
      return Math.max(0, currentPrice * (1 - percent));
    }
    return Math.max(0, currentPrice * (1 + percent));
  }

  private applyPricingRounding(price: number, rounding: AppConstants.PricingRoundingMode): number {
    if (rounding === 'whole') {
      return Math.round(price);
    }
    if (rounding === 'half') {
      return Math.round(price * 2) / 2;
    }
    return Math.round(price * 100) / 100;
  }

  private resolveHoursUntilStart(startAtIso: string): number {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    if (!start) {
      return 0;
    }
    return Math.max(0, Math.round((start.getTime() - Date.now()) / (60 * 60 * 1000)));
  }

  private resolveAssetExploreBorrowErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return fallback;
  }

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }

  private isAssetExploreWindowOverlap(
    request: AppDTOs.AssetMemberRequestDTO,
    startAtIso: string,
    endAtIso: string
  ): boolean {
    const requestStart = this.parseLocalDateMs(request.booking?.startAtIso);
    const requestEnd = this.parseLocalDateMs(request.booking?.endAtIso);
    const windowStart = this.parseLocalDateMs(startAtIso);
    const windowEnd = this.parseLocalDateMs(endAtIso);
    if (requestStart !== null && requestEnd !== null && windowStart !== null && windowEnd !== null) {
      return requestStart < windowEnd && windowStart < requestEnd;
    }
    const requestWindow = [
      `${request.booking?.eventId ?? ''}`.trim(),
      `${request.booking?.subEventId ?? ''}`.trim(),
      `${request.booking?.slotKey ?? ''}`.trim(),
      `${request.booking?.timeframe ?? ''}`.trim()
    ].filter(Boolean).join('|');
    const targetWindow = [startAtIso.trim(), endAtIso.trim()].filter(Boolean).join('|');
    if (requestWindow && targetWindow) {
      return requestWindow === targetWindow;
    }
    return true;
  }

  private isAssetExploreRangeOverlap(
    leftStartAtIso: string,
    leftEndAtIso: string,
    rightStartAtIso: string,
    rightEndAtIso: string
  ): boolean {
    const leftStart = this.parseLocalDateMs(leftStartAtIso);
    const leftEnd = this.parseLocalDateMs(leftEndAtIso);
    const rightStart = this.parseLocalDateMs(rightStartAtIso);
    const rightEnd = this.parseLocalDateMs(rightEndAtIso);
    if (leftStart !== null && leftEnd !== null && rightStart !== null && rightEnd !== null) {
      return leftStart < rightEnd && rightStart < leftEnd;
    }
    const leftWindow = [leftStartAtIso.trim(), leftEndAtIso.trim()].filter(Boolean).join('|');
    const rightWindow = [rightStartAtIso.trim(), rightEndAtIso.trim()].filter(Boolean).join('|');
    if (leftWindow && rightWindow) {
      return leftWindow === rightWindow;
    }
    return true;
  }

  private parseLocalDateMs(value: string | null | undefined): number | null {
    const parsed = AppUtils.isoLocalDateTimeToDate(`${value ?? ''}`.trim());
    return parsed ? parsed.getTime() : null;
  }

  private assetMemberEntries(
    card: AppDTOs.AssetCardDTO,
    ownerUserId: string | null,
    subEventId?: string
  ): ActivityContracts.ActivityMemberEntry[] {
    const seedBaseDate = new Date('2026-02-24T12:00:00');
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, ownerUserId)
      : [...card.requests];
    void this.usersService.warmCachedUsers(requests
      .map(request => AppUtils.resolveAssetRequestUserId(request, this.users))
      .filter(userId => `${userId}`.trim().length > 0));
    return requests
      .map(request => {
        const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.users);
        const matchedUser =
          this.users.find(user => user.id === requestUserId)
          ?? this.users.find(user => user.name === request.name && user.initials === request.initials)
          ?? this.users.find(user => user.name === request.name)
          ?? null;
        const userId = matchedUser?.id ?? requestUserId;
        const note = `${request.note ?? ''}`.toLowerCase();
        const pendingRequiresAdminApproval = request.status === 'pending'
          && !note.includes('owner approval')
          && !note.includes('join request');
        const pendingSource: AppConstants.ActivityPendingSource = request.status === 'pending'
          ? (pendingRequiresAdminApproval ? 'admin' : 'member')
          : null;
        const requestKind: AppConstants.ActivityMemberRequestKind = request.status === 'pending'
          ? (pendingRequiresAdminApproval ? 'invite' : 'join')
          : null;
        const seed = AppUtils.hashText(`asset-members:${card.id}:${request.id}:${userId}`);
        const actionAtIso = AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -((seed % 90) + 1)));
        return {
          id: request.id,
          userId,
          name: request.name,
          initials: request.initials,
          gender: request.gender,
          city: matchedUser?.city ?? card.city,
          statusText: request.note,
          role: ownerUserId && userId === ownerUserId ? ('Manager' as const) : ('Member' as const),
          status: request.status,
          pendingSource,
          requestKind,
          invitedByActiveUser: userId === this.activeUser().id,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: card.title,
          avatarUrl: AppUtils.firstImageUrl(matchedUser?.images),
          profile: matchedUser ?? null
        };
      })
      .sort((left, right) => AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso));
  }

  private createFallbackUser(userId: string): UserDto {
    return {
      id: userId.trim(),
      name: 'User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: 'U',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0
      }
    };
  }

  private handleOwnedAssetDeleted(cardId: string): void {
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.endsWith(`:${cardId}`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const key of Object.keys(this.resourcePopupStore.assignedAssetIdsByKey)) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = this.resourcePopupStore.assignedAssetIdsByKey[key].filter(id => id !== cardId);
    }
    for (const key of Object.keys(this.resourcePopupStore.assignedAssetSettingsByKey)) {
      if (!this.resourcePopupStore.assignedAssetSettingsByKey[key][cardId]) {
        continue;
      }
      const next = { ...this.resourcePopupStore.assignedAssetSettingsByKey[key] };
      delete next[cardId];
      this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    }
    const supplyContext = this.resourcePopupStore.supplyPopupRef();
    if (supplyContext?.assetId === cardId) {
      this.resourcePopupStore.supplyPopupRef.set(null);
      this.resourcePopupStore.pendingSupplyDeleteRef.set(null);
      this.resourcePopupStore.bringDialogRef.set(null);
    }
    this.syncPopupSubEventMetrics();
  }

  private handleOwnedAssetsChanged(): void {
    this.syncPopupSubEventMetrics();
  }

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent,
      pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : undefined,
      groups: Array.isArray(subEvent.groups)
        ? subEvent.groups.map(group => ({ ...group }))
        : []
    };
  }

  private cloneAsset(card: AppDTOs.AssetCardDTO): AppDTOs.AssetCardDTO {
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

  private findPendingAssetExploreBorrowRequest(
    card: AppDTOs.AssetCardDTO,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppDTOs.AssetMemberRequestDTO | null {
    return card.requests.find(request =>
      request.requestKind !== 'manual'
      && request.status === 'pending'
      && AppUtils.resolveAssetRequestUserId(request, this.users) === activeUserId
      && request.booking?.subEventId === subEventId
    ) ?? null;
  }

  private cloneFallbackCards(
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>>
  ): Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = fallbackCardsByType?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneAsset(card));
    }
    return next;
  }

  private mergePersistedFallbackCards(
    current: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> | undefined,
    persisted: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> | undefined,
    subEventId: string
  ): Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> {
    const next = this.cloneFallbackCards(current);
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = persisted?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      const nextById = new Map((next[type] ?? []).map(card => [card.id, this.cloneAsset(card)] as const));
      for (const card of cards) {
        nextById.set(card.id, this.assignedFallbackAssetSnapshot(subEventId, card));
      }
      next[type] = [...nextById.values()];
    }
    return next;
  }

  private persistedAssignedFallbackCards(
    context: ResourcePopupContext,
    type: AppConstants.AssetType
  ): AppDTOs.AssetCardDTO[] {
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEvent.id, type));
    const ownedIds = new Set(this.ownedAssetCards().filter(card => card.type === type).map(card => card.id));
    return (context.fallbackCardsByType[type] ?? [])
      .filter(card => assignedIds.has(card.id) && !ownedIds.has(card.id))
      .map(card => this.assignedFallbackAssetSnapshot(context.subEvent.id, card));
  }

  private assignedFallbackAssetSnapshot(
    subEventId: string,
    card: AppDTOs.AssetCardDTO,
    options: { clearRequests?: boolean } = {}
  ): AppDTOs.AssetCardDTO {
    const nextCard = this.cloneAsset(card);
    if (options.clearRequests) {
      return {
        ...nextCard,
        requests: []
      };
    }
    return {
      ...nextCard,
      requests: nextCard.requests.filter(request => this.isSubEventScopedAssetRequest(request, subEventId))
    };
  }

  private attachBoughtAssetToSubEventLocally(
    context: ResourcePopupContext,
    card: AppDTOs.AssetCardDTO,
    quantity: number
  ): void {
    const key = this.subEventAssetAssignmentKey(context.subEvent.id, card.type);
    const currentIds = this.resourcePopupStore.assignedAssetIdsByKey[key] ?? [];
    if (!currentIds.includes(card.id)) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [...currentIds, card.id];
    }

    const currentSettings = { ...(this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {}) };
    if (!currentSettings[card.id]) {
      const capacityLimit = Math.max(0, card.capacityTotal);
      currentSettings[card.id] = {
        capacityMin: 0,
        capacityMax: capacityLimit,
        addedByUserId: this.activeUser().id,
        routes: this.normalizeAssetRoutes(card.type, card.routes)
      };
      this.resourcePopupStore.assignedAssetSettingsByKey[key] = currentSettings;
    }

    if (card.type === 'Supplies') {
      const contributionKey = this.subEventSupplyAssignmentKey(context.subEvent.id, card.id);
      const currentEntries = this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[contributionKey] ?? [];
      this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[contributionKey] = [
        {
          id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: this.activeUser().id,
          quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
          addedAtIso: AppUtils.toIsoDateTime(new Date())
        },
        ...currentEntries
      ];
    }

    const activeContext = this.resourcePopupStore.popupContextRef();
    if (activeContext?.subEvent.id === context.subEvent.id) {
      const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
      const existingCards = nextFallbackCards[card.type] ?? [];
      if (!existingCards.some(item => item.id === card.id)) {
        nextFallbackCards[card.type] = [
          ...existingCards,
          this.assignedFallbackAssetSnapshot(context.subEvent.id, card)
        ];
      }
      const nextContext = {
        ...activeContext,
        fallbackCardsByType: nextFallbackCards
      };
      this.resourcePopupStore.popupContextRef.set(nextContext);
      this.syncPopupSubEventMetrics(false);
      this.persistPopupResourceState(nextContext);
      return;
    }

    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(context);
  }

  private applyGroupScopedAssetSnapshot(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType,
    group: { pending?: number; capacityMin?: number; capacityMax?: number }
  ): ContractTypes.SubEventDTO {
    const scopedPending = Number.isFinite(Number(group.pending)) ? Math.max(0, Math.trunc(Number(group.pending))) : undefined;
    const scopedMin = Number.isFinite(Number(group.capacityMin)) ? Math.max(0, Math.trunc(Number(group.capacityMin))) : undefined;
    const scopedMax = Number.isFinite(Number(group.capacityMax)) ? Math.max(0, Math.trunc(Number(group.capacityMax))) : undefined;
    if (type === 'Car') {
      return {
        ...subEvent,
        carsPending: scopedPending ?? subEvent.carsPending,
        carsCapacityMin: scopedMin ?? subEvent.carsCapacityMin,
        carsCapacityMax: scopedMax ?? subEvent.carsCapacityMax
      };
    }
    if (type === 'Accommodation') {
      return {
        ...subEvent,
        accommodationPending: scopedPending ?? subEvent.accommodationPending,
        accommodationCapacityMin: scopedMin ?? subEvent.accommodationCapacityMin,
        accommodationCapacityMax: scopedMax ?? subEvent.accommodationCapacityMax
      };
    }
    return {
      ...subEvent,
      suppliesPending: scopedPending ?? subEvent.suppliesPending,
      suppliesCapacityMin: scopedMin ?? subEvent.suppliesCapacityMin,
      suppliesCapacityMax: scopedMax ?? subEvent.suppliesCapacityMax
    };
  }

  private normalizeAssetRoutes(type: AppConstants.AssetType, routes: string[] | undefined | null): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  private buildRouteEditorRowIds(routes: string[]): string[] {
    return routes.map(() => this.nextRouteEditorRowId());
  }

  private nextRouteEditorRowId(): string {
    this.routeEditorRowIdSequence += 1;
    return `route-stop-${this.routeEditorRowIdSequence}`;
  }

  private assetPendingCount(
    card: AppDTOs.AssetCardDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests.filter(request => request.status === 'pending').length;
  }

  private assetAcceptedCount(
    card: AppDTOs.AssetCardDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests.filter(request => request.status === 'accepted').length;
  }

  private subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private subEventDisplayName(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const name = this.subEventDisplayName(subEvent);
    return name || 'Sub Event';
  }

  isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 760px)').matches;
  }

  private isAbortError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError';
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  private openGoogleMapsDirections(stops: string[]): void {
    const normalized = stops.map(stop => stop.trim()).filter(Boolean);
    if (normalized.length === 0 || typeof window === 'undefined') {
      return;
    }
    if (normalized.length === 1) {
      this.openGoogleMapsSearch(normalized[0]);
      return;
    }
    const origin = normalized[0];
    const destination = normalized[normalized.length - 1];
    const waypoints = normalized.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
