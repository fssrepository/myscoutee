import { Injectable, inject } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_CONFIGURATION,
  type DeploymentConfigurationDto,
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

  async loadBranding(): Promise<DeploymentConfigurationDto> {
    await this.routeDelay.waitForRouteDelay(DEPLOYMENT_CONFIGURATION_ROUTE);
    const record = await this.repository.read();
    return structuredClone(record?.configuration
      ? {
          ...record.configuration.branding,
          socialLinks: record.configuration.socialLinks
        }
      : DEFAULT_DEPLOYMENT_CONFIGURATION
    );
  }
}
