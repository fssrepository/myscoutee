import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type { OperatorRevenueDto } from '../../../shared/core/contracts/operator.interface';
import { OperatorRevenueViewComponent } from './operator-revenue-view.component';

describe('OperatorRevenueViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperatorRevenueViewComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            revision: () => 0,
            currentLanguage: () => 'en-US',
            translate: (value: string | null | undefined) => value ?? ''
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

  it('keeps every timeline line fixed while the selected guide moves', () => {
    const fixture = TestBed.createComponent(OperatorRevenueViewComponent);
    fixture.componentRef.setInput('revenue', revenueFixture());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const linePoints = () => [...host.querySelectorAll<SVGPolylineElement>(
      '.operator-revenue__line'
    )].map(line => line.getAttribute('points'));
    const before = linePoints();
    const guideBefore = host.querySelector<SVGLineElement>(
      '.operator-revenue__scrub-guide'
    )?.getAttribute('x1');

    expect(before[2]).toBe('12,88 288,70');
    const firstHit = host.querySelector<SVGCircleElement>('.operator-revenue__hit');
    firstHit?.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(linePoints()).toEqual(before);
    expect(
      host.querySelector<SVGLineElement>('.operator-revenue__scrub-guide')
        ?.getAttribute('x1')
    ).not.toBe(guideBefore);
    expect(
      host.querySelector<SVGCircleElement>('.operator-revenue__scrub-knob')
        ?.getAttribute('cy')
    ).toBe('88');
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
