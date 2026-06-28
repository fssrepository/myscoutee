import { Injectable, inject } from '@angular/core';

import { AppContext, type ActivityCounters, type LoadStatus } from '../../../ui/context';
import { LocalUsersService } from '../../local';
import { HttpUsersService } from '../../http';
import type { BootstrapProcessState } from './bootstrap.service';
import type {
  ProfileExtDto,
  UserSelectorListItemDto,
  UserSelectorRole,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserLocationEligibilityResponseDto,
  UserDto,
  UserMenuCountersDto,
  UserRealtimeCountersDto,
  UserLogoutRequestDto,
  UserReportUserSubmitRequestDto,
  UserRealtimeLongPollResponseDto,
  UserSubmitActionResponseDto,
  UserService
} from '../../contracts/user.interface';
import type { UserGameFilterPreferencesDto } from '../../contracts/activity.interface';
import type { LocationCoordinates } from '../../contracts/user.interface';
import { BaseRouteModeService } from './base-route-mode.service';
import { RouteDelayService } from './route-delay.service';
import {
  RouteIntervalSchedulerService,
  type RouteIntervalStop,
  type RouteIntervalTask
} from './route-interval-scheduler.service';

export { USER_GAME_CARDS_LOAD_CONTEXT_KEY } from './game.service';

export const USER_BY_ID_LOAD_CONTEXT_KEY = 'user-by-id';
export const USER_FEEDBACK_SUBMIT_CONTEXT_KEY = 'user-feedback-submit';
export const USER_REPORT_USER_SUBMIT_CONTEXT_KEY = 'user-report-user-submit';
export const USER_PROFILE_SAVE_CONTEXT_KEY = 'user-profile-save';
export const USER_LOGOUT_CONTEXT_KEY = 'user-logout';
export const USER_DELETE_CONTEXT_KEY = 'user-delete';

@Injectable({
  providedIn: 'root'
})
export class UsersService extends BaseRouteModeService {
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';

