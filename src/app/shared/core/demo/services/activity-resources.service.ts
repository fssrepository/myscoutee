import { Injectable, inject } from '@angular/core';

import { DemoRouteDelayService } from './demo-route-delay.service';
import type * as AppTypes from '../../../core/base/models';
import { DemoActivityResourcesRepository } from '../repositories/activity-resources.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityResourcesService extends DemoRouteDelayService {
  private static readonly ROUTE = '/activities/events/subevent-resources';
  private readonly repository = inject(DemoActivityResourcesRepository);

  peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    return this.repository.peekSubEventResourceState(ref);
  }

  async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    await this.waitForRouteDelay(DemoActivityResourcesService.ROUTE);
    return this.repository.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState,
    signal?: AbortSignal
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    await this.waitForRouteDelay(DemoActivityResourcesService.ROUTE, signal, 'Activity resources request aborted.');
    return this.repository.replaceSubEventResourceState(state);
  }

}
