import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../contracts/share.interface';

interface ShareTokenCreateResponseDto {
  token?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpShareTokensService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async createToken(request: ShareTokenCreateRequest): Promise<string> {
    const response = await this.http
      .post<ShareTokenCreateResponseDto | null>(`${this.apiBaseUrl}/share-tokens`, request)
      .toPromise();
    return `${response?.token ?? ''}`.trim();
  }

  async resolveToken(token: string, userId: string): Promise<ShareTokenResolvedItem | null> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }
    return await this.http
      .get<ShareTokenResolvedItem | null>(`${this.apiBaseUrl}/share-tokens/resolve`, {
        params: new HttpParams()
          .set('token', normalizedToken)
          .set('userId', `${userId ?? ''}`.trim())
      })
      .toPromise() ?? null;
  }
}
