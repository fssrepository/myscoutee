import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminStatsDashboardDto } from '../../base/models';
import { RouteDelayService } from '../../base/services/route-delay.service';

const ADMIN_STATS_LOAD_ROUTE = '/admin/stats';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminStatsService {
  readonly source = 'http' as const;
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadStatsDashboard(adminUserId?: string | null): Promise<AdminStatsDashboardDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_STATS_LOAD_ROUTE, this.http
      .get<AdminStatsDashboardDto>(`${this.apiBaseUrl}/admin/stats`, {
        params: { adminUserId: `${adminUserId ?? ''}`.trim() }
      })
      .toPromise(), 'Stats request timed out.');
    if (!state) {
      throw new Error('Admin stats dashboard is unavailable.');
    }
    return state;
  }
}
