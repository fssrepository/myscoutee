import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import type { ActivitySubEventResourceRecord } from '../entity/activity.entity';
import { LocalActivityResourcesMapper } from '../mappers';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeMapper } from '../mappers/activity.mapper';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { ActivityResourceBuilder } from '../../../base/builders/activity-resource.builder';
import * as AppConstants from '../../../common/constants';

import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class LocalActivityResourcesService extends LocalRouteDelayService {
  private static readonly ROUTE = '/activities/events/subevent-resources';
  private readonly repository = inject(LocalActivityResourcesRepository);
  private readonly stageRuntimeRepository = inject(LocalActivitySubEventStageRuntimeRepository);
  private readonly assetsRepository = inject(LocalAssetsRepository);

  peekSubEventResourceState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const record = this.repository.peekSubEventResourceRecord(ref);
    return record ? this.toState(record) : null;
  }

  async querySubEventResourceState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE);
    const record = await this.repository.querySubEventResourceRecord(ref);
    return record ? this.toState(record) : null;
  }

  async querySupplyContributionPage(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO,
    assetId: string,
    page: number,
    pageSize: number
  ): Promise<AppDTOs.SubEventSupplyContributionPageDTO> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE);
    return this.repository.querySupplyContributionPage(ref, assetId, page, pageSize);
  }

  async replaceSubEventResourceState(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    signal?: AbortSignal
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE, signal, 'Activity resources request aborted.');
    const normalizedState = LocalActivityResourcesMapper.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedState.assetOwnerUserId);
    normalizedState.resourceMetricsByType = ActivityResourceBuilder.buildPersistedResourceMetrics(
      normalizedState,
      assets
    );
    const existing = this.repository.peekSubEventResourceRecord(normalizedState);
    const savedRecord = await this.repository.replaceSubEventResourceRecord(
      LocalActivityResourcesMapper.toRecord(normalizedState, existing)
    );
    const groupMetricsByType = this.persistGroupRuntimeMetrics(normalizedState);
    await this.repository.flushToIndexedDb();
    const savedState = savedRecord ? this.toState(savedRecord) : null;
    return savedState
      ? { ...savedState, resourceMetricsByType: groupMetricsByType }
      : null;
  }

  private persistGroupRuntimeMetrics(
    state: AppDTOs.ActivitySubEventResourceStateDTO
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    const scope = this.groupRuntimeScope(state.ownerId, state.subEventId);
    if (!scope || !state.assetOwnerUserId.trim()) {
      return ActivityResourceBuilder.cloneResourceMetricsByType(state.resourceMetricsByType);
    }
    const ref: AppDTOs.ActivitySubEventStageRuntimeStateRefDTO = {
      ownerId: scope.runtimeOwnerId,
      subEventId: scope.subEventId
    };
    const existing = this.stageRuntimeRepository.peekRecord(ref);
    const runtime = existing
      ? LocalActivitySubEventStageRuntimeMapper.cloneRecord(existing)
      : LocalActivitySubEventStageRuntimeMapper.toRecord({
          ...ref,
          stageStatus: null,
          stageStatusReason: null,
          stageStatusUpdatedAt: null,
          stageFinalizedAt: null,
          stageFinalizedByUserId: null,
          groupsCount: null
        });
    const byGroup = LocalActivitySubEventStageRuntimeMapper.cloneGroupResourceMetrics(
      runtime.groupResourceMetricsByAssetOwnerId
    );
    const byAssetOwner = { ...(byGroup[scope.groupId] ?? {}) };
    byAssetOwner[state.assetOwnerUserId] = ActivityResourceBuilder.cloneResourceMetricsByType(
      state.resourceMetricsByType
    );
    byGroup[scope.groupId] = byAssetOwner;
    runtime.groupResourceMetricsByAssetOwnerId = byGroup;
    this.stageRuntimeRepository.replaceRecord(runtime);
    return this.aggregateGroupRuntimeMetrics(byAssetOwner);
  }

  private aggregateGroupRuntimeMetrics(
    byAssetOwner: Record<string, Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>>>
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    const result: Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> = {};
    for (const type of AppConstants.ASSET_TYPES) {
      let accepted = 0;
      let pending = 0;
      let capacityMin = 0;
      let capacityMax = 0;
      for (const metricsByType of Object.values(byAssetOwner)) {
        const metric = metricsByType?.[type];
        accepted += Math.max(0, Math.trunc(Number(metric?.accepted) || 0));
        pending += Math.max(0, Math.trunc(Number(metric?.pending) || 0));
        capacityMin += Math.max(0, Math.trunc(Number(metric?.capacityMin) || 0));
        capacityMax += Math.max(0, Math.trunc(Number(metric?.capacityMax) || 0));
      }
      result[type] = {
        accepted,
        pending,
        capacityMin,
        capacityMax: Math.max(capacityMin, capacityMax)
      };
    }
    return result;
  }

  private groupRuntimeScope(
    ownerId: string,
    subEventId: string
  ): { runtimeOwnerId: string; subEventId: string; groupId: string } | null {
    const normalizedOwnerId = ownerId.trim();
    const normalizedSubEventId = subEventId.trim();
    const marker = `:${normalizedSubEventId}:`;
    const markerIndex = normalizedOwnerId.indexOf(marker);
    if (!normalizedOwnerId || !normalizedSubEventId || markerIndex <= 0) {
      return null;
    }
    const runtimeOwnerId = normalizedOwnerId.slice(0, markerIndex).trim();
    const groupId = normalizedOwnerId.slice(markerIndex + marker.length).trim();
    return runtimeOwnerId && groupId
      ? { runtimeOwnerId, subEventId: normalizedSubEventId, groupId }
      : null;
  }

  private toState(record: ActivitySubEventResourceRecord): AppDTOs.ActivitySubEventResourceStateDTO | null {
    return LocalActivityResourcesMapper.toState(record);
  }
}
