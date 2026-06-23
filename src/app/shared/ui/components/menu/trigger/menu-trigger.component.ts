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
  AppMenuLayout,
  AppMenuLiveValue,
  AppMenuModel,
  AppMenuPanelAlign,
  AppMenuPanelMode,
  AppMenuPalette,
  AppMenuTrigger,
  AppMenuTriggerLayout,
  AppMenuValueMap
} from '../menu.types';
import { appMenuModelSummary } from '../menu-summary';

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
        [class.app-menu__trigger--placeholder]="usesDefaultSelectTriggerLabel()"
        [class.app-menu__trigger--layout-field]="triggerLayout() === 'field'"
        [class.app-menu__trigger--layout-pill]="triggerLayout() === 'pill'"
        [class.app-menu__trigger--layout-icon]="triggerLayout() === 'icon'"
        [disabled]="triggerDisabled()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-haspopup]="triggerAriaHasPopup()"
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
        @if (triggerTrailingIcon()) {
          <mat-icon
            class="app-menu__trigger-caret"
            [class.app-menu__trigger-caret--static]="!triggerCaretRotates()"
            >
            {{ triggerTrailingIcon() }}
          </mat-icon>
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
  @Input() layout: AppMenuLayout = 'row';
  @Input() title: AppMenuLiveValue<string | null | undefined> = null;
  @Input() filterable = false;
  @Input() items: readonly AppMenuItem<TId, TContext>[] = [];
  @Input() model: AppMenuModel<TId, TContext> | null = null;
  @Input() groups: readonly AppMenuGroup<TId, TContext>[] = [];
  @Input() value: AppMenuValueMap<TId> | null = null;
  @Input() trigger: AppMenuTrigger | null = null;
  @Input() context: TContext | null = null;
  @Input() openUp = false;
  @Input() panelAlign: AppMenuPanelAlign | null = null;
  @Input() panelMode: AppMenuPanelMode | null = null;
  @Input() mobileBreakpointPx = 760;
  @Input() closeOnSelect = true;

  constructor() {
    this.syncMobileViewport();
  }

  @HostBinding('class.app-menu-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-menu-host--kind-inline')
  protected get hostInlineKindClass(): boolean {
    return this.kind === 'inline';
  }

  @HostBinding('class.app-menu-host--layout-row')
  protected get hostRowLayoutClass(): boolean {
    return this.kind === 'inline' && this.layout === 'row';
  }

  @HostBinding('class.app-menu-host--layout-grid')
  protected get hostGridLayoutClass(): boolean {
    return this.kind === 'inline' && this.layout === 'grid';
  }

  @HostBinding('class.app-menu-host--kind-fab')
  protected get hostFabKindClass(): boolean {
    return this.kind === 'fab';
  }

  @HostBinding('class.app-menu-host--kind-select')
  protected get hostSelectKindClass(): boolean {
    return this.kind === 'select';
  }

  @HostBinding('class.app-menu-host--model-layout-tabs')
  protected get hostTabbedModelLayoutClass(): boolean {
    return this.isTabbedModelLayout;
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
    return this.triggerLayout() === 'field';
  }

  @HostBinding('class.app-menu-host--trigger-pill')
  protected get hostTriggerPillClass(): boolean {
    return this.triggerLayout() === 'pill';
  }

  @HostBinding('class.app-menu-host--trigger-icon')
  protected get hostTriggerIconClass(): boolean {
    return this.triggerLayout() === 'icon';
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncMobileViewport();
  }

  protected get isSelectKind(): boolean {
    return this.kind === 'select';
  }

  protected get isFabKind(): boolean {
    return this.kind === 'fab';
  }

  protected get isTabbedModelLayout(): boolean {
    return this.model?.layout === 'tabs';
  }

  protected get isCustomTriggerAction(): boolean {
    return this.trigger?.action === 'custom';
  }

  protected isOpen(): boolean {
    return this.dispatcher.isOpen(this.resolvedMenuId());
  }

  protected triggerLabel(): string {
    const configuredLabel = `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
    return configuredLabel || appMenuModelSummary(this.model, this.groups).label || this.defaultSelectTriggerLabel();
  }

  protected usesDefaultSelectTriggerLabel(): boolean {
    const configuredLabel = `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
    const summaryLabel = appMenuModelSummary(this.model, this.groups).label;
    return !configuredLabel && !summaryLabel && Boolean(this.defaultSelectTriggerLabel());
  }

  protected triggerIcon(): string {
    if (this.isOpen()) {
      const configuredOpenIcon = this.resolveLiveValue(this.trigger?.closeIcon ?? this.trigger?.openIcon);
      if (configuredOpenIcon !== null && configuredOpenIcon !== undefined) {
        return `${configuredOpenIcon}`.trim();
      }
      const baseIcon = `${this.resolveLiveValue(this.trigger?.icon) ?? ''}`.trim();
      if (this.shouldResolveTriggerIconToClose(baseIcon)) {
        return 'close';
      }
      if (!baseIcon && this.isSelectLikeTrigger()) {
        return '';
      }
      return `${baseIcon || 'close'}`.trim();
    }
    const configuredIcon = this.resolveLiveValue(this.trigger?.icon);
    if (!configuredIcon && this.isFabKind) {
      return 'add';
    }
    if (!configuredIcon && this.isSelectLikeTrigger()) {
      return '';
    }
    return `${configuredIcon ?? 'more_vert'}`.trim();
  }

  private shouldResolveTriggerIconToClose(icon: string): boolean {
    if (this.triggerLayout() !== 'icon' && this.trigger?.hideLabel !== true) {
      return false;
    }
    switch (icon) {
      case 'add':
      case 'add_box':
      case 'add_circle':
      case 'more_horiz':
      case 'more_vert':
        return true;
      default:
        return false;
    }
  }

  protected triggerTrailingIcon(): string {
    const configuredIcon = this.resolveLiveValue(this.isOpen()
      ? this.trigger?.closeTrailingIcon ?? this.trigger?.openTrailingIcon ?? this.trigger?.trailingIcon
      : this.trigger?.trailingIcon);
    if (configuredIcon !== null && configuredIcon !== undefined) {
      return `${configuredIcon}`.trim();
    }
    if (this.trigger?.hideLabel === true) {
      return '';
    }
    if (this.isSelectKind && this.triggerLayout() !== 'icon') {
      return 'expand_more';
    }
    if (this.isTabbedModelLayout && this.triggerLayout() !== 'icon') {
      return 'expand_more';
    }
    return '';
  }

  protected triggerCaretRotates(): boolean {
    return !this.isCustomTriggerAction && this.isSelectLikeTrigger();
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

  protected triggerAriaHasPopup(): string | null {
    return this.isCustomTriggerAction ? 'dialog' : 'menu';
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

  protected triggerLayout(): AppMenuTriggerLayout {
    if (this.trigger?.layout) {
      return this.trigger.layout;
    }
    if (this.isFabKind) {
      return 'icon';
    }
    return this.isSelectLikeTrigger() ? 'pill' : 'default';
  }

  protected hasTriggerCounter(): boolean {
    return this.counterVisible(this.triggerCounter());
  }

  protected triggerCounterLabel(): string {
    return this.counterLabel(this.triggerCounter());
  }

  private isSelectLikeTrigger(): boolean {
    return this.isSelectKind || this.isTabbedModelLayout;
  }

  private defaultSelectTriggerLabel(): string {
    return this.isSelectLikeTrigger() && this.triggerLayout() !== 'icon' && this.trigger?.hideLabel !== true
      ? 'select.option'
      : '';
  }

  private triggerCounter(): AppMenuCounter | AppMenuCounterValue | null {
    const configuredCounter = this.trigger?.counter;
    if (configuredCounter !== null && configuredCounter !== undefined) {
      return configuredCounter;
    }
    return appMenuModelSummary(this.model, this.groups).counter;
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
      layout: this.layout,
      title: this.title,
      filterable: this.filterable,
      items: this.items,
      model: this.model,
      groups: this.groups,
      value: this.value,
      trigger: this.trigger,
      context: this.context ?? undefined,
      openUp: this.openUp,
      panelAlign: this.panelAlign ?? undefined,
      panelMode: this.panelMode ?? undefined,
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
