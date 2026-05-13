import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { InfoCardData } from '../../../ui';
import { AssetInfoCardBuilder } from '../builders';
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
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    if (this.isDemoModeEnabled('/assets')) {
      return this.demoAssetsService.queryOwnedAssetsByUser(normalizedUserId);
    }
    const cachedCards = this.httpAssetsService.peekOwnedAssetsByUser(normalizedUserId);
    const { value } = await this.loadWithRecovery(
      () => this.httpAssetsService.queryOwnedAssetsByUser(normalizedUserId),
      () => cachedCards,
      {
        shouldRecover: cards => cards.length === 0 && cachedCards.length > 0,
        hasRecoveryValue: cards => cards.length > 0
      }
    );
    return value;
  }

  async queryVisibleAssets(query: AppTypes.AssetExploreQuery): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.assetsService.queryVisibleAssets({
      ...query,
      userId: normalizedUserId
    });
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

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppTypes.AssetCard | null> {
    return this.assetsService.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppTypes.AssetCard | null> {
    return this.assetsService.makeAssetManager(userId, assetId, targetUserId);
  }

  exploreAssetInfoCard(
    card: AppTypes.AssetCard,
    options: {
      groupLabel?: string | null;
      availabilityLabel: string;
      canBorrow: boolean;
      canReportOwner: boolean;
    }
  ): InfoCardData {
    return AssetInfoCardBuilder.buildExploreAssetInfoCard(card, options);
  }

  async refreshAssetSourcePreview(
    userId: string,
    type: AppTypes.AssetType,
    sourceLink: string
  ): Promise<AppTypes.AssetSourcePreview | null> {
    return this.assetsService.refreshAssetSourcePreview(userId, type, sourceLink);
  }
}
