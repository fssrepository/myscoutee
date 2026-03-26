import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { toActivityEventRow } from '../../base/converters/activities-event.converter';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetTicketsRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
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
      const response = await this.http
        .get<{ records?: DemoEventRecord[]; total?: number } | null>(`${this.apiBaseUrl}/assets/tickets`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('page', String(Math.max(0, Math.trunc(Number(query.page) || 0))))
            .set('pageSize', String(Math.max(1, Math.trunc(Number(query.pageSize) || 1))))
            .set('order', query.order)
        })
        .toPromise();
      const rows = this.buildTicketRows(response?.records ?? []);
      this.cachedRowsByUserId[normalizedUserId] = rows;
      return {
        items: this.cloneRows(rows),
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : rows.length
      };
    } catch {
      return this.pageRows(this.peekTicketRowsByUser(normalizedUserId), query);
    }
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
