import { Injectable, inject } from '@angular/core';

import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserService,
  UserByIdQueryResponse,
  UserDto,
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameFilterPreferencesDto,
  UserRateOutboxRecord,
  UserRateRecord,
  UsersListQueryResponse
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_GAME_CARDS_ROUTE = '/game-cards/query';
  private readonly usersRepository = inject(DemoUsersRepository);

  queryGameCardsUsersSnapshot(): UserDto[] {
    return this.usersRepository.queryGameStackUsers();
  }

  recordGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    this.usersRepository.upsertGameCardRating(raterUserId, ratedUserId, rating, mode);
  }

  queryPendingUserRatesOutbox(limit?: number): UserRateOutboxRecord[] {
    return this.usersRepository.queryPendingUserRatesOutbox(limit);
  }

  markUserRatesOutboxSynced(outboxIds: string[]): void {
    this.usersRepository.markUserRatesOutboxSynced(outboxIds);
  }

  markUserRatesOutboxFailed(outboxIds: string[], message?: string): void {
    this.usersRepository.markUserRatesOutboxFailed(outboxIds, message);
  }

  requeueFailedUserRatesOutbox(outboxIds: string[]): void {
    this.usersRepository.requeueFailedUserRatesOutbox(outboxIds);
  }

  queryUserRatesByUserId(userId: string): UserRateRecord[] {
    return this.usersRepository.queryUserRatesByUserId(userId);
  }

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

  async queryUserGameCardsByFilter(request: UserGameCardsQueryRequest): Promise<UserGameCardsQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.USER_GAME_CARDS_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId) {
      return { cards: null };
    }
    const pageSize = this.resolvePageSize(request.pageSize);
    const offset = this.resolveOffset(request.cursor);
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filtered = allUsers
      .filter(user => this.matchesFilterPreferences(user, request.filterPreferences ?? null));
    const cardUserIds = filtered
      .slice(offset, offset + pageSize)
      .map(user => user.id);
    const nextOffset = offset + pageSize;
    const nextCursor = nextOffset < filtered.length ? String(nextOffset) : null;

    return {
      cards: {
        filterCount: filtered.length,
        cardUserIds,
        nextCursor
      }
    };
  }

  private resolvePageSize(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.min(50, Math.trunc(Number(value))));
  }

  private resolveOffset(cursor: string | null | undefined): number {
    if (!cursor) {
      return 0;
    }
    const parsed = Number.parseInt(cursor, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
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

  private matchesFilterPreferences(
    user: UserDto,
    preferences: UserGameFilterPreferencesDto | null
  ): boolean {
    if (!preferences) {
      return true;
    }

    const ageMin = Number.isFinite(preferences.ageMin) ? Number(preferences.ageMin) : null;
    const ageMax = Number.isFinite(preferences.ageMax) ? Number(preferences.ageMax) : null;
    if (ageMin !== null && user.age < ageMin) {
      return false;
    }
    if (ageMax !== null && user.age > ageMax) {
      return false;
    }

    const heightCm = this.parseHeightCm(user.height);
    const heightMin = Number.isFinite(preferences.heightMinCm) ? Number(preferences.heightMinCm) : null;
    const heightMax = Number.isFinite(preferences.heightMaxCm) ? Number(preferences.heightMaxCm) : null;
    if (heightCm !== null && heightMin !== null && heightCm < heightMin) {
      return false;
    }
    if (heightCm !== null && heightMax !== null && heightCm > heightMax) {
      return false;
    }

    const includesNormalized = (values: string[] | undefined, target: string): boolean => {
      if (!Array.isArray(values) || values.length === 0) {
        return true;
      }
      const normalizedTarget = target.trim().toLowerCase();
      return values.some(value => value.trim().toLowerCase() === normalizedTarget);
    };
    const intersectsNormalized = (left: string[] | undefined, right: string[]): boolean => {
      if (!Array.isArray(left) || left.length === 0) {
        return true;
      }
      const normalized = new Set(right.map(value => value.trim().toLowerCase()));
      return left.some(value => normalized.has(value.trim().toLowerCase()));
    };

    if (!includesNormalized(preferences.physiques, user.physique)) {
      return false;
    }
    if (!intersectsNormalized(preferences.languages, user.languages ?? [])) {
      return false;
    }
    if (!includesNormalized(preferences.horoscopes, user.horoscope)) {
      return false;
    }
    if (!includesNormalized(preferences.traitLabels, user.traitLabel)) {
      return false;
    }
    if (Array.isArray(preferences.genders) && preferences.genders.length > 0) {
      if (!preferences.genders.includes(user.gender)) {
        return false;
      }
    }
    return true;
  }
}
