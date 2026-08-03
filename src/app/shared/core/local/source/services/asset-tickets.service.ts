import { Injectable, inject } from '@angular/core';

import { LocalRouteDelayService } from './route-delay.service';
import { LocalAssetTicketsRepository } from '../repositories/asset-tickets.repository';

import type * as AssetContracts from '../../../contracts/asset.interface';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsService extends LocalRouteDelayService {
  private static readonly ASSET_TICKETS_ROUTE = '/assets/tickets';
  private static readonly ASSET_TICKET_VALIDATION_ROUTE = '/assets/tickets/validate';
  private readonly assetTicketsRepository = inject(LocalAssetTicketsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsRepository.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    await this.waitForRouteDelay(LocalAssetTicketsService.ASSET_TICKETS_ROUTE);
    return this.assetTicketsRepository.queryTicketPage(query);
  }

  async validateTicket(
    request: AssetContracts.AssetTicketValidationRequestDTO
  ): Promise<AssetContracts.AssetTicketValidationDTO> {
    await this.waitForRouteDelay(LocalAssetTicketsService.ASSET_TICKET_VALIDATION_ROUTE);
    return this.assetTicketsRepository.validateTicket(request);
  }

}
