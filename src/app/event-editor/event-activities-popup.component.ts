import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
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
export class EventActivitiesPopupComponent implements OnInit, OnDestroy {

  // ── injected ──────────────────────────────────────────────────────────────
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly eventEditorService = inject(EventEditorService);

  // ── Data @Inputs (provided by the host App component via DI or bindings) ──
  // NOTE: because this component is mounted via ngComponentOutlet with no
  // bindings, these must be satisfied by a shared data service in your app.
  // Keep them as @Inputs for testability and for cases where the component is
  // used directly in a template.
  @Input() isMobileView = false;
  @Input() activeUser!: DemoUser;

  @Input() chatItems: ChatMenuItem[]            = [];
  @Input() eventItems: EventMenuItem[]          = [];
  @Input() hostingItems: HostingMenuItem[]      = [];
  @Input() invitationItems: InvitationMenuItem[] = [];
  @Input() rateItems: RateMenuItem[]             = [];

  @Input() chatBadge        = 0;
  @Input() eventsBadge      = 0;
  @Input() hostingBadge     = 0;
  @Input() invitationsBadge = 0;
  @Input() gameBadge        = 0;

  @Input() publishedHostingIds: ReadonlySet<string> = new Set();

  @Input() activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange> = {};

  @Input() chatDatesById: Record<string, string>        = {};
  @Input() eventDatesById: Record<string, string>       = {};
  @Input() hostingDatesById: Record<string, string>     = {};
  @Input() invitationDatesById: Record<string, string>  = {};

  @Input() chatDistanceById: Record<string, number>       = {};
  @Input() eventDistanceById: Record<string, number>      = {};
  @Input() hostingDistanceById: Record<string, number>    = {};
  @Input() invitationDistanceById: Record<string, number> = {};

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

  // ── Fullscreen rates ──────────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;
  protected activitiesRatesFullscreenCardIndex    = 0;
  protected activitiesRatesFullscreenAnimating    = false;
  protected activitiesRatesFullscreenLeavingRow: AppTypes.ActivityListRow | null = null;
  protected isActivitiesRatesPairSplitDragging    = false;
  protected activitiesRatesPairSplitPercent       = 50;
  protected isActivitiesRatesPairWomanCollapsed   = false;
  protected isActivitiesRatesPairManCollapsed     = false;
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

