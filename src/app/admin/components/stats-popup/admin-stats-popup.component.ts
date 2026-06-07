import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AdminStatsService, AppContext } from '../../../shared/core';
import { I18nPipe } from '../../../shared/ui';
import { ProgressIndicatorComponent } from '../../../shared/ui/components/progress-indicator';
import {
  type AdminStatsBreakdownItemDto,
  type AdminStatsDashboardDto,
  type AdminStatsGraphDto,
  type AdminStatsGraphTimelinePointDto,
  type AdminStatsMetricDto,
  type AdminStatsRevenueDto,
  type AdminStatsRevenueTimelinePointDto,
  type AdminStatsSegmentDto,
  type AdminStatsTimelinePointDto
} from '../../models/admin-stats.model';
import { AdminShellService } from '../../services/admin-shell.service';

type AdminStatsTimelineMetric = 'activeUsers' | 'registrations' | 'ratings' | 'activity' | 'messages' | 'moderation';
type AdminStatsGraphTimelineMetric = 'activeEdges' | 'newEdges' | 'recurringEdges' | 'weakTies' | 'networkQuality' | 'clusterQuality';
type AdminStatsRevenueTimelineMetric = 'projectedEventCents' | 'projectedAssetCents' | 'actualPaymentCents' | 'payingUsers';
type AdminStatsGraphFocus = { label?: string; labelKey?: string; value: string };
type AdminStatsGraphAction = { key: string; labelKey: string; icon: string; tone: string };

