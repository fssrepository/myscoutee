import { Injectable, inject } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_BRANDING,
  type DeploymentBrandingDto,
  type DeploymentConfigurationServiceContract
} from '../../../contracts/deployment-configuration.interface';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';

const DEPLOYMENT_CONFIGURATION_ROUTE = '/deployment/configuration';

@Injectable({
  providedIn: 'root'
})
export class LocalDeploymentConfigurationService
  implements DeploymentConfigurationServiceContract {
  private readonly repository = inject(LocalOperatorRegistryRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async loadBranding(): Promise<DeploymentBrandingDto> {
    await this.routeDelay.waitForRouteDelay(DEPLOYMENT_CONFIGURATION_ROUTE);
    const record = await this.repository.read();
    return structuredClone(
      record?.configuration?.branding ?? DEFAULT_DEPLOYMENT_BRANDING
    );
  }
}
