import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
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
  type ActivityMemberOwnerRef,
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
  ActivitiesPopupStore
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
  type SmartListLoadContext,
  type SmartListLoadPage,
  type SmartListMenuItemsContext,
  type SmartListItemSelectEvent,
  type SmartListPresentation,
  type SmartListStateChange
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
  NavigatorStore
} from '../../../shared/ui/context/stores/navigator.store';
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
import { PopupStore } from '../../../shared/ui/context/stores/popup.store';
// ---------------------------------------------------------------------------

type ActivitiesSmartListFilters = ActivitiesFeedFilters;
type ActivityEventSaveMessage = ActivityEventDTO;
type ActivityEventCounterKey = keyof NonNullable<ActivityCounters['event']>;
type ActivityPopupEventType = 'events' | 'hosting' | 'invitations';
type ActivitySmartListDTO = ActivityEventDTO | ChatDTO | ActivityRateDTO;

interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

interface ActivityPopupCardBase {
  id: string;
  type: ContractTypes.ActivitiesPrimaryFilter;
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  dateIso: string;
  distanceMetersExact?: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  boost?: number | null;
  imageUrl?: string | null;
  visibility?: AppConstants.EventVisibility | null;
  avatarInitials?: string | null;
  creatorInitials?: string | null;
  acceptedMembers?: number | null;
  pendingMembers?: number | null;
  adminIds?: readonly string[];
  acceptedMemberUserIds?: readonly string[];
  pendingMemberUserIds?: readonly string[];
  invitedMemberUserIds?: readonly string[];
  pendingRequestMemberUserIds?: readonly string[];
  capacityTotal?: number | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
  isTrashed?: boolean;
  memberCount?: number | null;
}

type ActivityPopupEventCard =
  InfoCardData
  & ActivityPopupCardBase
  & { type: ActivityPopupEventType; subtitle: string; detail: string };

type ActivityPopupRateCard =
  ImageCardData
  & ActivityPopupCardBase
  & { type: 'rates'; subtitle: string; detail: string };

type ActivityPopupChatCard =
  SingleRowData
  & ActivityPopupCardBase
  & { type: 'chats'; subtitle: string; detail: string };

