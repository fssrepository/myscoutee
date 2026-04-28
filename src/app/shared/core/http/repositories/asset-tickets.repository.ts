import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { toActivityEventRow } from '../../base/converters/activities-event.converter';
import { OfflineCacheService } from '../../base/services/offline-cache.service';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetTicketsRepository {
  private readonly http = inject(HttpClient);
  private readonly offlineCache = inject(OfflineCacheService);
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
      this.offlineCache.writeTicketPage(normalizedUserId, query.order, {
        items: rows,
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : rows.length
      });
      return {
        items: this.cloneRows(rows),
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : rows.length
      };
    } catch {
      const cachedPage = this.offlineCache.readTicketPage(normalizedUserId, query.order);
      if (cachedPage) {
        this.cachedRowsByUserId[normalizedUserId] = this.cloneRows(cachedPage.items);
        return this.pageRows(cachedPage.items, query);
      }
      return this.pageRows(this.peekTicketRowsByUser(normalizedUserId), query);
    }
  }

  protected peekTicketRowsByUser(userId: string): AppTypes.ActivityListRow[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const cachedRows = this.cachedRowsByUserId[normalizedUserId];
    if (cachedRows && cachedRows.length > 0) {
      return this.cloneRows(cachedRows);
    }
    const offlineRows = this.offlineCache.readTicketPage(normalizedUserId, 'upcoming')?.items
      ?? this.offlineCache.readTicketPage(normalizedUserId, 'past')?.items
      ?? [];
    if (offlineRows.length > 0) {
      this.cachedRowsByUserId[normalizedUserId] = this.cloneRows(offlineRows);
    }
    return this.cloneRows(offlineRows);
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
    const visibleRows = orderedRows.filter(row => this.matchesTicketOrder(row, query.order));
    if (query.order === 'past') {
      visibleRows.reverse();
    }
    const startIndex = page * pageSize;
    return {
      items: this.cloneRows(visibleRows.slice(startIndex, startIndex + pageSize)),
      total: visibleRows.length
    };
  }

  protected cloneRows(rows: readonly AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
    return rows.map(row => ({ ...row }));
  }

  private matchesTicketOrder(row: AppTypes.ActivityListRow, order: AppTypes.AssetTicketOrder): boolean {
    const isPast = this.resolveTicketEndTimestamp(row) < Date.now();
    return order === 'past' ? isPast : !isPast;
  }

  private resolveTicketEndTimestamp(row: AppTypes.ActivityListRow): number {
    const source = row.source as { endAt?: string | null | undefined };
    const endAtMs = this.toSortableDate(source.endAt ?? '');
    if (endAtMs > 0) {
      return endAtMs;
    }
    return this.toSortableDate(row.dateIso);
  }

  private toSortableDate(dateIso: string): number {
    const parsed = new Date(dateIso);
    const value = parsed.getTime();
    return Number.isNaN(value) ? 0 : value;
  }
}
