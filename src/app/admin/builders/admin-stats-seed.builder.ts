import type {
  AdminSeedStatsBreakdownItemDto,
  AdminSeedStatsDashboardDto,
  AdminSeedStatsMetricDto,
  AdminSeedStatsRevenueTimelinePointDto,
  AdminSeedStatsSegmentDto,
  AdminSeedStatsTimelinePointDto
} from './admin-seed.models';

export class AdminStatsSeedBuilder {
  static buildSeedDemoStatsSnapshot(): AdminSeedStatsDashboardDto {
    const nowIso = new Date().toISOString();
    const segment = (
      key: string,
      labelKey: string,
      icon: string,
      total: number,
      healthPercent: number,
      items: AdminSeedStatsBreakdownItemDto[]
    ): AdminSeedStatsSegmentDto => ({
      key,
      labelKey,
      icon,
      total,
      healthPercent,
      summaryKey: 'stats.segment.summary',
      items
    });
    const item = (
      key: string,
      labelKey: string,
      value: number,
      total: number,
      icon: string,
      tone: AdminSeedStatsMetricDto['tone']
    ): AdminSeedStatsBreakdownItemDto => ({ key, labelKey, value, total, icon, tone });
    const metric = (
      key: string,
      labelKey: string,
      value: number,
      valueLabel: string,
      icon: string,
      tone: AdminSeedStatsMetricDto['tone'],
      percent: number
    ): AdminSeedStatsMetricDto => ({ key, labelKey, value, valueLabel, icon, tone, percent });
    const timeline: AdminSeedStatsTimelinePointDto[] = [
      ['2026-04-28', 'Apr 28', 3, 24, 18, 4, 2, 38, 1],
      ['2026-04-29', 'Apr 29', 5, 31, 22, 6, 3, 44, 2],
      ['2026-04-30', 'Apr 30', 4, 29, 28, 5, 4, 47, 1],
      ['2026-05-01', 'May 1', 8, 36, 32, 8, 4, 62, 3],
      ['2026-05-02', 'May 2', 6, 42, 38, 7, 5, 71, 2],
      ['2026-05-03', 'May 3', 4, 39, 35, 5, 3, 64, 1],
      ['2026-05-04', 'May 4', 7, 46, 44, 9, 6, 83, 2],
      ['2026-05-05', 'May 5', 9, 51, 49, 8, 5, 94, 4],
      ['2026-05-06', 'May 6', 5, 47, 43, 6, 4, 86, 2],
      ['2026-05-07', 'May 7', 6, 53, 56, 10, 7, 103, 3],
      ['2026-05-08', 'May 8', 4, 49, 48, 7, 5, 91, 2],
      ['2026-05-09', 'May 9', 7, 57, 61, 11, 6, 117, 4],
      ['2026-05-10', 'May 10', 5, 54, 52, 8, 5, 99, 1],
      ['2026-05-11', 'May 11', 6, 42, 36, 5, 3, 72, 2]
    ].map(([dateKey, label, registrations, activeUsers, ratings, events, assets, messages, moderation]) => ({
      dateKey: `${dateKey}`,
      label: `${label}`,
      registrations: Number(registrations),
      activeUsers: Number(activeUsers),
      ratings: Number(ratings),
      events: Number(events),
      assets: Number(assets),
      messages: Number(messages),
      moderation: Number(moderation)
    }));
    const revenueTimeline: AdminSeedStatsRevenueTimelinePointDto[] = [
      ['2026-04-28', 'Apr 28', 1, 1, 18000, 12000, 0, 0],
      ['2026-04-29', 'Apr 29', 1, 2, 12500, 22000, 4200, 2],
      ['2026-04-30', 'Apr 30', 0, 1, 0, 9500, 3800, 1],
      ['2026-05-01', 'May 1', 2, 1, 26000, 18000, 6200, 3],
      ['2026-05-02', 'May 2', 1, 2, 14500, 24000, 5300, 2],
      ['2026-05-03', 'May 3', 0, 1, 0, 8500, 0, 0],
      ['2026-05-04', 'May 4', 2, 1, 31000, 13000, 7800, 4],
      ['2026-05-05', 'May 5', 1, 1, 16500, 16000, 2900, 1],
      ['2026-05-06', 'May 6', 0, 2, 0, 28000, 6100, 3],
      ['2026-05-07', 'May 7', 2, 1, 27500, 14000, 4500, 2],
      ['2026-05-08', 'May 8', 1, 0, 15500, 0, 0, 0],
      ['2026-05-09', 'May 9', 1, 2, 21000, 34000, 8200, 3],
      ['2026-05-10', 'May 10', 0, 1, 0, 15000, 3200, 1],
      ['2026-05-11', 'May 11', 0, 0, 0, 0, 0, 0]
    ].map(([dateKey, label, payableEvents, payableAssets, projectedEventCents, projectedAssetCents, actualPaymentCents, payingUsers]) => ({
      dateKey: `${dateKey}`,
      label: `${label}`,
      payableEvents: Number(payableEvents),
      payableAssets: Number(payableAssets),
      projectedEventCents: Number(projectedEventCents),
      projectedAssetCents: Number(projectedAssetCents),
      actualPaymentCents: Number(actualPaymentCents),
      payingUsers: Number(payingUsers)
    }));

    return {
      generatedAtIso: nowIso,
      source: 'demo',
      healthScore: 84,
      healthLabelKey: 'stats.health.good',
      healthSummaryKey: 'stats.health.summary',
      kpis: [
        { key: 'active-profiles', labelKey: 'stats.kpi.active.profiles', value: 112, valueLabel: '112', caption: 'Public 58 · Friends 38 · Host 16', icon: 'groups', tone: 'green', percent: 88 },
        { key: 'onboarding-users', labelKey: 'stats.kpi.onboarding.users', value: 9, valueLabel: '9', icon: 'how_to_reg', tone: 'gold', percent: 7 },
        { key: 'inactive-profiles', labelKey: 'stats.kpi.inactive.profiles', value: 7, valueLabel: '7', icon: 'visibility_off', tone: 'slate', percent: 5 },
        { key: 'active-users', labelKey: 'stats.kpi.active.users', value: 42, valueLabel: '42', icon: 'person', tone: 'blue', percent: 33 },
        { key: 'returning-users', labelKey: 'stats.kpi.returning.users', value: 31, valueLabel: '31', icon: 'repeat', tone: 'purple', percent: 24 },
        { key: 'departed-users', labelKey: 'stats.kpi.departed.users', value: 7, valueLabel: '7', icon: 'person_remove', tone: 'slate', percent: 5 },
        { key: 'active-events', labelKey: 'stats.kpi.active.events', value: 18, valueLabel: '18', icon: 'event_available', tone: 'green', percent: 45 },
        { key: 'active-assets', labelKey: 'stats.kpi.active.assets', value: 27, valueLabel: '27', icon: 'inventory_2', tone: 'gold', percent: 68 },
        { key: 'moderation-pressure', labelKey: 'stats.kpi.moderation.pressure', value: 14, valueLabel: '14', icon: 'shield', tone: 'red', percent: 18 }
      ],
      segments: [
        segment('community', 'stats.segment.community', 'person', 128, 88, [
          item('profile.registered', 'stats.event.profile.registered', 29, 128, 'person_add', 'green'),
          item('profile.active', 'stats.event.profile.active', 112, 128, 'groups', 'green'),
          item('profile.onboarding', 'stats.event.profile.onboarding', 9, 128, 'how_to_reg', 'gold'),
          item('profile.inactive', 'stats.event.profile.inactive', 7, 128, 'visibility_off', 'slate'),
          item('active-users-7d', 'stats.event.active.users.7d', 42, 128, 'person', 'blue'),
          item('active-users-30d', 'stats.event.active.users.30d', 68, 128, 'calendar_month', 'green'),
          item('returning-users', 'stats.event.returning.users', 31, 128, 'repeat', 'purple'),
          item('profile.deleted', 'stats.event.profile.deleted', 7, 135, 'person_remove', 'slate'),
          item('deleted-median-days', 'stats.event.deleted.median.days', 46, 46, 'timer', 'gold'),
          item('profile-fill-average', 'stats.event.profile.fill.average', 74, 100, 'fact_check', 'gold'),
          item('tried-users', 'stats.event.tried.users', 128, 128, 'group', 'slate')
        ]),
        segment('matching', 'stats.segment.matching', 'hub', 342, 83, [
          item('rates.synced', 'stats.event.rates.synced', 342, 342, 'star', 'gold')
        ]),
        segment('activities', 'stats.segment.activities', 'event_available', 91, 76, [
          item('active-events', 'stats.event.active.events', 18, 91, 'event_available', 'green'),
          item('all-events', 'stats.event.all.events', 28, 91, 'event', 'blue'),
          item('active-assets', 'stats.event.active.assets', 27, 91, 'inventory_2', 'gold'),
          item('all-assets', 'stats.event.all.assets', 39, 91, 'category', 'purple'),
          item('event.members.changed', 'stats.event.event.members.changed', 37, 91, 'groups', 'green'),
          item('asset.requests.changed', 'stats.event.asset.requests.changed', 14, 91, 'handshake', 'gold')
        ]),
        segment('communication', 'stats.segment.communication', 'chat', 426, 81, [
          item('chat.message.sent', 'stats.event.chat.message.sent', 417, 426, 'forum', 'blue'),
          item('admin.user.warned', 'stats.event.admin.user.warned', 9, 426, 'warning', 'gold')
        ]),
        segment('moderation', 'stats.segment.moderation', 'shield', 14, 62, [
          item('report.submitted', 'stats.event.report.submitted', 8, 14, 'report', 'red'),
          item('feedback.submitted', 'stats.event.feedback.submitted', 4, 14, 'feedback', 'purple'),
          item('admin.user.blocked', 'stats.event.admin.user.blocked', 2, 14, 'block', 'red')
        ])
      ],
      attention: [],
      topCities: [
        { key: 'austin', labelKey: '', label: 'Austin', value: 34, total: 128, icon: 'location_on', tone: 'blue' },
        { key: 'seattle', labelKey: '', label: 'Seattle', value: 29, total: 128, icon: 'location_on', tone: 'green' },
        { key: 'denver', labelKey: '', label: 'Denver', value: 23, total: 128, icon: 'location_on', tone: 'purple' },
        { key: 'miami', labelKey: '', label: 'Miami', value: 18, total: 128, icon: 'location_on', tone: 'gold' }
      ],
      topTopics: [
        { key: 'outdoors', labelKey: '', label: 'Outdoors', value: 38, total: 112, icon: 'local_offer', tone: 'green' },
        { key: 'music', labelKey: '', label: 'Music', value: 31, total: 112, icon: 'local_offer', tone: 'purple' },
        { key: 'board-games', labelKey: '', label: 'Board games', value: 24, total: 112, icon: 'local_offer', tone: 'blue' },
        { key: 'fitness', labelKey: '', label: 'Fitness', value: 19, total: 112, icon: 'local_offer', tone: 'gold' }
      ],
      timeline,
      eventTypes: [
        { key: 'simple', labelKey: '', label: 'Simple', value: 14, total: 47, icon: 'category', tone: 'blue' },
        { key: 'organized', labelKey: '', label: 'Organized', value: 10, total: 47, icon: 'category', tone: 'green' },
        { key: 'matched-rooms', labelKey: '', label: 'Matched rooms', value: 8, total: 47, icon: 'hub', tone: 'purple' },
        { key: 'recurring', labelKey: '', label: 'Recurring', value: 6, total: 47, icon: 'event_repeat', tone: 'gold' },
        { key: 'multi-slot', labelKey: '', label: 'Multi-slot', value: 5, total: 47, icon: 'view_timeline', tone: 'green' },
        { key: 'tournament', labelKey: '', label: 'Tournament', value: 4, total: 47, icon: 'emoji_events', tone: 'red' }
      ],
      activityMix: [
        item('profiles', 'stats.domain.profiles', 128, 1001, 'person', 'blue'),
        item('matching', 'stats.domain.matching', 342, 1001, 'hub', 'purple'),
        item('events', 'stats.domain.events', 73, 1001, 'event', 'green'),
        item('assets', 'stats.domain.assets', 18, 1001, 'inventory_2', 'gold'),
        item('chats', 'stats.domain.chats', 426, 1001, 'chat', 'blue'),
        item('moderation', 'stats.domain.moderation', 14, 1001, 'shield', 'red')
      ],
      graph: {
        healthScore: 78,
        healthLabelKey: 'stats.graph.health.watch',
        insightKey: 'stats.graph.insight.healthy',
        metrics: [
          metric('graph-health', 'stats.graph.metric.health', 78, '78', 'monitoring', 'green', 78),
          metric('graph-users', 'stats.graph.metric.users', 42, '42', 'person', 'blue', 100),
          metric('graph-edges', 'stats.graph.metric.edges', 116, '116', 'share', 'purple', 92),
          metric('graph-avg-degree', 'stats.graph.metric.avg.degree', 55, '5.5', 'hub', 'gold', 100),
          metric('graph-communities', 'stats.graph.metric.communities', 6, '6', 'bubble_chart', 'green', 57),
          metric('graph-bridges', 'stats.graph.metric.bridges', 8, '8', 'conversion_path', 'red', 100),
          metric('graph-network-quality', 'stats.graph.metric.network.quality', 64, '64%', 'ssid_chart', 'blue', 64),
          metric('graph-cluster-quality', 'stats.graph.metric.cluster.quality', 79, '79%', 'bubble_chart', 'green', 79),
          metric('gender-female-to-male', 'stats.graph.metric.gender.female.to.male', 73, '7.3', 'female', 'purple', 73),
          metric('gender-male-to-female', 'stats.graph.metric.gender.male.to.female', 69, '6.9', 'male', 'gold', 69)
        ],
        bridgeUsers: [
          { key: 'lina-stone', labelKey: '', label: 'Lina Stone', value: 96, total: 320, icon: 'conversion_path', tone: 'red' },
          { key: 'luca-hale', labelKey: '', label: 'Luca Hale', value: 84, total: 320, icon: 'conversion_path', tone: 'purple' },
          { key: 'ava-baker', labelKey: '', label: 'Ava Baker', value: 71, total: 320, icon: 'conversion_path', tone: 'green' },
          { key: 'mason-grant', labelKey: '', label: 'Mason Grant', value: 62, total: 320, icon: 'conversion_path', tone: 'gold' }
        ],
        communities: [
          { key: 'community-1', labelKey: '', label: 'Austin event circle', value: 14, total: 42, icon: 'bubble_chart', tone: 'green' },
          { key: 'community-2', labelKey: '', label: 'Seattle creators', value: 9, total: 42, icon: 'bubble_chart', tone: 'blue' },
          { key: 'community-3', labelKey: '', label: 'Denver assets', value: 7, total: 42, icon: 'bubble_chart', tone: 'gold' },
          { key: 'community-4', labelKey: '', label: 'Miami mixed', value: 5, total: 42, icon: 'bubble_chart', tone: 'purple' }
        ],
        signals: [
          item('reachability-2-hop', 'stats.graph.signal.reachability', 68, 100, 'travel_explore', 'blue'),
          item('weak-tie-ratio', 'stats.graph.signal.weak.ties', 34, 100, 'lan', 'purple'),
          item('clustering', 'stats.graph.signal.clustering', 42, 100, 'bubble_chart', 'green'),
          item('recurring-edge-ratio', 'stats.graph.signal.recurring', 31, 100, 'repeat', 'gold'),
          item('bridge-coverage', 'stats.graph.signal.bridge.coverage', 19, 100, 'conversion_path', 'red'),
          item('largest-community', 'stats.graph.signal.largest.community', 33, 100, 'groups', 'slate'),
          item('network-quality', 'stats.graph.signal.network.quality', 64, 100, 'ssid_chart', 'blue'),
          item('cluster-quality', 'stats.graph.signal.cluster.quality', 79, 100, 'bubble_chart', 'green')
        ],
        timeline: [
          ['2026-04-28', 'Apr 28', 56, 8, 5, 19, 5, 7, 51, 69],
          ['2026-04-29', 'Apr 29', 62, 7, 8, 21, 5, 7, 53, 70],
          ['2026-04-30', 'Apr 30', 68, 9, 7, 23, 6, 7, 55, 71],
          ['2026-05-01', 'May 1', 74, 10, 9, 25, 6, 7, 57, 72],
          ['2026-05-02', 'May 2', 80, 11, 11, 28, 7, 7, 58, 73],
          ['2026-05-03', 'May 3', 83, 6, 10, 29, 7, 7, 59, 74],
          ['2026-05-04', 'May 4', 88, 12, 13, 31, 7, 6, 60, 75],
          ['2026-05-05', 'May 5', 94, 14, 12, 32, 8, 6, 61, 76],
          ['2026-05-06', 'May 6', 97, 7, 14, 32, 8, 6, 62, 76],
          ['2026-05-07', 'May 7', 103, 13, 16, 35, 8, 6, 63, 77],
          ['2026-05-08', 'May 8', 108, 8, 15, 36, 8, 6, 63, 78],
          ['2026-05-09', 'May 9', 113, 12, 18, 38, 8, 6, 64, 78],
          ['2026-05-10', 'May 10', 116, 9, 17, 39, 8, 6, 64, 79],
          ['2026-05-11', 'May 11', 116, 5, 14, 40, 8, 6, 64, 79]
        ].map(([dateKey, label, activeEdges, newEdges, recurringEdges, weakTies, bridgeUsers, communities, networkQuality, clusterQuality]) => ({
          dateKey: `${dateKey}`,
          label: `${label}`,
          activeEdges: Number(activeEdges),
          newEdges: Number(newEdges),
          recurringEdges: Number(recurringEdges),
          weakTies: Number(weakTies),
          bridgeUsers: Number(bridgeUsers),
          communities: Number(communities),
          networkQuality: Number(networkQuality),
          clusterQuality: Number(clusterQuality)
        }))
      },
      revenue: {
        metrics: [
          metric('payable-events', 'stats.revenue.metric.payable.events', 12, '12', 'confirmation_number', 'green', 30),
          metric('projected-event-revenue', 'stats.revenue.metric.projected.events', 202500, '$2,025.00', 'event_available', 'green', 48),
          metric('avg-event-ticket', 'stats.revenue.metric.avg.event.ticket', 1688, '$16.88', 'sell', 'gold', 17),
          metric('payable-assets', 'stats.revenue.metric.payable.assets', 16, '16', 'inventory_2', 'purple', 40),
          metric('projected-asset-revenue', 'stats.revenue.metric.projected.assets', 213000, '$2,130.00', 'category', 'blue', 52),
          metric('avg-asset-price', 'stats.revenue.metric.avg.asset.price', 13313, '$133.13', 'payments', 'slate', 100),
          metric('actual-paid', 'stats.revenue.metric.actual.paid', 52200, '$522.00', 'paid', 'blue', 13),
          metric('paying-users', 'stats.revenue.metric.paying.users', 22, '22', 'group', 'red', 88),
          metric('avg-payment', 'stats.revenue.metric.avg.payment', 2373, '$23.73', 'receipt_long', 'purple', 24)
        ],
        assetCategories: [
          { key: 'accommodation', labelKey: 'accommodation', label: '', value: 84000, total: 213000, icon: 'hotel', tone: 'gold' },
          { key: 'car', labelKey: 'car', label: '', value: 77000, total: 213000, icon: 'directions_car', tone: 'blue' },
          { key: 'supplies', labelKey: 'supplies', label: '', value: 52000, total: 213000, icon: 'category', tone: 'green' }
        ],
        timeline: revenueTimeline
      }
    };
  }
}
