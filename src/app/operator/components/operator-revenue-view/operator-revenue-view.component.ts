import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
  signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type {
  OperatorRevenueAssetCategoryDto,
  OperatorRevenueCurrencyDto,
  OperatorRevenueDto,
  OperatorRevenueTimelinePointDto,
  OperatorRevenueTone
} from '../../../shared/core/contracts/operator.interface';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger
} from '../../../shared/ui/components/core/menu';
import { I18nPipe } from '../../../shared/ui/pipes';

type OperatorRevenueTimelineMetric =
  | 'projectedEventMinor'
  | 'projectedAssetMinor'
  | 'netPaymentMinor'
  | 'estimatedCommissionMinor';

interface OperatorRevenueMetricView {
  key: string;
  labelKey: string;
  valueLabel: string;
  icon: string;
  tone: OperatorRevenueTone;
  percent: number;
}

interface OperatorRevenueCurrencyContext {
  currencyCode: string;
}

@Component({
  selector: 'app-operator-revenue-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    CommonModule,
    I18nPipe,
    MatIconModule
  ],
  templateUrl: './operator-revenue-view.component.html',
  styleUrl: './operator-revenue-view.component.scss'
})
export class OperatorRevenueViewComponent {
  private readonly i18n = inject(I18nService);
  private revenueRef: OperatorRevenueDto | null = null;
  private readonly selectedCurrencyCode = signal('');
  protected readonly selectedTimeline = signal<OperatorRevenueTimelinePointDto | null>(null);
  protected readonly timelineDragging = signal(false);
  protected readonly timelineMetrics: readonly {
    key: OperatorRevenueTimelineMetric;
    labelKey: string;
    tone: OperatorRevenueTone;
  }[] = [
    {
      key: 'projectedEventMinor',
      labelKey: 'operator.revenue.timeline.projected.events',
      tone: 'green'
    },
    {
      key: 'projectedAssetMinor',
      labelKey: 'operator.revenue.timeline.projected.assets',
      tone: 'blue'
    },
    {
      key: 'netPaymentMinor',
      labelKey: 'operator.revenue.timeline.net.payments',
      tone: 'gold'
    },
    {
      key: 'estimatedCommissionMinor',
      labelKey: 'operator.revenue.timeline.estimated.commission',
      tone: 'purple'
    }
  ];

  @Input({ required: true })
  set revenue(value: OperatorRevenueDto | null | undefined) {
    this.revenueRef = value ?? null;
    const selected = this.selectedCurrency();
    this.selectedCurrencyCode.set(
      selected?.currencyCode
      ?? value?.currencies[0]?.currencyCode
      ?? ''
    );
    this.selectedTimeline.set(this.selectedCurrency()?.timeline.at(-1) ?? null);
    this.timelineDragging.set(false);
  }

  protected revenueModel(): OperatorRevenueDto | null {
    return this.revenueRef;
  }

  protected selectedCurrency(): OperatorRevenueCurrencyDto | null {
    const currencies = this.revenueRef?.currencies ?? [];
    const selectedCode = this.selectedCurrencyCode().trim().toUpperCase();
    return currencies.find(
      currency => currency.currencyCode.trim().toUpperCase() === selectedCode
    ) ?? currencies[0] ?? null;
  }

  protected rulesetLabelKey(value: string | null | undefined): string {
    const rulesetVersion = `${value ?? ''}`.trim();
    return rulesetVersion
      ? `operator.revenue.ruleset.${rulesetVersion}`
      : '';
  }

  protected currencyTrigger(): AppMenuTrigger {
    const currency = this.selectedCurrency();
    return {
      label: currency?.currencyCode || 'operator.revenue.currency.select',
      icon: 'currency_exchange',
      palette: 'green',
      layout: 'field',
      ariaLabel: 'operator.revenue.currency.select'
    };
  }

  protected currencyItems(): readonly AppMenuItem<
    string,
    OperatorRevenueCurrencyContext
  >[] {
    const selectedCode = this.selectedCurrency()?.currencyCode ?? '';
    const palettes = ['green', 'blue', 'gold', 'violet', 'teal'] as const;
    return (this.revenueRef?.currencies ?? []).map((currency, index) => ({
      id: `operator-revenue-currency-${currency.currencyCode.toLowerCase()}`,
      label: currency.currencyCode,
      detail: this.formatMinor(currency.netPaymentMinor, currency),
      icon: 'payments',
      kind: 'radio',
      palette: palettes[index % palettes.length],
      active: currency.currencyCode === selectedCode,
      checked: currency.currencyCode === selectedCode,
      context: {
        currencyCode: currency.currencyCode
      }
    }));
  }

