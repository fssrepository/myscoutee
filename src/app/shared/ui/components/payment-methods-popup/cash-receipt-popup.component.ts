import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactsService } from '../../../core/base/services/contacts.service';
import { PaymentMethodsService } from '../../../core/base/services/payment-methods.service';
import type { StoredContact } from '../../../core/contracts/contact.interface';
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
export class CashReceiptPopupComponent implements OnInit {
  @Input({ required: true }) userId = '';
  @Input() currency = 'EUR';
  @Output() readonly recorded = new EventEmitter<PaymentHistoryMutationDto>();
  @Output() readonly closed = new EventEmitter<void>();
  private readonly contactsService = inject(ContactsService);
  private readonly payments = inject(PaymentMethodsService);
  protected readonly contacts = signal<StoredContact[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected form: CashReceiptRequestDto = { requestId: crypto.randomUUID(), payerUserId: '', amount: 0, currency: 'EUR', note: '' };

  ngOnInit(): void { this.form.currency = this.currency; void this.loadMembers(); }

  private async loadMembers(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const contacts = await this.contactsService.loadContacts(this.userId);
      this.contacts.set([...new Map(contacts.filter(contact => contact.userId && contact.userId !== this.userId)
        .map(contact => [contact.userId, contact])).values()]);
      if (!this.contacts().length) this.error.set('payment.cash.members.empty');
    } catch { this.error.set('payment.cash.members.failed'); }
    finally { this.loading.set(false); }
  }

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
    const selected = this.contacts().find(contact => contact.userId === this.form.payerUserId);
    return { title: 'payment.cash.record', header: false, layout: 'grouped', deferPreparation: false,
      save: null, summary: { enabled: false }, steps: [{ id: 'receipt', title: 'payment.cash.record', palette: 'green', controls: [
        { id: 'payer', kind: 'menu', label: 'payment.cash.from', required: true, config: {
          kind: 'select', filterable: true, trigger: { label: selected?.name || 'payment.cash.select.member',
            icon: 'person', imageUrl: selected?.avatarUrl, imageFallback: selected?.initials, palette: 'blue' },
          items: this.contacts().map(contact => ({ id: contact.userId, label: contact.name, icon: 'person',
            imageUrl: contact.avatarUrl, imageFallback: contact.initials, kind: 'radio',
            active: contact.userId === this.form.payerUserId, palette: 'blue' })) } },
        { id: 'amount', bind: 'amount', kind: 'number', label: 'payment.cash.amount', required: true, min: 0.01, max: 1_000_000_000, step: 0.01, layout: 'half' },
        { id: 'currency', bind: 'currency', kind: 'text', label: 'payment.cash.currency', required: true, maxLength: 3, layout: 'half' },
        { id: 'note', bind: 'note', kind: 'textarea', label: 'payment.cash.note', maxLength: 1000, rows: 3 }
      ] }] };
  }

  protected selectMember(event: FormFlowActionEvent): void {
    if (event.control.id === 'payer' && !this.busy()) this.form = { ...this.form, payerUserId: event.sourceEvent.id };
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
