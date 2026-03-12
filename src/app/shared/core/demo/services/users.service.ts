import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserService,
  UserByIdQueryResponse,
  UserGameBootstrapQueryResponse,
  UsersListQueryResponse
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly router = inject(Router);

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(this.router.url);
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
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(this.router.url);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      user: this.usersRepository.queryUserById(userId)
    };
  }

  async queryUserGameBootstrapById(userId: string): Promise<UserGameBootstrapQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(this.router.url);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return { bootstrap: null };
    }
    const firstCardUserIds = AppDemoGenerators
      .buildExpandedDemoUsers(50)
      .map(user => user.id)
      .filter(id => id !== normalizedUserId);
    return {
      bootstrap: {
        filterCount: firstCardUserIds.length,
        firstCardUserIds: firstCardUserIds.slice(0, 10)
      }
    };
  }
}
