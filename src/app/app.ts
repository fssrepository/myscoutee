import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
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
  ProfileGroup
} from './shared/demo-data';
import { environment } from '../environments/environment';

type MenuSection = 'game' | 'chat' | 'invitations' | 'events' | 'hosting';

type PopupType =
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
    | { kind: 'assetFilter' };
}

type AssetType = 'Car' | 'Accommodation' | 'Supplies';
type AssetRequestAction = 'accept' | 'remove';
type AssetRequestStatus = 'pending' | 'accepted';

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
    FormsModule
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

  protected selectedChat: ChatMenuItem | null = null;
  protected selectedChatMembers: DemoUser[] = [];
  protected selectedChatMembersItem: ChatMenuItem | null = null;
  protected selectedInvitation: InvitationMenuItem | null = null;
  protected selectedEvent: EventMenuItem | null = null;
  protected selectedHostingEvent: HostingMenuItem | null = null;

  protected imageSlots: Array<string | null> = [];
  protected selectedImageIndex = 0;
  protected pendingSlotUploadIndex: number | null = null;
  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('assetImageInput') private assetImageInput?: ElementRef<HTMLInputElement>;

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

  constructor(private readonly router: Router) {
    this.initializeProfileImageSlots();
    this.profileDetailsForm = this.createProfileDetailsForm();
    this.syncProfileFormFromActiveUser();
    this.router.navigate(['/game']);
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
    return this.resolveSectionBadge(
      this.hostingItems.map(item => item.activity),
      this.hostingItems.length
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
    return DEMO_INVITATIONS_BY_USER[this.activeUser.id] ?? DEMO_INVITATIONS_BY_USER['u1'];
  }

  protected get eventItems(): EventMenuItem[] {
    return DEMO_EVENTS_BY_USER[this.activeUser.id] ?? DEMO_EVENTS_BY_USER['u1'];
  }

  protected get hostingItems(): HostingMenuItem[] {
    return DEMO_HOSTING_BY_USER[this.activeUser.id] ?? DEMO_HOSTING_BY_USER['u1'];
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

  protected openChatShortcut(): void {
    const [firstItem] = this.chatItems;
    if (firstItem) {
      this.openChatItem(firstItem, false);
      return;
    }
    this.activeMenuSection = 'chat';
  }

  protected openInvitationShortcut(): void {
    const [firstItem] = this.invitationItems;
    if (firstItem) {
      this.openInvitationItem(firstItem, false);
      return;
    }
    this.activeMenuSection = 'invitations';
  }

  protected openEventShortcut(): void {
    const [firstItem] = this.eventItems;
    if (firstItem) {
      this.openEventItem(firstItem, false);
      return;
    }
    this.openEventExplore(false);
  }

  protected openHostingShortcut(): void {
    const [firstItem] = this.hostingItems;
    if (firstItem) {
      this.openHostingItem(firstItem, false);
      return;
    }
    this.activeMenuSection = 'hosting';
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

  protected openChatItem(item: ChatMenuItem, closeMenu = true): void {
    this.activeMenuSection = 'chat';
    this.selectedChat = item;
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

  protected openInvitationItem(item: InvitationMenuItem, closeMenu = true): void {
    this.activeMenuSection = 'invitations';
    this.selectedInvitation = item;
    this.activePopup = 'invitationActions';
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openEventItem(item: EventMenuItem, closeMenu = true): void {
    this.activeMenuSection = 'events';
    this.selectedEvent = item;
    this.activePopup = 'menuEvent';
    if (closeMenu) {
      this.closeUserMenu();
    }
  }

  protected openHostingItem(item: HostingMenuItem, closeMenu = true): void {
    this.activeMenuSection = 'hosting';
    this.selectedHostingEvent = item;
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
    this.pendingAssetMemberAction = null;
    this.selectedAssetCardId = null;
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
    this.router.navigate(['/game']);
  }

  protected openUserSelector(): void {
    this.showUserSelector = true;
    this.closeUserMenu();
  }

  protected getPopupTitle(): string {
    switch (this.activePopup) {
      case 'chat':
        return this.selectedChat?.title ?? 'Chat';
      case 'chatMembers':
        return 'Chat Members';
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
      case 'chatMembers':
        return 'Chat Members';
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
    return window.matchMedia('(max-width: 760px)').matches;
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
        toneClass: this.assetTypeClass(option)
      })),
      context: { kind: 'assetFilter' }
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

  protected openHostImpressions(): void {
    this.activePopup = 'impressionsHost';
  }

  protected openMemberImpressions(): void {
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

  protected deleteAssetCard(cardId: string): void {
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
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(safe) ? new Date(`${safe}T00:00:00`) : new Date(`${safe}-01T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
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

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
