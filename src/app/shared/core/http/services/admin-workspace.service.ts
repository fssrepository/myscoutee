import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminDashboardDto, AdminFeedbackDto, AdminReportedUserDto } from '../../contracts/admin.interface';
import { RouteDelayService } from '../../base/services/route-delay.service';

const ADMIN_DASHBOARD_ROUTE = '/admin/dashboard';
const ADMIN_REPORTS_ROUTE = '/admin/reports';
const ADMIN_BLOCKED_USERS_ROUTE = '/admin/reports/blocked-users';
const ADMIN_FEEDBACK_ROUTE = '/admin/feedback';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminWorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadDashboard(adminUserId?: string): Promise<AdminDashboardDto> {
    return await this.loadDashboardForRoute(ADMIN_DASHBOARD_ROUTE, adminUserId);
  }

  async loadReportedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_REPORTS_ROUTE, adminUserId);
    return dashboard.reportedUsers ?? [];
  }

  async loadBlockedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_BLOCKED_USERS_ROUTE, adminUserId);
    return dashboard.blockedUsers ?? [];
  }

  async loadFeedback(adminUserId?: string): Promise<AdminFeedbackDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_FEEDBACK_ROUTE, adminUserId);
    return dashboard.feedback ?? [];
  }

  private async loadDashboardForRoute(route: string, adminUserId?: string): Promise<AdminDashboardDto> {
    const normalizedAdminUserId = adminUserId?.trim() ?? '';
    const dashboard = await this.routeDelay.withRequestTimeout(
      route,
      this.http
        .get<AdminDashboardDto>(`${this.apiBaseUrl}/admin/dashboard`, {
          params: normalizedAdminUserId ? { adminUserId: normalizedAdminUserId } : {}
        })
        .toPromise(),
      'Admin dashboard request timed out.'
    );
    if (!dashboard) {
      throw new Error('Admin dashboard is unavailable.');
    }
    return dashboard;
  }
}
