import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { DEMO_USERS, DemoUser, PROFILE_DETAILS } from '../../shared/demo-data';

type LocalPopup = 'history' | 'filter' | null;
type FilterSelectorKind =
  | 'interests'
  | 'values'
  | 'physiques'
  | 'languages'
  | 'genders'
  | 'horoscopes'
  | 'traitLabels'
  | 'smoking'
  | 'drinking'
  | 'workout'
  | 'pets'
  | 'familyPlans'
  | 'children'
  | 'loveStyles'
  | 'communicationStyles'
  | 'sexualOrientations'
  | 'religions';

interface GameFilterForm {
  ageMin: number;
  ageMax: number;
  heightMinCm: number;
  heightMaxCm: number;
  interests: string[];
  values: string[];
  physiques: string[];
  languages: string[];
  genders: Array<DemoUser['gender']>;
  horoscopes: string[];
  traitLabels: string[];
  smoking: string[];
  drinking: string[];
  workout: string[];
  pets: string[];
  familyPlans: string[];
  children: string[];
  loveStyles: string[];
  communicationStyles: string[];
  sexualOrientations: string[];
  religions: string[];
}

interface GameUserFacet {
  interests: string[];
  values: string[];
  smoking: string;
  drinking: string;
  workout: string;
  pets: string;
  familyPlans: string;
  children: string;
  loveStyle: string;
  communicationStyle: string;
  sexualOrientation: string;
  religion: string;
}

interface GameFilterOptionGroup {
  title: string;
  icon: string;
  toneClass: string;
  options: string[];
}

interface LeavingGameCardState {
  candidate: DemoUser;
  imageUrl: string | null;
  imageCount: number;
  imageIndex: number;
  initials: string;
  rating: number;
}

