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
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import type {
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem,
  RateMenuItem
} from '../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../shared/core/base/interfaces/user.interface';
import { AppUtils } from '../../../shared/app-utils';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesFeedFilters,
  ActivitiesEventSyncPayload
} from '../../../shared/core/base/models';
import type * as AppTypes from '../../../shared/core/base/models';
import {
  CounterBadgePipe,
  EventCheckoutPopupComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListItemSelectEvent,
  type SmartListPresentation,
  type SmartListStateChange
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { EventCheckoutDialogService } from '../../../shared/ui/services/event-checkout-dialog.service';
import { EventCheckoutDraftService, type EventCheckoutDraft } from '../../../shared/ui/services/event-checkout-draft.service';
import { EventChatPopupComponent } from '../event-chat-popup/event-chat-popup.component';
import { EventExplorePopupComponent } from '../event-explore-popup/event-explore-popup.component';
import { ActivitiesPopupToolbarController } from './activities-popup-toolbar.controller';
import {
  ActivitiesChatTemplateComponent,
  ActivitiesChatsController,
  type ActivitiesChatTemplateContext
} from './templates/chat/activities-chat-template.component';
import {
  ActivitiesEventTemplateComponent,
  ActivitiesEventsController,
  type ActivitiesEventTemplateContext
} from './templates/event/activities-event-template.component';
import {
  ActivitiesRateTemplateComponent,
  ActivitiesRatesController,
  type ActivitiesRateTemplateContext
} from './templates/rate/activities-rate-template.component';
import {
  ActivityEventBuilder,
  ActivityMembersBuilder,
  ActivitiesService,
  ActivityMembersService,
  ActivityResourcesService,
  AppContext,
  AppPopupContext,
  ChatsService,
  EventsService,
  RatesService,
  toActivityChatRow,
  UsersService,
  type ActivityMembersSyncState
} from '../../../shared/core';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  toActivityEventRow,
  toActivityEventRowFromMenuItem,
  toActivityHostingRowFromMenuItem,
  toActivityInvitationRowFromMenuItem
} from '../../../shared/core/base/converters/activities-event.converter';
import { DemoUserMenuCountersBuilder } from '../../../shared/core/demo/builders';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';

// ---------------------------------------------------------------------------

type ActivitiesSmartListFilters = ActivitiesFeedFilters;

