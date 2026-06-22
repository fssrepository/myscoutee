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
  loadEventFeedback(
    query: EventFeedbackQueryDto
  ): Promise<EventFeedbackDetailDto>;
  submitEventFeedback(userId: string, request: EventFeedbackDetailDto): Promise<void>;
  saveEventFeedbackNote(request: EventFeedbackNoteRequestDto): Promise<void>;
  removeEventFeedbackEvent(userId: string, eventId: string): Promise<void>;
  restoreEventFeedbackEvent(userId: string, eventId: string): Promise<void>;
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

export type ActivityEventDTOStatus = ActivityEventStatus;

export type ActivityEventDTOApplyInput = Partial<Omit<ActivityEventDTO, 'apply'>> & Pick<ActivityEventDTO, 'id'>;

export class ActivityEventDTO {
  id!: string;
  userId!: string;
  type!: ActivityEventRepositoryItemType;
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
  records: ActivityEventDTO[];
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

export type UserGameMode = 'single' | 'outside-network' | 'separated-friends' | 'friends-in-common';
export type UserGameSocialContext = 'separated-friends' | 'friends-in-common';

export interface UserGameSocialCard {
  id: string;
  userId: string;
  secondaryUserId?: string;
  socialContext?: UserGameSocialContext;
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

export interface EventFeedbackPageQueryDto {
  userId: string;
  filter: EventFeedbackListFilter;
  page: number;
  pageSize: number;
}

export interface EventFeedbackQueryDto {
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

export interface EventFeedbackDto {
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

export interface EventFeedbackCardDto {
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
  answerPrimary?: string;
  answerSecondary?: string;
  selectedTraitIds?: string[];
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

export type EventFeedbackFilterCountDelta = Partial<Record<EventFeedbackListFilter, number>>;

export class EventFeedbackPageResultDto {
  readonly items: EventFeedbackDto[];
  readonly total: number;
  readonly allItems: EventFeedbackDto[];
  readonly organizerItems: EventFeedbackDto[];
  readonly receivedEvents: EventFeedbackReceivedEventDto[];
  readonly state: EventFeedbackPageStateSnapshotDto;
  readonly counts: EventFeedbackPageCountsDto;

  static normalize(result: Partial<EventFeedbackPageResultDto> | null | undefined): EventFeedbackPageResultDto {
    return new EventFeedbackPageResultDto(result);
  }

  constructor(result: Partial<EventFeedbackPageResultDto> | null | undefined = null) {
    const allItems = EventFeedbackPageResultDto.clonePageItems(result?.allItems);
    const organizerItems = EventFeedbackPageResultDto.clonePageItems(result?.organizerItems);
    this.items = EventFeedbackPageResultDto.clonePageItems(result?.items);
    this.total = Math.max(0, Math.trunc(Number(result?.total) || 0));
    this.allItems = allItems;
    this.organizerItems = organizerItems;
    this.receivedEvents = EventFeedbackPageResultDto.cloneReceivedEvents(result?.receivedEvents);
    this.state = EventFeedbackPageResultDto.cloneStateSnapshot(result?.state);
    this.counts = {
      ownEvents: Math.max(0, Math.trunc(Number(result?.counts?.ownEvents ?? organizerItems.length) || 0)),
      pending: Math.max(0, Math.trunc(Number(result?.counts?.pending) || 0)),
      feedbacked: Math.max(0, Math.trunc(Number(result?.counts?.feedbacked) || 0)),
      removed: Math.max(0, Math.trunc(Number(result?.counts?.removed) || 0))
    };
  }

  itemById(eventId: string): EventFeedbackDto | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return [
      ...this.items,
      ...this.allItems,
      ...this.organizerItems
    ].find(item => item.eventId === normalizedEventId) ?? null;
  }

  eventTitleById(eventId: string): string {
    return this.itemById(eventId)?.title?.trim() || 'this event';
  }

