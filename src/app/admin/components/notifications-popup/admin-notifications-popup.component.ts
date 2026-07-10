import {
  CommonModule
} from '@angular/common';
import {
  Component,
  OnDestroy,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  AdminNotificationsService,
  I18nService
} from '../../../shared/core';
import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRuleParameter,
  AdminNotificationRuleParameterOption,
  AdminNotificationRunHistoryEntry,
  AdminNotificationScheduleSlot,
  AdminNotificationIntervalUnit
} from '../../../shared/core';
import {
  I18nPipe
} from '../../../shared/ui';
import {
  type AppMenuItemSelectEvent,
  type AppMenuModel
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

const PROCESS_LIST_FILTER = {
  all: 'all',
  active: 'active',
  suspended: 'suspended',
  running: 'running',
  failed: 'failed'
} as const;
type ProcessListFilter = typeof PROCESS_LIST_FILTER[keyof typeof PROCESS_LIST_FILTER];
type ProcessFilterMenuItemId = 'process-filter-menu' | `process-filter:${ProcessListFilter}`;

interface ProcessFilterMenuContext {
  filter: ProcessListFilter;
}

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

const OBSOLETE_NOTIFICATION_RULE_PARAMETER_KEYS = new Set([
  'jobs.process.randomGroups.historyPenalty'
]);

const SCHEDULE_FREQUENCY = {
  daily: 'daily',
  weekly: 'weekly',
  biWeekly: 'bi-weekly',
  monthly: 'monthly',
  yearly: 'yearly',
  oneTime: 'one-time'
} as const;

const INTERVAL_UNIT = {
  seconds: 'seconds',
  minutes: 'minutes',
  hours: 'hours',
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years'
} as const;
type IntervalUnit = AdminNotificationIntervalUnit;

const INTERVAL_UNIT_SECONDS: Record<IntervalUnit, number> = {
  [INTERVAL_UNIT.seconds]: 1,
  [INTERVAL_UNIT.minutes]: 60,
  [INTERVAL_UNIT.hours]: 3600,
  [INTERVAL_UNIT.days]: 86400,
  [INTERVAL_UNIT.weeks]: 604800,
  [INTERVAL_UNIT.months]: 2592000,
  [INTERVAL_UNIT.years]: 31536000
};

const INTERVAL_UNIT_OPTIONS: Array<{ value: IntervalUnit; labelKey: string }> = [
  { value: INTERVAL_UNIT.seconds, labelKey: 'admin.jobs.interval.seconds' },
  { value: INTERVAL_UNIT.minutes, labelKey: 'admin.jobs.interval.minutes' },
  { value: INTERVAL_UNIT.hours, labelKey: 'admin.jobs.interval.hours' },
  { value: INTERVAL_UNIT.days, labelKey: 'admin.jobs.interval.days' },
  { value: INTERVAL_UNIT.weeks, labelKey: 'admin.jobs.interval.weeks' },
  { value: INTERVAL_UNIT.months, labelKey: 'admin.jobs.interval.months' },
  { value: INTERVAL_UNIT.years, labelKey: 'admin.jobs.interval.years' }
];

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
  interval: {
    title: 'admin.jobs.interval',
    description: 'admin.jobs.interval.description',
    every: 'admin.jobs.interval.every',
    second: 'admin.jobs.interval.second',
    seconds: 'admin.jobs.interval.seconds',
    minute: 'admin.jobs.interval.minute',
    hour: 'admin.jobs.interval.hour',
    hours: 'admin.jobs.interval.hours',
    day: 'admin.jobs.interval.day',
    days: 'admin.jobs.interval.days',
    minutes: 'admin.jobs.interval.minutes',
    week: 'admin.jobs.interval.week',
    weeks: 'admin.jobs.interval.weeks',
    month: 'admin.jobs.interval.month',
    months: 'admin.jobs.interval.months',
    year: 'admin.jobs.interval.year',
    years: 'admin.jobs.interval.years'
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

const PROCESS_RULE_ICONS: Record<string, string> = {
  'event-random-groups': 'hub',
  'event-auto-inviter': 'person_add',
  'event-tournament-review': 'emoji_events',
  'event-counter-expiry': 'event_available',
  'event-checkout-basket-purge': 'shopping_basket',
  'notification-outbox': 'notifications_active',
  'affinity-recompute': 'sync_alt',
  'scheduled-messages': 'schedule_send',
  'account-purge': 'delete_sweep'
};

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
  imports: [CommonModule, FormsModule, MatIconModule, IndicatorComponent, I18nPipe, PopupComponent],
  templateUrl: './admin-notifications-popup.component.html',
  styleUrl: './admin-notifications-popup.component.scss'
})
export class AdminNotificationsPopupComponent implements OnDestroy {
  protected readonly admin = inject(AdminMenuStore);
  protected readonly notificationsService = inject(AdminNotificationsService);
  private readonly i18n = inject(I18nService);
  private readonly userProfileStore = inject(UserProfileStore);
  protected readonly popupKey = ADMIN_POPUP_KEY;
  protected readonly jobI18n = JOB_I18N;
  protected readonly processRowAction = PROCESS_ROW_ACTION;
  protected readonly intervalUnitOptions = INTERVAL_UNIT_OPTIONS;
  protected readonly defaultRunWindow = DEFAULT_RUN_WINDOW;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly runningRuleKey = signal('');
  protected readonly rowActionKey = signal('');
  protected readonly error = signal('');
  protected readonly state = signal<AdminNotificationCenterState | null>(null);
  protected readonly selectedRuleKey = signal('');
  protected readonly detailOpen = signal(false);
  protected readonly scheduleEditorOpen = signal(false);
  protected readonly parameterDraft = signal<{ ruleKey: string; fields: AdminNotificationRuleParameter[] } | null>(null);
  protected readonly timingDirtyKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly parameterDirtyKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly processFilter = signal<ProcessListFilter>(PROCESS_LIST_FILTER.all);
  private loadedForOpen = false;
  private unsubscribeRuntimeUpdates: (() => void) | null = null;
  private readonly timingBaselineSignatures = new Map<string, string>();
  private readonly parameterBaselineSignatures = new Map<string, string>();

