import { ChangeDetectorRef, Component, ElementRef, HostListener, Injectable, NgZone, ViewChild, inject } from '@angular/core';
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
import { FormsModule } from '@angular/forms';
import { AlertService } from './shared/alert.service';
import {
  DEMO_CHAT_BY_USER,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  DEMO_RATES_BY_USER,
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
import { environment } from '../environments/environment';
import { LazyBgImageDirective } from './shared/lazy-bg-image.directive';

type MenuSection = 'game' | 'chat' | 'invitations' | 'events' | 'hosting';

type PopupType =
  | 'activities'
  | 'chat'
  | 'chatMembers'
  | 'impressionsHost'
  | 'impressionsMember'
  | 'assetsCar'
  | 'assetsAccommodation'
  | 'assetsSupplies'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'menuEvent'
  | 'hostingEvent'
  | 'invitationActions'
  | 'eventEditor'
  | 'eventExplore'
  | 'profileEditor'
  | 'imageEditor'
  | 'imageUpload'
  | 'supplyDetail'
  | 'assetMembers'
  | 'activityMembers'
  | 'valuesSelector'
  | 'interestSelector'
  | 'experienceSelector'
  | 'logoutConfirm'
  | null;

interface SupplyContext {
  subEventId: string;
  subEventTitle: string;
  type: string;
}

interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: 'woman' | 'man';
}

interface ChatPopupMessage {
  id: string;
  sender: string;
  senderAvatar: ChatReadAvatar;
  text: string;
  time: string;
  mine: boolean;
  readBy: ChatReadAvatar[];
}

type ActivitiesPrimaryFilter = 'chats' | 'invitations' | 'events' | 'hosting' | 'rates';
type ActivitiesSecondaryFilter = 'recent' | 'relevant' | 'past';
type ActivitiesView = 'month' | 'week' | 'day' | 'distance';
type RateFilterKey =
  | 'individual-given'
  | 'individual-received'
  | 'individual-mutual'
  | 'individual-met'
  | 'pair-given'
  | 'pair-received';

type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

interface ActivityListRow {
  id: string;
  type: ActivitiesPrimaryFilter;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceKm: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  source: ChatMenuItem | InvitationMenuItem | EventMenuItem | HostingMenuItem | RateMenuItem;
}

interface ActivityGroup {
  label: string;
  rows: ActivityListRow[];
}

interface CalendarDayCell {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  rows: ActivityListRow[];
}

interface CalendarMonthPage {
  key: string;
  label: string;
  weeks: CalendarMonthWeek[];
}

interface CalendarMonthWeek {
  start: Date;
  end: Date;
  days: CalendarDayCell[];
  spans: CalendarMonthSpan[];
}

interface CalendarMonthSpan {
  key: string;
  row: ActivityListRow;
  startCol: number;
  endCol: number;
  lane: number;
}

interface CalendarWeekPage {
  key: string;
  label: string;
  days: CalendarDayCell[];
}

interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

interface CalendarTimedBadge {
  row: ActivityListRow;
  topPct: number;
  heightPct: number;
}

type SubEventCard = (typeof EVENT_EDITOR_SAMPLE.subEvents)[number];
type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive';
type DetailPrivacy = 'Public' | 'Friends' | 'Hosts' | 'Private';

interface ProfileDetailFormRow {
  label: string;
  value: string;
  privacy: DetailPrivacy;
  options: string[];
}

interface ProfileDetailFormGroup {
  title: string;
  rows: ProfileDetailFormRow[];
}

interface ValuesOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

interface InterestOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

interface ExperienceEntry {
  id: string;
  type: 'Workspace' | 'School' | 'Online Session' | 'Additional Project';
  title: string;
  org: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  description: string;
}

interface MobileProfileSelectorOption {
  value: string;
  label: string;
  icon: string;
  toneClass?: string;
  badge?: number;
  disabled?: boolean;
}

interface MobileProfileSelectorSheet {
  title: string;
  selected: string;
  options: MobileProfileSelectorOption[];
  context:
    | { kind: 'profileStatus' }
    | { kind: 'physique' }
    | { kind: 'language' }
    | { kind: 'detailPrivacy'; groupIndex: number; rowIndex: number }
    | { kind: 'experiencePrivacy'; type: 'workspace' | 'school' }
    | { kind: 'detailValue'; groupIndex: number; rowIndex: number }
    | { kind: 'experienceType' }
    | { kind: 'assetFilter' }
    | { kind: 'activitiesPrimaryFilter' }
    | { kind: 'activitiesRateFilter' };
}

type AssetType = 'Car' | 'Accommodation' | 'Supplies';
type AssetRequestAction = 'accept' | 'remove';
type AssetRequestStatus = 'pending' | 'accepted';
type ActivityMemberStatus = 'pending' | 'accepted';
type ActivityPendingSource = 'admin' | 'member' | null;
type ActivityInviteSort = 'recent' | 'relevant';
type ActivityMemberRequestKind = 'invite' | 'join' | null;

interface AssetMemberRequest {
  id: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  status: AssetRequestStatus;
  note: string;
}

interface AssetCard {
  id: string;
  type: AssetType;
  title: string;
  subtitle: string;
  city: string;
  capacityTotal: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  requests: AssetMemberRequest[];
}

interface ActivityMemberEntry {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  status: ActivityMemberStatus;
  pendingSource: ActivityPendingSource;
  requestKind: ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  relevance: number;
  avatarUrl: string;
}

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
    return super.format(date, displayFormat);
  }
}

