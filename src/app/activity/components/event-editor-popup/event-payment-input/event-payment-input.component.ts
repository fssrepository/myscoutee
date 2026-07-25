import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { EventEditorCheckoutSurfaceTone } from '../../../../shared/ui/context/stores/event-editor-popup.store';
import { I18nPipe } from '../../../../shared/ui/pipes';

export interface EventPaymentInputPricingSummaryRow {
  key: string;
  label: string;
  detail?: string | null;
  amount?: number | null;
  currency?: string | null;
  multiplier?: number | null;
}

export interface EventPaymentInputItem {
  id: string;
  title: string;
  meta: string;
  detail?: string | null;
  amount: number;
  currency: string;
  quantity?: number | null;
}

@Component({
  selector: 'app-event-payment-input',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    I18nPipe
  ],
  templateUrl: './event-payment-input.component.html',
  styleUrl: './event-payment-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventPaymentInputComponent {
  @Input() title = 'event.editor.payment.title';
  @Input() subtitle = 'event.editor.payment.subtitle';
  @Input() eventTitle = '';
  @Input() eventLocation = '';
  @Input() eventTimeframe = '';
  @Input() items: readonly EventPaymentInputItem[] = [];
  @Input() pricingSummaryRows: readonly EventPaymentInputPricingSummaryRow[] = [];
  @Input() totalAmount = 0;
  @Input() currency = 'USD';
  @Input() paymentIntegrationEnabled = false;
  @Input() tone: EventEditorCheckoutSurfaceTone = 'payment';
  @Input() providerLabel = '';
  @Input() statusLabel = '';
  @Input() note = '';

  protected itemTrackId(_index: number, item: EventPaymentInputItem): string {
    return item.id;
  }

  protected rowTrackId(_index: number, row: EventPaymentInputPricingSummaryRow): string {
    return row.key;
  }

  protected formatMoney(amount: number | null | undefined, currency = this.currency): string {
    const value = Number(amount) || 0;
    return `${this.currencySymbol(currency)}${value.toFixed(2)}`;
  }

  protected rowAmountLabel(row: EventPaymentInputPricingSummaryRow): string {
    if (!Number.isFinite(row.amount)) {
      return '';
    }
    return this.formatMoney(row.amount, row.currency || this.currency);
  }

  protected rowDetailLabel(row: EventPaymentInputPricingSummaryRow): string {
    const parts: string[] = [];
    const detail = `${row.detail ?? ''}`.trim();
    if (detail) {
      parts.push(detail);
    }
    const multiplier = Math.max(1, Math.trunc(Number(row.multiplier) || 1));
    if (multiplier > 1) {
      parts.push(`affected by x${multiplier}`);
    }
    return parts.join(' · ');
  }

  protected itemAmountLabel(item: EventPaymentInputItem): string {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const amount = (Number(item.amount) || 0) * quantity;
    return amount > 0 ? this.formatMoney(amount, item.currency || this.currency) : 'included';
  }

  protected resolvedEventTitle(): string {
    return `${this.eventTitle ?? ''}`.trim() || 'event';
  }

  protected resolvedEventLocation(): string {
    return `${this.eventLocation ?? ''}`.trim() || 'event.editor.location.not.set';
  }

  protected resolvedEventTimeframe(): string {
    return `${this.eventTimeframe ?? ''}`.trim() || 'event.editor.date.not.set';
  }

  protected paymentProviderLabel(): string {
    return this.providerLabel.trim()
      || (this.paymentIntegrationEnabled ? 'event.editor.payment.gateway' : 'event.editor.payment.demo');
  }

  protected paymentStatusLabel(): string {
    return this.statusLabel.trim()
      || (this.paymentIntegrationEnabled ? 'event.editor.payment.ready.redirect' : 'event.editor.payment.review.before.confirm');
  }

  protected paymentNote(): string {
    return this.note.trim()
      || (this.paymentIntegrationEnabled
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
}
