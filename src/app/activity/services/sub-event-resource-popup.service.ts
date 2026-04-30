import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import type { MatSelect } from '@angular/material/select';

import { AssetPopupStateService } from '../../asset/asset-popup-state.service';
import type { AssetPopupHost } from '../../asset/asset-popup.host';
import { OwnedAssetsPopupFacadeService } from '../../asset/owned-assets-popup-facade.service';
import { APP_STATIC_DATA } from '../../shared/app-static-data';
import { AppUtils } from '../../shared/app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../shared/core/base/builders';
import type * as AppTypes from '../../shared/core/base/models';
import {
  ActivityMembersService,
  ActivityResourceBuilder,
  ActivityResourcesService,
  AppContext,
  AppPopupContext,
  AssetsService as SharedAssetsService,
  EventsService,
  UsersService,
  type UserDto
} from '../../shared/core';
import { resolveCurrentDemoDelayMs } from '../../shared/core/base/services/route-delay.service';
import { ActivitiesPopupStateService } from './activities-popup-state.service';
import { EventEditorPopupStateService } from './event-editor-popup-state.service';
import { NavigatorService } from '../../navigator';
import type {
  AssignedAssetJoinDialogViewState,
  AssetExploreBorrowDraftViewState,
  AssetExploreBorrowDialogViewState,
  AssetExplorePopupViewState,
  EventResourcePopupHost,
  ResourceAssetViewState
} from '../components/event-resource-popup/event-resource-popup.component';
import type {
  EventSupplyContributionsPopupHost
} from '../components/event-supply-contributions-popup/event-supply-contributions-popup.component';
import type { ListQuery, PageResult } from '../../shared/ui';
import type { ChatMenuItem } from '../../shared/core/base/interfaces/activity-feed.interface';

interface ResourcePopupContext {
  origin: 'chat' | 'eventEditor';
  ownerId: string;
  parentTitle: string;
  subEvent: AppTypes.SubEventFormItem;
  groupId?: string;
  groupName?: string;
  fallbackCardsByType: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>;
}

interface CapacityEditorState {
  subEventId: string;
  type: AppTypes.AssetType;
  assetId: string;
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
  busy: boolean;
  error: string | null;
}

interface RouteEditorState {
  subEventId: string;
  type: 'Car';
  assetId: string;
  title: string;
  mode: 'view' | 'edit';
  routes: string[];
  routeRowIds: string[];
  busy: boolean;
  error: string | null;
}

interface SupplyContributionPopupState {
  subEventId: string;
  assetId: string;
  title: string;
}

interface PendingSupplyDeleteState {
  subEventId: string;
  assetId: string;
  entryId: string;
  label: string;
  busy: boolean;
  error: string | null;
}

interface PendingResourceDeleteState {
  assetId: string;
  title: string;
  busy: boolean;
  error: string | null;
}

interface PendingAssignSaveState {
  subEventId: string;
  type: AppTypes.AssetType;
  busy: boolean;
  error: string | null;
}

interface AssetExplorePopupState {
  subEventId: string;
  type: AppTypes.AssetType;
  category: AppTypes.AssetCategory;
  startAtIso: string;
  endAtIso: string;
  loading: boolean;
  error: string | null;
  cards: AppTypes.AssetCard[];
}

interface AssetExploreBorrowDialogState {
  cardId: string;
  ownerUserId: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  availableQuantity: number;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  busy: boolean;
  error: string | null;
}

interface AssignedAssetJoinDialogState {
  cardId: string;
  type: 'Car' | 'Accommodation';
  sourceAssetId: string;
  acceptedPolicyIds: string[];
  busy: boolean;
  error: string | null;
}

interface AssetExploreBorrowDraftState {
  userId: string;
  subEventId: string;
  cardId: string;
  ownerUserId: string;
  title: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  updatedAtMs: number;
}

interface AssetExploreBorrowPricingPreview {
  amount: number;
  currency: string;
}

interface SupplyBringDialogState {
  subEventId: string;
  cardId: string;
  title: string;
  quantity: number;
  min: number;
  max: number;
  busy: boolean;
  error: string | null;
}