const APP_DATE_FORMATS = {
  parse: {
    dateInput: 'ymdInput'
  },
  display: {
    dateInput: 'ymdInput',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

@Component({
  selector: 'app-root',
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
    FormsModule,
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
  public readonly alertService = inject(AlertService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly users = DEMO_USERS;
  protected readonly profileTopTraits = PROFILE_PERSONALITY_TOP3;
  protected readonly profilePriorityTags = PROFILE_PRIORITY_TAGS;
  protected readonly profilePillars = PROFILE_PILLARS;
  protected profileDetailsForm: ProfileDetailFormGroup[] = [];
  protected readonly profileExperience = PROFILE_EXPERIENCE;
  // Labels aligned with /plans context files:
  // - event_vibes.txt
  // - personality_traits.txt
  // - personality_interest.txt
  // - feature_list.txt
  protected readonly vibeCategories = ['Energetic', 'Social', 'Deep', 'Relaxed', 'Creative', 'Exclusive', 'Focused'];
  protected readonly hostedEventTypes = ['Road Trip', 'Game Night', 'Brunch', 'Hiking', 'Coffee Meetup', 'Sports'];
  protected readonly vibeIcons: Record<string, string> = {
    Energetic: '🔥',
    Social: '💬',
    Deep: '🧠',
    Relaxed: '🌿',
    Creative: '🎨',
    Exclusive: '🥂',
    Focused: '🎯'
  };
  protected readonly categoryIcons: Record<string, string> = {
    Sports: '🏅',
    'Road Trip': '🛣️',
    Outdoors: '🌲',
    Games: '🎮',
    Culture: '🎭'
  };
  protected readonly memberTraitIcons: Record<string, string> = {
    Adventurer: '🔥',
    'Deep Thinker': '🧠',
    Empath: '💛'
  };
  protected readonly eventEditor = EVENT_EDITOR_SAMPLE;
  protected readonly physiqueOptions = ['Slim', 'Lean', 'Athletic', 'Fit', 'Curvy', 'Average', 'Muscular'];
  protected languageSuggestions = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Hungarian',
    'Romanian',
    'Polish',
    'Dutch',
    'Turkish',
    'Arabic',
    'Hindi',
    'Japanese',
    'Korean',
    'Mandarin'
  ];
  protected readonly profileStatusOptions: Array<{ value: ProfileStatus; icon: string }> = [
    { value: 'public', icon: 'public' },
    { value: 'friends only', icon: 'groups' },
    { value: 'host only', icon: 'stadium' },
    { value: 'inactive', icon: 'visibility_off' }
  ];
  protected readonly profileDetailValueOptions: Record<string, string[]> = {
    Drinking: ['Never', 'Socially', 'Occasionally', 'Weekends only'],
    Smoking: ['Never', 'Socially', 'Occasionally', 'Trying to quit'],
    Workout: ['Daily', '4x / week', '2-3x / week', 'Rarely'],
    Pets: ['Dog-friendly', 'Cat-friendly', 'All pets welcome', 'No pets'],
    'Family plans': ['Wants children', 'Open to children', 'Not sure yet', 'Does not want children'],
    Children: ['No', 'Yes', 'Prefer not to say'],
    'Love style': ['Long-term partnership', 'Slow-burn connection', 'Open relationship', 'Exploring'],
    'Communication style': ['Direct + warm', 'Calm + reflective', 'Playful + light', 'Honest + concise'],
    'Sexual orientation': ['Straight', 'Bisexual', 'Gay', 'Lesbian', 'Pansexual', 'Asexual', 'Prefer not to say'],
    Gender: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
    Religion: ['Spiritual but not religious', 'Christian', 'Muslim', 'Jewish', 'Buddhist', 'Hindu', 'Atheist', 'Prefer not to say'],
    Values: [
      'Family-first, social impact, balanced life',
      'Career-driven, growth-oriented, adventurous',
      'Sustainability, empathy, community',
      'Creativity, freedom, authenticity'
    ]
  };
  protected readonly beliefsValuesOptionGroups: ValuesOptionGroup[] = [
    {
      title: 'Relationship & Family',
      shortTitle: 'Family',
      icon: '👪',
      toneClass: 'section-family',
      options: [
        'Long-term partnership',
        'Marriage-oriented',
        'Casual dating',
        'Open / Exploring',
        'Family-first',
        'Wants children',
        'Independent lifestyle'
      ]
    },
    {
      title: 'Life Focus & Ambition',
      shortTitle: 'Ambition',
      icon: '🎯',
      toneClass: 'section-ambition',
      options: [
        'Career-focused',
        'Entrepreneurial',
        'Stability-focused',
        'Balanced work-life',
        'Freedom-oriented',
        'Goal-driven'
      ]
    },
    {
      title: 'Lifestyle Orientation',
      shortTitle: 'Lifestyle',
      icon: '🌿',
      toneClass: 'section-lifestyle',
      options: [
        'Health & wellness focused',
        'Fitness-driven',
        'Mindfulness-oriented',
        'Social / party lifestyle',
        'Calm / home-centered',
        'Adventure-driven',
        'Balanced lifestyle'
      ]
    },
    {
      title: 'Beliefs & Worldview',
      shortTitle: 'Beliefs',
      icon: '✨',
      toneClass: 'section-beliefs',
      options: [
        'Faith-oriented',
        'Spiritual but not religious',
        'Secular',
        'Traditional values',
        'Progressive values',
        'Community-driven',
        'Social impact oriented',
        'Environmentally conscious',
        'Politically engaged',
        'Apolitical'
      ]
    }
  ];
  protected readonly interestOptionGroups: InterestOptionGroup[] = [
    {
      title: 'Social & Lifestyle',
      shortTitle: 'Social',
      icon: '🥂',
      toneClass: 'section-social',
      options: ['#GoingOut', '#Nightlife', '#StayingIn', '#Brunch', '#WineTasting', '#CoffeeDates', '#ContentCreation', '#InfluencerLife']
    },
    {
      title: 'Arts & Entertainment',
      shortTitle: 'Arts',
      icon: '🎭',
      toneClass: 'section-arts',
      options: ['#Music', '#Concerts', '#Festivals', '#Movies', '#TVShows', '#Theatre', '#Gaming', '#Anime', '#Books', '#Photography', '#Creativity']
    },
    {
      title: 'Food & Experiences',
      shortTitle: 'Food',
      icon: '🍽',
      toneClass: 'section-food',
      options: ['#Foodie', '#FineDining', '#StreetFood', '#Cooking', '#Cocktails', '#CraftBeer', '#Travel', '#LuxuryExperiences']
    },
    {
      title: 'Active & Adventure',
      shortTitle: 'Active',
      icon: '🏕',
      toneClass: 'section-active',
      options: ['#Sports', '#Gym', '#Running', '#Hiking', '#Outdoors', '#ExtremeSports', '#Yoga', '#Fitness']
    },
    {
      title: 'Mind & Wellness',
      shortTitle: 'Mind',
      icon: '🧘',
      toneClass: 'section-mind',
      options: ['#Wellness', '#Meditation', '#SelfDevelopment', '#MentalHealth', '#Spirituality', '#Biohacking', '#HealthyLifestyle']
    },
    {
      title: 'Values & Identity',
      shortTitle: 'Identity',
      icon: '🌍',
      toneClass: 'section-identity',
      options: ['#Sustainability', '#Entrepreneurship', '#CareerDriven', '#FamilyOriented', '#Activism', '#Tech', '#Minimalism']
    }
  ];

  protected showUserMenu = false;
  protected showUserSelector = !environment.loginEnabled;
  protected activePopup: PopupType = null;
  protected stackedPopup: PopupType = null;
  protected popupReturnTarget: PopupType = null;
  protected openPrivacyFab: { groupIndex: number; rowIndex: number } | null = null;
  protected privacyFabJustSelectedKey: string | null = null;
  protected mobileProfileSelectorSheet: MobileProfileSelectorSheet | null = null;
  protected valuesSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected valuesSelectorSelected: string[] = [];
  protected interestSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected interestSelectorSelected: string[] = [];
  protected experienceVisibility: Record<'workspace' | 'school', DetailPrivacy> = {
    workspace: 'Public',
    school: 'Public'
  };
  protected readonly experienceFilterOptions: Array<'All' | 'Workspace' | 'School'> = ['All', 'Workspace', 'School'];
  protected readonly experienceTypeOptions: Array<ExperienceEntry['type']> = ['Workspace', 'School', 'Online Session', 'Additional Project'];
  protected experienceFilter: 'All' | 'Workspace' | 'School' = 'All';
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected showExperienceForm = false;
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected experienceForm: Omit<ExperienceEntry, 'id'> = {
    type: 'Workspace',
    title: '',
    org: '',
    city: '',
    dateFrom: '',
    dateTo: '',
    description: ''
  };
  protected experienceEntries: ExperienceEntry[] = this.buildSampleExperienceEntries();
  protected readonly assetFilterOptions: AssetType[] = ['Car', 'Accommodation', 'Supplies'];
  protected assetFilter: AssetType = 'Car';
  protected assetCards: AssetCard[] = this.buildSampleAssetCards();
  protected showAssetForm = false;
  protected editingAssetId: string | null = null;
  protected selectedAssetCardId: string | null = null;
  protected pendingAssetDeleteCardId: string | null = null;
  protected pendingAssetMemberAction: { cardId: string; memberId: string; action: AssetRequestAction } | null = null;
  protected assetForm: Omit<AssetCard, 'id' | 'requests'> = {
    type: 'Car',
    title: '',
    subtitle: '',
    city: '',
    capacityTotal: 4,
    details: '',
    imageUrl: '',
    sourceLink: ''
  };
  protected activeUserId = this.getInitialUserId();

  protected activeMenuSection: MenuSection = 'chat';
  protected activitiesPrimaryFilter: ActivitiesPrimaryFilter = 'chats';
  protected activitiesSecondaryFilter: ActivitiesSecondaryFilter = 'recent';
  protected activitiesRateFilter: RateFilterKey = 'individual-given';
  protected activitiesView: ActivitiesView = 'week';
  protected showActivitiesViewPicker = false;
  protected showActivitiesSecondaryPicker = false;
  protected activitiesStickyValue = '';
  protected activitiesBottomPullPx = 0;
  protected activitiesBottomPullReleasing = false;
  protected activitiesBottomPullArmed = false;
  protected readonly activitiesPageSize = 10;
  protected pendingActivityDeleteRow: ActivityListRow | null = null;
  protected pendingActivityAction: 'delete' | 'exit' = 'delete';
  protected selectedActivityMembers: ActivityMemberEntry[] = [];
  protected selectedActivityMembersTitle = '';
  protected selectedActivityMembersRowId: string | null = null;
  protected selectedActivityMembersRow: ActivityListRow | null = null;
  protected activityInviteSort: ActivityInviteSort = 'recent';
  protected showActivityInviteSortPicker = false;
  protected selectedActivityInviteUserIds: string[] = [];
  protected superStackedPopup: 'activityInviteFriends' | null = null;
  private readonly activityMembersByRowId: Record<string, ActivityMemberEntry[]> = {};
  protected readonly activityRatingScale = Array.from({ length: 10 }, (_, index) => index + 1);
  private readonly weekCalendarStartHour = 6;
  private readonly weekCalendarEndHour = 23;
  private readonly weekCalendarSlotHeightPx = 34;
  protected selectedActivityRateId: string | null = null;
  private readonly activityRateDraftById: Record<string, number> = {};
  private readonly activityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
  private readonly pendingActivityRateDirectionOverrideById: Partial<Record<string, RateMenuItem['direction']>> = {};
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
  private calendarMonthPagesCache: CalendarMonthPage[] = [];
  private calendarWeekPagesCache: CalendarWeekPage[] = [];
  protected readonly activitiesPrimaryFilters: Array<{ key: ActivitiesPrimaryFilter; label: string; icon: string }> = [
    { key: 'rates', label: 'Rates', icon: 'star' },
    { key: 'chats', label: 'Chats', icon: 'chat' },
    { key: 'invitations', label: 'Invitations', icon: 'mail' },
    { key: 'events', label: 'Events', icon: 'event' },
    { key: 'hosting', label: 'Hosting', icon: 'stadium' }
  ];
  protected readonly activitiesSecondaryFilters: Array<{ key: ActivitiesSecondaryFilter; label: string; icon: string }> = [
    { key: 'recent', label: 'Recent', icon: 'schedule' },
    { key: 'relevant', label: 'Relevant', icon: 'auto_awesome' },
    { key: 'past', label: 'Past', icon: 'history' }
  ];
  protected readonly rateFilters: Array<{ key: RateFilterKey; label: string }> = [
    { key: 'individual-given', label: 'Given' },
    { key: 'individual-received', label: 'Received' },
    { key: 'individual-mutual', label: 'Mutual' },
    { key: 'individual-met', label: 'Met' },
    { key: 'pair-given', label: 'Given' },
    { key: 'pair-received', label: 'Received' }
  ];
  protected readonly rateFilterEntries: RateFilterEntry[] = [
    { kind: 'group', label: 'Single Rate' },
    { kind: 'item', key: 'individual-given', label: 'Given' },
    { kind: 'item', key: 'individual-received', label: 'Received' },
    { kind: 'item', key: 'individual-mutual', label: 'Mutual' },
    { kind: 'item', key: 'individual-met', label: 'Met' },
    { kind: 'group', label: 'Pair Rate' },
    { kind: 'item', key: 'pair-given', label: 'Given' },
    { kind: 'item', key: 'pair-received', label: 'Received' }
  ];
  protected readonly activitiesViewOptions: Array<{ key: ActivitiesView; label: string; icon: string }> = [
    { key: 'month', label: 'Month', icon: 'calendar_month' },
    { key: 'week', label: 'Week', icon: 'date_range' },
    { key: 'day', label: 'Day', icon: 'today' },
    { key: 'distance', label: 'Distance', icon: 'social_distance' }
  ];
  protected readonly eventDatesById: Record<string, string> = {
    e1: '2026-02-27T09:00:00',
    e2: '2026-03-08T10:00:00',
    e3: '2026-03-12T19:30:00',
    e6: '2026-03-14T17:00:00',
    e7: '2026-03-16T09:30:00',
    e8: '2026-02-27T11:15:00',
    e9: '2026-02-27T13:30:00',
    e10: '2026-03-14T18:15:00',
    e11: '2026-03-28T09:00:00',
    e12: '2026-04-26T10:00:00',
    e4: '2026-02-28T08:00:00',
    e5: '2026-03-03T18:00:00'
  };
  protected readonly hostingDatesById: Record<string, string> = {
    h1: '2026-02-27T18:00:00',
    h2: '2026-04-04T16:00:00',
    h3: '2026-03-01T09:30:00',
    h4: '2026-03-05T18:00:00'
  };
  protected readonly invitationDatesById: Record<string, string> = {
    i1: '2026-02-21T20:00:00',
    i2: '2026-02-22T15:00:00',
    i3: '2026-02-21T09:15:00',
    i4: '2026-02-22T18:30:00',
    i5: '2026-02-23T18:00:00'
  };
  protected readonly chatDatesById: Record<string, string> = {
    c1: '2026-02-21T09:11:00',
    c2: '2026-02-22T18:40:00',
    c3: '2026-02-23T10:09:00',
    c4: '2026-02-22T12:30:00',
    c5: '2026-02-23T17:40:00'
  };
  protected readonly chatDistanceById: Record<string, number> = { c1: 5, c2: 10, c3: 15, c4: 8, c5: 12 };
  protected readonly invitationDistanceById: Record<string, number> = { i1: 10, i2: 15, i3: 5, i4: 12, i5: 18 };
  protected readonly eventDistanceById: Record<string, number> = { e1: 20, e2: 10, e3: 15, e6: 35, e7: 45, e8: 20, e9: 20, e10: 35, e11: 30, e12: 40, e4: 5, e5: 25 };
  protected readonly activityDateTimeRangeById: Record<string, ActivityDateTimeRange> = {
    e1: { startIso: '2026-02-27T09:00:00', endIso: '2026-03-01T12:00:00' },
    e2: { startIso: '2026-03-08T10:00:00', endIso: '2026-03-08T19:00:00' },
    e3: { startIso: '2026-03-12T19:30:00', endIso: '2026-03-12T23:00:00' },
    e6: { startIso: '2026-03-14T17:00:00', endIso: '2026-03-14T20:30:00' },
    e7: { startIso: '2026-03-16T09:30:00', endIso: '2026-03-16T11:30:00' },
    e8: { startIso: '2026-02-27T11:15:00', endIso: '2026-02-27T13:00:00' },
    e9: { startIso: '2026-02-27T13:30:00', endIso: '2026-02-27T15:30:00' },
    e10: { startIso: '2026-03-14T18:15:00', endIso: '2026-03-14T21:15:00' },
    e11: { startIso: '2026-03-28T09:00:00', endIso: '2026-05-06T21:00:00' },
    e12: { startIso: '2026-04-26T10:00:00', endIso: '2026-06-02T20:00:00' },
    h1: { startIso: '2026-02-27T18:00:00', endIso: '2026-02-27T21:00:00' },
    h2: { startIso: '2026-04-04T16:00:00', endIso: '2026-04-04T20:00:00' },
    h3: { startIso: '2026-03-01T09:30:00', endIso: '2026-03-01T12:00:00' },
    h4: { startIso: '2026-03-05T18:00:00', endIso: '2026-03-05T21:00:00' }
  };
  protected readonly hostingDistanceById: Record<string, number> = { h1: 5, h2: 20, h3: 10, h4: 15 };
  protected readonly activityImageById: Record<string, string> = {
    e1: 'https://picsum.photos/seed/event-e1/1200/700',
    e2: 'https://picsum.photos/seed/event-e2/1200/700',
    e3: 'https://picsum.photos/seed/event-e3/1200/700',
    e6: 'https://picsum.photos/seed/event-e6/1200/700',
    e7: 'https://picsum.photos/seed/event-e7/1200/700',
    e8: 'https://picsum.photos/seed/event-e8/1200/700',
    e9: 'https://picsum.photos/seed/event-e9/1200/700',
    e10: 'https://picsum.photos/seed/event-e10/1200/700',
    e11: 'https://picsum.photos/seed/event-e11/1200/700',
    e12: 'https://picsum.photos/seed/event-e12/1200/700',
    e4: 'https://picsum.photos/seed/event-e4/1200/700',
    e5: 'https://picsum.photos/seed/event-e5/1200/700',
    h1: 'https://picsum.photos/seed/event-h1/1200/700',
    h2: 'https://picsum.photos/seed/event-h2/1200/700',
    h3: 'https://picsum.photos/seed/event-h3/1200/700',
    h4: 'https://picsum.photos/seed/event-h4/1200/700',
    i1: 'https://picsum.photos/seed/event-i1/1200/700',
    i2: 'https://picsum.photos/seed/event-i2/1200/700',
    i3: 'https://picsum.photos/seed/event-i3/1200/700',
    i4: 'https://picsum.photos/seed/event-i4/1200/700',
    i5: 'https://picsum.photos/seed/event-i5/1200/700'
  };
  protected readonly activitySourceLinkById: Record<string, string> = {
    e1: 'https://example.com/events/e1',
    e2: 'https://example.com/events/e2',
    e3: 'https://example.com/events/e3',
    e6: 'https://example.com/events/e6',
    e7: 'https://example.com/events/e7',
    e8: 'https://example.com/events/e8',
    e9: 'https://example.com/events/e9',
    e10: 'https://example.com/events/e10',
    e11: 'https://example.com/events/e11',
    e12: 'https://example.com/events/e12',
    e4: 'https://example.com/events/e4',
    e5: 'https://example.com/events/e5',
    h1: 'https://example.com/hosting/h1',
    h2: 'https://example.com/hosting/h2',
    h3: 'https://example.com/hosting/h3',
    h4: 'https://example.com/hosting/h4',
    i1: 'https://example.com/invitations/i1',
    i2: 'https://example.com/invitations/i2',
    i3: 'https://example.com/invitations/i3',
    i4: 'https://example.com/invitations/i4',
    i5: 'https://example.com/invitations/i5'
  };
  protected readonly activityCapacityById: Record<string, string> = {
    e1: '24 / 28',
    e2: '13 / 16',
    e3: '18 / 20',
    e6: '20 / 24',
    e7: '9 / 12',
    e8: '16 / 20',
    e9: '18 / 22',
    e10: '19 / 24',
    e11: '41 / 60',
    e12: '28 / 40',
    e4: '10 / 12',
    e5: '14 / 18',
    h1: '20 / 24',
    h2: '16 / 22',
    h3: '9 / 12',
    h4: '11 / 15',
    i1: '2 / 4',
    i2: '1 / 2',
    i3: '3 / 4',
    i4: '1 / 3',
    i5: '2 / 3'
  };
  protected readonly invitationItemsByUser: Record<string, InvitationMenuItem[]> = this.cloneMapItems(DEMO_INVITATIONS_BY_USER);
  protected readonly eventItemsByUser: Record<string, EventMenuItem[]> = this.cloneMapItems(DEMO_EVENTS_BY_USER);
  protected readonly hostingItemsByUser: Record<string, HostingMenuItem[]> = this.cloneMapItems(DEMO_HOSTING_BY_USER);
  private readonly acceptedInvitationIdsByUser: Record<string, string[]> = {};

  protected selectedChat: ChatMenuItem | null = null;
  protected selectedChatMembers: DemoUser[] = [];
  protected selectedChatMembersItem: ChatMenuItem | null = null;
  protected selectedInvitation: InvitationMenuItem | null = null;
  protected selectedEvent: EventMenuItem | null = null;
  protected selectedHostingEvent: HostingMenuItem | null = null;
  protected activitiesHeaderProgress = 0;
  protected activitiesHeaderProgressLoading = false;
  protected activitiesHeaderLoadingProgress = 0;
  protected activitiesHeaderLoadingOverdue = false;

  protected imageSlots: Array<string | null> = [];
  protected selectedImageIndex = 0;
  protected pendingSlotUploadIndex: number | null = null;
  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('assetImageInput') private assetImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('activitiesScroll') private activitiesScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('activitiesCalendarScroll') private activitiesCalendarScrollRef?: ElementRef<HTMLDivElement>;

  protected eventSupplyTypes: string[] = ['Cars', 'Members', 'Accessories', 'Accommodation'];
  protected newSupplyType = '';
  protected selectedSupplyContext: SupplyContext | null = null;

  protected profileForm = {
    fullName: '',
    birthday: null as Date | null,
    city: '',
    heightCm: null as number | null,
    physique: '',
    languages: [] as string[],
    horoscope: '',
    profileStatus: 'public' as ProfileStatus,
    hostTier: '',
    traitLabel: '',
    about: ''
  };
  protected languageInput = '';
  protected showLanguagePanel = false;
  private readonly profileImageSlotsByUser: Record<string, Array<string | null>> = {};
  private readonly languageSheetHeightCssVar = '--mobile-language-sheet-height';
  private activitiesHeaderLoadingCounter = 0;
  private activitiesHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private activitiesHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activitiesHeaderLoadingWindowMs = 3000;
  private readonly activitiesHeaderLoadingTickMs = 16;
  private activitiesHeaderLoadingStartedAtMs = 0;
  private activitiesHeaderFlushScheduled = false;
  private readonly activitiesPaginationLoadDelayMs = 3500;
  private activitiesVisibleCount = this.activitiesPageSize;
  private activitiesPaginationKey = '';
  private activitiesLoadMoreTimer: ReturnType<typeof setTimeout> | null = null;
  private activitiesIsPaginating = false;
  private activitiesPaginationAwaitScrollReset = false;
  private activitiesBottomPullTracking = false;
  private activitiesBottomPullEdgeLocked = false;
  private activitiesBottomPullStartOnLastRow = false;
  private activitiesBottomPullStartY = 0;
  private readonly activitiesBottomPullMaxPx = 70;
  private readonly activitiesBottomPullTriggerPx = 32;
  private activitiesBottomPullReleaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly router: Router) {
    this.initializeProfileImageSlots();
    this.ensurePaginationTestEvents(30);
    this.profileDetailsForm = this.createProfileDetailsForm();
    this.syncProfileFormFromActiveUser();
    this.router.navigate(['/game']);
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
    return this.resolveSectionBadge(
      this.chatItems.map(item => item.unread),
      this.chatItems.length
    );
  }

  protected get invitationsBadge(): number {
    return this.resolveSectionBadge(
      this.invitationItems.map(item => item.unread),
      this.invitationItems.length
    );
  }

  protected get eventsBadge(): number {
    return this.resolveSectionBadge(
      this.eventItems.map(item => item.activity),
      this.eventItems.length
    );
  }

  protected get hostingBadge(): number {
    const adminEvents = this.eventItems.filter(item => item.isAdmin);
    return this.resolveSectionBadge(
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
    return DEMO_CHAT_BY_USER[this.activeUser.id] ?? DEMO_CHAT_BY_USER['u1'];
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
    return DEMO_RATES_BY_USER[this.activeUser.id] ?? DEMO_RATES_BY_USER['u1'] ?? [];
  }

  protected onUserSelect(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  protected closeUserMenu(): void {
    this.showUserMenu = false;
  }

  protected goToGame(): void {
    this.activeMenuSection = 'game';
    this.router.navigate(['/game']);
    this.closeUserMenu();
  }

  protected openRatesShortcut(): void {
    this.openActivitiesPopup('rates', false);
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

  protected openActivitiesPopup(primaryFilter: ActivitiesPrimaryFilter, closeMenu = true): void {
    this.commitPendingRateDirectionOverrides();
    this.activePopup = 'activities';
    this.activitiesPrimaryFilter = primaryFilter;
    this.activitiesSecondaryFilter = 'recent';
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.activitiesView = 'day';
    this.clearActivityRateEditorState();
    this.activitiesStickyValue = '';
    this.calendarMonthFocusDate = null;
    this.calendarWeekFocusDate = null;
    this.calendarInitialPageIndexOverride = null;
    this.calendarMonthAnchorPages = null;
    this.calendarWeekAnchorPages = null;
    this.calendarMonthAnchorsHydrated = false;
    this.calendarWeekAnchorsHydrated = false;
    this.resetActivitiesScroll();
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

  protected openChatItem(item: ChatMenuItem, closeMenu = true, stacked = false): void {
    this.activeMenuSection = 'chat';
    this.selectedChat = item;
    this.showActivitiesViewPicker = false;
    if (stacked || this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'chat';
      this.scrollChatToBottom();
      return;
    }
    this.stackedPopup = null;
    this.activePopup = 'chat';
    this.scrollChatToBottom();
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
    if (stacked || this.activePopup === 'activities' || this.stackedPopup !== null) {
      this.stackedPopup = 'invitationActions';
      return;
    }
    this.activePopup = 'invitationActions';
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

  protected openEventExplore(closeMenu = true): void {
    this.activeMenuSection = 'events';
    if (this.stackedPopup !== null) {
      this.stackedPopup = 'eventExplore';
      return;
    }
    this.activePopup = 'eventExplore';
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openEventEditor(stacked = false): void {
    if (stacked || this.stackedPopup !== null || this.activePopup === 'chat') {
      this.stackedPopup = 'eventEditor';
      return;
    }
    this.activePopup = 'eventEditor';
  }

  protected openProfileEditor(): void {
    this.syncProfileFormFromActiveUser();
    this.popupReturnTarget = null;
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
    if (this.activePopup === 'imageEditor' && this.popupReturnTarget) {
      this.activePopup = this.popupReturnTarget;
      this.popupReturnTarget = null;
      return;
    }
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    this.closeAssetForm();
    this.pendingAssetDeleteCardId = null;
    this.pendingAssetMemberAction = null;
    this.selectedAssetCardId = null;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.pendingActivityDeleteRow = null;
    this.pendingActivityAction = 'delete';
    this.selectedActivityMembers = [];
    this.selectedActivityMembersTitle = '';
    this.selectedActivityMembersRowId = null;
    this.selectedActivityMembersRow = null;
    this.selectedActivityInviteUserIds = [];
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = null;
    this.clearActivityRateEditorState();
    this.cancelActivitiesPaginationLoad();
    this.clearActivitiesHeaderLoadingAnimation();
    this.activitiesPaginationKey = '';
    this.activitiesVisibleCount = this.activitiesPageSize;
    this.activitiesHeaderProgress = 0;
    this.resetActivitiesBottomPullState();
    if (this.activitiesBottomPullReleaseTimer) {
      clearTimeout(this.activitiesBottomPullReleaseTimer);
      this.activitiesBottomPullReleaseTimer = null;
    }
  }

  protected closeStackedPopup(): void {
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
      this.selectedActivityMembers = [];
      this.selectedActivityMembersTitle = '';
      this.selectedActivityMembersRowId = null;
      this.selectedActivityMembersRow = null;
      this.selectedActivityInviteUserIds = [];
      this.showActivityInviteSortPicker = false;
      this.superStackedPopup = null;
    }
    this.stackedPopup = null;
    if (this.activePopup === 'chat') {
      this.scrollChatToBottom();
    }
  }

  protected confirmLogout(): void {
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    if (!environment.loginEnabled) {
      this.showUserSelector = true;
    }
  }

  protected selectLoginUser(userId: string): void {
    this.activeUserId = userId;
    localStorage.setItem('demo-active-user', userId);
    this.syncProfileFormFromActiveUser();
    this.activeMenuSection = 'chat';
    window.dispatchEvent(new CustomEvent('active-user-changed'));
    this.showUserSelector = false;
    this.activePopup = null;
    this.stackedPopup = null;
    this.popupReturnTarget = null;
    this.clearActivityRateEditorState();
    this.router.navigate(['/game']);
  }

  protected openUserSelector(): void {
    this.showUserSelector = true;
    this.closeUserMenu();
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
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'menuEvent':
        return this.selectedEvent?.title ?? 'Event';
      case 'hostingEvent':
        return this.selectedHostingEvent?.title ?? 'Hosting Event';
      case 'eventEditor':
        return 'Event Editor';
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
      case 'eventEditor':
        return 'Event Editor';
      case 'eventExplore':
        return 'Event Explore';
      case 'supplyDetail':
        return `${this.selectedSupplyContext?.type ?? 'Supply'} · ${this.selectedSupplyContext?.subEventTitle ?? ''}`.trim();
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

  protected get filteredExperienceEntries(): ExperienceEntry[] {
    const filtered = this.experienceEntries.filter(item => {
      if (this.experienceFilter === 'All') {
        return true;
      }
      return item.type === this.experienceFilter;
    });
    return [...filtered].sort((a, b) => this.toSortableDate(b.dateFrom) - this.toSortableDate(a.dateFrom));
  }

  protected get experienceSummary(): string {
    return `${this.experienceEntries.length} entries`;
  }

  protected get workspaceExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'Workspace').length;
    return `${count} entries`;
  }

  protected get schoolExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'School').length;
    return `${count} entries`;
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

  protected experienceTypeIcon(type: ExperienceEntry['type']): string {
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

  protected experienceTypeClass(type: ExperienceEntry['type']): string {
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

  protected experienceTypeToneClass(type: ExperienceEntry['type']): string {
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

  protected openExperienceForm(entry?: ExperienceEntry): void {
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
      this.experienceRangeStart = this.fromYearMonth(entry.dateFrom);
      this.experienceRangeEnd = entry.dateTo === 'Present' ? null : this.fromYearMonth(entry.dateTo);
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
    const dateFrom = this.toYearMonth(this.experienceRangeStart);
    if (!dateFrom) {
      return;
    }
    const dateTo = this.experienceRangeEnd ? this.toYearMonth(this.experienceRangeEnd) : 'Present';
    const payload: Omit<ExperienceEntry, 'id'> = {
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
    const order: DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    const currentIndex = order.indexOf(row.privacy);
    row.privacy = order[(currentIndex + 1 + order.length) % order.length];
  }

  protected toggleDetailPrivacyFab(groupIndex: number, rowIndex: number, event: MouseEvent): void {
    event.stopPropagation();
    const isOpen =
      this.openPrivacyFab?.groupIndex === groupIndex &&
      this.openPrivacyFab?.rowIndex === rowIndex;
    this.openPrivacyFab = isOpen ? null : { groupIndex, rowIndex };
  }

  protected isDetailPrivacyFabOpen(groupIndex: number, rowIndex: number): boolean {
    return this.openPrivacyFab?.groupIndex === groupIndex && this.openPrivacyFab?.rowIndex === rowIndex;
  }

  protected selectDetailPrivacy(
    groupIndex: number,
    rowIndex: number,
    privacy: DetailPrivacy,
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
    this.mobileProfileSelectorSheet = {
      title: `${row.label} visibility`,
      selected: row.privacy,
      options: this.privacySelectorOptions(),
      context: { kind: 'detailPrivacy', groupIndex, rowIndex }
    };
  }

  protected openExperiencePrivacySelector(type: 'workspace' | 'school', event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: `${type === 'workspace' ? 'Workspace' : 'School'} visibility`,
      selected: this.experienceVisibility[type],
      options: this.privacySelectorOptions(),
      context: { kind: 'experiencePrivacy', type }
    };
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
  }

  protected removeInterestOption(option: string): void {
    this.interestSelectorSelected = this.interestSelectorSelected.filter(item => item !== option);
    this.syncInterestContextToRow();
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
    for (const group of this.interestOptionGroups) {
      if (group.options.includes(option)) {
        return group.toneClass;
      }
    }
    return '';
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
    const normalizedLabel = this.normalizeText(label);
    const normalizedOption = this.normalizeText(option);

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

  private createProfileDetailsForm(): ProfileDetailFormGroup[] {
    const beliefsValuesOptions = this.beliefsValuesAllOptions();
    const interestOptions = this.interestAllOptions();
    return PROFILE_DETAILS.map((group: ProfileGroup) => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: row.value,
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
    const index = options.findIndex(item => this.normalizeText(item) === this.normalizeText(value));
    const paletteIndex = (index >= 0 ? index : 0) % 8;
    return `detail-tone-${paletteIndex + 1}`;
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  protected profileStatusClass(value: ProfileStatus = this.activeUser.profileStatus): string {
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

  protected getProfileStatusIcon(value: ProfileStatus = this.activeUser.profileStatus): string {
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
    const normalized = this.normalizeText(value);
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
    const normalized = this.normalizeText(value);
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
    return `zodiac-${this.normalizeText(value).replace(/\s+/g, '-')}`;
  }

  protected onHeaderPanelClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openProfileEditor();
  }

  protected onBirthdayChange(value: Date | null): void {
    this.profileForm.birthday = value;
    this.profileForm.horoscope = value ? this.getHoroscopeByDate(value) : '';
  }

  protected get isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isNarrowViewport = window.matchMedia('(max-width: 760px)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isNarrowViewport && hasCoarsePointer;
  }

  protected onProfileStatusChange(value: ProfileStatus): void {
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
        this.profileForm.profileStatus = value as ProfileStatus;
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
      if (this.experienceTypeOptions.includes(value as ExperienceEntry['type'])) {
        this.experienceForm.type = value as ExperienceEntry['type'];
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'assetFilter') {
      if (this.assetFilterOptions.includes(value as AssetType)) {
        this.selectAssetFilter(value as AssetType);
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'activitiesPrimaryFilter') {
      if (this.activitiesPrimaryFilters.some(option => option.key === value)) {
        this.selectActivitiesPrimaryFilter(value as ActivitiesPrimaryFilter);
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'activitiesRateFilter') {
      if (this.rateFilters.some(option => option.key === value)) {
        this.selectActivitiesRateFilter(value as RateFilterKey);
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

  protected experienceVisibilityValue(type: 'workspace' | 'school'): DetailPrivacy {
    return this.experienceVisibility[type];
  }

  protected toggleExperiencePrivacy(type: 'workspace' | 'school', event: Event): void {
    event.stopPropagation();
    const order: DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
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
    const normalized = this.normalizeText(value);
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

  protected get availableProfileStatusOptions(): Array<{ value: ProfileStatus; icon: string }> {
    return this.profileStatusOptions.filter(option => option.value !== this.profileForm.profileStatus);
  }

  protected get availablePhysiqueOptions(): string[] {
    return this.physiqueOptions.filter(option => option !== this.profileForm.physique);
  }

  protected get hostSocialProofBaseMetrics(): Array<{ label: string; value: string }> {
    return [
      { label: 'Average crown rating', value: `${(this.seededMetric(1, 38, 50) / 10).toFixed(1)} / 5.0` },
      { label: 'Attendance rate', value: `${this.seededMetric(2, 74, 99)}%` },
      { label: 'No-show ratio', value: `${this.seededMetric(3, 1, 16)}%` },
      { label: 'Repeat attendees', value: `${this.seededMetric(4, 36, 92)}%` }
    ];
  }

  protected get hostAverageRating(): string {
    return '4.4';
  }

  protected get hostTotalEvents(): number {
    return this.seededMetric(9, 12, 80);
  }

  protected get hostAttendanceTotal(): number {
    return this.hostTotalEvents * this.seededMetric(18, 8, 14);
  }

  protected get hostAttendanceAttended(): number {
    return Math.floor(this.hostAttendanceTotal * (this.seededMetric(2, 74, 96) / 100));
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
    const total = this.seededMetric(19, 60, 220);
    const repeat = Math.floor(total * (this.seededMetric(4, 36, 84) / 100));
    return `${repeat}`;
  }

  protected get hostPeopleMet(): number {
    return this.seededMetric(32, 90, 520);
  }

  protected get hostVibeSummary(): string {
    const vibe = this.vibeCategories[this.seededMetric(5, 0, this.vibeCategories.length - 1)];
    return `${vibe} ${this.seededMetric(20, 18, 86)}%`;
  }

  protected get hostCategorySummary(): string {
    const sports = this.seededMetric(21, 8, 48);
    const roadTrip = this.seededMetric(22, 6, 36);
    return `Sports ${sports}%, Road Trip ${roadTrip}%`;
  }

  protected get hostVibeBadgeItems(): string[] {
    return this.withContextIconItems(this.hostVibeSummary, this.vibeIcons);
  }

  protected get hostCategoryBadgeItems(): string[] {
    return this.withContextIconItems(this.hostCategorySummary, this.categoryIcons);
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
    return this.memberTraitBreakdown
      .map(item => `${this.memberTraitIcons[item.label] ?? ''} ${item.label} ${item.value}`.trim())
      .filter(Boolean);
  }

  protected get memberTotalEvents(): number {
    return this.hostTotalEvents;
  }

  protected get memberAttendanceSummary(): string {
    const total = 100;
    const attended = this.seededMetric(23, 4, 96);
    return `${attended} / ${total}`;
  }

  protected get memberNoShowCount(): number {
    const [attendedText, totalText] = this.memberAttendanceSummary.split('/').map(item => item.trim());
    const attended = Number.parseInt(attendedText, 10) || 0;
    const total = Number.parseInt(totalText, 10) || 0;
    return Math.max(0, total - attended);
  }

  protected get memberPeopleMet(): number {
    return this.seededMetric(24, 80, 460);
  }

  protected get memberReturneesSummary(): string {
    const total = this.memberPeopleMet;
    const repeat = Math.floor(total * (this.seededMetric(33, 18, 72) / 100));
    return `${repeat}`;
  }

  protected get memberVibeSummary(): string {
    const first = this.vibeCategories[this.seededMetric(25, 0, this.vibeCategories.length - 1)];
    const second = this.vibeCategories[this.seededMetric(26, 0, this.vibeCategories.length - 1)];
    return `${first} ${this.seededMetric(27, 18, 74)}%, ${second} ${this.seededMetric(28, 12, 62)}%`;
  }

  protected get memberCategorySummary(): string {
    return `Outdoors ${this.seededMetric(29, 40, 95)}%, Games ${this.seededMetric(30, 35, 95)}%, Culture ${this.seededMetric(31, 25, 90)}%`;
  }

  protected get memberVibeBadgeItems(): string[] {
    return this.withContextIconItems(this.memberVibeSummary, this.vibeIcons);
  }

  protected get memberCategoryBadgeItems(): string[] {
    return this.withContextIconItems(this.memberCategorySummary, this.categoryIcons);
  }

  protected get memberCategoryPlacementClass(): string {
    const personalityLen = this.badgeItemsLength(this.memberPersonalityBadgeItems);
    const vibeLen = this.badgeItemsLength(this.memberVibeBadgeItems);
    return personalityLen <= vibeLen ? 'badge-below-left' : 'badge-below-right';
  }

  protected get activeHostTier(): string {
    return this.profileForm.hostTier || this.activeUser.hostTier;
  }

  protected get activeMemberTrait(): string {
    return this.profileForm.traitLabel || this.activeUser.traitLabel;
  }

  protected get memberImpressionTitle(): string {
    const normalized = this.normalizeText(this.activeMemberTrait);
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
    const tier = this.normalizeText(this.activeHostTier);
    if (tier.includes('platinum')) return '👑';
    if (tier.includes('gold')) return '🥇';
    if (tier.includes('silver')) return '🥈';
    return '🥉';
  }

  protected getHostTierIcon(hostTier: string): string {
    const normalized = this.normalizeText(hostTier);
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
    const normalized = this.normalizeText(hostTier);
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
    const normalized = this.normalizeText(hostTier);
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
    const normalized = this.normalizeText(traitLabel);
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
    const normalized = this.normalizeText(traitLabel);
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
    const normalized = this.normalizeText(traitLabel);
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
    const text = this.normalizeText(invitation.description);
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

  protected get isActivitiesPopup(): boolean {
    return this.activePopup === 'activities';
  }

  protected get filteredActivityRows(): ActivityListRow[] {
    const rows = this.buildFilteredActivityRowsBase();
    if (this.isCalendarLayoutView()) {
      return rows;
    }
    this.ensureActivitiesPaginationState(rows.length);
    return rows.slice(0, Math.min(this.activitiesVisibleCount, rows.length));
  }

  private buildFilteredActivityRowsBase(): ActivityListRow[] {
    let rows: ActivityListRow[] = [];
    if (this.activitiesPrimaryFilter === 'chats') {
      rows = this.chatItems.map(item => {
        const sender = this.getChatLastSender(item);
        return {
          id: item.id,
          type: 'chats',
          title: sender.name,
          subtitle: item.title,
          detail: item.lastMessage.trim(),
          dateIso: this.chatDatesById[item.id] ?? '2026-02-21T09:00:00',
          distanceKm: this.chatDistanceById[item.id] ?? 5,
          unread: item.unread,
          metricScore: item.unread * 10 + this.getChatMemberCount(item),
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
        ...this.eventItems.map<ActivityListRow>(item => ({
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
        .filter(item => this.matchesRateFilter(item, this.activitiesRateFilter))
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

  protected get eventStyleActivityRows(): ActivityListRow[] {
    return this.filteredActivityRows.filter(row => this.isEventStyleActivity(row));
  }

  protected get nonEventStyleActivityRows(): ActivityListRow[] {
    return this.filteredActivityRows.filter(row => !this.isEventStyleActivity(row));
  }

  protected get groupedActivityRows(): ActivityGroup[] {
    const rows = this.filteredActivityRows;
    const grouped: ActivityGroup[] = [];
    for (const row of rows) {
      const label = this.activityGroupLabel(row);
      const lastGroup = grouped[grouped.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        grouped.push({ label, rows: [row] });
        continue;
      }
      lastGroup.rows.push(row);
    }
    return grouped;
  }

  protected readonly calendarWeekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly calendarWeekHours = Array.from(
    { length: this.weekCalendarEndHour - this.weekCalendarStartHour + 1 },
    (_, index) => this.weekCalendarStartHour + index
  );

  protected isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }

  protected get calendarMonthPages(): CalendarMonthPage[] {
    if (this.activitiesView !== 'month') {
      return [];
    }
    const rows = this.filteredActivityRows;
    const monthAnchors = this.monthAnchorsForRows(rows);
    const cacheKey = [
      this.activeUserId,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
      this.activitiesRateFilter,
      this.activitiesView,
      this.calendarRowsSignature(rows),
      monthAnchors.map(anchor => this.monthKey(anchor)).join(',')
    ].join('|');
    if (cacheKey === this.calendarMonthPagesCacheKey) {
      return this.calendarMonthPagesCache;
    }
    const rowsByDate = this.buildActivityRowsByDate(rows);
    this.calendarMonthPagesCache = monthAnchors.map(anchor => this.buildMonthPage(anchor, rowsByDate, rows));
    this.calendarMonthPagesCacheKey = cacheKey;
    return this.calendarMonthPagesCache;
  }

  protected get calendarWeekPages(): CalendarWeekPage[] {
    if (this.activitiesView !== 'week') {
      return [];
    }
    const rows = this.filteredActivityRows;
    const weekAnchors = this.weekAnchorsForRows(rows);
    const cacheKey = [
      this.activeUserId,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
      this.activitiesRateFilter,
      this.activitiesView,
      this.calendarRowsSignature(rows),
      weekAnchors.map(anchor => this.dateKey(anchor)).join(',')
    ].join('|');
    if (cacheKey === this.calendarWeekPagesCacheKey) {
      return this.calendarWeekPagesCache;
    }
    const rowsByDate = this.buildActivityRowsByDate(rows);
    this.calendarWeekPagesCache = weekAnchors.map(anchor => this.buildWeekPage(anchor, rowsByDate));
    this.calendarWeekPagesCacheKey = cacheKey;
    return this.calendarWeekPagesCache;
  }

  protected weekHourLabel(hour: number): string {
    return `${`${hour}`.padStart(2, '0')}:00`;
  }

  protected weekDayTimedBadges(day: CalendarDayCell): CalendarTimedBadge[] {
    const dayStart = new Date(day.date);
    dayStart.setHours(this.weekCalendarStartHour, 0, 0, 0);
    const dayEnd = new Date(day.date);
    dayEnd.setHours(this.weekCalendarEndHour + 1, 0, 0, 0);
    const totalMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000;
    const badges: CalendarTimedBadge[] = [];
    for (const row of day.rows) {
      const range = this.activityDateRange(row);
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

  protected monthRateCount(day: CalendarDayCell): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    return day.rows.length;
  }

  protected monthRateHeatClass(day: CalendarDayCell): string {
    return this.rateHeatClass(this.monthRateCount(day));
  }

  protected weekRateDayCount(day: CalendarDayCell): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    return day.rows.length;
  }

  protected weekRateDayHeatClass(day: CalendarDayCell): string {
    return this.rateHeatClass(this.weekRateDayCount(day));
  }

  protected weekRateHourCount(day: CalendarDayCell, hour: number): number {
    if (this.activitiesPrimaryFilter !== 'rates') {
      return 0;
    }
    const slotStart = new Date(day.date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return this.countOverlappingRows(day.rows, slotStart, slotEnd);
  }

  protected rateHeatClassByCount(count: number): string {
    return this.rateHeatClass(count);
  }

  protected rateCountLabel(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    return value > 99 ? '99+' : `${value}`;
  }

  protected monthWeekLaneCount(week: CalendarMonthWeek): number {
    if (week.spans.length === 0) {
      return 0;
    }
    return week.spans.reduce((maxLane, span) => Math.max(maxLane, span.lane + 1), 0);
  }

  protected calendarBadgeToneClass(row: ActivityListRow): string {
    const paletteSize = 8;
    const toneIndex = (this.hashText(row.id) % paletteSize) + 1;
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
    return `No ${this.activitiesPrimaryFilter} items in this filter.`;
  }

  protected isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  protected isActivityChatRow(row: ActivityListRow): boolean {
    return row.type === 'chats';
  }

  protected activityRowAvatarInitials(row: ActivityListRow): string {
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

  protected activityRowAvatarClass(row: ActivityListRow): string {
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

  protected onActivitiesTouchStart(event: TouchEvent): void {
    if (this.isCalendarLayoutView() || this.activePopup !== 'activities') {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target || event.touches.length === 0) {
      return;
    }
    this.beginActivitiesBottomPull(target, event.target, event.touches[0].clientY);
  }

  protected onActivitiesTouchMove(event: TouchEvent): void {
    if (!this.activitiesBottomPullTracking || this.isCalendarLayoutView() || this.activePopup !== 'activities') {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target || event.touches.length === 0) {
      return;
    }
    if (this.moveActivitiesBottomPull(target, event.touches[0].clientY)) {
      event.preventDefault();
    }
  }

  protected onActivitiesTouchEnd(event: TouchEvent): void {
    if (!this.activitiesBottomPullTracking) {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    this.finishActivitiesBottomPull(target);
  }

  protected onActivitiesPointerStart(event: PointerEvent): void {
    if (event.pointerType === 'touch' || event.button !== 0 || this.isCalendarLayoutView() || this.activePopup !== 'activities') {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    this.beginActivitiesBottomPull(target, event.target, event.clientY);
  }

  protected onActivitiesPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !this.activitiesBottomPullTracking || this.isCalendarLayoutView() || this.activePopup !== 'activities') {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    if (this.moveActivitiesBottomPull(target, event.clientY)) {
      event.preventDefault();
    }
  }

  protected onActivitiesPointerEnd(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !this.activitiesBottomPullTracking) {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    this.finishActivitiesBottomPull(target);
  }

  protected selectActivitiesPrimaryFilter(filter: ActivitiesPrimaryFilter): void {
    this.activitiesPrimaryFilter = filter;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    if (filter === 'rates') {
      this.activitiesView = 'distance';
      this.selectedActivityRateId = null;
    } else {
      this.selectedActivityRateId = null;
    }
    this.resetActivitiesScroll();
  }

  protected selectActivitiesSecondaryFilter(filter: ActivitiesSecondaryFilter): void {
    this.activitiesSecondaryFilter = filter;
    this.showActivitiesSecondaryPicker = false;
    this.resetActivitiesScroll();
  }

  protected selectActivitiesRateFilter(filter: RateFilterKey): void {
    const filterChanged = filter !== this.activitiesRateFilter;
    if (filterChanged) {
      this.commitPendingRateDirectionOverrides();
    }
    this.activitiesRateFilter = filter;
    this.selectedActivityRateId = null;
    this.showActivitiesSecondaryPicker = false;
    this.resetActivitiesScroll();
  }

  protected toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesViewPicker = !this.showActivitiesViewPicker;
  }

  protected toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = !this.showActivitiesSecondaryPicker;
  }

  protected setActivitiesView(view: ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    this.activitiesView = view;
    this.calendarMonthAnchorPages = null;
    this.calendarWeekAnchorPages = null;
    this.calendarInitialPageIndexOverride = null;
    this.calendarMonthAnchorsHydrated = false;
    this.calendarWeekAnchorsHydrated = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.resetActivitiesScroll();
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

  protected activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilters.find(option => option.key === this.activitiesSecondaryFilter)?.label ?? 'Recent';
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

  protected activitiesRateFilterIcon(key: RateFilterKey = this.activitiesRateFilter): string {
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

  protected rateFilterOptionClass(key: RateFilterKey): string {
    return `rate-filter-item-${key}`;
  }

  protected isRateGroupSeparator(label: string): boolean {
    return label === 'Pair';
  }

  protected rateFilterCount(filter: RateFilterKey): number {
    return this.rateItems.filter(item => this.matchesRateFilter(item, filter)).length;
  }

  protected selectedRateFilterCount(): number {
    return this.rateFilterCount(this.activitiesRateFilter);
  }

  protected totalRateFilterCount(): number {
    return this.rateItems.length;
  }

  protected activitiesPrimaryFilterCount(filter: ActivitiesPrimaryFilter): number {
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

  protected activitiesPrimaryFilterClass(filter: ActivitiesPrimaryFilter = this.activitiesPrimaryFilter): string {
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

  protected activitiesSecondaryFilterClass(filter: ActivitiesSecondaryFilter = this.activitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return 'activity-filter-secondary';
    }
    if (filter === 'relevant') {
      return 'activity-filter-secondary';
    }
    return 'activity-filter-secondary';
  }

  protected activitiesRateFilterClass(filter: RateFilterKey = this.activitiesRateFilter): string {
    return filter.startsWith('individual') ? 'activity-filter-rates' : 'activity-filter-rates';
  }

  protected activitiesHeaderSelectionLine(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    const secondary = this.activitiesSecondaryFilterLabel();
    if (this.activitiesPrimaryFilter === 'rates') {
      return `${primary} · ${secondary} · ${this.activitiesRateFilterLabel()}`;
    }
    return `${primary} · ${secondary}`;
  }

  protected activitiesHeaderLineOne(): string {
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

  protected activitiesPrimaryPanelWidth(): string {
    return '260px';
  }

  protected activitiesRatePanelWidth(): string {
    return '320px';
  }

  protected assetFilterPanelWidth(): string {
    return '248px';
  }

  protected onActivityRowClick(row: ActivityListRow, event?: Event): void {
    this.openActivityRow(row, event);
  }

  protected onActivityRowPointerUp(row: ActivityListRow, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.openActivityRow(row, event);
  }

  private openActivityRow(row: ActivityListRow, event?: Event): void {
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

  protected activityChatMemberCount(row: ActivityListRow): number {
    if (row.type !== 'chats') {
      return 0;
    }
    return this.getChatMemberCount(row.source as ChatMenuItem);
  }

  protected isEventStyleActivity(row: ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'hosting' || row.type === 'invitations';
  }

  protected isRateStyleActivity(row: ActivityListRow): boolean {
    return row.type === 'rates';
  }

  protected isPairReceivedRateRow(row: ActivityListRow): boolean {
    if (row.type !== 'rates') {
      return false;
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair' && this.displayedRateDirection(item) === 'received';
  }

  protected activityOwnRatingValue(row: ActivityListRow): number {
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

  protected activityOwnRatingLabel(row: ActivityListRow): string {
    const value = this.activityOwnRatingValue(row);
    return value > 0 ? `${value}` : '';
  }

  protected isActivityRatePending(row: ActivityListRow): boolean {
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

  protected openActivityRateEditor(row: ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (row.type !== 'rates') {
      return;
    }
    this.selectedActivityRateId = row.id;
  }

  protected onActivitiesPopupSurfaceClick(event: MouseEvent): void {
    if (this.activePopup !== 'activities' || this.activitiesPrimaryFilter !== 'rates' || !this.selectedActivityRateId) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest('.activities-rate-editor-dock') || target.closest('.activities-rate-score-badge')) {
      return;
    }
    this.selectedActivityRateId = null;
  }

  protected setSelectedActivityOwnRating(score: number): void {
    if (!this.selectedActivityRateId) {
      return;
    }
    const normalized = this.normalizeRateScore(score);
    const row = this.selectedActivityRateRow();
    this.activityRateDraftById[this.selectedActivityRateId] = normalized;
    if (!row || row.type !== 'rates') {
      return;
    }
    const rateItem = row.source as RateMenuItem;
    const direction = this.displayedRateDirection(rateItem);
    if (direction === 'received') {
      this.pendingActivityRateDirectionOverrideById[rateItem.id] = rateItem.mode === 'individual' ? 'mutual' : 'given';
    } else if (direction === 'met') {
      this.pendingActivityRateDirectionOverrideById[rateItem.id] = 'given';
    }
  }

  protected isActivityRateEditorOpen(): boolean {
    return this.activePopup === 'activities' && this.activitiesPrimaryFilter === 'rates' && !!this.selectedActivityRateId;
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

  private selectedActivityRateRow(): ActivityListRow | null {
    if (!this.selectedActivityRateId) {
      return null;
    }
    return this.filteredActivityRows.find(row => row.type === 'rates' && row.id === this.selectedActivityRateId) ?? null;
  }

  private normalizeRateScore(value: number): number {
    return Math.min(10, Math.max(1, Math.round(value)));
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

  private commitPendingRateDirectionOverrides(): void {
    Object.assign(this.activityRateDirectionOverrideById, this.pendingActivityRateDirectionOverrideById);
    for (const key of Object.keys(this.pendingActivityRateDirectionOverrideById)) {
      delete this.pendingActivityRateDirectionOverrideById[key];
    }
  }

  private clearActivityRateEditorState(): void {
    this.selectedActivityRateId = null;
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

  private acceptedInvitationRowsAsEvents(): ActivityListRow[] {
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

  protected activityTypeLabel(row: ActivityListRow): string {
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

  protected activityDateLabel(row: ActivityListRow): string {
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

  protected activityImageUrl(row: ActivityListRow): string {
    return this.activityImageById[row.id] ?? 'https://picsum.photos/seed/event-default/1200/700';
  }

  protected activitySourceLink(row: ActivityListRow): string {
    return this.activitySourceLinkById[row.id] ?? 'https://example.com/events';
  }

  protected showActivitySourceIcon(row: ActivityListRow): boolean {
    return row.type === 'events' || row.type === 'invitations';
  }

  protected activitySourceAvatarLabel(row: ActivityListRow): string {
    if (row.type === 'invitations') {
      const invitation = row.source as InvitationMenuItem;
      return this.initialsFromText(invitation.inviter);
    }
    if (row.type === 'events') {
      const event = row.source as EventMenuItem;
      const explicitOwner = this.findUserByName(event.avatar || '');
      if (explicitOwner) {
        return explicitOwner.initials;
      }
      const fallbackOwner = this.users[this.hashText(`${row.id}-${event.title}`) % this.users.length];
      return fallbackOwner?.initials ?? this.initialsFromText(event.title);
    }
    if (row.type === 'hosting') {
      const hosting = row.source as HostingMenuItem;
      return this.initialsFromText(hosting.avatar || hosting.title);
    }
    return this.initialsFromText(row.title);
  }

  protected activitySourceAvatarClass(row: ActivityListRow): string {
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${(row.source as InvitationMenuItem).inviter}`
      : `${row.id}-${row.title}`;
    const toneIndex = (this.hashText(toneSeed) % 8) + 1;
    return `activities-source-tone-${toneIndex}`;
  }

  protected activityCapacityLabel(row: ActivityListRow): string {
    const acceptedMembersCount = this.getActivityMembersByRow(row).filter(member => member.status === 'accepted').length;
    const capacityTotal = this.activityCapacityTotal(row, acceptedMembersCount);
    return `${acceptedMembersCount} / ${capacityTotal}`;
  }

  protected activityPendingMemberCount(row: ActivityListRow): number {
    return this.getActivityMembersByRow(row).filter(member => member.status === 'pending').length;
  }

  private activityCapacityTotal(row: ActivityListRow, fallbackBase = 0): number {
    const source = this.activityCapacityById[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] > 0) {
        return parts[1];
      }
    }
    return Math.max(fallbackBase, 4);
  }

  protected activityTypeIcon(row: ActivityListRow): string {
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

  protected activityMetaLine(row: ActivityListRow): string {
    return `${this.activityTypeLabel(row)} · ${this.activityDateLabel(row)} · ${row.distanceKm} km`;
  }

  protected openActivityFromInlineControl(row: ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.onActivityRowClick(row);
  }

  protected canManageActivityRow(row: ActivityListRow): boolean {
    return row.type === 'invitations' || row.type === 'events' || row.type === 'hosting';
  }

  protected activityPrimaryActionIcon(row: ActivityListRow): string {
    if (row.type === 'invitations') {
      return 'visibility';
    }
    return row.isAdmin ? 'edit' : 'visibility';
  }

  protected activityPrimaryActionLabel(row: ActivityListRow): string {
    if (row.type === 'invitations') {
      return 'View invitation';
    }
    if (row.isAdmin) {
      return row.type === 'hosting' ? 'Edit hosted event' : 'Edit event';
    }
    return row.type === 'hosting' ? 'Open hosted event' : 'Open event';
  }

  protected activitySecondaryActionIcon(row: ActivityListRow): string {
    return this.isExitActivityRow(row) ? 'logout' : 'delete';
  }

  protected activitySecondaryActionLabel(row: ActivityListRow): string {
    if (this.isExitActivityRow(row)) {
      return row.type === 'hosting' ? 'Exit hosted event' : 'Exit event';
    }
    if (row.type === 'invitations') {
      return 'Delete invitation';
    }
    return row.type === 'hosting' ? 'Delete hosted event' : 'Delete event';
  }

  protected openActivityPrimaryAction(row: ActivityListRow): void {
    if (row.type === 'invitations') {
      this.openInvitationItem(row.source as InvitationMenuItem, false, true);
      return;
    }
    if (row.type === 'events' || row.type === 'hosting') {
      if (row.isAdmin) {
        this.openEventEditor();
        return;
      }
      if (row.type === 'events') {
        this.openEventItem(row.source as EventMenuItem, false, true);
        return;
      }
      this.openHostingItem(row.source as HostingMenuItem, false, true);
      return;
    }
  }

  protected triggerActivitySecondaryAction(row: ActivityListRow): void {
    this.pendingActivityAction = this.isExitActivityRow(row) ? 'exit' : 'delete';
    this.pendingActivityDeleteRow = row;
  }

  protected isExitActivityRow(row: ActivityListRow): boolean {
    return (row.type === 'events' || row.type === 'hosting') && row.isAdmin !== true;
  }

  protected openActivityMembers(row: ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.selectedActivityMembersRowId = `${row.type}:${row.id}`;
    this.selectedActivityMembers = this.sortActivityMembersByActionTimeAsc(this.getActivityMembersByRow(row));
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.selectedActivityMembersRow = row;
    this.selectedActivityMembersTitle = row.title;
    this.selectedActivityInviteUserIds = [];
    this.superStackedPopup = null;
    this.stackedPopup = 'activityMembers';
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

  protected closeActivityInviteFriends(applyInvitations = true): void {
    if (applyInvitations) {
      this.applySelectedActivityInvitations();
    }
    this.showActivityInviteSortPicker = false;
    this.superStackedPopup = null;
  }

  protected toggleActivityInviteSortPicker(event?: Event): void {
    event?.stopPropagation();
    this.showActivityInviteSortPicker = !this.showActivityInviteSortPicker;
  }

  protected selectActivityInviteSort(sort: ActivityInviteSort): void {
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

  protected get activityInviteCandidates(): ActivityMemberEntry[] {
    if (!this.selectedActivityMembersRow) {
      return [];
    }
    const existing = new Set(this.selectedActivityMembers.map(member => member.userId));
    const candidates = this.users
      .filter(user => user.id !== this.activeUser.id && !existing.has(user.id))
      .map(user => this.toActivityMemberEntry(user, this.selectedActivityMembersRow!, this.selectedActivityMembersRowId!, {
        status: 'pending',
        pendingSource: this.selectedActivityMembersRow?.isAdmin ? 'admin' : 'member',
        invitedByActiveUser: true
      }));
    return [...candidates].sort((a, b) => {
      if (this.activityInviteSort === 'relevant') {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
      }
      return this.toSortableDate(b.metAtIso) - this.toSortableDate(a.metAtIso);
    });
  }

  protected get selectedActivityInviteChips(): ActivityMemberEntry[] {
    const selected = new Set(this.selectedActivityInviteUserIds);
    return this.activityInviteCandidates.filter(item => selected.has(item.userId));
  }

  protected get activityMembersOrdered(): ActivityMemberEntry[] {
    return this.sortActivityMembersByActionTimeAsc(this.selectedActivityMembers);
  }

  protected activityMembersHeaderSummary(): string {
    const pendingCount = this.selectedActivityMembers.filter(member => member.status === 'pending').length;
    const acceptedCount = this.selectedActivityMembers.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected activityInviteMetLabel(entry: ActivityMemberEntry): string {
    const dateText = new Date(entry.metAtIso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${entry.metWhere} · ${dateText}`;
  }

  protected activityMemberActionDate(entry: ActivityMemberEntry): string {
    const when = new Date(entry.actionAtIso);
    const dateText = Number.isNaN(when.getTime())
      ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : when.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${dateText}`;
  }

  protected chatMemberActionDate(member: DemoUser): string {
    const seed = this.hashText(`${this.selectedChatMembersItem?.id ?? 'chat'}:${member.id}`);
    const when = this.addDays(new Date('2026-02-25T12:00:00'), -(seed % 28));
    const dateText = when.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${dateText}`;
  }

  protected activityMemberAge(entry: ActivityMemberEntry): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  protected activityMemberStatusClass(entry: ActivityMemberEntry): string {
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

  protected canApproveActivityMember(entry: ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin !== true) {
      return false;
    }
    return entry.status === 'pending' && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  protected canDeleteActivityMember(entry: ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin === true) {
      return true;
    }
    return entry.status === 'pending';
  }

  protected activityMemberStatusLabel(entry: ActivityMemberEntry): string {
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

  protected approveActivityMember(entry: ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canApproveActivityMember(entry)) {
      return;
    }
    const nowIso = this.toIsoDateTime(new Date());
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
  }

  protected removeActivityMember(entry: ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canDeleteActivityMember(entry)) {
      return;
    }
    this.selectedActivityMembers = this.selectedActivityMembers.filter(item => item.id !== entry.id);
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
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

  private applyActivityExit(row: ActivityListRow): void {
    if (row.type === 'events') {
      this.eventItemsByUser[this.activeUser.id] = this.eventItems.filter(item => item.id !== row.id);
      return;
    }
    if (row.type === 'hosting') {
      this.hostingItemsByUser[this.activeUser.id] = this.hostingItems.filter(item => item.id !== row.id);
      this.eventItemsByUser[this.activeUser.id] = this.eventItems.filter(item => item.id !== row.id);
    }
  }

  protected deleteActivityEvent(row: ActivityListRow, event: Event): void {
    event.stopPropagation();
    this.pendingActivityAction = 'delete';
    this.pendingActivityDeleteRow = row;
  }

  protected editActivityEvent(row: ActivityListRow, event: Event): void {
    event.stopPropagation();
    if (row.type === 'invitations') {
      this.openInvitationItem(row.source as InvitationMenuItem, false, true);
      return;
    }
    if (row.type === 'events' || row.type === 'hosting') {
      this.openEventEditor();
    }
  }

  private applyActivityDelete(row: ActivityListRow): void {
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

  protected isInvitationAccepted(row: ActivityListRow): boolean {
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
    this.acceptInvitationFromRow(this.selectedInvitation.id);
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

  protected get chatPopupMessages(): ChatPopupMessage[] {
    if (!this.selectedChat) {
      return [];
    }
    const members = this.getChatMembersById(this.selectedChat.id);
    const lastSender = members[0] ?? this.getChatLastSender(this.selectedChat);
    const starter = members[1] ?? members[0] ?? this.activeUser;
    const memberB = members[2] ?? starter;
    const memberC = members[3] ?? memberB;
    const me = this.activeUser;

    const byId = (id: string) => this.users.find(user => user.id === id);
    const toMessage = (id: string, text: string, time: string, readByIds: string[], forceMine = false): ChatPopupMessage => {
      const senderUser = byId(id) ?? starter;
      return {
        id: `${this.selectedChat?.id}-${id}-${time}`,
        sender: senderUser.name,
        senderAvatar: this.toChatReader(senderUser),
        text,
        time,
        mine: forceMine || senderUser.id === me.id,
        readBy: readByIds
          .map(readerId => byId(readerId))
          .filter((reader): reader is DemoUser => Boolean(reader))
          .map(reader => this.toChatReader(reader))
      };
    };

    if (this.selectedChat.id === 'c1') {
      return [
        toMessage(starter.id, 'I opened this room to lock transport before 8 PM.', '08:58', [memberB.id]),
        toMessage(me.id, 'I can handle pickup list and final seat assignments.', '09:03', [starter.id, memberB.id], true),
        toMessage(memberB.id, 'I can do airport run if someone covers downtown.', '09:06', [starter.id, me.id]),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '09:11', [starter.id, me.id, memberB.id])
      ];
    }

    if (this.selectedChat.id === 'c2') {
      return [
        toMessage(starter.id, 'Room is open, we need one more player for the second pair.', '18:32', [memberB.id]),
        toMessage(me.id, 'I can join at 19:00 if court #3 stays available.', '18:37', [starter.id], true),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '18:40', [starter.id, me.id])
      ];
    }

    if (this.selectedChat.id === 'c3') {
      return [
        toMessage(starter.id, 'Host queue reviewed, two pending invites expired.', '10:03', [memberB.id]),
        toMessage(me.id, 'I can re-send only to people with verified attendance.', '10:06', [starter.id], true),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '10:09', [starter.id, me.id])
      ];
    }

    return [
      toMessage(starter.id, 'Opened this room to coordinate tasks quickly.', '09:01', [memberB.id]),
      toMessage(me.id, 'I can cover the checklist and send updates.', '09:05', [starter.id], true),
      toMessage(lastSender.id, this.selectedChat.lastMessage, '09:08', [starter.id, me.id, memberC.id])
    ];
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

  protected getSupplyStat(subEvent: SubEventCard, type: string): string {
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

  protected isSupplyStatIncomplete(subEvent: SubEventCard, type: string): boolean {
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
    return this.activePopup === 'assetsCar' || this.activePopup === 'assetsAccommodation' || this.activePopup === 'assetsSupplies';
  }

  protected get activeAssetType(): AssetType {
    if (this.activePopup === 'assetsAccommodation') {
      return 'Accommodation';
    }
    if (this.activePopup === 'assetsSupplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  protected get filteredAssetCards(): AssetCard[] {
    return this.assetCards.filter(card => card.type === this.assetFilter);
  }

  protected get selectedAssetCard(): AssetCard | null {
    if (!this.selectedAssetCardId) {
      return null;
    }
    return this.assetCards.find(card => card.id === this.selectedAssetCardId) ?? null;
  }

  protected assetTypeIcon(type: AssetType): string {
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    return 'inventory_2';
  }

  protected assetTypeClass(type: AssetType): string {
    if (type === 'Car') {
      return 'asset-filter-car';
    }
    if (type === 'Accommodation') {
      return 'asset-filter-accommodation';
    }
    if (type === 'Supplies') {
      return 'asset-filter-supplies';
    }
    return 'asset-filter-car';
  }

  protected assetFilterCount(type: AssetType): number {
    if (type === 'Car') {
      return this.assetCarsBadge;
    }
    if (type === 'Accommodation') {
      return this.assetAccommodationBadge;
    }
    return this.assetSuppliesBadge;
  }

  protected assetPendingCount(card: AssetCard): number {
    return card.requests.filter(member => member.status === 'pending').length;
  }

  protected assetAcceptedCount(card: AssetCard): number {
    return card.requests.filter(member => member.status === 'accepted').length;
  }

  protected assetOccupiedCount(card: AssetCard): number {
    return this.assetAcceptedCount(card);
  }

  protected assetOccupancyLabel(card: AssetCard): string {
    return `${this.assetOccupiedCount(card)} / ${card.capacityTotal}`;
  }

  protected canManageAssetMembers(card: AssetCard): boolean {
    return card.type !== 'Supplies';
  }

  protected assetMemberStatusClass(member: AssetMemberRequest): string {
    return member.status === 'pending' ? 'asset-member-pending' : 'asset-member-accepted';
  }

  protected selectAssetFilter(filter: AssetType): void {
    this.assetFilter = filter;
    if (filter === 'Car') {
      this.activePopup = 'assetsCar';
      return;
    }
    if (filter === 'Accommodation') {
      this.activePopup = 'assetsAccommodation';
      return;
    }
    this.activePopup = 'assetsSupplies';
  }

  protected openAssetMembers(card: AssetCard, event?: Event): void {
    event?.stopPropagation();
    this.selectedAssetCardId = card.id;
    this.pendingAssetMemberAction = null;
    this.stackedPopup = 'assetMembers';
  }

  protected openAssetForm(card?: AssetCard): void {
    this.pendingAssetMemberAction = null;
    this.showAssetForm = true;
    if (card) {
      this.editingAssetId = card.id;
      this.assetForm = {
        type: card.type,
        title: card.title,
        subtitle: card.subtitle,
        city: card.city,
        capacityTotal: card.capacityTotal,
        details: card.details,
        imageUrl: card.imageUrl,
        sourceLink: card.sourceLink
      };
      return;
    }
    this.editingAssetId = null;
    this.assetForm = {
      type: this.activeAssetType,
      title: '',
      subtitle: '',
      city: '',
      capacityTotal: this.activeAssetType === 'Supplies' ? 6 : 4,
      details: '',
      imageUrl: '',
      sourceLink: ''
    };
  }

  protected closeAssetForm(): void {
    this.showAssetForm = false;
    this.editingAssetId = null;
  }

  protected get assetFormTitle(): string {
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${this.assetForm.type}`;
  }

  protected saveAssetCard(): void {
    const title = this.assetForm.title.trim();
    const city = this.assetForm.city.trim();
    if (!title || !city) {
      return;
    }
    const payload: Omit<AssetCard, 'id' | 'requests'> = {
      type: this.assetForm.type,
      title,
      subtitle: this.assetForm.subtitle.trim(),
      city,
      capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
      details: this.assetForm.details.trim() || 'No details yet.',
      imageUrl: this.assetForm.imageUrl.trim() || this.defaultAssetImage(this.assetForm.type),
      sourceLink: this.assetForm.sourceLink.trim() || 'https://picsum.photos'
    };
    if (this.editingAssetId) {
      this.assetCards = this.assetCards.map(card =>
        card.id === this.editingAssetId
          ? {
              ...card,
              ...payload
            }
          : card
      );
    } else {
      this.assetCards = [
        {
          id: `asset-${Date.now()}`,
          ...payload,
          requests: []
        },
        ...this.assetCards
      ];
    }
    this.closeAssetForm();
  }

  protected requestAssetDelete(cardId: string): void {
    this.pendingAssetDeleteCardId = cardId;
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
    if (this.selectedAssetCardId === cardId) {
      this.selectedAssetCardId = null;
      this.stackedPopup = null;
      this.pendingAssetMemberAction = null;
    }
  }

  protected queueAssetMemberAction(cardId: string, memberId: string, action: AssetRequestAction, event?: Event): void {
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

  protected isAssetMemberActionPending(cardId: string, memberId: string, action: AssetRequestAction): boolean {
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
    const seed = `${this.assetForm.type.toLowerCase()}-${parsed.hostname.replace(/\./g, '-')}${parsed.pathname.replace(/[^\w-]/g, '-')}`;
    if (!this.assetForm.imageUrl.trim()) {
      this.assetForm.imageUrl = this.defaultAssetImage(this.assetForm.type, seed);
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
    const user = this.activeUser;
    user.name = this.profileForm.fullName.trim() || user.name;
    const birthday = this.profileForm.birthday ? this.toIsoDate(this.profileForm.birthday) : user.birthday;
    user.birthday = birthday;
    user.age = this.getAgeFromIsoDate(birthday);
    user.city = this.profileForm.city.trim() || user.city;
    user.height = this.profileForm.heightCm ? `${this.profileForm.heightCm} cm` : user.height;
    user.physique = this.profileForm.physique || user.physique;
    user.languages = this.profileForm.languages.length > 0 ? [...this.profileForm.languages] : user.languages;
    user.horoscope = this.profileForm.horoscope || user.horoscope;
    user.profileStatus = this.profileForm.profileStatus;
    user.about = this.profileForm.about.trim().slice(0, 160);
    user.initials = this.toInitials(user.name);
    this.alertService.open('Profile saved');
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

  @HostListener('window:openFeaturePopup', ['$event'])
  onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type: 'eventEditor' | 'eventExplore' }>;
    if (!popupEvent.detail?.type) {
      return;
    }
    if (popupEvent.detail.type === 'eventEditor') {
      this.openEventEditor();
      return;
    }
    this.openEventExplore();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showUserMenu && !target.closest('.user-menu-panel') && !target.closest('.user-selector-btn-global')) {
      this.showUserMenu = false;
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
    if (this.showActivitiesViewPicker && !target.closest('.activities-view-picker') && !target.closest('.popup-view-fab')) {
      this.showActivitiesViewPicker = false;
    }
    if (this.showActivitiesSecondaryPicker && !target.closest('.activities-secondary-picker') && !target.closest('.popup-view-fab')) {
      this.showActivitiesSecondaryPicker = false;
    }
    if (this.showActivityInviteSortPicker && !target.closest('.friends-picker-sort') && !target.closest('.popup-view-fab')) {
      this.showActivityInviteSortPicker = false;
    }
  }

  private getInitialUserId(): string {
    const stored = localStorage.getItem('demo-active-user');
    if (stored && this.users.some(user => user.id === stored)) {
      return stored;
    }
    return this.users[0].id;
  }

  private detailPrivacyFabKey(groupIndex: number, rowIndex: number): string {
    return `${groupIndex}-${rowIndex}`;
  }

  private privacySelectorOptions(): MobileProfileSelectorOption[] {
    const order: DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    return order.map(option => ({
      value: option,
      label: option,
      icon: this.privacyStatusIcon(option),
      toneClass: this.privacyStatusClass(option)
    }));
  }

  private isDetailPrivacy(value: string): value is DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private initializeProfileImageSlots(): void {
    for (const user of this.users) {
      this.profileImageSlotsByUser[user.id] = this.createEmptyImageSlots();
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
    const birthday = this.fromIsoDate(user.birthday);
    this.profileForm = {
      fullName: user.name,
      birthday,
      city: user.city,
      heightCm: Number.parseInt(user.height, 10) || null,
      physique: user.physique,
      languages: [...user.languages],
      horoscope: birthday ? this.getHoroscopeByDate(birthday) : user.horoscope,
      profileStatus: user.profileStatus,
      hostTier: user.hostTier,
      traitLabel: user.traitLabel,
      about: user.about
    };
    const slots = this.profileImageSlotsByUser[user.id];
    this.imageSlots = slots ? [...slots] : this.createEmptyImageSlots();
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    this.selectedImageIndex = firstFilled >= 0 ? firstFilled : 0;
  }

  private buildSampleAssetCards(): AssetCard[] {
    return [
      {
        id: 'asset-car-1',
        type: 'Car',
        title: 'City-to-Lake SUV',
        subtitle: 'Hyundai Tucson · Automatic',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Pickup from Downtown at 17:30. Luggage: 2 cabin bags.',
        imageUrl: this.defaultAssetImage('Car', 'car-1'),
        sourceLink: 'https://picsum.photos/seed/car-1/1200/700',
        requests: [
          this.buildAssetRequest('asset-member-1', 'u4', 'pending', 'Needs one medium suitcase slot.'),
          this.buildAssetRequest('asset-member-2', 'u8', 'accepted', 'Can meet at 6th Street.'),
          this.buildAssetRequest('asset-member-7', 'u2', 'accepted', 'Travels light with backpack only.')
        ]
      },
      {
        id: 'asset-car-2',
        type: 'Car',
        title: 'Airport Shuttle Hatchback',
        subtitle: 'Volkswagen Golf · Manual',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Airport run before midnight, fuel split evenly.',
        imageUrl: this.defaultAssetImage('Car', 'car-2'),
        sourceLink: 'https://picsum.photos/seed/car-2/1200/700',
        requests: [this.buildAssetRequest('asset-member-3', 'u6', 'pending', 'Landing at 22:40.')]
      },
      {
        id: 'asset-acc-1',
        type: 'Accommodation',
        title: 'South Congress Loft',
        subtitle: '2 bedrooms · 1 living room',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Check-in after 15:00. Quiet building, no smoking.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-1'),
        sourceLink: 'https://picsum.photos/seed/acc-1/1200/700',
        requests: [
          this.buildAssetRequest('asset-member-4', 'u3', 'pending', 'Staying for 2 nights.'),
          this.buildAssetRequest('asset-member-5', 'u10', 'accepted', 'Can share room.')
        ]
      },
      {
        id: 'asset-acc-2',
        type: 'Accommodation',
        title: 'Eastside Guest Room',
        subtitle: 'Private room · Shared bathroom',
        city: 'Austin',
        capacityTotal: 2,
        details: 'Ideal for early risers. Parking available.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-2'),
        sourceLink: 'https://picsum.photos/seed/acc-2/1200/700',
        requests: [this.buildAssetRequest('asset-member-6', 'u11', 'pending', 'Arrives Friday evening.')]
      },
      {
        id: 'asset-sup-1',
        type: 'Supplies',
        title: 'Camping Gear Kit',
        subtitle: 'Tent + lamps + first aid',
        city: 'Austin',
        capacityTotal: 6,
        details: 'Packed and ready in the garage. Pickup only.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-1'),
        sourceLink: 'https://picsum.photos/seed/sup-1/1200/700',
        requests: []
      },
      {
        id: 'asset-sup-2',
        type: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Board games + cards + speakers',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Can deliver to venue before 19:00.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-2'),
        sourceLink: 'https://picsum.photos/seed/sup-2/1200/700',
        requests: []
      }
    ];
  }

  private buildAssetRequest(
    id: string,
    userId: string,
    status: AssetRequestStatus,
    note: string
  ): AssetMemberRequest {
    const user = this.users.find(item => item.id === userId) ?? this.users[0];
    return {
      id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status,
      note
    };
  }

  protected defaultAssetImage(type: AssetType, seed = type.toLowerCase()): string {
    if (type === 'Car') {
      return `https://picsum.photos/seed/${seed}/1200/700`;
    }
    if (type === 'Accommodation') {
      return `https://picsum.photos/seed/${seed}/1200/700`;
    }
    return `https://picsum.photos/seed/${seed}/1200/700`;
  }

  private buildSampleExperienceEntries(): ExperienceEntry[] {
    return [
      {
        id: 'exp-1',
        type: 'School',
        title: 'BSc Computer Science',
        org: 'State University',
        city: 'Austin',
        dateFrom: '2014-09',
        dateTo: '2018-06',
        description: 'Software engineering and distributed systems.'
      },
      {
        id: 'exp-2',
        type: 'Additional Project',
        title: 'Community Event Platform',
        org: 'Independent Project',
        city: 'Austin',
        dateFrom: '2018-09',
        dateTo: '2019-05',
        description: 'Built MVP with profile, event, and chat modules.'
      },
      {
        id: 'exp-3',
        type: 'Workspace',
        title: 'Community Lead',
        org: 'Studio Tide',
        city: 'Chicago',
        dateFrom: '2019-06',
        dateTo: '2021-08',
        description: 'Owned member engagement and host onboarding.'
      },
      {
        id: 'exp-4',
        type: 'Online Session',
        title: 'Remote Product Sprint',
        org: 'Northwind Labs',
        city: 'Online',
        dateFrom: '2021-10',
        dateTo: '2022-02',
        description: 'Cross-functional delivery for profile editor v2.'
      },
      {
        id: 'exp-5',
        type: 'Workspace',
        title: 'Product Manager',
        org: 'Northwind Labs',
        city: 'Austin',
        dateFrom: '2022-03',
        dateTo: 'Present',
        description: 'Leads social graph and trust product areas.'
      }
    ];
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

  private fromYearMonth(value: string): Date | null {
    if (!value || value === 'Present') {
      return null;
    }
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = match[3] ? Number.parseInt(match[3], 10) : 1;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private toYearMonth(value: Date | null): string {
    if (!value) {
      return '';
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private toSortableDate(value: string): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }
    const safe = value.replace(/\//g, '-');

    // First, support full ISO date-time values directly (e.g. 2026-02-25T12:34:56).
    const direct = new Date(safe);
    if (!Number.isNaN(direct.getTime())) {
      return direct.getTime();
    }

    // Fallback for date-only and year-month values used elsewhere in the app.
    if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
      return new Date(`${safe}T00:00:00`).getTime();
    }
    if (/^\d{4}-\d{2}$/.test(safe)) {
      return new Date(`${safe}-01T00:00:00`).getTime();
    }
    return Number.POSITIVE_INFINITY;
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
    return this.getAgeFromIsoDate(this.toIsoDate(this.profileForm.birthday));
  }

  private fromIsoDate(value: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toIsoDateTime(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    const seconds = `${value.getSeconds()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private getAgeFromIsoDate(value: string): number {
    const birthday = this.fromIsoDate(value);
    if (!birthday) {
      return this.activeUser.age;
    }
    const now = new Date();
    let age = now.getFullYear() - birthday.getFullYear();
    const monthDiff = now.getMonth() - birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
      age -= 1;
    }
    return age;
  }

  private getHoroscopeByDate(value: Date): string {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
    return 'Capricorn';
  }

  private seededMetric(offset: number, min: number, max: number): number {
    const source = `${this.activeUser.id}-${this.activeUser.name}-${this.activeUser.city}-${offset}`;
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }
    return min + (hash % (max - min + 1));
  }

  private withContextIconItems(summary: string, iconMap: Record<string, string>): string[] {
    return summary
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        const key = Object.keys(iconMap).find(label => trimmed.startsWith(label));
        return key ? `${iconMap[key]} ${trimmed}` : trimmed;
      });
  }

  private badgeItemsLength(items: string[]): number {
    return items.reduce((sum, item) => sum + item.length, 0);
  }

  private toInitials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (!parts.length) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
    const seed = this.hashText(chatId);
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

  private getActivityMembersByRow(row: ActivityListRow): ActivityMemberEntry[] {
    const rowKey = `${row.type}:${row.id}`;
    const cached = this.activityMembersByRowId[rowKey];
    if (cached) {
      return this.sortActivityMembersByActionTimeAsc([...cached]);
    }
    const others = this.users.filter(user => user.id !== this.activeUser.id);
    if (others.length === 0) {
      return [this.toActivityMemberEntry(this.activeUser, row, rowKey, { status: 'accepted', pendingSource: null, invitedByActiveUser: false })];
    }
    const seed = this.hashText(`${row.type}:${row.id}`);
    const acceptedTarget = row.type === 'invitations' ? 2 + (seed % 3) : 4 + (seed % 3);
    const pendingTarget = row.type === 'invitations' ? 1 + ((seed >> 2) % 2) : 1 + ((seed >> 3) % 3);
    const picked: DemoUser[] = [this.activeUser];
    const offsets = [0, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
    for (const offset of offsets) {
      const candidate = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === candidate.id)) {
        picked.push(candidate);
      }
      if (picked.length >= acceptedTarget) {
        break;
      }
    }
    const accepted = picked.map(user => this.toActivityMemberEntry(user, row, rowKey, { status: 'accepted', pendingSource: null, invitedByActiveUser: false }));
    const acceptedIds = new Set(accepted.map(item => item.userId));
    const pendingPool = others.filter(user => !acceptedIds.has(user.id));
    const pendingCount = Math.min(pendingTarget, pendingPool.length);
    for (let index = 0; index < pendingCount; index += 1) {
      const user = pendingPool[index];
      const isJoinRequest = ((seed + index) % 3) === 0;
      const pendingSource: ActivityPendingSource = row.isAdmin ? 'admin' : 'member';
      const baseEntry = this.toActivityMemberEntry(user, row, rowKey, {
        status: 'pending',
        pendingSource: isJoinRequest ? 'member' : pendingSource,
        invitedByActiveUser: !isJoinRequest
      });
      accepted.push({
        ...baseEntry,
        requestKind: isJoinRequest ? 'join' : 'invite'
      });
    }
    const ordered = this.sortActivityMembersByActionTimeAsc(accepted);
    this.activityMembersByRowId[rowKey] = [...ordered];
    return ordered;
  }

  private applySelectedActivityInvitations(): void {
    if (!this.selectedActivityMembersRow || !this.selectedActivityMembersRowId || this.selectedActivityInviteUserIds.length === 0) {
      this.selectedActivityInviteUserIds = [];
      return;
    }
    const selected = new Set(this.selectedActivityInviteUserIds);
    const pendingSource: ActivityPendingSource = this.selectedActivityMembersRow.isAdmin ? 'admin' : 'member';
    const nowIso = this.toIsoDateTime(new Date());
    const additions = this.activityInviteCandidates
      .filter(candidate => selected.has(candidate.userId))
      .map(candidate => ({
        ...candidate,
        status: 'pending' as const,
        pendingSource,
        requestKind: 'invite' as const,
        invitedByActiveUser: true,
        actionAtIso: nowIso
      }));
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
    this.selectedActivityInviteUserIds = [];
  }

  private toActivityMemberEntry(
    user: DemoUser,
    row: ActivityListRow,
    rowKey: string,
    defaults: { status: ActivityMemberStatus; pendingSource: ActivityPendingSource; invitedByActiveUser: boolean }
  ): ActivityMemberEntry {
    const seed = this.hashText(`${rowKey}:${user.id}`);
    const metAt = this.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const metPlaces = ['City Center Meetup', 'Board Game Night', 'Coffee Social', 'Hiking Group', 'Music Event', 'Brunch Table'];
    const place = metPlaces[seed % metPlaces.length];
    return {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      status: defaults.status,
      pendingSource: defaults.pendingSource,
      requestKind: defaults.status === 'pending' ? 'invite' : null,
      invitedByActiveUser: defaults.invitedByActiveUser,
      metAtIso: this.toIsoDateTime(metAt),
      actionAtIso: this.toIsoDateTime(metAt),
      metWhere: place,
      relevance: 40 + (seed % 61),
      avatarUrl: `https://i.pravatar.cc/1200?img=${(seed % 70) + 1}`
    };
  }

  private sortActivityMembersByActionTimeAsc(entries: ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries].sort((a, b) => this.toSortableDate(b.actionAtIso) - this.toSortableDate(a.actionAtIso));
  }

  private getChatItemById(chatId: string): ChatMenuItem | undefined {
    for (const entries of Object.values(DEMO_CHAT_BY_USER)) {
      const match = entries.find(item => item.id === chatId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      const chatThread = globalThis.document?.querySelector('.chat-thread');
      if (chatThread instanceof HTMLElement) {
        chatThread.scrollTop = chatThread.scrollHeight;
      }
    }, 0);
  }

  private toChatReader(user: DemoUser): ChatReadAvatar {
    return {
      id: user.id,
      initials: user.initials,
      gender: user.gender
    };
  }

  private hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  private resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  private getSupplyGapByKey(key: 'cars' | 'accommodation' | 'accessories'): number {
    return this.eventEditor.subEvents.reduce((maxGap, subEvent) => {
      const requirement = subEvent.requirements[key];
      return Math.max(maxGap, this.parseSupplyGap(requirement));
    }, 0);
  }

  private parseSupplyGap(value: string): number {
    const [currentRaw, totalRaw] = value.split('/');
    const current = Number.parseInt(currentRaw?.trim() ?? '', 10);
    const total = Number.parseInt(totalRaw?.trim() ?? '', 10);
    if (!Number.isFinite(current) || !Number.isFinite(total)) {
      return 0;
    }
    return Math.max(0, total - current);
  }

  private sortActivitiesRows(rows: ActivityListRow[]): ActivityListRow[] {
    const sorted = [...rows];
    if (this.activitiesSecondaryFilter === 'recent') {
      if (this.activitiesPrimaryFilter === 'events' || this.activitiesPrimaryFilter === 'hosting') {
        return sorted.sort((a, b) => this.toSortableDate(a.dateIso) - this.toSortableDate(b.dateIso));
      }
      return sorted.sort((a, b) => this.toSortableDate(b.dateIso) - this.toSortableDate(a.dateIso));
    }
    if (this.activitiesSecondaryFilter === 'past') {
      return sorted.sort((a, b) => this.toSortableDate(b.dateIso) - this.toSortableDate(a.dateIso));
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || this.toSortableDate(b.dateIso) - this.toSortableDate(a.dateIso));
    }
    if (this.activitiesPrimaryFilter === 'events' || this.activitiesPrimaryFilter === 'hosting') {
      return sorted.sort((a, b) => b.metricScore - a.metricScore || this.toSortableDate(a.dateIso) - this.toSortableDate(b.dateIso));
    }
    return sorted.sort((a, b) => b.metricScore - a.metricScore || this.toSortableDate(b.dateIso) - this.toSortableDate(a.dateIso));
  }

  private matchesRateFilter(item: RateMenuItem, filter: RateFilterKey): boolean {
    const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
    return item.mode === modeKey && this.displayedRateDirection(item) === directionKey;
  }

  private resetActivitiesScroll(): void {
    this.seedActivitiesStickyHeader();
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

  protected trackByCalendarPageKey(_: number, page: CalendarMonthPage | CalendarWeekPage): string {
    return page.key;
  }

  protected trackByCalendarMonthWeekKey(_: number, week: CalendarMonthWeek): string {
    return this.dateKey(week.start);
  }

  protected trackByCalendarDayKey(_: number, day: CalendarDayCell): string {
    return day.key;
  }

  private initialCalendarPageIndex(): number {
    const today = this.dateOnly(new Date());
    if (this.activitiesView === 'month') {
      const focus = this.calendarMonthFocusDate ? this.startOfMonth(this.calendarMonthFocusDate) : this.startOfMonth(today);
      const monthKey = this.monthKey(focus);
      const pages = this.calendarMonthPages;
      const pageIndex = pages.findIndex(page => page.key === monthKey);
      return pageIndex >= 0 ? pageIndex : Math.min(this.calendarAnchorRadius, Math.max(0, pages.length - 1));
    }
    if (this.activitiesView === 'week') {
      const focus = this.calendarWeekFocusDate ? this.startOfWeekMonday(this.calendarWeekFocusDate) : this.startOfWeekMonday(today);
      const weekKey = this.dateKey(focus);
      const pages = this.calendarWeekPages;
      const pageIndex = pages.findIndex(page => page.key === weekKey);
      return pageIndex >= 0 ? pageIndex : Math.min(this.calendarAnchorRadius, Math.max(0, pages.length - 1));
    }
    return 0;
  }

  private buildActivityRowsByDate(rows: ActivityListRow[]): Map<string, ActivityListRow[]> {
    const byDate = new Map<string, ActivityListRow[]>();
    for (const row of rows) {
      const range = this.activityDateRange(row);
      if (!range) {
        continue;
      }
      let cursor = this.dateOnly(range.start);
      const endDate = this.dateOnly(range.end);
      while (cursor.getTime() <= endDate.getTime()) {
        const key = this.dateKey(cursor);
        const current = byDate.get(key) ?? [];
        current.push(row);
        byDate.set(key, current);
        cursor = this.addDays(cursor, 1);
      }
    }
    return byDate;
  }

  private activityDateRange(row: ActivityListRow): { start: Date; end: Date } | null {
    if (row.type === 'rates') {
      const point = new Date(row.dateIso);
      if (Number.isNaN(point.getTime())) {
        return null;
      }
      // Rates are point-in-time events for calendar heat/count views.
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
    const fallbackEnd = new Date(parsed.getTime() + 2 * 60 * 60 * 1000);
    return { start: parsed, end: fallbackEnd };
  }

  private monthAnchorsForRows(rows: ActivityListRow[]): Date[] {
    if (this.calendarMonthAnchorPages && this.calendarMonthAnchorPages.length > 0) {
      return [...this.calendarMonthAnchorPages];
    }
    const todayMonth = this.startOfMonth(this.dateOnly(new Date()));
    const focusMonth = this.calendarMonthFocusDate ? this.startOfMonth(this.calendarMonthFocusDate) : todayMonth;
    this.calendarMonthAnchorPages = this.buildMonthAnchorWindow(focusMonth);
    return [...this.calendarMonthAnchorPages];
  }

  private weekAnchorsForRows(rows: ActivityListRow[]): Date[] {
    if (this.calendarWeekAnchorPages && this.calendarWeekAnchorPages.length > 0) {
      return [...this.calendarWeekAnchorPages];
    }
    const todayWeek = this.startOfWeekMonday(this.dateOnly(new Date()));
    const focusWeek = this.calendarWeekFocusDate ? this.startOfWeekMonday(this.calendarWeekFocusDate) : todayWeek;
    this.calendarWeekAnchorPages = this.buildWeekAnchorWindow(focusWeek);
    return [...this.calendarWeekAnchorPages];
  }

  private calendarRowsSignature(rows: ActivityListRow[]): string {
    return rows
      .map(row => {
        const range = this.activityDateTimeRangeById[row.id];
        const rangeSignature = range ? `${range.startIso}:${range.endIso}` : '';
        return `${row.type}:${row.id}:${row.dateIso}:${rangeSignature}`;
      })
      .join(',');
  }

  private buildMonthPage(anchor: Date, rowsByDate: Map<string, ActivityListRow[]>, rows: ActivityListRow[]): CalendarMonthPage {
    const firstDay = this.startOfMonth(anchor);
    const firstWeekStart = this.startOfWeekMonday(firstDay);
    const monthEnd = this.endOfMonth(anchor);
    const lastWeekEnd = this.endOfWeekSunday(monthEnd);
    const weeks: CalendarMonthWeek[] = [];
    let cursor = this.dateOnly(firstWeekStart);
    while (cursor.getTime() <= lastWeekEnd.getTime()) {
      const weekStart = this.dateOnly(cursor);
      const weekEnd = this.addDays(weekStart, 6);
      const days: CalendarDayCell[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = this.addDays(cursor, day);
        days.push(this.buildCalendarDayCell(date, rowsByDate, firstDay.getMonth()));
      }
      weeks.push({
        start: weekStart,
        end: weekEnd,
        days,
        spans: this.buildMonthWeekSpans(weekStart, weekEnd, rows)
      });
      cursor = this.addDays(cursor, 7);
    }
    return {
      key: this.monthKey(anchor),
      label: anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      weeks
    };
  }

  private buildWeekPage(anchor: Date, rowsByDate: Map<string, ActivityListRow[]>): CalendarWeekPage {
    const start = this.startOfWeekMonday(anchor);
    const days: CalendarDayCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = this.addDays(start, day);
      days.push(this.buildCalendarDayCell(date, rowsByDate, date.getMonth()));
    }
    const end = this.addDays(start, 6);
    return {
      key: this.dateKey(start),
      label: this.weekRangeLabel(start, end),
      days
    };
  }

  private buildMonthWeekSpans(weekStart: Date, weekEnd: Date, rows: ActivityListRow[]): CalendarMonthSpan[] {
    const spansBase: Array<{ row: ActivityListRow; startCol: number; endCol: number }> = [];
    for (const row of rows) {
      const range = this.activityDateRange(row);
      if (!range) {
        continue;
      }
      const startDate = this.dateOnly(range.start);
      const endDate = this.dateOnly(range.end);
      if (!this.dateRangeOverlaps(startDate, endDate, weekStart, weekEnd)) {
        continue;
      }
      const visibleStart = startDate.getTime() < weekStart.getTime() ? weekStart : startDate;
      const visibleEnd = endDate.getTime() > weekEnd.getTime() ? weekEnd : endDate;
      spansBase.push({
        row,
        startCol: Math.max(0, this.dayDiff(weekStart, visibleStart)),
        endCol: Math.min(6, this.dayDiff(weekStart, visibleEnd))
      });
    }

    spansBase.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);
    const lanes: Array<Array<{ startCol: number; endCol: number }>> = [];
    const spans: CalendarMonthSpan[] = [];

    for (const span of spansBase) {
      let laneIndex = 0;
      while (laneIndex < lanes.length) {
        const conflict = lanes[laneIndex].some(item => !(span.endCol < item.startCol || span.startCol > item.endCol));
        if (!conflict) {
          break;
        }
        laneIndex += 1;
      }
      if (!lanes[laneIndex]) {
        lanes[laneIndex] = [];
      }
      lanes[laneIndex].push({ startCol: span.startCol, endCol: span.endCol });
      spans.push({
        key: `${span.row.id}-${this.dateKey(weekStart)}-${span.startCol}-${span.endCol}-${laneIndex}`,
        row: span.row,
        startCol: span.startCol,
        endCol: span.endCol,
        lane: laneIndex
      });
    }

    return spans;
  }

  private buildCalendarDayCell(date: Date, rowsByDate: Map<string, ActivityListRow[]>, currentMonthIndex: number): CalendarDayCell {
    const safeDate = this.dateOnly(date);
    const key = this.dateKey(safeDate);
    const todayKey = this.dateKey(this.dateOnly(new Date()));
    return {
      key,
      date: safeDate,
      dayNumber: safeDate.getDate(),
      inCurrentMonth: safeDate.getMonth() === currentMonthIndex,
      isToday: key === todayKey,
      rows: rowsByDate.get(key) ?? []
    };
  }

  private weekRangeLabel(start: Date, end: Date): string {
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  private dayDiff(from: Date, to: Date): number {
    const ms = this.dateOnly(to).getTime() - this.dateOnly(from).getTime();
    return Math.floor(ms / 86400000);
  }

  private dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
  }

  private countOverlappingRows(rows: ActivityListRow[], start: Date, end: Date): number {
    let count = 0;
    for (const row of rows) {
      const range = this.activityDateRange(row);
      if (!range) {
        continue;
      }
      if (range.start.getTime() < end.getTime() && range.end.getTime() > start.getTime()) {
        count += 1;
      }
    }
    return count;
  }

  private rateHeatClass(count: number): string {
    if (count <= 0) {
      return 'activities-rate-heat-0';
    }
    const clamped = Math.min(100, count);
    const normalized = (clamped - 1) / 99;
    if (normalized <= 0.16) {
      return 'activities-rate-heat-1';
    }
    if (normalized <= 0.32) {
      return 'activities-rate-heat-2';
    }
    if (normalized <= 0.5) {
      return 'activities-rate-heat-3';
    }
    if (normalized <= 0.68) {
      return 'activities-rate-heat-4';
    }
    if (normalized <= 0.84) {
      return 'activities-rate-heat-5';
    }
    return 'activities-rate-heat-6';
  }

  private dateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private dateKey(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private monthKey(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private parseDateKey(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return this.dateOnly(new Date(year, month - 1, day));
  }

  private parseMonthKey(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return null;
    }
    return this.startOfMonth(new Date(year, month - 1, 1));
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
        this.parseMonthKey(edgePage.key) ??
        this.startOfMonth(this.dateOnly(new Date()));
    } else {
      this.calendarWeekFocusDate =
        this.parseDateKey(edgePage.key) ??
        this.startOfWeekMonday(this.dateOnly(new Date()));
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

    if (this.isCalendarLayoutView()) {
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
      this.activitiesHeaderProgress = this.clampNumber(calendarElement.scrollLeft / maxHorizontalScroll, 0, 1);
      return;
    }

    const listElement = this.activitiesScrollRef?.nativeElement;
    if (!listElement) {
      this.activitiesHeaderProgress = 0;
      return;
    }
    const maxVerticalScroll = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
    if (maxVerticalScroll <= 1) {
      this.activitiesHeaderProgress = 0;
      return;
    }
    this.activitiesHeaderProgress = this.clampNumber(listElement.scrollTop / maxVerticalScroll, 0, 1);
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

  private forceLoadMoreActivities(scrollElement: HTMLElement): void {
    if (this.activePopup !== 'activities' || this.isCalendarLayoutView() || this.activitiesIsPaginating) {
      return;
    }
    const rows = this.buildFilteredActivityRowsBase();
    this.ensureActivitiesPaginationState(rows.length);
    this.activitiesPaginationAwaitScrollReset = false;
    // Pull-up explicitly triggers a server-like refresh route too, even if
    // there are no currently unseen local rows.
    this.startActivitiesPaginationLoad(true);
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
      this.activitiesIsPaginating = false;
      this.activitiesPaginationAwaitScrollReset = true;
      this.endActivitiesHeaderProgressLoading();
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
    this.activitiesVisibleCount = Math.min(this.activitiesPageSize, totalRows);
    this.activitiesPaginationAwaitScrollReset = false;
    this.cancelActivitiesPaginationLoad();
    this.updateActivitiesHeaderProgress();
  }

  private activitiesPaginationStateKey(): string {
    return [
      this.activeUserId,
      this.activitiesPrimaryFilter,
      this.activitiesSecondaryFilter,
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
  }

  private beginActivitiesHeaderProgressLoading(): void {
    if (this.isCalendarLayoutView()) {
      return;
    }
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
    const nextProgress = this.clampNumber(elapsed / this.activitiesHeaderLoadingWindowMs, 0, 1);
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

  private releaseActivitiesBottomPull(): void {
    this.activitiesBottomPullTracking = false;
    this.activitiesBottomPullEdgeLocked = false;
    this.activitiesBottomPullStartOnLastRow = false;
    this.activitiesBottomPullArmed = false;
    if (this.activitiesBottomPullReleaseTimer) {
      clearTimeout(this.activitiesBottomPullReleaseTimer);
      this.activitiesBottomPullReleaseTimer = null;
    }
    this.activitiesBottomPullReleasing = true;
    this.activitiesBottomPullPx = 0;
    this.activitiesBottomPullReleaseTimer = setTimeout(() => {
      this.activitiesBottomPullReleasing = false;
      this.activitiesBottomPullReleaseTimer = null;
    }, 220);
  }

  private resetActivitiesBottomPullState(): void {
    this.activitiesBottomPullTracking = false;
    this.activitiesBottomPullEdgeLocked = false;
    this.activitiesBottomPullStartOnLastRow = false;
    this.activitiesBottomPullArmed = false;
    this.activitiesBottomPullPx = 0;
    this.activitiesBottomPullReleasing = false;
  }

  private refreshActivitiesHeaderProgressSoon(): void {
    const refresh = () => this.updateActivitiesHeaderProgress();
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

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private beginActivitiesBottomPull(container: HTMLElement, eventTarget: EventTarget | null, startY: number): void {
    this.activitiesBottomPullTracking = true;
    this.activitiesBottomPullEdgeLocked = false;
    const targetElement = eventTarget instanceof HTMLElement ? eventTarget : null;
    const touchedRow = targetElement?.closest('.activities-row-item') as HTMLElement | null;
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.activities-row-item'));
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
    this.activitiesBottomPullStartOnLastRow = !!(touchedRow && lastRow && touchedRow === lastRow);
    this.activitiesBottomPullStartY = startY;
    this.activitiesBottomPullArmed = false;
  }

  private moveActivitiesBottomPull(container: HTMLElement, currentY: number): boolean {
    const remainingPx = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (!this.activitiesBottomPullEdgeLocked) {
      const isBottomEdge = remainingPx <= 1;
      if (!isBottomEdge && !this.activitiesBottomPullStartOnLastRow) {
        this.resetActivitiesBottomPullState();
        return false;
      }
      this.activitiesBottomPullEdgeLocked = true;
    }
    const deltaY = currentY - this.activitiesBottomPullStartY;
    const pullUpDelta = Math.max(0, -deltaY);
    const pullPx = this.clampNumber(pullUpDelta * 0.42, 0, this.activitiesBottomPullMaxPx);
    if (pullPx <= 0) {
      return false;
    }
    this.activitiesBottomPullPx = pullPx;
    this.activitiesBottomPullArmed = pullPx >= this.activitiesBottomPullTriggerPx;
    this.activitiesBottomPullReleasing = false;
    container.scrollTop = container.scrollHeight;
    return true;
  }

  private finishActivitiesBottomPull(container: HTMLElement | null): void {
    const shouldTrigger = this.activitiesBottomPullArmed || this.activitiesBottomPullPx >= this.activitiesBottomPullTriggerPx * 0.8;
    this.releaseActivitiesBottomPull();
    if (shouldTrigger && container) {
      this.forceLoadMoreActivities(container);
    }
  }

  private shiftCalendarPages(direction: -1 | 1): void {
    if (this.activitiesView === 'month') {
      const pages = this.calendarMonthAnchorPages ?? this.monthAnchorsForRows([]);
      if (pages.length < this.calendarAnchorWindowSize) {
        return;
      }
      if (direction < 0) {
        const first = pages[0];
        this.calendarMonthAnchorPages = [this.addMonths(first, -1), ...pages.slice(0, pages.length - 1)];
      } else {
        const last = pages[pages.length - 1];
        this.calendarMonthAnchorPages = [...pages.slice(1), this.addMonths(last, 1)];
      }
      return;
    }
    const pages = this.calendarWeekAnchorPages ?? this.weekAnchorsForRows([]);
    if (pages.length < this.calendarAnchorWindowSize) {
      return;
    }
    if (direction < 0) {
      const first = pages[0];
      this.calendarWeekAnchorPages = [this.addDays(first, -7), ...pages.slice(0, pages.length - 1)];
    } else {
      const last = pages[pages.length - 1];
      this.calendarWeekAnchorPages = [...pages.slice(1), this.addDays(last, 7)];
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
        this.calendarMonthAnchorPages = this.buildMonthAnchorWindow(focus);
      } else if (this.activitiesView === 'week' && this.calendarWeekAnchorPages?.length === 1) {
        const focus = this.calendarWeekAnchorPages[0];
        this.calendarWeekAnchorPages = this.buildWeekAnchorWindow(focus);
      } else {
        return;
      }
      this.calendarInitialPageIndexOverride = this.calendarAnchorRadius;
      this.resetActivitiesScroll();
    }, 0);
  }

  private addDays(value: Date, days: number): Date {
    const copy = new Date(value);
    copy.setDate(copy.getDate() + days);
    return this.dateOnly(copy);
  }

  private buildMonthAnchorWindow(focusMonth: Date): Date[] {
    const radius = this.calendarAnchorRadius;
    const anchors: Date[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      anchors.push(this.addMonths(focusMonth, offset));
    }
    return anchors;
  }

  private buildWeekAnchorWindow(focusWeek: Date): Date[] {
    const radius = this.calendarAnchorRadius;
    const anchors: Date[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      anchors.push(this.addDays(focusWeek, offset * 7));
    }
    return anchors;
  }

  private addMonths(value: Date, months: number): Date {
    const copy = new Date(value.getFullYear(), value.getMonth() + months, 1);
    return this.dateOnly(copy);
  }

  private startOfMonth(value: Date): Date {
    return this.dateOnly(new Date(value.getFullYear(), value.getMonth(), 1));
  }

  private endOfMonth(value: Date): Date {
    return this.dateOnly(new Date(value.getFullYear(), value.getMonth() + 1, 0));
  }

  private startOfWeekMonday(value: Date): Date {
    const copy = this.dateOnly(value);
    const day = copy.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return this.addDays(copy, mondayOffset);
  }

  private endOfWeekSunday(value: Date): Date {
    return this.addDays(this.startOfWeekMonday(value), 6);
  }

  private activityGroupLabel(row: ActivityListRow): string {
    if (this.activitiesView === 'distance') {
      const bucket = Math.max(5, Math.ceil(row.distanceKm / 5) * 5);
      return `${bucket} km`;
    }
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    if (this.activitiesView === 'day') {
      return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (this.activitiesView === 'month') {
      return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return `Week ${this.isoWeekNumber(parsed)}, ${parsed.getFullYear()}`;
  }

  private isoWeekNumber(date: Date): number {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private cloneMapItems<T>(input: Record<string, T[]>): Record<string, T[]> {
    const output: Record<string, T[]> = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = value.map(item => ({ ...item }));
    }
    return output;
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private initialsFromText(value: string): string {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'U';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  private findUserByName(name: string): DemoUser | undefined {
    const target = this.normalizeText(name);
    return this.users.find(user => this.normalizeText(user.name) === target);
  }
}
