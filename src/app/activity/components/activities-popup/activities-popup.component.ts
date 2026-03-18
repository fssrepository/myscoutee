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
  TemplateRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

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
import { ActivitiesDbContextService } from '../../services/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesFeedFilters,
  ActivitiesEventSyncPayload,
  EventChatContext,
  EventChatResourceContext
} from '../../../shared/activities-models';
import type * as AppTypes from '../../../shared/app-types';
import {
  buildPairRateCardData,
  buildSingleRateCardData,
  InfoCardComponent,
  PairCardComponent,
  SmartListComponent,
  SingleCardComponent,
  type CardBadgeConfig,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type PairCardData,
  type RateCardDataInput,
  type RateCardPerson,
  type RatingStarBarConfig,
  type SingleCardData,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListItemSelectEvent,
  type SmartListItemTemplateContext,
  type SmartListPresentation,
  type SmartListStateChange
} from '../../../shared/ui';
import { EventChatPopupComponent } from '../event-chat-popup/event-chat-popup.component';
import { EventExplorePopupComponent } from '../event-explore-popup/event-explore-popup.component';
import {
  ActivitiesFeedService,
  ActivityMembersService,
  AppContext,
  buildActivityRateRows,
  EventsService,
  RatesService,
  type ActivityMembersSyncState
} from '../../../shared/core';

// ---------------------------------------------------------------------------

type ActivitiesSmartListFilters = ActivitiesFeedFilters;

interface ActivitiesEventScopeOption {
  key: AppTypes.ActivitiesEventScope;
  label: string;
  icon: string;
}

type PendingActivityAction = 'delete' | 'exit' | 'reject';
type ActivityInfoCardActionId = 'publish' | 'primary' | 'view' | 'approve' | 'secondary' | 'restore';

