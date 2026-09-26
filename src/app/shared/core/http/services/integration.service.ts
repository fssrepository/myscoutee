import type { McpSettingsDto, McpClientRequest, McpClientCreatedDto, McpAuthorizationRequest, McpAuthorizationContext } from '../../contracts/integration.interface';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../contracts/integration.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpIntegrationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  mcpSettings(): Promise<McpSettingsDto> {
    return firstValueFrom(this.http.get<McpSettingsDto>(`${this.apiBaseUrl}/integrations/mcp/settings`));
  }
  createMcpClient(input: McpClientRequest): Promise<McpClientCreatedDto> {
    return firstValueFrom(this.http.post<McpClientCreatedDto>(`${this.apiBaseUrl}/integrations/mcp/clients`, input));
  }
  revokeMcpClient(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiBaseUrl}/integrations/mcp/clients/${encodeURIComponent(id)}`));
  }
  mcpAuthorization(input: McpAuthorizationRequest): Promise<McpAuthorizationContext> {
    return firstValueFrom(this.http.post<McpAuthorizationContext>(`${this.apiBaseUrl}/integrations/mcp/authorization`, input));
  }
  mcpConsent(authorization: McpAuthorizationRequest, approve: boolean): Promise<{url: string}> {
    return firstValueFrom(this.http.post<{url: string}>(`${this.apiBaseUrl}/integrations/mcp/consent`, {authorization, approve}));
  }

  externalInviteLink(request: import('../../contracts/integration.interface').ExternalInviteLinkRequest): Promise<{url: string}> {
    return firstValueFrom(this.http.post<{url: string}>(`${this.apiBaseUrl}/auth/me/partner-invite/link`, request));
  }

  loadSettings(admin = false): Promise<IntegrationSettingsDto> {
    return firstValueFrom(this.http.get<IntegrationSettingsDto>(`${this.apiBaseUrl}/${admin ? 'admin/client-api' : 'integrations'}/settings`));
  }

  createToken(name: string, expiresInDays: number, admin = false): Promise<IntegrationTokenCreatedDto> {
    return firstValueFrom(this.http.post<IntegrationTokenCreatedDto>(`${this.apiBaseUrl}/${admin ? 'admin/client-api' : 'integrations'}/tokens`, {
      name: name.trim(),
      expiresInDays
    }));
  }

  revokeToken(tokenId: string, admin = false): Promise<void> {
    return firstValueFrom(this.http.delete<void>(
      `${this.apiBaseUrl}/${admin ? 'admin/client-api' : 'integrations'}/tokens/${encodeURIComponent(tokenId.trim())}`
    ));
  }

}
