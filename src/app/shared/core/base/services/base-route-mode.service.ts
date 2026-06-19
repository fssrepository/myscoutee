import { inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig, type RouteMode } from '../config';
import { SessionService } from './session.service';

export interface RouteModeConfig {
  mode?: RouteMode | null;
}

export interface RouteServiceConfig<TMemory = never> extends RouteModeConfig {
  memoryService?: TMemory | null;
}

export abstract class BaseRouteModeService {
  protected readonly sessionService = inject(SessionService);

  protected isLocalRouteEnabled(route: string): boolean {
    return this.resolveRouteMode(route) === 'local';
  }

  protected resolveRouteService<TLocal, THttp, TMemory = never>(
    route: string,
    localService: TLocal,
    httpService: THttp,
    config: RouteServiceConfig<TMemory> | null = null
  ): TLocal | THttp | TMemory {
    const mode = this.resolveRouteMode(route, config?.mode ?? null);
    if (mode === 'memory') {
      const memoryService = config?.memoryService ?? null;
      if (!memoryService) {
        throw new Error(`Route ${route} requested memory mode without a memory service.`);
      }
      return memoryService;
    }
    return mode === 'local' ? localService : httpService;
  }

  protected resolveRouteMode(route: string, requestedMode: RouteMode | null = null): RouteMode {
    if (requestedMode) {
      return requestedMode;
    }
    const routeConfig = resolveRouteConfig(route);
    if (routeConfig.mode) {
      return routeConfig.mode;
    }
    if (routeConfig.http) {
      return 'http';
    }
    return environment.activitiesDataSource !== 'http'
      && (this.sessionService.currentSession()?.kind === 'demo' || !environment.firebaseLoginEnabled)
      ? 'local'
      : 'http';
  }
}
