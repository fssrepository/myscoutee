import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { RouteDelayService } from '../../base/services/route-delay.service';
import type {
  DeploymentBrandingDto,
  DeploymentConfigurationServiceContract
} from '../../contracts/deployment-configuration.interface';

const DEPLOYMENT_CONFIGURATION_ROUTE = '/deployment/configuration';

@Injectable({
  providedIn: 'root'
})
export class HttpDeploymentConfigurationService
  implements DeploymentConfigurationServiceContract {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = (environment.apiBaseUrl ?? '/api').replace(/\/+$/, '');

  async loadBranding(): Promise<DeploymentBrandingDto> {
    const response = await this.routeDelay.withRequestTimeout(
      DEPLOYMENT_CONFIGURATION_ROUTE,
      this.http.get<DeploymentBrandingDto>(
        `${this.apiBaseUrl}${DEPLOYMENT_CONFIGURATION_ROUTE}`
      ).toPromise(),
      'deployment.configuration.request.timeout'
    );
    if (!response) {
      throw new Error('deployment.configuration.response.unavailable');
    }
    return response;
  }
}
