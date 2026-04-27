import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';
import { ActivitiesPopupStateService } from '../../../activity/services/activities-popup-state.service';
import {
  CounterBadgePipe,
  PairCardComponent,
  SingleCardComponent,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type PairCardData,
  type RatingStarBarConfig,
  type SingleCardData,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';
import type { DemoUser } from '../../../shared/core/base/interfaces/user.interface';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  AppContext,
  GameService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  UsersService,
  type UserDto,
  type UserGameMode,
  type UserGameSocialCard
} from '../../../shared/core';
import { HomeGameFilterPopupComponent } from './home-game-filter-popup.component';
import {
  GameFilterForm,
  GameFilterOptionGroup,
  GameUserFacet,
  HomeGameFilterPopupContext,
  cloneGameFilter,
  createInitialGameFilter,
  getGameUserFacet,
  getGameUserInterests,
  getGameUserValues,
  isGameFilterActive,
  normalizeGameFilter,
  parseGameHeightCm
} from './home-game-filter.shared';

type LocalPopup = 'history' | 'filter' | null;

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
  socialCard?: UserGameSocialCard;
}

interface HomeSmartListFilters {
  activeUserId: string;
  mode: UserGameMode;
  filterKey: string;
}

interface HomeSingleSmartListRow {
  id: string;
  mode: 'single';
  candidate: DemoUser;
  socialCard?: UserGameSocialCard;
}

interface HomePairSmartListRow {
  id: string;
  mode: 'pair';
  round: PairModeRoundState;
}

type HomeSmartListRow = HomeSingleSmartListRow | HomePairSmartListRow;

interface HomeModeOption {
  key: UserGameMode;
  label: string;
  icon: string;
}

