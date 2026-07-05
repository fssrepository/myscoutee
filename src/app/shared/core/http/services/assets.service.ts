import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../base/builders';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { AssetDto } from '../../contracts';
import type * as AppDTOs from '../../contracts';
import type * as AppConstants from '../../common/constants';
@Injectable({
  providedIn: 'root'
})
export class HttpAssetsService {
  private static readonly ASSET_AVAILABILITY_ROUTE = '/assets/availability';
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedAssetsByUserId: Record<string, AppDTOs.AssetDTO[]> = {};
  private readonly inflightAssetsByUserId: Record<string, Promise<AppDTOs.AssetDTO[]>> = {};

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneCards(this.cachedAssetsByUserId[normalizedUserId] ?? []);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetDTO | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.peekOwnedAssetsByUser(userId).find(card => card.id === normalizedAssetId) ?? null;
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const inflightRequest = this.inflightAssetsByUserId[normalizedUserId];
    if (inflightRequest) {
      return this.cloneCards(await inflightRequest);
    }
    const request = this.fetchOwnedAssetsByUser(normalizedUserId);
    this.inflightAssetsByUserId[normalizedUserId] = request;
    try {
      return this.cloneCards(await request);
    } catch {
      return this.peekOwnedAssetsByUser(normalizedUserId);
    } finally {
      delete this.inflightAssetsByUserId[normalizedUserId];
    }
  }

  async loadOwnedAssetDetailById(userId: string, assetId: string): Promise<AppDTOs.AssetDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    try {
      const response = await this.http
        .get<AppDTOs.AssetDetailDTO | null>(`${this.apiBaseUrl}/assets/${encodeURIComponent(normalizedAssetId)}`)
        .toPromise();
      const detail = this.normalizeDetail(response);
      if (detail) {
        const summary = this.normalizeCard(detail);
        if (summary) {
          this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(
            this.peekOwnedAssetsByUser(normalizedUserId),
            summary
          );
        }
        return detail;
      }
    } catch {
      // Fall back to the list cache while the detail endpoint is being wired.
    }
    return null;
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<AppDTOs.AssetDTO[] | null>(`${this.apiBaseUrl}/assets/explore`, {
          params: new HttpParams()
            .set('type', query.type)
            .set('category', `${query.category ?? ''}`.trim())
            .set('startAtIso', `${query.startAtIso ?? ''}`.trim())
            .set('endAtIso', `${query.endAtIso ?? ''}`.trim())
        })
        .toPromise();
      return this.normalizeCards(Array.isArray(response) ? response : []);
    } catch {
      return [];
    }
  }

  async queryVisibleAssetsPage(query: AppDTOs.AssetExplorePageQueryDTO): Promise<AppDTOs.AssetExplorePageResultDTO> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    try {
      const response = await this.http
        .get<AppDTOs.AssetDTO[] | AppDTOs.AssetExplorePageResultDTO | null>(`${this.apiBaseUrl}/assets/explore`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('type', query.type)
            .set('category', `${query.category ?? ''}`.trim())
            .set('startAtIso', `${query.startAtIso ?? ''}`.trim())
            .set('endAtIso', `${query.endAtIso ?? ''}`.trim())
            .set('page', `${page}`)
            .set('pageSize', `${pageSize}`)
            .set('order', `${query.order ?? 'availability'}`.trim())
            .set('cursor', `${query.cursor ?? ''}`.trim())
        })
        .toPromise();
      if (Array.isArray(response)) {
        const items = this.normalizeCards(response);
        return {
          items,
          total: items.length,
          nextCursor: null
        };
      }
      const items = this.normalizeCards(response?.items ?? []);
      return {
        items,
        total: Number.isFinite(response?.total)
          ? Math.max(0, Math.trunc(Number(response?.total)))
          : items.length,
        nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
          ? response.nextCursor
          : null
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  async loadOccupancyByAssetId(query: {
    userId: string;
    assetId: string;
    dateIso?: string | null;
    filter?: AppDTOs.AssetAvailabilityFilter | null;
    order?: AppDTOs.AssetAvailabilityOrder | null;
    page?: number;
    pageSize: number;
    cursor?: string | null;
  }, options: { signal?: AbortSignal } = {}): Promise<AppDTOs.AssetOccupancyPageResultDTO> {
    const normalizedUserId = query.userId.trim();
    const normalizedAssetId = query.assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpAssetsService.ASSET_AVAILABILITY_ROUTE,
        this.requestWithAbort(
          this.http.get<AppDTOs.AssetOccupancyPageResultDTO | null>(
            `${this.apiBaseUrl}/assets/${encodeURIComponent(normalizedAssetId)}/availability`,
            {
              params: new HttpParams()
                .set('userId', normalizedUserId)
                .set('dateIso', `${query.dateIso ?? ''}`.trim())
                .set('filter', `${query.filter ?? 'all'}`.trim())
                .set('order', `${query.order ?? 'later'}`.trim())
                .set('page', `${Math.max(0, Math.trunc(Number(query.page) || 0))}`)
                .set('pageSize', `${Math.max(1, Math.trunc(Number(query.pageSize) || 1))}`)
                .set('cursor', `${query.cursor ?? ''}`.trim())
            }
          ),
          options.signal
        ),
        'Asset availability request timed out.'
      );
      return this.normalizeOccupancyPage(response);
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  async loadStatByAssetId(query: {
    userId: string;
    assetId: string;
    rangeStart?: string | null;
    rangeEnd?: string | null;
    filter?: AppDTOs.AssetAvailabilityFilter | null;
    order?: AppDTOs.AssetAvailabilityOrder | null;
    page?: number;
    pageSize: number;
    cursor?: string | null;
  }, options: { signal?: AbortSignal } = {}): Promise<AppDTOs.AssetOccupancyStatsPageResultDTO> {
    const normalizedUserId = query.userId.trim();
    const normalizedAssetId = query.assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    try {
      const response = await this.routeDelay.withRequestTimeout(
        HttpAssetsService.ASSET_AVAILABILITY_ROUTE,
        this.requestWithAbort(
          this.http.get<AppDTOs.AssetOccupancyStatsPageResultDTO | null>(
            `${this.apiBaseUrl}/assets/${encodeURIComponent(normalizedAssetId)}/availability/stats`,
            {
              params: new HttpParams()
                .set('userId', normalizedUserId)
                .set('rangeStart', `${query.rangeStart ?? ''}`.trim())
                .set('rangeEnd', `${query.rangeEnd ?? ''}`.trim())
                .set('filter', `${query.filter ?? 'all'}`.trim())
                .set('order', `${query.order ?? 'later'}`.trim())
                .set('page', `${Math.max(0, Math.trunc(Number(query.page) || 0))}`)
                .set('pageSize', `${Math.max(1, Math.trunc(Number(query.pageSize) || 1))}`)
                .set('cursor', `${query.cursor ?? ''}`.trim())
            }
          ),
          options.signal
        ),
        'Asset availability stats request timed out.'
      );
      return this.normalizeOccupancyStatsPage(response);
    } catch {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetDetailDTO): Promise<AppDTOs.AssetDTO> {
    const normalizedUserId = userId.trim();
    const normalizedDetail = this.normalizeDetail(asset);
    const normalizedAsset = normalizedDetail ? this.normalizeCard(normalizedDetail) : null;
    if (!normalizedUserId || !normalizedDetail || !normalizedAsset) {
      return this.normalizeCard(asset) ?? new AssetDto(asset);
    }
    this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(
      this.peekOwnedAssetsByUser(normalizedUserId),
      normalizedAsset
    );
    try {
      const response = await this.http
        .post<AppDTOs.AssetDTO | null>(`${this.apiBaseUrl}/assets/upsert`, {
          userId: normalizedUserId,
          asset: normalizedDetail
        })
        .toPromise();
      const savedAsset = this.normalizeCard(response) ?? normalizedAsset;
      this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(
        this.peekOwnedAssetsByUser(normalizedUserId),
        savedAsset
      );
      return this.cloneCards([savedAsset])[0] ?? savedAsset;
    } catch {
      // Keep optimistic cache while concrete endpoint wiring lands.
    }
    return this.cloneCards([normalizedAsset])[0] ?? normalizedAsset;
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetDTO[]): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedAssets = this.normalizeCards(assets);
    this.cachedAssetsByUserId[normalizedUserId] = this.cloneCards(normalizedAssets);
    try {
      await this.http
        .post(`${this.apiBaseUrl}/assets/replace`, {
          userId: normalizedUserId,
          assets: normalizedAssets
        })
        .toPromise();
    } catch {
      // Keep optimistic cache while concrete endpoint wiring lands.
    }
    return this.cloneCards(normalizedAssets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return;
    }
    this.cachedAssetsByUserId[normalizedUserId] = this.peekOwnedAssetsByUser(normalizedUserId)
      .filter(card => card.id !== normalizedAssetId);
    try {
      await this.http
        .post(`${this.apiBaseUrl}/assets/delete`, {
          userId: normalizedUserId,
          assetId: normalizedAssetId
        })
        .toPromise();
    } catch {
      // Keep optimistic cache while concrete endpoint wiring lands.
    }
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    this.cachedAssetsByUserId[normalizedUserId] = this.peekOwnedAssetsByUser(normalizedUserId).map(card =>
      card.id === normalizedAssetId
        ? {
            ...card,
            status: this.restoredAssetStatus(card)
          }
        : card
    );
    try {
      const response = await this.http
        .post<AppDTOs.AssetDTO | null>(`${this.apiBaseUrl}/assets/take-over`, {
          userId: normalizedUserId,
          assetId: normalizedAssetId
        })
        .toPromise();
      const normalized = this.normalizeCard(response);
      if (normalized) {
        this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(this.peekOwnedAssetsByUser(normalizedUserId), normalized);
        return this.cloneCards([normalized])[0] ?? null;
      }
    } catch {
      // Keep optimistic cache while concrete endpoint wiring lands.
    }
    return this.peekOwnedAssetsByUser(normalizedUserId).find(card => card.id === normalizedAssetId) ?? null;
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedUserId || !normalizedAssetId || !normalizedTargetUserId) {
      return null;
    }
    try {
      const response = await this.http
        .post<AppDTOs.AssetDTO | null>(`${this.apiBaseUrl}/assets/make-manager`, {
          userId: normalizedUserId,
          assetId: normalizedAssetId,
          targetUserId: normalizedTargetUserId
        })
        .toPromise();
      const normalized = this.normalizeCard(response);
      if (!normalized) {
        return null;
      }
      this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(this.peekOwnedAssetsByUser(normalizedUserId), normalized);
      return this.cloneCards([normalized])[0] ?? null;
    } catch {
      return null;
    }
  }

  private async fetchOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetDTO[]> {
    const response = await this.http
      .get<AppDTOs.AssetDTO[] | null>(`${this.apiBaseUrl}/assets`)
      .toPromise();
    const cards = this.normalizeCards(Array.isArray(response) ? response : []);
    this.cachedAssetsByUserId[userId] = this.cloneCards(cards);
    return this.cloneCards(cards);
  }

  private upsertCard(
    cards: readonly AppDTOs.AssetDTO[],
    nextCard: AppDTOs.AssetDTO
  ): AppDTOs.AssetDTO[] {
    const next = this.cloneCards(cards);
    const existingIndex = next.findIndex(card => card.id === nextCard.id);
    if (existingIndex >= 0) {
      next[existingIndex] = this.cloneCards([nextCard])[0] ?? nextCard;
      return next;
    }
    return [
      this.cloneCards([nextCard])[0] ?? nextCard,
      ...next
    ];
  }

  private cloneCards(cards: readonly AppDTOs.AssetDTO[]): AppDTOs.AssetDTO[] {
    return AssetCardBuilder.cloneCards(cards);
  }

  private normalizeCards(cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[]): AppDTOs.AssetDTO[] {
    return cards
      .map(card => this.normalizeCard(card))
      .filter((card): card is AppDTOs.AssetDTO => Boolean(card));
  }

  private normalizeCard(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null | undefined): AppDTOs.AssetDTO | null {
    const id = card?.id?.trim() ?? '';
    if (!id) {
      return null;
    }
    const type = card?.type;
    if (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies') {
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
      sourceLink: card?.sourceLink?.trim() ?? '',
      locationLabel: this.assetLocationLabel(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO, type),
      priceLabel: this.assetPriceLabel(card as AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO),
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
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

  private normalizeDetail(card: AppDTOs.AssetDetailDTO | null | undefined): AppDTOs.AssetDetailDTO | null {
    const id = card?.id?.trim() ?? '';
    if (!id) {
      return null;
    }
    const type = card?.type;
    if (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies') {
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

  private normalizeRequests(requests: readonly AppDTOs.AssetMemberRequestDTO[] | null | undefined): AppDTOs.AssetMemberRequestDTO[] {
    return Array.isArray(requests)
      ? requests
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
      : [];
  }

  private assetRequestMetrics(
    metrics: AppDTOs.AssetRequestMetricsDTO | null | undefined
  ): AppDTOs.AssetRequestMetricsDTO {
    const normalized = AssetDto.cloneMetrics(metrics);
    if (normalized) {
      return normalized;
    }
    return {
      allItems: 0,
      activeItems: 0,
      assignedItems: 0,
      borrowedItems: 0,
      pendingItems: 0
    };
  }

  private assetDescription(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): string {
    return 'description' in card
      ? card.description.trim()
      : card.details.trim();
  }

  private assetLocationLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO, type: AppConstants.AssetType): string {
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

  private assetPriceLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): string | undefined {
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

  private assetPolicyCount(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): number {
    if (!AssetCardBuilder.assetPoliciesEnabled(card)) {
      return 0;
    }
    if ('policyCount' in card && Number.isFinite(Number(card.policyCount))) {
      return Math.max(0, Math.trunc(Number(card.policyCount)));
    }
    return 'policies' in card ? (card.policies ?? []).length : 0;
  }

  private normalizeOccupancyPage(
    response: AppDTOs.AssetOccupancyPageResultDTO | null | undefined
  ): AppDTOs.AssetOccupancyPageResultDTO {
    const items = Array.isArray(response?.items)
      ? response.items
        .map(row => this.normalizeOccupancyRow(row))
        .filter((row): row is AppDTOs.AssetOccupancyRowDTO => Boolean(row))
      : [];
    return {
      items,
      total: Number.isFinite(response?.total)
        ? Math.max(0, Math.trunc(Number(response?.total)))
        : items.length,
      nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor
        : null
    };
  }

  private normalizeOccupancyStatsPage(
    response: AppDTOs.AssetOccupancyStatsPageResultDTO | null | undefined
  ): AppDTOs.AssetOccupancyStatsPageResultDTO {
    const items = Array.isArray(response?.items)
      ? response.items
        .map(row => this.normalizeOccupancyStat(row))
        .filter((row): row is AppDTOs.AssetOccupancyStatDTO => Boolean(row))
      : [];
    return {
      items,
      total: Number.isFinite(response?.total)
        ? Math.max(0, Math.trunc(Number(response?.total)))
        : items.length,
      nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
        ? response.nextCursor
        : null
    };
  }

  private normalizeOccupancyStat(
    row: AppDTOs.AssetOccupancyStatDTO | null | undefined
  ): AppDTOs.AssetOccupancyStatDTO | null {
    const id = `${row?.id ?? ''}`.trim();
    const assetId = `${row?.assetId ?? ''}`.trim();
    const dateIso = `${row?.dateIso ?? ''}`.trim();
    if (!id || !assetId || !dateIso) {
      return null;
    }
    return {
      id,
      assetId,
      ownerUserId: `${row?.ownerUserId ?? ''}`.trim(),
      dateIso,
      startAtIso: `${row?.startAtIso ?? ''}`.trim(),
      endAtIso: `${row?.endAtIso ?? ''}`.trim(),
      occupied: Math.max(0, Math.trunc(Number(row?.occupied) || 0)),
      capacity: Math.max(0, Math.trunc(Number(row?.capacity) || 0)),
      pendingCount: Math.max(0, Math.trunc(Number(row?.pendingCount) || 0)),
      pendingQuantity: Math.max(0, Math.trunc(Number(row?.pendingQuantity) || 0)),
      itemCount: Math.max(0, Math.trunc(Number(row?.itemCount) || 0))
    };
  }

  private normalizeOccupancyRow(
    row: AppDTOs.AssetOccupancyRowDTO | null | undefined
  ): AppDTOs.AssetOccupancyRowDTO | null {
    const id = `${row?.id ?? ''}`.trim();
    const assetId = `${row?.assetId ?? ''}`.trim();
    if (!id || !assetId) {
      return null;
    }
    return {
      id,
      assetId,
      ownerUserId: `${row?.ownerUserId ?? ''}`.trim(),
      dateIso: `${row?.dateIso ?? ''}`.trim(),
      startAtIso: `${row?.startAtIso ?? ''}`.trim() || undefined,
      endAtIso: `${row?.endAtIso ?? ''}`.trim() || undefined,
      title: `${row?.title ?? ''}`.trim(),
      subtitle: `${row?.subtitle ?? ''}`.trim() || undefined,
      detail: `${row?.detail ?? ''}`.trim() || undefined,
      scheduleLabel: `${row?.scheduleLabel ?? ''}`.trim() || undefined,
      avatarInitials: `${row?.avatarInitials ?? ''}`.trim() || undefined,
      avatarUrl: `${row?.avatarUrl ?? ''}`.trim() || undefined,
      gender: row?.gender === 'woman' ? 'woman' : 'man',
      status: row?.status === 'assigned' ? 'assigned' : row?.status === 'accepted' ? 'accepted' : 'pending',
      requestKind: row?.requestKind === 'manual' ? 'manual' : 'borrow',
      quantity: Math.max(1, Math.trunc(Number(row?.quantity) || 1)),
      occupied: Math.max(0, Math.trunc(Number(row?.occupied) || 0)),
      capacity: Math.max(0, Math.trunc(Number(row?.capacity) || 0)),
      remaining: Math.trunc(Number(row?.remaining) || 0),
      pendingCount: Math.max(0, Math.trunc(Number(row?.pendingCount) || 0)),
      pendingQuantity: Math.max(0, Math.trunc(Number(row?.pendingQuantity) || 0)),
      eventId: `${row?.eventId ?? ''}`.trim() || undefined,
      eventTitle: `${row?.eventTitle ?? ''}`.trim() || undefined,
      subEventId: `${row?.subEventId ?? ''}`.trim() || undefined,
      subEventTitle: `${row?.subEventTitle ?? ''}`.trim() || undefined,
      subEventStartAtIso: `${row?.subEventStartAtIso ?? ''}`.trim() || undefined,
      subEventEndAtIso: `${row?.subEventEndAtIso ?? ''}`.trim() || undefined,
      menuActions: Array.isArray(row?.menuActions)
        ? row.menuActions.filter((action): action is AppConstants.AssetRequestAction =>
          action === 'accept' || action === 'remove' || action === 'makeManager' || action === 'manage')
        : []
    };
  }

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let settled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request$.subscribe({
        next: value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        },
        complete: () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(null as T);
        }
      });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private restoredAssetStatus(_card: AppDTOs.AssetDTO): string {
    return AssetCardBuilder.restoredAssetStatus(_card);
  }

  private normalizeAssetStatus(status: string | null | undefined): string {
    return AssetCardBuilder.normalizeAssetStatus(status);
  }

}
