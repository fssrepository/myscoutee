import { Location } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

import {
  AdminDemoDataService,
  AdminWorkspaceDataService,
  BootstrapProcessService,
  type AdminMonitoringStateDto,
  type AdminNotificationCenterState,
  type UserDto,
  type UserSelectorListItemDto
} from '../../shared/core';
import type { ChatPopupMessage, ChatRecord } from '../../shared/core/base/models/chat.model';
import type { AdminDashboardDto } from '../models/admin-dashboard.model';
import type { AdminHelpTarget } from '../models/admin-help.model';
import type {
  AdminChatMessageDto,
  AdminFeedbackDto,
  AdminModerationStore,
  AdminReportDto,
  AdminReportedUserDto
} from '../models/admin-moderation.model';
import type { AdminUserDto } from '../models/admin-profile.model';
import type { AdminBootstrapProcessState } from '../models/admin-shell.model';
import { AdminHelpSeedBuilder } from '../builders/admin-help-seed.builder';
import { AdminModerationSeedBuilder } from '../builders/admin-moderation-seed.builder';
import { AdminMonitoringSeedBuilder } from '../builders/admin-monitoring-seed.builder';
import { AdminNotificationsSeedBuilder } from '../builders/admin-notifications-seed.builder';
import { AdminParamsSeedBuilder } from '../builders/admin-params-seed.builder';
import { AdminProfileSeedBuilder } from '../builders/admin-profile-seed.builder';
import { AdminStatsSeedBuilder } from '../builders/admin-stats-seed.builder';

const ADMIN_DEMO_SELECTOR_PROCESS_STEPS: readonly AdminBootstrapProcessState[] = [
  { stage: 'records', percent: 24, label: 'Preparing admin graph members' },
  { stage: 'records', percent: 54, label: 'Preparing admin graph ratings' },
  { stage: 'affinityGraph', percent: 82, label: 'Preparing admin affinity graph' },
  { stage: 'ready', percent: 100, label: 'Admin selector ready' }
];

@Injectable({
  providedIn: 'root'
})
export class AdminBootstrapService {
  private readonly location = inject(Location);
  private readonly demoData = inject(AdminDemoDataService);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly bootstrapProcess = inject(BootstrapProcessService);
  private demoAdminSelectorPromise: Promise<void> | null = null;
  private demoAdminSelectorReady = false;

  readonly adminUsers = signal<UserSelectorListItemDto[]>([
    {
      id: 'admin-demo-ava',
      name: 'Ava',
      city: 'Safety desk',
      initials: 'AM',
      gender: 'woman',
      profileStatus: 'public'
    },
    {
      id: 'admin-demo-noel',
      name: 'Noel Safety',
      city: 'Trust desk',
      initials: 'NS',
      gender: 'man',
      profileStatus: 'public'
    }
  ]).asReadonly();

