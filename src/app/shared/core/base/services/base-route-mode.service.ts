import { inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig } from '../config';
import { SessionService } from './session.service';

export abstract class BaseRouteModeService {
  protected readonly sessionService = inject(SessionService);

  protected isDemoModeEnabled(route: string): boolean {
    const routeConfig = resolveRouteConfig(route);
    return !routeConfig.http && (this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled);
  }

  protected resolveRouteService<TDemo, THttp>(route: string, demoService: TDemo, httpService: THttp): TDemo | THttp {
    return this.isDemoModeEnabled(route) ? demoService : httpService;
  }
}
