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
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import type { ChatDTO, ChatRecord } from '../../../shared/core/contracts/chat.interface';
import type {
  ActivityEventDTO,
  ActivityMemberOwnerRef,
  ActivityMembersSummary
} from '../../../shared/core/contracts/activity.interface';
import type { ActivityRateDTO } from '../../../shared/core/contracts/activity.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import { AppUtils } from '../../../shared/app-utils';
import type { ActivityEventSaveResultDTO } from '../../../shared/core';
import { AppContext, AppPopupContext, type ActivityCounterKey, type ActivityCounters, type ActivityMembersSyncState } from '../../../shared/ui';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import type { ActivitiesFeedFilters, ActivityEventSaveDTO } from '../../../shared/core/contracts';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  AppMenuComponent, AppMenuDispatcher, type AppMenuBranch, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuModel, type AppMenuPalette, type AppMenuTrigger, EventCheckoutPopupComponent, I18nPipe, type CardProfileViewData, type ImageCardData, type InfoCardData, SmartListComponent, type InfoCardMenuActionEvent, type ListQuery, type PageResult, type SingleRowData, type SmartListConfig, type SmartListLoadContext, type SmartListLoadPage, type SmartListMenuItemsContext, type SmartListItemSelectEvent, type SmartListPresentation, type SmartListStateChange
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
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { EventCheckoutDialogService } from '../../../shared/ui/services/event-checkout-dialog.service';
import { EventCheckoutDraftService, type EventCheckoutDraft } from '../../../shared/ui/services/event-checkout-draft.service';
import { NavigatorService } from '../../../navigator';
import { EventChatPopupComponent } from '../event-chat-popup/event-chat-popup.component';
import { EventExplorePopupComponent } from '../event-explore-popup/event-explore-popup.component';
import { ActivitiesPopupToolbarController } from './activities-popup-toolbar.controller';
import {
  ActivitiesChatTemplateComponent, ActivitiesChatsController
} from './templates/chat/activities-chat-template.component';
import {
  ActivitiesEventTemplateComponent, ActivitiesEventsController
} from './templates/event/activities-event-template.component';
import {
  ActivitiesRateTemplateComponent, ActivitiesRatesController, type ActivitiesRateTemplateContext
} from './templates/rate/activities-rate-template.component';
import {
  ActivityEventBuilder, ActivityMembersBuilder, ActivitiesService, ActivityMembersService, ActivityResourcesService, ChatsService, EventsService, ExplanationGuideService, RatesService, ShareTokensService, UsersService } from '../../../shared/core';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import { I18nService } from '../../../shared/core';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppDTOs from '../../../shared/core/base/dto';
import type * as AppConstants from '../../../shared/core/common/constants';
// ---------------------------------------------------------------------------

type ActivitiesSmartListFilters = ActivitiesFeedFilters;
type ActivityEventSaveMessage = ActivityEventSaveDTO | ActivityEventSaveResultDTO;
type ActivityEventCounterKey = keyof NonNullable<ActivityCounters['event']>;
type ActivityPopupEventType = 'events' | 'hosting' | 'invitations';

