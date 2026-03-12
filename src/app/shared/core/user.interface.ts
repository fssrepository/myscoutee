export interface DemoUserListItemDto {
  id: string;
  name: string;
  city: string;
  initials: string;
  gender: 'woman' | 'man';
}

export interface UserDto {
  id: string;
  name: string;
  age: number;
  birthday: string;
  city: string;
  height: string;
  physique: string;
  languages: string[];
  horoscope: string;
  initials: string;
  gender: 'woman' | 'man';
  statusText: string;
  hostTier: string;
  traitLabel: string;
  completion: number;
  headline: string;
  about: string;
  images?: string[];
  profileStatus: 'public' | 'friends only' | 'host only' | 'inactive';
  activities: {
    game: number;
    chat: number;
    invitations: number;
    events: number;
    hosting: number;
  };
}

export interface UsersListQueryResponse {
  users: DemoUserListItemDto[];
}

export interface UserByIdQueryResponse {
  user: UserDto | null;
  filterCount?: number;
  filterPreferences?: UserGameFilterPreferencesDto | null;
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
  source: 'game-card';
  createdAtIso: string;
  updatedAtIso: string;
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

export interface UserService {
  queryAvailableDemoUsers(): Promise<UsersListQueryResponse>;
  queryUserById(userId: string): Promise<UserByIdQueryResponse>;
  queryUserGameCardsByFilter(request: UserGameCardsQueryRequest): Promise<UserGameCardsQueryResponse>;
}
