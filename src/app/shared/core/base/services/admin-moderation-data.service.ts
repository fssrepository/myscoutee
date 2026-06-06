import { Injectable, inject } from '@angular/core';

import type { AdminDashboardDto } from '../../../../admin/models/admin-dashboard.model';
import type { AdminUserDto } from '../../../../admin/models/admin-profile.model';
import { HttpAdminModerationService } from '../../http/services/admin-moderation.service';
import { LocalAdminModerationService } from '../../local/services/admin-moderation.service';
import { BaseRouteModeService } from './base-route-mode.service';

export interface AdminModerationUserPatch {
  userId: string;
  profileStatus?: string;
  blockedAtIso?: string | null;
  hasSupportChat?: boolean;
  supportChatUnread?: number | null;
}

export interface AdminModerationActionResult {
  dashboard?: AdminDashboardDto | null;
  userPatch?: AdminModerationUserPatch | null;
}

@Injectable({
  providedIn: 'root'
})
export class AdminModerationDataService extends BaseRouteModeService {
  private readonly localService = inject(LocalAdminModerationService);
  private readonly httpService = inject(HttpAdminModerationService);

  private get moderationService(): LocalAdminModerationService | HttpAdminModerationService {
    return this.resolveRouteService('/admin/reports', this.localService, this.httpService);
  }

  async warnUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    return await this.moderationService.warnUser(userId, admin, message);
  }

  async blockUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    return await this.moderationService.blockUser(userId, admin, message);
  }

  async unblockUser(
    userId: string,
    admin: AdminUserDto | null | undefined
  ): Promise<AdminModerationActionResult | null> {
    return await this.moderationService.unblockUser(userId, admin);
  }
}
