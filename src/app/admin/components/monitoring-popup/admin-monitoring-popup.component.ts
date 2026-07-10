import {
  CommonModule
} from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  AdminMonitoringService,
  I18nService,
  type AdminMonitoringStateDto,
  AdminMonitoringCategoryDto,
  AdminMonitoringEdgeDto,
  AdminMonitoringHealth,
  AdminMonitoringMetricDto
} from '../../../shared/core';
import {
  I18nPipe
} from '../../../shared/ui';
import {
  type AppMenuModel,
  type AppMenuPalette
} from '../../../shared/ui/components/core/menu';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  PopupComponent,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

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
type MonitoringPopupMenuContext = MonitoringFilterMenuContext;

const MONITORING_FILTER_OPTIONS: Array<{ key: MonitoringFilter; labelKey: string; icon: string }> = [
  { key: MONITORING_FILTER.all, labelKey: 'admin.monitoring.filter.all', icon: 'schema' },
  { key: MONITORING_FILTER.watch, labelKey: 'admin.monitoring.filter.watch', icon: 'error_outline' },
  { key: MONITORING_FILTER.domains, labelKey: 'admin.monitoring.filter.domains', icon: 'dashboard' },
  { key: MONITORING_FILTER.delivery, labelKey: 'admin.monitoring.filter.delivery', icon: 'outbox' },
  { key: MONITORING_FILTER.workers, labelKey: 'admin.monitoring.filter.workers', icon: 'precision_manufacturing' }
];

@Component({
  selector: 'app-admin-monitoring-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, IndicatorComponent, I18nPipe, PopupComponent],
  templateUrl: './admin-monitoring-popup.component.html',
  styleUrl: './admin-monitoring-popup.component.scss'
})
export class AdminMonitoringPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  protected readonly monitoringService = inject(AdminMonitoringService);
  private readonly i18n = inject(I18nService);
  private readonly userProfileStore = inject(UserProfileStore);
  protected readonly popupKey = MONITORING_POPUP_KEY;
  protected readonly filterOptions = MONITORING_FILTER_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly state = signal<AdminMonitoringStateDto | null>(null);
  protected readonly filter = signal<MonitoringFilter>(MONITORING_FILTER.all);
  private loadGeneration = 0;
  private popupOpen = false;

  protected readonly filteredCategories = computed(() => this.state()?.categories ?? []);

  constructor() {
    effect(() => {
      const isOpen = this.admin.activePopup() === this.popupKey;
      if (isOpen && !this.popupOpen) {
        this.popupOpen = true;
        this.resetForOpen();
        queueMicrotask(() => void this.load());
        return;
      }
      if (!isOpen && this.popupOpen) {
        this.popupOpen = false;
        this.cancelActiveLoad();
      }
    });
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected monitoringPopupModel(): PopupModel<MonitoringPopupMenuContext> {
    return {
      title: this.uiText('monitoring'),
      subtitle: `${this.uiText('metrics')} · ${this.uiText('admin.monitoring.subtitle')}`,
      ariaLabel: this.uiText('monitoring'),
      closeAriaLabel: this.uiText('close'),
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.loading()
        ? []
        : [
            {
              kind: 'menu',
              id: 'monitoring-filter',
              menuKind: 'inline',
              model: this.filterMenuModel(),
              panelAlign: 'end'
            }
          ],
      onClose: () => this.close(),
      onMenuSelect: event => this.onMonitoringPopupMenuSelect(event)
    };
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
              palette: this.filterPalette(this.filter()),
              counter: this.filterCount(),
              ariaLabel: 'admin.monitoring.filter.aria',
              items: this.filterOptions.map(option => ({
                id: `filter:${option.key}`,
                kind: 'radio',
                label: option.labelKey,
                icon: option.icon,
                palette: this.filterPalette(option.key),
                surface: 'tinted',
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

  private onMonitoringPopupMenuSelect(event: PopupMenuSelectEvent<MonitoringPopupMenuContext>): void {
    const nextFilter = event.itemSelect.context?.filter;
    if (!nextFilter) {
      return;
    }
    void this.selectFilter(nextFilter, event.itemSelect.sourceEvent);
  }

  protected async selectFilter(filter: MonitoringFilter, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.filter() === filter && this.state()) {
      return;
    }
    this.filter.set(filter);
    await this.load();
  }

  protected filterCount(filter: MonitoringFilter = this.filter()): number {
    return this.countValue(this.state()?.filterCounts?.[filter]);
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
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.monitoringService.loadMonitoringState(
        this.userProfileStore.activeUserId().trim(),
        this.filter()
      );
      if (generation === this.loadGeneration) {
        this.state.set(state);
      }
    } catch {
      if (generation === this.loadGeneration) {
        this.error.set('admin.monitoring.error.load');
      }
    } finally {
      if (generation === this.loadGeneration) {
        this.loading.set(false);
      }
    }
  }

  private resetForOpen(): void {
    this.loadGeneration += 1;
    this.state.set(null);
    this.error.set('');
    this.loading.set(true);
  }

  private cancelActiveLoad(): void {
    this.loadGeneration += 1;
    this.loading.set(false);
  }

  private countValue(value: number | null | undefined): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private filterPalette(filter: MonitoringFilter): AppMenuPalette {
    switch (filter) {
      case MONITORING_FILTER.watch:
        return 'warning';
      case MONITORING_FILTER.domains:
        return 'teal';
      case MONITORING_FILTER.delivery:
        return 'purple';
      case MONITORING_FILTER.workers:
        return 'slate';
      default:
        return 'blue';
    }
  }

  private uiText(key: string): string {
    return this.i18n.translate(key);
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
