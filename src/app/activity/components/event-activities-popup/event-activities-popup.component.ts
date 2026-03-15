import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

import { LazyBgImageDirective } from '../../../shared/lazy-bg-image.directive';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import {
  APP_DEMO_DATA,
  DEMO_CHAT_BY_USER,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  DEMO_USERS,
  RateMenuItem,
  type ChatMenuItem,
  type EventMenuItem,
  type HostingMenuItem,
  type InvitationMenuItem,
  type DemoUser
} from '../../../shared/demo-data';
import { AppCalendarHelpers } from '../../../shared/app-calendar-helpers';
import { AppDemoGenerators } from '../../../shared/app-demo-generators';
import { AppUtils } from '../../../shared/app-utils';
import { ActivitiesDbContextService } from '../../../shared/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import type { ActivitiesEventSyncPayload, ActivitiesPageRequest, EventChatContext, EventChatResourceContext } from '../../../shared/activities-models';
import type * as AppTypes from '../../../shared/app-types';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemSelectEvent,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { EventChatPopupComponent } from '../event-chat-popup/event-chat-popup.component';
import { EventMembersPopupComponent, type EventMembersPopupPresenter } from '../event-members-popup/event-members-popup.component';

// ---------------------------------------------------------------------------

interface ActivitiesSmartListFilters {
  primaryFilter?: unknown;
  secondaryFilter?: unknown;
  chatContextFilter?: unknown;
  hostingPublicationFilter?: unknown;
  rateFilter?: unknown;
}

