import { Injectable, inject } from '@angular/core';

import { AdminMonitoringService as CoreAdminMonitoringService, AppContext, type AdminMonitoringStateDto } from '../../shared/core';

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringService {
  private readonly coreMonitoring = inject(CoreAdminMonitoringService);
  private readonly appCtx = inject(AppContext);

  monitoringLoadProgressWindowMs(): number {
    return this.coreMonitoring.monitoringLoadProgressWindowMs();
  }

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    return await this.coreMonitoring.loadMonitoringState(this.appCtx.activeUserId().trim());
  }
}
