import { Injectable, inject } from '@angular/core';

import { RouteDelayService } from './route-delay.service';

export type RouteIntervalTask = () => void | Promise<void>;
export type RouteIntervalStop = () => void;

@Injectable({
  providedIn: 'root'
})
export class RouteIntervalSchedulerService {
  private readonly routeDelay = inject(RouteDelayService);

  startInterval(
    route: string,
    task: RouteIntervalTask,
    options: { fallbackIntervalMs?: number; signal?: AbortSignal } = {}
  ): RouteIntervalStop {
    const intervalMs = this.routeDelay.resolveIntervalMs(route, options.fallbackIntervalMs);
    if (intervalMs <= 0) {
      return () => undefined;
    }

    let active = true;
    const run = () => {
      if (!active) {
        return;
      }
      void task();
    };
    const timer = setInterval(run, intervalMs);
    const stop = () => {
      if (!active) {
        return;
      }
      active = false;
      clearInterval(timer);
      options.signal?.removeEventListener('abort', stop);
    };

    if (options.signal?.aborted) {
      stop();
      return stop;
    }
    options.signal?.addEventListener('abort', stop, { once: true });
    return stop;
  }
}
