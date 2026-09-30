import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/** One same-route history boundary per visible overlay.
 * Back dismisses the top surface; X consumes its existing boundary.
 * No session, consent, route or application data is stored in history.
 */
@Injectable({ providedIn: 'root' })
export class OverlayNavigationStore {
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly zone = inject(NgZone);
  private readonly markerKey = '__myscouteeOverlay';
  private readonly depthKey = '__myscouteeOverlayDepth';
  private readonly owner = `overlay-${Date.now()}-${Math.random()}`;
  private readonly surfaces = new Map<symbol, () => void>();
  private ownsEntry = false;
  private depth = 0;
  private forwardDepth = 0;
  private removingEntry = false;
  private anchorUrl = '';
  private anchorNavigationId: unknown;
  private scheduled = false;
  private destroyed = false;
  private navigating = false;

  constructor() {
    this.clearOrphanMarker();
    this.browser?.addEventListener('popstate', this.onPopState, true);
    const navigation = inject(Router).events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.navigating = true;
        // Route navigation owns history now. Destroying the old route's
        // overlays must not schedule a Back that cancels the destination.
        this.clearOrphanMarker();
        this.ownsEntry = false;
        this.depth = 0;
        this.forwardDepth = 0;
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.navigating = false;
        this.scheduleReconcile();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      navigation.unsubscribe();
      this.browser?.removeEventListener('popstate', this.onPopState, true);
      this.surfaces.clear();
    });
  }

  register(close: () => void): symbol {
    const token = Symbol('overlay-navigation');
    this.surfaces.set(token, close);
    this.reconcile();
    return token;
  }

  /** Keep a controlling overlay above presentation menus it opens itself. */
  bringToFront(token: symbol): void {
    const close = this.surfaces.get(token);
    if (!close || Array.from(this.surfaces.keys()).at(-1) === token) return;
    this.surfaces.delete(token);
    this.surfaces.set(token, close);
  }

  unregister(token: symbol): void {
    this.surfaces.delete(token);
    this.scheduleReconcile();
  }

  private readonly onPopState = (event: PopStateEvent): void => {
    const browser = this.browser;
    if (!browser) return;
    const sameRoute = browser.location.href === this.anchorUrl
      && event.state?.navigationId === this.anchorNavigationId;
    if ((this.ownsEntry || this.removingEntry) && sameRoute) {
      // Keep same-route overlay traversal out of Router guards and entry consent.
      event.stopImmediatePropagation();
      const dismiss = this.ownsEntry && !this.removingEntry;
      const previousDepth = this.depth;
      this.depth = event.state?.[this.markerKey] === this.owner
        ? Number(event.state[this.depthKey]) || 0 : 0;
      this.ownsEntry = this.depth > 0;
      this.removingEntry = false;
      if (this.depth < previousDepth) this.forwardDepth = previousDepth;
      if (dismiss && this.depth < previousDepth) {
        const close = Array.from(this.surfaces.values()).reverse().slice(0, previousDepth - this.depth);
        this.zone.run(() => close.forEach(dismissSurface => dismissSurface()));
      }
      // A busy/required surface may decline closure; retain its Back boundary.
      this.scheduleReconcile();
      return;
    }
    this.ownsEntry = false;
    this.depth = 0;
    this.forwardDepth = 0;
    this.removingEntry = false;
    // Forward must not resurrect a dismissed popup or re-run same-route guards.
    if (event.state?.[this.markerKey] && this.surfaces.size === 0) {
      event.stopImmediatePropagation();
      this.clearOrphanMarker();
    }
  };

  private scheduleReconcile(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (!this.destroyed) this.reconcile();
    });
  }

  private reconcile(): void {
    const browser = this.browser;
    if (!browser || this.removingEntry || this.destroyed || this.navigating) return;
    const state = browser.history.state;
    const depth = state?.[this.markerKey] === this.owner ? Number(state[this.depthKey]) || 0 : 0;
    const desiredDepth = this.surfaces.size;
    if (desiredDepth > depth && this.forwardDepth >= desiredDepth) {
      // A busy/required surface refused Back. Restore its existing entry;
      // pushState after a native Back makes Chrome skip this document's history.
      this.removingEntry = true;
      browser.history.go(desiredDepth - depth);
    } else if (desiredDepth > depth) {
      this.anchorUrl = browser.location.href;
      this.anchorNavigationId = state?.navigationId;
      for (let nextDepth = depth + 1; nextDepth <= desiredDepth; nextDepth++) {
        browser.history.pushState({ ...state, [this.markerKey]: this.owner, [this.depthKey]: nextDepth }, '', this.anchorUrl);
      }
      this.depth = desiredDepth;
      this.ownsEntry = true;
      this.forwardDepth = 0;
    } else if (desiredDepth < depth) {
      this.removingEntry = true;
      this.ownsEntry = false;
      browser.history.go(desiredDepth - depth);
    } else {
      this.forwardDepth = 0;
    }
  }

  private clearOrphanMarker(): void {
    const browser = this.browser;
    if (!browser?.history.state?.[this.markerKey]) return;
    const { [this.markerKey]: _marker, [this.depthKey]: _depth, ...state } = browser.history.state;
    browser.history.replaceState(state, '', browser.location.href);
  }
}
