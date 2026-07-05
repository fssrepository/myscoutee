import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import {
  ASSET_REQUESTS_TABLE_NAME,
  type AssetAvailabilityDateRangeRecord,
  type AssetAvailabilityFilterRecord,
  type AssetAvailabilityRecordPageQuery,
  type AssetAvailabilityRecordPageResult,
  type AssetAvailabilityStatRecordPageQuery,
  type AssetAvailabilityStatRecordPageResult,
  type AssetRequestRecord,
  type AssetRequestsRecordCollection
} from '../entity/asset.entity';

@Injectable({
  providedIn: 'root'
})
export class LocalAssetRequestsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  queryRecordsByOwner(ownerUserId: string, assetId: string): AssetRequestRecord[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedOwnerUserId || !normalizedAssetId) {
      return [];
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ASSET_REQUESTS_TABLE_NAME]);
    return (table.idsByOwnerKey[this.ownerKey(normalizedAssetId)] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is AssetRequestRecord =>
        Boolean(record)
        && record.assetId === normalizedAssetId
        && record.ownerUserId === normalizedOwnerUserId)
      .map(record => this.cloneRecord(record));
  }

  queryAssetAvailabilityRecordPage(query: AssetAvailabilityRecordPageQuery): AssetAvailabilityRecordPageResult {
    const requests = this.queryRecordsByOwner(query.userId, query.assetId);
    const filter = this.normalizeAvailabilityFilter(query.filter);
    const dateRange = this.availabilityDateRange(query.dateIso);
    const filtered = requests
      .filter(request => this.matchesAvailabilityFilter(request, filter))
      .filter(request => !dateRange || this.assetRequestDateRangeOverlaps(request, dateRange.start, dateRange.end))
      .sort((left, right) => this.compareAvailabilityRequests(left, right));
    const page = this.slicePage(filtered, query.page, query.pageSize, query.cursor);
    return {
      records: page.items.map(request => ({
        request,
        requests,
        dateRange
      })),
      total: filtered.length,
      nextCursor: page.nextCursor
    };
  }

  queryAssetAvailabilityStatRecordPage(query: AssetAvailabilityStatRecordPageQuery): AssetAvailabilityStatRecordPageResult {
    const normalizedOwnerUserId = query.userId.trim();
    const normalizedAssetId = query.assetId.trim();
    if (!normalizedOwnerUserId || !normalizedAssetId) {
      return {
        records: [],
        total: 0,
        nextCursor: null
      };
    }
    const requests = this.queryRecordsByOwner(normalizedOwnerUserId, normalizedAssetId);
    const filter = this.normalizeAvailabilityFilter(query.filter);
    const filteredRequests = requests.filter(request => this.matchesAvailabilityFilter(request, filter));
    const range = this.availabilityStatsRange(query.rangeStart, query.rangeEnd);
    const assetCapacity = this.resolveAssetCapacity(requests);
    const dates: Date[] = [];
    for (let cursor = new Date(range.start); cursor.getTime() <= range.end.getTime(); cursor = AppUtils.addDays(cursor, 1)) {
      dates.push(new Date(cursor));
    }
    const page = this.slicePage(dates, query.page, query.pageSize, query.cursor);
    return {
      records: page.items.map(date => ({
        assetId: normalizedAssetId,
        ownerUserId: normalizedOwnerUserId,
        assetCapacity,
        date,
        requests: filteredRequests
      })),
      total: dates.length,
      nextCursor: page.nextCursor
    };
  }

  private normalizeAvailabilityFilter(filter: AssetAvailabilityFilterRecord | null | undefined): AssetAvailabilityFilterRecord {
    return filter === 'active-items' || filter === 'pending-requests' || filter === 'borrowed-items'
      ? filter
      : 'all';
  }

  private matchesAvailabilityFilter(
    request: AssetRequestRecord,
    filter: AssetAvailabilityFilterRecord
  ): boolean {
    if (filter === 'pending-requests') {
      return this.isPendingAvailabilityRequest(request);
    }
    if (filter === 'borrowed-items') {
      return request.status === 'accepted' && request.requestKind !== 'manual';
    }
    if (filter === 'active-items') {
      return this.isCommittedAvailabilityRequest(request);
    }
    return true;
  }

  private compareAvailabilityRequests(left: AssetRequestRecord, right: AssetRequestRecord): number {
    return this.availabilityBucketOrder(left) - this.availabilityBucketOrder(right)
      || this.availabilityRequestSortTime(right) - this.availabilityRequestSortTime(left)
      || left.id.localeCompare(right.id);
  }

  private availabilityBucketOrder(request: AssetRequestRecord): number {
    if (this.isPendingAvailabilityRequest(request)) {
      return 0;
    }
    if (request.status === 'accepted' && request.requestKind !== 'manual') {
      return 1;
    }
    return 2;
  }

  private availabilityRequestSortTime(request: AssetRequestRecord): number {
    return this.assetRequestDateRange(request)?.start.getTime()
      ?? this.parseAvailabilityDate(request.requestedAtIso)?.getTime()
      ?? 0;
  }

  private assetRequestDateRangeOverlaps(request: AssetRequestRecord, start: Date, end: Date): boolean {
    const range = this.assetRequestDateRange(request);
    return range
      ? range.start.getTime() < end.getTime() && start.getTime() < range.end.getTime()
      : false;
  }

  private assetRequestDateRange(request: AssetRequestRecord): AssetAvailabilityDateRangeRecord | null {
    const start = this.parseAvailabilityDate(request.booking?.startAtIso ?? request.requestedAtIso);
    if (!start) {
      return null;
    }
    const parsedEnd = this.parseAvailabilityDate(request.booking?.endAtIso);
    const end = parsedEnd && parsedEnd.getTime() > start.getTime()
      ? parsedEnd
      : AppUtils.addDays(start, 1);
    return { start, end };
  }

  private availabilityDateRange(dateIso: string | null | undefined): AssetAvailabilityDateRangeRecord | null {
    const parsed = AppUtils.parseDateOnlyLocal(`${dateIso ?? ''}`.trim());
    if (!parsed) {
      return null;
    }
    return {
      start: parsed,
      end: AppUtils.addDays(parsed, 1)
    };
  }

  private availabilityStatsRange(
    rangeStart: string | null | undefined,
    rangeEnd: string | null | undefined
  ): AssetAvailabilityDateRangeRecord {
    const fallback = AppUtils.dateOnly(new Date());
    const start = AppUtils.parseDateOnlyLocal(`${rangeStart ?? ''}`.trim()) ?? AppUtils.startOfMonth(fallback);
    const end = AppUtils.parseDateOnlyLocal(`${rangeEnd ?? ''}`.trim()) ?? AppUtils.endOfMonth(start);
    if (end.getTime() < start.getTime()) {
      return { start: end, end: start };
    }
    return { start, end };
  }

  private parseAvailabilityDate(value: string | null | undefined): Date | null {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    return AppUtils.isoLocalDateTimeToDate(normalized) ?? AppUtils.parseDate(normalized);
  }

  private isCommittedAvailabilityRequest(request: AssetRequestRecord): boolean {
    return request.status === 'accepted' || request.requestKind === 'manual';
  }

  private isPendingAvailabilityRequest(request: AssetRequestRecord): boolean {
    return request.status === 'pending' && request.requestKind !== 'manual';
  }

  private resolveAssetCapacity(requests: readonly AssetRequestRecord[]): number {
    return requests
      .map(request => Math.max(0, Math.trunc(Number(request.assetCapacity) || 0)))
      .find(capacity => capacity > 0) ?? 0;
  }

  private slicePage<T>(
    items: readonly T[],
    rawPage: number | null | undefined,
    rawPageSize: number | null | undefined,
    rawCursor: string | null | undefined
  ): { items: T[]; nextCursor: string | null } {
    const total = items.length;
    const pageSize = Math.max(1, Math.trunc(Number(rawPageSize) || 20));
    const cursorOffset = this.parseCursor(rawCursor);
    const page = Math.max(0, Math.trunc(Number(rawPage) || 0));
    const start = Math.min(total, cursorOffset ?? (page * pageSize));
    const end = Math.min(total, start + pageSize);
    return {
      items: items.slice(start, end),
      nextCursor: end < total ? `${end}` : null
    };
  }

  private parseCursor(cursor: string | null | undefined): number | null {
    const value = Math.trunc(Number(`${cursor ?? ''}`.trim()));
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  private normalizeCollection(value: unknown): AssetRequestsRecordCollection {
    const raw = value as Partial<AssetRequestsRecordCollection> | null | undefined;
    return {
      byId: raw?.byId && typeof raw.byId === 'object'
        ? { ...(raw.byId as Record<string, AssetRequestRecord>) }
        : {},
      ids: Array.isArray(raw?.ids) ? raw.ids.map(id => String(id)).filter(Boolean) : [],
      idsByOwnerKey: this.cloneOwnerKeyIndex(raw?.idsByOwnerKey)
    };
  }

  private cloneOwnerKeyIndex(index: Record<string, readonly string[] | string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      if (!ownerKey.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerKey] = ids.map(id => String(id)).filter(Boolean);
    }
    return next;
  }

  private cloneRecord(record: AssetRequestRecord): AssetRequestRecord {
    return {
      ...record,
      booking: record.booking
        ? {
            ...record.booking,
            acceptedPolicyIds: [...(record.booking.acceptedPolicyIds ?? [])]
          }
        : null,
      menuActions: [...(record.menuActions ?? [])]
    };
  }

  private ownerKey(assetId: string): string {
    return `asset:${assetId.trim()}`;
  }
}
