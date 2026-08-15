import { Injectable, inject } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_CONFIGURATION,
  type DeploymentConfigurationDto,
  type DeploymentConfigurationServiceContract
} from '../../../contracts/deployment-configuration.interface';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedOperatorRegistryBuilder } from '../../seed/builders/operator-registry-seed.builder';
import { LocalOperatorRegistryMapper } from '../mappers/operator-registry.mapper';
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
    const normalizedRecord = record
      ? LocalOperatorRegistryMapper.toSeedRecord(
          { registryRecord: record },
          SeedOperatorRegistryBuilder.buildInitialRecord()
        )
      : null;
    if (
      record
      && normalizedRecord
      && LocalOperatorRegistryMapper.seedRecordChanged(record, normalizedRecord)
    ) {
      await this.repository.write(normalizedRecord);
    }
    return structuredClone(normalizedRecord?.configuration
      ? {
          ...normalizedRecord.configuration.branding,
          socialLinks: normalizedRecord.configuration.socialLinks,
          privacyContact: normalizedRecord.configuration.privacyContact
        }
      : DEFAULT_DEPLOYMENT_CONFIGURATION
    );
  }
}
