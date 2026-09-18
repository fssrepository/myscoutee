import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { EntryFirebaseAuthPopupComponent } from './entry-firebase-auth-popup.component';

describe('EntryFirebaseAuthPopupComponent login feedback', () => {
  const limitMessage = 'Two sessions are already active. Sign out from one of them, then try again.';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EntryFirebaseAuthPopupComponent],
      providers: [{
        provide: I18nService,
        useValue: {
          revision: signal(0),
          translate: (key: string) => key === 'auth.session.limit.reached' ? limitMessage : key
        }
      }]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows a translated session rejection after choosing Google and clears it for a retry', () => {
    const fixture = TestBed.createComponent(EntryFirebaseAuthPopupComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const requested = vi.fn();
    fixture.componentInstance.authRequested.subscribe(requested);
    fixture.nativeElement.querySelector('.firebase-auth-provider-btn.google').click();
    expect(requested).toHaveBeenCalledWith({ provider: 'google' });

    fixture.componentRef.setInput('statusMessage', 'auth.session.limit.reached');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toBe(limitMessage);

    fixture.componentRef.setInput('statusMessage', '');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('keeps Facebook unavailable with its coming-soon notice', () => {
    const fixture = TestBed.createComponent(EntryFirebaseAuthPopupComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const requested = vi.fn();
    fixture.componentInstance.authRequested.subscribe(requested);
    const button = fixture.nativeElement.querySelector('.firebase-auth-provider-btn.facebook');
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.firebase-auth-provider-badge')?.textContent).toBe('coming.soon');
    button.click();
    expect(requested).not.toHaveBeenCalled();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    button.click();
    expect(requested).not.toHaveBeenCalled();
  });

  it('keeps the same notice visible once when switching to email sign-in', () => {
    const fixture = TestBed.createComponent(EntryFirebaseAuthPopupComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('statusMessage', 'auth.session.limit.reached');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.firebase-auth-provider-btn.email').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.firebase-auth-email-form')).not.toBeNull();
    const notices = fixture.nativeElement.querySelectorAll('.firebase-auth-status');
    expect(notices).toHaveLength(1);
    expect(notices[0].textContent).toBe(limitMessage);
  });
});
