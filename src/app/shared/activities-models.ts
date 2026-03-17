import type * as AppTypes from './app-types';
import type { ChatMenuItem } from './demo-data';

export type SubEventAssetAssignmentIds = Partial<Record<AppTypes.AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>;
export type ActivityMemberOwnerType = 'event' | 'subEvent' | 'group';

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
      item: ChatMenuItem;
      resourceType: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
      subEvent: AppTypes.SubEventFormItem;
      group?: { id: string; groupLabel: string } | null;
      assetAssignmentIds?: SubEventAssetAssignmentIds;
      assetCardsByType?: SubEventAssetCardsByType;
    }
  | { type: 'members'; ownerId: string }
  | { type: 'eventEditorMembers'; row: AppTypes.ActivityListRow }
  | { type: 'eventEditorCreate'; target: AppTypes.EventEditorTarget }
  | { type: 'eventEditor'; row: AppTypes.ActivityListRow; readOnly: boolean };

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
  channelType: AppTypes.ChatChannelType;
  hasSubEventMenu: boolean;
  actionIcon: string;
  actionLabel: string;
  actionToneClass: EventChatContextTone;
  actionBadgeCount: number;
  menuTitle: string;
  eventRow: AppTypes.ActivityListRow | null;
  subEventRow: AppTypes.ActivityListRow | null;
  subEvent: AppTypes.SubEventFormItem | null;
  group: { id: string; label: string } | null;
  assetAssignmentIds: SubEventAssetAssignmentIds;
  assetCardsByType: SubEventAssetCardsByType;
  resources: EventChatResourceContext[];
}

export interface ActivitiesEventSyncPayload {
  id: string;
  target: AppTypes.EventEditorTarget;
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
  visibility?: AppTypes.EventVisibility;
  blindMode?: AppTypes.EventBlindMode;
  published?: boolean;
  creatorUserId?: string;
  creatorName?: string;
  creatorInitials?: string;
  creatorGender?: 'woman' | 'man';
  creatorCity?: string;
  location?: string;
  sourceLink?: string;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  topics?: string[];
  syncKey: string;
}

export interface EventChatSession {
  item: ChatMenuItem;
  openedAtIso: string;
  context: EventChatContext | null;
}

export interface ActivitiesPageRequest {
  primaryFilter: AppTypes.ActivitiesPrimaryFilter;
  eventScopeFilter?: AppTypes.ActivitiesEventScope;
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  chatContextFilter: AppTypes.ActivitiesChatContextFilter;
  hostingPublicationFilter: AppTypes.HostingPublicationFilter;
  rateFilter: AppTypes.RateFilterKey;
  view: AppTypes.ActivitiesView;
  page: number;
  pageSize: number;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface ActivitiesPageResult {
  rows: AppTypes.ActivityListRow[];
  total: number;
}
