import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import { LocalAssetsRepository } from '../repositories/assets.repository';

import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetsService extends LocalRouteDelayService {
  private static readonly ASSETS_ROUTE = '/assets';
  private readonly assetsRepository = inject(LocalAssetsRepository);

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetDTO[] {
    return this.assetsRepository.peekOwnedAssetsByUser(userId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetDTO | null {
    return this.assetsRepository.peekOwnedAssetById(userId, assetId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryOwnedAssetsByUser(userId);
  }

  async loadOwnedAssetDetailById(userId: string, assetId: string): Promise<AppDTOs.AssetDetailDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.loadOwnedAssetDetailById(userId, assetId);
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryVisibleAssets(query);
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetDetailDTO): Promise<AppDTOs.AssetDTO> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetDTO[]): Promise<AppDTOs.AssetDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.makeAssetManager(userId, assetId, targetUserId);
  }

}
