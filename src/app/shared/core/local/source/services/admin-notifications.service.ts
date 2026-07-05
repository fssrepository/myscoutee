import { Injectable, inject } from '@angular/core';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRunResult
} from '../../../contracts/admin.interface';
import { LocalAdminNotificationsRepository } from '../repositories/admin-notifications.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_NOTIFICATION_LOAD_ROUTE = '/admin/notifications';
const ADMIN_NOTIFICATION_SAVE_ROUTE = '/admin/notifications/save';
const ADMIN_NOTIFICATION_RUN_ROUTE = '/admin/notifications/run';

export interface LocalAdminNotificationDelayOptions {
  skipDemoDelay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAdminNotificationsService extends LocalRouteDelayService {
  private readonly repository = inject(LocalAdminNotificationsRepository);

  async loadNotificationCenter(options?: LocalAdminNotificationDelayOptions): Promise<AdminNotificationCenterState> {
    return await this.withAdminNotificationDelay(
      this.readNotificationCenter(),
      ADMIN_NOTIFICATION_LOAD_ROUTE,
      options
    );
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    _adminUserId?: string | null,
    options?: LocalAdminNotificationDelayOptions
  ): Promise<AdminNotificationCenterState> {
    const existing = await this.readNotificationCenter();
    const next: AdminNotificationCenterState = {
      rules: rules.map(rule => ({ ...rule })),
      emailTemplates: existing.emailTemplates,
      updatedDate: new Date().toISOString()
    };
    await this.repository.writeStore(next);
    await this.waitForAdminNotificationDelay(ADMIN_NOTIFICATION_SAVE_ROUTE, options);
    return next;
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

  async loadNotificationRuleRuntime(): Promise<AdminNotificationRule | null> {
    return null;
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
