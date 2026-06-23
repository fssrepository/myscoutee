import { inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig, type RouteMode } from '../config';
import { SessionService } from './session.service';

export interface RouteModeConfig {
  mode?: RouteMode | null;
}

export abstract class BaseRouteModeService {
  protected readonly sessionService = inject(SessionService);

  protected isLocalRouteEnabled(route: string): boolean {
    return this.resolveRouteMode(route) === 'local';
  }

  protected resolveRouteService<TLocal, THttp>(
    route: string,
    localService: TLocal,
    httpService: THttp,
    config: RouteModeConfig | null = null
  ): TLocal | THttp {
    const mode = this.resolveRouteMode(route, config?.mode ?? null);
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
