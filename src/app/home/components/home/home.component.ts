import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { ActivitiesDbContextService } from '../../../activity/services/activities-db-context.service';
import { RatingStarBarComponent, type RatingStarBarConfig } from '../../../shared/ui';
import { DemoUser, PROFILE_DETAILS } from '../../../shared/demo-data';
import {
  AppContext,
  GameService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  USER_GAME_CARDS_LOAD_CONTEXT_KEY,
  UsersService,
  type UserDto
} from '../../../shared/core';

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

interface PairModeRoundState {
  woman: DemoUser | null;
  man: DemoUser | null;
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
  imports: [CommonModule, MatIconModule, FormsModule, MatSliderModule, RatingStarBarComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  private static readonly AGE_MIN = 18;
  private static readonly AGE_MAX = 120;
  private static readonly HEIGHT_MIN_CM = 40;
  private static readonly HEIGHT_MAX_CM = 250;
  private static readonly MOBILE_VIEWPORT_MAX_WIDTH_PX = 760;
  private static readonly PAIR_MODE_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly PAIR_MODE_SPLIT_MIN_PERCENT = 0;
  private static readonly PAIR_MODE_SPLIT_MAX_PERCENT = 100;
  private static readonly GAME_STACK_PRELOAD_THRESHOLD = 2;
  private static readonly GAME_STACK_PAGE_SIZE_SINGLE = 10;
  private static readonly GAME_STACK_PAGE_SIZE_PAIR = 10;
  private static readonly GAME_STACK_PHOTO_PRELOAD_TARGET = 12;
  private static readonly GAME_STACK_LOADING_WINDOW_MS = 3000;
  private static readonly GAME_STACK_LOADING_TICK_MS = 16;
  private static readonly GAME_STACK_LOAD_DELAY_MS = 1500;
  private static readonly GAME_RATING_CONFIRMATION_MS = 120;
  private static readonly GAME_STACK_TEST_JOINER_BATCH_SIZE = 10;
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
  private users: DemoUser[] = [];
  protected selectedRating = 0;
  protected isPairMode = false;
  protected cardIndex = 0;
  protected isRatingBarBlinking = false;
  protected isCandidateImageLoading = false;
  protected isCandidateImageIndicatorRevealing = false;
  protected leavingGameCard: LeavingGameCardState | null = null;
  protected leavingPairModeWomanCard: LeavingGameCardState | null = null;
  protected leavingPairModeManCard: LeavingGameCardState | null = null;
  protected selectedCandidateImageIndex = 0;
  protected pairModeWomanImageIndex = 0;
  protected pairModeManImageIndex = 0;
  protected pairModeSplitPercent = HomeComponent.PAIR_MODE_SPLIT_DEFAULT_PERCENT;
  protected isPairModeSplitDragging = false;
  protected isPairModeWomanImageLoading = false;
  protected isPairModeManImageLoading = false;
  protected isPairModeWomanImageIndicatorRevealing = false;
  protected isPairModeManImageIndicatorRevealing = false;
  protected gameStackCardsLoaded = 0;
  protected gameStackHeaderLoadingProgress = 0;
  protected gameStackHeaderLoadingOverdue = false;
  protected gameStackHeaderProgressLoading = false;
  protected gameInitialCardsLoadPending = false;
  protected candidateImageZoom = 1;
  protected candidateImagePanX = 0;
  protected candidateImagePanY = 0;
  protected localPopup: LocalPopup = null;
  protected activeUserId = '';
  protected filterDraft: GameFilterForm;
  protected gameFilter: GameFilterForm;
  protected filterSelector: FilterSelectorKind | null = null;
  protected filterLanguageInput = '';
  private filterLanguageSuggestionPool: string[] = [];
  private readonly failedCandidateImageUrls = new Set<string>();
  private readonly preloadedGameImageUrls = new Set<string>();
  private readonly pendingGameImageUrls = new Set<string>();
  private ratingBarBlinkTimeout: ReturnType<typeof setTimeout> | null = null;
  private ratingAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private candidateImageIndicatorRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private candidateImageLoadingPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private pairModeWomanImageIndicatorRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private pairModeManImageIndicatorRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private pairModeWomanImageLoadingPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private pairModeManImageLoadingPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private gameCardLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private gameStackPaginationKey = '';
  private gameStackPaginating = false;
  private gameStackExhausted = false;
  private gameStackNoMoreProbeCount = 0;
  private dynamicJoinerSequence = 0;
  private gameStackLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private gameStackHeaderLoadingCounter = 0;
  private gameStackHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private gameStackHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private gameStackHeaderLoadingStartedAtMs = 0;
  private isCandidateImageDragging = false;
  private candidateDragOffsetX = 0;
  private candidateDragOffsetY = 0;
  private activeTouchId: number | null = null;
  private pairModeSplitPointerId: number | null = null;
  private pairModeSplitBounds: { left: number; width: number } | null = null;
  private awaitingUserBootstrap = false;
  private awaitingUserByIdLoadingSeen = false;
  private lastHandledActiveUserId = '';
  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly activitiesContext: ActivitiesDbContextService,
    private readonly appCtx: AppContext,
    private readonly gameService: GameService,
    private readonly usersService: UsersService
  ) {
    this.users = this.gameService.getGameCardsUsersSnapshot() as DemoUser[];
    this.activeUserId = this.getActiveUserId();
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
    this.refreshFilterLanguageSuggestionPool();
    this.resetGameStackPaginationState();
    this.preloadGameImageWindow();
    this.maybeStartGameStackPaginationLoad();
    this.beginCandidateImageLoadingForCurrentSelection(true);
    const activeUserIdSignal = this.appCtx.activeUserId;
    const userByIdLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
    const userGameCardsLoadState = this.appCtx.selectLoadingState(USER_GAME_CARDS_LOAD_CONTEXT_KEY);
    effect(() => {
      const targetUserId = activeUserIdSignal().trim();
      if (!targetUserId || targetUserId === this.lastHandledActiveUserId) {
        return;
      }
      this.lastHandledActiveUserId = targetUserId;
      this.handleActiveUserChanged(targetUserId);
    });
    effect(() => {
      if (!this.awaitingUserBootstrap) {
        return;
      }
      const status = userByIdLoadState().status;
      if (status === 'loading') {
        this.awaitingUserByIdLoadingSeen = true;
        return;
      }
      if (status === 'idle' || !this.awaitingUserByIdLoadingSeen) {
        return;
      }
      this.awaitingUserBootstrap = false;
      this.awaitingUserByIdLoadingSeen = false;
      void this.reloadServiceCardStack();
    });
    effect(() => {
      const status = userGameCardsLoadState().status;
      if (status === 'loading') {
        this.beginGameStackHeaderProgressLoading();
        return;
      }
      if (status === 'success') {
        this.endGameStackHeaderProgressLoading();
        return;
      }
      if (status === 'error' || status === 'timeout') {
        this.clearGameStackHeaderLoadingAnimation();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPairModeSplitDrag();
    if (this.ratingBarBlinkTimeout) {
      clearTimeout(this.ratingBarBlinkTimeout);
      this.ratingBarBlinkTimeout = null;
    }
    this.clearPendingRatingAdvanceTimer();
    if (this.candidateImageIndicatorRevealTimer) {
      clearTimeout(this.candidateImageIndicatorRevealTimer);
      this.candidateImageIndicatorRevealTimer = null;
    }
    this.clearCandidateImageLoadingPulseTimer();
    this.clearPairModeCandidateImageIndicatorRevealTimer('woman');
    this.clearPairModeCandidateImageIndicatorRevealTimer('man');
    this.clearPairModeCandidateImageLoadingPulseTimer('woman');
    this.clearPairModeCandidateImageLoadingPulseTimer('man');
    if (this.gameCardLeaveTimer) {
      clearTimeout(this.gameCardLeaveTimer);
      this.gameCardLeaveTimer = null;
    }
    this.cancelGameStackPaginationLoad();
    this.clearGameStackHeaderLoadingAnimation();
  }

  protected get activeUser(): DemoUser {
    const localUser = this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
    if (!localUser) {
      return this.users[0];
    }
    const contextUser = this.appCtx.getUserProfile(localUser.id);
    if (!contextUser) {
      return localUser;
    }
    return this.mergeActiveUserFromContext(localUser, contextUser);
  }

  protected get canOpenHistory(): boolean {
    return this.appCtx.getLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY).status === 'success';
  }

  protected get historyBadgeCount(): number {
    if (!this.canOpenHistory) {
      return 0;
    }
    return this.appCtx.resolveUserCounter(this.activeUser.id, 'game', this.activeUser.activities.game);
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
    const serviceStack = this.gameService.getUserGameCardsStackSnapshot(this.activeUserId);
    if (!this.isPairMode && (serviceStack.cardUserIds.length > 0 || serviceStack.nextCursor !== null)) {
      const usersById = new Map(this.users.map(user => [user.id, user] as const));
      return serviceStack.cardUserIds
        .map(id => usersById.get(id))
        .filter((user): user is DemoUser => Boolean(user));
    }
    return this.users
      .filter(user => user.id !== this.activeUserId)
      .filter(user => this.matchesFilter(user));
  }

  protected get activeCandidate(): DemoUser | null {
    const pool = this.candidatePool;
    if (pool.length === 0 || this.cardIndex < 0) {
      return null;
    }
    const visibleCount = Math.min(this.gameStackCardsLoaded, pool.length);
    if (this.cardIndex >= visibleCount) {
      return null;
    }
    return pool[this.cardIndex] ?? null;
  }

  protected get pairModeWomanCandidate(): DemoUser | null {
    return this.pairModeCandidateForGender('woman');
  }

  protected get pairModeManCandidate(): DemoUser | null {
    return this.pairModeCandidateForGender('man');
  }

  protected get hasPairModeCandidates(): boolean {
    return this.pairModeWomanCandidate !== null && this.pairModeManCandidate !== null;
  }

  protected get pairModeSplitCssValue(): string {
    if (!this.isCompactViewport()) {
      return `${HomeComponent.PAIR_MODE_SPLIT_DEFAULT_PERCENT}%`;
    }
    return `${this.pairModeSplitPercent}%`;
  }

  protected get isPairModeWomanCollapsed(): boolean {
    return this.isCompactViewport() && this.pairModeSplitPercent <= 0.1;
  }

  protected get isPairModeManCollapsed(): boolean {
    return this.isCompactViewport() && this.pairModeSplitPercent >= 99.9;
  }

  protected get hasCandidatesForCurrentMode(): boolean {
    return this.isPairMode ? this.hasPairModeCandidates : this.activeCandidate !== null;
  }

  protected get hasFilteredCandidates(): boolean {
    return this.candidatePool.length > 0;
  }

  protected get filterBadgeCount(): number {
    const overrideTotal = this.appCtx.getUserFilterCountOverride(this.activeUser.id);
    const includeVisibleCardOffset = (!this.isPairMode && this.activeCandidate !== null) ? 1 : 0;
    if (this.gameInitialCardsLoadPending) {
      if (overrideTotal === null) {
        return 0;
      }
      return Math.max(0, overrideTotal - this.cardIndex + includeVisibleCardOffset);
    }
    const fallback = Math.max(0, this.totalRoundsForCurrentMode() - this.cardIndex + includeVisibleCardOffset);
    if (overrideTotal === null) {
      return fallback;
    }
    return Math.max(0, overrideTotal - this.cardIndex + includeVisibleCardOffset);
  }

  protected get hasRemainingCandidatesForCurrentMode(): boolean {
    return this.filterBadgeCount > 0;
  }

  protected get isAwaitingMoreGameCards(): boolean {
    return this.gameStackHeaderProgressLoading;
  }

  protected get gameStackHeaderProgress(): number {
    if (this.gameStackCardsLoaded <= 0) {
      return 0;
    }
    return this.clamp((this.cardIndex + 1) / this.gameStackCardsLoaded, 0, 1);
  }

  protected get showGameStackHeaderProgress(): boolean {
    return this.hasFilteredCandidates || this.gameStackHeaderProgressLoading;
  }

  protected get noCandidateTitle(): string {
    if (this.gameInitialCardsLoadPending || this.isAwaitingMoreGameCards) {
      return 'Loading more cards';
    }
    if (this.hasFilteredCandidates) {
      return 'No cards available';
    }
    return 'No matching profiles';
  }

  protected get noCandidateDescription(): string {
    if (this.gameInitialCardsLoadPending || this.isAwaitingMoreGameCards) {
      return 'Preloading the next stack in the background.';
    }
    if (this.hasFilteredCandidates) {
      return 'Change filters to get more cards.';
    }
    return 'Adjust age or profile traits in filter settings.';
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

  protected get gameRatingBarConfig(): RatingStarBarConfig {
    return {
      scale: this.ratingScale,
      presentation: 'fullscreen',
      animation: this.isRatingBarBlinking ? 'blink' : 'default'
    };
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
    this.stopPairModeSplitDrag();
    if (this.ratingAdvanceTimer) {
      return;
    }
    const currentCandidate = this.isPairMode
      ? (this.hasPairModeCandidates ? this.pairModeWomanCandidate : null)
      : this.activeCandidate;
    if (!currentCandidate) {
      this.maybeStartGameStackPaginationLoad();
      return;
    }
    if (this.isPairMode) {
      const woman = this.pairModeWomanCandidate;
      const man = this.pairModeManCandidate;
      if (!woman || !man) {
        this.maybeStartGameStackPaginationLoad();
        return;
      }
      this.gameService.recordUserGameCardPairRating(this.activeUserId, woman.id, man.id, value);
    } else {
      this.gameService.recordUserGameCardRating(this.activeUserId, currentCandidate.id, value, 'single');
    }
    this.selectedRating = value;
    this.triggerRatingBarBlink();
    this.ratingAdvanceTimer = setTimeout(() => {
      this.ratingAdvanceTimer = null;
      const hasUpcomingRound = this.cardIndex + 1 < this.totalRoundsForCurrentMode();
      if (hasUpcomingRound) {
        if (this.isPairMode) {
          this.startPairModeCardLeaveAnimation(value);
        } else {
          this.startGameCardLeaveAnimation(currentCandidate, value);
        }
      }
      this.cardIndex += 1;
      this.selectedRating = 0;
      this.maybeStartGameStackPaginationLoad();
      this.preloadGameImageWindow();
      this.resetCandidateImageState();
      this.beginCandidateImageLoadingForCurrentSelection(true);
      this.cdr.markForCheck();
    }, HomeComponent.GAME_RATING_CONFIRMATION_MS);
  }

  protected togglePairMode(): void {
    this.stopPairModeSplitDrag();
    this.isPairMode = !this.isPairMode;
    this.appCtx.clearUserFilterCountOverride(this.activeUserId);
    this.resetServiceCardState();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.gameInitialCardsLoadPending = true;
    void this.reloadServiceCardStack();
  }

  protected openHistory(): void {
    if (!this.canOpenHistory) {
      return;
    }
    this.activitiesContext.openActivities(
      'rates',
      undefined,
      this.isPairMode ? 'pair-given' : 'individual-given'
    );
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
    void this.usersService.saveUserFilterPreferences(this.activeUserId, this.gameFilter);
    this.appCtx.clearUserFilterCountOverride(this.activeUserId);
    this.resetServiceCardState();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.gameInitialCardsLoadPending = true;
    this.filterSelector = null;
    this.localPopup = null;
    void this.reloadServiceCardStack();
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
    this.markGameImagePreloaded(imageUrl);
    if (this.candidateImageLoadingPulseTimer) {
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
    this.pendingGameImageUrls.delete(imageUrl);
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
    this.beginCandidateImageLoadingForCurrentSelection(true);
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

  protected pairModeCandidateImageStack(candidate: DemoUser | null): string[] {
    return candidate ? this.imageStackForCandidate(candidate) : [];
  }

  protected pairModeCandidateImageIndex(gender: DemoUser['gender']): number {
    return gender === 'woman' ? this.pairModeWomanImageIndex : this.pairModeManImageIndex;
  }

  protected isPairModeCandidateImageLoading(gender: DemoUser['gender']): boolean {
    return gender === 'woman' ? this.isPairModeWomanImageLoading : this.isPairModeManImageLoading;
  }

  protected isPairModeCandidateImageIndicatorRevealing(gender: DemoUser['gender']): boolean {
    return gender === 'woman'
      ? this.isPairModeWomanImageIndicatorRevealing
      : this.isPairModeManImageIndicatorRevealing;
  }

  protected pairModeCandidateImage(candidate: DemoUser | null, gender: DemoUser['gender']): string | null {
    if (!candidate) {
      return null;
    }
    const stack = this.pairModeCandidateImageStack(candidate);
    if (stack.length === 0) {
      return null;
    }
    const safeIndex = Math.min(this.pairModeCandidateImageIndex(gender), stack.length - 1);
    const imageUrl = stack[safeIndex] ?? null;
    if (imageUrl && !this.failedCandidateImageUrls.has(imageUrl)) {
      return imageUrl;
    }
    return stack.find(url => !this.failedCandidateImageUrls.has(url)) ?? null;
  }

  protected selectPairModeCandidateImage(gender: DemoUser['gender'], index: number): void {
    const candidate = gender === 'woman' ? this.pairModeWomanCandidate : this.pairModeManCandidate;
    if (!candidate) {
      return;
    }
    const stack = this.pairModeCandidateImageStack(candidate);
    if (index < 0 || index >= stack.length) {
      return;
    }
    if (index === this.pairModeCandidateImageIndex(gender)) {
      return;
    }
    if (gender === 'woman') {
      this.pairModeWomanImageIndex = index;
    } else {
      this.pairModeManImageIndex = index;
    }
    this.beginPairModeCandidateImageLoading(gender, true);
  }

  protected onPairModeCandidateImageReady(candidate: DemoUser, gender: DemoUser['gender'], imageUrl: string): void {
    if (!this.isPairMode || !imageUrl) {
      return;
    }
    this.markGameImagePreloaded(imageUrl);
    const hasForcedPulseTimer = gender === 'woman'
      ? this.pairModeWomanImageLoadingPulseTimer !== null
      : this.pairModeManImageLoadingPulseTimer !== null;
    if (hasForcedPulseTimer) {
      return;
    }
    const currentImage = this.pairModeCandidateImage(candidate, gender);
    if (imageUrl !== currentImage) {
      return;
    }
    const hadPendingLoad = this.isPairModeCandidateImageLoading(gender);
    const finalizeReady = () => {
      if (!this.isPairMode) {
        return;
      }
      const latestImage = this.pairModeCandidateImage(candidate, gender);
      if (latestImage !== imageUrl) {
        return;
      }
      if (gender === 'woman') {
        this.isPairModeWomanImageLoading = false;
      } else {
        this.isPairModeManImageLoading = false;
      }
      if (hadPendingLoad) {
        this.triggerPairModeCandidateImageIndicatorReveal(gender);
        return;
      }
      this.cdr.markForCheck();
    };
    if (hadPendingLoad) {
      // Keep loading class briefly visible so bounce animation is perceivable.
      setTimeout(() => finalizeReady(), 80);
      return;
    }
    finalizeReady();
  }

  protected onPairModeCandidateImageError(candidate: DemoUser, gender: DemoUser['gender'], imageUrl: string): void {
    this.onPairModeCandidateImageReady(candidate, gender, imageUrl);
    if (!imageUrl) {
      return;
    }
    this.pendingGameImageUrls.delete(imageUrl);
    this.failedCandidateImageUrls.add(imageUrl);
    const stack = this.pairModeCandidateImageStack(candidate);
    const nextAvailableImageIndex = stack.findIndex(url => !this.failedCandidateImageUrls.has(url));
    if (nextAvailableImageIndex >= 0 && nextAvailableImageIndex !== this.pairModeCandidateImageIndex(gender)) {
      this.selectPairModeCandidateImage(gender, nextAvailableImageIndex);
      return;
    }
    this.cdr.markForCheck();
  }

  protected onPairModeSplitHandlePointerDown(event: PointerEvent, stackElement: HTMLElement): void {
    if (!this.isPairMode || !this.isCompactViewport() || !stackElement) {
      return;
    }
    const bounds = stackElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    this.pairModeSplitBounds = { left: bounds.left, width: bounds.width };
    this.pairModeSplitPointerId = event.pointerId;
    this.isPairModeSplitDragging = true;
    this.updatePairModeSplitFromClientX(event.clientX);
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

  protected pairModeCandidateInitials(candidate: DemoUser | null): string {
    return candidate ? this.initialsForCandidate(candidate) : '∅';
  }

  protected candidateActivityBadge(candidate: DemoUser | null): string | null {
    if (!candidate) {
      return null;
    }
    const status = candidate.statusText?.trim();
    if (!status) {
      return null;
    }
    const normalized = status.toLowerCase();
    if (normalized.includes('active') || normalized.includes('akt')) {
      return 'Active recently';
    }
    return status;
  }

  private handleActiveUserChanged(userId: string): void {
    this.stopPairModeSplitDrag();
    this.activeUserId = userId;
    this.resetServiceCardState();
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
    this.applyFilterPreferencesFromAppContext();
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.gameInitialCardsLoadPending = true;
    this.awaitingUserBootstrap = true;
    this.awaitingUserByIdLoadingSeen = false;
    const expectedUserId = this.activeUserId;
    setTimeout(() => {
      if (
        !this.awaitingUserBootstrap
        || this.awaitingUserByIdLoadingSeen
        || this.activeUserId !== expectedUserId
      ) {
        return;
      }
      this.awaitingUserBootstrap = false;
      void this.reloadServiceCardStack();
    }, 0);
    this.cdr.markForCheck();
  }

  private resetServiceCardState(): void {
    this.clearPendingRatingAdvanceTimer();
    this.gameService.resetUserGameCardsStack(this.activeUserId);
  }

  private clearPendingRatingAdvanceTimer(): void {
    if (this.ratingAdvanceTimer) {
      clearTimeout(this.ratingAdvanceTimer);
      this.ratingAdvanceTimer = null;
    }
    this.selectedRating = 0;
  }

  private applyFilterPreferencesFromAppContext(): void {
    const next = this.appCtx.resolveUserFilterPreferences(this.activeUserId, this.createInitialFilter());
    this.gameFilter = this.normalizeFilter(next);
    this.filterDraft = this.cloneFilter(this.gameFilter);
    this.refreshFilterLanguageSuggestionPool();
  }

  private async reloadServiceCardStack(): Promise<void> {
    if (this.gameService.isUserGameCardsStackRequestInFlight(this.activeUserId)) {
      return;
    }
    const requestUserId = this.activeUserId;
    try {
      await this.gameService.loadInitialUserGameCardsStackPage(
        this.activeUserId,
        this.gameFilter,
        this.gameStackPageSizeForCurrentMode()
      );
      if (requestUserId !== this.activeUserId) {
        return;
      }
      this.resetGameStackPaginationState(true);
      this.preloadGameImageWindow();
      this.beginCandidateImageLoadingForCurrentSelection(true);
    } finally {
      this.gameInitialCardsLoadPending = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isPairModeSplitDragging || this.pairModeSplitPointerId !== event.pointerId) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updatePairModeSplitFromClientX(event.clientX);
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(event: PointerEvent): void {
    if (this.pairModeSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopPairModeSplitDrag();
  }

  @HostListener('window:pointercancel', ['$event'])
  onWindowPointerCancel(event: PointerEvent): void {
    if (this.pairModeSplitPointerId !== event.pointerId) {
      return;
    }
    this.stopPairModeSplitDrag();
  }

  private getActiveUserId(): string {
    if (this.users.length === 0) {
      return '';
    }
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

  private updatePairModeSplitFromClientX(clientX: number): void {
    if (!this.pairModeSplitBounds || this.pairModeSplitBounds.width <= 0) {
      return;
    }
    const relative = ((clientX - this.pairModeSplitBounds.left) / this.pairModeSplitBounds.width) * 100;
    this.pairModeSplitPercent = this.clamp(
      relative,
      HomeComponent.PAIR_MODE_SPLIT_MIN_PERCENT,
      HomeComponent.PAIR_MODE_SPLIT_MAX_PERCENT
    );
    this.cdr.markForCheck();
  }

  private stopPairModeSplitDrag(): void {
    if (!this.isPairModeSplitDragging && this.pairModeSplitPointerId === null && this.pairModeSplitBounds === null) {
      return;
    }
    this.isPairModeSplitDragging = false;
    this.pairModeSplitPointerId = null;
    this.pairModeSplitBounds = null;
    this.cdr.markForCheck();
  }

  private isCompactViewport(): boolean {
    return typeof globalThis.innerWidth === 'number' && globalThis.innerWidth <= HomeComponent.MOBILE_VIEWPORT_MAX_WIDTH_PX;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private resetCandidateImageState(): void {
    this.stopPairModeSplitDrag();
    this.selectedCandidateImageIndex = 0;
    this.pairModeWomanImageIndex = 0;
    this.pairModeManImageIndex = 0;
    this.isPairModeWomanImageLoading = false;
    this.isPairModeManImageLoading = false;
    this.isPairModeWomanImageIndicatorRevealing = false;
    this.isPairModeManImageIndicatorRevealing = false;
    this.candidateImageZoom = 1;
    this.candidateImagePanX = 0;
    this.candidateImagePanY = 0;
    this.isCandidateImageDragging = false;
    this.activeTouchId = null;
    this.clearPairModeCandidateImageIndicatorRevealTimer('woman');
    this.clearPairModeCandidateImageIndicatorRevealTimer('man');
    this.clearCandidateImageLoadingPulseTimer();
    this.clearPairModeCandidateImageLoadingPulseTimer('woman');
    this.clearPairModeCandidateImageLoadingPulseTimer('man');
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
    const visibleCount = Math.min(this.gameStackCardsLoaded, this.pairModeCycleSize());
    if (this.cardIndex < 0 || this.cardIndex >= visibleCount) {
      return null;
    }
    const round = this.pairModeRoundAt(this.cardIndex);
    if (!round) {
      return null;
    }
    return gender === 'woman' ? round.woman : round.man;
  }

  private pairModeCycleSize(): number {
    return this.pairModeRounds().length;
  }

  private pairModeRounds(): PairModeRoundState[] {
    const women = this.candidatePool.filter(user => user.gender === 'woman');
    const men = this.candidatePool.filter(user => user.gender === 'man');
    const total = Math.min(women.length, men.length);
    return Array.from({ length: total }, (_, index) => ({
      woman: women[index] ?? null,
      man: men[index] ?? null
    }));
  }

  private pairModeRoundAt(index: number): PairModeRoundState | null {
    if (index < 0) {
      return null;
    }
    const rounds = this.pairModeRounds();
    if (index >= rounds.length) {
      return null;
    }
    return rounds[index] ?? null;
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

  private beginCandidateImageLoadingForCurrentSelection(forceLoadingPulse = false): void {
    if (this.isPairMode) {
      this.beginPairModeCandidateImageLoading('woman', forceLoadingPulse);
      this.beginPairModeCandidateImageLoading('man', forceLoadingPulse);
      this.maybeStartGameStackPaginationLoad();
      return;
    }
    if (!this.candidateImage) {
      this.isCandidateImageLoading = false;
      this.isCandidateImageIndicatorRevealing = false;
      this.clearCandidateImageIndicatorRevealTimer();
      this.clearCandidateImageLoadingPulseTimer();
      this.maybeStartGameStackPaginationLoad();
      this.cdr.markForCheck();
      return;
    }
    const activeImage = this.candidateImage;
    const isPreloaded = this.isGameImagePreloaded(activeImage);
    this.isCandidateImageLoading = !isPreloaded;
    this.isCandidateImageIndicatorRevealing = false;
    this.clearCandidateImageIndicatorRevealTimer();
    this.clearCandidateImageLoadingPulseTimer();
    if (forceLoadingPulse && isPreloaded) {
      this.isCandidateImageLoading = true;
      this.candidateImageLoadingPulseTimer = setTimeout(() => {
        this.candidateImageLoadingPulseTimer = null;
        if (this.isPairMode || this.candidateImage !== activeImage) {
          return;
        }
        this.isCandidateImageLoading = false;
        this.isCandidateImageIndicatorRevealing = false;
        this.cdr.markForCheck();
      }, 420);
      this.cdr.markForCheck();
      return;
    }
    if (!this.isCandidateImageLoading) {
      this.triggerCandidateImageIndicatorReveal();
      return;
    }
    this.cdr.markForCheck();
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

  private clearCandidateImageLoadingPulseTimer(): void {
    if (this.candidateImageLoadingPulseTimer) {
      clearTimeout(this.candidateImageLoadingPulseTimer);
      this.candidateImageLoadingPulseTimer = null;
    }
  }

  private beginPairModeCandidateImageLoading(gender: DemoUser['gender'], forceLoadingPulse = false): void {
    const candidate = gender === 'woman' ? this.pairModeWomanCandidate : this.pairModeManCandidate;
    const imageUrl = this.pairModeCandidateImage(candidate, gender);
    if (!imageUrl) {
      if (gender === 'woman') {
        this.isPairModeWomanImageLoading = false;
        this.isPairModeWomanImageIndicatorRevealing = false;
      } else {
        this.isPairModeManImageLoading = false;
        this.isPairModeManImageIndicatorRevealing = false;
      }
      this.clearPairModeCandidateImageIndicatorRevealTimer(gender);
      this.clearPairModeCandidateImageLoadingPulseTimer(gender);
      this.cdr.markForCheck();
      return;
    }
    const isPreloaded = this.isGameImagePreloaded(imageUrl);
    if (gender === 'woman') {
      this.isPairModeWomanImageLoading = !isPreloaded;
      this.isPairModeWomanImageIndicatorRevealing = false;
    } else {
      this.isPairModeManImageLoading = !isPreloaded;
      this.isPairModeManImageIndicatorRevealing = false;
    }
    this.clearPairModeCandidateImageIndicatorRevealTimer(gender);
    this.clearPairModeCandidateImageLoadingPulseTimer(gender);
    if (forceLoadingPulse && isPreloaded) {
      if (gender === 'woman') {
        this.isPairModeWomanImageLoading = true;
        this.pairModeWomanImageLoadingPulseTimer = setTimeout(() => {
          this.pairModeWomanImageLoadingPulseTimer = null;
          if (!this.isPairMode || this.pairModeCandidateImage(this.pairModeWomanCandidate, 'woman') !== imageUrl) {
            return;
          }
          this.isPairModeWomanImageLoading = false;
          this.isPairModeWomanImageIndicatorRevealing = false;
          this.cdr.markForCheck();
        }, 420);
      } else {
        this.isPairModeManImageLoading = true;
        this.pairModeManImageLoadingPulseTimer = setTimeout(() => {
          this.pairModeManImageLoadingPulseTimer = null;
          if (!this.isPairMode || this.pairModeCandidateImage(this.pairModeManCandidate, 'man') !== imageUrl) {
            return;
          }
          this.isPairModeManImageLoading = false;
          this.isPairModeManImageIndicatorRevealing = false;
          this.cdr.markForCheck();
        }, 420);
      }
      this.cdr.markForCheck();
      return;
    }
    if (!this.isPairModeCandidateImageLoading(gender)) {
      this.triggerPairModeCandidateImageIndicatorReveal(gender);
      return;
    }
    this.cdr.markForCheck();
  }

  private triggerPairModeCandidateImageIndicatorReveal(gender: DemoUser['gender']): void {
    this.clearPairModeCandidateImageIndicatorRevealTimer(gender);
    if (gender === 'woman') {
      this.isPairModeWomanImageIndicatorRevealing = false;
    } else {
      this.isPairModeManImageIndicatorRevealing = false;
    }
    this.cdr.markForCheck();
    const startReveal = () => {
      if (gender === 'woman') {
        this.isPairModeWomanImageIndicatorRevealing = true;
      } else {
        this.isPairModeManImageIndicatorRevealing = true;
      }
      this.cdr.markForCheck();
      const timer = setTimeout(() => {
        if (gender === 'woman') {
          this.isPairModeWomanImageIndicatorRevealing = false;
          this.pairModeWomanImageIndicatorRevealTimer = null;
        } else {
          this.isPairModeManImageIndicatorRevealing = false;
          this.pairModeManImageIndicatorRevealTimer = null;
        }
        this.cdr.markForCheck();
      }, 320);
      if (gender === 'woman') {
        this.pairModeWomanImageIndicatorRevealTimer = timer;
      } else {
        this.pairModeManImageIndicatorRevealTimer = timer;
      }
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startReveal());
      return;
    }
    setTimeout(() => startReveal(), 0);
  }

  private clearPairModeCandidateImageIndicatorRevealTimer(gender: DemoUser['gender']): void {
    if (gender === 'woman') {
      if (this.pairModeWomanImageIndicatorRevealTimer) {
        clearTimeout(this.pairModeWomanImageIndicatorRevealTimer);
        this.pairModeWomanImageIndicatorRevealTimer = null;
      }
      return;
    }
    if (this.pairModeManImageIndicatorRevealTimer) {
      clearTimeout(this.pairModeManImageIndicatorRevealTimer);
      this.pairModeManImageIndicatorRevealTimer = null;
    }
  }

  private clearPairModeCandidateImageLoadingPulseTimer(gender: DemoUser['gender']): void {
    if (gender === 'woman') {
      if (this.pairModeWomanImageLoadingPulseTimer) {
        clearTimeout(this.pairModeWomanImageLoadingPulseTimer);
        this.pairModeWomanImageLoadingPulseTimer = null;
      }
      return;
    }
    if (this.pairModeManImageLoadingPulseTimer) {
      clearTimeout(this.pairModeManImageLoadingPulseTimer);
      this.pairModeManImageLoadingPulseTimer = null;
    }
  }

  private startGameCardLeaveAnimation(candidate: DemoUser, rating: number): void {
    this.leavingPairModeWomanCard = null;
    this.leavingPairModeManCard = null;
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
      this.leavingPairModeWomanCard = null;
      this.leavingPairModeManCard = null;
      this.gameCardLeaveTimer = null;
      this.cdr.markForCheck();
    }, 440);
  }

  private startPairModeCardLeaveAnimation(rating: number): void {
    this.leavingGameCard = null;
    this.leavingPairModeWomanCard = this.buildPairModeLeavingCardState(this.pairModeWomanCandidate, 'woman', rating);
    this.leavingPairModeManCard = this.buildPairModeLeavingCardState(this.pairModeManCandidate, 'man', rating);
    if (!this.leavingPairModeWomanCard && !this.leavingPairModeManCard) {
      return;
    }
    if (this.gameCardLeaveTimer) {
      clearTimeout(this.gameCardLeaveTimer);
      this.gameCardLeaveTimer = null;
    }
    this.gameCardLeaveTimer = setTimeout(() => {
      this.leavingGameCard = null;
      this.leavingPairModeWomanCard = null;
      this.leavingPairModeManCard = null;
      this.gameCardLeaveTimer = null;
      this.cdr.markForCheck();
    }, 440);
  }

  private buildPairModeLeavingCardState(
    candidate: DemoUser | null,
    gender: DemoUser['gender'],
    rating: number
  ): LeavingGameCardState | null {
    if (!candidate) {
      return null;
    }
    const stack = this.pairModeCandidateImageStack(candidate);
    const selectedImageIndex = gender === 'woman' ? this.pairModeWomanImageIndex : this.pairModeManImageIndex;
    const safeImageIndex = stack.length === 0 ? 0 : Math.min(selectedImageIndex, stack.length - 1);
    return {
      candidate,
      imageUrl: stack[safeImageIndex] ?? null,
      imageCount: stack.length,
      imageIndex: safeImageIndex,
      initials: this.initialsForCandidate(candidate),
      rating
    };
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

  private totalRoundsForCurrentMode(): number {
    if (this.isPairMode) {
      return this.pairModeCycleSize();
    }
    const serviceStack = this.gameService.getUserGameCardsStackSnapshot(this.activeUserId);
    if (serviceStack.cardUserIds.length > 0 || serviceStack.nextCursor !== null) {
      return this.appCtx.resolveUserFilterCount(this.activeUserId, serviceStack.cardUserIds.length);
    }
    return this.candidatePool.length;
  }

  private gameStackPaginationStateKey(): string {
    const modeKey = this.isPairMode ? 'pair' : 'single';
    const filterKey = JSON.stringify(this.gameFilter);
    return `${this.activeUserId}|${modeKey}|${filterKey}`;
  }

  private gameStackPageSizeForCurrentMode(): number {
    return this.isPairMode
      ? HomeComponent.GAME_STACK_PAGE_SIZE_PAIR
      : HomeComponent.GAME_STACK_PAGE_SIZE_SINGLE;
  }

  private hasMoreRoundsForCurrentMode(): boolean {
    return this.gameStackCardsLoaded < this.totalRoundsForCurrentMode();
  }

  private resetGameStackPaginationState(loadFirstPageImmediately = true): void {
    this.cancelGameStackPaginationLoad();
    this.clearGameStackHeaderLoadingAnimation();
    this.gameStackPaginationKey = this.gameStackPaginationStateKey();
    this.gameStackExhausted = false;
    this.gameStackNoMoreProbeCount = 0;
    const totalRounds = this.totalRoundsForCurrentMode();
    this.gameStackCardsLoaded = loadFirstPageImmediately
      ? Math.min(totalRounds, this.gameStackPageSizeForCurrentMode())
      : 0;
    this.cardIndex = Math.min(this.cardIndex, this.gameStackCardsLoaded);
    this.cdr.markForCheck();
  }

  private maybeStartGameStackPaginationLoad(): void {
    const stateKey = this.gameStackPaginationStateKey();
    if (stateKey !== this.gameStackPaginationKey) {
      this.resetGameStackPaginationState();
    }
    if (this.gameStackPaginating || this.gameStackHeaderProgressLoading) {
      return;
    }
    if (!this.canAttemptGameStackLoad()) {
      this.gameStackExhausted = true;
      return;
    }
    const remainingCards = this.gameStackCardsLoaded - this.cardIndex;
    if (remainingCards > HomeComponent.GAME_STACK_PRELOAD_THRESHOLD) {
      return;
    }
    if (this.gameStackExhausted && this.hasMoreRoundsForCurrentMode()) {
      this.gameStackExhausted = false;
      this.gameStackNoMoreProbeCount = 0;
    }
    if (this.gameStackExhausted) {
      return;
    }
    this.startGameStackPaginationLoad();
  }

  private startGameStackPaginationLoad(): void {
    if (!this.isPairMode && this.gameService.shouldUseUserGameCardsStack(this.activeUserId)) {
      this.startServiceCardPaginationLoad();
      return;
    }
    if (this.gameStackPaginating) {
      return;
    }
    if (!this.canAttemptGameStackLoad()) {
      this.gameStackExhausted = true;
      return;
    }
    const hadKnownMoreBeforeLoad = this.hasMoreRoundsForCurrentMode();
    if (!hadKnownMoreBeforeLoad && this.gameStackExhausted) {
      return;
    }
    this.gameStackPaginating = true;
    this.beginGameStackHeaderProgressLoading();
    const delayMs = hadKnownMoreBeforeLoad
      ? HomeComponent.GAME_STACK_LOAD_DELAY_MS
      : (this.gameStackNoMoreProbeCount === 0
        ? HomeComponent.GAME_STACK_LOAD_DELAY_MS
        : (HomeComponent.GAME_STACK_LOADING_WINDOW_MS + 160));
    this.gameStackLoadTimer = setTimeout(() => {
      this.gameStackLoadTimer = null;
      if (!hadKnownMoreBeforeLoad) {
        this.gameStackNoMoreProbeCount += 1;
        if (this.gameStackNoMoreProbeCount === 1) {
          this.injectTestJoinerUsers(HomeComponent.GAME_STACK_TEST_JOINER_BATCH_SIZE);
        }
      }
      const totalRounds = this.totalRoundsForCurrentMode();
      const previousLoaded = this.gameStackCardsLoaded;
      this.gameStackCardsLoaded = Math.min(totalRounds, this.gameStackCardsLoaded + this.gameStackPageSizeForCurrentMode());
      const loadedMoreCards = this.gameStackCardsLoaded > previousLoaded;
      this.gameStackExhausted = !loadedMoreCards;
      this.gameStackPaginating = false;
      if (loadedMoreCards) {
        this.endGameStackHeaderProgressLoading();
      } else {
        this.clearGameStackHeaderLoadingAnimation();
      }
      this.preloadGameImageWindow();
      this.beginCandidateImageLoadingForCurrentSelection(true);
      this.cdr.markForCheck();
    }, delayMs);
  }

  private startServiceCardPaginationLoad(): void {
    if (this.gameStackPaginating || this.gameService.isUserGameCardsStackRequestInFlight(this.activeUserId)) {
      return;
    }
    const serviceStackBefore = this.gameService.getUserGameCardsStackSnapshot(this.activeUserId);
    if (!serviceStackBefore.nextCursor && serviceStackBefore.cardUserIds.length > 0) {
      this.gameStackExhausted = true;
      return;
    }

    this.gameStackPaginating = true;
    void this.gameService.loadNextUserGameCardsStackPage(
      this.activeUserId,
      this.gameFilter,
      this.gameStackPageSizeForCurrentMode()
    ).then(serviceStack => {
      const previousLoaded = this.gameStackCardsLoaded;
      const totalRounds = this.totalRoundsForCurrentMode();
      this.gameStackCardsLoaded = Math.min(totalRounds, serviceStack.cardUserIds.length);
      const loadedMoreCards = this.gameStackCardsLoaded > previousLoaded;
      this.gameStackExhausted = !loadedMoreCards && !serviceStack.nextCursor;
      this.preloadGameImageWindow();
      this.beginCandidateImageLoadingForCurrentSelection(true);
    }).catch(() => {
      this.gameStackExhausted = true;
    }).finally(() => {
      this.gameStackPaginating = false;
      this.cdr.markForCheck();
    });
  }

  private cancelGameStackPaginationLoad(): void {
    if (this.gameStackLoadTimer) {
      clearTimeout(this.gameStackLoadTimer);
      this.gameStackLoadTimer = null;
    }
    this.gameStackPaginating = false;
  }

  private beginGameStackHeaderProgressLoading(): void {
    this.gameStackHeaderLoadingCounter += 1;
    if (this.gameStackHeaderLoadingCounter > 1) {
      return;
    }
    this.gameStackHeaderProgressLoading = true;
    this.gameStackHeaderLoadingOverdue = false;
    this.gameStackHeaderLoadingProgress = 0.02;
    this.gameStackHeaderLoadingStartedAtMs = this.nowMs();
    if (this.gameStackHeaderLoadingCompleteTimer) {
      clearTimeout(this.gameStackHeaderLoadingCompleteTimer);
      this.gameStackHeaderLoadingCompleteTimer = null;
    }
    if (this.gameStackHeaderLoadingInterval) {
      clearInterval(this.gameStackHeaderLoadingInterval);
      this.gameStackHeaderLoadingInterval = null;
    }
    this.updateGameStackHeaderLoadingWindow();
    this.gameStackHeaderLoadingInterval = setInterval(() => {
      this.updateGameStackHeaderLoadingWindow();
      this.cdr.markForCheck();
    }, HomeComponent.GAME_STACK_LOADING_TICK_MS);
    this.cdr.markForCheck();
  }

  private endGameStackHeaderProgressLoading(): void {
    if (this.gameStackHeaderLoadingCounter === 0) {
      return;
    }
    this.gameStackHeaderLoadingCounter = Math.max(0, this.gameStackHeaderLoadingCounter - 1);
    if (this.gameStackHeaderLoadingCounter !== 0) {
      return;
    }
    this.completeGameStackHeaderLoading();
  }

  private completeGameStackHeaderLoading(): void {
    if (this.gameStackHeaderLoadingInterval) {
      clearInterval(this.gameStackHeaderLoadingInterval);
      this.gameStackHeaderLoadingInterval = null;
    }
    this.gameStackHeaderLoadingProgress = 1;
    this.gameStackHeaderLoadingOverdue = false;
    if (this.gameStackHeaderLoadingCompleteTimer) {
      clearTimeout(this.gameStackHeaderLoadingCompleteTimer);
    }
    this.gameStackHeaderLoadingCompleteTimer = setTimeout(() => {
      if (this.gameStackHeaderLoadingCounter !== 0) {
        return;
      }
      this.gameStackHeaderProgressLoading = false;
      this.gameStackHeaderLoadingProgress = 0;
      this.gameStackHeaderLoadingOverdue = false;
      this.gameStackHeaderLoadingStartedAtMs = 0;
      this.gameStackHeaderLoadingCompleteTimer = null;
      this.cdr.markForCheck();
    }, 100);
    this.cdr.markForCheck();
  }

  private updateGameStackHeaderLoadingWindow(): void {
    if (!this.gameStackHeaderProgressLoading) {
      return;
    }
    const elapsed = Math.max(0, this.nowMs() - this.gameStackHeaderLoadingStartedAtMs);
    const nextProgress = this.clamp(elapsed / HomeComponent.GAME_STACK_LOADING_WINDOW_MS, 0, 1);
    this.gameStackHeaderLoadingProgress = Math.max(this.gameStackHeaderLoadingProgress, nextProgress);
    this.gameStackHeaderLoadingOverdue =
      elapsed >= HomeComponent.GAME_STACK_LOADING_WINDOW_MS && this.gameStackHeaderLoadingCounter > 0;
  }

  private clearGameStackHeaderLoadingAnimation(): void {
    if (this.gameStackHeaderLoadingInterval) {
      clearInterval(this.gameStackHeaderLoadingInterval);
      this.gameStackHeaderLoadingInterval = null;
    }
    if (this.gameStackHeaderLoadingCompleteTimer) {
      clearTimeout(this.gameStackHeaderLoadingCompleteTimer);
      this.gameStackHeaderLoadingCompleteTimer = null;
    }
    this.gameStackHeaderLoadingCounter = 0;
    this.gameStackHeaderLoadingProgress = 0;
    this.gameStackHeaderProgressLoading = false;
    this.gameStackHeaderLoadingOverdue = false;
    this.gameStackHeaderLoadingStartedAtMs = 0;
  }

  private canAttemptGameStackLoad(): boolean {
    if (this.isPairMode) {
      const hasWomen = this.candidatePool.some(user => user.gender === 'woman');
      const hasMen = this.candidatePool.some(user => user.gender === 'man');
      return hasWomen && hasMen;
    }
    return this.candidatePool.length > 0;
  }

  private injectTestJoinerUsers(count: number): void {
    if (count <= 0) {
      return;
    }
    const source = this.candidatePool;
    if (source.length === 0) {
      return;
    }
    const generated: DemoUser[] = [];
    for (let index = 0; index < count; index += 1) {
      const base = source[index % source.length];
      if (!base) {
        continue;
      }
      this.dynamicJoinerSequence += 1;
      const id = `dyn-${base.id}-${this.dynamicJoinerSequence}`;
      const nextUser: DemoUser = {
        ...base,
        id,
        name: `${base.name} ${this.dynamicJoinerSequence}`,
        statusText: 'Active recently',
        completion: Math.max(35, Math.min(99, base.completion + ((index % 7) - 3))),
        activities: {
          ...base.activities,
          game: Math.max(1, base.activities.game + ((index % 3) - 1))
        }
      };
      generated.push(nextUser);
      this.userFacetById[id] = {
        ...this.userFacet(base),
        interests: [...this.userInterests(base)],
        values: [...this.userValues(base)]
      };
    }
    if (generated.length === 0) {
      return;
    }
    this.users = [...this.users, ...generated];
  }

  private preloadGameImageWindow(): void {
    const totalRounds = this.totalRoundsForCurrentMode();
    if (totalRounds === 0) {
      return;
    }
    let preloadedCount = 0;
    for (let roundIndex = this.cardIndex; roundIndex < totalRounds; roundIndex += 1) {
      const roundCandidates = this.gameCandidatesForRound(roundIndex);
      for (const candidate of roundCandidates) {
        const stack = this.imageStackForCandidate(candidate);
        for (const url of stack) {
          if (!url || this.failedCandidateImageUrls.has(url)) {
            continue;
          }
          if (this.isGameImagePreloaded(url)) {
            continue;
          }
          this.preloadGameImageUrl(url);
          preloadedCount += 1;
          if (preloadedCount >= HomeComponent.GAME_STACK_PHOTO_PRELOAD_TARGET) {
            return;
          }
        }
      }
    }
  }

  private gameCandidatesForRound(roundIndex: number): DemoUser[] {
    if (roundIndex < 0) {
      return [];
    }
    if (this.isPairMode) {
      const round = this.pairModeRoundAt(roundIndex);
      if (!round) {
        return [];
      }
      const candidates: DemoUser[] = [];
      if (round.woman) {
        candidates.push(round.woman);
      }
      if (round.man) {
        candidates.push(round.man);
      }
      return candidates;
    }
    const candidate = this.candidatePool[roundIndex] ?? null;
    return candidate ? [candidate] : [];
  }

  private preloadGameImageUrl(url: string): void {
    if (!url || this.pendingGameImageUrls.has(url) || this.preloadedGameImageUrls.has(url)) {
      return;
    }
    if (typeof Image === 'undefined') {
      return;
    }
    this.pendingGameImageUrls.add(url);
    const image = new Image();
    image.onload = () => this.markGameImagePreloaded(url);
    image.onerror = () => {
      this.pendingGameImageUrls.delete(url);
    };
    image.src = url;
  }

  private markGameImagePreloaded(url: string): void {
    if (!url) {
      return;
    }
    this.pendingGameImageUrls.delete(url);
    this.preloadedGameImageUrls.add(url);
  }

  private isGameImagePreloaded(url: string | null): boolean {
    return !!url && this.preloadedGameImageUrls.has(url);
  }

  private mergeActiveUserFromContext(localUser: DemoUser, contextUser: UserDto): DemoUser {
    return {
      ...localUser,
      name: contextUser.name,
      age: contextUser.age,
      birthday: contextUser.birthday,
      city: contextUser.city,
      height: contextUser.height,
      physique: contextUser.physique,
      languages: [...(contextUser.languages ?? localUser.languages)],
      horoscope: contextUser.horoscope,
      initials: contextUser.initials,
      gender: contextUser.gender,
      statusText: contextUser.statusText,
      hostTier: contextUser.hostTier,
      traitLabel: contextUser.traitLabel,
      completion: contextUser.completion,
      headline: contextUser.headline,
      about: contextUser.about,
      images: [...(contextUser.images ?? localUser.images ?? [])],
      profileStatus: contextUser.profileStatus,
      activities: {
        game: contextUser.activities?.game ?? localUser.activities.game,
        chat: contextUser.activities?.chat ?? localUser.activities.chat,
        invitations: contextUser.activities?.invitations ?? localUser.activities.invitations,
        events: contextUser.activities?.events ?? localUser.activities.events,
        hosting: contextUser.activities?.hosting ?? localUser.activities.hosting
      }
    };
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
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
