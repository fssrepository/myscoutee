import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoAssetTicketsRepository } from '../repositories/asset-tickets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetTicketsService {
  private static readonly ASSET_TICKETS_ROUTE = '/assets/tickets';
  private readonly assetTicketsRepository = inject(DemoAssetTicketsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsRepository.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    await this.waitForRouteDelay();
    return this.assetTicketsRepository.queryTicketPage(query);
  }

  private async waitForRouteDelay(): Promise<void> {
    const delayMs = resolveAdditionalDelayMsForRoute(DemoAssetTicketsService.ASSET_TICKETS_ROUTE);
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }
}
