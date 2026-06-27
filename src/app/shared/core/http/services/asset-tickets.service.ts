import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { LocalAssetTicketsMapper } from '../../local/source/mappers';
import type * as ActivityContracts from '../../contracts/activity.interface';
import type * as AssetContracts from '../../contracts/asset.interface';
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
        .get<{ records?: ActivityContracts.ActivityEventRecord[]; total?: number } | null>(`${this.apiBaseUrl}/assets/tickets`, {
          params: new HttpParams()
            .set('userId', normalizedUserId)
            .set('page', String(Math.max(0, Math.trunc(Number(query.page) || 0))))
            .set('pageSize', String(Math.max(1, Math.trunc(Number(query.pageSize) || 1))))
            .set('order', query.order)
        })
        .toPromise();
      const rows = LocalAssetTicketsMapper.toTicketDTOs(response?.records ?? []);
      const total = Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : rows.length;
      this.cachedRowsByUserId[normalizedUserId] = rows;
      this.offlineCache.writeTicketPage(normalizedUserId, query.order, {
        items: rows,
        total
      });
      return {
        items: LocalAssetTicketsMapper.cloneDTOs(rows),
        total
      };
    } catch {
      const cachedPage = this.offlineCache.readTicketPage(normalizedUserId, query.order);
      if (cachedPage) {
        this.cachedRowsByUserId[normalizedUserId] = LocalAssetTicketsMapper.cloneDTOs(cachedPage.items);
        return LocalAssetTicketsMapper.pageRows(cachedPage.items, query);
      }
      return LocalAssetTicketsMapper.pageRows(this.peekTicketRowsByUser(normalizedUserId), query);
    }
  }

  private peekTicketRowsByUser(userId: string): AssetContracts.AssetTicketDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const cachedRows = this.cachedRowsByUserId[normalizedUserId];
    if (cachedRows && cachedRows.length > 0) {
      return LocalAssetTicketsMapper.cloneDTOs(cachedRows);
    }
    const offlineRows = this.offlineCache.readTicketPage(normalizedUserId, 'upcoming')?.items
      ?? this.offlineCache.readTicketPage(normalizedUserId, 'past')?.items
      ?? [];
    if (offlineRows.length > 0) {
      this.cachedRowsByUserId[normalizedUserId] = LocalAssetTicketsMapper.cloneDTOs(offlineRows);
    }
    return LocalAssetTicketsMapper.cloneDTOs(offlineRows);
  }

}
