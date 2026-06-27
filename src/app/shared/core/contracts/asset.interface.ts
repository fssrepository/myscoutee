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

export interface AssetDTO extends AssetCardDTO {}

export interface AssetDetailDTO extends AssetDTO {}

export class AssetCardDto implements AssetCardDTO {
  id = '';
  type: AppConstants.AssetType = 'Car';
  title = '';
  subtitle = '';
  category?: AppConstants.AssetCategory;
  city = '';
  capacityTotal = 0;
  quantity = 0;
  details = '';
  imageUrl = '';
  sourceLink = '';
  routes?: string[];
  topics?: string[];
  policies?: EventPolicyItemDTO[];
  pricing?: PricingConfig | null;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[] = [];
  menuActions?: string[];

  constructor(card?: AssetCardDTO | null) {
    if (!card) {
      return;
    }
    Object.assign(this, {
      ...card,
      routes: card.routes ? [...card.routes] : undefined,
      topics: card.topics ? [...card.topics] : undefined,
      policies: card.policies ? card.policies.map(item => ({ ...item })) : undefined,
      pricing: card.pricing ? { ...card.pricing } : card.pricing,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    });
  }

  equals(other: AssetCardDTO | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.id === other.id
      && this.type === other.type
      && this.title === other.title
      && this.subtitle === other.subtitle
      && (this.category ?? '') === (other.category ?? '')
      && this.city === other.city
      && this.capacityTotal === other.capacityTotal
      && this.quantity === other.quantity
      && this.details === other.details
      && this.imageUrl === other.imageUrl
      && this.sourceLink === other.sourceLink
      && (this.visibility ?? '') === (other.visibility ?? '')
      && (this.status ?? '') === (other.status ?? '')
      && (this.ownerUserId ?? '') === (other.ownerUserId ?? '')
      && (this.ownerName ?? '') === (other.ownerName ?? '')
      && AssetCardDto.sameStringList(this.routes, other.routes)
      && AssetCardDto.sameStringList(this.topics, other.topics)
      && AssetCardDto.samePolicies(this.policies, other.policies)
      && AssetCardDto.samePricing(this.pricing, other.pricing)
      && AssetCardDto.sameRequests(this.requests, other.requests)
      && AssetCardDto.sameStringList(this.menuActions, other.menuActions);
  }

  static equals(left: AssetCardDTO | null | undefined, right: AssetCardDTO | null | undefined): boolean {
    if (!left || !right) {
      return left === right;
    }
    return new AssetCardDto(left).equals(right);
  }

  static listEquals(left: readonly AssetCardDTO[], right: readonly AssetCardDTO[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((card, index) => AssetCardDto.equals(card, right[index]));
  }

  private static sameStringList(left: readonly string[] | null | undefined, right: readonly string[] | null | undefined): boolean {
    const leftItems = left ?? [];
    const rightItems = right ?? [];
    return leftItems.length === rightItems.length
      && leftItems.every((item, index) => item === rightItems[index]);
  }

  private static samePolicies(
    left: readonly EventPolicyItemDTO[] | null | undefined,
    right: readonly EventPolicyItemDTO[] | null | undefined
  ): boolean {
    const leftItems = left ?? [];
    const rightItems = right ?? [];
    return leftItems.length === rightItems.length
      && leftItems.every((item, index) => {
        const other = rightItems[index];
        if (!other) {
          return false;
        }
        return item.id === other.id
          && item.title === other.title
          && item.description === other.description
          && (item.required !== false) === (other.required !== false);
      });
  }

  private static samePricing(left: PricingConfig | null | undefined, right: PricingConfig | null | undefined): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  private static sameRequests(
    left: readonly AssetMemberRequestDTO[] | null | undefined,
    right: readonly AssetMemberRequestDTO[] | null | undefined
  ): boolean {
    const leftItems = left ?? [];
    const rightItems = right ?? [];
    return leftItems.length === rightItems.length
      && leftItems.every((item, index) => {
        const other = rightItems[index];
        return other !== undefined && AssetCardDto.sameRequest(item, other);
      });
  }

  private static sameRequest(left: AssetMemberRequestDTO, right: AssetMemberRequestDTO): boolean {
    return left.id === right.id
      && (left.userId ?? '') === (right.userId ?? '')
      && left.name === right.name
      && left.initials === right.initials
      && left.gender === right.gender
      && left.status === right.status
      && left.note === right.note
      && (left.requestKind ?? '') === (right.requestKind ?? '')
      && (left.requestedAtIso ?? '') === (right.requestedAtIso ?? '')
      && (left.booking?.eventId ?? '') === (right.booking?.eventId ?? '')
      && (left.booking?.subEventId ?? '') === (right.booking?.subEventId ?? '')
      && (left.booking?.slotKey ?? '') === (right.booking?.slotKey ?? '')
      && (left.booking?.quantity ?? '') === (right.booking?.quantity ?? '')
      && (left.booking?.totalAmount ?? '') === (right.booking?.totalAmount ?? '')
      && (left.booking?.timeframe ?? '') === (right.booking?.timeframe ?? '');
  }
}

export class AssetDto extends AssetCardDto implements AssetDTO {
  constructor(card?: AssetDTO | AssetCardDTO | null) {
    super(card);
  }
}

export class AssetDetailDto extends AssetCardDto implements AssetDetailDTO {
  constructor(card?: AssetDetailDTO | AssetCardDTO | null) {
    super(card);
  }

  toAssetDTO(): AssetDTO {
    return new AssetDto(this);
  }
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
