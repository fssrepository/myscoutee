import { Injectable, inject } from '@angular/core';

import { AdminStatsService as CoreAdminStatsService } from '../../shared/core';
import type { AdminStatsDashboardDto } from '../models/admin-stats.model';
import { AdminWorkspaceService } from './admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsService {
  private readonly coreStats = inject(CoreAdminStatsService);
  private readonly workspace = inject(AdminWorkspaceService);

  statsLoadProgressWindowMs(): number {
    return this.coreStats.statsLoadProgressWindowMs();
  }

  async loadStatsDashboard(): Promise<AdminStatsDashboardDto> {
    return await this.coreStats.loadStatsDashboard(this.workspace.activeAdmin()?.id ?? '');
  }
}
