import {
  Injectable,
  inject
} from '@angular/core';

import {
  LocalActivityResourcesService
} from '../../local/source/services/activity-resources.service';
import {
  HttpActivityResourcesService
} from '../../http/services/activity-resources.service';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import {
  RouteDelayService
} from './route-delay.service';

import type * as AppDTOs from '../../contracts';
import type { AssetType } from '../../common/constants';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../ui/context/stores/activity.store';
const ACTIVITY_SUB_EVENT_RESOURCES_ROUTE = '/activities/events/subevent-resources';

@Injectable({
  providedIn: 'root'
})
export class ActivityResourcesService extends BaseRouteModeService {
  private readonly localActivityResourcesService = inject(LocalActivityResourcesService);
  private readonly httpActivityResourcesService = inject(HttpActivityResourcesService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly routeDelay = inject(RouteDelayService);

  private get activityResourcesService(): LocalActivityResourcesService | HttpActivityResourcesService {
    return this.resolveRouteService(
      ACTIVITY_SUB_EVENT_RESOURCES_ROUTE,
      this.localActivityResourcesService,
      this.httpActivityResourcesService
    );
  }

  activeAssetOwnerUserId(): string {
    return this.normalizeId(this.userProfileStore.activeUserId());
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
    return state;
  }

  async querySubEventResourceScope(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    viewerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): Promise<AppDTOs.ActivitySubEventResourceScopeDTO | null> {
    const ref = this.normalizeRef(ownerId, subEventId, viewerUserId);
    if (!ref) {
      return null;
    }
    return this.activityResourcesService.querySubEventResourceScope(ref);
  }

  peekSubEventResourceScope(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    viewerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): AppDTOs.ActivitySubEventResourceScopeDTO | null {
    const ref = this.normalizeRef(ownerId, subEventId, viewerUserId);
    return ref ? this.activityResourcesService.peekSubEventResourceScope(ref) : null;
  }

  async markResourceTypeRead(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    resourceType: AssetType,
    userId: string | null | undefined = this.activeAssetOwnerUserId()
  ): Promise<AppDTOs.ActivitySubEventResourceReadReceiptDTO | null> {
    const normalizedOwnerId = this.normalizeId(ownerId);
    const normalizedSubEventId = this.normalizeId(subEventId);
    const normalizedUserId = this.normalizeId(userId);
    if (!normalizedOwnerId || !normalizedSubEventId || !normalizedUserId) {
      return null;
    }
    const receipt = await this.activityResourcesService.markResourceTypeRead({
      ownerId: normalizedOwnerId,
      subEventId: normalizedSubEventId,
      resourceType,
      userId: normalizedUserId
    });
    if (receipt) {
      this.activityStore.emitActivityResourceSync({
        ownerId: receipt.ownerId,
        subEventId: receipt.subEventId,
        assetOwnerUserId: receipt.userId,
        resourceType: receipt.resourceType,
        readAtIso: receipt.readAtIso
      });
    }
    return receipt;
  }

  async querySupplyContributionPage(
    ownerId: string | null | undefined,
    subEventId: string | null | undefined,
    assetId: string | null | undefined,
    page: number,
    pageSize: number,
    assetOwnerUserId: string | null | undefined = this.activeAssetOwnerUserId()
  ): Promise<AppDTOs.SubEventSupplyContributionPageDTO> {
    const ref = this.normalizeRef(ownerId, subEventId, assetOwnerUserId);
    const normalizedAssetId = this.normalizeId(assetId);
    if (!ref || !normalizedAssetId) {
      return { items: [], total: 0, page: 0, pageSize: Math.max(1, Math.trunc(pageSize) || 1) };
    }
    return this.activityResourcesService.querySupplyContributionPage(
      ref,
      normalizedAssetId,
      Math.max(0, Math.trunc(page) || 0),
      Math.max(1, Math.trunc(pageSize) || 1)
    );
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
    }, signal, this.activeAssetOwnerUserId());
    if (savedState) {
      this.activityStore.emitActivityResourceSync({
        ownerId: savedState.ownerId,
        subEventId: savedState.subEventId,
        assetOwnerUserId: savedState.assetOwnerUserId
      });
    }
    return savedState;
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
