import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

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
      subEventDefinitions: undefined
    }));
    get.mockReturnValue(of({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      title: 'Saved event',
      subtitle: 'Full response',
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
      sourceLink: 'https://example.test/event',
      policiesEnabled: true,
      slotsEnabled: true,
      autoInviter: true,
      subEventDefinitions: [{ id: 'stage-1', name: 'Opening round' }]
    });
  });
});
