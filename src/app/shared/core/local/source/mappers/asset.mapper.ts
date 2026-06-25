import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../base/builders';
import { LocalActivityEventsMapper } from './event.mapper';
import type * as ActivityContracts from '../../../contracts/activity.interface';
import type * as AssetContracts from '../../../contracts/asset.interface';
import type { AssetRecord } from '../entity/asset.entity';

import type * as AppDTOs from '../../../base/dto';
import type * as AppConstants from '../../../common/constants';
export class LocalAssetsMapper {
  static cloneCards(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return cards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneRequest(request)),
      menuActions: [...(card.menuActions ?? [])]
    }));
  }

  static normalizeCards(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return cards
      .map(card => this.normalizeCard(card))
      .filter((card): card is AppDTOs.AssetCardDTO => Boolean(card));
  }

  static normalizeCard(card: AppDTOs.AssetCardDTO | null | undefined): AppDTOs.AssetCardDTO | null {
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
        ? card.menuActions.map(action => `${action ?? ''}`.trim()).filter(action => action.length > 0)
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
              ? request.menuActions.map(action => `${action ?? ''}`.trim()).filter(action => action.length > 0)
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
                    ? request.booking.acceptedPolicyIds.map(item => `${item ?? ''}`.trim()).filter(item => item.length > 0)
                    : []
                }
              : null
          }))
          .filter(request => request.id.length > 0)
        : []
    };
  }

  static normalizeAssetStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'active':
        return 'A';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      case 'trashed':
      case 'trash':
        return 'T';
      default:
        return normalized || 'A';
    }
  }

  static restoredAssetStatus(_card: AppDTOs.AssetCardDTO): string {
    return 'A';
  }

  static cloneRequest(request: AppDTOs.AssetMemberRequestDTO): AppDTOs.AssetMemberRequestDTO {
    return {
      ...request,
      menuActions: [...(request.menuActions ?? [])],
      booking: request.booking
        ? {
            ...request.booking,
            acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
          }
        : null
    };
  }

  static cloneRecord(record: AssetRecord): AssetRecord {
    return {
      ...record,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
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