@Component({
  selector: 'app-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    SmartListComponent,
    InfoCardComponent,
    SingleCardComponent,
    PairCardComponent,
    EventChatPopupComponent,
    EventExplorePopupComponent
  ],
  templateUrl: './activities-popup.component.html',
  styleUrl: './activities-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPopupComponent implements OnDestroy {
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  // ── injected ──────────────────────────────────────────────────────────────
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly activitiesFeedService = inject(ActivitiesFeedService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly ratesService = inject(RatesService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);

  // ── Self-contained data state (no host inputs) ───────────────────────────
  protected isMobileView = false;
  protected readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected activeUser: DemoUser = this.users[0] ?? DEMO_USERS[0];

  protected chatItems: ChatMenuItem[] = [...(DEMO_CHAT_BY_USER[this.activeUser.id] ?? [])];
  protected eventItems: EventMenuItem[] = [...(DEMO_EVENTS_BY_USER[this.activeUser.id] ?? [])];
  protected hostingItems: HostingMenuItem[] = [...(DEMO_HOSTING_BY_USER[this.activeUser.id] ?? [])];
  protected invitationItems: InvitationMenuItem[] = [...(DEMO_INVITATIONS_BY_USER[this.activeUser.id] ?? [])];
  protected assetCards: AppTypes.AssetCard[] = AppDemoGenerators.buildSampleAssetCards(this.users);
  protected rateItems: RateMenuItem[] = [];

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
  protected readonly activityPendingMembersById: Record<string, number> = {};
  protected readonly eventVisibilityById: Record<string, AppTypes.EventVisibility> = { ...APP_DEMO_DATA.eventVisibilityById };
  private readonly eventCapacityById: Record<string, AppTypes.EventCapacityRange> = {};
  private readonly eventSubEventsById: Record<string, AppTypes.SubEventFormItem[]> = {};
  private readonly acceptedOptionalSubEventMembersByKey: Record<string, string[]> = {};
  private readonly acceptedTournamentGroupMembersByKey: Record<string, string[]> = {};
  private readonly subEventAssignedAssetIdsByKey: Record<string, string[]> = {};
  private readonly activityMembersByRowId: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  private readonly forcedAcceptedMembersByRowKey: Record<string, number> = { 'events:e8': 20 };
  private lastAppliedActivityMembersUpdatedMs = 0;
  // ── ViewChild refs ────────────────────────────────────────────────────────
  @ViewChild('activitiesScroll')
  private activitiesScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesSmartList')
  private activitiesSmartList?: SmartListComponent<AppTypes.ActivityListRow, ActivitiesSmartListFilters>;

  private activitiesEventSmartListItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>>;
  private activitiesChatSmartListItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>>;
  private activitiesRateSingleSmartListItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>>;
  private activitiesRatePairSmartListItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>>;

  @ViewChild('activitiesEventSmartListItemTemplate', { read: TemplateRef })
  private set activitiesEventSmartListItemTemplate(value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | undefined) {
    this.activitiesEventSmartListItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  @ViewChild('activitiesChatSmartListItemTemplate', { read: TemplateRef })
  private set activitiesChatSmartListItemTemplate(value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | undefined) {
    this.activitiesChatSmartListItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  @ViewChild('activitiesRateSingleSmartListItemTemplate', { read: TemplateRef })
  private set activitiesRateSingleSmartListItemTemplate(value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | undefined) {
    this.activitiesRateSingleSmartListItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  @ViewChild('activitiesRatePairSmartListItemTemplate', { read: TemplateRef })
  private set activitiesRatePairSmartListItemTemplate(value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | undefined) {
    this.activitiesRatePairSmartListItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  // ── Static data ───────────────────────────────────────────────────────────
  protected readonly activityRatingScale   = APP_STATIC_DATA.activityRatingScale;
  protected readonly activitiesPrimaryFilters: Array<{ key: AppTypes.ActivitiesPrimaryFilter; label: string; icon: string }> = [
    { key: 'rates', label: 'Rates', icon: 'star' },
    { key: 'chats', label: 'Chats', icon: 'chat' },
    { key: 'events', label: 'Events', icon: 'event' }
  ];
  protected readonly activitiesEventScopeFilters: ReadonlyArray<ActivitiesEventScopeOption> = [
    { key: 'all', label: 'All', icon: 'widgets' },
    { key: 'active-events', label: 'Active Events', icon: 'event' },
    { key: 'invitations', label: 'Invitations', icon: 'mail' },
    { key: 'my-events', label: 'My Events', icon: 'stadium' },
    { key: 'drafts', label: 'Drafts', icon: 'drafts' },
    { key: 'trash', label: 'Trash', icon: 'delete' }
  ];
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
  protected activitiesEventScope: AppTypes.ActivitiesEventScope               = 'active-events';
  protected activitiesChatContextFilter: AppTypes.ActivitiesChatContextFilter = 'all';
  protected activitiesSecondaryFilter: AppTypes.ActivitiesSecondaryFilter    = 'recent';
  protected hostingPublicationFilter: AppTypes.HostingPublicationFilter       = 'all';
  protected activitiesRateFilter: AppTypes.RateFilterKey                     = 'individual-given';
  protected activitiesView: AppTypes.ActivitiesView                          = 'day';
  protected showActivitiesViewPicker     = false;
  protected showActivitiesSecondaryPicker = false;
  protected showActivitiesPrimaryPicker = false;
  protected showActivitiesEventScopePicker = false;
  protected showActivitiesChatContextPicker = false;
  protected showActivitiesRatePicker      = false;
  protected showActivitiesQuickActionsMenu = false;
  protected activitiesSmartListQuery: Partial<ListQuery<ActivitiesSmartListFilters>> = {};
  protected readonly activitiesSmartListConfig: SmartListConfig<AppTypes.ActivityListRow, ActivitiesSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    loadingDelayMs: 1000,
    defaultView: 'day',
    containerClass: () => this.activitiesSmartListClassMap(),
    listLayout: 'card-grid',
    desktopColumns: () => this.activitiesPrimaryFilter === 'chats' ? 1 : 3,
    snapMode: () => this.activitiesPrimaryFilter === 'chats' ? 'none' : 'mandatory',
    scrollPaddingTop: '2.6rem',
    footerSpacerHeight: () => this.activitiesPrimaryFilter === 'rates' ? this.activityRateEditorSpacerHeight() : null,
    headerProgress: {
      enabled: true
    },
    pagination: {
      mode: () => {
        if (this.activitiesPrimaryFilter !== 'rates') {
          return 'scroll';
        }
        if (this.isRatesFullscreenModeActive()) {
          return this.isActivitiesRatesFullscreenReadOnlyNavigation() ? 'arrows' : 'rating-stars';
        }
        return this.shouldRenderActivityRateEditorDock() ? 'rating-stars' : 'scroll';
      },
      ratingBarConfig: () => this.activityRateBarConfig(),
      ratingBarValue: () => this.selectedActivityRateValue(),
      onRatingSelect: (_item, score) => this.setSelectedActivityOwnRating(score)
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
      if (this.isEventActivitiesPrimaryFilter() && !scrollable) {
        return false;
      }
      if (!scrollable) {
        return false;
      }
      return true;
    }
  };
  protected readonly activitiesSmartListLoadPage: SmartListLoadPage<AppTypes.ActivityListRow, ActivitiesSmartListFilters>
    = query => from(this.loadActivitiesFeedPage(query));

  // ── Inline action menu ────────────────────────────────────────────────────
  protected inlineItemActionMenu: {
    scope: 'activityMember';
    id: string;
    title: string;
    openUp: boolean;
  } | null = null;

  // ── Scroll / sticky ───────────────────────────────────────────────────────
  protected activitiesListScrollable  = true;
  protected activitiesStickyValue     = '';
  protected activitiesInitialLoadPending = false;
  private visibleActivityRows: AppTypes.ActivityListRow[] = [];
  protected readonly activitiesPageSize  = 10;

  // ── Rates state ───────────────────────────────────────────────────────────
  protected selectedActivityRateId: string | null  = null;
  private activityRateEditorClosing                = false;
  private activityRateEditorCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private activityRateEditorLiftAnimationFrame: number | null = null;
  private readonly activityRateEditorSlideDurationMs = 180;
  private activityRateEditorOpenScrollTop: number | null = null;
  private lastActivityRateEditorLiftDelta = 0;
  private readonly activityRateBlinkUntilByRowId: Record<string, number>                          = {};
  private readonly activityRateBlinkTimeoutByRowId: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private readonly activityRateDraftById: Record<string, number>                                  = {};
  private readonly activityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};

  private lastRateIndicatorPulseRowId: string | null = null;

  // ── Rates fullscreen state ────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;

  // ── Delete / publish confirms ─────────────────────────────────────────────
  protected pendingActivityDeleteRow: AppTypes.ActivityListRow | null  = null;
  protected pendingActivityPublishRow: AppTypes.ActivityListRow | null = null;
  protected pendingActivityAction: PendingActivityAction               = 'delete';
  protected stackedActivitiesPopup: 'activityMembers' | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected pendingActivityMemberDelete: AppTypes.ActivityMemberEntry | null = null;
  protected selectedActivityMembers: AppTypes.ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRow: AppTypes.ActivityListRow | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  private readonly trashedActivityRowsByKey: Record<string, AppTypes.ActivityListRow> = {};

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
      this.activitiesEventScope         = svc.activitiesEventScope() as AppTypes.ActivitiesEventScope;
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
      this.syncActivitiesSmartListQuery();
      this.cdr.markForCheck();
    });

    effect(() => {
      if (this.isEventActivitiesPrimaryFilter() && this.activitiesSecondaryFilter === 'relevant') {
        this.activitiesContext.setActivitiesSecondaryFilter('recent');
      }
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
      const sync = this.appCtx.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSyncState(sync);
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
    this.resetActivitiesStateForOpen();
    this.clearActivityRateEditorState();
    this.resetActivitiesScroll();
    this.seedEventOwnerMemberCountsFromEventsTable();
  }

  private resetActivitiesStateForOpen(): void {
    this.inlineItemActionMenu = null;
    this.pendingActivityDeleteRow = null;
    this.pendingActivityPublishRow = null;
    this.pendingActivityAction = 'delete';
    this.visibleActivityRows = [];
    this.activitiesStickyValue = '';
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
  }

  ngOnDestroy(): void {
    this.clearActivityRateEditorState();
    this.activitiesSmartList?.clearHostedLoading();
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
    this.refreshRateItems();

    this.ensurePaginationTestEvents(30);
    this.initializeEventEditorContextData();
    this.refreshSectionBadges();
    this.seedEventOwnerMemberCountsFromEventsTable();
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
    const visibleInvitations = this.invitationItems
      .filter(item => !this.isActivityIdentityTrashed('invitations', item.id));
    this.invitationsBadge = AppDemoGenerators.resolveSectionBadge(
      visibleInvitations.map(item => item.unread),
      visibleInvitations.length
    );
    const visibleActiveEvents = this.eventItems
      .filter(item => item.isAdmin !== true)
      .filter(item => !this.isActivityIdentityTrashed('events', item.id));
    this.eventsBadge = AppDemoGenerators.resolveSectionBadge(
      visibleActiveEvents.map(item => item.activity),
      visibleActiveEvents.length
    );
    const adminEvents = this.eventItems
      .filter(item => item.isAdmin)
      .filter(item => !this.isActivityIdentityTrashed('hosting', item.id));
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

  protected get filteredActivityRows(): AppTypes.ActivityListRow[] {
    return [...this.visibleActivityRows];
  }

  private buildEventScopeRows(
    scope: AppTypes.ActivitiesEventScope,
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
    hostingPublicationFilter: AppTypes.HostingPublicationFilter
  ): AppTypes.ActivityListRow[] {
    const activeEventRows = this.eventItems
      .filter(item => item.isAdmin !== true)
      .filter(item => !this.isActivityIdentityTrashed('events', item.id))
      .map(item => this.eventToActivityRow(item, secondaryFilter));
    const invitationRows = this.invitationItems
      .filter(item => !this.isActivityIdentityTrashed('invitations', item.id))
      .map(item => this.invitationToActivityRow(item));
    const myEventRows = this.eventItems
      .filter(item => item.isAdmin === true)
      .filter(item => !this.isActivityIdentityTrashed('hosting', item.id))
      .map(item => this.hostingEventToActivityRow(item));
    const draftRows = myEventRows.filter(row => !this.isHostingPublished(row.id));
    const trashRows = this.trashedActivityRows();

    if (scope === 'all') {
      return [...activeEventRows, ...invitationRows, ...myEventRows];
    }
    if (scope === 'invitations') {
      return invitationRows;
    }
    if (scope === 'my-events') {
      if (hostingPublicationFilter === 'drafts') {
        return draftRows;
      }
      return myEventRows;
    }
    if (scope === 'drafts') {
      return draftRows;
    }
    if (scope === 'trash') {
      return trashRows;
    }
    return activeEventRows;
  }

  // =========================================================================
  // Template helpers – toolbar
  // =========================================================================

  protected isEventActivitiesPrimaryFilter(): boolean {
    return this.activitiesPrimaryFilter === 'events';
  }

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
    return 0;
  }

  protected activitiesPrimaryPanelWidth(): string {
    return '200px';
  }

  protected activitiesEventScopePanelWidth(): string {
    return '260px';
  }

  protected activitiesEventScopeLabel(): string {
    return this.activitiesEventScopeFilters.find(option => option.key === this.activitiesEventScope)?.label ?? 'Active Events';
  }

  protected activitiesEventScopeIcon(): string {
    return this.activitiesEventScopeFilters.find(option => option.key === this.activitiesEventScope)?.icon ?? 'event';
  }

  protected activitiesEventScopeClass(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): string {
    if (scope === 'trash') {
      return 'activity-filter-trash';
    }
    if (scope === 'drafts') {
      return 'activity-filter-drafts';
    }
    if (scope === 'invitations') {
      return 'activity-filter-invitations';
    }
    if (scope === 'my-events') {
      return 'activity-filter-hosting';
    }
    return 'activity-filter-events';
  }

  protected activitiesEventScopeCount(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): number {
    if (scope === 'all') {
      return this.eventsBadge + this.invitationsBadge + this.hostingBadge;
    }
    if (scope === 'drafts') {
      return this.hostingDraftCount();
    }
    if (scope === 'trash') {
      return this.trashedActivityCount();
    }
    if (scope === 'active-events') {
      return this.eventsBadge;
    }
    if (scope === 'invitations') {
      return this.invitationsBadge;
    }
    return this.hostingBadge;
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
    if (this.isEventActivitiesPrimaryFilter()) {
      if (this.activitiesView === 'month' || this.activitiesView === 'week') {
        return `Events · ${this.activitiesEventScopeLabel()}`;
      }
      return `${this.activitiesEventScopeLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
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
    return this.activitiesSecondaryFilterOptionLabel(this.effectiveActivitiesSecondaryFilter());
  }

  protected activitiesSecondaryFilterOptionLabel(filter: AppTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(o => o.key === filter)?.label ?? 'Relevant';
  }

  protected activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(o => o.key === this.effectiveActivitiesSecondaryFilter())?.icon ?? 'schedule';
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
    return false;
  }

  protected hostingDraftCount(): number {
    return this.eventItems
      .filter(item => item.isAdmin && !this.isHostingPublished(item.id))
      .filter(item => !this.isActivityIdentityTrashed('hosting', item.id))
      .length;
  }

  protected shouldShowActivitiesQuickActions(): boolean {
    return this.isEventActivitiesPrimaryFilter();
  }

  protected shouldShowRatesFullscreenToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates' && !this.isCalendarLayoutView();
  }

  protected isRatesFullscreenModeActive(): boolean {
    return this.shouldShowRatesFullscreenToggle() && this.activitiesRatesFullscreenMode;
  }

  protected activitiesSmartListPresentation(): SmartListPresentation {
    return this.isRatesFullscreenModeActive() ? 'fullscreen' : 'list';
  }

  protected isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }

  protected availableActivitiesSecondaryFilters(): ReadonlyArray<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }> {
    return this.isEventActivitiesPrimaryFilter()
      ? this.activitiesSecondaryFilters.filter(option => option.key !== 'relevant')
      : this.activitiesSecondaryFilters;
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
    if (filter === 'events' && this.activitiesSecondaryFilter === 'relevant') {
      this.activitiesContext.setActivitiesSecondaryFilter('recent');
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

  protected toggleActivitiesEventScopePicker(event: Event): void {
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

  protected selectActivitiesEventScope(scope: AppTypes.ActivitiesEventScope): void {
    const currentScope = this.activitiesContext.activitiesEventScope() as AppTypes.ActivitiesEventScope;
    if (!this.isEventActivitiesPrimaryFilter() || currentScope === scope) {
      this.showActivitiesEventScopePicker = false;
      return;
    }
    this.activitiesContext.setActivitiesEventScope(scope);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') { return; }
    this.activitiesContext.setActivitiesChatContextFilter(filter);
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (!this.isHostingPublicationFilterVisible() || this.hostingPublicationFilter === filter) { return; }
    this.activitiesContext.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    const normalizedFilter = this.isEventActivitiesPrimaryFilter() && filter === 'relevant'
      ? 'recent'
      : filter;
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesContext.setActivitiesSecondaryFilter(normalizedFilter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  private effectiveActivitiesSecondaryFilter(): AppTypes.ActivitiesSecondaryFilter {
    return this.isEventActivitiesPrimaryFilter() && this.activitiesSecondaryFilter === 'relevant'
      ? 'recent'
      : this.activitiesSecondaryFilter;
  }

  protected selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    const currentFilter = this.activitiesContext.activitiesRateFilter() as AppTypes.RateFilterKey;
    if (currentFilter === filter) {
      this.showActivitiesPrimaryPicker = false;
      this.showActivitiesEventScopePicker = false;
      this.showActivitiesChatContextPicker = false;
      this.showActivitiesSecondaryPicker = false;
      this.showActivitiesRatePicker = false;
      this.showActivitiesQuickActionsMenu = false;
      return;
    }
    this.commitPendingRateDirectionOverrides(filter);
    this.activitiesContext.setActivitiesRateFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.selectedActivityRateId = null;
    this.activitiesContext.setActivitiesSelectedRateId(null);
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesContext.toggleActivitiesViewPicker();
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') { return; }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
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
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected toggleActivitiesQuickActionsMenu(event: Event): void {
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

  // ── Mobile bottom-sheet openers (delegates back to parent if needed) ───────

  protected openMobileActivitiesPrimaryFilterSelector(event: Event): void {
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

  protected openMobileActivitiesEventScopeSelector(event: Event): void {
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

  protected openMobileActivitiesChatContextFilterSelector(event: Event): void {
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

  protected openMobileActivitiesRateFilterSelector(event: Event): void {
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

  // ── Event editor / explore – call EventEditorService directly ────────────

  protected requestOpenEventEditor(): void {
    const target: AppTypes.EventEditorTarget = this.isEventActivitiesPrimaryFilter() ? 'hosting' : 'events';
    this.showActivitiesQuickActionsMenu = false;
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
    void stacked;
    this.openActivityRowInEventModule(row, readOnly);
  }

  protected requestOpenEventExplore(): void {
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesContext.requestActivitiesNavigation({ type: 'eventExplore' });
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

  protected trackByActivityRow(_index: number, row: AppTypes.ActivityListRow): string {
    return this.activityRowIdentity(row);
  }

  protected trackByRateCardImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  protected activitiesSmartListClassMap(): Record<string, boolean> {
    return {
      'experience-card-list': true,
      'assets-card-list': true
    };
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
    const sourceImageUrl = (row.source as { imageUrl?: string }).imageUrl;
    if (typeof sourceImageUrl === 'string' && sourceImageUrl.trim().length > 0) {
      return sourceImageUrl;
    }
    return this.activityImageById[row.id] ?? `https://picsum.photos/seed/event-${row.id}/1200/700`;
  }

  protected showActivitySourceIcon(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'invitations';
  }

  protected activitySourceAvatarClass(row: AppTypes.ActivityListRow): string {
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${(row.source as InvitationMenuItem).inviter}`
      : `${row.id}-${row.title}`;
    const toneIndex = (AppDemoGenerators.hashText(toneSeed) % 8) + 1;
    return `activities-source-tone-${toneIndex}`;
  }

  private activitySourceAvatarTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['mediaStart']>['tone'] {
    const toneClass = this.activitySourceAvatarClass(row);
    const tone = toneClass.replace('activities-source-', '');
    switch (tone) {
      case 'tone-1':
      case 'tone-2':
      case 'tone-3':
      case 'tone-4':
      case 'tone-5':
      case 'tone-6':
      case 'tone-7':
      case 'tone-8':
        return tone;
      default:
        return 'default';
    }
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
    const summary = this.activityMembersSummaryForRow(row);
    if (summary) {
      return `${summary.acceptedMembers} / ${summary.capacityTotal}`;
    }
    const acceptedMembersCount = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembersCount);
    return `${acceptedMembersCount} / ${capacityTotal}`;
  }

  protected activityPendingMemberCount(row: AppTypes.ActivityListRow): number {
    const summary = this.activityMembersSummaryForRow(row);
    if (summary) {
      return summary.pendingMembers;
    }
    return this.getActivityMembersByRow(row).filter(member => member.status === 'pending').length;
  }

  protected isActivityFull(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'events') {
      return false;
    }
    const summary = this.activityMembersSummaryForRow(row);
    if (summary) {
      return summary.capacityTotal > 0 && summary.acceptedMembers >= summary.capacityTotal;
    }
    const acceptedMembersCount = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembersCount);
    return capacityTotal > 0 && acceptedMembersCount >= capacityTotal;
  }

  protected isActivityDraft(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'hosting' && !this.isHostingPublished(row.id);
  }

  private activityCapacityTotal(row: AppTypes.ActivityListRow, fallbackBase = 0): number {
    const source = this.activityCapacityById[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0) {
        return parts[1];
      }
    }
    const sourceCapacityMax = Number((row.source as { capacityMax?: unknown }).capacityMax);
    if (Number.isFinite(sourceCapacityMax) && sourceCapacityMax >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityMax));
    }
    const sourceCapacityTotal = Number((row.source as { capacityTotal?: unknown }).capacityTotal);
    if (Number.isFinite(sourceCapacityTotal) && sourceCapacityTotal >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityTotal));
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

  private activityMembersOwnerForRow(row: AppTypes.ActivityListRow): ActivityMemberOwnerRef | null {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    return {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  private activityMembersSummaryForRow(row: AppTypes.ActivityListRow): ActivityMembersSummary | null {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    const source = this.activityCapacityById[row.id];
    const pendingMembers = Math.max(0, Math.trunc(Number(this.activityPendingMembersById[row.id]) || 0));
    const sourceRecord = row.source as {
      acceptedMembers?: unknown;
      pendingMembers?: unknown;
      capacityTotal?: unknown;
      capacityMax?: unknown;
    };
    const acceptedFromSource = Number(sourceRecord.acceptedMembers);
    const pendingFromSource = Number(sourceRecord.pendingMembers);
    const capacityFromSource = Number(sourceRecord.capacityTotal);
    const capacityMaxFromSource = Number(sourceRecord.capacityMax);
    if (
      Number.isFinite(acceptedFromSource)
      && (Number.isFinite(capacityFromSource) || Number.isFinite(capacityMaxFromSource))
    ) {
      return {
        ownerType: 'event',
        ownerId: row.id,
        acceptedMembers: Math.max(0, Math.trunc(acceptedFromSource)),
        pendingMembers: Number.isFinite(pendingFromSource) ? Math.max(0, Math.trunc(pendingFromSource)) : pendingMembers,
        capacityTotal: Math.max(
          Math.max(0, Math.trunc(acceptedFromSource)),
          Number.isFinite(capacityFromSource)
            ? Math.max(0, Math.trunc(capacityFromSource))
            : Math.max(0, Math.trunc(capacityMaxFromSource))
        ),
        acceptedMemberUserIds: [],
        pendingMemberUserIds: []
      };
    }
    if (!source) {
      return null;
    }
    const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
    const acceptedMembers = parts.length >= 1 && Number.isFinite(parts[0]) ? Math.max(0, parts[0]) : null;
    const capacityTotal = parts.length >= 2 && Number.isFinite(parts[1]) ? Math.max(0, parts[1]) : null;
    if (acceptedMembers === null || capacityTotal === null) {
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

  private buildActivityMembersSummary(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal: number
  ): ActivityMembersSummary {
    const acceptedMemberUserIds = members
      .filter(member => member.status === 'accepted')
      .map(member => member.userId);
    const pendingMemberUserIds = members
      .filter(member => member.status === 'pending')
      .map(member => member.userId);
    return {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      acceptedMembers: acceptedMemberUserIds.length,
      pendingMembers: pendingMemberUserIds.length,
      capacityTotal: Math.max(acceptedMemberUserIds.length, capacityTotal),
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
  }

  private applyActivityMembersSummary(row: AppTypes.ActivityListRow, summary: ActivityMembersSummary): void {
    this.activityCapacityById[row.id] = `${summary.acceptedMembers} / ${summary.capacityTotal}`;
    this.activityPendingMembersById[row.id] = summary.pendingMembers;
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
  }

  private async loadActivityMembersForRow(
    owner: ActivityMemberOwnerRef,
    row: AppTypes.ActivityListRow,
    rowSelectionId: string
  ): Promise<void> {
    const members = await this.activityMembersService.queryMembersByOwner(owner);
    if (this.selectedActivityMembersRowId !== rowSelectionId || this.selectedActivityMembersRow?.id !== row.id) {
      return;
    }
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(members);
    this.activityMembersByRowId[rowSelectionId] = [...this.selectedActivityMembers];
    const summary = this.buildActivityMembersSummary(
      owner,
      members,
      this.activityCapacityTotal(row, members.filter(member => member.status === 'accepted').length)
    );
    this.applyActivityMembersSummary(row, summary);
    this.cdr.markForCheck();
  }

  private persistSelectedActivityMembers(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId) {
      return;
    }
    const owner = this.activityMembersOwnerForRow(this.selectedActivityMembersRow);
    if (!owner) {
      return;
    }
    const acceptedMembers = this.selectedActivityMembers.filter(member => member.status === 'accepted').length;
    const summary = this.buildActivityMembersSummary(
      owner,
      this.selectedActivityMembers,
      this.activityCapacityTotal(this.selectedActivityMembersRow, acceptedMembers)
    );
    this.applyActivityMembersSummary(this.selectedActivityMembersRow, summary);
    void this.activityMembersService.replaceMembersByOwner(owner, this.selectedActivityMembers, summary.capacityTotal);
  }

  private seedEventOwnerMemberCountsFromEventsTable(): void {
    const eventRecords = this.eventsService.peekItemsByUser(this.activeUser.id);
    for (const record of eventRecords) {
      if (record.isInvitation) {
        continue;
      }
      this.activityCapacityById[record.id] = `${record.acceptedMembers} / ${record.capacityTotal}`;
      this.activityPendingMembersById[record.id] = record.pendingMembers;
    }
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

  private activityLeadingIconTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    if (row.type !== 'hosting' && row.type !== 'events') {
      return 'default';
    }
    const visibility = this.activityVisibility(row);
    if (visibility === 'Public') {
      return 'public';
    }
    if (visibility === 'Friends only') {
      return 'friends';
    }
    return 'invitation';
  }

  protected activityDateRangeMetaLine(row: AppTypes.ActivityListRow): string {
    return `${this.activityTypeLabel(row)} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  protected activityLocationMetaLine(row: AppTypes.ActivityListRow): string {
    return (row.source as { city?: string })?.city ?? '';
  }

  private activityTypeLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') {
      return 'My Event';
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

  protected activityEventInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    const locationMetaLine = this.activityLocationMetaLine(row);
    return {
      rowId: this.activityRowIdentity(row),
      groupLabel: options.groupLabel ?? null,
      title: row.title,
      imageUrl: this.activityImageUrl(row),
      metaRows: [
        this.activityDateRangeMetaLine(row),
        ...(locationMetaLine ? [locationMetaLine] : [])
      ],
      description: row.subtitle,
      surfaceTone: this.isActivityDraft(row) ? 'draft' : this.isActivityFull(row) ? 'full' : 'default',
      leadingIcon: {
        icon: this.activityLeadingIcon(row),
        tone: this.activityLeadingIconTone(row)
      },
      mediaStart: this.showActivitySourceIcon(row)
        ? {
            variant: 'avatar',
            tone: this.activitySourceAvatarTone(row),
            label: this.activitySourceAvatarLabel(row),
            interactive: false
          }
        : null,
      mediaEnd: {
        variant: 'badge',
        tone: this.isActivityFull(row) ? 'full' : 'default',
        label: this.activityCapacityLabel(row),
        ariaLabel: 'Open members',
        interactive: true,
        pendingCount: this.activityPendingMemberCount(row)
      },
      menuActions: this.activityEventInfoCardMenuActions(row),
      clickable: false
    };
  }

  private activityEventInfoCardMenuActions(row: AppTypes.ActivityListRow): readonly InfoCardMenuAction[] {
    if (!this.canManageActivityRow(row)) {
      return [];
    }
    if (this.isActivityRowTrashed(row)) {
      return this.shouldShowActivityRestoreAction(row)
        ? [{ id: 'restore', label: 'Restore', icon: 'restore_from_trash' }]
        : [];
    }

    const actions: InfoCardMenuAction[] = [];
    if (this.shouldShowActivityPublishAction(row)) {
      actions.push({ id: 'publish', label: 'Publish', icon: 'campaign', tone: 'accent' });
    }
    if (this.shouldShowActivityPrimaryAction(row)) {
      actions.push({
        id: 'primary',
        label: this.activityPrimaryActionLabel(row),
        icon: this.activityPrimaryActionIcon(row)
      });
    }
    if (this.shouldShowActivityViewAction(row)) {
      actions.push({ id: 'view', label: 'View Event', icon: 'visibility' });
    }
    if (this.shouldShowActivityApproveAction(row)) {
      actions.push({ id: 'approve', label: 'Accept', icon: 'done', tone: 'accent' });
    }
    if (this.shouldShowActivitySecondaryAction(row)) {
      actions.push({
        id: 'secondary',
        label: this.activitySecondaryActionLabel(row),
        icon: this.activitySecondaryActionIcon(row),
        tone: this.isExitActivityRow(row) ? 'warning' : 'destructive'
      });
    }
    return actions;
  }

  protected canManageActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type !== 'chats' && row.type !== 'rates';
  }

  protected shouldShowActivityPublishAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'hosting' && !this.isHostingPublished(row.id);
  }

  protected shouldShowActivityPrimaryAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row);
  }

  protected shouldShowActivityViewAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && (row.type === 'hosting' || row.type === 'events');
  }

  protected shouldShowActivityApproveAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'invitations';
  }

  protected shouldShowActivitySecondaryAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row);
  }

  protected shouldShowActivityRestoreAction(row: AppTypes.ActivityListRow): boolean {
    return this.isActivityRowTrashed(row);
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
    return 'block';
  }

  protected activitySecondaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events')  { return 'Leave Event'; }
    if (row.type === 'hosting') { return 'Delete Event'; }
    return 'Reject Invitation';
  }

  protected onActivityEventInfoCardMenuAction(row: AppTypes.ActivityListRow, action: InfoCardMenuActionEvent): void {
    switch (action.action.id as ActivityInfoCardActionId) {
      case 'publish':
        this.runActivityItemPublishAction(row);
        break;
      case 'primary':
        this.runActivityItemPrimaryAction(row);
        break;
      case 'view':
        this.runActivityItemViewAction(row);
        break;
      case 'approve':
        this.runActivityItemApproveAction(row);
        break;
      case 'secondary':
        this.runActivityItemSecondaryAction(row);
        break;
      case 'restore':
        this.runActivityItemRestoreAction(row);
        break;
    }
  }

  protected runActivityItemPrimaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, false);
  }

  protected runActivityItemViewAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  protected runActivityItemApproveAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, true);
  }

  protected runActivityItemRestoreAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.restoreActivityRow(row);
    this.cdr.markForCheck();
  }

  protected runActivityItemSecondaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.pendingActivityAction    = this.resolvePendingActivityAction(row);
    this.pendingActivityDeleteRow = row;
  }

  protected runActivityItemPublishAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu  = null;
    this.pendingActivityPublishRow = row;
  }

  protected cancelActivityDelete(): void {
    this.pendingActivityDeleteRow = null;
  }

  protected confirmActivityDelete(): void {
    const row = this.pendingActivityDeleteRow;
    this.pendingActivityDeleteRow = null;
    if (!row) {
      return;
    }
    this.trashActivityRow(row);
    this.reloadActivitiesSmartListData();
    this.cdr.markForCheck();
  }

  protected pendingActivityConfirmTitle(): string {
    if (this.pendingActivityAction === 'exit') { return 'Leave event?'; }
    if (this.pendingActivityAction === 'reject') { return 'Reject invitation?'; }
    return 'Delete event?';
  }

  protected pendingActivityDeleteLabel(): string {
    return this.pendingActivityDeleteRow?.title ?? '';
  }

  protected pendingActivityConfirmActionLabel(): string {
    if (this.pendingActivityAction === 'exit') { return 'Leave'; }
    if (this.pendingActivityAction === 'reject') { return 'Reject'; }
    return 'Delete';
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

  private resolvePendingActivityAction(row: AppTypes.ActivityListRow): PendingActivityAction {
    if (row.type === 'events') {
      return 'exit';
    }
    if (row.type === 'invitations') {
      return 'reject';
    }
    return 'delete';
  }

  private isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean {
    return Boolean(this.trashedActivityRowsByKey[`${type}:${id}`]);
  }

  protected isActivityRowTrashed(row: AppTypes.ActivityListRow): boolean {
    if (Boolean((row.source as { isTrashed?: boolean }).isTrashed)) {
      return true;
    }
    return this.isActivityIdentityTrashed(row.type, row.id);
  }

  private trashedActivityRows(): AppTypes.ActivityListRow[] {
    return Object.values(this.trashedActivityRowsByKey);
  }

  private trashedActivityCount(): number {
    return this.trashedActivityRows().length;
  }

  private trashActivityRow(row: AppTypes.ActivityListRow): void {
    this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = { ...row };
    if (row.type === 'events' || row.type === 'hosting' || row.type === 'invitations') {
      void this.eventsService.trashItem(this.activeUser.id, row.type, row.id);
    }
    this.refreshSectionBadges();
  }

  private restoreActivityRow(row: AppTypes.ActivityListRow): void {
    delete this.trashedActivityRowsByKey[this.activityRowIdentity(row)];
    if (row.type === 'events' || row.type === 'hosting' || row.type === 'invitations') {
      void this.eventsService.restoreItem(this.activeUser.id, row.type, row.id);
    }
    this.refreshSectionBadges();
    this.reloadActivitiesSmartListData();
  }

  private reloadActivitiesSmartListData(): void {
    this.activitiesSmartList?.reload();
    this.cdr.markForCheck();
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
    this.activitiesContext.requestActivitiesNavigation({
      type: 'members',
      ownerId: row.id
    });
  }

  protected canShowActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
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
    this.persistSelectedActivityMembers();
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

  // ── Rates editor state ────────────────────────────────────────────────────

  protected openActivityRateEditor(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
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
    this.cancelActivityRateEditorLiftAnimation();
    this.runAfterActivitiesNextPaint(() => {
      if (!this.isActivityRateEditorOpen() || this.selectedActivityRateId !== row.id) {
        return;
      }
      this.smoothRevealSelectedRateRowWhenNeeded(row.id);
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

  protected shouldRenderActivityRateEditorDock(): boolean {
    if (this.isCalendarLayoutView() || this.activitiesPrimaryFilter !== 'rates') {
      return false;
    }
    if (!this.isRatesFullscreenModeActive()) {
      return true;
    }
    if (this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
      return false;
    }
    return this.currentActivitiesRatesFullscreenRow() !== null;
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

  protected activityRateEditorSpacerHeight(): string | null {
    if (this.activitiesPrimaryFilter !== 'rates' || this.isCalendarLayoutView() || this.isRatesFullscreenModeActive()) {
      return null;
    }
    return this.isActivityRateEditorDockVisible()
      ? 'calc(5.2rem + env(safe-area-inset-bottom))'
      : '0px';
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

  protected selectedActivityRateBarLabel(): string | null {
    if (this.isRatesFullscreenModeActive()) {
      return null;
    }
    return `Rate · ${this.selectedActivityRateModeLabel()} · ${this.selectedActivityRateTitle()}`;
  }

  protected selectedActivityRateValue(): number {
    const row = this.isRatesFullscreenModeActive()
      ? this.currentActivitiesRatesFullscreenRow()
      : this.selectedActivityRateRow();
    return row ? this.activityOwnRatingValue(row) : 0;
  }

  protected activityRateBarConfig(): RatingStarBarConfig {
    return {
      scale: this.activityRatingScale,
      readonly: this.isSelectedActivityRateReadOnly(),
      label: this.selectedActivityRateBarLabel(),
      dock: {
        enabled: !this.isRatesFullscreenModeActive(),
        state: this.isActivityRateEditorClosing()
          ? 'closing'
          : this.isActivityRateEditorOpen()
            ? 'open'
            : 'hidden'
      }
    };
  }

  protected get activitiesRateSmartListItemTemplate(): TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | null {
    return this.activitiesRateFilter.startsWith('pair')
      ? (this.activitiesRatePairSmartListItemTemplateRef ?? null)
      : (this.activitiesRateSingleSmartListItemTemplateRef ?? null);
  }

  protected get activitiesActiveSmartListItemTemplate(): TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityListRow, ActivitiesSmartListFilters>> | null {
    if (this.activitiesPrimaryFilter === 'rates') {
      return this.activitiesRateSmartListItemTemplate;
    }
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatSmartListItemTemplateRef ?? null;
    }
    return this.activitiesEventSmartListItemTemplateRef ?? null;
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
    this.triggerActivityRateBlinks(row.id);
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
    this.cancelActivityRateEditorLiftAnimation();
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
      this.animateActivityRateEditorScrollTo(scrollElement, targetTop, () => {
        scrollElement.style.scrollSnapType = previousInlineSnapType;
      });
    });
  }

  private cancelActivityRateEditorCloseTransition(): void {
    if (this.activityRateEditorCloseTimer) {
      clearTimeout(this.activityRateEditorCloseTimer);
      this.activityRateEditorCloseTimer = null;
    }
  }

  private cancelActivityRateEditorLiftAnimation(): void {
    if (this.activityRateEditorLiftAnimationFrame !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.activityRateEditorLiftAnimationFrame);
    }
    this.activityRateEditorLiftAnimationFrame = null;
  }

  private maybeDismissActivityRateEditor(target: Element): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    if (
      target.closest('[data-rating-star-bar-dock]')
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

  private runAfterActivitiesNextPaint(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(task);
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
    const dock = this.activitiesSmartList?.paginationHostElement() ?? null;
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowBottom = (sameRowCards.length > 0 ? sameRowCards : [targetRow]).reduce((maxBottom, card) => {
      return Math.max(maxBottom, card.getBoundingClientRect().bottom);
    }, targetRow.getBoundingClientRect().bottom);
    const dockHeight = Math.max(72, dock?.offsetHeight ?? 72);
    const dockTop = scrollRect.bottom - dockHeight;
    const breathingRoom = this.isMobileView ? 6 : 8;
    const revealBottom = dockTop - breathingRoom;
    if (rowBottom <= revealBottom) {
      if (!Number.isFinite(this.activityRateEditorOpenScrollTop as number)) {
        this.lastActivityRateEditorLiftDelta = 0;
      }
      return;
    }
    const delta = rowBottom - revealBottom;
    const startTop = scrollElement.scrollTop;
    const targetTop = startTop + delta;
    if (targetTop <= scrollElement.scrollTop + 0.5) {
      this.lastActivityRateEditorLiftDelta = 0;
      if (attempt < 1) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(rowId, attempt + 1), 120);
      }
      return;
    }
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    this.animateActivityRateEditorScrollTo(scrollElement, targetTop, () => {
      this.lastActivityRateEditorLiftDelta = Math.max(0, scrollElement.scrollTop - startTop);
      scrollElement.style.scrollSnapType = previousSnapType;
    });
  }

  private animateActivityRateEditorScrollTo(scrollElement: HTMLElement, targetTop: number, onComplete?: () => void): void {
    const startTop = scrollElement.scrollTop;
    const delta = targetTop - startTop;
    if (Math.abs(delta) <= 0.5) {
      scrollElement.scrollTop = targetTop;
      onComplete?.();
      return;
    }
    this.cancelActivityRateEditorLiftAnimation();
    if (typeof globalThis.requestAnimationFrame !== 'function' || typeof globalThis.performance === 'undefined') {
      scrollElement.scrollTop = targetTop;
      onComplete?.();
      return;
    }
    const startTime = globalThis.performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / this.activityRateEditorSlideDurationMs);
      scrollElement.scrollTop = startTop + (delta * this.activityRateEditorLiftEasedProgress(progress));
      if (progress < 1) {
        this.activityRateEditorLiftAnimationFrame = globalThis.requestAnimationFrame(step);
        return;
      }
      this.activityRateEditorLiftAnimationFrame = null;
      scrollElement.scrollTop = targetTop;
      onComplete?.();
    };
    step(startTime);
  }

  private activityRateEditorLiftEasedProgress(progress: number): number {
    return this.sampleCubicBezierYForX(AppUtils.clampNumber(progress, 0, 1), 0.22, 1, 0.36, 1);
  }

  private sampleCubicBezierYForX(x: number, x1: number, y1: number, x2: number, y2: number): number {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }

    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
    const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
    const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

    let t = x;
    for (let index = 0; index < 4; index += 1) {
      const currentX = sampleCurveX(t) - x;
      const derivative = sampleCurveDerivativeX(t);
      if (Math.abs(currentX) < 0.0001 || Math.abs(derivative) < 0.0001) {
        break;
      }
      t -= currentX / derivative;
    }

    let lowerBound = 0;
    let upperBound = 1;
    while (upperBound - lowerBound > 0.0001) {
      const currentX = sampleCurveX(t);
      if (Math.abs(currentX - x) < 0.0001) {
        break;
      }
      if (currentX > x) {
        upperBound = t;
      } else {
        lowerBound = t;
      }
      t = (lowerBound + upperBound) / 2;
    }

    return sampleCurveY(AppUtils.clampNumber(t, 0, 1));
  }

  protected activitySingleCard(
    row: AppTypes.ActivityListRow,
    options?: {
      groupLabel?: string | null;
      presentation?: SingleCardData['presentation'];
      state?: SingleCardData['state'];
    }
  ): SingleCardData {
    const presentation = options?.presentation ?? 'list';
    return buildSingleRateCardData({
      ...this.rateCardDataInput(row, options),
      badge: this.activityRateBadgeConfig(row, {
        layout: 'floating',
        interactive: presentation !== 'fullscreen',
        forceActive: presentation === 'fullscreen'
      })
    });
  }

  protected activityPairCard(
    row: AppTypes.ActivityListRow,
    options?: {
      groupLabel?: string | null;
      presentation?: PairCardData['presentation'];
      state?: PairCardData['state'];
    }
  ): PairCardData {
    const presentation = options?.presentation ?? 'list';
    return buildPairRateCardData({
      ...this.rateCardDataInput(row, options),
      badge: this.activityRateBadgeConfig(row, {
        layout: presentation === 'fullscreen' ? 'pair-overlap' : 'between',
        interactive: presentation !== 'fullscreen',
        forceActive: presentation === 'fullscreen'
      })
    });
  }

  protected isPairRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair';
  }

  protected isPairReceivedRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair' && this.displayedRateDirection(rate) === 'received';
  }

  private rateCardDataInput(
    row: AppTypes.ActivityListRow,
    options?: {
      groupLabel?: string | null;
      presentation?: SingleCardData['presentation'] | PairCardData['presentation'];
      state?: SingleCardData['state'] | PairCardData['state'];
    }
  ): RateCardDataInput {
    const item = row.source as RateMenuItem;
    const presentation = options?.presentation ?? 'list';
    const rateDisplay = row.rateDisplay;

    return {
      rowId: row.id,
      groupLabel: options?.groupLabel ?? null,
      title: row.title,
      distanceKm: row.distanceKm,
      mode: item.mode,
      direction: this.displayedRateDirection(item),
      eventName: item.eventName,
      happenedOnLabel: rateDisplay?.happenedOnLabel ?? 'Unknown',
      primaryUser: this.toRateCardPerson(rateDisplay?.primaryUser) ?? this.toRateCardPerson(this.resolveRatePrimaryUser(row)),
      pairUsers: this.rateCardPairUsers(row),
      availableUsers: this.users
        .map(user => this.toRateCardPerson(user))
        .filter((user): user is RateCardPerson => Boolean(user)),
      singleImageUrls: rateDisplay?.imageUrls?.length ? rateDisplay.imageUrls : undefined,
      pairSlots: this.rateCardPairSlots(row),
      fallbackGender: this.activeUser.gender,
      stackClasses: this.rateCardStackClasses(row),
      presentation,
      state: options?.state ?? 'default',
      fullscreenSplitEnabled: presentation === 'fullscreen'
        ? !this.activitiesSmartList?.isFullscreenPaginationAnimating()
        : false
    };
  }

  private rateCardStackClasses(row: AppTypes.ActivityListRow): string[] {
    const item = row.source as RateMenuItem;
    const directionClass = this.displayedRateDirection(item);
    return [
      item.mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
      `activities-rate-profile-stack-${directionClass}`
    ];
  }

  private rateCardPairSlots(row: AppTypes.ActivityListRow): PairCardData['slots'] | undefined {
    if (!row.rateDisplay?.pairSlots?.length) {
      return undefined;
    }
    return row.rateDisplay.pairSlots.map(slot => ({
      key: slot.key,
      label: slot.label,
      tone: slot.tone,
      slides: slot.slides.map(slide => ({ ...slide }))
    }));
  }

  private rateCardPairUsers(row: AppTypes.ActivityListRow): RateCardPerson[] {
    if (row.type !== 'rates') {
      return [];
    }
    const item = row.source as RateMenuItem;
    return [item.userId, item.secondaryUserId]
      .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
      .map(userId => this.users.find(user => user.id === userId) ?? null)
      .map(user => this.toRateCardPerson(user))
      .filter((user): user is RateCardPerson => Boolean(user));
  }

  private resolveRatePrimaryUser(row: AppTypes.ActivityListRow): DemoUser | null {
    if (row.type !== 'rates') {
      return null;
    }
    const item = row.source as RateMenuItem;
    return this.users.find(user => user.id === item.userId) ?? null;
  }

  private toRateCardPerson(
    user: AppTypes.ActivityRateDisplayUser | DemoUser | null | undefined
  ): RateCardPerson | null {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      name: user.name,
      age: user.age,
      city: user.city,
      gender: user.gender
    };
  }

  // ── Rate badge ─────────────────────────────────────────────────────────────

  protected activityRateBadgeLabel(row: AppTypes.ActivityListRow): string {
    const ownLabel = this.activityOwnRatingLabel(row);
    return ownLabel ? ownLabel : 'Rate';
  }

  protected activityRateBadgeAriaLabel(row: AppTypes.ActivityListRow): string {
    if (this.isPairReceivedRateRow(row)) {
      return 'Received pair rating';
    }
    return this.isActivityRatePending(row) ? 'Add your rating' : 'Edit your rating';
  }

  protected activityRateBadgeConfig(
    row: AppTypes.ActivityListRow,
    options?: {
      layout?: CardBadgeConfig['layout'];
      interactive?: boolean;
      forceActive?: boolean;
    }
  ): CardBadgeConfig {
    return {
      label: this.activityRateBadgeLabel(row),
      ariaLabel: this.activityRateBadgeAriaLabel(row),
      active: options?.forceActive ? true : this.isSelectedActivityRateRow(row),
      pending: this.isActivityRatePending(row),
      disabled: this.isPairReceivedRateRow(row),
      blink: this.isActivityRateBlinking(row),
      interactive: options?.interactive ?? true,
      layout: options?.layout ?? 'floating'
    };
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
    delete this.activityRateBlinkUntilByRowId[rowId];
    this.cdr.markForCheck();

    const startBlink = () => {
      this.activityRateBlinkUntilByRowId[rowId] = Date.now() + durationMs;
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
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }

  // ── Rates fullscreen state ────────────────────────────────────────────────

  protected isActivitiesRatesFullscreenReadOnlyNavigation(): boolean {
    return this.isRatesFullscreenModeActive() && this.activitiesRateFilter === 'pair-received';
  }

  protected currentActivitiesRatesFullscreenRow(): AppTypes.ActivityListRow | null {
    if (!this.isRatesFullscreenModeActive()) {
      return null;
    }
    const smartListRow = this.activitiesSmartList?.cursorItem();
    if (smartListRow?.type === 'rates') {
      return smartListRow;
    }
    return null;
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
    this.resetActivityRateEditorStateForFullscreenEntry();
    this.activitiesRatesFullscreenMode = true;
    this.activitiesContext.setActivitiesRatesFullscreenMode(true);
    this.runAfterActivitiesRender(() => {
      this.syncActivitiesRatesFullscreenSelection();
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  private disableActivitiesRatesFullscreenMode(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const selectedRateId = this.selectedActivityRateId;
    this.activitiesRatesFullscreenMode = false;
    this.activityRateEditorClosing = false;
    this.lastActivityRateEditorLiftDelta = 0;
    this.lastRateIndicatorPulseRowId = null;
    this.activitiesContext.setActivitiesRatesFullscreenMode(false);
    this.activitiesContext.setActivitiesSelectedRateId(this.selectedActivityRateId);
    this.cdr.markForCheck();
    if (!selectedRateId) {
      return;
    }
    this.runAfterActivitiesRender(() => {
      this.syncActivitiesRatesListPositionToRow(selectedRateId);
      this.smoothRevealSelectedRateRowWhenNeeded(selectedRateId);
    });
  }

  private syncActivitiesRatesFullscreenSelection(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const currentRow = this.currentActivitiesRatesFullscreenRow();
    if (!currentRow) {
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      return;
    }
    this.selectedActivityRateId = currentRow.id;
    this.activitiesContext.setActivitiesSelectedRateId(this.selectedActivityRateId);
  }

  private resetActivityRateEditorStateForFullscreenEntry(): void {
    this.cancelActivityRateEditorCloseTransition();
    this.cancelActivityRateEditorLiftAnimation();
    this.activityRateEditorClosing = false;
    this.activityRateEditorOpenScrollTop = null;
    this.lastActivityRateEditorLiftDelta = 0;
    this.lastRateIndicatorPulseRowId = null;
    if (!this.selectedActivityRateId) {
      return;
    }
    this.selectedActivityRateId = null;
    this.activitiesContext.setActivitiesSelectedRateId(null);
  }

  private syncActivitiesRatesListPositionToRow(rowId: string): void {
    const scrollElement = this.activitiesListScrollElement();
    if (!scrollElement) {
      return;
    }
    const targetRow = scrollElement.querySelector<HTMLElement>(`[data-activity-rate-row-id="${rowId}"]`);
    if (!targetRow) {
      return;
    }
    const stickyHeaderHeight = scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0;
    const targetTop = Math.max(0, targetRow.offsetTop - stickyHeaderHeight - (this.isMobileView ? 4 : 6));
    if (Math.abs(scrollElement.scrollTop - targetTop) <= 1) {
      return;
    }
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    scrollElement.scrollTop = targetTop;
    const releaseSnap = () => {
      scrollElement.style.scrollSnapType = previousSnapType;
      this.cdr.markForCheck();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => releaseSnap());
      return;
    }
    setTimeout(releaseSnap, 0);
  }

  // =========================================================================
  // Calendar – SmartList config helpers
  // =========================================================================

  protected calendarBadgeToneClass(row: AppTypes.ActivityListRow): string {
    const paletteSize = 8;
    const toneIndex = (AppDemoGenerators.hashText(row.id) % paletteSize) + 1;
    return `calendar-badge-tone-${toneIndex}`;
  }

  // =========================================================================
  // SmartList state reset
  // =========================================================================

  private resetActivitiesScroll(): void {
    this.activitiesSmartList?.clearHostedLoading();
    this.visibleActivityRows = [];
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

  private refreshRateItems(): void {
    this.rateItems = this.ratesService.peekRateItemsByUser(this.activeUser.id);
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
      this.samePairUsers(candidate, item) &&
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

  private samePairUsers(left: RateMenuItem, right: RateMenuItem): boolean {
    const leftIds = [left.userId, left.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
    const rightIds = [right.userId, right.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
    return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
  }

  private openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void {
    const source = this.resolveActivityEventEditorSource(row);
    if (!source) {
      return;
    }
    const effectiveReadOnly = row.type === 'invitations'
      ? true
      : readOnly || (row.type === 'events' && row.isAdmin !== true);
    if (effectiveReadOnly) {
      this.eventEditorService.openView(source);
      return;
    }
    this.eventEditorService.openEdit(source);
  }

  private resolveActivityEventEditorSource(row: AppTypes.ActivityListRow): EventMenuItem | HostingMenuItem | null {
    if (row.type === 'invitations') {
      const invitationSource = row.source as InvitationMenuItem;
      const invitation = this.invitationItems.find(item => item.id === invitationSource.id) ?? invitationSource;
      return this.resolveRelatedEventFromInvitation(invitation) ?? this.buildInvitationPreviewEventSource(invitation);
    }
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    const rowSource = row.source as EventMenuItem | HostingMenuItem;
    const rowSourceId = typeof rowSource?.id === 'string' ? rowSource.id.trim() : '';
    let source = rowSourceId
      ? (this.eventItems.find(item => item.id === rowSourceId)
        ?? this.hostingItems.find(item => item.id === rowSourceId)
        ?? null)
      : null;
    if (!source && typeof rowSource?.title === 'string' && rowSource.title.trim()) {
      const titleKey = AppUtils.normalizeText(rowSource.title);
      source = this.eventItems.find(item => AppUtils.normalizeText(item.title) === titleKey)
        ?? this.hostingItems.find(item => AppUtils.normalizeText(item.title) === titleKey)
        ?? null;
    }
    return source ?? rowSource;
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
    this.activityPendingMembersById[sync.id] = pendingMembers;

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

    const eventMembers = this.buildSyncedActivityMembersForRow(eventRow, acceptedMembers, pendingMembers);
    const hostingMembers = this.buildSyncedActivityMembersForRow(hostingRow, acceptedMembers, pendingMembers);
    const summary = this.buildActivityMembersSummary(
      { ownerType: 'event', ownerId: sync.id },
      eventMembers,
      capacityTotal
    );
    this.applyActivityMembersSummary(eventRow, summary);

    const eventRowKey = `${eventRow.type}:${eventRow.id}`;
    const hostingRowKey = `${hostingRow.type}:${hostingRow.id}`;
    this.activityMembersByRowId[eventRowKey] = eventMembers;
    this.activityMembersByRowId[hostingRowKey] = hostingMembers;
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

  private syncActivitiesSmartListQuery(): void {
    const nextFilters: Record<string, unknown> = {
      primaryFilter: this.activitiesPrimaryFilter,
      eventScopeFilter: this.activitiesEventScope,
      secondaryFilter: this.activitiesSecondaryFilter,
      chatContextFilter: this.activitiesChatContextFilter,
      hostingPublicationFilter: this.hostingPublicationFilter,
      rateFilter: this.activitiesRateFilter
    };
    const currentFilters = this.activitiesSmartListQuery.filters ?? {};
    if (
      currentFilters['primaryFilter'] === nextFilters['primaryFilter']
      && currentFilters['eventScopeFilter'] === nextFilters['eventScopeFilter']
      && currentFilters['secondaryFilter'] === nextFilters['secondaryFilter']
      && currentFilters['chatContextFilter'] === nextFilters['chatContextFilter']
      && currentFilters['hostingPublicationFilter'] === nextFilters['hostingPublicationFilter']
      && currentFilters['rateFilter'] === nextFilters['rateFilter']
    ) {
      return;
    }
    this.activitiesSmartListQuery = {
      filters: nextFilters as ActivitiesSmartListFilters
    };
  }

  protected onActivitiesSmartListItemSelect(event: SmartListItemSelectEvent<AppTypes.ActivityListRow, ActivitiesSmartListFilters>): void {
    this.onActivityRowClick(event.item);
  }

  protected onActivitiesSmartListStateChange(change: SmartListStateChange<AppTypes.ActivityListRow, ActivitiesSmartListFilters>): void {
    this.visibleActivityRows = [...change.items];
    this.activitiesInitialLoadPending = change.initialLoading;
    this.activitiesListScrollable = change.scrollable;
    this.activitiesStickyValue = change.stickyLabel;
    this.activitiesContext.setActivitiesStickyValue(change.stickyLabel);
    if (this.isRatesFullscreenModeActive()) {
      this.syncActivitiesRatesFullscreenSelection();
    }
    this.cdr.markForCheck();
  }

  private async loadActivitiesFeedPage(
    query: ListQuery<ActivitiesSmartListFilters>
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const primaryFilter = (query.filters?.primaryFilter ?? 'chats') as AppTypes.ActivitiesPrimaryFilter;
    if (primaryFilter !== 'chats') {
      return this.activitiesFeedService.loadActivities(query);
    }

    const secondaryFilter = query.filters?.secondaryFilter === 'relevant' || query.filters?.secondaryFilter === 'past'
      ? query.filters.secondaryFilter
      : 'recent';
    const chatContextFilter = query.filters?.chatContextFilter === 'event'
      || query.filters?.chatContextFilter === 'subEvent'
      || query.filters?.chatContextFilter === 'group'
      ? query.filters.chatContextFilter
      : 'all';
    const view = query.view === 'distance' ? 'distance' : 'day';

    const rows = this.chatItemsForActivities()
      .filter(item => chatContextFilter === 'all' ? true : this.activityChatContextFilterKey(item) === chatContextFilter)
      .map(item => this.chatToActivityRow(item));
    const sorted = this.sortChatRowsForSmartList(rows, secondaryFilter, view);
    const startIndex = Math.max(0, Math.trunc(query.page)) * Math.max(1, Math.trunc(query.pageSize));
    return {
      items: sorted.slice(startIndex, startIndex + Math.max(1, Math.trunc(query.pageSize))),
      total: sorted.length
    };
  }

  private sortChatRowsForSmartList(
    rows: readonly AppTypes.ActivityListRow[],
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
    view: AppTypes.ActivitiesView
  ): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (view === 'distance') {
      return sorted.sort((left, right) => {
        const leftMeters = Number.isFinite(left.distanceMetersExact)
          ? Math.max(0, Math.trunc(Number(left.distanceMetersExact)))
          : Math.max(0, Math.round((Number(left.distanceKm) || 0) * 1000));
        const rightMeters = Number.isFinite(right.distanceMetersExact)
          ? Math.max(0, Math.trunc(Number(right.distanceMetersExact)))
          : Math.max(0, Math.round((Number(right.distanceKm) || 0) * 1000));
        return leftMeters - rightMeters;
      });
    }
    if (secondaryFilter === 'past') {
      return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
    }
    if (secondaryFilter === 'relevant') {
      return sorted.sort((left, right) =>
        right.metricScore - left.metricScore
        || AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso)
      );
    }
    return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
  }

  private activityRowIdentity(row: AppTypes.ActivityListRow): string {
    return `${row.type}:${row.id}`;
  }

  private activitiesListScrollElement(): HTMLDivElement | null {
    return this.activitiesSmartList?.scrollElement() ?? this.activitiesScrollRef?.nativeElement ?? null;
  }
}