  protected readonly processFilterOptions = PROCESS_FILTER_OPTIONS;
  protected readonly processStatusLabelKeys = PROCESS_STATUS_LABEL_KEYS;

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== ADMIN_POPUP_KEY) {
        this.loadedForOpen = false;
        this.error.set('');
        this.detailOpen.set(false);
        this.scheduleEditorOpen.set(false);
        this.timingDirtyKeys.set(new Set());
        this.parameterDirtyKeys.set(new Set());
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
    }
    this.error.set('');
    try {
      const state = await this.notificationsService.loadNotificationCenter(this.activeAdminId(), { skipDemoDelay: silent });
      if (silent) {
        this.mergeRuntimeState(state);
      } else {
        const normalizedState = this.ensureProcessRules(state);
        this.state.set(normalizedState);
        this.captureTimingBaselines(normalizedState.rules);
        this.captureParameterBaselines(normalizedState.rules);
        this.timingDirtyKeys.set(new Set());
        this.parameterDirtyKeys.set(new Set());
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
      const savedState = await this.notificationsService.saveNotificationCenter(rulesToSave, this.activeAdminId());
      const normalizedState = this.ensureProcessRules(savedState);
      this.state.set(normalizedState);
      this.captureTimingBaselines(normalizedState.rules);
      this.captureParameterBaselines(normalizedState.rules);
      this.timingDirtyKeys.set(new Set());
      this.parameterDirtyKeys.set(new Set());
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
          updatedUser: this.activeAdminId(current.updatedUser)
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
      const result = await this.notificationsService.runNotificationRule(rule.ruleKey, this.activeAdminId());
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
          runnerUser: this.activeAdminId(current.runState.lastRunUser),
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
            lastRunUser: this.activeAdminId(current.runState.lastRunUser)
          },
          runHistory: entry ? [entry, ...(current.runHistory ?? [])].slice(0, 12) : current.runHistory,
          updatedDate: finishedAtIso,
          updatedUser: this.activeAdminId(current.updatedUser)
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

  protected notificationsPopupModel(): PopupModel<ProcessFilterMenuContext> {
    return {
      title: this.uiText('jobs'),
      subtitle: `${this.processRules().length} ${this.uiText('admin.jobs.background.processes')}`,
      ariaLabel: this.uiText('jobs'),
      closeAriaLabel: this.uiText('close'),
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.loading() || this.detailOpen()
        ? []
        : [
            {
              kind: 'menu',
              id: 'process-filter',
              menuKind: 'inline',
              model: this.processFilterMenuModel(),
              panelAlign: 'end'
            }
          ],
      onClose: () => this.close(),
      onMenuSelect: event => this.onNotificationsPopupMenuSelect(event)
    };
  }

  protected processDetailPopupModel(rule: AdminNotificationRule): PopupModel {
    const dirty = this.isTimingDirty(rule) || this.isParameterDirty(rule);
    return {
      title: this.processTitle(rule),
      subtitle: this.processDetailSubtitle(rule),
      ariaLabel: this.uiText(this.processTitle(rule)),
      closeAriaLabel: this.uiText('admin.jobs.close.detail'),
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      showClose: false,
      headerActions: [
        {
          id: 'process-detail-save',
          icon: 'check',
          ariaLabel: this.uiText('admin.jobs.save.process'),
          palette: dirty ? 'danger' : 'success',
          active: dirty,
          disabled: this.loading() || this.saving() || !this.state() || !this.canManageProcess(rule)
        },
        {
          id: 'process-detail-close',
          icon: 'close',
          ariaLabel: this.uiText('admin.jobs.close.detail'),
          palette: 'neutral'
        }
      ],
      onClose: () => this.closeDetail(),
      onAction: event => void this.onProcessDetailPopupAction(event)
    };
  }

  protected scheduleEditorPopupModel(rule: AdminNotificationRule): PopupModel {
    return {
      title: 'admin.jobs.timing',
      subtitle: 'admin.jobs.timing.description',
      secondarySubtitle: this.intervalCron(rule),
      ariaLabel: this.uiText('admin.jobs.timing'),
      closeAriaLabel: this.uiText('admin.jobs.close.run.window.editor'),
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      showClose: false,
      headerActions: [
        {
          id: 'schedule-save',
          icon: 'check',
          ariaLabel: this.uiText('done'),
          palette: 'success',
          disabled: this.saving()
        },
        {
          id: 'schedule-close',
          icon: 'close',
          ariaLabel: this.uiText('admin.jobs.close.run.window.editor'),
          palette: 'neutral',
          disabled: this.saving()
        }
      ],
      onClose: () => this.closeScheduleEditor(),
      onAction: event => void this.onScheduleEditorPopupAction(event)
    };
  }

  protected parameterEditorPopupModel(): PopupModel {
    return {
      title: 'admin.jobs.parameters',
      subtitle: 'admin.jobs.parameters.description',
      ariaLabel: this.uiText('admin.jobs.parameters'),
      closeAriaLabel: this.uiText('cancel'),
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      showClose: false,
      headerActions: [
        {
          id: 'parameter-save',
          icon: 'check',
          ariaLabel: this.uiText('done'),
          palette: 'success',
          disabled: this.saving()
        },
        {
          id: 'parameter-close',
          icon: 'close',
          ariaLabel: this.uiText('cancel'),
          palette: 'neutral',
          disabled: this.saving()
        }
      ],
      onClose: () => this.closeParameterEditor(),
      onAction: event => void this.onParameterEditorPopupAction(event)
    };
  }

  protected openDetail(rule: AdminNotificationRule): void {
    this.selectedRuleKey.set(rule.ruleKey);
    this.detailOpen.set(true);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.scheduleEditorOpen.set(false);
    this.parameterDraft.set(null);
  }

  protected selectRule(ruleKey: string): void {
    this.selectedRuleKey.set(ruleKey);
    this.scheduleEditorOpen.set(false);
    this.parameterDraft.set(null);
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

  protected processFilterMenuModel(): AppMenuModel<ProcessFilterMenuItemId, ProcessFilterMenuContext> {
    return {
      nodes: [
        {
          id: 'process-filter-root',
          items: [
            {
              id: 'process-filter-menu',
              kind: 'select-trigger',
              label: this.processFilterLabel(),
              icon: this.processFilterIcon(),
              counter: this.processFilterCount(),
              ariaLabel: 'admin.jobs.filter.aria',
              items: this.processFilterOptions.map(option => ({
                id: `process-filter:${option.key}`,
                kind: 'radio',
                label: option.labelKey,
                icon: option.icon,
                checked: this.processFilter() === option.key,
                counter: this.processFilterCount(option.key),
                context: { filter: option.key }
              }))
            }
          ]
        }
      ]
    };
  }

  protected onProcessFilterMenuSelect(event: AppMenuItemSelectEvent<string, ProcessFilterMenuContext>): void {
    const nextFilter = event.context?.filter;
    if (!nextFilter) {
      return;
    }
    this.selectProcessFilter(nextFilter, event.sourceEvent);
  }

  private onNotificationsPopupMenuSelect(event: PopupMenuSelectEvent<ProcessFilterMenuContext>): void {
    this.onProcessFilterMenuSelect(event.itemSelect);
  }

  private async onProcessDetailPopupAction(event: PopupActionEvent): Promise<void> {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'process-detail-save') {
      await this.saveAndCloseDetail();
      return;
    }
    if (event.action.id === 'process-detail-close') {
      this.closeDetail();
    }
  }

  private async onScheduleEditorPopupAction(event: PopupActionEvent): Promise<void> {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'schedule-save') {
      await this.saveScheduleEditor();
      return;
    }
    if (event.action.id === 'schedule-close') {
      this.closeScheduleEditor();
    }
  }

  private async onParameterEditorPopupAction(event: PopupActionEvent): Promise<void> {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'parameter-save') {
      await this.saveParameterEditor();
      return;
    }
    if (event.action.id === 'parameter-close') {
      this.closeParameterEditor();
    }
  }

  private processDetailSubtitle(rule: AdminNotificationRule): string {
    return `${this.uiText('admin.jobs.scheduled.process')} · `
      + `${this.uiText(this.processStatusLabelKeys[this.statusKind(rule)])} · `
      + `${this.uiText('admin.jobs.last.changed')} ${this.uiText(this.shortDate(rule.updatedDate || ''))}`;
  }

  private uiText(value: string, fallback = ''): string {
    return this.i18n.translate(value, fallback);
  }

  protected selectProcessFilter(filter: ProcessListFilter, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.processFilter.set(filter);
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
    return PROCESS_RULE_ICONS[rule.ruleKey] ?? (rule.manualRunEnabled ? PROCESS_ICON.manual : PROCESS_ICON.default);
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

  protected isTimingDirty(rule: AdminNotificationRule): boolean {
    return this.timingDirtyKeys().has(rule.ruleKey);
  }

  protected isParameterDirty(rule: AdminNotificationRule): boolean {
    return this.parameterDirtyKeys().has(rule.ruleKey);
  }

  private refreshTimingDirty(rule: AdminNotificationRule): void {
    const baseline = this.timingBaselineSignatures.get(rule.ruleKey);
    const current = this.timingSignature(rule);
    const next = new Set(this.timingDirtyKeys());
    if (baseline && baseline !== current) {
      next.add(rule.ruleKey);
    } else {
      next.delete(rule.ruleKey);
    }
    this.timingDirtyKeys.set(next);
  }

  private refreshParameterDirty(ruleKey: string, signature: string): void {
    const baseline = this.parameterBaselineSignatures.get(ruleKey);
    const next = new Set(this.parameterDirtyKeys());
    if (baseline && baseline !== signature) {
      next.add(ruleKey);
    } else {
      next.delete(ruleKey);
    }
    this.parameterDirtyKeys.set(next);
  }

  protected hasJobParameters(rule: AdminNotificationRule): boolean {
    return (rule.parameters ?? []).some(field => `${field.key ?? ''}`.trim());
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

  protected rowStatusLabel(rule: AdminNotificationRule): string {
    if (this.isProcessRunning(rule)) {
      return JOB_I18N.status.running;
    }
    if (!rule.enabled || this.isRuntimeStatus(rule.runState.currentStatus, PROCESS_RUNTIME_STATUS.suspended)) {
      return JOB_I18N.status.suspended;
    }
    const lastStatus = `${rule.runState.lastRunStatus || ''}`.trim().toLowerCase();
    if (!lastStatus) {
      return JOB_I18N.lastRun.notRunYet;
    }
    return PROCESS_STATUS_LABEL_KEYS[PROCESS_STATUS_KIND_BY_RUNTIME_STATUS[lastStatus] ?? PROCESS_STATUS_KIND.ready];
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
    return rule.scheduleSlots ?? [];
  }

  protected hasEditableRunWindows(rule: AdminNotificationRule): boolean {
    return this.canManageProcess(rule) && this.runWindows(rule).length > 0;
  }

  protected hasEditableTiming(rule: AdminNotificationRule): boolean {
    return this.canManageProcess(rule);
  }

  protected intervalMinutes(rule: AdminNotificationRule): number {
    return Math.max(1, Math.ceil(this.intervalSeconds(rule) / 60));
  }

  protected intervalSeconds(rule: AdminNotificationRule): number {
    const amount = this.intervalAmount(rule);
    const unit = this.intervalUnit(rule);
    const unitSeconds = INTERVAL_UNIT_SECONDS[unit] || INTERVAL_UNIT_SECONDS.minutes;
    return Math.max(1, amount * unitSeconds);
  }

  protected startTime(rule: AdminNotificationRule): string {
    return this.normalizeTime(this.runWindows(rule)[0]?.time || rule.timing?.time || DEFAULT_RUN_WINDOW.time);
  }

  protected intervalAmount(rule: AdminNotificationRule): number {
    const explicitAmount = Math.trunc(Number(rule.timing?.intervalAmount) || 0);
    if (explicitAmount > 0 && this.isIntervalUnit(rule.timing?.intervalUnit)) {
      return explicitAmount;
    }
    const slotAmount = this.runWindowIntervalAmount(rule);
    if (slotAmount > 0) {
      return slotAmount;
    }
    const explicitSeconds = Math.trunc(Number(rule.timing?.intervalSeconds) || 0);
    if (explicitSeconds > 0) {
      const unit = this.fixedIntervalUnitForSeconds(explicitSeconds);
      return Math.max(1, Math.trunc(explicitSeconds / INTERVAL_UNIT_SECONDS[unit]));
    }
    const minutes = Math.max(1, Math.trunc(Number(rule.timing?.intervalMinutes) || 1));
    const unit = this.fixedIntervalUnitForSeconds(minutes * INTERVAL_UNIT_SECONDS.minutes);
    return Math.max(1, Math.trunc((minutes * INTERVAL_UNIT_SECONDS.minutes) / INTERVAL_UNIT_SECONDS[unit]));
  }

  protected intervalUnit(rule: AdminNotificationRule): IntervalUnit {
    if (this.isIntervalUnit(rule.timing?.intervalUnit)) {
      return rule.timing.intervalUnit;
    }
    const slotUnit = this.runWindowIntervalUnit(rule);
    if (slotUnit) {
      return slotUnit;
    }
    const explicitSeconds = Math.trunc(Number(rule.timing?.intervalSeconds) || 0);
    if (explicitSeconds > 0) {
      return this.fixedIntervalUnitForSeconds(explicitSeconds);
    }
    return this.fixedIntervalUnitForSeconds(Math.max(1, Math.trunc(Number(rule.timing?.intervalMinutes) || 1)) * INTERVAL_UNIT_SECONDS.minutes);
  }

  protected intervalParts(rule: AdminNotificationRule): Array<{ value: number; unitKey: string }> {
    const value = this.intervalAmount(rule);
    return [{ value, unitKey: this.intervalUnitLabelKey(this.intervalUnit(rule), value) }];
  }

  protected intervalCron(rule: AdminNotificationRule): string {
    return this.intervalExpression(rule);
  }

  private isIntervalUnit(value: unknown): value is IntervalUnit {
    return Object.values(INTERVAL_UNIT).includes(value as IntervalUnit);
  }

  private runWindowIntervalAmount(rule: AdminNotificationRule): number {
    const first = this.runWindows(rule)[0];
    if (!first) {
      return 0;
    }
    if (first.frequency === SCHEDULE_FREQUENCY.biWeekly) {
      return 2;
    }
    return 1;
  }

  private runWindowIntervalUnit(rule: AdminNotificationRule): IntervalUnit | null {
    const first = this.runWindows(rule)[0];
    if (!first) {
      return null;
    }
    if (first.frequency === SCHEDULE_FREQUENCY.weekly || first.frequency === SCHEDULE_FREQUENCY.biWeekly) {
      return INTERVAL_UNIT.weeks;
    }
    if (first.frequency === SCHEDULE_FREQUENCY.monthly) {
      return INTERVAL_UNIT.months;
    }
    if (first.frequency === SCHEDULE_FREQUENCY.yearly) {
      return INTERVAL_UNIT.years;
    }
    return INTERVAL_UNIT.days;
  }

  private fixedIntervalUnitForSeconds(seconds: number): IntervalUnit {
    const value = Math.max(1, Math.trunc(Number(seconds) || 1));
    if (value % INTERVAL_UNIT_SECONDS.years === 0) {
      return INTERVAL_UNIT.years;
    }
    if (value % INTERVAL_UNIT_SECONDS.months === 0) {
      return INTERVAL_UNIT.months;
    }
    if (value % INTERVAL_UNIT_SECONDS.weeks === 0) {
      return INTERVAL_UNIT.weeks;
    }
    if (value % INTERVAL_UNIT_SECONDS.days === 0) {
      return INTERVAL_UNIT.days;
    }
    if (value % INTERVAL_UNIT_SECONDS.hours === 0) {
      return INTERVAL_UNIT.hours;
    }
    if (value % INTERVAL_UNIT_SECONDS.minutes === 0) {
      return INTERVAL_UNIT.minutes;
    }
    return INTERVAL_UNIT.seconds;
  }

  private intervalUnitLabelKey(unit: IntervalUnit, amount: number): string {
    const plural = Math.max(1, Math.trunc(Number(amount) || 1)) !== 1;
    switch (unit) {
      case INTERVAL_UNIT.seconds:
        return plural ? JOB_I18N.interval.seconds : JOB_I18N.interval.second;
      case INTERVAL_UNIT.minutes:
        return plural ? JOB_I18N.interval.minutes : JOB_I18N.interval.minute;
      case INTERVAL_UNIT.hours:
        return plural ? JOB_I18N.interval.hours : JOB_I18N.interval.hour;
      case INTERVAL_UNIT.days:
        return plural ? JOB_I18N.interval.days : JOB_I18N.interval.day;
      case INTERVAL_UNIT.weeks:
        return plural ? JOB_I18N.interval.weeks : JOB_I18N.interval.week;
      case INTERVAL_UNIT.months:
        return plural ? JOB_I18N.interval.months : JOB_I18N.interval.month;
      case INTERVAL_UNIT.years:
        return plural ? JOB_I18N.interval.years : JOB_I18N.interval.year;
      default:
        return JOB_I18N.interval.minutes;
    }
  }

  protected openScheduleEditor(): void {
    const rule = this.selectedRule();
    if (!rule || !this.hasEditableTiming(rule)) {
      return;
    }
    this.parameterDraft.set(null);
    this.scheduleEditorOpen.set(true);
  }

  protected closeScheduleEditor(): void {
    this.scheduleEditorOpen.set(false);
  }

  protected openParameterEditor(rule: AdminNotificationRule): void {
    if (!this.canManageProcess(rule) || !this.hasJobParameters(rule) || this.saving()) {
      return;
    }
    this.selectedRuleKey.set(rule.ruleKey);
    this.scheduleEditorOpen.set(false);
    this.parameterDraft.set({
      ruleKey: rule.ruleKey,
      fields: (rule.parameters ?? []).map(field => ({ ...field, options: [...(field.options ?? [])] }))
    });
  }

  protected closeParameterEditor(): void {
    if (this.saving()) {
      return;
    }
    this.parameterDraft.set(null);
  }

  protected async saveParameterEditor(): Promise<void> {
    const draft = this.parameterDraft();
    if (!draft || this.saving()) {
      return;
    }
    const nextFields = draft.fields.map(field => ({ ...field, options: [...(field.options ?? [])] }));
    const nextSignature = this.parameterSignatureFromFields(nextFields);
    const currentRule = this.processRules().find(rule => rule.ruleKey === draft.ruleKey);
    if (!currentRule || nextSignature !== this.parameterSignature(currentRule)) {
      this.patchRule(draft.ruleKey, rule => ({
        ...rule,
        parameters: nextFields,
        updatedDate: new Date().toISOString(),
        updatedUser: this.activeAdminId(rule.updatedUser)
      }));
    }
    this.refreshParameterDirty(draft.ruleKey, nextSignature);
    this.parameterDraft.set(null);
  }

  protected async saveScheduleEditor(): Promise<void> {
    const rule = this.selectedRule();
    if (!rule) {
      return;
    }
    this.syncPrimaryTiming(rule);
    this.refreshTimingDirty(rule);
    this.closeScheduleEditor();
  }

  protected updateStartTime(rule: AdminNotificationRule, value: string): void {
    rule.timing.time = this.normalizeTime(value);
    this.syncPrimaryTiming(rule);
    this.refreshTimingDirty(rule);
  }

  protected updateIntervalAmount(rule: AdminNotificationRule, value: string | number): void {
    const amount = Math.max(1, Math.trunc(Number(value) || 1));
    this.updateIntervalRule(rule, amount, this.intervalUnit(rule));
  }

  protected updateIntervalUnit(rule: AdminNotificationRule, value: IntervalUnit): void {
    const unit = this.isIntervalUnit(value) ? value : INTERVAL_UNIT.minutes;
    this.updateIntervalRule(rule, this.intervalAmount(rule), unit);
  }

  private updateIntervalRule(rule: AdminNotificationRule, amount: number, unit: IntervalUnit): void {
    const intervalAmount = Math.max(1, Math.trunc(Number(amount) || 1));
    const intervalUnit = this.isIntervalUnit(unit) ? unit : INTERVAL_UNIT.minutes;
    const intervalSeconds = intervalAmount * INTERVAL_UNIT_SECONDS[intervalUnit];
    const minutes = Math.max(1, Math.ceil(intervalSeconds / 60));
    rule.timing.mode = DEFAULT_PRIMARY_TIMING.mode;
    rule.timing.intervalMinutes = minutes;
    rule.timing.intervalSeconds = intervalSeconds;
    rule.timing.intervalAmount = intervalAmount;
    rule.timing.intervalUnit = intervalUnit;
    rule.timing.time = this.normalizeTime(rule.timing.time);
    rule.timing.timezone = rule.timing.timezone || DEFAULT_RUN_WINDOW.timezone;
    rule.timing.cronExpression = this.intervalExpression(rule);
    rule.scheduleSlots = [];
    this.refreshTimingDirty(rule);
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

  private intervalExpression(rule: AdminNotificationRule): string {
    const amount = this.intervalAmount(rule);
    const unit = this.intervalUnit(rule);
    const [hour, minute] = this.startTime(rule).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    if (unit === INTERVAL_UNIT.seconds) {
      return `0/${amount} * * * * ?`;
    }
    if (unit === INTERVAL_UNIT.minutes) {
      return `0 0/${amount} * * * ?`;
    }
    if (unit === INTERVAL_UNIT.hours) {
      return `0 ${minute} 0/${amount} * * ?`;
    }
    if (unit === INTERVAL_UNIT.days) {
      return `0 ${minute} ${hour} 1/${amount} * ?`;
    }
    return `@every ${amount} ${unit} @ ${this.startTime(rule)}`;
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

  protected parameterFieldsByGroup(fields: readonly AdminNotificationRuleParameter[]): {
    group: string;
    groupKey: string;
    fields: AdminNotificationRuleParameter[];
  }[] {
    const groups = new Map<string, AdminNotificationRuleParameter[]>();
    const groupKeys = new Map<string, string>();
    for (const field of fields) {
      const group = `${field.group ?? ''}`.trim() || 'General';
      if (!groupKeys.has(group)) {
        groupKeys.set(group, `${field.groupKey ?? ''}`.trim());
      }
      groups.set(group, [...(groups.get(group) ?? []), field]);
    }
    return [...groups.entries()].map(([group, groupFields]) => ({
      group,
      groupKey: groupKeys.get(group) ?? '',
      fields: groupFields
    }));
  }

  protected parameterValueLabel(field: AdminNotificationRuleParameter): string {
    if (field.valueType === 'text') {
      const value = `${field.textValue ?? ''}`.trim();
      return (field.options ?? []).find(option => option.value === value)?.label ?? value;
    }
    const value = Number(field.numberValue);
    const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
    return [formatted, `${field.unit ?? ''}`.trim()].filter(Boolean).join(' ');
  }

  protected parameterOptions(field: AdminNotificationRuleParameter): readonly AdminNotificationRuleParameterOption[] {
    return field.options ?? [];
  }

  protected updateParameterNumber(field: AdminNotificationRuleParameter, value: string): void {
    field.numberValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  protected updateParameterText(field: AdminNotificationRuleParameter, value: string): void {
    field.textValue = `${value ?? ''}`.trim();
  }

  private startRuntimeUpdates(): void {
    if (this.unsubscribeRuntimeUpdates) {
      return;
    }
    this.unsubscribeRuntimeUpdates = this.notificationsService.subscribeNotificationRuleUpdates(
      this.activeAdminId(),
      event => this.applyRuntimeEvent(event)
    );
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

  private ensureProcessRules(state: AdminNotificationCenterState): AdminNotificationCenterState {
    const existing = state.rules ?? [];
    const processRules = this.processRulesFrom(existing);
    return {
      ...state,
      rules: processRules,
      updatedDate: state.updatedDate || new Date().toISOString()
    };
  }

  private captureTimingBaselines(rules: readonly AdminNotificationRule[]): void {
    this.timingBaselineSignatures.clear();
    for (const rule of rules) {
      this.timingBaselineSignatures.set(rule.ruleKey, this.timingSignature(rule));
    }
  }

  private timingSignature(rule: AdminNotificationRule): string {
    return [
      this.startTime(rule),
      this.intervalAmount(rule),
      this.intervalUnit(rule)
    ].join('|');
  }

  private captureParameterBaselines(rules: readonly AdminNotificationRule[]): void {
    this.parameterBaselineSignatures.clear();
    for (const rule of rules) {
      this.parameterBaselineSignatures.set(rule.ruleKey, this.parameterSignature(rule));
    }
  }

  private parameterSignature(rule: AdminNotificationRule): string {
    return this.parameterSignatureFromFields(rule.parameters ?? []);
  }

  private parameterSignatureFromFields(fields: readonly AdminNotificationRuleParameter[]): string {
    return fields
      .filter(field => `${field.key ?? ''}`.trim())
      .filter(field => !OBSOLETE_NOTIFICATION_RULE_PARAMETER_KEYS.has(`${field.key ?? ''}`.trim()))
      .map(field => {
        const key = `${field.key ?? ''}`.trim();
        const valueType = field.valueType === 'text' ? 'text' : 'number';
        const value = valueType === 'text'
          ? `${field.textValue ?? ''}`.trim()
          : `${Number.isFinite(Number(field.numberValue)) ? Number(field.numberValue) : 0}`;
        return `${key}:${valueType}:${value}`;
      })
      .sort()
      .join('|');
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
    if (values.length > 0) {
      return Math.min(...values);
    }
    return Date.now() + this.intervalSeconds(rule) * 1000;
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

  private activeAdminId(fallback?: string | null): string {
    return this.userProfileStore.activeUserId().trim() || `${fallback ?? ''}`.trim();
  }

  private hasFinishedCurrentRun(rule: AdminNotificationRule): boolean {
    const startedAt = Date.parse(rule.runState.startedAtIso || '');
    const finishedAt = Date.parse(rule.runState.finishedAtIso || rule.runState.lastRunAtIso || '');
    const lastStatus = `${rule.runState.lastRunStatus || ''}`.trim().toLowerCase();
    return Number.isFinite(finishedAt)
      && (!Number.isFinite(startedAt) || finishedAt >= startedAt)
      && PROCESS_FINISHED_RUNTIME_STATUSES.has(lastStatus);
  }

  private syncPrimaryTiming(rule: AdminNotificationRule): void {
    const intervalAmount = this.intervalAmount(rule);
    const intervalUnit = this.intervalUnit(rule);
    const intervalSeconds = intervalAmount * INTERVAL_UNIT_SECONDS[intervalUnit];
    const intervalMinutes = Math.max(1, Math.ceil(intervalSeconds / 60));
    rule.timing.mode = DEFAULT_PRIMARY_TIMING.mode;
    rule.timing.time = this.startTime(rule);
    rule.timing.timezone = rule.timing.timezone || DEFAULT_RUN_WINDOW.timezone;
    rule.timing.cronExpression = this.intervalExpression(rule);
    rule.timing.intervalMinutes = intervalMinutes;
    rule.timing.intervalSeconds = intervalSeconds;
    rule.timing.intervalAmount = intervalAmount;
    rule.timing.intervalUnit = intervalUnit;
    rule.scheduleSlots = [];
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

}
