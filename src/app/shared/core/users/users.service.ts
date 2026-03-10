import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { DemoUsersRepository } from '../demo/users';
import type { UserDto } from './dtos/user.dto';
import { USERS_DATA_SOURCE } from './users-data-source';
import { resolveDemoUsersQueryOptionsForRoute } from '../demo/users/services/users-route-query-config';

export interface UsersQueryOptions {
  preferCached?: boolean;
  popupKey?: string;
  routeUrl?: string;
  requestTimeoutMs?: number;
  demoAdditionalDelayMs?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 3000;
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly usersDataSource = inject(USERS_DATA_SOURCE);
  private readonly router = inject(Router);
  private readonly demoModeEnabled = !environment.loginEnabled;

  readonly usersTable = this.usersRepository.usersTable;
  readonly demoUsers = this.usersRepository.demoUsers;
  readonly demoUsersLoading = this.usersRepository.demoUsersLoading;
  readonly demoUsersLoadedAtIso = this.usersRepository.demoUsersLoadedAtIso;
  readonly demoUsersError = this.usersRepository.demoUsersError;

  queryAvailableDemoUsers(): UserDto[] {
    return this.usersRepository.queryAvailableDemoUsers();
  }

  async loadAvailableDemoUsers(options: UsersQueryOptions = {}): Promise<UserDto[]> {
    const requestTimeoutMs = this.resolveRequestTimeoutMs(options.requestTimeoutMs);

    if (!this.demoModeEnabled) {
      try {
        const response = await this.withRequestTimeout(
          this.usersDataSource.queryAvailableDemoUsers(),
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

    const routeQueryOptions = resolveDemoUsersQueryOptionsForRoute(
      options.routeUrl ?? this.router.url,
      options.popupKey,
      {
        demoAdditionalDelayMs: options.demoAdditionalDelayMs
      }
    );

    this.usersRepository.beginDemoUsersLoad();
    try {
      const response = await this.withRequestTimeout(
        this.usersDataSource.queryAvailableDemoUsers(routeQueryOptions),
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
