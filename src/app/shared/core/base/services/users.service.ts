import { Injectable, inject } from '@angular/core';

import { type LoadStatus } from '../context';
import { AppContext } from '../context';
import { DemoBootstrapService, type DemoBootstrapProgressState, DemoUsersService } from '../../demo';
import { HttpUsersService } from '../../http';
import type {
  DemoUserListItemDto,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserDto,
  UserLogoutRequestDto,
  UserReportUserSubmitRequestDto,
  UserRealtimeLongPollResponseDto,
  UserProfileImageUploadResult,
  UserSubmitActionResponseDto,
  UserService
} from '../interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../interfaces/game.interface';
import { BaseRouteModeService } from './base-route-mode.service';

export { USER_GAME_CARDS_LOAD_CONTEXT_KEY } from './game.service';

export const USERS_LOAD_CONTEXT_KEY = 'users-selector';
export const USER_BY_ID_LOAD_CONTEXT_KEY = 'user-by-id';
export const USER_FEEDBACK_SUBMIT_CONTEXT_KEY = 'user-feedback-submit';
export const USER_REPORT_USER_SUBMIT_CONTEXT_KEY = 'user-report-user-submit';
export const USER_PROFILE_SAVE_CONTEXT_KEY = 'user-profile-save';
export const USER_LOGOUT_CONTEXT_KEY = 'user-logout';
export const USER_DELETE_CONTEXT_KEY = 'user-delete';

class RequestTimeoutError extends Error {
  constructor() {
    super('Users request timeout.');
    this.name = 'RequestTimeoutError';
  }
}

class RequestAbortedError extends Error {
  constructor() {
    super('Users request aborted.');
    this.name = 'AbortError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class UsersService extends BaseRouteModeService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private static readonly DEFAULT_SUBMIT_MIN_DELAY_MS = 1500;
  private readonly demoUsersService = inject(DemoUsersService);
  private readonly demoBootstrapService = inject(DemoBootstrapService);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly appCtx = inject(AppContext);

  get demoModeEnabled(): boolean {
    return this.isDemoModeEnabled('/auth/me');
  }

  private get userService(): UserService {
    return this.resolveRouteService('/auth/me', this.demoUsersService, this.httpUsersService);
  }

  async loadAvailableDemoUsers(
    requestTimeoutMs?: number,
    onProgress?: (state: DemoBootstrapProgressState) => void
  ): Promise<DemoUserListItemDto[]> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const demoModeEnabled = this.isDemoModeEnabled('/auth/demo-users');

    this.setLoadStatus(USERS_LOAD_CONTEXT_KEY, 'loading');

    try {
      if (demoModeEnabled) {
        await this.demoBootstrapService.ensureReady(onProgress);
      }
      const response = await this.withRequestTimeout(
        (demoModeEnabled ? this.demoUsersService : this.httpUsersService).queryAvailableDemoUsers(),
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

  async prepareDemoUserSession(
    userId: string,
    onProgress?: (state: DemoBootstrapProgressState) => void
  ): Promise<void> {
    if (!this.isDemoModeEnabled('/auth/me')) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready'
      });
      return;
    }

    await this.demoBootstrapService.ensureUserReady(userId, onProgress);
  }

  async loadUserById(userId?: string, requestTimeoutMs?: number): Promise<UserDto | null> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