  protected onCurrencySelect(
    event: AppMenuItemSelectEvent<string, OperatorRevenueCurrencyContext>
  ): void {
    const currencyCode = event.context?.currencyCode?.trim() ?? '';
    if (!currencyCode) {
      return;
    }
    this.selectedCurrencyCode.set(currencyCode);
    this.selectedTimeline.set(this.selectedCurrency()?.timeline.at(-1) ?? null);
    this.timelineDragging.set(false);
  }

  protected metrics(currency: OperatorRevenueCurrencyDto): readonly OperatorRevenueMetricView[] {
    const amountMax = Math.max(
      1,
      currency.projectedEventMinor,
      currency.projectedAssetMinor,
      currency.capturedPaymentMinor,
      currency.refundedPaymentMinor,
      currency.netPaymentMinor,
      currency.commissionBasisMinor,
      currency.estimatedCommissionMinor
    );
    const countMax = Math.max(
      1,
      currency.payableEvents,
      currency.payableAssets,
      currency.paymentCount,
      currency.payingUsers,
      currency.eventBuyers,
      currency.assetBorrowers
    );
    const amount = (
      key: string,
      labelKey: string,
      value: number,
      icon: string,
      tone: OperatorRevenueTone
    ): OperatorRevenueMetricView => ({
      key,
      labelKey,
      valueLabel: this.formatMinor(value, currency),
      icon,
      tone,
      percent: this.percent(value, amountMax)
    });
    const count = (
      key: string,
      labelKey: string,
      value: number,
      icon: string,
      tone: OperatorRevenueTone
    ): OperatorRevenueMetricView => ({
      key,
      labelKey,
      valueLabel: this.formatNumber(value),
      icon,
      tone,
      percent: this.percent(value, countMax)
    });

    return [
      count(
        'payable-events',
        'operator.revenue.metric.payable.events',
        currency.payableEvents,
        'confirmation_number',
        'green'
      ),
      amount(
        'projected-events',
        'operator.revenue.metric.projected.events',
        currency.projectedEventMinor,
        'event_available',
        'green'
      ),
      count(
        'payable-assets',
        'operator.revenue.metric.payable.assets',
        currency.payableAssets,
        'inventory_2',
        'purple'
      ),
      amount(
        'projected-assets',
        'operator.revenue.metric.projected.assets',
        currency.projectedAssetMinor,
        'category',
        'blue'
      ),
      amount(
        'captured-payments',
        'operator.revenue.metric.captured.payments',
        currency.capturedPaymentMinor,
        'paid',
        'blue'
      ),
      amount(
        'refunded-payments',
        'operator.revenue.metric.refunded.payments',
        currency.refundedPaymentMinor,
        'currency_exchange',
        'red'
      ),
      amount(
        'net-payments',
        'operator.revenue.metric.net.payments',
        currency.netPaymentMinor,
        'account_balance_wallet',
        'gold'
      ),
      amount(
        'commission-basis',
        'operator.revenue.metric.commission.basis',
        currency.commissionBasisMinor,
        'calculate',
        'slate'
      ),
      amount(
        'estimated-commission',
        'operator.revenue.metric.estimated.commission',
        currency.estimatedCommissionMinor,
        'savings',
        'purple'
      ),
      count(
        'payments',
        'operator.revenue.metric.payment.count',
        currency.paymentCount,
        'receipt_long',
        'slate'
      ),
      count(
        'paying-users',
        'operator.revenue.metric.paying.users',
        currency.payingUsers,
        'group',
        'red'
      ),
      count(
        'event-buyers',
        'operator.revenue.metric.event.buyers',
        currency.eventBuyers,
        'local_activity',
        'green'
      ),
      count(
        'asset-borrowers',
        'operator.revenue.metric.asset.borrowers',
        currency.assetBorrowers,
        'assignment_returned',
        'gold'
      )
    ];
  }

  protected selectedTimelinePoint(
    currency: OperatorRevenueCurrencyDto
  ): OperatorRevenueTimelinePointDto | null {
    const selected = this.selectedTimeline();
    if (selected && currency.timeline.some(point => point.dateKey === selected.dateKey)) {
      return selected;
    }
    return currency.timeline.at(-1) ?? null;
  }

  protected selectedTimelineX(currency: OperatorRevenueCurrencyDto): number {
    const selected = this.selectedTimelinePoint(currency);
    const index = selected
      ? currency.timeline.findIndex(point => point.dateKey === selected.dateKey)
      : -1;
    return this.timelineX(
      index < 0 ? Math.max(0, currency.timeline.length - 1) : index,
      currency.timeline.length
    );
  }

