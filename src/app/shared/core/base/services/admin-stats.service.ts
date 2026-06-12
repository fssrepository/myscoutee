import { Injectable, inject } from '@angular/core';

import type {
  AdminStatsBreakdownItemDto,
  AdminStatsDashboardDto,
  AdminStatsGraphDto,
  AdminStatsGraphTimelinePointDto,
  AdminStatsMetricDto,
  AdminStatsRevenueDto,
  AdminStatsRevenueTimelinePointDto,
  AdminStatsSegmentDto,
  AdminStatsTimelinePointDto
} from '../../contracts/admin.interface';
import { HttpAdminStatsService } from '../../http/services/admin-stats.service';
import { LocalAdminStatsService } from '../../local/services/admin-stats.service';
import { BaseRouteModeService } from './base-route-mode.service';

const ADMIN_STATS_LOAD_ROUTE = '/admin/stats';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsService extends BaseRouteModeService {
  private readonly localService = inject(LocalAdminStatsService);
  private readonly httpService = inject(HttpAdminStatsService);

  private get statsService(): LocalAdminStatsService | HttpAdminStatsService {
    return this.resolveRouteService(ADMIN_STATS_LOAD_ROUTE, this.localService, this.httpService);
  }

  async loadStatsDashboard(adminUserId?: string | null): Promise<AdminStatsDashboardDto> {
    const statsService = this.statsService;
    const dashboard = statsService instanceof LocalAdminStatsService
      ? await statsService.loadStatsDashboard()
      : await statsService.loadStatsDashboard(adminUserId);
    return this.normalizeStatsDashboard(dashboard, statsService.source);
  }

  private normalizeStatsDashboard(
    dashboard: AdminStatsDashboardDto,
    source: AdminStatsDashboardDto['source']
  ): AdminStatsDashboardDto {
    const normalizedSource = `${dashboard.source ?? source}`.trim() as AdminStatsDashboardDto['source'];
    return {
      generatedAtIso: `${dashboard.generatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      source: ['demo', 'http'].includes(normalizedSource) ? normalizedSource : source,
      healthScore: this.clampInteger(dashboard.healthScore, 0, 100, 0),
      healthLabelKey: `${dashboard.healthLabelKey ?? ''}`.trim() || 'stats.health.good',
      healthSummaryKey: `${dashboard.healthSummaryKey ?? ''}`.trim() || 'stats.health.summary',
      kpis: (dashboard.kpis ?? []).map(metric => this.normalizeStatsMetric(metric)),
      segments: (dashboard.segments ?? []).map(segment => this.normalizeStatsSegment(segment)),
      attention: (dashboard.attention ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      topCities: (dashboard.topCities ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      topTopics: (dashboard.topTopics ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (dashboard.timeline ?? []).map(point => this.normalizeStatsTimelinePoint(point)),
      eventTypes: (dashboard.eventTypes ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      activityMix: (dashboard.activityMix ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      graph: this.normalizeStatsGraph(dashboard.graph),
      revenue: this.normalizeStatsRevenue(dashboard.revenue)
    };
  }

  private normalizeStatsMetric(metric: AdminStatsMetricDto): AdminStatsMetricDto {
    const value = Math.max(0, Math.trunc(Number(metric.value) || 0));
    return {
      key: `${metric.key ?? ''}`.trim(),
      labelKey: `${metric.labelKey ?? ''}`.trim(),
      value,
      valueLabel: `${metric.valueLabel ?? ''}`.trim() || this.compactNumber(value),
      captionKey: `${metric.captionKey ?? ''}`.trim(),
      caption: `${metric.caption ?? ''}`.trim(),
      icon: `${metric.icon ?? ''}`.trim() || 'query_stats',
      tone: this.normalizeStatsTone(metric.tone),
      percent: this.clampInteger(metric.percent ?? 0, 0, 100, 0)
    };
  }

  private normalizeStatsSegment(segment: AdminStatsSegmentDto): AdminStatsSegmentDto {
    return {
      key: `${segment.key ?? ''}`.trim(),
      labelKey: `${segment.labelKey ?? ''}`.trim(),
      icon: `${segment.icon ?? ''}`.trim() || 'dashboard',
      total: Math.max(0, Math.trunc(Number(segment.total) || 0)),
      healthPercent: this.clampInteger(segment.healthPercent, 0, 100, 0),
      summaryKey: `${segment.summaryKey ?? ''}`.trim(),
      summary: `${segment.summary ?? ''}`.trim(),
      items: (segment.items ?? []).map(item => this.normalizeStatsBreakdownItem(item))
    };
  }

  private normalizeStatsBreakdownItem(item: AdminStatsBreakdownItemDto): AdminStatsBreakdownItemDto {
    return {
      key: `${item.key ?? ''}`.trim(),
      labelKey: `${item.labelKey ?? ''}`.trim(),
      label: `${item.label ?? ''}`.trim(),
      value: Math.max(0, Math.trunc(Number(item.value) || 0)),
      total: Math.max(0, Math.trunc(Number(item.total) || 0)),
      icon: `${item.icon ?? ''}`.trim(),
      tone: item.tone ? this.normalizeStatsTone(item.tone) : undefined
    };
  }

  private normalizeStatsTimelinePoint(point: AdminStatsTimelinePointDto): AdminStatsTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      registrations: Math.max(0, Math.trunc(Number(point.registrations) || 0)),
      activeUsers: Math.max(0, Math.trunc(Number(point.activeUsers) || 0)),
      ratings: Math.max(0, Math.trunc(Number(point.ratings) || 0)),
      events: Math.max(0, Math.trunc(Number(point.events) || 0)),
      assets: Math.max(0, Math.trunc(Number(point.assets) || 0)),
      messages: Math.max(0, Math.trunc(Number(point.messages) || 0)),
      moderation: Math.max(0, Math.trunc(Number(point.moderation) || 0))
    };
  }

  private normalizeStatsGraph(graph: AdminStatsGraphDto | null | undefined): AdminStatsGraphDto {
    return {
      healthScore: this.clampInteger(graph?.healthScore ?? 0, 0, 100, 0),
      healthLabelKey: `${graph?.healthLabelKey ?? ''}`.trim() || 'stats.graph.health.cold',
      insightKey: `${graph?.insightKey ?? ''}`.trim() || 'stats.graph.insight.cold',
      metrics: (graph?.metrics ?? []).map(metric => this.normalizeStatsMetric(metric)),
      bridgeUsers: (graph?.bridgeUsers ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      communities: (graph?.communities ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      signals: (graph?.signals ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (graph?.timeline ?? []).map(point => this.normalizeStatsGraphTimelinePoint(point))
    };
  }

  private normalizeStatsGraphTimelinePoint(point: AdminStatsGraphTimelinePointDto): AdminStatsGraphTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      activeEdges: Math.max(0, Math.trunc(Number(point.activeEdges) || 0)),
      newEdges: Math.max(0, Math.trunc(Number(point.newEdges) || 0)),
      recurringEdges: Math.max(0, Math.trunc(Number(point.recurringEdges) || 0)),
      weakTies: Math.max(0, Math.trunc(Number(point.weakTies) || 0)),
      bridgeUsers: Math.max(0, Math.trunc(Number(point.bridgeUsers) || 0)),
      communities: Math.max(0, Math.trunc(Number(point.communities) || 0)),
      networkQuality: Math.max(0, Math.trunc(Number(point.networkQuality) || 0)),
      clusterQuality: Math.max(0, Math.trunc(Number(point.clusterQuality) || 0))
    };
  }

  private normalizeStatsRevenue(revenue: AdminStatsRevenueDto | null | undefined): AdminStatsRevenueDto {
    return {
      metrics: (revenue?.metrics ?? []).map(metric => this.normalizeStatsMetric(metric)),
      assetCategories: (revenue?.assetCategories ?? []).map(item => this.normalizeStatsBreakdownItem(item)),
      timeline: (revenue?.timeline ?? []).map(point => this.normalizeStatsRevenueTimelinePoint(point))
    };
  }

  private normalizeStatsRevenueTimelinePoint(point: AdminStatsRevenueTimelinePointDto): AdminStatsRevenueTimelinePointDto {
    return {
      dateKey: `${point.dateKey ?? ''}`.trim(),
      label: `${point.label ?? ''}`.trim(),
      payableEvents: Math.max(0, Math.trunc(Number(point.payableEvents) || 0)),
      payableAssets: Math.max(0, Math.trunc(Number(point.payableAssets) || 0)),
      projectedEventCents: Math.max(0, Math.trunc(Number(point.projectedEventCents) || 0)),
      projectedAssetCents: Math.max(0, Math.trunc(Number(point.projectedAssetCents) || 0)),
      actualPaymentCents: Math.max(0, Math.trunc(Number(point.actualPaymentCents) || 0)),
      payingUsers: Math.max(0, Math.trunc(Number(point.payingUsers) || 0))
    };
  }

  private normalizeStatsTone(value: string | null | undefined): AdminStatsMetricDto['tone'] {
    const normalized = `${value ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(normalized)
      ? normalized as AdminStatsMetricDto['tone']
      : 'slate';
  }

  private compactNumber(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return String(value);
  }

  private clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }

}