interface ActivitiesEventScopeOption {
  key: AppTypes.ActivitiesEventScope;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    SmartListComponent,
    ActivitiesEventTemplateComponent,
    ActivitiesChatTemplateComponent,
    ActivitiesRateTemplateComponent,
    EventChatPopupComponent,
    EventCheckoutPopupComponent,
    EventExplorePopupComponent,
    CounterBadgePipe
  ],
  templateUrl: './activities-popup.component.html',
  styleUrl: './activities-popup.component.scss',
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
  protected readonly appCtx = inject(AppContext);
  protected readonly popupCtx = inject(AppPopupContext);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly usersService = inject(UsersService);
  protected readonly confirmationDialogService = inject(ConfirmationDialogService);
  protected readonly eventCheckoutDialogService = inject(EventCheckoutDialogService);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
  readonly activitiesRates = new ActivitiesRatesController({
    getUsers: () => this.users,
    getActiveUserGender: () => this.activeUser.gender,
    getActivitiesPrimaryFilter: () => this.activitiesPrimaryFilter,
    getActivitiesRateFilter: () => this.activitiesRateFilter,
    getActivitiesRateSocialBadgeEnabled: () => this.activitiesRateSocialBadgeEnabled,
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
  protected readonly activitiesChatTemplateContext: ActivitiesChatTemplateContext = {
    getActiveUserInitials: () => this.activeUser.initials,
    getChatLastSender: (chat) => this.activitiesChats.getChatLastSender(chat),
    getChatMemberCount: (chat) => this.activitiesChats.getChatMemberCount(chat),
    getChatChannelType: (chat) => this.activitiesChats.chatChannelType(chat)
  };
  protected readonly activitiesEventTemplateContext: ActivitiesEventTemplateContext = {
    getActivityRowIdentity: (row) => this.activityRowIdentity(row),
    getActivityImageUrl: (row) => this.activityImageUrl(row),
    getActivityCalendarDateRange: (row) => this.activityCalendarDateRange(row),
    isActivityDraft: (row) => this.isActivityDraft(row),
    isPendingActivityRow: (row) => this.activitiesEvents.isPendingActivityRow(row),
    isActivityFull: (row) => this.isActivityFull(row),
    getActivityLeadingIcon: (row) => this.activitiesEvents.activityLeadingIcon(row),
    getActivityLeadingIconTone: (row) => this.activitiesEvents.activityLeadingIconTone(row),
    shouldShowActivitySourceIcon: (row) => this.showActivitySourceIcon(row),
    getActivitySourceAvatarTone: (row) => this.activitySourceAvatarTone(row),
    getActivitySourceAvatarLabel: (row) => this.activitySourceAvatarLabel(row),
    getActivityCapacityLabel: (row) => this.activityCapacityLabel(row),
    getActivityPendingMemberCount: (row) => this.activityPendingMemberCount(row),
    getActivityEventInfoCardMenuActions: (row) => this.activitiesEvents.activityEventInfoCardMenuActions(row)
  };
  // ── Self-contained data state (no host inputs) ───────────────────────────
  protected isMobileView = false;
  protected get users(): DemoUser[] {
    return this.usersService.peekCachedUsers() as DemoUser[];
  }
  protected activeUser: DemoUser = (this.appCtx.activeUserProfile() as DemoUser | null)
    ?? this.users[0]
    ?? this.createFallbackActiveUser();

  protected chatItems: ChatMenuItem[] = [];
  protected eventItems: EventMenuItem[] = [];
  protected hostingItems: HostingMenuItem[] = [];
  protected invitationItems: InvitationMenuItem[] = [];
  protected rateItems: RateMenuItem[] = [];

  protected chatBadge = this.activeUser.activities.chat;
  protected eventsBadge = this.activeUser.activities.events;
  protected pendingBadge = 0;
  protected hostingBadge = this.activeUser.activities.hosting;
  protected invitationsBadge = this.activeUser.activities.invitations;
  protected gameBadge = this.activeUser.activities.game;

  protected publishedHostingIds: ReadonlySet<string> = new Set<string>();

  protected activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange> = {};

  protected eventDatesById: Record<string, string> = {};
  protected hostingDatesById: Record<string, string> = {};

  protected eventDistanceById: Record<string, number> = {};
  protected hostingDistanceById: Record<string, number> = {};
  protected readonly activityImageById: Record<string, string> = {};
  protected readonly activityCapacityById: Record<string, string> = {};
  protected readonly activityPendingMembersById: Record<string, number> = {};
  protected readonly eventVisibilityById: Record<string, AppTypes.EventVisibility> = {};
  private readonly eventCapacityById: Record<string, AppTypes.EventCapacityRange> = {};
  protected readonly eventSubEventsById: Record<string, AppTypes.SubEventFormItem[]> = {};
  private lastPendingCheckoutDraftSourceIds = new Set<string>();
  protected readonly activityMembersByRowId: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  protected activitiesEventCardRevision = 0;
  protected activitiesRateCardRevision = 0;
  protected readonly activityRateCardRevisionByRowId: Record<string, number> = {};
  protected readonly leavingActivityRowIds = new Set<string>();
  protected readonly activityRowExitAnimationMs = 180;
  private lastAppliedActivityMembersUpdatedMs = 0;

  protected get assetCards(): AppTypes.AssetCard[] {
    return this.ownedAssets.assetCards;
  }
  // ── ViewChild refs ────────────────────────────────────────────────────────
  @ViewChild('activitiesScroll')
  private activitiesScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('activitiesSmartList')
  protected activitiesSmartList?: SmartListComponent<AppTypes.ActivityListRow, ActivitiesSmartListFilters>;

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
    { key: 'pending', label: 'Pending', icon: 'pending_actions' },
    { key: 'invitations', label: 'Invitations', icon: 'mail' },
    { key: 'my-events', label: 'My Events', icon: 'stadium' },
    { key: 'drafts', label: 'Drafts', icon: 'drafts' },
    { key: 'trash', label: 'Trash', icon: 'delete' }
  ];
  protected readonly activitiesSecondaryFilters: Array<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesSecondaryFilters];
  protected readonly activitiesChatContextFilters: Array<{ key: AppTypes.ActivitiesChatContextFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesChatContextFilters];
  protected readonly rateFilters: Array<{ key: AppTypes.RateFilterKey; label: string }>
    = [...APP_STATIC_DATA.rateFilters];
  protected readonly rateFilterEntries: AppTypes.RateFilterEntry[]
    = [...APP_STATIC_DATA.rateFilterEntries];
  protected readonly activitiesViewOptions: Array<{ key: AppTypes.ActivitiesView; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesViewOptions];
  protected activitiesRateSocialBadgeEnabled = false;

  // ── Filter / view state – backed by EventEditorPopupStateService signals ───────────
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
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/chats'),
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
    }
  };
  protected readonly activitiesSmartListLoadPage: SmartListLoadPage<AppTypes.ActivityListRow, ActivitiesSmartListFilters>
    = query => from(this.loadActivitiesSmartListPage(query));
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
  protected readonly activityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  protected readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};

  protected lastRateIndicatorPulseRowId: string | null = null;

  // ── Rates fullscreen state ────────────────────────────────────────────────
  protected activitiesRatesFullscreenMode         = false;

  // ── Delete / publish confirms ─────────────────────────────────────────────
  protected stackedActivitiesPopup: 'activityMembers' | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected pendingActivityMemberDelete: AppTypes.ActivityMemberEntry | null = null;
  protected selectedActivityMembers: AppTypes.ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRow: AppTypes.ActivityListRow | null = null;
  protected selectedActivityMembersRowId: string | null = null;
  protected readonly trashedActivityRowsByKey: Record<string, AppTypes.ActivityListRow> = {};

  protected activityLeadingIcon(row: AppTypes.ActivityListRow): string {
    return this.activitiesEvents.activityLeadingIcon(row);
  }

  protected activityLeadingIconTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    return this.activitiesEvents.activityLeadingIconTone(row);
  }

  protected isPendingActivityRow(row: AppTypes.ActivityListRow): boolean {
    return this.activitiesEvents.isPendingActivityRow(row);
  }

  protected activityEventInfoCardMenuActions(row: AppTypes.ActivityListRow): readonly InfoCardMenuAction[] {
    return this.activitiesEvents.activityEventInfoCardMenuActions(row);
  }

  protected getChatLastSender(item: ChatMenuItem): DemoUser {
    return this.activitiesChats.getChatLastSender(item);
  }

  protected getChatMemberCount(item: ChatMenuItem): number {
    return this.activitiesChats.getChatMemberCount(item);
  }

  protected chatChannelType(item: ChatMenuItem): AppTypes.ChatChannelType {
    return this.activitiesChats.chatChannelType(item);
  }

  protected chatItemsForActivities(): ChatMenuItem[] {
    return this.activitiesChats.chatItemsForActivities();
  }

  protected activityChatContextFilterKey(item: ChatMenuItem): AppTypes.ActivitiesChatContextFilter | null {
    return this.activitiesChats.activityChatContextFilterKey(item);
  }

  protected openActivityChat(chat: ChatMenuItem): void {
    this.activitiesChats.openActivityChat(chat);
  }

  protected onActivityRowClick(row: AppTypes.ActivityListRow, event?: Event): void {
    this.activitiesEvents.onActivityRowClick(row, event);
  }

  protected openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
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

  protected onActivityEventInfoCardMenuAction(row: AppTypes.ActivityListRow, action: InfoCardMenuActionEvent): void {
    this.activitiesEvents.onActivityEventInfoCardMenuAction(row, action);
  }

  protected isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean {
    return this.activitiesEvents.isActivityIdentityTrashed(type, id);
  }

  protected trashedActivityCount(): number {
    return this.activitiesEvents.trashedActivityCount();
  }

  protected openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void {
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
      this.activitiesPrimaryFilter       = svc.activitiesPrimaryFilter() as AppTypes.ActivitiesPrimaryFilter;
      this.activitiesEventScope         = svc.activitiesEventScope() as AppTypes.ActivitiesEventScope;
      this.activitiesChatContextFilter   = svc.activitiesChatContextFilter() as AppTypes.ActivitiesChatContextFilter;
      this.activitiesSecondaryFilter     = svc.activitiesSecondaryFilter() as AppTypes.ActivitiesSecondaryFilter;
      this.hostingPublicationFilter      = svc.activitiesHostingPublicationFilter() as AppTypes.HostingPublicationFilter;
      this.activitiesRateFilter          = svc.activitiesRateFilter() as AppTypes.RateFilterKey;
      this.activitiesRateSocialBadgeEnabled = svc.activitiesRateSocialBadgeEnabled();
      this.activitiesView                = svc.activitiesView() as AppTypes.ActivitiesView;
      this.activitiesSmartListConfig.loadingDelayMs = this.resolveActivitiesLoadingDelayMs();
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
      const nextActiveUser = (this.appCtx.activeUserProfile() as DemoUser | null)
        ?? this.users.find(user => user.id === activeUserId)
        ?? this.users[0]
        ?? this.createFallbackActiveUser();
      this.activeUser = nextActiveUser;
      this.bumpActivitiesEventCardRevision();
      this.refreshSectionBadges();
      this.cdr.markForCheck();
    });

    effect(() => {
      const session = this.activitiesContext.eventChatSession();
      if (!session) {
        return;
      }
      this.syncChatItemFromOpenSession(session.item);
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
      const sync = this.activitiesContext.activitiesEventSync();
      if (!sync) {
        return;
      }
      this.applyActivitiesEventSync(sync);
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
    this.seedEventOwnerMemberCountsFromEventsTable();
  }

  private resetActivitiesStateForOpen(): void {
    this.inlineItemActionMenu = null;
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
    this.activitiesRates.clearEditorState();
    this.activitiesSmartList?.clearHostedLoading();
  }

  private createFallbackActiveUser(): DemoUser {
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
      this.activeUser = (this.appCtx.activeUserProfile() as DemoUser | null)
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
    this.seedEventOwnerMemberCountsFromEventsTable();
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
          nextItems = this.sortChatMenuItems(nextItems);
        } else {
          const activeSessionRecord = {
            ...this.cloneChatMenuItem(activeSessionChat),
            ownerUserId: userId,
            messages: undefined
          };
          nextItems = this.sortChatMenuItems([
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

  private syncChatItemFromOpenSession(chat: ChatMenuItem): void {
    const currentIndex = this.chatItems.findIndex(item => item.id === chat.id);
    if (currentIndex < 0) {
      const nextChat = this.cloneChatMenuItem(chat);
      this.chatItems = this.sortChatMenuItems([...this.chatItems, nextChat]);
      this.refreshSectionBadges();
      this.syncVisibleChatRow(nextChat);
      this.cdr.markForCheck();
      return;
    }
    const nextChat = this.cloneChatMenuItem(chat);
    const currentChat = this.chatItems[currentIndex];
    if (this.areChatMenuItemsEqual(currentChat, nextChat)) {
      return;
    }
    const nextItems = [...this.chatItems];
    nextItems[currentIndex] = nextChat;
    this.chatItems = this.sortChatMenuItems(nextItems);
    this.refreshSectionBadges();
    this.syncVisibleChatRow(nextChat);
    this.cdr.markForCheck();
  }

  private syncVisibleChatRow(chat: ChatMenuItem): void {
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

  private doesChatMatchActiveContextFilter(chat: ChatMenuItem): boolean {
    if (this.activitiesChatContextFilter === 'all') {
      return true;
    }
    return this.activitiesChats.activityChatContextFilterKey(chat) === this.activitiesChatContextFilter;
  }

  private buildActivityChatRow(chat: ChatMenuItem): AppTypes.ActivityListRow {
    return toActivityChatRow(chat, {
      users: this.users,
      activeUserId: this.activeUser.id
    });
  }

  private sortChatMenuItems<T extends ChatMenuItem>(items: readonly T[]): T[] {
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

  private sortVisibleChatRows(items: readonly AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
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

  private chatMenuMetricScore(chat: ChatMenuItem): number {
    const unread = Math.max(0, Math.trunc(Number(chat.unread) || 0));
    return unread * 10 + this.activitiesChats.getChatMemberCount(chat);
  }

  private chatRowMetricScore(row: AppTypes.ActivityListRow): number {
    return this.chatMenuMetricScore(row.source as ChatMenuItem);
  }

  private cloneChatMenuItem<T extends ChatMenuItem>(chat: T): T {
    return {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])]
    } as T;
  }

  private areChatMenuItemsEqual(left: ChatMenuItem, right: ChatMenuItem): boolean {
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
      this.seedEventOwnerMemberCountsFromEventsTable();
      this.cdr.markForCheck();
    } catch {
      // Keep the last cached event state if the refresh fails.
    }
  }

  private applyStandaloneEventRecords(records: readonly DemoEventRecord[], replaceExisting = false): void {
    const normalizedRecords = Array.isArray(records) ? records.map(record => ({ ...record })) : [];
    if (replaceExisting || this.eventItems.length === 0) {
      this.eventItems = normalizedRecords
        .filter(record => record.type === 'events')
        .map(record => this.toEventMenuItem(record));
    }
    if (replaceExisting || this.hostingItems.length === 0) {
      this.hostingItems = normalizedRecords
        .filter(record => record.type === 'hosting')
        .map(record => this.toHostingMenuItem(record));
    }
    if (replaceExisting || this.invitationItems.length === 0) {
      this.invitationItems = normalizedRecords
        .filter(record => record.isInvitation)
        .map(record => this.toInvitationMenuItem(record));
    }
    this.publishedHostingIds = new Set(
      normalizedRecords
        .filter(record => record.type === 'hosting' && record.published !== false)
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
        const row = toActivityEventRow(record);
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
        this.eventSubEventsById[record.id] = record.subEvents.map((item: AppTypes.SubEventFormItem) => ({
          ...item,
          groups: Array.isArray(item.groups) ? item.groups.map((group: AppTypes.SubEventGroupItem) => ({ ...group })) : []
        }));
      }
    }
    this.bumpActivitiesEventCardRevision();
  }


  private upsertVisibleEventRowFromSync(sync: ActivitiesEventSyncPayload): void {
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
    const nextRow = this.buildVisibleEventRowFromSync(sync, existingRow);
    if (!nextRow && currentIndex < 0) {
      return;
    }
    const nextItems = currentItems.filter(row => row.id !== sync.id);
    if (nextRow) {
      nextItems.push(nextRow);
    }
    this.replaceVisibleActivityItems(nextItems, (nextRow ? 1 : 0) - (currentIndex >= 0 ? 1 : 0));
  }

  private buildVisibleEventRowFromSync(
    sync: ActivitiesEventSyncPayload,
    existingRow: AppTypes.ActivityListRow | null = null
  ): AppTypes.ActivityListRow | null {
    const rowType = this.resolveVisibleEventRowTypeFromSync(sync);
    if (rowType === 'events') {
      const source = this.buildSyncedEventMenuItem(
        sync,
        existingRow?.type === 'events' ? existingRow.source as EventMenuItem : undefined
      );
      return {
        ...toActivityEventRowFromMenuItem(source, {
          dateIso: source.startAt ?? sync.startAt,
          distanceKm: source.distanceKm ?? sync.distanceKm
        }),
        metricScore: existingRow?.metricScore ?? source.relevance ?? source.activity
      };
    }
    if (rowType === 'hosting') {
      const source = this.buildSyncedHostingMenuItem(
        sync,
        existingRow?.type === 'hosting' ? existingRow.source as HostingMenuItem : undefined
      );
      return {
        ...toActivityHostingRowFromMenuItem(source, {
          dateIso: source.startAt ?? sync.startAt,
          distanceKm: source.distanceKm ?? sync.distanceKm
        }),
        metricScore: existingRow?.metricScore ?? source.relevance ?? (20 + source.activity)
      };
    }
    return null;
  }

  private resolveVisibleEventRowTypeFromSync(sync: ActivitiesEventSyncPayload): AppTypes.ActivityListRow['type'] | null {
    // If we've locally published it, trust that over a lagging sync payload
    const isPublishedLocally = this.publishedHostingIds.has(sync.id);
    const isPublished = sync.published !== false || isPublishedLocally;
    const isPending = this.isPendingEventSync(sync);
    const isAccepted = this.isAcceptedEventSync(sync);

    if (this.activitiesEventScope === 'active-events') {
      return !sync.isAdmin && isPublished && isAccepted ? 'events' : null;
    }
    if (this.activitiesEventScope === 'pending') {
      return !sync.isAdmin && isPublished && isPending ? 'events' : null;
    }
    if (this.activitiesEventScope === 'my-events') {
      if (this.hostingPublicationFilter === 'drafts' && isPublished) {
        return null;
      }
      return sync.isAdmin ? 'hosting' : null;
    }
    if (this.activitiesEventScope === 'drafts') {
      return sync.isAdmin && !isPublished ? 'hosting' : null;
    }
    if (this.activitiesEventScope === 'all') {
      return sync.isAdmin ? 'hosting' : (isAccepted || isPending ? 'events' : null);
    }
    return null;
  }

  protected replaceVisibleActivityItems(items: readonly AppTypes.ActivityListRow[], totalDelta = 0): void {
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

  protected removeVisibleActivityRow(row: AppTypes.ActivityListRow): void {
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

  private reinsertVisibleActivityRow(row: AppTypes.ActivityListRow): void {
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

  private sortVisibleEventRows(items: readonly AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
    const secondaryFilter = this.effectiveActivitiesSecondaryFilter();
    return [...items].sort((left, right) => {
      if (this.activitiesView === 'distance') {
        if (secondaryFilter === 'relevant') {
          return this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right)
            || this.activityRowRelevanceOrderValue(left) - this.activityRowRelevanceOrderValue(right)
            || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
            || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
        }
        return this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right)
          || this.activityRowTimestampOrderValue(right) - this.activityRowTimestampOrderValue(left)
          || this.activityRowIdentity(left).localeCompare(this.activityRowIdentity(right));
      }
      if (secondaryFilter === 'relevant') {
        return this.activityRowDayOrderValue(left) - this.activityRowDayOrderValue(right)
          || this.activityRowRelevanceOrderValue(left) - this.activityRowRelevanceOrderValue(right)
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

  private activityRowDistanceOrderValue(row: AppTypes.ActivityListRow): number {
    return row.distanceMetersExact
      ?? Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
  }

  private activityRowRelevanceOrderValue(row: AppTypes.ActivityListRow): number {
    const sourceRelevance = Number((row.source as { relevance?: unknown }).relevance);
    if (Number.isFinite(sourceRelevance)) {
      return Math.max(0, sourceRelevance);
    }
    return Math.max(0, Number(row.metricScore) || 0);
  }

  private activityRowTimestampOrderValue(row: AppTypes.ActivityListRow): number {
    return AppUtils.toSortableDate((row.source as { startAt?: string }).startAt ?? row.dateIso);
  }

  private activityRowDayOrderValue(row: AppTypes.ActivityListRow): number {
    const timestamp = this.activityRowTimestampOrderValue(row);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }
    return AppUtils.dateOnly(new Date(timestamp)).getTime();
  }

  private toEventMenuItem(record: DemoEventRecord): EventMenuItem {
    return {
      id: record.id,
      avatar: record.avatar,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: record.isAdmin,
      creatorUserId: record.creatorUserId,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      visibility: record.visibility,
      blindMode: record.blindMode,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      locationCoordinates: record.locationCoordinates ?? undefined,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      capacityTotal: record.capacityTotal,
      autoInviter: record.autoInviter,
      frequency: record.frequency,
      topics: [...record.topics],
      subEvents: record.subEvents?.map((item: AppTypes.SubEventFormItem) => ({
        ...item,
        groups: Array.isArray(item.groups) ? item.groups.map((group: AppTypes.SubEventGroupItem) => ({ ...group })) : []
      })),
      subEventsDisplayMode: record.subEventsDisplayMode,
      rating: record.rating,
      relevance: record.relevance,
      affinity: record.affinity,
      ticketing: record.ticketing,
      published: record.published
    };
  }

  private toHostingMenuItem(record: DemoEventRecord): HostingMenuItem {
    const item = this.toEventMenuItem(record);
    return {
      ...item
    };
  }

  private toInvitationMenuItem(record: DemoEventRecord): InvitationMenuItem {
    return {
      id: record.id,
      avatar: record.avatar,
      inviter: record.inviter ?? record.creatorName,
      description: record.title,
      when: record.timeframe,
      unread: record.unread,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      capacityTotal: record.capacityTotal,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      locationCoordinates: record.locationCoordinates ?? undefined
    };
  }

  protected refreshSectionBadges(): void {
    const memberEventItems = this.memberEventItems();
    this.chatBadge = DemoUserMenuCountersBuilder.resolveSectionBadge(
      this.chatItems.map(item => item.unread),
      this.chatItems.length
    );
    if (memberEventItems.length === 0 && this.hostingItems.length === 0 && this.invitationItems.length === 0) {
      this.invitationsBadge = this.activeUser.activities.invitations;
      this.eventsBadge = this.activeUser.activities.events;
      this.pendingBadge = 0;
      this.hostingBadge = this.activeUser.activities.hosting;
      this.gameBadge = this.activeUser.activities.game;
      this.syncActivityCounterOverrides();
      return;
    }
    const visibleInvitations = this.invitationItems
      .filter(item => !this.isActivityIdentityTrashed('invitations', item.id));
    this.invitationsBadge = visibleInvitations.length;
    const visibleMemberEvents = memberEventItems
      .filter(item => !this.isActivityIdentityTrashed('events', item.id))
      .filter(item => this.isAcceptedEventMenuItem(item) || this.isPendingEventMenuItem(item));
    const visiblePendingEvents = visibleMemberEvents
      .filter(item => this.isPendingEventMenuItem(item));
    const visibleActiveEvents = visibleMemberEvents
      .filter(item => this.isAcceptedEventMenuItem(item));
    this.eventsBadge = visibleActiveEvents.length;
    this.pendingBadge = visiblePendingEvents.length;
    const adminEvents = this.hostingItems
      .filter(item => item.isAdmin)
      .filter(item => !this.isActivityIdentityTrashed('hosting', item.id));
    this.hostingBadge = adminEvents.length;
    this.gameBadge = this.activeUser.activities.game;
    this.syncActivityCounterOverrides();
  }

  private isAcceptedEventMenuItem(item: EventMenuItem): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || item.isAdmin === true) {
      return false;
    }
    return (item.acceptedMemberUserIds ?? []).includes(activeUserId);
  }

  private isPendingEventMenuItem(item: EventMenuItem): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || item.isAdmin === true) {
      return false;
    }
    if ((item.acceptedMemberUserIds ?? []).includes(activeUserId)) {
      return false;
    }
    return (item.pendingMemberUserIds ?? []).includes(activeUserId);
  }

  private isPendingEventSync(sync: ActivitiesEventSyncPayload): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || sync.isAdmin) {
      return false;
    }
    if (this.pendingCheckoutDraftSourceIds().has(sync.id)) {
      return true;
    }
    if ((sync.acceptedMemberUserIds ?? []).includes(activeUserId)) {
      return false;
    }
    return (sync.pendingMemberUserIds ?? []).includes(activeUserId);
  }

  private isAcceptedEventSync(sync: ActivitiesEventSyncPayload): boolean {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId || sync.isAdmin) {
      return false;
    }
    if (this.pendingCheckoutDraftSourceIds().has(sync.id)) {
      return false;
    }
    return (sync.acceptedMemberUserIds ?? []).includes(activeUserId);
  }

  private syncActivityCounterOverrides(): void {
    const activeUserId = this.activeUser?.id?.trim();
    if (!activeUserId) {
      return;
    }
    this.appCtx.patchUserCounterOverrides(activeUserId, {
      chat: this.chatBadge,
      invitations: this.invitationsBadge,
      events: this.eventsBadge,
      hosting: this.hostingBadge
    });
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

  protected get filteredActivityRows(): AppTypes.ActivityListRow[] {
    return [...this.visibleActivityRows];
  }

  private memberEventItems(): EventMenuItem[] {
    const pendingDraftItems = this.pendingCheckoutDraftEventMenuItems();
    const pendingDraftSourceIds = new Set(pendingDraftItems.map(item => item.id));
    return [
      ...this.eventItems
        .filter(item => item.isAdmin !== true)
        .filter(item => !pendingDraftSourceIds.has(item.id)),
      ...pendingDraftItems
    ];
  }

  private pendingCheckoutDraftEventMenuItems(): EventMenuItem[] {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return [];
    }
    return this.eventCheckoutDraftService.listByUser(activeUserId)
      .filter(draft => this.shouldTrackPendingCheckoutDraft(draft))
      .map(draft => this.buildPendingCheckoutDraftEventMenuItem(draft))
      .filter((item): item is EventMenuItem => Boolean(item));
  }

  private buildPendingCheckoutDraftEventMenuItem(draft: EventCheckoutDraft): EventMenuItem | null {
    const activeUserId = this.activeUser?.id?.trim() ?? '';
    const sourceId = draft.sourceId.trim();
    if (!activeUserId || !sourceId) {
      return null;
    }
    const checkoutStarted = Boolean(draft.checkoutSessionId?.trim());
    const pendingDescription = checkoutStarted
      ? 'Checkout in progress.'
      : 'Waiting for admin approval before payment.';
    const pendingTimeframe = checkoutStarted
      ? 'Booking pending.'
      : 'Approval pending.';

    const knownRecord = this.eventsService.peekKnownItemById(activeUserId, sourceId);
    if (!knownRecord) {
      return {
        id: sourceId,
        avatar: AppUtils.initialsFromText(draft.eventTitle || 'Pending'),
        title: draft.eventTitle.trim() || 'Pending booking',
        shortDescription: pendingDescription,
        timeframe: draft.eventTimeframe.trim() || pendingTimeframe,
        activity: 0,
        isAdmin: false,
        acceptedMembers: 0,
        pendingMembers: 1,
        capacityTotal: 1,
        acceptedMemberUserIds: [],
        pendingMemberUserIds: [activeUserId],
        ticketing: draft.lineItems.length > 0 || draft.totalAmount > 0
      };
    }

    const item = this.toEventMenuItem(knownRecord);
    const originalAcceptedMemberUserIds = this.uniqueUserIds(item.acceptedMemberUserIds ?? []);
    const originalPendingMemberUserIds = this.uniqueUserIds(item.pendingMemberUserIds ?? []);
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
      shortDescription: item.shortDescription.trim() || pendingDescription,
      timeframe: item.timeframe.trim() || draft.eventTimeframe.trim() || pendingTimeframe,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(
        acceptedMembers,
        this.chatCountValue(item.capacityTotal ?? item.capacityMax)
      ),
      acceptedMemberUserIds,
      pendingMemberUserIds
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
    return Math.max(0, Number(draft?.totalAmount) || 0) > 0;
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

  protected effectiveActivitiesSecondaryFilter(): AppTypes.ActivitiesSecondaryFilter {
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

  protected trackByActivityRow(_index: number, row: AppTypes.ActivityListRow): string {
    return this.activityRowIdentity(row);
  }

  protected trackByRateCardImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  protected activitiesRateCardRevisionForRow(row: AppTypes.ActivityListRow | null): string {
    const rowRevision = row ? (this.activityRateCardRevisionByRowId[row.id] ?? 0) : 0;
    return `${this.activitiesRateCardRevision}:${rowRevision}`;
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

  protected activityRowBadge(row: AppTypes.ActivityListRow): number {
    if (row.type === 'chats') {
      return row.unread ?? 0;
    }
    return 0;
  }

  // ── Event-style rows ───────────────────────────────────────────────────────

  protected activityImageUrl(row: AppTypes.ActivityListRow): string | null {
    const sourceImageUrl = (row.source as { imageUrl?: string }).imageUrl;
    if (typeof sourceImageUrl === 'string' && sourceImageUrl.trim().length > 0) {
      return sourceImageUrl;
    }
    return this.activityImageById[row.id] ?? null;
  }

  protected showActivitySourceIcon(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'invitations';
  }

  private activitySourceAvatarTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['mediaStart']>['tone'] {
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${(row.source as InvitationMenuItem).inviter}`
      : `${row.id}-${row.title}`;
    const toneIndex = (AppUtils.hashText(toneSeed) % 8) + 1;
    const toneClass = `activities-source-tone-${toneIndex}`;
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
      const fallbackOwner = this.users[AppUtils.hashText(`${row.id}-${event.title}`) % this.users.length];
      return fallbackOwner?.initials ?? AppUtils.initialsFromText(event.title);
    }
    if (row.type === 'hosting') {
      const hosting = row.source as HostingMenuItem;
      return AppUtils.initialsFromText(hosting.avatar || hosting.title);
    }
    return AppUtils.initialsFromText(row.title);
  }

  protected activityCapacityLabel(row: AppTypes.ActivityListRow): string {
    const summary = this.resolveActivityMembersPopupSummary(row);
    if (summary) {
      return `${summary.acceptedMembers} / ${summary.capacityTotal}`;
    }
    const acceptedMembers = this.parseAcceptedMembersFromCapacityLabel(this.activityCapacityById[row.id]);
    return `${acceptedMembers} / ${this.activityCapacityTotal(row, acceptedMembers)}`;
  }

  protected activityPendingMemberCount(row: AppTypes.ActivityListRow): number {
    const summary = this.resolveActivityMembersPopupSummary(row);
    if (summary) {
      return summary.pendingMembers;
    }
    return Math.max(0, Math.trunc(Number(this.activityPendingMembersById[row.id]) || 0));
  }

  protected isActivityFull(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'events') {
      return false;
    }
    const summary = this.resolveActivityMembersPopupSummary(row);
    if (summary) {
      return summary.capacityTotal > 0 && summary.acceptedMembers >= summary.capacityTotal;
    }
    const acceptedMembers = this.parseAcceptedMembersFromCapacityLabel(this.activityCapacityById[row.id]);
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembers);
    return capacityTotal > 0 && acceptedMembers >= capacityTotal;
  }

  protected isActivityDraft(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'hosting' && !this.isHostingPublished(row.id);
  }

  private activityMembersOwnerForRow(row: AppTypes.ActivityListRow): ActivityMemberOwnerRef {
    return ActivityMembersBuilder.activityMembersOwnerForRow(row) ?? {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  private resolveActivityMembersPopupSummary(row: AppTypes.ActivityListRow): ActivityMembersSummary | null {
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


  private activityCalendarDateRange(row: AppTypes.ActivityListRow): { start: Date; end: Date } | null {
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

  private resolveInvitationActivityMembersRow(row: AppTypes.ActivityListRow): AppTypes.ActivityListRow {
    if (row.type !== 'invitations') {
      return row;
    }
    const resolvedSource = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    });
    if (!resolvedSource || resolvedSource.id.startsWith('inv-preview-')) {
      return row;
    }
    const matchingEvent = this.eventItems.find(item => item.id === resolvedSource.id);
    if (matchingEvent) {
      return toActivityEventRowFromMenuItem(matchingEvent, {
        dateIso: row.dateIso,
        distanceKm: row.distanceKm
      });
    }
    const matchingHosting = this.hostingItems.find(item => item.id === resolvedSource.id);
    if (matchingHosting) {
      return toActivityHostingRowFromMenuItem(matchingHosting, {
        dateIso: row.dateIso,
        distanceKm: row.distanceKm
      });
    }
    return row;
  }

  private buildActivityMembersFromKnownUserIds(
    row: AppTypes.ActivityListRow,
    acceptedMemberUserIds: readonly string[],
    pendingMemberUserIds: readonly string[]
  ): AppTypes.ActivityMemberEntry[] {
    const rowKey = this.activityRowIdentity(row);
    const normalizedAcceptedMemberUserIds = this.uniqueUserIds(acceptedMemberUserIds);
    const normalizedPendingMemberUserIds = this.uniqueUserIds(pendingMemberUserIds)
      .filter(userId => !normalizedAcceptedMemberUserIds.includes(userId));
    const entries: AppTypes.ActivityMemberEntry[] = [];
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

  private resolveActivityMemberUser(userId: string): DemoUser {
    const normalizedUserId = userId.trim();
    if (normalizedUserId === this.activeUser.id) {
      return this.activeUser;
    }
    return this.userById(normalizedUserId) ?? this.activeUser;
  }

  private applyActivityMembersSummary(row: AppTypes.ActivityListRow, summary: ActivityMembersSummary): void {
    this.activityCapacityById[row.id] = `${summary.acceptedMembers} / ${summary.capacityTotal}`;
    this.activityPendingMembersById[row.id] = summary.pendingMembers;
    this.bumpActivitiesEventCardRevision();
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
    this.bumpActivitiesEventCardRevision();
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

  private seedEventOwnerMemberCountsFromEventsTable(): void {
    const eventRecords = [
      ...this.eventItems.map(item => ({
        id: item.id,
        row: toActivityEventRowFromMenuItem(item, {
          dateIso: this.eventDatesById[item.id] ?? item.startAt ?? '',
          distanceKm: this.eventDistanceById[item.id] ?? item.distanceKm ?? 0
        }),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      })),
      ...this.hostingItems.map(item => ({
        id: item.id,
        row: toActivityHostingRowFromMenuItem(item, {
          dateIso: this.hostingDatesById[item.id] ?? item.startAt ?? '',
          distanceKm: this.hostingDistanceById[item.id] ?? item.distanceKm ?? 0
        }),
        acceptedMembers: item.acceptedMembers ?? 0,
        capacityTotal: item.capacityTotal ?? 0,
        pendingMembers: item.pendingMembers ?? 0
      })),
      ...this.invitationItems.map(item => ({
        id: item.id,
        row: toActivityInvitationRowFromMenuItem(item, {
          dateIso: item.startAt ?? '',
          distanceKm: item.distanceKm ?? 0
        }),
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
          continue;
        }
      }
      delete this.activityMembersByRowId[rowKey];
    }
    this.bumpActivitiesEventCardRevision();
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

  protected calendarBadgeToneClass(row: AppTypes.ActivityListRow): string {
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
    if (this.inlineItemActionMenu) {
      this.inlineItemActionMenu = null;
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
    return this.publishedHostingIds.has(id);
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

  protected applyActivitiesEventSync(sync: ActivitiesEventSyncPayload): void {
    let eventUpdated = false;
    let hostingUpdated = false;

    this.eventItems = this.eventItems.map(item => {
      if (item.id !== sync.id) {
        return item;
      }
      eventUpdated = true;
      return this.buildSyncedEventMenuItem(sync, item);
    });

    this.hostingItems = this.hostingItems.map(item => {
      if (item.id !== sync.id) {
        return item;
      }
      hostingUpdated = true;
      return this.buildSyncedHostingMenuItem(sync, item);
    });

    if (!eventUpdated) {
      this.eventItems = [this.buildSyncedEventMenuItem(sync), ...this.eventItems];
    }

    if (sync.target === 'hosting' && !hostingUpdated) {
      this.hostingItems = [this.buildSyncedHostingMenuItem(sync), ...this.hostingItems];
    }

    this.activityDateTimeRangeById[sync.id] = {
      startIso: sync.startAt,
      endIso: sync.endAt ?? sync.startAt
    };
    this.eventDatesById[sync.id] = sync.startAt;
    this.hostingDatesById[sync.id] = sync.startAt;
    this.eventDistanceById[sync.id] = sync.distanceKm;
    this.hostingDistanceById[sync.id] = sync.distanceKm;
    if (sync.isAdmin || sync.target === 'hosting') {
      const nextPublishedIds = new Set(this.publishedHostingIds);
      if (sync.published === false) {
        if (!this.publishedHostingIds.has(sync.id)) {
          nextPublishedIds.delete(sync.id);
        }
      } else {
        nextPublishedIds.add(sync.id);
      }
      this.publishedHostingIds = nextPublishedIds;
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
    this.reconcileInvitationItemsFromEventSync(sync);

    this.patchVisibleActivityRowsFromEventSync(sync);
    this.upsertVisibleEventRowFromSync(sync);
    this.applyActivitiesEventMemberSnapshot(sync);
    this.bumpActivitiesEventCardRevision();
    this.refreshSectionBadges();
  }

  private bumpActivitiesEventCardRevision(): void {
    this.activitiesEventCardRevision += 1;
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

  private reconcileInvitationItemsFromEventSync(sync: ActivitiesEventSyncPayload): void {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    if (!Array.isArray(sync.acceptedMemberUserIds) || !sync.acceptedMemberUserIds.includes(activeUserId)) {
      return;
    }
    this.invitationItems = this.invitationItems.filter(item => item.id !== sync.id);
    delete this.activityMembersByRowId[`invitations:${sync.id}`];
  }

  private buildSyncedEventMenuItem(sync: ActivitiesEventSyncPayload, existing?: Partial<EventMenuItem>): EventMenuItem {
    const imageUrl = sync.imageUrl.trim();
    return {
      id: sync.id,
      avatar: existing?.avatar ?? sync.creatorInitials ?? AppUtils.initialsFromText(sync.title),
      title: sync.title,
      shortDescription: sync.shortDescription,
      timeframe: sync.timeframe,
      activity: sync.activity,
      isAdmin: sync.isAdmin ?? existing?.isAdmin ?? (sync.target === 'hosting'),
      creatorUserId: sync.creatorUserId ?? existing?.creatorUserId,
      startAt: sync.startAt,
      endAt: sync.endAt,
      distanceKm: sync.distanceKm,
      acceptedMembers: Number.isFinite(Number(sync.acceptedMembers)) ? Math.max(0, Math.trunc(Number(sync.acceptedMembers))) : existing?.acceptedMembers,
      pendingMembers: Number.isFinite(Number(sync.pendingMembers)) ? Math.max(0, Math.trunc(Number(sync.pendingMembers))) : existing?.pendingMembers,
      capacityTotal: Number.isFinite(Number(sync.capacityTotal)) ? Math.max(0, Math.trunc(Number(sync.capacityTotal))) : existing?.capacityTotal,
      acceptedMemberUserIds: Array.isArray(sync.acceptedMemberUserIds) ? [...sync.acceptedMemberUserIds] : [...(existing?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: Array.isArray(sync.pendingMemberUserIds) ? [...sync.pendingMemberUserIds] : [...(existing?.pendingMemberUserIds ?? [])],
      visibility: sync.visibility ?? existing?.visibility,
      blindMode: sync.blindMode ?? existing?.blindMode,
      imageUrl: imageUrl || existing?.imageUrl,
      sourceLink: sync.sourceLink?.trim() || existing?.sourceLink,
      location: sync.location?.trim() || existing?.location,
      locationCoordinates: sync.locationCoordinates ?? existing?.locationCoordinates,
      capacityMin: sync.capacityMin ?? existing?.capacityMin ?? null,
      capacityMax: sync.capacityMax ?? existing?.capacityMax ?? null,
      autoInviter: sync.autoInviter ?? existing?.autoInviter,
      frequency: sync.frequency ?? existing?.frequency,
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
        : (existing?.upcomingSlots ? existing.upcomingSlots.map(item => ({ ...item })) : undefined),
      topics: Array.isArray(sync.topics) ? [...sync.topics] : [...(existing?.topics ?? [])],
      subEvents: Array.isArray(sync.subEvents)
        ? this.cloneSyncedSubEventForms(sync.subEvents)
        : (existing?.subEvents ? this.cloneSyncedSubEventForms(existing.subEvents) : undefined),
      subEventsDisplayMode: sync.subEventsDisplayMode ?? existing?.subEventsDisplayMode,
      rating: existing?.rating,
      relevance: existing?.relevance,
      affinity: existing?.affinity,
      ticketing: sync.ticketing ?? existing?.ticketing,
      published: this.publishedHostingIds.has(sync.id) ? true : (sync.published ?? existing?.published)
    };
  }

  private buildSyncedHostingMenuItem(sync: ActivitiesEventSyncPayload, existing?: Partial<HostingMenuItem>): HostingMenuItem {
    const imageUrl = sync.imageUrl.trim();
    return {
      id: sync.id,
      avatar: existing?.avatar ?? sync.creatorInitials ?? AppUtils.initialsFromText(sync.title),
      title: sync.title,
      shortDescription: sync.shortDescription,
      timeframe: sync.timeframe,
      activity: sync.activity,
      creatorUserId: sync.creatorUserId ?? existing?.creatorUserId,
      startAt: sync.startAt,
      endAt: sync.endAt,
      distanceKm: sync.distanceKm,
      acceptedMembers: Number.isFinite(Number(sync.acceptedMembers)) ? Math.max(0, Math.trunc(Number(sync.acceptedMembers))) : existing?.acceptedMembers,
      pendingMembers: Number.isFinite(Number(sync.pendingMembers)) ? Math.max(0, Math.trunc(Number(sync.pendingMembers))) : existing?.pendingMembers,
      capacityTotal: Number.isFinite(Number(sync.capacityTotal)) ? Math.max(0, Math.trunc(Number(sync.capacityTotal))) : existing?.capacityTotal,
      acceptedMemberUserIds: Array.isArray(sync.acceptedMemberUserIds) ? [...sync.acceptedMemberUserIds] : [...(existing?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: Array.isArray(sync.pendingMemberUserIds) ? [...sync.pendingMemberUserIds] : [...(existing?.pendingMemberUserIds ?? [])],
      visibility: sync.visibility ?? existing?.visibility,
      blindMode: sync.blindMode ?? existing?.blindMode,
      imageUrl: imageUrl || existing?.imageUrl,
      sourceLink: sync.sourceLink?.trim() || existing?.sourceLink,
      location: sync.location?.trim() || existing?.location,
      locationCoordinates: sync.locationCoordinates ?? existing?.locationCoordinates,
      capacityMin: sync.capacityMin ?? existing?.capacityMin ?? null,
      capacityMax: sync.capacityMax ?? existing?.capacityMax ?? null,
      autoInviter: sync.autoInviter ?? existing?.autoInviter,
      frequency: sync.frequency ?? existing?.frequency,
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
        : (existing?.upcomingSlots ? existing.upcomingSlots.map(item => ({ ...item })) : undefined),
      topics: Array.isArray(sync.topics) ? [...sync.topics] : [...(existing?.topics ?? [])],
      subEvents: Array.isArray(sync.subEvents)
        ? this.cloneSyncedSubEventForms(sync.subEvents)
        : (existing?.subEvents ? this.cloneSyncedSubEventForms(existing.subEvents) : undefined),
      subEventsDisplayMode: sync.subEventsDisplayMode ?? existing?.subEventsDisplayMode,
      rating: existing?.rating,
      relevance: existing?.relevance,
      affinity: existing?.affinity,
      ticketing: sync.ticketing ?? existing?.ticketing,
      published: this.publishedHostingIds.has(sync.id) ? true : (sync.published ?? existing?.published),
      isAdmin: sync.isAdmin ?? existing?.isAdmin ?? true
    };
  }

  protected cloneSyncedSubEventForms(items: readonly AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return items.map(item => ({
      ...item,
      groups: Array.isArray(item.groups)
        ? item.groups.map(group => ({ ...group }))
        : []
    }));
  }

  protected cloneSyncedSlotTemplates(
    items: readonly AppTypes.EventSlotTemplate[] | null | undefined
  ): AppTypes.EventSlotTemplate[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({ ...item }));
  }

  private patchVisibleActivityRowsFromEventSync(sync: ActivitiesEventSyncPayload): void {
    for (const row of this.visibleActivityRows) {
      if (row.id !== sync.id) {
        continue;
      }

      if (row.type === 'events') {
        const nextSource = this.buildSyncedEventMenuItem(sync, row.source as EventMenuItem);
        row.title = nextSource.title;
        row.subtitle = nextSource.shortDescription;
        row.detail = nextSource.timeframe;
        row.dateIso = nextSource.startAt ?? sync.startAt;
        row.distanceKm = nextSource.distanceKm ?? sync.distanceKm;
        row.distanceMetersExact = Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
        row.unread = nextSource.activity;
        row.metricScore = Math.max(0, row.metricScore || sync.activity);
        row.isAdmin = nextSource.isAdmin;
        row.source = nextSource;
        continue;
      }

      if (row.type === 'hosting') {
        const nextSource = this.buildSyncedHostingMenuItem(sync, row.source as HostingMenuItem);
        row.title = nextSource.title;
        row.subtitle = nextSource.shortDescription;
        row.detail = nextSource.timeframe;
        row.dateIso = nextSource.startAt ?? sync.startAt;
        row.distanceKm = nextSource.distanceKm ?? sync.distanceKm;
        row.distanceMetersExact = Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
        row.unread = nextSource.activity;
        row.metricScore = Math.max(20 + nextSource.activity, row.metricScore || 0);
        row.isAdmin = true;
        row.source = nextSource;
      }
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

    const acceptedMemberUserIds = this.uniqueUserIds(sync.acceptedMemberUserIds ?? []);
    const pendingMemberUserIds = this.uniqueUserIds(sync.pendingMemberUserIds ?? [])
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

  private userById(userId: string): DemoUser | undefined {
    return this.users.find(u => u.id === userId);
  }

  private resolveActivitiesLoadingDelayMs(): number {
    if (this.activitiesPrimaryFilter === 'events') {
      return resolveCurrentRouteDelayMs('/activities/events');
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      return resolveCurrentRouteDelayMs('/activities/rates');
    }
    return resolveCurrentRouteDelayMs('/activities/chats');
  }

  private syncActivitiesSmartListQuery(): void {
    const nextFilters: Record<string, unknown> = {
      primaryFilter: this.activitiesPrimaryFilter,
      eventScopeFilter: this.activitiesEventScope,
      secondaryFilter: this.activitiesSecondaryFilter,
      chatContextFilter: this.activitiesChatContextFilter,
      hostingPublicationFilter: this.hostingPublicationFilter,
      rateFilter: this.activitiesRateFilter,
      rateSocialBadgeEnabled: this.activitiesRateSocialBadgeEnabled
    };
    const currentFilters = this.activitiesSmartListQuery.filters ?? {};
    if (
      currentFilters['primaryFilter'] === nextFilters['primaryFilter']
      && currentFilters['eventScopeFilter'] === nextFilters['eventScopeFilter']
      && currentFilters['secondaryFilter'] === nextFilters['secondaryFilter']
      && currentFilters['chatContextFilter'] === nextFilters['chatContextFilter']
      && currentFilters['hostingPublicationFilter'] === nextFilters['hostingPublicationFilter']
      && currentFilters['rateFilter'] === nextFilters['rateFilter']
      && currentFilters['rateSocialBadgeEnabled'] === nextFilters['rateSocialBadgeEnabled']
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
    let shouldMarkForCheck = false;

    const currentVisibleIds = this.visibleActivityRows.map(row => this.activityRowIdentity(row));
    const nextVisibleIds = change.items.map(row => this.activityRowIdentity(row));
    if (
      currentVisibleIds.length !== nextVisibleIds.length
      || currentVisibleIds.some((id, index) => id !== nextVisibleIds[index])
    ) {
      this.visibleActivityRows = [...change.items];
      shouldMarkForCheck = true;
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

  protected activityRowIdentity(row: AppTypes.ActivityListRow): string {
    return `${row.type}:${row.id}`;
  }

  protected activitiesListScrollElement(): HTMLDivElement | null {
    return this.activitiesSmartList?.scrollElement() ?? this.activitiesScrollRef?.nativeElement ?? null;
  }

  private async loadActivitiesSmartListPage(
    query: ListQuery<ActivitiesSmartListFilters>
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const page = await this.activitiesService.loadActivities(query, {
      chatItems: this.chatItems
    });
    const requestedPrimaryFilter = query.filters?.primaryFilter ?? this.activitiesPrimaryFilter;
    if (requestedPrimaryFilter === 'rates') {
      this.refreshRateItems();
    }
    return page;
  }
}
