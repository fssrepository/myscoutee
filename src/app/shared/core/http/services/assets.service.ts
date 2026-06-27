import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../base/builders';
import type * as AppDTOs from '../../contracts';
import type * as AppConstants from '../../common/constants';
@Injectable({
  providedIn: 'root'
})
export class HttpAssetsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedAssetsByUserId: Record<string, AppDTOs.AssetCardDTO[]> = {};
  private readonly inflightAssetsByUserId: Record<string, Promise<AppDTOs.AssetCardDTO[]>> = {};

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetCardDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneCards(this.cachedAssetsByUserId[normalizedUserId] ?? []);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetCardDTO | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.peekOwnedAssetsByUser(userId).find(card => card.id === normalizedAssetId) ?? null;
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetCardDTO[]> {
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

  async loadFullOwnedAssetById(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    const cards = await this.queryOwnedAssetsByUser(normalizedUserId);
    return cards.find(card => card.id === normalizedAssetId) ?? null;
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetCardDTO[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<AppDTOs.AssetCardDTO[] | null>(`${this.apiBaseUrl}/assets/explore`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
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

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetCardDTO): Promise<AppDTOs.AssetCardDTO> {
    const normalizedUserId = userId.trim();
    const normalizedAsset = this.normalizeCard(asset);
    if (!normalizedUserId || !normalizedAsset) {
      return asset;
    }
    this.cachedAssetsByUserId[normalizedUserId] = this.upsertCard(
      this.peekOwnedAssetsByUser(normalizedUserId),
      normalizedAsset
    );
    try {
      await this.http
        .post(`${this.apiBaseUrl}/assets/upsert`, {
          userId: normalizedUserId,
          asset: normalizedAsset
        })
        .toPromise();
    } catch {
      // Keep optimistic cache while concrete endpoint wiring lands.
    }
    return this.cloneCards([normalizedAsset])[0] ?? normalizedAsset;
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetCardDTO[]): Promise<AppDTOs.AssetCardDTO[]> {
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

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
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
        .post<AppDTOs.AssetCardDTO | null>(`${this.apiBaseUrl}/assets/take-over`, {
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

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetCardDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedUserId || !normalizedAssetId || !normalizedTargetUserId) {
      return null;
    }
    try {
      const response = await this.http
        .post<AppDTOs.AssetCardDTO | null>(`${this.apiBaseUrl}/assets/make-manager`, {
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

  async refreshAssetSourcePreview(
    userId: string,
    type: AppConstants.AssetType,
    sourceLink: string
  ): Promise<AppDTOs.AssetSourcePreviewDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedSourceLink = sourceLink.trim();
    if (!normalizedSourceLink) {
      return null;
    }
    try {
      type HttpAssetSourceRefreshResponse = {
        enabled?: boolean | null;
        supported?: boolean | null;
        normalizedUrl?: string | null;
        title?: string | null;
        subtitle?: string | null;
        details?: string | null;
        imageUrl?: string | null;
      };
      const response = await this.http
        .post<HttpAssetSourceRefreshResponse | null>(`${this.apiBaseUrl}/assets/refresh-from-source`, {
          userId: normalizedUserId,
          type,
          sourceLink: normalizedSourceLink
        })
        .toPromise();
      if (!response) {
        return null;
      }
      return {
        enabled: response.enabled !== false,
        supported: response.supported === true,
        normalizedUrl: typeof response.normalizedUrl === 'string' ? response.normalizedUrl.trim() : '',
        title: typeof response.title === 'string' ? response.title.trim() : '',
        subtitle: typeof response.subtitle === 'string' ? response.subtitle.trim() : '',
        details: typeof response.details === 'string' ? response.details.trim() : '',
        imageUrl: typeof response.imageUrl === 'string' ? response.imageUrl.trim() : ''
      };
    } catch {
      return null;
    }
  }

  private async fetchOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetCardDTO[]> {
    const response = await this.http
      .get<AppDTOs.AssetCardDTO[] | null>(`${this.apiBaseUrl}/assets`, {
        params: new HttpParams().set('userId', userId)
      })
      .toPromise();
    const cards = this.normalizeCards(Array.isArray(response) ? response : []);
    this.cachedAssetsByUserId[userId] = this.cloneCards(cards);
    return this.cloneCards(cards);
  }

  private upsertCard(
    cards: readonly AppDTOs.AssetCardDTO[],
    nextCard: AppDTOs.AssetCardDTO
  ): AppDTOs.AssetCardDTO[] {
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

  private cloneCards(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return AssetCardBuilder.cloneCards(cards);
  }

  private normalizeCards(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return cards
      .map(card => this.normalizeCard(card))
      .filter((card): card is AppDTOs.AssetCardDTO => Boolean(card));
  }

  private normalizeCard(card: AppDTOs.AssetCardDTO | null | undefined): AppDTOs.AssetCardDTO | null {
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

  private restoredAssetStatus(_card: AppDTOs.AssetCardDTO): string {
    return AssetCardBuilder.restoredAssetStatus(_card);
  }

  private normalizeAssetStatus(status: string | null | undefined): string {
    return AssetCardBuilder.normalizeAssetStatus(status);
  }

  private cloneRequest(request: AppDTOs.AssetMemberRequestDTO): AppDTOs.AssetMemberRequestDTO {
    return AssetCardBuilder.cloneRequest(request);
  }
}
