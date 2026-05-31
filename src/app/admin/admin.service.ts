import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import {
  AppContext,
  AppPopupContext,
  HelpCenterService,
  SessionService,
  UsersService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type DemoUserListItemDto,
  type AdminNotificationCenterState,
  type AdminNotificationRuleLiveEvent,
  type AdminNotificationRule,
  type AdminNotificationRuleParameter,
  type AdminNotificationRuleParameterOption,
  type AdminNotificationRuleParameterValueType,
  type AdminNotificationRunResult,
  type AdminNotificationScheduleSlot,
  type AdminNotificationIntervalUnit,
  type AdminNotificationTimingMode,
  type AdminNotificationTriggerKind,
  type AdminMonitoringCategoryDto,
  type AdminMonitoringEdgeDto,
  type AdminMonitoringHealth,
  type AdminMonitoringMetricDetailRowDto,
  type AdminMonitoringMetricDto,
  type AdminMonitoringNodeDto,
  type AdminMonitoringNodeKind,
  type AdminMonitoringStateDto,
  type AdminMonitoringTone,
  type UserDto
} from '../shared/core';
import type { ChatRecord } from '../shared/core/base/models/chat.model';
import type { ChatPopupMessage } from '../shared/core/base/models/chat.model';
import {
  DemoAdminAffinityGraphRepository,
  DemoChatsRepository,
  DemoHelpCenterService,
  DemoIdeaPostsService,
  DemoShareTokensRepository,
  DemoUsersRatingsRepository,
  DemoUsersRepository,
  type DemoChatRecord
} from '../shared/core/demo';
import { ActivitiesPopupStateService } from '../activity/services/activities-popup-state.service';
import { FirebaseAuthService } from '../shared/core/base/services/firebase-auth.service';
import { RouteDelayService } from '../shared/core/base/services/route-delay.service';
import { AdminModerationRepository } from './repositories/admin-moderation.repository';
import { AdminMonitoringRepository } from './repositories/admin-monitoring.repository';
import { AdminNotificationsRepository } from './repositories/admin-notifications.repository';
import { AdminParamsRepository } from './repositories/admin-params.repository';
import { AdminStatsRepository } from './repositories/admin-stats.repository';
import { AdminHelpSeedBuilder } from './builders/admin-help-seed.builder';
import { AdminModerationSeedBuilder } from './builders/admin-moderation-seed.builder';
import { AdminMonitoringSeedBuilder } from './builders/admin-monitoring-seed.builder';
import { AdminNotificationsSeedBuilder } from './builders/admin-notifications-seed.builder';
import { AdminParamsSeedBuilder } from './builders/admin-params-seed.builder';
import { AdminProfileSeedBuilder } from './builders/admin-profile-seed.builder';
import { AdminStatsSeedBuilder } from './builders/admin-stats-seed.builder';
import type { AdminDashboardDto } from './models/admin-dashboard.model';
import type { DemoAdminHelpTarget } from './models/admin-help.model';
import type {
  AdminChatMessageDto,
  AdminFeedbackDto,
  AdminModerationStore,
  AdminReportDto,
  AdminReportedUserDto
} from './models/admin-moderation.model';
import type {
  AdminParamFieldDto,
  AdminParamOptionDto,
  AdminParamValueType,
  AdminParamsDemoStore,
  AdminParamsHistoryDto,
  AdminParamsHistoryItemDto,
  AdminParamsSectionDto,
  AdminParamsStateDto
} from './models/admin-params.model';
import type { AdminUserDto } from './models/admin-profile.model';
import type {
  AdminBootstrapProgressState,
  AdminPopupKind
} from './models/admin-shell.model';
import type {
  AdminStatsBreakdownItemDto,
  AdminStatsDashboardDto,
  AdminStatsGraphDto,
  AdminStatsGraphTimelinePointDto,
  AdminStatsMetricDto,
  AdminStatsRevenueDto,
  AdminStatsRevenueTimelinePointDto,
  AdminStatsSegmentDto,
  AdminStatsTimelinePointDto
} from './models/admin-stats.model';

const OBSOLETE_NOTIFICATION_RULE_PARAMETER_KEYS = new Set([
  'jobs.process.randomGroups.historyPenalty'
]);

