import { computed, Injectable, inject } from '@angular/core';

import type { UserDto } from '../../user.interface';
import { DEMO_USERS_TABLE_NAME, type UsersLoadStatus } from '../models/users.model';
import { DemoUsersMemoryDb } from '../models/db';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersRepository {
  private readonly memoryDb = inject(DemoUsersMemoryDb);

  readonly usersTable = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME]);
  readonly demoUsers = computed(() => this.queryAvailableDemoUsers());
  readonly demoUsersLoading = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].loading);
  readonly demoUsersLoadStatus = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].status);
  readonly demoUsersLoadedAtIso = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].loadedAtIso);
  readonly demoUsersError = computed(() => this.memoryDb.read()[DEMO_USERS_TABLE_NAME].error);

  queryAvailableDemoUsers(): UserDto[] {
    const users = this.memoryDb.read()[DEMO_USERS_TABLE_NAME];
    return users.ids
      .map(id => users.byId[id])
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.cloneUser(user));
  }

  setLoadStatus(status: UsersLoadStatus, message?: string): UserDto[] {
    this.memoryDb.write(current => ({
      ...current,
      [DEMO_USERS_TABLE_NAME]: {
        ...current[DEMO_USERS_TABLE_NAME],
        loading: status === 'loading',
        status,
        error: message ?? null
      }
    }));
    return this.queryAvailableDemoUsers();
  }

  syncUsers(users: readonly UserDto[]): UserDto[] {
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
        status: 'success',
        loadedAtIso: new Date().toISOString(),
        error: null
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
