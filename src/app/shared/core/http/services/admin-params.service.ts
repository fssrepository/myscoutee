import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  AdminParamFieldDto,
  AdminParamsHistoryDto,
  AdminParamsStateDto
} from '../../contracts/admin.interface';
import { RouteDelayService } from '../../base/services/route-delay.service';

const ADMIN_PARAMS_LOAD_ROUTE = '/admin/params';
const ADMIN_PARAMS_SAVE_ROUTE = '/admin/params/save';
const ADMIN_PARAMS_HISTORY_ROUTE = '/admin/params/history';
const ADMIN_PARAMS_REVERT_ROUTE = '/admin/params/revert';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminParamsService {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadParamsState(adminUserId?: string | null): Promise<AdminParamsStateDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_PARAMS_LOAD_ROUTE, this.http
      .get<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
        params: { adminUserId: `${adminUserId ?? ''}`.trim() }
      })
      .toPromise(), 'Params request timed out.');
    if (!state) {
      throw new Error('Admin params state is unavailable.');
    }
    return state;
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_PARAMS_SAVE_ROUTE, this.http
      .post<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
        adminUserId: `${adminUserId ?? ''}`.trim(),
        sectionKey,
        fields,
        summary
      })
      .toPromise(), 'Params request timed out.');
    if (!state) {
      throw new Error('Admin params save returned no state.');
    }
    return state;
  }

  async loadParamsHistory(sectionKey: string, adminUserId?: string | null): Promise<AdminParamsHistoryDto> {
    const history = await this.routeDelay.withRequestTimeout(ADMIN_PARAMS_HISTORY_ROUTE, this.http
      .get<AdminParamsHistoryDto>(
        `${this.apiBaseUrl}/admin/params/${encodeURIComponent(sectionKey)}/history`,
        { params: { adminUserId: `${adminUserId ?? ''}`.trim() } }
      )
      .toPromise(), 'Params request timed out.');
    return history ?? {
      sectionKey,
      label: sectionKey,
      versions: []
    };
  }

  async revertParamsSection(
    sectionKey: string,
    version: number,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_PARAMS_REVERT_ROUTE, this.http
      .post<AdminParamsStateDto>(
        `${this.apiBaseUrl}/admin/params/${encodeURIComponent(sectionKey)}/revert`,
        {
          adminUserId: `${adminUserId ?? ''}`.trim(),
          version
        }
      )
      .toPromise(), 'Params request timed out.');
    if (!state) {
      throw new Error('Admin params revert returned no state.');
    }
    return state;
  }
}
