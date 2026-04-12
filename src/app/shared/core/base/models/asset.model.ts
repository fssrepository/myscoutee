import type { ActivityMemberRole } from './activity-member.model';
import type { ActivityListRow } from './activities-ui.model';
import type { EventPolicyItem, EventVisibility } from './event.model';
import type { PricingConfig } from './pricing.model';

export type AssetType = 'Car' | 'Accommodation' | 'Supplies';
export type AssetFilterType = AssetType | 'Ticket';
export type SubEventResourceFilter = 'Members' | AssetType;
export type AssetRequestAction = 'accept' | 'remove';
export type AssetRequestStatus = 'pending' | 'accepted';
export type AssetTicketOrder = 'upcoming' | 'past';
export type AssetRequestKind = 'manual' | 'borrow';

export interface AssetHireRequestBooking {
  eventId?: string;
  eventTitle?: string;
  subEventId?: string;
  subEventTitle?: string;
  slotKey?: string;
  slotLabel?: string;
  timeframe?: string;
  startAtIso?: string;
  endAtIso?: string;
  quantity?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  acceptedPolicyIds?: string[];
}

export interface AssetMemberRequest {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  status: AssetRequestStatus;
  note: string;
  requestKind?: AssetRequestKind;
  requestedAtIso?: string;
  booking?: AssetHireRequestBooking | null;
}

export interface AssetCard {
  id: string;
  type: AssetType;
  title: string;
  subtitle: string;
  city: string;
  capacityTotal: number;
  quantity: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  topics?: string[];
  policies?: EventPolicyItem[];
  pricing?: PricingConfig | null;
  visibility?: EventVisibility;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequest[];
}

export interface AssetSourcePreview {
  enabled: boolean;
  supported: boolean;
  normalizedUrl: string;
  title: string;
  subtitle: string;
  details: string;
  imageUrl: string;
}

export interface SubEventResourceCard {
  id: string;
  type: SubEventResourceFilter;
  sourceAssetId: string | null;
  title: string;
  subtitle: string;
  city: string;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes: string[];
  capacityTotal: number;
  accepted: number;
  pending: number;
  isMembers: boolean;
}

export interface SubEventAssignedAssetSettings {
  capacityMin: number;
  capacityMax: number;
  addedByUserId: string;
  routes: string[];
}

export interface SubEventAssetMembersContext {
  subEventId: string;
  assetId: string;
  type: 'Car' | 'Accommodation';
  ownerUserId: string | null;
}

export interface SubEventSupplyContributionEntry {
  id: string;
  userId: string;
  quantity: number;
  addedAtIso: string;
}

export interface SubEventSupplyContributionRow {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  age: number;
  city: string;
  addedAtIso: string;
  quantity: number;
}

export interface TicketScanPayload {
  code: string;
  holderUserId: string;
  holderName: string;
  holderAge: number;
  holderCity: string;
  holderRole: ActivityMemberRole;
  eventId: string;
  eventTitle: string;
  eventSubtitle: string;
  eventTimeframe: string;
  eventDateLabel: string;
  issuedAtIso: string;
}

export interface AssetTicketPageQuery {
  userId: string;
  page: number;
  pageSize: number;
  order: AssetTicketOrder;
}

export interface AssetTicketPageResult {
  items: ActivityListRow[];
  total: number;
}