  filterCount(filter: EventFeedbackListFilter): number {
    switch (filter) {
      case 'own-events':
        return Math.max(0, Math.trunc(Number(this.counts.ownEvents) || 0));
      case 'feedbacked':
        return Math.max(0, Math.trunc(Number(this.counts.feedbacked) || 0));
      case 'removed':
        return Math.max(0, Math.trunc(Number(this.counts.removed) || 0));
      case 'pending':
      default:
        return Math.max(0, Math.trunc(Number(this.counts.pending) || 0));
    }
  }

  filterCountWithDelta(
    filter: EventFeedbackListFilter,
    delta: EventFeedbackFilterCountDelta = {}
  ): number {
    return Math.max(0, this.filterCount(filter) + (delta[filter] ?? 0));
  }

  itemMatchesFilter(item: EventFeedbackDto, filter: EventFeedbackListFilter): boolean {
    switch (filter) {
      case 'own-events':
        return item.isOwnEvent === true;
      case 'feedbacked':
        return item.isFeedbacked === true;
      case 'removed':
        return item.isRemoved === true;
      case 'pending':
      default:
        return !item.isRemoved && item.pendingCards > 0;
    }
  }

  applySubmitToItem(
    item: EventFeedbackDto,
    dto: EventFeedbackDetailDto
  ): EventFeedbackDto {
    const submittedAtMs = this.submitTimestampMs(dto);
    const pendingCards = Math.max(0, item.pendingCards - dto.cards.length);
    return {
      ...item,
      pendingCards,
      isRemoved: false,
      isFeedbacked: pendingCards === 0,
      feedbackedAtMs: pendingCards === 0 ? submittedAtMs : item.feedbackedAtMs,
      removedAtMs: null
    };
  }

  removeItem(item: EventFeedbackDto, removedAtMs = Date.now()): EventFeedbackDto {
    return {
      ...item,
      isRemoved: true,
      isFeedbacked: false,
      removedAtMs
    };
  }

  restoreItem(item: EventFeedbackDto): EventFeedbackDto {
    return {
      ...item,
      isRemoved: false,
      isFeedbacked: item.pendingCards === 0,
      removedAtMs: null
    };
  }

  filterCountDelta(
    before: EventFeedbackDto,
    after: EventFeedbackDto
  ): EventFeedbackFilterCountDelta {
    return {
      pending: this.filterMembershipDelta(before, after, 'pending'),
      feedbacked: this.filterMembershipDelta(before, after, 'feedbacked'),
      removed: this.filterMembershipDelta(before, after, 'removed'),
      'own-events': this.filterMembershipDelta(before, after, 'own-events')
    };
  }

  patchItem(item: EventFeedbackDto): EventFeedbackPageResultDto {
    const patchList = (items: readonly EventFeedbackDto[]) =>
      items.map(current => current.eventId === item.eventId ? { ...item } : { ...current });
    return new EventFeedbackPageResultDto({
      ...this,
      items: patchList(this.items),
      allItems: patchList(this.allItems),
      organizerItems: patchList(this.organizerItems)
    });
  }

  patchOrganizerNote(eventId: string, text: string): EventFeedbackPageResultDto {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return this;
    }
    const organizerNotesByEventId = { ...this.state.organizerNotesByEventId };
    const trimmedText = text.trim();
    if (trimmedText) {
      organizerNotesByEventId[normalizedEventId] = trimmedText;
    } else {
      delete organizerNotesByEventId[normalizedEventId];
    }
    return new EventFeedbackPageResultDto({
      ...this,
      state: {
        ...this.state,
        organizerNotesByEventId
      }
    });
  }

  receivedEntries(eventId: string): readonly EventFeedbackReceivedEntryDto[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.receivedEvents.find(item => item.eventId === normalizedEventId)?.entries ?? [];
  }

  organizerEntries(eventId: string): EventFeedbackReceivedEntryDto[] {
    return [...this.receivedEntries(eventId)]
      .sort((left, right) => this.entryTimestampMs(right) - this.entryTimestampMs(left));
  }

