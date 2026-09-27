import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { OverlayNavigationStore } from './overlay-navigation.store';

class Browser extends EventTarget {
  location = { href: 'https://app.test/game' };
  entries: Array<{ state: Record<string, unknown>; url: string }> = [
    { state: { navigationId: 1 }, url: 'https://app.test/entry' },
    { state: { navigationId: 2, other: 'retained' }, url: this.location.href }
  ];
  index = 1;
  history = {
    get state(): Record<string, unknown> { return browser.entries[browser.index]!.state; },
    pushState: (state: Record<string, unknown>, _title: string, url: string) => {
      this.entries.splice(this.index + 1);
      this.entries.push({ state, url }); this.index++; this.location.href = url;
    },
    replaceState: (state: Record<string, unknown>, _title: string, url: string) => {
      this.entries[this.index] = { state, url }; this.location.href = url;
    },
    back: () => queueMicrotask(() => this.go(-1)),
    go: (delta: number) => queueMicrotask(() => this.go(delta))
  };
  go(delta: number): void {
    this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
    this.location.href = this.entries[this.index]!.url;
    this.dispatchEvent(new PopStateEvent('popstate', { state: this.history.state }));
  }
}
let browser: Browser;
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('overlay Back history', () => {
  let store: OverlayNavigationStore;
  let routeEvents: Subject<unknown>;
  beforeEach(() => {
    browser = new Browser();
    routeEvents = new Subject();
    TestBed.configureTestingModule({ providers: [
      { provide: DOCUMENT, useValue: { defaultView: browser } },
      { provide: Router, useValue: { events: routeEvents } }
    ] });
    store = TestBed.inject(OverlayNavigationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('dismisses top menu then parent popup without route/consent navigation', async () => {
    const route = vi.fn(); browser.addEventListener('popstate', route);
    const closed: string[] = [];
    const parent = store.register(() => { closed.push('popup'); store.unregister(parent); });
    const child = store.register(() => { closed.push('menu'); store.unregister(child); });
    expect(browser.entries).toHaveLength(4);
    const push = vi.spyOn(browser.history, 'pushState');
    expect(browser.history.state['other']).toBe('retained');
    browser.go(-1); await settle();
    expect(closed).toEqual(['menu']); expect(route).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(browser.location.href).toBe('https://app.test/game');
    browser.go(-1); await settle();
    expect(closed).toEqual(['menu', 'popup']); expect(browser.index).toBe(1);
    expect(push).not.toHaveBeenCalled();
    expect(route).not.toHaveBeenCalled();
    browser.go(-1); expect(route).toHaveBeenCalledOnce();
    expect(browser.location.href).toBe('https://app.test/entry');
  });

  it('X consumes only the overlay boundary, so the next Back navigates normally', async () => {
    const token = store.register(vi.fn());
    store.unregister(token); await settle();
    expect(browser.index).toBe(1);
    expect(browser.history.state).toEqual({ navigationId: 2, other: 'retained' });
    browser.go(-1); expect(browser.location.href).toBe('https://app.test/entry');
  });

  it('keeps a busy/required dialog on its route when closure is declined', async () => {
    const close = vi.fn(); const token = store.register(close);
    const push = vi.spyOn(browser.history, 'pushState');
    browser.go(-1); await settle();
    expect(close).toHaveBeenCalledOnce(); expect(browser.index).toBe(2);
    expect(push).not.toHaveBeenCalled();
    expect(browser.location.href).toBe('https://app.test/game');
    store.unregister(token); await settle();
  });

  it('handles X followed immediately by opening another popup', async () => {
    const old = store.register(vi.fn()); store.unregister(old);
    await Promise.resolve(); // cleanup has requested an asynchronous history.back
    const close = vi.fn(); const next = store.register(close);
    await settle(); expect(close).not.toHaveBeenCalled(); expect(browser.index).toBe(2);
    browser.go(-1); await settle(); expect(close).toHaveBeenCalledOnce();
    store.unregister(next); await settle();
  });

  it('does not reopen a popup on Forward', async () => {
    const token = store.register(() => store.unregister(token));
    browser.go(-1); await settle();
    browser.go(1);
    expect(browser.history.state['__myscouteeOverlay']).toBeUndefined();
  });

  it('does not intercept real route changes or pop the newly navigated route', async () => {
    const close = vi.fn(); const route = vi.fn(); browser.addEventListener('popstate', route);
    const token = store.register(close);
    browser.history.pushState({ navigationId: 3 }, '', 'https://app.test/profile');
    store.unregister(token); await settle();
    expect(browser.location.href).toBe('https://app.test/profile');
    expect(close).not.toHaveBeenCalled();
  });

  it('does not send logout back to the old route while its lazy destination loads', async () => {
    const old = store.register(vi.fn());
    routeEvents.next(new NavigationStart(3, '/entry'));
    store.unregister(old);
    await settle();
    expect(browser.location.href).toBe('https://app.test/game');
    expect(browser.index).toBe(2);
    expect(browser.history.state['__myscouteeOverlay']).toBeUndefined();
    browser.history.pushState({ navigationId: 3 }, '', 'https://app.test/entry');
    routeEvents.next(new NavigationEnd(3, '/entry', '/entry'));
    await settle();
    expect(browser.location.href).toBe('https://app.test/entry');
    expect(browser.index).toBe(3);
  });

  it('anchors destination overlays only after the destination route commits', async () => {
    const old = store.register(vi.fn());
    routeEvents.next(new NavigationStart(3, '/entry'));
    store.unregister(old);
    const close = vi.fn();
    const next = store.register(close);
    await settle();
    expect(browser.index).toBe(2);
    browser.history.pushState({ navigationId: 3 }, '', 'https://app.test/entry');
    routeEvents.next(new NavigationEnd(3, '/entry', '/entry'));
    await settle();
    store.unregister(next);
    await settle();
    expect(browser.location.href).toBe('https://app.test/entry');
    expect(browser.index).toBe(3);
    expect(close).not.toHaveBeenCalled();
  });
});
