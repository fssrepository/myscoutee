import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { PricingConfig } from '../../../contracts/pricing.interface';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsService } from './events.service';
import { LocalUsersService } from './users.service';

describe('LocalEventsService promo-code validation', () => {
  const waitForRouteDelay = vi.fn();
  const queryEventRecordById = vi.fn();

  beforeEach(() => {
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    queryEventRecordById.mockReset();
    TestBed.configureTestingModule({
      providers: [
        LocalEventsService,
        { provide: RouteDelayService, useValue: { waitForRouteDelay } },
        { provide: LocalEventsRepository, useValue: { queryEventRecordById } },
        { provide: LocalActivityResourcesRepository, useValue: {} },
        { provide: LocalActivitySubEventStageRuntimeRepository, useValue: {} },
        { provide: LocalEventCheckoutBasketsRepository, useValue: {} },
        { provide: LocalEventFeedbackRepository, useValue: {} },
        { provide: LocalUsersRepository, useValue: {} },
        { provide: LocalActivityMembersService, useValue: {} },
        { provide: LocalUsersService, useValue: {} }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('waits for the route and validates against the bootstrapped repository record', async () => {
    queryEventRecordById.mockReturnValue(eventWithPromoCodes('i5'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: ' vipPhoto20 '
    });

    expect(waitForRouteDelay).toHaveBeenCalledWith(
      '/activities/events/checkout/promo-code/validate',
      undefined,
      'Request aborted.'
    );
    expect(queryEventRecordById).toHaveBeenCalledWith('', 'i5');
    expect(waitForRouteDelay.mock.invocationCallOrder[0])
      .toBeLessThan(queryEventRecordById.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      valid: true,
      code: 'VIPPHOTO20',
      promoCode: {
        id: 'urban-photo-vip-percent',
        code: 'VIPPHOTO20',
        action: { kind: 'decrease_percent', value: 20 }
      },
      effect: '-20%',
      messageKey: null,
      message: null
    });
  });

  it('resolves generated slots to their already stored parent pricing', async () => {
    queryEventRecordById.mockImplementation((_userId: string, sourceId: string) => sourceId === 'slot-1'
      ? { id: 'slot-1', parentEventId: 'event-1' } as ActivityEventRecord
      : eventWithPromoCodes('event-1'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'slot-1',
      code: 'VIPPHOTO20'
    });

    expect(queryEventRecordById).toHaveBeenNthCalledWith(1, '', 'slot-1');
    expect(queryEventRecordById).toHaveBeenNthCalledWith(2, '', 'event-1');
    expect(result?.valid).toBe(true);
  });

  it('returns a normal invalid result without mutating repository state', async () => {
    queryEventRecordById.mockReturnValue(eventWithPromoCodes('i5'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: 'unknown'
    });

    expect(result).toEqual({
      valid: false,
      code: 'UNKNOWN',
      promoCode: null,
      effect: null,
      messageKey: 'event.checkout.promo.invalid',
      message: null
    });
  });
});

function eventWithPromoCodes(id: string): ActivityEventRecord {
  return {
    id,
    pricing: {
      enabled: true,
      audience: {
        enabled: true,
        promoCodes: [{
          id: 'urban-photo-vip-percent',
          code: 'VIPPHOTO20',
          action: { kind: 'decrease_percent', value: 20 }
        }]
      }
    } as PricingConfig
  } as ActivityEventRecord;
}
