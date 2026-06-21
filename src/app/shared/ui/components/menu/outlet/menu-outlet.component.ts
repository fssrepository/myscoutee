import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  inject
} from '@angular/core';

import { AppMenuComponent } from '../menu.component';
import { AppMenuDispatcher } from '../menu-dispatcher.service';
import { appMenuModelGroups } from '../menu-summary';
import type {
  AppMenuDispatchState,
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuPanelAlign
} from '../menu.types';

@Component({
  selector: 'app-menu-outlet',
  standalone: true,
  imports: [CommonModule, AppMenuComponent],
  template: `
    @if (activeMenu(); as menu) {
      <app-menu
        [kind]="menu.kind"
        [layout]="menu.layout"
        [title]="menu.title"
        [filterable]="menu.filterable"
        [items]="resolvedItems(menu)"
        [model]="menu.model"
        [groups]="menu.groups"
        [value]="menu.value"
        [open]="true"
        [openUp]="resolvedOpenUp(menu)"
        [panelAlign]="resolvedPanelAlign(menu)"
        [panelMode]="menu.panelMode"
        [panelDockToHost]="dockPanelToHost(menu)"
        [mobileBreakpointPx]="menu.mobileBreakpointPx"
        [closeOnSelect]="menu.closeOnSelect"
        (openChange)="onOpenChange($event, menu)"
        (itemSelect)="onItemSelect($event, menu)"
      ></app-menu>
    }
  `,
  styleUrl: './menu-outlet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMenuOutletComponent<TId extends string = string, TContext = unknown> {
  private static readonly DESKTOP_MARGIN_PX = 8;
  private static readonly DESKTOP_PANEL_GAP_PX = 4;
  private static readonly DESKTOP_MIN_PANEL_WIDTH_PX = 196;

  private readonly dispatcher = inject(AppMenuDispatcher);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  @Input() menu: AppMenuDispatchState<TId, TContext> | null = null;
  @Input() items: readonly AppMenuItem<TId, TContext>[] | null = null;

  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent<TId, TContext>>();

  @HostBinding('class.app-menu-outlet--open')
  protected get hostOpenClass(): boolean {
    return this.activeMenu() !== null;
  }

  @HostBinding('class.app-menu-outlet--dock')
  protected get hostDockClass(): boolean {
    return this.activeMenu()?.panelMode === 'dock';
  }

  @HostBinding('class.app-menu-outlet--fixed')
  protected get hostFixedClass(): boolean {
    return this.activeMenu()?.panelMode === 'fixed';
  }

  @HostBinding('style.left.px')
  protected get hostLeft(): number | null {
    const menu = this.activeMenu();
    if (!menu || this.isBottomMenu(menu) || this.isMobileMenu(menu)) {
      return null;
    }
    const rect = menu.triggerRect;
    if (!rect) {
      return AppMenuOutletComponent.DESKTOP_MARGIN_PX;
    }
    const align = this.resolvedPanelAlign(menu);
    const bounds = this.layoutBounds(menu);
    const estimatedWidth = this.estimatedPanelWidth(menu);
    if (align === 'start') {
      const minLeft = bounds.left + AppMenuOutletComponent.DESKTOP_MARGIN_PX;
      const maxLeft = Math.max(minLeft, bounds.right - estimatedWidth - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
      return Math.min(Math.max(rect.left, minLeft), maxLeft);
    }
    const minRight = bounds.left + estimatedWidth + AppMenuOutletComponent.DESKTOP_MARGIN_PX;
    const maxRight = Math.max(minRight, bounds.right - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
    return Math.min(Math.max(rect.right, minRight), maxRight);
  }

  @HostBinding('style.top.px')
  protected get hostTop(): number | null {
    const menu = this.activeMenu();
    if (!menu || this.isBottomMenu(menu) || this.isMobileMenu(menu)) {
      return null;
    }
    const rect = menu.triggerRect;
    if (!rect) {
      return AppMenuOutletComponent.DESKTOP_MARGIN_PX;
    }
    return this.resolvedOpenUp(menu)
      ? rect.top - AppMenuOutletComponent.DESKTOP_PANEL_GAP_PX
      : rect.bottom + AppMenuOutletComponent.DESKTOP_PANEL_GAP_PX;
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.dispatcher.refreshActiveRect();
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.dispatcher.refreshActiveRect();
  }

  protected onOpenChange(open: boolean, menu: AppMenuDispatchState<TId, TContext>): void {
    if (this.isControlledMenu(menu)) {
      return;
    }
    if (!open) {
      this.dispatcher.close(menu.id);
    }
  }

  protected onItemSelect(
    event: AppMenuItemSelectEvent<string, unknown>,
    menu: AppMenuDispatchState<TId, TContext>
  ): void {
    const selectEvent: AppMenuItemSelectEvent<TId, TContext> = {
      ...(event as AppMenuItemSelectEvent<TId, TContext>),
      context: (event.context ?? menu.context) as TContext | undefined
    };
    if (!this.isControlledMenu(menu) && this.shouldCloseOnItemSelect(event, menu)) {
      this.dispatcher.close(menu.id);
    }
    this.itemSelect.emit(selectEvent);
  }

  protected resolvedOpenUp(menu: AppMenuDispatchState<TId, TContext>): boolean {
    if (this.isMobileMenu(menu)) {
      return false;
    }
    if (menu.openUp) {
      return true;
    }
    const rect = menu.triggerRect;
    if (!rect) {
      return false;
    }
    const bounds = this.layoutBounds(menu);
    const spaceAbove = Math.max(0, rect.top - bounds.top - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
    const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
    const estimatedHeight = this.estimatedPanelHeight(menu);
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      return true;
    }
    return menu.openUp && spaceAbove >= Math.min(estimatedHeight, 140);
  }

  protected resolvedPanelAlign(menu: AppMenuDispatchState<TId, TContext>): AppMenuPanelAlign {
    if (menu.panelAlign !== 'auto' || this.isMobileMenu(menu)) {
      return menu.panelAlign === 'auto' ? 'end' : menu.panelAlign;
    }
    const rect = menu.triggerRect;
    if (!rect) {
      return 'end';
    }
    const bounds = this.layoutBounds(menu);
    const estimatedWidth = this.estimatedPanelWidth(menu);
    const spaceRight = Math.max(0, bounds.right - rect.left - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
    const spaceLeft = Math.max(0, rect.right - bounds.left - AppMenuOutletComponent.DESKTOP_MARGIN_PX);
    if (spaceRight >= estimatedWidth) {
      return 'start';
    }
    if (spaceLeft >= estimatedWidth) {
      return 'end';
    }
    return spaceRight >= spaceLeft ? 'start' : 'end';
  }

  protected dockPanelToHost(menu: AppMenuDispatchState<TId, TContext>): boolean {
    return !this.isBottomMenu(menu) && !this.isMobileMenu(menu);
  }

  protected resolvedItems(menu: AppMenuDispatchState<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return this.items ?? menu.items;
  }

  protected activeMenu(): AppMenuDispatchState<TId, TContext> | null {
    return this.menu ?? (this.dispatcher.activeMenu() as AppMenuDispatchState<TId, TContext> | null);
  }

  private isControlledMenu(menu: AppMenuDispatchState<TId, TContext>): boolean {
    return this.menu?.id === menu.id;
  }

  private shouldCloseOnItemSelect(
    event: AppMenuItemSelectEvent<string, unknown>,
    menu: AppMenuDispatchState<TId, TContext>
  ): boolean {
    if (event.action === 'remove') {
      return false;
    }
    return event.item.closeOnSelect ?? (menu.model?.layout === 'tabs' ? false : menu.closeOnSelect);
  }

  private isMobileMenu(menu: AppMenuDispatchState<TId, TContext>): boolean {
    if (this.isBottomMenu(menu)) {
      return false;
    }
    if (menu.panelMode === 'sheet') {
      return true;
    }
    if (menu.panelMode === 'anchored') {
      return false;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth <= Math.max(1, Number(menu.mobileBreakpointPx) || 760);
  }

  private isDockMenu(menu: AppMenuDispatchState<TId, TContext>): boolean {
    return menu.panelMode === 'dock';
  }

  private isFixedMenu(menu: AppMenuDispatchState<TId, TContext>): boolean {
    return menu.panelMode === 'fixed';
  }

  private isBottomMenu(menu: AppMenuDispatchState<TId, TContext>): boolean {
    return this.isDockMenu(menu) || this.isFixedMenu(menu);
  }

  private viewportWidth(): number {
    if (typeof window === 'undefined') {
      return AppMenuOutletComponent.DESKTOP_MIN_PANEL_WIDTH_PX + AppMenuOutletComponent.DESKTOP_MARGIN_PX * 2;
    }
    return window.innerWidth || document.documentElement.clientWidth;
  }

  private viewportHeight(): number {
    if (typeof window === 'undefined') {
      return 720;
    }
    return window.innerHeight || document.documentElement.clientHeight;
  }

  private layoutBounds(menu: AppMenuDispatchState<TId, TContext>): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const viewport = {
      left: 0,
      top: 0,
      right: this.viewportWidth(),
      bottom: this.viewportHeight()
    };
    if (typeof window === 'undefined') {
      return viewport;
    }
    const triggerElement = menu.triggerElement ?? this.hostRef.nativeElement;
    let parent = triggerElement.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      if (this.isMenuLayoutBoundary(parent, style)) {
        const rect = parent.getBoundingClientRect();
        return {
          left: Math.max(viewport.left, rect.left),
          top: Math.max(viewport.top, rect.top),
          right: Math.min(viewport.right, rect.right),
          bottom: Math.min(viewport.bottom, rect.bottom)
        };
      }
      parent = parent.parentElement;
    }
    return viewport;
  }

  private isMenuLayoutBoundary(element: HTMLElement, style: CSSStyleDeclaration): boolean {
    const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
    if (/(auto|scroll)/.test(overflow)) {
      return true;
    }
    const className = element.className.toString();
    if (/(popup-body|scroll-area|popup-panel|app-popup-panel)/.test(className)) {
      return true;
    }
    if (/(hidden|clip)/.test(overflow)) {
      return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    }
    return false;
  }

  private estimatedPanelWidth(menu: AppMenuDispatchState<TId, TContext>): number {
    const labels = this.visibleItems(menu)
      .map(item => `${this.resolveLiveValue(item.label) ?? this.resolveLiveValue(item.description) ?? ''}`.trim());
    const longestLabel = labels.reduce((longest, label) => Math.max(longest, label.length), 0);
    const textWidth = longestLabel * 7.5 + 86;
    return Math.min(448, Math.max(AppMenuOutletComponent.DESKTOP_MIN_PANEL_WIDTH_PX, textWidth));
  }

  private estimatedPanelHeight(menu: AppMenuDispatchState<TId, TContext>): number {
    const titleHeight = `${this.resolveLiveValue(menu.title) ?? ''}`.trim() ? 34 : 0;
    const itemCount = Math.max(1, this.visibleItems(menu).length);
    const branchHeaderHeight = this.visibleItems(menu).some(item => this.hasNestedItems(item)) ? 38 : 0;
    return Math.min(448, titleHeight + branchHeaderHeight + itemCount * 40 + 18);
  }

  private hasNestedItems(item: AppMenuItem<TId, TContext>): boolean {
    return (item.items?.length ?? 0) > 0 || appMenuModelGroups(item.model, item.groups ?? []).length > 0;
  }

  private visibleItems(menu: AppMenuDispatchState<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    const items = this.resolvedItems(menu);
    if (items.length > 0) {
      return items;
    }
    const fallbackItems: AppMenuItem<TId, TContext>[] = [];
    for (const group of appMenuModelGroups(menu.model, menu.groups)) {
      fallbackItems.push(...(group.items ?? []));
    }
    return fallbackItems;
  }

  private resolveLiveValue<T>(value: T | (() => T) | null | undefined): T | null | undefined {
    if (typeof value === 'function') {
      return (value as () => T)();
    }
    return value;
  }
}
