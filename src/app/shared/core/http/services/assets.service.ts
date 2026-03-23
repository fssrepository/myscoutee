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

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
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
}
