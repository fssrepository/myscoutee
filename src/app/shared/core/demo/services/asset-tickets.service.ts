import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoAssetTicketsRepository } from '../repositories/asset-tickets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetTicketsService extends DemoRouteDelayService {
  private static readonly ASSET_TICKETS_ROUTE = '/assets/tickets';
  private readonly assetTicketsRepository = inject(DemoAssetTicketsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsRepository.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    await this.waitForRouteDelay(DemoAssetTicketsService.ASSET_TICKETS_ROUTE);
    return this.assetTicketsRepository.queryTicketPage(query);
  }

}
