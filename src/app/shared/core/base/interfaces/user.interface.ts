import type { UserGameFilterPreferencesDto } from './game.interface';

export interface UserImpressionsSectionDto {
  unreadCount?: number;
  averageRating?: number;
  peopleMet?: number;
  totalEvents?: number;
  repeatCount?: number;
  noShowCount?: number;
  vibeBadges?: string[];
  personalityBadges?: string[];
  categoryBadges?: string[];
}

export interface UserImpressionsDto {
  host?: UserImpressionsSectionDto;
  member?: UserImpressionsSectionDto;
}

export interface UserRealtimeCountersDto {
  game?: number;
  chat?: number;
  invitations?: number;
  events?: number;
  hosting?: number;
  tickets?: number;
  feedback?: number;
  impressionsHostChanged?: boolean;
  impressionsMemberChanged?: boolean;
}

export interface UserRealtimeLongPollResponseDto {
  userId: string;
  counters: UserRealtimeCountersDto;
  impressions?: UserImpressionsDto;
  cursor?: string | null;
  serverTsIso?: string;
}

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
  impressions?: UserImpressionsDto;
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

export interface UserProfileImageUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

export interface UserService {
  queryAvailableDemoUsers(): Promise<UsersListQueryResponse>;
  queryUserById(userId?: string): Promise<UserByIdQueryResponse>;
  queryUserRealtimeLongPoll(userId: string, cursor?: string | null): Promise<UserRealtimeLongPollResponseDto | null>;
  saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void>;
  saveUserProfile(user: UserDto): Promise<UserDto | null>;
  uploadUserProfileImage(userId: string, file: File, slotIndex: number): Promise<UserProfileImageUploadResult>;
}
