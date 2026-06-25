import type * as AppConstants from '../common/constants';
import type * as ChatContracts from './chat.interface';
import type { DateRangeDto } from './date.interface';
import type * as EventContracts from './event.interface';
import type * as PricingContracts from './pricing.interface';
import type * as UserContracts from './user.interface';

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
  users?: UserContracts.UserDto[];
}

export interface IEventsService {
  queryActivitiesEventDTOPage(
    query: ActivityEventActivitiesQuery,
    signal?: AbortSignal
  ): Promise<ActivityEventPageResultDTO>;
  loadEventDetailById(userId: string, eventId: string): Promise<ActivityEventDetailDTO | null>;
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
    payload: ActivityEventDetailDTO
  ): Promise<ActivityEventDTO | null>;
}

export interface IChatsService {
  queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest,
    options?: { chatItems?: readonly ChatContracts.ChatRecord[] }
  ): Promise<ChatContracts.ActivitiesChatPageResultDTO>;
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
  chatContextFilter?: ChatContracts.ActivitiesChatContextFilter;
  hostingPublicationFilter?: HostingPublicationFilter;
  rateFilter?: RateFilterKey;
  rateSocialBadgeEnabled?: boolean;
  adminServiceOnly?: boolean;
  supportCaseFilter?: ChatContracts.SupportCaseFilter;
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

