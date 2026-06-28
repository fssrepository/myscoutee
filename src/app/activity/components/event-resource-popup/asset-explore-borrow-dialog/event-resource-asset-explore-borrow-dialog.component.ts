import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';

import { IndicatorComponent } from '../../../../shared/ui';
import { AppUtils } from '../../../../shared/app-utils';
import type * as ActivityContracts from '../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../shared/core/contracts';

export interface AssetExploreBorrowDialogViewState {
  title: string;
  subtitle: string;
  timeframe: string;
  quantity: number;
  availableQuantity: number;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  lineItems: ActivityContracts.EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  bookingStartAtIso: string;
  cancellationPolicy: ContractTypes.PricingCancellationPolicy | null;
  policies: ContractTypes.EventPolicyDTO[];
  acceptedPolicyIds: string[];
  payable: boolean;
  paymentStep: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
}

export interface AssetExploreBorrowDateRangeChange {
  start: Date | null;
  end: Date | null;
}

export interface AssetExploreBorrowTimeChange {
  edge: 'start' | 'end';
  value: string;
}

@Component({
  selector: 'app-event-resource-asset-explore-borrow-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatTimepickerModule,
    IndicatorComponent
  ],
  templateUrl: './event-resource-asset-explore-borrow-dialog.component.html',
  styleUrl: './event-resource-asset-explore-borrow-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceAssetExploreBorrowDialogComponent {
  @Input() dialog: AssetExploreBorrowDialogViewState | null = null;
  @Input() canSubmit = false;

  @Output() closeRequested = new EventEmitter<Event | undefined>();
  @Output() backRequested = new EventEmitter<Event | undefined>();
  @Output() dateRangeChanged = new EventEmitter<AssetExploreBorrowDateRangeChange>();
  @Output() timeChanged = new EventEmitter<AssetExploreBorrowTimeChange>();
  @Output() quantityChanged = new EventEmitter<number | string>();
  @Output() quantityBlurred = new EventEmitter<number | string>();
  @Output() policyToggled = new EventEmitter<string>();
  @Output() confirmRequested = new EventEmitter<Event | undefined>();

  protected formatMoney(amount: number, currency = 'USD'): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return `EUR ${(Number(amount) || 0).toFixed(2)}`;
      case 'GBP':
        return `GBP ${(Number(amount) || 0).toFixed(2)}`;
      default:
        return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  protected showCancellationPolicyCard(dialog: AssetExploreBorrowDialogViewState): boolean {
    return dialog.totalAmount > 0
      && dialog.cancellationPolicy?.enabled === true
      && (dialog.cancellationPolicy.rules?.length ?? 0) > 0;
  }

  protected cancellationPreview(dialog: AssetExploreBorrowDialogViewState): { refundLabel: string; note: string } | null {
    if (!this.showCancellationPolicyCard(dialog)) {
      return null;
    }
    const applicableRule = this.applicableCancellationRule(dialog);
    if (!applicableRule) {
      return {
        refundLabel: 'No reimbursement',
        note: 'The configured cancellation windows have already passed.'
      };
    }
    const refundAmount = this.cancellationRefundAmount(applicableRule, dialog.totalAmount);
    return {
      refundLabel: refundAmount > 0
        ? `${this.formatMoney(refundAmount, dialog.currency)} refundable right now`
        : 'No reimbursement',
      note: this.describeCancellationRule(applicableRule, dialog.currency)
    };
  }

  protected cancellationRules(dialog: AssetExploreBorrowDialogViewState): ContractTypes.PricingCancellationRule[] {
    return dialog.cancellationPolicy?.rules ?? [];
  }

  protected cancellationRuleWindowLabel(rule: ContractTypes.PricingCancellationRule): string {
    const value = Math.max(0, Number(rule.offsetValue) || 0);
    const unit = rule.offsetUnit === 'hours'
      ? (value === 1 ? 'hour' : 'hours')
      : rule.offsetUnit === 'weeks'
        ? (value === 1 ? 'week' : 'weeks')
        : rule.offsetUnit === 'months'
          ? (value === 1 ? 'month' : 'months')
          : (value === 1 ? 'day' : 'days');
    return `${value} ${unit} before start`;
  }

  protected cancellationRuleRefundLabel(
    rule: ContractTypes.PricingCancellationRule,
    currency: string
  ): string {
    if (rule.refundKind === 'full') {
      return 'Full refund';
    }
    if (rule.refundKind === 'none') {
      return 'No refund';
    }
    if (rule.refundKind === 'fixed_amount') {
      return this.formatMoney(Number(rule.refundValue) || 0, currency);
    }
    return `${Math.max(0, Number(rule.refundValue) || 0)}% refund`;
  }

  private applicableCancellationRule(
    dialog: AssetExploreBorrowDialogViewState
  ): ContractTypes.PricingCancellationRule | null {
    const bookingStart = AppUtils.isoLocalDateTimeToDate(dialog.bookingStartAtIso);
    if (!bookingStart) {
      return null;
    }
    let bestRule: ContractTypes.PricingCancellationRule | null = null;
    let bestDeadlineMs = Number.NEGATIVE_INFINITY;
    for (const rule of this.cancellationRules(dialog)) {
      const deadlineMs = this.cancellationRuleDeadlineMs(rule, bookingStart);
      if (!Number.isFinite(deadlineMs) || Date.now() > deadlineMs) {
        continue;
      }
      if (deadlineMs > bestDeadlineMs) {
        bestDeadlineMs = deadlineMs;
        bestRule = rule;
      }
    }
    return bestRule;
  }

  private cancellationRuleDeadlineMs(
    rule: ContractTypes.PricingCancellationRule,
    bookingStart: Date
  ): number {
    const deadline = new Date(bookingStart.getTime());
    const offsetValue = Math.max(0, Number(rule.offsetValue) || 0);
    switch (rule.offsetUnit) {
      case 'hours':
        deadline.setHours(deadline.getHours() - offsetValue);
        break;
      case 'weeks':
        deadline.setDate(deadline.getDate() - (offsetValue * 7));
        break;
      case 'months':
        deadline.setMonth(deadline.getMonth() - offsetValue);
        break;
      default:
        deadline.setDate(deadline.getDate() - offsetValue);
        break;
    }
    return deadline.getTime();
  }

  private cancellationRefundAmount(
    rule: ContractTypes.PricingCancellationRule,
    totalAmount: number
  ): number {
    if (rule.refundKind === 'full') {
      return Math.round(totalAmount * 100) / 100;
    }
    if (rule.refundKind === 'none') {
      return 0;
    }
    if (rule.refundKind === 'fixed_amount') {
      return Math.min(totalAmount, Math.round((Number(rule.refundValue) || 0) * 100) / 100);
    }
    return Math.round(totalAmount * ((Math.max(0, Math.min(100, Number(rule.refundValue) || 0))) / 100) * 100) / 100;
  }

  private describeCancellationRule(rule: ContractTypes.PricingCancellationRule, currency: string): string {
    return `${this.cancellationRuleRefundLabel(rule, currency)} when cancelled at least ${this.cancellationRuleWindowLabel(rule)}.`;
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.closeRequested.emit(event);
  }

  protected back(event?: Event): void {
    event?.stopPropagation();
    this.backRequested.emit(event);
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    this.confirmRequested.emit(event);
  }
}
