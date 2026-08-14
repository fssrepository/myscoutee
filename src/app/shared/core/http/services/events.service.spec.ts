import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { RouteDelayService } from '../../base/services/route-delay.service';
import { ActivityEventDetailDTO } from '../../contracts/activity.interface';
import { HttpEventsService } from './events.service';

describe('HttpEventsService', () => {
  const post = vi.fn();
  const get = vi.fn();
  const withRequestTimeout = vi.fn();

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    withRequestTimeout.mockReset().mockImplementation((_route: string, task: Promise<unknown>) => task);
    TestBed.configureTestingModule({
      providers: [
        HttpEventsService,
        { provide: HttpClient, useValue: { post, get } },
        { provide: RouteDelayService, useValue: { withRequestTimeout } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('posts the normalized code through the validation route timeout', async () => {
    post.mockReturnValue(of({
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
    }));

    const result = await TestBed.inject(HttpEventsService).validateCheckoutPromoCode({
      sourceId: ' i5 ',
      code: ' vipPhoto20 '
    });

    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(/\/activities\/events\/checkout\/promo-code\/validate$/),
      { sourceId: 'i5', code: 'VIPPHOTO20' }
    );
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/activities/events/checkout/promo-code/validate',
      expect.any(Promise),
      'Promo code validation timed out.'
    );
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

  it('preserves the backend translation key for an invalid code', async () => {
    post.mockReturnValue(of({
      valid: false,
      code: 'UNKNOWN',
      promoCode: null,
      effect: null,
      messageKey: 'event.checkout.promo.invalid',
      message: 'A localized server fallback'
    }));

    const result = await TestBed.inject(HttpEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: 'unknown'
    });

    expect(result).toMatchObject({
      valid: false,
      messageKey: 'event.checkout.promo.invalid',
      message: 'A localized server fallback'
    });
  });

  it('maps the legacy English invalid message to the bundle key', async () => {
    post.mockReturnValue(of({
      valid: false,
      code: 'UNKNOWN',
      promoCode: null,
      effect: null,
      message: 'A promo code is invalid or no longer active.'
    }));

    const result = await TestBed.inject(HttpEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: 'unknown'
    });

    expect(result?.messageKey).toBe('event.checkout.promo.invalid');
  });

  it('sends only the sub-event page query and returns only the backend page', async () => {
    post.mockReturnValue(of({
      mode: 'Casual',
      slots: [{ id: 'slot-13', parentEventId: 'event-1', subEventItems: [] }],
      total: 100,
      nextCursor: '24'
    }));

    const result = await TestBed.inject(HttpEventsService).loadSubEventsById(' user-1 ', ' event-1 ', {
      userId: 'user-1',
      eventId: 'event-1',
      order: 'upcoming',
      page: 1,
      pageSize: 12,
      cursor: '12'
    });

    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(/\/activities\/events\/sub-events$/),
      {
        userId: 'user-1',
        eventId: 'event-1',
        order: 'upcoming',
        page: 1,
        pageSize: 12,
        cursor: '12'
      }
    );
    expect(result).toEqual({
      mode: 'Casual',
      slots: [{ id: 'slot-13', parentEventId: 'event-1', subEventItems: [] }],
      total: 100,
      nextCursor: '24'
    });
  });

  it('reloads full event details after saving instead of returning the sparse list response', async () => {
    post.mockReturnValue(of({
      id: 'event-1',
      userId: 'host-1',
      title: 'Saved event',
      subtitle: 'List response',
      imageUrl: 'https://example.test/stale-event-image.jpg',
      subEventDefinitions: undefined
    }));
    get.mockReturnValue(of({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      title: 'Saved event',
      subtitle: 'Full response',
      imageUrl: '',
      subEventDefinitions: [{
        id: 'stage-1',
        name: 'Opening round',
        description: 'The saved definition',
        timing: 'After previous',
        offsetMinutes: 0,
        durationMinutes: 30,
        optional: false,
        capacityMin: 2,
        capacityMax: 8
      }],
      pricing: { enabled: true, basePrice: 20, currency: 'EUR' },
      policiesEnabled: true,
      policies: [{ id: 'policy-1', title: 'Rules', description: 'Play fair', required: true }],
      slotsEnabled: true,
      slotTemplates: [{ id: 'slot-1', startAt: '2026-08-01T10:00:00Z' }],
      sourceLink: 'https://example.test/event',
      blindMode: 'Open Event',
      autoInviter: true
    }));
    const payload = new ActivityEventDetailDTO().apply({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      title: 'Saved event',
      subtitle: 'Editor payload'
    });

    const result = await TestBed.inject(HttpEventsService).saveActivityEvent(payload);

    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/activities\/events\/detail$/),
      expect.objectContaining({ params: expect.anything() })
    );
    expect(result).toMatchObject({
      subtitle: 'Full response',
      imageUrl: '',
      sourceLink: 'https://example.test/event',
      policiesEnabled: true,
      slotsEnabled: true,
      autoInviter: true,
      subEventDefinitions: [{ id: 'stage-1', name: 'Opening round' }]
    });
  });

  it('does not turn an event-list transport failure into an authoritative empty page', async () => {
    post.mockReturnValue(throwError(() => new Error('backend restarting')));

    await expect(TestBed.inject(HttpEventsService).queryActivitiesEventDTOPage('user-1', {
      page: 0,
      pageSize: 20,
      filters: { eventScopeFilter: 'my-events' }
    })).rejects.toThrow('backend restarting');
  });

  it('still returns a successful empty event page as empty', async () => {
    post.mockReturnValue(of({ items: [], total: 0, nextCursor: null }));

    await expect(TestBed.inject(HttpEventsService).queryActivitiesEventDTOPage('user-1', {
      page: 0,
      pageSize: 20,
      filters: { eventScopeFilter: 'my-events' }
    })).resolves.toEqual({ items: [], total: 0, nextCursor: null });
  });

  it('returns the full stored event counter snapshot beside the selected bucket page', async () => {
    post.mockReturnValue(of({
      items: [],
      total: 0,
      nextCursor: null,
      eventCounters: {
        all: 0,
        active: 0,
        pending: 0,
        invitations: 0,
        hosting: 0,
        drafts: 0,
        trash: 0
      }
    }));

    await expect(TestBed.inject(HttpEventsService).queryActivitiesEventDTOPage('user-1', {
      page: 0,
      pageSize: 20,
      filters: { eventScopeFilter: 'active-events' }
    })).resolves.toMatchObject({
      total: 0,
      eventCounters: { all: 0, active: 0, trash: 0 }
    });
  });

  it('keeps legacy event-list read failures distinct from successful empty arrays', async () => {
    get.mockReturnValue(throwError(() => new Error('backend unavailable')));

    await expect(TestBed.inject(HttpEventsService).queryTrashedItemsByUser('user-1'))
      .rejects.toThrow('backend unavailable');
  });

  it('keeps Explore poll failures distinct from a successful empty page', async () => {
    post.mockReturnValue(throwError(() => new Error('backend unavailable')));

    await expect(TestBed.inject(HttpEventsService).queryEventExplorePage({
      userId: 'user-1',
      view: 'day',
      order: 'recent',
      friendsOnly: false,
      openSpotsOnly: false,
      topic: '',
      limit: 20,
      excludedSourceIds: []
    })).rejects.toThrow('backend unavailable');
  });

  it('converts event editor local wall times to UTC instants before saving', async () => {
    post.mockReturnValue(of({ id: 'event-1' }));
    get.mockReturnValue(of({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      startAtIso: '2026-08-06T16:00:00.000Z',
      endAtIso: '2026-08-06T18:00:00.000Z'
    }));
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

    await TestBed.inject(HttpEventsService).saveActivityEvent(payload);

    const request = post.mock.calls[0]?.[1] as ActivityEventDetailDTO;
    expect(request.startAtIso).toBe(new Date('2026-08-06T18:00').toISOString());
    expect(request.endAtIso).toBe(new Date('2026-08-06T20:00').toISOString());
    expect(request.dateRange).toEqual({
      startAt: request.startAtIso,
      endAt: request.endAtIso,
      precision: 'minute'
    });
    expect(payload.startAtIso).toBe('2026-08-06T18:00');
    expect(payload.endAtIso).toBe('2026-08-06T20:00');
  });
});
