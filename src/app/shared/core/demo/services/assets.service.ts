import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoAssetBuilder } from '../builders';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoAssetsRepository } from '../repositories/assets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetsService extends DemoRouteDelayService {
  private static readonly ASSETS_ROUTE = '/assets';
  private readonly assetsRepository = inject(DemoAssetsRepository);

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    return this.assetsRepository.peekOwnedAssetsByUser(userId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    await this.waitForRouteDelay(DemoAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    await this.waitForRouteDelay(DemoAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppTypes.AssetCard[]): Promise<AppTypes.AssetCard[]> {
    await this.waitForRouteDelay(DemoAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.waitForRouteDelay(DemoAssetsService.ASSETS_ROUTE);
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  async refreshAssetSourcePreview(
    _userId: string,
    type: AppTypes.AssetType,
    sourceLink: string
  ): Promise<AppTypes.AssetSourcePreview | null> {
    await this.waitForRouteDelay(DemoAssetsService.ASSETS_ROUTE);
    const normalizedUrl = this.normalizeSourceUrl(sourceLink);
    if (!normalizedUrl) {
      return null;
    }
    let parsed: URL;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      return null;
    }
    const seed = `${type.toLowerCase()}-${parsed.hostname.replace(/\./g, '-')}${parsed.pathname.replace(/[^\w-]/g, '-')}`;
    return {
      enabled: true,
      supported: true,
      normalizedUrl,
      title: `${type} · ${parsed.hostname.replace(/^www\./, '')}`,
      subtitle: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1).replace(/[-_/]+/g, ' ') : 'Imported preview',
      details: `Preview imported from ${parsed.hostname}. You can adjust the details before saving.`,
      imageUrl: DemoAssetBuilder.defaultAssetImage(type, seed)
    };
  }

  private normalizeSourceUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return '';
      }
    }
  }
}
