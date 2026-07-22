import * as AppConstants from '../common/constants';
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

export interface AssetRequestMetricsDTO {
  allItems: number;
  activeItems: number;
  assignedItems: number;
  borrowedItems: number;
  pendingItems: number;
}

export interface AssetDTO {
  id: string;
  type: AppConstants.AssetType;
  title: string;
  subtitle: string;
  category?: AppConstants.AssetCategory;
  city: string;
  capacityTotal: number;
  quantity: number;
  description: string;
  imageUrl: string;
  sourceLink?: string;
  locationLabel?: string;
  priceLabel?: string;
  policiesEnabled?: boolean;
  policyCount?: number;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[];
  metrics?: AssetRequestMetricsDTO | null;
  menuActions?: string[];
}

export interface AssetDetailDTO {
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
  policiesEnabled?: boolean;
  policies?: EventPolicyItemDTO[];
  pricing?: PricingConfig | null;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[];
  metrics?: AssetRequestMetricsDTO | null;
  menuActions?: string[];
}

export class AssetDto implements AssetDTO {
  id = '';
  type: AppConstants.AssetType = AppConstants.ASSET_TYPE_TRANSPORT;
  title = '';
  subtitle = '';
  category?: AppConstants.AssetCategory;
  city = '';
  capacityTotal = 0;
  quantity = 0;
  description = '';
  imageUrl = '';
  sourceLink = '';
  locationLabel?: string;
  priceLabel?: string;
  policiesEnabled?: boolean;
  policyCount?: number;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[] = [];
  metrics?: AssetRequestMetricsDTO | null;
  menuActions?: string[];

  constructor(card?: AssetDTO | AssetDetailDTO | null) {
    if (!card) {
      return;
    }
    const detailCard = 'details' in card ? card : null;
    const policiesEnabled = AssetDto.assetPoliciesEnabled(card);
    Object.assign(this, {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: card.quantity,
      description: 'description' in card ? card.description : card.details,
      imageUrl: card.imageUrl,
      sourceLink: ('sourceLink' in card ? card.sourceLink : detailCard?.sourceLink)?.trim() ?? '',
      locationLabel: 'locationLabel' in card ? card.locationLabel : detailCard ? AssetDto.locationLabelFromDetail(detailCard) : card.city,
      priceLabel: 'priceLabel' in card ? card.priceLabel : undefined,
      policiesEnabled,
      policyCount: policiesEnabled
        ? ('policyCount' in card ? card.policyCount : (detailCard?.policies ?? []).length)
        : 0,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      metrics: AssetDto.cloneMetrics(card.metrics),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    });
  }

  equals(other: AssetDTO | null | undefined): boolean {
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
      && this.description === other.description
      && this.imageUrl === other.imageUrl
      && this.sourceLink === (other.sourceLink ?? '')
      && (this.locationLabel ?? '') === (other.locationLabel ?? '')
      && (this.priceLabel ?? '') === (other.priceLabel ?? '')
      && (this.policiesEnabled ?? false) === (other.policiesEnabled ?? false)
      && (this.policyCount ?? 0) === (other.policyCount ?? 0)
      && (this.visibility ?? '') === (other.visibility ?? '')
      && (this.status ?? '') === (other.status ?? '')
      && (this.ownerUserId ?? '') === (other.ownerUserId ?? '')
      && (this.ownerName ?? '') === (other.ownerName ?? '')
      && AssetDto.sameRequests(this.requests, other.requests)
      && AssetDto.sameMetrics(this.metrics, other.metrics)
      && AssetDto.sameStringList(this.menuActions, other.menuActions);
  }

  static equals(left: AssetDTO | null | undefined, right: AssetDTO | null | undefined): boolean {
    if (!left || !right) {
      return left === right;
    }
    return new AssetDto(left).equals(right);
  }