export interface ActivitiesPageRequest {
  primaryFilter: ActivitiesPrimaryFilter;
  eventScopeFilter?: ActivitiesEventScope;
  secondaryFilter: ActivitiesSecondaryFilter;
  chatContextFilter: ChatContracts.ActivitiesChatContextFilter;
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
  supportCaseFilter?: ChatContracts.SupportCaseFilter;
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
  creatorGender: AppConstants.UserGender;
  creatorCity: string;
  visibility: AppConstants.EventVisibility;
  blindMode: EventContracts.EventBlindMode;
  startAtIso: string;
  endAtIso: string;
  distanceKm: number;
  imageUrl: string;
  sourceLink: string;
  location: string;
  locationCoordinates: UserContracts.LocationCoordinates | null;
  capacityMin: number | null;
  capacityMax: number | null;
  capacityTotal: number;
  autoInviter?: boolean;
  frequency?: string;
  ticketing: boolean;
  pricing?: PricingContracts.PricingConfig | null;
  policies?: EventContracts.EventPolicyDTO[];
  slotsEnabled?: boolean;
  slotTemplates?: EventContracts.EventSlotTemplateDTO[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventContracts.EventRecordKind;
  nextSlot?: EventContracts.EventSlotOccurrenceDTO | null;
  upcomingSlots?: EventContracts.EventSlotOccurrenceDTO[];
  acceptedMembers: number;
  pendingMembers: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  invitedMemberUserIds?: string[];
  pendingRequestMemberUserIds?: string[];
  pendingReason?: AppConstants.ActivityPendingReason;
  topics: string[];
  subEventDefinitions?: SubEventDefinitionDTO[];
  subEvents?: EventContracts.SubEventDTO[];
  mode?: EventContracts.EventMode;
  rating: number;
  boost: number;
  affinity: number;
}

export interface ActivityEventDTO {
  id: string;
  userId: string;
  type: ActivityEventRepositoryItemType;
  status?: ActivityEventStatus;
  adminIds: string[];
  title: string;
  subtitle: string;
  timeframe: string;
  inviter: string | null;
  activity: number;
  creatorUserId: string;
  creatorName: string;
  creatorInitials: string;
  creatorCity: string;
  visibility: AppConstants.EventVisibility;
  startAtIso: string;
  endAtIso: string;
  distanceKm: number;
  imageUrl: string;
  location: string;
  capacityTotal: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  eventType?: EventContracts.EventRecordKind;
  acceptedMembers: number;
  pendingMembers: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  invitedMemberUserIds?: string[];
  pendingRequestMemberUserIds?: string[];
  pendingReason?: AppConstants.ActivityPendingReason;
  boost: number;
  subEventDefinitions?: SubEventDefinitionDTO[];
}

export type SubEventDefinitionTiming = 'Before' | 'During' | 'After';

export interface SubEventDefinitionDTO {
  id: string;
  name: string;
  description: string;
  timing: SubEventDefinitionTiming;
  offsetMinutes: number;
  durationMinutes: number;
  location?: string;
  groups?: EventContracts.SubEventGroupDTO[];
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: EventContracts.TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  optional: boolean;
  pricing?: PricingContracts.PricingConfig | null;
  capacityMin: number;
  capacityMax: number;
  icon?: string | null;
}

export class ActivityEventDetailDTO {
  id = '';
  userId = '';
  type: ActivityEventRepositoryItemType = 'events';
  status?: ActivityEventStatus = 'DR';
  statusBeforeSuppression?: ActivityEventStatus | null = null;
  adminIds: string[] = [];
  avatar = '';
  title = '';
  subtitle = '';
  timeframe = '';
  inviter: string | null = null;
  unread = 0;
  activity = 0;
  trashedAtIso?: string | null = null;
  creatorUserId = '';
  creatorName = '';
  creatorInitials = '';
  creatorGender?: AppConstants.UserGender;
  creatorCity = '';
  visibility: AppConstants.EventVisibility = 'Public';
  blindMode: EventContracts.EventBlindMode = 'Open Event';
  startAtIso = '';
  endAtIso = '';
  dateRange: DateRangeDto = { startAt: '', endAt: '', precision: 'minute' };
  distanceKm = 0;
  imageUrl = '';
  sourceLink = '';
  location = '';
  locationCoordinates: UserContracts.LocationCoordinates | null = null;
  capacityMin: number | null = 0;
  capacityMax: number | null = 0;
  capacityTotal = 0;
  autoInviter = false;
  frequency = 'One-time';
  ticketing = false;
  pricing: PricingContracts.PricingConfig | null = null;
  policies: EventContracts.EventPolicyDTO[] = [];
  slotsEnabled = false;
  slotTemplates: EventContracts.EventSlotTemplateDTO[] = [];
  parentEventId: string | null = null;
  slotTemplateId: string | null = null;
  generated = false;
  eventType: EventContracts.EventRecordKind = 'main';
  nextSlot: EventContracts.EventSlotOccurrenceDTO | null = null;
  upcomingSlots: EventContracts.EventSlotOccurrenceDTO[] = [];
  acceptedMembers = 0;
  pendingMembers = 0;
  acceptedMemberUserIds: string[] = [];
  pendingMemberUserIds: string[] = [];
  invitedMemberUserIds: string[] = [];
  pendingRequestMemberUserIds: string[] = [];
  pendingReason?: AppConstants.ActivityPendingReason;
  topics: string[] = [];
  subEventDefinitions: SubEventDefinitionDTO[] = [];
  subEvents: EventContracts.SubEventDTO[] = [];
  mode: EventContracts.EventMode = 'Casual';
  rating = 0;
  boost = 0;
  affinity = 0;
  paymentSessionId: string | null = null;

