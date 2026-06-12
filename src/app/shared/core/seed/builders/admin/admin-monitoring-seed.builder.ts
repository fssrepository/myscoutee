import type {
  AdminMonitoringCategoryDto,
  AdminMonitoringEdgeDto,
  AdminMonitoringHealth,
  AdminMonitoringMetricDto,
  AdminMonitoringNodeDto,
  AdminMonitoringNodeKind,
  AdminMonitoringStateDto,
  AdminMonitoringTone
} from '../../../contracts/admin.interface';

export class AdminMonitoringSeedBuilder {
  static buildDefaultMonitoringState(): AdminMonitoringStateDto {
    const nowIso = new Date().toISOString();
    const node = (
      id: string,
      labelKey: string,
      icon: string,
      kind: AdminMonitoringNodeKind,
      tone: AdminMonitoringTone,
      metrics: AdminMonitoringMetricDto[]
    ): AdminMonitoringNodeDto => ({ id, labelKey, icon, kind, tone, metrics });
    const edge = (
      from: string,
      to: string,
      labelKey: string,
      tone: AdminMonitoringTone,
      volume: number
    ): AdminMonitoringEdgeDto => ({ from, to, labelKey, tone, volume });
    const category = (
      key: string,
      labelKey: string,
      summaryKey: string,
      icon: string,
      tone: AdminMonitoringTone,
      health: AdminMonitoringHealth,
      total: number,
      nodes: AdminMonitoringNodeDto[],
      edges: AdminMonitoringEdgeDto[]
    ): AdminMonitoringCategoryDto => ({ key, labelKey, summaryKey, icon, tone, health, total, nodes, edges });

    return {
      generatedAtIso: nowIso,
      source: 'demo',
      health: 'watch',
      categories: [
        category('users', 'admin.monitoring.category.users', 'admin.monitoring.category.users.summary', 'person', 'blue', 'watch', 84, [
          node('users.ui', 'admin.monitoring.node.profile.ui', 'person', 'source', 'blue', [
            this.monitoringMetric('profile-writes', 'admin.monitoring.metric.profile.writes', 84, 'blue', 'ok')
          ]),
          node('users.model', 'admin.monitoring.node.profile.model', 'badge', 'writeModel', 'green', [
            this.monitoringMetric('registered', 'admin.monitoring.metric.registered', 29, 'green', 'ok'),
            this.monitoringMetric('deleted', 'admin.monitoring.metric.deleted', 7, 'slate', 'watch')
          ]),
          node('users.status', 'admin.monitoring.node.status.propagation', 'rule', 'worker', 'gold', [
            this.monitoringMetric('status-propagation-signals', 'admin.monitoring.metric.status.propagation.signals', 12, 'gold', 'watch')
          ]),
          node('users.purge', 'admin.monitoring.node.account.purge', 'delete_sweep', 'storage', 'slate', [
            this.monitoringMetric('purge-signals', 'admin.monitoring.metric.purge.signals', 2, 'slate', 'ok')
          ])
        ], [
          edge('users.ui', 'users.model', 'admin.monitoring.edge.write.path', 'blue', 84),
          edge('users.model', 'users.status', 'admin.monitoring.edge.status.propagation', 'gold', 12),
          edge('users.status', 'users.purge', 'admin.monitoring.edge.gdpr.window', 'slate', 2)
        ]),
        category('events', 'admin.monitoring.category.events', 'admin.monitoring.category.events.summary', 'event_available', 'green', 'watch', 91, [
          node('events.ui', 'admin.monitoring.node.event.ui', 'edit_calendar', 'source', 'blue', [
            this.monitoringMetric('event-writes', 'admin.monitoring.metric.event.writes', 73, 'blue', 'ok')
          ]),
          node('events.model', 'admin.monitoring.node.event.model', 'storage', 'writeModel', 'green', [
            this.monitoringMetric('event-model', 'admin.monitoring.metric.persisted.events', 28, 'green', 'ok')
          ]),
          node('events.recompute', 'admin.monitoring.node.recompute.queue', 'sync_alt', 'queue', 'gold', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'gold', 'watch')
          ]),
          node('events.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('outbox-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('events.ui', 'events.model', 'admin.monitoring.edge.write.path', 'blue', 73),
          edge('events.model', 'events.recompute', 'admin.monitoring.edge.recompute', 'gold', 18),
          edge('events.recompute', 'events.outbox', 'admin.monitoring.edge.visible.changes', 'purple', 36)
        ]),
        category('members', 'admin.monitoring.category.members', 'admin.monitoring.category.members.summary', 'groups', 'blue', 'watch', 54, [
          node('members.ui', 'admin.monitoring.node.member.ui', 'group_add', 'source', 'blue', [
            this.monitoringMetric('member-changes', 'admin.monitoring.metric.member.changes', 37, 'blue', 'ok')
          ]),
          node('members.model', 'admin.monitoring.node.member.model', 'fact_check', 'writeModel', 'green', [
            this.monitoringMetric('accepted-members', 'admin.monitoring.metric.accepted.members', 128, 'green', 'ok')
          ]),
          node('members.inviter', 'admin.monitoring.node.auto.inviter', 'person_add', 'worker', 'gold', [
            this.monitoringMetric('invites', 'admin.monitoring.metric.invites', 17, 'gold', 'ok')
          ]),
          node('members.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('pending-notifications', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('members.ui', 'members.model', 'admin.monitoring.edge.membership.write', 'blue', 37),
          edge('members.model', 'members.inviter', 'admin.monitoring.edge.capacity.gate', 'gold', 17),
          edge('members.inviter', 'members.outbox', 'admin.monitoring.edge.invite.delivery', 'purple', 36)
        ]),
        category('assets', 'admin.monitoring.category.assets', 'admin.monitoring.category.assets.summary', 'inventory_2', 'gold', 'watch', 39, [
          node('assets.ui', 'admin.monitoring.node.asset.ui', 'inventory_2', 'source', 'gold', [
            this.monitoringMetric('asset-writes', 'admin.monitoring.metric.asset.writes', 28, 'gold', 'ok')
          ]),
          node('assets.model', 'admin.monitoring.node.asset.model', 'storage', 'writeModel', 'green', [
            this.monitoringMetric('requests', 'admin.monitoring.metric.asset.requests', 14, 'green', 'ok')
          ]),
          node('assets.recompute', 'admin.monitoring.node.recompute.queue', 'sync_alt', 'queue', 'blue', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'blue', 'watch')
          ]),
          node('assets.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('borrower-updates', 'admin.monitoring.metric.borrower.updates', 12, 'purple', 'watch')
          ])
        ], [
          edge('assets.ui', 'assets.model', 'admin.monitoring.edge.write.path', 'gold', 28),
          edge('assets.model', 'assets.recompute', 'admin.monitoring.edge.recompute', 'blue', 18),
          edge('assets.recompute', 'assets.outbox', 'admin.monitoring.edge.availability.delivery', 'purple', 12)
        ]),
        category('matching', 'admin.monitoring.category.matching', 'admin.monitoring.category.matching.summary', 'hub', 'purple', 'watch', 342, [
          node('matching.rates', 'admin.monitoring.node.rates', 'star', 'source', 'purple', [
            this.monitoringMetric('rates-synced', 'admin.monitoring.metric.rates.synced', 342, 'purple', 'ok')
          ]),
          node('matching.queue', 'admin.monitoring.node.recompute.queue', 'pending_actions', 'queue', 'gold', [
            this.monitoringMetric('recompute-pending', 'admin.monitoring.metric.recompute.pending', 18, 'gold', 'watch'),
            this.monitoringMetric('recompute-running', 'admin.monitoring.metric.recompute.running', 2, 'blue', 'ok')
          ]),
          node('matching.worker', 'admin.monitoring.node.affinity.worker', 'ssid_chart', 'worker', 'blue', [
            this.monitoringMetric('affinity-updates', 'admin.monitoring.metric.affinity.updates', 318, 'blue', 'ok')
          ]),
          node('matching.read', 'admin.monitoring.node.discovery.read.model', 'travel_explore', 'readModel', 'green', [
            this.monitoringMetric('visible-scores', 'admin.monitoring.metric.visible.scores', 318, 'green', 'ok')
          ])
        ], [
          edge('matching.rates', 'matching.queue', 'admin.monitoring.edge.recompute', 'gold', 342),
          edge('matching.queue', 'matching.worker', 'admin.monitoring.edge.worker.pickup', 'blue', 2),
          edge('matching.worker', 'matching.read', 'admin.monitoring.edge.read.model', 'green', 318)
        ]),
        category('chat', 'admin.monitoring.category.chat', 'admin.monitoring.category.chat.summary', 'forum', 'blue', 'watch', 426, [
          node('chat.ui', 'admin.monitoring.node.chat.ui', 'chat', 'source', 'blue', [
            this.monitoringMetric('messages', 'admin.monitoring.metric.messages', 417, 'blue', 'ok')
          ]),
          node('chat.stream', 'admin.monitoring.node.chat.stream', 'stream', 'writeModel', 'green', [
            this.monitoringMetric('stream-events', 'admin.monitoring.metric.stream.events', 417, 'green', 'ok')
          ]),
          node('chat.attachments', 'admin.monitoring.node.attachment.lifecycle', 'attachment', 'storage', 'gold', [
            this.monitoringMetric('attachment-checks', 'admin.monitoring.metric.attachment.checks', 23, 'gold', 'ok')
          ]),
          node('chat.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('push-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch')
          ])
        ], [
          edge('chat.ui', 'chat.stream', 'admin.monitoring.edge.write.path', 'blue', 417),
          edge('chat.stream', 'chat.attachments', 'admin.monitoring.edge.attachment.lifecycle', 'gold', 23),
          edge('chat.stream', 'chat.outbox', 'admin.monitoring.edge.push.intent', 'purple', 36)
        ]),
        category('notifications', 'admin.monitoring.category.notifications', 'admin.monitoring.category.notifications.summary', 'notifications_active', 'red', 'alert', 87, [
          node('notifications.intent', 'admin.monitoring.node.notification.intent', 'edit_notifications', 'source', 'blue', [
            this.monitoringMetric('intents', 'admin.monitoring.metric.notification.intents', 87, 'blue', 'ok')
          ]),
          node('notifications.outbox', 'admin.monitoring.node.notification.outbox', 'outbox', 'outbox', 'purple', [
            this.monitoringMetric('outbox-pending', 'admin.monitoring.metric.outbox.pending', 36, 'purple', 'watch'),
            this.monitoringMetric('outbox-failed', 'admin.monitoring.metric.outbox.failed', 3, 'red', 'alert')
          ]),
          node('notifications.firebase', 'admin.monitoring.node.firebase', 'cloud_upload', 'external', 'gold', [
            this.monitoringMetric('sent', 'admin.monitoring.metric.outbox.sent', 48, 'green', 'ok')
          ]),
          node('notifications.tokens', 'admin.monitoring.node.device.tokens', 'phonelink_ring', 'storage', 'green', [
            this.monitoringMetric('token-cleanup', 'admin.monitoring.metric.token.cleanup', 9, 'green', 'ok')
          ])
        ], [
          edge('notifications.intent', 'notifications.outbox', 'admin.monitoring.edge.outbox.persist', 'purple', 87),
          edge('notifications.outbox', 'notifications.firebase', 'admin.monitoring.edge.firebase.batch', 'gold', 48),
          edge('notifications.firebase', 'notifications.tokens', 'admin.monitoring.edge.token.cleanup', 'green', 9)
        ]),
        category('jobs', 'admin.monitoring.category.jobs', 'admin.monitoring.category.jobs.summary', 'pending_actions', 'slate', 'ok', 16, [
          node('jobs.admin', 'admin.monitoring.node.admin.ui', 'admin_panel_settings', 'source', 'slate', [
            this.monitoringMetric('admin-changes', 'admin.monitoring.metric.admin.changes', 16, 'slate', 'ok')
          ]),
          node('jobs.config', 'admin.monitoring.node.job.config', 'tune', 'writeModel', 'blue', [
            this.monitoringMetric('config-changes', 'admin.monitoring.metric.config.changes', 7, 'blue', 'ok')
          ]),
          node('jobs.scheduler', 'admin.monitoring.node.scheduler', 'schedule', 'worker', 'gold', [
            this.monitoringMetric('scheduled-triggers', 'admin.monitoring.metric.scheduled.triggers', 9, 'gold', 'ok')
          ]),
          node('jobs.audit', 'admin.monitoring.node.audit.trail', 'history', 'storage', 'green', [
            this.monitoringMetric('audit-events', 'admin.monitoring.metric.audit.events', 16, 'green', 'ok')
          ])
        ], [
          edge('jobs.admin', 'jobs.config', 'admin.monitoring.edge.config.write', 'blue', 16),
          edge('jobs.config', 'jobs.scheduler', 'admin.monitoring.edge.worker.pickup', 'gold', 9),
          edge('jobs.scheduler', 'jobs.audit', 'admin.monitoring.edge.audit', 'green', 16)
        ])
      ]
    };
  }

  private static monitoringMetric(
    key: string,
    labelKey: string,
    value: number,
    tone: AdminMonitoringTone,
    status: AdminMonitoringHealth
  ): AdminMonitoringMetricDto {
    const normalizedValue = Math.max(0, Math.trunc(Number(value) || 0));
    const valueLabel = this.compactNumber(normalizedValue);
    return {
      key,
      labelKey,
      value: normalizedValue,
      valueLabel,
      tone,
      status,
      detailRows: [{
        key: 'value',
        labelKey,
        valueLabel,
        tone
      }]
    };
  }

  private static compactNumber(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return String(value);
  }
}