  entriesLatestAtMs(entries: readonly EventFeedbackReceivedEntryDto[]): number | null {
    let latestAtMs: number | null = null;
    for (const entry of entries) {
      const candidateMs = this.entryTimestampMs(entry);
      if (candidateMs <= 0) {
        continue;
      }
      latestAtMs = latestAtMs === null ? candidateMs : Math.max(latestAtMs, candidateMs);
    }
    return latestAtMs;
  }

  groupTimestampMs(item: EventFeedbackDto, filter: EventFeedbackListFilter): number | null {
    switch (filter) {
      case 'feedbacked':
        return this.numberOrNull(item.feedbackedAtMs ?? item.startAtMs);
      case 'removed':
        return this.numberOrNull(item.removedAtMs ?? item.feedbackedAtMs ?? item.startAtMs);
      case 'own-events':
      case 'pending':
      default:
        return this.numberOrNull(item.startAtMs);
    }
  }

  private static clonePageItems(items: readonly EventFeedbackDto[] | undefined): EventFeedbackDto[] {
    return (items ?? []).map(item => ({
      eventId: item.eventId?.trim() ?? '',
      title: item.title?.trim() ?? '',
      subtitle: item.subtitle?.trim() ?? '',
      timeframe: item.timeframe?.trim() ?? '',
      imageUrl: item.imageUrl?.trim() ?? '',
      startAtMs: Math.max(0, Math.trunc(Number(item.startAtMs) || 0)),
      pendingCards: Math.max(0, Math.trunc(Number(item.pendingCards) || 0)),
      totalCards: Math.max(0, Math.trunc(Number(item.totalCards) || 0)),
      isRemoved: item.isRemoved === true,
      isFeedbacked: item.isFeedbacked === true,
      feedbackedAtMs: EventFeedbackPageResultDto.numberOrNullStatic(item.feedbackedAtMs),
      removedAtMs: EventFeedbackPageResultDto.numberOrNullStatic(item.removedAtMs),
      isOwnEvent: item.isOwnEvent === true
    })).filter(item => item.eventId.length > 0);
  }

  private static cloneReceivedEvents(
    events: readonly EventFeedbackReceivedEventDto[] | undefined
  ): EventFeedbackReceivedEventDto[] {
    return (events ?? [])
      .map(item => {
        const eventId = item.eventId?.trim() ?? '';
        return {
          eventId,
          entries: (item.entries ?? []).map(entry => ({
            viewerUserId: entry.viewerUserId?.trim() ?? '',
            viewerName: entry.viewerName?.trim() ?? '',
            viewerInitials: entry.viewerInitials?.trim() ?? '',
            viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as UserGender,
            viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
            eventId: entry.eventId?.trim() || eventId,
            submittedAtIso: entry.submittedAtIso?.trim() ?? '',
            updatedAtIso: entry.updatedAtIso?.trim() ?? '',
            organizerNote: entry.organizerNote?.trim() ?? '',
            answers: (entry.answers ?? []).map(answer => EventFeedbackPageResultDto.cloneSubmittedAnswer(answer))
          })).filter(entry => entry.viewerUserId.length > 0)
        };
      })
      .filter(item => item.eventId.length > 0);
  }

  private static cloneStateSnapshot(
    state: Partial<EventFeedbackPageStateSnapshotDto> | null | undefined
  ): EventFeedbackPageStateSnapshotDto {
    const next: EventFeedbackPageStateSnapshotDto = {
      submittedCardsById: {},
      submittedAnswersByCardId: {},
      submittedEventsById: {},
      removedEventsById: {},
      removedEventDatesById: {},
      organizerNotesByEventId: {}
    };
    for (const [key, value] of Object.entries(state?.submittedCardsById ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.submittedCardsById[normalizedKey] = true;
      }
    }
    for (const [key, value] of Object.entries(state?.submittedAnswersByCardId ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.submittedAnswersByCardId[normalizedKey] = EventFeedbackPageResultDto.cloneSubmittedAnswer(value);
      }
    }
    for (const [key, value] of Object.entries(state?.submittedEventsById ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.submittedEventsById[normalizedKey] = normalizedValue;
      }
    }
    for (const [key, value] of Object.entries(state?.removedEventsById ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.removedEventsById[normalizedKey] = true;
      }
    }
    for (const [key, value] of Object.entries(state?.removedEventDatesById ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.removedEventDatesById[normalizedKey] = normalizedValue;
      }
    }
    for (const [key, value] of Object.entries(state?.organizerNotesByEventId ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.organizerNotesByEventId[normalizedKey] = normalizedValue;
      }
    }
    return next;
  }

