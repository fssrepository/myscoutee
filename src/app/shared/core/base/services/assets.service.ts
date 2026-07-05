import { Injectable, inject } from '@angular/core';

import { LocalAssetsService } from '../../local/source/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { BaseRouteModeService } from './base-route-mode.service';

import type * as AppDTOs from '../../contracts';
@Injectable({
  providedIn: 'root'
})
export class AssetsService extends BaseRouteModeService {
  private static readonly ASSETS_ROUTE = '/assets';
  private static readonly ASSET_AVAILABILITY_ROUTE = '/assets/availability';
  private readonly localAssetsService = inject(LocalAssetsService);
  private readonly httpAssetsService = inject(HttpAssetsService);


  private get assetsService(): LocalAssetsService | HttpAssetsService {
    return this.resolveRouteService(AssetsService.ASSETS_ROUTE, this.localAssetsService, this.httpAssetsService);
  }

  private get assetAvailabilityService(): LocalAssetsService | HttpAssetsService {
    return this.resolveRouteService(
      AssetsService.ASSET_AVAILABILITY_ROUTE,
      this.localAssetsService,
      this.httpAssetsService
    );
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

  async queryVisibleAssetsPage(query: AppDTOs.AssetExplorePageQueryDTO): Promise<AppDTOs.AssetExplorePageResultDTO> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    return this.assetsService.queryVisibleAssetsPage({
      ...query,
      userId: normalizedUserId,
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
    });
  }

  async loadOccupancyByAssetId(query: {
    userId: string;
    assetId: string;
    dateIso?: string | null;
    rangeStart?: string | null;
    rangeEnd?: string | null;
    filter?: AppDTOs.AssetAvailabilityFilter | null;
    order?: AppDTOs.AssetAvailabilityOrder | null;
    page?: number;
    pageSize: number;
    cursor?: string | null;
  }, options: { signal?: AbortSignal } = {}): Promise<AppDTOs.AssetOccupancyPageResultDTO> {
    const normalizedUserId = query.userId.trim();
    const normalizedAssetId = query.assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    return this.assetAvailabilityService.loadOccupancyByAssetId({
      ...query,
      userId: normalizedUserId,
      assetId: normalizedAssetId,
      page: Math.max(0, Math.trunc(Number(query.page) || 0)),
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
    }, options);
  }

  async loadStatByAssetId(query: {
    userId: string;
    assetId: string;
    rangeStart?: string | null;
    rangeEnd?: string | null;
    filter?: AppDTOs.AssetAvailabilityFilter | null;
    order?: AppDTOs.AssetAvailabilityOrder | null;
    page?: number;
    pageSize: number;
    cursor?: string | null;
  }, options: { signal?: AbortSignal } = {}): Promise<AppDTOs.AssetOccupancyStatsPageResultDTO> {
    const normalizedUserId = query.userId.trim();
    const normalizedAssetId = query.assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    return this.assetAvailabilityService.loadStatByAssetId({
      ...query,
      userId: normalizedUserId,
      assetId: normalizedAssetId,
      page: Math.max(0, Math.trunc(Number(query.page) || 0)),
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
    }, options);
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

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    return this.assetsService.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    return this.assetsService.makeAssetManager(userId, assetId, targetUserId);
  }

}
