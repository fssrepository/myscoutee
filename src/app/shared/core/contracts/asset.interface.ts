import type * as AppConstants from '../common/constants';

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
