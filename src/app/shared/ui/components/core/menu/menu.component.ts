import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../../pipes';
import { I18nService } from '../../../../core';
import { RateComponent } from './items/rate/rate.component';
import {
  IndicatorComponent,
  type IndicatorShape,
  type IndicatorState,
  type IndicatorTone
} from '../indicator';
import type {
  AppMenuCounter,
  AppMenuCounterValue,
  AppMenuGroup,
  AppMenuImageStackItem,
  AppMenuLayout,
  AppMenuItemLayout,
  AppMenuItemSurface,
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuKind,
  AppMenuLiveValue,
  AppMenuModel,
  AppMenuPanelAlign,
  AppMenuPanelMode,
  AppMenuPalette,
  AppMenuRateConfig,
  AppMenuSegment,
  AppMenuTrigger,
  AppMenuTriggerLayout,
  AppMenuValueKey,
  AppMenuValueMap
} from './menu.types';
import {
  appMenuModelGroups,
  appMenuModelSummary,
  type AppMenuModelSummaryResult,
  type AppMenuModelSummarySelection
} from './menu-summary';

type AppMenuResolvedLayout = 'desktop' | 'mobile';
type AppMenuFilterTextPart = {
  text: string;
  match: boolean;
};

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe, RateComponent, IndicatorComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppMenuComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMenuComponent<TId extends string = string, TContext = unknown>
  implements ControlValueAccessor, DoCheck, OnDestroy {
  private static readonly COUNTER_PULSE_DURATION_MS = 1600;
  private static readonly DESKTOP_MARGIN_PX = 8;
  private static readonly DESKTOP_MIN_PANEL_WIDTH_PX = 196;

  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly i18n = inject(I18nService);

  @Input() kind: AppMenuKind = 'inline';
  @Input() layout: AppMenuLayout = 'row';
  @Input() title: AppMenuLiveValue<string | null | undefined> = null;
  @Input() filterable = false;
  @Input() items: readonly AppMenuItem<TId, TContext>[] = [];
  @Input() model: AppMenuModel<TId, TContext> | null = null;
  @Input() groups: readonly AppMenuGroup<TId, TContext>[] = [];
  @Input() value: AppMenuValueMap<TId> | null = null;
  @Input() trigger: AppMenuTrigger | null = null;
  @Input() openUp = false;
  @Input() panelAlign: AppMenuPanelAlign = 'auto';
  @Input() panelMode: AppMenuPanelMode = 'auto';
  @Input() panelGapPx: number | null = null;
  @Input() panelDockToHost = false;
  @Input() mobileBreakpointPx = 760;
  @Input() closeOnSelect = true;

  @Output() readonly openChange = new EventEmitter<boolean>();
  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent<TId, TContext>>();

  private internalOpen = false;
  private activeBranchPath: AppMenuItem<TId, TContext>[] = [];
  private activeTabsGroupId: string | null = null;
  protected tabsFilterText = '';
  private readonly counterValueByKey = new Map<string, string>();
  private readonly counterPulseTimerByKey = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pulsingCounterKeys = new Set<string>();
  private controlAttached = false;
  private controlDisabled = false;
  private controlValue: unknown = null;
  private onControlChange: (value: unknown) => void = () => undefined;
  private onControlTouched: () => void = () => undefined;
  protected isMobileViewport = false;

  @Input()
  get open(): boolean {
    return this.internalOpen;
  }

  set open(value: boolean | null | undefined) {
    const nextOpen = value === true;
    const opened = nextOpen && !this.internalOpen;
    this.internalOpen = nextOpen;
    if (!this.internalOpen) {
      this.activeBranchPath = [];
      this.tabsFilterText = '';
    } else if (opened) {
      this.syncActiveTabsGroup();
    }
  }

  constructor() {
    this.syncMobileViewport();
  }

  ngDoCheck(): void {
    this.syncCounterPulseState();
    this.syncOpenPanelState();
  }

  ngOnDestroy(): void {
    for (const timerId of this.counterPulseTimerByKey.values()) {
      clearTimeout(timerId);
    }
    this.counterPulseTimerByKey.clear();
  }

  writeValue(value: unknown): void {
    this.controlAttached = true;
    if (this.controlValuesEqual(this.controlValue, value)) {
      return;
    }
    this.controlValue = value;
    this.changeDetectorRef.markForCheck();
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.controlAttached = true;
    this.onControlChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.controlAttached = true;
    this.onControlTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlAttached = true;
    if (this.controlDisabled === isDisabled) {
      return;
    }
    this.controlDisabled = isDisabled;
    this.changeDetectorRef.markForCheck();
  }

  @HostBinding('class.app-menu-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-menu-host--kind-inline')
  protected get hostInlineKindClass(): boolean {
    return this.isInlineMenuKind;
  }

  @HostBinding('class.app-menu-host--layout-row')
  protected get hostRowLayoutClass(): boolean {
    return this.isInlineRowLayout;
  }

  @HostBinding('class.app-menu-host--layout-grid')
  protected get hostGridLayoutClass(): boolean {
    return this.isInlineGridLayout;
  }

  @HostBinding('class.app-menu-host--inline-row-big')
  protected get hostInlineRowBigClass(): boolean {
    return this.isInlineRowBig;
  }

  @HostBinding('class.app-menu-host--inline-row-labelled-action')
  protected get hostInlineRowLabelledActionClass(): boolean {
    return this.isInlineRowLayout
      && this.actionRowItems.some(item => this.itemVisualLayout(item) === 'action' && !!this.actionRowItemLabel(item));
  }

  @HostBinding('class.app-menu-host--kind-fab')
  protected get hostFabKindClass(): boolean {
    return this.isFabKind;
  }

  @HostBinding('class.app-menu-host--kind-select')
  protected get hostSelectKindClass(): boolean {
    return this.kind === 'select';
  }

  @HostBinding('class.app-menu-host--model-layout-tabs')
  protected get hostTabbedModelLayoutClass(): boolean {
    return this.isTabbedModelLayout || this.activeBranchTabbedModelLayout;
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

  @HostBinding('class.app-menu-host--compact')
  protected get hostCompactClass(): boolean {
    return this.hasCompactDensity(this.model) || this.hasCompactDensity(this.currentMenuModel());
  }

  @HostBinding('class.app-menu-host--inline-panel')
  protected get hostInlinePanelClass(): boolean {
    return this.usesInlinePanel;
  }

  @HostBinding('class.app-menu-host--panel-docked')
  protected get hostPanelDockedClass(): boolean {
    return this.panelDockToHost;
  }

  @HostBinding('class.app-menu-host--panel-bottom-docked')
  protected get hostPanelBottomDockedClass(): boolean {
    return this.isBottomPanelMode;
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

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (!this.open || this.isFixedPanelMode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.setOpen(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (
      !this.open
      || this.usesInlinePanel
      || this.isFixedPanelMode
      || (this.resolvedLayout === 'mobile' && !this.isAnchoredOverlayKind)
    ) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostRef.nativeElement.contains(target)) {
      return;
    }
    this.setOpen(false);
  }

  protected get resolvedLayout(): AppMenuResolvedLayout {
    if (this.isBottomPanelMode) {
      return 'desktop';
    }
    if (this.panelMode === 'sheet') {
      return 'mobile';
    }
    if (this.panelMode === 'anchored') {
      return 'desktop';
    }
    return this.isMobileViewport ? 'mobile' : 'desktop';
  }

  protected get usesInlinePanel(): boolean {
    return this.isInlineGridLayout || (this.isTabbedModelLayout && !this.hasTrigger);
  }

  protected get isInlineMenuKind(): boolean {
    return this.kind === 'inline';
  }

  protected get isInlineRowLayout(): boolean {
    return this.isInlineMenuKind && this.layout === 'row';
  }

  protected get isInlineRowBig(): boolean {
    return this.isInlineRowLayout && this.actionRowItems.some(item => this.itemVisualLayout(item) === 'big');
  }

  protected get isInlineGridLayout(): boolean {
    return this.isInlineMenuKind && this.layout === 'grid';
  }

  protected get isFabKind(): boolean {
    return this.kind === 'fab';
  }

  protected get isSelectKind(): boolean {
    return this.kind === 'select';
  }

  protected get isTabbedModelLayout(): boolean {
    return this.model?.layout === 'tabs';
  }

  protected get activeBranchTabbedModelLayout(): boolean {
    return this.activeBranch !== null && this.currentTabbedModelLayout;
  }

  protected get currentTabbedModelLayout(): boolean {
    return this.currentMenuModel()?.layout === 'tabs';
  }

  protected get isDropdownListKind(): boolean {
    return this.isSelectKind || this.isFabKind;
  }

  protected get isAnchoredOverlayKind(): boolean {
    return this.isDropdownListKind || this.isInlineRowLayout || this.isTabbedModelLayout;
  }

  private get isBottomPanelMode(): boolean {
    return this.panelMode === 'dock' || this.panelMode === 'fixed';
  }

  private get isFixedPanelMode(): boolean {
    return this.panelMode === 'fixed';
  }

  protected get isCustomTriggerAction(): boolean {
    return this.trigger?.action === 'custom';
  }

  protected get panelVisible(): boolean {
    if (this.isCustomTriggerAction) {
      return false;
    }
    return this.usesInlinePanel || this.open;
  }

  protected get showMobileBackdrop(): boolean {
    return this.open && !this.usesInlinePanel && !this.isAnchoredOverlayKind && this.resolvedLayout === 'mobile';
  }

  protected get resolvedOpenUp(): boolean {
    if (this.resolvedLayout === 'mobile' || !this.panelVisible || this.usesInlinePanel) {
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
    if (this.panelAlign !== 'auto' || this.resolvedLayout === 'mobile' || !this.panelVisible || this.usesInlinePanel) {
      return this.panelAlign === 'start' ? 'start' : 'end';
    }
    const rect = this.hostRect();
    if (!rect) {
      return 'end';
    }
    const bounds = this.layoutBounds();
    const estimatedWidth = this.estimatedPanelWidth();
    const startOverflow = this.panelHorizontalOverflow('start', rect, bounds, estimatedWidth);
    const endOverflow = this.panelHorizontalOverflow('end', rect, bounds, estimatedWidth);
    if (startOverflow !== endOverflow) {
      return startOverflow < endOverflow ? 'start' : 'end';
    }
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

  protected get menuNodes(): readonly AppMenuGroup<TId, TContext>[] {
    return appMenuModelGroups(this.model, this.groups);
  }

  protected get hasMenuNodes(): boolean {
    return this.menuNodes.length > 0;
  }

  protected get tabsGroups(): readonly AppMenuGroup<TId, TContext>[] {
    const model = this.currentMenuModel();
    if (model?.layout === 'tabs') {
      return appMenuModelGroups(model, this.currentMenuGroupFallback());
    }
    return this.menuNodes;
  }

  protected get hasTabsGroups(): boolean {
    return this.tabsGroups.length > 0;
  }

  protected get visibleTabsGroups(): readonly AppMenuGroup<TId, TContext>[] {
    const query = this.normalizedFilterText();
    if (!query) {
      return this.tabsGroups;
    }
    return this.tabsGroups
      .map(group => ({
        ...group,
        items: this.groupItems(group).filter(item => this.itemMatchesFilter(item, query))
      }))
      .filter(group => this.groupItems(group).length > 0);
  }

  protected get actionRowItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.items.length > 0) {
      return this.items;
    }
    const items: AppMenuItem<TId, TContext>[] = [];
    for (const node of this.menuNodes) {
      items.push(...this.groupItems(node));
    }
    return items;
  }

  protected get hasTrigger(): boolean {
    return this.trigger !== null;
  }

  protected get activeBranch(): AppMenuItem<TId, TContext> | null {
    const branch = this.activeBranchPath[this.activeBranchPath.length - 1] ?? null;
    return branch ? this.currentItemById(branch.id) : null;
  }

  protected get visibleListItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.activeBranch) {
      return this.branchListItems(this.activeBranch);
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
    return this.isInlineRowLayout ? this.activeBranchPath.length > 1 : true;
  }

  protected get resolvedTitle(): string {
    return `${this.resolveLiveValue(this.title) ?? ''}`.trim();
  }

  protected triggerLabel(): string {
    const configuredLabel = `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
    return configuredLabel || this.modelSummary().label || this.defaultSelectTriggerLabel();
  }

  protected usesDefaultSelectTriggerLabel(): boolean {
    const configuredLabel = `${this.resolveLiveValue(this.trigger?.label) ?? ''}`.trim();
    const summaryLabel = this.modelSummary().label;
    return !configuredLabel && !summaryLabel && Boolean(this.defaultSelectTriggerLabel());
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

  protected isSymbolIcon(icon: string | null | undefined): boolean {
    return `${icon ?? ''}`.trim().length === 1;
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
    const configuredIcon = this.resolveLiveValue(this.open
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
      return this.open ? `Close ${label}` : `Open ${label}`;
    }
    return this.open ? 'Close menu' : 'Open menu';
  }

  protected triggerAriaHasPopup(): string | null {
    return this.isCustomTriggerAction ? 'dialog' : 'menu';
  }

  protected triggerDisabled(): boolean {
    return this.controlDisabled || this.resolveBoolean(this.trigger?.disabled);
  }

  protected triggerPalette(): AppMenuPalette {
    return this.trigger?.palette ?? 'default';
  }

  protected triggerPaletteClass(): string {
    return this.paletteClass(this.triggerPalette());
  }

  protected triggerLayout(): AppMenuTriggerLayout {
    if (this.trigger?.layout) {
      return this.trigger.layout;
    }
    if (!this.hasTrigger) {
      return 'default';
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

  protected triggerCounterKey(): string {
    return 'trigger';
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
    return this.modelSummary().counter;
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
        sourceEvent: event,
        controlValue: this.currentControlEventValue(),
        action: 'select'
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
    if (this.hasNestedItems(item)) {
      if (this.open && this.activeBranchPath[0]?.id === item.id) {
        this.setOpen(false);
        return;
      }
      this.activeBranchPath = [item];
      this.syncActiveTabsGroup();
      this.setOpen(true);
      return;
    }
    if (this.openActionRowHref(item, event)) {
      return;
    }
    const controlValue = this.selectControlItem(item);
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event,
      value: item.value,
      controlValue,
      action: 'select'
    });
    this.setOpen(false);
  }

  private openActionRowHref(item: AppMenuItem<TId, TContext>, event: Event): boolean {
    const href = this.itemHref(item);
    if (!href) {
      return false;
    }
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event,
      value: item.value,
      controlValue: this.currentControlEventValue(),
      action: 'select'
    });
    this.openHref(href, this.itemTarget(item), this.itemRel(item));
    if (this.shouldCloseOnSelect(item)) {
      this.setOpen(false);
    }
    return true;
  }

  private openHref(href: string, target: string | null, rel: string | null): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (!target || target === '_self') {
      window.location.href = href;
      return;
    }
    window.open(href, target, rel || 'noopener,noreferrer');
  }

  protected selectBranchHeaderAction(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item)) {
      return;
    }
    const controlValue = this.selectControlItem(item);
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event,
      value: item.value,
      controlValue,
      action: 'select'
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
      this.tabsFilterText = '';
      this.syncActiveTabsGroup();
      return;
    }
    const controlValue = this.selectControlItem(item);
    const selectEvent: AppMenuItemSelectEvent<TId, TContext> = {
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event,
      value: item.value,
      controlValue,
      action: 'select'
    };
    this.itemSelect.emit(selectEvent);
    if (this.shouldCloseOnSelect(item)) {
      this.setOpen(false);
    }
  }

  protected removeItem(item: AppMenuItem<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isItemDisabled(item) || this.isPassiveItem(item) || !this.isItemRemovable(item)) {
      return;
    }
    const closesEmptyBranch = this.activeBranchPath.length > 0
      && this.visibleSelectableListItems().length <= 1;
    const controlValue = this.removeControlItem(item);
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: event,
      value: item.value,
      controlValue,
      action: 'remove'
    });
    if (closesEmptyBranch) {
      this.setOpen(false);
    }
  }

  protected updateRateItemValue(item: AppMenuItem<TId, TContext>, value: unknown): void {
    if (!this.isRateItem(item)) {
      return;
    }
    item.value = value;
  }

  protected selectRateItem(item: AppMenuItem<TId, TContext>, score: number): void {
    if (this.isItemDisabled(item) || this.isPassiveItem(item)) {
      return;
    }
    this.updateRateItemValue(item, score);
    const controlValue = this.selectControlItem(item);
    this.itemSelect.emit({
      id: item.id,
      item,
      context: item.context,
      sourceEvent: new Event('ratingScoreSelect'),
      value: item.value,
      controlValue,
      action: 'select'
    });
    if (this.shouldCloseOnSelect(item)) {
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
      sourceEvent: event,
      value: item.value,
      controlValue: this.currentControlEventValue(),
      action: 'select'
    });
    if (this.shouldCloseOnSelect(item)) {
      this.setOpen(false);
    }
  }

  protected closeActiveBranch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeBranchPath = this.activeBranchPath.slice(0, -1);
    this.tabsFilterText = '';
    this.syncActiveTabsGroup();
  }

  protected isActionRowItemOpen(item: AppMenuItem<TId, TContext>): boolean {
    return this.open && this.activeBranchPath[0]?.id === item.id;
  }

  protected isSelectTriggerItem(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'select-trigger';
  }

  protected isLabeledActionRowItem(item: AppMenuItem<TId, TContext>): boolean {
    return this.itemVisualLayout(item) === 'big'
      || this.isSelectTriggerItem(item)
      || this.itemVisualLayout(item) === 'pill'
      || (this.itemVisualLayout(item) === 'action' && !!this.actionRowItemLabel(item));
  }

  protected isActionLayoutItem(item: AppMenuItem<TId, TContext>): boolean {
    return this.itemVisualLayout(item) === 'action';
  }

  protected isImageLayoutItem(item: AppMenuItem<TId, TContext>): boolean {
    return this.itemVisualLayout(item) === 'image';
  }

  protected isImageStackLayoutItem(item: AppMenuItem<TId, TContext>): boolean {
    return this.itemVisualLayout(item) === 'image-stack';
  }

  protected actionRowItemIcon(item: AppMenuItem<TId, TContext>): string {
    if (this.isActionRowItemOpen(item)) {
      const openIcon = `${this.resolveLiveValue(item.closeIcon ?? item.openIcon) ?? ''}`.trim();
      if (openIcon) {
        return openIcon;
      }
      if (!this.isLabeledActionRowItem(item) && this.hasNestedItems(item)) {
        return 'close';
      }
    }
    return this.itemIcon(item);
  }

  protected actionRowItemImageUrl(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.imageUrl) ?? ''}`.trim();
  }

  protected actionRowItemImageAlt(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.imageAlt) ?? this.actionRowItemAriaLabel(item) ?? ''}`.trim();
  }

  protected actionRowItemImageFallback(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.imageFallback) ?? ''}`.trim();
  }

  protected actionRowItemImageStack(item: AppMenuItem<TId, TContext>): readonly AppMenuImageStackItem[] {
    const resolvedStack = this.resolveLiveValue(item.imageStack) ?? [];
    const stack = Array.isArray(resolvedStack) ? resolvedStack : [];
    const maxVisible = Math.max(1, Math.trunc(Number(this.resolveLiveValue(item.imageStackMaxVisible)) || stack.length || 1));
    return stack.slice(0, maxVisible);
  }

  protected actionRowStackImageUrl(image: AppMenuImageStackItem): string {
    return `${this.resolveLiveValue(image.imageUrl) ?? ''}`.trim();
  }

  protected actionRowStackImageAlt(image: AppMenuImageStackItem): string {
    return `${this.resolveLiveValue(image.imageAlt) ?? ''}`.trim();
  }

  protected actionRowStackImageFallback(image: AppMenuImageStackItem): string {
    return `${this.resolveLiveValue(image.imageFallback) ?? ''}`.trim();
  }

  protected actionRowItemLabel(item: AppMenuItem<TId, TContext>): string {
    return this.itemLabel(item);
  }

  protected actionRowItemDetail(item: AppMenuItem<TId, TContext>): string {
    const summary = this.actionRowItemModelSummary(item);
    if (summary.label) {
      return summary.label;
    }
    return this.itemDetail(item) || this.itemDescription(item);
  }

  protected hasActionRowItemSummaryCounter(item: AppMenuItem<TId, TContext>): boolean {
    return this.counterVisible(this.actionRowItemModelSummary(item).counter);
  }

  protected actionRowItemSummaryCounterLabel(item: AppMenuItem<TId, TContext>): string {
    return this.counterLabel(this.actionRowItemModelSummary(item).counter);
  }

  protected actionRowItemSummaryCounterKey(item: AppMenuItem<TId, TContext>): string {
    return `${this.itemCounterKey(item)}:summary`;
  }

  protected actionRowItemAriaLabel(item: AppMenuItem<TId, TContext>): string | null {
    return this.itemAriaLabel(item) ?? (this.actionRowItemLabel(item) || null);
  }

  protected itemProgressState(item: AppMenuItem<TId, TContext>): IndicatorState | null {
    const state = this.resolveLiveValue(item.progress?.state) ?? null;
    return state === 'idle' || state === 'inactive' ? null : state;
  }

  protected itemProgressTone(item: AppMenuItem<TId, TContext>): IndicatorTone {
    return this.resolveLiveValue(item.progress?.tone) ?? 'default';
  }

  protected itemProgressShape(item: AppMenuItem<TId, TContext>): IndicatorShape {
    return item.progress?.shape ?? (this.isLabeledActionRowItem(item) ? 'button' : 'circle');
  }

  protected itemProgressDurationMs(item: AppMenuItem<TId, TContext>): number {
    const durationMs = Number(this.resolveLiveValue(item.progress?.durationMs));
    return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 3000;
  }

  protected itemProgressPerimeter(item: AppMenuItem<TId, TContext>): number {
    const perimeter = Number(this.resolveLiveValue(item.progress?.perimeter));
    return Number.isFinite(perimeter) && perimeter > 0 ? perimeter : 100;
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

  protected groupPalette(group: AppMenuGroup<TId, TContext>): AppMenuPalette {
    return group.palette ?? 'default';
  }

  protected groupPaletteClass(group: AppMenuGroup<TId, TContext>): string {
    return this.paletteClass(this.groupPalette(group));
  }

  protected groupLabel(group: AppMenuGroup<TId, TContext>): string {
    return `${this.resolveLiveValue(group.label) ?? ''}`.trim();
  }

  protected groupIcon(group: AppMenuGroup<TId, TContext>): string {
    return `${this.resolveLiveValue(group.icon) ?? ''}`.trim();
  }

  protected groupAriaLabel(group: AppMenuGroup<TId, TContext>): string | null {
    const ariaLabel = `${this.resolveLiveValue(group.ariaLabel) ?? this.groupLabel(group)}`.trim();
    return ariaLabel || null;
  }

  protected groupItems(group: AppMenuGroup<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return group.items ?? [];
  }

  protected isTabsFilterable(): boolean {
    if (this.activeBranch) {
      return this.activeBranch?.filterable === true;
    }
    return this.currentTabbedModelLayout && this.filterable === true;
  }

  protected showTabsBar(): boolean {
    return this.visibleTabsGroups.length > 1;
  }

  protected activeTabsGroup(): AppMenuGroup<TId, TContext> | null {
    const groups = this.visibleTabsGroups;
    if (groups.length === 0) {
      return null;
    }
    return groups.find(group => group.id === this.activeTabsGroupId)
      ?? this.defaultTabsGroup(groups);
  }

  protected isTabsGroupActive(group: AppMenuGroup<TId, TContext>): boolean {
    return this.activeTabsGroup()?.id === group.id;
  }

  protected selectTabsGroup(group: AppMenuGroup<TId, TContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeTabsGroupId = group.id;
  }

  protected updateTabsFilter(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.tabsFilterText = `${target?.value ?? ''}`;
    this.syncActiveTabsGroup();
  }

  protected clearTabsFilter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.tabsFilterText = '';
    this.syncActiveTabsGroup();
  }

  protected tabsGroupItems(group: AppMenuGroup<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return this.groupItems(group);
  }

  protected tabsColumnCount(): string | null {
    const columns = this.autoTabsColumnCount();
    return columns === null ? null : `${columns}`;
  }

  protected tabsGroupSelectedCount(group: AppMenuGroup<TId, TContext>): number {
    return this.groupItems(this.sourceTabsGroup(group)).filter(item => this.isItemActive(item)).length;
  }

  protected itemLabelFilterParts(item: AppMenuItem<TId, TContext>): readonly AppMenuFilterTextPart[] {
    return this.filterTextParts(this.itemLabel(item));
  }

  protected hasVisibleTabsItems(group: AppMenuGroup<TId, TContext>): boolean {
    return this.tabsGroupItems(group).length > 0;
  }

  protected tabsId(group: AppMenuGroup<TId, TContext>): string {
    return `app-menu-tab-${this.safeDomId(group.id)}`;
  }

  protected tabsPanelId(group: AppMenuGroup<TId, TContext>): string {
    return `app-menu-tab-panel-${this.safeDomId(group.id)}`;
  }

  private groupedDropdownItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.isInlineGridLayout || !this.hasMenuNodes) {
      return [];
    }
    return this.groupedMenuItems(this.menuNodes);
  }

  private groupedMenuItems(groups: readonly AppMenuGroup<TId, TContext>[]): readonly AppMenuItem<TId, TContext>[] {
    const items: AppMenuItem<TId, TContext>[] = [];
    for (const group of groups) {
      const groupItems = this.groupItems(group);
      if (groupItems.length === 0) {
        continue;
      }
      if (items.length > 0) {
        items.push({
          id: `${group.id}__divider` as TId,
          kind: 'divider'
        });
      }
      if (this.groupLabel(group) || this.groupIcon(group)) {
        items.push({
          id: `${group.id}__section` as TId,
          kind: 'section',
          label: group.label,
          icon: group.icon,
          palette: group.palette,
          headerActions: group.headerActions,
          ariaLabel: group.ariaLabel
        });
      }
      items.push(...groupItems);
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

  protected itemVisualLayout(item: AppMenuItem<TId, TContext>): AppMenuItemLayout {
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
    return this.resolveBoolean(item.active)
      || this.resolveBoolean(item.checked)
      || this.isControlItemSelected(item);
  }

  protected showItemCheck(item: AppMenuItem<TId, TContext>): boolean {
    if (this.resolveLiveValue(item.showCheck) === false) {
      return false;
    }
    if (((this.isDropdownListKind && !this.currentTabbedModelLayout) || (this.isInlineRowLayout && !this.currentTabbedModelLayout)) && item.kind === 'radio') {
      return false;
    }
    return this.isItemActive(item) && !this.hasNestedItems(item);
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

  protected showTabsItemToggle(item: AppMenuItem<TId, TContext>): boolean {
    return this.currentModelMaxSelected() !== 1 && (item.kind === 'checkbox' || item.kind === 'toggle');
  }

  protected isItemDisabled(item: AppMenuItem<TId, TContext>): boolean {
    return this.controlDisabled || this.resolveBoolean(item.disabled) || this.isMaxSelectedLimitDisablingItem(item);
  }

  protected isItemRemovable(item: AppMenuItem<TId, TContext>): boolean {
    return this.resolveBoolean(item.removable) && !this.isPassiveItem(item);
  }

  protected itemRemoveIcon(item: AppMenuItem<TId, TContext>): string {
    return `${this.resolveLiveValue(item.removeIcon) ?? 'close'}`.trim() || 'close';
  }

  protected itemRemoveAriaLabel(item: AppMenuItem<TId, TContext>): string {
    const configured = `${this.resolveLiveValue(item.removeAriaLabel) ?? ''}`.trim();
    if (configured) {
      return configured;
    }
    const label = this.itemLabel(item);
    return label ? `Remove ${label}` : 'Remove item';
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

  protected isRateItem(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'rate';
  }

  protected itemRateConfig(item: AppMenuItem<TId, TContext>): AppMenuRateConfig | null {
    if (!this.isRateItem(item)) {
      return null;
    }
    return {
      ...(item.rateConfig ?? {}),
      value: this.rateItemValue(item),
      readonly: this.isItemDisabled(item) || (item.rateConfig?.readonly ?? false),
      dock: null
    };
  }

  private rateItemValue(item: AppMenuItem<TId, TContext>): number | null {
    const itemValue = Number(item.value);
    if (Number.isFinite(itemValue)) {
      return itemValue;
    }
    const configuredValue = Number(item.rateConfig?.value);
    return Number.isFinite(configuredValue) ? configuredValue : null;
  }

  protected isBranch(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'branch';
  }

  protected hasNestedItems(item: AppMenuItem<TId, TContext>): boolean {
    return this.itemChildItems(item).length > 0 || this.itemMenuGroups(item).length > 0;
  }

  protected shouldOpenItemBranch(item: AppMenuItem<TId, TContext>): boolean {
    return !this.isInlineGridLayout && this.hasNestedItems(item);
  }

  private shouldCloseOnSelect(item: AppMenuItem<TId, TContext>): boolean {
    return item.closeOnSelect ?? (this.currentTabbedModelLayout ? false : this.closeOnSelect);
  }

  private syncActiveTabsGroup(): void {
    if (!this.currentTabbedModelLayout || this.tabsGroups.length === 0) {
      return;
    }
    const groups = this.visibleTabsGroups;
    if (groups.length === 0) {
      this.activeTabsGroupId = null;
      return;
    }
    const currentGroup = groups.find(group => group.id === this.activeTabsGroupId);
    const activeGroup = this.activeTabsSelectedGroup(groups);
    this.activeTabsGroupId = (currentGroup ?? activeGroup ?? groups[0] ?? null)?.id ?? null;
  }

  private syncOpenPanelState(): void {
    if (!this.open || this.usesInlinePanel || this.isCustomTriggerAction) {
      return;
    }
    if (this.activeBranchPath.length > 0) {
      if (!this.activeBranch) {
        this.setOpen(false);
        return;
      }
      if (this.currentTabbedModelLayout) {
        if (this.tabsGroups.length === 0) {
          this.setOpen(false);
        }
        return;
      }
      if (this.visibleSelectableListItems().length === 0) {
        this.setOpen(false);
      }
      return;
    }
    if (this.isInlineRowLayout) {
      this.setOpen(false);
      return;
    }
    if (this.isDropdownListKind && !this.isTabbedModelLayout && this.visibleSelectableListItems().length === 0) {
      this.setOpen(false);
    }
  }

  private visibleSelectableListItems(): readonly AppMenuItem<TId, TContext>[] {
    return this.visibleListItems.filter(item => !this.isPassiveItem(item));
  }

  private defaultTabsGroup(groups: readonly AppMenuGroup<TId, TContext>[] = this.visibleTabsGroups): AppMenuGroup<TId, TContext> | null {
    return this.activeTabsSelectedGroup(groups) ?? groups[0] ?? null;
  }

  private activeTabsSelectedGroup(groups: readonly AppMenuGroup<TId, TContext>[] = this.tabsGroups): AppMenuGroup<TId, TContext> | null {
    return groups.find(group =>
      this.groupItems(group).some(item => this.isItemActive(item))
    ) ?? null;
  }

  private sourceTabsGroup(group: AppMenuGroup<TId, TContext>): AppMenuGroup<TId, TContext> {
    return this.tabsGroups.find(candidate => candidate.id === group.id) ?? group;
  }

  private currentItemById(id: TId): AppMenuItem<TId, TContext> | null {
    return this.findItemById(this.actionRowItems, id);
  }

  private findItemById(items: readonly AppMenuItem<TId, TContext>[], id: TId): AppMenuItem<TId, TContext> | null {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }
      const childMatch = this.findItemById(this.itemChildItems(item), id);
      if (childMatch) {
        return childMatch;
      }
      for (const group of this.itemMenuGroups(item)) {
        const modelMatch = this.findItemById(this.groupItems(group), id);
        if (modelMatch) {
          return modelMatch;
        }
      }
    }
    return null;
  }

  private itemMatchesFilter(item: AppMenuItem<TId, TContext>, query: string): boolean {
    return [
      this.translatedFilterText(this.itemLabel(item)),
      this.translatedFilterText(this.itemDescription(item)),
      this.translatedFilterText(this.itemDetail(item))
    ].some(value => this.normalizedText(value).includes(query));
  }

  private translatedFilterText(value: string): string {
    this.i18n.revision();
    return this.i18n.translate(value);
  }

  private filterTextParts(value: string): readonly AppMenuFilterTextPart[] {
    const text = this.translatedFilterText(value);
    const query = this.normalizedFilterText();
    if (!query) {
      return [{ text, match: false }];
    }
    const normalizedText = this.normalizedText(text);
    const parts: AppMenuFilterTextPart[] = [];
    let offset = 0;
    let index = normalizedText.indexOf(query, offset);
    while (index >= 0) {
      if (index > offset) {
        parts.push({ text: text.slice(offset, index), match: false });
      }
      const nextOffset = index + query.length;
      parts.push({ text: text.slice(index, nextOffset), match: true });
      offset = nextOffset;
      index = normalizedText.indexOf(query, offset);
    }
    if (offset < text.length) {
      parts.push({ text: text.slice(offset), match: false });
    }
    return parts.length > 0 ? parts : [{ text, match: false }];
  }

  private normalizedFilterText(): string {
    return this.normalizedText(this.tabsFilterText);
  }

  private normalizedText(value: unknown): string {
    return `${value ?? ''}`.trim().toLowerCase();
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

  protected hasItemBody(item: AppMenuItem<TId, TContext>): boolean {
    return !!this.itemDescription(item)
      || (!!this.itemDetail(item) && this.itemVisualLayout(item) === 'pill');
  }

  protected itemCounterLabel(item: AppMenuItem<TId, TContext>): string {
    return this.counterLabel(this.itemCounter(item));
  }

  protected itemCounterKey(item: AppMenuItem<TId, TContext>, group?: AppMenuGroup<TId, TContext>): string {
    const itemKey = `${item.kind ?? 'action'}:${item.id}`;
    return group ? `node:${group.id}:${itemKey}` : `item:${itemKey}`;
  }

  protected isCounterPulsing(key: string): boolean {
    return this.pulsingCounterKeys.has(key);
  }

  protected trackByItemId(index: number, item: AppMenuItem<TId, TContext>): string {
    return `${item.kind ?? 'action'}:${item.id || index}`;
  }

  protected trackByGroupId(index: number, group: AppMenuGroup<TId, TContext>): string {
    return `${group.id || index}`;
  }

  protected trackBySegmentId(index: number, segment: AppMenuSegment): string {
    return `${segment.id || index}`;
  }

  private setOpen(open: boolean): void {
    if (this.internalOpen === open) {
      return;
    }
    const opened = open && !this.internalOpen;
    this.internalOpen = open;
    if (!open) {
      this.activeBranchPath = [];
      this.tabsFilterText = '';
    } else if (opened) {
      this.syncActiveTabsGroup();
    }
    this.openChange.emit(open);
  }

  private safeDomId(value: string): string {
    return `${value || 'group'}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
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
    if (/(ui-popup__panel|ui-popup__body|popup-body|scroll-area|popup-panel|app-popup-panel)/.test(className)) {
      return true;
    }
    if (/(hidden|clip)/.test(overflow)) {
      return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    }
    return false;
  }

  private panelHorizontalOverflow(
    align: 'start' | 'end',
    rect: DOMRect,
    bounds: { left: number; right: number },
    width: number
  ): number {
    const left = align === 'start' ? rect.left : rect.right - width;
    const right = left + width;
    return Math.max(0, bounds.left - left) + Math.max(0, right - bounds.right);
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
    const branchHeaderHeight = this.visibleListItems.some(item => this.hasNestedItems(item)) ? 38 : 0;
    return Math.min(448, titleHeight + branchHeaderHeight + itemCount * 40 + 18);
  }

  private syncCounterPulseState(): void {
    const visibleCounterKeys = new Set<string>();
    const triggerCounter = this.triggerCounter();
    this.observeCounterPulse(
      this.triggerCounterKey(),
      triggerCounter,
      this.isLiveCounter(triggerCounter),
      visibleCounterKeys
    );
    for (const item of this.items) {
      this.observeItemCounterPulse(item, visibleCounterKeys);
    }
    for (const group of this.menuNodes) {
      for (const action of group.headerActions ?? []) {
        this.observeItemCounterPulse(action, visibleCounterKeys, group);
      }
      for (const item of this.groupItems(group)) {
        this.observeItemCounterPulse(item, visibleCounterKeys, group);
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
    group?: AppMenuGroup<TId, TContext>
  ): void {
    this.observeCounterPulse(
      this.itemCounterKey(item, group),
      this.itemCounter(item),
      this.hasValueCounter(item.id) || this.isLiveCounter(item.counter ?? null),
      visibleCounterKeys
    );
    for (const action of item.headerActions ?? []) {
      this.observeItemCounterPulse(action, visibleCounterKeys, group);
    }
    for (const child of this.itemChildItems(item)) {
      this.observeItemCounterPulse(child, visibleCounterKeys, group);
    }
    for (const childGroup of this.itemMenuGroups(item)) {
      for (const action of childGroup.headerActions ?? []) {
        this.observeItemCounterPulse(action, visibleCounterKeys, childGroup);
      }
      for (const child of this.groupItems(childGroup)) {
        this.observeItemCounterPulse(child, visibleCounterKeys, childGroup);
      }
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

  private modelSummary(): AppMenuModelSummaryResult {
    return appMenuModelSummary(this.model, this.groups, this.controlSelection());
  }

  private actionRowItemModelSummary(item: AppMenuItem<TId, TContext>): AppMenuModelSummaryResult {
    return appMenuModelSummary(item.model, item.groups ?? []);
  }

  private controlSelection(): AppMenuModelSummarySelection | null {
    if (!this.controlAttached) {
      return null;
    }
    return {
      active: true,
      value: this.controlValue,
      valueKey: this.model?.valueKey ?? null
    };
  }

  private currentControlEventValue(): unknown {
    return this.controlAttached ? this.controlValue : undefined;
  }

  private isMaxSelectedLimitDisablingItem(item: AppMenuItem<TId, TContext>): boolean {
    const maxSelected = this.currentModelMaxSelected();
    if (maxSelected === null || maxSelected === 1 || !this.isMultiSelectItem(item) || this.isItemActive(item)) {
      return false;
    }
    return this.currentSelectedMultiSelectCount() >= maxSelected;
  }

  private currentModelMaxSelected(): number | null {
    const rawMaxSelected = this.currentMenuModel()?.maxSelected;
    if (rawMaxSelected === null || rawMaxSelected === undefined) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(rawMaxSelected)) || 0);
  }

  private autoTabsColumnCount(): number | null {
    const group = this.activeTabsGroup();
    if (!group) {
      return null;
    }
    const items = this.tabsGroupItems(group).filter(item => !this.isDivider(item) && !this.isSection(item));
    if (items.length <= 1) {
      return null;
    }
    const candidates = this.tabsColumnCandidates(items.length);
    if (candidates.length === 0) {
      return null;
    }
    const width = this.tabsItemsWidth();
    if (width <= 0) {
      return null;
    }
    if (items.length <= 4 && width >= 420) {
      return items.length;
    }
    const totalLabelChars = items.reduce((total, item) => total + this.itemLabel(item).length, 0);
    const averageLabelChars = totalLabelChars / items.length;
    const hasIcons = items.some(item => this.itemIcon(item).length > 0);
    const hasToggles = items.some(item => this.showTabsItemToggle(item));
    const estimatedItemWidth = 38
      + (averageLabelChars * 4.1)
      + (hasIcons ? 20 : 0)
      + (hasToggles ? 34 : 0);
    const gap = 6;
    for (const columns of candidates) {
      const availableItemWidth = (width - (gap * Math.max(0, columns - 1))) / columns;
      if (availableItemWidth >= estimatedItemWidth) {
        return columns;
      }
    }
    return null;
  }

  private tabsColumnCandidates(itemCount: number): number[] {
    if (itemCount === 2) {
      return [2];
    }
    if (itemCount === 3) {
      return [3];
    }
    if (itemCount === 4) {
      return [4, 2];
    }
    if (itemCount === 6) {
      return [3, 2];
    }
    if (itemCount % 4 === 0) {
      return [4, 2];
    }
    if (itemCount % 3 === 0) {
      return [3];
    }
    return [];
  }

  private tabsItemsWidth(): number {
    const host = this.hostRef.nativeElement;
    const panel = host.querySelector('.app-menu__tabs-panel') as HTMLElement | null;
    const width = panel?.getBoundingClientRect().width ?? host.getBoundingClientRect().width;
    return Number.isFinite(width) ? width : 0;
  }

  private currentMenuModel(): AppMenuModel<TId, TContext> | null {
    if (this.activeBranch) {
      return this.activeBranch.model ?? null;
    }
    return this.model;
  }

  private hasCompactDensity(model: AppMenuModel<TId, TContext> | null | undefined): boolean {
    return model?.density === 'compact';
  }

  private currentSelectedMultiSelectCount(): number {
    if (this.controlAttached) {
      if (Array.isArray(this.controlValue)) {
        return this.controlValue.length;
      }
      return this.controlValue === null || this.controlValue === undefined || this.controlValue === '' ? 0 : 1;
    }
    return this.currentRenderedItems().filter(item => this.isMultiSelectItem(item) && this.isItemActive(item)).length;
  }

  private currentRenderedItems(): readonly AppMenuItem<TId, TContext>[] {
    if (this.currentTabbedModelLayout && this.tabsGroups.length > 0) {
      return this.tabsGroups.flatMap(group => this.groupItems(group));
    }
    if (this.isInlineRowLayout) {
      return this.actionRowItems;
    }
    return this.visibleListItems;
  }

  private isMultiSelectItem(item: AppMenuItem<TId, TContext>): boolean {
    return item.kind === 'checkbox' || item.kind === 'toggle';
  }

  private currentMenuGroupFallback(): readonly AppMenuGroup<TId, TContext>[] {
    return this.activeBranch?.groups ?? this.groups;
  }

  private branchListItems(item: AppMenuItem<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    const childItems = this.itemChildItems(item);
    if (childItems.length > 0) {
      return childItems;
    }
    return this.groupedMenuItems(this.itemMenuGroups(item));
  }

  private itemChildItems(item: AppMenuItem<TId, TContext>): readonly AppMenuItem<TId, TContext>[] {
    return item.items ?? [];
  }

  private itemMenuGroups(item: AppMenuItem<TId, TContext>): readonly AppMenuGroup<TId, TContext>[] {
    return appMenuModelGroups(item.model, item.groups ?? []);
  }

  private selectControlItem(item: AppMenuItem<TId, TContext>): unknown {
    if (!this.controlAttached || this.controlDisabled || this.isPassiveItem(item)) {
      return undefined;
    }
    this.markControlTouched();
    const nextValue = this.nextControlValueForItem(item);
    this.setControlValue(nextValue);
    return this.controlValue;
  }

  private removeControlItem(item: AppMenuItem<TId, TContext>): unknown {
    if (!this.controlAttached || this.controlDisabled || this.isPassiveItem(item)) {
      return this.currentControlEventValue();
    }
    this.markControlTouched();
    const itemValue = this.itemControlValue(item);
    if (Array.isArray(this.controlValue)) {
      this.setControlValue(this.controlValue.filter(value => !this.controlValuesEqual(value, itemValue)));
      return this.controlValue;
    }
    if (this.controlValuesEqual(this.controlValue, itemValue)) {
      this.setControlValue(null);
    }
    return this.controlValue;
  }

  private nextControlValueForItem(item: AppMenuItem<TId, TContext>): unknown {
    const itemValue = this.itemControlValue(item);
    switch (item.kind ?? 'action') {
      case 'checkbox':
      case 'toggle':
        if (this.currentModelMaxSelected() === 1) {
          return this.isControlItemSelected(item) ? [] : [itemValue];
        }
        return this.toggleControlArrayValue(itemValue);
      default:
        return itemValue;
    }
  }

  private itemControlValue(item: AppMenuItem<TId, TContext>): unknown {
    return item.value !== undefined ? item.value : item.id;
  }

  private toggleControlArrayValue(itemValue: unknown): unknown[] {
    const values = Array.isArray(this.controlValue)
      ? [...this.controlValue]
      : this.controlValue === null || this.controlValue === undefined
        ? []
        : [this.controlValue];
    const existingIndex = values.findIndex(value => this.controlValuesEqual(value, itemValue));
    if (existingIndex >= 0) {
      values.splice(existingIndex, 1);
      return values;
    }
    return [...values, itemValue];
  }

  private setControlValue(value: unknown): void {
    if (this.controlValuesEqual(this.controlValue, value)) {
      return;
    }
    this.controlValue = value;
    this.onControlChange(value);
    this.changeDetectorRef.markForCheck();
  }

  private markControlTouched(): void {
    this.onControlTouched();
  }

  private isControlItemSelected(item: AppMenuItem<TId, TContext>): boolean {
    if (!this.controlAttached || this.isPassiveItem(item)) {
      return false;
    }
    const itemValue = this.itemControlValue(item);
    if (Array.isArray(this.controlValue)) {
      return this.controlValue.some(value => this.controlValuesEqual(value, itemValue));
    }
    return this.controlValuesEqual(this.controlValue, itemValue);
  }

  private controlValuesEqual(first: unknown, second: unknown): boolean {
    if (Array.isArray(first) && Array.isArray(second)) {
      return first.length === second.length
        && first.every((value, index) => this.controlValuesEqual(value, second[index]));
    }
    const valueKey = this.model?.valueKey ?? null;
    if (valueKey) {
      return Object.is(this.controlValueIdentity(first, valueKey), this.controlValueIdentity(second, valueKey));
    }
    return Object.is(first, second);
  }

  private controlValueIdentity(value: unknown, valueKey: AppMenuValueKey): unknown {
    if (typeof valueKey === 'function') {
      return valueKey(value);
    }
    if (value && typeof value === 'object' && valueKey in value) {
      return (value as Record<string, unknown>)[valueKey];
    }
    return value;
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
