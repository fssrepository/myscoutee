import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { LocalAssetTicketsService } from '../../local/services/asset-tickets.service';
import { HttpAssetTicketsService } from '../../http/services/asset-tickets.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class AssetTicketsService extends BaseRouteModeService {
  private readonly localAssetTicketsService = inject(LocalAssetTicketsService);
  private readonly httpAssetTicketsService = inject(HttpAssetTicketsService);


  private get assetTicketsService(): LocalAssetTicketsService | HttpAssetTicketsService {
    return this.resolveRouteService('/assets/tickets', this.localAssetTicketsService, this.httpAssetTicketsService);
  }

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsService.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return this.assetTicketsService.queryTicketPage(query);
  }
}
