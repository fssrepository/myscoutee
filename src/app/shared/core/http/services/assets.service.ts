import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { HttpAssetsRepository } from '../repositories/assets.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetsService {
  private readonly assetsRepository = inject(HttpAssetsRepository);

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    return this.assetsRepository.peekOwnedAssetsByUser(userId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppTypes.AssetCard | null {
    return this.assetsRepository.peekOwnedAssetById(userId, assetId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
  }

  async loadFullOwnedAssetById(userId: string, assetId: string): Promise<AppTypes.AssetCard | null> {
    return this.assetsRepository.loadFullOwnedAssetById(userId, assetId);
  }

  async queryVisibleAssets(query: AppTypes.AssetExploreQuery): Promise<AppTypes.AssetCard[]> {
    return this.assetsRepository.queryVisibleAssets(query);
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppTypes.AssetCard[]): Promise<AppTypes.AssetCard[]> {
    return this.assetsRepository.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppTypes.AssetCard | null> {
    return this.assetsRepository.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppTypes.AssetCard | null> {
    return this.assetsRepository.makeAssetManager(userId, assetId, targetUserId);
  }

  async refreshAssetSourcePreview(
    userId: string,
    type: AppTypes.AssetType,
    sourceLink: string
  ): Promise<AppTypes.AssetSourcePreview | null> {
    return this.assetsRepository.refreshAssetSourcePreview(userId, type, sourceLink);
  }
}
