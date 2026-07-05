import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DateInputComponent,
  type DateInputModel,
  type DateInputRangeValue,
  type DateInputValue
} from '../../../../shared/ui/components/core/form/inputs/date-input/date-input.component';
import { AppUtils } from '../../../../shared/app-utils';
import type * as ActivityContracts from '../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../shared/core/contracts';
import { SubEventResourcePopupStore } from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  PopupComponent,
  type PopupModel
} from '../../../../shared/ui/components/core/popup';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../../shared/ui/components/core/menu';

type BorrowDialogActionId = 'borrow-back' | 'borrow-cancel' | 'borrow-confirm';

export interface AssetExploreBorrowDialogViewState {
  title: string;
  subtitle: string;
  timeframe: string;
  quantity: number;
  availableQuantity: number;
  dateRange: DateInputRangeValue;
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

@Component({
  selector: 'app-event-resource-asset-explore-borrow-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateInputComponent,
    PopupComponent,
    AppMenuComponent
  ],
  templateUrl: './event-resource-asset-explore-borrow-dialog.component.html',
  styleUrl: './event-resource-asset-explore-borrow-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceAssetExploreBorrowDialogComponent {
  @Input() dialog: AssetExploreBorrowDialogViewState | null = null;
  @Input() canSubmit = false;
  @Input() parentZIndex = 2600;

  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  protected readonly borrowDateRangeInputModel: DateInputModel = {
    mode: 'range',
    precision: 'minute',
    range: {
      start: { label: 'Start' },
      end: { label: 'End' }
    }
  };

  protected borrowPopupModel(dialog: AssetExploreBorrowDialogViewState): PopupModel {
    return {
      title: dialog.title,
      subtitle: dialog.subtitle,
      ariaLabel: dialog.title,
      closeAriaLabel: 'Close borrow request',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected borrowPopupZIndex(): number {
    return this.parentZIndex + 100;
  }

  protected borrowFooterMenuItems(
    dialog: AssetExploreBorrowDialogViewState
  ): readonly AppMenuItem<BorrowDialogActionId>[] {
    const hasError = !dialog.busy && !!dialog.error;
    const submitLabel = dialog.busy ? dialog.busyLabel : dialog.submitLabel;
    return [
      {
        id: dialog.paymentStep ? 'borrow-back' : 'borrow-cancel',
        label: dialog.paymentStep ? 'Back' : 'Cancel',
        layout: 'action',
        palette: 'neutral',
        disabled: dialog.busy,
        ariaLabel: dialog.paymentStep ? 'Back' : 'Cancel'
      },
      {
        id: 'borrow-confirm',
        label: submitLabel,
        layout: 'action',
        palette: hasError ? 'danger' : 'blue',
        disabled: !this.canSubmit || dialog.busy,
        ariaLabel: submitLabel,
        progress: dialog.busy || hasError
          ? {
              state: dialog.busy ? 'loading' : 'error',
              shape: 'button'
            }
          : null
      }
    ];
  }

  protected onBorrowActionMenuSelect(event: AppMenuItemSelectEvent<BorrowDialogActionId>): void {
    if (event.id === 'borrow-back') {
      this.back(event.sourceEvent);
      return;
    }
    if (event.id === 'borrow-cancel') {
      this.close(event.sourceEvent);
      return;
    }
    this.confirm(event.sourceEvent);
  }

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
    this.resourcePopupStore.requestBorrowDialogClose(event);
  }

  protected back(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.requestBorrowDialogBack(event);
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.requestBorrowConfirm(event);
  }

  protected changeDateInputRange(value: DateInputValue): void {
    if (!this.isDateInputRangeValue(value)) {
      return;
    }
    this.changeDateRange(
      AppUtils.isoLocalDateTimeToDate(value.startAt),
      AppUtils.isoLocalDateTimeToDate(value.endAt)
    );
  }

  protected changeDateRange(start: Date | null, end: Date | null): void {
    this.resourcePopupStore.requestBorrowDateRangeChange(start, end);
  }

  protected changeQuantity(value: number | string): void {
    this.resourcePopupStore.requestBorrowQuantityChange(value);
  }

  protected blurQuantity(value: number | string): void {
    this.resourcePopupStore.requestBorrowQuantityBlur(value);
  }

  private isDateInputRangeValue(value: DateInputValue): value is DateInputRangeValue {
    return !!value
      && typeof value === 'object'
      && 'startAt' in value
      && 'endAt' in value;
  }

  protected togglePolicy(policyId: string): void {
    this.resourcePopupStore.requestBorrowPolicyToggle(policyId);
  }
}
