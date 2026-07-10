import { Injectable, inject } from '@angular/core';

import type { AdminMonitoringStateDto } from '../../../contracts/admin.interface';
import { LocalAdminMonitoringRepository } from '../repositories/admin-monitoring.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_MONITORING_LOAD_ROUTE = '/admin/monitoring';
const MONITORING_FILTER_ALL = 'all';
const MONITORING_FILTER_WATCH = 'watch';
const MONITORING_FILTER_DOMAINS = 'domains';
const MONITORING_FILTER_DELIVERY = 'delivery';
const MONITORING_FILTER_WORKERS = 'workers';
const MONITORING_DOMAIN_CATEGORIES = new Set(['users', 'events', 'members', 'assets', 'chat']);
const MONITORING_DELIVERY_CATEGORIES = new Set(['notifications']);
const MONITORING_WORKER_CATEGORIES = new Set(['matching', 'jobs']);

@Injectable({
  providedIn: 'root'
})
export class LocalAdminMonitoringService extends LocalRouteDelayService {
  private readonly repository = inject(LocalAdminMonitoringRepository);

  async loadMonitoringState(filter?: string | null): Promise<AdminMonitoringStateDto> {
    const delay = this.waitForRouteDelay(ADMIN_MONITORING_LOAD_ROUTE);
    try {
      const [state] = await Promise.all([
        this.readMonitoringState(),
        delay
      ]);
      return this.applyMonitoringFilter(state, filter);
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readMonitoringState(): Promise<AdminMonitoringStateDto> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminMonitoringStateDto>();
    if (!existing?.categories?.length) {
      throw new Error('Demo monitoring state is not bootstrapped.');
    }
    return existing;
  }

  private applyMonitoringFilter(state: AdminMonitoringStateDto, filter: string | null | undefined): AdminMonitoringStateDto {
    const categories = state.categories ?? [];
    const normalizedFilter = this.normalizeFilter(filter);
    return {
      ...state,
      filterCounts: this.monitoringFilterCounts(categories),
      categories: this.filteredCategories(categories, normalizedFilter)
    };
  }

  private monitoringFilterCounts(categories: AdminMonitoringStateDto['categories']): Record<string, number> {
    return {
      [MONITORING_FILTER_ALL]: categories.length,
      [MONITORING_FILTER_WATCH]: categories.filter(category => category.health !== 'ok').length,
      [MONITORING_FILTER_DOMAINS]: categories.filter(category => MONITORING_DOMAIN_CATEGORIES.has(category.key)).length,
      [MONITORING_FILTER_DELIVERY]: categories.filter(category => MONITORING_DELIVERY_CATEGORIES.has(category.key)).length,
      [MONITORING_FILTER_WORKERS]: categories.filter(category => MONITORING_WORKER_CATEGORIES.has(category.key)).length
    };
  }

  private filteredCategories(
    categories: AdminMonitoringStateDto['categories'],
    filter: string
  ): AdminMonitoringStateDto['categories'] {
    if (filter === MONITORING_FILTER_WATCH) {
      return categories.filter(category => category.health !== 'ok');
    }
    if (filter === MONITORING_FILTER_DOMAINS) {
      return categories.filter(category => MONITORING_DOMAIN_CATEGORIES.has(category.key));
    }
    if (filter === MONITORING_FILTER_DELIVERY) {
      return categories.filter(category => MONITORING_DELIVERY_CATEGORIES.has(category.key));
    }
    if (filter === MONITORING_FILTER_WORKERS) {
      return categories.filter(category => MONITORING_WORKER_CATEGORIES.has(category.key));
    }
    return categories;
  }

  private normalizeFilter(filter: string | null | undefined): string {
    const normalized = `${filter ?? ''}`.trim();
    return [
      MONITORING_FILTER_WATCH,
      MONITORING_FILTER_DOMAINS,
      MONITORING_FILTER_DELIVERY,
      MONITORING_FILTER_WORKERS
    ].includes(normalized)
      ? normalized
      : MONITORING_FILTER_ALL;
  }
}