@Component({
  selector: 'app-event-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    LazyBgImageDirective,
    SmartListComponent,
    EventChatPopupComponent,
    EventMembersPopupComponent
  ],
  templateUrl: './event-activities-popup.component.html',
  styleUrl: './event-activities-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventActivitiesPopupComponent implements OnDestroy {
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  // ── injected ──────────────────────────────────────────────────────────────
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly eventEditorService = inject(EventEditorService);

  // ── Self-contained data state (no host inputs) ───────────────────────────
  protected isMobileView = false;
  protected readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected activeUser: DemoUser = this.users[0] ?? DEMO_USERS[0];

  protected chatItems: ChatMenuItem[] = [...(DEMO_CHAT_BY_USER[this.activeUser.id] ?? [])];
  protected eventItems: EventMenuItem[] = [...(DEMO_EVENTS_BY_USER[this.activeUser.id] ?? [])];
  protected hostingItems: HostingMenuItem[] = [...(DEMO_HOSTING_BY_USER[this.activeUser.id] ?? [])];
  protected invitationItems: InvitationMenuItem[] = [...(DEMO_INVITATIONS_BY_USER[this.activeUser.id] ?? [])];
  protected assetCards: AppTypes.AssetCard[] = AppDemoGenerators.buildSampleAssetCards(this.users);
  protected get rateItems(): RateMenuItem[] {
    return this.generatedRateItemsForUser(this.activeUser.id);
  }

  protected chatBadge = this.activeUser.activities.chat;
  protected eventsBadge = this.activeUser.activities.events;
  protected hostingBadge = this.activeUser.activities.hosting;
  protected invitationsBadge = this.activeUser.activities.invitations;
  protected gameBadge = this.activeUser.activities.game;

  protected publishedHostingIds: ReadonlySet<string> = this.defaultPublishedHostingIds();

  protected activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange> = { ...APP_DEMO_DATA.activityDateTimeRangeById };

  protected chatDatesById: Record<string, string> = { ...APP_DEMO_DATA.chatDatesById };
  protected eventDatesById: Record<string, string> = { ...APP_DEMO_DATA.eventDatesById };
  protected hostingDatesById: Record<string, string> = { ...APP_DEMO_DATA.hostingDatesById };
  protected invitationDatesById: Record<string, string> = { ...APP_DEMO_DATA.invitationDatesById };

  protected chatDistanceById: Record<string, number> = { ...APP_DEMO_DATA.chatDistanceById };
  protected eventDistanceById: Record<string, number> = { ...APP_DEMO_DATA.eventDistanceById };
  protected hostingDistanceById: Record<string, number> = { ...APP_DEMO_DATA.hostingDistanceById };
  protected invitationDistanceById: Record<string, number> = { ...APP_DEMO_DATA.invitationDistanceById };
  protected readonly activityImageById: Record<string, string> = { ...APP_DEMO_DATA.activityImageById };
  protected readonly activitySourceLinkById: Record<string, string> = { ...APP_DEMO_DATA.activitySourceLinkById };
  protected readonly activityCapacityById: Record<string, string> = { ...APP_DEMO_DATA.activityCapacityById };
  protected readonly eventVisibilityById: Record<string, AppTypes.EventVisibility> = { ...APP_DEMO_DATA.eventVisibilityById };
  private readonly eventCapacityById: Record<string, AppTypes.EventCapacityRange> = {};
  private readonly eventSubEventsById: Record<string, AppTypes.SubEventFormItem[]> = {};
  private readonly acceptedOptionalSubEventMembersByKey: Record<string, string[]> = {};
  private readonly acceptedTournamentGroupMembersByKey: Record<string, string[]> = {};
  private readonly subEventAssignedAssetIdsByKey: Record<string, string[]> = {};
  private readonly activityMembersByRowId: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  private readonly forcedAcceptedMembersByRowKey: Record<string, number> = { 'events:e8': 20 };
  private readonly generatedRateItemsByUser: Record<string, RateMenuItem[]> = {};

  // ── Outputs kept for direct-template usage; not used via ngComponentOutlet ─
  /** User clicked on a chat row. */
  @Output() openChatItem = new EventEmitter<ChatMenuItem>();

  /** User clicked on an event/hosting/invitation row. */
  @Output() openActivityRow = new EventEmitter<AppTypes.ActivityListRow>();

  /** User opened members of a row. */
  @Output() openActivityMembersEvent = new EventEmitter<{ row: AppTypes.ActivityListRow; event?: Event }>();

  // ── ViewChild refs ────────────────────────────────────────────────────────
  @ViewChild('activitiesScroll')
  private activitiesScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesSmartList')
  private activitiesSmartList?: SmartListComponent<AppTypes.ActivityListRow>;

  @ViewChild('activitiesCalendarScroll')
  private activitiesCalendarScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesRatesPairFullscreenStack')
  private activitiesRatesPairFullscreenStackRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesRatesPairFullscreenGrid')
  private activitiesRatesPairFullscreenGridRef?: ElementRef<HTMLDivElement>;

  // ── Static data ───────────────────────────────────────────────────────────
  protected readonly activityRatingScale   = APP_STATIC_DATA.activityRatingScale;
  protected readonly activitiesPrimaryFilters: Array<{ key: AppTypes.ActivitiesPrimaryFilter; label: string; icon: string }>
    = [...APP_DEMO_DATA.activitiesPrimaryFilters];
  protected readonly activitiesSecondaryFilters: Array<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }>
    = [...APP_DEMO_DATA.activitiesSecondaryFilters];
  protected readonly activitiesChatContextFilters: Array<{ key: AppTypes.ActivitiesChatContextFilter; label: string; icon: string }>
    = [...APP_DEMO_DATA.activitiesChatContextFilters];
  protected readonly rateFilters: Array<{ key: AppTypes.RateFilterKey; label: string }>
    = [...APP_DEMO_DATA.rateFilters];
  protected readonly rateFilterEntries: AppTypes.RateFilterEntry[]
    = [...APP_DEMO_DATA.rateFilterEntries];
  protected readonly activitiesViewOptions: Array<{ key: AppTypes.ActivitiesView; label: string; icon: string }>
    = [...APP_DEMO_DATA.activitiesViewOptions];

  // ── Filter / view state – backed by EventEditorService signals ───────────
  // Local copies are kept in sync via an effect() so that OnPush CD fires
  // correctly without needing toSignal() everywhere in the template.
  protected activitiesPrimaryFilter: AppTypes.ActivitiesPrimaryFilter        = 'chats';
  protected activitiesChatContextFilter: AppTypes.ActivitiesChatContextFilter = 'all';
  protected activitiesSecondaryFilter: AppTypes.ActivitiesSecondaryFilter    = 'recent';
  protected hostingPublicationFilter: AppTypes.HostingPublicationFilter       = 'all';
  protected activitiesRateFilter: AppTypes.RateFilterKey                     = 'individual-given';
  protected activitiesView: AppTypes.ActivitiesView                          = 'day';
  protected showActivitiesViewPicker     = false;
  protected showActivitiesSecondaryPicker = false;
  protected showActivitiesPrimaryPicker = false;
  protected showActivitiesChatContextPicker = false;
  protected showActivitiesRatePicker      = false;
  protected activitiesSmartListFilters: Record<string, unknown> = {};
  protected readonly activitiesSmartListConfig: SmartListConfig<AppTypes.ActivityListRow> = {
    pageSize: 10,
    loadingDelayMs: 1000,
    defaultView: 'day',
    views: [
      { key: 'day', label: 'Day', mode: 'list', pageSize: 10 },
      { key: 'distance', label: 'Distance', mode: 'list', pageSize: 10 },
      { key: 'week', label: 'Week', mode: 'week', pageSize: 240 },
      { key: 'month', label: 'Month', mode: 'month', pageSize: 240 }
    ],
    trackBy: (_index, row) => row.id,
    groupBy: row => AppUtils.activityGroupLabel(
      row,
      this.activitiesView,
      APP_DEMO_DATA.activityGroupLabels
    ),
    calendar: {
      weekdayLabels: APP_STATIC_DATA.calendarWeekdayLabels,
      weekStartHour: 0,
      weekEndHour: 23,
      anchorRadius: 2,
      resolveDateRange: row => AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById),
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
      if (this.shouldApplyEventActivityGroupMarkerRules() && !scrollable) {
        return false;
      }
      return true;
    }
  };
  protected readonly activitiesSmartListLoaders: SmartListLoaders<AppTypes.ActivityListRow> = {
    day: query => from(this.resolveActivitiesSmartListPage(query)),
    distance: query => from(this.resolveActivitiesSmartListPage(query)),
    week: query => from(this.resolveActivitiesSmartListCalendarPage(query)),
    month: query => from(this.resolveActivitiesSmartListCalendarPage(query))
  };

  // ── Inline action menu ────────────────────────────────────────────────────
  protected inlineItemActionMenu: {
    scope: 'activity' | 'activityMember';
    id: string;
    title: string;
    openUp: boolean;
  } | null = null;

  // ── Scroll / sticky ───────────────────────────────────────────────────────
  protected activitiesListScrollable  = true;
  protected activitiesStickyValue     = '';
  protected activitiesInitialLoadPending = false;
  protected readonly activitiesPageSize  = 10;

  // ── Rate editor dock ──────────────────────────────────────────────────────
  protected selectedActivityRateId: string | null  = null;
  protected isActivityRateBarBlinking              = false;
  private activityRateEditorClosing                = false;
  private activityRateEditorCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activityRateEditorSlideDurationMs = 180;
  private activityRateEditorOpenScrollTop: number | null = null;
  private lastActivityRateEditorLiftDelta = 0;
  private readonly activityRateBlinkUntilByRowId: Record<string, number>                          = {};
  private readonly activityRateBlinkTimeoutByRowId: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private readonly activityRateDraftById: Record<string, number>                                  = {};
  private readonly activityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private activityRateBarBlinkTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Rate card images ──────────────────────────────────────────────────────
  private readonly activityRateCardActiveImageIndexById: Record<string, number>                        = {};
  private readonly activityRateCardImageLoadingById: Record<string, boolean>                           = {};
  private readonly activityRateCardLoadingTimerById: Record<string, ReturnType<typeof setTimeout>>     = {};
  private readonly activityPairRateCardActiveImageIndexByKey: Record<string, number>                   = {};
  private readonly activityPairRateCardImageLoadingByKey: Record<string, boolean>                      = {};
  private readonly activityPairRateCardLoadingTimerByKey: Record<string, ReturnType<typeof setTimeout>> = {};
  private lastRateIndicatorPulseRowId: string | null = null;

  // ── Fullscreen rates ──────────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;
  protected activitiesRatesFullscreenCardIndex    = 0;
  protected activitiesRatesFullscreenAnimating    = false;
  protected activitiesRatesFullscreenLeavingRow: AppTypes.ActivityListRow | null = null;
  protected isActivitiesRatesPairSplitDragging    = false;
  protected activitiesRatesPairSplitPercent       = EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT;
  private readonly activitiesRatesFullscreenLeaveTimeoutMs = 440;
  private activitiesRatesFullscreenAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesRatesFullscreenLoadStateKey              = '';
  private activitiesRatesFullscreenLastTriggeredLoadedCount  = 0;
  private activitiesRatesPairSplitPointerId: number | null   = null;
  private activitiesRatesPairSplitBounds: { left: number; width: number } | null = null;
  private activitiesRatesPairSplitDragStartClientX: number | null = null;
  private activitiesRatesPairSplitDragStartPercent: number | null = null;

  // ── Delete / publish confirms ─────────────────────────────────────────────
  protected pendingActivityDeleteRow: AppTypes.ActivityListRow | null  = null;
  protected pendingActivityPublishRow: AppTypes.ActivityListRow | null = null;
  protected pendingActivityAction: 'delete' | 'exit'                   = 'delete';
  protected stackedActivitiesPopup: 'activityMembers' | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected pendingActivityMemberDelete: AppTypes.ActivityMemberEntry | null = null;
  protected selectedActivityMembers: AppTypes.ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRow: AppTypes.ActivityListRow | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  protected readonly activityMembersPopupPresenter: EventMembersPopupPresenter = {
    toneClass: entry => this.memberCardToneClass(entry),
    statusClass: entry => this.memberCardStatusClass(entry),
    statusLabel: entry => this.memberCardStatusLabel(entry),
    statusIcon: entry => this.memberCardStatusIcon(entry),
    age: entry => this.activityMemberAge(entry),
    roleLabel: entry => this.activityMemberRoleLabel(entry),
    pendingStatusLabel: entry => this.activityMemberStatusLabel(entry),
    canShowActionMenu: entry => this.canShowActivityMemberActionMenu(entry),
    isActionMenuOpen: entry => this.isActivityMemberActionMenuOpen(entry),
    isActionMenuOpenUp: entry => this.isActivityMemberActionMenuOpenUp(entry),
    canApprove: entry => this.canApproveActivityMember(entry),
    canDelete: entry => this.canDeleteActivityMember(entry),
    deleteLabel: entry => this.activityMemberMenuDeleteLabel(entry),
    canEditRole: () => false,
    roleIcon: () => 'manage_accounts',
    roleMenuLabel: () => 'Change role',
    isRolePickerOpen: () => false
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  protected readonly calendarWeekdayLabels = APP_STATIC_DATA.calendarWeekdayLabels;
  private readonly weekCalendarStartHour = 0;
  private readonly weekCalendarEndHour = 23;
  protected readonly calendarWeekHours = Array.from(
    { length: this.weekCalendarEndHour - this.weekCalendarStartHour + 1 },
    (_, index) => this.weekCalendarStartHour + index
  );
  private calendarMonthFocusDate: Date | null = null;
  private calendarWeekFocusDate: Date | null = null;
  private calendarEdgeSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private calendarPostSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private calendarInitialPageIndexOverride: number | null = null;
  private suppressCalendarEdgeSettle = false;
  private calendarMonthAnchorPages: Date[] | null = null;
  private calendarWeekAnchorPages: Date[] | null = null;
  private get calendarAnchorRadius(): number {
    return this.isMobileView ? 1 : 2;
  }
  private get calendarAnchorWindowSize(): number {
    return (this.calendarAnchorRadius * 2) + 1;
  }
  private calendarMonthAnchorsHydrated = false;
  private calendarWeekAnchorsHydrated = false;
  private calendarMonthPagesCacheKey = '';
  private calendarWeekPagesCacheKey = '';
  private calendarMonthPagesCache: AppTypes.CalendarMonthPage[] = [];
  private calendarWeekPagesCache: AppTypes.CalendarWeekPage[] = [];
  private activitiesCalendarBadgesTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesCalendarBadgesLoadingActive = false;
  private activitiesCalendarBadgesLoadingDelayKey = '';
  private readonly activitiesCalendarBadgesReadyDelayKeys = new Set<string>();
  private activitiesCalendarBadgeDelayPageKey = '';

  // ── Pagination ────────────────────────────────────────────────────────────
  private activitiesVisibleCount    = this.activitiesPageSize;
  private activitiesPaginationKey   = '';
  private activitiesLoadMoreTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesIsPaginating    = false;
  private activitiesPaginationAwaitScrollReset = false;
  private serverPageRows: AppTypes.ActivityListRow[] = [];
  private serverPageTotalRows = 0;
  private serverPageIndex = 0;
  private serverPageStateKey = '';
  private readonly activitiesPaginationLoadDelayMs = 1000;

  // ── Header progress ───────────────────────────────────────────────────────
  protected activitiesHeaderProgress         = 0;
  protected activitiesHeaderProgressLoading  = false;
  protected activitiesHeaderLoadingProgress  = 0;
  protected activitiesHeaderLoadingOverdue   = false;
  private activitiesHeaderLoadingCounter     = 0;
  private activitiesHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private activitiesHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activitiesHeaderLoadingWindowMs = 3000;
  private readonly activitiesHeaderLoadingTickMs   = 16;
  private activitiesHeaderLoadingStartedAtMs       = 0;
  private activitiesHeaderFlushScheduled           = false;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  constructor() {
    this.hydrateStandaloneFallbackState();
    this.syncMobileViewFromViewport();

    // Sync service signal state → local properties so OnPush CD fires.
    effect(() => {
      const svc = this.activitiesContext;
      this.activitiesPrimaryFilter       = svc.activitiesPrimaryFilter() as AppTypes.ActivitiesPrimaryFilter;
      this.activitiesChatContextFilter   = svc.activitiesChatContextFilter() as AppTypes.ActivitiesChatContextFilter;
      this.activitiesSecondaryFilter     = svc.activitiesSecondaryFilter() as AppTypes.ActivitiesSecondaryFilter;
      this.hostingPublicationFilter      = svc.activitiesHostingPublicationFilter() as AppTypes.HostingPublicationFilter;
      this.activitiesRateFilter          = svc.activitiesRateFilter() as AppTypes.RateFilterKey;
      this.activitiesView                = svc.activitiesView() as AppTypes.ActivitiesView;
      this.showActivitiesViewPicker      = svc.activitiesShowViewPicker();
      this.showActivitiesSecondaryPicker = svc.activitiesShowSecondaryPicker();
      this.activitiesStickyValue         = svc.activitiesStickyValue();
      this.activitiesRatesFullscreenMode = svc.activitiesRatesFullscreenMode();
      this.selectedActivityRateId        = svc.activitiesSelectedRateId();
      this.syncActivitiesSmartListInputs();
      this.cdr.markForCheck();
    });

    // React to open events: reset scroll state whenever the popup is opened.
    effect(() => {
      if (this.activitiesContext.activitiesOpen()) {
        this.onActivitiesOpened();
      }
    });

    effect(() => {
      const sync = this.activitiesContext.activitiesEventSync();
      if (!sync) {
        return;
      }
      this.applyActivitiesEventSync(sync);
      this.activitiesContext.clearActivitiesEventSync();
      this.cdr.markForCheck();
    });

    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request) {
        return;
      }
      if (request.type === 'members' || request.type === 'eventEditorMembers') {
        this.openActivityMembersLocal(request.row);
        this.activitiesContext.clearActivitiesNavigationRequest();
      }
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

  @HostListener('window:pointermove', ['$event'])
  protected onWindowPointerMoveForActivitiesRates(event: PointerEvent): void {
    if (!this.isActivitiesRatesPairSplitDragging || this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updateActivitiesRatesPairSplitFromDragDelta(event.clientX);
  }

  @HostListener('window:pointerup', ['$event'])
  protected onWindowPointerUpForActivitiesRates(event: PointerEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:pointercancel', ['$event'])
  protected onWindowPointerCancelForActivitiesRates(event: PointerEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:touchmove', ['$event'])
  protected onWindowTouchMoveForActivitiesRates(event: TouchEvent): void {
    if (!this.isActivitiesRatesPairSplitDragging || this.activitiesRatesPairSplitPointerId !== -1) {
      return;
    }
    const touch = event.touches?.[0] ?? event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updateActivitiesRatesPairSplitFromDragDelta(touch.clientX);
  }

  @HostListener('window:touchend', ['$event'])
  protected onWindowTouchEndForActivitiesRates(event: TouchEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== -1) {
      return;
    }
    if (!event.changedTouches?.length) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:touchcancel', ['$event'])
  protected onWindowTouchCancelForActivitiesRates(event: TouchEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== -1) {
      return;
    }
    if (!event.changedTouches?.length) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  /** Called once each time the service opens the popup. */
  private onActivitiesOpened(): void {
    this.resetActivitiesStateForOpen();
    this.clearActivityRateEditorState();
    this.resetActivitiesScroll();
  }

  private resetActivitiesStateForOpen(): void {
    this.inlineItemActionMenu = null;
    this.pendingActivityDeleteRow = null;
    this.pendingActivityPublishRow = null;
    this.pendingActivityAction = 'delete';
    this.activitiesStickyValue = '';
    this.calendarMonthFocusDate = null;
    this.calendarWeekFocusDate = null;
    this.calendarInitialPageIndexOverride = null;
    this.suppressCalendarEdgeSettle = false;
    this.calendarMonthAnchorPages = null;
    this.calendarWeekAnchorPages = null;
    this.calendarMonthAnchorsHydrated = false;
    this.calendarWeekAnchorsHydrated = false;
    this.calendarMonthPagesCacheKey = '';
    this.calendarWeekPagesCacheKey = '';
    this.calendarMonthPagesCache = [];
    this.calendarWeekPagesCache = [];
    this.activitiesCalendarBadgesLoadingDelayKey = '';
    this.activitiesCalendarBadgeDelayPageKey = '';
    this.activitiesCalendarBadgesLoadingActive = false;
    this.activitiesCalendarBadgesReadyDelayKeys.clear();
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
  }

  ngOnDestroy(): void {
    this.cancelActivitiesRatesFullscreenAdvance();
    this.clearActivityRateEditorState();
    this.clearActivityRateBarBlink();
    if (this.activitiesLoadMoreTimer) {
      clearTimeout(this.activitiesLoadMoreTimer);
    }
    if (this.activitiesHeaderLoadingInterval) {
      clearInterval(this.activitiesHeaderLoadingInterval);
    }
    if (this.activitiesHeaderLoadingCompleteTimer) {
      clearTimeout(this.activitiesHeaderLoadingCompleteTimer);
    }
    if (this.activitiesCalendarBadgesTimer) {
      clearTimeout(this.activitiesCalendarBadgesTimer);
    }
    if (this.calendarEdgeSettleTimer) {
      clearTimeout(this.calendarEdgeSettleTimer);
    }
    if (this.calendarPostSettleTimer) {
      clearTimeout(this.calendarPostSettleTimer);
    }
  }

  private defaultPublishedHostingIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    const published = APP_DEMO_DATA.hostingPublishedById as Record<string, boolean>;
    for (const [id, isPublished] of Object.entries(published)) {
      if (isPublished !== false) {
        ids.add(id);
      }
    }
    return ids;
  }

  private hydrateStandaloneFallbackState(): void {
    if (!this.activeUser) {
      this.activeUser = this.users[0] ?? DEMO_USERS[0];
    }
    const userId = this.activeUser.id;

    if (this.chatItems.length === 0) {
      this.chatItems = [...(DEMO_CHAT_BY_USER[userId] ?? [])];
    }
    if (this.eventItems.length === 0) {
      this.eventItems = [...(DEMO_EVENTS_BY_USER[userId] ?? [])];
    }
    if (this.hostingItems.length === 0) {
      this.hostingItems = [...(DEMO_HOSTING_BY_USER[userId] ?? [])];
    }
    if (this.invitationItems.length === 0) {
      this.invitationItems = [...(DEMO_INVITATIONS_BY_USER[userId] ?? [])];
    }

    this.ensurePaginationTestEvents(30);
    this.initializeEventEditorContextData();
    this.refreshSectionBadges();
  }

  private ensurePaginationTestEvents(minEventsPerUser: number): void {
    if (this.eventItems.length >= minEventsPerUser) {
      return;
    }

    const needed = minEventsPerUser - this.eventItems.length;
    const synthetic: EventMenuItem[] = [];
    for (let index = 0; index < needed; index += 1) {
      const seq = this.eventItems.length + index + 1;
      const id = `ex-${this.activeUser.id}-${seq}`;
      const start = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0);
      const end = new Date(start.getTime() + ((2 + (index % 3)) * 60 * 60 * 1000));
      const isAdmin = (seq % 4) === 0;
      const title = `Pagination Test Event ${seq}`;
      const timeframe = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

      synthetic.push({
        id,
        avatar: this.activeUser.initials,
        title,
        shortDescription: `Synthetic feed item ${seq} to validate activities infinite loading.`,
        timeframe,
        activity: (index % 5) + 1,
        isAdmin
      });

      this.eventDatesById[id] = start.toISOString().slice(0, 19);
      this.eventDistanceById[id] = 3 + (index % 42);
      this.activityDateTimeRangeById[id] = {
        startIso: start.toISOString().slice(0, 19),
        endIso: end.toISOString().slice(0, 19)
      };
      this.activityImageById[id] = `https://picsum.photos/seed/event-${id}/1200/700`;
      this.activitySourceLinkById[id] = `https://example.com/events/${id}`;
      this.activityCapacityById[id] = `${6 + (index % 18)} / ${12 + (index % 24)}`;
    }

    this.eventItems = [...this.eventItems, ...synthetic];
  }

  private initializeEventEditorContextData(): void {
    const sources: Array<{ item: EventMenuItem | HostingMenuItem; isHosting: boolean }> = [];
    for (const item of this.eventItems) {
      sources.push({ item, isHosting: false });
    }
    for (const item of this.hostingItems) {
      sources.push({ item, isHosting: true });
    }

    const visited = new Set<string>();
    for (const source of sources) {
      const id = source.item.id;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      if (!this.eventCapacityById[id]) {
        this.eventCapacityById[id] = AppDemoGenerators.seededEventCapacityRange(id, this.activityCapacityById);
      }
      if (!this.eventSubEventsById[id] || this.eventSubEventsById[id].length === 0) {
        this.eventSubEventsById[id] = AppDemoGenerators.buildSeededSubEventsForEvent(source.item, {
          isHosting: source.isHosting,
          activityDateTimeRangeById: this.activityDateTimeRangeById,
          hostingDatesById: this.hostingDatesById,
          eventDatesById: this.eventDatesById,
          eventCapacityById: this.eventCapacityById,
          activityCapacityById: this.activityCapacityById,
          defaultStartIso: this.defaultEventStartIso(),
          activeUserId: this.activeUser.id
        });
      }
    }
  }

  private refreshSectionBadges(): void {
    this.chatBadge = AppDemoGenerators.resolveSectionBadge(
      this.chatItems.map(item => item.unread),
      this.chatItems.length
    );
    this.invitationsBadge = AppDemoGenerators.resolveSectionBadge(
      this.invitationItems.map(item => item.unread),
      this.invitationItems.length
    );
    this.eventsBadge = AppDemoGenerators.resolveSectionBadge(
      this.eventItems.map(item => item.activity),
      this.eventItems.length
    );
    const adminEvents = this.eventItems.filter(item => item.isAdmin);
    this.hostingBadge = AppDemoGenerators.resolveSectionBadge(
      adminEvents.map(item => item.activity),
      adminEvents.length
    );
    this.gameBadge = this.activeUser.activities.game;
  }

  private syncMobileViewFromViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileView = false;
      return;
    }
    const next = window.innerWidth <= 860;
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

  private shouldUseServerSidePagination(): boolean {
    return this.activitiesContext.dataMode === 'http';
  }

  protected get filteredActivityRows(): AppTypes.ActivityListRow[] {
    const rows = this.buildFilteredActivityRowsBase();
    return rows.slice(0, this.activitiesVisibleCount);
  }

  private buildFilteredActivityRowsBase(): AppTypes.ActivityListRow[] {
    if (this.shouldUseServerSidePagination()) {
      return [...this.serverPageRows];
    }
    let rows: AppTypes.ActivityListRow[] = [];
    if (this.activitiesPrimaryFilter === 'chats') {
      rows = this.chatItemsForActivities()
        .filter(item => this.matchesActivitiesChatContextFilter(item))
        .map(item => this.chatToActivityRow(item));
    } else if (this.activitiesPrimaryFilter === 'invitations') {
      rows = this.invitationItems.map(item => this.invitationToActivityRow(item));
    } else if (this.activitiesPrimaryFilter === 'events') {
      rows = this.eventItems.map(item => this.eventToActivityRow(item, this.activitiesSecondaryFilter));
    } else if (this.activitiesPrimaryFilter === 'hosting') {
      rows = this.eventItems
        .filter(item => item.isAdmin)
        .filter(item => this.hostingPublicationFilter === 'drafts' ? !this.isHostingPublished(item.id) : true)
        .map(item => this.hostingEventToActivityRow(item));
    } else {
      rows = this.rateItems
        .filter(item => item.userId !== this.activeUser.id && this.matchesRateFilter(item, this.activitiesRateFilter))
        .map(item => this.rateToActivityRow(item));
    }
    const sorted = this.sortActivitiesRows(rows);
    if (this.activitiesView === 'distance') {
      return [...sorted].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
    return sorted;
  }

  private sortActivitiesRows(rows: AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (this.activitiesSecondaryFilter === 'recent') {
      if (this.activitiesPrimaryFilter === 'events' || this.activitiesPrimaryFilter === 'hosting') {
        return sorted.sort((a, b) => AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
      }
      return sorted.sort((a, b) => AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (this.activitiesSecondaryFilter === 'past') {
      return sorted.sort((a, b) => AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (this.activitiesPrimaryFilter === 'events' || this.activitiesPrimaryFilter === 'hosting') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
    }
    return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
  }

  protected get groupedActivityRows(): AppTypes.ActivityGroup[] {
    const rows = this.filteredActivityRows;
    const grouped: AppTypes.ActivityGroup[] = [];
    for (const row of rows) {
      const label = AppUtils.activityGroupLabel(row, this.activitiesView, APP_DEMO_DATA.activityGroupLabels);
      const lastGroup = grouped[grouped.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        grouped.push({ label, rows: [row] });
        continue;
      }
      lastGroup.rows.push(row);
    }
    return grouped;
  }

  // =========================================================================
  // Template helpers – toolbar
  // =========================================================================

  protected activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }

  protected activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }

  protected activitiesPrimaryFilterClass(filter: AppTypes.ActivitiesPrimaryFilter = this.activitiesPrimaryFilter): string {
    const map: Record<AppTypes.ActivitiesPrimaryFilter, string> = {
      chats: 'activity-filter-chat',
      invitations: 'activity-filter-invitations',
      events: 'activity-filter-events',
      hosting: 'activity-filter-hosting',
      rates: 'activity-filter-rates'
    };
    return map[filter] ?? 'activity-filter-chat';
  }

  protected activitiesPrimaryFilterCount(filter: AppTypes.ActivitiesPrimaryFilter): number {
    if (filter === 'rates')       { return this.gameBadge; }
    if (filter === 'chats')       { return this.chatBadge; }
    if (filter === 'invitations') { return this.invitationsBadge; }
    if (filter === 'events')      { return this.eventsBadge; }
    return this.hostingBadge;
  }

  protected activitiesPrimaryPanelWidth(): string {
    return '200px';
  }

  protected activitiesRatePanelWidth(): string {
    return '220px';
  }

  protected activitiesHeaderLineOne(): string {
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
      const label = this.rateFilters.find(option => option.key === this.activitiesRateFilter)?.label ?? 'Given';
      return `${group} Rate · ${label}`;
    }
    if (this.activitiesView === 'month' || this.activitiesView === 'week') {
      return this.activitiesPrimaryFilterLabel();
    }
    return `${this.activitiesPrimaryFilterLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
  }

  protected activitiesHeaderLineTwo(): string {
    return '';
  }

  protected activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }

  protected activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }

  protected activitiesChatContextFilterClass(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): string {
    const map: Record<AppTypes.ActivitiesChatContextFilter, string> = {
      all: 'chat-context-filter-all',
      event: 'chat-context-filter-event',
      subEvent: 'chat-context-filter-sub-event',
      group: 'chat-context-filter-group'
    };
    return map[filter] ?? 'chat-context-filter-all';
  }

  protected activitiesSecondaryFilterClass(_filter: AppTypes.ActivitiesSecondaryFilter = this.activitiesSecondaryFilter): string {
    return 'activity-filter-secondary';
  }

  protected activitiesChatContextFilterCount(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') { return 0; }
    return this.chatItemsForActivities().filter(item => {
      if (filter === 'all') { return true; }
      return this.activityChatContextFilterKey(item) === filter;
    }).length;
  }

  private activitiesChatsHeaderLabel(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.activitiesChatContextFilter === 'all') {
      return primary;
    }
    return `${primary} · ${this.activitiesChatContextFilterLabel()}`;
  }

  protected activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.activitiesSecondaryFilter);
  }

  protected activitiesSecondaryFilterOptionLabel(filter: AppTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(o => o.key === filter)?.label ?? 'Relevant';
  }

  protected activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(o => o.key === this.activitiesSecondaryFilter)?.icon ?? 'schedule';
  }

  protected activitiesRateFilterLabel(): string {
    const filter = this.rateFilters.find(o => o.key === this.activitiesRateFilter);
    if (!filter) { return 'Single · Given'; }
    const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    return `${group} · ${filter.label}`;
  }

  protected activitiesRateFilterIcon(key: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    const icons: Record<AppTypes.RateFilterKey, string> = {
      'individual-given':    'north_east',
      'individual-received': 'south_west',
      'individual-mutual':   'sync_alt',
      'individual-met':      'handshake',
      'pair-given':          'group_add',
      'pair-received':       'groups_2'
    };
    return icons[key] ?? 'star';
  }

  protected activitiesRateFilterClass(filter: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    return 'activity-filter-rates';
  }

  protected rateFilterOptionClass(key: AppTypes.RateFilterKey): string {
    return `rate-filter-item-${key}`;
  }

  protected isRateGroupSeparator(label: string): boolean {
    return label.trim().toLowerCase().includes('pair');
  }

  protected rateFilterCount(filter: AppTypes.RateFilterKey): number {
    return this.rateItems.filter(item => this.matchesRateFilter(item, filter)).length;
  }

  protected totalRateFilterCount(): number {
    return this.rateItems.length;
  }

  protected activityViewLabel(): string {
    return this.activitiesViewOptions.find(o => o.key === this.activitiesView)?.label ?? 'View';
  }

  // ── Filter visibility helpers ──────────────────────────────────────────────

  protected isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  protected isHostingPublicationFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'hosting';
  }

  protected hostingDraftCount(): number {
    return this.eventItems.filter(item => item.isAdmin && !this.isHostingPublished(item.id)).length;
  }

  protected shouldShowActivitiesExploreAction(): boolean {
    return this.activitiesPrimaryFilter === 'events';
  }

  protected shouldShowActivitiesCreateAction(): boolean {
    return this.activitiesPrimaryFilter === 'hosting';
  }

  protected shouldShowRatesFullscreenToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates' && !this.isCalendarLayoutView();
  }

  protected isRatesFullscreenModeActive(): boolean {
    return this.shouldShowRatesFullscreenToggle() && this.activitiesRatesFullscreenMode;
  }

  protected isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }

  // ── Selection actions ─────────────────────────────────────────────────────

  protected selectActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates' || filter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    if (filter !== 'rates') {
      this.disableActivitiesRatesFullscreenMode();
    }
    this.activitiesContext.setActivitiesPrimaryFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') { return; }
    this.activitiesContext.setActivitiesChatContextFilter(filter);
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (this.activitiesPrimaryFilter !== 'hosting' || this.hostingPublicationFilter === filter) { return; }
    this.activitiesContext.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesContext.setActivitiesSecondaryFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this.stopActivitiesRatesPairSplitDrag();
    this.activitiesRateFilter = filter;
    this.commitPendingRateDirectionOverrides(filter);
    this.activitiesContext.setActivitiesRateFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.selectedActivityRateId = null;
    this.activitiesContext.setActivitiesSelectedRateId(null);
    if (this.activitiesRatesFullscreenMode) {
      this.activitiesRatesFullscreenLeavingRow = null;
      this.activitiesRatesFullscreenCardIndex  = 0;
      this.syncActivitiesRatesFullscreenSelection();
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.activitiesContext.toggleActivitiesViewPicker();
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.activitiesContext.toggleActivitiesSecondaryPicker();
  }

  protected setActivitiesView(view: AppTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    if (view !== 'distance') {
      this.disableActivitiesRatesFullscreenMode();
    }
    this.activitiesContext.setActivitiesView(view as 'day' | 'week' | 'month' | 'distance');
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll(view === 'month' || view === 'week');
    this.cdr.markForCheck();
  }

  // ── Mobile bottom-sheet openers (delegates back to parent if needed) ───────

  protected openMobileActivitiesPrimaryFilterSelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesPrimaryPicker = !this.showActivitiesPrimaryPicker;
  }

  protected openMobileActivitiesChatContextFilterSelector(event: Event): void {
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesChatContextPicker = !this.showActivitiesChatContextPicker;
  }

  protected openMobileActivitiesRateFilterSelector(event: Event): void {
    event.stopPropagation();
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'rates') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesRatePicker = !this.showActivitiesRatePicker;
  }

  // ── Event editor / explore – call EventEditorService directly ────────────

  protected requestOpenEventEditor(): void {
    const target: AppTypes.EventEditorTarget = this.activitiesPrimaryFilter === 'hosting' ? 'hosting' : 'events';
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target
    });
  }

  protected requestOpenEventEditorForRow(
    row: AppTypes.ActivityListRow,
    readOnly = false,
    stacked = true
  ): void {
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly
    });
  }

  protected requestOpenEventExplore(): void {
    this.closeActivitiesPopup();
    this.activitiesContext.requestActivitiesNavigation({ type: 'eventExplore' });
  }

  // =========================================================================
  // Row rendering helpers
  // =========================================================================

  protected get activitiesStickyHeader(): string {
    if (this.activitiesStickyValue) { return this.activitiesStickyValue; }
    return this.activitiesView === 'distance' ? '5 km' : 'No items';
  }

  protected get activitiesEmptyLabel(): string {
    if (this.activitiesPrimaryFilter === 'rates') {
      return 'No rate interactions for this filter yet.';
    }
    if (this.activitiesPrimaryFilter === 'hosting' && this.hostingPublicationFilter === 'drafts') {
      return 'No drafts in hosting yet.';
    }
    return `No ${this.activitiesPrimaryFilter} items in this filter.`;
  }

  protected trackByActivityGroup(_index: number, group: AppTypes.ActivityGroup): string {
    return group.label;
  }

  protected trackByActivityRow(_index: number, row: AppTypes.ActivityListRow): string {
    return row.id;
  }

  protected trackByRateCardImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  protected activitiesSmartListClassMap(): Record<string, boolean> {
    return {
      'experience-card-list': true,
      'assets-card-list': true,
      'activities-scroll-list': true,
      'activities-scroll-list-rates': this.activitiesPrimaryFilter === 'rates',
      'activities-scroll-list-event-snap': this.activitiesPrimaryFilter === 'events'
        || this.activitiesPrimaryFilter === 'hosting'
        || this.activitiesPrimaryFilter === 'invitations',
      'activities-scroll-list-with-rate-editor': this.isActivityRateEditorDockVisible(),
      'activities-scroll-list-chat': this.activitiesPrimaryFilter === 'chats'
    };
  }

  protected shouldShowActivityGroupMarker(groupIndex: number): boolean {
    if (groupIndex > 0) {
      return true;
    }
    if (this.activitiesPrimaryFilter === 'chats') {
      return false;
    }
    if (this.shouldApplyEventActivityGroupMarkerRules() && !this.isActivitiesListScrollableNow()) {
      return false;
    }
    return true;
  }

  private shouldApplyEventActivityGroupMarkerRules(): boolean {
    return this.activitiesPrimaryFilter === 'events'
      || this.activitiesPrimaryFilter === 'invitations'
      || this.activitiesPrimaryFilter === 'hosting';
  }

  private isActivitiesListScrollableNow(): boolean {
    const listElement = this.activitiesListScrollElement();
    if (!listElement) {
      return this.activitiesListScrollable;
    }
    return Math.max(0, listElement.scrollHeight - listElement.clientHeight) > 1;
  }

  protected isEventStyleActivity(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'hosting' || row.type === 'invitations';
  }

  protected isActivityChatRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'chats';
  }

  protected activityRowAvatarInitials(row: AppTypes.ActivityListRow): string {
    if (row.type === 'rates') {
      const rate = row.source as RateMenuItem;
      return this.userById(rate.userId)?.initials ?? 'U';
    }
    const source = row.source as { avatar?: string };
    if (source?.avatar) { return source.avatar.slice(0, 2).toUpperCase(); }
    return this.activeUser.initials;
  }

  protected activityRowAvatarClass(row: AppTypes.ActivityListRow): string {
    if (row.type === 'rates') {
      const rate   = row.source as RateMenuItem;
      const gender = this.userById(rate.userId)?.gender ?? 'woman';
      return `user-color-${gender}`;
    }
    if (row.type === 'chats') {
      const chat = row.source as ChatMenuItem;
      return `user-color-${this.getChatLastSender(chat).gender}`;
    }
    return 'user-color-man';
  }

  protected activityChatRowToneClass(row: AppTypes.ActivityListRow): string {
    if (row.type !== 'chats') {
      return '';
    }
    const chat = row.source as ChatMenuItem;
    const channelType = this.chatChannelType(chat);
    if (channelType === 'mainEvent') {
      return 'activities-card-chat-main-event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'activities-card-chat-optional-sub-event';
    }
    if (channelType === 'groupSubEvent') {
      return 'activities-card-chat-group-sub-event';
    }
    return '';
  }

  protected activityChatMemberCount(row: AppTypes.ActivityListRow): number {
    if (row.type !== 'chats') {
      return 0;
    }
    return this.getChatMemberCount(row.source as ChatMenuItem);
  }

  protected activityRowBadge(row: AppTypes.ActivityListRow): number {
    if (row.type === 'chats') {
      return row.unread ?? 0;
    }
    return 0;
  }

  // ── Event-style rows ───────────────────────────────────────────────────────

  protected activityImageUrl(row: AppTypes.ActivityListRow): string {
    return this.activityImageById[row.id] ?? `https://picsum.photos/seed/event-${row.id}/1200/700`;
  }

  protected showActivitySourceIcon(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'invitations';
  }

  protected activitySourceLink(row: AppTypes.ActivityListRow): string {
    return this.activitySourceLinkById[row.id] ?? `https://example.com/events/${row.id}`;
  }

  protected activitySourceAvatarClass(row: AppTypes.ActivityListRow): string {
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${(row.source as InvitationMenuItem).inviter}`
      : `${row.id}-${row.title}`;
    const toneIndex = (AppDemoGenerators.hashText(toneSeed) % 8) + 1;
    return `activities-source-tone-${toneIndex}`;
  }

  protected activitySourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'invitations') {
      const invitation = row.source as InvitationMenuItem;
      return AppUtils.initialsFromText(invitation.inviter);
    }
    if (row.type === 'events') {
      const event = row.source as EventMenuItem;
      const explicitOwner = AppUtils.findUserByName(this.users, event.avatar || '');
      if (explicitOwner) {
        return explicitOwner.initials;
      }
      const fallbackOwner = this.users[AppDemoGenerators.hashText(`${row.id}-${event.title}`) % this.users.length];
      return fallbackOwner?.initials ?? AppUtils.initialsFromText(event.title);
    }
    if (row.type === 'hosting') {
      const hosting = row.source as HostingMenuItem;
      return AppUtils.initialsFromText(hosting.avatar || hosting.title);
    }
    return AppUtils.initialsFromText(row.title);
  }

  protected activityCapacityLabel(row: AppTypes.ActivityListRow): string {
    const acceptedMembersCount = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembersCount);
    return `${acceptedMembersCount} / ${capacityTotal}`;
  }

  protected activityPendingMemberCount(row: AppTypes.ActivityListRow): number {
    return this.getActivityMembersByRow(row).filter(member => member.status === 'pending').length;
  }

  protected isActivityFull(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'events') {
      return false;
    }
    const acceptedMembersCount = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembersCount);
    return capacityTotal > 0 && acceptedMembersCount >= capacityTotal;
  }

  private activityCapacityTotal(row: AppTypes.ActivityListRow, fallbackBase = 0): number {
    const source = this.activityCapacityById[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0) {
        return parts[1];
      }
    }
    return Math.max(fallbackBase, 4);
  }

  private getActivityMembersByRow(row: AppTypes.ActivityListRow): AppTypes.ActivityMemberEntry[] {
    const rowKey = `${row.type}:${row.id}`;
    const cached = this.activityMembersByRowId[rowKey];
    if (cached) {
      return this.sortActivityMembersByActionTimeDesc([...cached]);
    }
    const forcedAcceptedCount = this.forcedAcceptedMembersByRowKey[rowKey];
    if (Number.isFinite(forcedAcceptedCount) && forcedAcceptedCount > 0) {
      const forced = AppDemoGenerators.buildForcedAcceptedMembers(
        row,
        rowKey,
        forcedAcceptedCount,
        this.users,
        this.activeUser,
        APP_DEMO_DATA.activityMemberDefaults.forcedMetWhere
      );
      const orderedForced = this.sortActivityMembersByActionTimeDesc(forced);
      this.activityMembersByRowId[rowKey] = [...orderedForced];
      return orderedForced;
    }
    const generated = AppDemoGenerators.generateActivityMembersForRow(
      row,
      rowKey,
      this.users,
      this.activeUser,
      APP_DEMO_DATA.activityMemberMetPlaces
    );
    const ordered = this.sortActivityMembersByActionTimeDesc(generated);
    this.activityMembersByRowId[rowKey] = [...ordered];
    return ordered;
  }

  private sortActivityMembersByActionTimeDesc(entries: AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  private sortActivityMembersByActionTimeAsc(entries: AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(a.actionAtIso) - AppUtils.toSortableDate(b.actionAtIso));
  }

  protected activityLeadingIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting' || row.type === 'events') {
      return this.eventVisibilityIcon(this.activityVisibility(row));
    }
    return this.activityTypeIcon(row);
  }

  protected activityLeadingIconCircleClass(row: AppTypes.ActivityListRow): string {
    if (row.type !== 'hosting' && row.type !== 'events') {
      return '';
    }
    return `experience-item-icon-${this.eventVisibilityClass(this.activityVisibility(row))}`;
  }

  private activityVisibility(row: AppTypes.ActivityListRow): AppTypes.EventVisibility {
    return this.eventVisibilityById[row.id] ?? (row.type === 'hosting' ? 'Invitation only' : 'Public');
  }

  protected activityTypeIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'event';
    }
    if (row.type === 'hosting') {
      return 'stadium';
    }
    if (row.type === 'invitations') {
      return 'mail';
    }
    if (row.type === 'rates') {
      return 'star';
    }
    return 'chat';
  }

  private eventVisibilityIcon(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  private eventVisibilityClass(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'event-visibility-public';
      case 'Friends only':
        return 'event-visibility-friends';
      default:
        return 'event-visibility-invitation';
    }
  }

  protected activityDateRangeMetaLine(row: AppTypes.ActivityListRow): string {
    return `${this.activityTypeLabel(row)} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  protected activityLocationMetaLine(row: AppTypes.ActivityListRow): string {
    return (row.source as { city?: string })?.city ?? '';
  }

  private activityTypeLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') {
      return 'Hosting';
    }
    if (row.type === 'invitations') {
      return 'Invitation';
    }
    return 'Event';
  }

  private activityDateLabel(row: AppTypes.ActivityListRow): string {
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return (row.source as { timeframe?: string })?.timeframe ?? 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ', '
      + parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  protected canManageActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type !== 'chats' && row.type !== 'rates';
  }

  protected isActivityItemActionMenuOpen(row: AppTypes.ActivityListRow): boolean {
    return this.inlineItemActionMenu?.scope === 'activity' && this.inlineItemActionMenu.id === row.id;
  }

  protected isActivityItemActionMenuOpenUp(row: AppTypes.ActivityListRow): boolean {
    return this.inlineItemActionMenu?.scope === 'activity' && this.inlineItemActionMenu.id === row.id && this.inlineItemActionMenu.openUp;
  }

  protected toggleActivityItemActionMenu(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (this.isActivityItemActionMenuOpen(row)) {
      this.inlineItemActionMenu = null;
    } else {
      this.inlineItemActionMenu = {
        scope: 'activity',
        id: row.id,
        title: row.title,
        openUp: this.shouldOpenInlineItemMenuUp(event)
      };
    }
  }

  protected shouldShowActivityPublishAction(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'hosting' && !this.isHostingPublished(row.id);
  }

  protected shouldShowActivityViewAction(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'hosting' || row.type === 'events';
  }

  protected isExitActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events';
  }

  protected activityPrimaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') { return 'edit'; }
    if (row.type === 'invitations') { return 'visibility'; }
    return 'edit';
  }

  protected activityPrimaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting')     { return 'Edit Event'; }
    if (row.type === 'invitations') { return 'View Invitation'; }
    return 'Edit Event';
  }

  protected activitySecondaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events')  { return 'exit_to_app'; }
    if (row.type === 'hosting') { return 'delete'; }
    return 'delete';
  }

  protected activitySecondaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events')  { return 'Leave Event'; }
    if (row.type === 'hosting') { return 'Delete Event'; }
    return 'Delete';
  }

  protected runActivityItemPrimaryAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, false);
  }

  protected runActivityItemViewAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.inlineItemActionMenu = null;
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  protected runActivityItemApproveAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, true);
  }

  protected runActivityItemSecondaryAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.inlineItemActionMenu = null;
    this.pendingActivityAction    = row.type === 'events' ? 'exit' : 'delete';
    this.pendingActivityDeleteRow = row;
  }

  protected runActivityItemPublishAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.inlineItemActionMenu  = null;
    this.pendingActivityPublishRow = row;
  }

  protected cancelActivityDelete(): void {
    this.pendingActivityDeleteRow = null;
  }

  protected confirmActivityDelete(): void {
    this.pendingActivityDeleteRow = null;
    // Real deletion wired to backend; here we just emit.
    this.cdr.markForCheck();
  }

  protected pendingActivityConfirmTitle(): string {
    if (this.pendingActivityAction === 'exit') { return 'Leave event?'; }
    return 'Delete event?';
  }

  protected pendingActivityDeleteLabel(): string {
    return this.pendingActivityDeleteRow?.title ?? '';
  }

  protected pendingActivityConfirmActionLabel(): string {
    return this.pendingActivityAction === 'exit' ? 'Leave' : 'Delete';
  }

  protected cancelActivityPublish(): void {
    this.pendingActivityPublishRow = null;
  }

  protected confirmActivityPublish(): void {
    this.pendingActivityPublishRow = null;
    this.cdr.markForCheck();
  }

  protected pendingActivityPublishTitle(): string {
    return 'Publish event?';
  }

  protected pendingActivityPublishLabel(): string {
    return this.pendingActivityPublishRow?.title ?? '';
  }

  // =========================================================================
  // Row click / navigation
  // =========================================================================

  protected onActivityRowClick(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    if (row.type === 'chats') {
      const chat = row.source as ChatMenuItem;
      this.activitiesContext.openEventChat(chat, this.buildEventChatContext(chat));
      return;
    }
    if (row.type === 'rates') {
      this.openActivityRateEditor(row, event as Event);
      return;
    }
    this.openActivityRowInEventModule(row, true);
  }

  protected openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.openActivityMembersLocal(row);
  }

  private openActivityMembersLocal(row: AppTypes.ActivityListRow): void {
    this.pendingActivityMemberDelete = null;
    this.activityMembersPendingOnly = false;
    this.activityMembersReadOnly = row.isAdmin !== true;
    this.selectedActivityMembersRow = row;
    this.selectedActivityMembersRowId = `${row.type}:${row.id}`;
    this.selectedActivityMembersTitle = row.title;
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(row));
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.inlineItemActionMenu = null;
    this.stackedActivitiesPopup = 'activityMembers';
  }

  protected closeActivityMembersPopup(): void {
    this.pendingActivityMemberDelete = null;
    this.activityMembersPendingOnly = false;
    this.activityMembersReadOnly = false;
    this.selectedActivityMembers = [];
    this.selectedActivityMembersTitle = '';
    this.selectedActivityMembersRow = null;
    this.selectedActivityMembersRowId = null;
    this.inlineItemActionMenu = null;
    this.stackedActivitiesPopup = null;
  }

  protected get activityMembersOrdered(): AppTypes.ActivityMemberEntry[] {
    const ordered = this.sortActivityMembersByActionTimeAsc(this.selectedActivityMembers);
    if (!this.activityMembersPendingOnly) {
      return ordered;
    }
    return ordered.filter(member => member.status === 'pending');
  }

  protected activityMembersPendingCount(): number {
    return this.selectedActivityMembers.filter(member => member.status === 'pending').length;
  }

  protected activityMembersHeaderSummary(): string {
    const pendingCount = this.activityMembersPendingCount();
    const acceptedCount = this.selectedActivityMembers.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected canShowActivityMembersInviteButton(): boolean {
    return !this.activityMembersReadOnly;
  }

  protected handleActivityMembersTogglePendingOnly(): void {
    this.activityMembersPendingOnly = !this.activityMembersPendingOnly;
  }

  protected handleActivityMemberActionMenuToggle(payload: { entry: AppTypes.ActivityMemberEntry; event: Event }): void {
    this.toggleActivityMemberActionMenu(payload.entry, payload.event);
  }

  protected handleActivityMemberApprove(entry: AppTypes.ActivityMemberEntry): void {
    this.approveActivityMember(entry);
  }

  protected handleActivityMemberRemove(entry: AppTypes.ActivityMemberEntry): void {
    this.removeActivityMember(entry);
  }

  protected cancelRemoveActivityMember(): void {
    this.pendingActivityMemberDelete = null;
  }

  protected confirmRemoveActivityMember(): void {
    if (!this.pendingActivityMemberDelete || !this.selectedActivityMembersRowId) {
      this.pendingActivityMemberDelete = null;
      return;
    }
    const targetId = this.pendingActivityMemberDelete.id;
    this.selectedActivityMembers = this.selectedActivityMembers.filter(item => item.id !== targetId);
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.pendingActivityMemberDelete = null;
  }

  protected pendingActivityMemberDeleteTitle(): string {
    return 'Remove member';
  }

  protected pendingActivityMemberDeleteLabel(): string {
    if (!this.pendingActivityMemberDelete) {
      return '';
    }
    return `Remove ${this.pendingActivityMemberDelete.name} from this event?`;
  }

  protected handleActivityMembersInvite(): void {
    // Basket-mode picker wiring moves here later; keep button inert-free for now.
  }

  protected canShowActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.activityMembersReadOnly) {
      return false;
    }
    return this.canApproveActivityMember(entry) || this.canDeleteActivityMember(entry);
  }

  protected toggleActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canShowActivityMemberActionMenu(entry)) {
      return;
    }
    if (this.inlineItemActionMenu?.scope === 'activityMember' && this.inlineItemActionMenu.id === entry.userId) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = {
      scope: 'activityMember',
      id: entry.userId,
      title: entry.name,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isActivityMemberActionMenuOpen(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember' && this.inlineItemActionMenu.id === entry.userId;
  }

  protected isActivityMemberActionMenuOpenUp(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember'
      && this.inlineItemActionMenu.id === entry.userId
      && this.inlineItemActionMenu.openUp;
  }

  protected canApproveActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin !== true) {
      return false;
    }
    return entry.status === 'pending' && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  protected canDeleteActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin === true) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected activityMemberMenuDeleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  protected activityMemberAge(entry: AppTypes.ActivityMemberEntry): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  protected activityMemberRoleLabel(entry: AppTypes.ActivityMemberEntry): string {
    return entry.role === 'Admin' ? 'Admin' : 'Member';
  }

  protected activityMemberStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  protected memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'admin_panel_settings' : 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  protected memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  protected memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  protected memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'Admin' : 'Member';
    }
    return this.activityMemberStatusLabel(entry);
  }

  protected approveActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canApproveActivityMember(entry)) {
      return;
    }
    const nowIso = AppUtils.toIsoDateTime(new Date());
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(this.selectedActivityMembers.map(item =>
      item.id === entry.id
        ? {
            ...item,
            status: 'accepted',
            pendingSource: null,
            requestKind: null,
            actionAtIso: nowIso
          }
        : item
    ));
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.inlineItemActionMenu = null;
  }

  protected removeActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canDeleteActivityMember(entry)) {
      return;
    }
    this.pendingActivityMemberDelete = entry;
    this.inlineItemActionMenu = null;
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileView || typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const actionWrap = (trigger?.closest('.experience-item-actions') as HTMLElement | null) ?? trigger;
    if (!actionWrap) {
      return false;
    }
    const rect = actionWrap.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 248;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }

  // =========================================================================
  // Rate editor dock
  // =========================================================================

  protected openActivityRateEditor(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (row.type !== 'rates') {
      return;
    }
    if (this.isPairReceivedRateRow(row)) {
      return;
    }
    this.cancelActivityRateEditorCloseTransition();
    const wasOpen = this.isActivityRateEditorOpen();
    if (this.selectedActivityRateId === row.id) {
      this.clearActivityRateEditorState();
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    if (!wasOpen) {
      this.activityRateEditorOpenScrollTop = scrollElement ? scrollElement.scrollTop : null;
    }
    this.selectedActivityRateId = row.id;
    this.activitiesContext.setActivitiesSelectedRateId(row.id);
    this.activityRateEditorClosing = false;
    this.pulseRateIndicatorForRow(row);
    this.runAfterActivitiesRender(() => {
      setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(row.id), 40);
      if (!wasOpen) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(row.id), this.activityRateEditorSlideDurationMs + 40);
      }
    });
  }

  protected closeActivityRateEditorFromUserScroll(): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    this.clearActivityRateEditorState(true);
  }

  protected isActivityRateEditorDockVisible(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      if (this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
        return false;
      }
      return this.currentActivitiesRatesFullscreenRow() !== null;
    }
    return this.activitiesPrimaryFilter === 'rates' && (!!this.selectedActivityRateId || this.activityRateEditorClosing);
  }

  protected isActivityRateEditorOpen(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      return true;
    }
    return this.activitiesPrimaryFilter === 'rates' && !!this.selectedActivityRateId && !this.activityRateEditorClosing;
  }

  protected isActivityRateEditorClosing(): boolean {
    return this.activityRateEditorClosing;
  }

  protected isSelectedActivityRateRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'rates' && this.isActivityRateEditorOpen() && this.selectedActivityRateId === row.id;
  }

  protected selectedActivityRateModeLabel(): string {
    const row = this.selectedActivityRateRow();
    if (!row || row.type !== 'rates') {
      return this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair' ? 'Pair' : 'Single';
  }

  protected selectedActivityRateTitle(): string {
    return this.selectedActivityRateRow()?.title ?? 'Rate';
  }

  protected isSelectedActivityRateReadOnly(): boolean {
    const row = this.isRatesFullscreenModeActive()
      ? this.currentActivitiesRatesFullscreenRow()
      : this.selectedActivityRateRow();
    return !!row && this.isPairReceivedRateRow(row);
  }

  protected isSelectedActivityRateScore(score: number): boolean {
    const row = this.selectedActivityRateRow();
    if (!row) {
      return false;
    }
    return score <= this.activityOwnRatingValue(row);
  }

  protected setSelectedActivityOwnRating(score: number): void {
    const normalized = this.normalizeRateScore(score);
    const row = this.isRatesFullscreenModeActive()
      ? this.currentActivitiesRatesFullscreenRow()
      : this.selectedActivityRateRow();
    if (!row || row.type !== 'rates') {
      return;
    }
    if (this.isPairReceivedRateRow(row)) {
      return;
    }
    this.selectedActivityRateId = row.id;
    this.activitiesContext.setActivitiesSelectedRateId(row.id);
    this.activityRateDraftById[row.id] = normalized;
    const rateItem = row.source as RateMenuItem;
    const nextDirection = this.pendingDirectionAfterRating(rateItem);
    if (nextDirection) {
      this.pendingActivityRateDirectionOverrideById[rateItem.id] = nextDirection;
    }
    if (!this.isRatesFullscreenModeActive()) {
      this.triggerActivityRateBlinks(row.id);
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      this.triggerActivityRateBlinks(row.id);
      return;
    }
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, allRows.length - 1));
    const hasUpcomingRound = currentIndex + 1 < allRows.length;
    const nextIndex = Math.min(allRows.length, currentIndex + 1);
    this.triggerActivityRateBlinks(row.id, () => {
      if (hasUpcomingRound) {
        this.startActivitiesRatesFullscreenLeaveAnimation(row);
      }
      this.activitiesRatesFullscreenCardIndex = nextIndex;
      this.updateActivitiesHeaderProgress();
      this.maybeStartActivitiesRatesFullscreenPaginationLoad();
    });
  }

  private clearActivityRateEditorState(preserveScrollPosition = false): void {
    if (this.isRatesFullscreenModeActive()) {
      return;
    }
    if (!this.selectedActivityRateId && !this.activityRateEditorClosing) {
      return;
    }
    if (this.activityRateEditorClosing) {
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    const restoreTop = this.activityRateEditorOpenScrollTop;
    const hasRestoreTop = Number.isFinite(restoreTop as number);
    const shouldReverseLift =
      !preserveScrollPosition &&
      this.activitiesPrimaryFilter === 'rates' &&
      !!scrollElement &&
      (hasRestoreTop
        ? scrollElement.scrollTop > (restoreTop as number) + 0.5
        : this.lastActivityRateEditorLiftDelta > 0);
    const previousInlineSnapType = shouldReverseLift ? scrollElement.style.scrollSnapType : '';
    const reverseDelta = this.lastActivityRateEditorLiftDelta;
    this.activityRateEditorClosing = true;
    this.cancelActivityRateEditorCloseTransition();
    this.activityRateEditorCloseTimer = setTimeout(() => {
      this.activityRateEditorCloseTimer = null;
      this.activityRateEditorClosing = false;
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      this.lastRateIndicatorPulseRowId = null;
      this.lastActivityRateEditorLiftDelta = 0;
      this.activityRateEditorOpenScrollTop = null;
    }, this.activityRateEditorSlideDurationMs);
    if (!shouldReverseLift || !scrollElement) {
      return;
    }
    this.runAfterActivitiesRender(() => {
      const targetTop = Number.isFinite(restoreTop as number)
        ? Math.max(0, restoreTop as number)
        : Math.max(0, scrollElement.scrollTop - reverseDelta);
      scrollElement.style.scrollSnapType = 'none';
      scrollElement.scrollTo({ top: targetTop, behavior: 'smooth' });
      setTimeout(() => {
        scrollElement.style.scrollSnapType = previousInlineSnapType;
      }, 220);
    });
  }

  private cancelActivityRateEditorCloseTransition(): void {
    if (this.activityRateEditorCloseTimer) {
      clearTimeout(this.activityRateEditorCloseTimer);
      this.activityRateEditorCloseTimer = null;
    }
  }

  private maybeDismissActivityRateEditor(target: Element): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    if (
      target.closest('.activities-rate-editor-dock')
      || target.closest('.activities-rate-score-badge')
      || target.closest('.activities-rate-profile-card.is-rate-editor-selected')
    ) {
      return;
    }
    this.clearActivityRateEditorState();
  }

  private runAfterActivitiesRender(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(task));
      return;
    }
    setTimeout(task, 0);
  }

  private smoothRevealSelectedRateRowWhenNeeded(rowId: string, attempt = 0): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    if (!scrollElement) {
      return;
    }
    const targetRow = scrollElement.querySelector<HTMLElement>(`[data-activity-rate-row-id="${rowId}"]`);
    if (!targetRow) {
      return;
    }
    const rateRows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.activities-rate-profile-card.activities-row-item'));
    const rowTop = targetRow.offsetTop;
    const sameRowCards = rateRows.filter(card => Math.abs(card.offsetTop - rowTop) <= 1);
    const dock = globalThis.document?.querySelector<HTMLElement>('.activities-rate-editor-dock');
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowBottom = (sameRowCards.length > 0 ? sameRowCards : [targetRow]).reduce((maxBottom, card) => {
      return Math.max(maxBottom, card.getBoundingClientRect().bottom);
    }, targetRow.getBoundingClientRect().bottom);
    const dockRect = dock?.getBoundingClientRect();
    const fallbackDockTop = scrollRect.bottom - Math.max(72, dock?.offsetHeight ?? 72);
    const dockTop = dockRect ? Math.min(dockRect.top, scrollRect.bottom) : fallbackDockTop;
    const breathingRoom = this.isMobileView ? 6 : 8;
    const revealBottom = dockTop - breathingRoom;
    if (rowBottom <= revealBottom) {
      if (!Number.isFinite(this.activityRateEditorOpenScrollTop as number)) {
        this.lastActivityRateEditorLiftDelta = 0;
      }
      return;
    }
    const delta = rowBottom - revealBottom;
    const targetTop = Math.min(scrollElement.scrollTop + delta, Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight));
    if (targetTop <= scrollElement.scrollTop + 0.5) {
      this.lastActivityRateEditorLiftDelta = 0;
      if (attempt < 1) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(rowId, attempt + 1), 120);
      }
      return;
    }
    this.lastActivityRateEditorLiftDelta = targetTop - scrollElement.scrollTop;
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    scrollElement.scrollTo({ top: targetTop, behavior: 'smooth' });
    setTimeout(() => {
      scrollElement.style.scrollSnapType = previousSnapType;
    }, 220);
  }

  // =========================================================================
  // Rate card – image stack helpers
  // =========================================================================

  protected activityRateCardImageUrls(row: AppTypes.ActivityListRow): string[] {
    if (row.type !== 'rates') {
      return [];
    }
    const item = row.source as RateMenuItem;
    const user = this.activityRateUser(row);
    const generated = Array.from({ length: 6 }, (_, index) =>
      this.rateCardSeedImageUrl(row.id, user?.id ?? 'rate-fallback', user?.gender ?? this.activeUser.gender, index)
    );
    const seededCount = 1 + (AppDemoGenerators.hashText(`rate-photo-count:${user?.id ?? row.id}`) % 4);
    const desiredCount = item.direction === 'met' ? Math.min(2, seededCount) : seededCount;
    return generated.slice(0, Math.max(1, Math.min(4, desiredCount)));
  }

  protected activityRateCardActiveImageIndex(row: AppTypes.ActivityListRow): number {
    const images = this.activityRateCardImageUrls(row);
    if (images.length === 0) {
      return 0;
    }
    const current = this.activityRateCardActiveImageIndexById[row.id] ?? 0;
    return AppUtils.clampNumber(current, 0, images.length - 1);
  }

  protected activityRateCardActiveImageUrl(row: AppTypes.ActivityListRow): string {
    const images = this.activityRateCardImageUrls(row);
    if (images.length === 0) {
      return '';
    }
    return images[this.activityRateCardActiveImageIndex(row)] ?? images[0] ?? '';
  }

  protected activityRateCardHasLine(row: AppTypes.ActivityListRow, cardIndex: number): boolean {
    const card = this.activityRateCardLines(row, cardIndex);
    return card.primary.length > 0 && card.secondary.length > 0;
  }

  protected activityRateCardPrimaryLine(row: AppTypes.ActivityListRow, cardIndex: number): string {
    return this.activityRateCardLines(row, cardIndex).primary;
  }

  protected activityRateCardSecondaryLine(row: AppTypes.ActivityListRow, cardIndex: number): string {
    return this.activityRateCardLines(row, cardIndex).secondary;
  }

  private activityRateCardLines(row: AppTypes.ActivityListRow, cardIndex: number): { primary: string; secondary: string } {
    const user = this.activityRateUser(row);
    if (!user) {
      return cardIndex === 0
        ? { primary: row.title, secondary: `${row.distanceKm} km` }
        : { primary: '', secondary: '' };
    }
    const item = row.source as RateMenuItem;
    const modeLabel = item.mode === 'pair' ? 'Pair' : 'Single';
    const direction = this.displayedRateDirection(item);
    const directionLabel = `${direction.charAt(0).toUpperCase()}${direction.slice(1)}`;
    const happenedOn = this.toRateCardDateLabel(item.happenedAt);
    const cards: Array<{ primary: string; secondary: string }> = [
      { primary: `${user.name}, ${user.age}`, secondary: `${user.city} · ${row.distanceKm} km` },
      { primary: `${modeLabel} · ${directionLabel}`, secondary: `${item.eventName} · ${happenedOn}` }
    ];
    if (cardIndex < 0 || cardIndex >= cards.length) {
      return { primary: '', secondary: '' };
    }
    return cards[cardIndex] ?? { primary: '', secondary: '' };
  }

  protected isActivityRateCardImageLoading(row: AppTypes.ActivityListRow): boolean {
    return this.activityRateCardImageLoadingById[row.id] ?? false;
  }

  protected selectActivityRateCardImage(row: AppTypes.ActivityListRow, index: number, event: Event): void {
    event.stopPropagation();
    const images = this.activityRateCardImageUrls(row);
    if (images.length === 0) {
      return;
    }
    const nextIndex = AppUtils.clampNumber(index, 0, images.length - 1);
    this.activityRateCardActiveImageIndexById[row.id] = nextIndex;
    if (this.activityRateCardLoadingTimerById[row.id]) {
      clearTimeout(this.activityRateCardLoadingTimerById[row.id]);
      delete this.activityRateCardLoadingTimerById[row.id];
    }
    this.activityRateCardImageLoadingById[row.id] = true;
    const rowId = row.id;
    this.activityRateCardLoadingTimerById[row.id] = setTimeout(() => {
      this.activityRateCardImageLoadingById[rowId] = false;
      delete this.activityRateCardLoadingTimerById[rowId];
      this.cdr.markForCheck();
    }, 500);
    this.cdr.markForCheck();
  }

  protected activityRateCardContentClasses(row: AppTypes.ActivityListRow): string[] {
    const item = row.source as RateMenuItem;
    const directionClass = this.displayedRateDirection(item);
    return [
      item.mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
      `activities-rate-profile-stack-${directionClass}`
    ];
  }

  // ── Pair rate card helpers ─────────────────────────────────────────────────

  protected isPairRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair';
  }

  protected isPairReceivedRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair' && this.displayedRateDirection(rate) === 'received';
  }

  protected activityPairRateSlotUser(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): DemoUser | null {
    if (row.type !== 'rates') {
      return null;
    }
    const item = row.source as RateMenuItem;
    const primary = this.users.find(user => user.id === item.userId) ?? null;
    if (primary && primary.gender === gender) {
      return primary;
    }
    const candidates = this.users.filter(user => user.gender === gender && user.id !== primary?.id);
    if (candidates.length > 0) {
      const seed = AppDemoGenerators.hashText(`pair-rate-slot:${row.id}:${gender}`);
      return candidates[seed % candidates.length] ?? null;
    }
    if (primary && primary.gender !== gender) {
      return primary;
    }
    return null;
  }

  protected activityPairRateSlotImageUrls(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): string[] {
    const user = this.activityPairRateSlotUser(row, gender);
    if (!user) {
      return [''];
    }
    const seededCount = 2 + (AppDemoGenerators.hashText(`pair-rate-photo-count:${row.id}:${gender}:${user.id}`) % 2);
    return Array.from({ length: seededCount }, (_, index) =>
      this.rateCardSeedImageUrl(`${row.id}-${gender}`, user.id, user.gender, index)
    );
  }

  protected activityPairRateSlotActiveImageIndex(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): number {
    const images = this.activityPairRateSlotImageUrls(row, slot);
    if (images.length === 0) {
      return 0;
    }
    const key = this.activityPairRateSlotImageKey(row.id, slot);
    const current = this.activityPairRateCardActiveImageIndexByKey[key] ?? 0;
    return AppUtils.clampNumber(current, 0, images.length - 1);
  }

  protected activityPairRateSlotActiveImageUrl(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): string {
    const images = this.activityPairRateSlotImageUrls(row, slot);
    if (images.length === 0) {
      return '';
    }
    return images[this.activityPairRateSlotActiveImageIndex(row, slot)] ?? images[0] ?? '';
  }

  protected activityPairRateSlotInitials(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): string {
    const user = this.activityPairRateSlotUser(row, slot);
    if (!user) {
      return '∅';
    }
    return AppUtils.initialsFromText(user.name);
  }

  protected activityPairRateSlotPrimaryLine(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): string {
    const user = this.activityPairRateSlotUser(row, slot);
    if (!user) {
      return `${slot === 'woman' ? 'Woman' : 'Man'} · waiting`;
    }
    return `${user.name}, ${user.age}`;
  }

  protected activityPairRateSlotSecondaryLine(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): string {
    const user = this.activityPairRateSlotUser(row, slot);
    if (!user) {
      return 'No pair card yet';
    }
    return `${user.city} · ${row.distanceKm} km`;
  }

  protected isActivityPairRateSlotImageLoading(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): boolean {
    const key = this.activityPairRateSlotImageKey(row.id, slot);
    return this.activityPairRateCardImageLoadingByKey[key] ?? false;
  }

  protected selectActivityPairRateSlotImage(row: AppTypes.ActivityListRow, slot: 'man' | 'woman', index: number, event: Event): void {
    event.stopPropagation();
    const images = this.activityPairRateSlotImageUrls(row, slot);
    if (images.length === 0) {
      return;
    }
    const key = this.activityPairRateSlotImageKey(row.id, slot);
    const nextIndex = AppUtils.clampNumber(index, 0, images.length - 1);
    this.activityPairRateCardActiveImageIndexByKey[key] = nextIndex;
    if (this.activityPairRateCardLoadingTimerByKey[key]) {
      clearTimeout(this.activityPairRateCardLoadingTimerByKey[key]);
      delete this.activityPairRateCardLoadingTimerByKey[key];
    }
    this.activityPairRateCardImageLoadingByKey[key] = true;
    this.activityPairRateCardLoadingTimerByKey[key] = setTimeout(() => {
      this.activityPairRateCardImageLoadingByKey[key] = false;
      delete this.activityPairRateCardLoadingTimerByKey[key];
      this.cdr.markForCheck();
    }, 500);
    this.cdr.markForCheck();
  }

  private pulseRateIndicatorForRow(row: AppTypes.ActivityListRow | null): void {
    if (!row || row.type !== 'rates') {
      return;
    }
    if (this.lastRateIndicatorPulseRowId === row.id) {
      return;
    }
    this.lastRateIndicatorPulseRowId = row.id;
    if (this.isPairRateRow(row)) {
      (['woman', 'man'] as const).forEach(slot => {
        const key = this.activityPairRateSlotImageKey(row.id, slot);
        if (this.activityPairRateCardLoadingTimerByKey[key]) {
          clearTimeout(this.activityPairRateCardLoadingTimerByKey[key]);
          delete this.activityPairRateCardLoadingTimerByKey[key];
        }
        this.activityPairRateCardImageLoadingByKey[key] = true;
        this.activityPairRateCardLoadingTimerByKey[key] = setTimeout(() => {
          this.activityPairRateCardImageLoadingByKey[key] = false;
          delete this.activityPairRateCardLoadingTimerByKey[key];
          this.cdr.markForCheck();
        }, 500);
      });
      this.cdr.markForCheck();
      return;
    }
    const rowId = row.id;
    if (this.activityRateCardLoadingTimerById[rowId]) {
      clearTimeout(this.activityRateCardLoadingTimerById[rowId]);
      delete this.activityRateCardLoadingTimerById[rowId];
    }
    this.activityRateCardImageLoadingById[rowId] = true;
    this.activityRateCardLoadingTimerById[rowId] = setTimeout(() => {
      this.activityRateCardImageLoadingById[rowId] = false;
      delete this.activityRateCardLoadingTimerById[rowId];
      this.cdr.markForCheck();
    }, 500);
    this.cdr.markForCheck();
  }

  private activityPairRateSlotImageKey(rowId: string, gender: DemoUser['gender']): string {
    return `${rowId}:${gender}`;
  }

  private rateCardSeedImageUrl(rowId: string, userId: string, gender: DemoUser['gender'], index: number): string {
    const hash = AppDemoGenerators.hashText(`rate-card-${userId}-${rowId}-${index + 1}`);
    const genderFolder = gender === 'woman' ? 'women' : 'men';
    const portraitIndex = hash % 100;
    return `https://randomuser.me/api/portraits/${genderFolder}/${portraitIndex}.jpg`;
  }

  private toRateCardDateLabel(isoValue: string): string {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Rate badge ─────────────────────────────────────────────────────────────

  protected activityRateBadgeLabel(row: AppTypes.ActivityListRow): string {
    const ownLabel = this.activityOwnRatingLabel(row);
    return ownLabel ? ownLabel : 'Rate';
  }

  protected activityOwnRatingValue(row: AppTypes.ActivityListRow): number {
    if (row.type !== 'rates') {
      return 0;
    }
    const item = row.source as RateMenuItem;
    const drafted = this.activityRateDraftById[item.id];
    if (Number.isFinite(drafted)) {
      return this.normalizeRateScore(drafted);
    }
    if (!this.hasOwnRating(item)) {
      if (this.displayedRateDirection(item) === 'received' && item.mode === 'pair') {
        return this.pairReceivedAverageScore(item);
      }
      return 0;
    }
    return this.rateOwnScore(item);
  }

  protected activityOwnRatingLabel(row: AppTypes.ActivityListRow): string {
    const value = this.activityOwnRatingValue(row);
    return value > 0 ? `${value}` : '';
  }

  protected isActivityRatePending(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'rates') {
      return false;
    }
    const item = row.source as RateMenuItem;
    if (this.displayedRateDirection(item) === 'met') {
      return false;
    }
    if (!this.hasOwnRating(item) && this.displayedRateDirection(item) === 'received' && item.mode === 'pair') {
      return this.pairReceivedAverageScore(item) <= 0;
    }
    return !this.hasOwnRating(item);
  }

  protected isActivityRateBlinking(row: AppTypes.ActivityListRow): boolean {
    const until = this.activityRateBlinkUntilByRowId[row.id] ?? 0;
    return until > Date.now();
  }

  private triggerActivityRateBlinks(rowId: string, onStart?: () => void): void {
    const durationMs = 420;
    const existingTimer = this.activityRateBlinkTimeoutByRowId[rowId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    if (this.activityRateBarBlinkTimeout) {
      clearTimeout(this.activityRateBarBlinkTimeout);
      this.activityRateBarBlinkTimeout = null;
    }
    delete this.activityRateBlinkUntilByRowId[rowId];
    this.isActivityRateBarBlinking = false;
    this.cdr.markForCheck();

    const startBlink = () => {
      this.activityRateBlinkUntilByRowId[rowId] = Date.now() + durationMs;
      this.isActivityRateBarBlinking = true;
      onStart?.();
      this.cdr.markForCheck();
      this.activityRateBlinkTimeoutByRowId[rowId] = setTimeout(() => {
        if ((this.activityRateBlinkUntilByRowId[rowId] ?? 0) <= Date.now()) {
          delete this.activityRateBlinkUntilByRowId[rowId];
        }
        const timer = this.activityRateBlinkTimeoutByRowId[rowId];
        if (timer) {
          clearTimeout(timer);
        }
        delete this.activityRateBlinkTimeoutByRowId[rowId];
        this.cdr.markForCheck();
      }, durationMs + 32);
      this.activityRateBarBlinkTimeout = setTimeout(() => {
        this.isActivityRateBarBlinking = false;
        this.activityRateBarBlinkTimeout = null;
        this.cdr.markForCheck();
      }, durationMs);
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }

  private clearActivityRateBarBlink(): void {
    if (this.activityRateBarBlinkTimeout) {
      clearTimeout(this.activityRateBarBlinkTimeout);
      this.activityRateBarBlinkTimeout = null;
    }
    this.isActivityRateBarBlinking = false;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Pair split drag (fullscreen only)
  // =========================================================================

  protected get activitiesRatesPairSplitCssValue(): string {
    if (!this.isActivitiesRatesPairCompactViewport()) {
      return `${EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT}%`;
    }
    return `${this.activitiesRatesPairSplitPercent}%`;
  }

  protected get isActivitiesRatesPairWomanCollapsed(): boolean {
    return this.isActivitiesRatesPairMobileSplitEnabled() && this.activitiesRatesPairSplitPercent <= 0.1;
  }

  protected get isActivitiesRatesPairManCollapsed(): boolean {
    return this.isActivitiesRatesPairMobileSplitEnabled() && this.activitiesRatesPairSplitPercent >= 99.9;
  }

  protected isActivitiesRatesPairMobileSplitEnabled(): boolean {
    if (!this.isRatesFullscreenModeActive() || !this.isActivitiesRatesPairCompactViewport()) {
      return false;
    }
    const row = this.currentActivitiesRatesFullscreenRow();
    return !!row && this.isPairRateRow(row);
  }

  protected onActivitiesRatesPairSplitHandlePointerDown(event: PointerEvent, splitContainerElement: HTMLElement): void {
    if (!this.isActivitiesRatesPairMobileSplitEnabled() || this.activitiesRatesFullscreenAnimating || !splitContainerElement) {
      return;
    }
    const bounds = splitContainerElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    this.activitiesRatesPairSplitBounds = { left: bounds.left, width: bounds.width };
    this.activitiesRatesPairSplitPointerId = event.pointerId;
    this.activitiesRatesPairSplitDragStartClientX = event.clientX;
    this.activitiesRatesPairSplitDragStartPercent = this.activitiesRatesPairSplitPercent;
    this.isActivitiesRatesPairSplitDragging = true;
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement | null;
    if (target?.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }
    this.cdr.markForCheck();
  }

  protected onActivitiesRatesPairSplitHandleTouchStart(event: TouchEvent, splitContainerElement: HTMLElement): void {
    if (!this.isActivitiesRatesPairMobileSplitEnabled() || this.activitiesRatesFullscreenAnimating || !splitContainerElement) {
      return;
    }
    const touch = event.touches?.[0] ?? event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    const bounds = splitContainerElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    this.activitiesRatesPairSplitBounds = { left: bounds.left, width: bounds.width };
    this.activitiesRatesPairSplitPointerId = -1;
    this.activitiesRatesPairSplitDragStartClientX = touch.clientX;
    this.activitiesRatesPairSplitDragStartPercent = this.activitiesRatesPairSplitPercent;
    this.isActivitiesRatesPairSplitDragging = true;
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Fullscreen rates navigation
  // =========================================================================

  protected isActivitiesRatesFullscreenReadOnlyNavigation(): boolean {
    return this.isRatesFullscreenModeActive() && this.activitiesRateFilter === 'pair-received';
  }

  protected canNavigateActivitiesRatesFullscreenPrev(): boolean {
    if (!this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
      return false;
    }
    return this.activitiesRatesFullscreenCardIndex > 0;
  }

  protected canNavigateActivitiesRatesFullscreenNext(): boolean {
    if (!this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
      return false;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      return false;
    }
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, allRows.length - 1));
    return currentIndex < allRows.length - 1;
  }

  protected navigateActivitiesRatesFullscreenPrev(event?: Event): void {
    event?.stopPropagation();
    if (!this.isActivitiesRatesFullscreenReadOnlyNavigation() || this.activitiesRatesFullscreenAnimating) {
      return;
    }
    const row = this.currentActivitiesRatesFullscreenRow();
    if (!row) {
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      return;
    }
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, allRows.length - 1));
    const previousIndex = Math.max(0, currentIndex - 1);
    if (previousIndex === currentIndex) {
      return;
    }
    this.startActivitiesRatesFullscreenLeaveAnimation(row);
    this.activitiesRatesFullscreenCardIndex = previousIndex;
    this.updateActivitiesHeaderProgress();
  }

  protected navigateActivitiesRatesFullscreenNext(event?: Event): void {
    event?.stopPropagation();
    if (!this.isActivitiesRatesFullscreenReadOnlyNavigation() || this.activitiesRatesFullscreenAnimating) {
      return;
    }
    const row = this.currentActivitiesRatesFullscreenRow();
    if (!row) {
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      return;
    }
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, allRows.length - 1));
    const nextIndex = Math.min(allRows.length - 1, currentIndex + 1);
    if (nextIndex === currentIndex) {
      return;
    }
    this.startActivitiesRatesFullscreenLeaveAnimation(row);
    this.activitiesRatesFullscreenCardIndex = nextIndex;
    this.updateActivitiesHeaderProgress();
    this.maybeStartActivitiesRatesFullscreenPaginationLoad();
  }

  private activitiesRatesFullscreenRows(): AppTypes.ActivityListRow[] {
    return this.filteredActivityRows.filter(row => row.type === 'rates');
  }

  protected activitiesRatesFullscreenAllRows(): AppTypes.ActivityListRow[] {
    return this.buildFilteredActivityRowsBase().filter(row => row.type === 'rates');
  }

  protected currentActivitiesRatesFullscreenRow(): AppTypes.ActivityListRow | null {
    if (!this.isRatesFullscreenModeActive()) {
      return null;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      return null;
    }
    const currentIndex = this.activitiesRatesFullscreenCardIndex;
    if (currentIndex < 0 || currentIndex >= allRows.length) {
      return null;
    }
    return allRows[currentIndex] ?? null;
  }

  protected activitiesRatesFullscreenNext(event: Event): void {
    event.stopPropagation();
    if (this.activitiesRatesFullscreenAnimating) {
      return;
    }
    const row = this.currentActivitiesRatesFullscreenRow();
    if (!row) {
      return;
    }
    const rows = this.activitiesRatesFullscreenAllRows();
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, rows.length - 1));
    const nextIndex = Math.min(rows.length - 1, currentIndex + 1);
    if (nextIndex === currentIndex) {
      return;
    }
    this.startActivitiesRatesFullscreenLeaveAnimation(row);
    this.activitiesRatesFullscreenCardIndex = nextIndex;
    this.updateActivitiesHeaderProgress();
    this.maybeStartActivitiesRatesFullscreenPaginationLoad();
  }

  protected activitiesRatesFullscreenPrev(event: Event): void {
    event.stopPropagation();
    if (this.activitiesRatesFullscreenAnimating) {
      return;
    }
    const row = this.currentActivitiesRatesFullscreenRow();
    if (!row) {
      return;
    }
    const rows = this.activitiesRatesFullscreenAllRows();
    const currentIndex = AppUtils.clampNumber(this.activitiesRatesFullscreenCardIndex, 0, Math.max(0, rows.length - 1));
    const previousIndex = Math.max(0, currentIndex - 1);
    if (previousIndex === currentIndex) {
      return;
    }
    this.startActivitiesRatesFullscreenLeaveAnimation(row);
    this.activitiesRatesFullscreenCardIndex = previousIndex;
    this.updateActivitiesHeaderProgress();
  }

  protected onActivitiesRatesFullscreenLeaveAnimationEnd(event: AnimationEvent): void {
    if (event.animationName !== 'activities-rates-page-curl') {
      return;
    }
    if (event.currentTarget !== event.target) {
      return;
    }
    this.finishActivitiesRatesFullscreenAdvance();
  }

  protected activitiesRatesFullscreenEmptyTitle(): string {
    if (this.activitiesRatesFullscreenAllRows().length > 0) { return 'No cards available'; }
    if (this.activitiesHeaderProgressLoading) { return 'Loading more cards'; }
    return 'No items';
  }

  protected activitiesRatesFullscreenEmptyDescription(): string {
    if (this.activitiesRatesFullscreenAllRows().length > 0) { return 'Wait for more cards to load or adjust the rate filter.'; }
    if (this.activitiesHeaderProgressLoading) { return 'Preloading the next stack in the background.'; }
    return this.activitiesEmptyLabel;
  }

  protected toggleActivitiesRatesFullscreenMode(event: Event): void {
    event.stopPropagation();
    if (!this.shouldShowRatesFullscreenToggle()) {
      return;
    }
    if (this.activitiesRatesFullscreenMode) {
      this.disableActivitiesRatesFullscreenMode();
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
    this.activitiesRatesFullscreenMode = true;
    this.activitiesRatesFullscreenCardIndex = 0;
    this.activitiesRatesFullscreenAnimating = false;
    this.activitiesRatesFullscreenLeavingRow = null;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.cancelActivityRateEditorCloseTransition();
    this.activityRateEditorClosing = false;
    this.syncActivitiesRatesFullscreenSelection();
    this.activitiesContext.setActivitiesRatesFullscreenMode(true);
    this.maybeStartActivitiesRatesFullscreenPaginationLoad();
    this.refreshActivitiesHeaderProgressSoon();
  }

  private disableActivitiesRatesFullscreenMode(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
    this.activitiesRatesFullscreenMode = false;
    this.activitiesRatesFullscreenAnimating = false;
    this.activitiesRatesFullscreenLeavingRow = null;
    this.activitiesRatesFullscreenCardIndex = 0;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.clearActivityRateBarBlink();
    this.activityRateEditorClosing = false;
    this.selectedActivityRateId = null;
    this.lastActivityRateEditorLiftDelta = 0;
    this.activityRateEditorOpenScrollTop = null;
    this.lastRateIndicatorPulseRowId = null;
    this.activitiesContext.setActivitiesRatesFullscreenMode(false);
    this.activitiesContext.setActivitiesSelectedRateId(null);
    this.updateActivitiesHeaderProgress();
    this.refreshActivitiesHeaderProgressSoon();
  }

  private cancelActivitiesRatesFullscreenAdvance(): void {
    if (this.activitiesRatesFullscreenAdvanceTimer) {
      clearTimeout(this.activitiesRatesFullscreenAdvanceTimer);
      this.activitiesRatesFullscreenAdvanceTimer = null;
    }
  }

  private syncActivitiesRatesFullscreenSelection(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      this.activitiesRatesFullscreenCardIndex = 0;
      this.updateActivitiesHeaderProgress();
      return;
    }
    if (this.activitiesRatesFullscreenCardIndex < 0) {
      this.activitiesRatesFullscreenCardIndex = 0;
    }
    const maxAllowedIndex = allRows.length;
    if (this.activitiesRatesFullscreenCardIndex > maxAllowedIndex) {
      this.activitiesRatesFullscreenCardIndex = maxAllowedIndex;
    }
    if (this.activitiesRatesFullscreenCardIndex >= allRows.length) {
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      this.updateActivitiesHeaderProgress();
      return;
    }
    this.selectedActivityRateId = allRows[this.activitiesRatesFullscreenCardIndex]?.id ?? null;
    this.activitiesContext.setActivitiesSelectedRateId(this.selectedActivityRateId);
    this.pulseRateIndicatorForRow(allRows[this.activitiesRatesFullscreenCardIndex] ?? null);
    this.updateActivitiesHeaderProgress();
  }

  private startActivitiesRatesFullscreenLeaveAnimation(row: AppTypes.ActivityListRow): void {
    this.activitiesRatesFullscreenLeavingRow = row;
    this.activitiesRatesFullscreenAnimating = true;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.activitiesRatesFullscreenAdvanceTimer = setTimeout(() => {
      this.activitiesRatesFullscreenAdvanceTimer = null;
      this.finishActivitiesRatesFullscreenAdvance();
    }, this.activitiesRatesFullscreenLeaveTimeoutMs);
  }

  private finishActivitiesRatesFullscreenAdvance(): void {
    this.activitiesRatesFullscreenAnimating = false;
    this.activitiesRatesFullscreenLeavingRow = null;
    this.syncActivitiesRatesFullscreenSelection();
  }

  private maybeStartActivitiesRatesFullscreenPaginationLoad(force = false): void {
    if (!this.isRatesFullscreenModeActive() || this.isCalendarLayoutView()) {
      return;
    }
    const stateKey = this.activitiesPaginationStateKey();
    if (stateKey !== this.activitiesRatesFullscreenLoadStateKey) {
      this.activitiesRatesFullscreenLoadStateKey = stateKey;
      this.activitiesRatesFullscreenLastTriggeredLoadedCount = 0;
    }
    if (this.activitiesIsPaginating || this.activitiesHeaderProgressLoading) {
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    this.ensureActivitiesPaginationState(allRows.length);
    const loadedCount = this.activitiesVisibleCount;
    const remainingCards = loadedCount - this.activitiesRatesFullscreenCardIndex;
    if (!force && remainingCards > 2) {
      return;
    }
    if (loadedCount <= this.activitiesRatesFullscreenLastTriggeredLoadedCount) {
      return;
    }
    const allowEmptyResponse = loadedCount >= allRows.length;
    this.activitiesRatesFullscreenLastTriggeredLoadedCount = loadedCount;
    this.startActivitiesPaginationLoad(allowEmptyResponse);
  }

  private updateActivitiesRatesPairSplitFromClientX(clientX: number): void {
    if (!this.activitiesRatesPairSplitBounds || this.activitiesRatesPairSplitBounds.width <= 0) {
      return;
    }
    const relative = ((clientX - this.activitiesRatesPairSplitBounds.left) / this.activitiesRatesPairSplitBounds.width) * 100;
    this.activitiesRatesPairSplitPercent = AppUtils.clampNumber(
      relative,
      EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT,
      EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT
    );
    this.cdr.markForCheck();
  }

  private updateActivitiesRatesPairSplitFromDragDelta(clientX: number): void {
    if (!this.activitiesRatesPairSplitBounds || this.activitiesRatesPairSplitBounds.width <= 0) {
      return;
    }
    if (
      this.activitiesRatesPairSplitDragStartClientX === null
      || this.activitiesRatesPairSplitDragStartPercent === null
    ) {
      this.updateActivitiesRatesPairSplitFromClientX(clientX);
      return;
    }
    const deltaPercent =
      ((clientX - this.activitiesRatesPairSplitDragStartClientX) / this.activitiesRatesPairSplitBounds.width) * 100;
    this.activitiesRatesPairSplitPercent = AppUtils.clampNumber(
      this.activitiesRatesPairSplitDragStartPercent + deltaPercent,
      EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT,
      EventActivitiesPopupComponent.ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT
    );
    this.cdr.markForCheck();
  }

  private isActivitiesRatesPairCompactViewport(): boolean {
    return typeof globalThis.innerWidth === 'number' && globalThis.innerWidth <= 760;
  }

  private stopActivitiesRatesPairSplitDrag(): void {
    if (
      !this.isActivitiesRatesPairSplitDragging
      && this.activitiesRatesPairSplitPointerId === null
      && this.activitiesRatesPairSplitBounds === null
    ) {
      return;
    }
    this.isActivitiesRatesPairSplitDragging = false;
    this.activitiesRatesPairSplitPointerId = null;
    this.activitiesRatesPairSplitBounds = null;
    this.activitiesRatesPairSplitDragStartClientX = null;
    this.activitiesRatesPairSplitDragStartPercent = null;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Calendar – computed pages (cached getters)
  // =========================================================================

  protected get calendarMonthPages(): AppTypes.CalendarMonthPage[] {
    if (this.activitiesView !== 'month') {
      return [];
    }
    const rows = this.filteredActivityRows;
    const resolveActivityDateRange = (row: AppTypes.ActivityListRow) =>
      AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
    const monthAnchors = this.monthAnchorsForRows(rows);
    const cacheKey = [
      this.activeUser.id,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
      this.hostingPublicationFilter,
      this.activitiesRateFilter,
      this.activitiesView,
      AppCalendarHelpers.calendarRowsSignature(rows, this.activityDateTimeRangeById),
      monthAnchors.map(anchor => AppCalendarHelpers.monthKey(anchor)).join(',')
    ].join('|');
    if (cacheKey === this.calendarMonthPagesCacheKey) {
      return this.calendarMonthPagesCache;
    }
    const rowsByDate = AppCalendarHelpers.buildActivityRowsByDate(rows, resolveActivityDateRange);
    this.calendarMonthPagesCache = monthAnchors.map(anchor =>
      AppCalendarHelpers.buildMonthPage(anchor, rowsByDate, rows, resolveActivityDateRange)
    );
    this.calendarMonthPagesCacheKey = cacheKey;
    return this.calendarMonthPagesCache;
  }

  protected get calendarWeekPages(): AppTypes.CalendarWeekPage[] {
    if (this.activitiesView !== 'week') {
      return [];
    }
    const rows = this.filteredActivityRows;
    const resolveActivityDateRange = (row: AppTypes.ActivityListRow) =>
      AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
    const weekAnchors = this.weekAnchorsForRows(rows);
    const cacheKey = [
      this.activeUser.id,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
      this.hostingPublicationFilter,
      this.activitiesRateFilter,
      this.activitiesView,
      AppCalendarHelpers.calendarRowsSignature(rows, this.activityDateTimeRangeById),
      weekAnchors.map(anchor => AppCalendarHelpers.dateKey(anchor)).join(',')
    ].join('|');
    if (cacheKey === this.calendarWeekPagesCacheKey) {
      return this.calendarWeekPagesCache;
    }
    const rowsByDate = AppCalendarHelpers.buildActivityRowsByDate(rows, resolveActivityDateRange);
    this.calendarWeekPagesCache = weekAnchors.map(anchor => AppCalendarHelpers.buildWeekPage(anchor, rowsByDate));
    this.calendarWeekPagesCacheKey = cacheKey;
    return this.calendarWeekPagesCache;
  }

  // =========================================================================
  // Calendar – template helpers
  // =========================================================================

  protected weekHourLabel(hour: number): string {
    return `${`${hour}`.padStart(2, '0')}:00`;
  }

  protected weekDayTimedBadges(day: AppTypes.CalendarDayCell): AppTypes.CalendarTimedBadge[] {
    const dayStart = new Date(day.date);
    dayStart.setHours(this.weekCalendarStartHour, 0, 0, 0);
    const dayEnd = new Date(day.date);
    dayEnd.setHours(this.weekCalendarEndHour + 1, 0, 0, 0);
    const totalMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000;
    const badges: AppTypes.CalendarTimedBadge[] = [];
    for (const row of day.rows) {
      const range = AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
      if (!range) {
        continue;
      }
      const segmentStart = new Date(Math.max(range.start.getTime(), dayStart.getTime()));
      const segmentEnd = new Date(Math.min(range.end.getTime(), dayEnd.getTime()));
      if (segmentEnd.getTime() <= segmentStart.getTime()) {
        continue;
      }
      const minutesFromTop = (segmentStart.getTime() - dayStart.getTime()) / 60000;
      const durationMinutes = (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
      badges.push({
        row,
        topPct: (minutesFromTop / totalMinutes) * 100,
        heightPct: Math.max(2.2, (durationMinutes / totalMinutes) * 100)
      });
    }
    return badges;
  }

  protected monthRateCount(day: AppTypes.CalendarDayCell): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    return day.rows.length;
  }

  protected monthRateHeatClass(day: AppTypes.CalendarDayCell): string {
    return AppCalendarHelpers.rateHeatClass(this.monthRateCount(day));
  }

  protected weekRateDayCount(day: AppTypes.CalendarDayCell): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    return day.rows.length;
  }

  protected weekRateDayHeatClass(day: AppTypes.CalendarDayCell): string {
    return AppCalendarHelpers.rateHeatClass(this.weekRateDayCount(day));
  }

  protected weekRateHourCount(day: AppTypes.CalendarDayCell, hour: number): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    const slotStart = new Date(day.date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return AppCalendarHelpers.countOverlappingRows(
      day.rows,
      slotStart,
      slotEnd,
      row => AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById)
    );
  }

  protected rateHeatClassByCount(count: number): string {
    return AppCalendarHelpers.rateHeatClass(count);
  }

  protected rateCountLabel(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    return value > 99 ? '99+' : `${value}`;
  }

  protected monthWeekLaneCount(week: AppTypes.CalendarMonthWeek): number {
    if (week.spans.length === 0) {
      return 0;
    }
    return week.spans.reduce((maxLane, span) => Math.max(maxLane, span.lane + 1), 0);
  }

  protected calendarBadgeToneClass(row: AppTypes.ActivityListRow): string {
    const paletteSize = 8;
    const toneIndex = (AppDemoGenerators.hashText(row.id) % paletteSize) + 1;
    return `calendar-badge-tone-${toneIndex}`;
  }

  protected areCalendarBadgesReady(pageKey: string): boolean {
    if (!this.isCalendarLayoutView()) {
      return true;
    }
    return this.activitiesCalendarBadgesReadyDelayKeys.has(this.calendarBadgeDelayKey(pageKey));
  }

  protected trackByCalendarPageKey(_: number, page: AppTypes.CalendarMonthPage | AppTypes.CalendarWeekPage): string {
    return page.key;
  }

  protected trackByCalendarMonthWeekKey(_: number, week: AppTypes.CalendarMonthWeek): string {
    return AppCalendarHelpers.dateKey(week.start);
  }

  protected trackByCalendarDayKey(_: number, day: AppTypes.CalendarDayCell): string {
    return day.key;
  }

  // =========================================================================
  // Calendar – navigation
  // =========================================================================

  protected onActivitiesCalendarScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.updateActivitiesStickyHeader(target.scrollTop || 0);
    this.updateActivitiesHeaderProgress();
    if (!this.isCalendarLayoutView()) {
      return;
    }
    if (this.suppressCalendarEdgeSettle) {
      return;
    }
    if (this.calendarEdgeSettleTimer) {
      clearTimeout(this.calendarEdgeSettleTimer);
    }
    if (this.calendarPostSettleTimer) {
      clearTimeout(this.calendarPostSettleTimer);
      this.calendarPostSettleTimer = null;
    }
    this.calendarEdgeSettleTimer = setTimeout(() => {
      this.calendarEdgeSettleTimer = null;
      if (this.suppressCalendarEdgeSettle) {
        return;
      }
      this.normalizeCalendarScrollPageAlignment(target);
      const scrollLeftSnapshot = target.scrollLeft;
      this.calendarPostSettleTimer = setTimeout(() => {
        this.calendarPostSettleTimer = null;
        if (this.suppressCalendarEdgeSettle || !this.isCalendarLayoutView()) {
          return;
        }
        if (Math.abs(target.scrollLeft - scrollLeftSnapshot) > 1) {
          return;
        }
        this.normalizeCalendarScrollPageAlignment(target);
        this.maybeSyncActivitiesCalendarBadgeDelayByPage();
        this.handleCalendarEdgeSettle(target);
      }, 100);
    }, 120);
  }

  protected navigateActivitiesCalendarTo(pageIndex: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.isCalendarLayoutView()) {
      return;
    }
    const pages = this.activitiesView === 'month' ? this.calendarMonthPages : this.calendarWeekPages;
    if (pages.length === 0) {
      return;
    }
    const currentIndex = this.currentCalendarPageIndex();
    const delta = pageIndex - currentIndex;
    if (delta === 0) {
      return;
    }
    const step = delta > 0 ? 1 : -1;
    const calendarElement = this.activitiesCalendarScrollRef?.nativeElement;
    if (!calendarElement) {
      return;
    }
    const pageWidth = calendarElement.clientWidth || 0;
    if (pageWidth <= 0) {
      return;
    }
    const targetIndex = Math.max(0, Math.min(pages.length - 1, currentIndex + step));
    if (targetIndex === currentIndex) {
      this.beginActivitiesHeaderProgressLoading();
      this.shiftCalendarPages(step);
      const edgeHoldIndex = step < 0 ? 1 : pages.length - 2;
      this.calendarInitialPageIndexOverride = edgeHoldIndex;
      this.resetActivitiesScroll();
      const scrollAfterShift = () => {
        const nextElement = this.activitiesCalendarScrollRef?.nativeElement;
        if (!nextElement) {
          this.endActivitiesHeaderProgressLoading();
          return;
        }
        const nextWidth = nextElement.clientWidth || 0;
        if (nextWidth <= 0) {
          this.endActivitiesHeaderProgressLoading();
          return;
        }
        const previousScrollBehavior = nextElement.style.scrollBehavior;
        nextElement.style.scrollBehavior = 'auto';
        nextElement.scrollLeft = nextWidth * edgeHoldIndex;
        nextElement.style.scrollBehavior = previousScrollBehavior;
        nextElement.scrollTo({
          left: nextWidth * (edgeHoldIndex + step),
          behavior: 'smooth'
        });
        this.endActivitiesHeaderProgressLoading();
      };
      setTimeout(scrollAfterShift, 100);
      return;
    }
    calendarElement.scrollTo({ left: targetIndex * pageWidth, behavior: 'smooth' });
  }

  protected navigateActivitiesCalendarBackward(event?: Event): void {
    this.navigateActivitiesCalendarTo(this.currentCalendarPageIndex() - 1, event);
  }

  protected navigateActivitiesCalendarForward(event?: Event): void {
    this.navigateActivitiesCalendarTo(this.currentCalendarPageIndex() + 1, event);
  }

  // =========================================================================
  // Calendar – private helpers
  // =========================================================================

  private monthAnchorsForRows(_rows: AppTypes.ActivityListRow[]): Date[] {
    if (this.calendarMonthAnchorPages && this.calendarMonthAnchorPages.length > 0) {
      return [...this.calendarMonthAnchorPages];
    }
    const todayMonth = AppUtils.startOfMonth(AppUtils.dateOnly(new Date()));
    const focusMonth = this.calendarMonthFocusDate ? AppUtils.startOfMonth(this.calendarMonthFocusDate) : todayMonth;
    this.calendarMonthAnchorPages = AppUtils.buildMonthAnchorWindow(focusMonth, this.calendarAnchorRadius);
    return [...this.calendarMonthAnchorPages];
  }

  private weekAnchorsForRows(_rows: AppTypes.ActivityListRow[]): Date[] {
    if (this.calendarWeekAnchorPages && this.calendarWeekAnchorPages.length > 0) {
      return [...this.calendarWeekAnchorPages];
    }
    const todayWeek = AppUtils.startOfWeekMonday(AppUtils.dateOnly(new Date()));
    const focusWeek = this.calendarWeekFocusDate ? AppUtils.startOfWeekMonday(this.calendarWeekFocusDate) : todayWeek;
    this.calendarWeekAnchorPages = AppUtils.buildWeekAnchorWindow(focusWeek, this.calendarAnchorRadius);
    return [...this.calendarWeekAnchorPages];
  }

  private initialCalendarPageIndex(): number {
    const today = AppUtils.dateOnly(new Date());
    if (this.activitiesView === 'month') {
      const focus = this.calendarMonthFocusDate ? AppUtils.startOfMonth(this.calendarMonthFocusDate) : AppUtils.startOfMonth(today);
      const monthKey = AppCalendarHelpers.monthKey(focus);
      const pages = this.calendarMonthPages;
      const pageIndex = pages.findIndex(page => page.key === monthKey);
      return pageIndex >= 0 ? pageIndex : Math.min(this.calendarAnchorRadius, Math.max(0, pages.length - 1));
    }
    if (this.activitiesView === 'week') {
      const focus = this.calendarWeekFocusDate ? AppUtils.startOfWeekMonday(this.calendarWeekFocusDate) : AppUtils.startOfWeekMonday(today);
      const weekKey = AppCalendarHelpers.dateKey(focus);
      const pages = this.calendarWeekPages;
      const pageIndex = pages.findIndex(page => page.key === weekKey);
      return pageIndex >= 0 ? pageIndex : Math.min(this.calendarAnchorRadius, Math.max(0, pages.length - 1));
    }
    return 0;
  }

  private currentCalendarPageIndex(): number {
    const calendarElement = this.activitiesCalendarScrollRef?.nativeElement;
    if (!calendarElement) {
      return 0;
    }
    const pageWidth = calendarElement.clientWidth || 0;
    if (pageWidth <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(calendarElement.scrollLeft / pageWidth));
  }

  private normalizeCalendarScrollPageAlignment(calendarElement: HTMLElement): void {
    const pageWidth = calendarElement.clientWidth || 0;
    if (pageWidth <= 0) {
      return;
    }
    const nearestPageIndex = Math.max(0, Math.round(calendarElement.scrollLeft / pageWidth));
    const nearestPageLeft = nearestPageIndex * pageWidth;
    if (Math.abs(calendarElement.scrollLeft - nearestPageLeft) > 0.75) {
      return;
    }
    const previousScrollBehavior = calendarElement.style.scrollBehavior;
    calendarElement.style.scrollBehavior = 'auto';
    calendarElement.scrollLeft = nearestPageLeft;
    calendarElement.style.scrollBehavior = previousScrollBehavior;
  }

  private handleCalendarEdgeSettle(calendarElement: HTMLElement): void {
    if (this.suppressCalendarEdgeSettle) {
      return;
    }
    const pageWidth = calendarElement.clientWidth || 0;
    if (pageWidth <= 0) {
      return;
    }
    const pages = this.activitiesView === 'month' ? this.calendarMonthPages : this.calendarWeekPages;
    if (pages.length < this.calendarAnchorWindowSize) {
      return;
    }
    const rawPageIndex = calendarElement.scrollLeft / pageWidth;
    const nearestPageIndex = Math.max(0, Math.min(pages.length - 1, Math.round(rawPageIndex)));
    const nearestPageLeft = nearestPageIndex * pageWidth;
    if (Math.abs(calendarElement.scrollLeft - nearestPageLeft) > 1) {
      return;
    }
    const atLeftEdge = nearestPageIndex === 0;
    const atRightEdge = nearestPageIndex === pages.length - 1;
    if (!atLeftEdge && !atRightEdge) {
      return;
    }
    this.suppressCalendarEdgeSettle = true;
    this.beginActivitiesHeaderProgressLoading();
    const edgePage = atLeftEdge ? pages[0] : pages[pages.length - 1];
    if (this.activitiesView === 'month') {
      this.calendarMonthFocusDate =
        AppCalendarHelpers.parseMonthKey(edgePage.key) ??
        AppUtils.startOfMonth(AppUtils.dateOnly(new Date()));
    } else {
      this.calendarWeekFocusDate =
        AppCalendarHelpers.parseDateKey(edgePage.key) ??
        AppUtils.startOfWeekMonday(AppUtils.dateOnly(new Date()));
    }
    this.shiftCalendarPages(atLeftEdge ? -1 : 1);
    const stabilizeAfterShift = () => {
      const nextElement = this.activitiesCalendarScrollRef?.nativeElement;
      if (!nextElement) {
        this.suppressCalendarEdgeSettle = false;
        this.endActivitiesHeaderProgressLoading();
        return;
      }
      const nextWidth = nextElement.clientWidth || 0;
      if (nextWidth <= 0) {
        this.suppressCalendarEdgeSettle = false;
        this.endActivitiesHeaderProgressLoading();
        return;
      }
      const previousScrollBehavior = nextElement.style.scrollBehavior;
      const previousSnapType = nextElement.style.scrollSnapType;
      nextElement.style.scrollBehavior = 'auto';
      nextElement.style.scrollSnapType = 'none';
      const settledIndex = atLeftEdge ? 1 : pages.length - 2;
      nextElement.scrollLeft = nextWidth * settledIndex;
      nextElement.style.scrollBehavior = previousScrollBehavior;
      const release = () => {
        nextElement.style.scrollSnapType = previousSnapType;
        this.suppressCalendarEdgeSettle = false;
        this.updateActivitiesStickyHeader(0);
        this.updateActivitiesHeaderProgress();
        this.endActivitiesHeaderProgressLoading();
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => release());
      } else {
        setTimeout(release, 0);
      }
    };
    setTimeout(stabilizeAfterShift, 0);
  }

  private shiftCalendarPages(direction: -1 | 1): void {
    if (this.activitiesView === 'month') {
      const pages = this.calendarMonthAnchorPages ?? this.monthAnchorsForRows([]);
      if (pages.length < this.calendarAnchorWindowSize) {
        return;
      }
      if (direction < 0) {
        const first = pages[0];
        this.calendarMonthAnchorPages = [AppUtils.addMonths(first, -1), ...pages.slice(0, pages.length - 1)];
      } else {
        const last = pages[pages.length - 1];
        this.calendarMonthAnchorPages = [...pages.slice(1), AppUtils.addMonths(last, 1)];
      }
      return;
    }
    const pages = this.calendarWeekAnchorPages ?? this.weekAnchorsForRows([]);
    if (pages.length < this.calendarAnchorWindowSize) {
      return;
    }
    if (direction < 0) {
      const first = pages[0];
      this.calendarWeekAnchorPages = [AppUtils.addDays(first, -7), ...pages.slice(0, pages.length - 1)];
    } else {
      const last = pages[pages.length - 1];
      this.calendarWeekAnchorPages = [...pages.slice(1), AppUtils.addDays(last, 7)];
    }
  }

  private scheduleCalendarAnchorHydration(): void {
    if (this.isMobileView) {
      return;
    }
    if (this.activitiesView === 'month') {
      if (this.calendarMonthAnchorsHydrated || !this.calendarMonthAnchorPages || this.calendarMonthAnchorPages.length !== 1) {
        return;
      }
      this.calendarMonthAnchorsHydrated = true;
    } else if (this.activitiesView === 'week') {
      if (this.calendarWeekAnchorsHydrated || !this.calendarWeekAnchorPages || this.calendarWeekAnchorPages.length !== 1) {
        return;
      }
      this.calendarWeekAnchorsHydrated = true;
    } else {
      return;
    }
    setTimeout(() => {
      if (this.activitiesView === 'month' && this.calendarMonthAnchorPages?.length === 1) {
        const focus = this.calendarMonthAnchorPages[0];
        this.calendarMonthAnchorPages = AppUtils.buildMonthAnchorWindow(focus, this.calendarAnchorRadius);
      } else if (this.activitiesView === 'week' && this.calendarWeekAnchorPages?.length === 1) {
        const focus = this.calendarWeekAnchorPages[0];
        this.calendarWeekAnchorPages = AppUtils.buildWeekAnchorWindow(focus, this.calendarAnchorRadius);
      } else {
        return;
      }
      this.calendarInitialPageIndexOverride = this.calendarAnchorRadius;
      this.resetActivitiesScroll();
    }, 0);
  }

  // =========================================================================
  // Calendar – badge delay
  // =========================================================================

  private syncActivitiesCalendarBadgeDelay(): void {
    if (!this.isCalendarLayoutView()) {
      this.clearActivitiesCalendarBadgeDelay();
      return;
    }
    const pageKey = this.currentActivitiesCalendarBadgeDelayPageKey();
    if (!pageKey) {
      return;
    }
    this.activitiesCalendarBadgeDelayPageKey = pageKey;
    const delayKey = this.calendarBadgeDelayKey(pageKey);
    if (this.activitiesCalendarBadgesReadyDelayKeys.has(delayKey)) {
      if (this.activitiesCalendarBadgesTimer) {
        clearTimeout(this.activitiesCalendarBadgesTimer);
        this.activitiesCalendarBadgesTimer = null;
      }
      if (this.activitiesCalendarBadgesLoadingActive) {
        this.endActivitiesHeaderProgressLoading();
        this.activitiesCalendarBadgesLoadingActive = false;
      }
      this.activitiesCalendarBadgesLoadingDelayKey = '';
      return;
    }
    if (this.activitiesCalendarBadgesTimer && this.activitiesCalendarBadgesLoadingDelayKey === delayKey) {
      return;
    }
    if (this.activitiesCalendarBadgesTimer) {
      clearTimeout(this.activitiesCalendarBadgesTimer);
      this.activitiesCalendarBadgesTimer = null;
    }
    if (this.activitiesCalendarBadgesLoadingActive) {
      this.endActivitiesHeaderProgressLoading();
      this.activitiesCalendarBadgesLoadingActive = false;
    }
    this.activitiesCalendarBadgesLoadingDelayKey = delayKey;
    this.beginActivitiesHeaderProgressLoading();
    this.activitiesCalendarBadgesLoadingActive = true;
    this.activitiesCalendarBadgesTimer = setTimeout(() => {
      this.activitiesCalendarBadgesTimer = null;
      this.activitiesCalendarBadgesReadyDelayKeys.add(delayKey);
      if (this.activitiesCalendarBadgesLoadingActive) {
        this.endActivitiesHeaderProgressLoading();
        this.activitiesCalendarBadgesLoadingActive = false;
      }
      this.activitiesCalendarBadgesLoadingDelayKey = '';
      this.cdr.markForCheck();
    }, this.activitiesPaginationLoadDelayMs);
  }

  private clearActivitiesCalendarBadgeDelay(): void {
    if (this.activitiesCalendarBadgesTimer) {
      clearTimeout(this.activitiesCalendarBadgesTimer);
      this.activitiesCalendarBadgesTimer = null;
    }
    if (this.activitiesCalendarBadgesLoadingActive) {
      this.endActivitiesHeaderProgressLoading();
      this.activitiesCalendarBadgesLoadingActive = false;
    }
    this.activitiesCalendarBadgesLoadingDelayKey = '';
    this.activitiesCalendarBadgesReadyDelayKeys.clear();
    this.activitiesCalendarBadgeDelayPageKey = '';
  }

  private maybeSyncActivitiesCalendarBadgeDelayByPage(): void {
    if (!this.isCalendarLayoutView()) {
      return;
    }
    const nextKey = this.currentActivitiesCalendarBadgeDelayPageKey();
    if (!nextKey || nextKey === this.activitiesCalendarBadgeDelayPageKey) {
      return;
    }
    this.activitiesCalendarBadgeDelayPageKey = nextKey;
    this.syncActivitiesCalendarBadgeDelay();
  }

  private currentActivitiesCalendarBadgeDelayPageKey(): string {
    if (!this.isCalendarLayoutView()) {
      return '';
    }
    const pages = this.activitiesView === 'month' ? this.calendarMonthPages : this.calendarWeekPages;
    if (pages.length === 0) {
      return '';
    }
    const pageIndex = Math.max(0, Math.min(pages.length - 1, this.currentCalendarPageIndex()));
    return pages[pageIndex]?.key ?? '';
  }

  private calendarBadgeDelayKey(pageKey: string): string {
    return `${this.activitiesView}:${pageKey}`;
  }

  // =========================================================================
  // Scroll helpers
  // =========================================================================

  protected onActivitiesScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.updateActivitiesStickyHeader(target.scrollTop || 0);
    this.updateActivitiesHeaderProgress();
    this.maybeLoadMoreActivities(target);
  }

  private resetActivitiesScroll(loadCalendarBadgesForCurrentPage = false): void {
    this.cancelActivitiesPaginationLoad();
    this.clearActivitiesHeaderLoadingAnimation();
    if (this.activitiesPrimaryFilter !== 'rates') {
      this.activitiesInitialLoadPending = true;
      this.updateActivitiesHeaderProgress();
      this.refreshActivitiesHeaderProgressSoon();
      return;
    }

    this.seedActivitiesStickyHeader();
    if (this.isCalendarLayoutView()) {
      this.activitiesInitialLoadPending = false;
      this.clearActivitiesCalendarBadgeDelay();
    } else {
      this.activitiesPaginationKey = this.activitiesPaginationStateKey();
      this.activitiesVisibleCount = 0;
      this.activitiesPaginationAwaitScrollReset = false;
      if (this.shouldUseServerSidePagination()) {
        this.serverPageRows = [];
        this.serverPageTotalRows = 0;
        this.serverPageIndex = 0;
        this.serverPageStateKey = this.activitiesPaginationKey;
      }
      this.activitiesInitialLoadPending = true;
      this.startActivitiesPaginationLoad(true);
    }
    setTimeout(() => {
      const scrollElement = this.activitiesListScrollElement();
      const calendarElement = this.activitiesCalendarScrollRef?.nativeElement;
      if (this.isCalendarLayoutView()) {
        if (calendarElement) {
          const initialIndex = this.calendarInitialPageIndexOverride ?? this.initialCalendarPageIndex();
          this.calendarInitialPageIndexOverride = null;
          const pageWidth = calendarElement.clientWidth || 0;
          if (pageWidth > 0) {
            this.suppressCalendarEdgeSettle = true;
            const previousScrollBehavior = calendarElement.style.scrollBehavior;
            const previousSnapType = calendarElement.style.scrollSnapType;
            calendarElement.style.scrollBehavior = 'auto';
            if (this.isMobileView) {
              calendarElement.style.scrollSnapType = 'none';
            }
            calendarElement.scrollLeft = Math.max(0, initialIndex * pageWidth);
            calendarElement.style.scrollBehavior = previousScrollBehavior;
            const release = () => {
              if (this.isMobileView) {
                calendarElement.style.scrollSnapType = previousSnapType;
              }
              this.suppressCalendarEdgeSettle = false;
            };
            if (typeof globalThis.requestAnimationFrame === 'function') {
              globalThis.requestAnimationFrame(() => release());
            } else {
              setTimeout(release, 0);
            }
          }
          this.scheduleCalendarAnchorHydration();
        }
      } else if (scrollElement) {
        scrollElement.scrollTop = 0;
      }
      const syncSticky = () => this.updateActivitiesStickyHeader(scrollElement?.scrollTop ?? 0);
      this.updateActivitiesHeaderProgress();
      if (this.isCalendarLayoutView() && loadCalendarBadgesForCurrentPage) {
        this.syncActivitiesCalendarBadgeDelay();
      }
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(syncSticky));
        return;
      }
      setTimeout(syncSticky, 0);
    }, 0);
  }

  private setStickyValue(value: string): void {
    this.activitiesStickyValue = value;
    this.activitiesContext.setActivitiesStickyValue(value);
  }

  private seedActivitiesStickyHeader(): void {
    if (this.activitiesView === 'month') {
      this.setStickyValue(this.calendarMonthPages[0]?.label ?? 'No items');
      return;
    }
    if (this.activitiesView === 'week') {
      this.setStickyValue(this.calendarWeekPages[0]?.label ?? 'No items');
      return;
    }
    const firstGroup = this.groupedActivityRows[0];
    if (firstGroup) {
      this.setStickyValue(firstGroup.label);
      return;
    }
    this.setStickyValue(this.activitiesView === 'distance' ? '5 km' : 'No items');
  }

  private updateActivitiesStickyHeader(scrollTop: number): void {
    if (this.activitiesView === 'month' || this.activitiesView === 'week') {
      const calendarElement = this.activitiesCalendarScrollRef?.nativeElement;
      if (!calendarElement) {
        this.seedActivitiesStickyHeader();
        return;
      }
      const pageWidth = calendarElement.clientWidth || 1;
      const pageIndex = Math.max(0, Math.round(calendarElement.scrollLeft / pageWidth));
      if (this.activitiesView === 'month') {
        this.setStickyValue(this.calendarMonthPages[pageIndex]?.label ?? this.calendarMonthPages[0]?.label ?? 'No items');
        return;
      }
      this.setStickyValue(this.calendarWeekPages[pageIndex]?.label ?? this.calendarWeekPages[0]?.label ?? 'No items');
      return;
    }
    const groups = this.groupedActivityRows;
    if (groups.length === 0) {
      this.setStickyValue(this.activitiesView === 'distance' ? '5 km' : 'No items');
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    if (!scrollElement) {
      this.setStickyValue(groups[0].label);
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.activities-sticky-header');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = scrollTop + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.activities-row-item'));
    if (rows.length === 0) {
      this.setStickyValue(groups[0].label);
      return;
    }
    if (scrollTop <= 1) {
      this.setStickyValue(rows[0].dataset['groupLabel'] ?? groups[0].label);
      return;
    }
    const alignmentTolerancePx = 2;
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - alignmentTolerancePx) ??
      rows[rows.length - 1];
    this.setStickyValue(activeRow.dataset['groupLabel'] ?? groups[0].label);
  }

  // =========================================================================
  // Pagination
  // =========================================================================

  private maybeLoadMoreActivities(scrollElement: HTMLElement): void {
    if (this.isCalendarLayoutView() || this.activitiesIsPaginating) {
      return;
    }
    const rows = this.buildFilteredActivityRowsBase();
    if (!this.shouldUseServerSidePagination()) {
      this.ensureActivitiesPaginationState(rows.length);
    }
    const totalRows = this.shouldUseServerSidePagination()
      ? (this.serverPageTotalRows > 0 ? this.serverPageTotalRows : rows.length)
      : rows.length;
    if (this.activitiesVisibleCount >= totalRows) {
      return;
    }
    const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    if (this.activitiesPaginationAwaitScrollReset) {
      if (remainingPx > 360) {
        this.activitiesPaginationAwaitScrollReset = false;
      }
      return;
    }
    if (!this.shouldStartActivitiesPreload(scrollElement) && remainingPx > 520) {
      return;
    }
    this.startActivitiesPaginationLoad();
  }

  private startActivitiesPaginationLoad(allowEmptyResponse = false): void {
    if (this.shouldUseServerSidePagination()) {
      this.startServerActivitiesPaginationLoad(allowEmptyResponse);
      return;
    }
    this.startLocalActivitiesPaginationLoad(allowEmptyResponse);
  }

  private startLocalActivitiesPaginationLoad(allowEmptyResponse = false): void {
    if (this.activitiesIsPaginating) {
      return;
    }
    if (!allowEmptyResponse) {
      const rows = this.buildFilteredActivityRowsBase();
      this.ensureActivitiesPaginationState(rows.length);
      if (this.activitiesVisibleCount >= rows.length) {
        return;
      }
    }
    this.activitiesIsPaginating = true;
    this.beginActivitiesHeaderProgressLoading();
    this.activitiesLoadMoreTimer = setTimeout(() => {
      this.activitiesLoadMoreTimer = null;
      const previousVisibleCount = this.activitiesVisibleCount;
      const latestRows = this.buildFilteredActivityRowsBase();
      this.ensureActivitiesPaginationState(latestRows.length);
      if (latestRows.length > previousVisibleCount) {
        this.activitiesVisibleCount = Math.min(previousVisibleCount + this.activitiesPageSize, latestRows.length);
      }
      this.activitiesInitialLoadPending = false;
      this.activitiesIsPaginating = false;
      this.activitiesPaginationAwaitScrollReset = true;
      this.endActivitiesHeaderProgressLoading();
      this.refreshActivitiesStickyHeaderSoon();
      this.updateActivitiesHeaderProgress();
      this.refreshActivitiesHeaderProgressSoon();
    }, this.activitiesPaginationLoadDelayMs);
  }

  private startServerActivitiesPaginationLoad(allowEmptyResponse = false): void {
    if (this.activitiesIsPaginating) {
      return;
    }
    if (!allowEmptyResponse && this.serverPageTotalRows > 0 && this.serverPageRows.length >= this.serverPageTotalRows) {
      return;
    }
    this.activitiesIsPaginating = true;
    this.beginActivitiesHeaderProgressLoading();

    const currentStateKey = this.activitiesPaginationStateKey();
    this.serverPageStateKey = currentStateKey;
    const request: ActivitiesPageRequest = {
      primaryFilter: this.activitiesPrimaryFilter,
      secondaryFilter: this.activitiesSecondaryFilter,
      chatContextFilter: this.activitiesChatContextFilter,
      hostingPublicationFilter: this.hostingPublicationFilter,
      rateFilter: this.activitiesRateFilter,
      view: this.activitiesView,
      page: this.serverPageIndex,
      pageSize: this.activitiesPageSize
    };

    void this.activitiesContext.loadActivitiesPage(request)
      .then(page => {
        if (this.serverPageStateKey !== currentStateKey) {
          return;
        }
        const nextRows = page?.rows ?? [];
        this.serverPageRows = this.serverPageIndex === 0
          ? [...nextRows]
          : [...this.serverPageRows, ...nextRows];
        this.serverPageTotalRows = page
          ? Math.max(this.serverPageRows.length, Math.max(0, Math.trunc(page.total)))
          : this.serverPageRows.length;
        if (nextRows.length > 0) {
          this.serverPageIndex += 1;
        }
        this.activitiesVisibleCount = this.serverPageRows.length;
        this.activitiesInitialLoadPending = false;
      })
      .catch(() => {
        this.activitiesInitialLoadPending = false;
      })
      .finally(() => {
        this.activitiesIsPaginating = false;
        this.activitiesPaginationAwaitScrollReset = true;
        this.endActivitiesHeaderProgressLoading();
        this.refreshActivitiesStickyHeaderSoon();
        this.updateActivitiesHeaderProgress();
        this.refreshActivitiesHeaderProgressSoon();
        this.cdr.markForCheck();
      });
  }

  private shouldStartActivitiesPreload(scrollElement: HTMLElement): boolean {
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.activities-row-item'));
    if (rows.length === 0) {
      return false;
    }
    if (rows.length <= 3) {
      return true;
    }
    const thirdFromLast = rows[rows.length - 3];
    const viewportBottom = scrollElement.scrollTop + scrollElement.clientHeight;
    return viewportBottom >= thirdFromLast.offsetTop;
  }

  private ensureActivitiesPaginationState(totalRows: number): void {
    if (this.shouldUseServerSidePagination()) {
      return;
    }
    const nextKey = this.activitiesPaginationStateKey();
    if (nextKey === this.activitiesPaginationKey) {
      return;
    }
    this.activitiesPaginationKey = nextKey;
    this.activitiesVisibleCount = this.activitiesInitialLoadPending
      ? 0
      : Math.min(this.activitiesPageSize, totalRows);
    this.activitiesPaginationAwaitScrollReset = false;
    this.cancelActivitiesPaginationLoad();
    this.updateActivitiesHeaderProgress();
  }

  private activitiesPaginationStateKey(): string {
    return [
      this.activeUser.id,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
      this.hostingPublicationFilter,
      this.activitiesRateFilter,
      this.activitiesView
    ].join('|');
  }

  private cancelActivitiesPaginationLoad(): void {
    if (this.activitiesLoadMoreTimer) {
      clearTimeout(this.activitiesLoadMoreTimer);
      this.activitiesLoadMoreTimer = null;
    }
    if (this.activitiesIsPaginating) {
      this.activitiesIsPaginating = false;
      this.endActivitiesHeaderProgressLoading();
    }
    if (this.shouldUseServerSidePagination()) {
      this.serverPageStateKey = '';
    }
    this.activitiesPaginationAwaitScrollReset = false;
    this.activitiesInitialLoadPending = false;
  }

  // =========================================================================
  // Surface click (closes pickers / menus)
  // =========================================================================

  protected onActivitiesPopupSurfaceClick(event: MouseEvent): void {
    if (
      this.showActivitiesViewPicker
      || this.showActivitiesSecondaryPicker
      || this.showActivitiesPrimaryPicker
      || this.showActivitiesChatContextPicker
      || this.showActivitiesRatePicker
    ) {
      this.showActivitiesViewPicker      = false;
      this.showActivitiesSecondaryPicker = false;
      this.showActivitiesPrimaryPicker = false;
      this.showActivitiesChatContextPicker = false;
      this.showActivitiesRatePicker = false;
      this.cdr.markForCheck();
    }
    if (this.inlineItemActionMenu) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    this.maybeDismissActivityRateEditor(target);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private isHostingPublished(id: string): boolean {
    return this.publishedHostingIds.has(id);
  }

  private generatedRateItemsForUser(userId: string): RateMenuItem[] {
    if (this.generatedRateItemsByUser[userId]) {
      return this.generatedRateItemsByUser[userId];
    }
    const otherUsers = this.users
      .filter(user => user.id !== userId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const filterLanes: Array<{ mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] }> = [
      { mode: 'individual', direction: 'given' },
      { mode: 'individual', direction: 'received' },
      { mode: 'individual', direction: 'mutual' },
      { mode: 'individual', direction: 'met' },
      { mode: 'pair', direction: 'given' },
      { mode: 'pair', direction: 'received' }
    ];
    const generated: RateMenuItem[] = [];
    otherUsers.forEach((user, userIndex) => {
      const laneIndex = userIndex % filterLanes.length;
      const lane = filterLanes[laneIndex];
      generated.push(this.buildGeneratedRateItemForLane(userId, user.id, lane.mode, lane.direction, laneIndex, userIndex));
    });
    this.generatedRateItemsByUser[userId] = generated;
    return generated;
  }

  private buildGeneratedRateItemForLane(
    activeUserId: string,
    targetUserId: string,
    mode: 'individual' | 'pair',
    direction: RateMenuItem['direction'],
    laneIndex: number,
    userIndex: number
  ): RateMenuItem {
    const seed = AppDemoGenerators.hashText(`rate-grid:${activeUserId}:${targetUserId}:${mode}:${direction}`);
    const happenedAt = AppUtils.toIsoDateTime(AppUtils.addDays(new Date('2026-03-01T20:00:00'), -((laneIndex * 17) + userIndex + 1)));
    let scoreGiven = 0;
    let scoreReceived = 0;
    if (direction === 'given') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = seed % 2 === 0 ? 4 + ((seed + 2) % 7) : 0;
    } else if (direction === 'received') {
      scoreGiven = 0;
      scoreReceived = 4 + ((seed + 3) % 7);
    } else if (direction === 'mutual') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = 4 + ((seed + 5) % 7);
    } else if (direction === 'met') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = 0;
    }
    return {
      id: `rate-${activeUserId}-${mode}-${direction}-${targetUserId}`,
      userId: targetUserId,
      mode,
      direction,
      scoreGiven,
      scoreReceived,
      eventName: `${mode === 'pair' ? 'Pair' : 'Single'} ${direction}`,
      happenedAt,
      distanceKm: 2 + ((seed + laneIndex + userIndex) % 33)
    };
  }

  private chatChannelType(item: ChatMenuItem): AppTypes.ChatChannelType {
    if (item.channelType === 'mainEvent' || item.channelType === 'optionalSubEvent' || item.channelType === 'groupSubEvent') {
      return item.channelType;
    }
    return 'general';
  }

  private chatItemsForActivities(): ChatMenuItem[] {
    const merged = new Map<string, ChatMenuItem>();
    for (const item of this.chatItems) {
      const normalized: ChatMenuItem = {
        ...item,
        channelType: this.chatChannelType(item)
      };
      normalized.unread = this.contextualChatUnreadCount(normalized);
      merged.set(item.id, normalized);
    }
    for (const contextual of this.buildContextualChatChannels()) {
      merged.set(contextual.id, contextual);
      if (!this.chatDatesById[contextual.id]) {
        this.chatDatesById[contextual.id] = contextual.lastMessage
          ? (contextual.subEventId
            ? this.chatSubEventDateIso(contextual.eventId ?? '', contextual.subEventId)
            : this.chatEventDateIso(contextual.eventId ?? ''))
          : this.defaultEventStartIso();
      }
      if (!this.chatDistanceById[contextual.id]) {
        this.chatDistanceById[contextual.id] = 2 + (AppDemoGenerators.hashText(`chat-distance:${contextual.id}`) % 18);
      }
    }
    return [...merged.values()];
  }

  private buildContextualChatChannels(): ChatMenuItem[] {
    const source = this.resolveChatFocusEventSource();
    if (!source) {
      return [];
    }
    const eventId = source.id;
    const eventTitle = source.title.trim() || 'Event';
    const subEvents = this.chatEventSubEvents(eventId);
    const channels: ChatMenuItem[] = [
      this.buildMainEventContextChat(eventId, eventTitle)
    ];
    if (subEvents.length === 0) {
      return channels;
    }

    for (const [index, subEvent] of subEvents.entries()) {
      const stageLabel = this.chatStageLabel(index);
      if (subEvent.optional) {
        if (!this.isActiveUserAttachedToOptionalSubEvent(eventId, subEvent.id)) {
          continue;
        }
        channels.push(this.buildOptionalSubEventContextChat(eventId, eventTitle, subEvent, stageLabel));
        continue;
      }
      const groups = this.subEventGroupsForStage(subEvent);
      if (groups.length === 0) {
        continue;
      }
      const activeGroup = this.activeUserTournamentGroup(eventId, subEvent, groups);
      if (!activeGroup) {
        continue;
      }
      channels.push(this.buildGroupSubEventContextChat(eventId, eventTitle, subEvent, activeGroup, stageLabel, groups));
    }
    return channels;
  }

  private buildMainEventContextChat(eventId: string, eventTitle: string): ChatMenuItem {
    const memberIds = this.mainEventContextMemberIds(eventId);
    return this.buildContextChatItem({
      id: `c-context-main-${eventId}`,
      title: `${eventTitle} · Main Event`,
      lastMessage: `Main event channel for ${eventTitle}.`,
      eventId,
      subEventId: '',
      groupId: '',
      channelType: 'mainEvent',
      memberIds
    });
  }

  private buildOptionalSubEventContextChat(
    eventId: string,
    eventTitle: string,
    subEvent: AppTypes.SubEventFormItem,
    stageLabel: string
  ): ChatMenuItem {
    const acceptedMemberIds = this.optionalSubEventAcceptedMemberIds(eventId, subEvent.id);
    const target = this.contextualSubEventMemberTargets(subEvent);
    const memberIds = this.contextualChatMemberIds(
      `chat-optional:${eventId}:${subEvent.id}`,
      acceptedMemberIds,
      target.accepted
    );
    return this.buildContextChatItem({
      id: `c-context-optional-${eventId}-${subEvent.id}`,
      title: `${subEvent.name || 'Optional Sub Event'} · Optional`,
      lastMessage: `${stageLabel} optional channel in ${eventTitle}.`,
      eventId,
      subEventId: subEvent.id,
      groupId: '',
      channelType: 'optionalSubEvent',
      memberIds
    });
  }

  private buildGroupSubEventContextChat(
    eventId: string,
    eventTitle: string,
    subEvent: AppTypes.SubEventFormItem,
    group: AppTypes.SubEventGroupItem,
    stageLabel: string,
    groups: AppTypes.SubEventGroupItem[]
  ): ChatMenuItem {
    const acceptedMemberIds = this.tournamentGroupAcceptedMemberIds(eventId, subEvent.id, group.id, groups);
    const target = this.contextualSubEventMemberTargets(subEvent, group, groups);
    const memberIds = this.contextualChatMemberIds(
      `chat-group:${eventId}:${subEvent.id}:${group.id}`,
      acceptedMemberIds,
      target.accepted
    );
    return this.buildContextChatItem({
      id: `c-context-group-${eventId}-${subEvent.id}-${group.id}`,
      title: `${group.name} · Group Channel`,
      lastMessage: `${stageLabel} group channel in ${eventTitle}.`,
      eventId,
      subEventId: subEvent.id,
      groupId: group.id,
      channelType: 'groupSubEvent',
      memberIds
    });
  }

  private buildContextChatItem(input: {
    id: string;
    title: string;
    lastMessage: string;
    eventId: string;
    subEventId: string;
    groupId: string;
    channelType: AppTypes.ChatChannelType;
    memberIds: string[];
  }): ChatMenuItem {
    const memberIds = this.uniqueUserIds([this.activeUser.id, ...input.memberIds]);
    const senderCandidates = memberIds.filter(id => id !== this.activeUser.id);
    const lastSenderId = senderCandidates[AppDemoGenerators.hashText(`chat-sender:${input.id}`) % Math.max(1, senderCandidates.length)]
      ?? memberIds[0]
      ?? this.activeUser.id;
    const item: ChatMenuItem = {
      id: input.id,
      avatar: AppUtils.initialsFromText(input.title),
      title: input.title,
      lastMessage: input.lastMessage,
      lastSenderId,
      memberIds,
      unread: 0,
      channelType: input.channelType,
      eventId: input.eventId,
      subEventId: input.subEventId || undefined,
      groupId: input.groupId || undefined
    };
    item.unread = this.contextualChatUnreadCount(item);
    return item;
  }

  private contextualChatUnreadCount(item: ChatMenuItem): number {
    const channelType = this.chatChannelType(item);
    if (channelType === 'optionalSubEvent' || channelType === 'groupSubEvent') {
      const subEvent = this.chatSubEventForItem(item);
      if (!subEvent) {
        return 0;
      }
      return this.contextualSubEventPendingTotal(subEvent, subEvent.optional || channelType === 'groupSubEvent');
    }
    if (channelType === 'mainEvent') {
      return this.mainEventContextPendingCount(item);
    }
    return Math.max(0, Math.trunc(Number(item.unread) || 0));
  }

  private contextualChatMemberIds(seedKey: string, acceptedMemberIds: string[], targetTotal: number): string[] {
    const accepted = this.uniqueUserIds(acceptedMemberIds);
    const desiredTotal = Math.max(accepted.length, targetTotal);
    if (desiredTotal <= accepted.length) {
      return accepted;
    }
    const seeded = AppDemoGenerators.seededEventMemberIds(
      seedKey,
      Math.max(desiredTotal, 4),
      this.users,
      this.activeUser.id
    );
    return this.uniqueUserIds([...accepted, ...seeded]).slice(0, desiredTotal);
  }

  private contextualSubEventMemberTargets(
    subEvent: AppTypes.SubEventFormItem,
    group: AppTypes.SubEventGroupItem | null = null,
    groups: AppTypes.SubEventGroupItem[] = []
  ): { accepted: number; pending: number; total: number } {
    const acceptedBase = this.chatCountValue(subEvent.membersAccepted);
    const pendingBase = this.chatCountValue(subEvent.membersPending);
    if (!group) {
      const total = Math.max(acceptedBase, acceptedBase + pendingBase);
      return { accepted: acceptedBase, pending: pendingBase, total };
    }
    const stageCapacityMax = Math.max(
      1,
      this.chatCountValue(subEvent.capacityMax),
      groups.reduce((sum, item) => sum + this.chatCountValue(item.capacityMax), 0),
      acceptedBase + pendingBase
    );
    const groupCapacityMax = Math.max(
      1,
      this.chatCountValue(group.capacityMax),
      Math.round(stageCapacityMax / Math.max(1, groups.length))
    );
    const ratio = groupCapacityMax / stageCapacityMax;
    const accepted = Math.min(groupCapacityMax, Math.max(0, Math.round(acceptedBase * ratio)));
    const groupPendingRaw = this.chatCountValue((group as { membersPending?: unknown }).membersPending);
    const pendingByShare = Math.max(0, Math.round(pendingBase * ratio));
    const pending = Math.min(Math.max(0, groupCapacityMax - accepted), Math.max(groupPendingRaw, pendingByShare));
    const total = Math.max(accepted, accepted + pending);
    return { accepted, pending, total };
  }

  private chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private contextualSubEventPendingTotal(subEvent: AppTypes.SubEventFormItem, includeMembers = true): number {
    this.syncSubEventAssetBadgeCounts(subEvent, 'Car');
    this.syncSubEventAssetBadgeCounts(subEvent, 'Accommodation');
    this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
    const members = includeMembers ? this.chatCountValue(subEvent.membersPending) : 0;
    return members
      + this.chatCountValue(subEvent.carsPending)
      + this.chatCountValue(subEvent.accommodationPending)
      + this.chatCountValue(subEvent.suppliesPending);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppTypes.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppTypes.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = this.assetCards.filter(card => card.type === type).map(card => card.id);
    const eligible = new Set(eligibleIds);
    const stored = this.subEventAssignedAssetIdsByKey[key];
    if (!stored) {
      this.subEventAssignedAssetIdsByKey[key] = [...eligibleIds];
      return [...eligibleIds];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length !== stored.length) {
      this.subEventAssignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private assetPendingCount(card: AppTypes.AssetCard): number {
    return card.requests.filter(request => request.status === 'pending').length;
  }

  private syncSubEventAssetBadgeCounts(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): void {
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEvent.id, type);
    const pending = assignedIds.reduce((sum, id) => {
      const card = this.assetCards.find(candidate => candidate.id === id && candidate.type === type);
      return sum + (card ? this.assetPendingCount(card) : 0);
    }, 0);
    if (type === 'Car') {
      subEvent.carsPending = pending;
      return;
    }
    if (type === 'Accommodation') {
      subEvent.accommodationPending = pending;
      return;
    }
    subEvent.suppliesPending = pending;
  }

  private mainEventContextMemberIds(eventId: string): string[] {
    const source = this.eventItems.find(item => item.id === eventId)
      ?? this.hostingItems.find(item => item.id === eventId)
      ?? null;
    if (!source) {
      return AppDemoGenerators.seededEventMemberIds(eventId, 8, this.users, this.activeUser.id);
    }
    const row = this.buildChatSourceActivityRow(source);
    const members = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted');
    const memberIds = this.uniqueUserIds(members.map(member => member.userId));
    if (memberIds.length > 0) {
      return memberIds;
    }
    return AppDemoGenerators.seededEventMemberIds(eventId, 8, this.users, this.activeUser.id);
  }

  private mainEventContextPendingCount(item: ChatMenuItem): number {
    const source = this.resolveChatEventSource(item);
    if (!source) {
      return 0;
    }
    const row = this.buildChatSourceActivityRow(source);
    const eventPending = this.activityPendingMemberCount(row);
    const eventId = this.normalizeLocationValue(item.eventId).trim() || source.id;
    const subEventsPending = this.chatEventSubEvents(eventId)
      .reduce((sum, subEvent) => sum + this.contextualSubEventPendingTotal(subEvent, true), 0);
    return eventPending + subEventsPending;
  }

  private resolveChatEventSource(item: ChatMenuItem): EventMenuItem | HostingMenuItem | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    if (!eventId) {
      return this.resolveChatFocusEventSource();
    }
    return this.eventItems.find(event => event.id === eventId)
      ?? this.hostingItems.find(event => event.id === eventId)
      ?? this.resolveEventEditorSource();
  }

  private buildChatSourceActivityRow(source: EventMenuItem | HostingMenuItem): AppTypes.ActivityListRow {
    const isHosting = this.isHostingSource(source);
    return {
      id: source.id,
      type: isHosting ? 'hosting' : 'events',
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: this.eventDatesById[source.id] ?? this.hostingDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? this.hostingDistanceById[source.id] ?? 0,
      unread: source.activity,
      metricScore: source.activity,
      isAdmin: isHosting ? true : (source as EventMenuItem).isAdmin === true,
      source
    };
  }

  private isHostingSource(source: EventMenuItem | HostingMenuItem): source is HostingMenuItem {
    return this.hostingItems.some(item => item.id === source.id);
  }

  private uniqueUserIds(ids: string[]): string[] {
    const unique: string[] = [];
    for (const id of ids) {
      if (!id || unique.includes(id)) {
        continue;
      }
      unique.push(id);
    }
    return unique;
  }

  private chatStageLabel(index: number): string {
    return `Stage ${index + 1}`;
  }

  private chatEventDateIso(eventId: string): string {
    return this.eventDatesById[eventId]
      ?? this.hostingDatesById[eventId]
      ?? this.defaultEventStartIso();
  }

  private chatSubEventDateIso(eventId: string, subEventId: string): string {
    const subEvent = this.chatEventSubEvents(eventId).find(item => item.id === subEventId) ?? null;
    return subEvent?.startAt || this.chatEventDateIso(eventId);
  }

  private resolveChatFocusEventSource(): EventMenuItem | HostingMenuItem | null {
    const editorSource = this.resolveEventEditorSource();
    if (editorSource) {
      return editorSource;
    }
    const managed = this.eventItems.find(item => item.isAdmin);
    if (managed) {
      return managed;
    }
    return this.eventItems[0] ?? this.hostingItems[0] ?? null;
  }

  private resolveEventEditorSource(): EventMenuItem | HostingMenuItem | null {
    if (!this.eventEditorService.isOpen()) {
      return null;
    }
    const source = this.eventEditorService.sourceEvent();
    if (!source || typeof source !== 'object') {
      return null;
    }
    const sourceId = typeof (source as { id?: unknown }).id === 'string'
      ? ((source as { id: string }).id.trim())
      : '';
    if (!sourceId) {
      return null;
    }
    const eventMatch = this.eventItems.find(item => item.id === sourceId);
    if (eventMatch) {
      return eventMatch;
    }
    const hostingMatch = this.hostingItems.find(item => item.id === sourceId);
    if (hostingMatch) {
      return hostingMatch;
    }
    const fallbackSource = source as Partial<EventMenuItem | HostingMenuItem>;
    return {
      id: sourceId,
      avatar: typeof fallbackSource.avatar === 'string' ? fallbackSource.avatar : AppUtils.initialsFromText(typeof fallbackSource.title === 'string' ? fallbackSource.title : 'Event'),
      title: typeof fallbackSource.title === 'string' ? fallbackSource.title : 'Event',
      shortDescription: typeof fallbackSource.shortDescription === 'string' ? fallbackSource.shortDescription : '',
      timeframe: typeof fallbackSource.timeframe === 'string' ? fallbackSource.timeframe : '',
      activity: Number.isFinite(Number(fallbackSource.activity)) ? Number(fallbackSource.activity) : 0,
      ...(typeof (fallbackSource as EventMenuItem).isAdmin === 'boolean'
        ? { isAdmin: (fallbackSource as EventMenuItem).isAdmin }
        : {})
    } as EventMenuItem | HostingMenuItem;
  }

  private chatEventSubEvents(eventId: string): AppTypes.SubEventFormItem[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.sortSubEventsByStartAsc(this.cloneSubEvents(this.eventSubEventsById[normalizedEventId] ?? []));
  }

  private chatSubEventForItem(item: ChatMenuItem): AppTypes.SubEventFormItem | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    const subEventId = this.normalizeLocationValue(item.subEventId).trim();
    if (!eventId || !subEventId) {
      return null;
    }
    return this.chatEventSubEvents(eventId).find(subEvent => subEvent.id === subEventId) ?? null;
  }

  private isActiveUserAttachedToOptionalSubEvent(eventId: string, subEventId: string): boolean {
    return this.optionalSubEventAcceptedMemberIds(eventId, subEventId).includes(this.activeUser.id);
  }

  private optionalSubEventAcceptedMemberIds(eventId: string, subEventId: string): string[] {
    const key = this.optionalSubEventMembershipKey(eventId, subEventId);
    const subEvent = this.chatEventSubEvents(eventId).find(item => item.id === subEventId) ?? null;
    const targetAccepted = subEvent
      ? this.contextualSubEventMemberTargets(subEvent).accepted
      : 0;
    const existing = this.acceptedOptionalSubEventMembersByKey[key];
    if (existing && existing.length === targetAccepted) {
      return existing;
    }
    const candidates = AppDemoGenerators.seededEventMemberIds(
      `optional-chat-member:${eventId}:${subEventId}`,
      Math.max(targetAccepted, 4),
      this.users,
      this.activeUser.id
    );
    let accepted = targetAccepted > 0
      ? candidates.slice(0, targetAccepted)
      : [];
    if (targetAccepted > 0 && !accepted.includes(this.activeUser.id)) {
      const withoutActive = accepted.filter(id => id !== this.activeUser.id);
      accepted = this.uniqueUserIds([this.activeUser.id, ...withoutActive]).slice(0, targetAccepted);
    }
    this.acceptedOptionalSubEventMembersByKey[key] = this.uniqueUserIds(accepted);
    return this.acceptedOptionalSubEventMembersByKey[key];
  }

  private tournamentGroupAcceptedMemberIds(
    eventId: string,
    subEventId: string,
    groupId: string,
    groups: AppTypes.SubEventGroupItem[]
  ): string[] {
    const key = this.tournamentGroupMembershipKey(eventId, subEventId, groupId);
    const subEvent = this.chatEventSubEvents(eventId).find(item => item.id === subEventId) ?? null;
    const group = groups.find(item => item.id === groupId) ?? null;
    const targetAccepted = subEvent && group
      ? this.contextualSubEventMemberTargets(subEvent, group, groups).accepted
      : 0;
    const existing = this.acceptedTournamentGroupMembersByKey[key];
    if (existing && existing.length === targetAccepted) {
      return existing;
    }
    const candidates = AppDemoGenerators.seededEventMemberIds(eventId, this.users.length, this.users, this.activeUser.id);
    const seeded = candidates.filter(userId => AppDemoGenerators.seededTournamentGroupIdForUser(eventId, subEventId, groups, userId) === groupId);
    let accepted = targetAccepted > 0
      ? seeded.slice(0, targetAccepted)
      : [];
    const activeGroupId = AppDemoGenerators.seededTournamentGroupIdForUser(eventId, subEventId, groups, this.activeUser.id);
    if (targetAccepted > 0 && activeGroupId === groupId && !accepted.includes(this.activeUser.id)) {
      const withoutActive = accepted.filter(id => id !== this.activeUser.id);
      accepted = this.uniqueUserIds([this.activeUser.id, ...withoutActive]).slice(0, targetAccepted);
    }
    this.acceptedTournamentGroupMembersByKey[key] = this.uniqueUserIds(accepted);
    return this.acceptedTournamentGroupMembersByKey[key];
  }

  private activeUserTournamentGroup(
    eventId: string,
    subEvent: AppTypes.SubEventFormItem,
    groups: AppTypes.SubEventGroupItem[]
  ): AppTypes.SubEventGroupItem | null {
    if (groups.length === 0) {
      return null;
    }
    const explicitGroupId = this.explicitTournamentGroupIdForUser(eventId, subEvent.id, groups, this.activeUser.id);
    const activeGroupId = explicitGroupId || AppDemoGenerators.seededTournamentGroupIdForUser(eventId, subEvent.id, groups, this.activeUser.id);
    if (!activeGroupId) {
      return null;
    }
    const memberIds = this.tournamentGroupAcceptedMemberIds(eventId, subEvent.id, activeGroupId, groups);
    if (!memberIds.includes(this.activeUser.id)) {
      return null;
    }
    return groups.find(group => group.id === activeGroupId) ?? null;
  }

  private explicitTournamentGroupIdForUser(
    eventId: string,
    subEventId: string,
    groups: AppTypes.SubEventGroupItem[],
    userId: string
  ): string | null {
    for (const group of groups) {
      const key = this.tournamentGroupMembershipKey(eventId, subEventId, group.id);
      const members = this.acceptedTournamentGroupMembersByKey[key];
      if (members?.includes(userId)) {
        return group.id;
      }
    }
    return null;
  }

  private optionalSubEventMembershipKey(eventId: string, subEventId: string): string {
    return `${eventId}:${subEventId}`;
  }

  private tournamentGroupMembershipKey(eventId: string, subEventId: string, groupId: string): string {
    return `${eventId}:${subEventId}:${groupId}`;
  }

  private cloneSubEvents(items: AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return items.map(item => ({
      ...item,
      location: this.normalizeLocationValue(item.location),
      groups: this.cloneSubEventGroups(item.groups)
    }));
  }

  private normalizeLocationValue(value: string | null | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  private sortSubEventsByStartAsc(items: AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    const source = this.cloneSubEvents(items);
    return source
      .map((item, index) => ({
        item,
        index,
        startMs: new Date(item.startAt).getTime()
      }))
      .sort((a, b) => {
        const aTime = Number.isNaN(a.startMs) ? Number.POSITIVE_INFINITY : a.startMs;
        const bTime = Number.isNaN(b.startMs) ? Number.POSITIVE_INFINITY : b.startMs;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }

  private cloneSubEventGroups(groups: AppTypes.SubEventGroupItem[] | undefined): AppTypes.SubEventGroupItem[] {
    if (!groups || groups.length === 0) {
      return [];
    }
    return groups.map(group => ({
      ...group,
      source: this.normalizedSubEventGroupSource(group)
    }));
  }

  private subEventGroupsForStage(item: AppTypes.SubEventFormItem): AppTypes.SubEventGroupItem[] {
    return this.reconcileTournamentGroupsForStage(item, this.cloneSubEventGroups(item.groups));
  }

  private normalizedSubEventGroupSource(group: Partial<AppTypes.SubEventGroupItem> | undefined): 'manual' | 'generated' {
    return group?.source === 'generated' ? 'generated' : 'manual';
  }

  private reconcileTournamentGroupsForStage(
    item: AppTypes.SubEventFormItem,
    sourceGroups: AppTypes.SubEventGroupItem[] = this.cloneSubEventGroups(item.groups)
  ): AppTypes.SubEventGroupItem[] {
    const normalizedGroups = sourceGroups.map(group => ({
      ...group,
      source: this.normalizedSubEventGroupSource(group)
    }));
    if (item.optional) {
      return normalizedGroups;
    }
    const manualGroups = normalizedGroups
      .filter(group => this.normalizedSubEventGroupSource(group) === 'manual')
      .map(group => ({
        ...group,
        source: 'manual' as const
      }));
    const generatedGroups = normalizedGroups
      .filter(group => this.normalizedSubEventGroupSource(group) === 'generated')
      .map(group => ({
        ...group,
        source: 'generated' as const
      }));
    return [...manualGroups, ...generatedGroups];
  }

  private defaultEventStartIso(): string {
    const iso = this.eventDatesById['e1'];
    return typeof iso === 'string' && iso.trim().length > 0 ? iso : '2026-03-01T09:00:00';
  }

  private getChatItemById(chatId: string): ChatMenuItem | undefined {
    const contextual = this.buildContextualChatChannels().find(item => item.id === chatId);
    if (contextual) {
      return contextual;
    }
    return this.chatItems.find(item => item.id === chatId);
  }

  private getChatMembersById(chatId: string): DemoUser[] {
    const chatItem = this.getChatItemById(chatId);
    const explicitMembers = (chatItem?.memberIds ?? [])
      .map(memberId => this.users.find(user => user.id === memberId))
      .filter((user): user is DemoUser => Boolean(user));
    const lastSender = chatItem?.lastSenderId ? this.users.find(user => user.id === chatItem.lastSenderId) ?? null : null;

    const orderedMembers: DemoUser[] = [];
    if (lastSender) {
      orderedMembers.push(lastSender);
    }
    for (const member of explicitMembers) {
      if (!orderedMembers.some(item => item.id === member.id)) {
        orderedMembers.push(member);
      }
    }
    if (!orderedMembers.some(item => item.id === this.activeUser.id)) {
      orderedMembers.push(this.activeUser);
    }
    if (orderedMembers.length > 0) {
      return orderedMembers;
    }

    const others = this.users.filter(user => user.id !== this.activeUser.id);
    if (!others.length) {
      return [this.activeUser];
    }
    const seed = AppDemoGenerators.hashText(chatId);
    const offsets = [0, 3, 7, 11, 15, 19];
    const memberCount = 3 + (seed % 3);
    const picked: DemoUser[] = [];
    for (const offset of offsets) {
      const user = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === user.id)) {
        picked.push(user);
      }
      if (picked.length === memberCount) {
        break;
      }
    }
    while (picked.length < memberCount) {
      picked.push(others[picked.length % others.length]);
    }
    return picked;
  }

  private getChatLastSender(item: ChatMenuItem): DemoUser {
    return this.userById(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
  }

  private getChatMemberCount(item: ChatMenuItem): number {
    return this.getChatMembersById(item.id).length;
  }

  private subEventDisplayName(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    return subEvent?.name?.trim() ?? '';
  }

  private chatContextDetailLine(item: ChatMenuItem): string {
    const channelType = this.chatChannelType(item);
    if (channelType !== 'optionalSubEvent' && channelType !== 'groupSubEvent') {
      return item.lastMessage.trim();
    }
    const subEvent = this.chatSubEventForItem(item);
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    if (!subEvent || !eventId) {
      return item.lastMessage.trim();
    }
    const ordered = this.chatEventSubEvents(eventId);
    const stageIndex = ordered.findIndex(entry => entry.id === subEvent.id);
    const stageLabel = this.chatStageLabel(Math.max(0, stageIndex));
    if (channelType === 'groupSubEvent') {
      const group = this.subEventGroupsForStage(subEvent).find(entry => entry.id === item.groupId);
      const groupLabel = group?.name?.trim() || 'Group';
      return `${stageLabel} - ${groupLabel}`;
    }
    const subEventLabel = this.subEventDisplayName(subEvent) || subEvent.name || 'Sub Event';
    return `${stageLabel} - ${subEventLabel}`;
  }

  private buildEventChatContext(chat: ChatMenuItem): EventChatContext {
    const channelType = this.chatChannelType(chat);
    const subEvent = this.chatSubEventForItem(chat);
    const group = this.eventChatGroup(chat, subEvent);
    const source = this.resolveChatEventSource(chat);
    const eventRow = source ? this.buildChatSourceActivityRow(source) : null;
    const hasSubEventMenu = channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
    return {
      channelType,
      hasSubEventMenu,
      actionIcon: this.eventChatActionIcon(channelType),
      actionLabel: this.eventChatActionLabel(channelType),
      actionToneClass: this.eventChatActionTone(channelType),
      actionBadgeCount: this.contextualChatUnreadCount(chat),
      menuTitle: this.eventChatMenuTitle(chat, subEvent, group),
      eventRow,
      subEventRow: eventRow,
      subEvent,
      group,
      assetAssignmentIds: subEvent ? this.eventChatResourceAssignmentIds(subEvent) : {},
      assetCardsByType: this.eventChatResourceCardsByType(),
      resources: this.eventChatResources(channelType, subEvent)
    };
  }

  private eventChatActionIcon(channelType: AppTypes.ChatChannelType): string {
    if (channelType === 'groupSubEvent') {
      return 'groups';
    }
    if (channelType === 'optionalSubEvent') {
      return 'event_available';
    }
    return 'event';
  }

  private eventChatActionLabel(channelType: AppTypes.ChatChannelType): string {
    if (channelType === 'groupSubEvent') {
      return 'View Group';
    }
    if (channelType === 'optionalSubEvent') {
      return 'View Sub Event';
    }
    return 'View Event';
  }

  private eventChatActionTone(channelType: AppTypes.ChatChannelType): EventChatContext['actionToneClass'] {
    if (channelType === 'optionalSubEvent') {
      return 'popup-chat-context-btn-tone-optional';
    }
    if (channelType === 'groupSubEvent') {
      return 'popup-chat-context-btn-tone-group';
    }
    return 'popup-chat-context-btn-tone-main-event';
  }

  private eventChatGroup(
    chat: ChatMenuItem,
    subEvent: AppTypes.SubEventFormItem | null
  ): EventChatContext['group'] {
    if (!subEvent || !chat.groupId) {
      return null;
    }
    const group = this.subEventGroupsForStage(subEvent).find(item => item.id === chat.groupId) ?? null;
    if (!group) {
      return null;
    }
    return {
      id: group.id,
      label: group.name
    };
  }

  private eventChatMenuTitle(
    chat: ChatMenuItem,
    subEvent: AppTypes.SubEventFormItem | null,
    group: EventChatContext['group']
  ): string {
    if (!subEvent) {
      return chat.title;
    }
    const subEventLabel = this.subEventDisplayName(subEvent) || subEvent.name || chat.title;
    if (group) {
      return `${subEventLabel} · ${group.label}`;
    }
    return subEventLabel;
  }

  private eventChatResources(
    channelType: AppTypes.ChatChannelType,
    subEvent: AppTypes.SubEventFormItem | null
  ): EventChatResourceContext[] {
    if (!subEvent) {
      return [];
    }
    const includeMembers = channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
    return [
      {
        type: 'Members',
        icon: 'groups',
        title: 'Members',
        typeClass: 'event-subevent-badge-members',
        summary: this.subEventCapacityLabelForChat(subEvent),
        pending: Math.max(0, Math.trunc(Number(subEvent.membersPending) || 0)),
        stateClass: this.subEventCapacityStateClassForChat(subEvent),
        visible: includeMembers
      },
      {
        type: 'Car',
        icon: 'directions_car',
        title: 'Car',
        typeClass: 'event-subevent-badge-car',
        summary: this.subEventAssetCapacityLabelForChat(subEvent, 'Car'),
        pending: this.subEventAssetPendingCountForChat(subEvent, 'Car'),
        stateClass: this.subEventAssetCapacityStateClassForChat(subEvent, 'Car'),
        visible: true
      },
      {
        type: 'Accommodation',
        icon: 'hotel',
        title: 'Accommodation',
        typeClass: 'event-subevent-badge-accommodation',
        summary: this.subEventAssetCapacityLabelForChat(subEvent, 'Accommodation'),
        pending: this.subEventAssetPendingCountForChat(subEvent, 'Accommodation'),
        stateClass: this.subEventAssetCapacityStateClassForChat(subEvent, 'Accommodation'),
        visible: true
      },
      {
        type: 'Supplies',
        icon: 'inventory_2',
        title: 'Supplies',
        typeClass: 'event-subevent-badge-supplies',
        summary: this.subEventAssetCapacityLabelForChat(subEvent, 'Supplies'),
        pending: this.subEventAssetPendingCountForChat(subEvent, 'Supplies'),
        stateClass: this.subEventAssetCapacityStateClassForChat(subEvent, 'Supplies'),
        visible: true
      }
    ];
  }

  private eventChatResourceAssignmentIds(subEvent: AppTypes.SubEventFormItem): Record<AppTypes.AssetType, string[]> {
    return {
      Car: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Car')],
      Accommodation: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Accommodation')],
      Supplies: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies')]
    };
  }

  private eventChatResourceCardsByType(): Record<AppTypes.AssetType, AppTypes.AssetCard[]> {
    return {
      Car: this.assetCards.filter(card => card.type === 'Car').map(card => ({ ...card, requests: [...card.requests] })),
      Accommodation: this.assetCards.filter(card => card.type === 'Accommodation').map(card => ({ ...card, requests: [...card.requests] })),
      Supplies: this.assetCards.filter(card => card.type === 'Supplies').map(card => ({ ...card, requests: [...card.requests] }))
    };
  }

  private subEventCapacityLabelForChat(item: AppTypes.SubEventFormItem): string {
    return `${item.membersAccepted} / ${item.capacityMin} - ${item.capacityMax}`;
  }

  private subEventCapacityStateClassForChat(item: AppTypes.SubEventFormItem): string {
    return item.membersAccepted >= item.capacityMin && item.membersAccepted <= item.capacityMax
      ? 'subevent-capacity-in-range'
      : 'subevent-capacity-out-of-range';
  }

  private subEventAssetCapacityLabelForChat(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): string {
    const metrics = this.subEventAssetCapacityMetricsForChat(item, type);
    return `${metrics.joined} / ${metrics.capacityMin} - ${metrics.capacityMax}`;
  }

  private subEventAssetCapacityStateClassForChat(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): string {
    const metrics = this.subEventAssetCapacityMetricsForChat(item, type);
    return metrics.joined >= metrics.capacityMin && metrics.joined <= metrics.capacityMax
      ? 'subevent-capacity-in-range'
      : 'subevent-capacity-out-of-range';
  }

  private subEventAssetPendingCountForChat(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): number {
    this.syncSubEventAssetBadgeCounts(item, type);
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(item.carsPending) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(item.accommodationPending) || 0));
    }
    return Math.max(0, Math.trunc(Number(item.suppliesPending) || 0));
  }

  private subEventAssetCapacityMetricsForChat(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number } {
    const pending = this.subEventAssetPendingCountForChat(subEvent, type);
    const accepted = this.subEventAssetAcceptedCountForChat(subEvent, type);
    const bounds = this.subEventAssetCapacityBoundsForChat(subEvent, type, accepted, pending);
    return {
      joined: accepted,
      capacityMin: bounds.capacityMin,
      capacityMax: bounds.capacityMax
    };
  }

  private subEventAssetAcceptedCountForChat(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): number {
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(subEvent.carsAccepted) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationAccepted) || 0));
    }
    if (type === 'Supplies') {
      return Math.max(0, Math.trunc(Number(subEvent.suppliesAccepted) || 0));
    }
    return 0;
  }

  private subEventAssetCapacityBoundsForChat(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    accepted: number,
    pending: number
  ): { capacityMin: number; capacityMax: number } {
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEvent.id, type);
    const assignedCards = assignedIds
      .map(id => this.assetCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
    if (assignedCards.length > 0) {
      const capacityMin = 0;
      const capacityMax = assignedCards.reduce((sum, card) => sum + Math.max(0, Math.trunc(Number(card.capacityTotal) || 0)), 0);
      if (type === 'Car') {
        subEvent.carsCapacityMin = capacityMin;
        subEvent.carsCapacityMax = capacityMax;
      } else if (type === 'Accommodation') {
        subEvent.accommodationCapacityMin = capacityMin;
        subEvent.accommodationCapacityMax = capacityMax;
      } else {
        subEvent.suppliesCapacityMin = capacityMin;
        subEvent.suppliesCapacityMax = capacityMax;
      }
      return { capacityMin, capacityMax };
    }

    const observed = Math.max(accepted, accepted + pending);
    if (type === 'Car') {
      const min = Math.max(0, Math.trunc(Number(subEvent.carsCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.carsCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    if (type === 'Accommodation') {
      const min = Math.max(0, Math.trunc(Number(subEvent.accommodationCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.accommodationCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    const min = Math.max(0, Math.trunc(Number(subEvent.suppliesCapacityMin) || 0));
    const max = Math.max(min, Math.trunc(Number(subEvent.suppliesCapacityMax) || observed));
    return { capacityMin: min, capacityMax: max };
  }

  private matchesActivitiesChatContextFilter(item: ChatMenuItem): boolean {
    if (this.activitiesPrimaryFilter !== 'chats' || this.activitiesChatContextFilter === 'all') {
      return true;
    }
    return this.activityChatContextFilterKey(item) === this.activitiesChatContextFilter;
  }

  private activityChatContextFilterKey(item: ChatMenuItem): AppTypes.ActivitiesChatContextFilter | null {
    const channelType = this.chatChannelType(item);
    if (channelType === 'mainEvent' || channelType === 'general') {
      return 'event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (channelType === 'groupSubEvent') {
      return 'group';
    }
    return null;
  }

  private matchesRateFilter(item: RateMenuItem, filter: AppTypes.RateFilterKey): boolean {
    const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
    return item.mode === modeKey && this.displayedRateDirection(item) === directionKey;
  }

  private displayedRateDirection(item: RateMenuItem): RateMenuItem['direction'] {
    return this.activityRateDirectionOverrideById[item.id] ?? item.direction;
  }

  private pendingDirectionAfterRating(item: RateMenuItem): RateMenuItem['direction'] | null {
    const direction = this.displayedRateDirection(item);
    if (item.mode === 'individual') {
      if (direction === 'given') {
        return item.scoreReceived > 0 ? 'mutual' : 'given';
      }
      if (direction === 'received') {
        return 'mutual';
      }
      return null;
    }
    if (direction === 'received' || direction === 'met') {
      return 'given';
    }
    return null;
  }

  private commitPendingRateDirectionOverrides(targetFilter?: AppTypes.RateFilterKey): void {
    const target = targetFilter ? this.parseRateFilterKey(targetFilter) : null;
    for (const [itemId, pendingDirection] of Object.entries(this.pendingActivityRateDirectionOverrideById)) {
      if (!pendingDirection) {
        continue;
      }
      if (target) {
        const item = this.rateItems.find(candidate => candidate.id === itemId);
        if (!item) {
          continue;
        }
        if (item.mode !== target.mode || pendingDirection !== target.direction) {
          continue;
        }
      }
      this.activityRateDirectionOverrideById[itemId] = pendingDirection;
      delete this.pendingActivityRateDirectionOverrideById[itemId];
    }
  }

  private parseRateFilterKey(filter: AppTypes.RateFilterKey): { mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] } {
    const [mode, direction] = filter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
    return { mode, direction };
  }

  private selectedActivityRateRow(): AppTypes.ActivityListRow | null {
    if (!this.selectedActivityRateId) {
      return null;
    }
    return this.filteredActivityRows.find(row => row.type === 'rates' && row.id === this.selectedActivityRateId) ?? null;
  }

  private normalizeRateScore(value: number): number {
    return Math.min(10, Math.max(1, Math.round(value)));
  }

  private activityRateUser(row: AppTypes.ActivityListRow): DemoUser | null {
    if (row.type !== 'rates') {
      return null;
    }
    const item = row.source as RateMenuItem;
    return this.users.find(user => user.id === item.userId) ?? null;
  }

  // ── Row converters ─────────────────────────────────────────────────────────

  private chatToActivityRow(item: ChatMenuItem): AppTypes.ActivityListRow {
    const sender = this.getChatLastSender(item);
    const unread = this.contextualChatUnreadCount(item);
    return {
      id: item.id,
      type: 'chats',
      title: sender.name,
      subtitle: item.title,
      detail: this.chatContextDetailLine(item),
      dateIso: this.chatDatesById[item.id] ?? '2026-02-21T09:00:00',
      distanceKm: this.chatDistanceById[item.id] ?? 5,
      unread,
      metricScore: unread * 10 + this.getChatMemberCount(item),
      source: item
    };
  }

  private eventToActivityRow(item: EventMenuItem, _secondary: AppTypes.ActivitiesSecondaryFilter): AppTypes.ActivityListRow {
    return {
      id: item.id,
      type: 'events',
      title: item.title,
      subtitle: item.shortDescription,
      detail: item.timeframe,
      dateIso: this.eventDatesById[item.id] ?? '2026-03-01T09:00:00',
      distanceKm: this.eventDistanceById[item.id] ?? 10,
      unread: item.activity,
      metricScore: (item.isAdmin ? 20 : 0) + item.activity,
      isAdmin: item.isAdmin,
      source: item
    };
  }

  private hostingEventToActivityRow(item: EventMenuItem): AppTypes.ActivityListRow {
    return {
      id: item.id,
      type: 'hosting',
      title: item.title,
      subtitle: item.shortDescription,
      detail: item.timeframe,
      dateIso: this.eventDatesById[item.id] ?? '2026-03-01T09:00:00',
      distanceKm: this.eventDistanceById[item.id] ?? 10,
      unread: item.activity,
      metricScore: 20 + item.activity,
      isAdmin: true,
      source: item
    };
  }

  private invitationToActivityRow(item: InvitationMenuItem): AppTypes.ActivityListRow {
    return {
      id: item.id,
      type: 'invitations',
      title: item.description,
      subtitle: item.inviter,
      detail: item.when,
      dateIso: this.invitationDatesById[item.id] ?? '2026-02-21T09:00:00',
      distanceKm: this.invitationDistanceById[item.id] ?? 5,
      unread: item.unread,
      metricScore: item.unread * 10,
      source: item
    };
  }

  private rateToActivityRow(item: RateMenuItem): AppTypes.ActivityListRow {
    const user = this.users.find(candidate => candidate.id === item.userId) ?? this.activeUser;
    const direction = this.displayedRateDirection(item);
    const ownScore = this.rateOwnScore(item);
    return {
      id: item.id,
      type: 'rates',
      title: user.name,
      subtitle: '',
      detail: '',
      dateIso: item.happenedAt ?? '',
      distanceKm: item.distanceKm ?? 0,
      unread: 0,
      metricScore: direction === 'mutual' ? ownScore + Math.max(item.scoreReceived, 0) : ownScore,
      source: item
    };
  }

  private rateOwnScore(item: RateMenuItem): number {
    if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
      return this.normalizeRateScore(item.scoreGiven);
    }
    return 5;
  }

  private hasOwnRating(item: RateMenuItem): boolean {
    const drafted = this.activityRateDraftById[item.id];
    if (Number.isFinite(drafted) && drafted > 0) {
      return true;
    }
    if (this.displayedRateDirection(item) === 'received') {
      return false;
    }
    return Number.isFinite(item.scoreGiven) && item.scoreGiven > 0;
  }

  private pairReceivedAverageScore(item: RateMenuItem): number {
    const matching = this.rateItems.filter(candidate =>
      candidate.mode === 'pair' &&
      candidate.userId === item.userId &&
      this.displayedRateDirection(candidate) === 'received' &&
      Number.isFinite(candidate.scoreReceived) &&
      candidate.scoreReceived > 0
    );
    if (matching.length === 0) {
      return 0;
    }
    const total = matching.reduce((sum, candidate) => sum + candidate.scoreReceived, 0);
    return this.normalizeRateScore(total / matching.length);
  }

  private openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void {
    if (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations') {
      return;
    }
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: row.type === 'invitations' ? true : readOnly
    });
  }

  private resolveRelatedEventFromInvitation(invitation: InvitationMenuItem): EventMenuItem | HostingMenuItem | null {
    const invitationTitle = AppUtils.normalizeText(invitation.description);
    const relatedEvent = this.eventItems.find(item => AppUtils.normalizeText(item.title) === invitationTitle);
    if (relatedEvent) {
      return relatedEvent;
    }
    const relatedHosting = this.hostingItems.find(item => AppUtils.normalizeText(item.title) === invitationTitle);
    if (relatedHosting) {
      return relatedHosting;
    }
    return null;
  }

  private buildInvitationPreviewEventSource(invitation: InvitationMenuItem): EventMenuItem {
    return {
      id: `inv-preview-${invitation.id}`,
      avatar: AppUtils.initialsFromText(invitation.inviter),
      title: invitation.description,
      shortDescription: `Invited by ${invitation.inviter}`,
      timeframe: invitation.when,
      activity: Math.max(0, invitation.unread),
      isAdmin: false
    };
  }

  private applyActivitiesEventSync(sync: ActivitiesEventSyncPayload): void {
    let eventUpdated = false;
    let hostingUpdated = false;

    this.eventItems = this.eventItems.map(item => {
      if (item.id !== sync.id) {
        return item;
      }
      eventUpdated = true;
      return {
        ...item,
        title: sync.title,
        shortDescription: sync.shortDescription,
        timeframe: sync.timeframe,
        activity: sync.activity,
        isAdmin: sync.isAdmin || item.isAdmin
      };
    });

    this.hostingItems = this.hostingItems.map(item => {
      if (item.id !== sync.id) {
        return item;
      }
      hostingUpdated = true;
      return {
        ...item,
        title: sync.title,
        shortDescription: sync.shortDescription,
        timeframe: sync.timeframe,
        activity: sync.activity
      };
    });

    if (!eventUpdated) {
      const nextEvent: EventMenuItem = {
        id: sync.id,
        avatar: AppUtils.initialsFromText(sync.title),
        title: sync.title,
        shortDescription: sync.shortDescription,
        timeframe: sync.timeframe,
        activity: sync.activity,
        isAdmin: sync.isAdmin || sync.target === 'hosting'
      };
      this.eventItems = [nextEvent, ...this.eventItems];
    }

    if (sync.target === 'hosting' && !hostingUpdated) {
      const nextHosting: HostingMenuItem = {
        id: sync.id,
        avatar: AppUtils.initialsFromText(sync.title),
        title: sync.title,
        shortDescription: sync.shortDescription,
        timeframe: sync.timeframe,
        activity: sync.activity
      };
      this.hostingItems = [nextHosting, ...this.hostingItems];
    }

    this.eventDatesById[sync.id] = sync.startAt;
    this.hostingDatesById[sync.id] = sync.startAt;
    this.eventDistanceById[sync.id] = sync.distanceKm;
    this.hostingDistanceById[sync.id] = sync.distanceKm;
    if (sync.imageUrl.trim().length > 0) {
      this.activityImageById[sync.id] = sync.imageUrl;
    }

    this.applyActivitiesEventMemberSnapshot(sync);
    this.refreshSectionBadges();
    if (this.activitiesPrimaryFilter !== 'rates') {
      this.activitiesSmartList?.reload();
    }
  }

  private applyActivitiesEventMemberSnapshot(sync: ActivitiesEventSyncPayload): void {
    const acceptedRaw = Number(sync.acceptedMembers);
    const pendingRaw = Number(sync.pendingMembers);
    const hasAccepted = Number.isFinite(acceptedRaw);
    const hasPending = Number.isFinite(pendingRaw);
    if (!hasAccepted && !hasPending) {
      return;
    }
    const acceptedMembers = hasAccepted ? Math.max(0, Math.trunc(acceptedRaw)) : 0;
    const pendingMembers = hasPending ? Math.max(0, Math.trunc(pendingRaw)) : 0;
    const capacityRaw = Number(sync.capacityTotal);
    const capacityTotal = Number.isFinite(capacityRaw)
      ? Math.max(acceptedMembers, Math.trunc(capacityRaw))
      : Math.max(acceptedMembers, this.activityCapacityTotal({
        id: sync.id,
        type: 'events',
        title: sync.title,
        subtitle: sync.shortDescription,
        detail: sync.timeframe,
        dateIso: sync.startAt,
        distanceKm: sync.distanceKm,
        unread: sync.activity,
        metricScore: sync.activity,
        isAdmin: sync.isAdmin,
        source: {
          id: sync.id,
          avatar: AppUtils.initialsFromText(sync.title),
          title: sync.title,
          shortDescription: sync.shortDescription,
          timeframe: sync.timeframe,
          activity: sync.activity,
          isAdmin: sync.isAdmin
        } as EventMenuItem
      }, acceptedMembers));
    this.activityCapacityById[sync.id] = `${acceptedMembers} / ${capacityTotal}`;

    const eventSource = this.eventItems.find(item => item.id === sync.id) ?? {
      id: sync.id,
      avatar: AppUtils.initialsFromText(sync.title),
      title: sync.title,
      shortDescription: sync.shortDescription,
      timeframe: sync.timeframe,
      activity: sync.activity,
      isAdmin: sync.isAdmin
    };
    const hostingSource = this.hostingItems.find(item => item.id === sync.id) ?? {
      id: sync.id,
      avatar: AppUtils.initialsFromText(sync.title),
      title: sync.title,
      shortDescription: sync.shortDescription,
      timeframe: sync.timeframe,
      activity: sync.activity
    };

    const eventRow: AppTypes.ActivityListRow = {
      id: sync.id,
      type: 'events',
      title: sync.title,
      subtitle: sync.shortDescription,
      detail: sync.timeframe,
      dateIso: sync.startAt,
      distanceKm: sync.distanceKm,
      unread: sync.activity,
      metricScore: sync.activity,
      isAdmin: sync.isAdmin,
      source: eventSource
    };
    const hostingRow: AppTypes.ActivityListRow = {
      id: sync.id,
      type: 'hosting',
      title: sync.title,
      subtitle: sync.shortDescription,
      detail: sync.timeframe,
      dateIso: sync.startAt,
      distanceKm: sync.distanceKm,
      unread: sync.activity,
      metricScore: sync.activity,
      isAdmin: true,
      source: hostingSource
    };

    const eventRowKey = `${eventRow.type}:${eventRow.id}`;
    const hostingRowKey = `${hostingRow.type}:${hostingRow.id}`;
    this.activityMembersByRowId[eventRowKey] = this.buildSyncedActivityMembersForRow(eventRow, acceptedMembers, pendingMembers);
    this.activityMembersByRowId[hostingRowKey] = this.buildSyncedActivityMembersForRow(hostingRow, acceptedMembers, pendingMembers);
    this.forcedAcceptedMembersByRowKey[eventRowKey] = acceptedMembers;
    this.forcedAcceptedMembersByRowKey[hostingRowKey] = acceptedMembers;
  }

  private buildSyncedActivityMembersForRow(
    row: AppTypes.ActivityListRow,
    acceptedMembers: number,
    pendingMembers: number
  ): AppTypes.ActivityMemberEntry[] {
    if (acceptedMembers <= 0 && pendingMembers <= 0) {
      return [];
    }
    const rowKey = `${row.type}:${row.id}`;
    const seed = AppDemoGenerators.hashText(`${rowKey}:${acceptedMembers}:${pendingMembers}`);
    const candidates = [this.activeUser, ...this.users.filter(user => user.id !== this.activeUser.id)];
    const used = new Set<string>();
    const pickUser = (offset: number): DemoUser => {
      if (candidates.length === 0) {
        return this.activeUser;
      }
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[(seed + offset + index) % candidates.length];
        if (!used.has(candidate.id) || used.size >= candidates.length) {
          used.add(candidate.id);
          return candidate;
        }
      }
      return this.activeUser;
    };

    const entries: AppTypes.ActivityMemberEntry[] = [];
    for (let index = 0; index < acceptedMembers; index += 1) {
      const user = pickUser(index);
      entries.push(AppDemoGenerators.toActivityMemberEntry(
        user,
        row,
        rowKey,
        this.activeUser.id,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        APP_DEMO_DATA.activityMemberMetPlaces
      ));
    }
    for (let index = 0; index < pendingMembers; index += 1) {
      const user = pickUser(acceptedMembers + index);
      const isJoinRequest = ((seed + index) % 3) === 0;
      const pendingSource: AppTypes.ActivityPendingSource = isJoinRequest
        ? 'member'
        : (row.isAdmin ? 'admin' : 'member');
      const entry = AppDemoGenerators.toActivityMemberEntry(
        user,
        row,
        rowKey,
        this.activeUser.id,
        { status: 'pending', pendingSource, invitedByActiveUser: !isJoinRequest },
        APP_DEMO_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...entry,
        requestKind: isJoinRequest ? 'join' : 'invite',
        statusText: isJoinRequest ? 'Waiting for admin approval.' : 'Invitation pending.'
      });
    }
    return this.sortActivityMembersByActionTimeDesc(entries);
  }

  // ── User lookup ────────────────────────────────────────────────────────────

  private userById(userId: string): DemoUser | undefined {
    return this.users.find(u => u.id === userId);
  }

  // ── Calendar navigation shortcuts (template aliases) ──────────────────────

  protected calendarPrev(event?: Event): void {
    this.navigateActivitiesCalendarBackward(event);
  }

  protected calendarToday(event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesView === 'month') {
      this.calendarMonthFocusDate = AppUtils.dateOnly(new Date());
    } else {
      this.calendarWeekFocusDate = AppUtils.dateOnly(new Date());
    }
    this.calendarMonthAnchorPages = null;
    this.calendarWeekAnchorPages  = null;
    this.calendarMonthAnchorsHydrated = false;
    this.calendarWeekAnchorsHydrated  = false;
    this.resetActivitiesScroll(true);
    this.cdr.markForCheck();
  }

  protected calendarNext(event?: Event): void {
    this.navigateActivitiesCalendarForward(event);
  }

  // ── Header progress loading ────────────────────────────────────────────────

  private beginActivitiesHeaderProgressLoading(): void {
    this.activitiesHeaderLoadingCounter += 1;
    if (this.activitiesHeaderLoadingCounter > 1) {
      return;
    }
    this.activitiesHeaderProgressLoading = true;
    this.activitiesHeaderLoadingOverdue = false;
    this.activitiesHeaderLoadingProgress = 0.02;
    this.activitiesHeaderLoadingStartedAtMs = performance.now();
    this.flushActivitiesHeaderProgress();
    if (this.activitiesHeaderLoadingCompleteTimer) {
      clearTimeout(this.activitiesHeaderLoadingCompleteTimer);
      this.activitiesHeaderLoadingCompleteTimer = null;
    }
    if (this.activitiesHeaderLoadingInterval) {
      clearInterval(this.activitiesHeaderLoadingInterval);
      this.activitiesHeaderLoadingInterval = null;
    }
    this.updateActivitiesHeaderLoadingWindow();
    this.activitiesHeaderLoadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.updateActivitiesHeaderLoadingWindow();
        this.flushActivitiesHeaderProgress();
      }, this.activitiesHeaderLoadingTickMs)
    );
  }

  private endActivitiesHeaderProgressLoading(): void {
    if (this.activitiesHeaderLoadingCounter === 0) {
      return;
    }
    this.activitiesHeaderLoadingCounter = Math.max(0, this.activitiesHeaderLoadingCounter - 1);
    if (this.activitiesHeaderLoadingCounter !== 0) {
      return;
    }
    this.completeActivitiesHeaderLoading();
  }

  private completeActivitiesHeaderLoading(): void {
    if (this.activitiesHeaderLoadingInterval) {
      clearInterval(this.activitiesHeaderLoadingInterval);
      this.activitiesHeaderLoadingInterval = null;
    }
    // Success path: snap the loading bar to full width immediately.
    this.activitiesHeaderLoadingProgress = 1;
    this.activitiesHeaderLoadingOverdue = false;
    this.flushActivitiesHeaderProgress();
    if (this.activitiesHeaderLoadingCompleteTimer) {
      clearTimeout(this.activitiesHeaderLoadingCompleteTimer);
    }
    this.activitiesHeaderLoadingCompleteTimer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.activitiesHeaderLoadingCounter !== 0) {
            return;
          }
          this.activitiesHeaderProgressLoading = false;
          this.activitiesHeaderLoadingProgress = 0;
          this.activitiesHeaderLoadingOverdue = false;
          this.activitiesHeaderLoadingStartedAtMs = 0;
          this.activitiesHeaderLoadingCompleteTimer = null;
          this.updateActivitiesHeaderProgress();
          this.refreshActivitiesHeaderProgressSoon();
          this.flushActivitiesHeaderProgress();
        });
      }, 100)
    );
  }

  private updateActivitiesHeaderProgress(): void {
    if (this.isRatesFullscreenModeActive()) {
      this.activitiesListScrollable = false;
      const loadedCount = this.activitiesRatesFullscreenAllRows().length;
      if (loadedCount <= 0) {
        this.activitiesHeaderProgress = 0;
        return;
      }
      this.activitiesHeaderProgress = AppUtils.clampNumber((this.activitiesRatesFullscreenCardIndex + 1) / loadedCount, 0, 1);
      return;
    }

    if (this.activitiesPrimaryFilter !== 'rates' && this.activitiesSmartList) {
      const smartListElement = this.activitiesListScrollElement();
      if (!smartListElement) {
        this.activitiesListScrollable = false;
        this.activitiesHeaderProgress = 0;
        return;
      }
      if (this.isCalendarLayoutView()) {
        const maxHorizontalScroll = Math.max(0, smartListElement.scrollWidth - smartListElement.clientWidth);
        this.activitiesListScrollable = maxHorizontalScroll > 1;
        if (maxHorizontalScroll <= 1) {
          this.activitiesHeaderProgress = 0;
          return;
        }
        this.activitiesHeaderProgress = AppUtils.clampNumber(smartListElement.scrollLeft / maxHorizontalScroll, 0, 1);
        return;
      }
      const maxVerticalScroll = Math.max(0, smartListElement.scrollHeight - smartListElement.clientHeight);
      this.activitiesListScrollable = maxVerticalScroll > 1;
      if (maxVerticalScroll <= 1) {
        this.activitiesHeaderProgress = 0;
        return;
      }
      this.activitiesHeaderProgress = AppUtils.clampNumber(smartListElement.scrollTop / maxVerticalScroll, 0, 1);
      return;
    }

    if (this.isCalendarLayoutView()) {
      this.activitiesListScrollable = true;
      const calendarElement = this.activitiesCalendarScrollRef?.nativeElement;
      if (!calendarElement) {
        this.activitiesHeaderProgress = 0;
        return;
      }
      const maxHorizontalScroll = Math.max(0, calendarElement.scrollWidth - calendarElement.clientWidth);
      if (maxHorizontalScroll <= 1) {
        this.activitiesHeaderProgress = 0;
        return;
      }
      this.activitiesHeaderProgress = AppUtils.clampNumber(calendarElement.scrollLeft / maxHorizontalScroll, 0, 1);
      return;
    }

    const listElement = this.activitiesListScrollElement();
    if (!listElement) {
      this.activitiesListScrollable = false;
      this.activitiesHeaderProgress = 0;
      return;
    }
    const maxVerticalScroll = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
    this.activitiesListScrollable = maxVerticalScroll > 1;
    if (maxVerticalScroll <= 1) {
      this.activitiesHeaderProgress = 0;
      return;
    }
    this.activitiesHeaderProgress = AppUtils.clampNumber(listElement.scrollTop / maxVerticalScroll, 0, 1);
  }

  private updateActivitiesHeaderLoadingWindow(): void {
    if (!this.activitiesHeaderProgressLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.activitiesHeaderLoadingStartedAtMs);
    const nextProgress = AppUtils.clampNumber(elapsed / this.activitiesHeaderLoadingWindowMs, 0, 1);
    this.activitiesHeaderLoadingProgress = Math.max(this.activitiesHeaderLoadingProgress, nextProgress);
    this.activitiesHeaderLoadingOverdue = elapsed >= this.activitiesHeaderLoadingWindowMs && this.activitiesHeaderLoadingCounter > 0;
  }

  private clearActivitiesHeaderLoadingAnimation(): void {
    if (this.activitiesHeaderLoadingInterval) {
      clearInterval(this.activitiesHeaderLoadingInterval);
      this.activitiesHeaderLoadingInterval = null;
    }
    if (this.activitiesHeaderLoadingCompleteTimer) {
      clearTimeout(this.activitiesHeaderLoadingCompleteTimer);
      this.activitiesHeaderLoadingCompleteTimer = null;
    }
    this.activitiesHeaderLoadingCounter = 0;
    this.activitiesHeaderLoadingProgress = 0;
    this.activitiesHeaderProgressLoading = false;
    this.activitiesHeaderLoadingOverdue = false;
    this.activitiesHeaderLoadingStartedAtMs = 0;
    this.flushActivitiesHeaderProgress();
  }

  private refreshActivitiesStickyHeaderSoon(): void {
    if (this.activitiesPrimaryFilter !== 'rates' && this.activitiesSmartList) {
      return;
    }
    const refresh = () => {
      this.updateActivitiesStickyHeader(this.activitiesListScrollElement()?.scrollTop ?? 0);
      this.cdr.markForCheck();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(refresh));
      return;
    }
    setTimeout(refresh, 0);
  }

  private refreshActivitiesHeaderProgressSoon(): void {
    const refresh = () => {
      this.updateActivitiesHeaderProgress();
      this.flushActivitiesHeaderProgress();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(refresh));
      return;
    }
    setTimeout(refresh, 0);
  }

  private flushActivitiesHeaderProgress(): void {
    if (this.activitiesHeaderFlushScheduled) {
      return;
    }
    this.activitiesHeaderFlushScheduled = true;
    this.ngZone.runOutsideAngular(() => {
      const flush = () => {
        this.ngZone.run(() => {
          this.activitiesHeaderFlushScheduled = false;
          this.cdr.markForCheck();
        });
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => flush());
        return;
      }
      setTimeout(flush, 0);
    });
  }

  private syncActivitiesSmartListInputs(): void {
    const nextFilters: Record<string, unknown> = {
      primaryFilter: this.activitiesPrimaryFilter,
      secondaryFilter: this.activitiesSecondaryFilter,
      chatContextFilter: this.activitiesChatContextFilter,
      hostingPublicationFilter: this.hostingPublicationFilter,
      rateFilter: this.activitiesRateFilter
    };
    const currentFilters = this.activitiesSmartListFilters;
    if (
      currentFilters['primaryFilter'] === nextFilters['primaryFilter']
      && currentFilters['secondaryFilter'] === nextFilters['secondaryFilter']
      && currentFilters['chatContextFilter'] === nextFilters['chatContextFilter']
      && currentFilters['hostingPublicationFilter'] === nextFilters['hostingPublicationFilter']
      && currentFilters['rateFilter'] === nextFilters['rateFilter']
    ) {
      return;
    }
    this.activitiesSmartListFilters = nextFilters;
  }

  private async resolveActivitiesSmartListPage(query: ListQuery): Promise<PageResult<AppTypes.ActivityListRow>> {
    const request = this.buildActivitiesSmartListRequest(query);

    if (this.shouldUseServerSidePagination()) {
      const result = await this.activitiesContext.loadActivitiesPage(request);
      return {
        items: result?.rows ?? [],
        total: Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : 0
      };
    }

    const rows = this.buildActivitiesSmartListRows(
      request.primaryFilter,
      request.secondaryFilter,
      request.chatContextFilter,
      request.hostingPublicationFilter,
      request.rateFilter,
      request.view
    );
    const startIndex = request.page * request.pageSize;
    return {
      items: rows.slice(startIndex, startIndex + request.pageSize),
      total: rows.length
    };
  }

  private async resolveActivitiesSmartListCalendarPage(query: ListQuery): Promise<PageResult<AppTypes.ActivityListRow>> {
    const request = this.buildActivitiesSmartListRequest(query);

    if (this.shouldUseServerSidePagination()) {
      const result = await this.activitiesContext.loadActivitiesPage(request);
      return {
        items: result?.rows ?? [],
        total: Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : 0
      };
    }

    const rows = this.buildActivitiesSmartListRows(
      request.primaryFilter,
      request.secondaryFilter,
      request.chatContextFilter,
      request.hostingPublicationFilter,
      request.rateFilter,
      request.view
    );
    const range = this.activitiesSmartListQueryRange(query);
    const filteredRows = range
      ? rows.filter(row => this.doesActivityRowOverlapRange(row, range.start, range.end))
      : rows;

    return {
      items: filteredRows,
      total: filteredRows.length
    };
  }

  protected onActivitiesSmartListItemSelect(event: SmartListItemSelectEvent<AppTypes.ActivityListRow>): void {
    this.onActivityRowClick(event.item);
  }

  protected onActivitiesSmartListStateChange(change: SmartListStateChange<AppTypes.ActivityListRow>): void {
    this.activitiesVisibleCount = change.items.length;
    this.activitiesInitialLoadPending = change.initialLoading;
    if (this.shouldUseServerSidePagination()) {
      this.serverPageRows = [...change.items];
      this.serverPageTotalRows = change.total;
      this.serverPageIndex = Math.ceil(change.items.length / Math.max(1, change.query.pageSize));
    }
    if (this.isRatesFullscreenModeActive()) {
      this.cdr.markForCheck();
      return;
    }
    this.activitiesListScrollable = change.scrollable;
    this.activitiesHeaderProgress = change.progress;
    this.activitiesHeaderProgressLoading = change.loading;
    this.activitiesHeaderLoadingProgress = change.loadingProgress;
    this.activitiesHeaderLoadingOverdue = change.loadingOverdue;
    this.activitiesStickyValue = change.stickyLabel;
    this.activitiesContext.setActivitiesStickyValue(change.stickyLabel);
    this.flushActivitiesHeaderProgress();
    this.cdr.markForCheck();
  }

  private buildActivitiesSmartListRequest(query: ListQuery): ActivitiesPageRequest {
    const filters = query.filters as ActivitiesSmartListFilters | undefined;
    return {
      primaryFilter: this.normalizeActivitiesPrimaryFilter(filters?.primaryFilter),
      secondaryFilter: this.normalizeActivitiesSecondaryFilter(filters?.secondaryFilter),
      chatContextFilter: this.normalizeActivitiesChatContextFilter(filters?.chatContextFilter),
      hostingPublicationFilter: this.normalizeHostingPublicationFilter(filters?.hostingPublicationFilter),
      rateFilter: this.normalizeRateFilter(filters?.rateFilter),
      view: this.normalizeActivitiesView(query.view),
      page: Math.max(0, Math.trunc(query.page)),
      pageSize: Math.max(1, Math.trunc(query.pageSize)),
      anchorDate: query.anchorDate,
      rangeStart: query.rangeStart,
      rangeEnd: query.rangeEnd
    };
  }

  private activitiesSmartListQueryRange(query: ListQuery): { start: Date; end: Date } | null {
    const start = this.parseSmartListDate(query.rangeStart);
    const end = this.parseSmartListDate(query.rangeEnd);
    if (!start || !end) {
      return null;
    }
    return {
      start,
      end: AppUtils.dateOnly(end)
    };
  }

  private parseSmartListDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10) - 1;
      const day = Number.parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return AppUtils.dateOnly(parsed);
  }

  private doesActivityRowOverlapRange(row: AppTypes.ActivityListRow, start: Date, end: Date): boolean {
    const range = AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
    if (!range) {
      return false;
    }
    return AppCalendarHelpers.dateRangeOverlaps(
      AppUtils.dateOnly(range.start),
      AppUtils.dateOnly(range.end),
      start,
      end
    );
  }

  private buildActivitiesSmartListRows(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter,
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
    chatContextFilter: AppTypes.ActivitiesChatContextFilter,
    hostingPublicationFilter: AppTypes.HostingPublicationFilter,
    rateFilter: AppTypes.RateFilterKey,
    view: AppTypes.ActivitiesView
  ): AppTypes.ActivityListRow[] {
    let rows: AppTypes.ActivityListRow[] = [];
    if (primaryFilter === 'chats') {
      rows = this.chatItemsForActivities()
        .filter(item => chatContextFilter === 'all' ? true : this.activityChatContextFilterKey(item) === chatContextFilter)
        .map(item => this.chatToActivityRow(item));
    } else if (primaryFilter === 'invitations') {
      rows = this.invitationItems.map(item => this.invitationToActivityRow(item));
    } else if (primaryFilter === 'events') {
      rows = this.eventItems.map(item => this.eventToActivityRow(item, secondaryFilter));
    } else if (primaryFilter === 'hosting') {
      rows = this.eventItems
        .filter(item => item.isAdmin)
        .filter(item => hostingPublicationFilter === 'drafts' ? !this.isHostingPublished(item.id) : true)
        .map(item => this.hostingEventToActivityRow(item));
    } else {
      rows = this.rateItems
        .filter(item => item.userId !== this.activeUser.id && this.matchesRateFilter(item, rateFilter))
        .map(item => this.rateToActivityRow(item));
    }
    const sorted = this.sortActivitiesRowsForState(rows, primaryFilter, secondaryFilter);
    if (view === 'distance') {
      return [...sorted].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
    return sorted;
  }

  private sortActivitiesRowsForState(
    rows: AppTypes.ActivityListRow[],
    primaryFilter: AppTypes.ActivitiesPrimaryFilter,
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter
  ): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (secondaryFilter === 'recent') {
      if (primaryFilter === 'events' || primaryFilter === 'hosting') {
        return sorted.sort((a, b) => AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
      }
      return sorted.sort((a, b) => AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (secondaryFilter === 'past') {
      return sorted.sort((a, b) => AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (primaryFilter === 'rates') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
    }
    if (primaryFilter === 'events' || primaryFilter === 'hosting') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
    }
    return sorted.sort((a, b) => b.metricScore - a.metricScore || AppUtils.toSortableDate(b.dateIso) - AppUtils.toSortableDate(a.dateIso));
  }

  private normalizeActivitiesPrimaryFilter(value: unknown): AppTypes.ActivitiesPrimaryFilter {
    return value === 'events' || value === 'hosting' || value === 'invitations' || value === 'rates'
      ? value
      : 'chats';
  }

  private normalizeActivitiesSecondaryFilter(value: unknown): AppTypes.ActivitiesSecondaryFilter {
    return value === 'relevant' || value === 'past' ? value : 'recent';
  }

  private normalizeActivitiesChatContextFilter(value: unknown): AppTypes.ActivitiesChatContextFilter {
    return value === 'event' || value === 'subEvent' || value === 'group' ? value : 'all';
  }

  private normalizeHostingPublicationFilter(value: unknown): AppTypes.HostingPublicationFilter {
    return value === 'drafts' ? 'drafts' : 'all';
  }

  private normalizeRateFilter(value: unknown): AppTypes.RateFilterKey {
    return value === 'individual-received'
      || value === 'individual-mutual'
      || value === 'individual-met'
      || value === 'pair-given'
      || value === 'pair-received'
      ? value
      : 'individual-given';
  }

  private normalizeActivitiesView(value: unknown): AppTypes.ActivitiesView {
    return value === 'week' || value === 'month' || value === 'distance' ? value : 'day';
  }

  private activitiesListScrollElement(): HTMLDivElement | null {
    return this.activitiesSmartList?.scrollElement() ?? this.activitiesScrollRef?.nativeElement ?? null;
  }
}
