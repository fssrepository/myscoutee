import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { HttpAdminWorkspaceService } from '../../http/services/admin-workspace.service';
import { LocalAdminWorkspaceService } from '../../local/source/services/admin-workspace.service';
import type {
  AdminBootstrapProcessState,
  AdminDashboardDto,
  AdminFeedbackDto,
  AdminReportedUserDto
} from '../../contracts/admin.interface';
import type { ShareTokenResolvedItem } from '../../contracts/share.interface';
import { BaseRouteModeService } from './base-route-mode.service';
import { ShareTokensService } from './share-tokens.service';
import { UsersService } from './users.service';

const ADMIN_WORKSPACE_ROUTE = '/admin';
const ADMIN_REPORTS_ROUTE = '/admin/reports';
const ADMIN_BLOCKED_USERS_ROUTE = '/admin/reports/blocked-users';
const ADMIN_FEEDBACK_ROUTE = '/admin/feedback';

export type AdminReviewStatusFilter = 'unresolved' | 'resolved';

export interface AdminWorkspaceMenuCounters {
  adminJobs: number;
  adminMetrics: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminWorkspaceDataService extends BaseRouteModeService {
  private readonly httpService = inject(HttpAdminWorkspaceService);
  private readonly localService = inject(LocalAdminWorkspaceService);
  private readonly shareTokens = inject(ShareTokensService);
  private readonly usersService = inject(UsersService);

  get isFirebaseAdminMode(): boolean {
    return environment.firebaseLoginEnabled === true;
  }

  get shouldUseLocalAdminHelpSession(): boolean {
    return environment.activitiesDataSource !== 'http' || !this.isFirebaseAdminMode;
  }

  prepareSelectedAdminSession(adminUserId: string): void {
    if (!this.isLocalAdminWorkspace() && !this.isFirebaseAdminMode) {
      this.sessionService.startDemoSession(adminUserId);
    }
  }

  async resolveAdminHelpToken(
    token: string,
    localResolver: (token: string) => ShareTokenResolvedItem | null
  ): Promise<ShareTokenResolvedItem | null> {
    if (!this.isFirebaseAdminMode) {
      return localResolver(token);
    }
    try {
      return await this.shareTokens.resolveToken(token, '');
    } catch {
      return null;
    }
  }

  async loadDashboard(
    adminUserId?: string,
    _onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto> {
    return this.isLocalAdminWorkspace()
      ? await this.localService.loadDashboard(adminUserId)
      : await this.httpService.loadDashboard(adminUserId);
  }

  async loadReportedUsers(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminReportedUserDto[]> {
    const service = this.resolveRouteService(ADMIN_REPORTS_ROUTE, this.localService, this.httpService);
    return await service.loadReportedUsers(adminUserId, status);
  }

  async loadReportedUsersDashboard(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminDashboardDto> {
    const service = this.resolveRouteService(ADMIN_REPORTS_ROUTE, this.localService, this.httpService);
    return await service.loadDashboard(adminUserId, { reportsStatus: status });
  }

  async loadBlockedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    const service = this.resolveRouteService(ADMIN_BLOCKED_USERS_ROUTE, this.localService, this.httpService);
    return await service.loadBlockedUsers(adminUserId);
  }

  async loadFeedback(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminFeedbackDto[]> {
    const service = this.resolveRouteService(ADMIN_FEEDBACK_ROUTE, this.localService, this.httpService);
    return await service.loadFeedback(adminUserId, status);
  }

  async loadFeedbackDashboard(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminDashboardDto> {
    const service = this.resolveRouteService(ADMIN_FEEDBACK_ROUTE, this.localService, this.httpService);
    return await service.loadDashboard(adminUserId, { feedbackStatus: status });
  }

  async setReportResolved(reportId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    const service = this.resolveRouteService(ADMIN_REPORTS_ROUTE, this.localService, this.httpService);
    return await service.setReportResolved(reportId, resolved, adminUserId);
  }

  async setFeedbackResolved(feedbackId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    const service = this.resolveRouteService(ADMIN_FEEDBACK_ROUTE, this.localService, this.httpService);
    return await service.setFeedbackResolved(feedbackId, resolved, adminUserId);
  }

  async loadDashboardMenuCounters(adminUserId: string): Promise<AdminWorkspaceMenuCounters | null> {
    if (this.isLocalAdminWorkspace()) {
      return null;
    }
    const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
    if (!normalizedAdminUserId) {
      return null;
    }
    const snapshot = await this.usersService.pollUserRealtimeSnapshot(normalizedAdminUserId, null);
    return {
      adminJobs: Math.max(0, Math.trunc(Number(snapshot?.counters?.adminJobs) || 0)),
      adminMetrics: Math.max(0, Math.trunc(Number(snapshot?.counters?.adminMetrics) || 0))
    };
  }

  private isLocalAdminWorkspace(): boolean {
    return this.isLocalRouteEnabled(ADMIN_WORKSPACE_ROUTE);
  }
}
