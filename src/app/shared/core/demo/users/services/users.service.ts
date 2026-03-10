import { Injectable } from '@angular/core';

import { AppDemoGenerators } from '../../../../app-demo-generators';
import type {
  UsersDataSource,
  UsersDataSourceQueryOptions,
  UsersQueryResponse
} from '../../../users/users-data-source';
import type { UserDto } from '../../../users/dtos/user.dto';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UsersDataSource {
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  private static readonly DEFAULT_USERS_ADDITIONAL_DELAY_MS = 0;

  async queryAvailableDemoUsers(options: UsersDataSourceQueryOptions = {}): Promise<UsersQueryResponse> {
    const additionalDelayMs = this.normalizeDelayMs(
      options.demoAdditionalDelayMs ?? DemoUsersService.DEFAULT_USERS_ADDITIONAL_DELAY_MS
    );
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      users: this.users.map(user => this.cloneUser(user))
    };
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
