import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { DemoUsersService } from './demo';
import { HttpUsersService } from './http';
import type { UserDto, UserService } from './user.interface';

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
  private readonly demoModeEnabled = !environment.loginEnabled;

  readonly usersTable = this.demoUsersService.usersTable;
  readonly demoUsers = this.demoUsersService.demoUsers;
  readonly demoUsersLoading = this.demoUsersService.demoUsersLoading;
  readonly demoUsersLoadStatus = this.demoUsersService.demoUsersLoadStatus;
  readonly demoUsersLoadedAtIso = this.demoUsersService.demoUsersLoadedAtIso;
  readonly demoUsersError = this.demoUsersService.demoUsersError;

  private get userService(): UserService {
    return this.demoModeEnabled ? this.demoUsersService : this.httpUsersService;
  }

  queryAvailableDemoUsers(): UserDto[] {
    return this.demoUsersService.queryCachedUsers();
  }

  async loadAvailableDemoUsers(requestTimeoutMs?: number): Promise<UserDto[]> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);

    if (!this.demoModeEnabled) {
      try {
        const response = await this.withRequestTimeout(
          this.userService.queryAvailableDemoUsers(),
          normalizedTimeoutMs
        );
        return response.users;
      } catch {
        return [];
      }
    }

    this.demoUsersService.setLoadStatus('loading');
    try {
      const response = await this.withRequestTimeout(
        this.userService.queryAvailableDemoUsers(),
        normalizedTimeoutMs
      );
      return this.demoUsersService.syncUsers(response.users);
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        return this.demoUsersService.setLoadStatus('timeout', 'Users request timeout.');
      }
      return this.demoUsersService.setLoadStatus('error', 'Unable to load demo users.');
    }
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
