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
    state: AppTypes.ActivitySubEventResourceState,
    signal?: AbortSignal
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    await this.waitForRouteDelay(signal);
    return this.repository.replaceSubEventResourceState(state);
  }

  private async waitForRouteDelay(signal?: AbortSignal): Promise<void> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoActivityResourcesService.ROUTE);
    if (additionalDelayMs <= 0) {
      return;
    }
    if (signal?.aborted) {
      throw this.createAbortError();
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, additionalDelayMs);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Activity resources request aborted.');
    error.name = 'AbortError';
    return error;
  }
}
