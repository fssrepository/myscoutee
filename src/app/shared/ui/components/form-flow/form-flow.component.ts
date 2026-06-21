import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  forwardRef,
  inject
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuKind,
  type AppMenuLayout,
  type AppMenuModel,
  type AppMenuPanelMode,
  type AppMenuTrigger
} from '../menu';
import { EditableImageCarouselComponent } from '../editable-image-carousel';
import { ProgressIndicatorComponent } from '../progress-indicator';
import { ImageCardComponent, InfoCardComponent } from '../card';
import type {
  FormFlowControlModel,
  FormFlowImageCarouselControlConfig,
  FormFlowMenuControlConfig,
  FormFlowModel,
  FormFlowPath,
  FormFlowPathSegment,
  FormFlowSaveEvent,
  FormFlowStepModel
} from './form-flow.types';

@Component({
  selector: 'app-form-flow',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    EditableImageCarouselComponent,
    ProgressIndicatorComponent,
    ImageCardComponent,
    InfoCardComponent
  ],
  templateUrl: './form-flow.component.html',
  styleUrl: './form-flow.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormFlowComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormFlowComponent implements ControlValueAccessor, OnChanges, OnDestroy {
  private static readonly MOBILE_BREAKPOINT_PX = 720;

  @ViewChild('flowViewport')
  private flowViewportRef?: ElementRef<HTMLDivElement>;

  private readonly cdr = inject(ChangeDetectorRef);

  @Input() model: FormFlowModel | null = null;
  @Input() loading = false;
  @Input() disabled = false;

  @Output() readonly save = new EventEmitter<FormFlowSaveEvent>();

  protected pageIndex = 0;
  protected isMobileViewport = this.readViewportWidth() <= FormFlowComponent.MOBILE_BREAKPOINT_PX;
  private pendingPageIndex: number | null = null;
  private controlDisabled = false;
  private formValue: unknown = {};
  private onControlChange: (value: unknown) => void = () => undefined;
  private onControlTouched: () => void = () => undefined;
  private viewportScrollLockTargetIndex: number | null = null;
  private viewportScrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private surfaceSwipePointerId: number | null = null;
  private surfaceSwipeStartX = 0;
  private surfaceSwipeStartY = 0;
  private surfaceSwipeStartScrollLeft = 0;
  private surfaceSwipeActive = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.pageIndex = this.clampPageIndex(this.pageIndex);
      this.pendingPageIndex = null;
      this.queueViewportSync('auto');
    }
  }

  ngOnDestroy(): void {
    this.clearViewportScrollLock();
    this.resetSurfaceSwipe();
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    const wasMobile = this.isMobileViewport;
    this.isMobileViewport = this.readViewportWidth() <= FormFlowComponent.MOBILE_BREAKPOINT_PX;
    if (wasMobile !== this.isMobileViewport) {
      this.clearViewportScrollLock();
      this.resetSurfaceSwipe();
      this.resetViewportScroll();
    }
    this.queueViewportSync('auto');
    this.cdr.markForCheck();
  }

  writeValue(value: unknown): void {
    this.formValue = value ?? {};
    this.pageIndex = this.clampPageIndex(this.pageIndex);
    this.queueViewportSync('auto');
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onControlChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onControlTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected isDisabled(): boolean {
    return this.disabled || this.controlDisabled;
  }

  protected pages(): readonly FormFlowStepModel[] {
    return this.model?.steps ?? [];
  }

  protected hasSummaryPage(): boolean {
    const model = this.model;
    if (!model || model.steps.length === 0) {
      return false;
    }
    return model.summary?.enabled !== false;
  }

  protected isCarouselLayout(): boolean {
    return this.model?.layout === 'carousel';
  }

  protected totalPageCount(): number {
    return this.pages().length + (this.hasSummaryPage() ? 1 : 0);
  }

  protected isSummaryPage(): boolean {
    return this.hasSummaryPage() && this.visiblePageIndex() >= this.pages().length;
  }

  protected activeStep(): FormFlowStepModel | null {
    if (this.isSummaryPage()) {
      return null;
    }
    return this.pages()[this.visiblePageIndex()] ?? null;
  }

  protected activeTitle(): string {
    if (this.isSummaryPage()) {
      return this.model?.summary?.title?.trim() || 'Overview';
    }
    return this.activeStep()?.title ?? this.model?.title ?? '';
  }

  protected activeSubtitle(): string {
    if (this.isSummaryPage()) {
      return this.model?.summary?.subtitle?.trim() || '';
    }
    return this.activeStep()?.subtitle?.trim() || this.model?.subtitle?.trim() || '';
  }

  protected pageCounterLabel(): string {
    const total = this.totalPageCount();
    return total > 0 ? `${this.visiblePageIndex() + 1} / ${total}` : '0 / 0';
  }

  protected progressPercent(): number {
    const total = this.totalPageCount();
    if (total <= 1) {
      return 100;
    }
    return Math.round(((this.visiblePageIndex() + 1) / total) * 100);
  }

  protected showSaveAction(): boolean {
    return this.totalPageCount() > 0 && this.visiblePageIndex() === this.totalPageCount() - 1;
  }

  protected saveLabel(): string {
    return this.model?.save?.label?.trim() || 'Save';
  }

  protected saveIcon(): string {
    return this.model?.save?.icon?.trim() || 'check';
  }

  protected saveAriaLabel(): string {
    return this.model?.save?.ariaLabel?.trim() || this.saveLabel();
  }

  protected canSave(): boolean {
    return !this.isDisabled()
      && this.model?.save?.disabled !== true
      && this.showSaveAction()
      && this.totalMissingRequiredCount() === 0;
  }

  protected goToPage(index: number, sourceEvent?: Event): void {
    sourceEvent?.stopPropagation();
    const nextIndex = this.clampPageIndex(index);
    if (this.isForwardNavigationBlocked(nextIndex) || nextIndex === this.visiblePageIndex()) {
      return;
    }
    if (this.isMobileViewport) {
      this.queueViewportSync('smooth', nextIndex);
      return;
    }
    this.setPageIndex(nextIndex);
  }

  protected goPrevious(sourceEvent?: Event): void {
    this.goToPage(this.pageIndex - 1, sourceEvent);
  }

  protected goNext(sourceEvent?: Event): void {
    this.goToPage(this.visiblePageIndex() + 1, sourceEvent);
  }

  protected emitSave(sourceEvent?: Event): void {
    sourceEvent?.stopPropagation();
    if (!this.canSave()) {
      return;
    }
    this.onControlTouched();
    this.save.emit({
      value: this.formValue,
      stepId: this.activeStep()?.id ?? 'summary',
      stepIndex: this.visiblePageIndex(),
      sourceEvent
    });
  }

  protected controlValue(control: FormFlowControlModel): unknown {
    return this.readPath(this.formValue, control.bind);
  }

  protected controlTextValue(control: FormFlowControlModel): string {
    const value = this.controlValue(control);
    return typeof value === 'string' ? value : `${value ?? ''}`;
  }

  protected controlNumberValue(control: FormFlowControlModel): number | null {
    const value = this.controlValue(control);
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  protected controlStringArrayValue(control: FormFlowControlModel): readonly string[] {
    const value = this.controlValue(control);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(item => `${item ?? ''}`).filter(item => item.trim().length > 0);
  }

  protected updateControlValue(control: FormFlowControlModel, value: unknown): void {
    if (this.isControlDisabled(control)) {
      return;
    }
    this.formValue = this.writePath(this.formValue, control.bind, value);
    this.onControlChange(this.formValue);
    this.onControlTouched();
    this.cdr.markForCheck();
  }

  protected isControlDisabled(control: FormFlowControlModel): boolean {
    return this.isDisabled() || control.disabled === true;
  }

  protected inputType(control: FormFlowControlModel): string {
    return control.kind === 'date' ? 'date' : control.kind === 'number' ? 'number' : 'text';
  }

  protected menuConfig(control: FormFlowControlModel): FormFlowMenuControlConfig {
    return this.isMenuControlConfig(control.config) ? control.config : {};
  }

  protected menuKind(control: FormFlowControlModel): AppMenuKind {
    return this.menuConfig(control).kind ?? 'inline';
  }

  protected menuLayout(control: FormFlowControlModel): AppMenuLayout {
    return this.menuConfig(control).layout ?? 'row';
  }

  protected menuPanelMode(control: FormFlowControlModel): AppMenuPanelMode {
    return this.menuConfig(control).panelMode ?? 'auto';
  }

  protected menuTitle(control: FormFlowControlModel): string | null {
    return this.menuConfig(control).title ?? null;
  }

  protected menuFilterable(control: FormFlowControlModel): boolean {
    return this.menuConfig(control).filterable === true;
  }

  protected menuCloseOnSelect(control: FormFlowControlModel): boolean {
    return this.menuConfig(control).closeOnSelect !== false;
  }

  protected menuTrigger(control: FormFlowControlModel): AppMenuTrigger | null {
    return this.menuConfig(control).trigger ?? null;
  }

  protected menuModel(control: FormFlowControlModel): AppMenuModel<string, unknown> | null {
    return this.menuConfig(control).model ?? null;
  }

  protected menuItems(control: FormFlowControlModel): readonly AppMenuItem<string, unknown>[] {
    return this.menuConfig(control).items ?? [];
  }

  protected imageConfig(control: FormFlowControlModel): FormFlowImageCarouselControlConfig {
    return this.isImageCarouselControlConfig(control.config) ? control.config : {};
  }

  protected summaryTitle(): string {
    return this.model?.summary?.title?.trim() || 'Overview';
  }

  protected summaryEmptyLabel(): string {
    return this.model?.summary?.emptyLabel?.trim() || 'Not set';
  }

  protected summaryControls(step: FormFlowStepModel): readonly FormFlowControlModel[] {
    return step.controls.filter(control => {
      if (control.summary?.hidden === true || control.kind === 'section') {
        return false;
      }
      if (this.model?.summary?.includeEmpty === true) {
        return true;
      }
      return this.summaryValue(control).length > 0;
    });
  }

  protected summaryLabel(control: FormFlowControlModel): string {
    return control.summary?.label?.trim() || control.label?.trim() || control.id;
  }

  protected summaryValue(control: FormFlowControlModel): string {
    const explicitValue = control.summary?.value?.(this.formValue, control);
    const value = explicitValue === undefined ? this.controlValue(control) : explicitValue;
    const labels = control.kind === 'menu' ? this.menuSelectionLabels(control, value) : [];
    if (labels.length > 0) {
      return labels.join(', ');
    }
    if (Array.isArray(value)) {
      return value.map(item => `${item ?? ''}`.trim()).filter(Boolean).join(', ');
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (value === null || value === undefined || value === '') {
      return control.summary?.emptyLabel?.trim() || this.summaryEmptyLabel();
    }
    return `${value}`;
  }

  protected isSummaryValueEmpty(control: FormFlowControlModel): boolean {
    const value = this.summaryValue(control);
    return value.length === 0 || value === this.summaryEmptyLabel() || value === control.summary?.emptyLabel;
  }

  protected visiblePageIndex(): number {
    return this.clampPageIndex(this.pendingPageIndex ?? this.pageIndex);
  }

  protected isPageActive(index: number): boolean {
    return this.visiblePageIndex() === index;
  }

  protected isStepMissingRequired(step: FormFlowStepModel): boolean {
    return this.stepMissingRequiredCount(step) > 0;
  }

  protected currentPageMissingRequired(): boolean {
    const step = this.activeStep();
    return step ? this.isStepMissingRequired(step) : this.totalMissingRequiredCount() > 0;
  }

  protected currentMissingRequiredCount(): number {
    const step = this.activeStep();
    return step ? this.stepMissingRequiredCount(step) : this.totalMissingRequiredCount();
  }

  protected isRequiredControlMissing(control: FormFlowControlModel): boolean {
    return this.isControlMissingRequired(control);
  }

  protected totalMissingRequiredCount(): number {
    return this.pages().reduce((total, step) => total + this.stepMissingRequiredCount(step), 0);
  }

  protected nextStepBlocked(): boolean {
    const currentIndex = this.visiblePageIndex();
    return currentIndex < this.totalPageCount() - 1 && this.isForwardNavigationBlocked(currentIndex + 1);
  }

  protected pageTrackTransform(): string | null {
    return this.isMobileViewport ? null : `translate3d(-${this.pageIndex * 100}%, 0, 0)`;
  }

  protected onFlowViewportScroll(): void {
    if (!this.isMobileViewport) {
      return;
    }
    const viewport = this.flowViewportRef?.nativeElement;
    if (!viewport) {
      return;
    }
    if (this.viewportScrollLockTargetIndex !== null) {
      this.scheduleViewportScrollLockRelease();
      return;
    }
    const nextIndex = this.currentMobilePageIndex(viewport);
    if (this.isForwardNavigationBlocked(nextIndex)) {
      this.queueViewportSync('smooth', this.pageIndex);
      return;
    }
    if (nextIndex === this.pageIndex) {
      return;
    }
    this.pendingPageIndex = null;
    this.setPageIndex(nextIndex);
  }

  protected beginSurfaceSwipe(event: PointerEvent): void {
    if (!this.isMobileViewport || event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (this.isInteractiveSwipeTarget(event.target)) {
      return;
    }
    const viewport = this.flowViewportRef?.nativeElement;
    if (!viewport) {
      return;
    }
    this.surfaceSwipePointerId = event.pointerId;
    this.surfaceSwipeStartX = event.clientX;
    this.surfaceSwipeStartY = event.clientY;
    this.surfaceSwipeStartScrollLeft = viewport.scrollLeft;
    this.surfaceSwipeActive = false;
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  protected moveSurfaceSwipe(event: PointerEvent): void {
    if (this.surfaceSwipePointerId !== event.pointerId) {
      return;
    }
    const viewport = this.flowViewportRef?.nativeElement;
    if (!viewport) {
      this.resetSurfaceSwipe();
      return;
    }
    const deltaX = event.clientX - this.surfaceSwipeStartX;
    const deltaY = event.clientY - this.surfaceSwipeStartY;
    if (!this.surfaceSwipeActive) {
      if (Math.abs(deltaX) < 10 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }
      this.surfaceSwipeActive = true;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    viewport.scrollLeft = this.surfaceSwipeStartScrollLeft - deltaX;
  }

  protected endSurfaceSwipe(event: PointerEvent): void {
    if (this.surfaceSwipePointerId !== event.pointerId) {
      return;
    }
    const viewport = this.flowViewportRef?.nativeElement;
    const wasActive = this.surfaceSwipeActive;
    this.resetSurfaceSwipe();
    if (!viewport || !wasActive) {
      return;
    }
    const nextIndex = this.currentMobilePageIndex(viewport);
    if (this.isForwardNavigationBlocked(nextIndex)) {
      this.queueViewportSync('smooth', this.pageIndex);
      return;
    }
    this.queueViewportSync('smooth', nextIndex);
  }

  protected cancelSurfaceSwipe(event: PointerEvent): void {
    if (this.surfaceSwipePointerId !== event.pointerId) {
      return;
    }
    this.resetSurfaceSwipe();
  }

  protected trackByStepId(_index: number, step: FormFlowStepModel): string {
    return step.id;
  }

  protected trackByControlId(_index: number, control: FormFlowControlModel): string {
    return control.id;
  }

  private clampPageIndex(index: number): number {
    const total = this.totalPageCount();
    if (total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(total - 1, Math.trunc(index)));
  }

  private setPageIndex(index: number): void {
    const nextIndex = this.clampPageIndex(index);
    if (nextIndex === this.pageIndex && this.pendingPageIndex === null) {
      return;
    }
    this.pageIndex = nextIndex;
    this.pendingPageIndex = null;
    this.onControlTouched();
    this.cdr.markForCheck();
  }

  protected isForwardNavigationBlocked(targetIndex: number): boolean {
    return targetIndex > this.visiblePageIndex() && this.currentPageMissingRequired();
  }

  private stepMissingRequiredCount(step: FormFlowStepModel): number {
    return step.controls.reduce((count, control) => count + (this.isControlMissingRequired(control) ? 1 : 0), 0);
  }

  private isControlMissingRequired(control: FormFlowControlModel): boolean {
    return control.required === true
      && this.normalizePath(control.bind).length > 0
      && !this.hasRequiredValue(this.controlValue(control));
  }

  private hasRequiredValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (typeof value === 'boolean') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.some(item => this.hasRequiredValue(item));
    }
    if (this.isRecord(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  private readPath(source: unknown, path: FormFlowPath | undefined): unknown {
    const segments = this.normalizePath(path);
    if (segments.length === 0) {
      return source;
    }
    let current = source;
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current) && typeof segment === 'number') {
        current = current[segment];
        continue;
      }
      if (this.isRecord(current)) {
        current = current[String(segment)];
        continue;
      }
      return undefined;
    }
    return current;
  }

  private writePath(source: unknown, path: FormFlowPath | undefined, value: unknown): unknown {
    const segments = this.normalizePath(path);
    if (segments.length === 0) {
      return value;
    }
    return this.writePathAt(source, segments, value, 0);
  }

  private writePathAt(source: unknown, segments: readonly FormFlowPathSegment[], value: unknown, index: number): unknown {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    const clone: Record<string, unknown> | unknown[] = Array.isArray(source)
      ? [...source]
      : this.isRecord(source)
        ? { ...source }
        : typeof segment === 'number'
          ? []
          : {};
    if (isLast) {
      if (Array.isArray(clone) && typeof segment === 'number') {
        clone[segment] = value;
      } else {
        (clone as Record<string, unknown>)[String(segment)] = value;
      }
      return clone;
    }
    const currentChild = Array.isArray(clone) && typeof segment === 'number'
      ? clone[segment]
      : (clone as Record<string, unknown>)[String(segment)];
    const nextChild = this.writePathAt(currentChild, segments, value, index + 1);
    if (Array.isArray(clone) && typeof segment === 'number') {
      clone[segment] = nextChild;
    } else {
      (clone as Record<string, unknown>)[String(segment)] = nextChild;
    }
    return clone;
  }

  private normalizePath(path: FormFlowPath | undefined): FormFlowPathSegment[] {
    if (!path) {
      return [];
    }
    if (typeof path !== 'string') {
      return path.map(segment => typeof segment === 'number' ? segment : `${segment}`.trim()).filter(segment => segment !== '');
    }
    return path
      .replace(/\[(\d+)]/g, '.$1')
      .split('.')
      .map(segment => segment.trim())
      .filter(Boolean)
      .map(segment => /^\d+$/.test(segment) ? Number(segment) : segment);
  }

  private menuSelectionLabels(control: FormFlowControlModel, value: unknown): string[] {
    const selectedValues = Array.isArray(value) ? value.map(item => `${item}`) : [`${value ?? ''}`];
    const selectedSet = new Set(selectedValues.filter(item => item.trim().length > 0));
    if (selectedSet.size === 0) {
      return [];
    }
    return this.flattenMenuItems(control).filter(item => {
      const itemValue = item.value === undefined ? item.id : item.value;
      return selectedSet.has(`${itemValue}`);
    }).map(item => this.resolveMenuLabel(item)).filter(label => label.length > 0);
  }

  private flattenMenuItems(control: FormFlowControlModel): AppMenuItem<string, unknown>[] {
    const config = this.menuConfig(control);
    const items: AppMenuItem<string, unknown>[] = [...(config.items ?? [])];
    for (const group of config.model?.groups ?? []) {
      items.push(...(group.items ?? []));
    }
    for (const group of config.model?.nodes ?? []) {
      items.push(...(group.items ?? []));
    }
    const flattened: AppMenuItem<string, unknown>[] = [];
    const visit = (item: AppMenuItem<string, unknown>): void => {
      flattened.push(item);
      for (const child of item.items ?? []) {
        visit(child);
      }
      for (const group of item.model?.groups ?? []) {
        for (const child of group.items ?? []) {
          visit(child);
        }
      }
      for (const group of item.model?.nodes ?? []) {
        for (const child of group.items ?? []) {
          visit(child);
        }
      }
    };
    for (const item of items) {
      visit(item);
    }
    return flattened;
  }

  private resolveMenuLabel(item: AppMenuItem<string, unknown>): string {
    const label = item.label;
    if (typeof label === 'function') {
      return `${label() ?? ''}`;
    }
    if (label && typeof label === 'object' && 'asReadonly' in label) {
      return '';
    }
    return `${label ?? item.id}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isMenuControlConfig(config: FormFlowControlModel['config']): config is FormFlowMenuControlConfig {
    return this.isRecord(config) && ('model' in config || 'items' in config || 'trigger' in config || 'filterable' in config);
  }

  private isImageCarouselControlConfig(config: FormFlowControlModel['config']): config is FormFlowImageCarouselControlConfig {
    return this.isRecord(config) && ('slotCount' in config || 'previewMode' in config || 'uploadOwnerId' in config);
  }

  private queueViewportSync(behavior: ScrollBehavior, targetIndex = this.visiblePageIndex()): void {
    if (!this.isMobileViewport) {
      this.clearViewportScrollLock();
      this.resetViewportScroll();
      return;
    }

    const normalizedTargetIndex = this.clampPageIndex(targetIndex);
    if (behavior === 'smooth' && normalizedTargetIndex !== this.pageIndex) {
      this.pendingPageIndex = normalizedTargetIndex;
      this.viewportScrollLockTargetIndex = normalizedTargetIndex;
      this.scheduleViewportScrollLockRelease();
    } else {
      this.pendingPageIndex = null;
      this.clearViewportScrollLock();
    }

    const sync = () => {
      const viewport = this.flowViewportRef?.nativeElement;
      if (!viewport) {
        return;
      }
      const targetLeft = this.mobilePageOffsetLeft(viewport, normalizedTargetIndex);
      if (targetLeft < 0) {
        return;
      }
      const previousScrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = behavior;
      viewport.scrollLeft = targetLeft;
      const restore = () => {
        viewport.style.scrollBehavior = previousScrollBehavior;
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => restore());
      } else {
        setTimeout(restore, 0);
      }
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(sync));
      return;
    }
    setTimeout(sync, 0);
  }

  private scheduleViewportScrollLockRelease(): void {
    if (this.viewportScrollLockTimer) {
      clearTimeout(this.viewportScrollLockTimer);
    }
    this.viewportScrollLockTimer = setTimeout(() => {
      this.viewportScrollLockTimer = null;
      const viewport = this.flowViewportRef?.nativeElement;
      const finalIndex = viewport ? this.currentMobilePageIndex(viewport) : this.viewportScrollLockTargetIndex;
      this.viewportScrollLockTargetIndex = null;
      if (finalIndex === null) {
        this.pendingPageIndex = null;
        this.cdr.markForCheck();
        return;
      }
      this.setPageIndex(finalIndex);
    }, 96);
  }

  private clearViewportScrollLock(): void {
    if (this.viewportScrollLockTimer) {
      clearTimeout(this.viewportScrollLockTimer);
      this.viewportScrollLockTimer = null;
    }
    this.viewportScrollLockTargetIndex = null;
    this.pendingPageIndex = null;
  }

  private resetViewportScroll(): void {
    const viewport = this.flowViewportRef?.nativeElement;
    if (viewport) {
      viewport.scrollLeft = 0;
    }
  }

  private resetSurfaceSwipe(): void {
    this.surfaceSwipePointerId = null;
    this.surfaceSwipeStartX = 0;
    this.surfaceSwipeStartY = 0;
    this.surfaceSwipeStartScrollLeft = 0;
    this.surfaceSwipeActive = false;
  }

  private currentMobilePageIndex(viewport: HTMLDivElement): number {
    const slides = Array.from(viewport.querySelectorAll<HTMLElement>('.form-flow__slide'));
    if (slides.length === 0) {
      return 0;
    }
    const currentLeft = viewport.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - currentLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return Math.max(0, Math.min(closestIndex, this.totalPageCount() - 1));
  }

  private mobilePageOffsetLeft(viewport: HTMLDivElement, index: number): number {
    const slides = Array.from(viewport.querySelectorAll<HTMLElement>('.form-flow__slide'));
    return slides[index]?.offsetLeft ?? -1;
  }

  private isInteractiveSwipeTarget(target: EventTarget | null): boolean {
    const element = target instanceof Element ? target : null;
    return !!element?.closest('button, a, input, textarea, select, [role="button"], app-menu, app-editable-image-carousel');
  }

  private readViewportWidth(): number {
    return typeof globalThis.window === 'undefined' ? 1024 : globalThis.window.innerWidth;
  }
}
