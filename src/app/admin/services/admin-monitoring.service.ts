import { Injectable, inject } from '@angular/core';

import { AdminMonitoringService as CoreAdminMonitoringService, type AdminMonitoringStateDto } from '../../shared/core';
import { AdminWorkspaceService } from './admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringService {
  private readonly coreMonitoring = inject(CoreAdminMonitoringService);
  private readonly workspace = inject(AdminWorkspaceService);

  monitoringLoadProgressWindowMs(): number {
    return this.coreMonitoring.monitoringLoadProgressWindowMs();
  }

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    return await this.coreMonitoring.loadMonitoringState(this.workspace.activeAdmin()?.id ?? '');
  }
}
