import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoAssetsService } from '../../demo/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class AssetsService extends BaseRouteModeService {
  private readonly demoAssetsService = inject(DemoAssetsService);
  private readonly httpAssetsService = inject(HttpAssetsService);


  private get assetsService(): DemoAssetsService | HttpAssetsService {
    return this.resolveRouteService('/assets', this.demoAssetsService, this.httpAssetsService);
  }

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    return this.assetsService.peekOwnedAssetsByUser(userId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    return this.assetsService.queryOwnedAssetsByUser(userId);
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    return this.assetsService.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppTypes.AssetCard[]): Promise<AppTypes.AssetCard[]> {
    return this.assetsService.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.assetsService.deleteOwnedAsset(userId, assetId);
  }
}
