import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  DemoUserListItemDto,
  UserByIdQueryResponse,
  UserService,
  UsersListQueryResponse,
  UserDto
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersService implements UserService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    try {
      const response = await this.http
        .get<UserDto[] | null>(`${this.apiBaseUrl}/auth/demo-users`)
        .toPromise();
      if (!Array.isArray(response)) {
        return { users: [] };
      }
      return {
        users: response
          .map(user => this.cloneUser(user))
          .map(user => this.toDemoUserListItem(user))
      };
    } catch {
      return { users: [] };
    }
  }

  async queryUserById(_userId: string): Promise<UserByIdQueryResponse> {
    try {
      const me = await this.http
        .get<UserDto | null>(`${this.apiBaseUrl}/auth/me`)
        .toPromise();
      if (!me) {
        return { user: null };
      }
      return {
        user: this.cloneUser(me)
      };
    } catch {
      return { user: null };
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

  private toDemoUserListItem(user: UserDto): DemoUserListItemDto {
    return {
      id: user.id,
      name: user.name,
      city: user.city,
      initials: user.initials,
      gender: user.gender
    };
  }
}
