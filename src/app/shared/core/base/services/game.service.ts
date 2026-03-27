import { Injectable, inject } from '@angular/core';

import { type LoadStatus } from '../context';
import { AppContext } from '../context';
import type {
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserGameSocialCard,
  UserGameCardsStackSnapshot,
  UserGameDataService
} from '../interfaces/game.interface';
import { DemoGameService } from '../../demo';
import { DemoUsersRatingsRepository } from '../../demo/repositories/users-ratings.repository';
import { HttpGameService } from '../../http';
import { HttpUsersRatingsRepository } from '../../http/repositories/users-ratings.repository';
import type { UserDto } from '../interfaces/user.interface';
import { BaseRouteModeService } from './base-route-mode.service';

export const USER_GAME_CARDS_LOAD_CONTEXT_KEY = 'user-game-cards';

interface UserGameCardsStackState {
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

  recordUserGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    this.resolveRouteService('/activities/rates', this.demoGameService, this.httpGameService)
      .recordGameCardRating(raterUserId, ratedUserId, rating, mode);
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
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  kickUserRatesOutboxSync(): void {
    this.scheduleUserRatesOutboxFlushFromNow();
  }

  async loadUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null> {
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
        cardUserIds: [],
        socialCards: [],
        nextCursor: null,
        requestInFlight: false
      };
    }
    const state = this.ensureUserGameCardsStackState(normalizedUserId);
    return {
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
      || this.appCtx.getUserFilterCountOverride(userId) !== null;
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
    if (!reset && state.nextCursor === null && (state.cardUserIds.length > 0 || state.socialCards.length > 0)) {
      return this.getUserGameCardsStackSnapshot(normalizedUserId);
    }
    state.requestInFlight = true;
    const existingIds = reset ? [] : [...state.cardUserIds];
    const existingSocialCards = reset ? [] : state.socialCards.map(card => ({ ...card }));
    const existingCursor = reset ? null : state.nextCursor;
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
        this.appCtx.setUserFilterCountOverride(normalizedUserId, cards.filterCount);
        const next = [...existingIds];
        const seen = new Set(next);
        for (const id of cards.cardUserIds) {
          const normalizedId = id.trim();
          if (!normalizedId || normalizedId === normalizedUserId || seen.has(normalizedId)) {
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
          socialCardsById.set(card.id.trim(), { ...card });
        }
        state.socialCards = [...socialCardsById.values()];
        state.nextCursor = cards.nextCursor;
      } else if (reset) {
        state.cardUserIds = [];
        state.socialCards = [];
        state.nextCursor = null;
      }
    } finally {
      state.requestInFlight = false;
    }
    return this.getUserGameCardsStackSnapshot(normalizedUserId);
  }

  private ensureUserGameCardsStackState(userId: string): UserGameCardsStackState {
    const existing = this.userGameCardsStackStateByUserId[userId];
    if (existing) {
      return existing;
    }
    const next: UserGameCardsStackState = {
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
