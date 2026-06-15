import type {
  ActivitiesChatContextFilter,
  ActivitiesChatPageResultDTO,
  ChatRecord,
  SupportCaseFilter
} from './chat.interface';
import type {
  EventBlindMode,
  EventEditorTarget,
  EventPolicyItem,
  EventRecordKind,
  EventSlotOccurrence,
  EventSlotTemplate,
  SubEventFormItem,
  SubEventsDisplayMode
} from './event.interface';
import type { PricingConfig } from './pricing.interface';
import type { LocationCoordinates, UserDto } from './user.interface';
import type {
  ActivityInviteSort,
  ActivityMemberOwnerType,
  ActivityMemberRequestKind,
  ActivityMemberRole,
  ActivityMemberStatus,
  ActivityPendingReason,
  ActivityPendingSource,
  AssetType,
  EventFeedbackListFilter,
  EventVisibility,
  UserGender
} from '../common/constants';

export type ActivitiesPrimaryFilter = 'chats' | 'invitations' | 'events' | 'hosting' | 'rates';
export type ActivitiesEventScope = 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash';
export type ActivitiesSecondaryFilter = 'recent' | 'relevant' | 'past';
export type HostingPublicationFilter = 'all' | 'drafts';
export type ActivitiesView = 'month' | 'week' | 'day' | 'distance';
export type EventExploreView = 'day' | 'distance';
export type EventExploreOrder = 'upcoming' | 'past-events' | 'nearby' | 'most-relevant' | 'top-rated';
export type RateFilterKey =
  | 'individual-given'
  | 'individual-received'
  | 'individual-mutual'
  | 'individual-met'
  | 'pair-given'
  | 'pair-received';

export type ActivityRateDTOMode = 'individual' | 'pair';
export type ActivityRateDTODirection = 'given' | 'received' | 'mutual' | 'met';
export type ActivityRateDTOSocialContext = 'separated-friends' | 'friends-in-common';

export interface ActivityRateDTO {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: ActivityRateDTOMode;
  direction: ActivityRateDTODirection;
  socialContext?: ActivityRateDTOSocialContext;
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceMetersExact?: number;
}

export interface ActivityRatePageResultDTO {
  items: ActivityRateDTO[];
  total: number;
  nextCursor?: string | null;
  users?: UserDto[];
}

export interface IEventsService {
  queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO>;
  loadEventFeedbackPage(
    query: EventFeedbackPageQueryDto
  ): Promise<EventFeedbackPageResultDto>;
  loadEventFeedbackDeck(
    query: EventFeedbackDeckQueryDto
  ): Promise<EventFeedbackDeckResultDto>;
  saveActivityEvent(
    payload: ActivityEventSaveDTO
  ): Promise<ActivityEventDTO | null>;
}

export interface IChatsService {
  queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest,
    options?: { chatItems?: readonly ChatRecord[] }
  ): Promise<ActivitiesChatPageResultDTO>;
}

export interface IRatesService {
  queryRateItemsByUser(userId: string): Promise<ActivityRateDTO[]>;
  queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResultDTO>;
}

export interface ActivitiesFeedFilters {
  primaryFilter?: ActivitiesPrimaryFilter;
  eventScopeFilter?: ActivitiesEventScope;
  secondaryFilter?: ActivitiesSecondaryFilter;
  chatContextFilter?: ActivitiesChatContextFilter;
  hostingPublicationFilter?: HostingPublicationFilter;
  rateFilter?: RateFilterKey;
  rateSocialBadgeEnabled?: boolean;
  adminServiceOnly?: boolean;
  supportCaseFilter?: SupportCaseFilter;
}

export interface EventExploreFeedFilters {
  userId: string;
  order: EventExploreOrder;
  view: EventExploreView;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
  excludedSourceIds?: string[];
}

