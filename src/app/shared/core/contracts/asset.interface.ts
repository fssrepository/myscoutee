import type * as AppConstants from '../common/constants';
import type { PricingConfig } from './pricing.interface';

export interface EventPolicyItemDTO {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export interface AssetHireRequestBookingDTO {
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
  paymentSessionId?: string | null;
  inventoryApplied?: boolean | null;
}

export interface AssetMemberRequestDTO {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: AppConstants.UserGender;
  status: AppConstants.AssetRequestStatus;
  note: string;
  requestKind?: AppConstants.AssetRequestKind;
  requestedAtIso?: string;
  booking?: AssetHireRequestBookingDTO | null;
  menuActions?: string[];
}

export interface AssetCardDTO {
  id: string;
  type: AppConstants.AssetType;
  title: string;
  subtitle: string;
  category?: AppConstants.AssetCategory;
  city: string;
  capacityTotal: number;
  quantity: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  topics?: string[];
  policies?: EventPolicyItemDTO[];
  pricing?: PricingConfig | null;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[];
  menuActions?: string[];
}

export interface AssetExploreQueryDTO {
  userId: string;
  type: AppConstants.AssetType;
  category?: AppConstants.AssetCategory;
  startAtIso?: string;
  endAtIso?: string;
}

export interface AssetSourcePreviewDTO {
  enabled: boolean;
  supported: boolean;
  normalizedUrl: string;
  title: string;
  subtitle: string;
  details: string;
  imageUrl: string;
}

export interface AssetTicketPageQueryDTO {
  userId: string;
  page: number;
  pageSize: number;
  order: AppConstants.AssetTicketOrder;
}

export interface AssetTicketDTO {
  id: string;
  type: 'events' | 'hosting' | 'invitations';
  status?: string | null;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceMetersExact?: number | null;
  isAdmin?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  imageUrl?: string | null;
  visibility?: AppConstants.EventVisibility | null;
  avatarInitials?: string | null;
  creatorInitials?: string | null;
}

export interface AssetTicketPageResultDTO {
  items: AssetTicketDTO[];
  total: number;
}

export interface TicketScanPayloadDTO {
  code: string;
  holderUserId: string;
  holderName: string;
  holderAge: number;
  holderCity: string;
  holderRole: AppConstants.ActivityMemberRole;
  eventId: string;
  eventTitle: string;
  eventSubtitle: string;
  eventTimeframe: string;
  eventDateLabel: string;
  issuedAtIso: string;
}
