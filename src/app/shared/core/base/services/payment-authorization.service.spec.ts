import { TestBed } from '@angular/core/testing';
import { PaymentAuthorizationService } from './payment-authorization.service';
import { EventsService } from './events.service';
import { I18nService } from './i18n.service';
import type { EventCheckoutPaymentAudit } from '../../contracts/activity.interface';

describe('payment adapter startup boundary', () => {
  const loadCheckoutPaymentAudit = vi.fn();
  const createEvents = vi.fn();
  beforeEach(() => {
    loadCheckoutPaymentAudit.mockReset();
    createEvents.mockReset().mockReturnValue({ loadCheckoutPaymentAudit });
    TestBed.configureTestingModule({ providers: [PaymentAuthorizationService,
      { provide: EventsService, useFactory: createEvents },
      { provide: I18nService, useValue: { translate: (s: string) => s } }
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('does not initialize event repositories when the global popup mounts', () => {
    expect(TestBed.inject(PaymentAuthorizationService).waitingSurface()).toBeNull();
    expect(createEvents).not.toHaveBeenCalled();
  });

  it('uses the same audit adapter and arguments when authorization is requested', async () => {
    const service = TestBed.inject(PaymentAuthorizationService) as unknown as {
      waitForAuthorization(user: string, source: string, attempt: { id: string; cancelled: boolean }): Promise<EventCheckoutPaymentAudit>;
    };
    const audit = { status: 'captured' } as EventCheckoutPaymentAudit;
    loadCheckoutPaymentAudit.mockResolvedValue(audit);
    expect(await service.waitForAuthorization('user', 'event', { id: 'payment', cancelled: false })).toBe(audit);
    expect(loadCheckoutPaymentAudit).toHaveBeenCalledWith('user', 'event', 'payment');
  });

  it('does not query an audit after cancellation', async () => {
    const service = TestBed.inject(PaymentAuthorizationService) as unknown as {
      waitForAuthorization(user: string, source: string, attempt: { id: string; cancelled: boolean }): Promise<unknown>;
    };
    await expect(service.waitForAuthorization('user', 'event', { id: 'payment', cancelled: true })).rejects.toThrow('cancelled');
    expect(loadCheckoutPaymentAudit).not.toHaveBeenCalled();
  });
});
