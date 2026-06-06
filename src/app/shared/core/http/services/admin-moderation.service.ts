import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { AdminDashboardDto } from '../../../../admin/models/admin-dashboard.model';
import type { AdminUserDto } from '../../../../admin/models/admin-profile.model';
import type { AdminModerationActionResult } from '../../base/services/admin-moderation-data.service';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminModerationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async warnUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    return await this.postModerationAction(userId, 'warn', admin?.id ?? '', message);
  }

  async blockUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    return await this.postModerationAction(userId, 'block', admin?.id ?? '', message);
  }

  async unblockUser(
    userId: string,
    admin: AdminUserDto | null | undefined
  ): Promise<AdminModerationActionResult | null> {
    return await this.postModerationAction(userId, 'unblock', admin?.id ?? '', '');
  }

  private async postModerationAction(
    userId: string,
    action: 'warn' | 'block' | 'unblock',
    adminUserId: string,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    const dashboard = await this.http.post<AdminDashboardDto>(
      `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/${action}`,
      {
        adminUserId,
        message
      }
    ).toPromise() ?? null;
    return { dashboard };
  }
}
