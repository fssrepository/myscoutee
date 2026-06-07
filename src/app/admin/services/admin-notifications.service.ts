import { Injectable, inject } from '@angular/core';

import {
  AdminNotificationsService as CoreAdminNotificationsService,
  type AdminNotificationCenterState,
  type AdminNotificationDelayOptions,
  type AdminNotificationRule,
  type AdminNotificationRuleLiveEvent,
  type AdminNotificationRunResult
} from '../../shared/core';
import { AdminWorkspaceService } from './admin-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationsService {
  private readonly coreNotifications = inject(CoreAdminNotificationsService);
  private readonly workspace = inject(AdminWorkspaceService);

  notificationCenterLoadProgressWindowMs(): number {
    return this.coreNotifications.notificationCenterLoadProgressWindowMs();
  }

  async loadNotificationCenter(options?: AdminNotificationDelayOptions): Promise<AdminNotificationCenterState> {
    return await this.coreNotifications.loadNotificationCenter(this.activeAdminId(), options);
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    options?: AdminNotificationDelayOptions
  ): Promise<AdminNotificationCenterState> {
    return await this.coreNotifications.saveNotificationCenter(rules, this.activeAdminId(), options);
  }

  async runNotificationRule(ruleKey: string): Promise<AdminNotificationRunResult> {
    return await this.coreNotifications.runNotificationRule(ruleKey, this.activeAdminId());
  }

  async loadNotificationRuleRuntime(ruleKey: string): Promise<AdminNotificationRule | null> {
    return await this.coreNotifications.loadNotificationRuleRuntime(ruleKey, this.activeAdminId());
  }

  subscribeNotificationRuleUpdates(onEvent: (event: AdminNotificationRuleLiveEvent) => void): () => void {
    return this.coreNotifications.subscribeNotificationRuleUpdates(this.activeAdminId(), onEvent);
  }

  private activeAdminId(): string {
    return this.workspace.activeAdmin()?.id ?? '';
  }
}
