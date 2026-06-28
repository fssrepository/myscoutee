import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../environments/environment';

import { resolveRouteConfig } from '../config';
import { SessionService } from './session.service';

function resolveCurrentRouteRequestTimeoutMs(route: string, fallbackTimeoutMs = 3000): number {
  const routeConfig = resolveRouteConfig(route);
  if (routeConfig.requestTimeoutMs > 0) {
    return routeConfig.requestTimeoutMs;
  }
  return normalizeDelayMs(fallbackTimeoutMs);
}

@Injectable({
  providedIn: 'root'
})
export class RouteDelayService {
  private readonly sessionService = inject(SessionService);

  resolveDelayMs(route: string, fallbackDelayMs = 0): number {
    const routeConfig = resolveRouteConfig(route);
    if (routeConfig.http) {
      return 0;
    }
    if (
      this.sessionService.currentSession()?.kind === 'demo'
      || (environment.activitiesDataSource !== 'http' && !environment.firebaseLoginEnabled)
    ) {
      return routeConfig.demoDelayMs > 0
        ? routeConfig.demoDelayMs
        : normalizeDelayMs(fallbackDelayMs);
    }
    return 0;
  }

  resolveRequestTimeoutMs(route: string, fallbackTimeoutMs = 3000): number {
    return resolveCurrentRouteRequestTimeoutMs(route, fallbackTimeoutMs);
  }

  resolveIntervalMs(route: string, fallbackIntervalMs = 0): number {
    const routeConfig = resolveRouteConfig(route);
    const demoRouteMode = this.sessionService.currentSession()?.kind === 'demo'
      || (environment.activitiesDataSource !== 'http' && !environment.firebaseLoginEnabled);
    const configuredIntervalMs = demoRouteMode && routeConfig.demoIntervalMs > 0
      ? routeConfig.demoIntervalMs
      : routeConfig.intervalMs;
    if (configuredIntervalMs > 0) {
      return configuredIntervalMs;
    }
    return normalizeDelayMs(fallbackIntervalMs);
  }

  withRequestTimeout<T>(
    route: string,
    task: Promise<T>,
    timeoutMessage = 'Request timed out.',
    fallbackTimeoutMs = 3000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (callback: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback();
      };
      timeoutId = setTimeout(
        () => finish(() => reject(new Error(timeoutMessage))),
        this.resolveRequestTimeoutMs(route, fallbackTimeoutMs)
      );
      task.then(value => finish(() => resolve(value))).catch(error => finish(() => reject(error)));
    });
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
    return normalizeDelayMs(value);
  }
}

function normalizeDelayMs(value: number): number {
  return Math.max(0, Math.trunc(Number(value) || 0));
}
