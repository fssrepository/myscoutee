import type { UserDto, UserGameCardsDto, UserGameCardsQueryRequest } from '../../user.interface';

export interface UserGameCardsStackSnapshot {
  cardUserIds: string[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

export abstract class BaseGameService {
  abstract getGameCardsUsersSnapshot(): UserDto[];
  abstract recordUserGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode?: 'single' | 'pair'
  ): void;
  abstract loadUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null>;
  abstract loadUserGameCardsPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    cursor: UserGameCardsQueryRequest['cursor'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsDto | null>;
  abstract getUserGameCardsStackSnapshot(userId: string): UserGameCardsStackSnapshot;
  abstract resetUserGameCardsStack(userId: string): void;
  abstract isUserGameCardsStackRequestInFlight(userId: string): boolean;
  abstract shouldUseUserGameCardsStack(userId: string): boolean;
  abstract loadInitialUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot>;
  abstract loadNextUserGameCardsStackPage(
    userId: string,
    filterPreferences: UserGameCardsQueryRequest['filterPreferences'],
    pageSize: UserGameCardsQueryRequest['pageSize'],
    requestTimeoutMs?: number
  ): Promise<UserGameCardsStackSnapshot>;
}
