import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { PricingConfig } from '../../../contracts/pricing.interface';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsService } from './events.service';
import { LocalUsersService } from './users.service';

describe('LocalEventsService', () => {
  const waitForRouteDelay = vi.fn();
  const queryEventRecordById = vi.fn();
  const queryInvitationItemsByUser = vi.fn();
  const requestJoin = vi.fn();
  const trashItem = vi.fn();
  const flushEvents = vi.fn();
  const markUnreadBySource = vi.fn();
  const unreadCount = vi.fn();
  const syncRealtimeNotificationCount = vi.fn();

  beforeEach(() => {
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    queryEventRecordById.mockReset();
    queryInvitationItemsByUser.mockReset().mockReturnValue([]);
    requestJoin.mockReset();
    trashItem.mockReset();
    flushEvents.mockReset().mockResolvedValue(undefined);
    markUnreadBySource.mockReset().mockReturnValue(0);
    unreadCount.mockReset().mockReturnValue(0);
    syncRealtimeNotificationCount.mockReset();
    TestBed.configureTestingModule({
      providers: [
        LocalEventsService,
        { provide: RouteDelayService, useValue: { waitForRouteDelay } },
        {
          provide: LocalEventsRepository,
          useValue: {
            queryEventRecordById,
            queryInvitationItemsByUser,
            requestJoin,
            trashItem,
            flushToIndexedDb: flushEvents
          }
        },
        { provide: LocalActivityResourcesRepository, useValue: {} },
        { provide: LocalActivitySubEventStageRuntimeRepository, useValue: {} },
        { provide: LocalEventCheckoutBasketsRepository, useValue: {} },
        { provide: LocalEventFeedbackRepository, useValue: {} },
        { provide: LocalUsersRepository, useValue: {} },
        {
          provide: LocalNotificationsRepository,
          useValue: { markUnreadBySource, unreadCount }
        },
        { provide: LocalActivityMembersService, useValue: {} },
        {
          provide: LocalUsersService,
          useValue: { syncRealtimeNotificationCount }
        }
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

  it('marks the related notification read after accepting an invitation', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    requestJoin.mockReturnValue({
      id: 'event-1',
      acceptedMembers: 1,
      pendingMembers: 0,
      capacityTotal: 10,
      acceptedMemberUserIds: ['user-1']
    } as ActivityEventRecord);
    markUnreadBySource.mockReturnValue(1);
    unreadCount.mockReturnValue(4);

    await TestBed.inject(LocalEventsService).requestJoin('user-1', 'event-1', {
      bookingConfirmed: true
    });

    expect(markUnreadBySource).toHaveBeenCalledWith(
      'user-1',
      'event-invite',
      'event',
      'event-1'
    );
    expect(requestJoin.mock.invocationCallOrder[0])
      .toBeLessThan(markUnreadBySource.mock.invocationCallOrder[0]);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('user-1', 4);
  });

  it('marks the related notification read after rejecting an invitation', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    markUnreadBySource.mockReturnValue(1);
    unreadCount.mockReturnValue(3);

    await TestBed.inject(LocalEventsService).trashItem('user-1', 'event-1');

    expect(markUnreadBySource).toHaveBeenCalledWith(
      'user-1',
      'event-invite',
      'event',
      'event-1'
    );
    expect(trashItem.mock.invocationCallOrder[0])
      .toBeLessThan(markUnreadBySource.mock.invocationCallOrder[0]);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('user-1', 3);
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
