import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameDataService
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import { HttpUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpGameService implements UserGameDataService {
  private static readonly USER_GAME_CARDS_QUERY_ROUTE = '/game-cards/query';
  private readonly http = inject(HttpClient);
  private readonly usersRatingsRepository = inject(HttpUsersRatingsRepository);
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

}
