import { Injectable, inject } from '@angular/core';

import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserService,
  UserByIdQueryResponse,
  UserDto,
  UserGameFilterPreferencesDto,
  UsersListQueryResponse
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private readonly usersRepository = inject(DemoUsersRepository);

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.DEMO_USERS_ROUTE);
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
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.USER_BY_ID_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = userId.trim();
    const user = this.usersRepository.queryUserById(normalizedUserId);
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filterCount = allUsers.length;
    return {
      user,
      filterCount,
      filterPreferences: user ? this.buildDefaultFilterPreferences(user) : null
    };
  }

  private buildDefaultFilterPreferences(user: UserDto): UserGameFilterPreferencesDto {
    const parsedHeight = this.parseHeightCm(user.height);
    return {
      ageMin: Math.max(18, user.age - 5),
      ageMax: Math.min(120, user.age + 5),
      heightMinCm: Math.max(40, (parsedHeight ?? 170) - 10),
      heightMaxCm: Math.min(250, (parsedHeight ?? 170) + 10),
      interests: [],
      values: [],
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: [],
      smoking: [],
      drinking: [],
      workout: [],
      pets: [],
      familyPlans: [],
      children: [],
      loveStyles: [],
      communicationStyles: [],
      sexualOrientations: [],
      religions: []
    };
  }

  private parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }
}
