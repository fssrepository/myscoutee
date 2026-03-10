import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { DemoUsersService } from './demo';
import { HttpUsersService } from './http';
import type { UserDto, UserService } from './user.interface';
import { type LoadStatus } from './app.context';
import { AppContext } from './app.context';

export const USERS_LOAD_CONTEXT_KEY = 'users-selector';

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

  private readonly demoModeEnabled = !environment.loginEnabled;

  private get userService(): UserService {
    return this.demoModeEnabled ? this.demoUsersService : this.httpUsersService;
  }

  async loadAvailableDemoUsers(requestTimeoutMs?: number): Promise<UserDto[]> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);

    this.setLoadStatus('loading');

    try {
      const response = await this.withRequestTimeout(
        this.userService.queryAvailableDemoUsers(),
        normalizedTimeoutMs
      );

      this.setLoadStatus('success');
      return response.users;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus('timeout', 'Users request timeout.');
        return [];
      }

      this.setLoadStatus('error', 'Unable to load demo users.');
      return [];
    }
  }

  private setLoadStatus(status: LoadStatus, message?: string): void {
    this.appCtx.setStatus(USERS_LOAD_CONTEXT_KEY, status, message);
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
