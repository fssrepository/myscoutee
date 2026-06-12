import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../pipes';
import type {
  AppMenuBranch,
  AppMenuCounter,
  AppMenuCounterValue,
  AppMenuGroup,
  AppMenuItemLayout,
  AppMenuItemSurface,
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuKind,
  AppMenuLiveValue,
  AppMenuModel,
  AppMenuPanelAlign,
  AppMenuPalette,
  AppMenuSegment,
  AppMenuTrigger,
  AppMenuTriggerShape,
  AppMenuValueMap
} from './menu.types';

type AppMenuResolvedLayout = 'desktop' | 'mobile';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMenuComponent<TId extends string = string, TContext = unknown> implements DoCheck, OnDestroy {
  private static readonly COUNTER_PULSE_DURATION_MS = 1600;
  private static readonly DESKTOP_MARGIN_PX = 8;
  private static readonly DESKTOP_MIN_PANEL_WIDTH_PX = 196;

  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  @Input() kind: AppMenuKind = 'button-row';
  @Input() title: AppMenuLiveValue<string | null | undefined> = null;
  @Input() items: readonly AppMenuItem<TId, TContext>[] = [];
  @Input() model: AppMenuModel<TId, TContext> | null = null;
  @Input() groups: readonly AppMenuGroup<TId, TContext>[] = [];
  @Input() value: AppMenuValueMap<TId> | null = null;
  @Input() trigger: AppMenuTrigger | null = null;
  @Input() openUp = false;
  @Input() panelAlign: AppMenuPanelAlign = 'auto';
  @Input() panelGapPx: number | null = null;
  @Input() panelDockToHost = false;
  @Input() mobileBreakpointPx = 760;
  @Input() closeOnSelect = true;

  @Output() readonly openChange = new EventEmitter<boolean>();
  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent<TId, TContext>>();

  private internalOpen = false;
  private activeBranchPath: AppMenuItem<TId, TContext>[] = [];
  private readonly counterValueByKey = new Map<string, string>();
  private readonly counterPulseTimerByKey = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pulsingCounterKeys = new Set<string>();
  protected isMobileViewport = false;

  @Input()
  get open(): boolean {
    return this.internalOpen;
  }

  set open(value: boolean | null | undefined) {
    this.internalOpen = value === true;
    if (!this.internalOpen) {
      this.activeBranchPath = [];
    }
  }

  constructor() {
    this.syncMobileViewport();
  }

  ngDoCheck(): void {
    this.syncCounterPulseState();
  }

  ngOnDestroy(): void {
    for (const timerId of this.counterPulseTimerByKey.values()) {
      clearTimeout(timerId);
    }
    this.counterPulseTimerByKey.clear();
  }

  @HostBinding('class.app-menu-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-menu-host--kind-button-row')
  protected get hostButtonRowKindClass(): boolean {
    return this.isButtonRowKind;
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
    return this.resolvedLayout === 'desktop';
  }

  @HostBinding('class.app-menu-host--layout-mobile')
  protected get hostMobileLayoutClass(): boolean {
    return this.resolvedLayout === 'mobile';
  }

  @HostBinding('class.app-menu-host--open')
  protected get hostOpenClass(): boolean {
    return this.panelVisible;
  }

  @HostBinding('class.app-menu-host--panel-docked')
  protected get hostPanelDockedClass(): boolean {
    return this.panelDockToHost;
  }

  @HostBinding('style.--app-menu-panel-gap')
  protected get hostPanelGapStyle(): string | null {
    if (this.panelGapPx === null || this.panelGapPx === undefined) {
      return null;
    }
    return `${Math.max(0, Number(this.panelGapPx) || 0)}px`;
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

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (!this.open) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.setOpen(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open || this.isInlineKind || (this.resolvedLayout === 'mobile' && !this.isAnchoredOverlayKind)) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostRef.nativeElement.contains(target)) {
      return;
    }
    this.setOpen(false);
  }

  protected get resolvedLayout(): AppMenuResolvedLayout {
    return this.isMobileViewport ? 'mobile' : 'desktop';
  }

  protected get isInlineKind(): boolean {
    return this.kind === 'shortcut-grid';
  }

  protected get isButtonRowKind(): boolean {
    return this.kind === 'button-row';
  }

  protected get isShortcutGridKind(): boolean {
    return this.kind === 'shortcut-grid';
  }

  protected get isSelectKind(): boolean {
    return this.kind === 'select';
  }

  protected get isDropdownListKind(): boolean {
    return this.isSelectKind;
  }

  protected get isAnchoredOverlayKind(): boolean {
    return this.isDropdownListKind || this.isButtonRowKind;
  }

  protected get isCustomTriggerAction(): boolean {
    return this.trigger?.action === 'custom';
  }

  protected get panelVisible(): boolean {
    if (this.isCustomTriggerAction) {
      return false;
    }
    return this.isInlineKind || this.open;
  }

  protected get showMobileBackdrop(): boolean {
    return this.open && !this.isInlineKind && !this.isAnchoredOverlayKind && this.resolvedLayout === 'mobile';
  }

  protected get resolvedOpenUp(): boolean {
    if (this.resolvedLayout === 'mobile' || !this.panelVisible || this.isInlineKind) {
      return this.openUp;
    }
    if (this.openUp) {
      return true;
    }
    const rect = this.hostRect();
    if (!rect) {
      return false;
    }
    const bounds = this.layoutBounds();
    const spaceAbove = Math.max(0, rect.top - bounds.top - AppMenuComponent.DESKTOP_MARGIN_PX);
    const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - AppMenuComponent.DESKTOP_MARGIN_PX);
    const estimatedHeight = this.estimatedPanelHeight();
    return spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  }

  protected get resolvedPanelAlign(): 'start' | 'end' {
    if (this.panelAlign !== 'auto' || this.resolvedLayout === 'mobile' || !this.panelVisible || this.isInlineKind) {
      return this.panelAlign === 'start' ? 'start' : 'end';
    }
    const rect = this.hostRect();
    if (!rect) {
      return 'end';
    }
    const bounds = this.layoutBounds();
    const estimatedWidth = this.estimatedPanelWidth();
    const spaceRight = Math.max(0, bounds.right - rect.left - AppMenuComponent.DESKTOP_MARGIN_PX);
    const spaceLeft = Math.max(0, rect.right - bounds.left - AppMenuComponent.DESKTOP_MARGIN_PX);
    if (spaceRight >= estimatedWidth) {
      return 'start';
    }
    if (spaceLeft >= estimatedWidth) {
      return 'end';
    }
    return spaceRight >= spaceLeft ? 'start' : 'end';
  }

  protected get menuNodes(): readonly AppMenuBranch<TId, TContext>[] {
    return this.model?.nodes ?? this.groups;
  }

  protected get hasMenuNodes(): boolean {
    return this.menuNodes.length > 0;
  }

  protected get actionRowItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.items.length > 0) {
      return this.items;
    }
    const items: AppMenuItem<TId, TContext>[] = [];
    for (const node of this.menuNodes) {
      items.push(...this.branchChildren(node));
    }
    return items;
  }

  protected get hasTrigger(): boolean {
    return this.trigger !== null;
  }

  protected get activeBranch(): AppMenuItem<TId, TContext> | null {
    return this.activeBranchPath[this.activeBranchPath.length - 1] ?? null;
  }

  protected get visibleListItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.activeBranch) {
      return this.activeBranch.children ?? [];
    }
    if (this.items.length > 0) {
      return this.items;
    }
    return this.groupedDropdownItems();
  }

  protected get showBranchBack(): boolean {
    if (!this.activeBranch) {
      return false;
    }
    return this.isButtonRowKind ? this.activeBranchPath.length > 1 : true;
  }

  protected get resolvedTitle(): string {
    return `${this.resolveLiveValue(this.title) ?? ''}`.trim();
  }

  protected triggerLabel(): string {
    return `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
  }

  protected triggerIcon(): string {
    if (this.open) {
      const configuredOpenIcon = this.resolveLiveValue(this.trigger?.closeIcon ?? this.trigger?.openIcon);
      if (configuredOpenIcon !== null && configuredOpenIcon !== undefined) {
        return `${configuredOpenIcon}`.trim();
      }
      const baseIcon = `${this.resolveLiveValue(this.trigger?.icon) ?? ''}`.trim();
      if (this.shouldResolveTriggerIconToClose(baseIcon)) {
        return 'close';
      }
      if (!baseIcon && this.isSelectKind) {
        return '';
      }
      return `${baseIcon || 'close'}`.trim();
    }
    const configuredIcon = this.resolveLiveValue(this.trigger?.icon);
    if (!configuredIcon && this.isSelectKind) {
      return '';
    }
    return `${configuredIcon ?? 'more_vert'}`.trim();
  }

  private shouldResolveTriggerIconToClose(icon: string): boolean {
    if (this.triggerShape() !== 'icon' && this.trigger?.hideLabel !== true) {
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
    const configuredIcon = this.resolveLiveValue(this.open
      ? this.trigger?.closeTrailingIcon ?? this.trigger?.openTrailingIcon ?? this.trigger?.trailingIcon
      : this.trigger?.trailingIcon);
    if (configuredIcon !== null && configuredIcon !== undefined) {
      return `${configuredIcon}`.trim();
    }
    if (this.trigger?.hideLabel === true) {
      return '';
    }
    if (this.isSelectKind && this.triggerShape() !== 'icon') {
      return 'expand_more';
    }
    return '';
  }

  protected triggerCaretRotates(): boolean {
    return !this.isCustomTriggerAction && this.isSelectKind;
  }

  protected triggerAriaLabel(): string {
    const configured = `${this.resolveLiveValue(this.trigger?.ariaLabel) ?? ''}`.trim();
    if (configured) {
      return configured;
    }
    const label = this.triggerLabel();
    if (label) {
      return this.open ? `Close ${label}` : `Open ${label}`;
    }
    return this.open ? 'Close menu' : 'Open menu';
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
    return this.paletteClass(this.triggerPalette());
  }

  protected triggerShape(): AppMenuTriggerShape {
    if (this.trigger?.shape) {
      return this.trigger.shape;
    }
    if (!this.hasTrigger) {
      return 'default';
    }
    return this.isSelectKind ? 'pill' : 'default';
  }

  protected hasTriggerCounter(): boolean {
    return this.counterVisible(this.trigger?.counter ?? null);
  }

  protected triggerCounterLabel(): string {
    return this.counterLabel(this.trigger?.counter ?? null);
  }

  protected triggerCounterKey(): string {
    return 'trigger';
  }

  protected toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.triggerDisabled()) {
      return;
    }
    if (this.isCustomTriggerAction) {
      const item: AppMenuItem<TId, TContext> = {
        id: `${this.trigger?.id ?? 'trigger'}` as TId,
        label: this.trigger?.label,
        icon: this.trigger?.icon,
        kind: 'action',
        palette: this.trigger?.palette,
        context: this.trigger?.context as TContext
      };
      this.itemSelect.emit({
        id: item.id,
        item,
        context: item.context,
        sourceEvent: event
      });
      return;
    }
    this.setOpen(!this.open);
  }

  protected closeFromBackdrop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.setOpen(false);
  }

  protected selectActionRowItem(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item)) {
      return;
    }
    if (this.hasItemChildren(item)) {
      if (this.open && this.activeBranchPath[0]?.id === item.id) {
        this.setOpen(false);
        return;
      }
      this.activeBranchPath = [item];
      this.setOpen(true);
      return;
    }
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event
    });
    this.setOpen(false);
  }

  protected selectBranchHeaderAction(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item)) {
      return;
    }
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event
    });
    if (item.closeOnSelect ?? this.closeOnSelect) {
      this.setOpen(false);
    }
  }

  protected selectItem(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item)) {
      return;
    }
    if (this.shouldOpenItemBranch(item)) {
      this.activeBranchPath = [...this.activeBranchPath, item];
      return;
    }
    const selectEvent: AppMenuItemSelectEvent<TId, TContext> = {
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event
    };
    this.itemSelect.emit(selectEvent);
    if (item.closeOnSelect ?? this.closeOnSelect) {
      this.setOpen(false);
    }
  }

  protected selectLinkItem(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item) || this.shouldOpenItemBranch(item)) {
      event.preventDefault();
      return;
    }
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event
    });
    if (item.closeOnSelect ?? this.closeOnSelect) {
      this.setOpen(false);
    }
  }

  protected closeActiveBranch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeBranchPath = this.activeBranchPath.slice(0, -1);
  }

  protected isActionRowItemOpen(item: AppMenuItem<TId, TContext>): boolean {
    return this.open && this.activeBranchPath[0]?.id === item.id;
  }

  protected isSelectTriggerItem(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'select-trigger';
  }

  protected isLabeledActionRowItem(item: AppMenuItem<TId, TContext>): boolean {
    return this.isSelectTriggerItem(item);
  }

  protected actionRowItemIcon(item: AppMenuItem<TId, TContext>): string {
    if (this.isActionRowItemOpen(item)) {
      const openIcon = `${this.resolveLiveValue(item.closeIcon ?? item.openIcon) ?? ''}`.trim();
      if (openIcon) {
        return openIcon;
      }
      if (!this.isLabeledActionRowItem(item) && this.hasItemChildren(item)) {
        return 'close';
      }
    }
    return this.itemIcon(item);
  }

  protected actionRowItemLabel(item: AppMenuItem<TId, TContext>): string {
    return this.itemLabel(item);
  }

  protected actionRowItemAriaLabel(item: AppMenuItem<TId, TContext>): string | null {
    return this.itemAriaLabel(item) ?? (this.actionRowItemLabel(item) || null);
  }

  protected branchHeaderActions(item: AppMenuItem<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return item.headerActions ?? [];
  }

  protected itemHeaderActions(item: AppMenuItem<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return item.headerActions ?? [];
  }

  protected itemRole(item: AppMenuItem<TId, TContext>): string {
    switch (item.kind ?? 'action') {
      case 'radio':
        return 'menuitemradio';
      case 'checkbox':
      case 'toggle':
        return 'menuitemcheckbox';
      default:
        return 'menuitem';
    }
  }

  protected branchPalette(branch: AppMenuBranch<TId, TContext>): AppMenuPalette {
    return branch.palette ?? 'default';
  }

  protected branchPaletteClass(branch: AppMenuBranch<TId, TContext>): string {
    return this.paletteClass(this.branchPalette(branch));
  }

  protected branchLabel(branch: AppMenuBranch<TId, TContext>): string {
    return `${this.resolveLiveValue(branch.label) ?? ''}`.trim();
  }

  protected branchIcon(branch: AppMenuBranch<TId, TContext>): string {
    return `${this.resolveLiveValue(branch.icon) ?? ''}`.trim();
  }

  protected branchAriaLabel(branch: AppMenuBranch<TId, TContext>): string | null {
    const ariaLabel = `${this.resolveLiveValue(branch.ariaLabel) ?? this.branchLabel(branch)}`.trim();
    return ariaLabel || null;
  }

  protected branchChildren(branch: AppMenuBranch<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return branch.children ?? branch.items ?? [];
  }

  private groupedDropdownItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.isShortcutGridKind || !this.hasMenuNodes) {
      return [];
    }
    const items: AppMenuItem<TId, TContext>[] = [];
    for (const branch of this.menuNodes) {
      const children = this.branchChildren(branch);
      if (children.length === 0) {
        continue;
      }
      if (items.length > 0) {
        items.push({
          id: `${branch.id}__divider` as TId,
          kind: 'divider'
        });
      }
      if (this.branchLabel(branch) || this.branchIcon(branch)) {
        items.push({
          id: `${branch.id}__section` as TId,
          kind: 'section',
          label: branch.label,
          icon: branch.icon,
          palette: branch.palette,
          headerActions: branch.headerActions,
          ariaLabel: branch.ariaLabel
        });
      }
      items.push(...children);
    }
    return items;
  }

  protected itemPalette(item: AppMenuItem<TId, TContext>): AppMenuPalette {
    return item.palette ?? 'default';
  }

  protected itemPaletteClass(item: AppMenuItem<TId, TContext>): string {
    return this.paletteClass(this.itemPalette(item));
  }

  protected itemSurface(item: AppMenuItem<TId, TContext>): AppMenuItemSurface {
    return item.surface ?? 'plain';
  }

  protected itemLayout(item: AppMenuItem<TId, TContext>): AppMenuItemLayout {
    return item.layout ?? 'default';
  }

  protected itemLabel(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.label) ?? ''}`.trim();
  }

  protected itemDescription(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.description) ?? ''}`.trim();
  }

  protected itemDetail(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.detail) ?? ''}`.trim();
  }

  protected itemIcon(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.icon) ?? ''}`.trim();
  }

  protected itemGridColumn(item: AppMenuItem<TId, TContext>): string | null {
    const span = Math.max(1, Math.min(5, Math.trunc(Number(this.resolveLiveValue(item.span)) || 1)));
    return span > 1 ? `span ${span}` : null;
  }

  protected itemAriaLabel(item: AppMenuItem<TId, TContext>): string | null {
    const ariaLabel = `${this.resolveLiveValue(item.ariaLabel) ?? ''}`.trim();
    return ariaLabel || null;
  }

  protected isItemActive(item: AppMenuItem<TId, TContext>): boolean {
    return this.resolveBoolean(item.active) || this.resolveBoolean(item.checked);
  }

  protected showItemCheck(item: AppMenuItem<TId, TContext>): boolean {
    if ((this.isDropdownListKind || this.isButtonRowKind) && item.kind === 'radio') {
      return false;
    }
    return this.isItemActive(item) && !this.hasItemChildren(item);
  }

  protected isItemChecked(item: AppMenuItem<TId, TContext>): boolean | null {
    if ((item.kind ?? 'action') !== 'radio' && item.kind !== 'checkbox' && item.kind !== 'toggle') {
      return null;
    }
    return this.isItemActive(item);
  }

  protected isToggleItem(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'toggle';
  }

  protected isItemDisabled(item: AppMenuItem<TId, TContext>): boolean {
    return this.resolveBoolean(item.disabled);
  }

  protected isPassiveItem(item: AppMenuItem<TId, TContext>): boolean {
    const kind = item.kind ?? 'action';
    return kind === 'divider' || kind === 'section';
  }

  protected isDivider(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'divider';
  }

  protected isSection(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'section';
  }

  protected isBranch(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'branch';
  }

  protected hasItemChildren(item: AppMenuItem<TId, TContext>): boolean {
    return (item.children?.length ?? 0) > 0;
  }

  protected shouldOpenItemBranch(item: AppMenuItem<TId, TContext>): boolean {
    return (this.isDropdownListKind || this.isButtonRowKind) && this.hasItemChildren(item);
  }

  protected itemHref(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.href) ?? ''}`.trim();
  }

  protected itemTarget(item: AppMenuItem<TId, TContext>): string | null {
    const target = `${this.resolveLiveValue(item.target) ?? ''}`.trim();
    return target || null;
  }

  protected itemRel(item: AppMenuItem<TId, TContext>): string | null {
    const rel = `${this.resolveLiveValue(item.rel) ?? ''}`.trim();
    return rel || null;
  }

  protected hasItemSegments(item: AppMenuItem<TId, TContext>): boolean {
    return (item.segments?.length ?? 0) > 0;
  }

  protected itemSegments(item: AppMenuItem<TId, TContext>): readonly AppMenuSegment[] {
    return item.segments ?? [];
  }

  protected segmentPaletteClass(segment: AppMenuSegment): string {
    return this.paletteClass(segment.palette ?? 'default');
  }

  protected segmentLabel(segment: AppMenuSegment): string {
    return `${this.resolveLiveValue(segment.label) ?? ''}`.trim();
  }

  protected segmentDescription(segment: AppMenuSegment): string {
    return `${this.resolveLiveValue(segment.description) ?? ''}`.trim();
  }

  protected segmentIcon(segment: AppMenuSegment): string {
    return `${this.resolveLiveValue(segment.icon) ?? ''}`.trim();
  }

  protected hasItemCounter(item: AppMenuItem<TId, TContext>): boolean {
    return this.counterVisible(this.itemCounter(item));
  }

  protected itemCounterLabel(item: AppMenuItem<TId, TContext>): string {
    return this.counterLabel(this.itemCounter(item));
  }

  protected itemCounterKey(item: AppMenuItem<TId, TContext>, branch?: AppMenuBranch<TId, TContext>): string {
    const itemKey = `${item.kind ?? 'action'}:${item.id}`;
    return branch ? `node:${branch.id}:${itemKey}` : `item:${itemKey}`;
  }

  protected isCounterPulsing(key: string): boolean {
    return this.pulsingCounterKeys.has(key);
  }

  protected trackByItemId(index: number, item: AppMenuItem<TId, TContext>): string {
    return `${item.kind ?? 'action'}:${item.id || index}`;
  }

  protected trackByBranchId(index: number, branch: AppMenuBranch<TId, TContext>): string {
    return `${branch.id || index}`;
  }

  protected trackBySegmentId(index: number, segment: AppMenuSegment): string {
    return `${segment.id || index}`;
  }

  private setOpen(open: boolean): void {
    if (this.internalOpen === open) {
      return;
    }
    this.internalOpen = open;
    if (!open) {
      this.activeBranchPath = [];
    }
    this.openChange.emit(open);
  }

  private syncMobileViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileViewport = false;
      return;
    }
    this.isMobileViewport = window.innerWidth <= Math.max(1, Number(this.mobileBreakpointPx) || 760);
  }

  private hostRect(): DOMRect | null {
    if (typeof window === 'undefined' || typeof this.hostRef.nativeElement.getBoundingClientRect !== 'function') {
      return null;
    }
    return this.hostRef.nativeElement.getBoundingClientRect();
  }

  private layoutBounds(): { left: number; top: number; right: number; bottom: number } {
    const viewport = {
      left: 0,
      top: 0,
      right: this.viewportWidth(),
      bottom: this.viewportHeight()
    };
    if (typeof window === 'undefined') {
      return viewport;
    }
    let parent = this.hostRef.nativeElement.parentElement;
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

  private viewportWidth(): number {
    if (typeof window === 'undefined') {
      return AppMenuComponent.DESKTOP_MIN_PANEL_WIDTH_PX + AppMenuComponent.DESKTOP_MARGIN_PX * 2;
    }
    return window.innerWidth || document.documentElement.clientWidth;
  }

  private viewportHeight(): number {
    if (typeof window === 'undefined') {
      return 720;
    }
    return window.innerHeight || document.documentElement.clientHeight;
  }

  private estimatedPanelWidth(): number {
    const labels = this.visibleListItems
      .map(item => `${this.resolveLiveValue(item.label) ?? this.resolveLiveValue(item.description) ?? ''}`.trim());
    const longestLabel = labels.reduce((longest, label) => Math.max(longest, label.length), 0);
    const textWidth = longestLabel * 7.5 + 86;
    return Math.min(448, Math.max(AppMenuComponent.DESKTOP_MIN_PANEL_WIDTH_PX, textWidth));
  }

  private estimatedPanelHeight(): number {
    const titleHeight = this.resolvedTitle ? 34 : 0;
    const itemCount = Math.max(1, this.visibleListItems.length);
    const branchHeaderHeight = this.visibleListItems.some(item => (item.children?.length ?? 0) > 0) ? 38 : 0;
    return Math.min(448, titleHeight + branchHeaderHeight + itemCount * 40 + 18);
  }

  private syncCounterPulseState(): void {
    const visibleCounterKeys = new Set<string>();
    this.observeCounterPulse(
      this.triggerCounterKey(),
      this.trigger?.counter ?? null,
      this.isLiveCounter(this.trigger?.counter ?? null),
      visibleCounterKeys
    );
    for (const item of this.items) {
      this.observeItemCounterPulse(item, visibleCounterKeys);
    }
    for (const branch of this.menuNodes) {
      for (const action of branch.headerActions ?? []) {
        this.observeItemCounterPulse(action, visibleCounterKeys, branch);
      }
      for (const item of this.branchChildren(branch)) {
        this.observeItemCounterPulse(item, visibleCounterKeys, branch);
      }
    }
    for (const key of this.counterValueByKey.keys()) {
      if (!visibleCounterKeys.has(key)) {
        this.counterValueByKey.delete(key);
        this.clearCounterPulse(key);
      }
    }
  }

  private observeItemCounterPulse(
    item: AppMenuItem<TId, TContext>,
    visibleCounterKeys: Set<string>,
    branch?: AppMenuBranch<TId, TContext>
  ): void {
    this.observeCounterPulse(
      this.itemCounterKey(item, branch),
      this.itemCounter(item),
      this.hasValueCounter(item.id) || this.isLiveCounter(item.counter ?? null),
      visibleCounterKeys
    );
    for (const action of item.headerActions ?? []) {
      this.observeItemCounterPulse(action, visibleCounterKeys, branch);
    }
    for (const child of item.children ?? []) {
      this.observeItemCounterPulse(child, visibleCounterKeys, branch);
    }
  }

  private observeCounterPulse(
    key: string,
    counter: AppMenuCounter | AppMenuCounterValue | null | undefined,
    live: boolean,
    visibleCounterKeys: Set<string>
  ): void {
    const config = this.counterConfig(counter);
    if (!config) {
      return;
    }
    visibleCounterKeys.add(key);
    const nextSignature = this.counterSignature(counter);
    const previousSignature = this.counterValueByKey.get(key);
    this.counterValueByKey.set(key, nextSignature);
    if (previousSignature === undefined || previousSignature === nextSignature) {
      return;
    }
    if (live) {
      this.pulseCounter(key);
    } else {
      this.clearCounterPulse(key);
    }
  }

  private pulseCounter(key: string): void {
    const existingTimer = this.counterPulseTimerByKey.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    this.pulsingCounterKeys.add(key);
    const timerId = setTimeout(() => {
      this.pulsingCounterKeys.delete(key);
      this.counterPulseTimerByKey.delete(key);
      this.changeDetectorRef.markForCheck();
    }, AppMenuComponent.COUNTER_PULSE_DURATION_MS);
    this.counterPulseTimerByKey.set(key, timerId);
  }

  private clearCounterPulse(key: string): void {
    const timerId = this.counterPulseTimerByKey.get(key);
    if (timerId) {
      clearTimeout(timerId);
      this.counterPulseTimerByKey.delete(key);
    }
    this.pulsingCounterKeys.delete(key);
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

  private itemCounter(item: AppMenuItem<TId, TContext>): AppMenuCounter | AppMenuCounterValue | null | undefined {
    if (this.hasValueCounter(item.id)) {
      return this.value?.[item.id];
    }
    return item.counter ?? null;
  }

  private hasValueCounter(id: TId): boolean {
    return !!this.value && Object.prototype.hasOwnProperty.call(this.value, id);
  }

  private isLiveCounter(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): boolean {
    const config = this.counterConfig(counter);
    return typeof config?.value === 'function';
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

  private counterSignature(counter: AppMenuCounter | AppMenuCounterValue | null | undefined): string {
    const value = this.resolveCounterValue(counter);
    return typeof value === 'number' ? `number:${value}` : `text:${value ?? ''}`;
  }

  private paletteClass(palette: AppMenuPalette): string {
    return `app-menu__palette--${palette}`;
  }
}
