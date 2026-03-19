import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { toActivityEventRow } from '../../base/converters/activities-event.converter';
import { HttpEventsService } from '../services/events.service';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetTicketsRepository {
  private readonly httpEventsService = inject(HttpEventsService);
  private readonly cachedRowsByUserId: Record<string, AppTypes.ActivityListRow[]> = {};

  peekTicketCountByUser(userId: string): number {
    return this.peekTicketRowsByUser(userId).length;
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0
      };
    }

    try {
      const [eventRecords, hostingRecords] = await Promise.all([
        this.httpEventsService.queryEventItemsByUser(normalizedUserId),
        this.httpEventsService.queryHostingItemsByUser(normalizedUserId)
      ]);
      this.cachedRowsByUserId[normalizedUserId] = this.buildTicketRows([
        ...eventRecords,
        ...hostingRecords
      ]);
    } catch {
      // Fall back to the latest cached snapshot until dedicated endpoints land.
    }

    return this.pageRows(this.peekTicketRowsByUser(normalizedUserId), query);
  }

  protected peekTicketRowsByUser(userId: string): AppTypes.ActivityListRow[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneRows(this.cachedRowsByUserId[normalizedUserId] ?? []);
  }

  protected buildTicketRows(records: readonly DemoEventRecord[]): AppTypes.ActivityListRow[] {
    return this.cloneRows(records
      .filter(record => !record.isInvitation)
      .filter(record => !record.isTrashed)
      .filter(record => record.ticketing === true)
      .map(record => toActivityEventRow(record)));
  }

  protected pageRows(
    rows: readonly AppTypes.ActivityListRow[],
    query: AppTypes.AssetTicketPageQuery
  ): AppTypes.AssetTicketPageResult {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const orderedRows = [...rows].sort((left, right) => this.toSortableDate(left.dateIso) - this.toSortableDate(right.dateIso));
    const visibleRows = query.order === 'upcoming' ? orderedRows.reverse() : orderedRows;
    const startIndex = page * pageSize;
    return {
      items: this.cloneRows(visibleRows.slice(startIndex, startIndex + pageSize)),
      total: visibleRows.length
    };
  }

  protected cloneRows(rows: readonly AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
    return rows.map(row => ({ ...row }));
  }

  private toSortableDate(dateIso: string): number {
    const parsed = new Date(dateIso);
    const value = parsed.getTime();
    return Number.isNaN(value) ? 0 : value;
  }
}
