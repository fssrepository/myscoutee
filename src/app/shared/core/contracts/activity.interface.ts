import type { UserDto } from './user.interface';

export type ActivityMemberStatus = 'pending' | 'accepted' | 'disqualified';
export type ActivityPendingSource = 'admin' | 'member' | null;
export type ActivityInviteSort = 'recent' | 'relevant';
export type ActivityMemberRequestKind = 'invite' | 'join' | 'waitlist' | 'waitlist-invite' | null;
export type ActivityMemberRole = 'Admin' | 'Member' | 'Manager';
export type ActivityMemberOwnerType = 'event' | 'subEvent' | 'group' | 'asset';

export interface ActivityMemberEntry {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  role: ActivityMemberRole;
  status: ActivityMemberStatus;
  pendingSource: ActivityPendingSource;
  requestKind: ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  invitedByUserId?: string | null;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  avatarUrl: string;
  profile?: UserDto | null;
}

export interface ActivityMemberOwnerRef {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
}

export interface ActivityMembersSummary {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
}

export interface ActivityInviteOwnerContext {
  ownerId: string;
  ownerType: ActivityMemberOwnerType;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceKm: number;
  sourceType: 'events' | 'hosting';
  isAdmin: boolean;
}

export interface ActivityInviteCandidatesQuery {
  activeUserId: string;
  owner: ActivityInviteOwnerContext;
  existingMemberUserIds: readonly string[];
  sort: ActivityInviteSort;
}

export interface IActivityInviteCandidatesService {
  queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityMemberEntry[]>;
}

export type RateRecordMode = 'individual' | 'pair';
export type RateRecordDirection = 'given' | 'received' | 'mutual' | 'met';
export type RateRecordSocialContext = 'separated-friends' | 'friends-in-common';

export interface RateRecord {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: RateRecordMode;
  direction: RateRecordDirection;
  socialContext?: RateRecordSocialContext;
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceMetersExact?: number;
}

export interface UserGameCardsStackSnapshot {
  filterCount: number | null;
  cardUserIds: string[];
  socialCards: UserGameSocialCard[];
  nextCursor: string | null;
  requestInFlight: boolean;
}

export type UserGameMode = 'single' | 'pair' | 'separated-friends' | 'friends-in-common';

export interface UserGameSocialCard {
  id: string;
  userId: string;
  secondaryUserId?: string;
  socialContext: 'separated-friends' | 'friends-in-common';
  bridgeUserId?: string;
  bridgeCount?: number;
  eventName?: string;
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
  mode?: UserGameMode;
  leftQuery?: string | null;
  rightQuery?: string | null;
  filterPreferences?: UserGameFilterPreferencesDto | null;
  cursor?: string | null;
  pageSize?: number;
}

export interface UserGameCardsDto {
  filterCount: number;
  cardUserIds: string[];
  socialCards?: UserGameSocialCard[];
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
  createdAtIso: string;
  updatedAtIso: string;
  ownerUserId?: string;
  displayId?: string;
  displayDirection?: 'given' | 'received' | 'mutual' | 'met';
  socialContext?: 'separated-friends' | 'friends-in-common';
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven?: number;
  scoreReceived?: number;
  eventName?: string;
  happenedAtIso?: string;
  distanceMetersExact?: number;
}

export type ActivityRateRecordSort = 'happenedAt' | 'distance' | 'relevance';

export interface ActivityRateRecordQuery {
  ownerUserId: string;
  mode: 'single' | 'pair';
  displayDirection: 'given' | 'received' | 'mutual' | 'met';
  socialBadgeEnabled?: boolean;
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

export interface ActivityRatePageResult {
  items: RateRecord[];
  total: number;
  nextCursor?: string | null;
  users?: UserDto[];
}

export interface EventCheckoutAssetSelection {
  subEventId: string;
  resourceType: 'Car' | 'Accommodation' | 'Supplies';
}

export interface EventCheckoutLineItem {
  id: string;
  kind: 'event' | 'sub_event' | 'resource';
  label: string;
  detail: string;
  amount: number;
  currency: string;
}

export interface EventCheckoutSelection {
  sourceId: string;
  slotSourceId?: string | null;
  optionalSubEventIds: string[];
  assetSelections: EventCheckoutAssetSelection[];
  acceptedPolicyIds: string[];
  lineItems: EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  paymentSessionId?: string | null;
  bookingConfirmed?: boolean;
  pendingReason?: 'approval' | 'waitlist' | null;
}

export interface EventCheckoutRequest {
  userId: string;
  sourceId: string;
  slotSourceId?: string | null;
  optionalSubEventIds: string[];
  assetSelections: EventCheckoutAssetSelection[];
  acceptedPolicyIds: string[];
  lineItems: EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  pendingReason?: 'approval' | 'waitlist' | null;
}

export interface EventCheckoutSession {
  id: string;
  provider: string;
  mode: 'dummy' | 'gateway';
  status: 'pending' | 'approved' | 'requires_action';
  amount: number;
  currency: string;
  paymentUrl?: string | null;
}

export interface SubmittedEventFeedbackAnswer {
  cardId: string;
  eventId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: 'Admin' | 'Manager' | 'Member';
  primaryValue: string;
  secondaryValue: string;
  personalityTraitIds: string[];
  tags: string[];
  submittedAtIso: string;
}

export interface EventFeedbackStateDto {
  eventId: string;
  removed: boolean;
  submittedAtIso: string;
  removedAtIso?: string;
  organizerNote: string;
  answersByCardId?: Record<string, SubmittedEventFeedbackAnswer>;
}

export interface EventFeedbackReceivedEntryDto {
  viewerUserId: string;
  viewerName: string;
  viewerInitials: string;
  viewerGender: 'woman' | 'man';
  viewerImageUrl: string;
  eventId: string;
  submittedAtIso: string;
  updatedAtIso: string;
  organizerNote: string;
  answers: SubmittedEventFeedbackAnswer[];
}

export interface EventFeedbackReceivedEventDto {
  eventId: string;
  entries: EventFeedbackReceivedEntryDto[];
}

export interface EventFeedbackAnswerSubmitDto {
  cardId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: 'Admin' | 'Manager' | 'Member';
  primaryValue: string;
  secondaryValue: string;
  personalityTraitIds: string[];
  tags: string[];
  submittedAtIso: string;
}

export interface EventFeedbackSubmitRequestDto {
  userId: string;
  eventId: string;
  answers: EventFeedbackAnswerSubmitDto[];
}

export interface EventFeedbackNoteRequestDto {
  userId: string;
  eventId: string;
  text: string;
}

export interface EventFeedbackToggleRequestDto {
  userId: string;
  eventId: string;
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
  queryUserGameCardsByFilter(
    request: UserGameCardsQueryRequest,
    requestTimeoutMs?: number
  ): Promise<UserGameCardsQueryResponse>;
}

export type UserGameService = UserGameDataService;

export interface UserRatesSyncResult {
  syncedRateIds: string[];
  failedRateIds: string[];
  error: string | null;
}
