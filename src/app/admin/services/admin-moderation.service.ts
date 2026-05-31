import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ActivitiesPopupStateService } from '../../activity/services/activities-popup-state.service';
import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';
import type { ChatPopupMessage, ChatRecord } from '../../shared/core/base/models/chat.model';
import {
  DemoChatsRepository,
  DemoUsersRepository,
  type DemoChatRecord
} from '../../shared/core/demo';
import type { AdminDashboardDto } from '../models/admin-dashboard.model';
import type { AdminReportedUserDto } from '../models/admin-moderation.model';
import type { AdminUserDto } from '../models/admin-profile.model';
import { AdminShellService } from './admin-shell.service';
import { AdminWorkspaceService } from './admin-workspace.service';

const ADMIN_MODERATION_WARN_ROUTE = '/admin/reports/warn';
const ADMIN_MODERATION_BLOCK_ROUTE = '/admin/reports/block';
const ADMIN_MODERATION_UNBLOCK_ROUTE = '/admin/reports/unblock';
const ADMIN_MODERATION_ACTION_DEMO_DELAY_MS = 1500;

@Injectable({
  providedIn: 'root'
})
export class AdminModerationService {
  private readonly http = inject(HttpClient);
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly shell = inject(AdminShellService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly demoChatsRepository = inject(DemoChatsRepository);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly warnedUserIdsRef = signal<Set<string>>(new Set());

  hasSupportChat(user: AdminReportedUserDto): boolean {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    return Boolean(resolved.hasSupportChat)
      || this.demoSupportChatExists(userId)
      || this.warnedUserIdsRef().has(userId);
  }

  supportChatUnread(user: AdminReportedUserDto): number {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    const explicit = Math.max(0, Math.trunc(Number(resolved.supportChatUnread) || 0));
    return this.workspace.usesHttpAdminApi ? explicit : explicit || this.demoSupportChatUnread(userId);
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
    await this.withAdminModerationDemoDelay(
      this.warnUserAction(userId, message),
      ADMIN_MODERATION_WARN_ROUTE
    );
  }

  private async warnUserAction(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.workspace.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/warn`,
        {
          adminUserId: this.workspace.activeAdmin()?.id ?? '',
          message
        }
      ).toPromise();
      if (dashboard) {
        this.workspace.applyDashboard(dashboard);
        this.markUserWarned(normalizedUserId);
      }
      return;
    }
    await this.appendDemoSupportMessage(normalizedUserId, message);
    this.markUserWarned(normalizedUserId);
    await this.workspace.refreshDemoDashboard();
  }

  async blockUser(userId: string, message: string): Promise<void> {
    await this.withAdminModerationDemoDelay(
      this.blockUserAction(userId, message),
      ADMIN_MODERATION_BLOCK_ROUTE
    );
  }

  private async blockUserAction(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.workspace.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/block`,
        {
          adminUserId: this.workspace.activeAdmin()?.id ?? '',
          message
        }
      ).toPromise();
      if (dashboard) {
        this.workspace.applyDashboard(dashboard);
        this.markUserWarned(normalizedUserId);
        this.refreshSelectedReportedUser(normalizedUserId);
      }
      return;
    }
    const user = this.demoUsersRepository.queryUserById(normalizedUserId);
    if (user) {
      this.demoUsersRepository.upsertUser({
        ...user,
        previousProfileStatus: user.profileStatus,
        profileStatus: 'blocked'
      });
    }
    await this.appendDemoSupportMessage(normalizedUserId, message);
    this.markUserWarned(normalizedUserId);
    await this.demoUsersRepository.flushToIndexedDb();
    await this.workspace.refreshDemoDashboard();
    this.refreshSelectedReportedUser(normalizedUserId);
  }

  async unblockUser(userId: string): Promise<void> {
    await this.withAdminModerationDemoDelay(
      this.unblockUserAction(userId),
      ADMIN_MODERATION_UNBLOCK_ROUTE
    );
  }

  private async unblockUserAction(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.workspace.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/unblock`,
        {
          adminUserId: this.workspace.activeAdmin()?.id ?? '',
          message: ''
        }
      ).toPromise();
      if (dashboard) {
        this.workspace.applyDashboard(dashboard);
        this.refreshSelectedReportedUser(normalizedUserId);
      }
      return;
    }
    const user = this.demoUsersRepository.queryUserById(normalizedUserId);
    if (user) {
      this.demoUsersRepository.upsertUser({
        ...user,
        previousProfileStatus: undefined,
        profileStatus: user.previousProfileStatus && user.previousProfileStatus !== 'blocked'
          ? user.previousProfileStatus
          : 'public'
      });
      await this.demoUsersRepository.flushToIndexedDb();
    }
    await this.workspace.refreshDemoDashboard();
    this.refreshSelectedReportedUser(normalizedUserId);
  }

  private async withAdminModerationDemoDelay<T>(work: Promise<T>, route: string): Promise<T> {
    if (this.workspace.usesHttpAdminApi) {
      return work;
    }
    const delay = this.routeDelay.waitForRouteDelay(
      route,
      undefined,
      undefined,
      ADMIN_MODERATION_ACTION_DEMO_DELAY_MS
    );
    try {
      const [result] = await Promise.all([work, delay]);
      return result;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async appendDemoSupportMessage(userId: string, text: string): Promise<void> {
    const admin = this.workspace.activeAdmin() ?? this.fallbackAdmin();
    const reportedUser = this.resolveDashboardReportedUser(userId);
    const now = new Date();
    const nowIso = now.toISOString();
    const chatId = `c-support-admin-${userId}`;
    const messageId = `m-admin-${Date.now()}`;
    const adminAvatar = {
      id: admin.id,
      initials: admin.initials,
      gender: 'woman' as const
    };
    const userChat: DemoChatRecord = {
      id: chatId,
      avatar: admin.initials,
      title: 'MyScoutee Support',
      lastMessage: text,
      lastSenderId: admin.id,
      memberIds: [userId, admin.id],
      unread: 1,
      dateIso: nowIso,
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: userId,
      messages: []
    };
    const userMessage: ChatPopupMessage = {
      id: messageId,
      sender: admin.name,
      senderAvatar: adminAvatar,
      text,
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: nowIso,
      mine: false,
      readBy: []
    };
    const adminChat: DemoChatRecord = {
      id: chatId,
      avatar: reportedUser?.initials || 'U',
      title: `MyScoutee Support · ${reportedUser?.name || 'Reported user'}`,
      lastMessage: text,
      lastSenderId: admin.id,
      memberIds: [userId, admin.id],
      unread: 0,
      dateIso: nowIso,
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: admin.id,
      messages: []
    };
    const adminMessage: ChatPopupMessage = {
      ...userMessage,
      mine: true,
      readBy: []
    };
    this.demoChatsRepository.upsertSupportChatMessage(userChat, userMessage, true);
    this.demoChatsRepository.upsertSupportChatMessage(adminChat, adminMessage, false);
    await this.demoChatsRepository.flushToIndexedDb();
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

  private demoSupportChatExists(userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const adminId = this.workspace.activeAdmin()?.id ?? '';
    if (!normalizedUserId || !adminId) {
      return false;
    }
    return this.demoChatsRepository.queryChatItemsByUser(adminId)
      .some(chat => chat.id === `c-support-admin-${normalizedUserId}`);
  }

  private demoSupportChatUnread(userId: string): number {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const adminId = this.workspace.activeAdmin()?.id ?? '';
    if (!normalizedUserId || !adminId) {
      return 0;
    }
    const chat = this.demoChatsRepository.queryChatItemsByUser(adminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
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
