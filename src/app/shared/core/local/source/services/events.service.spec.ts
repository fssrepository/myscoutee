import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import { ActivityEventDetailDTO, type ActivityEventRecord } from '../../../contracts/activity.interface';
import type { PricingConfig } from '../../../contracts/pricing.interface';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsService } from './events.service';
import { LocalUsersService } from './users.service';

describe('LocalEventsService', () => {
  const waitForRouteDelay = vi.fn();
  const queryEventRecordById = vi.fn();
  const saveEventSnapshot = vi.fn();
  const queryInvitationItemsByUser = vi.fn();
  const requestJoin = vi.fn();
  const trashItem = vi.fn();
  const peekKnownItemById = vi.fn();
  const queryHostingItemsByUser = vi.fn();
  const queryEventItemsByUser = vi.fn();
  const countUpcomingActiveEventItemsByUser = vi.fn();
  const queryTrashedItemsByUser = vi.fn();
  const queryUserById = vi.fn();
  const patchUserActivityCounterDeltas = vi.fn();
  const flushEvents = vi.fn();
  const markUnreadBySource = vi.fn();
  const unreadCount = vi.fn();
  const syncRealtimeNotificationCount = vi.fn();

  beforeEach(() => {
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    queryEventRecordById.mockReset();
    saveEventSnapshot.mockReset();
    queryInvitationItemsByUser.mockReset().mockReturnValue([]);
    requestJoin.mockReset();
    trashItem.mockReset();
    peekKnownItemById.mockReset().mockReturnValue(null);
    queryHostingItemsByUser.mockReset().mockReturnValue([]);
    queryEventItemsByUser.mockReset().mockReturnValue([]);
    countUpcomingActiveEventItemsByUser.mockReset().mockReturnValue(0);
    queryTrashedItemsByUser.mockReset().mockReturnValue([]);
    queryUserById.mockReset().mockReturnValue(null);
    patchUserActivityCounterDeltas.mockReset().mockResolvedValue(undefined);
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
            saveEventSnapshot,
            queryInvitationItemsByUser,
            requestJoin,
            trashItem,
            peekKnownItemById,
            queryHostingItemsByUser,
            queryEventItemsByUser,
            countUpcomingActiveEventItemsByUser,
            queryTrashedItemsByUser,
            flushToIndexedDb: flushEvents
          }
        },
        {
          provide: LocalChatsRepository,
          useValue: {
            syncPublishedMainEventChat: vi.fn()
          }
        },
        { provide: LocalActivityResourcesRepository, useValue: {} },
        { provide: LocalActivitySubEventStageRuntimeRepository, useValue: {} },
        { provide: LocalEventCheckoutBasketsRepository, useValue: {} },
        { provide: LocalEventFeedbackRepository, useValue: {} },
        { provide: LocalUsersRepository, useValue: { queryUserById } },
        {
          provide: LocalNotificationsRepository,
          useValue: { markUnreadBySource, unreadCount }
        },
        { provide: LocalActivityMembersService, useValue: {} },
        {
          provide: LocalUsersService,
          useValue: { syncRealtimeNotificationCount, patchUserActivityCounterDeltas }
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

  it('stores event editor local wall times as UTC instants', async () => {
    queryEventRecordById.mockReturnValue(null);
    saveEventSnapshot.mockImplementation(record => record);
    const payload = new ActivityEventDetailDTO().apply({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      dateRange: {
        startAt: '2026-08-06T18:00',
        endAt: '2026-08-06T20:00',
        precision: 'minute'
      }
    });

    await TestBed.inject(LocalEventsService).saveActivityEvent(payload);

    const record = saveEventSnapshot.mock.calls[0]?.[0] as ActivityEventRecord;
    expect(record.startAtIso).toBe(new Date('2026-08-06T18:00').toISOString());
    expect(record.endAtIso).toBe(new Date('2026-08-06T20:00').toISOString());
    expect(payload.startAtIso).toBe('2026-08-06T18:00');
    expect(payload.endAtIso).toBe('2026-08-06T20:00');
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
