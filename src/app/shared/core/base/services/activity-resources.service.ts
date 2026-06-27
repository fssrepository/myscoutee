import { Injectable, inject } from '@angular/core';

import {
  ActivitySubEventResourceInfoCardConverter,
  type ActivitySubEventResourceInfoCardConverterOptions,
  type InfoCardData
} from '../../../ui';
import { AppContext } from '../../../ui/context';
import { LocalActivityResourcesService } from '../../local/source/services/activity-resources.service';
import { HttpActivityResourcesService } from '../../http/services/activity-resources.service';
import { BaseRouteModeService } from './base-route-mode.service';
import { RouteDelayService } from './route-delay.service';

import type * as AppDTOs from '../dto';
const ACTIVITY_SUB_EVENT_RESOURCES_ROUTE = '/activities/events/subevent-resources';

@Injectable({
  providedIn: 'root'
})
export class ActivityResourcesService extends BaseRouteModeService {
  private readonly localActivityResourcesService = inject(LocalActivityResourcesService);
  private readonly httpActivityResourcesService = inject(HttpActivityResourcesService);
  private readonly appCtx = inject(AppContext);
  private readonly routeDelay = inject(RouteDelayService);

  private get activityResourcesService(): LocalActivityResourcesService | HttpActivityResourcesService {
    return this.resolveRouteService(
      ACTIVITY_SUB_EVENT_RESOURCES_ROUTE,
      this.localActivityResourcesService,
      this.httpActivityResourcesService
    );
  }

  activeAssetOwnerUserId(): string {
    return this.normalizeId(this.appCtx.activeUserId());
  }

  waitForResourceRouteDelay(signal?: AbortSignal): Promise<void> {
    return this.routeDelay.waitForRouteDelay(
      ACTIVITY_SUB_EVENT_RESOURCES_ROUTE,
      signal,
      'Activity resources request aborted.'
    );
  }

  peekSubEventResourceState(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetOwnerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
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
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    if (!ref) {
      return null;
    }
    const state = await this.activityResourcesService.querySubEventResourceState(ref);
    if (state) {
      this.appCtx.emitActivityResourceSync(ref);
    }
    return state;
  }

  async replaceSubEventResourceState(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    signal?: AbortSignal
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    if (!state) {
      return null;
    }
    const normalizedState = this.normalizeRef(state.ownerId, state.subEventId, state.assetOwnerUserId);
    if (!normalizedState) {
      return null;
    }
    const savedState = await this.activityResourcesService.replaceSubEventResourceState({
      ...state,
      ownerId: normalizedState.ownerId,
      subEventId: normalizedState.subEventId,
      assetOwnerUserId: normalizedState.assetOwnerUserId
    }, signal);
    if (savedState) {
      this.appCtx.emitActivityResourceSync({
        ownerId: savedState.ownerId,
        subEventId: savedState.subEventId,
        assetOwnerUserId: savedState.assetOwnerUserId
      });
    }
    return savedState;
  }

  subEventResourceInfoCard(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): InfoCardData {
    return ActivitySubEventResourceInfoCardConverter.convert(card, options);
  }

  private normalizeRef(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetOwnerUserId: string | null | undefined
  ): AppDTOs.ActivitySubEventResourceStateRefDTO | null {
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
