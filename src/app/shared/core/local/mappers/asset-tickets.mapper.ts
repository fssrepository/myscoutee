import type * as AppTypes from '../../../core/base/models';
import { toActivityEventRow } from '../../base/converters/activities-event.converter';
import type { ActivityEventRecord } from '../../base/models/events.model';

export class LocalAssetTicketsMapper {
  static toTicketRows(records: readonly ActivityEventRecord[]): AppTypes.ActivityListRow[] {
    return this.cloneRows(records
      .filter(record => !record.isInvitation)
      .filter(record => !record.isTrashed)
      .filter(record => record.ticketing === true)
      .map(record => toActivityEventRow(record)));
  }

  static pageRows(
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

  static cloneRows(rows: readonly AppTypes.ActivityListRow[]): AppTypes.ActivityListRow[] {
    return rows.map(row => ({ ...row }));
  }

  private static matchesTicketOrder(row: AppTypes.ActivityListRow, order: AppTypes.AssetTicketOrder): boolean {
    const isPast = this.resolveTicketEndTimestamp(row) < Date.now();
    return order === 'past' ? isPast : !isPast;
  }

  private static resolveTicketEndTimestamp(row: AppTypes.ActivityListRow): number {
    const endAtMs = this.toSortableDate(row.endAt ?? '');
    if (endAtMs > 0) {
      return endAtMs;
    }
    return this.toSortableDate(row.dateIso);
  }

  private static toSortableDate(dateIso: string): number {
    const parsed = new Date(dateIso);
    const value = parsed.getTime();
    return Number.isNaN(value) ? 0 : value;
  }
}
