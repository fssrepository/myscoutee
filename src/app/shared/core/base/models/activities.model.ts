import type { LocationCoordinates } from '../interfaces/location.interface';
import type { ChatMenuItem } from '../interfaces/activity-feed.interface';
import type { AssetCard, AssetType } from './asset.model';
import type { ActivityMemberEntry } from './activity-member.model';
import type { ActivitiesChatContextFilter, ChatChannelType } from './chat.model';
import type { ActivitiesEventScope, ActivitiesPrimaryFilter, ActivitiesSecondaryFilter, ActivitiesView, ActivityListRow, HostingPublicationFilter, RateFilterKey } from './activities-ui.model';
import type {
  EventBlindMode,
  EventEditorTarget,
  EventRecordKind,
  EventSlotOccurrence,
  EventSlotTemplate,
  EventVisibility,
  SubEventFormItem
} from './event.model';

export type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AssetType, AssetCard[]>>;
export type ActivityMemberOwnerType = 'event' | 'subEvent' | 'group' | 'asset';

export interface ActivitiesFeedFilters {
  primaryFilter?: ActivitiesPrimaryFilter;
  eventScopeFilter?: ActivitiesEventScope;
  secondaryFilter?: ActivitiesSecondaryFilter;
  chatContextFilter?: ActivitiesChatContextFilter;
  hostingPublicationFilter?: HostingPublicationFilter;
  rateFilter?: RateFilterKey;
}

export interface EventExploreFeedFilters {
  userId: string;
  order: import('./activities-ui.model').EventExploreOrder;
  view: import('./activities-ui.model').EventExploreView;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
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

export type ActivitiesNavigationRequest =
  | { type: 'eventExplore'; stacked?: boolean }
  | {
      type: 'chatResource';
      ownerId?: string;
      item: ChatMenuItem;
      resourceType: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
      subEvent: SubEventFormItem;
      group?: { id: string; groupLabel: string } | null;
      assetAssignmentIds?: SubEventAssetAssignmentIds;
      assetCardsByType?: SubEventAssetCardsByType;
    }
  | {
      type: 'members';
      ownerId: string;
      ownerType?: ActivityMemberOwnerType;
      subtitle?: string;
      canManage?: boolean;
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      members?: readonly ActivityMemberEntry[];
      onMembersChanged?: (members: readonly ActivityMemberEntry[]) => void;
    }
  | { type: 'eventEditorMembers'; row: ActivityListRow }
  | { type: 'eventEditorCreate'; target: EventEditorTarget }
  | { type: 'eventEditor'; row: ActivityListRow; readOnly: boolean };

export type EventChatContextTone =
  | 'popup-chat-context-btn-tone-main-event'
  | 'popup-chat-context-btn-tone-optional'
  | 'popup-chat-context-btn-tone-group';

export interface EventChatResourceContext {
  type: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
  icon: string;
  title: string;
  typeClass: string;
  summary: string;
  pending: number;
  stateClass: string;
  visible: boolean;
}

export interface EventChatContext {
  channelType: ChatChannelType;
  hasSubEventMenu: boolean;
  actionIcon: string;
  actionLabel: string;
  actionToneClass: EventChatContextTone;
  actionBadgeCount: number;
  menuTitle: string;
  eventRow: ActivityListRow | null;
  subEventRow: ActivityListRow | null;
  subEvent: SubEventFormItem | null;
  group: { id: string; label: string } | null;
  assetAssignmentIds: SubEventAssetAssignmentIds;
  assetCardsByType: SubEventAssetCardsByType;
  resources: EventChatResourceContext[];
}

export interface ActivitiesEventSyncPayload {
  id: string;
  target: EventEditorTarget;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin: boolean;
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
  published?: boolean;
  creatorUserId?: string;
  creatorName?: string;
  creatorInitials?: string;
  creatorGender?: 'woman' | 'man';
  creatorCity?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  sourceLink?: string;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: import('./event.model').SubEventsDisplayMode;
}

export interface EventChatSession {
  item: ChatMenuItem;
  openedAtIso: string;
  context: EventChatContext | null;
}

export interface ActivitiesPageRequest {
  primaryFilter: ActivitiesPrimaryFilter;
  eventScopeFilter?: ActivitiesEventScope;
  secondaryFilter: ActivitiesSecondaryFilter;
  chatContextFilter: ActivitiesChatContextFilter;
  hostingPublicationFilter: HostingPublicationFilter;
  rateFilter: RateFilterKey;
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
}

export interface ActivitiesPageResult {
  rows: ActivityListRow[];
  total: number;
  nextCursor?: string | null;
}
