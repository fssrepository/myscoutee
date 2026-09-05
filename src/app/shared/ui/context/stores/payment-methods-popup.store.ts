import { Injectable, Type, computed, signal } from '@angular/core';

import type { SavedPaymentMethodDto } from '../../../core/contracts/payment-method.interface';

export interface PaymentMethodPickerRequest {
  selectedPaymentMethodId?: string | null;
  onSelect: (paymentMethod: SavedPaymentMethodDto) => void;
}

@Injectable({ providedIn: 'root' })
export class PaymentMethodsPopupStore {
  private readonly openRef = signal(false);
  private readonly pickerRef = signal<PaymentMethodPickerRequest | null>(null);
  private readonly componentRef = signal<Type<unknown> | null>(null);

  readonly isOpen = this.openRef.asReadonly();
  readonly picker = this.pickerRef.asReadonly();
  readonly selectedPaymentMethodId = computed(() => this.pickerRef()?.selectedPaymentMethodId ?? null);
  readonly component = this.componentRef.asReadonly();

  async openHistory(): Promise<void> {
    await this.ensureLoaded();
    this.pickerRef.set(null);
    this.openRef.set(true);
  }

  async openManage(): Promise<void> {
    return this.openHistory();
  }

  async openPicker(request: PaymentMethodPickerRequest): Promise<void> {
    await this.ensureLoaded();
    this.pickerRef.set({
      selectedPaymentMethodId: `${request.selectedPaymentMethodId ?? ''}`.trim() || null,
      onSelect: request.onSelect
    });
    this.openRef.set(true);
  }

  close(): void {
    this.openRef.set(false);
    this.pickerRef.set(null);
  }

  togglePickerSelection(paymentMethodId: string): void {
    const picker = this.pickerRef();
    const normalizedId = paymentMethodId.trim();
    if (!picker || !normalizedId) return;
    this.pickerRef.set({
      ...picker,
      selectedPaymentMethodId: picker.selectedPaymentMethodId === normalizedId ? null : normalizedId
    });
  }

  confirm(paymentMethod: SavedPaymentMethodDto): void {
    const picker = this.pickerRef();
    if (!picker) return;
    picker.onSelect({ ...paymentMethod });
    this.close();
  }

  async ensureLoaded(): Promise<void> {
    if (this.componentRef()) return;
    const module = await import('../../components/payment-methods-popup/payment-methods-popup.component');
    this.componentRef.set(module.PaymentMethodsPopupComponent);
  }
}
