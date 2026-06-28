import {
  Injectable,
  inject
} from '@angular/core';

import {
  type LoadStatus
} from '../../../ui/context';
import type {
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserGameSocialCard,
  UserGameCardsStackSnapshot,
  UserGameDataService,
  UserGameMode
} from '../../contracts/activity.interface';
import {
  LocalGameService
} from '../../local';
import {
  LocalRatesRepository
} from '../../local/source/repositories/rates.repository';
import {
  HttpGameService
} from '../../http';
import type { UserDto } from '../../contracts/user.interface';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import {
  RateOutboxService
} from './rate-outbox.service';
import { AppRuntimeStore } from '../../../ui/context/stores/app-runtime.store';

export const USER_GAME_CARDS_LOAD_CONTEXT_KEY = 'user-game-cards';

interface UserGameCardsStackState {
  filterCount: number | null;
  cardUserIds: string[];
  socialCards: UserGameSocialCard[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GameService extends BaseRouteModeService {
  private static readonly USER_RATES_OUTBOX_SYNC_INTERVAL_MS = 30000;
  private static readonly USER_RATES_OUTBOX_SYNC_BATCH_SIZE = 50;
  private readonly localGameService = inject(LocalGameService);
  private readonly localRatesRepository = inject(LocalRatesRepository);
  private readonly httpGameService = inject(HttpGameService);
  private readonly rateOutboxService = inject(RateOutboxService);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly userGameCardsStackStateByUserId: Record<string, UserGameCardsStackState> = {};
  private userRatesOutboxSyncInFlight = false;
  private userRatesOutboxSyncTimer: ReturnType<typeof setInterval> | null = null;
  private userRatesOutboxSyncKickTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.startUserRatesOutboxSyncLoop();
  }

  private get gameDataService(): UserGameDataService {
    return this.resolveRouteService('/game-cards/query', this.localGameService, this.httpGameService);
  }

  getGameCardsUsersSnapshot(): UserDto[] {
    return this.gameDataService.queryGameCardsUsersSnapshot();
  }

  didUsersMeet(leftUserId: string, rightUserId: string): boolean {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (
      !normalizedLeftUserId
      || !normalizedRightUserId
      || normalizedLeftUserId === normalizedRightUserId
    ) {
      return false;
    }
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localGameService.didUsersMeet(normalizedLeftUserId, normalizedRightUserId);
    }
    return false;
  }

  queryMetUserIds(userId: string): string[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (this.isLocalRouteEnabled('/activities/events')) {
      return this.localGameService.queryMetUserIds(normalizedUserId);
    }
    return [];
  }

  queryExcludedGameCardUserIds(userId: string, mode: UserGameMode = 'single'): string[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (mode !== 'single' && mode !== 'friends-in-common') {
      return [];
    }
    if (this.isLocalRouteEnabled('/activities/rates')) {
      return this.localRatesRepository.queryRatedGameCardUserIds(normalizedUserId, 'single');
    }
    return this.rateOutboxService.queryPendingRatedGameCardUserIds(normalizedUserId, 'single');
  }

  queryExcludedGameCardPairKeys(userId: string): string[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (this.isLocalRouteEnabled('/activities/rates')) {
      return this.localRatesRepository.queryRatedGameCardPairKeys(normalizedUserId);
    }
    return this.rateOutboxService.queryPendingRatedGameCardPairKeys(normalizedUserId);
  }

  recordUserGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single',
    socialContext?: UserGameSocialCard['socialContext'],
    bridgeUserId?: string,
    bridgeCount?: number
  ): void {
    this.rateOutboxService.enqueueGameCardRatingOutbox(
      raterUserId,
      ratedUserId,
      rating,
      mode,
      socialContext,
      bridgeUserId,
      bridgeCount
    );
    this.decrementUserGameCardsStackFilterCount(raterUserId);
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  recordUserGameCardPairRating(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number,
    socialContext?: UserGameSocialCard['socialContext']
  ): void {
    const normalizedFirstId = firstRatedUserId.trim();
    const normalizedSecondId = secondRatedUserId.trim();
    if (!normalizedFirstId || !normalizedSecondId) {
      return;
    }
    this.rateOutboxService.enqueueGameCardPairRatingOutbox(
      raterUserId,
      normalizedFirstId,
      normalizedSecondId,
      rating,
      socialContext
    );
    this.decrementUserGameCardsStackFilterCount(raterUserId);
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  kickUserRatesOutboxSync(): void {
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  async loadUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null> {
    if (this.isLocalRouteEnabled('/game-cards/query')) {
      await this.localGameService.whenReady();
    }
    const normalizedUserId = request.userId.trim();

    if (!normalizedUserId) {
      this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.gameDataService.queryUserGameCardsByFilter(
        {
          userId: normalizedUserId,
          mode: request.mode ?? 'single',
          leftQuery: request.leftQuery ?? null,
          rightQuery: request.rightQuery ?? null,
          filterPreferences: request.filterPreferences ?? null,
          cursor: request.cursor ?? null,
          pageSize: request.pageSize
        },
        requestTimeoutMs
      );
      if (!response.cards) {
        this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'success');
        return null;
      }
      this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'success');
      return {
        filterCount: Math.max(0, Math.trunc(Number(response.cards.filterCount) || 0)),
        cardUserIds: (response.cards.cardUserIds ?? [])
          .map(id => id.trim())
          .filter(id => id.length > 0),
        socialCards: (response.cards.socialCards ?? [])
          .map(card => ({
            ...card,
            id: card.id.trim(),
            userId: card.userId.trim(),
            secondaryUserId: card.secondaryUserId?.trim() || undefined,
            bridgeUserId: card.bridgeUserId?.trim() || undefined,
            eventName: card.eventName?.trim() || undefined
          }))
          .filter(card => card.id.length > 0 && card.userId.length > 0),
        nextCursor: typeof response.cards.nextCursor === 'string' && response.cards.nextCursor.trim().length > 0
          ? response.cards.nextCursor.trim()
          : null
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'User game cards request timeout.') {
        this.setLoadStatus(
          USER_GAME_CARDS_LOAD_CONTEXT_KEY,
          'timeout',
          'User game cards request timeout.'
        );
        return null;
      }
      this.setLoadStatus(
        USER_GAME_CARDS_LOAD_CONTEXT_KEY,
        'error',
        'Unable to load user game cards.'
      );
      return null;
    }
  }

  async loadUserGameCardsPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    cursor: UserGameCardsQueryRequest['cursor'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    mode: UserGameCardsQueryRequest['mode'] = 'single',
    leftQuery: UserGameCardsQueryRequest['leftQuery'] = null,
    rightQuery: UserGameCardsQueryRequest['rightQuery'] = null,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null> {
    return this.loadUserGameCardsByFilter(
      {
        userId,
        mode,
        leftQuery,
        rightQuery,
        filterPreferences: filterPreferences ?? null,
        cursor: cursor ?? null,
        pageSize
      },
      requestTimeoutMs
    );
  }

  getUserGameCardsStackSnapshot(userId: string): UserGameCardsStackSnapshot {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        filterCount: null,
        cardUserIds: [],
        socialCards: [],
        nextCursor: null,
        requestInFlight: false
      };
    }
    const state = this.ensureUserGameCardsStackState(normalizedUserId);
    return {
      filterCount: state.filterCount,
      cardUserIds: [...state.cardUserIds],
      socialCards: state.socialCards.map(card => ({ ...card })),
      nextCursor: state.nextCursor,
      requestInFlight: state.requestInFlight
    };
  }

  peekUserGameCardsStackSnapshot(userId: string): UserGameCardsStackSnapshot {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        filterCount: null,
        cardUserIds: [],
        socialCards: [],
        nextCursor: null,
        requestInFlight: false
      };
    }
    return this.ensureUserGameCardsStackState(normalizedUserId);
  }

  resetUserGameCardsStack(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.userGameCardsStackStateByUserId[normalizedUserId] = {
      filterCount: null,
      cardUserIds: [],
      socialCards: [],
      nextCursor: null,
      requestInFlight: false
    };
  }

  isUserGameCardsStackRequestInFlight(userId: string): boolean {
    return this.peekUserGameCardsStackSnapshot(userId).requestInFlight;
  }

  shouldUseUserGameCardsStack(userId: string): boolean {
    const snapshot = this.peekUserGameCardsStackSnapshot(userId);
    return snapshot.cardUserIds.length > 0
      || snapshot.socialCards.length > 0
      || snapshot.nextCursor !== null
      || snapshot.filterCount !== null;
  }

  private decrementUserGameCardsStackFilterCount(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const state = this.userGameCardsStackStateByUserId[normalizedUserId];
    if (!state || state.filterCount === null) {
      return;
    }
    state.filterCount = Math.max(0, state.filterCount - 1);
  }

  private mergeUserGameCardsStackFilterCount(
    currentFilterCount: number | null,
    nextFilterCount: number,
    reset: boolean
  ): number {
    const normalizedNextCount = Math.max(0, Math.trunc(Number(nextFilterCount) || 0));
    if (reset || currentFilterCount === null) {
      return normalizedNextCount;
    }
    return Math.min(currentFilterCount, normalizedNextCount);
  }

  async loadInitialUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    mode: UserGameCardsQueryRequest['mode'] = 'single',
    leftQuery: UserGameCardsQueryRequest['leftQuery'] = null,
    rightQuery: UserGameCardsQueryRequest['rightQuery'] = null,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot> {
    return this.loadUserGameCardsStackPage(userId, filterPreferences, pageSize, true, mode, leftQuery, rightQuery, requestTimeoutMs);
  }

  async loadNextUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    mode: UserGameCardsQueryRequest['mode'] = 'single',
    leftQuery: UserGameCardsQueryRequest['leftQuery'] = null,
    rightQuery: UserGameCardsQueryRequest['rightQuery'] = null,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot> {
    return this.loadUserGameCardsStackPage(userId, filterPreferences, pageSize, false, mode, leftQuery, rightQuery, requestTimeoutMs);
  }

  private async loadUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    reset: boolean,
    mode: UserGameCardsQueryRequest['mode'],
    leftQuery: UserGameCardsQueryRequest['leftQuery'],
    rightQuery: UserGameCardsQueryRequest['rightQuery'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return this.getUserGameCardsStackSnapshot(userId);
    }
    const state = this.ensureUserGameCardsStackState(normalizedUserId);
    if (state.requestInFlight) {
      return this.getUserGameCardsStackSnapshot(normalizedUserId);
    }
    const fallbackIds = [...state.cardUserIds];
    const fallbackSocialCards = state.socialCards.map(card => ({ ...card }));
    const fallbackCursor = state.nextCursor;
    const excludedUserIds = new Set(this.queryExcludedGameCardUserIds(normalizedUserId, mode ?? 'single'));
    const excludedPairKeys = new Set(this.queryExcludedGameCardPairKeys(normalizedUserId));
    if (
      !reset
      && state.nextCursor === null
      && (state.cardUserIds.length > 0 || state.socialCards.length > 0)
      && !this.hasUnloadedRemainingGameCards(state, mode, excludedUserIds, excludedPairKeys)
    ) {
      return this.getUserGameCardsStackSnapshot(normalizedUserId);
    }
    state.requestInFlight = true;
    const existingIds = reset
      ? []
      : fallbackIds.filter(id => this.shouldKeepExistingGameCardUserId(id, normalizedUserId));
    const existingSocialCards = reset
      ? []
      : fallbackSocialCards
        .filter(card => this.shouldKeepGameSocialCard(card, mode, excludedUserIds, excludedPairKeys))
        .map(card => ({ ...card }));
    const existingCursor = reset
      ? null
      : this.adjustDemoStackCursorForRatedLoadedCards(
        fallbackCursor,
        fallbackIds,
        fallbackSocialCards,
        mode,
        excludedUserIds,
        excludedPairKeys
      );
    try {
      const cards = await this.loadUserGameCardsPage(
        normalizedUserId,
        filterPreferences,
        existingCursor,
        pageSize,
        mode,
        leftQuery,
        rightQuery,
        requestTimeoutMs
      );
      if (cards) {
        state.filterCount = this.mergeUserGameCardsStackFilterCount(state.filterCount, cards.filterCount, reset);
        const next = [...existingIds];
        const seen = new Set(next);
        for (const id of cards.cardUserIds) {
          const normalizedId = id.trim();
          if (!this.shouldKeepGameCardUserId(normalizedId, normalizedUserId, excludedUserIds) || seen.has(normalizedId)) {
            continue;
          }
          seen.add(normalizedId);
          next.push(normalizedId);
        }
        state.cardUserIds = next;
        const socialCardsById = new Map(existingSocialCards.map(card => [card.id, { ...card }] as const));
        for (const card of cards.socialCards ?? []) {
          if (!card.id.trim() || !card.userId.trim()) {
            continue;
          }
          if (!this.shouldKeepGameSocialCard(card, mode, excludedUserIds, excludedPairKeys)) {
            continue;
          }
          socialCardsById.set(card.id.trim(), { ...card });
        }
        state.socialCards = this.normalizeGameSocialCardsForMode([...socialCardsById.values()], mode);
        state.nextCursor = cards.nextCursor;
      } else if (reset) {
        state.filterCount = null;
        state.cardUserIds = [];
        state.socialCards = [];
        state.nextCursor = null;
      }
    } finally {
      state.requestInFlight = false;
    }
    return this.getUserGameCardsStackSnapshot(normalizedUserId);
  }

  private hasUnloadedRemainingGameCards(
    state: UserGameCardsStackState,
    mode: UserGameCardsQueryRequest['mode'],
    excludedUserIds: ReadonlySet<string>,
    excludedPairKeys: ReadonlySet<string>
  ): boolean {
    if (state.filterCount === null) {
      return false;
    }
    const loadedRemainingCount = mode === 'single'
      ? state.cardUserIds.filter(id => !excludedUserIds.has(id.trim())).length
      : state.socialCards.filter(card => this.shouldKeepGameSocialCard(card, mode, excludedUserIds, excludedPairKeys)).length;
    return state.filterCount > loadedRemainingCount;
  }

  private adjustDemoStackCursorForRatedLoadedCards(
    cursor: string | null,
    loadedCardUserIds: readonly string[],
    loadedSocialCards: readonly UserGameSocialCard[],
    mode: UserGameCardsQueryRequest['mode'],
    excludedUserIds: ReadonlySet<string>,
    excludedPairKeys: ReadonlySet<string>
  ): string | null {
    if (!cursor || !this.isLocalRouteEnabled('/game-cards/query')) {
      return cursor;
    }
    const parsedCursor = Number.parseInt(cursor, 10);
    if (!Number.isFinite(parsedCursor) || parsedCursor <= 0) {
      return cursor;
    }
    const loadedBeforeCursor = Math.max(0, parsedCursor);
    const ratedLoadedBeforeCursor = mode === 'single'
      ? loadedCardUserIds
        .slice(0, loadedBeforeCursor)
        .filter(id => excludedUserIds.has(id.trim())).length
      : loadedSocialCards
        .slice(0, loadedBeforeCursor)
        .filter(card => !this.shouldKeepGameSocialCard(card, mode, excludedUserIds, excludedPairKeys)).length;
    if (ratedLoadedBeforeCursor <= 0) {
      return cursor;
    }
    return String(Math.max(0, parsedCursor - ratedLoadedBeforeCursor));
  }

  private shouldKeepGameCardUserId(
    userId: string,
    activeUserId: string,
    excludedUserIds: ReadonlySet<string>
  ): boolean {
    const normalizedUserId = userId.trim();
    return normalizedUserId.length > 0
      && normalizedUserId !== activeUserId
      && !excludedUserIds.has(normalizedUserId);
  }

  private shouldKeepExistingGameCardUserId(
    userId: string,
    activeUserId: string
  ): boolean {
    const normalizedUserId = userId.trim();
    return normalizedUserId.length > 0 && normalizedUserId !== activeUserId;
  }

  private shouldKeepGameSocialCard(
    card: UserGameSocialCard,
    mode: UserGameCardsQueryRequest['mode'],
    excludedUserIds: ReadonlySet<string>,
    excludedPairKeys: ReadonlySet<string>
  ): boolean {
    const userId = card.userId.trim();
    if (!userId || excludedUserIds.has(userId)) {
      return false;
    }
    if (mode === 'single' || mode === 'friends-in-common') {
      return true;
    }
    const pairKey = this.socialPairKey(card);
    return !pairKey || !excludedPairKeys.has(pairKey);
  }

  private normalizeGameSocialCardsForMode(
    cards: readonly UserGameSocialCard[],
    mode: UserGameCardsQueryRequest['mode']
  ): UserGameSocialCard[] {
    if (mode !== 'friends-in-common') {
      return cards.map(card => ({ ...card }));
    }
    const byCandidateUserId = new Map<string, UserGameSocialCard>();
    for (const card of cards) {
      const candidateUserId = card.userId.trim();
      if (!candidateUserId) {
        continue;
      }
      const existing = byCandidateUserId.get(candidateUserId);
      if (!existing || (card.bridgeCount ?? 0) > (existing.bridgeCount ?? 0)) {
        byCandidateUserId.set(candidateUserId, { ...card });
      }
    }
    return [...byCandidateUserId.values()];
  }

  private socialPairKey(card: UserGameSocialCard): string | null {
    const firstUserId = card.userId.trim();
    const secondUserId = card.secondaryUserId?.trim() || card.bridgeUserId?.trim() || '';
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      return null;
    }
    return [firstUserId, secondUserId]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }

  private ensureUserGameCardsStackState(userId: string): UserGameCardsStackState {
    const existing = this.userGameCardsStackStateByUserId[userId];
    if (existing) {
      return existing;
    }
    const next: UserGameCardsStackState = {
      filterCount: null,
      cardUserIds: [],
      socialCards: [],
      nextCursor: null,
      requestInFlight: false
    };
    this.userGameCardsStackStateByUserId[userId] = next;
    return next;
  }

  private startUserRatesOutboxSyncLoop(): void {
    if (this.userRatesOutboxSyncTimer) {
      return;
    }
    this.userRatesOutboxSyncTimer = setInterval(() => {
      void this.flushUserRatesOutboxBatch();
    }, GameService.USER_RATES_OUTBOX_SYNC_INTERVAL_MS);
    setTimeout(() => {
      void this.flushUserRatesOutboxBatch();
    }, 0);
  }

  private scheduleUserRatesOutboxFlushFromNow(): void {
    if (this.userRatesOutboxSyncKickTimer) {
      clearTimeout(this.userRatesOutboxSyncKickTimer);
      this.userRatesOutboxSyncKickTimer = null;
    }
    this.userRatesOutboxSyncKickTimer = setTimeout(() => {
      this.userRatesOutboxSyncKickTimer = null;
      void this.flushUserRatesOutboxBatch();
    }, GameService.USER_RATES_OUTBOX_SYNC_INTERVAL_MS);
  }

  private async flushUserRatesOutboxBatch(): Promise<void> {
    if (this.userRatesOutboxSyncInFlight) {
      return;
    }
    this.userRatesOutboxSyncInFlight = true;
    try {
      await this.rateOutboxService.flushPendingUserRatesOutboxBatch(
        GameService.USER_RATES_OUTBOX_SYNC_BATCH_SIZE
      );
    } finally {
      this.userRatesOutboxSyncInFlight = false;
    }
  }


  private setLoadStatus(contextKey: string, status: LoadStatus, message?: string): void {
    this.runtimeStore.setStatus(contextKey, status, message);
  }

}
