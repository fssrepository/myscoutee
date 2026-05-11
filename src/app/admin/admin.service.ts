import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import {
  AppContext,
  AppPopupContext,
  HelpCenterService,
  SessionService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type ShareTokenRecord,
  type DemoUserListItemDto,
  type AdminNotificationCenterState,
  type AdminNotificationRuleLiveEvent,
  type AdminNotificationRule,
  type AdminNotificationRunResult,
  type AdminNotificationScheduleSlot,
  type AdminNotificationTemplateOption,
  type AdminNotificationTimingMode,
  type AdminNotificationTriggerKind,
  type UserDto
} from '../shared/core';
import { AppMemoryDb } from '../shared/core/base/db';
import type { ChatMenuItem } from '../shared/core/base/interfaces/activity-feed.interface';
import type { ChatPopupMessage } from '../shared/core/base/models/chat.model';
import { DemoChatsRepository, DemoUsersRepository } from '../shared/core/demo';
import { CHATS_TABLE_NAME, type DemoChatRecord } from '../shared/core/demo/models/chats.model';
import { SHARE_TOKENS_TABLE_NAME } from '../shared/core/demo/models/share-tokens.model';
import { ActivitiesPopupStateService } from '../activity/services/activities-popup-state.service';
import { FirebaseAuthService } from '../shared/core/base/services/firebase-auth.service';

export type AdminPopupKind =
  | 'reports'
  | 'feedback'
  | 'chat'
  | 'chat-review'
  | 'warn-chat'
  | 'profile'
  | 'help-editor'
  | 'idea-editor'
  | 'notifications'
  | 'stats'
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
  reporterImageUrl?: string | null;
  targetUserId: string;
  handle?: string | null;
  reason: string;
  details: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
  memberEntryId?: string | null;
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
  imageUrl?: string | null;
  profileStatus: UserDto['profileStatus'] | string;
  reportCount: number;
  lastReportedAtIso?: string | null;
  blockedAtIso?: string | null;
  hasSupportChat?: boolean | null;
  supportChatUnread?: number | null;
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
  blockedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}

export interface AdminStatsMetricDto {
  key: string;
  labelKey: string;
  value: number;
  valueLabel?: string;
  captionKey?: string;
  caption?: string;
  icon: string;
  tone: 'blue' | 'green' | 'gold' | 'red' | 'purple' | 'slate';
  percent?: number | null;
}

export interface AdminStatsBreakdownItemDto {
  key: string;
  labelKey: string;
  label?: string;
  value: number;
  total?: number | null;
  icon?: string;
  tone?: AdminStatsMetricDto['tone'];
}

export interface AdminStatsSegmentDto {
  key: string;
  labelKey: string;
  icon: string;
  total: number;
  healthPercent: number;
  summaryKey: string;
  summary?: string;
  items: AdminStatsBreakdownItemDto[];
}

export interface AdminStatsTimelinePointDto {
  dateKey: string;
  label: string;
  registrations: number;
  activeUsers: number;
  ratings: number;
  events: number;
  assets: number;
  messages: number;
  moderation: number;
}

