import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../../environments/environment';
import type {
  UsersDataSource,
  UsersDataSourceQueryOptions,
  UsersQueryResponse
} from '../../../users/users-data-source';
import type { UserDto } from '../../../users/dtos/user.dto';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UsersDataSource {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryAvailableDemoUsers(_options: UsersDataSourceQueryOptions = {}): Promise<UsersQueryResponse> {
    try {
      const response = await this.http
        .get<UserDto[] | null>(`${this.apiBaseUrl}/auth/demo-users`)
        .toPromise();
      if (!Array.isArray(response)) {
        return { users: [] };
      }
      return {
        users: response.map(user => this.cloneUser(user))
      };
    } catch {
      return { users: [] };
    }
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0))
      }
    };
  }
}
