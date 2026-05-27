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
  type ShareTokenRecord,
  type DemoUserListItemDto,
  type AdminNotificationCenterState,
  type AdminNotificationRuleLiveEvent,
  type AdminNotificationRule,
  type AdminNotificationRuleParameter,
  type AdminNotificationRuleParameterOption,
  type AdminNotificationRuleParameterValueType,
  type AdminNotificationRunResult,
  type AdminNotificationScheduleSlot,
  type AdminNotificationTemplateOption,
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
import { AppMemoryDb } from '../shared/core/base/db';
import type { ChatRecord } from '../shared/core/base/models/chat.model';
import type { ChatPopupMessage } from '../shared/core/base/models/chat.model';
import {
  DemoAdminAffinityGraphRepository,
  DemoChatsRepository,
  DemoHelpCenterService,
  DemoUsersRatingsRepository,
  DemoUsersRepository
} from '../shared/core/demo';
import { ADMIN_AFFINITY_GRAPH_STORE_KEY } from '../shared/core/base/interfaces/admin-affinity-graph.interface';
import { CHATS_TABLE_NAME, type DemoChatRecord } from '../shared/core/demo/models/chats.model';
import { SHARE_TOKENS_TABLE_NAME } from '../shared/core/demo/models/share-tokens.model';
import { ActivitiesPopupStateService } from '../activity/services/activities-popup-state.service';
import { FirebaseAuthService } from '../shared/core/base/services/firebase-auth.service';
import { RouteDelayService } from '../shared/core/base/services/route-delay.service';

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
  | 'params'
  | 'stats'
  | 'affinity-graph'
  | 'monitoring'
  | 'item-preview';

const OBSOLETE_NOTIFICATION_RULE_PARAMETER_KEYS = new Set([
  'jobs.process.randomGroups.historyPenalty'
]);

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

export interface AdminStatsGraphTimelinePointDto {
  dateKey: string;
  label: string;
  activeEdges: number;
  newEdges: number;
  recurringEdges: number;
  weakTies: number;
  bridgeUsers: number;
  communities: number;
  networkQuality: number;
  clusterQuality: number;
}

export interface AdminStatsGraphDto {
  healthScore: number;
  healthLabelKey: string;
  insightKey: string;
  metrics: AdminStatsMetricDto[];
  bridgeUsers: AdminStatsBreakdownItemDto[];
  communities: AdminStatsBreakdownItemDto[];
  signals: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsGraphTimelinePointDto[];
}

export interface AdminStatsRevenueTimelinePointDto {
  dateKey: string;
  label: string;
  payableEvents: number;
  payableAssets: number;
  projectedEventCents: number;
  projectedAssetCents: number;
  actualPaymentCents: number;
  payingUsers: number;
}

export interface AdminStatsRevenueDto {
  metrics: AdminStatsMetricDto[];
  assetCategories: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsRevenueTimelinePointDto[];
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
  graph: AdminStatsGraphDto;
  revenue: AdminStatsRevenueDto;
}

export type AdminParamValueType = 'number' | 'text';

export interface AdminParamOptionDto {
  value: string;
  label: string;
  labelKey?: string | null;
}

export interface AdminParamFieldDto {
  key: string;
  label: string;
  labelKey?: string | null;
  group: string;
  groupKey?: string | null;
  valueType: AdminParamValueType;
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  options?: AdminParamOptionDto[] | null;
  strategy?: string | null;
  strategyKey?: string | null;
  readOnly?: boolean | null;
}

export interface AdminParamsSectionDto {
  key: string;
  label: string;
  labelKey?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsStateDto {
  sections: AdminParamsSectionDto[];
  updatedDate: string;
}

export interface AdminParamsHistoryItemDto {
  configId?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  active: boolean;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsHistoryDto {
  sectionKey: string;
  label: string;
  labelKey?: string | null;
  versions: AdminParamsHistoryItemDto[];
}

interface AdminModerationStore {
  seededAtIso: string;
  reports: AdminReportDto[];
  feedback: AdminFeedbackDto[];
}

interface AdminParamsDemoStore extends AdminParamsStateDto {
  historyBySection: Record<string, AdminParamsHistoryItemDto[]>;
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

type AdminBootstrapProgressStage = 'selector' | 'indexedDb' | 'records' | 'affinityGraph' | 'profile' | 'ready';

export interface AdminBootstrapProgressState {
  percent: number;
  label: string;
  stage: AdminBootstrapProgressStage;
}

const ADMIN_SESSION_STORAGE_KEY = 'myscoutee-admin-session';
const ADMIN_MODERATION_STORE_KEY = 'adminModeration';
const ADMIN_NOTIFICATION_STORE_KEY = 'adminNotificationRules';
const ADMIN_STATS_STORE_KEY = 'adminStats';
const ADMIN_PARAMS_STORE_KEY = 'adminParams';
const ADMIN_MONITORING_STORE_KEY = 'adminMonitoring';
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
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly demoUsersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly demoAffinityGraphRepository = inject(DemoAdminAffinityGraphRepository);
  private readonly demoChatsRepository = inject(DemoChatsRepository);
  private readonly demoHelpCenterService = inject(DemoHelpCenterService);
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

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    if (this.usesHttpAdminApi) {
      const state = await this.withNotificationHttpTimeout(this.http
        .get<AdminMonitoringStateDto>(`${this.apiBaseUrl}/admin/monitoring`, {
          params: { adminUserId: this.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeMonitoringState(state ?? this.buildDefaultMonitoringState(), 'http');
    }
    await this.withNotificationStorageFallback(this.memoryDb.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.memoryDb.readIndexedDbTableEntry<AdminMonitoringStateDto>(ADMIN_MONITORING_STORE_KEY),
      null
    );
    return this.normalizeMonitoringState(existing ?? this.buildDefaultMonitoringState(), 'demo');
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
    const store = await this.loadDemoParamsStore();
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
    const store = await this.loadDemoParamsStore();
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
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_PARAMS_STORE_KEY, nextStore),
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
    const store = await this.loadDemoParamsStore();
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
    await this.withNotificationStorageFallback(this.memoryDb.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.memoryDb.readIndexedDbTableEntry<AdminNotificationCenterState>(ADMIN_NOTIFICATION_STORE_KEY),
      null
    );
    if (existing?.rules?.length) {
      await this.waitForAdminNotificationDemoDelay(ADMIN_NOTIFICATION_LOAD_ROUTE, ADMIN_NOTIFICATION_LOAD_DEMO_DELAY_MS, options);
      return this.normalizeNotificationCenter(existing);
    }
    await this.waitForAdminNotificationDemoDelay(ADMIN_NOTIFICATION_LOAD_ROUTE, ADMIN_NOTIFICATION_LOAD_DEMO_DELAY_MS, options);
    return this.normalizeNotificationCenter({
      rules: [],
      emailTemplates: this.defaultNotificationTemplateOptions(),
      updatedDate: new Date().toISOString()
    });
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
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_NOTIFICATION_STORE_KEY, next),
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
    await this.memoryDb.whenReady();
    await this.initOptionalDemoHelpCenter();
    this.demoUsersRepository.init();
    this.demoUsersRatingsRepository.init();
    await this.ensureDemoAdminProfiles();
    onProgress?.({ percent: 36, label: 'Preparing affinity graph', stage: 'affinityGraph' });
    await this.ensureDemoAffinityGraphSeed();
    this.demoChatsRepository.init();
    await this.ensureDemoNotificationCenterSeed();
    await this.ensureDemoMonitoringSeed();
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
    const snapshot = await this.demoAffinityGraphRepository.buildGraphSnapshot();
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_AFFINITY_GRAPH_STORE_KEY, snapshot);
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

  private async ensureDemoNotificationCenterSeed(): Promise<void> {
    const existing = await this.memoryDb.readIndexedDbTableEntry<AdminNotificationCenterState>(ADMIN_NOTIFICATION_STORE_KEY);
    const seeded = this.withDefaultNotificationRules(existing ?? this.buildDefaultNotificationCenter());
    if (!this.shouldRewriteDemoNotificationSeed(existing, seeded)) {
      return;
    }
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_NOTIFICATION_STORE_KEY, seeded);
  }

