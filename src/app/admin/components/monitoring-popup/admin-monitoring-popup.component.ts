import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppContext } from '../../../shared/ui';
import { MatIconModule } from '@angular/material/icon';

import {
  AdminMonitoringService, type AdminMonitoringStateDto, AdminMonitoringCategoryDto, AdminMonitoringEdgeDto, AdminMonitoringHealth, AdminMonitoringMetricDto } from '../../../shared/core';
import { I18nPipe } from '../../../shared/ui';
import {
  AppMenuComponent,
  type AppMenuItemSelectEvent,
  type AppMenuModel
} from '../../../shared/ui/components/menu';
import { ProgressIndicatorComponent } from '../../../shared/ui/components/progress-indicator';
import { AdminPopupStore } from '../../../shared/ui/context/stores/admin-popup.store';

const MONITORING_POPUP_KEY = 'monitoring';

const MONITORING_FILTER = {
  all: 'all',
  watch: 'watch',
  domains: 'domains',
  delivery: 'delivery',
  workers: 'workers'
} as const;
type MonitoringFilter = typeof MONITORING_FILTER[keyof typeof MONITORING_FILTER];
type MonitoringFilterMenuItemId = 'filter-menu' | `filter:${MonitoringFilter}`;

interface MonitoringFilterMenuContext {
  filter: MonitoringFilter;
}

const MONITORING_FILTER_OPTIONS: Array<{ key: MonitoringFilter; labelKey: string; icon: string }> = [
  { key: MONITORING_FILTER.all, labelKey: 'admin.monitoring.filter.all', icon: 'schema' },
  { key: MONITORING_FILTER.watch, labelKey: 'admin.monitoring.filter.watch', icon: 'error_outline' },
  { key: MONITORING_FILTER.domains, labelKey: 'admin.monitoring.filter.domains', icon: 'dashboard' },
  { key: MONITORING_FILTER.delivery, labelKey: 'admin.monitoring.filter.delivery', icon: 'outbox' },
  { key: MONITORING_FILTER.workers, labelKey: 'admin.monitoring.filter.workers', icon: 'precision_manufacturing' }
];

const MONITORING_FILTER_CATEGORIES: Record<MonitoringFilter, ReadonlySet<string>> = {
  [MONITORING_FILTER.all]: new Set(),
  [MONITORING_FILTER.watch]: new Set(),
  [MONITORING_FILTER.domains]: new Set(['users', 'events', 'members', 'assets', 'chat']),
  [MONITORING_FILTER.delivery]: new Set(['notifications']),
  [MONITORING_FILTER.workers]: new Set(['matching', 'jobs'])
};

@Component({
  selector: 'app-admin-monitoring-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent, ProgressIndicatorComponent, I18nPipe],
  templateUrl: './admin-monitoring-popup.component.html',
  styleUrl: './admin-monitoring-popup.component.scss'
})
export class AdminMonitoringPopupComponent implements OnInit {
  protected readonly admin = inject(AdminPopupStore);
  protected readonly monitoringService = inject(AdminMonitoringService);
  private readonly appCtx = inject(AppContext);
  protected readonly popupKey = MONITORING_POPUP_KEY;
  protected readonly filterOptions = MONITORING_FILTER_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly state = signal<AdminMonitoringStateDto | null>(null);
  protected readonly filter = signal<MonitoringFilter>(MONITORING_FILTER.all);

