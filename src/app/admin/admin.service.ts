import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import {
  AppContext,
  AppPopupContext,
  SessionService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type DemoUserListItemDto,
  type UserDto
} from '../shared/core';
import { AppMemoryDb } from '../shared/core/base/db';
import type { ChatMenuItem } from '../shared/core/base/interfaces/activity-feed.interface';
import type { ChatPopupMessage } from '../shared/core/base/models/chat.model';
import { DemoChatsRepository, DemoUsersRepository } from '../shared/core/demo';

export type AdminPopupKind =
  | 'reports'
  | 'feedback'
  | 'chat'
  | 'chat-review'
  | 'warn-chat'
  | 'profile'
  | 'item-preview';

export interface AdminUserDto {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface AdminChatMessageDto {
  id: string;
  sender: string;
  senderUserId?: string | null;
  senderInitials?: string | null;
  senderGender?: 'woman' | 'man' | string | null;
  text: string;
  time?: string | null;
  sentAtIso?: string | null;
}

export interface AdminReportDto {
  id: string;
  reporterUserId: string;
  reporterName: string;
  targetUserId: string;
  reason: string;
  details: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceText?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  assetId?: string | null;
  assetType?: string | null;
  chatTitle?: string | null;
  chatMessages?: AdminChatMessageDto[];
  createdDate: string;
}

export interface AdminReportedUserDto {
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man' | string;
  city: string;
  profileStatus: UserDto['profileStatus'] | string;
  reportCount: number;
  lastReportedAtIso?: string | null;
  reports: AdminReportDto[];
}

export interface AdminFeedbackDto {
  id: string;
  userId: string;
  userName: string;
  category: string;
  subject: string;
  details: string;
  createdDate: string;
}

export interface AdminDashboardDto {
  activeAdmin: AdminUserDto;
  reportedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}

interface AdminModerationStore {
  seededAtIso: string;
  reports: AdminReportDto[];
  feedback: AdminFeedbackDto[];
}

type AdminBootstrapProgressStage = 'selector' | 'indexedDb' | 'records' | 'profile' | 'ready';

export interface AdminBootstrapProgressState {
  percent: number;
  label: string;
  stage: AdminBootstrapProgressStage;
}

const ADMIN_SESSION_STORAGE_KEY = 'myscoutee-admin-session';
const ADMIN_MODERATION_STORE_KEY = 'adminModeration';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly sessionService = inject(SessionService);
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly demoChatsRepository = inject(DemoChatsRepository);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly dashboardRef = signal<AdminDashboardDto | null>(null);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly activePopupRef = signal<AdminPopupKind | null>(null);
  private readonly selectedReportedUserRef = signal<AdminReportedUserDto | null>(null);
  private readonly selectedReportRef = signal<AdminReportDto | null>(null);

