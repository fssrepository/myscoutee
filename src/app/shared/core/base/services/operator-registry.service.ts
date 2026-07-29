import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';

import type {
  OperatorGroupingTokenDto,
  OperatorClaimMutationResultDto,
  OperatorClaimOverviewDto,
  OperatorClaimRequestDto,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestRequestDto,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto,
  OperatorDeploymentUpdateProgressHandler,
  OperatorLeaderboardPageDto,
  OperatorRevenueDto,
  OperatorRegistryMutationResultDto,
  OperatorRegistryRegisterRequestDto,
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import type { ListQuery } from '../../contracts/list.interface';
import { HttpOperatorRegistryService } from '../../http/services/operator-registry.service';
import { LocalOperatorRegistryService } from '../../local/source/services/operator-registry.service';
import { BaseRouteModeService } from './base-route-mode.service';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
export type OperatorRegistryDataSource = 'local' | 'http' | 'session';

/**
 * Development HTTP builds use Java (and the isolated Go registry when wired).
 * Production Explore/demo and local builds use the browser-local sample
 * repository. Firebase/real sessions always use Java.
 */
@Injectable({
  providedIn: 'root'
})
export class OperatorRegistryService extends BaseRouteModeService {
  private readonly httpService = inject(HttpOperatorRegistryService);
  private readonly localService = inject(LocalOperatorRegistryService);

  loadStatus(): Promise<OperatorRegistryStatusDto> {
    return this.registryService.loadStatus();
  }

  inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto> {
    return this.registryService.inspect(request);
  }

  confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto> {
    return this.registryService.confirm(inspectionToken);
  }

  register(
    request: OperatorRegistryRegisterRequestDto
  ): Promise<OperatorRegistryMutationResultDto> {
    return this.registryService.register(request);
  }

  retry(): Promise<OperatorRegistryStatusDto> {
    return this.registryService.retry();
  }

  disconnect(): Promise<OperatorRegistryMutationResultDto> {
    return this.registryService.disconnect();
  }

  leaderboardPage(query: ListQuery, signal?: AbortSignal): Promise<OperatorLeaderboardPageDto> {
    return this.registryService.leaderboardPage(query, signal);
  }

  loadClaimStatus(): Promise<OperatorClaimOverviewDto> {
    return this.registryService.loadClaimStatus();
  }

  claimShare(
    request: OperatorClaimRequestDto
  ): Promise<OperatorClaimMutationResultDto> {
    return this.registryService.claimShare(request);
  }

  issueGroupingToken(): Promise<OperatorGroupingTokenDto> {
    return this.registryService.issueGroupingToken();
  }

  linkOperatorGroup(clientToken: string): Promise<OperatorClaimMutationResultDto> {
    return this.registryService.linkOperatorGroup({ clientToken });
  }

  loadDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto> {
    return this.registryService.loadDeploymentUpdate();
  }

  applyDeploymentUpdate(
    onProgress?: OperatorDeploymentUpdateProgressHandler
  ): Promise<OperatorDeploymentUpdateDto> {
    return this.registryService.applyDeploymentUpdate(onProgress);
  }

  loadConfiguration(): Promise<OperatorConfigurationDto> {
    return this.registryService.loadConfiguration();
  }

  saveConfiguration(
    request: OperatorConfigurationSaveRequestDto
  ): Promise<OperatorConfigurationDto> {
    return this.registryService.saveConfiguration(request);
  }

  testConfiguration(
    request: OperatorConfigurationTestRequestDto
  ): Promise<OperatorConfigurationTestResultDto> {
    return this.registryService.testConfiguration(request);
  }

  loadRevenue(): Promise<OperatorRevenueDto> {
    return this.registryService.loadRevenue();
  }

  loadCommunityStatus(): Promise<OperatorCommunityStatusDto> {
    return this.registryService.loadCommunityStatus();
  }

  setCommunityAvailability(
    availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto> {
    return this.registryService.setCommunityAvailability(availability);
  }

  private get registryService(): LocalOperatorRegistryService | HttpOperatorRegistryService {
    const mode = resolveOperatorRegistryRouteMode(
      environment.operatorRegistryDataSource,
      this.sessionService.currentSession()?.kind ?? null
    );
    if (mode === 'local') {
      return this.resolveRouteService(
        OPERATOR_REGISTRY_ROUTE,
        this.localService,
        this.httpService,
        { mode: 'local' }
      );
    }
    return this.resolveRouteService(
      OPERATOR_REGISTRY_ROUTE,
      this.localService,
      this.httpService,
      { mode: 'http' }
    );
  }
}

export function resolveOperatorRegistryRouteMode(
  dataSource: OperatorRegistryDataSource,
  sessionKind: 'demo' | 'firebase' | null
): 'local' | 'http' {
  if (dataSource === 'local' || dataSource === 'http') {
    return dataSource;
  }
  return sessionKind === 'demo' ? 'local' : 'http';
}