const PUBLIC_PROFILE_DETAIL_LABELS = new Set(
  APP_STATIC_DATA.profileDetailGroupTemplates.flatMap(group =>
    group.rows
      .filter(row => row.privacy === 'Public')
      .map(row => row.label.trim().toLowerCase())
  )
);

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatRippleModule,
    MatIconModule,
    MatSelectModule,
    SmartListComponent,
    SingleCardComponent,
    PairCardComponent,
    HomeGameFilterPopupComponent,
    CounterBadgePipe
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  private static readonly MOBILE_VIEWPORT_MAX_WIDTH_PX = 760;
  private static readonly PAIR_MODE_SPLIT_DEFAULT_PERCENT = 50;
  private static readonly PAIR_MODE_SPLIT_MIN_PERCENT = 0;
  private static readonly PAIR_MODE_SPLIT_MAX_PERCENT = 100;
  private static readonly GAME_STACK_PRELOAD_THRESHOLD = 2;
  private static readonly GAME_STACK_PAGE_SIZE_SINGLE = 10;
  private static readonly GAME_STACK_PAGE_SIZE_PAIR = 10;
  private static readonly GAME_STACK_PHOTO_PRELOAD_TARGET = 12;
  private static readonly GAME_RATING_CONFIRMATION_MS = 120;
  private readonly gameFilterInterestGroups: GameFilterOptionGroup[] = APP_STATIC_DATA.homeGameFilterInterestGroups;
  private readonly gameFilterValuesGroups: GameFilterOptionGroup[] = APP_STATIC_DATA.homeGameFilterValuesGroups;
  private readonly userFacetById: Record<string, GameUserFacet> = APP_STATIC_DATA.homeUserFacetById;
  protected readonly homeModeOptions: ReadonlyArray<HomeModeOption> = [
    { key: 'single', label: 'Preferences', icon: 'person' },
    { key: 'friends-in-common', label: 'Connected', icon: 'diversity_3' },
    { key: 'separated-friends', label: 'Unconnected', icon: 'group_add' },
    { key: 'pair', label: 'Outside Network', icon: 'groups' }
  ];
  private users: DemoUser[] = [];
  protected selectedRating = 0;
  protected selectedHomeMode: UserGameMode = 'single';
  protected leftSocialQuery = '';
  protected rightSocialQuery = '';
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
  protected gameInitialCardsLoadPending = false;
  protected candidateImageZoom = 1;
  protected candidateImagePanX = 0;
  protected candidateImagePanY = 0;
  protected localPopup: LocalPopup = null;
  protected activeUserId = '';
  protected gameFilter: GameFilterForm;
  protected gameFilterPopupContext: HomeGameFilterPopupContext | null = null;
  protected isGameFilterSaving = false;
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
  private homeSmartListQueryKey = '';
  private inFlightServiceCardStackReloadKey: string | null = null;
  private queuedServiceCardStackReloadKey: string | null = null;
  private initialServiceCardStackLoadPromise: Promise<void> | null = null;
  private isCandidateImageDragging = false;
  private candidateDragOffsetX = 0;
  private candidateDragOffsetY = 0;
  private activeTouchId: number | null = null;
  private pairModeSplitPointerId: number | null = null;
  private pairModeSplitBounds: { left: number; width: number } | null = null;
  private awaitingUserBootstrap = false;
  private awaitingUserByIdLoadingSeen = false;
  private lastHandledActiveUserId = '';

  @ViewChild('homeSmartList')
  private homeSmartList?: SmartListComponent<HomeSmartListRow, HomeSmartListFilters>;

  protected homeSmartListQueryReady = false;
  protected homeSmartListQuery: Partial<ListQuery<HomeSmartListFilters>> = {};
  protected readonly homeSmartListConfig: SmartListConfig<HomeSmartListRow, HomeSmartListFilters> = {
    pageSize: HomeComponent.GAME_STACK_PAGE_SIZE_SINGLE,
    mobilePageSizeCap: null,
    presentation: 'fullscreen',
    showBackgroundLoadingProgress: true,
    loadingDelayMs: resolveCurrentRouteDelayMs('/game-cards/query'),
    headerProgress: {
      enabled: true
    },
    trackBy: (_index, row) => row.id,
    emptyLabel: () => this.noCandidateTitle,
    emptyDescription: () => this.noCandidateDescription,
    pagination: {
      mode: 'rating-stars',
      ratingBarConfig: row => row ? this.gameRatingBarConfig : null,
      ratingBarValue: () => this.selectedRating,
      onRatingSelect: (row, score) => this.onHomeSmartListRatingSelect(row, score)
    }
  };
  protected readonly homeSmartListLoadPage: SmartListLoadPage<HomeSmartListRow, HomeSmartListFilters>
    = query => from(this.loadHomeSmartListPage(query));

  protected get isPairMode(): boolean {
    return this.selectedHomeMode === 'pair'
      || this.selectedHomeMode === 'separated-friends'
      || this.selectedHomeMode === 'friends-in-common';
  }

  private get isSyntheticPairMode(): boolean {
    return this.selectedHomeMode === 'pair';
  }

  protected get isSeparatedFriendsMode(): boolean {
    return this.selectedHomeMode === 'separated-friends';
  }

  protected get isFriendsInCommonMode(): boolean {
    return this.selectedHomeMode === 'friends-in-common';
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly activitiesContext: ActivitiesPopupStateService,
    private readonly appCtx: AppContext,
    private readonly gameService: GameService,
    private readonly usersService: UsersService
  ) {
    this.users = this.gameService.getGameCardsUsersSnapshot() as DemoUser[];
    this.activeUserId = this.getActiveUserId();
    const initialFilter = createInitialGameFilter(this.activeUser);
    this.gameFilter = cloneGameFilter(initialFilter);
    if (this.activeUserId) {
      this.lastHandledActiveUserId = this.activeUserId;
      this.handleActiveUserChanged(this.activeUserId);
    } else {
      this.syncHomeSmartListQuery();
      this.homeSmartListQueryReady = true;
    }
    const activeUserIdSignal = this.appCtx.activeUserId;
    const userByIdLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
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
      const activeProfile = this.appCtx.activeUserProfile();
      const alreadyLoaded = activeProfile?.id === this.activeUserId;
      if (status === 'loading') {
        this.awaitingUserByIdLoadingSeen = true;
        return;
      }
      const terminalStatus = status === 'success' || status === 'error' || status === 'timeout';
      if (status === 'idle' && !alreadyLoaded) {
        return;
      }
      if (!this.awaitingUserByIdLoadingSeen && !alreadyLoaded && !terminalStatus) {
        return;
      }
      if (activeProfile) {
        this.upsertHomeUser(activeProfile);
      }
      const previousReloadKey = this.serviceCardStackReloadKey();
      this.awaitingUserBootstrap = false;
      this.awaitingUserByIdLoadingSeen = false;
      this.applyFilterPreferencesFromAppContext();
      if (this.gameInitialCardsLoadPending) {
        if (previousReloadKey !== this.serviceCardStackReloadKey()) {
          this.resetServiceCardState();
          this.resetGameStackPaginationState(false);
        }
        this.syncHomeSmartListQuery();
        this.homeSmartListQueryReady = true;
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
  }

  protected get activeUser(): DemoUser {
    const localUser = this.users.find(user => user.id === this.activeUserId) ?? this.users[0] ?? null;
    const contextUser = this.appCtx.activeUserProfile();
    if (!localUser) {
      return contextUser ? this.toHomeUser(contextUser) : this.createFallbackActiveUser();
    }
    if (!contextUser || contextUser.id !== localUser.id) {
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
    const serviceStack = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId);
    const hasResolvedServiceStack = serviceStack.cardUserIds.length > 0
      || serviceStack.socialCards.length > 0
      || serviceStack.nextCursor !== null
      || serviceStack.filterCount !== null;
    if (this.isFriendsInCommonMode && hasResolvedServiceStack) {
      const usersById = new Map(this.users.map(user => [user.id, user] as const));
      return serviceStack.socialCards
        .map(card => usersById.get(card.userId))
        .filter((user): user is DemoUser => !!user);
    }
    if (!this.isPairMode && hasResolvedServiceStack) {
      const usersById = new Map(this.users.map(user => [user.id, user] as const));
      return serviceStack.cardUserIds
        .map(id => usersById.get(id))
        .filter((user): user is DemoUser => !!user);
    }
    const excludedUserIds = new Set(this.gameService.queryExcludedGameCardUserIds(this.activeUserId, this.selectedHomeMode));
    return this.users
      .filter(user => user.id !== this.activeUserId)
      .filter(user => !excludedUserIds.has(user.id))
      .filter(user => this.selectedHomeMode !== 'single' && !this.isSyntheticPairMode
        ? true
        : !this.gameService.didUsersMeet(this.activeUserId, user.id))
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
    if (this.isSeparatedFriendsMode || this.isFriendsInCommonMode) {
      return this.activeSocialPairRows().length > 0;
    }
    return this.candidatePool.length > 0;
  }

  protected get filterBadgeCount(): number {
    if (this.isSyntheticPairMode) {
      return Math.max(0, this.pairModeCycleSize());
    }
    const overrideTotal = this.gameService.peekUserGameCardsStackSnapshot(this.activeUser.id).filterCount;
    if (this.gameInitialCardsLoadPending) {
      if (overrideTotal === null) {
        return 0;
      }
      return Math.max(0, overrideTotal);
    }
    const fallback = Math.max(0, this.totalRoundsForCurrentMode() - this.cardIndex);
    if (overrideTotal === null) {
      return fallback;
    }
    return Math.max(0, overrideTotal);
  }

  protected get hasRemainingCandidatesForCurrentMode(): boolean {
    return this.filterBadgeCount > 0;
  }

  protected get isAwaitingMoreGameCards(): boolean {
    return this.gameStackPaginating;
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

  protected get ratingScale(): number[] {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  protected get gameRatingBarConfig(): RatingStarBarConfig {
    return {
      scale: this.ratingScale,
      presentation: 'fullscreen',
      blinkOnSelect: false,
      animation: this.isRatingBarBlinking ? 'blink' : 'default'
    };
  }

  protected get isFilterActive(): boolean {
    return isGameFilterActive(this.gameFilter, this.activeUser);
  }

  protected selectedHomeModeLabel(): string {
    return this.homeModeOptions.find(option => option.key === this.selectedHomeMode)?.label ?? 'Preferences';
  }

  protected selectedHomeModeIcon(): string {
    return this.homeModeOptions.find(option => option.key === this.selectedHomeMode)?.icon ?? 'person';
  }

  protected homeModeToneClass(mode: UserGameMode): string {
    const map: Record<UserGameMode, string> = {
      single: 'mode-single',
      pair: 'mode-pair',
      'separated-friends': 'mode-separated-friends',
      'friends-in-common': 'mode-friends-in-common'
    };
    return map[mode] ?? 'mode-single';
  }

  protected showSocialQueryInputs(): boolean {
    return this.isSeparatedFriendsMode || this.isFriendsInCommonMode;
  }

  protected socialQuerySuggestions(side: 'left' | 'right'): string[] {
    const values = new Set<string>();
    const socialCards = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId).socialCards;
    for (const card of socialCards) {
      const primaryUser = this.userById(card.userId);
      const secondaryUser = this.userById(side === 'left' ? card.userId : (card.secondaryUserId ?? card.bridgeUserId ?? ''));
      if (primaryUser?.name) {
        values.add(primaryUser.name);
      }
      if (secondaryUser?.name) {
        values.add(secondaryUser.name);
      }
      if (card.eventName?.trim()) {
        values.add(card.eventName.trim());
      }
    }
    return [...values].slice(0, 24);
  }

  protected homeSingleCard(
    row: HomeSmartListRow | null,
    options?: {
      presentation?: SingleCardData['presentation'];
      state?: SingleCardData['state'];
    }
  ): SingleCardData {
    const candidate = row?.mode === 'single' ? row.candidate : null;
    return {
      rowId: row?.id ?? 'home-single-empty',
      slides: this.homeCandidateSlides(candidate, row?.mode === 'single' ? row.socialCard : undefined),
      statusBadgeLabel: row?.mode === 'single' && row.socialCard
        ? this.homeSocialStatusBadge(row.socialCard)
        : this.candidateActivityBadge(candidate),
      presentation: options?.presentation ?? 'fullscreen',
      state: options?.state ?? 'default'
    };
  }

  protected homePairCard(
    row: HomeSmartListRow | null,
    options?: {
      presentation?: PairCardData['presentation'];
      state?: PairCardData['state'];
    }
  ): PairCardData {
    const round = row?.mode === 'pair' ? row.round : null;
    const presentation = options?.presentation ?? 'fullscreen';
    const isSocialPair = !!round?.socialCard;
    return {
      rowId: row?.id ?? 'home-pair-empty',
      stackClasses: ['activities-rate-profile-stack-pair'],
      slots: [
        this.homePairCardSlot(
          'woman',
          this.homePairSlotLabel(round?.socialCard, 'left'),
          round?.woman ?? null,
          round?.socialCard
        ),
        this.homePairCardSlot(
          'man',
          this.homePairSlotLabel(round?.socialCard, 'right'),
          round?.man ?? null,
          round?.socialCard
        )
      ],
      presentation,
      state: options?.state ?? 'default',
      split: presentation === 'fullscreen'
        ? { enabled: true }
        : null
    };
  }

  protected onHomeSmartListStateChange(change: SmartListStateChange<HomeSmartListRow, HomeSmartListFilters>): void {
    const cursorChanged = change.cursorIndex !== this.cardIndex;
    this.cardIndex = change.cursorIndex;
    this.gameStackCardsLoaded = change.items.length;
    if (cursorChanged) {
      this.clearPendingRatingAdvanceTimer();
    }
    if (change.loading || change.initialLoading || this.gameInitialCardsLoadPending) {
      return;
    }
    this.maybeStartGameStackPaginationLoad();
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

  protected selectHomeMode(mode: UserGameMode): void {
    const normalizedMode = this.normalizeHomeMode(mode);
    if (this.selectedHomeMode === normalizedMode) {
      return;
    }
    this.stopPairModeSplitDrag();
    this.selectedHomeMode = normalizedMode;
    this.appCtx.clearUserFilterCountOverride(this.activeUserId);
    this.resetServiceCardState();
    this.cardIndex = 0;
    this.leftSocialQuery = '';
    this.rightSocialQuery = '';
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.syncHomeSmartListQuery();
    this.gameInitialCardsLoadPending = true;
    if (this.homeSmartList) {
      this.homeSmartList.reload();
      return;
    }
    void this.reloadServiceCardStack();
  }

  protected onLeftSocialQueryChanged(value: string): void {
    this.leftSocialQuery = value.trimStart();
    this.reloadSocialModeCards();
  }

  protected onRightSocialQueryChanged(value: string): void {
    this.rightSocialQuery = value.trimStart();
    this.reloadSocialModeCards();
  }

  protected openHistory(): void {
    if (!this.canOpenHistory) {
      return;
    }
    const initialRateFilter = this.isPairMode ? 'pair-given' : 'individual-given';
    this.activitiesContext.openActivities(
      'rates',
      undefined,
      initialRateFilter,
      this.isSeparatedFriendsMode || this.isFriendsInCommonMode
    );
  }

  protected closeLocalPopup(): void {
    this.localPopup = null;
    this.gameFilterPopupContext = null;
  }

  protected openFilter(): void {
    this.gameFilterPopupContext = this.createGameFilterPopupContext();
    this.localPopup = 'filter';
  }

  protected async onGameFilterPopupClosed(filter: GameFilterForm | null): Promise<void> {
    if (!filter) {
      if (this.isGameFilterSaving) {
        return;
      }
      this.gameFilterPopupContext = null;
      this.localPopup = null;
      return;
    }
    this.gameFilter = normalizeGameFilter(filter);
    this.isGameFilterSaving = true;
    this.cdr.markForCheck();
    try {
      await this.usersService.saveUserFilterPreferences(this.activeUserId, this.gameFilter);
    } finally {
      this.isGameFilterSaving = false;
    }
    this.gameFilterPopupContext = null;
    this.localPopup = null;
    this.appCtx.clearUserFilterCountOverride(this.activeUserId);
    this.resetServiceCardState();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.syncHomeSmartListQuery();
    this.gameInitialCardsLoadPending = true;
    if (this.homeSmartList) {
      this.homeSmartList.reload();
      return;
    }
    void this.reloadServiceCardStack();
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
    this.localPopup = null;
    this.gameFilterPopupContext = null;
    this.resetServiceCardState();
    const initialFilter = createInitialGameFilter(this.activeUser);
    this.gameFilter = cloneGameFilter(initialFilter);
    this.applyFilterPreferencesFromAppContext();
    this.homeSmartListQueryReady = false;
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.gameInitialCardsLoadPending = true;
    this.awaitingUserBootstrap = true;
    this.awaitingUserByIdLoadingSeen = false;
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
    const next = this.appCtx.resolveUserFilterPreferences(this.activeUserId, createInitialGameFilter(this.activeUser));
    this.gameFilter = normalizeGameFilter(next);
  }

  private gameFilterForRequest(): GameFilterForm | null {
    return this.gameFilter;
  }

  private async reloadServiceCardStack(): Promise<void> {
    const reloadKey = this.serviceCardStackReloadKey();
    if (this.gameService.isUserGameCardsStackRequestInFlight(this.activeUserId)) {
      if (this.inFlightServiceCardStackReloadKey !== reloadKey) {
        this.queuedServiceCardStackReloadKey = reloadKey;
      }
      return;
    }
    const requestUserId = this.activeUserId;
    this.inFlightServiceCardStackReloadKey = reloadKey;
    this.queuedServiceCardStackReloadKey = null;
    const shouldReloadSmartList = this.gameInitialCardsLoadPending === false;
    try {
      const serviceStack = await this.gameService.loadInitialUserGameCardsStackPage(
        this.activeUserId,
        this.gameFilterForRequest(),
        this.gameStackPageSizeForCurrentMode(),
        this.selectedHomeMode,
        this.leftSocialQuery.trim() || null,
        this.rightSocialQuery.trim() || null
      );
      if (requestUserId !== this.activeUserId) {
        return;
      }
      if (reloadKey !== this.serviceCardStackReloadKey()) {
        this.queuedServiceCardStackReloadKey = this.serviceCardStackReloadKey();
        return;
      }
      this.mergeGameStackUsersIntoHomeUsers();
      this.syncGameStackLoadedStateFromSnapshot(serviceStack);
      this.preloadGameImageWindow();
      if (!this.queuedServiceCardStackReloadKey) {
        this.gameInitialCardsLoadPending = false;
      }
      if (shouldReloadSmartList && !this.queuedServiceCardStackReloadKey) {
        this.homeSmartList?.reload();
      }
    } finally {
      this.inFlightServiceCardStackReloadKey = null;
      const queuedReloadKey = requestUserId === this.activeUserId
        ? this.queuedServiceCardStackReloadKey
        : null;
      if (!queuedReloadKey) {
        this.gameInitialCardsLoadPending = false;
      }
      this.cdr.markForCheck();
      if (queuedReloadKey) {
        this.queuedServiceCardStackReloadKey = null;
        if (queuedReloadKey !== reloadKey) {
          this.resetServiceCardState();
          this.resetGameStackPaginationState(false);
          this.syncHomeSmartListQuery();
        }
        void this.reloadServiceCardStack();
      }
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
    const activeUserId = this.appCtx.activeUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
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

  private syncHomeSmartListQuery(): void {
    const filterKey = JSON.stringify({
      gameFilter: this.gameFilter,
      leftSocialQuery: this.leftSocialQuery.trim(),
      rightSocialQuery: this.rightSocialQuery.trim()
    });
    const queryKey = `${this.activeUserId}|${this.selectedHomeMode}|${filterKey}`;
    if (this.homeSmartListQueryKey === queryKey) {
      return;
    }
    this.homeSmartListQueryKey = queryKey;
    this.homeSmartListQuery = {
      filters: {
        activeUserId: this.activeUserId,
        mode: this.selectedHomeMode,
        filterKey
      }
    };
  }

  private async loadHomeSmartListPage(
    query: ListQuery<HomeSmartListFilters>
  ): Promise<PageResult<HomeSmartListRow>> {
    if (!query.filters?.activeUserId?.trim()) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    await this.waitForInitialHomeGameStack(query);
    await this.ensureHomeSmartListRowsAvailable(query);
    const rows = this.homeSmartListRows();
    const pageSize = Number.isFinite(query.pageSize)
      ? Math.max(1, Math.trunc(Number(query.pageSize)))
      : this.gameStackPageSizeForCurrentMode();
    const startIndex = Math.max(0, query.page) * pageSize;
    const endIndex = startIndex + pageSize;
    const total = this.totalRoundsForCurrentMode();
    return {
      items: rows.slice(startIndex, endIndex),
      total,
      nextCursor: endIndex < total ? String(endIndex) : null
    };
  }

  private async waitForInitialHomeGameStack(query: ListQuery<HomeSmartListFilters>): Promise<void> {
    if (this.awaitingUserBootstrap && query.page === 0) {
      while (this.awaitingUserBootstrap) {
        await this.waitForHomeGameStackTick();
      }
    }
    if (this.isSyntheticPairMode || query.page > 0 || this.gameInitialCardsLoadPending === false) {
      return;
    }
    await this.ensureInitialServiceCardStackLoaded();
  }

  private async ensureInitialServiceCardStackLoaded(): Promise<void> {
    if (!this.gameInitialCardsLoadPending) {
      return;
    }
    if (!this.initialServiceCardStackLoadPromise) {
      this.initialServiceCardStackLoadPromise = this.reloadServiceCardStack()
        .finally(() => {
          this.initialServiceCardStackLoadPromise = null;
        });
    }
    await this.initialServiceCardStackLoadPromise;
  }

  private waitForHomeGameStackTick(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => resolve(), 16);
    });
  }

  private async ensureHomeSmartListRowsAvailable(query: ListQuery<HomeSmartListFilters>): Promise<void> {
    if (this.isSyntheticPairMode || !this.gameService.shouldUseUserGameCardsStack(this.activeUserId)) {
      return;
    }
    const pageSize = Number.isFinite(query.pageSize)
      ? Math.max(1, Math.trunc(Number(query.pageSize)))
      : this.gameStackPageSizeForCurrentMode();
    const requiredCount = (Math.max(0, query.page) + 1) * pageSize;
    while (this.availableServiceRowsCount() < requiredCount) {
      const snapshot = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId);
      if (snapshot.requestInFlight) {
        await this.waitForHomeGameStackTick();
        continue;
      }
      if (snapshot.nextCursor === null && !this.hasUnloadedRemainingServiceRows(snapshot)) {
        return;
      }
      await this.gameService.loadNextUserGameCardsStackPage(
        this.activeUserId,
        this.gameFilterForRequest(),
        this.gameStackPageSizeForCurrentMode(),
        this.selectedHomeMode,
        this.leftSocialQuery.trim() || null,
        this.rightSocialQuery.trim() || null
      );
      this.mergeGameStackUsersIntoHomeUsers();
    }
  }

  private loadedServiceRowsCount(serviceStack: {
    cardUserIds: string[];
    socialCards: { id: string }[];
  }): number {
    return this.isSeparatedFriendsMode || this.isFriendsInCommonMode
      ? serviceStack.socialCards.length
      : serviceStack.cardUserIds.length;
  }

  private loadedRemainingServiceRowsCount(serviceStack: {
    filterCount: number | null;
    cardUserIds: string[];
    socialCards: UserGameSocialCard[];
  }): number {
    if (this.isSeparatedFriendsMode || this.isFriendsInCommonMode) {
      const ratedPairKeys = new Set(this.gameService.queryExcludedGameCardPairKeys(this.activeUserId));
      return serviceStack.socialCards.filter(card => {
        const secondUserId = card.secondaryUserId?.trim() || card.bridgeUserId?.trim() || '';
        return !ratedPairKeys.has(this.sortedHomePairKey(card.userId, secondUserId));
      }).length;
    }
    const excludedUserIds = new Set(this.gameService.queryExcludedGameCardUserIds(this.activeUserId, this.selectedHomeMode));
    return serviceStack.cardUserIds.filter(id => !excludedUserIds.has(id.trim())).length;
  }

  private hasUnloadedRemainingServiceRows(serviceStack: {
    filterCount: number | null;
    cardUserIds: string[];
    socialCards: UserGameSocialCard[];
  }): boolean {
    if (serviceStack.filterCount === null) {
      return false;
    }
    return serviceStack.filterCount > this.loadedRemainingServiceRowsCount(serviceStack);
  }

  private availableServiceRowsCount(): number {
    const snapshot = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId);
    if (this.isSeparatedFriendsMode || this.isFriendsInCommonMode) {
      return snapshot.socialCards.length;
    }
    return this.candidatePool.length;
  }

  private homeSmartListRows(): HomeSmartListRow[] {
    if (this.isSeparatedFriendsMode || this.isFriendsInCommonMode) {
      return this.activeSocialPairRows();
    }
    if (this.isPairMode) {
      return this.pairModeRounds().map((round, index) => ({
        id: round.socialCard?.id ?? `pair:${round.woman?.id ?? 'none'}:${round.man?.id ?? 'none'}:${index}`,
        mode: 'pair',
        round
      }));
    }
    return this.candidatePool.map(candidate => ({
      id: `single:${candidate.id}`,
      mode: 'single',
      candidate
    }));
  }

  private async onHomeSmartListRatingSelect(row: HomeSmartListRow | null, score: number): Promise<void> {
    if (!row || this.ratingAdvanceTimer) {
      return;
    }
    if (row.mode === 'pair') {
      const woman = row.round.woman;
      const man = row.round.man;
      if (!woman || !man) {
        return;
      }
      this.gameService.recordUserGameCardPairRating(this.activeUserId, woman.id, man.id, score);
    } else {
      this.gameService.recordUserGameCardRating(this.activeUserId, row.candidate.id, score, 'single');
    }
    const ratedRowId = row.id;
    this.selectedRating = score;
    this.triggerRatingBarBlink();
    this.ratingAdvanceTimer = setTimeout(() => {
      this.ratingAdvanceTimer = null;
      if (this.homeSmartList?.cursorItem()?.id === ratedRowId) {
        this.selectedRating = 0;
        this.cdr.markForCheck();
      }
    }, HomeComponent.GAME_RATING_CONFIRMATION_MS + 24);
  }

  private homeCandidateSlides(candidate: DemoUser | null): SingleCardData['slides'];
  private homeCandidateSlides(candidate: DemoUser | null, socialCard: UserGameSocialCard | undefined): SingleCardData['slides'];
  private homeCandidateSlides(
    candidate: DemoUser | null,
    socialCard?: UserGameSocialCard
  ): SingleCardData['slides'] {
    if (!candidate) {
      return [{
        imageUrl: '',
        primaryLine: 'No card available',
        secondaryLine: 'Adjust filters to load more profiles',
        placeholderLabel: '∅'
      }];
    }
    const overlays = this.gameCardOverlayCards(candidate);
    const initials = this.initialsForCandidate(candidate);
    return this.imageStackForCandidate(candidate).map((imageUrl, index) => {
      const overlay = overlays[index] ?? overlays[0] ?? null;
      return {
        imageUrl,
        primaryLine: overlay?.primary ?? this.homeCandidatePrimaryLine(candidate, socialCard),
        secondaryLine: this.homeCandidateSecondaryLine(candidate, socialCard, overlay?.secondary),
        placeholderLabel: initials
      };
    });
  }

  private homePairCardSlot(
    gender: DemoUser['gender'],
    label: string,
    candidate: DemoUser | null,
    socialCard?: UserGameSocialCard
  ): PairCardData['slots'][number] {
    return {
      key: gender,
      label,
      tone: gender,
      slides: this.homeCandidateSlides(candidate, socialCard),
      statusBadgeLabel: socialCard ? this.homeSocialStatusBadge(socialCard) : this.candidateActivityBadge(candidate)
    };
  }

  private socialPairRows(): HomePairSmartListRow[] {
    return this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId).socialCards
      .filter(card => card.socialContext === 'separated-friends')
      .map(card => ({
        id: card.id,
        mode: 'pair' as const,
        round: {
          woman: this.userById(card.userId),
          man: this.userById(card.secondaryUserId ?? ''),
          socialCard: card
        }
      }))
      .filter(row => !!row.round.woman && !!row.round.man);
  }

  private socialFriendsInCommonPairRows(): HomePairSmartListRow[] {
    return this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId).socialCards
      .filter(card => card.socialContext === 'friends-in-common')
      .map(card => ({
        id: card.id,
        mode: 'pair' as const,
        round: {
          woman: this.userById(card.userId),
          man: this.userById(card.bridgeUserId ?? ''),
          socialCard: card
        }
      }))
      .filter(row => !!row.round.woman && !!row.round.man);
  }

  private activeSocialPairRows(): HomePairSmartListRow[] {
    return this.isFriendsInCommonMode
      ? this.socialFriendsInCommonPairRows()
      : this.socialPairRows();
  }

  private sortedHomePairKey(leftUserId: string, rightUserId: string): string {
    return [leftUserId.trim(), rightUserId.trim()]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }

  private userById(userId: string): DemoUser | null {
    return this.users.find(user => user.id === userId) ?? null;
  }

  private homeSocialStatusBadge(card: UserGameSocialCard): string {
    return card.socialContext === 'friends-in-common' ? 'Connected' : 'Unconnected';
  }

  private homePairSlotLabel(
    socialCard: UserGameSocialCard | undefined,
    side: 'left' | 'right'
  ): string {
    if (!socialCard) {
      return side === 'left' ? 'Person A' : 'Person B';
    }
    if (socialCard.socialContext === 'friends-in-common') {
      return side === 'left' ? 'Person' : 'Common friend';
    }
    return side === 'left' ? 'Friend A' : 'Friend B';
  }

  private homeCandidatePrimaryLine(candidate: DemoUser, socialCard?: UserGameSocialCard): string {
    if (socialCard?.socialContext === 'friends-in-common') {
      return `${candidate.name}, ${candidate.age}`;
    }
    return `${candidate.name}, ${candidate.age}`;
  }

  private homeCandidateSecondaryLine(
    candidate: DemoUser,
    socialCard: UserGameSocialCard | undefined,
    fallback: string | null | undefined
  ): string {
    if (socialCard?.socialContext === 'friends-in-common') {
      const bridgeName = this.userById(socialCard.bridgeUserId ?? '')?.name ?? 'Shared friend';
      return socialCard.eventName?.trim()
        ? `${bridgeName} · ${socialCard.eventName.trim()}`
        : `${bridgeName} · ${candidate.city}`;
    }
    if (socialCard?.socialContext === 'separated-friends') {
      return socialCard.eventName?.trim() || fallback || candidate.city;
    }
    return fallback || candidate.city;
  }

  private reloadSocialModeCards(): void {
    if (!this.isSeparatedFriendsMode && !this.isFriendsInCommonMode) {
      return;
    }
    this.appCtx.clearUserFilterCountOverride(this.activeUserId);
    this.resetServiceCardState();
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.resetGameStackPaginationState(false);
    this.syncHomeSmartListQuery();
    this.gameInitialCardsLoadPending = true;
    void this.reloadServiceCardStack();
  }

  private normalizeHomeMode(mode: UserGameMode | string | null | undefined): UserGameMode {
    return mode === 'pair'
      || mode === 'separated-friends'
      || mode === 'friends-in-common'
      ? mode
      : 'single';
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

  private createGameFilterPopupContext(): HomeGameFilterPopupContext {
    return {
      activeUser: this.activeUser,
      filter: cloneGameFilter(this.gameFilter),
      users: this.users,
      userFacets: this.userFacetById,
      interestOptionGroups: this.gameFilterInterestGroups,
      valueOptionGroups: this.gameFilterValuesGroups
    };
  }

  private matchesFilter(user: DemoUser): boolean {
    return this.matchesUserWithFilter(user, this.gameFilter);
  }

  private matchesUserWithFilter(user: DemoUser, filter: GameFilterForm): boolean {
    if (user.age < filter.ageMin || user.age > filter.ageMax) {
      return false;
    }
    const userHeight = parseGameHeightCm(user.height);
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

  private userInterests(user: DemoUser): string[] {
    return getGameUserInterests(user, this.userFacetById);
  }

  private userValues(user: DemoUser): string[] {
    return getGameUserValues(user, this.userFacetById);
  }

  private userFacet(user: DemoUser): GameUserFacet {
    return getGameUserFacet(user, this.userFacetById);
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
    if (this.isSeparatedFriendsMode || this.isFriendsInCommonMode) {
      return this.activeSocialPairRows().map(row => row.round);
    }
    const excludedPairKeys = new Set(this.gameService.queryExcludedGameCardPairKeys(this.activeUserId));
    const candidates = this.candidatePool;
    const rounds: PairModeRoundState[] = [];
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
        const left = candidates[leftIndex] ?? null;
        const right = candidates[rightIndex] ?? null;
        if (
          !left
          || !right
          || excludedPairKeys.has(this.sortedHomePairKey(left.id, right.id))
          || this.gameService.didUsersMeet(left.id, right.id)
        ) {
          continue;
        }
        rounds.push({
          woman: left,
          man: right
        });
      }
    }
    return rounds;
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
    if (this.isSyntheticPairMode) {
      return this.pairModeCycleSize();
    }
    const serviceStack = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId);
    if (serviceStack.cardUserIds.length > 0 || serviceStack.socialCards.length > 0 || serviceStack.nextCursor !== null) {
      const loadedCount = this.loadedServiceRowsCount(serviceStack);
      if (serviceStack.filterCount !== null) {
        const unloadedRemainingCount = Math.max(
          0,
          serviceStack.filterCount - this.loadedRemainingServiceRowsCount(serviceStack)
        );
        return loadedCount + unloadedRemainingCount;
      }
      return loadedCount + (serviceStack.nextCursor !== null ? 1 : 0);
    }
    return this.candidatePool.length;
  }

  private gameStackPaginationStateKey(): string {
    const filterKey = JSON.stringify({
      gameFilter: this.gameFilter,
      leftSocialQuery: this.leftSocialQuery.trim(),
      rightSocialQuery: this.rightSocialQuery.trim()
    });
    return `${this.activeUserId}|${this.selectedHomeMode}|${filterKey}`;
  }

  private serviceCardStackReloadKey(): string {
    return this.gameStackPaginationStateKey();
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
    this.gameStackPaginationKey = this.gameStackPaginationStateKey();
    this.gameStackExhausted = false;
    const totalRounds = this.totalRoundsForCurrentMode();
    this.gameStackCardsLoaded = loadFirstPageImmediately
      ? Math.min(totalRounds, this.gameStackPageSizeForCurrentMode())
      : 0;
    this.cardIndex = Math.min(this.cardIndex, this.gameStackCardsLoaded);
    this.cdr.markForCheck();
  }

  private syncGameStackLoadedStateFromSnapshot(serviceStack: {
    cardUserIds: string[];
    socialCards: { id: string }[];
    nextCursor: string | null;
  }): void {
    this.cancelGameStackPaginationLoad();
    this.gameStackPaginationKey = this.gameStackPaginationStateKey();
    const loadedCount = this.isSeparatedFriendsMode || this.isFriendsInCommonMode
      ? serviceStack.socialCards.length
      : serviceStack.cardUserIds.length;
    this.gameStackCardsLoaded = loadedCount;
    this.gameStackExhausted = loadedCount <= 0 && serviceStack.nextCursor === null;
    this.cardIndex = Math.min(this.cardIndex, this.gameStackCardsLoaded);
    this.cdr.markForCheck();
  }


  private maybeStartGameStackPaginationLoad(): void {
    const stateKey = this.gameStackPaginationStateKey();
    if (stateKey !== this.gameStackPaginationKey) {
      this.resetGameStackPaginationState();
    }
    if (this.gameStackPaginating) {
      return;
    }
    if (!this.canAttemptGameStackLoad()) {
      this.gameStackExhausted = true;
      return;
    }
    const remainingCards = Math.max(0, this.gameStackCardsLoaded - (this.cardIndex + 1));
    if (remainingCards > HomeComponent.GAME_STACK_PRELOAD_THRESHOLD) {
      return;
    }
    if (this.gameStackExhausted || !this.hasMoreRoundsForCurrentMode()) {
      this.gameStackExhausted = true;
      return;
    }
    this.startGameStackPaginationLoad();
  }

  private startGameStackPaginationLoad(): void {
    if (!this.isSyntheticPairMode && this.gameService.shouldUseUserGameCardsStack(this.activeUserId)) {
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
    if (!this.hasMoreRoundsForCurrentMode()) {
      this.gameStackExhausted = true;
      return;
    }
    this.gameStackPaginating = true;
    const finalizePaginationLoad = () => {
      const totalRounds = this.totalRoundsForCurrentMode();
      const previousLoaded = this.gameStackCardsLoaded;
      this.gameStackCardsLoaded = Math.min(totalRounds, this.gameStackCardsLoaded + this.gameStackPageSizeForCurrentMode());
      const loadedMoreCards = this.gameStackCardsLoaded > previousLoaded;
      this.gameStackExhausted = !loadedMoreCards;
      this.gameStackPaginating = false;
      this.preloadGameImageWindow();
      this.beginCandidateImageLoadingForCurrentSelection(true);
      this.cdr.markForCheck();
    };
    finalizePaginationLoad();
  }

  private startServiceCardPaginationLoad(): void {
    if (this.gameStackPaginating || this.gameService.isUserGameCardsStackRequestInFlight(this.activeUserId)) {
      return;
    }
    const serviceStackBefore = this.gameService.peekUserGameCardsStackSnapshot(this.activeUserId);
    if (!serviceStackBefore.nextCursor && (serviceStackBefore.cardUserIds.length > 0 || serviceStackBefore.socialCards.length > 0)) {
      this.gameStackExhausted = true;
      return;
    }

    this.gameStackPaginating = true;
    void this.gameService.loadNextUserGameCardsStackPage(
      this.activeUserId,
      this.gameFilter,
      this.gameStackPageSizeForCurrentMode(),
      this.selectedHomeMode,
      this.leftSocialQuery.trim() || null,
      this.rightSocialQuery.trim() || null
    ).then(serviceStack => {
      this.mergeGameStackUsersIntoHomeUsers();
      const previousLoaded = this.gameStackCardsLoaded;
      const totalRounds = this.totalRoundsForCurrentMode();
      const loadedCount = this.isSeparatedFriendsMode || this.isFriendsInCommonMode
        ? serviceStack.socialCards.length
        : serviceStack.cardUserIds.length;
      this.gameStackCardsLoaded = Math.min(totalRounds, loadedCount);
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
    this.gameStackPaginating = false;
  }

  private canAttemptGameStackLoad(): boolean {
    if (this.isPairMode) {
      return this.pairModeCycleSize() > 0;
    }
    return this.candidatePool.length > 0;
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

  private upsertHomeUser(user: UserDto): void {
    const nextUser = this.toHomeUser(user);
    const existingIndex = this.users.findIndex(item => item.id === nextUser.id);
    if (existingIndex >= 0) {
      this.users = this.users.map((item, index) => index === existingIndex ? nextUser : item);
      return;
    }
    this.users = [nextUser, ...this.users];
  }

  private mergeGameStackUsersIntoHomeUsers(): void {
    const snapshotUsers = this.gameService.getGameCardsUsersSnapshot() as DemoUser[];
    if (snapshotUsers.length === 0) {
      return;
    }

    const byId = new Map(this.users.map(user => [user.id, user] as const));
    for (const user of snapshotUsers) {
      byId.set(user.id, user);
    }
    this.users = Array.from(byId.values());
  }

  private toHomeUser(user: UserDto): DemoUser {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0
      }
    };
  }

  private createFallbackActiveUser(): DemoUser {
    return {
      id: this.activeUserId || this.appCtx.activeUserId().trim(),
      name: '',
      age: 30,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: '',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      affinity: 0,
      locationCoordinates: undefined,
      images: [],
      impressions: undefined,
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      }
    };
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

  private hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }
}