const PUBLIC_PROFILE_DETAIL_LABELS = new Set(
  PROFILE_DETAILS.flatMap(group =>
    group.rows
      .filter(row => row.privacy === 'Public')
      .map(row => row.label.trim().toLowerCase())
  )
);

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, FormsModule, MatSliderModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  private static readonly AGE_MIN = 18;
  private static readonly AGE_MAX = 120;
  private static readonly HEIGHT_MIN_CM = 40;
  private static readonly HEIGHT_MAX_CM = 250;
  private readonly gameFilterInterestGroups: GameFilterOptionGroup[] = [
    {
      title: 'Social',
      icon: 'celebration',
      toneClass: 'game-filter-group-tone-social',
      options: ['#GoingOut', '#Nightlife', '#StayingIn', '#Brunch', '#WineTasting', '#CoffeeDates', '#ContentCreation', '#InfluencerLife']
    },
    {
      title: 'Arts',
      icon: 'palette',
      toneClass: 'game-filter-group-tone-arts',
      options: ['#Music', '#Concerts', '#Festivals', '#Movies', '#TVShows', '#Theatre', '#Gaming', '#Anime', '#Books', '#Photography', '#Creativity']
    },
    {
      title: 'Food',
      icon: 'restaurant',
      toneClass: 'game-filter-group-tone-food',
      options: ['#Foodie', '#FineDining', '#StreetFood', '#Cooking', '#Cocktails', '#CraftBeer', '#Travel', '#LuxuryExperiences']
    },
    {
      title: 'Active',
      icon: 'hiking',
      toneClass: 'game-filter-group-tone-active',
      options: ['#Sports', '#Gym', '#Running', '#Hiking', '#Outdoors', '#ExtremeSports', '#Yoga', '#Fitness']
    },
    {
      title: 'Mind',
      icon: 'self_improvement',
      toneClass: 'game-filter-group-tone-mind',
      options: ['#Wellness', '#Meditation', '#SelfDevelopment', '#MentalHealth', '#Spirituality', '#Biohacking', '#HealthyLifestyle']
    },
    {
      title: 'Identity',
      icon: 'public',
      toneClass: 'game-filter-group-tone-identity',
      options: ['#Sustainability', '#Entrepreneurship', '#CareerDriven', '#FamilyOriented', '#Activism', '#Tech', '#Minimalism']
    }
  ];
  private readonly gameFilterValuesGroups: GameFilterOptionGroup[] = [
    {
      title: 'Family',
      icon: 'family_restroom',
      toneClass: 'game-filter-group-tone-family',
      options: ['Long-term partnership', 'Marriage-oriented', 'Casual dating', 'Open / Exploring', 'Family-first', 'Wants children', 'Independent lifestyle']
    },
    {
      title: 'Ambition',
      icon: 'track_changes',
      toneClass: 'game-filter-group-tone-ambition',
      options: ['Career-focused', 'Entrepreneurial', 'Stability-focused', 'Balanced work-life', 'Freedom-oriented', 'Goal-driven']
    },
    {
      title: 'Lifestyle',
      icon: 'eco',
      toneClass: 'game-filter-group-tone-lifestyle',
      options: ['Health & wellness focused', 'Fitness-driven', 'Mindfulness-oriented', 'Social / party lifestyle', 'Calm / home-centered', 'Adventure-driven', 'Balanced lifestyle']
    },
    {
      title: 'Beliefs',
      icon: 'auto_awesome',
      toneClass: 'game-filter-group-tone-beliefs',
      options: ['Faith-oriented', 'Spiritual but not religious', 'Secular', 'Traditional values', 'Progressive values', 'Community-driven', 'Social impact oriented', 'Environmentally conscious', 'Politically engaged', 'Apolitical']
    }
  ];
  private readonly userFacetById: Record<string, GameUserFacet> = {
    u1: {
      interests: ['#Outdoors', '#Travel', '#Brunch'],
      values: ['Family-first', 'Balanced lifestyle', 'Community-driven'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'daily',
      pets: 'all pets welcome',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'open relationship',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'bisexual',
      religion: 'hindu'
    },
    u2: {
      interests: ['#Sports', '#Gaming', '#Tech'],
      values: ['Career-focused', 'Goal-driven', 'Stability-focused'],
      smoking: 'never',
      drinking: 'socially',
      workout: 'few times / week',
      pets: 'dog person',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u3: {
      interests: ['#Concerts', '#Photography', '#Outdoors'],
      values: ['Balanced lifestyle', 'Mindfulness-oriented', 'Community-driven'],
      smoking: 'never',
      drinking: 'occasionally',
      workout: 'few times / week',
      pets: 'cat person',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    },
    u4: {
      interests: ['#Outdoors', '#Sports', '#Travel'],
      values: ['Adventure-driven', 'Social / party lifestyle', 'Balanced lifestyle'],
      smoking: 'occasionally',
      drinking: 'socially',
      workout: 'daily',
      pets: 'all pets welcome',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'exploring',
      communicationStyle: 'energetic',
      sexualOrientation: 'straight',
      religion: 'christian'
    },
    u5: {
      interests: ['#Books', '#Wellness', '#Meditation'],
      values: ['Calm / home-centered', 'Mindfulness-oriented', 'Progressive values'],
      smoking: 'never',
      drinking: 'never',
      workout: 'few times / week',
      pets: 'pet free',
      familyPlans: 'undecided',
      children: 'no',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'lesbian',
      religion: 'buddhist'
    },
    u6: {
      interests: ['#Travel', '#Outdoors', '#GoingOut'],
      values: ['Adventure-driven', 'Social / party lifestyle', 'Spiritual but not religious'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'dog person',
      familyPlans: 'open to both',
      children: 'yes',
      loveStyle: 'open relationship',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    },
    u7: {
      interests: ['#Gaming', '#Tech', '#CoffeeDates'],
      values: ['Career-focused', 'Goal-driven', 'Secular'],
      smoking: 'never',
      drinking: 'occasionally',
      workout: 'weekly',
      pets: 'pet free',
      familyPlans: 'not planning',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'low-key',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u8: {
      interests: ['#Music', '#Movies', '#Foodie'],
      values: ['Balanced lifestyle', 'Community-driven', 'Family-first'],
      smoking: 'occasionally',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'cat person',
      familyPlans: 'open to both',
      children: 'yes',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'bisexual',
      religion: 'christian'
    },
    u9: {
      interests: ['#Sports', '#Outdoors', '#Travel'],
      values: ['Fitness-driven', 'Goal-driven', 'Stability-focused'],
      smoking: 'never',
      drinking: 'socially',
      workout: 'daily',
      pets: 'dog person',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u10: {
      interests: ['#Tech', '#Gaming', '#Movies'],
      values: ['Balanced work-life', 'Career-focused', 'Progressive values'],
      smoking: 'occasionally',
      drinking: 'occasionally',
      workout: 'weekly',
      pets: 'pet free',
      familyPlans: 'undecided',
      children: 'no',
      loveStyle: 'exploring',
      communicationStyle: 'low-key',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u11: {
      interests: ['#Wellness', '#Yoga', '#Books'],
      values: ['Family-first', 'Health & wellness focused', 'Faith-oriented'],
      smoking: 'never',
      drinking: 'never',
      workout: 'few times / week',
      pets: 'all pets welcome',
      familyPlans: 'wants children',
      children: 'yes',
      loveStyle: 'long-term partnership',
      communicationStyle: 'listener first',
      sexualOrientation: 'straight',
      religion: 'hindu'
    },
    u12: {
      interests: ['#Foodie', '#GoingOut', '#CoffeeDates'],
      values: ['Social impact oriented', 'Community-driven', 'Balanced lifestyle'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'all pets welcome',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'open relationship',
      communicationStyle: 'energetic',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    }
  };
  private users = DEMO_USERS;
  protected selectedRating = 7;
  protected isPairMode = false;
  protected cardIndex = 0;
  protected isRatingBarBlinking = false;
  protected isCandidateImageLoading = false;
  protected isCandidateImageIndicatorRevealing = false;
  protected leavingGameCard: LeavingGameCardState | null = null;
  protected selectedCandidateImageIndex = 0;
  protected candidateImageZoom = 1;
  protected candidateImagePanX = 0;
  protected candidateImagePanY = 0;
  protected localPopup: LocalPopup = null;
  protected activeUserId = this.getActiveUserId();
  protected filterDraft: GameFilterForm;
  protected gameFilter: GameFilterForm;
  protected filterSelector: FilterSelectorKind | null = null;
  protected filterLanguageInput = '';
  private filterLanguageSuggestionPool: string[] = [];
  private readonly failedCandidateImageUrls = new Set<string>();
  private ratingBarBlinkTimeout: ReturnType<typeof setTimeout> | null = null;
  private candidateImageIndicatorRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private gameCardLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private isCandidateImageDragging = false;
  private candidateDragOffsetX = 0;
  private candidateDragOffsetY = 0;
  private activeTouchId: number | null = null;
  constructor(private readonly cdr: ChangeDetectorRef) {
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
    this.refreshFilterLanguageSuggestionPool();
    this.beginCandidateImageLoadingForCurrentSelection();
  }

  ngOnDestroy(): void {
    if (this.ratingBarBlinkTimeout) {
      clearTimeout(this.ratingBarBlinkTimeout);
      this.ratingBarBlinkTimeout = null;
    }
    if (this.candidateImageIndicatorRevealTimer) {
      clearTimeout(this.candidateImageIndicatorRevealTimer);
      this.candidateImageIndicatorRevealTimer = null;
    }
    if (this.gameCardLeaveTimer) {
      clearTimeout(this.gameCardLeaveTimer);
      this.gameCardLeaveTimer = null;
    }
  }

  protected get activeUser(): DemoUser {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected gamePageStatusClass(): string {
    switch (this.activeUser.profileStatus) {
      case 'friends only':
        return 'game-page-status-friends';
      case 'host only':
        return 'game-page-status-host';
      case 'inactive':
        return 'game-page-status-inactive';
      case 'public':
      default:
        return 'game-page-status-public';
    }
  }

  protected get candidatePool(): DemoUser[] {
    return this.users
      .filter(user => user.id !== this.activeUserId)
      .filter(user => this.matchesFilter(user));
  }

  protected get activeCandidate(): DemoUser | null {
    const pool = this.candidatePool;
    if (pool.length === 0) {
      return null;
    }
    return pool[this.cardIndex % pool.length] ?? null;
  }

  protected get pairModeWomanCandidate(): DemoUser | null {
    return this.pairModeCandidateForGender('woman');
  }

  protected get pairModeManCandidate(): DemoUser | null {
    return this.pairModeCandidateForGender('man');
  }

  protected get hasPairModeCandidates(): boolean {
    return this.pairModeWomanCandidate !== null || this.pairModeManCandidate !== null;
  }

  protected get hasCandidatesForCurrentMode(): boolean {
    return this.isPairMode ? this.hasPairModeCandidates : this.activeCandidate !== null;
  }

  protected get hasFilteredCandidates(): boolean {
    return this.candidatePool.length > 0;
  }

  protected get minAgeBound(): number {
    return HomeComponent.AGE_MIN;
  }

  protected get maxAgeBound(): number {
    return HomeComponent.AGE_MAX;
  }

  protected get minHeightBoundCm(): number {
    return HomeComponent.HEIGHT_MIN_CM;
  }

  protected get maxHeightBoundCm(): number {
    return HomeComponent.HEIGHT_MAX_CM;
  }

  protected get availablePhysiques(): string[] {
    return Array.from(new Set(this.users.map(user => user.physique))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableInterests(): string[] {
    return Array.from(new Set(this.users.flatMap(user => this.userInterests(user)))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableValues(): string[] {
    return Array.from(new Set(this.users.flatMap(user => this.userValues(user)))).sort((a, b) => a.localeCompare(b));
  }

  protected get interestOptionGroups(): GameFilterOptionGroup[] {
    return this.gameFilterInterestGroups;
  }

  protected get valuesOptionGroups(): GameFilterOptionGroup[] {
    return this.gameFilterValuesGroups;
  }

  protected get availableLanguages(): string[] {
    return Array.from(new Set(this.users.flatMap(user => user.languages))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableSmokingOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).smoking))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableDrinkingOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).drinking))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableWorkoutOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).workout))).sort((a, b) => a.localeCompare(b));
  }

  protected get availablePetsOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).pets))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableFamilyPlanOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).familyPlans))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableChildrenOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).children))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableLoveStyleOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).loveStyle))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableCommunicationStyleOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).communicationStyle))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableSexualOrientationOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).sexualOrientation))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableReligionOptions(): string[] {
    return Array.from(new Set(this.users.map(user => this.userFacet(user).religion))).sort((a, b) => a.localeCompare(b));
  }

  protected readonly genderFilterOptions: Array<{ value: DemoUser['gender']; label: string; icon: string }> = [
    { value: 'woman', label: 'Woman', icon: 'female' },
    { value: 'man', label: 'Man', icon: 'male' }
  ];

  protected get availableHoroscopes(): string[] {
    return Array.from(new Set(this.users.map(user => user.horoscope))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableTraitLabels(): string[] {
    return Array.from(new Set(this.users.map(user => user.traitLabel))).sort((a, b) => a.localeCompare(b));
  }

  protected get ratingScale(): number[] {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  protected get isFilterActive(): boolean {
    const baseline = this.createInitialFilter();
    return (
      this.gameFilter.ageMin !== baseline.ageMin ||
      this.gameFilter.ageMax !== baseline.ageMax ||
      this.gameFilter.heightMinCm !== baseline.heightMinCm ||
      this.gameFilter.heightMaxCm !== baseline.heightMaxCm ||
      this.gameFilter.interests.length > 0 ||
      this.gameFilter.values.length > 0 ||
      this.gameFilter.physiques.length > 0 ||
      this.gameFilter.languages.length > 0 ||
      this.gameFilter.genders.length > 0 ||
      this.gameFilter.horoscopes.length > 0 ||
      this.gameFilter.traitLabels.length > 0 ||
      this.gameFilter.smoking.length > 0 ||
      this.gameFilter.drinking.length > 0 ||
      this.gameFilter.workout.length > 0 ||
      this.gameFilter.pets.length > 0 ||
      this.gameFilter.familyPlans.length > 0 ||
      this.gameFilter.children.length > 0 ||
      this.gameFilter.loveStyles.length > 0 ||
      this.gameFilter.communicationStyles.length > 0 ||
      this.gameFilter.sexualOrientations.length > 0 ||
      this.gameFilter.religions.length > 0
    );
  }

  protected get filterDraftMatchCount(): number {
    const normalized = this.normalizeFilter(this.filterDraft);
    return this.users
      .filter(user => user.id !== this.activeUserId)
      .filter(user => this.matchesUserWithFilter(user, normalized))
      .length;
  }

  protected get hasOpenFilterSelector(): boolean {
    return this.filterSelector !== null;
  }

  protected get activeFilterSelectorTitle(): string {
    switch (this.filterSelector) {
      case 'interests':
        return 'Interest';
      case 'values':
        return 'Values';
      case 'physiques':
        return 'Physique';
      case 'languages':
        return 'Languages';
      case 'genders':
        return 'Gender';
      case 'horoscopes':
        return 'Horoscope';
      case 'traitLabels':
        return 'Top Trait';
      case 'smoking':
        return 'Smoking';
      case 'drinking':
        return 'Drinking';
      case 'workout':
        return 'Workout';
      case 'pets':
        return 'Pets';
      case 'familyPlans':
        return 'Family plans';
      case 'children':
        return 'Children';
      case 'loveStyles':
        return 'Love style';
      case 'communicationStyles':
        return 'Communication style';
      case 'sexualOrientations':
        return 'Sexual orientation';
      case 'religions':
        return 'Religion';
      default:
        return 'Filter';
    }
  }

  protected get activeFilterSelectorOptionGroups(): GameFilterOptionGroup[] {
    if (this.filterSelector === 'interests') {
      return this.interestOptionGroups;
    }
    if (this.filterSelector === 'values') {
      return this.valuesOptionGroups;
    }
    return [];
  }

  protected get activeFilterSelectorUsesGroups(): boolean {
    return this.filterSelector === 'interests' || this.filterSelector === 'values';
  }

  protected setRating(value: number): void {
    const currentCandidate = this.isPairMode
      ? (this.pairModeWomanCandidate ?? this.pairModeManCandidate)
      : this.activeCandidate;
    if (!currentCandidate) {
      return;
    }
    this.triggerRatingBarBlink();
    const cycleSize = this.isPairMode ? this.pairModeCycleSize() : this.candidatePool.length;
    if (!this.isPairMode && cycleSize > 1) {
      this.startGameCardLeaveAnimation(currentCandidate, value);
    }
    this.selectedRating = value;
    if (cycleSize > 0) {
      const nextIndex = this.cardIndex + 1;
      this.cardIndex = nextIndex % cycleSize;
    } else {
      this.cardIndex = 0;
    }
    this.resetCandidateImageState();
    this.beginCandidateImageLoadingForCurrentSelection();
  }

  protected togglePairMode(): void {
    this.isPairMode = !this.isPairMode;
    this.resetCandidateImageState();
    this.beginCandidateImageLoadingForCurrentSelection();
  }

  protected openHistory(): void {
    if (typeof globalThis.dispatchEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('myscoutee-open-rates'));
    }
  }

  protected closeLocalPopup(): void {
    this.localPopup = null;
    this.filterSelector = null;
  }

  protected openFilter(): void {
    this.filterDraft = this.cloneFilter(this.gameFilter);
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
    this.filterSelector = null;
    this.localPopup = 'filter';
  }

  protected applyFilter(): void {
    this.gameFilter = this.normalizeFilter(this.filterDraft);
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.beginCandidateImageLoadingForCurrentSelection();
    this.filterSelector = null;
    this.localPopup = null;
  }

  protected resetFilterDraft(): void {
    this.filterDraft = this.createInitialFilter();
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
    this.filterSelector = null;
  }

  protected openFilterSelector(kind: FilterSelectorKind): void {
    this.filterSelector = kind;
    if (kind === 'languages') {
      this.filterLanguageInput = '';
      this.refreshFilterLanguageSuggestionPool();
    }
  }

  protected closeFilterSelector(): void {
    this.filterSelector = null;
  }

  protected clearActiveFilterSelector(): void {
    switch (this.filterSelector) {
      case 'interests':
        this.filterDraft.interests = [];
        return;
      case 'values':
        this.filterDraft.values = [];
        return;
      case 'physiques':
        this.filterDraft.physiques = [];
        return;
      case 'languages':
        this.filterDraft.languages = [];
        this.refreshFilterLanguageSuggestionPool();
        return;
      case 'genders':
        this.filterDraft.genders = [];
        return;
      case 'horoscopes':
        this.filterDraft.horoscopes = [];
        return;
      case 'traitLabels':
        this.filterDraft.traitLabels = [];
        return;
      case 'smoking':
        this.filterDraft.smoking = [];
        return;
      case 'drinking':
        this.filterDraft.drinking = [];
        return;
      case 'workout':
        this.filterDraft.workout = [];
        return;
      case 'pets':
        this.filterDraft.pets = [];
        return;
      case 'familyPlans':
        this.filterDraft.familyPlans = [];
        return;
      case 'children':
        this.filterDraft.children = [];
        return;
      case 'loveStyles':
        this.filterDraft.loveStyles = [];
        return;
      case 'communicationStyles':
        this.filterDraft.communicationStyles = [];
        return;
      case 'sexualOrientations':
        this.filterDraft.sexualOrientations = [];
        return;
      case 'religions':
        this.filterDraft.religions = [];
        return;
      default:
        return;
    }
  }

  protected activeFilterSelectorHasSelection(): boolean {
    if (!this.filterSelector) {
      return false;
    }
    return this.filterSelectorSelectionCount(this.filterSelector) > 0;
  }

  protected filterSelectorHasSelection(kind: FilterSelectorKind): boolean {
    return this.filterSelectorSelectionCount(kind) > 0;
  }

  protected filterSelectorPreview(kind: FilterSelectorKind): string[] {
    return this.filterSelectorLabels(kind).slice(0, 2);
  }

  protected filterSelectorExtraCount(kind: FilterSelectorKind): number {
    return Math.max(0, this.filterSelectorLabels(kind).length - 2);
  }

  protected filterSelectorToneClass(kind: FilterSelectorKind): string {
    switch (kind) {
      case 'interests':
        return 'game-filter-selector-tone-interest';
      case 'values':
        return 'game-filter-selector-tone-values';
      case 'physiques':
        return 'game-filter-selector-tone-physique';
      case 'languages':
        return 'game-filter-selector-tone-languages';
      case 'genders':
        return 'game-filter-selector-tone-gender';
      case 'horoscopes':
        return 'game-filter-selector-tone-horoscope';
      case 'traitLabels':
        return 'game-filter-selector-tone-traits';
      case 'smoking':
        return 'game-filter-selector-tone-smoking';
      case 'drinking':
        return 'game-filter-selector-tone-drinking';
      case 'workout':
        return 'game-filter-selector-tone-workout';
      case 'pets':
        return 'game-filter-selector-tone-pets';
      case 'familyPlans':
        return 'game-filter-selector-tone-family';
      case 'children':
        return 'game-filter-selector-tone-children';
      case 'loveStyles':
        return 'game-filter-selector-tone-love';
      case 'communicationStyles':
        return 'game-filter-selector-tone-communication';
      case 'sexualOrientations':
        return 'game-filter-selector-tone-orientation';
      case 'religions':
        return 'game-filter-selector-tone-religion';
      default:
        return 'game-filter-selector-tone-neutral';
    }
  }

  protected toggleFilterPhysique(physique: string): void {
    this.filterDraft.physiques = this.toggleArraySelection(this.filterDraft.physiques, physique);
  }

  protected toggleFilterInterest(interest: string): void {
    this.filterDraft.interests = this.toggleArraySelection(this.filterDraft.interests, interest);
  }

  protected toggleFilterValue(value: string): void {
    this.filterDraft.values = this.toggleArraySelection(this.filterDraft.values, value);
  }

  protected toggleFilterLanguage(language: string): void {
    const normalized = language.trim();
    if (!normalized) {
      return;
    }
    const exists = this.filterDraft.languages.some(item => item.toLowerCase() === normalized.toLowerCase());
    this.filterDraft.languages = exists
      ? this.filterDraft.languages.filter(item => item.toLowerCase() !== normalized.toLowerCase())
      : [...this.filterDraft.languages, normalized];
    this.refreshFilterLanguageSuggestionPool();
  }

  protected submitFilterLanguageInput(event?: Event): void {
    event?.stopPropagation();
    const normalized = this.filterLanguageInput.trim();
    if (!normalized) {
      return;
    }
    const exists = this.filterDraft.languages.some(item => item.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      this.filterDraft.languages = [...this.filterDraft.languages, normalized];
    }
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
  }

  protected onFilterLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.submitFilterLanguageInput();
  }

  protected onFilterLanguageInputBlur(): void {
    this.submitFilterLanguageInput();
  }

  protected selectFilterLanguage(value: string): void {
    this.toggleFilterLanguage(value);
    this.filterLanguageInput = '';
  }

  protected filterLanguageToneClass(value: string): string {
    return `game-filter-language-tone-${this.filterLanguageToneIndex(value)}`;
  }

  protected get availableFilterLanguageSuggestions(): string[] {
    const selected = new Set(this.filterDraft.languages.map(item => item.trim().toLowerCase()));
    const query = this.filterLanguageInput.trim().toLowerCase();
    return this.filterLanguageSuggestionPool
      .filter(item => !selected.has(item.toLowerCase()))
      .filter(item => query.length === 0 || item.toLowerCase().includes(query));
  }

  protected get availableFilterLanguageDisplaySuggestions(): string[] {
    return this.availableFilterLanguageSuggestions.slice(0, 24);
  }

  protected toggleFilterGender(gender: DemoUser['gender']): void {
    this.filterDraft.genders = this.toggleArraySelection(this.filterDraft.genders, gender);
  }

  protected toggleFilterHoroscope(horoscope: string): void {
    this.filterDraft.horoscopes = this.toggleArraySelection(this.filterDraft.horoscopes, horoscope);
  }

  protected toggleFilterTraitLabel(traitLabel: string): void {
    this.filterDraft.traitLabels = this.toggleArraySelection(this.filterDraft.traitLabels, traitLabel);
  }

  protected toggleFilterSmoking(option: string): void {
    this.filterDraft.smoking = this.toggleArraySelection(this.filterDraft.smoking, option);
  }

  protected toggleFilterDrinking(option: string): void {
    this.filterDraft.drinking = this.toggleArraySelection(this.filterDraft.drinking, option);
  }

  protected toggleFilterWorkout(option: string): void {
    this.filterDraft.workout = this.toggleArraySelection(this.filterDraft.workout, option);
  }

  protected toggleFilterPets(option: string): void {
    this.filterDraft.pets = this.toggleArraySelection(this.filterDraft.pets, option);
  }

  protected toggleFilterFamilyPlans(option: string): void {
    this.filterDraft.familyPlans = this.toggleArraySelection(this.filterDraft.familyPlans, option);
  }

  protected toggleFilterChildren(option: string): void {
    this.filterDraft.children = this.toggleArraySelection(this.filterDraft.children, option);
  }

  protected toggleFilterLoveStyles(option: string): void {
    this.filterDraft.loveStyles = this.toggleArraySelection(this.filterDraft.loveStyles, option);
  }

  protected toggleFilterCommunicationStyles(option: string): void {
    this.filterDraft.communicationStyles = this.toggleArraySelection(this.filterDraft.communicationStyles, option);
  }

  protected toggleFilterSexualOrientations(option: string): void {
    this.filterDraft.sexualOrientations = this.toggleArraySelection(this.filterDraft.sexualOrientations, option);
  }

  protected toggleFilterReligions(option: string): void {
    this.filterDraft.religions = this.toggleArraySelection(this.filterDraft.religions, option);
  }

  protected isPhysiqueSelected(physique: string): boolean {
    return this.filterDraft.physiques.includes(physique);
  }

  protected isInterestSelected(interest: string): boolean {
    return this.filterDraft.interests.includes(interest);
  }

  protected isValueSelected(value: string): boolean {
    return this.filterDraft.values.includes(value);
  }

  protected isLanguageSelected(language: string): boolean {
    return this.filterDraft.languages.includes(language);
  }

  protected isGenderSelected(gender: DemoUser['gender']): boolean {
    return this.filterDraft.genders.includes(gender);
  }

  protected isHoroscopeSelected(horoscope: string): boolean {
    return this.filterDraft.horoscopes.includes(horoscope);
  }

  protected isTraitLabelSelected(traitLabel: string): boolean {
    return this.filterDraft.traitLabels.includes(traitLabel);
  }

  protected isSmokingSelected(option: string): boolean {
    return this.filterDraft.smoking.includes(option);
  }

  protected isDrinkingSelected(option: string): boolean {
    return this.filterDraft.drinking.includes(option);
  }

  protected isWorkoutSelected(option: string): boolean {
    return this.filterDraft.workout.includes(option);
  }

  protected isPetsSelected(option: string): boolean {
    return this.filterDraft.pets.includes(option);
  }

  protected isFamilyPlansSelected(option: string): boolean {
    return this.filterDraft.familyPlans.includes(option);
  }

  protected isChildrenSelected(option: string): boolean {
    return this.filterDraft.children.includes(option);
  }

  protected isLoveStylesSelected(option: string): boolean {
    return this.filterDraft.loveStyles.includes(option);
  }

  protected isCommunicationStylesSelected(option: string): boolean {
    return this.filterDraft.communicationStyles.includes(option);
  }

  protected isSexualOrientationsSelected(option: string): boolean {
    return this.filterDraft.sexualOrientations.includes(option);
  }

  protected isReligionsSelected(option: string): boolean {
    return this.filterDraft.religions.includes(option);
  }

  protected get activeFilterSelectorOptions(): Array<{ value: string; label: string; icon?: string }> {
    switch (this.filterSelector) {
      case 'interests':
        return this.availableInterests.map(option => ({ value: option, label: option }));
      case 'values':
        return this.availableValues.map(option => ({ value: option, label: option }));
      case 'smoking':
        return this.availableSmokingOptions.map(option => ({ value: option, label: option }));
      case 'drinking':
        return this.availableDrinkingOptions.map(option => ({ value: option, label: option }));
      case 'workout':
        return this.availableWorkoutOptions.map(option => ({ value: option, label: option }));
      case 'pets':
        return this.availablePetsOptions.map(option => ({ value: option, label: option }));
      case 'familyPlans':
        return this.availableFamilyPlanOptions.map(option => ({ value: option, label: option }));
      case 'children':
        return this.availableChildrenOptions.map(option => ({ value: option, label: option }));
      case 'loveStyles':
        return this.availableLoveStyleOptions.map(option => ({ value: option, label: option }));
      case 'communicationStyles':
        return this.availableCommunicationStyleOptions.map(option => ({ value: option, label: option }));
      case 'sexualOrientations':
        return this.availableSexualOrientationOptions.map(option => ({ value: option, label: option }));
      case 'religions':
        return this.availableReligionOptions.map(option => ({ value: option, label: option }));
      case 'physiques':
        return this.availablePhysiques.map(option => ({ value: option, label: option }));
      case 'languages':
        return this.availableLanguages.map(option => ({ value: option, label: option }));
      case 'genders':
        return this.genderFilterOptions.map(option => ({ value: option.value, label: option.label, icon: option.icon }));
      case 'horoscopes':
        return this.availableHoroscopes.map(option => ({ value: option, label: option }));
      case 'traitLabels':
        return this.availableTraitLabels.map(option => ({ value: option, label: option }));
      default:
        return [];
    }
  }

  protected toggleActiveFilterSelectorOption(value: string): void {
    switch (this.filterSelector) {
      case 'interests':
        this.toggleFilterInterest(value);
        return;
      case 'values':
        this.toggleFilterValue(value);
        return;
      case 'smoking':
        this.toggleFilterSmoking(value);
        return;
      case 'drinking':
        this.toggleFilterDrinking(value);
        return;
      case 'workout':
        this.toggleFilterWorkout(value);
        return;
      case 'pets':
        this.toggleFilterPets(value);
        return;
      case 'familyPlans':
        this.toggleFilterFamilyPlans(value);
        return;
      case 'children':
        this.toggleFilterChildren(value);
        return;
      case 'loveStyles':
        this.toggleFilterLoveStyles(value);
        return;
      case 'communicationStyles':
        this.toggleFilterCommunicationStyles(value);
        return;
      case 'sexualOrientations':
        this.toggleFilterSexualOrientations(value);
        return;
      case 'religions':
        this.toggleFilterReligions(value);
        return;
      case 'physiques':
        this.toggleFilterPhysique(value);
        return;
      case 'languages':
        this.toggleFilterLanguage(value);
        return;
      case 'genders':
        if (value === 'woman' || value === 'man') {
          this.toggleFilterGender(value);
        }
        return;
      case 'horoscopes':
        this.toggleFilterHoroscope(value);
        return;
      case 'traitLabels':
        this.toggleFilterTraitLabel(value);
        return;
      default:
        return;
    }
  }

  protected isActiveFilterSelectorOptionSelected(value: string): boolean {
    switch (this.filterSelector) {
      case 'interests':
        return this.isInterestSelected(value);
      case 'values':
        return this.isValueSelected(value);
      case 'smoking':
        return this.isSmokingSelected(value);
      case 'drinking':
        return this.isDrinkingSelected(value);
      case 'workout':
        return this.isWorkoutSelected(value);
      case 'pets':
        return this.isPetsSelected(value);
      case 'familyPlans':
        return this.isFamilyPlansSelected(value);
      case 'children':
        return this.isChildrenSelected(value);
      case 'loveStyles':
        return this.isLoveStylesSelected(value);
      case 'communicationStyles':
        return this.isCommunicationStylesSelected(value);
      case 'sexualOrientations':
        return this.isSexualOrientationsSelected(value);
      case 'religions':
        return this.isReligionsSelected(value);
      case 'physiques':
        return this.isPhysiqueSelected(value);
      case 'languages':
        return this.isLanguageSelected(value);
      case 'genders':
        return value === 'woman' || value === 'man' ? this.isGenderSelected(value) : false;
      case 'horoscopes':
        return this.isHoroscopeSelected(value);
      case 'traitLabels':
        return this.isTraitLabelSelected(value);
      default:
        return false;
    }
  }

  protected filterSelectorSelectedValues(kind: FilterSelectorKind): string[] {
    switch (kind) {
      case 'interests':
        return [...this.filterDraft.interests];
      case 'values':
        return [...this.filterDraft.values];
      case 'smoking':
        return [...this.filterDraft.smoking];
      case 'drinking':
        return [...this.filterDraft.drinking];
      case 'workout':
        return [...this.filterDraft.workout];
      case 'pets':
        return [...this.filterDraft.pets];
      case 'familyPlans':
        return [...this.filterDraft.familyPlans];
      case 'children':
        return [...this.filterDraft.children];
      case 'loveStyles':
        return [...this.filterDraft.loveStyles];
      case 'communicationStyles':
        return [...this.filterDraft.communicationStyles];
      case 'sexualOrientations':
        return [...this.filterDraft.sexualOrientations];
      case 'religions':
        return [...this.filterDraft.religions];
      case 'physiques':
        return [...this.filterDraft.physiques];
      case 'languages':
        return [...this.filterDraft.languages];
      case 'genders':
        return [...this.filterDraft.genders];
      case 'horoscopes':
        return [...this.filterDraft.horoscopes];
      case 'traitLabels':
        return [...this.filterDraft.traitLabels];
      default:
        return [];
    }
  }

  protected filterSelectorValueLabel(kind: FilterSelectorKind, value: string): string {
    if (kind !== 'genders') {
      return value;
    }
    return this.genderFilterOptions.find(option => option.value === value)?.label ?? value;
  }

  protected removeFilterSelectorValue(kind: FilterSelectorKind, value: string, event?: Event): void {
    event?.stopPropagation();
    switch (kind) {
      case 'interests':
        this.filterDraft.interests = this.filterDraft.interests.filter(item => item !== value);
        return;
      case 'values':
        this.filterDraft.values = this.filterDraft.values.filter(item => item !== value);
        return;
      case 'smoking':
        this.filterDraft.smoking = this.filterDraft.smoking.filter(item => item !== value);
        return;
      case 'drinking':
        this.filterDraft.drinking = this.filterDraft.drinking.filter(item => item !== value);
        return;
      case 'workout':
        this.filterDraft.workout = this.filterDraft.workout.filter(item => item !== value);
        return;
      case 'pets':
        this.filterDraft.pets = this.filterDraft.pets.filter(item => item !== value);
        return;
      case 'familyPlans':
        this.filterDraft.familyPlans = this.filterDraft.familyPlans.filter(item => item !== value);
        return;
      case 'children':
        this.filterDraft.children = this.filterDraft.children.filter(item => item !== value);
        return;
      case 'loveStyles':
        this.filterDraft.loveStyles = this.filterDraft.loveStyles.filter(item => item !== value);
        return;
      case 'communicationStyles':
        this.filterDraft.communicationStyles = this.filterDraft.communicationStyles.filter(item => item !== value);
        return;
      case 'sexualOrientations':
        this.filterDraft.sexualOrientations = this.filterDraft.sexualOrientations.filter(item => item !== value);
        return;
      case 'religions':
        this.filterDraft.religions = this.filterDraft.religions.filter(item => item !== value);
        return;
      case 'physiques':
        this.filterDraft.physiques = this.filterDraft.physiques.filter(item => item !== value);
        return;
      case 'languages':
        this.filterDraft.languages = this.filterDraft.languages.filter(item => item.toLowerCase() !== value.toLowerCase());
        this.refreshFilterLanguageSuggestionPool();
        return;
      case 'genders':
        if (value === 'woman' || value === 'man') {
          this.filterDraft.genders = this.filterDraft.genders.filter(item => item !== value);
        }
        return;
      case 'horoscopes':
        this.filterDraft.horoscopes = this.filterDraft.horoscopes.filter(item => item !== value);
        return;
      case 'traitLabels':
        this.filterDraft.traitLabels = this.filterDraft.traitLabels.filter(item => item !== value);
        return;
      default:
        return;
    }
  }

  protected onAgeMinChange(value: number): void {
    this.filterDraft.ageMin = Number(value);
    if (this.filterDraft.ageMin > this.filterDraft.ageMax) {
      this.filterDraft.ageMax = this.filterDraft.ageMin;
    }
  }

  protected onAgeMaxChange(value: number): void {
    this.filterDraft.ageMax = Number(value);
    if (this.filterDraft.ageMax < this.filterDraft.ageMin) {
      this.filterDraft.ageMin = this.filterDraft.ageMax;
    }
  }

  protected onHeightMinChange(value: number): void {
    this.filterDraft.heightMinCm = Number(value);
    if (this.filterDraft.heightMinCm > this.filterDraft.heightMaxCm) {
      this.filterDraft.heightMaxCm = this.filterDraft.heightMinCm;
    }
  }

  protected onHeightMaxChange(value: number): void {
    this.filterDraft.heightMaxCm = Number(value);
    if (this.filterDraft.heightMaxCm < this.filterDraft.heightMinCm) {
      this.filterDraft.heightMinCm = this.filterDraft.heightMaxCm;
    }
  }

  protected gameCardOverlay(candidate: DemoUser, imageIndex: number): { primary: string; secondary: string } | null {
    const safeImageIndex = Math.max(0, imageIndex);
    const cards = this.gameCardOverlayCards(candidate);
    if (safeImageIndex >= cards.length) {
      return null;
    }
    return cards[safeImageIndex] ?? null;
  }

  private gameCardOverlayCards(candidate: DemoUser): Array<{ primary: string; secondary: string }> {
    const cards: Array<{ primary: string; secondary: string }> = [];
    const seen = new Set<string>();
    const usedLabels = new Set<string>();
    const pushPair = (primaryLabel: string, secondaryLabel: string): void => {
      const normalizedPrimaryLabel = this.normalizeOverlayLabel(primaryLabel);
      const normalizedSecondaryLabel = this.normalizeOverlayLabel(secondaryLabel);
      if (usedLabels.has(normalizedPrimaryLabel) || usedLabels.has(normalizedSecondaryLabel)) {
        return;
      }
      const primaryValue = this.publicOverlayDetailValue(candidate, primaryLabel);
      const secondaryValue = this.publicOverlayDetailValue(candidate, secondaryLabel);
      if (!primaryValue || !secondaryValue) {
        return;
      }
      const primary = `${primaryLabel} · ${primaryValue}`;
      const secondary = `${secondaryLabel} · ${secondaryValue}`;
      const key = `${primary}::${secondary}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      usedLabels.add(normalizedPrimaryLabel);
      usedLabels.add(normalizedSecondaryLabel);
      cards.push({ primary, secondary });
    };

    // Match the Activities rate-card pattern: fixed first pair, then prioritized detail pairs.
    pushPair('Name', 'City');
    pushPair('Languages', 'Horoscope');
    pushPair('Workout', 'Pets');
    pushPair('Gender', 'City');
    pushPair('Height', 'Physique');
    pushPair('Drinking', 'Smoking');
    pushPair('Interest', 'Values');
    pushPair('Communication style', 'Love style');
    pushPair('Family plans', 'Children');
    pushPair('Religion', 'Sexual orientation');

    return cards;
  }

  private publicOverlayDetailValue(candidate: DemoUser, label: string): string {
    const normalizedLabel = this.normalizeOverlayLabel(label);
    if (!PUBLIC_PROFILE_DETAIL_LABELS.has(normalizedLabel)) {
      return '';
    }
    const facet = this.userFacet(candidate);
    switch (normalizedLabel) {
      case 'name':
        return candidate.name;
      case 'city':
        return candidate.city;
      case 'languages':
        return this.compactList(candidate.languages, 2);
      case 'horoscope':
        return candidate.horoscope;
      case 'gender':
        return candidate.gender === 'woman' ? 'Woman' : 'Man';
      case 'workout':
        return facet.workout;
      case 'pets':
        return facet.pets;
      case 'height':
        return candidate.height;
      case 'physique':
        return candidate.physique;
      case 'drinking':
        return facet.drinking;
      case 'smoking':
        return facet.smoking;
      case 'interest':
        return this.compactList(this.userInterests(candidate), 2);
      case 'values':
        return this.compactList(this.userValues(candidate), 2);
      case 'communication style':
        return facet.communicationStyle;
      case 'love style':
        return facet.loveStyle;
      case 'family plans':
        return facet.familyPlans;
      case 'children':
        return facet.children;
      case 'religion':
        return facet.religion;
      case 'sexual orientation':
        return facet.sexualOrientation;
      default:
        return '';
    }
  }

  private normalizeOverlayLabel(value: string): string {
    return value.trim().toLowerCase();
  }

  private compactList(values: string[], maxItems: number): string {
    if (values.length === 0) {
      return '';
    }
    const selected = values.slice(0, Math.max(1, maxItems));
    if (values.length <= selected.length) {
      return selected.join(', ');
    }
    return `${selected.join(', ')} +${values.length - selected.length}`;
  }

  protected get candidateImageStack(): string[] {
    return this.activeCandidate ? this.imageStackForCandidate(this.activeCandidate) : [];
  }

  protected get candidateImage(): string | null {
    if (this.candidateImageStack.length === 0) {
      return null;
    }
    const safeIndex = Math.min(this.selectedCandidateImageIndex, this.candidateImageStack.length - 1);
    const imageUrl = this.candidateImageStack[safeIndex] ?? null;
    if (!imageUrl || this.failedCandidateImageUrls.has(imageUrl)) {
      return null;
    }
    return imageUrl;
  }

  protected gameCardIndicatorIndexes(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index);
  }

  protected onCandidateImageAssetReady(imageUrl: string): void {
    if (!imageUrl || imageUrl !== this.candidateImage) {
      return;
    }
    const hadPendingLoad = this.isCandidateImageLoading;
    this.isCandidateImageLoading = false;
    if (hadPendingLoad) {
      this.triggerCandidateImageIndicatorReveal();
    }
  }

  protected onCandidateImageAssetError(imageUrl: string): void {
    this.onCandidateImageAssetReady(imageUrl);
    if (!imageUrl) {
      return;
    }
    this.failedCandidateImageUrls.add(imageUrl);
    const nextAvailableImageIndex = this.candidateImageStack.findIndex(url => !this.failedCandidateImageUrls.has(url));
    if (nextAvailableImageIndex >= 0 && nextAvailableImageIndex !== this.selectedCandidateImageIndex) {
      this.selectCandidateImage(nextAvailableImageIndex);
      return;
    }
    this.cdr.markForCheck();
  }

  protected selectCandidateImage(index: number): void {
    if (index < 0 || index >= this.candidateImageStack.length) {
      return;
    }
    if (index === this.selectedCandidateImageIndex) {
      return;
    }
    this.selectedCandidateImageIndex = index;
    this.candidateImageZoom = 1;
    this.candidateImagePanX = 0;
    this.candidateImagePanY = 0;
    this.isCandidateImageDragging = false;
    this.beginCandidateImageLoadingForCurrentSelection();
  }

  protected onCandidateImageWheel(event: WheelEvent): void {
    if (!this.candidateImage) {
      return;
    }
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? 0.12 : -0.12;
    this.candidateImageZoom = this.clamp(this.candidateImageZoom + zoomDelta, 1, 3.5);
    this.clampCandidateImagePan();
  }

  protected onCandidateImageMouseDown(event: MouseEvent): void {
    if (this.candidateImageZoom <= 1) {
      return;
    }
    this.isCandidateImageDragging = true;
    this.candidateDragOffsetX = event.clientX - this.candidateImagePanX;
    this.candidateDragOffsetY = event.clientY - this.candidateImagePanY;
  }

  protected onCandidateImageMouseMove(event: MouseEvent): void {
    if (!this.isCandidateImageDragging) {
      return;
    }
    this.candidateImagePanX = event.clientX - this.candidateDragOffsetX;
    this.candidateImagePanY = event.clientY - this.candidateDragOffsetY;
    this.clampCandidateImagePan();
  }

  protected onCandidateImageMouseUp(): void {
    this.isCandidateImageDragging = false;
  }

  protected onCandidateImageTouchStart(event: TouchEvent): void {
    if (this.candidateImageZoom <= 1 || event.touches.length === 0) {
      return;
    }
    const touch = event.touches[0];
    this.activeTouchId = touch.identifier;
    this.isCandidateImageDragging = true;
    this.candidateDragOffsetX = touch.clientX - this.candidateImagePanX;
    this.candidateDragOffsetY = touch.clientY - this.candidateImagePanY;
  }

  protected onCandidateImageTouchMove(event: TouchEvent): void {
    if (!this.isCandidateImageDragging || this.activeTouchId === null) {
      return;
    }
    const touch = Array.from(event.touches).find(item => item.identifier === this.activeTouchId);
    if (!touch) {
      return;
    }
    event.preventDefault();
    this.candidateImagePanX = touch.clientX - this.candidateDragOffsetX;
    this.candidateImagePanY = touch.clientY - this.candidateDragOffsetY;
    this.clampCandidateImagePan();
  }

  protected onCandidateImageTouchEnd(): void {
    this.isCandidateImageDragging = false;
    this.activeTouchId = null;
  }

  protected get candidateInitials(): string {
    return this.activeCandidate ? this.initialsForCandidate(this.activeCandidate) : 'NO';
  }

  protected pairModeCandidateImage(candidate: DemoUser | null): string | null {
    if (!candidate) {
      return null;
    }
    return this.imageStackForCandidate(candidate)[0] ?? null;
  }

  protected pairModeCandidateInitials(candidate: DemoUser | null): string {
    return candidate ? this.initialsForCandidate(candidate) : '∅';
  }

  @HostListener('window:active-user-changed')
  onActiveUserChanged(): void {
    this.activeUserId = this.getActiveUserId();
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.beginCandidateImageLoadingForCurrentSelection();
  }

  private getActiveUserId(): string {
    const stored = localStorage.getItem('demo-active-user');
    if (!stored) {
      return this.users[0].id;
    }
    return this.users.some(user => user.id === stored) ? stored : this.users[0].id;
  }

  private clampCandidateImagePan(): void {
    const bound = (this.candidateImageZoom - 1) * 140;
    this.candidateImagePanX = this.clamp(this.candidateImagePanX, -bound, bound);
    this.candidateImagePanY = this.clamp(this.candidateImagePanY, -bound, bound);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private resetCandidateImageState(): void {
    this.selectedCandidateImageIndex = 0;
    this.candidateImageZoom = 1;
    this.candidateImagePanX = 0;
    this.candidateImagePanY = 0;
    this.isCandidateImageDragging = false;
    this.activeTouchId = null;
    this.failedCandidateImageUrls.clear();
  }

  private createInitialFilter(): GameFilterForm {
    const minAge = this.minAgeBound;
    const maxAge = this.maxAgeBound;
    const minHeight = this.minHeightBoundCm;
    const maxHeight = this.maxHeightBoundCm;
    const activeHeight = this.parseHeightCm(this.activeUser.height);
    const preferredMin = Math.max(minAge, this.activeUser.age - 5);
    const preferredMax = Math.min(maxAge, this.activeUser.age + 5);
    return {
      ageMin: preferredMin,
      ageMax: preferredMax,
      heightMinCm: Math.max(minHeight, (activeHeight ?? minHeight) - 10),
      heightMaxCm: Math.min(maxHeight, (activeHeight ?? maxHeight) + 10),
      interests: [],
      values: [],
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: [],
      smoking: [],
      drinking: [],
      workout: [],
      pets: [],
      familyPlans: [],
      children: [],
      loveStyles: [],
      communicationStyles: [],
      sexualOrientations: [],
      religions: []
    };
  }

  private cloneFilter(filter: GameFilterForm): GameFilterForm {
    return {
      ageMin: filter.ageMin,
      ageMax: filter.ageMax,
      heightMinCm: filter.heightMinCm,
      heightMaxCm: filter.heightMaxCm,
      interests: [...filter.interests],
      values: [...filter.values],
      physiques: [...filter.physiques],
      languages: [...filter.languages],
      genders: [...filter.genders],
      horoscopes: [...filter.horoscopes],
      traitLabels: [...filter.traitLabels],
      smoking: [...filter.smoking],
      drinking: [...filter.drinking],
      workout: [...filter.workout],
      pets: [...filter.pets],
      familyPlans: [...filter.familyPlans],
      children: [...filter.children],
      loveStyles: [...filter.loveStyles],
      communicationStyles: [...filter.communicationStyles],
      sexualOrientations: [...filter.sexualOrientations],
      religions: [...filter.religions]
    };
  }

  private normalizeFilter(filter: GameFilterForm): GameFilterForm {
    const minAge = Math.max(this.minAgeBound, Math.min(filter.ageMin, filter.ageMax));
    const maxAge = Math.min(this.maxAgeBound, Math.max(filter.ageMin, filter.ageMax));
    const minHeight = Math.max(this.minHeightBoundCm, Math.min(filter.heightMinCm, filter.heightMaxCm));
    const maxHeight = Math.min(this.maxHeightBoundCm, Math.max(filter.heightMinCm, filter.heightMaxCm));
    return {
      ageMin: minAge,
      ageMax: maxAge,
      heightMinCm: minHeight,
      heightMaxCm: maxHeight,
      interests: [...filter.interests],
      values: [...filter.values],
      physiques: [...filter.physiques],
      languages: [...filter.languages],
      genders: [...filter.genders],
      horoscopes: [...filter.horoscopes],
      traitLabels: [...filter.traitLabels],
      smoking: [...filter.smoking],
      drinking: [...filter.drinking],
      workout: [...filter.workout],
      pets: [...filter.pets],
      familyPlans: [...filter.familyPlans],
      children: [...filter.children],
      loveStyles: [...filter.loveStyles],
      communicationStyles: [...filter.communicationStyles],
      sexualOrientations: [...filter.sexualOrientations],
      religions: [...filter.religions]
    };
  }

  private toggleArraySelection<T extends string>(values: T[], target: T): T[] {
    const hasTarget = values.includes(target);
    return hasTarget ? values.filter(item => item !== target) : [...values, target];
  }

  private filterLanguageToneIndex(value: string): number {
    const normalized = this.normalizeLanguageText(value);
    if (!normalized) {
      return 1;
    }
    let hash = 0;
    for (const char of normalized) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return (hash % 8) + 1;
  }

  private normalizeLanguageText(value: string): string {
    return value.trim().toLowerCase();
  }

  private refreshFilterLanguageSuggestionPool(): void {
    const pool = new Map<string, string>();
    for (const item of this.availableLanguages) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    for (const item of this.filterLanguageSuggestionPool) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    for (const item of this.filterDraft.languages) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    this.filterLanguageSuggestionPool = Array.from(pool.values()).sort((a, b) => a.localeCompare(b));
  }

  private matchesFilter(user: DemoUser): boolean {
    return this.matchesUserWithFilter(user, this.gameFilter);
  }

  private matchesUserWithFilter(user: DemoUser, filter: GameFilterForm): boolean {
    if (user.age < filter.ageMin || user.age > filter.ageMax) {
      return false;
    }
    const userHeight = this.parseHeightCm(user.height);
    if (userHeight !== null && (userHeight < filter.heightMinCm || userHeight > filter.heightMaxCm)) {
      return false;
    }
    if (filter.interests.length > 0) {
      const hasInterestMatch = this.userInterests(user).some(interest => filter.interests.includes(interest));
      if (!hasInterestMatch) {
        return false;
      }
    }
    if (filter.values.length > 0) {
      const hasValuesMatch = this.userValues(user).some(value => filter.values.includes(value));
      if (!hasValuesMatch) {
        return false;
      }
    }
    const facet = this.userFacet(user);
    if (filter.smoking.length > 0 && !filter.smoking.includes(facet.smoking)) {
      return false;
    }
    if (filter.drinking.length > 0 && !filter.drinking.includes(facet.drinking)) {
      return false;
    }
    if (filter.workout.length > 0 && !filter.workout.includes(facet.workout)) {
      return false;
    }
    if (filter.pets.length > 0 && !filter.pets.includes(facet.pets)) {
      return false;
    }
    if (filter.familyPlans.length > 0 && !filter.familyPlans.includes(facet.familyPlans)) {
      return false;
    }
    if (filter.children.length > 0 && !filter.children.includes(facet.children)) {
      return false;
    }
    if (filter.loveStyles.length > 0 && !filter.loveStyles.includes(facet.loveStyle)) {
      return false;
    }
    if (filter.communicationStyles.length > 0 && !filter.communicationStyles.includes(facet.communicationStyle)) {
      return false;
    }
    if (filter.sexualOrientations.length > 0 && !filter.sexualOrientations.includes(facet.sexualOrientation)) {
      return false;
    }
    if (filter.religions.length > 0 && !filter.religions.includes(facet.religion)) {
      return false;
    }
    if (filter.physiques.length > 0 && !filter.physiques.includes(user.physique)) {
      return false;
    }
    if (filter.languages.length > 0) {
      const hasLanguageMatch = user.languages.some(language => filter.languages.includes(language));
      if (!hasLanguageMatch) {
        return false;
      }
    }
    if (filter.genders.length > 0 && !filter.genders.includes(user.gender)) {
      return false;
    }
    if (filter.horoscopes.length > 0 && !filter.horoscopes.includes(user.horoscope)) {
      return false;
    }
    if (filter.traitLabels.length > 0 && !filter.traitLabels.includes(user.traitLabel)) {
      return false;
    }
    return true;
  }

  private filterSelectorSelectionCount(kind: FilterSelectorKind): number {
    switch (kind) {
      case 'interests':
        return this.filterDraft.interests.length;
      case 'values':
        return this.filterDraft.values.length;
      case 'smoking':
        return this.filterDraft.smoking.length;
      case 'drinking':
        return this.filterDraft.drinking.length;
      case 'workout':
        return this.filterDraft.workout.length;
      case 'pets':
        return this.filterDraft.pets.length;
      case 'familyPlans':
        return this.filterDraft.familyPlans.length;
      case 'children':
        return this.filterDraft.children.length;
      case 'loveStyles':
        return this.filterDraft.loveStyles.length;
      case 'communicationStyles':
        return this.filterDraft.communicationStyles.length;
      case 'sexualOrientations':
        return this.filterDraft.sexualOrientations.length;
      case 'religions':
        return this.filterDraft.religions.length;
      case 'physiques':
        return this.filterDraft.physiques.length;
      case 'languages':
        return this.filterDraft.languages.length;
      case 'genders':
        return this.filterDraft.genders.length;
      case 'horoscopes':
        return this.filterDraft.horoscopes.length;
      case 'traitLabels':
        return this.filterDraft.traitLabels.length;
      default:
        return 0;
    }
  }

  private filterSelectorLabels(kind: FilterSelectorKind): string[] {
    switch (kind) {
      case 'interests':
        return [...this.filterDraft.interests];
      case 'values':
        return [...this.filterDraft.values];
      case 'smoking':
        return [...this.filterDraft.smoking];
      case 'drinking':
        return [...this.filterDraft.drinking];
      case 'workout':
        return [...this.filterDraft.workout];
      case 'pets':
        return [...this.filterDraft.pets];
      case 'familyPlans':
        return [...this.filterDraft.familyPlans];
      case 'children':
        return [...this.filterDraft.children];
      case 'loveStyles':
        return [...this.filterDraft.loveStyles];
      case 'communicationStyles':
        return [...this.filterDraft.communicationStyles];
      case 'sexualOrientations':
        return [...this.filterDraft.sexualOrientations];
      case 'religions':
        return [...this.filterDraft.religions];
      case 'physiques':
        return [...this.filterDraft.physiques];
      case 'languages':
        return [...this.filterDraft.languages];
      case 'genders':
        return this.filterDraft.genders.map(value => this.genderFilterOptions.find(item => item.value === value)?.label ?? value);
      case 'horoscopes':
        return [...this.filterDraft.horoscopes];
      case 'traitLabels':
      default:
        return [...this.filterDraft.traitLabels];
    }
  }

  private userInterests(user: DemoUser): string[] {
    return this.userFacet(user).interests;
  }

  private userValues(user: DemoUser): string[] {
    return this.userFacet(user).values;
  }

  private userFacet(user: DemoUser): GameUserFacet {
    return (
      this.userFacetById[user.id] ?? {
        interests: [],
        values: [],
        smoking: 'never',
        drinking: 'never',
        workout: 'weekly',
        pets: 'all pets welcome',
        familyPlans: 'open to both',
        children: 'no',
        loveStyle: 'slow-burn connection',
        communicationStyle: 'direct + warm',
        sexualOrientation: 'straight',
        religion: 'not religious'
      }
    );
  }

  private pairModeCandidateForGender(gender: DemoUser['gender']): DemoUser | null {
    const pool = this.candidatePool.filter(user => user.gender === gender);
    if (pool.length === 0) {
      return null;
    }
    return pool[this.cardIndex % pool.length] ?? null;
  }

  private pairModeCycleSize(): number {
    const womanCount = this.candidatePool.filter(user => user.gender === 'woman').length;
    const manCount = this.candidatePool.filter(user => user.gender === 'man').length;
    return Math.max(womanCount, manCount);
  }

  private imageStackForCandidate(candidate: DemoUser): string[] {
    const explicitImages = (candidate.images ?? []).filter(Boolean);
    if (explicitImages.length > 0) {
      return explicitImages;
    }
    const genderFolder = candidate.gender === 'woman' ? 'women' : 'men';
    const baseSeed = this.hashText(`game-card-image:${candidate.id}:${candidate.gender}`);
    const portraitIndexes: number[] = [];
    for (let offset = 0; offset < 8 && portraitIndexes.length < 3; offset += 1) {
      const portraitIndex = (baseSeed + offset * 17) % 100;
      if (!portraitIndexes.includes(portraitIndex)) {
        portraitIndexes.push(portraitIndex);
      }
    }
    return portraitIndexes.map(index => `https://randomuser.me/api/portraits/${genderFolder}/${index}.jpg`);
  }

  private initialsForCandidate(candidate: DemoUser): string {
    const parts = candidate.name.split(' ').filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  private beginCandidateImageLoadingForCurrentSelection(): void {
    if (!this.candidateImage) {
      this.isCandidateImageLoading = false;
      this.isCandidateImageIndicatorRevealing = false;
      this.clearCandidateImageIndicatorRevealTimer();
      this.cdr.markForCheck();
      return;
    }
    this.isCandidateImageLoading = true;
    this.isCandidateImageIndicatorRevealing = false;
    this.clearCandidateImageIndicatorRevealTimer();
  }

  private triggerCandidateImageIndicatorReveal(): void {
    this.clearCandidateImageIndicatorRevealTimer();
    this.isCandidateImageIndicatorRevealing = false;
    this.cdr.markForCheck();
    const startReveal = () => {
      this.isCandidateImageIndicatorRevealing = true;
      this.cdr.markForCheck();
      this.candidateImageIndicatorRevealTimer = setTimeout(() => {
        this.isCandidateImageIndicatorRevealing = false;
        this.candidateImageIndicatorRevealTimer = null;
        this.cdr.markForCheck();
      }, 320);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startReveal());
      return;
    }
    setTimeout(() => startReveal(), 0);
  }

  private clearCandidateImageIndicatorRevealTimer(): void {
    if (this.candidateImageIndicatorRevealTimer) {
      clearTimeout(this.candidateImageIndicatorRevealTimer);
      this.candidateImageIndicatorRevealTimer = null;
    }
  }

  private startGameCardLeaveAnimation(candidate: DemoUser, rating: number): void {
    const stack = this.imageStackForCandidate(candidate);
    const safeImageIndex = stack.length === 0 ? 0 : Math.min(this.selectedCandidateImageIndex, stack.length - 1);
    this.leavingGameCard = {
      candidate,
      imageUrl: stack[safeImageIndex] ?? null,
      imageCount: stack.length,
      imageIndex: safeImageIndex,
      initials: this.initialsForCandidate(candidate),
      rating
    };
    if (this.gameCardLeaveTimer) {
      clearTimeout(this.gameCardLeaveTimer);
      this.gameCardLeaveTimer = null;
    }
    this.gameCardLeaveTimer = setTimeout(() => {
      this.leavingGameCard = null;
      this.gameCardLeaveTimer = null;
      this.cdr.markForCheck();
    }, 440);
  }

  private triggerRatingBarBlink(): void {
    if (this.ratingBarBlinkTimeout) {
      clearTimeout(this.ratingBarBlinkTimeout);
      this.ratingBarBlinkTimeout = null;
    }
    this.isRatingBarBlinking = false;
    this.cdr.markForCheck();
    const startBlink = () => {
      this.isRatingBarBlinking = true;
      this.cdr.markForCheck();
      this.ratingBarBlinkTimeout = setTimeout(() => {
        this.isRatingBarBlinking = false;
        this.ratingBarBlinkTimeout = null;
        this.cdr.markForCheck();
      }, 420);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }

  private parseHeightCm(height: string): number | null {
    const parsed = Number.parseInt(height, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }
}
