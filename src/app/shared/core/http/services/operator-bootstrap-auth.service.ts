import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  OperatorBootstrapAuthRequestDto,
  OperatorBootstrapAuthResponseDto
} from '../../contracts/user.interface';

const OPERATOR_BOOTSTRAP_AUTH_ROUTE = '/auth/operator-bootstrap';

@Injectable({
  providedIn: 'root'
})
export class HttpOperatorBootstrapAuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = (environment.apiBaseUrl ?? '/api').replace(/\/+$/, '');

  async signIn(
    request: OperatorBootstrapAuthRequestDto
  ): Promise<OperatorBootstrapAuthResponseDto> {
    const response = await firstValueFrom(
      this.http.post<OperatorBootstrapAuthResponseDto>(
        `${this.apiBaseUrl}${OPERATOR_BOOTSTRAP_AUTH_ROUTE}`,
        request
      )
    );
    const accessToken = `${response?.accessToken ?? ''}`.trim();
    const email = `${response?.email ?? ''}`.trim();
    const expiresAt = `${response?.expiresAt ?? ''}`.trim();
    if (
      response?.tokenType !== 'OperatorBootstrap'
      || !accessToken
      || !email
      || !Number.isFinite(Date.parse(expiresAt))
    ) {
      throw new Error('operator.bootstrap.auth.response.invalid');
    }
    return {
      tokenType: 'OperatorBootstrap',
      accessToken,
      email,
      expiresAt
    };
  }
}
