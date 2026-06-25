import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck, forwardRef, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';

import { AppUtils } from '../../../../../app-utils';
import { ActivityEventDetailDTO } from '../../../../../core/contracts/activity.interface';
import type * as ContractTypes from '../../../../../core/contracts';

export type EventSlotsInputConfigValue<TValue> = TValue | (() => TValue);
export type EventSlotsInputEditorMode = 'base' | 'date';

export interface EventSlotsInputConfig {
  startAtIso?: EventSlotsInputConfigValue<string | null | undefined>;
  endAtIso?: EventSlotsInputConfigValue<string | null | undefined>;
  frequency?: EventSlotsInputConfigValue<string | null | undefined>;
  generated?: EventSlotsInputConfigValue<boolean | null | undefined>;
  title?: EventSlotsInputConfigValue<string>;
  subtitle?: EventSlotsInputConfigValue<string>;
}

interface ResolvedEventSlotsInputConfig {
  startAtIso: string;
  endAtIso: string;
  frequency: string;
  enabled: boolean;
  generated: boolean;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-event-slots-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatTimepickerModule
  ],
  templateUrl: './event-slots-input.component.html',
  styleUrl: './event-slots-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventSlotsInputComponent),
      multi: true
    }
  ]
})
export class EventSlotsInputComponent implements OnChanges, DoCheck, ControlValueAccessor {
  @Input() config: EventSlotsInputConfig = {};
  @Input() readOnly = false;

  protected slotTemplates: ContractTypes.EventSlotTemplateDTO[] = [];
  protected slotEditorMode: EventSlotsInputEditorMode = 'base';
  protected showSlotsPopup = false;
  protected slotOverrideDateValue: Date | null = null;
  protected resolvedConfig: ResolvedEventSlotsInputConfig = this.resolveConfig();

