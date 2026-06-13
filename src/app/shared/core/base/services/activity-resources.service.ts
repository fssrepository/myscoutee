import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { InfoCardData } from '../../../ui';
import { AppContext } from '../context';
import { ActivityResourceBuilder, type ActivitySubEventResourceInfoCardOptions } from '../builders';
import { LocalActivityResourcesService } from '../../local/source/services/activity-resources.service';
import { HttpActivityResourcesService } from '../../http/services/activity-resources.service';
import { BaseRouteModeService } from './base-route-mode.service';

import type * as AppDTOs from '../dto';
@Injectable({
  providedIn: 'root'
})
export class ActivityResourcesService extends BaseRouteModeService {
  private readonly localActivityResourcesService = inject(LocalActivityResourcesService);
  private readonly httpActivityResourcesService = inject(HttpActivityResourcesService);
  private readonly appCtx = inject(AppContext);


  private get activityResourcesService(): LocalActivityResourcesService | HttpActivityResourcesService {
    return this.resolveRouteService(
      '/activities/events/subevent-resources',
      this.localActivityResourcesService,
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
    return this.activityResourcesService.querySubEventResourceState(ref);
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
    return this.activityResourcesService.replaceSubEventResourceState({
      ...state,
      ownerId: normalizedState.ownerId,
      subEventId: normalizedState.subEventId,
      assetOwnerUserId: normalizedState.assetOwnerUserId
    }, signal);
  }

  subEventResourceInfoCard(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardOptions
  ): InfoCardData {
    return ActivityResourceBuilder.buildSubEventResourceInfoCard(card, options);
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
