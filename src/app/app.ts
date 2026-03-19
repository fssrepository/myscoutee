import { ChangeDetectorRef, Component, ElementRef, HostListener, Injectable, NgZone, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AlertService } from './shared/alert.service';
import type { ActivitiesEventSyncPayload } from './shared/core/base/models';
import { ActivitiesDbContextService } from './activity/services/activities-db-context.service';
import type { AssetPopupHost } from './asset/asset-popup.host';
import { AssetPopupService, type AssetTicketBridge } from './asset/asset-popup.service';
import { OwnedAssetsPopupService } from './asset/owned-assets-popup.service';
import { EventEditorService } from './shared/event-editor.service';
import {
  ActivityMembersService,
  AppContext,
  type ConnectivityState,
  SessionService,
  UsersService,
  type ActivityCounterKey,
  type UserDto
} from './shared/core';
import {
  APP_DEMO_DATA,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  DemoUser,
  DEMO_USERS,
  EVENT_EDITOR_SAMPLE,
  PROFILE_DETAILS,
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem,
  ProfileGroup
} from './shared/demo-data';
import { LazyBgImageDirective } from './shared/ui';
import { NavigatorBindings, NavigatorService, NavigatorComponent } from './navigator';
import { AppDemoGenerators } from './shared/app-demo-generators';
import { AppUtils } from './shared/app-utils';
import { AppCalendarHelpers } from './shared/app-calendar-helpers';
import { APP_STATIC_DATA } from './shared/app-static-data';
import type * as AppTypes from './shared/core/base/models';
import { OnInit, OnDestroy } from '@angular/core';

