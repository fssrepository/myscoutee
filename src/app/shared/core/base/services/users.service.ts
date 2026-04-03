import { Injectable, Injector, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { type LoadStatus } from '../context';
import { AppContext } from '../context';
import { DemoBootstrapService, type DemoBootstrapProgressState, DemoUsersRepository, DemoUsersService } from '../../demo';
import { HttpUsersService } from '../../http';
import type {
  DemoUserListItemDto,
  UserByIdQueryResponse,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserLocationEligibilityResponseDto,
  UserDto,
  UserLogoutRequestDto,
  UserReportUserSubmitRequestDto,
  UserRealtimeLongPollResponseDto,
  UserProfileImageUploadResult,
  UserSubmitActionResponseDto,
  UserService
} from '../interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../interfaces/game.interface';
import type { LocationCoordinates } from '../interfaces/location.interface';
import { BaseRouteModeService } from './base-route-mode.service';
import { resolveCurrentRouteDelayMs } from './route-delay.service';

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
  private readonly injector = inject(Injector);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly appCtx = inject(AppContext);
  private demoUsersServiceRef: DemoUsersService | null = null;
  private demoUsersRepositoryRef: DemoUsersRepository | null = null;
  private demoBootstrapServiceRef: DemoBootstrapService | null = null;

  get demoModeEnabled(): boolean {
    return this.isDemoModeEnabled('/auth/me');
  }

  private get demoUsersService(): DemoUsersService {
    if (!this.demoUsersServiceRef) {
      this.demoUsersServiceRef = this.injector.get(DemoUsersService);
    }
    return this.demoUsersServiceRef;
  }

  private get demoUsersRepository(): DemoUsersRepository {
    if (!this.demoUsersRepositoryRef) {
      this.demoUsersRepositoryRef = this.injector.get(DemoUsersRepository);
    }
    return this.demoUsersRepositoryRef;
  }

  private get demoBootstrapService(): DemoBootstrapService {
    if (!this.demoBootstrapServiceRef) {
      this.demoBootstrapServiceRef = this.injector.get(DemoBootstrapService);
    }
    return this.demoBootstrapServiceRef;
  }

  peekCachedUsers(): UserDto[] {
    const byId = new Map<string, UserDto>();
    const appProfiles = this.appCtx.userProfilesByUserId();
    for (const [userId, user] of Object.entries(appProfiles)) {
      if (!userId.trim()) {
        continue;
      }
      byId.set(userId, this.cloneUser(user));
    }

    if (this.demoModeEnabled) {
      for (const user of this.demoUsersRepository.queryAllUsers()) {
        if (!user?.id?.trim() || byId.has(user.id)) {
          continue;
        }
        byId.set(user.id, this.cloneUser(user));
      }
    }

    const activeUser = this.appCtx.activeUserProfile();
    if (activeUser?.id?.trim()) {
      byId.set(activeUser.id, this.cloneUser(activeUser));
    }

    return [...byId.values()];
  }

  peekCachedUserById(userId: string): UserDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const appProfile = this.appCtx.getUserProfile(normalizedUserId);
    if (appProfile) {
      return this.cloneUser(appProfile);
    }
    if (!this.demoModeEnabled) {
      return null;
    }
    const demoUser = this.demoUsersRepository.queryUserById(normalizedUserId);
    return demoUser ? this.cloneUser(demoUser) : null;
  }

  async warmCachedUsers(userIds: readonly string[]): Promise<void> {
    const pendingUserIds = [...new Set(
      userIds
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
        .filter(userId => !this.peekCachedUserById(userId))
    )];
    if (pendingUserIds.length === 0) {
      return;
    }
    await Promise.all(pendingUserIds.map(async userId => {
      try {
        await this.loadUserById(userId, 1500);
      } catch {
        // Keep enrichment warmup best-effort so screens stay responsive.
      }
    }));
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
      if (demoModeEnabled && environment.demoBootstrapEnabled) {
        await this.demoBootstrapService.ensureReady(onProgress);
      }
      const { value: response } = await this.loadWithRecovery(
        () => this.withRequestTimeout(
          (demoModeEnabled ? this.demoUsersService : this.httpUsersService).queryAvailableDemoUsers(),
          normalizedTimeoutMs
        ),
        () => ({
          users: demoModeEnabled ? this.demoUsersRepository.queryAvailableDemoUsers() : []
        }),
        {
          shouldRecover: next =>
            demoModeEnabled && (!Array.isArray(next.users) || next.users.length === 0),
          hasRecoveryValue: next => Array.isArray(next.users) && next.users.length > 0
        }
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
    if (!this.isDemoModeEnabled('/auth/me') || !environment.demoBootstrapEnabled) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready',
        stage: 'sessionReady'
      });
      return;
    }

    try {
      await this.demoBootstrapService.ensureUserReady(userId, onProgress);
    } catch {
      const fallbackUser = this.demoUsersRepository.queryUserById(userId.trim());
      if (!fallbackUser) {
        throw new Error('Unable to prepare demo user session.');
      }
      onProgress?.({
        percent: 100,
        label: 'Demo session ready',
        stage: 'sessionReady'
      });
    }
  }

  async checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto> {
    return this.userService.checkLocationEligibility(coordinates);
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
      const { value: response } = await this.loadWithRecovery(
        () => this.withRequestTimeout(
          this.userService.queryUserById(normalizedUserId || undefined),
          normalizedTimeoutMs
        ),
        () => this.recoverUserByIdResponse(normalizedUserId),
        {
          shouldRecover: next => !next.user,
          hasRecoveryValue: next => Boolean(next.user)
        }
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
        resolveCurrentRouteDelayMs('/auth/me', UsersService.DEFAULT_SUBMIT_MIN_DELAY_MS),
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
        resolveCurrentRouteDelayMs('/auth/me', UsersService.DEFAULT_SUBMIT_MIN_DELAY_MS),
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

  private recoverUserByIdResponse(userId: string): UserByIdQueryResponse {
    const normalizedUserId = userId.trim();
    const cachedUser = normalizedUserId
      ? this.peekCachedUserById(normalizedUserId)
      : (this.appCtx.activeUserProfile() ?? this.buildSessionFallbackUser());

    if (cachedUser) {
      return {
        user: this.cloneUser(cachedUser)
      };
    }

    return {
      user: null
    };
  }

  private buildSessionFallbackUser(): UserDto | null {
    const session = this.sessionService.currentSession();
    if (session?.kind !== 'firebase') {
      return null;
    }

    return this.cloneUser({
      id: session.profile.id.trim(),
      name: session.profile.name.trim(),
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: session.profile.initials.trim(),
      gender: 'man',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
        feedback: 0
      }
    });
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      locationCoordinates: user.locationCoordinates
        ? {
            latitude: Number(user.locationCoordinates.latitude),
            longitude: Number(user.locationCoordinates.longitude)
          }
        : undefined,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      impressions: user.impressions
        ? {
            host: user.impressions.host
              ? {
                  ...user.impressions.host,
                  vibeBadges: [...(user.impressions.host.vibeBadges ?? [])],
                  personalityBadges: [...(user.impressions.host.personalityBadges ?? [])],
                  personalityTraits: (user.impressions.host.personalityTraits ?? []).map(trait => ({ ...trait })),
                  categoryBadges: [...(user.impressions.host.categoryBadges ?? [])]
                }
              : undefined,
            member: user.impressions.member
              ? {
                  ...user.impressions.member,
                  vibeBadges: [...(user.impressions.member.vibeBadges ?? [])],
                  personalityBadges: [...(user.impressions.member.personalityBadges ?? [])],
                  personalityTraits: (user.impressions.member.personalityTraits ?? []).map(trait => ({ ...trait })),
                  categoryBadges: [...(user.impressions.member.categoryBadges ?? [])]
                }
              : undefined
          }
        : undefined,
      activities: {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0)),
        tickets: Math.max(0, Math.trunc(Number(user.activities?.tickets) || 0)),
        feedback: Math.max(0, Math.trunc(Number(user.activities?.feedback) || 0))
      }
    };
  }
}
