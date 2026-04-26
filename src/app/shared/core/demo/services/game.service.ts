import { Injectable, inject } from '@angular/core';

import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoUsersRepository } from '../repositories/users.repository';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';
import type {
  UserGameSocialCard,
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameDataService,
  UserGameFilterPreferencesDto,
  UserRateRecord
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoGameService extends DemoRouteDelayService implements UserGameDataService {
  private static readonly USER_GAME_CARDS_ROUTE = '/game-cards/query';
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

  queryGameCardsUsersSnapshot(): UserDto[] {
    return this.usersRepository.queryGameStackUsers();
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
    await this.waitForRouteDelay(DemoGameService.USER_GAME_CARDS_ROUTE);
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId) {
      return { cards: null };
    }
    const mode = request.mode ?? 'single';
    if (mode === 'separated-friends' || mode === 'friends-in-common') {
      const allUsers = this.usersRepository.queryAllUsers();
      const allSocialCards = mode === 'separated-friends'
        ? this.buildSeparatedFriendCards(normalizedUserId, allUsers)
        : this.buildFriendsInCommonCards(normalizedUserId, allUsers);
      const filteredSocialCards = allSocialCards.filter(card =>
        this.matchesSocialQuery(allUsers, card, request.leftQuery ?? null, request.rightQuery ?? null)
      );
      const pageSize = this.resolvePageSize(request.pageSize);
      const offset = this.resolveOffset(request.cursor);
      const page = filteredSocialCards.slice(offset, offset + pageSize);
      const nextOffset = offset + pageSize;
      return {
        cards: {
          filterCount: filteredSocialCards.length,
          cardUserIds: [],
          socialCards: page.map(card => ({ ...card })),
          nextCursor: nextOffset < filteredSocialCards.length ? String(nextOffset) : null
        }
      };
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
        socialCards: [],
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

  private buildSeparatedFriendCards(activeUserId: string, users: readonly UserDto[]): UserGameSocialCard[] {
    const graph = this.buildActivityGraph(users);
    const neighbors = [...(graph.neighborsByUserId.get(activeUserId) ?? new Set<string>())]
      .filter(userId => userId !== activeUserId)
      .sort();
    const ratedPairKeys = this.queryRatedPairKeys(activeUserId);
    const pendingPairKeys = new Set(this.usersRatingsRepository.queryPendingRatedGameCardPairKeys(activeUserId));
    const cards: UserGameSocialCard[] = [];
    for (let leftIndex = 0; leftIndex < neighbors.length; leftIndex += 1) {
      const leftUserId = neighbors[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < neighbors.length; rightIndex += 1) {
        const rightUserId = neighbors[rightIndex];
        const key = this.sortedPairKey(leftUserId, rightUserId);
        if (
          (graph.neighborsByUserId.get(leftUserId)?.has(rightUserId) ?? false)
          || ratedPairKeys.has(key)
          || pendingPairKeys.has(key)
        ) {
          continue;
        }
        cards.push({
          id: `separated-friends:${activeUserId}:${key}`,
          userId: leftUserId,
          secondaryUserId: rightUserId,
          socialContext: 'separated-friends',
          bridgeCount: 2,
          eventName: graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, leftUserId))
            ?? graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, rightUserId))
            ?? 'Unconnected Friends'
        });
      }
    }
    return cards;
  }

  private buildFriendsInCommonCards(activeUserId: string, users: readonly UserDto[]): UserGameSocialCard[] {
    const graph = this.buildActivityGraph(users);
    const activeNeighbors = graph.neighborsByUserId.get(activeUserId) ?? new Set<string>();
    const ratedUserIds = new Set(this.usersRatingsRepository.queryRatedGameCardUserIds(activeUserId));
    const cards: UserGameSocialCard[] = [];
    for (const user of users) {
      if (user.id === activeUserId || activeNeighbors.has(user.id) || ratedUserIds.has(user.id)) {
        continue;
      }
      const candidateNeighbors = graph.neighborsByUserId.get(user.id) ?? new Set<string>();
      const bridges = [...activeNeighbors].filter(bridgeUserId => candidateNeighbors.has(bridgeUserId));
      if (bridges.length === 0) {
        continue;
      }
      const bridgeUserId = bridges.sort()[0];
      cards.push({
        id: `friends-in-common:${activeUserId}:${user.id}`,
        userId: user.id,
        socialContext: 'friends-in-common',
        bridgeUserId,
        bridgeCount: bridges.length,
        eventName: graph.edgeEventNameByKey.get(this.sortedPairKey(activeUserId, bridgeUserId))
          ?? graph.edgeEventNameByKey.get(this.sortedPairKey(user.id, bridgeUserId))
          ?? 'Connected Friends'
      });
    }
    return cards.sort((left, right) => (right.bridgeCount ?? 0) - (left.bridgeCount ?? 0) || left.id.localeCompare(right.id));
  }

  private buildActivityGraph(users: readonly UserDto[]): {
    neighborsByUserId: Map<string, Set<string>>;
    edgeEventNameByKey: Map<string, string>;
  } {
    const neighborsByUserId = new Map<string, Set<string>>();
    const edgeEventNameByKey = new Map<string, string>();
    for (const user of users) {
      for (const record of this.usersRatingsRepository.queryUserRatesByUserId(user.id)) {
        if (record.source !== 'activity-rate') {
          continue;
        }
        this.registerActivityEdge(neighborsByUserId, edgeEventNameByKey, record.ownerUserId ?? '', record.fromUserId, record.eventName);
        this.registerActivityEdge(neighborsByUserId, edgeEventNameByKey, record.ownerUserId ?? '', record.toUserId, record.eventName);
        if (record.mode === 'single') {
          this.registerActivityEdge(neighborsByUserId, edgeEventNameByKey, record.fromUserId, record.toUserId, record.eventName);
        }
      }
    }
    return { neighborsByUserId, edgeEventNameByKey };
  }

  private registerActivityEdge(
    neighborsByUserId: Map<string, Set<string>>,
    edgeEventNameByKey: Map<string, string>,
    leftUserId: string,
    rightUserId: string,
    eventName?: string
  ): void {
    const normalizedLeftUserId = leftUserId.trim();
    const normalizedRightUserId = rightUserId.trim();
    if (!normalizedLeftUserId || !normalizedRightUserId || normalizedLeftUserId === normalizedRightUserId) {
      return;
    }
    if (!neighborsByUserId.has(normalizedLeftUserId)) {
      neighborsByUserId.set(normalizedLeftUserId, new Set<string>());
    }
    if (!neighborsByUserId.has(normalizedRightUserId)) {
      neighborsByUserId.set(normalizedRightUserId, new Set<string>());
    }
    neighborsByUserId.get(normalizedLeftUserId)?.add(normalizedRightUserId);
    neighborsByUserId.get(normalizedRightUserId)?.add(normalizedLeftUserId);
    const key = this.sortedPairKey(normalizedLeftUserId, normalizedRightUserId);
    if (eventName?.trim()) {
      edgeEventNameByKey.set(key, eventName.trim());
    }
  }

  private queryRatedPairKeys(activeUserId: string): Set<string> {
    return new Set(
      this.usersRatingsRepository.queryUserRatesByUserId(activeUserId)
        .filter((record): record is UserRateRecord => record.source === 'game-card' && record.mode === 'pair' && record.ownerUserId === activeUserId)
        .map(record => this.sortedPairKey(record.fromUserId, record.toUserId))
    );
  }

  private sortedPairKey(leftUserId: string, rightUserId: string): string {
    return [leftUserId.trim(), rightUserId.trim()].sort((left, right) => left.localeCompare(right)).join(':');
  }

  private matchesSocialQuery(
    users: readonly UserDto[],
    card: UserGameSocialCard,
    leftQuery: string | null,
    rightQuery: string | null
  ): boolean {
    return this.matchesSocialSide(users, card.userId, card.eventName ?? null, leftQuery)
      && this.matchesSocialSide(users, card.secondaryUserId ?? card.bridgeUserId ?? '', card.eventName ?? null, rightQuery);
  }

  private matchesSocialSide(
    users: readonly UserDto[],
    userId: string,
    eventName: string | null,
    query: string | null
  ): boolean {
    const normalizedQuery = query?.trim().toLowerCase() ?? '';
    if (!normalizedQuery) {
      return true;
    }
    const user = users.find(candidate => candidate.id === userId) ?? null;
    return (user?.name?.toLowerCase().includes(normalizedQuery) ?? false)
      || (user?.city?.toLowerCase().includes(normalizedQuery) ?? false)
      || ((eventName ?? '').toLowerCase().includes(normalizedQuery));
  }
}
