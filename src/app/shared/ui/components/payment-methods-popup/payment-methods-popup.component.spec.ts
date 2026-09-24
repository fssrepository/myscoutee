import '@angular/compiler';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { PaymentMethodsPopupComponent } from './payment-methods-popup.component';

function history(direction = 'all') {
  const payment = { id: 'paid', direction: 'expense', canRequestRefund: true };
  const untouched = { id: 'other', direction: 'expense' };
  let rows: any[] = [payment, untouched];
  const list = {
    patchVisibleItem: vi.fn((predicate, patch) => {
      const index = rows.findIndex(predicate);
      if (index < 0) return false;
      rows[index] = patch(rows[index]);
      return true;
    }),
    reinsertVisibleItem: vi.fn(item => { rows.push(item); return true; }),
    removeVisibleItems: vi.fn(predicate => { rows = rows.filter(row => !predicate(row)); })
  };
  const component = Object.assign(Object.create(PaymentMethodsPopupComponent.prototype), {
    activeUserId: () => 'payer', historyList: () => list, historyDirectionRef: signal(direction),
    euroSummary: signal(null), spendingTotalsRef: signal({}), incomeTotalsRef: signal({}),
    historyTotalsLoadedRef: signal(false), pendingRefundCountRef: signal(0), revisionRef: signal(7),
    activityStore: { patchUserCounterOverrides: vi.fn() },
    userProfileStore: { patchActiveUserProfile: vi.fn() }, loadAllHistory: vi.fn()
  });
  return { component, list, rows: () => rows, untouched };
}

const mutation = {
  item: { id: 'refund', direction: 'income', status: 'refund_requested' },
  items: [
    { id: 'paid', direction: 'expense', canRequestRefund: false },
    { id: 'refund', direction: 'income', status: 'refund_requested' }
  ],
  spendingTotals: { EUR: 100 }, incomeTotals: { EUR: 0 }, pendingRefundCount: 1
};

describe('Payment history mutation reconciliation', () => {
  it('patches canonical rows and inserts a refund without reloading or duplicating on replay', () => {
    const { component, list, rows, untouched } = history();
    component.applyPaymentHistoryMutation(mutation);
    component.applyPaymentHistoryMutation(mutation);
    expect(rows()).toEqual([mutation.items[0], untouched, mutation.items[1]]);
    expect(rows()[1]).toBe(untouched);
    expect(list.reinsertVisibleItem).toHaveBeenCalledTimes(1);
    expect(component.revisionRef()).toBe(7);
    expect(component.loadAllHistory).not.toHaveBeenCalled();
    expect(component.pendingRefundCountRef()).toBe(1);
    expect(component.spendingTotalsRef()).toEqual({ EUR: 100 });
  });

  it('keeps an incoming refund out of the expense filter while patching its original payment', () => {
    const { component, list, rows } = history('expenses');
    component.applyPaymentHistoryMutation(mutation);
    expect(rows().map(row => row.id)).toEqual(['paid', 'other']);
    expect(rows()[0].canRequestRefund).toBe(false);
    expect(list.reinsertVisibleItem).not.toHaveBeenCalled();
    expect(component.revisionRef()).toBe(7);
  });
});
