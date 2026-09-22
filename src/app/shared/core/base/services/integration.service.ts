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

  loadSettings(admin = false): Promise<IntegrationSettingsDto> {
    return this.service(admin).loadSettings(admin);
  }

  createToken(
    name: string,
    expiresInDays: number, admin = false
  ): Promise<IntegrationTokenCreatedDto> {
    return this.service(admin).createToken(name, expiresInDays, admin);
  }

  revokeToken(tokenId: string, admin = false): Promise<void> {
    return this.service(admin).revokeToken(tokenId, admin);
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

  private service(admin: boolean): LocalIntegrationService | HttpIntegrationService {
    return this.resolveRouteService(
      admin ? '/admin/client-api' : INTEGRATIONS_ROUTE,
      this.localService,
      this.httpService
    );
  }
}