@Injectable()
class YearMonthDayDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (match) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return new Date(year, month - 1, day);
        }
      }
    }
    return super.parse(value);
  }

  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'ymdInput') {
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${date.getFullYear()}/${month}/${day}`;
    }
    if (displayFormat === 'hmInput') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return super.format(date, displayFormat);
  }
}

const APP_DATE_FORMATS = {
  parse: {
    dateInput: 'ymdInput',
    timeInput: 'hmInput'
  },
  display: {
    dateInput: 'ymdInput',
    timeInput: 'hmInput',
    timeOptionLabel: 'hmInput',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

@Component({
  selector: 'app-core',
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatTimepickerModule,
    FormsModule,
    DragDropModule,
    NavigatorComponent
  ],
  providers: [
    { provide: DateAdapter, useClass: YearMonthDayDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS }
  ],
  templateUrl: './app.html',
  styleUrl: '../_styles/app.scss'
})
export class App {
  private static readonly DEMO_ACTIVE_USER_KEY = 'demo-active-user';
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  public readonly alertService = inject(AlertService);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  protected readonly eventEditorService = inject(EventEditorService);
  private readonly activityMembersService = inject(ActivityMembersService);
  protected readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  protected readonly ownedAssets = inject(OwnedAssetsPopupService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly navigatorService = inject(NavigatorService);

  public readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected readonly assetTicketBridge: AssetTicketBridge = {
    ticketRowsSource: () => this.ticketRows,
    createTicketScanPayload: (row) => this.createTicketScanPayload(row),
    ticketPayloadAvatarUrl: (payload) => this.ticketPayloadAvatarUrl(payload),
    ticketPayloadInitials: (payload) => this.ticketPayloadInitials(payload)
  };
  protected readonly assetPopupHost: AssetPopupHost = {
    isMobileView: () => this.isMobileView,
    isSubEventAssetAssignPopup: () => this.superStackedPopup === 'subEventAssetAssign',
    assetTypeIcon: (type) => this.assetTypeIcon(type),
    assetTypeClass: (type) => this.assetTypeClass(type),
    activityImageUrl: (row) => this.activityImageUrl(row),
    activitySourceLink: (row) => this.activitySourceLink(row),
    activitySourceAvatarClass: (row) => this.activitySourceAvatarClass(row),
    activitySourceAvatarLabel: (row) => this.activitySourceAvatarLabel(row),
    activityLeadingIconCircleClass: (row) => this.activityLeadingIconCircleClass(row),
    activityLeadingIcon: (row) => this.activityLeadingIcon(row),
    ticketCardMetaLine: (row) => this.ticketCardMetaLine(row),
    subEventAssetAssignHeaderTitle: () => this.subEventAssetAssignHeaderTitle(),
    subEventAssetAssignHeaderSubtitle: () => this.subEventAssetAssignHeaderSubtitle(),
    canConfirmSubEventAssetAssignSelection: () => this.canConfirmSubEventAssetAssignSelection(),
    closeSubEventAssetAssignPopup: (apply) => this.closeSubEventAssetAssignPopup(apply),
    confirmSubEventAssetAssignSelection: (event) => this.confirmSubEventAssetAssignSelection(event),
    subEventAssetAssignCandidates: () => this.subEventAssetAssignCandidates,
    selectedSubEventAssetAssignChips: () => this.selectedSubEventAssetAssignChips,
    toggleSubEventAssetAssignCard: (cardId, event) => this.toggleSubEventAssetAssignCard(cardId, event),
    isSubEventAssetAssignCardSelected: (cardId) => this.isSubEventAssetAssignCardSelected(cardId)
  };
  private readonly navigatorBindings: NavigatorBindings = {
    syncHydratedUser: (user) => {
      if (!this.users.some(candidate => candidate.id === user.id)) {
        return;
      }
      this.syncHydratedUserIntoLocalState(user);
      this.activeUserId = user.id;
      this.cdr.markForCheck();
    },
    openDeleteAccountConfirm: () => this.openDeleteAccountConfirm(),
    openLogoutConfirm: () => this.openLogoutConfirm()
  };
  protected readonly vibeCategories = APP_STATIC_DATA.vibeCategories;
  protected readonly hostedEventTypes = APP_STATIC_DATA.hostedEventTypes;
  protected readonly eventEditor = EVENT_EDITOR_SAMPLE;
  protected readonly profileDetailValueOptions: Record<string, string[]> = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups: AppTypes.ValuesOptionGroup[] = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups: AppTypes.InterestOptionGroup[] = APP_STATIC_DATA.interestOptionGroups;

  protected activePopup: AppTypes.PopupType = null;
  protected stackedPopup: AppTypes.PopupType = null;
  protected eventEditorMode: AppTypes.EventEditorMode = 'edit';
  protected eventEditorReadOnly = false;
  protected mobileProfileSelectorSheet: AppTypes.MobileProfileSelectorSheet | null = null;
  protected interestSelectorSelected: string[] = [];
  protected readonly assetTypeOptions: AppTypes.AssetType[] = APP_STATIC_DATA.assetTypeOptions;
  protected readonly assetFilterOptions: AppTypes.AssetFilterType[] = APP_STATIC_DATA.assetFilterOptions;
  private readonly seedAssetCards: AppTypes.AssetCard[] = AppDemoGenerators.buildSampleAssetCards(this.users);
  protected selectedAssetCardId: string | null = null;
  protected pendingAssetMemberAction: { cardId: string; memberId: string; action: AppTypes.AssetRequestAction } | null = null;
  protected activeUserId = this.getInitialUserId();

  protected activeMenuSection: AppTypes.MenuSection = 'chat';
  protected inlineItemActionMenu: { scope: 'activity' | 'activityMember' | 'asset' | 'subEvent' | 'subEventStage' | 'subEventMember' | 'subEventAsset' | 'chatContext'; id: string; title: string; openUp: boolean } | null = null;
  private subEventAssetMenuIgnoreCloseUntilMs = 0;
  protected pendingActivityMemberDelete: AppTypes.ActivityMemberEntry | null = null;
  protected selectedActivityMembers: AppTypes.ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRowId: string | null = null;
  protected selectedActivityMembersRow: AppTypes.ActivityListRow | null = null;
  protected activityMembersReadOnly = false;
  protected activityMembersPendingOnly = false;
  protected activityInviteSort: AppTypes.ActivityInviteSort = 'recent';
  protected showActivityInviteSortPicker = false;
  protected selectedActivityInviteUserIds: string[] = [];
  protected superStackedPopup: 'activityInviteFriends' | 'eventTopicsSelector' | 'subEventAssetAssign' | null = null;
  private readonly activityMembersByRowId: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  private activityMembersPopupOrigin: 'active-event-editor' | 'stacked-event-editor' | 'subevent-asset' | null = null;
  private subEventAssetMembersContext: AppTypes.SubEventAssetMembersContext | null = null;
  public readonly eventDatesById: Record<string, string> = { ...APP_DEMO_DATA.eventDatesById };
  protected readonly hostingDatesById: Record<string, string> = { ...APP_DEMO_DATA.hostingDatesById };
  protected readonly eventVisibilityById: Record<string, AppTypes.EventVisibility> = { ...APP_DEMO_DATA.eventVisibilityById };
  protected readonly eventBlindModeById: Record<string, AppTypes.EventBlindMode> = { ...APP_DEMO_DATA.eventBlindModeById };
  protected readonly eventAutoInviterById: Record<string, boolean> = { ...APP_DEMO_DATA.eventAutoInviterById };
  protected readonly eventTicketingById: Record<string, boolean> = { ...APP_DEMO_DATA.eventTicketingById };
  protected readonly hostingPublishedById: Record<string, boolean> = { ...APP_DEMO_DATA.hostingPublishedById };
  private readonly supportedEventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'];
  private readonly forcedAcceptedMembersByRowKey: Record<string, number> = { 'events:e8': 20 };
  protected readonly eventCapacityById: Record<string, AppTypes.EventCapacityRange> = {};
  private readonly eventFrequencyById: Record<string, string> = {};
  protected readonly invitationDatesById: Record<string, string> = { ...APP_DEMO_DATA.invitationDatesById };
  protected readonly chatDatesById: Record<string, string> = { ...APP_DEMO_DATA.chatDatesById };
  protected readonly chatDistanceById: Record<string, number> = { ...APP_DEMO_DATA.chatDistanceById };
  protected readonly invitationDistanceById: Record<string, number> = { ...APP_DEMO_DATA.invitationDistanceById };
  protected readonly eventDistanceById: Record<string, number> = { ...APP_DEMO_DATA.eventDistanceById };
  protected readonly activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange> = { ...APP_DEMO_DATA.activityDateTimeRangeById };
  protected readonly hostingDistanceById: Record<string, number> = { ...APP_DEMO_DATA.hostingDistanceById };
  public readonly activityImageById: Record<string, string> = { ...APP_DEMO_DATA.activityImageById };
  protected readonly activitySourceLinkById: Record<string, string> = { ...APP_DEMO_DATA.activitySourceLinkById };
  protected readonly activityCapacityById: Record<string, string> = { ...APP_DEMO_DATA.activityCapacityById };
  protected readonly invitationItemsByUser: Record<string, InvitationMenuItem[]> = AppUtils.cloneMapItems(DEMO_INVITATIONS_BY_USER);
  protected readonly eventItemsByUser: Record<string, EventMenuItem[]> = AppUtils.cloneMapItems(DEMO_EVENTS_BY_USER);
  protected readonly hostingItemsByUser: Record<string, HostingMenuItem[]> = AppUtils.cloneMapItems(DEMO_HOSTING_BY_USER);
  private readonly acceptedInvitationIdsByUser: Record<string, string[]> = {};

  protected selectedInvitation: InvitationMenuItem | null = null;
  protected selectedEvent: EventMenuItem | null = null;
  protected selectedHostingEvent: HostingMenuItem | null = null;
  protected eventEditorTarget: AppTypes.EventEditorTarget = 'events';
  private eventEditorSource: EventMenuItem | HostingMenuItem | null = null;
  private eventEditorDraftMembersId: string | null = null;
  private eventEditorInvitationId: string | null = null;
  protected editingEventId: string | null = null;
  protected eventForm: AppTypes.EventEditorForm = this.defaultEventForm();
  protected showEventEditorRequiredValidation = false;
  protected readonly eventVisibilityOptions: AppTypes.EventVisibility[] = APP_STATIC_DATA.eventVisibilityOptions;
  protected readonly eventBlindModeOptions: AppTypes.EventBlindMode[] = APP_STATIC_DATA.eventBlindModeOptions;
  private readonly eventSubEventsById: Record<string, AppTypes.SubEventFormItem[]> = {};
  private readonly eventLocationById: Record<string, string> = {};
  private readonly eventTopicsById: Record<string, string[]> = {};
  private readonly acceptedOptionalSubEventMembersByKey: Record<string, string[]> = {};
  private readonly acceptedTournamentGroupMembersByKey: Record<string, string[]> = {};
  private readonly userCreatedEventIds = new Set<string>();
  protected eventStartDateValue: Date | null = null;
  protected eventEndDateValue: Date | null = null;
  protected eventStartTimeValue: Date | null = null;
  protected eventEndTimeValue: Date | null = null;
  protected subEventsDisplayMode: AppTypes.SubEventsDisplayMode = 'Casual';
  @ViewChild('assetImageInput') private assetImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('subEventStagesScroll') private subEventStagesScrollRef?: ElementRef<HTMLDivElement>;

  protected eventSupplyTypes: string[] = ['Cars', 'Members', 'Accessories', 'Accommodation'];
  protected newSupplyType = '';
  protected selectedSupplyContext: AppTypes.SupplyContext | null = null;
  protected selectedSubEventBadgeContext: AppTypes.SubEventBadgeContext | null = null;
  protected subEventResourceFilter: AppTypes.SubEventResourceFilter = 'Members';
  protected subEventMembersPendingOnly = false;
  private subEventBadgePopupOrigin: 'active-event-editor' | 'stacked-event-editor' | 'chat' | null = null;
  private subEventMembersRow: AppTypes.ActivityListRow | null = null;
  private subEventMembersRowId: string | null = null;
  private subEventMemberRolePickerUserId: string | null = null;
  protected subEventAssetAssignContext: { subEventId: string; type: AppTypes.AssetType } | null = null;
  protected selectedSubEventAssignAssetIds: string[] = [];
  private readonly subEventAssignedAssetIdsByKey: Record<string, string[]> = {};
  private readonly subEventAssignedAssetSettingsByKey: Record<string, Record<string, AppTypes.SubEventAssignedAssetSettings>> = {};
  private subEventResourceFallbackCardsByType: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> | null = null;
  private pendingSubEventAssetCreateAssignment: { subEventId: string; type: AppTypes.AssetType } | null = null;
  protected subEventAssetCapacityEditor:
    { subEventId: string; type: AppTypes.AssetType; assetId: string; title: string; capacityMin: number; capacityMax: number; capacityLimit: number } | null = null;
  protected subEventAssetRouteEditor:
    { subEventId: string; type: 'Car'; assetId: string; title: string; routes: string[] } | null = null;
  protected subEventSupplyBringDialog:
    { subEventId: string; cardId: string; title: string; quantity: number; min: number; max: number } | null = null;
  protected selectedSubEventSupplyContributionContext: { subEventId: string; assetId: string; title: string } | null = null;
  protected pendingSubEventSupplyContributionDelete: { subEventId: string; assetId: string; entryId: string; label: string } | null = null;
  private readonly subEventSupplyContributionEntriesByAssignmentKey: Record<string, AppTypes.SubEventSupplyContributionEntry[]> = {};


  private readonly profileDetailsFormByUser: Record<string, AppTypes.ProfileDetailFormGroup[]> = {};
  constructor(
    private readonly router: Router
  ) {
    this.ownedAssets.registerRuntimeHooks({
      onAssetsChanged: () => {
        this.syncAllSubEventAssetBadgeCounts();
      },
      onAssetCreated: (card) => this.handleOwnedAssetCreated(card),
      onAssetDeleted: (cardId) => this.handleOwnedAssetDeleted(cardId),
      onAssetFormClosed: () => {
        this.pendingSubEventAssetCreateAssignment = null;
      }
    });
    this.ownedAssets.initialize(this.seedAssetCards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      requests: [...card.requests]
    })));
    this.assetPopupService.registerHost(this.assetPopupHost);
    this.assetPopupService.registerTicketBridge(this.assetTicketBridge);
    this.navigatorService.registerBindings(this.navigatorBindings);
    this.syncAssetPopupVisibility();
    this.ensurePaginationTestEvents(30);
    this.initializeEventEditorContextData();
    this.initializeProfileDetailForms();
    this.appCtx.setActiveUserId(this.activeUserId);
    this.appCtx.setConnectivityState(this.browserConnectivityState());

    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request) {
        return;
      }
      if (request.type === 'members' || request.type === 'eventEditorMembers' || request.type === 'eventExplore') {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
      if (request.type === 'chatResource') {
        this.seedSubEventResourceFallbackCardsFromNavigationRequest(request.assetCardsByType);
        this.seedSubEventAssetAssignmentsFromNavigationRequest(request.subEvent.id, request.assetAssignmentIds);
        this.eventEditorService.isOpen();
        setTimeout(() => {
          this.openSubEventBadgePopup(
            request.resourceType,
            request.subEvent,
            undefined,
            request.group
              ? { id: request.group.id, groupLabel: request.group.groupLabel }
              : undefined,
            'chat'
          );
        }, 0);
        return;
      }
      this.subEventResourceFallbackCardsByType = null;
      if (request.type === 'eventEditorCreate') {
        this.openEventEditor(true, 'create', undefined, false, null, request.target);
        return;
      }
      if (request.type === 'eventEditor') {
        this.openEventEditorFromActivitiesRequest(request.row, request.readOnly);
        return;
      }
    });

    // Listen for events from EventEditorPopupComponent
    if (typeof window !== 'undefined') {
      window.addEventListener('app:openTopics', (event) => {
        this.syncModuleEventEditorDraftFromEvent(event);
        this.openEventTopicsSelector();
      });
      window.addEventListener('app:openLocationMap', (event) => {
        this.syncModuleEventEditorDraftFromEvent(event);
        this.openEventLocationMap();
      });
      window.addEventListener('app:saveEventEditor', (event) => this.handleModuleEventEditorSave(event));
      window.addEventListener('app:openSubEventResourcePopupFromEventEditor', (event) => this.handleModuleSubEventResourcePopup(event));
    }
  }

  ngOnDestroy(): void {
    this.navigatorService.clearBindings(this.navigatorBindings);
    this.navigatorService.clearHydratedUser();
  }

  @HostListener('window:online')
  protected onWindowOnline(): void {
    this.appCtx.setConnectivityState('online');
  }

  @HostListener('window:offline')
  protected onWindowOffline(): void {
    this.appCtx.setConnectivityState('offline');
  }

  private browserConnectivityState(): ConnectivityState {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'offline';
    }
    return 'online';
  }

  private ensurePaginationTestEvents(minEventsPerUser: number): void {
    for (const user of this.users) {
      const userId = user.id;
      const events = this.eventItemsByUser[userId] ?? [];
      if (events.length >= minEventsPerUser) {
        continue;
      }

      const needed = minEventsPerUser - events.length;
      const synthetic: EventMenuItem[] = [];
      for (let index = 0; index < needed; index += 1) {
        const seq = events.length + index + 1;
        const id = `ex-${userId}-${seq}`;
        const start = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0);
        const end = new Date(start.getTime() + ((2 + (index % 3)) * 60 * 60 * 1000));
        const isAdmin = (seq % 4) === 0;
        const title = `Pagination Test Event ${seq}`;
        const timeframe = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

        synthetic.push({
          id,
          avatar: user.initials,
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

      this.eventItemsByUser[userId] = [...events, ...synthetic];
    }
  }

  private initializeEventEditorContextData(): void {
    const sources: Array<{ item: EventMenuItem | HostingMenuItem; isHosting: boolean }> = [];
    for (const items of Object.values(this.eventItemsByUser)) {
      for (const item of items) {
        sources.push({ item, isHosting: false });
      }
    }
    for (const items of Object.values(this.hostingItemsByUser)) {
      for (const item of items) {
        sources.push({ item, isHosting: true });
      }
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

  public get activeUser(): DemoUser {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected get gameBadge(): number {
    return this.resolveActivityCounter('game', this.activeUser.activities.game);
  }

  protected get invitationsBadge(): number {
    const fallback = AppDemoGenerators.resolveSectionBadge(
      this.invitationItems.map(item => item.unread),
      this.invitationItems.length
    );
    return this.resolveActivityCounter('invitations', fallback);
  }

  protected get eventsBadge(): number {
    const fallback = AppDemoGenerators.resolveSectionBadge(
      this.eventItems.map(item => item.activity),
      this.eventItems.length
    );
    return this.resolveActivityCounter('events', fallback);
  }

  protected get hostingBadge(): number {
    const adminEvents = this.eventItems.filter(item => item.isAdmin);
    const fallback = AppDemoGenerators.resolveSectionBadge(
      adminEvents.map(item => item.activity),
      adminEvents.length
    );
    return this.resolveActivityCounter('hosting', fallback);
  }

  private resolveActivityCounter(key: ActivityCounterKey, fallbackValue: number): number {
    return this.appCtx.resolveUserCounter(this.activeUser.id, key, fallbackValue);
  }

  protected get assetCarsBadge(): number {
    return this.ownedAssets.assetCards
      .filter(card => card.type === 'Car')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get assetAccommodationBadge(): number {
    return this.ownedAssets.assetCards
      .filter(card => card.type === 'Accommodation')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get assetSuppliesBadge(): number {
    return this.ownedAssets.assetCards
      .filter(card => card.type === 'Supplies')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get assetTicketsBadge(): number {
    return this.resolveActivityCounter('tickets', this.ticketRows.length);
  }

  protected get invitationItems(): InvitationMenuItem[] {
    return this.invitationItemsByUser[this.activeUser.id] ?? this.invitationItemsByUser['u1'] ?? [];
  }

  public get eventItems(): EventMenuItem[] {
    return this.eventItemsByUser[this.activeUser.id] ?? this.eventItemsByUser['u1'] ?? [];
  }

  protected get hostingItems(): HostingMenuItem[] {
    return this.hostingItemsByUser[this.activeUser.id] ?? this.hostingItemsByUser['u1'] ?? [];
  }

  protected closeUserMenu(): void {
    this.navigatorService.closeMenu();
  }



  public eventStartAtMs(eventId: string): number | null {
    const iso = this.eventDatesById[eventId];
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  public eventTitleById(eventId: string): string {
    return this.eventItems.find(item => item.id === eventId)?.title ?? 'this event';
  }

  protected openDeleteAccountConfirm(): void {
    this.activePopup = 'deleteAccountConfirm';
  }

  protected confirmDeleteAccount(): void {
    this.alertService.open('Delete account flow is ready for backend wiring.');
    this.closePopup();
    this.closeUserMenu();
  }

  protected goToGame(): void {
    this.activeMenuSection = 'game';
    this.router.navigate(['/game']);
    this.closeUserMenu();
  }

  protected openInvitationItem(item: InvitationMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'invitations';
    this.selectedInvitation = item;
    const related = this.resolveRelatedEventFromInvitation(item);
    const source = related ?? this.buildInvitationPreviewEventSource(item);
    this.openEventEditor(stacked, 'edit', source, true, item.id);
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openEventEditor(
    stacked = false,
    mode: AppTypes.EventEditorMode = 'edit',
    source?: EventMenuItem | HostingMenuItem,
    readOnly = false,
    invitationId: string | null = null,
    targetOverride?: AppTypes.EventEditorTarget
  ): void {
    this.eventEditorMode = mode;
    this.eventEditorReadOnly = mode === 'edit' && readOnly;
    this.eventEditorInvitationId = invitationId;
    this.prepareEventEditorForm(mode, source, targetOverride);
    const resolvedSource = source ?? this.resolveEventEditorSource();
    if (mode === 'create') {
      this.eventEditorService.openCreate();
      return;
    }
    if (!resolvedSource) {
      this.eventEditorService.openCreate();
      return;
    }
    const moduleSource = this.buildEventEditorModuleSource(resolvedSource);
    if (this.eventEditorReadOnly) {
      this.eventEditorService.openView(moduleSource);
      return;
    }
    this.eventEditorService.openEdit(moduleSource);
  }

  protected openInvitationRelatedEventEditor(stacked = false, event?: Event): void {
    event?.stopPropagation();
    const related = this.resolveRelatedEventFromInvitation(this.selectedInvitation);
    if (!related) {
      return;
    }
    this.openEventEditor(stacked, 'edit', related, true, this.selectedInvitation?.id ?? null);
  }

  private openEventEditorFromActivitiesRequest(row: AppTypes.ActivityListRow, readOnly: boolean): void {
    if (row.type === 'invitations') {
      const invitationSource = row.source as InvitationMenuItem;
      const invitation = this.invitationItems.find(item => item.id === invitationSource.id) ?? invitationSource;
      const related = this.resolveRelatedEventFromInvitation(invitation);
      const source = related ?? this.buildInvitationPreviewEventSource(invitation);
      this.openEventEditor(true, 'edit', source, true, invitation.id);
      return;
    }
    if (row.type !== 'events' && row.type !== 'hosting') {
      return;
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
    source = source ?? rowSource;
    const effectiveReadOnly = readOnly || (row.type === 'events' && row.isAdmin !== true);
    this.openEventEditor(true, 'edit', source, effectiveReadOnly);
  }

  protected isEventEditorReadOnly(): boolean {
    return this.eventEditorReadOnly;
  }

  private reopenEventEditorPopupFromState(force = false): void {
    if (!force && this.eventEditorService.isOpen()) {
      return;
    }
    const source = this.resolveEventEditorSource();
    if (this.eventEditorMode === 'create' || !source) {
      this.eventEditorService.open('create', this.buildEventEditorCreateDraftSource());
      return;
    }
    const moduleSource = this.buildEventEditorModuleSource(source);
    if (this.eventEditorReadOnly) {
      this.eventEditorService.openView(moduleSource);
      return;
    }
    this.eventEditorService.openEdit(moduleSource);
  }

  private buildEventEditorModuleSource(source: EventMenuItem | HostingMenuItem): Record<string, unknown> {
    const row = this.buildEventEditorActivityRow(source);
    const pendingMembersCount = this.activityPendingMemberCount(row);
    return {
      ...source,
      title: this.eventForm.title.trim() || source.title,
      description: this.eventForm.description.trim() || source.shortDescription,
      imageUrl: this.eventForm.imageUrl
        || this.activityImageById[source.id]
        || AppDemoGenerators.defaultAssetImage('Supplies', `event-${source.id}`),
      visibility: this.eventForm.visibility,
      frequency: this.eventForm.frequency,
      location: this.eventForm.location,
      capacityMin: this.eventForm.capacityMin,
      capacityMax: this.eventForm.capacityMax,
      blindMode: this.eventForm.blindMode,
      autoInviter: this.eventForm.autoInviter,
      ticketing: this.eventForm.ticketing,
      topics: [...this.eventForm.topics],
      subEvents: this.buildModuleEventEditorSubEvents(this.eventForm.subEvents),
      subEventsDisplayMode: this.subEventsDisplayMode,
      startAt: this.eventForm.startAt,
      endAt: this.eventForm.endAt,
      pendingMembersCount
    };
  }

  private buildEventEditorCreateDraftSource(): Record<string, unknown> {
    const draftSource: EventMenuItem | HostingMenuItem = this.eventEditorTarget === 'hosting'
      ? {
        id: this.eventEditorDraftMembersId ?? 'draft-hosting',
        avatar: this.activeUser.initials,
        title: '',
        shortDescription: '',
        timeframe: '',
        activity: 0
      }
      : {
        id: this.eventEditorDraftMembersId ?? 'draft-events',
        avatar: this.activeUser.initials,
        title: '',
        shortDescription: '',
        timeframe: '',
        activity: 0,
        isAdmin: true
      };
    return this.buildEventEditorModuleSource(draftSource);
  }

  private buildModuleEventEditorSubEvents(items: readonly AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return this.cloneSubEvents([...items]).map(item => {
      const cars = this.subEventAssetCapacityMetrics(item, 'Car');
      const accommodation = this.subEventAssetCapacityMetrics(item, 'Accommodation');
      const supplies = this.subEventAssetCapacityMetrics(item, 'Supplies');
      return {
        ...item,
        carsAccepted: cars.joined,
        carsPending: cars.pending,
        carsCapacityMin: cars.capacityMin,
        carsCapacityMax: cars.capacityMax,
        accommodationAccepted: accommodation.joined,
        accommodationPending: accommodation.pending,
        accommodationCapacityMin: accommodation.capacityMin,
        accommodationCapacityMax: accommodation.capacityMax,
        suppliesAccepted: supplies.joined,
        suppliesPending: supplies.pending,
        suppliesCapacityMin: supplies.capacityMin,
        suppliesCapacityMax: supplies.capacityMax
      };
    });
  }

  private buildEventEditorActivityRow(source: EventMenuItem | HostingMenuItem): AppTypes.ActivityListRow {
    const isHosting = this.eventEditorTarget === 'hosting' || this.isHostingSource(source);
    return {
      id: source.id,
      type: isHosting ? 'hosting' : 'events',
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: this.eventDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? 0,
      unread: source.activity,
      metricScore: source.activity,
      isAdmin: isHosting ? true : (source as EventMenuItem).isAdmin === true,
      source
    };
  }

  private handleModuleEventEditorSave(event: Event): void {
    const payload = this.moduleEventEditorPayloadFromEvent(event) ?? {};
    this.applyModuleEventEditorPayload(payload);
    this.persistModuleEventEditorPayload();
  }

  private syncModuleEventEditorDraftFromEvent(event: Event): void {
    const payload = this.moduleEventEditorPayloadFromEvent(event);
    if (!payload) {
      return;
    }
    this.applyModuleEventEditorPayload(payload);
  }

  private moduleEventEditorPayloadFromEvent(event: Event): Record<string, unknown> | null {
    const customEvent = event as CustomEvent<Record<string, unknown>>;
    if (!customEvent.detail || typeof customEvent.detail !== 'object') {
      return null;
    }
    return customEvent.detail;
  }

  private handleModuleSubEventResourcePopup(event: Event): void {
    const customEvent = event as CustomEvent<Record<string, unknown>>;
    const payload = (customEvent.detail && typeof customEvent.detail === 'object')
      ? customEvent.detail
      : {};

    const typeRaw = `${payload['type'] ?? ''}`.trim();
    const type = (typeRaw === 'Members' || typeRaw === 'Car' || typeRaw === 'Accommodation' || typeRaw === 'Supplies')
      ? typeRaw as 'Members' | 'Car' | 'Accommodation' | 'Supplies'
      : null;
    if (!type) {
      return;
    }

    const subEvent = (payload['subEvent'] && typeof payload['subEvent'] === 'object')
      ? payload['subEvent'] as AppTypes.SubEventFormItem
      : null;
    if (!subEvent) {
      return;
    }

    const groupRaw = (payload['group'] && typeof payload['group'] === 'object')
      ? payload['group'] as { id?: unknown; groupLabel?: unknown; pending?: unknown; capacityMin?: unknown; capacityMax?: unknown }
      : null;
    const group = groupRaw
      ? {
        id: typeof groupRaw.id === 'string' ? groupRaw.id : undefined,
        groupLabel: typeof groupRaw.groupLabel === 'string' ? groupRaw.groupLabel : undefined,
        pending: Number.isFinite(Number(groupRaw.pending)) ? Math.max(0, Math.trunc(Number(groupRaw.pending))) : undefined,
        capacityMin: Number.isFinite(Number(groupRaw.capacityMin)) ? Math.max(0, Math.trunc(Number(groupRaw.capacityMin))) : undefined,
        capacityMax: Number.isFinite(Number(groupRaw.capacityMax)) ? Math.max(0, Math.trunc(Number(groupRaw.capacityMax))) : undefined
      }
      : undefined;
    const popupSubEvent = group
      ? {
        ...subEvent,
        membersPending: type === 'Members' ? group.pending ?? subEvent.membersPending : subEvent.membersPending,
        capacityMin: group.capacityMin ?? subEvent.capacityMin,
        capacityMax: group.capacityMax ?? subEvent.capacityMax,
        carsPending: type === 'Car' ? group.pending ?? subEvent.carsPending : subEvent.carsPending,
        carsCapacityMin: type === 'Car' ? group.capacityMin ?? subEvent.carsCapacityMin : subEvent.carsCapacityMin,
        carsCapacityMax: type === 'Car' ? group.capacityMax ?? subEvent.carsCapacityMax : subEvent.carsCapacityMax,
        accommodationPending: type === 'Accommodation' ? group.pending ?? subEvent.accommodationPending : subEvent.accommodationPending,
        accommodationCapacityMin: type === 'Accommodation' ? group.capacityMin ?? subEvent.accommodationCapacityMin : subEvent.accommodationCapacityMin,
        accommodationCapacityMax: type === 'Accommodation' ? group.capacityMax ?? subEvent.accommodationCapacityMax : subEvent.accommodationCapacityMax,
        suppliesPending: type === 'Supplies' ? group.pending ?? subEvent.suppliesPending : subEvent.suppliesPending,
        suppliesCapacityMin: type === 'Supplies' ? group.capacityMin ?? subEvent.suppliesCapacityMin : subEvent.suppliesCapacityMin,
        suppliesCapacityMax: type === 'Supplies' ? group.capacityMax ?? subEvent.suppliesCapacityMax : subEvent.suppliesCapacityMax
      }
      : subEvent;
    this.openSubEventBadgePopup(type, popupSubEvent, undefined, group);
  }

  private applyModuleEventEditorPayload(payload: Record<string, unknown>): void {
    if (typeof payload['title'] === 'string') {
      this.eventForm.title = payload['title'];
    }
    if (typeof payload['description'] === 'string') {
      this.eventForm.description = payload['description'];
    }
    if (typeof payload['imageUrl'] === 'string') {
      this.eventForm.imageUrl = payload['imageUrl'];
    }
    if (typeof payload['location'] === 'string') {
      this.eventForm.location = this.normalizeLocationValue(payload['location']);
    }
    if (typeof payload['frequency'] === 'string' && payload['frequency'].trim()) {
      this.eventForm.frequency = payload['frequency'].trim();
    }

    const visibility = payload['visibility'];
    if (typeof visibility === 'string' && this.eventVisibilityOptions.includes(visibility as AppTypes.EventVisibility)) {
      this.eventForm.visibility = visibility as AppTypes.EventVisibility;
    }

    const blindMode = payload['blindMode'];
    if (blindMode === 'Blind Event' || blindMode === 'Open Event') {
      this.eventForm.blindMode = blindMode;
    }

    if ('autoInviter' in payload) {
      this.eventForm.autoInviter = payload['autoInviter'] === true || payload['autoInviter'] === 'true';
    }
    if ('ticketing' in payload) {
      this.eventForm.ticketing = payload['ticketing'] === true || payload['ticketing'] === 'true';
    }

    if ('capacityMin' in payload) {
      this.eventForm.capacityMin = this.toEventCapacityInputValue(payload['capacityMin'] as number | string);
    }
    if ('capacityMax' in payload) {
      this.eventForm.capacityMax = this.toEventCapacityInputValue(payload['capacityMax'] as number | string);
    }
    const normalizedMin = this.normalizedEventCapacityValue(this.eventForm.capacityMin);
    const normalizedMax = this.normalizedEventCapacityValue(this.eventForm.capacityMax);
    if (normalizedMin !== null && normalizedMax !== null && normalizedMax < normalizedMin) {
      this.eventForm.capacityMax = normalizedMin;
    }

    const topics = payload['topics'];
    if (Array.isArray(topics)) {
      this.eventForm.topics = topics
        .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
        .filter(item => item.length > 0)
        .slice(0, 5);
    }

    const subEvents = payload['subEvents'];
    if (Array.isArray(subEvents)) {
      this.eventForm.subEvents = this.cloneSubEvents(subEvents as AppTypes.SubEventFormItem[]);
    }

    const subEventsDisplayMode = payload['subEventsDisplayMode'];
    if (subEventsDisplayMode === 'Tournament' || subEventsDisplayMode === 'Casual') {
      this.subEventsDisplayMode = subEventsDisplayMode;
    }

    if (typeof payload['startAt'] === 'string' && payload['startAt'].trim()) {
      this.eventForm.startAt = payload['startAt'].trim();
    }
    if (typeof payload['endAt'] === 'string' && payload['endAt'].trim()) {
      this.eventForm.endAt = payload['endAt'].trim();
    }

    this.syncEventDateTimeControlsFromForm();
  }

  private persistModuleEventEditorPayload(): void {
    if (this.eventEditorReadOnly) {
      return;
    }

    this.syncEventFormFromDateTimeControls();
    const normalizedCapacity = this.normalizedEventCapacityRange();
    this.eventForm.capacityMin = normalizedCapacity.min;
    this.eventForm.capacityMax = normalizedCapacity.max;
    this.syncFirstSubEventLocationFromMainEvent();

    const title = this.eventForm.title.trim();
    const description = this.eventForm.description.trim();
    if (!title || !description || !this.eventForm.startAt || !this.eventForm.endAt) {
      this.showEventEditorRequiredValidation = true;
      return;
    }

    this.showEventEditorRequiredValidation = false;
    this.normalizeEventDateRange();
    const savedEventId = this.editingEventId
      ? this.updateExistingEventFromForm()
      : this.insertCreatedEventFromForm();
    if (savedEventId) {
      this.emitActivitiesEventSync(savedEventId, this.eventEditorTarget);
    }

    this.eventEditorService.close();
  }

  private emitActivitiesEventSync(
    eventId: string,
    target: AppTypes.EventEditorTarget,
    membersSnapshot?: { acceptedMembers: number; pendingMembers: number; capacityTotal: number }
  ): void {
    const eventItem = this.eventItems.find(item => item.id === eventId) ?? null;
    const hostingItem = this.hostingItems.find(item => item.id === eventId) ?? null;
    const source = target === 'hosting'
      ? (hostingItem ?? eventItem)
      : (eventItem ?? hostingItem);
    if (!source) {
      return;
    }
    const resolvedMembers = membersSnapshot ?? this.resolveActivitiesEventSyncMembersSnapshot(eventId, target);
    const rowType: 'events' | 'hosting' = target === 'hosting' ? 'hosting' : 'events';
    const row: AppTypes.ActivityListRow = {
      id: source.id,
      type: rowType,
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: this.eventDatesById[source.id] ?? this.hostingDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? this.hostingDistanceById[source.id] ?? 0,
      unread: Math.max(0, Math.trunc(Number(source.activity) || 0)),
      metricScore: Math.max(0, Math.trunc(Number(source.activity) || 0)),
      isAdmin: rowType === 'hosting' ? true : ((eventItem as EventMenuItem | null)?.isAdmin === true),
      source
    };
    const members = this.getActivityMembersByRow(row);
    const acceptedMemberUserIds = Array.from(new Set(members
      .filter(member => member.status === 'accepted')
      .map(member => member.userId)));
    const pendingMemberUserIds = Array.from(new Set(members
      .filter(member => member.status === 'pending')
      .map(member => member.userId)));
    const capacity = this.eventCapacityById[eventId] ?? { min: null, max: null };
    const dateRange = this.activityDateTimeRangeById[eventId];
    const topics = this.eventTopicsById[eventId];
    const location = this.activityEventLocationLabel(row).trim();
    const sourceLink = (this.activitySourceLinkById[eventId] ?? '').trim();
    const payload: Omit<ActivitiesEventSyncPayload, 'syncKey'> = {
      id: eventId,
      target,
      title: source.title,
      shortDescription: source.shortDescription,
      timeframe: source.timeframe,
      activity: Math.max(0, Math.trunc(Number(source.activity) || 0)),
      isAdmin: target === 'hosting' ? true : ((eventItem as EventMenuItem | null)?.isAdmin === true),
      startAt: this.eventDatesById[eventId] ?? this.hostingDatesById[eventId] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[eventId] ?? this.hostingDistanceById[eventId] ?? 0,
      imageUrl: this.activityImageById[eventId] ?? '',
      acceptedMembers: resolvedMembers?.acceptedMembers,
      pendingMembers: resolvedMembers?.pendingMembers,
      capacityTotal: resolvedMembers?.capacityTotal,
      capacityMin: capacity.min,
      capacityMax: capacity.max,
      visibility: this.eventVisibilityById[eventId] ?? (target === 'hosting' ? 'Invitation only' : 'Public'),
      blindMode: this.eventBlindModeById[eventId] ?? 'Open Event',
      published: this.hostingPublishedById[eventId] ?? true,
      creatorUserId: this.activeUser.id,
      creatorName: this.activeUser.name,
      creatorInitials: this.activeUser.initials,
      creatorGender: this.activeUser.gender,
      creatorCity: this.activeUser.city,
      locationCoordinates: this.activeUser.locationCoordinates
        ? {
          latitude: this.activeUser.locationCoordinates.latitude,
          longitude: this.activeUser.locationCoordinates.longitude
        }
        : undefined,
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
    if (dateRange?.endIso) {
      payload.endAt = dateRange.endIso;
    }
    if (location) {
      payload.location = location;
    }
    if (sourceLink) {
      payload.sourceLink = sourceLink;
    }
    if (topics) {
      payload.topics = [...topics];
    }
    this.activitiesContext.emitActivitiesEventSync(payload);
  }

  private resolveActivitiesEventSyncMembersSnapshot(
    eventId: string,
    target: AppTypes.EventEditorTarget
  ): { acceptedMembers: number; pendingMembers: number; capacityTotal: number } | null {
    const eventItem = this.eventItems.find(item => item.id === eventId) ?? null;
    const hostingItem = this.hostingItems.find(item => item.id === eventId) ?? null;
    const source = target === 'hosting'
      ? (hostingItem ?? eventItem)
      : (eventItem ?? hostingItem);
    if (!source) {
      return null;
    }
    const rowType: 'events' | 'hosting' = target === 'hosting' ? 'hosting' : 'events';
    const row: AppTypes.ActivityListRow = {
      id: source.id,
      type: rowType,
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: this.eventDatesById[source.id] ?? this.hostingDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? this.hostingDistanceById[source.id] ?? 0,
      unread: Math.max(0, Math.trunc(Number(source.activity) || 0)),
      metricScore: Math.max(0, Math.trunc(Number(source.activity) || 0)),
      isAdmin: rowType === 'hosting' ? true : ((eventItem as EventMenuItem | null)?.isAdmin === true),
      source
    };
    const members = this.getActivityMembersByRow(row);
    const acceptedMembers = members.filter(member => member.status === 'accepted').length;
    const pendingMembers = members.filter(member => member.status === 'pending').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembers);
    this.activityCapacityById[eventId] = `${acceptedMembers} / ${capacityTotal}`;
    return {
      acceptedMembers,
      pendingMembers,
      capacityTotal
    };
  }

  private emitActivitiesEventSyncForSelectedMembersRow(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId) {
      return;
    }
    const row = this.selectedActivityMembersRow;
    if (row.type !== 'events' && row.type !== 'hosting') {
      return;
    }
    const existsInEvents = this.eventItems.some(item => item.id === row.id);
    const existsInHosting = this.hostingItems.some(item => item.id === row.id);
    if (!existsInEvents && !existsInHosting) {
      return;
    }
    const acceptedMembers = this.selectedActivityMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = this.selectedActivityMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembers);
    this.activityCapacityById[row.id] = `${acceptedMembers} / ${capacityTotal}`;
    this.emitActivitiesEventSync(
      row.id,
      row.type === 'hosting' ? 'hosting' : 'events',
      { acceptedMembers, pendingMembers, capacityTotal }
    );
  }

  protected openEventTopicsSelector(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorReadOnly) {
      return;
    }
    this.interestSelectorSelected = this.resolveInterestSelectorValues(this.eventForm.topics);
    this.superStackedPopup = 'eventTopicsSelector';
  }

  protected openEventSubEventsPopup(event?: Event): void {
    event?.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:openSubEvents'));
    }
  }

  protected closeEventSubEventsPopup(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:closeSubEvents'));
    }
  }

  protected closeEventTopicsSelector(apply = true): void {
    if (apply) {
      this.eventForm.topics = this.interestSelectorSelected
        .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
        .filter(item => item.length > 0)
        .slice(0, 5);
    } else {
      this.interestSelectorSelected = this.resolveInterestSelectorValues(this.eventForm.topics);
    }
    this.superStackedPopup = null;
    this.reopenEventEditorPopupFromState(true);
  }

  protected eventTopicToneClass(option: string): string {
    const normalizedOption = this.normalizeTopicToken(option);
    if (!normalizedOption) {
      return '';
    }
    for (const group of this.interestOptionGroups) {
      if (group.options.some(groupOption => this.normalizeTopicToken(groupOption) === normalizedOption)) {
        return group.toneClass;
      }
    }
    return '';
  }

  protected eventTopicLabel(option: string): string {
    return `#${option.replace(/^#+/, '')}`;
  }

  protected eventTopicsPanelClass(): string {
    return 'section-identity';
  }

  protected eventTopicsPanelIcon(): string {
    return 'sell';
  }

  private normalizeTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  private resolveInterestSelectorValues(values: readonly string[]): string[] {
    const byNormalizedToken = new Map<string, string>();
    for (const option of this.interestAllOptions()) {
      const normalized = this.normalizeTopicToken(option);
      if (normalized) {
        byNormalizedToken.set(normalized, option);
      }
    }
    const resolved: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = this.normalizeTopicToken(value);
      const canonical = byNormalizedToken.get(normalized);
      if (!canonical || seen.has(canonical)) {
        continue;
      }
      seen.add(canonical);
      resolved.push(canonical);
      if (resolved.length >= 5) {
        break;
      }
    }
    return resolved;
  }

  protected get eventFrequencyOptions(): string[] {
    return this.contextualFrequencyOptions(this.eventForm.startAt, this.eventForm.endAt);
  }

  protected eventFrequencyIcon(option: string): string {
    switch (option) {
      case 'Daily':
        return 'today';
      case 'Weekly':
        return 'view_week';
      case 'Bi-weekly':
        return 'date_range';
      case 'Monthly':
        return 'calendar_month';
      default:
        return 'event';
    }
  }

  protected eventFrequencyClass(option: string): string {
    switch (option) {
      case 'Daily':
        return 'event-frequency-daily';
      case 'Weekly':
        return 'event-frequency-weekly';
      case 'Bi-weekly':
        return 'event-frequency-bi-weekly';
      case 'Monthly':
        return 'event-frequency-monthly';
      default:
        return 'event-frequency-one-time';
    }
  }

  protected eventVisibilityIcon(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  protected eventVisibilityClass(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'event-visibility-public';
      case 'Friends only':
        return 'event-visibility-friends';
      default:
        return 'event-visibility-invitation';
    }
  }

  protected eventBlindModeIcon(option: AppTypes.EventBlindMode): string {
    return option === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  protected eventBlindModeClass(option: AppTypes.EventBlindMode): string {
    return option === 'Blind Event' ? 'blind-mode-blind' : 'blind-mode-open';
  }

  protected eventBlindModeDescription(option: AppTypes.EventBlindMode): string {
    return option === 'Blind Event'
      ? 'Attendees won’t see each other before the event.'
      : 'Attendees can preview each other before the event.';
  }

  protected toggleEventBlindMode(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.blindMode = this.eventForm.blindMode === 'Blind Event' ? 'Open Event' : 'Blind Event';
  }

  protected toggleEventAutoInviter(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.autoInviter = !this.eventForm.autoInviter;
  }

  protected eventAutoInviterClass(enabled: boolean): string {
    return enabled ? 'auto-inviter-on' : 'auto-inviter-off';
  }

  protected eventAutoInviterIcon(enabled: boolean): string {
    return enabled ? 'group_add' : 'person_off';
  }

  protected eventAutoInviterLabel(enabled: boolean): string {
    return enabled ? 'Auto Inviter On' : 'Auto Inviter Off';
  }

  protected eventAutoInviterDescription(enabled: boolean): string {
    return enabled
      ? 'Invites people by matching mutual preferences.'
      : 'Manual invites only.';
  }

  protected toggleEventTicketing(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.ticketing = !this.eventForm.ticketing;
  }

  protected eventTicketingClass(enabled: boolean): string {
    return enabled ? 'event-ticketing-on' : 'event-ticketing-off';
  }

  protected eventTicketingIcon(enabled: boolean): string {
    return enabled ? 'qr_code_scanner' : 'qr_code_2';
  }

  protected eventTicketingLabel(enabled: boolean): string {
    return enabled ? 'Ticketing On' : 'Ticketing Off';
  }

  protected eventTicketingDescription(enabled: boolean): string {
    return enabled
      ? 'QR attendee check-in is enabled.'
      : 'No QR check-in scanning.';
  }


  protected subEventCardRange(item: AppTypes.SubEventFormItem): string {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Date pending';
    }
    const startLabel = `${AppUtils.pad2(start.getMonth() + 1)}/${AppUtils.pad2(start.getDate())} ${AppUtils.pad2(start.getHours())}:${AppUtils.pad2(start.getMinutes())}`;
    const endLabel = `${AppUtils.pad2(end.getMonth() + 1)}/${AppUtils.pad2(end.getDate())} ${AppUtils.pad2(end.getHours())}:${AppUtils.pad2(end.getMinutes())}`;
    return `${startLabel} - ${endLabel}`;
  }

  protected subEventCardMeta(item: AppTypes.SubEventFormItem): string {
    return item.optional ? 'Optional' : 'Mandatory';
  }

  protected subEventCapacityLabel(item: AppTypes.SubEventFormItem): string {
    return `${item.membersAccepted} / ${item.capacityMin} - ${item.capacityMax}`;
  }

  protected subEventCapacityStateClass(item: AppTypes.SubEventFormItem): string {
    return item.membersAccepted >= item.capacityMin && item.membersAccepted <= item.capacityMax
      ? 'subevent-capacity-in-range'
      : 'subevent-capacity-out-of-range';
  }

  protected subEventAssetCapacityLabel(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): string {
    this.syncSubEventAssetBadgeCounts(item, type);
    const metrics = this.subEventAssetCapacityMetrics(item, type);
    return `${metrics.joined} / ${metrics.capacityMin} - ${metrics.capacityMax}`;
  }

  protected subEventAssetCapacityStateClass(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): string {
    const metrics = this.subEventAssetCapacityMetrics(item, type);
    return metrics.joined >= metrics.capacityMin && metrics.joined <= metrics.capacityMax
      ? 'subevent-capacity-in-range'
      : 'subevent-capacity-out-of-range';
  }

  protected subEventAssetBadgePendingCount(item: AppTypes.SubEventFormItem, type: AppTypes.AssetType): number {
    this.syncSubEventAssetBadgeCounts(item, type);
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(item.carsPending) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(item.accommodationPending) || 0));
    }
    return Math.max(0, Math.trunc(Number(item.suppliesPending) || 0));
  }

  protected subEventMenuPendingCount(item: AppTypes.SubEventFormItem, tournamentMode = false): number {
    const members = item.optional || tournamentMode
      ? this.subEventMembersBadgePendingCount(item)
      : 0;
    return members
      + this.subEventAssetBadgePendingCount(item, 'Car')
      + this.subEventAssetBadgePendingCount(item, 'Accommodation')
      + this.subEventAssetBadgePendingCount(item, 'Supplies');
  }


  protected openSubEventBadgePopup(
    type: 'Members' | 'Car' | 'Accommodation' | 'Supplies',
    item: AppTypes.SubEventFormItem,
    event?: Event,
    group?: Partial<Pick<AppTypes.SubEventTournamentGroup, 'id' | 'groupLabel'>> | null,
    originOverride?: 'active-event-editor' | 'stacked-event-editor' | 'chat'
  ): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    const popupMembersContext = this.popupMembersContextForSubEvent(item, group?.id);
    if (originOverride) {
      this.subEventBadgePopupOrigin = originOverride;
    } else if (this.eventEditorService.isOpen()) {
      this.subEventBadgePopupOrigin = 'stacked-event-editor';
    } else {
      this.subEventBadgePopupOrigin = 'active-event-editor';
    }
    if (this.subEventBadgePopupOrigin !== 'chat') {
      this.subEventResourceFallbackCardsByType = null;
    }
    this.selectedSubEventBadgeContext = {
      subEvent: item,
      type,
      groupId: group?.id,
      groupName: group?.groupLabel
    };
    if (popupMembersContext) {
      this.subEventMembersRow = popupMembersContext.row;
      const rowKey = popupMembersContext.rowKey;
      const seededEntries = this.sortActivityMembersByActionTimeAsc(popupMembersContext.entries);
      this.subEventMembersRowId = rowKey;
      this.selectedActivityMembersRow = popupMembersContext.row;
      this.selectedActivityMembersRowId = rowKey;
      this.selectedActivityMembers = [...seededEntries];
      this.activityMembersByRowId[rowKey] = [...seededEntries];
      this.syncSelectedSubEventMembersCounts(seededEntries);
    } else {
      this.subEventMembersRow = null;
      this.subEventMembersRowId = null;
    }
    this.subEventMembersPendingOnly = type === 'Members';
    this.subEventAssetMembersContext = null;
    this.subEventMemberRolePickerUserId = null;
    this.subEventAssetAssignContext = null;
    this.selectedSubEventAssignAssetIds = [];
    this.subEventAssetCapacityEditor = null;
    this.subEventAssetRouteEditor = null;
    this.subEventResourceFilter = this.normalizeSubEventResourceFilter(type === 'Members' ? null : type, type);
    this.stackedPopup = type === 'Members' ? 'subEventMembers' : 'subEventAssets';
  }

  private popupMembersContextForSubEvent(
    item: AppTypes.SubEventFormItem,
    groupId?: string
  ): { row: AppTypes.ActivityListRow; rowKey: string; entries: AppTypes.ActivityMemberEntry[] } | null {
    const editorRow = this.eventEditorMembersRow();
    if (editorRow) {
      const rowKey = `${editorRow.type}:${editorRow.id}`;
      const cached = this.activityMembersByRowId[rowKey];
      return {
        row: editorRow,
        rowKey,
        entries: cached
          ? this.sortActivityMembersByActionTimeAsc([...cached])
          : this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(editorRow))
      };
    }

    const chat = this.activitiesContext.eventChatSession()?.item ?? null;
    if (!chat) {
      return null;
    }
    const groups = this.subEventGroupsForStage(item);
    const group = groupId ? (groups.find(entry => entry.id === groupId) ?? null) : null;
    const target = this.contextualSubEventMemberTargets(item, group, groups);
    const unread = this.contextualChatUnreadCount(chat);
    const row: AppTypes.ActivityListRow = {
      id: `subevent-members:${chat.id}`,
      type: 'chats',
      title: chat.title,
      subtitle: chat.title,
      detail: this.chatContextDetailLine(chat),
      dateIso: this.chatDatesById[chat.id] ?? this.defaultEventStartIso(),
      distanceKm: this.chatDistanceById[chat.id] ?? 0,
      unread,
      metricScore: unread,
      source: chat
    };
    const rowKey = `${row.type}:${row.id}`;
    const cached = this.activityMembersByRowId[rowKey];
    return {
      row,
      rowKey,
      entries: cached
        ? this.sortActivityMembersByActionTimeAsc([...cached])
        : this.seededChatSubEventMembersEntries(row, rowKey, chat.id, target)
    };
  }

  private seededChatSubEventMembersEntries(
    row: AppTypes.ActivityListRow,
    rowKey: string,
    chatId: string,
    target: { accepted: number; pending: number; total: number }
  ): AppTypes.ActivityMemberEntry[] {
    const chatMemberIds = this.getChatMembersById(chatId).map(member => member.id);
    const memberIds = this.contextualChatMemberIds(
      `chat-popup-members:${chatId}`,
      chatMemberIds,
      target.total
    );
    const users = memberIds
      .map(userId => this.users.find(user => user.id === userId) ?? null)
      .filter((user): user is DemoUser => Boolean(user));
    const seedBaseDate = new Date('2026-03-01T12:00:00');
    const entries = users.map((user, index) => {
      const accepted = index < target.accepted;
      const defaults = accepted
        ? AppDemoGenerators.toActivityMemberEntry(
          user,
          row,
          rowKey,
          this.activeUser.id,
          {
            status: 'accepted',
            pendingSource: null,
            invitedByActiveUser: false
          },
          APP_DEMO_DATA.activityMemberMetPlaces
        )
        : AppDemoGenerators.toActivityMemberEntry(
          user,
          row,
          rowKey,
          this.activeUser.id,
          {
            status: 'pending',
            pendingSource: 'member',
            invitedByActiveUser: user.id === this.activeUser.id
          },
          APP_DEMO_DATA.activityMemberMetPlaces
        );
      return {
        ...defaults,
        status: accepted ? ('accepted' as const) : ('pending' as const),
        pendingSource: accepted ? null : ('member' as const),
        requestKind: accepted ? null : ('join' as const),
        statusText: accepted ? defaults.statusText : 'Waiting for owner approval.',
        actionAtIso: AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -(index + 1)))
      };
    });
    return this.sortActivityMembersByActionTimeAsc(entries);
  }

  protected handleSubEventQuickAction(message: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.alertService.open(message);
  }

  protected readonly subEventResourceFilterOptions: readonly AppTypes.AssetType[] = ['Car', 'Accommodation', 'Supplies'];

  protected selectSubEventResourceFilter(filter: AppTypes.SubEventResourceFilter): void {
    this.subEventResourceFilter = this.normalizeSubEventResourceFilter(filter);
    this.suppressSelectOverlayBackdropPointerEvents();
    this.subEventAssetMembersContext = null;
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
    this.subEventMembersPendingOnly = false;
  }

  protected onSubEventResourceFilterOpened(isOpen: boolean, select: MatSelect): void {
    if (!isOpen || this.stackedPopup !== 'subEventAssets' || typeof window === 'undefined') {
      return;
    }
    const repositionOverlay = (
      select as unknown as { _overlayDir?: { overlayRef?: { updatePosition: () => void } } }
    )._overlayDir?.overlayRef;
    const reposition = (): void => {
      if (!select.panelOpen) {
        return;
      }
      repositionOverlay?.updatePosition();
    };
    window.requestAnimationFrame(() => {
      reposition();
      window.setTimeout(reposition, 0);
      window.setTimeout(reposition, 40);
    });
  }

  protected subEventResourceTypeIcon(type: AppTypes.SubEventResourceFilter): string {
    if (type === 'Members') {
      return 'groups';
    }
    return this.assetTypeIcon(type);
  }

  protected subEventResourceTypeClass(type: AppTypes.SubEventResourceFilter): string {
    if (type === 'Members') {
      return 'asset-filter-members';
    }
    return this.assetTypeClass(type);
  }

  protected subEventResourceFilterCount(type: AppTypes.SubEventResourceFilter): number {
    if (!this.selectedSubEventBadgeContext) {
      return 0;
    }
    const subEvent = this.selectedSubEventBadgeContext.subEvent;
    const isGroupScoped = this.isGroupScopedSubEventResourceContext();
    if (type === 'Members') {
      return isGroupScoped
        ? Math.max(0, Math.trunc(Number(subEvent.membersPending) || 0))
        : this.subEventMembersPendingCount();
    }
    if (!isGroupScoped) {
      this.syncSubEventAssetBadgeCounts(subEvent, type);
    }
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(subEvent.carsPending) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationPending) || 0));
    }
    if (type !== 'Supplies') {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(subEvent.suppliesPending) || 0));
  }

  protected subEventMembersBadgePendingCount(subEvent: AppTypes.SubEventFormItem): number {
    const fallback = Math.max(0, Math.trunc(Number(subEvent.membersPending) || 0));
    const membersRow = this.eventEditorMembersRow();
    if (!membersRow) {
      return fallback;
    }
    return this.getActivityMembersByRow(membersRow).filter(member => member.status === 'pending').length;
  }

  protected isSubEventMembersPopup(): boolean {
    if (!this.selectedSubEventBadgeContext) {
      return false;
    }
    return this.stackedPopup === 'subEventMembers';
  }

  protected subEventMembersHeaderTitle(): string {
    const subEvent = this.selectedSubEventBadgeContext?.subEvent;
    if (!subEvent) {
      return 'Members';
    }
    const stageLabel = this.subEventMembersStageLabel(subEvent);
    return stageLabel ? `Members - ${stageLabel}` : 'Members';
  }

  protected subEventMembersHeaderSubtitle(): string {
    const subEventName = this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent);
    const eventName = this.subEventMembersEventTitle();
    if (eventName && subEventName) {
      return `${eventName} - ${subEventName}`;
    }
    return eventName || subEventName || 'Event';
  }

  protected subEventAssetsHeaderTitle(): string {
    const subEvent = this.selectedSubEventBadgeContext?.subEvent;
    if (!subEvent) {
      return this.subEventResourceFilter;
    }
    const stageLabel = this.subEventMembersStageLabel(subEvent);
    return stageLabel ? `${this.subEventResourceFilter} - ${stageLabel}` : `${this.subEventResourceFilter}`;
  }

  protected subEventAssetsHeaderSubtitle(): string {
    const subEventName = this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent);
    const eventName = this.subEventMembersEventTitle();
    if (eventName && subEventName) {
      return `${eventName} - ${subEventName}`;
    }
    return eventName || subEventName || 'Event';
  }

  protected subEventMembersHeaderSummary(): string {
    if (this.isGroupScopedSubEventResourceContext()) {
      const subEvent = this.selectedSubEventBadgeContext?.subEvent;
      const pendingCount = Math.max(0, Math.trunc(Number(subEvent?.membersPending) || 0));
      const acceptedCount = Math.max(0, Math.trunc(Number(subEvent?.membersAccepted) || 0));
      if (pendingCount <= 0) {
        return `${acceptedCount} members`;
      }
      return `${acceptedCount} members · ${pendingCount} pending`;
    }
    const members = this.subEventMembersEntries();
    const pendingCount = members.filter(member => member.status === 'pending').length;
    const acceptedCount = members.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected subEventAssetsHeaderSummary(): string {
    const context = this.selectedSubEventBadgeContext;
    if (!context) {
      return '0 members';
    }
    const resourceType = this.subEventResourceFilter as AppTypes.AssetType;
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, resourceType);
    const acceptedCount = Math.max(0, Math.trunc(Number(metrics.joined) || 0));
    const pendingCount = Math.max(0, Math.trunc(Number(metrics.pending) || 0));
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected get subEventMembersOrdered(): AppTypes.ActivityMemberEntry[] {
    const entries = this.subEventMembersEntries();
    if (!this.subEventMembersPendingOnly) {
      return entries;
    }
    return entries.filter(member => member.status === 'pending');
  }

  protected canShowSubEventMembersInviteButton(): boolean {
    return this.resolveSubEventMembersContext() !== null;
  }

  protected subEventMembersPendingCount(): number {
    if (this.isGroupScopedSubEventResourceContext()) {
      return Math.max(0, Math.trunc(Number(this.selectedSubEventBadgeContext?.subEvent.membersPending) || 0));
    }
    return this.subEventMembersEntries().filter(member => member.status === 'pending').length;
  }

  protected toggleSubEventMembersPendingOnly(event?: Event): void {
    event?.stopPropagation();
    if (this.stackedPopup !== 'subEventMembers') {
      return;
    }
    this.subEventMembersPendingOnly = !this.subEventMembersPendingOnly;
  }

  protected openSubEventMembersInviteFriends(event?: Event): void {
    event?.stopPropagation();
    const context = this.resolveSubEventMembersContext();
    if (!context || !this.canShowSubEventMembersInviteButton()) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
    const seededEntries = this.subEventMembersEntries();
    this.selectedActivityMembersRow = context.row;
    this.selectedActivityMembersRowId = context.rowKey;
    this.selectedActivityMembers = [...seededEntries];
    this.selectedActivityMembersTitle = context.row.title;
    this.openActivityInviteFriends(event);
  }

  protected openSubEventAssetAssignPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedSubEventBadgeContext || this.stackedPopup !== 'subEventAssets') {
      return;
    }
    const contextType = this.subEventResourceFilter as AppTypes.AssetType;
    const subEventId = this.selectedSubEventBadgeContext.subEvent.id;
    this.subEventAssetAssignContext = { subEventId, type: contextType };
    this.selectedSubEventAssignAssetIds = [...this.resolveSubEventAssignedAssetIds(subEventId, contextType)];
    this.superStackedPopup = 'subEventAssetAssign';
  }

  protected closeSubEventAssetAssignPopup(apply = false): void {
    if (this.superStackedPopup === 'subEventAssetAssign' && apply) {
      this.applySubEventAssetAssignments();
    }
    this.subEventAssetAssignContext = null;
    this.selectedSubEventAssignAssetIds = [];
    if (this.superStackedPopup === 'subEventAssetAssign') {
      this.superStackedPopup = null;
    }
  }

  protected canConfirmSubEventAssetAssignSelection(): boolean {
    return this.selectedSubEventAssignAssetIds.length > 0;
  }

  protected confirmSubEventAssetAssignSelection(event?: Event): void {
    event?.stopPropagation();
    if (!this.canConfirmSubEventAssetAssignSelection()) {
      return;
    }
    this.closeSubEventAssetAssignPopup(true);
  }

  protected get subEventAssetAssignCandidates(): AppTypes.AssetCard[] {
    const context = this.subEventAssetAssignContext;
    if (!context) {
      return [];
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEventId, context.type));
    return this.ownedAssets.assetCards
      .filter(card => card.type === context.type)
      .sort((a, b) => {
        const aAssigned = assignedIds.has(a.id) ? 1 : 0;
        const bAssigned = assignedIds.has(b.id) ? 1 : 0;
        if (bAssigned !== aAssigned) {
          return bAssigned - aAssigned;
        }
        return a.title.localeCompare(b.title);
      });
  }

  protected get selectedSubEventAssetAssignChips(): AppTypes.AssetCard[] {
    const selected = new Set(this.selectedSubEventAssignAssetIds);
    return this.subEventAssetAssignCandidates.filter(card => selected.has(card.id));
  }

  protected subEventAssetAssignHeaderTitle(): string {
    const typeLabel = this.subEventAssetAssignContext?.type ?? this.subEventResourceFilter;
    const subEvent = this.selectedSubEventBadgeContext?.subEvent;
    if (!subEvent) {
      return `Assign ${typeLabel}`;
    }
    const stageLabel = this.subEventMembersStageLabel(subEvent);
    return stageLabel ? `Assign ${typeLabel} - ${stageLabel}` : `Assign ${typeLabel}`;
  }

  protected subEventAssetAssignHeaderSubtitle(): string {
    const subEventName = this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent);
    const eventName = this.subEventMembersEventTitle();
    if (eventName && subEventName) {
      return `${eventName} - ${subEventName}`;
    }
    return eventName || subEventName || 'Event';
  }

  protected toggleSubEventAssetAssignCard(cardId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedSubEventAssignAssetIds.includes(cardId)) {
      this.selectedSubEventAssignAssetIds = this.selectedSubEventAssignAssetIds.filter(id => id !== cardId);
      return;
    }
    this.selectedSubEventAssignAssetIds = [...this.selectedSubEventAssignAssetIds, cardId];
  }

  protected isSubEventAssetAssignCardSelected(cardId: string): boolean {
    return this.selectedSubEventAssignAssetIds.includes(cardId);
  }

  protected openSubEventResourceCreateForm(event?: Event): void {
    event?.stopPropagation();
    if (this.subEventResourceFilter === 'Members') {
      return;
    }
    const subEventId = this.selectedSubEventBadgeContext?.subEvent.id ?? null;
    const resourceType = this.subEventResourceFilter as AppTypes.AssetType;
    this.ownedAssets.openPopup(resourceType === 'Supplies' ? 'Supplies' : resourceType);
    this.ownedAssets.openAssetForm();
    this.ownedAssets.assetForm.type = resourceType;
    this.ownedAssets.assetForm.routes = this.normalizeAssetRoutes(resourceType, this.ownedAssets.assetForm.routes, '');
    this.pendingSubEventAssetCreateAssignment = subEventId
      ? { subEventId, type: resourceType }
      : null;
  }

  protected toggleSubEventResourceItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId) {
      return;
    }
    if (this.inlineItemActionMenu?.scope === 'subEventAsset' && this.inlineItemActionMenu.id === card.id) {
      this.inlineItemActionMenu = null;
      this.subEventAssetMenuIgnoreCloseUntilMs = 0;
      return;
    }
    this.inlineItemActionMenu = {
      scope: 'subEventAsset',
      id: card.id,
      title: card.title,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
    this.subEventAssetMenuIgnoreCloseUntilMs = Date.now() + 220;
  }

  protected isSubEventResourceItemActionMenuOpen(card: AppTypes.SubEventResourceCard): boolean {
    return this.inlineItemActionMenu?.scope === 'subEventAsset' && this.inlineItemActionMenu.id === card.id;
  }

  protected isSubEventResourceItemActionMenuOpenUp(card: AppTypes.SubEventResourceCard): boolean {
    return this.inlineItemActionMenu?.scope === 'subEventAsset'
      && this.inlineItemActionMenu.id === card.id
      && this.inlineItemActionMenu.openUp;
  }

  protected openSubEventAssetMembers(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedSubEventBadgeContext || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return;
    }
    const subEvent = this.selectedSubEventBadgeContext.subEvent;
    const type = card.type;
    const sourceCard = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
    if (!sourceCard) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const ownerUserId = settings[card.sourceAssetId]?.addedByUserId ?? null;
    const canManage = ownerUserId === this.activeUser.id;
    const rowId = `subevent-asset-members:${subEvent.id}:${type}:${card.sourceAssetId}`;
    const rowKey = `events:${rowId}`;
    const membersRow: AppTypes.ActivityListRow = {
      id: rowId,
      type: 'events',
      title: `${sourceCard.title} Members`,
      subtitle: `${subEvent.name} · ${sourceCard.title}`,
      detail: '',
      dateIso: this.eventForm.startAt || this.defaultEventStartIso(),
      distanceKm: 0,
      unread: 0,
      metricScore: 0,
      isAdmin: canManage,
      source: {} as EventMenuItem
    };
    this.subEventAssetMembersContext = {
      subEventId: subEvent.id,
      assetId: sourceCard.id,
      type,
      ownerUserId
    };
    this.pendingActivityMemberDelete = null;
    this.activityMembersPendingOnly = false;
    this.inlineItemActionMenu = null;
    this.selectedActivityMembersRow = membersRow;
    this.selectedActivityMembersRowId = rowKey;
    this.selectedActivityMembers = this.subEventAssetMemberEntries(sourceCard);
    this.activityMembersByRowId[rowKey] = [...this.selectedActivityMembers];
    this.selectedActivityMembersTitle = `${sourceCard.title} · ${this.subEventDisplayName(subEvent)}`;
    this.activityInviteSort = 'recent';
    this.showActivityInviteSortPicker = false;
    this.selectedActivityInviteUserIds = [];
    this.activityMembersReadOnly = !canManage;
    this.activityMembersPopupOrigin = 'subevent-asset';
    this.superStackedPopup = null;
    this.stackedPopup = 'activityMembers';
  }

  protected openSubEventResourceBadgeDetails(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenSubEventResourceBadgeDetails(card)) {
      return;
    }
    if (card.type === 'Car' || card.type === 'Accommodation') {
      this.openSubEventAssetMembers(card, event);
      return;
    }
    this.openSubEventSupplyContributionsPopup(card, event);
  }

  protected canOpenSubEventAssetMembers(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation');
  }

  protected canOpenSubEventResourceBadgeDetails(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  protected subEventSupplyContributionsHeaderTitle(): string {
    const context = this.selectedSubEventSupplyContributionContext;
    const subEvent = this.selectedSubEventBadgeContext?.subEvent;
    if (!context) {
      return 'Supplies';
    }
    const stageLabel = subEvent ? this.subEventMembersStageLabel(subEvent) : '';
    return stageLabel ? `${context.title} - ${stageLabel}` : context.title;
  }

  protected subEventSupplyContributionsHeaderSubtitle(): string {
    const subEventName = this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent);
    const eventName = this.subEventMembersEventTitle();
    if (eventName && subEventName) {
      return `${eventName} - ${subEventName}`;
    }
    return eventName || subEventName || 'Event';
  }

  private openSubEventSupplyContributionsPopup(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedSubEventBadgeContext || card.type !== 'Supplies' || !card.sourceAssetId) {
      return;
    }
    const subEventId = this.selectedSubEventBadgeContext.subEvent.id;
    this.selectedSubEventSupplyContributionContext = {
      subEventId,
      assetId: card.sourceAssetId,
      title: card.title
    };
    this.pendingSubEventSupplyContributionDelete = null;
    this.stackedPopup = 'subEventSupplyContributions';
  }

  protected canJoinSubEventResourceCard(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation');
  }

  protected canBringSubEventSupplyCard(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && card.type === 'Supplies';
  }

  protected canEditSubEventResourceCapacity(card: AppTypes.SubEventResourceCard): boolean {
    if (!card.sourceAssetId || card.type === 'Members' || !this.selectedSubEventBadgeContext) {
      return false;
    }
    const subEventId = this.selectedSubEventBadgeContext.subEvent.id;
    const type = card.type as AppTypes.AssetType;
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    return settings[card.sourceAssetId]?.addedByUserId === this.activeUser.id;
  }

  protected canEditSubEventResourceRoute(card: AppTypes.SubEventResourceCard): boolean {
    return this.canEditSubEventResourceCapacity(card) && card.type === 'Car';
  }

  protected subEventResourceRouteMenuLabel(_card: AppTypes.SubEventResourceCard): string {
    return 'Edit Route';
  }

  protected openSubEventResourceRouteEditor(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!this.selectedSubEventBadgeContext || !card.sourceAssetId || !this.canEditSubEventResourceRoute(card)) {
      return;
    }
    const type = card.type;
    if (type !== 'Car') {
      return;
    }
    const subEventId = this.selectedSubEventBadgeContext.subEvent.id;
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
    const routes = this.normalizeAssetRoutes(type, settings[card.sourceAssetId]?.routes ?? source?.routes, '');
    this.subEventAssetRouteEditor = {
      subEventId,
      type,
      assetId: card.sourceAssetId,
      title: card.title,
      routes
    };
    this.subEventAssetCapacityEditor = null;
    this.inlineItemActionMenu = null;
  }

  protected closeSubEventResourceRouteEditor(event?: Event): void {
    event?.stopPropagation();
    this.subEventAssetRouteEditor = null;
  }

  protected subEventAssetRouteEditorSupportsMultiRoute(): boolean {
    return !!this.subEventAssetRouteEditor;
  }

  protected onSubEventAssetRouteStopChange(index: number, value: string): void {
    const editor = this.subEventAssetRouteEditor;
    if (!editor || index < 0 || index >= editor.routes.length) {
      return;
    }
    editor.routes[index] = value;
  }

  protected addSubEventAssetRouteStop(): void {
    const editor = this.subEventAssetRouteEditor;
    if (!editor) {
      return;
    }
    editor.routes = [...editor.routes, ''];
  }

  protected removeSubEventAssetRouteStop(index: number): void {
    const editor = this.subEventAssetRouteEditor;
    if (!editor || index < 0 || index >= editor.routes.length) {
      return;
    }
    editor.routes.splice(index, 1);
  }

  protected dropSubEventAssetRouteStop(event: CdkDragDrop<string[]>): void {
    const editor = this.subEventAssetRouteEditor;
    if (!editor) {
      return;
    }
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(editor.routes, event.previousIndex, event.currentIndex);
  }

  protected openSubEventAssetRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const editor = this.subEventAssetRouteEditor;
    if (!editor) {
      return;
    }
    this.openGoogleMapsSearch(editor.routes[index] ?? '');
  }

  protected canOpenSubEventAssetRouteMap(): boolean {
    const editor = this.subEventAssetRouteEditor;
    return !!editor && editor.routes.some(stop => stop.trim().length > 0);
  }

  protected openSubEventAssetRouteMap(event?: Event): void {
    event?.stopPropagation();
    const editor = this.subEventAssetRouteEditor;
    if (!editor) {
      return;
    }
    this.openGoogleMapsDirections(editor.routes);
  }

  protected canSubmitSubEventResourceRouteEditor(): boolean {
    const editor = this.subEventAssetRouteEditor;
    return !!editor && editor.routes.some(stop => stop.trim().length > 0);
  }

  protected saveSubEventResourceRouteEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.subEventAssetRouteEditor;
    if (!editor || !this.canSubmitSubEventResourceRouteEditor()) {
      return;
    }
    const key = this.subEventAssetAssignmentKey(editor.subEventId, editor.type);
    const settings = { ...this.getSubEventAssignedAssetSettings(editor.subEventId, editor.type) };
    const source = this.ownedAssets.assetCards.find(item => item.id === editor.assetId && item.type === editor.type);
    const current = settings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source?.capacityTotal ?? 0),
      addedByUserId: this.activeUser.id,
      routes: []
    };
    settings[editor.assetId] = {
      ...current,
      routes: this.normalizeAssetRoutes(editor.type, editor.routes, '')
    };
    this.subEventAssignedAssetSettingsByKey[key] = settings;
    this.refreshEventChatSessionResourceContext(editor.subEventId);
    this.subEventAssetRouteEditor = null;
  }

  protected runSubEventResourceJoinAction(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!this.canJoinSubEventResourceCard(card) || !card.sourceAssetId) {
      return;
    }
    const mainAcceptedIds = new Set(
      this.mainEventMembersEntries()
        .filter(member => member.status === 'accepted')
        .map(member => member.userId)
    );
    const requiresEventAdminApproval = !mainAcceptedIds.has(this.activeUser.id);
    if (requiresEventAdminApproval) {
      this.ensureMainEventMemberPendingApproval(this.activeUser.id, AppUtils.toIsoDateTime(new Date()));
    }
    const requestId = this.activeUser.id;
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(asset => {
      if (asset.id !== card.sourceAssetId) {
        return asset;
      }
      const existing = asset.requests.find(request => AppUtils.resolveAssetRequestUserId(request, this.users) === requestId);
      if (existing) {
        return {
          ...asset,
          requests: asset.requests.map(request =>
            AppUtils.resolveAssetRequestUserId(request, this.users) === requestId
              ? {
                ...request,
                userId: this.activeUser.id,
                status: 'pending',
                note: requiresEventAdminApproval
                  ? 'Waiting for event admin approval.'
                  : 'Join request from sub-event assets.'
              }
              : request
          )
        };
      }
      return {
        ...asset,
        requests: [
          {
            id: requestId,
            userId: this.activeUser.id,
            name: this.activeUser.name,
            initials: this.activeUser.initials,
            gender: this.activeUser.gender,
            status: 'pending',
            note: requiresEventAdminApproval
              ? 'Waiting for event admin approval.'
              : 'Join request from sub-event assets.'
          },
          ...asset.requests
        ]
      };
    });
    this.inlineItemActionMenu = null;
    const subEvent = this.selectedSubEventBadgeContext?.subEvent;
    if (subEvent && card.type !== 'Members') {
      this.syncSubEventAssetBadgeCounts(subEvent, card.type);
    }
  }

  protected openSubEventResourceCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!this.selectedSubEventBadgeContext || !card.sourceAssetId || card.type === 'Members') {
      return;
    }
    if (!this.canEditSubEventResourceCapacity(card)) {
      return;
    }
    const type = card.type as AppTypes.AssetType;
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
    if (!source) {
      return;
    }
    const subEventId = this.selectedSubEventBadgeContext.subEvent.id;
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const setting = settings[card.sourceAssetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source.capacityTotal),
      addedByUserId: this.activeUser.id,
      routes: this.normalizeAssetRoutes(type, source.routes, '')
    };
    const capacityLimit = Math.max(0, source.capacityTotal);
    const capacityMax = AppUtils.clampNumber(Math.trunc(setting.capacityMax), 0, capacityLimit);
    const capacityMin = AppUtils.clampNumber(Math.trunc(setting.capacityMin), 0, capacityMax);
    this.subEventAssetCapacityEditor = {
      subEventId,
      type,
      assetId: card.sourceAssetId,
      title: card.title,
      capacityMin,
      capacityMax,
      capacityLimit
    };
    this.subEventAssetRouteEditor = null;
    this.inlineItemActionMenu = null;
  }

  protected closeSubEventResourceCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    this.subEventAssetCapacityEditor = null;
  }

  protected canSubmitSubEventResourceCapacityEditor(): boolean {
    if (!this.subEventAssetCapacityEditor) {
      return false;
    }
    const { capacityMin, capacityMax, capacityLimit } = this.subEventAssetCapacityEditor;
    return Number.isFinite(capacityMin)
      && Number.isFinite(capacityMax)
      && capacityMin >= 0
      && capacityMax >= capacityMin
      && capacityMax <= capacityLimit;
  }

  protected onSubEventResourceCapacityMinChange(value: number | string): void {
    if (!this.subEventAssetCapacityEditor) {
      return;
    }
    const parsed = Number(value);
    const capacityMin = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : this.subEventAssetCapacityEditor.capacityMin,
      0,
      this.subEventAssetCapacityEditor.capacityMax
    );
    this.subEventAssetCapacityEditor = {
      ...this.subEventAssetCapacityEditor,
      capacityMin
    };
  }

  protected onSubEventResourceCapacityMaxChange(value: number | string): void {
    if (!this.subEventAssetCapacityEditor) {
      return;
    }
    const parsed = Number(value);
    const capacityMax = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : this.subEventAssetCapacityEditor.capacityMax,
      0,
      this.subEventAssetCapacityEditor.capacityLimit
    );
    const capacityMin = Math.min(this.subEventAssetCapacityEditor.capacityMin, capacityMax);
    this.subEventAssetCapacityEditor = {
      ...this.subEventAssetCapacityEditor,
      capacityMin,
      capacityMax
    };
  }

  protected saveSubEventResourceCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.subEventAssetCapacityEditor;
    if (!editor || !this.canSubmitSubEventResourceCapacityEditor()) {
      return;
    }
    const key = this.subEventAssetAssignmentKey(editor.subEventId, editor.type);
    const settings = { ...this.getSubEventAssignedAssetSettings(editor.subEventId, editor.type) };
    const current = settings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: editor.capacityLimit,
      addedByUserId: this.activeUser.id,
      routes: []
    };
    settings[editor.assetId] = {
      ...current,
      capacityMin: AppUtils.clampNumber(Math.trunc(editor.capacityMin), 0, editor.capacityMax),
      capacityMax: AppUtils.clampNumber(Math.trunc(editor.capacityMax), 0, editor.capacityLimit)
    };
    this.subEventAssignedAssetSettingsByKey[key] = settings;
    const subEvent = this.resolveSubEventForResourceSync(editor.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, editor.type);
    } else {
      this.refreshEventChatSessionResourceContext(editor.subEventId);
    }
    this.subEventAssetCapacityEditor = null;
  }

  protected runSubEventResourceDeleteAction(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId) {
      return;
    }
    if (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies') {
      this.ownedAssets.openPopup(card.type);
    }
    this.ownedAssets.pendingAssetDeleteCardId = card.sourceAssetId;
    this.inlineItemActionMenu = null;
  }

  protected openSubEventSupplyBringDialog(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    const subEventId = this.selectedSubEventBadgeContext?.subEvent.id ?? null;
    if (!subEventId || !this.canBringSubEventSupplyCard(card) || !card.sourceAssetId) {
      return;
    }
    this.inlineItemActionMenu = null;
    const max = Math.max(1, card.capacityTotal);
    this.subEventSupplyBringDialog = {
      subEventId,
      cardId: card.sourceAssetId,
      title: card.title,
      quantity: 1,
      min: 0,
      max
    };
  }

  protected openSubEventSupplyBringDialogFromContributionPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.selectedSubEventSupplyContributionContext;
    if (!context) {
      return;
    }
    const source = this.ownedAssets.assetCards.find(card => card.id === context.assetId && card.type === 'Supplies');
    const settings = this.getSubEventAssignedAssetSettings(context.subEventId, 'Supplies');
    const fallbackCapacity = source?.capacityTotal ?? 1;
    const max = Math.max(1, settings[context.assetId]?.capacityMax ?? fallbackCapacity);
    this.inlineItemActionMenu = null;
    this.subEventSupplyBringDialog = {
      subEventId: context.subEventId,
      cardId: context.assetId,
      title: context.title,
      quantity: 1,
      min: 0,
      max
    };
  }

  protected cancelSubEventSupplyBringDialog(): void {
    this.subEventSupplyBringDialog = null;
  }

  protected canSubmitSubEventSupplyBringDialog(): boolean {
    if (!this.subEventSupplyBringDialog) {
      return false;
    }
    const { quantity, min, max } = this.subEventSupplyBringDialog;
    return Number.isFinite(quantity) && quantity >= min && quantity <= max;
  }

  protected onSubEventSupplyBringQuantityChange(value: number | string): void {
    if (!this.subEventSupplyBringDialog) {
      return;
    }
    const parsed = Number(value);
    const next = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : this.subEventSupplyBringDialog.quantity,
      this.subEventSupplyBringDialog.min,
      this.subEventSupplyBringDialog.max
    );
    this.subEventSupplyBringDialog = {
      ...this.subEventSupplyBringDialog,
      quantity: next
    };
  }

  protected confirmSubEventSupplyBringDialog(event?: Event): void {
    event?.stopPropagation();
    if (!this.subEventSupplyBringDialog || !this.canSubmitSubEventSupplyBringDialog()) {
      return;
    }
    const assignmentKey = this.subEventSupplyAssignmentKey(
      this.subEventSupplyBringDialog.subEventId,
      this.subEventSupplyBringDialog.cardId
    );
    const quantity = AppUtils.clampNumber(
      Math.trunc(this.subEventSupplyBringDialog.quantity),
      this.subEventSupplyBringDialog.min,
      this.subEventSupplyBringDialog.max
    );
    if (quantity > 0) {
      const nowIso = AppUtils.toIsoDateTime(new Date());
      const nextEntry: AppTypes.SubEventSupplyContributionEntry = {
        id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: this.activeUser.id,
        quantity,
        addedAtIso: nowIso
      };
      const current = this.subEventSupplyContributionEntriesByAssignmentKey[assignmentKey] ?? [];
      this.subEventSupplyContributionEntriesByAssignmentKey[assignmentKey] = [...current, nextEntry];
    }
    this.normalizeSubEventSupplyContributionEntries(this.subEventSupplyBringDialog.subEventId, this.subEventSupplyBringDialog.cardId);
    this.refreshSubEventSupplyContributionRows();
    const subEvent = this.resolveSubEventForResourceSync(this.subEventSupplyBringDialog.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
    } else {
      this.refreshEventChatSessionResourceContext(this.subEventSupplyBringDialog.subEventId);
    }
    this.subEventSupplyBringDialog = null;
  }

  protected subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  protected get subEventSupplyContributionRows(): AppTypes.SubEventSupplyContributionRow[] {
    const context = this.selectedSubEventSupplyContributionContext;
    if (!context) {
      return [];
    }
    const rows = this.subEventSupplyContributionEntries(context.subEventId, context.assetId).map(entry => {
      const user = this.users.find(candidate => candidate.id === entry.userId) ?? null;
      const age = user?.age ?? 0;
      return {
        id: entry.id,
        userId: entry.userId,
        name: user?.name ?? 'Unknown member',
        initials: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Unknown'),
        gender: user?.gender ?? 'woman',
        age,
        city: user?.city ?? '',
        addedAtIso: entry.addedAtIso,
        quantity: AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER)
      };
    });
    return rows.sort((a, b) => AppUtils.toSortableDate(b.addedAtIso) - AppUtils.toSortableDate(a.addedAtIso));
  }

  protected subEventSupplyContributionAddedLabel(addedAtIso: string): string {
    const when = new Date(addedAtIso);
    if (Number.isNaN(when.getTime())) {
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return when.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  protected subEventSupplyContributionQuantityLabel(quantity: number): string {
    const normalized = AppUtils.clampNumber(Math.trunc(quantity), 0, Number.MAX_SAFE_INTEGER);
    return normalized === 1 ? '1 item' : `${normalized} items`;
  }

  protected subEventSupplyContributionTotalQuantity(): number {
    const context = this.selectedSubEventSupplyContributionContext;
    if (!context) {
      return 0;
    }
    return this.subEventSupplyContributionEntries(context.subEventId, context.assetId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  protected subEventSupplyContributionTotalLabel(): string {
    return this.subEventSupplyContributionQuantityLabel(this.subEventSupplyContributionTotalQuantity());
  }

  protected canDeleteSubEventSupplyContribution(row: AppTypes.SubEventSupplyContributionRow): boolean {
    return row.userId === this.activeUser.id;
  }

  protected requestDeleteSubEventSupplyContribution(row: AppTypes.SubEventSupplyContributionRow, event?: Event): void {
    event?.stopPropagation();
    if (!this.canDeleteSubEventSupplyContribution(row)) {
      return;
    }
    this.pendingSubEventSupplyContributionDelete = {
      subEventId: this.selectedSubEventSupplyContributionContext?.subEventId ?? '',
      assetId: this.selectedSubEventSupplyContributionContext?.assetId ?? '',
      entryId: row.id,
      label: `${row.name} · ${row.quantity}`
    };
  }

  protected cancelDeleteSubEventSupplyContribution(): void {
    this.pendingSubEventSupplyContributionDelete = null;
  }

  protected pendingDeleteSubEventSupplyContributionLabel(): string {
    if (!this.pendingSubEventSupplyContributionDelete) {
      return '';
    }
    return `Delete "${this.pendingSubEventSupplyContributionDelete.label}" from supplies?`;
  }

  protected confirmDeleteSubEventSupplyContribution(): void {
    const pending = this.pendingSubEventSupplyContributionDelete;
    if (!pending) {
      return;
    }
    const key = this.subEventSupplyAssignmentKey(pending.subEventId, pending.assetId);
    const current = this.subEventSupplyContributionEntriesByAssignmentKey[key] ?? [];
    this.subEventSupplyContributionEntriesByAssignmentKey[key] = current.filter(entry => entry.id !== pending.entryId);
    this.normalizeSubEventSupplyContributionEntries(pending.subEventId, pending.assetId);
    this.refreshSubEventSupplyContributionRows();
    const subEvent = this.resolveSubEventForResourceSync(pending.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
    } else {
      this.refreshEventChatSessionResourceContext(pending.subEventId);
    }
    this.pendingSubEventSupplyContributionDelete = null;
  }

  private subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppTypes.SubEventSupplyContributionEntry[] {
    return this.subEventSupplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private normalizeSubEventSupplyContributionEntries(subEventId: string, cardId: string): void {
    const key = this.subEventSupplyAssignmentKey(subEventId, cardId);
    const raw = this.subEventSupplyContributionEntriesByAssignmentKey[key] ?? [];
    const next: AppTypes.SubEventSupplyContributionEntry[] = [];
    for (const entry of raw) {
      const quantity = AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER);
      if (quantity > 0) {
        next.push({
          ...entry,
          quantity
        });
      }
    }
    if (next.length === 0) {
      delete this.subEventSupplyContributionEntriesByAssignmentKey[key];
      return;
    }
    this.subEventSupplyContributionEntriesByAssignmentKey[key] = next;
  }

  private refreshSubEventSupplyContributionRows(): void {
    const context = this.selectedSubEventSupplyContributionContext;
    if (!context) {
      return;
    }
    if (this.stackedPopup !== 'subEventSupplyContributions') {
      return;
    }
    this.selectedSubEventSupplyContributionContext = { ...context };
  }

  protected toggleSubEventMemberActionMenu(member: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenu?.scope === 'subEventMember' && this.inlineItemActionMenu.id === member.userId) {
      this.inlineItemActionMenu = null;
      this.subEventMemberRolePickerUserId = null;
      return;
    }
    this.subEventMemberRolePickerUserId = null;
    this.inlineItemActionMenu = {
      scope: 'subEventMember',
      id: member.userId,
      title: member.name,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isSubEventMemberActionMenuOpen(member: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'subEventMember' && this.inlineItemActionMenu.id === member.userId;
  }

  protected isSubEventMemberActionMenuOpenUp(member: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'subEventMember'
      && this.inlineItemActionMenu.id === member.userId
      && this.inlineItemActionMenu.openUp;
  }

  protected subEventMemberRoleIcon(role: AppTypes.ActivityMemberRole): string {
    if (role === 'Admin') {
      return 'admin_panel_settings';
    }
    if (role === 'Manager') {
      return 'manage_accounts';
    }
    return 'person';
  }

  protected subEventMemberRoleMenuLabel(member: AppTypes.ActivityMemberEntry): string {
    return `${member.role} role`;
  }

  protected toggleSubEventMemberRolePicker(member: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.isSubEventMemberActionMenuOpen(member)) {
      return;
    }
    this.subEventMemberRolePickerUserId = this.subEventMemberRolePickerUserId === member.userId
      ? null
      : member.userId;
  }

  protected isSubEventMemberRolePickerOpen(member: AppTypes.ActivityMemberEntry): boolean {
    return this.isSubEventMemberActionMenuOpen(member) && this.subEventMemberRolePickerUserId === member.userId;
  }

  protected setSubEventMemberRole(member: AppTypes.ActivityMemberEntry, role: AppTypes.ActivityMemberRole, event: Event): void {
    event.stopPropagation();
    this.updateSubEventMembersEntries(entries => entries.map(entry =>
      entry.userId === member.userId
        ? { ...entry, role }
        : entry
    ));
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
  }

  protected removeSubEventMember(member: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    this.updateSubEventMembersEntries(entries => entries.filter(entry => entry.userId !== member.userId));
    this.detachUserFromSelectedSubEventChat(member.userId);
    this.emitActivitiesEventSyncForSelectedMembersRow();
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
  }

  private subEventMembersStageLabel(subEvent: AppTypes.SubEventFormItem): string {
    const baseName = this.subEventDisplayName(subEvent);
    const mainToken = baseName.split('·')[0]?.trim() ?? '';
    if (mainToken) {
      return mainToken;
    }
    const stageNumber = this.resolveSubEventStageNumber(subEvent.id);
    if (stageNumber !== null) {
      return `Stage ${stageNumber}`;
    }
    return baseName;
  }

  private subEventMembersEventTitle(): string {
    const explicit = this.eventForm.title.trim();
    if (explicit) {
      return explicit;
    }
    const fromContext = this.subEventMembersRow?.title?.trim() ?? this.selectedActivityMembersRow?.title?.trim() ?? '';
    if (fromContext) {
      return fromContext;
    }
    return 'Event';
  }

  private subEventDisplayName(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    const raw = subEvent?.name?.trim() ?? '';
    if (!raw) {
      return '';
    }
    const eventName = this.subEventMembersEventTitle().trim();
    if (!eventName) {
      return raw;
    }
    const parts = raw.split('·').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      return raw;
    }
    const trailing = parts[parts.length - 1];
    if (AppUtils.normalizeText(trailing) !== AppUtils.normalizeText(eventName)) {
      return raw;
    }
    return parts.slice(0, -1).join(' · ').trim() || raw;
  }

  private resolveSubEventMembersContext(): { row: AppTypes.ActivityListRow; rowKey: string } | null {
    if (this.subEventMembersRow && this.subEventMembersRowId) {
      return { row: this.subEventMembersRow, rowKey: this.subEventMembersRowId };
    }
    if (this.selectedActivityMembersRow && this.selectedActivityMembersRowId) {
      return { row: this.selectedActivityMembersRow, rowKey: this.selectedActivityMembersRowId };
    }
    const row = this.eventEditorMembersRow();
    if (!row) {
      return null;
    }
    return { row, rowKey: `${row.type}:${row.id}` };
  }

  private subEventMembersEntries(): AppTypes.ActivityMemberEntry[] {
    const context = this.resolveSubEventMembersContext();
    if (!context) {
      return [];
    }
    const cached = this.activityMembersByRowId[context.rowKey];
    if (cached) {
      return this.sortActivityMembersByActionTimeAsc([...cached]);
    }
    const seeded = this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(context.row));
    this.activityMembersByRowId[context.rowKey] = [...seeded];
    return seeded;
  }

  private updateSubEventMembersEntries(
    updater: (entries: AppTypes.ActivityMemberEntry[]) => AppTypes.ActivityMemberEntry[]
  ): void {
    const context = this.resolveSubEventMembersContext();
    if (!context) {
      return;
    }
    const current = this.subEventMembersEntries();
    const next = this.sortActivityMembersByActionTimeAsc(updater([...current]));
    this.activityMembersByRowId[context.rowKey] = [...next];
    this.syncSelectedSubEventMembersCounts(next);
    if (this.selectedActivityMembersRowId === context.rowKey) {
      this.selectedActivityMembers = [...next];
    }
  }

  private syncSelectedSubEventMembersCounts(entries: AppTypes.ActivityMemberEntry[]): void {
    if (!this.selectedSubEventBadgeContext) {
      return;
    }
    const acceptedCount = entries.filter(member => member.status === 'accepted').length;
    const pendingCount = entries.filter(member => member.status === 'pending').length;
    this.selectedSubEventBadgeContext.subEvent.membersAccepted = acceptedCount;
    this.selectedSubEventBadgeContext.subEvent.membersPending = pendingCount;
    this.activitiesContext.touchEventChatSession();
  }

  private isGroupScopedSubEventResourceContext(): boolean {
    const groupId = this.selectedSubEventBadgeContext?.groupId;
    return typeof groupId === 'string' && groupId.trim().length > 0;
  }

  private resolveMainEventMembersContext(): { row: AppTypes.ActivityListRow; rowKey: string } | null {
    if (this.subEventMembersRow && this.subEventMembersRowId) {
      return { row: this.subEventMembersRow, rowKey: this.subEventMembersRowId };
    }
    const row = this.eventEditorMembersRow();
    if (!row) {
      return null;
    }
    return { row, rowKey: `${row.type}:${row.id}` };
  }

  private mainEventMembersEntries(): AppTypes.ActivityMemberEntry[] {
    const context = this.resolveMainEventMembersContext();
    if (!context) {
      return [];
    }
    const cached = this.activityMembersByRowId[context.rowKey];
    if (cached) {
      return this.sortActivityMembersByActionTimeAsc([...cached]);
    }
    const seeded = this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(context.row));
    this.activityMembersByRowId[context.rowKey] = [...seeded];
    return seeded;
  }

  private ensureMainEventMemberPendingApproval(userId: string, actionAtIso: string): void {
    const context = this.resolveMainEventMembersContext();
    if (!context) {
      return;
    }
    const user = this.users.find(item => item.id === userId);
    if (!user) {
      return;
    }
    const existing = this.mainEventMembersEntries();
    if (existing.some(member => member.userId === userId)) {
      return;
    }
    const next = this.sortActivityMembersByActionTimeAsc([
      ...existing,
      {
        ...AppDemoGenerators.toActivityMemberEntry(
          user,
          context.row,
          context.rowKey,
          this.activeUser.id,
          {
            status: 'pending',
            pendingSource: 'member',
            invitedByActiveUser: true
          },
          APP_DEMO_DATA.activityMemberMetPlaces
        ),
        pendingSource: 'member',
        requestKind: 'join',
        actionAtIso,
        statusText: 'Waiting for event admin approval.'
      }
    ]);
    this.activityMembersByRowId[context.rowKey] = [...next];
    this.syncSelectedSubEventMembersCounts(next);
    if (this.selectedActivityMembersRowId === context.rowKey) {
      this.selectedActivityMembers = [...next];
    }
    if (context.row.type === 'events' || context.row.type === 'hosting') {
      const acceptedMembers = next.filter(member => member.status === 'accepted').length;
      const pendingMembers = next.filter(member => member.status === 'pending').length;
      const capacityTotal = this.activityCapacityTotal(context.row, acceptedMembers);
      this.activityCapacityById[context.row.id] = `${acceptedMembers} / ${capacityTotal}`;
      this.emitActivitiesEventSync(
        context.row.id,
        context.row.type === 'hosting' ? 'hosting' : 'events',
        { acceptedMembers, pendingMembers, capacityTotal }
      );
    }
  }

  private isUserManagingAnySubEventAsset(userId: string): boolean {
    const assignmentKeys = new Set<string>([
      ...Object.keys(this.subEventAssignedAssetIdsByKey),
      ...Object.keys(this.subEventAssignedAssetSettingsByKey)
    ]);
    for (const key of assignmentKeys) {
      const parsed = this.parseSubEventAssetAssignmentKey(key);
      if (!parsed) {
        continue;
      }
      const settings = this.getSubEventAssignedAssetSettings(parsed.subEventId, parsed.type);
      if (Object.values(settings).some(setting => setting.addedByUserId === userId)) {
        return true;
      }
    }
    return false;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppTypes.AssetType): AppTypes.AssetCard[] {
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    return assignedIds
      .map(id => this.ownedAssets.assetCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppTypes.AssetType): Record<string, AppTypes.SubEventAssignedAssetSettings> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.subEventAssignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of assignedIds) {
      const source = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === type);
      if (!source) {
        continue;
      }
      const prev = existing[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(prev?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(prev?.capacityMin ?? 0), 0, capacityMax);
      next[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: prev?.addedByUserId ?? this.activeUser.id,
        routes: this.normalizeAssetRoutes(type, prev?.routes, '')
      };
    }
    this.subEventAssignedAssetSettingsByKey[key] = next;
    return next;
  }

  private subEventAssetCapacityMetrics(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = cards.reduce((sum, card) => sum + this.assetPendingCount(card), 0);
    if (type === 'Supplies') {
      const joined = cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0);
      return { joined, capacityMin, capacityMax, pending };
    }
    const joinedMemberIds = new Set<string>();
    for (const card of cards) {
      for (const request of card.requests) {
        if (request.status === 'accepted') {
          joinedMemberIds.add(request.id);
        }
      }
    }
    return { joined: joinedMemberIds.size, capacityMin, capacityMax, pending };
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppTypes.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private seedSubEventAssetAssignmentsFromNavigationRequest(
    subEventId: string,
    assetAssignmentIds?: Partial<Record<AppTypes.AssetType, string[]>>
  ): void {
    if (!subEventId || !assetAssignmentIds) {
      return;
    }
    const types: AppTypes.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const raw = assetAssignmentIds[type];
      if (!Array.isArray(raw)) {
        continue;
      }
      const allowedIds = new Set([
        ...this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id),
        ...(this.subEventResourceFallbackCardsByType?.[type] ?? []).map(card => card.id)
      ]);
      const normalized = raw.filter((id, index, arr): id is string =>
        typeof id === 'string' && arr.indexOf(id) === index && allowedIds.has(id)
      );
      const key = this.subEventAssetAssignmentKey(subEventId, type);
      this.subEventAssignedAssetIdsByKey[key] = [...normalized];
      const settings = this.subEventAssignedAssetSettingsByKey[key];
      if (!settings) {
        continue;
      }
      const nextSettings: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
      for (const id of normalized) {
        const existing = settings[id];
        if (existing) {
          nextSettings[id] = existing;
        }
      }
      this.subEventAssignedAssetSettingsByKey[key] = nextSettings;
    }
  }

  private seedSubEventResourceFallbackCardsFromNavigationRequest(
    assetCardsByType?: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): void {
    if (!assetCardsByType) {
      this.subEventResourceFallbackCardsByType = null;
      return;
    }
    const next: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> = {};
    const types: AppTypes.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const cards = assetCardsByType[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards
        .filter(card => card && card.type === type)
        .map(card => ({
          ...card,
          requests: Array.isArray(card.requests) ? [...card.requests] : []
        }));
    }
    this.subEventResourceFallbackCardsByType = Object.keys(next).length > 0 ? next : null;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppTypes.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id);
    const eligible = new Set(eligibleIds);
    const stored = this.subEventAssignedAssetIdsByKey[key];
    if (!stored) {
      this.subEventAssignedAssetIdsByKey[key] = [...eligibleIds];
      return [...eligibleIds];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length === 0 && eligibleIds.length > 0) {
      const existingSettings = this.subEventAssignedAssetSettingsByKey[key] ?? {};
      const settingIds = Object.keys(existingSettings).filter(id => eligible.has(id));
      const recoveredIds = settingIds.length > 0 ? settingIds : eligibleIds;
      this.subEventAssignedAssetIdsByKey[key] = [...recoveredIds];
      return [...recoveredIds];
    }
    if (normalized.length !== stored.length) {
      this.subEventAssignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private normalizeSubEventResourceFilter(
    filter: AppTypes.SubEventResourceFilter | string | null | undefined,
    preferred?: AppTypes.SubEventResourceFilter | string | null | undefined
  ): AppTypes.SubEventResourceFilter {
    const parsedFilter = this.parseSubEventResourceFilter(filter);
    if (parsedFilter) {
      return parsedFilter;
    }
    const parsedPreferred = this.parseSubEventResourceFilter(preferred);
    if (parsedPreferred) {
      return parsedPreferred;
    }
    const parsedCurrent = this.parseSubEventResourceFilter(this.subEventResourceFilter);
    if (parsedCurrent) {
      return parsedCurrent;
    }
    return 'Car';
  }

  private parseSubEventResourceFilter(value: unknown): AppTypes.SubEventResourceFilter | null {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'members') {
      return 'Members';
    }
    if (normalized === 'car') {
      return 'Car';
    }
    if (normalized === 'accommodation') {
      return 'Accommodation';
    }
    if (normalized === 'supplies') {
      return 'Supplies';
    }
    return null;
  }

  private applySubEventAssetAssignments(): void {
    const context = this.subEventAssetAssignContext;
    if (!context) {
      return;
    }
    const allowedIds = new Set(
      this.ownedAssets.assetCards
        .filter(card => card.type === context.type)
        .map(card => card.id)
    );
    const nextIds = this.selectedSubEventAssignAssetIds.filter((id, index, arr) =>
      allowedIds.has(id) && arr.indexOf(id) === index
    );
    const key = this.subEventAssetAssignmentKey(context.subEventId, context.type);
    const previousSettings = this.subEventAssignedAssetSettingsByKey[key] ?? {};
    const nextSettings: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of nextIds) {
      const source = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === context.type);
      if (!source) {
        continue;
      }
      const capacityLimit = Math.max(0, source.capacityTotal);
      const prev = previousSettings[assetId];
      const capacityMax = AppUtils.clampNumber(Math.trunc(prev?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(prev?.capacityMin ?? 0), 0, capacityMax);
      nextSettings[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: prev?.addedByUserId ?? this.activeUser.id,
        routes: this.normalizeAssetRoutes(context.type, prev?.routes, '')
      };
    }
    if (context.type === 'Supplies') {
      const removedIds = Object.keys(previousSettings).filter(assetId => !nextIds.includes(assetId));
      for (const assetId of removedIds) {
        delete this.subEventSupplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(context.subEventId, assetId)];
      }
    }
    this.subEventAssignedAssetIdsByKey[key] = [...nextIds];
    this.subEventAssignedAssetSettingsByKey[key] = nextSettings;
    const targetSubEvent = this.resolveSubEventForResourceSync(context.subEventId);
    if (targetSubEvent) {
      this.syncSubEventAssetBadgeCounts(targetSubEvent, context.type, nextIds);
      return;
    }
    this.refreshEventChatSessionResourceContext(context.subEventId);
  }

  private syncSubEventAssetBadgeCounts(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType, assignedIds?: string[]): void {
    if (assignedIds) {
      const key = this.subEventAssetAssignmentKey(subEvent.id, type);
      this.subEventAssignedAssetIdsByKey[key] = [...assignedIds];
    }
    const metrics = this.subEventAssetCapacityMetrics(subEvent, type);
    if (type === 'Car') {
      subEvent.carsAccepted = metrics.joined;
      subEvent.carsPending = metrics.pending;
      subEvent.carsCapacityMin = metrics.capacityMin;
      subEvent.carsCapacityMax = metrics.capacityMax;
      this.refreshEventChatSessionResourceContext(subEvent.id);
      return;
    }
    if (type === 'Accommodation') {
      subEvent.accommodationAccepted = metrics.joined;
      subEvent.accommodationPending = metrics.pending;
      subEvent.accommodationCapacityMin = metrics.capacityMin;
      subEvent.accommodationCapacityMax = metrics.capacityMax;
      this.refreshEventChatSessionResourceContext(subEvent.id);
      return;
    }
    subEvent.suppliesAccepted = metrics.joined;
    subEvent.suppliesPending = metrics.pending;
    subEvent.suppliesCapacityMin = metrics.capacityMin;
    subEvent.suppliesCapacityMax = metrics.capacityMax;
    this.refreshEventChatSessionResourceContext(subEvent.id);
  }

  private syncAllSubEventAssetBadgeCounts(): void {
    for (const subEvent of this.eventForm.subEvents) {
      this.syncSubEventAssetBadgeCounts(subEvent, 'Car');
      this.syncSubEventAssetBadgeCounts(subEvent, 'Accommodation');
      this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
    }
  }

  private findSubEventById(subEventId: string): AppTypes.SubEventFormItem | null {
    for (const subEvent of this.eventForm.subEvents) {
      if (subEvent.id === subEventId) {
        return subEvent;
      }
    }
    return null;
  }

  private resolveSubEventForResourceSync(subEventId: string): AppTypes.SubEventFormItem | null {
    const fromEditor = this.findSubEventById(subEventId);
    if (fromEditor) {
      return fromEditor;
    }
    const selected = this.selectedSubEventBadgeContext?.subEvent ?? null;
    if (selected?.id === subEventId) {
      return selected;
    }
    return null;
  }

  private eventChatResourceAssignmentIdsForSubEvent(subEventId: string): Partial<Record<AppTypes.AssetType, string[]>> {
    return {
      Car: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Car')],
      Accommodation: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Accommodation')],
      Supplies: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Supplies')]
    };
  }

  private eventChatResourceCardsByTypeForSubEvent(): Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> {
    return {
      Car: this.ownedAssets.assetCards
        .filter(card => card.type === 'Car')
        .map(card => ({ ...card, requests: [...card.requests] })),
      Accommodation: this.ownedAssets.assetCards
        .filter(card => card.type === 'Accommodation')
        .map(card => ({ ...card, requests: [...card.requests] })),
      Supplies: this.ownedAssets.assetCards
        .filter(card => card.type === 'Supplies')
        .map(card => ({ ...card, requests: [...card.requests] }))
    };
  }

  private subEventSnapshotForEventChat(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventFormItem {
    const cars = this.subEventAssetCapacityMetrics(subEvent, 'Car');
    const accommodation = this.subEventAssetCapacityMetrics(subEvent, 'Accommodation');
    const supplies = this.subEventAssetCapacityMetrics(subEvent, 'Supplies');
    return {
      ...subEvent,
      carsAccepted: cars.joined,
      carsPending: cars.pending,
      carsCapacityMin: cars.capacityMin,
      carsCapacityMax: cars.capacityMax,
      accommodationAccepted: accommodation.joined,
      accommodationPending: accommodation.pending,
      accommodationCapacityMin: accommodation.capacityMin,
      accommodationCapacityMax: accommodation.capacityMax,
      suppliesAccepted: supplies.joined,
      suppliesPending: supplies.pending,
      suppliesCapacityMin: supplies.capacityMin,
      suppliesCapacityMax: supplies.capacityMax
    };
  }

  private refreshEventChatSessionResourceContext(changedSubEventId?: string): void {
    this.activitiesContext.touchEventChatSession(context => {
      const contextSubEventId = context.subEvent?.id ?? '';
      if (!contextSubEventId) {
        return context;
      }
      if (changedSubEventId && contextSubEventId !== changedSubEventId) {
        return context;
      }
      const sourceSubEvent = this.resolveSubEventForResourceSync(contextSubEventId) ?? context.subEvent;
      if (!sourceSubEvent) {
        return context;
      }
      return {
        ...context,
        subEvent: this.subEventSnapshotForEventChat(sourceSubEvent),
        assetAssignmentIds: this.eventChatResourceAssignmentIdsForSubEvent(contextSubEventId),
        assetCardsByType: this.eventChatResourceCardsByTypeForSubEvent(),
        resources: context.resources.map(resource => ({ ...resource }))
      };
    });
  }

  protected get subEventResourceCards(): AppTypes.SubEventResourceCard[] {
    if (!this.selectedSubEventBadgeContext) {
      return [];
    }
    const subEvent = this.selectedSubEventBadgeContext.subEvent;
    if (this.subEventResourceFilter === 'Members') {
      const members = this.subEventMembersOrdered;
      const capacity = Math.max(subEvent.capacityMax, Math.max(members.length, 1));
      const accepted = members.filter(member => member.status === 'accepted').length;
      return members.map((member, index) => {
        const pending = member.status === 'pending';
        return {
          id: `subevent-member-${member.userId}-${index}`,
          type: 'Members',
          sourceAssetId: null,
          title: member.name,
          subtitle: member.role,
          city: member.city,
          details: pending ? 'Pending member request for this sub event.' : 'Accepted for this sub event.',
          imageUrl: member.avatarUrl,
          sourceLink: '',
          routes: [],
          capacityTotal: capacity,
          accepted,
          pending: pending ? 1 : 0,
          isMembers: true
        };
      });
    }

    const resourceType = this.subEventResourceFilter as AppTypes.AssetType;
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEvent.id, resourceType);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, resourceType);
    this.syncSubEventAssetBadgeCounts(subEvent, resourceType, assignedIds);
    let baseCards = assignedIds
      .map(id => this.ownedAssets.assetCards.find(card => card.id === id && card.type === resourceType) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
    if (baseCards.length === 0) {
      const fallbackCards = this.subEventResourceCardsForChat(resourceType) ?? this.subEventResourceFallbackCardsByType?.[resourceType] ?? [];
      baseCards = fallbackCards.length > 0
        ? fallbackCards.map(card => ({ ...card, requests: [...card.requests] }))
        : this.ownedAssets.assetCards.filter(card => card.type === resourceType);
    }
    if (baseCards.length === 0) {
      baseCards = this.seedAssetCards
        .filter(card => card.type === resourceType)
        .map(card => ({ ...card, routes: [...(card.routes ?? [])], requests: [...card.requests] }));
    }
    return baseCards.map(card => ({
      id: `subevent-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: card.details,
      imageUrl: card.imageUrl,
      sourceLink: card.sourceLink,
      routes: card.type === 'Accommodation'
        ? this.normalizeAssetRoutes(card.type, card.routes, card.city)
        : this.normalizeAssetRoutes(card.type, settings[card.id]?.routes ?? card.routes, card.city),
      capacityTotal: settings[card.id]?.capacityMax ?? card.capacityTotal,
      accepted: card.type === 'Supplies' ? this.subEventSupplyProvidedCount(card.id, subEvent.id) : this.assetAcceptedCount(card),
      pending: this.assetPendingCount(card),
      isMembers: false
    }));
  }

  private subEventResourceCardsForChat(type: AppTypes.AssetType): AppTypes.AssetCard[] | null {
    if (this.subEventBadgePopupOrigin !== 'chat') {
      return null;
    }
    const snapshot = this.subEventResourceFallbackCardsByType?.[type] ?? [];
    if (snapshot.length === 0) {
      return null;
    }
    return snapshot.map(card => ({ ...card, requests: [...card.requests] }));
  }

  protected subEventResourceOccupancyLabel(card: AppTypes.SubEventResourceCard): string {
    const subEventId = this.selectedSubEventBadgeContext?.subEvent.id ?? null;
    if (card.type === 'Supplies' && card.sourceAssetId && subEventId) {
      const supplied = this.subEventSupplyProvidedCount(card.sourceAssetId, subEventId);
      return `${supplied} / 1 - ${card.capacityTotal}`;
    }
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  protected canOpenSubEventResourceMap(card: AppTypes.SubEventResourceCard): boolean {
    if (!card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes, card.city).some(stop => stop.trim().length > 0);
  }

  protected openSubEventResourceMap(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenSubEventResourceMap(card)) {
      return;
    }
    const type = card.type;
    if (type !== 'Car' && type !== 'Accommodation') {
      return;
    }
    const routes = this.normalizeAssetRoutes(type, card.routes, card.city);
    if (type === 'Accommodation') {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }


  protected onEventCapacityMinChange(value: number | string): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.capacityMin = this.toEventCapacityInputValue(value);
    const normalizedMin = this.normalizedEventCapacityValue(this.eventForm.capacityMin);
    const normalizedMax = this.normalizedEventCapacityValue(this.eventForm.capacityMax);
    if (normalizedMin !== null && normalizedMax !== null && normalizedMax < normalizedMin) {
      this.eventForm.capacityMax = normalizedMin;
    }
  }

  protected onEventCapacityMaxChange(value: number | string): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.capacityMax = this.toEventCapacityInputValue(value);
  }

  protected onEventCapacityMaxBlur(): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    const normalizedMin = this.normalizedEventCapacityValue(this.eventForm.capacityMin);
    const normalizedMax = this.normalizedEventCapacityValue(this.eventForm.capacityMax);
    if (normalizedMax !== null && normalizedMin !== null && normalizedMax < normalizedMin) {
      this.eventForm.capacityMax = normalizedMin;
    }
  }

  protected eventFrequencyAscii(option: string): string {
    switch (option) {
      case 'Daily':
        return '☀';
      case 'Weekly':
        return '↻';
      case 'Bi-weekly':
        return '⇆';
      case 'Monthly':
        return '◷';
      default:
        return '•';
    }
  }

  protected onEventStartDateChange(value: Date | null): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventStartDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncEventDateTimeControlsFromForm();
  }

  protected onEventEndDateChange(value: Date | null): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventEndDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncEventDateTimeControlsFromForm();
  }

  protected onEventStartTimeChange(value: Date | null): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventStartTimeValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncEventDateTimeControlsFromForm();
  }

  protected onEventEndTimeChange(value: Date | null): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventEndTimeValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncEventDateTimeControlsFromForm();
  }

  protected onEventLocationChange(value: string): void {
    if (this.eventEditorReadOnly) {
      return;
    }
    this.eventForm.location = this.normalizeLocationValue(value);
    this.syncFirstSubEventLocationFromMainEvent();
  }

  protected openEventLocationMap(event?: Event): void {
    event?.stopPropagation();
    const routeStops = this.eventLocationRouteStops();
    if (routeStops.length <= 1) {
      this.openGoogleMapsSearch(routeStops[0] ?? this.eventForm.location);
      return;
    }
    this.openGoogleMapsDirections(routeStops);
  }

  private prepareEventEditorForm(
    mode: AppTypes.EventEditorMode,
    explicitSource?: EventMenuItem | HostingMenuItem,
    targetOverride?: AppTypes.EventEditorTarget
  ): void {
    const source = this.resolveEventEditorSource(explicitSource);
    this.showEventEditorRequiredValidation = false;
    const target = targetOverride ?? (source && this.isHostingSource(source) ? 'hosting' : 'events');
    this.eventEditorTarget = target;
    if (mode === 'edit' && source) {
      this.eventEditorSource = source;
      this.eventEditorDraftMembersId = null;
      this.editingEventId = source.id;
      this.eventForm = this.loadEventFormFromSource(source, target);
      this.subEventsDisplayMode = AppDemoGenerators.inferredSubEventsDisplayMode(this.eventForm.subEvents);
      this.syncEventDateTimeControlsFromForm();
      return;
    }
    this.eventEditorSource = null;
    this.eventEditorDraftMembersId = `draft-${target}-${Date.now()}`;
    this.editingEventId = null;
    this.eventForm = this.defaultEventForm();
    this.eventForm.frequency = this.eventFrequencyOptions[0] ?? 'One-time';
    this.syncEventDateTimeControlsFromForm();
  }

  private resolveEventEditorSource(explicitSource?: EventMenuItem | HostingMenuItem): EventMenuItem | HostingMenuItem | null {
    if (explicitSource) {
      return explicitSource;
    }
    if (this.eventEditorSource) {
      return this.eventEditorSource;
    }
    return this.selectedEvent ?? this.selectedHostingEvent;
  }

  private isHostingSource(source: EventMenuItem | HostingMenuItem): source is HostingMenuItem {
    return this.hostingItems.some(item => item.id === source.id);
  }

  private loadEventFormFromSource(source: EventMenuItem | HostingMenuItem, target: AppTypes.EventEditorTarget): AppTypes.EventEditorForm {
    const dateRange = this.activityDateTimeRangeById[source.id];
    const startIso = target === 'hosting'
      ? (this.hostingDatesById[source.id] ?? this.eventDatesById[source.id] ?? dateRange?.startIso ?? this.defaultEventStartIso())
      : (this.eventDatesById[source.id] ?? this.hostingDatesById[source.id] ?? dateRange?.startIso ?? this.defaultEventStartIso());
    const start = new Date(startIso);
    const fallbackStart = Number.isNaN(start.getTime()) ? new Date(this.defaultEventStartIso()) : start;
    const endFromRange = new Date(dateRange?.endIso ?? '');
    const end = !Number.isNaN(endFromRange.getTime()) && endFromRange.getTime() > fallbackStart.getTime()
      ? endFromRange
      : new Date(fallbackStart.getTime() + 2 * 60 * 60 * 1000);
    const frequency = this.eventFrequencyById[source.id] ?? this.parseFrequencyFromTimeframe(source.timeframe);
    const capacity = this.eventCapacityById[source.id] ?? { min: null, max: null };
    const loadedSubEvents = this.sortSubEventsByStartAsc(this.cloneSubEvents(this.eventSubEventsById[source.id] ?? []));
    const fallbackLocation = this.normalizeLocationValue(this.firstSubEventByOrder(loadedSubEvents)?.location);
    const location = this.normalizeLocationValue(this.eventLocationById[source.id]) || fallbackLocation;
    const topics = this.eventTopicsById[source.id] ?? this.eventEditor.mainEvent.topics;
    const subEvents = this.withFirstSubEventLocation(loadedSubEvents, location);
    return {
      title: source.title,
      description: source.shortDescription,
      imageUrl: this.activityImageById[source.id] ?? AppDemoGenerators.defaultAssetImage('Supplies', `event-${source.id}`),
      capacityMin: this.normalizedEventCapacityValue(capacity.min),
      capacityMax: this.normalizedEventCapacityValue(capacity.max),
      startAt: AppUtils.toIsoDateTimeLocal(fallbackStart),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      location,
      frequency,
      visibility: this.eventVisibilityById[source.id] ?? (target === 'hosting' ? 'Invitation only' : 'Public'),
      blindMode: this.eventBlindModeById[source.id] ?? 'Open Event',
      autoInviter: this.eventAutoInviterById[source.id] ?? false,
      ticketing: this.eventTicketingById[source.id] ?? false,
      topics: this.normalizeEventTopics(topics),
      subEvents
    };
  }

  private updateExistingEventFromForm(): string | null {
    if (!this.editingEventId) {
      return null;
    }
    const timeframe = this.buildEventTimeframeLabel(this.eventForm.startAt, this.eventForm.endAt, this.eventForm.frequency);
    const title = this.eventForm.title.trim();
    const shortDescription = this.eventForm.description.trim();
    this.eventVisibilityById[this.editingEventId] = this.eventForm.visibility;
    this.eventBlindModeById[this.editingEventId] = this.eventForm.blindMode;
    this.eventAutoInviterById[this.editingEventId] = this.eventForm.autoInviter;
    this.eventTicketingById[this.editingEventId] = this.eventForm.ticketing;
    this.eventFrequencyById[this.editingEventId] = this.eventForm.frequency;
    this.eventCapacityById[this.editingEventId] = this.normalizedEventCapacityRange();
    this.eventLocationById[this.editingEventId] = this.normalizeLocationValue(this.eventForm.location);
    this.eventTopicsById[this.editingEventId] = this.normalizeEventTopics(this.eventForm.topics);
    this.eventSubEventsById[this.editingEventId] = this.cloneSubEvents(this.eventForm.subEvents);
    this.eventDatesById[this.editingEventId] = this.eventForm.startAt;
    this.activityDateTimeRangeById[this.editingEventId] = {
      startIso: this.eventForm.startAt,
      endIso: this.eventForm.endAt
    };
    this.syncActivityCapacityLabelFromEventForm(this.editingEventId);
    if (this.eventForm.imageUrl) {
      this.activityImageById[this.editingEventId] = this.eventForm.imageUrl;
    }
    if (this.eventEditorTarget === 'hosting') {
      this.hostingDatesById[this.editingEventId] = this.eventForm.startAt;
      this.hostingItemsByUser[this.activeUser.id] = this.hostingItems.map(item =>
        item.id === this.editingEventId
          ? { ...item, title, shortDescription, timeframe }
          : item
      );
      this.eventItemsByUser[this.activeUser.id] = this.eventItems.map(item =>
        item.id === this.editingEventId
          ? { ...item, title, shortDescription, timeframe, isAdmin: true }
          : item
      );
      if (this.selectedHostingEvent?.id === this.editingEventId) {
        this.selectedHostingEvent = { ...this.selectedHostingEvent, title, shortDescription, timeframe };
      }
      if (this.selectedEvent?.id === this.editingEventId) {
        this.selectedEvent = { ...this.selectedEvent, title, shortDescription, timeframe, isAdmin: true };
      }
      return this.editingEventId;
    }
    this.eventItemsByUser[this.activeUser.id] = this.eventItems.map(item =>
      item.id === this.editingEventId
        ? { ...item, title, shortDescription, timeframe }
        : item
    );
    if (this.selectedEvent?.id === this.editingEventId) {
      this.selectedEvent = { ...this.selectedEvent, title, shortDescription, timeframe };
    }
    return this.editingEventId;
  }

  private insertCreatedEventFromForm(): string {
    const baseId = Date.now();
    const timeframe = this.buildEventTimeframeLabel(this.eventForm.startAt, this.eventForm.endAt, this.eventForm.frequency);
    const normalizedCapacity = this.normalizedEventCapacityRange();
    const initialCapacityTotal = Math.max(0, Math.trunc(normalizedCapacity.max ?? normalizedCapacity.min ?? 0));
    if (this.eventEditorTarget === 'hosting') {
      const id = `h${baseId}`;
      this.userCreatedEventIds.add(id);
      this.hostingDatesById[id] = this.eventForm.startAt;
      this.eventDatesById[id] = this.eventForm.startAt;
      this.activityDateTimeRangeById[id] = {
        startIso: this.eventForm.startAt,
        endIso: this.eventForm.endAt
      };
      this.hostingPublishedById[id] = false;
      this.eventVisibilityById[id] = this.eventForm.visibility;
      this.eventBlindModeById[id] = this.eventForm.blindMode;
      this.eventAutoInviterById[id] = this.eventForm.autoInviter;
      this.eventTicketingById[id] = this.eventForm.ticketing;
      this.eventFrequencyById[id] = this.eventForm.frequency;
      this.eventCapacityById[id] = this.normalizedEventCapacityRange();
      this.eventLocationById[id] = this.normalizeLocationValue(this.eventForm.location);
      this.eventTopicsById[id] = this.normalizeEventTopics(this.eventForm.topics);
      this.eventSubEventsById[id] = this.cloneSubEvents(this.eventForm.subEvents);
      this.activityCapacityById[id] = `0 / ${initialCapacityTotal}`;
      this.activityImageById[id] = this.eventForm.imageUrl || AppDemoGenerators.defaultAssetImage('Supplies', `event-${id}`);
      const next: HostingMenuItem = {
        id,
        avatar: this.activeUser.initials,
        title: this.eventForm.title.trim(),
        shortDescription: this.eventForm.description.trim(),
        timeframe,
        activity: 0
      };
      const nextEvent: EventMenuItem = {
        id,
        avatar: this.activeUser.initials,
        title: this.eventForm.title.trim(),
        shortDescription: this.eventForm.description.trim(),
        timeframe,
        activity: 0,
        isAdmin: true
      };
      this.hostingItemsByUser[this.activeUser.id] = [next, ...this.hostingItems];
      this.eventItemsByUser[this.activeUser.id] = [nextEvent, ...this.eventItems];
      this.selectedHostingEvent = next;
      this.selectedEvent = nextEvent;
      return id;
    }
    const id = `e${baseId}`;
    this.userCreatedEventIds.add(id);
    this.eventDatesById[id] = this.eventForm.startAt;
    this.activityDateTimeRangeById[id] = {
      startIso: this.eventForm.startAt,
      endIso: this.eventForm.endAt
    };
    this.eventVisibilityById[id] = this.eventForm.visibility;
    this.eventBlindModeById[id] = this.eventForm.blindMode;
    this.eventAutoInviterById[id] = this.eventForm.autoInviter;
    this.eventTicketingById[id] = this.eventForm.ticketing;
    this.eventFrequencyById[id] = this.eventForm.frequency;
    this.eventCapacityById[id] = this.normalizedEventCapacityRange();
    this.eventLocationById[id] = this.normalizeLocationValue(this.eventForm.location);
    this.eventTopicsById[id] = this.normalizeEventTopics(this.eventForm.topics);
    this.eventSubEventsById[id] = this.cloneSubEvents(this.eventForm.subEvents);
    this.activityCapacityById[id] = `0 / ${initialCapacityTotal}`;
    this.activityImageById[id] = this.eventForm.imageUrl || AppDemoGenerators.defaultAssetImage('Supplies', `event-${id}`);
    const next: EventMenuItem = {
      id,
      avatar: this.activeUser.initials,
      title: this.eventForm.title.trim(),
      shortDescription: this.eventForm.description.trim(),
      timeframe,
      activity: 0,
      isAdmin: true
    };
    this.eventItemsByUser[this.activeUser.id] = [next, ...this.eventItems];
    this.selectedEvent = next;
    return id;
  }

  private defaultEventForm(): AppTypes.EventEditorForm {
    const start = new Date();
    const end = new Date(start.getTime());
    return {
      title: '',
      description: '',
      imageUrl: '',
      capacityMin: 0,
      capacityMax: 0,
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      location: '',
      frequency: 'One-time',
      visibility: 'Invitation only',
      blindMode: 'Open Event',
      autoInviter: false,
      ticketing: false,
      topics: [],
      subEvents: []
    };
  }

  private normalizeEventDateRange(): void {
    const start = new Date(this.eventForm.startAt);
    const end = new Date(this.eventForm.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }
    if (end.getTime() <= start.getTime()) {
      const nextEnd = new Date(start.getTime() + 60 * 60 * 1000);
      this.eventForm.endAt = AppUtils.toIsoDateTimeLocal(nextEnd);
    }
    const allowed = this.supportedEventFrequencyOptions;
    if (!allowed.includes(this.eventForm.frequency)) {
      this.eventForm.frequency = allowed[0] ?? 'One-time';
    }
  }

  private syncEventDateTimeControlsFromForm(): void {
    this.eventStartDateValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    this.eventEndDateValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
    this.eventStartTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    this.eventEndTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
  }

  private syncEventFormFromDateTimeControls(): void {
    this.eventForm.startAt = AppUtils.applyDatePartToIsoLocal(this.eventForm.startAt, this.eventStartDateValue);
    this.eventForm.startAt = AppUtils.applyTimePartFromDateToIsoLocal(this.eventForm.startAt, this.eventStartTimeValue);
    this.eventForm.endAt = AppUtils.applyDatePartToIsoLocal(this.eventForm.endAt, this.eventEndDateValue);
    this.eventForm.endAt = AppUtils.applyTimePartFromDateToIsoLocal(this.eventForm.endAt, this.eventEndTimeValue);
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

  private firstSubEventByOrder(items: readonly AppTypes.SubEventFormItem[] = this.eventForm.subEvents): AppTypes.SubEventFormItem | null {
    const ordered = this.sortSubEventRefsByStartAsc(items);
    return ordered[0] ?? null;
  }

  private withFirstSubEventLocation(items: AppTypes.SubEventFormItem[], location: string): AppTypes.SubEventFormItem[] {
    if (!items.length) {
      return items;
    }
    const first = this.firstSubEventByOrder(items);
    if (!first) {
      return items;
    }
    const normalizedLocation = this.normalizeLocationValue(location);
    return items.map(item => item.id === first.id ? { ...item, location: normalizedLocation } : item);
  }

  private syncFirstSubEventLocationFromMainEvent(): void {
    if (this.eventForm.subEvents.length === 0) {
      return;
    }
    const normalizedLocation = this.normalizeLocationValue(this.eventForm.location);
    this.eventForm.subEvents = this.withFirstSubEventLocation(this.eventForm.subEvents, normalizedLocation);
  }

  private syncMainEventLocationFromFirstSubEvent(): void {
    const first = this.firstSubEventByOrder();
    if (!first) {
      return;
    }
    const normalizedLocation = this.normalizeLocationValue(first.location);
    this.eventForm.location = normalizedLocation;
  }

  private eventLocationRouteStops(): string[] {
    const subEventStops = this.sortSubEventsByStartAsc(this.eventForm.subEvents)
      .map(item => this.normalizeLocationValue(item.location).trim())
      .filter(stop => stop.length > 0);
    const mainLocation = this.normalizeLocationValue(this.eventForm.location).trim();
    const ordered = mainLocation ? [mainLocation, ...subEventStops] : subEventStops;
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const stop of ordered) {
      if (seen.has(stop)) {
        continue;
      }
      seen.add(stop);
      unique.push(stop);
    }
    return unique;
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

  private sortSubEventRefsByStartAsc(items: readonly AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return items
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
    // Server-generated groups stay as provided; manual groups are shown first.
    return [...manualGroups, ...generatedGroups];
  }

  private resolveSubEventStageNumber(subEventId: string): number | null {
    const index = this.eventForm.subEvents.findIndex(item => item.id === subEventId);
    if (index < 0) {
      return null;
    }
    return index + 1;
  }

  private contextualFrequencyOptions(startAt: string, endAt: string): string[] {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      return ['One-time'];
    }
    const daySpan = (end.getTime() - start.getTime()) / 86400000;
    const options = ['One-time'];
    if (daySpan >= 1) {
      options.push('Daily');
    }
    if (daySpan >= 14) {
      options.push('Weekly');
    }
    if (daySpan >= 28) {
      options.push('Bi-weekly', 'Monthly');
    }
    return options;
  }

  private normalizedCapacityValue(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private normalizedEventCapacityRange(): AppTypes.EventCapacityRange {
    const min = this.normalizedEventCapacityValue(this.eventForm.capacityMin);
    const max = this.normalizedEventCapacityValue(this.eventForm.capacityMax);
    if (min !== null && max !== null && max < min) {
      return { min, max: min };
    }
    return { min, max };
  }

  private toEventCapacityInputValue(value: number | string): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private normalizedEventCapacityValue(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private updateMainEventBoundsFromSubEvents(): void {
    if (this.eventForm.subEvents.length === 0) {
      return;
    }
    const tournamentMode = this.subEventsDisplayMode === 'Tournament';
    let minStartMs: number | null = null;
    let maxEndMs: number | null = null;
    let minCapacity: number | null = null;
    let maxCapacity: number | null = null;

    for (const item of this.eventForm.subEvents) {
      let startMs = new Date(item.startAt).getTime();
      let endMs = new Date(item.endAt).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        if (endMs <= startMs) {
          endMs = startMs + (60 * 60 * 1000);
        }
        minStartMs = minStartMs === null ? startMs : Math.min(minStartMs, startMs);
        maxEndMs = maxEndMs === null ? endMs : Math.max(maxEndMs, endMs);
      }

      const capacityFloor = 0;
      const normalizedMin = this.normalizedCapacityValueWithFloor(item.capacityMin, capacityFloor);
      const normalizedMax = this.normalizedCapacityValueWithFloor(item.capacityMax, capacityFloor);
      if (normalizedMin !== null) {
        minCapacity = minCapacity === null
          ? normalizedMin
          : (tournamentMode ? (minCapacity + normalizedMin) : Math.min(minCapacity, normalizedMin));
      }
      if (normalizedMax !== null) {
        maxCapacity = maxCapacity === null
          ? normalizedMax
          : (tournamentMode ? (maxCapacity + normalizedMax) : Math.max(maxCapacity, normalizedMax));
      }
    }

    if (minStartMs !== null && maxEndMs !== null) {
      this.eventForm.startAt = AppUtils.toIsoDateTimeLocal(new Date(minStartMs));
      this.eventForm.endAt = AppUtils.toIsoDateTimeLocal(new Date(maxEndMs));
      this.syncEventDateTimeControlsFromForm();
    }
    if (minCapacity !== null) {
      this.eventForm.capacityMin = minCapacity;
    }
    if (maxCapacity !== null) {
      this.eventForm.capacityMax = Math.max(maxCapacity, this.eventForm.capacityMin ?? maxCapacity);
    }
    this.syncMainEventLocationFromFirstSubEvent();
  }

  private normalizedCapacityValueWithFloor(value: number | null | undefined, floor: number): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(floor, Math.trunc(parsed));
  }

  private parseFrequencyFromTimeframe(timeframe: string): string {
    const normalized = timeframe.toLowerCase();
    if (normalized.includes('2nd') || normalized.includes('bi-weekly') || normalized.includes('biweekly')) {
      return 'Bi-weekly';
    }
    if (normalized.includes('every')) {
      return 'Weekly';
    }
    if (normalized.includes('monthly')) {
      return 'Monthly';
    }
    if (normalized.includes('daily')) {
      return 'Daily';
    }
    return 'One-time';
  }

  private buildEventTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '';
    }
    const timeLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (frequency === 'Daily') {
      return `Daily · ${timeLabel}`;
    }
    if (frequency === 'Weekly') {
      return `Every ${start.toLocaleDateString('en-US', { weekday: 'short' })} · ${timeLabel}`;
    }
    if (frequency === 'Bi-weekly') {
      return `Every 2nd ${start.toLocaleDateString('en-US', { weekday: 'short' })} · ${timeLabel}`;
    }
    if (frequency === 'Monthly') {
      return `Monthly · Day ${start.getDate()} · ${timeLabel}`;
    }
    const dayLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
      const endTimeLabel = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${dayLabel} · ${timeLabel} - ${endTimeLabel}`;
    }
    const endDayLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayLabel} - ${endDayLabel}`;
  }

  private defaultEventStartIso(): string {
    return AppUtils.toIsoDateTime(new Date());
  }

  protected openLogoutConfirm(): void {
    this.activePopup = 'logoutConfirm';
  }

  protected closePopup(): void {
    this.activePopup = null;
    this.stackedPopup = null;
    this.ownedAssets.closePopup();
    this.pendingAssetMemberAction = null;
    this.selectedAssetCardId = null;
    this.selectedSubEventBadgeContext = null;
    this.subEventBadgePopupOrigin = null;
    this.subEventMembersPendingOnly = false;
    this.subEventMembersRow = null;
    this.subEventMembersRowId = null;
    this.subEventMemberRolePickerUserId = null;
    this.subEventAssetAssignContext = null;
    this.selectedSubEventAssignAssetIds = [];
    this.subEventAssetCapacityEditor = null;
    this.subEventAssetRouteEditor = null;
    this.subEventSupplyBringDialog = null;
    this.selectedSubEventSupplyContributionContext = null;
    this.pendingSubEventSupplyContributionDelete = null;
    this.eventEditorReadOnly = false;
    this.eventEditorSource = null;
    this.eventEditorInvitationId = null;
    this.pendingActivityMemberDelete = null;
    this.activityMembersPopupOrigin = null;
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
    this.activityMembersReadOnly = false;
    this.activityMembersPendingOnly = false;
    this.selectedActivityMembers = [];
    this.selectedActivityMembersTitle = '';
    this.selectedActivityMembersRowId = null;
    this.selectedActivityMembersRow = null;
    this.selectedActivityInviteUserIds = [];
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = null;
    this.syncAssetPopupVisibility();
  }

  protected closePopupFromBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    this.closePopup();
  }

  protected closeStackedPopup(): void {
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
    if (this.superStackedPopup === 'subEventAssetAssign') {
      this.closeSubEventAssetAssignPopup(false);
      return;
    }
    if (this.stackedPopup === 'subEventMembers' || this.stackedPopup === 'subEventAssets') {
      this.selectedSubEventBadgeContext = null;
      this.subEventAssetMembersContext = null;
      this.subEventResourceFallbackCardsByType = null;
      this.subEventMembersPendingOnly = false;
      this.subEventMembersRow = null;
      this.subEventMembersRowId = null;
      this.subEventMemberRolePickerUserId = null;
      this.subEventAssetAssignContext = null;
      this.selectedSubEventAssignAssetIds = [];
      this.subEventAssetCapacityEditor = null;
      this.subEventAssetRouteEditor = null;
      this.subEventSupplyBringDialog = null;
      this.selectedSubEventSupplyContributionContext = null;
      this.pendingSubEventSupplyContributionDelete = null;
      this.selectedActivityMembers = [];
      this.selectedActivityMembersTitle = '';
      this.selectedActivityMembersRowId = null;
      this.selectedActivityMembersRow = null;
      this.selectedActivityInviteUserIds = [];
      if (this.subEventBadgePopupOrigin === 'stacked-event-editor') {
        this.stackedPopup = null;
        this.reopenEventEditorPopupFromState();
      } else if (this.subEventBadgePopupOrigin === 'chat') {
        this.stackedPopup = null;
      } else {
        this.stackedPopup = null;
      }
      this.subEventBadgePopupOrigin = null;
      return;
    }
    if (this.stackedPopup === 'subEventSupplyContributions') {
      this.pendingSubEventSupplyContributionDelete = null;
      this.selectedSubEventSupplyContributionContext = null;
      this.stackedPopup = 'subEventAssets';
      return;
    }
    if (this.stackedPopup === 'assetMembers') {
      this.pendingAssetMemberAction = null;
      this.selectedAssetCardId = null;
    }
    if (this.stackedPopup === 'activityMembers') {
      this.pendingActivityMemberDelete = null;
      this.activityMembersReadOnly = false;
      this.activityMembersPendingOnly = false;
      this.selectedActivityMembers = [];
      this.selectedActivityMembersTitle = '';
      this.selectedActivityMembersRowId = null;
      this.selectedActivityMembersRow = null;
      this.selectedActivityInviteUserIds = [];
      this.showActivityInviteSortPicker = false;
      this.superStackedPopup = null;
      if (this.activityMembersPopupOrigin === 'subevent-asset') {
        this.activityMembersPopupOrigin = null;
        this.subEventAssetMembersContext = null;
        this.stackedPopup = 'subEventAssets';
        return;
      }
      if (this.activityMembersPopupOrigin === 'stacked-event-editor') {
        this.activityMembersPopupOrigin = null;
        this.subEventAssetMembersContext = null;
        this.stackedPopup = null;
        this.reopenEventEditorPopupFromState();
        return;
      }
      this.activityMembersPopupOrigin = null;
      this.subEventAssetMembersContext = null;
    }
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.superStackedPopup = null;
    }
    this.stackedPopup = null;
    this.syncAssetPopupVisibility();
  }

  protected confirmLogout(): void {
    this.activePopup = null;
    this.stackedPopup = null;
    this.navigatorService.closeMenu();
    this.navigatorService.clearHydratedUser();
    this.syncAssetPopupVisibility();
    void this.sessionService.logout().finally(() => {
      void this.router.navigate(['/entry']);
      this.cdr.markForCheck();
    });
  }

  protected getPopupTitle(): string {
    switch (this.activePopup) {
      case 'activityMembers':
        return 'Members';
      case 'tickets':
        return 'Tickets';
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'imageUpload':
        return 'Upload Image';
      case 'supplyDetail':
        return `${this.selectedSupplyContext?.type ?? 'Supply'} · ${this.selectedSupplyContext?.subEventTitle ?? ''}`.trim();
      case 'subEventMembers':
        return `Members · ${this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent)}`.trim();
      case 'subEventAssets':
        return `${this.subEventResourceFilter} · ${this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent)}`.trim();
      case 'invitations':
        return 'Invitations';
      case 'events':
        return 'Events';
      case 'hosting':
        return 'Hosting';
      case 'logoutConfirm':
        return 'Kilépés';
      default:
        return '';
    }
  }

  protected getStackedPopupTitle(): string {
    switch (this.stackedPopup) {
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'ticketCode':
        return 'Ticket';
      case 'ticketScanner':
        return 'Scan Ticket';
      case 'supplyDetail':
        return `${this.selectedSupplyContext?.type ?? 'Supply'} · ${this.selectedSupplyContext?.subEventTitle ?? ''}`.trim();
      case 'subEventMembers':
        return `Members · ${this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent)}`.trim();
      case 'subEventAssets':
        return `${this.subEventResourceFilter} · ${this.subEventDisplayName(this.selectedSubEventBadgeContext?.subEvent)}`.trim();
      case 'assetMembers':
        return this.selectedAssetCard ? `${this.selectedAssetCard.title} · Members` : 'Members';
      default:
        return '';
    }
  }

  protected toggleInterestOption(option: string): void {
    const allowed = this.interestAllOptions();
    if (!allowed.includes(option)) {
      return;
    }
    const exists = this.interestSelectorSelected.includes(option);
    if (!exists && this.interestSelectorSelected.length >= 5) {
      return;
    }
    this.interestSelectorSelected = exists
      ? this.interestSelectorSelected.filter(item => item !== option)
      : [...this.interestSelectorSelected, option];
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [...this.interestSelectorSelected];
    }
  }

  protected removeInterestOption(option: string): void {
    this.interestSelectorSelected = this.interestSelectorSelected.filter(item => item !== option);
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [...this.interestSelectorSelected];
    }
  }

  protected clearInterestSelector(): void {
    this.interestSelectorSelected = [];
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [];
    }
  }

  protected isInterestOptionSelected(option: string): boolean {
    return this.interestSelectorSelected.includes(option);
  }

  protected interestOptionToneClass(option: string): string {
    const normalizedOption = this.normalizeTopicToken(option);
    if (!normalizedOption) {
      return '';
    }
    for (const group of this.interestOptionGroups) {
      if (group.options.some(groupOption => this.normalizeTopicToken(groupOption) === normalizedOption)) {
        return group.toneClass;
      }
    }
    return '';
  }
  private initializeProfileDetailForms(): void {
    for (const user of this.users) {
      this.profileDetailsFormByUser[user.id] = this.createProfileDetailsFormForUser(user);
    }
  }

  private profileDetailsForUser(userId: string): AppTypes.ProfileDetailFormGroup[] {
    const existing = this.profileDetailsFormByUser[userId];
    if (existing) {
      return existing;
    }
    const user = this.users.find(candidate => candidate.id === userId) ?? this.activeUser;
    const generated = this.createProfileDetailsFormForUser(user);
    this.profileDetailsFormByUser[userId] = generated;
    return generated;
  }

  private createProfileDetailsFormForUser(user: DemoUser): AppTypes.ProfileDetailFormGroup[] {
    const beliefsValuesOptions = this.beliefsValuesAllOptions();
    const interestOptions = this.interestAllOptions();
    return PROFILE_DETAILS.map((group: ProfileGroup) => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: this.profileDetailSeedValue(user, row.label, row.value),
        privacy: row.privacy,
        options:
          row.label === 'Values'
            ? beliefsValuesOptions
            : row.label === 'Interest'
              ? interestOptions
              : this.profileDetailValueOptions[row.label] ?? [row.value]
      }))
    }));
  }

  private profileDetailSeedValue(user: DemoUser, label: string, fallback: string): string {
    switch (label) {
      case 'Name':
        return user.name;
      case 'City':
        return user.city;
      case 'Birthday': {
        const parsed = AppUtils.fromIsoDate(user.birthday);
        return parsed
          ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : fallback;
      }
      case 'Height':
        return user.height;
      case 'Physique':
        return user.physique;
      case 'Languages':
        return user.languages.join(', ');
      case 'Horoscope':
        return user.horoscope;
      case 'Gender':
        return user.gender === 'woman' ? 'Woman' : 'Man';
      case 'Interest': {
        const selected = this.seededOptionsForUser(user, this.interestAllOptions(), 3, label);
        return selected.join(', ');
      }
      case 'Values': {
        const selected = this.seededOptionsForUser(user, this.beliefsValuesAllOptions(), 3, label);
        return selected.join(', ');
      }
      default: {
        const options = this.profileDetailValueOptions[label] ?? [];
        if (options.length === 0) {
          return fallback;
        }
        return this.seededOptionForUser(user, options, label);
      }
    }
  }

  private seededOptionForUser(user: DemoUser, options: string[], context: string): string {
    if (options.length === 0) {
      return '';
    }
    const seed = AppDemoGenerators.hashText(`profile-detail:${user.id}:${context}`);
    return options[seed % options.length] ?? options[0];
  }

  private seededOptionsForUser(user: DemoUser, options: string[], count: number, context: string): string[] {
    if (options.length === 0 || count <= 0) {
      return [];
    }
    const start = AppDemoGenerators.hashText(`profile-detail-list:${user.id}:${context}`) % options.length;
    const selected: string[] = [];
    let index = start;
    while (selected.length < Math.min(count, options.length)) {
      const option = options[index % options.length];
      if (!selected.includes(option)) {
        selected.push(option);
      }
      index += 3;
    }
    return selected;
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  protected get isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isNarrowViewport = window.matchMedia('(max-width: 760px)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isNarrowViewport && hasCoarsePointer;
  }

  protected get isMobilePopupSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  protected openMobileAssetFilterSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Asset Type',
      selected: this.ownedAssets.assetFilter,
      options: this.assetFilterOptions.map(option => ({
        value: option,
        label: option,
        icon: this.assetTypeIcon(option),
        toneClass: this.assetTypeClass(option),
        badge: this.assetFilterCount(option)
      })),
      context: { kind: 'assetFilter' }
    };
  }

  protected openMobileSubEventResourceFilterSelector(event: Event): void {
    if (!this.isMobilePopupSheetViewport || this.stackedPopup !== 'subEventAssets' || !this.selectedSubEventBadgeContext) {
      return;
    }
    event.stopPropagation();
    const selected = this.normalizeSubEventResourceFilter(this.subEventResourceFilter);
    this.mobileProfileSelectorSheet = {
      title: 'Assets',
      selected,
      options: this.subEventResourceFilterOptions.map(option => ({
        value: option,
        label: option.toLowerCase(),
        icon: this.subEventResourceTypeIcon(option),
        toneClass: this.subEventResourceTypeClass(option),
        badge: this.subEventResourceFilterCount(option)
      })),
      context: { kind: 'subEventResourceFilter' }
    };
  }

  protected openMobileEventFrequencySelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Frequency',
      selected: this.eventForm.frequency,
      options: this.eventFrequencyOptions.map(option => ({
        value: option,
        label: option,
        icon: this.eventFrequencyIcon(option),
        toneClass: this.eventFrequencyClass(option)
      })),
      context: { kind: 'eventFrequency' }
    };
  }

  protected closeMobileProfileSelectorSheet(): void {
    this.mobileProfileSelectorSheet = null;
  }

  protected isMobileSelectorOptionActive(value: string): boolean {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return false;
    }
    return sheet.selected === value;
  }

  protected selectMobileProfileSelectorOption(value: string): void {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return;
    }
    if (sheet.context.kind === 'assetFilter') {
      if (this.assetFilterOptions.includes(value as AppTypes.AssetFilterType)) {
        this.ownedAssets.selectAssetFilter(value as AppTypes.AssetFilterType);
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'subEventResourceFilter') {
      const filter = this.normalizeSubEventResourceFilter(value);
      this.selectSubEventResourceFilter(filter);
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'eventFrequency') {
      if (this.eventFrequencyOptions.includes(value)) {
        this.eventForm.frequency = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    this.mobileProfileSelectorSheet = null;
  }

  private feedbackSectionFromTag(
    kind: 'event' | 'attendee',
    tag: string
  ): 'personality' | 'vibe' | 'category' {
    const normalized = AppUtils.normalizeText(tag);
    if (kind === 'event') {
      if (normalized.includes('communic') || normalized.includes('organ') || normalized.includes('consist')) {
        return 'personality';
      }
      if (normalized.includes('plan') || normalized.includes('resource') || normalized.includes('quality')) {
        return 'category';
      }
      return 'vibe';
    }
    if (normalized.includes('team') || normalized.includes('compat') || normalized.includes('role')) {
      return 'personality';
    }
    if (normalized.includes('trust') || normalized.includes('risk') || normalized.includes('fit') || normalized.includes('guidance')) {
      return 'category';
    }
    return 'vibe';
  }

  protected getInvitationActionSummary(invitation: InvitationMenuItem): string {
    const text = AppUtils.normalizeText(invitation.description);
    if (text.includes('jazz') || text.includes('music')) {
      return 'You were added to music + check-in coordination';
    }
    if (text.includes('padel') || text.includes('pair')) {
      return 'You were placed as a pair candidate for the next phase';
    }
    if (text.includes('photo') || text.includes('studio')) {
      return 'You were assigned to checkpoint and content capture';
    }
    if (text.includes('ski') || text.includes('carpool')) {
      return 'You were added to transport + timing planning';
    }
    return 'You have a pending role/action update for this event';
  }

  private chatChannelType(item: ChatMenuItem): AppTypes.ChatChannelType {
    if (item.channelType === 'mainEvent' || item.channelType === 'optionalSubEvent' || item.channelType === 'groupSubEvent') {
      return item.channelType;
    }
    return 'general';
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
    const members = includeMembers ? this.chatCountValue(subEvent.membersPending) : 0;
    return members
      + this.subEventAssetBadgePendingCount(subEvent, 'Car')
      + this.subEventAssetBadgePendingCount(subEvent, 'Accommodation')
      + this.subEventAssetBadgePendingCount(subEvent, 'Supplies');
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

  private chatEventSubEvents(eventId: string): AppTypes.SubEventFormItem[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    const editorSource = this.resolveEventEditorSource();
    if (this.eventEditorService.isOpen() && editorSource?.id === normalizedEventId) {
      return this.sortSubEventsByStartAsc(this.cloneSubEvents(this.eventForm.subEvents));
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

  private attachUserToOptionalSubEvent(eventId: string, subEventId: string, userId: string): void {
    const key = this.optionalSubEventMembershipKey(eventId, subEventId);
    const next = new Set(this.optionalSubEventAcceptedMemberIds(eventId, subEventId));
    next.add(userId);
    this.acceptedOptionalSubEventMembersByKey[key] = [...next];
  }

  private detachUserFromOptionalSubEvent(eventId: string, subEventId: string, userId: string): void {
    const key = this.optionalSubEventMembershipKey(eventId, subEventId);
    const next = new Set(this.optionalSubEventAcceptedMemberIds(eventId, subEventId));
    next.delete(userId);
    this.acceptedOptionalSubEventMembersByKey[key] = [...next];
  }

  private attachUserToTournamentGroup(
    eventId: string,
    subEventId: string,
    groupId: string,
    userId: string
  ): void {
    const subEvent = this.chatEventSubEvents(eventId).find(item => item.id === subEventId) ?? null;
    if (!subEvent) {
      return;
    }
    const groups = this.subEventGroupsForStage(subEvent);
    if (!groups.some(group => group.id === groupId)) {
      return;
    }
    for (const group of groups) {
      const key = this.tournamentGroupMembershipKey(eventId, subEventId, group.id);
      const next = new Set(this.tournamentGroupAcceptedMemberIds(eventId, subEventId, group.id, groups));
      next.delete(userId);
      this.acceptedTournamentGroupMembersByKey[key] = [...next];
    }
    const targetKey = this.tournamentGroupMembershipKey(eventId, subEventId, groupId);
    const target = new Set(this.acceptedTournamentGroupMembersByKey[targetKey] ?? []);
    target.add(userId);
    this.acceptedTournamentGroupMembersByKey[targetKey] = [...target];
  }

  private detachUserFromTournamentGroups(eventId: string, subEventId: string, userId: string): void {
    const subEvent = this.chatEventSubEvents(eventId).find(item => item.id === subEventId) ?? null;
    if (!subEvent) {
      return;
    }
    const groups = this.subEventGroupsForStage(subEvent);
    for (const group of groups) {
      const key = this.tournamentGroupMembershipKey(eventId, subEventId, group.id);
      const next = new Set(this.tournamentGroupAcceptedMemberIds(eventId, subEventId, group.id, groups));
      next.delete(userId);
      this.acceptedTournamentGroupMembersByKey[key] = [...next];
    }
  }

  private attachUserToSelectedSubEventChat(userId: string): void {
    const context = this.selectedSubEventBadgeContext;
    const subEvent = context?.subEvent ?? null;
    if (!subEvent) {
      return;
    }
    const eventId = this.resolveEventIdForSubEvent(subEvent);
    if (!eventId) {
      return;
    }
    if (subEvent.optional) {
      this.attachUserToOptionalSubEvent(eventId, subEvent.id, userId);
    }
    if (context?.groupId) {
      this.attachUserToTournamentGroup(eventId, subEvent.id, context.groupId, userId);
    }
  }

  private detachUserFromSelectedSubEventChat(userId: string): void {
    const context = this.selectedSubEventBadgeContext;
    const subEvent = context?.subEvent ?? null;
    if (!subEvent) {
      return;
    }
    const eventId = this.resolveEventIdForSubEvent(subEvent);
    if (!eventId) {
      return;
    }
    if (subEvent.optional) {
      this.detachUserFromOptionalSubEvent(eventId, subEvent.id, userId);
    }
    if (context?.groupId) {
      this.detachUserFromTournamentGroups(eventId, subEvent.id, userId);
    }
  }

  private resolveEventIdForSubEvent(subEvent: AppTypes.SubEventFormItem): string | null {
    const editorContainsSubEvent = this.eventForm.subEvents.some(item => item.id === subEvent.id);
    if (editorContainsSubEvent) {
      const editorSource = this.resolveEventEditorSource();
      if (editorSource?.id) {
        return editorSource.id;
      }
      if (this.editingEventId) {
        return this.editingEventId;
      }
    }
    for (const [eventId, items] of Object.entries(this.eventSubEventsById)) {
      if (items.some(item => item.id === subEvent.id)) {
        return eventId;
      }
    }
    return this.normalizeLocationValue(this.activitiesContext.eventChatSession()?.item.eventId).trim() || null;
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

  protected get ticketRows(): AppTypes.ActivityListRow[] {
    const eventRows = this.eventItems
      .filter(item => this.eventTicketingById[item.id] === true)
      .map<AppTypes.ActivityListRow>(item => ({
        id: item.id,
        type: 'events',
        title: item.title,
        subtitle: item.shortDescription,
        detail: item.timeframe,
        dateIso: this.eventDatesById[item.id] ?? '2026-03-01T09:00:00',
        distanceKm: this.eventDistanceById[item.id] ?? 10,
        unread: item.activity,
        metricScore: item.activity,
        isAdmin: item.isAdmin,
        source: item
      }));
    const hostingRows = this.hostingItems
      .filter(item => this.eventTicketingById[item.id] === true)
      .map<AppTypes.ActivityListRow>(item => ({
        id: item.id,
        type: 'hosting',
        title: item.title,
        subtitle: item.shortDescription,
        detail: item.timeframe,
        dateIso: this.hostingDatesById[item.id] ?? this.eventDatesById[item.id] ?? '2026-03-01T09:00:00',
        distanceKm: this.hostingDistanceById[item.id] ?? this.eventDistanceById[item.id] ?? 10,
        unread: item.activity,
        metricScore: item.activity,
        isAdmin: true,
        source: item
      }));
    return [...eventRows, ...hostingRows].sort((a, b) => AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
  }

  protected ticketCardMetaLine(row: AppTypes.ActivityListRow): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  private acceptInvitationFromRow(invitationId: string): void {
    if (this.isInvitationAcceptedId(invitationId)) {
      return;
    }
    const acceptedIds = this.acceptedInvitationIdsByUser[this.activeUser.id] ?? [];
    this.acceptedInvitationIdsByUser[this.activeUser.id] = [...acceptedIds, invitationId];
  }

  private isInvitationAcceptedId(invitationId: string): boolean {
    return (this.acceptedInvitationIdsByUser[this.activeUser.id] ?? []).includes(invitationId);
  }

  private acceptedInvitationRowsAsEvents(): AppTypes.ActivityListRow[] {
    const acceptedIds = new Set(this.acceptedInvitationIdsByUser[this.activeUser.id] ?? []);
    if (acceptedIds.size === 0) {
      return [];
    }
    return this.invitationItems
      .filter(item => acceptedIds.has(item.id))
      .map(item => {
        const syntheticEvent: EventMenuItem = {
          id: item.id,
          avatar: item.avatar,
          title: item.description,
          shortDescription: `Invited by ${item.inviter}`,
          timeframe: item.when,
          activity: item.unread,
          isAdmin: false
        };
        return {
          id: item.id,
          type: 'events',
          title: syntheticEvent.title,
          subtitle: syntheticEvent.shortDescription,
          detail: syntheticEvent.timeframe,
          dateIso: this.invitationDatesById[item.id] ?? '2026-02-21T09:00:00',
          distanceKm: this.invitationDistanceById[item.id] ?? 5,
          unread: syntheticEvent.activity,
          metricScore: syntheticEvent.activity,
          isAdmin: false,
          source: syntheticEvent
        };
      });
  }

  protected activityTypeLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'Event';
    }
    if (row.type === 'hosting') {
      return 'Hosting';
    }
    if (row.type === 'invitations') {
      return 'Invitation';
    }
    if (row.type === 'rates') {
      return 'Rate';
    }
    return 'Chat';
  }

  protected activityDateLabel(row: AppTypes.ActivityListRow): string {
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return row.detail;
    }
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  protected activityImageUrl(row: AppTypes.ActivityListRow): string {
    return this.activityImageById[row.id] ?? 'https://picsum.photos/seed/event-default/1200/700';
  }

  protected activitySourceLink(row: AppTypes.ActivityListRow): string {
    return this.activitySourceLinkById[row.id] ?? 'https://example.com/events';
  }

  protected showActivitySourceIcon(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'invitations';
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

  protected activitySourceAvatarClass(row: AppTypes.ActivityListRow): string {
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${(row.source as InvitationMenuItem).inviter}`
      : `${row.id}-${row.title}`;
    const toneIndex = (AppDemoGenerators.hashText(toneSeed) % 8) + 1;
    return `activities-source-tone-${toneIndex}`;
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

  private syncActivityCapacityLabelFromEventForm(eventId: string): void {
    const current = this.parseActivityCapacityLabel(this.activityCapacityById[eventId]);
    const accepted = current.accepted ?? 0;
    const fallbackTotal = current.total ?? 4;
    const normalized = this.normalizedEventCapacityRange();
    const configuredTotal = normalized.max ?? normalized.min ?? fallbackTotal;
    const total = Math.max(accepted, configuredTotal, 0);
    this.activityCapacityById[eventId] = `${accepted} / ${Math.trunc(total)}`;
  }

  private parseActivityCapacityLabel(value: string | null | undefined): { accepted: number | null; total: number | null } {
    const raw = `${value ?? ''}`.trim();
    if (!raw.includes('/')) {
      return { accepted: null, total: null };
    }
    const [acceptedRaw, totalRaw] = raw.split('/');
    const acceptedParsed = Number.parseInt((acceptedRaw ?? '').trim(), 10);
    const totalParsed = Number.parseInt((totalRaw ?? '').trim(), 10);
    return {
      accepted: Number.isFinite(acceptedParsed) ? Math.max(0, acceptedParsed) : null,
      total: Number.isFinite(totalParsed) ? Math.max(0, totalParsed) : null
    };
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

  protected activityDateRangeMetaLine(row: AppTypes.ActivityListRow): string {
    const dateRange = AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
    if (!dateRange) {
      return this.activityDateLabel(row);
    }
    return this.formatActivityDateRange(dateRange.start, dateRange.end);
  }

  protected activityLocationMetaLine(row: AppTypes.ActivityListRow): string {
    const location = this.activityEventLocationLabel(row);
    if (!location) {
      return '';
    }
    const distance = this.activityDistanceLabel(row.distanceKm);
    return `${location} (${distance})`;
  }

  protected activityMetaLine(row: AppTypes.ActivityListRow): string {
    return `${this.activityTypeLabel(row)} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  private formatActivityDateRange(start: Date, end: Date): string {
    const safeStart = new Date(start);
    const safeEnd = new Date(end);
    if (Number.isNaN(safeStart.getTime()) || Number.isNaN(safeEnd.getTime())) {
      return '';
    }
    const normalizedEnd = safeEnd.getTime() > safeStart.getTime()
      ? safeEnd
      : new Date(safeStart.getTime() + 2 * 60 * 60 * 1000);
    const startDateLabel = safeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTimeLabel = safeStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeLabel = normalizedEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (safeStart.toDateString() === normalizedEnd.toDateString()) {
      return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel}`;
    }
    const endDateLabel = normalizedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startDateLabel}, ${startTimeLabel} - ${endDateLabel}, ${endTimeLabel}`;
  }

  private activityEventLocationLabel(row: AppTypes.ActivityListRow): string {
    const fromMap = this.normalizeLocationValue(this.eventLocationById[row.id]).trim();
    if (fromMap) {
      return fromMap;
    }
    const subEvents = this.eventSubEventsById[row.id] ?? [];
    const fromSubEvent = this.normalizeLocationValue(this.firstSubEventByOrder(subEvents)?.location).trim();
    if (fromSubEvent) {
      return fromSubEvent;
    }
    const source = (row.source && typeof row.source === 'object') ? row.source as unknown as Record<string, unknown> : null;
    const sourceLocation = this.normalizeLocationValue((source?.['location'] as string | undefined) ?? '').trim();
    return sourceLocation;
  }

  private activityDistanceLabel(distanceKm: number): string {
    const numeric = Number(distanceKm);
    if (!Number.isFinite(numeric)) {
      return '0 km';
    }
    const rounded = Math.round(numeric * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  protected closeInlineItemActionMenu(event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
  }

  protected openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.subEventAssetMembersContext = null;
    this.activityMembersReadOnly = false;
    this.activityMembersPopupOrigin = null;
    this.pendingActivityMemberDelete = null;
    this.activityMembersPendingOnly = false;
    this.selectedActivityMembersRowId = `${row.type}:${row.id}`;
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(row));
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.selectedActivityMembersRow = row;
    this.selectedActivityMembersTitle = row.title;
    this.selectedActivityInviteUserIds = [];
    this.superStackedPopup = null;
    this.stackedPopup = 'activityMembers';
  }

  protected openEventEditorMembers(event?: Event): void {
    event?.stopPropagation();
    const row = this.eventEditorMembersRow();
    if (!row) {
      return;
    }
    const moduleEditorOpen = this.eventEditorService.isOpen();
    if (moduleEditorOpen) {
      this.eventEditorService.close();
    }
    this.openActivityMembers(row, event);
    this.activityMembersPopupOrigin = moduleEditorOpen ? 'stacked-event-editor' : null;
  }

  protected handlePrimaryPopupHeaderClose(): void {
    this.closePopup();
  }

  protected handleStackedPopupHeaderClose(): void {
    this.closeStackedPopup();
  }

  protected closeActivityMembersPopup(): void {
    this.closeStackedPopup();
  }

  protected handleActivityMembersInvite(): void {
    this.openActivityInviteFriends();
  }

  protected handleActivityMembersTogglePendingOnly(): void {
    this.toggleActivityMembersPendingOnly();
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

  protected closeSubEventMembersPopup(): void {
    this.closeStackedPopup();
  }

  protected handleSubEventMembersInvite(): void {
    this.openSubEventMembersInviteFriends();
  }

  protected handleSubEventMembersTogglePendingOnly(): void {
    this.toggleSubEventMembersPendingOnly();
  }

  protected handleSubEventMemberActionMenuToggle(payload: { entry: AppTypes.ActivityMemberEntry; event: Event }): void {
    this.toggleSubEventMemberActionMenu(payload.entry, payload.event);
  }

  protected handleSubEventMemberRemove(entry: AppTypes.ActivityMemberEntry): void {
    this.removeSubEventMember(entry);
  }

  protected handleSubEventMemberRolePickerToggle(payload: { entry: AppTypes.ActivityMemberEntry; event: Event }): void {
    this.toggleSubEventMemberRolePicker(payload.entry, payload.event);
  }

  protected handleSubEventMemberRoleSelection(payload: { entry: AppTypes.ActivityMemberEntry; role: AppTypes.ActivityMemberRole; event: Event }): void {
    this.setSubEventMemberRole(payload.entry, payload.role, payload.event);
  }

  protected openActivityInviteFriends(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.selectedActivityMembersRow) {
      return;
    }
    this.activityInviteSort = 'recent';
    this.selectedActivityInviteUserIds = [];
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = 'activityInviteFriends';
  }

  private openActivityInviteFriendsFromMembersPopup(ownerId: string, fallbackTitle?: string): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }

    const eventSource = this.eventItems.find(item => item.id === normalizedOwnerId) ?? null;
    const hostingSource = !eventSource
      ? (this.hostingItems.find(item => item.id === normalizedOwnerId) ?? null)
      : null;
    const source = eventSource ?? hostingSource;
    if (!source) {
      return;
    }

    const isHosting = source === hostingSource;
    const row: AppTypes.ActivityListRow = {
      id: source.id,
      type: isHosting ? 'hosting' : 'events',
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: this.eventDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? 0,
      unread: source.activity,
      metricScore: source.activity,
      isAdmin: isHosting ? true : ('isAdmin' in source ? source.isAdmin === true : false),
      source
    };

    const ownerMembers = this.activityMembersService.peekMembersByOwnerId(normalizedOwnerId);
    this.selectedActivityMembersRow = row;
    this.selectedActivityMembersRowId = `${row.type}:${row.id}`;
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(
      ownerMembers.length > 0 ? ownerMembers : this.getActivityMembersByRow(row)
    );
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.selectedActivityMembersTitle = fallbackTitle?.trim() || row.title;
    this.activityInviteSort = 'recent';
    this.selectedActivityInviteUserIds = [];
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = 'activityInviteFriends';
    this.syncAssetPopupVisibility();
  }

  protected closeActivityInviteFriends(applyInvitations = false): void {
    if (applyInvitations) {
      this.applySelectedActivityInvitations();
    }
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = null;
  }

  protected canConfirmActivityInviteSelection(): boolean {
    return this.selectedActivityInviteUserIds.length > 0;
  }

  protected confirmActivityInviteSelection(event?: Event): void {
    event?.stopPropagation();
    if (!this.canConfirmActivityInviteSelection()) {
      return;
    }
    this.closeActivityInviteFriends(true);
  }

  protected toggleActivityInviteSortPicker(event?: Event): void {
    event?.stopPropagation();
    this.showActivityInviteSortPicker = !this.showActivityInviteSortPicker;
  }

  protected selectActivityInviteSort(sort: AppTypes.ActivityInviteSort): void {
    this.activityInviteSort = sort;
    this.showActivityInviteSortPicker = false;
  }

  protected toggleActivityInviteFriend(userId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedActivityInviteUserIds.includes(userId)) {
      this.selectedActivityInviteUserIds = this.selectedActivityInviteUserIds.filter(id => id !== userId);
      return;
    }
    this.selectedActivityInviteUserIds = [...this.selectedActivityInviteUserIds, userId];
  }

  protected isActivityInviteFriendSelected(userId: string): boolean {
    return this.selectedActivityInviteUserIds.includes(userId);
  }

  protected get activityInviteCandidates(): AppTypes.ActivityMemberEntry[] {
    if (!this.selectedActivityMembersRow) {
      return [];
    }
    const existing = new Set(this.selectedActivityMembers.map(member => member.userId));
    const candidates = this.users
      .filter(user => user.id !== this.activeUser.id && !existing.has(user.id))
      .map(user => AppDemoGenerators.toActivityMemberEntry(
        user,
        this.selectedActivityMembersRow!,
        this.selectedActivityMembersRowId!,
        this.activeUser.id,
        {
          status: 'pending',
          pendingSource: this.selectedActivityMembersRow?.isAdmin ? 'admin' : 'member',
          invitedByActiveUser: true
        },
        APP_DEMO_DATA.activityMemberMetPlaces
      ));
    return [...candidates].sort((a, b) => {
      if (this.activityInviteSort === 'relevant') {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
      }
      return AppUtils.toSortableDate(b.metAtIso) - AppUtils.toSortableDate(a.metAtIso);
    });
  }

  protected get selectedActivityInviteChips(): AppTypes.ActivityMemberEntry[] {
    const selected = new Set(this.selectedActivityInviteUserIds);
    return this.activityInviteCandidates.filter(item => selected.has(item.userId));
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

  protected toggleActivityMembersPendingOnly(event?: Event): void {
    event?.stopPropagation();
    this.activityMembersPendingOnly = !this.activityMembersPendingOnly;
  }

  protected activityMembersHeaderSummary(): string {
    const pendingCount = this.selectedActivityMembers.filter(member => member.status === 'pending').length;
    const acceptedCount = this.selectedActivityMembers.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected canShowActivityMembersInviteButton(): boolean {
    return !this.activityMembersReadOnly;
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

  protected activityMemberMenuDeleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  protected activityInviteMetLabel(entry: AppTypes.ActivityMemberEntry): string {
    const dateText = new Date(entry.metAtIso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${entry.metWhere} · ${dateText}`;
  }

  protected activityMemberActionDate(entry: AppTypes.ActivityMemberEntry): string {
    const when = new Date(entry.actionAtIso);
    const dateText = Number.isNaN(when.getTime())
      ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : when.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${dateText}`;
  }

  protected activityMemberAge(entry: AppTypes.ActivityMemberEntry): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  private activityMemberRole(entry: AppTypes.ActivityMemberEntry): AppTypes.ActivityMemberRole {
    if (entry.role === 'Admin') {
      return 'Admin';
    }
    if (this.subEventAssetMembersContext?.ownerUserId && entry.userId === this.subEventAssetMembersContext.ownerUserId) {
      return 'Manager';
    }
    if (entry.role === 'Manager') {
      return 'Manager';
    }
    const mainEventContext = this.resolveMainEventMembersContext();
    if (
      mainEventContext
      && this.selectedActivityMembersRowId === mainEventContext.rowKey
      && this.isUserManagingAnySubEventAsset(entry.userId)
    ) {
      return 'Manager';
    }
    return 'Member';
  }

  protected activityMemberStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'activity-member-approved';
    }
    if (entry.requestKind === 'join') {
      return 'activity-member-join-request';
    }
    if (entry.pendingSource === 'admin') {
      return 'activity-member-pending-invitation';
    }
    return 'activity-member-pending-admin-approval';
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
    if (this.eventEditorInvitationId) {
      return false;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected activityMemberStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return this.subEventAssetMembersContext ? 'Waiting For Admin Approval' : 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  protected memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'admin_panel_settings';
      }
      if (role === 'Manager') {
        return 'manage_accounts';
      }
      return 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  protected memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'member-status-admin';
      }
      if (role === 'Manager') {
        return 'member-status-manager';
      }
      return 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  protected memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'member-card-tone-admin';
      }
      if (role === 'Manager') {
        return 'member-card-tone-manager';
      }
      return 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  protected memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      return role;
    }
    return this.activityMemberStatusLabel(entry);
  }

  protected activityMemberRoleLabel(entry: AppTypes.ActivityMemberEntry): string {
    return this.activityMemberRole(entry);
  }

  protected approveActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canApproveActivityMember(entry)) {
      return;
    }
    const shouldCascadeToAssets = this.isMainEventMembersSelection();
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
    this.attachUserToSelectedSubEventChat(entry.userId);
    if (shouldCascadeToAssets) {
      this.promotePendingAssetRequestsAfterMainEventApproval(entry.userId);
    }
    this.syncSubEventAssetMembersRequestsFromSelection();
    this.emitActivitiesEventSyncForSelectedMembersRow();
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

  protected confirmRemoveActivityMember(): void {
    if (!this.pendingActivityMemberDelete || !this.selectedActivityMembersRowId) {
      this.pendingActivityMemberDelete = null;
      return;
    }
    const shouldCascadeToAssets = this.isMainEventMembersSelection();
    const targetId = this.pendingActivityMemberDelete.id;
    const removedUserId = this.pendingActivityMemberDelete.userId;
    this.selectedActivityMembers = this.selectedActivityMembers.filter(item => item.id !== targetId);
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.detachUserFromSelectedSubEventChat(removedUserId);
    if (shouldCascadeToAssets) {
      this.cascadeMainEventMemberRemovalToAssets(removedUserId);
    }
    this.syncSubEventAssetMembersRequestsFromSelection();
    this.emitActivitiesEventSyncForSelectedMembersRow();
    this.pendingActivityMemberDelete = null;
  }

  protected cancelRemoveActivityMember(): void {
    this.pendingActivityMemberDelete = null;
  }

  protected pendingActivityMemberDeleteTitle(): string {
    return 'Remove member';
  }

  protected pendingActivityMemberDeleteLabel(): string {
    if (!this.pendingActivityMemberDelete) {
      return '';
    }
    if (this.subEventAssetMembersContext) {
      return `Remove ${this.pendingActivityMemberDelete.name} from this asset?`;
    }
    return `Remove ${this.pendingActivityMemberDelete.name} from this event?`;
  }

  private isMainEventMembersSelection(): boolean {
    if (this.subEventAssetMembersContext || !this.selectedActivityMembersRowId) {
      return false;
    }
    const mainContext = this.resolveMainEventMembersContext();
    return mainContext !== null && mainContext.rowKey === this.selectedActivityMembersRowId;
  }

  private promotePendingAssetRequestsAfterMainEventApproval(userId: string): void {
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card => {
      if (card.type !== 'Car' && card.type !== 'Accommodation') {
        return card;
      }
      const requests = card.requests.map(request => {
        if (AppUtils.resolveAssetRequestUserId(request, this.users) !== userId || request.status !== 'pending') {
          return request;
        }
        return {
          ...request,
          note: 'Waiting for owner approval.'
        };
      });
      return { ...card, requests };
    });
    this.syncAllSubEventAssetBadgeCounts();
  }

  private cascadeMainEventMemberRemovalToAssets(userId: string): void {
    this.removeMainEventMemberFromAssetRequests(userId);
    this.removeMainEventMemberSupplyContributions(userId);
    this.cleanupMainEventMemberManagedAssets(userId);
    this.syncAllSubEventAssetBadgeCounts();
  }

  private removeMainEventMemberFromAssetRequests(userId: string): void {
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card => {
      if (card.type !== 'Car' && card.type !== 'Accommodation') {
        return card;
      }
      return {
        ...card,
        requests: card.requests.filter(request => AppUtils.resolveAssetRequestUserId(request, this.users) !== userId)
      };
    });
  }

  private removeMainEventMemberSupplyContributions(userId: string): void {
    for (const key of Object.keys(this.subEventSupplyContributionEntriesByAssignmentKey)) {
      const current = this.subEventSupplyContributionEntriesByAssignmentKey[key];
      if (!current || current.length === 0) {
        continue;
      }
      const next = current.filter(entry => entry.userId !== userId);
      if (next.length === 0) {
        delete this.subEventSupplyContributionEntriesByAssignmentKey[key];
      } else {
        this.subEventSupplyContributionEntriesByAssignmentKey[key] = next;
      }
    }
  }

  private cleanupMainEventMemberManagedAssets(userId: string): void {
    const assignmentKeys = new Set<string>([
      ...Object.keys(this.subEventAssignedAssetIdsByKey),
      ...Object.keys(this.subEventAssignedAssetSettingsByKey)
    ]);
    for (const key of assignmentKeys) {
      const parsed = this.parseSubEventAssetAssignmentKey(key);
      if (!parsed) {
        continue;
      }
      const { subEventId, type } = parsed;
      const currentSettings = this.getSubEventAssignedAssetSettings(subEventId, type);
      const currentAssignedIds = this.subEventAssignedAssetIdsByKey[key] ?? [];
      let nextSettings = { ...currentSettings };
      let nextAssignedIds = [...currentAssignedIds];
      let changed = false;
      for (const [assetId, setting] of Object.entries(currentSettings)) {
        if (setting.addedByUserId !== userId) {
          continue;
        }
        changed = true;
        if (type === 'Car' || type === 'Accommodation') {
          delete nextSettings[assetId];
          nextAssignedIds = nextAssignedIds.filter(id => id !== assetId);
          continue;
        }
        const contributionKey = this.subEventSupplyAssignmentKey(subEventId, assetId);
        const contributions = this.subEventSupplyContributionEntriesByAssignmentKey[contributionKey] ?? [];
        const contributionTotals = contributions.reduce<Record<string, number>>((acc, entry) => {
          const quantity = AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER);
          if (quantity <= 0) {
            return acc;
          }
          acc[entry.userId] = (acc[entry.userId] ?? 0) + quantity;
          return acc;
        }, {});
        const nextManagerId = Object.entries(contributionTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([contributorId]) => contributorId)[0] ?? null;
        if (nextManagerId) {
          nextSettings[assetId] = {
            ...setting,
            addedByUserId: nextManagerId
          };
          continue;
        }
        delete nextSettings[assetId];
        nextAssignedIds = nextAssignedIds.filter(id => id !== assetId);
        delete this.subEventSupplyContributionEntriesByAssignmentKey[contributionKey];
      }
      if (!changed) {
        continue;
      }
      this.subEventAssignedAssetSettingsByKey[key] = nextSettings;
      this.subEventAssignedAssetIdsByKey[key] = nextAssignedIds;
      const subEvent = this.findSubEventById(subEventId);
      if (subEvent) {
        this.syncSubEventAssetBadgeCounts(subEvent, type, nextAssignedIds);
      }
    }
  }

  private parseSubEventAssetAssignmentKey(key: string): { subEventId: string; type: AppTypes.AssetType } | null {
    const separatorIndex = key.lastIndexOf(':');
    if (separatorIndex <= 0) {
      return null;
    }
    const subEventId = key.slice(0, separatorIndex);
    const type = key.slice(separatorIndex + 1);
    if (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies') {
      return null;
    }
    return { subEventId, type };
  }

  protected isInvitationAccepted(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'invitations' && this.isInvitationAcceptedId(row.id);
  }

  protected selectedInvitationIsAccepted(): boolean {
    return this.selectedInvitation ? this.isInvitationAcceptedId(this.selectedInvitation.id) : false;
  }

  protected approveSelectedInvitation(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedInvitation) {
      return;
    }
    this.acceptInvitationAndMoveToEvents(this.selectedInvitation);
  }

  protected deleteSelectedInvitation(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedInvitation) {
      return;
    }
    const deletedId = this.selectedInvitation.id;
    this.removeInvitationById(deletedId);
    this.selectedInvitation = null;
    if (this.stackedPopup === 'invitationActions') {
      this.stackedPopup = null;
      return;
    }
    if (this.activePopup === 'invitationActions') {
      this.activePopup = null;
    }
  }

  private removeInvitationById(invitationId: string): void {
    const next = this.invitationItems.filter(item => item.id !== invitationId);
    this.invitationItemsByUser[this.activeUser.id] = next;
    this.acceptedInvitationIdsByUser[this.activeUser.id] = (this.acceptedInvitationIdsByUser[this.activeUser.id] ?? []).filter(id => id !== invitationId);
  }

  private acceptInvitationAndMoveToEvents(invitation: InvitationMenuItem): void {
    const titleKey = AppUtils.normalizeText(invitation.description);
    const existingEvent = this.eventItems.find(item => AppUtils.normalizeText(item.title) === titleKey);
    if (!existingEvent) {
      const eventId = `inv-event-${invitation.id}`;
      const invitedEvent: EventMenuItem = {
        id: eventId,
        avatar: AppUtils.initialsFromText(invitation.inviter),
        title: invitation.description,
        shortDescription: `Invited by ${invitation.inviter}`,
        timeframe: invitation.when,
        activity: Math.max(0, invitation.unread),
        isAdmin: false
      };
      this.eventItemsByUser[this.activeUser.id] = [invitedEvent, ...this.eventItems];
      this.eventDatesById[eventId] = this.invitationDatesById[invitation.id] ?? this.defaultEventStartIso();
      this.eventDistanceById[eventId] = this.invitationDistanceById[invitation.id] ?? 10;
      this.eventVisibilityById[eventId] = this.eventVisibilityById[eventId] ?? 'Invitation only';
      this.eventBlindModeById[eventId] = this.eventBlindModeById[eventId] ?? 'Open Event';
      this.eventAutoInviterById[eventId] = this.eventAutoInviterById[eventId] ?? false;
      this.eventTicketingById[eventId] = this.eventTicketingById[eventId] ?? false;
      this.eventCapacityById[eventId] = this.eventCapacityById[eventId] ?? { min: 0, max: 0 };
      this.eventSubEventsById[eventId] = this.eventSubEventsById[eventId] ?? [];
    }
    this.acceptInvitationFromRow(invitation.id);
    this.removeInvitationById(invitation.id);
  }

  private resolveRelatedEventFromInvitation(invitation: InvitationMenuItem | null): EventMenuItem | HostingMenuItem | null {
    if (!invitation) {
      return null;
    }
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

  protected trackBySubEventResourceCard(_: number, card: AppTypes.SubEventResourceCard): string {
    return card.id;
  }

  protected addSupplyType(): void {
    const value = this.newSupplyType.trim();
    if (!value) {
      return;
    }
    if (!this.eventSupplyTypes.some(type => type.toLowerCase() === value.toLowerCase())) {
      this.eventSupplyTypes = [...this.eventSupplyTypes, value];
    }
    this.newSupplyType = '';
  }

  protected openSupplyDetail(subEventId: string, subEventTitle: string, type: string): void {
    this.selectedSupplyContext = { subEventId, subEventTitle, type };
    if (this.stackedPopup !== null) {
      this.stackedPopup = 'supplyDetail';
      return;
    }
    this.activePopup = 'supplyDetail';
  }

  protected getSupplyStat(subEvent: AppTypes.SubEventCard, type: string): string {
    const normalized = type.toLowerCase();
    if (normalized.includes('car')) {
      return subEvent.requirements.cars;
    }
    if (normalized.includes('accommodation')) {
      return subEvent.requirements.accommodation;
    }
    if (normalized.includes('accessor')) {
      return subEvent.requirements.accessories;
    }
    if (normalized.includes('member')) {
      return `${this.eventEditor.members.length} / ${this.eventEditor.mainEvent.capacity}`;
    }
    return '0 / 0';
  }

  protected isSupplyStatIncomplete(subEvent: AppTypes.SubEventCard, type: string): boolean {
    const values = this.getSupplyStat(subEvent, type).split('/');
    if (values.length !== 2) {
      return false;
    }
    const current = Number.parseInt(values[0].trim(), 10);
    const max = Number.parseInt(values[1].trim(), 10);
    if (!Number.isFinite(current) || !Number.isFinite(max)) {
      return false;
    }
    return current < max;
  }

  protected get selectedSupplyItems(): Array<{ label: string; detail: string }> {
    if (!this.selectedSupplyContext) {
      return [];
    }
    const type = this.selectedSupplyContext.type.toLowerCase();
    if (type.includes('car')) {
      return this.eventEditor.cars.map(car => ({ label: car.owner, detail: `${car.route} · seats ${car.seats}` }));
    }
    if (type.includes('accommodation')) {
      return this.eventEditor.accommodations.map(room => ({ label: room.name, detail: `${room.rooms} · ${room.people}` }));
    }
    if (type.includes('accessor')) {
      return this.eventEditor.accessories.map(accessory => ({ label: accessory.item, detail: `required ${accessory.required} · offered ${accessory.offered}` }));
    }
    if (type.includes('member')) {
      return this.eventEditor.members.map(member => ({ label: member.name, detail: member.role }));
    }
    return [{ label: 'Custom supply slot', detail: 'Add items and assign to this sub-event.' }];
  }

  protected get assetCarItems(): Array<{ label: string; detail: string }> {
    return this.eventEditor.cars.map(car => ({ label: car.owner, detail: `${car.route} · seats ${car.seats}` }));
  }

  protected get assetAccommodationItems(): Array<{ label: string; detail: string }> {
    return this.eventEditor.accommodations.map(room => ({ label: room.name, detail: `${room.rooms} · ${room.people}` }));
  }

  protected get assetSuppliesItems(): Array<{ label: string; detail: string }> {
    return this.eventEditor.accessories.map(accessory => ({
      label: accessory.item,
      detail: `required ${accessory.required} · offered ${accessory.offered}`
    }));
  }

  protected get isAssetPopup(): boolean {
    return this.ownedAssets.isPopupOpen();
  }

  protected get selectedAssetCard(): AppTypes.AssetCard | null {
    if (!this.selectedAssetCardId) {
      return null;
    }
    return this.ownedAssets.assetCards.find(card => card.id === this.selectedAssetCardId) ?? null;
  }

  protected assetTypeIcon(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    if (type === 'Ticket') {
      return 'qr_code_2';
    }
    return 'inventory_2';
  }

  protected assetTypeClass(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'asset-filter-car';
    }
    if (type === 'Accommodation') {
      return 'asset-filter-accommodation';
    }
    if (type === 'Supplies') {
      return 'asset-filter-supplies';
    }
    if (type === 'Ticket') {
      return 'asset-filter-ticket';
    }
    return 'asset-filter-car';
  }

  protected assetFilterCount(type: AppTypes.AssetFilterType): number {
    if (type === 'Car') {
      return this.assetCarsBadge;
    }
    if (type === 'Accommodation') {
      return this.assetAccommodationBadge;
    }
    if (type === 'Ticket') {
      return this.assetTicketsBadge;
    }
    return this.assetSuppliesBadge;
  }

  protected assetPendingCount(card: AppTypes.AssetCard): number {
    return card.requests.filter(member => member.status === 'pending').length;
  }

  protected assetAcceptedCount(card: AppTypes.AssetCard): number {
    return card.requests.filter(member => member.status === 'accepted').length;
  }

  protected assetOccupiedCount(card: AppTypes.AssetCard): number {
    return this.assetAcceptedCount(card);
  }

  protected assetOccupancyLabel(card: AppTypes.AssetCard): string {
    return `${this.assetOccupiedCount(card)} / ${card.capacityTotal}`;
  }

  protected assetMemberStatusClass(member: AppTypes.AssetMemberRequest): string {
    return member.status === 'pending' ? 'asset-member-pending' : 'asset-member-accepted';
  }

  protected openAssetMembers(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    this.selectedAssetCardId = card.id;
    this.pendingAssetMemberAction = null;
    this.stackedPopup = 'assetMembers';
  }

  private handleOwnedAssetCreated(card: AppTypes.AssetCard): void {
    const createAssignment = this.pendingSubEventAssetCreateAssignment;
    if (createAssignment && createAssignment.type === card.type) {
      const key = this.subEventAssetAssignmentKey(createAssignment.subEventId, createAssignment.type);
      const assignedIds = this.resolveSubEventAssignedAssetIds(createAssignment.subEventId, createAssignment.type);
      const nextAssignedIds = assignedIds.includes(card.id) ? assignedIds : [...assignedIds, card.id];
      this.subEventAssignedAssetIdsByKey[key] = [...nextAssignedIds];
      const settings = this.getSubEventAssignedAssetSettings(createAssignment.subEventId, createAssignment.type);
      const capacityMax = Math.max(0, card.capacityTotal);
      settings[card.id] = {
        capacityMin: 0,
        capacityMax,
        addedByUserId: this.activeUser.id,
        routes: this.normalizeAssetRoutes(createAssignment.type, card.routes, '')
      };
      this.subEventAssignedAssetSettingsByKey[key] = { ...settings };
      const targetSubEvent = this.resolveSubEventForResourceSync(createAssignment.subEventId);
      if (targetSubEvent) {
        this.syncSubEventAssetBadgeCounts(targetSubEvent, createAssignment.type);
      } else {
        this.refreshEventChatSessionResourceContext(createAssignment.subEventId);
      }
    }
  }

  private handleOwnedAssetDeleted(cardId: string): void {
    this.deleteAssetCard(cardId);
  }

  private deleteAssetCard(cardId: string): void {
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.filter(card => card.id !== cardId);
    for (const key of Object.keys(this.subEventSupplyContributionEntriesByAssignmentKey)) {
      if (key.endsWith(`:${cardId}`)) {
        delete this.subEventSupplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const key of Object.keys(this.subEventAssignedAssetIdsByKey)) {
      const filtered = this.subEventAssignedAssetIdsByKey[key].filter(id => id !== cardId);
      this.subEventAssignedAssetIdsByKey[key] = filtered;
    }
    for (const key of Object.keys(this.subEventAssignedAssetSettingsByKey)) {
      if (this.subEventAssignedAssetSettingsByKey[key][cardId]) {
        const next = { ...this.subEventAssignedAssetSettingsByKey[key] };
        delete next[cardId];
        this.subEventAssignedAssetSettingsByKey[key] = next;
      }
    }
    if (this.selectedAssetCardId === cardId) {
      this.selectedAssetCardId = null;
      this.stackedPopup = null;
      this.pendingAssetMemberAction = null;
    }
    this.syncAllSubEventAssetBadgeCounts();
  }

  protected queueAssetMemberAction(cardId: string, memberId: string, action: AppTypes.AssetRequestAction, event?: Event): void {
    event?.stopPropagation();
    this.pendingAssetMemberAction = { cardId, memberId, action };
  }

  protected cancelAssetMemberAction(): void {
    this.pendingAssetMemberAction = null;
  }

  protected confirmAssetMemberAction(): void {
    const pending = this.pendingAssetMemberAction;
    if (!pending) {
      return;
    }
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card => {
      if (card.id !== pending.cardId) {
        return card;
      }
      if (pending.action === 'remove') {
        return {
          ...card,
          requests: card.requests.filter(member => member.id !== pending.memberId)
        };
      }
      return {
        ...card,
        requests: card.requests.map(member =>
          member.id === pending.memberId
            ? {
              ...member,
              status: 'accepted'
            }
            : member
        )
      };
    });
    this.pendingAssetMemberAction = null;
    this.syncAllSubEventAssetBadgeCounts();
  }

  protected isAssetMemberActionPending(cardId: string, memberId: string, action: AppTypes.AssetRequestAction): boolean {
    return (
      this.pendingAssetMemberAction?.cardId === cardId &&
      this.pendingAssetMemberAction?.memberId === memberId &&
      this.pendingAssetMemberAction?.action === action
    );
  }

  protected pendingAssetMemberActionLabel(): string {
    const pending = this.pendingAssetMemberAction;
    if (!pending) {
      return '';
    }
    const card = this.ownedAssets.assetCards.find(item => item.id === pending.cardId);
    const member = card?.requests.find(item => item.id === pending.memberId);
    if (!member) {
      return '';
    }
    if (pending.action === 'accept') {
      return `Accept ${member.name} for ${card?.title ?? 'this asset'}?`;
    }
    return `Remove ${member.name} from ${card?.title ?? 'this asset'}?`;
  }

  protected triggerAssetImageUpload(event?: Event): void {
    event?.stopPropagation();
    this.assetImageInput?.nativeElement.click();
  }

  protected onAssetImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.applyAssetImageFile(file);
    target.value = '';
  }

  private applyAssetImageFile(file: File): void {
    this.revokeObjectUrl(this.ownedAssets.assetForm.imageUrl);
    this.ownedAssets.assetForm.imageUrl = URL.createObjectURL(file);
  }

  protected refreshAssetFromSourceLink(): void {
    const raw = this.ownedAssets.assetForm.sourceLink.trim();
    if (!raw) {
      return;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      try {
        parsed = new URL(`https://${raw}`);
        this.ownedAssets.assetForm.sourceLink = parsed.toString();
      } catch {
        return;
      }
    }
    if (!parsed || this.isGoogleMapsLikeLink(parsed.toString())) {
      return;
    }
    const seed = `${this.ownedAssets.assetForm.type.toLowerCase()}-${parsed.hostname.replace(/\./g, '-')}${parsed.pathname.replace(/[^\w-]/g, '-')}`;
    if (!this.ownedAssets.assetForm.imageUrl.trim()) {
      this.ownedAssets.assetForm.imageUrl = AppDemoGenerators.defaultAssetImage(this.ownedAssets.assetForm.type, seed);
    }
    if (!this.ownedAssets.assetForm.title.trim()) {
      this.ownedAssets.assetForm.title = `${this.ownedAssets.assetForm.type} · ${parsed.hostname.replace(/^www\./, '')}`;
    }
    if (!this.ownedAssets.assetForm.subtitle.trim()) {
      this.ownedAssets.assetForm.subtitle = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1).replace(/[-_/]+/g, ' ') : 'Imported preview';
    }
    if (!this.ownedAssets.assetForm.details.trim()) {
      this.ownedAssets.assetForm.details = `Preview imported from ${parsed.hostname}. You can adjust the details before saving.`;
    }
  }

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
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

  @HostListener('window:openFeaturePopup', ['$event'])
  onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type: 'eventEditor' }>;
    if (!popupEvent.detail?.type) {
      return;
    }
    if (popupEvent.detail.type === 'eventEditor') {
      this.openEventEditor(false, 'create');
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  onGlobalEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.stopPropagation();
    if (this.superStackedPopup === 'subEventAssetAssign') {
      this.closeSubEventAssetAssignPopup(false);
      return;
    }
    if (this.superStackedPopup === 'activityInviteFriends') {
      this.closeActivityInviteFriends(false);
      return;
    }
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.closeEventTopicsSelector(true);
      return;
    }
    if (this.eventEditorService.isOpen()) {
      keyboardEvent.preventDefault();
      this.eventEditorService.close();
      return;
    }
    if (this.stackedPopup) {
      this.handleStackedPopupHeaderClose();
      return;
    }
    if (this.activePopup) {
      this.handlePrimaryPopupHeaderClose();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const clickedInlineActionControl = this.didClickSubEventAssetActionControl(event);
    if (
      this.inlineItemActionMenu?.scope === 'subEventAsset'
      && !clickedInlineActionControl
      && Date.now() < this.subEventAssetMenuIgnoreCloseUntilMs
    ) {
      return;
    }
    if (this.inlineItemActionMenu && !clickedInlineActionControl) {
      this.inlineItemActionMenu = null;
      this.subEventMemberRolePickerUserId = null;
      this.subEventAssetMenuIgnoreCloseUntilMs = 0;
    }
    if (this.showActivityInviteSortPicker && !target.closest('.friends-picker-sort') && !target.closest('.popup-view-fab')) {
      this.showActivityInviteSortPicker = false;
    }
  }

  private didClickSubEventAssetActionControl(event: MouseEvent): boolean {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.length > 0) {
      for (const node of path) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (node.classList.contains('item-action-menu') || node.classList.contains('experience-action-menu-trigger')) {
          return true;
        }
      }
      return false;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return false;
    }
    return target.closest('.item-action-menu') !== null || target.closest('.experience-action-menu-trigger') !== null;
  }

  private suppressSelectOverlayBackdropPointerEvents(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const collectBackdrops = (): HTMLElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing'));
    const disablePointerEvents = (backdrops: HTMLElement[]): void => {
      for (const backdrop of backdrops) {
        backdrop.style.pointerEvents = 'none';
      }
    };
    const restorePointerEvents = (backdrops: HTMLElement[]): void => {
      for (const backdrop of backdrops) {
        if (!backdrop.isConnected) {
          continue;
        }
        backdrop.style.removeProperty('pointer-events');
      }
    };

    const nowBackdrops = collectBackdrops();
    if (nowBackdrops.length > 0) {
      disablePointerEvents(nowBackdrops);
      window.setTimeout(() => restorePointerEvents(nowBackdrops), 220);
    }

    window.requestAnimationFrame(() => {
      const frameBackdrops = collectBackdrops();
      if (frameBackdrops.length === 0) {
        return;
      }
      disablePointerEvents(frameBackdrops);
      window.setTimeout(() => restorePointerEvents(frameBackdrops), 220);
    });
  }

  private getInitialUserId(): string {
    const currentSession = this.sessionService.currentSession();
    if (
      currentSession?.kind === 'demo' &&
      this.users.some(user => user.id === currentSession.userId)
    ) {
      return currentSession.userId;
    }
    const stored = localStorage.getItem(App.DEMO_ACTIVE_USER_KEY);
    if (stored && this.users.some(user => user.id === stored)) {
      return stored;
    }
    return this.users[0].id;
  }

  private syncHydratedUserIntoLocalState(user: UserDto): void {
    const localUser = this.users.find(candidate => candidate.id === user.id);
    if (!localUser) {
      return;
    }

    localUser.name = user.name;
    localUser.age = user.age;
    localUser.birthday = user.birthday;
    localUser.city = user.city;
    localUser.height = user.height;
    localUser.physique = user.physique;
    localUser.languages = [...(user.languages ?? [])];
    localUser.horoscope = user.horoscope;
    localUser.initials = user.initials;
    localUser.gender = user.gender;
    localUser.statusText = user.statusText;
    localUser.hostTier = user.hostTier;
    localUser.traitLabel = user.traitLabel;
    localUser.completion = user.completion;
    localUser.headline = user.headline;
    localUser.about = user.about;
    localUser.profileStatus = user.profileStatus;
    localUser.activities = {
      game: user.activities?.game ?? localUser.activities.game,
      chat: user.activities?.chat ?? localUser.activities.chat,
      invitations: user.activities?.invitations ?? localUser.activities.invitations,
      events: user.activities?.events ?? localUser.activities.events,
      hosting: user.activities?.hosting ?? localUser.activities.hosting
    };

    const explicitImages = (user.images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0)
      .slice(0, 8);
    localUser.images = [...explicitImages];
    this.syncProfileBasicsIntoDetailRows(user);
  }

  private syncProfileBasicsIntoDetailRows(user: DemoUser): void {
    const setRowValue = (label: string, value: string): void => {
      const row = this.profileDetailRowByLabel(user.id, label);
      if (!row) {
        return;
      }
      row.value = value;
    };
    const birthdayDate = AppUtils.fromIsoDate(user.birthday);
    setRowValue('Name', user.name);
    setRowValue('City', user.city);
    setRowValue(
      'Birthday',
      birthdayDate
        ? birthdayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    );
    setRowValue('Height', user.height);
    setRowValue('Physique', user.physique);
    setRowValue('Languages', user.languages.join(', '));
    setRowValue('Horoscope', user.horoscope);
    setRowValue('Gender', user.gender === 'woman' ? 'Woman' : 'Man');
  }

  private profileDetailRowByLabel(userId: string, label: string): AppTypes.ProfileDetailFormRow | null {
    const target = AppUtils.normalizeText(label);
    for (const group of this.profileDetailsForUser(userId)) {
      for (const row of group.rows) {
        if (AppUtils.normalizeText(row.label) === target) {
          return row;
        }
      }
    }
    return null;
  }

  private normalizeAssetMediaLinks(): void {
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card => {
      const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title);
      const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
      return {
        ...card,
        imageUrl,
        sourceLink
      };
    });
  }

  private normalizeAssetImageLink(type: AppTypes.AssetType, imageUrl: string | null | undefined, seed: string): string {
    const trimmed = (imageUrl ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return AppDemoGenerators.defaultAssetImage(type, seed || type.toLowerCase());
    }
    return trimmed;
  }

  private normalizeAssetSourceLink(sourceLink: string | null | undefined, fallbackImageUrl: string): string {
    const trimmed = (sourceLink ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return fallbackImageUrl;
    }
    return trimmed;
  }

  private isGoogleMapsLikeLink(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('google.com/maps')
      || normalized.includes('maps.google.')
      || normalized.includes('goo.gl/maps');
  }

  private isLegacyGeneratedAssetImage(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('loremflickr.com/');
  }

  private normalizeAssetRoutes(type: AppTypes.AssetType, routes: string[] | undefined | null, _cityFallback: string): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    this.openExternalUrl(url);
  }

  private openGoogleMapsDirections(stops: string[]): void {
    const normalized = stops.map(stop => stop.trim()).filter(stop => stop.length > 0);
    if (normalized.length === 0) {
      return;
    }
    if (normalized.length === 1) {
      this.openGoogleMapsSearch(normalized[0]);
      return;
    }
    const origin = normalized[0];
    const destination = normalized[normalized.length - 1];
    const waypoints = normalized.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    this.openExternalUrl(url);
  }

  private openExternalUrl(url: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private getChatMembersById(chatId: string): DemoUser[] {
    const chatItem = this.activitiesContext.eventChatSession()?.item?.id === chatId
      ? this.activitiesContext.eventChatSession()?.item ?? null
      : null;
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

  private getActivityMembersByRow(row: AppTypes.ActivityListRow): AppTypes.ActivityMemberEntry[] {
    const rowKey = `${row.type}:${row.id}`;
    const cached = this.activityMembersByRowId[rowKey];
    if (cached) {
      return this.sortActivityMembersByActionTimeAsc([...cached]);
    }
    if (row.id.startsWith('draft-')) {
      const initial: AppTypes.ActivityMemberEntry[] = [];
      this.activityMembersByRowId[rowKey] = [...initial];
      return initial;
    }
    if ((row.type === 'events' || row.type === 'hosting') && this.isUserCreatedEventLikeId(row.id)) {
      const initial: AppTypes.ActivityMemberEntry[] = [];
      this.activityMembersByRowId[rowKey] = [...initial];
      return initial;
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
      const orderedForced = this.sortActivityMembersByActionTimeAsc(forced);
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
    const ordered = this.sortActivityMembersByActionTimeAsc(generated);
    this.activityMembersByRowId[rowKey] = [...ordered];
    return ordered;
  }

  private isUserCreatedEventLikeId(id: string): boolean {
    return this.userCreatedEventIds.has(id) || /^[eh]\d{11,}$/.test(id);
  }

  private normalizeEventTopics(topics: readonly string[]): string[] {
    return Array.from(new Set(topics
      .map(topic => `${topic ?? ''}`.trim().replace(/^#+/, ''))
      .filter(topic => topic.length > 0)
      .slice(0, 5)));
  }

  private syncMirroredEventMembersCache(
    row: AppTypes.ActivityListRow,
    entries: AppTypes.ActivityMemberEntry[]
  ): void {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return;
    }
    const mirrorType = row.type === 'events' ? 'hosting' : 'events';
    this.activityMembersByRowId[`${mirrorType}:${row.id}`] = [...entries];
  }

  private eventEditorMembersRow(): AppTypes.ActivityListRow | null {
    const isModuleEditorOpen = this.eventEditorService.isOpen();
    if (!isModuleEditorOpen) {
      return null;
    }
    const source = this.eventEditorMode === 'create' ? null : this.resolveEventEditorSource();
    const draftId = this.eventEditorDraftMembersId;
    const isDraft = !source && Boolean(draftId);
    if (!source && !isDraft) {
      return null;
    }
    const isHosting = source
      ? (this.eventEditorTarget === 'hosting' || this.isHostingSource(source))
      : this.eventEditorTarget === 'hosting';
    const sourceIsAdmin = source ? (isHosting || ((source as EventMenuItem).isAdmin === true)) : true;
    const canManageMembers = !this.eventEditorReadOnly && sourceIsAdmin;
    const draftSource: EventMenuItem | HostingMenuItem = isHosting
      ? {
        id: draftId ?? 'draft-hosting',
        avatar: this.activeUser.initials,
        title: this.eventForm.title.trim() || 'New Event',
        shortDescription: this.eventForm.description.trim() || 'Draft event',
        timeframe: 'Draft',
        activity: 0
      }
      : {
        id: draftId ?? 'draft-event',
        avatar: this.activeUser.initials,
        title: this.eventForm.title.trim() || 'New Event',
        shortDescription: this.eventForm.description.trim() || 'Draft event',
        timeframe: 'Draft',
        activity: 0,
        isAdmin: true
      };
    const resolvedSource = source ?? draftSource;
    const rowId = source?.id ?? draftSource.id;
    return {
      id: rowId,
      type: isHosting ? 'hosting' : 'events',
      title: resolvedSource.title,
      subtitle: resolvedSource.shortDescription,
      detail: resolvedSource.timeframe,
      dateIso: source ? (this.eventDatesById[source.id] ?? this.defaultEventStartIso()) : this.eventForm.startAt,
      distanceKm: source ? (this.eventDistanceById[source.id] ?? 10) : 0,
      unread: resolvedSource.activity,
      metricScore: resolvedSource.activity,
      isAdmin: canManageMembers,
      source: resolvedSource
    };
  }

  private releaseActiveElementFocus(): void {
    setTimeout(() => {
      const active = globalThis.document?.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }, 0);
  }

  private applySelectedActivityInvitations(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId || this.selectedActivityInviteUserIds.length === 0) {
      this.selectedActivityInviteUserIds = [];
      return;
    }
    const selected = new Set(this.selectedActivityInviteUserIds);
    const isSubEventAssetMembers = this.subEventAssetMembersContext !== null;
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const mainEventAcceptedIds = isSubEventAssetMembers
      ? new Set(
        this.mainEventMembersEntries()
          .filter(member => member.status === 'accepted')
          .map(member => member.userId)
      )
      : new Set<string>();
    const additions = this.activityInviteCandidates
      .filter(candidate => selected.has(candidate.userId))
      .map(candidate => {
        if (!isSubEventAssetMembers) {
          return {
            ...candidate,
            status: 'pending' as const,
            pendingSource: this.selectedActivityMembersRow!.isAdmin ? ('admin' as const) : ('member' as const),
            requestKind: 'invite' as const,
            invitedByActiveUser: true,
            actionAtIso: nowIso
          };
        }
        const requiresEventAdminApproval = !mainEventAcceptedIds.has(candidate.userId);
        return {
          ...candidate,
          status: 'pending' as const,
          pendingSource: requiresEventAdminApproval ? ('admin' as const) : ('member' as const),
          requestKind: requiresEventAdminApproval ? ('invite' as const) : ('join' as const),
          invitedByActiveUser: true,
          statusText: requiresEventAdminApproval
            ? 'Waiting for event admin approval.'
            : 'Waiting for owner approval.',
          actionAtIso: nowIso
        };
      });
    const byUserId = new Set(this.selectedActivityMembers.map(item => item.userId));
    const next = [...this.selectedActivityMembers];
    for (const item of additions) {
      if (!byUserId.has(item.userId)) {
        next.push(item);
        byUserId.add(item.userId);
      }
    }
    const ordered = this.sortActivityMembersByActionTimeAsc(next);
    this.selectedActivityMembers = ordered;
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...ordered];
    if (this.selectedActivityMembersRow) {
      this.syncMirroredEventMembersCache(this.selectedActivityMembersRow, ordered);
    }
    if (isSubEventAssetMembers) {
      for (const invited of additions) {
        if (invited.pendingSource === 'admin') {
          this.ensureMainEventMemberPendingApproval(invited.userId, nowIso);
        }
      }
    }
    this.syncSubEventAssetMembersRequestsFromSelection();
    const subEventContext = this.resolveSubEventMembersContext();
    if (subEventContext && subEventContext.rowKey === this.selectedActivityMembersRowId) {
      this.syncSelectedSubEventMembersCounts(ordered);
    }
    this.emitActivitiesEventSyncForSelectedMembersRow();
    this.selectedActivityInviteUserIds = [];
  }

  private subEventAssetMemberEntries(card: AppTypes.AssetCard): AppTypes.ActivityMemberEntry[] {
    const rowKey = this.selectedActivityMembersRowId ?? `events:subevent-asset-members:${card.id}`;
    const seedBaseDate = new Date('2026-02-24T12:00:00');
    const ownerUserId = this.subEventAssetMembersContext?.ownerUserId ?? null;
    const mainEventAcceptedIds = new Set(
      this.mainEventMembersEntries()
        .filter(member => member.status === 'accepted')
        .map(member => member.userId)
    );
    const entries = card.requests.map(request => {
      const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.users);
      const matchedUser =
        this.users.find(user => user.id === requestUserId)
        ?? this.users.find(user => user.name === request.name && user.initials === request.initials)
        ?? this.users.find(user => user.name === request.name)
        ?? null;
      const userId = matchedUser?.id ?? requestUserId;
      const pendingRequiresMainEventApproval = request.status === 'pending' && !mainEventAcceptedIds.has(userId);
      const pendingSource: AppTypes.ActivityPendingSource = request.status === 'pending'
        ? (pendingRequiresMainEventApproval ? 'admin' : 'member')
        : null;
      const requestKind: AppTypes.ActivityMemberRequestKind = request.status === 'pending'
        ? (pendingRequiresMainEventApproval ? 'invite' : 'join')
        : null;
      const seed = AppDemoGenerators.hashText(`${rowKey}:${card.id}:${request.id}:${userId}`);
      const actionAtIso = AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -((seed % 90) + 1)));
      return {
        id: request.id,
        userId,
        name: request.name,
        initials: request.initials,
        gender: request.gender,
        city: matchedUser?.city ?? card.city,
        statusText: request.note,
        role: ownerUserId && userId === ownerUserId ? ('Manager' as const) : ('Member' as const),
        status: request.status,
        pendingSource,
        requestKind,
        invitedByActiveUser: matchedUser?.id === this.activeUser.id,
        metAtIso: actionAtIso,
        actionAtIso,
        metWhere: card.title,
        relevance: 40 + (seed % 61),
        avatarUrl: matchedUser?.images?.[0] || `https://i.pravatar.cc/1200?img=${(seed % 70) + 1}`
      };
    });
    return this.sortActivityMembersByActionTimeAsc(entries);
  }

  private syncSubEventAssetMembersRequestsFromSelection(): void {
    const context = this.subEventAssetMembersContext;
    if (!context || !this.selectedActivityMembersRowId) {
      return;
    }
    const now = Date.now();
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(card => {
      if (card.id !== context.assetId || card.type !== context.type) {
        return card;
      }
      const existingById = new Map(card.requests.map(request => [request.id, request] as const));
      const existingByUserId = new Map(
        card.requests.map(request => [AppUtils.resolveAssetRequestUserId(request, this.users), request] as const)
      );
      const existingByName = new Map(card.requests.map(request => [request.name.toLowerCase(), request] as const));
      const nextRequests: AppTypes.AssetMemberRequest[] = this.selectedActivityMembers.map((entry, index) => {
        const existing =
          existingById.get(entry.id)
          ?? existingByUserId.get(entry.userId)
          ?? existingByName.get(entry.name.toLowerCase())
          ?? null;
        const fallbackId = `asset-member-${now}-${index}`;
        const requestId = existing?.id ?? (entry.id || fallbackId);
        const note = entry.status !== 'pending'
          ? (existing?.note ?? 'Accepted for this asset.')
          : (entry.pendingSource === 'admin'
            ? 'Waiting for event admin approval.'
            : 'Waiting for owner approval.');
        return {
          id: requestId,
          userId: entry.userId,
          name: entry.name,
          initials: entry.initials,
          gender: entry.gender,
          status: entry.status,
          note
        };
      });
      return {
        ...card,
        requests: nextRequests
      };
    });
    const subEvent = this.resolveSubEventForResourceSync(context.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, context.type);
      return;
    }
    this.refreshEventChatSessionResourceContext(context.subEventId);
  }

  private sortActivityMembersByActionTimeAsc(entries: AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  private createTicketScanPayload(row: AppTypes.ActivityListRow): AppTypes.TicketScanPayload {
    const issuedAtIso = AppUtils.toIsoDateTime(new Date());
    const code = `TKT-${row.id}-${AppDemoGenerators.hashText(`${this.activeUser.id}:${row.id}:${issuedAtIso}`)}`;
    return {
      code,
      holderUserId: this.activeUser.id,
      holderName: this.activeUser.name,
      holderAge: this.activeUser.age,
      holderCity: this.activeUser.city,
      holderRole: row.isAdmin ? 'Admin' : 'Member',
      eventId: row.id,
      eventTitle: row.title,
      eventSubtitle: row.subtitle,
      eventTimeframe: row.detail,
      eventDateLabel: this.activityDateLabel(row),
      issuedAtIso
    };
  }

  private ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    const user = this.ticketPayloadUser(payload);
    if (!user) {
      return '';
    }
    const first = (user.images ?? []).find((image): image is string => typeof image === 'string' && image.trim().length > 0);
    return first ?? this.profilePortraitUrlForUser(user, 0, 'ticket-scan');
  }

  private profilePortraitUrlForUser(user: DemoUser, index: number, context: string): string {
    const genderFolder = user.gender === 'woman' ? 'women' : 'men';
    const seed = AppDemoGenerators.hashText(`portrait:${context}:${user.id}:${index}`);
    return `https://randomuser.me/api/portraits/${genderFolder}/${seed % 100}.jpg`;
  }

  private ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string {
    const user = this.ticketPayloadUser(payload);
    if (user) {
      return user.initials;
    }
    return AppUtils.initialsFromText(payload.holderName);
  }

  private ticketPayloadUser(payload: AppTypes.TicketScanPayload | null): DemoUser | null {
    if (!payload?.holderUserId) {
      return null;
    }
    return this.users.find(user => user.id === payload.holderUserId) ?? null;
  }

  private syncAssetPopupVisibility(): void {
    this.assetPopupService.setBasketVisible(this.superStackedPopup === 'subEventAssetAssign');
  }

}
