import { Injectable, inject, signal } from '@angular/core';

import { ActivitiesPopupStateService } from '../../activity/services/activities-popup-state.service';
import {
  AdminModerationService as CoreAdminModerationService,
  type AdminModerationActionResult
} from '../../shared/core';
import type { ChatRecord } from '../../shared/core/base/models/chat.model';
import type { AdminReportedUserDto } from '../models/admin-moderation.model';
import type { AdminUserDto } from '../models/admin-profile.model';
import { AdminShellService } from './admin-shell.service';
import { AdminWorkspaceService } from './admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminModerationService {
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly shell = inject(AdminShellService);
  private readonly moderationData = inject(CoreAdminModerationService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly warnedUserIdsRef = signal<Set<string>>(new Set());

  hasSupportChat(user: AdminReportedUserDto): boolean {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    return Boolean(resolved.hasSupportChat)
      || this.warnedUserIdsRef().has(userId);
  }

  supportChatUnread(user: AdminReportedUserDto): number {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    const explicit = Math.max(0, Math.trunc(Number(resolved.supportChatUnread) || 0));
    return explicit;
  }

  isUserBlocked(user: AdminReportedUserDto | null | undefined): boolean {
    const resolved = user?.userId ? this.resolveDashboardReportedUser(user.userId) : null;
    return `${resolved?.profileStatus ?? user?.profileStatus ?? ''}`.trim() === 'blocked';
  }

  openBlockedUserChat(user: AdminReportedUserDto): void {
    this.shell.closePopup();
    this.activitiesContext.openEventChat(this.buildAdminSupportChat(user));
  }

  async warnUser(userId: string, message: string): Promise<void> {
    await this.warnUserAction(userId, message);
  }

  private async warnUserAction(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.warnUser(
      normalizedUserId,
      this.workspace.activeAdmin() ?? this.fallbackAdmin(),
      message
    );
    this.applyModerationActionResult(normalizedUserId, result, { markWarned: true });
  }

  async blockUser(userId: string, message: string): Promise<void> {
    await this.blockUserAction(userId, message);
  }

  private async blockUserAction(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.blockUser(
      normalizedUserId,
      this.workspace.activeAdmin() ?? this.fallbackAdmin(),
      message
    );
    this.applyModerationActionResult(normalizedUserId, result, { markWarned: true });
  }

  async unblockUser(userId: string): Promise<void> {
    await this.unblockUserAction(userId);
  }

  private async unblockUserAction(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.unblockUser(
      normalizedUserId,
      this.workspace.activeAdmin() ?? this.fallbackAdmin()
    );
    this.applyModerationActionResult(normalizedUserId, result);
  }

  private applyModerationActionResult(
    userId: string,
    result: AdminModerationActionResult | null | undefined,
    options: { markWarned?: boolean } = {}
  ): void {
    if (!result) {
      return;
    }
    if (result.dashboard) {
      this.workspace.applyDashboard(result.dashboard);
    }
    if (result.userPatch) {
      this.workspace.patchModerationUser(result.userPatch);
    }
    if (options.markWarned === true) {
      this.markUserWarned(userId);
    }
    this.refreshSelectedReportedUser(userId);
  }

  private resolveDashboardReportedUser(userId: string): AdminReportedUserDto | null {
    const dashboard = this.workspace.dashboard();
    if (!dashboard) {
      return null;
    }
    const normalizedUserId = userId.trim();
    return [
      ...(dashboard.reportedUsers ?? []),
      ...(dashboard.blockedUsers ?? [])
    ].find(user => user.userId === normalizedUserId) ?? null;
  }

  private markUserWarned(userId: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return;
    }
    this.warnedUserIdsRef.update(current => {
      const next = new Set(current);
      next.add(normalizedUserId);
      return next;
    });
  }

  private refreshSelectedReportedUser(userId: string): void {
    const selected = this.shell.selectedReportedUser();
    if (!selected || selected.userId !== userId) {
      return;
    }
    this.shell.setSelectedReportedUser(this.resolveDashboardReportedUser(userId) ?? selected);
  }

  private buildAdminSupportChat(user: AdminReportedUserDto): ChatRecord & { ownerUserId?: string } {
    const admin = this.workspace.activeAdmin() ?? this.fallbackAdmin();
    return {
      id: `c-support-admin-${user.userId}`,
      avatar: user.initials || 'U',
      title: `MyScoutee Support · ${user.name}`,
      lastMessage: user.profileStatus === 'blocked'
        ? 'Your account has been blocked after moderation review.'
        : 'MyScoutee support conversation.',
      lastSenderId: admin.id,
      memberIds: [user.userId, admin.id],
      unread: this.supportChatUnread(user),
      dateIso: user.lastReportedAtIso || new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: admin.id
    };
  }

  private fallbackAdmin(): AdminUserDto {
    return {
      id: 'admin-demo-ava',
      name: 'Ava',
      initials: 'AM',
      email: 'ava.admin@myscoutee.local',
      images: []
    };
  }
}
