import { TestBed } from '@angular/core/testing';
import { ExplanationGuideService } from '@fssrepository/myscoutee-components';
import { CashReceiptPopupComponent } from './cash-receipt-popup.component';
import { ActivityInvitePopupStore } from '../../context/stores/activity/activity-invite-popup.store';
import { PaymentMethodsService } from '../../../core/base/services/payments/payment-methods.service';
import { DeploymentConfigurationService } from '../../../core/base/services/platform/deployment-configuration.service';

describe('Manual receipt payer and currency', () => {
  const maya = { id: 'group:homes:maya', userId: 'group:homes:maya', name: 'Maya Stone' };
  let component: any;
  let picker: { openActivityInvitePopup: ReturnType<typeof vi.fn>; ensureAssetMemberPickerPopupLoaded: ReturnType<typeof vi.fn> };
  let payments: { recordCashReceipt: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    picker = { openActivityInvitePopup: vi.fn(), ensureAssetMemberPickerPopupLoaded: vi.fn().mockResolvedValue(undefined) };
    payments = { recordCashReceipt: vi.fn().mockResolvedValue({}) };
    TestBed.configureTestingModule({ providers: [
      { provide: ActivityInvitePopupStore, useValue: picker },
      { provide: PaymentMethodsService, useValue: payments },
      { provide: DeploymentConfigurationService, useValue: { paymentCurrencies: () => ['EUR', 'HUF'] } },
      { provide: ExplanationGuideService, useValue: { registerContext: () => () => {} } }
    ] });
    component = TestBed.runInInjectionContext(() => new CashReceiptPopupComponent());
    component.userId = 'group:homes:alex'; component.ngOnInit();
  });
  afterEach(() => { component.ngOnDestroy(); TestBed.resetTestingModule(); });

  it('preserves the selected payer when a pending form edit emits its older snapshot', async () => {
    const pendingFormEdit = { ...component.form(), amount: 12.34, note: 'Receipt' };
    component.selectMember({ control: { id: 'payer' } });
    picker.openActivityInvitePopup.mock.calls[0][0].onApply([maya]);
    component.form.set(pendingFormEdit);
    expect(component.popupModel().headerControls[0].items[0].disabled).toBe(false);
    await component.save();
    expect(payments.recordCashReceipt).toHaveBeenCalledWith(component.userId,
      { ...pendingFormEdit, payerUserId: maya.userId });
  });

  it('reopens the picker with its selection and disables saving after clearing it', async () => {
    component.payer.set(maya); component.form.update((form: object) => ({ ...form, amount: 10 }));
    component.selectMember({ control: { id: 'payer' } });
    const context = picker.openActivityInvitePopup.mock.calls[0][0];
    expect(context.initialSelection).toEqual([maya]);
    context.onApply([]);
    expect(component.payer()).toBeNull();
    expect(component.popupModel().headerControls[0].items[0].disabled).toBe(true);
    await component.save(); expect(payments.recordCashReceipt).not.toHaveBeenCalled();
  });

  it('uses supported cached currencies in the standard dropdown and submits the chosen one', async () => {
    const currency = () => component.formModel().steps[0].controls.find((control: { id: string }) => control.id === 'currency');
    expect(currency()).toMatchObject({ kind: 'menu', bind: 'currency', config: { kind: 'select' } });
    expect(currency().config.items.map((item: { id: string }) => item.id)).toEqual(['EUR', 'HUF']);
    component.payer.set(maya);
    component.form.update((form: object) => ({ ...form, amount: 4500, currency: 'HUF' }));
    expect(currency().config.trigger.label).toBe('HUF');
    expect(currency().config.items.find((item: { id: string }) => item.id === 'HUF').checked).toBe(true);
    await component.save();
    expect(payments.recordCashReceipt).toHaveBeenCalledWith(component.userId,
      expect.objectContaining({ payerUserId: maya.userId, amount: 4500, currency: 'HUF' }));
  });
});
