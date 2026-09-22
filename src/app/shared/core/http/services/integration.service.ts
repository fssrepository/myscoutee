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
