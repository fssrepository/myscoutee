import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  DemoUserListItemDto,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserByIdQueryResponse,
  UserLocationEligibilityResponseDto,
  UserImpressionsDto,
  UserLogoutRequestDto,
  UserMenuCountersDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto,
  UserImpressionsSectionDto,
  UserProfileImageUploadResult,
  UserReportUserSubmitRequestDto,
  UserService,
  UserSubmitActionResponseDto,
  UsersListQueryResponse,
  UserDto
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { LocationCoordinates } from '../../base/interfaces/location.interface';
import { OfflineCacheService } from '../../base/services/offline-cache.service';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UserService {
  private static readonly PROFILE_IMAGE_UPLOAD_ROUTE = '/auth/me/profile-image';
  private static readonly USER_FEEDBACK_ROUTE = '/auth/me/feedback';
  private static readonly USER_REPORT_USER_ROUTE = '/auth/me/report-user';
  private static readonly USER_LOGOUT_ROUTE = '/auth/me/logout';
  private static readonly USER_DELETE_ROUTE = '/auth/me/delete';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly MAX_PROFILE_IMAGE_SLOTS = 8;
  private readonly http = inject(HttpClient);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    type HttpDemoUserListEntry = Partial<UserDto> & Partial<DemoUserListItemDto> & {
      gender?: string | null;
    };
    const response = await this.http
      .get<HttpDemoUserListEntry[] | null>(`${this.apiBaseUrl}/auth/demo-users`)
      .toPromise();
    if (!Array.isArray(response)) {
      return { users: [] };
    }
    return {
      users: response
        .map(user => this.toDemoUserListItem(user))
        .filter((user): user is DemoUserListItemDto => user !== null)
    };
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
      locationRequired: response?.locationRequired === true
    };
  }

  async queryUserById(userId?: string): Promise<UserByIdQueryResponse> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    try {
      type HttpUserByIdResponse = UserDto & {
        filterCount?: number;
        filterPreferences?: UserGameFilterPreferencesDto | null;
        counterOverrides?: UserMenuCountersDto | null;
      };
      const me = await this.http
        .get<HttpUserByIdResponse | null>(`${this.apiBaseUrl}/auth/me`, {
          params: normalizedUserId ? { userId: normalizedUserId } : {}
        })
        .toPromise();
      if (!me) {
        return { user: null };
      }
      const user = this.cloneUser(me);
      return this.cacheUserResponse({
        user,
        filterCount: Number.isFinite(me.filterCount) ? Math.max(0, Math.trunc(Number(me.filterCount))) : undefined,
        filterPreferences: me.filterPreferences ?? null,
        counterOverrides: this.buildInitialMenuCounterOverrides(user, me.counterOverrides)
      });
    } catch {
      const cached = this.offlineCache.readUser(normalizedUserId);
      return cached ?? { user: null };
    }
  }

  async queryUserRealtimeLongPoll(
    userId: string,
    cursor: string | null = null
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
      const response = await this.http
        .post<HttpLongPollResponse | null>(
          `${this.apiBaseUrl}${HttpUsersService.USER_REALTIME_LONG_POLL_ROUTE}`,
          { userId: normalizedUserId, cursor }
        )
        .toPromise();
      if (!response || !response.counters) {
        return this.buildFallbackLongPollSnapshot(normalizedUserId, cursor);
      }
      return {
        userId: (response.userId ?? normalizedUserId).trim() || normalizedUserId,
        counters: this.normalizeRealtimeCounters(response.counters),
        impressions: this.cloneImpressions(response.impressions),
        cursor: typeof response.cursor === 'string' ? response.cursor.trim() : null,
        serverTsIso: typeof response.serverTsIso === 'string'
          ? response.serverTsIso
          : new Date().toISOString()
      };
    } catch {
      return this.buildFallbackLongPollSnapshot(normalizedUserId, cursor);
    }
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    try {
      await this.http
        .post(`${this.apiBaseUrl}/auth/me/filter-preferences`, {
          userId: normalizedUserId,
          filterPreferences: preferences
        })
        .toPromise();
    } catch {
      // Keep UI state optimistic if backend endpoint is unavailable.
    }
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    const response = await this.http
      .post<UserDto | null>(`${this.apiBaseUrl}/auth/me/profile`, user)
      .toPromise();
    if (!response) {
      return this.cloneUser(user);
    }
    return this.cloneUser(response);
  }

  async submitUserFeedback(
    request: UserFeedbackSubmitRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.postAbortable<UserSubmitActionResponseDto>(
        `${this.apiBaseUrl}${HttpUsersService.USER_FEEDBACK_ROUTE}`,
        request,
        signal
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
      return {
        submitted: false,
        message: 'Unable to send feedback.'
      };
    }
  }

  async submitReportUser(
    request: UserReportUserSubmitRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.postAbortable<UserSubmitActionResponseDto>(
        `${this.apiBaseUrl}${HttpUsersService.USER_REPORT_USER_ROUTE}`,
        request,
        signal
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
      return {
        submitted: false,
        message: 'Unable to submit report.'
      };
    }
  }

  async logoutUser(
    request: UserLogoutRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.postAbortable<UserSubmitActionResponseDto>(
        `${this.apiBaseUrl}${HttpUsersService.USER_LOGOUT_ROUTE}`,
        request,
        signal
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
      return {
        submitted: false,
        message: 'Unable to log out.'
      };
    }
  }

  async deleteUser(
    request: UserDeleteRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    try {
      const response = await this.postAbortable<UserSubmitActionResponseDto>(
        `${this.apiBaseUrl}${HttpUsersService.USER_DELETE_ROUTE}`,
        request,
        signal
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
      return {
        submitted: false,
        message: 'Unable to delete account.'
      };
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
    const normalizedSlotIndex = this.resolveSlotIndex(slotIndex);
    if (normalizedSlotIndex === null) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const formData = new FormData();
    formData.append('image', file, file.name);
    formData.append('slotIndex', String(normalizedSlotIndex));
    formData.append('userId', normalizedUserId);
    try {
      type UploadResponse = {
        imageUrl?: string | null;
        url?: string | null;
      };
      const response = await this.http
        .post<UploadResponse | null>(`${this.apiBaseUrl}${HttpUsersService.PROFILE_IMAGE_UPLOAD_ROUTE}`, formData)
        .toPromise();
      const resolvedImageUrl =
        (typeof response?.imageUrl === 'string' && response.imageUrl.trim().length > 0
          ? response.imageUrl.trim()
          : null)
        ?? (typeof response?.url === 'string' && response.url.trim().length > 0
          ? response.url.trim()
          : null);
      return {
        uploaded: true,
        imageUrl: resolvedImageUrl
      };
    } catch {
      return {
        uploaded: false,
        imageUrl: null
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
      impressions: this.cloneImpressions(user.impressions),
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

  private cacheUserResponse(response: UserByIdQueryResponse): UserByIdQueryResponse {
    if (!response.user?.id?.trim()) {
      return response;
    }
    this.offlineCache.writeUser(response.user.id.trim(), response);
    return response;
  }

  private cloneImpressionsSection(section?: UserImpressionsSectionDto): UserImpressionsSectionDto | undefined {
    if (!section) {
      return undefined;
    }
    return {
      ...section,
      vibeBadges: [...(section.vibeBadges ?? [])],
      personalityBadges: [...(section.personalityBadges ?? [])],
      personalityTraits: (section.personalityTraits ?? []).map(trait => ({
        ...trait
      })),
      categoryBadges: [...(section.categoryBadges ?? [])]
    };
  }

  private cloneImpressions(impressions?: UserImpressionsDto): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    return {
      host: this.cloneImpressionsSection(impressions.host),
      member: this.cloneImpressionsSection(impressions.member)
    };
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
      tickets: this.normalizeInitialCounterValue(overrides?.tickets, user.activities?.tickets),
      feedback: this.normalizeInitialCounterValue(overrides?.feedback, user.activities?.feedback)
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
    const user = byIdResponse.user;
    return {
      userId: normalizedUserId,
      counters: this.normalizeRealtimeCounters({
        game: user.activities.game,
        chat: user.activities.chat,
        invitations: user.activities.invitations,
        events: user.activities.events,
        hosting: user.activities.hosting,
        tickets: Math.max(0, Math.trunc(Number(user.activities.tickets) || 0)),
        feedback: Math.max(0, Math.trunc(Number(user.activities.feedback) || 0))
      }),
      impressions: this.cloneImpressions(user.impressions),
      cursor,
      serverTsIso: new Date().toISOString()
    };
  }

  private normalizeRealtimeCounters(counters: UserRealtimeCountersDto): UserRealtimeCountersDto {
    const normalize = (value: unknown): number | undefined => {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const normalized: UserRealtimeCountersDto = {};
    const game = normalize(counters.game);
    const chat = normalize(counters.chat);
    const invitations = normalize(counters.invitations);
    const events = normalize(counters.events);
    const hosting = normalize(counters.hosting);
    const tickets = normalize(counters.tickets);
    const feedback = normalize(counters.feedback);
    if (game !== undefined) {
      normalized.game = game;
    }
    if (chat !== undefined) {
      normalized.chat = chat;
    }
    if (invitations !== undefined) {
      normalized.invitations = invitations;
    }
    if (events !== undefined) {
      normalized.events = events;
    }
    if (hosting !== undefined) {
      normalized.hosting = hosting;
    }
    if (tickets !== undefined) {
      normalized.tickets = tickets;
    }
    if (feedback !== undefined) {
      normalized.feedback = feedback;
    }
    normalized.impressionsHostChanged = counters.impressionsHostChanged === true;
    normalized.impressionsMemberChanged = counters.impressionsMemberChanged === true;
    return normalized;
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

  private toDemoUserListItem(user: Partial<UserDto> & Partial<DemoUserListItemDto> & { gender?: string | null }): DemoUserListItemDto | null {
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
      gender: normalizedGender
    };
  }

  private resolveSlotIndex(slotIndex: number): number | null {
    if (!Number.isFinite(slotIndex)) {
      return null;
    }
    const normalized = Math.trunc(Number(slotIndex));
    if (normalized < 0 || normalized >= HttpUsersService.MAX_PROFILE_IMAGE_SLOTS) {
      return null;
    }
    return normalized;
  }
}
