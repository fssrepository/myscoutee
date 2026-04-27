import { Injectable, inject } from '@angular/core';

import { type LoadStatus } from '../context';
import { AppContext } from '../context';
import type {
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserGameSocialCard,
  UserGameCardsStackSnapshot,
  UserGameDataService,
  UserGameMode
} from '../interfaces/game.interface';
import { DemoGameService } from '../../demo';
import { DemoUsersRatingsRepository } from '../../demo/repositories/users-ratings.repository';
import { HttpGameService } from '../../http';
import { HttpUsersRatingsRepository } from '../../http/repositories/users-ratings.repository';
import type { UserDto } from '../interfaces/user.interface';
import { AppMemoryDb } from '../db/app.db';
import { BaseRouteModeService } from './base-route-mode.service';

export const USER_GAME_CARDS_LOAD_CONTEXT_KEY = 'user-game-cards';

interface UserGameCardsStackState {
  filterCount: number | null;
  cardUserIds: string[];
  socialCards: UserGameSocialCard[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

class RequestTimeoutError extends Error {
  constructor() {
    super('Game request timeout.');
    this.name = 'RequestTimeoutError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class GameService extends BaseRouteModeService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private static readonly USER_RATES_OUTBOX_SYNC_INTERVAL_MS = 30000;
  private static readonly USER_RATES_OUTBOX_SYNC_BATCH_SIZE = 50;
  private readonly demoGameService = inject(DemoGameService);
  private readonly demoUsersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly httpGameService = inject(HttpGameService);
  private readonly httpUsersRatingsRepository = inject(HttpUsersRatingsRepository);
  private readonly appCtx = inject(AppContext);
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly userGameCardsStackStateByUserId: Record<string, UserGameCardsStackState> = {};
  private userRatesOutboxSyncInFlight = false;
  private userRatesOutboxSyncTimer: ReturnType<typeof setInterval> | null = null;
  private userRatesOutboxSyncKickTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.startUserRatesOutboxSyncLoop();
  }

  private get gameDataService(): UserGameDataService {
    return this.resolveRouteService('/game-cards/query', this.demoGameService, this.httpGameService);
  }

  private get usersRatingsRepository(): HttpUsersRatingsRepository {
    return this.resolveRouteService('/activities/rates', this.demoUsersRatingsRepository, this.httpUsersRatingsRepository);
  }

  getGameCardsUsersSnapshot(): UserDto[] {
    return this.gameDataService.queryGameCardsUsersSnapshot();
  }

  queryExcludedGameCardUserIds(userId: string, mode: UserGameMode = 'single'): string[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (mode !== 'single') {
      return [];
    }
    if (this.isDemoModeEnabled('/activities/rates')) {
      return this.demoUsersRatingsRepository.queryRatedGameCardUserIds(normalizedUserId, 'single');
    }
    return this.httpUsersRatingsRepository.queryPendingRatedGameCardUserIds(normalizedUserId, 'single');
  }

  queryExcludedGameCardPairKeys(userId: string): string[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (this.isDemoModeEnabled('/activities/rates')) {
      return this.demoUsersRatingsRepository.queryRatedGameCardPairKeys(normalizedUserId);
    }
    return this.httpUsersRatingsRepository.queryRatedGameCardPairKeys(normalizedUserId);
  }

  recordUserGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    this.resolveRouteService('/activities/rates', this.demoGameService, this.httpGameService)
      .recordGameCardRating(raterUserId, ratedUserId, rating, mode);
    this.decrementUserGameCardsStackFilterCount(raterUserId);
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  recordUserGameCardPairRating(
    raterUserId: string,
    firstRatedUserId: string,
    secondRatedUserId: string,
    rating: number
  ): void {
    const normalizedFirstId = firstRatedUserId.trim();
    const normalizedSecondId = secondRatedUserId.trim();
    if (!normalizedFirstId || !normalizedSecondId) {
      return;
    }
    this.usersRatingsRepository.enqueueGameCardPairRatingOutbox(
      raterUserId,
      normalizedFirstId,
      normalizedSecondId,
      rating
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
    await this.memoryDb.whenReady();
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const normalizedUserId = request.userId.trim();

    if (!normalizedUserId) {
      this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_GAME_CARDS_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.withRequestTimeout(
        this.gameDataService.queryUserGameCardsByFilter({
          userId: normalizedUserId,
          mode: request.mode ?? 'single',
          leftQuery: request.leftQuery ?? null,
          rightQuery: request.rightQuery ?? null,
          filterPreferences: request.filterPreferences ?? null,
          cursor: request.cursor ?? null,
          pageSize: request.pageSize
        }),
        normalizedTimeoutMs
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
      if (error instanceof RequestTimeoutError) {
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
        .filter(card => this.shouldKeepExistingGameSocialCard(card, mode))
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
      const { value: cards } = await this.loadWithRecovery(
        () => this.loadUserGameCardsPage(
          normalizedUserId,
          filterPreferences,
          existingCursor,
          pageSize,
          mode,
          leftQuery,
          rightQuery,
          requestTimeoutMs
        ),
        () => this.buildRecoveredGameCardsPage(
          normalizedUserId,
          fallbackIds,
          fallbackSocialCards,
          fallbackCursor
        ),
        {
          shouldRecover: next => next === null,
          hasRecoveryValue: next => this.hasRecoveredGameCards(next)
        }
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
        state.socialCards = [...socialCardsById.values()];
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
    if (!cursor || !this.isDemoModeEnabled('/game-cards/query')) {
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

  private shouldKeepExistingGameSocialCard(
    card: UserGameSocialCard,
    mode: UserGameCardsQueryRequest['mode']
  ): boolean {
    const userId = card.userId.trim();
    if (!userId) {
      return false;
    }
    if (mode === 'single') {
      return true;
    }
    return this.socialPairKey(card) !== null;
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
    if (mode === 'single') {
      return true;
    }
    const pairKey = this.socialPairKey(card);
    return !pairKey || !excludedPairKeys.has(pairKey);
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

  private buildRecoveredGameCardsPage(
    userId: string,
    cardUserIds: readonly string[],
    socialCards: readonly UserGameSocialCard[],
    nextCursor: string | null
  ): UserGameCardsDto | null {
    if (
      cardUserIds.length === 0
      && socialCards.length === 0
      && nextCursor === null
      && this.peekUserGameCardsStackSnapshot(userId).filterCount === null
    ) {
      return null;
    }
    return {
      filterCount: this.peekUserGameCardsStackSnapshot(userId).filterCount ?? cardUserIds.length + socialCards.length,
      cardUserIds: [...cardUserIds],
      socialCards: socialCards.map(card => ({ ...card })),
      nextCursor
    };
  }

  private hasRecoveredGameCards(cards: UserGameCardsDto | null): boolean {
    return Boolean(
      cards
      && (
        cards.cardUserIds.length > 0
        || (cards.socialCards?.length ?? 0) > 0
        || cards.nextCursor !== null
        || Number.isFinite(cards.filterCount)
      )
    );
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
      await this.usersRatingsRepository.flushPendingUserRatesOutboxBatch(
        GameService.USER_RATES_OUTBOX_SYNC_BATCH_SIZE
      );
    } finally {
      this.userRatesOutboxSyncInFlight = false;
    }
  }


  private setLoadStatus(contextKey: string, status: LoadStatus, message?: string): void {
    this.appCtx.setStatus(contextKey, status, message);
  }

  private resolveRequestTimeoutMs(value?: number): number {
    if (!Number.isFinite(value)) {
      return GameService.DEFAULT_REQUEST_TIMEOUT_MS;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private withRequestTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RequestTimeoutError());
      }, timeoutMs);
      void promise.then(
        result => {
          clearTimeout(timer);
          resolve(result);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}
