import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../base/builders';
import { LocalActivityEventsMapper } from './event.mapper';
import type * as ActivityContracts from '../../../contracts/activity.interface';
import type * as AssetContracts from '../../../contracts/asset.interface';
import type { AssetMemberRequestRecord, AssetRecord } from '../entity/asset.entity';

import type * as AppDTOs from '../../../contracts';
import type * as AppConstants from '../../../common/constants';

export interface LocalAssetProjectionOptions {
  viewerUserId?: string;
  resolveMenuActions?: (record: AssetRecord, viewerUserId: string) => string[];
  resolveRequestMenuActions?: (
    record: AssetRecord,
    request: AppDTOs.AssetMemberRequestDTO,
    viewerUserId: string
  ) => string[];
}

export class LocalAssetsMapper {
  static cloneCards(cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[]): AppDTOs.AssetDTO[] {
    return AssetCardBuilder.cloneCards(cards);
  }

  static normalizeCards(cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[]): AppDTOs.AssetDTO[] {
    return cards
      .map(card => this.normalizeCard(card))
      .filter((card): card is AppDTOs.AssetDTO => Boolean(card));
  }

  static normalizeCard(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null | undefined): AppDTOs.AssetDTO | null {
    const id = card?.id?.trim() ?? '';
    if (!id) {
      return null;
    }
    const type = card?.type;
    if (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies') {
      return null;
    }
    return {
      id,
      type,
      title: card?.title?.trim() ?? '',
      subtitle: card?.subtitle?.trim() ?? '',
      category: AssetDefaultsBuilder.normalizeCategory(type, card?.category),
      city: card?.city?.trim() ?? '',
      capacityTotal: AssetCardBuilder.capacityValue({ capacityTotal: card?.capacityTotal ?? 0 }),
      quantity: AssetCardBuilder.storedQuantityValue({
        type,
        quantity: card?.quantity,
        capacityTotal: card?.capacityTotal ?? 0
      }),
      description: this.assetDescription(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO),
      imageUrl: card?.imageUrl?.trim() ?? '',
      locationLabel: this.assetLocationLabel(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO, type),
      priceLabel: this.assetPriceLabel(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO),
      policyCount: this.assetPolicyCount(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO),
      visibility: card?.visibility === 'Friends only'
        ? 'Friends only'
        : card?.visibility === 'Invitation only'
          ? 'Invitation only'
          : 'Public',
      status: this.normalizeAssetStatus(card?.status),
      ownerUserId: `${card?.ownerUserId ?? ''}`.trim() || undefined,
      ownerName: `${card?.ownerName ?? ''}`.trim() || undefined,
      menuActions: Array.isArray(card?.menuActions)
        ? card.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
        : [],
      requests: Array.isArray(card?.requests)
        ? card.requests
          .map(request => ({
            id: `${request?.id ?? ''}`.trim(),
            userId: `${request?.userId ?? ''}`.trim() || undefined,
            name: `${request?.name ?? ''}`.trim(),
            initials: `${request?.initials ?? ''}`.trim(),
            gender: (request?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
            status: (request?.status === 'accepted' ? 'accepted' : 'pending') as AppConstants.AssetRequestStatus,
            note: `${request?.note ?? ''}`.trim(),
            requestKind: (request?.requestKind === 'manual' ? 'manual' : 'borrow') as AppConstants.AssetRequestKind,
            requestedAtIso: `${request?.requestedAtIso ?? ''}`.trim() || undefined,
            menuActions: Array.isArray(request?.menuActions)
              ? request.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
              : [],
            booking: request?.booking
              ? {
                  eventId: `${request.booking.eventId ?? ''}`.trim() || undefined,
                  eventTitle: `${request.booking.eventTitle ?? ''}`.trim() || undefined,
                  subEventId: `${request.booking.subEventId ?? ''}`.trim() || undefined,
                  subEventTitle: `${request.booking.subEventTitle ?? ''}`.trim() || undefined,
                  slotKey: `${request.booking.slotKey ?? ''}`.trim() || undefined,
                  slotLabel: `${request.booking.slotLabel ?? ''}`.trim() || undefined,
                  timeframe: `${request.booking.timeframe ?? ''}`.trim() || undefined,
                  startAtIso: `${request.booking.startAtIso ?? ''}`.trim() || undefined,
                  endAtIso: `${request.booking.endAtIso ?? ''}`.trim() || undefined,
                  quantity: Number.isFinite(Number(request.booking.quantity))
                    ? Math.max(1, Math.trunc(Number(request.booking.quantity)))
                    : null,
                  totalAmount: Number.isFinite(Number(request.booking.totalAmount))
                    ? Math.max(0, Number(request.booking.totalAmount))
                    : null,
                  currency: `${request.booking.currency ?? ''}`.trim() || undefined,
                  paymentSessionId: `${request.booking.paymentSessionId ?? ''}`.trim() || null,
                  inventoryApplied: request.booking.inventoryApplied === true ? true : null,
                  acceptedPolicyIds: Array.isArray(request.booking.acceptedPolicyIds)
                    ? request.booking.acceptedPolicyIds.map((item: string) => `${item ?? ''}`.trim()).filter((item: string) => item.length > 0)
                    : []
                }
              : null
          }))
          .filter(request => request.id.length > 0)
        : []
    };
  }

  static fallbackAssetDto(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): AppDTOs.AssetDTO {
    return this.normalizeCard(card) ?? {
      id: `${card.id ?? ''}`.trim(),
      type: card.type === 'Accommodation' || card.type === 'Supplies' ? card.type : 'Car',
      title: `${card.title ?? ''}`.trim(),
      subtitle: `${card.subtitle ?? ''}`.trim(),
      category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
      city: `${card.city ?? ''}`.trim(),
      capacityTotal: AssetCardBuilder.capacityValue({ capacityTotal: card.capacityTotal ?? 0 }),
      quantity: AssetCardBuilder.storedQuantityValue({
        type: card.type === 'Accommodation' || card.type === 'Supplies' ? card.type : 'Car',
        quantity: card.quantity,
        capacityTotal: card.capacityTotal ?? 0
      }),
      description: this.assetDescription(card),
      imageUrl: `${card.imageUrl ?? ''}`.trim(),
      sourceLink: `${card.sourceLink ?? ''}`.trim(),
      visibility: card.visibility,
      status: this.normalizeAssetStatus(card.status),
      ownerUserId: `${card.ownerUserId ?? ''}`.trim() || undefined,
      ownerName: `${card.ownerName ?? ''}`.trim() || undefined,
      requests: this.normalizeRequests(card.requests),
      menuActions: Array.isArray(card.menuActions) ? [...card.menuActions] : undefined
    };
  }

  static normalizeDetail(card: AppDTOs.AssetDetailDTO | null | undefined): AppDTOs.AssetDetailDTO | null {
    const id = card?.id?.trim() ?? '';
    if (!id) {
      return null;
    }
    const type = card?.type;
    if (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies') {
      return null;
    }
    return {
      id,
      type,
      title: card?.title?.trim() ?? '',
      subtitle: card?.subtitle?.trim() ?? '',
      category: AssetDefaultsBuilder.normalizeCategory(type, card?.category),
      city: card?.city?.trim() ?? '',
      capacityTotal: AssetCardBuilder.capacityValue({ capacityTotal: card?.capacityTotal ?? 0 }),
      quantity: AssetCardBuilder.storedQuantityValue({
        type,
        quantity: card?.quantity,
        capacityTotal: card?.capacityTotal ?? 0
      }),
      details: card?.details?.trim() ?? '',
      imageUrl: card?.imageUrl?.trim() ?? '',
      sourceLink: card?.sourceLink?.trim() ?? '',
      routes: Array.isArray(card?.routes)
        ? card.routes.map(route => `${route ?? ''}`.trim()).filter(route => route.length > 0)
        : [],
      topics: Array.isArray(card?.topics)
        ? card.topics.map(topic => `${topic ?? ''}`.trim()).filter(topic => topic.length > 0)
        : [],
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
      policies: Array.isArray(card?.policies)
        ? card.policies
          .map(item => ({
            id: `${item?.id ?? ''}`.trim(),
            title: `${item?.title ?? ''}`.trim(),
            description: `${item?.description ?? ''}`.trim(),
            required: item?.required !== false
          }))
          .filter(item => item.id || item.title || item.description)
        : [],
      pricing: PricingBuilder.normalizePricingConfig(card?.pricing, { context: 'asset' }),
      visibility: card?.visibility === 'Friends only'
        ? 'Friends only'
        : card?.visibility === 'Invitation only'
          ? 'Invitation only'
          : 'Public',
      status: this.normalizeAssetStatus(card?.status),
      ownerUserId: `${card?.ownerUserId ?? ''}`.trim() || undefined,
      ownerName: `${card?.ownerName ?? ''}`.trim() || undefined,
      menuActions: Array.isArray(card?.menuActions)
        ? card.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
        : [],
      requests: this.normalizeRequests(card?.requests)
    };
  }

  static normalizeAssetStatus(status: string | null | undefined): string {
    return AssetCardBuilder.normalizeAssetStatus(status);
  }

  static restoredAssetStatus(card: Pick<AppDTOs.AssetDTO, 'status'>): string {
    return AssetCardBuilder.restoredAssetStatus(card as AppDTOs.AssetDTO);
  }

  static cloneRequest(request: AppDTOs.AssetMemberRequestDTO): AppDTOs.AssetMemberRequestDTO {
    return AssetCardBuilder.cloneRequest(request);
  }

  static toAssetDto(record: AssetRecord, options: LocalAssetProjectionOptions = {}): AppDTOs.AssetDTO {
    const viewerUserId = options.viewerUserId?.trim() ?? '';
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      subtitle: record.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(record.type, record.category),
      city: record.city,
      capacityTotal: record.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue({
        type: record.type,
        quantity: record.quantity,
        capacityTotal: record.capacityTotal
      }),
      description: record.details,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      locationLabel: record.type === 'Accommodation'
        ? ((record.routes ?? []).map(route => route.trim()).find(Boolean) ?? record.city)
        : record.city,
      priceLabel: this.assetPriceLabelFromRecord(record),
      policiesEnabled: record.policiesEnabled === true,
      policyCount: record.policiesEnabled === true ? (record.policies ?? []).length : 0,
      visibility: record.visibility,
      status: this.normalizeAssetStatus(record.status),
      ownerUserId: record.ownerUserId,
      ownerName: record.ownerName,
      requests: record.requests.map(request => {
        const dto = this.cloneRequest(request as AppDTOs.AssetMemberRequestDTO);
        return {
          ...dto,
          menuActions: options.resolveRequestMenuActions?.(record, dto, viewerUserId) ?? dto.menuActions ?? []
        };
      }),
      menuActions: options.resolveMenuActions?.(record, viewerUserId) ?? [...(record.menuActions ?? [])]
    };
  }

