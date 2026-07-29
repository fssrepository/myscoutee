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
  OperatorTlsConfigurationDto,
  OperatorTlsConfigurationUpdateDto,
  OperatorTlsJobDto,
  OperatorTlsTestRequestDto,
  OperatorDeploymentUpdateDto,
  OperatorDeploymentUpdateProgressHandler,
  OperatorLeaderboardDeploymentPageDto,
  OperatorLeaderboardPageDto,
  OperatorMeasurementReportDto,
  OperatorMeasurementReportFilters,
  OperatorMeasurementReportPageDto,
  OperatorMeasurementSyncDto,
  OperatorRevenueDto,
  OperatorRevenueReportDto,
  OperatorRevenueReportFilters,
  OperatorRevenueReportPageDto,
  OperatorRevenueSyncDto,
  OperatorSettlementFilters,
  OperatorSettlementPageDto,
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

export type OperatorRegistryReplacementResult =
  | {
      disconnected: OperatorRegistryMutationResultDto;
      registered: OperatorRegistryMutationResultDto;
      registrationError: null;
    }
  | {
      disconnected: OperatorRegistryMutationResultDto;
      registered: null;
      registrationError: unknown;
    };

/**
 * Session-backed builds use Java for both Explore/demo and Firebase sessions.
 * Explore remains isolated by its demo identity and server-side demo database.
 * Only environments configured explicitly as local use the browser repository.
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

  async replaceRegistration(
    request: OperatorRegistryRegisterRequestDto
  ): Promise<OperatorRegistryReplacementResult> {
    const service = this.registryService;
    const disconnected = await service.disconnect();
    try {
      return {
        disconnected,
        registered: await service.register(request),
        registrationError: null
      };
    } catch (registrationError) {
      return {
        disconnected,
        registered: null,
        registrationError
      };
    }
  }

  retry(): Promise<OperatorRegistryStatusDto> {
    return this.registryService.retry();
  }

  disconnect(): Promise<OperatorRegistryMutationResultDto> {
    return this.registryService.disconnect();
  }

  synchronizeMeasurements(): Promise<OperatorMeasurementSyncDto> {
    return this.registryService.synchronizeMeasurements();
  }

  measurementReportPage(
    query: ListQuery<OperatorMeasurementReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorMeasurementReportPageDto> {
    return this.registryService.measurementReportPage(query, signal);
  }

  requeueMeasurementReport(
    reportId: string
  ): Promise<OperatorMeasurementReportDto> {
    return this.registryService.requeueMeasurementReport(reportId);
  }

  leaderboardPage(query: ListQuery, signal?: AbortSignal): Promise<OperatorLeaderboardPageDto> {
    return this.registryService.leaderboardPage(query, signal);
  }

  leaderboardDeploymentPage(
    groupId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardDeploymentPageDto> {
    return this.registryService.leaderboardDeploymentPage(
      groupId,
      query,
      signal
    );
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

  activateFirebase(): Promise<OperatorConfigurationDto> {
    return this.registryService.activateFirebase();
  }

  loadTlsConfiguration(): Promise<OperatorTlsConfigurationDto> {
    return this.registryService.loadTlsConfiguration();
  }

  saveTlsConfiguration(
    request: OperatorTlsConfigurationUpdateDto
  ): Promise<OperatorTlsJobDto> {
    return this.registryService.saveTlsConfiguration(request);
  }

  testTlsConfiguration(
    request: OperatorTlsTestRequestDto
  ): Promise<OperatorTlsJobDto> {
    return this.registryService.testTlsConfiguration(request);
  }

  loadRevenue(): Promise<OperatorRevenueDto> {
    return this.registryService.loadRevenue();
  }

  synchronizeRevenue(): Promise<OperatorRevenueSyncDto> {
    return this.registryService.synchronizeRevenue();
  }

  revenueReportPage(
    query: ListQuery<OperatorRevenueReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorRevenueReportPageDto> {
    return this.registryService.revenueReportPage(query, signal);
  }

  requeueRevenueReport(reportId: string): Promise<OperatorRevenueReportDto> {
    return this.registryService.requeueRevenueReport(reportId);
  }

  settlementPage(
    query: ListQuery<OperatorSettlementFilters>,
    signal?: AbortSignal
  ): Promise<OperatorSettlementPageDto> {
    return this.registryService.settlementPage(query, signal);
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
    const mode = resolveOperatorRegistryRouteMode(environment.operatorRegistryDataSource);
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
  dataSource: OperatorRegistryDataSource
): 'local' | 'http' {
  if (dataSource === 'local' || dataSource === 'http') {
    return dataSource;
  }
  return 'http';
}
