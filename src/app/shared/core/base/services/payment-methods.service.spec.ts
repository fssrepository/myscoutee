import { TestBed } from '@angular/core/testing';
import { PaymentMethodsService } from './payment-methods.service';
import { SessionService } from './session.service';
import { HttpPaymentMethodsService } from '../../http/services/payment-methods.service';
import { LocalPaymentMethodsService } from '../../local/source/services/payment-methods.service';
import type { ListQuery } from '@fssrepository/myscoutee-components';

// Both adapters have bounded pages; the visible SmartList window can span them.
describe('payment history visible window', () => {
  let rows: { id: string }[];
  const queryAllHistory = vi.fn(async (_userId: string, query: ListQuery) => {
    const size = Math.min(20, query.pageSize);
    const start = query.page * size;
    return { items: rows.slice(start, start + size), total: rows.length,
      nextCursor: start + size < rows.length ? `${query.page + 1}` : null,
      spendingTotals: {}, incomeTotals: {}, pendingRefundCount: 0 };
  });
  beforeEach(() => {
    rows = Array.from({ length: 73 }, (_, index) => ({ id: `receipt-${index}` }));
    queryAllHistory.mockClear();
    TestBed.configureTestingModule({ providers: [PaymentMethodsService,
      { provide: SessionService, useValue: {} },
      { provide: HttpPaymentMethodsService, useValue: { queryAllHistory } },
      { provide: LocalPaymentMethodsService, useValue: { queryAllHistory } }
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('keeps all loaded rows when polling beyond a single adapter page', async () => {
    const result = await TestBed.inject(PaymentMethodsService).queryAllHistory('payer', { page: 0, pageSize: 60 });
    expect(result.items.map(row => row.id)).toEqual(rows.slice(0, 60).map(row => row.id));
    expect(result.nextCursor).toBe('history:60');
    expect(queryAllHistory).toHaveBeenCalledTimes(3);
  });

  it('discovers a new receipt after an initially short history without dropping its tail', async () => {
    rows = rows.slice(0, 4);
    const result = await TestBed.inject(PaymentMethodsService).queryAllHistory('payer', { page: 0, pageSize: 3 });
    expect(result.items.map(row => row.id)).toEqual(rows.map(row => row.id));
    expect(result.nextCursor).toBeNull();
  });

  it('continues at the exact item offset after a one-row mutation', async () => {
    const service = TestBed.inject(PaymentMethodsService);
    const window = await service.queryAllHistory('payer', { page: 0, pageSize: 21 });
    const next = await service.queryAllHistory('payer', { page: 1, pageSize: 20, cursor: window.nextCursor });
    expect(next.items.map(row => row.id)).toEqual(rows.slice(21, 41).map(row => row.id));
    expect(new Set([...window.items, ...next.items].map(row => row.id)).size).toBe(41);
    expect(next.nextCursor).toBe('history:41');
  });

  it('propagates cancellation instead of applying a partial window', async () => {
    const controller = new AbortController();
    queryAllHistory.mockImplementationOnce(async () => {
      controller.abort();
      return { items: rows.slice(0, 20), total: rows.length, nextCursor: '1', spendingTotals: {}, incomeTotals: {}, pendingRefundCount: 0 };
    });
    await expect(TestBed.inject(PaymentMethodsService).queryAllHistory('payer', { page: 0, pageSize: 60 }, controller.signal)).rejects.toThrow();
    expect(queryAllHistory).toHaveBeenCalledTimes(1);
  });
});