  apply(update: Partial<ActivityEventDetailDTO> | null | undefined): this {
    if (!update) {
      return this;
    }

    this.id = update.id ?? this.id;
    this.userId = update.userId ?? this.userId;
    this.type = update.type ?? this.type;
    this.status = update.status ?? this.status;
    this.statusBeforeSuppression = update.statusBeforeSuppression ?? this.statusBeforeSuppression;
    this.adminIds = [...(update.adminIds ?? this.adminIds)];
    this.avatar = update.avatar ?? this.avatar;
    this.title = update.title ?? this.title;
    this.subtitle = update.subtitle ?? this.subtitle;
    this.timeframe = update.timeframe ?? this.timeframe;
    this.inviter = update.inviter ?? this.inviter;
    this.unread = ActivityEventDetailDTO.nonNegativeInteger(update.unread ?? this.unread);
    this.activity = ActivityEventDetailDTO.nonNegativeInteger(update.activity ?? this.activity);
    this.trashedAtIso = update.trashedAtIso ?? this.trashedAtIso;
    this.creatorUserId = update.creatorUserId ?? this.creatorUserId;
    this.creatorName = update.creatorName ?? this.creatorName;
    this.creatorInitials = update.creatorInitials ?? this.creatorInitials;
    this.creatorGender = update.creatorGender ?? this.creatorGender;
    this.creatorCity = update.creatorCity ?? this.creatorCity;
    this.visibility = update.visibility ?? this.visibility;
    this.blindMode = update.blindMode ?? this.blindMode;
    this.dateRange = ActivityEventDetailDTO.normalizeDateRange(update.dateRange ?? {
      startAt: update.startAtIso ?? this.dateRange.startAt ?? this.startAtIso,
      endAt: update.endAtIso ?? this.dateRange.endAt ?? this.endAtIso,
      precision: 'minute'
    });
    this.startAtIso = this.dateRange.startAt;
    this.endAtIso = this.dateRange.endAt;
    this.distanceKm = Number.isFinite(update.distanceKm) ? Number(update.distanceKm) : this.distanceKm;
    this.imageUrl = update.imageUrl ?? this.imageUrl;
    this.sourceLink = update.sourceLink ?? this.sourceLink;
    this.location = update.location ?? this.location;
    this.locationCoordinates = update.locationCoordinates ? { ...update.locationCoordinates } : update.locationCoordinates === null ? null : this.locationCoordinates;
    this.capacityMin = update.capacityMin ?? this.capacityMin;
    this.capacityMax = update.capacityMax ?? this.capacityMax;
    this.capacityTotal = ActivityEventDetailDTO.nonNegativeInteger(update.capacityTotal ?? this.capacityTotal);
    this.autoInviter = update.autoInviter ?? this.autoInviter;
    this.frequency = update.frequency ?? this.frequency;
    this.ticketing = update.ticketing ?? this.ticketing;
    this.pricing = ActivityEventDetailDTO.clonePricingConfig(update.pricing ?? this.pricing);
    this.applyPolicies(update.policies ?? this.policies);
    this.slotsEnabled = update.slotsEnabled ?? this.slotsEnabled;
    this.applySlotTemplates(update.slotTemplates ?? this.slotTemplates);
    this.parentEventId = update.parentEventId ?? this.parentEventId;
    this.slotTemplateId = update.slotTemplateId ?? this.slotTemplateId;
    this.generated = update.generated ?? this.generated;
    this.eventType = update.eventType ?? this.eventType;
    this.nextSlot = update.nextSlot ? { ...update.nextSlot } : update.nextSlot === null ? null : this.nextSlot;
    this.upcomingSlots = (update.upcomingSlots ?? this.upcomingSlots).map(item => ({ ...item }));
    this.acceptedMembers = ActivityEventDetailDTO.nonNegativeInteger(update.acceptedMembers ?? this.acceptedMembers);
    this.pendingMembers = ActivityEventDetailDTO.nonNegativeInteger(update.pendingMembers ?? this.pendingMembers);
    this.acceptedMemberUserIds = [...(update.acceptedMemberUserIds ?? this.acceptedMemberUserIds)];
    this.pendingMemberUserIds = [...(update.pendingMemberUserIds ?? this.pendingMemberUserIds)];
    this.invitedMemberUserIds = [...(update.invitedMemberUserIds ?? this.invitedMemberUserIds)];
    this.pendingRequestMemberUserIds = [...(update.pendingRequestMemberUserIds ?? this.pendingRequestMemberUserIds)];
    this.pendingReason = update.pendingReason ?? this.pendingReason;
    this.topics = [...(update.topics ?? this.topics)];
    this.applySubEventDefinitions(update.subEventDefinitions ?? this.subEventDefinitions);
    this.applySubEvents(update.subEvents ?? this.subEvents);
    this.mode = ActivityEventDetailDTO.normalizeMode(update.mode ?? this.mode);
    this.rating = ActivityEventDetailDTO.nonNegativeInteger(update.rating ?? this.rating);
    this.boost = ActivityEventDetailDTO.nonNegativeInteger(update.boost ?? this.boost);
    this.affinity = ActivityEventDetailDTO.nonNegativeInteger(update.affinity ?? this.affinity);
    this.paymentSessionId = update.paymentSessionId ?? this.paymentSessionId;
    return this;
  }