export interface AdminStatsDashboardDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | 'fallback';
  healthScore: number;
  healthLabelKey: string;
  healthSummaryKey: string;
  kpis: AdminStatsMetricDto[];
  segments: AdminStatsSegmentDto[];
  attention: AdminStatsBreakdownItemDto[];
  topCities: AdminStatsBreakdownItemDto[];
  topTopics: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsTimelinePointDto[];
  eventTypes: AdminStatsBreakdownItemDto[];
  activityMix: AdminStatsBreakdownItemDto[];
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
const ADMIN_NOTIFICATION_STORE_KEY = 'adminNotificationRules';
const ADMIN_STATS_STORE_KEY = 'adminStats';
const ADMIN_NOTIFICATION_STORAGE_TIMEOUT_MS = 2500;
const ADMIN_NOTIFICATION_HTTP_TIMEOUT_MS = 12000;

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly location = inject(Location);
  private readonly sessionService = inject(SessionService);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly demoChatsRepository = inject(DemoChatsRepository);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly dashboardRef = signal<AdminDashboardDto | null>(null);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly activePopupRef = signal<AdminPopupKind | null>(null);
  private readonly selectedReportedUserRef = signal<AdminReportedUserDto | null>(null);
  private readonly selectedReportRef = signal<AdminReportDto | null>(null);
  private readonly warnedUserIdsRef = signal<Set<string>>(new Set());

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

  restoreAdminPreview(): DemoUserListItemDto | null {
    const adminId = this.readStoredAdminId();
    if (!adminId) {
      return null;
    }
    return this.adminUsers().find(user => user.id === adminId) ?? null;
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
      void this.helpCenter.preloadAll();
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

  openHelpEditor(): void {
    this.activePopupRef.set('help-editor');
  }

  openIdeaEditor(): void {
    this.activePopupRef.set('idea-editor');
  }

  openNotifications(): void {
    this.activePopupRef.set('notifications');
  }

  openStats(): void {
    this.activePopupRef.set('stats');
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

  openBlockedUserChat(user: AdminReportedUserDto): void {
    this.selectedReportedUserRef.set(user);
    this.activePopupRef.set(null);
    const chat = this.buildAdminSupportChat(user);
    this.activitiesContext.openEventChat(chat, {
      channelType: 'serviceEvent',
      hasSubEventMenu: false,
      actionIcon: 'shield',
      actionLabel: 'Support',
      actionToneClass: 'popup-chat-context-btn-tone-main-event',
      actionBadgeCount: this.supportChatUnread(user),
      menuTitle: chat.title,
      eventRow: null,
      subEventRow: null,
      subEvent: null,
      group: null,
      assetAssignmentIds: { Car: [], Accommodation: [], Supplies: [] },
      assetCardsByType: { Car: [], Accommodation: [], Supplies: [] },
      resources: []
    });
  }

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
    return this.usesHttpAdminApi ? explicit : explicit || this.demoSupportChatUnread(userId);
  }

  isUserBlocked(user: AdminReportedUserDto | null | undefined): boolean {
    const resolved = user?.userId ? this.resolveDashboardReportedUser(user.userId) : null;
    return `${resolved?.profileStatus ?? user?.profileStatus ?? ''}`.trim() === 'blocked';
  }

  openItemPreview(report: AdminReportDto): void {
    this.selectedReportRef.set(report);
    this.activePopupRef.set('item-preview');
  }

  closePopup(): void {
    this.activePopupRef.set(null);
  }

  async loadStatsDashboard(): Promise<AdminStatsDashboardDto> {
    if (this.usesHttpAdminApi) {
      try {
        const state = await this.withNotificationHttpTimeout(this.http
          .get<AdminStatsDashboardDto>(`${this.apiBaseUrl}/admin/stats`, {
            params: { adminUserId: this.activeAdmin()?.id ?? '' }
          })
          .toPromise());
        if (state) {
          return this.normalizeStatsDashboard(state, 'http');
        }
      } catch {
        // Fall back to the local snapshot if the stats read model is not available yet.
      }
    }

    await this.withNotificationStorageFallback(this.memoryDb.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.memoryDb.readIndexedDbTableEntry<AdminStatsDashboardDto>(ADMIN_STATS_STORE_KEY),
      null
    );
    if (existing) {
      const normalized = this.normalizeStatsDashboard(existing, 'demo');
      if (this.isFreshStatsDemoSnapshot(normalized)) {
        return normalized;
      }
    }

    const snapshot = this.buildSeedDemoStatsSnapshot();
    void this.withNotificationStorageFallback(
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_STATS_STORE_KEY, snapshot),
      undefined
    );
    return snapshot;
  }

  async loadNotificationCenter(): Promise<AdminNotificationCenterState> {
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .get<AdminNotificationCenterState>(`${this.apiBaseUrl}/admin/notifications`, {
          params: { adminUserId: this.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeNotificationCenter(state ?? this.buildDefaultNotificationCenter());
    }
    await this.withNotificationStorageFallback(this.memoryDb.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.memoryDb.readIndexedDbTableEntry<AdminNotificationCenterState>(ADMIN_NOTIFICATION_STORE_KEY),
      null
    );
    if (existing?.rules?.length) {
      return this.normalizeNotificationCenter(existing);
    }
    const seeded = this.buildDefaultNotificationCenter();
    void this.withNotificationStorageFallback(
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_NOTIFICATION_STORE_KEY, seeded),
      undefined
    );
    return seeded;
  }

  async saveNotificationCenter(rules: readonly AdminNotificationRule[]): Promise<AdminNotificationCenterState> {
    const normalizedRules = rules.map(rule => this.normalizeNotificationRule(rule));
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .post<AdminNotificationCenterState>(`${this.apiBaseUrl}/admin/notifications`, {
          adminUserId: this.activeAdmin()?.id ?? '',
          rules: normalizedRules
        })
        .toPromise());
      return this.normalizeNotificationCenter(state ?? {
        rules: normalizedRules,
        emailTemplates: [],
        updatedDate: new Date().toISOString()
      });
    }
    const existing = await this.loadNotificationCenter();
    const next = this.normalizeNotificationCenter({
      rules: normalizedRules,
      emailTemplates: existing.emailTemplates,
      updatedDate: new Date().toISOString()
    });
    await this.withNotificationStorageFallback(
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_NOTIFICATION_STORE_KEY, next),
      undefined
    );
    return next;
  }

  async runNotificationRule(ruleKey: string): Promise<AdminNotificationRunResult> {
    const normalizedRuleKey = `${ruleKey ?? ''}`.trim();
    if (!normalizedRuleKey) {
      return {
        ruleKey: '',
        label: '',
        affectedCount: 0,
        status: 'skipped',
        detail: 'Missing rule key.',
        ranAtIso: new Date().toISOString()
      };
    }
    if (this.usesHttpAdminApi) {
      const result = await this.withNotificationHttpTimeout(this.http
        .post<AdminNotificationRunResult>(
          `${this.apiBaseUrl}/admin/notifications/${encodeURIComponent(normalizedRuleKey)}/run`,
          { adminUserId: this.activeAdmin()?.id ?? '' }
        )
        .toPromise());
      return this.normalizeNotificationRunResult(result, normalizedRuleKey);
    }
    const state = await this.loadNotificationCenter();
    const nowIso = new Date().toISOString();
    const nextRules = state.rules.map(rule => {
      if (rule.ruleKey !== normalizedRuleKey) {
        return rule;
      }
      const count = rule.triggerKind === 'scheduled_process'
        ? this.demoScheduledRunCount(rule.ruleKey)
        : 0;
      const status = rule.manualRunEnabled ? 'completed' : 'skipped';
      const detail = rule.manualRunEnabled ? 'Demo run recorded.' : 'This rule is action driven.';
      const startedAtIso = new Date(Date.now() - 1150).toISOString();
      return {
        ...rule,
        runState: {
          currentStatus: status,
          progressPercent: 100,
          progressDetail: detail,
          startedAtIso,
          finishedAtIso: nowIso,
          durationMillis: 1150,
          lastRunAtIso: nowIso,
          lastRunStatus: status,
          lastRunDetail: detail,
          lastRunCount: count,
          lastRunUser: this.activeAdmin()?.id ?? 'demo-admin'
        },
        runHistory: [{
          id: `run-${Date.now()}`,
          trigger: 'manual',
          runnerUser: this.activeAdmin()?.id ?? 'demo-admin',
          startedAtIso,
          finishedAtIso: nowIso,
          durationMillis: 1150,
          processedCount: count,
          status,
          detail
        }, ...(rule.runHistory ?? [])].slice(0, 12),
        updatedDate: nowIso,
        updatedUser: this.activeAdmin()?.id ?? 'demo-admin'
      };
    });
    const saved = await this.saveNotificationCenter(nextRules);
    const updated = saved.rules.find(rule => rule.ruleKey === normalizedRuleKey);
    return {
      ruleKey: normalizedRuleKey,
      label: updated?.label ?? normalizedRuleKey,
      affectedCount: updated?.runState.lastRunCount ?? 0,
      status: updated?.runState.lastRunStatus ?? 'skipped',
      detail: updated?.runState.lastRunDetail ?? 'Rule was not found.',
      ranAtIso: updated?.runState.lastRunAtIso ?? nowIso
    };
  }

  async loadNotificationRuleRuntime(ruleKey: string): Promise<AdminNotificationRule | null> {
    const normalizedRuleKey = `${ruleKey ?? ''}`.trim();
    if (!normalizedRuleKey || !this.usesHttpAdminApi) {
      return null;
    }
    const rule = await this.withNotificationHttpTimeout(this.http
      .get<AdminNotificationRule | null>(
        `${this.apiBaseUrl}/admin/notifications/${encodeURIComponent(normalizedRuleKey)}/runtime`,
        { params: { adminUserId: this.activeAdmin()?.id ?? '' } }
      )
      .toPromise());
    return rule ? this.normalizeNotificationRule(rule) : null;
  }

  subscribeNotificationRuleUpdates(onEvent: (event: AdminNotificationRuleLiveEvent) => void): () => void {
    if (!this.usesHttpAdminApi || typeof WebSocket === 'undefined' || typeof window === 'undefined') {
      return () => {};
    }
    let closed = false;
    let socket: WebSocket | null = null;
    void this.buildNotificationSocketUrl().then(socketUrl => {
      if (!socketUrl || closed) {
        return;
      }
      socket = new WebSocket(socketUrl);
      socket.onmessage = message => {
        try {
          const event = JSON.parse(`${message.data ?? ''}`) as AdminNotificationRuleLiveEvent;
          if (event?.type === 'rule-runtime' && `${event.ruleKey ?? ''}`.trim()) {
            onEvent(this.normalizeNotificationRuleLiveEvent(event));
          }
        } catch {
          // Ignore malformed admin notification socket events.
        }
      };
      socket.onerror = () => {
        socket?.close();
      };
    });
    return () => {
      closed = true;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
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
        this.markUserWarned(normalizedUserId);
        this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
      }
      return;
    }
    await this.appendDemoSupportMessage(normalizedUserId, message);
    this.markUserWarned(normalizedUserId);
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
        this.markUserWarned(normalizedUserId);
        this.refreshSelectedReportedUser(normalizedUserId);
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
    this.markUserWarned(normalizedUserId);
    await this.memoryDb.flushToIndexedDb();
    this.dashboardRef.set(await this.loadDemoDashboard(this.activeAdmin()?.id));
    this.refreshSelectedReportedUser(normalizedUserId);
    this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
  }

  async unblockUser(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.usesHttpAdminApi) {
      const dashboard = await this.http.post<AdminDashboardDto>(
        `${this.apiBaseUrl}/admin/users/${encodeURIComponent(normalizedUserId)}/unblock`,
        {
          adminUserId: this.activeAdmin()?.id ?? '',
          message: ''
        }
      ).toPromise();
      if (dashboard) {
        this.dashboardRef.set(this.normalizeDashboard(dashboard));
        this.refreshSelectedReportedUser(normalizedUserId);
        this.activateAdminProfile(this.dashboardRef() as AdminDashboardDto);
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
      await this.memoryDb.flushToIndexedDb();
    }
    this.dashboardRef.set(await this.loadDemoDashboard(this.activeAdmin()?.id));
    this.refreshSelectedReportedUser(normalizedUserId);
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
          reporterImageUrl: this.firstUserImage(this.demoUsersRepository.queryUserById('u1')),
          targetUserId: 'u5',
          handle: 'Lina Park',
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
          reporterImageUrl: this.firstUserImage(this.demoUsersRepository.queryUserById('u1')),
          targetUserId: 'u5',
          handle: 'Lina Park',
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
          reporterImageUrl: this.firstUserImage(this.demoUsersRepository.queryUserById('u4')),
          targetUserId: 'u5',
          handle: 'Lina Park',
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
        imageUrl: this.firstUserImage(user),
        profileStatus: user?.profileStatus ?? 'public',
        reportCount: sortedReports.length,
        lastReportedAtIso: sortedReports[0]?.createdDate ?? null,
        blockedAtIso: user?.profileStatus === 'blocked' ? sortedReports[0]?.createdDate ?? store.seededAtIso : null,
        hasSupportChat: this.demoSupportChatExists(userId),
        supportChatUnread: this.demoSupportChatUnread(userId),
        reports: sortedReports
      };
    }).sort((first, second) =>
      Date.parse(`${second.lastReportedAtIso ?? ''}`) - Date.parse(`${first.lastReportedAtIso ?? ''}`)
    );
    return {
      activeAdmin,
      reportedUsers,
      blockedUsers: this.demoBlockedUsers(store, reportsByUser),
      feedback: [...store.feedback].sort((first, second) =>
        Date.parse(second.createdDate) - Date.parse(first.createdDate)
      ).map(item => this.enrichDemoFeedback(item))
    };
  }

  private demoBlockedUsers(
    store: AdminModerationStore,
    reportsByUser: Map<string, AdminReportDto[]>
  ): AdminReportedUserDto[] {
    const reportedBlocked = [...reportsByUser.keys()]
      .map(userId => this.demoUsersRepository.queryUserById(userId))
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
        hasSupportChat: this.demoSupportChatExists(user.id),
        supportChatUnread: this.demoSupportChatUnread(user.id),
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
    let changed = false;
    for (const admin of admins) {
      const existing = this.demoUsersRepository.queryUserById(admin.id);
      if (existing) {
        const seededImages = this.demoAdminImages(admin.id);
        const existingImages = existing.images ?? [];
        if (
          seededImages.length > 0
          && (existingImages.length === 0 || existingImages.some(image => this.isLegacyDemoAdminImage(image)))
        ) {
          this.demoUsersRepository.upsertUser({
            ...existing,
            images: seededImages
          });
          changed = true;
        }
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
      images: [...(admin.images?.length ? admin.images : this.demoAdminImages(admin.id))],
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
    const reporter = this.demoUsersRepository.queryUserById(report.reporterUserId);
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
        description: '',
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
    this.upsertDemoSupportChatMessage(userChat, userMessage, true);
    this.upsertDemoSupportChatMessage(adminChat, adminMessage, false);
    await this.memoryDb.flushToIndexedDb();
  }

  private upsertDemoSupportChatMessage(chat: DemoChatRecord, message: ChatPopupMessage, unreadForOwner: boolean): void {
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const recordKey = `${chat.ownerUserId}:${chat.id}`;
      const existing = currentTable.byId[recordKey];
      const existingMessages = existing?.messages ?? [];
      const nextRecord: DemoChatRecord = {
        ...(existing ?? chat),
        ...chat,
        unread: unreadForOwner ? Math.max(1, (existing?.unread ?? 0) + 1) : 0,
        messages: [
          ...existingMessages.map(item => ({
            ...item,
            senderAvatar: { ...item.senderAvatar },
            readBy: item.readBy
              .filter(reader => `${reader.id ?? ''}`.trim() !== `${item.senderAvatar.id ?? ''}`.trim())
              .map(reader => ({ ...reader })),
            attachments: item.attachments?.map(attachment => ({ ...attachment })),
            replyTo: item.replyTo ? { ...item.replyTo } : item.replyTo,
            reactions: item.reactions?.map(reaction => ({ ...reaction }))
          })),
          message
        ]
      };
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          byId: {
            ...currentTable.byId,
            [recordKey]: nextRecord
          },
          ids: currentTable.ids.includes(recordKey)
            ? [...currentTable.ids]
            : [...currentTable.ids, recordKey]
        }
      };
    });
  }

  private resolveDashboardReportedUser(userId: string): AdminReportedUserDto | null {
    const dashboard = this.dashboardRef();
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
    const adminId = this.activeAdmin()?.id ?? this.readStoredAdminId() ?? '';
    if (!normalizedUserId || !adminId) {
      return false;
    }
    return this.demoChatsRepository.queryChatItemsByUser(adminId)
      .some(chat => chat.id === `c-support-admin-${normalizedUserId}`);
  }

  private demoSupportChatUnread(userId: string): number {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const adminId = this.activeAdmin()?.id ?? this.readStoredAdminId() ?? '';
    if (!normalizedUserId || !adminId) {
      return 0;
    }
    const chat = this.demoChatsRepository.queryChatItemsByUser(adminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
  }

  private refreshSelectedReportedUser(userId: string): void {
    const selected = this.selectedReportedUserRef();
    if (!selected || selected.userId !== userId) {
      return;
    }
    this.selectedReportedUserRef.set(this.resolveDashboardReportedUser(userId) ?? selected);
  }

  private buildAdminSupportChat(user: AdminReportedUserDto): ChatMenuItem & { ownerUserId?: string } {
    const admin = this.activeAdmin() ?? this.resolveDemoAdmin();
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
        imageUrl: `${user.imageUrl ?? ''}`.trim() || null,
        blockedAtIso: `${user.blockedAtIso ?? ''}`.trim() || null,
        hasSupportChat: user.hasSupportChat === true,
        supportChatUnread: Math.max(0, Math.trunc(Number(user.supportChatUnread) || 0)),
        reports: (user.reports ?? []).map(report => ({
          ...report,
          reporterImageUrl: `${report.reporterImageUrl ?? ''}`.trim() || null,
          chatMessages: [...(report.chatMessages ?? [])]
        }))
      })),
      blockedUsers: (dashboard.blockedUsers ?? []).map(user => ({
        ...user,
        imageUrl: `${user.imageUrl ?? ''}`.trim() || null,
        blockedAtIso: `${user.blockedAtIso ?? user.lastReportedAtIso ?? ''}`.trim() || null,
        hasSupportChat: user.hasSupportChat === true,
        supportChatUnread: Math.max(0, Math.trunc(Number(user.supportChatUnread) || 0)),
        reports: (user.reports ?? []).map(report => ({
          ...report,
          reporterImageUrl: `${report.reporterImageUrl ?? ''}`.trim() || null,
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
    return adminUserId.includes('noel')
      ? ['https://randomuser.me/api/portraits/men/75.jpg']
      : ['https://randomuser.me/api/portraits/women/65.jpg'];
  }

  private isLegacyDemoAdminImage(imageUrl: string | null | undefined): boolean {
    const normalized = `${imageUrl ?? ''}`.trim();
    return normalized.includes('picsum.photos/seed/admin-ava-moderation')
      || normalized.includes('picsum.photos/seed/admin-noel-safety');
  }

  private mergeStoredAdminProfile(admin: AdminUserDto): AdminUserDto {
    const stored = this.demoUsersRepository.queryUserById(admin.id);
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

  private buildSeedDemoStatsSnapshot(): AdminStatsDashboardDto {
    const nowIso = new Date().toISOString();
    const segment = (
      key: string,
      labelKey: string,
      icon: string,
      total: number,
      healthPercent: number,
      items: AdminStatsBreakdownItemDto[]
    ): AdminStatsSegmentDto => ({
      key,
      labelKey,
      icon,
      total,
      healthPercent,
      summaryKey: 'stats.segment.summary',
      items
    });
    const item = (
      key: string,
      labelKey: string,
      value: number,
      total: number,
      icon: string,
      tone: AdminStatsMetricDto['tone']
    ): AdminStatsBreakdownItemDto => ({ key, labelKey, value, total, icon, tone });
    const timeline: AdminStatsTimelinePointDto[] = [
      ['2026-04-28', 'Apr 28', 3, 24, 18, 4, 2, 38, 1],
      ['2026-04-29', 'Apr 29', 5, 31, 22, 6, 3, 44, 2],
      ['2026-04-30', 'Apr 30', 4, 29, 28, 5, 4, 47, 1],
      ['2026-05-01', 'May 1', 8, 36, 32, 8, 4, 62, 3],
      ['2026-05-02', 'May 2', 6, 42, 38, 7, 5, 71, 2],
      ['2026-05-03', 'May 3', 4, 39, 35, 5, 3, 64, 1],
      ['2026-05-04', 'May 4', 7, 46, 44, 9, 6, 83, 2],
      ['2026-05-05', 'May 5', 9, 51, 49, 8, 5, 94, 4],
      ['2026-05-06', 'May 6', 5, 47, 43, 6, 4, 86, 2],
      ['2026-05-07', 'May 7', 6, 53, 56, 10, 7, 103, 3],
      ['2026-05-08', 'May 8', 4, 49, 48, 7, 5, 91, 2],
      ['2026-05-09', 'May 9', 7, 57, 61, 11, 6, 117, 4],
      ['2026-05-10', 'May 10', 5, 54, 52, 8, 5, 99, 1],
      ['2026-05-11', 'May 11', 6, 42, 36, 5, 3, 72, 2]
    ].map(([dateKey, label, registrations, activeUsers, ratings, events, assets, messages, moderation]) => ({
      dateKey: `${dateKey}`,
      label: `${label}`,
      registrations: Number(registrations),
      activeUsers: Number(activeUsers),
      ratings: Number(ratings),
      events: Number(events),
      assets: Number(assets),
      messages: Number(messages),
      moderation: Number(moderation)
    }));

    return this.normalizeStatsDashboard({
      generatedAtIso: nowIso,
      source: 'demo',
      healthScore: 84,
      healthLabelKey: 'stats.health.good',
      healthSummaryKey: 'stats.health.summary',
      kpis: [
        { key: 'active-users', labelKey: 'stats.kpi.active.users', value: 42, valueLabel: '42', icon: 'person', tone: 'blue', percent: 33 },
        { key: 'returning-users', labelKey: 'stats.kpi.returning.users', value: 31, valueLabel: '31', icon: 'repeat', tone: 'purple', percent: 24 },
        { key: 'active-events', labelKey: 'stats.kpi.active.events', value: 18, valueLabel: '18', icon: 'event_available', tone: 'green', percent: 45 },
        { key: 'active-assets', labelKey: 'stats.kpi.active.assets', value: 27, valueLabel: '27', icon: 'inventory_2', tone: 'gold', percent: 68 },
        { key: 'moderation-pressure', labelKey: 'stats.kpi.moderation.pressure', value: 14, valueLabel: '14', icon: 'shield', tone: 'red', percent: 18 }
      ],
      segments: [
        segment('community', 'stats.segment.community', 'person', 128, 88, [
          item('profile.registered', 'stats.event.profile.registered', 29, 128, 'person_add', 'green'),
          item('active-users-7d', 'stats.event.active.users.7d', 42, 128, 'person', 'blue'),
          item('active-users-30d', 'stats.event.active.users.30d', 68, 128, 'calendar_month', 'green'),
          item('returning-users', 'stats.event.returning.users', 31, 128, 'repeat', 'purple'),
          item('profile-fill-average', 'stats.event.profile.fill.average', 74, 100, 'fact_check', 'gold'),
          item('tried-users', 'stats.event.tried.users', 128, 128, 'group', 'slate')
        ]),
        segment('matching', 'stats.segment.matching', 'hub', 342, 83, [
          item('rates.synced', 'stats.event.rates.synced', 342, 342, 'star', 'gold')
        ]),
        segment('activities', 'stats.segment.activities', 'event_available', 91, 76, [
          item('active-events', 'stats.event.active.events', 18, 91, 'event_available', 'green'),
          item('all-events', 'stats.event.all.events', 28, 91, 'event', 'blue'),
          item('active-assets', 'stats.event.active.assets', 27, 91, 'inventory_2', 'gold'),
          item('all-assets', 'stats.event.all.assets', 39, 91, 'category', 'purple'),
          item('event.members.changed', 'stats.event.event.members.changed', 37, 91, 'groups', 'green'),
          item('asset.requests.changed', 'stats.event.asset.requests.changed', 14, 91, 'handshake', 'gold')
        ]),
        segment('communication', 'stats.segment.communication', 'chat', 426, 81, [
          item('chat.message.sent', 'stats.event.chat.message.sent', 417, 426, 'forum', 'blue'),
          item('admin.user.warned', 'stats.event.admin.user.warned', 9, 426, 'warning', 'gold')
        ]),
        segment('moderation', 'stats.segment.moderation', 'shield', 14, 62, [
          item('report.submitted', 'stats.event.report.submitted', 8, 14, 'report', 'red'),
          item('feedback.submitted', 'stats.event.feedback.submitted', 4, 14, 'feedback', 'purple'),
          item('admin.user.blocked', 'stats.event.admin.user.blocked', 2, 14, 'block', 'red')
        ])
      ],
      attention: [],
      topCities: [
        { key: 'austin', labelKey: '', label: 'Austin', value: 34, total: 128, icon: 'location_on', tone: 'blue' },
        { key: 'seattle', labelKey: '', label: 'Seattle', value: 29, total: 128, icon: 'location_on', tone: 'green' },
        { key: 'denver', labelKey: '', label: 'Denver', value: 23, total: 128, icon: 'location_on', tone: 'purple' },
        { key: 'miami', labelKey: '', label: 'Miami', value: 18, total: 128, icon: 'location_on', tone: 'gold' }
      ],
      topTopics: [
        { key: 'outdoors', labelKey: '', label: 'Outdoors', value: 38, total: 112, icon: 'local_offer', tone: 'green' },
        { key: 'music', labelKey: '', label: 'Music', value: 31, total: 112, icon: 'local_offer', tone: 'purple' },
        { key: 'board-games', labelKey: '', label: 'Board games', value: 24, total: 112, icon: 'local_offer', tone: 'blue' },
        { key: 'fitness', labelKey: '', label: 'Fitness', value: 19, total: 112, icon: 'local_offer', tone: 'gold' }
      ],
      timeline,
      eventTypes: [
        { key: 'simple', labelKey: '', label: 'Simple', value: 14, total: 47, icon: 'category', tone: 'blue' },
        { key: 'organized', labelKey: '', label: 'Organized', value: 10, total: 47, icon: 'category', tone: 'green' },
        { key: 'random', labelKey: '', label: 'Random', value: 8, total: 47, icon: 'casino', tone: 'purple' },
        { key: 'recurring', labelKey: '', label: 'Recurring', value: 6, total: 47, icon: 'event_repeat', tone: 'gold' },
        { key: 'multi-slot', labelKey: '', label: 'Multi-slot', value: 5, total: 47, icon: 'view_timeline', tone: 'green' },
        { key: 'tournament', labelKey: '', label: 'Tournament', value: 4, total: 47, icon: 'emoji_events', tone: 'red' }
      ],
      activityMix: [
        item('profiles', 'stats.domain.profiles', 128, 1001, 'person', 'blue'),
        item('matching', 'stats.domain.matching', 342, 1001, 'hub', 'purple'),
        item('events', 'stats.domain.events', 73, 1001, 'event', 'green'),
        item('assets', 'stats.domain.assets', 18, 1001, 'inventory_2', 'gold'),
        item('chats', 'stats.domain.chats', 426, 1001, 'chat', 'blue'),
        item('moderation', 'stats.domain.moderation', 14, 1001, 'shield', 'red')
      ]
    }, 'demo');
  }

  private normalizeStatsDashboard(
    dashboard: AdminStatsDashboardDto,
    source: AdminStatsDashboardDto['source']
  ): AdminStatsDashboardDto {
    const normalizedSource = `${dashboard.source ?? source}`.trim() as AdminStatsDashboardDto['source'];
    return {
      generatedAtIso: `${dashboard.generatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      source: ['demo', 'http', 'fallback'].includes(normalizedSource) ? normalizedSource : source,
      healthScore: this.clampInteger(dashboard.healthScore, 0, 100, 0),
      healthLabelKey: `${dashboard.healthLabelKey ?? ''}`.trim() || 'stats.health.good',
      healthSummaryKey: `${dashboard.healthSummaryKey ?? ''}`.trim() || 'stats.health.summary',
      kpis: (dashboard.kpis ?? []).map(metric => this.normalizeStatsMetric(metric)),
      segments: (dashboard.segments ?? []).map(segment => this.normalizeStatsSegment(segment)),
      attention: (dashboard.attention ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      topCities: (dashboard.topCities ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      topTopics: (dashboard.topTopics ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (dashboard.timeline ?? []).map(point => this.normalizeStatsTimelinePoint(point)),
      eventTypes: (dashboard.eventTypes ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      activityMix: (dashboard.activityMix ?? []).map(item => this.normalizeStatsBreakdownItem(item))
    };
  }

  private normalizeStatsMetric(metric: AdminStatsMetricDto): AdminStatsMetricDto {
    const value = Math.max(0, Math.trunc(Number(metric.value) || 0));
    return {
      key: `${metric.key ?? ''}`.trim(),
      labelKey: `${metric.labelKey ?? ''}`.trim(),
      value,
      valueLabel: `${metric.valueLabel ?? ''}`.trim() || this.compactNumber(value),
      captionKey: `${metric.captionKey ?? ''}`.trim(),
      caption: `${metric.caption ?? ''}`.trim(),
      icon: `${metric.icon ?? ''}`.trim() || 'query_stats',
      tone: this.normalizeStatsTone(metric.tone),
      percent: this.clampInteger(metric.percent ?? 0, 0, 100, 0)
    };
  }

  private normalizeStatsSegment(segment: AdminStatsSegmentDto): AdminStatsSegmentDto {
    return {
      key: `${segment.key ?? ''}`.trim(),
      labelKey: `${segment.labelKey ?? ''}`.trim(),
      icon: `${segment.icon ?? ''}`.trim() || 'dashboard',
      total: Math.max(0, Math.trunc(Number(segment.total) || 0)),
      healthPercent: this.clampInteger(segment.healthPercent, 0, 100, 0),
      summaryKey: `${segment.summaryKey ?? ''}`.trim(),
      summary: `${segment.summary ?? ''}`.trim(),
      items: (segment.items ?? []).map(item => this.normalizeStatsBreakdownItem(item))
    };
  }

  private normalizeStatsBreakdownItem(item: AdminStatsBreakdownItemDto): AdminStatsBreakdownItemDto {
    return {
      key: `${item.key ?? ''}`.trim(),
      labelKey: `${item.labelKey ?? ''}`.trim(),
      label: `${item.label ?? ''}`.trim(),
      value: Math.max(0, Math.trunc(Number(item.value) || 0)),
      total: Math.max(0, Math.trunc(Number(item.total) || 0)),
      icon: `${item.icon ?? ''}`.trim(),
      tone: item.tone ? this.normalizeStatsTone(item.tone) : undefined
    };
  }

  private normalizeStatsTimelinePoint(point: AdminStatsTimelinePointDto): AdminStatsTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      registrations: Math.max(0, Math.trunc(Number(point.registrations) || 0)),
      activeUsers: Math.max(0, Math.trunc(Number(point.activeUsers) || 0)),
      ratings: Math.max(0, Math.trunc(Number(point.ratings) || 0)),
      events: Math.max(0, Math.trunc(Number(point.events) || 0)),
      assets: Math.max(0, Math.trunc(Number(point.assets) || 0)),
      messages: Math.max(0, Math.trunc(Number(point.messages) || 0)),
      moderation: Math.max(0, Math.trunc(Number(point.moderation) || 0))
    };
  }

  private isFreshStatsDemoSnapshot(snapshot: AdminStatsDashboardDto): boolean {
    return snapshot.timeline.length > 0
      && snapshot.eventTypes.length > 0
      && snapshot.segments.some(segment => segment.key === 'community')
      && snapshot.segments.some(segment => segment.items.some(item => item.key === 'all-events'))
      && snapshot.segments.some(segment => segment.items.some(item => item.key === 'profile-fill-average'));
  }

  private normalizeStatsTone(value: string | null | undefined): AdminStatsMetricDto['tone'] {
    const normalized = `${value ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(normalized)
      ? normalized as AdminStatsMetricDto['tone']
      : 'slate';
  }

  private compactNumber(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return String(value);
  }

  private buildDefaultNotificationCenter(): AdminNotificationCenterState {
    return this.normalizeNotificationCenter({
      rules: [
        this.defaultNotificationRule({
          ruleKey: 'event-random-groups',
          label: 'Random event',
          category: 'Scheduled',
          description: 'Assigns accepted event members into generated random groups.',
          actionKey: 'event.scheduler.random-groups',
          triggerKind: 'scheduled_process',
          enabled: false,
          manualRunEnabled: true,
          adminManageable: true,
          priority: 200,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 15
        })
      ],
      emailTemplates: this.defaultNotificationTemplateOptions(),
      updatedDate: new Date().toISOString()
    });
  }

  private defaultNotificationRule(options: {
    ruleKey: string;
    label: string;
    category: string;
    description: string;
    actionKey: string;
    triggerKind: AdminNotificationTriggerKind;
    enabled: boolean;
    manualRunEnabled: boolean;
    adminManageable?: boolean;
    priority: number;
    pushEnabled: boolean;
    emailEnabled: boolean;
    timingMode: AdminNotificationTimingMode;
    intervalMinutes?: number;
    month?: number;
    dayOfMonth?: number;
    emailSubject?: string;
    emailBody?: string;
  }): AdminNotificationRule {
    return {
      ruleKey: options.ruleKey,
      label: options.label,
      category: options.category,
      description: options.description,
      actionKey: options.actionKey,
      triggerKind: options.triggerKind,
      enabled: options.enabled,
      manualRunEnabled: options.manualRunEnabled,
      adminManageable: options.adminManageable !== false,
      priority: options.priority,
      channels: {
        pushEnabled: options.pushEnabled,
        emailEnabled: options.emailEnabled,
        inAppEnabled: false,
        supportChatEnabled: false
      },
      timing: {
        mode: options.timingMode,
        delayMinutes: 0,
        intervalMinutes: options.intervalMinutes ?? 60,
        month: options.month ?? 1,
        dayOfMonth: options.dayOfMonth ?? 1,
        time: '09:00',
        timezone: 'UTC',
        cronExpression: this.intervalCron(options.intervalMinutes ?? 60)
      },
      scheduleSlots: this.defaultScheduleSlots(options.timingMode),
      message: {
        pushTitle: options.emailSubject ?? '',
        pushBody: options.emailBody ?? '',
        emailTemplateKey: '',
        emailSubject: options.emailSubject ?? '',
        emailBody: options.emailBody ?? '',
        ctaPath: '/game'
      },
      runState: {
        currentStatus: options.enabled ? 'idle' : 'suspended',
        progressPercent: 0,
        progressDetail: '',
        startedAtIso: '',
        finishedAtIso: '',
        durationMillis: 0,
        lastRunAtIso: '',
        lastRunStatus: '',
        lastRunDetail: '',
        lastRunCount: 0,
        lastRunUser: ''
      },
      runHistory: [],
      updatedDate: '',
      updatedUser: ''
    };
  }

  private defaultNotificationTemplateOptions(): AdminNotificationTemplateOption[] {
    return [
      {
        templateKey: 'email-template-promo-profile-completion-v1',
        name: 'Profile completion reminder',
        category: 'promotional',
        description: 'Promotional reminder for incomplete active profiles.'
      },
      {
        templateKey: 'email-template-promo-first-host-event-v1',
        name: 'First host event prompt',
        category: 'promotional',
        description: 'Promotional reminder for members who have not hosted yet.'
      },
      {
        templateKey: 'email-template-promo-country-broadcast-v1',
        name: 'Country broadcast',
        category: 'promotional',
        description: 'Reusable country-level promotional email.'
      }
    ];
  }

  private normalizeNotificationCenter(state: AdminNotificationCenterState): AdminNotificationCenterState {
    return {
      rules: (state.rules ?? [])
        .map(rule => this.normalizeNotificationRule(rule))
        .sort((left, right) => left.priority - right.priority || left.ruleKey.localeCompare(right.ruleKey)),
      emailTemplates: (state.emailTemplates ?? []).map(template => ({
        templateKey: `${template.templateKey ?? ''}`.trim(),
        name: `${template.name ?? ''}`.trim(),
        category: `${template.category ?? ''}`.trim(),
        description: `${template.description ?? ''}`.trim()
      })).filter(template => template.templateKey.length > 0),
      updatedDate: `${state.updatedDate ?? ''}`.trim() || new Date().toISOString()
    };
  }

  private normalizeNotificationRule(rule: AdminNotificationRule): AdminNotificationRule {
    const triggerKind = this.normalizeNotificationTriggerKind(rule.triggerKind);
    const timingMode = this.normalizeNotificationTimingMode(rule.timing?.mode, triggerKind);
    return {
      id: `${rule.id ?? ''}`.trim() || null,
      ruleKey: `${rule.ruleKey ?? ''}`.trim(),
      label: `${rule.label ?? ''}`.trim() || `${rule.ruleKey ?? ''}`.trim(),
      category: `${rule.category ?? ''}`.trim() || 'Action',
      description: `${rule.description ?? ''}`.trim(),
      actionKey: `${rule.actionKey ?? ''}`.trim(),
      triggerKind,
      enabled: rule.enabled === true,
      manualRunEnabled: rule.manualRunEnabled === true,
      adminManageable: this.normalizeAdminManageable(rule),
      priority: Math.max(0, Math.trunc(Number(rule.priority) || 1000)),
      channels: {
        pushEnabled: rule.channels?.pushEnabled === true,
        emailEnabled: rule.channels?.emailEnabled === true,
        inAppEnabled: rule.channels?.inAppEnabled === true,
        supportChatEnabled: rule.channels?.supportChatEnabled === true
      },
      timing: {
        mode: timingMode,
        delayMinutes: Math.max(0, Math.trunc(Number(rule.timing?.delayMinutes) || 0)),
        intervalMinutes: Math.max(1, Math.trunc(Number(rule.timing?.intervalMinutes) || 60)),
        month: this.clampInteger(rule.timing?.month, 1, 12, 1),
        dayOfMonth: this.clampInteger(rule.timing?.dayOfMonth, 1, 31, 1),
        time: this.normalizeNotificationTime(rule.timing?.time),
        timezone: `${rule.timing?.timezone ?? ''}`.trim() || 'UTC',
        cronExpression: `${rule.timing?.cronExpression ?? ''}`.trim()
          || this.intervalCron(Math.max(1, Math.trunc(Number(rule.timing?.intervalMinutes) || 60)))
      },
      scheduleSlots: this.normalizeScheduleSlots(rule.scheduleSlots, timingMode),
      message: {
        pushTitle: `${rule.message?.pushTitle ?? ''}`.trim(),
        pushBody: `${rule.message?.pushBody ?? ''}`.trim(),
        emailTemplateKey: `${rule.message?.emailTemplateKey ?? ''}`.trim(),
        emailSubject: `${rule.message?.emailSubject ?? ''}`.trim(),
        emailBody: `${rule.message?.emailBody ?? ''}`.trim(),
        ctaPath: `${rule.message?.ctaPath ?? ''}`.trim() || '/game'
      },
      runState: {
        currentStatus: `${rule.runState?.currentStatus ?? ''}`.trim() || (rule.enabled ? 'idle' : 'suspended'),
        progressPercent: this.clampInteger(rule.runState?.progressPercent, 0, 100, 0),
        progressDetail: `${rule.runState?.progressDetail ?? ''}`.trim(),
        startedAtIso: `${rule.runState?.startedAtIso ?? ''}`.trim(),
        finishedAtIso: `${rule.runState?.finishedAtIso ?? ''}`.trim(),
        durationMillis: Math.max(0, Math.trunc(Number(rule.runState?.durationMillis) || 0)),
        lastRunAtIso: `${rule.runState?.lastRunAtIso ?? ''}`.trim(),
        lastRunStatus: `${rule.runState?.lastRunStatus ?? ''}`.trim(),
        lastRunDetail: `${rule.runState?.lastRunDetail ?? ''}`.trim(),
        lastRunCount: Math.max(0, Math.trunc(Number(rule.runState?.lastRunCount) || 0)),
        lastRunUser: `${rule.runState?.lastRunUser ?? ''}`.trim()
      },
      runHistory: (rule.runHistory ?? []).map((entry, index) => ({
        id: `${entry?.id ?? ''}`.trim() || `run-${index}`,
        trigger: `${entry?.trigger ?? ''}`.trim() || 'manual',
        runnerUser: `${entry?.runnerUser ?? ''}`.trim(),
        startedAtIso: `${entry?.startedAtIso ?? ''}`.trim(),
        finishedAtIso: `${entry?.finishedAtIso ?? ''}`.trim(),
        durationMillis: Math.max(0, Math.trunc(Number(entry?.durationMillis) || 0)),
        processedCount: Math.max(0, Math.trunc(Number(entry?.processedCount) || 0)),
        status: `${entry?.status ?? ''}`.trim() || 'completed',
        detail: `${entry?.detail ?? ''}`.trim()
      })).sort((left, right) => Date.parse(right.finishedAtIso || right.startedAtIso) - Date.parse(left.finishedAtIso || left.startedAtIso)).slice(0, 12),
      updatedDate: `${rule.updatedDate ?? ''}`.trim() || null,
      updatedUser: `${rule.updatedUser ?? ''}`.trim() || null
    };
  }

  private normalizeNotificationRunResult(
    result: AdminNotificationRunResult | null | undefined,
    fallbackRuleKey: string
  ): AdminNotificationRunResult {
    return {
      ruleKey: `${result?.ruleKey ?? fallbackRuleKey}`.trim(),
      label: `${result?.label ?? fallbackRuleKey}`.trim(),
      affectedCount: Math.max(0, Math.trunc(Number(result?.affectedCount) || 0)),
      status: `${result?.status ?? 'completed'}`.trim(),
      detail: `${result?.detail ?? ''}`.trim(),
      ranAtIso: `${result?.ranAtIso ?? ''}`.trim() || new Date().toISOString()
    };
  }

  private normalizeAdminManageable(rule: AdminNotificationRule): boolean {
    const raw = (rule as AdminNotificationRule & { adminManageable?: unknown }).adminManageable;
    if (raw !== undefined && raw !== null) {
      return raw === true;
    }
    return `${rule.ruleKey ?? ''}`.trim() === 'event-random-groups';
  }

  private async buildNotificationSocketUrl(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    const baseUrl = new URL(`${this.apiBaseUrl.replace(/\/+$/, '')}/admin/notifications/ws`, window.location.origin);
    baseUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const adminUserId = this.activeAdmin()?.id ?? '';
    if (adminUserId) {
      baseUrl.searchParams.set('adminUserId', adminUserId);
      baseUrl.searchParams.set('userId', adminUserId);
    }
    if (this.firebaseAuthService.enabled) {
      const token = await this.firebaseAuthService.getIdToken();
      if (!token) {
        return null;
      }
      baseUrl.searchParams.set('token', token);
    }
    return baseUrl.toString();
  }

  private normalizeNotificationRuleLiveEvent(event: AdminNotificationRuleLiveEvent): AdminNotificationRuleLiveEvent {
    return {
      type: 'rule-runtime',
      ruleKey: `${event.ruleKey ?? ''}`.trim(),
      runState: {
        currentStatus: `${event.runState?.currentStatus ?? ''}`.trim(),
        progressPercent: this.clampInteger(event.runState?.progressPercent, 0, 100, 0),
        progressDetail: `${event.runState?.progressDetail ?? ''}`.trim(),
        startedAtIso: `${event.runState?.startedAtIso ?? ''}`.trim(),
        finishedAtIso: `${event.runState?.finishedAtIso ?? ''}`.trim(),
        durationMillis: Math.max(0, Math.trunc(Number(event.runState?.durationMillis) || 0)),
        lastRunAtIso: `${event.runState?.lastRunAtIso ?? ''}`.trim(),
        lastRunStatus: `${event.runState?.lastRunStatus ?? ''}`.trim(),
        lastRunDetail: `${event.runState?.lastRunDetail ?? ''}`.trim(),
        lastRunCount: Math.max(0, Math.trunc(Number(event.runState?.lastRunCount) || 0)),
        lastRunUser: `${event.runState?.lastRunUser ?? ''}`.trim()
      },
      runHistory: (event.runHistory ?? []).map((entry, index) => ({
        id: `${entry?.id ?? ''}`.trim() || `run-${index}`,
        trigger: `${entry?.trigger ?? ''}`.trim() || 'scheduled',
        runnerUser: `${entry?.runnerUser ?? ''}`.trim(),
        startedAtIso: `${entry?.startedAtIso ?? ''}`.trim(),
        finishedAtIso: `${entry?.finishedAtIso ?? ''}`.trim(),
        durationMillis: Math.max(0, Math.trunc(Number(entry?.durationMillis) || 0)),
        processedCount: Math.max(0, Math.trunc(Number(entry?.processedCount) || 0)),
        status: `${entry?.status ?? ''}`.trim() || 'completed',
        detail: `${entry?.detail ?? ''}`.trim()
      })),
      updatedDate: `${event.updatedDate ?? ''}`.trim(),
      updatedUser: `${event.updatedUser ?? ''}`.trim()
    };
  }

  private normalizeNotificationTriggerKind(value: string | undefined): AdminNotificationTriggerKind {
    return value === 'timed' || value === 'scheduled_process' ? value : 'action';
  }

  private normalizeNotificationTimingMode(
    value: string | undefined,
    triggerKind: AdminNotificationTriggerKind
  ): AdminNotificationTimingMode {
    if (value === 'delay' || value === 'interval' || value === 'yearly' || value === 'manual') {
      return value;
    }
    return triggerKind === 'scheduled_process' ? 'interval' : 'immediate';
  }

  private normalizeNotificationTime(value: string | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : '09:00';
  }

  private normalizeScheduleSlots(
    slots: AdminNotificationRule['scheduleSlots'] | undefined,
    timingMode: AdminNotificationTimingMode
  ): NonNullable<AdminNotificationRule['scheduleSlots']> {
    const normalized = (slots ?? [])
      .map((slot, index) => {
        const frequency: AdminNotificationScheduleSlot['frequency'] =
          slot?.frequency === 'one-time'
          || slot?.frequency === 'weekly'
          || slot?.frequency === 'bi-weekly'
          || slot?.frequency === 'monthly'
          || slot?.frequency === 'yearly'
            ? slot.frequency
            : 'daily';
        const time = this.normalizeNotificationTime(slot?.time);
        const dayOfWeek = this.clampInteger(slot?.dayOfWeek, 1, 7, 1);
        const date = `${slot?.date ?? ''}`.trim();
        return {
          id: `${slot?.id ?? ''}`.trim() || `run-window-${index + 1}`,
          frequency,
          date,
          dayOfWeek,
          time,
          timezone: `${slot?.timezone ?? ''}`.trim() || 'UTC',
          cronExpression: `${slot?.cronExpression ?? ''}`.trim() || this.scheduleSlotCron({ frequency, date, dayOfWeek, time }),
          actionKey: `${slot?.actionKey ?? ''}`.trim(),
          enabled: slot?.enabled !== false
        };
      });
    return normalized.length > 0 ? normalized : this.defaultScheduleSlots(timingMode);
  }

  private defaultScheduleSlots(timingMode: AdminNotificationTimingMode): NonNullable<AdminNotificationRule['scheduleSlots']> {
    if (timingMode !== 'interval') {
      return [];
    }
    return [{
      id: 'run-window-default',
      frequency: 'daily',
      date: '',
      dayOfWeek: 1,
      time: '09:00',
      timezone: 'UTC',
      cronExpression: '0 0 9 * * ?',
      actionKey: '',
      enabled: true
    }];
  }

  private scheduleSlotCron(input: { frequency: string; date: string; dayOfWeek: number; time: string }): string {
    const [hour, minute] = this.normalizeNotificationTime(input.time).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    if (input.frequency === 'weekly') {
      const quartzDay = (this.clampInteger(input.dayOfWeek, 1, 7, 1) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (input.frequency === 'bi-weekly') {
      const quartzDay = (this.clampInteger(input.dayOfWeek, 1, 7, 1) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (input.frequency === 'monthly') {
      const day = this.scheduleDateParts(input.date).day;
      return `0 ${minute} ${hour} ${day} * ?`;
    }
    if (input.frequency === 'yearly') {
      const date = this.scheduleDateParts(input.date);
      return `0 ${minute} ${hour} ${date.day} ${date.month} ?`;
    }
    if (input.frequency === 'one-time' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      const [, month, day] = input.date.split('-').map(value => Math.max(1, Math.trunc(Number(value) || 1)));
      return `0 ${minute} ${hour} ${day} ${month} ?`;
    }
    return `0 ${minute} ${hour} * * ?`;
  }

  private scheduleDateParts(value: string): { month: number; day: number } {
    const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return {
      month: match ? this.clampInteger(Number(match[2]), 1, 12, 1) : 1,
      day: match ? this.clampInteger(Number(match[3]), 1, 31, 1) : 1
    };
  }

  private demoScheduledRunCount(ruleKey: string): number {
    switch (ruleKey) {
      case 'event-random-groups':
        return 1;
      default:
        return 0;
    }
  }

  private intervalCron(intervalMinutes: number): string {
    return `0 0/${Math.max(1, Math.trunc(Number(intervalMinutes) || 60))} * * * ?`;
  }

  private clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
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

  private withNotificationStorageFallback<T>(task: Promise<T>, fallback: T): Promise<T> {
    return new Promise<T>(resolve => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (value: T) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(value);
      };
      timeoutId = setTimeout(() => finish(fallback), ADMIN_NOTIFICATION_STORAGE_TIMEOUT_MS);
      task.then(finish).catch(() => finish(fallback));
    });
  }

  private withNotificationHttpTimeout<T>(task: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (callback: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback();
      };
      timeoutId = setTimeout(
        () => finish(() => reject(new Error('Notification rules request timed out.'))),
        ADMIN_NOTIFICATION_HTTP_TIMEOUT_MS
      );
      task.then(value => finish(() => resolve(value))).catch(error => finish(() => reject(error)));
    });
  }

  private waitForBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 180));
  }
}
