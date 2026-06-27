import { Injectable, inject } from '@angular/core';

import { LocalAssetsService } from '../../local/source/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { BaseRouteModeService } from './base-route-mode.service';

import type * as AppDTOs from '../../contracts';
import type * as AppConstants from '../../common/constants';
@Injectable({
  providedIn: 'root'
})
export class AssetsService extends BaseRouteModeService {
  private readonly localAssetsService = inject(LocalAssetsService);
  private readonly httpAssetsService = inject(HttpAssetsService);


  private get assetsService(): LocalAssetsService | HttpAssetsService {
    return this.resolveRouteService('/assets', this.localAssetsService, this.httpAssetsService);
  }

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetDTO[] {
    return this.assetsService.peekOwnedAssetsByUser(userId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetDTO | null {
    return this.assetsService.peekOwnedAssetById(userId, assetId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.assetsService.queryOwnedAssetsByUser(normalizedUserId);
  }

  async loadOwnedAssetDetailById(userId: string, assetId: string): Promise<AppDTOs.AssetDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    return this.assetsService.loadOwnedAssetDetailById(normalizedUserId, normalizedAssetId);
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.assetsService.queryVisibleAssets({
      ...query,
      userId: normalizedUserId
    });
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetDetailDTO): Promise<AppDTOs.AssetDTO> {
    return this.assetsService.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetDTO[]): Promise<AppDTOs.AssetDTO[]> {
    return this.assetsService.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.assetsService.deleteOwnedAsset(userId, assetId);
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
    return this.assetsService.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetCardDTO | null> {
    return this.assetsService.makeAssetManager(userId, assetId, targetUserId);
  }

  async refreshAssetSourcePreview(
    userId: string,
    type: AppConstants.AssetType,
    sourceLink: string
  ): Promise<AppDTOs.AssetSourcePreviewDTO | null> {
    return this.assetsService.refreshAssetSourcePreview(userId, type, sourceLink);
  }
}
