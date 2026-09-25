import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityInvitePopupStore } from '../../context/stores/activity-invite-popup.store';
import { PaymentMethodsService } from '../../../core/base/services/payment-methods.service';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
import type { CashReceiptRequestDto, PaymentHistoryMutationDto } from '../../../core/contracts/payment-method.interface';
import { PopupComponent, type PopupModel } from '../core/popup';
import { FormFlowComponent, type FormFlowActionEvent, type FormFlowModel } from '../core/form/flow';
import { I18nPipe } from '../../pipes';

@Component({
  selector: 'app-cash-receipt-popup', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent, I18nPipe],
  template: `
    <app-popup [model]="popupModel()" [zIndex]="22600">
      <app-form-flow [model]="formModel()" [(ngModel)]="form" [loading]="loading()"
        [disabled]="busy()" (action)="selectMember($event)"></app-form-flow>
      @if (error()) { <p role="alert">{{ error() | i18n }}</p> }
    </app-popup>
  `
})
export class CashReceiptPopupComponent {
  @Input({ required: true }) userId = '';
  @Input() currency = 'EUR';
  @Output() readonly recorded = new EventEmitter<PaymentHistoryMutationDto>();
  @Output() readonly closed = new EventEmitter<void>();
  private readonly memberPicker = inject(ActivityInvitePopupStore);
  private readonly payments = inject(PaymentMethodsService);
  protected readonly payer = signal<ActivityMemberDTO | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected form: CashReceiptRequestDto = { requestId: crypto.randomUUID(), payerUserId: '', amount: 0, currency: 'EUR', note: '' };

  ngOnInit(): void { this.form.currency = this.currency; }

  protected popupModel(): PopupModel {
    return { title: 'payment.cash.record', size: 'default', backdropTone: 'dim',
      onClose: () => { if (!this.busy()) this.closed.emit(); },
      headerControls: [{ id: 'cash-save', kind: 'menu', menuKind: 'inline', items: [{
        id: 'cash-save', icon: 'done', palette: this.error() ? 'danger' : 'success',
        ariaLabel: 'payment.cash.save', disabled: this.busy() || this.loading() || !this.form.payerUserId
          || !Number.isFinite(this.form.amount) || this.form.amount <= 0 || !/^[A-Z]{3}$/i.test(this.form.currency.trim()),
        progress: this.busy() ? { state: 'loading', shape: 'circle' } : null
      }] }], onMenuSelect: () => { void this.save(); } };
  }

  protected formModel(): FormFlowModel {
    const selected = this.payer();
    return { title: 'payment.cash.record', header: false, layout: 'grouped', deferPreparation: false,
      save: null, summary: { enabled: false }, steps: [{ id: 'receipt', title: 'payment.cash.record', palette: 'green', controls: [
        { id: 'payer', kind: 'menu', label: 'payment.cash.from', required: true, config: {
          kind: 'inline', items: [{ id: 'select-payer', label: selected?.name || 'payment.cash.select.member',
            icon: 'person', imageUrl: selected?.avatarUrl, imageFallback: selected?.initials, palette: 'blue' }] } },
        { id: 'amount', bind: 'amount', kind: 'number', label: 'payment.cash.amount', required: true, min: 0.01, max: 1_000_000_000, step: 0.01, layout: 'half' },
        { id: 'currency', bind: 'currency', kind: 'text', label: 'payment.cash.currency', required: true, maxLength: 3, layout: 'half' },
        { id: 'note', bind: 'note', kind: 'textarea', label: 'payment.cash.note', maxLength: 1000, rows: 3 }
      ] }] };
  }

  protected selectMember(event: FormFlowActionEvent): void {
    if (event.control.id !== 'payer' || this.busy()) return;
    this.memberPicker.openActivityInvitePopup({
      ownerId: this.userId, ownerType: 'asset', title: 'payment.cash.select.member', selectionLimit: 1,
      parentZIndex: 22600, closeOwnerPopupOnClose: false,
      onApply: selected => {
        const member = selected[0];
        if (!member || member.userId === this.userId) return;
        this.payer.set(member); this.form = { ...this.form, payerUserId: member.userId };
      }
    });
    void this.memberPicker.ensureAssetMemberPickerPopupLoaded();
  }

  private async save(): Promise<void> {
    if (this.busy() || this.loading() || !this.form.payerUserId) return;
    this.busy.set(true); this.error.set('');
    try {
      const mutation = await this.payments.recordCashReceipt(this.userId, { ...this.form, currency: this.form.currency.trim().toUpperCase() });
      this.recorded.emit(mutation);
      this.closed.emit();
    } catch { this.error.set('payment.cash.failed'); }
    finally { this.busy.set(false); }
  }
}
