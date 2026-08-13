import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type * as AssetContracts from '../../contracts/asset.interface';
import type * as AppConstants from '../../common/constants';
import { OfflineCacheService } from '../../base/services/offline-cache.service';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetTicketsService {
  private readonly http = inject(HttpClient);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRowsByUserId: Record<string, AssetContracts.AssetTicketDTO[]> = {};

  peekTicketCountByUser(userId: string): number {
    return this.peekTicketRowsByUser(userId).length;
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0
      };
    }

    try {
      const response = await this.http
        .get<AssetContracts.AssetTicketPageResultDTO | null>(`${this.apiBaseUrl}/assets/tickets`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('page', String(Math.max(0, Math.trunc(Number(query.page) || 0))))
            .set('pageSize', String(Math.max(1, Math.trunc(Number(query.pageSize) || 1))))
            .set('order', query.order)
        })
        .toPromise();
      const rows = this.cloneRows(response?.items ?? []);
      const total = Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : rows.length;
      this.cachedRowsByUserId[normalizedUserId] = rows;
      this.offlineCache.writeTicketPage(normalizedUserId, query.order, {
        items: rows,
        total
      });
      return {
        items: this.cloneRows(rows),
        total
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

  async syncTickets(
    request: AssetContracts.AssetTicketSyncRequestDTO,
    signal?: AbortSignal
  ): Promise<AssetContracts.AssetTicketSyncResultDTO> {
    const normalizedUserId = request.userId.trim();
    if (!normalizedUserId || signal?.aborted) {
      return { upserts: [], removedIds: [], total: 0 };
    }
    try {
      const response = await firstValueFrom(this.http.post<AssetContracts.AssetTicketSyncResultDTO | null>(
        `${this.apiBaseUrl}/assets/tickets/sync`,
        {
          userId: normalizedUserId,
          order: request.order,
          limit: Math.max(1, Math.trunc(Number(request.limit) || 18)),
          knownItems: request.knownItems.map(item => ({
            id: `${item.id}`.trim(),
            revision: `${item.revision}`
          })),
          loadedTail: request.loadedTail
            ? {
                id: `${request.loadedTail.id}`.trim(),
                dateIso: `${request.loadedTail.dateIso}`.trim()
              }
            : null
        }
      ));
      if (signal?.aborted) {
        return { upserts: [], removedIds: [], total: 0 };
      }
      const result = {
        upserts: this.cloneRows(response?.upserts ?? []),
        removedIds: (response?.removedIds ?? []).map(id => `${id}`.trim()).filter(Boolean),
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0
      };
      this.applySyncCache(normalizedUserId, request.order, result);
      return {
        upserts: this.cloneRows(result.upserts),
        removedIds: [...result.removedIds],
        total: result.total
      };
    } catch {
      const cachedRows = this.offlineCache.readTicketPage(normalizedUserId, request.order)?.items
        ?? this.peekTicketRowsByUser(normalizedUserId);
      return this.syncFromRows(cachedRows, request);
    }
  }

  async validateTicket(
    request: AssetContracts.AssetTicketValidationRequestDTO
  ): Promise<AssetContracts.AssetTicketValidationDTO> {
    const response = await firstValueFrom(this.http.post<AssetContracts.AssetTicketValidationDTO>(
      `${this.apiBaseUrl}/assets/tickets/validate`,
      {
        code: request.code.trim(),
        userId: request.userId.trim()
      }
    ));
    if (!response) {
      throw new Error('Ticket validation returned an empty response.');
    }
    return response;
  }

  private peekTicketRowsByUser(userId: string): AssetContracts.AssetTicketDTO[] {
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

  private pageRows(
    rows: readonly AssetContracts.AssetTicketDTO[],
    query: AssetContracts.AssetTicketPageQueryDTO
  ): AssetContracts.AssetTicketPageResultDTO {
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

  private cloneRows(rows: readonly AssetContracts.AssetTicketDTO[]): AssetContracts.AssetTicketDTO[] {
    return rows.map(row => ({ ...row }));
  }

  private applySyncCache(
    userId: string,
    order: AppConstants.AssetTicketOrder,
    result: AssetContracts.AssetTicketSyncResultDTO
  ): void {
    const removedIds = new Set(result.removedIds);
    const rowsById = new Map(
      this.peekTicketRowsByUser(userId)
        .filter(row => !removedIds.has(this.ticketIdentity(row)))
        .map(row => [this.ticketIdentity(row), row])
    );
    for (const row of result.upserts) {
      rowsById.set(this.ticketIdentity(row), { ...row });
    }
    const rows = [...rowsById.values()]
      .filter(row => this.matchesTicketOrder(row, order))
      .sort((left, right) => this.compareTicketRows(left, right, order));
    this.cachedRowsByUserId[userId] = this.cloneRows(rows);
    this.offlineCache.writeTicketPage(userId, order, {
      items: this.cloneRows(rows),
      total: result.total
    });
  }

  private syncFromRows(
    sourceRows: readonly AssetContracts.AssetTicketDTO[],
    request: AssetContracts.AssetTicketSyncRequestDTO
  ): AssetContracts.AssetTicketSyncResultDTO {
    const rows = sourceRows
      .filter(row => this.matchesTicketOrder(row, request.order))
      .sort((left, right) => this.compareTicketRows(left, right, request.order));
    const currentById = new Map(rows.map(row => [this.ticketIdentity(row), row]));
    const knownRevisions = new Map(request.knownItems.map(item => [item.id.trim(), `${item.revision}`]));
    const removedIds = [...knownRevisions.keys()].filter(id => !currentById.has(id));
    const limit = Math.max(1, Math.trunc(Number(request.limit) || 18));
    const tailId = `${request.loadedTail?.id ?? ''}`.trim();
    const tailIndex = tailId ? rows.findIndex(row => this.ticketIdentity(row) === tailId) : -1;
    const windowLimit = tailIndex >= 0
      ? Math.max(request.knownItems.length + limit, tailIndex + 1 + limit)
      : (request.knownItems.length > 0 ? request.knownItems.length + limit : limit);
    const upsertsById = new Map<string, AssetContracts.AssetTicketDTO>();
    for (const row of rows.slice(0, windowLimit)) {
      const id = this.ticketIdentity(row);
      if (knownRevisions.get(id) !== this.ticketRevision(row)) {
        upsertsById.set(id, row);
      }
    }
    return {
      upserts: this.cloneRows([...upsertsById.values()]),
      removedIds,
      total: rows.length
    };
  }

  private ticketIdentity(row: AssetContracts.AssetTicketDTO): string {
    return `${row.type}:${row.id}`;
  }

  private ticketRevision(row: AssetContracts.AssetTicketDTO): string {
    return `${row.revision ?? ''}`.trim() || [
      row.scanCode,
      row.status,
      row.usedAtIso,
      row.issuedAtIso,
      row.title,
      row.subtitle,
      row.detail,
      row.dateIso,
      row.startAt,
      row.endAt,
      row.imageUrl,
      row.visibility
    ].map(value => `${value ?? ''}`).join('\u001f');
  }

  private compareTicketRows(
    left: AssetContracts.AssetTicketDTO,
    right: AssetContracts.AssetTicketDTO,
    order: AppConstants.AssetTicketOrder
  ): number {
    const comparison = this.toSortableDate(left.dateIso) - this.toSortableDate(right.dateIso)
      || this.ticketIdentity(left).localeCompare(this.ticketIdentity(right));
    return order === 'past' ? -comparison : comparison;
  }

  private matchesTicketOrder(row: AssetContracts.AssetTicketDTO, order: AppConstants.AssetTicketOrder): boolean {
    const isPast = this.resolveTicketEndTimestamp(row) < Date.now();
    return order === 'past' ? isPast : !isPast;
  }

  private resolveTicketEndTimestamp(row: AssetContracts.AssetTicketDTO): number {
    const endAtMs = this.toSortableDate(row.endAt ?? '');
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
