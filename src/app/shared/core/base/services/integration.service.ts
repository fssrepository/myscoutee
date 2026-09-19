import { Injectable, inject } from '@angular/core';

import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../contracts/integration.interface';
import { HttpIntegrationService } from '../../http/services/integration.service';
import { LocalIntegrationService } from '../../local/source/services/integration.service';
import { BaseRouteModeService } from './base-route-mode.service';

const INTEGRATIONS_ROUTE = '/integrations';

@Injectable({ providedIn: 'root' })
export class IntegrationService extends BaseRouteModeService {
  private readonly localService = inject(LocalIntegrationService);
  private readonly httpService = inject(HttpIntegrationService);

  loadSettings(): Promise<IntegrationSettingsDto> {
    return this.service.loadSettings();
  }

  createToken(
    name: string,
    expiresInDays: number
  ): Promise<IntegrationTokenCreatedDto> {
    return this.service.createToken(name, expiresInDays);
  }

  revokeToken(tokenId: string): Promise<void> {
    return this.service.revokeToken(tokenId);
  }

  absoluteBaseUrl(baseUrl: string): string {
    const normalized = baseUrl.trim();
    if (!normalized) {
      return '';
    }
    try {
      return new URL(
        normalized,
        globalThis.location?.origin ?? 'http://localhost'
      ).toString().replace(/\/$/, '');
    } catch {
      return normalized;
    }
  }

  private get service(): LocalIntegrationService | HttpIntegrationService {
    return this.resolveRouteService(
      INTEGRATIONS_ROUTE,
      this.localService,
      this.httpService
    );
  }
}
