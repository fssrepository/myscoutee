import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type {
  AdminChatMessageDto,
  AdminDashboardDto,
  AdminFeedbackDto,
  AdminModerationStore,
  AdminReportDto,
  AdminReportedUserDto,
  AdminReviewCountsDto,
  AdminUserDto
} from '../../../contracts/admin.interface';
import type { AdminReviewStatusFilter } from '../../../base/services/admin-workspace-data.service';
import { LocalAdminModerationRepository } from '../repositories/admin-moderation.repository';
import { LocalAdminModerationService } from './admin-moderation.service';
import { LocalAdminSupportSessionService } from './admin-support-session.service';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_WORKSPACE_LOAD_ROUTE = '/admin';
const ADMIN_REPORTS_LOAD_ROUTE = '/admin/reports';
const ADMIN_BLOCKED_USERS_LOAD_ROUTE = '/admin/reports/blocked-users';
const ADMIN_FEEDBACK_LOAD_ROUTE = '/admin/feedback';
const ADMIN_REPORTS_RESOLVE_ROUTE = '/admin/reports/resolve';
const ADMIN_FEEDBACK_RESOLVE_ROUTE = '/admin/feedback/resolve';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminWorkspaceService extends LocalRouteDelayService {
  private readonly moderationRepository = inject(LocalAdminModerationRepository);
  private readonly moderationService = inject(LocalAdminModerationService);
  private readonly supportSession = inject(LocalAdminSupportSessionService);

  async loadDashboard(
    adminUserId?: string,
    filters: { reportsStatus?: AdminReviewStatusFilter; feedbackStatus?: AdminReviewStatusFilter } = {}
  ): Promise<AdminDashboardDto> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_WORKSPACE_LOAD_ROUTE, dashboard => ({
      ...dashboard,
      reportedUsers: this.filterReportedUsers(dashboard.reportedUsers, filters.reportsStatus),
      feedback: this.filterFeedback(dashboard.feedback, filters.feedbackStatus)
    }));
  }

  async loadReportedUsers(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminReportedUserDto[]> {
    return await this.loadDashboardSlice(
      adminUserId,
      ADMIN_REPORTS_LOAD_ROUTE,
      dashboard => this.filterReportedUsers(dashboard.reportedUsers, status)
    );
  }

  async loadBlockedUsers(adminUserId?: string): Promise<AdminReportedUserDto[]> {
    return await this.loadDashboardSlice(adminUserId, ADMIN_BLOCKED_USERS_LOAD_ROUTE, dashboard => dashboard.blockedUsers);
  }

  async loadFeedback(adminUserId?: string, status?: AdminReviewStatusFilter): Promise<AdminFeedbackDto[]> {
    return await this.loadDashboardSlice(
      adminUserId,
      ADMIN_FEEDBACK_LOAD_ROUTE,
      dashboard => this.filterFeedback(dashboard.feedback, status)
    );
  }

  async setReportResolved(reportId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    await this.waitForRouteDelay(ADMIN_REPORTS_RESOLVE_ROUTE);
    await this.moderationRepository.whenReady();
    const admin = this.mergeStoredAdminProfile(this.resolveDemoAdmin(adminUserId));
    const normalizedReportId = `${reportId ?? ''}`.trim();
    const storeBefore = await this.moderationRepository.readStore();
    const reportBefore = storeBefore?.reports?.find(report => report.id === normalizedReportId) ?? null;
    const wasResolved = this.isReviewResolved(reportBefore);
    const store = await this.moderationRepository.setReportResolved(
      normalizedReportId,
      admin.id,
      resolved ? new Date().toISOString() : null
    );
    const report = store?.reports?.find(item => item.id === normalizedReportId) ?? null;
    if (resolved && !wasResolved && report?.reporterUserId) {
      await this.moderationService.sendSupportMessage(
        report.reporterUserId,
        admin,
        this.reportResolvedMessage(report),
        'solved'
      );
    }
    return store ? this.buildDemoDashboard(admin, store) : await this.readDashboard(admin.id);
  }

  async setFeedbackResolved(feedbackId: string, resolved: boolean, adminUserId?: string): Promise<AdminDashboardDto> {
    await this.waitForRouteDelay(ADMIN_FEEDBACK_RESOLVE_ROUTE);
    await this.moderationRepository.whenReady();
    const admin = this.mergeStoredAdminProfile(this.resolveDemoAdmin(adminUserId));
    const normalizedFeedbackId = `${feedbackId ?? ''}`.trim();
    const storeBefore = await this.moderationRepository.readStore();
    const feedbackBefore = storeBefore?.feedback?.find(item => item.id === normalizedFeedbackId) ?? null;
    const wasResolved = this.isReviewResolved(feedbackBefore);
    const store = await this.moderationRepository.setFeedbackResolved(
      normalizedFeedbackId,
      admin.id,
      resolved ? new Date().toISOString() : null
    );
    const feedback = store?.feedback?.find(item => item.id === normalizedFeedbackId) ?? null;
    if (resolved && !wasResolved && feedback?.userId) {
      await this.moderationService.sendSupportMessage(
        feedback.userId,
        admin,
        this.feedbackResolvedMessage(feedback),
        'solved'
      );
    }
    return store ? this.buildDemoDashboard(admin, store) : await this.readDashboard(admin.id);
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
      ).map(item => this.enrichDemoFeedback(item)),
      reviewCounts: this.demoReviewCounts(store)
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

  private demoReviewCounts(store: AdminModerationStore): AdminReviewCountsDto {
    return {
      reportsUnresolved: (store.reports ?? []).filter(report => !this.isReviewResolved(report)).length,
      reportsResolved: (store.reports ?? []).filter(report => this.isReviewResolved(report)).length,
      feedbackUnresolved: (store.feedback ?? []).filter(item => !this.isReviewResolved(item)).length,
      feedbackResolved: (store.feedback ?? []).filter(item => this.isReviewResolved(item)).length
    };
  }

  private filterReportedUsers(
    users: readonly AdminReportedUserDto[],
    status: AdminReviewStatusFilter | null | undefined
  ): AdminReportedUserDto[] {
    if (!status) {
      return [...users];
    }
    return users.map(user => {
      const reports = user.reports.filter(report => this.matchesReviewStatus(report, status));
      return {
        ...user,
        reportCount: reports.length,
        lastReportedAtIso: reports[0]?.createdDate ?? null,
        reports
      };
    }).filter(user => user.reports.length > 0);
  }

  private filterFeedback(
    feedback: readonly AdminFeedbackDto[],
    status: AdminReviewStatusFilter | null | undefined
  ): AdminFeedbackDto[] {
    return status
      ? feedback.filter(item => this.matchesReviewStatus(item, status))
      : [...feedback];
  }

  private matchesReviewStatus(
    item: { resolvedAtIso?: string | null } | null | undefined,
    status: AdminReviewStatusFilter
  ): boolean {
    const resolved = this.isReviewResolved(item);
    return status === 'resolved' ? resolved : !resolved;
  }

  private isReviewResolved(item: { resolvedAtIso?: string | null } | null | undefined): boolean {
    return `${item?.resolvedAtIso ?? ''}`.trim().length > 0;
  }

  private reportResolvedMessage(report: AdminReportDto): string {
    const subject = `${report.handle ?? ''}`.trim();
    return subject
      ? `Your report about ${subject} has been reviewed by MyScoutee moderation. Thank you for helping keep MyScoutee safe.`
      : 'Your report has been reviewed by MyScoutee moderation. Thank you for helping keep MyScoutee safe.';
  }

  private feedbackResolvedMessage(feedback: AdminFeedbackDto): string {
    const subject = `${feedback.subject ?? ''}`.trim();
    return subject
      ? `Your feedback "${subject}" has been reviewed by MyScoutee. Thank you for helping improve the app.`
      : 'Your feedback has been reviewed by MyScoutee. Thank you for helping improve the app.';
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
