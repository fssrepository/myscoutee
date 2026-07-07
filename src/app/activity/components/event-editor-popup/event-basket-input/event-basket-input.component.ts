import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette } from '../../../../shared/ui/components/core/menu';
import { TextCardComponent, type TextCardTone } from '../../../../shared/ui/components/core/smart-list/card';

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
  @Input() items: readonly EventBasketInputItem[] = [];
  @Input() pricingSummaryRows: readonly EventBasketInputPricingSummaryRow[] = [];
  @Input() totalAmount = 0;
  @Input() currency = 'USD';
  @Input() addDisabled = false;
  @Input() emptyLabel = 'No basket items yet. Use + to add a slot.';

  @Output() readonly addSelect = new EventEmitter<Event>();
  @Output() readonly itemMenuSelect = new EventEmitter<EventBasketInputItemMenuEvent>();

  protected addMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return [{
      id: 'add',
      icon: 'add',
      ariaLabel: 'Add checkout item',
      palette: 'amber',
      layout: 'action',
      disabled: this.addDisabled
    }];
  }

  protected onAddSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id !== 'add' || this.addDisabled) {
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
    if (item.status === 'confirmed') {
      return 'teal';
    }
    return 'cyan';
  }

  protected itemMenuPalette(item: EventBasketInputItem): AppMenuPalette {
    return item.status === 'pay' ? 'violet' : 'teal';
  }

  protected itemMenuItems(): readonly AppMenuItem<string, unknown>[] {
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
    this.itemMenuSelect.emit({ item, menuEvent });
  }

  protected itemSubtitle(item: EventBasketInputItem): string {
    const quantity = this.itemQuantity(item);
    const status = item.status === 'pay'
      ? 'Paid'
      : item.status === 'confirmed'
        ? 'Confirmed'
        : 'Draft';
    return quantity > 1 ? `${status} · ${quantity} items` : status;
  }

  protected itemDetail(item: EventBasketInputItem): string {
    return item.detail?.trim() || 'Selected checkout item';
  }

  private itemQuantity(item: EventBasketInputItem): number {
    return Math.max(1, Math.trunc(Number(item.quantity) || 1));
  }
}
