import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { PaymentMethodsService } from '../../../core/base/services/payment-methods.service';
import { PaymentEuroSummaryDto } from '../../../core/contracts/payment-method.interface';
import { UserProfileStore } from '../../context/stores/user-profile.store';
import { PopupComponent, PopupModel } from '../core/popup';
import { AppMenuComponent, AppMenuItem } from '../core/menu';
import { I18nPipe } from '../../pipes/i18n.pipe';

@Component({
  selector: 'app-summary-currency-popup', standalone: true,
  imports: [PopupComponent, AppMenuComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-popup [model]="model()" [zIndex]="24000">
    <div class="currency-picker">
      <app-menu kind="select" layout="row" panelMode="auto" [trigger]="{ label: draft(), icon: 'payments', palette: 'blue' }" [items]="items()" [closeOnSelect]="true"
        (itemSelect)="draft.set($event.item.id)"></app-menu>
      @if (error()) { <p role="alert">{{ 'payment.currency.save.error' | i18n }}</p> }
    </div>
  </app-popup>`,
  styles: [`.currency-picker { padding: 1rem; min-width: 0; }`]
})
export class SummaryCurrencyPopupComponent implements OnInit {
  @Input({required: true}) summary!: PaymentEuroSummaryDto;
  @Output() closed = new EventEmitter<void>();
  private readonly payments = inject(PaymentMethodsService);
  private readonly profile = inject(UserProfileStore);
  protected readonly draft = signal('EUR');
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  ngOnInit(): void { this.draft.set(this.summary.currency ?? 'EUR'); }
  protected items(): AppMenuItem[] {
    return (this.summary.currencies ?? ['EUR']).map(currency => ({ id: currency, label: currency,
      kind: 'radio', checked: this.draft() === currency, palette: 'blue', disabled: this.saving() }));
  }
  protected model(): PopupModel {
    return { title: 'payment.currency.title', size: 'small', height: 'auto', mobilePresentation: 'compact', bodyLayout: 'overflow', backdropTone: 'dim',
      headerControls: [{ kind: 'menu', id: 'save', menuKind: 'inline', items: [{ id: 'save', icon: 'check',
        palette: 'green', ariaLabel: 'save', disabled: this.saving() }] }],
      onClose: () => { if (!this.saving()) this.closed.emit(); }, onMenuSelect: () => void this.save() };
  }
  private async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(false);
    try {
      await this.payments.selectSummaryCurrency(this.profile.activeUserId(), this.draft());
      this.closed.emit();
    } catch { this.error.set(true); }
    finally { this.saving.set(false); }
  }
}
