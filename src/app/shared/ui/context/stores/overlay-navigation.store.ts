import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';

/** One same-route history boundary for the visible overlay stack.
 * Back dismisses the top surface; X removes the boundary when the stack empties.
 * No session, consent, route or application data is stored in history.
 */
@Injectable({ providedIn: 'root' })
export class OverlayNavigationStore {
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly zone = inject(NgZone);
  private readonly markerKey = '__myscouteeOverlay';
  private readonly owner = `overlay-${Date.now()}-${Math.random()}`;
  private readonly surfaces = new Map<symbol, () => void>();
  private ownsEntry = false;
  private removingEntry = false;
  private anchorUrl = '';
  private anchorNavigationId: unknown;
  private scheduled = false;
  private destroyed = false;

  constructor() {
    this.clearOrphanMarker();
    this.browser?.addEventListener('popstate', this.onPopState, true);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
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
      this.ownsEntry = false;
      this.removingEntry = false;
      if (dismiss) {
        const close = Array.from(this.surfaces.values()).at(-1);
        this.zone.run(() => close?.());
      }
      // A busy/required surface may decline closure; retain its Back boundary.
      this.scheduleReconcile();
      return;
    }
    this.ownsEntry = false;
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
    if (!browser || this.removingEntry || this.destroyed) return;
    const state = browser.history.state;
    const isOurEntry = state?.[this.markerKey] === this.owner;
    if (this.surfaces.size > 0 && !isOurEntry) {
      this.anchorUrl = browser.location.href;
      this.anchorNavigationId = state?.navigationId;
      browser.history.pushState({ ...state, [this.markerKey]: this.owner }, '', this.anchorUrl);
      this.ownsEntry = true;
    } else if (this.surfaces.size === 0 && isOurEntry) {
      this.removingEntry = true;
      this.ownsEntry = false;
      browser.history.back();
    }
  }

  private clearOrphanMarker(): void {
    const browser = this.browser;
    if (!browser?.history.state?.[this.markerKey]) return;
    const { [this.markerKey]: _marker, ...state } = browser.history.state;
    browser.history.replaceState(state, '', browser.location.href);
  }
}