  private readonly localUsersService = inject(LocalUsersService);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly appCtx = inject(AppContext);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);

  get localModeEnabled(): boolean {
    return this.isLocalRouteEnabled('/auth/me');
  }

  peekCachedUsers(): UserDto[] {
    const byId = new Map<string, UserDto>();
    const appProfiles = this.appCtx.userProfileStore.userProfilesByUserId();
    for (const [userId, user] of Object.entries(appProfiles)) {
      if (!userId.trim()) {
        continue;
      }
      byId.set(userId, this.cloneUser(user));
    }

    for (const user of this.userService.peekCachedUsers?.() ?? []) {
      if (!user?.id?.trim() || byId.has(user.id)) {
        continue;
      }
      byId.set(user.id, this.cloneUser(user));
    }

    const activeUser = this.appCtx.userProfileStore.activeUserProfile();
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
    const appProfile = this.appCtx.userProfileStore.getUserProfile(normalizedUserId);
    if (appProfile) {
      return this.cloneUser(appProfile);
    }
    const cachedUser = this.userService.peekCachedUserById?.(normalizedUserId) ?? null;
    return cachedUser ? this.cloneUser(cachedUser) : null;
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
        await this.loadUserById(userId);
      } catch {
        // Keep enrichment warmup best-effort so screens stay responsive.
      }
    }));
  }

  private get userService(): LocalUsersService | HttpUsersService {
    return this.resolveRouteService('/auth/me', this.localUsersService, this.httpUsersService);
  }

  private get userSelectorService(): LocalUsersService | HttpUsersService {
    return this.resolveRouteService('/auth/demo-users', this.localUsersService, this.httpUsersService);
  }

  async loadAvailableDemoUsers(selectorRole: UserSelectorRole = 'member'): Promise<UserSelectorListItemDto[]> {
    return this.userSelectorService.queryAvailableDemoUsers(selectorRole);
  }

  async prepareDemoUserSession(
    userId: string,
    onProgress?: (state: BootstrapProcessState) => void
  ): Promise<void> {
    await this.userService.prepareUserSession(userId, onProgress);
  }

  async checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto> {
    return this.userService.checkLocationEligibility(coordinates);
  }

  async loadUserById(userId?: string, requestTimeoutMs?: number): Promise<UserDto | null> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

    if (this.isLocalRouteEnabled('/auth/me') && !normalizedUserId) {
      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.userService.queryUserById(normalizedUserId || undefined, requestTimeoutMs);

      if (!response.user) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'User details not found.');
        return null;
      }

      const resolvedUserId = response.user.id.trim() || normalizedUserId;
      const previousActiveUserId = this.appCtx.userProfileStore.getActiveUserId().trim();
      if (response.user.profileStatus === 'deleted') {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
        return response.user;
      }
      this.appCtx.userProfileStore.setUserProfile(response.user);
      if (resolvedUserId && (!normalizedUserId || previousActiveUserId === normalizedUserId)) {
        this.appCtx.userProfileStore.setActiveUserId(resolvedUserId);
      }
      if (resolvedUserId) {
        this.appCtx.activityStore.clearUserCounterOverrides(resolvedUserId);
        if (response.counterOverrides) {
          this.appCtx.activityStore.patchUserCounterOverrides(
            resolvedUserId,
            this.normalizeCounterOverrides(response.counterOverrides, response.user.activities)
          );
        }
        if (response.filterPreferences) {
          this.appCtx.userProfileStore.setUserFilterPreferences(resolvedUserId, response.filterPreferences);
        } else {
          this.appCtx.userProfileStore.clearUserFilterPreferences(resolvedUserId);
        }
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
      return response.user;
    } catch (error) {
      if (this.isTimeoutError(error, 'User details request timeout.')) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'timeout', 'User details request timeout.');
        return null;
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Unable to load user details.');
      return null;
    }
  }

  async loadProfileExtById(userId?: string, requestTimeoutMs?: number): Promise<ProfileExtDto | null> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

    if (this.isLocalRouteEnabled('/auth/me/profile-ext') && !normalizedUserId) {
      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'loading');

    try {
      const response = await this.userService.loadProfileExtById(normalizedUserId || undefined, requestTimeoutMs);
      const profileExt = response.profileExt;
      const user = profileExt?.profile ?? null;

      if (!profileExt || !user) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'User profile not found.');
        return null;
      }

      const resolvedUserId = user.id.trim() || normalizedUserId;
      const previousActiveUserId = this.appCtx.userProfileStore.getActiveUserId().trim();
      if (user.profileStatus === 'deleted') {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
        return profileExt;
      }

      this.appCtx.userProfileStore.setProfileExt(profileExt);
      if (resolvedUserId && (!normalizedUserId || previousActiveUserId === normalizedUserId)) {
        this.appCtx.userProfileStore.setActiveUserId(resolvedUserId);
      }
      if (resolvedUserId) {
        this.appCtx.activityStore.clearUserCounterOverrides(resolvedUserId);
        if (response.counterOverrides) {
          this.appCtx.activityStore.patchUserCounterOverrides(
            resolvedUserId,
            this.normalizeCounterOverrides(response.counterOverrides, user.activities)
          );
        }
        if (response.filterPreferences) {
          this.appCtx.userProfileStore.setUserFilterPreferences(resolvedUserId, response.filterPreferences);
        } else {
          this.appCtx.userProfileStore.clearUserFilterPreferences(resolvedUserId);
        }
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
      return this.appCtx.userProfileStore.getProfileExt(resolvedUserId) ?? profileExt;
    } catch (error) {
      if (this.isTimeoutError(error, 'User profile request timeout.')) {
        this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'timeout', 'User profile request timeout.');
        return null;
      }

      this.setLoadStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'error', 'Unable to load user profile.');
      return null;
    }
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.appCtx.userProfileStore.setUserFilterPreferences(normalizedUserId, preferences);
    await this.userService.saveUserFilterPreferences(normalizedUserId, preferences);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.appCtx.userProfileStore.setUserProfile(user);
    this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'loading');

    try {
      const savedUser = await this.userService.saveUserProfile(user);
      if (savedUser) {
        this.appCtx.userProfileStore.setUserProfile(savedUser);
      }
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'success');
      return savedUser;
    } catch (error) {
      if (this.isTimeoutError(error, 'Profile save request timeout.')) {
        this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'timeout', 'Profile save request timeout.');
        return null;
      }

      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Unable to save profile.');
      return null;
    }
  }

  async saveUserProfileExt(request: ProfileExtDto): Promise<UserDto | null> {
    const profile = request?.profile;
    if (!profile?.id?.trim()) {
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Missing user id.');
      return null;
    }

    this.appCtx.userProfileStore.setProfileExt(request);
    this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'loading');

    try {
      const savedUser = await this.userService.saveUserProfileExt(request);
      if (savedUser) {
        this.appCtx.userProfileStore.setProfileExt({
          profile: savedUser,
          experienceEntries: request.experienceEntries
        });
      }
      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'success');
      return savedUser;
    } catch (error) {
      if (this.isTimeoutError(error, 'Profile save request timeout.')) {
        this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'timeout', 'Profile save request timeout.');
        return null;
      }

      this.setLoadStatus(USER_PROFILE_SAVE_CONTEXT_KEY, 'error', 'Unable to save profile.');
      return null;
    }
  }

  async submitUserFeedback(
    request: UserFeedbackSubmitRequestDto,
    requestTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    return this.submitUserAction(
      USER_FEEDBACK_SUBMIT_CONTEXT_KEY,
      (requestSignal, timeoutMs) => this.userService.submitUserFeedback(request, requestSignal, timeoutMs),
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
      (requestSignal, timeoutMs) => this.userService.submitReportUser(request, requestSignal, timeoutMs),
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
      (requestSignal, timeoutMs) => this.userService.logoutUser(request, requestSignal, timeoutMs),
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
      (requestSignal, timeoutMs) => this.userService.deleteUser(request, requestSignal, timeoutMs),
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
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    try {
      const snapshot = await this.userService.queryUserRealtimeLongPoll(normalizedUserId, cursor, requestTimeoutMs);
      return snapshot ? this.normalizeRealtimeSnapshot(snapshot, normalizedUserId, cursor) : null;
    } catch {
      return null;
    }
  }

  resolveUserRealtimeLongPollIntervalMs(): number {
    return this.routeDelay.resolveIntervalMs(UsersService.USER_REALTIME_LONG_POLL_ROUTE);
  }

  startUserRealtimeLongPoll(task: RouteIntervalTask): RouteIntervalStop {
    return this.routeIntervalScheduler.startInterval(
      UsersService.USER_REALTIME_LONG_POLL_ROUTE,
      task
    );
  }

  private setLoadStatus(contextKey: string, status: LoadStatus, message?: string): void {
    this.appCtx.runtimeStore.setStatus(contextKey, status, message);
  }

  private async submitUserAction(
    contextKey: string,
    requestFactory: (
      signal: AbortSignal,
      requestTimeoutMs?: number
    ) => Promise<UserSubmitActionResponseDto>,
    requestTimeoutMs: number | undefined,
    timeoutMessage: string,
    fallbackErrorMessage: string,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    if (signal?.aborted) {
      this.appCtx.runtimeStore.resetLoadingState(contextKey);
      return {
        submitted: false,
        message: null
      };
    }

    const requestAbortController = new AbortController();
    const unbindAbort = this.bindAbort(signal, requestAbortController);
    this.setLoadStatus(contextKey, 'loading');

    try {
      const response = await requestFactory(requestAbortController.signal, requestTimeoutMs);

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
        this.appCtx.runtimeStore.resetLoadingState(contextKey);
        return {
          submitted: false,
          message: null
        };
      }

      if (this.isTimeoutError(error, timeoutMessage)) {
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
    } finally {
      unbindAbort();
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private isTimeoutError(error: unknown, message: string): boolean {
    return error instanceof Error && error.message === message;
  }

  private bindAbort(signal: AbortSignal | undefined, abortController: AbortController): () => void {
    if (!signal) {
      return () => undefined;
    }
    if (signal.aborted) {
      abortController.abort();
      return () => undefined;
    }
    const onAbort = () => abortController.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  }

  private normalizeRealtimeSnapshot(
    snapshot: UserRealtimeLongPollResponseDto,
    fallbackUserId: string,
    fallbackCursor: string | null
  ): UserRealtimeLongPollResponseDto {
    const normalizedFallbackUserId = fallbackUserId.trim();
    const normalizedUserId = `${snapshot.userId ?? normalizedFallbackUserId}`.trim() || normalizedFallbackUserId;
    return {
      userId: normalizedUserId,
      counters: this.normalizeRealtimeCounters(snapshot.counters),
      impressions: snapshot.impressions,
      cursor: typeof snapshot.cursor === 'string' ? snapshot.cursor.trim() : fallbackCursor,
      serverTsIso: typeof snapshot.serverTsIso === 'string' && snapshot.serverTsIso.trim()
        ? snapshot.serverTsIso
        : new Date().toISOString()
    };
  }

  private normalizeRealtimeCounters(counters: UserRealtimeCountersDto | null | undefined): UserRealtimeCountersDto {
    const normalized: UserRealtimeCountersDto = {};
    const setCounter = <Key extends keyof UserRealtimeCountersDto>(key: Key, value: unknown): void => {
      const counter = this.normalizeCounter(value);
      if (counter !== undefined) {
        normalized[key] = counter as UserRealtimeCountersDto[Key];
      }
    };

    setCounter('game', counters?.game);
    setCounter('chat', counters?.chat);
    setCounter('invitations', counters?.invitations);
    setCounter('events', counters?.events);
    setCounter('hosting', counters?.hosting);
    setCounter('cars', counters?.cars);
    setCounter('accommodation', counters?.accommodation);
    setCounter('supplies', counters?.supplies);
    setCounter('tickets', counters?.tickets);
    setCounter('contacts', counters?.contacts);
    setCounter('feedback', counters?.feedback);
    setCounter('adminJobs', counters?.adminJobs);
    setCounter('adminMetrics', counters?.adminMetrics);

    if (counters?.event) {
      normalized.event = {
        all: this.counterValue(counters.event.all),
        active: this.counterValue(counters.event.active),
        pending: this.counterValue(counters.event.pending),
        invitations: this.counterValue(counters.event.invitations),
        hosting: this.counterValue(counters.event.hosting),
        drafts: this.counterValue(counters.event.drafts),
        trash: this.counterValue(counters.event.trash)
      };
    }
    if (counters?.asset) {
      normalized.asset = {
        cars: this.counterValue(counters.asset.cars),
        accommodation: this.counterValue(counters.asset.accommodation),
        supplies: this.counterValue(counters.asset.supplies),
        tickets: this.counterValue(counters.asset.tickets)
      };
    }
    if (counters?.eventFeedback) {
      normalized.eventFeedback = {
        ownEvents: this.counterValue(counters.eventFeedback.ownEvents),
        pending: this.counterValue(counters.eventFeedback.pending),
        feedbacked: this.counterValue(counters.eventFeedback.feedbacked),
        removed: this.counterValue(counters.eventFeedback.removed)
      };
    }

    normalized.impressionsHostChanged = counters?.impressionsHostChanged === true;
    normalized.impressionsMemberChanged = counters?.impressionsMemberChanged === true;
    return normalized;
  }

  private counterValue(value: unknown): number {
    return this.normalizeCounter(value) ?? 0;
  }

  private normalizeCounter(value: unknown): number | undefined {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return undefined;
    }
    return Math.max(0, Math.trunc(numericValue));
  }

  private normalizeCounterOverrides(
    counterOverrides: UserMenuCountersDto | null | undefined,
    fallbackActivities: UserDto['activities']
  ): Partial<ActivityCounters> {
    if (!counterOverrides) {
      return {};
    }

    const normalizeWithFallback = (value: unknown, fallback: unknown): number | undefined => {
      if (Number.isFinite(value)) {
        return Math.max(0, Math.round(Number(value)));
      }
      if (Number.isFinite(Number(fallback))) {
        return Math.max(0, Math.round(Number(fallback)));
      }
      return undefined;
    };

    const patch: Partial<ActivityCounters> = {};
    const game = normalizeWithFallback(counterOverrides.game, fallbackActivities.game);
    const chat = normalizeWithFallback(counterOverrides.chat, fallbackActivities.chat);
    const invitations = normalizeWithFallback(counterOverrides.invitations, fallbackActivities.invitations);
    const events = normalizeWithFallback(counterOverrides.events, fallbackActivities.events);
    const hosting = normalizeWithFallback(counterOverrides.hosting, fallbackActivities.hosting);
    const cars = normalizeWithFallback(counterOverrides.cars, fallbackActivities.cars);
    const accommodation = normalizeWithFallback(counterOverrides.accommodation, fallbackActivities.accommodation);
    const supplies = normalizeWithFallback(counterOverrides.supplies, fallbackActivities.supplies);
    const tickets = normalizeWithFallback(counterOverrides.tickets, fallbackActivities.tickets);
    const contacts = normalizeWithFallback(counterOverrides.contacts, fallbackActivities.contacts);
    const feedback = normalizeWithFallback(counterOverrides.feedback, fallbackActivities.feedback);
    const adminJobs = normalizeWithFallback(counterOverrides.adminJobs, fallbackActivities.adminJobs);
    const adminMetrics = normalizeWithFallback(counterOverrides.adminMetrics, fallbackActivities.adminMetrics);

    if (game !== undefined) patch.game = game;
    if (chat !== undefined) patch.chat = chat;
    if (invitations !== undefined) patch.invitations = invitations;
    if (events !== undefined) patch.events = events;
    if (hosting !== undefined) patch.hosting = hosting;
    if (cars !== undefined) patch.cars = cars;
    if (accommodation !== undefined) patch.accommodation = accommodation;
    if (supplies !== undefined) patch.supplies = supplies;
    if (tickets !== undefined) patch.tickets = tickets;
    if (contacts !== undefined) patch.contacts = contacts;
    if (feedback !== undefined) patch.feedback = feedback;

    const eventAll = normalizeWithFallback(counterOverrides.event?.all, fallbackActivities.event?.all);
    const eventActive = normalizeWithFallback(counterOverrides.event?.active, fallbackActivities.event?.active);
    const eventPending = normalizeWithFallback(counterOverrides.event?.pending, fallbackActivities.event?.pending);
    const eventInvitations = normalizeWithFallback(counterOverrides.event?.invitations, fallbackActivities.event?.invitations);
    const eventHosting = normalizeWithFallback(counterOverrides.event?.hosting, fallbackActivities.event?.hosting);
    const eventDrafts = normalizeWithFallback(counterOverrides.event?.drafts, fallbackActivities.event?.drafts);
    const eventTrash = normalizeWithFallback(counterOverrides.event?.trash, fallbackActivities.event?.trash);
    if (eventAll !== undefined || eventActive !== undefined || eventPending !== undefined
      || eventInvitations !== undefined || eventHosting !== undefined
      || eventDrafts !== undefined || eventTrash !== undefined
    ) {
      patch.event = {
        all: eventAll ?? 0,
        active: eventActive ?? 0,
        pending: eventPending ?? 0,
        invitations: eventInvitations ?? 0,
        hosting: eventHosting ?? 0,
        drafts: eventDrafts ?? 0,
        trash: eventTrash ?? 0
      };
    }

    const assetCars = normalizeWithFallback(counterOverrides.asset?.cars, fallbackActivities.asset?.cars);
    const assetAccommodation = normalizeWithFallback(counterOverrides.asset?.accommodation, fallbackActivities.asset?.accommodation);
    const assetSupplies = normalizeWithFallback(counterOverrides.asset?.supplies, fallbackActivities.asset?.supplies);
    const assetTickets = normalizeWithFallback(counterOverrides.asset?.tickets, fallbackActivities.asset?.tickets);
    if (assetCars !== undefined || assetAccommodation !== undefined || assetSupplies !== undefined || assetTickets !== undefined) {
      patch.asset = {
        cars: assetCars ?? 0,
        accommodation: assetAccommodation ?? 0,
        supplies: assetSupplies ?? 0,
        tickets: assetTickets ?? 0
      };
    }

    const feedbackOwnEvents = normalizeWithFallback(counterOverrides.eventFeedback?.ownEvents, fallbackActivities.eventFeedback?.ownEvents);
    const feedbackPending = normalizeWithFallback(counterOverrides.eventFeedback?.pending, fallbackActivities.eventFeedback?.pending);
    const feedbackFeedbacked = normalizeWithFallback(counterOverrides.eventFeedback?.feedbacked, fallbackActivities.eventFeedback?.feedbacked);
    const feedbackRemoved = normalizeWithFallback(counterOverrides.eventFeedback?.removed, fallbackActivities.eventFeedback?.removed);
    if (feedbackOwnEvents !== undefined || feedbackPending !== undefined || feedbackFeedbacked !== undefined || feedbackRemoved !== undefined) {
      patch.eventFeedback = {
        ownEvents: feedbackOwnEvents ?? 0,
        pending: feedbackPending ?? 0,
        feedbacked: feedbackFeedbacked ?? 0,
        removed: feedbackRemoved ?? 0
      };
    }

    if (adminJobs !== undefined) patch.adminJobs = adminJobs;
    if (adminMetrics !== undefined) patch.adminMetrics = adminMetrics;

    return patch;
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
      profileDetails: this.cloneProfileDetails(user.profileDetails),
      activities: {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0)),
        cars: Math.max(0, Math.trunc(Number(user.activities?.cars) || 0)),
        accommodation: Math.max(0, Math.trunc(Number(user.activities?.accommodation) || 0)),
        supplies: Math.max(0, Math.trunc(Number(user.activities?.supplies) || 0)),
        tickets: Math.max(0, Math.trunc(Number(user.activities?.tickets) || 0)),
        contacts: Math.max(0, Math.trunc(Number(user.activities?.contacts) || 0)),
        feedback: Math.max(0, Math.trunc(Number(user.activities?.feedback) || 0)),
        event: {
          all: Math.max(0, Math.trunc(Number(user.activities?.event?.all) || 0)),
          active: Math.max(0, Math.trunc(Number(user.activities?.event?.active) || 0)),
          pending: Math.max(0, Math.trunc(Number(user.activities?.event?.pending) || 0)),
          invitations: Math.max(0, Math.trunc(Number(user.activities?.event?.invitations) || 0)),
          hosting: Math.max(0, Math.trunc(Number(user.activities?.event?.hosting) || 0)),
          drafts: Math.max(0, Math.trunc(Number(user.activities?.event?.drafts) || 0)),
          trash: Math.max(0, Math.trunc(Number(user.activities?.event?.trash) || 0))
        },
        asset: {
          cars: Math.max(0, Math.trunc(Number(user.activities?.asset?.cars) || 0)),
          accommodation: Math.max(0, Math.trunc(Number(user.activities?.asset?.accommodation) || 0)),
          supplies: Math.max(0, Math.trunc(Number(user.activities?.asset?.supplies) || 0)),
          tickets: Math.max(0, Math.trunc(Number(user.activities?.asset?.tickets) || 0))
        },
        eventFeedback: {
          ownEvents: Math.max(0, Math.trunc(Number(user.activities?.eventFeedback?.ownEvents) || 0)),
          pending: Math.max(0, Math.trunc(Number(user.activities?.eventFeedback?.pending) || 0)),
          feedbacked: Math.max(0, Math.trunc(Number(user.activities?.eventFeedback?.feedbacked) || 0)),
          removed: Math.max(0, Math.trunc(Number(user.activities?.eventFeedback?.removed) || 0))
        },
        adminJobs: Math.max(0, Math.trunc(Number(user.activities?.adminJobs) || 0)),
        adminMetrics: Math.max(0, Math.trunc(Number(user.activities?.adminMetrics) || 0))
      }
    };
  }

  private cloneProfileDetails(groups: UserDto['profileDetails']): UserDto['profileDetails'] {
    if (!groups) {
      return undefined;
    }
    return groups.map(group => ({
      title: `${group.title ?? ''}`,
      rows: (group.rows ?? []).map(row => ({
        labelKey: `${row.labelKey ?? ''}`,
        value: `${row.value ?? ''}`,
        privacy: row.privacy,
        options: [...(row.options ?? [])]
      }))
    }));
  }
}
