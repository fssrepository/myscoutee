import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { HttpAssetTicketsRepository } from '../repositories/asset-tickets.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetTicketsService {
  private readonly assetTicketsRepository = inject(HttpAssetTicketsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsRepository.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return this.assetTicketsRepository.queryTicketPage(query);
  }
}
