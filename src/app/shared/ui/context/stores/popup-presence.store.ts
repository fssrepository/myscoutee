import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PopupPresenceStore {
  private static readonly DEFAULT_Z_INDEX = 2300;
  private static readonly STACK_STEP = 100;
  private readonly activeTokensRef = signal<ReadonlySet<symbol>>(new Set());
  private readonly activeLayers = new Map<symbol, number>();

  readonly visible = computed(() => this.activeTokensRef().size > 0);

  register(requestedZIndex: number | null = null): symbol {
    const token = Symbol('app-popup');
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
