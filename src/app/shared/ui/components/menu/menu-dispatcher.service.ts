import { Injectable, signal } from '@angular/core';

import type {
  AppMenuAnchorRect,
  AppMenuDispatchConfig,
  AppMenuDispatchState
} from './menu.types';

@Injectable({ providedIn: 'root' })
export class AppMenuDispatcher {
  private readonly activeMenuRef = signal<AppMenuDispatchState | null>(null);

  readonly activeMenu = this.activeMenuRef.asReadonly();

  open(config: AppMenuDispatchConfig, triggerElement: HTMLElement | null): void {
    this.activeMenuRef.set(this.createState(config, triggerElement));
  }

  toggle(config: AppMenuDispatchConfig, triggerElement: HTMLElement | null): void {
    if (this.activeMenuRef()?.id === config.id) {
      this.close(config.id);
      return;
    }
    this.open(config, triggerElement);
  }

  close(id?: string): void {
    const activeMenu = this.activeMenuRef();
    if (!activeMenu || (id && activeMenu.id !== id)) {
      return;
    }
    this.activeMenuRef.set(null);
  }

  isOpen(id: string): boolean {
    return this.activeMenuRef()?.id === id;
  }

  refreshActiveRect(): void {
    const activeMenu = this.activeMenuRef();
    if (!activeMenu) {
      return;
    }
    this.activeMenuRef.set({
      ...activeMenu,
      triggerRect: this.triggerRect(activeMenu.triggerElement)
    });
  }

  private createState(config: AppMenuDispatchConfig, triggerElement: HTMLElement | null): AppMenuDispatchState {
    return {
      ...config,
      kind: config.kind ?? 'select',
      items: config.items ?? [],
      model: config.model ?? null,
      groups: config.groups ?? [],
      value: config.value ?? null,
      trigger: config.trigger ?? null,
      openUp: config.openUp === true,
      panelAlign: config.panelAlign ?? 'auto',
      mobileBreakpointPx: Math.max(1, Number(config.mobileBreakpointPx) || 760),
      closeOnSelect: config.closeOnSelect !== false,
      triggerElement,
      triggerRect: this.triggerRect(triggerElement)
    };
  }

  private triggerRect(triggerElement: HTMLElement | null): AppMenuAnchorRect | null {
    if (!triggerElement || typeof triggerElement.getBoundingClientRect !== 'function') {
      return null;
    }
    const rect = triggerElement.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }
}
