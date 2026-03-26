import { Injectable } from '@angular/core';

import { resolveRouteConfig } from '../config';

@Injectable({
  providedIn: 'root'
})
export class RouteDelayService {
  resolveDelayMs(route: string, fallbackDelayMs = 0): number {
    const routeConfig = resolveRouteConfig(route);
    if (routeConfig.http) {
      return 0;
    }
    if (routeConfig.demoDelayMs > 0) {
      return routeConfig.demoDelayMs;
    }
    return this.normalizeDelayMs(fallbackDelayMs);
  }

  async waitForRouteDelay(
    route: string,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.',
    fallbackDelayMs = 0
  ): Promise<void> {
    const delayMs = this.resolveDelayMs(route, fallbackDelayMs);
    if (delayMs <= 0) {
      return;
    }
    await this.waitForDelay(delayMs, signal, abortMessage);
  }

  waitForDelay(
    delayMs: number,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.'
  ): Promise<void> {
    const normalizedDelayMs = this.normalizeDelayMs(delayMs);
    if (normalizedDelayMs <= 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError(abortMessage));
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, normalizedDelayMs);
      const onAbort = () => {
        cleanup();
        reject(this.createAbortError(abortMessage));
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  createAbortError(message = 'Request aborted.'): Error {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }

  private normalizeDelayMs(value: number): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }
}
