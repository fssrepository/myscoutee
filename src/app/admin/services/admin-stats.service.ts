import { Injectable, inject } from '@angular/core';

import { AdminStatsService as CoreAdminStatsService, AppContext } from '../../shared/core';
import type { AdminStatsDashboardDto } from '../models/admin-stats.model';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsService {
  private readonly coreStats = inject(CoreAdminStatsService);
  private readonly appCtx = inject(AppContext);

  statsLoadProgressWindowMs(): number {
    return this.coreStats.statsLoadProgressWindowMs();
  }

  async loadStatsDashboard(): Promise<AdminStatsDashboardDto> {
    return await this.coreStats.loadStatsDashboard(this.appCtx.activeUserId().trim());
  }
}