  protected selectedTimelineY(currency: OperatorRevenueCurrencyDto): number {
    const selected = this.selectedTimelinePoint(currency);
    return this.timelineY(
      selected?.netPaymentMinor ?? 0,
      this.timelineDomainMax(currency.timeline)
    );
  }

  protected selectTimelinePoint(point: OperatorRevenueTimelinePointDto): void {
    this.selectedTimeline.set(point);
  }

  protected startTimelineDrag(
    event: PointerEvent,
    points: readonly OperatorRevenueTimelinePointDto[]
  ): void {
    if (!points.length) {
      return;
    }
    this.timelineDragging.set(true);
    this.updateTimelineFromPointer(event, points);
    const target = event.currentTarget as SVGSVGElement | null;
    target?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected moveTimelineDrag(
    event: PointerEvent,
    points: readonly OperatorRevenueTimelinePointDto[]
  ): void {
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

  protected timelineChartPoints(
    points: readonly OperatorRevenueTimelinePointDto[],
    metric: OperatorRevenueTimelineMetric
  ): string {
    if (!points.length) {
      return '';
    }
    const domainMax = this.timelineDomainMax(points);
    return points
      .map((point, index) =>
        `${this.timelineX(index, points.length)},${this.timelineY(
          this.timelineMetricValue(point, metric),
          domainMax
        )}`
      )
      .join(' ');
  }

  protected formatMinor(
    value: number | null | undefined,
    currency: OperatorRevenueCurrencyDto
  ): string {
    const fractionDigits = this.clamp(
      Math.trunc(Number(currency.fractionDigits) || 0),
      0,
      6
    );
    const minor = Math.trunc(Number(value) || 0);
    const major = minor / 10 ** fractionDigits;
    const currencyCode = currency.currencyCode.trim().toUpperCase();
    try {
      return new Intl.NumberFormat(this.i18n.currentLanguage(), {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      }).format(major);
    } catch {
      return `${currencyCode} ${major.toFixed(fractionDigits)}`.trim();
    }
  }

  protected commissionRateLabel(value: number): string {
    return new Intl.NumberFormat(this.i18n.currentLanguage(), {
      style: 'percent',
      minimumFractionDigits: value % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(Math.max(0, Number(value) || 0) / 10_000);
  }

  protected categoryPercent(
    category: OperatorRevenueAssetCategoryDto,
    currency: OperatorRevenueCurrencyDto
  ): number {
    return this.percent(category.projectedMinor, currency.projectedAssetMinor);
  }

  protected itemLabel(category: OperatorRevenueAssetCategoryDto): string {
    return category.label?.trim() || category.labelKey.trim() || category.key.trim();
  }

  protected toneClass(value: { tone?: string | null } | null | undefined): string {
    const tone = `${value?.tone ?? ''}`.trim();
    return ['blue', 'green', 'gold', 'red', 'purple', 'slate'].includes(tone)
      ? `is-${tone}`
      : 'is-slate';
  }

  private timelineMetricValue(
    point: OperatorRevenueTimelinePointDto,
    metric: OperatorRevenueTimelineMetric
  ): number {
    return Math.max(0, Number(point[metric]) || 0);
  }

  private timelineDomainMax(
    points: readonly OperatorRevenueTimelinePointDto[]
  ): number {
    return Math.max(
      1,
      ...points.flatMap(point =>
        this.timelineMetrics.map(metric =>
          this.timelineMetricValue(point, metric.key)
        )
      )
    );
  }

  private timelineX(index: number, total: number): number {
    return Math.round(12 + (Math.max(0, index) * 276) / Math.max(1, total - 1));
  }

  private timelineY(value: number, max: number): number {
    return Math.round(94 - (this.clamp(value, 0, max) * 72) / Math.max(1, max));
  }

  private updateTimelineFromPointer(
    event: PointerEvent,
    points: readonly OperatorRevenueTimelinePointDto[]
  ): void {
    const target = event.currentTarget as SVGSVGElement | null;
    if (!target || !points.length) {
      return;
    }
    const bounds = target.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const viewBoxX = ((event.clientX - bounds.left) / width) * 300;
    const ratio = this.clamp((viewBoxX - 12) / 276, 0, 1);
    const index = Math.round(ratio * Math.max(0, points.length - 1));
    this.selectedTimeline.set(
      points[this.clamp(index, 0, points.length - 1)]
      ?? points.at(-1)
      ?? null
    );
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat(this.i18n.currentLanguage(), {
      maximumFractionDigits: 0
    }).format(Math.max(0, Math.trunc(Number(value) || 0)));
  }

  private percent(value: number, total: number): number {
    return this.clamp(
      Math.round(Math.max(0, Number(value) || 0) * 100 / Math.max(1, total)),
      0,
      100
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
