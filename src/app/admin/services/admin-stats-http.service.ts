import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';
import type { AdminStatsDashboardDto } from '../models/admin-stats.model';
import { ADMIN_STATS_LOAD_ROUTE } from './admin-stats.constants';
import { AdminWorkspaceService } from './admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsHttpService {
  readonly source = 'http' as const;
  private readonly http = inject(HttpClient);
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadStatsDashboard(): Promise<AdminStatsDashboardDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_STATS_LOAD_ROUTE, this.http
      .get<AdminStatsDashboardDto>(`${this.apiBaseUrl}/admin/stats`, {
        params: { adminUserId: this.workspace.activeAdmin()?.id ?? '' }
      })
      .toPromise(), 'Stats request timed out.');
    if (!state) {
      throw new Error('Admin stats dashboard is unavailable.');
    }
    return state;
  }
}
