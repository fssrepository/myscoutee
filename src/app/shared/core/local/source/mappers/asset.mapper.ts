import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../base/builders';
import { AppUtils } from '../../../../app-utils';
import { LocalActivityEventsMapper } from './event.mapper';
import type * as ActivityContracts from '../../../contracts/activity.interface';
import type * as AssetContracts from '../../../contracts/asset.interface';
import type {
  AssetAvailabilityRowRecord,
  AssetAvailabilityStatRecord,
  AssetAvailabilityRecordPageResult,
  AssetAvailabilityStatRecordPageResult,
  AssetMemberRequestRecord,
  AssetRecord,
  AssetRequestRecord
} from '../entity/asset.entity';

import type * as AppDTOs from '../../../contracts';
import * as AppConstants from '../../../common/constants';

export interface LocalAssetProjectionOptions {
  viewerUserId?: string;
  requestMetrics?: AppDTOs.AssetRequestMetricsDTO | null;
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
    if (!AppConstants.isAssetType(type)) {
      return null;
    }
    const requests = this.normalizeRequests(card?.requests);
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
      requests,
      metrics: this.assetRequestMetrics(card?.metrics)
    };
  }

  static fallbackAssetDto(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): AppDTOs.AssetDTO {
    const requests = this.normalizeRequests(card.requests);
    return this.normalizeCard(card) ?? {
      id: `${card.id ?? ''}`.trim(),
      type: AppConstants.isAssetType(card.type) ? card.type : AppConstants.ASSET_TYPE_TRANSPORT,
      title: `${card.title ?? ''}`.trim(),
      subtitle: `${card.subtitle ?? ''}`.trim(),
      category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
      city: `${card.city ?? ''}`.trim(),
      capacityTotal: AssetCardBuilder.capacityValue({ capacityTotal: card.capacityTotal ?? 0 }),
      quantity: AssetCardBuilder.storedQuantityValue({
        type: AppConstants.isAssetType(card.type) ? card.type : AppConstants.ASSET_TYPE_TRANSPORT,
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
      requests,
      metrics: this.assetRequestMetrics(card.metrics),
      menuActions: Array.isArray(card.menuActions) ? [...card.menuActions] : undefined
    };
  }

  static normalizeDetail(card: AppDTOs.AssetDetailDTO | null | undefined): AppDTOs.AssetDetailDTO | null {
    const id = card?.id?.trim() ?? '';
    if (!id) {
      return null;
    }
    const type = card?.type;
    if (!AppConstants.isAssetType(type)) {
      return null;
    }
    const requests = this.normalizeRequests(card?.requests);
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
      requests,
      metrics: this.assetRequestMetrics(card?.metrics)
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
      locationLabel: record.type === AppConstants.ASSET_TYPE_ACCOMMODATION
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
      metrics: this.assetRequestMetrics(options.requestMetrics),
      menuActions: options.resolveMenuActions?.(record, viewerUserId) ?? [...(record.menuActions ?? [])]
    };
  }

  static toAssetDtos(records: readonly AssetRecord[], options: LocalAssetProjectionOptions = {}): AppDTOs.AssetDTO[] {
    return records.map(record => this.toAssetDto(record, options));
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
      metrics: this.assetRequestMetrics(options.requestMetrics),
      menuActions: options.resolveMenuActions?.(record, viewerUserId) ?? [...(record.menuActions ?? [])]
    };
  }

  static toAssetAvailabilityDtoPage(page: AssetAvailabilityRecordPageResult): AppDTOs.AssetOccupancyPageResultDTO {
    return {
      items: page.records.map(record => this.toAssetAvailabilityRowDto(record)),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  static toAssetAvailabilityStatDtoPage(page: AssetAvailabilityStatRecordPageResult): AppDTOs.AssetOccupancyStatsPageResultDTO {
    return {
      items: page.records.map(record => this.toAssetAvailabilityStatDto(record)),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  private static toAssetAvailabilityStatDto(record: AssetAvailabilityStatRecord): AppDTOs.AssetOccupancyStatDTO {
    const day = AppUtils.dateOnly(record.date);
    const nextDay = AppUtils.addDays(day, 1);
    const overlapping = record.requests
      .filter(request => this.assetRequestDateRangeOverlaps(request, day, nextDay));
    const occupied = overlapping
      .filter(request => this.isCommittedAssetRequest(request))
      .reduce((sum, request) => sum + this.assetRequestOccupancyCount(request), 0);
    const pending = overlapping
      .filter(request => this.isPendingAssetRequest(request));
    const pendingQuantity = pending.reduce((sum, request) => sum + this.assetRequestQuantity(request), 0);
    const dateIso = AppUtils.dateKey(day);
    return {
      id: `${record.assetId}:${dateIso}`,
      assetId: record.assetId,
      ownerUserId: record.ownerUserId,
      dateIso,
      startAtIso: AppUtils.toIsoDateTimeLocal(day),
      endAtIso: AppUtils.toIsoDateTimeLocal(nextDay),
      occupied,
      capacity: Math.max(0, Math.trunc(Number(record.assetCapacity) || 0)),
      pendingCount: pending.length,
      pendingQuantity,
      itemCount: overlapping.length
    };
  }

  private static toAssetAvailabilityRowDto(record: AssetAvailabilityRowRecord): AppDTOs.AssetOccupancyRowDTO {
    const request = record.request;
    const requestRange = this.assetRequestDateRange(request);
    const status = request.requestKind === 'manual' ? 'assigned' : request.status;
    const overlappingCommitted = record.requests
      .filter(other => this.isCommittedAssetRequest(other))
      .filter(other => {
        if (record.dateRange) {
          return this.assetRequestDateRangeOverlaps(other, record.dateRange.start, record.dateRange.end);
        }
        return this.assetRequestsOverlap(request, other);
      })
      .reduce((sum, other) => sum + this.assetRequestOccupancyCount(other), 0);
    const pendingCurrentQuantity = this.isCommittedAssetRequest(request) ? 0 : this.assetRequestQuantity(request);
    const capacity = Math.max(0, Math.trunc(Number(request.assetCapacity) || 0));
    const pendingForWindow = record.requests
      .filter(other => this.isPendingAssetRequest(other))
      .filter(other => {
        if (record.dateRange) {
          return this.assetRequestDateRangeOverlaps(other, record.dateRange.start, record.dateRange.end);
        }
        return this.assetRequestsOverlap(request, other);
      });
    return {
      id: request.id,
      assetId: request.assetId,
      ownerUserId: request.ownerUserId,
      dateIso: requestRange ? AppUtils.dateKey(requestRange.start) : '',
      startAtIso: request.booking?.startAtIso,
      endAtIso: request.booking?.endAtIso,
      title: request.name,
      subtitle: [
        `${request.booking?.eventTitle ?? ''}`.trim(),
        `${request.booking?.subEventTitle ?? ''}`.trim()
      ].filter(Boolean).join(' · ') || undefined,
      detail: this.visibleAssetRequestNote(request),
      scheduleLabel: this.assetRequestScheduleLabel(request),
      avatarInitials: request.initials,
      gender: request.gender,
      status,
      requestKind: request.requestKind ?? 'borrow',
      quantity: this.assetRequestQuantity(request),
      occupied: overlappingCommitted,
      capacity,
      remaining: capacity - overlappingCommitted - pendingCurrentQuantity,
      pendingCount: pendingForWindow.length,
      pendingQuantity: pendingForWindow.reduce((sum, other) => sum + this.assetRequestQuantity(other), 0),
      eventId: `${request.booking?.eventId ?? ''}`.trim() || undefined,
      eventTitle: `${request.booking?.eventTitle ?? ''}`.trim() || undefined,
      subEventId: `${request.booking?.subEventId ?? ''}`.trim() || undefined,
      subEventTitle: `${request.booking?.subEventTitle ?? ''}`.trim() || undefined,
      subEventStartAtIso: `${request.booking?.startAtIso ?? ''}`.trim() || undefined,
      subEventEndAtIso: `${request.booking?.endAtIso ?? ''}`.trim() || undefined,
      menuActions: this.assetRequestMenuActions(request)
    };
  }

  private static assetRequestsOverlap(left: AssetRequestRecord, right: AssetRequestRecord): boolean {
    if (left.id === right.id) {
      return true;
    }
    const leftRange = this.assetRequestDateRange(left);
    const rightRange = this.assetRequestDateRange(right);
    if (leftRange && rightRange) {
      return leftRange.start.getTime() < rightRange.end.getTime()
        && rightRange.start.getTime() < leftRange.end.getTime();
    }
    const leftWindow = this.assetRequestWindowKey(left);
    const rightWindow = this.assetRequestWindowKey(right);
    return Boolean(leftWindow && rightWindow && leftWindow === rightWindow);
  }

  private static assetRequestDateRangeOverlaps(request: AssetRequestRecord, start: Date, end: Date): boolean {
    const range = this.assetRequestDateRange(request);
    return range
      ? range.start.getTime() < end.getTime() && start.getTime() < range.end.getTime()
      : false;
  }

  private static assetRequestDateRange(
    request: Pick<AssetRequestRecord, 'requestedAtIso' | 'booking'>
  ): { start: Date; end: Date } | null {
    const start = this.parseAssetRequestDate(request.booking?.startAtIso ?? request.requestedAtIso);
    if (!start) {
      return null;
    }
    const parsedEnd = this.parseAssetRequestDate(request.booking?.endAtIso);
    const end = parsedEnd && parsedEnd.getTime() > start.getTime()
      ? parsedEnd
      : AppUtils.addDays(start, 1);
    return { start, end };
  }

  private static assetRequestWindowKey(request: AssetRequestRecord): string {
    return [
      `${request.booking?.eventId ?? ''}`.trim(),
      `${request.booking?.subEventId ?? ''}`.trim(),
      `${request.booking?.slotLabel ?? ''}`.trim(),
      `${request.booking?.timeframe ?? ''}`.trim()
    ].filter(Boolean).join('|');
  }

  private static parseAssetRequestDate(value: string | null | undefined): Date | null {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    return AppUtils.isoLocalDateTimeToDate(normalized) ?? AppUtils.parseDate(normalized);
  }

  private static isCommittedAssetRequest(request: AssetRequestRecord): boolean {
    return request.status === 'accepted' || request.requestKind === 'manual';
  }

  private static isPendingAssetRequest(request: AssetRequestRecord): boolean {
    return request.status === 'pending' && request.requestKind !== 'manual';
  }

  private static assetRequestQuantity(request: AssetRequestRecord): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 1));
  }

  private static assetRequestOccupancyCount(request: AssetRequestRecord): number {
    return request.requestKind === 'manual' ? 1 : this.assetRequestQuantity(request);
  }

  private static visibleAssetRequestNote(request: AssetRequestRecord): string | undefined {
    const note = `${request.note ?? ''}`.trim();
    if (!note || this.isSystemAssetRequestNote(note)) {
      return undefined;
    }
    return note;
  }

  private static isSystemAssetRequestNote(note: string): boolean {
    return note === 'Awaiting owner confirmation.'
      || note === 'Approved and synced with the plan.'
      || note === 'Reserved and assigned by the owner.'
      || note === 'Borrow request approved by the owner.'
      || note === 'Promoted to asset manager.';
  }

  private static assetRequestScheduleLabel(request: AssetRequestRecord): string | undefined {
    const start = this.parseAssetRequestDate(request.booking?.startAtIso);
    const end = this.parseAssetRequestDate(request.booking?.endAtIso);
    if (start && end) {
      return this.formatAssetRequestDateRange(start, end);
    }
    return `${request.booking?.timeframe ?? request.booking?.slotLabel ?? ''}`.trim() || undefined;
  }

  private static formatAssetRequestDateRange(start: Date, end: Date): string {
    const sameDay = AppUtils.dateKey(start) === AppUtils.dateKey(end);
    const startDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return sameDay
      ? `${startDate} ${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  private static assetRequestMenuActions(request: AssetRequestRecord): AppConstants.AssetRequestAction[] {
    if (this.isPendingAssetRequest(request)) {
      return (request.menuActions ?? []).includes('makeManager')
        ? ['accept', 'makeManager', 'remove']
        : ['accept', 'remove'];
    }
    if (request.requestKind === 'manual') {
      return request.booking?.eventId && request.booking?.subEventId ? ['manage'] : [];
    }
    return (request.menuActions ?? []).includes('makeManager') ? ['makeManager'] : [];
  }

  private static normalizedCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  }

  static toAssetRequestMetrics(
    requests: readonly (
      Pick<AppDTOs.AssetMemberRequestDTO, 'status' | 'requestKind' | 'requestedAtIso'>
      & { booking?: Pick<AppDTOs.AssetHireRequestBookingDTO, 'startAtIso' | 'endAtIso'> | null }
    )[] | null | undefined
  ): AppDTOs.AssetRequestMetricsDTO {
    const rows = (requests ?? []).filter(request => this.isLaterAssetRequestMetric(request));
    const assignedItems = rows.filter(request => request.requestKind === 'manual').length;
    const borrowedItems = rows.filter(request => request.status === 'accepted' && request.requestKind !== 'manual').length;
    const pendingItems = rows.filter(request => request.status === 'pending' && request.requestKind !== 'manual').length;
    const activeItems = assignedItems + borrowedItems;
    return {
      allItems: activeItems + pendingItems,
      activeItems,
      assignedItems,
      borrowedItems,
      pendingItems
    };
  }

  private static isLaterAssetRequestMetric(
    request: Pick<AppDTOs.AssetMemberRequestDTO, 'requestedAtIso'> & {
      booking?: Pick<AppDTOs.AssetHireRequestBookingDTO, 'startAtIso' | 'endAtIso'> | null;
    }
  ): boolean {
    const end = this.assetRequestDateRange(request)?.end
      ?? this.parseAssetRequestDate(request.requestedAtIso);
    return end !== null && end.getTime() >= Date.now();
  }

  static assetRequestMetrics(
    metrics: AppDTOs.AssetRequestMetricsDTO | null | undefined
  ): AppDTOs.AssetRequestMetricsDTO {
    if (metrics) {
      return {
        allItems: this.normalizedCount(metrics.allItems),
        activeItems: this.normalizedCount(metrics.activeItems),
        assignedItems: this.normalizedCount(metrics.assignedItems),
        borrowedItems: this.normalizedCount(metrics.borrowedItems),
        pendingItems: this.normalizedCount(metrics.pendingItems)
      };
    }
    return this.emptyAssetRequestMetrics();
  }

  static emptyAssetRequestMetrics(): AppDTOs.AssetRequestMetricsDTO {
    return {
      allItems: 0,
      activeItems: 0,
      assignedItems: 0,
      borrowedItems: 0,
      pendingItems: 0
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
    if (type !== AppConstants.ASSET_TYPE_ACCOMMODATION || !('routes' in card)) {
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
