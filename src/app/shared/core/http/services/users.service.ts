import {
  HttpClient
} from '@angular/common/http';
import {
  Injectable,
  inject
} from '@angular/core';

import {
  environment
} from '../../../../../environments/environment';
import type {
  ProfileExtDto,
  ProfileExtByIdQueryResponse,
  UserSelectorListItemDto,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserByIdQueryResponse,
  UserLocationEligibilityResponseDto,
  UserImpressionsDto,
  UserLogoutRequestDto,
  UserMenuCountersDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto,
  UserReportUserSubmitRequestDto,
  UserSelectorRole,
  UserService,
  UserSubmitActionResponseDto,
  UserDto
} from '../../contracts/user.interface';
import type { UserGameFilterPreferencesDto } from '../../contracts/activity.interface';
import type { LocationCoordinates } from '../../contracts/user.interface';
import {
  bootstrapProcessStep,
  type BootstrapProcessState
} from '../../base/services/bootstrap.service';
import {
  OfflineCacheService
} from '../../base/services/offline-cache.service';
import {
  RouteDelayService
} from '../../base/services/route-delay.service';
import {
  SessionService
} from '../../base/services/session.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_PROFILE_EXT_ROUTE = '/auth/me/profile-ext';
  private static readonly USER_FEEDBACK_ROUTE = '/auth/me/feedback';
  private static readonly USER_FILTER_PREFERENCES_ROUTE = '/auth/me/preferences';
  private static readonly USER_REPORT_USER_ROUTE = '/auth/me/report-user';
  private static readonly USER_LOGOUT_ROUTE = '/auth/me/logout';
  private static readonly USER_DELETE_ROUTE = '/auth/me/delete';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private readonly http = inject(HttpClient);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly sessionService = inject(SessionService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryAvailableDemoUsers(selectorRole: UserSelectorRole = 'member'): Promise<UserSelectorListItemDto[]> {
    type HttpDemoUserListEntry = Partial<UserDto> & Partial<UserSelectorListItemDto> & {
      gender?: string | null;
    };
    const response = await this.routeDelay.withRequestTimeout(
      HttpUsersService.DEMO_USERS_ROUTE,
      this.http
        .get<HttpDemoUserListEntry[] | null>(`${this.apiBaseUrl}/auth/demo-users`, {
          params: {
            role: selectorRole
          }
        })
        .toPromise(),
      'Users request timeout.'
    );
    if (!Array.isArray(response)) {
      return [];
    }
    return response
      .map(user => this.toDemoUserListItem(user))
      .filter((user): user is UserSelectorListItemDto => user !== null);
  }

  prepareUserSession(_userId: string, onProgress?: (state: BootstrapProcessState) => void): Promise<void> {
    onProgress?.(bootstrapProcessStep('sessionReady'));
    return Promise.resolve();
  }

  peekCachedUsers(): UserDto[] {
    return [];
  }

  peekCachedUserById(userId: string): UserDto | null {
    const cached = this.offlineCache.readUser(userId.trim());
    return cached?.user ?? null;
  }

  async checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto> {
    const hasCoordinates = !!coordinates
      && Number.isFinite(Number(coordinates.latitude))
      && Number.isFinite(Number(coordinates.longitude));
    const response = await this.http
      .get<UserLocationEligibilityResponseDto>(`${this.apiBaseUrl}/auth/eligibility`, {
        params: hasCoordinates
          ? {
              latitude: `${Number(coordinates?.latitude)}`,
              longitude: `${Number(coordinates?.longitude)}`
            }
          : {}
      })
      .toPromise();
    return {
      eligible: response?.eligible === true,
      partitionKey: typeof response?.partitionKey === 'string' ? response.partitionKey : null,
      message: typeof response?.message === 'string' ? response.message : null,
      securityGateEnabled: response?.securityGateEnabled === true,
      locationRequired: false
    };
  }

  async queryUserById(userId?: string, requestTimeoutMs?: number): Promise<UserByIdQueryResponse> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    try {
      type HttpUserByIdResponse = UserDto & {
        filterCount?: number;
        filterPreferences?: UserGameFilterPreferencesDto | null;
        counterOverrides?: UserMenuCountersDto | null;
      };
      const me = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_BY_ID_ROUTE,
        this.http
          .get<HttpUserByIdResponse | null>(`${this.apiBaseUrl}/auth/me`, {
            params: normalizedUserId ? { userId: normalizedUserId } : {}
          })
          .toPromise(),
        'User details request timeout.',
        requestTimeoutMs
      );
      if (!me) {
        return this.readUserByIdFallback(normalizedUserId) ?? { user: null };
      }
      return this.cacheUserResponse({
        user: me,
        filterCount: Number.isFinite(me.filterCount) ? Math.max(0, Math.trunc(Number(me.filterCount))) : undefined,
        filterPreferences: me.filterPreferences ?? null,
        counterOverrides: this.buildInitialMenuCounterOverrides(me, me.counterOverrides)
      });
    } catch (error) {
      if (this.isTimeoutError(error, 'User details request timeout.')) {
        throw error;
      }
      const cached = this.offlineCache.readUser(normalizedUserId);
      return cached ?? this.readUserByIdFallback(normalizedUserId) ?? { user: null };
    }
  }

  async loadProfileExtById(userId?: string, requestTimeoutMs?: number): Promise<ProfileExtByIdQueryResponse> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_PROFILE_EXT_ROUTE,
        this.http
          .get<ProfileExtByIdQueryResponse | null>(`${this.apiBaseUrl}${HttpUsersService.USER_PROFILE_EXT_ROUTE}`, {
            params: normalizedUserId ? { userId: normalizedUserId } : {}
          })
          .toPromise(),
        'User profile request timeout.',
        requestTimeoutMs
      );
      const profileExt = response?.profileExt ?? null;
      if (!profileExt) {
        const cached = this.readProfileExtByIdFallback(normalizedUserId);
        return cached ?? { profileExt: null };
      }
      return {
        profileExt,
        filterCount: Number.isFinite(response?.filterCount)
          ? Math.max(0, Math.trunc(Number(response?.filterCount)))
          : undefined,
        filterPreferences: response?.filterPreferences ?? null,
        counterOverrides: this.buildInitialMenuCounterOverrides(profileExt.profile, response?.counterOverrides ?? null)
      };
    } catch (error) {
      if (this.isTimeoutError(error, 'User profile request timeout.')) {
        throw error;
      }
      return this.readProfileExtByIdFallback(normalizedUserId) ?? { profileExt: null };
    }
  }

  async queryUserRealtimeLongPoll(
    userId: string,
    cursor: string | null = null,
    requestTimeoutMs?: number
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    try {
      type HttpLongPollResponse = {
        userId?: string;
        counters?: UserRealtimeCountersDto;
        impressions?: UserImpressionsDto;
        cursor?: string | null;
        serverTsIso?: string;
      };
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_REALTIME_LONG_POLL_ROUTE,
        this.http
          .post<HttpLongPollResponse | null>(
            `${this.apiBaseUrl}${HttpUsersService.USER_REALTIME_LONG_POLL_ROUTE}`,
            { userId: normalizedUserId, cursor }
          )
          .toPromise(),
        'User realtime request timeout.',
        requestTimeoutMs
      );
      if (!response || !response.counters) {
        return null;
      }
      return {
        userId: response.userId ?? normalizedUserId,
        counters: response.counters,
        impressions: response.impressions,
        cursor: response.cursor,
        serverTsIso: response.serverTsIso
      };
    } catch (error) {
      if (this.isTimeoutError(error, 'User realtime request timeout.')) {
        throw error;
      }
      return null;
    }
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    try {
      await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_FILTER_PREFERENCES_ROUTE,
        this.http
          .post(`${this.apiBaseUrl}/auth/me/filter-preferences`, {
            userId: normalizedUserId,
            filterPreferences: preferences
          })
          .toPromise()
      );
    } catch {
      // Keep UI state optimistic if backend endpoint is unavailable.
    }
  }

  async saveUserProfile(user: UserDto, requestTimeoutMs?: number): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpUsersService.USER_BY_ID_ROUTE,
      this.http
        .post<UserDto | null>(`${this.apiBaseUrl}/auth/me/profile`, user)
        .toPromise(),
      'Profile save request timeout.',
      requestTimeoutMs
    );
    if (!response) {
      return user;
    }
    return response;
  }

  async saveUserProfileExt(request: ProfileExtDto, requestTimeoutMs?: number): Promise<UserDto | null> {
    if (!request?.profile?.id?.trim()) {
      return null;
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpUsersService.USER_PROFILE_EXT_ROUTE,
      this.http
        .post<UserDto | null>(`${this.apiBaseUrl}${HttpUsersService.USER_PROFILE_EXT_ROUTE}`, request)
        .toPromise(),
      'Profile save request timeout.',
      requestTimeoutMs
    );
    if (!response) {
      return request.profile;
    }
    return response;
  }

  async submitUserFeedback(
    request: UserFeedbackSubmitRequestDto,
    signal?: AbortSignal,
    requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_FEEDBACK_ROUTE,
        this.postAbortable<UserSubmitActionResponseDto>(
          `${this.apiBaseUrl}${HttpUsersService.USER_FEEDBACK_ROUTE}`,
          request,
          signal
        ),
        'Feedback request timeout.',
        requestTimeoutMs
      );
      if (!response) {
        return { submitted: true, message: null };
      }
      return {
        submitted: response.submitted !== false,
        message: typeof response.message === 'string' ? response.message : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (this.isTimeoutError(error, 'Feedback request timeout.')) {
        throw error;
      }
      return {
        submitted: false,
        message: 'Unable to send feedback.'
      };
    }
  }

  async submitReportUser(
    request: UserReportUserSubmitRequestDto,
    signal?: AbortSignal,
    requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_REPORT_USER_ROUTE,
        this.postAbortable<UserSubmitActionResponseDto>(
          `${this.apiBaseUrl}${HttpUsersService.USER_REPORT_USER_ROUTE}`,
          request,
          signal
        ),
        'Report request timeout.',
        requestTimeoutMs
      );
      if (!response) {
        return { submitted: true, message: null };
      }
      return {
        submitted: response.submitted !== false,
        message: typeof response.message === 'string' ? response.message : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (this.isTimeoutError(error, 'Report request timeout.')) {
        throw error;
      }
      return {
        submitted: false,
        message: 'Unable to submit report.'
      };
    }
  }

  async logoutUser(
    request: UserLogoutRequestDto,
    signal?: AbortSignal,
    requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_LOGOUT_ROUTE,
        this.postAbortable<UserSubmitActionResponseDto>(
          `${this.apiBaseUrl}${HttpUsersService.USER_LOGOUT_ROUTE}`,
          request,
          signal
        ),
        'Logout request timeout.',
        requestTimeoutMs
      );
      if (!response) {
        return { submitted: true, message: null };
      }
      return {
        submitted: response.submitted !== false,
        message: typeof response.message === 'string' ? response.message : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (this.isTimeoutError(error, 'Logout request timeout.')) {
        throw error;
      }
      return {
        submitted: false,
        message: 'Unable to log out.'
      };
    }
  }

  async deleteUser(
    request: UserDeleteRequestDto,
    signal?: AbortSignal,
    requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpUsersService.USER_DELETE_ROUTE,
        this.postAbortable<UserSubmitActionResponseDto>(
          `${this.apiBaseUrl}${HttpUsersService.USER_DELETE_ROUTE}`,
          request,
          signal
        ),
        'Delete account request timeout.',
        requestTimeoutMs
      );
      if (!response) {
        return { submitted: true, message: null };
      }
      return {
        submitted: response.submitted !== false,
        message: typeof response.message === 'string' ? response.message : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (this.isTimeoutError(error, 'Delete account request timeout.')) {
        throw error;
      }
      return {
        submitted: false,
        message: 'Unable to delete account.'
      };
    }
  }

  private cacheUserResponse(response: UserByIdQueryResponse): UserByIdQueryResponse {
    if (!response.user?.id?.trim()) {
      return response;
    }
    this.offlineCache.writeUser(response.user.id.trim(), response);
    return response;
  }

  private readProfileExtByIdFallback(userId: string): ProfileExtByIdQueryResponse | null {
    const cached = this.offlineCache.readUser(userId.trim());
    if (cached?.user) {
      return {
        profileExt: {
          profile: cached.user,
          experienceEntries: []
        },
        filterCount: cached.filterCount,
        filterPreferences: cached.filterPreferences,
        counterOverrides: cached.counterOverrides
      };
    }

    const fallback = this.readUserByIdFallback(userId);
    return fallback?.user
      ? {
          profileExt: {
            profile: fallback.user,
            experienceEntries: []
          },
          filterCount: fallback.filterCount,
          filterPreferences: fallback.filterPreferences,
          counterOverrides: fallback.counterOverrides
        }
      : null;
  }

  private readUserByIdFallback(userId: string): UserByIdQueryResponse | null {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return null;
    }

    const activeProfile = this.userProfileStore.activeUserProfile();
    if (activeProfile) {
      return {
        user: activeProfile
      };
    }

    const sessionUser = this.buildFirebaseSessionUser();
    return sessionUser
      ? {
          user: sessionUser
        }
      : null;
  }

  private buildFirebaseSessionUser(): UserDto | null {
    const session = this.sessionService.currentSession();
    if (session?.kind !== 'firebase') {
      return null;
    }

    return {
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
      images: session.profile.imageUrl?.trim() ? [session.profile.imageUrl.trim()] : [],
      profileStatus: 'onboarding',
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        chat: {
          all: 0,
          event: 0,
          subEvent: 0,
          group: 0,
          service: 0,
          appSupport: 0
        },
        event: {
          all: 0,
          active: 0,
          pending: 0,
          invitations: 0,
          hosting: 0,
          drafts: 0,
          trash: 0
        },
        asset: {
          cars: 0,
          accommodation: 0,
          supplies: 0,
          tickets: 0
        },
        eventFeedback: {
          ownEvents: 0,
          pending: 0,
          feedbacked: 0,
          removed: 0
        },
        adminJobs: 0,
        adminMetrics: 0
      }
    };
  }

  private buildInitialMenuCounterOverrides(
    user: UserDto,
    overrides?: UserMenuCountersDto | null
  ): UserMenuCountersDto {
    return {
      game: this.normalizeInitialCounterValue(overrides?.game, user.activities?.game),
      chats: this.normalizeInitialCounterValue(overrides?.chats, user.activities?.chats),
      invitations: this.normalizeInitialCounterValue(overrides?.invitations, user.activities?.invitations),
      events: this.normalizeInitialCounterValue(overrides?.events, user.activities?.events),
      hosting: this.normalizeInitialCounterValue(overrides?.hosting, user.activities?.hosting),
      cars: this.normalizeInitialCounterValue(overrides?.cars, user.activities?.cars),
      accommodation: this.normalizeInitialCounterValue(overrides?.accommodation, user.activities?.accommodation),
      supplies: this.normalizeInitialCounterValue(overrides?.supplies, user.activities?.supplies),
      tickets: this.normalizeInitialCounterValue(overrides?.tickets, user.activities?.tickets),
      contacts: this.normalizeInitialCounterValue(overrides?.contacts, user.activities?.contacts),
      feedback: this.normalizeInitialCounterValue(overrides?.feedback, user.activities?.feedback),
      chat: {
        all: this.normalizeInitialCounterValue(overrides?.chat?.all, user.activities?.chat?.all),
        event: this.normalizeInitialCounterValue(overrides?.chat?.event, user.activities?.chat?.event),
        subEvent: this.normalizeInitialCounterValue(overrides?.chat?.subEvent, user.activities?.chat?.subEvent),
        group: this.normalizeInitialCounterValue(overrides?.chat?.group, user.activities?.chat?.group),
        service: this.normalizeInitialCounterValue(overrides?.chat?.service, user.activities?.chat?.service),
        appSupport: this.normalizeInitialCounterValue(overrides?.chat?.appSupport, user.activities?.chat?.appSupport)
      },
      event: {
        all: this.normalizeInitialCounterValue(overrides?.event?.all, user.activities?.event?.all),
        active: this.normalizeInitialCounterValue(overrides?.event?.active, user.activities?.event?.active),
        pending: this.normalizeInitialCounterValue(overrides?.event?.pending, user.activities?.event?.pending),
        invitations: this.normalizeInitialCounterValue(overrides?.event?.invitations, user.activities?.event?.invitations),
        hosting: this.normalizeInitialCounterValue(overrides?.event?.hosting, user.activities?.event?.hosting),
        drafts: this.normalizeInitialCounterValue(overrides?.event?.drafts, user.activities?.event?.drafts),
        trash: this.normalizeInitialCounterValue(overrides?.event?.trash, user.activities?.event?.trash)
      },
      asset: {
        cars: this.normalizeInitialCounterValue(overrides?.asset?.cars, user.activities?.asset?.cars),
        accommodation: this.normalizeInitialCounterValue(overrides?.asset?.accommodation, user.activities?.asset?.accommodation),
        supplies: this.normalizeInitialCounterValue(overrides?.asset?.supplies, user.activities?.asset?.supplies),
        tickets: this.normalizeInitialCounterValue(overrides?.asset?.tickets, user.activities?.asset?.tickets)
      },
      eventFeedback: {
        ownEvents: this.normalizeInitialCounterValue(overrides?.eventFeedback?.ownEvents, user.activities?.eventFeedback?.ownEvents),
        pending: this.normalizeInitialCounterValue(overrides?.eventFeedback?.pending, user.activities?.eventFeedback?.pending),
        feedbacked: this.normalizeInitialCounterValue(overrides?.eventFeedback?.feedbacked, user.activities?.eventFeedback?.feedbacked),
        removed: this.normalizeInitialCounterValue(overrides?.eventFeedback?.removed, user.activities?.eventFeedback?.removed)
      },
      adminJobs: this.normalizeInitialCounterValue(overrides?.adminJobs, user.activities?.adminJobs),
      adminMetrics: this.normalizeInitialCounterValue(overrides?.adminMetrics, user.activities?.adminMetrics)
    };
  }

  private normalizeInitialCounterValue(primaryValue: unknown, fallbackValue: unknown): number {
    if (Number.isFinite(primaryValue)) {
      return Math.max(0, Math.trunc(Number(primaryValue)));
    }
    if (Number.isFinite(fallbackValue)) {
      return Math.max(0, Math.trunc(Number(fallbackValue)));
    }
    return 0;
  }

  private postAbortable<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let emitted = false;
      const subscription = this.http.post<T | null>(url, body).subscribe({
        next: response => {
          emitted = true;
          cleanup();
          resolve(response ?? null);
        },
        error: error => {
          cleanup();
          reject(error);
        },
        complete: () => {
          if (emitted) {
            return;
          }
          cleanup();
          resolve(null);
        }
      });
      const onAbort = () => {
        cleanup();
        subscription.unsubscribe();
        reject(this.createAbortError());
      };
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private isTimeoutError(error: unknown, message: string): boolean {
    return error instanceof Error && error.message === message;
  }

  private toDemoUserListItem(user: Partial<UserDto> & Partial<UserSelectorListItemDto> & { gender?: string | null }): UserSelectorListItemDto | null {
    const id = `${user.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    const normalizedGender = `${user.gender ?? ''}`.trim().toLowerCase() === 'man' ? 'man' : 'woman';
    return {
      id,
      name: `${user.name ?? ''}`.trim(),
      city: `${user.city ?? ''}`.trim(),
      initials: `${user.initials ?? ''}`.trim(),
      gender: normalizedGender,
      statusText: `${user.statusText ?? ''}`.trim(),
      completion: user.completion === undefined || user.completion === null
        ? undefined
        : Math.max(0, Math.trunc(Number(user.completion) || 0)),
      profileFormVersion: user.profileFormVersion === undefined || user.profileFormVersion === null
        ? undefined
        : Math.max(0, Math.trunc(Number(user.profileFormVersion) || 0)),
      profileStatus: user.profileStatus,
      deletedAtIso: typeof user.deletedAtIso === 'string' ? user.deletedAtIso : null
    };
  }
}
