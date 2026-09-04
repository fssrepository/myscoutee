import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import type { ActivityMemberRecord, ActivitySubEventResourceRecord } from '../entity/activity.entity';
import type { NotificationRecord } from '../entity/notification.entity';
import { LocalActivityResourcesMapper } from '../mappers';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeMapper } from '../mappers/activity.mapper';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
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
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly notificationsRepository = inject(LocalNotificationsRepository);

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

  async querySubEventResourceScope(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<AppDTOs.ActivitySubEventResourceScopeDTO | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE);
    return this.peekSubEventResourceScope(ref);
  }

  peekSubEventResourceScope(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceScopeDTO | null {
    const viewerRef = LocalActivityResourcesMapper.normalizeRef(ref);
    if (!viewerRef) {
      return null;
    }
    const visibleStates = this.repository
      .peekSubEventResourceRecords(viewerRef.ownerId, viewerRef.subEventId)
      .map(record => this.toVisibleState(record))
      .filter((state): state is AppDTOs.ActivitySubEventResourceStateDTO => Boolean(state));
    const viewerState = visibleStates.find(state => state.assetOwnerUserId === viewerRef.assetOwnerUserId)
      ?? ActivityResourceBuilder.createEmptyState(viewerRef);
    return ActivityResourceBuilder.normalizeScope({ viewerState, visibleStates }, viewerRef);
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
    const addedSupplyAssetIds = this.addedSupplyAssignmentIds(existing, normalizedState);
    const savedRecord = await this.repository.replaceSubEventResourceRecord(
      LocalActivityResourcesMapper.toRecord(normalizedState, existing)
    );
    const groupScope = this.groupRuntimeScope(normalizedState.ownerId, normalizedState.subEventId);
    const groupMetricsByType = this.persistGroupRuntimeMetrics(normalizedState, actorUserId);
    const commonMetricsByType = groupScope
      ? groupMetricsByType
      : this.buildCommonResourceMetrics(
          this.repository.peekSubEventResourceRecords(normalizedState.ownerId, normalizedState.subEventId)
            .map(record => this.toVisibleState(record))
            .filter((item): item is AppDTOs.ActivitySubEventResourceStateDTO => Boolean(item))
        );
    if (!groupScope) {
      this.eventsRepository.updateSubEventResourceMetrics(
        normalizedState.ownerId,
        normalizedState.subEventId,
        commonMetricsByType
      );
    }
    this.appendSupplyContributionOpenNotifications(
      normalizedState,
      actorUserId,
      addedSupplyAssetIds
    );
    await this.repository.flushToIndexedDb();
    const savedState = savedRecord ? this.toState(savedRecord) : null;
    return savedState
      ? {
          ...savedState,
          resourceMetricsByType: commonMetricsByType
        }
      : null;
  }

  private addedSupplyAssignmentIds(
    previous: ActivitySubEventResourceRecord | null,
    next: AppDTOs.ActivitySubEventResourceStateDTO
  ): string[] {
    const previousIds = new Set(previous?.assetAssignmentIds?.[AppConstants.ASSET_TYPE_SUPPLIES] ?? []);
    return [...new Set(next.assetAssignmentIds[AppConstants.ASSET_TYPE_SUPPLIES] ?? [])]
      .map(assetId => assetId.trim())
      .filter(assetId => assetId.length > 0 && !previousIds.has(assetId));
  }

  private appendSupplyContributionOpenNotifications(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    actorUserId: string | null | undefined,
    assetIds: readonly string[]
  ): void {
    if (assetIds.length === 0) {
      return;
    }
    const actorId = `${actorUserId ?? state.assetOwnerUserId}`.trim();
    const eventId = ActivityResourceBuilder.authorizationEventId(state.ownerId, state.subEventId);
    const recipients = this.resourceNotificationMembers(state)
      .map(member => member.userId.trim())
      .filter(userId => userId.length > 0 && userId !== actorId);
    if (recipients.length === 0) {
      return;
    }
    const createdAtIso = new Date().toISOString();
    const notificationRevision = Date.parse(createdAtIso);
    const notifications: NotificationRecord[] = assetIds.flatMap(assetId => {
      const asset = this.assetsRepository.peekAssetDetailForMembershipById(assetId);
      const assetTitle = `${asset?.title ?? 'Supplies'}`.trim() || 'Supplies';
      return recipients.map(recipientUserId => ({
        id: `event-supplies-open:${state.ownerId}:${state.subEventId}:${assetId}:${recipientUserId}:${notificationRevision}`,
        recipientUserId,
        kind: 'event-supplies-open',
        category: 'event' as const,
        title: 'Supplies requested',
        message: `${assetTitle} is open for contributions.`,
        createdAtIso,
        readAtIso: null,
        senderUserId: actorId || null,
        actionPath: '/game',
        sourceType: 'event',
        sourceId: eventId,
        payload: {
          eventId,
          ownerId: state.ownerId,
          subEventId: state.subEventId,
          assetId,
          assetTitle,
          resourceType: AppConstants.ASSET_TYPE_SUPPLIES,
          notification_tone: 'info'
        },
        revision: 1
      }));
    });
    this.notificationsRepository.append(notifications);
  }

  private resourceNotificationMembers(
    state: AppDTOs.ActivitySubEventResourceStateDTO
  ): ActivityMemberRecord[] {
    const scope = this.groupRuntimeScope(state.ownerId, state.subEventId);
    if (!scope) {
      return this.activityMembersRepository.peekRecordsByOwner({
        ownerType: 'event',
        ownerId: ActivityResourceBuilder.authorizationEventId(state.ownerId, state.subEventId)
      }).filter(member => member.status === 'accepted');
    }
    const candidates = [
      {
        ownerType: 'event' as const,
        ownerId: `random-room:${scope.runtimeOwnerId}:${scope.subEventId}:${scope.groupId}`
      },
      { ownerType: 'group' as const, ownerId: state.ownerId },
      { ownerType: 'group' as const, ownerId: scope.groupId }
    ];
    for (const owner of candidates) {
      const members = this.activityMembersRepository.peekRecordsByOwner(owner)
        .filter(member => member.status === 'accepted');
      if (members.length > 0) {
        return members;
      }
    }
    return [];
  }

  private buildCommonResourceMetrics(
    states: readonly AppDTOs.ActivitySubEventResourceStateDTO[]
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    const totals = new Map<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>();
    const capacityByAsset = new Map<string, { type: AppConstants.AssetType; min: number; max: number }>();
    const supplyQuantityByEntry = new Map<string, number>();
    for (const state of states) {
      for (const [assetId, entries] of Object.entries(state.supplyContributionEntriesByAssetId ?? {})) {
        for (const [index, entry] of entries.entries()) {
          const entryId = entry.id.trim() || `${ActivityResourceBuilder.recordId(state)}:${index}`;
          supplyQuantityByEntry.set(
            `${assetId}:${entryId}`,
            Math.max(0, Math.trunc(Number(entry.quantity) || 0))
          );
        }
      }
      for (const type of AppConstants.ASSET_TYPES) {
        const metric = state.resourceMetricsByType?.[type];
        const total = totals.get(type) ?? { accepted: 0, pending: 0, capacityMin: 0, capacityMax: 0 };
        total.accepted += Math.max(0, Math.trunc(Number(metric?.accepted) || 0));
        total.pending += Math.max(0, Math.trunc(Number(metric?.pending) || 0));
        total.capacityMin += Math.max(0, Math.trunc(Number(metric?.capacityMin) || 0));
        total.capacityMax += Math.max(0, Math.trunc(Number(metric?.capacityMax) || 0));
        totals.set(type, total);

        const assetIds = new Set([
          ...(state.assetAssignmentIds[type] ?? []),
          ...Object.keys(state.assetSettingsByType[type] ?? {})
        ]);
        for (const assetId of assetIds) {
          const settings = state.assetSettingsByType[type]?.[assetId];
          const card = (state.fallbackAssetCardsByType?.[type] ?? []).find(item => item.id === assetId);
          const quantity = Math.max(1, Math.trunc(Number(settings?.quantity) || 1));
          const key = `${type}:${assetId}`;
          const current = capacityByAsset.get(key) ?? { type, min: 0, max: 0 };
          current.min = Math.max(current.min, Math.max(0, Math.trunc(Number(settings?.capacityMin) || 0)));
          current.max = Math.max(
            current.max,
            Math.max(0, Math.trunc(Number(settings?.capacityMax ?? card?.capacityTotal) || 0)) * quantity
          );
          capacityByAsset.set(key, current);
        }
      }
    }
    for (const type of AppConstants.ASSET_TYPES) {
      const total = totals.get(type) ?? { accepted: 0, pending: 0, capacityMin: 0, capacityMax: 0 };
      const capacities = [...capacityByAsset.values()].filter(item => item.type === type);
      if (capacities.length > 0) {
        total.capacityMin = capacities.reduce((sum, item) => sum + item.min, 0);
        total.capacityMax = capacities.reduce((sum, item) => sum + item.max, 0);
      }
      if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
        total.accepted = [...supplyQuantityByEntry.values()].reduce((sum, quantity) => sum + quantity, 0);
        total.pending = 0;
      }
      total.capacityMax = Math.max(total.capacityMin, total.capacityMax);
      totals.set(type, total);
    }
    return Object.fromEntries(totals);
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

  private sameResourceMetric(
    left: AppDTOs.SubEventResourceMetricDTO | null | undefined,
    right: AppDTOs.SubEventResourceMetricDTO | null | undefined
  ): boolean {
    return Math.max(0, Math.trunc(Number(left?.accepted) || 0)) === Math.max(0, Math.trunc(Number(right?.accepted) || 0))
      && Math.max(0, Math.trunc(Number(left?.pending) || 0)) === Math.max(0, Math.trunc(Number(right?.pending) || 0))
      && Math.max(0, Math.trunc(Number(left?.capacityMin) || 0)) === Math.max(0, Math.trunc(Number(right?.capacityMin) || 0))
      && Math.max(0, Math.trunc(Number(left?.capacityMax) || 0)) === Math.max(0, Math.trunc(Number(right?.capacityMax) || 0));
  }

  private toState(record: ActivitySubEventResourceRecord): AppDTOs.ActivitySubEventResourceStateDTO | null {
    return LocalActivityResourcesMapper.toState(record);
  }

  private toVisibleState(record: ActivitySubEventResourceRecord): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const state = this.toState(record);
    if (!state) {
      return null;
    }
    const fallbackAssetCardsByType = ActivityResourceBuilder.cloneFallbackAssetCardsByType(
      state.fallbackAssetCardsByType
    );
    for (const type of AppConstants.ASSET_TYPES) {
      const cardsById = new Map((fallbackAssetCardsByType[type] ?? []).map(card => [card.id, card] as const));
      for (const assetId of state.assetAssignmentIds[type] ?? []) {
        const detail = this.assetsRepository.peekAssetDetailForMembershipById(assetId);
        if (detail?.type === type) {
          cardsById.set(detail.id, detail);
        }
      }
      if (cardsById.size > 0) {
        fallbackAssetCardsByType[type] = [...cardsById.values()];
      }
    }
    return {
      ...state,
      fallbackAssetCardsByType
    };
  }
}
