import { Component, EventEmitter, Output, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';
import { HomeHeaderComponent } from './home/components/home-header/home-header.component';
import { AppMenuComponent } from './shared/ui/components/core/menu/menu.component';
import { SessionService } from './shared/core/base/services/session.service';
import { OfflineCacheService } from './shared/core/base/services/offline-cache.service';
import { PwaService } from './shared/core/base/services/pwa.service';
import { I18nService } from './shared/core/base/services/i18n.service';
import { AppLocationService } from './shared/core/base/services/app-location.service';
import { DeploymentConfigurationService } from './shared/core/base/services/deployment-configuration.service';

@Component({ selector: 'router-outlet', template: '' })
class TestOutlet { @Output() activate = new EventEmitter<void>(); }
@Component({ selector: 'app-setup-popup', template: '' })
class TestSetup {}
@Component({ selector: 'app-payment-authorization-popup', template: '' })
class TestPayment {}

describe('application startup loading handoff', () => {
  let events: Subject<unknown>;
  let router: { events: Subject<unknown>; url: string; navigated: boolean; getCurrentNavigation: ReturnType<typeof vi.fn> };
  const originalUrl = window.location.href;
  const currentSession = vi.fn();
  const readUser = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    currentSession.mockReset().mockReturnValue(null);
    readUser.mockReset().mockReturnValue(null);
    events = new Subject();
    router = { events, url: '/', navigated: false, getCurrentNavigation: vi.fn().mockReturnValue({ id: 1 }) };
    // Keep the real shell/template while isolating unrelated lazy menu and popup trees.
    vi.spyOn(App.prototype as unknown as { ensureSideMenuComponentLoaded(): Promise<void> },
      'ensureSideMenuComponentLoaded').mockResolvedValue(undefined);
    TestBed.configureTestingModule({ imports: [App], providers: [
      { provide: Router, useValue: router },
      { provide: PwaService, useValue: { initialize: vi.fn() } },
      { provide: I18nService, useValue: { initialize: vi.fn(), revision: signal(0), translate: (text: string) => text } },
      { provide: SessionService, useValue: { currentSession } },
      { provide: OfflineCacheService, useValue: { readUser } },
      { provide: AppLocationService, useValue: { initialize: vi.fn() } },
      { provide: DeploymentConfigurationService, useValue: {
        initialize: vi.fn(), branding: signal({ productName: 'MyScoutee', logoUrl: '' })
      } }
    ] }).overrideComponent(App, { set: { imports: [NgComponentOutlet, TestOutlet, TestSetup, TestPayment, HomeHeaderComponent, AppMenuComponent] } });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    events.complete();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, '', originalUrl);
  });

  function create(url = '/') {
    window.history.replaceState(null, '', url);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture;
  }

  it.each(['/', '/game'])('shows the shell loader on initial %s navigation', url => {
    const fixture = create(url);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
  });

  it('keeps the loader across the root redirect while the destination is still loading', () => {
    const fixture = create();
    events.next(new NavigationStart(1, '/'));
    events.next(new NavigationCancel(1, '/', 'Redirect', NavigationCancellationCode.Redirect));
    events.next(new NavigationStart(2, '/game'));
    fixture.detectChanges();
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
  });

  it('does not uncover the empty shell on focus during initial navigation', () => {
    const fixture = create();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
  });

  it('hands off immediately when the protected outlet activates', () => {
    const fixture = create();
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    router.navigated = true;
    router.getCurrentNavigation.mockReturnValue(null);
    events.next(new NavigationEnd(1, '/game', '/game'));
    vi.advanceTimersByTime(120);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    events.next(new NavigationStart(2, '/operator'));
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });

  it('keeps loading when a pending navigation is superseded', () => {
    const fixture = create();
    events.next(new NavigationCancel(1, '/', 'Superseded', NavigationCancellationCode.SupersededByNewNavigation));
    events.next(new NavigationStart(2, '/entry'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
  });

  it('releases the overlay on navigation failure instead of leaving it stuck', () => {
    const fixture = create();
    events.next(new NavigationError(1, '/', new Error('Chunk failed')));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });


  it.each(['/', '/game'])('shows the shared header and avatar loader before guards finish on %s', url => {
    currentSession.mockReturnValue({ kind: 'firebase', profile: { id: 'cached-user' } });
    const fixture = create(url);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.game-header button').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.game-header button:not(:disabled)').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.game-startup-avatar button').disabled).toBe(true);
    events.next(new NavigationStart(2, '/game'));
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-startup')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });

  it('removes the game preview when validation redirects to entry', () => {
    currentSession.mockReturnValue({ kind: 'firebase', profile: { id: 'expired-user' } });
    const fixture = create('/game');
    events.next(new NavigationCancel(1, '/game', 'Redirect', NavigationCancellationCode.Redirect));
    events.next(new NavigationStart(2, '/entry'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup-avatar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
  });

  it('renders the cached small photo under the loading ring before guards finish', () => {
    currentSession.mockReturnValue({ kind: 'demo', userId: 'member' });
    readUser.mockReturnValue({ user: { id: 'member', images: ['/api/media/public?key=images%2Fowner%2Fprofile%2Fupload%2Flarge.webp'] } });
    const fixture = create('/game');
    const avatar = fixture.nativeElement.querySelector('.game-startup-avatar');
    expect(avatar.querySelector('img').getAttribute('src')).toContain('small.webp');
    expect(avatar.querySelector('.app-menu__button-row-ring')).not.toBeNull();
    expect(avatar.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('app-home')).toBeNull();
  });

  it('never displays another cached identity in the loading avatar', () => {
    currentSession.mockReturnValue({ kind: 'firebase', profile: { id: 'member' } });
    readUser.mockReturnValue({ user: { id: 'other', images: ['/other-photo.webp'] } });
    const fixture = create('/game');
    expect(fixture.nativeElement.querySelector('.game-startup-avatar img')).toBeNull();
  });

  it('uses the session-bound app photo when Firebase and profile IDs differ', () => {
    const preview = 'data:image/webp;base64,UklGRg==';
    currentSession.mockReturnValue({ kind: 'firebase', profile: { id: 'firebase-uid', imageUrl: '/google-monogram.png' },
      avatarImageUrl: '/api/media/private?key=private%2Fimages%2Fowner%2Fprofile%2Fupload%2Flarge.webp', avatarImageDataUrl: preview });
    const fixture = create('/game');
    const image = fixture.nativeElement.querySelector('.game-startup-avatar img');
    expect(image.getAttribute('src')).toBe(preview);
    expect(image.getAttribute('src')).not.toContain('google-monogram');
  });

  it('does not request a private preview URL before media authentication is restored', () => {
    currentSession.mockReturnValue({ kind: 'firebase', profile: { id: 'member' },
      avatarImageUrl: '/api/media/private?key=private/images/owner/profile/upload/large.webp' });
    readUser.mockReturnValue({ user: { id: 'member', images: ['/api/media/private?key=private/images/owner/profile/upload/large.webp'] } });
    const fixture = create('/game');
    expect(fixture.nativeElement.querySelector('.game-startup-avatar img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup-avatar button').disabled).toBe(true);
  });

  it('does not render member startup controls for an operator session', () => {
    currentSession.mockReturnValue({ kind: 'operator-bootstrap' });
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
  });

  it('cleans up pending startup timers when destroyed', () => {
    const fixture = create();
    window.dispatchEvent(new Event('focus'));
    fixture.destroy();
    expect(events.observed).toBe(false);
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow();
  });
});
