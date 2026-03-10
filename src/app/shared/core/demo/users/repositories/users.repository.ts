import { computed, Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../users/dtos/user.dto';
import { DEMO_USERS_TABLE_NAME } from '../models/users.model';
import { DemoUsersMemoryDb } from './users.memory-db';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private readonly memoryDb = inject(DemoUsersMemoryDb);

  readonly usersTable = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());
  readonly demoUsersLoading = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].loading);
  readonly demoUsersLoadedAtIso = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].loadedAtIso);
  readonly demoUsersError = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].error);

  queryAvailableDemoUsers(): UserDto[] {
    const users = this.memoryDb.read()[DEMO_USERS_TABLE_NAME];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.cloneUser(user));
  }

  beginDemoUsersLoad(): void {
    this.memoryDb.write(current => ({
      ...current,
      [DEMO_USERS_TABLE_NAME]: {
        ...current[DEMO_USERS_TABLE_NAME],
        loading: true,
        error: null
      }
    }));
  }

  completeDemoUsersLoad(users: readonly UserDto[]): UserDto[] {
    const usersById: Record<string, UserDto> = {};
    const userIds: string[] = [];
    for (const user of users) {
      usersById[user.id] = this.cloneUser(user);
      userIds.push(user.id);
    }
    this.memoryDb.write(current => ({
      ...current,
      [DEMO_USERS_TABLE_NAME]: {
        byId: usersById,
        ids: userIds,
        loading: false,
        loadedAtIso: new Date().toISOString(),
        error: null
      }
    }));
    return this.queryAvailableDemoUsers();
  }

  failDemoUsersLoad(message: string): UserDto[] {
    this.memoryDb.write(current => ({
      ...current,
      [DEMO_USERS_TABLE_NAME]: {
        ...current[DEMO_USERS_TABLE_NAME],
        loading: false,
        error: message
      }
    }));
    return this.queryAvailableDemoUsers();
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
