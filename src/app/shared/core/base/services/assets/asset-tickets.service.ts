import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type * as AssetContracts from '../../../contracts/assets/asset.interface';
@Injectable({
  providedIn: 'root'
})
export class AssetTicketsService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localAssetTicketsService = this.transportAdapters.reference(LOCAL_ADAPTER.ASSET_TICKETS);
  private readonly httpAssetTicketsService = this.transportAdapters.reference(HTTP_ADAPTER.ASSET_TICKETS);

  private get assetTicketsService(): AdapterInstance<typeof LOCAL_ADAPTER.ASSET_TICKETS> | AdapterInstance<typeof HTTP_ADAPTER.ASSET_TICKETS> {
    return this.resolveRouteService('/assets/tickets', this.localAssetTicketsService, this.httpAssetTicketsService);
  }

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsService.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    return this.assetTicketsService.queryTicketPage(query);
  }

  async syncTickets(
    request: AssetContracts.AssetTicketSyncRequestDTO,
    signal?: AbortSignal
  ): Promise<AssetContracts.AssetTicketSyncResultDTO> {
    return this.assetTicketsService.syncTickets(request, signal);
  }

  async validateTicket(
    request: AssetContracts.AssetTicketValidationRequestDTO
  ): Promise<AssetContracts.AssetTicketValidationDTO> {
    return this.assetTicketsService.validateTicket(request);
  }
}
