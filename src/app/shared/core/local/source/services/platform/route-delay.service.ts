import { inject } from '@angular/core';

import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';

export abstract class LocalRouteDelayService {
  private readonly routeDelayService = inject(RouteDelayService);

  /** A local request includes its work in the simulated transport time. */
  protected async withRouteDelay<T>(
    route: string | null,
    operation: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    signal?.throwIfAborted();
    const [, result] = await Promise.all([
      route ? this.waitForRouteDelay(route, signal) : Promise.resolve(),
      operation()
    ]);
    return result;
  }

  protected async waitForRouteDelay(
    route: string,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.'
  ): Promise<void> {
    await this.routeDelayService.waitForRouteDelay(route, signal, abortMessage);
  }

  protected waitForDelay(
    delayMs: number,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.'
  ): Promise<void> {
    return this.routeDelayService.waitForDelay(delayMs, signal, abortMessage);
  }

  protected createAbortError(message = 'Request aborted.'): Error {
    return this.routeDelayService.createAbortError(message);
  }
}
