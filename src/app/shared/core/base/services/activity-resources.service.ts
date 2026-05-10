import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { InfoCardData } from '../../../ui';
import { AppContext } from '../context';
import { ActivityResourceBuilder, type ActivitySubEventResourceInfoCardOptions } from '../builders';
import { DemoActivityResourcesService } from '../../demo/services/activity-resources.service';
import { HttpActivityResourcesService } from '../../http/services/activity-resources.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityResourcesService extends BaseRouteModeService {
  private readonly demoActivityResourcesService = inject(DemoActivityResourcesService);
  private readonly httpActivityResourcesService = inject(HttpActivityResourcesService);
  private readonly appCtx = inject(AppContext);


  private get activityResourcesService(): DemoActivityResourcesService | HttpActivityResourcesService {
    return this.resolveRouteService(
      '/activities/events/subevent-resources',
      this.demoActivityResourcesService,
      this.httpActivityResourcesService
    );
  }

  activeAssetOwnerUserId(): string {
    return this.normalizeId(this.appCtx.activeUserId());
  }

  peekSubEventResourceState(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetOwnerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): AppTypes.ActivitySubEventResourceState | null {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    if (!ref) {
      return null;
    }
    return this.activityResourcesService.peekSubEventResourceState(ref);
  }

  async querySubEventResourceState(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetOwnerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    if (!ref) {
      return null;
    }
    return this.activityResourcesService.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    signal?: AbortSignal
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    if (!state) {
      return null;
    }
    const normalizedState = this.normalizeRef(state.ownerId, state.subEventId, state.assetOwnerUserId);
    if (!normalizedState) {
      return null;
    }
    return this.activityResourcesService.replaceSubEventResourceState({
      ...state,
      ownerId: normalizedState.ownerId,
      subEventId: normalizedState.subEventId,
      assetOwnerUserId: normalizedState.assetOwnerUserId
    }, signal);
  }

  subEventResourceInfoCard(
    card: AppTypes.SubEventResourceCard,
    options: ActivitySubEventResourceInfoCardOptions
  ): InfoCardData {
    return ActivityResourceBuilder.buildSubEventResourceInfoCard(card, options);
  }

  private normalizeRef(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetOwnerUserId: string | null | undefined
  ): AppTypes.ActivitySubEventResourceStateRef | null {
    const normalizedOwnerId = this.normalizeId(ownerId);
    const normalizedSubEventId = this.normalizeId(subEventId);
    const normalizedAssetOwnerUserId = this.normalizeId(assetOwnerUserId);
    if (!normalizedOwnerId || !normalizedSubEventId || !normalizedAssetOwnerUserId) {
      return null;
    }
    return {
      ownerId: normalizedOwnerId,
      subEventId: normalizedSubEventId,
      assetOwnerUserId: normalizedAssetOwnerUserId
    };
  }

  private normalizeId(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