  clone(): ActivityEventDetailDTO {
    return new ActivityEventDetailDTO().apply(this);
  }

  applyPolicies(items: readonly EventContracts.EventPolicyDTO[]): this {
    this.policies = ActivityEventDetailDTO.normalizePolicies(items);
    return this;
  }

  applySlotTemplates(items: readonly EventContracts.EventSlotTemplateDTO[]): this {
    this.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(items);
    return this;
  }

  applySubEventDefinitions(items: readonly SubEventDefinitionDTO[]): this {
    this.subEventDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(items);
    return this;
  }

  applySubEvents(items: readonly EventContracts.SubEventDTO[]): this {
    this.subEvents = ActivityEventDetailDTO.normalizeSubEvents(items);
    return this;
  }

  normalizeCapacityRange(): EventContracts.EventCapacityRange {
    const min = ActivityEventDetailDTO.nonNegativeIntegerOrNull(this.capacityMin);
    const maxCandidate = ActivityEventDetailDTO.nonNegativeIntegerOrNull(this.capacityMax);
    const max = min !== null && maxCandidate !== null
      ? Math.max(min, maxCandidate)
      : (maxCandidate ?? min);
    this.capacityMin = min;
    this.capacityMax = max;
    return { min, max };
  }

  syncFirstSubEventLocation(location: string): this {
    if (this.subEvents.length === 0) {
      return this;
    }
    const first = ActivityEventDetailDTO.firstSubEventByOrder(this.subEvents);
    if (!first?.id) {
      return this;
    }
    const normalizedLocation = ActivityEventDetailDTO.normalizeLocation(location);
    this.subEvents = this.subEvents.map(item => item.id === first.id
      ? { ...item, location: normalizedLocation, groups: ActivityEventDetailDTO.cloneSubEventGroups(item.groups) }
      : { ...item, groups: ActivityEventDetailDTO.cloneSubEventGroups(item.groups) });
    return this;
  }

  static normalizePolicies(items: readonly EventContracts.EventPolicyDTO[]): EventContracts.EventPolicyDTO[] {
    return items.map((item, index) => ({
      id: `${item.id ?? `policy-${index + 1}`}`.trim() || `policy-${index + 1}`,
      title: `${item.title ?? ''}`.trim() || `Policy ${index + 1}`,
      description: `${item.description ?? ''}`.trim(),
      required: item.required !== false
    })).filter(item => item.id || item.title || item.description);
  }

