import type * as AppTypes from '.';
import type { LocationCoordinates } from '../../contracts/user.interface';

import type * as AppConstants from '../../common/constants';

export type ActivityEventScopeFilter =
  | 'all'
  | 'active-events'
  | 'pending'
  | 'invitations'
  | 'my-events'
  | 'drafts'
  | 'trash';

export type ActivityEventRepositoryItemType = 'events' | 'hosting' | 'invitations';
export type ActivityEventActivitiesSort = 'date' | 'distance' | 'relevance';
export type ActivityEventStatus =
  | 'A'
  | 'H'
  | 'INV'
  | 'DR'
  | 'T'
  | 'UR'
  | 'B'
  | 'D'
  | 'I'
  | 'active'
  | 'hosting'
  | 'invitation'
  | 'draft'
  | 'trashed';

export interface ActivityEventRecord {
  id: string;
  userId: string;
  type: ActivityEventRepositoryItemType;
  status?: ActivityEventStatus;
  statusBeforeSuppression?: ActivityEventStatus | null;
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter: string | null;
  unread: number;
  activity: number;
  isAdmin: boolean;
  isInvitation: boolean;
  isHosting: boolean;
  isTrashed: boolean;
  published: boolean;
  trashedAtIso: string | null;
  creatorUserId: string;
  creatorName: string;
  creatorInitials: string;
  creatorGender: 'woman' | 'man';
  creatorCity: string;
  visibility: AppConstants.EventVisibility;
  blindMode: AppTypes.EventBlindMode;
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
  pricing?: AppTypes.PricingConfig | null;
  policies?: AppTypes.EventPolicyItem[];
  slotsEnabled?: boolean;
  slotTemplates?: AppTypes.EventSlotTemplate[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: AppTypes.EventRecordKind;
  nextSlot?: AppTypes.EventSlotOccurrence | null;
  upcomingSlots?: AppTypes.EventSlotOccurrence[];
  acceptedMembers: number;
  pendingMembers: number;
  pendingReason?: 'approval' | 'waitlist' | null;
  topics: string[];
  subEvents?: AppTypes.SubEventFormItem[];
  subEventsDisplayMode?: AppTypes.SubEventsDisplayMode;
  rating: number;
  boost: number;
  affinity: number;
}

export interface ActivityEventListItem {
  id: string;
  userId: string;
  type: ActivityEventRepositoryItemType;
  status?: ActivityEventStatus;
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter?: string | null;
  unread: number;
  activity: number;
  isAdmin: boolean;
  isInvitation: boolean;
  isHosting: boolean;
  isTrashed: boolean;
  published: boolean;
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
  capacityMin: number | null;
  capacityMax: number | null;
  capacityTotal: number;
  ticketing: boolean;
  eventType?: AppTypes.EventRecordKind;
  acceptedMembers: number;
  pendingMembers: number;
  pendingReason?: 'approval' | 'waitlist' | null;
  topics: string[];
  rating: number;
  boost: number;
  affinity: number;
}

export type ActivityEventCardRecord = ActivityEventRecord | ActivityEventListItem;

export interface ActivityEventExploreQuery {
  userId: string;
  order: AppTypes.EventExploreOrder;
  view: AppTypes.EventExploreView;
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
  hostingPublicationFilter?: 'all' | 'drafts';
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  sort: ActivityEventActivitiesSort;
  view: AppTypes.ActivitiesView;
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
