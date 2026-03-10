import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DemoUsersRepository } from '../repositories/users.repository';
import { AppDemoGenerators } from '../../../app-demo-generators';
import type {
  UserService,
  UsersQueryResponse,
  UserDto
} from '../../user.interface';

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
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly router = inject(Router);

  async queryAvailableDemoUsers(): Promise<UsersQueryResponse> {
    const additionalDelayMs = this.resolveAdditionalDelayMsForRoute(this.router.url);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      users: this.usersRepository.queryAvailableDemoUsers()
    };
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
