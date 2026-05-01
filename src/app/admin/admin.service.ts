import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import {
  AppContext,
  AppPopupContext,
  SessionService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type ShareTokenRecord,
  type DemoUserListItemDto,
  type UserDto
} from '../shared/core';
import { AppMemoryDb } from '../shared/core/base/db';
import type { ChatMenuItem } from '../shared/core/base/interfaces/activity-feed.interface';
import type { ChatPopupMessage } from '../shared/core/base/models/chat.model';
import { DemoChatsRepository, DemoUsersRepository } from '../shared/core/demo';
import { SHARE_TOKENS_TABLE_NAME } from '../shared/core/demo/models/share-tokens.model';

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
  headline?: string | null;
  about?: string | null;
  images?: string[] | null;
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
  userImageUrl?: string | null;
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

interface DemoAdminHelpTarget {
  key: string;
  messageId: string;
  attachmentId: string;
  attachmentType: 'link' | 'event' | 'asset';
  attachmentEntityId: string;
  assetType?: 'Car' | 'Accommodation' | 'Supplies' | null;
  title: string;
  subtitle: string;
  description: string;
  previewUrl?: string | null;
  text: string;
  targetUrl: string;
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
  private readonly location = inject(Location);
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
    this.popupCtx.openNavigatorActivitiesRequest('chats', undefined, { adminServiceOnly: true });
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
      initials: this.initialsFromName(nextUser.name, admin.initials),
      headline: nextUser.headline,
      about: nextUser.about,
      images: [...(nextUser.images ?? [])]
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
    const normalizedAdminUserId = adminUserId?.trim() ?? '';
    const dashboard = await this.http
      .get<AdminDashboardDto>(`${this.apiBaseUrl}/admin/dashboard`, {
        params: normalizedAdminUserId ? { adminUserId: normalizedAdminUserId } : {}
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
    await this.ensureDemoAdminProfiles();
    this.demoChatsRepository.init();
    onProgress?.({ percent: 48, label: 'Creating moderation records', stage: 'records' });
    const store = await this.ensureDemoModerationStore();
    await this.ensureDemoAdminServiceSeed(admin);
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
          reporterUserId: 'u1',
          reporterName: 'Farkas Anna',
          targetUserId: 'u5',
          reason: 'Harassment',
          details: 'The reported chat message made another event member feel unsafe and should be reviewed by moderation.',
          eventId: 'a11a802ee0714a21db94ed4e',
          eventTitle: 'Alpine Weekend 2.0',
          eventStartAtIso: '2026-03-04T09:45:00.000Z',
          sourceType: 'chat',
          sourceId: 'c1-4',
          sourceText: 'I can take one extra seat from downtown pickup.',
          chatId: 'c1',
          messageId: 'c1-4',
          chatTitle: 'Driver Split - Alpine Weekend',
          chatMessages: this.demoChatMessages('u1', 'c1'),
          createdDate: '2026-04-25T11:12:00.000Z'
        },
        {
          id: 'admin-demo-report-event-kai-002',
          reporterUserId: 'u1',
          reporterName: 'Farkas Anna',
          targetUserId: 'u5',
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
          reporterUserId: 'u4',
          reporterName: 'Maya Stone',
          targetUserId: 'u5',
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
          userId: 'u1',
          userName: 'Farkas Anna',
          category: 'UX improvement',
          subject: 'Need clearer report status',
          details: 'After reporting a user, I would like to see whether moderation has reviewed the report.',
          createdDate: '2026-04-24T13:20:00.000Z'
        },
        {
          id: 'admin-demo-feedback-event-warn-002',
          userId: 'u5',
          userName: 'Lina Park',
          category: 'Feature request',
          subject: 'Review event behavior faster',
          details: 'Hosts need a way to warn members before blocking them from future participation.',
          createdDate: '2026-04-23T18:05:00.000Z'
        }
      ]
    };
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
      activeAdmin,
      reportedUsers,
      feedback: [...store.feedback].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      ).map(item => this.enrichDemoFeedback(item))
    };
  }

  private async ensureDemoAdminProfiles(): Promise<void> {
    const admins = [
      this.resolveDemoAdmin('admin-demo-ava'),
      this.resolveDemoAdmin('admin-demo-noel')
    ];
    let changed = false;
    for (const admin of admins) {
      if (this.demoUsersRepository.queryUserById(admin.id)) {
        continue;
      }
      this.demoUsersRepository.upsertUser(this.buildDemoAdminUser(admin));
      changed = true;
    }
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
  }

  private buildDemoAdminUser(admin: AdminUserDto): UserDto {
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
      headline: `${admin.headline ?? ''}`.trim() || 'Moderation workspace',
      about: `${admin.about ?? ''}`.trim() || 'Reviews reports, feedback, and support chats.',
      images: [...(admin.images ?? [])],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
        feedback: 0
      }
    };
  }

  private enrichDemoFeedback(feedback: AdminFeedbackDto): AdminFeedbackDto {
    const user = this.demoUsersRepository.queryUserById(feedback.userId);
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

  private async ensureDemoAdminServiceSeed(admin: AdminUserDto): Promise<void> {
    const helpUser = this.demoUsersRepository.queryUserById('u1');
    if (!helpUser) {
      return;
    }
    const now = new Date();
    const chat: ChatMenuItem & { ownerUserId?: string } = {
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
    const existingChat = this.demoChatsRepository.queryChatItemsByUser(admin.id)
      .find(item => item.id === chat.id);
    const existingMessageIds = new Set(
      existingChat ? this.demoChatsRepository.queryChatMessages(existingChat).map(message => message.id) : []
    );
    let changed = false;
    this.demoAdminHelpTargets().forEach((target, index) => {
      const token = this.ensureDemoHelpToken(admin, helpUser, target);
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
        this.demoChatsRepository.updateChatMessage(existingChat, target.messageId, {
          attachments: message.attachments ?? []
        });
        changed = true;
        return;
      }
      this.demoChatsRepository.appendChatMessage(chat, message);
      changed = true;
    });
    if (!changed) {
      return;
    }
    await this.memoryDb.flushToIndexedDb();
  }

  private demoAdminHelpTargets(): DemoAdminHelpTarget[] {
    return [
      {
        key: 'current',
        messageId: 'm-admin-help-u1',
        attachmentId: 'admin-help:u1:current',
        attachmentType: 'link',
        attachmentEntityId: '',
        title: 'Open shared help view',
        subtitle: 'Limited-time support token',
        description: 'Open the user view in a new tab.',
        text: 'Please help me, I am sharing my current MyScoutee screen with support.',
        targetUrl: '/game'
      },
      {
        key: 'events',
        messageId: 'm-admin-help-u1-events',
        attachmentId: 'admin-help:u1:events',
        attachmentType: 'event',
        attachmentEntityId: 'e1',
        title: 'Alpine Weekend 2.0',
        subtitle: 'Feb 27 - Mar 1',
        description: 'Multi-day ski meetup with social dinner and pair game.',
        previewUrl: 'https://picsum.photos/seed/demo-event-events%3Au1%3Ae1%3Aalpine-weekend-2.0/1200/700',
        text: 'Please check what I see on this event screen.',
        targetUrl: '/game?supportTarget=event&eventId=e1'
      },
      {
        key: 'asset-supplies',
        messageId: 'm-admin-help-u1-asset-supplies',
        attachmentId: 'admin-help:u1:asset-supplies',
        attachmentType: 'asset',
        attachmentEntityId: 'asset-sup-2',
        assetType: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Supplies - Austin',
        description: 'Board games, cards, and speakers ready for the venue.',
        previewUrl: 'https://picsum.photos/seed/supplies-gear-asset-sup-2/1200/700',
        text: 'Please check this shared asset screen.',
        targetUrl: '/game?supportTarget=asset&assetFilter=Supplies&assetId=asset-sup-2&assetTitle=Game%20Night%20Box&assetSubtitle=Board%20games%20%2B%20cards%20%2B%20speakers&assetCity=Austin&assetDetails=Board%20games%2C%20cards%2C%20and%20speakers%20ready%20for%20the%20venue.&assetPreview=https%3A%2F%2Fpicsum.photos%2Fseed%2Fsupplies-gear-asset-sup-2%2F1200%2F700'
      }
    ];
  }

  private ensureDemoHelpToken(admin: AdminUserDto, user: UserDto, target: DemoAdminHelpTarget): string {
    const safeAdminId = admin.id.replace(/[^A-Za-z0-9-]/g, '-');
    const targetSuffix = target.key === 'current' ? '' : `-${target.key}`;
    const token = `myscoutee:token:admin-help-${safeAdminId}-${user.id}${targetSuffix}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const record: ShareTokenRecord = {
      token,
      kind: 'adminHelp',
      entityId: target.targetUrl,
      ownerUserId: user.id,
      createdAtIso: now.toISOString(),
      expiresAtIso: expiresAt.toISOString()
    };
    this.memoryDb.write(state => {
      const table = state[SHARE_TOKENS_TABLE_NAME];
      const existing = table.byToken[token];
      if (existing && Date.parse(existing.expiresAtIso) > Date.now() && existing.entityId === target.targetUrl) {
        return state;
      }
      return {
        ...state,
        [SHARE_TOKENS_TABLE_NAME]: {
          byToken: {
            ...table.byToken,
            [token]: record
          },
          tokens: table.tokens.includes(token) ? [...table.tokens] : [...table.tokens, token]
        }
      };
    });
    return token;
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
    const now = new Date();
    const nowIso = now.toISOString();
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
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
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
      activeAdmin: {
        ...dashboard.activeAdmin,
        headline: `${dashboard.activeAdmin.headline ?? ''}`.trim() || null,
        about: `${dashboard.activeAdmin.about ?? ''}`.trim() || null,
        images: [...(dashboard.activeAdmin.images ?? [])]
      },
      reportedUsers: (dashboard.reportedUsers ?? []).map(user => ({
        ...user,
        reports: (user.reports ?? []).map(report => ({
          ...report,
          chatMessages: [...(report.chatMessages ?? [])]
        }))
      })),
      feedback: (dashboard.feedback ?? []).map(item => ({
        ...item,
        userImageUrl: `${item.userImageUrl ?? ''}`.trim() || null
      }))
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
    const existingAdminProfile = this.appCtx.getUserProfile(admin.id) ?? this.demoUsersRepository.queryUserById(admin.id);
    const name = `${existingAdminProfile?.name ?? admin.name}`.trim() || admin.name;
    const initials = `${existingAdminProfile?.initials ?? admin.initials}`.trim() || this.initialsFromName(name, admin.initials);
    const headline = `${existingAdminProfile?.headline ?? admin.headline ?? ''}`.trim() || 'Moderation workspace';
    const about = `${existingAdminProfile?.about ?? admin.about ?? ''}`.trim() || 'Reviews reports, feedback, and support chats.';
    const images = (existingAdminProfile?.images?.length ? existingAdminProfile.images : admin.images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .filter(image => image.length > 0);
    return {
      id: admin.id,
      name,
      age: 0,
      birthday: '',
      city: 'Admin',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials,
      gender: admin.id.includes('noel') ? 'man' : 'woman',
      statusText: 'Admin workspace',
      hostTier: 'Admin',
      traitLabel: 'Safety',
      completion: 100,
      headline,
      about,
      images,
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

  private mergeStoredAdminProfile(admin: AdminUserDto): AdminUserDto {
    const stored = this.demoUsersRepository.queryUserById(admin.id);
    if (!stored) {
      return admin;
    }
    const name = `${stored.name ?? ''}`.trim() || admin.name;
    return {
      ...admin,
      name,
      initials: `${stored.initials ?? ''}`.trim() || this.initialsFromName(name, admin.initials),
      headline: `${stored.headline ?? ''}`.trim() || admin.headline || null,
      about: `${stored.about ?? ''}`.trim() || admin.about || null,
      images: [...(stored.images ?? admin.images ?? [])]
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