@Component({
  selector: 'app-admin-stats-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, ProgressIndicatorComponent, I18nPipe],
  templateUrl: './admin-stats-popup.component.html',
  styleUrl: './admin-stats-popup.component.scss'
})
export class AdminStatsPopupComponent {
  protected readonly admin = inject(AdminShellService);
  protected readonly statsService = inject(AdminStatsService);
  private readonly appCtx = inject(AppContext);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly stats = signal<AdminStatsDashboardDto | null>(null);
  protected readonly selectedTimeline = signal<AdminStatsTimelinePointDto | null>(null);
  protected readonly selectedGraphTimeline = signal<AdminStatsGraphTimelinePointDto | null>(null);
  protected readonly selectedRevenueTimeline = signal<AdminStatsRevenueTimelinePointDto | null>(null);
  protected readonly selectedGraphFocus = signal<AdminStatsGraphFocus | null>(null);
  protected readonly graphHelpOpen = signal(false);
  protected readonly timelineDragging = signal(false);
  protected readonly graphTimelineDragging = signal(false);
  protected readonly revenueTimelineDragging = signal(false);
  protected readonly topSegments = computed(() => this.stats()?.segments ?? []);
  protected readonly primaryKpis = computed(() => this.stats()?.kpis ?? []);
  protected readonly graph = computed(() => this.stats()?.graph ?? null);
  protected readonly revenue = computed(() => this.stats()?.revenue ?? null);
  protected readonly graphBridgeUsers = computed(() => this.graph()?.bridgeUsers.slice(0, 5) ?? []);
  protected readonly graphCommunities = computed(() => this.graph()?.communities.slice(0, 5) ?? []);
  protected readonly timelineMetrics: { key: AdminStatsTimelineMetric; labelKey: string; tone: string }[] = [
    { key: 'activeUsers', labelKey: 'stats.timeline.active.users', tone: 'blue' },
    { key: 'registrations', labelKey: 'stats.timeline.registrations', tone: 'green' },
    { key: 'ratings', labelKey: 'stats.timeline.ratings', tone: 'purple' },
    { key: 'activity', labelKey: 'stats.timeline.activity', tone: 'gold' },
    { key: 'messages', labelKey: 'stats.timeline.messages', tone: 'slate' },
    { key: 'moderation', labelKey: 'stats.timeline.moderation', tone: 'red' }
  ];
  protected readonly graphTimelineMetrics: { key: AdminStatsGraphTimelineMetric; labelKey: string; tone: string }[] = [
    { key: 'activeEdges', labelKey: 'stats.graph.timeline.active.edges', tone: 'blue' },
    { key: 'newEdges', labelKey: 'stats.graph.timeline.new.edges', tone: 'green' },
    { key: 'recurringEdges', labelKey: 'stats.graph.timeline.recurring.edges', tone: 'gold' },
    { key: 'weakTies', labelKey: 'stats.graph.timeline.weak.ties', tone: 'purple' },
    { key: 'networkQuality', labelKey: 'stats.graph.timeline.network.quality', tone: 'slate' },
    { key: 'clusterQuality', labelKey: 'stats.graph.timeline.cluster.quality', tone: 'red' }
  ];
  protected readonly revenueTimelineMetrics: { key: AdminStatsRevenueTimelineMetric; labelKey: string; tone: string }[] = [
    { key: 'projectedEventCents', labelKey: 'stats.revenue.timeline.projected.events', tone: 'green' },
    { key: 'projectedAssetCents', labelKey: 'stats.revenue.timeline.projected.assets', tone: 'blue' },
    { key: 'actualPaymentCents', labelKey: 'stats.revenue.timeline.actual.paid', tone: 'gold' },
    { key: 'payingUsers', labelKey: 'stats.revenue.timeline.paying.users', tone: 'purple' }
  ];
  constructor() {
    void this.load();
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected openGraphHelp(): void {
    this.graphHelpOpen.set(true);
  }

  protected closeGraphHelp(): void {
    this.graphHelpOpen.set(false);
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

  protected selectGraphTimelinePoint(point: AdminStatsGraphTimelinePointDto): void {
    this.selectedGraphTimeline.set(point);
  }

  protected startGraphTimelineDrag(event: PointerEvent, points: AdminStatsGraphTimelinePointDto[]): void {
    if (!points.length) {
      return;
    }
    this.graphTimelineDragging.set(true);
    this.updateGraphTimelineFromPointer(event, points);
    const target = event.currentTarget as SVGSVGElement | null;
    target?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected moveGraphTimelineDrag(event: PointerEvent, points: AdminStatsGraphTimelinePointDto[]): void {
    if (!this.graphTimelineDragging()) {
      return;
    }
    this.updateGraphTimelineFromPointer(event, points);
    event.preventDefault();
  }

  protected endGraphTimelineDrag(event?: PointerEvent): void {
    if (!this.graphTimelineDragging()) {
      return;
    }
    this.graphTimelineDragging.set(false);
    const target = event?.currentTarget as SVGSVGElement | null;
    if (event && target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  protected selectRevenueTimelinePoint(point: AdminStatsRevenueTimelinePointDto): void {
    this.selectedRevenueTimeline.set(point);
  }

  protected startRevenueTimelineDrag(event: PointerEvent, points: AdminStatsRevenueTimelinePointDto[]): void {
    if (!points.length) {
      return;
    }
    this.revenueTimelineDragging.set(true);
    this.updateRevenueTimelineFromPointer(event, points);
    const target = event.currentTarget as SVGSVGElement | null;
    target?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected moveRevenueTimelineDrag(event: PointerEvent, points: AdminStatsRevenueTimelinePointDto[]): void {
    if (!this.revenueTimelineDragging()) {
      return;
    }
    this.updateRevenueTimelineFromPointer(event, points);
    event.preventDefault();
  }

  protected endRevenueTimelineDrag(event?: PointerEvent): void {
    if (!this.revenueTimelineDragging()) {
      return;
    }
    this.revenueTimelineDragging.set(false);
    const target = event?.currentTarget as SVGSVGElement | null;
    if (event && target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  protected selectGraphFocus(label: string | null | undefined, value: string | number, labelKey = ''): void {
    this.selectedGraphFocus.set({
      label: `${label ?? ''}`.trim(),
      labelKey: `${labelKey ?? ''}`.trim(),
      value: `${value ?? ''}`.trim()
    });
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

  protected selectedGraphTimelinePoint(graph: AdminStatsGraphDto): AdminStatsGraphTimelinePointDto | null {
    const selected = this.selectedGraphTimeline();
    if (selected && graph.timeline.some(point => point.dateKey === selected.dateKey)) {
      return selected;
    }
    return graph.timeline.at(-1) ?? null;
  }

  protected selectedGraphTimelineIndex(graph: AdminStatsGraphDto): number {
    const point = this.selectedGraphTimelinePoint(graph);
    if (!point) {
      return -1;
    }
    return graph.timeline.findIndex(item => item.dateKey === point.dateKey);
  }

  protected selectedGraphTimelineX(graph: AdminStatsGraphDto): number {
    const index = this.selectedGraphTimelineIndex(graph);
    return index < 0 ? this.timelineX(Math.max(0, graph.timeline.length - 1), graph.timeline.length) : this.timelineX(index, graph.timeline.length);
  }

  protected selectedGraphTimelineY(graph: AdminStatsGraphDto): number {
    const point = this.selectedGraphTimelinePoint(graph);
    if (!point) {
      return this.timelineY(0, 1);
    }
    return this.timelineY(point.activeEdges, this.graphTimelineMetricMax(graph.timeline, 'activeEdges'));
  }

  protected selectedRevenueTimelinePoint(revenue: AdminStatsRevenueDto): AdminStatsRevenueTimelinePointDto | null {
    const selected = this.selectedRevenueTimeline();
    if (selected && revenue.timeline.some(point => point.dateKey === selected.dateKey)) {
      return selected;
    }
    return revenue.timeline.at(-1) ?? null;
  }

  protected selectedRevenueTimelineIndex(revenue: AdminStatsRevenueDto): number {
    const point = this.selectedRevenueTimelinePoint(revenue);
    if (!point) {
      return -1;
    }
    return revenue.timeline.findIndex(item => item.dateKey === point.dateKey);
  }

  protected selectedRevenueTimelineX(revenue: AdminStatsRevenueDto): number {
    const index = this.selectedRevenueTimelineIndex(revenue);
    return index < 0 ? this.timelineX(Math.max(0, revenue.timeline.length - 1), revenue.timeline.length) : this.timelineX(index, revenue.timeline.length);
  }

  protected selectedRevenueTimelineY(revenue: AdminStatsRevenueDto): number {
    const point = this.selectedRevenueTimelinePoint(revenue);
    if (!point) {
      return this.timelineY(0, 1);
    }
    return this.timelineY(point.projectedEventCents, this.revenueTimelineMetricMax(revenue.timeline, 'projectedEventCents'));
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

  protected graphTimelineChartPoints(
    points: AdminStatsGraphTimelinePointDto[],
    metric: AdminStatsGraphTimelineMetric
  ): string {
    if (!points.length) {
      return '';
    }
    const max = this.graphTimelineMetricMax(points, metric);
    return points
      .map((point, index) => `${this.timelineX(index, points.length)},${this.timelineY(this.graphTimelineMetricValue(point, metric), max)}`)
      .join(' ');
  }

  protected revenueTimelineChartPoints(
    points: AdminStatsRevenueTimelinePointDto[],
    metric: AdminStatsRevenueTimelineMetric
  ): string {
    if (!points.length) {
      return '';
    }
    const max = this.revenueTimelineMetricMax(points, metric);
    return points
      .map((point, index) => `${this.timelineX(index, points.length)},${this.timelineY(this.revenueTimelineMetricValue(point, metric), max)}`)
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

  protected graphTimelineMetricValue(point: AdminStatsGraphTimelinePointDto, metric: AdminStatsGraphTimelineMetric): number {
    switch (metric) {
      case 'activeEdges':
        return Math.max(0, Number(point.activeEdges) || 0);
      case 'newEdges':
        return Math.max(0, Number(point.newEdges) || 0);
      case 'recurringEdges':
        return Math.max(0, Number(point.recurringEdges) || 0);
      case 'weakTies':
        return Math.max(0, Number(point.weakTies) || 0);
      case 'networkQuality':
        return Math.max(0, Number(point.networkQuality) || 0);
      case 'clusterQuality':
        return Math.max(0, Number(point.clusterQuality) || 0);
      default:
        return 0;
    }
  }

  protected revenueTimelineMetricValue(point: AdminStatsRevenueTimelinePointDto, metric: AdminStatsRevenueTimelineMetric): number {
    switch (metric) {
      case 'projectedEventCents':
        return Math.max(0, Number(point.projectedEventCents) || 0);
      case 'projectedAssetCents':
        return Math.max(0, Number(point.projectedAssetCents) || 0);
      case 'actualPaymentCents':
        return Math.max(0, Number(point.actualPaymentCents) || 0);
      case 'payingUsers':
        return Math.max(0, Number(point.payingUsers) || 0);
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

  protected graphTimelineMetricMax(
    points: AdminStatsGraphTimelinePointDto[],
    metric: AdminStatsGraphTimelineMetric
  ): number {
    return Math.max(1, ...points.map(point => this.graphTimelineMetricValue(point, metric)));
  }

  protected revenueTimelineMetricMax(
    points: AdminStatsRevenueTimelinePointDto[],
    metric: AdminStatsRevenueTimelineMetric
  ): number {
    return Math.max(1, ...points.map(point => this.revenueTimelineMetricValue(point, metric)));
  }

  protected graphNodeX(index: number, total: number, radius = 34): number {
    const angle = this.graphNodeAngle(index, total);
    return Math.round(50 + Math.cos(angle) * radius);
  }

  protected graphNodeY(index: number, total: number, radius = 34): number {
    const angle = this.graphNodeAngle(index, total);
    return Math.round(50 + Math.sin(angle) * radius);
  }

  protected graphNodeRadius(item: AdminStatsBreakdownItemDto): number {
    return this.clamp(5 + this.itemPercent(item) / 10, 6, 14);
  }

  protected graphCommunityX(index: number, total: number): number {
    return this.graphFixedPoint(index, total, [
      [26, 28],
      [70, 30],
      [30, 72],
      [72, 70],
      [50, 18]
    ], 0);
  }

  protected graphCommunityY(index: number, total: number): number {
    return this.graphFixedPoint(index, total, [
      [26, 28],
      [70, 30],
      [30, 72],
      [72, 70],
      [50, 18]
    ], 1);
  }

  protected graphBridgeX(index: number, total: number): number {
    return this.graphFixedPoint(index, total, [
      [50, 50],
      [49, 32],
      [50, 68],
      [39, 51],
      [62, 52]
    ], 0);
  }

  protected graphBridgeY(index: number, total: number): number {
    return this.graphFixedPoint(index, total, [
      [50, 50],
      [49, 32],
      [50, 68],
      [39, 51],
      [62, 52]
    ], 1);
  }

  protected graphCommunityRadius(item: AdminStatsBreakdownItemDto): number {
    return this.clamp(9 + this.itemPercent(item) / 7, 10, 16);
  }

  protected graphBridgeRadius(item: AdminStatsBreakdownItemDto): number {
    return this.clamp(5 + this.itemPercent(item) / 18, 6, 10);
  }

  protected graphBridgeCommunityIndex(index: number, total: number, offset: number): number {
    if (total <= 0) {
      return 0;
    }
    return (Math.max(0, index) + Math.max(0, offset)) % total;
  }

  protected compactGraphValue(value: number | string | null | undefined): string {
    const numericValue = Math.max(0, Math.trunc(Number(value) || 0));
    if (numericValue >= 1000) {
      return `${Math.round(numericValue / 100) / 10}k`;
    }
    return `${numericValue}`;
  }

  private graphFixedPoint(index: number, total: number, points: number[][], axis: 0 | 1): number {
    if (index >= 0 && index < points.length) {
      return points[index][axis] ?? 50;
    }
    const angle = this.graphNodeAngle(index, Math.max(1, total));
    const radius = axis === 0 ? 32 : 30;
    const center = axis === 0 ? 50 : 50;
    const trig = axis === 0 ? Math.cos(angle) : Math.sin(angle);
    return Math.round(center + trig * radius);
  }

  protected graphAdminActions(graph: AdminStatsGraphDto): AdminStatsGraphAction[] {
    const signalValue = (key: string): number => {
      const signal = graph.signals.find(item => item.key === key);
      return Math.trunc(Number(signal?.value) || 0);
    };
    const metricValue = (key: string): number => {
      const metric = graph.metrics.find(item => item.key === key);
      return Math.trunc(Number(metric?.value) || 0);
    };
    const actions: AdminStatsGraphAction[] = [];
    const add = (key: string, labelKey: string, icon: string, tone: string): void => {
      if (actions.some(action => action.key === key)) {
        return;
      }
      actions.push({ key, labelKey, icon, tone });
    };

    if (graph.healthScore < 42 || metricValue('graph-edges') < 24) {
      add('collect-evidence', 'stats.graph.action.collect.evidence', 'add_chart', 'blue');
    }
    if (signalValue('reachability-2-hop') < 58) {
      add('increase-reach', 'stats.graph.action.increase.reach', 'share', 'blue');
    }
    if (signalValue('bridge-coverage') < 22 || metricValue('graph-bridges') < 3) {
      add('activate-bridges', 'stats.graph.action.activate.bridges', 'conversion_path', 'red');
    }
    if (signalValue('weak-tie-ratio') < 30) {
      add('open-discovery', 'stats.graph.action.open.discovery', 'travel_explore', 'purple');
    }
    if (signalValue('clustering') > 68 || signalValue('largest-community') > 52) {
      add('break-cliques', 'stats.graph.action.break.cliques', 'hub', 'gold');
    }
    if (signalValue('recurring-edge-ratio') < 28) {
      add('grow-recurring', 'stats.graph.action.grow.recurring', 'repeat', 'green');
    }
    if (signalValue('network-quality') < 48) {
      add('improve-quality', 'stats.graph.action.improve.quality', 'ssid_chart', 'slate');
    }
    if (signalValue('cluster-quality') < 48) {
      add('balance-clusters', 'stats.graph.action.balance.clusters', 'bubble_chart', 'green');
    }

    return actions.length > 0
      ? actions.slice(0, 4)
      : [{ key: 'keep-balance', labelKey: 'stats.graph.action.keep.balance', icon: 'check_circle', tone: 'green' }];
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

  protected moneyFromCents(value: number | null | undefined): string {
    const cents = Math.max(0, Math.trunc(Number(value) || 0));
    return `$${Math.trunc(cents / 100).toLocaleString()}.${`${cents % 100}`.padStart(2, '0')}`;
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
    this.error.set('');
    try {
      const dashboard = await this.statsService.loadStatsDashboard(this.activeAdminId());
      this.stats.set(dashboard);
      this.selectedTimeline.set(dashboard.timeline.at(-1) ?? null);
      this.selectedGraphTimeline.set(dashboard.graph.timeline.at(-1) ?? null);
      this.selectedRevenueTimeline.set(dashboard.revenue.timeline.at(-1) ?? null);
      this.selectedGraphFocus.set({
        labelKey: 'stats.graph.metric.health',
        value: `${dashboard.graph.healthScore}`
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load stats.');
    } finally {
      this.loading.set(false);
    }
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

  private updateGraphTimelineFromPointer(event: PointerEvent, points: AdminStatsGraphTimelinePointDto[]): void {
    const target = event.currentTarget as SVGSVGElement | null;
    if (!target || !points.length) {
      return;
    }
    const bounds = target.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const viewBoxX = ((event.clientX - bounds.left) / width) * 300;
    const ratio = this.clamp((viewBoxX - 12) / 276, 0, 1);
    const index = Math.round(ratio * Math.max(0, points.length - 1));
    this.selectedGraphTimeline.set(points[this.clamp(index, 0, points.length - 1)] ?? points.at(-1) ?? null);
  }

  private updateRevenueTimelineFromPointer(event: PointerEvent, points: AdminStatsRevenueTimelinePointDto[]): void {
    const target = event.currentTarget as SVGSVGElement | null;
    if (!target || !points.length) {
      return;
    }
    const bounds = target.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const viewBoxX = ((event.clientX - bounds.left) / width) * 300;
    const ratio = this.clamp((viewBoxX - 12) / 276, 0, 1);
    const index = Math.round(ratio * Math.max(0, points.length - 1));
    this.selectedRevenueTimeline.set(points[this.clamp(index, 0, points.length - 1)] ?? points.at(-1) ?? null);
  }

  private graphNodeAngle(index: number, total: number): number {
    return -Math.PI / 2 + (Math.max(0, index) * Math.PI * 2) / Math.max(1, total);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private activeAdminId(): string {
    return this.appCtx.activeUserId().trim();
  }
}
