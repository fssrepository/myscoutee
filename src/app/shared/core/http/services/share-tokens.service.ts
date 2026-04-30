import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';

interface ShareTokenCreateResponseDto {
  token?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpShareTokensService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async createToken(request: AppTypes.ShareTokenCreateRequest): Promise<string> {
    const response = await this.http
      .post<ShareTokenCreateResponseDto | null>(`${this.apiBaseUrl}/share-tokens`, request)
      .toPromise();
    return `${response?.token ?? ''}`.trim();
  }

  async resolveToken(token: string, userId: string): Promise<AppTypes.ShareTokenResolvedItem | null> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }
    return await this.http
      .get<AppTypes.ShareTokenResolvedItem | null>(`${this.apiBaseUrl}/share-tokens/resolve`, {
        params: new HttpParams()
          .set('token', normalizedToken)
          .set('userId', `${userId ?? ''}`.trim())
      })
      .toPromise() ?? null;
  }
}
