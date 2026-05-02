export type AdminNotificationTriggerKind = 'action' | 'timed' | 'scheduled_process';
export type AdminNotificationTimingMode = 'immediate' | 'delay' | 'interval' | 'yearly' | 'manual';

export interface AdminNotificationChannels {
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  supportChatEnabled: boolean;
}

export interface AdminNotificationTiming {
  mode: AdminNotificationTimingMode;
  delayMinutes: number;
  intervalMinutes: number;
  month: number;
  dayOfMonth: number;
  time: string;
  timezone: string;
}

export interface AdminNotificationMessage {
  pushTitle: string;
  pushBody: string;
  emailTemplateKey: string;
  emailSubject: string;
  emailBody: string;
  ctaPath: string;
}

export interface AdminNotificationRunState {
  lastRunAtIso: string;
  lastRunStatus: string;
  lastRunDetail: string;
  lastRunCount: number;
  lastRunUser: string;
}

export interface AdminNotificationRule {
  id?: string | null;
  ruleKey: string;
  label: string;
  category: string;
  description: string;
  actionKey: string;
  triggerKind: AdminNotificationTriggerKind;
  enabled: boolean;
  manualRunEnabled: boolean;
  priority: number;
  channels: AdminNotificationChannels;
  timing: AdminNotificationTiming;
  message: AdminNotificationMessage;
  runState: AdminNotificationRunState;
  updatedDate?: string | null;
  updatedUser?: string | null;
}

export interface AdminNotificationTemplateOption {
  templateKey: string;
  name: string;
  category: string;
  description: string;
}

export interface AdminNotificationCenterState {
  rules: AdminNotificationRule[];
  emailTemplates: AdminNotificationTemplateOption[];
  updatedDate: string;
}

export interface AdminNotificationRunResult {
  ruleKey: string;
  label: string;
  affectedCount: number;
  status: string;
  detail: string;
  ranAtIso: string;
}
