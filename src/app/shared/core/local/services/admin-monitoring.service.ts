import { Injectable, inject } from '@angular/core';

import type { AdminMonitoringStateDto } from '../../base/models/admin-monitoring.model';
import { LocalAdminMonitoringRepository } from '../repositories/admin-monitoring.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_MONITORING_LOAD_ROUTE = '/admin/monitoring';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminMonitoringService extends LocalRouteDelayService {
  private readonly repository = inject(LocalAdminMonitoringRepository);

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    const delay = this.waitForRouteDelay(ADMIN_MONITORING_LOAD_ROUTE);
    try {
      const [state] = await Promise.all([
        this.readMonitoringState(),
        delay
      ]);
      return state;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readMonitoringState(): Promise<AdminMonitoringStateDto> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminMonitoringStateDto>();
    if (!existing?.categories?.length) {
      throw new Error('Demo monitoring state is not bootstrapped.');
    }
    return existing;
  }
}