  private static cloneSubmittedAnswer(answer: SubmittedEventFeedbackAnswer): SubmittedEventFeedbackAnswer {
    return {
      ...answer,
      cardId: answer.cardId?.trim() ?? '',
      eventId: answer.eventId?.trim() ?? '',
      kind: answer.kind === 'attendee' ? 'attendee' : 'event',
      targetUserId: answer.targetUserId?.trim() || null,
      targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
      primaryValue: answer.primaryValue?.trim() ?? '',
      secondaryValue: answer.secondaryValue?.trim() ?? '',
      personalityTraitIds: [...(answer.personalityTraitIds ?? [])],
      tags: [...(answer.tags ?? [])],
      submittedAtIso: answer.submittedAtIso?.trim() ?? ''
    };
  }

  private static numberOrNullStatic(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }

  private submitTimestampMs(dto: EventFeedbackDetailDto): number {
    const submittedAtIso = dto.submittedAtIso.trim();
    const submittedAtMs = submittedAtIso ? new Date(submittedAtIso).getTime() : Date.now();
    return Number.isNaN(submittedAtMs) ? Date.now() : submittedAtMs;
  }

  private filterMembershipDelta(
    before: EventFeedbackDto,
    after: EventFeedbackDto,
    filter: EventFeedbackListFilter
  ): number {
    const wasVisible = this.itemMatchesFilter(before, filter);
    const isVisible = this.itemMatchesFilter(after, filter);
    return wasVisible === isVisible ? 0 : wasVisible ? -1 : 1;
  }

  private entryTimestampMs(entry: EventFeedbackReceivedEntryDto): number {
    const iso = entry.updatedAtIso?.trim()
      || entry.submittedAtIso?.trim()
      || (entry.answers ?? []).map(answer => answer.submittedAtIso?.trim() ?? '').find(Boolean)
      || '';
    const value = iso ? new Date(iso).getTime() : 0;
    return Number.isNaN(value) ? 0 : value;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    return EventFeedbackPageResultDto.numberOrNullStatic(value);
  }
}

export interface EventFeedbackDetailPendingOptions {
  activeUserId?: string | null;
  fallbackTitle?: string | null;
}

export class EventFeedbackDetailDto {
  readonly eventId: string;
  readonly title: string;
  readonly submittedAtIso: string;
  readonly cards: EventFeedbackCardDto[];

  static normalize(result: Partial<EventFeedbackDetailDto> | null | undefined): EventFeedbackDetailDto {
    return new EventFeedbackDetailDto(result);
  }

  constructor(result: Partial<EventFeedbackDetailDto> | null | undefined = null) {
    this.eventId = result?.eventId?.trim() ?? '';
    this.title = result?.title?.trim() ?? '';
    this.submittedAtIso = result?.submittedAtIso?.trim() ?? '';
    this.cards = EventFeedbackDetailDto.cloneCards(result?.cards);
  }

  pending(options: EventFeedbackDetailPendingOptions = {}): EventFeedbackDetailDto {
    const activeUserId = options.activeUserId?.trim() ?? '';
    return new EventFeedbackDetailDto({
      ...this,
      title: this.title || options.fallbackTitle?.trim() || '',
      cards: this.cards.filter(card =>
        card.eventId === this.eventId
        && !(card.kind === 'attendee' && card.attendeeUserId === activeUserId)
      )
    });
  }

  submitted(options: { submittedAtIso: string }): EventFeedbackDetailDto {
    return new EventFeedbackDetailDto({
      ...this,
      submittedAtIso: options.submittedAtIso
    });
  }

