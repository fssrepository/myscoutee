import type * as AppTypes from '../../../core/base/models';
import type { LocationCoordinates } from '../../base/interfaces';

export const EVENTS_TABLE_NAME = 'events' as const;

export type DemoEventScopeFilter =
  | 'all'
  | 'active-events'
  | 'invitations'
  | 'my-events'
  | 'drafts'
  | 'trash';

export type DemoRepositoryEventItemType = 'events' | 'hosting' | 'invitations';
export type DemoEventActivitiesSort = 'date' | 'distance' | 'relevance';

export interface DemoEventRecord {
  id: string;
  userId: string;
  type: DemoRepositoryEventItemType;
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
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
  topics: string[];
  subEvents?: AppTypes.SubEventFormItem[];
  subEventsDisplayMode?: AppTypes.SubEventsDisplayMode;
  rating: number;
  relevance: number;
  affinity: number;
}

export interface DemoEventExploreQuery {
  userId: string;
  order: AppTypes.EventExploreOrder;
  view: AppTypes.EventExploreView;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
  limit: number;
  cursor?: string | null;
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
}

export interface DemoEventActivitiesQueryResult {
  records: DemoEventRecord[];
  total: number;
  nextCursor: string | null;
}

export interface DemoEventRecordCollection {
  byId: Record<string, DemoEventRecord>;
  ids: string[];
}

export type DemoEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, DemoEventRecordCollection>;
