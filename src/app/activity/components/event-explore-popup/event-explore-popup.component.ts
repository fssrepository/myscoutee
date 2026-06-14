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
import { AppContext, AppPopupContext, type ActivityMembersSyncState } from '../../../shared/ui';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import type { EventExploreFeedFilters } from '../../../shared/core/contracts';
import type { ActivityPendingReason } from '../../../shared/core/common/constants';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import { AppUtils } from '../../../shared/app-utils';
import {
  ActivityMembersBuilder, ActivityMembersService, ActivitiesService, EventExploreBuilder, EventsService, GameService, ShareTokensService, UsersService, type UserDto } from '../../../shared/core';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import {
  AppMenuDispatcher,
  AppMenuComponent,
  AppMenuOutletComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  INFO_CARD_AVAILABLE_ACTIONS,
  InfoCardComponent,
  ProgressIndicatorComponent,
  type PageResult,
  SmartListComponent,
  TopicPickerPopupComponent,
  type InfoCardData,
  type InfoCardMenuActionEvent,
  type InfoCardMenuRequestEvent,
  type InfoCardResolvedMenuAction,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListStateChange
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { EventCheckoutDraftService, type EventCheckoutDraft } from '../../../shared/ui/services/event-checkout-draft.service';
import { EventCheckoutDialogService } from '../../../shared/ui/services/event-checkout-dialog.service';
import { NavigatorService } from '../../../navigator';
import type { ActivityEventDTO, ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import type { ChatRecord } from '../../../shared/core/contracts/chat.interface';
import type { ActivityMemberOwnerRef } from '../../../shared/core/contracts/activity.interface';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

type CheckoutDraftEntry = {
  draft: EventCheckoutDraft;
  record: ActivityEventRecord | null;
};

type EventExploreMenuContext =
  | { menu: 'order'; order: ContractTypes.EventExploreOrder }
  | { menu: 'view'; view: ContractTypes.EventExploreView }
  | { menu: 'topic-picker' }
  | {
      menu: 'info-card';
      record: ActivityEventRecord;
      card: InfoCardData;
      action: InfoCardResolvedMenuAction;
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
    ProgressIndicatorComponent,
    SmartListComponent,
    TopicPickerPopupComponent
  ],
  templateUrl: './event-explore-popup.component.html',
  styleUrl: './event-explore-popup.component.scss',
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
  protected readonly navigatorService = inject(NavigatorService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
  private readonly eventCheckoutDialogService = inject(EventCheckoutDialogService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);

  protected readonly eventExploreOrderOptions = APP_STATIC_DATA.eventExploreOrderOptions;
  protected readonly eventExploreViewOptions = APP_STATIC_DATA.activitiesViewOptions.filter(
    (option): option is { key: ContractTypes.EventExploreView; label: string; icon: string } =>
      option.key === 'day' || option.key === 'distance'
  );
  protected readonly topicFilterGroups = APP_STATIC_DATA.interestOptionGroups;

  private users: UserDto[] = [];
  private userByIdMap = new Map<string, UserDto>();

  protected isOpen = false;
  protected showTopicPicker = false;
  protected slotPickerRecord: ActivityEventRecord | null = null;
  protected showCheckoutDraftBasket = false;
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

  protected selectedMembers: ActivityContracts.ActivityMemberEntry[] = [];
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
  private readonly checkoutDraftReleaseSourceIds = new Set<string>();
  private readonly clearingCheckoutDraftsBySourceId = new Map<string, EventCheckoutDraft>();

  protected eventExploreSmartListQuery: Partial<ListQuery<EventExploreFeedFilters>> = {};

  @ViewChild('eventExploreSmartList')
  private eventExploreSmartList?: SmartListComponent<ActivityEventRecord, EventExploreFeedFilters>;

  protected eventExploreItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityEventRecord, EventExploreFeedFilters>>;

  @ViewChild('eventExploreItemTemplate', { read: TemplateRef })
  private set eventExploreItemTemplate(value: TemplateRef<SmartListItemTemplateContext<ActivityEventRecord, EventExploreFeedFilters>> | undefined) {
    this.eventExploreItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly eventExploreLoadPage = (query: ListQuery<EventExploreFeedFilters>) =>
    from(this.loadEventExplorePage(query));
  protected readonly EventExploreBuilder = EventExploreBuilder;

  protected readonly eventExploreSmartListConfig: SmartListConfig<ActivityEventRecord, EventExploreFeedFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    defaultView: 'list',
    emptyLabel: 'No visible events right now.',
    emptyDescription: 'Try another filter or check back later.',
    headerProgress: {
      enabled: true
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
    showGroupMarker: ({ groupIndex, scrollable }) => {
      if (groupIndex > 0) {
        return true;
      }
      return scrollable;
    },
    groupBy: (record, query) => EventExploreBuilder.buildGroupLabel(record, query.filters?.view ?? this.eventExploreView)
  };

  constructor() {
    this.refreshUsersDirectory();

    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || request.type !== 'eventExplore') {
        return;
      }
      this.popupCtx.clearActivitiesNavigationRequest();
      this.openEventExplore();
    });

    effect(() => {
      const nextActiveUserId = this.appCtx.activeUserId().trim();
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
      const sync = this.appCtx.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSyncState(sync);
    });

    effect(() => {
      const sync = this.activitiesContext.activityEventSave();
      if (!sync) {
        return;
      }
      this.applyActivityEventSave(sync);
    });

    effect(() => {
      this.eventCheckoutDraftService.drafts();
      const nextPendingDraftSourceIds = this.pendingCheckoutDraftSourceIds();
      const removedPendingDraftSourceIds = [...this.lastPendingCheckoutDraftSourceIds]
        .filter(sourceId => !nextPendingDraftSourceIds.has(sourceId));
      const hasNewPendingDraft = [...nextPendingDraftSourceIds]
        .some(sourceId => !this.lastPendingCheckoutDraftSourceIds.has(sourceId));
      this.lastPendingCheckoutDraftSourceIds = nextPendingDraftSourceIds;
      if (this.isOpen) {
        if (removedPendingDraftSourceIds.length > 0 && this.shouldReloadEventExploreAfterDraftRemoval(removedPendingDraftSourceIds)) {
          this.reloadEventExploreSmartList();
        } else if (hasNewPendingDraft) {
          this.pruneVisibleTrackedEventExploreRecords();
        }
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  protected onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type?: 'eventEditor' | 'eventExplore' }>;
    if (popupEvent.detail?.type !== 'eventExplore') {
      return;
    }
    this.openEventExplore();
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
    if (this.showCheckoutDraftBasket) {
      this.showCheckoutDraftBasket = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.showTopicPicker) {
      this.showTopicPicker = false;
      this.cdr.markForCheck();
      return;
    }
    this.closeEventExplore();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this.showCheckoutDraftBasket && !target.closest('.event-explore-basket')) {
      this.showCheckoutDraftBasket = false;
    }
    this.cdr.markForCheck();
  }

  protected onEventExploreSmartListStateChange(state: SmartListStateChange<ActivityEventRecord, EventExploreFeedFilters>): void {
    this.eventExploreHeaderProgress = state.progress;
    this.eventExploreHeaderProgressLoading = state.loading;
    this.eventExploreHeaderLoadingProgress = state.loadingProgress;
    this.eventExploreHeaderLoadingOverdue = state.loadingOverdue;
    this.eventExploreStickyLabel = state.stickyLabel || 'No items';
    this.cdr.markForCheck();
  }

  protected closeEventExplore(): void {
    this.isOpen = false;
    this.showTopicPicker = false;
    this.showCheckoutDraftBasket = false;
    this.slotPickerRecord = null;
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

  protected toggleEventExploreTopicPicker(event?: Event): void {
    event?.stopPropagation();
    this.showTopicPicker = !this.showTopicPicker;
    this.cdr.markForCheck();
  }

  protected closeEventExploreTopicPicker(event?: Event): void {
    event?.stopPropagation();
    this.showTopicPicker = false;
    this.cdr.markForCheck();
  }

  protected selectEventExploreTopicFilter(topic: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedTopic = this.normalizeTopic(topic);
    this.eventExploreFilterTopic = normalizedTopic === this.normalizeTopic(this.eventExploreFilterTopic) ? '' : topic;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected updateEventExploreTopicSelection(selected: readonly string[]): void {
    const nextTopic = selected[0] ?? '';
    if (this.normalizeTopic(nextTopic) === this.normalizeTopic(this.eventExploreFilterTopic)) {
      return;
    }
    this.eventExploreFilterTopic = nextTopic;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected eventExploreTopicFilterLabel(): string {
    if (!this.eventExploreFilterTopic) {
      return 'Topic';
    }
    return `#${this.eventExploreTopicLabel(this.eventExploreFilterTopic)}`;
  }

  protected eventExploreTopicLabel(topic: string): string {
    return topic.replace(/^#+\s*/, '');
  }

  protected eventExploreTopicMenuTrigger(): AppMenuTrigger {
    return {
      id: 'topic-picker',
      label: this.eventExploreTopicFilterLabel(),
      icon: 'sell',
      trailingIcon: 'chevron_right',
      openTrailingIcon: 'expand_less',
      ariaLabel: 'Open topic filter',
      palette: this.eventExploreTopicPalette(this.eventExploreFilterTopic),
      shape: 'pill',
      action: 'custom',
      context: { menu: 'topic-picker' }
    };
  }

  protected eventExploreOrderMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventExploreOrderLabel(),
      icon: this.eventExploreOrderIcon(),
      ariaLabel: 'Open event explore order',
      palette: this.eventExploreOrderPalette(this.eventExploreOrder),
      shape: 'pill'
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
      shape: 'pill'
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

  protected onEventExploreMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventExploreMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'info-card') {
      this.onEventExploreInfoCardMenuAction(context.record, {
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
    if (context.menu === 'topic-picker') {
      this.toggleEventExploreTopicPicker(event.sourceEvent);
    }
  }

  protected openEventExploreInfoCardMenu(
    record: ActivityEventRecord,
    request: InfoCardMenuRequestEvent
  ): void {
    const menuId = `event-explore-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      scope: 'event-explore',
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
    request: InfoCardMenuRequestEvent
  ): readonly AppMenuItem<string, EventExploreMenuContext>[] {
    return request.actions.flatMap(actionId => {
      const config = INFO_CARD_AVAILABLE_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: InfoCardResolvedMenuAction = {
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

  private infoCardActionPalette(tone: InfoCardResolvedMenuAction['tone']): AppMenuPalette {
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
    switch (group?.toneClass) {
      case 'section-social':
        return 'blue';
      case 'section-arts':
        return 'violet';
      case 'section-food':
        return 'orange';
      case 'section-active':
        return 'green';
      case 'section-mind':
        return 'teal';
      case 'section-identity':
        return 'purple';
      default:
        return 'neutral';
    }
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
    this.popupCtx.requestActivitiesNavigation({
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

  protected get activityMembersOrdered(): ActivityContracts.ActivityMemberEntry[] {
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
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      row: EventExploreBuilder.buildActivityRow(record),
      readOnly: true
    });
    this.cdr.markForCheck();
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
      this.confirmationDialogService.openInfo(`You already host ${record.title}.`, {
        title: 'Already hosting',
        confirmTone: 'neutral'
      });
      return;
    }
    if (this.hasTrackedMembership(record, activeUserId)) {
      this.confirmationDialogService.openInfo(`A membership entry already exists for ${record.title}.`, {
        title: 'Already requested',
        confirmTone: 'neutral'
      });
      return;
    }
    if (this.shouldUseCheckoutFlow(record)) {
      this.openEventExploreCheckout(record);
      return;
    }
    this.confirmationDialogService.open({
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
    this.appCtx.setUserProfile(this.resolveUser(record.creatorUserId, record));
    void this.usersService.loadUserById(record.creatorUserId);
    this.navigatorService.openImpressionsPopup(record.creatorUserId);
  }

  protected canPreviewEventExploreMembers(record: ActivityEventRecord): boolean {
    return record.blindMode === 'Open Event';
  }

  protected onEventExploreInfoCardMenuAction(record: ActivityEventRecord, action: InfoCardMenuActionEvent): void {
    if (action.actionId === 'view') {
      this.runEventExploreViewAction(record);
      return;
    }
    if (action.actionId === 'joinWaitlist' || action.actionId === 'bookEvent' || action.actionId === 'requestJoin') {
      this.runEventExploreJoinAction(record);
      return;
    }
    if (action.actionId === 'contactOrganizer') {
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
    const liveDrafts = this.eventCheckoutDraftService.listByUser(activeUserId);
    const liveSourceIds = new Set(liveDrafts.map(draft => draft.sourceId.trim()).filter(Boolean));
    const clearingDrafts = [...this.clearingCheckoutDraftsBySourceId.values()]
      .filter(draft => draft.userId === activeUserId)
      .filter(draft => !liveSourceIds.has(draft.sourceId.trim()));
    return [...liveDrafts, ...clearingDrafts]
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
      .map(draft => ({
        draft,
        record: this.eventsService.peekKnownItemById(activeUserId, draft.sourceId)
      }));
  }

  protected canContinueCheckoutDraft(entry: CheckoutDraftEntry): boolean {
    if (this.isCheckoutDraftClearing(entry.draft.sourceId)) {
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

  protected checkoutDraftActionLabel(entry: CheckoutDraftEntry): string {
    if (this.canContinueCheckoutDraft(entry)) {
      return 'Continue';
    }
    return this.checkoutDraftPendingReason(entry) === 'waitlist'
      ? 'Waiting for spot'
      : 'Waiting for approval';
  }

  protected checkoutDraftPendingLabel(entry: CheckoutDraftEntry): string {
    return this.checkoutDraftPendingReason(entry) === 'waitlist'
      ? 'Waiting for a spot to open before payment.'
      : 'Waiting for admin approval before payment.';
  }

  protected isCheckoutDraftClearing(sourceId: string): boolean {
    return this.checkoutDraftReleaseSourceIds.has(sourceId.trim());
  }

  protected toggleCheckoutDraftBasket(event?: Event): void {
    event?.stopPropagation();
    this.showCheckoutDraftBasket = !this.showCheckoutDraftBasket;
    this.cdr.markForCheck();
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
    const record = this.eventsService.peekKnownItemById(this.activeUserId, draft.sourceId)
      ?? await this.eventsService.queryKnownItemById(this.activeUserId, draft.sourceId);
    if (!record) {
      this.eventCheckoutDraftService.clear(this.activeUserId, draft.sourceId);
      this.confirmationDialogService.openInfo('This checkout draft can no longer be restored.', {
        title: 'Basket unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }
    this.showCheckoutDraftBasket = false;
    this.openEventExploreCheckout(record, {
      approvalGranted: this.canContinueCheckoutDraft({ draft, record })
    });
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
      ?? this.eventsService.peekKnownItemById(this.activeUserId, sourceId)
      ?? await this.eventsService.queryKnownItemById(this.activeUserId, sourceId);
    if (!record) {
      this.confirmationDialogService.openInfo('This event can no longer be opened.', {
        title: 'Event unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }
    this.showCheckoutDraftBasket = false;
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
      this.eventCheckoutDraftService.clear(activeUserId, sourceId);
      this.cdr.markForCheck();
      return;
    }
    if (this.checkoutDraftReleaseSourceIds.has(sourceId)) {
      return;
    }

    this.checkoutDraftReleaseSourceIds.add(sourceId);
    this.clearingCheckoutDraftsBySourceId.set(sourceId, { ...draft });
    this.eventCheckoutDraftService.clear(activeUserId, sourceId);
    this.cdr.markForCheck();
    try {
      const record = this.eventsService.peekKnownItemById(activeUserId, sourceId)
        ?? await this.eventsService.queryKnownItemById(activeUserId, sourceId);

      if (!record) {
        if (this.isOpen) {
          this.reloadEventExploreSmartList();
        }
        return;
      }

      const owner = this.eventMembersOwner(record);
      const baseMembers = this.activityMembersService.peekMembersByOwner(owner);
      const existingMembers = baseMembers.length > 0 ? baseMembers : this.buildMemberEntries(record);
      const hadMembership = existingMembers.some(member => member.userId === activeUserId);
      if (!hadMembership) {
        this.locallyTrackedMembershipSourceIds.delete(sourceId);
        if (this.isOpen) {
          this.reloadEventExploreSmartList();
        }
        return;
      }

      const nextMembers = this.sortMembersByActionTimeDesc(
        existingMembers.filter(member => member.userId !== activeUserId)
      );
      const payload = this.buildActivityEventSaveDTO(record, nextMembers);
      const persistence = this.activitiesContext.emitActivityEventSave(payload);
      if (this.selectedMembersRecord?.id === record.id) {
        this.selectedMembers = nextMembers;
      }
      this.cdr.markForCheck();
      await persistence;
      if (this.isOpen) {
        this.reloadEventExploreSmartList();
      }
    } finally {
      this.clearingCheckoutDraftsBySourceId.delete(sourceId);
      this.checkoutDraftReleaseSourceIds.delete(sourceId);
      this.cdr.markForCheck();
    }
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
        topic: query.filters?.topic ?? this.normalizeTopic(this.eventExploreFilterTopic),
        excludedSourceIds: [...this.pendingCheckoutDraftSourceIds()]
      }
    });
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return page;
    }
    const filteredItems = page.items.filter(record => !this.hasTrackedMembership(record, activeUserId));
    if (filteredItems.length === page.items.length) {
      return page;
    }
    return {
      items: filteredItems,
      total: Math.max(filteredItems.length, page.total - (page.items.length - filteredItems.length)),
      nextCursor: page.nextCursor ?? null
    };
  }

  protected eventExploreInfoCard(record: ActivityEventRecord, groupLabel: string | null): InfoCardData {
    return EventExploreBuilder.buildInfoCard(record, {
      groupLabel,
      topicToneGroups: this.topicFilterGroups,
      state: this.isEventExploreRecordLeaving(record) ? 'leaving' : 'default'
    });
  }

  private runEventExploreServiceChatAction(record: ActivityEventRecord): void {
    const chat = this.buildEventExploreServiceChat(record);
    if (!chat) {
      return;
    }
    this.activitiesContext.openEventChat(chat);
  }

  private buildEventExploreServiceChat(record: ActivityEventRecord): (ChatRecord & { ownerUserId?: string }) | null {
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
      eventId: record.id,
      ownerUserId: activeUserId
    };
  }

  private runEventExploreReportAction(record: ActivityEventRecord): void {
    const targetUserId = `${record.creatorUserId ?? ''}`.trim();
    if (!targetUserId || targetUserId === this.activeUserId.trim()) {
      return;
    }
    this.navigatorService.openReportUserPopup({
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


  protected closeEventExploreSlotPicker(): void {
    this.slotPickerRecord = null;
    this.cdr.markForCheck();
  }

  protected selectEventExploreSlot(slot: ContractTypes.EventSlotOccurrence): void {
    const record = this.slotPickerRecord;
    if (!record) {
      return;
    }
    this.confirmationDialogService.open({
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

  protected slotPickerOccupancyLabel(slot: ContractTypes.EventSlotOccurrence): string {
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
    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private applyActivityEventSave(sync: ActivityEventDTO): void {
    const dto = sync;
    const userJoinedEvent = false;
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
      if (userJoinedEvent) {
        currentItems.splice(currentIndex, 1);
        this.eventExploreSmartList.replaceVisibleItems(currentItems, {
          total: Math.max(currentItems.length, this.eventExploreSmartList.cursorState().total - 1)
        });
        this.cdr.markForCheck();
        return;
      }
      const existing = currentItems[currentIndex];
      if (existing) {
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
          blindMode: dto.blindMode ?? existing.blindMode,
          imageUrl: dto.imageUrl.trim() || existing.imageUrl,
          sourceLink: dto.sourceLink?.trim() || existing.sourceLink,
          location: dto.location?.trim() || existing.location,
          locationCoordinates: dto.locationCoordinates ?? existing.locationCoordinates,
          acceptedMembers,
          pendingMembers: Number.isFinite(Number(dto.pendingMembers))
            ? Math.max(0, Math.trunc(Number(dto.pendingMembers)))
            : existing.pendingMembers,
          capacityMin: dto.capacityMin ?? existing.capacityMin,
          capacityMax: dto.capacityMax ?? existing.capacityMax,
          capacityTotal: Math.max(
            acceptedMembers,
            dto.capacityMax ?? dto.capacityTotal ?? existing.capacityTotal
          ),
          autoInviter: dto.autoInviter ?? existing.autoInviter,
          frequency: dto.frequency ?? existing.frequency,
          slotsEnabled: dto.slotsEnabled ?? existing.slotsEnabled,
          slotTemplates: Array.isArray(dto.slotTemplates)
            ? dto.slotTemplates.map(item => ({ ...item }))
            : (existing.slotTemplates ?? []).map(item => ({ ...item })),
          parentEventId: dto.parentEventId ?? existing.parentEventId,
          slotTemplateId: dto.slotTemplateId ?? existing.slotTemplateId,
          generated: dto.generated ?? existing.generated,
          eventType: dto.eventType ?? existing.eventType,
          nextSlot: dto.nextSlot ? { ...dto.nextSlot } : (existing.nextSlot ? { ...existing.nextSlot } : null),
          upcomingSlots: Array.isArray(dto.upcomingSlots)
            ? dto.upcomingSlots.map(item => ({ ...item }))
            : (existing.upcomingSlots ?? []).map(item => ({ ...item })),
          topics: Array.isArray(dto.topics) ? [...dto.topics] : [...existing.topics],
          ticketing: dto.ticketing ?? existing.ticketing,
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

  private async loadEventExploreMembers(owner: ActivityMemberOwnerRef, record: ActivityEventRecord): Promise<void> {
    const members = await this.activityMembersService.queryMembersByOwner(owner);
    if (!this.selectedMembersRecord || this.selectedMembersRecord.id !== record.id) {
      return;
    }
    this.selectedMembers = this.sortMembersByActionTimeDesc(members);
    this.cdr.markForCheck();
  }

  private buildMemberEntries(record: ActivityEventRecord): ActivityContracts.ActivityMemberEntry[] {
    const row = EventExploreBuilder.buildActivityRow(record);
    const rowKey = `${row.type}:${row.id}`;
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

    const entries: ActivityContracts.ActivityMemberEntry[] = [];
    for (const userId of acceptedUserIds) {
      const user = this.resolveUser(userId, record);
      const base = ActivityMembersBuilder.toActivityMemberEntry(
        user,
        { ...row, isAdmin: true },
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
      const base = ActivityMembersBuilder.toActivityMemberEntry(
        user,
        { ...row, isAdmin: true },
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

  private hasPendingCheckoutDraft(sourceId: string, userId: string): boolean {
    return this.isTrackableCheckoutDraft(this.eventCheckoutDraftService.read(userId, sourceId));
  }

  private pendingCheckoutDraftSourceIds(): Set<string> {
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return new Set<string>();
    }
    return new Set(
      this.eventCheckoutDraftService.listByUser(activeUserId)
        .filter(draft => this.isTrackableCheckoutDraft(draft))
        .map(draft => draft.sourceId.trim())
        .filter(sourceId => sourceId.length > 0)
    );
  }

  private shouldReloadEventExploreAfterDraftRemoval(sourceIds: readonly string[]): boolean {
    return sourceIds.some(sourceId => {
      const normalizedSourceId = sourceId.trim();
      if (!normalizedSourceId || this.checkoutDraftReleaseSourceIds.has(normalizedSourceId)) {
        return false;
      }
      return !this.locallyTrackedMembershipSourceIds.has(normalizedSourceId);
    });
  }

  private requiresApprovalBeforePayment(
    record: ActivityEventRecord | null,
    draft: EventCheckoutDraft | null = null
  ): boolean {
    if (record?.ticketing === true) {
      return true;
    }
    return Math.max(0, Number(draft?.totalAmount) || 0) > 0;
  }

  private checkoutDraftPendingReason(entry: CheckoutDraftEntry): 'approval' | 'waitlist' {
    if (entry.draft.pendingReason === 'waitlist') {
      return 'waitlist';
    }
    return this.isEventExploreRecordFull(entry.record) ? 'waitlist' : 'approval';
  }

  private resolveCheckoutDraftMembershipStatus(
    sourceId: string,
    record: ActivityEventRecord | null
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
    return Math.max(0, Number(draft?.totalAmount) || 0) > 0
      || draft?.pendingReason === 'waitlist';
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
    if ((record.upcomingSlots?.length ?? 0) > 0) {
      return true;
    }
    if ((record.policies?.length ?? 0) > 0) {
      return true;
    }
    if ((record.subEvents ?? []).some(item => item.optional)) {
      return true;
    }
    return Boolean(record.pricing?.enabled && (Number(record.pricing?.basePrice) || 0) > 0);
  }

  private openEventExploreCheckout(
    record: ActivityEventRecord,
    options: { approvalGranted?: boolean } = {}
  ): void {
    const dialogOptions = {
      approvalGranted: options.approvalGranted === true
    };
    this.eventCheckoutDialogService.open({
      mode: 'join',
      userId: this.activeUserId,
      record,
      requiresApprovalBeforePayment: this.requiresApprovalBeforePayment(record),
      approvalGranted: dialogOptions.approvalGranted,
      pendingReason: this.isEventExploreRecordFull(record) ? 'waitlist' : 'approval',
      title: this.eventExploreJoinDialogTitle(record, dialogOptions),
      subtitle: record.timeframe,
      confirmLabel: this.eventExploreJoinConfirmLabel(record, dialogOptions),
      busyConfirmLabel: this.eventExploreJoinBusyLabel(record, dialogOptions),
      failureMessage: this.eventExploreJoinFailureMessage(record, dialogOptions),
      onSubmit: (selection) => this.submitEventExploreJoinRequest(record, selection)
    });
  }

  private openEventExploreSlotPicker(record: ActivityEventRecord): void {
    this.slotPickerRecord = record;
    this.cdr.markForCheck();
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
    const exitPromise = this.runEventExploreExitTransition(record, () => {
      this.removeVisibleEventExploreRecord(record);
    });
    const peekedMembers = this.activityMembersService.peekMembersByOwner(owner);
    const existingMembers = peekedMembers.length > 0 ? peekedMembers : this.buildMemberEntries(record);
    const existingEntry = existingMembers.find(member => member.userId === activeUserId);

    if (existingEntry) {
      await exitPromise;
      if (this.selectedMembersRecord?.id === record.id) {
        this.selectedMembers = this.sortMembersByActionTimeDesc(existingMembers);
      }
      this.cdr.markForCheck();
      return;
    }

    const pendingReason = selection?.pendingReason ?? (this.isEventExploreSelectionFull(record, selection) ? 'waitlist' : null);
    const isAcceptedBooking = this.isConfirmedEventExploreBooking(record, selection);
    const nextMembers = this.sortMembersByActionTimeDesc([
      ...existingMembers,
      this.buildJoinRequestEntry(record, isAcceptedBooking, pendingReason)
    ]);
    const rollbackPayload = this.buildActivityEventSaveDTO(record, existingMembers);
    const nextPayload = this.buildActivityEventSaveDTO(record, nextMembers, selection?.paymentSessionId ?? null);
    this.activitiesContext.emitActivityEventSave(nextPayload);

    try {
      const requestJoinPromise = this.eventsService.requestJoin(activeUserId, record.id, {
        slotSourceId: selection?.slotSourceId ?? null,
        optionalSubEventIds: selection?.optionalSubEventIds ?? [],
        assetSelections: selection?.assetSelections ?? [],
        acceptedPolicyIds: selection?.acceptedPolicyIds ?? [],
        paymentSessionId: selection?.paymentSessionId ?? null,
        bookingConfirmed: isAcceptedBooking,
        pendingReason
      });
      const [joinedRecord] = await Promise.all([requestJoinPromise, exitPromise]);
      if (!joinedRecord) {
        throw new Error(this.eventExploreJoinFailureMessage(record));
      }
      const authoritativeMembers = this.sortMembersByActionTimeDesc(
        await this.activityMembersService.queryMembersByOwner(this.eventMembersOwner(joinedRecord))
      );
      const displayMembers = authoritativeMembers.length > 0 ? authoritativeMembers : nextMembers;
      this.activitiesContext.emitActivityEventSave(
        this.buildActivityEventSaveDTO(joinedRecord, displayMembers, selection?.paymentSessionId ?? null)
      );
      if (this.selectedMembersRecord?.id === record.id) {
        this.selectedMembersRecord = joinedRecord;
        this.selectedMembers = displayMembers;
      }
      this.cdr.markForCheck();
    } catch (error) {
      this.activitiesContext.emitActivityEventSave(rollbackPayload);
      throw error;
    }
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
    const activeUserId = this.activeUserId.trim();
    const currentRecord = currentItems[currentIndex];
    if (!currentRecord) {
      return false;
    }
    if (activeUserId && this.hasTrackedMembership(currentRecord, activeUserId)) {
      currentItems.splice(currentIndex, 1);
      this.eventExploreSmartList.replaceVisibleItems(currentItems, {
        total: Math.max(currentItems.length, this.eventExploreSmartList.cursorState().total - 1)
      });
      return true;
    }
    currentItems[currentIndex] = {
      ...currentRecord,
      acceptedMembers: Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
      pendingMembers: Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0)),
      capacityTotal: Math.max(
        Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
        Math.trunc(Number(sync.capacityTotal) || 0)
      )
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
    const currentItems = [...this.eventExploreSmartList.itemsSnapshot()];
    const nextItems = currentItems.filter(item => item.id !== record.id);
    if (nextItems.length === currentItems.length) {
      return;
    }
    this.eventExploreSmartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, this.eventExploreSmartList.cursorState().total - 1)
    });
  }

  private pruneVisibleTrackedEventExploreRecords(): void {
    if (!this.eventExploreSmartList) {
      return;
    }
    const activeUserId = this.activeUserId.trim();
    if (!activeUserId) {
      return;
    }
    const currentItems = [...this.eventExploreSmartList.itemsSnapshot()];
    const nextItems = currentItems.filter(item => !this.hasTrackedMembership(item, activeUserId));
    if (nextItems.length === currentItems.length) {
      return;
    }
    this.eventExploreSmartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, this.eventExploreSmartList.cursorState().total - (currentItems.length - nextItems.length))
    });
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
  ): ActivityContracts.ActivityMemberEntry {
    const user = this.resolveUser(this.activeUserId, record);
    const row = EventExploreBuilder.buildActivityRow(record);
    const entry = ActivityMembersBuilder.toActivityMemberEntry(
      user,
      row,
      `${row.type}:${row.id}`,
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
      requestKind: accepted ? null : (pendingReason === 'waitlist' ? 'waitlist' : 'join'),
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

  private isEventExploreSlotFull(slot: ContractTypes.EventSlotOccurrence): boolean {
    const capacityTotal = Math.max(0, Math.trunc(Number(slot.capacityTotal) || 0));
    if (capacityTotal <= 0) {
      return false;
    }
    return Math.max(0, Math.trunc(Number(slot.acceptedMembers) || 0)) >= capacityTotal;
  }

  private buildActivityEventSaveDTO(
    record: ActivityEventRecord,
    members: readonly ActivityContracts.ActivityMemberEntry[],
    paymentSessionId: string | null = null
  ): ContractTypes.ActivityEventSaveDTO {
    const summary = ActivityMembersBuilder.buildActivityMembersSummary(
      this.eventMembersOwner(record),
      members,
      record.capacityTotal
    );
    return {
      id: record.id,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: Math.max(0, Math.trunc(Number(record.activity) || 0)),
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: summary.capacityTotal,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      autoInviter: record.autoInviter,
      frequency: record.frequency,
      ticketing: record.ticketing,
      visibility: record.visibility,
      blindMode: record.blindMode,
      status: record.status ?? 'A',
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorGender: record.creatorGender,
      creatorCity: record.creatorCity,
      location: record.location,
      locationCoordinates: record.locationCoordinates ?? undefined,
      sourceLink: record.sourceLink,
      topics: [...record.topics],
      subEvents: Array.isArray(record.subEvents)
        ? record.subEvents.map(item => ({
            ...item,
            groups: Array.isArray(item.groups)
              ? item.groups.map(group => ({ ...group }))
              : []
          }))
        : undefined,
      subEventsDisplayMode: record.subEventsDisplayMode,
      paymentSessionId
    };
  }

  private sortMembersByActionTimeDesc(entries: readonly ActivityContracts.ActivityMemberEntry[]): ActivityContracts.ActivityMemberEntry[] {
    return [...entries].sort((left, right) =>
      AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso)
    );
  }

  private stopDomEvent(event?: { stopPropagation?: () => void; preventDefault?: () => void } | null): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  private resolveFilters(query: ListQuery<EventExploreFeedFilters>): EventExploreFeedFilters {
    return {
      userId: query.filters?.userId?.trim() || this.activeUserId,
      order: query.filters?.order ?? this.eventExploreOrder,
      view: query.filters?.view ?? this.eventExploreView,
      friendsOnly: query.filters?.friendsOnly ?? this.eventExploreFilterFriendsOnly,
      openSpotsOnly: query.filters?.openSpotsOnly ?? this.eventExploreFilterHasRooms,
      topic: query.filters?.topic ?? this.normalizeTopic(this.eventExploreFilterTopic)
    };
  }

  private refreshUsersDirectory(): void {
    const users = this.gameService.getGameCardsUsersSnapshot();
    const activeProfile = this.appCtx.activeUserProfile();
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

  private activityMemberAge(entry: ActivityContracts.ActivityMemberEntry): number {
    return this.userByIdMap.get(entry.userId)?.age ?? 0;
  }

  private activityMemberRoleLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    return entry.role;
  }

  private activityMemberStatusLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite') {
      return 'Waiting list';
    }
    if (this.isActivityJoinRequest(entry)) {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  private memberCardStatusIcon(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'admin_panel_settings' : 'person';
    }
    if (this.isActivityJoinRequest(entry)) {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  private memberCardStatusClass(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (this.isActivityJoinRequest(entry)) {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  private memberCardToneClass(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (this.isActivityJoinRequest(entry)) {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  private memberCardStatusLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role;
    }
    return this.activityMemberStatusLabel(entry);
  }

  private isActivityJoinRequest(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return entry.requestKind === 'join'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private activityMemberDeleteLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    return entry.status === 'accepted' ? 'Remove member' : 'Delete invitation';
  }
}
