import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import type * as AppTypes from '../../../core/base/models';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityResourcesService extends LocalRouteDelayService {
  private static readonly ROUTE = '/activities/events/subevent-resources';
  private readonly repository = inject(LocalActivityResourcesRepository);

  peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    return this.repository.peekSubEventResourceState(ref);
  }

  async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE);
    return this.repository.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState,
    signal?: AbortSignal
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    await this.waitForRouteDelay(LocalActivityResourcesService.ROUTE, signal, 'Activity resources request aborted.');
    return this.repository.replaceSubEventResourceState(state);
  }

}
