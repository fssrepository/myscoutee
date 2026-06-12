import { inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig } from '../config';
import { SessionService } from './session.service';

export abstract class BaseRouteModeService {
  protected readonly sessionService = inject(SessionService);

  protected isLocalRouteEnabled(route: string): boolean {
    const routeConfig = resolveRouteConfig(route);
    if (routeConfig.http) {
      return false;
    }
    return environment.activitiesDataSource !== 'http'
      && (this.sessionService.currentSession()?.kind === 'demo' || !environment.firebaseLoginEnabled);
  }

  protected resolveRouteService<TLocal, THttp>(route: string, localService: TLocal, httpService: THttp): TLocal | THttp {
    return this.isLocalRouteEnabled(route) ? localService : httpService;
  }
}
