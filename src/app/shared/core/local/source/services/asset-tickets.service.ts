import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../base/models';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalAssetTicketsRepository } from '../repositories/asset-tickets.repository';

import type * as AppDTOs from '../../../base/dto';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsService extends LocalRouteDelayService {
  private static readonly ASSET_TICKETS_ROUTE = '/assets/tickets';
  private readonly assetTicketsRepository = inject(LocalAssetTicketsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsRepository.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppDTOs.AssetTicketPageQueryDTO): Promise<AppDTOs.AssetTicketPageResultDTO> {
    await this.waitForRouteDelay(LocalAssetTicketsService.ASSET_TICKETS_ROUTE);
    return this.assetTicketsRepository.queryTicketPage(query);
  }

}
