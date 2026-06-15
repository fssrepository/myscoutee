import { Injectable, inject } from '@angular/core';

import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../contracts/share.interface';
import { LocalShareTokensService } from '../../local/source/services/share-tokens.service';
import { HttpShareTokensService } from '../../http/services/share-tokens.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ShareTokensService extends BaseRouteModeService {
  private readonly localShareTokensService = inject(LocalShareTokensService);
  private readonly httpShareTokensService = inject(HttpShareTokensService);

  private get shareTokensService(): LocalShareTokensService | HttpShareTokensService {
    return this.resolveRouteService('/share-tokens', this.localShareTokensService, this.httpShareTokensService);
  }

  createToken(request: ShareTokenCreateRequest): Promise<string> {
    return this.shareTokensService.createToken(request);
  }

  resolveToken(token: string, userId: string): Promise<ShareTokenResolvedItem | null> {
    return this.shareTokensService.resolveToken(token, userId);
  }
}
