import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRunHistoryEntry,
  AdminNotificationScheduleSlot
} from '../../../shared/core';
import { I18nPipe } from '../../../shared/i18n';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AdminService } from '../../admin.service';

const PROCESS_LIST_FILTER = {
  all: 'all',
  active: 'active',
  suspended: 'suspended',
  running: 'running',
  failed: 'failed'
} as const;
type ProcessListFilter = typeof PROCESS_LIST_FILTER[keyof typeof PROCESS_LIST_FILTER];

const PROCESS_STATUS_KIND = {
  running: 'running',
  failed: 'failed',
  missed: 'missed',
  suspended: 'suspended',
  ready: 'ready'
} as const;
type ProcessStatusKind = typeof PROCESS_STATUS_KIND[keyof typeof PROCESS_STATUS_KIND];

const PROCESS_TOGGLE_KIND = {
  enabled: 'enabled',
  suspended: 'suspended'
} as const;
type ProcessToggleKind = typeof PROCESS_TOGGLE_KIND[keyof typeof PROCESS_TOGGLE_KIND];

const PROCESS_RUNTIME_STATUS = {
  idle: 'idle',
  running: 'running',
  suspended: 'suspended',
  completed: 'completed',
  failed: 'failed',
  error: 'error',
  missed: 'missed',
  skipped: 'skipped'
} as const;

const PROCESS_TRIGGER_KIND = {
  scheduledProcess: 'scheduled_process'
} as const;

const ADMIN_POPUP_KEY = 'notifications';

const TIMING_MODE = {
  interval: 'interval'
} as const;

const PROCESS_RUN_TRIGGER = {
  manual: 'manual'
} as const;

const PROCESS_ROW_ACTION = {
  suspend: 'suspend',
  run: 'run'
} as const;
type ProcessRowAction = typeof PROCESS_ROW_ACTION[keyof typeof PROCESS_ROW_ACTION];

const SCHEDULE_FREQUENCY = {
  daily: 'daily',
  weekly: 'weekly',
  biWeekly: 'bi-weekly',
  monthly: 'monthly',
  yearly: 'yearly',
  oneTime: 'one-time'
} as const;

const JOB_I18N = {
  filter: {
    all: 'admin.jobs.filter.all',
    active: 'admin.jobs.filter.active',
    suspended: 'admin.jobs.filter.suspended',
    running: 'admin.jobs.filter.running',
    failed: 'admin.jobs.filter.failed'
  },
  status: {
    running: 'admin.jobs.status.running',
    failed: 'admin.jobs.status.failed',
    missed: 'admin.jobs.status.missed',
    suspended: 'admin.jobs.status.suspended',
    ready: 'admin.jobs.status.ready'
  },
  progress: {
    ready: 'admin.jobs.progress.ready',
    suspendedByAdmin: 'admin.jobs.progress.suspended.by.admin',
    manualRunStarted: 'admin.jobs.progress.manual.run.started'
  },
  error: {
    load: 'admin.jobs.error.load',
    save: 'admin.jobs.error.save',
    run: 'admin.jobs.error.run'
  },
  process: {
    titleDefault: 'admin.jobs.process',
    descriptionDefault: 'admin.jobs.process.description.default'
  },
  action: {
    run: 'admin.jobs.run',
    none: 'admin.jobs.action.none',
    noneDescription: 'admin.jobs.action.none.description'
  },
  lastRun: {
    notRunYet: 'admin.jobs.not.run.yet',
    affected: 'admin.jobs.affected'
  },
  runWindow: {
    none: 'admin.jobs.run.window.none',
    oneTimeDate: 'admin.jobs.run.window.one.time.date',
    at: 'admin.jobs.run.window.at',
    onDay: 'admin.jobs.run.window.on.day'
  },
  never: 'admin.jobs.never'
} as const;

const PROCESS_FILTER_OPTIONS: Array<{ key: ProcessListFilter; labelKey: string; icon: string }> = [
  { key: PROCESS_LIST_FILTER.all, labelKey: JOB_I18N.filter.all, icon: 'list' },
  { key: PROCESS_LIST_FILTER.active, labelKey: JOB_I18N.filter.active, icon: 'play_circle' },
  { key: PROCESS_LIST_FILTER.suspended, labelKey: JOB_I18N.filter.suspended, icon: 'pause_circle' },
  { key: PROCESS_LIST_FILTER.running, labelKey: JOB_I18N.filter.running, icon: 'sync' },
  { key: PROCESS_LIST_FILTER.failed, labelKey: JOB_I18N.filter.failed, icon: 'error_outline' }
];

const PROCESS_STATUS_LABEL_KEYS: Record<ProcessStatusKind, string> = {
  [PROCESS_STATUS_KIND.running]: JOB_I18N.status.running,
  [PROCESS_STATUS_KIND.failed]: JOB_I18N.status.failed,
  [PROCESS_STATUS_KIND.missed]: JOB_I18N.status.missed,
  [PROCESS_STATUS_KIND.suspended]: JOB_I18N.status.suspended,
  [PROCESS_STATUS_KIND.ready]: JOB_I18N.status.ready
};

