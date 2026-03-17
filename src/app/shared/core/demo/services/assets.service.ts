import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../app-types';
import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoAssetsRepository } from '../repositories/assets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetsService {
  private static readonly ASSETS_ROUTE = '/assets';
  private readonly assetsRepository = inject(DemoAssetsRepository);

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    return this.assetsRepository.peekOwnedAssetsByUser(userId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    await this.waitForRouteDelay();
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    await this.waitForRouteDelay();
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.waitForRouteDelay();
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  private async waitForRouteDelay(): Promise<void> {
    const delayMs = resolveAdditionalDelayMsForRoute(DemoAssetsService.ASSETS_ROUTE);
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }
}
