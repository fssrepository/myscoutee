import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRunHistoryEntry
} from '../../../shared/core';
import { RouteDelayService } from '../../../shared/core/base/services/route-delay.service';
import { AdminService } from '../../admin.service';

interface ProcessTab {
  key: string;
  label: string;
  icon: string;
  summary: string;
  detail: string;
}

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
  private static readonly POLL_INTERVAL_MS = 2500;

  protected readonly admin = inject(AdminService);
  private readonly routeDelay = inject(RouteDelayService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionRingPerimeter = 100;
  protected readonly loadingRingPerimeter = 100;
  protected readonly loadingProgress = signal(0);
  protected readonly runningRuleKey = signal('');
  protected readonly error = signal('');
  protected readonly state = signal<AdminNotificationCenterState | null>(null);
  protected readonly selectedRuleKey = signal('event-random-groups');
  private loadedForOpen = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressStartedAtMs = 0;

  protected readonly processTabs: ProcessTab[] = [
    {
      key: 'event-random-groups',
      label: 'Random event',
      icon: 'casino',
      summary: 'Creates balanced random groups for published events that already have accepted members.',
      detail: 'The process scans published events, reads accepted member snapshots, builds the rate graph once, and writes generated group assignments for eligible sub-events.'
    },
    {
      key: 'event-stage-materializer',
      label: 'Stage event',
      icon: 'stacked_line_chart',
      summary: 'Materializes generated groups for score and tournament event stages.',
      detail: 'The process advances score or tournament style sub-events by reading leaderboard state, resolving advancing members, and preparing the next stage groups.'
    }
  ];

  protected readonly frequencyOptions = [
    { minutes: 5, label: 'Every 5m' },
    { minutes: 15, label: 'Every 15m' },
    { minutes: 30, label: 'Every 30m' },
    { minutes: 60, label: 'Hourly' }
  ];

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'notifications') {
        this.loadedForOpen = false;
        this.error.set('');
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
      this.state.set(this.ensureProcessRules(state));
      if (!this.processTabs.some(tab => tab.key === this.selectedRuleKey())) {
        this.selectedRuleKey.set(this.processTabs[0].key);
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

  protected async save(): Promise<void> {
    const state = this.state();
    if (!state || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const [savedState] = await Promise.all([
        this.admin.saveNotificationCenter(this.processRules()),
        this.routeDelay.waitForRouteDelay('/admin/notifications/save', undefined, undefined, AdminNotificationsPopupComponent.SAVE_DEMO_DELAY_MS)
      ]);
      this.state.set(this.ensureProcessRules(savedState));
    } catch {
      this.error.set('Unable to save scheduled process settings.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleSuspended(rule: AdminNotificationRule): Promise<void> {
    rule.enabled = !rule.enabled;
    rule.runState.currentStatus = rule.enabled ? 'idle' : 'suspended';
    rule.runState.progressDetail = rule.enabled ? 'Ready for the next scheduled slot.' : 'Suspended by admin.';
    await this.save();
  }

  protected async run(rule: AdminNotificationRule): Promise<void> {
    if (!rule.manualRunEnabled || this.runningRuleKey()) {
      return;
    }
    this.runningRuleKey.set(rule.ruleKey);
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
      const result = await this.admin.runNotificationRule(rule.ruleKey);
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
    }
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected selectRule(ruleKey: string): void {
    this.selectedRuleKey.set(ruleKey);
  }

  protected selectedTab(): ProcessTab {
    return this.processTabs.find(tab => tab.key === this.selectedRuleKey()) ?? this.processTabs[0];
  }

  protected selectedRule(): AdminNotificationRule {
    return this.processRules().find(rule => rule.ruleKey === this.selectedRuleKey())
      ?? this.processRules()[0]
      ?? this.fallbackRule(this.processTabs[0]);
  }

  protected processRules(): AdminNotificationRule[] {
    const rules = this.state()?.rules ?? [];
    return this.processTabs.map(tab => rules.find(rule => rule.ruleKey === tab.key) ?? this.fallbackRule(tab));
  }

  protected statusLabel(rule: AdminNotificationRule): string {
    if (this.runningRuleKey() === rule.ruleKey || rule.runState.currentStatus === 'running') {
      return 'Running';
    }
    if (!rule.enabled || rule.runState.currentStatus === 'suspended') {
      return 'Suspended';
    }
    return 'Ready';
  }

  protected statusClass(rule: AdminNotificationRule): string {
    return `is-${this.statusLabel(rule).toLowerCase()}`;
  }

  protected progressValue(rule: AdminNotificationRule): number {
    if (this.runningRuleKey() === rule.ruleKey) {
      return Math.max(18, Math.min(92, rule.runState.progressPercent || 18));
    }
    return Math.max(0, Math.min(100, rule.runState.progressPercent || 0));
  }

  protected cronFor(rule: AdminNotificationRule): string {
    const interval = Math.max(1, Math.trunc(Number(rule.timing.intervalMinutes) || 15));
    rule.timing.cronExpression = `0 0/${interval} * * * ?`;
    return rule.timing.cronExpression;
  }

  protected setFrequency(rule: AdminNotificationRule, minutes: string | number): void {
    const interval = Math.max(1, Math.trunc(Number(minutes) || 15));
    rule.timing.mode = 'interval';
    rule.timing.intervalMinutes = interval;
    rule.timing.cronExpression = `0 0/${interval} * * * ?`;
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
    const processRules = this.processTabs.map(tab => existing.find(rule => rule.ruleKey === tab.key) ?? this.fallbackRule(tab));
    return {
      ...state,
      rules: processRules,
      updatedDate: state.updatedDate || new Date().toISOString()
    };
  }

  private fallbackRule(tab: ProcessTab): AdminNotificationRule {
    const intervalMinutes = 15;
    return {
      ruleKey: tab.key,
      label: tab.label,
      category: 'Scheduled',
      description: tab.detail,
      actionKey: tab.key === 'event-stage-materializer' ? 'event.scheduler.stage-materializer' : 'event.scheduler.random-groups',
      triggerKind: 'scheduled_process',
      enabled: false,
      manualRunEnabled: true,
      priority: tab.key === 'event-stage-materializer' ? 210 : 200,
      channels: { pushEnabled: false, emailEnabled: false, inAppEnabled: false, supportChatEnabled: false },
      timing: {
        mode: 'interval',
        delayMinutes: 0,
        intervalMinutes,
        month: 1,
        dayOfMonth: 1,
        time: '09:00',
        timezone: 'UTC',
        cronExpression: `0 0/${intervalMinutes} * * * ?`
      },
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
}
