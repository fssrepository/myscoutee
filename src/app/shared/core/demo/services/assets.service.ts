import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
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

}
