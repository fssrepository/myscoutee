import type { UserDto } from './user.interface';

export interface UserGameCardsStackSnapshot {
  cardUserIds: string[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

export interface UserGameFilterPreferencesDto {
  ageMin?: number;
  ageMax?: number;
  heightMinCm?: number;
  heightMaxCm?: number;
  interests?: string[];
  values?: string[];
  physiques?: string[];
  languages?: string[];
  genders?: Array<'woman' | 'man'>;
  horoscopes?: string[];
  traitLabels?: string[];
  smoking?: string[];
  drinking?: string[];
  workout?: string[];
  pets?: string[];
  familyPlans?: string[];
  children?: string[];
  loveStyles?: string[];
  communicationStyles?: string[];
  sexualOrientations?: string[];
  religions?: string[];
}

export interface UserGameCardsQueryRequest {
  userId: string;
  filterPreferences?: UserGameFilterPreferencesDto | null;
  cursor?: string | null;
  pageSize?: number;
}

export interface UserGameCardsDto {
  filterCount: number;
  cardUserIds: string[];
  nextCursor: string | null;
}

export interface UserGameCardsQueryResponse {
  cards: UserGameCardsDto | null;
}

export interface UserRateRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  rate: number;
  mode: 'single' | 'pair';
  source: 'game-card' | 'activity-rate';
  createdAtIso: string;
  updatedAtIso: string;
  ownerUserId?: string;
  displayId?: string;
  displayDirection?: 'given' | 'received' | 'mutual' | 'met';
  scoreGiven?: number;
  scoreReceived?: number;
  eventName?: string;
  happenedAtIso?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
}

export type ActivityRateRecordSort = 'happenedAt' | 'distance' | 'relevance';

export interface ActivityRateRecordQuery {
  ownerUserId: string;
  mode: 'single' | 'pair';
  displayDirection: 'given' | 'received' | 'mutual' | 'met';
  sort: ActivityRateRecordSort;
  sortDirection?: 'asc' | 'desc';
  cursor?: string | null;
  offset?: number;
  limit?: number;
  rangeStartIso?: string;
  rangeEndIso?: string;
}

export interface ActivityRateRecordQueryResult {
  records: UserRateRecord[];
  total: number;
  nextCursor?: string | null;
}

export interface UserRateOutboxRecord {
  id: string;
  rateId: string;
  action: 'upsert';
  payload: UserRateRecord;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  queuedAtIso: string;
  updatedAtIso: string;
  lastTriedAtIso: string | null;
  syncedAtIso: string | null;
  lastError: string | null;
}

export interface UserGameDataService {
  queryGameCardsUsersSnapshot(): UserDto[];
  recordGameCardRating(
    raterUserId: string,
    ratedUserId: string,
    rating: number,
    mode?: 'single' | 'pair'
  ): void;
  queryUserGameCardsByFilter(request: UserGameCardsQueryRequest): Promise<UserGameCardsQueryResponse>;
}

// Backward-compatible alias while callers migrate.
export type UserGameService = UserGameDataService;

export interface UserRatesSyncResult {
  syncedRateIds: string[];
  failedRateIds: string[];
  error: string | null;
}
