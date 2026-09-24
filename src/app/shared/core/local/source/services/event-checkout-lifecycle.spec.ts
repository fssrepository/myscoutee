import { TestBed } from '@angular/core/testing';
import { AppMemoryDb } from '../../../common/app.db';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventsService } from './events.service';

const start = '2099-03-10T12:00:00Z';
const now = Date.parse('2099-03-10T09:00:00Z');

describe('Local checkout deadline and purge contract', () => {
  let persisted: any;
  let baskets: LocalEventCheckoutBasketsRepository;
  let parent: any;
  let service: any;
  const members = new Map<string, any>();
  beforeEach(() => {
    persisted = undefined;
    parent = { id: 'event', startAtIso: start, pricing: { enabled: true }, paymentDeadlineEnabled: true, paymentDeadlineHours: 4 };
    members.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AppMemoryDb, useValue: {
      whenReady: async () => {}, readIndexedDbTableEntry: async () => structuredClone(persisted),
      writeIndexedDbTableEntry: async (_key: string, value: any) => { persisted = structuredClone(value); }
    } }] });
    baskets = TestBed.inject(LocalEventCheckoutBasketsRepository);
    service = Object.assign(Object.create(LocalEventsService.prototype), {
      eventCheckoutBasketsRepository: baskets,
      eventsRepository: {
        queryEventRecordById: () => parent,
        leaveEvent: vi.fn((userId: string) => { members.get(userId).status = 'deleted'; }),
        flushToIndexedDb: vi.fn(async () => {})
      },
      activityMembersRepository: { peekRecordsByOwner: () => [...members.values()] },
      assetTicketsRepository: { synchronizeForMemberChange: vi.fn() }
    });
  });
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  const request = (userId: string, status = 'confirmed') => ({
    userId, sourceId: 'event', checkoutState: status, currency: 'EUR', totalAmount: 100,
    basketItems: [{ id: 'event:item', kind: 'event', sourceId: 'event', label: 'Event', detail: '',
      amount: 100, currency: 'EUR', quantity: 1, status, resultState: 'pending',
      expiresAtIso: '2199-01-01T00:00:00Z', pricingSummaryRows: [] }],
    lineItems: [], pricingSummaryRows: []
  });

  it('uses saved grace settings instead of caller expiry, including OFF and earliest slot', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now - 7200000);
    const saved = await service.saveCheckoutBasketRecord(request('auto'));
    expect(saved.items[0].expiresAtIso).toBe('2099-03-10T08:00:00.000Z');
    parent.paymentDeadlineEnabled = false;
    expect(service.checkoutDeadline('auto', 'event', [])).toBe('2099-03-10T12:00:00.000Z');
    parent.paymentDeadlineEnabled = true;
    parent.upcomingSlots = [{ id: 'early', startAtIso: '2099-03-10T11:00:00Z' }, { id: 'late', startAtIso: start }];
    expect(service.checkoutDeadline('auto', 'event', ['late', 'early'])).toBe('2099-03-10T07:00:00.000Z');
    vi.mocked(Date.now).mockReturnValue(now);
    await expect(service.saveCheckoutBasketRecord(request('late'))).rejects.toThrow('event.checkout.payment.deadline.passed');
  });

  it('expires manual and automatic unpaid reservations once, preserving paid membership and grace-OFF', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now - 7200000);
    for (const [userId, status] of [['manual', 'approved'], ['auto', 'confirmed'], ['paid', 'pay'], ['off', 'confirmed']]) {
      parent.paymentDeadlineEnabled = userId !== 'off';
      members.set(userId, { userId, status: userId === 'paid' ? 'accepted' : 'pending' });
      await service.saveCheckoutBasketRecord(request(userId, status));
      if (userId === 'paid') await baskets.updateBasketState({ userId, sourceId: 'event', checkoutState: 'pay', resultState: 'succeeded' });
    }
    expect(await service.purgeExpiredCheckoutBaskets(now)).toBe(2);
    expect(await service.purgeExpiredCheckoutBaskets(now)).toBe(0);
    expect(await baskets.loadBasketByEvent('manual', 'event')).toBeNull();
    expect(await baskets.loadBasketByEvent('auto', 'event')).toBeNull();
    expect((await baskets.loadBasketByEvent('paid', 'event'))?.totalAmount).toBe(100);
    expect(await baskets.loadBasketByEvent('off', 'event')).not.toBeNull();
    expect([...members.values()].map(item => item.status)).toEqual(['deleted', 'deleted', 'accepted', 'pending']);
    expect(service.eventsRepository.leaveEvent).toHaveBeenCalledTimes(2);
  });
});
