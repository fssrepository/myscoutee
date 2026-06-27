import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { AssetDefaultsBuilder } from '../../../base/builders';

import type * as AppDTOs from '../../../contracts';
import type * as AppConstants from '../../../common/constants';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetsService extends LocalRouteDelayService {
  private static readonly ASSETS_ROUTE = '/assets';
  private readonly assetsRepository = inject(LocalAssetsRepository);

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetCardDTO[] {
    return this.assetsRepository.peekOwnedAssetsByUser(userId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetCardDTO | null {
    return this.assetsRepository.peekOwnedAssetById(userId, assetId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetCardDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
  }

  async loadFullOwnedAssetById(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.loadFullOwnedAssetById(userId, assetId);
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetCardDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryVisibleAssets(query);
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetCardDTO): Promise<AppDTOs.AssetCardDTO> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetCardDTO[]): Promise<AppDTOs.AssetCardDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetCardDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.makeAssetManager(userId, assetId, targetUserId);
  }

  async refreshAssetSourcePreview(
    _userId: string,
    type: AppConstants.AssetType,
    sourceLink: string
  ): Promise<AppDTOs.AssetSourcePreviewDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
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
      imageUrl: AssetDefaultsBuilder.defaultAssetImage(type, seed)
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