  readonly dashboard = this.dashboardRef.asReadonly();
  readonly busy = this.busyRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly activePopup = this.activePopupRef.asReadonly();
  readonly selectedReportedUser = this.selectedReportedUserRef.asReadonly();
  readonly selectedReport = this.selectedReportRef.asReadonly();
  readonly activeAdmin = computed(() => this.dashboardRef()?.activeAdmin ?? null);
  readonly adminUsers = signal<DemoUserListItemDto[]>([
    {
      id: 'admin-demo-ava',
      name: 'Ava Moderation',
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

  get isFirebaseAdminMode(): boolean {
    return environment.loginEnabled === true;
  }

  get usesHttpAdminApi(): boolean {
    return environment.activitiesDataSource === 'http' || this.isFirebaseAdminMode;
  }

  async restoreAdminSession(): Promise<boolean> {
    const adminId = this.readStoredAdminId();
    if (!adminId) {
      return false;
    }
    try {
      if (this.usesHttpAdminApi && !this.isFirebaseAdminMode) {
        this.sessionService.startDemoSession(adminId);
      }
      await this.bootstrapAdmin(adminId);
      return true;
    } catch {
      this.clearAdminSession();
      return false;
    }
  }

  async bootstrapAdmin(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProgressState) => void
  ): Promise<AdminDashboardDto | null> {
    if (this.busyRef()) {
      return this.dashboardRef();
    }
    this.busyRef.set(true);
    this.errorRef.set('');
    try {
      const dashboard = this.usesHttpAdminApi
        ? await this.loadHttpDashboard(adminUserId)
        : await this.loadDemoDashboard(adminUserId, onProgress);
      this.dashboardRef.set(dashboard);
      this.activateAdminProfile(dashboard);
      this.persistAdminSession(dashboard.activeAdmin.id);
      return dashboard;
    } catch (error) {
      this.errorRef.set(this.errorMessage(error));
      return null;
    } finally {
      this.busyRef.set(false);
    }
  }

  openReports(user?: AdminReportedUserDto | null): void {
    const resolvedUser = user ?? this.dashboardRef()?.reportedUsers[0] ?? null;
    this.selectedReportedUserRef.set(resolvedUser);
    this.selectedReportRef.set(resolvedUser?.reports[0] ?? null);
    this.activePopupRef.set('reports');
  }

  openFeedback(): void {
    this.activePopupRef.set('feedback');
  }

  openChat(): void {
    this.popupCtx.openNavigatorActivitiesRequest('chats');
  }

  openProfile(): void {
    this.activePopupRef.set('profile');
  }

  openReportDetail(user: AdminReportedUserDto, report: AdminReportDto): void {
    this.selectedReportedUserRef.set(user);
    this.selectedReportRef.set(report);
  }

  openChatReview(report: AdminReportDto): void {
    this.selectedReportRef.set(report);
    this.activePopupRef.set('chat-review');
  }

  openWarnChat(user: AdminReportedUserDto): void {
    this.selectedReportedUserRef.set(user);
    this.activePopupRef.set('warn-chat');
  }

  openItemPreview(report: AdminReportDto): void {
    this.selectedReportRef.set(report);
    this.activePopupRef.set('item-preview');
  }

  closePopup(): void {
    this.activePopupRef.set(null);
  }

  async warnUser(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/warn`,
        {
          adminUserId: this.activeAdmin()?.id ?? '',
          message
        }
      ).toPromise();
      if (dashboard) {
        this.dashboardRef.set(this.normalizeDashboard(dashboard));
        this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
      }
      return;
    }
    await this.appendDemoSupportMessage(normalizedUserId, message);
    this.dashboardRef.set(await this.loadDemoDashboard(this.activeAdmin()?.id));
    this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
  }

  async blockUser(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/block`,
        {
          adminUserId: this.activeAdmin()?.id ?? '',
          message
        }
      ).toPromise();
      if (dashboard) {
        this.dashboardRef.set(this.normalizeDashboard(dashboard));
        this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
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
    await this.memoryDb.flushToIndexedDb();
    this.dashboardRef.set(await this.loadDemoDashboard(this.activeAdmin()?.id));
    this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
  }

  updateAdminProfile(patch: Pick<UserDto, 'name' | 'headline' | 'about'>): void {
    const admin = this.activeAdmin();
    const current = this.appCtx.activeUserProfile();
    if (!admin || !current) {
      return;
    }
    const nextUser: UserDto = {
      ...current,
      name: patch.name.trim() || current.name,
      initials: this.initialsFromName(patch.name.trim() || current.name, current.initials),
      headline: patch.headline.trim(),
      about: patch.about.trim()
    };
    this.appCtx.setUserProfile(nextUser);
    const nextAdmin: AdminUserDto = {
      ...admin,
      name: nextUser.name,
      initials: this.initialsFromName(nextUser.name, admin.initials)
    };
    const dashboard = this.dashboardRef();
    if (dashboard) {
      this.dashboardRef.set({
        ...dashboard,
        activeAdmin: nextAdmin
      });
      this.persistAdminSession(nextAdmin.id);
    }
  }

  clearAdminSession(): void {
    this.dashboardRef.set(null);
    this.activePopupRef.set(null);
    this.selectedReportedUserRef.set(null);
    this.selectedReportRef.set(null);
    this.appCtx.setActiveUserId('');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  }

  private async loadHttpDashboard(adminUserId?: string): Promise<AdminDashboardDto> {
    const dashboard = await this.http
      .post<AdminDashboardDto>(`${this.apiBaseUrl}/admin/bootstrap`, {
        adminUserId: adminUserId?.trim() ?? ''
      })
      .toPromise();
    if (!dashboard) {
      throw new Error('Admin dashboard is unavailable.');
    }
    return this.normalizeDashboard(dashboard);
  }

  private async loadDemoDashboard(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProgressState) => void
  ): Promise<AdminDashboardDto> {
    const admin = this.resolveDemoAdmin(adminUserId);
    onProgress?.({ percent: 18, label: 'Preparing admin data', stage: 'indexedDb' });
    await this.memoryDb.whenReady();
    this.demoUsersRepository.init();
    this.demoChatsRepository.init();
    onProgress?.({ percent: 48, label: 'Creating moderation records', stage: 'records' });
    const store = await this.ensureDemoModerationStore();
    onProgress?.({ percent: 74, label: 'Resolving reported users', stage: 'records' });
    const dashboard = this.buildDemoDashboard(admin, store);
    onProgress?.({ percent: 92, label: 'Opening admin workspace', stage: 'profile' });
    await this.waitForBeat();
    onProgress?.({ percent: 100, label: 'Admin workspace ready', stage: 'ready' });
    return dashboard;
  }

  private async ensureDemoModerationStore(): Promise<AdminModerationStore> {
    const existing = await this.memoryDb.readIndexedDbTableEntry<AdminModerationStore>(ADMIN_MODERATION_STORE_KEY);
    if (existing?.reports?.length) {
      return this.normalizeStore(existing);
    }
    const seeded = this.buildSeedDemoModerationStore();
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_MODERATION_STORE_KEY, seeded);
    return seeded;
  }