interface ActivityPopupCardBase<TEagerDetail = unknown> {
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
  eagerDetail?: TEagerDetail | null;
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

type ActivityPopupEventCard<TEagerDetail = unknown> =
  InfoCardData<TEagerDetail>
  & ActivityPopupCardBase<TEagerDetail>
  & { type: ActivityPopupEventType; subtitle: string; detail: string };

type ActivityPopupRateCard<TEagerDetail = unknown> =
  ImageCardData<TEagerDetail>
  & ActivityPopupCardBase<TEagerDetail>
  & { type: 'rates'; subtitle: string; detail: string };

type ActivityPopupChatCard<TEagerDetail = unknown> =
  SingleRowData<TEagerDetail>
  & ActivityPopupCardBase<TEagerDetail>
  & { type: 'chats'; subtitle: string; detail: string };

type ActivityPopupCard<TEagerDetail = unknown> =
  | ActivityPopupEventCard<TEagerDetail>
  | ActivityPopupRateCard<TEagerDetail>
  | ActivityPopupChatCard<TEagerDetail>;

interface ActivitiesEventScopeOption {
  key: ContractTypes.ActivitiesEventScope;
  label: string;
  icon: string;
}

type ActivitiesToolbarMenuContext =
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
    AppMenuComponent,
    SmartListComponent,
    ActivitiesEventTemplateComponent,
    ActivitiesChatTemplateComponent,
    ActivitiesRateTemplateComponent,
    EventChatPopupComponent,
    EventCheckoutPopupComponent,
    EventExplorePopupComponent,
    I18nPipe
  ],
  templateUrl: './activities-popup.component.html',
  styleUrl: './activities-popup.component.scss',
  providers: [AppMenuDispatcher],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPopupComponent implements OnDestroy {
  readonly activitiesToolbar = new ActivitiesPopupToolbarController(this as never);
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  // ── injected ──────────────────────────────────────────────────────────────
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly activitiesService = inject(ActivitiesService);
  protected readonly eventEditorService = inject(EventEditorPopupStateService);
  protected readonly ratesService = inject(RatesService);
  protected readonly activityMembersService = inject(ActivityMembersService);
  protected readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly chatsService = inject(ChatsService);
  protected readonly eventsService = inject(EventsService);
  protected readonly shareTokensService = inject(ShareTokensService);
  protected readonly appCtx = inject(AppContext);
  protected readonly popupCtx = inject(AppPopupContext);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly usersService = inject(UsersService);
  protected readonly confirmationDialogService = inject(ConfirmationDialogService);
  protected readonly eventCheckoutDialogService = inject(EventCheckoutDialogService);
  protected readonly navigatorService = inject(NavigatorService);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
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
    getPaginationHostElement: () => this.activitiesSmartList?.paginationHostElement() ?? null,
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
    setSelectedRateIdInContext: value => this.activitiesContext.setActivitiesSelectedRateId(value),
    setFullscreenModeInContext: value => this.activitiesContext.setActivitiesRatesFullscreenMode(value),
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
  protected activeUser: UserDto = (this.appCtx.activeUserProfile() as UserDto | null)
    ?? this.users[0]
    ?? this.createFallbackActiveUser();

  protected chatItems: ChatRecord[] = [];
  protected eventItems: ActivityEventRecord[] = [];
  protected hostingItems: ActivityEventRecord[] = [];
  protected invitationItems: ActivityEventRecord[] = [];
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

  protected activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange> = {};

  protected eventDatesById: Record<string, string> = {};
  protected hostingDatesById: Record<string, string> = {};

  protected eventDistanceById: Record<string, number> = {};
  protected hostingDistanceById: Record<string, number> = {};
  protected readonly activityImageById: Record<string, string> = {};
  protected readonly activityCapacityById: Record<string, string> = {};
  protected readonly activityPendingMembersById: Record<string, number> = {};
  protected readonly eventVisibilityById: Record<string, AppConstants.EventVisibility> = {};
  private readonly eventCapacityById: Record<string, ContractTypes.EventCapacityRange> = {};
  protected readonly eventSubEventsById: Record<string, ContractTypes.SubEventFormItem[]> = {};
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

  protected get assetCards(): AppDTOs.AssetCardDTO[] {
    return this.ownedAssets.assetCards;
  }

  private activityCounterValue(key: ActivityCounterKey): number {
    const activeUser = this.appCtx.activeUserProfile();
    const activeUserId = activeUser?.id?.trim() ?? '';
    if (!activeUser || !activeUserId) {
      return 0;
    }
    const overrides = this.appCtx.getUserCounterOverrides(activeUserId);
    return this.normalizeBadgeCounter(overrides[key] ?? activeUser.activities?.[key]);
  }

  private eventCounterValue(key: ActivityEventCounterKey): number {
    const activeUser = this.appCtx.activeUserProfile();
    const activeUserId = activeUser?.id?.trim() ?? '';
    if (!activeUser || !activeUserId) {
      return 0;
    }
    const overrides = this.appCtx.getUserCounterOverrides(activeUserId);
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
  protected readonly activitiesPrimaryFilters: Array<{ key: ContractTypes.ActivitiesPrimaryFilter; label: string; icon: string }> = [
    { key: 'rates', label: 'Rates', icon: 'star' },
    { key: 'chats', label: 'Chats', icon: 'chat' },
    { key: 'events', label: 'Events', icon: 'event' }
  ];
  protected readonly activitiesEventScopeFilters: ReadonlyArray<ActivitiesEventScopeOption> = [
    { key: 'all', label: 'All', icon: 'widgets' },
    { key: 'active-events', label: 'Active Events', icon: 'event' },
    { key: 'pending', label: 'Pending', icon: 'pending_actions' },
    { key: 'invitations', label: 'Invitations', icon: 'mail' },
    { key: 'my-events', label: 'My Events', icon: 'stadium' },
    { key: 'drafts', label: 'Drafts', icon: 'drafts' },
    { key: 'trash', label: 'Trash', icon: 'delete' }
  ];
  protected readonly activitiesSecondaryFilters: Array<{ key: ContractTypes.ActivitiesSecondaryFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesSecondaryFilters];
  protected readonly activitiesChatContextFilters: Array<{ key: ContractTypes.ActivitiesChatContextFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesChatContextFilters];
  protected readonly activitiesSupportCaseFilters: Array<{ key: ContractTypes.SupportCaseFilter; labelKey: string; icon: string }> = [
    { key: 'all', labelKey: 'activities.support.case.filter.all', icon: 'list' },
    { key: 'pending', labelKey: 'activities.support.case.filter.pending', icon: 'pending_actions' },
    { key: 'picked', labelKey: 'activities.support.case.filter.picked', icon: 'assignment_ind' },
    { key: 'solved', labelKey: 'activities.support.case.filter.solved', icon: 'check_circle' },
    { key: 'blocked', labelKey: 'activities.support.case.filter.blocked', icon: 'block' }
  ];
  protected readonly rateFilters: Array<{ key: ContractTypes.RateFilterKey; label: string }>
    = [...APP_STATIC_DATA.rateFilters];
  protected readonly rateFilterEntries: AppTypes.RateFilterEntry[]
    = [...APP_STATIC_DATA.rateFilterEntries];
  protected readonly activitiesViewOptions: Array<{ key: ContractTypes.ActivitiesView; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesViewOptions];
  protected activitiesRateSocialBadgeEnabled = false;
  protected activitiesIndividualRateSocialBadgeEnabled = false;
  protected activitiesPairRateSocialBadgeEnabled = false;

  protected get isBlockedUser(): boolean {
    return this.appCtx.activeUserProfile()?.profileStatus === 'blocked';
  }

  // ── Filter / view state – backed by EventEditorPopupStateService signals ───────────
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
        return this.activitiesRates.isEditorDockVisible() ? 'none' : 'mandatory';
      }
      return 'mandatory';
    },
    scrollPaddingTop: '2.6rem',
    footerSpacerHeight: () => this.activitiesPrimaryFilter === 'rates' ? this.activitiesRates.editorSpacerHeight() : null,
    headerProgress: {
      enabled: true
    },
    pagination: {
      mode: () => {
        if (this.activitiesPrimaryFilter !== 'rates') {
          return 'scroll';
        }
        if (this.activitiesRates.isFullscreenModeActive()) {
          return this.activitiesRates.isFullscreenReadOnlyNavigation() ? 'arrows' : 'rating-stars';
        }
        return this.activitiesRates.shouldRenderEditorDock() ? 'rating-stars' : 'scroll';
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
  protected selectedActivityMembersRow: ActivityPopupCard | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  protected readonly trashedActivityRowsByKey: Record<string, ActivityPopupCard> = {};

  protected getChatLastSender(item: ChatRecord): UserDto {
    return this.activitiesChats.getChatLastSender(item);
  }

  protected getChatMemberCount(item: ChatRecord): number {
    return this.activitiesChats.getChatMemberCount(item);
  }

  protected chatChannelType(item: ChatRecord): ContractTypes.ChatChannelType {
    return this.activitiesChats.chatChannelType(item);
  }

  protected chatItemsForActivities(): ChatRecord[] {
    return this.activitiesChats.chatItemsForActivities();
  }

  protected activityChatContextFilterKey(item: ChatRecord): ContractTypes.ActivitiesChatContextFilter | null {
    return this.activitiesChats.activityChatContextFilterKey(item);
  }

  protected openActivityChat(chat: ChatRecord): void {
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
      const activeSession = this.activitiesContext.eventChatSession();
      if (activeSession?.item.id !== resolvedChat.id) {
        return;
      }
      this.activitiesContext.patchEventChatSessionItem(current =>
        current.id === resolvedChat.id
          ? resolvedChat
          : current
      );
    });
  }

  protected onActivityRowClick(row: ActivityPopupCard, event?: Event): void {
    this.activitiesEvents.onActivityRowClick(row, event);
  }

  protected openActivityMembers(row: ActivityPopupCard, event?: Event): void {
    event?.stopPropagation();
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
    this.popupCtx.requestActivitiesNavigation({
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

  protected onActivityEventInfoCardMenuAction(row: ActivityPopupCard, action: InfoCardMenuActionEvent): void {
    this.activitiesEvents.onActivityEventInfoCardMenuAction(row, action);
  }

  protected activitySmartListMenuItems(
    context: SmartListMenuItemsContext<ActivityPopupCard, ActivitiesSmartListFilters>
  ): readonly AppMenuItem<string, unknown>[] {
    const subject = context.menu.context as ActivityEventInfoCardMenuSubject | undefined;
    if (subject?.menu !== 'activity-event-card') {
      return context.menu.items;
    }
    const activeUserId = this.appCtx.activeUserId().trim() || this.activeUser.id;
    return ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId
    });
  }

  protected onActivityEventSharedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as ActivityEventInfoCardMenuContext | undefined;
    if (context?.menu !== 'activity-event-card') {
      return;
    }
    const row = this.activityEventRowFromMenuSubject(context.subject);
    if (!row) {
      return;
    }
    this.onActivityEventInfoCardMenuAction(row, {
      id: row.id,
      actionId: context.action.id,
      action: context.action,
      card: row
    });
  }

  private activityEventRowFromMenuSubject(subject: ActivityEventInfoCardMenuSubject): ActivityPopupEventCard | null {
    const row = this.visibleActivityRows.find(item => item.id === subject.id);
    if (!row || (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations')) {
      return null;
    }
    return row;
  }

  protected openProfileView(profileView: CardProfileViewData): void {
    this.navigatorService.openProfileView(profileView);
  }

  protected isActivityIdentityTrashed(type: ActivityPopupCard['type'], id: string): boolean {
    return this.activitiesEvents.isActivityIdentityTrashed(type, id);
  }

  protected openActivityRowInEventModule(row: ActivityPopupCard, readOnly: boolean): void {
    this.activitiesEvents.openActivityRowInEventModule(row, readOnly);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  constructor() {
    this.hydrateStandaloneFallbackState();
    this.syncMobileViewFromViewport();

    // Sync service signal state → local properties so OnPush CD fires.
    effect(() => {
      const svc = this.activitiesContext;
      this.activitiesPrimaryFilter       = svc.activitiesPrimaryFilter() as ContractTypes.ActivitiesPrimaryFilter;
      this.activitiesEventScope         = svc.activitiesEventScope() as ContractTypes.ActivitiesEventScope;
      this.activitiesChatContextFilter   = svc.activitiesChatContextFilter() as ContractTypes.ActivitiesChatContextFilter;
      this.activitiesSupportCaseFilter   = svc.activitiesSupportCaseFilter() as ContractTypes.SupportCaseFilter;
      this.activitiesSecondaryFilter     = svc.activitiesSecondaryFilter() as ContractTypes.ActivitiesSecondaryFilter;
      this.hostingPublicationFilter      = svc.activitiesHostingPublicationFilter() as ContractTypes.HostingPublicationFilter;
      this.activitiesRateFilter          = svc.activitiesRateFilter() as ContractTypes.RateFilterKey;
      this.activitiesRateSocialBadgeEnabled = svc.activitiesRateSocialBadgeEnabled();
      this.activitiesIndividualRateSocialBadgeEnabled = svc.activitiesIndividualRateSocialBadgeEnabled();
      this.activitiesPairRateSocialBadgeEnabled = svc.activitiesPairRateSocialBadgeEnabled();
      this.activitiesView                = svc.activitiesView() as ContractTypes.ActivitiesView;
      this.showActivitiesViewPicker      = svc.activitiesShowViewPicker();
      this.showActivitiesSecondaryPicker = svc.activitiesShowSecondaryPicker();
      this.activitiesStickyValue         = svc.activitiesStickyValue();
      this.activitiesRatesFullscreenMode = svc.activitiesRatesFullscreenMode();
      this.selectedActivityRateId        = svc.activitiesSelectedRateId();
      this.syncActivitiesSmartListQuery();
      this.cdr.markForCheck();
    });

    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      const nextActiveUser = (this.appCtx.activeUserProfile() as UserDto | null)
        ?? this.users.find(user => user.id === activeUserId)
        ?? this.users[0]
        ?? this.createFallbackActiveUser();
      this.activeUser = nextActiveUser;
      this.bumpActivitiesEventCardRevision();
      this.refreshSectionBadges();
      this.cdr.markForCheck();
    });

    effect(() => {
      const isOpen = this.activitiesContext.activitiesOpen();
      const primaryFilter = this.activitiesContext.activitiesPrimaryFilter();
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
      const session = this.activitiesContext.eventChatSession();
      if (!session) {
        return;
      }
      this.syncChatItemFromOpenSession(session.item);
    });

    effect(() => {
      this.configureAdminSupportBoardPolling(
        this.activitiesContext.activitiesOpen() && this.activitiesContext.activitiesAdminServiceOnly()
      );
    });

    effect(() => {
      if (this.isEventActivitiesPrimaryFilter() && this.activitiesSecondaryFilter === 'relevant') {
        this.activitiesContext.setActivitiesSecondaryFilter('recent');
      }
    });

    // React to open events: reset scroll state whenever the popup is opened.
    effect(() => {
      const isOpen = this.activitiesContext.activitiesOpen();
      const openRevision = this.activitiesContext.activitiesOpenRevision();
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
      const sync = this.activitiesContext.activityEventSave();
      if (!sync) {
        return;
      }
      this.applyActivityEventSave(sync);
      this.cdr.markForCheck();
    });

    effect(() => {
      this.eventCheckoutDraftService.drafts();
      const nextPendingDraftSourceIds = this.pendingCheckoutDraftSourceIds();
      const hadPendingDraftRemoval = [...this.lastPendingCheckoutDraftSourceIds]
        .some(sourceId => !nextPendingDraftSourceIds.has(sourceId));
      const hasNewPendingDraft = [...nextPendingDraftSourceIds]
        .some(sourceId => !this.lastPendingCheckoutDraftSourceIds.has(sourceId));
      this.lastPendingCheckoutDraftSourceIds = nextPendingDraftSourceIds;
      this.refreshSectionBadges();
      const shouldReloadEventList = this.activitiesContext.activitiesOpen()
        && (hadPendingDraftRemoval || hasNewPendingDraft)
        && this.activitiesPrimaryFilter === 'events'
        && this.activitiesEventScope !== 'pending';
      if (shouldReloadEventList) {
        this.activitiesSmartList?.reload();
      }
      this.cdr.markForCheck();
    });

    effect(() => {
      const sync = this.appCtx.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      if (this.eventEditorService.isOpen()) {
        return;
      }
      this.applyActivityMembersSyncState(sync);
      this.cdr.markForCheck();
    });

    effect(() => {
      this.ownedAssets.assetListRevision();
      this.cdr.markForCheck();
    });

  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (!this.activitiesContext.activitiesOpen()) {
      return;
    }
    if (this.confirmationDialogService.dialog()) {
      return;
    }
    if (this.eventEditorService.isOpen()) {
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
    void this.refreshStandaloneEventItems();
    this.resetActivitiesStateForOpen();
    this.activitiesRates.clearEditorState();
    this.resetActivitiesScroll();
    this.syncEventOwnerMemberCountsFromEventRows();
  }

  private resetActivitiesStateForOpen(): void {
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
      id: this.appCtx.activeUserId().trim(),
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
      this.activeUser = (this.appCtx.activeUserProfile() as UserDto | null)
        ?? this.users[0]
        ?? this.createFallbackActiveUser();
    }
    const userId = this.activeUser.id;

    if (this.chatItems.length === 0) {
      this.chatItems = this.chatsService.peekChatItemsByUser(userId)
        .map(item => ({ ...item, memberIds: [...(item.memberIds ?? [])] }));
    }
    if (this.eventItems.length === 0 || this.hostingItems.length === 0 || this.invitationItems.length === 0) {
      this.hydrateStandaloneEventItems(userId);
    }
    this.refreshRateItems();

    this.refreshSectionBadges();
    this.syncEventOwnerMemberCountsFromEventRows();
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
      const activeSessionChat = this.activitiesContext.eventChatSession()?.item ?? null;
      if (activeSessionChat) {
        const activeSessionIndex = nextItems.findIndex(item => item.id === activeSessionChat.id);
        if (activeSessionIndex >= 0) {
          nextItems[activeSessionIndex] = {
            ...nextItems[activeSessionIndex],
            ...activeSessionChat,
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
      if (!this.activitiesContext.activitiesOpen() || !this.isAdminServiceChatMode()) {
        return;
      }
      if (this.confirmationDialogService.dialog() || this.activitiesContext.eventChatSession()) {
        return;
      }
      this.activitiesSmartList?.reload();
    }, 30000);
  }

  private syncChatItemFromOpenSession(chat: ChatRecord): void {
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

  private syncVisibleChatRow(chat: ChatRecord): void {
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

  private doesChatMatchActiveContextFilter(chat: ChatRecord): boolean {
    if (this.activitiesChatContextFilter === 'all') {
      return this.doesChatMatchActiveSupportCaseFilter(chat);
    }
    return this.activitiesChats.activityChatContextFilterKey(chat) === this.activitiesChatContextFilter
      && this.doesChatMatchActiveSupportCaseFilter(chat);
  }

  protected isAdminServiceChatMode(): boolean {
    return this.activitiesContext.activitiesAdminServiceOnly();
  }

  protected supportCaseFilterLabelKey(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): string {
    return this.activitiesSupportCaseFilters.find(option => option.key === filter)?.labelKey ?? 'activities.support.case.filter.all';
  }

  protected supportCaseFilterIcon(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): string {
    return this.activitiesSupportCaseFilters.find(option => option.key === filter)?.icon ?? 'list';
  }

  protected supportCaseFilterCount(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): number {
    const normalized = this.normalizeSupportCaseFilter(filter);
    const supportCases = this.chatItems.filter(chat => Boolean(chat.supportCaseStatus));
    if (normalized === 'all') {
      return supportCases.length;
    }
    return supportCases.filter(chat => this.normalizeSupportCaseFilter(chat.supportCaseStatus ?? null) === normalized).length;
  }

  protected supportCaseFilterClass(filter: ContractTypes.SupportCaseFilter = this.activitiesSupportCaseFilter): string {
    return `support-case-filter-${filter === 'all' ? 'all' : filter}`;
  }

  protected activitiesSupportCaseMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.supportCaseFilterLabelKey(),
      icon: this.supportCaseFilterIcon(),
      palette: this.supportCasePalette(this.activitiesSupportCaseFilter),
      counter: this.supportCaseFilterCount(),
      shape: 'pill'
    });
  }

  protected activitiesSupportCaseMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesSupportCaseFilters.map(option => this.activitiesMenuItem({
      id: `support-case:${option.key}`,
      label: option.labelKey,
      icon: option.icon,
      palette: this.supportCasePalette(option.key),
      counter: this.supportCaseFilterCount(option.key),
      active: option.key === this.activitiesSupportCaseFilter,
      context: { menu: 'support-case', value: option.key }
    }));
  }

  protected activitiesPrimaryMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesToolbar.activitiesPrimaryFilterLabel(),
      icon: this.activitiesToolbar.activitiesPrimaryFilterIcon(),
      palette: this.activitiesPrimaryPalette(this.activitiesPrimaryFilter),
      counter: this.activitiesToolbar.activitiesPrimaryFilterCount(this.activitiesPrimaryFilter)
    });
  }

  protected activitiesPrimaryMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesPrimaryFilters.map(option => this.activitiesMenuItem({
      id: `primary:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesPrimaryPalette(option.key),
      counter: this.activitiesToolbar.activitiesPrimaryFilterCount(option.key),
      active: option.key === this.activitiesPrimaryFilter,
      context: { menu: 'primary', value: option.key }
    }));
  }

  protected activitiesEventScopeMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesEventScopeLabel(),
      icon: this.activitiesToolbar.activitiesEventScopeIcon(),
      palette: this.activitiesEventScopePalette(this.activitiesEventScope),
      counter: this.activitiesToolbar.activitiesEventScopeCount()
    });
  }

  protected activitiesEventScopeMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesEventScopeFilters.map(option => this.activitiesMenuItem({
      id: `event-scope:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesEventScopePalette(option.key),
      counter: this.activitiesToolbar.activitiesEventScopeCount(option.key),
      active: option.key === this.activitiesEventScope,
      context: { menu: 'event-scope', value: option.key }
    }));
  }

  protected activitiesChatContextMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesToolbar.activitiesChatContextFilterLabel(),
      icon: this.activitiesToolbar.activitiesChatContextFilterIcon(),
      palette: this.activitiesChatContextPalette(this.activitiesChatContextFilter),
      counter: this.activitiesToolbar.activitiesChatContextFilterCount(this.activitiesChatContextFilter)
    });
  }

  protected activitiesChatContextMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesChatContextFilters.map(option => this.activitiesMenuItem({
      id: `chat-context:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesChatContextPalette(option.key),
      counter: this.activitiesToolbar.activitiesChatContextFilterCount(option.key),
      active: option.key === this.activitiesChatContextFilter,
      context: { menu: 'chat-context', value: option.key }
    }));
  }

  protected activitiesRateMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesToolbar.activitiesRateFilterLabel(),
      icon: this.activitiesToolbar.activitiesRateFilterIcon(this.activitiesRateFilter),
      palette: 'gold',
      counter: this.activitiesToolbar.selectedRateFilterCount()
    });
  }

  protected activitiesRateMenuModel(): AppMenuModel<string, ActivitiesToolbarMenuContext> {
    type RateMenuNode = Omit<AppMenuBranch<string, ActivitiesToolbarMenuContext>, 'items' | 'children' | 'headerActions'> & {
      items: AppMenuItem<string, ActivitiesToolbarMenuContext>[];
      headerActions?: AppMenuItem<string, ActivitiesToolbarMenuContext>[];
    };
    const nodes: RateMenuNode[] = [];
    let currentNode: typeof nodes[number] | null = null;
    for (const option of this.rateFilterEntries) {
      if (option.kind === 'group') {
        const groupLabel = option.label;
        const groupPalette = this.activitiesRateGroupPalette(groupLabel);
        currentNode = {
          id: `rate-group:${groupLabel}`,
          label: this.activitiesToolbar.rateGroupOptionLabelKey(groupLabel),
          icon: this.activitiesToolbar.rateSocialBadgeGroupIconForGroup(groupLabel),
          palette: groupPalette,
          items: [],
          headerActions: this.activitiesToolbar.shouldShowRateSocialBadgeToggleForGroup(groupLabel)
            ? [{
              id: `rate-social:${groupLabel}`,
              label: this.activitiesToolbar.rateSocialBadgeButtonLabelForGroup(groupLabel),
              icon: this.activitiesToolbar.rateSocialBadgeToggleIconForGroup(groupLabel),
              kind: 'toggle',
              active: this.activitiesToolbar.isRateSocialBadgeToggleActiveForGroup(groupLabel),
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
        label: this.activitiesToolbar.rateFilterOptionLabel(option.key),
        icon: this.activitiesToolbar.activitiesRateFilterIcon(option.key),
        palette: this.activitiesRatePalette(option.key),
        counter: this.activitiesToolbar.rateFilterCount(option.key),
        active: option.key === this.activitiesRateFilter,
        context: { menu: 'rate', value: option.key }
      }));
    }
    return { nodes };
  }

  protected activitiesSecondaryMenuTrigger(): AppMenuTrigger {
    const filter = this.effectiveActivitiesSecondaryFilter();
    return this.activitiesSelectTrigger({
      label: this.activitiesToolbar.activitiesSecondaryFilterLabel(),
      icon: this.activitiesToolbar.activitiesSecondaryFilterIcon(),
      palette: this.activitiesSecondaryPalette(filter),
      shape: 'pill',
      hideLabel: this.isMobileView
    });
  }

  protected activitiesSecondaryMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesToolbar.availableActivitiesSecondaryFilters().map(option => this.activitiesMenuItem({
      id: `secondary:${option.key}`,
      label: this.activitiesToolbar.activitiesSecondaryFilterOptionLabel(option.key),
      icon: option.icon,
      palette: this.activitiesSecondaryPalette(option.key),
      active: option.key === this.effectiveActivitiesSecondaryFilter(),
      context: { menu: 'secondary', value: option.key }
    }));
  }

  protected activitiesViewMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesToolbar.activityViewLabel(),
      icon: this.activitiesViewOptions.find(option => option.key === this.activitiesView)?.icon ?? 'view_agenda',
      palette: this.activitiesViewPalette(this.activitiesView),
      shape: 'pill',
      hideLabel: this.isMobileView
    });
  }

  protected activitiesViewMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
    return this.activitiesViewOptions.map(option => this.activitiesMenuItem({
      id: `view:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesViewPalette(option.key),
      active: option.key === this.activitiesView,
      context: { menu: 'view', value: option.key }
    }));
  }

  protected activitiesQuickActionsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      ariaLabel: 'Open event actions',
      hideLabel: true,
      shape: 'icon',
      palette: 'green'
    };
  }

  protected activitiesQuickActionsMenuItems(): readonly AppMenuItem<string, ActivitiesToolbarMenuContext>[] {
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

  protected onActivitiesToolbarMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as ActivitiesToolbarMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'primary':
        this.activitiesToolbar.selectActivitiesPrimaryFilter(context.value);
        return;
      case 'event-scope':
        this.activitiesToolbar.selectActivitiesEventScope(context.value);
        return;
      case 'chat-context':
        this.activitiesToolbar.selectActivitiesChatContextFilter(context.value);
        return;
      case 'rate':
        this.activitiesToolbar.selectActivitiesRateFilter(context.value);
        return;
      case 'rate-social':
        this.activitiesToolbar.toggleRateSocialBadgeForGroup(context.value);
        return;
      case 'secondary':
        this.activitiesToolbar.selectActivitiesSecondaryFilter(context.value);
        return;
      case 'view':
        this.activitiesToolbar.setActivitiesView(context.value, event.sourceEvent);
        return;
      case 'support-case':
        this.selectActivitiesSupportCaseFilter(context.value);
        return;
      case 'quick-action':
        if (context.value === 'explore') {
          this.activitiesToolbar.requestOpenEventExplore();
          return;
        }
        this.activitiesToolbar.requestOpenEventEditor();
        return;
      default:
        return;
    }
  }

  private activitiesSelectTrigger(options: {
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    shape?: AppMenuTrigger['shape'];
    hideLabel?: boolean;
  }): AppMenuTrigger {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      shape: options.shape ?? 'pill',
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
    context: ActivitiesToolbarMenuContext;
  }): AppMenuItem<string, ActivitiesToolbarMenuContext> {
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
    return this.activitiesToolbar.isRateGroupSeparator(label) ? 'violet' : 'blue';
  }

  protected selectActivitiesSupportCaseFilter(filter: ContractTypes.SupportCaseFilter): void {
    if (!this.isAdminServiceChatMode()) {
      return;
    }
    this.activitiesContext.setActivitiesSupportCaseFilter(filter);
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

  private doesChatMatchActiveSupportCaseFilter(chat: ChatRecord): boolean {
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
    this.confirmationDialogService.open({
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

  private applySupportCaseUpdate(chat: ChatRecord): void {
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

  private patchVisibleChatRow(chat: ChatRecord): void {
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

  private buildActivityEventCard(dto: ActivityEventDTO, card = ActivityEventInfoCardConverter.convert(dto, {
    activeUserId: this.activeUser.id
  })): ActivityPopupEventCard {
    const rowType = this.resolveActivityEventCardTypeFromDTO(dto);
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

  private buildActivityEventCardFromRecord(record: ActivityEventRecord): ActivityPopupEventCard {
    return this.buildActivityEventCard(this.activityEventDTOFromRecord(record));
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

  private activityEventDTOFromRecord(record: ActivityEventRecord): ActivityEventDTO {
    return {
      id: record.id,
      userId: record.userId,
      status: record.status,
      statusBeforeSuppression: 'statusBeforeSuppression' in record ? record.statusBeforeSuppression ?? null : undefined,
      adminIds: [...(record.adminIds ?? [])],
      avatar: record.avatar,
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      inviter: record.inviter ?? null,
      unread: record.unread,
      activity: record.activity,
      trashedAtIso: 'trashedAtIso' in record ? record.trashedAtIso ?? null : undefined,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorGender: 'creatorGender' in record ? record.creatorGender : undefined,
      creatorCity: record.creatorCity,
      visibility: record.visibility,
      blindMode: 'blindMode' in record ? record.blindMode : undefined,
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      sourceLink: 'sourceLink' in record ? record.sourceLink : undefined,
      location: record.location,
      locationCoordinates: 'locationCoordinates' in record && record.locationCoordinates
        ? { ...record.locationCoordinates }
        : null,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      capacityTotal: record.capacityTotal,
      autoInviter: 'autoInviter' in record ? record.autoInviter : undefined,
      frequency: 'frequency' in record ? record.frequency : undefined,
      ticketing: record.ticketing,
      pricing: 'pricing' in record ? record.pricing ?? null : undefined,
      policies: 'policies' in record ? (record.policies ?? []).map(policy => ({ ...policy })) : undefined,
      slotsEnabled: 'slotsEnabled' in record ? record.slotsEnabled : undefined,
      slotTemplates: 'slotTemplates' in record ? (record.slotTemplates ?? []).map(item => ({ ...item })) : undefined,
      parentEventId: 'parentEventId' in record ? record.parentEventId ?? null : undefined,
      slotTemplateId: 'slotTemplateId' in record ? record.slotTemplateId ?? null : undefined,
      generated: 'generated' in record ? record.generated : undefined,
      eventType: record.eventType,
      nextSlot: 'nextSlot' in record && record.nextSlot ? { ...record.nextSlot } : ('nextSlot' in record ? null : undefined),
      upcomingSlots: 'upcomingSlots' in record ? (record.upcomingSlots ?? []).map(item => ({ ...item })) : undefined,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      pendingReason: record.pendingReason,
      topics: [...(record.topics ?? [])],
      subEvents: 'subEvents' in record ? this.cloneSyncedSubEventForms(record.subEvents ?? []) : undefined,
      subEventsDisplayMode: 'subEventsDisplayMode' in record ? record.subEventsDisplayMode : undefined,
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity
    };
  }

  private resolveActivityEventCardType(record: ActivityEventRecord): ActivityPopupEventType {
    if (record.isInvitation || record.type === 'invitations') {
      return 'invitations';
    }
    if (record.isHosting || record.type === 'hosting') {
      return 'hosting';
    }
    return 'events';
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

  private sortChatRecords<T extends ChatRecord>(items: readonly T[]): T[] {
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

  private chatMenuMetricScore(chat: ChatRecord): number {
    const unread = Math.max(0, Math.trunc(Number(chat.unread) || 0));
    return unread * 10 + this.activitiesChats.getChatMemberCount(chat);
  }

  private chatRowMetricScore(row: ActivityPopupCard): number {
    return Number.isFinite(row.metricScore)
      ? Math.max(0, Number(row.metricScore))
      : Math.max(0, Math.trunc(Number(row.unread) || 0)) * 10
        + Math.max(0, Math.trunc(Number(row.memberCount) || 0));
  }

  private cloneChatRecord<T extends ChatRecord>(chat: T): T {
    return {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])]
    } as T;
  }

  protected chatRecordForRow(row: ActivityPopupCard): ChatRecord | null {
    const existing = this.chatItems.find(item => item.id === row.id);
    return existing ? this.cloneChatRecord(existing) : null;
  }

  private chatRecordPreviewForRow(row: ActivityPopupCard): ChatRecord | null {
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
  ): Promise<ChatRecord | null> {
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

  private areChatRecordsEqual(left: ChatRecord, right: ChatRecord): boolean {
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

  private hydrateStandaloneEventItems(userId: string): void {
    this.applyStandaloneEventRecords(this.eventsService.peekItemsByUser(userId));
  }

  private async refreshStandaloneEventItems(): Promise<void> {
    const userId = this.activeUser?.id?.trim();
    if (!userId) {
      return;
    }
    try {
      const records = await this.eventsService.queryItemsByUser(userId);
      if (this.activeUser.id.trim() !== userId) {
        return;
      }
      this.applyStandaloneEventRecords(records, true);
      this.refreshSectionBadges();
      this.syncEventOwnerMemberCountsFromEventRows();
      this.cdr.markForCheck();
    } catch {
      // Keep the last cached event state if the refresh fails.
    }
  }

  private applyStandaloneEventRecords(records: readonly ActivityEventRecord[], replaceExisting = false): void {
    const normalizedRecords = Array.isArray(records) ? records.map(record => ({ ...record })) : [];
    if (replaceExisting || this.eventItems.length === 0) {
      this.eventItems = normalizedRecords
        .filter(record => record.type === 'events');
    }
    if (replaceExisting || this.hostingItems.length === 0) {
      this.hostingItems = normalizedRecords
        .filter(record => record.type === 'hosting');
    }
    if (replaceExisting || this.invitationItems.length === 0) {
      this.invitationItems = normalizedRecords
        .filter(record => record.isInvitation);
    }
    this.activeHostingIds = new Set(
      normalizedRecords
        .filter(record => record.type === 'hosting' && this.activityEventRecordStatusCode(record) === 'A')
        .map(record => record.id)
    );
    for (const record of normalizedRecords) {
      if (record.startAtIso) {
        this.activityDateTimeRangeById[record.id] = {
          startIso: record.startAtIso,
          endIso: record.endAtIso
        };
      }
      if (record.type === 'events') {
        this.eventDatesById[record.id] = record.startAtIso;
        this.eventDistanceById[record.id] = record.distanceKm;
      }
      if (record.type === 'hosting') {
        this.hostingDatesById[record.id] = record.startAtIso;
        this.hostingDistanceById[record.id] = record.distanceKm;
      }
      if (record.isTrashed) {
        const row = this.buildActivityEventCardFromRecord(record);
        this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = row;
      }
      if (record.imageUrl?.trim()) {
        this.activityImageById[record.id] = record.imageUrl;
      }
      this.activityCapacityById[record.id] = `${record.acceptedMembers} / ${record.capacityTotal}`;
      this.activityPendingMembersById[record.id] = record.pendingMembers;
      this.eventVisibilityById[record.id] = record.visibility;
      this.eventCapacityById[record.id] = { min: record.capacityMin, max: record.capacityMax };
      if (Array.isArray(record.subEvents) && record.subEvents.length > 0) {
        this.eventSubEventsById[record.id] = record.subEvents.map((item: ContractTypes.SubEventFormItem) => ({
          ...item,
          groups: Array.isArray(item.groups) ? item.groups.map((group: ContractTypes.SubEventGroupItem) => ({ ...group })) : []
        }));
      }
    }
    this.bumpActivitiesEventCardRevision();
  }


  private upsertVisibleEventRowFromSave(sync: ActivityEventSaveDTO): void {
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

  private resolveVisibleEventRowTypeFromSave(sync: ActivityEventSaveDTO): ActivityPopupCard['type'] | null {
    const isActiveLocally = this.activeHostingIds.has(sync.id);
    const existingStatus = this.hostingItems.find(item => item.id === sync.id)?.status
      ?? this.eventItems.find(item => item.id === sync.id)?.status;
    const saveStatus = this.activityEventSaveStatusCode(sync);
    const isPublished = saveStatus === 'A'
      || (saveStatus !== 'DR' && (isActiveLocally || existingStatus === 'A'));
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

  private isAcceptedEventRecord(item: ActivityEventRecord): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || item.isAdmin === true) {
      return false;
    }
    if (this.isPendingReviewEventRecord(item)) {
      return false;
    }
    return this.eventAcceptedMemberUserIds(item).includes(activeUserId);
  }

  private isUpcomingEventRecord(item: ActivityEventRecord): boolean {
    const endAtMs = AppUtils.toSortableDate(item.endAtIso);
    if (Number.isFinite(endAtMs) && endAtMs > 0) {
      return endAtMs > Date.now();
    }
    const startAtMs = AppUtils.toSortableDate(item.startAtIso);
    return !Number.isFinite(startAtMs) || startAtMs > Date.now();
  }

  private isPendingEventRecord(item: ActivityEventRecord): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || item.isAdmin === true) {
      return false;
    }
    if (this.isPendingReviewEventRecord(item)) {
      return true;
    }
    if (this.eventAcceptedMemberUserIds(item).includes(activeUserId)) {
      return false;
    }
    return item.pendingReason === 'approval'
      || item.pendingReason === 'waitlist'
      || this.eventPendingMemberUserIds(item).includes(activeUserId);
  }

  private eventAcceptedMemberUserIds(item: Pick<ActivityEventRecord, 'id'>): string[] {
    return [...(this.activityMembersService.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: item.id
    })?.acceptedMemberUserIds ?? [])];
  }

  private eventPendingMemberUserIds(item: Pick<ActivityEventRecord, 'id'>): string[] {
    return [...(this.activityMembersService.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: item.id
    })?.pendingMemberUserIds ?? [])];
  }

  private isPendingReviewEventRecord(item: ActivityEventRecord): boolean {
    const status = this.activityEventRecordStatusCode(item);
    return status === 'UR' || status === 'B';
  }

  private isTrashScopeEventRecord(item: ActivityEventRecord): boolean {
    const status = this.activityEventRecordStatusCode(item);
    return status === 'T';
  }

  private activityEventRecordStatusCode(item: ActivityEventRecord): string {
    const status = `${item.status ?? ''}`.trim();
    switch (status) {
      case 'A':
        return 'A';
      case 'DR':
        return 'DR';
      case 'T':
        return 'T';
      case 'UR':
        return 'UR';
      case 'B':
        return 'B';
      case 'D':
        return 'D';
      case 'I':
        return 'I';
      default:
        return 'A';
    }
  }

  private activityEventSaveStatusCode(item: Pick<ActivityEventSaveDTO, 'status'>): ActivityEventRecord['status'] {
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
    if (this.isActivityEventSaveResultDTO(sync)) {
      return (sync.eventDTO.adminIds ?? []).includes(activeUserId);
    }
    return `${sync.creatorUserId ?? ''}`.trim() === activeUserId;
  }

  private isPendingEventSave(sync: ActivityEventSaveDTO): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || this.isOwnedEventSave(sync)) {
      return false;
    }
    if (this.pendingCheckoutDraftSourceIds().has(sync.id)) {
      return true;
    }
    return false;
  }

  private isAcceptedEventSave(sync: ActivityEventSaveDTO): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || this.isOwnedEventSave(sync)) {
      return false;
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
    this.activitiesContext.closeActivities();
  }

  // =========================================================================
  // Derived lists (computed on demand – no signals here for compat)
  // =========================================================================

  protected get filteredActivityRows(): ActivityPopupCard[] {
    return [...this.visibleActivityRows];
  }

  private memberEventItems(): ActivityEventRecord[] {
    const pendingDraftItems = this.pendingCheckoutDraftEventRecords();
    const pendingDraftSourceIds = new Set(pendingDraftItems.map(item => item.id));
    return [
      ...this.eventItems
        .filter(item => item.isAdmin !== true)
        .filter(item => !pendingDraftSourceIds.has(item.id)),
      ...pendingDraftItems
    ];
  }

  private pendingCheckoutDraftEventRecords(): ActivityEventRecord[] {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return [];
    }
    return this.eventCheckoutDraftService.listByUser(activeUserId)
      .filter(draft => this.shouldTrackPendingCheckoutDraft(draft))
      .map(draft => this.buildPendingCheckoutDraftEventRecord(draft))
      .filter((item): item is ActivityEventRecord => Boolean(item));
  }

  private buildPendingCheckoutDraftEventRecord(draft: EventCheckoutDraft): ActivityEventRecord | null {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    const sourceId = draft.sourceId.trim();
    if (!activeUserId || !sourceId) {
      return null;
    }
    const checkoutStarted = Boolean(draft.checkoutSessionId?.trim());
    const waitingList = draft.pendingReason === 'waitlist';
    const pendingDescription = waitingList
      ? 'Waiting list.'
      : checkoutStarted
        ? 'Checkout in progress.'
        : 'Waiting for admin approval before payment.';
    const pendingTimeframe = waitingList
      ? 'Waiting for a spot.'
      : checkoutStarted
        ? 'Booking pending.'
        : 'Approval pending.';

    const knownRecord = this.eventsService.peekKnownItemById(activeUserId, sourceId);
    if (!knownRecord) {
      const nowIso = new Date().toISOString();
      return {
        id: sourceId,
        userId: activeUserId,
        type: 'events',
        status: 'A',
        avatar: AppUtils.initialsFromText(draft.eventTitle || 'Pending'),
        title: draft.eventTitle.trim() || 'Pending booking',
        subtitle: pendingDescription,
        timeframe: draft.eventTimeframe.trim() || pendingTimeframe,
        inviter: null,
        unread: 0,
        activity: 0,
        isAdmin: false,
        isInvitation: false,
        isHosting: false,
        isTrashed: false,
        trashedAtIso: null,
        creatorUserId: '',
        creatorName: '',
        creatorInitials: AppUtils.initialsFromText(draft.eventTitle || 'Pending'),
        creatorGender: 'man',
        creatorCity: '',
        visibility: 'Public',
        blindMode: 'Open Event',
        startAtIso: nowIso,
        endAtIso: nowIso,
        distanceKm: 0,
        imageUrl: '',
        sourceLink: '',
        location: '',
        locationCoordinates: null,
        capacityMin: null,
        capacityMax: 1,
        capacityTotal: 1,
        ticketing: draft.lineItems.length > 0 || draft.totalAmount > 0,
        acceptedMembers: 0,
        pendingMembers: 1,
        pendingReason: draft.pendingReason,
        topics: [],
        rating: 0,
        boost: 0,
        affinity: 0
      };
    }

    const item = { ...knownRecord };
    const originalAcceptedMemberUserIds = this.uniqueUserIds(this.eventAcceptedMemberUserIds(item));
    const originalPendingMemberUserIds = this.uniqueUserIds(this.eventPendingMemberUserIds(item));
    const acceptedMemberUserIds = originalAcceptedMemberUserIds.filter(userId => userId !== activeUserId);
    const pendingMemberUserIds = this.uniqueUserIds([
      ...originalPendingMemberUserIds.filter(userId => userId !== activeUserId),
      activeUserId
    ]);
    const acceptedMembers = Math.max(
      acceptedMemberUserIds.length,
      Math.max(
        0,
        this.chatCountValue(item.acceptedMembers) - (originalAcceptedMemberUserIds.includes(activeUserId) ? 1 : 0)
      )
    );
    const pendingMembers = Math.max(
      pendingMemberUserIds.length,
      Math.max(
        0,
        this.chatCountValue(item.pendingMembers) + (originalPendingMemberUserIds.includes(activeUserId) ? 0 : 1)
      )
    );

    return {
      ...item,
      isAdmin: false,
      title: item.title.trim() || draft.eventTitle.trim() || 'Pending booking',
      subtitle: item.subtitle.trim() || pendingDescription,
      timeframe: item.timeframe.trim() || draft.eventTimeframe.trim() || pendingTimeframe,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(
        acceptedMembers,
        this.chatCountValue(item.capacityTotal ?? item.capacityMax)
      ),
      pendingReason: draft.pendingReason
    };
  }

  private pendingCheckoutDraftSourceIds(): Set<string> {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return new Set<string>();
    }
    return new Set(
      this.eventCheckoutDraftService.listByUser(activeUserId)
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
    return this.activitiesEventScopeFilters.find(option => option.key === this.activitiesEventScope)?.label ?? 'Active Events';
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

  protected trackByActivityGroup(_index: number, group: AppTypes.ActivityGroup): string {
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

  protected isEventStyleActivity(row: ActivityPopupCard): boolean {
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
    const record = this.activityEventRecordForRow(row);
    return record
      ? {
          ...this.buildActivityEventCardFromRecord(record),
          metricScore: row.metricScore
        }
      : row;
  }

  protected refreshActivityEventInfoCard(row: ActivityPopupCard): void {
    Object.assign(row, this.withActivityEventInfoCard(row));
  }

  private activityEventRecordForRow(row: ActivityPopupCard): ActivityEventRecord | null {
    if (row.type === 'hosting') {
      return this.hostingItems.find(item => item.id === row.id)
        ?? this.eventItems.find(item => item.id === row.id)
        ?? this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    }
    if (row.type === 'invitations') {
      return this.invitationItems.find(item => item.id === row.id)
        ?? this.eventItems.find(item => item.id === row.id)
        ?? this.hostingItems.find(item => item.id === row.id)
        ?? this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
    }
    return this.eventItems.find(item => item.id === row.id)
      ?? this.hostingItems.find(item => item.id === row.id)
      ?? this.invitationItems.find(item => item.id === row.id)
      ?? this.eventsService.peekKnownItemById(this.activeUser.id, row.id);
  }

  private activityMembersOwnerForRow(row: ActivityPopupCard): ActivityMemberOwnerRef {
    return ActivityMembersBuilder.activityMembersOwnerForRow(row) ?? {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  private resolveActivityMembersPopupSummary(row: ActivityPopupCard): ActivityMembersSummary | null {
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

  private activityCapacityTotal(row: ActivityPopupCard, fallbackBase = 0): number {
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

  private resolveInvitationActivityMembersRow(row: ActivityPopupCard): ActivityPopupCard {
    if (row.type !== 'invitations') {
      return row;
    }
    const matchingRecord = this.eventItems.find(item => item.id === row.id)
      ?? this.hostingItems.find(item => item.id === row.id)
      ?? this.invitationItems.find(item => item.id === row.id)
      ?? null;
    return matchingRecord ? this.buildActivityEventCardFromRecord(matchingRecord) : row;
  }

  private buildActivityMembersFromKnownUserIds(
    row: ActivityPopupCard,
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

  private applyActivityMembersSummary(row: ActivityPopupCard, summary: ActivityMembersSummary): void {
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
      const record = this.activityEventRecordForRow(row);
      return record
        ? {
            ...this.buildActivityEventCardFromRecord({
              ...record,
              acceptedMembers,
              pendingMembers,
              capacityTotal
            }),
            metricScore: row.metricScore
          }
        : row;
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

  private applyActivityMembersSummaryToRow(row: ActivityPopupCard, summary: ActivityMembersSummary): void {
    if (!this.isEventStyleActivity(row)) {
      return;
    }
    const record = this.activityEventRecordForRow(row);
    if (!record) {
      return;
    }
    Object.assign(row, this.buildActivityEventCardFromRecord({
      ...record,
      acceptedMembers: summary.acceptedMembers,
      pendingMembers: summary.pendingMembers,
      capacityTotal: summary.capacityTotal
    }));
  }

  private async loadActivityMembersForRow(
    owner: ActivityMemberOwnerRef,
    row: ActivityPopupCard,
    rowSelectionId: string
  ): Promise<void> {
    const members = await this.activityMembersService.queryMembersByOwner(owner);
    if (this.selectedActivityMembersRowId !== rowSelectionId || this.selectedActivityMembersRow?.id !== row.id) {
      return;
    }
    this.selectedActivityMembers = ActivityMembersBuilder.sortActivityMembersByActionTimeAsc(members);
    this.activityMembersByRowId[rowSelectionId] = [...this.selectedActivityMembers];
    const summary = ActivityMembersBuilder.buildActivityMembersSummary(
      owner,
      members,
      this.activityCapacityTotal(row, members.filter(member => member.status === 'accepted').length)
    );
    this.applyActivityMembersSummary(row, summary);
    this.cdr.markForCheck();
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
    const eventRecords = [
      ...this.eventItems.map(item => ({
        id: item.id,
        row: this.buildActivityEventCardFromRecord(item),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      })),
      ...this.hostingItems.map(item => ({
        id: item.id,
        row: this.buildActivityEventCardFromRecord(item),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      })),
      ...this.invitationItems.map(item => ({
        id: item.id,
        row: this.buildActivityEventCardFromRecord(item),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      }))
    ];
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
      target.closest('[data-rating-star-bar-dock]')
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
    this.visibleActivityRows = [];
    this.visibleActivityRowsSource = null;
    this.activitiesStickyValue = '';
    this.activitiesContext.setActivitiesStickyValue('');
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

  protected isHostingPublished(id: string): boolean {
    return this.activeHostingIds.has(id);
  }

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
    const saveStatus = this.activityEventSaveStatusCode(sync);
    const isOwned = this.isOwnedEventSave(sync);
    const shouldKeepMemberEventRecord = !isOwned || saveStatus === 'A';
    let eventUpdated = false;
    let hostingUpdated = false;

    this.eventItems = this.eventItems
      .map(item => {
        if (item.id !== sync.id) {
          return item;
        }
        eventUpdated = true;
        return this.activityDisplayRecordForSave(sync, item, 'events');
      })
      .filter(item => shouldKeepMemberEventRecord || item.id !== sync.id);

    this.hostingItems = this.hostingItems.map(item => {
      if (item.id !== sync.id) {
        return item;
      }
      hostingUpdated = true;
      return this.activityDisplayRecordForSave(sync, item, 'hosting');
    });

    if (shouldKeepMemberEventRecord && !eventUpdated) {
      this.eventItems = [this.activityDisplayRecordForSave(sync, undefined, 'events'), ...this.eventItems];
    }

    if (isOwned && !hostingUpdated) {
      this.hostingItems = [this.activityDisplayRecordForSave(sync, undefined, 'hosting'), ...this.hostingItems];
    }

    this.activityDateTimeRangeById[sync.id] = {
      startIso: sync.startAt,
      endIso: sync.endAt ?? sync.startAt
    };
    this.eventDatesById[sync.id] = sync.startAt;
    this.hostingDatesById[sync.id] = sync.startAt;
    this.eventDistanceById[sync.id] = sync.distanceKm;
    this.hostingDistanceById[sync.id] = sync.distanceKm;
    if (isOwned) {
      const nextActiveIds = new Set(this.activeHostingIds);
      if (saveStatus === 'A') {
        nextActiveIds.add(sync.id);
      } else {
        nextActiveIds.delete(sync.id);
      }
      this.activeHostingIds = nextActiveIds;
    }
    if (sync.imageUrl.trim().length > 0) {
      this.activityImageById[sync.id] = sync.imageUrl;
    } else {
      delete this.activityImageById[sync.id];
    }
    if (sync.visibility) {
      this.eventVisibilityById[sync.id] = sync.visibility;
    }
    if (sync.capacityMin !== undefined || sync.capacityMax !== undefined) {
      const existingCapacity = this.eventCapacityById[sync.id] ?? { min: 0, max: 0 };
      this.eventCapacityById[sync.id] = {
        min: sync.capacityMin ?? existingCapacity.min,
        max: sync.capacityMax ?? existingCapacity.max
      };
    }
    if (Array.isArray(sync.subEvents)) {
      this.eventSubEventsById[sync.id] = this.cloneSyncedSubEventForms(sync.subEvents);
    }
    this.reconcileInvitationItemsFromEventSave(sync);

    this.patchVisibleActivityRowsFromEventSave(sync);
    this.upsertVisibleEventRowFromSave(sync);
    this.applyActivitiesEventMemberSnapshot(sync);
    this.bumpActivitiesEventCardRevision(`events:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`hosting:${sync.id}`);
    this.bumpActivitiesEventCardRevision(`invitations:${sync.id}`);
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

  private reconcileInvitationItemsFromEventSave(sync: ActivityEventSaveDTO): void {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    this.invitationItems = this.invitationItems.filter(item => item.id !== sync.id);
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  private buildSavedEventRecord(
    sync: ActivityEventSaveDTO,
    existing?: ActivityEventRecord,
    type: ActivityPopupEventType = 'events'
  ): ActivityEventRecord {
    const imageUrl = sync.imageUrl.trim();
    const acceptedMembers = Number.isFinite(Number(sync.acceptedMembers))
      ? Math.max(0, Math.trunc(Number(sync.acceptedMembers)))
      : this.chatCountValue(existing?.acceptedMembers);
    const pendingMembers = Number.isFinite(Number(sync.pendingMembers))
      ? Math.max(0, Math.trunc(Number(sync.pendingMembers)))
      : this.chatCountValue(existing?.pendingMembers);
    const capacityTotal = Number.isFinite(Number(sync.capacityTotal))
      ? Math.max(acceptedMembers, Math.trunc(Number(sync.capacityTotal)))
      : Math.max(acceptedMembers, this.chatCountValue(existing?.capacityTotal ?? existing?.capacityMax));
    const requestedStatus = this.activityEventSaveStatusCode(sync);
    const existingStatus = existing ? this.activityEventRecordStatusCode(existing) : 'A';
    const status: ActivityEventRecord['status'] = requestedStatus === 'DR'
      ? 'DR'
      : existingStatus !== 'DR'
        ? existingStatus as ActivityEventRecord['status']
        : 'A';
    return {
      id: sync.id,
      userId: existing?.userId ?? this.activeUser.id,
      type,
      status,
      statusBeforeSuppression: existing?.statusBeforeSuppression ?? null,
      avatar: existing?.avatar ?? sync.creatorInitials ?? AppUtils.initialsFromText(sync.title),
      title: sync.title,
      subtitle: sync.shortDescription,
      timeframe: sync.timeframe,
      inviter: existing?.inviter ?? null,
      unread: existing?.unread ?? Math.max(0, Math.trunc(Number(sync.activity) || 0)),
      activity: sync.activity,
      isAdmin: existing?.isAdmin ?? type === 'hosting',
      isInvitation: type === 'invitations',
      isHosting: type === 'hosting',
      isTrashed: existing?.isTrashed ?? false,
      trashedAtIso: existing?.trashedAtIso ?? null,
      creatorUserId: sync.creatorUserId ?? existing?.creatorUserId ?? this.activeUser.id,
      creatorName: sync.creatorName ?? existing?.creatorName ?? sync.title,
      creatorInitials: sync.creatorInitials ?? existing?.creatorInitials ?? AppUtils.initialsFromText(sync.title),
      creatorGender: sync.creatorGender ?? existing?.creatorGender ?? 'man',
      creatorCity: sync.creatorCity ?? existing?.creatorCity ?? '',
      visibility: sync.visibility ?? existing?.visibility ?? 'Public',
      blindMode: sync.blindMode ?? existing?.blindMode ?? 'Open Event',
      startAtIso: sync.startAt,
      endAtIso: sync.endAt ?? sync.startAt,
      distanceKm: sync.distanceKm,
      imageUrl: imageUrl || existing?.imageUrl || '',
      sourceLink: sync.sourceLink?.trim() || existing?.sourceLink || '',
      location: sync.location?.trim() || existing?.location || '',
      locationCoordinates: sync.locationCoordinates ?? existing?.locationCoordinates ?? null,
      capacityMin: sync.capacityMin ?? existing?.capacityMin ?? null,
      capacityMax: sync.capacityMax ?? existing?.capacityMax ?? null,
      capacityTotal,
      autoInviter: sync.autoInviter ?? existing?.autoInviter,
      frequency: sync.frequency ?? existing?.frequency,
      ticketing: sync.ticketing ?? existing?.ticketing ?? false,
      pricing: sync.pricing ?? existing?.pricing ?? null,
      policies: Array.isArray(sync.policies) ? sync.policies.map(policy => ({ ...policy })) : (existing?.policies ? existing.policies.map(policy => ({ ...policy })) : []),
      slotsEnabled: sync.slotsEnabled ?? existing?.slotsEnabled,
      slotTemplates: Array.isArray(sync.slotTemplates)
        ? this.cloneSyncedSlotTemplates(sync.slotTemplates)
        : this.cloneSyncedSlotTemplates(existing?.slotTemplates),
      parentEventId: sync.parentEventId ?? existing?.parentEventId,
      slotTemplateId: sync.slotTemplateId ?? existing?.slotTemplateId,
      generated: sync.generated ?? existing?.generated,
      eventType: sync.eventType ?? existing?.eventType,
      nextSlot: sync.nextSlot ? { ...sync.nextSlot } : (existing?.nextSlot ? { ...existing.nextSlot } : null),
      upcomingSlots: Array.isArray(sync.upcomingSlots)
        ? sync.upcomingSlots.map(item => ({ ...item }))
        : (existing?.upcomingSlots ? existing.upcomingSlots.map((item: ContractTypes.EventSlotOccurrence) => ({ ...item })) : undefined),
      topics: Array.isArray(sync.topics) ? [...sync.topics] : [...(existing?.topics ?? [])],
      subEvents: Array.isArray(sync.subEvents)
        ? this.cloneSyncedSubEventForms(sync.subEvents)
        : (existing?.subEvents ? this.cloneSyncedSubEventForms(existing.subEvents) : undefined),
      subEventsDisplayMode: sync.subEventsDisplayMode ?? existing?.subEventsDisplayMode,
      acceptedMembers,
      pendingMembers,
      pendingReason: existing?.pendingReason ?? null,
      rating: existing?.rating ?? 0,
      boost: existing?.boost ?? 0,
      affinity: existing?.affinity ?? 0
    };
  }

  private activityDisplayRecordForSave(
    sync: ActivityEventSaveMessage,
    existing: ActivityEventRecord | undefined,
    type: ActivityPopupEventType
  ): ActivityEventRecord {
    return this.buildSavedEventRecord(sync, existing, type);
  }

  private activityDisplayRowForSave(
    sync: ActivityEventSaveMessage,
    rowType: ActivityPopupEventType,
    existingRow: ActivityPopupCard | null
  ): ActivityPopupEventCard {
    if (this.isActivityEventSaveResultDTO(sync) && this.resolveActivityEventCardTypeFromDTO(sync.eventDTO) === rowType) {
      const row = this.buildActivityEventCard(sync.eventDTO);
      return {
        ...row,
        metricScore: existingRow?.metricScore ?? row.metricScore
      };
    }
    const record = this.activityDisplayRecordForSave(
      sync,
      rowType === 'hosting'
        ? this.hostingItems.find(item => item.id === sync.id)
        : this.eventItems.find(item => item.id === sync.id),
      rowType === 'hosting' ? 'hosting' : 'events'
    );
    const row = this.buildActivityEventCardFromRecord(record);
    return {
      ...row,
      metricScore: existingRow?.metricScore ?? row.metricScore
    };
  }

  private isActivityEventSaveResultDTO(sync: ActivityEventSaveMessage): sync is ActivityEventSaveResultDTO {
    return Boolean((sync as ActivityEventSaveResultDTO).eventDTO);
  }

  protected cloneSyncedSubEventForms(items: readonly ContractTypes.SubEventFormItem[]): ContractTypes.SubEventFormItem[] {
    return items.map(item => ({
      ...item,
      groups: Array.isArray(item.groups)
        ? item.groups.map(group => ({ ...group }))
        : []
    }));
  }

  protected cloneSyncedSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplate[] | null | undefined
  ): ContractTypes.EventSlotTemplate[] | undefined {
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
    const acceptedRaw = Number(sync.acceptedMembers);
    const pendingRaw = Number(sync.pendingMembers);
    const hasAccepted = Number.isFinite(acceptedRaw);
    const hasPending = Number.isFinite(pendingRaw);
    if (!hasAccepted && !hasPending) {
      return;
    }
    const acceptedMembers = hasAccepted ? Math.max(0, Math.trunc(acceptedRaw)) : 0;
    const pendingMembers = hasPending ? Math.max(0, Math.trunc(pendingRaw)) : 0;
    const eventSource = this.eventItems.find(item => item.id === sync.id)
      ?? this.activityDisplayRecordForSave(sync, undefined, 'events');
    const hostingSource = this.hostingItems.find(item => item.id === sync.id)
      ?? this.activityDisplayRecordForSave(sync, undefined, 'hosting');
    const capacityRaw = Number(sync.capacityTotal);
    const capacityTotal = Number.isFinite(capacityRaw)
      ? Math.max(acceptedMembers, Math.trunc(capacityRaw))
      : Math.max(
        acceptedMembers,
        this.chatCountValue(eventSource.capacityTotal || hostingSource.capacityTotal || eventSource.capacityMax || hostingSource.capacityMax)
      );
    this.activityCapacityById[sync.id] = `${acceptedMembers} / ${capacityTotal}`;
    this.activityPendingMembersById[sync.id] = pendingMembers;

    const eventRow = this.buildActivityEventCardFromRecord(eventSource);
    const hostingRow = this.buildActivityEventCardFromRecord(hostingSource);

    const persistedSummary = this.activityMembersService.peekSummaryByOwner({
      ownerType: 'event',
      ownerId: sync.id
    });
    const acceptedMemberUserIds = this.uniqueUserIds(persistedSummary?.acceptedMemberUserIds ?? []);
    const pendingMemberUserIds = this.uniqueUserIds(persistedSummary?.pendingMemberUserIds ?? [])
      .filter(userId => !acceptedMemberUserIds.includes(userId));
    const summary: ActivityMembersSummary = {
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
      adminServiceOnly: this.activitiesContext.activitiesAdminServiceOnly()
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
      this.activitiesContext.setActivitiesStickyValue(change.stickyLabel);
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
      this.refreshRateItems();
      return {
        items: this.buildActivityRateCards(page.items, page.context?.users ?? this.users),
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }
    if (requestedPrimaryFilter === 'events' || requestedPrimaryFilter === 'hosting' || requestedPrimaryFilter === 'invitations') {
      const page = await this.activitiesService.loadActivityEvents(query, {
        signal: context?.signal
      });
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
    return {
      items: this.buildActivityChatCards(page.items),
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }
}
