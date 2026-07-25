import { Injectable, inject } from '@angular/core';

import type {
  AdminNotificationCenterState,
  AdminNotificationProcessFilter,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRunResult
} from '../../../contracts/admin.interface';
import { LocalAdminNotificationsRepository } from '../repositories/admin-notifications.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_NOTIFICATION_LOAD_ROUTE = '/admin/notifications';
const ADMIN_NOTIFICATION_SAVE_ROUTE = '/admin/notifications/save';
const ADMIN_NOTIFICATION_RUN_ROUTE = '/admin/notifications/run';
const PROCESS_FILTER_ALL = 'all';
const PROCESS_FILTER_ACTIVE = 'active';
const PROCESS_FILTER_SUSPENDED = 'suspended';
const PROCESS_FILTER_RUNNING = 'running';
const PROCESS_FILTER_FAILED = 'failed';
const PROCESS_PROBLEM_STATUSES = new Set(['failed', 'error', 'missed', 'skipped']);

export interface LocalAdminNotificationDelayOptions {
  skipDemoDelay?: boolean;
  filter?: AdminNotificationProcessFilter | null;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAdminNotificationsService extends LocalRouteDelayService {
  private readonly repository = inject(LocalAdminNotificationsRepository);

  async loadNotificationCenter(options?: LocalAdminNotificationDelayOptions): Promise<AdminNotificationCenterState> {
    const state = await this.withAdminNotificationDelay(
      this.readNotificationCenter(),
      ADMIN_NOTIFICATION_LOAD_ROUTE,
      options
    );
    return this.applyProcessFilter(state, options?.filter);
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    _adminUserId?: string | null,
    options?: LocalAdminNotificationDelayOptions
  ): Promise<AdminNotificationCenterState> {
    const existing = await this.readNotificationCenter();
    const incomingByKey = new Map(rules.map(rule => [rule.ruleKey, rule]));
    const existingKeys = new Set(existing.rules.map(rule => rule.ruleKey));
    const mergedRules = existing.rules.map(rule => {
      const incoming = incomingByKey.get(rule.ruleKey);
      return incoming ? { ...incoming } : rule;
    });
    for (const rule of rules) {
      if (!existingKeys.has(rule.ruleKey)) {
        mergedRules.push({ ...rule });
      }
    }
    const next: AdminNotificationCenterState = {
      rules: mergedRules,
      emailTemplates: existing.emailTemplates,
      filterCounts: this.processFilterCounts(mergedRules),
      updatedDate: new Date().toISOString()
    };
    await this.repository.writeStore(next);
    await this.waitForAdminNotificationDelay(ADMIN_NOTIFICATION_SAVE_ROUTE, options);
    return this.applyProcessFilter(next, options?.filter);
  }

  async runNotificationRule(
    ruleKey: string,
    adminUserId?: string | null
  ): Promise<AdminNotificationRunResult> {
    const normalizedRuleKey = `${ruleKey ?? ''}`.trim();
    const state = await this.loadNotificationCenter({ skipDemoDelay: true });
    const nowIso = new Date().toISOString();
    const runnerUser = `${adminUserId ?? ''}`.trim() || 'demo-admin';
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
          lastRunUser: runnerUser
        },
        runHistory: [{
          id: `run-${Date.now()}`,
          trigger: 'manual',
          runnerUser,
          startedAtIso,
          finishedAtIso: nowIso,
          durationMillis: 1150,
          processedCount: count,
          status,
          detail
        }, ...(rule.runHistory ?? [])].slice(0, 12),
        updatedDate: nowIso,
        updatedUser: runnerUser
      };
    });
    const saved = await this.saveNotificationCenter(nextRules, adminUserId, { skipDemoDelay: true });
    await this.waitForRouteDelay(ADMIN_NOTIFICATION_RUN_ROUTE);
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
    if (!normalizedRuleKey) {
      return null;
    }
    const state = await this.readNotificationCenter();
    return state.rules.find(rule => rule.ruleKey === normalizedRuleKey) ?? null;
  }

  subscribeNotificationRuleUpdates(
    _adminUserId: string | null | undefined,
    _onEvent: (event: AdminNotificationRuleLiveEvent) => void
  ): () => void {
    return () => {};
  }

  private async readNotificationCenter(): Promise<AdminNotificationCenterState> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminNotificationCenterState>();
    if (!existing?.rules?.length) {
      throw new Error('Demo notification center is not bootstrapped.');
    }
    return existing;
  }

  private applyProcessFilter(
    state: AdminNotificationCenterState,
    filter: AdminNotificationProcessFilter | null | undefined
  ): AdminNotificationCenterState {
    const rules = state.rules ?? [];
    const normalizedFilter = this.normalizeProcessFilter(filter);
    return {
      ...state,
      filterCounts: this.processFilterCounts(rules),
      rules: normalizedFilter === PROCESS_FILTER_ALL
        ? rules
        : rules.filter(rule => this.matchesProcessFilter(rule, normalizedFilter))
    };
  }

  private processFilterCounts(rules: readonly AdminNotificationRule[]): Record<string, number> {
    const processRules = rules.filter(rule => rule.triggerKind === 'scheduled_process');
    return {
      [PROCESS_FILTER_ALL]: processRules.length,
      [PROCESS_FILTER_ACTIVE]: processRules.filter(rule =>
        rule.enabled && this.processStatusKind(rule) !== PROCESS_FILTER_FAILED
      ).length,
      [PROCESS_FILTER_SUSPENDED]: processRules.filter(rule =>
        this.processStatusKind(rule) === PROCESS_FILTER_SUSPENDED
      ).length,
      [PROCESS_FILTER_RUNNING]: processRules.filter(rule =>
        this.processStatusKind(rule) === PROCESS_FILTER_RUNNING
      ).length,
      [PROCESS_FILTER_FAILED]: processRules.filter(rule =>
        this.processStatusKind(rule) === PROCESS_FILTER_FAILED
      ).length
    };
  }

  private matchesProcessFilter(rule: AdminNotificationRule, filter: AdminNotificationProcessFilter): boolean {
    if (rule.triggerKind !== 'scheduled_process') {
      return false;
    }
    const status = this.processStatusKind(rule);
    if (filter === PROCESS_FILTER_ACTIVE) {
      return rule.enabled && status !== PROCESS_FILTER_FAILED;
    }
    if (filter === PROCESS_FILTER_SUSPENDED) {
      return status === PROCESS_FILTER_SUSPENDED;
    }
    if (filter === PROCESS_FILTER_RUNNING) {
      return status === PROCESS_FILTER_RUNNING;
    }
    if (filter === PROCESS_FILTER_FAILED) {
      return status === PROCESS_FILTER_FAILED;
    }
    return true;
  }

  private processStatusKind(rule: AdminNotificationRule): AdminNotificationProcessFilter | 'ready' {
    const currentStatus = `${rule.runState?.currentStatus ?? ''}`.trim().toLowerCase();
    if (currentStatus === PROCESS_FILTER_RUNNING) {
      return PROCESS_FILTER_RUNNING;
    }
    const lastStatus = `${rule.runState?.lastRunStatus || currentStatus}`.trim().toLowerCase();
    if (PROCESS_PROBLEM_STATUSES.has(lastStatus)) {
      return PROCESS_FILTER_FAILED;
    }
    if (!rule.enabled || currentStatus === PROCESS_FILTER_SUSPENDED) {
      return PROCESS_FILTER_SUSPENDED;
    }
    return 'ready';
  }

  private normalizeProcessFilter(
    filter: AdminNotificationProcessFilter | null | undefined
  ): AdminNotificationProcessFilter {
    return [
      PROCESS_FILTER_ACTIVE,
      PROCESS_FILTER_SUSPENDED,
      PROCESS_FILTER_RUNNING,
      PROCESS_FILTER_FAILED
    ].includes(filter as AdminNotificationProcessFilter)
      ? filter as AdminNotificationProcessFilter
      : PROCESS_FILTER_ALL;
  }

  private async withAdminNotificationDelay<T>(
    work: Promise<T>,
    route: string,
    options?: LocalAdminNotificationDelayOptions
  ): Promise<T> {
    if (options?.skipDemoDelay === true) {
      return await work;
    }
    const delay = this.waitForRouteDelay(route);
    try {
      const [result] = await Promise.all([work, delay]);
      return result;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async waitForAdminNotificationDelay(
    route: string,
    options?: LocalAdminNotificationDelayOptions
  ): Promise<void> {
    if (options?.skipDemoDelay === true) {
      return;
    }
    await this.waitForRouteDelay(route);
  }

  private demoScheduledRunCount(ruleKey: string): number {
    switch (ruleKey) {
      case 'event-random-groups':
        return 1;
      case 'event-auto-inviter':
        return 3;
      case 'event-tournament-review':
        return 2;
      case 'event-counter-expiry':
        return 6;
      case 'event-checkout-basket-purge':
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
}