  withEmptyAnswers(): EventFeedbackDetailDto {
    return new EventFeedbackDetailDto({
      ...this,
      cards: this.cards.map(card => ({
        ...card,
        answerPrimary: '',
        answerSecondary: '',
        selectedTraitIds: []
      }))
    });
  }

  withFormValue(value: unknown): EventFeedbackDetailDto {
    const record = EventFeedbackDetailDto.isRecord(value) ? value : {};
    const inputCards = Array.isArray(record['cards']) ? record['cards'] : [];
    const cardInputById = new Map<string, Record<string, unknown>>();
    for (const item of inputCards) {
      if (!EventFeedbackDetailDto.isRecord(item)) {
        continue;
      }
      const cardId = `${item['id'] ?? ''}`.trim();
      if (cardId) {
        cardInputById.set(cardId, item);
      }
    }
    return new EventFeedbackDetailDto({
      ...this,
      cards: this.cards.map(card => {
        const inputCard = cardInputById.get(card.id) ?? {};
        return {
          ...card,
          answerPrimary: EventFeedbackDetailDto.stringValue(inputCard['answerPrimary']),
          answerSecondary: EventFeedbackDetailDto.stringValue(inputCard['answerSecondary']),
          selectedTraitIds: EventFeedbackDetailDto.normalizeSelectedTraitIds(inputCard['selectedTraitIds'])
        };
      })
    });
  }

  private static cloneCards(cards: readonly EventFeedbackCardDto[] | undefined): EventFeedbackCardDto[] {
    return (cards ?? []).map(card => ({
      id: card.id?.trim() ?? '',
      eventId: card.eventId?.trim() ?? '',
      kind: card.kind === 'attendee' ? 'attendee' as const : 'event' as const,
      attendeeUserId: card.attendeeUserId?.trim() || undefined,
      targetUserId: card.targetUserId?.trim() || undefined,
      targetRole: EventFeedbackDetailDto.normalizeRole(card.targetRole),
      eventTitle: card.eventTitle?.trim() ?? '',
      eventSubtitle: card.eventSubtitle?.trim() ?? '',
      eventImageUrl: card.eventImageUrl?.trim() ?? '',
      eventTimeframe: card.eventTimeframe?.trim() ?? '',
      eventStartAtIso: card.eventStartAtIso?.trim() ?? '',
      eventLabel: card.eventLabel?.trim() ?? '',
      targetName: card.targetName?.trim() ?? '',
      targetAge: EventFeedbackDetailDto.numberOrUndefined(card.targetAge),
      targetCity: card.targetCity?.trim() || undefined,
      targetGender: card.targetGender === 'woman' ? 'woman' as const : 'man' as const,
      targetTraitLabel: card.targetTraitLabel?.trim() || undefined,
      targetImageUrl: card.targetImageUrl?.trim() || undefined,
      answerPrimary: card.answerPrimary?.trim() ?? '',
      answerSecondary: card.answerSecondary?.trim() ?? '',
      selectedTraitIds: [...(card.selectedTraitIds ?? [])]
        .map(traitId => traitId.trim())
        .filter(Boolean)
    })).filter(card => card.id.length > 0 && card.eventId.length > 0);
  }

  private static normalizeRole(role: ActivityMemberRole | undefined): ActivityMemberRole | undefined {
    if (role === 'Admin' || role === 'Manager' || role === 'Member') {
      return role;
    }
    return undefined;
  }

  private static numberOrUndefined(value: number | null | undefined): number | undefined {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
  }

  private static stringValue(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private static normalizeSelectedTraitIds(value: unknown): string[] {
    const requestedValues = Array.isArray(value)
      ? value
      : value === null || value === undefined || value === ''
        ? []
        : [value];
    const selectedTraitIds: string[] = [];
    for (const requestedValue of requestedValues) {
      const traitId = `${requestedValue ?? ''}`.trim();
      if (!traitId || selectedTraitIds.includes(traitId)) {
        continue;
      }
      selectedTraitIds.push(traitId);
      if (selectedTraitIds.length >= 3) {
        break;
      }
    }
    return selectedTraitIds;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
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
