import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalIntegrationRepository } from '../repositories/integration.repository';
import { LocalEventsService } from './events.service';

describe('Local client checkout revenue contract', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps group spending on the payer and reads asset income from the same record, including refunds', () => {
    let state: any = { users: { ids: ['buyer', 'buyer-group', 'owner', 'owner-group'], byId: {
      buyer: {id: 'buyer', activities: {}},
      'buyer-group': {id: 'buyer-group', accountUserId: 'buyer', workspaceGroupId: 'group-a', activities: {}},
      owner: {id: 'owner', activities: {}},
      'owner-group': {id: 'owner-group', accountUserId: 'owner', workspaceGroupId: 'group-b', activities: {}}
    }}};
    TestBed.configureTestingModule({providers: [{provide: LocalMemoryDb, useValue: {
      read: () => state, write: (change: any) => {state = change(state);}
    }}]});
    const ledger = TestBed.inject(LocalIntegrationRepository);
    ledger.recordPayment('buyer-group', 'asset-payment', 'EUR', 20, 0, false, 'asset', 'owner');
    expect(ledger.paymentHistory('buyer-group')).toEqual([expect.objectContaining({id: 'asset-payment', direction: 'expense'})]);
    expect(ledger.paymentHistory('owner')).toEqual([expect.objectContaining({id: 'asset-payment', direction: 'income'})]);
    expect(ledger.paymentHistory('buyer')).toEqual([]);
    expect(ledger.paymentHistory('owner-group')).toEqual([]);
    expect(state.users.byId.owner.affiliatePayments).toBeUndefined();
    expect(state.users.byId.buyer.affiliatePayments).toBeUndefined();
    ledger.recordPayment('buyer-group', 'asset-payment', 'EUR', 20, 5, false);
    expect(ledger.paymentHistory('buyer-group')).toContainEqual(expect.objectContaining({auditKind: 'refund', direction: 'income', amount: 5}));
    expect(ledger.paymentHistory('owner')).toContainEqual(expect.objectContaining({auditKind: 'refund', direction: 'expense', amount: 5}));
  });

  it('records an asset purchase without an event booking and credits its actual owner', async () => {
    let state: any = { users: { ids: ['referrer', 'buyer', 'asset-owner'], byId: {
      referrer: { id: 'referrer', activities: {} },
      buyer: { id: 'buyer', affiliateReferrerUserId: 'referrer', activities: {} },
      'asset-owner': { id: 'asset-owner', activities: {} }
    } } };
    let persisted: any;
    TestBed.configureTestingModule({ providers: [{ provide: LocalMemoryDb, useValue: {
      read: () => state, write: (change: any) => { state = change(state); },
      flushToIndexedDb: async () => { persisted = structuredClone(state.users); }
    } }] });
    const ledger = TestBed.inject(LocalIntegrationRepository);
    const service: any = Object.assign(Object.create(LocalEventsService.prototype), {
      affiliateRepository: ledger,
      eventsRepository: { peekKnownItemById: () => null },
      assetsRepository: { peekAssetById: () => ({ ownerUserId: 'asset-owner' }) },
      waitForRouteDelay: async () => {}, saveCheckoutBasketRecord: async () => null
    });
    const session = await service.authorizeCheckout({ userId: 'buyer', sourceId: 'transport',
      currency: 'EUR', totalAmount: 20, basketItems: [], lineItems: [] });
    expect(persisted.byId.referrer.affiliateRevenue).toEqual({
      currencies: { EUR: { gross: 20, refunded: 0, net: 20 } }, purchases: 1, eventBookings: 0
    });
    expect(persisted.byId.buyer.affiliatePayments[session.id]).toMatchObject({
      recipientUserId: 'asset-owner', sourceId: 'transport', eventBooking: false
    });
    expect(ledger.paymentHistory('asset-owner').some(item => item.id === session.id && item.amount === 20)).toBe(true);
  });
});
