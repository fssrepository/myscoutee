import { Component, EventEmitter, Output, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';
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

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject();
    router = { events, url: '/', navigated: false, getCurrentNavigation: vi.fn().mockReturnValue({ id: 1 }) };
    // Keep the real shell/template while isolating unrelated lazy menu and popup trees.
    vi.spyOn(App.prototype as unknown as { ensureSideMenuComponentLoaded(): Promise<void> },
      'ensureSideMenuComponentLoaded').mockResolvedValue(undefined);
    TestBed.configureTestingModule({ imports: [App], providers: [
      { provide: Router, useValue: router },
      { provide: PwaService, useValue: { initialize: vi.fn() } },
      { provide: I18nService, useValue: { initialize: vi.fn() } },
      { provide: AppLocationService, useValue: { initialize: vi.fn() } },
      { provide: DeploymentConfigurationService, useValue: {
        initialize: vi.fn(), branding: signal({ productName: 'MyScoutee', logoUrl: '' })
      } }
    ] }).overrideComponent(App, { set: { imports: [NgComponentOutlet, TestOutlet, TestSetup, TestPayment] } });
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

  it('waits for navigation completion even if the outlet activates first', () => {
    const fixture = create();
    fixture.debugElement.query(By.directive(TestOutlet)).componentInstance.activate.emit();
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-route-warmup')).not.toBeNull();
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

  it('cleans up pending startup timers when destroyed', () => {
    const fixture = create();
    window.dispatchEvent(new Event('focus'));
    fixture.destroy();
    expect(events.observed).toBe(false);
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow();
  });
});
