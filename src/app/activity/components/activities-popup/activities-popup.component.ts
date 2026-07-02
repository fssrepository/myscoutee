import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  HostListener,
  inject,
  OnDestroy,
  untracked,
  ViewChild
} from '@angular/core';
import {
  CommonModule
} from '@angular/common';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import {
  APP_STATIC_DATA,
  type RateFilterEntry
} from '../../../shared/app-static-data';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import {
  type ActivityEventDTO,
  type ActivityMembersSummaryDto
} from '../../../shared/core/contracts/activity.interface';
import type {
  ActivityRateDTO
} from '../../../shared/core/contracts/activity.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  type ActivityCounterKey,
  type ActivityCounters,
  type ActivityMembersSyncState
} from '../../../shared/ui';
import {
  ActivitiesPopupStore,
  type EventChatRowPatch
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  EventEditorPopupStore
} from '../../../shared/ui/context/stores/event-editor-popup.store';
import {
  AssetStore
} from '../../../shared/ui/context/stores/asset.store';
import type { ActivitiesFeedFilters } from '../../../shared/core/contracts';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  AppMenuDispatcher,
  type AppMenuGroup,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  EventCheckoutPopupComponent,
  type CardProfileViewData,
  type ImageCardData,
  type InfoCardData,
  PopupComponent,
  type PopupActionEvent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  SmartListComponent,
  type CardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLocalSortKey,
  type SmartListLoadContext,
  type SmartListLoadPage,
  type SmartListMenuItemsContext,
  type SmartListPresentation,
  type SmartListStateChange,
  type UiListConverter
} from '../../../shared/ui';
import {
  ActivityChatSingleRowConverter,
  ActivityEventInfoCardConverter,
  ActivityEventInfoCardMenuConverter,
  ActivityRateImageCardConverter
} from '../../../shared/ui/converters';
import type {
  ActivityEventInfoCardMenuContext,
  ActivityEventInfoCardMenuSubject
} from '../../../shared/ui/converters';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  EventCheckoutDialogStore
} from '../../../shared/ui/context/stores/event-checkout-dialog.store';
import {
  EventCheckoutDraftStore,
  type EventCheckoutDraft
} from '../../../shared/ui/context/stores/event-checkout-draft.store';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import {
  ActivitiesChatTemplateComponent,
  ActivitiesChatsController
} from './templates/chat/activities-chat-template.component';
import {
  ActivitiesEventTemplateComponent,
  ActivitiesEventsController
} from './templates/event/activities-event-template.component';
import {
  ActivitiesRateTemplateComponent,
  ActivitiesRatesController,
  type ActivitiesRateTemplateContext
} from './templates/rate/activities-rate-template.component';
import {
  ActivityMembersBuilder,
  ActivitiesService,
  ActivityMembersService,
  ActivityResourcesService,
  ChatsService,
  EventsService,
  ExplanationGuideService,
  RatesService,
  ShareTokensService,
  UsersService
} from '../../../shared/core';
import {
  I18nService
} from '../../../shared/core';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AppConstants from '../../../shared/core/common/constants';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';
// ---------------------------------------------------------------------------

type ActivitiesSmartListFilters = ActivitiesFeedFilters;
type ActivityEventCounterKey = keyof NonNullable<ActivityCounters['event']>;
type ActivitiesChatContextUnreadCounts = Partial<Record<ContractTypes.ActivitiesChatContextFilter, number>>;
type ActivityEventListType = ActivityContracts.ActivityEventRepositoryItemType;
type ActivityEventListItem = InfoCardData;
type ActivityRateListItem = ImageCardData;
type ActivityChatListItem = SingleRowData;
type ActivityListItem = ActivityEventListItem | ActivityRateListItem | ActivityChatListItem;
type ActivitiesSmartListConverterQuery = ListQuery<ActivitiesSmartListFilters> & {
  context?: {
    rateUsers?: readonly UserDto[];
  };
};

interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}


type ActivitiesPopupMenuContext =
  | { menu: 'primary'; value: ContractTypes.ActivitiesPrimaryFilter }
  | { menu: 'event-scope'; value: ContractTypes.ActivitiesEventScope }
  | { menu: 'chat-context'; value: ContractTypes.ActivitiesChatContextFilter }
  | { menu: 'rate'; value: ContractTypes.RateFilterKey }
  | { menu: 'rate-social'; value: string }
  | { menu: 'secondary'; value: ContractTypes.ActivitiesSecondaryFilter }
  | { menu: 'view'; value: ContractTypes.ActivitiesView }
  | { menu: 'support-case'; value: ContractTypes.SupportCaseFilter }
  | { menu: 'quick-action'; value: 'explore' | 'create' };

