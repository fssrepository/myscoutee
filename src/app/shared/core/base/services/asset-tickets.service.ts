import { Injectable, inject } from '@angular/core';

import { LocalAssetTicketsService } from '../../local/source/services/asset-tickets.service';
import { HttpAssetTicketsService } from '../../http/services/asset-tickets.service';
import { BaseRouteModeService } from './base-route-mode.service';

import type * as AssetContracts from '../../contracts/asset.interface';
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

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    return this.assetTicketsService.queryTicketPage(query);
  }
}
