import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  DemoUserListItemDto,
  UserByIdQueryResponse,
  UserImpressionsDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto,
  UserImpressionsSectionDto,
  UserProfileImageUploadResult,
  UserService,
  UsersListQueryResponse,
  UserDto
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UserService {
  private static readonly PROFILE_IMAGE_UPLOAD_ROUTE = '/auth/me/profile-image';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly MAX_PROFILE_IMAGE_SLOTS = 8;
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    try {
      const response = await this.http
        .get<UserDto[] | null>(`${this.apiBaseUrl}/auth/demo-users`)
        .toPromise();
      if (!Array.isArray(response)) {
        return { users: [] };
      }
      return {
        users: response
          .map(user => this.cloneUser(user))
          .map(user => this.toDemoUserListItem(user))
      };
    } catch {
      return { users: [] };
    }
  }

  async queryUserById(_userId: string): Promise<UserByIdQueryResponse> {
    try {
      type HttpUserByIdResponse = UserDto & {
        filterCount?: number;
        filterPreferences?: UserGameFilterPreferencesDto | null;
      };
      const me = await this.http
        .get<HttpUserByIdResponse | null>(`${this.apiBaseUrl}/auth/me`)
        .toPromise();
      if (!me) {
        return { user: null };
      }
      return {
        user: this.cloneUser(me),
        filterCount: Number.isFinite(me.filterCount) ? Math.max(0, Math.trunc(Number(me.filterCount))) : undefined,
        filterPreferences: me.filterPreferences ?? null
      };
    } catch {
      return { user: null };
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
    try {
      const response = await this.http
        .post<UserDto | null>(`${this.apiBaseUrl}/auth/me/profile`, user)
        .toPromise();
      if (!response) {
        return this.cloneUser(user);
      }
      return this.cloneUser(response);
    } catch {
      return this.cloneUser(user);
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
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      impressions: this.cloneImpressions(user.impressions),
      activities: {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0))
      }
    };
  }

  private cloneImpressionsSection(section?: UserImpressionsSectionDto): UserImpressionsSectionDto | undefined {
    if (!section) {
      return undefined;
    }
    return {
      ...section,
      vibeBadges: [...(section.vibeBadges ?? [])],
      personalityBadges: [...(section.personalityBadges ?? [])],
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
        tickets: Math.max(0, Math.trunc((user.activities.events + user.activities.hosting) / 2))
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
    normalized.impressionsHostChanged = counters.impressionsHostChanged === true;
    normalized.impressionsMemberChanged = counters.impressionsMemberChanged === true;
    return normalized;
  }

  private toDemoUserListItem(user: UserDto): DemoUserListItemDto {
    return {
      id: user.id,
      name: user.name,
      city: user.city,
      initials: user.initials,
      gender: user.gender
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
