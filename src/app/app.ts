import { ChangeDetectorRef, Component, ElementRef, HostListener, Injectable, NgZone, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AlertService } from './shared/alert.service';
import { ActivitiesDbContextService } from './shared/activities-db-context.service';
import { EventEditorService } from './shared/event-editor.service';
import {
  APP_DEMO_DATA,
  DEMO_CHAT_BY_USER,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  DemoUser,
  DEMO_USERS,
  EVENT_EDITOR_SAMPLE,
  PROFILE_DETAILS,
  PROFILE_EXPERIENCE,
  PROFILE_PERSONALITY_TOP3,
  PROFILE_PILLARS,
  PROFILE_PRIORITY_TAGS,
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem,
  RateMenuItem,
  ProfileGroup
} from './shared/demo-data';
import { GDPR_CONTENT } from './shared/gdpr-data';
import { environment } from '../environments/environment';
import { LazyBgImageDirective } from './shared/lazy-bg-image.directive';
import { AppDemoGenerators } from './shared/app-demo-generators';
import { AppUtils } from './shared/app-utils';
import { AppCalendarHelpers } from './shared/app-calendar-helpers';
import { APP_STATIC_DATA } from './shared/app-static-data';
import type * as AppTypes from './shared/app-types';

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
    LazyBgImageDirective
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
  private static readonly FIREBASE_AUTH_PROFILE_KEY = 'firebase-auth-profile';
  private static readonly ENTRY_CONSENT_KEY = 'entry-gdpr-consent';
  private static readonly ENTRY_CONSENT_AUDIT_KEY = 'entry-gdpr-consent-audit';
  private static readonly ENTRY_CONSENT_VERSION = '2026-02-26-v1';
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT = 0;
  private static readonly ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT = 100;

  public readonly alertService = inject(AlertService);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  protected readonly eventEditorService = inject(EventEditorService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected readonly profileTopTraits = PROFILE_PERSONALITY_TOP3;
  protected readonly profilePriorityTags = PROFILE_PRIORITY_TAGS;
  protected readonly profilePillars = PROFILE_PILLARS;
  protected profileDetailsForm: AppTypes.ProfileDetailFormGroup[] = [];
  protected readonly profileExperience = PROFILE_EXPERIENCE;
  protected readonly vibeCategories = APP_STATIC_DATA.vibeCategories;
  protected readonly hostedEventTypes = APP_STATIC_DATA.hostedEventTypes;
  protected readonly vibeIcons: Record<string, string> = APP_STATIC_DATA.vibeIcons;
  protected readonly categoryIcons: Record<string, string> = APP_STATIC_DATA.categoryIcons;
  protected readonly memberTraitIcons: Record<string, string> = APP_STATIC_DATA.memberTraitIcons;
  protected readonly eventEditor = EVENT_EDITOR_SAMPLE;
  protected readonly physiqueOptions = APP_STATIC_DATA.physiqueOptions;
  protected languageSuggestions = [...APP_STATIC_DATA.languageSuggestions];
  protected readonly profileStatusOptions: Array<{ value: AppTypes.ProfileStatus; icon: string }> = APP_STATIC_DATA.profileStatusOptions;
  protected readonly profileDetailValueOptions: Record<string, string[]> = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups: AppTypes.ValuesOptionGroup[] = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups: AppTypes.InterestOptionGroup[] = APP_STATIC_DATA.interestOptionGroups;

  protected showUserMenu = false;
  protected showUserSettingsMenu = false;
  protected readonly gdprContent = GDPR_CONTENT;
  protected readonly authMode: AppTypes.AuthMode = this.resolveAuthMode();
  protected showEntryShell = true;
  protected showEntryConsentPopup = false;
  protected entryConsentViewOnly = false;
  protected showUserSelector = false;
  protected showFirebaseAuthPopup = false;
  protected firebaseAuthIsBusy = false;
  protected firebaseAuthProfile: AppTypes.FirebaseAuthProfile | null = null;
  protected activePopup: AppTypes.PopupType = null;
  protected stackedPopup: AppTypes.PopupType = null;
  protected eventEditorMode: AppTypes.EventEditorMode = 'edit';
  protected eventEditorReadOnly = false;
  protected popupReturnTarget: AppTypes.PopupType = null;
  protected openPrivacyFab: { groupIndex: number; rowIndex: number } | null = null;
  protected openExperiencePrivacyFab: 'workspace' | 'school' | null = null;
  protected privacyFabJustSelectedKey: string | null = null;
  protected readonly detailPrivacyOptions: AppTypes.DetailPrivacy[] = APP_STATIC_DATA.detailPrivacyOptions;
  protected mobileProfileSelectorSheet: AppTypes.MobileProfileSelectorSheet | null = null;
  protected valuesSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected valuesSelectorSelected: string[] = [];
  protected interestSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected interestSelectorSelected: string[] = [];
  protected experienceVisibility: Record<'workspace' | 'school', AppTypes.DetailPrivacy> = {
    workspace: 'Public',
    school: 'Public'
  };
  protected readonly experienceFilterOptions: Array<'All' | 'Workspace' | 'School'> = APP_STATIC_DATA.experienceFilterOptions;
  protected readonly experienceTypeOptions: Array<AppTypes.ExperienceEntry['type']> = APP_STATIC_DATA.experienceTypeOptions;
  protected experienceFilter: 'All' | 'Workspace' | 'School' = 'All';
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected showExperienceForm = false;
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected experienceForm: Omit<AppTypes.ExperienceEntry, 'id'> = {
    type: 'Workspace',
    title: '',
    org: '',
    city: '',
    dateFrom: '',
    dateTo: '',
    description: ''
  };
  protected experienceEntries: AppTypes.ExperienceEntry[] = AppDemoGenerators.buildSampleExperienceEntries();
  protected readonly assetTypeOptions: AppTypes.AssetType[] = APP_STATIC_DATA.assetTypeOptions;
  protected readonly assetFilterOptions: AppTypes.AssetFilterType[] = APP_STATIC_DATA.assetFilterOptions;
  protected assetFilter: AppTypes.AssetFilterType = 'Car';
  protected assetCards: AppTypes.AssetCard[] = AppDemoGenerators.buildSampleAssetCards(this.users);
  protected ticketStickyValue = '';
  protected ticketDateOrder: 'upcoming' | 'past' = 'upcoming';
  protected showTicketOrderPicker = false;
  protected selectedTicketRow: AppTypes.ActivityListRow | null = null;
  protected selectedTicketCodeValue = '';
  protected ticketScannerState: 'idle' | 'reading' | 'success' = 'idle';
  protected ticketScannerResult: AppTypes.TicketScanPayload | null = null;
  protected showAssetForm = false;
  protected showAssetVisibilityPicker = false;
  protected editingAssetId: string | null = null;
  protected selectedAssetCardId: string | null = null;
  protected pendingAssetDeleteCardId: string | null = null;
  protected pendingAssetMemberAction: { cardId: string; memberId: string; action: AppTypes.AssetRequestAction } | null = null;
  protected assetForm: Omit<AppTypes.AssetCard, 'id' | 'requests'> = {
    type: 'Car',
    title: '',
    subtitle: '',
    city: '',
    capacityTotal: 4,
    details: '',
    imageUrl: '',
    sourceLink: '',
    routes: []
  };
  protected assetFormVisibility: AppTypes.EventVisibility = 'Public';
  private readonly assetVisibilityById: Record<string, AppTypes.EventVisibility> = {};
  protected activeUserId = this.getInitialUserId();

  protected activeMenuSection: AppTypes.MenuSection = 'chat';
  protected activitiesPrimaryFilter: AppTypes.ActivitiesPrimaryFilter = 'chats';
  protected activitiesChatContextFilter: AppTypes.ActivitiesChatContextFilter = 'all';
  protected activitiesSecondaryFilter: AppTypes.ActivitiesSecondaryFilter = 'recent';
  protected hostingPublicationFilter: AppTypes.HostingPublicationFilter = 'all';
  protected activitiesRateFilter: AppTypes.RateFilterKey = 'individual-given';
  protected activitiesView: AppTypes.ActivitiesView = 'week';
  protected showActivitiesViewPicker = false;
  protected showActivitiesSecondaryPicker = false;
  protected inlineItemActionMenu: { scope: 'activity' | 'activityMember' | 'asset' | 'explore' | 'subEvent' | 'subEventStage' | 'subEventMember' | 'subEventAsset' | 'chatContext'; id: string; title: string; openUp: boolean } | null = null;
  private subEventAssetMenuIgnoreCloseUntilMs = 0;
  protected showEventExploreOrderPicker = false;
  protected eventExploreOrder: AppTypes.EventExploreOrder = 'upcoming';
  protected eventExploreFilterFriendsOnly = false;
  protected eventExploreFilterHasRooms = false;
  protected eventExploreFilterTopic = '';
  protected activitiesListScrollable = true;
  protected activitiesStickyValue = '';
  protected eventExploreStickyValue = '';
  protected readonly activitiesPageSize = 10;
  protected pendingActivityDeleteRow: AppTypes.ActivityListRow | null = null;
  protected pendingActivityPublishRow: AppTypes.ActivityListRow | null = null;
  protected pendingActivityAction: 'delete' | 'exit' = 'delete';
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
  protected superStackedPopup: 'activityInviteFriends' | 'eventTopicsSelector' | 'eventExploreTopicFilter' | 'impressionsHost' | 'subEventAssetAssign' | null = null;
  private readonly activityMembersByRowId: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  private activityMembersPopupOrigin: 'active-event-editor' | 'stacked-event-editor' | 'event-explore' | 'subevent-asset' | null = null;
  private subEventAssetMembersContext: AppTypes.SubEventAssetMembersContext | null = null;
  protected readonly activityRatingScale = APP_STATIC_DATA.activityRatingScale;
  private readonly weekCalendarStartHour = 0;
  private readonly weekCalendarEndHour = 23;
  private readonly weekCalendarSlotHeightPx = 34;
  protected selectedActivityRateId: string | null = null;
  private lastActivityRateEditorLiftDelta = 0;
  private activityRateEditorOpenScrollTop: number | null = null;
  private activityRateEditorClosing = false;
  private activityRateEditorCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activityRateEditorSlideDurationMs = 180;
  protected activitiesRatesFullscreenMode = false;
  protected activitiesRatesFullscreenCardIndex = 0;
  protected activitiesRatesFullscreenAnimating = false;
  protected activitiesRatesFullscreenLeavingRow: AppTypes.ActivityListRow | null = null;
  protected activitiesRatesPairSplitPercent = App.ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT;
  protected isActivitiesRatesPairSplitDragging = false;
  private activitiesRatesFullscreenAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activitiesRatesFullscreenLeaveTimeoutMs = 440;
  private activitiesRatesFullscreenLoadStateKey = '';
  private activitiesRatesFullscreenLastTriggeredLoadedCount = 0;
  private activitiesRatesPairSplitPointerId: number | null = null;
  private activitiesRatesPairSplitBounds: { left: number; width: number } | null = null;
  private activitiesRatesPairSplitDragStartClientX: number | null = null;
  private activitiesRatesPairSplitDragStartPercent: number | null = null;
  protected isActivityRateBarBlinking = false;
  private activityRateBarBlinkTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly activityRateBlinkUntilByRowId: Record<string, number> = {};
  private readonly activityRateBlinkTimeoutByRowId: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private readonly activityRateDraftById: Record<string, number> = {};
  private readonly activityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private readonly activityRateCardActiveImageIndexById: Record<string, number> = {};
  private readonly activityRateCardImageLoadingById: Record<string, boolean> = {};
  private readonly activityRateCardLoadingTimerById: Record<string, ReturnType<typeof setTimeout>> = {};
  private readonly activityPairRateCardActiveImageIndexByKey: Record<string, number> = {};
  private readonly activityPairRateCardImageLoadingByKey: Record<string, boolean> = {};
  private readonly activityPairRateCardLoadingTimerByKey: Record<string, ReturnType<typeof setTimeout>> = {};
  private readonly generatedRateItemsByUser: Record<string, RateMenuItem[]> = {};
  private lastActivityOpenKey: string | null = null;
  private lastActivityOpenAt = 0;
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
  protected readonly activitiesPrimaryFilters: Array<{ key: AppTypes.ActivitiesPrimaryFilter; label: string; icon: string }> = [...APP_DEMO_DATA.activitiesPrimaryFilters];
  protected readonly activitiesSecondaryFilters: Array<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }> = [...APP_DEMO_DATA.activitiesSecondaryFilters];
  protected readonly activitiesChatContextFilters: Array<{ key: AppTypes.ActivitiesChatContextFilter; label: string; icon: string }> = [...APP_DEMO_DATA.activitiesChatContextFilters];
  protected readonly rateFilters: Array<{ key: AppTypes.RateFilterKey; label: string }> = [...APP_DEMO_DATA.rateFilters];
  protected readonly rateFilterEntries: AppTypes.RateFilterEntry[] = [...APP_DEMO_DATA.rateFilterEntries];
  protected readonly activitiesViewOptions: Array<{ key: AppTypes.ActivitiesView; label: string; icon: string }> = [...APP_DEMO_DATA.activitiesViewOptions];
  protected readonly eventExploreOrderOptions: Array<{ key: AppTypes.EventExploreOrder; label: string; icon: string }> = [...APP_DEMO_DATA.eventExploreOrderOptions];
  protected readonly eventDatesById: Record<string, string> = { ...APP_DEMO_DATA.eventDatesById };
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
  protected readonly activityImageById: Record<string, string> = { ...APP_DEMO_DATA.activityImageById };
  protected readonly activitySourceLinkById: Record<string, string> = { ...APP_DEMO_DATA.activitySourceLinkById };
  protected readonly activityCapacityById: Record<string, string> = { ...APP_DEMO_DATA.activityCapacityById };
  protected readonly invitationItemsByUser: Record<string, InvitationMenuItem[]> = AppUtils.cloneMapItems(DEMO_INVITATIONS_BY_USER);
  protected readonly chatItemsByUser: Record<string, ChatMenuItem[]> = AppUtils.cloneMapItems(DEMO_CHAT_BY_USER);
  protected readonly eventItemsByUser: Record<string, EventMenuItem[]> = AppUtils.cloneMapItems(DEMO_EVENTS_BY_USER);
  protected readonly hostingItemsByUser: Record<string, HostingMenuItem[]> = AppUtils.cloneMapItems(DEMO_HOSTING_BY_USER);
  private readonly acceptedInvitationIdsByUser: Record<string, string[]> = {};

  protected selectedChat: ChatMenuItem | null = null;
  protected selectedChatMembers: DemoUser[] = [];
  protected selectedChatMembersItem: ChatMenuItem | null = null;
  protected readonly chatHistoryPageSize = 10;
  private readonly chatInitialVisiblePageCount = 2;
  protected chatVisibleMessageCount = this.chatHistoryPageSize;
  protected chatInitialLoadPending = false;
  protected chatDraftMessage = '';
  private readonly chatHistoryById: Record<string, AppTypes.ChatPopupMessage[]> = {};
  private chatHistoryLoadingOlder = false;
  private chatHistoryLoadOlderTimer: ReturnType<typeof setTimeout> | null = null;
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
  protected showProfileStatusHeaderPicker = false;
  protected readonly eventVisibilityOptions: AppTypes.EventVisibility[] = APP_STATIC_DATA.eventVisibilityOptions;
  protected readonly eventBlindModeOptions: AppTypes.EventBlindMode[] = APP_STATIC_DATA.eventBlindModeOptions;
  private readonly eventSubEventsById: Record<string, AppTypes.SubEventFormItem[]> = {};
  private readonly eventLocationById: Record<string, string> = {};
  private readonly acceptedOptionalSubEventMembersByKey: Record<string, string[]> = {};
  private readonly acceptedTournamentGroupMembersByKey: Record<string, string[]> = {};
  private readonly userCreatedEventIds = new Set<string>();
  protected eventStartDateValue: Date | null = null;
  protected eventEndDateValue: Date | null = null;
  protected eventStartTimeValue: Date | null = null;
  protected eventEndTimeValue: Date | null = null;
  protected subEventsDisplayMode: AppTypes.SubEventsDisplayMode = 'Casual';
  protected activitiesHeaderProgress = 0;
  protected activitiesHeaderProgressLoading = false;
  protected activitiesHeaderLoadingProgress = 0;
  protected activitiesHeaderLoadingOverdue = false;
  protected eventExploreHeaderProgress = 0;
  protected eventExploreHeaderProgressLoading = false;
  protected eventExploreHeaderLoadingProgress = 0;
  protected eventExploreHeaderLoadingOverdue = false;
  protected chatHeaderProgress = 0;
  protected chatHeaderProgressLoading = false;
  protected chatHeaderLoadingProgress = 0;
  protected chatHeaderLoadingOverdue = false;

  protected imageSlots: Array<string | null> = [];
  protected selectedImageIndex = 0;
  protected pendingSlotUploadIndex: number | null = null;
  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('assetImageInput') private assetImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('activitiesScroll') private activitiesScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('activitiesCalendarScroll') private activitiesCalendarScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('eventExploreScroll') private eventExploreScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('ticketScroll') private ticketScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('ticketScannerVideo') private ticketScannerVideoRef?: ElementRef<HTMLVideoElement>;
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
  private stackedEventEditorOrigin: 'chat' | null = null;

  protected profileForm = {
    fullName: '',
    birthday: null as Date | null,
    city: '',
    heightCm: null as number | null,
    physique: '',
    languages: [] as string[],
    horoscope: '',
    profileStatus: 'public' as AppTypes.ProfileStatus,
    hostTier: '',
    traitLabel: '',
    about: ''
  };
  protected reportUserForm = {
    handle: '',
    reason: 'Harassment',
    details: ''
  };
  protected reportUserSubmitMessage = '';
  protected reportUserSubmitted = false;
  protected readonly reportUserHandleMinLength = 3;
  protected readonly reportUserDetailsMinLength = 12;
  protected feedbackForm = {
    category: 'General',
    subject: '',
    details: ''
  };
  protected feedbackSubmitMessage = '';
  protected feedbackSubmitted = false;
  protected eventFeedbackCards: AppTypes.EventFeedbackCard[] = [];
  protected eventFeedbackIndex = 0;
  protected eventFeedbackListFilter: AppTypes.EventFeedbackListFilter = 'pending';
  protected showEventFeedbackFilterPicker = false;
  protected eventFeedbackListSubmitMessage = '';
  protected eventFeedbackCardMenuEventId: string | null = null;
  protected selectedEventFeedbackEventId: string | null = null;
  protected eventFeedbackSubmittedState = false;
  protected eventFeedbackSubmitMessage = '';
  protected eventFeedbackSlideAnimClass = '';
  protected eventFeedbackNoteForm = {
    eventId: '',
    text: ''
  };
  protected eventFeedbackNoteSubmitted = false;
  protected eventFeedbackNoteSubmitMessage = '';
  private eventFeedbackTouchStartX: number | null = null;
  private eventFeedbackTouchStartY: number | null = null;
  private eventFeedbackSlideAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressUserMenuOutsideCloseUntilMs = 0;
  private readonly submittedEventFeedbackByUser: Record<string, Record<string, true>> = {};
  private readonly submittedEventFeedbackAnswersByUser: Record<string, Record<string, AppTypes.SubmittedEventFeedbackAnswer>> = {};
  private readonly submittedEventFeedbackEventsByUser: Record<string, Record<string, string>> = {};
  private readonly removedEventFeedbackEventsByUser: Record<string, Record<string, true>> = {};
  private readonly organizerEventFeedbackNotesByUser: Record<string, Record<string, string>> = {};
  private readonly eventFeedbackUnlockDelayMs = 2 * 60 * 60 * 1000;
  protected readonly reportUserReasons = APP_STATIC_DATA.reportUserReasons;
  protected readonly feedbackCategories = APP_STATIC_DATA.feedbackCategories;
  protected readonly eventFeedbackEventOverallOptions: AppTypes.EventFeedbackOption[] = APP_STATIC_DATA.eventFeedbackEventOverallOptions;
  protected readonly eventFeedbackHostImproveOptions: AppTypes.EventFeedbackOption[] = APP_STATIC_DATA.eventFeedbackHostImproveOptions;
  protected readonly eventFeedbackAttendeeCollabOptions: AppTypes.EventFeedbackOption[] = APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions;
  protected readonly eventFeedbackAttendeeRejoinOptions: AppTypes.EventFeedbackOption[] = APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions;
  protected readonly eventFeedbackListFilters: Array<{ key: AppTypes.EventFeedbackListFilter; label: string; icon: string }> = APP_STATIC_DATA.eventFeedbackListFilters;
  protected readonly helpCenterSections: AppTypes.HelpCenterSection[] = APP_STATIC_DATA.helpCenterSections;
  protected helpCenterActiveSectionId = this.helpCenterSections[0]?.id ?? 'events';
  protected languageInput = '';
  protected showLanguagePanel = false;
  private readonly profileDetailsFormByUser: Record<string, AppTypes.ProfileDetailFormGroup[]> = {};
  private readonly profileImageSlotsByUser: Record<string, Array<string | null>> = {};
  private readonly languageSheetHeightCssVar = '--mobile-language-sheet-height';
  private activitiesHeaderLoadingCounter = 0;
  private activitiesHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private activitiesHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activitiesHeaderLoadingWindowMs = 3000;
  private readonly activitiesHeaderLoadingTickMs = 16;
  private activitiesHeaderLoadingStartedAtMs = 0;
  private activitiesHeaderFlushScheduled = false;
  private readonly activitiesPaginationLoadDelayMs = 1000;
  private activitiesCalendarBadgesTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesCalendarBadgesLoadingActive = false;
  private activitiesCalendarBadgesLoadingDelayKey = '';
  private readonly activitiesCalendarBadgesReadyDelayKeys = new Set<string>();
  private activitiesCalendarBadgeDelayPageKey = '';
  protected activitiesInitialLoadPending = false;
  private activitiesVisibleCount = this.activitiesPageSize;
  private activitiesPaginationKey = '';
  private activitiesLoadMoreTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesIsPaginating = false;
  private activitiesPaginationAwaitScrollReset = false;
  protected eventExploreInitialLoadPending = false;
  private eventExploreVisibleCount = this.activitiesPageSize;
  private eventExplorePaginationKey = '';
  private eventExploreLoadMoreTimer: ReturnType<typeof setTimeout> | null = null;
  private eventExploreIsPaginating = false;
  private eventExplorePaginationAwaitScrollReset = false;
  private eventExploreHeaderLoadingCounter = 0;
  private eventExploreHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private eventExploreHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private eventExploreHeaderLoadingStartedAtMs = 0;
  private chatHeaderLoadingCounter = 0;
  private chatHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private chatHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private chatHeaderLoadingStartedAtMs = 0;
  private chatInitialLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketScannerTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketScannerMediaStream: MediaStream | null = null;
  private ticketScannerDetectionFrame: number | null = null;
  private ticketScannerDetectBusy = false;
  private ticketListScrollable = true;

  constructor(
    private readonly router: Router
  ) {
    this.normalizeAssetMediaLinks();
    this.initializeProfileImageSlots();
    this.ensurePaginationTestEvents(30);
    this.initializeEventEditorContextData();
    this.initializeProfileDetailForms();
    this.syncProfileFormFromActiveUser();
    this.initializeEntryFlow();
    this.router.navigate(['/game']);

    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request) {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
      if (request.type === 'chatResource') {
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
      if (request.type === 'eventExplore') {
        this.openEventExplore(false, request.stacked ?? false);
        return;
      }
      if (request.type === 'eventEditorCreate') {
        this.openEventEditor(true, 'create', undefined, false, null, request.target);
        return;
      }
      if (request.type === 'eventEditor') {
        this.openEventEditorFromActivitiesRequest(request.row, request.readOnly);
        return;
      }
      if (request.type === 'members') {
        this.openActivityMembers(request.row);
      }
    });
    
    // Listen for events from EventEditorPopupComponent
    if (typeof window !== 'undefined') {
      window.addEventListener('app:openMembers', (event) => {
        this.syncModuleEventEditorDraftFromEvent(event);
        this.openEventEditorMembers();
      });
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

  protected get activeUser() {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected get userBadgeCount(): number {
    return (
      this.gameBadge +
      this.chatBadge +
      this.invitationsBadge +
      this.eventsBadge +
      this.hostingBadge +
      this.assetCarsBadge +
      this.assetAccommodationBadge +
      this.assetSuppliesBadge
    );
  }

  protected get gameBadge(): number {
    return this.activeUser.activities.game;
  }

  protected get chatBadge(): number {
    return AppDemoGenerators.resolveSectionBadge(
      this.chatItems.map(item => item.unread),
      this.chatItems.length
    );
  }

  protected get invitationsBadge(): number {
    return AppDemoGenerators.resolveSectionBadge(
      this.invitationItems.map(item => item.unread),
      this.invitationItems.length
    );
  }

  protected get eventsBadge(): number {
    return AppDemoGenerators.resolveSectionBadge(
      this.eventItems.map(item => item.activity),
      this.eventItems.length
    );
  }

  protected get hostingBadge(): number {
    const adminEvents = this.eventItems.filter(item => item.isAdmin);
    return AppDemoGenerators.resolveSectionBadge(
      adminEvents.map(item => item.activity),
      adminEvents.length
    );
  }

  protected get assetCarsBadge(): number {
    return this.assetCards
      .filter(card => card.type === 'Car')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get assetAccommodationBadge(): number {
    return this.assetCards
      .filter(card => card.type === 'Accommodation')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get assetSuppliesBadge(): number {
    return this.assetCards
      .filter(card => card.type === 'Supplies')
      .reduce((sum, card) => sum + this.assetPendingCount(card), 0);
  }

  protected get chatItems(): ChatMenuItem[] {
    return this.chatItemsByUser[this.activeUser.id] ?? this.chatItemsByUser['u1'] ?? [];
  }

  protected get invitationItems(): InvitationMenuItem[] {
    return this.invitationItemsByUser[this.activeUser.id] ?? this.invitationItemsByUser['u1'] ?? [];
  }

  protected get eventItems(): EventMenuItem[] {
    return this.eventItemsByUser[this.activeUser.id] ?? this.eventItemsByUser['u1'] ?? [];
  }

  protected get hostingItems(): HostingMenuItem[] {
    return this.hostingItemsByUser[this.activeUser.id] ?? this.hostingItemsByUser['u1'] ?? [];
  }

  protected get rateItems(): RateMenuItem[] {
    return this.generatedRateItemsForUser(this.activeUser.id);
  }

  protected onUserSelect(): void {
    this.showUserMenu = !this.showUserMenu;
    if (!this.showUserMenu) {
      this.showUserSettingsMenu = false;
    }
  }

  protected closeUserMenu(): void {
    this.showUserMenu = false;
    this.showUserSettingsMenu = false;
    this.suppressUserMenuOutsideCloseUntilMs = 0;
  }

  protected toggleUserSettingsMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showUserSettingsMenu = !this.showUserSettingsMenu;
  }

  protected closeUserSettingsMenu(): void {
    this.showUserSettingsMenu = false;
  }

  protected onUserSettingsAction(action: 'help' | 'send-feedback' | 'gdpr' | 'delete-account' | 'logout', event?: Event): void {
    event?.stopPropagation();
    switch (action) {
      case 'help':
        this.closeUserSettingsMenu();
        this.openHelpPopup();
        return;
      case 'send-feedback':
        this.closeUserSettingsMenu();
        this.openSendFeedbackPopup();
        return;
      case 'gdpr':
        this.closeUserSettingsMenu();
        this.openGdprPopup();
        return;
      case 'delete-account':
        this.closeUserSettingsMenu();
        this.openDeleteAccountConfirm();
        return;
      case 'logout':
        this.closeUserSettingsMenu();
        this.openLogoutConfirm();
        return;
      default:
        return;
    }
  }

  protected openGdprPopup(): void {
    this.activePopup = 'gdpr';
  }

  protected openHelpPopup(): void {
    this.helpCenterActiveSectionId = this.helpCenterSections[0]?.id ?? this.helpCenterActiveSectionId;
    this.activePopup = 'helpCenter';
  }

  protected selectHelpCenterSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.helpCenterActiveSectionId = sectionId;
  }

  protected get activeHelpCenterSection(): AppTypes.HelpCenterSection | null {
    return this.helpCenterSections.find(section => section.id === this.helpCenterActiveSectionId) ?? this.helpCenterSections[0] ?? null;
  }

  protected get eventFeedbackPendingCount(): number {
    return this.eventFeedbackPendingItems.length;
  }

  protected get eventFeedbackFeedbackedCount(): number {
    return this.eventFeedbackFeedbackedItems.length;
  }

  protected get eventFeedbackRemovedCount(): number {
    return this.eventFeedbackRemovedItems.length;
  }

  protected get eventFeedbackFilterLabel(): string {
    return this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter)?.label ?? 'Pending';
  }

  protected eventFeedbackFilterIcon(): string {
    return this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter)?.icon ?? 'schedule';
  }

  protected eventFeedbackFilterCount(filter: AppTypes.EventFeedbackListFilter): number {
    switch (filter) {
      case 'feedbacked':
        return this.eventFeedbackFeedbackedCount;
      case 'removed':
        return this.eventFeedbackRemovedCount;
      case 'pending':
      default:
        return this.eventFeedbackPendingCount;
    }
  }

  protected eventFeedbackFilterOptionClass(filter: AppTypes.EventFeedbackListFilter): string {
    switch (filter) {
      case 'feedbacked':
        return 'event-feedback-filter-option-feedbacked';
      case 'removed':
        return 'event-feedback-filter-option-removed';
      case 'pending':
      default:
        return 'event-feedback-filter-option-pending';
    }
  }

  protected eventFeedbackFilterBadgeClass(filter: AppTypes.EventFeedbackListFilter): string {
    switch (filter) {
      case 'feedbacked':
        return 'event-feedback-filter-badge-feedbacked';
      case 'removed':
        return 'event-feedback-filter-badge-removed';
      case 'pending':
      default:
        return 'event-feedback-filter-badge-pending';
    }
  }

  protected get eventFeedbackVisibleItems(): AppTypes.EventFeedbackEventCard[] {
    switch (this.eventFeedbackListFilter) {
      case 'feedbacked':
        return this.eventFeedbackFeedbackedItems;
      case 'removed':
        return this.eventFeedbackRemovedItems;
      case 'pending':
      default:
        return this.eventFeedbackPendingItems;
    }
  }

  protected get hasEventFeedbackCards(): boolean {
    return this.eventFeedbackCards.length > 0;
  }

  protected get activeEventFeedbackCard(): AppTypes.EventFeedbackCard | null {
    return this.eventFeedbackCards[this.eventFeedbackIndex] ?? null;
  }

  protected get eventFeedbackDotIndices(): number[] {
    return this.eventFeedbackCards.map((_, index) => index);
  }

  protected get eventFeedbackOnLastSlide(): boolean {
    return this.hasEventFeedbackCards && this.eventFeedbackIndex >= this.eventFeedbackCards.length - 1;
  }

  protected get eventFeedbackSlideCounterLabel(): string {
    if (!this.hasEventFeedbackCards) {
      return '0 / 0';
    }
    return `${this.eventFeedbackIndex + 1} / ${this.eventFeedbackCards.length}`;
  }

  protected openEventFeedbackPopup(event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackListFilter = 'pending';
    this.showEventFeedbackFilterPicker = false;
    this.eventFeedbackListSubmitMessage = '';
    this.eventFeedbackCardMenuEventId = null;
    this.selectedEventFeedbackEventId = null;
    this.eventFeedbackCards = [];
    this.eventFeedbackIndex = 0;
    this.eventFeedbackSubmittedState = false;
    this.eventFeedbackSubmitMessage = '';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass = '';
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    this.activePopup = 'eventFeedback';
  }

  protected openReportUserFromFeedback(event?: Event): void {
    event?.stopPropagation();
    this.openReportUserPopup();
  }

  protected toggleEventFeedbackFilterPicker(event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker = !this.showEventFeedbackFilterPicker;
  }

  protected selectEventFeedbackListFilter(filter: AppTypes.EventFeedbackListFilter, event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackListFilter = filter;
    this.showEventFeedbackFilterPicker = false;
    this.eventFeedbackCardMenuEventId = null;
  }

  protected closeEventFeedbackFilterPicker(event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker = false;
  }

  protected trackByEventFeedbackItem(index: number, item: AppTypes.EventFeedbackEventCard): string {
    return item.eventId;
  }

  protected isEventFeedbackCardMenuOpen(item: AppTypes.EventFeedbackEventCard): boolean {
    return this.eventFeedbackCardMenuEventId === item.eventId;
  }

  protected toggleEventFeedbackCardMenu(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker = false;
    this.eventFeedbackCardMenuEventId = this.eventFeedbackCardMenuEventId === item.eventId ? null : item.eventId;
  }

  protected closeEventFeedbackCardMenu(event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackCardMenuEventId = null;
  }

  protected isEventFeedbackStartAvailable(item: AppTypes.EventFeedbackEventCard): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  protected eventFeedbackItemStatusLine(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  protected eventFeedbackCurrentEventTitle(): string {
    return this.eventTitleById(this.selectedEventFeedbackEventId ?? this.eventFeedbackNoteForm.eventId);
  }

  protected hasEventFeedbackOrganizerNote(eventId: string): boolean {
    return Boolean(this.organizerEventFeedbackNotesByUser[this.activeUser.id]?.[eventId]?.trim());
  }

  protected startEventFeedback(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.closeEventFeedbackCardMenu();
    this.showEventFeedbackFilterPicker = false;
    this.restoreEventFeedbackEvent(item.eventId);
    this.selectedEventFeedbackEventId = item.eventId;
    this.eventFeedbackCards = this.pendingEventFeedbackCardsForEvent(item.eventId).map(card => ({ ...card }));
    this.eventFeedbackIndex = 0;
    this.eventFeedbackSubmittedState = false;
    this.eventFeedbackSubmitMessage = '';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass = '';
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    if (this.eventFeedbackCards.length === 0) {
      this.eventFeedbackListSubmitMessage = `${item.title} is already in Feedbacked.`;
      this.eventFeedbackListFilter = 'feedbacked';
      return;
    }
    this.stackedPopup = 'eventFeedback';
  }

  protected removeEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.markEventFeedbackEventRemoved(item.eventId);
    this.closeEventFeedbackCardMenu();
    this.eventFeedbackListSubmitMessage = `${item.title} moved to Removed without feedback.`;
    this.eventFeedbackListFilter = 'removed';
  }

  protected restoreRemovedEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.restoreEventFeedbackEvent(item.eventId);
    this.closeEventFeedbackCardMenu();
    this.eventFeedbackListSubmitMessage = `${item.title} moved back to Pending.`;
    this.eventFeedbackListFilter = 'pending';
  }

  protected openEventFeedbackNotePopup(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.closeEventFeedbackCardMenu();
    this.showEventFeedbackFilterPicker = false;
    this.selectedEventFeedbackEventId = item.eventId;
    this.eventFeedbackNoteForm = {
      eventId: item.eventId,
      text: this.organizerEventFeedbackNotesByUser[this.activeUser.id]?.[item.eventId] ?? ''
    };
    this.eventFeedbackNoteSubmitted = false;
    this.eventFeedbackNoteSubmitMessage = '';
    this.stackedPopup = 'eventFeedbackNote';
  }

  protected canSubmitEventFeedbackNote(): boolean {
    return this.eventFeedbackNoteForm.text.trim().length >= 8;
  }

  protected submitEventFeedbackNote(): void {
    if (!this.canSubmitEventFeedbackNote()) {
      return;
    }
    const eventId = this.eventFeedbackNoteForm.eventId;
    const nextByUser = { ...(this.organizerEventFeedbackNotesByUser[this.activeUser.id] ?? {}) };
    nextByUser[eventId] = this.eventFeedbackNoteForm.text.trim();
    this.organizerEventFeedbackNotesByUser[this.activeUser.id] = nextByUser;
    this.eventFeedbackNoteSubmitted = true;
    this.eventFeedbackNoteSubmitMessage = `Organizer feedback saved for ${this.eventTitleById(eventId)}.`;
    this.eventFeedbackListSubmitMessage = this.eventFeedbackNoteSubmitMessage;
  }

  protected selectEventFeedbackSlide(index: number, event?: Event): void {
    event?.stopPropagation();
    if (index < 0 || index >= this.eventFeedbackCards.length) {
      return;
    }
    if (index === this.eventFeedbackIndex) {
      return;
    }
    const direction = index > this.eventFeedbackIndex ? 'next' : 'prev';
    this.eventFeedbackIndex = index;
    this.playEventFeedbackSlideAnimation(direction);
  }

  protected previousEventFeedbackSlide(event?: Event): void {
    event?.stopPropagation();
    if (!this.hasEventFeedbackCards || this.eventFeedbackIndex <= 0) {
      return;
    }
    this.eventFeedbackIndex -= 1;
    this.playEventFeedbackSlideAnimation('prev');
  }

  protected nextEventFeedbackSlide(event?: Event): void {
    event?.stopPropagation();
    if (!this.hasEventFeedbackCards || this.eventFeedbackIndex >= this.eventFeedbackCards.length - 1) {
      return;
    }
    this.eventFeedbackIndex += 1;
    this.playEventFeedbackSlideAnimation('next');
  }

  protected selectEventFeedbackPrimary(optionValue: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.activeEventFeedbackCard;
    if (!card || !card.primaryOptions.some(option => option.value === optionValue)) {
      return;
    }
    card.answerPrimary = optionValue;
  }

  protected selectEventFeedbackSecondary(optionValue: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.activeEventFeedbackCard;
    if (!card || !card.secondaryOptions.some(option => option.value === optionValue)) {
      return;
    }
    card.answerSecondary = optionValue;
  }

  protected isEventFeedbackPrimarySelected(optionValue: string): boolean {
    return this.activeEventFeedbackCard?.answerPrimary === optionValue;
  }

  protected isEventFeedbackSecondarySelected(optionValue: string): boolean {
    return this.activeEventFeedbackCard?.answerSecondary === optionValue;
  }

  protected eventFeedbackOptionToneClass(card: AppTypes.EventFeedbackCard, option: AppTypes.EventFeedbackOption): string {
    const section = option.impressionTag
      ? this.feedbackSectionFromTag(card.kind, option.impressionTag)
      : 'vibe';
    return `event-feedback-option-tone-${section}`;
  }

  protected activeEventFeedbackImpactSummary(): string {
    const card = this.activeEventFeedbackCard;
    if (!card) {
      return '';
    }
    const tags = this.selectedImpressionTagsForCard(card);
    return tags.join(' + ');
  }

  protected onEventFeedbackTouchStart(event: TouchEvent): void {
    if (!this.hasEventFeedbackCards) {
      return;
    }
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    this.eventFeedbackTouchStartX = touch.clientX;
    this.eventFeedbackTouchStartY = touch.clientY;
  }

  protected onEventFeedbackTouchEnd(event: TouchEvent): void {
    if (!this.hasEventFeedbackCards || this.eventFeedbackTouchStartX === null || this.eventFeedbackTouchStartY === null) {
      this.eventFeedbackTouchStartX = null;
      this.eventFeedbackTouchStartY = null;
      return;
    }
    const touch = event.changedTouches?.[0];
    if (!touch) {
      this.eventFeedbackTouchStartX = null;
      this.eventFeedbackTouchStartY = null;
      return;
    }
    const deltaX = touch.clientX - this.eventFeedbackTouchStartX;
    const deltaY = touch.clientY - this.eventFeedbackTouchStartY;
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) {
      return;
    }
    if (deltaX < 0) {
      this.nextEventFeedbackSlide();
      return;
    }
    this.previousEventFeedbackSlide();
  }

  protected canSubmitActiveEventFeedback(): boolean {
    const card = this.activeEventFeedbackCard;
    if (!card) {
      return false;
    }
    return !this.isSelfAttendeeFeedbackCard(card);
  }

  protected submitActiveEventFeedback(): void {
    if (this.eventFeedbackSubmittedState) {
      return;
    }
    const card = this.activeEventFeedbackCard;
    if (!card || this.isSelfAttendeeFeedbackCard(card)) {
      return;
    }
    this.eventFeedbackSubmittedState = true;
    const eventId = card.eventId;
    const eventTitle = this.eventTitleById(eventId);
    const cardsToSubmit = [...this.eventFeedbackCards];
    for (const feedbackCard of cardsToSubmit) {
      const impressionSummary = this.selectedImpressionTagsForCard(feedbackCard);
      this.markEventFeedbackSubmitted(feedbackCard.id);
      this.recordSubmittedEventFeedbackAnswer(feedbackCard, impressionSummary);
    }
    this.markEventFeedbackEventSubmitted(eventId);
    this.restoreEventFeedbackEvent(eventId);
    this.eventFeedbackCards = [];
    this.eventFeedbackIndex = 0;
    this.eventFeedbackSubmitMessage = `Feedback submitted successfully for ${eventTitle}.`;
    this.eventFeedbackListSubmitMessage = `${eventTitle} moved to Feedbacked.`;
    this.eventFeedbackListFilter = 'feedbacked';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass = '';
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
  }

  private playEventFeedbackSlideAnimation(direction: 'next' | 'prev'): void {
    const nextClass = direction === 'next'
      ? 'event-feedback-slide-enter-next'
      : 'event-feedback-slide-enter-prev';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass = '';
    this.cdr.detectChanges();
    this.eventFeedbackSlideAnimClass = nextClass;
    this.eventFeedbackSlideAnimationTimer = setTimeout(() => {
      this.eventFeedbackSlideAnimClass = '';
      this.eventFeedbackSlideAnimationTimer = null;
    }, 260);
  }

  private get pendingEventFeedbackCards(): AppTypes.EventFeedbackCard[] {
    return this.buildEventFeedbackCards().filter(card => !this.isSelfAttendeeFeedbackCard(card) && !this.isEventFeedbackSubmitted(card.id));
  }

  private pendingEventFeedbackCardsForEvent(eventId: string): AppTypes.EventFeedbackCard[] {
    return this.buildEventFeedbackCards().filter(card =>
      card.eventId === eventId &&
      !this.isSelfAttendeeFeedbackCard(card) &&
      !this.isEventFeedbackSubmitted(card.id)
    );
  }

  private get eventFeedbackAllItems(): AppTypes.EventFeedbackEventCard[] {
    const countsByEvent = new Map<string, { pending: number; total: number }>();
    for (const card of this.buildEventFeedbackCards()) {
      if (this.isSelfAttendeeFeedbackCard(card)) {
        continue;
      }
      const current = countsByEvent.get(card.eventId) ?? { pending: 0, total: 0 };
      current.total += 1;
      if (!this.isEventFeedbackSubmitted(card.id)) {
        current.pending += 1;
      }
      countsByEvent.set(card.eventId, current);
    }

    const items: AppTypes.EventFeedbackEventCard[] = [];
    const nowMs = Date.now();
    for (const item of this.eventItems) {
      if (item.isAdmin) {
        continue;
      }
      const startMs = this.eventStartAtMs(item.id);
      if (startMs === null || nowMs < startMs + this.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const counts = countsByEvent.get(item.id);
      if (!counts || counts.total === 0) {
        continue;
      }
      const isRemoved = this.isEventFeedbackEventRemoved(item.id);
      const feedbackedAtMs = this.eventFeedbackEventSubmittedAtMs(item.id);
      items.push({
        eventId: item.id,
        title: item.title,
        subtitle: item.shortDescription,
        timeframe: item.timeframe,
        imageUrl: this.activityImageById[item.id] ?? `https://picsum.photos/seed/event-feedback-${item.id}/1200/700`,
        startAtMs: startMs,
        pendingCards: counts.pending,
        totalCards: counts.total,
        isRemoved,
        isFeedbacked: !isRemoved && counts.pending === 0,
        feedbackedAtMs
      });
    }
    return items;
  }

  private get eventFeedbackPendingItems(): AppTypes.EventFeedbackEventCard[] {
    return this.eventFeedbackAllItems
      .filter(item => !item.isRemoved && item.pendingCards > 0)
      .sort((a, b) => a.startAtMs - b.startAtMs);
  }

  private get eventFeedbackFeedbackedItems(): AppTypes.EventFeedbackEventCard[] {
    return this.eventFeedbackAllItems
      .filter(item => item.isFeedbacked)
      .sort((a, b) => {
        const first = a.feedbackedAtMs ?? a.startAtMs;
        const second = b.feedbackedAtMs ?? b.startAtMs;
        return second - first;
      });
  }

  private get eventFeedbackRemovedItems(): AppTypes.EventFeedbackEventCard[] {
    return this.eventFeedbackAllItems
      .filter(item => item.isRemoved)
      .sort((a, b) => b.startAtMs - a.startAtMs);
  }

  private isEventFeedbackSubmitted(cardId: string): boolean {
    return Boolean(this.submittedEventFeedbackByUser[this.activeUser.id]?.[cardId]);
  }

  private markEventFeedbackSubmitted(cardId: string): void {
    const current = { ...(this.submittedEventFeedbackByUser[this.activeUser.id] ?? {}) };
    current[cardId] = true;
    this.submittedEventFeedbackByUser[this.activeUser.id] = current;
  }

  private markEventFeedbackEventSubmitted(eventId: string): void {
    const current = { ...(this.submittedEventFeedbackEventsByUser[this.activeUser.id] ?? {}) };
    current[eventId] = new Date().toISOString();
    this.submittedEventFeedbackEventsByUser[this.activeUser.id] = current;
  }

  private eventFeedbackEventSubmittedAtMs(eventId: string): number | null {
    const iso = this.submittedEventFeedbackEventsByUser[this.activeUser.id]?.[eventId];
    if (!iso) {
      return null;
    }
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private isEventFeedbackEventRemoved(eventId: string): boolean {
    return Boolean(this.removedEventFeedbackEventsByUser[this.activeUser.id]?.[eventId]);
  }

  private markEventFeedbackEventRemoved(eventId: string): void {
    const current = { ...(this.removedEventFeedbackEventsByUser[this.activeUser.id] ?? {}) };
    current[eventId] = true;
    this.removedEventFeedbackEventsByUser[this.activeUser.id] = current;
  }

  private restoreEventFeedbackEvent(eventId: string): void {
    const current = { ...(this.removedEventFeedbackEventsByUser[this.activeUser.id] ?? {}) };
    delete current[eventId];
    this.removedEventFeedbackEventsByUser[this.activeUser.id] = current;
  }

  private selectedImpressionTagsForCard(card: AppTypes.EventFeedbackCard): string[] {
    const tags = new Set<string>();
    const primary = card.primaryOptions.find(option => option.value === card.answerPrimary)?.impressionTag;
    const secondary = card.secondaryOptions.find(option => option.value === card.answerSecondary)?.impressionTag;
    if (primary) {
      tags.add(primary);
    }
    if (secondary) {
      tags.add(secondary);
    }
    return [...tags];
  }

  private buildEventFeedbackCards(): AppTypes.EventFeedbackCard[] {
    return AppDemoGenerators.buildEventFeedbackCards({
      eventItems: this.eventItems,
      users: this.users,
      activeUser: this.activeUser,
      eventDatesById: this.eventDatesById,
      activityImageById: this.activityImageById,
      eventFeedbackUnlockDelayMs: this.eventFeedbackUnlockDelayMs,
      eventOverallOptions: this.eventFeedbackEventOverallOptions,
      hostImproveOptions: this.eventFeedbackHostImproveOptions,
      attendeeCollabOptions: this.eventFeedbackAttendeeCollabOptions,
      attendeeRejoinOptions: this.eventFeedbackAttendeeRejoinOptions
    });
  }

  private recordSubmittedEventFeedbackAnswer(card: AppTypes.EventFeedbackCard, tags: string[]): void {
    const byUser = { ...(this.submittedEventFeedbackAnswersByUser[this.activeUser.id] ?? {}) };
    byUser[card.id] = {
      cardId: card.id,
      eventId: card.eventId,
      kind: card.kind,
      targetUserId: card.targetUserId ?? null,
      targetRole: card.targetRole ?? 'Member',
      primaryValue: card.answerPrimary,
      secondaryValue: card.answerSecondary,
      tags: [...tags],
      submittedAtIso: AppUtils.toIsoDateTime(new Date())
    };
    this.submittedEventFeedbackAnswersByUser[this.activeUser.id] = byUser;
  }

  private isSelfAttendeeFeedbackCard(card: AppTypes.EventFeedbackCard): boolean {
    return card.kind === 'attendee' && card.attendeeUserId === this.activeUser.id;
  }

  private eventStartAtMs(eventId: string): number | null {
    const iso = this.eventDatesById[eventId];
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private eventTitleById(eventId: string): string {
    return this.eventItems.find(item => item.id === eventId)?.title ?? 'this event';
  }

  protected openReportUserPopup(): void {
    this.reportUserForm = {
      handle: '',
      reason: this.reportUserReasons[0] ?? 'Harassment',
      details: ''
    };
    this.reportUserSubmitMessage = '';
    this.reportUserSubmitted = false;
    this.activePopup = 'reportUser';
  }

  protected openSendFeedbackPopup(): void {
    this.feedbackForm = {
      category: this.feedbackCategories[0] ?? 'General',
      subject: '',
      details: ''
    };
    this.feedbackSubmitMessage = '';
    this.feedbackSubmitted = false;
    this.activePopup = 'sendFeedback';
  }

  protected get reportUserHandleLength(): number {
    return this.reportUserForm.handle.trim().length;
  }

  protected get reportUserDetailsLength(): number {
    return this.reportUserForm.details.trim().length;
  }

  protected get reportUserHandleValid(): boolean {
    return this.reportUserHandleLength >= this.reportUserHandleMinLength;
  }

  protected get reportUserDetailsValid(): boolean {
    return this.reportUserDetailsLength >= this.reportUserDetailsMinLength;
  }

  protected canSubmitReportUser(): boolean {
    return this.reportUserHandleValid && this.reportUserDetailsValid;
  }

  protected submitReportUser(): void {
    const target = this.reportUserForm.handle.trim();
    if (!this.canSubmitReportUser()) {
      return;
    }
    this.reportUserSubmitMessage = `Report submitted successfully for ${target}. Our moderation team will review it.`;
    this.reportUserSubmitted = true;
  }

  protected submitFeedback(): void {
    const subject = this.feedbackForm.subject.trim();
    const details = this.feedbackForm.details.trim();
    if (!subject || details.length < 8) {
      return;
    }
    this.feedbackSubmitMessage = `Feedback sent successfully in "${this.feedbackForm.category}". Thank you for helping improve MyScoutee.`;
    this.feedbackSubmitted = true;
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

  protected openRatesShortcut(): void {
    this.openActivitiesPopup('rates', false);
  }

  @HostListener('window:myscoutee-open-rates')
  protected onGameHistoryOpenRates(): void {
    this.openRatesShortcut();
  }

  protected openChatShortcut(): void {
    this.openActivitiesPopup('chats', false);
  }

  protected openInvitationShortcut(): void {
    this.openActivitiesPopup('invitations', false);
  }

  protected openEventShortcut(): void {
    this.openActivitiesPopup('events', false);
  }

  protected openHostingShortcut(): void {
    this.openActivitiesPopup('hosting', false);
  }

  protected openActivitiesPopup(primaryFilter: AppTypes.ActivitiesPrimaryFilter, closeMenu = true): void {
    if (this.activePopup || this.stackedPopup || this.superStackedPopup) {
      this.closePopup();
    }
    this.activitiesContext.openActivities(primaryFilter);
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openAssetCarPopup(): void {
    this.assetFilter = 'Car';
    this.closeAssetForm();
    this.activePopup = 'assetsCar';
  }

  protected openAssetAccommodationPopup(): void {
    this.assetFilter = 'Accommodation';
    this.closeAssetForm();
    this.activePopup = 'assetsAccommodation';
  }

  protected openAssetSuppliesPopup(): void {
    this.assetFilter = 'Supplies';
    this.closeAssetForm();
    this.activePopup = 'assetsSupplies';
  }

  protected openAssetTicketsPopup(): void {
    this.assetFilter = 'Ticket';
    this.closeAssetForm();
    this.seedTicketStickyHeader();
    this.activePopup = 'assetsTickets';
    this.showTicketOrderPicker = false;
    this.selectedTicketRow = null;
    this.selectedTicketCodeValue = '';
    this.ticketScannerState = 'idle';
    this.ticketScannerResult = null;
    this.cancelTicketScannerTimer();
    setTimeout(() => this.syncTicketScrollOnOpen(), 0);
  }

  protected openChatItem(item: ChatMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'chat';
    this.selectedChat = item;
    this.ensureSelectedChatHistory();
    this.chatVisibleMessageCount = this.initialChatVisibleMessageCount(this.selectedChatHistory.length);
    this.chatDraftMessage = '';
    this.chatHistoryLoadingOlder = false;
    this.showActivitiesViewPicker = false;
    if (stacked || this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'chat';
      this.startChatInitialLoad();
      return;
    }
    this.stackedPopup = null;
    this.activePopup = 'chat';
    this.startChatInitialLoad();
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openChatMembers(item: ChatMenuItem, event?: Event, stacked = false): void {
    event?.stopPropagation();
    this.selectedChatMembersItem = item;
    this.selectedChatMembers = this.getChatMembersById(item.id);
    if (stacked || this.activePopup === 'chat' || this.stackedPopup !== null) {
      this.stackedPopup = 'chatMembers';
      return;
    }
    this.activePopup = 'chatMembers';
    this.closeUserMenu();
  }

  protected openInvitationItem(item: InvitationMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'invitations';
    this.selectedInvitation = item;
    this.showActivitiesViewPicker = false;
    const related = this.resolveRelatedEventFromInvitation(item);
    const source = related ?? this.buildInvitationPreviewEventSource(item);
    this.openEventEditor(stacked, 'edit', source, true, item.id);
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openEventItem(item: EventMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'events';
    this.selectedEvent = item;
    this.showActivitiesViewPicker = false;
    if (stacked || this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'menuEvent';
      return;
    }
    this.activePopup = 'menuEvent';
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openHostingItem(item: HostingMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'hosting';
    this.selectedHostingEvent = item;
    this.showActivitiesViewPicker = false;
    if (stacked || this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'hostingEvent';
      return;
    }
    this.activePopup = 'hostingEvent';
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openEventExplore(closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'events';
    this.showEventExploreOrderPicker = false;
    this.eventExploreStickyValue = '';
    this.eventExploreHeaderProgress = 0;
    if (stacked || this.stackedPopup !== null || this.activePopup === 'activities') {
      this.stackedPopup = 'eventExplore';
      this.resetEventExploreScroll();
      return;
    }
    this.activePopup = 'eventExplore';
    this.resetEventExploreScroll();
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
    this.showProfileStatusHeaderPicker = false;
    this.prepareEventEditorForm(mode, source, targetOverride);
    const previousStackedPopup = this.stackedPopup;
    this.stackedEventEditorOrigin = (stacked || this.stackedPopup !== null || this.activePopup === 'chat')
      ? (previousStackedPopup === 'chat' ? 'chat' : null)
      : null;
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

  protected openSelectedEventInReadOnlyEditor(stacked = false, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedEvent) {
      return;
    }
    this.openEventEditor(stacked, 'edit', this.selectedEvent, true);
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
    this.refreshActivitiesStickyHeaderSoon();
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

    this.activitiesContext.emitActivitiesEventSync({
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
      capacityTotal: resolvedMembers?.capacityTotal
    });
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
    this.interestSelectorContext = null;
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
    } else if (this.stackedPopup === 'chat') {
      this.subEventBadgePopupOrigin = 'chat';
    } else {
      this.subEventBadgePopupOrigin = 'active-event-editor';
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
    this.subEventResourceFilter = this.normalizeSubEventResourceFilter(type === 'Members' ? 'Members' : type, type);
    this.stackedPopup = 'subEventAssets';
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

    const chatSessionItem = this.activitiesContext.eventChatSession()?.item ?? null;
    if (!chatSessionItem && this.stackedPopup !== 'chat' && this.activePopup !== 'chat') {
      return null;
    }
    const chat = chatSessionItem ?? this.selectedChat;
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

  protected readonly subEventResourceFilterOptions: AppTypes.SubEventResourceFilter[] = ['Members', 'Car', 'Accommodation', 'Supplies'];

  protected selectSubEventResourceFilter(filter: AppTypes.SubEventResourceFilter): void {
    const previous = this.subEventResourceFilter;
    this.subEventResourceFilter = this.normalizeSubEventResourceFilter(filter);
    this.suppressSelectOverlayBackdropPointerEvents();
    this.subEventAssetMembersContext = null;
    if (this.subEventResourceFilter !== 'Members') {
      this.inlineItemActionMenu = null;
    }
    this.subEventMemberRolePickerUserId = null;
    if (this.subEventResourceFilter !== 'Members') {
      this.subEventMembersPendingOnly = false;
    } else if (previous !== 'Members') {
      this.subEventMembersPendingOnly = true;
    }
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
    return this.stackedPopup === 'subEventMembers'
      || (this.stackedPopup === 'subEventAssets' && this.subEventResourceFilter === 'Members');
  }

  protected isSubEventAssetResourcePopup(): boolean {
    if (!this.selectedSubEventBadgeContext) {
      return false;
    }
    return this.stackedPopup === 'subEventAssets' && this.subEventResourceFilter !== 'Members';
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
    if (!context || this.subEventResourceFilter === 'Members') {
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

  protected canShowStackedMembersInviteButton(): boolean {
    if (this.isSubEventMembersPopup()) {
      return this.canShowSubEventMembersInviteButton();
    }
    return this.stackedPopup === 'activityMembers' && this.canShowActivityMembersInviteButton();
  }

  protected openStackedMembersInviteFriends(event?: Event): void {
    if (this.isSubEventMembersPopup()) {
      this.openSubEventMembersInviteFriends(event);
      return;
    }
    this.openActivityInviteFriends(event);
  }

  protected subEventMembersPendingCount(): number {
    if (this.isGroupScopedSubEventResourceContext()) {
      return Math.max(0, Math.trunc(Number(this.selectedSubEventBadgeContext?.subEvent.membersPending) || 0));
    }
    return this.subEventMembersEntries().filter(member => member.status === 'pending').length;
  }

  protected toggleSubEventMembersPendingOnly(event?: Event): void {
    event?.stopPropagation();
    if (this.subEventResourceFilter !== 'Members') {
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
    if (!this.selectedSubEventBadgeContext || this.subEventResourceFilter === 'Members') {
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
    return this.assetCards
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
    this.openAssetForm();
    this.assetForm.type = resourceType;
    this.assetForm.routes = this.normalizeAssetRoutes(resourceType, this.assetForm.routes, '');
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
    const sourceCard = this.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
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

  protected isSubEventSupplyContributionsPopup(): boolean {
    return this.stackedPopup === 'subEventSupplyContributions' && this.selectedSubEventSupplyContributionContext !== null;
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
    const source = this.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
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
    const source = this.assetCards.find(item => item.id === editor.assetId && item.type === editor.type);
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
    this.assetCards = this.assetCards.map(asset => {
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
    const source = this.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
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
    const subEvent = this.findSubEventById(editor.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, editor.type);
    }
    this.subEventAssetCapacityEditor = null;
  }

  protected runSubEventResourceDeleteAction(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId) {
      return;
    }
    this.requestAssetDelete(card.sourceAssetId);
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
    const source = this.assetCards.find(card => card.id === context.assetId && card.type === 'Supplies');
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
    const subEvent = this.findSubEventById(this.subEventSupplyBringDialog.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
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
    const subEvent = this.findSubEventById(pending.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, 'Supplies');
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

  protected removeSubEventMember(member: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
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
      .map(id => this.assetCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppTypes.AssetType): Record<string, AppTypes.SubEventAssignedAssetSettings> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.subEventAssignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of assignedIds) {
      const source = this.assetCards.find(card => card.id === assetId && card.type === type);
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
    return 'Members';
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
      this.assetCards
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
      const source = this.assetCards.find(card => card.id === assetId && card.type === context.type);
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
    const targetSubEvent = this.findSubEventById(context.subEventId);
    if (targetSubEvent) {
      this.syncSubEventAssetBadgeCounts(targetSubEvent, context.type, nextIds);
    }
  }

  private syncSubEventAssetBadgeCounts(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType, assignedIds?: string[]): void {
    if (assignedIds) {
      const key = this.subEventAssetAssignmentKey(subEvent.id, type);
      this.subEventAssignedAssetIdsByKey[key] = [...assignedIds];
    }
    const pending = this.subEventAssetCapacityMetrics(subEvent, type).pending;
    if (type === 'Car') {
      subEvent.carsPending = pending;
      this.activitiesContext.touchEventChatSession();
      return;
    }
    if (type === 'Accommodation') {
      subEvent.accommodationPending = pending;
      this.activitiesContext.touchEventChatSession();
      return;
    }
    subEvent.suppliesPending = pending;
    this.activitiesContext.touchEventChatSession();
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
    const baseCards = assignedIds
      .map(id => this.assetCards.find(card => card.id === id && card.type === resourceType) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
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

  protected toggleAssetVisibilityPicker(event?: Event): void {
    event?.stopPropagation();
    this.showAssetVisibilityPicker = !this.showAssetVisibilityPicker;
  }

  protected selectAssetVisibility(option: AppTypes.EventVisibility, event?: Event): void {
    event?.stopPropagation();
    this.assetFormVisibility = option;
    this.showAssetVisibilityPicker = false;
  }

  protected toggleProfileStatusHeaderPicker(event?: Event): void {
    event?.stopPropagation();
    this.showProfileStatusHeaderPicker = !this.showProfileStatusHeaderPicker;
  }

  protected selectProfileStatusFromHeader(option: AppTypes.ProfileStatus, event?: Event): void {
    event?.stopPropagation();
    this.profileForm.profileStatus = option;
    this.showProfileStatusHeaderPicker = false;
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
    const target = targetOverride ?? (source && this.isHostingSource(source)
      ? 'hosting'
      : (this.activePopup === 'activities' && this.activitiesPrimaryFilter === 'hosting' ? 'hosting' : 'events'));
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
    if (this.activePopup === 'hostingEvent' || this.stackedPopup === 'hostingEvent') {
      return this.selectedHostingEvent;
    }
    if (this.activePopup === 'menuEvent' || this.stackedPopup === 'menuEvent') {
      return this.selectedEvent;
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
      topics: [...this.eventEditor.mainEvent.topics].slice(0, 5),
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

  protected openProfileEditor(): void {
    this.syncProfileFormFromActiveUser();
    this.popupReturnTarget = null;
    this.showProfileStatusHeaderPicker = false;
    this.showUserSettingsMenu = false;
    this.activePopup = 'profileEditor';
  }

  protected openImageEditor(): void {
    if (this.activePopup === 'profileEditor') {
      this.popupReturnTarget = 'profileEditor';
    }
    this.activePopup = 'imageEditor';
  }

  protected openLogoutConfirm(): void {
    this.activePopup = 'logoutConfirm';
  }

  protected closePopup(): void {
    this.stopActivitiesRatesPairSplitDrag();
    if (this.activePopup === 'imageEditor' && this.popupReturnTarget) {
      this.activePopup = this.popupReturnTarget;
      this.popupReturnTarget = null;
      return;
    }
    if (this.showUserMenu && (this.activePopup === 'eventFeedback' || this.activePopup === 'reportUser')) {
      this.suppressUserMenuOutsideCloseUntilMs = Date.now() + 180;
    }
    if (this.activePopup === 'profileEditor') {
      this.commitProfileForm(false);
    }
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    this.closeAssetForm();
    this.pendingAssetDeleteCardId = null;
    this.pendingAssetMemberAction = null;
    this.selectedAssetCardId = null;
    this.selectedTicketRow = null;
    this.selectedTicketCodeValue = '';
    this.ticketStickyValue = '';
    this.showTicketOrderPicker = false;
    this.ticketScannerState = 'idle';
    this.ticketScannerResult = null;
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
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
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showAssetVisibilityPicker = false;
    this.showProfileStatusHeaderPicker = false;
    this.showEventFeedbackFilterPicker = false;
    this.eventFeedbackCards = [];
    this.eventFeedbackIndex = 0;
    this.eventFeedbackListFilter = 'pending';
    this.eventFeedbackListSubmitMessage = '';
    this.eventFeedbackCardMenuEventId = null;
    this.selectedEventFeedbackEventId = null;
    this.eventFeedbackSubmittedState = false;
    this.eventFeedbackSubmitMessage = '';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass = '';
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    this.eventFeedbackNoteForm = { eventId: '', text: '' };
    this.eventFeedbackNoteSubmitted = false;
    this.eventFeedbackNoteSubmitMessage = '';
    this.pendingActivityDeleteRow = null;
    this.pendingActivityPublishRow = null;
    this.eventEditorReadOnly = false;
    this.eventEditorSource = null;
    this.eventEditorInvitationId = null;
    this.pendingActivityAction = 'delete';
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
    this.stackedEventEditorOrigin = null;
    this.clearActivityRateEditorState();
    this.cancelChatInitialLoad();
    this.cancelActivitiesPaginationLoad();
    this.clearActivitiesHeaderLoadingAnimation();
    this.cancelEventExplorePaginationLoad();
    this.clearEventExploreHeaderLoadingAnimation();
    this.clearActivitiesCalendarBadgeDelay();
    this.activitiesPaginationKey = '';
    this.activitiesVisibleCount = this.activitiesPageSize;
    this.activitiesHeaderProgress = 0;
    this.eventExplorePaginationKey = '';
    this.eventExploreVisibleCount = this.activitiesPageSize;
    this.eventExploreHeaderProgress = 0;
    this.eventExploreStickyValue = '';
    this.chatHeaderProgress = 0;
  }

  protected closePopupFromBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    this.closePopup();
  }

  protected closeStackedPopup(): void {
    if (this.stackedPopup === 'chat') {
      this.cancelChatInitialLoad();
      this.chatHeaderProgress = 0;
    }
    if (this.stackedPopup === 'ticketScanner') {
      this.cancelTicketScannerTimer();
      this.stopTicketScannerCamera();
      this.ticketScannerState = 'idle';
      this.ticketScannerResult = null;
      this.selectedTicketCodeValue = '';
      this.selectedTicketRow = null;
      this.stackedPopup = null;
      return;
    }
    if (this.stackedPopup === 'ticketCode') {
      this.cancelTicketScannerTimer();
      this.stopTicketScannerCamera();
      this.ticketScannerState = 'idle';
      this.ticketScannerResult = null;
      this.selectedTicketCodeValue = '';
      this.selectedTicketRow = null;
      this.stackedPopup = null;
      return;
    }
    if (this.stackedPopup === 'eventFeedback' || this.stackedPopup === 'eventFeedbackNote') {
      this.eventFeedbackCards = [];
      this.eventFeedbackIndex = 0;
      this.eventFeedbackSubmittedState = false;
      this.eventFeedbackSubmitMessage = '';
      if (this.eventFeedbackSlideAnimationTimer) {
        clearTimeout(this.eventFeedbackSlideAnimationTimer);
        this.eventFeedbackSlideAnimationTimer = null;
      }
      this.eventFeedbackSlideAnimClass = '';
      this.eventFeedbackTouchStartX = null;
      this.eventFeedbackTouchStartY = null;
      this.eventFeedbackNoteSubmitted = false;
      this.eventFeedbackNoteSubmitMessage = '';
      this.stackedPopup = null;
      return;
    }
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
    this.showEventExploreOrderPicker = false;
    this.cancelEventExplorePaginationLoad();
    this.clearEventExploreHeaderLoadingAnimation();
    this.eventExploreHeaderProgress = 0;
    if (this.superStackedPopup === 'subEventAssetAssign') {
      this.closeSubEventAssetAssignPopup(false);
      return;
    }
    if (this.superStackedPopup === 'impressionsHost') {
      this.superStackedPopup = null;
      return;
    }
    if (this.stackedPopup === 'subEventMembers' || this.stackedPopup === 'subEventAssets') {
      this.selectedSubEventBadgeContext = null;
      this.subEventAssetMembersContext = null;
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
    if (this.stackedPopup === 'valuesSelector') {
      this.valuesSelectorContext = null;
      this.valuesSelectorSelected = [];
    }
    if (this.stackedPopup === 'interestSelector') {
      this.interestSelectorContext = null;
      this.interestSelectorSelected = [];
    }
    if (this.stackedPopup === 'experienceSelector') {
      this.editingExperienceId = null;
      this.pendingExperienceDeleteId = null;
      this.showExperienceForm = false;
      this.resetExperienceForm();
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
      if (this.activityMembersPopupOrigin === 'event-explore') {
        this.activityMembersPopupOrigin = null;
        this.subEventAssetMembersContext = null;
        this.stackedPopup = 'eventExplore';
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
    this.showProfileStatusHeaderPicker = false;
    if (this.activePopup === 'chat') {
      this.scrollChatToBottom();
    }
  }

  protected confirmLogout(): void {
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    this.showUserMenu = false;
    this.showUserSettingsMenu = false;
    this.showUserSelector = false;
    this.showFirebaseAuthPopup = false;
    if (this.authMode === 'firebase') {
      localStorage.removeItem(App.FIREBASE_AUTH_PROFILE_KEY);
      this.firebaseAuthProfile = null;
      this.showEntryShell = true;
      return;
    }
    localStorage.removeItem(App.DEMO_ACTIVE_USER_KEY);
    this.showEntryShell = true;
  }

  protected selectLoginUser(userId: string): void {
    this.activeUserId = userId;
    localStorage.setItem(App.DEMO_ACTIVE_USER_KEY, userId);
    this.syncProfileFormFromActiveUser();
    this.activeMenuSection = 'chat';
    window.dispatchEvent(new CustomEvent('active-user-changed'));
    this.completeEntryFlow();
  }

  protected openUserSelector(): void {
    if (this.authMode === 'firebase') {
      this.showFirebaseAuthPopup = true;
      this.closeUserMenu();
      return;
    }
    this.showUserSelector = true;
    this.closeUserMenu();
  }

  protected openEntryAuth(): void {
    if (!this.showEntryShell) {
      return;
    }
    if (!this.hasEntryConsent) {
      this.entryConsentViewOnly = false;
      this.showEntryConsentPopup = true;
      return;
    }
    if (this.authMode === 'firebase') {
      if (this.firebaseAuthProfile) {
        this.completeEntryFlow();
        return;
      }
      this.showFirebaseAuthPopup = true;
      return;
    }
    this.showUserSelector = true;
  }

  protected closeFirebaseAuthPopup(): void {
    this.showFirebaseAuthPopup = false;
    this.firebaseAuthIsBusy = false;
  }

  protected closeDemoUserSelectorPopup(): void {
    this.showUserSelector = false;
  }

  protected scrollEntryTo(sectionId: string, event?: Event): void {
    event?.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected continueWithFirebaseAuth(): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    this.firebaseAuthIsBusy = true;
    const user = this.activeUser;
    const profile: AppTypes.FirebaseAuthProfile = {
      id: `oauth-${Date.now()}`,
      name: user.name,
      email: `${user.id}@myscoutee.local`,
      initials: user.initials
    };
    localStorage.setItem(App.FIREBASE_AUTH_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(App.DEMO_ACTIVE_USER_KEY, this.activeUserId);
    this.firebaseAuthProfile = profile;
    this.firebaseAuthIsBusy = false;
    this.completeEntryFlow();
  }

  protected get isFirebaseAuthMode(): boolean {
    return this.authMode === 'firebase';
  }

  protected get entryAuthButtonShowsAvatar(): boolean {
    return this.isFirebaseAuthMode && !!this.firebaseAuthProfile;
  }

  protected get entryAuthButtonIcon(): string {
    if (this.authMode === 'selector') {
      return 'group';
    }
    return 'login';
  }

  protected get entryAuthButtonLabel(): string {
    if (this.entryAuthButtonShowsAvatar) {
      return this.firebaseAuthProfile?.name ?? 'Continue';
    }
    return 'Login';
  }

  protected get hasEntryConsent(): boolean {
    return this.loadEntryConsentState() !== null;
  }

  protected openEntryConsentPopup(viewOnly = false): void {
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (!this.entryConsentViewOnly && !this.hasEntryConsent) {
      return;
    }
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected acceptEntryConsent(): void {
    const nowIso = new Date().toISOString();
    const consent: AppTypes.EntryConsentState = {
      version: App.ENTRY_CONSENT_VERSION,
      accepted: true,
      acceptedAtIso: nowIso
    };
    localStorage.setItem(App.ENTRY_CONSENT_KEY, JSON.stringify(consent));
    this.appendEntryConsentAudit('accepted', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected rejectEntryConsent(): void {
    const nowIso = new Date().toISOString();
    localStorage.removeItem(App.ENTRY_CONSENT_KEY);
    this.appendEntryConsentAudit('rejected', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected getPopupTitle(): string {
    switch (this.activePopup) {
      case 'activities':
        return 'Activities';
      case 'chat':
        return this.selectedChat?.title ?? 'Chat';
      case 'chatMembers':
        return 'Chat Members';
      case 'activityMembers':
        return 'Members';
      case 'impressionsHost':
        return this.activeHostTier;
      case 'impressionsMember':
        return this.memberImpressionTitle;
      case 'assetsCar':
        return 'Assets · Car';
      case 'assetsAccommodation':
        return 'Assets · Accommodation';
      case 'assetsSupplies':
        return 'Assets · Supplies';
      case 'assetsTickets':
        return 'Assets · Ticket';
      case 'tickets':
        return 'Tickets';
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'menuEvent':
        return this.selectedEvent?.title ?? 'Event';
      case 'hostingEvent':
        return this.selectedHostingEvent?.title ?? 'Hosting Event';
      case 'eventExplore':
        return 'Event Explore';
      case 'profileEditor':
        return 'Profile Editor';
      case 'imageEditor':
        return 'Image Editor';
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
      case 'helpCenter':
        return 'Help';
      case 'eventFeedback':
        return 'Event Feedback';
      case 'eventFeedbackNote':
        return 'Organizer Feedback';
      case 'reportUser':
        return 'Report User';
      case 'sendFeedback':
        return 'Send Feedback';
      case 'logoutConfirm':
        return 'Kilépés';
      case 'gdpr':
        return 'Privacy';
      default:
        return '';
    }
  }

  protected getStackedPopupTitle(): string {
    switch (this.stackedPopup) {
      case 'chat':
        return this.selectedChat?.title ?? 'Chat';
      case 'chatMembers':
        return 'Chat Members';
      case 'impressionsHost':
        return 'Impressions';
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'menuEvent':
        return this.selectedEvent?.title ?? 'Event';
      case 'hostingEvent':
        return this.selectedHostingEvent?.title ?? 'Hosting Event';
      case 'eventExplore':
        return 'Event Explore';
      case 'eventFeedback':
        return `Event Feedback · ${this.eventFeedbackCurrentEventTitle()}`;
      case 'eventFeedbackNote':
        return `Organizer Feedback · ${this.eventFeedbackCurrentEventTitle()}`;
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
      case 'valuesSelector':
        return 'Values';
      case 'interestSelector':
        return 'Interest';
      case 'experienceSelector':
        return 'Experience';
      case 'assetMembers':
        return this.selectedAssetCard ? `${this.selectedAssetCard.title} · Members` : 'Members';
      default:
        return '';
    }
  }

  protected get filteredExperienceEntries(): AppTypes.ExperienceEntry[] {
    const filtered = this.experienceEntries.filter(item => {
      if (this.experienceFilter === 'All') {
        return true;
      }
      return item.type === this.experienceFilter;
    });
    return [...filtered].sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom));
  }

  protected get experienceSummary(): string {
    return `${this.experienceEntries.length} entries`;
  }

  protected get workspaceExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'Workspace').length;
    return `${count} items`;
  }

  protected get schoolExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'School').length;
    return `${count} items`;
  }

  protected workspaceExperiencePreviewEntries(limit = 2): Array<{ title: string; subtitle: string; date: string }> {
    return this.experiencePreviewEntriesForType('Workspace', limit);
  }

  protected schoolExperiencePreviewEntries(limit = 2): Array<{ title: string; subtitle: string; date: string }> {
    return this.experiencePreviewEntriesForType('School', limit);
  }

  protected openExperienceSelector(filter: 'All' | 'Workspace' | 'School' = 'All'): void {
    this.experienceFilter = filter;
    this.pendingExperienceDeleteId = null;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.stackedPopup = 'experienceSelector';
  }

  protected openWorkspaceSelector(): void {
    this.openExperienceSelector('Workspace');
  }

  protected openSchoolSelector(): void {
    this.openExperienceSelector('School');
  }

  private experiencePreviewEntriesForType(type: 'Workspace' | 'School', limit: number): Array<{ title: string; subtitle: string; date: string }> {
    return this.experienceEntries
      .filter(item => item.type === type)
      .sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom))
      .slice(0, limit)
      .map(item => ({
        title: item.org,
        subtitle: item.title,
        date: `${item.dateFrom} - ${item.dateTo || 'Present'}`
      }));
  }

  protected experienceTypeIcon(type: AppTypes.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      default:
        return 'rocket_launch';
    }
  }

  protected experienceTypeClass(type: AppTypes.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-card-workspace';
      case 'School':
        return 'experience-card-school';
      case 'Online Session':
        return 'experience-card-online';
      default:
        return 'experience-card-project';
    }
  }

  protected experienceFilterIcon(option: 'All' | 'Workspace' | 'School'): string {
    if (option === 'Workspace') {
      return 'apartment';
    }
    if (option === 'School') {
      return 'school';
    }
    return 'filter_alt';
  }

  protected experienceFilterClass(option: 'All' | 'Workspace' | 'School'): string {
    if (option === 'Workspace') {
      return 'experience-filter-workspace';
    }
    if (option === 'School') {
      return 'experience-filter-school';
    }
    return 'experience-filter-all';
  }

  protected experienceTypeToneClass(type: AppTypes.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-filter-workspace';
      case 'School':
        return 'experience-filter-school';
      case 'Online Session':
        return 'experience-filter-online';
      default:
        return 'experience-filter-project';
    }
  }

  protected openExperienceForm(entry?: AppTypes.ExperienceEntry): void {
    this.pendingExperienceDeleteId = null;
    this.showExperienceForm = true;
    if (entry) {
      this.editingExperienceId = entry.id;
      this.experienceForm = {
        type: entry.type,
        title: entry.title,
        org: entry.org,
        city: entry.city,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo === 'Present' ? '' : entry.dateTo,
        description: entry.description
      };
      this.experienceRangeStart = AppUtils.fromYearMonth(entry.dateFrom);
      this.experienceRangeEnd = entry.dateTo === 'Present' ? null : AppUtils.fromYearMonth(entry.dateTo);
    } else {
      this.editingExperienceId = null;
      this.resetExperienceForm();
    }
  }

  protected closeExperienceForm(): void {
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
  }

  protected saveExperienceEntry(): void {
    if (!this.experienceForm.title.trim() || !this.experienceForm.org.trim() || !this.experienceRangeStart) {
      return;
    }
    const dateFrom = AppUtils.toYearMonth(this.experienceRangeStart);
    if (!dateFrom) {
      return;
    }
    const dateTo = this.experienceRangeEnd ? AppUtils.toYearMonth(this.experienceRangeEnd) : 'Present';
    const payload: Omit<AppTypes.ExperienceEntry, 'id'> = {
      ...this.experienceForm,
      dateFrom,
      title: this.experienceForm.title.trim(),
      org: this.experienceForm.org.trim(),
      city: this.experienceForm.city.trim(),
      dateTo: dateTo || 'Present',
      description: this.experienceForm.description.trim()
    };
    if (this.editingExperienceId) {
      this.experienceEntries = this.experienceEntries.map(item =>
        item.id === this.editingExperienceId
          ? {
              ...item,
              ...payload
            }
          : item
      );
    } else {
      this.experienceEntries = [
        ...this.experienceEntries,
        {
          id: `exp-${Date.now()}`,
          ...payload
        }
      ];
    }
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
  }

  protected requestExperienceDelete(entryId: string): void {
    this.pendingExperienceDeleteId = entryId;
  }

  protected cancelExperienceDelete(): void {
    this.pendingExperienceDeleteId = null;
  }

  protected confirmExperienceDelete(): void {
    if (!this.pendingExperienceDeleteId) {
      return;
    }
    this.experienceEntries = this.experienceEntries.filter(item => item.id !== this.pendingExperienceDeleteId);
    this.pendingExperienceDeleteId = null;
  }

  protected privacyIcon(value: 'Public' | 'Friends' | 'Hosts' | 'Private'): string {
    switch (value) {
      case 'Public':
        return '🔓';
      case 'Friends':
        return '👥';
      case 'Hosts':
        return '🎤';
      default:
        return '🔒';
    }
  }

  protected cycleDetailPrivacy(groupIndex: number, rowIndex: number): void {
    const group = this.profileDetailsForm[groupIndex];
    const row = group?.rows[rowIndex];
    if (!row) {
      return;
    }
    const order: AppTypes.DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    const currentIndex = order.indexOf(row.privacy);
    row.privacy = order[(currentIndex + 1 + order.length) % order.length];
  }

  protected toggleDetailPrivacyFab(groupIndex: number, rowIndex: number, event: MouseEvent): void {
    event.stopPropagation();
    const isOpen =
      this.openPrivacyFab?.groupIndex === groupIndex &&
      this.openPrivacyFab?.rowIndex === rowIndex;
    this.openPrivacyFab = isOpen ? null : { groupIndex, rowIndex };
    this.openExperiencePrivacyFab = null;
  }

  protected isDetailPrivacyFabOpen(groupIndex: number, rowIndex: number): boolean {
    return this.openPrivacyFab?.groupIndex === groupIndex && this.openPrivacyFab?.rowIndex === rowIndex;
  }

  protected selectDetailPrivacy(
    groupIndex: number,
    rowIndex: number,
    privacy: AppTypes.DetailPrivacy,
    event: MouseEvent
  ): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    row.privacy = privacy;
    this.openPrivacyFab = null;
    const key = this.detailPrivacyFabKey(groupIndex, rowIndex);
    this.privacyFabJustSelectedKey = key;
    setTimeout(() => {
      if (this.privacyFabJustSelectedKey === key) {
        this.privacyFabJustSelectedKey = null;
      }
    }, 280);
  }

  protected isDetailPrivacyJustSelected(groupIndex: number, rowIndex: number): boolean {
    return this.privacyFabJustSelectedKey === this.detailPrivacyFabKey(groupIndex, rowIndex);
  }

  protected openDetailPrivacySelector(groupIndex: number, rowIndex: number, event: Event): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    if (!this.isMobileView) {
      const isOpen =
        this.openPrivacyFab?.groupIndex === groupIndex &&
        this.openPrivacyFab?.rowIndex === rowIndex;
      this.openPrivacyFab = isOpen ? null : { groupIndex, rowIndex };
      this.openExperiencePrivacyFab = null;
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: `${row.label} visibility`,
      selected: row.privacy,
      options: this.privacySelectorOptions(),
      context: { kind: 'detailPrivacy', groupIndex, rowIndex }
    };
  }

  protected openExperiencePrivacySelector(type: 'workspace' | 'school', event: Event): void {
    event.stopPropagation();
    if (!this.isMobileView) {
      this.openExperiencePrivacyFab = this.openExperiencePrivacyFab === type ? null : type;
      this.openPrivacyFab = null;
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: `${type === 'workspace' ? 'Workspace' : 'School'} visibility`,
      selected: this.experienceVisibility[type],
      options: this.privacySelectorOptions(),
      context: { kind: 'experiencePrivacy', type }
    };
  }

  protected isExperiencePrivacyFabOpen(type: 'workspace' | 'school'): boolean {
    return this.openExperiencePrivacyFab === type;
  }

  protected selectExperiencePrivacy(
    type: 'workspace' | 'school',
    privacy: AppTypes.DetailPrivacy,
    event: MouseEvent
  ): void {
    event.stopPropagation();
    this.experienceVisibility[type] = privacy;
    this.openExperiencePrivacyFab = null;
  }

  protected openValuesSelector(groupIndex: number, rowIndex: number): void {
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    const allowed = new Set(this.beliefsValuesAllOptions());
    this.valuesSelectorContext = { groupIndex, rowIndex };
    this.valuesSelectorSelected = this.parseCommaValues(row.value)
      .filter(item => allowed.has(item))
      .slice(0, 5);
    this.syncValuesContextToRow();
    this.stackedPopup = 'valuesSelector';
  }

  protected openInterestSelector(groupIndex: number, rowIndex: number): void {
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    const allowed = new Set(this.interestAllOptions());
    this.interestSelectorContext = { groupIndex, rowIndex };
    this.interestSelectorSelected = this.parseCommaValues(row.value)
      .filter(item => allowed.has(item))
      .slice(0, 5);
    this.syncInterestContextToRow();
    this.stackedPopup = 'interestSelector';
  }

  protected toggleValuesOption(option: string): void {
    const allowed = this.beliefsValuesAllOptions();
    if (!allowed.includes(option)) {
      return;
    }
    const exists = this.valuesSelectorSelected.includes(option);
    if (!exists && this.valuesSelectorSelected.length >= 5) {
      return;
    }
    this.valuesSelectorSelected = exists
      ? this.valuesSelectorSelected.filter(item => item !== option)
      : [...this.valuesSelectorSelected, option];
    this.syncValuesContextToRow();
  }

  protected removeValuesOption(option: string): void {
    this.valuesSelectorSelected = this.valuesSelectorSelected.filter(item => item !== option);
    this.syncValuesContextToRow();
  }

  protected clearValuesSelector(): void {
    this.valuesSelectorSelected = [];
    this.syncValuesContextToRow();
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
    this.syncInterestContextToRow();
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [...this.interestSelectorSelected];
    }
  }

  protected removeInterestOption(option: string): void {
    this.interestSelectorSelected = this.interestSelectorSelected.filter(item => item !== option);
    this.syncInterestContextToRow();
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [...this.interestSelectorSelected];
    }
  }

  protected clearInterestSelector(): void {
    this.interestSelectorSelected = [];
    this.syncInterestContextToRow();
    if (this.superStackedPopup === 'eventTopicsSelector') {
      this.eventForm.topics = [];
    }
  }

  protected isInterestOptionSelected(option: string): boolean {
    return this.interestSelectorSelected.includes(option);
  }

  protected isValuesOptionSelected(option: string): boolean {
    return this.valuesSelectorSelected.includes(option);
  }

  protected valuesOptionToneClass(option: string): string {
    for (const group of this.beliefsValuesOptionGroups) {
      if (group.options.includes(option)) {
        return group.toneClass;
      }
    }
    return '';
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

  protected profileSelectorToneIcon(toneClass: string): string {
    switch (toneClass) {
      case 'section-family':
        return 'family_restroom';
      case 'section-ambition':
        return 'rocket_launch';
      case 'section-lifestyle':
        return 'eco';
      case 'section-beliefs':
        return 'auto_awesome';
      case 'section-social':
        return 'celebration';
      case 'section-arts':
        return 'palette';
      case 'section-food':
        return 'restaurant';
      case 'section-active':
        return 'hiking';
      case 'section-mind':
        return 'self_improvement';
      case 'section-identity':
        return 'public';
      default:
        return 'label';
    }
  }

  protected valuesRowSummary(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'Select values';
    }
    if (selected.length <= 2) {
      return selected.join(', ');
    }
    return `${selected[0]}, ${selected[1]} +${selected.length - 2}`;
  }

  protected valuesRowPreviewOptions(value: string, max = 2): string[] {
    const selected = this.parseCommaValues(value);
    return selected.slice(0, Math.max(0, max));
  }

  protected valuesRowPreviewOverflow(value: string, max = 2): number {
    const selected = this.parseCommaValues(value);
    return Math.max(0, selected.length - Math.max(0, max));
  }

  protected interestRowSummary(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'Select interests';
    }
    if (selected.length <= 2) {
      return selected.join(', ');
    }
    return `${selected[0]}, ${selected[1]} +${selected.length - 2}`;
  }

  protected interestRowPreviewOptions(value: string, max = 2): string[] {
    const selected = this.parseCommaValues(value);
    return selected.slice(0, Math.max(0, max));
  }

  protected interestRowPreviewOverflow(value: string, max = 2): number {
    const selected = this.parseCommaValues(value);
    return Math.max(0, selected.length - Math.max(0, max));
  }

  protected detailOptionClass(label: string, option: string, options: string[]): string {
    if (label === 'Values') {
      return this.valuesDominantToneClass(option);
    }
    if (label === 'Interest') {
      return this.interestDominantToneClass(option);
    }
    return this.detailToneFromOptions(option, options);
  }

  protected detailSelectedClass(label: string, value: string, options: string[]): string {
    if (label === 'Values') {
      return this.valuesDominantToneClass(value);
    }
    if (label === 'Interest') {
      return this.interestDominantToneClass(value);
    }
    return this.detailToneFromOptions(value, options);
  }

  protected detailOptionIcon(label: string, option: string): string {
    const normalizedLabel = AppUtils.normalizeText(label);
    const normalizedOption = AppUtils.normalizeText(option);

    if (normalizedLabel.includes('drinking')) {
      if (normalizedOption.includes('never')) {
        return 'no_drinks';
      }
      if (normalizedOption.includes('socially')) {
        return 'groups';
      }
      if (normalizedOption.includes('occasionally')) {
        return 'event';
      }
      return 'nightlife';
    }
    if (normalizedLabel.includes('smoking')) {
      if (normalizedOption.includes('never')) {
        return 'smoke_free';
      }
      if (normalizedOption.includes('trying')) {
        return 'healing';
      }
      if (normalizedOption.includes('socially')) {
        return 'group';
      }
      return 'smoking_rooms';
    }
    if (normalizedLabel.includes('workout')) {
      if (normalizedOption.includes('daily')) {
        return 'whatshot';
      }
      if (normalizedOption.includes('4x')) {
        return 'fitness_center';
      }
      if (normalizedOption.includes('2-3x')) {
        return 'directions_run';
      }
      return 'self_improvement';
    }
    if (normalizedLabel.includes('pets')) {
      if (normalizedOption.includes('dog')) {
        return 'pets';
      }
      if (normalizedOption.includes('cat')) {
        return 'cat';
      }
      if (normalizedOption.includes('all')) {
        return 'cruelty_free';
      }
      return 'block';
    }
    if (normalizedLabel.includes('family')) {
      if (normalizedOption.includes('want')) {
        return 'child_care';
      }
      if (normalizedOption.includes('open')) {
        return 'family_restroom';
      }
      if (normalizedOption.includes('not sure')) {
        return 'help_outline';
      }
      return 'do_not_disturb_alt';
    }
    if (normalizedLabel.includes('children')) {
      if (normalizedOption === 'yes') {
        return 'child_friendly';
      }
      if (normalizedOption === 'no') {
        return 'do_not_disturb_alt';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('love')) {
      if (normalizedOption.includes('long-term')) {
        return 'favorite';
      }
      if (normalizedOption.includes('slow-burn')) {
        return 'hourglass_bottom';
      }
      if (normalizedOption.includes('open')) {
        return 'hub';
      }
      return 'explore';
    }
    if (normalizedLabel.includes('communication')) {
      if (normalizedOption.includes('direct')) {
        return 'campaign';
      }
      if (normalizedOption.includes('calm')) {
        return 'record_voice_over';
      }
      if (normalizedOption.includes('playful')) {
        return 'mood';
      }
      return 'forum';
    }
    if (normalizedLabel.includes('orientation')) {
      if (normalizedOption.includes('straight')) {
        return 'person';
      }
      if (normalizedOption.includes('bisexual')) {
        return 'diversity_3';
      }
      if (normalizedOption.includes('gay') || normalizedOption.includes('lesbian')) {
        return 'favorite';
      }
      if (normalizedOption.includes('pansexual')) {
        return 'all_inclusive';
      }
      if (normalizedOption.includes('asexual')) {
        return 'do_not_disturb_on';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel === 'gender') {
      if (normalizedOption.includes('woman')) {
        return 'female';
      }
      if (normalizedOption.includes('man')) {
        return 'male';
      }
      if (normalizedOption.includes('non-binary')) {
        return 'transgender';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('religion')) {
      if (normalizedOption.includes('spiritual')) {
        return 'self_improvement';
      }
      if (normalizedOption.includes('christian')) {
        return 'church';
      }
      if (normalizedOption.includes('muslim')) {
        return 'mosque';
      }
      if (normalizedOption.includes('jewish')) {
        return 'synagogue';
      }
      if (normalizedOption.includes('buddhist') || normalizedOption.includes('hindu')) {
        return 'temple_buddhist';
      }
      if (normalizedOption.includes('atheist')) {
        return 'public_off';
      }
      return 'privacy_tip';
    }

    if (normalizedOption.includes('never')) {
      return 'block';
    }
    if (normalizedOption.includes('daily')) {
      return 'today';
    }
    const iconPool = [
      'radio_button_checked',
      'diamond',
      'bolt',
      'eco',
      'favorite',
      'nightlife',
      'star',
      'palette',
      'self_improvement',
      'travel_explore',
      'psychology',
      'celebration'
    ];
    let hash = 0;
    for (let i = 0; i < normalizedOption.length; i += 1) {
      hash = ((hash << 5) - hash + normalizedOption.charCodeAt(i)) | 0;
    }
    const safeIndex = Math.abs(hash) % iconPool.length;
    return iconPool[safeIndex];
  }

  protected valuesDominantToneClass(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'section-beliefs';
    }

    const counts: Record<string, number> = {};
    for (const option of selected) {
      const tone = this.valuesOptionToneClass(option);
      if (!tone) {
        continue;
      }
      counts[tone] = (counts[tone] ?? 0) + 1;
    }

    let bestTone = '';
    let bestCount = 0;
    for (const [tone, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestTone = tone;
        bestCount = count;
      }
    }

    // Tie or empty: follow the first selected option's category.
    if (!bestTone || Object.values(counts).filter(count => count === bestCount).length > 1) {
      const firstTone = this.valuesOptionToneClass(selected[0]);
      return firstTone || 'section-beliefs';
    }
    return bestTone;
  }

  protected interestDominantToneClass(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'section-social';
    }
    const counts: Record<string, number> = {};
    for (const option of selected) {
      const tone = this.interestOptionToneClass(option);
      if (!tone) {
        continue;
      }
      counts[tone] = (counts[tone] ?? 0) + 1;
    }

    let bestTone = '';
    let bestCount = 0;
    for (const [tone, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestTone = tone;
        bestCount = count;
      }
    }

    if (!bestTone || Object.values(counts).filter(count => count === bestCount).length > 1) {
      const firstTone = this.interestOptionToneClass(selected[0]);
      return firstTone || 'section-social';
    }

    return bestTone;
  }

  protected privacyStatusClass(value: 'Public' | 'Friends' | 'Hosts' | 'Private'): string {
    switch (value) {
      case 'Public':
        return 'status-public';
      case 'Friends':
        return 'status-friends';
      case 'Hosts':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected privacyStatusIcon(value: 'Public' | 'Friends' | 'Hosts' | 'Private'): string {
    switch (value) {
      case 'Public':
        return 'public';
      case 'Friends':
        return 'groups';
      case 'Hosts':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  protected privacyTriggerIcon(value: AppTypes.DetailPrivacy, isOpen: boolean): string {
    return isOpen ? 'close' : this.privacyStatusIcon(value);
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

  private syncValuesContextToRow(): void {
    if (!this.valuesSelectorContext) {
      return;
    }
    const row = this.profileDetailsForm[this.valuesSelectorContext.groupIndex]?.rows[this.valuesSelectorContext.rowIndex];
    if (!row) {
      return;
    }
    row.value = this.valuesSelectorSelected.join(', ');
  }

  private syncInterestContextToRow(): void {
    if (!this.interestSelectorContext) {
      return;
    }
    const row = this.profileDetailsForm[this.interestSelectorContext.groupIndex]?.rows[this.interestSelectorContext.rowIndex];
    if (!row) {
      return;
    }
    row.value = this.interestSelectorSelected.join(', ');
  }

  private parseCommaValues(value: string): string[] {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private detailToneFromOptions(value: string, options: string[]): string {
    const index = options.findIndex(item => AppUtils.normalizeText(item) === AppUtils.normalizeText(value));
    const paletteIndex = (index >= 0 ? index : 0) % 8;
    return `detail-tone-${paletteIndex + 1}`;
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  protected profileStatusClass(value: AppTypes.ProfileStatus = this.activeUser.profileStatus): string {
    switch (value) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected get profileCompletionPercent(): number {
    return this.calculateProfileCompletionPercent();
  }

  protected completionBadgeStyle(value: number): Record<string, string> {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const hue = Math.round((clamped / 100) * 120);
    return {
      background: `hsl(${hue}, 82%, 84%)`,
      borderColor: `hsl(${hue}, 70%, 58%)`,
      color: `hsl(${hue}, 74%, 24%)`
    };
  }

  private calculateProfileCompletionPercent(): number {
    let completed = 0;
    let total = 0;

    const add = (ok: boolean): void => {
      total += 1;
      if (ok) {
        completed += 1;
      }
    };

    const hasText = (value: string | null | undefined, minLength = 1): boolean =>
      (value?.trim().length ?? 0) >= minLength;

    const hasDetail = (label: string, minLength = 1): boolean => {
      const row = this.profileDetailRowByLabel(this.activeUser.id, label);
      return hasText(row?.value, minLength);
    };

    const languages = this.profileForm.languages.filter(item => hasText(item));
    const imageCount = this.imageSlots.filter(slot => hasText(slot ?? '')).length;
    const valuesCount = this.parseCommaValues(this.profileDetailRowByLabel(this.activeUser.id, 'Values')?.value ?? '').length;
    const interestCount = this.parseCommaValues(this.profileDetailRowByLabel(this.activeUser.id, 'Interest')?.value ?? '').length;
    const aboutLength = this.profileForm.about.trim().length;

    add(hasText(this.profileForm.fullName));
    add(this.profileForm.birthday instanceof Date);
    add(hasText(this.profileForm.city));
    add((this.profileForm.heightCm ?? 0) > 0);
    add(hasText(this.profileForm.physique));
    add(hasText(this.profileForm.horoscope));
    add(hasText(this.profileForm.profileStatus));
    add(languages.length > 0);
    add(languages.length > 1);
    add(languages.length > 2);
    add(aboutLength >= 20);
    add(aboutLength >= 80);
    add(aboutLength >= 140);
    add(valuesCount > 0);
    add(valuesCount >= 3);
    add(interestCount > 0);
    add(interestCount >= 3);
    add(hasDetail('Drinking'));
    add(hasDetail('Smoking'));
    add(hasDetail('Workout'));
    add(hasDetail('Pets'));
    add(hasDetail('Family plans'));
    add(hasDetail('Children'));
    add(hasDetail('Love style'));
    add(hasDetail('Communication style'));
    add(hasDetail('Sexual orientation'));
    add(hasDetail('Religion'));
    add(hasDetail('Gender'));

    for (let index = 0; index < 8; index += 1) {
      add(imageCount > index);
    }

    if (total === 0) {
      return 0;
    }
    return Math.round((completed / total) * 100);
  }

  protected getProfileStatusIcon(value: AppTypes.ProfileStatus = this.activeUser.profileStatus): string {
    switch (value) {
      case 'public':
        return 'public';
      case 'friends only':
        return 'groups';
      case 'host only':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  protected getPhysiqueIcon(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'directions_run';
    }
    if (normalized.includes('lean')) {
      return 'self_improvement';
    }
    if (normalized.includes('athletic')) {
      return 'fitness_center';
    }
    if (normalized.includes('fit')) {
      return 'sports_gymnastics';
    }
    if (normalized.includes('curvy')) {
      return 'accessibility';
    }
    if (normalized.includes('muscular')) {
      return 'sports_mma';
    }
    return 'accessibility_new';
  }

  protected getPhysiqueClass(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'physique-slim';
    }
    if (normalized.includes('lean')) {
      return 'physique-lean';
    }
    if (normalized.includes('fit')) {
      return 'physique-fit';
    }
    if (normalized.includes('athletic')) {
      return 'physique-athletic';
    }
    if (normalized.includes('curvy')) {
      return 'physique-curvy';
    }
    if (normalized.includes('muscular')) {
      return 'physique-muscular';
    }
    return 'physique-average';
  }

  protected getHoroscopeSymbol(value: string): string {
    switch (value) {
      case 'Aries':
        return '♈';
      case 'Taurus':
        return '♉';
      case 'Gemini':
        return '♊';
      case 'Cancer':
        return '♋';
      case 'Leo':
        return '♌';
      case 'Virgo':
        return '♍';
      case 'Libra':
        return '♎';
      case 'Scorpio':
        return '♏';
      case 'Sagittarius':
        return '♐';
      case 'Capricorn':
        return '♑';
      case 'Aquarius':
        return '♒';
      default:
        return '♓';
    }
  }

  protected getHoroscopeClass(value: string): string {
    return `zodiac-${AppUtils.normalizeText(value).replace(/\s+/g, '-')}`;
  }

  protected onBirthdayChange(value: Date | null): void {
    this.profileForm.birthday = value;
    this.profileForm.horoscope = value ? AppUtils.horoscopeByDate(value) : '';
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

  protected onProfileStatusChange(value: AppTypes.ProfileStatus): void {
    this.profileForm.profileStatus = value;
  }

  protected openProfileStatusSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Profile Status',
      selected: this.profileForm.profileStatus,
      options: this.profileStatusOptions.map(option => ({
        value: option.value,
        label: option.value,
        icon: option.icon,
        toneClass: this.profileStatusClass(option.value)
      })),
      context: { kind: 'profileStatus' }
    };
  }

  protected openMobilePhysiqueSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Physique',
      selected: this.profileForm.physique,
      options: this.physiqueOptions.map(option => ({
        value: option,
        label: option,
        icon: this.getPhysiqueIcon(option),
        toneClass: this.getPhysiqueClass(option)
      })),
      context: { kind: 'physique' }
    };
  }

  protected openMobileLanguageSelector(event: Event): void {
    event.stopPropagation();
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const stableHeight = Math.max(window.innerHeight - 6, 320);
      document.documentElement.style.setProperty(this.languageSheetHeightCssVar, `${stableHeight}px`);
    }
    this.languageInput = '';
    this.mobileProfileSelectorSheet = {
      title: 'Languages',
      selected: '',
      options: this.languageSuggestions.map(option => ({
        value: option,
        label: option,
        icon: 'language'
      })),
      context: { kind: 'language' }
    };
  }

  protected openMobileDetailValueSelector(groupIndex: number, rowIndex: number, event: Event): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: row.label,
      selected: row.value,
      options: row.options.map(option => ({
        value: option,
        label: option,
        icon: this.detailOptionIcon(row.label, option),
        toneClass: this.detailOptionClass(row.label, option, row.options)
      })),
      context: { kind: 'detailValue', groupIndex, rowIndex }
    };
  }

  protected openMobileExperienceTypeSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Experience Type',
      selected: this.experienceForm.type,
      options: this.experienceTypeOptions.map(option => ({
        value: option,
        label: option,
        icon: this.experienceTypeIcon(option),
        toneClass: this.experienceTypeToneClass(option)
      })),
      context: { kind: 'experienceType' }
    };
  }

  protected openMobileAssetFilterSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Asset Type',
      selected: this.assetFilter,
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
      title: 'Resources',
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

  protected openMobileActivitiesPrimaryFilterSelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Activities',
      selected: this.activitiesPrimaryFilter,
      options: this.activitiesPrimaryFilters.map(option => ({
        value: option.key,
        label: option.label,
        icon: option.icon,
        toneClass: this.activitiesPrimaryFilterClass(option.key),
        badge: this.activitiesPrimaryFilterCount(option.key)
      })),
      context: { kind: 'activitiesPrimaryFilter' }
    };
  }

  protected openMobileActivitiesChatContextFilterSelector(event: Event): void {
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Chat Channels',
      selected: this.activitiesChatContextFilter,
      options: this.activitiesChatContextFilters.map(option => ({
        value: option.key,
        label: option.label,
        icon: option.icon,
        toneClass: this.activitiesChatContextFilterClass(option.key),
        badge: this.activitiesChatContextFilterCount(option.key)
      })),
      context: { kind: 'activitiesChatContextFilter' }
    };
  }

  protected openMobileActivitiesRateFilterSelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Rate Type',
      selected: this.activitiesRateFilter,
      options: this.rateFilterEntries
        .map(option => {
          if (option.kind === 'group') {
            const isPair = option.label === 'Pair';
            return {
              value: `group-${option.label.toLowerCase().replace(/\s+/g, '-')}`,
              label: option.label,
              icon: isPair ? 'groups_2' : 'person',
              toneClass: `rate-filter-group-option-mobile ${isPair ? 'rate-filter-group-pair is-group-separator-mobile' : 'rate-filter-group-single'}`,
              disabled: true
            };
          }
          return {
            value: option.key,
            label: option.label,
            icon: this.activitiesRateFilterIcon(option.key),
            toneClass: this.rateFilterOptionClass(option.key),
            badge: this.rateFilterCount(option.key)
          };
        }),
      context: { kind: 'activitiesRateFilter' }
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
    if (typeof document !== 'undefined') {
      document.documentElement.style.removeProperty(this.languageSheetHeightCssVar);
    }
    this.mobileProfileSelectorSheet = null;
  }

  protected submitMobileLanguageAndClose(event: Event): void {
    event.stopPropagation();
    this.addCustomLanguage();
    this.closeMobileProfileSelectorSheet();
  }

  protected isMobileSelectorOptionActive(value: string): boolean {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return false;
    }
    if (sheet.context.kind === 'language') {
      return this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
    }
    return sheet.selected === value;
  }

  protected selectMobileProfileSelectorOption(value: string): void {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return;
    }
    if (sheet.context.kind === 'profileStatus') {
      if (this.profileStatusOptions.some(option => option.value === value)) {
        this.profileForm.profileStatus = value as AppTypes.ProfileStatus;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'physique') {
      if (this.physiqueOptions.includes(value)) {
        this.profileForm.physique = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'language') {
      const exists = this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
      if (exists) {
        this.profileForm.languages = this.profileForm.languages.filter(item => item.toLowerCase() !== value.toLowerCase());
      } else {
        this.profileForm.languages = [...this.profileForm.languages, value];
      }
      this.languageInput = '';
      this.mobileProfileSelectorSheet = {
        ...sheet,
        selected: this.profileForm.languages.join(', ')
      };
      return;
    }
    if (sheet.context.kind === 'detailPrivacy') {
      const row = this.profileDetailsForm[sheet.context.groupIndex]?.rows[sheet.context.rowIndex];
      if (row && this.isDetailPrivacy(value)) {
        row.privacy = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'experiencePrivacy') {
      if (this.isDetailPrivacy(value)) {
        this.experienceVisibility[sheet.context.type] = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'experienceType') {
      if (this.experienceTypeOptions.includes(value as AppTypes.ExperienceEntry['type'])) {
        this.experienceForm.type = value as AppTypes.ExperienceEntry['type'];
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'assetFilter') {
      if (this.assetFilterOptions.includes(value as AppTypes.AssetFilterType)) {
        this.selectAssetFilter(value as AppTypes.AssetFilterType);
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
    if (sheet.context.kind === 'activitiesPrimaryFilter') {
      if (this.activitiesPrimaryFilters.some(option => option.key === value)) {
        this.selectActivitiesPrimaryFilter(value as AppTypes.ActivitiesPrimaryFilter);
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'activitiesChatContextFilter') {
      if (this.activitiesChatContextFilters.some(option => option.key === value)) {
        this.selectActivitiesChatContextFilter(value as AppTypes.ActivitiesChatContextFilter);
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'activitiesRateFilter') {
      if (this.rateFilters.some(option => option.key === value)) {
        this.selectActivitiesRateFilter(value as AppTypes.RateFilterKey);
      }
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
    const row = this.profileDetailsForm[sheet.context.groupIndex]?.rows[sheet.context.rowIndex];
    if (row && row.options.includes(value)) {
      row.value = value;
    }
    this.mobileProfileSelectorSheet = null;
  }

  protected experienceVisibilityValue(type: 'workspace' | 'school'): AppTypes.DetailPrivacy {
    return this.experienceVisibility[type];
  }

  protected toggleExperiencePrivacy(type: 'workspace' | 'school', event: Event): void {
    event.stopPropagation();
    const order: AppTypes.DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    const current = this.experienceVisibility[type];
    const index = order.indexOf(current);
    this.experienceVisibility[type] = order[(index + 1 + order.length) % order.length];
  }

  protected toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
  }

  protected addCustomLanguage(value = this.languageInput): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    if (!this.profileForm.languages.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.profileForm.languages = [...this.profileForm.languages, normalized];
    }
    if (!this.languageSuggestions.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.languageSuggestions.push(normalized);
    }
    this.languageInput = '';
  }

  protected selectLanguage(value: string): void {
    this.addCustomLanguage(value);
    this.showLanguagePanel = true;
  }

  protected languageTriggerLabel(): string {
    if (this.profileForm.languages.length === 0) {
      return '';
    }
    if (this.profileForm.languages.length === 1) {
      return this.profileForm.languages[0];
    }
    return `${this.profileForm.languages[0]} +${this.profileForm.languages.length - 1}`;
  }

  protected languageTriggerPrimaryLabel(maxVisible = 2): string {
    const languages = this.profileForm.languages
      .map(item => item.trim())
      .filter(item => item.length > 0);
    if (languages.length === 0) {
      return '';
    }
    const visibleCount = Math.max(1, maxVisible);
    return languages.slice(0, visibleCount).join(', ');
  }

  protected languageTriggerOverflowCount(maxVisible = 2): number {
    const languages = this.profileForm.languages
      .map(item => item.trim())
      .filter(item => item.length > 0);
    const visibleCount = Math.max(1, maxVisible);
    return Math.max(0, languages.length - visibleCount);
  }

  protected onLanguageInputFocus(): void {
    this.showLanguagePanel = true;
  }

  protected onLanguagePanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  protected onLanguageInputContainerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.showLanguagePanel = true;
  }

  protected onLanguageInputBlur(): void {
    this.addCustomLanguage();
  }

  protected onLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.addCustomLanguage();
  }

  protected removeLanguage(value: string): void {
    this.profileForm.languages = this.profileForm.languages.filter(item => item !== value);
  }

  protected languageToneClass(value: string): string {
    return `language-tone-${this.languageToneIndex(value)}`;
  }

  protected languageToneIndex(value: string): number {
    const normalized = AppUtils.normalizeText(value);
    if (!normalized) {
      return 1;
    }
    let hash = 0;
    for (const char of normalized) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return (hash % 8) + 1;
  }

  protected get availableLanguageSuggestions(): string[] {
    const query = this.languageInput.trim().toLowerCase();
    return this.languageSuggestions.filter(item => {
      const isSelected = this.profileForm.languages.some(selected => selected.toLowerCase() === item.toLowerCase());
      if (isSelected) {
        return false;
      }
      return query.length === 0 ? true : item.toLowerCase().includes(query);
    });
  }

  protected get availableLanguageDisplaySuggestions(): string[] {
    return this.availableLanguageSuggestions.slice(0, 20);
  }

  protected get availableProfileStatusOptions(): Array<{ value: AppTypes.ProfileStatus; icon: string }> {
    return this.profileStatusOptions.filter(option => option.value !== this.profileForm.profileStatus);
  }

  protected get availablePhysiqueOptions(): string[] {
    return this.physiqueOptions.filter(option => option !== this.profileForm.physique);
  }

  protected get hostSocialProofBaseMetrics(): Array<{ label: string; value: string }> {
    return [
      { label: 'Average crown rating', value: `${(AppDemoGenerators.seededMetric(this.activeUser, 1, 38, 50) / 10).toFixed(1)} / 5.0` },
      { label: 'Attendance rate', value: `${AppDemoGenerators.seededMetric(this.activeUser, 2, 74, 99)}%` },
      { label: 'No-show ratio', value: `${AppDemoGenerators.seededMetric(this.activeUser, 3, 1, 16)}%` },
      { label: 'Repeat attendees', value: `${AppDemoGenerators.seededMetric(this.activeUser, 4, 36, 92)}%` }
    ];
  }

  protected get hostAverageRating(): string {
    const baseline = 4.4;
    const scores = this.submittedEventFeedbackAnswersByKind('event')
      .map(answer => this.feedbackScoreFromPrimary(answer.kind, answer.primaryValue))
      .filter(score => Number.isFinite(score));
    if (scores.length === 0) {
      return baseline.toFixed(1);
    }
    const weighted = ((baseline * 8) + scores.reduce((sum, score) => sum + score, 0)) / (8 + scores.length);
    return weighted.toFixed(1);
  }

  protected get hostTotalEvents(): number {
    return AppDemoGenerators.seededMetric(this.activeUser, 9, 12, 80);
  }

  protected get hostAttendanceTotal(): number {
    return this.hostTotalEvents * AppDemoGenerators.seededMetric(this.activeUser, 18, 8, 14);
  }

  protected get hostAttendanceAttended(): number {
    return Math.floor(this.hostAttendanceTotal * (AppDemoGenerators.seededMetric(this.activeUser, 2, 74, 96) / 100));
  }

  protected get hostAttendanceNoShow(): number {
    return this.hostAttendanceTotal - this.hostAttendanceAttended;
  }

  protected get hostAttendanceSummary(): string {
    return `${this.hostAttendanceAttended} / ${this.hostAttendanceTotal}`;
  }

  protected get hostAttendanceNoShowSummary(): string {
    return `${this.hostAttendanceNoShow}`;
  }

  protected get hostRepeatSummary(): string {
    const total = AppDemoGenerators.seededMetric(this.activeUser, 19, 60, 220);
    const repeat = Math.floor(total * (AppDemoGenerators.seededMetric(this.activeUser, 4, 36, 84) / 100));
    return `${repeat}`;
  }

  protected get hostPeopleMet(): number {
    return AppDemoGenerators.seededMetric(this.activeUser, 32, 90, 520) + this.submittedEventFeedbackAnswersByKind('event').length;
  }

  protected get hostVibeSummary(): string {
    const vibe = this.vibeCategories[AppDemoGenerators.seededMetric(this.activeUser, 5, 0, this.vibeCategories.length - 1)];
    return `${vibe} ${AppDemoGenerators.seededMetric(this.activeUser, 20, 18, 86)}%`;
  }

  protected get hostCategorySummary(): string {
    const sports = AppDemoGenerators.seededMetric(this.activeUser, 21, 8, 48);
    const roadTrip = AppDemoGenerators.seededMetric(this.activeUser, 22, 6, 36);
    return `Sports ${sports}%, Road Trip ${roadTrip}%`;
  }

  protected get hostVibeBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('event', 'vibe');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return AppUtils.withContextIconItems(this.hostVibeSummary, this.vibeIcons);
  }

  protected get hostPersonalityBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('event', 'personality');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return ['🧠 Communication 60%', '🧩 Coordination 40%'];
  }

  protected get hostCategoryBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('event', 'category');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return AppUtils.withContextIconItems(this.hostCategorySummary, this.categoryIcons);
  }

  protected get memberTraitBreakdown(): Array<{ label: string; value: string }> {
    // from plans/feature_list.txt sample
    return [
      { label: 'Adventurer', value: '60%' },
      { label: 'Deep Thinker', value: '30%' },
      { label: 'Empath', value: '10%' }
    ];
  }

  protected get memberPersonalityBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('attendee', 'personality');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return this.memberTraitBreakdown
      .map(item => `${this.memberTraitIcons[item.label] ?? ''} ${item.label} ${item.value}`.trim())
      .filter(Boolean);
  }

  protected get memberTotalEvents(): number {
    return this.hostTotalEvents;
  }

  protected get memberAttendanceSummary(): string {
    const total = 100;
    const attended = AppDemoGenerators.seededMetric(this.activeUser, 23, 4, 96);
    return `${attended} / ${total}`;
  }

  protected get memberNoShowCount(): number {
    const [attendedText, totalText] = this.memberAttendanceSummary.split('/').map(item => item.trim());
    const attended = Number.parseInt(attendedText, 10) || 0;
    const total = Number.parseInt(totalText, 10) || 0;
    return Math.max(0, total - attended);
  }

  protected get memberPeopleMet(): number {
    return AppDemoGenerators.seededMetric(this.activeUser, 24, 80, 460) + this.submittedEventFeedbackAnswersByKind('attendee').length;
  }

  protected get memberReturneesSummary(): string {
    const total = this.memberPeopleMet;
    const repeat = Math.floor(total * (AppDemoGenerators.seededMetric(this.activeUser, 33, 18, 72) / 100));
    return `${repeat}`;
  }

  protected get memberVibeSummary(): string {
    const first = this.vibeCategories[AppDemoGenerators.seededMetric(this.activeUser, 25, 0, this.vibeCategories.length - 1)];
    const second = this.vibeCategories[AppDemoGenerators.seededMetric(this.activeUser, 26, 0, this.vibeCategories.length - 1)];
    return `${first} ${AppDemoGenerators.seededMetric(this.activeUser, 27, 18, 74)}%, ${second} ${AppDemoGenerators.seededMetric(this.activeUser, 28, 12, 62)}%`;
  }

  protected get memberCategorySummary(): string {
    return `Outdoors ${AppDemoGenerators.seededMetric(this.activeUser, 29, 40, 95)}%, Games ${AppDemoGenerators.seededMetric(this.activeUser, 30, 35, 95)}%, Culture ${AppDemoGenerators.seededMetric(this.activeUser, 31, 25, 90)}%`;
  }

  protected get memberVibeBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('attendee', 'vibe');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return AppUtils.withContextIconItems(this.memberVibeSummary, this.vibeIcons);
  }

  protected get memberCategoryBadgeItems(): string[] {
    const feedbackBadges = this.feedbackBadgeItemsForSection('attendee', 'category');
    if (feedbackBadges.length > 0) {
      return feedbackBadges;
    }
    return AppUtils.withContextIconItems(this.memberCategorySummary, this.categoryIcons);
  }

  protected get memberCategoryPlacementClass(): string {
    const personalityLen = AppUtils.badgeItemsLength(this.memberPersonalityBadgeItems);
    const vibeLen = AppUtils.badgeItemsLength(this.memberVibeBadgeItems);
    return personalityLen <= vibeLen ? 'badge-below-left' : 'badge-below-right';
  }

  private submittedEventFeedbackAnswersByKind(kind: 'event' | 'attendee'): AppTypes.SubmittedEventFeedbackAnswer[] {
    return Object.values(this.submittedEventFeedbackAnswersByUser[this.activeUser.id] ?? {})
      .filter(answer => answer.kind === kind);
  }

  private feedbackScoreFromPrimary(kind: 'event' | 'attendee', value: string): number {
    if (kind === 'event') {
      switch (value) {
        case 'excellent':
          return 5;
        case 'good':
          return 4;
        case 'mixed':
          return 3;
        case 'needs-work':
          return 2;
        default:
          return 3.5;
      }
    }
    switch (value) {
      case 'great':
        return 5;
      case 'reliable':
        return 4.5;
      case 'neutral':
        return 3;
      case 'rough':
        return 2;
      default:
        return 3.5;
    }
  }

  private feedbackBadgeItemsForSection(
    kind: 'event' | 'attendee',
    section: 'personality' | 'vibe' | 'category'
  ): string[] {
    const answers = this.submittedEventFeedbackAnswersByKind(kind);
    if (answers.length === 0) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const answer of answers) {
      for (const tag of answer.tags) {
        if (this.feedbackSectionFromTag(kind, tag) !== section) {
          continue;
        }
        const label = this.feedbackBadgeLabel(tag);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    if (counts.size === 0) {
      return [];
    }
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return [...counts.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([label, count]) => `${this.feedbackSectionIcon(section)} ${label} ${Math.round((count / total) * 100)}%`);
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

  private feedbackBadgeLabel(tag: string): string {
    return tag
      .replace(/^Host\s+/i, '')
      .replace(/^Attendee\s+/i, '')
      .trim();
  }

  private feedbackSectionIcon(section: 'personality' | 'vibe' | 'category'): string {
    if (section === 'personality') {
      return '🧠';
    }
    if (section === 'category') {
      return '🧭';
    }
    return '💬';
  }

  protected get activeHostTier(): string {
    return this.profileForm.hostTier || this.activeUser.hostTier;
  }

  protected get activeMemberTrait(): string {
    return this.profileForm.traitLabel || this.activeUser.traitLabel;
  }

  protected get memberImpressionTitle(): string {
    const normalized = AppUtils.normalizeText(this.activeMemberTrait);
    if (normalized.includes('empat') || normalized.includes('empath')) {
      return 'Empathetic Attendee';
    }
    if (normalized.includes('advent')) {
      return 'Adventurous Attendee';
    }
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'Creative Attendee';
    }
    if (normalized.includes('think')) {
      return 'Thoughtful Attendee';
    }
    if (normalized.includes('social')) {
      return 'Social Attendee';
    }
    if (normalized.includes('playful')) {
      return 'Playful Attendee';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'Ambitious Attendee';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'Reliable Attendee';
    }
    return `${this.activeMemberTrait} Attendee`;
  }

  protected get hostTierBadgeIcon(): string {
    const tier = AppUtils.normalizeText(this.activeHostTier);
    if (tier.includes('platinum')) return '👑';
    if (tier.includes('gold')) return '🥇';
    if (tier.includes('silver')) return '🥈';
    return '🥉';
  }

  protected getHostTierIcon(hostTier: string): string {
    const normalized = AppUtils.normalizeText(hostTier);
    if (normalized.includes('platinum')) {
      return 'diamond';
    }
    if (normalized.includes('gold')) {
      return 'emoji_events';
    }
    if (normalized.includes('silver')) {
      return 'workspace_premium';
    }
    if (normalized.includes('bronze')) {
      return 'military_tech';
    }
    return 'workspace_premium';
  }

  protected getHostTierColorClass(hostTier: string): string {
    const normalized = AppUtils.normalizeText(hostTier);
    if (normalized.includes('platinum')) {
      return 'icon-tier-platinum';
    }
    if (normalized.includes('gold')) {
      return 'icon-tier-gold';
    }
    if (normalized.includes('silver')) {
      return 'icon-tier-silver';
    }
    if (normalized.includes('bronze')) {
      return 'icon-tier-bronze';
    }
    return 'icon-tier-default';
  }

  protected getHostTierToneClass(hostTier: string): string {
    const normalized = AppUtils.normalizeText(hostTier);
    if (normalized.includes('platinum')) {
      return 'impression-shortcut-tone-platinum';
    }
    if (normalized.includes('gold')) {
      return 'impression-shortcut-tone-gold';
    }
    if (normalized.includes('silver')) {
      return 'impression-shortcut-tone-silver';
    }
    if (normalized.includes('bronze')) {
      return 'impression-shortcut-tone-bronze';
    }
    return 'impression-shortcut-tone-platinum';
  }

  protected getTraitIcon(traitLabel: string): string {
    const normalized = AppUtils.normalizeText(traitLabel);
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'palette';
    }
    if (normalized.includes('empat')) {
      return 'favorite';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'verified';
    }
    if (normalized.includes('advent')) {
      return 'hiking';
    }
    if (normalized.includes('think')) {
      return 'psychology';
    }
    if (normalized.includes('social')) {
      return 'groups';
    }
    if (normalized.includes('playful')) {
      return 'sports_esports';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'trending_up';
    }
    return 'auto_awesome';
  }

  protected getTraitColorClass(traitLabel: string): string {
    const normalized = AppUtils.normalizeText(traitLabel);
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'icon-trait-creative';
    }
    if (normalized.includes('empat')) {
      return 'icon-trait-empath';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'icon-trait-reliable';
    }
    if (normalized.includes('advent')) {
      return 'icon-trait-adventurer';
    }
    if (normalized.includes('think')) {
      return 'icon-trait-thinker';
    }
    if (normalized.includes('social')) {
      return 'icon-trait-social';
    }
    if (normalized.includes('playful')) {
      return 'icon-trait-playful';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'icon-trait-ambitious';
    }
    return 'icon-trait-default';
  }

  protected getTraitToneClass(traitLabel: string): string {
    const normalized = AppUtils.normalizeText(traitLabel);
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'impression-shortcut-tone-creative';
    }
    if (normalized.includes('empat')) {
      return 'impression-shortcut-tone-empath';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'impression-shortcut-tone-reliable';
    }
    if (normalized.includes('advent')) {
      return 'impression-shortcut-tone-adventurer';
    }
    if (normalized.includes('think')) {
      return 'impression-shortcut-tone-thinker';
    }
    if (normalized.includes('social')) {
      return 'impression-shortcut-tone-social';
    }
    if (normalized.includes('playful')) {
      return 'impression-shortcut-tone-playful';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'impression-shortcut-tone-ambitious';
    }
    return 'impression-shortcut-tone-thinker';
  }

  protected openHostImpressions(): void {
    if (this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'impressionsHost';
      return;
    }
    this.activePopup = 'impressionsHost';
  }

  protected openMemberImpressions(): void {
    if (this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'impressionsHost';
      return;
    }
    this.activePopup = 'impressionsHost';
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

  protected getChatStarter(item: ChatMenuItem): DemoUser {
    const members = this.getChatMembersById(item.id);
    return members[1] ?? members[0] ?? this.activeUser;
  }

  protected getChatLastSender(item: ChatMenuItem): DemoUser {
    return this.users.find(user => user.id === item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
  }

  protected getChatVisibleMembers(item: ChatMenuItem, limit = 3): DemoUser[] {
    return this.getChatMembersById(item.id).slice(0, limit);
  }

  protected getChatHiddenMemberCount(item: ChatMenuItem, limit = 3): number {
    const total = this.getChatMembersById(item.id).length;
    return total > limit ? total - limit : 0;
  }

  protected getChatMemberCount(item: ChatMenuItem): number {
    return this.getChatMembersById(item.id).length;
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

  protected selectedChatHeaderActionIcon(): string {
    if (!this.selectedChat) {
      return 'event';
    }
    const channelType = this.chatChannelType(this.selectedChat);
    if (channelType === 'groupSubEvent') {
      return 'groups';
    }
    if (channelType === 'optionalSubEvent') {
      return 'event_available';
    }
    return 'event';
  }

  protected selectedChatHasSubEventMenu(): boolean {
    if (!this.selectedChat) {
      return false;
    }
    const channelType = this.chatChannelType(this.selectedChat);
    return channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
  }

  protected selectedChatHeaderActionLabel(): string {
    if (!this.selectedChat) {
      return 'View Event';
    }
    const channelType = this.chatChannelType(this.selectedChat);
    if (channelType === 'groupSubEvent') {
      return 'View Group';
    }
    if (channelType === 'optionalSubEvent') {
      return 'View Sub Event';
    }
    return 'View Event';
  }

  protected selectedChatHeaderActionToneClass(): string {
    if (!this.selectedChat) {
      return 'popup-chat-context-btn-tone-main-event';
    }
    const channelType = this.chatChannelType(this.selectedChat);
    if (channelType === 'optionalSubEvent') {
      return 'popup-chat-context-btn-tone-optional';
    }
    if (channelType === 'groupSubEvent') {
      return 'popup-chat-context-btn-tone-group';
    }
    return 'popup-chat-context-btn-tone-main-event';
  }

  protected selectedChatHeaderActionBadgeCount(): number {
    const chat = this.selectedChat;
    if (!chat) {
      return 0;
    }
    return this.contextualChatUnreadCount(chat);
  }

  protected selectedChatContextMenuTitle(): string {
    const subEvent = this.selectedChatSubEvent();
    if (!subEvent) {
      return this.selectedChat?.title ?? 'Chat';
    }
    const group = this.selectedChatGroup(subEvent);
    if (group) {
      return `${this.subEventDisplayName(subEvent) || subEvent.name} · ${group.name}`;
    }
    return this.subEventDisplayName(subEvent) || subEvent.name || (this.selectedChat?.title ?? 'Sub Event');
  }

  protected selectedChatShowsMembersResource(): boolean {
    if (!this.selectedChatHasSubEventMenu()) {
      return false;
    }
    const subEvent = this.selectedChatSubEvent();
    if (!subEvent) {
      return false;
    }
    return subEvent.optional || this.chatChannelType(this.selectedChat!) === 'groupSubEvent';
  }

  protected selectedChatResourceSummary(type: 'Members' | 'Car' | 'Accommodation' | 'Supplies'): string {
    const subEvent = this.selectedChatSubEvent();
    if (!subEvent) {
      return '';
    }
    if (type === 'Members') {
      return this.subEventCapacityLabel(subEvent);
    }
    return this.subEventAssetCapacityLabel(subEvent, type);
  }

  protected selectedChatResourcePending(type: 'Members' | 'Car' | 'Accommodation' | 'Supplies'): number {
    const subEvent = this.selectedChatSubEvent();
    if (!subEvent) {
      return 0;
    }
    if (type === 'Members') {
      return this.subEventMembersBadgePendingCount(subEvent);
    }
    return this.subEventAssetBadgePendingCount(subEvent, type);
  }

  protected toggleSelectedChatContextMenu(event: Event): void {
    event.stopPropagation();
    if (!this.selectedChat || !this.selectedChatHasSubEventMenu()) {
      return;
    }
    const menuId = this.selectedChatContextMenuId();
    if (this.inlineItemActionMenu?.scope === 'chatContext' && this.inlineItemActionMenu.id === menuId) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = {
      scope: 'chatContext',
      id: menuId,
      title: this.selectedChat.title,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isSelectedChatContextMenuOpen(): boolean {
    return this.inlineItemActionMenu?.scope === 'chatContext'
      && this.inlineItemActionMenu.id === this.selectedChatContextMenuId();
  }

  protected isSelectedChatContextMenuOpenUp(): boolean {
    return this.inlineItemActionMenu?.scope === 'chatContext'
      && this.inlineItemActionMenu.id === this.selectedChatContextMenuId()
      && this.inlineItemActionMenu.openUp;
  }

  protected openSelectedChatHeaderAction(event?: Event): void {
    event?.stopPropagation();
    if (this.selectedChatHasSubEventMenu()) {
      if (event) {
        this.toggleSelectedChatContextMenu(event);
      }
      return;
    }
    this.openSelectedChatEvent(event);
  }

  protected openSelectedChatSubEvent(event?: Event): void {
    event?.stopPropagation();
    const source = this.selectedChat ? this.resolveChatEventSource(this.selectedChat) : null;
    if (!source) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.openEventEditor(true, 'edit', source, true);
    setTimeout(() => this.openEventSubEventsPopup(), 0);
  }

  protected openSelectedChatEvent(event?: Event): void {
    event?.stopPropagation();
    const source = this.selectedChat ? this.resolveChatEventSource(this.selectedChat) : null;
    if (!source) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.openEventEditor(true, 'edit', source, true);
  }

  protected openSelectedChatSubEventResource(
    type: 'Members' | 'Car' | 'Accommodation' | 'Supplies',
    event?: Event
  ): void {
    event?.stopPropagation();
    const subEvent = this.selectedChatSubEvent();
    if (!subEvent) {
      return;
    }
    const group = this.selectedChat
      && this.chatChannelType(this.selectedChat) === 'groupSubEvent'
      ? this.selectedChatTournamentGroup(subEvent)
      : null;
    this.inlineItemActionMenu = null;
    this.openSubEventBadgePopup(type, subEvent, undefined, group);
  }

  private selectedChatSubEventResourceTotal(subEvent: AppTypes.SubEventFormItem): number {
    const chat = this.selectedChat;
    if (!chat) {
      return 0;
    }
    const isGroupChannel = this.chatChannelType(chat) === 'groupSubEvent';
    return this.contextualSubEventPendingTotal(subEvent, subEvent.optional || isGroupChannel);
  }

  protected selectedChatSubEvent(): AppTypes.SubEventFormItem | null {
    if (!this.selectedChat) {
      return null;
    }
    return this.chatSubEventForItem(this.selectedChat);
  }

  private selectedChatTournamentGroup(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventTournamentGroup | null {
    if (!this.selectedChat?.groupId) {
      return null;
    }
    const groups = this.subEventGroupsForStage(subEvent);
    const groupIndex = groups.findIndex(group => group.id === this.selectedChat!.groupId);
    if (groupIndex < 0) {
      return null;
    }
    const group = groups[groupIndex];
    return {
      key: `${subEvent.id}:g:${group.id}`,
      id: group.id,
      groupNumber: groupIndex + 1,
      groupLabel: group.name,
      source: this.normalizedSubEventGroupSource(group),
      subEvent
    };
  }

  private selectedChatGroup(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventGroupItem | null {
    if (!this.selectedChat || !this.selectedChat.groupId) {
      return null;
    }
    return this.subEventGroupsForStage(subEvent).find(group => group.id === this.selectedChat!.groupId) ?? null;
  }

  private selectedChatContextMenuId(): string {
    return this.selectedChat ? `chat-context:${this.selectedChat.id}` : 'chat-context:none';
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
    const members = includeMembers ? this.chatCountValue(subEvent.membersPending) : 0;
    return members
      + this.subEventAssetBadgePendingCount(subEvent, 'Car')
      + this.subEventAssetBadgePendingCount(subEvent, 'Accommodation')
      + this.subEventAssetBadgePendingCount(subEvent, 'Supplies');
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
    const eventPending = this.getActivityMembersByRow(row).filter(member => member.status === 'pending').length;
    const eventId = this.normalizeLocationValue(item.eventId).trim() || source.id;
    const subEventsPending = this.chatEventSubEvents(eventId)
      .reduce((sum, subEvent) => sum + this.contextualSubEventPendingTotal(subEvent, true), 0);
    return eventPending + subEventsPending;
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
    if (this.eventEditorService.isOpen()) {
      const editorSource = this.resolveEventEditorSource();
      if (editorSource) {
        return editorSource;
      }
    }
    if (this.selectedEvent) {
      return this.selectedEvent;
    }
    if (this.selectedHostingEvent) {
      return this.selectedHostingEvent;
    }
    const managed = this.eventItems.find(item => item.isAdmin);
    if (managed) {
      return managed;
    }
    return this.eventItems[0] ?? this.hostingItems[0] ?? null;
  }

  private resolveChatEventSource(item: ChatMenuItem): EventMenuItem | HostingMenuItem | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    if (!eventId) {
      return this.resolveChatFocusEventSource();
    }
    const fromEvents = this.eventItems.find(event => event.id === eventId);
    if (fromEvents) {
      return fromEvents;
    }
    const fromHosting = this.hostingItems.find(event => event.id === eventId);
    if (fromHosting) {
      return fromHosting;
    }
    const editorSource = this.resolveEventEditorSource();
    if (editorSource?.id === eventId) {
      return editorSource;
    }
    return {
      id: eventId,
      avatar: AppUtils.initialsFromText(item.title || 'Event'),
      title: item.title || 'Event',
      shortDescription: item.lastMessage || 'Event chat channel',
      timeframe: '',
      activity: item.unread,
      isAdmin: false
    };
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
    return this.normalizeLocationValue(this.selectedChat?.eventId).trim() || null;
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

  protected get isActivitiesPopup(): boolean {
    return this.activePopup === 'activities';
  }

  protected get filteredActivityRows(): AppTypes.ActivityListRow[] {
    const rows = this.buildFilteredActivityRowsBase();
    if (this.isCalendarLayoutView()) {
      return rows;
    }
    this.ensureActivitiesPaginationState(rows.length);
    if (this.activitiesInitialLoadPending) {
      return [];
    }
    return rows.slice(0, Math.min(this.activitiesVisibleCount, rows.length));
  }

  private buildFilteredActivityRowsBase(): AppTypes.ActivityListRow[] {
    let rows: AppTypes.ActivityListRow[] = [];
    if (this.activitiesPrimaryFilter === 'chats') {
      rows = this.chatItemsForActivities()
        .filter(item => this.matchesActivitiesChatContextFilter(item))
        .map(item => {
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
      });
    } else if (this.activitiesPrimaryFilter === 'invitations') {
      rows = this.invitationItems.map(item => ({
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
      }));
    } else if (this.activitiesPrimaryFilter === 'events') {
      rows = [
        ...this.eventItems.map<AppTypes.ActivityListRow>(item => ({
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
        })),
        ...this.acceptedInvitationRowsAsEvents()
      ];
    } else if (this.activitiesPrimaryFilter === 'hosting') {
      rows = this.eventItems
        .filter(item => item.isAdmin)
        .filter(item => this.hostingPublicationFilter === 'drafts' ? !this.isHostingPublished(item.id) : true)
        .map(item => ({
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
      }));
    } else {
      rows = this.rateItems
        .filter(item => item.userId !== this.activeUser.id && this.matchesRateFilter(item, this.activitiesRateFilter))
        .map(item => {
          const user = this.users.find(candidate => candidate.id === item.userId) ?? this.activeUser;
          const direction = this.displayedRateDirection(item);
          const ownScore = this.rateOwnScore(item);
          return {
            id: item.id,
            type: 'rates',
            title: user.name,
            subtitle: '',
            detail: '',
            dateIso: item.happenedAt,
            distanceKm: item.distanceKm,
            unread: 0,
            metricScore: direction === 'mutual' ? ownScore + Math.max(item.scoreReceived, 0) : ownScore,
            source: item
          };
        });
    }

    const sorted = this.sortActivitiesRows(rows);
    if (this.activitiesView === 'distance') {
      return [...sorted].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return sorted;
  }

  protected get eventStyleActivityRows(): AppTypes.ActivityListRow[] {
    return this.filteredActivityRows.filter(row => this.isEventStyleActivity(row));
  }

  protected get nonEventStyleActivityRows(): AppTypes.ActivityListRow[] {
    return this.filteredActivityRows.filter(row => !this.isEventStyleActivity(row));
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
    const ordered = [...eventRows, ...hostingRows].sort((a, b) => AppUtils.toSortableDate(a.dateIso) - AppUtils.toSortableDate(b.dateIso));
    if (this.ticketDateOrder === 'upcoming') {
      return ordered.reverse();
    }
    return ordered;
  }

  protected get groupedTicketRows(): AppTypes.ActivityGroup[] {
    const grouped: AppTypes.ActivityGroup[] = [];
    for (const row of this.ticketRows) {
      const label = this.ticketGroupLabel(row.dateIso);
      const lastGroup = grouped[grouped.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        grouped.push({ label, rows: [row] });
        continue;
      }
      lastGroup.rows.push(row);
    }
    return grouped;
  }

  protected get ticketStickyHeader(): string {
    if (this.ticketStickyValue) {
      return this.ticketStickyValue;
    }
    return this.groupedTicketRows[0]?.label ?? 'No tickets';
  }

  protected ticketHeaderSummary(): string {
    const count = this.ticketRows.length;
    return count === 1 ? '1 ticketed event' : `${count} ticketed events`;
  }

  protected ticketDateOrderLabel(): string {
    return this.ticketDateOrder === 'upcoming' ? 'Upcoming' : 'Past';
  }

  protected ticketDateOrderIcon(): string {
    return this.ticketDateOrder === 'upcoming' ? 'schedule' : 'history';
  }

  protected toggleTicketOrderPicker(event?: Event): void {
    event?.stopPropagation();
    this.showTicketOrderPicker = !this.showTicketOrderPicker;
  }

  protected selectTicketDateOrder(order: 'upcoming' | 'past', event?: Event): void {
    event?.stopPropagation();
    if (this.ticketDateOrder === order) {
      this.showTicketOrderPicker = false;
      return;
    }
    this.ticketDateOrder = order;
    this.showTicketOrderPicker = false;
    this.seedTicketStickyHeader();
    setTimeout(() => this.syncTicketScrollOnOpen(), 0);
  }

  protected ticketCardMetaLine(row: AppTypes.ActivityListRow): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  protected openTicketCodePopup(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.selectedTicketRow = row;
    this.selectedTicketCodeValue = this.encodeTicketPayload(this.createTicketScanPayload(row));
    this.ticketScannerResult = null;
    this.ticketScannerState = 'idle';
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    this.stackedPopup = 'ticketCode';
  }

  protected ticketCodeAvatarUrl(): string {
    const payload = this.selectedTicketPayload();
    return this.ticketPayloadAvatarUrl(payload);
  }

  protected ticketCodeInitials(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return this.ticketPayloadInitials(payload);
  }

  protected ticketCodePersonLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`;
  }

  protected ticketCodeRoleEventLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return `${payload.holderRole} · ${payload.eventTitle}`;
  }

  protected ticketCodeDateLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return payload.eventTimeframe || payload.eventDateLabel;
  }

  protected ticketQrImageUrl(): string {
    if (!this.selectedTicketCodeValue) {
      return '';
    }
    const payload = encodeURIComponent(this.selectedTicketCodeValue);
    return `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&ecc=Q&margin=0&data=${payload}`;
  }

  protected openTicketScannerPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedTicketRow || !this.selectedTicketCodeValue) {
      const fallbackRow = this.ticketRows[0] ?? null;
      if (fallbackRow) {
        this.selectedTicketRow = fallbackRow;
        this.selectedTicketCodeValue = this.encodeTicketPayload(this.createTicketScanPayload(fallbackRow));
      } else {
        this.selectedTicketRow = null;
        this.selectedTicketCodeValue = '';
      }
    }
    this.ticketScannerState = 'reading';
    this.ticketScannerResult = null;
    this.stackedPopup = 'ticketScanner';
    this.startTicketScannerReading();
  }

  protected retryTicketScanner(event?: Event): void {
    event?.stopPropagation();
    this.ticketScannerState = 'reading';
    this.ticketScannerResult = null;
    this.startTicketScannerReading();
  }

  protected ticketScannerPersonLine(): string {
    const payload = this.ticketScannerResult;
    if (!payload) {
      return '';
    }
    return `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`;
  }

  protected ticketScannerRoleEventLine(): string {
    const payload = this.ticketScannerResult;
    if (!payload) {
      return '';
    }
    return `${payload.holderRole} · ${payload.eventTitle}`;
  }

  protected ticketScannerDateLine(): string {
    const payload = this.ticketScannerResult;
    if (!payload) {
      return '';
    }
    return payload.eventTimeframe || payload.eventDateLabel;
  }

  protected ticketScannerResultAvatarUrl(): string {
    return this.ticketPayloadAvatarUrl(this.ticketScannerResult);
  }

  protected ticketScannerResultInitials(): string {
    if (!this.ticketScannerResult) {
      return '';
    }
    return this.ticketPayloadInitials(this.ticketScannerResult);
  }

  protected shouldShowTicketGroupMarker(groupIndex: number): boolean {
    if (groupIndex > 0) {
      return true;
    }
    return this.isTicketListScrollableNow();
  }

  protected readonly calendarWeekdayLabels = APP_STATIC_DATA.calendarWeekdayLabels;
  protected readonly calendarWeekHours = Array.from(
    { length: this.weekCalendarEndHour - this.weekCalendarStartHour + 1 },
    (_, index) => this.weekCalendarStartHour + index
  );

  protected isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }

  protected get calendarMonthPages(): AppTypes.CalendarMonthPage[] {
    if (this.activitiesView !== 'month') {
      return [];
    }
    const rows = this.filteredActivityRows;
    const resolveActivityDateRange = (row: AppTypes.ActivityListRow) =>
      AppCalendarHelpers.activityDateRange(row, this.activityDateTimeRangeById);
    const monthAnchors = this.monthAnchorsForRows(rows);
    const cacheKey = [
      this.activeUserId,
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
      this.activeUserId,
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

  protected get activitiesStickyHeader(): string {
    if (this.activitiesStickyValue) {
      return this.activitiesStickyValue;
    }
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

  protected isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  protected isActivityChatRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'chats';
  }

  protected activityRowAvatarInitials(row: AppTypes.ActivityListRow): string {
    if (row.type === 'rates') {
      const rate = row.source as RateMenuItem;
      return this.users.find(user => user.id === rate.userId)?.initials ?? 'U';
    }
    const source = row.source;
    if ('avatar' in source && source.avatar) {
      return source.avatar.slice(0, 2).toUpperCase();
    }
    return this.activeUser.initials;
  }

  protected activityRowAvatarClass(row: AppTypes.ActivityListRow): string {
    if (row.type === 'rates') {
      const rate = row.source as RateMenuItem;
      const gender = this.users.find(user => user.id === rate.userId)?.gender ?? 'woman';
      return `user-color-${gender}`;
    }
    if (row.type === 'chats') {
      const chat = row.source as ChatMenuItem;
      const gender = this.getChatLastSender(chat).gender;
      return `user-color-${gender}`;
    }
    return 'user-color-man';
  }

  protected onActivitiesScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.updateActivitiesStickyHeader(target.scrollTop || 0);
    this.updateActivitiesHeaderProgress();
    this.maybeLoadMoreActivities(target);
  }

  protected closeActivityRateEditorFromUserScroll(): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    this.clearActivityRateEditorState(true);
    this.releaseActiveElementFocus();
  }

  protected areCalendarBadgesReady(pageKey: string): boolean {
    if (!this.isCalendarLayoutView()) {
      return true;
    }
    return this.activitiesCalendarBadgesReadyDelayKeys.has(this.calendarBadgeDelayKey(pageKey));
  }

  protected selectActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates' || filter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesPrimaryFilter = filter;
    this.hostingPublicationFilter = 'all';
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.activitiesChatContextFilter = 'all';
    if (filter !== 'rates') {
      this.disableActivitiesRatesFullscreenMode();
    }
    if (filter === 'rates') {
      this.activitiesView = 'distance';
      this.selectedActivityRateId = null;
    } else if (filter === 'chats') {
      this.activitiesView = 'day';
      this.selectedActivityRateId = null;
    } else {
      this.selectedActivityRateId = null;
    }
    this.releaseActiveElementFocus();
    this.resetActivitiesScroll();
  }

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    this.activitiesChatContextFilter = filter;
    this.releaseActiveElementFocus();
    this.resetActivitiesScroll();
  }

  protected selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (this.activitiesPrimaryFilter !== 'hosting' || this.hostingPublicationFilter === filter) {
      return;
    }
    this.hostingPublicationFilter = filter;
    this.releaseActiveElementFocus();
    this.resetActivitiesScroll();
  }

  protected isHostingPublicationFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'hosting';
  }

  protected hostingDraftCount(): number {
    return this.eventItems.filter(item => item.isAdmin && !this.isHostingPublished(item.id)).length;
  }

  protected selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesSecondaryFilter = filter;
    this.showActivitiesSecondaryPicker = false;
    this.releaseActiveElementFocus();
    this.resetActivitiesScroll();
  }

  protected selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this.stopActivitiesRatesPairSplitDrag();
    this.activitiesRateFilter = filter;
    this.commitPendingRateDirectionOverrides(filter);
    this.selectedActivityRateId = null;
    if (this.activitiesRatesFullscreenMode) {
      this.activitiesRatesFullscreenLeavingRow = null;
      this.activitiesRatesFullscreenCardIndex = 0;
      this.syncActivitiesRatesFullscreenSelection();
    }
    this.showActivitiesSecondaryPicker = false;
    this.releaseActiveElementFocus();
    this.resetActivitiesScroll();
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
    this.maybeStartActivitiesRatesFullscreenPaginationLoad();
    this.refreshActivitiesHeaderProgressSoon();
  }

  protected toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      this.showActivitiesViewPicker = false;
      return;
    }
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesViewPicker = !this.showActivitiesViewPicker;
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      this.showActivitiesSecondaryPicker = false;
      return;
    }
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = !this.showActivitiesSecondaryPicker;
  }

  protected setActivitiesView(view: AppTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesView = view;
    if (view !== 'distance') {
      this.disableActivitiesRatesFullscreenMode();
    }
    this.calendarMonthAnchorPages = null;
    this.calendarWeekAnchorPages = null;
    this.calendarInitialPageIndexOverride = null;
    this.calendarMonthAnchorsHydrated = false;
    this.calendarWeekAnchorsHydrated = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.resetActivitiesScroll(view === 'month' || view === 'week');
  }

  protected toggleEventExploreOrderPicker(event: Event): void {
    event.stopPropagation();
    this.showEventExploreOrderPicker = !this.showEventExploreOrderPicker;
  }

  protected selectEventExploreOrder(order: AppTypes.EventExploreOrder, event?: Event): void {
    event?.stopPropagation();
    this.eventExploreOrder = order;
    this.showEventExploreOrderPicker = false;
    this.eventExploreStickyValue = '';
    this.resetEventExploreScroll();
  }

  protected toggleEventExploreFriendsOnly(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterFriendsOnly = !this.eventExploreFilterFriendsOnly;
    this.eventExploreStickyValue = '';
    this.resetEventExploreScroll();
  }

  protected toggleEventExploreHasRooms(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterHasRooms = !this.eventExploreFilterHasRooms;
    this.eventExploreStickyValue = '';
    this.resetEventExploreScroll();
  }

  protected openEventExploreTopicFilterPopup(event: Event): void {
    event.stopPropagation();
    this.superStackedPopup = 'eventExploreTopicFilter';
  }

  protected closeEventExploreTopicFilterPopup(): void {
    if (this.superStackedPopup === 'eventExploreTopicFilter') {
      this.superStackedPopup = null;
    }
  }

  protected selectEventExploreTopicFilter(topic: string, event?: Event): void {
    event?.stopPropagation();
    const nextTopic = AppUtils.normalizeText(topic) === AppUtils.normalizeText(this.eventExploreFilterTopic) ? '' : topic;
    this.eventExploreFilterTopic = nextTopic;
    this.eventExploreStickyValue = '';
    this.resetEventExploreScroll();
  }

  protected eventExploreTopicFilterLabel(): string {
    if (!this.eventExploreFilterTopic) {
      return 'Topic';
    }
    return `#${this.eventExploreTopicLabel(this.eventExploreFilterTopic)}`;
  }

  protected get eventExploreTopicFilterGroups(): Array<{ title: string; shortTitle: string; icon: string; toneClass: string; options: string[] }> {
    return this.interestOptionGroups.map(group => ({
      title: group.title,
      shortTitle: group.shortTitle,
      icon: group.icon,
      toneClass: group.toneClass,
      options: [...group.options]
    }));
  }

  protected eventExploreOrderLabel(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.label ?? 'Upcoming';
  }

  protected eventExploreOrderIcon(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.icon ?? 'event_upcoming';
  }

  protected eventExploreOrderClass(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    if (order === 'upcoming') {
      return 'event-explore-order-upcoming';
    }
    if (order === 'past-events') {
      return 'event-explore-order-past-events';
    }
    if (order === 'nearby') {
      return 'event-explore-order-nearby';
    }
    if (order === 'top-rated') {
      return 'event-explore-order-top-rated';
    }
    return 'event-explore-order-most-relevant';
  }

  protected get eventExploreStickyHeader(): string {
    if (this.eventExploreStickyValue) {
      return this.eventExploreStickyValue;
    }
    return this.eventExploreGroupedCards[0]?.label ?? 'No items';
  }

  protected onEventExploreScroll(event: Event): void {
    const scrollElement = event.target as HTMLElement;
    this.updateEventExploreStickyFromScroll(scrollElement);
    this.updateEventExploreHeaderProgress();
    this.maybeLoadMoreEventExplore(scrollElement);
  }

  private updateEventExploreStickyFromScroll(scrollElement: HTMLElement): void {
    const groups = this.eventExploreGroupedCards;
    if (groups.length === 0) {
      this.eventExploreStickyValue = 'No items';
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.event-explore-sticky-header');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = (scrollElement.scrollTop || 0) + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.event-explore-card[data-event-explore-group-label]'));
    if (rows.length === 0) {
      this.eventExploreStickyValue = groups[0].label;
      return;
    }
    const scrollTop = scrollElement.scrollTop || 0;
    if (scrollTop <= 1) {
      this.eventExploreStickyValue = rows[0].dataset['eventExploreGroupLabel'] ?? groups[0].label;
      return;
    }
    const alignmentTolerancePx = 2;
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - alignmentTolerancePx) ??
      rows[rows.length - 1];
    this.eventExploreStickyValue = activeRow.dataset['eventExploreGroupLabel'] ?? groups[0].label;
  }

  protected get eventExploreCards(): AppTypes.EventExploreCard[] {
    const cards = this.buildEventExploreCardsBase();
    this.ensureEventExplorePaginationState(cards.length);
    if (this.eventExploreInitialLoadPending) {
      return [];
    }
    return cards.slice(0, Math.min(this.eventExploreVisibleCount, cards.length));
  }

  private buildEventExploreCardsBase(): AppTypes.EventExploreCard[] {
    const now = Date.now();
    const eventExploreContext = {
      eventDatesById: this.eventDatesById,
      hostingDatesById: this.hostingDatesById,
      eventDistanceById: this.eventDistanceById,
      hostingDistanceById: this.hostingDistanceById,
      activityImageById: this.activityImageById,
      defaultStartIso: this.defaultEventStartIso()
    };
    const events: AppTypes.EventExploreCard[] = this.eventItems.map(item =>
      AppDemoGenerators.toEventExploreCard(item, 'event', now, eventExploreContext)
    );
    const hosting: AppTypes.EventExploreCard[] = this.hostingItems.map(item =>
      AppDemoGenerators.toEventExploreCard(item, 'hosting', now, eventExploreContext)
    );
    const selectedTopic = AppUtils.normalizeText(this.eventExploreTopicLabel(this.eventExploreFilterTopic));
    const cards = [...events, ...hosting]
      .filter(card => this.eventExploreVisibilityRaw(card) !== 'Invitation only')
      .filter(card => !this.eventExploreFilterFriendsOnly || this.eventExploreFriendsGoingMatch(card))
      .filter(card => !this.eventExploreFilterHasRooms || this.eventExploreHasRooms(card))
      .filter(card => !selectedTopic || this.eventExploreTopics(card).some(topic => AppUtils.normalizeText(this.eventExploreTopicLabel(topic)) === selectedTopic));

    if (this.eventExploreOrder === 'upcoming') {
      return [...cards].sort((a, b) => {
        if (a.isPast !== b.isPast) {
          return Number(a.isPast) - Number(b.isPast);
        }
        return a.startSort - b.startSort;
      });
    }
    if (this.eventExploreOrder === 'past-events') {
      return [...cards].sort((a, b) => {
        if (a.isPast !== b.isPast) {
          return Number(b.isPast) - Number(a.isPast);
        }
        return b.startSort - a.startSort;
      });
    }
    if (this.eventExploreOrder === 'nearby') {
      return [...cards].sort((a, b) => a.distanceKm - b.distanceKm || b.relevance - a.relevance);
    }
    if (this.eventExploreOrder === 'top-rated') {
      return [...cards].sort((a, b) => b.rating - a.rating || b.relevance - a.relevance);
    }
    return [...cards].sort((a, b) => b.relevance - a.relevance || a.startSort - b.startSort);
  }

  protected get eventExploreGroupedCards(): AppTypes.EventExploreGroup[] {
    const cards = this.eventExploreCards;
    const grouped: AppTypes.EventExploreGroup[] = [];
    for (const card of cards) {
      const label = this.eventExploreGroupLabel(card);
      const lastGroup = grouped[grouped.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        grouped.push({ label, cards: [card] });
        continue;
      }
      lastGroup.cards.push(card);
    }
    return grouped;
  }

  protected eventExploreCreatorInitials(card: AppTypes.EventExploreCard): string {
    const source = this.resolveEventExploreSource(card);
    if (!source?.avatar) {
      return AppUtils.initialsFromText(card.title);
    }
    return AppUtils.initialsFromText(source.avatar);
  }

  protected eventExploreCreatorToneClass(card: AppTypes.EventExploreCard): string {
    const rating = AppUtils.clampNumber(card.rating, 0, 10);
    if (rating <= 3.0) {
      return 'event-explore-rating-cool';
    }
    if (rating <= 5.5) {
      return 'event-explore-rating-cool-mid';
    }
    if (rating <= 7.2) {
      return 'event-explore-rating-neutral';
    }
    if (rating <= 8.6) {
      return 'event-explore-rating-warm-mid';
    }
    return 'event-explore-rating-warm';
  }

  protected eventExploreCreatorAvatarToneClass(card: AppTypes.EventExploreCard): string {
    const toneIndex = (AppDemoGenerators.hashText(`${card.sourceType}:${card.id}:${this.eventExploreCreatorInitials(card)}`) % 8) + 1;
    return `activities-source-tone-${toneIndex}`;
  }

  protected eventExploreVisibility(card: AppTypes.EventExploreCard): AppTypes.EventVisibility {
    return this.eventExploreVisibilityRaw(card);
  }

  protected eventExploreVisibilityCircleClass(card: AppTypes.EventExploreCard): string {
    return `experience-item-icon-${this.eventVisibilityClass(this.eventExploreVisibility(card))}`;
  }

  protected eventExploreHasRooms(card: AppTypes.EventExploreCard): boolean {
    const metrics = this.eventExploreCapacityMetrics(card);
    return metrics.total > metrics.current;
  }

  protected eventExploreIsFull(card: AppTypes.EventExploreCard): boolean {
    const metrics = this.eventExploreCapacityMetrics(card);
    return metrics.total > 0 && metrics.current >= metrics.total;
  }

  protected eventExploreHasFriendGoing(card: AppTypes.EventExploreCard): boolean {
    const row = this.eventExploreRow(card);
    if (!row) {
      return false;
    }
    return this.getActivityMembersByRow(row).some(member =>
      member.status === 'accepted'
      && member.userId !== this.activeUser.id
      && AppDemoGenerators.isFriendOfActiveUser(member.userId, this.activeUser.id)
    );
  }

  protected eventExploreFriendsGoingMatch(card: AppTypes.EventExploreCard): boolean {
    return this.eventExploreVisibilityRaw(card) !== 'Invitation only' && this.eventExploreHasFriendGoing(card);
  }

  protected isEventExploreOpenEvent(card: AppTypes.EventExploreCard): boolean {
    return this.eventExploreBlindMode(card) === 'Open Event';
  }

  protected eventExploreBlindMode(card: AppTypes.EventExploreCard): AppTypes.EventBlindMode {
    return this.eventBlindModeById[card.id] ?? 'Open Event';
  }

  protected eventExploreMembersVisibilityIcon(card: AppTypes.EventExploreCard): string {
    return this.eventBlindModeIcon(this.eventExploreBlindMode(card));
  }

  protected eventExploreMembersVisibilityClass(card: AppTypes.EventExploreCard): string {
    return this.eventBlindModeClass(this.eventExploreBlindMode(card));
  }

  protected eventExploreMembersLabel(card: AppTypes.EventExploreCard): string {
    const metrics = this.eventExploreCapacityMetrics(card);
    if (metrics.total <= 0) {
      return '0 / 0';
    }
    return `${metrics.current} / ${metrics.total}`;
  }

  protected eventExploreOpenSpots(card: AppTypes.EventExploreCard): number {
    const metrics = this.eventExploreCapacityMetrics(card);
    return Math.max(0, metrics.total - metrics.current);
  }

  private eventExploreCapacityMetrics(card: AppTypes.EventExploreCard): { current: number; total: number } {
    const row = this.eventExploreRow(card);
    if (!row) {
      return { current: 0, total: 0 };
    }
    const current = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const total = this.activityCapacityTotal(row, current);
    return { current, total };
  }

  private eventExploreGroupLabel(card: AppTypes.EventExploreCard): string {
    if (this.eventExploreOrder === 'nearby') {
      const bucket = Math.max(5, Math.ceil(card.distanceKm / 5) * 5);
      return `${bucket} km`;
    }
    if (this.eventExploreOrder === 'top-rated') {
      const bucket = Math.max(1, Math.min(10, Math.round(AppUtils.clampNumber(card.rating, 0, 10))));
      return `${bucket} / 10`;
    }
    const parsed = new Date(card.startSort);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  protected openEventExploreMembers(card: AppTypes.EventExploreCard, event: Event): void {
    event.stopPropagation();
    const row = this.eventExploreRow(card);
    if (!row) {
      return;
    }
    this.openActivityMembers(row, event, 'explore');
  }

  protected openEventExploreHostImpressions(event: Event): void {
    event.stopPropagation();
    if (this.stackedPopup === 'eventExplore') {
      this.superStackedPopup = 'impressionsHost';
      return;
    }
    if (this.activePopup === 'eventExplore') {
      this.stackedPopup = 'impressionsHost';
      return;
    }
    this.openHostImpressions();
  }

  protected closeSuperStackedImpressions(): void {
    if (this.superStackedPopup === 'impressionsHost') {
      this.superStackedPopup = null;
    }
  }

  protected eventExploreTopics(card: AppTypes.EventExploreCard): string[] {
    const source = this.resolveEventExploreSource(card);
    if (!source) {
      return [];
    }
    const pool = Array.from(new Set(this.interestOptionGroups.flatMap(group => group.options)));
    if (pool.length === 0) {
      return [];
    }
    const seed = AppDemoGenerators.hashText(`${card.sourceType}:${card.id}:${source.title}`);
    const count = 2 + (seed % 2);
    const result: string[] = [];
    for (let index = 0; index < pool.length && result.length < count; index += 1) {
      const candidate = pool[(seed + (index * 3)) % pool.length];
      if (!result.includes(candidate)) {
        result.push(candidate);
      }
    }
    return result;
  }

  protected eventExploreTopicLabel(topic: string): string {
    return topic.replace(/^#+\s*/, '');
  }

  protected toggleEventExploreItemActionMenu(card: AppTypes.EventExploreCard, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenu?.scope === 'explore' && this.inlineItemActionMenu.id === card.id) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = { scope: 'explore', id: card.id, title: card.title, openUp: this.shouldOpenInlineItemMenuUp(event) };
  }

  protected isEventExploreItemActionMenuOpen(card: AppTypes.EventExploreCard): boolean {
    return this.inlineItemActionMenu?.scope === 'explore' && this.inlineItemActionMenu.id === card.id;
  }

  protected isEventExploreItemActionMenuOpenUp(card: AppTypes.EventExploreCard): boolean {
    return this.inlineItemActionMenu?.scope === 'explore'
      && this.inlineItemActionMenu.id === card.id
      && this.inlineItemActionMenu.openUp;
  }

  protected runEventExploreViewAction(card: AppTypes.EventExploreCard, stacked: boolean, event: Event): void {
    event.stopPropagation();
    const source = this.resolveEventExploreSource(card);
    if (!source) {
      this.inlineItemActionMenu = null;
      return;
    }
    if (card.sourceType === 'hosting') {
      this.openHostingItem(source as HostingMenuItem, false, stacked);
    } else {
      this.openEventItem(source as EventMenuItem, false, stacked);
    }
    this.inlineItemActionMenu = null;
  }

  protected runEventExploreJoinAction(card: AppTypes.EventExploreCard, event: Event): void {
    event.stopPropagation();
    this.alertService.open(`Join request for ${card.title} is ready for backend wiring.`);
    this.inlineItemActionMenu = null;
  }

  protected activityViewLabel(): string {
    return this.activitiesViewOptions.find(option => option.key === this.activitiesView)?.label ?? 'View';
  }

  protected activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find(option => option.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }

  protected activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find(option => option.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }

  protected activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find(option => option.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }

  protected activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find(option => option.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }

  protected activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.activitiesSecondaryFilter);
  }

  protected activitiesSecondaryFilterOptionLabel(filter: AppTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(option => option.key === filter)?.label ?? 'Relevant';
  }

  protected activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(option => option.key === this.activitiesSecondaryFilter)?.icon ?? 'schedule';
  }

  protected activitiesRateFilterLabel(): string {
    const filter = this.rateFilters.find(option => option.key === this.activitiesRateFilter);
    if (!filter) {
      return 'Single · Given';
    }
    const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    return `${group} · ${filter.label}`;
  }

  protected activitiesRateFilterIcon(key: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    switch (key) {
      case 'individual-given':
        return 'north_east';
      case 'individual-received':
        return 'south_west';
      case 'individual-mutual':
        return 'sync_alt';
      case 'individual-met':
        return 'handshake';
      case 'pair-given':
        return 'group_add';
      case 'pair-received':
        return 'groups_2';
      default:
        return 'star';
    }
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

  protected selectedRateFilterCount(): number {
    return this.rateFilterCount(this.activitiesRateFilter);
  }

  protected totalRateFilterCount(): number {
    return this.rateItems.length;
  }

  protected activitiesPrimaryFilterCount(filter: AppTypes.ActivitiesPrimaryFilter): number {
    if (filter === 'rates') {
      return this.gameBadge;
    }
    if (filter === 'chats') {
      return this.chatBadge;
    }
    if (filter === 'invitations') {
      return this.invitationsBadge;
    }
    if (filter === 'events') {
      return this.eventsBadge;
    }
    return this.hostingBadge;
  }

  protected activitiesPrimaryFilterClass(filter: AppTypes.ActivitiesPrimaryFilter = this.activitiesPrimaryFilter): string {
    if (filter === 'chats') {
      return 'activity-filter-chat';
    }
    if (filter === 'invitations') {
      return 'activity-filter-invitations';
    }
    if (filter === 'events') {
      return 'activity-filter-events';
    }
    if (filter === 'hosting') {
      return 'activity-filter-hosting';
    }
    return 'activity-filter-rates';
  }

  protected activitiesChatContextFilterCount(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return 0;
    }
    return this.chatItemsForActivities().filter(item => {
      if (filter === 'all') {
        return true;
      }
      const key = this.activityChatContextFilterKey(item);
      return key === filter;
    }).length;
  }

  protected activitiesChatContextFilterClass(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): string {
    if (filter === 'event') {
      return 'chat-context-filter-event';
    }
    if (filter === 'subEvent') {
      return 'chat-context-filter-sub-event';
    }
    if (filter === 'group') {
      return 'chat-context-filter-group';
    }
    return 'chat-context-filter-all';
  }

  protected activitiesSecondaryFilterClass(filter: AppTypes.ActivitiesSecondaryFilter = this.activitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return 'activity-filter-secondary';
    }
    if (filter === 'relevant') {
      return 'activity-filter-secondary';
    }
    return 'activity-filter-secondary';
  }

  protected activitiesRateFilterClass(filter: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    return filter.startsWith('individual') ? 'activity-filter-rates' : 'activity-filter-rates';
  }

  protected activitiesHeaderSelectionLine(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    const secondary = this.activitiesSecondaryFilterLabel();
    if (this.activitiesPrimaryFilter === 'rates') {
      return `${primary} · ${secondary} · ${this.activitiesRateFilterLabel()}`;
    }
    return `${primary} · ${secondary}`;
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

  protected activitiesRatesFullscreenEmptyTitle(): string {
    if (this.activitiesRatesFullscreenAllRows().length > 0) {
      return 'No cards available';
    }
    if (this.activitiesHeaderProgressLoading) {
      return 'Loading more cards';
    }
    return 'No items';
  }

  protected activitiesRatesFullscreenEmptyDescription(): string {
    if (this.activitiesRatesFullscreenAllRows().length > 0) {
      return 'Wait for more cards to load or adjust the rate filter.';
    }
    if (this.activitiesHeaderProgressLoading) {
      return 'Preloading the next stack in the background.';
    }
    return this.activitiesEmptyLabel;
  }

  private activitiesChatsHeaderLabel(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.activitiesChatContextFilter === 'all') {
      return primary;
    }
    return `${primary} · ${this.activitiesChatContextFilterLabel()}`;
  }

  protected activitiesPrimaryPanelWidth(): string {
    return '260px';
  }

  protected activitiesRatePanelWidth(): string {
    return '320px';
  }

  protected assetFilterPanelWidth(): string {
    return '248px';
  }

  protected onActivityRowClick(row: AppTypes.ActivityListRow, event?: Event): void {
    this.openActivityRow(row, event);
  }

  protected onActivityRowPointerUp(row: AppTypes.ActivityListRow, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.openActivityRow(row, event);
  }

  private openActivityRow(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    const key = `${row.type}:${row.id}`;
    const now = Date.now();
    if (this.lastActivityOpenKey === key && now - this.lastActivityOpenAt < 220) {
      return;
    }
    this.lastActivityOpenKey = key;
    this.lastActivityOpenAt = now;
    if (row.type === 'chats') {
      this.openChatItem(row.source as ChatMenuItem, false, true);
      return;
    }
    if (row.type === 'invitations') {
      this.openInvitationItem(row.source as InvitationMenuItem, false, true);
      return;
    }
    if (row.type === 'events') {
      this.openEventItem(row.source as EventMenuItem, false, true);
      return;
    }
    if (row.type === 'hosting') {
      this.openHostingItem(row.source as HostingMenuItem, false, true);
      return;
    }
    this.selectedActivityRateId = null;
  }

  protected activityChatMemberCount(row: AppTypes.ActivityListRow): number {
    if (row.type !== 'chats') {
      return 0;
    }
    return this.getChatMemberCount(row.source as ChatMenuItem);
  }

  protected isEventStyleActivity(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'hosting' || row.type === 'invitations';
  }

  protected isRateStyleActivity(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'rates';
  }

  protected trackByRateCardImage(index: number, imageUrl: string): string {
    return `${index}-${imageUrl}`;
  }

  protected trackByActivityGroup(index: number, group: AppTypes.ActivityGroup): string {
    return `${index}:${group.label}`;
  }

  protected trackByActivityRow(index: number, row: AppTypes.ActivityListRow): string {
    return `${row.type}:${row.id}`;
  }

  protected trackByIndex(index: number): number {
    return index;
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
    // Keep template checks deterministic; live DOM reads here can flip during a single
    // change-detection pass and trigger NG0100 in dev mode.
    return this.activitiesListScrollable;
  }

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

  protected isActivityRateCardImageLoading(row: AppTypes.ActivityListRow): boolean {
    return this.activityRateCardImageLoadingById[row.id] === true;
  }

  protected selectActivityRateCardImage(row: AppTypes.ActivityListRow, imageIndex: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedActivityRateId && this.selectedActivityRateId !== row.id) {
      this.clearActivityRateEditorState();
    }
    const images = this.activityRateCardImageUrls(row);
    if (images.length === 0) {
      return;
    }
    const nextIndex = AppUtils.clampNumber(imageIndex, 0, images.length - 1);
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
    }, 500);
  }

  protected activityRateCardPrimaryLine(row: AppTypes.ActivityListRow, cardIndex: number): string {
    const line = this.activityRateCardLines(row, cardIndex);
    return line.primary;
  }

  protected activityRateCardSecondaryLine(row: AppTypes.ActivityListRow, cardIndex: number): string {
    const line = this.activityRateCardLines(row, cardIndex);
    return line.secondary;
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
      { primary: `${user.name}, ${user.age}`, secondary: `${user.city} · ${row.distanceKm} km` }
    ];
    const pushCard = (privacy: AppTypes.DetailPrivacy, primary: string, secondary: string) => {
      const normalizedPrimary = primary.trim();
      const normalizedSecondary = secondary.trim();
      if (!normalizedPrimary || !normalizedSecondary) {
        return;
      }
      if (!this.canViewRateCardDetail(user, privacy)) {
        return;
      }
      cards.push({ primary: normalizedPrimary, secondary: normalizedSecondary });
    };

    // Card #1 is fixed, then use profile details by importance while respecting row visibility.
    const pushProfilePair = (
      primaryLabel: string,
      secondaryLabel: string,
      primaryPrefix = '',
      secondaryPrefix = ''
    ): void => {
      const primaryValue = this.visibleProfileDetailValue(user, primaryLabel);
      const secondaryValue = this.visibleProfileDetailValue(user, secondaryLabel);
      if (!primaryValue || !secondaryValue) {
        return;
      }
      const primary = primaryPrefix ? `${primaryPrefix}${primaryValue}` : primaryValue;
      const secondary = secondaryPrefix ? `${secondaryPrefix}${secondaryValue}` : secondaryValue;
      cards.push({ primary, secondary });
    };

    pushProfilePair('Interest', 'Values');
    pushProfilePair('Communication style', 'Love style');
    pushProfilePair('Workout', 'Pets', 'Workout · ');
    pushProfilePair('Languages', 'Horoscope');
    pushProfilePair('Height', 'Physique');
    pushProfilePair('Family plans', 'Children');
    pushProfilePair('Drinking', 'Smoking');
    pushProfilePair('Religion', 'Gender');
    pushProfilePair('Birthday', 'City', 'Birthday · ', '');

    pushCard('Friends', user.traitLabel, user.hostTier);
    pushCard('Public', `${modeLabel} · ${directionLabel}`, `${item.eventName} · ${happenedOn}`);

    const dedupedCards: Array<{ primary: string; secondary: string }> = [];
    const seen = new Set<string>();
    for (const card of cards) {
      const key = `${card.primary}::${card.secondary}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      dedupedCards.push(card);
    }

    if (cardIndex < 0 || cardIndex >= dedupedCards.length) {
      return { primary: '', secondary: '' };
    }
    return dedupedCards[cardIndex] ?? { primary: '', secondary: '' };
  }

  private visibleProfileDetailValue(user: DemoUser, label: string): string {
    const row = this.profileDetailRowByLabel(user.id, label);
    if (!row) {
      return '';
    }
    const value = row.value?.trim();
    if (!value) {
      return '';
    }
    if (!this.canViewRateCardDetail(user, row.privacy)) {
      return '';
    }
    return value;
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

  private canViewRateCardDetail(user: DemoUser, privacy: AppTypes.DetailPrivacy): boolean {
    const isSelf = user.id === this.activeUser.id;
    const isFriend = AppDemoGenerators.isFriendOfActiveUser(user.id, this.activeUser.id);
    const isHost = this.hostingItems.length > 0 || this.eventItems.some(item => item.isAdmin);

    if (user.profileStatus === 'inactive' && !isSelf) {
      return privacy === 'Public';
    }

    if (user.profileStatus === 'friends only' && !isSelf && !isFriend) {
      return privacy === 'Public';
    }

    if (user.profileStatus === 'host only' && !isSelf && !isHost) {
      return privacy === 'Public';
    }

    if (privacy === 'Public') {
      return true;
    }
    if (privacy === 'Friends') {
      return isSelf || isFriend || isHost;
    }
    if (privacy === 'Hosts') {
      return isSelf || isHost;
    }
    return isSelf;
  }

  protected activityRateCardHasLine(row: AppTypes.ActivityListRow, cardIndex: number): boolean {
    const card = this.activityRateCardLines(row, cardIndex);
    return card.primary.length > 0 && card.secondary.length > 0;
  }

  protected activityRateCardContentClasses(row: AppTypes.ActivityListRow): string[] {
    const item = row.source as RateMenuItem;
    const directionClass = this.displayedRateDirection(item);
    return [
      item.mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
      `activities-rate-profile-stack-${directionClass}`
    ];
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

  protected activityPairRateSlotActiveImageIndex(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): number {
    const images = this.activityPairRateSlotImageUrls(row, gender);
    if (images.length === 0) {
      return 0;
    }
    const key = this.activityPairRateSlotImageKey(row.id, gender);
    const current = this.activityPairRateCardActiveImageIndexByKey[key] ?? 0;
    return AppUtils.clampNumber(current, 0, images.length - 1);
  }

  protected activityPairRateSlotActiveImageUrl(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): string {
    const images = this.activityPairRateSlotImageUrls(row, gender);
    if (images.length === 0) {
      return '';
    }
    return images[this.activityPairRateSlotActiveImageIndex(row, gender)] ?? images[0] ?? '';
  }

  protected isActivityPairRateSlotImageLoading(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): boolean {
    const key = this.activityPairRateSlotImageKey(row.id, gender);
    return this.activityPairRateCardImageLoadingByKey[key] === true;
  }

  protected selectActivityPairRateSlotImage(
    row: AppTypes.ActivityListRow,
    gender: DemoUser['gender'],
    imageIndex: number,
    event?: Event
  ): void {
    event?.stopPropagation();
    const images = this.activityPairRateSlotImageUrls(row, gender);
    if (images.length === 0) {
      return;
    }
    const key = this.activityPairRateSlotImageKey(row.id, gender);
    const nextIndex = AppUtils.clampNumber(imageIndex, 0, images.length - 1);
    this.activityPairRateCardActiveImageIndexByKey[key] = nextIndex;
    if (this.activityPairRateCardLoadingTimerByKey[key]) {
      clearTimeout(this.activityPairRateCardLoadingTimerByKey[key]);
      delete this.activityPairRateCardLoadingTimerByKey[key];
    }
    this.activityPairRateCardImageLoadingByKey[key] = true;
    this.activityPairRateCardLoadingTimerByKey[key] = setTimeout(() => {
      this.activityPairRateCardImageLoadingByKey[key] = false;
      delete this.activityPairRateCardLoadingTimerByKey[key];
    }, 500);
  }

  protected activityPairRateSlotPrimaryLine(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): string {
    const user = this.activityPairRateSlotUser(row, gender);
    if (!user) {
      return `${gender === 'woman' ? 'Woman' : 'Man'} · waiting`;
    }
    return `${user.name}, ${user.age}`;
  }

  protected activityPairRateSlotSecondaryLine(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): string {
    const user = this.activityPairRateSlotUser(row, gender);
    if (!user) {
      return 'No pair card yet';
    }
    return `${user.city} · ${row.distanceKm} km`;
  }

  protected activityPairRateSlotInitials(row: AppTypes.ActivityListRow, gender: DemoUser['gender']): string {
    const user = this.activityPairRateSlotUser(row, gender);
    if (!user) {
      return '∅';
    }
    return AppUtils.initialsFromText(user.name);
  }

  private activityPairRateSlotImageKey(rowId: string, gender: DemoUser['gender']): string {
    return `${rowId}:${gender}`;
  }

  private profilePortraitUrlForUser(user: DemoUser, index: number, context: string): string {
    const safeGender = user.gender === 'woman' ? 'women' : 'men';
    const seed = AppDemoGenerators.hashText(`portrait:${context}:${user.id}:${index}`);
    const pictureIndex = seed % 100;
    return `https://randomuser.me/api/portraits/${safeGender}/${pictureIndex}.jpg`;
  }

  private rateCardSeedImageUrl(
    rowId: string,
    userId: string,
    gender: DemoUser['gender'],
    index: number
  ): string {
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

  protected activityRateBadgeLabel(row: AppTypes.ActivityListRow): string {
    const ownLabel = this.activityOwnRatingLabel(row);
    return ownLabel ? ownLabel : 'Rate';
  }

  protected isSelectedActivityRateRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'rates' && this.isActivityRateEditorOpen() && this.selectedActivityRateId === row.id;
  }

  protected isActivityRateBlinking(row: AppTypes.ActivityListRow): boolean {
    const until = this.activityRateBlinkUntilByRowId[row.id] ?? 0;
    return until > Date.now();
  }

  protected isPairReceivedRateRow(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'rates') {
      return false;
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair' && this.displayedRateDirection(item) === 'received';
  }

  protected isPairRateRow(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'rates') {
      return false;
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair';
  }

  protected get activitiesRatesPairSplitCssValue(): string {
    if (!this.isActivitiesRatesPairCompactViewport()) {
      return `${App.ACTIVITIES_RATES_PAIR_SPLIT_DEFAULT_PERCENT}%`;
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

  protected isSelectedActivityRateReadOnly(): boolean {
    const row = this.isRatesFullscreenModeActive()
      ? this.currentActivitiesRatesFullscreenRow()
      : this.selectedActivityRateRow();
    return !!row && this.isPairReceivedRateRow(row);
  }

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
    this.activityRateEditorClosing = false;
    this.runAfterActivitiesRender(() => {
      setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(row.id), 40);
      if (!wasOpen) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(row.id), this.activityRateEditorSlideDurationMs + 40);
      }
    });
  }

  protected onActivitiesPopupSurfaceClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    this.maybeDismissActivityRateEditor(target);
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
    // Trigger at most once per currently loaded stack size.
    if (loadedCount <= this.activitiesRatesFullscreenLastTriggeredLoadedCount) {
      return;
    }
    // Mirror game-stack probing behavior: even when no unseen local cards are known,
    // still run a loading cycle near the end.
    const allowEmptyResponse = loadedCount >= allRows.length;
    this.activitiesRatesFullscreenLastTriggeredLoadedCount = loadedCount;
    this.startActivitiesPaginationLoad(allowEmptyResponse);
  }

  protected isActivityRateEditorOpen(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      return true;
    }
    return this.activePopup === 'activities' && this.activitiesPrimaryFilter === 'rates' && !!this.selectedActivityRateId && !this.activityRateEditorClosing;
  }

  protected isActivityRateEditorDockVisible(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      if (this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
        return false;
      }
      return this.currentActivitiesRatesFullscreenRow() !== null;
    }
    return this.activePopup === 'activities' && this.activitiesPrimaryFilter === 'rates' && (!!this.selectedActivityRateId || this.activityRateEditorClosing);
  }

  protected isActivityRateEditorClosing(): boolean {
    return this.activityRateEditorClosing;
  }

  protected currentActivitiesRatesFullscreenRow(): AppTypes.ActivityListRow | null {
    if (!this.isRatesFullscreenModeActive()) {
      return null;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      this.selectedActivityRateId = null;
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
      return null;
    }
    const row = allRows[this.activitiesRatesFullscreenCardIndex] ?? null;
    if (!row) {
      this.selectedActivityRateId = null;
      return null;
    }
    if (!this.activitiesRatesFullscreenAnimating && this.selectedActivityRateId !== row.id) {
      this.selectedActivityRateId = row.id;
    }
    return row;
  }

  protected isActivitiesRatesFullscreenAnimating(): boolean {
    return this.activitiesRatesFullscreenAnimating;
  }

  protected activitiesRatesFullscreenHeaderLabel(): string {
    const currentRow = this.currentActivitiesRatesFullscreenRow();
    if (!currentRow) {
      return this.activitiesStickyHeader;
    }
    const group = this.groupedActivityRows.find(candidate => candidate.rows.some(row => row.id === currentRow.id));
    return group?.label ?? this.activitiesStickyHeader;
  }

  protected isSelectedActivityRateInLastRow(): boolean {
    if (!this.isActivityRateEditorOpen() || !this.selectedActivityRateId) {
      return false;
    }
    const scrollElement = this.activitiesScrollRef?.nativeElement;
    if (!scrollElement) {
      return false;
    }
    const targetRow = scrollElement.querySelector<HTMLElement>(
      `[data-activity-rate-row-id="${this.selectedActivityRateId}"]`
    );
    if (!targetRow) {
      return false;
    }
    const rateRows = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.activities-rate-profile-card.activities-row-item')
    );
    if (rateRows.length === 0) {
      return false;
    }
    const lastRowTop = rateRows.reduce((maxTop, row) => Math.max(maxTop, row.offsetTop), 0);
    return targetRow.offsetTop >= lastRowTop - 1;
  }

  protected isSelectedActivityRateScore(score: number): boolean {
    const row = this.selectedActivityRateRow();
    if (!row) {
      return false;
    }
    return score <= this.activityOwnRatingValue(row);
  }

  protected selectedActivityRateTitle(): string {
    return this.selectedActivityRateRow()?.title ?? 'Rate';
  }

  protected selectedActivityRateModeLabel(): string {
    const row = this.selectedActivityRateRow();
    if (!row || row.type !== 'rates') {
      return this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair' ? 'Pair' : 'Single';
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
    // Pair mode has only Given/Received lanes in current UI.
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
      this.activePopup === 'activities' &&
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
    this.updateActivitiesHeaderProgress();
    this.refreshActivitiesHeaderProgressSoon();
  }

  private cancelActivitiesRatesFullscreenAdvance(): void {
    if (this.activitiesRatesFullscreenAdvanceTimer) {
      clearTimeout(this.activitiesRatesFullscreenAdvanceTimer);
      this.activitiesRatesFullscreenAdvanceTimer = null;
    }
  }

  private clearActivityRateBarBlink(): void {
    if (this.activityRateBarBlinkTimeout) {
      clearTimeout(this.activityRateBarBlinkTimeout);
      this.activityRateBarBlinkTimeout = null;
    }
    this.isActivityRateBarBlinking = false;
    this.cdr.markForCheck();
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

  private syncActivitiesRatesFullscreenSelection(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const allRows = this.activitiesRatesFullscreenAllRows();
    if (allRows.length === 0) {
      this.selectedActivityRateId = null;
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
      this.updateActivitiesHeaderProgress();
      return;
    }
    this.selectedActivityRateId = allRows[this.activitiesRatesFullscreenCardIndex]?.id ?? null;
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

  private updateActivitiesRatesPairSplitFromClientX(clientX: number): void {
    if (!this.activitiesRatesPairSplitBounds || this.activitiesRatesPairSplitBounds.width <= 0) {
      return;
    }
    const relative = ((clientX - this.activitiesRatesPairSplitBounds.left) / this.activitiesRatesPairSplitBounds.width) * 100;
    this.activitiesRatesPairSplitPercent = AppUtils.clampNumber(
      relative,
      App.ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT,
      App.ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT
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
      App.ACTIVITIES_RATES_PAIR_SPLIT_MIN_PERCENT,
      App.ACTIVITIES_RATES_PAIR_SPLIT_MAX_PERCENT
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

  private activitiesRatesFullscreenRows(): AppTypes.ActivityListRow[] {
    return this.filteredActivityRows.filter(row => row.type === 'rates');
  }

  private activitiesRatesFullscreenAllRows(): AppTypes.ActivityListRow[] {
    return this.buildFilteredActivityRowsBase().filter(row => row.type === 'rates');
  }

  private maybeDismissActivityRateEditor(target: Element): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    if (
      target.closest('.activities-rate-editor-dock') ||
      target.closest('.activities-rate-score-badge') ||
      target.closest('.activities-rate-profile-card.is-rate-editor-selected')
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

  protected openActivityFromInlineControl(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.onActivityRowClick(row);
  }

  protected toggleActivityItemActionMenu(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenu?.scope === 'activity' && this.inlineItemActionMenu.id === row.id) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = { scope: 'activity', id: row.id, title: row.title, openUp: this.shouldOpenInlineItemMenuUp(event) };
  }

  protected closeInlineItemActionMenu(event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.subEventMemberRolePickerUserId = null;
  }

  protected isActivityItemActionMenuOpen(row: AppTypes.ActivityListRow): boolean {
    return this.inlineItemActionMenu?.scope === 'activity' && this.inlineItemActionMenu.id === row.id;
  }

  protected isActivityItemActionMenuOpenUp(row: AppTypes.ActivityListRow): boolean {
    return this.inlineItemActionMenu?.scope === 'activity'
      && this.inlineItemActionMenu.id === row.id
      && this.inlineItemActionMenu.openUp;
  }

  protected runActivityItemPrimaryAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.openActivityPrimaryAction(row);
    this.inlineItemActionMenu = null;
  }

  protected runActivityItemSecondaryAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.triggerActivitySecondaryAction(row);
    this.inlineItemActionMenu = null;
  }

  protected runActivityItemApproveAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (row.type !== 'invitations') {
      return;
    }
    this.acceptInvitationAndMoveToEvents(row.source as InvitationMenuItem);
    this.inlineItemActionMenu = null;
  }

  protected runActivityItemPublishAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.publishHostingActivity(row, event);
    this.inlineItemActionMenu = null;
  }

  protected runActivityItemViewAction(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.openActivityViewAction(row);
    this.inlineItemActionMenu = null;
  }

  protected canManageActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'invitations' || row.type === 'events' || row.type === 'hosting';
  }

  protected shouldShowActivityPublishAction(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'hosting'
      && row.isAdmin === true
      && this.activitiesPrimaryFilter === 'hosting'
      && this.hostingPublicationFilter === 'drafts'
      && !this.isHostingPublished(row.id);
  }

  protected shouldShowActivityViewAction(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events' && row.isAdmin === true;
  }

  protected activityPrimaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'invitations') {
      return 'visibility';
    }
    return row.isAdmin ? 'edit' : 'visibility';
  }

  protected activityPrimaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'invitations') {
      return 'View Event';
    }
    if (row.isAdmin) {
      return 'Edit Event';
    }
    return 'View Event';
  }

  protected activitySecondaryActionIcon(row: AppTypes.ActivityListRow): string {
    return this.isExitActivityRow(row) ? 'logout' : 'delete';
  }

  protected activitySecondaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (this.isExitActivityRow(row)) {
      return 'Exit';
    }
    if (row.type === 'invitations') {
      return 'Reject';
    }
    return 'Delete';
  }

  protected openActivityPrimaryAction(row: AppTypes.ActivityListRow): void {
    if (row.type === 'invitations') {
      this.openInvitationItem(row.source as InvitationMenuItem, false, true);
      return;
    }
    if (row.type === 'events' || row.type === 'hosting') {
      this.openEventEditor(true, 'edit', row.source as EventMenuItem | HostingMenuItem, row.isAdmin !== true);
      return;
    }
  }

  protected openActivityViewAction(row: AppTypes.ActivityListRow): void {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return;
    }
    this.openEventEditor(true, 'edit', row.source as EventMenuItem | HostingMenuItem, true);
  }

  protected triggerActivitySecondaryAction(row: AppTypes.ActivityListRow): void {
    if (row.type === 'invitations') {
      this.removeInvitationById(row.id);
      if (this.selectedInvitation?.id === row.id) {
        this.selectedInvitation = null;
      }
      if (this.eventEditorInvitationId === row.id) {
        this.eventEditorInvitationId = null;
      }
      this.refreshActivitiesStickyHeaderSoon();
      this.refreshActivitiesHeaderProgressSoon();
      return;
    }
    this.pendingActivityAction = this.isExitActivityRow(row) ? 'exit' : 'delete';
    this.pendingActivityDeleteRow = row;
  }

  protected publishHostingActivity(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    if (!this.shouldShowActivityPublishAction(row)) {
      return;
    }
    this.pendingActivityPublishRow = row;
  }

  protected pendingActivityPublishTitle(): string {
    return 'Publish activity';
  }

  protected pendingActivityPublishLabel(): string {
    if (!this.pendingActivityPublishRow) {
      return '';
    }
    return `Publish ${this.pendingActivityPublishRow.title}?`;
  }

  protected confirmActivityPublish(): void {
    if (!this.pendingActivityPublishRow) {
      return;
    }
    const row = this.pendingActivityPublishRow;
    this.hostingPublishedById[row.id] = true;
    this.ensurePublishedEventChatChannel(row.id, row.title, row.subtitle, this.eventDatesById[row.id] ?? this.defaultEventStartIso());
    this.pendingActivityPublishRow = null;
    this.resetActivitiesScroll();
  }

  protected cancelActivityPublish(): void {
    this.pendingActivityPublishRow = null;
  }

  protected isExitActivityRow(row: AppTypes.ActivityListRow): boolean {
    return (row.type === 'events' || row.type === 'hosting') && row.isAdmin !== true;
  }

  protected openActivityMembers(row: AppTypes.ActivityListRow, event?: Event, source: 'default' | 'explore' = 'default'): void {
    event?.stopPropagation();
    const previousStackedPopup = this.stackedPopup;
    this.subEventAssetMembersContext = null;
    this.activityMembersReadOnly = source === 'explore';
    if (source === 'explore' && previousStackedPopup === 'eventExplore') {
      this.activityMembersPopupOrigin = 'event-explore';
    } else if (source !== 'explore') {
      this.activityMembersPopupOrigin = null;
    }
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

  protected chatMemberActionDate(member: DemoUser): string {
    const seed = AppDemoGenerators.hashText(`${this.selectedChatMembersItem?.id ?? 'chat'}:${member.id}`);
    const when = AppUtils.addDays(new Date('2026-02-25T12:00:00'), -(seed % 28));
    const dateText = when.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
    this.assetCards = this.assetCards.map(card => {
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
    this.assetCards = this.assetCards.map(card => {
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

  protected pendingActivityConfirmTitle(): string {
    return this.pendingActivityAction === 'exit' ? 'Exit activity' : 'Delete activity';
  }

  protected pendingActivityConfirmActionLabel(): string {
    return this.pendingActivityAction === 'exit' ? 'Exit' : 'Delete';
  }

  protected pendingActivityDeleteLabel(): string {
    if (!this.pendingActivityDeleteRow) {
      return '';
    }
    if (this.pendingActivityAction === 'exit') {
      return `Exit ${this.pendingActivityDeleteRow.title}?`;
    }
    return `Delete ${this.pendingActivityDeleteRow.title}?`;
  }

  protected confirmActivityDelete(): void {
    if (!this.pendingActivityDeleteRow) {
      return;
    }
    if (this.pendingActivityAction === 'exit') {
      this.applyActivityExit(this.pendingActivityDeleteRow);
    } else {
      this.applyActivityDelete(this.pendingActivityDeleteRow);
    }
    this.pendingActivityDeleteRow = null;
    this.pendingActivityAction = 'delete';
  }

  protected cancelActivityDelete(): void {
    this.pendingActivityDeleteRow = null;
    this.pendingActivityAction = 'delete';
  }

  private applyActivityExit(row: AppTypes.ActivityListRow): void {
    if (row.type === 'events') {
      this.eventItemsByUser[this.activeUser.id] = this.eventItems.filter(item => item.id !== row.id);
      return;
    }
    if (row.type === 'hosting') {
      this.hostingItemsByUser[this.activeUser.id] = this.hostingItems.filter(item => item.id !== row.id);
      this.eventItemsByUser[this.activeUser.id] = this.eventItems.filter(item => item.id !== row.id);
    }
  }

  protected deleteActivityEvent(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.pendingActivityAction = 'delete';
    this.pendingActivityDeleteRow = row;
  }

  protected editActivityEvent(row: AppTypes.ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (row.type === 'invitations') {
      this.openInvitationItem(row.source as InvitationMenuItem, false, true);
      return;
    }
    if (row.type === 'events' || row.type === 'hosting') {
      this.openEventEditor(true, 'edit', row.source as EventMenuItem | HostingMenuItem);
    }
  }

  private applyActivityDelete(row: AppTypes.ActivityListRow): void {
    if (row.type === 'invitations') {
      this.removeInvitationById(row.id);
      return;
    }
    if (row.type === 'events') {
      const next = this.eventItems.filter(item => item.id !== row.id);
      this.eventItemsByUser[this.activeUser.id] = next;
      return;
    }
    if (row.type === 'hosting') {
      const nextEvents = this.eventItems.filter(item => item.id !== row.id);
      this.eventItemsByUser[this.activeUser.id] = nextEvents;
      const nextHosting = this.hostingItems.filter(item => item.id !== row.id);
      this.hostingItemsByUser[this.activeUser.id] = nextHosting;
    }
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
    this.resetActivitiesScroll();
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

  protected get chatPopupMessages(): AppTypes.ChatPopupMessage[] {
    const history = this.selectedChatHistory;
    if (history.length === 0) {
      return [];
    }
    const start = Math.max(0, history.length - this.chatVisibleMessageCount);
    return history.slice(start);
  }

  protected get chatPopupDayGroups(): AppTypes.ChatPopupDayGroup[] {
    const groups: AppTypes.ChatPopupDayGroup[] = [];
    for (const message of this.chatPopupMessages) {
      const parsed = new Date(message.sentAtIso);
      const day = Number.isNaN(parsed.getTime()) ? AppUtils.dateOnly(new Date()) : AppUtils.dateOnly(parsed);
      const key = AppCalendarHelpers.dateKey(day);
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({
          key,
          label: this.chatDayLabel(day),
          messages: [message]
        });
        continue;
      }
      last.messages.push(message);
    }
    return groups;
  }

  protected trackByChatDayGroup(_: number, group: AppTypes.ChatPopupDayGroup): string {
    return group.key;
  }

  protected trackByChatMessage(_: number, message: AppTypes.ChatPopupMessage): string {
    return message.id;
  }

  protected trackBySubEventResourceCard(_: number, card: AppTypes.SubEventResourceCard): string {
    return card.id;
  }

  protected hasMoreChatMessages(): boolean {
    return this.chatVisibleMessageCount < this.selectedChatHistory.length;
  }

  protected onChatThreadScroll(event: Event): void {
    const thread = event.target as HTMLElement | null;
    if (thread) {
      this.updateChatHeaderProgress(thread);
    }
    if (this.chatHistoryLoadingOlder || !this.hasMoreChatMessages()) {
      return;
    }
    if (!thread) {
      return;
    }
    if (thread.scrollTop > 48) {
      return;
    }
    const beforeHeight = thread.scrollHeight;
    const beforeTop = thread.scrollTop;
    const threadRect = thread.getBoundingClientRect();
    const anchorMessage =
      Array.from(thread.querySelectorAll<HTMLElement>('.chat-message[data-chat-message-id]'))
        .find(message => message.getBoundingClientRect().bottom > threadRect.top + 8) ?? null;
    const anchorMessageId = anchorMessage?.dataset['chatMessageId'] ?? null;
    const anchorOffsetTop = anchorMessage ? anchorMessage.getBoundingClientRect().top - threadRect.top : 0;
    this.chatHistoryLoadingOlder = true;
    this.beginChatHeaderProgressLoading();
    this.chatHistoryLoadOlderTimer = setTimeout(() => {
      this.chatHistoryLoadOlderTimer = null;
      this.chatVisibleMessageCount = Math.min(this.chatVisibleMessageCount + this.chatHistoryPageSize, this.selectedChatHistory.length);
      this.cdr.detectChanges();
      this.runAfterChatThreadRender(() => {
        if (anchorMessageId) {
          const restoredAnchor = thread.querySelector<HTMLElement>(`.chat-message[data-chat-message-id="${anchorMessageId}"]`);
          if (restoredAnchor) {
            const restoredThreadRect = thread.getBoundingClientRect();
            const restoredOffsetTop = restoredAnchor.getBoundingClientRect().top - restoredThreadRect.top;
            thread.scrollTop += restoredOffsetTop - anchorOffsetTop;
          } else {
            const afterHeight = thread.scrollHeight;
            thread.scrollTop = beforeTop + (afterHeight - beforeHeight);
          }
        } else {
          const afterHeight = thread.scrollHeight;
          thread.scrollTop = beforeTop + (afterHeight - beforeHeight);
        }
        this.triggerChatHistoryArrivalBump(thread).finally(() => {
          this.updateChatHeaderProgress(thread);
          this.chatHistoryLoadingOlder = false;
          this.endChatHeaderProgressLoading();
        });
      });
    }, this.activitiesPaginationLoadDelayMs);
  }

  private runAfterChatThreadRender(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(task));
      return;
    }
    setTimeout(task, 0);
  }

  private triggerChatHistoryArrivalBump(thread: HTMLElement): Promise<void> {
    if (this.activePopup !== 'chat' && this.stackedPopup !== 'chat') {
      return Promise.resolve();
    }
    const firstMessage = this.firstVisibleChatMessage(thread) ?? thread.querySelector<HTMLElement>('.chat-message');
    const startTop = thread.scrollTop;
    const messageHeight = firstMessage?.offsetHeight ?? 68;
    const bumpDistance = Math.max(24, Math.round(messageHeight * 0.72));
    const bumpTop = Math.max(0, startTop - bumpDistance);
    if (bumpTop >= startTop - 0.5) {
      return Promise.resolve();
    }
    if (typeof thread.animate !== 'function' || typeof globalThis.requestAnimationFrame !== 'function') {
      thread.scrollTo({ top: bumpTop, behavior: 'smooth' });
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const durationMs = 240;
      const animation = thread.animate(
        [
          { transform: 'translateZ(0)' },
          { transform: 'translateZ(0)' }
        ],
        {
          duration: durationMs,
          easing: 'linear',
          fill: 'none'
        }
      );
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        thread.scrollTop = bumpTop;
        resolve();
      };
      const tick = () => {
        if (done) {
          return;
        }
        const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
        const progress = AppUtils.clampNumber(currentTime / durationMs, 0, 1);
        // Smooth ease-out reveals the first half-row without an abrupt snap.
        const eased = 1 - Math.pow(1 - progress, 3);
        thread.scrollTop = startTop + (bumpTop - startTop) * eased;
        if (progress >= 1 || animation.playState === 'finished' || animation.playState === 'idle') {
          finish();
          return;
        }
        globalThis.requestAnimationFrame(tick);
      };
      animation.oncancel = finish;
      animation.onfinish = finish;
      globalThis.requestAnimationFrame(tick);
    });
  }

  private firstVisibleChatMessage(thread: HTMLElement): HTMLElement | null {
    const threadRect = thread.getBoundingClientRect();
    return (
      Array.from(thread.querySelectorAll<HTMLElement>('.chat-message[data-chat-message-id]'))
        .find(message => message.getBoundingClientRect().bottom > threadRect.top + 8) ?? null
    );
  }

  protected sendChatMessage(): void {
    if (!this.selectedChat) {
      return;
    }
    const text = this.chatDraftMessage.trim();
    if (!text) {
      return;
    }
    this.ensureSelectedChatHistory();
    const history = this.chatHistoryById[this.selectedChat.id];
    if (!history) {
      return;
    }
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    history.push({
      id: `${this.selectedChat.id}-${this.activeUser.id}-${now.getTime()}`,
      sender: this.activeUser.name,
      senderAvatar: this.toChatReader(this.activeUser),
      text,
      time,
      sentAtIso: AppUtils.toIsoDateTime(now),
      mine: true,
      readBy: []
    });
    this.chatDraftMessage = '';
    this.chatVisibleMessageCount = Math.max(this.chatVisibleMessageCount, this.chatHistoryPageSize);
    this.chatVisibleMessageCount = Math.min(this.chatVisibleMessageCount, history.length);
    this.scrollChatToBottom();
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
    if (this.stackedPopup !== null || this.activePopup === 'chat') {
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
    return this.activePopup === 'assetsCar'
      || this.activePopup === 'assetsAccommodation'
      || this.activePopup === 'assetsSupplies'
      || this.activePopup === 'assetsTickets';
  }

  protected isTicketAssetPopup(): boolean {
    return this.isAssetPopup && this.assetFilter === 'Ticket';
  }

  protected get activeAssetType(): AppTypes.AssetType {
    if (this.activePopup === 'assetsAccommodation') {
      return 'Accommodation';
    }
    if (this.activePopup === 'assetsSupplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  protected get filteredAssetCards(): AppTypes.AssetCard[] {
    if (this.assetFilter === 'Ticket') {
      return [];
    }
    return this.assetCards.filter(card => card.type === this.assetFilter);
  }

  protected get selectedAssetCard(): AppTypes.AssetCard | null {
    if (!this.selectedAssetCardId) {
      return null;
    }
    return this.assetCards.find(card => card.id === this.selectedAssetCardId) ?? null;
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
      return this.ticketRows.length;
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

  protected canOpenAssetMap(card: AppTypes.AssetCard): boolean {
    if (card.type !== 'Accommodation') {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes, card.city).some(stop => stop.trim().length > 0);
  }

  protected openAssetMap(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenAssetMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type, card.routes, card.city);
    this.openGoogleMapsSearch(routes[0] ?? card.city);
  }

  protected assetMemberStatusClass(member: AppTypes.AssetMemberRequest): string {
    return member.status === 'pending' ? 'asset-member-pending' : 'asset-member-accepted';
  }

  protected selectAssetFilter(filter: AppTypes.AssetFilterType): void {
    this.assetFilter = filter;
    if (filter !== 'Ticket') {
      this.showTicketOrderPicker = false;
    }
    if (filter === 'Car') {
      this.activePopup = 'assetsCar';
      return;
    }
    if (filter === 'Accommodation') {
      this.activePopup = 'assetsAccommodation';
      return;
    }
    if (filter === 'Ticket') {
      this.activePopup = 'assetsTickets';
      this.seedTicketStickyHeader();
      this.showTicketOrderPicker = false;
      setTimeout(() => this.syncTicketScrollOnOpen(), 0);
      return;
    }
    this.activePopup = 'assetsSupplies';
  }

  protected openAssetMembers(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    this.selectedAssetCardId = card.id;
    this.pendingAssetMemberAction = null;
    this.stackedPopup = 'assetMembers';
  }

  protected openAssetForm(card?: AppTypes.AssetCard): void {
    this.pendingAssetMemberAction = null;
    this.pendingSubEventAssetCreateAssignment = null;
    this.showAssetForm = true;
    this.showAssetVisibilityPicker = false;
    const forcePrivateVisibility = this.isAssetPopup;
    if (card) {
      const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title);
      const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
      this.editingAssetId = card.id;
      this.assetFormVisibility = forcePrivateVisibility
        ? 'Invitation only'
        : (this.assetVisibilityById[card.id] ?? 'Public');
      this.assetForm = {
        type: card.type,
        title: card.title,
        subtitle: card.subtitle,
        city: card.city,
        capacityTotal: card.capacityTotal,
        details: card.details,
        imageUrl,
        sourceLink,
        routes: this.normalizeAssetRoutes(card.type, card.routes, '')
      };
      return;
    }
    this.editingAssetId = null;
    this.assetFormVisibility = forcePrivateVisibility ? 'Invitation only' : 'Public';
    this.assetForm = {
      type: this.activeAssetType,
      title: '',
      subtitle: '',
      city: '',
      capacityTotal: this.activeAssetType === 'Supplies' ? 6 : 4,
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(this.activeAssetType, [], '')
    };
  }

  protected closeAssetForm(): void {
    this.showAssetForm = false;
    this.showAssetVisibilityPicker = false;
    this.editingAssetId = null;
    this.pendingSubEventAssetCreateAssignment = null;
  }

  protected get assetFormTitle(): string {
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${this.assetForm.type}`;
  }

  protected assetFormSupportsRouteStops(): boolean {
    return this.assetForm.type === 'Accommodation';
  }

  protected assetFormSupportsMultiRoute(): boolean {
    return false;
  }

  protected get assetFormRouteStops(): string[] {
    return this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes, '');
  }

  protected onAssetFormRouteStopChange(index: number, value: string): void {
    const routes = [...this.assetFormRouteStops];
    if (index < 0 || index >= routes.length) {
      return;
    }
    routes[index] = value;
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes, '');
  }

  protected addAssetFormRouteStop(): void {
    if (!this.assetFormSupportsMultiRoute()) {
      return;
    }
    const routes = [...this.assetFormRouteStops, ''];
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes, '');
  }

  protected removeAssetFormRouteStop(index: number): void {
    if (!this.assetFormSupportsMultiRoute()) {
      return;
    }
    const routes = this.assetFormRouteStops;
    if (routes.length <= 1 || index < 0 || index >= routes.length) {
      return;
    }
    routes.splice(index, 1);
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes, '');
  }

  protected dropAssetFormRouteStop(event: CdkDragDrop<string[]>): void {
    if (!this.assetFormSupportsMultiRoute()) {
      return;
    }
    const routes = [...this.assetFormRouteStops];
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(routes, event.previousIndex, event.currentIndex);
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes, '');
  }

  protected openAssetFormRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const value = this.assetFormRouteStops[index] ?? '';
    this.openGoogleMapsSearch(value);
  }

  protected canOpenAssetFormRouteMap(): boolean {
    return this.assetFormSupportsRouteStops() && this.assetFormRouteStops.some(stop => stop.trim().length > 0);
  }

  protected openAssetFormRouteMap(event?: Event): void {
    event?.stopPropagation();
    if (!this.assetFormSupportsRouteStops()) {
      return;
    }
    if (this.assetForm.type === 'Accommodation') {
      this.openGoogleMapsSearch(this.assetFormRouteStops[0] ?? '');
      return;
    }
    this.openGoogleMapsDirections(this.assetFormRouteStops);
  }

  protected saveAssetCard(): void {
    const title = this.assetForm.title.trim();
    const city = this.assetForm.city.trim();
    const routes = this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes, '');
    const accommodationLocation = routes.find(stop => stop.trim().length > 0)?.trim() || '';
    const resolvedCity = this.assetForm.type === 'Accommodation'
      ? accommodationLocation
      : city;
    if (!title) {
      return;
    }
    if (this.assetForm.type === 'Accommodation' && !accommodationLocation) {
      return;
    }
    const imageUrl = this.normalizeAssetImageLink(this.assetForm.type, this.assetForm.imageUrl, title || this.assetForm.subtitle || city);
    const sourceLink = this.normalizeAssetSourceLink(this.assetForm.sourceLink, imageUrl);
    const createAssignment = this.pendingSubEventAssetCreateAssignment;
    const payload: Omit<AppTypes.AssetCard, 'id' | 'requests'> = {
      type: this.assetForm.type,
      title,
      subtitle: this.assetForm.subtitle.trim() || AppDemoGenerators.defaultAssetSubtitle(this.assetForm.type),
      city: resolvedCity,
      capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
      details: this.assetForm.details.trim() || AppDemoGenerators.defaultAssetDetails(this.assetForm.type),
      imageUrl,
      sourceLink,
      routes
    };
    const resolvedVisibility: AppTypes.EventVisibility = this.isAssetPopup ? 'Invitation only' : this.assetFormVisibility;
    if (this.editingAssetId) {
      this.assetVisibilityById[this.editingAssetId] = resolvedVisibility;
      this.assetCards = this.assetCards.map(card =>
        card.id === this.editingAssetId
          ? {
              ...card,
              ...payload
            }
          : card
      );
    } else {
      const id = `asset-${Date.now()}`;
      this.assetVisibilityById[id] = resolvedVisibility;
      this.assetCards = [
        {
          id,
          ...payload,
          requests: []
        },
        ...this.assetCards
      ];
      if (createAssignment && createAssignment.type === payload.type) {
        const key = this.subEventAssetAssignmentKey(createAssignment.subEventId, createAssignment.type);
        const assignedIds = this.resolveSubEventAssignedAssetIds(createAssignment.subEventId, createAssignment.type);
        const nextAssignedIds = assignedIds.includes(id) ? assignedIds : [...assignedIds, id];
        this.subEventAssignedAssetIdsByKey[key] = [...nextAssignedIds];
        const settings = this.getSubEventAssignedAssetSettings(createAssignment.subEventId, createAssignment.type);
        const capacityMax = Math.max(0, payload.capacityTotal);
        settings[id] = {
          capacityMin: 0,
          capacityMax,
          addedByUserId: this.activeUser.id,
          routes: this.normalizeAssetRoutes(createAssignment.type, payload.routes, '')
        };
        this.subEventAssignedAssetSettingsByKey[key] = { ...settings };
        const targetSubEvent = this.findSubEventById(createAssignment.subEventId);
        if (targetSubEvent) {
          this.syncSubEventAssetBadgeCounts(targetSubEvent, createAssignment.type);
        }
      }
    }
    this.closeAssetForm();
    this.syncAllSubEventAssetBadgeCounts();
  }

  protected requestAssetDelete(cardId: string): void {
    this.pendingAssetDeleteCardId = cardId;
  }

  protected toggleAssetItemActionMenu(card: AppTypes.AssetCard, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenu?.scope === 'asset' && this.inlineItemActionMenu.id === card.id) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = { scope: 'asset', id: card.id, title: card.title, openUp: this.shouldOpenInlineItemMenuUp(event) };
  }

  protected isAssetItemActionMenuOpen(card: AppTypes.AssetCard): boolean {
    return this.inlineItemActionMenu?.scope === 'asset' && this.inlineItemActionMenu.id === card.id;
  }

  protected isAssetItemActionMenuOpenUp(card: AppTypes.AssetCard): boolean {
    return this.inlineItemActionMenu?.scope === 'asset'
      && this.inlineItemActionMenu.id === card.id
      && this.inlineItemActionMenu.openUp;
  }

  protected runAssetItemEditAction(card: AppTypes.AssetCard, event: Event): void {
    event.stopPropagation();
    this.openAssetForm(card);
    this.inlineItemActionMenu = null;
  }

  protected runAssetItemDeleteAction(card: AppTypes.AssetCard, event: Event): void {
    event.stopPropagation();
    this.requestAssetDelete(card.id);
    this.inlineItemActionMenu = null;
  }

  protected cancelAssetDelete(): void {
    this.pendingAssetDeleteCardId = null;
  }

  protected pendingAssetDeleteLabel(): string {
    if (!this.pendingAssetDeleteCardId) {
      return '';
    }
    const card = this.assetCards.find(item => item.id === this.pendingAssetDeleteCardId);
    return card ? `Delete ${card.title}?` : 'Delete this item?';
  }

  protected confirmAssetDelete(): void {
    if (!this.pendingAssetDeleteCardId) {
      return;
    }
    this.deleteAssetCard(this.pendingAssetDeleteCardId);
    this.pendingAssetDeleteCardId = null;
  }

  private deleteAssetCard(cardId: string): void {
    this.assetCards = this.assetCards.filter(card => card.id !== cardId);
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
    this.assetCards = this.assetCards.map(card => {
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
    const card = this.assetCards.find(item => item.id === pending.cardId);
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
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.assetForm.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  protected refreshAssetFromSourceLink(): void {
    const raw = this.assetForm.sourceLink.trim();
    if (!raw) {
      return;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      try {
        parsed = new URL(`https://${raw}`);
        this.assetForm.sourceLink = parsed.toString();
      } catch {
        return;
      }
    }
    if (!parsed || this.isGoogleMapsLikeLink(parsed.toString())) {
      return;
    }
    const seed = `${this.assetForm.type.toLowerCase()}-${parsed.hostname.replace(/\./g, '-')}${parsed.pathname.replace(/[^\w-]/g, '-')}`;
    if (!this.assetForm.imageUrl.trim()) {
      this.assetForm.imageUrl = AppDemoGenerators.defaultAssetImage(this.assetForm.type, seed);
    }
    if (!this.assetForm.title.trim()) {
      this.assetForm.title = `${this.assetForm.type} · ${parsed.hostname.replace(/^www\./, '')}`;
    }
    if (!this.assetForm.subtitle.trim()) {
      this.assetForm.subtitle = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1).replace(/[-_/]+/g, ' ') : 'Imported preview';
    }
    if (!this.assetForm.details.trim()) {
      this.assetForm.details = `Preview imported from ${parsed.hostname}. You can adjust the details before saving.`;
    }
  }

  protected selectImageSlot(index: number): void {
    this.selectedImageIndex = index;
    if (this.imageSlots[index]) {
      return;
    }
    this.pendingSlotUploadIndex = index;
    this.slotImageInput?.nativeElement.click();
  }

  protected removeImage(index: number): void {
    this.revokeObjectUrl(this.imageSlots[index]);
    this.imageSlots[index] = null;
    this.persistActiveUserImageSlots();
    if (this.selectedImageIndex === index) {
      const nearest = this.findNearestFilledImageIndex(index);
      this.selectedImageIndex = nearest >= 0 ? nearest : 0;
    }
  }

  protected selectImageFromStack(index: number): void {
    if (!this.imageSlots[index]) {
      return;
    }
    this.selectedImageIndex = index;
  }

  protected onSlotImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    const slotIndex = this.pendingSlotUploadIndex;
    this.pendingSlotUploadIndex = null;
    if (!file || slotIndex === null) {
      target.value = '';
      return;
    }

    this.revokeObjectUrl(this.imageSlots[slotIndex]);
    this.imageSlots[slotIndex] = URL.createObjectURL(file);
    this.selectedImageIndex = slotIndex;
    this.persistActiveUserImageSlots();
    target.value = '';
  }

  protected saveProfile(): void {
    this.commitProfileForm(true);
  }

  private commitProfileForm(showAlert: boolean): void {
    const user = this.activeUser;
    user.name = this.profileForm.fullName.trim() || user.name;
    const birthday = this.profileForm.birthday ? AppUtils.toIsoDate(this.profileForm.birthday) : user.birthday;
    user.birthday = birthday;
    user.age = AppUtils.ageFromIsoDate(birthday, user.age);
    user.city = this.profileForm.city.trim() || user.city;
    user.height = this.profileForm.heightCm ? `${this.profileForm.heightCm} cm` : user.height;
    user.physique = this.profileForm.physique || user.physique;
    user.languages = this.profileForm.languages.length > 0 ? [...this.profileForm.languages] : user.languages;
    user.horoscope = this.profileForm.horoscope || user.horoscope;
    user.profileStatus = this.profileForm.profileStatus;
    user.about = this.profileForm.about.trim().slice(0, 160);
    user.initials = AppUtils.initialsFromText(user.name);
    user.images = this.imageSlots.filter((slot): slot is string => Boolean(slot));
    this.syncProfileBasicsIntoDetailRows(user);
    user.completion = this.calculateProfileCompletionPercent();
    this.profileDetailsFormByUser[user.id] = this.profileDetailsForm;
    if (showAlert) {
      this.alertService.open('Profile saved');
    }
  }

  protected get selectedImagePreview(): string | null {
    return this.imageSlots[this.selectedImageIndex] ?? null;
  }

  protected get featuredImagePreview(): string | null {
    return this.imageSlots[0] ?? null;
  }

  protected get imageStackSlots(): number[] {
    return this.imageSlots
      .map((slot, index) => (slot ? index : -1))
      .filter(index => index >= 0);
  }

  private findNearestFilledImageIndex(fromIndex: number): number {
    for (let distance = 1; distance < this.imageSlots.length; distance += 1) {
      const right = fromIndex + distance;
      if (right < this.imageSlots.length && this.imageSlots[right]) {
        return right;
      }
      const left = fromIndex - distance;
      if (left >= 0 && this.imageSlots[left]) {
        return left;
      }
    }
    return this.imageSlots.findIndex(slot => Boolean(slot));
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

  private resolveEventExploreSource(card: AppTypes.EventExploreCard): EventMenuItem | HostingMenuItem | null {
    if (card.sourceType === 'hosting') {
      return this.hostingItems.find(item => item.id === card.id) ?? null;
    }
    return this.eventItems.find(item => item.id === card.id) ?? null;
  }

  private eventExploreRow(card: AppTypes.EventExploreCard): AppTypes.ActivityListRow | null {
    const source = this.resolveEventExploreSource(card);
    if (!source) {
      return null;
    }
    return {
      id: card.id,
      type: card.sourceType === 'hosting' ? 'hosting' : 'events',
      title: card.title,
      subtitle: card.subtitle,
      detail: card.timeframe,
      dateIso: this.eventDatesById[card.id] ?? this.hostingDatesById[card.id] ?? this.defaultEventStartIso(),
      distanceKm: card.distanceKm,
      unread: 0,
      metricScore: card.relevance,
      isAdmin: false,
      source
    };
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type: 'eventEditor' | 'eventExplore' }>;
    if (!popupEvent.detail?.type) {
      return;
    }
    if (popupEvent.detail.type === 'eventEditor') {
      this.openEventEditor(false, 'create');
      return;
    }
    this.openEventExplore();
  }

  @HostListener('window:keydown.escape', ['$event'])
  onGlobalEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.stopPropagation();
    if (this.showUserSelector) {
      this.closeDemoUserSelectorPopup();
      return;
    }
    if (this.showFirebaseAuthPopup) {
      this.closeFirebaseAuthPopup();
      return;
    }
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
    if (this.superStackedPopup === 'eventExploreTopicFilter') {
      this.closeEventExploreTopicFilterPopup();
      return;
    }
    if (this.superStackedPopup === 'impressionsHost') {
      this.closeSuperStackedImpressions();
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

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMoveForActivitiesRates(event: PointerEvent): void {
    if (!this.isActivitiesRatesPairSplitDragging || this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updateActivitiesRatesPairSplitFromDragDelta(event.clientX);
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUpForActivitiesRates(event: PointerEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:pointercancel', ['$event'])
  onWindowPointerCancelForActivitiesRates(event: PointerEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:touchmove', ['$event'])
  onWindowTouchMoveForActivitiesRates(event: TouchEvent): void {
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
  onWindowTouchEndForActivitiesRates(event: TouchEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== -1) {
      return;
    }
    if (!event.changedTouches?.length) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('window:touchcancel', ['$event'])
  onWindowTouchCancelForActivitiesRates(event: TouchEvent): void {
    if (this.activitiesRatesPairSplitPointerId !== -1) {
      return;
    }
    if (!event.changedTouches?.length) {
      return;
    }
    this.stopActivitiesRatesPairSplitDrag();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    this.maybeDismissActivityRateEditor(target);
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
    const keepUserMenuOpenForFeedbackFlow =
      this.showUserMenu &&
      (this.activePopup === 'eventFeedback' || this.activePopup === 'reportUser');
    if (this.showUserMenu && Date.now() < this.suppressUserMenuOutsideCloseUntilMs) {
      this.suppressUserMenuOutsideCloseUntilMs = 0;
    } else if (
      this.showUserMenu &&
      !keepUserMenuOpenForFeedbackFlow &&
      !target.closest('.user-menu-panel') &&
      !target.closest('.user-selector-btn-global')
    ) {
      this.showUserMenu = false;
      this.showUserSettingsMenu = false;
    }
    if (this.showUserSettingsMenu && !target.closest('.user-settings-menu') && !target.closest('.user-menu-settings-btn')) {
      this.showUserSettingsMenu = false;
    }
    if (
      this.showLanguagePanel &&
      (target.closest('.cdk-overlay-pane') ||
        target.closest('.cdk-overlay-container') ||
        target.closest('.mat-mdc-autocomplete-panel'))
    ) {
      return;
    }
    if (this.showLanguagePanel && !target.closest('.language-filter')) {
      this.showLanguagePanel = false;
    }
    if (this.openPrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openPrivacyFab = null;
    }
    if (this.openExperiencePrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openExperiencePrivacyFab = null;
    }
    if (this.showActivitiesViewPicker && !target.closest('.activities-view-picker') && !target.closest('.popup-view-fab')) {
      this.showActivitiesViewPicker = false;
    }
    if (this.showActivitiesSecondaryPicker && !target.closest('.activities-secondary-picker') && !target.closest('.popup-view-fab')) {
      this.showActivitiesSecondaryPicker = false;
    }
    if (this.showTicketOrderPicker && !target.closest('.ticket-order-picker')) {
      this.showTicketOrderPicker = false;
    }
    if (this.showActivityInviteSortPicker && !target.closest('.friends-picker-sort') && !target.closest('.popup-view-fab')) {
      this.showActivityInviteSortPicker = false;
    }
    if (this.showAssetVisibilityPicker && !target.closest('.asset-visibility-picker') && !target.closest('.popup-view-fab')) {
      this.showAssetVisibilityPicker = false;
    }
    if (this.showProfileStatusHeaderPicker && !target.closest('.profile-status-header-picker') && !target.closest('.popup-view-fab')) {
      this.showProfileStatusHeaderPicker = false;
    }
    if (this.showEventExploreOrderPicker && !target.closest('.event-explore-order-picker') && !target.closest('.popup-view-fab')) {
      this.showEventExploreOrderPicker = false;
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
    const stored = localStorage.getItem(App.DEMO_ACTIVE_USER_KEY);
    if (stored && this.users.some(user => user.id === stored)) {
      return stored;
    }
    return this.users[0].id;
  }

  private resolveAuthMode(): AppTypes.AuthMode {
    const configured = (environment as { authMode?: string }).authMode;
    if (configured === 'firebase' || configured === 'selector') {
      return configured;
    }
    return environment.loginEnabled ? 'firebase' : 'selector';
  }

  private initializeEntryFlow(): void {
    const hasConsent = this.loadEntryConsentState() !== null;
    this.entryConsentViewOnly = false;
    this.showEntryConsentPopup = !hasConsent;
    if (this.authMode === 'selector') {
      localStorage.removeItem(App.DEMO_ACTIVE_USER_KEY);
      this.firebaseAuthProfile = null;
      this.showEntryShell = true;
      this.showUserSelector = false;
      this.showFirebaseAuthPopup = false;
      return;
    }
    this.firebaseAuthProfile = this.loadFirebaseAuthProfile();
    const hasFirebaseSession = this.firebaseAuthProfile !== null;
    this.showEntryShell = !hasFirebaseSession;
    this.showUserSelector = false;
    this.showFirebaseAuthPopup = false;
  }

  private loadEntryConsentState(): AppTypes.EntryConsentState | null {
    const raw = localStorage.getItem(App.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppTypes.EntryConsentState>;
      if (
        parsed.version !== App.ENTRY_CONSENT_VERSION ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.length === 0
      ) {
        return null;
      }
      return {
        version: parsed.version,
        accepted: true,
        acceptedAtIso: parsed.acceptedAtIso
      };
    } catch {
      return null;
    }
  }

  private appendEntryConsentAudit(action: AppTypes.EntryConsentAuditRecord['action'], tsIso: string): void {
    const record: AppTypes.EntryConsentAuditRecord = {
      tsIso,
      action,
      version: App.ENTRY_CONSENT_VERSION,
      source: 'entry',
      userAgent: navigator.userAgent
    };
    const existing = this.loadEntryConsentAudit();
    existing.unshift(record);
    const trimmed = existing.slice(0, App.ENTRY_CONSENT_AUDIT_MAX);
    localStorage.setItem(App.ENTRY_CONSENT_AUDIT_KEY, JSON.stringify(trimmed));
  }

  private loadEntryConsentAudit(): AppTypes.EntryConsentAuditRecord[] {
    const raw = localStorage.getItem(App.ENTRY_CONSENT_AUDIT_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as AppTypes.EntryConsentAuditRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private loadFirebaseAuthProfile(): AppTypes.FirebaseAuthProfile | null {
    const raw = localStorage.getItem(App.FIREBASE_AUTH_PROFILE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppTypes.FirebaseAuthProfile>;
      if (!parsed.id || !parsed.name || !parsed.email || !parsed.initials) {
        return null;
      }
      return {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        initials: parsed.initials
      };
    } catch {
      return null;
    }
  }

  private completeEntryFlow(): void {
    this.showEntryShell = false;
    this.showUserSelector = false;
    this.showFirebaseAuthPopup = false;
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    this.clearActivityRateEditorState();
    this.router.navigate(['/game']);
  }

  private detailPrivacyFabKey(groupIndex: number, rowIndex: number): string {
    return `${groupIndex}-${rowIndex}`;
  }

  private privacySelectorOptions(): AppTypes.MobileProfileSelectorOption[] {
    const order: AppTypes.DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    return order.map(option => ({
      value: option,
      label: option,
      icon: this.privacyStatusIcon(option),
      toneClass: this.privacyStatusClass(option)
    }));
  }

  private isDetailPrivacy(value: string): value is AppTypes.DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private initializeProfileImageSlots(): void {
    for (const user of this.users) {
      const slots = this.createEmptyImageSlots();
      const explicit = (user.images ?? []).filter(Boolean).slice(0, 8);
      if (explicit.length > 0) {
        explicit.forEach((url, index) => {
          slots[index] = url;
        });
      } else {
        const count = 1 + (AppDemoGenerators.hashText(`profile-image-count:${user.id}`) % 4);
        for (let index = 0; index < count; index += 1) {
          slots[index] = this.profilePortraitUrlForUser(user, index, 'profile-seed');
        }
      }
      this.profileImageSlotsByUser[user.id] = slots;
    }
  }

  private createEmptyImageSlots(): Array<string | null> {
    return Array.from({ length: 8 }, () => null);
  }

  private persistActiveUserImageSlots(): void {
    this.profileImageSlotsByUser[this.activeUser.id] = [...this.imageSlots];
  }

  private syncProfileFormFromActiveUser(): void {
    const user = this.activeUser;
    const birthday = AppUtils.fromIsoDate(user.birthday);
    this.profileDetailsForm = this.profileDetailsForUser(user.id);
    this.profileForm = {
      fullName: user.name,
      birthday,
      city: user.city,
      heightCm: Number.parseInt(user.height, 10) || null,
      physique: user.physique,
      languages: [...user.languages],
      horoscope: birthday ? AppUtils.horoscopeByDate(birthday) : user.horoscope,
      profileStatus: user.profileStatus,
      hostTier: user.hostTier,
      traitLabel: user.traitLabel,
      about: user.about
    };
    this.syncProfileBasicsIntoDetailRows(user);
    const slots = this.profileImageSlotsByUser[user.id];
    this.imageSlots = slots ? [...slots] : this.createEmptyImageSlots();
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    this.selectedImageIndex = firstFilled >= 0 ? firstFilled : 0;
    user.completion = this.calculateProfileCompletionPercent();
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

  private normalizeAssetMediaLinks(): void {
    this.assetCards = this.assetCards.map(card => {
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

  private resetExperienceForm(): void {
    this.experienceForm = {
      type: 'Workspace',
      title: '',
      org: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      description: ''
    };
    this.experienceRangeStart = null;
    this.experienceRangeEnd = null;
  }

  protected get profileCardBirthday(): string {
    if (!this.profileForm.birthday) {
      return 'Birthday';
    }
    return this.profileForm.birthday.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected get profileEditorAge(): number {
    if (!this.profileForm.birthday) {
      return this.activeUser.age;
    }
    return AppUtils.ageFromIsoDate(AppUtils.toIsoDate(this.profileForm.birthday), this.activeUser.age);
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

  private eventExploreVisibilityRaw(card: AppTypes.EventExploreCard): AppTypes.EventVisibility {
    return this.eventVisibilityById[card.id] ?? 'Public';
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
    this.assetCards = this.assetCards.map(card => {
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
    const subEvent = this.findSubEventById(context.subEventId);
    if (subEvent) {
      this.syncSubEventAssetBadgeCounts(subEvent, context.type);
    }
  }

  private sortActivityMembersByActionTimeAsc(entries: AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  private getChatItemById(chatId: string): ChatMenuItem | undefined {
    if (this.selectedChat?.id === chatId) {
      return this.selectedChat;
    }
    const contextual = this.buildContextualChatChannels().find(item => item.id === chatId);
    if (contextual) {
      return contextual;
    }
    for (const entries of Object.values(this.chatItemsByUser)) {
      const match = entries.find(item => item.id === chatId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  private ensurePublishedEventChatChannel(eventId: string, eventTitle: string, eventDescription: string, startAtIso: string): void {
    const chatId = `c-event-${eventId}`;
    if (this.chatItems.some(item => item.id === chatId)) {
      return;
    }
    const title = eventTitle.trim() || 'Event';
    const description = eventDescription.trim() || 'Event channel';
    const firstMessage = `${title} / ${description}`;
    const startAtDate = AppUtils.isoLocalDateTimeToDate(startAtIso) ?? new Date();
    const sentAtIso = AppUtils.toIsoDateTime(startAtDate);
    const nextChat: ChatMenuItem = {
      id: chatId,
      avatar: this.activeUser.initials,
      title,
      lastMessage: firstMessage,
      lastSenderId: this.activeUser.id,
      memberIds: [this.activeUser.id],
      unread: 0
    };
    this.chatItemsByUser[this.activeUser.id] = [nextChat, ...this.chatItems];
    this.chatDatesById[chatId] = sentAtIso;
    this.chatHistoryById[chatId] = [{
      id: `${chatId}-seed-1`,
      sender: this.activeUser.name,
      senderAvatar: this.toChatReader(this.activeUser),
      text: firstMessage,
      time: startAtDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      sentAtIso,
      mine: true,
      readBy: [this.toChatReader(this.activeUser)]
    }];
  }

  private startChatInitialLoad(): void {
    this.cancelChatInitialLoad();
    this.chatInitialLoadPending = true;
    this.chatHeaderProgress = 0;
    this.beginChatHeaderProgressLoading();
    this.chatInitialLoadTimer = setTimeout(() => {
      this.chatInitialLoadTimer = null;
      this.endChatHeaderProgressLoading();
    }, this.activitiesPaginationLoadDelayMs);
  }

  private initialChatVisibleMessageCount(totalMessages: number): number {
    const chunkSize = this.chatHistoryPageSize * this.chatInitialVisiblePageCount;
    return Math.min(totalMessages, Math.max(this.chatHistoryPageSize, chunkSize));
  }

  private chatDayLabel(value: Date): string {
    const day = AppUtils.dateOnly(value);
    const today = AppUtils.dateOnly(new Date());
    if (AppCalendarHelpers.dateKey(day) === AppCalendarHelpers.dateKey(today)) {
      return 'Today';
    }
    const yesterday = AppUtils.addDays(today, -1);
    if (AppCalendarHelpers.dateKey(day) === AppCalendarHelpers.dateKey(yesterday)) {
      return 'Yesterday';
    }
    return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private cancelChatInitialLoad(): void {
    if (this.chatInitialLoadTimer) {
      clearTimeout(this.chatInitialLoadTimer);
      this.chatInitialLoadTimer = null;
    }
    if (this.chatHistoryLoadOlderTimer) {
      clearTimeout(this.chatHistoryLoadOlderTimer);
      this.chatHistoryLoadOlderTimer = null;
    }
    this.chatHistoryLoadingOlder = false;
    this.chatInitialLoadPending = false;
    this.clearChatHeaderLoadingAnimation();
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      const chatThread = globalThis.document?.querySelector('.chat-thread');
      if (chatThread instanceof HTMLElement) {
        chatThread.scrollTop = chatThread.scrollHeight;
        this.updateChatHeaderProgress(chatThread);
      }
    }, 0);
  }

  private updateChatHeaderProgress(chatThread: HTMLElement): void {
    const maxVerticalScroll = Math.max(0, chatThread.scrollHeight - chatThread.clientHeight);
    if (maxVerticalScroll <= 0) {
      this.chatHeaderProgress = 1;
      return;
    }
    this.chatHeaderProgress = AppUtils.clampNumber(chatThread.scrollTop / maxVerticalScroll, 0, 1);
  }

  private get selectedChatHistory(): AppTypes.ChatPopupMessage[] {
    if (!this.selectedChat) {
      return [];
    }
    this.ensureSelectedChatHistory();
    return this.chatHistoryById[this.selectedChat.id] ?? [];
  }

  private ensureSelectedChatHistory(): void {
    if (!this.selectedChat) {
      return;
    }
    if (this.chatHistoryById[this.selectedChat.id]) {
      return;
    }
    this.chatHistoryById[this.selectedChat.id] = this.buildChatHistory(this.selectedChat);
  }

  private buildChatHistory(chat: ChatMenuItem): AppTypes.ChatPopupMessage[] {
    const members = this.getChatMembersById(chat.id);
    const lastSender = members[0] ?? this.getChatLastSender(chat);
    const starter = members[1] ?? members[0] ?? this.activeUser;
    const memberB = members[2] ?? starter;
    const memberC = members[3] ?? memberB;
    const me = this.activeUser;
    const anchor = new Date(this.chatDatesById[chat.id] ?? AppUtils.toIsoDateTime(new Date()));
    const chatAnchor = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
    const at = (minutesBefore: number): Date => new Date(chatAnchor.getTime() - (minutesBefore * 60 * 1000));

    const byId = (id: string) => this.users.find(user => user.id === id);
    const toMessage = (id: string, text: string, sentAt: Date, readByIds: string[], forceMine = false, suffix = ''): AppTypes.ChatPopupMessage => {
      const senderUser = byId(id) ?? starter;
      const time = sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      return {
        id: `${chat.id}-${id}-${sentAt.getTime()}-${suffix || AppDemoGenerators.hashText(text)}`,
        sender: senderUser.name,
        senderAvatar: this.toChatReader(senderUser),
        text,
        time,
        sentAtIso: AppUtils.toIsoDateTime(sentAt),
        mine: forceMine || senderUser.id === me.id,
        readBy: readByIds
          .map(readerId => byId(readerId))
          .filter((reader): reader is DemoUser => Boolean(reader))
          .map(reader => this.toChatReader(reader))
      };
    };

    const seed = AppDemoGenerators.hashText(`${chat.id}:${chat.title}`);
    const olderPool = [
      'Shared updated ETA for everyone.',
      'Pinned the checklist in this room.',
      'Confirmed who can bring supplies.',
      'Noted backup plan if weather changes.',
      'Added the new member to transport.',
      'Assigned table and seat groups.',
      'Synced on arrival windows.',
      'Collected final confirmations.'
    ];
    const olderMessages: AppTypes.ChatPopupMessage[] = [];
    const olderCount = 36;
    const olderBaseStart = new Date(chatAnchor.getTime() - ((olderCount + 12) * 40 * 60 * 1000));
    for (let index = olderCount - 1; index >= 0; index -= 1) {
      const senderCycle = index % 3;
      const senderId = senderCycle === 0 ? starter.id : (senderCycle === 1 ? me.id : memberB.id);
      const baseText = olderPool[(seed + index) % olderPool.length];
      const text = baseText;
      const sequenceFromOldest = (olderCount - 1) - index;
      const sentAt = new Date(olderBaseStart.getTime() + (sequenceFromOldest * 40 * 60 * 1000));
      const readByIds = senderId === me.id ? [starter.id, memberB.id] : [me.id, memberC.id];
      olderMessages.push(toMessage(senderId, text, sentAt, readByIds, senderId === me.id, `older-${index}`));
    }

    let recentMessages: AppTypes.ChatPopupMessage[];
    if (chat.id === 'c1') {
      recentMessages = [
        toMessage(starter.id, 'I opened this room to lock transport before 8 PM.', at(13), [memberB.id]),
        toMessage(me.id, 'I can handle pickup list and final seat assignments.', at(8), [starter.id, memberB.id], true),
        toMessage(memberB.id, 'I can do airport run if someone covers downtown.', at(5), [starter.id, me.id]),
        toMessage(lastSender.id, chat.lastMessage, at(0), [starter.id, me.id, memberB.id])
      ];
    } else if (chat.id === 'c2') {
      recentMessages = [
        toMessage(starter.id, 'Room is open, we need one more player for the second pair.', at(8), [memberB.id]),
        toMessage(me.id, 'I can join at 19:00 if court #3 stays available.', at(3), [starter.id], true),
        toMessage(lastSender.id, chat.lastMessage, at(0), [starter.id, me.id])
      ];
    } else if (chat.id === 'c3') {
      recentMessages = [
        toMessage(starter.id, 'Host queue reviewed, two pending invites expired.', at(6), [memberB.id]),
        toMessage(me.id, 'I can re-send only to people with verified attendance.', at(3), [starter.id], true),
        toMessage(lastSender.id, chat.lastMessage, at(0), [starter.id, me.id])
      ];
    } else {
      recentMessages = [
        toMessage(starter.id, 'Opened this room to coordinate tasks quickly.', at(7), [memberB.id]),
        toMessage(me.id, 'I can cover the checklist and send updates.', at(3), [starter.id], true),
        toMessage(lastSender.id, chat.lastMessage, at(0), [starter.id, me.id, memberC.id])
      ];
    }
    return [...olderMessages, ...recentMessages];
  }

  private toChatReader(user: DemoUser): AppTypes.ChatReadAvatar {
    return {
      id: user.id,
      initials: user.initials,
      gender: user.gender
    };
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

  private matchesRateFilter(item: RateMenuItem, filter: AppTypes.RateFilterKey): boolean {
    const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
    return item.mode === modeKey && this.displayedRateDirection(item) === directionKey;
  }

  private isHostingPublished(eventId: string): boolean {
    return this.hostingPublishedById[eventId] !== false;
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
      if (this.activePopup !== 'activities') {
        return;
      }
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

  private seedActivitiesStickyHeader(): void {
    if (this.activitiesView === 'month') {
      this.activitiesStickyValue = this.calendarMonthPages[0]?.label ?? 'No items';
      return;
    }
    if (this.activitiesView === 'week') {
      this.activitiesStickyValue = this.calendarWeekPages[0]?.label ?? 'No items';
      return;
    }
    const firstGroup = this.groupedActivityRows[0];
    if (firstGroup) {
      this.activitiesStickyValue = firstGroup.label;
      return;
    }
    this.activitiesStickyValue = this.activitiesView === 'distance' ? '5 km' : 'No items';
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
        this.activitiesStickyValue = this.calendarMonthPages[pageIndex]?.label ?? this.calendarMonthPages[0]?.label ?? 'No items';
        return;
      }
      this.activitiesStickyValue = this.calendarWeekPages[pageIndex]?.label ?? this.calendarWeekPages[0]?.label ?? 'No items';
      return;
    }
    const groups = this.groupedActivityRows;
    if (groups.length === 0) {
      this.activitiesStickyValue = this.activitiesView === 'distance' ? '5 km' : 'No items';
      return;
    }
    const scrollElement = this.activitiesScrollRef?.nativeElement;
    if (!scrollElement) {
      this.activitiesStickyValue = groups[0].label;
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.activities-sticky-header');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = scrollTop + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.activities-row-item'));
    if (rows.length === 0) {
      this.activitiesStickyValue = groups[0].label;
      return;
    }
    if (scrollTop <= 1) {
      this.activitiesStickyValue = rows[0].dataset['groupLabel'] ?? groups[0].label;
      return;
    }
    const alignmentTolerancePx = 2;
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - alignmentTolerancePx) ??
      rows[rows.length - 1];
    this.activitiesStickyValue = activeRow.dataset['groupLabel'] ?? groups[0].label;
  }

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
      // Require an extra quiet window before mutating page anchors.
      this.calendarPostSettleTimer = setTimeout(() => {
        this.calendarPostSettleTimer = null;
        if (this.suppressCalendarEdgeSettle || this.activePopup !== 'activities' || !this.isCalendarLayoutView()) {
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

  protected onTicketScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.updateTicketStickyHeader(target.scrollTop || 0);
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
      // Keep edge-navigation behavior aligned with swipe settle timing.
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

  protected trackByCalendarPageKey(_: number, page: AppTypes.CalendarMonthPage | AppTypes.CalendarWeekPage): string {
    return page.key;
  }

  protected trackByCalendarMonthWeekKey(_: number, week: AppTypes.CalendarMonthWeek): string {
    return AppCalendarHelpers.dateKey(week.start);
  }

  protected trackByCalendarDayKey(_: number, day: AppTypes.CalendarDayCell): string {
    return day.key;
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

  private monthAnchorsForRows(rows: AppTypes.ActivityListRow[]): Date[] {
    if (this.calendarMonthAnchorPages && this.calendarMonthAnchorPages.length > 0) {
      return [...this.calendarMonthAnchorPages];
    }
    const todayMonth = AppUtils.startOfMonth(AppUtils.dateOnly(new Date()));
    const focusMonth = this.calendarMonthFocusDate ? AppUtils.startOfMonth(this.calendarMonthFocusDate) : todayMonth;
    this.calendarMonthAnchorPages = AppUtils.buildMonthAnchorWindow(focusMonth, this.calendarAnchorRadius);
    return [...this.calendarMonthAnchorPages];
  }

  private weekAnchorsForRows(rows: AppTypes.ActivityListRow[]): Date[] {
    if (this.calendarWeekAnchorPages && this.calendarWeekAnchorPages.length > 0) {
      return [...this.calendarWeekAnchorPages];
    }
    const todayWeek = AppUtils.startOfWeekMonday(AppUtils.dateOnly(new Date()));
    const focusWeek = this.calendarWeekFocusDate ? AppUtils.startOfWeekMonday(this.calendarWeekFocusDate) : todayWeek;
    this.calendarWeekAnchorPages = AppUtils.buildWeekAnchorWindow(focusWeek, this.calendarAnchorRadius);
    return [...this.calendarWeekAnchorPages];
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
    // Never force snap-back here; only continue once native scroll/snap has fully settled.
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

  private updateActivitiesHeaderProgress(): void {
    if (this.activePopup !== 'activities') {
      this.activitiesHeaderProgress = 0;
      return;
    }

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

  private maybeLoadMoreActivities(scrollElement: HTMLElement): void {
    if (this.activePopup !== 'activities' || this.isCalendarLayoutView() || this.activitiesIsPaginating) {
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
      this.activeUserId,
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

  private updateEventExploreHeaderProgress(): void {
    if (this.activePopup !== 'eventExplore' && this.stackedPopup !== 'eventExplore') {
      this.eventExploreHeaderProgress = 0;
      return;
    }
    const listElement = this.eventExploreScrollRef?.nativeElement;
    if (!listElement) {
      this.eventExploreHeaderProgress = 0;
      return;
    }
    const maxVerticalScroll = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
    if (maxVerticalScroll <= 1) {
      this.eventExploreHeaderProgress = 0;
      return;
    }
    this.eventExploreHeaderProgress = AppUtils.clampNumber(listElement.scrollTop / maxVerticalScroll, 0, 1);
  }

  private maybeLoadMoreEventExplore(scrollElement: HTMLElement): void {
    if ((this.activePopup !== 'eventExplore' && this.stackedPopup !== 'eventExplore') || this.eventExploreIsPaginating) {
      return;
    }
    const cards = this.buildEventExploreCardsBase();
    this.ensureEventExplorePaginationState(cards.length);
    if (this.eventExploreVisibleCount >= cards.length) {
      return;
    }
    const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    if (this.eventExplorePaginationAwaitScrollReset) {
      if (remainingPx > 360) {
        this.eventExplorePaginationAwaitScrollReset = false;
      }
      return;
    }
    if (!this.shouldStartEventExplorePreload(scrollElement) && remainingPx > 520) {
      return;
    }
    this.startEventExplorePaginationLoad();
  }

  private shouldStartEventExplorePreload(scrollElement: HTMLElement): boolean {
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.event-explore-card'));
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

  private ensureEventExplorePaginationState(totalCards: number): void {
    const nextKey = this.eventExplorePaginationStateKey();
    if (nextKey === this.eventExplorePaginationKey) {
      return;
    }
    this.eventExplorePaginationKey = nextKey;
    this.eventExploreVisibleCount = this.eventExploreInitialLoadPending
      ? 0
      : Math.min(this.activitiesPageSize, totalCards);
    this.eventExplorePaginationAwaitScrollReset = false;
    this.cancelEventExplorePaginationLoad();
    this.updateEventExploreHeaderProgress();
  }

  private eventExplorePaginationStateKey(): string {
    return [
      this.activeUserId,
      this.eventExploreOrder,
      this.eventExploreFilterFriendsOnly ? 'friends' : 'all',
      this.eventExploreFilterHasRooms ? 'rooms' : 'all',
      AppUtils.normalizeText(this.eventExploreFilterTopic)
    ].join('|');
  }

  private startEventExplorePaginationLoad(allowEmptyResponse = false): void {
    if (this.eventExploreIsPaginating) {
      return;
    }
    if (!allowEmptyResponse) {
      const cards = this.buildEventExploreCardsBase();
      this.ensureEventExplorePaginationState(cards.length);
      if (this.eventExploreVisibleCount >= cards.length) {
        return;
      }
    }
    this.eventExploreIsPaginating = true;
    this.beginEventExploreHeaderProgressLoading();
    this.eventExploreLoadMoreTimer = setTimeout(() => {
      this.eventExploreLoadMoreTimer = null;
      const previousVisibleCount = this.eventExploreVisibleCount;
      const latestCards = this.buildEventExploreCardsBase();
      this.ensureEventExplorePaginationState(latestCards.length);
      if (latestCards.length > previousVisibleCount) {
        this.eventExploreVisibleCount = Math.min(previousVisibleCount + this.activitiesPageSize, latestCards.length);
      }
      this.eventExploreInitialLoadPending = false;
      this.eventExploreIsPaginating = false;
      this.eventExplorePaginationAwaitScrollReset = true;
      this.endEventExploreHeaderProgressLoading();
      this.updateEventExploreHeaderProgress();
    }, this.activitiesPaginationLoadDelayMs);
  }

  private cancelEventExplorePaginationLoad(): void {
    if (this.eventExploreLoadMoreTimer) {
      clearTimeout(this.eventExploreLoadMoreTimer);
      this.eventExploreLoadMoreTimer = null;
    }
    if (this.eventExploreIsPaginating) {
      this.eventExploreIsPaginating = false;
      this.endEventExploreHeaderProgressLoading();
    }
    this.eventExplorePaginationAwaitScrollReset = false;
    this.eventExploreInitialLoadPending = false;
  }

  private beginEventExploreHeaderProgressLoading(): void {
    this.eventExploreHeaderLoadingCounter += 1;
    if (this.eventExploreHeaderLoadingCounter > 1) {
      return;
    }
    this.eventExploreHeaderProgressLoading = true;
    this.eventExploreHeaderLoadingOverdue = false;
    this.eventExploreHeaderLoadingProgress = 0.02;
    this.eventExploreHeaderLoadingStartedAtMs = performance.now();
    this.flushActivitiesHeaderProgress();
    if (this.eventExploreHeaderLoadingCompleteTimer) {
      clearTimeout(this.eventExploreHeaderLoadingCompleteTimer);
      this.eventExploreHeaderLoadingCompleteTimer = null;
    }
    if (this.eventExploreHeaderLoadingInterval) {
      clearInterval(this.eventExploreHeaderLoadingInterval);
      this.eventExploreHeaderLoadingInterval = null;
    }
    this.updateEventExploreHeaderLoadingWindow();
    this.eventExploreHeaderLoadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.updateEventExploreHeaderLoadingWindow();
        this.flushActivitiesHeaderProgress();
      }, this.activitiesHeaderLoadingTickMs)
    );
  }

  private endEventExploreHeaderProgressLoading(): void {
    if (this.eventExploreHeaderLoadingCounter === 0) {
      return;
    }
    this.eventExploreHeaderLoadingCounter = Math.max(0, this.eventExploreHeaderLoadingCounter - 1);
    if (this.eventExploreHeaderLoadingCounter !== 0) {
      return;
    }
    this.completeEventExploreHeaderLoading();
  }

  private completeEventExploreHeaderLoading(): void {
    if (this.eventExploreHeaderLoadingInterval) {
      clearInterval(this.eventExploreHeaderLoadingInterval);
      this.eventExploreHeaderLoadingInterval = null;
    }
    this.eventExploreHeaderLoadingProgress = 1;
    this.eventExploreHeaderLoadingOverdue = false;
    this.flushActivitiesHeaderProgress();
    if (this.eventExploreHeaderLoadingCompleteTimer) {
      clearTimeout(this.eventExploreHeaderLoadingCompleteTimer);
    }
    this.eventExploreHeaderLoadingCompleteTimer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.eventExploreHeaderLoadingCounter !== 0) {
            return;
          }
          this.eventExploreHeaderProgressLoading = false;
          this.eventExploreHeaderLoadingProgress = 0;
          this.eventExploreHeaderLoadingOverdue = false;
          this.eventExploreHeaderLoadingStartedAtMs = 0;
          this.eventExploreHeaderLoadingCompleteTimer = null;
          this.updateEventExploreHeaderProgress();
          this.refreshActivitiesHeaderProgressSoon();
          this.flushActivitiesHeaderProgress();
        });
      }, 100)
    );
  }

  private updateEventExploreHeaderLoadingWindow(): void {
    if (!this.eventExploreHeaderProgressLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.eventExploreHeaderLoadingStartedAtMs);
    const nextProgress = AppUtils.clampNumber(elapsed / this.activitiesHeaderLoadingWindowMs, 0, 1);
    this.eventExploreHeaderLoadingProgress = Math.max(this.eventExploreHeaderLoadingProgress, nextProgress);
    this.eventExploreHeaderLoadingOverdue =
      elapsed >= this.activitiesHeaderLoadingWindowMs && this.eventExploreHeaderLoadingCounter > 0;
  }

  private clearEventExploreHeaderLoadingAnimation(): void {
    if (this.eventExploreHeaderLoadingInterval) {
      clearInterval(this.eventExploreHeaderLoadingInterval);
      this.eventExploreHeaderLoadingInterval = null;
    }
    if (this.eventExploreHeaderLoadingCompleteTimer) {
      clearTimeout(this.eventExploreHeaderLoadingCompleteTimer);
      this.eventExploreHeaderLoadingCompleteTimer = null;
    }
    this.eventExploreHeaderLoadingCounter = 0;
    this.eventExploreHeaderLoadingProgress = 0;
    this.eventExploreHeaderProgressLoading = false;
    this.eventExploreHeaderLoadingOverdue = false;
    this.eventExploreHeaderLoadingStartedAtMs = 0;
    this.flushActivitiesHeaderProgress();
  }

  private beginChatHeaderProgressLoading(): void {
    this.chatHeaderLoadingCounter += 1;
    if (this.chatHeaderLoadingCounter > 1) {
      return;
    }
    this.chatHeaderProgressLoading = true;
    this.chatHeaderLoadingOverdue = false;
    this.chatHeaderLoadingProgress = 0.02;
    this.chatHeaderLoadingStartedAtMs = performance.now();
    this.flushActivitiesHeaderProgress();
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
      this.chatHeaderLoadingCompleteTimer = null;
    }
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    this.updateChatHeaderLoadingWindow();
    this.chatHeaderLoadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.updateChatHeaderLoadingWindow();
        this.flushActivitiesHeaderProgress();
      }, this.activitiesHeaderLoadingTickMs)
    );
  }

  private endChatHeaderProgressLoading(): void {
    if (this.chatHeaderLoadingCounter === 0) {
      return;
    }
    this.chatHeaderLoadingCounter = Math.max(0, this.chatHeaderLoadingCounter - 1);
    if (this.chatHeaderLoadingCounter !== 0) {
      return;
    }
    this.completeChatHeaderLoading();
  }

  private completeChatHeaderLoading(): void {
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    this.chatHeaderLoadingProgress = 1;
    this.chatHeaderLoadingOverdue = false;
    this.flushActivitiesHeaderProgress();
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
    }
    this.chatHeaderLoadingCompleteTimer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.chatHeaderLoadingCounter !== 0) {
            return;
          }
          this.chatHeaderProgressLoading = false;
          this.chatHeaderLoadingProgress = 0;
          this.chatHeaderLoadingOverdue = false;
          this.chatHeaderLoadingStartedAtMs = 0;
          this.chatHeaderLoadingCompleteTimer = null;
          this.flushActivitiesHeaderProgress();
          if (this.chatInitialLoadPending) {
            this.chatInitialLoadPending = false;
            this.scrollChatToBottomAfterLoad();
          }
        });
      }, 100)
    );
  }

  private scrollChatToBottomAfterLoad(): void {
    if (this.chatHeaderProgressLoading || !this.selectedChat) {
      return;
    }
    const isChatOpen = (this.activePopup === 'chat' || this.stackedPopup === 'chat');
    if (!isChatOpen) {
      return;
    }
    const run = () => this.scrollChatToBottom();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private updateChatHeaderLoadingWindow(): void {
    if (!this.chatHeaderProgressLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.chatHeaderLoadingStartedAtMs);
    const nextProgress = AppUtils.clampNumber(elapsed / this.activitiesHeaderLoadingWindowMs, 0, 1);
    this.chatHeaderLoadingProgress = Math.max(this.chatHeaderLoadingProgress, nextProgress);
    this.chatHeaderLoadingOverdue = elapsed >= this.activitiesHeaderLoadingWindowMs && this.chatHeaderLoadingCounter > 0;
  }

  private clearChatHeaderLoadingAnimation(): void {
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
      this.chatHeaderLoadingCompleteTimer = null;
    }
    this.chatHeaderLoadingCounter = 0;
    this.chatHeaderLoadingProgress = 0;
    this.chatHeaderProgressLoading = false;
    this.chatHeaderLoadingOverdue = false;
    this.chatHeaderLoadingStartedAtMs = 0;
    this.flushActivitiesHeaderProgress();
  }

  private resetEventExploreScroll(): void {
    this.cancelEventExplorePaginationLoad();
    this.clearEventExploreHeaderLoadingAnimation();
    this.eventExplorePaginationKey = this.eventExplorePaginationStateKey();
    this.eventExploreVisibleCount = 0;
    this.eventExplorePaginationAwaitScrollReset = false;
    this.eventExploreInitialLoadPending = true;
    this.startEventExplorePaginationLoad(true);
    setTimeout(() => {
      const scrollElement = this.eventExploreScrollRef?.nativeElement;
      if (!scrollElement) {
        this.eventExploreStickyValue = this.eventExploreGroupedCards[0]?.label ?? 'No items';
        this.updateEventExploreHeaderProgress();
        return;
      }
      scrollElement.scrollTop = 0;
      this.updateEventExploreStickyFromScroll(scrollElement);
      this.updateEventExploreHeaderProgress();
    }, 0);
  }

  private syncActivitiesCalendarBadgeDelay(): void {
    if (this.activePopup !== 'activities' || !this.isCalendarLayoutView()) {
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
    if (this.activePopup !== 'activities' || !this.isCalendarLayoutView()) {
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
    const pageKey = pages[pageIndex]?.key ?? '';
    if (!pageKey) {
      return '';
    }
    return pageKey;
  }

  private calendarBadgeDelayKey(pageKey: string): string {
    return `${this.activitiesView}:${pageKey}`;
  }

  private refreshActivitiesHeaderProgressSoon(): void {
    const refresh = () => this.updateActivitiesHeaderProgress();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(refresh));
      return;
    }
    setTimeout(refresh, 0);
  }

  private refreshActivitiesStickyHeaderSoon(): void {
    const refresh = () => this.updateActivitiesStickyHeader(this.activitiesScrollRef?.nativeElement?.scrollTop ?? 0);
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

  private syncTicketScrollOnOpen(): void {
    const scrollElement = this.ticketScrollRef?.nativeElement;
    if (!scrollElement) {
      this.seedTicketStickyHeader();
      return;
    }
    scrollElement.scrollTop = 0;
    this.isTicketListScrollableNow();
    this.updateTicketStickyHeader(0);
  }

  private seedTicketStickyHeader(): void {
    this.ticketStickyValue = this.groupedTicketRows[0]?.label ?? 'No tickets';
  }

  private updateTicketStickyHeader(scrollTop: number): void {
    const groups = this.groupedTicketRows;
    if (groups.length === 0) {
      this.ticketStickyValue = 'No tickets';
      return;
    }
    const scrollElement = this.ticketScrollRef?.nativeElement;
    if (!scrollElement) {
      this.ticketStickyValue = groups[0].label;
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.activities-sticky-header');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = scrollTop + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.ticket-row-item'));
    this.isTicketListScrollableNow();
    if (rows.length === 0) {
      this.ticketStickyValue = groups[0].label;
      return;
    }
    if (scrollTop <= 1) {
      this.ticketStickyValue = rows[0].dataset['groupLabel'] ?? groups[0].label;
      return;
    }
    const alignmentTolerancePx = 2;
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - alignmentTolerancePx) ??
      rows[rows.length - 1];
    this.ticketStickyValue = activeRow.dataset['groupLabel'] ?? groups[0].label;
  }

  private ticketGroupLabel(dateIso: string): string {
    const parsed = new Date(dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  private encodeTicketPayload(payload: AppTypes.TicketScanPayload): string {
    try {
      const json = JSON.stringify(payload);
      if (typeof TextEncoder === 'undefined' || typeof btoa === 'undefined') {
        return json;
      }
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      bytes.forEach(value => {
        binary += String.fromCharCode(value);
      });
      return btoa(binary);
    } catch {
      return JSON.stringify(payload);
    }
  }

  private decodeTicketPayload(encoded: string): AppTypes.TicketScanPayload | null {
    try {
      if (typeof TextDecoder === 'undefined' || typeof atob === 'undefined') {
        return null;
      }
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as Partial<AppTypes.TicketScanPayload>;
      if (
        typeof parsed.code !== 'string'
        || typeof parsed.holderUserId !== 'string'
        || typeof parsed.holderName !== 'string'
        || typeof parsed.eventId !== 'string'
        || typeof parsed.eventTitle !== 'string'
        || typeof parsed.eventSubtitle !== 'string'
        || typeof parsed.eventTimeframe !== 'string'
        || typeof parsed.issuedAtIso !== 'string'
      ) {
        return null;
      }
      return {
        code: parsed.code,
        holderUserId: parsed.holderUserId,
        holderName: parsed.holderName,
        holderAge: typeof parsed.holderAge === 'number' ? parsed.holderAge : this.activeUser.age,
        holderCity: typeof parsed.holderCity === 'string' ? parsed.holderCity : this.activeUser.city,
        holderRole: parsed.holderRole === 'Admin' || parsed.holderRole === 'Manager' ? parsed.holderRole : 'Member',
        eventId: parsed.eventId,
        eventTitle: parsed.eventTitle,
        eventSubtitle: parsed.eventSubtitle,
        eventTimeframe: parsed.eventTimeframe,
        eventDateLabel: typeof parsed.eventDateLabel === 'string' ? parsed.eventDateLabel : parsed.eventTimeframe,
        issuedAtIso: parsed.issuedAtIso
      };
    } catch {
      return null;
    }
  }

  private startTicketScannerReading(): void {
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    void this.startTicketScannerSession();
  }

  private selectedTicketPayload(): AppTypes.TicketScanPayload | null {
    const decoded = this.decodeTicketPayload(this.selectedTicketCodeValue);
    if (decoded) {
      return decoded;
    }
    if (!this.selectedTicketRow) {
      return null;
    }
    return {
      code: this.selectedTicketCodeValue,
      holderUserId: this.activeUser.id,
      holderName: this.activeUser.name,
      holderAge: this.activeUser.age,
      holderCity: this.activeUser.city,
      holderRole: this.selectedTicketRow.isAdmin ? 'Admin' : 'Member',
      eventId: this.selectedTicketRow.id,
      eventTitle: this.selectedTicketRow.title,
      eventSubtitle: this.selectedTicketRow.subtitle,
      eventTimeframe: this.selectedTicketRow.detail,
      eventDateLabel: this.activityDateLabel(this.selectedTicketRow),
      issuedAtIso: AppUtils.toIsoDateTime(new Date())
    };
  }

  private ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    const user = this.ticketPayloadUser(payload);
    if (!user) {
      return '';
    }
    const slots = this.profileImageSlotsByUser[user.id] ?? [];
    const first = slots.find((slot): slot is string => typeof slot === 'string' && slot.trim().length > 0);
    return first ?? this.profilePortraitUrlForUser(user, 0, 'ticket-scan');
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

  private isTicketListScrollableNow(): boolean {
    const scrollElement = this.ticketScrollRef?.nativeElement;
    if (!scrollElement) {
      return this.ticketListScrollable;
    }
    const scrollable = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight) > 1;
    this.ticketListScrollable = scrollable;
    return scrollable;
  }

  private cancelTicketScannerTimer(): void {
    if (!this.ticketScannerTimer) {
      return;
    }
    clearTimeout(this.ticketScannerTimer);
    this.ticketScannerTimer = null;
  }

  private async startTicketScannerSession(): Promise<void> {
    if (this.stackedPopup !== 'ticketScanner') {
      return;
    }
    const videoElement = await this.waitForTicketScannerVideo();
    if (!videoElement) {
      this.startTicketScannerFallbackTimer();
      return;
    }
    const stream = await this.startTicketScannerMediaStream();
    if (!stream) {
      this.startTicketScannerFallbackTimer();
      return;
    }
    this.ticketScannerMediaStream = stream;
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'true');
    try {
      await videoElement.play();
    } catch {
      this.startTicketScannerFallbackTimer();
      return;
    }
    const detector = this.createBrowserBarcodeDetector();
    if (!detector) {
      if (this.selectedTicketCodeValue) {
        this.startTicketScannerFallbackTimer();
      }
      return;
    }
    this.startTicketScannerDetectionLoop(detector, videoElement);
  }

  private startTicketScannerFallbackTimer(): void {
    this.cancelTicketScannerTimer();
    this.ticketScannerTimer = setTimeout(() => {
      this.ticketScannerTimer = null;
      const decoded = this.decodeTicketPayload(this.selectedTicketCodeValue);
      if (decoded) {
        this.applyTicketScannerSuccess(decoded);
        return;
      }
      if (this.selectedTicketRow) {
        this.applyTicketScannerSuccess(this.createTicketScanPayload(this.selectedTicketRow));
        return;
      }
      this.ticketScannerResult = null;
      this.ticketScannerState = 'idle';
      this.stopTicketScannerCamera();
      this.cdr.markForCheck();
    }, 1200);
  }

  private startTicketScannerDetectionLoop(detector: AppTypes.BrowserBarcodeDetector, videoElement: HTMLVideoElement): void {
    this.cancelTicketScannerDetectionLoop();
    this.ticketScannerDetectBusy = false;
    const tick = (): void => {
      if (this.stackedPopup !== 'ticketScanner' || this.ticketScannerState !== 'reading') {
        this.cancelTicketScannerDetectionLoop();
        return;
      }
      if (!this.ticketScannerDetectBusy && videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        this.ticketScannerDetectBusy = true;
        void detector.detect(videoElement)
          .then(results => {
            const payload = this.ticketScannerPayloadFromResults(results);
            if (payload) {
              this.applyTicketScannerSuccess(payload);
            }
          })
          .catch(() => {
            // Ignore intermittent detector read errors and keep scanning.
          })
          .finally(() => {
            this.ticketScannerDetectBusy = false;
          });
      }
      this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
    };
    this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
  }

  private ticketScannerPayloadFromResults(results: AppTypes.BrowserBarcodeDetectorResult[]): AppTypes.TicketScanPayload | null {
    for (const result of results) {
      const raw = `${result.rawValue ?? ''}`.trim();
      if (!raw) {
        continue;
      }
      const decoded = this.decodeTicketPayload(raw);
      if (decoded) {
        return decoded;
      }
    }
    return null;
  }

  private applyTicketScannerSuccess(payload: AppTypes.TicketScanPayload): void {
    this.cancelTicketScannerTimer();
    this.ticketScannerResult = payload;
    this.ticketScannerState = 'success';
    this.stopTicketScannerCamera();
    this.cdr.markForCheck();
  }

  private cancelTicketScannerDetectionLoop(): void {
    if (this.ticketScannerDetectionFrame !== null) {
      cancelAnimationFrame(this.ticketScannerDetectionFrame);
      this.ticketScannerDetectionFrame = null;
    }
  }

  private stopTicketScannerCamera(): void {
    this.cancelTicketScannerDetectionLoop();
    const videoElement = this.ticketScannerVideoRef?.nativeElement;
    if (videoElement) {
      try {
        videoElement.pause();
      } catch {
        // no-op
      }
      videoElement.srcObject = null;
    }
    if (this.ticketScannerMediaStream) {
      this.ticketScannerMediaStream.getTracks().forEach(track => track.stop());
      this.ticketScannerMediaStream = null;
    }
    this.ticketScannerDetectBusy = false;
  }

  private async waitForTicketScannerVideo(): Promise<HTMLVideoElement | null> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const videoElement = this.ticketScannerVideoRef?.nativeElement;
      if (videoElement) {
        return videoElement;
      }
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });
    }
    return null;
  }

  private async startTicketScannerMediaStream(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        return null;
      }
    }
  }

  private createBrowserBarcodeDetector(): AppTypes.BrowserBarcodeDetector | null {
    const maybeCtor = (globalThis as { BarcodeDetector?: AppTypes.BrowserBarcodeDetectorConstructor }).BarcodeDetector;
    if (typeof maybeCtor !== 'function') {
      return null;
    }
    try {
      return new maybeCtor({ formats: ['qr_code'] });
    } catch {
      try {
        return new maybeCtor();
      } catch {
        return null;
      }
    }
  }

}
