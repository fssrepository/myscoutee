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

import { LazyBgImageDirective } from '../shared/lazy-bg-image.directive';
import { APP_STATIC_DATA } from '../shared/app-static-data';
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
} from '../shared/demo-data';
import { AppCalendarHelpers } from '../shared/app-calendar-helpers';
import { AppDemoGenerators } from '../shared/app-demo-generators';
import { AppUtils } from '../shared/app-utils';
import { EventEditorService } from '../shared/event-editor.service';
import type * as AppTypes from '../shared/app-types';

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-event-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    LazyBgImageDirective
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
  protected readonly eventEditorService = inject(EventEditorService);

  // ── Self-contained data state (no host inputs) ───────────────────────────
  protected isMobileView = false;
  protected readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected activeUser: DemoUser = this.users[0] ?? DEMO_USERS[0];

  protected chatItems: ChatMenuItem[] = [...(DEMO_CHAT_BY_USER[this.activeUser.id] ?? [])];
  protected eventItems: EventMenuItem[] = [...(DEMO_EVENTS_BY_USER[this.activeUser.id] ?? [])];
  protected hostingItems: HostingMenuItem[] = [...(DEMO_HOSTING_BY_USER[this.activeUser.id] ?? [])];
  protected invitationItems: InvitationMenuItem[] = [...(DEMO_INVITATIONS_BY_USER[this.activeUser.id] ?? [])];
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

  // ── Inline action menu ────────────────────────────────────────────────────
  protected inlineItemActionMenu: {
    scope: 'activity';
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
      const svc = this.eventEditorService;
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
      this.cdr.markForCheck();
    });

    // React to open events: reset scroll state whenever the popup is opened.
    effect(() => {
      if (this.eventEditorService.activitiesOpen()) {
        this.onActivitiesOpened();
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (!this.eventEditorService.activitiesOpen()) {
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
    this.eventEditorService.closeActivities();
  }

  // =========================================================================
  // Derived lists (computed on demand – no signals here for compat)
  // =========================================================================

  protected get filteredActivityRows(): AppTypes.ActivityListRow[] {
    const rows = this.buildFilteredActivityRowsBase();
    return rows.slice(0, this.activitiesVisibleCount);
  }

  private buildFilteredActivityRowsBase(): AppTypes.ActivityListRow[] {
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
    this.eventEditorService.setActivitiesPrimaryFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') { return; }
    this.eventEditorService.setActivitiesChatContextFilter(filter);
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (this.activitiesPrimaryFilter !== 'hosting' || this.hostingPublicationFilter === filter) { return; }
    this.eventEditorService.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.eventEditorService.setActivitiesSecondaryFilter(filter);
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
    this.eventEditorService.setActivitiesRateFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.selectedActivityRateId = null;
    this.eventEditorService.setActivitiesSelectedRateId(null);
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
    this.eventEditorService.toggleActivitiesViewPicker();
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.eventEditorService.toggleActivitiesSecondaryPicker();
  }

  protected setActivitiesView(view: AppTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    if (view !== 'distance') {
      this.disableActivitiesRatesFullscreenMode();
    }
    this.eventEditorService.setActivitiesView(view as 'day' | 'week' | 'month' | 'distance');
    this.lastRateIndicatorPulseRowId = null;
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
    this.eventEditorService.open('create');
  }

  protected requestOpenEventEditorForRow(
    row: AppTypes.ActivityListRow,
    readOnly = false,
    stacked = true
  ): void {
    this.eventEditorService.open(
      'edit',
      row.source as EventMenuItem | HostingMenuItem,
      readOnly
    );
  }

  protected requestOpenEventExplore(): void {
    this.closeActivitiesPopup();
    this.eventEditorService.requestActivitiesNavigation({ type: 'eventExplore' });
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
    const listElement = this.activitiesScrollRef?.nativeElement;
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
      this.inlineItemActionMenu = { scope: 'activity', id: row.id, title: row.title, openUp: false };
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
    this.eventEditorService.open(
      'edit',
      row.source as EventMenuItem | HostingMenuItem,
      true
    );
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
      this.eventEditorService.requestActivitiesNavigation({ type: 'chat', item: row.source as ChatMenuItem });
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
    this.eventEditorService.requestActivitiesNavigation({ type: 'members', row });
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
    const scrollElement = this.activitiesScrollRef?.nativeElement;
    if (!wasOpen) {
      this.activityRateEditorOpenScrollTop = scrollElement ? scrollElement.scrollTop : null;
    }
    this.selectedActivityRateId = row.id;
    this.eventEditorService.setActivitiesSelectedRateId(row.id);
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
    this.eventEditorService.setActivitiesSelectedRateId(row.id);
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
    const scrollElement = this.activitiesScrollRef?.nativeElement;
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
      this.eventEditorService.setActivitiesSelectedRateId(null);
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
    const scrollElement = this.activitiesScrollRef?.nativeElement;
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
      this.selectedActivityRateId = null;
      this.eventEditorService.setActivitiesSelectedRateId(null);
      this.activitiesRatesFullscreenCardIndex = 0;
      return null;
    }
    if (this.activitiesRatesFullscreenCardIndex < 0) {
      this.activitiesRatesFullscreenCardIndex = 0;
    }
    const maxAllowedIndex = allRows.length;
    if (this.activitiesRatesFullscreenCardIndex > maxAllowedIndex) {
      this.activitiesRatesFullscreenCardIndex = maxAllowedIndex;
    }
    const visibleCount = this.activitiesRatesFullscreenRows().length;
    if (this.activitiesRatesFullscreenCardIndex >= visibleCount || this.activitiesRatesFullscreenCardIndex >= allRows.length) {
      this.selectedActivityRateId = null;
      this.eventEditorService.setActivitiesSelectedRateId(null);
      return null;
    }
    const row = allRows[this.activitiesRatesFullscreenCardIndex] ?? null;
    if (!row) {
      this.selectedActivityRateId = null;
      this.eventEditorService.setActivitiesSelectedRateId(null);
      return null;
    }
    if (!this.activitiesRatesFullscreenAnimating && this.selectedActivityRateId !== row.id) {
      this.selectedActivityRateId = row.id;
      this.eventEditorService.setActivitiesSelectedRateId(row.id);
    }
    return row;
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
    this.eventEditorService.setActivitiesRatesFullscreenMode(true);
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
    this.eventEditorService.setActivitiesRatesFullscreenMode(false);
    this.eventEditorService.setActivitiesSelectedRateId(null);
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
      this.eventEditorService.setActivitiesSelectedRateId(null);
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
    const visibleCount = this.activitiesRatesFullscreenRows().length;
    if (this.activitiesRatesFullscreenCardIndex >= visibleCount || this.activitiesRatesFullscreenCardIndex >= allRows.length) {
      this.selectedActivityRateId = null;
      this.eventEditorService.setActivitiesSelectedRateId(null);
      this.updateActivitiesHeaderProgress();
      return;
    }
    this.selectedActivityRateId = allRows[this.activitiesRatesFullscreenCardIndex]?.id ?? null;
    this.eventEditorService.setActivitiesSelectedRateId(this.selectedActivityRateId);
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
    this.seedActivitiesStickyHeader();
    this.cancelActivitiesPaginationLoad();
    this.clearActivitiesHeaderLoadingAnimation();
    if (this.isCalendarLayoutView()) {
      this.activitiesInitialLoadPending = false;
      this.clearActivitiesCalendarBadgeDelay();
    } else {
      this.activitiesPaginationKey = this.activitiesPaginationStateKey();
      this.activitiesVisibleCount = 0;
      this.activitiesPaginationAwaitScrollReset = false;
      this.activitiesInitialLoadPending = true;
      this.startActivitiesPaginationLoad(true);
    }
    setTimeout(() => {
      const scrollElement = this.activitiesScrollRef?.nativeElement;
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
    this.eventEditorService.setActivitiesStickyValue(value);
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
    const scrollElement = this.activitiesScrollRef?.nativeElement;
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
    this.ensureActivitiesPaginationState(rows.length);
    if (this.activitiesVisibleCount >= rows.length) {
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
      merged.set(item.id, {
        ...item,
        channelType: this.chatChannelType(item)
      });
    }
    for (const contextual of this.buildContextualChatChannels()) {
      merged.set(contextual.id, contextual);
      if (!this.chatDatesById[contextual.id]) {
        this.chatDatesById[contextual.id] = contextual.lastMessage
          ? (this.eventDatesById[contextual.eventId ?? ''] ?? this.defaultEventStartIso())
          : this.defaultEventStartIso();
      }
      if (!this.chatDistanceById[contextual.id]) {
        this.chatDistanceById[contextual.id] = 2 + (AppDemoGenerators.hashText(`chat-distance:${contextual.id}`) % 18);
      }
    }
    return [...merged.values()];
  }

  private buildContextualChatChannels(): ChatMenuItem[] {
    const sourceEvents = this.eventItems
      .filter(item => item.isAdmin)
      .slice(0, 6);
    const channels: ChatMenuItem[] = [];
    for (const event of sourceEvents) {
      const eventLabel = event.title.trim() || 'Event';
      channels.push(
        this.buildContextChatItem(
          `ctx-main-${event.id}`,
          eventLabel,
          'mainEvent',
          event.id,
          null,
          null,
          `Main room live for ${eventLabel}.`,
          1
        ),
        this.buildContextChatItem(
          `ctx-opt-${event.id}`,
          `${eventLabel} · Optional`,
          'optionalSubEvent',
          event.id,
          `${event.id}-optional`,
          null,
          'Optional side stage confirmed for tonight.',
          0
        ),
        this.buildContextChatItem(
          `ctx-group-${event.id}`,
          `${eventLabel} · Group`,
          'groupSubEvent',
          event.id,
          `${event.id}-group`,
          `${event.id}-g1`,
          'Group assignments are synced for the next round.',
          1
        )
      );
    }
    return channels;
  }

  private buildContextChatItem(
    id: string,
    title: string,
    channelType: ChatMenuItem['channelType'],
    eventId: string,
    subEventId: string | null,
    groupId: string | null,
    lastMessage: string,
    unread: number
  ): ChatMenuItem {
    const memberIds = AppDemoGenerators.seededEventMemberIds(eventId, 8, this.users, this.activeUser.id);
    const senderId = memberIds[1] ?? memberIds[0] ?? this.activeUser.id;
    const sender = this.userById(senderId) ?? this.activeUser;
    return {
      id,
      avatar: sender.initials,
      title,
      lastMessage,
      lastSenderId: senderId,
      memberIds,
      unread,
      channelType: channelType ?? 'general',
      eventId,
      subEventId: subEventId ?? undefined,
      groupId: groupId ?? undefined
    };
  }

  private defaultEventStartIso(): string {
    const iso = this.eventDatesById['e1'];
    return typeof iso === 'string' && iso.trim().length > 0 ? iso : '2026-03-01T09:00:00';
  }

  private getChatLastSender(item: ChatMenuItem): DemoUser {
    return this.userById(item.lastSenderId) ?? this.userById(item.memberIds[0] ?? '') ?? this.activeUser;
  }

  private getChatMemberCount(item: ChatMenuItem): number {
    return item.memberIds.length > 0 ? item.memberIds.length : 1;
  }

  private chatContextDetailLine(item: ChatMenuItem): string {
    const channelType = this.chatChannelType(item);
    if (channelType === 'mainEvent') {
      return `Main event · ${item.lastMessage}`;
    }
    if (channelType === 'optionalSubEvent') {
      return `Sub event · ${item.lastMessage}`;
    }
    if (channelType === 'groupSubEvent') {
      return `Group room · ${item.lastMessage}`;
    }
    return item.lastMessage;
  }

  private matchesActivitiesChatContextFilter(item: ChatMenuItem): boolean {
    if (this.activitiesPrimaryFilter !== 'chats' || this.activitiesChatContextFilter === 'all') {
      return true;
    }
    return this.activityChatContextFilterKey(item) === this.activitiesChatContextFilter;
  }

  private activityChatContextFilterKey(item: ChatMenuItem): AppTypes.ActivitiesChatContextFilter | null {
    const channelType = this.chatChannelType(item);
    if (channelType === 'mainEvent') {
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
    return {
      id: item.id,
      type: 'chats',
      title: sender.name,
      subtitle: item.title,
      detail: this.chatContextDetailLine(item),
      dateIso: this.chatDatesById[item.id] ?? '2026-02-21T09:00:00',
      distanceKm: this.chatDistanceById[item.id] ?? 5,
      unread: item.unread,
      metricScore: item.unread * 10 + this.getChatMemberCount(item),
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
    if (row.type === 'events' || row.type === 'hosting') {
      this.eventEditorService.open(
        'edit',
        row.source as EventMenuItem | HostingMenuItem,
        readOnly
      );
      return;
    }

    if (row.type === 'invitations') {
      const invitation = row.source as InvitationMenuItem;
      const source = this.resolveRelatedEventFromInvitation(invitation) ?? this.buildInvitationPreviewEventSource(invitation);
      this.eventEditorService.open('edit', source, true);
    }
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
      const loadedCount = this.activitiesRatesFullscreenRows().length;
      if (loadedCount <= 0) {
        this.activitiesHeaderProgress = 0;
        return;
      }
      this.activitiesHeaderProgress = AppUtils.clampNumber((this.activitiesRatesFullscreenCardIndex + 1) / loadedCount, 0, 1);
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

    const listElement = this.activitiesScrollRef?.nativeElement;
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
    const refresh = () => {
      this.updateActivitiesStickyHeader(this.activitiesScrollRef?.nativeElement?.scrollTop ?? 0);
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
}
