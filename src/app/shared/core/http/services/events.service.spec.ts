import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RouteDelayService } from '../../base/services/route-delay.service';
import { HttpEventsService } from './events.service';

describe('HttpEventsService promo-code validation', () => {
  const post = vi.fn();
  const withRequestTimeout = vi.fn();

  beforeEach(() => {
    post.mockReset();
    withRequestTimeout.mockReset().mockImplementation((_route: string, task: Promise<unknown>) => task);
    TestBed.configureTestingModule({
      providers: [
        HttpEventsService,
        { provide: HttpClient, useValue: { post } },
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
});
