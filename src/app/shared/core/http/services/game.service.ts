import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  UserGameSocialCard,
  UserGameCardsDto,
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
  private readonly gameCardsUsersSnapshot: UserDto[] = [];

  queryGameCardsUsersSnapshot(): UserDto[] {
    return this.gameCardsUsersSnapshot;
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
        .post<{
          filterCount?: number;
          cardUserIds?: string[];
          nextCursor?: string | null;
          users?: UserDto[];
          socialCards?: UserGameSocialCard[];
        } | null>(
          `${this.apiBaseUrl}${HttpGameService.USER_GAME_CARDS_QUERY_ROUTE}`,
          {
            userId: normalizedUserId,
            mode: request.mode ?? 'single',
            leftQuery: request.leftQuery ?? null,
            rightQuery: request.rightQuery ?? null,
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
      if (Array.isArray(response.users)) {
        this.mergeGameCardsUsersSnapshot(response.users);
      }
      const nextCursor = typeof response.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor.trim()
        : null;
      const cards = this.applyPendingGameCardOutboxOverlay(normalizedUserId, request, {
        filterCount,
        cardUserIds,
        socialCards: Array.isArray(response.socialCards)
          ? response.socialCards
            .map(card => this.cloneSocialCard(card))
            .filter(card => card.id.length > 0 && card.userId.length > 0)
          : [],
        nextCursor
      });
      return {
        cards
      };
    } catch {
      return { cards: null };
    }
  }

  private applyPendingGameCardOutboxOverlay(
    userId: string,
    request: UserGameCardsQueryRequest,
    cards: UserGameCardsDto
  ): UserGameCardsDto {
    const mode = request.mode ?? 'single';
    const pendingRatedUserIds = new Set(
      mode === 'single'
        ? this.usersRatingsRepository.queryPendingRatedGameCardUserIds(userId, 'single')
        : []
    );
    const pendingRatedPairKeys = new Set(this.usersRatingsRepository.queryPendingRatedGameCardPairKeys(userId));
    if (pendingRatedUserIds.size === 0 && pendingRatedPairKeys.size === 0) {
      return cards;
    }

    if (mode === 'friends-in-common') {
      const socialCards = (cards.socialCards ?? []).filter(card => {
        const pairKey = this.toSocialPairKey(card);
        return !pairKey || !pendingRatedPairKeys.has(pairKey);
      });
      return {
        ...cards,
        filterCount: Math.max(0, cards.filterCount - ((cards.socialCards ?? []).length - socialCards.length)),
        socialCards
      };
    }

    if (mode === 'separated-friends') {
      const socialCards = (cards.socialCards ?? []).filter(card => {
        const pairKey = this.toSocialPairKey(card);
        return !pairKey || !pendingRatedPairKeys.has(pairKey);
      });
      return {
        ...cards,
        filterCount: Math.max(0, cards.filterCount - ((cards.socialCards ?? []).length - socialCards.length)),
        socialCards
      };
    }

    const cardUserIds = cards.cardUserIds.filter(cardUserId => !pendingRatedUserIds.has(cardUserId.trim()));
    return {
      ...cards,
      filterCount: Math.max(0, cards.filterCount - (cards.cardUserIds.length - cardUserIds.length)),
      cardUserIds
    };
  }

  private toSocialPairKey(card: UserGameSocialCard): string | null {
    const firstUserId = `${card.userId ?? ''}`.trim();
    const secondUserId = `${card.secondaryUserId ?? card.bridgeUserId ?? ''}`.trim();
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      return null;
    }
    return [firstUserId, secondUserId]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }


  private mergeGameCardsUsersSnapshot(users: UserDto[]): void {
    for (const user of users) {
      const normalized = this.cloneUser(user);
      if (!normalized.id) {
        continue;
      }
      const existingIndex = this.gameCardsUsersSnapshot.findIndex(item => item.id === normalized.id);
      if (existingIndex >= 0) {
        this.gameCardsUsersSnapshot[existingIndex] = normalized;
        continue;
      }
      this.gameCardsUsersSnapshot.push(normalized);
    }
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      locationCoordinates: user.locationCoordinates
        ? {
            latitude: Number(user.locationCoordinates.latitude),
            longitude: Number(user.locationCoordinates.longitude)
          }
        : undefined,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0,
        tickets: user.activities?.tickets ?? 0,
        feedback: user.activities?.feedback ?? 0
      }
    };
  }

  private cloneSocialCard(card: UserGameSocialCard): UserGameSocialCard {
    return {
      id: `${card.id ?? ''}`.trim(),
      userId: `${card.userId ?? ''}`.trim(),
      secondaryUserId: `${card.secondaryUserId ?? ''}`.trim() || undefined,
      socialContext: card.socialContext === 'friends-in-common' ? 'friends-in-common' : 'separated-friends',
      bridgeUserId: `${card.bridgeUserId ?? ''}`.trim() || undefined,
      bridgeCount: Number.isFinite(card.bridgeCount) ? Math.max(0, Math.trunc(Number(card.bridgeCount))) : undefined,
      eventName: `${card.eventName ?? ''}`.trim() || undefined
    };
  }
}
