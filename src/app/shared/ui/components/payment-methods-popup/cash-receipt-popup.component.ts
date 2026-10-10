import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityInvitePopupStore } from '../../context/stores/activity/activity-invite-popup.store';
import { PaymentMethodsService } from '../../../core/base/services/payment-methods.service';
import {
  ExplanationGuideService,
  PopupComponent,
  type PopupModel,
  FormFlowComponent,
  type FormFlowActionEvent,
  type FormFlowModel,
  I18nPipe
} from '@fssrepository/myscoutee-components';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
import type { CashReceiptRequestDto, PaymentHistoryMutationDto } from '../../../core/contracts/payment-method.interface';

@Component({
  selector: 'app-cash-receipt-popup', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent, I18nPipe],
  styleUrl: './payment-feedback.scss',
  template: `
    <app-popup [model]="popupModel()" [zIndex]="22600">
      @if (error()) { <p class="payment-methods-popup__error" role="alert">{{ error() | i18n }}</p> }
      <app-form-flow [model]="formModel()" [ngModel]="form()" (ngModelChange)="form.set($event)" [loading]="loading()"
        [disabled]="busy()" (action)="selectMember($event)"></app-form-flow>
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
  private readonly explanationGuide = inject(ExplanationGuideService);
  private unregisterExplanationContext: (() => void) | null = null;
  protected readonly payer = signal<ActivityMemberDTO | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = signal<CashReceiptRequestDto>({ requestId: crypto.randomUUID(), method:'cash', payerUserId: '', amount: 0, currency: 'EUR', note: '' });

  ngOnInit(): void {
    this.form.update(form => ({ ...form, currency: this.currency }));
    this.unregisterExplanationContext = this.explanationGuide.registerContext('payment.cash.receipt');
  }

  ngOnDestroy(): void {
    this.unregisterExplanationContext?.();
    this.unregisterExplanationContext = null;
  }

  protected readonly popupModel = computed<PopupModel>(() => {
    const form = this.form();
    return { title: 'payment.cash.record', size: 'default', backdropTone: 'dim',
      onClose: () => { if (!this.busy()) this.closed.emit(); },
      headerControls: [{ id: 'cash-save', kind: 'menu', menuKind: 'inline', items: [{
        id: 'cash-save', icon: 'done', palette: this.error() ? 'danger' : 'success',
        ariaLabel: 'payment.cash.save', disabled: this.busy() || this.loading() || !form.payerUserId
          || !Number.isFinite(form.amount) || form.amount <= 0 || !/^[A-Z]{3}$/i.test(form.currency.trim()),
        progress: this.busy() ? { state: 'loading', shape: 'circle' } : null
      }] }], onMenuSelect: () => { void this.save(); } };
  });

  protected readonly formModel = computed<FormFlowModel>(() => {
    const selected = this.payer();
    const method = this.form().method ?? 'cash';
    return { title: 'payment.cash.record', header: false, layout: 'grouped', deferPreparation: false,
      save: null, summary: { enabled: false }, steps: [{ id: 'receipt', title: '', palette: 'green', controls: [
        {id:'method',bind:'method',kind:'menu',label:'payment.manual.method',config:{kind:'select',trigger:{label:`payment.manual.method.${method}`,icon:method==='bank-transfer'?'account_balance':'payments',palette:method==='bank-transfer'?'blue':'green',layout:'pill'},items:['cash','bank-transfer'].map(id=>({id,value:id,label:`payment.manual.method.${id}`,icon:id==='bank-transfer'?'account_balance':'payments',palette:id==='bank-transfer'?'blue':'green',surface:'tinted',kind:'radio',active:id===method,checked:id===method}))}},
        { id: 'payer', kind: 'menu', label: 'payment.cash.from', required: true, config: {
          kind: 'select', trigger: { id: 'select-payer', action: 'custom', label: selected?.name || 'payment.cash.select.member',
            ariaLabel: selected?.name || 'payment.cash.select.member',
            icon: 'person', imageUrl: selected?.avatarUrl, imageFallback: selected?.initials,
            imageShape: 'circle', layout: 'pill', palette: 'blue', trailingIcon: 'chevron_right' }, items: [] } },
        { id: 'amount', bind: 'amount', kind: 'number', label: 'payment.cash.amount', required: true, min: 0.01, max: 1_000_000_000, step: 0.01, layout: 'half' },
        { id: 'currency', bind: 'currency', kind: 'text', label: 'payment.cash.currency', required: true, maxLength: 3, layout: 'half' },
        { id: 'note', bind: 'note', kind: 'textarea', label: 'payment.cash.note', maxLength: 1000, rows: 3 }
      ] }] };
  });

  protected selectMember(event: FormFlowActionEvent): void {
    if (event.control.id !== 'payer' || this.busy()) return;
    this.memberPicker.openActivityInvitePopup({
      ownerId: this.userId, ownerType: 'asset', purpose:'payment', headerTitle: 'payment.cash.select.member', selectionLimit: 1,
      parentZIndex: 22600, closeOwnerPopupOnClose: false,
      onApply: selected => {
        const member = selected[0];
        if (!member || member.userId === this.userId) return;
        this.payer.set(member); this.form.update(form => ({ ...form, payerUserId: member.userId }));
      }
    });
    void this.memberPicker.ensureAssetMemberPickerPopupLoaded();
  }

  private async save(): Promise<void> {
    const form = this.form();
    if (this.busy() || this.loading() || !form.payerUserId) return;
    this.busy.set(true); this.error.set('');
    try {
      const mutation = await this.payments.recordCashReceipt(this.userId, { ...form, currency: form.currency.trim().toUpperCase() });
      this.recorded.emit(mutation);
      this.closed.emit();
    } catch { this.error.set('payment.cash.failed'); }
    finally { this.busy.set(false); }
  }
}
