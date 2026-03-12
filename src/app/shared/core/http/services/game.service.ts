import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { UsersRatingsRepository } from '../../base/repositories/users-ratings.repository';
import type {
  UserDto,
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameService,
  UserRateRecord,
  UserRatesSyncResult
} from '../../user.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpGameService implements UserGameService {
  private static readonly USER_GAME_CARDS_QUERY_ROUTE = '/game-cards/query';
  private static readonly USER_RATES_SYNC_ROUTE = '/user-rates/sync';
  private readonly http = inject(HttpClient);
  private readonly usersRatingsRepository = inject(UsersRatingsRepository);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  queryGameCardsUsersSnapshot(): UserDto[] {
    return [];
  }

  recordGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single'
  ): void {
    this.usersRatingsRepository.enqueueGameCardRatingOutbox(raterUserId, ratedUserId, rating, mode);
  }

  async queryUserGameCardsByFilter(request: UserGameCardsQueryRequest): Promise<UserGameCardsQueryResponse> {
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId) {
      return { cards: null };
    }
    try {
      const response = await this.http
        .post<{ filterCount?: number; cardUserIds?: string[]; nextCursor?: string | null } | null>(
          `${this.apiBaseUrl}${HttpGameService.USER_GAME_CARDS_QUERY_ROUTE}`,
          {
            filterPreferences: request.filterPreferences ?? null,
            cursor: request.cursor ?? null,
            pageSize: Number.isFinite(request.pageSize) ? Math.max(1, Math.min(50, Math.trunc(Number(request.pageSize)))) : 10
          }
        )
        .toPromise();
      if (!response) {
        return { cards: null };
      }
      const filterCount = Number.isFinite(response.filterCount)
        ? Math.max(0, Math.trunc(Number(response.filterCount)))
        : 0;
      const cardUserIds = Array.isArray(response.cardUserIds)
        ? response.cardUserIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      const nextCursor = typeof response.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor.trim()
        : null;
      return {
        cards: {
          filterCount,
          cardUserIds,
          nextCursor
        }
      };
    } catch {
      return { cards: null };
    }
  }

  async syncUserRatesBatch(rates: UserRateRecord[]): Promise<UserRatesSyncResult> {
    if (rates.length === 0) {
      return {
        syncedRateIds: [],
        failedRateIds: [],
        error: null
      };
    }
    try {
      const response = await this.http
        .post<{ syncedRateIds?: string[]; failedRateIds?: string[] } | null>(
          `${this.apiBaseUrl}${HttpGameService.USER_RATES_SYNC_ROUTE}`,
          { rates }
        )
        .toPromise();
      if (!response) {
        return {
          syncedRateIds: [],
          failedRateIds: rates.map(rate => rate.id),
          error: 'Empty sync response'
        };
      }
      const syncedRateIds = Array.isArray(response.syncedRateIds)
        ? response.syncedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      const failedRateIds = Array.isArray(response.failedRateIds)
        ? response.failedRateIds
          .map(id => String(id).trim())
          .filter(id => id.length > 0)
        : [];
      return {
        syncedRateIds,
        failedRateIds,
        error: null
      };
    } catch {
      return {
        syncedRateIds: [],
        failedRateIds: rates.map(rate => rate.id),
        error: 'User rates sync request failed'
      };
    }
  }
}
