import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PopupPresenceStore {
  private static readonly DEFAULT_Z_INDEX = 2300;
  private static readonly STACK_STEP = 100;
  private readonly activeTokensRef = signal<ReadonlySet<symbol>>(new Set());
  private readonly modalTokens = new Set<symbol>();
  private readonly activeLayers = new Map<symbol, number>();

  readonly visible = computed(() => {
    this.activeTokensRef();
    return this.modalTokens.size > 0;
  });
  readonly topLayer = computed(() => {
    this.activeTokensRef();
    return Math.max(0, ...this.activeLayers.values());
  });

  register(requestedZIndex: number | null = null, modal = true): symbol {
    const token = Symbol('app-popup');
    if (modal) this.modalTokens.add(token);
    const configuredLayer = Number(requestedZIndex);
    const baseLayer = Number.isFinite(configuredLayer) && configuredLayer > 0
      ? Math.trunc(configuredLayer)
      : PopupPresenceStore.DEFAULT_Z_INDEX;
    const highestActiveLayer = Math.max(0, ...this.activeLayers.values());
    this.activeLayers.set(
      token,
      highestActiveLayer > 0
        ? Math.max(baseLayer, highestActiveLayer + PopupPresenceStore.STACK_STEP)
        : baseLayer
    );
    this.activeTokensRef.update(current => {
      const next = new Set(current);
      next.add(token);
      return next;
    });
    return token;
  }

  unregister(token: symbol): void {
    this.activeLayers.delete(token);
    this.modalTokens.delete(token);
    this.activeTokensRef.update(current => {
      if (!current.has(token)) {
        return current;
      }
      const next = new Set(current);
      next.delete(token);
      return next;
    });
  }

  layer(token: symbol): number | null {
    return this.activeLayers.get(token) ?? null;
  }
}
