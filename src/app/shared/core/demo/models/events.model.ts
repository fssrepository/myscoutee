import type * as AppTypes from '../../../core/base/models';
import type { LocationCoordinates } from '../../base/interfaces';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const EVENTS_TABLE_NAME = APP_INDEXED_DB_KEYS.events;

export type DemoEventScopeFilter =
  | 'all'
  | 'active-events'
  | 'pending'
  | 'invitations'
  | 'my-events'
  | 'drafts'
  | 'trash';

export type DemoRepositoryEventItemType = 'events' | 'hosting' | 'invitations';
export type DemoEventActivitiesSort = 'date' | 'distance' | 'relevance';
export type DemoEventStatus =
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

export interface DemoEventRecord {
  id: string;
  userId: string;
  type: DemoRepositoryEventItemType;
  status?: DemoEventStatus;
  statusBeforeSuppression?: DemoEventStatus | null;
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
  visibility: AppTypes.EventVisibility;
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

export interface DemoEventListItem {
  id: string;
  userId: string;
  type: DemoRepositoryEventItemType;
  status?: DemoEventStatus;
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
  visibility: AppTypes.EventVisibility;
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

export type DemoEventCardRecord = DemoEventRecord | DemoEventListItem;

export interface DemoEventExploreQuery {
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

export interface DemoEventExploreQueryResult {
  records: DemoEventRecord[];
  total: number;
  nextCursor: string | null;
}

export interface DemoEventActivitiesQuery {
  userId: string;
  filter: DemoEventScopeFilter;
  hostingPublicationFilter?: 'all' | 'drafts';
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  sort: DemoEventActivitiesSort;
  view: AppTypes.ActivitiesView;
  limit: number;
  cursor?: string | null;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface DemoEventActivitiesListQueryResult {
  records: DemoEventListItem[];
  total: number;
  nextCursor: string | null;
}

export interface DemoEventRecordCollection {
  byId: Record<string, DemoEventRecord>;
  ids: string[];
}

export type DemoEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, DemoEventRecordCollection>;
