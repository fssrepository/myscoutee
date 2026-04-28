import type { UserGameFilterPreferencesDto } from './game.interface';
import type { LocationCoordinates } from './location.interface';

export interface UserPersonalityTraitDto {
  id: string;
  label: string;
  percent?: number;
  evidenceCount?: number;
  lastRatedAtIso?: string | null;
}

export interface UserImpressionsSectionDto {
  unreadCount?: number;
  averageRating?: number;
  peopleMet?: number;
  totalEvents?: number;
  repeatCount?: number;
  noShowCount?: number;
  vibeBadges?: string[];
  personalityBadges?: string[];
  personalityTraits?: UserPersonalityTraitDto[];
  categoryBadges?: string[];
}

export interface UserImpressionsDto {
  host?: UserImpressionsSectionDto;
  member?: UserImpressionsSectionDto;
}

export interface UserMenuCountersDto {
  game?: number;
  chat?: number;
  invitations?: number;
  events?: number;
  hosting?: number;
  tickets?: number;
  feedback?: number;
}

export interface UserRealtimeCountersDto extends UserMenuCountersDto {
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

export interface UserLocationEligibilityResponseDto {
  eligible: boolean;
  partitionKey?: string | null;
  message?: string | null;
  securityGateEnabled?: boolean;
  locationRequired?: boolean;
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
  affinity?: number;
  locationCoordinates?: LocationCoordinates;
  partitionKey?: string;
  images?: string[];
  impressions?: UserImpressionsDto;
  profileStatus: 'public' | 'friends only' | 'host only' | 'inactive' | 'deleted';
  activities: {
    game: number;
    chat: number;
    invitations: number;
    events: number;
    hosting: number;
    tickets?: number;
    feedback?: number;
  };
}


export type DemoUser = UserDto;
export interface UsersListQueryResponse {
  users: DemoUserListItemDto[];
}

export interface UserByIdQueryResponse {
  user: UserDto | null;
  filterCount?: number;
  filterPreferences?: UserGameFilterPreferencesDto | null;
  counterOverrides?: UserMenuCountersDto | null;
}

export interface UserFeedbackSubmitRequestDto {
  userId?: string;
  category: string;
  subject: string;
  details: string;
}

export interface UserReportUserSubmitRequestDto {
  userId?: string;
  handle: string;
  reason: string;
  details: string;
  targetUserId?: string;
  memberEntryId?: string | null;
  eventId?: string;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
}

export interface UserLogoutRequestDto {
  userId: string;
}

export interface UserDeleteRequestDto {
  userId: string;
}

export interface UserSubmitActionResponseDto {
  submitted: boolean;
  message?: string | null;
}

export interface UserProfileImageUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

export interface UserService {
  queryAvailableDemoUsers(): Promise<UsersListQueryResponse>;
  checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto>;
  queryUserById(userId?: string): Promise<UserByIdQueryResponse>;
  queryUserRealtimeLongPoll(userId: string, cursor?: string | null): Promise<UserRealtimeLongPollResponseDto | null>;
  saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void>;
  saveUserProfile(user: UserDto): Promise<UserDto | null>;
  submitUserFeedback(request: UserFeedbackSubmitRequestDto, signal?: AbortSignal): Promise<UserSubmitActionResponseDto>;
  submitReportUser(request: UserReportUserSubmitRequestDto, signal?: AbortSignal): Promise<UserSubmitActionResponseDto>;
  logoutUser(request: UserLogoutRequestDto, signal?: AbortSignal): Promise<UserSubmitActionResponseDto>;
  deleteUser(request: UserDeleteRequestDto, signal?: AbortSignal): Promise<UserSubmitActionResponseDto>;
  uploadUserProfileImage(userId: string, file: File, slotIndex: number): Promise<UserProfileImageUploadResult>;
}
