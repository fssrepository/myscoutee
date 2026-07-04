import {
  CommonModule
} from '@angular/common';
import {
  Component,
  DoCheck,
  HostListener,
  Input,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import {
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../../shared/ui/components/core/menu/menu.types';
import {
  AppMenuComponent
} from '../../../../shared/ui/components/core/menu/menu.component';
import {
  AppMenuDispatcher
} from '../../../../shared/ui/components/core/menu/menu-dispatcher.service';
import {
  AppMenuOutletComponent
} from '../../../../shared/ui/components/core/menu/outlet/menu-outlet.component';
import {
  AppMenuTriggerComponent
} from '../../../../shared/ui/components/core/menu/trigger/menu-trigger.component';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type InfoCardData
} from '../../../../shared/ui/components/core/smart-list/card/card.types';
import {
  InfoCardComponent
} from '../../../../shared/ui/components/core/smart-list/card/info-card/info-card.component';
import {
  SmartListComponent
} from '../../../../shared/ui/components/core/smart-list/smart-list.component';
import {
  DateInputComponent,
  type DateInputModel,
  type DateInputRangeValue,
  type DateInputValue
} from '../../../../shared/ui/components/core/form/inputs/date-input/date-input.component';
import type {
  ListQuery,
  PageResult,
  SmartListConfig,
  SmartListLoadPage,
  SmartListStateChange
} from '../../../../shared/ui/components/core/smart-list/smart-list.types';
import {
  AssetInfoCardConverter
} from '../../../../shared/ui/converters/asset-info-card.converter';
import {
  AppUtils
} from '../../../../shared/app-utils';
import {
  AssetCardBuilder
} from '../../../../shared/core/base/builders/asset-card.builder';
import {
  AssetDefaultsBuilder
} from '../../../../shared/core/base/builders/asset-defaults.builder';
import {
  PricingBuilder
} from '../../../../shared/core/base/builders/pricing.builder';
import {
  ActivityResourceBuilder
} from '../../../../shared/core/base/builders/activity-resource.builder';
import {
  ActivityResourcesService
} from '../../../../shared/core/base/services/activity-resources.service';
import {
  AssetsService as SharedAssetsService
} from '../../../../shared/core/base/services/assets.service';
import {
  EventsService
} from '../../../../shared/core/base/services/events.service';
import {
  ShareTokensService
} from '../../../../shared/core/base/services/share-tokens.service';
import {
  UsersService
} from '../../../../shared/core/base/services/users.service';
import type {
  UserDto
} from '../../../../shared/core/contracts/user.interface';
import {
  ActivitiesPopupStore,
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../../../shared/ui/context/stores/activities-popup.store';
import {
  DialogStore
} from '../../../../shared/ui/context/stores/dialog.store';
import {
  AssetStore
} from '../../../../shared/ui/context/stores/asset.store';
import {
  AssetPopupStore
} from '../../../../shared/ui/context/stores/asset-popup.store';
import {
  SubEventResourcePopupStore
} from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  ProfileStore
} from '../../../../shared/ui/context/stores/profile.store';
import type * as ActivityContracts from '../../../../shared/core/contracts/activity.interface';
import type * as AppConstants from '../../../../shared/core/common/constants';
import type * as AppDTOs from '../../../../shared/core/contracts';
import type * as ContractTypes from '../../../../shared/core/contracts';
import type { ChatDTO } from '../../../../shared/core/contracts/chat.interface';
import type {
  AssetExploreBorrowDialogState,
  AssetExploreBorrowDraftState,
  AssetExploreBorrowPricingPreview,
  EventResourceAssetExploreOutletActionRequest,
  AssetExplorePopupState,
  ResourceAssetDTO,
  ResourceAssetViewRequest,
  ResourceAssetViewState,
  ResourcePopupContext
} from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type {
  AssetExploreBorrowDialogViewState
} from '../asset-explore-borrow-dialog/event-resource-asset-explore-borrow-dialog.component';
import { UserProfileStore } from '../../../../shared/ui/context/stores/user-profile.store';

interface AssetExploreSmartListFilters {
  revision?: number;
  contextKey?: string;
}

type AssetExploreOrder = 'availability' | 'lowest-price' | 'fewest-policies';

type AssetExploreOrderOption = {
  key: AssetExploreOrder;
  label: string;
  icon: string;
};

type AssetExploreMenuContext =
  | { menu: 'asset-explore-order'; order: AssetExploreOrder }
  | { menu: 'asset-explore-category'; category: AppConstants.AssetCategory }
  | { menu: 'asset-explore-borrow-draft'; entry: AssetExploreBorrowDraftViewState }
  | {
      menu: 'asset-explore-card';
      card: ResourceAssetDTO;
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
  dateRange: DateInputRangeValue;
  dateRangeModel: DateInputModel;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  loading: boolean;
  error: string | null;
  cards: ResourceAssetDTO[];
}

interface AssetExploreBorrowDraftViewState {
  cardId: string;
  title: string;
  timeframe: string;
  quantity: number;
  availabilityLabel: string;
}

@Component({
  selector: 'app-event-resource-asset-explore',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    AppMenuTriggerComponent,
    DateInputComponent,
    InfoCardComponent,
    SmartListComponent
  ],
  templateUrl: './event-resource-asset-explore.component.html',
  styleUrl: './event-resource-asset-explore.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [AppMenuDispatcher]
})
export class EventResourceAssetExploreComponent implements DoCheck {
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);
  private readonly assetStore = inject(AssetStore);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly profileStore = inject(ProfileStore);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);

  private lastCardsSignature = '';
  private lastContextKey = '';
  private lastCardCount = 0;
  private listReady = false;
  private listVisibleCount = 0;
  private listTotal = 0;
  private pendingBorrowRequestVersion = 0;
  private lastAssetExploreOutletActionRequestId = 0;
  private readonly localReservationsByKey = new Map<string, {
    startAtIso: string;
    endAtIso: string;
    quantity: number;
  }>();

  @Input() parentZIndex = 2530;

  protected order: AssetExploreOrder = 'availability';
  protected readonly orderOptions = ASSET_EXPLORE_ORDER_OPTIONS;
  protected readonly assetViewOutletInputs = computed(() => ({
    view: this.assetView(),
    parentZIndex: this.assetExplorePopupZIndex()
  }));
  protected readonly borrowDialogOutletInputs = computed(() => ({
    dialog: this.borrowDialogViewState(),
    canSubmit: this.canSubmitBorrow(),
    parentZIndex: this.assetExplorePopupZIndex()
  }));
  protected smartListQuery: Partial<ListQuery<AssetExploreSmartListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  @ViewChild('assetExploreSmartList')
  private smartList?: SmartListComponent<ResourceAssetDTO, AssetExploreSmartListFilters>;

  protected readonly smartListLoadPage: SmartListLoadPage<ResourceAssetDTO, AssetExploreSmartListFilters> = (
    query
  ) => from(this.loadSmartListPage(query));

  protected readonly smartListConfig: SmartListConfig<ResourceAssetDTO, AssetExploreSmartListFilters> = {
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
    groupBy: card => this.groupLabel(card),
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

  readonly popupViewState = computed<AssetExplorePopupViewState | null>(() => {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!popup || !context) {
      return null;
    }
    const stageLabel = this.subEventStageLabel(context.subEvent);
    const windowRange = this.defaultRange(context.subEvent);
    const dateRangeModel = this.assetExploreDateRangeModel(windowRange);
    return {
      title: stageLabel ? `Explore - ${stageLabel}` : 'Explore',
      subtitle: this.popupSubtitle(),
      type: popup.type,
      category: popup.category,
      categoryOptions: [
        ...AssetDefaultsBuilder.assetCategoryOptions('Car'),
        ...AssetDefaultsBuilder.assetCategoryOptions('Accommodation'),
        ...AssetDefaultsBuilder.assetCategoryOptions('Supplies')
      ],
      dateRange: {
        startAt: popup.startAtIso,
        endAt: popup.endAtIso,
        precision: 'date'
      },
      dateRangeModel,
      startDate: AppUtils.isoLocalDateTimeToDate(popup.startAtIso),
      endDate: AppUtils.isoLocalDateTimeToDate(popup.endAtIso),
      startTime: AppUtils.isoLocalTimePart(popup.startAtIso),
      endTime: AppUtils.isoLocalTimePart(popup.endAtIso),
      loading: popup.loading,
      error: popup.error,
      cards: popup.cards
    };
  });

  readonly borrowDialogViewState = computed<AssetExploreBorrowDialogViewState | null>(() => {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !popup || !context) {
      return null;
    }
    const card = this.resolveCard(dialog.cardId);
    if (!card) {
      return null;
    }
    const timeframe = this.timeframeLabel(dialog.startAtIso, dialog.endAtIso);
    const pricing = this.resolveBorrowPricing(card, dialog.startAtIso, dialog.endAtIso, dialog.quantity);
    const detail = dialog.quantity > 1 ? `${timeframe} · Qty ${dialog.quantity}` : timeframe;
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
      dateRange: {
        startAt: dialog.startAtIso,
        endAt: dialog.endAtIso,
        precision: 'minute'
      },
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
      policies: (AssetCardBuilder.assetPoliciesEnabled(card) ? card.policies ?? [] : []).map(item => ({ ...item })),
      acceptedPolicyIds: [...dialog.acceptedPolicyIds],
      payable: pricing.amount > 0,
      paymentStep: dialog.paymentStep,
      submitLabel: pricing.amount > 0 ? (dialog.paymentStep ? 'Pay' : 'Confirm borrow') : 'Send borrow request',
      busyLabel: pricing.amount > 0 ? (dialog.paymentStep ? 'Paying...' : 'Confirming borrow...') : 'Sending request...',
      busy: dialog.busy,
      error: dialog.error
    };
  });

  readonly borrowDraftsViewState = computed<AssetExploreBorrowDraftViewState[]>(() => {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!popup || !context || !activeUserId) {
      return [];
    }
    return this.listBorrowDrafts(activeUserId, context.subEvent.id)
      .map(draft => {
        const card = popup.cards.find(item => item.id === draft.cardId) ?? null;
        return {
          cardId: draft.cardId,
          title: card?.title ?? draft.title,
          timeframe: this.timeframeLabel(draft.startAtIso || popup.startAtIso, draft.endAtIso || popup.endAtIso),
          quantity: Math.max(1, Math.trunc(Number(draft.quantity) || 1)),
          availabilityLabel: card ? this.availabilityLabel(card) : 'Unavailable for this time'
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title) || left.cardId.localeCompare(right.cardId));
  });

  constructor() {
    effect(() => {
      if (this.assetView()) {
        void this.resourcePopupStore.ensureEventResourceAssetViewLoaded();
      }
    });

    effect(() => {
      if (this.borrowDialogViewState()) {
        void this.resourcePopupStore.ensureEventResourceAssetExploreBorrowDialogLoaded();
      }
    });

    effect(() => {
      const request = this.resourcePopupStore.eventResourceAssetExploreOutletActionRequest();
      if (!request || request.requestId <= this.lastAssetExploreOutletActionRequestId) {
        return;
      }
      this.lastAssetExploreOutletActionRequestId = request.requestId;
      untracked(() => this.handleAssetExploreOutletActionRequest(request));
    });
  }

  protected assetExplorePopupZIndex(): number {
    return this.parentZIndex + 100;
  }

  private handleAssetExploreOutletActionRequest(request: EventResourceAssetExploreOutletActionRequest): void {
    switch (request.kind) {
      case 'assetViewClose':
        this.closeAssetView(request.event);
        return;
      case 'assetViewRouteView':
        this.openAssetViewRoutePopup(request.request);
        return;
      case 'borrowDialogClose':
        this.closeBorrowDialog(request.event);
        return;
      case 'borrowDialogBack':
        this.backToBorrowDetails(request.event);
        return;
      case 'borrowDateRangeChange':
        this.setBorrowDateRange(request.start, request.end);
        return;
      case 'borrowTimeChange':
        this.setBorrowTime(request.edge, request.value);
        return;
      case 'borrowQuantityChange':
        this.onBorrowQuantityChange(request.value);
        return;
      case 'borrowQuantityBlur':
        this.normalizeBorrowQuantityOnBlur(request.value);
        return;
      case 'borrowPolicyToggle':
        this.toggleBorrowPolicy(request.policyId);
        return;
      case 'borrowConfirm':
        this.confirmBorrow(request.event);
        return;
    }
  }

  ngDoCheck(): void {
    const explore = this.popupViewState();
    if (!explore) {
      this.resourcePopupStore.assetExploreAssetViewIdRef.set(null);
    }
    const cards = explore?.cards ?? [];
    const contextKey = explore
      ? [
          explore.title,
          explore.subtitle,
          explore.type,
          explore.category,
          this.order,
          explore.startDate?.getTime() ?? 'start',
          explore.endDate?.getTime() ?? 'end',
          explore.startTime,
          explore.endTime
        ].join(':')
      : '';
    const signature = `${contextKey}:${cards.map(card => [
      card.id,
      card.quantity ?? '',
      card.capacityTotal,
      card.requests.length,
      this.availabilityLabel(card)
    ].join(':')).join('|')}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      this.lastCardsSignature = signature;
      this.lastCardCount = cards.length;
      this.listReady = false;
      this.listVisibleCount = 0;
      this.listTotal = 0;
      this.smartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey
        }
      };
      return;
    }

    if (signature === this.lastCardsSignature) {
      return;
    }

    const previousCardCount = this.lastCardCount;
    this.lastCardsSignature = signature;
    this.lastCardCount = cards.length;
    if (cards.length <= previousCardCount) {
      this.syncVisibleCards(cards, previousCardCount);
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.borrowDialogViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      if (this.borrowDialogViewState()?.paymentStep) {
        this.backToBorrowDetails();
        return;
      }
      this.closeBorrowDialog();
      return;
    }
    if (this.assetView()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeAssetView();
      return;
    }
    if (this.popupViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeExplorePopup();
    }
  }

  protected onSmartListStateChange(
    change: SmartListStateChange<ResourceAssetDTO, AssetExploreSmartListFilters>
  ): void {
    this.listVisibleCount = change.items.length;
    this.listTotal = change.total;
    this.listReady = !change.initialLoading;
  }

  protected itemInfoCard(card: ResourceAssetDTO, options: { groupLabel?: string | null } = {}): InfoCardData {
    return AssetInfoCardConverter.convert(this.toAssetDto(card), {
      variant: 'explore',
      groupLabel: options?.groupLabel ?? null,
      availabilityLabel: this.availabilityLabel(card),
      canBorrow: this.availableQuantity(card) > 0,
      canReportOwner: this.canReportOwner(card)
    });
  }

  protected openInfoCardMenu(card: ResourceAssetDTO, request: CardMenuRequestEvent<InfoCardData>): void {
    const menuId = `asset-explore-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(card, request),
      triggerRect: request.triggerRect,
      openUp: request.openUp,
      panelAlign: 'auto',
      closeOnSelect: true,
      onClose: request.closeTrigger
    }, null);
  }

  protected onMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AssetExploreMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'asset-explore-order') {
      this.selectOrder(context.order, event.sourceEvent);
      return;
    }
    if (context.menu === 'asset-explore-category') {
      event.sourceEvent.stopPropagation();
      this.selectCategory(context.category, event.sourceEvent);
      return;
    }
    if (context.menu === 'asset-explore-borrow-draft') {
      if (event.action === 'remove') {
        this.clearBorrowDraft(context.entry.cardId, event.sourceEvent);
        return;
      }
      this.continueBorrowDraft(context.entry.cardId, event.sourceEvent);
      return;
    }
    this.onCardMenuAction(context.card, {
      id: context.infoCard.id,
      actionId: context.action.id,
      action: context.action,
      card: context.infoCard
    });
  }

  protected orderMenuTrigger(): AppMenuTrigger {
    return {
      label: this.orderLabel(),
      icon: this.orderIcon(),
      ariaLabel: 'Open asset explore order',
      palette: this.orderPalette(this.order),
      layout: 'pill'
    };
  }

  protected orderMenuItems(): readonly AppMenuItem<string, AssetExploreMenuContext>[] {
    return this.orderOptions.map(option => ({
      id: `asset-explore-order-${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === this.order,
      checked: option.key === this.order,
      palette: this.orderPalette(option.key),
      surface: 'tinted',
      context: { menu: 'asset-explore-order', order: option.key }
    }));
  }

  protected categoryMenuTrigger(explore: AssetExplorePopupViewState): AppMenuTrigger {
    return {
      label: AssetDefaultsBuilder.assetCategoryLabel(explore.category),
      icon: AssetDefaultsBuilder.assetCategoryIcon(explore.category),
      ariaLabel: 'Open asset explore category',
      palette: this.assetCategoryPalette(explore.category),
      layout: 'pill'
    };
  }

  protected categoryMenuItems(explore: AssetExplorePopupViewState): readonly AppMenuItem<string, AssetExploreMenuContext>[] {
    const directOptions = explore.categoryOptions
      .filter(option => AssetDefaultsBuilder.assetCategoryType(option) !== 'Supplies');
    const suppliesOptions = explore.categoryOptions
      .filter(option => AssetDefaultsBuilder.assetCategoryType(option) === 'Supplies');
    const items: AppMenuItem<string, AssetExploreMenuContext>[] = directOptions.map(option =>
      this.categoryMenuItem(option, explore.category)
    );
    if (suppliesOptions.length > 0) {
      const suppliesActive = AssetDefaultsBuilder.assetCategoryType(explore.category) === 'Supplies';
      items.push({
        id: 'asset-explore-category-supplies',
        label: 'Kellékek',
        icon: AssetDefaultsBuilder.assetTypeIcon('Supplies'),
        kind: 'branch',
        active: suppliesActive,
        palette: this.resourceTypePalette('Supplies'),
        surface: 'tinted',
        items: suppliesOptions.map(option => this.categoryMenuItem(option, explore.category))
      });
    }
    return items;
  }

  private categoryMenuItem(
    option: AppConstants.AssetCategory,
    activeCategory: AppConstants.AssetCategory
  ): AppMenuItem<string, AssetExploreMenuContext> {
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

  protected selectOrder(order: AssetExploreOrder, event: Event): void {
    event.stopPropagation();
    this.order = order;
    const cards = this.popupViewState()?.cards ?? [];
    this.syncVisibleCards(cards, this.lastCardCount);
  }

  protected orderLabel(order: AssetExploreOrder = this.order): string {
    return this.orderOptions.find(option => option.key === order)?.label ?? 'Available first';
  }

  protected orderIcon(order: AssetExploreOrder = this.order): string {
    return this.orderOptions.find(option => option.key === order)?.icon ?? 'inventory_2';
  }

  protected onDateInputRangeChange(value: DateInputValue): void {
    if (!this.isDateInputRangeValue(value)) {
      return;
    }
    this.setDateRange(
      AppUtils.isoLocalDateTimeToDate(value.startAt),
      AppUtils.isoLocalDateTimeToDate(value.endAt)
    );
  }

  protected openBorrowFromBadge(card: ResourceAssetDTO): void {
    if (this.availableQuantity(card) <= 0) {
      return;
    }
    this.openBorrowDialog(card);
  }

  protected onCardMenuAction(card: ResourceAssetDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (event.actionId === 'viewAsset') {
      this.openAssetView(card, new Event('click'));
      return;
    }
    if (event.actionId === 'contactOwner') {
      this.openServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.openShareDialog(card);
      return;
    }
    if (event.actionId === 'reportOwner') {
      this.reportOwner(card, new Event('click'));
      return;
    }
    if (event.actionId === 'borrowAsset') {
      this.openBorrowDialog(card, new Event('click'));
    }
  }

  protected borrowDrafts(): AssetExploreBorrowDraftViewState[] {
    return this.borrowDraftsViewState();
  }

  protected borrowDraftCount(): number {
    return this.borrowDrafts().length;
  }

  protected borrowDraftMenuTrigger(): AppMenuTrigger {
    const count = this.borrowDraftCount();
    return {
      icon: 'shopping_basket',
      closeIcon: 'close',
      ariaLabel: count === 1 ? 'Open borrow basket with 1 request' : `Open borrow basket with ${count} requests`,
      counter: count,
      hideLabel: true,
      layout: 'icon',
      palette: 'orange'
    };
  }

  protected borrowDraftMenuItems(): readonly AppMenuItem<string, AssetExploreMenuContext>[] {
    return this.borrowDrafts().map(entry => ({
      id: `borrow-draft-${entry.cardId}`,
      label: entry.title,
      description: [
        entry.timeframe || 'Pending borrow window',
        `Quantity ${entry.quantity} · ${entry.availabilityLabel}`
      ].join('\n'),
      detail: this.borrowDraftMenuStatusLabel(entry),
      icon: 'assignment_return',
      kind: 'action',
      palette: this.borrowDraftMenuPalette(entry),
      surface: 'tinted',
      layout: 'pill',
      removable: true,
      removeIcon: 'close',
      removeAriaLabel: `Clear ${entry.title}`,
      context: { menu: 'asset-explore-borrow-draft', entry }
    }));
  }

  private borrowDraftMenuStatusLabel(entry: AssetExploreBorrowDraftViewState): string {
    return this.borrowDraftUnavailable(entry) ? 'Review request' : 'Continue request';
  }

  private borrowDraftMenuPalette(entry: AssetExploreBorrowDraftViewState): AppMenuPalette {
    return this.borrowDraftUnavailable(entry) ? 'amber' : 'orange';
  }

  private borrowDraftUnavailable(entry: AssetExploreBorrowDraftViewState): boolean {
    const availability = entry.availabilityLabel.trim().toLowerCase();
    return availability.startsWith('0 ') || availability.includes('unavailable');
  }

  protected continueBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    this.resumeBorrowDraft(cardId, event);
  }

  protected assetView(): ResourceAssetViewState | null {
    const viewId = `${this.resourcePopupStore.assetExploreAssetViewIdRef() ?? ''}`.trim();
    const context = this.resourcePopupStore.popupContextRef();
    if (!viewId || !context) {
      return null;
    }
    const card = this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === viewId) ?? null;
    if (!card) {
      return null;
    }
    const resourceCard = this.assetCardToResourceCard(card, context.subEvent.id);
    return {
      card: resourceCard,
      mode: 'view',
      source: this.cloneAsset(card)
    };
  }

  protected openAssetView(card: ResourceAssetDTO, event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.assetExploreAssetViewIdRef.set(null);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    void this.openReadonlyAssetEditor(card);
  }

  private async openReadonlyAssetEditor(card: ResourceAssetDTO): Promise<void> {
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    const generation = this.assetStore.openAssetEditorEdit({
      cardId: card.id,
      form: AssetCardBuilder.buildAssetFormFromCard(card),
      visibility: AssetCardBuilder.visibilityFromCard(card),
      loading: Boolean(ownerUserId),
      readOnly: true,
      parentZIndex: this.assetExplorePopupZIndex()
    });
    void this.assetPopupStore.ensureAssetPopupLoaded();
    if (!ownerUserId) {
      this.assetStore.setAssetEditorLoading(false);
      return;
    }
    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, card.id);
      if (!this.assetStore.isCurrentAssetEditorLoad(generation, card.id)) {
        return;
      }
      if (loadedCard) {
        this.assetStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.assetStore.setAssetEditorLoading(false);
    } catch {
      if (this.assetStore.isCurrentAssetEditorLoad(generation, card.id)) {
        this.assetStore.setAssetEditorLoading(false);
      }
    }
  }

  protected closeAssetView(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.assetExploreAssetViewIdRef.set(null);
  }

  protected openAssetViewRoutePopup(request: ResourceAssetViewRequest): void {
    request.sourceEvent.stopPropagation();
    this.openGoogleMapsDirections(request.view.card.routes);
  }

  protected closeExplorePopup(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.assetExploreAssetViewIdRef.set(null);
    if (this.resourcePopupStore.assetExploreOnlyRef()) {
      this.resourcePopupStore.closeResourcePopup();
      return;
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  protected setDateRange(start: Date | null, end: Date | null): void {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    this.resourcePopupStore.assetExplorePopupRef.set(this.resolvePopupState({
      ...popup,
      startAtIso: AppUtils.applyDatePartToIsoLocal(popup.startAtIso, start),
      endAtIso: AppUtils.applyDatePartToIsoLocal(popup.endAtIso, end)
    }));
  }

  private assetExploreDateRangeModel(bounds: { startAtIso: string; endAtIso: string }): DateInputModel {
    return {
      mode: 'range',
      precision: 'date',
      valueFormat: 'iso-date-time',
      range: {
        layout: 'compact',
        bounds: {
          start: bounds.startAtIso,
          end: bounds.endAtIso
        },
        start: {
          placeholder: 'Start date',
          min: bounds.startAtIso,
          max: bounds.endAtIso
        },
        end: {
          placeholder: 'End date',
          min: bounds.startAtIso,
          max: bounds.endAtIso
        }
      }
    };
  }

  private isDateInputRangeValue(value: DateInputValue): value is DateInputRangeValue {
    return !!value
      && typeof value === 'object'
      && 'startAt' in value
      && 'endAt' in value;
  }

  protected setBorrowDateRange(start: Date | null, end: Date | null): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog) {
      return;
    }
    const card = this.resolveCard(dialog.cardId);
    if (!card) {
      return;
    }
    const startAtIso = start ? AppUtils.toIsoDateTimeLocal(start) : dialog.startAtIso;
    const endAtIso = end ? AppUtils.toIsoDateTimeLocal(end) : dialog.endAtIso;
    const availableQuantity = this.availableQuantityForWindow(card, startAtIso, endAtIso);
    const invalidated = this.invalidateBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.borrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  protected setBorrowTime(edge: 'start' | 'end', value: string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog) {
      return;
    }
    const card = this.resolveCard(dialog.cardId);
    if (!card) {
      return;
    }
    const startAtIso = edge === 'start' ? AppUtils.applyTimePartToIsoLocal(dialog.startAtIso, value) : dialog.startAtIso;
    const endAtIso = edge === 'end' ? AppUtils.applyTimePartToIsoLocal(dialog.endAtIso, value) : dialog.endAtIso;
    const availableQuantity = this.availableQuantityForWindow(card, startAtIso, endAtIso);
    const invalidated = this.invalidateBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      startAtIso,
      endAtIso,
      availableQuantity,
      quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.borrowAvailabilityError(dialog.quantity, availableQuantity)
    });
  }

  protected onBorrowQuantityChange(value: number | string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    const invalidated = this.invalidateBorrowCheckout(dialog);
    const quantity = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
      1,
      Number.MAX_SAFE_INTEGER
    );
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.borrowAvailabilityError(quantity, dialog.availableQuantity)
    });
  }

  protected normalizeBorrowQuantityOnBlur(value: number | string): void {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    const invalidated = this.invalidateBorrowCheckout(dialog);
    const quantity = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
      1,
      Math.max(1, dialog.availableQuantity)
    );
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      quantity,
      acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
      error: this.borrowAvailabilityError(quantity, dialog.availableQuantity)
    });
  }

  protected toggleBorrowPolicy(policyId: string): void {
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
    const invalidated = this.invalidateBorrowCheckout(dialog);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set({
      ...invalidated,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  protected backToBorrowDetails(event?: Event): void {
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

  protected canSubmitBorrow(): boolean {
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    if (!dialog || dialog.busy || dialog.availableQuantity <= 0 || dialog.quantity > dialog.availableQuantity) {
      return false;
    }
    const card = this.resolveCard(dialog.cardId);
    if (!card) {
      return false;
    }
    const acceptedPolicyIds = new Set(dialog.acceptedPolicyIds);
    const missingRequiredPolicy = (AssetCardBuilder.assetPoliciesEnabled(card) ? card.policies ?? [] : [])
      .some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
    return !missingRequiredPolicy && this.isValidWindow(dialog.startAtIso, dialog.endAtIso);
  }

  protected confirmBorrow(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !popup || !context) {
      return;
    }
    const card = this.resolveCard(dialog.cardId);
    if (!card) {
      this.resourcePopupStore.assetExplorePopupRef.set({
        ...popup,
        error: 'This basket item is no longer available for the selected date range.'
      });
      this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
      return;
    }
    const availableQuantity = this.availableQuantityForWindow(card, dialog.startAtIso, dialog.endAtIso);
    const availabilityError = this.borrowAvailabilityError(dialog.quantity, availableQuantity);
    if (availabilityError) {
      const invalidated = this.invalidateBorrowCheckout(dialog);
      this.resourcePopupStore.assetExploreBorrowDialogRef.set({
        ...invalidated,
        availableQuantity,
        quantity: AppUtils.clampNumber(dialog.quantity, 1, Math.max(1, availableQuantity)),
        acceptedPolicyIds: [...invalidated.acceptedPolicyIds],
        error: availabilityError
      });
      return;
    }
    if (!this.canSubmitBorrow()) {
      return;
    }

    const activeUser = this.activeUser();
    const existingRequest = this.findPendingBorrowRequest(card, context.subEvent.id, activeUser.id);
    const requestVersion = ++this.pendingBorrowRequestVersion;
    const pricing = this.resolveBorrowPricing(card, dialog.startAtIso, dialog.endAtIso, dialog.quantity);
    const inventoryApplied = pricing.amount > 0;
    const lineItems: ActivityContracts.EventCheckoutLineItem[] = [
      {
        id: `resource:${card.id}`,
        kind: 'resource',
        label: card.title,
        detail: dialog.quantity > 1
          ? `${this.timeframeLabel(dialog.startAtIso, dialog.endAtIso)} · Qty ${dialog.quantity}`
          : this.timeframeLabel(dialog.startAtIso, dialog.endAtIso) || 'Borrow request',
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
          if (!currentDialog || requestVersion !== this.pendingBorrowRequestVersion) {
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
          this.saveBorrowDraft(activeUser.id, context.subEvent.id, nextDialog);
        })
        .catch(error => {
          const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
          if (!currentDialog || requestVersion !== this.pendingBorrowRequestVersion) {
            return;
          }
          this.resourcePopupStore.assetExploreBorrowDialogRef.set({
            ...currentDialog,
            busy: false,
            error: this.errorMessage(error, 'Unable to start checkout.')
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
          note: pricing.amount > 0 ? 'Payment approved. Awaiting owner confirmation.' : 'Awaiting owner confirmation.',
          requestKind: 'borrow',
          requestedAtIso: new Date().toISOString(),
          booking: this.bookingForRange(
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
        const nextCard: ResourceAssetDTO = {
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
        return this.assetsService.saveOwnedAsset(dialog.ownerUserId, this.toAssetDetailDto(nextCard));
      })
      .then(savedCard => {
        const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
        const currentPopup = this.resourcePopupStore.assetExplorePopupRef();
        if (!currentDialog || !currentPopup || requestVersion !== this.pendingBorrowRequestVersion) {
          return;
        }
        this.clearBorrowDraftState(activeUser.id, context.subEvent.id, currentDialog.cardId);
        this.attachBoughtAssetToSubEventLocally(context, savedCard, currentDialog.quantity);
        if (inventoryApplied) {
          this.clearLocalReservation(context.subEvent.id, savedCard.id);
        } else {
          this.rememberLocalReservation(
            context.subEvent.id,
            savedCard.id,
            currentDialog.startAtIso,
            currentDialog.endAtIso,
            currentDialog.quantity
          );
        }
        const remainingAvailability = this.availableQuantityForWindow(
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
        this.closeBorrowDialog();
      })
      .catch(error => {
        const currentDialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
        if (!currentDialog || requestVersion !== this.pendingBorrowRequestVersion) {
          return;
        }
        this.resourcePopupStore.assetExploreBorrowDialogRef.set({
          ...currentDialog,
          busy: false,
          error: this.errorMessage(error, 'Unable to send the borrow request.')
        });
      });
  }

  protected closeBorrowDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assetExploreBorrowDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (dialog && context && !dialog.busy && this.shouldPersistBorrowDraft(dialog, context.subEvent.id, activeUserId)) {
      this.saveBorrowDraft(activeUserId, context.subEvent.id, dialog);
    }
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
  }

  protected resumeBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.resolveCard(cardId);
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
    this.openBorrowDialog(card, event);
  }

  protected clearBorrowDraft(cardId: string, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    this.clearBorrowDraftState(activeUserId, context.subEvent.id, cardId);
    if (this.resourcePopupStore.assetExploreBorrowDialogRef()?.cardId === cardId) {
      this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    }
  }

  private async loadSmartListPage(
    query: ListQuery<AssetExploreSmartListFilters>
  ): Promise<PageResult<ResourceAssetDTO>> {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const basePageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.smartListConfig.pageSize) || 1));
    const initialPageSize = this.initialPageSize(basePageSize);
    const size = page === 0 ? Math.max(pageSize, initialPageSize) : pageSize;
    const pageQuery: AppDTOs.AssetExplorePageQueryDTO = {
      ...this.queryFromPopup(popup),
      page,
      pageSize: size,
      cursor: query.cursor ?? null,
      order: this.order
    };
    const requestKey = this.queryKey(pageQuery, pageQuery.order);
    try {
      const result = await this.assetsService.queryVisibleAssetsPage(pageQuery);
      const current = this.resourcePopupStore.assetExplorePopupRef();
      if (!current || this.queryKey(this.queryFromPopup(current), pageQuery.order) !== requestKey) {
        return {
          items: [],
          total: 0,
          nextCursor: null
        };
      }
      const items = result.items.map(card => this.cloneAsset(card));
      this.mergeLoadedPage(current, items, pageQuery);
      return {
        items,
        total: result.total,
        nextCursor: result.nextCursor ?? null
      };
    } catch {
      const current = this.resourcePopupStore.assetExplorePopupRef();
      if (current && this.queryKey(this.queryFromPopup(current), pageQuery.order) === requestKey) {
        this.resourcePopupStore.assetExplorePopupRef.set({
          ...current,
          loading: false,
          error: current.cards.length > 0 ? null : 'Unable to load visible assets right now.'
        });
      }
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  private syncVisibleCards(cards: ResourceAssetDTO[], previousCardCount: number): void {
    if (!this.listReady || !this.smartList) {
      return;
    }
    const visibleCount = Math.max(this.listVisibleCount, this.smartList.itemsSnapshot().length);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);
    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + (cards.length - previousCardCount));
    }
    const orderedCards = this.cardsForView(cards);
    this.smartList.replaceVisibleItems(orderedCards.slice(0, nextVisibleCount), {
      total: Math.max(orderedCards.length, this.listTotal)
    });
  }

  private mergeLoadedPage(
    popup: AssetExplorePopupState,
    items: readonly ResourceAssetDTO[],
    query: AppDTOs.AssetExplorePageQueryDTO
  ): void {
    const replace = Math.max(0, Math.trunc(Number(query.page) || 0)) === 0 && !`${query.cursor ?? ''}`.trim();
    const nextById = new Map<string, ResourceAssetDTO>();
    const source = replace ? [] : popup.cards;
    for (const card of source) {
      nextById.set(card.id, this.cloneAsset(card));
    }
    for (const card of items) {
      nextById.set(card.id, this.cloneAsset(card));
    }
    this.resourcePopupStore.assetExplorePopupRef.set({
      ...popup,
      loading: false,
      error: null,
      cards: [...nextById.values()]
    });
  }

  private cardsForView(source: readonly ResourceAssetDTO[] = this.popupViewState()?.cards ?? []): ResourceAssetDTO[] {
    const availability = (card: ResourceAssetDTO) => this.availableQuantity(card);
    const cards = [...source].filter(card => availability(card) > 0);
    const price = (card: ResourceAssetDTO) => this.priceAmount(card);
    const policyCount = (card: ResourceAssetDTO) => AssetCardBuilder.assetPoliciesEnabled(card) ? (card.policies ?? []).length : 0;
    cards.sort((left, right) => {
      if (this.order === 'lowest-price') {
        const priceDelta = price(left) - price(right);
        if (priceDelta !== 0) {
          return priceDelta;
        }
        const availabilityDelta = availability(right) - availability(left);
        if (availabilityDelta !== 0) {
          return availabilityDelta;
        }
      } else if (this.order === 'fewest-policies') {
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

  private groupLabel(card: ResourceAssetDTO): string {
    if (this.order === 'lowest-price') {
      const amount = this.priceAmount(card);
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
    if (this.order === 'fewest-policies') {
      const count = AssetCardBuilder.assetPoliciesEnabled(card) ? (card.policies ?? []).length : 0;
      if (count <= 0) {
        return 'No policies';
      }
      if (count === 1) {
        return '1 policy';
      }
      return '2+ policies';
    }
    const available = this.availableQuantity(card);
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

  private selectCategory(category: string, event?: Event): void {
    event?.stopPropagation();
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return;
    }
    const normalizedCategory = AssetDefaultsBuilder.assetCategoryLabel(category);
    const nextType = AssetDefaultsBuilder.assetCategoryType(normalizedCategory);
    const nextCategory = AssetDefaultsBuilder.normalizeCategory(nextType, normalizedCategory);
    if (nextType === popup.type && nextCategory === popup.category) {
      return;
    }
    this.resourcePopupStore.assetExplorePopupRef.set(this.resolvePopupState({
      ...popup,
      type: nextType,
      category: nextCategory
    }));
  }

  private resolvePopupState(
    popup: Pick<AssetExplorePopupState, 'subEventId' | 'type' | 'category' | 'startAtIso' | 'endAtIso'>
  ): AssetExplorePopupState {
    return {
      ...popup,
      loading: true,
      error: null,
      cards: []
    };
  }

  private queryFromPopup(
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

  private queryKey(query: AppDTOs.AssetExploreQueryDTO, order: AssetExploreOrder = this.order): string {
    return [
      query.userId.trim(),
      query.type,
      `${query.category ?? ''}`.trim(),
      `${query.startAtIso ?? ''}`.trim(),
      `${query.endAtIso ?? ''}`.trim(),
      order
    ].join('|');
  }

  private availabilityLabel(card: ResourceAssetDTO): string {
    const available = this.availableQuantity(card);
    if (available <= 0) {
      return '0 left';
    }
    return `${available} left`;
  }

  private availableQuantity(card: ResourceAssetDTO): number {
    const popup = this.resourcePopupStore.assetExplorePopupRef();
    if (!popup) {
      return 0;
    }
    return this.availableQuantityForWindow(card, popup.startAtIso, popup.endAtIso);
  }

  private availableQuantityForWindow(card: ResourceAssetDTO, startAtIso: string, endAtIso: string): number {
    const totalQuantity = AssetCardBuilder.storedQuantityValue(card);
    const overlappingCommitted = card.requests
      .filter(request => request.status === 'accepted' || request.requestKind === 'manual')
      .filter(request => request.booking?.inventoryApplied !== true)
      .filter(request => this.isWindowOverlap(request, startAtIso, endAtIso))
      .reduce((sum, request) => sum + this.requestQuantity(request), 0);
    const locallyReserved = this.localReservedQuantity(card, startAtIso, endAtIso);
    return Math.max(0, totalQuantity - overlappingCommitted - locallyReserved);
  }

  private localReservedQuantity(card: ResourceAssetDTO, startAtIso: string, endAtIso: string): number {
    const subEventId = `${this.resourcePopupStore.popupContextRef()?.subEvent.id ?? ''}`.trim();
    if (!subEventId) {
      return 0;
    }
    const reservation = this.localReservationsByKey.get(this.localReservationKey(subEventId, card.id));
    if (!reservation) {
      return 0;
    }
    return this.isRangeOverlap(reservation.startAtIso, reservation.endAtIso, startAtIso, endAtIso)
      ? reservation.quantity
      : 0;
  }

  private rememberLocalReservation(subEventId: string, assetId: string, startAtIso: string, endAtIso: string, quantity: number): void {
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedSubEventId || !normalizedAssetId) {
      return;
    }
    this.localReservationsByKey.set(this.localReservationKey(normalizedSubEventId, normalizedAssetId), {
      startAtIso: startAtIso.trim(),
      endAtIso: endAtIso.trim(),
      quantity: Math.max(1, Math.trunc(Number(quantity) || 1))
    });
  }

  private clearLocalReservation(subEventId: string, assetId: string): void {
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedSubEventId || !normalizedAssetId) {
      return;
    }
    this.localReservationsByKey.delete(this.localReservationKey(normalizedSubEventId, normalizedAssetId));
  }

  private localReservationKey(subEventId: string, assetId: string): string {
    return `${subEventId}:${assetId}`;
  }

  private openServiceChat(card: ResourceAssetDTO, event?: Event): void {
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
    void this.openStackedServiceChat(chat);
  }

  private async openStackedServiceChat(chat: ChatDTO & { ownerUserId?: string }): Promise<void> {
    await this.activitiesStore.ensureEventChatPopupLoaded();
    this.activitiesStore.openStackedEventChat(
      {
        ...eventChatPopupRequestFromChat(chat),
        parentZIndex: this.assetExplorePopupZIndex()
      },
      eventChatHeaderStateFromChat(chat)
    );
  }

  private openBorrowDialog(card: ResourceAssetDTO, event?: Event): void {
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
    const draft = this.readBorrowDraft(activeUserId, context.subEvent.id, card.id);
    const existingRequest = this.findPendingBorrowRequest(card, context.subEvent.id);
    const startAtIso = `${draft?.startAtIso ?? existingRequest?.booking?.startAtIso ?? popup.startAtIso}`.trim() || popup.startAtIso;
    const endAtIso = `${draft?.endAtIso ?? existingRequest?.booking?.endAtIso ?? popup.endAtIso}`.trim() || popup.endAtIso;
    const availableQuantity = this.availableQuantityForWindow(card, startAtIso, endAtIso);
    const requestedQuantity = Math.max(1, Math.trunc(Number(draft?.quantity ?? existingRequest?.booking?.quantity) || 1));
    const activePolicies = AssetCardBuilder.assetPoliciesEnabled(card) ? card.policies ?? [] : [];
    const validPolicyIds = new Set(activePolicies.map(policy => policy.id));
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
      error: this.borrowAvailabilityError(requestedQuantity, availableQuantity)
    });
  }

  private invalidateBorrowCheckout(dialog: AssetExploreBorrowDialogState): AssetExploreBorrowDialogState {
    if (!dialog.paymentStep && !dialog.checkoutSessionId) {
      return dialog;
    }
    return {
      ...dialog,
      checkoutSessionId: null,
      paymentStep: false
    };
  }

  private borrowAvailabilityError(requestedQuantity: number, availableQuantity: number): string | null {
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

  private listBorrowDrafts(userId: string, subEventId: string): AssetExploreBorrowDraftState[] {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedUserId || !normalizedSubEventId) {
      return [];
    }
    return Object.values(this.resourcePopupStore.assetExploreBorrowDraftsRef())
      .filter(draft => draft.userId === normalizedUserId && draft.subEventId === normalizedSubEventId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  private readBorrowDraft(userId: string, subEventId: string, cardId: string): AssetExploreBorrowDraftState | null {
    const key = this.borrowDraftKey(userId, subEventId, cardId);
    return key ? this.resourcePopupStore.assetExploreBorrowDraftsRef()[key] ?? null : null;
  }

  private saveBorrowDraft(userId: string, subEventId: string, dialog: AssetExploreBorrowDialogState): void {
    const key = this.borrowDraftKey(userId, subEventId, dialog.cardId);
    if (!key) {
      return;
    }
    const card = this.resolveCard(dialog.cardId);
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

  private clearBorrowDraftState(userId: string, subEventId: string, cardId: string): void {
    const key = this.borrowDraftKey(userId, subEventId, cardId);
    if (!key || !this.resourcePopupStore.assetExploreBorrowDraftsRef()[key]) {
      return;
    }
    const next = { ...this.resourcePopupStore.assetExploreBorrowDraftsRef() };
    delete next[key];
    this.resourcePopupStore.assetExploreBorrowDraftsRef.set(next);
  }

  private shouldPersistBorrowDraft(dialog: AssetExploreBorrowDialogState, subEventId: string, userId: string): boolean {
    return Boolean(
      dialog.checkoutSessionId
      || dialog.paymentStep
      || this.readBorrowDraft(userId, subEventId, dialog.cardId)
    );
  }

  private borrowDraftKey(userId: string, subEventId: string, cardId: string): string {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    const normalizedCardId = cardId.trim();
    if (!normalizedUserId || !normalizedSubEventId || !normalizedCardId) {
      return '';
    }
    return `${normalizedUserId}::${normalizedSubEventId}::${normalizedCardId}`;
  }

  private activeUser(): UserDto {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return this.userProfileStore.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): ResourceAssetDTO[] {
    return this.assetStore.assetCards();
  }

  private popupSubtitle(): string {
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

  private defaultRange(subEvent: ContractTypes.SubEventDTO): { startAtIso: string; endAtIso: string } {
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

  private resolveCard(cardId: string): ResourceAssetDTO | null {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return null;
    }
    return this.resourcePopupStore.assetExplorePopupRef()?.cards.find(card => card.id === normalizedCardId) ?? null;
  }

  private assetCardToResourceCard(card: ResourceAssetDTO, subEventId: string): AppDTOs.SubEventResourceCardDTO {
    const managerUserId = `${card.ownerUserId ?? ''}`.trim() || null;
    return {
      id: `asset-explore-view-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: this.assetDetailText(card),
      imageUrl: card.imageUrl,
      sourceLink: this.assetSourceLink(card),
      routes: this.normalizeRoutes(card.type, card.routes),
      capacityTotal: Math.max(0, card.capacityTotal),
      accepted: card.type === 'Supplies'
        ? this.subEventSupplyProvidedCount(card.id, subEventId)
        : this.assetAcceptedCount(card, subEventId, managerUserId),
      pending: this.assetPendingCount(card, subEventId, managerUserId),
      isMembers: false
    };
  }

  private resolveBorrowPricing(card: ResourceAssetDTO, startAtIso: string, endAtIso: string, quantity: number): AssetExploreBorrowPricingPreview {
    return PricingBuilder.resolveAssetBorrowPricing({
      pricing: card.pricing,
      totalQuantity: AssetCardBuilder.storedQuantityValue(card),
      requestedQuantity: quantity,
      startAtIso,
      endAtIso,
      requests: card.requests
    });
  }

  private attachBoughtAssetToSubEventLocally(context: ResourcePopupContext, card: ResourceAssetDTO, quantity: number): void {
    const key = this.assignmentKey(context.subEvent.id, card.type);
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
        routes: this.normalizeRoutes(card.type, card.routes)
      };
      this.resourcePopupStore.assignedAssetSettingsByKey[key] = currentSettings;
    }
    if (card.type === 'Supplies') {
      const contributionKey = this.supplyAssignmentKey(context.subEvent.id, card.id);
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
      this.syncMetrics(false);
      this.persistResourceState(nextContext);
      return;
    }
    this.syncMetrics(false);
    this.persistResourceState(context);
  }

  private syncMetrics(persistResourceState = false): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.capacityMetrics(nextSubEvent, 'Car');
    const accommodation = this.capacityMetrics(nextSubEvent, 'Accommodation');
    const supplies = this.capacityMetrics(nextSubEvent, 'Supplies');
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
    const nextContext = {
      ...context,
      subEvent: nextSubEvent
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.resourcePopupStore.publishSubEventResourceMetrics(nextContext);
    if (persistResourceState) {
      this.persistResourceState(nextContext);
    }
  }

  private persistResourceState(context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()): void {
    const nextState = this.buildResourceState(context);
    if (!nextState) {
      return;
    }
    void this.activityResourcesService.replaceSubEventResourceState(nextState);
  }

  private buildResourceState(context: ResourcePopupContext | null): AppDTOs.ActivitySubEventResourceStateDTO | null {
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
        Car: [...this.resolveAssignedAssetIds(subEventId, 'Car')],
        Accommodation: [...this.resolveAssignedAssetIds(subEventId, 'Accommodation')],
        Supplies: [...this.resolveAssignedAssetIds(subEventId, 'Supplies')]
      },
      assetSettingsByType: {
        Car: { ...this.getAssignedAssetSettings(subEventId, 'Car') },
        Accommodation: { ...this.getAssignedAssetSettings(subEventId, 'Accommodation') },
        Supplies: { ...this.getAssignedAssetSettings(subEventId, 'Supplies') }
      },
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveAssignedAssetIds(subEventId, 'Supplies').map(assetId => [
          assetId,
          this.supplyContributionEntries(subEventId, assetId).map(entry => ({ ...entry }))
        ])
      ),
      fallbackAssetCardsByType: {
        Car: this.persistedFallbackCards(context, 'Car'),
        Accommodation: this.persistedFallbackCards(context, 'Accommodation'),
        Supplies: this.persistedFallbackCards(context, 'Supplies')
      }
    };
  }

  private capacityMetrics(subEvent: ContractTypes.SubEventDTO, type: AppConstants.AssetType): {
    joined: number;
    capacityMin: number;
    capacityMax: number;
    pending: number;
  } {
    const cards = this.assignedAssetCards(subEvent.id, type);
    const settings = this.getAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = type === 'Supplies'
      ? 0
      : cards.reduce((sum, card) => sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'pending'), 0);
    if (type === 'Supplies') {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    return {
      joined: cards.reduce((sum, card) => sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'accepted'), 0),
      capacityMin,
      capacityMax,
      pending
    };
  }

  private assignedAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    return this.resolveAssignedAssetIds(subEventId, type)
      .map(id => this.resolveAssignedAssetCard(subEventId, type, id))
      .filter((card): card is ResourceAssetDTO => card !== null);
  }

  private getAssignedAssetSettings(subEventId: string, type: AppConstants.AssetType): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = this.assignmentKey(subEventId, type);
    const assignedIds = this.resolveAssignedAssetIds(subEventId, type);
    const existing = this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
    for (const assetId of assignedIds) {
      const source = this.resolveAssignedAssetCard(subEventId, type, assetId);
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
        routes: this.normalizeRoutes(type, previous?.routes)
      };
    }
    this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const key = this.assignmentKey(subEventId, type);
    const eligibleIds = [
      ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
      ...this.fallbackAssetCards(subEventId, type).map(card => card.id)
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

  private resolveAssignedAssetCard(subEventId: string, type: AppConstants.AssetType, assetId: string): ResourceAssetDTO | null {
    return this.ownedAssetCards().find(card => card.id === assetId && card.type === type)
      ?? this.fallbackAssetCards(subEventId, type).find(card => card.id === assetId && card.type === type)
      ?? null;
  }

  private fallbackAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (context?.subEvent.id !== subEventId) {
      return [];
    }
    return context.fallbackCardsByType[type] ?? [];
  }

  private persistedFallbackCards(context: ResourcePopupContext, type: AppConstants.AssetType): AppDTOs.AssetDetailDTO[] {
    const assignedIds = new Set(this.resolveAssignedAssetIds(context.subEvent.id, type));
    const ownedIds = new Set(this.ownedAssetCards().filter(card => card.type === type).map(card => card.id));
    return (context.fallbackCardsByType[type] ?? [])
      .filter(card => assignedIds.has(card.id) && !ownedIds.has(card.id))
      .map(card => this.toAssetDetailDto(this.assignedFallbackAssetSnapshot(context.subEvent.id, card)));
  }

  private assignedFallbackAssetSnapshot(subEventId: string, card: ResourceAssetDTO): ResourceAssetDTO {
    const nextCard = this.cloneAsset(card);
    return {
      ...nextCard,
      requests: nextCard.requests.filter(request => this.isSubEventScopedAssetRequest(request, subEventId))
    };
  }

  private cloneFallbackCards(
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>
  ): Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = fallbackCardsByType?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneAsset(card));
    }
    return next;
  }

  private bookingForRange(
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
      timeframe: this.timeframeLabel(startAtIso, endAtIso),
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

  private requestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }

  private isSubEventScopedAssetRequest(request: AppDTOs.AssetMemberRequestDTO, subEventId: string): boolean {
    return ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId);
  }

  private assetRequestsForView(card: ResourceAssetDTO, subEventId: string, managerUserId: string | null = null): AppDTOs.AssetMemberRequestDTO[] {
    const requests = card.requests
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
    const normalizedManagerUserId = `${managerUserId ?? ''}`.trim();
    if (!normalizedManagerUserId) {
      return requests;
    }
    return requests;
  }

  private assetPendingCount(card: ResourceAssetDTO, subEventId?: string, managerUserId: string | null = null): number {
    const requests = subEventId ? this.assetRequestsForView(card, subEventId, managerUserId) : card.requests;
    return requests.filter(request => request.status === 'pending').length;
  }

  private assetAcceptedCount(card: ResourceAssetDTO, subEventId?: string, managerUserId: string | null = null): number {
    const requests = subEventId ? this.assetRequestsForView(card, subEventId, managerUserId) : card.requests;
    return requests.filter(request => request.status === 'accepted').length;
  }

  private findPendingBorrowRequest(
    card: ResourceAssetDTO,
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

  private isWindowOverlap(request: AppDTOs.AssetMemberRequestDTO, startAtIso: string, endAtIso: string): boolean {
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

  private isRangeOverlap(leftStartAtIso: string, leftEndAtIso: string, rightStartAtIso: string, rightEndAtIso: string): boolean {
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

  private isValidWindow(startAtIso: string, endAtIso: string): boolean {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(endAtIso);
    return !!start && !!end && start.getTime() < end.getTime();
  }

  private parseLocalDateMs(value: string | null | undefined): number | null {
    const parsed = AppUtils.isoLocalDateTimeToDate(`${value ?? ''}`.trim());
    return parsed ? parsed.getTime() : null;
  }

  private priceAmount(card: ResourceAssetDTO): number {
    if (!card.pricing?.enabled) {
      return 0;
    }
    return Math.max(0, Number(card.pricing.basePrice) || 0);
  }

  private priceLabel(card: ResourceAssetDTO): string {
    const amount = this.priceAmount(card);
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

  private toAssetDto(card: ResourceAssetDTO): AppDTOs.AssetDTO {
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue(card),
      description: this.assetDetailText(card),
      imageUrl: card.imageUrl,
      locationLabel: card.locationLabel ?? (card.type === 'Accommodation' ? this.normalizeRoutes(card.type, card.routes).find(Boolean) : card.city),
      priceLabel: card.priceLabel ?? this.priceLabel(card),
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
      policyCount: AssetCardBuilder.assetPoliciesEnabled(card) ? card.policyCount ?? (card.policies ?? []).length : 0,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
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

  private toAssetDetailDto(card: ResourceAssetDTO): AppDTOs.AssetDetailDTO {
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue(card),
      details: this.assetDetailText(card),
      imageUrl: card.imageUrl,
      sourceLink: this.assetSourceLink(card),
      routes: this.normalizeRoutes(card.type, card.routes),
      topics: [...(card.topics ?? [])],
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
      policies: (card.policies ?? []).map(policy => ({ ...policy })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : card.pricing,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
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

  private cloneAsset(card: ResourceAssetDTO): ResourceAssetDTO {
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

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent,
      pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : undefined
    };
  }

  private normalizeRoutes(type: AppConstants.AssetType, routes: string[] | undefined | null): string[] {
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

  private assetDetailText(card: ResourceAssetDTO): string {
    return `${card.details ?? card.description ?? ''}`.trim();
  }

  private assetSourceLink(card: ResourceAssetDTO): string {
    return `${card.sourceLink ?? ''}`.trim();
  }

  private supplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  private supplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.supplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.supplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private assignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private timeframeLabel(startAtIso: string, endAtIso: string): string {
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
      ownerId: input.eventId,
      ownerUserId: activeUserId
    };
  }

  private openShareDialog(card: ResourceAssetDTO): void {
    void this.shareTokensService.createToken({
      kind: 'asset',
      entityId: card.id,
      assetType: card.type,
      ownerUserId: card.ownerUserId ?? null
    }).then(token => this.openShareLinkDialog('Share asset', token));
  }

  private openShareLinkDialog(title: string, shareToken: string): void {
    this.dialogStore.open({
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

  private canReportOwner(card: ResourceAssetDTO): boolean {
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    return !!this.resourcePopupStore.popupContextRef() && !!ownerUserId && ownerUserId !== activeUserId;
  }

  private reportOwner(card: ResourceAssetDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    if (!context || !ownerUserId || ownerUserId === activeUserId) {
      return;
    }
    this.profileStore.openReportUserPopup({
      targetUserId: ownerUserId,
      targetName: card.ownerName?.trim() || this.reportTargetName(ownerUserId, 'Owner'),
      eventId: context.ownerId,
      eventTitle: card.title,
      eventStartAtIso: context.subEvent.startAt,
      eventTimeframe: this.reportContextTimeframe(context),
      ownerType: 'asset'
    });
  }

  private reportTargetName(userId: string, fallback: string): string {
    const normalizedUserId = userId.trim();
    return this.userProfileStore.getUserProfile(normalizedUserId)?.name?.trim()
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

  private infoCardMenuTitle(card: InfoCardData): string | null {
    if (card.menuTitle === null) {
      return null;
    }
    return `${card.menuTitle ?? card.title ?? ''}`.trim();
  }

  private infoCardMenuItems(
    card: ResourceAssetDTO,
    request: CardMenuRequestEvent<InfoCardData>
  ): readonly AppMenuItem<string, AssetExploreMenuContext>[] {
    return (request.actions ?? []).flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardMenuAction = {
        id: actionId,
        ...config
      };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.infoCardActionPalette(config.tone),
        surface: 'tinted',
        context: {
          menu: 'asset-explore-card',
          card,
          infoCard: request.card,
          action
        }
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

  private orderPalette(order: AssetExploreOrder): AppMenuPalette {
    if (order === 'lowest-price') {
      return 'gold';
    }
    if (order === 'fewest-policies') {
      return 'violet';
    }
    return 'green';
  }

  private assetCategoryPalette(category: AppConstants.AssetCategory): AppMenuPalette {
    return this.resourceTypePalette(AssetDefaultsBuilder.assetCategoryType(category));
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

  private initialPageSize(basePageSize: number): number {
    const configuredInitialPageSize = Math.max(
      basePageSize,
      Math.trunc(Number(this.smartListConfig.initialPageSize ?? basePageSize))
    );
    if (!this.isMobileViewport()) {
      return configuredInitialPageSize;
    }
    return basePageSize;
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 760px)').matches;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return fallback;
  }

  private subEventDisplayName(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    return this.subEventDisplayName(subEvent) || 'Sub Event';
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
