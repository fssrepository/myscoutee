import { Injectable } from '@angular/core';

/** Live launcher references, owned by component creation/destruction, not DOM scans. */
@Injectable({ providedIn: 'root' })
export class FloatingLauncherRegistry {
  private readonly launchers = new Map<HTMLElement, () => HTMLElement | undefined>();

  register(host: HTMLElement, menu: () => HTMLElement | undefined): () => void {
    this.launchers.set(host, menu);
    return () => { this.launchers.delete(host); };
  }

  *following(host: HTMLElement): Iterable<HTMLElement> {
    for (const [other, getMenu] of this.launchers) {
      // DOM order, not creation order, gives one-way priority and prevents
      // the guide and notification from repeatedly pushing each other away.
      if (host.ownerDocument !== other.ownerDocument || !other.isConnected
        || !(host.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const menu = getMenu();
      if (menu) yield menu;
    }
  }
}
