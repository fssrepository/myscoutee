import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type { OperatorRevenueDto } from '../../../shared/core/contracts/operator.interface';
import { OperatorRevenueViewComponent } from './operator-revenue-view.component';

describe('OperatorRevenueViewComponent', () => {
  const translations: Readonly<Record<string, string>> = {
    'operator.revenue.ruleset.net-captured-revenue-v1': 'Net captured revenue (v1)'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperatorRevenueViewComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            revision: () => 0,
            currentLanguage: () => 'en-US',
            translate: (
              value: string | null | undefined,
              fallback?: string | null
            ) => translations[value ?? ''] ?? fallback ?? value ?? ''
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders only the selected currency and exposes a shared currency selector', () => {
    const fixture = TestBed.createComponent(OperatorRevenueViewComponent);
    fixture.componentRef.setInput('revenue', revenueFixture());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-menu')).not.toBeNull();
    expect(host.textContent).toContain('$10.00');
    expect(host.textContent).not.toContain('€20.00');
  });

  it('translates a known revenue ruleset and keeps unknown identifiers auditable', () => {
    const fixture = TestBed.createComponent(OperatorRevenueViewComponent);
    fixture.componentRef.setInput('revenue', revenueFixture());
    fixture.detectChanges();

    const ruleset = () => fixture.nativeElement.querySelector(
      '.operator-revenue__rules strong'
    ) as HTMLElement | null;
    expect(ruleset()?.textContent?.trim()).toBe('Net captured revenue (v1)');
    expect(ruleset()?.getAttribute('title')).toBe('net-captured-revenue-v1');

    fixture.componentRef.setInput('revenue', {
      ...revenueFixture(),
      rulesetVersion: 'future-revenue-v2'
    });
    fixture.detectChanges();

    expect(ruleset()?.textContent?.trim()).toBe('future-revenue-v2');
    expect(ruleset()?.getAttribute('title')).toBe('future-revenue-v2');
  });

  it('keeps every timeline line fixed while only the selected data dot moves', () => {
    const fixture = TestBed.createComponent(OperatorRevenueViewComponent);
    fixture.componentRef.setInput('revenue', revenueFixture());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector<SVGSVGElement>('.operator-revenue__chart svg')
        ?.classList.contains('motion-static')
    ).toBe(true);
    const linePoints = () => [...host.querySelectorAll<SVGPolylineElement>(
      '.operator-revenue__line'
    )].map(line => line.getAttribute('points'));
    const before = linePoints();
    const dot = host.querySelector<SVGCircleElement>(
      '.operator-revenue__scrub-knob'
    );
    const dotXBefore = dot?.getAttribute('cx');

    expect(before[2]).toBe('12,88 288,70');
    expect(host.querySelector('.operator-revenue__scrub-guide')).toBeNull();
    expect(host.querySelector('.operator-revenue__scrub-halo')).toBeNull();
    const chart = host.querySelector<SVGSVGElement>('.operator-revenue__chart svg');
    vi.spyOn(chart!, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 300,
      top: 0,
      bottom: 108,
      width: 300,
      height: 108,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    chart?.dispatchEvent(new MouseEvent('pointermove', { clientX: 12 }));
    fixture.detectChanges();

    expect(linePoints()).toEqual(before);
    expect(dot?.getAttribute('cx')).not.toBe(dotXBefore);
    expect(dot?.getAttribute('cy')).toBe('88');
  });
});

function revenueFixture(): OperatorRevenueDto {
  const currency = (
    currencyCode: string,
    netPaymentMinor: number
  ): OperatorRevenueDto['currencies'][number] => ({
    currencyCode,
    fractionDigits: 2,
    payableEvents: 1,
    payableAssets: 1,
    projectedEventMinor: netPaymentMinor,
    projectedAssetMinor: netPaymentMinor,
    capturedPaymentMinor: netPaymentMinor,
    refundedPaymentMinor: 0,
    netPaymentMinor,
    commissionBasisMinor: netPaymentMinor,
    estimatedCommissionMinor: Math.floor(netPaymentMinor * 500 / 10_000),
    paymentCount: 1,
    payingUsers: 1,
    eventBuyers: 1,
    assetBorrowers: 1,
    assetCategories: [],
    timeline: currencyCode === 'USD'
      ? [
          timelinePoint('2026-07-01', '1 Jul', 3_000, 1_000, 500),
          timelinePoint('2026-07-08', '8 Jul', 6_000, 2_000, 2_000)
        ]
      : []
  });
  return {
    generatedAtIso: '2026-07-28T18:00:00.000Z',
    rulesetVersion: 'net-captured-revenue-v1',
    commissionRateBasisPoints: 500,
    currencies: [
      currency('USD', 1_000),
      currency('EUR', 2_000)
    ]
  };
}

function timelinePoint(
  dateKey: string,
  label: string,
  projectedEventMinor: number,
  projectedAssetMinor: number,
  netPaymentMinor: number
): OperatorRevenueDto['currencies'][number]['timeline'][number] {
  return {
    dateKey,
    label,
    payableEvents: 1,
    payableAssets: 1,
    projectedEventMinor,
    projectedAssetMinor,
    capturedPaymentMinor: netPaymentMinor,
    refundedPaymentMinor: 0,
    netPaymentMinor,
    commissionBasisMinor: netPaymentMinor,
    estimatedCommissionMinor: Math.floor(netPaymentMinor * 500 / 10_000),
    paymentCount: 1,
    payingUsers: 1
  };
}
