import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { SavedPaymentMethodDto } from '../../../../shared/core/contracts/payment-method.interface';
import { PaymentCardComponent, type PaymentCardData } from '../../../../shared/ui/components/core/smart-list/card';
import type { EventEditorCheckoutSurfaceTone } from '../../../../shared/ui/context/stores/event-editor-popup.store';
import { PaymentMethodsPopupStore } from '../../../../shared/ui/context/stores/payment-methods-popup.store';
import { I18nPipe } from '../../../../shared/ui/pipes';

export interface EventPaymentInputConfig {
  title?: string;
  subtitle?: string;
  paymentIntegrationEnabled?: boolean;
}

@Component({
  selector: 'app-event-payment-input',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PaymentCardComponent,
    I18nPipe
  ],
  templateUrl: './event-payment-input.component.html',
  styleUrl: './event-payment-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventPaymentInputComponent {
  private readonly paymentMethodsPopupStore = inject(PaymentMethodsPopupStore);

  @Input() config: EventPaymentInputConfig = {};
  @Input() totalAmount = 0;
  @Input() currency = 'USD';
  @Input() tone: EventEditorCheckoutSurfaceTone = 'payment';
  @Input() providerLabel = '';
  @Input() statusLabel = '';
  @Input() note = '';
  @Input() paymentMethod: SavedPaymentMethodDto | null = null;
  @Input() paymentMethodSelectionDisabled = false;
  @Input() paymentMethodReadOnly = false;
  @Output() readonly paymentMethodChange = new EventEmitter<SavedPaymentMethodDto>();

  protected title(): string {
    return this.config.title ?? 'event.editor.payment.title';
  }

  protected subtitle(): string {
    return this.config.subtitle ?? 'event.editor.payment.subtitle';
  }

  protected paymentCard(): PaymentCardData | null {
    const method = this.paymentMethod;
    return method ? {
      id: method.id,
      provider: method.provider,
      brand: method.brand,
      last4: method.last4,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      cardholderName: method.cardholderName,
      artworkUrl: method.artworkUrl,
      selected: false,
      disabled: this.paymentMethodReadOnly
    } : null;
  }

  protected openPaymentMethodPicker(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.paymentMethodReadOnly || this.paymentMethodSelectionDisabled) return;
    void this.paymentMethodsPopupStore.openPicker({
      selectedPaymentMethodId: this.paymentMethod?.id ?? null,
      onSelect: paymentMethod => this.paymentMethodChange.emit(paymentMethod)
    });
  }

  protected formatMoney(amount: number | null | undefined, currency = this.currency): string {
    const value = Number(amount) || 0;
    const formattedAmount = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return `${this.currencySymbol(currency)}${formattedAmount}`;
  }

  protected paymentProviderLabel(): string {
    return this.providerLabel.trim()
      || this.paymentProviderName()
      || (this.config.paymentIntegrationEnabled ? 'event.editor.payment.gateway' : 'event.editor.payment.demo');
  }

  protected paymentProviderLogo(): string | null {
    const provider = this.paymentProvider();
    return provider ? `assets/payment-providers/${provider}.svg` : null;
  }

  protected paymentProviderIcon(): string {
    return this.providerLabel.trim() ? 'verified' : 'payments';
  }

  protected paymentStatusLabel(): string {
    return this.statusLabel.trim()
      || (this.config.paymentIntegrationEnabled ? 'event.editor.payment.ready.redirect' : 'event.editor.payment.review.before.confirm');
  }

  protected paymentNote(): string {
    return this.note.trim()
      || (this.config.paymentIntegrationEnabled
        ? 'event.editor.payment.gateway.note'
        : 'event.editor.payment.demo.note');
  }

  private currencySymbol(currency: string): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return 'EUR ';
      case 'GBP':
        return 'GBP ';
      default:
        return '$';
    }
  }

  private paymentProvider(): 'stripe' | 'barion' | null {
    if (this.providerLabel.trim() || !this.config.paymentIntegrationEnabled) {
      return null;
    }
    const provider = `${this.paymentMethod?.provider ?? ''}`.trim().toLowerCase();
    return provider === 'stripe' || provider === 'barion' ? provider : null;
  }

  private paymentProviderName(): string {
    const provider = this.paymentProvider();
    return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : '';
  }
}