const PROCESS_STATUS_KIND_BY_RUNTIME_STATUS: Record<string, ProcessStatusKind> = {
  [PROCESS_RUNTIME_STATUS.failed]: PROCESS_STATUS_KIND.failed,
  [PROCESS_RUNTIME_STATUS.error]: PROCESS_STATUS_KIND.failed,
  [PROCESS_RUNTIME_STATUS.missed]: PROCESS_STATUS_KIND.missed,
  [PROCESS_RUNTIME_STATUS.skipped]: PROCESS_STATUS_KIND.missed
};

const PROCESS_TOGGLE_STATES: Record<ProcessToggleKind, { currentStatus: string; progressDetailKey: string }> = {
  [PROCESS_TOGGLE_KIND.enabled]: {
    currentStatus: PROCESS_RUNTIME_STATUS.idle,
    progressDetailKey: JOB_I18N.progress.ready
  },
  [PROCESS_TOGGLE_KIND.suspended]: {
    currentStatus: PROCESS_RUNTIME_STATUS.suspended,
    progressDetailKey: JOB_I18N.progress.suspendedByAdmin
  }
};

const PROCESS_ICON = {
  running: 'sync',
  suspended: 'pause_circle',
  manual: 'play_circle',
  manageable: 'tune',
  default: 'settings_suggest',
  filterFallback: 'list'
} as const;

const PROCESS_FILTER_STATUSES: Record<ProcessListFilter, ReadonlySet<ProcessStatusKind>> = {
  [PROCESS_LIST_FILTER.all]: new Set(),
  [PROCESS_LIST_FILTER.active]: new Set([PROCESS_STATUS_KIND.failed, PROCESS_STATUS_KIND.missed]),
  [PROCESS_LIST_FILTER.suspended]: new Set([PROCESS_STATUS_KIND.suspended]),
  [PROCESS_LIST_FILTER.running]: new Set([PROCESS_STATUS_KIND.running]),
  [PROCESS_LIST_FILTER.failed]: new Set([PROCESS_STATUS_KIND.failed, PROCESS_STATUS_KIND.missed])
};

const PROCESS_NEXT_RUN_SORT_FILTERS = new Set<ProcessListFilter>([
  PROCESS_LIST_FILTER.active,
  PROCESS_LIST_FILTER.running
]);
const PROCESS_FAILED_SORT_FILTERS = new Set<ProcessListFilter>([
  PROCESS_LIST_FILTER.failed
]);
const PROCESS_PROBLEM_RUNTIME_STATUSES = new Set<string>([
  PROCESS_RUNTIME_STATUS.failed,
  PROCESS_RUNTIME_STATUS.error,
  PROCESS_RUNTIME_STATUS.missed,
  PROCESS_RUNTIME_STATUS.skipped
]);
const PROCESS_FINISHED_RUNTIME_STATUSES = new Set<string>([
  PROCESS_RUNTIME_STATUS.completed,
  PROCESS_RUNTIME_STATUS.failed,
  PROCESS_RUNTIME_STATUS.error,
  PROCESS_RUNTIME_STATUS.missed,
  PROCESS_RUNTIME_STATUS.skipped
]);

const WEEKLY_SCHEDULE_FREQUENCIES = new Set<string>([
  SCHEDULE_FREQUENCY.weekly,
  SCHEDULE_FREQUENCY.biWeekly
]);
const ROLLING_DATE_SCHEDULE_FREQUENCIES = new Set<string>([
  SCHEDULE_FREQUENCY.monthly,
  SCHEDULE_FREQUENCY.yearly
]);
const DATE_INPUT_SCHEDULE_FREQUENCIES = new Set<string>([
  SCHEDULE_FREQUENCY.oneTime,
  SCHEDULE_FREQUENCY.monthly,
  SCHEDULE_FREQUENCY.yearly
]);

const DEFAULT_RUN_WINDOW = {
  frequency: SCHEDULE_FREQUENCY.daily,
  dayOfWeek: 1,
  time: '09:00',
  timezone: 'UTC',
  actionKey: '',
  enabled: true
} as const;
const DEFAULT_PRIMARY_TIMING = {
  mode: TIMING_MODE.interval,
  intervalMinutes: 1440
} as const;

const STATUS_CLASS_PREFIX = 'is-';

