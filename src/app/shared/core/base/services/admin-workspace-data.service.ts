import { Injectable, inject } from '@angular/core';

import type { AdminDashboardDto } from '../../../../admin/models/admin-dashboard.model';
import { HttpAdminWorkspaceService } from '../../http/services/admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminWorkspaceDataService {
  private readonly httpService = inject(HttpAdminWorkspaceService);

  async loadDashboard(adminUserId?: string): Promise<AdminDashboardDto> {
    return await this.httpService.loadDashboard(adminUserId);
  }
}
