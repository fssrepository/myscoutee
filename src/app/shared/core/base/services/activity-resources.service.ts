import { Injectable, Injector, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppContext } from '../context';
import { DemoActivityResourcesService } from '../../demo/services/activity-resources.service';
import { HttpActivityResourcesService } from '../../http/services/activity-resources.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityResourcesService extends BaseRouteModeService {
  private readonly injector = inject(Injector);
  private readonly httpActivityResourcesService = inject(HttpActivityResourcesService);
  private readonly appCtx = inject(AppContext);
  private demoActivityResourcesServiceRef: DemoActivityResourcesService | null = null;

  private get demoActivityResourcesService(): DemoActivityResourcesService {
    if (!this.demoActivityResourcesServiceRef) {
      this.demoActivityResourcesServiceRef = this.injector.get(DemoActivityResourcesService);
    }
    return this.demoActivityResourcesServiceRef;
  }


  private get activityResourcesService(): DemoActivityResourcesService | HttpActivityResourcesService {
    return this.resolveRouteService(
      '/activities/events/subevent-resources',
      this.demoActivityResourcesService,
      this.httpActivityResourcesService
    );
  }

  activeAssetOwnerUserId(): string {
    return this.appCtx.activeUserId().trim();
  }

  peekSubEventResourceState(
    ownerId: string,
    subEventId: string,
    assetOwnerUserId = this.activeAssetOwnerUserId()
  ): AppTypes.ActivitySubEventResourceState | null {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    if (!ref) {
      return null;
    }
    return this.activityResourcesService.peekSubEventResourceState(ref);
  }

  async querySubEventResourceState(
    ownerId: string,
    subEventId: string,
    assetOwnerUserId = this.activeAssetOwnerUserId()
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    if (!ref) {
      return null;
    }
    return this.activityResourcesService.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState,
    signal?: AbortSignal
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
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

  private normalizeRef(
    ownerId: string,
    subEventId: string,
    assetOwnerUserId: string
  ): AppTypes.ActivitySubEventResourceStateRef | null {
    const normalizedOwnerId = ownerId.trim();
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetOwnerUserId = assetOwnerUserId.trim();
    if (!normalizedOwnerId || !normalizedSubEventId || !normalizedAssetOwnerUserId) {
      return null;
    }
    return {
      ownerId: normalizedOwnerId,
      subEventId: normalizedSubEventId,
      assetOwnerUserId: normalizedAssetOwnerUserId
    };
  }
}
