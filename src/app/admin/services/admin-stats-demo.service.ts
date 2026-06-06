import { Injectable, inject } from '@angular/core';

import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';
import type { AdminStatsDashboardDto } from '../models/admin-stats.model';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';
import { ADMIN_STATS_LOAD_ROUTE } from './admin-stats.constants';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsDemoService {
  readonly source = 'demo' as const;
  private readonly repository = inject(AdminStatsRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async loadStatsDashboard(): Promise<AdminStatsDashboardDto> {
    const load = this.readStatsSnapshot();
    const delay = this.routeDelay.waitForRouteDelay(ADMIN_STATS_LOAD_ROUTE);
    try {
      const [dashboard] = await Promise.all([load, delay]);
      return dashboard;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readStatsSnapshot(): Promise<AdminStatsDashboardDto> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminStatsDashboardDto>();
    if (!existing) {
      throw new Error('Demo stats snapshot is not bootstrapped.');
    }
    return existing;
  }
}
