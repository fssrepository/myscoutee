import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PopupPresenceStore {
  private readonly activeTokensRef = signal<ReadonlySet<symbol>>(new Set());

  readonly visible = computed(() => this.activeTokensRef().size > 0);

  register(): symbol {
    const token = Symbol('app-popup');
    this.activeTokensRef.update(current => {
      const next = new Set(current);
      next.add(token);
      return next;
    });
    return token;
  }

  unregister(token: symbol): void {
    this.activeTokensRef.update(current => {
      if (!current.has(token)) {
        return current;
      }
      const next = new Set(current);
      next.delete(token);
      return next;
    });
  }
}
