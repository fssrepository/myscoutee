import type { UserGameFilterPreferencesDto } from './game.interface';
import type { LocationCoordinates } from './location.interface';
import type { ProfileDetailFormGroup } from './profile.interface';

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
  cars?: number;
  accommodation?: number;
  supplies?: number;
  tickets?: number;
  contacts?: number;
  feedback?: number;
  event?: UserEventCountersDto;
  asset?: UserAssetCountersDto;
  eventFeedback?: UserEventFeedbackCountersDto;
  adminJobs?: number;
  adminMetrics?: number;
}

export interface UserEventCountersDto {
  all?: number;
  active?: number;
  pending?: number;
  invitations?: number;
  hosting?: number;
  drafts?: number;
  trash?: number;
}

export interface UserAssetCountersDto {
  cars?: number;
  accommodation?: number;
  supplies?: number;
  tickets?: number;
}

export interface UserEventFeedbackCountersDto {
  ownEvents?: number;
  pending?: number;
  feedbacked?: number;
  removed?: number;
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

export interface UserSelectorListItemDto {
  id: string;
  name: string;
  city: string;
  initials: string;
  gender: 'woman' | 'man';
  statusText?: string;
  completion?: number;
  profileFormVersion?: number;
  profileStatus?: UserDto['profileStatus'];
  deletedAtIso?: string | null;
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
  profileFormVersion?: number;
  headline: string;
  about: string;
  affinity?: number;
  locationCoordinates?: LocationCoordinates;
  partitionKey?: string;
  images?: string[];
  profileDetails?: ProfileDetailFormGroup[];
  impressions?: UserImpressionsDto;
  profileStatus: 'public' | 'friends only' | 'host only' | 'inactive' | 'blocked' | 'deleted' | 'onboarding';
  previousProfileStatus?: UserDto['profileStatus'] | null;
  deletedAtIso?: string | null;
  admin?: boolean;
  activities: {
    game: number;
    chat: number;
    invitations: number;
    events: number;
    hosting: number;
    cars?: number;
    accommodation?: number;
    supplies?: number;
    tickets?: number;
    contacts?: number;
    feedback?: number;
    event?: UserEventCountersDto;
    asset?: UserAssetCountersDto;
    eventFeedback?: UserEventFeedbackCountersDto;
    adminJobs?: number;
    adminMetrics?: number;
  };
}

export interface UsersListQueryResponse {
  users: UserSelectorListItemDto[];
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
  sourceType?: string | null;
  sourceId?: string | null;
  sourceText?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  assetId?: string | null;
  assetType?: string | null;
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

export interface UserService {
  queryAvailableDemoUsers(requestTimeoutMs?: number): Promise<UsersListQueryResponse>;
  checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto>;
  queryUserById(userId?: string, requestTimeoutMs?: number): Promise<UserByIdQueryResponse>;
  queryUserRealtimeLongPoll(userId: string, cursor?: string | null, requestTimeoutMs?: number): Promise<UserRealtimeLongPollResponseDto | null>;
  saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void>;
  saveUserProfile(user: UserDto, requestTimeoutMs?: number): Promise<UserDto | null>;
  submitUserFeedback(request: UserFeedbackSubmitRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  submitReportUser(request: UserReportUserSubmitRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  logoutUser(request: UserLogoutRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  deleteUser(request: UserDeleteRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
}
