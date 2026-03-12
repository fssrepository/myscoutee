import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  DemoUserListItemDto,
  UserByIdQueryResponse,
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
      activities: {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0))
      }
    };
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
