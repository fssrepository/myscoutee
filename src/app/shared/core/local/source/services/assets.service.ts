import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import { LocalAssetRequestsRepository } from '../repositories/asset-requests.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalAssetsMapper } from '../mappers/asset.mapper';
import { LocalActivityResourcesService } from './activity-resources.service';

import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetsService extends LocalRouteDelayService {
  private static readonly ASSETS_ROUTE = '/assets';
  private static readonly ASSET_AVAILABILITY_ROUTE = '/assets/availability';
  private readonly assetsRepository = inject(LocalAssetsRepository);
  private readonly assetRequestsRepository = inject(LocalAssetRequestsRepository);
  private readonly eventCheckoutBasketsRepository = inject(LocalEventCheckoutBasketsRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly activityResourcesService = inject(LocalActivityResourcesService);

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

  async loadOwnedAssetDetailById(
    userId: string,
    assetId: string,
    scope?: AppDTOs.AssetDetailLoadScopeDTO
  ): Promise<AppDTOs.AssetDetailDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    const detail = await this.assetsRepository.loadOwnedAssetDetailById(userId, assetId);
    if (!detail || !scope) {
      return detail;
    }
    const eventId = scope.eventId.trim();
    const subEventId = scope.subEventId.trim();
    const event = eventId ? this.eventsRepository.queryEventRecordById(userId, eventId) : null;
    const subEvent = event?.subEvents?.find(item => item.id.trim() === subEventId);
    if (!event
      || event.status !== 'A'
      || !subEvent
      || !subEvent.startAt?.trim()
      || !subEvent.endAt?.trim()) {
      return null;
    }
    return {
      ...detail,
      borrowWindow: {
        eventId: event.id,
        subEventId,
        startAtIso: subEvent.startAt.trim(),
        endAtIso: subEvent.endAt.trim()
      }
    };
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.queryVisibleAssets(query);
  }

  async queryVisibleAssetsPage(query: AppDTOs.AssetExplorePageQueryDTO): Promise<AppDTOs.AssetExplorePageResultDTO> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    const page = this.assetsRepository.queryVisibleAssetsPage(query);
    const baskets = await this.eventCheckoutBasketsRepository.loadBasketsByEvents(
      query.userId,
      page.items.map(item => item.id)
    );
    const checkoutResultStates: Record<string, AppDTOs.EventCheckoutResultState> = {};
    for (const [sourceId, basket] of baskets) {
      const resultStates = (basket.items ?? []).map(item => item.resultState ?? 'pending');
      checkoutResultStates[sourceId] = resultStates.some(resultState => resultState === 'failed')
        ? 'failed'
        : resultStates.length > 0 && resultStates.every(resultState => resultState === 'deleted')
          ? 'deleted'
          : resultStates.length > 0 && resultStates.every(resultState => resultState === 'deleted' || resultState === 'succeeded')
            ? 'succeeded'
            : 'pending';
    }
    return {
      ...page,
      checkoutResultStates
    };
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
    await this.waitForRouteDelay(
      LocalAssetsService.ASSET_AVAILABILITY_ROUTE,
      options.signal,
      'Asset availability request aborted.'
    );
    const page = this.assetRequestsRepository.queryAssetAvailabilityRecordPage(query);
    return LocalAssetsMapper.toAssetAvailabilityDtoPage(page);
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
    await this.waitForRouteDelay(
      LocalAssetsService.ASSET_AVAILABILITY_ROUTE,
      options.signal,
      'Asset availability stats request aborted.'
    );
    const page = this.assetRequestsRepository.queryAssetAvailabilityStatRecordPage(query);
    return LocalAssetsMapper.toAssetAvailabilityStatDtoPage(page);
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetDetailDTO): Promise<AppDTOs.AssetDTO> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.saveOwnedAsset(userId, asset);
  }

  async applyMemberStatusChange(
    request: AppDTOs.AssetMemberStatusChangeRequestDTO
  ): Promise<AppDTOs.AssetMemberStatusChangeDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    const asset = this.assetsRepository.peekAssetDetailForMembershipById(request.assetId);
    const managerUserId = this.activityResourcesService.peekAssignedAssetManagerUserId(
      request.eventId,
      request.subEventId,
      request.assetId
    );
    const result = await this.assetsRepository.applyMemberStatusChange(request);
    if (result && request.action === 'take-over' && result.status === 'accepted') {
      const transferred = await this.activityResourcesService.transferAssignedAssetManager(
        request.eventId,
        request.subEventId,
        request.assetId,
        `${request.previousManagerUserId ?? ''}`.trim(),
        request.actorUserId
      );
      return transferred ? result : null;
    }
    if (
      result
      && request.action === 'leave'
      && result.previousStatus === 'accepted'
      && managerUserId === request.actorUserId.trim()
    ) {
      const acceptedSuccessorRemains = (asset?.requests ?? []).some(candidate =>
        candidate.requestKind === 'borrow'
        && candidate.status === 'accepted'
        && `${candidate.userId ?? ''}`.trim() !== request.actorUserId.trim()
        && `${candidate.booking?.eventId ?? ''}`.trim() === request.eventId.trim()
        && `${candidate.booking?.subEventId ?? ''}`.trim() === request.subEventId.trim()
      );
      if (!acceptedSuccessorRemains) {
        await this.activityResourcesService.removeAssignedAsset(
          request.eventId,
          request.subEventId,
          request.assetId,
          request.actorUserId
        );
      } else {
        this.assetsRepository.markScopedAssetTakeOverAmount(
          request.assetId,
          request.eventId,
          request.subEventId,
          request.actorUserId
        );
      }
    }
    return result;
  }

  async replaceOwnedAssets(userId: string, assets: readonly AppDTOs.AssetDTO[]): Promise<AppDTOs.AssetDTO[]> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.replaceOwnedAssets(userId, assets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    await this.assetsRepository.deleteOwnedAsset(userId, assetId);
  }

  async leaveOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.leaveOwnedAsset(userId, assetId);
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.takeOverOwnedAsset(userId, assetId);
  }

  async makeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.makeAssetManager(userId, assetId, targetUserId);
  }

  async revokeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    await this.waitForRouteDelay(LocalAssetsService.ASSETS_ROUTE);
    return this.assetsRepository.revokeAssetManager(userId, assetId, targetUserId);
  }

}