  ngOnInit(): void {
    // Sync service signal state → local properties so OnPush CD fires.
    // Using effect() inside a constructor/ngOnInit keeps it tied to this
    // component's injector and is cleaned up automatically on destroy.
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
    }, { allowSignalWrites: false });

    // React to open events: reset scroll state whenever the popup is opened.
    effect(() => {
      if (this.eventEditorService.activitiesOpen()) {
        this.onActivitiesOpened();
      }
    }, { allowSignalWrites: false });
  }

  /** Called once each time the service opens the popup. */
  private onActivitiesOpened(): void {
    this.clearActivityRateEditorState();
    this.resetActivitiesScroll();
  }

  ngOnDestroy(): void {
    this.cancelActivitiesRatesFullscreenAdvance();
    this.clearActivityRateEditorState();
    this.clearActivityRateBarBlinkTimer();
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
      rows = this.chatItems
        .filter(item => this.matchesActivitiesChatContextFilter(item))
        .map(item => this.chatToActivityRow(item));
    } else if (this.activitiesPrimaryFilter === 'invitations') {
      rows = this.invitationItems.map(item => this.invitationToActivityRow(item));
    } else if (this.activitiesPrimaryFilter === 'events') {
      rows = this.eventItems.map(item => this.eventToActivityRow(item, this.activitiesSecondaryFilter));
    } else if (this.activitiesPrimaryFilter === 'hosting') {
      rows = this.hostingItems
        .filter(item => this.hostingPublicationFilter === 'drafts' ? !this.isHostingPublished(item.id) : true)
        .map(item => this.hostingToActivityRow(item));
    } else {
      rows = this.rateItems
        .filter(item => this.matchesRateFilter(item, this.activitiesRateFilter))
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

  protected activitiesChatContextFilterCount(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') { return 0; }
    return this.chatItems.filter(item => {
      if (filter === 'all') { return true; }
      return this.activityChatContextFilterKey(item) === filter;
    }).length;
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
    return label === 'Pair';
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
    return this.hostingItems.filter(item => !this.isHostingPublished(item.id)).length;
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
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') { return; }
    this.eventEditorService.setActivitiesChatContextFilter(filter);
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
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this.stopActivitiesRatesPairSplitDrag();
    this.commitPendingRateDirectionOverrides(filter);
    this.eventEditorService.setActivitiesRateFilter(filter);
    if (this.activitiesRatesFullscreenMode) {
      this.activitiesRatesFullscreenLeavingRow = null;
      this.activitiesRatesFullscreenCardIndex  = 0;
      this.syncActivitiesRatesFullscreenSelection();
    }
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.eventEditorService.toggleActivitiesViewPicker();
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
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
    this.resetActivitiesScroll(view === 'month' || view === 'week');
    this.cdr.markForCheck();
  }

  // ── Mobile bottom-sheet openers (delegates back to parent if needed) ───────

  protected openMobileActivitiesPrimaryFilterSelector(event: Event): void {
    event.stopPropagation();
    // In a full implementation this would open a bottom-sheet.
    // For now we toggle a simplified picker state.
    this.showActivitiesViewPicker = !this.showActivitiesViewPicker;
  }

  protected openMobileActivitiesChatContextFilterSelector(event: Event): void {
    event.stopPropagation();
    this.showActivitiesSecondaryPicker = !this.showActivitiesSecondaryPicker;
  }

  protected openMobileActivitiesRateFilterSelector(event: Event): void {
    event.stopPropagation();
    this.showActivitiesSecondaryPicker = !this.showActivitiesSecondaryPicker;
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
    // The explore popup is a separate concern; delegate via service if it
    // exposes that method, otherwise dispatch a custom event as fallback.
    // Extend EventEditorService with openExplore() when needed.
    globalThis.dispatchEvent(new CustomEvent('app:open-event-explore'));
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
    return groupIndex > 0;
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
    return this.activeUser?.initials ?? 'U';
  }

  protected activityRowAvatarClass(row: AppTypes.ActivityListRow): string {
    if (row.type === 'rates') {
      const rate   = row.source as RateMenuItem;
      const gender = this.userById(rate.userId)?.gender ?? 'woman';
      return `user-color-${gender}`;
    }
    if (row.type === 'chats') {
      const chat = row.source as ChatMenuItem;
      return `user-color-${(chat as { lastSenderGender?: string }).lastSenderGender ?? 'woman'}`;
    }
    return 'user-color-man';
  }

  protected activityRowBadge(row: AppTypes.ActivityListRow): number {
    if (row.type === 'chats') {
      return row.unread ?? 0;
    }
    return 0;
  }

  // ── Event-style rows ───────────────────────────────────────────────────────

  protected activityImageUrl(row: AppTypes.ActivityListRow): string {
    return (row.source as { imageUrl?: string })?.imageUrl ?? '';
  }

  protected showActivitySourceIcon(row: AppTypes.ActivityListRow): boolean {
    return !!(row.source as { sourceLink?: string })?.sourceLink;
  }

  protected activitySourceLink(row: AppTypes.ActivityListRow): string {
    return (row.source as { sourceLink?: string })?.sourceLink ?? '#';
  }

  protected activitySourceAvatarClass(row: AppTypes.ActivityListRow): string {
    return 'activities-source-avatar-default';
  }

  protected activitySourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    return (row.source as { sourceName?: string })?.sourceName?.slice(0, 2) ?? '';
  }

  protected activityCapacityLabel(row: AppTypes.ActivityListRow): string {
    return (row.source as { capacityLabel?: string })?.capacityLabel ?? '';
  }

  protected activityPendingMemberCount(row: AppTypes.ActivityListRow): number {
    return (row.source as { pendingMemberCount?: number })?.pendingMemberCount ?? 0;
  }

  protected isActivityFull(row: AppTypes.ActivityListRow): boolean {
    return !!(row.source as { isFull?: boolean })?.isFull;
  }

  protected activityLeadingIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting')     { return 'star'; }
    if (row.type === 'invitations') { return 'mail'; }
    return 'event';
  }

  protected activityLeadingIconCircleClass(row: AppTypes.ActivityListRow): string {
    return `activity-icon-${row.type}`;
  }

  protected activityDateRangeMetaLine(row: AppTypes.ActivityListRow): string {
    return (row.source as { timeframe?: string })?.timeframe ?? '';
  }

  protected activityLocationMetaLine(row: AppTypes.ActivityListRow): string {
    return (row.source as { city?: string })?.city ?? '';
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
    if (row.type === 'hosting' || row.type === 'events') {
      this.eventEditorService.open(
        'edit',
        row.source as EventMenuItem | HostingMenuItem,
        false
      );
    }
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
    // Invitation approval – delegate to parent via openActivityRow
    this.openActivityRow.emit(row);
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
      this.openChatItem.emit(row.source as ChatMenuItem);
      return;
    }
    if (row.type === 'rates') {
      this.openActivityRateEditor(row, event as Event);
      return;
    }
    this.openActivityRow.emit(row);
  }

  protected openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.openActivityMembersEvent.emit({ row, event });
  }

  // =========================================================================
  // Rate editor dock
  // =========================================================================

  protected openActivityRateEditor(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesSelectedRateId(row.id);
    this.triggerActivityRateBarBlink(row.id);
    this.cdr.markForCheck();
  }

  protected closeActivityRateEditorFromUserScroll(): void {
    if (!this.isActivityRateEditorOpen()) { return; }
    this.clearActivityRateEditorState(true);
  }

  protected isActivityRateEditorDockVisible(): boolean {
    return this.selectedActivityRateId !== null || this.activityRateEditorClosing;
  }

  protected isActivityRateEditorOpen(): boolean {
    return this.selectedActivityRateId !== null;
  }

  protected isActivityRateEditorClosing(): boolean {
    return this.activityRateEditorClosing;
  }

  protected isSelectedActivityRateRow(row: AppTypes.ActivityListRow): boolean {
    return this.selectedActivityRateId === row.id;
  }

  protected selectedActivityRateModeLabel(): string {
    if (!this.selectedActivityRateId) { return ''; }
    const row = this.filteredActivityRows.find(r => r.id === this.selectedActivityRateId);
    if (!row) { return ''; }
    return this.isPairRateRow(row) ? 'Pair' : 'Single';
  }

  protected selectedActivityRateTitle(): string {
    if (!this.selectedActivityRateId) { return ''; }
    return this.filteredActivityRows.find(r => r.id === this.selectedActivityRateId)?.title ?? '';
  }

  protected isSelectedActivityRateReadOnly(): boolean {
    if (!this.selectedActivityRateId) { return true; }
    const row = this.filteredActivityRows.find(r => r.id === this.selectedActivityRateId);
    return row ? this.isPairReceivedRateRow(row) : true;
  }

  protected isSelectedActivityRateScore(score: number): boolean {
    if (!this.selectedActivityRateId) { return false; }
    const draft = this.activityRateDraftById[this.selectedActivityRateId];
    if (draft !== undefined) { return score <= draft; }
    const row  = this.filteredActivityRows.find(r => r.id === this.selectedActivityRateId);
    const rate = row?.source as RateMenuItem | undefined;
    return rate ? score <= (rate.scoreGiven ?? 0) : false;
  }

  protected setSelectedActivityOwnRating(score: number): void {
    if (!this.selectedActivityRateId || this.isSelectedActivityRateReadOnly()) { return; }
    this.activityRateDraftById[this.selectedActivityRateId] = score;
    this.triggerActivityRateBarBlink(this.selectedActivityRateId);
    this.cdr.markForCheck();
  }

  private clearActivityRateEditorState(withTransition = false): void {
    if (!withTransition) {
      this.eventEditorService.setActivitiesSelectedRateId(null);
      this.activityRateEditorClosing = false;
      if (this.activityRateEditorCloseTimer) {
        clearTimeout(this.activityRateEditorCloseTimer);
        this.activityRateEditorCloseTimer = null;
      }
      return;
    }
    this.eventEditorService.setActivitiesSelectedRateId(null);
    this.activityRateEditorClosing = true;
    if (this.activityRateEditorCloseTimer) {
      clearTimeout(this.activityRateEditorCloseTimer);
    }
    this.activityRateEditorCloseTimer = setTimeout(() => {
      this.activityRateEditorClosing    = false;
      this.activityRateEditorCloseTimer = null;
      this.cdr.markForCheck();
    }, this.activityRateEditorSlideDurationMs);
  }

  private cancelActivityRateEditorCloseTransition(): void {
    this.activityRateEditorClosing = false;
    if (this.activityRateEditorCloseTimer) {
      clearTimeout(this.activityRateEditorCloseTimer);
      this.activityRateEditorCloseTimer = null;
    }
  }

  // =========================================================================
  // Rate card – image stack helpers
  // =========================================================================

  protected activityRateCardImageUrls(_row: AppTypes.ActivityListRow): string[] {
    return [];
  }

  protected activityRateCardActiveImageIndex(row: AppTypes.ActivityListRow): number {
    return this.activityRateCardActiveImageIndexById[row.id] ?? 0;
  }

  protected activityRateCardActiveImageUrl(row: AppTypes.ActivityListRow): string {
    const urls  = this.activityRateCardImageUrls(row);
    const index = this.activityRateCardActiveImageIndex(row);
    return urls[index] ?? '';
  }

  protected activityRateCardHasLine(_row: AppTypes.ActivityListRow, _index: number): boolean {
    return false;
  }

  protected activityRateCardPrimaryLine(_row: AppTypes.ActivityListRow, _index: number): string {
    return '';
  }

  protected activityRateCardSecondaryLine(_row: AppTypes.ActivityListRow, _index: number): string {
    return '';
  }

  protected isActivityRateCardImageLoading(row: AppTypes.ActivityListRow): boolean {
    return this.activityRateCardImageLoadingById[row.id] ?? false;
  }

  protected selectActivityRateCardImage(row: AppTypes.ActivityListRow, index: number, event: Event): void {
    event.stopPropagation();
    this.activityRateCardActiveImageIndexById[row.id] = index;
    this.cdr.markForCheck();
  }

  protected activityRateCardContentClasses(row: AppTypes.ActivityListRow): string[] {
    return [];
  }

  // ── Pair rate card helpers ─────────────────────────────────────────────────

  protected isPairRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair';
  }

  protected isPairReceivedRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair' && rate.direction === 'received';
  }

  protected activityPairRateSlotImageUrls(_row: AppTypes.ActivityListRow, _slot: 'man' | 'woman'): string[] {
    return [];
  }

  protected activityPairRateSlotActiveImageIndex(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): number {
    return this.activityPairRateCardActiveImageIndexByKey[`${row.id}-${slot}`] ?? 0;
  }

  protected activityPairRateSlotActiveImageUrl(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): string {
    const urls  = this.activityPairRateSlotImageUrls(row, slot);
    const index = this.activityPairRateSlotActiveImageIndex(row, slot);
    return urls[index] ?? '';
  }

  protected activityPairRateSlotInitials(_row: AppTypes.ActivityListRow, _slot: 'man' | 'woman'): string {
    return '?';
  }

  protected activityPairRateSlotPrimaryLine(_row: AppTypes.ActivityListRow, _slot: 'man' | 'woman'): string {
    return '';
  }

  protected activityPairRateSlotSecondaryLine(_row: AppTypes.ActivityListRow, _slot: 'man' | 'woman'): string {
    return '';
  }

  protected isActivityPairRateSlotImageLoading(row: AppTypes.ActivityListRow, slot: 'man' | 'woman'): boolean {
    return this.activityPairRateCardImageLoadingByKey[`${row.id}-${slot}`] ?? false;
  }

  protected selectActivityPairRateSlotImage(row: AppTypes.ActivityListRow, slot: 'man' | 'woman', index: number, event: Event): void {
    event.stopPropagation();
    this.activityPairRateCardActiveImageIndexByKey[`${row.id}-${slot}`] = index;
    this.cdr.markForCheck();
  }

  // ── Rate badge ─────────────────────────────────────────────────────────────

  protected activityRateBadgeLabel(row: AppTypes.ActivityListRow): string {
    const draft = this.activityRateDraftById[row.id];
    if (draft !== undefined) { return `${draft}`; }
    const rate = row.source as RateMenuItem;
    return rate.scoreGiven != null ? `${rate.scoreGiven}` : '–';
  }

  protected isActivityRatePending(row: AppTypes.ActivityListRow): boolean {
    return this.activityRateDraftById[row.id] === undefined && !(row.source as RateMenuItem).scoreGiven;
  }

  protected isActivityRateBlinking(row: AppTypes.ActivityListRow): boolean {
    const until = this.activityRateBlinkUntilByRowId[row.id];
    return until !== undefined && Date.now() < until;
  }

  private triggerActivityRateBarBlink(rowId: string): void {
    const blinkMs = 600;
    this.activityRateBlinkUntilByRowId[rowId] = Date.now() + blinkMs;
    if (this.activityRateBlinkTimeoutByRowId[rowId]) {
      clearTimeout(this.activityRateBlinkTimeoutByRowId[rowId]!);
    }
    this.activityRateBlinkTimeoutByRowId[rowId] = setTimeout(() => {
      delete this.activityRateBlinkUntilByRowId[rowId];
      this.activityRateBlinkTimeoutByRowId[rowId] = null;
      this.cdr.markForCheck();
    }, blinkMs);
  }

  private clearActivityRateBarBlinkTimer(): void {
    if (this.activityRateBarBlinkTimeout) {
      clearTimeout(this.activityRateBarBlinkTimeout);
      this.activityRateBarBlinkTimeout = null;
    }
  }

  // =========================================================================
  // Pair split drag (fullscreen only)
  // =========================================================================

  protected get activitiesRatesPairSplitCssValue(): string {
    return `${this.activitiesRatesPairSplitPercent}%`;
  }

  protected startActivitiesRatesPairSplitDrag(event: PointerEvent): void {
    event.preventDefault();
    const grid = this.activitiesRatesPairFullscreenGridRef?.nativeElement;
    if (!grid) { return; }
    const rect = grid.getBoundingClientRect();
    this.activitiesRatesPairSplitBounds        = { left: rect.left, width: rect.width };
    this.activitiesRatesPairSplitPointerId     = event.pointerId;
    this.activitiesRatesPairSplitDragStartClientX   = event.clientX;
    this.activitiesRatesPairSplitDragStartPercent   = this.activitiesRatesPairSplitPercent;
    this.isActivitiesRatesPairSplitDragging    = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected moveActivitiesRatesPairSplitDrag(event: PointerEvent): void {
    if (!this.isActivitiesRatesPairSplitDragging || !this.activitiesRatesPairSplitBounds) { return; }
    const pct = ((event.clientX - this.activitiesRatesPairSplitBounds.left) / this.activitiesRatesPairSplitBounds.width) * 100;
    this.activitiesRatesPairSplitPercent = Math.max(0, Math.min(100, pct));
    this.cdr.markForCheck();
  }

  protected stopActivitiesRatesPairSplitDrag(event?: PointerEvent): void {
    if (!this.isActivitiesRatesPairSplitDragging) { return; }
    this.isActivitiesRatesPairSplitDragging         = false;
    this.activitiesRatesPairSplitPointerId          = null;
    this.activitiesRatesPairSplitBounds             = null;
    this.activitiesRatesPairSplitDragStartClientX   = null;
    this.activitiesRatesPairSplitDragStartPercent   = null;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Fullscreen rates navigation
  // =========================================================================

  protected activitiesRatesFullscreenAllRows(): AppTypes.ActivityListRow[] {
    return this.filteredActivityRows;
  }

  protected currentActivitiesRatesFullscreenRow(): AppTypes.ActivityListRow | null {
    const rows = this.activitiesRatesFullscreenAllRows();
    return rows[this.activitiesRatesFullscreenCardIndex] ?? null;
  }

  protected activitiesRatesFullscreenNext(event: Event): void {
    event.stopPropagation();
    if (this.activitiesRatesFullscreenAnimating) { return; }
    const rows = this.activitiesRatesFullscreenAllRows();
    if (this.activitiesRatesFullscreenCardIndex >= rows.length - 1) { return; }
    this.activitiesRatesFullscreenLeavingRow = rows[this.activitiesRatesFullscreenCardIndex] ?? null;
    this.activitiesRatesFullscreenCardIndex += 1;
    this.activitiesRatesFullscreenAnimating  = true;
    this.syncActivitiesRatesFullscreenSelection();
    this.cancelActivitiesRatesFullscreenAdvance();
    this.activitiesRatesFullscreenAdvanceTimer = setTimeout(() => {
      this.activitiesRatesFullscreenLeavingRow = null;
      this.activitiesRatesFullscreenAnimating  = false;
      this.activitiesRatesFullscreenAdvanceTimer = null;
      this.cdr.markForCheck();
    }, this.activitiesRatesFullscreenLeaveTimeoutMs);
    this.cdr.markForCheck();
  }

  protected activitiesRatesFullscreenPrev(event: Event): void {
    event.stopPropagation();
    if (this.activitiesRatesFullscreenAnimating || this.activitiesRatesFullscreenCardIndex === 0) { return; }
    this.activitiesRatesFullscreenCardIndex -= 1;
    this.syncActivitiesRatesFullscreenSelection();
    this.cdr.markForCheck();
  }

  protected onActivitiesRatesFullscreenLeaveAnimationEnd(_event: AnimationEvent): void {
    this.activitiesRatesFullscreenLeavingRow = null;
    this.activitiesRatesFullscreenAnimating  = false;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.cdr.markForCheck();
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
    if (!this.shouldShowRatesFullscreenToggle()) { return; }
    if (this.activitiesRatesFullscreenMode) {
      this.disableActivitiesRatesFullscreenMode();
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
    this.activitiesRatesFullscreenCardIndex   = 0;
    this.activitiesRatesFullscreenAnimating   = false;
    this.activitiesRatesFullscreenLeavingRow  = null;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.cancelActivityRateEditorCloseTransition();
    this.activityRateEditorClosing = false;
    this.syncActivitiesRatesFullscreenSelection();
    this.eventEditorService.setActivitiesRatesFullscreenMode(true);
    this.cdr.markForCheck();
  }

  private disableActivitiesRatesFullscreenMode(): void {
    this.activitiesRatesFullscreenCardIndex  = 0;
    this.activitiesRatesFullscreenLeavingRow = null;
    this.activitiesRatesFullscreenAnimating  = false;
    this.cancelActivitiesRatesFullscreenAdvance();
    this.eventEditorService.setActivitiesRatesFullscreenMode(false);
    this.cdr.markForCheck();
  }

  private cancelActivitiesRatesFullscreenAdvance(): void {
    if (this.activitiesRatesFullscreenAdvanceTimer) {
      clearTimeout(this.activitiesRatesFullscreenAdvanceTimer);
      this.activitiesRatesFullscreenAdvanceTimer = null;
    }
  }

  private syncActivitiesRatesFullscreenSelection(): void {
    const row = this.currentActivitiesRatesFullscreenRow();
    this.eventEditorService.setActivitiesSelectedRateId(row?.id ?? null);
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

  protected onActivitiesPopupSurfaceClick(_event: MouseEvent): void {
    if (this.showActivitiesViewPicker || this.showActivitiesSecondaryPicker) {
      this.showActivitiesViewPicker      = false;
      this.showActivitiesSecondaryPicker = false;
      this.cdr.markForCheck();
    }
    if (this.inlineItemActionMenu) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private isHostingPublished(id: string): boolean {
    return this.publishedHostingIds.has(id);
  }

  private matchesActivitiesChatContextFilter(item: ChatMenuItem): boolean {
    const filter = this.activitiesChatContextFilter;
    if (filter === 'all') { return true; }
    return this.activityChatContextFilterKey(item) === filter;
  }

  private activityChatContextFilterKey(item: ChatMenuItem): AppTypes.ActivitiesChatContextFilter | null {
    const context = (item as { context?: string }).context;
    if (context === 'event')     { return 'event'; }
    if (context === 'subEvent')  { return 'subEvent'; }
    if (context === 'group')     { return 'group'; }
    return null;
  }

  private matchesRateFilter(item: RateMenuItem, filter: AppTypes.RateFilterKey): boolean {
    if (filter.startsWith('individual')) {
      if (item.mode === 'pair') { return false; }
      if (filter === 'individual-given')    { return item.direction === 'given'; }
      if (filter === 'individual-received') { return item.direction === 'received'; }
      if (filter === 'individual-mutual')   { return item.direction === 'mutual'; }
      if (filter === 'individual-met')      { return item.direction === 'met'; }
    }
    if (filter.startsWith('pair')) {
      if (item.mode !== 'pair') { return false; }
      if (filter === 'pair-given')    { return item.direction === 'given'; }
      if (filter === 'pair-received') { return item.direction === 'received'; }
    }
    return true;
  }

  private commitPendingRateDirectionOverrides(_nextFilter?: AppTypes.RateFilterKey): void {
    // Flush pending direction overrides to the authoritative record.
    for (const [id, dir] of Object.entries(this.pendingActivityRateDirectionOverrideById)) {
      if (dir !== undefined) {
        this.activityRateDirectionOverrideById[id] = dir;
      }
    }
  }

  // ── Row converters ─────────────────────────────────────────────────────────

  private chatToActivityRow(item: ChatMenuItem): AppTypes.ActivityListRow {
    return {
      id: item.id,
      type: 'chats',
      title: item.title,
      subtitle: (item as { lastMessage?: string }).lastMessage ?? '',
      detail: (item as { context?: string }).context ?? '',
      dateIso: this.chatDatesById[item.id] ?? '2026-02-21T09:00:00',
      distanceKm: this.chatDistanceById[item.id] ?? 5,
      unread: item.unread,
      metricScore: item.unread * 10,
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

  private hostingToActivityRow(item: HostingMenuItem): AppTypes.ActivityListRow {
    return {
      id: item.id,
      type: 'hosting',
      title: item.title,
      subtitle: item.shortDescription,
      detail: item.timeframe,
      dateIso: this.hostingDatesById[item.id] ?? this.eventDatesById[item.id] ?? '2026-03-01T09:00:00',
      distanceKm: this.hostingDistanceById[item.id] ?? this.eventDistanceById[item.id] ?? 10,
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
    return {
      id: item.id,
      type: 'rates',
      title: item.eventName ?? '',
      subtitle: '',
      detail: '',
      dateIso: item.happenedAt ?? '',
      distanceKm: item.distanceKm ?? 0,
      unread: 0,
      metricScore: item.scoreGiven ?? 0,
      source: item
    };
  }

  // ── User lookup ────────────────────────────────────────────────────────────

  private userById(userId: string): DemoUser | undefined {
    return DEMO_USERS.find(u => u.id === userId);
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
    this.activitiesHeaderLoadingCounter++;
    this.activitiesHeaderProgressLoading = true;
    this.activitiesHeaderLoadingStartedAtMs = Date.now();
    this.cdr.markForCheck();
  }

  private endActivitiesHeaderProgressLoading(): void {
    if (this.activitiesHeaderLoadingCounter > 0) {
      this.activitiesHeaderLoadingCounter--;
    }
    if (this.activitiesHeaderLoadingCounter === 0) {
      this.activitiesHeaderProgressLoading = false;
      this.activitiesHeaderProgress = 0;
      this.cdr.markForCheck();
    }
  }

  private updateActivitiesHeaderProgress(): void {
    if (!this.activitiesHeaderProgressLoading) {
      this.activitiesHeaderProgress = 0;
      this.cdr.markForCheck();
      return;
    }
    const elapsed = Date.now() - this.activitiesHeaderLoadingStartedAtMs;
    const ratio   = Math.min(elapsed / this.activitiesHeaderLoadingWindowMs, 1);
    this.activitiesHeaderProgress = Math.round(ratio * 100);
    this.cdr.markForCheck();
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
  }

  private refreshActivitiesStickyHeaderSoon(): void {
    setTimeout(() => {
      const el = this.activitiesScrollRef?.nativeElement;
      if (el) { this.updateActivitiesStickyHeader(el.scrollTop); }
      this.cdr.markForCheck();
    }, 0);
  }

  private refreshActivitiesHeaderProgressSoon(): void {
    if (this.activitiesHeaderFlushScheduled) { return; }
    this.activitiesHeaderFlushScheduled = true;
    setTimeout(() => {
      this.activitiesHeaderFlushScheduled = false;
      this.updateActivitiesHeaderProgress();
      this.cdr.markForCheck();
    }, this.activitiesHeaderLoadingTickMs);
  }
}
