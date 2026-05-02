import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationTimingMode,
  AdminNotificationTriggerKind
} from '../../../shared/core';
import { AdminService } from '../../admin.service';

@Component({
  selector: 'app-admin-notifications-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-notifications-popup.component.html',
  styleUrl: './admin-notifications-popup.component.scss'
})
export class AdminNotificationsPopupComponent {
  protected readonly admin = inject(AdminService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly runningRuleKey = signal('');
  protected readonly error = signal('');
  protected readonly state = signal<AdminNotificationCenterState | null>(null);
  protected readonly selectedRuleKey = signal('');
  private loadedForOpen = false;

  protected readonly triggerTabs: Array<{ key: AdminNotificationTriggerKind | 'all'; label: string; icon: string }> = [
    { key: 'all', label: 'All', icon: 'rule' },
    { key: 'action', label: 'Actions', icon: 'bolt' },
    { key: 'timed', label: 'Timed', icon: 'event_repeat' },
    { key: 'scheduled_process', label: 'Processes', icon: 'settings_suggest' }
  ];
  protected readonly activeTriggerTab = signal<AdminNotificationTriggerKind | 'all'>('all');

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'notifications') {
        this.loadedForOpen = false;
        this.error.set('');
        return;
      }
      if (!this.loadedForOpen) {
        this.loadedForOpen = true;
        void this.load();
      }
    });
  }

  protected async load(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.admin.loadNotificationCenter();
      this.state.set(state);
      this.selectedRuleKey.set(state.rules[0]?.ruleKey ?? '');
    } catch {
      this.error.set('Unable to load notification rules.');
    } finally {
      this.loading.set(false);
    }
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected rules(): AdminNotificationRule[] {
    const rules = this.state()?.rules ?? [];
    const activeTriggerTab = this.activeTriggerTab();
    return activeTriggerTab === 'all'
      ? rules
      : rules.filter(rule => rule.triggerKind === activeTriggerTab);
  }

  protected selectedRule(): AdminNotificationRule | null {
    const state = this.state();
    return state?.rules.find(rule => rule.ruleKey === this.selectedRuleKey())
      ?? state?.rules[0]
      ?? null;
  }

  protected selectRule(rule: AdminNotificationRule): void {
    this.selectedRuleKey.set(rule.ruleKey);
  }

  protected selectTriggerTab(tab: AdminNotificationTriggerKind | 'all'): void {
    this.activeTriggerTab.set(tab);
    const visible = this.rules();
    if (!visible.some(rule => rule.ruleKey === this.selectedRuleKey())) {
      this.selectedRuleKey.set(visible[0]?.ruleKey ?? '');
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
      const savedState = await this.admin.saveNotificationCenter(state.rules);
      this.state.set(savedState);
      if (!savedState.rules.some(rule => rule.ruleKey === this.selectedRuleKey())) {
        this.selectedRuleKey.set(savedState.rules[0]?.ruleKey ?? '');
      }
    } catch {
      this.error.set('Unable to save notification rules.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async run(rule: AdminNotificationRule, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!rule.manualRunEnabled || this.runningRuleKey()) {
      return;
    }
    this.runningRuleKey.set(rule.ruleKey);
    this.error.set('');
    try {
      const result = await this.admin.runNotificationRule(rule.ruleKey);
      this.patchRule(rule.ruleKey, current => ({
        ...current,
        runState: {
          lastRunAtIso: result.ranAtIso,
          lastRunStatus: result.status,
          lastRunDetail: result.detail,
          lastRunCount: result.affectedCount,
          lastRunUser: this.admin.activeAdmin()?.id ?? current.runState.lastRunUser
        },
        updatedDate: result.ranAtIso,
        updatedUser: this.admin.activeAdmin()?.id ?? current.updatedUser
      }));
    } catch {
      this.error.set(`Unable to run ${rule.label}.`);
    } finally {
      this.runningRuleKey.set('');
    }
  }

  protected setRuleEnabled(rule: AdminNotificationRule, value: boolean): void {
    rule.enabled = value;
  }

  protected setChannel(rule: AdminNotificationRule, channel: keyof AdminNotificationRule['channels'], value: boolean): void {
    rule.channels[channel] = value;
  }

  protected setTimingMode(rule: AdminNotificationRule, mode: string): void {
    rule.timing.mode = this.normalizeTimingMode(mode, rule.triggerKind);
  }

  protected triggerLabel(kind: AdminNotificationTriggerKind): string {
    switch (kind) {
      case 'timed':
        return 'Timed';
      case 'scheduled_process':
        return 'Process';
      default:
        return 'Action';
    }
  }

  protected triggerIcon(kind: AdminNotificationTriggerKind): string {
    switch (kind) {
      case 'timed':
        return 'event_repeat';
      case 'scheduled_process':
        return 'settings_suggest';
      default:
        return 'bolt';
    }
  }

  protected ruleStatusLabel(rule: AdminNotificationRule): string {
    return rule.enabled ? 'Enabled' : 'Off';
  }

  protected channelSummary(rule: AdminNotificationRule): string {
    const channels: string[] = [];
    if (rule.channels.pushEnabled) {
      channels.push('Push');
    }
    if (rule.channels.emailEnabled) {
      channels.push('Email');
    }
    if (rule.channels.inAppEnabled) {
      channels.push('In-app');
    }
    if (rule.channels.supportChatEnabled) {
      channels.push('Support');
    }
    return channels.join(' + ') || 'No channel';
  }

  protected timingLabel(rule: AdminNotificationRule): string {
    switch (rule.timing.mode) {
      case 'delay':
        return `${rule.timing.delayMinutes}m delay`;
      case 'interval':
        return `Every ${rule.timing.intervalMinutes}m`;
      case 'yearly':
        return `${this.monthLabel(rule.timing.month)} ${rule.timing.dayOfMonth} ${rule.timing.time}`;
      case 'manual':
        return 'Manual';
      default:
        return 'Immediate';
    }
  }

  protected lastRunLabel(rule: AdminNotificationRule): string {
    const value = rule.runState.lastRunAtIso;
    if (!value) {
      return 'Never';
    }
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    return new Date(parsed).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  protected runCountLabel(rule: AdminNotificationRule): string {
    return `${Math.max(0, rule.runState.lastRunCount || 0)}`;
  }

  protected canShowMessageFields(rule: AdminNotificationRule): boolean {
    return rule.triggerKind !== 'scheduled_process' || rule.channels.emailEnabled || rule.channels.pushEnabled;
  }

  protected timingModes(rule: AdminNotificationRule): AdminNotificationTimingMode[] {
    if (rule.triggerKind === 'scheduled_process') {
      return ['interval', 'yearly', 'manual'];
    }
    if (rule.triggerKind === 'timed') {
      return ['yearly', 'manual'];
    }
    return ['immediate', 'delay'];
  }

  protected monthLabel(month: number): string {
    const date = new Date(2026, Math.max(0, Math.min(11, month - 1)), 1);
    return date.toLocaleString([], { month: 'short' });
  }

  protected trackRule(_: number, rule: AdminNotificationRule): string {
    return rule.ruleKey;
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

  private normalizeTimingMode(value: string, triggerKind: AdminNotificationTriggerKind): AdminNotificationTimingMode {
    if (value === 'delay' || value === 'interval' || value === 'yearly' || value === 'manual') {
      return value;
    }
    return triggerKind === 'scheduled_process' ? 'interval' : 'immediate';
  }
}
