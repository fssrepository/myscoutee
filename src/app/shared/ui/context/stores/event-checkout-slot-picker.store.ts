import { Injectable, Type, signal } from '@angular/core';

import type {
  ActivityEventRecord,
  EventCheckoutBasket,
  EventCheckoutBasketItem
} from '../../../core/contracts/activity.interface';

export interface EventCheckoutSlotPickerRequest {
  userId: string;
  record: ActivityEventRecord;
  checkoutBasket?: EventCheckoutBasket | null;
  selectedDateKey?: string | null;
  checkoutSessionId?: string | null;
  onSave?: (basket: EventCheckoutBasket | null, items: readonly EventCheckoutBasketItem[]) => void | Promise<void>;
}

export interface EventCheckoutSlotPickerState extends EventCheckoutSlotPickerRequest {
  id: number;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class EventCheckoutSlotPickerStore {
  private readonly stateRef = signal<EventCheckoutSlotPickerState | null>(null);
  private readonly slotPickerPopupComponentRef = signal<Type<unknown> | null>(null);
  private nextId = 0;

  readonly popup = this.stateRef.asReadonly();
  readonly slotPickerPopupComponent = this.slotPickerPopupComponentRef.asReadonly();

  open(request: EventCheckoutSlotPickerRequest): EventCheckoutSlotPickerState | null {
    const userId = request.userId?.trim();
    if (!userId || !request.record?.id?.trim()) {
      return null;
    }
    const state: EventCheckoutSlotPickerState = {
      ...request,
      id: ++this.nextId,
      userId
    };
    this.stateRef.set(state);
    void this.ensureSlotPickerPopupLoaded();
    return state;
  }

  close(): void {
    this.stateRef.set(null);
  }

  async ensureSlotPickerPopupLoaded(): Promise<void> {
    if (this.slotPickerPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-checkout-slot-picker-popup/event-checkout-slot-picker-popup.component');
    this.slotPickerPopupComponentRef.set(module.EventCheckoutSlotPickerPopupComponent);
  }
}
