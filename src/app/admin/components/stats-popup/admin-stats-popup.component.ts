import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RouteDelayService } from '../../../shared/core/base/services/route-delay.service';
import { I18nPipe } from '../../../shared/i18n';
import {
  AdminService,
  type AdminStatsBreakdownItemDto,
  type AdminStatsDashboardDto,
  type AdminStatsMetricDto,
  type AdminStatsSegmentDto,
  type AdminStatsTimelinePointDto
} from '../../admin.service';

type AdminStatsTimelineMetric = 'activeUsers' | 'registrations' | 'ratings' | 'activity' | 'messages' | 'moderation';

@Component({
  selector: 'app-admin-stats-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe],
  templateUrl: './admin-stats-popup.component.html',
  styleUrl: './admin-stats-popup.component.scss'
})
export class AdminStatsPopupComponent implements OnDestroy {
  private static readonly LOAD_DEMO_DELAY_MS = 1500;
  private static readonly LOAD_PROGRESS_WINDOW_MS = 3000;

  protected readonly admin = inject(AdminService);
  private readonly routeDelay = inject(RouteDelayService);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly stats = signal<AdminStatsDashboardDto | null>(null);
  protected readonly selectedTimeline = signal<AdminStatsTimelinePointDto | null>(null);
  protected readonly timelineDragging = signal(false);
  protected readonly loadingRingPerimeter = 100;
  protected readonly loadingProgress = signal(0);
  protected readonly topSegments = computed(() => this.stats()?.segments ?? []);
  protected readonly primaryKpis = computed(() => this.stats()?.kpis ?? []);
  protected readonly timelineMetrics: { key: AdminStatsTimelineMetric; labelKey: string; tone: string }[] = [
    { key: 'activeUsers', labelKey: 'stats.timeline.active.users', tone: 'blue' },
    { key: 'registrations', labelKey: 'stats.timeline.registrations', tone: 'green' },
    { key: 'ratings', labelKey: 'stats.timeline.ratings', tone: 'purple' },
    { key: 'activity', labelKey: 'stats.timeline.activity', tone: 'gold' },
    { key: 'messages', labelKey: 'stats.timeline.messages', tone: 'slate' },
    { key: 'moderation', labelKey: 'stats.timeline.moderation', tone: 'red' }
  ];
  private loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
  private loadingProgressStartedAtMs = 0;

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.clearLoadingProgress();
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected async refresh(): Promise<void> {
    await this.load();
  }

  protected healthRingStyle(score: number | null | undefined): Record<string, string> {
    const value = this.clamp(score ?? 0, 0, 100);
    return {
      background: `conic-gradient(#2f8f5b ${value * 3.6}deg, rgba(42, 81, 129, 0.14) 0deg)`
    };
  }

  protected itemPercent(item: AdminStatsBreakdownItemDto): number {
    const total = Math.max(1, Math.trunc(Number(item.total) || 0));
    return this.clamp(Math.round((Math.trunc(Number(item.value) || 0) * 100) / total), 0, 100);
  }

  protected metricPercent(metric: AdminStatsMetricDto): number {
    return this.clamp(Math.trunc(Number(metric.percent) || 0), 0, 100);
  }

  protected segmentPercent(segment: AdminStatsSegmentDto): number {
    return this.clamp(Math.trunc(Number(segment.healthPercent) || 0), 0, 100);
  }

  protected loadingRingDashOffset(): number {
    return this.loadingRingPerimeter * (1 - Math.min(1, Math.max(0, this.loadingProgress())));
  }

  protected selectTimelinePoint(point: AdminStatsTimelinePointDto): void {
    this.selectedTimeline.set(point);
  }

