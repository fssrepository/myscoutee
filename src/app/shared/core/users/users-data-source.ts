import { InjectionToken } from '@angular/core';

import type { UserDto } from './dtos/user.dto';

export interface UsersQueryResponse {
  users: UserDto[];
}

export interface UsersDataSourceQueryOptions {
  demoAdditionalDelayMs?: number;
}

export interface UsersDataSource {
  queryAvailableDemoUsers(options?: UsersDataSourceQueryOptions): Promise<UsersQueryResponse>;
}

export const USERS_DATA_SOURCE = new InjectionToken<UsersDataSource>('USERS_DATA_SOURCE');
