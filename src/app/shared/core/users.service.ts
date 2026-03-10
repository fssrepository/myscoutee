import { Injectable, computed, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { DemoUsersRepository, DemoUsersService } from './demo';
import { HttpUsersService } from './http';
import type { UserDto, UserService } from './user.interface';
import { LoadService, type LoadStatus } from './ui/load.service';

const USERS_LOAD_CONTEXT_KEY = 'users-selector';

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
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly demoUsersService = inject(DemoUsersService);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly loadContext = inject(LoadService);
  private readonly loadState = this.loadContext.selectState(USERS_LOAD_CONTEXT_KEY);
  private readonly demoModeEnabled = !environment.loginEnabled;

  readonly usersTable = this.usersRepository.usersTable;
  readonly demoUsers = this.usersRepository.demoUsers;
  readonly demoUsersLoading = computed(() => this.loadState().status === 'loading');
  readonly demoUsersLoadStatus = computed(() => this.loadState().status);
  readonly demoUsersLoadedAtIso = computed(() => this.loadState().loadedAtIso);
  readonly demoUsersError = computed(() => this.loadState().error);

  private get userService(): UserService {
    return this.demoModeEnabled ? this.demoUsersService : this.httpUsersService;
  }

  queryAvailableDemoUsers(): UserDto[] {
    return this.usersRepository.queryAvailableDemoUsers();
  }

  async loadAvailableDemoUsers(requestTimeoutMs?: number): Promise<UserDto[]> {
    const normalizedTimeoutMs = this.resolveRequestTimeoutMs(requestTimeoutMs);

    this.setLoadStatus('loading');

    try {
      const response = await this.withRequestTimeout(
        this.userService.queryAvailableDemoUsers(),
        normalizedTimeoutMs
      );
      const syncedUsers = this.usersRepository.syncUsers(response.users);
      this.setLoadStatus('success');
      return syncedUsers;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.setLoadStatus('timeout', 'Users request timeout.');
        return this.usersRepository.queryAvailableDemoUsers();
      }
      this.setLoadStatus('error', 'Unable to load demo users.');
      return this.usersRepository.queryAvailableDemoUsers();
    }
  }

  private setLoadStatus(status: LoadStatus, message?: string): void {
    this.loadContext.setStatus(USERS_LOAD_CONTEXT_KEY, status, message);
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