  protected startTimelineDrag(event: PointerEvent, points: AdminStatsTimelinePointDto[]): void {
    if (!points.length) {
      return;
    }
    this.timelineDragging.set(true);
    this.updateTimelineFromPointer(event, points);
    const target = event.currentTarget as SVGSVGElement | null;
    target?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected moveTimelineDrag(event: PointerEvent, points: AdminStatsTimelinePointDto[]): void {
    if (!this.timelineDragging()) {
      return;
    }
    this.updateTimelineFromPointer(event, points);
    event.preventDefault();
  }

  protected endTimelineDrag(event?: PointerEvent): void {
    if (!this.timelineDragging()) {
      return;
    }
    this.timelineDragging.set(false);
    const target = event?.currentTarget as SVGSVGElement | null;
    if (event && target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  protected selectedTimelinePoint(dashboard: AdminStatsDashboardDto): AdminStatsTimelinePointDto | null {
    const selected = this.selectedTimeline();
    if (selected && dashboard.timeline.some(point => point.dateKey === selected.dateKey)) {
      return selected;
    }
    return dashboard.timeline.at(-1) ?? null;
  }

  protected selectedTimelineIndex(dashboard: AdminStatsDashboardDto): number {
    const point = this.selectedTimelinePoint(dashboard);
    if (!point) {
      return -1;
    }
    return dashboard.timeline.findIndex(item => item.dateKey === point.dateKey);
  }

  protected selectedTimelineX(dashboard: AdminStatsDashboardDto): number {
    const index = this.selectedTimelineIndex(dashboard);
    return index < 0 ? this.timelineX(Math.max(0, dashboard.timeline.length - 1), dashboard.timeline.length) : this.timelineX(index, dashboard.timeline.length);
  }

  protected selectedTimelineY(dashboard: AdminStatsDashboardDto): number {
    const point = this.selectedTimelinePoint(dashboard);
    if (!point) {
      return this.timelineY(0, 1);
    }
    return this.timelineY(point.activeUsers, this.timelineMetricMax(dashboard.timeline, 'activeUsers'));
  }

  protected timelineChartPoints(
    points: AdminStatsTimelinePointDto[],
    metric: AdminStatsTimelineMetric
  ): string {
    if (!points.length) {
      return '';
    }
    const max = this.timelineMetricMax(points, metric);
    return points
      .map((point, index) => `${this.timelineX(index, points.length)},${this.timelineY(this.timelineMetricValue(point, metric), max)}`)
      .join(' ');
  }

  protected timelineX(index: number, total: number): number {
    return Math.round(12 + (Math.max(0, index) * 276) / Math.max(1, total - 1));
  }

  protected timelineY(value: number, max: number): number {
    return Math.round(94 - (this.clamp(value, 0, max) * 72) / Math.max(1, max));
  }

  protected timelineMetricValue(point: AdminStatsTimelinePointDto, metric: AdminStatsTimelineMetric): number {
    switch (metric) {
      case 'activity':
        return Math.max(0, Number(point.events) || 0) + Math.max(0, Number(point.assets) || 0);
      case 'activeUsers':
        return Math.max(0, Number(point.activeUsers) || 0);
      case 'registrations':
        return Math.max(0, Number(point.registrations) || 0);
      case 'ratings':
        return Math.max(0, Number(point.ratings) || 0);
      case 'messages':
        return Math.max(0, Number(point.messages) || 0);
      case 'moderation':
        return Math.max(0, Number(point.moderation) || 0);
      default:
        return 0;
    }
  }

  protected timelineMetricMax(
    points: AdminStatsTimelinePointDto[],
    metric: AdminStatsTimelineMetric
  ): number {
    return Math.max(1, ...points.map(point => this.timelineMetricValue(point, metric)));
  }

  protected toneClass(value: { tone?: string | null } | null | undefined): string {
    const tone = `${value?.tone ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(tone)
      ? `is-${tone}`
      : 'is-slate';
  }

  protected itemLabel(item: AdminStatsBreakdownItemDto): string {
    return `${item.label ?? ''}`.trim() || `${item.key ?? ''}`.trim();
  }

  protected formatDate(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return `${value ?? ''}`.trim();
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private async load(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.beginLoadingProgress();
    this.error.set('');
    try {
      const [dashboard] = await Promise.all([
        this.admin.loadStatsDashboard(),
        this.routeDelay.waitForRouteDelay('/admin/stats', undefined, undefined, AdminStatsPopupComponent.LOAD_DEMO_DELAY_MS)
      ]);
      this.stats.set(dashboard);
      this.selectedTimeline.set(dashboard.timeline.at(-1) ?? null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load stats.');
    } finally {
      this.loading.set(false);
      this.endLoadingProgress();
    }
  }

  private beginLoadingProgress(): void {
    this.clearLoadingProgress();
    this.loadingProgressStartedAtMs = this.nowMs();
    this.loadingProgressTimer = setInterval(() => this.updateLoadingProgress(), 100);
    this.updateLoadingProgress();
  }

  private updateLoadingProgress(): void {
    if (!this.loadingProgressStartedAtMs) {
      this.loadingProgress.set(0);
      return;
    }
    const elapsedMs = Math.max(0, this.nowMs() - this.loadingProgressStartedAtMs);
    this.loadingProgress.set(Math.min(0.96, elapsedMs / AdminStatsPopupComponent.LOAD_PROGRESS_WINDOW_MS));
  }

  private endLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgress.set(1);
  }

  private clearLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgressStartedAtMs = 0;
    this.loadingProgress.set(0);
  }

  private clearLoadingProgressTimer(): void {
    if (!this.loadingProgressTimer) {
      return;
    }
    clearInterval(this.loadingProgressTimer);
    this.loadingProgressTimer = null;
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private updateTimelineFromPointer(event: PointerEvent, points: AdminStatsTimelinePointDto[]): void {
    const target = event.currentTarget as SVGSVGElement | null;
    if (!target || !points.length) {
      return;
    }
    const bounds = target.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const viewBoxX = ((event.clientX - bounds.left) / width) * 300;
    const ratio = this.clamp((viewBoxX - 12) / 276, 0, 1);
    const index = Math.round(ratio * Math.max(0, points.length - 1));
    this.selectedTimeline.set(points[this.clamp(index, 0, points.length - 1)] ?? points.at(-1) ?? null);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
