import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { DemoUsersRepository } from '../repositories/users.repository';
import type {
  UserService,
  UsersQueryResponse,
  UserDto
} from '../../user.interface';
import type { UsersLoadStatus } from '../models/users.model';

interface DemoUsersRouteDelayEntry {
  routePrefix: string;
  additionalDelayMs: number;
}

const DEFAULT_DEMO_USERS_DELAY_MS = 300;
const DEMO_USERS_ROUTE_DELAY_CONFIG: DemoUsersRouteDelayEntry[] = [
  {
    routePrefix: '/game',
    additionalDelayMs: 0
  }
];

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  private readonly router = inject(Router);
  private readonly usersRepository = inject(DemoUsersRepository);

  readonly usersTable = this.usersRepository.usersTable;
  readonly demoUsers = this.usersRepository.demoUsers;
  readonly demoUsersLoading = this.usersRepository.demoUsersLoading;
  readonly demoUsersLoadStatus = this.usersRepository.demoUsersLoadStatus;
  readonly demoUsersLoadedAtIso = this.usersRepository.demoUsersLoadedAtIso;
  readonly demoUsersError = this.usersRepository.demoUsersError;

  async queryAvailableDemoUsers(): Promise<UsersQueryResponse> {
    const additionalDelayMs = this.resolveAdditionalDelayMsForRoute(this.router.url);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      users: this.users.map(user => this.cloneUser(user))
    };
  }

  queryCachedUsers(): UserDto[] {
    return this.usersRepository.queryAvailableDemoUsers();
  }

  setLoadStatus(status: UsersLoadStatus, message?: string): UserDto[] {
    return this.usersRepository.setLoadStatus(status, message);
  }

  syncUsers(users: readonly UserDto[]): UserDto[] {
    return this.usersRepository.syncUsers(users);
  }

  private resolveAdditionalDelayMsForRoute(url: string): number {
    const normalizedUrl = this.normalizeRouteUrl(url);
    let bestMatchLength = -1;
    let selectedDelayMs = DEFAULT_DEMO_USERS_DELAY_MS;

    for (const entry of DEMO_USERS_ROUTE_DELAY_CONFIG) {
      const normalizedPrefix = this.normalizeRouteUrl(entry.routePrefix);
      if (!this.isRoutePrefixMatch(normalizedUrl, normalizedPrefix)) {
        continue;
      }
      if (normalizedPrefix.length <= bestMatchLength) {
        continue;
      }
      bestMatchLength = normalizedPrefix.length;
      selectedDelayMs = entry.additionalDelayMs;
    }

    return this.normalizeDelayMs(selectedDelayMs);
  }

  private normalizeRouteUrl(url: string): string {
    const [pathOnly] = url.split('?');
    const [withoutHash] = (pathOnly || '').split('#');
    const trimmed = withoutHash.trim();
    if (!trimmed || trimmed === '/') {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed}`.replace(/\/+$/, '');
  }

  private isRoutePrefixMatch(url: string, prefix: string): boolean {
    if (prefix === '/') {
      return true;
    }
    return url === prefix || url.startsWith(`${prefix}/`);
  }

  private normalizeDelayMs(value: number): number {
    return Math.max(0, Math.trunc(value));
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...user.languages],
      images: [...(user.images ?? [])],
      activities: {
        ...user.activities
      }
    };
  }
}
