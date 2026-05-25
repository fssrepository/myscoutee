import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  AdminAffinityGraphDto,
  AdminAffinityGraphForestsDto,
  AdminAffinityGraphMetaDto,
  AdminAffinityGraphNeighborhoodDto,
  AdminAffinityGraphTileDto
} from '../../base/interfaces/admin-affinity-graph.interface';

export interface AdminAffinityGraphRangeParams {
  minWeight?: number | null;
  maxWeight?: number | null;
}

export interface AdminAffinityGraphTileParams extends AdminAffinityGraphRangeParams {
  layoutVersion?: string | null;
  z?: number | null;
  x?: number | null;
  y?: number | null;
  componentId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpAdminAffinityGraphRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadMeta(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphMetaDto> {
    const meta = await this.http
      .get<AdminAffinityGraphMetaDto>(`${this.apiBaseUrl}/admin/affinity-graph/meta`, {
        params: this.params(adminUserId, range)
      })
      .toPromise();
    if (!meta) {
      throw new Error('Affinity graph metadata is unavailable.');
    }
    return meta;
  }

  async loadFullGraph(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.http
      .get<AdminAffinityGraphDto>(`${this.apiBaseUrl}/admin/affinity-graph/full`, {
        params: this.params(adminUserId, range)
      })
      .toPromise();
    if (!snapshot) {
      throw new Error('Affinity graph is unavailable.');
    }
    return snapshot;
  }

  async loadForests(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphForestsDto> {
    const forests = await this.http
      .get<AdminAffinityGraphForestsDto>(`${this.apiBaseUrl}/admin/affinity-graph/forests`, {
        params: this.params(adminUserId, range)
      })
      .toPromise();
    if (!forests) {
      throw new Error('Affinity graph forests are unavailable.');
    }
    return forests;
  }

  async loadTile(adminUserId?: string | null, tile?: AdminAffinityGraphTileParams): Promise<AdminAffinityGraphTileDto> {
    const result = await this.http
      .get<AdminAffinityGraphTileDto>(`${this.apiBaseUrl}/admin/affinity-graph/tiles`, {
        params: this.params(adminUserId, tile)
      })
      .toPromise();
    if (!result) {
      throw new Error('Affinity graph tile is unavailable.');
    }
    return result;
  }

  async loadNeighborhood(
    userId: string,
    depth?: number | null,
    adminUserId?: string | null,
    range?: AdminAffinityGraphRangeParams
  ): Promise<AdminAffinityGraphNeighborhoodDto> {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      throw new Error('Affinity graph member id is required.');
    }
    const result = await this.http
      .get<AdminAffinityGraphNeighborhoodDto>(
        `${this.apiBaseUrl}/admin/affinity-graph/members/${encodeURIComponent(normalizedUserId)}/neighborhood`,
        {
          params: this.params(adminUserId, { ...(range ?? {}), depth })
        }
      )
      .toPromise();
    if (!result) {
      throw new Error('Affinity graph neighborhood is unavailable.');
    }
    return result;
  }

  async rebuildLayout(adminUserId?: string | null): Promise<AdminAffinityGraphMetaDto> {
    const meta = await this.http
      .post<AdminAffinityGraphMetaDto>(`${this.apiBaseUrl}/admin/affinity-graph/layout/rebuild`, null, {
        params: this.params(adminUserId)
      })
      .toPromise();
    if (!meta) {
      throw new Error('Affinity graph layout rebuild failed.');
    }
    return meta;
  }

  private params(adminUserId?: string | null, values?: object | null): Record<string, string> {
    const params: Record<string, string> = {};
    const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
    if (normalizedAdminUserId) {
      params['adminUserId'] = normalizedAdminUserId;
    }
    for (const [key, value] of Object.entries(values ?? {})) {
      const normalizedValue = typeof value === 'string' ? value.trim() : value;
      if (normalizedValue !== null && normalizedValue !== undefined && normalizedValue !== '') {
        params[key] = `${normalizedValue}`;
      }
    }
    return params;
  }
}
