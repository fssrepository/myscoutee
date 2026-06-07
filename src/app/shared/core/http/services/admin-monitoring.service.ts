import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminMonitoringStateDto } from '../../base/models/admin-monitoring.model';
import { RouteDelayService } from '../../base/services/route-delay.service';

const ADMIN_MONITORING_LOAD_ROUTE = '/admin/monitoring';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminMonitoringService {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadMonitoringState(adminUserId?: string | null): Promise<AdminMonitoringStateDto> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_MONITORING_LOAD_ROUTE, this.http
      .get<AdminMonitoringStateDto>(`${this.apiBaseUrl}/admin/monitoring`, {
        params: { adminUserId: `${adminUserId ?? ''}`.trim() }
      })
      .toPromise(), 'Monitoring request timed out.');
    if (!state) {
      throw new Error('Admin monitoring state is unavailable.');
    }
    return state;
  }
}
