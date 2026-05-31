import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
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
} from '../../shared/core';
import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';
import { AdminMonitoringSeedBuilder } from '../builders/admin-monitoring-seed.builder';
import { AdminMonitoringRepository } from '../repositories/admin-monitoring.repository';
import { AdminWorkspaceService } from './admin-workspace.service';

const ADMIN_MONITORING_STORAGE_TIMEOUT_MS = 2500;
const ADMIN_MONITORING_HTTP_TIMEOUT_MS = 12000;
const ADMIN_MONITORING_LOAD_ROUTE = '/admin/monitoring';
const ADMIN_MONITORING_LOAD_DEMO_DELAY_MS = 1500;

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringService {
  private readonly http = inject(HttpClient);
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly repository = inject(AdminMonitoringRepository);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadMonitoringState(): Promise<AdminMonitoringStateDto> {
    return this.withAdminMonitoringDemoDelay(this.loadMonitoringStateSnapshot());
  }

  private async loadMonitoringStateSnapshot(): Promise<AdminMonitoringStateDto> {
    if (this.workspace.usesHttpAdminApi) {
      const state = await this.withHttpTimeout(this.http
        .get<AdminMonitoringStateDto>(`${this.apiBaseUrl}/admin/monitoring`, {
          params: { adminUserId: this.workspace.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeMonitoringState(state ?? this.buildDefaultMonitoringState(), 'http');
    }
    return this.readDemoMonitoringState();
  }

  private async withAdminMonitoringDemoDelay<T>(work: Promise<T>): Promise<T> {
    if (this.workspace.usesHttpAdminApi) {
      return work;
    }
    const delay = this.routeDelay.waitForRouteDelay(
      ADMIN_MONITORING_LOAD_ROUTE,
      undefined,
      undefined,
      ADMIN_MONITORING_LOAD_DEMO_DELAY_MS
    );
    try {
      const [result] = await Promise.all([work, delay]);
      return result;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readDemoMonitoringState(): Promise<AdminMonitoringStateDto> {
    await this.withStorageFallback(this.repository.whenReady(), undefined);
    const existing = await this.withStorageFallback(
      this.repository.readStore<AdminMonitoringStateDto>(),
      null
    );
    if (!existing?.categories?.length) {
      throw new Error('Demo monitoring state is not bootstrapped.');
    }
    return this.normalizeMonitoringState(existing, 'demo');
  }

  private buildDefaultMonitoringState(): AdminMonitoringStateDto {
    return this.normalizeMonitoringState(AdminMonitoringSeedBuilder.buildDefaultMonitoringState(), 'demo');
  }

  private normalizeMonitoringState(
    state: AdminMonitoringStateDto,
    source: AdminMonitoringStateDto['source']
  ): AdminMonitoringStateDto {
    const normalizedSource = `${state.source ?? source}`.trim() as AdminMonitoringStateDto['source'];
    const categories = (state.categories ?? []).map(category => this.normalizeMonitoringCategory(category));
    return {
      generatedAtIso: `${state.generatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      source: ['demo', 'http', 'fallback'].includes(normalizedSource) ? normalizedSource : source,
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

  private withStorageFallback<T>(task: Promise<T>, fallback: T): Promise<T> {
    return new Promise<T>(resolve => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (value: T) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(value);
      };
      timeoutId = setTimeout(() => finish(fallback), ADMIN_MONITORING_STORAGE_TIMEOUT_MS);
      task.then(finish).catch(() => finish(fallback));
    });
  }

  private withHttpTimeout<T>(task: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (callback: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback();
      };
      timeoutId = setTimeout(
        () => finish(() => reject(new Error('Monitoring request timed out.'))),
        ADMIN_MONITORING_HTTP_TIMEOUT_MS
      );
      task.then(value => finish(() => resolve(value))).catch(error => finish(() => reject(error)));
    });
  }
}
