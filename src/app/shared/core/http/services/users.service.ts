import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
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
import { AppContext } from '../../../ui/context';
import { UserRealtimeSnapshotConverter } from '../../base/converters';
import { bootstrapProcessStep, type BootstrapProcessState } from '../../base/services/bootstrap.service';
import { OfflineCacheService } from '../../base/services/offline-cache.service';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { SessionService } from '../../base/services/session.service';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_FEEDBACK_ROUTE = '/auth/me/feedback';
  private static readonly USER_FILTER_PREFERENCES_ROUTE = '/auth/me/preferences';
  private static readonly USER_REPORT_USER_ROUTE = '/auth/me/report-user';
  private static readonly USER_LOGOUT_ROUTE = '/auth/me/logout';
  private static readonly USER_DELETE_ROUTE = '/auth/me/delete';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
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
    return cached?.user ? this.cloneUser(cached.user) : null;
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
      const user = this.cloneUser(me);
      return this.cacheUserResponse({
        user,
        filterCount: Number.isFinite(me.filterCount) ? Math.max(0, Math.trunc(Number(me.filterCount))) : undefined,
        filterPreferences: me.filterPreferences ?? null,
        counterOverrides: this.buildInitialMenuCounterOverrides(user, me.counterOverrides)
      });
    } catch (error) {
      if (this.isTimeoutError(error, 'User details request timeout.')) {
        throw error;
      }
      const cached = this.offlineCache.readUser(normalizedUserId);
      return cached ?? this.readUserByIdFallback(normalizedUserId) ?? { user: null };
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
        return this.buildFallbackLongPollSnapshot(normalizedUserId, cursor);
      }
      return UserRealtimeSnapshotConverter.snapshot(response, normalizedUserId, cursor);
    } catch (error) {
      if (this.isTimeoutError(error, 'User realtime request timeout.')) {
        throw error;
      }
      return this.buildFallbackLongPollSnapshot(normalizedUserId, cursor);
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
      return this.cloneUser(user);
    }
    return this.cloneUser(response);
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
      impressions: UserRealtimeSnapshotConverter.impressions(user.impressions),
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
          all: this.normalizeInitialCounterValue(user.activities?.event?.all, 0),
          active: this.normalizeInitialCounterValue(user.activities?.event?.active, 0),
          pending: this.normalizeInitialCounterValue(user.activities?.event?.pending, 0),
          invitations: this.normalizeInitialCounterValue(user.activities?.event?.invitations, 0),
          hosting: this.normalizeInitialCounterValue(user.activities?.event?.hosting, 0),
          drafts: this.normalizeInitialCounterValue(user.activities?.event?.drafts, 0),
          trash: this.normalizeInitialCounterValue(user.activities?.event?.trash, 0)
        },
        asset: {
          cars: this.normalizeInitialCounterValue(user.activities?.asset?.cars, 0),
          accommodation: this.normalizeInitialCounterValue(user.activities?.asset?.accommodation, 0),
          supplies: this.normalizeInitialCounterValue(user.activities?.asset?.supplies, 0),
          tickets: this.normalizeInitialCounterValue(user.activities?.asset?.tickets, 0)
        },
        eventFeedback: {
          ownEvents: this.normalizeInitialCounterValue(user.activities?.eventFeedback?.ownEvents, 0),
          pending: this.normalizeInitialCounterValue(user.activities?.eventFeedback?.pending, 0),
          feedbacked: this.normalizeInitialCounterValue(user.activities?.eventFeedback?.feedbacked, 0),
          removed: this.normalizeInitialCounterValue(user.activities?.eventFeedback?.removed, 0)
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

  private cacheUserResponse(response: UserByIdQueryResponse): UserByIdQueryResponse {
    if (!response.user?.id?.trim()) {
      return response;
    }
    this.offlineCache.writeUser(response.user.id.trim(), response);
    return response;
  }

  private readUserByIdFallback(userId: string): UserByIdQueryResponse | null {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return null;
    }

    const activeProfile = this.appCtx.activeUserProfile();
    if (activeProfile) {
      return {
        user: this.cloneUser(activeProfile)
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
      images: session.profile.imageUrl?.trim() ? [session.profile.imageUrl.trim()] : [],
      profileStatus: 'onboarding',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
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
    });
  }

  private buildInitialMenuCounterOverrides(
    user: UserDto,
    overrides?: UserMenuCountersDto | null
  ): UserMenuCountersDto {
    return {
      game: this.normalizeInitialCounterValue(overrides?.game, user.activities?.game),
      chat: this.normalizeInitialCounterValue(overrides?.chat, user.activities?.chat),
      invitations: this.normalizeInitialCounterValue(overrides?.invitations, user.activities?.invitations),
      events: this.normalizeInitialCounterValue(overrides?.events, user.activities?.events),
      hosting: this.normalizeInitialCounterValue(overrides?.hosting, user.activities?.hosting),
      cars: this.normalizeInitialCounterValue(overrides?.cars, user.activities?.cars),
      accommodation: this.normalizeInitialCounterValue(overrides?.accommodation, user.activities?.accommodation),
      supplies: this.normalizeInitialCounterValue(overrides?.supplies, user.activities?.supplies),
      tickets: this.normalizeInitialCounterValue(overrides?.tickets, user.activities?.tickets),
      contacts: this.normalizeInitialCounterValue(overrides?.contacts, user.activities?.contacts),
      feedback: this.normalizeInitialCounterValue(overrides?.feedback, user.activities?.feedback),
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

  private async buildFallbackLongPollSnapshot(
    normalizedUserId: string,
    cursor: string | null
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    const byIdResponse = await this.queryUserById(normalizedUserId);
    if (!byIdResponse.user) {
      return null;
    }
    return UserRealtimeSnapshotConverter.snapshotFromUser(byIdResponse.user, cursor, {
      userId: normalizedUserId
    });
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