@Component({
  selector: 'app-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SmartListComponent,
    ActivitiesEventTemplateComponent,
    ActivitiesChatTemplateComponent,
    ActivitiesRateTemplateComponent,
    EventCheckoutPopupComponent,
    PopupComponent,
  ],
  templateUrl: './activities-popup.component.html',
  styleUrl: './activities-popup.component.scss',
  providers: [AppMenuDispatcher],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPopupComponent implements OnDestroy {
  // ── injected ──────────────────────────────────────────────────────────────
  protected readonly cdr = inject(ChangeDetectorRef);
  protected readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly activitiesService = inject(ActivitiesService);
  protected readonly eventEditorStore = inject(EventEditorPopupStore);
  protected readonly ratesService = inject(RatesService);
  protected readonly activityMembersService = inject(ActivityMembersService);
  protected readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly chatsService = inject(ChatsService);
  protected readonly eventsService = inject(EventsService);
  protected readonly usersService = inject(UsersService);
  protected readonly shareTokensService = inject(ShareTokensService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  protected readonly memberMenuStore = inject(MemberMenuStore);
  protected readonly eventSubeventsStore = inject(EventSubeventsPopupStore);
  private readonly assetStore = inject(AssetStore);
  protected readonly dialogStore = inject(DialogStore);
  protected readonly eventCheckoutDialogStore = inject(EventCheckoutDialogStore);
  protected readonly profileStore = inject(ProfileStore);
  private readonly eventCheckoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly i18nService = inject(I18nService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  readonly activitiesRates = new ActivitiesRatesController({
    getActiveUserGender: () => this.activeUser.gender,
    getActivitiesPrimaryFilter: () => this.activitiesPrimaryFilter,
    getActivitiesRateFilter: () => this.activitiesRateFilter,
    getActivitiesRateSocialBadgeEnabled: () => this.activitiesRateSocialBadgeEnabled,
    getActivitiesRateSocialBadgeEnabledForFilter: filter => filter.startsWith('pair')
      ? this.activitiesPairRateSocialBadgeEnabled
      : this.activitiesIndividualRateSocialBadgeEnabled,
    getFilteredActivityRows: () => this.filteredActivityRows,
    getRateItems: () => this.ratesService.peekRateItemsByUser(this.activeUser.id),
    getSmartListCursorItem: () => this.activitiesSmartList?.cursorItem() ?? null,
    getActivitiesListScrollElement: () => this.activitiesSmartList?.scrollElement() ?? null,
    getPaginationMenuHeight: () => this.activitiesSmartList?.paginationMenuHeightPx() ?? 0,
    isPaginationMenuTarget: target => this.activitiesSmartList?.isPaginationMenuTarget(target) ?? false,
    isMobileView: () => this.isMobileView,
    isCalendarLayoutView: () => this.isCalendarLayoutView(),
    shouldShowFullscreenToggle: () => this.shouldShowRatesFullscreenToggle(),
    isFullscreenPaginationAnimating: () => this.activitiesSmartList?.isFullscreenPaginationAnimating() ?? false,
    getRatingScale: () => this.activityRatingScale,
    getActivityRateEditorSlideDurationMs: () => this.activityRateEditorSlideDurationMs,
    getSelectedRateId: () => this.selectedActivityRateId,
    setSelectedRateId: value => { this.selectedActivityRateId = value; },
    getEditorClosing: () => this.activityRateEditorClosing,
    setEditorClosing: value => { this.activityRateEditorClosing = value; },
    getEditorCloseTimer: () => this.activityRateEditorCloseTimer,
    setEditorCloseTimer: value => { this.activityRateEditorCloseTimer = value; },
    getEditorLiftAnimationFrame: () => this.activityRateEditorLiftAnimationFrame,
    setEditorLiftAnimationFrame: value => { this.activityRateEditorLiftAnimationFrame = value; },
    getEditorOpenScrollTop: () => this.activityRateEditorOpenScrollTop,
    setEditorOpenScrollTop: value => { this.activityRateEditorOpenScrollTop = value; },
    getLastEditorLiftDelta: () => this.lastActivityRateEditorLiftDelta,
    setLastEditorLiftDelta: value => { this.lastActivityRateEditorLiftDelta = value; },
    getLastIndicatorPulseRowId: () => this.lastRateIndicatorPulseRowId,
    setLastIndicatorPulseRowId: value => { this.lastRateIndicatorPulseRowId = value; },
    getFullscreenMode: () => this.activitiesRatesFullscreenMode,
    setFullscreenMode: value => { this.activitiesRatesFullscreenMode = value; },
    getActivityRateBlinkUntilByRowId: () => this.activityRateBlinkUntilByRowId,
    getActivityRateBlinkTimeoutByRowId: () => this.activityRateBlinkTimeoutByRowId,
    setSelectedRateIdInContext: value => this.activitiesStore.setActivitiesSelectedRateId(value),
    setFullscreenModeInContext: value => this.activitiesStore.setActivitiesRatesFullscreenMode(value),
    recordActivityRate: (item, score, direction) => this.ratesService.recordActivityRate(this.activeUser.id, item, score, direction),
    syncVisibleRateItem: item => this.syncVisibleRateItem(item),
    refreshRateCards: rowId => this.refreshActivitiesRateCards(rowId),
    markForCheck: () => this.cdr.markForCheck(),
    runAfterNextPaint: task => this.runAfterActivitiesNextPaint(task),
    runAfterRender: task => this.runAfterActivitiesRender(task)
  });
  readonly activitiesEvents = new ActivitiesEventsController(this as never);
  readonly activitiesChats = new ActivitiesChatsController(this as never);
  protected readonly activitiesRateTemplateContext: ActivitiesRateTemplateContext = this.activitiesRates.templateContext;
  // ── Self-contained data state (no host inputs) ───────────────────────────
  protected isMobileView = false;
  protected get activeUser(): UserDto {
    return this.userProfileStore.activeUserProfile() as UserDto | null
      ?? this.createFallbackActiveUser();
  }

  protected get chatBadge(): number { return this.activityCounterValue('chat'); }
  protected get eventsBadge(): number { return this.activityCounterValue('events'); }
  protected get allEventsScopeBadge(): number { return this.eventCounterValue('all'); }
  protected get pendingBadge(): number { return this.eventCounterValue('pending'); }
  protected get hostingBadge(): number { return this.activityCounterValue('hosting'); }
  protected get invitationsBadge(): number { return this.activityCounterValue('invitations'); }
  protected get draftsBadge(): number { return this.eventCounterValue('drafts'); }
  protected get trashBadge(): number { return this.eventCounterValue('trash'); }
  protected get gameBadge(): number { return this.activityCounterValue('game'); }

  protected activeHostingIds: ReadonlySet<string> = new Set<string>();

  protected activityDateTimeRangeById: Record<string, ActivityDateTimeRange> = {};

  protected eventDatesById: Record<string, string> = {};
  protected hostingDatesById: Record<string, string> = {};

  protected eventDistanceById: Record<string, number> = {};
  protected hostingDistanceById: Record<string, number> = {};
  protected readonly activityImageById: Record<string, string> = {};
  protected readonly activityCapacityById: Record<string, string> = {};
  protected readonly activityPendingMembersById: Record<string, number> = {};
  protected readonly eventVisibilityById: Record<string, AppConstants.EventVisibility> = {};
  private readonly eventCapacityById: Record<string, ContractTypes.EventCapacityRange> = {};
  private lastPendingCheckoutDraftSourceIds = new Set<string>();
  protected readonly activityMembersByRowId: Record<string, ActivityContracts.ActivityMemberDTO[]> = {};
  private readonly activitiesEventCardRevisionByRowId: Record<string, number> = {};
  protected activitiesRateCardRevision = 0;
  protected readonly activityRateCardRevisionByRowId: Record<string, number> = {};
  protected readonly leavingActivityRowIds = new Set<string>();
  protected readonly activityRowExitAnimationMs = 180;
  private lastAppliedActivityMembersUpdatedMs = 0;
  private stopAdminSupportBoardPoll: (() => void) | null = null;
  private adminSupportBoardPollInFlight = false;
  private unregisterActivitiesExplanationContext: (() => void) | null = null;
  private activitiesExplanationContextKey: string | null = null;
  private chatContextUnreadCountsUserId = '';
  private chatContextUnreadCounts: ActivitiesChatContextUnreadCounts | null = null;
  private activitiesChatListStateKey = '';

  protected get assetCards(): AppDTOs.AssetDTO[] {
    return this.assetStore.assetCards();
  }

  private activityCounterValue(key: ActivityCounterKey): number {
    const activeUser = this.userProfileStore.activeUserProfile();
    const activeUserId = activeUser?.id?.trim() ?? '';
    if (!activeUser || !activeUserId) {
      return 0;
    }
    const overrides = this.activityStore.getUserCounterOverrides(activeUserId);
    return this.normalizeBadgeCounter(overrides[key] ?? activeUser.activities?.[key]);
  }

  private eventCounterValue(key: ActivityEventCounterKey): number {
    const activeUser = this.userProfileStore.activeUserProfile();
    const activeUserId = activeUser?.id?.trim() ?? '';
    if (!activeUser || !activeUserId) {
      return 0;
    }
    const overrides = this.activityStore.getUserCounterOverrides(activeUserId);
    return this.normalizeBadgeCounter(overrides.event?.[key] ?? activeUser.activities?.event?.[key]);
  }

  private normalizeBadgeCounter(value: unknown): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.trunc(numericValue));
  }

  // ── ViewChild refs ────────────────────────────────────────────────────────
  @ViewChild('activitiesSmartList')
  protected activitiesSmartList?: SmartListComponent<ActivityListItem, ActivitiesSmartListFilters>;
  // ── Static data ───────────────────────────────────────────────────────────
  protected readonly activityRatingScale   = APP_STATIC_DATA.activityRatingScale;
  protected activitiesRateSocialBadgeEnabled = false;
  protected activitiesIndividualRateSocialBadgeEnabled = false;
  protected activitiesPairRateSocialBadgeEnabled = false;

  protected get isBlockedUser(): boolean {
    return this.userProfileStore.activeUserProfile()?.profileStatus === 'blocked';
  }

  // ── Filter / view state – backed by popup store signals ───────────
  // Local copies are kept in sync via an effect() so that OnPush CD fires
  // correctly without needing toSignal() everywhere in the template.
  protected activitiesPrimaryFilter: ContractTypes.ActivitiesPrimaryFilter        = 'chats';
  protected activitiesEventScope: ContractTypes.ActivitiesEventScope               = 'active-events';
  protected activitiesChatContextFilter: ContractTypes.ActivitiesChatContextFilter = 'all';
  protected activitiesSupportCaseFilter: ContractTypes.SupportCaseFilter           = 'all';
  protected activitiesSecondaryFilter: ContractTypes.ActivitiesSecondaryFilter    = 'recent';
  protected hostingPublicationFilter: ContractTypes.HostingPublicationFilter       = 'all';
  protected activitiesRateFilter: ContractTypes.RateFilterKey                     = 'individual-given';
  protected activitiesView: ContractTypes.ActivitiesView                          = 'day';
  protected showActivitiesViewPicker     = false;
  protected showActivitiesSecondaryPicker = false;
  protected showActivitiesPrimaryPicker = false;
  protected showActivitiesEventScopePicker = false;
  protected showActivitiesChatContextPicker = false;
  protected showActivitiesRatePicker      = false;
  protected showActivitiesQuickActionsMenu = false;
  protected activitiesSmartListQuery: Partial<ListQuery<ActivitiesSmartListFilters>> = {};
  private readonly activitySmartListItemConverter: UiListConverter<
    unknown,
    ActivityListItem,
    ListQuery<ActivitiesSmartListFilters>
  > = {
    convert: (source, query) => this.convertActivitySmartListItem(source, query),
    convertList: (sources, query) => this.convertActivitySmartListItems(sources, query)
  };
  protected readonly activitiesSmartListConfig: SmartListConfig<ActivityListItem, ActivitiesSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    defaultView: 'day',
    containerClass: () => this.activitiesSmartListClassMap(),
    listLayout: 'card-grid',
    desktopColumns: () => this.activitiesPrimaryFilter === 'chats' ? 1 : 3,
    snapMode: () => {
      if (this.activitiesPrimaryFilter === 'chats') {
        return 'none';
      }
      if (this.activitiesPrimaryFilter === 'rates') {
        return 'mandatory';
      }
      return 'mandatory';
    },
    scrollPaddingTop: '2.6rem',
    footerSpacerHeight: null,
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    pagination: {
      mode: () => {
        if (this.activitiesPrimaryFilter !== 'rates') {
          return 'scroll';
        }
        if (this.activitiesRates.isFullscreenModeActive()) {
          return this.activitiesRates.isFullscreenReadOnlyNavigation() ? 'arrows' : 'rating-stars';
        }
        return 'scroll';
      },
      ratingBarConfig: () => this.activitiesRates.ratingBarConfig(),
      ratingBarValue: () => this.activitiesRates.ratingBarValue(),
      onRatingSelect: (_item, score) => this.activitiesRates.setSelectedOwnRating(score)
    },
    calendarVariant: () => this.activitiesPrimaryFilter === 'rates' ? 'rate-counts' : 'default',
    views: [
      { key: 'day', label: 'Day', mode: 'list', pageSize: 10 },
      { key: 'distance', label: 'Distance', mode: 'list', pageSize: 10 },
      { key: 'week', label: 'Week', mode: 'week', pageSize: 240 },
      { key: 'month', label: 'Month', mode: 'month', pageSize: 240 }
    ],
    cacheable: true,
    sortable: {
      sortKey: row => this.activityRowLocalSortKey(row)
    },
    converter: this.activitySmartListItemConverter,
    groupBy: row => AppUtils.activityGroupLabel(
      row,
      this.activitiesView,
      APP_STATIC_DATA.activityGroupLabels
    ),
    calendar: {
      weekdayLabels: APP_STATIC_DATA.calendarWeekdayLabels,
      weekStartHour: 0,
      weekEndHour: 23,
      anchorRadius: 2,
      resolveDateRange: row => this.activityCalendarDateRange(row),
      badgeLabel: row => row.title,
      badgeToneClass: row => this.calendarBadgeToneClass(row)
    },
    emptyLabel: () => this.activitiesEmptyLabel,
    emptyStickyLabel: () => (this.activitiesView === 'distance' ? '5 km' : 'No items'),
    showGroupMarker: ({ groupIndex, scrollable }) => {
      if (groupIndex > 0) {
        return true;
      }
      if (this.activitiesPrimaryFilter === 'chats') {
        return false;
      }
      if (this.isEventActivitiesPrimaryFilter() && !scrollable) {
        return false;
      }
      if (!scrollable) {
        return false;
      }
      return true;
    },
    menuItems: context => this.activitySmartListMenuItems(context)
  };
  protected readonly activitiesSmartListLoadPage: SmartListLoadPage<ActivityListItem, ActivitiesSmartListFilters>
    = (query, context) => from(this.loadActivitiesSmartListPage(query, context));
  // ── Scroll / sticky ───────────────────────────────────────────────────────
  protected activitiesListScrollable  = true;
  protected activitiesStickyValue     = '';
  protected activitiesInitialLoadPending = false;
  private lastHandledActivitiesOpenRevision = 0;
  protected readonly activitiesPageSize  = 10;

  // ── Rates state ───────────────────────────────────────────────────────────
  protected selectedActivityRateId: string | null  = null;
  protected activityRateEditorClosing                = false;
  protected activityRateEditorCloseTimer: ReturnType<typeof setTimeout> | null = null;
  protected activityRateEditorLiftAnimationFrame: number | null = null;
  protected readonly activityRateEditorSlideDurationMs = 180;
  protected activityRateEditorOpenScrollTop: number | null = null;
  protected lastActivityRateEditorLiftDelta = 0;
  protected readonly activityRateBlinkUntilByRowId: Record<string, number>                          = {};
  protected readonly activityRateBlinkTimeoutByRowId: Record<string, ReturnType<typeof setTimeout> | null> = {};

  protected lastRateIndicatorPulseRowId: string | null = null;

  // ── Rates fullscreen state ────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;

  // ── Delete / publish confirms ─────────────────────────────────────────────
  protected stackedActivitiesPopup: 'activityMembers' | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected pendingActivityMemberDelete: ActivityContracts.ActivityMemberDTO | null = null;
  protected selectedActivityMembers: ActivityContracts.ActivityMemberDTO[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRow: ActivityEventListItem | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  protected readonly trashedActivityRowsByKey: Record<string, ActivityListItem> = {};

  protected getChatLastSender(item: ChatDTO): UserDto {
    return this.activitiesChats.getChatLastSender(item);
  }

  protected getChatMemberCount(item: ChatDTO): number {
    return this.activitiesChats.getChatMemberCount(item);
  }

  protected chatChannelType(item: ChatDTO): ContractTypes.ChatChannelType {
    return this.activitiesChats.chatChannelType(item);
  }

  protected chatItemsForActivities(): ChatDTO[] {
    return this.activitiesChats.chatItemsForActivities();
  }

  protected activityChatContextFilterKey(item: ChatDTO): ContractTypes.ActivitiesChatContextFilter | null {
    return this.activitiesChats.activityChatContextFilterKey(item);
  }

  protected openActivityChat(chat: ChatDTO): void {
    this.activitiesChats.openActivityChat(chat);
  }

  protected openActivityChatForRow(row: ActivityListItem): void {
    const chat = this.chatRecordForRow(row);
    if (chat) {
      this.openActivityChat(chat);
    }
  }

  protected onActivityRowClick(row: ActivityListItem, event?: Event): void {
    if (this.activitiesPrimaryFilter === 'chats') {
      this.openActivityChatForRow(row);
      return;
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      this.activitiesRates.openEditor(row, event as Event);
      return;
    }
    this.activitiesEvents.onActivityRowClick(row as ActivityEventListItem, event);
  }

  protected openActivityMembers(row: ActivityListItem, event?: Event): void {
    event?.stopPropagation();
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    if (this.activityEventListTypeForRow(row) !== 'invitations') {
      this.activitiesEvents.openActivityMembers(row, event);
      return;
    }
    const membersRow = this.resolveInvitationActivityMembersRow(row);
    if (this.activityEventListTypeForRow(membersRow) !== 'invitations') {
      this.activitiesEvents.openActivityMembers(membersRow, event);
      return;
    }
    const owner = ActivityEventInfoCardConverter.toActivityMembersOwner(membersRow);
    const summary = this.resolveActivityMembersPopupSummary(membersRow);
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      subtitle: membersRow.title,
      canManage: this.activityEventDTOIsAdmin(this.eventsService.peekKnownItemById(this.activeUser.id, membersRow.id)),
      acceptedMembers: summary?.acceptedMembers,
      pendingMembers: summary?.pendingMembers,
      capacityTotal: summary?.capacityTotal
    });
  }

  protected onActivityEventCardMenuAction(row: ActivityListItem, action: CardMenuActionEvent<InfoCardData>): void {
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    this.activitiesEvents.onActivityEventCardMenuAction(row, action);
  }

  protected activitySmartListMenuItems(
    context: SmartListMenuItemsContext<ActivityListItem, ActivitiesSmartListFilters>
  ): readonly AppMenuItem<string, unknown>[] {
    const subject = this.activityEventMenuSubjectFromRow(context.item);
    if (!subject) {
      return context.menu.items;
    }
    const activeUserId = this.userProfileStore.activeUserId().trim() || this.activeUser.id;
    return ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId,
      hiddenActions: ['editEvent', 'manageEvent']
    });
  }

  protected onActivityEventSharedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.activitiesRates.handleMenuSelect(event)) {
      return;
    }
    const context = event.context as ActivityEventInfoCardMenuContext | undefined;
    if (context?.menu !== 'activity-event-card') {
      return;
    }
    const row = this.activityEventRowFromMenuSubject(context.subject);
    if (!row) {
      return;
    }
    this.onActivityEventCardMenuAction(row, {
      id: row.id,
      actionId: context.action.id,
      action: context.action,
      card: row
    });
  }

  private activityEventMenuSubjectFromRow(row: ActivityListItem | null | undefined): ActivityEventInfoCardMenuSubject | null {
    if (!row || !this.isEventStyleActivity(row)) {
      return null;
    }
    const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    return {
      menu: 'activity-event-card',
      id: row.id,
      status: dto?.status ?? row.status ?? null,
      ownerUserId: dto?.creatorUserId ?? row.ownerUserId ?? row.ownerId ?? null,
      adminIds: [...(dto?.adminIds ?? [])],
      acceptedMemberUserIds: [...(dto?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto?.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(dto?.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(dto?.pendingRequestMemberUserIds ?? [])],
      eventScope: this.activitiesEventScope
    };
  }

  private activityEventRowFromMenuSubject(subject: ActivityEventInfoCardMenuSubject): ActivityEventListItem | null {
    const row = this.activitiesSmartList?.findVisibleItem(item => item.id === subject.id) ?? null;
    if (!row || !this.isEventStyleActivity(row)) {
      return null;
    }
    return row;
  }

  protected openProfileView(profileView: CardProfileViewData): void {
    this.profileStore.openProfileView(profileView);
  }

  protected isActivityIdentityTrashed(type: ActivityEventListType, id: string): boolean {
    return this.activitiesEvents.isActivityIdentityTrashed(type, id);
  }

  protected openActivityRowInEventModule(row: ActivityListItem, readOnly: boolean): void {
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    this.activitiesEvents.openActivityRowInEventModule(row, readOnly);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  constructor() {
    this.hydrateStandaloneFallbackState();
    this.syncMobileViewFromViewport();

    // Sync store signal state → local properties so OnPush CD fires.
    effect(() => {
      const store = this.activitiesStore;
      this.activitiesPrimaryFilter       = store.activitiesPrimaryFilter() as ContractTypes.ActivitiesPrimaryFilter;
      this.activitiesEventScope          = store.activitiesEventScope() as ContractTypes.ActivitiesEventScope;
      this.activitiesChatContextFilter   = store.activitiesChatContextFilter() as ContractTypes.ActivitiesChatContextFilter;
      this.activitiesSupportCaseFilter   = store.activitiesSupportCaseFilter() as ContractTypes.SupportCaseFilter;
      this.activitiesSecondaryFilter     = store.activitiesSecondaryFilter() as ContractTypes.ActivitiesSecondaryFilter;
      this.hostingPublicationFilter      = store.activitiesHostingPublicationFilter() as ContractTypes.HostingPublicationFilter;
      this.activitiesRateFilter          = store.activitiesRateFilter() as ContractTypes.RateFilterKey;
      this.activitiesRateSocialBadgeEnabled = store.activitiesRateSocialBadgeEnabled();
      this.activitiesIndividualRateSocialBadgeEnabled = store.activitiesIndividualRateSocialBadgeEnabled();
      this.activitiesPairRateSocialBadgeEnabled = store.activitiesPairRateSocialBadgeEnabled();
      this.activitiesView                = store.activitiesView() as ContractTypes.ActivitiesView;
      this.showActivitiesViewPicker      = store.activitiesShowViewPicker();
      this.showActivitiesSecondaryPicker = store.activitiesShowSecondaryPicker();
      this.activitiesStickyValue         = store.activitiesStickyValue();
      this.activitiesRatesFullscreenMode = store.activitiesRatesFullscreenMode();
      this.selectedActivityRateId        = store.activitiesSelectedRateId();
      this.syncActivitiesSmartListQuery();
      this.cdr.markForCheck();
    });

    effect(() => {
      this.userProfileStore.activeUserProfile();
      this.bumpActivitiesEventCardRevision();
      this.refreshSectionBadges();
      this.cdr.markForCheck();
    });

    effect(() => {
      const isOpen = this.activitiesStore.activitiesOpen();
      const primaryFilter = this.activitiesStore.activitiesPrimaryFilter();
      const contextKey = isOpen && primaryFilter === 'rates'
        ? 'activities.rates'
        : isOpen && primaryFilter === 'chats'
          ? 'chats'
          : isOpen && primaryFilter === 'events'
            ? 'events'
            : null;
      this.setActivitiesExplanationContext(contextKey);
    });

    effect(() => {
      const request = this.eventSubeventsStore.eventSubeventsListPopup();
      if (!request || request.host !== 'activities' || !this.activitiesStore.activitiesOpen()) {
        return;
      }
      void this.eventSubeventsStore.ensureEventSubeventsListPopupLoaded();
    });

    effect(() => {
      const patch = this.activitiesStore.eventChatRowPatch();
      if (!patch) {
        return;
      }
      untracked(() => {
        this.applyEventChatRowPatch(patch);
        this.patchActiveChatCounterFromRowPatch(patch);
        this.patchChatContextUnreadCountsFromRowPatch(patch);
        this.refreshSectionBadges();
        this.cdr.markForCheck();
      });
    });

    effect(() => {
      this.configureAdminSupportBoardPolling(
        this.activitiesStore.activitiesOpen() && this.activitiesStore.activitiesAdminServiceOnly()
      );
    });

    effect(() => {
      if (this.isEventActivitiesPrimaryFilter() && this.activitiesSecondaryFilter === 'relevant') {
        this.activitiesStore.setActivitiesSecondaryFilter('recent');
      }
    });

    // React to open events: reset scroll state whenever the popup is opened.
    effect(() => {
      const isOpen = this.activitiesStore.activitiesOpen();
      const openRevision = this.activitiesStore.activitiesOpenRevision();
      if (!isOpen) {
        this.lastHandledActivitiesOpenRevision = openRevision;
        return;
      }
      if (openRevision !== this.lastHandledActivitiesOpenRevision) {
        this.lastHandledActivitiesOpenRevision = openRevision;
        this.onActivitiesOpened();
      }
    });

    effect(() => {
      const sync = this.activitiesStore.activityEventSave();
      if (!sync) {
        return;
      }
      this.applyActivityEventSave(sync);
      this.cdr.markForCheck();
    });

    effect(() => {
      this.eventCheckoutDraftStore.drafts();
      const nextPendingDraftSourceIds = this.pendingCheckoutDraftSourceIds();
      const hadPendingDraftRemoval = [...this.lastPendingCheckoutDraftSourceIds]
        .some(sourceId => !nextPendingDraftSourceIds.has(sourceId));
      const hasNewPendingDraft = [...nextPendingDraftSourceIds]
        .some(sourceId => !this.lastPendingCheckoutDraftSourceIds.has(sourceId));
      this.lastPendingCheckoutDraftSourceIds = nextPendingDraftSourceIds;
      this.refreshSectionBadges();
      const shouldReloadEventList = this.activitiesStore.activitiesOpen()
        && (hadPendingDraftRemoval || hasNewPendingDraft)
        && this.activitiesPrimaryFilter === 'events'
        && this.activitiesEventScope !== 'pending'
        && this.activitiesEventScope !== 'invitations';
      if (shouldReloadEventList) {
        this.activitiesSmartList?.reload();
      }
      this.cdr.markForCheck();
    });

    effect(() => {
      const sync = this.activityStore.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      if (this.eventEditorStore.isOpen()) {
        return;
      }
      this.applyActivityMembersSyncState(sync);
      this.cdr.markForCheck();
    });

    effect(() => {
      this.assetStore.assetListRevision();
      this.cdr.markForCheck();
    });

  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (!this.activitiesStore.activitiesOpen()) {
      return;
    }
    if (this.dialogStore.dialog()) {
      return;
    }
    if (this.eventEditorStore.isOpen()) {
      return;
    }
    event.stopPropagation();
    this.closeActivitiesPopup();
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncMobileViewFromViewport();
  }

  /** Called once each time the service opens the popup. */
  private onActivitiesOpened(): void {
    this.resetActivitiesStateForOpen();
    this.invalidateChatContextUnreadCounts();
    this.activitiesRates.clearEditorState();
    this.resetActivitiesScroll();
  }

  private resetActivitiesStateForOpen(): void {
    this.activitiesSmartList?.replaceVisibleItems([], { total: 0 });
    this.activitiesStickyValue = '';
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
  }

  ngOnDestroy(): void {
    this.activitiesRates.clearEditorState();
    this.activitiesSmartList?.clearHostedLoading();
    this.configureAdminSupportBoardPolling(false);
    this.clearActivitiesExplanationContext();
  }

  private setActivitiesExplanationContext(contextKey: string | null): void {
    if (this.activitiesExplanationContextKey === contextKey) {
      return;
    }
    this.clearActivitiesExplanationContext();
    if (!contextKey) {
      return;
    }
    this.activitiesExplanationContextKey = contextKey;
    this.unregisterActivitiesExplanationContext = this.explanationGuide.registerContext(contextKey);
  }

  private clearActivitiesExplanationContext(): void {
    this.unregisterActivitiesExplanationContext?.();
    this.unregisterActivitiesExplanationContext = null;
    this.activitiesExplanationContextKey = null;
  }

  private createFallbackActiveUser(): UserDto {
    return {
      id: this.userProfileStore.activeUserId().trim(),
      name: 'Demo User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: 'DU',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
    };
  }

  private hydrateStandaloneFallbackState(): void {
    this.refreshSectionBadges();
  }

  private configureAdminSupportBoardPolling(enabled: boolean): void {
    if (!enabled) {
      this.stopAdminSupportBoardPoll?.();
      this.stopAdminSupportBoardPoll = null;
      this.adminSupportBoardPollInFlight = false;
      return;
    }
    if (this.stopAdminSupportBoardPoll) {
      return;
    }
    this.stopAdminSupportBoardPoll = this.activitiesService.startActivityChatsPoll(() => {
      void this.refreshAdminSupportBoardFromPoll();
    });
  }

  private async refreshAdminSupportBoardFromPoll(): Promise<void> {
    const canPoll = () =>
      this.activitiesStore.activitiesOpen()
      && this.isAdminServiceChatMode()
      && this.activitiesPrimaryFilter === 'chats'
      && !this.isCalendarLayoutView()
      && !this.dialogStore.dialog()
      && !this.activitiesStore.eventChatSession();
    const pollSignature = () => [
      this.activeUser?.id ?? '',
      this.activitiesView,
      this.activitiesSecondaryFilter,
      this.activitiesChatContextFilter,
      this.activitiesSupportCaseFilter
    ].join('|');

    if (this.adminSupportBoardPollInFlight || !canPoll()) {
      return;
    }
    const querySignature = pollSignature();
    const visibleLimit = Math.max(
      1,
      this.activitiesSmartList?.visibleItemCount() ?? 0,
      this.activitiesPageSize * 2
    );
    const currentFilters = this.activitiesSmartListQuery.filters ?? {};
    this.adminSupportBoardPollInFlight = true;
    try {
      const page = await this.activitiesService.loadActivityChats(
        {
          ...this.activitiesSmartListQuery,
          page: 0,
          pageSize: visibleLimit,
          cursor: undefined,
          view: this.activitiesView,
          filters: {
            ...currentFilters,
            primaryFilter: 'chats',
            secondaryFilter: this.activitiesSecondaryFilter,
            chatContextFilter: 'service',
            supportCaseFilter: this.activitiesSupportCaseFilter,
            adminServiceOnly: true
          }
        },
        { chatItems: this.chatsService.peekChatItemsByUser(this.activeUser.id) }
      );
      if (!canPoll() || querySignature !== pollSignature()) {
        return;
      }
      const items = Array.isArray(page.items)
        ? page.items.map(item => this.cloneChatRecord(item))
        : [];
      const total = Number.isFinite(page.total)
        ? Math.max(0, Math.trunc(Number(page.total)))
        : items.length;
      const smartList = this.activitiesSmartList;
      if (smartList?.syncVisibleItems(
        smartList.convertItems(items.slice(0, visibleLimit)),
        { total }
      )) {
        this.cdr.markForCheck();
      }
      this.refreshSectionBadges();
      this.cdr.markForCheck();
    } catch {
      // Keep the current board snapshot if the background poll is unavailable.
    } finally {
      this.adminSupportBoardPollInFlight = false;
    }
  }

  private applyEventChatRowPatch(patch: EventChatRowPatch): void {
    const smartList = this.activitiesSmartList;
    const chatId = `${patch.chatId ?? ''}`.trim();
    const ownerId = `${patch.ownerId ?? ''}`.trim();
    const channelType = `${patch.channelType ?? ''}`.trim();
    if (!smartList || (!chatId && !ownerId) || this.activitiesPrimaryFilter !== 'chats' || this.isCalendarLayoutView()) {
      return;
    }
    smartList.patchVisibleItem(
      row => this.matchesEventChatRowPatch(row as ActivityChatListItem, chatId, ownerId, channelType),
      row => this.patchActivityChatRow(row as ActivityChatListItem, patch) as ActivityListItem
    );
  }

  private matchesEventChatRowPatch(
    row: ActivityChatListItem,
    chatId: string,
    ownerId: string,
    channelType: string
  ): boolean {
    if (ownerId) {
      return `${row.ownerId ?? ''}`.trim() === ownerId
        && this.matchesEventChatRowChannelType(row, channelType);
    }
    return `${row.id ?? ''}`.trim() === chatId;
  }

  private matchesEventChatRowChannelType(row: ActivityChatListItem, channelType: string): boolean {
    if (!channelType) {
      return true;
    }
    const rowStatus = `${(row as { status?: unknown }).status ?? ''}`.trim();
    if (rowStatus === channelType) {
      return true;
    }
    return channelType === 'supportCase' && this.supportStatusFromRowStatus(rowStatus) !== null;
  }

  private patchActivityChatRow(row: ActivityChatListItem, patch: EventChatRowPatch): ActivityChatListItem {
    let next: ActivityChatListItem = row;
    const cloneNext = (): ActivityChatListItem => next === row ? { ...row } : next;

    if (patch.unread !== undefined) {
      const unread = this.normalizeBadgeCounter(patch.unread);
      if ((next.unread ?? 0) !== unread || ((next as { badgeCount?: number | null }).badgeCount ?? 0) !== unread) {
        next = cloneNext();
        next.unread = unread;
        (next as { badgeCount?: number | null }).badgeCount = unread;
      }
    }

    if (patch.lastMessage !== undefined) {
      const detail = `${patch.lastMessage ?? ''}`.trim();
      if ((next.detail ?? '') !== detail) {
        next = cloneNext();
        next.detail = detail;
      }
    }

    if (patch.dateIso !== undefined) {
      const dateIso = `${patch.dateIso ?? ''}`.trim() || undefined;
      if ((next.dateIso ?? undefined) !== dateIso) {
        next = cloneNext();
        next.dateIso = dateIso;
      }
    }

    if (patch.lastSenderId !== undefined) {
      const senderName = this.resolveActivityChatRowSenderName(patch.lastSenderId);
      if (senderName && next.title !== senderName) {
        next = cloneNext();
        next.title = senderName;
      }
    }

    return next;
  }

  private resolveActivityChatRowSenderName(senderId: string | null | undefined): string | null {
    const normalizedSenderId = `${senderId ?? ''}`.trim();
    if (!normalizedSenderId) {
      return null;
    }
    if (normalizedSenderId === this.activeUser.id) {
      return this.activeUser.name;
    }
    return this.usersService.peekCachedUserById(normalizedSenderId)?.name ?? null;
  }

  private doesChatMatchActiveContextFilter(chat: ChatDTO): boolean {
    if (this.activitiesChatContextFilter === 'all') {
      return this.doesChatMatchActiveSupportCaseFilter(chat);
    }
    return this.activitiesChats.activityChatContextFilterKey(chat) === this.activitiesChatContextFilter
      && this.doesChatMatchActiveSupportCaseFilter(chat);
  }

  protected isAdminServiceChatMode(): boolean {
    return this.activitiesStore.activitiesAdminServiceOnly();
  }

  protected activitiesPopupModel(): PopupModel<ActivitiesPopupMenuContext> {
    return {
      title: 'Activities',
      subtitle: this.activitiesHeaderLineOne(),
      secondarySubtitle: this.activitiesHeaderLineTwo(),
      ariaLabel: 'Activities',
      closeAriaLabel: 'Close activities',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.activitiesPopupHeaderControls(),
      toolbarControls: this.activitiesPopupToolbarControls(),
      onClose: () => this.closeActivitiesPopup(),
      onAction: event => this.onActivitiesPopupAction(event),
      onMenuSelect: event => this.onActivitiesPopupMenuSelect(event)
    };
  }

  private onActivitiesPopupAction(event: PopupActionEvent): void {
    switch (event.action.id) {
      case 'event-explore':
        this.requestOpenEventExplore();
        return;
      case 'rates-fullscreen-toggle':
        this.activitiesRates.toggleFullscreenMode(event.sourceEvent);
        return;
      default:
        return;
    }
  }

  private onActivitiesPopupMenuSelect(event: PopupMenuSelectEvent<ActivitiesPopupMenuContext>): void {
    const context = event.itemSelect.context;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'primary':
        this.selectActivitiesPrimaryFilter(context.value);
        return;
      case 'event-scope':
        this.selectActivitiesEventScope(context.value);
        return;
      case 'chat-context':
        this.selectActivitiesChatContextFilter(context.value);
        return;
      case 'rate':
        this.selectActivitiesRateFilter(context.value);
        return;
      case 'rate-social':
        this.toggleRateSocialBadgeForGroup(context.value);
        return;
      case 'secondary':
        this.selectActivitiesSecondaryFilter(context.value);
        return;
      case 'view':
        this.setActivitiesView(context.value, event.itemSelect.sourceEvent);
        return;
      case 'support-case':
        this.selectActivitiesSupportCaseFilter(context.value);
        return;
      case 'quick-action':
        if (context.value === 'explore') {
          this.requestOpenEventExplore();
          return;
        }
        this.requestOpenEventEditor();
        return;
      default:
        return;
    }
  }

  private activitiesPopupHeaderControls(): PopupControl<ActivitiesPopupMenuContext>[] {
    const controls: PopupControl<ActivitiesPopupMenuContext>[] = [];
    if (this.activitiesPrimaryFilter === 'chats' && this.isAdminServiceChatMode()) {
      controls.push({
        kind: 'menu',
        id: 'support-case',
        trigger: this.activitiesSupportCaseMenuTrigger(),
        items: this.activitiesSupportCaseMenuItems()
      });
    }
    if (!this.isCalendarLayoutView() && this.activitiesPrimaryFilter !== 'chats') {
      controls.push({
        kind: 'menu',
        id: 'secondary',
        trigger: this.activitiesSecondaryMenuTrigger(),
        items: this.activitiesSecondaryMenuItems()
      });
    }
    if (this.activitiesPrimaryFilter !== 'chats') {
      controls.push({
        kind: 'menu',
        id: 'view',
        trigger: this.activitiesViewMenuTrigger(),
        items: this.activitiesViewMenuItems()
      });
    }
    return controls;
  }

  private activitiesPopupToolbarControls(): PopupControl<ActivitiesPopupMenuContext>[] {
    const controls: PopupControl<ActivitiesPopupMenuContext>[] = [];
    if (!this.isAdminServiceChatMode()) {
      controls.push({
        kind: 'menu',
        id: 'primary',
        trigger: this.activitiesPrimaryMenuTrigger(),
        items: this.activitiesPrimaryMenuItems()
      });
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      controls.push({
        kind: 'menu',
        id: 'event-scope',
        trigger: this.activitiesEventScopeMenuTrigger(),
        items: this.activitiesEventScopeMenuItems()
      });
    }
    if (this.activitiesPrimaryFilter === 'chats' && !this.isAdminServiceChatMode()) {
      controls.push({
        kind: 'menu',
        id: 'chat-context',
        trigger: this.activitiesChatContextMenuTrigger(),
        items: this.activitiesChatContextMenuItems()
      });
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      controls.push({
        kind: 'menu',
        id: 'rate',
        trigger: this.activitiesRateMenuTrigger(),
        model: this.activitiesRateMenuModel()
      });
    }
    if (this.shouldShowStandaloneEventExploreAction()) {
      controls.push({
        id: 'event-explore',
        align: 'end',
        icon: 'explore',
        label: 'Explore',
        ariaLabel: 'Open event explore',
        palette: 'violet',
        compactOnMobile: true
      });
    }
    if (this.shouldShowRatesFullscreenToggle()) {
      controls.push({
        id: 'rates-fullscreen-toggle',
        align: 'end',
        icon: this.isRatesFullscreenModeActive() ? 'fullscreen_exit' : 'fullscreen',
        ariaLabel: this.isRatesFullscreenModeActive() ? 'Exit rates fullscreen mode' : 'Open rates fullscreen mode',
        palette: this.isRatesFullscreenModeActive() ? 'blue' : 'gold',
        active: this.isRatesFullscreenModeActive()
      });
    }
    if (this.shouldShowActivitiesQuickActions()) {
      controls.push({
        kind: 'menu',
        id: 'quick-actions',
        align: 'end',
        trigger: this.activitiesQuickActionsMenuTrigger(),
        items: this.activitiesQuickActionsMenuItems(),
        panelAlign: 'end'
      });
    }
    return controls;
  }

  private activitiesHeaderLineOne(): string {
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      const group = this.rateGroupLabelKeyForKey(this.activitiesRateFilter);
      const label = this.rateFilterLabelForKey(this.activitiesRateFilter);
      return `${group} · ${label}`;
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      if (this.isCalendarLayoutView()) {
        return `Events · ${this.activitiesEventScopeLabel()}`;
      }
      return this.activitiesEventScopeLabel();
    }
    if (this.isCalendarLayoutView()) {
      return this.activitiesPrimaryFilterLabel();
    }
    return `${this.activitiesPrimaryFilterLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
  }

  private activitiesHeaderLineTwo(): string {
    return '';
  }

  private activitiesSupportCaseMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.supportCaseFilterLabelKey(),
      icon: this.supportCaseFilterIcon(),
      palette: this.supportCasePalette(this.activitiesSupportCaseFilter),
      counter: this.supportCaseFilterCount(this.activitiesSupportCaseFilter),
      layout: 'pill'
    });
  }

  private activitiesSupportCaseMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return this.activitiesSupportCaseFilters().map(option => this.activitiesMenuItem({
      id: `support-case:${option.key}`,
      label: option.labelKey,
      icon: option.icon,
      palette: this.supportCasePalette(option.key),
      counter: this.supportCaseFilterCount(option.key),
      active: option.key === this.activitiesSupportCaseFilter,
      context: { menu: 'support-case', value: option.key }
    }));
  }

  private activitiesPrimaryMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesPrimaryFilterLabel(),
      icon: this.activitiesPrimaryFilterIcon(),
      palette: this.activitiesPrimaryPalette(this.activitiesPrimaryFilter),
      counter: this.activitiesPrimaryFilterCount(this.activitiesPrimaryFilter)
    });
  }

  private activitiesPrimaryMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return this.activitiesPrimaryFilters().map(option => this.activitiesMenuItem({
      id: `primary:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesPrimaryPalette(option.key),
      counter: this.activitiesPrimaryFilterCount(option.key),
      active: option.key === this.activitiesPrimaryFilter,
      context: { menu: 'primary', value: option.key }
    }));
  }

  private activitiesEventScopeMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesEventScopeLabel(),
      icon: this.activitiesEventScopeIcon(),
      palette: this.activitiesEventScopePalette(this.activitiesEventScope),
      counter: this.activitiesEventScopeCount(this.activitiesEventScope)
    });
  }

  private activitiesEventScopeMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return this.activitiesEventScopeFilters().map(option => this.activitiesMenuItem({
      id: `event-scope:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesEventScopePalette(option.key),
      counter: this.activitiesEventScopeCount(option.key),
      active: option.key === this.activitiesEventScope,
      context: { menu: 'event-scope', value: option.key }
    }));
  }

  private activitiesChatContextMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesChatContextFilterLabel(),
      icon: this.activitiesChatContextFilterIcon(),
      palette: this.activitiesChatContextPalette(this.activitiesChatContextFilter),
      counter: this.activitiesChatContextFilterCount(this.activitiesChatContextFilter)
    });
  }

  private activitiesChatContextMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return APP_STATIC_DATA.activitiesChatContextFilters.map(option => this.activitiesMenuItem({
      id: `chat-context:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesChatContextPalette(option.key),
      counter: this.activitiesChatContextFilterCount(option.key),
      active: option.key === this.activitiesChatContextFilter,
      context: { menu: 'chat-context', value: option.key }
    }));
  }

  private activitiesRateMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesRateFilterLabel(),
      icon: this.activitiesRateFilterIcon(this.activitiesRateFilter),
      palette: this.activitiesRatePalette(this.activitiesRateFilter),
      counter: this.rateFilterCount(this.activitiesRateFilter)
    });
  }

  private activitiesRateMenuModel(): AppMenuModel<string, ActivitiesPopupMenuContext> {
    type RateMenuNode = Omit<AppMenuGroup<string, ActivitiesPopupMenuContext>, 'items' | 'headerActions'> & {
      items: AppMenuItem<string, ActivitiesPopupMenuContext>[];
      headerActions?: AppMenuItem<string, ActivitiesPopupMenuContext>[];
    };
    const nodes: RateMenuNode[] = [];
    let currentNode: RateMenuNode | null = null;
    for (const option of APP_STATIC_DATA.rateFilterEntries as RateFilterEntry[]) {
      if (option.kind === 'group') {
        const groupLabel = option.label;
        const groupPalette = this.activitiesRateGroupPalette(groupLabel);
        currentNode = {
          id: `rate-group:${groupLabel}`,
          label: this.rateGroupOptionLabelKey(groupLabel),
          icon: this.rateSocialBadgeGroupIconForGroup(groupLabel),
          palette: groupPalette,
          items: [],
          headerActions: this.shouldShowRateSocialBadgeToggleForGroup(groupLabel)
            ? [{
              id: `rate-social:${groupLabel}`,
              label: this.rateSocialBadgeButtonLabelForGroup(groupLabel),
              icon: this.rateSocialBadgeToggleIconForGroup(groupLabel),
              kind: 'toggle',
              active: this.isRateSocialBadgeToggleActiveForGroup(groupLabel),
              closeOnSelect: false,
              palette: groupPalette,
              context: { menu: 'rate-social', value: groupLabel }
            }]
            : []
        };
        nodes.push(currentNode);
        continue;
      }
      if (!currentNode) {
        currentNode = {
          id: 'rate-group:default',
          label: 'rate.type',
          icon: 'list',
          palette: 'gold',
          items: []
        };
        nodes.push(currentNode);
      }
      currentNode.items.push(this.activitiesMenuItem({
        id: `rate:${option.key}`,
        label: this.rateFilterOptionLabel(option.key),
        icon: this.activitiesRateFilterIcon(option.key),
        palette: this.activitiesRatePalette(option.key),
        counter: this.rateFilterCount(option.key),
        active: option.key === this.activitiesRateFilter,
        context: { menu: 'rate', value: option.key }
      }));
    }
    return { nodes };
  }

  private activitiesSecondaryMenuTrigger(): AppMenuTrigger {
    const filter = this.effectiveActivitiesSecondaryFilter();
    return this.activitiesSelectTrigger({
      label: this.activitiesSecondaryFilterLabel(),
      icon: this.activitiesSecondaryFilterIcon(),
      palette: this.activitiesSecondaryPalette(filter),
      layout: 'pill',
      hideLabel: this.isMobileView
    });
  }

  private activitiesSecondaryMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return this.availableActivitiesSecondaryFilters().map(option => this.activitiesMenuItem({
      id: `secondary:${option.key}`,
      label: this.activitiesSecondaryFilterOptionLabel(option.key),
      icon: option.icon,
      palette: this.activitiesSecondaryPalette(option.key),
      active: option.key === this.effectiveActivitiesSecondaryFilter(),
      context: { menu: 'secondary', value: option.key }
    }));
  }

  private activitiesViewMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activityViewLabel(),
      icon: APP_STATIC_DATA.activitiesViewOptions.find(option => option.key === this.activitiesView)?.icon ?? 'view_agenda',
      palette: this.activitiesViewPalette(this.activitiesView),
      layout: 'pill',
      hideLabel: this.isMobileView
    });
  }

  private activitiesViewMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return APP_STATIC_DATA.activitiesViewOptions.map(option => this.activitiesMenuItem({
      id: `view:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesViewPalette(option.key),
      active: option.key === this.activitiesView,
      context: { menu: 'view', value: option.key }
    }));
  }

  private activitiesQuickActionsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      ariaLabel: 'Open event actions',
      hideLabel: true,
      layout: 'icon',
      palette: 'green'
    };
  }

  private activitiesQuickActionsMenuItems(): readonly AppMenuItem<string, ActivitiesPopupMenuContext>[] {
    return [
      {
        id: 'quick-action:explore',
        label: 'Explore',
        icon: 'explore',
        palette: 'violet',
        surface: 'tinted',
        context: { menu: 'quick-action', value: 'explore' }
      },
      {
        id: 'quick-action:create',
        label: 'Create Event',
        icon: 'add_circle',
        palette: 'green',
        surface: 'tinted',
        context: { menu: 'quick-action', value: 'create' }
      }
    ];
  }

  private shouldShowStandaloneEventExploreAction(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && (this.activitiesEventScope === 'all' || this.activitiesEventScope === 'active-events');
  }

  private activitiesSupportCaseFilters(): Array<{ key: ContractTypes.SupportCaseFilter; labelKey: string; icon: string }> {
    return [
      { key: 'all', labelKey: 'activities.support.case.filter.all', icon: 'list' },
      { key: 'pending', labelKey: 'activities.support.case.filter.pending', icon: 'pending_actions' },
      { key: 'picked', labelKey: 'activities.support.case.filter.picked', icon: 'assignment_ind' },
      { key: 'solved', labelKey: 'activities.support.case.filter.solved', icon: 'check_circle' },
      { key: 'blocked', labelKey: 'activities.support.case.filter.blocked', icon: 'block' }
    ];
  }

  private activitiesPrimaryFilters(): Array<{ key: ContractTypes.ActivitiesPrimaryFilter; label: string; icon: string }> {
    return [
      { key: 'rates', label: 'Rates', icon: 'star' },
      { key: 'chats', label: 'Chats', icon: 'chat' },
      { key: 'events', label: 'Events', icon: 'event' }
    ];
  }

  private activitiesEventScopeFilters(): ReadonlyArray<{ key: ContractTypes.ActivitiesEventScope; label: string; icon: string }> {
    return [
      { key: 'all', label: 'All', icon: 'widgets' },
      { key: 'active-events', label: 'Active Events', icon: 'event' },
      { key: 'pending', label: 'Pending', icon: 'pending_actions' },
      { key: 'invitations', label: 'Invitations', icon: 'mail' },
      { key: 'my-events', label: 'My Events', icon: 'stadium' },
      { key: 'drafts', label: 'Drafts', icon: 'drafts' },
      { key: 'trash', label: 'Trash', icon: 'delete' }
    ];
  }

  private supportCaseFilterLabelKey(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): string {
    return this.activitiesSupportCaseFilters().find(option => option.key === filter)?.labelKey ?? 'activities.support.case.filter.all';
  }

  private supportCaseFilterIcon(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): string {
    return this.activitiesSupportCaseFilters().find(option => option.key === filter)?.icon ?? 'list';
  }

  private activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters().find(option => option.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }

  private activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters().find(option => option.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }

  private activitiesPrimaryFilterCount(filter: ContractTypes.ActivitiesPrimaryFilter): number {
    return this.countFrom(this.activitiesToolbarPrimaryCounts(), filter);
  }

  private activitiesEventScopeIcon(): string {
    return this.activitiesEventScopeFilters().find(option => option.key === this.activitiesEventScope)?.icon ?? 'event';
  }

  private activitiesEventScopeCount(scope: ContractTypes.ActivitiesEventScope = this.activitiesEventScope): number {
    return this.countFrom(this.activitiesToolbarEventScopeCounts(), scope);
  }

  private activitiesChatContextFilterLabel(): string {
    return APP_STATIC_DATA.activitiesChatContextFilters.find(option => option.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }

  private activitiesChatContextFilterIcon(): string {
    return APP_STATIC_DATA.activitiesChatContextFilters.find(option => option.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }

  private activitiesChatsHeaderLabel(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.activitiesChatContextFilter === 'all') {
      return primary;
    }
    return `${primary} · ${this.activitiesChatContextFilterLabel()}`;
  }

  private activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.effectiveActivitiesSecondaryFilter());
  }

  private activitiesSecondaryFilterOptionLabel(filter: ContractTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return APP_STATIC_DATA.activitiesSecondaryFilters.find(option => option.key === filter)?.label ?? 'Relevant';
  }

  private activitiesSecondaryFilterIcon(): string {
    return APP_STATIC_DATA.activitiesSecondaryFilters.find(option => option.key === this.effectiveActivitiesSecondaryFilter())?.icon ?? 'schedule';
  }

  private activitiesRateFilterLabel(): string {
    const label = this.rateFilterLabelForKey(this.activitiesRateFilter);
    if (!label) {
      return `${this.rateGroupLabelKeyForKey('individual-given')} · Given`;
    }
    const group = this.rateGroupLabelKeyForKey(this.activitiesRateFilter);
    return `${group} · ${label}`;
  }

  private rateFilterOptionLabel(key: ContractTypes.RateFilterKey): string {
    return this.rateFilterLabelForKey(key);
  }

  private rateGroupOptionLabelKey(label: string): string {
    const normalized = label.trim().toLowerCase();
    if (normalized === 'preferences') {
      return 'activity.rates.group.preferences';
    }
    if (normalized === 'suggestions') {
      return 'activity.rates.group.suggestions';
    }
    return label;
  }

  private activitiesRateFilterIcon(key: ContractTypes.RateFilterKey = this.activitiesRateFilter): string {
    const icons: Record<ContractTypes.RateFilterKey, string> = {
      'individual-given': 'north_east',
      'individual-received': 'south_west',
      'individual-mutual': 'sync_alt',
      'individual-met': 'handshake',
      'pair-given': 'group_add',
      'pair-received': 'groups_2'
    };
    return icons[key] ?? 'star';
  }

  private shouldShowRateSocialBadgeToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  private shouldShowRateSocialBadgeToggleForGroup(label: string): boolean {
    if (!this.shouldShowRateSocialBadgeToggle()) {
      return false;
    }
    const normalized = label.trim().toLowerCase();
    return normalized === 'individual'
      || normalized === 'pair'
      || normalized === 'preferences'
      || normalized === 'suggestions'
      || normalized === this.rateGroupLabelKeyForKey('individual-given')
      || normalized === this.rateGroupLabelKeyForKey('pair-given');
  }

  private rateSocialBadgeButtonLabelForGroup(label: string): string {
    return this.isRateSocialBadgeToggleActiveForGroup(label) ? 'Social on' : 'Social off';
  }

  private rateSocialBadgeToggleIconForGroup(label: string): string {
    return this.isRateSocialBadgeToggleActiveForGroup(label) ? 'sell' : 'sell_off';
  }

  private rateSocialBadgeGroupIconForGroup(label: string): string {
    return this.rateSocialGroupForLabel(label) === 'pair' ? 'groups_2' : 'person';
  }

  private isRateSocialBadgeToggleActiveForGroup(label: string): boolean {
    const group = this.rateSocialGroupForLabel(label);
    return group === 'pair'
      ? this.activitiesPairRateSocialBadgeEnabled
      : this.activitiesIndividualRateSocialBadgeEnabled;
  }

  private rateFilterLabelForKey(key: ContractTypes.RateFilterKey): string {
    return APP_STATIC_DATA.rateFilters.find(option => option.key === key)?.label ?? 'Given';
  }

  private rateGroupLabelKeyForKey(key: ContractTypes.RateFilterKey): string {
    return key.startsWith('individual')
      ? 'activity.rates.group.preferences'
      : 'activity.rates.group.suggestions';
  }

  private activityViewLabel(): string {
    return APP_STATIC_DATA.activitiesViewOptions.find(option => option.key === this.activitiesView)?.label ?? 'View';
  }

  private availableActivitiesSecondaryFilters(): ReadonlyArray<{ key: ContractTypes.ActivitiesSecondaryFilter; label: string; icon: string }> {
    return this.isEventActivitiesPrimaryFilter()
      ? APP_STATIC_DATA.activitiesSecondaryFilters.filter(option => option.key !== 'relevant')
      : APP_STATIC_DATA.activitiesSecondaryFilters;
  }

  private activitiesSelectTrigger(options: {
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    layout?: AppMenuTrigger['layout'];
    hideLabel?: boolean;
  }): AppMenuTrigger {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      layout: options.layout ?? 'pill',
      hideLabel: options.hideLabel,
      counter: counter > 0 ? { value: counter, max: 99 } : null
    };
  }

  private activitiesMenuItem(options: {
    id: string;
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    active: boolean;
    context: ActivitiesPopupMenuContext;
  }): AppMenuItem<string, ActivitiesPopupMenuContext> {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      id: options.id,
      label: options.label,
      icon: options.icon,
      kind: 'radio',
      active: options.active,
      palette: options.palette,
      surface: 'tinted',
      counter: counter > 0 ? { value: counter, max: 99 } : null,
      context: options.context
    };
  }

  private activitiesPrimaryPalette(filter: ContractTypes.ActivitiesPrimaryFilter): AppMenuPalette {
    switch (filter) {
      case 'rates':
        return 'gold';
      case 'events':
        return 'orange';
      case 'hosting':
        return 'green';
      case 'invitations':
        return 'violet';
      case 'chats':
      default:
        return 'blue';
    }
  }

  private activitiesEventScopePalette(scope: ContractTypes.ActivitiesEventScope): AppMenuPalette {
    switch (scope) {
      case 'trash':
        return 'danger';
      case 'drafts':
        return 'slate';
      case 'invitations':
        return 'violet';
      case 'my-events':
        return 'green';
      case 'pending':
        return 'amber';
      case 'all':
        return 'blue';
      case 'active-events':
      default:
        return 'orange';
    }
  }

  private activitiesChatContextPalette(filter: ContractTypes.ActivitiesChatContextFilter): AppMenuPalette {
    switch (filter) {
      case 'event':
        return 'orange';
      case 'subEvent':
        return 'violet';
      case 'group':
        return 'green';
      case 'service':
        return 'slate';
      case 'appSupport':
        return 'blue';
      case 'all':
      default:
        return 'blue';
    }
  }

  private activitiesViewPalette(view: ContractTypes.ActivitiesView): AppMenuPalette {
    switch (view) {
      case 'distance':
        return 'teal';
      case 'month':
        return 'gold';
      case 'week':
        return 'green';
      case 'day':
      default:
        return 'blue';
    }
  }

  private activitiesSecondaryPalette(filter: ContractTypes.ActivitiesSecondaryFilter): AppMenuPalette {
    switch (filter) {
      case 'past':
        return 'slate';
      case 'relevant':
        return 'violet';
      case 'recent':
      default:
        return 'blue';
    }
  }

  private activitiesRatePalette(filter: ContractTypes.RateFilterKey): AppMenuPalette {
    switch (filter) {
      case 'individual-given':
        return 'pink';
      case 'individual-received':
        return 'blue';
      case 'individual-mutual':
        return 'violet';
      case 'individual-met':
        return 'green';
      case 'pair-given':
        return 'brown';
      case 'pair-received':
      default:
        return 'success';
    }
  }

  private supportCasePalette(filter: ContractTypes.SupportCaseFilter): AppMenuPalette {
    switch (filter) {
      case 'pending':
        return 'amber';
      case 'picked':
        return 'blue';
      case 'solved':
        return 'green';
      case 'blocked':
        return 'danger';
      case 'all':
      default:
        return 'neutral';
    }
  }

  private activitiesRateGroupPalette(label: string): AppMenuPalette {
    return this.rateSocialGroupForLabel(label) === 'pair' ? 'violet' : 'blue';
  }

  private countFrom<T extends string>(counts: Partial<Record<T, number>>, key: T): number {
    const value = Number(counts[key] ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(value));
  }

  protected activitiesToolbarPrimaryCounts(): Partial<Record<ContractTypes.ActivitiesPrimaryFilter, number>> {
    return {
      chats: this.chatBadge,
      events: this.eventsBadge,
      rates: this.gameBadge
    };
  }

  protected activitiesToolbarEventScopeCounts(): Partial<Record<ContractTypes.ActivitiesEventScope, number>> {
    return {
      all: this.allEventsScopeBadge,
      'active-events': this.eventsBadge,
      pending: this.pendingBadge,
      invitations: this.invitationsBadge,
      'my-events': this.hostingBadge,
      drafts: this.draftsBadge,
      trash: this.trashBadge
    };
  }

  protected activitiesToolbarChatContextCounts(): Partial<Record<ContractTypes.ActivitiesChatContextFilter, number>> {
    return this.chatContextUnreadCountsForActiveUser();
  }

  protected activitiesToolbarSupportCaseCounts(): Partial<Record<ContractTypes.SupportCaseFilter, number>> {
    return {
      all: this.supportCaseFilterCount('all'),
      pending: this.supportCaseFilterCount('pending'),
      picked: this.supportCaseFilterCount('picked'),
      solved: this.supportCaseFilterCount('solved'),
      blocked: this.supportCaseFilterCount('blocked')
    };
  }

  protected activitiesToolbarRateFilterCounts(): Partial<Record<ContractTypes.RateFilterKey, number>> {
    return APP_STATIC_DATA.rateFilters.reduce<Partial<Record<ContractTypes.RateFilterKey, number>>>((counts, option) => {
      counts[option.key] = this.rateFilterCount(option.key);
      return counts;
    }, {});
  }

  private activitiesChatContextFilterCount(filter: ContractTypes.ActivitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return 0;
    }
    return this.normalizeBadgeCounter(this.chatContextUnreadCountsForActiveUser()[filter]);
  }

  private chatContextUnreadCountsForActiveUser(): ActivitiesChatContextUnreadCounts {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return this.emptyChatContextUnreadCounts();
    }
    const activeUserId = `${this.activeUser.id ?? ''}`.trim();
    if (this.chatContextUnreadCounts && this.chatContextUnreadCountsUserId === activeUserId) {
      return this.chatContextUnreadCounts;
    }
    const counts = this.emptyChatContextUnreadCounts();
    for (const item of this.chatItemsForActivities()) {
      const unread = this.normalizeBadgeCounter(item.unread);
      if (unread <= 0) {
        continue;
      }
      counts.all = this.normalizeBadgeCounter((counts.all ?? 0) + unread);
      const context = this.activityChatContextFilterKey(item);
      if (context && context !== 'all') {
        counts[context] = this.normalizeBadgeCounter((counts[context] ?? 0) + unread);
      }
    }
    this.chatContextUnreadCountsUserId = activeUserId;
    this.chatContextUnreadCounts = counts;
    return counts;
  }

  private patchChatContextUnreadCountsFromRowPatch(patch: EventChatRowPatch): void {
    if (patch.unreadDelta === undefined || patch.unreadDelta === null || !this.chatContextUnreadCounts) {
      return;
    }
    if (this.chatContextUnreadCountsUserId !== `${this.activeUser.id ?? ''}`.trim()) {
      this.invalidateChatContextUnreadCounts();
      return;
    }
    const unreadDelta = Number(patch.unreadDelta);
    if (!Number.isFinite(unreadDelta) || unreadDelta === 0) {
      return;
    }
    const next = { ...this.chatContextUnreadCounts };
    next.all = this.normalizeBadgeCounter((next.all ?? 0) + unreadDelta);
    const context = this.activitiesChats.activityChatContextFilterKeyFromChannelType(patch.channelType);
    if (context && context !== 'all') {
      next[context] = this.normalizeBadgeCounter((next[context] ?? 0) + unreadDelta);
    }
    this.chatContextUnreadCounts = next;
  }

  private patchActiveChatCounterFromRowPatch(patch: EventChatRowPatch): void {
    if (patch.unreadDelta === undefined || patch.unreadDelta === null) {
      return;
    }
    const unreadDelta = Number(patch.unreadDelta);
    if (!Number.isFinite(unreadDelta) || unreadDelta === 0) {
      return;
    }
    const activeUser = this.userProfileStore.activeUserProfile();
    const activeUserId = `${activeUser?.id ?? ''}`.trim();
    if (!activeUserId) {
      return;
    }
    const overrides = this.activityStore.getUserCounterOverrides(activeUserId);
    const currentChatCounter = this.normalizeBadgeCounter(overrides.chat ?? activeUser?.activities?.chat);
    const nextChatCounter = this.normalizeBadgeCounter(currentChatCounter + unreadDelta);
    this.activityStore.patchUserCounterOverrides(activeUserId, { chat: nextChatCounter });
    this.userProfileStore.patchUserActivityCounters(activeUserId, { chat: nextChatCounter });
  }

  private invalidateChatContextUnreadCounts(): void {
    this.chatContextUnreadCounts = null;
  }

  private emptyChatContextUnreadCounts(): ActivitiesChatContextUnreadCounts {
    return {
      all: 0,
      event: 0,
      subEvent: 0,
      group: 0,
      service: 0,
      appSupport: 0
    };
  }

  private supportCaseFilterCount(filter: ContractTypes.SupportCaseFilter): number {
    const normalized = this.normalizeSupportCaseFilter(filter);
    const supportCases = this.chatsService.peekChatItemsByUser(this.activeUser.id).filter(chat => Boolean(chat.supportCase));
    if (normalized === 'all') {
      return supportCases.length;
    }
    return supportCases.filter(chat => this.normalizeSupportCaseFilter(chat.supportCase?.status ?? null) === normalized).length;
  }

  protected selectActivitiesSupportCaseFilter(filter: ContractTypes.SupportCaseFilter): void {
    if (!this.isAdminServiceChatMode()) {
      return;
    }
    this.activitiesStore.setActivitiesSupportCaseFilter(filter);
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  private normalizeSupportCaseFilter(filter: ContractTypes.SupportCaseFilter | ContractTypes.SupportCaseStatus | null | undefined): ContractTypes.SupportCaseFilter {
    return filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
  }

  private doesChatMatchActiveSupportCaseFilter(chat: ChatDTO): boolean {
    if (!this.isAdminServiceChatMode()) {
      return true;
    }
    const normalized = this.normalizeSupportCaseFilter(this.activitiesSupportCaseFilter);
    return normalized === 'all' || this.normalizeSupportCaseFilter(chat.supportCase?.status ?? null) === normalized;
  }

  protected onSupportCaseAction(row: ActivityListItem, action: ContractTypes.SupportCaseAction): void {
    if (!this.isAdminServiceChatMode()) {
      return;
    }
    const chat = this.chatRecordForRow(row);
    if (!chat?.supportCase) {
      return;
    }
    const config = this.supportCaseActionDialogConfig(action);
    this.dialogStore.open({
      title: this.i18n(config.titleKey),
      message: this.i18n(config.messageKey),
      cancelLabel: this.i18n('cancel'),
      confirmLabel: this.i18n(config.confirmLabelKey),
      busyConfirmLabel: this.i18n(config.busyConfirmLabelKey),
      confirmTone: config.tone,
      failureMessage: this.i18n('activities.support.case.error.update'),
      onConfirm: async () => {
        const updated = await this.chatsService.updateSupportCase(chat, action);
        if (!updated) {
          throw new Error('The support case could not be updated.');
        }
        this.applySupportCaseUpdate(updated);
      }
    });
  }

  private supportCaseActionDialogConfig(action: ContractTypes.SupportCaseAction): {
    titleKey: string;
    messageKey: string;
    confirmLabelKey: string;
    busyConfirmLabelKey: string;
    tone: 'accent' | 'danger' | 'neutral';
  } {
    if (action === 'pick') {
      return {
        titleKey: 'activities.support.case.confirm.pick.title',
        messageKey: 'activities.support.case.confirm.pick.message',
        confirmLabelKey: 'activities.support.case.action.pick',
        busyConfirmLabelKey: 'activities.support.case.action.pick.busy',
        tone: 'accent'
      };
    }
    if (action === 'unpick') {
      return {
        titleKey: 'activities.support.case.confirm.unpick.title',
        messageKey: 'activities.support.case.confirm.unpick.message',
        confirmLabelKey: 'activities.support.case.action.unpick',
        busyConfirmLabelKey: 'activities.support.case.action.unpick.busy',
        tone: 'neutral'
      };
    }
    if (action === 'solve') {
      return {
        titleKey: 'activities.support.case.confirm.solve.title',
        messageKey: 'activities.support.case.confirm.solve.message',
        confirmLabelKey: 'activities.support.case.action.solve',
        busyConfirmLabelKey: 'activities.support.case.action.solve.busy',
        tone: 'accent'
      };
    }
    if (action === 'block') {
      return {
        titleKey: 'activities.support.case.confirm.block.title',
        messageKey: 'activities.support.case.confirm.block.message',
        confirmLabelKey: 'activities.support.case.action.block',
        busyConfirmLabelKey: 'activities.support.case.action.block.busy',
        tone: 'danger'
      };
    }
    return {
      titleKey: 'activities.support.case.confirm.reopen.title',
      messageKey: 'activities.support.case.confirm.reopen.message',
      confirmLabelKey: 'activities.support.case.action.reopen',
      busyConfirmLabelKey: 'activities.support.case.action.reopen.busy',
      tone: 'accent'
    };
  }

  private i18n(key: string): string {
    return this.i18nService.translate(key);
  }

  private applySupportCaseUpdate(chat: ChatDTO): void {
    const nextChat = this.cloneChatRecord(chat);

    const smartList = this.activitiesSmartList;
    if (smartList && this.activitiesPrimaryFilter === 'chats' && !this.isCalendarLayoutView()) {
      if (this.doesChatMatchActiveContextFilter(nextChat)) {
        smartList.patchConvertedVisibleItem(nextChat);
      } else {
        smartList.removeVisibleItemByIdentity(`chats:${nextChat.id}`);
      }
    }

    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private resolveActivityEventCardTypeFromDTO(dto: ActivityEventDTO): ActivityEventListType {
    if (dto.type === 'invitations') {
      return 'invitations';
    }
    if (this.activityEventDTOIsAdmin(dto)) {
      return 'hosting';
    }
    return dto.type === 'hosting' ? 'hosting' : 'events';
  }

  private convertActivitySmartListItem(
    source: unknown,
    query: ListQuery<ActivitiesSmartListFilters>
  ): ActivityListItem {
    const primaryFilter = query.filters?.primaryFilter ?? this.activitiesPrimaryFilter;
    if (primaryFilter === 'rates') {
      return ActivityRateImageCardConverter.convert(source as ActivityRateDTO, {
        ratedUsers: (query as ActivitiesSmartListConverterQuery).context?.rateUsers ?? []
      });
    }
    if (primaryFilter === 'events' || primaryFilter === 'hosting' || primaryFilter === 'invitations') {
      return ActivityEventInfoCardConverter.convert(source as ActivityEventDTO, {
        activeUserId: this.activeUser.id
      });
    }
    return ActivityChatSingleRowConverter.convert(source as ChatDTO, {
      activeUser: this.activeUser,
      adminServiceMode: query.filters?.adminServiceOnly === true,
      translate: key => this.i18nService.translate(key)
    });
  }

  private convertActivitySmartListItems(
    sources: readonly unknown[],
    query: ListQuery<ActivitiesSmartListFilters>
  ): ActivityListItem[] {
    const primaryFilter = query.filters?.primaryFilter ?? this.activitiesPrimaryFilter;
    if (primaryFilter === 'rates') {
      return ActivityRateImageCardConverter.convertList(sources as readonly ActivityRateDTO[], {
        ratedUsers: (query as ActivitiesSmartListConverterQuery).context?.rateUsers ?? []
      });
    }
    if (primaryFilter === 'events' || primaryFilter === 'hosting' || primaryFilter === 'invitations') {
      return ActivityEventInfoCardConverter.convertList(sources as readonly ActivityEventDTO[], {
        activeUserId: this.activeUser.id
      });
    }
    return ActivityChatSingleRowConverter.convertList(sources as readonly ChatDTO[], {
      activeUser: this.activeUser,
      adminServiceMode: query.filters?.adminServiceOnly === true,
      translate: key => this.i18nService.translate(key)
    });
  }

  private chatRowMetricScore(row: ActivityListItem): number {
    const chatRow = row as ActivityChatListItem;
    return Number.isFinite(chatRow.sortScore)
      ? Math.max(0, Number(chatRow.sortScore))
      : Math.max(0, Math.trunc(Number(chatRow.unread) || 0)) * 10
        + Math.max(0, Math.trunc(Number(chatRow.memberCount) || 0));
  }

  private cloneChatRecord<T extends ChatDTO>(chat: T): T {
    return {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])],
      members: (chat.members ?? []).map(member => ({ ...member })),
      supportCase: this.cloneChatSupportCase(chat.supportCase),
      metrics: this.cloneChatMetrics(chat.metrics)
    } as T;
  }

  protected chatRecordForRow(row: ActivityListItem): ChatDTO | null {
    const existing = this.chatsService.peekChatItemsByUser(this.activeUser.id).find(item => item.id === row.id) ?? null;
    return existing ? this.cloneChatRecord(existing) : null;
  }

  private chatRecordPreviewForRow(row: ActivityListItem): ChatDTO | null {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return null;
    }
    const chatRow = row as ActivityChatListItem;
    const status = `${(chatRow as { status?: unknown }).status ?? ''}`.trim();
    const supportStatus = this.supportStatusFromRowStatus(status);
    const channelType = supportStatus ? 'supportCase' : this.chatChannelTypeFromRowStatus(status);
    const activeUserId = `${this.activeUser?.id ?? ''}`.trim();
    const title = `${chatRow.subtitle ?? chatRow.title ?? ''}`.trim() || 'Chat';
    return {
      id: chatRow.id,
      avatar: `${chatRow.avatarInitials ?? ''}`.trim() || AppUtils.initialsFromText(title),
      title,
      lastMessage: `${chatRow.detail ?? ''}`.trim(),
      lastSenderId: activeUserId,
      memberIds: activeUserId ? [activeUserId] : [],
      unread: Math.max(0, Math.trunc(Number(chatRow.unread) || 0)),
      dateIso: chatRow.dateIso ?? undefined,
      distanceMetersExact: chatRow.distanceMetersExact ?? undefined,
      channelType,
      ownerId: `${chatRow.ownerId ?? ''}`.trim() || (supportStatus ? chatRow.id : undefined),
      supportCase: supportStatus
        ? {
          status: supportStatus,
          assignee: null,
          updatedAtIso: null
        }
        : null
    };
  }

  private chatChannelTypeFromRowStatus(status: string): ContractTypes.ChatChannelType | undefined {
    return status === 'general'
      || status === 'mainEvent'
      || status === 'optionalSubEvent'
      || status === 'groupSubEvent'
      || status === 'serviceEvent'
      || status === 'appSupport'
      || status === 'supportCase'
      ? status
      : undefined;
  }

  private supportStatusFromRowStatus(status: string): ContractTypes.SupportCaseStatus | null {
    return status === 'pending'
      || status === 'picked'
      || status === 'solved'
      || status === 'blocked'
      ? status
      : null;
  }

  private async resolveChatRecordForRow(
    row: ActivityListItem,
    options: { skipCache?: boolean } = {}
  ): Promise<ChatDTO | null> {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return null;
    }
    if (options.skipCache !== true) {
      const cached = this.chatRecordForRow(row);
      if (cached) {
        return cached;
      }
    }
    const userId = this.activeUser?.id?.trim();
    if (!userId) {
      return null;
    }
    const items = await this.chatsService.queryChatItemsByUser(userId);
    this.refreshSectionBadges();
    this.cdr.markForCheck();
    const resolved = items.find(item => item.id === row.id) ?? null;
    return resolved ? this.cloneChatRecord(resolved) : null;
  }

  private areChatRecordsEqual(left: ChatDTO, right: ChatDTO): boolean {
    const leftMemberIds = left.memberIds ?? [];
    const rightMemberIds = right.memberIds ?? [];
    if (
      left.id !== right.id
      || left.avatar !== right.avatar
      || left.title !== right.title
      || left.lastMessage !== right.lastMessage
      || left.lastSenderId !== right.lastSenderId
      || left.unread !== right.unread
      || left.dateIso !== right.dateIso
      || left.distanceKm !== right.distanceKm
      || left.distanceMetersExact !== right.distanceMetersExact
      || left.channelType !== right.channelType
      || left.ownerId !== right.ownerId
      || !this.areChatMetricsEqual(left.metrics, right.metrics)
      || !this.areChatSupportCasesEqual(left.supportCase, right.supportCase)
      || leftMemberIds.length !== rightMemberIds.length
    ) {
      return false;
    }
    return leftMemberIds.every((memberId, index) => memberId === rightMemberIds[index]);
  }

  private cloneChatSupportCase(
    supportCase: ContractTypes.ChatSupportCase | null | undefined
  ): ContractTypes.ChatSupportCase | null | undefined {
    if (!supportCase) {
      return supportCase;
    }
    return {
      ...supportCase,
      assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee
    };
  }

  private cloneChatMetrics(
    metrics: ContractTypes.ChatMetricsDTO | null | undefined
  ): ContractTypes.ChatMetricsDTO | null | undefined {
    return metrics
      ? {
        members: metrics.members ? { ...metrics.members } : null,
        car: metrics.car ? { ...metrics.car } : null,
        accommodation: metrics.accommodation ? { ...metrics.accommodation } : null,
        supplies: metrics.supplies ? { ...metrics.supplies } : null,
        groupsCount: metrics.groupsCount ?? null,
        pendingTotal: Math.max(0, Math.trunc(Number(metrics.pendingTotal) || 0))
      }
      : metrics;
  }

  private areChatMetricsEqual(
    left: ContractTypes.ChatMetricsDTO | null | undefined,
    right: ContractTypes.ChatMetricsDTO | null | undefined
  ): boolean {
    if (!left || !right) {
      return left === right;
    }
    return this.areChatMetricBucketsEqual(left.members, right.members)
      && this.areChatMetricBucketsEqual(left.car, right.car)
      && this.areChatMetricBucketsEqual(left.accommodation, right.accommodation)
      && this.areChatMetricBucketsEqual(left.supplies, right.supplies)
      && (left.groupsCount ?? null) === (right.groupsCount ?? null)
      && left.pendingTotal === right.pendingTotal;
  }

  private areChatMetricBucketsEqual(
    left: ContractTypes.ChatMetricBucketDTO | null | undefined,
    right: ContractTypes.ChatMetricBucketDTO | null | undefined
  ): boolean {
    if (!left || !right) {
      return left === right;
    }
    return left.accepted === right.accepted
      && left.pending === right.pending
      && left.capacityMin === right.capacityMin
      && left.capacityMax === right.capacityMax;
  }

  private areChatSupportCasesEqual(
    left: ContractTypes.ChatSupportCase | null | undefined,
    right: ContractTypes.ChatSupportCase | null | undefined
  ): boolean {
    if (!left || !right) {
      return left === right;
    }
    return left.status === right.status
      && left.updatedAtIso === right.updatedAtIso
      && (left.assignee?.userId ?? null) === (right.assignee?.userId ?? null)
      && (left.assignee?.name ?? null) === (right.assignee?.name ?? null)
      && (left.assignee?.initials ?? null) === (right.assignee?.initials ?? null);
  }

  private syncActivityEventMetadata(item: ActivityEventDTO): void {
    if (item.startAtIso) {
      this.activityDateTimeRangeById[item.id] = {
        startIso: item.startAtIso,
        endIso: item.endAtIso ?? item.startAtIso
      };
    }
    this.eventDatesById[item.id] = item.startAtIso;
    this.hostingDatesById[item.id] = item.startAtIso;
    this.eventDistanceById[item.id] = item.distanceKm;
    this.hostingDistanceById[item.id] = item.distanceKm;
    if (this.activityEventSaveStatusCode(item) === 'T') {
      const row = ActivityEventInfoCardConverter.convert(item, {
        activeUserId: this.activeUser.id
      });
      this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = row;
    } else {
      delete this.trashedActivityRowsByKey[`events:${item.id}`];
      delete this.trashedActivityRowsByKey[`hosting:${item.id}`];
      delete this.trashedActivityRowsByKey[`invitations:${item.id}`];
    }
    if (item.imageUrl?.trim()) {
      this.activityImageById[item.id] = item.imageUrl;
    } else {
      delete this.activityImageById[item.id];
    }
    this.activityCapacityById[item.id] = `${item.acceptedMembers} / ${item.capacityTotal}`;
    this.activityPendingMembersById[item.id] = item.pendingMembers;
    this.eventVisibilityById[item.id] = item.visibility;
    this.eventCapacityById[item.id] = { min: item.capacityMin ?? null, max: item.capacityMax ?? null };
  }

  private applyActivityEventDTO(update: ActivityEventDTO): ActivityEventDTO {
    const existingDTO = this.eventsService.peekKnownItemById(this.activeUser.id, update.id);
    const nextDTO = existingDTO
      ? this.patchActivityEventDTO(existingDTO, update)
      : this.cloneActivityEventDTO(update);
    this.syncActivityEventMetadata(nextDTO);
    return nextDTO;
  }

  private cloneActivityEventDTO(item: ActivityEventDTO): ActivityEventDTO {
    return {
      ...item,
      adminIds: [...(item.adminIds ?? [])],
      acceptedMemberUserIds: [...(item.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(item.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(item.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(item.pendingRequestMemberUserIds ?? [])]
    };
  }

  private patchActivityEventDTO(item: ActivityEventDTO, update: Partial<ActivityEventDTO>): ActivityEventDTO {
    const acceptedMembers = Math.max(0, Math.trunc(Number(update.acceptedMembers ?? item.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(update.pendingMembers ?? item.pendingMembers) || 0));
    const capacityTotal = Math.max(
      acceptedMembers,
      Math.max(0, Math.trunc(Number(update.capacityTotal ?? item.capacityTotal) || 0))
    );
    return this.cloneActivityEventDTO({
      ...item,
      ...update,
      endAtIso: update.endAtIso ?? (update.startAtIso ? update.startAtIso : item.endAtIso),
      acceptedMembers,
      pendingMembers,
      capacityTotal
    });
  }

  private upsertVisibleEventRowFromSave(sync: ActivityEventDTO): void {
    if (!this.isEventActivitiesPrimaryFilter() || this.activitiesView === 'week' || this.activitiesView === 'month') {
      return;
    }
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const shouldShow = this.savedEventMatchesCurrentScope(sync);
    const removedExisting = smartList.removeVisibleItems(
      row => row.id === sync.id && this.isEventStyleActivity(row),
      { totalDelta: shouldShow ? 0 : -1 }
    );
    if (!shouldShow) {
      return;
    }
    smartList.upsertConvertedVisibleItem(sync, {
      totalDelta: removedExisting ? 0 : 1
    });
  }

  private savedEventMatchesCurrentScope(sync: ActivityEventDTO): boolean {
    const status = this.activityEventSaveStatusCode(sync);
    const activeUserId = this.activeUser.id.trim();
    const isTrashed = status === 'T';
    const isAdmin = this.activityEventDTOIsAdmin(sync);
    const isInvited = activeUserId.length > 0 && (sync.invitedMemberUserIds ?? []).includes(activeUserId);
    const isAccepted = activeUserId.length > 0 && (sync.acceptedMemberUserIds ?? []).includes(activeUserId);
    const isPending = activeUserId.length > 0 && (sync.pendingRequestMemberUserIds ?? []).includes(activeUserId);
    const isPendingReview = status === 'UR' || status === 'B';

    if (this.activitiesEventScope === 'trash') {
      return isTrashed;
    }
    if (isTrashed) {
      return false;
    }
    switch (this.activitiesEventScope) {
      case 'all':
        return isAdmin || isInvited || isAccepted || isPending;
      case 'pending':
        return (isAdmin && isPendingReview) || (!isAdmin && isPending);
      case 'invitations':
        return isInvited;
      case 'my-events':
        return isAdmin;
      case 'drafts':
        return isAdmin && status === 'DR';
      case 'active-events':
      default:
        return !isAdmin && !isInvited && isAccepted && !isPendingReview;
    }
  }

  private activityRowLocalSortKey(row: ActivityListItem): SmartListLocalSortKey {
    if (this.activitiesPrimaryFilter === 'chats' && !this.isCalendarLayoutView()) {
      return this.chatRowLocalSortKey(row);
    }
    if (this.isEventActivitiesPrimaryFilter() && !this.isCalendarLayoutView()) {
      return this.eventRowLocalSortKey(row);
    }
    return row.localSortKey ?? [this.activityRowIdentity(row)];
  }

  private chatRowLocalSortKey(row: ActivityListItem): SmartListLocalSortKey {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    const timestamp = AppUtils.toSortableDate(row.dateIso ?? '');
    if (secondaryFilter === 'relevant') {
      return [
        -this.chatRowMetricScore(row),
        -timestamp,
        this.activityRowIdentity(row)
      ];
    }
    return [
      -timestamp,
      this.activityRowIdentity(row)
    ];
  }

  private eventRowLocalSortKey(row: ActivityListItem): SmartListLocalSortKey {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    if (this.activitiesView === 'distance') {
      if (secondaryFilter === 'relevant') {
        return [
          this.activityRowDistanceOrderValue(row),
          -this.activityRowBoostOrderValue(row),
          -this.activityRowTimestampOrderValue(row),
          this.activityRowIdentity(row)
        ];
      }
      return [
        this.activityRowDistanceOrderValue(row),
        -this.activityRowTimestampOrderValue(row),
        this.activityRowIdentity(row)
      ];
    }
    if (secondaryFilter === 'relevant') {
      return [
        this.activityRowDayOrderValue(row),
        -this.activityRowBoostOrderValue(row),
        -this.activityRowTimestampOrderValue(row),
        this.activityRowIdentity(row)
      ];
    }
    if (secondaryFilter === 'past') {
      return [
        -this.activityRowDayOrderValue(row),
        -this.activityRowTimestampOrderValue(row),
        this.activityRowIdentity(row)
      ];
    }
    return [
      this.activityRowDayOrderValue(row),
      this.activityRowTimestampOrderValue(row),
      this.activityRowIdentity(row)
    ];
  }

  private activityRowDistanceOrderValue(row: ActivityListItem): number {
    return row.distanceMetersExact ?? 0;
  }

  private activityRowBoostOrderValue(row: ActivityListItem): number {
    const sourceBoost = Number(this.isEventStyleActivity(row)
      ? this.eventsService.peekKnownItemById(this.activeUser.id, row.id)?.boost
      : row.sortScore);
    if (Number.isFinite(sourceBoost)) {
      return Math.max(0, sourceBoost);
    }
    return Math.max(0, Number(row.sortScore) || 0);
  }

  private activityRowTimestampOrderValue(row: ActivityListItem): number {
    const startAtIso = this.isEventStyleActivity(row)
      ? this.eventsService.peekKnownItemById(this.activeUser.id, row.id)?.startAtIso
      : null;
    return AppUtils.toSortableDate(startAtIso ?? row.dateIso ?? '');
  }

  private activityRowDayOrderValue(row: ActivityListItem): number {
    const timestamp = this.activityRowTimestampOrderValue(row);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }
    return AppUtils.dateOnly(new Date(timestamp)).getTime();
  }

  protected refreshSectionBadges(): void {
    this.cdr.markForCheck();
  }

  private activityEventSaveStatusCode(item: Pick<ActivityEventDTO, 'status'>): NonNullable<ActivityEventDTO['status']> {
    const status = `${item.status ?? ''}`.trim();
    switch (status) {
      case 'DR':
      case 'T':
      case 'UR':
      case 'B':
      case 'D':
      case 'I':
        return status;
      default:
        return 'A';
    }
  }

  private activityEventDTOIsAdmin(item: ActivityEventDTO | null | undefined): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    return !!activeUserId
      && (
        `${item?.creatorUserId ?? ''}`.trim() === activeUserId
        || (item?.adminIds ?? []).includes(activeUserId)
      );
  }

  private isOwnedEventSave(sync: ActivityEventDTO): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return false;
    }
    return `${sync.creatorUserId ?? ''}`.trim() === activeUserId
      || (sync.adminIds ?? []).includes(activeUserId);
  }

  private syncMobileViewFromViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileView = false;
      return;
    }
    const next = window.innerWidth <= 760;
    if (next === this.isMobileView) {
      return;
    }
    this.isMobileView = next;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Close
  // =========================================================================

  protected closeActivitiesPopup(): void {
    this.activitiesStore.closeActivities();
  }

  // =========================================================================
  // Derived lists (computed on demand – no signals here for compat)
  // =========================================================================

  protected get filteredActivityRows(): ActivityListItem[] {
    return [...(this.activitiesSmartList?.itemsSnapshot() ?? [])];
  }

  private pendingCheckoutDraftSourceIds(): Set<string> {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return new Set<string>();
    }
    return new Set(
      this.eventCheckoutDraftStore.listByUser(activeUserId)
        .filter(draft => this.shouldTrackPendingCheckoutDraft(draft))
        .map(draft => draft.sourceId.trim())
        .filter(sourceId => sourceId.length > 0)
    );
  }

  private shouldTrackPendingCheckoutDraft(draft: EventCheckoutDraft | null | undefined): boolean {
    return draft?.pendingReason === 'waitlist'
      || Math.max(0, Number(draft?.totalAmount) || 0) > 0;
  }

  // =========================================================================
  // Template helpers – toolbar
  // =========================================================================

  protected isEventActivitiesPrimaryFilter(): boolean {
    return this.activitiesPrimaryFilter === 'events';
  }

  protected activitiesEventScopeLabel(): string {
    switch (this.activitiesEventScope) {
      case 'all':
        return 'All';
      case 'pending':
        return 'Pending';
      case 'invitations':
        return 'Invitations';
      case 'my-events':
        return 'My Events';
      case 'drafts':
        return 'Drafts';
      case 'trash':
        return 'Trash';
      case 'active-events':
      default:
        return 'Active Events';
    }
  }

  protected shouldShowRatesFullscreenToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates' && !this.isCalendarLayoutView();
  }

  protected isRatesFullscreenModeActive(): boolean {
    return this.activitiesRates.isFullscreenModeActive();
  }

  protected activitiesSmartListPresentation(): SmartListPresentation {
    return this.activitiesRates.isFullscreenModeActive() ? 'fullscreen' : 'list';
  }

  protected isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }

  protected effectiveActivitiesSecondaryFilter(): ContractTypes.ActivitiesSecondaryFilter {
    return this.isEventActivitiesPrimaryFilter() && this.activitiesSecondaryFilter === 'relevant'
      ? 'recent'
      : this.activitiesSecondaryFilter;
  }

  rateFilterCount(filter: ContractTypes.RateFilterKey): number {
    return this.ratesService.peekRateItemsByUser(this.activeUser.id)
      .filter((item: ActivityRateDTO) => this.activitiesRates.matchesFilter(item, filter)).length;
  }

  toggleRateSocialBadgeForGroup(labelOrGroup: string): void {
    const group = this.rateSocialGroupForLabel(labelOrGroup);
    const nextEnabled = group === 'pair'
      ? !this.activitiesPairRateSocialBadgeEnabled
      : !this.activitiesIndividualRateSocialBadgeEnabled;
    if (group === 'pair') {
      this.activitiesPairRateSocialBadgeEnabled = nextEnabled;
    } else {
      this.activitiesIndividualRateSocialBadgeEnabled = nextEnabled;
    }
    if (this.activitiesRateFilter.startsWith(group)) {
      this.activitiesRateSocialBadgeEnabled = nextEnabled;
    }
    this.activitiesStore.setActivitiesRateSocialBadgeEnabledForGroup(group, nextEnabled);
    if (this.activitiesRateFilter.startsWith(group)) {
      this.lastRateIndicatorPulseRowId = null;
      this.selectedActivityRateId = null;
      this.activitiesStore.setActivitiesSelectedRateId(null);
      this.resetActivitiesScroll();
      this.syncActivitiesSmartListQuery();
      this.activitiesSmartList?.reload();
    }
    this.cdr.markForCheck();
  }

  private rateSocialGroupForLabel(labelOrGroup: string): 'individual' | 'pair' {
    const normalized = labelOrGroup.trim().toLowerCase();
    if (
      normalized === 'pair'
      || normalized === 'suggestions'
      || normalized === 'activity.rates.group.suggestions'
    ) {
      return 'pair';
    }
    return 'individual';
  }

  isHostingPublicationFilterVisible(): boolean {
    return false;
  }

  shouldShowActivitiesQuickActions(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && this.activitiesEventScope !== 'all'
      && this.activitiesEventScope !== 'active-events'
      && this.activitiesEventScope !== 'pending'
      && this.activitiesEventScope !== 'invitations'
      && this.activitiesEventScope !== 'trash';
  }

  selectActivitiesPrimaryFilter(filter: ContractTypes.ActivitiesPrimaryFilter): void {
    if (filter !== 'rates') {
      this.activitiesRates.disableFullscreenMode();
    }
    this.activitiesStore.setActivitiesPrimaryFilter(filter);
    if (filter === 'events' && this.activitiesSecondaryFilter === 'relevant') {
      this.activitiesStore.setActivitiesSecondaryFilter('recent');
    }
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesEventScopePicker(event: Event): void {
    if (!this.isEventActivitiesPrimaryFilter()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesEventScopePicker = !this.showActivitiesEventScopePicker;
  }

  selectActivitiesEventScope(scope: ContractTypes.ActivitiesEventScope): void {
    const currentScope = this.activitiesStore.activitiesEventScope() as ContractTypes.ActivitiesEventScope;
    if (!this.isEventActivitiesPrimaryFilter() || currentScope === scope) {
      this.showActivitiesEventScopePicker = false;
      return;
    }
    this.activitiesStore.setActivitiesEventScope(scope);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesChatContextFilter(filter: ContractTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    this.activitiesStore.setActivitiesChatContextFilter(filter);
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectHostingPublicationFilter(filter: ContractTypes.HostingPublicationFilter): void {
    if (!this.isHostingPublicationFilterVisible() || this.hostingPublicationFilter === filter) {
      return;
    }
    this.activitiesStore.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesSecondaryFilter(filter: ContractTypes.ActivitiesSecondaryFilter): void {
    const normalizedFilter = this.isEventActivitiesPrimaryFilter() && filter === 'relevant'
      ? 'recent'
      : filter;
    this.activitiesStore.setActivitiesSecondaryFilter(normalizedFilter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesRateFilter(filter: ContractTypes.RateFilterKey): void {
    const currentFilter = this.activitiesStore.activitiesRateFilter() as ContractTypes.RateFilterKey;
    if (currentFilter === filter) {
      this.showActivitiesPrimaryPicker = false;
      this.showActivitiesEventScopePicker = false;
      this.showActivitiesChatContextPicker = false;
      this.showActivitiesSecondaryPicker = false;
      this.showActivitiesRatePicker = false;
      this.showActivitiesQuickActionsMenu = false;
      return;
    }
    this.activitiesStore.setActivitiesRateFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.selectedActivityRateId = null;
    this.activitiesStore.setActivitiesSelectedRateId(null);
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesStore.toggleActivitiesViewPicker();
  }

  toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesStore.toggleActivitiesSecondaryPicker();
  }

  setActivitiesView(view: ContractTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (view !== 'distance') {
      this.activitiesRates.disableFullscreenMode();
    }
    this.activitiesStore.setActivitiesView(view as 'day' | 'week' | 'month' | 'distance');
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesQuickActionsMenu(event: Event): void {
    if (!this.shouldShowActivitiesQuickActions()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = !this.showActivitiesQuickActionsMenu;
  }

  openMobileActivitiesPrimaryFilterSelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesPrimaryPicker = !this.showActivitiesPrimaryPicker;
  }

  openMobileActivitiesEventScopeSelector(event: Event): void {
    if (!this.isMobileView || !this.isEventActivitiesPrimaryFilter()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesEventScopePicker = !this.showActivitiesEventScopePicker;
  }

  openMobileActivitiesChatContextFilterSelector(event: Event): void {
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesChatContextPicker = !this.showActivitiesChatContextPicker;
  }

  openMobileActivitiesRateFilterSelector(event: Event): void {
    event.stopPropagation();
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'rates') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesRatePicker = !this.showActivitiesRatePicker;
  }

  requestOpenEventEditor(): void {
    const target: ContractTypes.EventEditorTarget = this.isEventActivitiesPrimaryFilter()
      ? (this.activitiesEventScope === 'my-events' || this.activitiesEventScope === 'drafts' ? 'hosting' : 'events')
      : 'events';
    this.showActivitiesQuickActionsMenu = false;
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target
    });
  }

  requestOpenEventEditorForRow(
    row: any,
    readOnly = false,
    stacked = true
  ): void {
    void stacked;
    this.openActivityRowInEventModule(row, readOnly);
  }

  requestOpenEventExplore(): void {
    this.showActivitiesQuickActionsMenu = false;
    this.memberMenuStore.requestActivitiesNavigation({ type: 'eventExplore' });
  }

  // =========================================================================
  // Row rendering helpers
  // =========================================================================

  protected get activitiesEmptyLabel(): string {
    if (this.activitiesPrimaryFilter === 'rates') {
      return 'No rate interactions for this filter yet.';
    }
    if (this.activitiesEventScope === 'drafts') {
      return 'No drafts in My Events yet.';
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      if (this.activitiesEventScope === 'trash') {
        return 'Trash is empty.';
      }
      if (this.activitiesEventScope === 'all') {
        return 'No event activity items in this filter.';
      }
      return `No ${this.activitiesEventScopeLabel().toLowerCase()} items in this filter.`;
    }
    return `No ${this.activitiesPrimaryFilter} items in this filter.`;
  }

  protected trackByActivityGroup(_index: number, group: { label: string }): string {
    return group.label;
  }

  protected trackByActivityRow(_index: number, row: ActivityListItem): string {
    return this.activityRowIdentity(row);
  }

  protected trackByRateCardImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  protected activitiesRateCardRevisionForRow(row: ActivityListItem | null): string {
    const rowRevision = row ? (this.activityRateCardRevisionByRowId[row.id] ?? 0) : 0;
    return `${this.activitiesRateCardRevision}:${rowRevision}`;
  }

  protected activitiesSmartListClassMap(): Record<string, boolean> {
    return {
      'experience-card-list': true,
      'assets-card-list': true
    };
  }

  protected isEventStyleActivity(row: ActivityListItem): row is ActivityEventListItem {
    return this.isEventActivitiesPrimaryFilter()
      || !!this.eventsService.peekKnownItemById(this.activeUser.id, (row as ActivityEventListItem).id);
  }

  protected isActivityChatRow(row: ActivityListItem): boolean {
    return this.activitiesPrimaryFilter === 'chats' && !!row;
  }

  protected activityRowBadge(row: ActivityListItem): number {
    if (this.isActivityChatRow(row)) {
      return (row as ActivityChatListItem).unread ?? 0;
    }
    return 0;
  }

  // ── Event-style rows ───────────────────────────────────────────────────────

  protected withActivityEventInfoCard(row: ActivityListItem): ActivityListItem {
    if (!this.isEventStyleActivity(row)) {
      return row;
    }
    const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    if (dto) {
      return ActivityEventInfoCardConverter.convert(dto, {
        activeUserId: this.activeUser.id
      });
    }
    return row;
  }

  private activityEventListTypeForRow(row: ActivityEventListItem): ActivityEventListType {
    const rowType = this.activityEventListTypeFromSmartListKey(row.smartListKey);
    if (rowType) {
      return rowType;
    }
    const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    if (dto) {
      return this.resolveActivityEventCardTypeFromDTO(dto);
    }
    switch (this.activitiesEventScope) {
      case 'invitations':
        return 'invitations';
      case 'my-events':
      case 'drafts':
        return 'hosting';
      default:
        return 'events';
    }
  }

  private activityEventListTypeFromSmartListKey(key: string | number | null | undefined): ActivityEventListType | null {
    const prefix = `${key ?? ''}`.trim().split(':')[0];
    return prefix === 'events' || prefix === 'hosting' || prefix === 'invitations'
      ? prefix
      : null;
  }

  private resolveActivityMembersPopupSummary(row: ActivityEventListItem): ActivityMembersSummaryDto | null {
    const persistedSummary = this.activityMembersService.peekSummaryByOwner(
      ActivityEventInfoCardConverter.toActivityMembersOwner(row)
    );
    if (persistedSummary) {
      return {
        ...persistedSummary,
        acceptedMemberUserIds: [...persistedSummary.acceptedMemberUserIds],
        pendingMemberUserIds: [...persistedSummary.pendingMemberUserIds]
      };
    }
    return ActivityEventInfoCardConverter.toActivityMembersSummary(row, {
      capacityByRowId: this.activityCapacityById,
      pendingMembersByRowId: this.activityPendingMembersById,
      capacityTotal: this.activityCapacityTotal(row)
    });
  }

  private activityCapacityTotal(row: ActivityEventListItem, fallbackBase = 0): number {
    const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    const dtoCapacityMax = Number(dto?.capacityMax);
    if (Number.isFinite(dtoCapacityMax) && dtoCapacityMax >= 0) {
      return Math.max(fallbackBase, Math.trunc(dtoCapacityMax));
    }
    const dtoCapacityTotal = Number(dto?.capacityTotal);
    if (Number.isFinite(dtoCapacityTotal) && dtoCapacityTotal >= 0) {
      return Math.max(fallbackBase, Math.trunc(dtoCapacityTotal));
    }
    const source = this.activityCapacityById[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0) {
        return parts[1];
      }
    }
    return fallbackBase;
  }

  private activityCalendarDateRange(row: ActivityListItem): { start: Date; end: Date } | null {
    if (this.activitiesPrimaryFilter === 'rates') {
      const point = new Date(row.dateIso ?? '');
      if (Number.isNaN(point.getTime())) {
        return null;
      }
      return { start: point, end: new Date(point.getTime() + 60 * 1000) };
    }
    const explicit = this.activityDateTimeRangeById[row.id];
    if (explicit) {
      const start = new Date(explicit.startIso);
      const end = new Date(explicit.endIso);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
        return { start, end };
      }
    }
    const parsed = new Date(row.dateIso ?? '');
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return { start: parsed, end: new Date(parsed.getTime() + (2 * 60 * 60 * 1000)) };
  }

  private resolveInvitationActivityMembersRow(row: ActivityEventListItem): ActivityEventListItem {
    if (this.activityEventListTypeForRow(row) !== 'invitations') {
      return row;
    }
    const matchingDTO = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    if (matchingDTO) {
      return ActivityEventInfoCardConverter.convert(matchingDTO, {
        activeUserId: this.activeUser.id
      });
    }
    return row;
  }

  private applyActivityMembersSummary(row: ActivityEventListItem, summary: ActivityMembersSummaryDto): void {
    this.activityCapacityById[row.id] = `${summary.acceptedMembers} / ${summary.capacityTotal}`;
    this.activityPendingMembersById[row.id] = summary.pendingMembers;
    this.applyActivityMembersSummaryToRow(row, summary);
    this.bumpActivitiesEventCardRevision(row);
  }

  private applyActivityMembersSyncState(sync: ActivityMembersSyncState): void {
    const acceptedMembers = Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0));
    const capacityTotal = Math.max(
      acceptedMembers,
      Math.trunc(Number(sync.capacityTotal) || 0)
    );
    this.activityCapacityById[sync.id] = `${acceptedMembers} / ${capacityTotal}`;
    this.activityPendingMembersById[sync.id] = pendingMembers;
    const patchRow = (row: ActivityListItem): ActivityListItem => {
      if (row.id !== sync.id || !this.isEventStyleActivity(row)) {
        return row;
      }
      const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
      if (!dto) {
        return row;
      }
      return ActivityEventInfoCardConverter.convert(this.patchActivityEventDTO(dto, {
          acceptedMembers,
          pendingMembers,
          capacityTotal
        }), {
          activeUserId: this.activeUser.id
        });
    };
    this.activitiesSmartList?.patchVisibleItem(
      row => row.id === sync.id && this.isEventStyleActivity(row),
      row => patchRow(row)
    );
    this.bumpActivitiesEventCardRevision(`events:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`hosting:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`invitations:${sync.id}`);
  }

  private applyActivityMembersSummaryToRow(row: ActivityEventListItem, summary: ActivityMembersSummaryDto): void {
    const dto = this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    if (!dto) {
      return;
    }
    Object.assign(row, ActivityEventInfoCardConverter.convert(this.patchActivityEventDTO(dto, {
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: summary.capacityTotal
    }), {
      activeUserId: this.activeUser.id
    }));
  }

  protected persistSelectedActivityMembers(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId) {
      return;
    }
    const owner = ActivityEventInfoCardConverter.toActivityMembersOwner(this.selectedActivityMembersRow);
    if (!owner) {
      return;
    }
    const acceptedMembers = this.selectedActivityMembers.filter(member => member.status === 'accepted').length;
    const summary = ActivityMembersBuilder.buildActivityMembersSummary(
      owner,
      this.selectedActivityMembers,
      this.activityCapacityTotal(this.selectedActivityMembersRow, acceptedMembers)
    );
    this.applyActivityMembersSummary(this.selectedActivityMembersRow, summary);
    void this.activityMembersService.replaceMembersByOwner(owner, this.selectedActivityMembers, summary.capacityTotal);
  }

  private maybeDismissActivityRateEditor(target: Element): void {
    if (!this.activitiesRates.isEditorOpen()) {
      return;
    }
    if (
      this.activitiesSmartList?.isPaginationMenuTarget(target)
      || target.closest('.activities-rate-score-badge')
      || target.closest('.activities-rate-profile-card.is-rate-editor-selected')
    ) {
      return;
    }
    this.activitiesRates.clearEditorState();
  }

  protected runAfterActivitiesRender(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(task));
      return;
    }
    setTimeout(task, 0);
  }

  protected runAfterActivitiesNextPaint(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(task);
      return;
    }
    setTimeout(task, 0);
  }
  // =========================================================================
  // Calendar – SmartList config helpers
  // =========================================================================

  protected calendarBadgeToneClass(row: ActivityListItem): string {
    const paletteSize = 8;
    const toneIndex = (AppUtils.hashText(row.id) % paletteSize) + 1;
    return `calendar-badge-tone-${toneIndex}`;
  }

  // =========================================================================
  // SmartList state reset
  // =========================================================================

  protected resetActivitiesScroll(): void {
    this.activitiesSmartList?.clearHostedLoading();
    this.activitiesSmartList?.replaceVisibleItems([], { total: 0 });
    this.activitiesStickyValue = '';
    this.activitiesStore.setActivitiesStickyValue('');
    this.activitiesListScrollable = true;
    this.activitiesInitialLoadPending = true;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Surface click (closes pickers / menus)
  // =========================================================================

  protected onActivitiesPopupSurfaceClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && this.isInsideActivitiesFilterSurface(target)) {
      return;
    }
    if (
      this.showActivitiesViewPicker
      || this.showActivitiesSecondaryPicker
      || this.showActivitiesPrimaryPicker
      || this.showActivitiesEventScopePicker
      || this.showActivitiesChatContextPicker
      || this.showActivitiesRatePicker
      || this.showActivitiesQuickActionsMenu
    ) {
      this.showActivitiesViewPicker      = false;
      this.showActivitiesSecondaryPicker = false;
      this.showActivitiesPrimaryPicker = false;
      this.showActivitiesEventScopePicker = false;
      this.showActivitiesChatContextPicker = false;
      this.showActivitiesRatePicker = false;
      this.showActivitiesQuickActionsMenu = false;
      this.cdr.markForCheck();
    }
    if (!(target instanceof Element)) {
      return;
    }
    this.maybeDismissActivityRateEditor(target);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private isInsideActivitiesFilterSurface(target: Element): boolean {
    return !!target.closest(
      '.popup-filter-picker, .popup-filter-panel, .activities-view-picker-panel, .popup-mobile-filter-picker, .popup-mobile-filter-panel, .popup-view-fab'
    );
  }

  protected chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  protected applyActivityEventSave(sync: ActivityEventDTO): void {
    const dto = this.applyActivityEventDTO(sync);
    const saveStatus = this.activityEventSaveStatusCode(dto);
    const isOwned = this.isOwnedEventSave(sync);

    this.activityDateTimeRangeById[dto.id] = {
      startIso: dto.startAtIso,
      endIso: dto.endAtIso ?? dto.startAtIso
    };
    this.eventDatesById[dto.id] = dto.startAtIso;
    this.hostingDatesById[dto.id] = dto.startAtIso;
    this.eventDistanceById[dto.id] = dto.distanceKm;
    this.hostingDistanceById[dto.id] = dto.distanceKm;
    if (isOwned) {
      const nextActiveIds = new Set(this.activeHostingIds);
      if (saveStatus === 'A') {
        nextActiveIds.add(dto.id);
      } else {
        nextActiveIds.delete(dto.id);
      }
      this.activeHostingIds = nextActiveIds;
    }
    if (dto.imageUrl.trim().length > 0) {
      this.activityImageById[dto.id] = dto.imageUrl;
    } else {
      delete this.activityImageById[dto.id];
    }
    if (dto.visibility) {
      this.eventVisibilityById[dto.id] = dto.visibility;
    }
    if (dto.capacityMin !== undefined || dto.capacityMax !== undefined) {
      const existingCapacity = this.eventCapacityById[dto.id] ?? { min: 0, max: 0 };
      this.eventCapacityById[dto.id] = {
        min: dto.capacityMin ?? existingCapacity.min,
        max: dto.capacityMax ?? existingCapacity.max
      };
    }
    this.clearInvitationMemberCacheFromEventSave(dto);

    this.upsertVisibleEventRowFromSave(dto);
    this.applyActivitiesEventMemberSnapshot(dto);
    this.bumpActivitiesEventCardRevision(`events:${dto.id}`);
    this.bumpActivitiesEventCardRevision(`hosting:${dto.id}`);
    this.bumpActivitiesEventCardRevision(`invitations:${dto.id}`);
    this.refreshSectionBadges();
  }

  protected activitiesEventCardRevisionForRow(row: ActivityListItem): number {
    return this.activitiesEventCardRevisionByRowId[this.activityRowIdentity(row)] ?? 0;
  }

  private bumpActivitiesEventCardRevision(row?: ActivityListItem | string | null): void {
    if (!row) {
      return;
    }
    const rowId = typeof row === 'string' ? row : this.activityRowIdentity(row);
    this.activitiesEventCardRevisionByRowId[rowId] = (this.activitiesEventCardRevisionByRowId[rowId] ?? 0) + 1;
  }

  private refreshActivitiesRateCards(rowId?: string | null): void {
    const normalizedRowId = `${rowId ?? ''}`.trim();
    if (normalizedRowId) {
      this.activityRateCardRevisionByRowId[normalizedRowId] =
        (this.activityRateCardRevisionByRowId[normalizedRowId] ?? 0) + 1;
    } else {
      this.activitiesRateCardRevision += 1;
    }
    this.cdr.markForCheck();
  }

  private syncVisibleRateItem(item: ActivityRateDTO): void {
    const smartList = this.activitiesSmartList;
    if (!smartList || this.activitiesPrimaryFilter !== 'rates') {
      return;
    }
    if (this.activitiesRates.matchesFilter(item, this.activitiesRateFilter)) {
      smartList.patchConvertedVisibleItem(item);
      return;
    }
    smartList.removeVisibleItemByIdentity(`rates:${item.id}`);
  }

  private clearInvitationMemberCacheFromEventSave(sync: ActivityEventDTO): void {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  protected cloneSyncedSubEventForms(items: readonly ContractTypes.SubEventDTO[]): ContractTypes.SubEventDTO[] {
    return items.map(item => ({
      ...item
    }));
  }

  protected cloneSyncedSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplateDTO[] | null | undefined
  ): ContractTypes.EventSlotTemplateDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({ ...item }));
  }

  private applyActivitiesEventMemberSnapshot(sync: ActivityEventDTO): void {
    const dto = sync;
    const acceptedRaw = Number(dto.acceptedMembers);
    const pendingRaw = Number(dto.pendingMembers);
    const hasAccepted = Number.isFinite(acceptedRaw);
    const hasPending = Number.isFinite(pendingRaw);
    if (!hasAccepted && !hasPending) {
      return;
    }
    const acceptedMembers = hasAccepted ? Math.max(0, Math.trunc(acceptedRaw)) : 0;
    const pendingMembers = hasPending ? Math.max(0, Math.trunc(pendingRaw)) : 0;
    const capacityRaw = Number(dto.capacityTotal);
    const capacityTotal = Number.isFinite(capacityRaw)
      ? Math.max(acceptedMembers, Math.trunc(capacityRaw))
      : acceptedMembers;
    this.activityCapacityById[sync.id] = `${acceptedMembers} / ${capacityTotal}`;
    this.activityPendingMembersById[sync.id] = pendingMembers;

    const eventRow = ActivityEventInfoCardConverter.convert(dto, {
      activeUserId: this.activeUser.id
    });
    const summary: ActivityMembersSummaryDto = {
      ownerType: 'event',
      ownerId: sync.id,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: []
    };
    this.applyActivityMembersSummary(eventRow, summary);
    delete this.activityMembersByRowId[`events:${sync.id}`];
    delete this.activityMembersByRowId[`hosting:${sync.id}`];
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  private syncActivitiesSmartListQuery(): void {
    const nextFilters: Record<string, unknown> = {
      primaryFilter: this.activitiesPrimaryFilter,
      eventScopeFilter: this.activitiesEventScope,
      secondaryFilter: this.activitiesSecondaryFilter,
      chatContextFilter: this.activitiesChatContextFilter,
      supportCaseFilter: this.activitiesSupportCaseFilter,
      hostingPublicationFilter: this.hostingPublicationFilter,
      rateFilter: this.activitiesRateFilter,
      rateSocialBadgeEnabled: this.activitiesRateSocialBadgeEnabled,
      adminServiceOnly: this.activitiesStore.activitiesAdminServiceOnly()
    };
    const currentFilters = this.activitiesSmartListQuery.filters ?? {};
    if (
      currentFilters['primaryFilter'] === nextFilters['primaryFilter']
      && currentFilters['eventScopeFilter'] === nextFilters['eventScopeFilter']
      && currentFilters['secondaryFilter'] === nextFilters['secondaryFilter']
      && currentFilters['chatContextFilter'] === nextFilters['chatContextFilter']
      && currentFilters['supportCaseFilter'] === nextFilters['supportCaseFilter']
      && currentFilters['hostingPublicationFilter'] === nextFilters['hostingPublicationFilter']
      && currentFilters['rateFilter'] === nextFilters['rateFilter']
      && currentFilters['rateSocialBadgeEnabled'] === nextFilters['rateSocialBadgeEnabled']
      && currentFilters['adminServiceOnly'] === nextFilters['adminServiceOnly']
    ) {
      return;
    }
    this.activitiesSmartListQuery = {
      filters: nextFilters as ActivitiesSmartListFilters
    };
  }

  protected onActivitiesSmartListStateChange(change: SmartListStateChange<ActivityListItem, ActivitiesSmartListFilters>): void {
    let shouldMarkForCheck = false;
    this.syncChatContextUnreadCountsWithListState(change);

    if (this.activitiesInitialLoadPending !== change.initialLoading) {
      this.activitiesInitialLoadPending = change.initialLoading;
      shouldMarkForCheck = true;
    }

    if (this.activitiesListScrollable !== change.scrollable) {
      this.activitiesListScrollable = change.scrollable;
      shouldMarkForCheck = true;
    }

    if (this.activitiesStickyValue !== change.stickyLabel) {
      this.activitiesStickyValue = change.stickyLabel;
      this.activitiesStore.setActivitiesStickyValue(change.stickyLabel);
      shouldMarkForCheck = true;
    }

    if (this.isRatesFullscreenModeActive()) {
      this.activitiesRates.syncFullscreenSelection();
    }
    if (shouldMarkForCheck) {
      this.cdr.markForCheck();
    }
  }

  private syncChatContextUnreadCountsWithListState(
    change: SmartListStateChange<ActivityListItem, ActivitiesSmartListFilters>
  ): void {
    if (this.activitiesPrimaryFilter !== 'chats') {
      this.activitiesChatListStateKey = '';
      return;
    }
    const nextKey = [
      change.total,
      change.items.length,
      ...change.items.map(item => [
        item.smartListKey ?? item.id ?? '',
        (item as ActivityChatListItem).ownerId ?? '',
        (item as { status?: unknown }).status ?? '',
        (item as ActivityChatListItem).unread ?? 0
      ].join(':'))
    ].join('|');
    if (nextKey === this.activitiesChatListStateKey) {
      return;
    }
    this.activitiesChatListStateKey = nextKey;
    this.invalidateChatContextUnreadCounts();
  }

  protected activityRowIdentity(row: ActivityListItem): string {
    const smartListKey = `${row.smartListKey ?? ''}`.trim();
    if (smartListKey) {
      return smartListKey;
    }
    if (this.activitiesPrimaryFilter === 'chats') {
      return `chats:${row.id}`;
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      return `rates:${row.id}`;
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      return `${this.activityEventListTypeForRow(row as ActivityEventListItem)}:${row.id}`;
    }
    return row.id;
  }

  private async loadActivitiesSmartListPage(
    query: ListQuery<ActivitiesSmartListFilters>,
    context?: SmartListLoadContext
  ): Promise<PageResult<ActivityListItem>> {
    const requestedPrimaryFilter = query.filters?.primaryFilter ?? this.activitiesPrimaryFilter;
    if (requestedPrimaryFilter === 'rates') {
      const page = await this.activitiesService.loadActivityRates(query, {
        signal: context?.signal
      });
      return {
        items: this.activitiesSmartList?.convertItems(page.items, {
          rateUsers: page.context?.users ?? []
        }) ?? [],
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }
    if (requestedPrimaryFilter === 'events' || requestedPrimaryFilter === 'hosting' || requestedPrimaryFilter === 'invitations') {
      const page = await this.eventsService.loadActivityEvents(query, {
        signal: context?.signal
      });
      return {
        items: this.activitiesSmartList?.convertItems(page.items) ?? [],
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }
    const page = await this.activitiesService.loadActivityChats(query, {
      chatItems: this.chatsService.peekChatItemsByUser(this.activeUser.id),
      signal: context?.signal
    });
    return {
      items: this.activitiesSmartList?.convertItems(page.items) ?? [],
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }
}