  async prepareAdminSelector(
    useHttpAdminApi: boolean,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<UserSelectorListItemDto[]> {
    if (useHttpAdminApi || this.demoAdminSelectorReady) {
      onProgress?.({ percent: 100, label: 'Admin selector ready', stage: 'ready' });
      return this.adminUsers();
    }

    if (!this.demoAdminSelectorPromise) {
      this.demoAdminSelectorPromise = this.bootstrapDemoAdminSelector(onProgress)
        .finally(() => {
          this.demoAdminSelectorPromise = null;
        });
    }
    await this.demoAdminSelectorPromise;
    return this.adminUsers();
  }

  async bootstrapDashboard(
    useHttpAdminApi: boolean,
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto> {
    if (useHttpAdminApi) {
      return await this.workspaceData.loadDashboard(adminUserId);
    }
    return await this.bootstrapDemoDashboardData(adminUserId, onProgress);
  }

  private async bootstrapDemoDashboardData(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto> {
    const admin = this.resolveDemoAdmin(adminUserId);
    await this.prepareAdminSelector(false);
    onProgress?.({ percent: 18, label: 'Preparing admin data', stage: 'indexedDb' });
    await this.demoData.whenUsersReady();
    await this.initOptionalDemoHelpCenter();
    await this.demoData.initIdeaPosts();
    this.demoData.initUsers();
    this.demoData.initUserRatings();
    await this.ensureDemoAdminProfiles();
    onProgress?.({ percent: 36, label: 'Preparing admin records', stage: 'records' });
    this.demoData.initChats();
    await this.clearDemoAdminStores();
    await this.seedDemoNotificationCenter();
    await this.seedDemoMonitoring();
    await this.seedDemoStats();
    await this.seedDemoParams();
    await this.seedDemoAdminMenuCounters();
    onProgress?.({ percent: 48, label: 'Creating moderation records', stage: 'records' });
    const store = await this.seedDemoModerationStore();
    await this.ensureDemoAdminSupportSeed(admin);
    onProgress?.({ percent: 74, label: 'Resolving reported users', stage: 'records' });
    const dashboard = this.buildDemoDashboard(admin, store);
    onProgress?.({ percent: 92, label: 'Opening admin workspace', stage: 'profile' });
    onProgress?.({ percent: 100, label: 'Admin workspace ready', stage: 'ready' });
    return dashboard;
  }

  private async initOptionalDemoHelpCenter(): Promise<void> {
    try {
      await this.demoData.initHelpCenter();
    } catch {
      // Help, privacy, and explanation content should never block admin demo bootstrap.
    }
  }

  private async bootstrapDemoAdminSelector(
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<void> {
    this.demoAdminSelectorReady = false;
    const seededUsers = await this.runAdminSelectorStep(onProgress, ADMIN_DEMO_SELECTOR_PROCESS_STEPS[0], () =>
      this.demoData.initUsers()
    );
    await this.runAdminSelectorStep(onProgress, ADMIN_DEMO_SELECTOR_PROCESS_STEPS[1], () => {
      this.demoData.initUserRatings(seededUsers);
    });
    await this.runAdminSelectorStep(onProgress, ADMIN_DEMO_SELECTOR_PROCESS_STEPS[2], () =>
      this.demoData.buildAndWriteAffinityGraphSnapshot()
    );
    this.demoAdminSelectorReady = true;
    onProgress?.(ADMIN_DEMO_SELECTOR_PROCESS_STEPS[3]);
  }

  private async runAdminSelectorStep<T = void>(
    onProgress: ((state: AdminBootstrapProcessState) => void) | undefined,
    step: AdminBootstrapProcessState,
    work?: () => T | Promise<T>
  ): Promise<T> {
    return await this.bootstrapProcess.runStep(step, onProgress, work);
  }

  private async clearDemoAdminStores(): Promise<void> {
    await this.demoData.clearAdminStores();
  }

  private async seedDemoModerationStore(): Promise<AdminModerationStore> {
    const seeded = this.buildSeedDemoModerationStore();
    await this.demoData.writeAdminModerationStore(seeded);
    return seeded;
  }

  private async seedDemoNotificationCenter(): Promise<void> {
    await this.demoData.writeAdminNotificationCenter(AdminNotificationsSeedBuilder.buildDefaultNotificationCenter());
  }

  private async seedDemoMonitoring(): Promise<void> {
    await this.demoData.writeAdminMonitoring(AdminMonitoringSeedBuilder.buildDefaultMonitoringState());
  }

  private async seedDemoStats(): Promise<void> {
    await this.demoData.writeAdminStats(AdminStatsSeedBuilder.buildSeedDemoStatsSnapshot());
  }

  private async seedDemoParams(): Promise<void> {
    await this.demoData.writeAdminParams(AdminParamsSeedBuilder.buildDefaultParamsStore());
  }

  private async seedDemoAdminMenuCounters(): Promise<void> {
    const [notificationCenter, monitoringState] = await Promise.all([
      this.demoData.readAdminNotificationCenter<AdminNotificationCenterState>(),
      this.demoData.readAdminMonitoring<AdminMonitoringStateDto>()
    ]);
    const adminJobs = this.countFailedNotificationRules(notificationCenter);
    const adminMetrics = this.countAlertMonitoringMetrics(monitoringState);
    for (const admin of this.adminUsers()) {
      const user = this.demoData.queryUserById(admin.id);
      if (!user) {
        continue;
      }
      const nextActivities = {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0)),
        tickets: Math.max(0, Math.trunc(Number(user.activities?.tickets) || 0)),
        feedback: Math.max(0, Math.trunc(Number(user.activities?.feedback) || 0)),
        adminJobs,
        adminMetrics
      };
      if (
        nextActivities.adminJobs === Math.max(0, Math.trunc(Number(user.activities?.adminJobs) || 0))
        && nextActivities.adminMetrics === Math.max(0, Math.trunc(Number(user.activities?.adminMetrics) || 0))
      ) {
        continue;
      }
      await this.demoData.upsertUser({
        ...user,
        activities: nextActivities
      });
    }
  }

  private countFailedNotificationRules(state: AdminNotificationCenterState | null | undefined): number {
    return (state?.rules ?? []).filter(rule => {
      const current = `${rule.runState?.currentStatus ?? ''}`.trim().toLowerCase();
      const last = `${rule.runState?.lastRunStatus ?? ''}`.trim().toLowerCase();
      return this.isFailureStatus(current) || this.isFailureStatus(last);
    }).length;
  }

  private countAlertMonitoringMetrics(state: AdminMonitoringStateDto | null | undefined): number {
    return (state?.categories ?? [])
      .flatMap(category => category.nodes ?? [])
      .flatMap(node => node.metrics ?? [])
      .filter(metric => metric.status === 'alert' || this.isFailureStatus(metric.key) || this.isFailureStatus(metric.labelKey))
      .reduce((total, metric) => total + Math.max(0, Math.trunc(Number(metric.value) || 0)), 0);
  }

  private isFailureStatus(value: string): boolean {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('failed')
      || normalized.includes('error')
      || normalized.includes('missed')
      || normalized.includes('timeout')
      || normalized.includes('hiany')
      || normalized.includes('hiba');
  }

  private buildSeedDemoModerationStore(): AdminModerationStore {
    return AdminModerationSeedBuilder.buildSeedDemoModerationStore({
      userImageUrl: userId => this.firstUserImage(this.demoData.queryUserById(userId)),
      chatMessages: (ownerUserId, chatId) => this.demoChatMessages(ownerUserId, chatId)
    });
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
      const user = this.demoData.queryUserById(userId);
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
      activeAdminProfile: this.demoData.queryUserById(activeAdmin.id),
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
      .map(userId => this.demoData.queryUserById(userId))
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

  private async ensureDemoAdminProfiles(): Promise<void> {
    const admins = [
      this.resolveDemoAdmin('admin-demo-ava'),
      this.resolveDemoAdmin('admin-demo-noel')
    ];
    for (const admin of admins) {
      const existing = this.demoData.queryUserById(admin.id);
      if (existing) {
        const seededImages = this.demoAdminImages(admin.id);
        const existingImages = existing.images ?? [];
        if (
          seededImages.length > 0
          && (existingImages.length === 0 || existingImages.some(image => this.isLegacyDemoAdminImage(image)))
        ) {
          await this.demoData.upsertUser({
            ...existing,
            images: seededImages
          });
        }
        continue;
      }
      await this.demoData.upsertUser(AdminProfileSeedBuilder.buildDemoAdminUser(admin));
    }
  }

  private enrichDemoFeedback(feedback: AdminFeedbackDto): AdminFeedbackDto {
    const user = this.demoData.queryUserById(feedback.userId);
    return {
      ...feedback,
      userName: user?.name ?? feedback.userName,
      userImageUrl: this.firstUserImage(user) ?? feedback.userImageUrl ?? null
    };
  }

  private firstUserImage(user: UserDto | null | undefined): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private enrichDemoReport(report: AdminReportDto): AdminReportDto {
    const reporter = this.demoData.queryUserById(report.reporterUserId);
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

  private async ensureDemoAdminSupportSeed(admin: AdminUserDto): Promise<void> {
    const helpUser = this.demoData.queryUserById('u1');
    if (!helpUser) {
      return;
    }
    const now = new Date();
    const chat: ChatRecord & { ownerUserId?: string } = {
      id: `c-admin-service-help-${helpUser.id}`,
      avatar: helpUser.initials,
      title: `MyScoutee Support · ${helpUser.name}`,
      lastMessage: 'Please help me with what I see on MyScoutee.',
      lastSenderId: helpUser.id,
      memberIds: [admin.id, helpUser.id],
      unread: 1,
      dateIso: now.toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: admin.id
    };
    const existingChat = this.demoData.queryChatItemsByUser(admin.id)
      .find(item => item.id === chat.id);
    const existingMessageIds = new Set(
      existingChat ? this.demoData.queryChatMessages(existingChat).map(message => message.id) : []
    );
    let changed = false;
    const targets = this.demoAdminHelpTargets();
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      if (!target) {
        continue;
      }
      const token = this.demoData.ensureAdminHelpToken({
        adminId: admin.id,
        userId: helpUser.id,
        targetKey: target.key,
        targetUrl: target.targetUrl
      });
      const helpUrl = this.location.prepareExternalUrl(`/admin/help/${encodeURIComponent(token)}`);
      const sentAt = new Date(now.getTime() + index * 1000);
      const sentAtIso = sentAt.toISOString();
      const message: ChatPopupMessage = {
        id: target.messageId,
        sender: helpUser.name,
        senderAvatar: {
          id: helpUser.id,
          initials: helpUser.initials,
          gender: helpUser.gender
        },
        text: target.text,
        time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        sentAtIso,
        mine: false,
        readBy: [],
        attachments: [{
          id: target.attachmentId,
          type: target.attachmentType,
          title: target.title,
          entityId: target.attachmentType === 'link' ? token : target.attachmentEntityId,
          assetType: target.assetType ?? null,
          ownerUserId: helpUser.id,
          subtitle: target.subtitle,
          description: target.description,
          url: helpUrl,
          previewUrl: target.previewUrl ?? null
        }]
      };
      if (existingMessageIds.has(target.messageId) && existingChat) {
        await this.demoData.updateChatMessage(existingChat, target.messageId, {
          attachments: message.attachments ?? []
        });
        changed = true;
        continue;
      }
      await this.demoData.appendChatMessage(chat, message);
      changed = true;
    }
    if (changed) {
      await this.bootstrapProcess.waitForUiYield();
    }
  }

  private demoAdminHelpTargets(): AdminHelpTarget[] {
    return AdminHelpSeedBuilder.demoAdminHelpTargets();
  }

  private demoChatMessages(ownerUserId: string, chatId: string): AdminChatMessageDto[] {
    const chat = this.demoData.queryChatItemsByUser(ownerUserId)
      .find(item => item.id === chatId);
    if (!chat) {
      return [];
    }
    return this.demoData.queryChatMessages(chat).map(message => ({
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
    return this.demoData.queryChatItemsByUser(normalizedAdminId)
      .some(chat => chat.id === `c-support-admin-${normalizedUserId}`);
  }

  private demoSupportChatUnread(adminId: string, userId: string): number {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return 0;
    }
    const chat = this.demoData.queryChatItemsByUser(normalizedAdminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
  }

  private resolveDemoAdmin(adminUserId?: string): AdminUserDto {
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

  private demoAdminImages(adminUserId: string): string[] {
    return AdminProfileSeedBuilder.demoAdminImages(adminUserId);
  }

  private isLegacyDemoAdminImage(imageUrl: string | null | undefined): boolean {
    return AdminProfileSeedBuilder.isLegacyDemoAdminImage(imageUrl);
  }

  private mergeStoredAdminProfile(admin: AdminUserDto): AdminUserDto {
    const stored = this.demoData.queryUserById(admin.id);
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
