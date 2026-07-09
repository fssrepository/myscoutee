import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  TemplateRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import {
  type ActivityMembersSyncState
} from '../../../shared/ui';
import {
  CommonModule
} from '@angular/common';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import type { EventExploreFeedFilters } from '../../../shared/core/contracts';
import type { ActivityPendingReason } from '../../../shared/core/common/constants';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  ActivityEventDetailDTO
} from '../../../shared/core/contracts/activity.interface';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  ActivityMembersBuilder,
  ActivityMembersService,
  ActivitiesService,
  EventsService,
  GameService,
  ShareTokensService,
  UsersService,
  type UserDto
} from '../../../shared/core';
import {
  ActivitiesPopupStore,
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  AppMenuDispatcher,
  AppMenuComponent,
  AppMenuOutletComponent,
  appMenuPaletteFromToneClass,
  buildTabbedMenuModel,
  EventExploreInfoCardConverter,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  CARD_MENU_ACTIONS,
  InfoCardComponent,
  PopupComponent,
  type PageResult,
  SmartListComponent,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type CardMenuAction,
  type ListQuery,
  type PopupModel,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLocalSortKey,
  type SmartListStateChange
} from '../../../shared/ui';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  EventCheckoutDraftStore,
  type EventCheckoutDraft
} from '../../../shared/ui/context/stores/event-checkout-draft.store';
import {
  EventCheckoutDialogStore
} from '../../../shared/ui/context/stores/event-checkout-dialog.store';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import type { ActivityEventDTO, ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import type { UserMenuCounterDeltasDto } from '../../../shared/core/contracts/user.interface';
import type { ActivityMemberOwnerRef } from '../../../shared/core/contracts/activity.interface';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';

type CheckoutDraftEntry = {
  draft: EventCheckoutDraft;
  record: ActivityEventRecord | null;
};

type CheckoutDraftMenuVisual = {
  label: string;
  icon: string;
  palette: AppMenuPalette;
};

type EventExploreMenuContext =
  | { menu: 'order'; order: ContractTypes.EventExploreOrder }
  | { menu: 'view'; view: ContractTypes.EventExploreView }
  | { menu: 'filter-toggle'; filter: 'friends' | 'open-spots' }
  | { menu: 'topic-filter'; topic: string }
  | { menu: 'checkout-draft'; entry: CheckoutDraftEntry }
  | {
      menu: 'info-card';
      record: ActivityEventRecord;
      card: InfoCardData;
      action: CardMenuAction;
    };

@Component({
  selector: 'app-event-explore-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    InfoCardComponent,
    PopupComponent,
    SmartListComponent
  ],
  templateUrl: './event-explore-popup.component.html',
  styleUrl: './event-explore-popup.component.scss',
  providers: [AppMenuDispatcher],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventExplorePopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly activitiesService = inject(ActivitiesService);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly usersService = inject(UsersService);
  private readonly profileStore = inject(ProfileStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly eventCheckoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly eventCheckoutDialogStore = inject(EventCheckoutDialogStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  protected readonly eventSubeventsStore = inject(EventSubeventsPopupStore);

  protected readonly eventExploreOrderOptions = APP_STATIC_DATA.eventExploreOrderOptions;
  protected readonly eventExploreViewOptions = APP_STATIC_DATA.activitiesViewOptions.filter(
    (option): option is { key: ContractTypes.EventExploreView; label: string; icon: string } =>
      option.key === 'day' || option.key === 'distance'
  );
  protected readonly topicFilterGroups = APP_STATIC_DATA.interestOptionGroups;

  private users: UserDto[] = [];
  private userByIdMap = new Map<string, UserDto>();

  protected isOpen = false;
  protected slotPickerRecord: ActivityEventRecord | null = null;
  protected eventExploreOrder: ContractTypes.EventExploreOrder = 'upcoming';
  protected eventExploreView: ContractTypes.EventExploreView = 'day';
  protected eventExploreFilterFriendsOnly = false;
  protected eventExploreFilterHasRooms = false;
  protected eventExploreFilterTopic = '';

  protected eventExploreHeaderProgress = 0;
  protected eventExploreHeaderProgressLoading = false;
  protected eventExploreHeaderLoadingProgress = 0;
  protected eventExploreHeaderLoadingOverdue = false;
  protected eventExploreStickyLabel = 'No items';

  protected selectedMembers: ActivityContracts.ActivityMemberDTO[] = [];
  protected selectedMembersTitle = '';
  protected selectedMembersPendingOnly = false;
  protected selectedMembersRecord: ActivityEventRecord | null = null;

  private activeUserId = '';
  private eventEditorPrewarmStarted = false;
  private readonly leavingEventExploreRecordIds = new Set<string>();
  private readonly eventExploreExitAnimationMs = 180;
  private lastAppliedActivityMembersUpdatedMs = 0;
  private lastPendingCheckoutDraftSourceIds = new Set<string>();
  private readonly locallyTrackedMembershipSourceIds = new Set<string>();
  private readonly checkoutDraftClearSaveSourceIds = new Set<string>();
  private readonly checkoutDraftReleaseSourceIds = new Set<string>();

  protected eventExploreSmartListQuery: Partial<ListQuery<EventExploreFeedFilters>> = {};

  @ViewChild('eventExploreSmartList')
  private eventExploreSmartList?: SmartListComponent<ActivityEventRecord, EventExploreFeedFilters>;

  protected eventExploreItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityEventRecord, EventExploreFeedFilters>>;

  @ViewChild('eventExploreItemTemplate', { read: TemplateRef })
  protected set eventExploreItemTemplate(value: TemplateRef<SmartListItemTemplateContext<ActivityEventRecord, EventExploreFeedFilters>> | undefined) {
    this.eventExploreItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly eventExploreLoadPage = (query: ListQuery<EventExploreFeedFilters>) =>
    from(this.loadEventExplorePage(query));

  private readonly eventExploreCompactMenuModel: AppMenuModel<string, EventExploreMenuContext> = {
    density: 'compact'
  };

  protected readonly eventExploreSmartListConfig: SmartListConfig<ActivityEventRecord, EventExploreFeedFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    defaultView: 'list',
    emptyLabel: 'No visible events right now.',
    emptyDescription: 'Try another filter or check back later.',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    presentation: 'list',
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true
    },
    stickyHeaderClass: 'event-explore-sticky-header',
    trackBy: (_index, record) => `${record.type}:${record.id}`,
    sortable: {
      sortKey: record => this.eventExploreRecordLocalSortKey(record)
    },
    showGroupMarker: ({ groupIndex, scrollable }) => {
      if (groupIndex > 0) {
        return true;
      }
      return scrollable;
    },
    groupBy: (record, query) => this.buildEventExploreGroupLabel(record, query.filters?.view ?? this.eventExploreView)
  };

  constructor() {
    this.refreshUsersDirectory();

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventExplore' && request.type !== 'eventCheckoutDraft')) {
        return;
      }
      this.memberMenuStore.clearActivitiesNavigationRequest();
      if (request.type === 'eventCheckoutDraft') {
        void this.continueCheckoutDraftBySourceId(request.sourceId);
        return;
      }
      this.openEventExplore();
    });

    effect(() => {
      const nextActiveUserId = this.userProfileStore.activeUserId().trim();
      if (nextActiveUserId === this.activeUserId) {
        return;
      }
      this.activeUserId = nextActiveUserId;
      this.locallyTrackedMembershipSourceIds.clear();
      this.syncEventExploreQuery();
      if (this.isOpen) {
        this.reloadEventExploreSmartList();
      }
      this.cdr.markForCheck();
    });

    effect(() => {
      const sync = this.activityStore.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSyncState(sync);
    });

    effect(() => {
      const sync = this.activitiesStore.activityEventSave();
      if (!sync) {
        return;
      }
      this.applyActivityEventSave(sync);
    });

    effect(() => {
      const request = this.eventSubeventsStore.eventSubeventsListPopup();
      if (!request || request.host !== 'eventExplore' || !this.isOpen) {
        return;
      }
      void this.eventSubeventsStore.ensureEventSubeventsListPopupLoaded();
    });

    effect(() => {
      this.eventCheckoutDraftStore.drafts();
      if (this.isOpen) {
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.selectedMembersRecord) {
      this.closeMembersPopup();
      return;
    }
    if (this.slotPickerRecord) {
      this.closeEventExploreSlotPicker();
      return;
    }
    this.closeEventExplore();
  }

  protected onEventExploreSmartListStateChange(state: SmartListStateChange<ActivityEventRecord, EventExploreFeedFilters>): void {
    this.eventExploreHeaderProgress = state.progress;
    this.eventExploreHeaderProgressLoading = state.loading;
    this.eventExploreHeaderLoadingProgress = state.loadingProgress;
    this.eventExploreHeaderLoadingOverdue = state.loadingOverdue;
    this.eventExploreStickyLabel = state.stickyLabel || 'No items';
    this.cdr.markForCheck();
  }

  protected eventExplorePopupModel(): PopupModel<EventExploreMenuContext> {
    return {
      title: this.eventExploreHeaderTitle(),
      ariaLabel: this.eventExploreHeaderTitle(),
      closeAriaLabel: 'Close event explore',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: [
        {
          kind: 'menu',
          id: 'event-explore-order',
          menuKind: 'select',
          model: this.eventExploreCompactMenuModel,
          trigger: this.eventExploreOrderMenuTrigger(),
          items: this.eventExploreOrderMenuItems()
        },
        {
          kind: 'menu',
          id: 'event-explore-view',
          menuKind: 'select',
          model: this.eventExploreCompactMenuModel,
          trigger: this.eventExploreViewMenuTrigger(),
          items: this.eventExploreViewMenuItems()
        }
      ],
      toolbarControls: [
        {
          kind: 'menu',
          id: 'event-explore-filters',
          menuKind: 'inline',
          model: this.eventExploreCompactMenuModel,
          items: this.eventExploreFilterMenuItems()
        }
      ],
      onClose: () => this.closeEventExplore(),
      onMenuSelect: event => this.onEventExploreMenuSelect(event.itemSelect)
    };
  }

  protected eventExplorePopupZIndex(): number {
    return 2400;
  }

  protected closeEventExplore(): void {
    this.isOpen = false;
    this.slotPickerRecord = null;
    this.closeEventExploreSubeventsPopup();
    this.closeMembersPopup();
    this.resetHeaderState();
    this.cdr.markForCheck();
  }

  protected selectEventExploreOrder(order: ContractTypes.EventExploreOrder, event?: Event): void {
    event?.stopPropagation();
    if (this.eventExploreOrder === order) {
      this.cdr.markForCheck();
      return;
    }
    this.eventExploreOrder = order;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected selectEventExploreView(view: ContractTypes.EventExploreView, event?: Event): void {
    event?.stopPropagation();
    if (this.eventExploreView === view) {
      this.cdr.markForCheck();
      return;
    }
    this.eventExploreView = view;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected toggleEventExploreFriendsOnly(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterFriendsOnly = !this.eventExploreFilterFriendsOnly;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected toggleEventExploreHasRooms(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterHasRooms = !this.eventExploreFilterHasRooms;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected selectEventExploreTopicFilter(topic: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedTopic = this.normalizeTopic(topic);
    this.eventExploreFilterTopic = normalizedTopic === this.normalizeTopic(this.eventExploreFilterTopic) ? '' : topic;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected eventExploreTopicLabel(topic: string): string {
    return topic.replace(/^#+\s*/, '');
  }

  protected eventExploreOrderMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventExploreOrderLabel(),
      icon: this.eventExploreOrderIcon(),
      ariaLabel: 'Open event explore order',
      palette: this.eventExploreOrderPalette(this.eventExploreOrder),
      layout: 'pill'
    };
  }

  protected eventExploreOrderMenuItems(): readonly AppMenuItem<string, EventExploreMenuContext>[] {
    return this.eventExploreOrderOptions.map(option => ({
      id: `order-${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === this.eventExploreOrder,
      checked: option.key === this.eventExploreOrder,
      palette: this.eventExploreOrderPalette(option.key),
      surface: 'tinted',
      context: { menu: 'order', order: option.key }
    }));
  }

  protected eventExploreViewMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventExploreCurrentViewLabel(),
      icon: this.eventExploreCurrentViewIcon(),
      ariaLabel: 'Open event explore view',
      palette: this.eventExploreViewPalette(this.eventExploreView),
      layout: 'pill'
    };
  }

  protected eventExploreViewMenuItems(): readonly AppMenuItem<string, EventExploreMenuContext>[] {
    return this.eventExploreViewOptions.map(option => ({
      id: `view-${option.key}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      active: option.key === this.eventExploreView,
      checked: option.key === this.eventExploreView,
      palette: this.eventExploreViewPalette(option.key),
      surface: 'tinted',
      context: { menu: 'view', view: option.key }
    }));
  }

  protected eventExploreFilterMenuItems(): readonly AppMenuItem<string, EventExploreMenuContext>[] {
    return [
      {
        id: 'filter-friends-going',
        label: 'Friends going',
        icon: 'groups',
        kind: 'toggle',
        layout: 'pill',
        active: this.eventExploreFilterFriendsOnly,
        checked: this.eventExploreFilterFriendsOnly,
        closeOnSelect: false,
        palette: 'green',
        context: { menu: 'filter-toggle', filter: 'friends' }
      },
      {
        id: 'filter-open-spots',
        label: 'Open spots',
        icon: 'hotel',
        kind: 'toggle',
        layout: 'pill',
        active: this.eventExploreFilterHasRooms,
        checked: this.eventExploreFilterHasRooms,
        closeOnSelect: false,
        palette: 'blue',
        context: { menu: 'filter-toggle', filter: 'open-spots' }
      },
      {
        id: 'filter-topic',
        label: this.eventExploreFilterTopic
          ? `#${this.eventExploreTopicLabel(this.eventExploreFilterTopic)}`
          : 'Topic',
        icon: 'sell',
        kind: 'select-trigger',
        layout: 'pill',
        active: !!this.eventExploreFilterTopic,
        checked: !!this.eventExploreFilterTopic,
        closeOnSelect: false,
        palette: this.eventExploreTopicPalette(this.eventExploreFilterTopic),
        ariaLabel: 'Open topic filter',
        filterable: true,
        model: this.eventExploreTopicMenuModel()
      }
    ];
  }

  private eventExploreTopicMenuModel(): AppMenuModel<string, EventExploreMenuContext> {
    return buildTabbedMenuModel<string, EventExploreMenuContext>({
      idPrefix: 'topic',
      groups: this.topicFilterGroups,
      selected: this.eventExploreFilterTopic ? [this.eventExploreFilterTopic] : [],
      maxSelected: 1,
      kind: 'radio',
      context: topic => ({ menu: 'topic-filter', topic }),
      itemLabel: topic => `#${this.eventExploreTopicLabel(topic)}`,
      removeAriaLabel: topic => `Clear ${topic}`,
      summary: {
        emptyLabel: 'Topic',
        maxLabels: 1,
        counter: 'none'
      }
    });
  }

  protected onEventExploreMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventExploreMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'info-card') {
      this.onEventExploreCardMenuAction(context.record, {
        id: context.card.id,
        actionId: context.action.id,
        action: context.action,
        card: context.card
      });
      return;
    }
    if (context.menu === 'order') {
      this.selectEventExploreOrder(context.order, event.sourceEvent);
      return;
    }
    if (context.menu === 'view') {
      this.selectEventExploreView(context.view, event.sourceEvent);
      return;
    }
    if (context.menu === 'filter-toggle') {
      if (context.filter === 'friends') {
        this.toggleEventExploreFriendsOnly(event.sourceEvent);
        return;
      }
      this.toggleEventExploreHasRooms(event.sourceEvent);
      return;
    }
    if (context.menu === 'checkout-draft') {
      if (event.action === 'remove') {
        this.requestClearCheckoutDraft(context.entry.draft, event.sourceEvent);
        return;
      }
      void this.openCheckoutDraftForm(context.entry, event.sourceEvent);
      return;
    }
    if (context.menu === 'topic-filter') {
      if (event.action === 'remove') {
        event.sourceEvent.stopPropagation();
        if (this.normalizeTopic(context.topic) !== this.normalizeTopic(this.eventExploreFilterTopic)) {
          return;
        }
        this.eventExploreFilterTopic = '';
        this.syncEventExploreQuery();
        this.reloadEventExploreSmartList();
        return;
      }
      this.selectEventExploreTopicFilter(context.topic, event.sourceEvent);
    }
  }

  protected openEventExploreInfoCardMenu(
    record: ActivityEventRecord,
    request: CardMenuRequestEvent<InfoCardData>
  ): void {
    const menuId = `event-explore-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(record, request),
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
    record: ActivityEventRecord,
    request: CardMenuRequestEvent<InfoCardData>
  ): readonly AppMenuItem<string, EventExploreMenuContext>[] {
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
          menu: 'info-card',
          record,
          card: request.card,
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

  protected eventExploreOrderLabel(order: ContractTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.label ?? 'Upcoming';
  }

  protected eventExploreOrderIcon(order: ContractTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.icon ?? 'event_upcoming';
  }

  protected eventExploreCurrentViewLabel(view: ContractTypes.EventExploreView = this.eventExploreView): string {
    return this.eventExploreViewOptions.find(option => option.key === view)?.label ?? 'Day';
  }

  protected eventExploreCurrentViewIcon(view: ContractTypes.EventExploreView = this.eventExploreView): string {
    return this.eventExploreViewOptions.find(option => option.key === view)?.icon ?? 'today';
  }

  private eventExploreOrderPalette(order: ContractTypes.EventExploreOrder): AppMenuPalette {
    switch (order) {
      case 'upcoming':
        return 'blue';
      case 'past-events':
        return 'slate';
      case 'nearby':
        return 'green';
      case 'top-rated':
        return 'gold';
      default:
        return 'violet';
    }
  }

  private eventExploreViewPalette(view: ContractTypes.EventExploreView): AppMenuPalette {
    return view === 'distance' ? 'teal' : 'blue';
  }

  private eventExploreTopicPalette(topic: string): AppMenuPalette {
    const normalizedTopic = this.normalizeTopic(topic);
    if (!normalizedTopic) {
      return 'neutral';
    }
    const group = this.topicFilterGroups.find(item =>
      item.options.some(option => this.normalizeTopic(option) === normalizedTopic)
    );
    return appMenuPaletteFromToneClass(group?.toneClass);
  }

  protected eventExploreHeaderTitle(): string {
    return 'Event Explore';
  }

  protected openEventExploreMembers(
    record: ActivityEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    if (!this.canPreviewEventExploreMembers(record)) {
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: record.id,
      ownerType: 'event',
      subtitle: record.title,
      canManage: false,
      viewOnly: true
    });
    this.cdr.markForCheck();
  }

  protected closeMembersPopup(): void {
    this.selectedMembersRecord = null;
    this.selectedMembers = [];
    this.selectedMembersTitle = '';
    this.selectedMembersPendingOnly = false;
  }

  protected activityMembersPendingCount(): number {
    return this.selectedMembers.filter(member => member.status === 'pending').length;
  }

  protected activityMembersHeaderSummary(): string {
    const pendingCount = this.activityMembersPendingCount();
    const acceptedCount = this.selectedMembers.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected get activityMembersOrdered(): ActivityContracts.ActivityMemberDTO[] {
    if (!this.selectedMembersPendingOnly) {
      return this.sortMembersByActionTimeDesc(this.selectedMembers);
    }
    return this.sortMembersByActionTimeDesc(this.selectedMembers)
      .filter(member => member.status === 'pending');
  }

  protected handleMembersTogglePendingOnly(): void {
    this.selectedMembersPendingOnly = !this.selectedMembersPendingOnly;
  }

  protected runEventExploreViewAction(
    record: ActivityEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    this.eventSubeventsStore.openEventSubeventsListPopup({
      eventId: record.id,
      host: 'eventExplore',
      target: record.type === 'hosting' ? 'hosting' : 'events',
      title: record.title,
      timeframe: record.slotsEnabled && record.nextSlot ? record.nextSlot.timeframe : record.timeframe,
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      mode: record.mode ?? null,
      canEdit: false
    });
    this.cdr.markForCheck();
  }

  private closeEventExploreSubeventsPopup(): void {
    if (this.eventSubeventsStore.eventSubeventsListPopup()?.host !== 'eventExplore') {
      return;
    }
    this.eventSubeventsStore.closeEventSubeventsListPopup();
  }

  protected runEventExploreJoinAction(
    record: ActivityEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return;
    }
    if (record.creatorUserId === activeUserId) {
      this.dialogStore.openInfo(`You already host ${record.title}.`, {
        title: 'Already hosting',
        confirmTone: 'neutral'
      });
      return;
    }
    const existingDraft = this.trackableCheckoutDraft(record.id, activeUserId);
    if (existingDraft) {
      void this.openCheckoutDraftForm({ draft: existingDraft, record }, event);
      return;
    }
    if (this.hasTrackedMembership(record, activeUserId)) {
      const membershipStatus = this.eventExploreMembershipStatus(record, activeUserId);
      this.openEventExploreCheckout(record, {
        approvalGranted: membershipStatus === 'accepted',
        pendingReason: membershipStatus === 'accepted'
          ? null
          : this.eventExploreCheckoutPendingReason(record)
      });
      return;
    }
    if (this.shouldUseCheckoutFlow(record)) {
      this.openEventExploreCheckout(record);
      return;
    }
    this.dialogStore.open({
      title: this.eventExploreJoinDialogTitle(record),
      message: record.title,
      cancelLabel: 'Cancel',
      confirmLabel: this.eventExploreJoinConfirmLabel(record),
      busyConfirmLabel: this.eventExploreJoinBusyLabel(record),
      confirmTone: 'accent',
      failureMessage: this.eventExploreJoinFailureMessage(record),
      onConfirm: () => this.submitEventExploreJoinRequest(record)
    });
  }

  protected openHostImpressions(
    record: ActivityEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    this.userProfileStore.setUserProfile(this.resolveUser(record.creatorUserId, record));
    void this.usersService.loadUserById(record.creatorUserId);
    this.profileStore.openImpressionsPopup(record.creatorUserId);
  }

  protected canPreviewEventExploreMembers(record: ActivityEventRecord): boolean {
    return record.blindMode === 'Open Event';
  }

  protected onEventExploreCardMenuAction(record: ActivityEventRecord, action: CardMenuActionEvent<InfoCardData>): void {
    if (action.actionId === 'view') {
      this.runEventExploreViewAction(record);
      return;
    }
    if (action.actionId === 'continueBooking' || action.actionId === 'continueBookingPending') {
      const activeUserId = this.activeUserId.trim();
      const draft = activeUserId ? this.trackableCheckoutDraft(record.id, activeUserId) : null;
      if (draft) {
        void this.openCheckoutDraftForm({ draft, record });
        return;
      }
      this.openEventExploreCheckout(record, {
        approvalGranted: false,
        pendingReason: this.eventExploreCheckoutPendingReason(record)
      });
      return;
    }
    if (this.isEventExploreJoinMenuAction(action.actionId)) {
      this.runEventExploreJoinAction(record);
      return;
    }
    if (action.actionId === 'askOrganizer') {
      this.runEventExploreServiceChatAction(record);
      return;
    }
    if (action.actionId === 'notifyParticipants') {
      this.runEventExploreServiceChatAction(record);
      return;
    }
    if (action.actionId === 'shareEvent') {
      this.runEventExploreShareAction(record);
      return;
    }
    if (action.actionId === 'reportOrganizer') {
      this.runEventExploreReportAction(record);
    }
  }

  protected checkoutDraftCount(): number {
    return this.checkoutDraftEntries().length;
  }

  protected checkoutDraftEntries(): CheckoutDraftEntry[] {
    const activeUserId = this.activeUserId.trim();
    return this.eventCheckoutDraftStore.listByUser(activeUserId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
      .map(draft => ({
        draft,
        record: this.visibleEventExploreRecordById(draft.sourceId)
          ?? this.eventsService.peekKnownRecordById(activeUserId, draft.sourceId)
      }));
  }

  protected canContinueCheckoutDraft(entry: CheckoutDraftEntry): boolean {
    if (this.isCheckoutDraftClearing(entry.draft.sourceId)) {
      return false;
    }
    if (entry.draft.pendingReason === 'waitlist' || entry.draft.checkoutState === 'waiting') {
      return false;
    }
    if (Boolean(entry.draft.checkoutSessionId?.trim())) {
      return true;
    }
    if (!this.requiresApprovalBeforePayment(entry.record, entry.draft)) {
      return true;
    }
    return this.resolveCheckoutDraftMembershipStatus(entry.draft.sourceId, entry.record) === 'accepted';
  }

  protected checkoutDraftMenuTrigger(): AppMenuTrigger {
    const entries = this.checkoutDraftEntries();
    const count = entries.length;
    const changedCount = entries.filter(entry => entry.draft.basketChanged === true).length;
    return {
      icon: 'shopping_basket',
      closeIcon: 'close',
      ariaLabel: changedCount > 0
        ? (changedCount === 1 ? 'Open basket with 1 changed item' : `Open basket with ${changedCount} changed items`)
        : (count === 1 ? 'Open basket with 1 item' : `Open basket with ${count} items`),
      counter: changedCount > 0 ? changedCount : count,
      hideLabel: true,
      layout: 'icon',
      palette: changedCount > 0 ? 'orange' : 'green'
    };
  }

  protected checkoutDraftMenuItems(): readonly AppMenuItem<string, EventExploreMenuContext>[] {
    return this.checkoutDraftEntries().map(entry => {
      const clearing = this.isCheckoutDraftClearing(entry.draft.sourceId);
      const itemCount = this.checkoutDraftBasketItemCount(entry.draft);
      return {
        id: `checkout-draft-${entry.draft.sourceId}`,
        label: entry.draft.eventTitle,
        description: [
          entry.draft.eventTimeframe || entry.record?.timeframe || 'Pending checkout',
          `${itemCount} elem · ${entry.draft.currency} ${entry.draft.totalAmount.toFixed(2)}`
        ].join('\n'),
        detail: clearing ? 'Releasing...' : this.checkoutDraftMenuStatusLabel(entry),
        icon: this.checkoutDraftMenuIcon(entry),
        kind: 'action',
        palette: this.checkoutDraftMenuPalette(entry),
        headerBadge: entry.draft.basketChanged === true ? 'Update' : null,
        surface: 'tinted',
        layout: 'pill',
        disabled: clearing,
        removable: true,
        removeIcon: 'close',
        removeAriaLabel: `Clear ${entry.draft.eventTitle}`,
        context: { menu: 'checkout-draft', entry }
      };
    });
  }

  private checkoutDraftBasketItemCount(draft: EventCheckoutDraft): number {
    const activeItems = (draft.basketItems ?? [])
      .filter(item => item.resultState !== 'deleted' && item.resultState !== 'succeeded');
    const primaryItems = activeItems.filter(item => item.kind !== 'sub_event');
    if (primaryItems.length === 0) {
      return activeItems.length > 0 ? 1 : Math.max(0, draft.lineItems.length);
    }
    const groupKeys = new Set(primaryItems.map(item => this.checkoutDraftBasketItemGroupKey(item)));
    return Math.max(1, groupKeys.size);
  }

  private checkoutDraftBasketItemGroupKey(item: ActivityContracts.EventCheckoutBasketItem): string {
    const slotSourceId = item.slotSourceId?.trim() ?? '';
    if (slotSourceId) {
      return slotSourceId;
    }
    return item.id?.trim() || item.label?.trim() || 'checkout-item';
  }

  protected isCheckoutDraftClearing(sourceId: string): boolean {
    return this.checkoutDraftReleaseSourceIds.has(sourceId.trim());
  }

  private checkoutDraftMenuStatusLabel(entry: CheckoutDraftEntry): string {
    return this.checkoutDraftMenuVisual(entry).label;
  }

  private checkoutDraftMenuIcon(entry: CheckoutDraftEntry): string {
    return this.checkoutDraftMenuVisual(entry).icon;
  }

  private checkoutDraftMenuPalette(entry: CheckoutDraftEntry): AppMenuPalette {
    return this.checkoutDraftMenuVisual(entry).palette;
  }

  private checkoutDraftMenuVisual(entry: CheckoutDraftEntry): CheckoutDraftMenuVisual {
    if (this.isCheckoutDraftClearing(entry.draft.sourceId)) {
      return {
        label: 'Felszabadítás...',
        icon: 'hourglass_empty',
        palette: 'warning'
      };
    }

    const resultState = this.checkoutDraftResultState(entry.draft);
    if (resultState === 'failed') {
      return {
        label: 'Sikertelen',
        icon: 'error',
        palette: 'danger'
      };
    }

    if (entry.draft.checkoutState === 'cancelled') {
      return {
        label: 'Lemondva',
        icon: 'block',
        palette: 'neutral'
      };
    }

    if (entry.draft.checkoutState === 'rejected') {
      return {
        label: 'Elutasítva',
        icon: 'block',
        palette: 'danger'
      };
    }

    if (entry.draft.basketChanged === true) {
      return {
        label: 'Frissítés szükséges',
        icon: 'edit_note',
        palette: 'orange'
      };
    }

    if (entry.draft.pendingReason === 'waitlist' || entry.draft.checkoutState === 'waiting') {
      return {
        label: 'Várólistán',
        icon: 'hourglass_empty',
        palette: 'amber'
      };
    }

    if (entry.draft.pendingReason === 'approval' || entry.draft.checkoutState === 'approval-pending') {
      return {
        label: 'Jóváhagyásra vár',
        icon: 'pending_actions',
        palette: 'orange'
      };
    }

    if (entry.draft.checkoutState === 'confirmed') {
      return Math.max(0, Number(entry.draft.totalAmount) || 0) > 0
        ? {
            label: 'Fizetésre kész',
            icon: 'payments',
            palette: 'green'
          }
        : {
            label: 'Megerősítve',
            icon: 'event_available',
            palette: 'green'
          };
    }

    if (entry.draft.checkoutState === 'approved') {
      return Math.max(0, Number(entry.draft.totalAmount) || 0) > 0
        ? {
            label: 'Fizetésre kész',
            icon: 'payments',
            palette: 'green'
          }
        : {
            label: 'Jóváhagyva',
            icon: 'verified',
            palette: 'success'
          };
    }

    if (entry.draft.checkoutState === 'pay') {
      return {
        label: 'Fizetés alatt',
        icon: 'payments',
        palette: 'green'
      };
    }

    if (this.canContinueCheckoutDraft(entry)) {
      return {
        label: 'Folytatható',
        icon: 'event_available',
        palette: 'teal'
      };
    }

    return {
      label: 'Piszkozat',
      icon: 'shopping_basket',
      palette: 'blue'
    };
  }

  private checkoutDraftResultState(draft: EventCheckoutDraft): ActivityContracts.EventCheckoutResultState {
    const resultStates = (draft.basketItems ?? []).map(item => item.resultState ?? 'pending');
    if (resultStates.some(resultState => resultState === 'failed')) {
      return 'failed';
    }
    if (resultStates.length > 0 && resultStates.every(resultState => resultState === 'deleted')) {
      return 'deleted';
    }
    if (resultStates.length > 0 && resultStates.every(resultState => resultState === 'deleted' || resultState === 'succeeded')) {
      return 'succeeded';
    }
    return 'pending';
  }

  protected async continueCheckoutDraft(
    entry: CheckoutDraftEntry,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): Promise<void> {
    this.stopDomEvent(event);
    if (!this.canContinueCheckoutDraft(entry)) {
      return;
    }
    const { draft } = entry;
    const record = entry.record
      ?? this.visibleEventExploreRecordById(draft.sourceId)
      ?? this.eventsService.peekKnownRecordById(this.activeUserId, draft.sourceId)
      ?? await this.eventsService.queryKnownRecordById(this.activeUserId, draft.sourceId);
    if (!record) {
      this.eventCheckoutDraftStore.clear(this.activeUserId, draft.sourceId);
      this.dialogStore.openInfo('This checkout draft can no longer be restored.', {
        title: 'Basket unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }
    const pendingReason = this.checkoutDraftPendingReason(draft);
    this.openEventExploreCheckout(record, {
      approvalGranted: pendingReason ? false : this.canContinueCheckoutDraft({ draft, record }),
      pendingReason
    });
  }

  protected async openCheckoutDraftForm(
    entry: CheckoutDraftEntry,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): Promise<void> {
    this.stopDomEvent(event);
    if (this.isCheckoutDraftClearing(entry.draft.sourceId)) {
      return;
    }
    const { draft } = entry;
    const record = entry.record
      ?? this.visibleEventExploreRecordById(draft.sourceId)
      ?? this.eventsService.peekKnownRecordById(this.activeUserId, draft.sourceId)
      ?? await this.eventsService.queryKnownRecordById(this.activeUserId, draft.sourceId);
    if (!record) {
      this.eventCheckoutDraftStore.clear(this.activeUserId, draft.sourceId);
      this.dialogStore.openInfo('This checkout draft can no longer be restored.', {
        title: 'Basket unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }
    const pendingReason = this.checkoutDraftPendingReason(draft);
    this.openEventExploreCheckout(record, {
      approvalGranted: pendingReason ? false : this.canContinueCheckoutDraft({ draft, record }),
      pendingReason
    });
  }

  private async continueCheckoutDraftBySourceId(sourceId: string): Promise<void> {
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) {
      return;
    }
    const activeUserId = this.activeUserId.trim() || this.userProfileStore.activeUserId().trim() || this.userProfileStore.getActiveUserId().trim();
    if (!activeUserId) {
      return;
    }
    this.activeUserId = activeUserId;
    const draft = this.eventCheckoutDraftStore.read(activeUserId, normalizedSourceId);
    if (!draft) {
      return;
    }
    const entry: CheckoutDraftEntry = {
      draft,
      record: this.visibleEventExploreRecordById(normalizedSourceId)
        ?? this.eventsService.peekKnownRecordById(activeUserId, normalizedSourceId)
        ?? await this.eventsService.queryKnownRecordById(activeUserId, normalizedSourceId)
    };
    await this.continueCheckoutDraft(entry);
  }

  protected async viewCheckoutDraftEvent(
    entry: CheckoutDraftEntry,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): Promise<void> {
    this.stopDomEvent(event);
    if (this.isCheckoutDraftClearing(entry.draft.sourceId)) {
      return;
    }
    const sourceId = entry.draft.sourceId.trim();
    const record = entry.record
      ?? this.eventsService.peekKnownRecordById(this.activeUserId, sourceId)
      ?? await this.eventsService.queryKnownRecordById(this.activeUserId, sourceId);
    if (!record) {
      this.dialogStore.openInfo('This event can no longer be opened.', {
        title: 'Event unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }
    this.runEventExploreViewAction(record);
  }

  protected async clearCheckoutDraft(
    draft: EventCheckoutDraft,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): Promise<void> {
    this.stopDomEvent(event);
    const activeUserId = this.activeUserId.trim();
    const sourceId = draft.sourceId.trim();
    if (!activeUserId || !sourceId) {
      this.eventCheckoutDraftStore.clear(activeUserId, sourceId);
      this.cdr.markForCheck();
      return;
    }
    if (this.checkoutDraftReleaseSourceIds.has(sourceId)) {
      return;
    }

    this.checkoutDraftReleaseSourceIds.add(sourceId);
    this.cdr.markForCheck();
    try {
      const slotSourceId = draft.basketItems
        .map(item => item.slotSourceId?.trim() ?? '')
        .find(Boolean) ?? null;
      const counterDelta = this.checkoutDraftCancelCounterDelta(draft);
      const leaveResult = await this.eventsService.leaveEvent(activeUserId, sourceId, {
        slotSourceId,
        removeMembershipOnly: true,
        checkoutState: 'cancelled',
        checkoutResultState: 'deleted',
        checkoutSessionId: draft.checkoutSessionId ?? null,
        counterDelta
      });
      this.signalEventExploreCounterDelta(activeUserId, counterDelta);
      const memberDelta = this.checkoutDraftCancelMemberDelta(draft);
      this.emitCheckoutDraftMembersSync(sourceId, leaveResult, memberDelta, true);
      this.activitiesStore.clearActivityEventSave();
      this.eventCheckoutDraftStore.clear(activeUserId, sourceId);
      this.locallyTrackedMembershipSourceIds.delete(sourceId);
    } finally {
      this.checkoutDraftReleaseSourceIds.delete(sourceId);
      this.cdr.markForCheck();
    }
  }

  private checkoutDraftCancelCounterDelta(draft: EventCheckoutDraft): UserMenuCounterDeltasDto {
    const pendingReason = this.checkoutDraftPendingReason(draft);
    if (pendingReason === 'waitlist' || pendingReason === 'approval') {
      return { event: { all: -1, pending: -1, trash: 1 } };
    }
    return { events: -1, event: { all: -1, active: -1, trash: 1 } };
  }

  private checkoutDraftCancelMemberDelta(
    draft: EventCheckoutDraft
  ): { acceptedMemberDelta: number; pendingMemberDelta: number } {
    const pendingReason = this.checkoutDraftPendingReason(draft);
    return pendingReason === 'waitlist' || pendingReason === 'approval'
      ? { acceptedMemberDelta: 0, pendingMemberDelta: -1 }
      : { acceptedMemberDelta: -1, pendingMemberDelta: 0 };
  }

  private emitCheckoutDraftMembersSync(
    sourceId: string | null | undefined,
    result: ActivityContracts.EventParticipationActionResultDTO | null,
    memberDelta: { acceptedMemberDelta?: number; pendingMemberDelta?: number } | null = null,
    viewerMembershipRemoved = false
  ): void {
    const normalizedSourceId = sourceId?.trim() ?? '';
    if (!normalizedSourceId) {
      return;
    }
    const record = this.eventsService.peekKnownRecordById(this.activeUserId, normalizedSourceId);
    const matchingResult = result?.sourceId === normalizedSourceId ? result : null;
    const acceptedMembers = matchingResult?.acceptedMembers ?? record?.acceptedMembers;
    const pendingMembers = matchingResult?.pendingMembers ?? record?.pendingMembers;
    const capacityTotal = matchingResult?.capacityTotal ?? record?.capacityTotal;
    if (acceptedMembers == null || pendingMembers == null || capacityTotal == null) {
      return;
    }
    this.activityStore.emitActivityMembersSync({
      id: normalizedSourceId,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      ...(viewerMembershipRemoved ? { viewerMembershipRemoved: true } : {}),
      ...(memberDelta ?? {})
    });
  }

  private withEventExploreResultSummary(
    record: ActivityEventRecord,
    result: ActivityContracts.EventParticipationActionResultDTO | null
  ): ActivityEventRecord {
    if (!result || result.sourceId !== record.id) {
      return record;
    }
    return {
      ...record,
      acceptedMembers: Math.max(0, Math.trunc(Number(result.acceptedMembers) || 0)),
      pendingMembers: Math.max(0, Math.trunc(Number(result.pendingMembers) || 0)),
      capacityTotal: record.capacityTotal
    };
  }

  private requestClearCheckoutDraft(
    draft: EventCheckoutDraft,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    if (this.isCheckoutDraftClearing(draft.sourceId)) {
      return;
    }
    const visual = this.checkoutDraftMenuVisual({ draft, record: null });
    const title = visual.label === 'Várólistán'
      ? 'Leave waitlist?'
      : visual.label === 'Jóváhagyásra vár'
        ? 'Cancel request?'
        : visual.label === 'Fizetésre kész' || visual.label === 'Fizetés alatt'
          ? 'Cancel payment?'
          : 'Clear basket?';
    const confirmLabel = visual.label === 'Várólistán'
      ? 'Leave waitlist'
      : visual.label === 'Jóváhagyásra vár'
        ? 'Cancel request'
        : visual.label === 'Fizetésre kész' || visual.label === 'Fizetés alatt'
          ? 'Cancel payment'
          : 'Clear basket';
    this.dialogStore.open({
      title,
      message: draft.eventTitle,
      warningMessage: 'The basket item will be cancelled and removed from the visible checkout basket.',
      cancelLabel: 'Back',
      confirmLabel,
      busyConfirmLabel: `${confirmLabel}...`,
      confirmTone: visual.palette === 'danger' ? 'danger' : 'accent',
      confirmPalette: visual.palette,
      failureMessage: 'Unable to cancel this basket item.',
      onConfirm: async () => this.clearCheckoutDraft(draft)
    });
  }

  private async loadEventExplorePage(
    query: ListQuery<EventExploreFeedFilters>
  ): Promise<PageResult<ActivityEventRecord>> {
    const page = await this.activitiesService.loadExplore({
      ...query,
      filters: {
        userId: query.filters?.userId ?? this.activeUserId,
        order: query.filters?.order ?? this.eventExploreOrder,
        view: query.filters?.view ?? this.eventExploreView,
        friendsOnly: query.filters?.friendsOnly === true,
        openSpotsOnly: query.filters?.openSpotsOnly === true,
        topic: query.filters?.topic ?? this.normalizeTopic(this.eventExploreFilterTopic)
      }
    });
    return page;
  }

  protected eventExploreInfoCard(record: ActivityEventRecord, groupLabel: string | null): InfoCardData {
    const card = EventExploreInfoCardConverter.convert(record, {
      groupLabel,
      topicToneGroups: this.topicFilterGroups,
      activeUserId: this.activeUserId,
      state: this.isEventExploreRecordLeaving(record) ? 'leaving' : 'default'
    });
    return this.withEventExploreCheckoutMenuActions(card, record);
  }

  private withEventExploreCheckoutMenuActions(card: InfoCardData, record: ActivityEventRecord): InfoCardData {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId || !this.trackableCheckoutDraft(record.id, activeUserId)) {
      return card;
    }
    return {
      ...card,
      menuActions: (card.menuActions ?? []).map(actionId =>
        this.isEventExploreJoinMenuAction(actionId) ? 'continueBooking' : actionId
      )
    };
  }

  private isEventExploreJoinMenuAction(actionId: string): boolean {
    return actionId === 'joinWaitlist' || actionId === 'bookEvent' || actionId === 'requestJoin';
  }

  private visibleEventExploreRecordById(sourceId: string): ActivityEventRecord | null {
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) {
      return null;
    }
    return this.eventExploreSmartList?.itemsSnapshot()
      .find(record => record.id === normalizedSourceId) ?? null;
  }

  private buildEventExploreGroupLabel(
    record: ActivityEventRecord,
    view: ContractTypes.EventExploreView
  ): string {
    if (view === 'distance') {
      const bucket = Math.max(5, Math.ceil(record.distanceKm / 5) * 5);
      return `${bucket} km`;
    }
    const parsed = new Date(record.startAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return AppUtils.smartListDayLabel(parsed);
  }

  private runEventExploreServiceChatAction(record: ActivityEventRecord): void {
    const chat = this.buildEventExploreServiceChat(record);
    if (!chat) {
      return;
    }
    void this.openStackedEventExploreServiceChat(chat);
  }

  private async openStackedEventExploreServiceChat(chat: ChatDTO & { ownerUserId?: string }): Promise<void> {
    await this.activitiesStore.ensureEventChatPopupLoaded();
    this.activitiesStore.openStackedEventChat(
      {
        ...eventChatPopupRequestFromChat(chat),
        parentZIndex: this.eventExplorePopupZIndex()
      },
      eventChatHeaderStateFromChat(chat)
    );
  }

  private buildEventExploreServiceChat(record: ActivityEventRecord): (ChatDTO & { ownerUserId?: string }) | null {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return null;
    }
    const organizerUserId = `${record.creatorUserId ?? ''}`.trim();
    const memberIds = [activeUserId, organizerUserId].filter(Boolean);
    return {
      id: `c-service-event-${record.id}-${activeUserId}`,
      avatar: AppUtils.initialsFromText(record.creatorName?.trim() || record.title),
      title: `Contact Organizer · ${record.title}`,
      lastMessage: `Service chat with the organizer for ${record.title}.`,
      lastSenderId: organizerUserId || activeUserId,
      memberIds: [...new Set(memberIds)],
      unread: 0,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'event',
      ownerId: record.id,
      ownerUserId: activeUserId
    };
  }

  private runEventExploreReportAction(record: ActivityEventRecord): void {
    const targetUserId = `${record.creatorUserId ?? ''}`.trim();
    if (!targetUserId || targetUserId === this.activeUserId.trim()) {
      return;
    }
    this.profileStore.openReportUserPopup({
      targetUserId,
      targetName: record.creatorName?.trim() || 'Organizer',
      eventId: record.id,
      eventTitle: record.title,
      eventStartAtIso: record.startAtIso,
      eventTimeframe: record.timeframe,
      ownerType: 'event'
    });
    this.cdr.markForCheck();
  }

  private runEventExploreShareAction(record: ActivityEventRecord): void {
    void this.shareTokensService.createToken({
      kind: 'event',
      entityId: record.id,
      ownerUserId: this.activeUserId.trim()
    }).then(token => this.openShareLinkDialog('Share event', token));
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


  protected closeEventExploreSlotPicker(): void {
    this.slotPickerRecord = null;
    this.cdr.markForCheck();
  }

  protected selectEventExploreSlot(slot: ContractTypes.EventSlotOccurrenceDTO): void {
    const record = this.slotPickerRecord;
    if (!record) {
      return;
    }
    this.dialogStore.open({
      title: this.eventExploreJoinDialogTitle(record),
      message: `${record.title}\n${slot.timeframe}`,
      cancelLabel: 'Cancel',
      confirmLabel: this.eventExploreJoinConfirmLabel(record),
      busyConfirmLabel: this.eventExploreJoinBusyLabel(record),
      confirmTone: 'accent',
      failureMessage: this.eventExploreJoinFailureMessage(record),
      onConfirm: async () => {
        await this.submitEventExploreJoinRequest(record, {
          sourceId: record.id,
          slotSourceId: slot.id,
          optionalSubEventIds: [],
          assetSelections: [],
          acceptedPolicyIds: [],
          lineItems: [],
          totalAmount: 0,
          currency: record.pricing?.currency ?? 'USD',
          paymentSessionId: null,
          bookingConfirmed: true
        });
        this.closeEventExploreSlotPicker();
      }
    });
  }

  protected slotPickerOccupancyLabel(slot: ContractTypes.EventSlotOccurrenceDTO): string {
    return `${slot.acceptedMembers} / ${slot.capacityTotal}`;
  }

  private openEventExplore(): void {
    this.isOpen = true;
    this.prewarmEventEditorPopup();
    this.refreshUsersDirectory();
    this.slotPickerRecord = null;
    this.closeMembersPopup();
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  private syncEventExploreQuery(): void {
    this.eventExploreSmartListQuery = {
      filters: {
        userId: this.activeUserId,
        order: this.eventExploreOrder,
        view: this.eventExploreView,
        friendsOnly: this.eventExploreFilterFriendsOnly,
        openSpotsOnly: this.eventExploreFilterHasRooms,
        topic: this.normalizeTopic(this.eventExploreFilterTopic)
      }
    };
  }

  private applyActivityMembersSyncState(sync: ActivityMembersSyncState): void {
    let changed = false;
    if (this.selectedMembersRecord?.id === sync.id) {
      this.selectedMembersRecord = {
        ...this.selectedMembersRecord,
        acceptedMembers: Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0)),
        capacityTotal: Math.max(
          Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
          Math.trunc(Number(sync.capacityTotal) || 0)
        )
      };
      changed = true;
    }
    if (this.isOpen && this.applyVisibleEventExploreMembersSync(sync)) {
      changed = true;
    }
    if (this.isOpen && sync.checkoutResultState === 'succeeded') {
      void this.restorePaidCheckoutEventExploreRecord(sync.id);
    }
    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private emitActivityEventSave(payload: ActivityEventDetailDTO): Promise<void> {
    return this.eventsService.saveActivityEvent(payload)
      .then(displaySync => {
        if (displaySync) {
          this.activitiesStore.emitActivityEventSaveResult(displaySync);
        }
      })
      .catch(() => {
        // Demo persistence is best-effort; UI state stays optimistic.
      });
  }

  private applyActivityEventSave(sync: ActivityEventDTO): void {
    const dto = sync;
    const userJoinedEvent = this.locallyTrackedMembershipSourceIds.has(sync.id);
    if (userJoinedEvent) {
      this.locallyTrackedMembershipSourceIds.add(sync.id);
    } else {
      this.locallyTrackedMembershipSourceIds.delete(sync.id);
    }
    if (!this.eventExploreSmartList) {
      return;
    }
    const currentItems = [...this.eventExploreSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(record => record.id === sync.id);

    if (currentIndex >= 0) {
      this.checkoutDraftClearSaveSourceIds.delete(sync.id);
      const existing = currentItems[currentIndex];
      if (existing) {
        if (dto.full === true && this.eventExploreFilterHasRooms) {
          this.removeVisibleEventExploreRecord(existing);
          this.cdr.markForCheck();
          return;
        }
        const nextEndIso = dto.endAtIso ?? dto.startAtIso;
        const acceptedMembers = Number.isFinite(Number(dto.acceptedMembers))
          ? Math.max(0, Math.trunc(Number(dto.acceptedMembers)))
          : Math.max(0, existing.acceptedMembers);

        currentItems[currentIndex] = {
          ...existing,
          title: dto.title,
          subtitle: dto.subtitle,
          startAtIso: dto.startAtIso,
          endAtIso: nextEndIso,
          distanceKm: dto.distanceKm,
          visibility: dto.visibility ?? existing.visibility,
          imageUrl: dto.imageUrl.trim() || existing.imageUrl,
          location: dto.location?.trim() || existing.location,
          acceptedMembers,
          pendingMembers: Number.isFinite(Number(dto.pendingMembers))
            ? Math.max(0, Math.trunc(Number(dto.pendingMembers)))
            : existing.pendingMembers,
          capacityMin: dto.capacityMin ?? existing.capacityMin,
          capacityMax: dto.capacityMax ?? existing.capacityMax,
          capacityTotal: Math.max(
            acceptedMembers,
            dto.capacityTotal ?? existing.capacityTotal
          ),
          full: dto.full ?? existing.full,
          eventType: dto.eventType ?? existing.eventType,
          status: dto.status ?? existing.status
        };
        this.eventExploreSmartList.replaceVisibleItems(currentItems);
        this.cdr.markForCheck();
      }
      return;
    }

    if (!this.isOpen || userJoinedEvent) {
      return;
    }
    if (this.checkoutDraftClearSaveSourceIds.delete(sync.id.trim())) {
      return;
    }
    if (this.checkoutDraftReleaseSourceIds.has(sync.id.trim())) {
      return;
    }
    this.reloadEventExploreSmartList();
  }

  private eventMembersOwner(record: ActivityEventRecord): ActivityMemberOwnerRef {
    return {
      ownerType: 'event',
      ownerId: record.id
    };
  }

  private activityMemberSource(record: ActivityEventRecord) {
    return {
      id: record.id,
      type: record.type,
      isAdmin: true
    };
  }

  private buildMemberEntries(record: ActivityEventRecord): ActivityContracts.ActivityMemberDTO[] {
    const source = this.activityMemberSource(record);
    const rowKey = `${source.type}:${source.id}`;
    const summary = this.activityMembersService.peekSummaryByOwner(this.eventMembersOwner(record));
    const acceptedUserIds = this.ensureMemberUserIds(
      summary?.acceptedMemberUserIds ?? [],
      record.acceptedMembers,
      record,
      new Set<string>(),
      true
    );
    const pendingUserIds = this.ensureMemberUserIds(
      summary?.pendingMemberUserIds ?? [],
      record.pendingMembers,
      record,
      new Set(acceptedUserIds),
      false
    );

    const entries: ActivityContracts.ActivityMemberDTO[] = [];
    for (const userId of acceptedUserIds) {
      const user = this.resolveUser(userId, record);
      const base = ActivityMembersBuilder.toActivityMemberDTO(
        user,
        source,
        rowKey,
        record.creatorUserId,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        APP_STATIC_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...base,
        role: user.id === record.creatorUserId ? 'Admin' : 'Member'
      });
    }
    for (const userId of pendingUserIds) {
      const user = this.resolveUser(userId, record);
      const base = ActivityMembersBuilder.toActivityMemberDTO(
        user,
        source,
        rowKey,
        record.creatorUserId,
        { status: 'pending', pendingSource: 'admin', invitedByActiveUser: false },
        APP_STATIC_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...base,
        requestKind: 'invite',
        statusText: 'Invitation pending.'
      });
    }
    return entries;
  }

  private hasTrackedMembership(record: ActivityEventRecord, userId: string): boolean {
    if (userId === this.activeUserId.trim() && this.locallyTrackedMembershipSourceIds.has(record.id)) {
      return true;
    }
    if (this.hasPendingCheckoutDraft(record.id, userId)) {
      return true;
    }
    return this.activityMembersService.peekMembersByOwner(this.eventMembersOwner(record))
      .some(member => member.userId === userId);
  }

  private eventExploreMembershipStatus(
    record: ActivityEventRecord,
    userId: string
  ): 'accepted' | 'pending' | 'none' {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 'none';
    }
    const existingMember = this.activityMembersService.peekMembersByOwner(this.eventMembersOwner(record))
      .find(member => member.userId === normalizedUserId);
    if (existingMember?.status === 'accepted' || (record.acceptedMemberUserIds ?? []).includes(normalizedUserId)) {
      return 'accepted';
    }
    if (
      existingMember?.status === 'pending'
      || (record.pendingMemberUserIds ?? []).includes(normalizedUserId)
      || (record.pendingRequestMemberUserIds ?? []).includes(normalizedUserId)
    ) {
      return 'pending';
    }
    return 'none';
  }

  private hasPendingCheckoutDraft(sourceId: string, userId: string): boolean {
    return this.trackableCheckoutDraft(sourceId, userId) !== null;
  }

  private trackableCheckoutDraft(sourceId: string, userId: string): EventCheckoutDraft | null {
    const draft = this.eventCheckoutDraftStore.read(userId, sourceId);
    return this.isTrackableCheckoutDraft(draft) ? draft : null;
  }

  private pendingCheckoutDraftSourceIds(): Set<string> {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return new Set<string>();
    }
    return new Set(
      this.eventCheckoutDraftStore.listByUser(activeUserId)
        .filter(draft => this.isTrackableCheckoutDraft(draft))
        .map(draft => draft.sourceId.trim())
        .filter(sourceId => sourceId.length > 0)
    );
  }

  private requiresApprovalBeforePayment(
    record: ActivityEventRecord | null,
    draft: EventCheckoutDraft | null = null
  ): boolean {
    if (record?.approvalRequired === true) {
      return true;
    }
    return draft?.pendingReason === 'approval';
  }

  private checkoutDraftPendingReason(draft: EventCheckoutDraft | null | undefined): ActivityPendingReason {
    if (draft?.pendingReason === 'waitlist' || draft?.checkoutState === 'waiting') {
      return 'waitlist';
    }
    if (draft?.pendingReason === 'approval' || draft?.checkoutState === 'approval-pending') {
      return 'approval';
    }
    return null;
  }

  private resolveCheckoutDraftMembershipStatus(
    sourceId: string,
    _record: ActivityEventRecord | null
  ): 'accepted' | 'pending' | 'none' {
    const activeUserId = this.activeUserId.trim();
    const ownerId = sourceId.trim();
    if (!activeUserId || !ownerId) {
      return 'none';
    }
    const memberEntries = this.activityMembersService.peekMembersByOwner({
      ownerType: 'event',
      ownerId
    });
    const existingEntry = memberEntries.find(member => member.userId === activeUserId);
    if (existingEntry?.status === 'accepted') {
      return 'accepted';
    }
    if (existingEntry?.status === 'pending') {
      return 'pending';
    }
    return 'none';
  }

  private isTrackableCheckoutDraft(draft: EventCheckoutDraft | null | undefined): boolean {
    if (!draft) {
      return false;
    }
    const resultState = this.checkoutDraftResultState(draft);
    if (resultState === 'deleted' || resultState === 'succeeded') {
      return false;
    }
    if (resultState === 'failed') {
      return true;
    }
    return Math.max(0, Number(draft?.totalAmount) || 0) > 0
      || draft?.pendingReason === 'waitlist'
      || draft?.pendingReason === 'approval'
      || draft?.checkoutState === 'waiting'
      || draft?.checkoutState === 'approval-pending';
  }

  private eventExploreJoinDialogTitle(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean } = {}
  ): string {
    if (this.isEventExploreRecordFull(record) && options.approvalGranted !== true) {
      return 'Join waiting list?';
    }
    if (this.requiresApprovalBeforePayment(record) && options.approvalGranted !== true) {
      return 'Request to join?';
    }
    return record.ticketing ? 'Continue booking?' : 'Request to join?';
  }

  private eventExploreJoinConfirmLabel(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean } = {}
  ): string {
    if (this.isEventExploreRecordFull(record) && options.approvalGranted !== true) {
      return 'Join waiting list';
    }
    if (this.requiresApprovalBeforePayment(record) && options.approvalGranted !== true) {
      return 'Send request';
    }
    return record.ticketing ? 'Continue' : 'Send request';
  }

  private eventExploreJoinBusyLabel(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean } = {}
  ): string {
    if (this.isEventExploreRecordFull(record) && options.approvalGranted !== true) {
      return 'Joining waitlist...';
    }
    if (this.requiresApprovalBeforePayment(record) && options.approvalGranted !== true) {
      return 'Sending request...';
    }
    return record.ticketing ? 'Continuing...' : 'Sending request...';
  }

  private eventExploreJoinFailureMessage(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean } = {}
  ): string {
    if (this.isEventExploreRecordFull(record) && options.approvalGranted !== true) {
      return 'Unable to join the waiting list right now.';
    }
    if (this.requiresApprovalBeforePayment(record) && options.approvalGranted !== true) {
      return 'Unable to send request.';
    }
    return record.ticketing ? 'Unable to continue booking right now.' : 'Unable to send request.';
  }

  private shouldUseCheckoutFlow(record: ActivityEventRecord): boolean {
    if (this.isEventExploreRecordFull(record)) {
      return true;
    }
    if (record.approvalRequired === true) {
      return true;
    }
    if ((record.upcomingSlots?.length ?? 0) > 0) {
      return true;
    }
    if (record.policiesEnabled === true && (record.policies?.length ?? 0) > 0) {
      return true;
    }
    if ((record.subEvents ?? []).some(item => item.optional)) {
      return true;
    }
    return Boolean(record.pricing?.enabled && (Number(record.pricing?.basePrice) || 0) > 0);
  }

  private openEventExploreCheckout(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean; pendingReason?: ActivityPendingReason } = {}
  ): void {
    const dialogOptions = {
      approvalGranted: options.approvalGranted === true
    };
    const pendingReason = options.pendingReason !== undefined
      ? options.pendingReason
      : this.eventExploreCheckoutPendingReason(record);
    this.eventCheckoutDialogStore.open({
      mode: 'join',
      userId: this.activeUserId,
      record,
      requiresApprovalBeforePayment: this.requiresApprovalBeforePayment(record),
      approvalGranted: dialogOptions.approvalGranted,
      pendingReason,
      title: this.eventExploreJoinDialogTitle(record, dialogOptions),
      subtitle: record.timeframe,
      confirmLabel: this.eventExploreJoinConfirmLabel(record, dialogOptions),
      busyConfirmLabel: this.eventExploreJoinBusyLabel(record, dialogOptions),
      failureMessage: this.eventExploreJoinFailureMessage(record, dialogOptions),
      onSubmit: (selection) => this.submitEventExploreJoinRequest(record, selection)
    });
  }

  private eventExploreCheckoutPendingReason(record: ActivityEventRecord): ActivityPendingReason {
    if (record.pendingReason === 'waitlist' || this.isEventExploreRecordFull(record)) {
      return 'waitlist';
    }
    if (this.requiresApprovalBeforePayment(record)) {
      return 'approval';
    }
    return null;
  }

  private async submitEventExploreJoinRequest(
    record: ActivityEventRecord,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): Promise<void> {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return;
    }
    const owner = this.eventMembersOwner(record);
    const peekedMembers = this.activityMembersService.peekMembersByOwner(owner);
    const existingMembers = peekedMembers.length > 0 ? peekedMembers : this.buildMemberEntries(record);
    const existingEntry = existingMembers.find(member => member.userId === activeUserId);

    const checkoutUpdateRequested = Boolean(
      selection?.basketItems?.length
      && (selection.checkoutState === 'waiting'
        || selection.checkoutState === 'approval-pending'
        || selection.checkoutState === 'approved'
        || selection.checkoutState === 'confirmed'
        || selection.checkoutState === 'pay'
        || selection.pendingReason === 'waitlist'
        || selection.pendingReason === 'approval')
    );
    if (existingEntry && existingEntry.status !== 'deleted' && !checkoutUpdateRequested) {
      if (this.selectedMembersRecord?.id === record.id) {
        this.selectedMembers = this.sortMembersByActionTimeDesc(existingMembers);
      }
      this.cdr.markForCheck();
      return;
    }

    const pendingReason = selection?.pendingReason ?? (this.isEventExploreSelectionFull(record, selection) ? 'waitlist' : null);
    const isAcceptedBooking = this.isConfirmedEventExploreBooking(record, selection);
    const updatesExistingMember = Boolean(existingEntry && existingEntry.status !== 'deleted');
    const counterDelta = updatesExistingMember ? null : this.eventExploreJoinCounterDelta(isAcceptedBooking);
    const optimisticExistingMembers = existingEntry?.status === 'deleted'
      ? existingMembers.filter(member => !(member.userId === activeUserId && member.status === 'deleted'))
      : existingMembers;
    const joinRequestEntry = this.buildJoinRequestEntry(record, isAcceptedBooking, pendingReason);
    const nextMembers = this.sortMembersByActionTimeDesc(updatesExistingMember
      ? [
          ...optimisticExistingMembers.filter(member => member.userId !== activeUserId),
          joinRequestEntry
        ]
      : [
          ...optimisticExistingMembers,
          joinRequestEntry
        ]);

    try {
      const joinResult = await this.eventsService.requestJoin(activeUserId, record.id, {
        slotSourceId: selection?.slotSourceId ?? null,
        optionalSubEventIds: selection?.optionalSubEventIds ?? [],
        assetSelections: selection?.assetSelections ?? [],
        acceptedPolicyIds: selection?.acceptedPolicyIds ?? [],
        paymentSessionId: selection?.paymentSessionId ?? null,
        bookingConfirmed: isAcceptedBooking,
        pendingReason,
        checkoutState: selection?.checkoutState,
        basketItems: selection?.basketItems?.length ? selection.basketItems : undefined,
        pricingSummaryRows: selection?.basketItems?.length ? (selection.pricingSummaryRows ?? []) : undefined,
        lineItems: selection?.basketItems?.length ? selection.lineItems : undefined,
        totalAmount: selection?.basketItems?.length ? selection.totalAmount : undefined,
        currency: selection?.basketItems?.length ? selection.currency : undefined,
        counterDelta
      });
      if (!joinResult || (joinResult.membershipStatus === 'unchanged' && !checkoutUpdateRequested)) {
        throw new Error(this.eventExploreJoinFailureMessage(record));
      }
      const persistedMembers = this.activityMembersService.peekMembersByOwner(owner);
      const displayMembers = this.sortMembersByActionTimeDesc(persistedMembers.length > 0 ? persistedMembers : nextMembers);
      const nextRecord = this.withEventExploreMemberDelta(record, {
        acceptedMemberDelta: updatesExistingMember ? 0 : (isAcceptedBooking ? 1 : 0),
        pendingMemberDelta: updatesExistingMember ? 0 : (isAcceptedBooking ? 0 : 1)
      }, displayMembers, pendingReason);
      this.locallyTrackedMembershipSourceIds.add(record.id);
      this.restoreVisibleEventExploreRecord(nextRecord);
      this.activitiesStore.emitActivityEventSaveResult(
        this.buildActivityEventDetailDTO(nextRecord, displayMembers, joinResult.paymentSessionId ?? selection?.paymentSessionId ?? null)
      );
      if (counterDelta) {
        this.signalEventExploreCounterDelta(activeUserId, counterDelta);
      }
      if (this.selectedMembersRecord?.id === record.id) {
        this.selectedMembersRecord = nextRecord;
        this.selectedMembers = displayMembers;
      }
      this.cdr.markForCheck();
    } catch (error) {
      this.locallyTrackedMembershipSourceIds.delete(record.id);
      this.restoreVisibleEventExploreRecord(record);
      throw error;
    }
  }

  private eventExploreJoinCounterDelta(accepted: boolean): UserMenuCounterDeltasDto {
    return accepted
      ? { events: 1, event: { all: 1, active: 1 } }
      : { events: 1, event: { all: 1, pending: 1 } };
  }

  private signalEventExploreCounterDelta(activeUserId: string, delta: UserMenuCounterDeltasDto): void {
    this.activityStore.patchUserCounterDeltas(
      activeUserId,
      delta,
      null
    );
  }

  private applyVisibleEventExploreMembersSync(sync: ActivityMembersSyncState): boolean {
    if (!this.eventExploreSmartList) {
      return false;
    }
    const currentItems = [...this.eventExploreSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(record => record.id === sync.id);
    if (currentIndex < 0) {
      return false;
    }
    const currentRecord = currentItems[currentIndex];
    if (!currentRecord) {
      return false;
    }
    if (sync.full === true && this.eventExploreFilterHasRooms) {
      this.removeVisibleEventExploreRecord(currentRecord);
      return true;
    }
    const acceptedMemberDelta = Number.isFinite(Number(sync.acceptedMemberDelta))
      ? Math.trunc(Number(sync.acceptedMemberDelta))
      : Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0))
        - Math.max(0, Math.trunc(Number(currentRecord.acceptedMembers) || 0));
    const pendingMemberDelta = Number.isFinite(Number(sync.pendingMemberDelta))
      ? Math.trunc(Number(sync.pendingMemberDelta))
      : Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0))
        - Math.max(0, Math.trunc(Number(currentRecord.pendingMembers) || 0));
    currentItems[currentIndex] = {
      ...currentRecord,
      acceptedMembers: Math.max(0, Math.trunc(Number(currentRecord.acceptedMembers) || 0) + acceptedMemberDelta),
      pendingMembers: Math.max(0, Math.trunc(Number(currentRecord.pendingMembers) || 0) + pendingMemberDelta),
      capacityTotal: currentRecord.capacityTotal,
      full: sync.full === true ? true : currentRecord.full
    };
    this.eventExploreSmartList.replaceVisibleItems(currentItems, {
      total: this.eventExploreSmartList.cursorState().total
    });
    return true;
  }

  private removeVisibleEventExploreRecord(record: ActivityEventRecord): void {
    if (!this.eventExploreSmartList) {
      return;
    }
    this.eventExploreSmartList.removeVisibleItems(
      item => item.id === record.id,
      { totalDelta: -1 }
    );
  }

  private restoreVisibleEventExploreRecord(
    record: ActivityEventRecord,
    options: { loadedRange?: 'any' | 'before-or-within' } = {}
  ): void {
    if (!this.isOpen || !this.eventExploreSmartList || !this.shouldShowRestoredEventExploreRecord(record)) {
      return;
    }
    const currentItems = [...this.eventExploreSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(item => item.id === record.id);
    if (currentIndex >= 0) {
      this.eventExploreSmartList.replaceVisibleItems(
        currentItems.map(item => item.id === record.id ? record : item),
        { total: this.eventExploreSmartList.cursorState().total }
      );
      return;
    }
    this.eventExploreSmartList.reinsertVisibleItem(record, {
      totalDelta: 1,
      loadedRange: options.loadedRange ?? 'any'
    });
  }

  private async restorePaidCheckoutEventExploreRecord(sourceId: string): Promise<void> {
    const activeUserId = this.activeUserId.trim();
    const normalizedSourceId = sourceId.trim();
    if (!this.isOpen || !activeUserId || !normalizedSourceId) {
      return;
    }
    const record = this.eventsService.peekKnownRecordById(activeUserId, normalizedSourceId)
      ?? await this.eventsService.queryKnownRecordById(activeUserId, normalizedSourceId);
    if (!record || !this.isOpen) {
      return;
    }
    this.restoreVisibleEventExploreRecord(record, { loadedRange: 'before-or-within' });
    this.cdr.markForCheck();
  }

  private restoreVisibleEventExploreRecordsById(sourceIds: readonly string[]): void {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return;
    }
    sourceIds.forEach(sourceId => {
      const record = this.eventsService.peekKnownRecordById(activeUserId, sourceId.trim());
      if (record) {
        this.restoreVisibleEventExploreRecord(record);
      }
    });
  }

  private shouldShowRestoredEventExploreRecord(record: ActivityEventRecord): boolean {
    if (this.eventExploreFilterFriendsOnly) {
      return false;
    }
    if (this.eventExploreFilterHasRooms && this.isEventExploreRecordFull(record)) {
      return false;
    }
    const selectedTopic = this.normalizeTopic(this.eventExploreFilterTopic);
    if (selectedTopic && !record.topics.some(topic => this.normalizeTopic(topic) === selectedTopic)) {
      return false;
    }
    return true;
  }

  private sortVisibleEventExploreRecords(records: readonly ActivityEventRecord[]): ActivityEventRecord[] {
    return [...records].sort((left, right) => {
      const byOrder = this.compareEventExploreRecords(left, right);
      if (byOrder !== 0) {
        return byOrder;
      }
      return left.title.localeCompare(right.title);
    });
  }

  private eventExploreRecordLocalSortKey(record: ActivityEventRecord): SmartListLocalSortKey {
    const startAt = AppUtils.toSortableDate(record.startAtIso);
    const fallback = [record.title, record.id];
    switch (this.eventExploreOrder) {
      case 'nearby':
        return [Number(record.distanceKm) || 0, startAt, ...fallback];
      case 'top-rated':
        return [-(Number(record.rating) || 0), startAt, ...fallback];
      case 'most-relevant':
        return [-(Number(record.affinity) || 0), startAt, ...fallback];
      case 'past-events':
        return [-startAt, ...fallback];
      case 'upcoming':
      default:
        return [startAt, ...fallback];
    }
  }

  private compareEventExploreRecords(left: ActivityEventRecord, right: ActivityEventRecord): number {
    switch (this.eventExploreOrder) {
      case 'nearby':
        return (Number(left.distanceKm) || 0) - (Number(right.distanceKm) || 0);
      case 'top-rated':
        return (Number(right.rating) || 0) - (Number(left.rating) || 0);
      case 'most-relevant':
        return (Number(right.affinity) || 0) - (Number(left.affinity) || 0);
      case 'past-events':
        return AppUtils.toSortableDate(right.startAtIso) - AppUtils.toSortableDate(left.startAtIso);
      case 'upcoming':
      default:
        return AppUtils.toSortableDate(left.startAtIso) - AppUtils.toSortableDate(right.startAtIso);
    }
  }

  private pruneVisibleTrackedEventExploreRecords(): void {
    // Event Explore keeps visible cards in place during checkout/member transitions.
  }

  private isEventExploreRecordLeaving(record: ActivityEventRecord): boolean {
    return this.leavingEventExploreRecordIds.has(record.id);
  }

  private async runEventExploreExitTransition(record: ActivityEventRecord, onExited: () => void): Promise<void> {
    const isVisible = this.eventExploreSmartList?.itemsSnapshot().some(item => item.id === record.id) ?? false;
    if (!isVisible) {
      onExited();
      return;
    }
    this.leavingEventExploreRecordIds.add(record.id);
    this.cdr.markForCheck();
    await this.waitForEventExploreDelay(this.eventExploreExitAnimationMs);
    onExited();
    this.leavingEventExploreRecordIds.delete(record.id);
    this.cdr.markForCheck();
  }

  private waitForEventExploreDelay(durationMs: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, Math.max(0, durationMs));
    });
  }

  private ensureMemberUserIds(
    sourceUserIds: readonly string[],
    count: number,
    record: ActivityEventRecord,
    excluded: Set<string>,
    includeCreatorFirst: boolean
  ): string[] {
    const normalizedCount = Math.max(0, Math.trunc(Number(count) || 0));
    if (normalizedCount <= 0) {
      return [];
    }
    const result: string[] = [];
    const seen = new Set<string>(excluded);
    const tryAdd = (userId: string): void => {
      const normalized = `${userId ?? ''}`.trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      result.push(normalized);
    };

    if (includeCreatorFirst) {
      tryAdd(record.creatorUserId);
    }
    for (const userId of sourceUserIds) {
      tryAdd(userId);
      if (result.length >= normalizedCount) {
        return result.slice(0, normalizedCount);
      }
    }

    const pool = [record.creatorUserId, ...this.users.map(user => user.id)];
    const seed = AppUtils.hashText(`event-explore-members:${record.id}:${record.type}:${includeCreatorFirst ? 'accepted' : 'pending'}`);
    for (let index = 0; result.length < normalizedCount && index < pool.length * 3; index += 1) {
      tryAdd(pool[(seed + index) % pool.length]);
    }
    return result.slice(0, normalizedCount);
  }

  private resolveUser(userId: string, record: ActivityEventRecord): UserDto {
    return this.userByIdMap.get(userId)
      ?? this.userByIdMap.get(record.creatorUserId)
      ?? this.users[0]
      ?? {
        id: userId,
        name: record.creatorName,
        age: 30,
        birthday: '1996-01-01',
        city: record.creatorCity || 'Austin',
        height: '175 cm',
        physique: 'Athletic',
        languages: ['English'],
        horoscope: 'Aries',
        initials: AppUtils.initialsFromText(record.creatorName),
        gender: record.creatorGender,
        statusText: 'Recently Active',
        hostTier: 'Host',
        traitLabel: 'Reliable',
        completion: 60,
        headline: '',
        about: '',
        profileStatus: 'public',
        activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
      };
  }

  private buildJoinRequestEntry(
    record: ActivityEventRecord,
    accepted = false,
    pendingReason: ActivityPendingReason = null
  ): ActivityContracts.ActivityMemberDTO {
    const user = this.resolveUser(this.activeUserId, record);
    const source = this.activityMemberSource(record);
    const entry = ActivityMembersBuilder.toActivityMemberDTO(
      user,
      source,
      `${source.type}:${source.id}`,
      record.creatorUserId,
      {
        status: accepted ? 'accepted' : 'pending',
        pendingSource: accepted ? null : 'member',
        invitedByActiveUser: false
      },
      APP_STATIC_DATA.activityMemberMetPlaces
    );
    return {
      ...entry,
      role: 'Member',
      requestKind: accepted ? null : (pendingReason === 'waitlist' ? 'waitlist' : pendingReason === 'approval' ? 'approval' : 'join'),
      statusText: accepted
        ? 'Joined event.'
        : pendingReason === 'waitlist'
          ? 'Waiting list.'
          : 'Waiting for admin approval.'
    };
  }

  private isConfirmedEventExploreBooking(
    record: ActivityEventRecord,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): boolean {
    if (this.isEventExploreSelectionFull(record, selection)) {
      return false;
    }
    if (record.ticketing !== true) {
      return false;
    }
    if (selection?.bookingConfirmed === true) {
      return true;
    }
    return !selection && !this.shouldUseCheckoutFlow(record);
  }

  private isEventExploreSelectionFull(
    record: ActivityEventRecord,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): boolean {
    const slotSourceId = `${selection?.slotSourceId ?? ''}`.trim();
    if (slotSourceId) {
      const slot = (record.upcomingSlots ?? []).find(item => item.id === slotSourceId) ?? null;
      return slot ? this.isEventExploreSlotFull(slot) : this.isEventExploreRecordFull(record);
    }
    if ((record.upcomingSlots?.length ?? 0) > 0) {
      return false;
    }
    return this.isEventExploreRecordFull(record);
  }

  private isEventExploreRecordFull(record: ActivityEventRecord | null): boolean {
    const capacityTotal = Math.max(0, Math.trunc(Number(record?.capacityTotal) || 0));
    if (capacityTotal <= 0) {
      return false;
    }
    return Math.max(0, Math.trunc(Number(record?.acceptedMembers) || 0)) >= capacityTotal;
  }

  private isEventExploreSlotFull(slot: ContractTypes.EventSlotOccurrenceDTO): boolean {
    const capacityTotal = Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
    if (capacityTotal <= 0) {
      return false;
    }
    return Math.max(0, Math.trunc(Number(slot.acceptedMembers) || 0)) >= capacityTotal;
  }

  private buildActivityEventDetailDTO(
    record: ActivityEventRecord,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    paymentSessionId: string | null = null
  ): ActivityEventDetailDTO {
    const summary = ActivityMembersBuilder.buildActivityMembersSummary(
      this.eventMembersOwner(record),
      members,
      record.capacityTotal
    );
    return new ActivityEventDetailDTO().apply({
      id: record.id,
      type: 'events',
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      activity: Math.max(0, Math.trunc(Number(record.activity) || 0)),
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: summary.capacityTotal,
      acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
      pendingMemberUserIds: [...summary.pendingMemberUserIds],
      pendingRequestMemberUserIds: this.pendingRequestMemberUserIdsFromMembers(members),
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      autoInviter: record.autoInviter,
      frequency: record.frequency,
      ticketing: record.ticketing,
      approvalRequired: record.approvalRequired === true,
      visibility: record.visibility,
      blindMode: record.blindMode,
      status: record.status ?? 'A',
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorGender: record.creatorGender,
      creatorCity: record.creatorCity,
      location: record.location,
      locationCoordinates: record.locationCoordinates ?? null,
      sourceLink: record.sourceLink,
      pendingReason: this.eventExplorePendingReasonFromMembers(members),
      topics: [...record.topics],
      subEvents: Array.isArray(record.subEvents)
        ? record.subEvents.map(item => ({ ...item }))
        : undefined,
      mode: record.mode,
      paymentSessionId
    });
  }

  private withEventExploreMemberSummary(
    record: ActivityEventRecord,
    members: readonly ActivityContracts.ActivityMemberDTO[]
  ): ActivityEventRecord {
    const summary = ActivityMembersBuilder.buildActivityMembersSummary(
      this.eventMembersOwner(record),
      members,
      record.capacityTotal
    );
    return {
      ...record,
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: record.capacityTotal,
      acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
      pendingMemberUserIds: [...summary.pendingMemberUserIds],
      pendingRequestMemberUserIds: this.pendingRequestMemberUserIdsFromMembers(members),
      pendingReason: this.eventExplorePendingReasonFromMembers(members)
    };
  }

  private withEventExploreMemberDelta(
    record: ActivityEventRecord,
    memberDelta: { acceptedMemberDelta?: number; pendingMemberDelta?: number },
    members: readonly ActivityContracts.ActivityMemberDTO[] = [],
    pendingReason: ActivityPendingReason = null
  ): ActivityEventRecord {
    const acceptedMemberDelta = Math.trunc(Number(memberDelta.acceptedMemberDelta) || 0);
    const pendingMemberDelta = Math.trunc(Number(memberDelta.pendingMemberDelta) || 0);
    const hasMembers = members.length > 0;
    return {
      ...record,
      acceptedMembers: Math.max(0, Math.trunc(Number(record.acceptedMembers) || 0) + acceptedMemberDelta),
      pendingMembers: Math.max(0, Math.trunc(Number(record.pendingMembers) || 0) + pendingMemberDelta),
      capacityTotal: record.capacityTotal,
      ...(hasMembers ? {
        acceptedMemberUserIds: members
          .filter(member => member.status === 'accepted')
          .map(member => member.userId.trim())
          .filter(userId => userId.length > 0),
        pendingMemberUserIds: members
          .filter(member => member.status === 'pending')
          .map(member => member.userId.trim())
          .filter(userId => userId.length > 0),
        pendingRequestMemberUserIds: this.pendingRequestMemberUserIdsFromMembers(members)
      } : {}),
      pendingReason: pendingReason ?? (hasMembers ? this.eventExplorePendingReasonFromMembers(members) : null)
    };
  }

  private eventExplorePendingReasonFromMembers(
    members: readonly ActivityContracts.ActivityMemberDTO[]
  ): ActivityPendingReason {
    if (members.some(member => member.status === 'pending' && member.requestKind === 'waitlist')) {
      return 'waitlist';
    }
    if (members.some(member => member.status === 'pending' && member.requestKind === 'approval')) {
      return 'approval';
    }
    return null;
  }

  private pendingRequestMemberUserIdsFromMembers(
    members: readonly ActivityContracts.ActivityMemberDTO[]
  ): string[] {
    return Array.from(new Set(members
      .filter(member => member.status === 'pending')
      .filter(member => member.requestKind !== 'invite' && member.requestKind !== 'waitlist-invite')
      .map(member => member.userId.trim())
      .filter(userId => userId.length > 0)));
  }

  private sortMembersByActionTimeDesc(entries: readonly ActivityContracts.ActivityMemberDTO[]): ActivityContracts.ActivityMemberDTO[] {
    return [...entries].sort((left, right) =>
      AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso)
    );
  }

  private stopDomEvent(event?: { stopPropagation?: () => void; preventDefault?: () => void } | null): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  private refreshUsersDirectory(): void {
    const users = this.gameService.getGameCardsUsersSnapshot();
    const activeProfile = this.userProfileStore.activeUserProfile();
    const nextUsers = [...users];

    if (activeProfile && !nextUsers.some(user => user.id === activeProfile.id)) {
      nextUsers.push(activeProfile);
    }

    this.users = nextUsers;
    this.userByIdMap = new Map(nextUsers.map(user => [user.id, user]));
  }

  private prewarmEventEditorPopup(): void {
    if (this.eventEditorPrewarmStarted) {
      return;
    }
    this.eventEditorPrewarmStarted = true;
    void import('../event-editor-popup/event-editor-popup.component');
  }

  private reloadEventExploreSmartList(): void {
    this.resetHeaderState();
    this.eventExploreSmartList?.reload();
    this.cdr.markForCheck();
  }

  private resetHeaderState(): void {
    this.eventExploreHeaderProgress = 0;
    this.eventExploreHeaderProgressLoading = false;
    this.eventExploreHeaderLoadingProgress = 0;
    this.eventExploreHeaderLoadingOverdue = false;
    this.eventExploreStickyLabel = 'No items';
  }

  protected normalizeTopic(topic: string | null | undefined): string {
    return AppUtils.normalizeText(`${topic ?? ''}`.replace(/^#+\s*/, '').trim());
  }

}