export interface ActivityEventSaveDTO {
  id: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  startAt: string;
  endAt?: string;
  distanceKm: number;
  imageUrl: string;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  autoInviter?: boolean;
  frequency?: string;
  ticketing?: boolean;
  pricing?: PricingConfig | null;
  slotsEnabled?: boolean;
  slotTemplates?: EventSlotTemplate[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  nextSlot?: EventSlotOccurrence | null;
  upcomingSlots?: EventSlotOccurrence[];
  visibility?: EventVisibility;
  blindMode?: EventBlindMode;
  status?: ActivityEventStatus;
  creatorUserId?: string;
  creatorName?: string;
  creatorInitials?: string;
  creatorGender?: UserGender;
  creatorCity?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  sourceLink?: string;
  policies?: EventPolicyItem[];
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  paymentSessionId?: string | null;
}

export interface ActivitiesPageRequest {
  primaryFilter: ActivitiesPrimaryFilter;
  eventScopeFilter?: ActivitiesEventScope;
  secondaryFilter: ActivitiesSecondaryFilter;
  chatContextFilter: ActivitiesChatContextFilter;
  hostingPublicationFilter: HostingPublicationFilter;
  rateFilter: RateFilterKey;
  rateSocialBadgeEnabled?: boolean;
  view: ActivitiesView;
  page: number;
  pageSize: number;
  cursor?: string | null;
  sort?: string;
  direction?: 'asc' | 'desc';
  groupBy?: string;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  adminServiceOnly?: boolean;
  supportCaseFilter?: SupportCaseFilter;
}

export type ActivityEventScopeFilter = ActivitiesEventScope;
export type ActivityEventRepositoryItemType = 'events' | 'hosting' | 'invitations';
export type ActivityEventActivitiesSort = 'date' | 'distance' | 'relevance';
export type ActivityEventStatus =
  | 'A'
  | 'DR'
  | 'T'
  | 'UR'
  | 'B'
  | 'D'
  | 'I';

export interface ActivityEventRecord {
  id: string;
  userId: string;
  type: ActivityEventRepositoryItemType;
  status?: ActivityEventStatus;
  statusBeforeSuppression?: ActivityEventStatus | null;
  adminIds?: string[];
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter: string | null;
  unread: number;
  activity: number;
  isAdmin?: boolean;
  isInvitation?: boolean;
  isHosting?: boolean;
  isTrashed?: boolean;
  trashedAtIso: string | null;
  creatorUserId: string;
  creatorName: string;
  creatorInitials: string;
  creatorGender: UserGender;
  creatorCity: string;
  visibility: EventVisibility;
  blindMode: EventBlindMode;
  startAtIso: string;
  endAtIso: string;
  distanceKm: number;
  imageUrl: string;
  sourceLink: string;
  location: string;
  locationCoordinates: LocationCoordinates | null;
  capacityMin: number | null;
  capacityMax: number | null;
  capacityTotal: number;
  autoInviter?: boolean;
  frequency?: string;
  ticketing: boolean;
  pricing?: PricingConfig | null;
  policies?: EventPolicyItem[];
  slotsEnabled?: boolean;
  slotTemplates?: EventSlotTemplate[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  nextSlot?: EventSlotOccurrence | null;
  upcomingSlots?: EventSlotOccurrence[];
  acceptedMembers: number;
  pendingMembers: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  invitedMemberUserIds?: string[];
  pendingRequestMemberUserIds?: string[];
  pendingReason?: ActivityPendingReason;
  topics: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  rating: number;
  boost: number;
  affinity: number;
}

export interface ActivityEventListItem {
  id: string;
  userId: string;
  type: ActivityEventRepositoryItemType;
  status?: ActivityEventStatus;
  adminIds?: string[];
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter?: string | null;
  unread: number;
  activity: number;
  isAdmin?: boolean;
  isInvitation?: boolean;
  isHosting?: boolean;
  isTrashed?: boolean;
  creatorUserId: string;
  creatorName: string;
  creatorInitials: string;
  creatorCity: string;
  visibility: EventVisibility;
  startAtIso: string;
  endAtIso: string;
  distanceKm: number;
  imageUrl: string;
  location: string;
  capacityMin: number | null;
  capacityMax: number | null;
  capacityTotal: number;
  ticketing: boolean;
  eventType?: EventRecordKind;
  acceptedMembers: number;
  pendingMembers: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  invitedMemberUserIds?: string[];
  pendingRequestMemberUserIds?: string[];
  pendingReason?: ActivityPendingReason;
  topics: string[];
  rating: number;
  boost: number;
  affinity: number;
}

export type ActivityEventCardRecord = ActivityEventRecord | ActivityEventListItem;

export type ActivityEventDTOStatus = ActivityEventStatus;

export type ActivityEventDTOApplyInput = Partial<Omit<ActivityEventDTO, 'apply'>> & Pick<ActivityEventDTO, 'id'>;

export class ActivityEventDTO {
  id!: string;
  userId!: string;
  status?: ActivityEventDTOStatus;
  statusBeforeSuppression?: ActivityEventDTOStatus | null;
  adminIds!: string[];
  avatar!: string;
  title!: string;
  subtitle!: string;
  timeframe!: string;
  inviter!: string | null;
  unread!: number;
  activity!: number;
  trashedAtIso?: string | null;
  creatorUserId!: string;
  creatorName!: string;
  creatorInitials!: string;
  creatorGender?: UserGender;
  creatorCity!: string;
  visibility!: EventVisibility;
  blindMode?: EventBlindMode;
  startAtIso!: string;
  endAtIso!: string;
  distanceKm!: number;
  imageUrl!: string;
  sourceLink?: string;
  location!: string;
  locationCoordinates?: LocationCoordinates | null;
  capacityMin!: number | null;
  capacityMax!: number | null;
  capacityTotal!: number;
  autoInviter?: boolean;
  frequency?: string;
  ticketing!: boolean;
  pricing?: PricingConfig | null;
  policies?: EventPolicyItem[];
  slotsEnabled?: boolean;
  slotTemplates?: EventSlotTemplate[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  nextSlot?: EventSlotOccurrence | null;
  upcomingSlots?: EventSlotOccurrence[];
  acceptedMembers!: number;
  pendingMembers!: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  invitedMemberUserIds?: string[];
  pendingRequestMemberUserIds?: string[];
  pendingReason?: ActivityPendingReason;
  topics!: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  rating!: number;
  boost!: number;
  affinity!: number;

  constructor(data: Omit<ActivityEventDTO, 'apply'>) {
    Object.assign(this, ActivityEventDTO.copyDefined(data));
  }

  apply(update: ActivityEventDTO): ActivityEventDTO;
  apply(update: ActivityEventDTOApplyInput): ActivityEventDTO;
  apply(update: ActivityEventDTOApplyInput): ActivityEventDTO {
    const current = ActivityEventDTO.copyDefined(this);
    const patch = ActivityEventDTO.copyDefined(update);
    const acceptedMembers = ActivityEventDTO.countValue(patch.acceptedMembers, current.acceptedMembers);
    const pendingMembers = ActivityEventDTO.countValue(patch.pendingMembers, current.pendingMembers);
    const capacityTotal = Math.max(
      acceptedMembers,
      ActivityEventDTO.countValue(patch.capacityTotal, current.capacityTotal)
    );

    return new ActivityEventDTO({
      ...current,
      ...patch,
      endAtIso: patch.endAtIso ?? (patch.startAtIso ? patch.startAtIso : current.endAtIso),
      acceptedMembers,
      pendingMembers,
      capacityTotal
    });
  }

  static from(data: ActivityEventDTO): ActivityEventDTO;
  static from(data: Omit<ActivityEventDTO, 'apply'>): ActivityEventDTO;
  static from(data: ActivityEventDTO | Omit<ActivityEventDTO, 'apply'>): ActivityEventDTO {
    return data instanceof ActivityEventDTO
      ? data
      : new ActivityEventDTO(data);
  }

  private static copyDefined<T extends object>(value: T): T {
    const copy = ActivityEventDTO.copyValue(value);
    for (const key of Object.keys(copy) as (keyof T)[]) {
      if (copy[key] === undefined) {
        delete copy[key];
      }
    }
    return copy;
  }

  private static copyValue<T>(value: T): T {
    return value == null
      ? value
      : JSON.parse(JSON.stringify(value)) as T;
  }

  private static countValue(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.max(0, Math.trunc(numeric))
      : Math.max(0, Math.trunc(Number(fallback) || 0));
  }
}

export interface ActivityEventPageResultDTO {
  items: ActivityEventDTO[];
  total: number;
  nextCursor?: string | null;
}

export interface ActivityEventExploreQuery {
  userId: string;
  order: EventExploreOrder;
  view: EventExploreView;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
  limit: number;
  cursor?: string | null;
  excludedSourceIds?: string[];
}

export interface ActivityEventExploreQueryResult {
  records: ActivityEventRecord[];
  total: number;
  nextCursor: string | null;
}

export interface ActivityEventActivitiesQuery {
  userId: string;
  filter: ActivityEventScopeFilter;
  hostingPublicationFilter?: HostingPublicationFilter;
  secondaryFilter: ActivitiesSecondaryFilter;
  sort: ActivityEventActivitiesSort;
  view: ActivitiesView;
  limit: number;
  cursor?: string | null;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface ActivityEventActivitiesListQueryResult {
  records: ActivityEventListItem[];
  total: number;
  nextCursor: string | null;
}

export interface ActivityMemberEntry {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserGender;
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
  genders?: UserGender[];
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

export interface EventCheckoutAssetSelection {
  subEventId: string;
  resourceType: AssetType;
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
  pendingReason?: ActivityPendingReason;
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
  pendingReason?: ActivityPendingReason;
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
  targetRole: ActivityMemberRole;
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
  viewerGender: UserGender;
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

export interface EventFeedbackPageQueryDto {
  userId: string;
  filter: EventFeedbackListFilter;
  page: number;
  pageSize: number;
}

export interface EventFeedbackDeckQueryDto {
  userId: string;
  eventId: string;
}

export interface EventFeedbackPageCountsDto {
  ownEvents: number;
  pending: number;
  feedbacked: number;
  removed: number;
}

export interface EventFeedbackPageStateSnapshotDto {
  submittedCardsById: Record<string, true>;
  submittedAnswersByCardId: Record<string, SubmittedEventFeedbackAnswer>;
  submittedEventsById: Record<string, string>;
  removedEventsById: Record<string, true>;
  removedEventDatesById: Record<string, string>;
  organizerNotesByEventId: Record<string, string>;
}

export interface EventFeedbackPageItemDto {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number;
  pendingCards: number;
  totalCards: number;
  isRemoved: boolean;
  isFeedbacked: boolean;
  feedbackedAtMs: number | null;
  removedAtMs?: number | null;
  isOwnEvent?: boolean;
}

export interface EventFeedbackCardSourceDto {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: ActivityMemberRole;
  eventTitle: string;
  eventSubtitle: string;
  eventImageUrl: string;
  eventTimeframe: string;
  eventStartAtIso: string;
  eventLabel: string;
  targetName: string;
  targetAge?: number;
  targetCity?: string;
  targetGender?: UserGender;
  targetTraitLabel?: string;
  targetImageUrl?: string;
}

export interface EventFeedbackPageResultDto {
  items: EventFeedbackPageItemDto[];
  total: number;
  allItems: EventFeedbackPageItemDto[];
  organizerItems: EventFeedbackPageItemDto[];
  receivedEvents: EventFeedbackReceivedEventDto[];
  state: EventFeedbackPageStateSnapshotDto;
  counts: EventFeedbackPageCountsDto;
}

export interface EventFeedbackDeckResultDto {
  eventId: string;
  title: string;
  cards: EventFeedbackCardSourceDto[];
}

export interface EventFeedbackAnswerSubmitDto {
  cardId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: ActivityMemberRole;
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
