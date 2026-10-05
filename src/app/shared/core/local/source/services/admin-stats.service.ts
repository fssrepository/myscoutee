import { Injectable, inject } from '@angular/core';

import type { AdminStatsDashboardDto } from '../../../contracts/admin.interface';
import { LocalAdminStatsRepository } from '../repositories/admin-stats.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_STATS_LOAD_ROUTE = '/admin/stats';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminStatsService extends LocalRouteDelayService {
  readonly source = 'demo' as const;
  private readonly repository = inject(LocalAdminStatsRepository);

  async loadStatsDashboard(adminUserId?: string | null): Promise<AdminStatsDashboardDto> {
    const load = this.readStatsSnapshot(adminUserId);
    const delay = this.waitForRouteDelay(ADMIN_STATS_LOAD_ROUTE);
    try {
      const [dashboard] = await Promise.all([load, delay]);
      return dashboard;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readStatsSnapshot(adminUserId?: string | null): Promise<AdminStatsDashboardDto> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminStatsDashboardDto>(this.repository.groupForAdmin(adminUserId));
    if (!existing) {
      throw new Error('Demo stats snapshot is not bootstrapped.');
    }
    return structuredClone(existing);
  }
}