  private buildSeedDemoModerationStore(): AdminModerationStore {
    return {
      seededAtIso: new Date().toISOString(),
      reports: [
        {
          id: 'admin-demo-report-chat-kai-001',
          reporterUserId: 'bf057de7c586eede7e84bdc7',
          reporterName: 'Farkas Anna',
          targetUserId: '7822c5f99eff99d63abe8933',
          reason: 'Harassment',
          details: 'The reported chat message made another event member feel unsafe and should be reviewed by moderation.',
          eventId: 'a11a802ee0714a21db94ed4e',
          eventTitle: 'Alpine Weekend 2.0',
          eventStartAtIso: '2026-03-04T09:45:00.000Z',
          sourceType: 'chat',
          sourceId: 'cc9765dfe5f1b00b8ba39a38',
          sourceText: 'Synced on arrival windows.',
          chatId: '60c8f35688886a1030926aed',
          messageId: 'cc9765dfe5f1b00b8ba39a38',
          chatTitle: 'Group A · Group Channel',
          chatMessages: this.demoChatMessages('bf057de7c586eede7e84bdc7', '60c8f35688886a1030926aed'),
          createdDate: '2026-04-25T11:12:00.000Z'
        },
        {
          id: 'admin-demo-report-event-kai-002',
          reporterUserId: 'bf057de7c586eede7e84bdc7',
          reporterName: 'Farkas Anna',
          targetUserId: '7822c5f99eff99d63abe8933',
          reason: 'No-show / unsafe event behavior',
          details: 'The user repeatedly joined event plans and disrupted logistics without updating the host.',
          eventId: 'a11a802ee0714a21db94ed4e',
          eventTitle: 'Alpine Weekend 2.0',
          eventStartAtIso: '2026-03-04T09:45:00.000Z',
          sourceType: 'event',
          sourceId: 'a11a802ee0714a21db94ed4e',
          sourceText: 'Host reported repeated logistics disruption before Alpine Weekend 2.0.',
          createdDate: '2026-04-26T16:35:00.000Z'
        },
        {
          id: 'admin-demo-report-asset-kai-003',
          reporterUserId: 'b5e2db6882d989d8532af12c',
          reporterName: 'Ava Baker',
          targetUserId: '7822c5f99eff99d63abe8933',
          reason: 'Asset misuse',
          details: 'Asset owner asked moderation to review a supplies request before approving future resource sharing.',
          eventId: 'indoor-strategy-social-event',
          eventTitle: 'Indoor Strategy Social',
          eventStartAtIso: '2026-05-02T17:30:00.000Z',
          sourceType: 'asset',
          sourceId: 'f7b9be40d648a5448d018308',
          sourceText: 'Game Night Box request needs moderation review.',
          assetId: 'f7b9be40d648a5448d018308',
          assetType: 'Supplies',
          createdDate: '2026-04-27T09:20:00.000Z'
        }
      ],
      feedback: [
        {
          id: 'admin-demo-feedback-report-status-001',
          userId: 'bf057de7c586eede7e84bdc7',
          userName: 'Farkas Anna',
          category: 'Safety',
          subject: 'Need clearer report status',
          details: 'After reporting a user, I would like to see whether moderation has reviewed the report.',
          createdDate: '2026-04-24T13:20:00.000Z'
        },
        {
          id: 'admin-demo-feedback-event-warn-002',
          userId: '7822c5f99eff99d63abe8933',
          userName: 'Kai Morgan',
          category: 'Events',
          subject: 'Review event behavior faster',
          details: 'Hosts need a way to warn members before blocking them from future participation.',
          createdDate: '2026-04-23T18:05:00.000Z'
        }
      ]
    };
  }

