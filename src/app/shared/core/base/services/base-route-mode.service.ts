import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig } from '../config';

export abstract class BaseRouteModeService {
  protected isDemoModeEnabled(route: string): boolean {
    const routeConfig = resolveRouteConfig(route);
    if (environment.activitiesDataSource === 'demo') {
      return true;
    }
    return routeConfig.http !== true;
  }

  protected resolveRouteService<TDemo, THttp>(route: string, demoService: TDemo, httpService: THttp): TDemo | THttp {
    return this.isDemoModeEnabled(route) ? demoService : httpService;
  }
}
