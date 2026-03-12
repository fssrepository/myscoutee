import { Injectable, inject } from '@angular/core';

import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserByIdQueryResponse,
  UserDto,
  UserProfileImageUploadResult,
  UserService,
  UsersListQueryResponse
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly MAX_PROFILE_IMAGE_SLOTS = 8;
  private readonly usersRepository = inject(DemoUsersRepository);

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.DEMO_USERS_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      users: this.usersRepository.queryAvailableDemoUsers()
    };
  }

  async queryUserById(userId: string): Promise<UserByIdQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.USER_BY_ID_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = userId.trim();
    const user = this.usersRepository.queryUserById(normalizedUserId);
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filterCount = allUsers.length;
    const persistedFilterPreferences = this.usersRepository.queryUserFilterPreferences(normalizedUserId);
    return {
      user,
      filterCount,
      filterPreferences: user
        ? (persistedFilterPreferences ?? this.buildDefaultFilterPreferences(user))
        : null
    };
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    this.usersRepository.upsertUserFilterPreferences(userId, preferences);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    return this.usersRepository.upsertUser(user);
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
    const user = this.usersRepository.queryUserById(normalizedUserId);
    if (!user) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const imageDataUrl = await this.readFileAsDataUrl(file);
    if (!imageDataUrl) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const slots: Array<string | null> = Array.from(
      { length: DemoUsersService.MAX_PROFILE_IMAGE_SLOTS },
      (_, index) => user.images?.[index] ?? null
    );
    slots[normalizedSlotIndex] = imageDataUrl;
    this.usersRepository.upsertUser({
      ...user,
      images: slots
        .map(value => value?.trim() ?? '')
        .filter(value => value.length > 0)
    });
    return {
      uploaded: true,
      imageUrl: imageDataUrl
    };
  }

  private buildDefaultFilterPreferences(user: UserDto): UserGameFilterPreferencesDto {
    const parsedHeight = this.parseHeightCm(user.height);
    return {
      ageMin: Math.max(18, user.age - 5),
      ageMax: Math.min(120, user.age + 5),
      heightMinCm: Math.max(40, (parsedHeight ?? 170) - 10),
      heightMaxCm: Math.min(250, (parsedHeight ?? 170) + 10),
      interests: [],
      values: [],
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: [],
      smoking: [],
      drinking: [],
      workout: [],
      pets: [],
      familyPlans: [],
      children: [],
      loveStyles: [],
      communicationStyles: [],
      sexualOrientations: [],
      religions: []
    };
  }

  private parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private resolveSlotIndex(slotIndex: number): number | null {
    if (!Number.isFinite(slotIndex)) {
      return null;
    }
    const normalized = Math.trunc(Number(slotIndex));
    if (normalized < 0 || normalized >= DemoUsersService.MAX_PROFILE_IMAGE_SLOTS) {
      return null;
    }
    return normalized;
  }

  private readFileAsDataUrl(file: File): Promise<string | null> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string' || result.trim().length === 0) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}
