import type { LocationCoordinates } from '../interfaces/location.interface';
import type { PopupHeaderLookup } from './popup.model';
import type { ChatRecord } from '../models/chat.model';
import type { AssetCard, AssetType } from './asset.model';
import type { ActivityMemberEntry } from './activity-member.model';
import type { ActivitiesChatContextFilter, ChatChannelType, SupportCaseFilter } from './chat.model';
import type { ActivitiesEventScope, ActivitiesPrimaryFilter, ActivitiesSecondaryFilter, ActivitiesView, ActivityListRow, HostingPublicationFilter, RateFilterKey } from './activities-ui.model';
import type {
  EventCheckoutAssetSelection,
  EventBlindMode,
  EventCheckoutSession,
  EventPolicyItem,
  EventEditorTarget,
  EventRecordKind,
  EventSlotOccurrence,
  EventSlotTemplate,
  EventVisibility,
  SubEventFormItem
} from './event.model';
import type { PricingConfig } from './pricing.model';

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
  rateSocialBadgeEnabled?: boolean;
  adminServiceOnly?: boolean;
  supportCaseFilter?: SupportCaseFilter;
}

export interface EventExploreFeedFilters {
  userId: string;
  order: import('./activities-ui.model').EventExploreOrder;
  view: import('./activities-ui.model').EventExploreView;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
  excludedSourceIds?: string[];
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
  | { type: 'assetExplore'; assetType?: AssetType; assetId?: string; viewOnly?: boolean; fallbackAsset?: AssetCard }
  | {
      type: 'chatResource';
      ownerId?: string;
      item: ChatRecord;
      resourceType: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
      subEvent: SubEventFormItem;
      group?: { id: string; groupLabel: string } | null;
      assetAssignmentIds?: SubEventAssetAssignmentIds;
      assetCardsByType?: SubEventAssetCardsByType;
      openExplore?: boolean;
      assetViewId?: string;
    }
  | {
      type: 'members';
      ownerId: string;
      ownerType?: ActivityMemberOwnerType;
      subtitle?: string;
      canManage?: boolean;
      viewOnly?: boolean;
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      members?: readonly ActivityMemberEntry[];
      lookup?: PopupHeaderLookup;
      onMembersChanged?: (members: readonly ActivityMemberEntry[]) => void;
    }
  | { type: 'eventEditorMembers'; row: ActivityListRow }
  | { type: 'eventEditorCreate'; target: EventEditorTarget }
  | { type: 'eventEditor'; row: ActivityListRow; readOnly: boolean };

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
  published?: boolean;
  creatorUserId?: string;
  creatorName?: string;
  creatorInitials?: string;
  creatorGender?: 'woman' | 'man';
  creatorCity?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  sourceLink?: string;
  policies?: EventPolicyItem[];
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: import('./event.model').SubEventsDisplayMode;
  paymentSessionId?: string | null;
}

export interface EventCheckoutRequest {
  userId: string;
  sourceId: string;
  slotSourceId?: string | null;
  optionalSubEventIds: string[];
  assetSelections: EventCheckoutAssetSelection[];
  acceptedPolicyIds: string[];
  lineItems: import('./event.model').EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  pendingReason?: 'approval' | 'waitlist' | null;
}

export type { EventCheckoutSession };

export interface EventChatSession {
  item: ChatRecord;
  openedAtIso: string;
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

export interface ActivitiesPageResult {
  rows: ActivityListRow[];
  total: number;
  nextCursor?: string | null;
}