  static normalizeSlotTemplates(items: readonly EventContracts.EventSlotTemplateDTO[]): EventContracts.EventSlotTemplateDTO[] {
    return items.map((item, index) => {
      if (item.closed === true) {
        return {
          id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
          startAt: '',
          overrideDate: ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate),
          closed: true
        };
      }
      const normalizedStart = `${item.startAt ?? ''}`.trim();
      const parsedStart = ActivityEventDetailDTO.parseDate(normalizedStart) ?? new Date();
      return {
        id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
        startAt: ActivityEventDetailDTO.parseDate(normalizedStart) ? normalizedStart : ActivityEventDetailDTO.toIsoDateTimeLocal(parsedStart),
        overrideDate: ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate),
        closed: false
      };
    });
  }

  static normalizeSubEventDefinitions(items: readonly SubEventDefinitionDTO[]): SubEventDefinitionDTO[] {
    return items.map((item, index) => {
      const capacityMin = ActivityEventDetailDTO.nonNegativeInteger(item.capacityMin);
      const capacityMax = Math.max(capacityMin, ActivityEventDetailDTO.nonNegativeInteger(item.capacityMax));
      const durationMinutes = ActivityEventDetailDTO.nonNegativeInteger(item.durationMinutes);
      const timing = ActivityEventDetailDTO.normalizeSubEventDefinitionTiming(item.timing);
      const offsetMinutes = ActivityEventDetailDTO.nonNegativeInteger(item.offsetMinutes);
      return {
        id: `${item.id ?? `subevent-definition-${index + 1}`}`.trim() || `subevent-definition-${index + 1}`,
        name: `${item.name ?? `Sub Event ${index + 1}`}`.trim() || `Sub Event ${index + 1}`,
        description: `${item.description ?? ''}`.trim(),
        timing,
        offsetMinutes,
        durationMinutes,
        location: ActivityEventDetailDTO.normalizeLocation(item.location),
        groups: ActivityEventDetailDTO.cloneSubEventGroups(item.groups, index),
        tournamentGroupCount: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCount),
        tournamentGroupCapacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
        tournamentGroupCapacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
        tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
        optional: item.optional === true,
        pricing: ActivityEventDetailDTO.clonePricingConfig(item.pricing),
        capacityMin,
        capacityMax,
        icon: `${item.icon ?? ''}`.trim() || null
      };
    });
  }

  static normalizeSubEventDefinitionTiming(value: unknown): SubEventDefinitionTiming {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'before') {
      return 'Before';
    }
    if (normalized === 'after') {
      return 'After';
    }
    return 'During';
  }

  static normalizeDateRange(value: Partial<DateRangeDto> | null | undefined): DateRangeDto {
    return {
      startAt: `${value?.startAt ?? ''}`.trim(),
      endAt: `${value?.endAt ?? ''}`.trim(),
      precision: value?.precision === 'date' ? 'date' : 'minute'
    };
  }

  static normalizeSubEvents(items: readonly EventContracts.SubEventDTO[]): EventContracts.SubEventDTO[] {
    return items.map((item, index) => {
      const capacityMin = ActivityEventDetailDTO.nonNegativeInteger(item.capacityMin);
      const capacityMax = Math.max(capacityMin, ActivityEventDetailDTO.nonNegativeInteger(item.capacityMax));
      return {
        id: `${item.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: `${item.startAt ?? ''}`.trim(),
        endAt: `${item.endAt ?? ''}`.trim(),
        location: ActivityEventDetailDTO.normalizeLocation(item.location),
        createdByUserId: item.createdByUserId?.trim() || undefined,
        optional: item.optional === true,
        pricing: ActivityEventDetailDTO.clonePricingConfig(item.pricing),
        capacityMin,
        capacityMax,
        groups: ActivityEventDetailDTO.cloneSubEventGroups(item.groups, index),
        tournamentGroupCount: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCount),
        tournamentGroupCapacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
        tournamentGroupCapacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
        tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: ActivityEventDetailDTO.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
        membersAccepted: ActivityEventDetailDTO.nonNegativeInteger(item.membersAccepted),
        membersPending: ActivityEventDetailDTO.nonNegativeInteger(item.membersPending),
        carsPending: ActivityEventDetailDTO.nonNegativeInteger(item.carsPending),
        accommodationPending: ActivityEventDetailDTO.nonNegativeInteger(item.accommodationPending),
        suppliesPending: ActivityEventDetailDTO.nonNegativeInteger(item.suppliesPending),
        carsAccepted: ActivityEventDetailDTO.optionalNonNegativeInteger(item.carsAccepted),
        accommodationAccepted: ActivityEventDetailDTO.optionalNonNegativeInteger(item.accommodationAccepted),
        suppliesAccepted: ActivityEventDetailDTO.optionalNonNegativeInteger(item.suppliesAccepted),
        carsCapacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(item.carsCapacityMin),
        carsCapacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(item.carsCapacityMax),
        accommodationCapacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(item.accommodationCapacityMin),
        accommodationCapacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(item.accommodationCapacityMax),
        suppliesCapacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(item.suppliesCapacityMin),
        suppliesCapacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(item.suppliesCapacityMax),
        slotStartOffsetMinutes: ActivityEventDetailDTO.optionalNonNegativeInteger(item.slotStartOffsetMinutes),
        slotDurationMinutes: ActivityEventDetailDTO.optionalNonNegativeInteger(item.slotDurationMinutes),
        stageStatus: `${item.stageStatus ?? ''}`.trim() || undefined,
        stageStatusReason: `${item.stageStatusReason ?? ''}`.trim() || undefined,
        stageStatusUpdatedAt: `${item.stageStatusUpdatedAt ?? ''}`.trim() || undefined,
        stageFinalizedAt: `${item.stageFinalizedAt ?? ''}`.trim() || undefined,
        stageFinalizedByUserId: `${item.stageFinalizedByUserId ?? ''}`.trim() || undefined
      };
    });
  }

  static sortSubEventsByStartAsc<T extends Pick<EventContracts.SubEventDTO, 'startAt'>>(items: readonly T[]): T[] {
    return [...items]
      .map((item, index) => ({ item, index, startMs: ActivityEventDetailDTO.parseDate(item.startAt)?.getTime() ?? Number.POSITIVE_INFINITY }))
      .sort((left, right) => left.startMs - right.startMs || left.index - right.index)
      .map(entry => entry.item);
  }

  static firstSubEventByOrder<T extends Pick<EventContracts.SubEventDTO, 'startAt'>>(items: readonly T[]): T | null {
    return ActivityEventDetailDTO.sortSubEventsByStartAsc(items)[0] ?? null;
  }

  static normalizeSlotOverrideDate(value: unknown): string | null {
    const parsed = ActivityEventDetailDTO.parseDateOnly(value);
    return parsed ? ActivityEventDetailDTO.toIsoDate(parsed) : null;
  }

  static normalizeVisibility(value: unknown): AppConstants.EventVisibility {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'private' || normalized.includes('friend')) {
      return 'Friends only';
    }
    if (normalized.includes('invitation')) {
      return 'Invitation only';
    }
    return 'Public';
  }

  static normalizeFrequency(value: unknown): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'daily') {
      return 'Daily';
    }
    if (normalized === 'weekly') {
      return 'Weekly';
    }
    if (normalized.includes('bi-week') || normalized.includes('bi week')) {
      return 'Bi-weekly';
    }
    if (normalized === 'monthly') {
      return 'Monthly';
    }
    if (normalized === 'yearly' || normalized === 'annual' || normalized === 'annually') {
      return 'Yearly';
    }
    return 'One-time';
  }

  static normalizeBlindMode(value: unknown): EventContracts.EventBlindMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('blind') ? 'Blind Event' : 'Open Event';
  }

  static normalizeMode(value: unknown): EventContracts.EventMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized === 'tournament' ? 'Tournament' : 'Casual';
  }

  static normalizeTopics(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
      .filter(item => item.length > 0)
      .slice(0, 5);
  }

  static normalizeTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  static normalizeLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  static buildTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = ActivityEventDetailDTO.parseDate(startAt);
    const end = ActivityEventDetailDTO.parseDate(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = ActivityEventDetailDTO.normalizeFrequency(frequency);

    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }

    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
  }

  private static cloneSubEventGroups(
    groups: readonly EventContracts.SubEventGroupDTO[] | undefined,
    subEventIndex = 0
  ): EventContracts.SubEventGroupDTO[] {
    return (groups ?? []).map((group, groupIndex) => ({
      id: `${group.id ?? `group-${subEventIndex + 1}-${groupIndex + 1}`}`.trim() || `group-${subEventIndex + 1}-${groupIndex + 1}`,
      name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
      source: group.source === 'manual' ? 'manual' : 'generated',
      capacityMin: ActivityEventDetailDTO.optionalNonNegativeInteger(group.capacityMin),
      capacityMax: ActivityEventDetailDTO.optionalNonNegativeInteger(group.capacityMax)
    }));
  }

  private static clonePricingConfig(value: PricingContracts.PricingConfig | null | undefined): PricingContracts.PricingConfig | null {
    if (!value) {
      return null;
    }
    return {
      ...value,
      demandRules: (value.demandRules ?? []).map(rule => ({ ...rule, action: { ...rule.action }, slotIds: [...(rule.slotIds ?? [])] })),
      timeRules: (value.timeRules ?? []).map(rule => ({ ...rule, action: { ...rule.action }, slotIds: [...(rule.slotIds ?? [])] })),
      cancellationPolicy: {
        ...value.cancellationPolicy,
        rules: (value.cancellationPolicy?.rules ?? []).map(rule => ({ ...rule }))
      },
      slotOverrides: (value.slotOverrides ?? []).map(slot => ({ ...slot })),
      audience: {
        ...value.audience,
        promoCodes: (value.audience?.promoCodes ?? []).map(code => ({ ...code, action: { ...code.action } }))
      }
    };
  }

  private static nonNegativeInteger(value: unknown): number {
    return ActivityEventDetailDTO.nonNegativeIntegerOrNull(value) ?? 0;
  }

  private static optionalNonNegativeInteger(value: unknown): number | undefined {
    return ActivityEventDetailDTO.nonNegativeIntegerOrNull(value) ?? undefined;
  }

  private static nonNegativeIntegerOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  private static parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsedNumber = new Date(value);
      return Number.isNaN(parsedNumber.getTime()) ? null : parsedNumber;
    }
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static parseDateOnly(value: unknown): Date | null {
    const parsed = ActivityEventDetailDTO.parseDate(value);
    return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
  }

  private static toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static toIsoDateTimeLocal(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
  gender: AppConstants.UserGender;
  city: string;
  statusText: string;
  role: AppConstants.ActivityMemberRole;
  status: AppConstants.ActivityMemberStatus;
  pendingSource: AppConstants.ActivityPendingSource;
  requestKind: AppConstants.ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  invitedByUserId?: string | null;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  avatarUrl: string;
  profile?: UserContracts.UserDto | null;
}

export interface ActivityMemberOwnerRef {
  ownerType: AppConstants.ActivityMemberOwnerType;
  ownerId: string;
}

export interface ActivityMembersSummary {
  ownerType: AppConstants.ActivityMemberOwnerType;
  ownerId: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
}

export interface ActivityInviteOwnerContext {
  ownerId: string;
  ownerType: AppConstants.ActivityMemberOwnerType;
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
  sort: AppConstants.ActivityInviteSort;
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
  genders?: AppConstants.UserGender[];
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
  resourceType: AppConstants.AssetType;
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
  pendingReason?: AppConstants.ActivityPendingReason;
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
  pendingReason?: AppConstants.ActivityPendingReason;
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
  targetRole: AppConstants.ActivityMemberRole;
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
  filter: AppConstants.EventFeedbackListFilter;
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
  targetRole?: AppConstants.ActivityMemberRole;
  eventTitle: string;
  eventSubtitle: string;
  eventImageUrl: string;
  eventTimeframe: string;
  eventStartAtIso: string;
  eventLabel: string;
  targetName: string;
  targetAge?: number;
  targetCity?: string;
  targetGender?: AppConstants.UserGender;
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
  viewerGender: AppConstants.UserGender;
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

export type EventFeedbackFilterCountDelta = Partial<Record<AppConstants.EventFeedbackListFilter, number>>;

export class EventFeedbackPageResultDto {
  readonly items: EventFeedbackDto[];
  readonly total: number;
  readonly allItems: EventFeedbackDto[];
  readonly organizerItems: EventFeedbackDto[];
  readonly receivedEvents: EventFeedbackReceivedEventDto[];
  readonly state: EventFeedbackPageStateSnapshotDto;
  readonly counts: EventFeedbackPageCountsDto;

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

  filterCount(filter: AppConstants.EventFeedbackListFilter): number {
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
    filter: AppConstants.EventFeedbackListFilter,
    delta: EventFeedbackFilterCountDelta = {}
  ): number {
    return Math.max(0, this.filterCount(filter) + (delta[filter] ?? 0));
  }

  itemMatchesFilter(item: EventFeedbackDto, filter: AppConstants.EventFeedbackListFilter): boolean {
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

  groupTimestampMs(item: EventFeedbackDto, filter: AppConstants.EventFeedbackListFilter): number | null {
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
            viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as AppConstants.UserGender,
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
    filter: AppConstants.EventFeedbackListFilter
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

  private static normalizeRole(role: AppConstants.ActivityMemberRole | undefined): AppConstants.ActivityMemberRole | undefined {
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
  queryGameCardsUsersSnapshot(): UserContracts.UserDto[];
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