  private buildDemoDashboard(admin: AdminUserDto, store: AdminModerationStore): AdminDashboardDto {
    const reportsByUser = new Map<string, AdminReportDto[]>();
    for (const report of store.reports) {
      const key = report.targetUserId.trim();
      if (!key) {
        continue;
      }
      reportsByUser.set(key, [...(reportsByUser.get(key) ?? []), this.enrichDemoReport(report)]);
    }
    const reportedUsers = [...reportsByUser.entries()].map(([userId, reports]) => {
      const user = this.demoUsersRepository.queryUserById(userId);
      const sortedReports = [...reports].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      );
      return {
        userId,
        name: user?.name ?? 'Reported user',
        initials: user?.initials ?? '??',
        gender: user?.gender ?? 'woman',
        city: user?.city ?? '',
        profileStatus: user?.profileStatus ?? 'public',
        reportCount: sortedReports.length,
        lastReportedAtIso: sortedReports[0]?.createdDate ?? null,
        reports: sortedReports
      };
    }).sort((first, second) =>
      Date.parse(`${second.lastReportedAtIso ?? ''}`) - Date.parse(`${first.lastReportedAtIso ?? ''}`)
    );
    return {
      activeAdmin: admin,
      reportedUsers,
      feedback: [...store.feedback].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      )
    };
  }

  private enrichDemoReport(report: AdminReportDto): AdminReportDto {
    if (report.chatId && (!report.chatMessages || report.chatMessages.length === 0)) {
      return {
        ...report,
        chatMessages: this.demoChatMessages(report.reporterUserId, report.chatId)
      };
    }
    return {
      ...report,
      chatMessages: [...(report.chatMessages ?? [])]
    };
  }

  private demoChatMessages(ownerUserId: string, chatId: string): AdminChatMessageDto[] {
    const chat = this.demoChatsRepository.queryChatItemsByUser(ownerUserId)
      .find(item => item.id === chatId);
    if (!chat) {
      return [];
    }
    return this.demoChatsRepository.queryChatMessages(chat).map(message => ({
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

  private async appendDemoSupportMessage(userId: string, text: string): Promise<void> {
    const admin = this.activeAdmin() ?? this.resolveDemoAdmin();
    const nowIso = new Date().toISOString();
    const chat: ChatMenuItem & { ownerUserId?: string } = {
      id: `c-support-admin-${userId}`,
      avatar: admin.initials,
      title: 'MyScoutee Support',
      lastMessage: text,
      lastSenderId: admin.id,
      memberIds: [userId, admin.id],
      unread: 1,
      dateIso: nowIso,
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: userId
    };
    const message: ChatPopupMessage = {
      id: `m-admin-${Date.now()}`,
      sender: admin.name,
      senderAvatar: {
        id: admin.id,
        initials: admin.initials,
        gender: 'woman'
      },
      text,
      time: 'Now',
      sentAtIso: nowIso,
      mine: false,
      readBy: []
    };
    this.demoChatsRepository.appendChatMessage(chat, message);
    await this.memoryDb.flushToIndexedDb();
  }

  private normalizeStore(store: AdminModerationStore): AdminModerationStore {
    return {
      seededAtIso: store.seededAtIso || new Date().toISOString(),
      reports: Array.isArray(store.reports) ? store.reports.map(report => ({ ...report })) : [],
      feedback: Array.isArray(store.feedback) ? store.feedback.map(item => ({ ...item })) : []
    };
  }

  private normalizeDashboard(dashboard: AdminDashboardDto): AdminDashboardDto {
    return {
      activeAdmin: dashboard.activeAdmin,
      reportedUsers: (dashboard.reportedUsers ?? []).map(user => ({
        ...user,
        reports: (user.reports ?? []).map(report => ({
          ...report,
          chatMessages: [...(report.chatMessages ?? [])]
        }))
      })),
      feedback: (dashboard.feedback ?? []).map(item => ({ ...item }))
    };
  }

  private activateAdminProfile(dashboard: AdminDashboardDto): void {
    const admin = dashboard.activeAdmin;
    const user = this.buildAdminProfile(admin, dashboard);
    this.appCtx.setUserProfile(user);
    this.appCtx.setActiveUserId(user.id);
    this.appCtx.setStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
    this.appCtx.patchUserCounterOverrides(user.id, {
      game: dashboard.reportedUsers.reduce((total, item) => total + item.reportCount, 0),
      chat: 1,
      events: dashboard.reportedUsers.length,
      hosting: 0,
      invitations: 0,
      tickets: 0,
      feedback: dashboard.feedback.length
    });
  }

  private buildAdminProfile(admin: AdminUserDto, dashboard: AdminDashboardDto): UserDto {
    return {
      id: admin.id,
      name: admin.name,
      age: 0,
      birthday: '',
      city: 'Admin',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials: admin.initials,
      gender: admin.id.includes('noel') ? 'man' : 'woman',
      statusText: 'Admin workspace',
      hostTier: 'Admin',
      traitLabel: 'Safety',
      completion: 100,
      headline: 'Moderation workspace',
      about: 'Reviews reports, feedback, and support chats.',
      images: [],
      profileStatus: 'public',
      activities: {
        game: dashboard.reportedUsers.reduce((total, item) => total + item.reportCount, 0),
        chat: 1,
        invitations: 0,
        events: dashboard.reportedUsers.length,
        hosting: 0,
        tickets: 0,
        feedback: dashboard.feedback.length
      }
    };
  }

  private resolveDemoAdmin(adminUserId?: string): AdminUserDto {
    const id = `${adminUserId ?? ''}`.trim();
    if (id === 'admin-demo-noel') {
      return {
        id: 'admin-demo-noel',
        name: 'Noel Safety',
        initials: 'NS',
        email: 'noel.admin@myscoutee.local'
      };
    }
    return {
      id: 'admin-demo-ava',
      name: 'Ava Moderation',
      initials: 'AM',
      email: 'ava.admin@myscoutee.local'
    };
  }

  private persistAdminSession(adminUserId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ adminUserId }));
  }

  private readStoredAdminId(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) {
      return '';
    }
    try {
      const parsed = JSON.parse(raw) as { adminUserId?: unknown };
      return typeof parsed.adminUserId === 'string' ? parsed.adminUserId.trim() : '';
    } catch {
      return '';
    }
  }

  private initialsFromName(name: string, fallback: string): string {
    const initials = name.trim().split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || fallback;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Admin workspace is unavailable.';
  }

  private waitForBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 180));
  }
}
