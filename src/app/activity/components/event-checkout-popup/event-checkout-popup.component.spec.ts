import '@angular/compiler';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { EventCheckoutPopupComponent } from './event-checkout-popup.component';

function checkout() {
  const dialog = { id: 1, userId: 'payer', record: { id: 'event' }, loading: false,
    readOnlySummary: false, hasPreloadedCheckoutBasket: false };
  const current = signal<any>(dialog);
  let resolve: (value: any) => void = () => {};
  const context = new Promise(done => { resolve = done; });
  const component = Object.assign(Object.create(EventCheckoutPopupComponent.prototype), {
    checkoutReviewLoadSequence: 0, checkoutReviewBodyLoading: signal(false),
    vipPricingOffer: signal(null), pricingContextFailed: signal(false),
    dialogStore: { dialog: current },
    eventEditorStore: { ensureEventEditorPopupLoaded: vi.fn(async () => {}) },
    eventsService: { loadInvitationContext: vi.fn(() => context), loadCheckoutBasketByEvent: vi.fn() },
    openCheckoutReviewEditorShell: vi.fn(), applyRuntimeCheckoutBasket: vi.fn(), setCheckoutErrorMessage: vi.fn()
  });
  return { component, dialog, current, resolve };
}

describe('Review Booking context loading', () => {
  it('uses the service-composed basket and pricing response without a second delayed request', async () => {
    const { component, dialog, resolve } = checkout();
    const loading = component.openCheckoutReviewEditor(dialog);
    await Promise.resolve();
    expect(component.checkoutReviewBodyLoading()).toBe(true);
    const basket = { items: [{ id: 'reserved' }] }, offer = { enabled: true };
    resolve({ checkoutBasket: basket, vipPricingOffer: offer });
    await loading;
    expect(component.eventsService.loadInvitationContext).toHaveBeenCalledExactlyOnceWith('payer', 'event');
    expect(component.eventsService.loadCheckoutBasketByEvent).not.toHaveBeenCalled();
    expect(component.vipPricingOffer()).toBe(offer);
    expect(component.applyRuntimeCheckoutBasket).toHaveBeenCalledExactlyOnceWith(dialog, basket);
    expect(component.checkoutReviewBodyLoading()).toBe(false);
  });

  it('does not apply a late context response to a closed checkout', async () => {
    const { component, dialog, current, resolve } = checkout();
    const loading = component.openCheckoutReviewEditor(dialog);
    await Promise.resolve();
    current.set(null);
    resolve({ checkoutBasket: null, vipPricingOffer: null });
    await loading;
    expect(component.applyRuntimeCheckoutBasket).not.toHaveBeenCalled();
    expect(component.eventsService.loadCheckoutBasketByEvent).not.toHaveBeenCalled();
  });
});
