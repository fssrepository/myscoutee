import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import type { ActivitySubEventResourceRecord } from '../entity/activity.entity';
import { LocalActivityResourcesMapper } from '../mappers';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeMapper } from '../mappers/activity.mapper';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
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
  private readonly eventsRepository = inject(LocalEventsRepository);

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

  async markResourceTypeRead(
    request: AppDTOs.ActivitySubEventResourceReadRequestDTO
  ): Promise<AppDTOs.ActivitySubEventResourceReadReceiptDTO | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE);
    const scope = this.groupRuntimeScope(request.ownerId, request.subEventId);
    const userId = request.userId.trim();
    if (!scope || !userId || !AppConstants.ASSET_TYPES.includes(request.resourceType)) {
      return null;
    }
    const readAtIso = this.stageRuntimeRepository.markResourceTypeRead(
      { ownerId: scope.runtimeOwnerId, subEventId: scope.subEventId },
      scope.groupId,
      userId,
      request.resourceType
    );
    if (!readAtIso) {
      return null;
    }
    await this.stageRuntimeRepository.flushToIndexedDb();
    return {
      ownerId: request.ownerId.trim(),
      subEventId: scope.subEventId,
      groupId: scope.groupId,
      resourceType: request.resourceType,
      userId,
      readAtIso
    };
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
    signal?: AbortSignal,
    actorUserId?: string | null
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
    const groupMetricsByType = this.persistGroupRuntimeMetrics(normalizedState, actorUserId);
    await this.repository.flushToIndexedDb();
    const savedState = savedRecord ? this.toState(savedRecord) : null;
    return savedState
      ? { ...savedState, resourceMetricsByType: groupMetricsByType }
      : null;
  }

  private persistGroupRuntimeMetrics(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    actorUserId?: string | null
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
    let runtime = existing
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
    const existingMetricsByType = runtime.groupResourceMetricsByAssetOwnerId?.[scope.groupId]?.[state.assetOwnerUserId] ?? {};
    const nextMetricsByType = ActivityResourceBuilder.cloneResourceMetricsByType(
      state.resourceMetricsByType
    );
    const changedTypes = AppConstants.ASSET_TYPES.filter(type => !this.sameResourceMetric(
      existingMetricsByType[type],
      nextMetricsByType[type]
    ));
    if (changedTypes.length > 0 && existing) {
      runtime = this.stageRuntimeRepository.clearResourceTypeReads(
        ref,
        scope.groupId,
        changedTypes
      ) ?? runtime;
    }
    const normalizedActorUserId = `${actorUserId ?? ''}`.trim();
    const byGroup = LocalActivitySubEventStageRuntimeMapper.cloneGroupResourceMetrics(
      runtime.groupResourceMetricsByAssetOwnerId
    );
    const byAssetOwner = { ...(byGroup[scope.groupId] ?? {}) };
    byAssetOwner[state.assetOwnerUserId] = nextMetricsByType;
    byGroup[scope.groupId] = byAssetOwner;
    runtime.groupResourceMetricsByAssetOwnerId = byGroup;
    this.stageRuntimeRepository.replaceRecord(runtime);
    if (changedTypes.length > 0 && normalizedActorUserId) {
      this.stageRuntimeRepository.markResourceTypesRead(
        ref,
        scope.groupId,
        normalizedActorUserId,
        changedTypes
      );
      runtime = this.stageRuntimeRepository.peekRecord(ref) ?? runtime;
    }
    this.eventsRepository.syncTournamentStagePending(scope.runtimeOwnerId, scope.subEventId);
    return this.applyResourceReads(
      this.aggregateGroupRuntimeMetrics(byAssetOwner),
      runtime.groupResourceReadAtByUserId?.[scope.groupId]?.[normalizedActorUserId] ?? {}
    );
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

  private sameResourceMetric(
    left: AppDTOs.SubEventResourceMetricDTO | null | undefined,
    right: AppDTOs.SubEventResourceMetricDTO | null | undefined
  ): boolean {
    return Math.max(0, Math.trunc(Number(left?.accepted) || 0)) === Math.max(0, Math.trunc(Number(right?.accepted) || 0))
      && Math.max(0, Math.trunc(Number(left?.pending) || 0)) === Math.max(0, Math.trunc(Number(right?.pending) || 0))
      && Math.max(0, Math.trunc(Number(left?.capacityMin) || 0)) === Math.max(0, Math.trunc(Number(right?.capacityMin) || 0))
      && Math.max(0, Math.trunc(Number(left?.capacityMax) || 0)) === Math.max(0, Math.trunc(Number(right?.capacityMax) || 0));
  }

  private applyResourceReads(
    metricsByType: Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>>,
    readAtByType: Partial<Record<AppConstants.AssetType, string>>
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    return Object.fromEntries(AppConstants.ASSET_TYPES.map(type => {
      const metric = metricsByType[type];
      return [type, {
        accepted: Math.max(0, Math.trunc(Number(metric?.accepted) || 0)),
        pending: readAtByType[type] ? 0 : Math.max(0, Math.trunc(Number(metric?.pending) || 0)),
        capacityMin: Math.max(0, Math.trunc(Number(metric?.capacityMin) || 0)),
        capacityMax: Math.max(0, Math.trunc(Number(metric?.capacityMax) || 0))
      }];
    }));
  }

  private toState(record: ActivitySubEventResourceRecord): AppDTOs.ActivitySubEventResourceStateDTO | null {
    return LocalActivityResourcesMapper.toState(record);
  }
}
