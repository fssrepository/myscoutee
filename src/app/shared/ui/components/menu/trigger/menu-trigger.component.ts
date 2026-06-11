import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  HostListener,
  Input,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../../pipes';
import { AppMenuDispatcher } from '../menu-dispatcher.service';
import type {
  AppMenuCounter,
  AppMenuCounterValue,
  AppMenuDispatchConfig,
  AppMenuGroup,
  AppMenuItem,
  AppMenuKind,
  AppMenuLiveValue,
  AppMenuModel,
  AppMenuPanelAlign,
  AppMenuPalette,
  AppMenuTrigger,
  AppMenuTriggerShape,
  AppMenuValueMap
} from '../menu.types';

@Component({
  selector: 'app-menu-trigger',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe],
  template: `
    <div class="app-menu" [class.app-menu--open]="isOpen()">
      <button
        type="button"
        class="app-menu__trigger"
        [ngClass]="triggerPaletteClass()"
        [class.app-menu__trigger--open]="isOpen()"
        [class.app-menu__trigger--label-hidden]="trigger?.hideLabel"
        [class.app-menu__trigger--shape-field]="triggerShape() === 'field'"
        [class.app-menu__trigger--shape-pill]="triggerShape() === 'pill'"
        [class.app-menu__trigger--shape-icon]="triggerShape() === 'icon'"
        [disabled]="triggerDisabled()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="menu"
        [attr.aria-label]="triggerAriaLabel()"
        (pointerdown)="onTriggerPointerDown($event)"
        (click)="toggleMenu($event)"
        >
        @if (triggerIcon()) {
          <mat-icon>{{ triggerIcon() }}</mat-icon>
        }
        @if (!trigger?.hideLabel && triggerLabel()) {
          <span class="app-menu__trigger-label">{{ triggerLabel() | i18n }}</span>
        }
        @if (isSelectKind && triggerShape() !== 'icon') {
          <mat-icon class="app-menu__trigger-caret">expand_more</mat-icon>
        }
        @if (hasTriggerCounter()) {
          <span class="app-menu__counter app-menu__counter--trigger">
            {{ triggerCounterLabel() }}
          </span>
        }
      </button>
    </div>
  `,
  styleUrl: '../menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMenuTriggerComponent<TId extends string = string, TContext = unknown> {
  private static nextGeneratedId = 0;

  private readonly dispatcher = inject(AppMenuDispatcher);
  private readonly generatedId = `app-menu-trigger-${++AppMenuTriggerComponent.nextGeneratedId}`;
  protected isMobileViewport = false;

  @Input() menuId = '';
  @Input() kind: AppMenuKind = 'select';
  @Input() title: AppMenuLiveValue<string | null | undefined> = null;
  @Input() items: readonly AppMenuItem<TId, TContext>[] = [];
  @Input() model: AppMenuModel<TId, TContext> | null = null;
  @Input() groups: readonly AppMenuGroup<TId, TContext>[] = [];
  @Input() value: AppMenuValueMap<TId> | null = null;
  @Input() trigger: AppMenuTrigger | null = null;
  @Input() context: TContext | null = null;
  @Input() openUp = false;
  @Input() panelAlign: AppMenuPanelAlign | null = null;
  @Input() mobileBreakpointPx = 760;
  @Input() closeOnSelect = true;

  constructor() {
    this.syncMobileViewport();
  }

  @HostBinding('class.app-menu-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-menu-host--kind-button-row')
  protected get hostButtonRowKindClass(): boolean {
    return this.kind === 'button-row';
  }

  @HostBinding('class.app-menu-host--kind-select')
  protected get hostSelectKindClass(): boolean {
    return this.kind === 'select';
  }

  @HostBinding('class.app-menu-host--kind-shortcut-grid')
  protected get hostShortcutGridKindClass(): boolean {
    return this.kind === 'shortcut-grid';
  }

  @HostBinding('class.app-menu-host--layout-desktop')
  protected get hostDesktopLayoutClass(): boolean {
    return !this.isMobileViewport;
  }

  @HostBinding('class.app-menu-host--layout-mobile')
  protected get hostMobileLayoutClass(): boolean {
    return this.isMobileViewport;
  }

  @HostBinding('class.app-menu-host--open')
  protected get hostOpenClass(): boolean {
    return this.isOpen();
  }

  @HostBinding('class.app-menu-host--trigger-field')
  protected get hostTriggerFieldClass(): boolean {
    return this.triggerShape() === 'field';
  }

  @HostBinding('class.app-menu-host--trigger-pill')
  protected get hostTriggerPillClass(): boolean {
    return this.triggerShape() === 'pill';
  }

  @HostBinding('class.app-menu-host--trigger-icon')
  protected get hostTriggerIconClass(): boolean {
    return this.triggerShape() === 'icon';
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncMobileViewport();
  }

  protected get isSelectKind(): boolean {
    return this.kind === 'select';
  }

  protected isOpen(): boolean {
    return this.dispatcher.isOpen(this.resolvedMenuId());
  }

  protected triggerLabel(): string {
    return `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
  }

  protected triggerIcon(): string {
    const configuredIcon = this.resolveLiveValue(this.isOpen()
      ? this.trigger?.closeIcon ?? this.trigger?.openIcon ?? this.trigger?.icon
      : this.trigger?.icon);
    if (!configuredIcon && this.isSelectKind) {
      return '';
    }
    return `${configuredIcon ?? (this.isOpen() ? 'close' : 'more_vert')}`.trim();
  }

  protected triggerAriaLabel(): string {
    const configured = `${this.resolveLiveValue(this.trigger?.ariaLabel) ?? ''}`.trim();
    if (configured) {
      return configured;
    }
    const label = this.triggerLabel();
    if (label) {
      return this.isOpen() ? `Close ${label}` : `Open ${label}`;
    }
    return this.isOpen() ? 'Close menu' : 'Open menu';
  }

  protected triggerDisabled(): boolean {
    return this.resolveBoolean(this.trigger?.disabled);
  }

  protected triggerPalette(): AppMenuPalette {
    return this.trigger?.palette ?? 'default';
  }

  protected triggerPaletteClass(): string {
    return `app-menu__palette--${this.triggerPalette()}`;
  }

  protected triggerShape(): AppMenuTriggerShape {
    if (this.trigger?.shape) {
      return this.trigger.shape;
    }
    return this.isSelectKind ? 'field' : 'default';
  }

  protected hasTriggerCounter(): boolean {
    return this.counterVisible(this.trigger?.counter ?? null);
  }

  protected triggerCounterLabel(): string {
    return this.counterLabel(this.trigger?.counter ?? null);
  }

  protected onTriggerPointerDown(event: Event): void {
    event.stopPropagation();
  }

  protected toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.triggerDisabled()) {
      return;
    }
    const wasOpen = this.isOpen();
    this.dispatcher.toggle(this.dispatchConfig(), event.currentTarget as HTMLElement | null);
    if (!wasOpen) {
      this.refreshDispatchedRectAfterRender();
    }
  }

  private refreshDispatchedRectAfterRender(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.requestAnimationFrame(() => this.dispatcher.refreshActiveRect());
  }

  private dispatchConfig(): AppMenuDispatchConfig<TId, TContext> {
    return {
      id: this.resolvedMenuId(),
      kind: this.kind,
      title: this.title,
      items: this.items,
      model: this.model,
      groups: this.groups,
      value: this.value,
      trigger: this.trigger,
      context: this.context ?? undefined,
      openUp: this.openUp,
      panelAlign: this.panelAlign ?? undefined,
      mobileBreakpointPx: this.mobileBreakpointPx,
      closeOnSelect: this.closeOnSelect
    };
  }

  private resolvedMenuId(): string {
    return this.menuId || this.generatedId;
  }

  private syncMobileViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileViewport = false;
      return;
    }
    this.isMobileViewport = window.innerWidth <= Math.max(1, Number(this.mobileBreakpointPx) || 760);
  }

  private resolveBoolean(value: AppMenuLiveValue<boolean | null | undefined> | null | undefined): boolean {
    return this.resolveLiveValue(value) === true;
  }

  private resolveLiveValue<T>(value: AppMenuLiveValue<T> | null | undefined): T | null | undefined {
    if (typeof value === 'function') {
      return (value as () => T)();
    }
    return value;
  }

  private counterConfig(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): AppMenuCounter | null {
    if (counter === null || counter === undefined) {
      return null;
    }
    if (typeof counter === 'object' && 'value' in counter) {
      return counter;
    }
    return { value: counter };
  }

  private counterVisible(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): boolean {
    const value = this.resolveCounterValue(counter);
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }
    return `${value ?? ''}`.trim().length > 0;
  }

  private counterLabel(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): string {
    const config = this.counterConfig(counter);
    const value = this.resolveCounterValue(counter);
    if (typeof value === 'number') {
      const max = Math.max(1, Math.trunc(Number(config?.max) || 99));
      return value > max ? `${max}+` : `${Math.trunc(value)}`;
    }
    return `${value ?? ''}`.trim();
  }

  private resolveCounterValue(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): number | string | null | undefined {
    const config = this.counterConfig(counter);
    return this.resolveLiveValue(config?.value ?? null);
  }
}
