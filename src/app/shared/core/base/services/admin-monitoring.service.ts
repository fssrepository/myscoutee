import { Injectable, inject } from '@angular/core';

import type {
  AdminMonitoringCategoryDto,
  AdminMonitoringEdgeDto,
  AdminMonitoringHealth,
  AdminMonitoringMetricDetailRowDto,
  AdminMonitoringMetricDto,
  AdminMonitoringNodeDto,
  AdminMonitoringNodeKind,
  AdminMonitoringStateDto,
  AdminMonitoringTone
} from '../../contracts/admin.interface';
import { HttpAdminMonitoringService } from '../../http/services/admin-monitoring.service';
import { LocalAdminMonitoringService } from '../../local/source/services/admin-monitoring.service';
import { BaseRouteModeService } from './base-route-mode.service';
import { RouteDelayService } from './route-delay.service';

const ADMIN_MONITORING_ROUTE = '/admin/monitoring';

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringService extends BaseRouteModeService {
  private readonly localService = inject(LocalAdminMonitoringService);
  private readonly httpService = inject(HttpAdminMonitoringService);
  private readonly routeDelay = inject(RouteDelayService);

  private get monitoringService(): LocalAdminMonitoringService | HttpAdminMonitoringService {
    return this.resolveRouteService(ADMIN_MONITORING_ROUTE, this.localService, this.httpService);
  }

  monitoringLoadProgressWindowMs(): number {
    return this.routeDelay.resolveRequestTimeoutMs(ADMIN_MONITORING_ROUTE);
  }

  async loadMonitoringState(adminUserId?: string | null): Promise<AdminMonitoringStateDto> {
    const source = this.monitoringService instanceof LocalAdminMonitoringService ? 'demo' : 'http';
    const state = this.monitoringService instanceof LocalAdminMonitoringService
      ? await this.monitoringService.loadMonitoringState()
      : await this.monitoringService.loadMonitoringState(adminUserId);
    return this.normalizeMonitoringState(state, source);
  }

  private normalizeMonitoringState(
    state: AdminMonitoringStateDto,
    source: AdminMonitoringStateDto['source']
  ): AdminMonitoringStateDto {
    const normalizedSource = `${state.source ?? source}`.trim() as AdminMonitoringStateDto['source'];
    const categories = (state.categories ?? []).map(category => this.normalizeMonitoringCategory(category));
    return {
      generatedAtIso: `${state.generatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      source: ['demo', 'http'].includes(normalizedSource) ? normalizedSource : source,
      health: this.normalizeMonitoringHealth(state.health),
      categories
    };
  }

  private normalizeMonitoringCategory(category: AdminMonitoringCategoryDto): AdminMonitoringCategoryDto {
    const nodes = (category.nodes ?? []).map(node => this.normalizeMonitoringNode(node));
    return {
      key: `${category.key ?? ''}`.trim(),
      labelKey: `${category.labelKey ?? ''}`.trim(),
      summaryKey: `${category.summaryKey ?? ''}`.trim(),
      icon: `${category.icon ?? ''}`.trim() || 'monitoring',
      tone: this.normalizeMonitoringTone(category.tone),
      health: this.normalizeMonitoringCategoryHealth(category.health, nodes),
      total: Math.max(0, Math.trunc(Number(category.total) || 0)),
      nodes,
      edges: (category.edges ?? []).map(edge => this.normalizeMonitoringEdge(edge))
    };
  }

  private normalizeMonitoringNode(node: AdminMonitoringNodeDto): AdminMonitoringNodeDto {
    const kind = `${node.kind ?? ''}`.trim();
    return {
      id: `${node.id ?? ''}`.trim(),
      labelKey: `${node.labelKey ?? ''}`.trim(),
      icon: `${node.icon ?? ''}`.trim() || 'radio_button_checked',
      kind: ['source', 'writeModel', 'queue', 'worker', 'outbox', 'external', 'readModel', 'storage'].includes(kind)
        ? kind as AdminMonitoringNodeKind
        : 'source',
      tone: this.normalizeMonitoringTone(node.tone),
      metrics: (node.metrics ?? []).map(metric => this.normalizeMonitoringMetric(metric))
    };
  }

  private normalizeMonitoringMetric(metric: AdminMonitoringMetricDto): AdminMonitoringMetricDto {
    const value = Math.max(0, Math.trunc(Number(metric.value) || 0));
    const key = `${metric.key ?? ''}`.trim();
    const labelKey = `${metric.labelKey ?? ''}`.trim();
    return {
      key,
      labelKey,
      value,
      valueLabel: `${metric.valueLabel ?? ''}`.trim() || this.compactNumber(value),
      tone: this.normalizeMonitoringTone(metric.tone),
      status: this.normalizeMonitoringMetricHealth(key, labelKey, value, metric.status),
      detailRows: (metric.detailRows ?? []).map(row => this.normalizeMonitoringDetailRow(row))
    };
  }

  private normalizeMonitoringCategoryHealth(
    health: AdminMonitoringHealth,
    nodes: AdminMonitoringNodeDto[]
  ): AdminMonitoringHealth {
    const explicit = this.normalizeMonitoringHealth(health);
    const statuses = nodes.flatMap(node => node.metrics.map(metric => metric.status));
    if (explicit === 'alert' || statuses.includes('alert')) {
      return 'alert';
    }
    if (explicit === 'watch' || statuses.includes('watch')) {
      return 'watch';
    }
    return 'ok';
  }

  private normalizeMonitoringMetricHealth(
    key: string,
    labelKey: string,
    value: number,
    health: AdminMonitoringHealth
  ): AdminMonitoringHealth {
    const explicit = this.normalizeMonitoringHealth(health);
    const lookupKey = `${key} ${labelKey}`.toLowerCase();
    if (value <= 0) {
      return lookupKey.includes('failed') || lookupKey.includes('error') || lookupKey.includes('pending')
        ? 'ok'
        : explicit;
    }
    if (lookupKey.includes('failed') || lookupKey.includes('error')) {
      return 'alert';
    }
    if (
      lookupKey.includes('pending')
      || lookupKey.includes('borrower-updates')
      || lookupKey.includes('deleted')
      || lookupKey.includes('suppression')
      || lookupKey.includes('status-propagation')
      || lookupKey.includes('purge-signals')
    ) {
      return 'watch';
    }
    return explicit;
  }

  private normalizeMonitoringDetailRow(row: AdminMonitoringMetricDetailRowDto): AdminMonitoringMetricDetailRowDto {
    return {
      key: `${row.key ?? ''}`.trim(),
      labelKey: `${row.labelKey ?? ''}`.trim(),
      valueLabel: `${row.valueLabel ?? ''}`.trim(),
      tone: this.normalizeMonitoringTone(row.tone)
    };
  }

  private normalizeMonitoringEdge(edge: AdminMonitoringEdgeDto): AdminMonitoringEdgeDto {
    return {
      from: `${edge.from ?? ''}`.trim(),
      to: `${edge.to ?? ''}`.trim(),
      labelKey: `${edge.labelKey ?? ''}`.trim(),
      tone: this.normalizeMonitoringTone(edge.tone),
      volume: Math.max(0, Math.trunc(Number(edge.volume) || 0))
    };
  }

  private normalizeMonitoringTone(value: string | null | undefined): AdminMonitoringTone {
    const normalized = `${value ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(normalized)
      ? normalized as AdminMonitoringTone
      : 'slate';
  }

  private normalizeMonitoringHealth(value: string | null | undefined): AdminMonitoringHealth {
    const normalized = `${value ?? ''}`.trim();
    return ['ok', 'watch', 'alert'].includes(normalized)
      ? normalized as AdminMonitoringHealth
      : 'ok';
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
}