interface AssignedAssetJoinPricingPreview {
  totalAmount: number;
  shareAmount: number;
  shareMemberCount: number;
  currency: string;
  chargeType: AppTypes.PricingChargeType | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubEventResourcePopupService {
  private static readonly ASSET_EXPLORE_BORROW_MIN_BUSY_DURATION_MS = 1500;

  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly assetPopupService = inject(AssetPopupStateService);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly usersService = inject(UsersService);
  private readonly navigatorService = inject(NavigatorService);

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  private readonly popupContextRef = signal<ResourcePopupContext | null>(null);
  private readonly resourceFilterRef = signal<AppTypes.AssetType>('Car');
  private readonly inlineItemActionMenuRef = signal<{ id: string; openUp: boolean } | null>(null);
  private readonly resourceAssetViewIdRef = signal<string | null>(null);
  private readonly resourceAssetViewModeRef = signal<'view' | 'edit'>('view');
  private readonly resourceAssetViewReturnToChatRef = signal(false);
  private readonly capacityEditorRef = signal<CapacityEditorState | null>(null);
  private readonly routeEditorRef = signal<RouteEditorState | null>(null);
  private readonly supplyPopupRef = signal<SupplyContributionPopupState | null>(null);
  private readonly bringDialogRef = signal<SupplyBringDialogState | null>(null);
  private readonly pendingSupplyDeleteRef = signal<PendingSupplyDeleteState | null>(null);
  private readonly pendingResourceDeleteRef = signal<PendingResourceDeleteState | null>(null);
  private readonly pendingAssignSaveRef = signal<PendingAssignSaveState | null>(null);
  private readonly assetExplorePopupRef = signal<AssetExplorePopupState | null>(null);
  private readonly assetExploreOnlyRef = signal(false);
  private readonly assetExploreBorrowDialogRef = signal<AssetExploreBorrowDialogState | null>(null);
  private readonly assignedAssetJoinDialogRef = signal<AssignedAssetJoinDialogState | null>(null);
  private readonly assetExploreBorrowDraftsRef = signal<Record<string, AssetExploreBorrowDraftState>>({});
  private readonly assignContextRef = signal<{ subEventId: string; type: AppTypes.AssetType } | null>(null);
  private readonly selectedAssignAssetIdsRef = signal<string[]>([]);
  private readonly resourceDeleteConfirmRingPerimeter = 100;
  private readonly resourceEditorSaveRingPerimeter = 100;
  private readonly deleteConfirmRingPerimeter = 100;
  private readonly bringConfirmRingPerimeter = 100;
  private readonly assignConfirmRingPerimeter = 100;

  private readonly assignedAssetIdsByKey: Record<string, string[]> = {};
  private readonly assignedAssetSettingsByKey: Record<string, Record<string, AppTypes.SubEventAssignedAssetSettings>> = {};
  private readonly supplyContributionEntriesByAssignmentKey: Record<string, AppTypes.SubEventSupplyContributionEntry[]> = {};
  private pendingSupplyDeleteAbortController: AbortController | null = null;
  private pendingSupplyDeleteRequestVersion = 0;
  private pendingSupplyBringAbortController: AbortController | null = null;
  private pendingSupplyBringRequestVersion = 0;
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
  private readonly assetExploreWarmCacheByKey = new Map<string, AppTypes.AssetCard[]>();
  private readonly localAssetExploreReservationsByKey = new Map<string, {
    startAtIso: string;
    endAtIso: string;
    quantity: number;
  }>();
  private readonly pendingAssetExploreWarmupKeys = new Set<string>();

  readonly resourceHost = computed<EventResourcePopupHost | null>(() =>
    this.popupContextRef() ? this.eventResourcePopupHost : null
  );

  readonly supplyContributionsHost = computed<EventSupplyContributionsPopupHost | null>(() =>
    this.popupContextRef() && !this.assetExploreOnlyRef() && this.supplyPopupRef() ? this.eventSupplyContributionsPopupHost : null
  );

  private readonly eventResourcePopupHost: EventResourcePopupHost = {
    title: () => this.popupTitle(),
    subtitle: () => this.popupSubtitle(),
    summary: () => this.popupSummary(),
    isMobileView: () => this.isMobileView(),
    isMobilePopupSheetViewport: () => false,
    resourceFilter: () => this.resourceFilterRef(),
    resourceFilterOptions: () => ['Car', 'Accommodation', 'Supplies'],
    resourceFilterPanelWidth: () => this.ownedAssets.assetFilterPanelWidth(),
    resourceFilterCount: type => this.resourceFilterCount(type),
    resourceTypeClass: type => this.ownedAssets.assetTypeClass(type === 'Members' ? 'Car' : type),
    resourceTypeIcon: type => type === 'Members' ? 'groups' : this.ownedAssets.assetTypeIcon(type),
    resourceTypeLabel: type => APP_STATIC_DATA.subEventResourceFilterLabels[type],
    cards: () => this.resourceCards(),
    resourceAssetView: () => this.resourceAssetView(),
    standaloneResourceAssetView: () => this.resourceAssetViewReturnToChatRef(),
    assetExploreOnly: () => this.assetExploreOnlyRef(),
    capacityEditor: () => this.capacityEditorRef(),
    routeEditor: () => this.routeEditorRef(),
    pendingDeleteCard: () => this.pendingResourceDeleteRef(),
    assetExplorePopup: () => this.assetExplorePopupViewState(),
    assetExploreBorrowDialog: () => this.assetExploreBorrowDialogViewState(),
    joinDialog: () => this.assignedAssetJoinDialogViewState(),
    assetExploreBorrowDrafts: () => this.assetExploreBorrowDraftsViewState(),
    close: () => this.closeResourcePopup(),
    selectResourceFilter: filter => this.selectResourceFilter(filter),
    onResourceFilterOpened: (isOpen, select) => this.onResourceFilterOpened(isOpen, select),
    openMobileResourceFilterSelector: () => undefined,
    openAssignPopup: event => this.openAssignPopup(event),
    openExplorePopup: event => this.openExplorePopup(event),
    closeExplorePopup: event => this.closeExplorePopup(event),
    selectAssetExploreCategory: (category, event) => this.selectAssetExploreCategory(category, event),
    setAssetExploreDateRange: (start, end) => this.setAssetExploreDateRange(start, end),
    setAssetExploreTime: (edge, value) => this.setAssetExploreTime(edge, value),
    assetExploreAvailableQuantity: card => this.assetExploreAvailableQuantity(card),
    assetExploreAvailabilityLabel: card => this.assetExploreAvailabilityLabel(card),
    assetExploreCanBorrow: card => this.assetExploreAvailableQuantity(card) > 0,
    openAssetExploreBorrowDialog: (card, event) => this.openAssetExploreBorrowDialog(card, event),
    openAssetExploreServiceChat: (card, event) => this.openAssetExploreServiceChat(card, event),
    canReportAssetExploreOwner: card => this.canReportAssetExploreOwner(card),
    reportAssetExploreOwner: (card, event) => this.reportAssetExploreOwner(card, event),
    closeAssetExploreBorrowDialog: event => this.closeAssetExploreBorrowDialog(event),
    setAssetExploreBorrowDateRange: (start, end) => this.setAssetExploreBorrowDateRange(start, end),
    setAssetExploreBorrowTime: (edge, value) => this.setAssetExploreBorrowTime(edge, value),
    onAssetExploreBorrowQuantityChange: value => this.onAssetExploreBorrowQuantityChange(value),
    normalizeAssetExploreBorrowQuantityOnBlur: value => this.normalizeAssetExploreBorrowQuantityOnBlur(value),
    toggleAssetExploreBorrowPolicy: policyId => this.toggleAssetExploreBorrowPolicy(policyId),
    backAssetExploreBorrowToDetails: event => this.backAssetExploreBorrowToDetails(event),
    canSubmitAssetExploreBorrow: () => this.canSubmitAssetExploreBorrow(),
    confirmAssetExploreBorrow: event => this.confirmAssetExploreBorrow(event),
    resumeAssetExploreBorrowDraft: (cardId, event) => this.resumeAssetExploreBorrowDraft(cardId, event),
    clearAssetExploreBorrowDraft: (cardId, event) => this.clearAssetExploreBorrowDraft(cardId, event),
    assetExploreBorrowRingPerimeter: () => this.assignConfirmRingPerimeter,
    trackByCard: (_index, card) => card.id,
    canOpenMap: card => this.canOpenResourceMap(card),
    openMap: (card, event) => this.openResourceMap(card, event),
    canOpenBadgeDetails: card => this.canOpenResourceBadgeDetails(card),
    openBadgeDetails: (card, event) => this.openResourceBadgeDetails(card, event),
    occupancyLabel: card => this.occupancyLabel(card),
    canOpenAssetMembers: card => this.canOpenAssetMembers(card),
    openResourceAssetView: (card, mode, event) => this.openResourceAssetView(card, mode, event),
    closeResourceAssetView: event => this.closeResourceAssetView(event),
    isItemActionMenuOpen: card => this.inlineItemActionMenuRef()?.id === card.id,
    isItemActionMenuOpenUp: card => this.inlineItemActionMenuRef()?.id === card.id && this.inlineItemActionMenuRef()?.openUp === true,
    toggleItemActionMenu: (card, event) => this.toggleItemActionMenu(card, event),
    canJoin: card => this.canJoin(card),
    join: (card, event) => this.join(card, event),
    canLeave: card => this.canLeave(card),
    leave: (card, event) => this.leave(card, event),
    closeJoinDialog: event => this.closeAssignedAssetJoinDialog(event),
    toggleJoinPolicy: policyId => this.toggleAssignedAssetJoinPolicy(policyId),
    canSubmitJoin: () => this.canSubmitAssignedAssetJoin(),
    confirmJoin: event => this.confirmAssignedAssetJoin(event),
    joinConfirmRingPerimeter: () => this.assignConfirmRingPerimeter,
    canEditCapacity: card => this.canEditCapacity(card),
    openCapacityEditor: (card, event) => this.openCapacityEditor(card, event),
    canEditRoute: card => this.canEditRoute(card),
    routeMenuLabel: () => 'Edit Route',
    openRouteEditor: (card, event, mode) => this.openRouteEditor(card, event, mode),
    openResourceServiceChat: (card, event) => this.openResourceServiceChat(card, event),
    canReportResourceManager: card => this.canReportResourceManager(card),
    reportResourceManager: (card, event) => this.reportResourceManager(card, event),
    delete: (card, event) => this.requestDeleteResourceCard(card, event),
    closeCapacityEditor: event => this.closeCapacityEditor(event),
    canSubmitCapacityEditor: () => this.canSubmitCapacityEditor(),
    onCapacityMinChange: value => this.onCapacityMinChange(value),
    onCapacityMaxChange: value => this.onCapacityMaxChange(value),
    saveCapacityEditor: event => this.saveCapacityEditor(event),
    closeRouteEditor: event => this.closeRouteEditor(event),
    routeEditorSupportsMultiRoute: () => !!this.routeEditorRef(),
    routeEditorReadOnly: () => this.routeEditorRef()?.mode === 'view',
    openRouteMap: event => this.openRouteMap(event),
    addRouteStop: () => this.addRouteStop(),
    dropRouteStop: event => this.dropRouteStop(event as CdkDragDrop<string[]>),
    updateRouteStop: (index, value) => this.updateRouteStop(index, value),
    openRouteStopMap: (index, event) => this.openRouteStopMap(index, event),
    removeRouteStop: index => this.removeRouteStop(index),
    canSubmitRouteEditor: () => this.canSubmitRouteEditor(),
    saveRouteEditor: event => this.saveRouteEditor(event),
    editorSaveRingPerimeter: () => this.resourceEditorSaveRingPerimeter,
    isCapacitySavePending: () => this.capacityEditorRef()?.busy === true,
    capacitySaveErrorMessage: () => this.capacityEditorRef()?.error?.trim() ?? '',
    isRouteSavePending: () => this.routeEditorRef()?.busy === true,
    routeSaveErrorMessage: () => this.routeEditorRef()?.error?.trim() ?? '',
    cancelDeleteCard: () => this.cancelDeleteResourceCard(),
    deleteCardLabel: () => this.resourceDeleteCardLabel(),
    deleteCardConfirmRingPerimeter: () => this.resourceDeleteConfirmRingPerimeter,
    isDeleteCardPending: () => this.pendingResourceDeleteRef()?.busy === true,
    deleteCardErrorMessage: () => this.pendingResourceDeleteRef()?.error?.trim() ?? '',
    confirmDeleteCard: () => this.confirmDeleteResourceCard()
  };

  private readonly eventSupplyContributionsPopupHost: EventSupplyContributionsPopupHost = {
    title: () => this.supplyPopupTitle(),
    subtitle: () => this.popupSubtitle(),
    summary: () => this.supplyContributionTotalLabel(),
    rows: () => this.supplyContributionRows(),
    loadRowsPage: query => this.loadSupplyContributionRowsPage(query),
    bringDialog: () => this.bringDialogRef(),
    pendingDelete: () => this.pendingSupplyDeleteRef(),
    close: () => this.closeSupplyContributionsPopup(),
    openBringDialog: event => this.openBringDialog(event),
    addedLabel: addedAtIso => this.addedLabel(addedAtIso),
    quantityLabel: quantity => this.quantityLabel(quantity),
    canDelete: row => row.userId === this.activeUser().id,
    requestDelete: (row, event) => this.requestDeleteSupplyContribution(row, event),
    cancelBringDialog: () => this.cancelBringDialog(),
    canSubmitBringDialog: () => this.canSubmitBringDialog(),
    onBringQuantityChange: value => this.onBringQuantityChange(value),
    confirmBringDialog: event => this.confirmBringDialog(event),
    bringConfirmRingPerimeter: () => this.bringConfirmRingPerimeter,
    isBringPending: () => this.bringDialogRef()?.busy === true,
    bringErrorMessage: () => this.bringErrorMessage(),
    cancelDelete: () => this.cancelDeleteSupplyContribution(),
    pendingDeleteLabel: () => this.pendingDeleteLabel(),
    deleteConfirmRingPerimeter: () => this.deleteConfirmRingPerimeter,
    isDeletePending: () => this.pendingSupplyDeleteRef()?.busy === true,
    deleteErrorMessage: () => this.pendingSupplyDeleteRef()?.error?.trim() ?? '',
    confirmDelete: () => this.confirmDeleteSupplyContribution()
  };

  private readonly assetAssignHost: AssetPopupHost = {
    isMobileView: () => this.isMobileView(),
    isSubEventAssetAssignPopup: () => this.assignContextRef() !== null,
    assetTypeIcon: type => this.ownedAssets.assetTypeIcon(type),
    assetTypeClass: type => this.ownedAssets.assetTypeClass(type),
    subEventAssetAssignHeaderTitle: () => this.assignPopupTitle(),
    subEventAssetAssignHeaderSubtitle: () => this.popupSubtitle(),
    canConfirmSubEventAssetAssignSelection: () => this.canConfirmAssignSelection(),
    isSubEventAssetAssignPending: () => this.pendingAssignSaveRef()?.busy === true,
    subEventAssetAssignErrorMessage: () => this.pendingAssignSaveRef()?.error?.trim() ?? '',
    subEventAssetAssignRingPerimeter: () => this.assignConfirmRingPerimeter,
    closeSubEventAssetAssignPopup: apply => this.closeAssignPopup(apply),
    confirmSubEventAssetAssignSelection: event => this.confirmAssignPopup(event),
    subEventAssetAssignCandidates: () => this.assignCandidates(),
    selectedSubEventAssetAssignChips: () => this.assignSelectedChips(),
    toggleSubEventAssetAssignCard: (cardId, event) => this.toggleAssignCard(cardId, event),
    isSubEventAssetAssignCardSelected: cardId => this.selectedAssignAssetIdsRef().includes(cardId)
  };

  constructor() {
    this.assetPopupService.registerHost(this.assetAssignHost);
    this.ownedAssets.registerRuntimeHooks({
      onAssetDeleted: cardId => this.handleOwnedAssetDeleted(cardId),
      onAssetsChanged: () => this.handleOwnedAssetsChanged()
    });

    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || (request.type !== 'chatResource' && request.type !== 'assetExplore')) {
        return;
      }
      this.popupCtx.clearActivitiesNavigationRequest();
      if (request.type === 'assetExplore') {
        this.openStandaloneAssetExploreRequest(request);
        return;
      }
      this.openFromChatRequest(request);
    });

    effect(() => {
      const request = this.eventEditorService.subEventResourcePopupRequest();
      if (!request) {
        return;
      }
      this.eventEditorService.clearSubEventResourcePopupRequest();
      this.openFromEventEditorRequest(request);
    });
  }

  private activeUser(): UserDto {
    const activeUserId = this.appCtx.activeUserId().trim();
    return this.appCtx.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private openFromChatRequest(request: Extract<AppTypes.ActivitiesNavigationRequest, { type: 'chatResource' }>): void {
    if (request.resourceType === 'Members') {
      this.popupCtx.requestActivitiesNavigation({
        type: 'members',
        ownerId: request.group?.id?.trim() || request.subEvent.id,
        ownerType: request.group?.id ? 'group' : 'subEvent'
      });
      return;
    }

    const context = this.buildPopupContext(
      'chat',
      request.ownerId?.trim() || request.item.eventId?.trim() || '',
      request.item.title,
      request.resourceType,
      request.subEvent,
      request.group ?? null,
      request.assetCardsByType
    );
    this.seedAssignmentsFromRequest(context.subEvent.id, request.assetAssignmentIds, context.fallbackCardsByType);
    this.openPopupContext(context, request.resourceType);
    this.assetExploreOnlyRef.set(request.openExplore === true);
    this.resourceAssetViewIdRef.set(request.assetViewId?.trim() || null);
    if (request.openExplore) {
      this.openExplorePopup();
    }
  }

  private openStandaloneAssetExploreRequest(
    request: Extract<AppTypes.ActivitiesNavigationRequest, { type: 'assetExplore' }>
  ): void {
    const type = request.assetType === 'Accommodation' || request.assetType === 'Supplies'
      ? request.assetType
      : 'Car';
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const subEvent: AppTypes.SubEventFormItem = {
      id: `asset-explore-${this.activeUser().id || 'user'}`,
      name: 'Asset Explore',
      description: '',
      startAt: AppUtils.toIsoDateTimeLocal(now),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      optional: true,
      capacityMin: 0,
      capacityMax: 0,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0,
      carsAccepted: 0,
      accommodationAccepted: 0,
      suppliesAccepted: 0
    };
    this.openPopupContext({
      origin: 'chat',
      ownerId: this.activeUser().id,
      parentTitle: 'Assets',
      subEvent,
      fallbackCardsByType: request.fallbackAsset ? { [type]: [this.cloneAsset(request.fallbackAsset)] } : {}
    }, type, { hydrate: !request.viewOnly });
    this.assetExploreOnlyRef.set(!request.viewOnly);
    if (request.viewOnly && request.assetId) {
      this.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEvent.id, type)] = [request.assetId];
      this.resourceAssetViewIdRef.set(request.assetId);
      this.resourceAssetViewModeRef.set('view');
      this.resourceAssetViewReturnToChatRef.set(true);
      return;
    }
    this.openExplorePopup();
  }

  private openFromEventEditorRequest(request: NonNullable<ReturnType<EventEditorPopupStateService['subEventResourcePopupRequest']>>): void {
    if (request.type === 'Members') {
      this.popupCtx.requestActivitiesNavigation({
        type: 'members',
        ownerId: request.group?.id?.trim() || `${request.subEvent.id ?? ''}`.trim(),
        ownerType: request.group?.id ? 'group' : 'subEvent'
      });
      return;
    }

    const context = this.buildPopupContext(
      'eventEditor',
      request.ownerId?.trim() || '',
      request.parentTitle?.trim() || 'Event',
      request.type,
      request.subEvent,
      request.group ?? null
    );
    this.openPopupContext(context, request.type);
  }

  private buildPopupContext(
    origin: 'chat' | 'eventEditor',
    ownerId: string,
    parentTitle: string,
    type: AppTypes.AssetType,
    rawSubEvent: AppTypes.SubEventFormItem,
    group: { id?: string | null; groupLabel?: string; pending?: number; capacityMin?: number; capacityMax?: number } | null | undefined,
    fallbackCardsByType?: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): ResourcePopupContext {
    const subEvent = this.cloneSubEvent(rawSubEvent);
    const scopedSubEvent = group?.id
      ? this.applyGroupScopedAssetSnapshot(subEvent, type, group)
      : subEvent;

    return {
      origin,
      ownerId: ownerId.trim(),
      parentTitle: parentTitle.trim() || 'Event',
      subEvent: scopedSubEvent,
      groupId: group?.id?.trim() || undefined,
      groupName: group?.groupLabel?.trim() || undefined,
      fallbackCardsByType: this.cloneFallbackCards(fallbackCardsByType)
    };
  }

  private openPopupContext(
    context: ResourcePopupContext,
    type: AppTypes.AssetType,
    options: { hydrate?: boolean } = {}
  ): void {
    this.popupContextRef.set(context);
    this.resourceFilterRef.set(type);
    this.inlineItemActionMenuRef.set(null);
    this.resourceAssetViewIdRef.set(null);
    this.resourceAssetViewModeRef.set('view');
    this.resourceAssetViewReturnToChatRef.set(false);
    this.abortPendingCapacitySaveRequest();
    this.capacityEditorRef.set(null);
    this.abortPendingRouteSaveRequest();
    this.routeEditorRef.set(null);
    this.pendingResourceDeleteRef.set(null);
    this.supplyPopupRef.set(null);
    this.abortPendingSupplyBringRequest();
    this.bringDialogRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.assignedAssetJoinDialogRef.set(null);
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(null);
    this.assetExploreOnlyRef.set(false);
    this.closeAssignPopup(false);
    if (options.hydrate !== false) {
      this.hydratePopupResourceState(context);
    }
    this.syncPopupSubEventMetrics();
  }

  private hydratePopupResourceState(context: ResourcePopupContext): void {
    const ownerId = context.ownerId.trim();
    const subEventId = context.subEvent.id.trim();
    const assetOwnerUserId = this.activeUser().id;
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return;
    }
    const applyState = (state: AppTypes.ActivitySubEventResourceState | null): void => {
      const activeContext = this.popupContextRef();
      if (!state || !activeContext || activeContext.ownerId !== ownerId || activeContext.subEvent.id !== subEventId) {
        return;
      }
      this.applyPersistedPopupState(state);
      this.syncPopupSubEventMetrics();
    };
    applyState(this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId, assetOwnerUserId));
    void this.activityResourcesService
      .querySubEventResourceState(ownerId, subEventId, assetOwnerUserId)
      .then(state => applyState(state));
  }

  private applyPersistedPopupState(state: AppTypes.ActivitySubEventResourceState): void {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return;
    }
    const activeContext = this.popupContextRef();
    if (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    ) {
      this.popupContextRef.set({
        ...activeContext,
        fallbackCardsByType: this.mergePersistedFallbackCards(
          activeContext.fallbackCardsByType,
          normalizedState.fallbackAssetCardsByType,
          normalizedState.subEventId
        )
      });
    }
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      this.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = [
        ...(normalizedState.assetAssignmentIds[type] ?? [])
      ];
      this.assignedAssetSettingsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = {
        ...(normalizedState.assetSettingsByType[type] ?? {})
      };
    }
    for (const key of Object.keys(this.supplyContributionEntriesByAssignmentKey)) {
      if (key.startsWith(`${normalizedState.subEventId}:`)) {
        delete this.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const [assetId, entries] of Object.entries(normalizedState.supplyContributionEntriesByAssetId)) {
      this.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(normalizedState.subEventId, assetId)] = entries
        .map(entry => ({ ...entry }));
    }
  }

  private persistPopupResourceState(context: ResourcePopupContext | null = this.popupContextRef()): void {
    const nextState = this.buildPopupResourceState(context);
    if (!nextState) {
      return;
    }
    void this.activityResourcesService.replaceSubEventResourceState(nextState);
  }

  private buildPopupResourceState(
    context: ResourcePopupContext | null = this.popupContextRef()
  ): AppTypes.ActivitySubEventResourceState | null {
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

  private closeResourcePopup(): void {
    this.abortPendingSupplyDeleteRequest();
    this.abortPendingSupplyBringRequest();
    this.abortPendingCapacitySaveRequest();
    this.abortPendingRouteSaveRequest();
    this.popupContextRef.set(null);
    this.inlineItemActionMenuRef.set(null);
    this.resourceAssetViewIdRef.set(null);
    this.resourceAssetViewModeRef.set('view');
    this.resourceAssetViewReturnToChatRef.set(false);
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
    this.pendingResourceDeleteRef.set(null);
    this.supplyPopupRef.set(null);
    this.bringDialogRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.assignedAssetJoinDialogRef.set(null);
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(null);
    this.assetExploreOnlyRef.set(false);
    this.closeAssignPopup(false);
  }

  private popupTitle(): string {
    const context = this.popupContextRef();
    const subEvent = context?.subEvent;
    const typeLabel = APP_STATIC_DATA.assetTypeLabels[this.resourceFilterRef()];
    if (!context || !subEvent) {
      return typeLabel;
    }
    const stageLabel = this.subEventStageLabel(subEvent);
    return stageLabel ? `${typeLabel} - ${stageLabel}` : typeLabel;
  }

  private popupSubtitle(): string {
    const context = this.popupContextRef();
    if (!context) {
      return 'Event';
    }
    const subEventName = this.subEventDisplayName(context.subEvent);
    if (context.parentTitle && subEventName) {
      return `${context.parentTitle} - ${subEventName}`;
    }
    return context.parentTitle || subEventName || 'Event';
  }

  private popupSummary(): string {
    const context = this.popupContextRef();
    if (!context) {
      return '0 members';
    }
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, this.resourceFilterRef());
    if (metrics.pending <= 0) {
      return `${metrics.joined} members`;
    }
    return `${metrics.joined} members · ${metrics.pending} pending`;
  }

  private canOpenAssetMembers(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation');
  }

  private canOpenResourceBadgeDetails(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  private openResourceBadgeDetails(card: AppTypes.SubEventResourceCard, event?: Event): void {
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

  private resourceAssetView(): ResourceAssetViewState | null {
    const viewId = `${this.resourceAssetViewIdRef() ?? ''}`.trim();
    if (!viewId) {
      return null;
    }
    const card = this.resourceCards().find(item => item.id === viewId || `${item.sourceAssetId ?? ''}`.trim() === viewId) ?? null;
    if (!card) {
      return null;
    }
    const context = this.popupContextRef();
    const source = context && card.sourceAssetId
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppTypes.AssetType, card.sourceAssetId)
      : null;
    return {
      card,
      mode: this.resourceAssetViewModeRef(),
      source,
      memberLabel: this.occupancyLabel(card),
      memberCount: Math.max(0, Math.trunc(Number(card.accepted) || 0)),
      pendingCount: Math.max(0, Math.trunc(Number(card.pending) || 0)),
      canOpenMembers: this.canOpenResourceBadgeDetails(card),
      canEditCapacity: this.canEditCapacity(card),
      canEditRoute: this.canEditRoute(card)
    };
  }

  private openResourceAssetView(
    card: AppTypes.SubEventResourceCard,
    mode: 'view' | 'edit',
    event?: Event
  ): void {
    event?.stopPropagation();
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!assetId) {
      return;
    }
    this.resourceAssetViewIdRef.set(assetId);
    this.resourceAssetViewModeRef.set(mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view');
    this.resourceAssetViewReturnToChatRef.set(false);
    this.inlineItemActionMenuRef.set(null);
    this.pendingResourceDeleteRef.set(null);
    this.assetExplorePopupRef.set(null);
  }

  private closeResourceAssetView(event?: Event): void {
    event?.stopPropagation();
    if (this.resourceAssetViewReturnToChatRef()) {
      this.closeResourcePopup();
      return;
    }
    this.resourceAssetViewIdRef.set(null);
    this.resourceAssetViewModeRef.set('view');
  }

  private async openAssetMembersPopup(card: AppTypes.SubEventResourceCard): Promise<void> {
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const assetType: 'Car' | 'Accommodation' = card.type;
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, assetType);
    const managerUserId = settings[card.sourceAssetId]?.addedByUserId?.trim() || null;
    const fallbackMembers = this.assetMemberEntries(sourceCard, managerUserId, context.subEvent.id);
    const acceptedMembers = fallbackMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = fallbackMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = settings[card.sourceAssetId]?.capacityMax ?? Math.max(0, sourceCard.capacityTotal);
    this.popupCtx.requestActivitiesNavigation({
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

  private supplyPopupTitle(): string {
    const context = this.supplyPopupRef();
    const popup = this.popupContextRef();
    if (!context || !popup) {
      return 'Supplies';
    }
    const stageLabel = this.subEventStageLabel(popup.subEvent);
    return stageLabel ? `${context.title} - ${stageLabel}` : context.title;
  }

  private supplyContributionRows(): AppTypes.SubEventSupplyContributionRow[] {
    const context = this.supplyPopupRef();
    if (!context) {
      return [];
    }
    return this.buildSupplyContributionRows(this.subEventSupplyContributionEntries(context.subEventId, context.assetId));
  }

  private async loadSupplyContributionRowsPage(
    query: ListQuery<{ revision?: number; contextKey?: string; showProgress?: boolean }>
  ): Promise<PageResult<AppTypes.SubEventSupplyContributionRow>> {
    const rows = this.supplyContributionRows();
    if (rows.length === 0 && !this.supplyPopupRef()) {
      return {
        items: [],
        total: 0
      };
    }
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length
    };
  }

  private buildSupplyContributionRows(
    entries: readonly AppTypes.SubEventSupplyContributionEntry[]
  ): AppTypes.SubEventSupplyContributionRow[] {
    void this.usersService.warmCachedUsers(entries.map(entry => entry.userId));
    return entries
      .map(entry => {
        const user = this.userById.get(entry.userId) ?? null;
        return {
          id: entry.id,
          userId: entry.userId,
          name: user?.name ?? 'Unknown member',
          initials: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Unknown member'),
          gender: user?.gender ?? 'woman',
          age: user?.age ?? 0,
          city: user?.city ?? '',
          addedAtIso: entry.addedAtIso,
          quantity: AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER)
        };
      })
      .sort((a, b) => AppUtils.toSortableDate(b.addedAtIso) - AppUtils.toSortableDate(a.addedAtIso));
  }

  private openSupplyContributionsPopup(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    if (!context || card.type !== 'Supplies' || !card.sourceAssetId) {
      return;
    }
    this.supplyPopupRef.set({
      subEventId: context.subEvent.id,
      assetId: card.sourceAssetId,
      title: card.title
    });
    this.abortPendingSupplyBringRequest();
    this.pendingSupplyDeleteRef.set(null);
    this.bringDialogRef.set(null);
  }

  private closeSupplyContributionsPopup(): void {
    this.abortPendingSupplyDeleteRequest();
    this.abortPendingSupplyBringRequest();
    this.supplyPopupRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.bringDialogRef.set(null);
  }

  private openBringDialog(event?: Event): void {
    event?.stopPropagation();
    const context = this.supplyPopupRef();
    if (!context) {
      return;
    }
    const source = this.ownedAssets.assetCards.find(card => card.id === context.assetId && card.type === 'Supplies');
    const settings = this.getSubEventAssignedAssetSettings(context.subEventId, 'Supplies');
    const max = Math.max(1, settings[context.assetId]?.capacityMax ?? source?.capacityTotal ?? 1);
    this.bringDialogRef.set({
      subEventId: context.subEventId,
      cardId: context.assetId,
      title: context.title,
      quantity: 1,
      min: 0,
      max,
      busy: false,
      error: null
    });
  }

  private cancelBringDialog(): void {
    this.abortPendingSupplyBringRequest();
    this.bringDialogRef.set(null);
  }

  private canSubmitBringDialog(): boolean {
    const dialog = this.bringDialogRef();
    return !!dialog && !dialog.busy && dialog.quantity >= dialog.min && dialog.quantity <= dialog.max;
  }

  private onBringQuantityChange(value: number | string): void {
    const dialog = this.bringDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    this.bringDialogRef.set({
      ...dialog,
      quantity: AppUtils.clampNumber(
        Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
        dialog.min,
        dialog.max
      ),
      error: null
    });
  }

  private confirmBringDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.bringDialogRef();
    if (!dialog || dialog.busy || !this.canSubmitBringDialog()) {
      return;
    }
    if (dialog.quantity <= 0) {
      this.bringDialogRef.set(null);
      return;
    }

    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }

    const nextEntry: AppTypes.SubEventSupplyContributionEntry = {
      id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: this.activeUser().id,
      quantity: dialog.quantity,
      addedAtIso: AppUtils.toIsoDateTime(new Date())
    };
    const currentEntries = nextState.supplyContributionEntriesByAssetId[dialog.cardId] ?? [];
    nextState.supplyContributionEntriesByAssetId = {
      ...nextState.supplyContributionEntriesByAssetId,
      [dialog.cardId]: [nextEntry, ...currentEntries]
    };

    const requestVersion = ++this.pendingSupplyBringRequestVersion;
    const abortController = new AbortController();
    this.pendingSupplyBringAbortController = abortController;
    this.bringDialogRef.set({
      ...dialog,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingSupplyBringAbortController === abortController) {
          this.pendingSupplyBringAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion != this.pendingSupplyBringRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.bringDialogRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingSupplyBringAbortController === abortController) {
          this.pendingSupplyBringAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion != this.pendingSupplyBringRequestVersion) {
          return;
        }
        const currentDialog = this.bringDialogRef();
        if (!currentDialog || currentDialog.cardId !== dialog.cardId || currentDialog.subEventId !== dialog.subEventId) {
          return;
        }
        this.bringDialogRef.set({
          ...currentDialog,
          busy: false,
          error: 'Unable to save quantity row.'
        });
      });
  }

  private abortPendingSupplyBringRequest(): void {
    this.pendingSupplyBringRequestVersion += 1;
    const controller = this.pendingSupplyBringAbortController;
    this.pendingSupplyBringAbortController = null;
    controller?.abort();
  }

  private bringErrorMessage(): string {
    return this.bringDialogRef()?.error?.trim() ?? '';
  }

  private requestDeleteSupplyContribution(row: AppTypes.SubEventSupplyContributionRow, event?: Event): void {
    event?.stopPropagation();
    const context = this.supplyPopupRef();
    if (!context || row.userId !== this.activeUser().id) {
      return;
    }
    this.pendingSupplyDeleteRef.set({
      subEventId: context.subEventId,
      assetId: context.assetId,
      entryId: row.id,
      label: `${row.name} · ${row.quantity}`,
      busy: false,
      error: null
    });
  }

  private confirmDeleteSupplyContribution(): void {
    const pending = this.pendingSupplyDeleteRef();
    if (!pending || pending.busy) {
      return;
    }
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }

    const currentEntries = nextState.supplyContributionEntriesByAssetId[pending.assetId] ?? [];
    nextState.supplyContributionEntriesByAssetId = {
      ...nextState.supplyContributionEntriesByAssetId,
      [pending.assetId]: currentEntries.filter(entry => entry.id !== pending.entryId)
    };

    const requestVersion = ++this.pendingSupplyDeleteRequestVersion;
    const abortController = new AbortController();
    this.pendingSupplyDeleteAbortController = abortController;
    this.pendingSupplyDeleteRef.set({
      ...pending,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingSupplyDeleteAbortController === abortController) {
          this.pendingSupplyDeleteAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingSupplyDeleteRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.pendingSupplyDeleteRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingSupplyDeleteAbortController === abortController) {
          this.pendingSupplyDeleteAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingSupplyDeleteRequestVersion) {
          return;
        }
        const currentPending = this.pendingSupplyDeleteRef();
        if (!currentPending || currentPending.entryId !== pending.entryId) {
          return;
        }
        this.pendingSupplyDeleteRef.set({
          ...currentPending,
          busy: false,
          error: 'Unable to delete quantity row.'
        });
      });
  }

  private cancelDeleteSupplyContribution(): void {
    this.abortPendingSupplyDeleteRequest();
    this.pendingSupplyDeleteRef.set(null);
  }

  private abortPendingSupplyDeleteRequest(): void {
    this.pendingSupplyDeleteRequestVersion += 1;
    const controller = this.pendingSupplyDeleteAbortController;
    this.pendingSupplyDeleteAbortController = null;
    controller?.abort();
  }

  private isAbortError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError';
  }

  private pendingDeleteLabel(): string {
    const pending = this.pendingSupplyDeleteRef();
    return pending ? `Delete "${pending.label}" from supplies?` : '';
  }

  private supplyContributionTotalQuantity(): number {
    const context = this.supplyPopupRef();
    if (!context) {
      return 0;
    }
    return this.subEventSupplyContributionEntries(context.subEventId, context.assetId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private supplyContributionTotalLabel(): string {
    return this.quantityLabel(this.supplyContributionTotalQuantity());
  }

  private addedLabel(addedAtIso: string): string {
    const parsed = new Date(addedAtIso);
    const value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private quantityLabel(quantity: number): string {
    const normalized = AppUtils.clampNumber(Math.trunc(quantity), 0, Number.MAX_SAFE_INTEGER);
    return normalized === 1 ? '1 item' : `${normalized} items`;
  }

  private selectResourceFilter(filter: AppTypes.SubEventResourceFilter): void {
    if (filter === 'Members') {
      return;
    }
    this.resourceFilterRef.set(filter);
    this.inlineItemActionMenuRef.set(null);
    this.resourceAssetViewIdRef.set(null);
    this.resourceAssetViewModeRef.set('view');
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
    this.assignedAssetJoinDialogRef.set(null);
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(null);
  }

  private onResourceFilterOpened(isOpen: boolean, select: MatSelect): void {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }
    const overlayRef = (
      select as unknown as { _overlayDir?: { overlayRef?: { updatePosition: () => void } } }
    )._overlayDir?.overlayRef;
    const reposition = (): void => {
      if (select.panelOpen) {
        overlayRef?.updatePosition();
      }
    };
    window.requestAnimationFrame(() => {
      reposition();
      window.setTimeout(reposition, 0);
      window.setTimeout(reposition, 40);
    });
  }

  private resourceCards(): AppTypes.SubEventResourceCard[] {
    const context = this.popupContextRef();
    if (!context) {
      return [];
    }
    const type = this.resourceFilterRef();
    const assignedIds = this.resolveSubEventAssignedAssetIds(context.subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const fallbackCards = context.fallbackCardsByType[type] ?? [];
    const fallbackCardById = new Map(fallbackCards.map(card => [card.id, card] as const));

    return assignedIds
      .map(id => (
        this.ownedAssets.assetCards.find(card => card.id === id && card.type === type)
        ?? fallbackCardById.get(id)
        ?? null
      ))
      .filter((card): card is AppTypes.AssetCard => card !== null)
      .map(card => {
      const managerUserId = (type === 'Car' || type === 'Accommodation')
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

  private occupancyLabel(card: AppTypes.SubEventResourceCard): string {
    const context = this.popupContextRef();
    if (card.type === 'Supplies' && card.sourceAssetId && context) {
      return `${this.subEventSupplyProvidedCount(card.sourceAssetId, context.subEvent.id)} / 1 - ${card.capacityTotal}`;
    }
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  private isAssignedAssetOwnedByActiveUser(card: AppTypes.SubEventResourceCard): boolean {
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppTypes.AssetType, card.sourceAssetId);
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

  private isAssignedAssetManagedByActiveUser(card: AppTypes.SubEventResourceCard): boolean {
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId) === this.activeUser().id;
  }

  private isAssetOwnedByActiveUser(
    card: AppTypes.AssetCard,
    activeUserId = this.activeUser().id.trim(),
    ownerUserId = `${card.ownerUserId ?? ''}`.trim()
  ): boolean {
    return ownerUserId.length > 0
      ? ownerUserId === activeUserId
      : this.ownedAssets.assetCards.some(item => item.id === card.id && item.type === card.type);
  }

  private isSubEventScopedAssetRequest(request: AppTypes.AssetMemberRequest, subEventId: string): boolean {
    return ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEventId)
      || `${request.booking?.subEventId ?? ''}`.trim() === subEventId.trim();
  }

  private subEventScopedAssetRequests(
    card: AppTypes.AssetCard,
    subEventId: string
  ): AppTypes.AssetMemberRequest[] {
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
    card: AppTypes.AssetCard,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppTypes.AssetMemberRequest | null {
    return this.subEventScopedAssetRequests(card, subEventId)
      .find(request =>
        request.requestKind !== 'manual'
        && AppUtils.resolveAssetRequestUserId(request, this.users) === activeUserId
      ) ?? null;
  }

  private assignedAssetJoinMemberCounts(
    card: AppTypes.AssetCard,
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
    card: AppTypes.AssetCard,
    subEventId: string,
    managerUserId: string | null = null
  ): AppTypes.AssetMemberRequest[] {
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
    card: AppTypes.AssetCard,
    subEvent: AppTypes.SubEventFormItem,
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

  private canOpenResourceMap(card: AppTypes.SubEventResourceCard): boolean {
    if (!card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes).some(stop => stop.trim().length > 0);
  }

  private openResourceMap(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type as AppTypes.AssetType, card.routes);
    if (card.type === 'Accommodation') {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }

  private toggleItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenuRef()?.id === card.id) {
      this.inlineItemActionMenuRef.set(null);
      return;
    }
    this.inlineItemActionMenuRef.set({
      id: card.id,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    });
  }

  private canJoin(card: AppTypes.SubEventResourceCard): boolean {
    const context = this.popupContextRef();
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

  private join(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
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
    this.assignedAssetJoinDialogRef.set({
      cardId: card.id,
      type,
      sourceAssetId: sourceCard.id,
      acceptedPolicyIds: [...new Set(existingRequest?.booking?.acceptedPolicyIds ?? [])]
        .map(item => `${item ?? ''}`.trim())
        .filter(item => item.length > 0 && validPolicyIds.has(item)),
      busy: false,
      error: null
    });
    this.inlineItemActionMenuRef.set(null);
  }

  private canLeave(card: AppTypes.SubEventResourceCard): boolean {
    const context = this.popupContextRef();
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

  private leave(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
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
    this.inlineItemActionMenuRef.set(null);
    if (this.assignedAssetJoinDialogRef()?.sourceAssetId === sourceCard.id) {
      this.assignedAssetJoinDialogRef.set(null);
    }
    if (this.isAssetOwnedByActiveUser(sourceCard)) {
      this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(asset => (
        asset.id === sourceCard.id && asset.type === sourceCard.type
          ? {
              ...asset,
              requests: nextRequests
            }
          : asset
      ));
      this.syncPopupSubEventMetrics();
      return;
    }
    const activeContext = this.popupContextRef();
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
    this.popupContextRef.set(nextContext);
    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(nextContext);
  }

  private closeAssignedAssetJoinDialog(event?: Event): void {
    event?.stopPropagation();
    this.assignedAssetJoinDialogRef.set(null);
  }

  private toggleAssignedAssetJoinPolicy(policyId: string): void {
    const dialog = this.assignedAssetJoinDialogRef();
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
    this.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  private canSubmitAssignedAssetJoin(): boolean {
    const dialog = this.assignedAssetJoinDialogRef();
    const context = this.popupContextRef();
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

  private confirmAssignedAssetJoin(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.assignedAssetJoinDialogRef();
    const context = this.popupContextRef();
    if (!dialog || !context) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      this.assignedAssetJoinDialogRef.set({
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
    const nextRequest: AppTypes.AssetMemberRequest = {
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
    const nextRequests: AppTypes.AssetMemberRequest[] = [
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
    this.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds,
      busy: true,
      error: null
    });
    const startedAt = Date.now();
    void this.ensureAssignedAssetJoinMinimumBusyDuration(startedAt)
      .then(() => {
        if (this.isAssetOwnedByActiveUser(sourceCard)) {
          this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(asset => (
            asset.id === sourceCard.id && asset.type === sourceCard.type
              ? {
                  ...asset,
                  requests: nextRequests
                }
              : asset
          ));
          this.assignedAssetJoinDialogRef.set(null);
          this.syncPopupSubEventMetrics();
          return;
        }

        const activeContext = this.popupContextRef();
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
        this.popupContextRef.set(nextContext);
        this.syncPopupSubEventMetrics(false);
        this.persistPopupResourceState(nextContext);
        this.assignedAssetJoinDialogRef.set(null);
      });
  }

  private canEditCapacity(card: AppTypes.SubEventResourceCard): boolean {
    return this.isAssignedAssetOwnedByActiveUser(card);
  }

  private canEditRoute(card: AppTypes.SubEventResourceCard): boolean {
    return card.type === 'Car' && this.canEditCapacity(card);
  }

  private openCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId || !this.canEditCapacity(card)) {
      return;
    }
    const type = card.type as AppTypes.AssetType;
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
    if (!source) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const current = settings[card.sourceAssetId];
    const capacityLimit = Math.max(0, source.capacityTotal);
    const capacityMax = AppUtils.clampNumber(Math.trunc(current?.capacityMax ?? capacityLimit), 0, capacityLimit);
    const capacityMin = AppUtils.clampNumber(Math.trunc(current?.capacityMin ?? 0), 0, capacityMax);
    this.abortPendingCapacitySaveRequest();
    this.capacityEditorRef.set({
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
    this.routeEditorRef.set(null);
    this.pendingResourceDeleteRef.set(null);
    this.inlineItemActionMenuRef.set(null);
  }

  private closeCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingCapacitySaveRequest();
    this.capacityEditorRef.set(null);
  }

  private canSubmitCapacityEditor(): boolean {
    const editor = this.capacityEditorRef();
    return !!editor
      && !editor.busy
      && editor.capacityMin >= 0
      && editor.capacityMax >= editor.capacityMin
      && editor.capacityMax <= editor.capacityLimit;
  }

  private onCapacityMinChange(value: number | string): void {
    const editor = this.capacityEditorRef();
    if (!editor || editor.busy) {
      return;
    }
    const parsed = Number(value);
    this.capacityEditorRef.set({
      ...editor,
      capacityMin: AppUtils.clampNumber(
        Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMin,
        0,
        editor.capacityMax
      ),
      error: null
    });
  }

  private onCapacityMaxChange(value: number | string): void {
    const editor = this.capacityEditorRef();
    if (!editor || editor.busy) {
      return;
    }
    const parsed = Number(value);
    const capacityMax = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMax,
      0,
      editor.capacityLimit
    );
    this.capacityEditorRef.set({
      ...editor,
      capacityMin: Math.min(editor.capacityMin, capacityMax),
      capacityMax,
      error: null
    });
  }

  private saveCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.capacityEditorRef();
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
    this.capacityEditorRef.set({
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
        this.capacityEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingCapacitySaveAbortController === abortController) {
          this.pendingCapacitySaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingCapacitySaveRequestVersion) {
          return;
        }
        const currentEditor = this.capacityEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.capacityEditorRef.set({
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

  private openRouteEditor(card: AppTypes.SubEventResourceCard, event: Event, mode: 'view' | 'edit' = 'edit'): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    if (!context || card.type !== 'Car' || !card.sourceAssetId) {
      return;
    }
    const resolvedMode: 'view' | 'edit' = mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view';
    if (mode === 'edit' && resolvedMode !== 'edit') {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === 'Car');
    const routes = this.normalizeAssetRoutes('Car', settings[card.sourceAssetId]?.routes ?? source?.routes);
    this.abortPendingRouteSaveRequest();
    this.routeEditorRef.set({
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
    this.capacityEditorRef.set(null);
    this.pendingResourceDeleteRef.set(null);
    this.inlineItemActionMenuRef.set(null);
  }

  private openResourceServiceChat(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppTypes.AssetType, card.sourceAssetId)
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
    this.inlineItemActionMenuRef.set(null);
    this.activitiesContext.openEventChat(chat, this.buildServiceChatContext(chat));
  }

  private canReportAssetExploreOwner(card: AppTypes.AssetCard): boolean {
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    return !!this.popupContextRef() && !!ownerUserId && ownerUserId !== activeUserId;
  }

  private reportAssetExploreOwner(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
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

  private canReportResourceManager(card: AppTypes.SubEventResourceCard): boolean {
    const target = this.resolveResourceReportTarget(card);
    return !!target && target.userId !== this.activeUser().id.trim();
  }

  private reportResourceManager(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    const target = this.resolveResourceReportTarget(card);
    if (!context || !target || target.userId === this.activeUser().id.trim()) {
      return;
    }
    this.inlineItemActionMenuRef.set(null);
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

  private resolveResourceReportTarget(card: AppTypes.SubEventResourceCard): {
    userId: string;
    name: string;
    ownerType: AppTypes.ActivityMemberOwnerType;
  } | null {
    const context = this.popupContextRef();
    if (!context) {
      return null;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppTypes.AssetType, card.sourceAssetId)
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
    const eventRecord = this.eventsService.peekKnownItemById(this.activeUser().id.trim(), context.ownerId);
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
    return this.appCtx.getUserProfile(normalizedUserId)?.name?.trim()
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

  private closeRouteEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingRouteSaveRequest();
    this.routeEditorRef.set(null);
  }

  private addRouteStop(): void {
    const editor = this.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view') {
      return;
    }
    this.routeEditorRef.set({
      ...editor,
      routes: [...editor.routes, ''],
      routeRowIds: [...editor.routeRowIds, this.nextRouteEditorRowId()],
      error: null
    });
  }

  private removeRouteStop(index: number): void {
    const editor = this.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    this.routeEditorRef.set({
      ...editor,
      routes: editor.routes.filter((_stop, stopIndex) => stopIndex !== index),
      routeRowIds: editor.routeRowIds.filter((_routeRowId, stopIndex) => stopIndex !== index),
      error: null
    });
  }

  private dropRouteStop(event: CdkDragDrop<string[]>): void {
    const editor = this.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || event.previousIndex === event.currentIndex) {
      return;
    }
    const routes = [...editor.routes];
    const routeRowIds = [...editor.routeRowIds];
    const [moved] = routes.splice(event.previousIndex, 1);
    const [movedRouteRowId] = routeRowIds.splice(event.previousIndex, 1);
    routes.splice(event.currentIndex, 0, moved);
    routeRowIds.splice(event.currentIndex, 0, movedRouteRowId);
    this.routeEditorRef.set({
      ...editor,
      routes,
      routeRowIds,
      error: null
    });
  }

  private updateRouteStop(index: number, value: string): void {
    const editor = this.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    const routes = [...editor.routes];
    routes[index] = value;
    this.routeEditorRef.set({
      ...editor,
      routes,
      error: null
    });
  }

  private openRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsSearch(editor.routes[index] ?? '');
  }

  private openRouteMap(event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsDirections(editor.routes);
  }

  private canSubmitRouteEditor(): boolean {
    const editor = this.routeEditorRef();
    return !!editor && editor.mode !== 'view' && !editor.busy && editor.routes.some(stop => stop.trim().length > 0);
  }

  private saveRouteEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
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
    const source = this.ownedAssets.assetCards.find(item => item.id === editor.assetId && item.type === editor.type);
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
    this.routeEditorRef.set({
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
        this.routeEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingRouteSaveAbortController === abortController) {
          this.pendingRouteSaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingRouteSaveRequestVersion) {
          return;
        }
        const currentEditor = this.routeEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.routeEditorRef.set({
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

  private requestDeleteResourceCard(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId) {
      return;
    }
    this.pendingResourceDeleteRef.set({
      assetId: card.sourceAssetId,
      title: card.title,
      busy: false,
      error: null
    });
    this.inlineItemActionMenuRef.set(null);
  }

  private confirmDeleteResourceCard(): void {
    const pending = this.pendingResourceDeleteRef();
    if (!pending || pending.busy) {
      return;
    }
    this.pendingResourceDeleteRef.set({
      ...pending,
      busy: true,
      error: null
    });
    void this.ownedAssets.deleteAssetCardById(pending.assetId)
      .then(deleted => {
        const currentPending = this.pendingResourceDeleteRef();
        if (!currentPending || currentPending.assetId !== pending.assetId) {
          return;
        }
        if (!deleted) {
          this.pendingResourceDeleteRef.set({
            ...currentPending,
            busy: false,
            error: 'Unable to delete resource card.'
          });
          return;
        }
        this.pendingResourceDeleteRef.set(null);
      })
      .catch(() => {
        const currentPending = this.pendingResourceDeleteRef();
        if (!currentPending || currentPending.assetId !== pending.assetId) {
          return;
        }
        this.pendingResourceDeleteRef.set({
          ...currentPending,
          busy: false,
          error: 'Unable to delete resource card.'
        });
      });
  }

  private cancelDeleteResourceCard(): void {
    const pending = this.pendingResourceDeleteRef();
    if (pending?.busy) {
      return;
    }
    this.pendingResourceDeleteRef.set(null);
  }

  private resourceDeleteCardLabel(): string {
    const pending = this.pendingResourceDeleteRef();
    return pending ? `Delete "${pending.title}"?` : '';
  }

  private openAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.pendingAssignSaveRef.set(null);
    const type = this.resourceFilterRef();
    this.assignContextRef.set({ subEventId: context.subEvent.id, type });
    this.selectedAssignAssetIdsRef.set([...this.resolveSubEventAssignedAssetIds(context.subEvent.id, type)]);
    this.ownedAssets.openPopup(type);
    this.assetPopupService.syncVisibility(true, false, true);
  }

  private openExplorePopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourceFilterRef();
    const { startAtIso, endAtIso } = this.defaultAssetExploreRange(context.subEvent);
    this.assignedAssetJoinDialogRef.set(null);
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      subEventId: context.subEvent.id,
      type,
      category: AssetDefaultsBuilder.defaultCategory(type),
      startAtIso,
      endAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  private closeExplorePopup(event?: Event): void {
    event?.stopPropagation();
    if (this.assetExploreOnlyRef()) {
      this.closeResourcePopup();
      return;
    }
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(null);
  }

  private readonly assetExplorePopupViewState = computed<AssetExplorePopupViewState | null>(() => {
    const popup = this.assetExplorePopupRef();
    const context = this.popupContextRef();
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
      categoryDisplay: AssetDefaultsBuilder.assetCategoryLabel(popup.category),
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

  private readonly assetExploreBorrowDialogViewState = computed<AssetExploreBorrowDialogViewState | null>(() => {
    const dialog = this.assetExploreBorrowDialogRef();
    const popup = this.assetExplorePopupRef();
    const context = this.popupContextRef();
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

  private readonly assignedAssetJoinDialogViewState = computed<AssignedAssetJoinDialogViewState | null>(() => {
    const dialog = this.assignedAssetJoinDialogRef();
    const context = this.popupContextRef();
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

  private readonly assetExploreBorrowDraftsViewState = computed<AssetExploreBorrowDraftViewState[]>(() => {
    const popup = this.assetExplorePopupRef();
    const context = this.popupContextRef();
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

  private selectAssetExploreCategory(category: string, event?: Event): void {
    event?.stopPropagation();
    const popup = this.assetExplorePopupRef();
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
    this.assetExplorePopupRef.set({
      ...popup,
      type: nextType,
      category: nextCategory,
      loading: true,
      error: null
    });
    this.scheduleAssetExploreCardsLoad();
  }

  private setAssetExploreDateRange(start: Date | null, end: Date | null): void {
    const popup = this.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    const nextStartAtIso = AppUtils.applyDatePartToIsoLocal(popup.startAtIso, start);
    const nextEndAtIso = AppUtils.applyDatePartToIsoLocal(popup.endAtIso, end);
    this.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      ...popup,
      startAtIso: nextStartAtIso,
      endAtIso: nextEndAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  private setAssetExploreTime(edge: 'start' | 'end', value: string): void {
    const popup = this.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    this.assetExplorePopupRef.set(this.resolveAssetExplorePopupState({
      ...popup,
      startAtIso: edge === 'start' ? AppUtils.applyTimePartToIsoLocal(popup.startAtIso, value) : popup.startAtIso,
      endAtIso: edge === 'end' ? AppUtils.applyTimePartToIsoLocal(popup.endAtIso, value) : popup.endAtIso
    }));
    this.scheduleAssetExploreCardsLoad();
  }

  private async loadAssetExploreCards(): Promise<void> {
    const popup = this.assetExplorePopupRef();
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
      const current = this.assetExplorePopupRef();
      if (!current || requestVersion !== this.pendingAssetExploreRequestVersion) {
        return;
      }
      if (this.assetExploreQueryKey(this.assetExploreQueryFromPopup(current)) !== queryKey) {
        return;
      }
      this.assetExplorePopupRef.set({
        ...current,
        loading: false,
        error: null,
        cards: sortedCards.map(card => this.cloneAsset(card))
      });
    } catch {
      const current = this.assetExplorePopupRef();
      if (!current || requestVersion !== this.pendingAssetExploreRequestVersion) {
        return;
      }
      this.assetExplorePopupRef.set({
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
      if (!this.assetExplorePopupRef()) {
        return;
      }
      void this.loadAssetExploreCards();
    });
  }

  private scheduleAssetExploreWarmup(
    type: AppTypes.AssetType = this.resourceFilterRef(),
    context: ResourcePopupContext | null = this.popupContextRef()
  ): void {
    if (!context) {
      return;
    }
    const userId = this.activeUser().id.trim();
    if (!userId) {
      return;
    }
    const { startAtIso, endAtIso } = this.defaultAssetExploreRange(context.subEvent);
    const query: AppTypes.AssetExploreQuery = {
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

  private async prewarmAssetExploreQuery(query: AppTypes.AssetExploreQuery): Promise<void> {
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
  ): AppTypes.AssetExploreQuery {
    return {
      userId: this.activeUser().id,
      type: popup.type,
      category: popup.category,
      startAtIso: popup.startAtIso,
      endAtIso: popup.endAtIso
    };
  }

  private assetExploreQueryKey(query: AppTypes.AssetExploreQuery): string {
    return [
      query.userId.trim(),
      query.type,
      `${query.category ?? ''}`.trim(),
      `${query.startAtIso ?? ''}`.trim(),
      `${query.endAtIso ?? ''}`.trim()
    ].join('|');
  }

  private peekAssetExploreWarmCache(query: AppTypes.AssetExploreQuery): AppTypes.AssetCard[] | null {
    const cached = this.assetExploreWarmCacheByKey.get(this.assetExploreQueryKey(query));
    return cached ? cached.map(card => this.cloneAsset(card)) : null;
  }

  private storeAssetExploreWarmCache(queryKey: string, cards: readonly AppTypes.AssetCard[]): void {
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
    cards: readonly AppTypes.AssetCard[],
    startAtIso: string,
    endAtIso: string
  ): AppTypes.AssetCard[] {
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

  private assetExploreAvailabilityLabel(card: AppTypes.AssetCard): string {
    const available = this.assetExploreAvailableQuantity(card);
    if (available <= 0) {
      return '0 left';
    }
    return `${available} left`;
  }

  private assetExploreAvailableQuantity(card: AppTypes.AssetCard): number {
    const popup = this.assetExplorePopupRef();
    if (!popup) {
      return 0;
    }
    return this.assetExploreAvailableQuantityForWindow(card, popup.startAtIso, popup.endAtIso);
  }

  private assetExploreAvailableQuantityForWindow(
    card: AppTypes.AssetCard,
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
    card: AppTypes.AssetCard,
    startAtIso: string,
    endAtIso: string
  ): number {
    const subEventId = `${this.popupContextRef()?.subEvent.id ?? ''}`.trim();
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

  private openAssetExploreServiceChat(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
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
    this.activitiesContext.openEventChat(chat, this.buildServiceChatContext(chat));
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
  }): ChatMenuItem & { ownerUserId?: string } {
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

  private buildServiceChatContext(chat: ChatMenuItem): AppTypes.EventChatContext {
    return {
      channelType: 'serviceEvent',
      hasSubEventMenu: false,
      actionIcon: 'support_agent',
      actionLabel: 'View Event',
      actionToneClass: 'popup-chat-context-btn-tone-main-event',
      actionBadgeCount: 0,
      menuTitle: chat.title,
      eventRow: null,
      subEventRow: null,
      subEvent: null,
      group: null,
      assetAssignmentIds: {
        Car: [],
        Accommodation: [],
        Supplies: []
      },
      assetCardsByType: {
        Car: [],
        Accommodation: [],
        Supplies: []
      },
      resources: []
    };
  }

  private openAssetExploreBorrowDialog(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    const popup = this.assetExplorePopupRef();
    const context = this.popupContextRef();
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
      this.assetExplorePopupRef.set({
        ...popup,
        error: null
      });
    }
    this.assetExploreBorrowDialogRef.set({
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

  private closeAssetExploreBorrowDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.assetExploreBorrowDialogRef();
    const context = this.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (dialog && context && !dialog.busy && this.shouldPersistAssetExploreBorrowDraft(dialog, context.subEvent.id, activeUserId)) {
      this.saveAssetExploreBorrowDraft(activeUserId, context.subEvent.id, dialog);
    }
    this.assetExploreBorrowDialogRef.set(null);
  }

  private setAssetExploreBorrowDateRange(start: Date | null, end: Date | null): void {
    const dialog = this.assetExploreBorrowDialogRef();
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
    this.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  private setAssetExploreBorrowTime(edge: 'start' | 'end', value: string): void {
    const dialog = this.assetExploreBorrowDialogRef();
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
    this.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  private onAssetExploreBorrowQuantityChange(value: number | string): void {
    const dialog = this.assetExploreBorrowDialogRef();
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
    this.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity: requestedQuantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(requestedQuantity, dialog.availableQuantity)
    });
  }

  private normalizeAssetExploreBorrowQuantityOnBlur(value: number | string): void {
    const dialog = this.assetExploreBorrowDialogRef();
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
    this.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity: normalizedQuantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.assetExploreBorrowAvailabilityError(normalizedQuantity, dialog.availableQuantity)
    });
  }

  private toggleAssetExploreBorrowPolicy(policyId: string): void {
    const dialog = this.assetExploreBorrowDialogRef();
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
    this.assetExploreBorrowDialogRef.set({
      ...invalidated,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  private backAssetExploreBorrowToDetails(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy || !dialog.paymentStep) {
      return;
    }
    this.assetExploreBorrowDialogRef.set({
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

  private ensureAssetExploreBorrowMinimumBusyDuration(startedAtMs: number): Promise<void> {
    const minimumBusyDurationMs = resolveCurrentDemoDelayMs(SubEventResourcePopupService.ASSET_EXPLORE_BORROW_MIN_BUSY_DURATION_MS);
    const remainingMs = minimumBusyDurationMs - (Date.now() - startedAtMs);
    if (remainingMs <= 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      setTimeout(resolve, remainingMs);
    });
  }

  private ensureAssignedAssetJoinMinimumBusyDuration(startedAtMs: number): Promise<void> {
    const minimumBusyDurationMs = resolveCurrentDemoDelayMs(SubEventResourcePopupService.ASSET_EXPLORE_BORROW_MIN_BUSY_DURATION_MS);
    const remainingMs = minimumBusyDurationMs - (Date.now() - startedAtMs);
    if (remainingMs <= 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      setTimeout(resolve, remainingMs);
    });
  }

  private canSubmitAssetExploreBorrow(): boolean {
    const dialog = this.assetExploreBorrowDialogRef();
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

  private confirmAssetExploreBorrow(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.assetExploreBorrowDialogRef();
    const popup = this.assetExplorePopupRef();
    const context = this.popupContextRef();
    if (!dialog || !popup || !context) {
      return;
    }
    const card = this.resolveAssetExploreCard(dialog.cardId);
    if (!card) {
      this.assetExplorePopupRef.set({
        ...popup,
        error: 'This basket item is no longer available for the selected date range.'
      });
      this.assetExploreBorrowDialogRef.set(null);
      return;
    }
    const availableQuantity = this.assetExploreAvailableQuantityForWindow(card, dialog.startAtIso, dialog.endAtIso);
    const availabilityError = this.assetExploreBorrowAvailabilityError(dialog.quantity, availableQuantity);
    if (availabilityError) {
      const invalidated = this.invalidateAssetExploreBorrowCheckout(dialog);
      this.assetExploreBorrowDialogRef.set({
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
    const lineItems: AppTypes.EventCheckoutLineItem[] = [
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
        } satisfies AppTypes.EventCheckoutRequest
      : null;

    if (inventoryApplied && !dialog.paymentStep) {
      const startedAt = Date.now();
      this.assetExploreBorrowDialogRef.set({
        ...dialog,
        busy: true,
        error: null
      });
      void this.eventsService.createCheckoutSession(checkoutRequest!)
        .then(async session => {
          await this.ensureAssetExploreBorrowMinimumBusyDuration(startedAt);
          if (!session?.id) {
            throw new Error('Unable to start checkout.');
          }
          const currentDialog = this.assetExploreBorrowDialogRef();
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
          this.assetExploreBorrowDialogRef.set(nextDialog);
          this.saveAssetExploreBorrowDraft(activeUser.id, context.subEvent.id, nextDialog);
        })
        .catch(async error => {
          await this.ensureAssetExploreBorrowMinimumBusyDuration(startedAt);
          const currentDialog = this.assetExploreBorrowDialogRef();
          if (!currentDialog || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
            return;
          }
          this.assetExploreBorrowDialogRef.set({
            ...currentDialog,
            busy: false,
            error: this.resolveAssetExploreBorrowErrorMessage(error, 'Unable to start checkout.')
          });
        });
      return;
    }

    const startedAt = Date.now();
    this.assetExploreBorrowDialogRef.set({
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
        } satisfies AppTypes.EventCheckoutSession : null);

    void checkoutSessionPromise
      .then(async session => {
        if (inventoryApplied && (!session || !session.id)) {
          throw new Error('Unable to start payment.');
        }
        const nextRequest: AppTypes.AssetMemberRequest = {
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
        const nextCard: AppTypes.AssetCard = {
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
        const savedCard = await this.assetsService.saveOwnedAsset(dialog.ownerUserId, nextCard);
        await this.ensureAssetExploreBorrowMinimumBusyDuration(startedAt);
        return savedCard;
      })
      .then(savedCard => {
        const currentDialog = this.assetExploreBorrowDialogRef();
        const currentPopup = this.assetExplorePopupRef();
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
        this.assetExplorePopupRef.set({
          ...currentPopup,
          cards: nextCards
        });
        this.storeAssetExploreWarmCache(
          this.assetExploreQueryKey(this.assetExploreQueryFromPopup(currentPopup)),
          nextCards
        );
        this.closeAssetExploreBorrowDialog();
      })
      .catch(async error => {
        await this.ensureAssetExploreBorrowMinimumBusyDuration(startedAt);
        const currentDialog = this.assetExploreBorrowDialogRef();
        if (!currentDialog || requestVersion !== this.pendingAssetExploreBorrowRequestVersion) {
          return;
        }
        this.assetExploreBorrowDialogRef.set({
          ...currentDialog,
          busy: false,
          error: this.resolveAssetExploreBorrowErrorMessage(error, 'Unable to send the borrow request.')
        });
      });
  }

  private resumeAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.resolveAssetExploreCard(cardId);
    if (!card) {
      const popup = this.assetExplorePopupRef();
      if (popup) {
        this.assetExplorePopupRef.set({
          ...popup,
          error: 'This basket item is no longer available for the selected date range.'
        });
      }
      return;
    }
    this.openAssetExploreBorrowDialog(card, event);
  }

  private clearAssetExploreBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    this.clearAssetExploreBorrowDraftState(activeUserId, context.subEvent.id, cardId);
    if (this.assetExploreBorrowDialogRef()?.cardId === cardId) {
      this.assetExploreBorrowDialogRef.set(null);
    }
  }

  private listAssetExploreBorrowDrafts(
    userId: string,
    subEventId: string
  ): AssetExploreBorrowDraftState[] {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedUserId || !normalizedSubEventId) {
      return [];
    }
    return Object.values(this.assetExploreBorrowDraftsRef())
      .filter(draft => draft.userId === normalizedUserId && draft.subEventId === normalizedSubEventId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  private readAssetExploreBorrowDraft(
    userId: string,
    subEventId: string,
    cardId: string
  ): AssetExploreBorrowDraftState | null {
    const key = this.assetExploreBorrowDraftKey(userId, subEventId, cardId);
    return key ? this.assetExploreBorrowDraftsRef()[key] ?? null : null;
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
    this.assetExploreBorrowDraftsRef.set({
      ...this.assetExploreBorrowDraftsRef(),
      [key]: next
    });
  }

  private clearAssetExploreBorrowDraftState(
    userId: string,
    subEventId: string,
    cardId: string
  ): void {
    const key = this.assetExploreBorrowDraftKey(userId, subEventId, cardId);
    if (!key || !this.assetExploreBorrowDraftsRef()[key]) {
      return;
    }
    const next = { ...this.assetExploreBorrowDraftsRef() };
    delete next[key];
    this.assetExploreBorrowDraftsRef.set(next);
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

  private closeAssignPopup(apply = false): void {
    if (apply) {
      this.confirmAssignPopup();
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.pendingAssignSaveRef.set(null);
    this.assignContextRef.set(null);
    this.selectedAssignAssetIdsRef.set([]);
    this.assetPopupService.setBasketVisible(false);
    this.ownedAssets.closePopup();
  }

  private confirmAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.assignContextRef();
    const nextState = this.buildNextAssignResourceState();
    if (!context || !nextState || !this.canConfirmAssignSelection()) {
      return;
    }

    const requestVersion = ++this.pendingAssignSaveRequestVersion;
    const abortController = new AbortController();
    this.pendingAssignSaveAbortController = abortController;
    this.pendingAssignSaveRef.set({
      subEventId: context.subEventId,
      type: context.type,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingAssignSaveAbortController === abortController) {
          this.pendingAssignSaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingAssignSaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.syncPopupSubEventMetrics(false);
        this.pendingAssignSaveRef.set(null);
        this.closeAssignPopup(false);
      })
      .catch(error => {
        if (this.pendingAssignSaveAbortController === abortController) {
          this.pendingAssignSaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingAssignSaveRequestVersion) {
          return;
        }
        const currentPending = this.pendingAssignSaveRef();
        if (!currentPending || currentPending.subEventId !== context.subEventId || currentPending.type !== context.type) {
          return;
        }
        this.pendingAssignSaveRef.set({
          ...currentPending,
          busy: false,
          error: 'Unable to save asset selection.'
        });
      });
  }

  private assignPopupTitle(): string {
    const context = this.assignContextRef();
    const popup = this.popupContextRef();
    if (!context || !popup) {
      return `Assign ${this.resourceFilterRef()}`;
    }
    const stageLabel = this.subEventStageLabel(popup.subEvent);
    return stageLabel ? `Assign ${context.type} - ${stageLabel}` : `Assign ${context.type}`;
  }

  private assignCandidates(): AppTypes.AssetCard[] {
    const context = this.assignContextRef();
    if (!context) {
      return [];
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEventId, context.type));
    return this.ownedAssets.assetCards
      .filter(card => card.type === context.type)
      .sort((a, b) => {
        const aAssigned = assignedIds.has(a.id) ? 1 : 0;
        const bAssigned = assignedIds.has(b.id) ? 1 : 0;
        if (aAssigned !== bAssigned) {
          return bAssigned - aAssigned;
        }
        return a.title.localeCompare(b.title);
      });
  }

  private assignSelectedChips(): AppTypes.AssetCard[] {
    const selected = new Set(this.selectedAssignAssetIdsRef());
    return this.assignCandidates().filter(card => selected.has(card.id));
  }

  private canConfirmAssignSelection(): boolean {
    const context = this.assignContextRef();
    if (!context || this.pendingAssignSaveRef()?.busy === true) {
      return false;
    }
    const currentIds = [...this.resolveSubEventAssignedAssetIds(context.subEventId, context.type)].sort();
    const draft = this.buildAssignSelectionDraft(context);
    const nextIds = [...draft.nextIds].sort();
    if (currentIds.length !== nextIds.length) {
      return true;
    }
    return currentIds.some((assetId, index) => assetId !== nextIds[index]);
  }

  private toggleAssignCard(cardId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.pendingAssignSaveRef()?.busy === true) {
      return;
    }
    if (this.pendingAssignSaveRef()?.error) {
      this.pendingAssignSaveRef.set(null);
    }
    if (this.selectedAssignAssetIdsRef().includes(cardId)) {
      this.selectedAssignAssetIdsRef.set(this.selectedAssignAssetIdsRef().filter(id => id !== cardId));
      return;
    }
    this.selectedAssignAssetIdsRef.set([...this.selectedAssignAssetIdsRef(), cardId]);
  }

  private buildNextAssignResourceState(): AppTypes.ActivitySubEventResourceState | null {
    const context = this.assignContextRef();
    const nextState = this.buildPopupResourceState();
    if (!context || !nextState) {
      return null;
    }
    const draft = this.buildAssignSelectionDraft(context);
    nextState.assetAssignmentIds = {
      ...nextState.assetAssignmentIds,
      [context.type]: [...draft.nextIds]
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [context.type]: draft.nextSettings
    };
    if (context.type === 'Supplies') {
      nextState.supplyContributionEntriesByAssetId = Object.fromEntries(
        Object.entries(nextState.supplyContributionEntriesByAssetId)
          .filter(([assetId]) => draft.nextIds.includes(assetId))
          .map(([assetId, entries]) => [assetId, entries.map(entry => ({ ...entry }))])
      );
    }
    return nextState;
  }

  private buildAssignSelectionDraft(
    context: { subEventId: string; type: AppTypes.AssetType }
  ): { nextIds: string[]; nextSettings: Record<string, AppTypes.SubEventAssignedAssetSettings> } {
    const allowedIds = new Set(this.ownedAssets.assetCards.filter(card => card.type === context.type).map(card => card.id));
    const nextIds = this.selectedAssignAssetIdsRef().filter((id, index, arr) => allowedIds.has(id) && arr.indexOf(id) === index);
    const key = this.subEventAssetAssignmentKey(context.subEventId, context.type);
    const previousSettings = this.assignedAssetSettingsByKey[key] ?? {};
    const nextSettings: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of nextIds) {
      const source = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === context.type);
      if (!source) {
        continue;
      }
      const previous = previousSettings[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      nextSettings[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(context.type, previous?.routes)
      };
    }
    return {
      nextIds,
      nextSettings
    };
  }

  private applyAssignSelection(): void {
    const context = this.assignContextRef();
    if (!context) {
      return;
    }
    const draft = this.buildAssignSelectionDraft(context);
    const key = this.subEventAssetAssignmentKey(context.subEventId, context.type);
    const previousSettings = this.assignedAssetSettingsByKey[key] ?? {};
    if (context.type === 'Supplies') {
      const removedIds = Object.keys(previousSettings).filter(assetId => !draft.nextIds.includes(assetId));
      for (const assetId of removedIds) {
        delete this.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(context.subEventId, assetId)];
      }
    }
    this.assignedAssetIdsByKey[key] = [...draft.nextIds];
    this.assignedAssetSettingsByKey[key] = draft.nextSettings;
    this.syncPopupSubEventMetrics();
  }

  private resourceFilterCount(type: AppTypes.AssetType): number {
    const context = this.popupContextRef();
    if (!context) {
      return 0;
    }
    return this.subEventAssetCapacityMetrics(context.subEvent, type).pending;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppTypes.AssetType): AppTypes.AssetCard[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(id => this.resolveSubEventAssignedAssetCard(subEventId, type, id))
      .filter((card): card is AppTypes.AssetCard => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppTypes.AssetType): Record<string, AppTypes.SubEventAssignedAssetSettings> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
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
    this.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppTypes.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = [
      ...this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id),
      ...this.subEventFallbackAssetCards(subEventId, type).map(card => card.id)
    ];
    const eligible = new Set(eligibleIds);
    const stored = this.assignedAssetIdsByKey[key];
    if (!stored) {
      this.assignedAssetIdsByKey[key] = [];
      return [];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length !== stored.length) {
      this.assignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private resolveSubEventAssignedAssetCard(
    subEventId: string,
    type: AppTypes.AssetType,
    assetId: string
  ): AppTypes.AssetCard | null {
    return this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === type)
      ?? this.subEventFallbackAssetCards(subEventId, type).find(card => card.id === assetId && card.type === type)
      ?? null;
  }

  private subEventFallbackAssetCards(
    subEventId: string,
    type: AppTypes.AssetType
  ): AppTypes.AssetCard[] {
    const context = this.popupContextRef();
    if (context?.subEvent.id !== subEventId) {
      return [];
    }
    return context.fallbackCardsByType[type] ?? [];
  }

  private seedAssignmentsFromRequest(
    subEventId: string,
    assetAssignmentIds: Partial<Record<AppTypes.AssetType, string[]>> | undefined,
    fallbackCardsByType: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): void {
    if (!subEventId || !assetAssignmentIds) {
      return;
    }
    const types: AppTypes.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const raw = assetAssignmentIds[type];
      if (!Array.isArray(raw)) {
        continue;
      }
      const allowedIds = new Set([
        ...this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id),
        ...(fallbackCardsByType[type] ?? []).map(card => card.id)
      ]);
      const normalized = raw.filter((id, index, arr): id is string =>
        typeof id === 'string' && arr.indexOf(id) === index && allowedIds.has(id)
      );
      this.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEventId, type)] = [...normalized];
    }
  }

  private subEventAssetCapacityMetrics(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = cards.reduce((sum, card) => {
      const managerUserId = (type === 'Car' || type === 'Accommodation')
        ? (`${settings[card.id]?.addedByUserId ?? ''}`.trim() || null)
        : null;
      return sum + this.assetPendingCount(card, subEvent.id, managerUserId);
    }, 0);
    if (type === 'Supplies') {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    const joinedIds = new Set<string>();
    for (const card of cards) {
      const managerUserId = (type === 'Car' || type === 'Accommodation')
        ? (`${settings[card.id]?.addedByUserId ?? ''}`.trim() || null)
        : null;
      for (const request of this.assetRequestsForView(card, subEvent.id, managerUserId)) {
        if (request.status === 'accepted') {
          joinedIds.add(AppUtils.resolveAssetRequestUserId(request, this.users) || request.userId || request.id);
        }
      }
    }
    return {
      joined: joinedIds.size,
      capacityMin,
      capacityMax,
      pending
    };
  }

  private syncPopupSubEventMetrics(persist = false): void {
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
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
    this.popupContextRef.set({
      ...context,
      subEvent: nextSubEvent
    });
    this.syncSubEventManualAssetRequests(nextSubEvent, persist);
    if (persist) {
      this.persistPopupResourceState({
        ...context,
        subEvent: nextSubEvent
      });
    }
    this.refreshEventChatSessionResourceContext(nextSubEvent);
  }

  private refreshEventChatSessionResourceContext(subEvent: AppTypes.SubEventFormItem): void {
    const context = this.popupContextRef();
    if (!context || context.origin !== 'chat') {
      return;
    }
    this.activitiesContext.touchEventChatSession(sessionContext => {
      if (sessionContext.subEvent?.id !== subEvent.id) {
        return sessionContext;
      }
      return {
        ...sessionContext,
        subEvent: this.cloneSubEvent(subEvent),
        assetAssignmentIds: {
          ...sessionContext.assetAssignmentIds,
          Car: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Car')],
          Accommodation: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Accommodation')],
          Supplies: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies')]
        },
        assetCardsByType: {
          Car: this.ownedAssets.assetCards.filter(card => card.type === 'Car').map(card => this.cloneAsset(card)),
          Accommodation: this.ownedAssets.assetCards.filter(card => card.type === 'Accommodation').map(card => this.cloneAsset(card)),
          Supplies: this.ownedAssets.assetCards.filter(card => card.type === 'Supplies').map(card => this.cloneAsset(card))
        },
        resources: sessionContext.resources.map(resource => ({ ...resource }))
      };
    });
  }

  private syncAssetRequestsFromMembers(
    assetId: string,
    assetType: 'Car' | 'Accommodation',
    members: readonly AppTypes.ActivityMemberEntry[]
  ): void {
    const context = this.popupContextRef();
    const asset = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === assetType)
      ?? (context ? this.subEventFallbackAssetCards(context.subEvent.id, assetType).find(card => card.id === assetId) ?? null : null);
    if (!asset) {
      return;
    }
    const isOwnedAsset = this.ownedAssets.assetCards.some(card => card.id === asset.id && card.type === assetType);
    const existingById = new Map(asset.requests.map(request => [request.id, request] as const));
    const existingByUserId = new Map(
      asset.requests.map(request => [AppUtils.resolveAssetRequestUserId(request, this.users), request] as const)
    );
    const existingByName = new Map(asset.requests.map(request => [request.name.toLowerCase(), request] as const));
    const now = Date.now();
    const booking = this.currentAssetRequestBooking(1);
    const memberRequests: AppTypes.AssetMemberRequest[] = members.map((entry, index) => {
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
      return {
        id: requestId,
        userId: entry.userId,
        name: entry.name,
        initials: entry.initials,
        gender: entry.gender,
        status: entry.status,
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
    const nextRequests: AppTypes.AssetMemberRequest[] = [...manualRequests, ...memberRequests];
    const currentSignature = JSON.stringify(asset.requests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    const nextSignature = JSON.stringify(nextRequests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    if (currentSignature === nextSignature) {
      return;
    }
    if (!isOwnedAsset) {
      if (!context) {
        return;
      }
      const activeContext = this.popupContextRef();
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
      this.popupContextRef.set(nextContext);
      this.syncPopupSubEventMetrics(false);
      this.persistPopupResourceState(nextContext);
      return;
    }
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card =>
      card.id === asset.id && card.type === asset.type
        ? { ...card, requests: nextRequests }
        : card
    );
    this.syncPopupSubEventMetrics();
  }

  private currentAssetRequestBooking(quantity: number): AppTypes.AssetHireRequestBooking | null {
    const context = this.popupContextRef();
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
    subEvent: AppTypes.SubEventFormItem,
    quantity: number,
    ownerId: string,
    parentTitle: string
  ): AppTypes.AssetHireRequestBooking | null {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    return this.assetRequestBookingForRange(subEvent, ownerId, parentTitle, startAtIso, endAtIso, quantity);
  }

  private assetRequestBookingForRange(
    subEvent: AppTypes.SubEventFormItem,
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
  ): AppTypes.AssetHireRequestBooking | null {
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

  private syncSubEventManualAssetRequests(subEvent: AppTypes.SubEventFormItem, persist = false): void {
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
    const activeUser = this.activeUser();
    let changed = false;
    const dirtyCards: AppTypes.AssetCard[] = [];
    const nextCards = this.ownedAssets.assetCards.map(card => {
      const nextManualRequest = this.buildManualAssignmentRequest(card, subEvent, context.ownerId, context.parentTitle, activeUser);
      const preservedRequests: AppTypes.AssetMemberRequest[] = card.requests
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
    card: AppTypes.AssetCard,
    subEvent: AppTypes.SubEventFormItem,
    ownerId: string,
    parentTitle: string,
    activeUser: UserDto
  ): AppTypes.AssetMemberRequest | null {
    if (card.type === 'Supplies') {
      const assignedSupplyIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies'));
      if (!assignedSupplyIds.has(card.id)) {
        return null;
      }
      const quantity = this.subEventSupplyProvidedCount(card.id, subEvent.id);
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
    subEvent: AppTypes.SubEventFormItem
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

  private resolveAssetExploreCard(cardId: string): AppTypes.AssetCard | null {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return null;
    }
    return this.assetExplorePopupRef()?.cards.find(card => card.id === normalizedCardId) ?? null;
  }

  private isValidAssetExploreWindow(startAtIso: string, endAtIso: string): boolean {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(endAtIso);
    return !!start && !!end && start.getTime() < end.getTime();
  }

  private resolveAssetExploreBorrowPricing(
    card: AppTypes.AssetCard,
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
    rule: AppTypes.PricingDemandRule,
    capacityFilledPercent: number
  ): boolean {
    if (rule.operator === 'lte') {
      return capacityFilledPercent <= rule.capacityFilledPercent;
    }
    return capacityFilledPercent >= rule.capacityFilledPercent;
  }

  private matchesPricingTimeRule(
    rule: AppTypes.PricingTimeRule,
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

  private applyPricingAction(currentPrice: number, action: AppTypes.PricingAction): number {
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

  private applyPricingRounding(price: number, rounding: AppTypes.PricingRoundingMode): number {
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

  private assetRequestQuantity(request: AppTypes.AssetMemberRequest): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }

  private isAssetExploreWindowOverlap(
    request: AppTypes.AssetMemberRequest,
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
    card: AppTypes.AssetCard,
    ownerUserId: string | null,
    subEventId?: string
  ): AppTypes.ActivityMemberEntry[] {
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
        const pendingSource: AppTypes.ActivityPendingSource = request.status === 'pending'
          ? (pendingRequiresAdminApproval ? 'admin' : 'member')
          : null;
        const requestKind: AppTypes.ActivityMemberRequestKind = request.status === 'pending'
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
          relevance: 40 + (seed % 61),
          avatarUrl: AppUtils.firstImageUrl(matchedUser?.images)
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
        tickets: 0,
        feedback: 0
      }
    };
  }

  private handleOwnedAssetDeleted(cardId: string): void {
    for (const key of Object.keys(this.supplyContributionEntriesByAssignmentKey)) {
      if (key.endsWith(`:${cardId}`)) {
        delete this.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const key of Object.keys(this.assignedAssetIdsByKey)) {
      this.assignedAssetIdsByKey[key] = this.assignedAssetIdsByKey[key].filter(id => id !== cardId);
    }
    for (const key of Object.keys(this.assignedAssetSettingsByKey)) {
      if (!this.assignedAssetSettingsByKey[key][cardId]) {
        continue;
      }
      const next = { ...this.assignedAssetSettingsByKey[key] };
      delete next[cardId];
      this.assignedAssetSettingsByKey[key] = next;
    }
    const supplyContext = this.supplyPopupRef();
    if (supplyContext?.assetId === cardId) {
      this.closeSupplyContributionsPopup();
    }
    this.syncPopupSubEventMetrics();
  }

  private handleOwnedAssetsChanged(): void {
    this.syncPopupSubEventMetrics();
  }

  private cloneSubEvent(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventFormItem {
    return {
      ...subEvent,
      pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : undefined,
      groups: Array.isArray(subEvent.groups)
        ? subEvent.groups.map(group => ({ ...group }))
        : []
    };
  }

  private cloneAsset(card: AppTypes.AssetCard): AppTypes.AssetCard {
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
    card: AppTypes.AssetCard,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppTypes.AssetMemberRequest | null {
    return card.requests.find(request =>
      request.requestKind !== 'manual'
      && request.status === 'pending'
      && AppUtils.resolveAssetRequestUserId(request, this.users) === activeUserId
      && request.booking?.subEventId === subEventId
    ) ?? null;
  }

  private cloneFallbackCards(
    fallbackCardsByType?: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> {
    const next: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> = {};
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
    current: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> | undefined,
    persisted: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> | undefined,
    subEventId: string
  ): Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> {
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
    type: AppTypes.AssetType
  ): AppTypes.AssetCard[] {
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEvent.id, type));
    const ownedIds = new Set(this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id));
    return (context.fallbackCardsByType[type] ?? [])
      .filter(card => assignedIds.has(card.id) && !ownedIds.has(card.id))
      .map(card => this.assignedFallbackAssetSnapshot(context.subEvent.id, card));
  }

  private assignedFallbackAssetSnapshot(
    subEventId: string,
    card: AppTypes.AssetCard,
    options: { clearRequests?: boolean } = {}
  ): AppTypes.AssetCard {
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
    card: AppTypes.AssetCard,
    quantity: number
  ): void {
    const key = this.subEventAssetAssignmentKey(context.subEvent.id, card.type);
    const currentIds = this.assignedAssetIdsByKey[key] ?? [];
    if (!currentIds.includes(card.id)) {
      this.assignedAssetIdsByKey[key] = [...currentIds, card.id];
    }

    const currentSettings = { ...(this.assignedAssetSettingsByKey[key] ?? {}) };
    if (!currentSettings[card.id]) {
      const capacityLimit = Math.max(0, card.capacityTotal);
      currentSettings[card.id] = {
        capacityMin: 0,
        capacityMax: capacityLimit,
        addedByUserId: this.activeUser().id,
        routes: this.normalizeAssetRoutes(card.type, card.routes)
      };
      this.assignedAssetSettingsByKey[key] = currentSettings;
    }

    if (card.type === 'Supplies') {
      const contributionKey = this.subEventSupplyAssignmentKey(context.subEvent.id, card.id);
      const currentEntries = this.supplyContributionEntriesByAssignmentKey[contributionKey] ?? [];
      this.supplyContributionEntriesByAssignmentKey[contributionKey] = [
        {
          id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: this.activeUser().id,
          quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
          addedAtIso: AppUtils.toIsoDateTime(new Date())
        },
        ...currentEntries
      ];
    }

    const activeContext = this.popupContextRef();
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
      this.popupContextRef.set(nextContext);
      this.syncPopupSubEventMetrics(false);
      this.persistPopupResourceState(nextContext);
      return;
    }

    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(context);
  }

  private applyGroupScopedAssetSnapshot(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    group: { pending?: number; capacityMin?: number; capacityMax?: number }
  ): AppTypes.SubEventFormItem {
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

  private normalizeAssetRoutes(type: AppTypes.AssetType, routes: string[] | undefined | null): string[] {
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
    card: AppTypes.AssetCard,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests.filter(request => request.status === 'pending').length;
  }

  private assetAcceptedCount(
    card: AppTypes.AssetCard,
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

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppTypes.SubEventSupplyContributionEntry[] {
    return this.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppTypes.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private subEventDisplayName(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    const name = this.subEventDisplayName(subEvent);
    return name || 'Sub Event';
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!target || typeof window === 'undefined') {
      return false;
    }
    const rect = target.getBoundingClientRect();
    return rect.bottom > window.innerHeight - 180;
  }

  private isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 760px)').matches;
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
