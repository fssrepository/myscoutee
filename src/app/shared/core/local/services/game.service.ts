import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { LocalRouteDelayService } from './route-delay.service';
import { UserProfileStateBuilder } from '../../base/builders';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalUsersRatingsRepository } from '../repositories/users-ratings.repository';
import type {
  UserGameSocialCard,
  UserGameCardsQueryRequest,
  UserGameCardsQueryResponse,
  UserGameDataService,
  UserGameFilterPreferencesDto
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalGameService extends LocalRouteDelayService implements UserGameDataService {
  private static readonly USER_GAME_CARDS_ROUTE = '/game-cards/query';
  private static readonly HOME_DISTANCE_BUCKET_KM = 5;
  private static readonly HOME_DISTANCE_MAX_BUCKETS = 12;
  private static readonly HOME_DISTANCE_SCORE = 120000;
  private static readonly HOME_FRESHNESS_SCORE = 120000;
  private static readonly HOME_FRESHNESS_HALF_LIFE_DAYS = 14;
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly usersRatingsRepository = inject(LocalUsersRatingsRepository);
  private readonly userFacetById = APP_STATIC_DATA.homeUserFacetById;

  async whenReady(): Promise<void> {
    await this.usersRepository.whenReady();
  }

  queryGameCardsUsersSnapshot(): UserDto[] {
    return this.usersRepository.queryAllUsers()
      .filter(user => user.id.trim().length > 0)
      .filter(user => !UserProfileStateBuilder.isEmptyOnboardingProfileUserId(user.id))
      .filter(user => UserProfileStateBuilder.isActivityRateVisibleProfile(user));
  }

  recordGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode: 'single' | 'pair' = 'single',
    socialContext?: UserGameSocialCard['socialContext'],
    bridgeUserId?: string,
    bridgeCount?: number
  ): void {
    this.usersRatingsRepository.enqueueGameCardRatingOutbox(
      raterUserId,
      ratedUserId,
      rating,
      mode,
      socialContext,
      bridgeUserId,
      bridgeCount
    );
  }

  async queryUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    _requestTimeoutMs?: number
  ): Promise<UserGameCardsQueryResponse> {
    await this.waitForRouteDelay(LocalGameService.USER_GAME_CARDS_ROUTE);
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId) {
      return { cards: null };
    }
    const activeUser = this.usersRepository.queryUserById(normalizedUserId);
    if (!UserProfileStateBuilder.isPublicGameProfile(activeUser)) {
      return {
        cards: {
          filterCount: 0,
          cardUserIds: [],
          socialCards: [],
          nextCursor: null
        }
      };
    }
    const mode = request.mode ?? 'single';
    if (mode === 'separated-friends' || mode === 'friends-in-common') {
      const allUsers = this.usersRepository.queryAllUsers();
      const usersById = new Map(allUsers.map(user => [user.id, user] as const));
      const ratedPairKeys = new Set(this.usersRatingsRepository.queryRatedGameCardPairKeys(normalizedUserId));
      const ratedSingleUserIds = new Set(this.usersRatingsRepository.queryRatedGameCardUserIds(normalizedUserId, 'single'));
      const allSocialCards = this.activityMembersRepository
        .queryGameSocialCards(normalizedUserId, mode)
        .filter(card => this.isSocialCardVisible(usersById, card, mode))
        .filter(card => {
          if (mode === 'friends-in-common') {
            const candidateUserId = card.userId.trim();
            return candidateUserId.length > 0 && !ratedSingleUserIds.has(candidateUserId);
          }
          const pairKey = this.socialPairKey(card);
          return pairKey !== null && !ratedPairKeys.has(pairKey);
        });
      const filteredSocialCards = allSocialCards.filter(card =>
        this.matchesSocialFilterPreferences(usersById, card, request.filterPreferences ?? null)
        &&
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
    const metUserIds = new Set(this.activityMembersRepository.queryMetUserIds(normalizedUserId));
    const socialCandidateUserIds = this.queryFriendsInCommonCandidateUserIds(normalizedUserId);
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const activeUserForRanking = this.usersRepository.queryUserById(normalizedUserId);
    const latestActivityMsByUserId = this.queryLatestHomeActivityMsByUserId();
    const filtered = allUsers
      .filter(user => !metUserIds.has(user.id))
      .filter(user => !socialCandidateUserIds.has(user.id))
      .filter(user => this.matchesFilterPreferences(user, request.filterPreferences ?? null))
      .sort((left, right) => {
        const delta = this.homeUserScore(right, activeUserForRanking, latestActivityMsByUserId)
          - this.homeUserScore(left, activeUserForRanking, latestActivityMsByUserId);
        return delta !== 0 ? delta : left.id.localeCompare(right.id);
      });
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

  didUsersMeet(leftUserId: string, rightUserId: string): boolean {
    return this.activityMembersRepository.didUsersMeet(leftUserId, rightUserId);
  }

  queryMetUserIds(userId: string): string[] {
    return this.activityMembersRepository.queryMetUserIds(userId);
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
    const facet = this.userFacetById[user.id] ?? {
      interests: [],
      values: [],
      smoking: 'never',
      drinking: 'never',
      workout: 'weekly',
      pets: 'all pets welcome',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'straight',
      religion: 'not religious'
    };

    if (!intersectsNormalized(preferences.interests, facet.interests)) {
      return false;
    }
    if (!intersectsNormalized(preferences.values, facet.values)) {
      return false;
    }
    if (!includesNormalized(preferences.smoking, facet.smoking)) {
      return false;
    }
    if (!includesNormalized(preferences.drinking, facet.drinking)) {
      return false;
    }
    if (!includesNormalized(preferences.workout, facet.workout)) {
      return false;
    }
    if (!includesNormalized(preferences.pets, facet.pets)) {
      return false;
    }
    if (!includesNormalized(preferences.familyPlans, facet.familyPlans)) {
      return false;
    }
    if (!includesNormalized(preferences.children, facet.children)) {
      return false;
    }
    if (!includesNormalized(preferences.loveStyles, facet.loveStyle)) {
      return false;
    }
    if (!includesNormalized(preferences.communicationStyles, facet.communicationStyle)) {
      return false;
    }
    if (!includesNormalized(preferences.sexualOrientations, facet.sexualOrientation)) {
      return false;
    }
    if (!includesNormalized(preferences.religions, facet.religion)) {
      return false;
    }
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

  private matchesSocialFilterPreferences(
    usersById: ReadonlyMap<string, UserDto>,
    card: UserGameSocialCard,
    preferences: UserGameFilterPreferencesDto | null
  ): boolean {
    if (!preferences) {
      return true;
    }
    const participantIds = card.socialContext === 'friends-in-common'
      ? [card.userId.trim()]
      : [
        card.userId.trim(),
        (card.secondaryUserId?.trim() || card.bridgeUserId?.trim() || '')
      ];
    const uniqueParticipantIds = participantIds
      .filter((id, index, ids) => id.length > 0 && ids.indexOf(id) === index);
    if (uniqueParticipantIds.length === 0) {
      return false;
    }
    return uniqueParticipantIds.every(userId => {
      const user = usersById.get(userId);
      return user ? this.matchesFilterPreferences(user, preferences) : false;
    });
  }

  private queryFriendsInCommonCandidateUserIds(activeUserId: string): Set<string> {
    const allUsers = this.usersRepository.queryAllUsers();
    const usersById = new Map(allUsers.map(user => [user.id, user] as const));
    return new Set(this.activityMembersRepository
      .queryGameSocialCards(activeUserId, 'friends-in-common')
      .filter(card => this.isSocialCardVisible(usersById, card, 'friends-in-common'))
      .map(card => card.userId.trim())
      .filter(userId => userId.length > 0));
  }

  private queryLatestHomeActivityMsByUserId(): ReadonlyMap<string, number> {
    const latestByUserId = new Map<string, number>();
    for (const user of this.usersRepository.queryAllUsers()) {
      const score = this.statusFreshnessMs(user);
      if (score > 0) {
        latestByUserId.set(user.id, score);
      }
    }
    for (const user of this.usersRepository.queryAllUsers()) {
      for (const rate of this.usersRatingsRepository.queryUserRatesByUserId(user.id)) {
        const timestamp = Date.parse(rate.happenedAtIso?.trim() || rate.updatedAtIso || rate.createdAtIso || '');
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
          continue;
        }
        this.rememberLatestActivityMs(latestByUserId, rate.ownerUserId, timestamp);
        this.rememberLatestActivityMs(latestByUserId, rate.fromUserId, timestamp);
        this.rememberLatestActivityMs(latestByUserId, rate.toUserId, timestamp);
      }
    }
    return latestByUserId;
  }

  private rememberLatestActivityMs(target: Map<string, number>, userId: string | undefined, timestamp: number): void {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId || !Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }
    const current = target.get(normalizedUserId) ?? 0;
    if (timestamp > current) {
      target.set(normalizedUserId, timestamp);
    }
  }

  private statusFreshnessMs(user: UserDto): number {
    const normalized = `${user.statusText ?? ''}`.trim().toLowerCase();
    if (normalized === 'new' || normalized === 'new profile') {
      return Date.now();
    }
    if (normalized.includes('recent')) {
      return Date.now() - (2 * 24 * 60 * 60 * 1000);
    }
    return 0;
  }

  private homeUserScore(
    candidate: UserDto,
    activeUser: UserDto | null,
    latestActivityMsByUserId: ReadonlyMap<string, number>
  ): number {
    return (Number(candidate.affinity) || 0)
      + this.homeDistanceScore(activeUser, candidate)
      + this.homeFreshnessScore(candidate.id, latestActivityMsByUserId);
  }

  private homeDistanceScore(activeUser: UserDto | null, candidate: UserDto): number {
    const distanceMeters = this.distanceMeters(activeUser?.locationCoordinates, candidate.locationCoordinates);
    if (distanceMeters === null) {
      return 0;
    }
    const distanceKm = Math.max(0, distanceMeters / 1000);
    const bucketIndex = Math.floor(distanceKm / LocalGameService.HOME_DISTANCE_BUCKET_KM);
    const signal = Math.max(0, 1 - (Math.min(bucketIndex, LocalGameService.HOME_DISTANCE_MAX_BUCKETS) / LocalGameService.HOME_DISTANCE_MAX_BUCKETS));
    return signal * LocalGameService.HOME_DISTANCE_SCORE;
  }

  private homeFreshnessScore(
    candidateUserId: string,
    latestActivityMsByUserId: ReadonlyMap<string, number>
  ): number {
    const latestActivityMs = latestActivityMsByUserId.get(candidateUserId.trim()) ?? 0;
    if (latestActivityMs <= 0) {
      return 0;
    }
    const ageMs = Math.max(0, Date.now() - latestActivityMs);
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const signal = 1 / (1 + (ageDays / LocalGameService.HOME_FRESHNESS_HALF_LIFE_DAYS));
    return signal * LocalGameService.HOME_FRESHNESS_SCORE;
  }

  private distanceMeters(
    left: UserDto['locationCoordinates'] | undefined,
    right: UserDto['locationCoordinates'] | undefined
  ): number | null {
    const leftLat = Number(left?.latitude);
    const leftLon = Number(left?.longitude);
    const rightLat = Number(right?.latitude);
    const rightLon = Number(right?.longitude);
    if (![leftLat, leftLon, rightLat, rightLon].every(Number.isFinite)) {
      return null;
    }
    const earthRadiusMeters = 6371000;
    const latitudeDelta = this.toRadians(rightLat - leftLat);
    const longitudeDelta = this.toRadians(rightLon - leftLon);
    const leftLatitude = this.toRadians(leftLat);
    const rightLatitude = this.toRadians(rightLat);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(leftLatitude) * Math.cos(rightLatitude) * (Math.sin(longitudeDelta / 2) ** 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }

  private isSocialCardVisible(
    usersById: ReadonlyMap<string, UserDto>,
    card: UserGameSocialCard,
    mode: UserGameSocialCard['socialContext']
  ): boolean {
    const candidate = usersById.get(card.userId.trim());
    if (mode === 'friends-in-common') {
      const bridge = usersById.get(card.bridgeUserId?.trim() ?? '');
      return UserProfileStateBuilder.isPublicGameProfile(candidate)
        && UserProfileStateBuilder.isInsideNetworkGameProfile(bridge);
    }

    const secondUser = usersById.get((card.secondaryUserId?.trim() || card.bridgeUserId?.trim() || ''));
    return UserProfileStateBuilder.isInsideNetworkGameProfile(candidate)
      && UserProfileStateBuilder.isInsideNetworkGameProfile(secondUser);
  }

  private socialPairKey(card: UserGameSocialCard): string | null {
    const firstUserId = card.userId.trim();
    const secondUserId = card.secondaryUserId?.trim() || card.bridgeUserId?.trim() || '';
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      return null;
    }
    return [firstUserId, secondUserId]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
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