  private async ensureDemoMonitoringSeed(): Promise<void> {
    const existing = await this.memoryDb.readIndexedDbTableEntry<AdminMonitoringStateDto>(ADMIN_MONITORING_STORE_KEY);
    if (existing?.categories?.length) {
      return;
    }
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_MONITORING_STORE_KEY, this.buildDefaultMonitoringState());
  }

  private async ensureDemoAdminMenuCounterSeed(): Promise<void> {
    const [notificationCenter, monitoringState] = await Promise.all([
      this.memoryDb.readIndexedDbTableEntry<AdminNotificationCenterState>(ADMIN_NOTIFICATION_STORE_KEY),
      this.memoryDb.readIndexedDbTableEntry<AdminMonitoringStateDto>(ADMIN_MONITORING_STORE_KEY)
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
      await this.memoryDb.flushToIndexedDb();
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
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        adminJobs: 0,
        adminMetrics: 0
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
    const metric = (
      key: string,
      labelKey: string,
      value: number,
      valueLabel: string,
      icon: string,
      tone: AdminStatsMetricDto['tone'],
      percent: number
    ): AdminStatsMetricDto => ({ key, labelKey, value, valueLabel, icon, tone, percent });
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
    const revenueTimeline: AdminStatsRevenueTimelinePointDto[] = [
      ['2026-04-28', 'Apr 28', 1, 1, 18000, 12000, 0, 0],
      ['2026-04-29', 'Apr 29', 1, 2, 12500, 22000, 4200, 2],
      ['2026-04-30', 'Apr 30', 0, 1, 0, 9500, 3800, 1],
      ['2026-05-01', 'May 1', 2, 1, 26000, 18000, 6200, 3],
      ['2026-05-02', 'May 2', 1, 2, 14500, 24000, 5300, 2],
      ['2026-05-03', 'May 3', 0, 1, 0, 8500, 0, 0],
      ['2026-05-04', 'May 4', 2, 1, 31000, 13000, 7800, 4],
      ['2026-05-05', 'May 5', 1, 1, 16500, 16000, 2900, 1],
      ['2026-05-06', 'May 6', 0, 2, 0, 28000, 6100, 3],
      ['2026-05-07', 'May 7', 2, 1, 27500, 14000, 4500, 2],
      ['2026-05-08', 'May 8', 1, 0, 15500, 0, 0, 0],
      ['2026-05-09', 'May 9', 1, 2, 21000, 34000, 8200, 3],
      ['2026-05-10', 'May 10', 0, 1, 0, 15000, 3200, 1],
      ['2026-05-11', 'May 11', 0, 0, 0, 0, 0, 0]
    ].map(([dateKey, label, payableEvents, payableAssets, projectedEventCents, projectedAssetCents, actualPaymentCents, payingUsers]) => ({
      dateKey: `${dateKey}`,
      label: `${label}`,
      payableEvents: Number(payableEvents),
      payableAssets: Number(payableAssets),
      projectedEventCents: Number(projectedEventCents),
      projectedAssetCents: Number(projectedAssetCents),
      actualPaymentCents: Number(actualPaymentCents),
      payingUsers: Number(payingUsers)
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
        { key: 'departed-users', labelKey: 'stats.kpi.departed.users', value: 7, valueLabel: '7', icon: 'person_remove', tone: 'slate', percent: 5 },
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
          item('profile.deleted', 'stats.event.profile.deleted', 7, 135, 'person_remove', 'slate'),
          item('deleted-median-days', 'stats.event.deleted.median.days', 46, 46, 'timer', 'gold'),
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
        { key: 'matched-rooms', labelKey: '', label: 'Matched rooms', value: 8, total: 47, icon: 'hub', tone: 'purple' },
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
      ],
      graph: {
        healthScore: 78,
        healthLabelKey: 'stats.graph.health.watch',
        insightKey: 'stats.graph.insight.healthy',
        metrics: [
          metric('graph-health', 'stats.graph.metric.health', 78, '78', 'monitoring', 'green', 78),
          metric('graph-users', 'stats.graph.metric.users', 42, '42', 'person', 'blue', 100),
          metric('graph-edges', 'stats.graph.metric.edges', 116, '116', 'share', 'purple', 92),
          metric('graph-avg-degree', 'stats.graph.metric.avg.degree', 55, '5.5', 'hub', 'gold', 100),
          metric('graph-communities', 'stats.graph.metric.communities', 6, '6', 'bubble_chart', 'green', 57),
          metric('graph-bridges', 'stats.graph.metric.bridges', 8, '8', 'conversion_path', 'red', 100),
          metric('graph-network-quality', 'stats.graph.metric.network.quality', 64, '64%', 'ssid_chart', 'blue', 64),
          metric('graph-cluster-quality', 'stats.graph.metric.cluster.quality', 79, '79%', 'bubble_chart', 'green', 79),
          metric('gender-female-to-male', 'stats.graph.metric.gender.female.to.male', 73, '7.3', 'female', 'purple', 73),
          metric('gender-male-to-female', 'stats.graph.metric.gender.male.to.female', 69, '6.9', 'male', 'gold', 69)
        ],
        bridgeUsers: [
          { key: 'lina-stone', labelKey: '', label: 'Lina Stone', value: 96, total: 320, icon: 'conversion_path', tone: 'red' },
          { key: 'luca-hale', labelKey: '', label: 'Luca Hale', value: 84, total: 320, icon: 'conversion_path', tone: 'purple' },
          { key: 'ava-baker', labelKey: '', label: 'Ava Baker', value: 71, total: 320, icon: 'conversion_path', tone: 'green' },
          { key: 'mason-grant', labelKey: '', label: 'Mason Grant', value: 62, total: 320, icon: 'conversion_path', tone: 'gold' }
        ],
        communities: [
          { key: 'community-1', labelKey: '', label: 'Austin event circle', value: 14, total: 42, icon: 'bubble_chart', tone: 'green' },
          { key: 'community-2', labelKey: '', label: 'Seattle creators', value: 9, total: 42, icon: 'bubble_chart', tone: 'blue' },
          { key: 'community-3', labelKey: '', label: 'Denver assets', value: 7, total: 42, icon: 'bubble_chart', tone: 'gold' },
          { key: 'community-4', labelKey: '', label: 'Miami mixed', value: 5, total: 42, icon: 'bubble_chart', tone: 'purple' }
        ],
        signals: [
          item('reachability-2-hop', 'stats.graph.signal.reachability', 68, 100, 'travel_explore', 'blue'),
          item('weak-tie-ratio', 'stats.graph.signal.weak.ties', 34, 100, 'lan', 'purple'),
          item('clustering', 'stats.graph.signal.clustering', 42, 100, 'bubble_chart', 'green'),
          item('recurring-edge-ratio', 'stats.graph.signal.recurring', 31, 100, 'repeat', 'gold'),
          item('bridge-coverage', 'stats.graph.signal.bridge.coverage', 19, 100, 'conversion_path', 'red'),
          item('largest-community', 'stats.graph.signal.largest.community', 33, 100, 'groups', 'slate'),
          item('network-quality', 'stats.graph.signal.network.quality', 64, 100, 'ssid_chart', 'blue'),
          item('cluster-quality', 'stats.graph.signal.cluster.quality', 79, 100, 'bubble_chart', 'green')
        ],
        timeline: [
          ['2026-04-28', 'Apr 28', 56, 8, 5, 19, 5, 7, 51, 69],
          ['2026-04-29', 'Apr 29', 62, 7, 8, 21, 5, 7, 53, 70],
          ['2026-04-30', 'Apr 30', 68, 9, 7, 23, 6, 7, 55, 71],
          ['2026-05-01', 'May 1', 74, 10, 9, 25, 6, 7, 57, 72],
          ['2026-05-02', 'May 2', 80, 11, 11, 28, 7, 7, 58, 73],
          ['2026-05-03', 'May 3', 83, 6, 10, 29, 7, 7, 59, 74],
          ['2026-05-04', 'May 4', 88, 12, 13, 31, 7, 6, 60, 75],
          ['2026-05-05', 'May 5', 94, 14, 12, 32, 8, 6, 61, 76],
          ['2026-05-06', 'May 6', 97, 7, 14, 32, 8, 6, 62, 76],
          ['2026-05-07', 'May 7', 103, 13, 16, 35, 8, 6, 63, 77],
          ['2026-05-08', 'May 8', 108, 8, 15, 36, 8, 6, 63, 78],
          ['2026-05-09', 'May 9', 113, 12, 18, 38, 8, 6, 64, 78],
          ['2026-05-10', 'May 10', 116, 9, 17, 39, 8, 6, 64, 79],
          ['2026-05-11', 'May 11', 116, 5, 14, 40, 8, 6, 64, 79]
        ].map(([dateKey, label, activeEdges, newEdges, recurringEdges, weakTies, bridgeUsers, communities, networkQuality, clusterQuality]) => ({
          dateKey: `${dateKey}`,
          label: `${label}`,
          activeEdges: Number(activeEdges),
          newEdges: Number(newEdges),
          recurringEdges: Number(recurringEdges),
          weakTies: Number(weakTies),
          bridgeUsers: Number(bridgeUsers),
          communities: Number(communities),
          networkQuality: Number(networkQuality),
          clusterQuality: Number(clusterQuality)
        }))
      },
      revenue: {
        metrics: [
          metric('payable-events', 'stats.revenue.metric.payable.events', 12, '12', 'confirmation_number', 'green', 30),
          metric('projected-event-revenue', 'stats.revenue.metric.projected.events', 202500, '$2,025.00', 'event_available', 'green', 48),
          metric('avg-event-ticket', 'stats.revenue.metric.avg.event.ticket', 1688, '$16.88', 'sell', 'gold', 17),
          metric('payable-assets', 'stats.revenue.metric.payable.assets', 16, '16', 'inventory_2', 'purple', 40),
          metric('projected-asset-revenue', 'stats.revenue.metric.projected.assets', 213000, '$2,130.00', 'category', 'blue', 52),
          metric('avg-asset-price', 'stats.revenue.metric.avg.asset.price', 13313, '$133.13', 'payments', 'slate', 100),
          metric('actual-paid', 'stats.revenue.metric.actual.paid', 52200, '$522.00', 'paid', 'blue', 13),
          metric('paying-users', 'stats.revenue.metric.paying.users', 22, '22', 'group', 'red', 88),
          metric('avg-payment', 'stats.revenue.metric.avg.payment', 2373, '$23.73', 'receipt_long', 'purple', 24)
        ],
        assetCategories: [
          { key: 'accommodation', labelKey: 'accommodation', label: '', value: 84000, total: 213000, icon: 'hotel', tone: 'gold' },
          { key: 'car', labelKey: 'car', label: '', value: 77000, total: 213000, icon: 'directions_car', tone: 'blue' },
          { key: 'supplies', labelKey: 'supplies', label: '', value: 52000, total: 213000, icon: 'category', tone: 'green' }
        ],
        timeline: revenueTimeline
      }
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
    const nowIso = new Date().toISOString();
    const node = (
      id: string,
      labelKey: string,
      icon: string,
      kind: AdminMonitoringNodeKind,
      tone: AdminMonitoringTone,
      metrics: AdminMonitoringMetricDto[]
    ): AdminMonitoringNodeDto => ({ id, labelKey, icon, kind, tone, metrics });
    const edge = (
      from: string,
      to: string,
      labelKey: string,
      tone: AdminMonitoringTone,
      volume: number
    ): AdminMonitoringEdgeDto => ({ from, to, labelKey, tone, volume });
    const category = (
      key: string,
      labelKey: string,
      summaryKey: string,
      icon: string,
      tone: AdminMonitoringTone,
      health: AdminMonitoringHealth,
      total: number,
      nodes: AdminMonitoringNodeDto[],
      edges: AdminMonitoringEdgeDto[]
    ): AdminMonitoringCategoryDto => ({ key, labelKey, summaryKey, icon, tone, health, total, nodes, edges });

    return this.normalizeMonitoringState({
      generatedAtIso: nowIso,
      source: 'demo',
      health: 'watch',
      categories: [
        category('users', 'admin.monitoring.category.users', 'admin.monitoring.category.users.summary', 'person', 'blue', 'watch', 84, [
          node('users.ui', 'admin.monitoring.node.profile.ui', 'person', 'source', 'blue', [
            this.monitoringMetric('profile-writes', 'admin.monitoring.metric.profile.writes', 84, 'blue', 'ok')
          ]),
          node('users.model', 'admin.monitoring.node.profile.model', 'badge', 'writeModel', 'green', [
            this.monitoringMetric('registered', 'admin.monitoring.metric.registered', 29, 'green', 'ok'),
            this.monitoringMetric('deleted', 'admin.monitoring.metric.deleted', 7, 'slate', 'watch')
          ]),
          node('users.status', 'admin.monitoring.node.status.propagation', 'rule', 'worker', 'gold', [
            this.monitoringMetric('status-propagation-signals', 'admin.monitoring.metric.status.propagation.signals', 12, 'gold', 'watch')
          ]),
          node('users.purge', 'admin.monitoring.node.account.purge', 'delete_sweep', 'storage', 'slate', [
            this.monitoringMetric('purge-signals', 'admin.monitoring.metric.purge.signals', 2, 'slate', 'ok')
          ])
        ], [
          edge('users.ui', 'users.model', 'admin.monitoring.edge.write.path', 'blue', 84),
          edge('users.model', 'users.status', 'admin.monitoring.edge.status.propagation', 'gold', 12),
          edge('users.status', 'users.purge', 'admin.monitoring.edge.gdpr.window', 'slate', 2)
        ]),
        category('events', 'admin.monitoring.category.events', 'admin.monitoring.category.events.summary', 'event_available', 'green', 'watch', 91, [
          node('events.ui', 'admin.monitoring.node.event.ui', 'edit_calendar', 'source', 'blue', [
            this.monitoringMetric('event-writes', 'admin.monitoring.metric.event.writes', 73, 'blue', 'ok')
          ]),
          node('events.model', 'admin.monitoring.node.event.model', 'storage', 'writeModel', 'green', [
            this.monitoringMetric('event-model', 'admin.monitoring.metric.persisted.events', 28, 'green', 'ok')
          ]),
          node('events.recompute', 'admin.monitoring.node.recompute.queue', 'sync_alt', 'queue', 'gold', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'gold', 'watch')
          ]),
          node('events.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('outbox-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('events.ui', 'events.model', 'admin.monitoring.edge.write.path', 'blue', 73),
          edge('events.model', 'events.recompute', 'admin.monitoring.edge.recompute', 'gold', 18),
          edge('events.recompute', 'events.outbox', 'admin.monitoring.edge.visible.changes', 'purple', 36)
        ]),
        category('members', 'admin.monitoring.category.members', 'admin.monitoring.category.members.summary', 'groups', 'blue', 'watch', 54, [
          node('members.ui', 'admin.monitoring.node.member.ui', 'group_add', 'source', 'blue', [
            this.monitoringMetric('member-changes', 'admin.monitoring.metric.member.changes', 37, 'blue', 'ok')
          ]),
          node('members.model', 'admin.monitoring.node.member.model', 'fact_check', 'writeModel', 'green', [
            this.monitoringMetric('accepted-members', 'admin.monitoring.metric.accepted.members', 128, 'green', 'ok')
          ]),
          node('members.inviter', 'admin.monitoring.node.auto.inviter', 'person_add', 'worker', 'gold', [
            this.monitoringMetric('invites', 'admin.monitoring.metric.invites', 17, 'gold', 'ok')
          ]),
          node('members.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('pending-notifications', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('members.ui', 'members.model', 'admin.monitoring.edge.membership.write', 'blue', 37),
          edge('members.model', 'members.inviter', 'admin.monitoring.edge.capacity.gate', 'gold', 17),
          edge('members.inviter', 'members.outbox', 'admin.monitoring.edge.invite.delivery', 'purple', 36)
        ]),
        category('assets', 'admin.monitoring.category.assets', 'admin.monitoring.category.assets.summary', 'inventory_2', 'gold', 'watch', 39, [
          node('assets.ui', 'admin.monitoring.node.asset.ui', 'inventory_2', 'source', 'gold', [
            this.monitoringMetric('asset-writes', 'admin.monitoring.metric.asset.writes', 28, 'gold', 'ok')
          ]),
          node('assets.model', 'admin.monitoring.node.asset.model', 'storage', 'writeModel', 'green', [
            this.monitoringMetric('requests', 'admin.monitoring.metric.asset.requests', 14, 'green', 'ok')
          ]),
          node('assets.recompute', 'admin.monitoring.node.recompute.queue', 'sync_alt', 'queue', 'blue', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'blue', 'watch')
          ]),
          node('assets.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('borrower-updates', 'admin.monitoring.metric.borrower.updates', 12, 'purple', 'watch')
          ])
        ], [
          edge('assets.ui', 'assets.model', 'admin.monitoring.edge.write.path', 'gold', 28),
          edge('assets.model', 'assets.recompute', 'admin.monitoring.edge.recompute', 'blue', 18),
          edge('assets.recompute', 'assets.outbox', 'admin.monitoring.edge.availability.delivery', 'purple', 12)
        ]),
        category('matching', 'admin.monitoring.category.matching', 'admin.monitoring.category.matching.summary', 'hub', 'purple', 'watch', 342, [
          node('matching.rates', 'admin.monitoring.node.rates', 'star', 'source', 'purple', [
            this.monitoringMetric('rates-synced', 'admin.monitoring.metric.rates.synced', 342, 'purple', 'ok')
          ]),
          node('matching.queue', 'admin.monitoring.node.recompute.queue', 'pending_actions', 'queue', 'gold', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'gold', 'watch'),
            this.monitoringMetric('recompute-running', 'admin.monitoring.metric.recompute.running', 2, 'blue', 'ok')
          ]),
          node('matching.worker', 'admin.monitoring.node.affinity.worker', 'ssid_chart', 'worker', 'blue', [
            this.monitoringMetric('affinity-updates', 'admin.monitoring.metric.affinity.updates', 318, 'blue', 'ok')
          ]),
          node('matching.read', 'admin.monitoring.node.discovery.read.model', 'travel_explore', 'readModel', 'green', [
            this.monitoringMetric('visible-scores', 'admin.monitoring.metric.visible.scores', 318, 'green', 'ok')
          ])
        ], [
          edge('matching.rates', 'matching.queue', 'admin.monitoring.edge.recompute', 'gold', 342),
          edge('matching.queue', 'matching.worker', 'admin.monitoring.edge.worker.pickup', 'blue', 2),
          edge('matching.worker', 'matching.read', 'admin.monitoring.edge.read.model', 'green', 318)
        ]),
        category('chat', 'admin.monitoring.category.chat', 'admin.monitoring.category.chat.summary', 'forum', 'blue', 'watch', 426, [
          node('chat.ui', 'admin.monitoring.node.chat.ui', 'chat', 'source', 'blue', [
            this.monitoringMetric('messages', 'admin.monitoring.metric.messages', 417, 'blue', 'ok')
          ]),
          node('chat.stream', 'admin.monitoring.node.chat.stream', 'stream', 'writeModel', 'green', [
            this.monitoringMetric('stream-events', 'admin.monitoring.metric.stream.events', 417, 'green', 'ok')
          ]),
          node('chat.attachments', 'admin.monitoring.node.attachment.lifecycle', 'attachment', 'storage', 'gold', [
            this.monitoringMetric('attachment-checks', 'admin.monitoring.metric.attachment.checks', 23, 'gold', 'ok')
          ]),
          node('chat.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('push-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('chat.ui', 'chat.stream', 'admin.monitoring.edge.write.path', 'blue', 417),
          edge('chat.stream', 'chat.attachments', 'admin.monitoring.edge.attachment.lifecycle', 'gold', 23),
          edge('chat.stream', 'chat.outbox', 'admin.monitoring.edge.push.intent', 'purple', 36)
        ]),
        category('notifications', 'admin.monitoring.category.notifications', 'admin.monitoring.category.notifications.summary', 'notifications_active', 'red', 'alert', 87, [
          node('notifications.intent', 'admin.monitoring.node.notification.intent', 'edit_notifications', 'source', 'blue', [
            this.monitoringMetric('intents', 'admin.monitoring.metric.notification.intents', 87, 'blue', 'ok')
          ]),
          node('notifications.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('outbox-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch'),
            this.monitoringMetric('outbox-failed', 'admin.monitoring.metric.outbox.failed', 3, 'red', 'alert')
          ]),
          node('notifications.firebase', 'admin.monitoring.node.firebase', 'cloud_upload', 'external', 'gold', [
            this.monitoringMetric('sent', 'admin.monitoring.metric.outbox.sent', 48, 'green', 'ok')
          ]),
          node('notifications.tokens', 'admin.monitoring.node.device.tokens', 'phonelink_ring', 'storage', 'green', [
            this.monitoringMetric('token-cleanup', 'admin.monitoring.metric.token.cleanup', 9, 'green', 'ok')
          ])
        ], [
          edge('notifications.intent', 'notifications.outbox', 'admin.monitoring.edge.outbox.persist', 'purple', 87),
          edge('notifications.outbox', 'notifications.firebase', 'admin.monitoring.edge.firebase.batch', 'gold', 48),
          edge('notifications.firebase', 'notifications.tokens', 'admin.monitoring.edge.token.cleanup', 'green', 9)
        ]),
        category('jobs', 'admin.monitoring.category.jobs', 'admin.monitoring.category.jobs.summary', 'pending_actions', 'slate', 'ok', 16, [
          node('jobs.admin', 'admin.monitoring.node.admin.ui', 'admin_panel_settings', 'source', 'slate', [
            this.monitoringMetric('admin-changes', 'admin.monitoring.metric.admin.changes', 16, 'slate', 'ok')
          ]),
          node('jobs.config', 'admin.monitoring.node.job.config', 'tune', 'writeModel', 'blue', [
            this.monitoringMetric('config-changes', 'admin.monitoring.metric.config.changes', 7, 'blue', 'ok')
          ]),
          node('jobs.scheduler', 'admin.monitoring.node.scheduler', 'schedule', 'worker', 'gold', [
            this.monitoringMetric('scheduled-triggers', 'admin.monitoring.metric.scheduled.triggers', 9, 'gold', 'ok')
          ]),
          node('jobs.audit', 'admin.monitoring.node.audit.trail', 'history', 'storage', 'green', [
            this.monitoringMetric('audit-events', 'admin.monitoring.metric.audit.events', 16, 'green', 'ok')
          ])
        ], [
          edge('jobs.admin', 'jobs.config', 'admin.monitoring.edge.config.write', 'blue', 16),
          edge('jobs.config', 'jobs.scheduler', 'admin.monitoring.edge.worker.pickup', 'gold', 9),
          edge('jobs.scheduler', 'jobs.audit', 'admin.monitoring.edge.audit', 'green', 16)
        ])
      ]
    }, 'demo');
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

