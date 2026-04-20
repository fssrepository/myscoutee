import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../core/base/builders';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetsRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedAssetsByUserId: Record<string, AppTypes.AssetCard[]> = {};
  private readonly inflightAssetsByUserId: Record<string, Promise<AppTypes.AssetCard[]>> = {};

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneCards(this.cachedAssetsByUserId[normalizedUserId] ?? []);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const inflightRequest = this.inflightAssetsByUserId[normalizedUserId];
    if (inflightRequest) {
      return inflightRequest;
    }
    const request = this.queryAndCacheOwnedAssetsByUser(normalizedUserId);
    this.inflightAssetsByUserId[normalizedUserId] = request;
    try {
      return await request;
    } catch {
      return this.peekOwnedAssetsByUser(normalizedUserId);
    } finally {
      delete this.inflightAssetsByUserId[normalizedUserId];
    }
  }

  private async queryAndCacheOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    const response = await this.http
      .get<AppTypes.AssetCard[] | null>(`${this.apiBaseUrl}/assets`, {
        params: new HttpParams().set('userId', userId)
      })
      .toPromise();
    const cards = this.normalizeCards(Array.isArray(response) ? response : []);
    this.cachedAssetsByUserId[userId] = cards;
    return this.cloneCards(cards);
  }

  async queryVisibleAssets(query: AppTypes.AssetExploreQuery): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<AppTypes.AssetCard[] | null>(`${this.apiBaseUrl}/assets/explore`, {
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

  async saveOwnedAsset(
    userId: string,
    asset: AppTypes.AssetCard
  ): Promise<AppTypes.AssetCard> {
    const normalizedUserId = userId.trim();
    const normalizedAsset = this.normalizeCard(asset);
    if (!normalizedUserId || !normalizedAsset) {
      return asset;
    }
    const cached = this.peekOwnedAssetsByUser(normalizedUserId);
    const next = this.upsertCard(cached, normalizedAsset);
    this.cachedAssetsByUserId[normalizedUserId] = next;
    try {
      await this.http
        .post(`${this.apiBaseUrl}/assets/upsert`, {
          userId: normalizedUserId,
          asset: normalizedAsset
        })
        .toPromise();
    } catch {
      // Keep optimistic state while concrete endpoint wiring lands.
    }
    return {
      ...normalizedAsset,
      routes: [...(normalizedAsset.routes ?? [])],
      topics: [...(normalizedAsset.topics ?? [])],
      policies: (normalizedAsset.policies ?? []).map(item => ({ ...item })),
      pricing: normalizedAsset.pricing ? PricingBuilder.clonePricingConfig(normalizedAsset.pricing) : undefined,
      requests: normalizedAsset.requests.map(request => this.cloneRequest(request))
    };
  }

  async replaceOwnedAssets(
    userId: string,
    assets: readonly AppTypes.AssetCard[]
  ): Promise<AppTypes.AssetCard[]> {
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
      // Keep optimistic state while concrete endpoint wiring lands.
    }
    return this.cloneCards(normalizedAssets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return;
    }
    const next = this.peekOwnedAssetsByUser(normalizedUserId).filter(card => card.id !== normalizedAssetId);
    this.cachedAssetsByUserId[normalizedUserId] = next;
    try {
      await this.http
        .post(`${this.apiBaseUrl}/assets/delete`, {
          userId: normalizedUserId,
          assetId: normalizedAssetId
        })
        .toPromise();
    } catch {
      // Keep optimistic state while concrete endpoint wiring lands.
    }
  }

  async refreshAssetSourcePreview(
    userId: string,
    type: AppTypes.AssetType,
    sourceLink: string
  ): Promise<AppTypes.AssetSourcePreview | null> {
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

  protected cloneCards(cards: readonly AppTypes.AssetCard[]): AppTypes.AssetCard[] {
    return cards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneRequest(request))
    }));
  }

  protected normalizeCards(cards: readonly AppTypes.AssetCard[]): AppTypes.AssetCard[] {
    return cards
      .map(card => this.normalizeCard(card))
      .filter((card): card is AppTypes.AssetCard => Boolean(card));
  }

  protected normalizeCard(card: AppTypes.AssetCard | null | undefined): AppTypes.AssetCard | null {
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
      ownerUserId: `${card?.ownerUserId ?? ''}`.trim() || undefined,
      ownerName: `${card?.ownerName ?? ''}`.trim() || undefined,
      requests: Array.isArray(card?.requests)
        ? card.requests
          .map(request => ({
            id: `${request?.id ?? ''}`.trim(),
            userId: `${request?.userId ?? ''}`.trim() || undefined,
            name: `${request?.name ?? ''}`.trim(),
            initials: `${request?.initials ?? ''}`.trim(),
            gender: (request?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
            status: (request?.status === 'accepted' ? 'accepted' : 'pending') as AppTypes.AssetRequestStatus,
            note: `${request?.note ?? ''}`.trim(),
            requestKind: (request?.requestKind === 'manual' ? 'manual' : 'borrow') as AppTypes.AssetRequestKind,
            requestedAtIso: `${request?.requestedAtIso ?? ''}`.trim() || undefined,
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

  private upsertCard(
    cards: readonly AppTypes.AssetCard[],
    nextCard: AppTypes.AssetCard
  ): AppTypes.AssetCard[] {
    const next = this.cloneCards(cards);
    const existingIndex = next.findIndex(card => card.id === nextCard.id);
    if (existingIndex >= 0) {
      next[existingIndex] = {
        ...nextCard,
        routes: [...(nextCard.routes ?? [])],
        topics: [...(nextCard.topics ?? [])],
        policies: (nextCard.policies ?? []).map(item => ({ ...item })),
        pricing: nextCard.pricing ? PricingBuilder.clonePricingConfig(nextCard.pricing) : undefined,
        requests: nextCard.requests.map(request => this.cloneRequest(request))
      };
      return next;
    }
    return [
      {
        ...nextCard,
        routes: [...(nextCard.routes ?? [])],
        topics: [...(nextCard.topics ?? [])],
        policies: (nextCard.policies ?? []).map(item => ({ ...item })),
        pricing: nextCard.pricing ? PricingBuilder.clonePricingConfig(nextCard.pricing) : undefined,
        requests: nextCard.requests.map(request => this.cloneRequest(request))
      },
      ...next
    ];
  }

  protected cloneRequest(request: AppTypes.AssetMemberRequest): AppTypes.AssetMemberRequest {
    return {
      ...request,
      booking: request.booking
        ? {
            ...request.booking,
            acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
          }
        : null
    };
  }
}
