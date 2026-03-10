import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { DemoUsersRepository, DemoUsersService } from '../../demo';
import { HttpUsersService } from '../../http';
import type { UserDto, UserService } from '../interfaces/user.interface';

export interface UsersQueryOptions {
  preferCached?: boolean;
  requestTimeoutMs?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly demoUsersService = inject(DemoUsersService);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly demoModeEnabled = !environment.loginEnabled;

  readonly usersTable = this.usersRepository.usersTable;
  readonly demoUsers = this.usersRepository.demoUsers;
  readonly demoUsersLoading = this.usersRepository.demoUsersLoading;
  readonly demoUsersLoadedAtIso = this.usersRepository.demoUsersLoadedAtIso;
  readonly demoUsersError = this.usersRepository.demoUsersError;

  private get userService(): UserService {
    return this.demoModeEnabled ? this.demoUsersService : this.httpUsersService;
  }

  queryAvailableDemoUsers(): UserDto[] {
    return this.usersRepository.queryAvailableDemoUsers();
  }

  async loadAvailableDemoUsers(options: UsersQueryOptions = {}): Promise<UserDto[]> {
    const requestTimeoutMs = this.resolveRequestTimeoutMs(options.requestTimeoutMs);

    if (!this.demoModeEnabled) {
      try {
        const response = await this.withRequestTimeout(
          this.userService.queryAvailableDemoUsers(),
          requestTimeoutMs
        );
        return response.users;
      } catch {
        return [];
      }
    }

    const preferCached = options.preferCached ?? true;
    if (preferCached) {
      const cached = this.usersRepository.queryAvailableDemoUsers();
      if (cached.length > 0) {
        return cached;
      }
    }

    this.usersRepository.beginDemoUsersLoad();
    try {
      const response = await this.withRequestTimeout(
        this.userService.queryAvailableDemoUsers(),
        requestTimeoutMs
      );
      return this.usersRepository.completeDemoUsersLoad(response.users);
    } catch {
      return this.usersRepository.failDemoUsersLoad('Unable to load demo users.');
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
        reject(new Error('Users request timeout.'));
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
