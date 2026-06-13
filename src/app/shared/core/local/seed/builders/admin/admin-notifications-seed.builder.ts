import type {
  AdminNotificationCenterState,
  AdminNotificationIntervalUnit,
  AdminNotificationRule,
  AdminNotificationRuleParameter,
  AdminNotificationScheduleSlot,
  AdminNotificationTemplateOption,
  AdminNotificationTimingMode,
  AdminNotificationTriggerKind
} from '../../../../contracts/admin.interface';

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

export class AdminNotificationsSeedBuilder {
  static buildDefaultNotificationCenter(): AdminNotificationCenterState {
    return {
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
          ruleKey: 'event-counter-expiry',
          label: 'admin.jobs.rule.event.counter.expiry',
          category: 'admin.jobs.category.scheduled',
          description: 'admin.jobs.rule.event.counter.expiry.description',
          actionKey: 'event.counter.expiry',
          triggerKind: 'scheduled_process',
          enabled: true,
          manualRunEnabled: false,
          adminManageable: true,
          priority: 225,
          pushEnabled: false,
          emailEnabled: false,
          timingMode: 'interval',
          intervalMinutes: 5,
          startTime: '00:00'
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
    };
  }

  private static notificationRuleParameters(ruleKey: string): AdminNotificationRuleParameter[] {
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

  private static jobNumberParam(
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

  private static defaultNotificationRule(options: {
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
    const interval = this.notificationInterval(options.intervalMinutes ?? 60);
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
      scheduleSlots: options.scheduleSlots ?? [],
      parameters: options.parameters ?? [],
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

  private static defaultNotificationTemplateOptions(): AdminNotificationTemplateOption[] {
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

  private static notificationInterval(minutesValue: number): {
    amount: number;
    unit: AdminNotificationIntervalUnit;
    seconds: number;
    minutes: number;
  } {
    const seconds = Math.max(1, Math.trunc(Number(minutesValue) || 60) * 60);
    const unit = this.fixedNotificationIntervalUnit(seconds);
    return {
      amount: Math.max(1, Math.trunc(seconds / ADMIN_NOTIFICATION_INTERVAL_SECONDS[unit])),
      unit,
      seconds,
      minutes: Math.max(1, Math.ceil(seconds / 60))
    };
  }

  private static fixedNotificationIntervalUnit(seconds: number): AdminNotificationIntervalUnit {
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

  private static intervalExpression(amountValue: number, unit: AdminNotificationIntervalUnit, time: string): string {
    const amount = Math.max(1, Math.trunc(Number(amountValue) || 1));
    const [hour, minute] = this.normalizeNotificationTime(time)
      .split(':')
      .map(value => Math.max(0, Math.trunc(Number(value) || 0)));
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

  private static normalizeNotificationTime(value: string | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : '09:00';
  }

  private static paramFieldLabelKey(fieldKey: string | null | undefined): string {
    const normalized = `${fieldKey ?? ''}`.trim();
    return normalized ? `admin.params.field.${normalized}` : '';
  }

  private static paramGroupLabelKey(group: string | null | undefined): string {
    const normalized = this.paramsI18nSegment(group);
    return normalized ? `admin.params.group.${normalized}` : 'admin.params.group.general';
  }

  private static paramStrategyLabelKey(strategy: string | null | undefined): string {
    const normalized = `${strategy ?? ''}`.trim();
    return normalized ? `admin.params.strategy.${normalized}` : '';
  }

  private static paramsI18nSegment(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US');
  }
}
