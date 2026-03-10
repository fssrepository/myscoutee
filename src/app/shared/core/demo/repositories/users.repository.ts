import { computed, Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import type { UserDto } from '../../user.interface';
import { DEMO_USERS_TABLE_NAME } from '../models/users.model';
import { DemoUsersMemoryDb } from '../models/db';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private static readonly DEFAULT_DEMO_USERS_COUNT = 50;
  private readonly memoryDb = inject(DemoUsersMemoryDb);

  readonly usersTable = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());

  constructor() {
    this.init();
  }

  init(users: readonly UserDto[] = AppDemoGenerators.buildExpandedDemoUsers(DemoUsersRepository.DEFAULT_DEMO_USERS_COUNT)): UserDto[] {
    const current = this.memoryDb.read()[DEMO_USERS_TABLE_NAME];
    if (current.ids.length > 0) {
      return this.queryAvailableDemoUsers();
    }

    const usersById: Record<string, UserDto> = {};
    const userIds: string[] = [];
    for (const user of users) {
      usersById[user.id] = this.cloneUser(user);
      userIds.push(user.id);
    }

    this.memoryDb.write(state => ({
      ...state,
      [DEMO_USERS_TABLE_NAME]: {
        byId: usersById,
        ids: userIds
      }
    }));

    return this.queryAvailableDemoUsers();
  }

  queryAvailableDemoUsers(): UserDto[] {
    const users = this.memoryDb.read()[DEMO_USERS_TABLE_NAME];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.cloneUser(user));
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
