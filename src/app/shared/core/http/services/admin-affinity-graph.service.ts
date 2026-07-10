import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  AdminAffinityGraphDto,
  AdminAffinityGraphForestsDto,
  AdminAffinityGraphMetaDto,
  AdminAffinityGraphNeighborhoodDto,
  AdminAffinityGraphTileDto
} from '../../contracts/admin.interface';

export interface AdminAffinityGraphRangeParams {
  minWeight?: number | null;
  maxWeight?: number | null;
  forestLevel?: number | null;
  limit?: number | null;
  offset?: number | null;
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
export class HttpAdminAffinityGraphService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadMeta(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams, signal?: AbortSignal): Promise<AdminAffinityGraphMetaDto> {
    const meta = await this.requestWithAbort(
      this.http.get<AdminAffinityGraphMetaDto>(`${this.apiBaseUrl}/admin/affinity-graph/meta`, {
        params: this.params(adminUserId, range)
      }),
      signal
    );
    if (!meta) {
      throw new Error('Affinity graph metadata is unavailable.');
    }
    return meta;
  }

  async loadFullGraph(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams, signal?: AbortSignal): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.requestWithAbort(
      this.http.get<AdminAffinityGraphDto>(`${this.apiBaseUrl}/admin/affinity-graph/full`, {
        params: this.params(adminUserId, range)
      }),
      signal
    );
    if (!snapshot) {
      throw new Error('Affinity graph is unavailable.');
    }
    return snapshot;
  }

  async loadForests(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams, signal?: AbortSignal): Promise<AdminAffinityGraphForestsDto> {
    const forests = await this.requestWithAbort(
      this.http.get<AdminAffinityGraphForestsDto>(`${this.apiBaseUrl}/admin/affinity-graph/forests`, {
        params: this.params(adminUserId, range)
      }),
      signal
    );
    if (!forests) {
      throw new Error('Affinity graph forests are unavailable.');
    }
    return forests;
  }

  async loadTile(adminUserId?: string | null, tile?: AdminAffinityGraphTileParams, signal?: AbortSignal): Promise<AdminAffinityGraphTileDto> {
    const result = await this.requestWithAbort(
      this.http.get<AdminAffinityGraphTileDto>(`${this.apiBaseUrl}/admin/affinity-graph/tiles`, {
        params: this.params(adminUserId, tile)
      }),
      signal
    );
    if (!result) {
      throw new Error('Affinity graph tile is unavailable.');
    }
    return result;
  }

  async loadNeighborhood(
    userId: string,
    depth?: number | null,
    adminUserId?: string | null,
    range?: AdminAffinityGraphRangeParams,
    signal?: AbortSignal
  ): Promise<AdminAffinityGraphNeighborhoodDto> {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      throw new Error('Affinity graph member id is required.');
    }
    const result = await this.requestWithAbort(
      this.http.get<AdminAffinityGraphNeighborhoodDto>(
        `${this.apiBaseUrl}/admin/affinity-graph/members/${encodeURIComponent(normalizedUserId)}/neighborhood`,
        {
          params: this.params(adminUserId, { ...(range ?? {}), depth })
        }
      ),
      signal
    );
    if (!result) {
      throw new Error('Affinity graph neighborhood is unavailable.');
    }
    return result;
  }

  async rebuildLayout(adminUserId?: string | null, signal?: AbortSignal): Promise<AdminAffinityGraphMetaDto> {
    const meta = await this.requestWithAbort(
      this.http.post<AdminAffinityGraphMetaDto>(`${this.apiBaseUrl}/admin/affinity-graph/layout/rebuild`, null, {
        params: this.params(adminUserId)
      }),
      signal
    );
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

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let settled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request$.subscribe({
        next: value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        },
        complete: () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(undefined);
        }
      });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }
}
