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
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AppMenuComponent } from '../menu/menu.component';
import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuKind,
  AppMenuLayout,
  AppMenuModel,
  AppMenuPanelMode,
  AppMenuTrigger,
  AppMenuValueKey
} from '../menu/menu.types';
import { EditableImageCarouselComponent } from '../editable-image-carousel';
import { ProgressIndicatorComponent } from '../progress-indicator';
import { ImageCardComponent, InfoCardComponent } from '../card';
import type {
  FormFlowActionEvent,
  FormFlowControlModel,
  FormFlowDateControlConfig,
  FormFlowImageCarouselControlConfig,
  FormFlowMenuControlConfig,
  FormFlowModel,
  FormFlowSaveEvent,
  FormFlowStepModel
} from './form-flow.types';
import {
  formFlowCompletionPercent,
  formFlowIsControlMissingRequired,
  formFlowMissingRequiredControls
} from './form-flow.utils';

interface FormFlowSelectedMenuItem {
  item: AppMenuItem<string, unknown>;
  groupPalette?: AppMenuItem<string, unknown>['palette'];
}

@Component({
  selector: 'app-form-flow',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
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
  @Input() saving = false;
  @Input() disabled = false;

  @Output() readonly save = new EventEmitter<FormFlowSaveEvent>();
  @Output() readonly action = new EventEmitter<FormFlowActionEvent>();
  @Output() readonly percent = new EventEmitter<number>();

  protected pageIndex = 0;
  protected isMobileViewport = this.readViewportWidth() <= FormFlowComponent.MOBILE_BREAKPOINT_PX;
  private pendingPageIndex: number | null = null;
  private controlDisabled = false;
  private formValue: unknown = {};
  private readonly emptyStringArray: readonly string[] = [];
  private readonly stringArrayValueCache = new WeakMap<readonly unknown[], readonly string[]>();
  private readonly csvStringArrayValueCache = new Map<string, readonly string[]>();
  private readonly dateValueCache = new Map<string, Date>();
  private readonly menuTriggerCache = new WeakMap<FormFlowControlModel, { signature: string; trigger: AppMenuTrigger | null }>();
  private onControlChange: (value: unknown) => void = () => undefined;
  private onControlTouched: () => void = () => undefined;
  private viewportScrollLockTargetIndex: number | null = null;
  private viewportScrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmittedPercent: number | null = null;
  private pendingPercent: number | null = null;
  private percentEmitQueued = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.pageIndex = this.clampPageIndex(this.pageIndex);
      this.pendingPageIndex = null;
      this.queueViewportSync('auto');
      this.queuePercentEmit();
    }
  }

  ngOnDestroy(): void {
    this.clearViewportScrollLock();
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    const wasMobile = this.isMobileViewport;
    this.isMobileViewport = this.readViewportWidth() <= FormFlowComponent.MOBILE_BREAKPOINT_PX;
    if (wasMobile !== this.isMobileViewport) {
      this.clearViewportScrollLock();
      this.resetViewportScroll();
    }
    this.queueViewportSync('auto');
    this.cdr.markForCheck();
  }

  writeValue(value: unknown): void {
    this.formValue = value ?? {};
    this.pageIndex = this.clampPageIndex(this.pageIndex);
    this.queueViewportSync('auto');
    this.queuePercentEmit();
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
    if (this.isGroupedLayout()) {
      return false;
    }
    const model = this.model;
    if (!model || model.steps.length === 0) {
      return false;
    }
    return model.summary?.enabled !== false;
  }

  protected isCarouselLayout(): boolean {
    return this.model?.layout === 'carousel';
  }

  protected isGroupedLayout(): boolean {
    return this.model?.layout === 'grouped';
  }

  protected totalPageCount(): number {
    if (this.isGroupedLayout()) {
      return this.pages().length > 0 ? 1 : 0;
    }
    return this.pages().length + (this.hasSummaryPage() ? 1 : 0);
  }

  protected isSummaryPage(): boolean {
    return this.hasSummaryPage() && this.visiblePageIndex() >= this.pages().length;
  }

  protected activeStep(): FormFlowStepModel | null {
    if (this.isGroupedLayout()) {
      return null;
    }
    if (this.isSummaryPage()) {
      return null;
    }
    return this.pages()[this.visiblePageIndex()] ?? null;
  }

  protected activeTitle(): string {
    if (this.isGroupedLayout()) {
      return this.model?.title ?? '';
    }
    if (this.isSummaryPage()) {
      return this.model?.summary?.title?.trim() || 'Overview';
    }
    return this.activeStep()?.title ?? this.model?.title ?? '';
  }

  protected activeSubtitle(): string {
    if (this.isGroupedLayout()) {
      return this.model?.subtitle?.trim() || '';
    }
    if (this.isSummaryPage()) {
      return this.model?.summary?.subtitle?.trim() || '';
    }
    return this.activeStep()?.subtitle?.trim() || this.model?.subtitle?.trim() || '';
  }

  protected activeStepIcon(): string {
    if (this.isSummaryPage()) {
      return this.model?.summary?.icon?.trim() || 'fact_check';
    }
    return this.activeStep()?.icon?.trim() || 'dynamic_form';
  }

  protected activeStepHasCardHeader(): boolean {
    const header = this.activeStep()?.header ?? null;
    return !!(header?.imageCard || header?.infoCard);
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
    if (!this.model?.save) {
      return false;
    }
    if (this.isGroupedLayout()) {
      return this.totalPageCount() > 0;
    }
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
      && !this.saving
      && this.model?.save?.disabled !== true
      && this.showSaveAction()
      && this.totalMissingRequiredCount() === 0;
  }

  protected goToPage(index: number, sourceEvent?: Event): void {
    sourceEvent?.stopPropagation();
    if (this.isGroupedLayout()) {
      return;
    }
    const nextIndex = this.clampPageIndex(index);
    if (this.isForwardNavigationBlocked(nextIndex) || nextIndex === this.visiblePageIndex()) {
      return;
    }
    if (this.isCarouselLayout()) {
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
    const value = this.readPath(this.formValue, control.bind);
    return control.valueFormat === 'csv' ? this.csvStringArrayValue(value) : value;
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

  protected controlDateValue(control: FormFlowControlModel): Date | null {
    const value = this.controlTextValue(control).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const cached = this.dateValueCache.get(value);
    if (cached) {
      return cached;
    }
    const [year, month, day] = value.split('-').map(part => Number(part));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const parsed = new Date(year, month - 1, day);
    if (!Number.isFinite(parsed.getTime())) {
      return null;
    }
    this.dateValueCache.set(value, parsed);
    return parsed;
  }

  protected controlDateLabel(control: FormFlowControlModel): string {
    const value = this.controlDateValue(control);
    if (!value) {
      return control.placeholder || 'Select date';
    }
    return value.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected controlStringArrayValue(control: FormFlowControlModel): readonly string[] {
    const value = this.controlValue(control);
    if (!Array.isArray(value)) {
      return this.emptyStringArray;
    }
    if (value.every(item => typeof item === 'string')) {
      return value as readonly string[];
    }
    const cached = this.stringArrayValueCache.get(value);
    if (cached) {
      return cached;
    }
    const normalized = value.map(item => `${item ?? ''}`).filter(item => item.trim().length > 0);
    this.stringArrayValueCache.set(value, normalized);
    return normalized;
  }

  protected updateControlValue(control: FormFlowControlModel, value: unknown): void {
    if (this.isControlDisabled(control)) {
      return;
    }
    const nextValue = control.valueFormat === 'csv' ? this.csvStringValue(value) : value;
    this.formValue = this.writePath(this.formValue, control.bind, nextValue);
    this.onControlChange(this.formValue);
    this.onControlTouched();
    this.queuePercentEmit();
    this.cdr.markForCheck();
  }

  protected updateDateControlValue(control: FormFlowControlModel, value: Date | string | null): void {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      const year = value.getFullYear();
      const month = `${value.getMonth() + 1}`.padStart(2, '0');
      const day = `${value.getDate()}`.padStart(2, '0');
      this.updateControlValue(control, `${year}-${month}-${day}`);
      return;
    }
    this.updateControlValue(control, '');
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
    return this.menuTriggerForControl(control, this.menuConfig(control).trigger ?? null);
  }

  protected menuModel(control: FormFlowControlModel): AppMenuModel<string, unknown> | null {
    return this.menuConfig(control).model ?? null;
  }

  protected menuItems(control: FormFlowControlModel): readonly AppMenuItem<string, unknown>[] {
    return this.menuConfig(control).items ?? [];
  }

  protected accessoryMenuConfig(control: FormFlowControlModel): FormFlowMenuControlConfig | null {
    return this.isMenuControlConfig(control.accessory?.menu) ? control.accessory.menu : null;
  }

  protected accessoryMenuKind(control: FormFlowControlModel): AppMenuKind {
    return this.accessoryMenuConfig(control)?.kind ?? 'inline';
  }

  protected accessoryMenuLayout(control: FormFlowControlModel): AppMenuLayout {
    return this.accessoryMenuConfig(control)?.layout ?? 'row';
  }

  protected accessoryMenuPanelMode(control: FormFlowControlModel): AppMenuPanelMode {
    return this.accessoryMenuConfig(control)?.panelMode ?? 'auto';
  }

  protected accessoryMenuTitle(control: FormFlowControlModel): string | null {
    return this.accessoryMenuConfig(control)?.title ?? null;
  }

  protected accessoryMenuTrigger(control: FormFlowControlModel): AppMenuTrigger | null {
    return this.accessoryMenuConfig(control)?.trigger ?? null;
  }

  protected accessoryMenuModel(control: FormFlowControlModel): AppMenuModel<string, unknown> | null {
    return this.accessoryMenuConfig(control)?.model ?? null;
  }

  protected accessoryMenuItems(control: FormFlowControlModel): readonly AppMenuItem<string, unknown>[] {
    return this.accessoryMenuConfig(control)?.items ?? [];
  }

  protected accessoryMenuCloseOnSelect(control: FormFlowControlModel): boolean {
    return this.accessoryMenuConfig(control)?.closeOnSelect !== false;
  }

  protected emitControlAction(
    control: FormFlowControlModel,
    selectEvent: AppMenuItemSelectEvent<string, unknown>
  ): void {
    this.action.emit({
      control,
      value: this.controlValue(control),
      context: selectEvent.context,
      sourceEvent: selectEvent
    });
  }

  private queuePercentEmit(): void {
    const nextPercent = formFlowCompletionPercent(this.model, this.formValue);
    if (nextPercent === this.lastEmittedPercent && this.pendingPercent === null) {
      return;
    }
    this.pendingPercent = nextPercent;
    if (this.percentEmitQueued) {
      return;
    }
    this.percentEmitQueued = true;
    queueMicrotask(() => {
      this.percentEmitQueued = false;
      const percent = this.pendingPercent;
      this.pendingPercent = null;
      if (percent === null || percent === this.lastEmittedPercent) {
        return;
      }
      this.lastEmittedPercent = percent;
      this.percent.emit(percent);
    });
  }

  protected imageConfig(control: FormFlowControlModel): FormFlowImageCarouselControlConfig {
    return this.isImageCarouselControlConfig(control.config) ? control.config : {};
  }

  protected dateConfig(control: FormFlowControlModel): FormFlowDateControlConfig {
    return this.isDateControlConfig(control.config) ? control.config : {};
  }

  protected hasDateMeta(control: FormFlowControlModel): boolean {
    return this.dateConfig(control).meta !== undefined && this.dateConfig(control).meta !== null;
  }

  protected dateMetaLabel(control: FormFlowControlModel): string {
    return this.dateConfig(control).meta?.label?.trim() || '';
  }

  protected dateMetaValue(control: FormFlowControlModel): string {
    const meta = this.dateConfig(control).meta;
    const value = meta?.value?.(this.formValue, control);
    if (value === null || value === undefined || `${value}`.trim().length === 0) {
      return meta?.emptyLabel?.trim() || '';
    }
    return `${value}`;
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
      const arrayLabel = value.map(item => `${item ?? ''}`.trim()).filter(Boolean).join(', ');
      return arrayLabel || control.summary?.emptyLabel?.trim() || this.summaryEmptyLabel();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
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
    if (this.isGroupedLayout()) {
      return true;
    }
    return this.visiblePageIndex() === index;
  }

  protected isStepMissingRequired(step: FormFlowStepModel): boolean {
    return this.stepMissingRequiredCount(step) > 0;
  }

  protected currentPageMissingRequired(): boolean {
    if (this.isGroupedLayout()) {
      return this.totalMissingRequiredCount() > 0;
    }
    const step = this.activeStep();
    return step ? this.isStepMissingRequired(step) : this.totalMissingRequiredCount() > 0;
  }

  protected currentMissingRequiredCount(): number {
    if (this.isGroupedLayout()) {
      return this.totalMissingRequiredCount();
    }
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
    if (this.isGroupedLayout()) {
      return false;
    }
    const currentIndex = this.visiblePageIndex();
    return currentIndex < this.totalPageCount() - 1 && this.isForwardNavigationBlocked(currentIndex + 1);
  }

  protected pageTrackTransform(): string | null {
    if (this.isGroupedLayout()) {
      return null;
    }
    return this.isCarouselLayout() || this.isMobileViewport ? null : `translate3d(-${this.pageIndex * 100}%, 0, 0)`;
  }

  protected onFlowViewportScroll(): void {
    if (this.isGroupedLayout()) {
      return;
    }
    if (!this.isCarouselLayout() && !this.isMobileViewport) {
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
    if (nextIndex === this.pageIndex) {
      return;
    }
    this.pendingPageIndex = null;
    this.setPageIndex(nextIndex);
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
    if (this.isGroupedLayout()) {
      return false;
    }
    return targetIndex > this.visiblePageIndex() && this.currentPageMissingRequired();
  }

  private stepMissingRequiredCount(step: FormFlowStepModel): number {
    return formFlowMissingRequiredControls({
      title: '',
      steps: [step]
    }, this.formValue).length;
  }

  private isControlMissingRequired(control: FormFlowControlModel): boolean {
    return formFlowIsControlMissingRequired(control, this.formValue);
  }

  private readPath(source: unknown, path: FormFlowControlModel['bind']): unknown {
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

  private writePath(source: unknown, path: FormFlowControlModel['bind'], value: unknown): unknown {
    const segments = this.normalizePath(path);
    if (segments.length === 0) {
      return value;
    }
    return this.writePathAt(source, segments, value, 0);
  }

  private writePathAt(source: unknown, segments: readonly (string | number)[], value: unknown, index: number): unknown {
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

  private normalizePath(path: FormFlowControlModel['bind']): Array<string | number> {
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

  private csvStringArrayValue(value: unknown): readonly string[] {
    if (Array.isArray(value)) {
      return value.map(item => `${item ?? ''}`.trim()).filter(Boolean);
    }
    const textValue = `${value ?? ''}`;
    const cached = this.csvStringArrayValueCache.get(textValue);
    if (cached) {
      return cached;
    }
    const normalized = textValue
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    this.csvStringArrayValueCache.set(textValue, normalized);
    return normalized;
  }

  private csvStringValue(value: unknown): string {
    return this.csvStringArrayValue(value).join(', ');
  }

  private menuTriggerForControl(control: FormFlowControlModel, trigger: AppMenuTrigger | null): AppMenuTrigger | null {
    if (!trigger || trigger.action === 'custom') {
      return trigger;
    }
    const selectedItems = this.selectedMenuItems(control);
    const baseLabel = this.resolveMenuText(trigger.label);
    const selectedLabels = selectedItems
      .map(selected => this.resolveMenuText(selected.item.label))
      .filter(Boolean);
    const selectedIcon = selectedItems.length === 1 ? this.resolveMenuText(selectedItems[0].item.icon) : '';
    const selectedPalette = selectedItems[0]?.item.palette ?? selectedItems[0]?.groupPalette ?? null;
    const baseLabelIsItemLabel = baseLabel
      ? this.menuItemLabels(control).has(this.normalizeMenuText(baseLabel))
      : false;
    const signature = [
      this.controlValueSignature(this.controlValue(control)),
      baseLabel,
      selectedLabels.join('|'),
      selectedIcon,
      selectedPalette ?? '',
      baseLabelIsItemLabel ? 'item-label' : 'base-label'
    ].join('\u0001');
    const cached = this.menuTriggerCache.get(control);
    if (cached?.signature === signature) {
      return cached.trigger;
    }
    const nextTrigger: AppMenuTrigger = { ...trigger };
    if (selectedLabels.length > 0 && baseLabel) {
      nextTrigger.label = selectedLabels.join(', ');
    } else if (selectedLabels.length === 0 && baseLabelIsItemLabel) {
      nextTrigger.label = undefined;
    }
    if (selectedIcon) {
      nextTrigger.icon = selectedIcon;
    }
    if (selectedPalette) {
      nextTrigger.palette = selectedPalette;
    }
    this.menuTriggerCache.set(control, {
      signature,
      trigger: nextTrigger
    });
    return nextTrigger;
  }

  private selectedMenuItems(control: FormFlowControlModel): FormFlowSelectedMenuItem[] {
    const value = this.controlValue(control);
    const valueKey = this.menuModel(control)?.valueKey ?? null;
    return this.flattenMenuItemsWithGroupPalette(control)
      .filter(selected => this.isMenuItemSelectedByValue(selected.item, value, valueKey));
  }

  private menuItemLabels(control: FormFlowControlModel): Set<string> {
    return new Set(
      this.flattenMenuItemsWithGroupPalette(control)
        .map(selected => this.normalizeMenuText(this.resolveMenuText(selected.item.label)))
        .filter(Boolean)
    );
  }

  private flattenMenuItemsWithGroupPalette(control: FormFlowControlModel): FormFlowSelectedMenuItem[] {
    const config = this.menuConfig(control);
    const items: FormFlowSelectedMenuItem[] = [];
    const visit = (item: AppMenuItem<string, unknown>, groupPalette?: AppMenuItem<string, unknown>['palette']): void => {
      items.push({ item, groupPalette });
      for (const child of item.items ?? []) {
        visit(child, groupPalette);
      }
      for (const group of item.model?.groups ?? []) {
        for (const child of group.items ?? []) {
          visit(child, group.palette);
        }
      }
      for (const group of item.model?.nodes ?? []) {
        for (const child of group.items ?? []) {
          visit(child, group.palette);
        }
      }
    };
    for (const item of config.items ?? []) {
      visit(item);
    }
    for (const group of config.model?.groups ?? []) {
      for (const item of group.items ?? []) {
        visit(item, group.palette);
      }
    }
    for (const group of config.model?.nodes ?? []) {
      for (const item of group.items ?? []) {
        visit(item, group.palette);
      }
    }
    return items.filter(selected => {
      const kind = selected.item.kind ?? 'action';
      return kind !== 'divider' && kind !== 'section';
    });
  }

  private isMenuItemSelectedByValue(
    item: AppMenuItem<string, unknown>,
    selectedValue: unknown,
    valueKey: AppMenuValueKey | null
  ): boolean {
    const itemValue = item.value !== undefined ? item.value : item.id;
    if (Array.isArray(selectedValue)) {
      return selectedValue.some(value => this.menuValuesEqual(value, itemValue, valueKey));
    }
    return this.menuValuesEqual(selectedValue, itemValue, valueKey);
  }

  private menuValuesEqual(first: unknown, second: unknown, valueKey: AppMenuValueKey | null): boolean {
    if (!valueKey) {
      return Object.is(first, second);
    }
    return Object.is(this.menuValueIdentity(first, valueKey), this.menuValueIdentity(second, valueKey));
  }

  private menuValueIdentity(value: unknown, valueKey: AppMenuValueKey): unknown {
    if (typeof valueKey === 'function') {
      return valueKey(value);
    }
    if (value && typeof value === 'object' && valueKey in value) {
      return (value as Record<string, unknown>)[valueKey];
    }
    return value;
  }

  private resolveMenuText(value: unknown): string {
    const resolved = typeof value === 'function' ? (value as () => unknown)() : value;
    return `${resolved ?? ''}`.trim();
  }

  private normalizeMenuText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private controlValueSignature(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map(item => this.controlValueSignature(item)).join('|');
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return `${value ?? ''}`;
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

  private isDateControlConfig(config: FormFlowControlModel['config']): config is FormFlowDateControlConfig {
    return this.isRecord(config) && 'meta' in config;
  }

  private queueViewportSync(behavior: ScrollBehavior, targetIndex = this.visiblePageIndex()): void {
    if (this.isGroupedLayout()) {
      this.clearViewportScrollLock();
      this.resetViewportScroll();
      return;
    }
    if (!this.isCarouselLayout() && !this.isMobileViewport) {
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

  private readViewportWidth(): number {
    return typeof globalThis.window === 'undefined' ? 1024 : globalThis.window.innerWidth;
  }
}