@Component({
  selector: 'app-admin-notifications-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, I18nPipe],
  templateUrl: './admin-notifications-popup.component.html',
  styleUrl: './admin-notifications-popup.component.scss'
})
export class AdminNotificationsPopupComponent implements OnDestroy {
  protected readonly admin = inject(AdminService);
  protected readonly popupKey = ADMIN_POPUP_KEY;
  protected readonly jobI18n = JOB_I18N;
  protected readonly processRowAction = PROCESS_ROW_ACTION;
  protected readonly scheduleFrequency = SCHEDULE_FREQUENCY;
  protected readonly weeklyScheduleFrequencies = WEEKLY_SCHEDULE_FREQUENCIES;
  protected readonly dateInputScheduleFrequencies = DATE_INPUT_SCHEDULE_FREQUENCIES;
  protected readonly defaultRunWindow = DEFAULT_RUN_WINDOW;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionRingPerimeter = 100;
  protected readonly loadingRingPerimeter = 100;
  protected readonly loadingProgress = signal(0);
  protected readonly runningRuleKey = signal('');
  protected readonly rowActionKey = signal('');
  protected readonly error = signal('');
  protected readonly state = signal<AdminNotificationCenterState | null>(null);
  protected readonly selectedRuleKey = signal('');
  protected readonly detailOpen = signal(false);
  protected readonly scheduleEditorOpen = signal(false);
  protected readonly processFilter = signal<ProcessListFilter>(PROCESS_LIST_FILTER.all);
  protected readonly processFilterMenuOpen = signal(false);
  private loadedForOpen = false;
  private unsubscribeRuntimeUpdates: (() => void) | null = null;
  private loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressStartedAtMs = 0;

  protected readonly processFilterOptions = PROCESS_FILTER_OPTIONS;
  protected readonly processStatusLabelKeys = PROCESS_STATUS_LABEL_KEYS;

