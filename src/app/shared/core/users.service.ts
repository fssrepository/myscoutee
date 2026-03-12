import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { DemoUsersService } from './demo';
import { HttpUsersService } from './http';
import type {
  DemoUserListItemDto,
  UserDto,
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserService
} from './user.interface';
import { type LoadStatus } from './app.context';
import { AppContext } from './app.context';

export const USERS_LOAD_CONTEXT_KEY = 'users-selector';
export const USER_BY_ID_LOAD_CONTEXT_KEY = 'user-by-id';
export const USER_GAME_CARDS_LOAD_CONTEXT_KEY = 'user-game-cards';

interface UserGameCardsStackState {
  cardUserIds: string[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

export interface UserGameCardsStackSnapshot {
  cardUserIds: string[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

class RequestTimeoutError extends Error {
  constructor() {
    super('Users request timeout.');
    this.name = 'RequestTimeoutError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private readonly demoUsersService = inject(DemoUsersService);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly appCtx = inject(AppContext);
  private readonly userGameCardsStackStateByUserId: Record<string, UserGameCardsStackState> = {};

  readonly demoModeEnabled = !environment.loginEnabled;

  private get userService(): UserService {
    return this.demoModeEnabled ? this.demoUsersService : this.httpUsersService;
  }

  async loadAvailableDemoUsers(requestTimeoutMs?: number): Promise<DemoUserListItemDto[]> {
    if (!this.demoModeEnabled) {
      this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'success');
      return [];
    }

    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);

    this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.withRequestTimeout(
        this.userService.queryAvailableDemoUsers(),
        normalizedTimeoutMs
      );

      this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'success');
      return response.users;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'timeout', 'Users request timeout.');
        return [];
      }

      this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'error', 'Unable to load demo users.');
      return [];
    }
  }

  async loadUserById(userId: string, requestTimeoutMs?: number): Promise<UserDto | null> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.withRequestTimeout(
        this.userService.queryUserById(normalizedUserId),
        normalizedTimeoutMs
      );

      if (!response.user) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'User details not found.');
        return null;
      }

      if (response.filterPreferences) {
        this.appCtx.setUserFilterPreferences(normalizedUserId, response.filterPreferences);
      } else {
        this.appCtx.clearUserFilterPreferences(normalizedUserId);
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
      return response.user;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'timeout', 'User details request timeout.');
        return null;
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Unable to load user details.');
      return null;
    }
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
        this.userService.queryUserGameCardsByFilter({
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

  private setLoadStatus(contextKey: string, status: LoadStatus, message?: string): void {
    this.appCtx.setStatus(contextKey, status, message);
  }

  private resolveRequestTimeoutMs(value?: number): number {
    if (!Number.isFinite(value)) {
      return UsersService.DEFAULT_REQUEST_TIMEOUT_MS;
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
