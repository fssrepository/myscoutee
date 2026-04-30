import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoShareTokensService } from '../../demo/services/share-tokens.service';
import { HttpShareTokensService } from '../../http/services/share-tokens.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ShareTokensService extends BaseRouteModeService {
  private readonly demoShareTokensService = inject(DemoShareTokensService);
  private readonly httpShareTokensService = inject(HttpShareTokensService);

  private get shareTokensService(): DemoShareTokensService | HttpShareTokensService {
    return this.resolveRouteService('/share-tokens', this.demoShareTokensService, this.httpShareTokensService);
  }

  createToken(request: AppTypes.ShareTokenCreateRequest): Promise<string> {
    return this.shareTokensService.createToken(request);
  }

  resolveToken(token: string, userId: string): Promise<AppTypes.ShareTokenResolvedItem | null> {
    return this.shareTokensService.resolveToken(token, userId);
  }
}
