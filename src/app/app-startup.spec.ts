import { Component, EventEmitter, Output, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { Subject, type Subscription } from 'rxjs';
import { App } from './app';
import { DEFAULT_DEPLOYMENT_BRANDING } from './shared/core/contracts/platform/deployment-configuration.interface';
import { HomeHeaderComponent } from './home/components/home-header/home-header.component';
import { AppMenuComponent } from '@fssrepository/myscoutee-components';
import { SessionService } from './shared/core/base/services/accounts/session.service';
import { OfflineCacheService } from './shared/core/base/services/platform/offline-cache.service';
import { PwaService } from './shared/core/base/services/platform/pwa.service';
import { I18nService } from './shared/core/base/services/localization/i18n.service';
import { AppLocationService } from './shared/core/base/services/accounts/app-location.service';
import { DeploymentConfigurationService } from './shared/core/base/services/platform/deployment-configuration.service';
import { DemoBootstrapSelectorStore } from './shared/ui/context/stores/app/demo-bootstrap-selector.store';
import { AppSetupStore } from './shared/ui/context/stores/app/app-setup.store';

@Component({ selector: 'router-outlet', template: '' })
class TestOutlet { @Output() activate = new EventEmitter<void>(); }
@Component({ selector: 'app-setup-popup', template: '' })
class TestSetup {}
@Component({ selector: 'app-payment-authorization-popup', template: '' })
class TestPayment {}
@Component({ selector: 'app-dialog', template: '' })
class TestDialog {}
@Component({ selector: 'test-demo-selector', template: '<button>Selected demo user</button>' })
class TestDemoSelector {}

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
      { provide: AppSetupStore, useValue: { isOpen: signal(false) } },
      { provide: DeploymentConfigurationService, useValue: {
        initialize: vi.fn(), branding: signal({ productName: 'MyScoutee', logoUrl: '' })
      } }
    ] }).overrideComponent(App, { set: { imports: [NgComponentOutlet, TestOutlet, TestSetup, TestPayment, HomeHeaderComponent, AppMenuComponent, TestDialog] } });
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

  it('shows the default logo and releases the page before branding finishes', () => {
    const loading = signal(true);
    const initialize = vi.fn(() => new Promise<void>(() => {}));
    TestBed.overrideProvider(DeploymentConfigurationService, { useValue: {
      initialize, loading, branding: signal({ ...DEFAULT_DEPLOYMENT_BRANDING })
    } });
    const fixture = create();
    expect(initialize).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.app-route-warmup img').getAttribute('src'))
      .toBe('assets/logo/heart.webp');
    expect(fixture.nativeElement.querySelector('.app-route-warmup__label').textContent)
      .toBe('MyScoutee');
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    expect(loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });

  it('uses configured branding when ready and respects an intentionally empty logo', () => {
    const loading = signal(true);
    const branding = signal({ productName: DEFAULT_DEPLOYMENT_BRANDING.productName, logoUrl: DEFAULT_DEPLOYMENT_BRANDING.logoUrl });
    TestBed.overrideProvider(DeploymentConfigurationService, { useValue: {
      initialize: vi.fn(), loading, branding
    } });
    const fixture = create();
    branding.set({ productName: 'Configured name', logoUrl: 'assets/configured-logo.png' });
    loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup img').getAttribute('src'))
      .toBe('assets/configured-logo.png');
    expect(fixture.nativeElement.querySelector('.app-route-warmup__label').textContent)
      .toBe('Configured name');
    branding.set({ productName: 'Configured name', logoUrl: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup img')).toBeNull();
  });

  it.each(['/', '/entry', '/game'])('covers the empty initial route until activation without a saved session on %s', url => {
    const fixture = create(url);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
    events.next(new NavigationStart(1, url));
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });

  it('does not start the application logo loader when Firebase login completes on the landing page', () => {
    const fixture = create();
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'new-session-user' } });
    window.dispatchEvent(new Event('focus'));
    events.next(new NavigationStart(2, '/game'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
  });

  it('keeps the avatar timeline when the lazy menu takes over after initial navigation', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'cached-user' } });
    const fixture = create('/game');
    const app = fixture.componentInstance as unknown as { avatarLoadStartedAt: number };
    const startedAt = app.avatarLoadStartedAt;
    expect(startedAt).toBeGreaterThan(0);
    vi.advanceTimersByTime(1800);
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    router.url = '/game';
    events.next(new NavigationEnd(1, '/game', '/game'));
    fixture.detectChanges();
    expect(app.avatarLoadStartedAt).toBe(startedAt);
    expect(fixture.nativeElement.querySelector('.game-startup-avatar')).not.toBeNull();
  });

  it('shows the avatar during accepted HTTP demo navigation and restores the same selector on failure', () => {
    TestBed.overrideProvider(DemoBootstrapSelectorStore, { useValue: {
      demoBootstrapSelector: signal({ mode: 'member' }),
      demoBootstrapSelectorComponent: signal(TestDemoSelector)
    } });
    const fixture = create('/entry');
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    const selector = fixture.nativeElement.querySelector('test-demo-selector');
    currentSession.mockReturnValue({ kind: 'demo', userId: 'member' });
    router.getCurrentNavigation.mockReturnValue({ id: 2, extras: { state: { avatarLoading: true } } });
    events.next(new NavigationStart(2, '/game'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-startup-avatar .app-menu__button-row-ring')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    expect(selector.closest('.route-content').hidden).toBe(true);
    expect(fixture.nativeElement.querySelector('router-outlet').closest('.route-content').hidden).toBe(true);
    const app = fixture.componentInstance as unknown as { avatarLoadStartedAt: number };
    expect(app.avatarLoadStartedAt).toBeGreaterThan(0);
    events.next(new NavigationCancel(2, '/game', 'Rejected', NavigationCancellationCode.GuardRejected));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-demo-selector')).toBe(selector);
    expect(selector.closest('.route-content').hidden).toBe(false);
    expect(fixture.nativeElement.querySelector('.game-startup-avatar')).toBeNull();
    expect(app.avatarLoadStartedAt).toBe(0);
  });

  it('continues the demo entry avatar timeline when the destination activates', () => {
    const selection = signal<object | null>({ mode: 'member' });
    const closeSelector = vi.fn(() => selection.set(null));
    TestBed.overrideProvider(DemoBootstrapSelectorStore, { useValue: {
      demoBootstrapSelector: selection,
      demoBootstrapSelectorComponent: signal(TestDemoSelector),
      closeDemoBootstrapSelector: closeSelector
    } });
    const fixture = create('/entry');
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    currentSession.mockReturnValue({ kind: 'demo', userId: 'member' });
    router.getCurrentNavigation.mockReturnValue({ id: 2, extras: { state: { avatarLoading: true } } });
    events.next(new NavigationStart(2, '/game'));
    const app = fixture.componentInstance as unknown as { avatarLoadStartedAt: number };
    const startedAt = app.avatarLoadStartedAt;
    vi.advanceTimersByTime(500);
    router.getCurrentNavigation.mockReturnValue({ id: 2, finalUrl: '/game' });
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    fixture.detectChanges();
    expect(app.avatarLoadStartedAt).toBe(startedAt);
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup-avatar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet').closest('.route-content').hidden).toBe(false);
    expect(closeSelector).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('test-demo-selector')).toBeNull();
  });

  it('keeps the loader across the root redirect while the destination is still loading', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    const fixture = create();
    events.next(new NavigationStart(1, '/'));
    events.next(new NavigationCancel(1, '/', 'Redirect', NavigationCancellationCode.Redirect));
    events.next(new NavigationStart(2, '/game'));
    fixture.detectChanges();
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup, .game-startup')).not.toBeNull();
  });

  it('does not uncover the empty shell on focus during initial navigation', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    const fixture = create();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup, .game-startup')).not.toBeNull();
  });

  it('hands off immediately when the protected outlet activates', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
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
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    const fixture = create();
    events.next(new NavigationCancel(1, '/', 'Superseded', NavigationCancellationCode.SupersededByNewNavigation));
    events.next(new NavigationStart(2, '/entry'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup, .game-startup')).not.toBeNull();
  });

  it('releases the overlay on navigation failure instead of leaving it stuck', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    const fixture = create();
    events.next(new NavigationError(1, '/', new Error('Chunk failed')));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
  });

  it.each(['/', '/game'])('shows the shared header and avatar loader before guards finish on %s', url => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'cached-user' } });
    const fixture = create(url);
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.game-header button').length).toBe(0);
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

  it('removes the retained loading avatar when the validation redirect to entry commits', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'expired-user' } });
    const fixture = create('/game');
    events.next(new NavigationCancel(1, '/game', 'Redirect', NavigationCancellationCode.Redirect));
    events.next(new NavigationStart(2, '/entry'));
    expect(fixture.nativeElement.querySelector('.game-startup-avatar button').disabled).toBe(true);
    router.url = '/entry';
    router.navigated = true;
    events.next(new NavigationEnd(2, '/entry', '/entry'));
    // The Subject router stub does not schedule Angular's navigation render.
    fixture.changeDetectorRef.markForCheck();
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
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'member' } });
    readUser.mockReturnValue({ user: { id: 'other', images: ['/other-photo.webp'] } });
    const fixture = create('/game');
    expect(fixture.nativeElement.querySelector('.game-startup-avatar img')).toBeNull();
  });

  it('uses the session-bound app photo when Firebase and profile IDs differ', () => {
    const preview = 'data:image/webp;base64,UklGRg==';
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'firebase-uid', imageUrl: '/google-monogram.png' },
      avatarImageUrl: '/api/media/private?key=private%2Fimages%2Fowner%2Fprofile%2Fupload%2Flarge.webp', avatarImageDataUrl: preview });
    const fixture = create('/game');
    const image = fixture.nativeElement.querySelector('.game-startup-avatar img');
    expect(image.getAttribute('src')).toBe(preview);
    expect(image.getAttribute('src')).not.toContain('google-monogram');
  });

  it('does not request a private preview URL before media authentication is restored', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', profile: { id: 'member' },
      avatarImageUrl: '/api/media/private?key=private/images/owner/profile/upload/large.webp' });
    readUser.mockReturnValue({ user: { id: 'member', images: ['/api/media/private?key=private/images/owner/profile/upload/large.webp'] } });
    const fixture = create('/game');
    expect(fixture.nativeElement.querySelector('.game-startup-avatar img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-startup-avatar button').disabled).toBe(true);
  });

  it('does not render member startup controls on the operator route', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    router.url = '/operator';
    const fixture = create('/operator');
    expect(fixture.nativeElement.querySelector('.game-startup')).toBeNull();
  });

  it('cleans up pending startup timers when destroyed', () => {
    currentSession.mockReturnValue({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'operator', name: 'Operator', email: 'operator@example.test', initials: 'O' } });
    const fixture = create();
    const subscription = (fixture.componentInstance as unknown as {
      routerEventsSubscription: Subscription;
    }).routerEventsSubscription;
    window.dispatchEvent(new Event('focus'));
    fixture.destroy();
    // Root overlay services retain their own subscriptions until TestBed teardown.
    expect(subscription.closed).toBe(true);
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow();
  });
});
