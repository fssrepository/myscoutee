import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserService,
  UsersQueryResponse
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly router = inject(Router);

  async queryAvailableDemoUsers(): Promise<UsersQueryResponse> {
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
}
