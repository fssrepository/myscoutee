import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../../shared/core/base/services/i18n.service';
import { EventPromoCodeAddPopupComponent } from './event-promo-code-add-popup.component';

describe('EventPromoCodeAddPopupComponent validation localization', () => {
  const translate = vi.fn((value: string | null | undefined, fallback?: string | null) => {
    if (value === 'event.checkout.promo.invalid') {
      return 'Ez a promóciós kód nem érvényes ehhez az eseményhez.';
    }
    return `${fallback || value || ''}`;
  });

  beforeEach(() => {
    translate.mockClear();
    TestBed.configureTestingModule({
      imports: [EventPromoCodeAddPopupComponent],
      providers: [{
        provide: I18nService,
        useValue: {
          revision: vi.fn(),
          translate
        }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('translates the validation key and keeps the backend message as fallback', () => {
    const fixture = TestBed.createComponent(EventPromoCodeAddPopupComponent);
    fixture.componentRef.setInput('popup', {
      ownerId: 'test-owner',
      title: 'event.checkout.promo.add.title',
      subtitle: 'event.checkout.promo.add.subtitle',
      zIndex: 12900,
      appliedPromoCodes: [],
      busy: false,
      validationErrorKey: 'event.checkout.promo.invalid',
      validationError: 'Backend-localized fallback'
    });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent?.trim()).toBe('Ez a promóciós kód nem érvényes ehhez az eseményhez.');
    expect(translate).toHaveBeenCalledWith(
      'event.checkout.promo.invalid',
      'Backend-localized fallback'
    );
  });
});
