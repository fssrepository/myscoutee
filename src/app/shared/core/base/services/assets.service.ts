import { Injectable, Injector, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoAssetsService } from '../../demo/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class AssetsService extends BaseRouteModeService {
  private readonly injector = inject(Injector);
  private readonly httpAssetsService = inject(HttpAssetsService);
  private demoAssetsServiceRef: DemoAssetsService | null = null;

  private get demoAssetsService(): DemoAssetsService {
    if (!this.demoAssetsServiceRef) {
      this.demoAssetsServiceRef = this.injector.get(DemoAssetsService);
    }
    return this.demoAssetsServiceRef;
  }


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
