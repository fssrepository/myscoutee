import type { UserGameFilterPreferencesDto } from './activity.interface';
import type {
  ProfileStatus,
  UserGender
} from '../common/constants';
import type { ProfileDetailFormGroup } from './profile.interface';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface FirebaseAuthProfileDto {
  id: string;
  name: string;
  email: string;
  initials: string;
  imageUrl?: string;
}

export type FirebaseAuthProvider = 'google' | 'facebook' | 'email';
export type FirebaseEmailAuthMode = 'sign-in' | 'create';

export interface FirebaseAuthRequestDto {
  provider: FirebaseAuthProvider;
  emailMode?: FirebaseEmailAuthMode;
  email?: string;
  password?: string;
}

export interface EntryConsentStateDto {
  version: string;
  accepted: boolean;
  acceptedAtIso: string;
}

export interface EntryConsentAuditRecordDto {
  tsIso: string;
  action: 'accepted' | 'rejected';
  version: string;
  source: 'entry';
  userAgent: string;
}

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
  gender: UserGender;
  statusText?: string;
  completion?: number;
  profileFormVersion?: number;
  profileStatus?: UserDto['profileStatus'];
  deletedAtIso?: string | null;
}

export type UserSelectorRole = 'member' | 'admin';

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
  gender: UserGender;
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
  profileStatus: ProfileStatus;
  previousProfileStatus?: ProfileStatus | null;
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
  queryAvailableDemoUsers(requestTimeoutMs?: number, selectorRole?: UserSelectorRole): Promise<UsersListQueryResponse>;
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