const ADMIN_SESSION_STORAGE_KEY = 'myscoutee-admin-session';
const ADMIN_NOTIFICATION_STORAGE_TIMEOUT_MS = 2500;
const ADMIN_NOTIFICATION_HTTP_TIMEOUT_MS = 12000;
const ADMIN_NOTIFICATION_LOAD_ROUTE = '/admin/notifications';
const ADMIN_NOTIFICATION_SAVE_ROUTE = '/admin/notifications/save';
const ADMIN_NOTIFICATION_RUN_ROUTE = '/admin/notifications/run';
const ADMIN_NOTIFICATION_LOAD_DEMO_DELAY_MS = 1500;
const ADMIN_NOTIFICATION_SAVE_DEMO_DELAY_MS = 1500;
const ADMIN_NOTIFICATION_RUN_DEMO_DELAY_MS = 1500;
const ADMIN_NOTIFICATION_HTTP_PROGRESS_WINDOW_MS = 3000;
const ADMIN_NOTIFICATION_INTERVAL_UNIT = {
  seconds: 'seconds',
  minutes: 'minutes',
  hours: 'hours',
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years'
} as const satisfies Record<string, AdminNotificationIntervalUnit>;
const ADMIN_NOTIFICATION_INTERVAL_SECONDS: Record<AdminNotificationIntervalUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2592000,
  years: 31536000
};

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly usersService = inject(UsersService);
  private readonly location = inject(Location);
  private readonly sessionService = inject(SessionService);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly demoUsersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly demoAffinityGraphRepository = inject(DemoAdminAffinityGraphRepository);
  private readonly demoChatsRepository = inject(DemoChatsRepository);
  private readonly demoShareTokensRepository = inject(DemoShareTokensRepository);
  private readonly demoHelpCenterService = inject(DemoHelpCenterService);
  private readonly demoIdeaPostsService = inject(DemoIdeaPostsService);
  private readonly adminModerationRepository = inject(AdminModerationRepository);
  private readonly adminMonitoringRepository = inject(AdminMonitoringRepository);
  private readonly adminNotificationsRepository = inject(AdminNotificationsRepository);
  private readonly adminParamsRepository = inject(AdminParamsRepository);
  private readonly adminStatsRepository = inject(AdminStatsRepository);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly dashboardRef = signal<AdminDashboardDto | null>(null);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly accessDeniedRef = signal(false);
  private readonly activePopupRef = signal<AdminPopupKind | null>(null);
  private readonly selectedReportedUserRef = signal<AdminReportedUserDto | null>(null);
  private readonly selectedReportRef = signal<AdminReportDto | null>(null);
  private readonly warnedUserIdsRef = signal<Set<string>>(new Set());

  readonly dashboard = this.dashboardRef.asReadonly();
  readonly busy = this.busyRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly accessDenied = this.accessDeniedRef.asReadonly();
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
    return environment.firebaseLoginEnabled === true;
  }

  get usesHttpAdminApi(): boolean {
    return environment.activitiesDataSource === 'http' || this.isFirebaseAdminMode;
  }

  notificationCenterLoadProgressWindowMs(): number {
    return ADMIN_NOTIFICATION_HTTP_PROGRESS_WINDOW_MS;
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
      return Boolean(await this.bootstrapAdmin(adminId));
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
    this.accessDeniedRef.set(false);
    try {
      const dashboard = this.usesHttpAdminApi
        ? await this.loadHttpDashboard(adminUserId)
        : await this.loadDemoDashboard(adminUserId, onProgress);
      this.dashboardRef.set(dashboard);
      this.activateAdminProfile(dashboard);
      if (this.usesHttpAdminApi) {
        await this.refreshAdminMenuCountersFromUserRecord(dashboard.activeAdmin.id);
      }
      void this.helpCenter.preloadAll();
      this.persistAdminSession(dashboard.activeAdmin.id);
      return dashboard;
    } catch (error) {
      if (this.isAdminAccessDenied(error)) {
        this.handleAdminAccessDenied();
        return null;
      }
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

  openParams(): void {
    this.activePopupRef.set('params');
  }

  openStats(): void {
    this.activePopupRef.set('stats');
  }

  openAffinityGraph(): void {
    this.activePopupRef.set('affinity-graph');
  }

  openMonitoring(): void {
    this.activePopupRef.set('monitoring');
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
    this.activitiesContext.openEventChat(chat);
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

    return this.readDemoStatsSnapshot();
  }

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .get<AdminMonitoringStateDto>(`${this.apiBaseUrl}/admin/monitoring`, {
          params: { adminUserId: this.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeMonitoringState(state ?? this.buildDefaultMonitoringState(), 'http');
    }
    return this.readDemoMonitoringState();
  }

  async loadParamsState(): Promise<AdminParamsStateDto> {
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .get<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
          params: { adminUserId: this.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const store = await this.readDemoParamsStore();
    return this.normalizeParamsState(store);
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedFields = fields.map(field => this.normalizeParamField(field));
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .post<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
          adminUserId: this.activeAdmin()?.id ?? '',
          sectionKey: normalizedSectionKey,
          fields: normalizedFields,
          summary
        })
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const store = await this.readDemoParamsStore();
    const nowIso = new Date().toISOString();
    const version = this.nextDemoParamsVersion(store);
    const nextSections = store.sections.map(section => section.key === normalizedSectionKey
      ? {
          ...section,
          version,
          changedDate: nowIso,
          changedBy: this.activeAdmin()?.id ?? 'demo-admin',
          summary: summary.trim() || `Updated ${section.label} parameters.`,
          summaryKey: this.paramSummaryKey(summary.trim() || `Updated ${section.label} parameters.`, section.key),
          fields: normalizedFields.map(field => ({ ...field }))
        }
      : section
    );
    const updatedSection = nextSections.find(section => section.key === normalizedSectionKey);
    const nextStore = this.normalizeParamsStore({
      sections: nextSections,
      updatedDate: nowIso,
      historyBySection: {
        ...store.historyBySection,
        [normalizedSectionKey]: updatedSection
          ? [{
              configId: `demo-params-v${version}`,
              version,
              changedDate: nowIso,
              changedBy: this.activeAdmin()?.id ?? 'demo-admin',
              summary: updatedSection.summary,
              summaryKey: updatedSection.summaryKey,
              active: true,
              fields: updatedSection.fields.map(field => ({ ...field }))
            }, ...(store.historyBySection[normalizedSectionKey] ?? []).map(item => ({ ...item, active: false }))]
          : store.historyBySection[normalizedSectionKey] ?? []
      }
    });
    await this.withNotificationStorageFallback(
      this.adminParamsRepository.writeStore(nextStore),
      undefined
    );
    return this.normalizeParamsState(nextStore);
  }

  async loadParamsHistory(sectionKey: string): Promise<AdminParamsHistoryDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    if (this.usesHttpAdminApi) {
      const history = await this.withNotificationHttpTimeout(this.http
        .get<AdminParamsHistoryDto>(
          `${this.apiBaseUrl}/admin/params/${encodeURIComponent(normalizedSectionKey)}/history`,
          { params: { adminUserId: this.activeAdmin()?.id ?? '' } }
        )
        .toPromise());
      return this.normalizeParamsHistory(history ?? {
        sectionKey: normalizedSectionKey,
        label: normalizedSectionKey,
        versions: []
      });
    }
    const store = await this.readDemoParamsStore();
    const section = store.sections.find(item => item.key === normalizedSectionKey);
    return this.normalizeParamsHistory({
      sectionKey: normalizedSectionKey,
      label: section?.label ?? normalizedSectionKey,
      labelKey: section?.labelKey ?? this.paramSectionLabelKey(normalizedSectionKey),
      versions: store.historyBySection[normalizedSectionKey] ?? []
    });
  }

  async revertParamsSection(sectionKey: string, version: number): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedVersion = Math.max(1, Math.trunc(Number(version) || 0));
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .post<AdminParamsStateDto>(
          `${this.apiBaseUrl}/admin/params/${encodeURIComponent(normalizedSectionKey)}/revert`,
          {
            adminUserId: this.activeAdmin()?.id ?? '',
            version: normalizedVersion
          }
        )
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const history = await this.loadParamsHistory(normalizedSectionKey);
    const selected = history.versions.find(item => item.version === normalizedVersion);
    if (!selected) {
      return this.loadParamsState();
    }
    return this.saveParamsSection(
      normalizedSectionKey,
      selected.fields,
      `Reverted ${history.label} parameters to version ${normalizedVersion}.`
    );
  }

  async loadNotificationCenter(options?: { skipDemoDelay?: boolean }): Promise<AdminNotificationCenterState> {
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .get<AdminNotificationCenterState>(`${this.apiBaseUrl}/admin/notifications`, {
          params: { adminUserId: this.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeNotificationCenter(state ?? this.buildDefaultNotificationCenter());
    }
    const existing = await this.readDemoNotificationCenter();
    await this.waitForAdminNotificationDemoDelay(ADMIN_NOTIFICATION_LOAD_ROUTE, ADMIN_NOTIFICATION_LOAD_DEMO_DELAY_MS, options);
    return this.normalizeNotificationCenter(existing);
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    options?: { skipDemoDelay?: boolean }
  ): Promise<AdminNotificationCenterState> {
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
    const existing = await this.loadNotificationCenter({ skipDemoDelay: true });
    const next = this.normalizeNotificationCenter({
      rules: normalizedRules,
      emailTemplates: existing.emailTemplates,
      updatedDate: new Date().toISOString()
    });
    await this.withNotificationStorageFallback(
      this.adminNotificationsRepository.writeStore(next),
      undefined
    );
    await this.waitForAdminNotificationDemoDelay(ADMIN_NOTIFICATION_SAVE_ROUTE, ADMIN_NOTIFICATION_SAVE_DEMO_DELAY_MS, options);
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
        detail: 'admin.jobs.error.missing.rule.key',
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
    const state = await this.loadNotificationCenter({ skipDemoDelay: true });
    const nowIso = new Date().toISOString();
    const nextRules = state.rules.map(rule => {
      if (rule.ruleKey !== normalizedRuleKey) {
        return rule;
      }
      const count = rule.triggerKind === 'scheduled_process'
        ? this.demoScheduledRunCount(rule.ruleKey)
        : 0;
      const status = rule.manualRunEnabled ? 'completed' : 'skipped';
      const detail = rule.manualRunEnabled ? 'admin.jobs.demo.run.recorded' : 'admin.jobs.demo.action.driven';
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
    const saved = await this.saveNotificationCenter(nextRules, { skipDemoDelay: true });
    await this.waitForAdminNotificationDemoDelay(ADMIN_NOTIFICATION_RUN_ROUTE, ADMIN_NOTIFICATION_RUN_DEMO_DELAY_MS);
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
    await this.demoUsersRepository.flushToIndexedDb();
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
      await this.demoUsersRepository.flushToIndexedDb();
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
    this.accessDeniedRef.set(false);
    this.appCtx.setActiveUserId('');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  }

  handleAdminAccessDenied(): void {
    this.dashboardRef.set(null);
    this.activePopupRef.set(null);
    this.selectedReportedUserRef.set(null);
    this.selectedReportRef.set(null);
    this.accessDeniedRef.set(true);
    this.errorRef.set('This account does not have admin access.');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'firebase') {
      this.appCtx.setActiveUserId(session.profile.id.trim());
    } else {
      this.appCtx.setActiveUserId('');
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
    await this.demoUsersRepository.whenReady();
    await this.initOptionalDemoHelpCenter();
    await this.demoIdeaPostsService.init();
    this.demoUsersRepository.init();
    this.demoUsersRatingsRepository.init();
    await this.ensureDemoAdminProfiles();
    onProgress?.({ percent: 36, label: 'Preparing affinity graph', stage: 'affinityGraph' });
    await this.ensureDemoAffinityGraphSeed();
    this.demoChatsRepository.init();
    await this.ensureDemoNotificationCenterSeed();
    await this.ensureDemoMonitoringSeed();
    await this.ensureDemoStatsSeed();
    await this.ensureDemoParamsSeed();
    await this.ensureDemoAdminMenuCounterSeed();
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

  private async initOptionalDemoHelpCenter(): Promise<void> {
    try {
      await this.demoHelpCenterService.init();
    } catch {
      // Help, privacy, and explanation content should never block admin demo bootstrap.
    }
  }

  private async ensureDemoAffinityGraphSeed(): Promise<void> {
    await this.demoAffinityGraphRepository.buildAndWriteGraphSnapshot();
  }

  private async ensureDemoModerationStore(): Promise<AdminModerationStore> {
    const existing = await this.adminModerationRepository.readStore<AdminModerationStore>();
    if (existing?.reports?.length) {
      return this.normalizeStore(existing);
    }
    const seeded = this.buildSeedDemoModerationStore();
    await this.adminModerationRepository.writeStore(seeded);
    return seeded;
  }

  private async ensureDemoNotificationCenterSeed(): Promise<void> {
    const existing = await this.adminNotificationsRepository.readStore<AdminNotificationCenterState>();
    const seeded = this.withDefaultNotificationRules(existing ?? this.buildDefaultNotificationCenter());
    if (!this.shouldRewriteDemoNotificationSeed(existing, seeded)) {
      return;
    }
    await this.adminNotificationsRepository.writeStore(seeded);
  }

  private async ensureDemoMonitoringSeed(): Promise<void> {
    const existing = await this.adminMonitoringRepository.readStore<AdminMonitoringStateDto>();
    if (existing?.categories?.length) {
      return;
    }
    await this.adminMonitoringRepository.writeStore(this.buildDefaultMonitoringState());
  }

  private async ensureDemoStatsSeed(): Promise<void> {
    const existing = await this.adminStatsRepository.readStore<AdminStatsDashboardDto>();
    const normalized = existing ? this.normalizeStatsDashboard(existing, 'demo') : null;
    if (normalized && this.isFreshStatsDemoSnapshot(normalized)) {
      return;
    }
    await this.adminStatsRepository.writeStore(this.buildSeedDemoStatsSnapshot());
  }

  private async ensureDemoParamsSeed(): Promise<void> {
    const existing = await this.adminParamsRepository.readStore<AdminParamsDemoStore>();
    if (existing?.sections?.length) {
      return;
    }
    await this.adminParamsRepository.writeStore(this.buildDefaultParamsStore());
  }

  private async ensureDemoAdminMenuCounterSeed(): Promise<void> {
    const [notificationCenter, monitoringState] = await Promise.all([
      this.adminNotificationsRepository.readStore<AdminNotificationCenterState>(),
      this.adminMonitoringRepository.readStore<AdminMonitoringStateDto>()
    ]);
    const adminJobs = this.countFailedNotificationRules(notificationCenter);
    const adminMetrics = this.countAlertMonitoringMetrics(monitoringState);
    let changed = false;
    for (const admin of this.adminUsers()) {
      const user = this.demoUsersRepository.queryUserById(admin.id);
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
      this.demoUsersRepository.upsertUser({
        ...user,
        activities: nextActivities
      });
      changed = true;
    }
    if (changed) {
      await this.demoUsersRepository.flushToIndexedDb();
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

  private shouldRewriteDemoNotificationSeed(
    existing: AdminNotificationCenterState | null | undefined,
    seeded: AdminNotificationCenterState
  ): boolean {
    if (!existing?.rules?.length) {
      return true;
    }
    const existingKeys = new Set((existing.rules ?? []).map(rule => `${rule.ruleKey ?? ''}`.trim()));
    return seeded.rules.some(rule => !existingKeys.has(rule.ruleKey));
  }

  private buildSeedDemoModerationStore(): AdminModerationStore {
    return AdminModerationSeedBuilder.buildSeedDemoModerationStore({
      userImageUrl: userId => this.firstUserImage(this.demoUsersRepository.queryUserById(userId)),
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
      await this.demoUsersRepository.flushToIndexedDb();
    }
  }

  private buildDemoAdminUser(admin: AdminUserDto): UserDto {
    return AdminProfileSeedBuilder.buildDemoAdminUser(admin);
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
    const existingChat = this.demoChatsRepository.queryChatItemsByUser(admin.id)
      .find(item => item.id === chat.id);
    const existingMessageIds = new Set(
      existingChat ? this.demoChatsRepository.queryChatMessages(existingChat).map(message => message.id) : []
    );
    let changed = false;
    this.demoAdminHelpTargets().forEach((target, index) => {
      const token = this.demoShareTokensRepository.ensureAdminHelpToken({
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
    await this.demoChatsRepository.flushToIndexedDb();
  }

  private demoAdminHelpTargets(): DemoAdminHelpTarget[] {
    return AdminHelpSeedBuilder.demoAdminHelpTargets();
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
    this.demoChatsRepository.upsertSupportChatMessage(userChat, userMessage, true);
    this.demoChatsRepository.upsertSupportChatMessage(adminChat, adminMessage, false);
    await this.demoChatsRepository.flushToIndexedDb();
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

  private buildAdminSupportChat(user: AdminReportedUserDto): ChatRecord & { ownerUserId?: string } {
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
      feedback: dashboard.feedback.length,
      adminJobs: user.activities.adminJobs ?? 0,
      adminMetrics: user.activities.adminMetrics ?? 0
    });
  }

  private async refreshAdminMenuCountersFromUserRecord(adminUserId: string): Promise<void> {
    const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
    if (!normalizedAdminUserId) {
      return;
    }
    try {
      const snapshot = await this.usersService.pollUserRealtimeSnapshot(normalizedAdminUserId, null);
      const adminJobs = Math.max(0, Math.trunc(Number(snapshot?.counters?.adminJobs) || 0));
      const adminMetrics = Math.max(0, Math.trunc(Number(snapshot?.counters?.adminMetrics) || 0));
      this.appCtx.patchUserCounterOverrides(normalizedAdminUserId, { adminJobs, adminMetrics });
      const currentUser = this.appCtx.getUserProfile(normalizedAdminUserId);
      if (!currentUser) {
        return;
      }
      this.appCtx.setUserProfile({
        ...currentUser,
        activities: {
          ...currentUser.activities,
          adminJobs,
          adminMetrics
        }
      });
    } catch {
      // The periodic user counter poll keeps the admin menu in sync if the first read is unavailable.
    }
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
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: dashboard.feedback.length,
        adminJobs: Math.max(0, Math.trunc(Number(existingAdminProfile?.activities?.adminJobs) || 0)),
        adminMetrics: Math.max(0, Math.trunc(Number(existingAdminProfile?.activities?.adminMetrics) || 0))
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
    return AdminProfileSeedBuilder.demoAdminImages(adminUserId);
  }

  private isLegacyDemoAdminImage(imageUrl: string | null | undefined): boolean {
    return AdminProfileSeedBuilder.isLegacyDemoAdminImage(imageUrl);
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
    return this.normalizeStatsDashboard(AdminStatsSeedBuilder.buildSeedDemoStatsSnapshot(), 'demo');
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
      activityMix: (dashboard.activityMix ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      graph: this.normalizeStatsGraph(dashboard.graph),
      revenue: this.normalizeStatsRevenue(dashboard.revenue)
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

  private normalizeStatsGraph(graph: AdminStatsGraphDto | null | undefined): AdminStatsGraphDto {
    return {
      healthScore: this.clampInteger(graph?.healthScore ?? 0, 0, 100, 0),
      healthLabelKey: `${graph?.healthLabelKey ?? ''}`.trim() || 'stats.graph.health.cold',
      insightKey: `${graph?.insightKey ?? ''}`.trim() || 'stats.graph.insight.cold',
      metrics: (graph?.metrics ?? []).map(metric => this.normalizeStatsMetric(metric)),
      bridgeUsers: (graph?.bridgeUsers ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      communities: (graph?.communities ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      signals: (graph?.signals ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (graph?.timeline ?? []).map(point => this.normalizeStatsGraphTimelinePoint(point))
    };
  }

  private normalizeStatsGraphTimelinePoint(point: AdminStatsGraphTimelinePointDto): AdminStatsGraphTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      activeEdges: Math.max(0, Math.trunc(Number(point.activeEdges) || 0)),
      newEdges: Math.max(0, Math.trunc(Number(point.newEdges) || 0)),
      recurringEdges: Math.max(0, Math.trunc(Number(point.recurringEdges) || 0)),
      weakTies: Math.max(0, Math.trunc(Number(point.weakTies) || 0)),
      bridgeUsers: Math.max(0, Math.trunc(Number(point.bridgeUsers) || 0)),
      communities: Math.max(0, Math.trunc(Number(point.communities) || 0)),
      networkQuality: Math.max(0, Math.trunc(Number(point.networkQuality) || 0)),
      clusterQuality: Math.max(0, Math.trunc(Number(point.clusterQuality) || 0))
    };
  }

  private normalizeStatsRevenue(revenue: AdminStatsRevenueDto | null | undefined): AdminStatsRevenueDto {
    return {
      metrics: (revenue?.metrics ?? []).map(metric => this.normalizeStatsMetric(metric)),
      assetCategories: (revenue?.assetCategories ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (revenue?.timeline ?? []).map(point => this.normalizeStatsRevenueTimelinePoint(point))
    };
  }

  private normalizeStatsRevenueTimelinePoint(point: AdminStatsRevenueTimelinePointDto): AdminStatsRevenueTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      payableEvents: Math.max(0, Math.trunc(Number(point.payableEvents) || 0)),
      payableAssets: Math.max(0, Math.trunc(Number(point.payableAssets) || 0)),
      projectedEventCents: Math.max(0, Math.trunc(Number(point.projectedEventCents) || 0)),
      projectedAssetCents: Math.max(0, Math.trunc(Number(point.projectedAssetCents) || 0)),
      actualPaymentCents: Math.max(0, Math.trunc(Number(point.actualPaymentCents) || 0)),
      payingUsers: Math.max(0, Math.trunc(Number(point.payingUsers) || 0))
    };
  }

  private isFreshStatsDemoSnapshot(snapshot: AdminStatsDashboardDto): boolean {
    return snapshot.timeline.length > 0
      && snapshot.eventTypes.length > 0
      && snapshot.segments.some(segment => segment.key === 'community')
      && snapshot.segments.some(segment => segment.items.some(item => item.key === 'all-events'))
      && snapshot.segments.some(segment => segment.items.some(item => item.key === 'profile-fill-average'))
      && snapshot.graph.timeline.length > 0
      && snapshot.graph.metrics.some(metric => metric.key === 'graph-network-quality')
      && snapshot.revenue.timeline.length > 0
      && snapshot.revenue.assetCategories.some(item => item.key === 'car')
      && !snapshot.revenue.assetCategories.some(item => item.key === 'equipment' || item.key === 'transport');
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

  private buildDefaultMonitoringState(): AdminMonitoringStateDto {
    return this.normalizeMonitoringState(AdminMonitoringSeedBuilder.buildDefaultMonitoringState(), 'demo');
  }


  private normalizeMonitoringState(
    state: AdminMonitoringStateDto,
    source: AdminMonitoringStateDto['source']
  ): AdminMonitoringStateDto {
    const normalizedSource = `${state.source ?? source}`.trim() as AdminMonitoringStateDto['source'];
    const categories = (state.categories ?? []).map(category => this.normalizeMonitoringCategory(category));
    return {
      generatedAtIso: `${state.generatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      source: ['demo', 'http', 'fallback'].includes(normalizedSource) ? normalizedSource : source,
      health: this.normalizeMonitoringHealth(state.health),
      categories
    };
  }

  private normalizeMonitoringCategory(category: AdminMonitoringCategoryDto): AdminMonitoringCategoryDto {
    const nodes = (category.nodes ?? []).map(node => this.normalizeMonitoringNode(node));
    return {
      key: `${category.key ?? ''}`.trim(),
      labelKey: `${category.labelKey ?? ''}`.trim(),
      summaryKey: `${category.summaryKey ?? ''}`.trim(),
      icon: `${category.icon ?? ''}`.trim() || 'monitoring',
      tone: this.normalizeMonitoringTone(category.tone),
      health: this.normalizeMonitoringCategoryHealth(category.health, nodes),
      total: Math.max(0, Math.trunc(Number(category.total) || 0)),
      nodes,
      edges: (category.edges ?? []).map(edge => this.normalizeMonitoringEdge(edge))
    };
  }

  private normalizeMonitoringNode(node: AdminMonitoringNodeDto): AdminMonitoringNodeDto {
    const kind = `${node.kind ?? ''}`.trim();
    return {
      id: `${node.id ?? ''}`.trim(),
      labelKey: `${node.labelKey ?? ''}`.trim(),
      icon: `${node.icon ?? ''}`.trim() || 'radio_button_checked',
      kind: ['source', 'writeModel', 'queue', 'worker', 'outbox', 'external', 'readModel', 'storage'].includes(kind)
        ? kind as AdminMonitoringNodeKind
        : 'source',
      tone: this.normalizeMonitoringTone(node.tone),
      metrics: (node.metrics ?? []).map(metric => this.normalizeMonitoringMetric(metric))
    };
  }

  private normalizeMonitoringMetric(metric: AdminMonitoringMetricDto): AdminMonitoringMetricDto {
    const value = Math.max(0, Math.trunc(Number(metric.value) || 0));
    const key = `${metric.key ?? ''}`.trim();
    const labelKey = `${metric.labelKey ?? ''}`.trim();
    return {
      key,
      labelKey,
      value,
      valueLabel: `${metric.valueLabel ?? ''}`.trim() || this.compactNumber(value),
      tone: this.normalizeMonitoringTone(metric.tone),
      status: this.normalizeMonitoringMetricHealth(key, labelKey, value, metric.status),
      detailRows: (metric.detailRows ?? []).map(row => this.normalizeMonitoringDetailRow(row))
    };
  }

  private normalizeMonitoringCategoryHealth(
    health: AdminMonitoringHealth,
    nodes: AdminMonitoringNodeDto[]
  ): AdminMonitoringHealth {
    const explicit = this.normalizeMonitoringHealth(health);
    const statuses = nodes.flatMap(node => node.metrics.map(metric => metric.status));
    if (explicit === 'alert' || statuses.includes('alert')) {
      return 'alert';
    }
    if (explicit === 'watch' || statuses.includes('watch')) {
      return 'watch';
    }
    return 'ok';
  }

  private normalizeMonitoringMetricHealth(
    key: string,
    labelKey: string,
    value: number,
    health: AdminMonitoringHealth
  ): AdminMonitoringHealth {
    const explicit = this.normalizeMonitoringHealth(health);
    const lookupKey = `${key} ${labelKey}`.toLowerCase();
    if (value <= 0) {
      return lookupKey.includes('failed') || lookupKey.includes('error') || lookupKey.includes('pending')
        ? 'ok'
        : explicit;
    }
    if (lookupKey.includes('failed') || lookupKey.includes('error')) {
      return 'alert';
    }
    if (
      lookupKey.includes('pending')
      || lookupKey.includes('borrower-updates')
      || lookupKey.includes('deleted')
      || lookupKey.includes('suppression')
      || lookupKey.includes('status-propagation')
      || lookupKey.includes('purge-signals')
    ) {
      return 'watch';
    }
    return explicit;
  }

  private normalizeMonitoringDetailRow(row: AdminMonitoringMetricDetailRowDto): AdminMonitoringMetricDetailRowDto {
    return {
      key: `${row.key ?? ''}`.trim(),
      labelKey: `${row.labelKey ?? ''}`.trim(),
      valueLabel: `${row.valueLabel ?? ''}`.trim(),
      tone: this.normalizeMonitoringTone(row.tone)
    };
  }

  private normalizeMonitoringEdge(edge: AdminMonitoringEdgeDto): AdminMonitoringEdgeDto {
    return {
      from: `${edge.from ?? ''}`.trim(),
      to: `${edge.to ?? ''}`.trim(),
      labelKey: `${edge.labelKey ?? ''}`.trim(),
      tone: this.normalizeMonitoringTone(edge.tone),
      volume: Math.max(0, Math.trunc(Number(edge.volume) || 0))
    };
  }



  private normalizeMonitoringTone(value: string | null | undefined): AdminMonitoringTone {
    const normalized = `${value ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(normalized)
      ? normalized as AdminMonitoringTone
      : 'slate';
  }

  private normalizeMonitoringHealth(value: string | null | undefined): AdminMonitoringHealth {
    const normalized = `${value ?? ''}`.trim();
    return ['ok', 'watch', 'alert'].includes(normalized)
      ? normalized as AdminMonitoringHealth
      : 'ok';
  }

  private async readDemoStatsSnapshot(): Promise<AdminStatsDashboardDto> {
    await this.withNotificationStorageFallback(this.adminStatsRepository.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.adminStatsRepository.readStore<AdminStatsDashboardDto>(),
      null
    );
    if (!existing) {
      throw new Error('Demo stats snapshot is not bootstrapped.');
    }
    const normalized = this.normalizeStatsDashboard(existing, 'demo');
    if (!this.isFreshStatsDemoSnapshot(normalized)) {
      throw new Error('Demo stats snapshot is stale.');
    }
    return normalized;
  }

  private async readDemoMonitoringState(): Promise<AdminMonitoringStateDto> {
    await this.withNotificationStorageFallback(this.adminMonitoringRepository.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.adminMonitoringRepository.readStore<AdminMonitoringStateDto>(),
      null
    );
    if (!existing?.categories?.length) {
      throw new Error('Demo monitoring state is not bootstrapped.');
    }
    return this.normalizeMonitoringState(existing, 'demo');
  }

  private async readDemoNotificationCenter(): Promise<AdminNotificationCenterState> {
    await this.withNotificationStorageFallback(this.adminNotificationsRepository.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.adminNotificationsRepository.readStore<AdminNotificationCenterState>(),
      null
    );
    if (!existing?.rules?.length) {
      throw new Error('Demo notification center is not bootstrapped.');
    }
    return this.normalizeNotificationCenter(existing);
  }

  private async readDemoParamsStore(): Promise<AdminParamsDemoStore> {
    await this.withNotificationStorageFallback(this.adminParamsRepository.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.adminParamsRepository.readStore<AdminParamsDemoStore>(),
      null
    );
    if (!existing?.sections?.length) {
      throw new Error('Demo params store is not bootstrapped.');
    }
    return this.normalizeParamsStore(existing);
  }

  private buildDefaultParamsStore(): AdminParamsDemoStore {
    return this.normalizeParamsStore(AdminParamsSeedBuilder.buildDefaultParamsStore());
  }











  private normalizeNotificationRuleParameter(field: AdminNotificationRuleParameter): AdminNotificationRuleParameter {
    const valueType: AdminNotificationRuleParameterValueType = field.valueType === 'text' ? 'text' : 'number';
    const numberValue = valueType === 'number'
      ? (Number.isFinite(Number(field.numberValue)) ? Number(field.numberValue) : 0)
      : null;
    return {
      key: `${field.key ?? ''}`.trim(),
      label: `${field.label ?? ''}`.trim() || `${field.key ?? ''}`.trim(),
      labelKey: `${field.labelKey ?? ''}`.trim() || this.paramFieldLabelKey(field.key),
      group: `${field.group ?? ''}`.trim() || 'General',
      groupKey: `${field.groupKey ?? ''}`.trim() || this.paramGroupLabelKey(field.group),
      valueType,
      numberValue,
      textValue: valueType === 'text' ? `${field.textValue ?? ''}`.trim() : null,
      unit: `${field.unit ?? ''}`.trim(),
      options: (field.options ?? []).map(option => this.normalizeNotificationRuleParameterOption(option)),
      strategy: `${field.strategy ?? ''}`.trim(),
      strategyKey: `${field.strategyKey ?? ''}`.trim() || this.paramStrategyLabelKey(field.strategy),
      readOnly: field.readOnly === true
    };
  }

  private normalizeNotificationRuleParameterOption(
    option: AdminNotificationRuleParameterOption
  ): AdminNotificationRuleParameterOption {
    const value = `${option.value ?? ''}`.trim();
    return {
      value,
      label: `${option.label ?? ''}`.trim() || value,
      labelKey: `${option.labelKey ?? ''}`.trim() || this.paramStrategyLabelKey(value)
    };
  }

  private normalizeParamsState(state: AdminParamsStateDto): AdminParamsStateDto {
    return {
      sections: (state.sections ?? []).map(section => this.normalizeParamsSection(section)),
      updatedDate: `${state.updatedDate ?? ''}`.trim() || new Date().toISOString()
    };
  }

  private normalizeParamsStore(store: AdminParamsDemoStore): AdminParamsDemoStore {
    const state = this.normalizeParamsState(store);
    const historyBySection: Record<string, AdminParamsHistoryItemDto[]> = {};
    for (const section of state.sections) {
      historyBySection[section.key] = (store.historyBySection?.[section.key] ?? [])
        .map(item => this.normalizeParamsHistoryItem(item))
        .sort((left, right) => right.version - left.version);
      if (!historyBySection[section.key].length) {
        historyBySection[section.key] = [{
          configId: `demo-params-${section.key}-v${section.version}`,
          version: section.version,
          changedDate: section.changedDate,
          changedBy: section.changedBy,
          summary: section.summary,
          active: true,
          fields: section.fields.map(field => ({ ...field }))
        }];
      }
    }
    return {
      ...state,
      historyBySection
    };
  }

  private normalizeParamsSection(section: AdminParamsSectionDto): AdminParamsSectionDto {
    return {
      key: `${section.key ?? ''}`.trim(),
      label: `${section.label ?? ''}`.trim() || `${section.key ?? ''}`.trim(),
      labelKey: `${section.labelKey ?? ''}`.trim() || this.paramSectionLabelKey(section.key),
      version: Math.max(1, Math.trunc(Number(section.version) || 1)),
      changedDate: `${section.changedDate ?? ''}`.trim() || new Date().toISOString(),
      changedBy: `${section.changedBy ?? ''}`.trim() || 'system',
      summary: `${section.summary ?? ''}`.trim(),
      summaryKey: `${section.summaryKey ?? ''}`.trim() || this.paramSummaryKey(section.summary, section.key),
      fields: (section.fields ?? []).map(field => this.normalizeParamField(field))
    };
  }

  private normalizeParamField(field: AdminParamFieldDto): AdminParamFieldDto {
    const valueType: AdminParamValueType = field.valueType === 'text' ? 'text' : 'number';
    const numberValue = valueType === 'number'
      ? (Number.isFinite(Number(field.numberValue)) ? Number(field.numberValue) : 0)
      : null;
    return {
      key: `${field.key ?? ''}`.trim(),
      label: `${field.label ?? ''}`.trim() || `${field.key ?? ''}`.trim(),
      labelKey: `${field.labelKey ?? ''}`.trim() || this.paramFieldLabelKey(field.key),
      group: `${field.group ?? ''}`.trim() || 'General',
      groupKey: `${field.groupKey ?? ''}`.trim() || this.paramGroupLabelKey(field.group),
      valueType,
      numberValue,
      textValue: valueType === 'text' ? `${field.textValue ?? ''}`.trim() : null,
      unit: `${field.unit ?? ''}`.trim(),
      options: (field.options ?? []).map(option => this.normalizeParamOption(option)),
      strategy: `${field.strategy ?? ''}`.trim(),
      strategyKey: `${field.strategyKey ?? ''}`.trim() || this.paramStrategyLabelKey(field.strategy),
      readOnly: field.readOnly === true
    };
  }

  private normalizeParamOption(option: AdminParamOptionDto): AdminParamOptionDto {
    const value = `${option.value ?? ''}`.trim();
    return {
      value,
      label: `${option.label ?? ''}`.trim() || value,
      labelKey: `${option.labelKey ?? ''}`.trim() || this.paramStrategyLabelKey(value)
    };
  }

  private normalizeParamsHistory(history: AdminParamsHistoryDto): AdminParamsHistoryDto {
    return {
      sectionKey: `${history.sectionKey ?? ''}`.trim(),
      label: `${history.label ?? ''}`.trim() || `${history.sectionKey ?? ''}`.trim(),
      labelKey: `${history.labelKey ?? ''}`.trim() || this.paramSectionLabelKey(history.sectionKey),
      versions: (history.versions ?? [])
        .map(item => this.normalizeParamsHistoryItem(item))
        .sort((left, right) => right.version - left.version)
    };
  }

  private normalizeParamsHistoryItem(item: AdminParamsHistoryItemDto): AdminParamsHistoryItemDto {
    return {
      configId: `${item.configId ?? ''}`.trim() || null,
      version: Math.max(1, Math.trunc(Number(item.version) || 1)),
      changedDate: `${item.changedDate ?? ''}`.trim() || new Date().toISOString(),
      changedBy: `${item.changedBy ?? ''}`.trim() || 'system',
      summary: `${item.summary ?? ''}`.trim(),
      summaryKey: `${item.summaryKey ?? ''}`.trim(),
      active: item.active === true,
      fields: (item.fields ?? []).map(field => this.normalizeParamField(field))
    };
  }

  private paramSectionLabelKey(sectionKey: string | null | undefined): string {
    const normalized = `${sectionKey ?? ''}`.trim();
    return normalized ? `admin.params.section.${normalized}` : 'admin.params.platform';
  }

  private paramFieldLabelKey(fieldKey: string | null | undefined): string {
    const normalized = `${fieldKey ?? ''}`.trim();
    return normalized ? `admin.params.field.${normalized}` : '';
  }

  private paramGroupLabelKey(group: string | null | undefined): string {
    const normalized = this.paramsI18nSegment(group);
    return normalized ? `admin.params.group.${normalized}` : 'admin.params.group.general';
  }

  private paramStrategyLabelKey(strategy: string | null | undefined): string {
    const normalized = `${strategy ?? ''}`.trim();
    return normalized ? `admin.params.strategy.${normalized}` : '';
  }

  private paramOptionsFor(fieldKey: string | null | undefined): AdminParamOptionDto[] {
    if (`${fieldKey ?? ''}`.trim() !== 'distance.strategy') {
      return [];
    }
    return ['linear', 'exponential', 'bucketed'].map(value => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      labelKey: this.paramStrategyLabelKey(value)
    }));
  }

  private paramSummaryKey(summary: string | null | undefined, sectionKey: string | null | undefined): string {
    const normalizedSummary = `${summary ?? ''}`.trim();
    const normalizedSection = `${sectionKey ?? ''}`.trim();
    if (!normalizedSummary || !normalizedSection) {
      return '';
    }
    if (/^Updated\s+.+?\s+parameters\.$/i.test(normalizedSummary)) {
      return `admin.params.summary.updated.${normalizedSection}`;
    }
    return '';
  }

  private paramsI18nSegment(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US');
  }

  private nextDemoParamsVersion(store: AdminParamsDemoStore): number {
    return Math.max(
      1,
      ...store.sections.map(section => section.version),
      ...Object.values(store.historyBySection ?? {}).flat().map(item => item.version)
    ) + 1;
  }

  private buildDefaultNotificationCenter(): AdminNotificationCenterState {
    return this.normalizeNotificationCenter(AdminNotificationsSeedBuilder.buildDefaultNotificationCenter());
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

  private withDefaultNotificationRules(state: AdminNotificationCenterState): AdminNotificationCenterState {
    const normalized = this.normalizeNotificationCenter(state);
    const defaults = this.buildDefaultNotificationCenter();
    const existingByKey = new Map((state.rules ?? []).map(rule => [`${rule.ruleKey ?? ''}`.trim(), rule] as const));
    const defaultKeys = new Set(defaults.rules.map(rule => rule.ruleKey));
    const mergedRules = [
      ...defaults.rules.map(defaultRule => this.mergeDefaultNotificationRule(defaultRule, existingByKey.get(defaultRule.ruleKey))),
      ...normalized.rules.filter(rule => !defaultKeys.has(rule.ruleKey))
    ];
    return this.normalizeNotificationCenter({
      ...normalized,
      rules: mergedRules,
      emailTemplates: normalized.emailTemplates.length > 0 ? normalized.emailTemplates : defaults.emailTemplates,
      updatedDate: normalized.updatedDate || defaults.updatedDate
    });
  }

  private mergeDefaultNotificationRule(
    defaultRule: AdminNotificationRule,
    existingRule: AdminNotificationRule | undefined
  ): AdminNotificationRule {
    if (!existingRule) {
      return defaultRule;
    }
    return {
      ...defaultRule,
      ...existingRule,
      label: existingRule.label || defaultRule.label,
      category: existingRule.category || defaultRule.category,
      description: existingRule.description || defaultRule.description,
      actionKey: existingRule.actionKey || defaultRule.actionKey,
      triggerKind: existingRule.triggerKind || defaultRule.triggerKind,
      manualRunEnabled: existingRule.manualRunEnabled === true,
      priority: existingRule.priority || defaultRule.priority,
      channels: existingRule.channels ?? defaultRule.channels,
      timing: existingRule.timing ?? defaultRule.timing,
      scheduleSlots: this.mergeDefaultNotificationRuleScheduleSlots(defaultRule, existingRule),
      parameters: this.mergeNotificationRuleParameters(defaultRule.parameters, existingRule.parameters),
      message: existingRule.message ?? defaultRule.message,
      runState: existingRule.runState ?? defaultRule.runState,
      runHistory: existingRule.runHistory ?? defaultRule.runHistory,
      adminManageable: (existingRule as AdminNotificationRule & { adminManageable?: unknown }).adminManageable === undefined
        ? defaultRule.adminManageable
        : existingRule.adminManageable === true
    };
  }

  private normalizeNotificationRule(rule: AdminNotificationRule): AdminNotificationRule {
    const triggerKind = this.normalizeNotificationTriggerKind(rule.triggerKind);
    const timingMode = this.normalizeNotificationTimingMode(rule.timing?.mode, triggerKind);
    const interval = this.normalizeNotificationInterval(
      rule.timing?.intervalAmount,
      rule.timing?.intervalUnit,
      rule.timing?.intervalSeconds,
      rule.timing?.intervalMinutes
    );
    const time = this.normalizeNotificationTime(rule.timing?.time);
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
        intervalMinutes: interval.minutes,
        intervalSeconds: interval.seconds,
        intervalAmount: interval.amount,
        intervalUnit: interval.unit,
        month: this.clampInteger(rule.timing?.month, 1, 12, 1),
        dayOfMonth: this.clampInteger(rule.timing?.dayOfMonth, 1, 31, 1),
        time,
        timezone: `${rule.timing?.timezone ?? ''}`.trim() || 'UTC',
        cronExpression: `${rule.timing?.cronExpression ?? ''}`.trim()
          || this.intervalExpression(interval.amount, interval.unit, time)
      },
      scheduleSlots: this.normalizeScheduleSlots(rule.scheduleSlots, timingMode),
      parameters: (rule.parameters ?? [])
        .map(field => this.normalizeNotificationRuleParameter(field))
        .filter(field => field.key),
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

  private mergeDefaultNotificationRuleScheduleSlots(
    defaultRule: AdminNotificationRule,
    existingRule: AdminNotificationRule
  ): AdminNotificationRule['scheduleSlots'] {
    const existingSlots = existingRule.scheduleSlots ?? [];
    const defaultSlots = defaultRule.scheduleSlots ?? [];
    if (!defaultSlots.length) {
      return [];
    }
    if (defaultSlots.length && existingSlots.length && existingSlots.every(slot => this.isGeneratedDefaultRunWindow(slot))) {
      return defaultSlots;
    }
    return existingSlots.length ? existingSlots : defaultSlots;
  }

  private isGeneratedDefaultRunWindow(slot: AdminNotificationScheduleSlot): boolean {
    return `${slot.id ?? ''}`.trim() === 'run-window-default'
      && slot.frequency === 'daily'
      && `${slot.time ?? ''}`.trim() === '09:00'
      && `${slot.date ?? ''}`.trim() === ''
      && Math.trunc(Number(slot.dayOfWeek) || 1) === 1;
  }

  private mergeNotificationRuleParameters(
    defaultParameters: readonly AdminNotificationRuleParameter[] | undefined,
    existingParameters: readonly AdminNotificationRuleParameter[] | undefined
  ): AdminNotificationRuleParameter[] {
    if (!(defaultParameters ?? []).length) {
      return [];
    }
    const existingByKey = new Map(
      (existingParameters ?? [])
        .map(field => this.normalizeNotificationRuleParameter(field))
        .filter(field => field.key)
        .filter(field => !OBSOLETE_NOTIFICATION_RULE_PARAMETER_KEYS.has(field.key))
        .map(field => [field.key, field] as const)
    );
    const defaultKeys = new Set<string>();
    const merged = (defaultParameters ?? [])
      .map(defaultField => {
        const normalizedDefault = this.normalizeNotificationRuleParameter(defaultField);
        defaultKeys.add(normalizedDefault.key);
        const existing = existingByKey.get(normalizedDefault.key);
        if (!existing) {
          return normalizedDefault;
        }
        return this.normalizeNotificationRuleParameter({
          ...normalizedDefault,
          numberValue: existing.valueType === 'number' ? existing.numberValue : normalizedDefault.numberValue,
          textValue: existing.valueType === 'text' ? existing.textValue : normalizedDefault.textValue
        });
      })
      .filter(field => field.key);
    const custom = [...existingByKey.values()].filter(field => !defaultKeys.has(field.key));
    return [...merged, ...custom];
  }

  private normalizeAdminManageable(rule: AdminNotificationRule): boolean {
    const raw = (rule as AdminNotificationRule & { adminManageable?: unknown }).adminManageable;
    if (raw !== undefined && raw !== null) {
      return raw === true;
    }
    return false;
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
    return [];
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
      case 'event-auto-inviter':
        return 3;
      case 'event-tournament-review':
        return 2;
      case 'notification-outbox':
        return 12;
      case 'affinity-recompute':
        return 8;
      case 'scheduled-messages':
        return 4;
      case 'account-purge':
        return 1;
      default:
        return 0;
    }
  }

  private normalizeNotificationInterval(
    amountValue: number | null | undefined,
    unitValue: string | null | undefined,
    secondsValue: number | null | undefined,
    minutesValue: number | null | undefined
  ): { amount: number; unit: AdminNotificationIntervalUnit; seconds: number; minutes: number } {
    const explicitAmount = Math.trunc(Number(amountValue) || 0);
    const explicitUnit = this.normalizeNotificationIntervalUnit(unitValue);
    if (explicitAmount > 0 && explicitUnit) {
      const seconds = explicitAmount * ADMIN_NOTIFICATION_INTERVAL_SECONDS[explicitUnit];
      return {
        amount: explicitAmount,
        unit: explicitUnit,
        seconds,
        minutes: Math.max(1, Math.ceil(seconds / 60))
      };
    }
    const seconds = Math.max(
      1,
      Math.trunc(Number(secondsValue) || Math.max(1, Math.trunc(Number(minutesValue) || 60)) * 60)
    );
    const unit = this.fixedNotificationIntervalUnit(seconds);
    return {
      amount: Math.max(1, Math.trunc(seconds / ADMIN_NOTIFICATION_INTERVAL_SECONDS[unit])),
      unit,
      seconds,
      minutes: Math.max(1, Math.ceil(seconds / 60))
    };
  }

  private normalizeNotificationIntervalUnit(value: string | null | undefined): AdminNotificationIntervalUnit | null {
    const normalized = `${value ?? ''}`.trim();
    return Object.values(ADMIN_NOTIFICATION_INTERVAL_UNIT).includes(normalized as AdminNotificationIntervalUnit)
      ? normalized as AdminNotificationIntervalUnit
      : null;
  }

  private fixedNotificationIntervalUnit(seconds: number): AdminNotificationIntervalUnit {
    const value = Math.max(1, Math.trunc(Number(seconds) || 1));
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.years === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.years;
    }
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.months === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.months;
    }
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.weeks === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.weeks;
    }
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.days === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.days;
    }
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.hours === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.hours;
    }
    if (value % ADMIN_NOTIFICATION_INTERVAL_SECONDS.minutes === 0) {
      return ADMIN_NOTIFICATION_INTERVAL_UNIT.minutes;
    }
    return ADMIN_NOTIFICATION_INTERVAL_UNIT.seconds;
  }

  private intervalExpression(amountValue: number, unit: AdminNotificationIntervalUnit, time: string): string {
    const amount = Math.max(1, Math.trunc(Number(amountValue) || 1));
    const [hour, minute] = this.normalizeNotificationTime(time).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    if (unit === ADMIN_NOTIFICATION_INTERVAL_UNIT.seconds) {
      return `0/${amount} * * * * ?`;
    }
    if (unit === ADMIN_NOTIFICATION_INTERVAL_UNIT.minutes) {
      return `0 0/${amount} * * * ?`;
    }
    if (unit === ADMIN_NOTIFICATION_INTERVAL_UNIT.hours) {
      return `0 ${minute} 0/${amount} * * ?`;
    }
    if (unit === ADMIN_NOTIFICATION_INTERVAL_UNIT.days) {
      return `0 ${minute} ${hour} 1/${amount} * ?`;
    }
    return `@every ${amount} ${unit} @ ${this.normalizeNotificationTime(time)}`;
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
    if (this.isAdminAccessDenied(error)) {
      return 'This account does not have admin access.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message.trim();
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Admin workspace is unavailable.';
  }

  private isAdminAccessDenied(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
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

  private async waitForAdminNotificationDemoDelay(
    route: string,
    fallbackDelayMs: number,
    options?: { skipDemoDelay?: boolean }
  ): Promise<void> {
    if (this.usesHttpAdminApi || options?.skipDemoDelay === true) {
      return;
    }
    await this.routeDelay.waitForRouteDelay(route, undefined, undefined, fallbackDelayMs);
  }

  private waitForBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 180));
  }
}
