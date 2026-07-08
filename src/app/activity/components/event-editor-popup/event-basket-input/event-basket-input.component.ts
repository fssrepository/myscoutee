import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette } from '../../../../shared/ui/components/core/menu';
import { TextCardComponent, type TextCardTone } from '../../../../shared/ui/components/core/smart-list/card';
import type { EventEditorCheckoutSurfaceTone } from '../../../../shared/ui/context/stores/event-editor-popup.store';

export interface EventBasketInputPricingSummaryRow {
  key: string;
  label: string;
  detail?: string | null;
  amount?: number | null;
  currency?: string | null;
  multiplier?: number | null;
}

export interface EventBasketInputItem {
  id: string;
  title: string;
  meta: string;
  detail?: string | null;
  amount: number;
  currency: string;
  quantity?: number | null;
  status?: string | null;
  pricingSummaryRows?: readonly EventBasketInputPricingSummaryRow[] | null;
}

export interface EventBasketInputItemMenuEvent {
  item: EventBasketInputItem;
  menuEvent: AppMenuItemSelectEvent<string, unknown>;
}

@Component({
  selector: 'app-event-basket-input',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    TextCardComponent
  ],
  templateUrl: './event-basket-input.component.html',
  styleUrl: './event-basket-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventBasketInputComponent {
  @Input() title = 'Basket';
  @Input() subtitle = 'Selected checkout items';
  @Input() contextTitle = '';
  @Input() contextMeta = '';
  @Input() contextDetail = '';
  @Input() contextAmount: number | null = null;
  @Input() items: readonly EventBasketInputItem[] = [];
  @Input() pricingSummaryRows: readonly EventBasketInputPricingSummaryRow[] = [];
  @Input() totalAmount = 0;
  @Input() currency = 'USD';
  @Input() addDisabled = false;
  @Input() readOnly = false;
  @Input() showAdd = true;
  @Input() showItemMenu = true;
  @Input() addIcon = 'edit';
  @Input() addAriaLabel = 'Edit checkout items';
  @Input() emptyLabel = 'No basket items yet. Use the edit button to add a slot.';
  @Input() tone: EventEditorCheckoutSurfaceTone = 'neutral';

  @Output() readonly addSelect = new EventEmitter<Event>();
  @Output() readonly itemMenuSelect = new EventEmitter<EventBasketInputItemMenuEvent>();

  protected addMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return [{
      id: 'add',
      icon: this.addIcon,
      ariaLabel: this.addAriaLabel,
      palette: 'amber',
      layout: 'action',
      disabled: this.addDisabled
    }];
  }

  protected onAddSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id !== 'add' || this.readOnly || this.addDisabled) {
      return;
    }
    this.addSelect.emit(event.sourceEvent);
  }

  protected itemTrackId(_index: number, item: EventBasketInputItem): string {
    return item.id;
  }

  protected itemTone(item: EventBasketInputItem): TextCardTone {
    if (item.status === 'pay') {
      return 'violet';
    }
    if (item.status === 'waiting') {
      return 'amber';
    }
    if (item.status === 'confirmed') {
      return 'teal';
    }
    return 'cyan';
  }

  protected itemMenuPalette(item: EventBasketInputItem): AppMenuPalette {
    return item.status === 'pay'
      ? 'violet'
      : item.status === 'waiting'
        ? 'amber'
        : 'teal';
  }

  protected itemMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (this.readOnly || !this.showItemMenu) {
      return [];
    }
    return [
      {
        id: 'view',
        label: 'Megtekintés',
        icon: 'visibility',
        palette: 'teal',
        surface: 'tinted'
      },
      {
        id: 'remove',
        label: 'Eltávolítás',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted'
      }
    ];
  }

  protected onItemMenuSelect(item: EventBasketInputItem, menuEvent: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.readOnly || !this.showItemMenu) {
      return;
    }
    this.itemMenuSelect.emit({ item, menuEvent });
  }

  protected itemSubtitle(item: EventBasketInputItem): string {
    const quantity = this.itemQuantity(item);
    const status = item.status === 'pay'
      ? 'Paid'
      : item.status === 'waiting'
        ? 'Várólistán'
      : item.status === 'confirmed'
        ? 'Confirmed'
        : 'Draft';
    return quantity > 1 ? `${status} · ${quantity} items` : status;
  }

  protected itemDetail(item: EventBasketInputItem): string {
    return item.detail?.trim() || '';
  }

  private itemQuantity(item: EventBasketInputItem): number {
    return Math.max(1, Math.trunc(Number(item.quantity) || 1));
  }

  protected hasContext(): boolean {
    return Boolean(this.contextTitle?.trim() || this.contextMeta?.trim() || this.contextDetail?.trim());
  }

  protected contextAmountLabel(): string {
    return Number.isFinite(this.contextAmount)
      ? this.formatMoney(Number(this.contextAmount), this.currency)
      : '';
  }

  protected itemAmountLabel(item: EventBasketInputItem): string {
    const quantity = this.itemQuantity(item);
    const amount = (Number(item.amount) || 0) * quantity;
    return amount > 0 ? this.formatMoney(amount, item.currency || this.currency) : 'Included';
  }

  private formatMoney(amount: number, currency: string): string {
    const symbol = this.currencySymbol(currency);
    return `${symbol}${(Number(amount) || 0).toFixed(2)}`;
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
