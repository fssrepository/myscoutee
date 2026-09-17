import { AppUtils } from '../../../../shared/app-utils';
import { PaymentRefundPolicyComponent } from '../../../../shared/ui/components/payment-refund-policy/payment-refund-policy.component';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DateInputComponent,
  type DateInputModel,
  type DateInputRangeValue,
  type DateInputValue
} from '../../../../shared/ui/components/core/form/inputs/date-input/date-input.component';
import { I18nService } from '../../../../shared/core/base/services/i18n.service';
import { I18nPipe } from '../../../../shared/ui/pipes/i18n.pipe';
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
    AppMenuComponent,
    I18nPipe,
    PaymentRefundPolicyComponent
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
  private readonly i18n = inject(I18nService);

  protected get borrowDateRangeInputModel(): DateInputModel {
    this.i18n.revision();
    return {
      mode: 'range',
      precision: 'minute',
      range: {
        start: { label: this.i18n.translate('asset.borrow.start') },
        end: { label: this.i18n.translate('asset.borrow.end') }
      }
    };
  }

  protected borrowPopupModel(dialog: AssetExploreBorrowDialogViewState): PopupModel {
    return {
      title: dialog.title,
      subtitle: dialog.subtitle,
      ariaLabel: dialog.title,
      closeAriaLabel: this.i18n.translate('asset.borrow.close.aria'),
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
        label: dialog.paymentStep ? this.i18n.translate('back') : this.i18n.translate('cancel'),
        layout: 'action',
        palette: 'neutral',
        disabled: dialog.busy,
        ariaLabel: dialog.paymentStep ? this.i18n.translate('back') : this.i18n.translate('cancel')
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

  protected availabilityLabel(availableQuantity: number): string {
    const count = Math.max(0, Math.trunc(Number(availableQuantity) || 0));
    return this.i18n.translateParams(
      count === 1 ? 'asset.borrow.available.one' : 'asset.borrow.available.many',
      { count }
    );
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
