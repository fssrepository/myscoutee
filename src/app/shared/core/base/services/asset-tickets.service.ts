import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoAssetTicketsService } from '../../demo/services/asset-tickets.service';
import { HttpAssetTicketsService } from '../../http/services/asset-tickets.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class AssetTicketsService extends BaseRouteModeService {
  private readonly demoAssetTicketsService = inject(DemoAssetTicketsService);
  private readonly httpAssetTicketsService = inject(HttpAssetTicketsService);


  private get assetTicketsService(): DemoAssetTicketsService | HttpAssetTicketsService {
    return this.resolveRouteService('/assets/tickets', this.demoAssetTicketsService, this.httpAssetTicketsService);
  }

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsService.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return this.assetTicketsService.queryTicketPage(query);
  }
}