  static toAssetDetailDto(record: AssetRecord, options: LocalAssetProjectionOptions = {}): AppDTOs.AssetDetailDTO {
    const viewerUserId = options.viewerUserId?.trim() ?? '';
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      subtitle: record.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(record.type, record.category),
      city: record.city,
      capacityTotal: record.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue({
        type: record.type,
        quantity: record.quantity,
        capacityTotal: record.capacityTotal
      }),
      details: record.details,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policiesEnabled: record.policiesEnabled === true,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      visibility: record.visibility,
      status: this.normalizeAssetStatus(record.status),
      ownerUserId: record.ownerUserId,
      ownerName: record.ownerName,
      requests: record.requests.map(request => {
        const dto = this.cloneRequest(request as AppDTOs.AssetMemberRequestDTO);
        return {
          ...dto,
          menuActions: options.resolveRequestMenuActions?.(record, dto, viewerUserId) ?? dto.menuActions ?? []
        };
      }),
      menuActions: options.resolveMenuActions?.(record, viewerUserId) ?? [...(record.menuActions ?? [])]
    };
  }

  static toAssetRecord(
    asset: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO,
    ownerUserId: string
  ): AssetRecord | null {
    const summary = this.normalizeCard(asset);
    if (!summary) {
      return null;
    }
    const detail = 'details' in asset
      ? this.normalizeDetail(asset)
      : null;
    const now = new Date();
    const nowMs = now.getTime();
    return {
      id: summary.id,
      type: summary.type,
      title: summary.title,
      subtitle: summary.subtitle,
      category: summary.category,
      city: summary.city,
      capacityTotal: summary.capacityTotal,
      quantity: summary.quantity,
      details: detail?.details ?? summary.description,
      imageUrl: summary.imageUrl,
      sourceLink: detail?.sourceLink ?? summary.sourceLink ?? '',
      routes: detail?.routes ? [...detail.routes] : [],
      topics: detail?.topics ? [...detail.topics] : [],
      policiesEnabled: detail?.policiesEnabled === true,
      policies: detail?.policies ? detail.policies.map(item => ({ ...item })) : [],
      pricing: detail?.pricing ? PricingBuilder.clonePricingConfig(detail.pricing) : detail?.pricing,
      visibility: summary.visibility ?? 'Public',
      status: summary.status ?? 'A',
      statusBeforeSuppression: null,
      ownerUserId: ownerUserId.trim(),
      ownerName: summary.ownerName,
      requests: this.normalizeRequests(summary.requests) as AssetMemberRequestRecord[],
      menuActions: [...(summary.menuActions ?? [])],
      createdAtIso: now.toISOString(),
      updatedAtIso: now.toISOString(),
      createdMs: nowMs,
      updatedMs: nowMs
    };
  }

  static normalizeRequests(requests: readonly AppDTOs.AssetMemberRequestDTO[] | null | undefined): AppDTOs.AssetMemberRequestDTO[] {
    return Array.isArray(requests)
      ? requests
        .map(request => ({
          ...request,
          id: `${request?.id ?? ''}`.trim(),
          userId: `${request?.userId ?? ''}`.trim() || undefined,
          name: `${request?.name ?? ''}`.trim(),
          initials: `${request?.initials ?? ''}`.trim(),
          gender: (request?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
          status: (request?.status === 'accepted' ? 'accepted' : 'pending') as AppConstants.AssetRequestStatus,
          note: `${request?.note ?? ''}`.trim(),
          requestKind: (request?.requestKind === 'manual' ? 'manual' : 'borrow') as AppConstants.AssetRequestKind,
          requestedAtIso: `${request?.requestedAtIso ?? ''}`.trim() || undefined,
          menuActions: Array.isArray(request?.menuActions)
            ? request.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
            : [],
          booking: request?.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }))
        .filter(request => request.id.length > 0)
      : [];
  }

  private static assetDescription(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): string {
    return 'description' in card ? card.description.trim() : card.details.trim();
  }

  private static assetLocationLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO, type: AppConstants.AssetType): string {
    if ('locationLabel' in card && card.locationLabel?.trim()) {
      return card.locationLabel.trim();
    }
    if (type !== 'Accommodation' || !('routes' in card)) {
      return card.city?.trim() ?? '';
    }
    return (card.routes ?? [])
      .map(route => `${route ?? ''}`.trim())
      .find(route => route.length > 0)
      ?? card.city.trim();
  }

  private static assetPriceLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): string | undefined {
    if ('priceLabel' in card && card.priceLabel?.trim()) {
      return card.priceLabel.trim();
    }
    if (!('pricing' in card) || !card.pricing?.enabled) {
      return undefined;
    }
    const amount = Math.max(0, Number(card.pricing.basePrice) || 0);
    if (amount <= 0) {
      return 'Free borrow';
    }
    const currency = card.pricing.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  private static assetPolicyCount(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): number {
    if (!AssetCardBuilder.assetPoliciesEnabled(card)) {
      return 0;
    }
    if ('policyCount' in card && Number.isFinite(Number(card.policyCount))) {
      return Math.max(0, Math.trunc(Number(card.policyCount)));
    }
    return 'policies' in card ? (card.policies ?? []).length : 0;
  }

  private static assetPriceLabelFromRecord(record: AssetRecord): string | undefined {
    if (!record.pricing?.enabled) {
      return undefined;
    }
    const amount = Math.max(0, Number(record.pricing.basePrice) || 0);
    if (amount <= 0) {
      return 'Free borrow';
    }
    const currency = record.pricing.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  static cloneRecord(record: AssetRecord): AssetRecord {
    return {
      ...record,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policiesEnabled: record.policiesEnabled === true,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      requests: record.requests.map(request => this.cloneRequest(request)),
      menuActions: [...(record.menuActions ?? [])]
    };
  }
}

export class LocalAssetTicketsMapper {
  static toTicketDTOs(records: readonly ActivityContracts.ActivityEventRecord[]): AssetContracts.AssetTicketDTO[] {
    return this.cloneDTOs(records
      .filter(record => record.type !== 'invitations')
      .filter(record => record.status !== 'T')
      .filter(record => record.ticketing === true)
      .map(record => this.toTicketDTO(LocalActivityEventsMapper.toDto(record))));
  }

  static pageRows(
    rows: readonly AssetContracts.AssetTicketDTO[],
    query: AssetContracts.AssetTicketPageQueryDTO
  ): AssetContracts.AssetTicketPageResultDTO {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const orderedRows = [...rows].sort((left, right) => this.toSortableDate(left.dateIso) - this.toSortableDate(right.dateIso));
    const visibleRows = orderedRows.filter(row => this.matchesTicketOrder(row, query.order));
    if (query.order === 'past') {
      visibleRows.reverse();
    }
    const startIndex = page * pageSize;
    return {
      items: this.cloneDTOs(visibleRows.slice(startIndex, startIndex + pageSize)),
      total: visibleRows.length
    };
  }

  static cloneDTOs(rows: readonly AssetContracts.AssetTicketDTO[]): AssetContracts.AssetTicketDTO[] {
    return rows.map(row => ({ ...row }));
  }

  private static toTicketDTO(dto: ActivityContracts.ActivityEventDTO): AssetContracts.AssetTicketDTO {
    return {
      id: dto.id,
      type: dto.type === 'hosting' ? 'hosting' : 'events',
      status: dto.status,
      title: dto.title,
      subtitle: dto.subtitle,
      detail: dto.timeframe,
      dateIso: dto.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
      isAdmin: this.isTicketAdmin(dto),
      startAt: dto.startAtIso,
      endAt: dto.endAtIso,
      imageUrl: dto.imageUrl,
      visibility: dto.visibility,
      avatarInitials: dto.creatorInitials,
      creatorInitials: dto.creatorInitials
    };
  }

  private static isTicketAdmin(dto: ActivityContracts.ActivityEventDTO): boolean {
    const userId = `${dto.userId ?? ''}`.trim();
    return !!userId && (
      dto.creatorUserId === userId
      || (dto.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === userId)
    );
  }

  private static matchesTicketOrder(row: AssetContracts.AssetTicketDTO, order: AppConstants.AssetTicketOrder): boolean {
    const isPast = this.resolveTicketEndTimestamp(row) < Date.now();
    return order === 'past' ? isPast : !isPast;
  }

  private static resolveTicketEndTimestamp(row: AssetContracts.AssetTicketDTO): number {
    const endAtMs = this.toSortableDate(row.endAt ?? '');
    if (endAtMs > 0) {
      return endAtMs;
    }
    return this.toSortableDate(row.dateIso);
  }

  private static toSortableDate(dateIso: string): number {
    const parsed = new Date(dateIso);
    const value = parsed.getTime();
    return Number.isNaN(value) ? 0 : value;
  }
}
