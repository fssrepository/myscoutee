import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';

import type {
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
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

  retry(): Promise<OperatorRegistryStatusDto> {
    return this.registryService.retry();
  }

  disconnect(): Promise<OperatorRegistryStatusDto> {
    return this.registryService.disconnect();
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
