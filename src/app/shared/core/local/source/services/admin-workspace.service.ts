import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type {
  AdminChatMessageDto,
  AdminDashboardDto,
  AdminFeedbackDto,
  AdminModerationStore,
  AdminReportDto,
  AdminReportedUserDto,
  AdminUserDto
} from '../../../contracts/admin.interface';
import { LocalAdminModerationRepository } from '../repositories/admin-moderation.repository';
import { LocalAdminSupportSessionService } from './admin-support-session.service';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_WORKSPACE_LOAD_ROUTE = '/admin/workspace';
const ADMIN_REPORTS_LOAD_ROUTE = '/admin/reports';
const ADMIN_BLOCKED_USERS_LOAD_ROUTE = '/admin/reports/blocked-users';
const ADMIN_FEEDBACK_LOAD_ROUTE = '/admin/feedback';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminWorkspaceService extends LocalRouteDelayService {
  private readonly moderationRepository = inject(LocalAdminModerationRepository);
  private readonly supportSession = inject(LocalAdminSupportSessionService);

  async loadDashboard(adminUserId?: string): Promise<AdminDashboardDto> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_WORKSPACE_LOAD_ROUTE, dashboard => dashboard);
  }

  async loadReportedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_REPORTS_LOAD_ROUTE, dashboard => dashboard.reportedUsers);
  }

  async loadBlockedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_BLOCKED_USERS_LOAD_ROUTE, dashboard => dashboard.blockedUsers);
  }

  async loadFeedback(adminUserId?: string): Promise<AdminFeedbackDto[]> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_FEEDBACK_LOAD_ROUTE, dashboard => dashboard.feedback);
  }

  private async loadDashboardSlice<T>(
    adminUserId: string | undefined,
    route: string,
    select: (dashboard: AdminDashboardDto) => T
  ): Promise<T> {
    const read = this.readDashboard(adminUserId).then(select);
    const delay = this.waitForRouteDelay(route);
    try {
      const [value] = await Promise.all([read, delay]);
      return value;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  resolveDemoAdmin(adminUserId?: string): AdminUserDto {
    const id = `${adminUserId ?? ''}`.trim();
    if (id === 'admin-demo-noel') {
      return {
        id: 'admin-demo-noel',
        name: 'Noel Safety',
        initials: 'NS',
        email: 'noel.admin@myscoutee.local',
        images: this.demoAdminImages('admin-demo-noel')
      };
    }
    return {
      id: 'admin-demo-ava',
      name: 'Ava',
      initials: 'AM',
      email: 'ava.admin@myscoutee.local',
      images: this.demoAdminImages('admin-demo-ava')
    };
  }

  private async readDashboard(adminUserId?: string): Promise<AdminDashboardDto> {
    await this.moderationRepository.whenReady();
    const store = await this.moderationRepository.readStore();
    if (!store?.reports?.length && !store?.feedback?.length) {
      throw new Error('Demo admin workspace is not bootstrapped.');
    }
    return this.buildDemoDashboard(this.resolveDemoAdmin(adminUserId), store);
  }

  private buildDemoDashboard(admin: AdminUserDto, store: AdminModerationStore): AdminDashboardDto {
    const activeAdmin = this.mergeStoredAdminProfile(admin);
    const reportsByUser = new Map<string, AdminReportDto[]>();
    for (const report of store.reports) {
      const key = report.targetUserId.trim();
      if (!key) {
        continue;
      }
      reportsByUser.set(key, [...(reportsByUser.get(key) ?? []), this.enrichDemoReport(report)]);
    }
    const reportedUsers = [...reportsByUser.entries()].map(([userId, reports]) => {
      const user = this.supportSession.findUser(userId);
      const sortedReports = [...reports].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      );
      return {
        userId,
        name: user?.name ?? 'Reported user',
        initials: user?.initials ?? '??',
        gender: user?.gender ?? 'woman',
        city: user?.city ?? '',
        imageUrl: this.firstUserImage(user),
        profileStatus: user?.profileStatus ?? 'public',
        reportCount: sortedReports.length,
        lastReportedAtIso: sortedReports[0]?.createdDate ?? null,
        blockedAtIso: user?.profileStatus === 'blocked' ? sortedReports[0]?.createdDate ?? store.seededAtIso : null,
        hasSupportChat: this.demoSupportChatExists(activeAdmin.id, userId),
        supportChatUnread: this.demoSupportChatUnread(activeAdmin.id, userId),
        reports: sortedReports
      };
    }).sort((first, second) =>
      Date.parse(`${second.lastReportedAtIso ?? ''}`) - Date.parse(`${first.lastReportedAtIso ?? ''}`)
    );
    return {
      activeAdmin,
      activeAdminProfile: this.supportSession.findUser(activeAdmin.id),
      reportedUsers,
      blockedUsers: this.demoBlockedUsers(store, reportsByUser, activeAdmin.id),
      feedback: [...store.feedback].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      ).map(item => this.enrichDemoFeedback(item))
    };
  }

  private demoBlockedUsers(
    store: AdminModerationStore,
    reportsByUser: Map<string, AdminReportDto[]>,
    adminId: string
  ): AdminReportedUserDto[] {
    const reportedBlocked = [...reportsByUser.keys()]
      .map(userId => this.supportSession.findUser(userId))
      .filter((user): user is UserDto => user?.profileStatus === 'blocked');
    return reportedBlocked.map(user => {
      const reports = [...(reportsByUser.get(user.id) ?? [])].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      );
      return {
        userId: user.id,
        name: user.name,
        initials: user.initials,
        gender: user.gender,
        city: user.city,
        imageUrl: this.firstUserImage(user),
        profileStatus: user.profileStatus,
        reportCount: reports.length,
        lastReportedAtIso: reports[0]?.createdDate ?? store.seededAtIso,
        blockedAtIso: reports[0]?.createdDate ?? store.seededAtIso,
        hasSupportChat: this.demoSupportChatExists(adminId, user.id),
        supportChatUnread: this.demoSupportChatUnread(adminId, user.id),
        reports
      };
    }).sort((first, second) =>
      Date.parse(`${second.lastReportedAtIso ?? ''}`) - Date.parse(`${first.lastReportedAtIso ?? ''}`)
    );
  }

  private enrichDemoFeedback(feedback: AdminFeedbackDto): AdminFeedbackDto {
    const user = this.supportSession.findUser(feedback.userId);
    return {
      ...feedback,
      userName: user?.name ?? feedback.userName,
      userImageUrl: this.firstUserImage(user) ?? feedback.userImageUrl ?? null
    };
  }

  private enrichDemoReport(report: AdminReportDto): AdminReportDto {
    const reporter = this.supportSession.findUser(report.reporterUserId);
    if (report.chatId && (!report.chatMessages || report.chatMessages.length === 0)) {
      return {
        ...report,
        reporterImageUrl: this.firstUserImage(reporter) ?? report.reporterImageUrl ?? null,
        chatMessages: this.demoChatMessages(report.reporterUserId, report.chatId)
      };
    }
    return {
      ...report,
      reporterImageUrl: this.firstUserImage(reporter) ?? report.reporterImageUrl ?? null,
      chatMessages: [...(report.chatMessages ?? [])]
    };
  }

  private demoChatMessages(ownerUserId: string, chatId: string): AdminChatMessageDto[] {
    const chat = this.supportSession.findChatsByUser(ownerUserId)
      .find(item => item.id === chatId);
    if (!chat) {
      return [];
    }
    return this.supportSession.readChatMessages(chat).map(message => ({
      id: message.id,
      sender: message.sender,
      senderUserId: message.senderAvatar.id,
      senderInitials: message.senderAvatar.initials,
      senderGender: message.senderAvatar.gender,
      text: message.text,
      time: message.time,
      sentAtIso: message.sentAtIso
    }));
  }

  private demoSupportChatExists(adminId: string, userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return false;
    }
    return this.supportSession.findChatsByUser(normalizedAdminId)
      .some(chat => chat.id === `c-support-admin-${normalizedUserId}`);
  }

  private demoSupportChatUnread(adminId: string, userId: string): number {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return 0;
    }
    const chat = this.supportSession.findChatsByUser(normalizedAdminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
  }

  private firstUserImage(user: UserDto | null | undefined): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private mergeStoredAdminProfile(admin: AdminUserDto): AdminUserDto {
    const stored = this.supportSession.findUser(admin.id);
    if (!stored) {
      return admin;
    }
    const name = this.adminDisplayName(`${stored.name ?? ''}`.trim() || admin.name);
    return {
      ...admin,
      name,
      initials: `${stored.initials ?? ''}`.trim() || this.initialsFromName(name, admin.initials),
      headline: `${stored.headline ?? ''}`.trim() || admin.headline || null,
      about: `${stored.about ?? ''}`.trim() || admin.about || null,
      images: [...(stored.images ?? admin.images ?? [])]
    };
  }

  private demoAdminImages(adminUserId: string): string[] {
    return adminUserId.includes('noel')
      ? ['https://randomuser.me/api/portraits/men/75.jpg']
      : ['https://randomuser.me/api/portraits/women/65.jpg'];
  }

  private adminDisplayName(name: string): string {
    return `${name ?? ''}`.trim().replace(/\s+Moderation$/i, '') || 'Admin';
  }

  private initialsFromName(name: string, fallback: string): string {
    const initials = name.trim().split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || fallback;
  }
}
