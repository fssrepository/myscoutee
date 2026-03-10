import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserService,
  UserByIdQueryResponse,
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
}
