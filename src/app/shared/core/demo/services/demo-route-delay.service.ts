import { inject } from '@angular/core';

import { RouteDelayService } from '../../base/services/route-delay.service';

export abstract class DemoRouteDelayService {
  private readonly routeDelayService = inject(RouteDelayService);

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
