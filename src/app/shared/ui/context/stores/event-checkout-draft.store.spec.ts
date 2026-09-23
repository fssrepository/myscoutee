import { describe, expect, it } from 'vitest';
import { EventCheckoutDraftStore, type EventCheckoutDraft } from './event-checkout-draft.store';

describe('Checkout draft terminal server state', () => {
  it('clears a server-deleted basket even when the cached local deadline is later', () => {
    const store = new EventCheckoutDraftStore();
    const userId = 'qa-expiry-regression';
    store.save({ userId, sourceId: 'expired', checkoutState: 'approval-pending',
      expiresAtIso: '2099-01-01T00:00:00Z', pendingReason: 'approval',
      totalAmount: 10, currency: 'EUR' } as EventCheckoutDraft);
    store.save({ userId, sourceId: 'active', checkoutState: 'approved',
      expiresAtIso: '2099-01-01T00:00:00Z', pendingReason: null,
      totalAmount: 10, currency: 'EUR' } as EventCheckoutDraft);
    try {
      store.reconcileExpiredEventDrafts(userId, [
        { id: 'expired', checkoutResultState: 'deleted' },
        { id: 'active', checkoutResultState: 'pending' }
      ]);
      expect(store.read(userId, 'expired')).toBeNull();
      expect(store.read(userId, 'active')?.checkoutState).toBe('approved');
    } finally {
      store.clear(userId, 'expired');
      store.clear(userId, 'active');
    }
  });
});
