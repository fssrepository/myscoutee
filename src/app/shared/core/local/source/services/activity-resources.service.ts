import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import type { ActivitySubEventResourceRecord } from '../entity/activity.entity';
import { LocalActivityResourcesMapper } from '../mappers';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';

import type * as AppDTOs from '../../../base/dto';
@Injectable({
  providedIn: 'root'
})
export class LocalActivityResourcesService extends LocalRouteDelayService {
  private static readonly ROUTE = '/activities/events/subevent-resources';
  private readonly repository = inject(LocalActivityResourcesRepository);
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

  async replaceSubEventResourceState(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    signal?: AbortSignal
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE, signal, 'Activity resources request aborted.');
    const normalizedState = LocalActivityResourcesMapper.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    const existing = this.repository.peekSubEventResourceRecord(normalizedState);
    const savedRecord = await this.repository.replaceSubEventResourceRecord(
      LocalActivityResourcesMapper.toRecord(normalizedState, existing)
    );
    return savedRecord ? this.toState(savedRecord) : null;
  }

  private toState(record: ActivitySubEventResourceRecord): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const assets = this.assetsRepository.peekOwnedAssetsByUser(record.assetOwnerUserId);
    return LocalActivityResourcesMapper.toState(record, assets);
  }
}
