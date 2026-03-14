import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { type LoadStatus } from '../context';
import { AppContext } from '../context';
import type {
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserGameCardsStackSnapshot,
  UserGameDataService,
  UserRateOutboxRecord
} from '../interfaces/game.interface';
import { DemoGameService } from '../../demo';
import { HttpGameService } from '../../http';
import { UsersRatingsRepository } from '../repositories/users-ratings.repository';
import type { UserDto } from '../interfaces/user.interface';
import { SessionService } from './session.service';

export const USER_GAME_CARDS_LOAD_CONTEXT_KEY = 'user-game-cards';

interface UserGameCardsStackState {
  cardUserIds: string[];
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
export class GameService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private static readonly USER_RATES_OUTBOX_SYNC_INTERVAL_MS = 30000;
  private static readonly USER_RATES_OUTBOX_SYNC_BATCH_SIZE = 50;
  private readonly demoGameService = inject(DemoGameService);
  private readonly httpGameService = inject(HttpGameService);
  private readonly usersRatingsRepository = inject(UsersRatingsRepository);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  private readonly userGameCardsStackStateByUserId: Record<string, UserGameCardsStackState> = {};
  private userRatesOutboxSyncInFlight = false;
  private userRatesOutboxSyncTimer: ReturnType<typeof setInterval> | null = null;
  private userRatesOutboxSyncKickTimer: ReturnType<typeof setTimeout> | null = null;

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  constructor() {
    this.startUserRatesOutboxSyncLoop();
  }

  private get gameDataService(): UserGameDataService {
    return this.demoModeEnabled ? this.demoGameService : this.httpGameService;
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
    this.gameDataService.recordGameCardRating(raterUserId, ratedUserId, rating, mode);
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
    if (normalizedFirstId === normalizedSecondId) {
      this.gameDataService.recordGameCardRating(raterUserId, normalizedFirstId, rating, 'pair');
      this.scheduleUserRatesOutboxFlushFromNow();
      return;
    }
    this.gameDataService.recordGameCardRating(raterUserId, normalizedFirstId, rating, 'pair');
    this.gameDataService.recordGameCardRating(raterUserId, normalizedSecondId, rating, 'pair');
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
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null> {
    return this.loadUserGameCardsByFilter(
      {
        userId,
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
        nextCursor: null,
        requestInFlight: false
      };
    }
    const state = this.ensureUserGameCardsStackState(normalizedUserId);
    return {
      cardUserIds: [...state.cardUserIds],
      nextCursor: state.nextCursor,
      requestInFlight: state.requestInFlight
    };
  }

  resetUserGameCardsStack(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.userGameCardsStackStateByUserId[normalizedUserId] = {
      cardUserIds: [],
      nextCursor: null,
      requestInFlight: false
    };
  }

  isUserGameCardsStackRequestInFlight(userId: string): boolean {
    return this.getUserGameCardsStackSnapshot(userId).requestInFlight;
  }

  shouldUseUserGameCardsStack(userId: string): boolean {
    const snapshot = this.getUserGameCardsStackSnapshot(userId);
    return snapshot.cardUserIds.length > 0
      || snapshot.nextCursor !== null
      || this.appCtx.getUserFilterCountOverride(userId) !== null;
  }

  async loadInitialUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot> {
    return this.loadUserGameCardsStackPage(userId, filterPreferences, pageSize, true, requestTimeoutMs);
  }

  async loadNextUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot> {
    return this.loadUserGameCardsStackPage(userId, filterPreferences, pageSize, false, requestTimeoutMs);
  }

  private async loadUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    reset: boolean,
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
    if (!reset && state.nextCursor === null && state.cardUserIds.length > 0) {
      return this.getUserGameCardsStackSnapshot(normalizedUserId);
    }
    state.requestInFlight = true;
    const existingIds = reset ? [] : [...state.cardUserIds];
    const existingCursor = reset ? null : state.nextCursor;
    try {
      const cards = await this.loadUserGameCardsPage(
        normalizedUserId,
        filterPreferences,
        existingCursor,
        pageSize,
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
        state.nextCursor = cards.nextCursor;
      } else if (reset) {
        state.cardUserIds = [];
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
    const batch = this.usersRatingsRepository.queryPendingUserRatesOutbox(
      GameService.USER_RATES_OUTBOX_SYNC_BATCH_SIZE
    );
    if (batch.length === 0) {
      return;
    }
    this.userRatesOutboxSyncInFlight = true;
    try {
      if (this.demoModeEnabled) {
        const syncResult = await this.demoGameService.syncUserRatesBatch(
          batch.map(item => item.payload)
        );
        this.applyUserRatesSyncResult(batch, syncResult.syncedRateIds, syncResult.failedRateIds, syncResult.error);
        return;
      }
      const syncResult = await this.httpGameService.syncUserRatesBatch(
        batch.map(item => item.payload)
      );
      this.applyUserRatesSyncResult(batch, syncResult.syncedRateIds, syncResult.failedRateIds, syncResult.error);
    } finally {
      this.userRatesOutboxSyncInFlight = false;
    }
  }

  private applyUserRatesSyncResult(
    batch: UserRateOutboxRecord[],
    syncedRateIds: string[],
    failedRateIds: string[],
    error: string | null
  ): void {
    const outboxIdByRateId = new Map<string, string>();
    for (const item of batch) {
      outboxIdByRateId.set(item.rateId, item.id);
    }
    const syncedOutboxIds = syncedRateIds
      .map(rateId => outboxIdByRateId.get(rateId) ?? null)
      .filter((id): id is string => Boolean(id));
    const failedOutboxIds = failedRateIds
      .map(rateId => outboxIdByRateId.get(rateId) ?? null)
      .filter((id): id is string => Boolean(id));

    const touched = new Set([...syncedOutboxIds, ...failedOutboxIds]);
    const unresolvedOutboxIds = batch
      .map(item => item.id)
      .filter(id => !touched.has(id));

    if (syncedOutboxIds.length > 0) {
      this.usersRatingsRepository.markUserRatesOutboxSynced(syncedOutboxIds);
    }

    const allFailedOutboxIds = [...failedOutboxIds, ...unresolvedOutboxIds];
    if (allFailedOutboxIds.length > 0) {
      this.usersRatingsRepository.markUserRatesOutboxFailed(allFailedOutboxIds, error ?? undefined);
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
