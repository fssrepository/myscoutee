import { Injectable, inject } from '@angular/core';

import type {
  AdminNotificationCenterState,
  AdminNotificationIntervalUnit,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRuleParameter,
  AdminNotificationRuleParameterOption,
  AdminNotificationRuleParameterValueType,
  AdminNotificationRunResult,
  AdminNotificationScheduleSlot,
  AdminNotificationTimingMode,
  AdminNotificationTriggerKind
} from '../../contracts/admin.interface';
import { HttpAdminNotificationsService } from '../../http/services/admin-notifications.service';
import {
  LocalAdminNotificationsService,
  type LocalAdminNotificationDelayOptions
} from '../../local/source/services/admin-notifications.service';
import { BaseRouteModeService } from './base-route-mode.service';
import { RouteDelayService } from './route-delay.service';

const ADMIN_NOTIFICATION_ROUTE = '/admin/notifications';
const ADMIN_NOTIFICATION_LOAD_ROUTE = '/admin/notifications';
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

export interface AdminNotificationDelayOptions {
  skipDemoDelay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationsService extends BaseRouteModeService {
  private readonly localService = inject(LocalAdminNotificationsService);
  private readonly httpService = inject(HttpAdminNotificationsService);
  private readonly routeDelay = inject(RouteDelayService);

  private get notificationService(): LocalAdminNotificationsService | HttpAdminNotificationsService {
    return this.resolveRouteService(ADMIN_NOTIFICATION_ROUTE, this.localService, this.httpService);
  }

  notificationCenterLoadProgressWindowMs(): number {
    return this.routeDelay.resolveRequestTimeoutMs(ADMIN_NOTIFICATION_LOAD_ROUTE);
  }

  async loadNotificationCenter(
    adminUserId?: string | null,
    options?: AdminNotificationDelayOptions
  ): Promise<AdminNotificationCenterState> {
    const state = this.notificationService instanceof LocalAdminNotificationsService
      ? await this.notificationService.loadNotificationCenter(options)
      : await this.notificationService.loadNotificationCenter(adminUserId);
    return this.normalizeNotificationCenter(state);
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    adminUserId?: string | null,
    options?: AdminNotificationDelayOptions
  ): Promise<AdminNotificationCenterState> {
    const normalizedRules = rules.map(rule => this.normalizeNotificationRule(rule));
    const state = this.notificationService instanceof LocalAdminNotificationsService
      ? await this.notificationService.saveNotificationCenter(normalizedRules, adminUserId, options as LocalAdminNotificationDelayOptions)
      : await this.notificationService.saveNotificationCenter(normalizedRules, adminUserId);
    return this.normalizeNotificationCenter(state);
  }

  async runNotificationRule(
    ruleKey: string,
    adminUserId?: string | null
  ): Promise<AdminNotificationRunResult> {
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
    const result = await this.notificationService.runNotificationRule(normalizedRuleKey, adminUserId);
    return this.normalizeNotificationRunResult(result, normalizedRuleKey);
  }

  async loadNotificationRuleRuntime(
    ruleKey: string,
    adminUserId?: string | null
  ): Promise<AdminNotificationRule | null> {
    const normalizedRuleKey = `${ruleKey ?? ''}`.trim();
    if (!normalizedRuleKey) {
      return null;
    }
    const rule = await this.notificationService.loadNotificationRuleRuntime(normalizedRuleKey, adminUserId);
    return rule ? this.normalizeNotificationRule(rule) : null;
  }

  subscribeNotificationRuleUpdates(
    adminUserId: string | null | undefined,
    onEvent: (event: AdminNotificationRuleLiveEvent) => void
  ): () => void {
    return this.notificationService.subscribeNotificationRuleUpdates(
      adminUserId,
      event => onEvent(this.normalizeNotificationRuleLiveEvent(event))
    );
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

  private defaultScheduleSlots(_timingMode: AdminNotificationTimingMode): NonNullable<AdminNotificationRule['scheduleSlots']> {
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

  private normalizeAdminManageable(rule: AdminNotificationRule): boolean {
    const raw = (rule as AdminNotificationRule & { adminManageable?: unknown }).adminManageable;
    if (raw !== undefined && raw !== null) {
      return raw === true;
    }
    return false;
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

  private paramsI18nSegment(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US');
  }

  private clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }
}
