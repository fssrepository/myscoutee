import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { Campaign, CampaignAction, CampaignFilters, CampaignHistoryItem, ICampaignsService, SaveCampaign } from '../../contracts/campaign.interface';
import type { ListQuery, PageResult } from '@fssrepository/myscoutee-components';

@Injectable({ providedIn: 'root' })
export class HttpCampaignsService implements ICampaignsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/campaigns`;
  async history(userId: string, targetUserId: string, query: ListQuery, signal?: AbortSignal): Promise<PageResult<CampaignHistoryItem>> {
    signal?.throwIfAborted();
    const result = await firstValueFrom(this.http.get<PageResult<CampaignHistoryItem>>(`${this.url}/history`, {
      params: { userId, targetUserId, pageSize: query.pageSize, cursor: query.cursor ?? '' }
    }));
    signal?.throwIfAborted(); return result;
  }
  async page(userId: string, query: ListQuery<CampaignFilters>, signal?: AbortSignal): Promise<PageResult<Campaign>> {
    signal?.throwIfAborted();
    const filters = query.filters ?? {};
    const params: Record<string, string | number> = { userId, pageSize: query.pageSize, cursor: query.cursor ?? '', sort: query.sort ?? 'updated' };
    for (const [key, value] of Object.entries(filters)) if (value != null) params[key] = value;
    const result = await firstValueFrom(this.http.get<PageResult<Campaign>>(this.url, { params }));
    signal?.throwIfAborted(); return result;
  }
  async detail(userId: string, id: string, signal?: AbortSignal): Promise<Campaign> {
    signal?.throwIfAborted();
    const result = await firstValueFrom(this.http.get<Campaign>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
    signal?.throwIfAborted(); return result;
  }
  save(request: SaveCampaign): Promise<Campaign> { return firstValueFrom(this.http.post<Campaign>(this.url, request)); }
  action(userId: string, id: string, action: CampaignAction, version: number): Promise<Campaign> {
    return firstValueFrom(this.http.post<Campaign>(`${this.url}/${encodeURIComponent(id)}/action`, { userId, action, version }));
  }
}
