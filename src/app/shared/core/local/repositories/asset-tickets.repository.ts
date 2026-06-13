import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { LocalEventsRepository } from './events.repository';
import { LocalAssetTicketsMapper } from '../mappers/asset.mapper';

@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsRepository {
  private readonly eventsRepository = inject(LocalEventsRepository);

  peekTicketCountByUser(userId: string): number {
    return LocalAssetTicketsMapper.toTicketRows(this.ticketRecordsByUser(userId)).length;
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return LocalAssetTicketsMapper.pageRows(
      LocalAssetTicketsMapper.toTicketRows(this.ticketRecordsByUser(query.userId)),
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
