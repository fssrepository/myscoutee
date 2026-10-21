import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../../contracts/content/share.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ShareTokensService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localShareTokensService = this.transportAdapters.reference(LOCAL_ADAPTER.SHARE_TOKENS);
  private readonly httpShareTokensService = this.transportAdapters.reference(HTTP_ADAPTER.SHARE_TOKENS);

  private get shareTokensService(): AdapterInstance<typeof LOCAL_ADAPTER.SHARE_TOKENS> | AdapterInstance<typeof HTTP_ADAPTER.SHARE_TOKENS> {
    return this.resolveRouteService('/share-tokens', this.localShareTokensService, this.httpShareTokensService);
  }

  createToken(request: ShareTokenCreateRequest): Promise<string> {
    return this.shareTokensService.createToken(request);
  }

  resolveToken(token: string, userId: string): Promise<ShareTokenResolvedItem | null> {
    return this.shareTokensService.resolveToken(token, userId);
  }
}
