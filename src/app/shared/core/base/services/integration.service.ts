import type { McpSettingsDto, McpClientRequest, McpClientCreatedDto, McpAuthorizationRequest, McpAuthorizationContext } from '../../contracts/integration.interface';
import { ShareTokensService } from './share-tokens.service';
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
  private readonly shareTokens = inject(ShareTokensService);
  private readonly localService = inject(LocalIntegrationService);
  private readonly httpService = inject(HttpIntegrationService);

  async externalInviteLink(request: import('../../contracts/integration.interface').ExternalInviteLinkRequest): Promise<{url: string}> {
    if (request.ownerType === 'asset') {
      const [settings, token] = await Promise.all([
        this.loadSettings(), this.shareTokens.createToken({ kind: 'asset', entityId: request.entityId, assetType: request.assetType })
      ]);
      if (!token) throw new Error('Share link unavailable');
      const url = new URL(this.absoluteBaseUrl(settings.affiliate.url));
      url.pathname = '/game';
      url.searchParams.set('sharedAsset', token);
      return {url: url.toString()};
    }
    const link = await this.resolveRouteService(request.ownerType === 'community' ? '/groups' : '/activities/events',
      this.localService, this.httpService).externalInviteLink(request);
    return {url: this.absoluteBaseUrl(link.url)};
  }

  mcpSettings(): Promise<McpSettingsDto> { return this.service(false).mcpSettings(); }
  createMcpClient(input: McpClientRequest): Promise<McpClientCreatedDto> { return this.service(false).createMcpClient(input); }
  revokeMcpClient(id: string): Promise<void> { return this.service(false).revokeMcpClient(id); }
  mcpAuthorization(input: McpAuthorizationRequest): Promise<McpAuthorizationContext> { return this.service(false).mcpAuthorization(input); }
  mcpConsent(input: McpAuthorizationRequest, approve: boolean): Promise<{url: string}> { return this.service(false).mcpConsent(input, approve); }

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