type ActivityPopupCard =
  | ActivityPopupEventCard
  | ActivityPopupRateCard
  | ActivityPopupChatCard;

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
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  // ── injected ──────────────────────────────────────────────────────────────
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly activitiesService = inject(ActivitiesService);
  protected readonly eventEditorStore = inject(EventEditorPopupStore);
  protected readonly ratesService = inject(RatesService);
  protected readonly activityMembersService = inject(ActivityMembersService);
  protected readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly chatsService = inject(ChatsService);
  protected readonly eventsService = inject(EventsService);
  protected readonly shareTokensService = inject(ShareTokensService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly popupStore = inject(PopupStore);
  private readonly assetStore = inject(AssetStore);
  private readonly usersService = inject(UsersService);
  protected readonly dialogStore = inject(DialogStore);
  protected readonly eventCheckoutDialogStore = inject(EventCheckoutDialogStore);
  protected readonly navigatorStore = inject(NavigatorStore);
  private readonly eventCheckoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly i18nService = inject(I18nService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  readonly activitiesRates = new ActivitiesRatesController({
    getUsers: () => this.users,
    getActiveUserGender: () => this.activeUser.gender,
    getActivitiesPrimaryFilter: () => this.activitiesPrimaryFilter,
    getActivitiesRateFilter: () => this.activitiesRateFilter,
    getActivitiesRateSocialBadgeEnabled: () => this.activitiesRateSocialBadgeEnabled,
    getActivitiesRateSocialBadgeEnabledForFilter: filter => filter.startsWith('pair')
      ? this.activitiesPairRateSocialBadgeEnabled
      : this.activitiesIndividualRateSocialBadgeEnabled,
    getFilteredActivityRows: () => this.filteredActivityRows,
    getRateItems: () => this.rateItems,
    getSmartListCursorItem: () => this.activitiesSmartList?.cursorItem() ?? null,
    getActivitiesListScrollElement: () => this.activitiesListScrollElement(),
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
    getActivityRateDraftById: () => this.activityRateDraftById,
    getActivityRateDirectionOverrideById: () => this.activityRateDirectionOverrideById,
    getPendingActivityRateDirectionOverrideById: () => this.pendingActivityRateDirectionOverrideById,
    setSelectedRateIdInContext: value => this.activitiesStore.setActivitiesSelectedRateId(value),
    setFullscreenModeInContext: value => this.activitiesStore.setActivitiesRatesFullscreenMode(value),
    recordActivityRate: (item, score, direction) => this.ratesService.recordActivityRate(this.activeUser.id, item, score, direction),
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
  protected get users(): UserDto[] {
    return this.usersService.peekCachedUsers() as UserDto[];
  }
  protected activeUser: UserDto = (this.userProfileStore.activeUserProfile() as UserDto | null)
    ?? this.users[0]
    ?? this.createFallbackActiveUser();

  protected activityItems: ActivitySmartListDTO[] = [];
  protected chatItems: ChatDTO[] = [];
  protected rateItems: ActivityRateDTO[] = [];

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
  protected readonly eventSubEventsById: Record<string, ContractTypes.SubEventDTO[]> = {};
  private lastPendingCheckoutDraftSourceIds = new Set<string>();
  protected readonly activityMembersByRowId: Record<string, ActivityContracts.ActivityMemberEntry[]> = {};
  private readonly activitiesEventCardRevisionByRowId: Record<string, number> = {};
  protected activitiesRateCardRevision = 0;
  protected readonly activityRateCardRevisionByRowId: Record<string, number> = {};
  protected readonly leavingActivityRowIds = new Set<string>();
  protected readonly activityRowExitAnimationMs = 180;
  private lastAppliedActivityMembersUpdatedMs = 0;
  private adminSupportBoardPollTimer: ReturnType<typeof setInterval> | null = null;
  private unregisterActivitiesExplanationContext: (() => void) | null = null;
  private activitiesExplanationContextKey: string | null = null;

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
  @ViewChild('activitiesScroll')
  private activitiesScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesSmartList')
  protected activitiesSmartList?: SmartListComponent<ActivityPopupCard, ActivitiesSmartListFilters>;
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
  protected readonly activitiesSmartListConfig: SmartListConfig<ActivityPopupCard, ActivitiesSmartListFilters> = {
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
    trackBy: (_index, row) => this.activityRowIdentity(row),
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
  protected readonly activitiesSmartListLoadPage: SmartListLoadPage<ActivityPopupCard, ActivitiesSmartListFilters>
    = (query, context) => from(this.loadActivitiesSmartListPage(query, context));
  // ── Scroll / sticky ───────────────────────────────────────────────────────
  protected activitiesListScrollable  = true;
  protected activitiesStickyValue     = '';
  protected activitiesInitialLoadPending = false;
  private visibleActivityRows: ActivityPopupCard[] = [];
  private visibleActivityRowsSource: readonly ActivityPopupCard[] | null = null;
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
  protected readonly activityRateDraftById: Record<string, number>                                  = {};
  protected readonly activityRateDirectionOverrideById: Partial<Record<string, ActivityRateDTO['direction']>> = {};
  protected readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, ActivityRateDTO['direction']>> = {};

  protected lastRateIndicatorPulseRowId: string | null = null;

  // ── Rates fullscreen state ────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;

  // ── Delete / publish confirms ─────────────────────────────────────────────
  protected stackedActivitiesPopup: 'activityMembers' | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected pendingActivityMemberDelete: ActivityContracts.ActivityMemberEntry | null = null;
  protected selectedActivityMembers: ActivityContracts.ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRow: ActivityPopupEventCard | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  protected readonly trashedActivityRowsByKey: Record<string, ActivityPopupCard> = {};

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

  protected openActivityChatForRow(row: ActivityPopupCard): void {
    const chat = this.chatRecordForRow(row);
    if (chat) {
      this.openActivityChat(chat);
      return;
    }
    const provisionalChat = this.chatRecordPreviewForRow(row);
    if (!provisionalChat) {
      return;
    }
    this.openActivityChat(provisionalChat);
    void this.resolveChatRecordForRow(row, { skipCache: true }).then(resolvedChat => {
      if (!resolvedChat) {
        return;
      }
      const activeSession = this.activitiesStore.eventChatSession();
      if (activeSession?.item.id !== resolvedChat.id) {
        return;
      }
      this.activitiesStore.patchEventChatSessionItem(current =>
        current.id === resolvedChat.id
          ? resolvedChat
          : current
      );
    });
  }

  protected onActivityRowClick(row: ActivityPopupCard, event?: Event): void {
    if (!this.isEventStyleActivity(row)) {
      if (row.type === 'chats') {
        this.openActivityChatForRow(row);
      } else {
        this.activitiesRates.openEditor(row, event as Event);
      }
      return;
    }
    this.activitiesEvents.onActivityRowClick(row, event);
  }

  protected openActivityMembers(row: ActivityPopupCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    if (row.type !== 'invitations') {
      this.activitiesEvents.openActivityMembers(row, event);
      return;
    }
    const membersRow = this.resolveInvitationActivityMembersRow(row);
    if (membersRow.type !== 'invitations') {
      this.activitiesEvents.openActivityMembers(membersRow, event);
      return;
    }
    const owner = this.activityMembersOwnerForRow(membersRow);
    const summary = this.resolveActivityMembersPopupSummary(membersRow);
    this.popupStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      subtitle: membersRow.title,
      canManage: membersRow.isAdmin === true,
      acceptedMembers: summary?.acceptedMembers,
      pendingMembers: summary?.pendingMembers,
      capacityTotal: summary?.capacityTotal
    });
  }

  protected onActivityEventCardMenuAction(row: ActivityPopupCard, action: CardMenuActionEvent<InfoCardData>): void {
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    this.activitiesEvents.onActivityEventCardMenuAction(row, action);
  }

  protected activitySmartListMenuItems(
    context: SmartListMenuItemsContext<ActivityPopupCard, ActivitiesSmartListFilters>
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

  private activityEventMenuSubjectFromRow(row: ActivityPopupCard | null | undefined): ActivityEventInfoCardMenuSubject | null {
    if (!row || (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations')) {
      return null;
    }
    return {
      menu: 'activity-event-card',
      id: row.id,
      status: row.status ?? null,
      ownerUserId: row.ownerUserId ?? row.ownerId ?? null,
      adminIds: [...(row.adminIds ?? [])],
      acceptedMemberUserIds: [...(row.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(row.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(row.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(row.pendingRequestMemberUserIds ?? [])]
    };
  }

  private activityEventRowFromMenuSubject(subject: ActivityEventInfoCardMenuSubject): ActivityPopupEventCard | null {
    const row = this.visibleActivityRows.find(item => item.id === subject.id);
    if (!row || (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations')) {
      return null;
    }
    return row;
  }

  protected openProfileView(profileView: CardProfileViewData): void {
    this.navigatorStore.openProfileView(profileView);
  }

  protected isActivityIdentityTrashed(type: ActivityPopupCard['type'], id: string): boolean {
    if (type !== 'events' && type !== 'hosting' && type !== 'invitations') {
      return false;
    }
    return this.activitiesEvents.isActivityIdentityTrashed(type, id);
  }

  protected openActivityRowInEventModule(row: ActivityPopupCard, readOnly: boolean): void {
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
      const activeUserId = this.userProfileStore.activeUserId().trim();
      const nextActiveUser = (this.userProfileStore.activeUserProfile() as UserDto | null)
        ?? this.users.find(user => user.id === activeUserId)
        ?? this.users[0]
        ?? this.createFallbackActiveUser();
      this.activeUser = nextActiveUser;
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
      const session = this.activitiesStore.eventChatSession();
      if (!session) {
        return;
      }
      this.syncChatItemFromOpenSession(session.item);
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
        && this.activitiesEventScope !== 'pending';
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
    this.refreshRateItems();
    void this.refreshChatItems();
    this.resetActivitiesStateForOpen();
    this.activitiesRates.clearEditorState();
    this.resetActivitiesScroll();
  }

  private resetActivitiesStateForOpen(): void {
    this.activityItems = [];
    this.visibleActivityRows = [];
    this.visibleActivityRowsSource = null;
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
    if (!this.activeUser) {
      this.activeUser = (this.userProfileStore.activeUserProfile() as UserDto | null)
        ?? this.users[0]
        ?? this.createFallbackActiveUser();
    }
    const userId = this.activeUser.id;

    if (this.chatItems.length === 0) {
      this.chatItems = this.chatsService.peekChatItemsByUser(userId)
        .map(item => ({ ...item, memberIds: [...(item.memberIds ?? [])] }));
    }
    this.refreshRateItems();

    this.refreshSectionBadges();
  }

  private async refreshChatItems(): Promise<void> {
    const userId = this.activeUser?.id?.trim();
    if (!userId) {
      return;
    }
    try {
      const items = await this.chatsService.queryChatItemsByUser(userId);
      if (this.activeUser.id.trim() !== userId) {
        return;
      }
      let nextItems = items.map(item => ({
        ...item,
        memberIds: [...(item.memberIds ?? [])]
      }));
      const activeSessionChat = this.activitiesStore.eventChatSession()?.item ?? null;
      if (activeSessionChat) {
        const activeSessionIndex = nextItems.findIndex(item => item.id === activeSessionChat.id);
        if (activeSessionIndex >= 0) {
          nextItems[activeSessionIndex] = {
            ...nextItems[activeSessionIndex],
            ...activeSessionChat,
            ownerUserId: activeSessionChat.ownerUserId?.trim() || nextItems[activeSessionIndex].ownerUserId,
            memberIds: [...(activeSessionChat.memberIds ?? [])]
          };
          nextItems = this.sortChatRecords(nextItems);
        } else {
          const activeSessionRecord = {
            ...this.cloneChatRecord(activeSessionChat),
            ownerUserId: userId,
            messages: undefined
          };
          nextItems = this.sortChatRecords([
            ...nextItems,
            activeSessionRecord
          ]);
        }
      }
      this.chatItems = nextItems;
      this.refreshSectionBadges();
      this.cdr.markForCheck();
    } catch {
      // Keep the last cached chat state if the refresh fails.
    }
  }

  private configureAdminSupportBoardPolling(enabled: boolean): void {
    if (!enabled) {
      if (this.adminSupportBoardPollTimer) {
        clearInterval(this.adminSupportBoardPollTimer);
        this.adminSupportBoardPollTimer = null;
      }
      return;
    }
    if (this.adminSupportBoardPollTimer) {
      return;
    }
    this.adminSupportBoardPollTimer = setInterval(() => {
      if (!this.activitiesStore.activitiesOpen() || !this.isAdminServiceChatMode()) {
        return;
      }
      if (this.dialogStore.dialog() || this.activitiesStore.eventChatSession()) {
        return;
      }
      this.activitiesSmartList?.reload();
    }, 30000);
  }

  private syncChatItemFromOpenSession(chat: ChatDTO): void {
    const currentIndex = this.chatItems.findIndex(item => item.id === chat.id);
    if (currentIndex < 0) {
      const nextChat = this.cloneChatRecord(chat);
      this.chatItems = this.sortChatRecords([...this.chatItems, nextChat]);
      this.refreshSectionBadges();
      this.syncVisibleChatRow(nextChat);
      this.cdr.markForCheck();
      return;
    }
    const nextChat = this.cloneChatRecord(chat);
    const currentChat = this.chatItems[currentIndex];
    if (this.areChatRecordsEqual(currentChat, nextChat)) {
      return;
    }
    const nextItems = [...this.chatItems];
    nextItems[currentIndex] = nextChat;
    this.chatItems = this.sortChatRecords(nextItems);
    this.refreshSectionBadges();
    this.syncVisibleChatRow(nextChat);
    this.cdr.markForCheck();
  }

  private syncVisibleChatRow(chat: ChatDTO): void {
    const smartList = this.activitiesSmartList;
    if (!smartList || this.activitiesPrimaryFilter !== 'chats' || this.isCalendarLayoutView()) {
      return;
    }
    if (!this.doesChatMatchActiveContextFilter(chat)) {
      return;
    }
    const currentItems = [...smartList.itemsSnapshot()];
    const existingIndex = currentItems.findIndex(row => row.type === 'chats' && row.id === chat.id);
    const nextItems = existingIndex >= 0
      ? currentItems.filter((_row, index) => index !== existingIndex)
      : currentItems;
    nextItems.push(this.buildActivityChatRow(chat));
    this.replaceVisibleActivityItems(nextItems);
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
    return {
      all: this.activitiesChatContextFilterCount('all'),
      event: this.activitiesChatContextFilterCount('event'),
      subEvent: this.activitiesChatContextFilterCount('subEvent'),
      group: this.activitiesChatContextFilterCount('group'),
      service: this.activitiesChatContextFilterCount('service')
    };
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
    return this.chatItemsForActivities().filter(item => {
      if (filter === 'all') {
        return true;
      }
      return this.activityChatContextFilterKey(item) === filter;
    }).length;
  }

  private supportCaseFilterCount(filter: ContractTypes.SupportCaseFilter): number {
    const normalized = this.normalizeSupportCaseFilter(filter);
    const supportCases = this.chatItems.filter(chat => Boolean(chat.supportCaseStatus));
    if (normalized === 'all') {
      return supportCases.length;
    }
    return supportCases.filter(chat => this.normalizeSupportCaseFilter(chat.supportCaseStatus ?? null) === normalized).length;
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
    return normalized === 'all' || this.normalizeSupportCaseFilter(chat.supportCaseStatus ?? null) === normalized;
  }

  protected onSupportCaseAction(row: ActivityPopupCard, action: ContractTypes.SupportCaseAction): void {
    if (!this.isAdminServiceChatMode()) {
      return;
    }
    const chat = this.chatRecordForRow(row);
    if (!chat?.supportCaseStatus) {
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
    const currentIndex = this.chatItems.findIndex(item => item.id === nextChat.id);
    if (currentIndex >= 0) {
      const nextItems = [...this.chatItems];
      nextItems[currentIndex] = nextChat;
      this.chatItems = this.sortChatRecords(nextItems);
    } else {
      this.chatItems = this.sortChatRecords([...this.chatItems, nextChat]);
    }

    const smartList = this.activitiesSmartList;
    if (smartList && this.activitiesPrimaryFilter === 'chats' && !this.isCalendarLayoutView()) {
      if (this.doesChatMatchActiveContextFilter(nextChat)) {
        this.patchVisibleChatRow(nextChat);
      } else {
        this.removeVisibleChatRow(nextChat.id);
      }
    }

    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private patchVisibleChatRow(chat: ChatDTO): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const nextRow = this.buildActivityChatRow(chat);
    const patched = smartList.patchVisibleItem(
      row => row.type === 'chats' && row.id === chat.id,
      () => nextRow
    );
    if (!patched) {
      return;
    }
    this.visibleActivityRows = this.visibleActivityRows.map(row =>
      row.type === 'chats' && row.id === chat.id ? nextRow : row
    );
  }

  private removeVisibleChatRow(chatId: string): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const currentRows = [...smartList.itemsSnapshot()];
    const nextRows = currentRows.filter(row => !(row.type === 'chats' && row.id === chatId));
    if (nextRows.length === currentRows.length) {
      return;
    }
    this.replaceVisibleActivityItems(nextRows, -1);
  }

  private buildActivityChatRow(chat: ChatDTO): ActivityPopupChatCard {
    const card = ActivityChatSingleRowConverter.convert(chat, {
      users: this.users,
      activeUserId: this.activeUser.id
    });
    const unread = Math.max(0, Math.trunc(Number(card.unread ?? chat.unread) || 0));
    const memberCount = Math.max(0, Math.trunc(Number(card.memberCount) || 0));
    return {
      ...card,
      type: 'chats',
      title: card.title,
      subtitle: card.subtitle ?? chat.title,
      detail: card.detail ?? chat.lastMessage ?? '',
      dateIso: card.dateIso ?? chat.dateIso ?? '',
      distanceMetersExact: card.distanceMetersExact ?? undefined,
      unread,
      metricScore: Number.isFinite(card.sortScore)
        ? Math.max(0, Number(card.sortScore))
        : unread * 10 + memberCount,
      memberCount
    };
  }

  private buildActivityChatCards(items: readonly ChatDTO[]): ActivityPopupChatCard[] {
    const cards = ActivityChatSingleRowConverter.convertList(items, {
      users: this.users,
      activeUserId: this.activeUser.id
    });
    return items.map((item, index) => {
      const card = cards[index] ?? ActivityChatSingleRowConverter.convert(item, {
        users: this.users,
        activeUserId: this.activeUser.id
      });
      const unread = Math.max(0, Math.trunc(Number(card.unread ?? item.unread) || 0));
      const memberCount = Math.max(0, Math.trunc(Number(card.memberCount) || 0));
      return {
        ...card,
        type: 'chats',
        title: card.title,
        subtitle: card.subtitle ?? item.title,
        detail: card.detail ?? item.lastMessage ?? '',
        dateIso: card.dateIso ?? item.dateIso ?? '',
        distanceMetersExact: card.distanceMetersExact ?? undefined,
        unread,
        metricScore: Number.isFinite(card.sortScore)
          ? Math.max(0, Number(card.sortScore))
          : unread * 10 + memberCount,
        memberCount
      };
    });
  }

  private buildActivityEventCard(
    dto: ActivityEventDTO,
    card = ActivityEventInfoCardConverter.convert(dto, {
      activeUserId: this.activeUser.id
    }),
    rowType: ActivityPopupEventType = this.resolveActivityEventCardTypeFromDTO(dto)
  ): ActivityPopupEventCard {
    return {
      ...card,
      id: dto.id,
      type: rowType,
      status: dto.status,
      title: dto.title,
      subtitle: rowType === 'invitations'
        ? dto.creatorName
        : dto.eventType === 'slot'
          ? `Slot occurrence${dto.subtitle ? ' · ' + dto.subtitle : ''}`
          : dto.subtitle,
      detail: dto.timeframe,
      dateIso: dto.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
      unread: Math.max(0, Math.trunc(Number(dto.activity) || 0)),
      metricScore: Math.max(0, Number(dto.boost) || 0),
      isAdmin: this.activityEventDTOIsAdmin(dto),
      ownerId: dto.creatorUserId,
      ownerUserId: dto.creatorUserId,
      avatarInitials: dto.creatorInitials,
      creatorInitials: dto.creatorInitials,
      startAt: dto.startAtIso,
      endAt: dto.endAtIso,
      boost: dto.boost,
      imageUrl: dto.imageUrl,
      visibility: dto.visibility,
      acceptedMembers: dto.acceptedMembers,
      pendingMembers: dto.pendingMembers,
      adminIds: [...(dto.adminIds ?? [])],
      acceptedMemberUserIds: [...(dto.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(dto.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(dto.pendingRequestMemberUserIds ?? [])],
      capacityTotal: dto.capacityTotal,
      capacityMin: dto.capacityMin,
      capacityMax: dto.capacityMax,
      isTrashed: this.activityEventSaveStatusCode(dto) === 'T'
    };
  }

  private buildActivityEventCards(items: readonly ActivityEventDTO[]): ActivityPopupEventCard[] {
    const cards = ActivityEventInfoCardConverter.convertList(items, {
      activeUserId: this.activeUser.id
    });
    return items.map((item, index) => this.buildActivityEventCard(item, cards[index]));
  }

  private buildActivityRateCards(items: readonly ActivityRateDTO[], users: readonly UserDto[]): ActivityPopupRateCard[] {
    const cards = ActivityRateImageCardConverter.convertList(items, {
      activeUserId: this.activeUser.id,
      users,
      directionOverrides: this.activityRateDirectionOverrideById
    });
    return items.map((item, index) => {
      const card = cards[index] ?? ActivityRateImageCardConverter.convert(item, {
        activeUserId: this.activeUser.id,
        users,
        directionOverrides: this.activityRateDirectionOverrideById
      });
      return {
        ...card,
        type: 'rates',
        title: card.title,
        subtitle: card.subtitle ?? '',
        detail: card.detail ?? '',
        dateIso: card.dateIso ?? item.happenedAt ?? '',
        distanceMetersExact: card.distanceMetersExact ?? undefined,
        unread: 0,
        metricScore: Number.isFinite(card.sortScore)
          ? Math.max(0, Number(card.sortScore))
          : 0
      };
    });
  }

  private resolveActivityEventCardTypeFromDTO(dto: ActivityEventDTO): ActivityPopupEventType {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (activeUserId && (dto.invitedMemberUserIds ?? []).includes(activeUserId)) {
      return 'invitations';
    }
    if (activeUserId && (dto.adminIds ?? []).includes(activeUserId)) {
      return 'hosting';
    }
    return 'events';
  }

  private sortChatRecords<T extends ChatDTO>(items: readonly T[]): T[] {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    return [...items].sort((left, right) => {
      if (secondaryFilter === 'relevant') {
        return this.chatMenuMetricScore(right) - this.chatMenuMetricScore(left)
          || AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
          || left.id.localeCompare(right.id);
      }
      return AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
        || left.id.localeCompare(right.id);
    });
  }

  private sortVisibleChatRows(items: readonly ActivityPopupCard[]): ActivityPopupCard[] {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    return [...items].sort((left, right) => {
      if (secondaryFilter === 'relevant') {
        return this.chatRowMetricScore(right) - this.chatRowMetricScore(left)
          || AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
          || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
      }
      return AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
        || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
    });
  }

  private chatMenuMetricScore(chat: ChatDTO): number {
    const unread = Math.max(0, Math.trunc(Number(chat.unread) || 0));
    return unread * 10 + this.activitiesChats.getChatMemberCount(chat);
  }

  private chatRowMetricScore(row: ActivityPopupCard): number {
    return Number.isFinite(row.metricScore)
      ? Math.max(0, Number(row.metricScore))
      : Math.max(0, Math.trunc(Number(row.unread) || 0)) * 10
        + Math.max(0, Math.trunc(Number(row.memberCount) || 0));
  }

  private cloneChatRecord<T extends ChatDTO>(chat: T): T {
    return {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])]
    } as T;
  }

  protected chatRecordForRow(row: ActivityPopupCard): ChatDTO | null {
    const existing = this.chatItems.find(item => item.id === row.id);
    return existing ? this.cloneChatRecord(existing) : null;
  }

  private chatRecordPreviewForRow(row: ActivityPopupCard): ChatDTO | null {
    if (row.type !== 'chats') {
      return null;
    }
    const status = `${(row as { status?: unknown }).status ?? ''}`.trim();
    const channelType = this.chatChannelTypeFromRowStatus(status);
    const supportCaseStatus = this.supportCaseStatusFromRowStatus(status);
    const activeUserId = `${this.activeUser?.id ?? ''}`.trim();
    const title = `${row.subtitle ?? row.title ?? ''}`.trim() || 'Chat';
    return {
      id: row.id,
      avatar: `${row.avatarInitials ?? ''}`.trim() || AppUtils.initialsFromText(title),
      title,
      lastMessage: `${row.detail ?? ''}`.trim(),
      lastSenderId: activeUserId,
      memberIds: activeUserId ? [activeUserId] : [],
      unread: Math.max(0, Math.trunc(Number(row.unread) || 0)),
      dateIso: row.dateIso,
      distanceMetersExact: row.distanceMetersExact,
      channelType,
      supportCaseStatus,
      supportCaseAssigneeName: row.sideLabel ?? null
    };
  }

  private chatChannelTypeFromRowStatus(status: string): ContractTypes.ChatChannelType | undefined {
    return status === 'general'
      || status === 'mainEvent'
      || status === 'optionalSubEvent'
      || status === 'groupSubEvent'
      || status === 'serviceEvent'
      ? status
      : undefined;
  }

  private supportCaseStatusFromRowStatus(status: string): ContractTypes.SupportCaseStatus | null {
    return status === 'pending'
      || status === 'picked'
      || status === 'solved'
      || status === 'blocked'
      ? status
      : null;
  }

  private async resolveChatRecordForRow(
    row: ActivityPopupCard,
    options: { skipCache?: boolean } = {}
  ): Promise<ChatDTO | null> {
    if (row.type !== 'chats') {
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
    const nextItems = items.map(item => ({ ...item, memberIds: [...(item.memberIds ?? [])] }));
    this.chatItems = this.sortChatRecords(nextItems);
    this.refreshSectionBadges();
    this.cdr.markForCheck();
    const resolved = this.chatItems.find(item => item.id === row.id);
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
      || left.eventId !== right.eventId
      || left.subEventId !== right.subEventId
      || left.groupId !== right.groupId
      || left.supportCaseStatus !== right.supportCaseStatus
      || left.supportCaseAssigneeUserId !== right.supportCaseAssigneeUserId
      || left.supportCaseAssigneeName !== right.supportCaseAssigneeName
      || left.supportCaseAssigneeInitials !== right.supportCaseAssigneeInitials
      || left.supportCaseUpdatedAtIso !== right.supportCaseUpdatedAtIso
      || leftMemberIds.length !== rightMemberIds.length
    ) {
      return false;
    }
    return leftMemberIds.every((memberId, index) => memberId === rightMemberIds[index]);
  }

  private setActivityItems(items: readonly ActivitySmartListDTO[]): void {
    this.activityItems = items.map(item =>
      this.isActivityEventDTOItem(item) ? this.cloneActivityEventDTO(item) : ({ ...item } as ActivitySmartListDTO)
    );
  }

  private cacheActivityEventItems(items: readonly ActivityEventDTO[]): void {
    const normalizedItems = Array.isArray(items)
      ? items.map(item => this.cloneActivityEventDTO(item))
      : [];
    this.activityItems = normalizedItems;
    this.activeHostingIds = new Set(
      normalizedItems
        .filter(item => this.activityEventDTOIsAdmin(item) && this.activityEventSaveStatusCode(item) === 'A')
        .map(item => item.id)
    );
    for (const item of normalizedItems) {
      this.cacheActivityEventItem(item);
    }
    this.syncEventOwnerMemberCountsFromEventRows();
    this.bumpActivitiesEventCardRevision();
  }

  private cacheActivityEventItem(item: ActivityEventDTO): void {
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
      const row = this.buildActivityEventCard(item);
      this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = row;
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
    const existingDTO = this.activityItems
      .filter(item => this.isActivityEventDTOItem(item))
      .find(item => item.id === update.id)
      ?? this.eventsService.peekKnownItemById(this.activeUser.id, update.id);
    const nextDTO = existingDTO
      ? this.patchActivityEventDTO(existingDTO, update)
      : this.cloneActivityEventDTO(update);
    this.activityItems = this.activityItems.map(item => {
      if (this.isActivityEventDTOItem(item) && item.id === nextDTO.id) {
        return nextDTO;
      }
      return item;
    });
    this.cacheActivityEventItem(nextDTO);
    return nextDTO;
  }

  private isActivityEventDTOItem(item: ActivitySmartListDTO): item is ActivityEventDTO {
    return Array.isArray((item as ActivityEventDTO).adminIds)
      && typeof (item as ActivityEventDTO).startAtIso === 'string';
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

  private upsertVisibleEventRowFromSave(sync: ActivityEventSaveMessage): void {
    if (!this.isEventActivitiesPrimaryFilter() || this.activitiesView === 'week' || this.activitiesView === 'month') {
      return;
    }
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const currentItems = [...smartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(row => row.id === sync.id);
    const existingRow = currentIndex >= 0 ? currentItems[currentIndex] ?? null : null;
    const nextRow = this.buildVisibleEventRowFromSave(sync, existingRow);
    if (!nextRow && currentIndex < 0) {
      return;
    }
    if (nextRow && existingRow && existingRow.type === nextRow.type && this.canPatchVisibleEventRowInPlace(currentItems, currentIndex, nextRow)) {
      smartList.patchVisibleItem(
        (_row, index) => index === currentIndex,
        () => nextRow
      );
      return;
    }
    const nextItems = currentItems.filter(row => row.id !== sync.id);
    if (nextRow) {
      nextItems.push(nextRow);
    }
    this.replaceVisibleActivityItems(nextItems, (nextRow ? 1 : 0) - (currentIndex >= 0 ? 1 : 0));
  }

  private canPatchVisibleEventRowInPlace(
    currentItems: readonly ActivityPopupCard[],
    currentIndex: number,
    nextRow: ActivityPopupCard
  ): boolean {
    if (currentIndex < 0) {
      return false;
    }
    const patchedItems = [...currentItems];
    patchedItems[currentIndex] = nextRow;
    const sortedItems = this.sortVisibleEventRows(patchedItems);
    return sortedItems.length === currentItems.length
      && sortedItems.every((row, index) => this.activityRowIdentity(row) === this.activityRowIdentity(currentItems[index]));
  }

  private buildVisibleEventRowFromSave(
    sync: ActivityEventSaveMessage,
    existingRow: ActivityPopupCard | null = null
  ): ActivityPopupCard | null {
    const rowType = this.resolveVisibleEventRowTypeFromSave(sync);
    if (rowType === 'events') {
      return this.activityDisplayRowForSave(sync, 'events', existingRow);
    }
    if (rowType === 'hosting') {
      return this.activityDisplayRowForSave(sync, 'hosting', existingRow);
    }
    return null;
  }

  private resolveVisibleEventRowTypeFromSave(sync: ActivityEventSaveMessage): ActivityPopupCard['type'] | null {
    const saveStatus = this.activityEventSaveStatusCode(sync);
    const isPublished = saveStatus === 'A';
    const isPending = this.isPendingEventSave(sync);
    const isAccepted = this.isAcceptedEventSave(sync);
    const isOwned = this.isOwnedEventSave(sync);

    if (this.activitiesEventScope === 'active-events') {
      return !isOwned && isPublished && isAccepted ? 'events' : null;
    }
    if (this.activitiesEventScope === 'pending') {
      return !isOwned && isPublished && isPending ? 'events' : null;
    }
    if (this.activitiesEventScope === 'my-events') {
      if (this.hostingPublicationFilter === 'drafts' && isPublished) {
        return null;
      }
      return isOwned ? 'hosting' : null;
    }
    if (this.activitiesEventScope === 'drafts') {
      return isOwned && !isPublished ? 'hosting' : null;
    }
    if (this.activitiesEventScope === 'all') {
      return isOwned ? 'hosting' : (isAccepted || isPending ? 'events' : null);
    }
    return null;
  }

  protected replaceVisibleActivityItems(items: readonly ActivityPopupCard[], totalDelta = 0): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    let nextItems = [...items];
    if (this.isEventActivitiesPrimaryFilter() && !this.isCalendarLayoutView()) {
      nextItems = this.sortVisibleEventRows(items);
    } else if (this.activitiesPrimaryFilter === 'chats' && !this.isCalendarLayoutView()) {
      nextItems = this.sortVisibleChatRows(items);
    }
    smartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, smartList.cursorState().total + totalDelta)
    });
  }

  protected removeVisibleActivityRow(row: ActivityPopupCard): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const rowKey = this.activityRowIdentity(row);
    const currentItems = [...smartList.itemsSnapshot()];
    const nextItems = currentItems.filter(item => this.activityRowIdentity(item) !== rowKey);
    if (nextItems.length === currentItems.length) {
      return;
    }
    this.replaceVisibleActivityItems(nextItems, -1);
  }

  private reinsertVisibleActivityRow(row: ActivityPopupCard): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const rowKey = this.activityRowIdentity(row);
    const currentItems = [...smartList.itemsSnapshot()];
    if (currentItems.some(item => this.activityRowIdentity(item) === rowKey)) {
      return;
    }
    this.replaceVisibleActivityItems([...currentItems, row], 1);
  }

  private sortVisibleEventRows(items: readonly ActivityPopupCard[]): ActivityPopupCard[] {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    return [...items].sort((left, right) => {
      if (this.activitiesView === 'distance') {
        if (secondaryFilter === 'relevant') {
          return this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right)
            || this.activityRowBoostOrderValue(right) - this.activityRowBoostOrderValue(left)
            || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
            || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
        }
        return this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right)
          || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
          || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
      }
      if (secondaryFilter === 'relevant') {
        return this.activityRowDayOrderValue(left) - this.activityRowDayOrderValue(right)
          || this.activityRowBoostOrderValue(right) - this.activityRowBoostOrderValue(left)
          || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
          || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
      }
      if (secondaryFilter === 'past') {
        return this.activityRowDayOrderValue(right) - this.activityRowDayOrderValue(left)
          || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
          || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
      }
      return this.activityRowDayOrderValue(left) - this.activityRowDayOrderValue(right)
        || this.activityRowTimestampOrderValue(left) - this.activityRowTimestampOrderValue(right)
        || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
    });
  }

  private activityRowDistanceOrderValue(row: ActivityPopupCard): number {
    return row.distanceMetersExact ?? 0;
  }

  private activityRowBoostOrderValue(row: ActivityPopupCard): number {
    const sourceBoost = Number(row.boost);
    if (Number.isFinite(sourceBoost)) {
      return Math.max(0, sourceBoost);
    }
    return Math.max(0, Number(row.metricScore) || 0);
  }

  private activityRowTimestampOrderValue(row: ActivityPopupCard): number {
    return AppUtils.toSortableDate(row.startAt ?? row.dateIso);
  }

  private activityRowDayOrderValue(row: ActivityPopupCard): number {
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

  private activityEventDTOIsAdmin(item: ActivityEventDTO): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    return !!activeUserId && (item.adminIds ?? []).includes(activeUserId);
  }

  private isOwnedEventSave(sync: ActivityEventSaveMessage): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return false;
    }
    return (sync.adminIds ?? []).includes(activeUserId);
  }

  private isPendingEventSave(sync: ActivityEventSaveMessage): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || this.isOwnedEventSave(sync)) {
      return false;
    }
    const dto = sync;
    if ((dto.pendingRequestMemberUserIds ?? []).includes(activeUserId)) {
      return true;
    }
    if ((dto.pendingMemberUserIds ?? []).includes(activeUserId) && !(dto.invitedMemberUserIds ?? []).includes(activeUserId)) {
      return true;
    }
    if (this.pendingCheckoutDraftSourceIds().has(sync.id)) {
      return true;
    }
    return false;
  }

  private isAcceptedEventSave(sync: ActivityEventSaveMessage): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || this.isOwnedEventSave(sync)) {
      return false;
    }
    if ((sync.acceptedMemberUserIds ?? []).includes(activeUserId)) {
      return true;
    }
    if (this.pendingCheckoutDraftSourceIds().has(sync.id)) {
      return false;
    }
    return false;
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

  protected get filteredActivityRows(): ActivityPopupCard[] {
    return [...this.visibleActivityRows];
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
    return this.rateItems.filter((item: any) => this.activitiesRates.matchesFilter(item, filter)).length;
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
    if (this.activitiesPrimaryFilter === 'rates' || filter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
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
    if (this.activitiesPrimaryFilter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
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
    this.activitiesRates.commitPendingDirectionOverrides(filter);
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
    if (this.activitiesPrimaryFilter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
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
    this.popupStore.requestActivitiesNavigation({
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
    this.popupStore.requestActivitiesNavigation({ type: 'eventExplore' });
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

  protected trackByActivityRow(_index: number, row: ActivityPopupCard): string {
    return this.activityRowIdentity(row);
  }

  protected trackByRateCardImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  protected activitiesRateCardRevisionForRow(row: ActivityPopupCard | null): string {
    const rowRevision = row ? (this.activityRateCardRevisionByRowId[row.id] ?? 0) : 0;
    return `${this.activitiesRateCardRevision}:${rowRevision}`;
  }

  protected activitiesSmartListClassMap(): Record<string, boolean> {
    return {
      'experience-card-list': true,
      'assets-card-list': true
    };
  }

  protected isEventStyleActivity(row: ActivityPopupCard): row is ActivityPopupEventCard {
    return row.type === 'events' || row.type === 'hosting' || row.type === 'invitations';
  }

  protected isActivityChatRow(row: ActivityPopupCard): boolean {
    return row.type === 'chats';
  }

  protected activityRowBadge(row: ActivityPopupCard): number {
    if (row.type === 'chats') {
      return row.unread ?? 0;
    }
    return 0;
  }

  // ── Event-style rows ───────────────────────────────────────────────────────

  protected withActivityEventInfoCard(row: ActivityPopupCard): ActivityPopupCard {
    if (!this.isEventStyleActivity(row)) {
      return row;
    }
    const dto = this.activityEventDTOForRow(row);
    if (dto) {
      return {
        ...this.buildActivityEventCard(dto, undefined, row.type as ActivityPopupEventType),
        metricScore: row.metricScore
      };
    }
    return row;
  }

  protected refreshActivityEventInfoCard(row: ActivityPopupCard): void {
    Object.assign(row, this.withActivityEventInfoCard(row));
  }

  private activityEventDTOForRow(row: ActivityPopupEventCard): ActivityEventDTO | null {
    return this.activityItems
      .filter(item => this.isActivityEventDTOItem(item))
      .find(item => item.id === row.id)
      ?? this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
  }

  private activityMembersOwnerForRow(row: ActivityPopupEventCard): ActivityMemberOwnerRef {
    return ActivityMembersBuilder.activityMembersOwnerForRow(row) ?? {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  private resolveActivityMembersPopupSummary(row: ActivityPopupEventCard): ActivityMembersSummaryDto | null {
    const persistedSummary = this.activityMembersService.peekSummaryByOwner(this.activityMembersOwnerForRow(row));
    if (persistedSummary) {
      return {
        ...persistedSummary,
        acceptedMemberUserIds: [...persistedSummary.acceptedMemberUserIds],
        pendingMemberUserIds: [...persistedSummary.pendingMemberUserIds]
      };
    }
    const summary = ActivityMembersBuilder.activityMembersSummaryForRow(row, {
      capacityByRowId: this.activityCapacityById,
      pendingMembersByRowId: this.activityPendingMembersById
    });
    if (summary) {
      return summary;
    }
    const acceptedMembers = this.parseAcceptedMembersFromCapacityLabel(this.activityCapacityById[row.id]);
    const pendingMembers = Math.max(0, Math.trunc(Number(this.activityPendingMembersById[row.id]) || 0));
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembers);
    if (acceptedMembers <= 0 && pendingMembers <= 0 && capacityTotal <= 0) {
      return null;
    }
    return {
      ownerType: 'event',
      ownerId: row.id,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: []
    };
  }

  private activityCapacityTotal(row: ActivityPopupEventCard, fallbackBase = 0): number {
    const source = this.activityCapacityById[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0) {
        return parts[1];
      }
    }
    const sourceCapacityMax = Number(row.capacityMax);
    if (Number.isFinite(sourceCapacityMax) && sourceCapacityMax >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityMax));
    }
    const sourceCapacityTotal = Number(row.capacityTotal);
    if (Number.isFinite(sourceCapacityTotal) && sourceCapacityTotal >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityTotal));
    }
    return fallbackBase;
  }

  private parseAcceptedMembersFromCapacityLabel(label: string | undefined): number {
    const normalizedLabel = label?.trim() ?? '';
    if (!normalizedLabel) {
      return 0;
    }
    const parts = normalizedLabel.split('/').map(part => Number.parseInt(part.trim(), 10));
    return parts.length >= 1 && Number.isFinite(parts[0])
      ? Math.max(0, parts[0])
      : 0;
  }


  private activityCalendarDateRange(row: ActivityPopupCard): { start: Date; end: Date } | null {
    if (row.type === 'rates') {
      const point = new Date(row.dateIso);
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
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return { start: parsed, end: new Date(parsed.getTime() + (2 * 60 * 60 * 1000)) };
  }

  private resolveInvitationActivityMembersRow(row: ActivityPopupEventCard): ActivityPopupEventCard {
    if (row.type !== 'invitations') {
      return row;
    }
    const matchingDTO = this.activityEventDTOForRow(row);
    if (matchingDTO) {
      return this.buildActivityEventCard(matchingDTO, undefined, 'invitations');
    }
    return row;
  }

  private buildActivityMembersFromKnownUserIds(
    row: ActivityPopupEventCard,
    acceptedMemberUserIds: readonly string[],
    pendingMemberUserIds: readonly string[]
  ): ActivityContracts.ActivityMemberEntry[] {
    const rowKey = this.activityRowIdentity(row);
    const normalizedAcceptedMemberUserIds = this.uniqueUserIds(acceptedMemberUserIds);
    const normalizedPendingMemberUserIds = this.uniqueUserIds(pendingMemberUserIds)
      .filter(userId => !normalizedAcceptedMemberUserIds.includes(userId));
    const entries: ActivityContracts.ActivityMemberEntry[] = [];
    for (const userId of normalizedAcceptedMemberUserIds) {
      const user = this.resolveActivityMemberUser(userId);
      entries.push({
        ...ActivityMembersBuilder.toActivityMemberEntry(
          user,
          row,
          rowKey,
          this.activeUser.id,
          { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
          APP_STATIC_DATA.activityMemberMetPlaces
        ),
        id: `${rowKey}:${userId}`,
        userId
      });
    }
    for (const userId of normalizedPendingMemberUserIds) {
      const user = this.resolveActivityMemberUser(userId);
      entries.push({
        ...ActivityMembersBuilder.toActivityMemberEntry(
          user,
          row,
          rowKey,
          this.activeUser.id,
          { status: 'pending', pendingSource: 'admin', invitedByActiveUser: false },
          APP_STATIC_DATA.activityMemberMetPlaces
        ),
        id: `${rowKey}:${userId}`,
        userId,
        requestKind: 'invite',
        statusText: 'Invitation pending.'
      });
    }
    return entries;
  }

  private resolveActivityMemberUser(userId: string): UserDto {
    const normalizedUserId = userId.trim();
    if (normalizedUserId === this.activeUser.id) {
      return this.activeUser;
    }
    return this.userById(normalizedUserId) ?? this.activeUser;
  }

  private applyActivityMembersSummary(row: ActivityPopupEventCard, summary: ActivityMembersSummaryDto): void {
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
    const patchRow = (row: ActivityPopupCard): ActivityPopupCard => {
      if (row.id !== sync.id || !this.isEventStyleActivity(row)) {
        return row;
      }
      const dto = this.activityEventDTOForRow(row);
      if (!dto) {
        return row;
      }
      return {
        ...this.buildActivityEventCard(this.patchActivityEventDTO(dto, {
          acceptedMembers,
          pendingMembers,
          capacityTotal
        }), undefined, row.type as ActivityPopupEventType),
        metricScore: row.metricScore
      };
    };
    this.activitiesSmartList?.patchVisibleItem(
      row => row.id === sync.id && this.isEventStyleActivity(row),
      row => patchRow(row)
    );
    for (const row of this.visibleActivityRows) {
      if (row.id === sync.id && this.isEventStyleActivity(row)) {
        Object.assign(row, patchRow(row));
      }
    }
    this.bumpActivitiesEventCardRevision(`events:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`hosting:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`invitations:${sync.id}`);
  }

  private applyActivityMembersSummaryToRow(row: ActivityPopupEventCard, summary: ActivityMembersSummaryDto): void {
    const dto = this.activityEventDTOForRow(row);
    if (!dto) {
      return;
    }
    Object.assign(row, this.buildActivityEventCard(this.patchActivityEventDTO(dto, {
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: summary.capacityTotal
    }), undefined, row.type as ActivityPopupEventType));
  }

  protected persistSelectedActivityMembers(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId) {
      return;
    }
    const owner = ActivityMembersBuilder.activityMembersOwnerForRow(this.selectedActivityMembersRow);
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

  private syncEventOwnerMemberCountsFromEventRows(): void {
    const eventRecords = this.activityItems
      .filter(item => this.isActivityEventDTOItem(item))
      .map(item => ({
        id: item.id,
        row: this.buildActivityEventCard(item),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      }));
    for (const record of eventRecords) {
      const owner = this.activityMembersOwnerForRow(record.row);
      const summary = this.activityMembersService.peekSummaryByOwner(owner);
      const acceptedMembers = summary?.acceptedMembers ?? record.acceptedMembers;
      const pendingMembers = summary?.pendingMembers ?? record.pendingMembers;
      const capacityTotal = summary?.capacityTotal ?? Math.max(acceptedMembers, record.capacityTotal);
      this.activityCapacityById[record.id] = `${acceptedMembers} / ${capacityTotal}`;
      this.activityPendingMembersById[record.id] = pendingMembers;

      const rowKey = this.activityRowIdentity(record.row);
      if (summary) {
        const members = this.activityMembersService.peekMembersByOwner(owner);
        if (members.length > 0) {
          this.activityMembersByRowId[rowKey] = ActivityMembersBuilder.sortActivityMembersByActionTimeDesc(members);
          this.bumpActivitiesEventCardRevision(rowKey);
          continue;
        }
      }
      delete this.activityMembersByRowId[rowKey];
      this.bumpActivitiesEventCardRevision(rowKey);
    }
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

  protected calendarBadgeToneClass(row: ActivityPopupCard): string {
    const paletteSize = 8;
    const toneIndex = (AppUtils.hashText(row.id) % paletteSize) + 1;
    return `calendar-badge-tone-${toneIndex}`;
  }

  // =========================================================================
  // SmartList state reset
  // =========================================================================

  protected resetActivitiesScroll(): void {
    this.activitiesSmartList?.clearHostedLoading();
    this.activityItems = [];
    this.visibleActivityRows = [];
    this.visibleActivityRowsSource = null;
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

  private refreshRateItems(): void {
    this.rateItems = this.ratesService.peekRateItemsByUser(this.activeUser.id);
  }

  protected uniqueUserIds(ids: readonly string[]): string[] {
    const unique: string[] = [];
    for (const id of ids) {
      if (!id || unique.includes(id)) {
        continue;
      }
      unique.push(id);
    }
    return unique;
  }

  protected chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  protected applyActivityEventSave(sync: ActivityEventSaveMessage): void {
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

    this.patchVisibleActivityRowsFromEventSave(dto);
    this.upsertVisibleEventRowFromSave(dto);
    this.applyActivitiesEventMemberSnapshot(dto);
    this.bumpActivitiesEventCardRevision(`events:${dto.id}`);
    this.bumpActivitiesEventCardRevision(`hosting:${dto.id}`);
    this.bumpActivitiesEventCardRevision(`invitations:${dto.id}`);
    this.refreshSectionBadges();
  }

  protected activitiesEventCardRevisionForRow(row: ActivityPopupCard): number {
    return this.activitiesEventCardRevisionByRowId[this.activityRowIdentity(row)] ?? 0;
  }

  private bumpActivitiesEventCardRevision(row?: ActivityPopupCard | string | null): void {
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

  private clearInvitationMemberCacheFromEventSave(sync: ActivityEventSaveMessage): void {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  private activityDisplayRowForSave(
    sync: ActivityEventSaveMessage,
    rowType: ActivityPopupEventType,
    existingRow: ActivityPopupCard | null
  ): ActivityPopupEventCard {
    const row = this.buildActivityEventCard(sync, undefined, rowType);
    return {
      ...row,
      metricScore: existingRow?.metricScore ?? row.metricScore
    };
  }

  protected cloneSyncedSubEventForms(items: readonly ContractTypes.SubEventDTO[]): ContractTypes.SubEventDTO[] {
    return items.map(item => ({
      ...item,
      groups: Array.isArray(item.groups)
        ? item.groups.map(group => ({ ...group }))
        : []
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

  private patchVisibleActivityRowsFromEventSave(sync: ActivityEventSaveMessage): void {
    const patchRow = (row: ActivityPopupCard): ActivityPopupCard => {
      if (row.id !== sync.id) {
        return row;
      }

      if (row.type === 'events') {
        return this.activityDisplayRowForSave(sync, 'events', row);
      }

      if (row.type === 'hosting') {
        return this.activityDisplayRowForSave(sync, 'hosting', row);
      }

      return row;
    };

    this.activitiesSmartList?.patchVisibleItem(
      row => row.id === sync.id && (row.type === 'events' || row.type === 'hosting'),
      row => patchRow(row)
    );

    for (const row of this.visibleActivityRows) {
      if (row.id !== sync.id) {
        continue;
      }

      if (row.type === 'events') {
        Object.assign(row, patchRow(row));
        continue;
      }

      if (row.type === 'hosting') {
        Object.assign(row, patchRow(row));
      }
    }
  }

  private applyActivitiesEventMemberSnapshot(sync: ActivityEventSaveMessage): void {
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

    const eventRow = this.buildActivityEventCard(dto, undefined, 'events');
    const hostingRow = this.buildActivityEventCard(dto, undefined, 'hosting');

    const persistedSummary = this.activityMembersService.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: sync.id
    });
    const acceptedMemberUserIds = this.uniqueUserIds(persistedSummary?.acceptedMemberUserIds ?? []);
    const pendingMemberUserIds = this.uniqueUserIds(persistedSummary?.pendingMemberUserIds ?? [])
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    const summary: ActivityMembersSummaryDto = {
      ownerType: 'event',
      ownerId: sync.id,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
    this.applyActivityMembersSummary(eventRow, summary);

    const eventRowKey = `${eventRow.type}:${eventRow.id}`;
    const hostingRowKey = `${hostingRow.type}:${hostingRow.id}`;
    if (acceptedMemberUserIds.length > 0 || pendingMemberUserIds.length > 0) {
      this.activityMembersByRowId[eventRowKey] = ActivityMembersBuilder.sortActivityMembersByActionTimeDesc(
        this.buildActivityMembersFromKnownUserIds(eventRow, acceptedMemberUserIds, pendingMemberUserIds)
      );
      this.activityMembersByRowId[hostingRowKey] = ActivityMembersBuilder.sortActivityMembersByActionTimeDesc(
        this.buildActivityMembersFromKnownUserIds(hostingRow, acceptedMemberUserIds, pendingMemberUserIds)
      );
    } else {
      delete this.activityMembersByRowId[eventRowKey];
      delete this.activityMembersByRowId[hostingRowKey];
    }
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  // ── User lookup ────────────────────────────────────────────────────────────

  private userById(userId: string): UserDto | undefined {
    return this.users.find(u => u.id === userId);
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

  protected onActivitiesSmartListItemSelect(event: SmartListItemSelectEvent<ActivityPopupCard, ActivitiesSmartListFilters>): void {
    this.onActivityRowClick(event.item);
  }

  protected onActivitiesSmartListStateChange(change: SmartListStateChange<ActivityPopupCard, ActivitiesSmartListFilters>): void {
    let shouldMarkForCheck = false;

    if (this.visibleActivityRowsSource !== change.items) {
      const currentVisibleIds = this.visibleActivityRows.map(row => this.activityRowIdentity(row));
      const nextVisibleIds = change.items.map(row => this.activityRowIdentity(row));
      if (
        currentVisibleIds.length !== nextVisibleIds.length
        || currentVisibleIds.some((id, index) => id !== nextVisibleIds[index])
      ) {
        this.visibleActivityRows = [...change.items];
        shouldMarkForCheck = true;
      }
      this.visibleActivityRowsSource = change.items;
    }

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

  protected activityRowIdentity(row: ActivityPopupCard): string {
    return `${row.type}:${row.id}`;
  }

  protected activitiesListScrollElement(): HTMLDivElement | null {
    return this.activitiesSmartList?.scrollElement() ?? this.activitiesScrollRef?.nativeElement ?? null;
  }

  private async loadActivitiesSmartListPage(
    query: ListQuery<ActivitiesSmartListFilters>,
    context?: SmartListLoadContext
  ): Promise<PageResult<ActivityPopupCard>> {
    const requestedPrimaryFilter = query.filters?.primaryFilter ?? this.activitiesPrimaryFilter;
    if (requestedPrimaryFilter === 'rates') {
      const page = await this.activitiesService.loadActivityRates(query, {
        signal: context?.signal
      });
      this.setActivityItems(page.items);
      this.refreshRateItems();
      return {
        items: this.buildActivityRateCards(page.items, page.context?.users ?? this.users),
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }
    if (requestedPrimaryFilter === 'events' || requestedPrimaryFilter === 'hosting' || requestedPrimaryFilter === 'invitations') {
      const page = await this.eventsService.loadActivityEvents(query, {
        signal: context?.signal
      });
      this.cacheActivityEventItems(page.items);
      return {
        items: this.buildActivityEventCards(page.items),
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }
    const page = await this.activitiesService.loadActivityChats(query, {
      chatItems: this.chatItems,
      signal: context?.signal
    });
    this.setActivityItems(page.items);
    return {
      items: this.buildActivityChatCards(page.items),
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }
}
