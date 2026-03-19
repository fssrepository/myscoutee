import { Injectable, inject } from '@angular/core';

import { resolveAdditionalDelayMsForRoute } from '../config';
import type * as AppTypes from '../../../core/base/models';
import { DemoActivityResourcesRepository } from '../repositories/activity-resources.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityResourcesService {
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
    await this.waitForRouteDelay();
    return this.repository.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    return this.repository.replaceSubEventResourceState(state);
  }

  private async waitForRouteDelay(): Promise<void> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoActivityResourcesService.ROUTE);
    if (additionalDelayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), additionalDelayMs);
    });
  }
}
