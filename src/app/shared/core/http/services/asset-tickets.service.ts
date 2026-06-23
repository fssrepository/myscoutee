import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { ActivityEventDtoMapper } from '../../base/mappers/activity-event.mapper';
import type * as ActivityContracts from '../../contracts/activity.interface';
import type * as AssetContracts from '../../contracts/asset.interface';
import { OfflineCacheService } from '../../base/services/offline-cache.service';

import type * as AppConstants from '../../common/constants';
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
        .get<{ records?: ActivityContracts.ActivityEventRecord[]; total?: number } | null>(`${this.apiBaseUrl}/assets/tickets`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('page', String(Math.max(0, Math.trunc(Number(query.page) || 0))))
            .set('pageSize', String(Math.max(1, Math.trunc(Number(query.pageSize) || 1))))
            .set('order', query.order)
        })
        .toPromise();
      const rows = this.buildTicketDTOs(response?.records ?? []);
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

  private buildTicketDTOs(records: readonly ActivityContracts.ActivityEventRecord[]): AssetContracts.AssetTicketDTO[] {
    return this.cloneRows(records
      .filter(record => record.type !== 'invitations')
      .filter(record => record.status !== 'T')
      .filter(record => record.ticketing === true)
      .map(record => this.toTicketDTO(ActivityEventDtoMapper.toDto(record))));
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

  private toTicketDTO(dto: ActivityContracts.ActivityEventDTO): AssetContracts.AssetTicketDTO {
    return {
      id: dto.id,
      type: dto.type === 'hosting' ? 'hosting' : 'events',
      status: dto.status,
      title: dto.title,
      subtitle: dto.subtitle,
      detail: dto.timeframe,
      dateIso: dto.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
      isAdmin: this.isTicketAdmin(dto),
      startAt: dto.startAtIso,
      endAt: dto.endAtIso,
      imageUrl: dto.imageUrl,
      visibility: dto.visibility,
      avatarInitials: dto.creatorInitials,
      creatorInitials: dto.creatorInitials
    };
  }

  private isTicketAdmin(dto: ActivityContracts.ActivityEventDTO): boolean {
    const userId = `${dto.userId ?? ''}`.trim();
    return !!userId && (
      dto.creatorUserId === userId
      || (dto.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === userId)
    );
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
