import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoEventsRepository } from './events.repository';
import { HttpAssetTicketsRepository } from '../../http/repositories/asset-tickets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetTicketsRepository extends HttpAssetTicketsRepository {
  private readonly eventsRepository = inject(DemoEventsRepository);

  override peekTicketCountByUser(userId: string): number {
    return this.buildTicketRows(this.ticketRecordsByUser(userId)).length;
  }

  override async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return this.pageRows(this.buildTicketRows(this.ticketRecordsByUser(query.userId)), query);
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
