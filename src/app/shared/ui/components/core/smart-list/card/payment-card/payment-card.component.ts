import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../../directives/lazy-bg-image.directive';
import { I18nService } from '../../../../../../core/base/services/i18n.service';
import { I18nPipe } from '../../../../../pipes';
import { IndicatorComponent } from '../../../indicator';
import type { AppMenuItem } from '../../../menu';
import type { CardMenuTriggerRect, PaymentCardData } from '../card.types';

export interface PaymentCardMenuRequest {
  id: string;
  kind: 'select';
  title: string;
  items: readonly AppMenuItem<string, Record<string, unknown>>[];
  triggerRect: CardMenuTriggerRect | null;
  panelAlign: 'end';
  closeTrigger: () => void;
}

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, IndicatorComponent, I18nPipe],
  templateUrl: './payment-card.component.html',
  styleUrl: './payment-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentCardComponent {
  private readonly i18n = inject(I18nService);
  @Input({ required: true }) card!: PaymentCardData;
  @Input() selectable = false;
  @Input() showMenu = true;

  @Output() readonly cardSelect = new EventEmitter<Event>();
  @Output() readonly menuRequest = new EventEmitter<PaymentCardMenuRequest>();

  private menuOpen = false;
  private menuTriggerRect: CardMenuTriggerRect | null = null;

  protected maskedNumber(): string {
    return `••••  ••••  ••••  ${this.card.last4}`;
  }

  protected expiry(): string {
    return `${String(this.card.expiryMonth).padStart(2, '0')}/${String(this.card.expiryYear).slice(-2)}`;
  }

  protected resolvedBrandLabel(): string {
    return this.i18n.translateParams('payment.card.ending', {
      brand: this.card.brand,
      last4: this.card.last4
    });
  }

  protected ariaLabel(): string {
    const label = this.card.loading
      ? this.i18n.translate(this.card.loadingLabel || 'payment.registration.pending')
      : this.resolvedBrandLabel();
    if (this.card.expired) {
      return `${label}. ${this.i18n.translate('payment.card.expired')}.`;
    }
    if (this.card.requiresRetokenization) {
      return `${label}. ${this.i18n.translate('payment.card.reconnect')}.`;
    }
    return this.card.updateNeeded
      ? `${label}. ${this.i18n.translate('payment.card.update.needed')}.`
      : label;
  }

  protected onSelect(event: Event): void {
    if (!this.selectable || this.card.disabled) return;
    this.cardSelect.emit(event);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.selectable || this.card.disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    this.cardSelect.emit(event);
  }

  protected captureMenuRect(event: PointerEvent): void {
    event.stopPropagation();
    this.menuTriggerRect = this.rect(event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
  }

  protected openMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.card.paymentMenuActions?.length) return;
    const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.menuTriggerRect = this.menuTriggerRect ?? this.rect(trigger);
    this.menuOpen = true;
    this.menuRequest.emit({
      id: `payment-card-menu-${this.card.id}`,
      kind: 'select',
      title: this.resolvedBrandLabel(),
      items: this.card.paymentMenuActions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        palette: action.tone === 'destructive' ? 'danger' : action.tone === 'warning' ? 'amber' : 'blue',
        context: { paymentMethodId: this.card.id, actionId: action.id }
      })),
      triggerRect: this.menuTriggerRect,
      panelAlign: 'end',
      closeTrigger: () => {
        this.menuOpen = false;
        this.menuTriggerRect = null;
      }
    });
  }

  private rect(element: HTMLElement | null): CardMenuTriggerRect | null {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  }
}
