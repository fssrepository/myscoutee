import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminDashboardDto, AdminFeedbackDto, AdminReportedUserDto } from '../../contracts/admin.interface';
import { RouteDelayService } from '../../base/services/route-delay.service';
import type { AdminReviewStatusFilter } from '../../base/services/admin-workspace-data.service';

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

  async loadDashboard(
    adminUserId?: string,
    filters: { reportsStatus?: AdminReviewStatusFilter; feedbackStatus?: AdminReviewStatusFilter } = {}
  ): Promise<AdminDashboardDto> {
    return await this.loadDashboardForRoute(ADMIN_DASHBOARD_ROUTE, adminUserId, filters);
  }

  async loadReportedUsers(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminReportedUserDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_REPORTS_ROUTE, adminUserId, { reportsStatus: status });
    return dashboard.reportedUsers ?? [];
  }

  async loadBlockedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_BLOCKED_USERS_ROUTE, adminUserId);
    return dashboard.blockedUsers ?? [];
  }

  async loadFeedback(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminFeedbackDto[]> {
    const dashboard = await this.loadDashboardForRoute(ADMIN_FEEDBACK_ROUTE, adminUserId, { feedbackStatus: status });
    return dashboard.feedback ?? [];
  }

  async setReportResolved(reportId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    return await this.postReviewStatus(
      `${this.apiBaseUrl}/admin/reports/${encodeURIComponent(reportId.trim())}/resolve`,
      adminUserId,
      resolved
    );
  }

  async setFeedbackResolved(feedbackId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    return await this.postReviewStatus(
      `${this.apiBaseUrl}/admin/feedback/${encodeURIComponent(feedbackId.trim())}/resolve`,
      adminUserId,
      resolved
    );
  }

  private async loadDashboardForRoute(
    route: string,
    adminUserId?: string,
    filters: { reportsStatus?: AdminReviewStatusFilter; feedbackStatus?: AdminReviewStatusFilter } = {}
  ): Promise<AdminDashboardDto> {
    const normalizedAdminUserId = adminUserId?.trim() ?? '';
    const params: Record<string, string> = {};
    if (normalizedAdminUserId) {
      params['adminUserId'] = normalizedAdminUserId;
    }
    if (filters.reportsStatus) {
      params['reportsStatus'] = filters.reportsStatus;
    }
    if (filters.feedbackStatus) {
      params['feedbackStatus'] = filters.feedbackStatus;
    }
    const dashboard = await this.routeDelay.withRequestTimeout(
      route,
      this.http
        .get<AdminDashboardDto>(`${this.apiBaseUrl}/admin/dashboard`, {
          params
        })
        .toPromise(),
      'Admin dashboard request timed out.'
    );
    if (!dashboard) {
      throw new Error('Admin dashboard is unavailable.');
    }
    return dashboard;
  }

  private async postReviewStatus(url: string, adminUserId: string | undefined, resolved: boolean): Promise<AdminDashboardDto> {
    const normalizedAdminUserId = adminUserId?.trim() ?? '';
    const dashboard = await this.routeDelay.withRequestTimeout(
      ADMIN_DASHBOARD_ROUTE,
      this.http
        .post<AdminDashboardDto>(url, {
          ...(normalizedAdminUserId ? { adminUserId: normalizedAdminUserId } : {}),
          resolved
        })
        .toPromise(),
      'Admin status update timed out.'
    );
    if (!dashboard) {
      throw new Error('Admin dashboard is unavailable.');
    }
    return dashboard;
  }
}
