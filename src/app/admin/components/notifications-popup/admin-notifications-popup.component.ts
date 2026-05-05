import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRunHistoryEntry,
  AdminNotificationScheduleSlot
} from '../../../shared/core';
import { RouteDelayService } from '../../../shared/core/base/services/route-delay.service';
import { AdminService } from '../../admin.service';

interface ProcessDefinition {
  key: string;
  label: string;
  icon: string;
  summary: string;
  detail: string;
}

interface ScheduledActionOption {
  key: string;
  label: string;
  description: string;
}

type ProcessListFilter = 'all' | 'active' | 'suspended' | 'running' | 'failed';

@Component({
  selector: 'app-admin-notifications-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-notifications-popup.component.html',
  styleUrl: './admin-notifications-popup.component.scss'
})
export class AdminNotificationsPopupComponent implements OnDestroy {
  private static readonly LOAD_DEMO_DELAY_MS = 1500;
  private static readonly LOAD_PROGRESS_WINDOW_MS = 3000;
  private static readonly SAVE_DEMO_DELAY_MS = 1500;
  private static readonly ROW_ACTION_DELAY_MS = 1500;
  private static readonly POLL_INTERVAL_MS = 2500;

  protected readonly admin = inject(AdminService);
  private readonly routeDelay = inject(RouteDelayService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionRingPerimeter = 100;
  protected readonly loadingRingPerimeter = 100;
  protected readonly loadingProgress = signal(0);
  protected readonly runningRuleKey = signal('');
  protected readonly rowActionKey = signal('');
  protected readonly error = signal('');
  protected readonly state = signal<AdminNotificationCenterState | null>(null);
  protected readonly selectedRuleKey = signal('event-random-groups');
  protected readonly detailOpen = signal(false);
  protected readonly scheduleEditorOpen = signal(false);
  protected readonly processFilter = signal<ProcessListFilter>('all');
  protected readonly processFilterMenuOpen = signal(false);
  private loadedForOpen = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressStartedAtMs = 0;

  protected readonly processDefinitions: ProcessDefinition[] = [
    {
      key: 'event-random-groups',
      label: 'Random event',
      icon: 'casino',
      summary: 'Creates balanced random groups for published events that already have accepted members.',
      detail: 'The process scans published events, reads accepted member snapshots, builds the rate graph once, and writes generated group assignments for eligible sub-events.'
    }
  ];

  protected readonly scheduledActionOptions: ScheduledActionOption[] = [
    { key: '', label: 'None', description: 'No app action is executed; the process only keeps its schedule and runtime status.' },
    { key: 'event.scheduler.random-groups', label: 'Random event groups', description: 'Builds balanced generated groups for eligible published random events.' },
    { key: 'user.profile.inactivate-after-inactivity', label: 'Inactivate inactive profile', description: 'Marks a user profile inactive when the inactivity task becomes due.' },
    { key: 'event.stage.reminder', label: 'Event stage reminder', description: 'Marks stage reminders due for published event stage schedules.' }
  ];

  protected readonly processFilterOptions: Array<{ key: ProcessListFilter; label: string; icon: string }> = [
    { key: 'all', label: 'Összes', icon: 'list' },
    { key: 'active', label: 'Aktív', icon: 'play_circle' },
    { key: 'suspended', label: 'Felfüggesztett', icon: 'pause_circle' },
    { key: 'running', label: 'Fut', icon: 'sync' },
    { key: 'failed', label: 'Sikertelen', icon: 'error_outline' }
  ];

  protected readonly scheduleFrequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi-weekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'one-time', label: 'One time' }
  ] as const;

  protected readonly weekDays = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' }
  ];

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'notifications') {
        this.loadedForOpen = false;
        this.error.set('');
        this.detailOpen.set(false);
        this.scheduleEditorOpen.set(false);
        this.processFilterMenuOpen.set(false);
        this.stopPolling();
        return;
      }
      if (!this.loadedForOpen) {
        this.loadedForOpen = true;
        void this.load();
      }
      this.startPolling();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
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
      const [state] = await Promise.all([
        this.admin.loadNotificationCenter(),
        silent
          ? Promise.resolve()
          : this.routeDelay.waitForRouteDelay('/admin/notifications', undefined, undefined, AdminNotificationsPopupComponent.LOAD_DEMO_DELAY_MS)
      ]);
      if (silent) {
        this.mergeRuntimeState(state);
      } else {
        this.state.set(this.ensureProcessRules(state));
      }
      if (!this.processRules().some(rule => rule.ruleKey === this.selectedRuleKey())) {
        this.selectedRuleKey.set(this.processRules()[0]?.ruleKey ?? 'event-random-groups');
      }
    } catch {
      if (!silent) {
        this.error.set('Unable to load scheduled processes.');
      }
    } finally {
      if (!silent) {
        this.loading.set(false);
        this.endLoadingProgress();
      }
    }
  }

  protected async save(): Promise<boolean> {
    const state = this.state();
    if (!state || this.saving()) {
      return false;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const [savedState] = await Promise.all([
        this.admin.saveNotificationCenter(this.processRules()),
        this.routeDelay.waitForRouteDelay('/admin/notifications/save', undefined, undefined, AdminNotificationsPopupComponent.SAVE_DEMO_DELAY_MS)
      ]);
      this.state.set(this.ensureProcessRules(savedState));
      return true;
    } catch {
      this.error.set('Unable to save scheduled process settings.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveAndCloseDetail(): Promise<void> {
    const saved = await this.save();
    if (saved) {
      this.closeDetail();
    }
  }

  protected async toggleSuspended(rule: AdminNotificationRule): Promise<void> {
    if (this.rowActionKey()) {
      return;
    }
    this.rowActionKey.set(`${rule.ruleKey}:suspend`);
    try {
      rule.enabled = !rule.enabled;
      rule.runState.currentStatus = rule.enabled ? 'idle' : 'suspended';
      rule.runState.progressDetail = rule.enabled ? 'Ready for the next scheduled slot.' : 'Suspended by admin.';
      await this.save();
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
    this.patchRule(rule.ruleKey, current => ({
      ...current,
      runState: {
        ...current.runState,
        currentStatus: 'running',
        progressPercent: 18,
        progressDetail: 'Manual run started.',
        startedAtIso: new Date().toISOString(),
        finishedAtIso: '',
        durationMillis: 0
      }
    }));
    try {
      const [result] = await Promise.all([
        this.admin.runNotificationRule(rule.ruleKey),
        this.routeDelay.waitForRouteDelay('/admin/notifications/run', undefined, undefined, AdminNotificationsPopupComponent.ROW_ACTION_DELAY_MS)
      ]);
      const finishedAtIso = result.ranAtIso || new Date().toISOString();
      this.patchRule(rule.ruleKey, current => {
        const startedAtIso = current.runState.startedAtIso || finishedAtIso;
        const durationMillis = this.durationBetween(startedAtIso, finishedAtIso);
        const entry: AdminNotificationRunHistoryEntry = {
          id: `run-${Date.now()}`,
          trigger: 'manual',
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
            progressPercent: 100,
            progressDetail: result.detail,
            finishedAtIso,
            durationMillis,
            lastRunAtIso: finishedAtIso,
            lastRunStatus: result.status,
            lastRunDetail: result.detail,
            lastRunCount: result.affectedCount,
            lastRunUser: this.admin.activeAdmin()?.id ?? current.runState.lastRunUser
          },
          runHistory: [entry, ...(current.runHistory ?? [])].slice(0, 12),
          updatedDate: finishedAtIso,
          updatedUser: this.admin.activeAdmin()?.id ?? current.updatedUser
        };
      });
      void this.load(true);
    } catch {
      this.error.set(`Unable to run ${rule.label}.`);
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

  protected selectedProcessDefinition(): ProcessDefinition {
    return this.processDefinition(this.selectedRule());
  }

  protected selectedRule(): AdminNotificationRule {
    return this.processRules().find(rule => rule.ruleKey === this.selectedRuleKey())
      ?? this.processRules()[0]
      ?? this.fallbackRule(this.processDefinitions[0]);
  }

  protected processRules(): AdminNotificationRule[] {
    const rules = this.state()?.rules ?? [];
    const existingProcessRules = rules.filter(rule => rule.triggerKind === 'scheduled_process');
    const rulesByKey = new Map(existingProcessRules.map(rule => [rule.ruleKey, rule] as const));
    for (const definition of this.processDefinitions) {
      if (!rulesByKey.has(definition.key)) {
        rulesByKey.set(definition.key, this.fallbackRule(definition));
      }
    }
    return this.sortProcessRules([...rulesByKey.values()]);
  }

  protected filteredProcessRules(): AdminNotificationRule[] {
    const filter = this.processFilter();
    return this.sortFilteredProcessRules(
      this.processRules().filter(rule => this.matchesProcessFilter(rule, filter)),
      filter
    );
  }

  protected processFilterLabel(filter: ProcessListFilter = this.processFilter()): string {
    return this.processFilterOptions.find(option => option.key === filter)?.label ?? 'Összes';
  }

  protected processFilterIcon(filter: ProcessListFilter = this.processFilter()): string {
    return this.processFilterOptions.find(option => option.key === filter)?.icon ?? 'list';
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
    const status = this.statusLabel(rule).toLowerCase();
    if (filter === 'active') {
      return rule.enabled && status !== 'failed' && status !== 'missed';
    }
    if (filter === 'suspended') {
      return status === 'suspended';
    }
    if (filter === 'running') {
      return status === 'running';
    }
    if (filter === 'failed') {
      return status === 'failed' || status === 'missed';
    }
    return true;
  }

  protected processDefinition(rule: AdminNotificationRule): ProcessDefinition {
    return this.processDefinitions.find(definition => definition.key === rule.ruleKey) ?? {
      key: rule.ruleKey,
      label: rule.label || rule.ruleKey,
      icon: 'settings_suggest',
      summary: rule.description || 'Scheduled process configured by the server.',
      detail: rule.description || 'This scheduled process is loaded from configuration and can be monitored or adjusted here.'
    };
  }

  protected statusLabel(rule: AdminNotificationRule): string {
    if (this.runningRuleKey() === rule.ruleKey || rule.runState.currentStatus === 'running') {
      return 'Running';
    }
    const lastStatus = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    if (['failed', 'error'].includes(lastStatus)) {
      return 'Failed';
    }
    if (['missed', 'skipped'].includes(lastStatus)) {
      return 'Missed';
    }
    if (!rule.enabled || rule.runState.currentStatus === 'suspended') {
      return 'Suspended';
    }
    return 'Ready';
  }

  protected statusClass(rule: AdminNotificationRule): string {
    return `is-${this.statusLabel(rule).toLowerCase()}`;
  }

  protected isRowActionPending(rule: AdminNotificationRule, action: 'suspend' | 'run'): boolean {
    return this.rowActionKey() === `${rule.ruleKey}:${action}`;
  }

  protected progressValue(rule: AdminNotificationRule): number {
    if (this.runningRuleKey() === rule.ruleKey) {
      return Math.max(18, Math.min(92, rule.runState.progressPercent || 18));
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
    this.stopPolling();
    this.scheduleEditorOpen.set(true);
  }

  protected closeScheduleEditor(): void {
    this.scheduleEditorOpen.set(false);
    if (this.admin.activePopup() === 'notifications') {
      this.startPolling();
    }
  }

  protected async saveScheduleEditor(): Promise<void> {
    this.syncPrimaryTiming(this.selectedRule());
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

  protected runWindowSummary(rule: AdminNotificationRule): string {
    const windows = this.runWindows(rule).filter(slot => slot.enabled !== false);
    if (windows.length === 0) {
      return 'No active run windows';
    }
    return windows.map(slot => this.runWindowLabel(slot)).join(' · ');
  }

  protected runWindowLabel(slot: AdminNotificationScheduleSlot): string {
    const time = this.normalizeTime(slot.time);
    if (slot.frequency === 'one-time') {
      return `${slot.date || 'One-time date'} at ${time}`;
    }
    if (slot.frequency === 'yearly') {
      return `Yearly ${this.monthDayLabel(slot.date)} at ${time}`;
    }
    if (slot.frequency === 'monthly') {
      return `Monthly on day ${this.dayOfMonth(slot.date)} at ${time}`;
    }
    if (slot.frequency === 'bi-weekly') {
      return `Bi-weekly ${this.weekDayLabel(slot.dayOfWeek)} at ${time}`;
    }
    if (slot.frequency === 'weekly') {
      return `Weekly ${this.weekDayLabel(slot.dayOfWeek)} at ${time}`;
    }
    return `Daily at ${time}`;
  }

  protected cronForSlot(slot: AdminNotificationScheduleSlot): string {
    const [hour, minute] = this.normalizeTime(slot.time).split(':').map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    if (slot.frequency === 'weekly') {
      const quartzDay = (Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1))) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (slot.frequency === 'bi-weekly') {
      const quartzDay = (Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1))) % 7) + 1;
      return `0 ${minute} ${hour} ? * ${quartzDay}`;
    }
    if (slot.frequency === 'monthly') {
      return `0 ${minute} ${hour} ${this.dayOfMonth(slot.date)} * ?`;
    }
    if (slot.frequency === 'yearly') {
      const parsed = this.monthDayParts(slot.date);
      return `0 ${minute} ${hour} ${parsed.day} ${parsed.month} ?`;
    }
    if (slot.frequency === 'one-time' && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || '')) {
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
      return value || 'Never';
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

  protected affectedLabel(count: number): string {
    const value = Math.max(0, Math.trunc(Number(count) || 0));
    return `${value} affected`;
  }

  protected actionLabel(actionKey: string): string {
    const normalized = `${actionKey || ''}`.trim();
    return this.scheduledActionOptions.find(option => option.key === normalized)?.label
      ?? (normalized || 'None');
  }

  protected actionDescription(actionKey: string): string {
    const normalized = `${actionKey || ''}`.trim();
    return this.scheduledActionOptions.find(option => option.key === normalized)?.description
      ?? 'Custom action key loaded from server configuration.';
  }

  protected updateActionKey(rule: AdminNotificationRule, value: string): void {
    rule.actionKey = `${value || ''}`.trim();
  }

  protected loadingRingDashOffset(): number {
    return this.loadingRingPerimeter * (1 - Math.min(1, Math.max(0, this.loadingProgress())));
  }

  private startPolling(): void {
    if (this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => void this.load(true), AdminNotificationsPopupComponent.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (!this.pollTimer) {
      return;
    }
    clearInterval(this.pollTimer);
    this.pollTimer = null;
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
    this.loadingProgress.set(Math.min(0.96, elapsedMs / AdminNotificationsPopupComponent.LOAD_PROGRESS_WINDOW_MS));
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
    const rulesByKey = new Map(
      rules
        .filter(rule => rule.triggerKind === 'scheduled_process')
        .map(rule => [rule.ruleKey, rule] as const)
    );
    for (const definition of this.processDefinitions) {
      if (!rulesByKey.has(definition.key)) {
        rulesByKey.set(definition.key, this.fallbackRule(definition));
      }
    }
    return this.sortProcessRules([...rulesByKey.values()]);
  }

  private sortProcessRules(rules: AdminNotificationRule[]): AdminNotificationRule[] {
    return rules.sort((left, right) =>
      (left.priority || 1000) - (right.priority || 1000)
      || left.label.localeCompare(right.label)
      || left.ruleKey.localeCompare(right.ruleKey)
    );
  }

  private sortFilteredProcessRules(rules: AdminNotificationRule[], filter: ProcessListFilter): AdminNotificationRule[] {
    if (filter === 'active' || filter === 'running') {
      return rules.sort((left, right) =>
        this.nextRunSortValue(left) - this.nextRunSortValue(right)
        || this.processStableSort(left, right)
      );
    }
    if (filter === 'failed') {
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
      .filter(entry => ['failed', 'error', 'missed', 'skipped'].includes(`${entry.status || ''}`.trim().toLowerCase()))
      .map(entry => this.parseDateSortValue(entry.finishedAtIso || entry.startedAtIso)));
    if (historyValue > 0) {
      return historyValue;
    }
    const lastStatus = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    return ['failed', 'error', 'missed', 'skipped'].includes(lastStatus)
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
    if (slot.frequency === 'one-time' && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || '')) {
      return dateTime(new Date(`${slot.date}T00:00:00`));
    }
    const today = new Date();
    if (slot.frequency === 'weekly' || slot.frequency === 'bi-weekly') {
      const targetDay = Math.max(1, Math.min(7, Math.trunc(Number(slot.dayOfWeek) || 1)));
      const currentDay = today.getDay() === 0 ? 7 : today.getDay();
      const offsetDays = (targetDay - currentDay + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + offsetDays);
      const value = dateTime(next);
      return value >= Date.now() ? value : value + 7 * 24 * 60 * 60 * 1000;
    }
    if (slot.frequency === 'monthly' || slot.frequency === 'yearly') {
      const { month, day } = this.monthDayParts(slot.date);
      const next = new Date(today);
      next.setDate(Math.min(day, 28));
      if (slot.frequency === 'yearly') {
        next.setMonth(month - 1, Math.min(day, 28));
      }
      let value = dateTime(next);
      if (value < Date.now()) {
        if (slot.frequency === 'yearly') {
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

  private fallbackRule(tab: ProcessDefinition): AdminNotificationRule {
    const firstWindow = this.newRunWindow();
    return {
      ruleKey: tab.key,
      label: tab.label,
      category: 'Scheduled',
      description: tab.detail,
      actionKey: 'event.scheduler.random-groups',
      triggerKind: 'scheduled_process',
      enabled: false,
      manualRunEnabled: true,
      priority: 200,
      channels: { pushEnabled: false, emailEnabled: false, inAppEnabled: false, supportChatEnabled: false },
      timing: {
        mode: 'interval',
        delayMinutes: 0,
        intervalMinutes: 1440,
        month: 1,
        dayOfMonth: 1,
        time: '09:00',
        timezone: 'UTC',
        cronExpression: firstWindow.cronExpression
      },
      scheduleSlots: [firstWindow],
      message: { pushTitle: '', pushBody: '', emailTemplateKey: '', emailSubject: '', emailBody: '', ctaPath: '/game' },
      runState: {
        currentStatus: 'suspended',
        progressPercent: 0,
        progressDetail: 'Suspended by default.',
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

  private durationBetween(startedAtIso: string, finishedAtIso: string): number {
    const started = Date.parse(startedAtIso || '');
    const finished = Date.parse(finishedAtIso || '');
    return Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : 0;
  }

  private newRunWindow(): AdminNotificationScheduleSlot {
    const slot: AdminNotificationScheduleSlot = {
      id: `run-window-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      frequency: 'daily',
      date: this.todayIsoDate(),
      dayOfWeek: 1,
      time: '09:00',
      timezone: 'UTC',
      cronExpression: '',
      enabled: true
    };
    slot.cronExpression = this.cronForSlot(slot);
    return slot;
  }

  private syncPrimaryTiming(rule: AdminNotificationRule): void {
    const first = this.runWindows(rule)[0];
    rule.timing.mode = 'interval';
    rule.timing.time = this.normalizeTime(first.time);
    rule.timing.timezone = first.timezone || 'UTC';
    rule.timing.cronExpression = first.cronExpression || this.cronForSlot(first);
    rule.timing.intervalMinutes = 1440;
  }

  private isLastRunProblem(rule: AdminNotificationRule): boolean {
    const status = `${rule.runState.lastRunStatus || rule.runState.currentStatus || ''}`.trim().toLowerCase();
    return ['failed', 'missed', 'error', 'skipped'].includes(status);
  }

  private weekDayLabel(value: number): string {
    return this.weekDays.find(day => day.value === Math.max(1, Math.min(7, Math.trunc(Number(value) || 1))))?.label ?? 'Monday';
  }

  private dayOfMonth(value: string): number {
    return this.monthDayParts(value).day;
  }

  private monthDayLabel(value: string): string {
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
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : '09:00';
  }

  private todayIsoDate(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
