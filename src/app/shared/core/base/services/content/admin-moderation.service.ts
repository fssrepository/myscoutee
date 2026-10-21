import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import type { AdminDashboardDto, AdminUserDto } from '../../../contracts/administration/admin.interface';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

export interface AdminModerationUserPatch {
  userId: string;
  profileStatus?: string;
  blockedAtIso?: string | null;
  hasSupportChat?: boolean;
  supportChatUnread?: number | null;
  supportChatId?: string | null;
}

export interface AdminModerationActionResult {
  dashboard?: AdminDashboardDto | null;
  userPatch?: AdminModerationUserPatch | null;
}

@Injectable({
  providedIn: 'root'
})
export class AdminModerationService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localService = this.transportAdapters.reference(LOCAL_ADAPTER.ADMIN_MODERATION);
  private readonly httpService = this.transportAdapters.reference(HTTP_ADAPTER.ADMIN_MODERATION);

  private get moderationService(): AdapterInstance<typeof LOCAL_ADAPTER.ADMIN_MODERATION> | AdapterInstance<typeof HTTP_ADAPTER.ADMIN_MODERATION> {
    return this.resolveRouteService('/admin/reports', this.localService, this.httpService);
  }

  async warnUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string,
    reportId?: string | null
  ): Promise<AdminModerationActionResult | null> {
    return await this.moderationService.warnUser(userId, admin, message, reportId);
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
