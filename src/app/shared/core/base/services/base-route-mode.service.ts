import { inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { resolveRouteConfig } from '../config';
import { SessionService } from './session.service';

export interface LoadRecoveryResult<T> {
  value: T;
  recovered: boolean;
}

export abstract class BaseRouteModeService {
  protected readonly sessionService = inject(SessionService);

  protected isDemoModeEnabled(route: string): boolean {
    const routeConfig = resolveRouteConfig(route);
    return environment.activitiesDataSource !== 'http'
      && !routeConfig.http
      && (this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled);
  }

  protected resolveRouteService<TDemo, THttp>(route: string, demoService: TDemo, httpService: THttp): TDemo | THttp {
    return this.isDemoModeEnabled(route) ? demoService : httpService;
  }

  protected async loadWithRecovery<T>(
    load: () => Promise<T>,
    recover: () => T | Promise<T>,
    options: {
      shouldRecover?: (value: T) => boolean;
      hasRecoveryValue?: (value: T) => boolean;
    } = {}
  ): Promise<LoadRecoveryResult<T>> {
    const shouldRecover = options.shouldRecover ?? (() => false);
    const hasRecoveryValue = options.hasRecoveryValue ?? (() => true);

    try {
      const value = await load();
      if (!shouldRecover(value)) {
        return {
          value,
          recovered: false
        };
      }

      const recoveredValue = await recover();
      if (hasRecoveryValue(recoveredValue)) {
        return {
          value: recoveredValue,
          recovered: true
        };
      }

      return {
        value,
        recovered: false
      };
    } catch (error) {
      const recoveredValue = await recover();
      if (hasRecoveryValue(recoveredValue)) {
        return {
          value: recoveredValue,
          recovered: true
        };
      }
      throw error;
    }
  }
}
