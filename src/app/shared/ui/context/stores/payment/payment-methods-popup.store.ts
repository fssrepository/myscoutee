import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';

import {ActivityInvitePopupStore} from '../activity/activity-invite-popup.store';
import type {ActivityMemberDTO} from '../../../../core/contracts/activity.interface';
import type { PaymentHistoryPageDto, SavedPaymentMethodDto } from '../../../../core/contracts/payment-method.interface';
import { ActivityStore } from '../activity/activity.store';
import { UserProfileStore } from '../profile/user-profile.store';

type HistorySummary = Pick<PaymentHistoryPageDto, 'euroSummary' | 'spendingTotals' | 'incomeTotals' | 'pendingRefundCount'>;

export interface PaymentMethodPickerRequest {
  selectedPaymentMethodId?: string | null;
  onSelect: (paymentMethod: SavedPaymentMethodDto) => void;
}

@Injectable({ providedIn: 'root' })
export class PaymentMethodsPopupStore {
  private readonly memberPicker=inject(ActivityInvitePopupStore);
  readonly counterparty=signal<ActivityMemberDTO|null>(null);
  private readonly profiles = inject(UserProfileStore);
  private readonly activities = inject(ActivityStore);
  private readonly historySummaryRef = signal<HistorySummary | null>(null);
  private readonly openRef = signal(false);
  private readonly pickerRef = signal<PaymentMethodPickerRequest | null>(null);
  private readonly componentRef = signal<Type<unknown> | null>(null);

  readonly isOpen = this.openRef.asReadonly();
  readonly picker = this.pickerRef.asReadonly();
  readonly selectedPaymentMethodId = computed(() => this.pickerRef()?.selectedPaymentMethodId ?? null);
  readonly component = this.componentRef.asReadonly();
  readonly euroSummary = computed(() => this.historySummaryRef()?.euroSummary ?? null);
  readonly pendingRefundCount = computed(() => this.historySummaryRef()?.pendingRefundCount ?? 0);

  private identity=this.profiles.activeUserId();
  constructor(){effect(()=>{const id=this.profiles.activeUserId();if(id!==this.identity){this.identity=id;this.counterparty.set(null);this.close();}});}
  async chooseCounterparty():Promise<void>{const userId=this.profiles.activeUserId();await this.memberPicker.ensureAssetMemberPickerPopupLoaded();
    if(userId!==this.profiles.activeUserId()||!this.isOpen())return;
    this.memberPicker.openActivityInvitePopup({ownerId:userId,ownerType:'asset',purpose:'payment',headerTitle:'payment.history.counterparty',selectionLimit:1,parentZIndex:22600,closeOwnerPopupOnClose:false,
      initialSelection:this.counterparty()?[this.counterparty()!]:[],onApply:selected=>{if(userId===this.profiles.activeUserId()&&this.isOpen())this.counterparty.set(selected[0]??null);}});
  }
  applyHistorySummary(userId: string, summary: HistorySummary): void {
    if (this.profiles.activeUserId() !== userId) return;
    const spendingTotals = { ...summary.spendingTotals };
    const incomeTotals = { ...summary.incomeTotals };
    const pendingRefundCount = Math.max(0, Math.trunc(Number(summary.pendingRefundCount) || 0));
    this.historySummaryRef.set({
      euroSummary: summary.euroSummary ? { ...summary.euroSummary } : null,
      spendingTotals, incomeTotals, pendingRefundCount
    });
    const currencies = new Set([...Object.keys(spendingTotals), ...Object.keys(incomeTotals)]);
    this.activities.patchUserCounterOverrides(userId, { paymentRefundsPending: pendingRefundCount });
    this.profiles.patchActiveUserProfile(current => ({
      paymentTotals: {
        outgoing: spendingTotals,
        incoming: incomeTotals,
        all: Object.fromEntries([...currencies].map(currency => [currency,
          Math.round(((Number(spendingTotals[currency]) || 0) + (Number(incomeTotals[currency]) || 0)) * 100) / 100
        ]))
      },
      activities: { ...current.activities, paymentRefundsPending: pendingRefundCount }
    }));
  }

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
    this.historySummaryRef.set(null);
    this.counterparty.set(null);
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

  selectPickerPaymentMethod(paymentMethodId: string): void {
    const picker = this.pickerRef();
    const normalizedId = paymentMethodId.trim();
    if (!picker || !normalizedId) return;
    this.pickerRef.set({ ...picker, selectedPaymentMethodId: normalizedId });
  }

  confirm(paymentMethod: SavedPaymentMethodDto): void {
    const picker = this.pickerRef();
    if (!picker) return;
    picker.onSelect({ ...paymentMethod });
    this.close();
  }

  async ensureLoaded(): Promise<void> {
    if (this.componentRef()) return;
    const module = await import('../../../components/payment-methods-popup/payment-methods-popup.component');
    this.componentRef.set(module.PaymentMethodsPopupComponent);
  }
}