  protected readonly scheduleFrequencyOptions = APP_STATIC_DATA.scheduleFrequencyOptions;
  protected readonly weekDays = APP_STATIC_DATA.calendarWeekdayOptions;

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== ADMIN_POPUP_KEY) {
        this.loadedForOpen = false;
        this.error.set('');
        this.detailOpen.set(false);
        this.scheduleEditorOpen.set(false);
        this.processFilterMenuOpen.set(false);
        this.stopRuntimeUpdates();
        return;
      }
      if (!this.loadedForOpen) {
        this.loadedForOpen = true;
        void this.load();
      }
      this.startRuntimeUpdates();
    });
  }

  ngOnDestroy(): void {
    this.stopRuntimeUpdates();
    this.clearLoadingProgress();
  }

  protected async load(silent = false): Promise<void> {
    if (silent && this.scheduleEditorOpen()) {
      return;
    }
    if (this.loading() || this.saving()) {
      return;
    }
    if (!silent) {
      this.loading.set(true);
      this.beginLoadingProgress();
    }
    this.error.set('');
    try {
      const state = await this.admin.loadNotificationCenter({ skipDemoDelay: silent });
      if (silent) {
        this.mergeRuntimeState(state);
      } else {
        this.state.set(this.ensureProcessRules(state));
      }
      if (!this.processRules().some(rule => rule.ruleKey === this.selectedRuleKey())) {
        this.selectedRuleKey.set(this.processRules()[0]?.ruleKey ?? '');
      }
    } catch {
      if (!silent) {
        this.error.set(JOB_I18N.error.load);
      }
    } finally {
      if (!silent) {
        this.loading.set(false);
        this.endLoadingProgress();
      }
    }
  }

  protected async save(rulesToSave: readonly AdminNotificationRule[] = this.processRules()): Promise<boolean> {
    const state = this.state();
    if (!state || this.saving()) {
      return false;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const savedState = await this.admin.saveNotificationCenter(rulesToSave);
      this.state.set(this.ensureProcessRules(savedState));
      return true;
    } catch {
      this.error.set(JOB_I18N.error.save);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveAndCloseDetail(): Promise<void> {
    const rule = this.selectedRule();
    if (rule && !this.canManageProcess(rule)) {
      this.closeDetail();
      return;
    }
    const saved = await this.save();
    if (saved) {
      this.closeDetail();
    }
  }

  protected async toggleSuspended(rule: AdminNotificationRule): Promise<void> {
    if (!this.canManageProcess(rule) || this.rowActionKey()) {
      return;
    }
    this.rowActionKey.set(`${rule.ruleKey}:suspend`);
    try {
      const nextEnabled = !rule.enabled;
      const nextToggleState = PROCESS_TOGGLE_STATES[nextEnabled ? PROCESS_TOGGLE_KIND.enabled : PROCESS_TOGGLE_KIND.suspended];
      const rulesToSave = this.processRules().map(current => current.ruleKey === rule.ruleKey
        ? {
          ...current,
          enabled: nextEnabled,
          runState: {
            ...current.runState,
            currentStatus: nextToggleState.currentStatus,
            progressDetail: nextToggleState.progressDetailKey
          },
          updatedDate: new Date().toISOString(),
          updatedUser: this.admin.activeAdmin()?.id ?? current.updatedUser
        }
        : current);
      const saved = await this.save(rulesToSave);
      if (saved) {
        this.patchRule(rule.ruleKey, current => ({
          ...current,
          enabled: nextEnabled,
          runState: {
            ...current.runState,
            currentStatus: nextToggleState.currentStatus,
            progressPercent: 0,
            progressDetail: nextToggleState.progressDetailKey,
            finishedAtIso: nextEnabled ? current.runState.finishedAtIso : '',
            durationMillis: nextEnabled ? current.runState.durationMillis : 0
          }
        }));
      }
    } finally {
      this.rowActionKey.set('');
    }
  }

  protected async run(rule: AdminNotificationRule): Promise<void> {
    if (!rule.manualRunEnabled || this.runningRuleKey() || this.rowActionKey()) {
      return;
    }
    this.runningRuleKey.set(rule.ruleKey);
    this.rowActionKey.set(`${rule.ruleKey}:run`);
    this.error.set('');
    const requestStartedAtIso = new Date().toISOString();
    this.patchRule(rule.ruleKey, current => ({
      ...current,
      runState: {
        ...current.runState,
        currentStatus: PROCESS_RUNTIME_STATUS.running,
        progressPercent: 0,
        progressDetail: JOB_I18N.progress.manualRunStarted,
        startedAtIso: requestStartedAtIso,
        finishedAtIso: '',
        durationMillis: 0
      }
    }));
    try {
      const result = await this.admin.runNotificationRule(rule.ruleKey);
      const finishedAtIso = result.ranAtIso || new Date().toISOString();
      this.patchRule(rule.ruleKey, current => {
        const isRunningResponse = this.isRuntimeStatus(result.status, PROCESS_RUNTIME_STATUS.running);
        const startedAtIso = isRunningResponse
          ? (current.runState.startedAtIso || result.ranAtIso || requestStartedAtIso)
          : (current.runState.startedAtIso || finishedAtIso);
        const durationMillis = this.durationBetween(startedAtIso, finishedAtIso);
        if (isRunningResponse && this.hasNewerFinishedRun(current, requestStartedAtIso)) {
          return current;
        }
        const runningProgressPercent = Math.max(0, Math.min(99, current.runState.progressPercent || 0));
        const entry: AdminNotificationRunHistoryEntry | null = isRunningResponse ? null : {
          id: `run-${Date.now()}`,
          trigger: PROCESS_RUN_TRIGGER.manual,
          runnerUser: this.admin.activeAdmin()?.id ?? current.runState.lastRunUser,
          startedAtIso,
          finishedAtIso,
          durationMillis,
          processedCount: result.affectedCount,
          status: result.status,
          detail: result.detail
        };
        return {
          ...current,
          runState: {
            ...current.runState,
            currentStatus: result.status,
            progressPercent: isRunningResponse ? runningProgressPercent : 100,
            progressDetail: isRunningResponse ? (current.runState.progressDetail || result.detail) : result.detail,
            startedAtIso,
            finishedAtIso: isRunningResponse ? (current.runState.finishedAtIso || '') : finishedAtIso,
            durationMillis: isRunningResponse ? Math.max(0, current.runState.durationMillis || 0) : durationMillis,
            lastRunAtIso: isRunningResponse ? current.runState.lastRunAtIso : finishedAtIso,
            lastRunStatus: isRunningResponse ? current.runState.lastRunStatus : result.status,
            lastRunDetail: isRunningResponse ? current.runState.lastRunDetail : result.detail,
            lastRunCount: isRunningResponse ? current.runState.lastRunCount : result.affectedCount,
            lastRunUser: this.admin.activeAdmin()?.id ?? current.runState.lastRunUser
          },
          runHistory: entry ? [entry, ...(current.runHistory ?? [])].slice(0, 12) : current.runHistory,
          updatedDate: finishedAtIso,
          updatedUser: this.admin.activeAdmin()?.id ?? current.updatedUser
        };
      });
    } catch {
      this.error.set(JOB_I18N.error.run);
    } finally {
      this.runningRuleKey.set('');
      this.rowActionKey.set('');
    }
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected openDetail(rule: AdminNotificationRule): void {
    this.selectedRuleKey.set(rule.ruleKey);
    this.processFilterMenuOpen.set(false);
    this.detailOpen.set(true);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.scheduleEditorOpen.set(false);
  }

  protected selectRule(ruleKey: string): void {
    this.selectedRuleKey.set(ruleKey);
    this.scheduleEditorOpen.set(false);
  }

  protected selectedRule(): AdminNotificationRule | null {
    return this.processRules().find(rule => rule.ruleKey === this.selectedRuleKey())
      ?? this.processRules()[0]
      ?? null;
  }

  protected processRules(): AdminNotificationRule[] {
    const rules = this.state()?.rules ?? [];
    return this.sortProcessRules(rules.filter(rule => this.isScheduledProcess(rule)));
  }

  protected filteredProcessRules(): AdminNotificationRule[] {
    const filter = this.processFilter();
    return this.sortFilteredProcessRules(
      this.processRules().filter(rule => this.matchesProcessFilter(rule, filter)),
      filter
    );
  }

  protected processFilterLabel(filter: ProcessListFilter = this.processFilter()): string {
    return this.processFilterOptions.find(option => option.key === filter)?.labelKey ?? JOB_I18N.filter.all;
  }

  protected processFilterIcon(filter: ProcessListFilter = this.processFilter()): string {
    return this.processFilterOptions.find(option => option.key === filter)?.icon ?? PROCESS_ICON.filterFallback;
  }

  protected processFilterCount(filter: ProcessListFilter = this.processFilter()): number {
    return this.processRules().filter(rule => this.matchesProcessFilter(rule, filter)).length;
  }

  protected toggleProcessFilterMenu(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.processFilterMenuOpen.set(!this.processFilterMenuOpen());
  }

  protected selectProcessFilter(filter: ProcessListFilter, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.processFilter.set(filter);
    this.processFilterMenuOpen.set(false);
  }

  private matchesProcessFilter(rule: AdminNotificationRule, filter: ProcessListFilter): boolean {
    const status = this.statusKind(rule);
    if (filter === PROCESS_LIST_FILTER.all) {
      return true;
    }
    const statuses = PROCESS_FILTER_STATUSES[filter];
    if (filter === PROCESS_LIST_FILTER.active) {
      return rule.enabled && !statuses.has(status);
    }
    return statuses.has(status);
  }

  protected processIcon(rule: AdminNotificationRule): string {
    if (this.isProcessRunning(rule)) {
      return PROCESS_ICON.running;
    }
    if (!rule.enabled || this.isRuntimeStatus(rule.runState.currentStatus, PROCESS_RUNTIME_STATUS.suspended)) {
      return PROCESS_ICON.suspended;
    }
    if (rule.manualRunEnabled) {
      return PROCESS_ICON.manual;
    }
    if (this.canManageProcess(rule)) {
      return PROCESS_ICON.manageable;
    }
    return PROCESS_ICON.default;
  }

  protected processTitle(rule: AdminNotificationRule): string {
    return rule.label || rule.ruleKey || JOB_I18N.process.titleDefault;
  }

  protected processDescription(rule: AdminNotificationRule): string {
    return rule.description || JOB_I18N.process.descriptionDefault;
  }

  protected canManageProcess(rule: AdminNotificationRule): boolean {
    return rule.adminManageable === true;
  }

  protected statusKind(rule: AdminNotificationRule): ProcessStatusKind {
    const lastStatus = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    if (this.isProcessRunning(rule)) {
      return PROCESS_STATUS_KIND.running;
    }
    const mappedStatus = PROCESS_STATUS_KIND_BY_RUNTIME_STATUS[lastStatus];
    if (mappedStatus) {
      return mappedStatus;
    }
    if (!rule.enabled || this.isRuntimeStatus(rule.runState.currentStatus, PROCESS_RUNTIME_STATUS.suspended)) {
      return PROCESS_STATUS_KIND.suspended;
    }
    return PROCESS_STATUS_KIND.ready;
  }

  protected statusClass(rule: AdminNotificationRule): string {
    return `${STATUS_CLASS_PREFIX}${this.statusKind(rule)}`;
  }

  protected isRowActionPending(rule: AdminNotificationRule, action: ProcessRowAction): boolean {
    return this.rowActionKey() === `${rule.ruleKey}:${action}`;
  }

  protected isProcessRunning(rule: AdminNotificationRule): boolean {
    const currentStatus = `${rule.runState.currentStatus || ''}`.trim().toLowerCase();
    const localRunPending = this.runningRuleKey() === rule.ruleKey && !this.hasFinishedCurrentRun(rule);
    return localRunPending || (currentStatus === PROCESS_RUNTIME_STATUS.running && !this.hasFinishedCurrentRun(rule));
  }

  protected progressValue(rule: AdminNotificationRule): number {
    if (this.isProcessRunning(rule)) {
      return Math.max(0, Math.min(99, rule.runState.progressPercent || 0));
    }
    return Math.max(0, Math.min(100, rule.runState.progressPercent || 0));
  }

  protected runWindows(rule: AdminNotificationRule): AdminNotificationScheduleSlot[] {
    if (!rule.scheduleSlots || rule.scheduleSlots.length === 0) {
      rule.scheduleSlots = [this.newRunWindow()];
    }
    return rule.scheduleSlots;
  }

  protected openScheduleEditor(): void {
    const rule = this.selectedRule();
    if (!rule || !this.canManageProcess(rule)) {
      return;
    }
    this.scheduleEditorOpen.set(true);
  }

  protected closeScheduleEditor(): void {
    this.scheduleEditorOpen.set(false);
  }

  protected async saveScheduleEditor(): Promise<void> {
    const rule = this.selectedRule();
    if (!rule) {
      return;
    }
    this.syncPrimaryTiming(rule);
    const saved = await this.save();
    if (saved) {
      this.closeScheduleEditor();
    }
  }

  protected addRunWindow(rule: AdminNotificationRule): void {
    rule.scheduleSlots = [...this.runWindows(rule), this.newRunWindow()];
    this.syncPrimaryTiming(rule);
  }

  protected removeRunWindow(rule: AdminNotificationRule, index: number): void {
    const next = this.runWindows(rule).filter((_, currentIndex) => currentIndex !== index);
    rule.scheduleSlots = next.length > 0 ? next : [this.newRunWindow()];
    this.syncPrimaryTiming(rule);
  }

  protected updateRunWindow(rule: AdminNotificationRule, slot: AdminNotificationScheduleSlot): void {
    slot.time = this.normalizeTime(slot.time);
    slot.dayOfWeek = Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1)));
    slot.cronExpression = this.cronForSlot(slot);
    this.syncPrimaryTiming(rule);
  }

  protected updateRunWindowAction(slot: AdminNotificationScheduleSlot, value: string): void {
    slot.actionKey = `${value || ''}`.trim();
  }

  protected activeRunWindows(rule: AdminNotificationRule): AdminNotificationScheduleSlot[] {
    return this.runWindows(rule).filter(slot => slot.enabled !== false);
  }

  protected cronForSlot(slot: AdminNotificationScheduleSlot): string {
    const [hour, minute] = this.normalizeTime(slot.time).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    if (slot.frequency === SCHEDULE_FREQUENCY.weekly) {
      const quartzDay = (Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1))) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (slot.frequency === SCHEDULE_FREQUENCY.biWeekly) {
      const quartzDay = (Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1))) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (slot.frequency === SCHEDULE_FREQUENCY.monthly) {
      return `0 ${minute} ${hour} ${this.dayOfMonth(slot.date)} * ?`;
    }
    if (slot.frequency === SCHEDULE_FREQUENCY.yearly) {
      const parsed = this.monthDayParts(slot.date);
      return `0 ${minute} ${hour} ${parsed.day} ${parsed.month} ?`;
    }
    if (slot.frequency === SCHEDULE_FREQUENCY.oneTime && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || '')) {
      const [, month, day] = slot.date.split('-').map(value => Math.max(1, Math.trunc(Number(value) || 1)));
      return `0 ${minute} ${hour} ${day} ${month} ?`;
    }
    return `0 ${minute} ${hour} * * ?`;
  }

  protected history(rule: AdminNotificationRule): AdminNotificationRunHistoryEntry[] {
    return [...(rule.runHistory ?? [])].sort((left, right) =>
      Date.parse(right.finishedAtIso || right.startedAtIso) - Date.parse(left.finishedAtIso || left.startedAtIso)
    );
  }

  protected shortDate(value: string): string {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) {
      return value || JOB_I18N.never;
    }
    return new Date(parsed).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  protected durationLabel(ms: number): string {
    const value = Math.max(0, Math.trunc(Number(ms) || 0));
    if (value < 1000) {
      return `${value}ms`;
    }
    return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}s`;
  }

  protected actionLabel(actionKey: string): string {
    const normalized = `${actionKey || ''}`.trim();
    return normalized || JOB_I18N.action.none;
  }

  protected actionDescription(actionKey: string): string {
    const normalized = `${actionKey || ''}`.trim();
    return normalized ? `${normalized}.description` : JOB_I18N.action.noneDescription;
  }

  protected actionOptions(rule: AdminNotificationRule): string[] {
    const options = new Set<string>(['']);
    const add = (value: string | null | undefined): void => {
      const normalized = `${value || ''}`.trim();
      if (normalized) {
        options.add(normalized);
      }
    };
    add(rule.actionKey);
    for (const slot of rule.scheduleSlots ?? []) {
      add(slot.actionKey);
    }
    for (const processRule of this.processRules()) {
      add(processRule.actionKey);
      for (const slot of processRule.scheduleSlots ?? []) {
        add(slot.actionKey);
      }
    }
    return [...options];
  }

  protected updateActionKey(rule: AdminNotificationRule, value: string): void {
    rule.actionKey = `${value || ''}`.trim();
  }

  protected loadingRingDashOffset(): number {
    return this.loadingRingPerimeter * (1 - Math.min(1, Math.max(0, this.loadingProgress())));
  }

  private startRuntimeUpdates(): void {
    if (this.unsubscribeRuntimeUpdates) {
      return;
    }
    this.unsubscribeRuntimeUpdates = this.admin.subscribeNotificationRuleUpdates(event => this.applyRuntimeEvent(event));
  }

  private stopRuntimeUpdates(): void {
    if (!this.unsubscribeRuntimeUpdates) {
      return;
    }
    this.unsubscribeRuntimeUpdates();
    this.unsubscribeRuntimeUpdates = null;
  }

  private applyRuntimeEvent(event: AdminNotificationRuleLiveEvent): void {
    const ruleKey = `${event.ruleKey ?? ''}`.trim();
    if (!ruleKey) {
      return;
    }
    this.patchRule(ruleKey, current => ({
      ...current,
      runState: event.runState,
      runHistory: event.runHistory ?? [],
      updatedDate: event.updatedDate || current.updatedDate,
      updatedUser: event.updatedUser || current.updatedUser
    }));
  }

  private beginLoadingProgress(): void {
    this.clearLoadingProgress();
    this.loadingProgressStartedAtMs = this.nowMs();
    this.loadingProgressTimer = setInterval(() => this.updateLoadingProgress(), 100);
    this.updateLoadingProgress();
  }

  private updateLoadingProgress(): void {
    if (!this.loadingProgressStartedAtMs) {
      this.loadingProgress.set(0);
      return;
    }
    const elapsedMs = Math.max(0, this.nowMs() - this.loadingProgressStartedAtMs);
    this.loadingProgress.set(Math.min(0.96, elapsedMs / this.admin.notificationCenterLoadProgressWindowMs()));
  }

  private endLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgress.set(1);
  }

  private clearLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgressStartedAtMs = 0;
    this.loadingProgress.set(0);
  }

  private clearLoadingProgressTimer(): void {
    if (!this.loadingProgressTimer) {
      return;
    }
    clearInterval(this.loadingProgressTimer);
    this.loadingProgressTimer = null;
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private ensureProcessRules(state: AdminNotificationCenterState): AdminNotificationCenterState {
    const existing = state.rules ?? [];
    const processRules = this.processRulesFrom(existing);
    return {
      ...state,
      rules: processRules,
      updatedDate: state.updatedDate || new Date().toISOString()
    };
  }

  private processRulesFrom(rules: readonly AdminNotificationRule[]): AdminNotificationRule[] {
    return this.sortProcessRules(rules.filter(rule => this.isScheduledProcess(rule)));
  }

  private sortProcessRules(rules: AdminNotificationRule[]): AdminNotificationRule[] {
    return rules.sort((left, right) =>
      (left.priority || 1000) - (right.priority || 1000)
      || left.label.localeCompare(right.label)
      || left.ruleKey.localeCompare(right.ruleKey)
    );
  }

  private sortFilteredProcessRules(rules: AdminNotificationRule[], filter: ProcessListFilter): AdminNotificationRule[] {
    if (PROCESS_NEXT_RUN_SORT_FILTERS.has(filter)) {
      return rules.sort((left, right) =>
        this.nextRunSortValue(left) - this.nextRunSortValue(right)
        || this.processStableSort(left, right)
      );
    }
    if (PROCESS_FAILED_SORT_FILTERS.has(filter)) {
      return rules.sort((left, right) =>
        this.lastFailedSortValue(right) - this.lastFailedSortValue(left)
        || this.processStableSort(left, right)
      );
    }
    return rules.sort((left, right) =>
      this.lastUpdatedSortValue(right) - this.lastUpdatedSortValue(left)
      || this.processStableSort(left, right)
    );
  }

  private processStableSort(left: AdminNotificationRule, right: AdminNotificationRule): number {
    return (left.priority || 1000) - (right.priority || 1000)
      || left.label.localeCompare(right.label)
      || left.ruleKey.localeCompare(right.ruleKey);
  }

  private lastUpdatedSortValue(rule: AdminNotificationRule): number {
    return this.parseDateSortValue(rule.updatedDate)
      || this.parseDateSortValue(rule.runState.lastRunAtIso)
      || 0;
  }

  private lastFailedSortValue(rule: AdminNotificationRule): number {
    const historyValue = Math.max(0, ...this.history(rule)
      .filter(entry => PROCESS_PROBLEM_RUNTIME_STATUSES.has(`${entry.status || ''}`.trim().toLowerCase()))
      .map(entry => this.parseDateSortValue(entry.finishedAtIso || entry.startedAtIso)));
    if (historyValue > 0) {
      return historyValue;
    }
    const lastStatus = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    return PROCESS_PROBLEM_RUNTIME_STATUSES.has(lastStatus)
      ? this.parseDateSortValue(rule.runState.lastRunAtIso || rule.runState.finishedAtIso)
      : 0;
  }

  private parseDateSortValue(value: string | null | undefined): number {
    const parsed = Date.parse(`${value || ''}`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private nextRunSortValue(rule: AdminNotificationRule): number {
    const values = this.runWindows(rule)
      .filter(slot => slot.enabled !== false)
      .map(slot => this.slotSortValue(slot))
      .filter(value => Number.isFinite(value));
    return values.length > 0 ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
  }

  private slotSortValue(slot: AdminNotificationScheduleSlot): number {
    const [hour, minute] = this.normalizeTime(slot.time).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    const dateTime = (date: Date): number => {
      date.setHours(hour, minute, 0, 0);
      return date.getTime();
    };
    if (slot.frequency === SCHEDULE_FREQUENCY.oneTime && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || '')) {
      return dateTime(new Date(`${slot.date}T00:00:00`));
    }
    const today = new Date();
    if (WEEKLY_SCHEDULE_FREQUENCIES.has(slot.frequency)) {
      const targetDay = Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1)));
      const currentDay = today.getDay() === 0 ? 7 : today.getDay();
      const offsetDays = (targetDay - currentDay + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + offsetDays);
      const value = dateTime(next);
      return value >= Date.now() ? value : value + 7 * 24 * 60 * 60 * 1000;
    }
    if (ROLLING_DATE_SCHEDULE_FREQUENCIES.has(slot.frequency)) {
      const { month, day } = this.monthDayParts(slot.date);
      const next = new Date(today);
      next.setDate(Math.min(day, 28));
      if (slot.frequency === SCHEDULE_FREQUENCY.yearly) {
        next.setMonth(month - 1, Math.min(day, 28));
      }
      let value = dateTime(next);
      if (value < Date.now()) {
        if (slot.frequency === SCHEDULE_FREQUENCY.yearly) {
          next.setFullYear(next.getFullYear() + 1);
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        value = dateTime(next);
      }
      return value;
    }
    const next = new Date();
    let value = dateTime(next);
    if (value < Date.now()) {
      next.setDate(next.getDate() + 1);
      value = dateTime(next);
    }
    return value;
  }

  private mergeRuntimeState(incomingState: AdminNotificationCenterState): void {
    const currentState = this.state();
    if (!currentState) {
      this.state.set(this.ensureProcessRules(incomingState));
      return;
    }
    const incomingRules = this.ensureProcessRules(incomingState).rules;
    this.state.set({
      ...currentState,
      rules: currentState.rules.map(rule => {
        const incoming = incomingRules.find(item => item.ruleKey === rule.ruleKey);
        if (!incoming) {
          return rule;
        }
        return {
          ...rule,
          runState: incoming.runState,
          runHistory: incoming.runHistory ?? [],
          updatedDate: incoming.updatedDate || rule.updatedDate,
          updatedUser: incoming.updatedUser || rule.updatedUser
        };
      }),
      updatedDate: incomingState.updatedDate || currentState.updatedDate
    });
  }

  private patchRule(ruleKey: string, update: (rule: AdminNotificationRule) => AdminNotificationRule): void {
    const state = this.state();
    if (!state) {
      return;
    }
    this.state.set({
      ...state,
      rules: state.rules.map(rule => rule.ruleKey === ruleKey ? update(rule) : rule),
      updatedDate: new Date().toISOString()
    });
  }

  private isScheduledProcess(rule: AdminNotificationRule): boolean {
    return rule.triggerKind === PROCESS_TRIGGER_KIND.scheduledProcess;
  }

  private durationBetween(startedAtIso: string, finishedAtIso: string): number {
    const started = Date.parse(startedAtIso || '');
    const finished = Date.parse(finishedAtIso || '');
    return Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : 0;
  }

  private isRuntimeStatus(value: string | null | undefined, expected: string): boolean {
    return `${value || ''}`.trim().toLowerCase() === expected;
  }

  private hasNewerFinishedRun(rule: AdminNotificationRule, requestStartedAtIso: string): boolean {
    const lastRunAt = Date.parse(rule.runState.lastRunAtIso || rule.runState.finishedAtIso || '');
    const requestStartedAt = Date.parse(requestStartedAtIso || '');
    const status = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    return Number.isFinite(lastRunAt)
      && Number.isFinite(requestStartedAt)
      && lastRunAt >= requestStartedAt
      && status !== PROCESS_RUNTIME_STATUS.running;
  }

  private hasFinishedCurrentRun(rule: AdminNotificationRule): boolean {
    const startedAt = Date.parse(rule.runState.startedAtIso || '');
    const finishedAt = Date.parse(rule.runState.finishedAtIso || rule.runState.lastRunAtIso || '');
    const lastStatus = `${rule.runState.lastRunStatus || ''}`.trim().toLowerCase();
    return Number.isFinite(finishedAt)
      && (!Number.isFinite(startedAt) || finishedAt >= startedAt)
      && PROCESS_FINISHED_RUNTIME_STATUSES.has(lastStatus);
  }

  private newRunWindow(): AdminNotificationScheduleSlot {
    const slot: AdminNotificationScheduleSlot = {
      id: `run-window-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      frequency: DEFAULT_RUN_WINDOW.frequency,
      date: this.todayIsoDate(),
      dayOfWeek: DEFAULT_RUN_WINDOW.dayOfWeek,
      time: DEFAULT_RUN_WINDOW.time,
      timezone: DEFAULT_RUN_WINDOW.timezone,
      cronExpression: '',
      actionKey: DEFAULT_RUN_WINDOW.actionKey,
      enabled: DEFAULT_RUN_WINDOW.enabled
    };
    slot.cronExpression = this.cronForSlot(slot);
    return slot;
  }

  private syncPrimaryTiming(rule: AdminNotificationRule): void {
    const first = this.runWindows(rule)[0];
    rule.timing.mode = DEFAULT_PRIMARY_TIMING.mode;
    rule.timing.time = this.normalizeTime(first.time);
    rule.timing.timezone = first.timezone || DEFAULT_RUN_WINDOW.timezone;
    rule.timing.cronExpression = first.cronExpression || this.cronForSlot(first);
    rule.timing.intervalMinutes = DEFAULT_PRIMARY_TIMING.intervalMinutes;
  }

  private isLastRunProblem(rule: AdminNotificationRule): boolean {
    const status = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    return PROCESS_PROBLEM_RUNTIME_STATUSES.has(status);
  }

  protected dayOfMonth(value: string): number {
    return this.monthDayParts(value).day;
  }

  protected monthDayLabel(value: string): string {
    const { month, day } = this.monthDayParts(value);
    return new Date(Date.UTC(2026, month - 1, day)).toLocaleString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private monthDayParts(value: string): { month: number; day: number } {
    const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const month = match ? Math.max(1, Math.min(12, Math.trunc(Number(match[2]) || 1))) : 1;
    const day = match ? Math.max(1, Math.min(31, Math.trunc(Number(match[3]) || 1))) : 1;
    return { month, day };
  }

  private normalizeTime(value: string): string {
    const normalized = `${value || ''}`.trim();
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : DEFAULT_RUN_WINDOW.time;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
