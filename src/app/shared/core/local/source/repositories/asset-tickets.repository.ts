import { Injectable, inject } from '@angular/core';

import { LocalEventsRepository } from './events.repository';
import { LocalAssetTicketsMapper } from '../mappers/asset.mapper';

import type * as AssetContracts from '../../../contracts/asset.interface';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsRepository {
  private readonly eventsRepository = inject(LocalEventsRepository);

  peekTicketCountByUser(userId: string): number {
    return LocalAssetTicketsMapper.toTicketDTOs(this.ticketRecordsByUser(userId)).length;
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    return LocalAssetTicketsMapper.pageRows(
      LocalAssetTicketsMapper.toTicketDTOs(this.ticketRecordsByUser(query.userId)),
      query
    );
  }

  private ticketRecordsByUser(userId: string) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return [
      ...this.eventsRepository.queryEventItemsByUser(normalizedUserId),
      ...this.eventsRepository.queryHostingItemsByUser(normalizedUserId)
    ];
  }
}
