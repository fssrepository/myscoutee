import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminDashboardDto } from '../../../../admin/models/admin-dashboard.model';
import type { AdminBootstrapProcessState } from '../../../../admin/models/admin-shell.model';
import { HttpAdminWorkspaceService } from '../../http/services/admin-workspace.service';
import { LocalAdminWorkspaceService } from '../../local/services/admin-workspace.service';
import type { UserSelectorListItemDto } from '../interfaces';
import type { ShareTokenResolvedItem } from '../models';
import { BaseRouteModeService } from './base-route-mode.service';
import { ShareTokensService } from './share-tokens.service';
import { UsersService } from './users.service';

const ADMIN_WORKSPACE_ROUTE = '/admin';

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

  readonly adminUsers = this.localService.adminUsers;

  get isFirebaseAdminMode(): boolean {
    return environment.firebaseLoginEnabled === true;
  }

  get shouldUseEmbeddedAdminHelpSelector(): boolean {
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

  async prepareAdminSelector(
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<UserSelectorListItemDto[]> {
    if (!this.isLocalAdminWorkspace()) {
      onProgress?.({ percent: 100, label: 'Admin selector ready', stage: 'ready' });
      return this.adminUsers();
    }
    return await this.localService.prepareAdminSelector(onProgress);
  }

  async loadDashboard(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto> {
    const service = this.resolveRouteService(ADMIN_WORKSPACE_ROUTE, this.localService, this.httpService);
    return service === this.localService
      ? await this.localService.loadDashboard(adminUserId, onProgress)
      : await this.httpService.loadDashboard(adminUserId);
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
