import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { PricingBuilder } from '../../../core/base/builders';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetsRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedAssetsByUserId: Record<string, AppTypes.AssetCard[]> = {};

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
    try {
      const response = await this.http
        .get<AppTypes.AssetCard[] | null>(`${this.apiBaseUrl}/assets`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const cards = this.normalizeCards(Array.isArray(response) ? response : []);
      this.cachedAssetsByUserId[normalizedUserId] = cards;
      return this.cloneCards(cards);
    } catch {
      return this.peekOwnedAssetsByUser(normalizedUserId);
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
    return { ...normalizedAsset, requests: [...normalizedAsset.requests] };
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
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => ({ ...request }))
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
      city: card?.city?.trim() ?? '',
      capacityTotal: Math.max(1, Math.trunc(Number(card?.capacityTotal) || 0)),
      details: card?.details?.trim() ?? '',
      imageUrl: card?.imageUrl?.trim() ?? '',
      sourceLink: card?.sourceLink?.trim() ?? '',
      routes: Array.isArray(card?.routes)
        ? card.routes.map(route => `${route ?? ''}`.trim()).filter(route => route.length > 0)
        : [],
      pricing: PricingBuilder.normalizePricingConfig(card?.pricing, { context: 'asset' }),
      requests: Array.isArray(card?.requests)
        ? card.requests
          .map(request => ({
            id: `${request?.id ?? ''}`.trim(),
            userId: `${request?.userId ?? ''}`.trim() || undefined,
            name: `${request?.name ?? ''}`.trim(),
            initials: `${request?.initials ?? ''}`.trim(),
            gender: (request?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
            status: (request?.status === 'accepted' ? 'accepted' : 'pending') as AppTypes.AssetRequestStatus,
            note: `${request?.note ?? ''}`.trim()
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
        pricing: nextCard.pricing ? PricingBuilder.clonePricingConfig(nextCard.pricing) : undefined,
        requests: nextCard.requests.map(request => ({ ...request }))
      };
      return next;
    }
    return [
      {
        ...nextCard,
        routes: [...(nextCard.routes ?? [])],
        pricing: nextCard.pricing ? PricingBuilder.clonePricingConfig(nextCard.pricing) : undefined,
        requests: nextCard.requests.map(request => ({ ...request }))
      },
      ...next
    ];
  }
}