    if (this.isDemoModeEnabled('/auth/me') && !normalizedUserId) {
      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.withRequestTimeout(
        this.userService.queryUserById(normalizedUserId || undefined),
        normalizedTimeoutMs
      );

      if (!response.user) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'User details not found.');
        return null;
      }

      const resolvedUserId = normalizedUserId || response.user.id.trim();
      this.appCtx.setUserProfile(response.user);
      if (resolvedUserId) {
        this.appCtx.clearUserCounterOverrides(resolvedUserId);
        if (response.counterOverrides) {
          this.appCtx.patchUserCounterOverrides(resolvedUserId, response.counterOverrides);
        }
        if (response.filterPreferences) {
          this.appCtx.setUserFilterPreferences(resolvedUserId, response.filterPreferences);
        } else {
          this.appCtx.clearUserFilterPreferences(resolvedUserId);
        }
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

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.appCtx.setUserFilterPreferences(normalizedUserId, preferences);
    await this.userService.saveUserFilterPreferences(normalizedUserId, preferences);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.appCtx.setUserProfile(user);
    this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'loading');

    try {
      const savedUser = await this.withRequestTimeout(
        this.userService.saveUserProfile(user),
        UsersService.DEFAULT_REQUEST_TIMEOUT_MS
      );
      const resolvedUser = savedUser ?? user;
      this.appCtx.setUserProfile(resolvedUser);
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'success');
      return resolvedUser;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'timeout', 'Profile save request timeout.');
        return user;
      }

      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Unable to save profile.');
      return user;
    }
  }

  async submitUserFeedback(
    request: UserFeedbackSubmitRequestDto,
    requestTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    return this.submitUserAction(
      USER_FEEDBACK_SUBMIT_CONTEXT_KEY,
      requestSignal => this.userService.submitUserFeedback(request, requestSignal),
      requestTimeoutMs,
      'Feedback request timeout.',
      'Unable to send feedback.',
      signal
    );
  }

  async submitReportUser(
    request: UserReportUserSubmitRequestDto,
    requestTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    return this.submitUserAction(
      USER_REPORT_USER_SUBMIT_CONTEXT_KEY,
      requestSignal => this.userService.submitReportUser(request, requestSignal),
      requestTimeoutMs,
      'Report request timeout.',
      'Unable to submit report.',
      signal
    );
  }

  async logoutUser(
    userId: string,
    requestTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    const request: UserLogoutRequestDto = {
      userId: userId.trim()
    };
    return this.submitUserAction(
      USER_LOGOUT_CONTEXT_KEY,
      requestSignal => this.userService.logoutUser(request, requestSignal),
      requestTimeoutMs,
      'Logout request timeout.',
      'Unable to log out.',
      signal
    );
  }

  async deleteUser(
    userId: string,
    requestTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    const request: UserDeleteRequestDto = {
      userId: userId.trim()
    };
    return this.submitUserAction(
      USER_DELETE_CONTEXT_KEY,
      requestSignal => this.userService.deleteUser(request, requestSignal),
      requestTimeoutMs,
      'Delete account request timeout.',
      'Unable to delete account.',
      signal
    );
  }

  async pollUserRealtimeSnapshot(
    userId: string,
    cursor: string | null = null,
    requestTimeoutMs?: number
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    try {
      const snapshot = await this.withRequestTimeout(
        this.userService.queryUserRealtimeLongPoll(normalizedUserId, cursor),
        normalizedTimeoutMs
      );
      if (!snapshot) {
        return null;
      }
      return this.normalizeRealtimeSnapshot(snapshot, normalizedUserId, cursor);
    } catch {
      return null;
    }
  }

  async uploadUserProfileImage(
    userId: string,
    file: File,
    slotIndex: number
  ): Promise<UserProfileImageUploadResult> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    return this.userService.uploadUserProfileImage(normalizedUserId, file, slotIndex);
  }


  private setLoadStatus(contextKey: string, status: LoadStatus, message?: string): void {
    this.appCtx.setStatus(contextKey, status, message);
  }

  private async submitUserAction(
    contextKey: string,
    requestFactory: (signal: AbortSignal) => Promise<UserSubmitActionResponseDto>,
    requestTimeoutMs: number | undefined,
    timeoutMessage: string,
    fallbackErrorMessage: string,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    if (signal?.aborted) {
      this.appCtx.resetLoadingState(contextKey);
      return {
        submitted: false,
        message: null
      };
    }

    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);
    const startedAtMs = Date.now();
    const requestAbortController = new AbortController();
    this.setLoadStatus(contextKey, 'loading');

    try {
      const response = await this.withRequestTimeout(
        requestFactory(requestAbortController.signal),
        normalizedTimeoutMs,
        signal,
        requestAbortController
      );

      await this.ensureMinimumRequestDuration(
        startedAtMs,
        UsersService.DEFAULT_SUBMIT_MIN_DELAY_MS,
        requestAbortController.signal
      );

      if (!response.submitted) {
        this.setLoadStatus(contextKey, 'error', response.message ?? fallbackErrorMessage);
        return {
          submitted: false,
          message: response.message ?? fallbackErrorMessage
        };
      }

      this.setLoadStatus(contextKey, 'success');
      return response;
    } catch (error) {
      if (this.isAbortError(error)) {
        this.appCtx.resetLoadingState(contextKey);
        return {
          submitted: false,
          message: null
        };
      }

      await this.ensureMinimumRequestDuration(
        startedAtMs,
        UsersService.DEFAULT_SUBMIT_MIN_DELAY_MS,
        requestAbortController.signal
      );

      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus(contextKey, 'timeout', timeoutMessage);
        return {
          submitted: false,
          message: timeoutMessage
        };
      }

      this.setLoadStatus(contextKey, 'error', fallbackErrorMessage);
      return {
        submitted: false,
        message: fallbackErrorMessage
      };
    }
  }

  private resolveRequestTimeoutMs(value?: number): number {
    if (!Number.isFinite(value)) {
      return UsersService.DEFAULT_REQUEST_TIMEOUT_MS;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private withRequestTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal,
    abortController?: AbortController
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        abortController?.abort();
        reject(new RequestAbortedError());
        return;
      }

      const timer = setTimeout(() => {
        abortController?.abort();
        cleanup();
        reject(new RequestTimeoutError());
      }, timeoutMs);
      const onAbort = () => {
        abortController?.abort();
        cleanup();
        reject(new RequestAbortedError());
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      void promise.then(
        result => {
          cleanup();
          resolve(result);
        },
        error => {
          cleanup();
          reject(error);
        }
      );
    });
  }

  private async ensureMinimumRequestDuration(
    startedAtMs: number,
    minimumDurationMs: number,
    signal?: AbortSignal
  ): Promise<void> {
    const elapsedMs = Date.now() - startedAtMs;
    const remainingMs = minimumDurationMs - elapsedMs;
    if (remainingMs <= 0) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new RequestAbortedError());
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, remainingMs);
      const onAbort = () => {
        cleanup();
        reject(new RequestAbortedError());
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof RequestAbortedError || (error instanceof Error && error.name === 'AbortError');
  }

  private normalizeRealtimeSnapshot(
    snapshot: UserRealtimeLongPollResponseDto,
    fallbackUserId: string,
    fallbackCursor: string | null
  ): UserRealtimeLongPollResponseDto {
    const normalizeCounter = (value: unknown): number | undefined => {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const counters = snapshot.counters ?? {};
    return {
      userId: (snapshot.userId ?? fallbackUserId).trim() || fallbackUserId,
      counters: {
        game: normalizeCounter(counters.game),
        chat: normalizeCounter(counters.chat),
        invitations: normalizeCounter(counters.invitations),
        events: normalizeCounter(counters.events),
        hosting: normalizeCounter(counters.hosting),
        tickets: normalizeCounter(counters.tickets),
        feedback: normalizeCounter(counters.feedback),
        impressionsHostChanged: counters.impressionsHostChanged === true,
        impressionsMemberChanged: counters.impressionsMemberChanged === true
      },
      impressions: snapshot.impressions,
      cursor: typeof snapshot.cursor === 'string'
        ? snapshot.cursor.trim()
        : fallbackCursor,
      serverTsIso: typeof snapshot.serverTsIso === 'string'
        ? snapshot.serverTsIso
        : new Date().toISOString()
    };
  }
}
