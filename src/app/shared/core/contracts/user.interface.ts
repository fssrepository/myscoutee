import type * as ActivityContracts from './activity.interface';
import type * as AppConstants from '../common/constants';
import type * as ProfileContracts from './profile.interface';

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

export interface UserMenuCounterDeltasDto {
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
  event?: UserEventCounterDeltasDto;
  asset?: UserAssetCounterDeltasDto;
  eventFeedback?: UserEventFeedbackCounterDeltasDto;
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

export interface UserEventCounterDeltasDto {
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

export interface UserAssetCounterDeltasDto {
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

export interface UserEventFeedbackCounterDeltasDto {
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
  gender: AppConstants.UserGender;
  statusText?: string;
  completion?: number;
  profileFormVersion?: number;
  profileStatus?: UserDto['profileStatus'];
  deletedAtIso?: string | null;
}

export type UserSelectorRole = 'member' | 'admin';

export class UserDto {
  id = '';
  name = '';
  age = 0;
  birthday = '';
  city = '';
  height = '';
  physique = '';
  languages: string[] = [];
  horoscope = '';
  initials = '';
  gender: AppConstants.UserGender = 'man';
  statusText = '';
  hostTier = '';
  traitLabel = '';
  completion = 0;
  profileFormVersion?: number;
  headline = '';
  about = '';
  affinity?: number;
  locationCoordinates?: LocationCoordinates;
  partitionKey?: string;
  images?: string[];
  profileDetails?: ProfileContracts.ProfileDetailFormGroup[];
  impressions?: UserImpressionsDto;
  profileStatus: AppConstants.ProfileStatus = 'public';
  previousProfileStatus?: AppConstants.ProfileStatus | null;
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
  } = {
    game: 0,
    chat: 0,
    invitations: 0,
    events: 0,
    hosting: 0
  };

  constructor() {
    this.images = [];
    this.profileDetails = [];
  }
}

export interface UserByIdQueryResponse {
  user: UserDto | null;
  filterCount?: number;
  filterPreferences?: ActivityContracts.UserGameFilterPreferencesDto | null;
  counterOverrides?: UserMenuCountersDto | null;
}

export class ProfileExtDto {
  profile = new UserDto();
  experienceEntries: ProfileContracts.ExperienceEntry[] = [];
}

export interface ProfileExtByIdQueryResponse {
  profileExt: ProfileExtDto | null;
  filterCount?: number;
  filterPreferences?: ActivityContracts.UserGameFilterPreferencesDto | null;
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
  queryAvailableDemoUsers(selectorRole?: UserSelectorRole): Promise<UserSelectorListItemDto[]>;
  checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto>;
  queryUserById(userId?: string, requestTimeoutMs?: number): Promise<UserByIdQueryResponse>;
  loadProfileExtById(userId?: string, requestTimeoutMs?: number): Promise<ProfileExtByIdQueryResponse>;
  queryUserRealtimeLongPoll(userId: string, cursor?: string | null, requestTimeoutMs?: number): Promise<UserRealtimeLongPollResponseDto | null>;
  saveUserFilterPreferences(userId: string, preferences: ActivityContracts.UserGameFilterPreferencesDto): Promise<void>;
  saveUserProfile(user: UserDto, requestTimeoutMs?: number): Promise<UserDto | null>;
  saveUserProfileExt(request: ProfileExtDto, requestTimeoutMs?: number): Promise<UserDto | null>;
  submitUserFeedback(request: UserFeedbackSubmitRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  submitReportUser(request: UserReportUserSubmitRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  logoutUser(request: UserLogoutRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
  deleteUser(request: UserDeleteRequestDto, signal?: AbortSignal, requestTimeoutMs?: number): Promise<UserSubmitActionResponseDto>;
}
