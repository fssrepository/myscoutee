import { AppUtils } from '../../../base/app-utils';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../../environments/environment';
import type {
  UserGameSocialCard,
  UserGameCardsDto,
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameDataService
} from '../../../contracts/common/activity.interface';
import type { UserDto } from '../../../contracts/accounts/user.interface';
import { RouteDelayService } from '../../../base/services/platform/route-delay.service';
import { RateOutboxService } from '../../../base/services/affinity/rate-outbox.service';

@Injectable({
  providedIn: 'root'
})
export class HttpGameService implements UserGameDataService {
  private static readonly USER_GAME_CARDS_QUERY_ROUTE = '/game-cards/query';
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly rateOutboxService = inject(RateOutboxService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly gameCardsUsersSnapshot: UserDto[] = [];

  queryGameCardsUsersSnapshot(): UserDto[] {
    return this.gameCardsUsersSnapshot;
  }

  async queryUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsQueryResponse> {
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId) {
      return { cards: null };
    }
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpGameService.USER_GAME_CARDS_QUERY_ROUTE,
        this.http
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
              pageSize: Number.isFinite(request.pageSize) ? Math.max(1, Math.min(50, Math.trunc(Number(request.pageSize)))) : 10,
              excludedCardUserIds: this.normalizeIds(request.excludedCardUserIds),
              excludedSocialCardIds: this.normalizeIds(request.excludedSocialCardIds)
            }
          )
          .toPromise(),
        'User game cards request timeout.',
        requestTimeoutMs
      );
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
    } catch (error) {
      if (error instanceof Error && error.message === 'User game cards request timeout.') {
        throw error;
      }
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
      mode === 'single' || mode === 'friends-in-common'
        ? this.rateOutboxService.queryPendingRatedGameCardUserIds(userId, 'single')
        : []
    );
    const pendingRatedPairKeys = new Set(this.rateOutboxService.queryPendingRatedGameCardPairKeys(userId));
    if (pendingRatedUserIds.size === 0 && pendingRatedPairKeys.size === 0) {
      return cards;
    }

    if (mode === 'friends-in-common') {
      const socialCards = (cards.socialCards ?? []).filter(card => !pendingRatedUserIds.has(card.userId.trim()));
      return {
        ...cards,
        filterCount: Math.max(0, cards.filterCount - ((cards.socialCards ?? []).length - socialCards.length)),
        socialCards
      };
    }

    if (mode === 'outside-network' || mode === 'separated-friends') {
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

  private cloneUser(user: UserDto): UserDto { return AppUtils.cloneUser(user); }

  private cloneSocialCard(card: UserGameSocialCard): UserGameSocialCard {
    const socialContext = card.socialContext === 'friends-in-common' || card.socialContext === 'separated-friends'
      ? card.socialContext
      : undefined;
    return {
      id: `${card.id ?? ''}`.trim(),
      userId: `${card.userId ?? ''}`.trim(),
      secondaryUserId: `${card.secondaryUserId ?? ''}`.trim() || undefined,
      ...(socialContext ? { socialContext } : {}),
      bridgeUserId: `${card.bridgeUserId ?? ''}`.trim() || undefined,
      bridgeCount: Number.isFinite(card.bridgeCount) ? Math.max(0, Math.trunc(Number(card.bridgeCount))) : undefined,
      eventName: `${card.eventName ?? ''}`.trim() || undefined
    };
  }

  private normalizeIds(values: readonly string[] | null | undefined): string[] {
    return Array.from(new Set(
      (values ?? [])
        .map(value => `${value ?? ''}`.trim())
        .filter(value => value.length > 0)
    ));
  }
}
