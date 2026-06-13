import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { InfoCardData } from '../../../ui';
import { AssetInfoCardBuilder } from '../builders';
import { LocalAssetsService } from '../../local/source/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { BaseRouteModeService } from './base-route-mode.service';

import type * as AppDTOs from '../dto';
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

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetCardDTO[] {
    return this.assetsService.peekOwnedAssetsByUser(userId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetCardDTO | null {
    return this.assetsService.peekOwnedAssetById(userId, assetId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetCardDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.assetsService.queryOwnedAssetsByUser(normalizedUserId);
  }

  async loadFullOwnedAssetById(userId: string, assetId: string): Promise<AppDTOs.AssetCardDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    return this.assetsService.loadFullOwnedAssetById(normalizedUserId, normalizedAssetId);
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetCardDTO[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.assetsService.queryVisibleAssets({
      ...query,
      userId: normalizedUserId
    });
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetCardDTO): Promise<AppDTOs.AssetCardDTO> {
    return this.assetsService.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetCardDTO[]): Promise<AppDTOs.AssetCardDTO[]> {
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

  exploreAssetInfoCard(
    card: AppDTOs.AssetCardDTO,
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
    type: AppConstants.AssetType,
    sourceLink: string
  ): Promise<AppDTOs.AssetSourcePreviewDTO | null> {
    return this.assetsService.refreshAssetSourcePreview(userId, type, sourceLink);
  }
}