  private resolvedConfigSignature = this.buildResolvedConfigSignature(this.resolvedConfig);
  private readonly slotDateControlValueCache = new Map<string, Date | null>();
  private onModelChange: (value: ContractTypes.EventSlotTemplateDTO[]) => void = () => {};
  private onModelTouched: () => void = () => {};

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.syncResolvedConfig();
      this.cdr.markForCheck();
    }
  }

  ngDoCheck(): void {
    this.syncResolvedConfig();
  }

  writeValue(value: readonly ContractTypes.EventSlotTemplateDTO[] | null | undefined): void {
    this.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(value ?? []);
    this.normalizeSlotOverrideDateSelection();
    this.normalizeSlotTemplatesForConfig(false);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: ContractTypes.EventSlotTemplateDTO[]) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readOnly = isDisabled;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: Event): void {
    if (!this.showSlotsPopup) {
      return;
    }
    event.preventDefault();
    this.closeSlotsPopup();
  }

  protected shouldShowPanel(): boolean {
    return this.resolvedConfig.enabled || this.slotTemplates.length > 0;
  }

  protected canConfigureSlotsSeries(): boolean {
    return !this.readOnly && this.resolvedConfig.enabled && !this.resolvedConfig.generated;
  }

  protected openSlotsPopup(event?: Event): void {
    event?.preventDefault();
    if (!this.resolvedConfig.enabled) {
      return;
    }
    this.showSlotsPopup = true;
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  protected closeSlotsPopup(): void {
    this.showSlotsPopup = false;
    this.cdr.markForCheck();
  }

  protected slotSummaryBaseItems(): ContractTypes.EventSlotTemplateDTO[] {
    return this.baseSlotTemplates();
  }

  protected slotSummaryOverrideItems(): Array<{ dateKey: string; label: string; detail: string }> {
    const grouped = new Map<string, ContractTypes.EventSlotTemplateDTO[]>();
    for (const slot of this.slotTemplates) {
      const dateKey = ActivityEventDetailDTO.normalizeSlotOverrideDate(slot.overrideDate);
      if (!dateKey) {
        continue;
      }
      const current = grouped.get(dateKey) ?? [];
      current.push({ ...slot });
      grouped.set(dateKey, current);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, items]) => {
        const visibleSlots = items.filter(item => item.closed !== true);
        if (items.some(item => item.closed === true) && visibleSlots.length === 0) {
          return {
            dateKey,
            label: this.slotOverrideDateLabel(dateKey),
            detail: 'Closed for this date'
          };
        }
        const count = visibleSlots.length;
        return {
          dateKey,
          label: this.slotOverrideDateLabel(dateKey),
          detail: count === 1 ? '1 custom slot' : `${count} custom slots`
        };
      });
  }

  protected slotSummaryWindowLabel(slot: ContractTypes.EventSlotTemplateDTO): string {
    const start = this.parseDateValue(slot.startAt);
    if (!start) {
      return 'Time pending';
    }
    return `Starts ${this.formatSlotDateTimeLabel(start)}`;
  }

  protected selectSlotEditorMode(mode: EventSlotsInputEditorMode, event?: Event): void {
    event?.preventDefault();
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    if (this.slotEditorMode === mode) {
      return;
    }
    this.slotEditorMode = mode;
    if (mode === 'date' && !this.slotOverrideDateValue) {
      this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    }
    this.normalizeSlotOverrideDateSelection();
    this.cdr.markForCheck();
  }

  protected showSlotOverrideDatePicker(): boolean {
    return this.slotEditorMode === 'date';
  }

  protected isSlotOverrideDateFieldLocked(): boolean {
    return false;
  }

  protected slotEditorModeButtonClass(mode: EventSlotsInputEditorMode): string {
    if (this.slotEditorMode !== mode) {
      return '';
    }
    return mode === 'date' ? 'event-slot-mode-btn-active-date' : 'event-slot-mode-btn-active-base';
  }

  protected activeSlotTemplates(): ContractTypes.EventSlotTemplateDTO[] {
    if (this.slotEditorMode === 'base') {
      return ActivityEventDetailDTO.normalizeSlotTemplates(this.baseSlotTemplates());
    }
    const dateKey = this.selectedSlotOverrideDateKey();
    if (!dateKey) {
      return [];
    }
    const explicit = this.overrideSlotTemplatesForDate(dateKey);
    if (explicit.length > 0) {
      if (explicit.some(item => item.closed === true)) {
        return [];
      }
      return ActivityEventDetailDTO.normalizeSlotTemplates(explicit);
    }
    return this.projectBaseSlotTemplatesToDate(dateKey);
  }

  protected slotEditorModeDescription(): string {
    if (this.slotEditorMode === 'date') {
      if (this.isSpecificDateClosed()) {
        return 'This date has its own override and currently has no slots.';
      }
      return this.hasExplicitSlotOverride()
        ? 'Editing one recurring slot window. The preview date chooses the occurrence, and the slot rows stay editable inside that cycle and the overall event range.'
        : 'This occurrence starts as a shifted copy of the base schedule. Pick the preview date above, then adjust the slot rows directly inside that cycle.';
    }
    return 'Base slots can start anywhere inside the main event range. Each slot still respects the selected frequency boundary and cannot overlap the others.';
  }

  protected slotOverrideDateMin(): Date | null {
    const start = AppUtils.isoLocalDateTimeToDate(this.resolvedConfig.startAtIso);
    return start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
  }

  protected slotOverrideDateMax(): Date | null {
    const end = AppUtils.isoLocalDateTimeToDate(this.resolvedConfig.endAtIso);
    return end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
  }

  protected onSlotOverrideDateChange(value: Date | null): void {
    this.slotOverrideDateValue = value;
    this.normalizeSlotOverrideDateSelection();
    this.cdr.markForCheck();
  }

  protected slotTrackId(index: number, slot: ContractTypes.EventSlotTemplateDTO): string {
    return `${slot.overrideDate ?? 'base'}:${slot.id || `slot-${index + 1}`}:${slot.startAt}`;
  }

  protected addSlotTemplate(): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    const nextIndex = currentTemplates.length + 1;
    const previousStart = this.parseDateValue(currentTemplates[currentTemplates.length - 1]?.startAt);
    const startAt = (previousStart
      ? AppUtils.toIsoDateTimeLocal(new Date(previousStart.getTime() + (60 * 60 * 1000)))
      : '')
      || this.defaultSlotStartForActiveScope()
      || this.resolvedConfig.startAtIso
      || AppUtils.toIsoDateTimeLocal(new Date());
    const startDate = this.parseDateValue(startAt) ?? new Date();
    this.setActiveSlotTemplates([
      ...currentTemplates,
      {
        id: this.buildSlotTemplateId(nextIndex),
        startAt: AppUtils.toIsoDateTimeLocal(startDate),
        overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
        closed: false
      }
    ]);
  }

  protected removeSlotTemplate(index: number): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    this.setActiveSlotTemplates(currentTemplates
      .filter((_, currentIndex) => currentIndex !== index)
      .map((item, currentIndex) => ({
        ...item,
        id: item.id?.trim() || this.buildSlotTemplateId(currentIndex + 1),
        overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
        closed: false
      })));
  }

  protected slotTemplateLabel(index: number): string {
    return `Slot ${index + 1}`;
  }

  protected slotTemplateStartDateValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateStartTimeValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateDateMin(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.start.getFullYear(), window.start.getMonth(), window.start.getDate());
  }

  protected slotTemplateDateMax(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.end.getFullYear(), window.end.getMonth(), window.end.getDate());
  }

  protected onSlotTemplateStartDateChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries() || this.isSlotOverrideDateFieldLocked()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      startAt: AppUtils.applyDatePartToIsoLocal(item.startAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  protected onSlotTemplateStartTimeChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      startAt: AppUtils.applyTimePartFromDateToIsoLocal(item.startAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  private syncResolvedConfig(): void {
    const nextConfig = this.resolveConfig();
    const nextSignature = this.buildResolvedConfigSignature(nextConfig);
    if (nextSignature === this.resolvedConfigSignature) {
      return;
    }
    this.resolvedConfig = nextConfig;
    this.resolvedConfigSignature = nextSignature;
    if (!this.resolvedConfig.enabled) {
      this.showSlotsPopup = false;
      this.slotEditorMode = 'base';
    }
    this.normalizeSlotOverrideDateSelection();
    this.normalizeSlotTemplatesForConfig(true);
    this.cdr.markForCheck();
  }

  private resolveConfig(): ResolvedEventSlotsInputConfig {
    const frequency = ActivityEventDetailDTO.normalizeFrequency(this.resolveConfigValue(this.config.frequency, 'One-time'));
    return {
      startAtIso: `${this.resolveConfigValue(this.config.startAtIso, '') ?? ''}`.trim(),
      endAtIso: `${this.resolveConfigValue(this.config.endAtIso, '') ?? ''}`.trim(),
      frequency,
      enabled: frequency !== 'One-time',
      generated: this.resolveConfigValue(this.config.generated, false) === true,
      title: this.resolveConfigValue(this.config.title, 'Slots'),
      subtitle: this.resolveConfigValue(this.config.subtitle, 'Base schedule and date-specific overrides.')
    };
  }

  private resolveConfigValue<TValue>(
    value: EventSlotsInputConfigValue<TValue> | null | undefined,
    fallback: TValue
  ): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)() ?? fallback;
    }
    return value ?? fallback;
  }

  private buildResolvedConfigSignature(config: ResolvedEventSlotsInputConfig): string {
    return JSON.stringify(config);
  }

  private normalizeSlotTemplatesForConfig(emitChanges: boolean): void {
    const before = this.slotTemplatesSignature(this.slotTemplates);
    if (!this.resolvedConfig.enabled) {
      this.slotTemplates = [];
    } else {
      this.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(
        this.slotTemplates.map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }))
      );
      if (this.canConfigureSlotsSeries() && this.baseSlotTemplates().length === 0) {
        this.slotEditorMode = 'base';
        this.addSlotTemplate();
        return;
      }
    }
    if (emitChanges && before !== this.slotTemplatesSignature(this.slotTemplates)) {
      this.emitSlots();
    }
  }

  private emitSlots(): void {
    this.slotDateControlValueCache.clear();
    const nextSlots = ActivityEventDetailDTO.normalizeSlotTemplates(this.slotTemplates);
    this.slotTemplates = nextSlots;
    this.onModelChange(nextSlots.map(item => ({ ...item })));
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  private slotTemplatesSignature(items: readonly ContractTypes.EventSlotTemplateDTO[]): string {
    return JSON.stringify(items.map(item => ({
      id: item.id,
      startAt: item.startAt,
      overrideDate: ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate),
      closed: item.closed === true
    })));
  }

  private baseSlotTemplates(): ContractTypes.EventSlotTemplateDTO[] {
    return this.slotTemplates
      .filter(item => !ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate))
      .filter(item => item.closed !== true)
      .map(item => ({
        ...item,
        overrideDate: null,
        closed: false
      }));
  }

  private overrideSlotTemplatesForDate(dateKey: string): ContractTypes.EventSlotTemplateDTO[] {
    if (!dateKey) {
      return [];
    }
    return this.slotTemplates
      .filter(item => ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate) === dateKey)
      .map(item => ({
        ...item,
        overrideDate: dateKey,
        closed: item.closed === true
      }));
  }

  private selectedSlotOverrideDateKey(): string {
    return ActivityEventDetailDTO.normalizeSlotOverrideDate(this.slotOverrideDateValue) ?? '';
  }

  private defaultSlotOverrideDate(): Date | null {
    const firstOverrideDate = this.slotTemplates
      .map(item => this.parseOverrideDate(item.overrideDate))
      .find((value): value is Date => Boolean(value));
    if (firstOverrideDate) {
      return new Date(firstOverrideDate.getFullYear(), firstOverrideDate.getMonth(), firstOverrideDate.getDate());
    }
    const eventStart = AppUtils.isoLocalDateTimeToDate(this.resolvedConfig.startAtIso);
    return eventStart
      ? new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate())
      : null;
  }

  private normalizeSlotOverrideDateSelection(): void {
    let next = this.slotOverrideDateValue ?? this.defaultSlotOverrideDate();
    if (!next) {
      this.slotOverrideDateValue = null;
      return;
    }
    const min = this.slotOverrideDateMin();
    const max = this.slotOverrideDateMax();
    let nextMs = new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime();
    if (min && nextMs < min.getTime()) {
      nextMs = min.getTime();
    }
    if (max && nextMs > max.getTime()) {
      nextMs = max.getTime();
    }
    const normalized = new Date(nextMs);
    this.slotOverrideDateValue = new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
  }

  private buildSlotTemplateId(index: number): string {
    if (this.slotEditorMode === 'date') {
      const dateKey = this.selectedSlotOverrideDateKey() || 'date';
      return `override-${dateKey}-slot-${index}`;
    }
    return `slot-${index}`;
  }

  private projectBaseSlotTemplatesToDate(dateKey: string): ContractTypes.EventSlotTemplateDTO[] {
    const window = this.slotWindowForOverrideDate(dateKey);
    const baseStart = AppUtils.isoLocalDateTimeToDate(this.resolvedConfig.startAtIso);
    if (!window || !baseStart) {
      return [];
    }
    const shiftMs = window.start.getTime() - baseStart.getTime();
    return this.baseSlotTemplates().map((item, index) => ({
      id: item.id?.trim()
        ? `override-${dateKey}-${item.id.trim()}`
        : this.buildSlotTemplateId(index + 1),
      startAt: this.shiftSlotDateTimeByMs(item.startAt, shiftMs),
      overrideDate: dateKey,
      closed: false
    }));
  }

  private resolveActiveSlotTemplatesForEditing(): ContractTypes.EventSlotTemplateDTO[] {
    return ActivityEventDetailDTO.normalizeSlotTemplates(this.activeSlotTemplates());
  }

  private updateSlotTemplate(
    index: number,
    updater: (item: ContractTypes.EventSlotTemplateDTO) => ContractTypes.EventSlotTemplateDTO
  ): void {
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    this.setActiveSlotTemplates(currentTemplates.map((item, currentIndex) => (
      currentIndex !== index ? { ...item } : updater({ ...item })
    )));
  }

  private ensureSpecificDateOverrideSeeded(): void {
    if (this.slotEditorMode !== 'date') {
      return;
    }
    const dateKey = this.selectedSlotOverrideDateKey();
    if (!dateKey || this.overrideSlotTemplatesForDate(dateKey).length > 0) {
      return;
    }
    const base = this.baseSlotTemplates().map(item => ({ ...item, overrideDate: null }));
    const otherOverrides = this.slotTemplates
      .filter(item => {
        const overrideDate = ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    this.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...this.projectBaseSlotTemplatesToDate(dateKey)
    ];
  }

  private setActiveSlotTemplates(nextTemplates: ContractTypes.EventSlotTemplateDTO[]): void {
    const normalizedTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(
      this.normalizeEditableSlotTemplates(nextTemplates)
    );
    if (this.slotEditorMode === 'base') {
      const overrides = this.slotTemplates
        .filter(item => ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate))
        .map(item => ({ ...item }));
      this.slotTemplates = [
        ...normalizedTemplates.map(item => ({ ...item, overrideDate: null, closed: false })),
        ...overrides
      ];
      this.emitSlots();
      return;
    }

    const dateKey = this.selectedSlotOverrideDateKey();
    const base = this.baseSlotTemplates().map(item => ({ ...item, overrideDate: null, closed: false }));
    const otherOverrides = this.slotTemplates
      .filter(item => {
        const overrideDate = ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    const currentOverride = normalizedTemplates.length > 0
      ? normalizedTemplates.map(item => ({ ...item, overrideDate: dateKey || null, closed: false }))
      : (dateKey ? [this.buildClosedDateOverridePlaceholder(dateKey)] : []);
    this.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...currentOverride
    ];
    this.emitSlots();
  }

  private buildClosedDateOverridePlaceholder(dateKey: string): ContractTypes.EventSlotTemplateDTO {
    return {
      id: `override-${dateKey}-closed`,
      startAt: '',
      overrideDate: dateKey,
      closed: true
    };
  }

  private isSpecificDateClosed(): boolean {
    const dateKey = this.selectedSlotOverrideDateKey();
    return !!dateKey && this.overrideSlotTemplatesForDate(dateKey).some(item => item.closed === true);
  }

  private hasExplicitSlotOverride(): boolean {
    const dateKey = this.selectedSlotOverrideDateKey();
    return !!dateKey && this.overrideSlotTemplatesForDate(dateKey).length > 0;
  }

  private defaultSlotStartForActiveScope(): string {
    return this.slotWindowForEditing()?.startAt ?? this.resolvedConfig.startAtIso;
  }

  private normalizeSlotTemplateBounds(slot: ContractTypes.EventSlotTemplateDTO): ContractTypes.EventSlotTemplateDTO {
    const window = this.slotWindowForEditing(slot.overrideDate);
    const fallbackStart = window?.start ?? this.parseDateValue(this.resolvedConfig.startAtIso) ?? new Date();
    const fallbackEnd = window?.end ?? this.parseDateValue(this.resolvedConfig.endAtIso) ?? new Date(fallbackStart.getTime() + (60 * 60 * 1000));
    const windowStartMs = fallbackStart.getTime();
    const windowEndMs = Math.max(windowStartMs + (60 * 1000), fallbackEnd.getTime());

    let startDate = this.parseDateValue(slot.startAt) ?? new Date(fallbackStart);
    let startMs = startDate.getTime();
    const maxStartMs = Math.max(windowStartMs, windowEndMs - (60 * 1000));
    startMs = Math.min(maxStartMs, Math.max(windowStartMs, startMs));
    startDate = new Date(startMs);

    return {
      ...slot,
      startAt: AppUtils.toIsoDateTimeLocal(startDate)
    };
  }

  private normalizeEditableSlotTemplates(
    nextTemplates: readonly ContractTypes.EventSlotTemplateDTO[]
  ): ContractTypes.EventSlotTemplateDTO[] {
    return ActivityEventDetailDTO.normalizeSlotTemplates(nextTemplates)
      .map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }));
  }

  private slotWindowForEditing(overrideDate = this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null): {
    start: Date;
    end: Date;
    startAt: string;
    endAt: string;
  } | null {
    return this.slotWindowForOverrideDate(overrideDate);
  }

  private slotWindowForOverrideDate(overrideDate: string | null | undefined): {
    start: Date;
    end: Date;
    startAt: string;
    endAt: string;
  } | null {
    const baseStart = this.parseDateValue(this.resolvedConfig.startAtIso);
    const baseEnd = this.parseDateValue(this.resolvedConfig.endAtIso);
    if (!baseStart || !baseEnd) {
      return null;
    }

    if (!overrideDate) {
      return {
        start: new Date(baseStart),
        end: new Date(baseEnd),
        startAt: AppUtils.toIsoDateTimeLocal(baseStart),
        endAt: AppUtils.toIsoDateTimeLocal(baseEnd)
      };
    }

    const overrideDateValue = this.parseOverrideDate(overrideDate);
    const shiftedStartAt = overrideDateValue
      ? AppUtils.applyDatePartToIsoLocal(this.resolvedConfig.startAtIso, overrideDateValue)
      : this.resolvedConfig.startAtIso;
    const shiftedStart = this.parseDateValue(shiftedStartAt) ?? new Date(baseStart);
    const boundaryEnd = this.eventFrequencyBoundaryEnd(shiftedStart) ?? new Date(baseEnd);
    const shiftedEnd = boundaryEnd.getTime() > baseEnd.getTime() ? new Date(baseEnd) : boundaryEnd;
    if (shiftedEnd.getTime() <= shiftedStart.getTime()) {
      const fallbackEnd = new Date(Math.min(baseEnd.getTime(), shiftedStart.getTime() + (60 * 60 * 1000)));
      return {
        start: shiftedStart,
        end: fallbackEnd,
        startAt: AppUtils.toIsoDateTimeLocal(shiftedStart),
        endAt: AppUtils.toIsoDateTimeLocal(fallbackEnd)
      };
    }
    return {
      start: shiftedStart,
      end: shiftedEnd,
      startAt: AppUtils.toIsoDateTimeLocal(shiftedStart),
      endAt: AppUtils.toIsoDateTimeLocal(shiftedEnd)
    };
  }

  private eventFrequencyBoundaryEnd(start: Date | null): Date | null {
    if (!start) {
      return null;
    }
    let boundaryDate: Date | null = null;
    switch (this.resolvedConfig.frequency) {
      case 'Daily':
        boundaryDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        break;
      case 'Weekly':
        boundaryDate = AppUtils.endOfWeekSunday(start);
        break;
      case 'Bi-weekly':
        boundaryDate = AppUtils.addDays(AppUtils.endOfWeekSunday(start), 7);
        break;
      case 'Monthly':
        boundaryDate = AppUtils.endOfMonth(start);
        break;
      case 'Yearly':
        boundaryDate = new Date(start.getFullYear(), 11, 31);
        break;
      default:
        boundaryDate = null;
        break;
    }
    if (!boundaryDate) {
      return null;
    }
    return new Date(boundaryDate.getFullYear(), boundaryDate.getMonth(), boundaryDate.getDate(), 23, 59, 0, 0);
  }

  private shiftSlotDateTimeByMs(value: string, shiftMs: number): string {
    const parsed = this.parseDateValue(value);
    if (!parsed) {
      return value;
    }
    return AppUtils.toIsoDateTimeLocal(new Date(parsed.getTime() + shiftMs));
  }

  private slotControlDateValue(value: string): Date | null {
    const normalizedValue = `${value ?? ''}`.trim();
    if (!normalizedValue) {
      return null;
    }
    if (this.slotDateControlValueCache.has(normalizedValue)) {
      return this.slotDateControlValueCache.get(normalizedValue) ?? null;
    }
    const parsed = this.parseDateValue(normalizedValue);
    this.slotDateControlValueCache.set(normalizedValue, parsed);
    return parsed;
  }

  private slotOverrideDateLabel(dateKey: string): string {
    const parsed = this.parseOverrideDate(dateKey);
    if (!parsed) {
      return dateKey;
    }
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private formatSlotDateTimeLabel(value: Date | null | undefined): string {
    if (!value) {
      return '';
    }
    return value.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private parseDateValue(value: unknown): Date | null {
    return AppUtils.parseDate(value);
  }

  private parseOverrideDate(value: unknown): Date | null {
    return AppUtils.parseDateOnly(value);
  }
}
