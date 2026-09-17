import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { PricingCancellationPolicy, PricingCancellationRule } from '../../../core/contracts/pricing.interface';
import type { PaymentRefundPreviewDto } from '../../../core/contracts/payment-method.interface';
import { I18nPipe } from '../../pipes/i18n.pipe';

@Component({
  selector: 'app-payment-refund-policy',
  standalone: true,
  imports: [MatIconModule, I18nPipe],
  templateUrl: './payment-refund-policy.component.html',
  styleUrl: './payment-refund-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentRefundPolicyComponent {
  private readonly i18n = inject(I18nService);
  @Input() policy: PricingCancellationPolicy | null = null;
  @Input() bookingStartAtIso = '';
  @Input() totalAmount = 0;
  @Input() currency = 'USD';
  @Input() preview: PaymentRefundPreviewDto | null = null;
  @Input() unavailable = false;

  protected rules(): PricingCancellationRule[] {
    return this.policy?.enabled ? this.policy.rules ?? [] : [];
  }

  protected money(amount: number): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: this.currency }).format(amount);
  }

  protected ruleWindow(rule: PricingCancellationRule): string {
    const value = Math.max(0, Number(rule.offsetValue) || 0);
    const unit = rule.offsetUnit || 'days';
    return this.i18n.translateParams('asset.borrow.cancellation.window', {
      value, unit: this.i18n.translate(`asset.borrow.unit.${value === 1 ? unit.replace(/s$/, '') : unit}`)
    });
  }

  protected ruleRefund(rule: PricingCancellationRule): string {
    if (rule.refundKind === 'full') return this.i18n.translate('full.refund');
    if (rule.refundKind === 'none') return this.i18n.translate('no.refund');
    if (rule.refundKind === 'fixed_amount') return this.money(Math.max(0, Number(rule.refundValue) || 0));
    return this.i18n.translateParams('asset.borrow.refund.percent', { percent: rule.refundValue ?? 0 });
  }

  protected summary(): { amount: number; note: string } {
    if (this.preview) {
      const rule = this.rules().find(item => item.id === this.preview?.ruleId);
      return { amount: this.preview.refundableAmount,
        note: rule ? this.describe(rule) : this.preview.ruleDescription || this.i18n.translate(this.rules().length
          ? 'asset.borrow.cancellation.windows.passed' : 'payment.history.refund.preview.no.policy') };
    }
    if (!this.rules().length) {
      return { amount: 0, note: this.i18n.translate('payment.history.refund.preview.no.policy') };
    }
    // Match PaymentRefundCalculator: UTC offsets and the earliest eligible deadline.
    const startText = this.bookingStartAtIso.trim();
    const start = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(startText) ? startText : `${startText}Z`);
    const eligible = this.rules().map(rule => ({ rule, deadline: this.deadline(rule, start) }))
      .filter(item => Number.isFinite(item.deadline) && Date.now() <= item.deadline)
      .sort((a, b) => a.deadline - b.deadline)[0]?.rule;
    if (!eligible) {
      return { amount: 0, note: this.i18n.translate('asset.borrow.cancellation.windows.passed') };
    }
    const paid = Math.max(0, this.totalAmount);
    const value = Math.max(0, Number(eligible.refundValue) || 0);
    const amount = eligible.refundKind === 'full' ? paid
      : eligible.refundKind === 'none' ? 0
      : eligible.refundKind === 'fixed_amount' ? Math.min(paid, value)
      : paid * Math.min(100, value) / 100;
    return { amount: Math.round(amount * 100) / 100, note: this.describe(eligible) };
  }

  private describe(rule: PricingCancellationRule): string {
    return this.i18n.translateParams('asset.borrow.cancellation.rule.description', {
      refund: this.ruleRefund(rule), window: this.ruleWindow(rule)
    });
  }

  private deadline(rule: PricingCancellationRule, start: Date): number {
    const date = new Date(start.getTime());
    const offset = Math.max(0, Math.trunc(Number(rule.offsetValue) || 0));
    if (rule.offsetUnit === 'months') {
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day, lastDay));
    } else if (rule.offsetUnit === 'hours') {
      date.setUTCHours(date.getUTCHours() - offset);
    } else {
      date.setUTCDate(date.getUTCDate() - offset * (rule.offsetUnit === 'weeks' ? 7 : 1));
    }
    return date.getTime();
  }
}
