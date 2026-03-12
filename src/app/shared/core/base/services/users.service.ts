import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { type LoadStatus } from '../../app.context';
import { AppContext } from '../../app.context';
import { DemoUsersService } from '../../demo';
import { HttpUsersService } from '../../http';
import type {
  DemoUserListItemDto,
  UserDto,
  UserProfileImageUploadResult,
  UserService
} from '../interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../interfaces/game.interface';

export { USER_GAME_CARDS_LOAD_CONTEXT_KEY } from './game.service';

export const USERS_LOAD_CONTEXT_KEY = 'users-selector';
export const USER_BY_ID_LOAD_CONTEXT_KEY = 'user-by-id';

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

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.appCtx.setUserFilterPreferences(normalizedUserId, preferences);
    await this.userService.saveUserFilterPreferences(normalizedUserId, preferences);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    return this.userService.saveUserProfile(user);
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