  private monitoringMetric(
    key: string,
    labelKey: string,
    value: number,
    tone: AdminMonitoringTone,
    status: AdminMonitoringHealth
  ): AdminMonitoringMetricDto {
    const normalizedValue = Math.max(0, Math.trunc(Number(value) || 0));
    return {
      key,
      labelKey,
      value: normalizedValue,
      valueLabel: this.compactNumber(normalizedValue),
      tone,
      status,
      detailRows: [{
        key: 'value',
        labelKey,
        valueLabel: this.compactNumber(normalizedValue),
        tone
      }]
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

  private async loadDemoParamsStore(): Promise<AdminParamsDemoStore> {
    await this.withNotificationStorageFallback(this.memoryDb.whenReady(), undefined);
    const existing = await this.withNotificationStorageFallback(
      this.memoryDb.readIndexedDbTableEntry<AdminParamsDemoStore>(ADMIN_PARAMS_STORE_KEY),
      null
    );
    if (existing?.sections?.length) {
      return this.normalizeParamsStore(existing);
    }
    const seeded = this.buildDefaultParamsStore();
    await this.withNotificationStorageFallback(
      this.memoryDb.writeIndexedDbTableEntry(ADMIN_PARAMS_STORE_KEY, seeded),
      undefined
    );
    return seeded;
  }

  private buildDefaultParamsStore(): AdminParamsDemoStore {
    const changedDate = '2026-05-01T09:00:00.000Z';
    const sections: AdminParamsSectionDto[] = [
      this.paramSection('matching', 'Matching', 3, '2026-05-07T12:30:00.000Z', 'admin-demo-ava', 'Raised inside-network confidence after graph review.', [
        this.numberParam('rating.singleMutual', 'Single mutual', 'Ratings', 10, 'x'),
        this.numberParam('rating.singleOneSided', 'Single one-sided', 'Ratings', 2, 'x'),
        this.numberParam('rating.pairOutsideNetwork', 'Pair outside network', 'Ratings', 2, 'x'),
        this.numberParam('rating.pairInsideNetwork', 'Pair inside network', 'Ratings', 5, 'x'),
        this.numberParam('evidence.mutualSingle', 'Mutual single', 'Evidence', 1, 'x'),
        this.numberParam('evidence.singleOneSided', 'Single one-sided', 'Evidence', 0, 'x'),
        this.numberParam('evidence.pairOutsideNetwork', 'Pair outside network', 'Evidence', 0.3, 'x'),
        this.numberParam('evidence.pairInsideNetwork', 'Pair inside network', 'Evidence', 0.7, 'x'),
        this.numberParam('evidence.met', 'Met in person', 'Evidence', 0.5, 'x'),
        this.numberParam('ownerContext', 'Owner context', 'Network', 3, 'x')
      ]),
      this.paramSection('profile', 'Profile', 2, '2026-05-04T10:10:00.000Z', 'admin-demo-noel', 'Balanced profile, workplace, school, and trait inputs.', [
        this.numberParam('profileRules.0', 'Languages', 'Profile fields', 2, 'x', 'intersection'),
        this.numberParam('profileRules.1', 'Physique', 'Profile fields', 3, 'x', 'exact'),
        this.numberParam('profileRules.2', 'Interest', 'Profile fields', 2, 'x', 'intersection'),
        this.numberParam('profileRules.3', 'Values', 'Profile fields', 3, 'x', 'intersection'),
        this.numberParam('profileRules.4', 'Workout', 'Profile fields', 2, 'x', 'exact'),
        this.numberParam('profileRules.5', 'Workplace', 'Experience', 4, 'x', 'intersection'),
        this.numberParam('profileRules.6', 'Profession', 'Experience', 3, 'x', 'intersection'),
        this.numberParam('profileRules.7', 'School', 'Experience', 4, 'x', 'intersection'),
        this.numberParam('impressionRules.0', 'Personality traits', 'Traits', 4, 'x', 'trait-vector'),
        this.numberParam('absolute.user.completion', 'Completion', 'Absolute user', 13, 'pts'),
        this.numberParam('absolute.user.impressionAverageRating', 'Average rating', 'Impressions', 29, 'pts')
      ]),
      this.paramSection('events', 'Events', 4, '2026-05-08T15:45:00.000Z', 'admin-demo-ava', 'Adjusted host confidence and open-capacity boost.', [
        this.numberParam('absolute.event.contentTokens', 'Content tokens', 'Affinity', 89, 'pts'),
        this.numberParam('absolute.event.participantAffinity', 'Participant affinity', 'Affinity', 1, 'x'),
        this.numberParam('boost.event.rating', 'Rating', 'Boost', 29, 'pts'),
        this.numberParam('boost.event.acceptedMembers', 'Accepted members', 'Boost', 19, 'pts'),
        this.numberParam('boost.event.pendingMembers', 'Pending members', 'Boost', 11, 'pts'),
        this.numberParam('boost.event.capacityAvailable', 'Capacity available', 'Boost', 7, 'pts'),
        this.numberParam('boost.event.hostConfidence', 'Host confidence', 'Boost', 0.25, 'x')
      ]),
      this.paramSection('assets', 'Assets', 2, '2026-05-06T08:15:00.000Z', 'admin-demo-noel', 'Added owner confidence and request pressure to asset ranking.', [
        this.numberParam('absolute.asset.contentTokens', 'Content tokens', 'Affinity', 83, 'pts'),
        this.numberParam('absolute.asset.ownerAffinity', 'Owner affinity', 'Affinity', 1, 'x'),
        this.numberParam('boost.asset.capacityAvailable', 'Capacity available', 'Boost', 7, 'pts'),
        this.numberParam('boost.asset.quantity', 'Quantity', 'Boost', 11, 'pts'),
        this.numberParam('boost.asset.requestCount', 'Request count', 'Boost', 13, 'pts'),
        this.numberParam('boost.asset.freshness', 'Freshness', 'Boost', 3, 'pts'),
        this.numberParam('boost.asset.ownerConfidence', 'Owner confidence', 'Boost', 0.25, 'x')
      ]),
      this.paramSection('discovery', 'Discovery', 1, changedDate, 'system', 'Initial outside-network and distance balance.', [
        this.numberParam('distance.multiplier', 'Distance multiplier', 'Distance', 5, 'pts'),
        this.numberParam('distance.maxMeters', 'Max distance', 'Distance', 50000, 'm'),
        this.textParam('distance.strategy', 'Distance strategy', 'Distance', 'linear', 'linear')
      ]),
      this.paramSection('notifications', 'Notifications', 1, changedDate, 'system', 'Initial Firebase batching and retry defaults.', [
        this.numberParam('notifications.firebaseWindowStartHour', 'Window start', 'Firebase', 8, 'h'),
        this.numberParam('notifications.firebaseWindowEndHour', 'Window end', 'Firebase', 22, 'h'),
        this.numberParam('notifications.maxWorkers', 'Max workers', 'Delivery', 4, ''),
        this.numberParam('notifications.maxRetries', 'Max retries', 'Retry', 5, ''),
        this.numberParam('notifications.initialBackoffSeconds', 'Initial backoff', 'Retry', 30, 's'),
        this.numberParam('notifications.collapseWindowSeconds', 'Collapse window', 'Collapse', 300, 's'),
        this.numberParam('notifications.multicastThreshold', 'Multicast threshold', 'Delivery', 3, ''),
        this.numberParam('notifications.topicThreshold', 'Topic threshold', 'Delivery', 250, '')
      ]),
      this.paramSection('jobs', 'Jobs', 1, changedDate, 'system', 'Initial recompute worker scheduling defaults.', [
        this.numberParam('jobs.userChangedDebounceSeconds', 'User debounce', 'Debounce', 300, 's'),
        this.numberParam('jobs.eventChangedDebounceSeconds', 'Event debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.eventMembersChangedDebounceSeconds', 'Members debounce', 'Debounce', 300, 's'),
        this.numberParam('jobs.assetChangedDebounceSeconds', 'Asset debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.assetRequestsChangedDebounceSeconds', 'Requests debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.configChangedDebounceSeconds', 'Config debounce', 'Debounce', 900, 's'),
        this.numberParam('jobs.workerPollDelayMs', 'Worker poll delay', 'Worker', 60000, 'ms'),
        this.numberParam('jobs.batchSize', 'Batch size', 'Worker', 50, ''),
        this.numberParam('jobs.leaseDurationSeconds', 'Lease duration', 'Worker', 600, 's'),
        this.numberParam('jobs.process.eventSchedulerPollDelayMs', 'Event scheduler poll', 'Processes', 1800000, 'ms'),
        this.numberParam('jobs.process.autoInviterCadenceMs', 'Auto-inviter cadence', 'Processes', 7200000, 'ms'),
        this.numberParam('jobs.process.notificationOutboxPollDelayMs', 'Notification outbox poll', 'Processes', 60000, 'ms'),
        this.numberParam('jobs.process.accountPurgeWindowDays', 'Account purge window', 'Processes', 30, 'd'),
        this.textParam('jobs.policy.autoInviterScope', 'Auto-inviter scope', 'Policy', 'Main event before tournament start', '', true),
        this.textParam('jobs.policy.tournamentStart', 'Tournament start', 'Policy', 'Manual admin start from first stage', '', true),
        this.textParam('jobs.policy.stageProgression', 'Stage progression', 'Policy', 'Admin finalizes scores before next stage', '', true)
      ])
    ];
    const historyBySection = sections.reduce<Record<string, AdminParamsHistoryItemDto[]>>((acc, section) => {
      acc[section.key] = [
        {
          configId: `demo-params-${section.key}-v${section.version}`,
          version: section.version,
          changedDate: section.changedDate,
          changedBy: section.changedBy,
          summary: section.summary,
          summaryKey: section.summaryKey,
          active: true,
          fields: section.fields.map(field => ({ ...field }))
        },
        {
          configId: `demo-params-${section.key}-v1`,
          version: 1,
          changedDate,
          changedBy: 'system',
          summary: 'Initial parameter seed.',
          summaryKey: this.paramSummaryKey('Initial parameter seed.', section.key),
          active: section.version === 1,
          fields: section.fields.map(field => ({ ...field }))
        }
      ].filter((item, index, values) => values.findIndex(candidate => candidate.version === item.version) === index);
      return acc;
    }, {});
    return this.normalizeParamsStore({
      sections,
      updatedDate: '2026-05-08T15:45:00.000Z',
      historyBySection
    });
  }

  private paramSection(
    key: string,
    label: string,
    version: number,
    changedDate: string,
    changedBy: string,
    summary: string,
    fields: AdminParamFieldDto[]
  ): AdminParamsSectionDto {
    return {
      key,
      label,
      labelKey: this.paramSectionLabelKey(key),
      version,
      changedDate,
      changedBy,
      summary,
      summaryKey: this.paramSummaryKey(summary, key),
      fields: fields.map(field => this.normalizeParamField(field))
    };
  }

  private numberParam(
    key: string,
    label: string,
    group: string,
    numberValue: number,
    unit: string,
    strategy = '',
    readOnly = false
  ): AdminParamFieldDto {
    return {
      key,
      label,
      labelKey: this.paramFieldLabelKey(key),
      group,
      groupKey: this.paramGroupLabelKey(group),
      valueType: 'number',
      numberValue,
      textValue: null,
      unit,
      options: [],
      strategy,
      strategyKey: this.paramStrategyLabelKey(strategy),
      readOnly
    };
  }

  private textParam(
    key: string,
    label: string,
    group: string,
    textValue: string,
    strategy = '',
    readOnly = false
  ): AdminParamFieldDto {
    return {
      key,
      label,
      labelKey: this.paramFieldLabelKey(key),
      group,
      groupKey: this.paramGroupLabelKey(group),
      valueType: 'text',
      numberValue: null,
      textValue,
      unit: null,
      options: this.paramOptionsFor(key),
      strategy,
      strategyKey: this.paramStrategyLabelKey(strategy),
      readOnly
    };
  }

  private notificationRuleParameters(ruleKey: string): AdminNotificationRuleParameter[] {
    switch (`${ruleKey ?? ''}`.trim()) {
      case 'event-random-groups':
        return [
          this.jobNumberParam('jobs.process.randomGroups.minRoomSize', 'Min room size', 'Matched rooms', 2, ''),
          this.jobNumberParam('jobs.process.randomGroups.maxRoomSize', 'Max room size', 'Matched rooms', 4, '')
        ];
      case 'event-auto-inviter':
        return [
          this.jobNumberParam('jobs.process.autoInviter.batchSize', 'Invite batch size', 'Auto inviter', 4, ''),
          this.jobNumberParam('jobs.process.autoInviter.responseWindowHours', 'Response window', 'Auto inviter', 2, 'h'),
          this.jobNumberParam('jobs.process.autoInviter.candidateLookahead', 'Candidate lookahead', 'Auto inviter', 24, 'h')
        ];
      case 'event-tournament-review':
        return [
          this.jobNumberParam('jobs.process.tournament.adminReminderHours', 'Admin reminder', 'Tournament', 2, 'h'),
          this.jobNumberParam('jobs.process.tournament.scoreReviewHours', 'Score review window', 'Tournament', 2, 'h')
        ];
      default:
        return [];
    }
  }

  private jobNumberParam(
    key: string,
    label: string,
    group: string,
    numberValue: number,
    unit: string,
    strategy = '',
    readOnly = false
  ): AdminNotificationRuleParameter {
    return {
      key,
      label,
      labelKey: this.paramFieldLabelKey(key),
      group,
      groupKey: this.paramGroupLabelKey(group),
      valueType: 'number',
      numberValue,
      textValue: null,
      unit,
      options: [],
      strategy,
      strategyKey: this.paramStrategyLabelKey(strategy),
      readOnly
    };
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
    return this.normalizeNotificationCenter({
      rules: [
        this.defaultNotificationRule({
          ruleKey: 'event-random-groups',
          label: 'admin.jobs.rule.event.random.groups',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.event.random.groups.description',
          actionKey: 'event.scheduler.random-groups',
          triggerKind: 'scheduled_process',
          enabled: false,
          manualRunEnabled: true,
          adminManageable: true,
          priority: 200,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 1440,
          startTime: '09:00',
          parameters: this.notificationRuleParameters('event-random-groups')
        }),
        this.defaultNotificationRule({
          ruleKey: 'event-auto-inviter',
          label: 'admin.jobs.rule.event.auto.inviter',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.event.auto.inviter.description',
          actionKey: 'event.scheduler.auto-inviter',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 210,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 120,
          startTime: '00:00',
          parameters: this.notificationRuleParameters('event-auto-inviter')
        }),
        this.defaultNotificationRule({
          ruleKey: 'event-tournament-review',
          label: 'admin.jobs.rule.event.tournament.review',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.event.tournament.review.description',
          actionKey: 'event.scheduler.tournament-review',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 220,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 30,
          startTime: '00:00',
          parameters: this.notificationRuleParameters('event-tournament-review')
        }),
        this.defaultNotificationRule({
          ruleKey: 'notification-outbox',
          label: 'admin.jobs.rule.notification.outbox',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.notification.outbox.description',
          actionKey: 'notifications.outbox.worker',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 230,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 1,
          startTime: '00:00'
        }),
        this.defaultNotificationRule({
          ruleKey: 'affinity-recompute',
          label: 'admin.jobs.rule.affinity.recompute',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.affinity.recompute.description',
          actionKey: 'affinity.recompute.worker',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 240,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 1,
          startTime: '00:00'
        }),
        this.defaultNotificationRule({
          ruleKey: 'scheduled-messages',
          label: 'admin.jobs.rule.scheduled.messages',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.scheduled.messages.description',
          actionKey: 'scheduled.messages.worker',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 250,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 30,
          startTime: '00:00'
        }),
        this.defaultNotificationRule({
          ruleKey: 'account-purge',
          label: 'admin.jobs.rule.account.purge',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.account.purge.description',
          actionKey: 'users.deleted-account-purge',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 260,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 1440,
          startTime: '02:00'
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
    startTime?: string;
    month?: number;
    dayOfMonth?: number;
    emailSubject?: string;
    emailBody?: string;
    parameters?: AdminNotificationRuleParameter[];
    scheduleSlots?: AdminNotificationScheduleSlot[];
  }): AdminNotificationRule {
    const interval = this.normalizeNotificationInterval(null, null, null, options.intervalMinutes ?? 60);
    const startTime = this.normalizeNotificationTime(options.startTime);
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
        intervalMinutes: interval.minutes,
        intervalSeconds: interval.seconds,
        intervalAmount: interval.amount,
        intervalUnit: interval.unit,
        month: options.month ?? 1,
        dayOfMonth: options.dayOfMonth ?? 1,
        time: startTime,
        timezone: 'UTC',
        cronExpression: this.intervalExpression(interval.amount, interval.unit, startTime)
      },
      scheduleSlots: options.scheduleSlots ?? this.defaultScheduleSlots(options.timingMode),
      parameters: (options.parameters ?? []).map(field => this.normalizeNotificationRuleParameter(field)),
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