  static listEquals(left: readonly AssetDTO[], right: readonly AssetDTO[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((card, index) => AssetDto.equals(card, right[index]));
  }

  static clone(card: AssetDTO | AssetDetailDTO): AssetDTO {
    return new AssetDto(card);
  }

  static cloneList(cards: readonly (AssetDTO | AssetDetailDTO)[]): AssetDTO[] {
    return cards.map(card => this.clone(card));
  }

  private static locationLabelFromDetail(card: AssetDetailDTO): string {
    if (card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return card.city;
    }
    return (card.routes ?? [])
      .map(route => route.trim())
      .find(route => route.length > 0)
      ?? card.city;
  }

  private static assetPoliciesEnabled(card: AssetDTO | AssetDetailDTO): boolean {
    if ('policiesEnabled' in card && card.policiesEnabled !== undefined) {
      return card.policiesEnabled === true;
    }
    if ('policyCount' in card && Number.isFinite(Number(card.policyCount)) && Number(card.policyCount) > 0) {
      return true;
    }
    return 'policies' in card && (card.policies ?? []).length > 0;
  }

  private static sameStringList(left: readonly string[] | null | undefined, right: readonly string[] | null | undefined): boolean {
    const leftItems = left ?? [];
    const rightItems = right ?? [];
    return leftItems.length === rightItems.length
      && leftItems.every((item, index) => item === rightItems[index]);
  }

  static cloneMetrics(metrics: AssetRequestMetricsDTO | null | undefined): AssetRequestMetricsDTO | null {
    return metrics
      ? {
          allItems: AssetDto.normalizeCount(metrics.allItems),
          activeItems: AssetDto.normalizeCount(metrics.activeItems),
          assignedItems: AssetDto.normalizeCount(metrics.assignedItems),
          borrowedItems: AssetDto.normalizeCount(metrics.borrowedItems),
          pendingItems: AssetDto.normalizeCount(metrics.pendingItems)
        }
      : null;
  }

  private static sameMetrics(
    left: AssetRequestMetricsDTO | null | undefined,
    right: AssetRequestMetricsDTO | null | undefined
  ): boolean {
    const leftMetrics = AssetDto.cloneMetrics(left);
    const rightMetrics = AssetDto.cloneMetrics(right);
    return (leftMetrics?.allItems ?? 0) === (rightMetrics?.allItems ?? 0)
      && (leftMetrics?.activeItems ?? 0) === (rightMetrics?.activeItems ?? 0)
      && (leftMetrics?.assignedItems ?? 0) === (rightMetrics?.assignedItems ?? 0)
      && (leftMetrics?.borrowedItems ?? 0) === (rightMetrics?.borrowedItems ?? 0)
      && (leftMetrics?.pendingItems ?? 0) === (rightMetrics?.pendingItems ?? 0);
  }

  private static normalizeCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
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
        return other !== undefined && AssetDto.sameRequest(item, other);
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

export class AssetDetailDto implements AssetDetailDTO {
  id = '';
  type: AppConstants.AssetType = AppConstants.ASSET_TYPE_TRANSPORT;
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
  policiesEnabled?: boolean;
  policies?: EventPolicyItemDTO[];
  pricing?: PricingConfig | null;
  visibility?: AppConstants.EventVisibility;
  status?: AppConstants.AssetLifecycleStatus | string;
  ownerUserId?: string;
  ownerName?: string;
  requests: AssetMemberRequestDTO[] = [];
  metrics?: AssetRequestMetricsDTO | null;
  menuActions?: string[];

  constructor(card?: AssetDetailDTO | null) {
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
      metrics: AssetDto.cloneMetrics(card.metrics),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    });
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

export type AssetExploreOrder = 'availability' | 'lowest-price' | 'fewest-policies';

export interface AssetExplorePageQueryDTO extends AssetExploreQueryDTO {
  page?: number;
  pageSize: number;
  cursor?: string | null;
  order?: AssetExploreOrder;
}

export interface AssetExplorePageResultDTO {
  items: AssetDTO[];
  total: number;
  nextCursor?: string | null;
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

export type AssetAvailabilityFilter = 'all' | 'active-items' | 'pending-requests' | 'borrowed-items';
export type AssetAvailabilityView = 'day' | 'week' | 'month';
export type AssetAvailabilityOrder = 'earlier' | 'later';

export interface AssetOccupancyStatDTO {
  id: string;
  assetId: string;
  ownerUserId: string;
  dateIso: string;
  startAtIso: string;
  endAtIso: string;
  occupied: number;
  capacity: number;
  pendingCount: number;
  pendingQuantity: number;
  itemCount: number;
}

export interface AssetOccupancyRowDTO {
  id: string;
  assetId: string;
  ownerUserId: string;
  userId?: string;
  isManager?: boolean;
  dateIso: string;
  startAtIso?: string;
  endAtIso?: string;
  title: string;
  subtitle?: string;
  detail?: string;
  scheduleLabel?: string;
  avatarInitials?: string;
  avatarUrl?: string;
  gender: AppConstants.UserGender;
  status: AppConstants.AssetRequestStatus | 'assigned';
  requestKind: AppConstants.AssetRequestKind;
  quantity: number;
  occupied: number;
  capacity: number;
  remaining: number;
  pendingCount: number;
  pendingQuantity: number;
  eventId?: string;
  eventTitle?: string;
  subEventId?: string;
  subEventTitle?: string;
  subEventStartAtIso?: string;
  subEventEndAtIso?: string;
  menuActions?: AppConstants.AssetRequestAction[];
}

export interface AssetOccupancyStatsPageResultDTO {
  items: AssetOccupancyStatDTO[];
  total: number;
  nextCursor?: string | null;
}

export interface AssetOccupancyPageResultDTO {
  items: AssetOccupancyRowDTO[];
  total: number;
  nextCursor?: string | null;
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