  protected readonly filteredCategories = computed(() => {
    const categories = this.state()?.categories ?? [];
    const activeFilter = this.filter();
    if (activeFilter === MONITORING_FILTER.all) {
      return categories;
    }
    if (activeFilter === MONITORING_FILTER.watch) {
      return categories.filter(category => category.health !== 'ok');
    }
    const allowed = MONITORING_FILTER_CATEGORIES[activeFilter];
    return categories.filter(category => allowed.has(category.key));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected filterMenuModel(): AppMenuModel<MonitoringFilterMenuItemId, MonitoringFilterMenuContext> {
    return {
      nodes: [
        {
          id: 'monitoring-filter-root',
          items: [
            {
              id: 'filter-menu',
              kind: 'select-trigger',
              label: this.filterLabelKey(),
              icon: this.filterIcon(),
              counter: this.filterCount(),
              ariaLabel: 'admin.monitoring.filter.aria',
              items: this.filterOptions.map(option => ({
                id: `filter:${option.key}`,
                kind: 'radio',
                label: option.labelKey,
                icon: option.icon,
                checked: this.filter() === option.key,
                counter: this.filterCount(option.key),
                context: { filter: option.key }
              }))
            }
          ]
        }
      ]
    };
  }

  protected onFilterMenuSelect(event: AppMenuItemSelectEvent<MonitoringFilterMenuItemId, MonitoringFilterMenuContext>): void {
    const nextFilter = event.context?.filter;
    if (!nextFilter) {
      return;
    }
    this.selectFilter(nextFilter, event.sourceEvent);
  }

  protected selectFilter(filter: MonitoringFilter, event?: Event): void {
    event?.stopPropagation();
    this.filter.set(filter);
  }

  protected filterCount(filter: MonitoringFilter = this.filter()): number {
    const categories = this.state()?.categories ?? [];
    if (filter === MONITORING_FILTER.all) {
      return categories.length;
    }
    if (filter === MONITORING_FILTER.watch) {
      return categories.filter(category => category.health !== 'ok').length;
    }
    const allowed = MONITORING_FILTER_CATEGORIES[filter];
    return categories.filter(category => allowed.has(category.key)).length;
  }

  protected filterLabelKey(): string {
    return this.filterOptions.find(option => option.key === this.filter())?.labelKey ?? 'admin.monitoring.filter.all';
  }

  protected filterIcon(): string {
    return this.filterOptions.find(option => option.key === this.filter())?.icon ?? 'schema';
  }

  protected healthLabelKey(health: AdminMonitoringHealth): string {
    return `admin.monitoring.health.${health}`;
  }

  protected healthClass(health: AdminMonitoringHealth): string {
    return `is-${health}`;
  }

  protected categoryHealthStyle(category: AdminMonitoringCategoryDto): Record<string, string> {
    return this.healthChipStyle(this.categoryHealthScore(category));
  }

  protected metricChipStyle(metric: AdminMonitoringMetricDto): Record<string, string> {
    return this.healthChipStyle(this.metricHealthScore(metric));
  }

  protected edgeAfter(category: AdminMonitoringCategoryDto, index: number): AdminMonitoringEdgeDto | null {
    return category.edges[index] ?? null;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.monitoringService.loadMonitoringState(this.appCtx.userProfileStore.activeUserId().trim());
      this.state.set(state);
    } catch {
      this.error.set('admin.monitoring.error.load');
    } finally {
      this.loading.set(false);
    }
  }

  private categoryHealthScore(category: AdminMonitoringCategoryDto): number {
    const scores = category.nodes
      .flatMap(node => node.metrics)
      .map(metric => this.metricHealthScore(metric));
    if (!scores.length) {
      return category.health === 'alert' ? 12 : category.health === 'watch' ? 48 : 92;
    }
    const worst = Math.min(...scores);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    if (category.health === 'alert') {
      return Math.min(22, worst);
    }
    if (category.health === 'watch') {
      return Math.min(72, Math.round(worst * 0.72 + average * 0.28));
    }
    return Math.max(82, Math.round(worst * 0.5 + average * 0.5));
  }

  private metricHealthScore(metric: AdminMonitoringMetricDto): number {
    const value = Math.max(0, Math.trunc(Number(metric.value) || 0));
    const load = Math.min(1, Math.log10(value + 1) / 2);
    if (metric.status === 'alert') {
      return value > 0 ? Math.max(0, Math.round(18 - load * 18)) : 92;
    }
    if (metric.status === 'watch') {
      return value > 0 ? Math.max(12, Math.round(56 - load * 44)) : 76;
    }
    return 92;
  }

  private healthChipStyle(score: number): Record<string, string> {
    const step = Math.max(0, Math.min(255, Math.round((Math.max(0, Math.min(100, score)) / 100) * 255)));
    const hue = (step / 255) * 120;
    return {
      color: `hsl(${hue}deg 62% 26%)`,
      background: `hsl(${hue}deg 78% 92%)`,
      'border-color': `hsl(${hue}deg 58% 74%)`
    };
  }
}
