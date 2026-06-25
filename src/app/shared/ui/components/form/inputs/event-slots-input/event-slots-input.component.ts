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
import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette, type AppMenuTrigger } from '../../../menu';
import { TextCardComponent } from '../../../smart-list/card';
import { FormFlowComponent, type FormFlowControlModel, type FormFlowModel } from '../../flow';
import type * as ContractTypes from '../../../../../core/contracts';

export type EventSlotsInputConfigValue<TValue> = TValue | (() => TValue);
export type EventSlotsInputEditorMode = 'base' | 'date';

export interface EventSlotsInputConfig {
  enabled?: EventSlotsInputConfigValue<boolean | null | undefined>;
  enabledChange?: (enabled: boolean) => void;
  startAtIso?: EventSlotsInputConfigValue<string | null | undefined>;
  endAtIso?: EventSlotsInputConfigValue<string | null | undefined>;
  frequency?: EventSlotsInputConfigValue<string | null | undefined>;
  frequencyOptions?: EventSlotsInputConfigValue<readonly string[] | null | undefined>;
  frequencyChange?: (frequency: string) => void;
  generated?: EventSlotsInputConfigValue<boolean | null | undefined>;
  title?: EventSlotsInputConfigValue<string>;
  subtitle?: EventSlotsInputConfigValue<string>;
}

interface ResolvedEventSlotsInputConfig {
  startAtIso: string;
  endAtIso: string;
  frequency: string;
  frequencyOptions: readonly string[];
  enabled: boolean;
  generated: boolean;
  title: string;
  subtitle: string;
}

interface EventSlotScheduleFormValue {
  frequency: string;
  startAt: string;
  time: string;
  weekday: string;
  day: number;
  month: string;
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
    MatTimepickerModule,
    AppMenuComponent,
    TextCardComponent,
    FormFlowComponent
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
  protected showSchedulePopup = false;
  protected schedulePopupMode: 'create' | 'edit' = 'create';
  protected slotOverrideDateValue: Date | null = null;
  protected resolvedConfig: ResolvedEventSlotsInputConfig = this.resolveConfig();
  protected scheduleFlowValue: EventSlotScheduleFormValue = this.createScheduleFlowValue();

  private resolvedConfigSignature = this.buildResolvedConfigSignature(this.resolvedConfig);
  private scheduleFlowModelCache: { signature: string; model: FormFlowModel } | null = null;
  private scheduleEditIndex: number | null = null;
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
    if (this.showSchedulePopup) {
      event.preventDefault();
      this.closeSchedulePopup();
    }
  }

  protected shouldShowPanel(): boolean {
    return true;
  }

  protected canUpdateSlotsConfig(): boolean {
    return !this.readOnly && !this.resolvedConfig.generated;
  }

  protected canConfigureSlotsSeries(): boolean {
    return this.canUpdateSlotsConfig() && this.resolvedConfig.enabled;
  }

  protected slotsEnabled(): boolean {
    return this.resolvedConfig.enabled;
  }

  protected toggleSlotsEnabled(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canUpdateSlotsConfig()) {
      return;
    }
    this.setSlotsEnabled(!this.resolvedConfig.enabled);
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
    if (ActivityEventDetailDTO.normalizeSlotOverrideDate(slot.overrideDate)) {
      return `Starts ${this.formatSlotDateTimeLabel(start)}`;
    }
    return this.formatRecurringSlotLabel(start);
  }

  protected slotSummaryAddMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (!this.canConfigureSlotsSeries()) {
      return [];
    }
    return [{
      id: 'add',
      icon: 'add',
      ariaLabel: 'Add base slot',
      palette: 'amber'
    }];
  }

  protected onSlotSummaryAddSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (event.id !== 'add') {
      return;
    }
    this.addBaseSlotFromPanel(event.sourceEvent);
  }

  protected slotSummaryMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (!this.canConfigureSlotsSeries()) {
      return [];
    }
    return [
      {
        id: 'edit',
        label: 'Edit',
        icon: 'edit',
        palette: 'blue',
        surface: 'tinted'
      },
      {
        id: 'override',
        label: 'Override',
        icon: 'published_with_changes',
        palette: 'violet',
        surface: 'tinted',
        disabled: true
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted'
      }
    ];
  }

  protected slotSummaryOverrideMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (!this.canConfigureSlotsSeries()) {
      return [];
    }
    return [
      {
        id: 'override',
        label: 'Override',
        icon: 'published_with_changes',
        palette: 'violet',
        surface: 'tinted',
        disabled: true
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted'
      }
    ];
  }

  protected onBaseSlotSummaryMenuSelect(
    index: number,
    event: AppMenuItemSelectEvent<string, unknown>
  ): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    switch (event.id) {
      case 'edit':
        this.openBaseSlotEditor(index, event.sourceEvent);
        break;
      case 'delete':
        this.removeBaseSlotFromPanel(index, event.sourceEvent);
        break;
      default:
        break;
    }
  }

  protected onOverrideSlotSummaryMenuSelect(
    dateKey: string,
    event: AppMenuItemSelectEvent<string, unknown>
  ): void {
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    switch (event.id) {
      case 'delete':
        this.removeOverrideDateFromPanel(dateKey, event.sourceEvent);
        break;
      default:
        break;
    }
  }

  protected addBaseSlotFromPanel(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.slotEditorMode = 'base';
    this.openSchedulePopup();
    this.cdr.markForCheck();
  }

  private openBaseSlotEditor(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.slotEditorMode = 'base';
    this.openSchedulePopup(index);
  }

  protected schedulePopupTitle(): string {
    return this.schedulePopupMode === 'edit' ? 'Edit Schedule' : 'Add Schedule';
  }

  protected schedulePopupSubtitle(): string {
    return this.schedulePopupMode === 'edit'
      ? 'Update the selected base slot start rule.'
      : 'Create a base slot start rule.';
  }

  protected closeSchedulePopup(): void {
    this.showSchedulePopup = false;
    this.schedulePopupMode = 'create';
    this.scheduleEditIndex = null;
    this.cdr.markForCheck();
  }

  protected scheduleFrequencyLocked(): boolean {
    return this.baseSlotTemplates().length > 0;
  }

  protected scheduleFlowModel(): FormFlowModel {
    const signature = this.scheduleFlowModelSignature();
    if (this.scheduleFlowModelCache?.signature === signature) {
      return this.scheduleFlowModelCache.model;
    }
    const model: FormFlowModel = {
      title: 'Add Schedule',
      header: false,
      layout: 'grouped',
      summary: { enabled: false },
      save: null,
      completion: { controls: 'none' },
      steps: [
        {
          id: 'schedule',
          title: '',
          controls: [
            {
              id: 'frequency',
              bind: 'frequency',
              kind: 'menu',
              layout: 'wide',
              label: 'Gyakoriság',
              disabled: this.scheduleFrequencyLocked(),
              config: {
                kind: 'select',
                layout: 'row',
                panelMode: 'auto',
                closeOnSelect: true,
                trigger: this.scheduleFrequencyMenuTrigger(),
                items: this.scheduleFrequencyMenuItems()
              }
            },
            ...this.scheduleTimeControls()
          ]
        }
      ]
    };
    this.scheduleFlowModelCache = { signature, model };
    return model;
  }

  private scheduleFlowModelSignature(): string {
    return JSON.stringify({
      frequency: ActivityEventDetailDTO.normalizeFrequency(this.scheduleFlowValue.frequency),
      month: this.scheduleFlowValue.month,
      locked: this.scheduleFrequencyLocked(),
      startAtIso: this.resolvedConfig.startAtIso,
      endAtIso: this.resolvedConfig.endAtIso,
      options: this.scheduleFrequencyOptions()
    });
  }

  protected onScheduleFlowValueChange(value: unknown): void {
    const previousFrequency = ActivityEventDetailDTO.normalizeFrequency(this.scheduleFlowValue.frequency);
    const nextValue = this.normalizeScheduleFlowValue(value);
    if (this.scheduleFrequencyLocked()) {
      nextValue.frequency = this.scheduleFlowValue.frequency;
    }
    const nextFrequency = ActivityEventDetailDTO.normalizeFrequency(nextValue.frequency);
    if (nextFrequency !== previousFrequency) {
      const nextStartAt = this.buildScheduleDraftStartAt(nextFrequency, nextValue);
      this.scheduleFlowValue = this.scheduleFlowValueFromDate(nextFrequency, this.parseDateValue(nextStartAt) ?? new Date());
      this.cdr.markForCheck();
      return;
    }
    this.scheduleFlowValue = nextValue;
    this.cdr.markForCheck();
  }

  protected confirmSchedulePopup(event?: Event | AppMenuItemSelectEvent<string, unknown>): void {
    const sourceEvent = event && 'sourceEvent' in event ? event.sourceEvent : event;
    sourceEvent?.preventDefault();
    sourceEvent?.stopPropagation();
    this.createScheduleFromPopup();
  }

  protected scheduleConfirmMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return [{
      id: 'add-schedule',
      icon: 'check',
      layout: 'action',
      ariaLabel: 'Add schedule',
      palette: 'success',
      disabled: !this.canConfigureSlotsSeries()
    }];
  }

  protected scheduleFrequencyOptions(): readonly string[] {
    return this.resolvedConfig.frequencyOptions.filter(item => ActivityEventDetailDTO.normalizeFrequency(item) !== 'One-time');
  }

  private createScheduleFromPopup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    const draft = this.normalizeScheduleFlowValue(this.scheduleFlowValue);
    const frequency = ActivityEventDetailDTO.normalizeFrequency(draft.frequency);
    if (!this.scheduleFrequencyLocked()) {
      this.setFrequency(frequency);
    }
    const startAt = this.buildScheduleDraftStartAt(frequency, draft);
    const currentTemplates = this.baseSlotTemplates();
    const editIndex = this.scheduleEditIndex;
    this.slotEditorMode = 'base';
    if (editIndex !== null && editIndex >= 0 && editIndex < currentTemplates.length) {
      this.setActiveSlotTemplates(currentTemplates.map((item, index) => index === editIndex
        ? {
          ...item,
          startAt,
          overrideDate: null,
          closed: false
        }
        : item));
    } else {
      const nextIndex = currentTemplates.length + 1;
      this.setActiveSlotTemplates([
        ...currentTemplates,
        {
          id: this.buildSlotTemplateId(nextIndex),
          startAt,
          overrideDate: null,
          closed: false
        }
      ]);
    }
    this.closeSchedulePopup();
  }

  protected removeBaseSlotFromPanel(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canConfigureSlotsSeries() || index < 0) {
      return;
    }
    this.slotEditorMode = 'base';
    this.removeSlotTemplate(index);
    this.cdr.markForCheck();
  }

  protected removeOverrideDateFromPanel(dateKey: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const normalizedDateKey = ActivityEventDetailDTO.normalizeSlotOverrideDate(dateKey);
    if (!this.canConfigureSlotsSeries() || !normalizedDateKey) {
      return;
    }
    this.slotTemplates = this.slotTemplates
      .filter(item => ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate) !== normalizedDateKey)
      .map(item => ({ ...item }));
    this.emitSlots();
  }

  private formatRecurringSlotLabel(start: Date): string {
    const time = this.formatSlotTimeLabel(start);
    switch (this.resolvedConfig.frequency) {
      case 'Daily':
        return `Every day at ${time}`;
      case 'Weekly':
        return `Every ${this.formatSlotWeekday(start)} at ${time}`;
      case 'Bi-weekly':
        return `Every second ${this.formatSlotWeekday(start)} at ${time}`;
      case 'Monthly':
        return `Every month on day ${start.getDate()} at ${time}`;
      case 'Yearly':
        return `Every year on ${this.formatSlotMonthDay(start)} at ${time}`;
      default:
        return `Starts ${this.formatSlotDateTimeLabel(start)}`;
    }
  }

  private formatSlotTimeLabel(value: Date): string {
    return value.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private formatSlotWeekday(value: Date): string {
    return value.toLocaleDateString('en-US', {
      weekday: 'long'
    });
  }

  private formatSlotMonthDay(value: Date): string {
    return value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
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
      this.slotEditorMode = 'base';
    }
    this.normalizeSlotOverrideDateSelection();
    this.normalizeSlotTemplatesForConfig(true);
    this.cdr.markForCheck();
  }

  private resolveConfig(): ResolvedEventSlotsInputConfig {
    const frequency = ActivityEventDetailDTO.normalizeFrequency(this.resolveConfigValue(this.config.frequency, 'One-time'));
    const frequencyOptions = this.resolveFrequencyOptions(this.resolveConfigValue(this.config.frequencyOptions, null));
    const configuredEnabled = this.resolveConfigValue(this.config.enabled, null);
    return {
      startAtIso: `${this.resolveConfigValue(this.config.startAtIso, '') ?? ''}`.trim(),
      endAtIso: `${this.resolveConfigValue(this.config.endAtIso, '') ?? ''}`.trim(),
      frequency,
      frequencyOptions,
      enabled: configuredEnabled === null || configuredEnabled === undefined ? frequency !== 'One-time' : configuredEnabled === true,
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

  private resolveFrequencyOptions(value: readonly string[] | null | undefined): readonly string[] {
    const options = (value?.length ? value : ['Custom', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'])
      .map(item => ActivityEventDetailDTO.normalizeFrequency(item));
    return Array.from(new Set(options));
  }

  private buildResolvedConfigSignature(config: ResolvedEventSlotsInputConfig): string {
    return JSON.stringify(config);
  }

  private setFrequency(value: string): void {
    if (!this.canUpdateSlotsConfig()) {
      return;
    }
    const normalized = ActivityEventDetailDTO.normalizeFrequency(value);
    this.config.frequencyChange?.(normalized);
    this.onModelTouched();
    this.syncResolvedConfig();
  }

  private setSlotsEnabled(value: boolean): void {
    if (!this.canUpdateSlotsConfig()) {
      return;
    }
    this.config.enabledChange?.(value);
    if (!value) {
      this.showSchedulePopup = false;
    }
    this.onModelTouched();
    this.syncResolvedConfig();
  }

  private defaultEnabledFrequency(): string {
    return this.scheduleFrequencyOptions()[0] ?? 'Custom';
  }

  private openSchedulePopup(index: number | null = null): void {
    const currentTemplates = this.baseSlotTemplates();
    const editSlot = index !== null ? currentTemplates[index] : null;
    const seedDate = this.parseDateValue(editSlot?.startAt) ?? this.defaultScheduleDraftDate();
    const currentFrequency = ActivityEventDetailDTO.normalizeFrequency(this.resolvedConfig.frequency);
    this.scheduleEditIndex = editSlot ? index : null;
    this.schedulePopupMode = editSlot ? 'edit' : 'create';
    this.scheduleFlowValue = this.scheduleFlowValueFromDate(
      currentFrequency === 'One-time' ? this.defaultEnabledFrequency() : currentFrequency,
      seedDate
    );
    this.showSchedulePopup = true;
    this.onModelTouched();
  }

  private createScheduleFlowValue(): EventSlotScheduleFormValue {
    return this.scheduleFlowValueFromDate(
      this.defaultEnabledFrequency(),
      this.parseDateValue(this.resolvedConfig.startAtIso) ?? new Date()
    );
  }

  private normalizeScheduleFlowValue(value: unknown): EventSlotScheduleFormValue {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const frequency = ActivityEventDetailDTO.normalizeFrequency(record['frequency']);
    const startAt = `${record['startAt'] ?? ''}`.trim()
      || AppUtils.toIsoDateTimeLocal(this.defaultScheduleDraftDate());
    const baseDate = this.parseDateValue(startAt) ?? this.defaultScheduleDraftDate();
    const normalizedFrequency = frequency === 'One-time' ? this.defaultEnabledFrequency() : frequency;
    const month = this.normalizeScheduleMonth(record['month'], baseDate);
    const day = this.normalizeScheduleDay(record['day'], normalizedFrequency, month, baseDate);
    return {
      frequency: normalizedFrequency,
      startAt,
      time: this.normalizeScheduleTime(record['time'], baseDate),
      weekday: this.normalizeScheduleWeekday(record['weekday'], baseDate),
      day,
      month
    };
  }

  private scheduleFlowValueFromDate(frequency: string, date: Date): EventSlotScheduleFormValue {
    const normalizedFrequency = ActivityEventDetailDTO.normalizeFrequency(frequency);
    const month = `${date.getMonth() + 1}`;
    return {
      frequency: normalizedFrequency === 'One-time' ? this.defaultEnabledFrequency() : normalizedFrequency,
      startAt: AppUtils.toIsoDateTimeLocal(date),
      time: this.formatScheduleTimeInput(date),
      weekday: `${date.getDay()}`,
      day: date.getDate(),
      month
    };
  }

  private scheduleFrequencyMenuTrigger(): AppMenuTrigger {
    return {
      id: 'schedule-frequency',
      label: 'Gyakoriság',
      icon: 'event',
      trailingIcon: 'expand_more',
      layout: 'field',
      disabled: this.scheduleFrequencyLocked()
    };
  }

  private scheduleTimeControls(): FormFlowControlModel[] {
    switch (ActivityEventDetailDTO.normalizeFrequency(this.scheduleFlowValue.frequency)) {
      case 'Custom':
        return [{
          id: 'startAt',
          bind: 'startAt',
          kind: 'date',
          layout: 'wide',
          label: 'Start',
          required: true,
          config: {
            model: {
              mode: 'single',
              precision: 'minute',
              valueFormat: 'iso-date-time',
              field: {
                label: 'Start',
                required: true,
                min: this.resolvedConfig.startAtIso || null,
                max: this.resolvedConfig.endAtIso || null
              }
            }
          }
        }];
      case 'Daily':
        return [this.scheduleTimeControl('time', 'Start time', 'wide')];
      case 'Weekly':
      case 'Bi-weekly':
        return [
          this.scheduleWeekdayControl(),
          this.scheduleTimeControl('time', 'Start time')
        ];
      case 'Monthly':
        return [
          this.scheduleDayControl(),
          this.scheduleTimeControl('time', 'Start time')
        ];
      case 'Yearly':
        return [
          this.scheduleMonthControl(),
          this.scheduleDayControl(),
          this.scheduleTimeControl('time', 'Start time', 'wide')
        ];
      default:
        return [this.scheduleTimeControl('time', 'Start time', 'wide')];
    }
  }

  private scheduleTimeControl(id: string, label: string, layout: FormFlowControlModel['layout'] = 'half'): FormFlowControlModel {
    return {
      id,
      bind: id,
      kind: 'date',
      layout,
      label,
      required: true,
      config: {
        model: {
          mode: 'time',
          precision: 'minute',
          field: {
            label,
            required: true
          }
        }
      }
    };
  }

  private scheduleWeekdayControl(): FormFlowControlModel {
    return {
      id: 'weekday',
      bind: 'weekday',
      kind: 'menu',
      layout: 'half',
      label: 'Day',
      required: true,
      config: {
        kind: 'select',
        layout: 'row',
        panelMode: 'auto',
        closeOnSelect: true,
        trigger: {
          id: 'schedule-weekday',
          label: 'Day',
          icon: 'calendar_view_week',
          trailingIcon: 'expand_more',
          layout: 'field'
        },
        items: this.scheduleWeekdayMenuItems()
      }
    };
  }

  private scheduleDayControl(): FormFlowControlModel {
    return {
      id: 'day',
      bind: 'day',
      kind: 'number',
      layout: 'half',
      label: 'Day',
      required: true,
      min: 1,
      max: this.scheduleDayMax(),
      step: 1
    };
  }

  private scheduleMonthControl(): FormFlowControlModel {
    return {
      id: 'month',
      bind: 'month',
      kind: 'menu',
      layout: 'half',
      label: 'Month',
      required: true,
      config: {
        kind: 'select',
        layout: 'row',
        panelMode: 'auto',
        closeOnSelect: true,
        trigger: {
          id: 'schedule-month',
          label: 'Month',
          icon: 'calendar_month',
          trailingIcon: 'expand_more',
          layout: 'field'
        },
        items: this.scheduleMonthMenuItems()
      }
    };
  }

  private scheduleWeekdayMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return [
      ['0', 'Sunday'],
      ['1', 'Monday'],
      ['2', 'Tuesday'],
      ['3', 'Wednesday'],
      ['4', 'Thursday'],
      ['5', 'Friday'],
      ['6', 'Saturday']
    ].map(([value, label]) => ({
      id: value,
      value,
      kind: 'radio',
      label,
      icon: 'calendar_view_week',
      palette: 'cyan',
      surface: 'tinted'
    }));
  }

  private scheduleMonthMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return [
      ['1', 'January'],
      ['2', 'February'],
      ['3', 'March'],
      ['4', 'April'],
      ['5', 'May'],
      ['6', 'June'],
      ['7', 'July'],
      ['8', 'August'],
      ['9', 'September'],
      ['10', 'October'],
      ['11', 'November'],
      ['12', 'December']
    ].map(([value, label]) => {
      const zodiac = this.scheduleMonthZodiac(value);
      return {
        id: value,
        value,
        kind: 'radio',
        label,
        icon: zodiac.icon,
        palette: zodiac.palette,
        surface: 'tinted'
      };
    });
  }

  private scheduleMonthZodiac(value: string): { icon: string; palette: AppMenuPalette } {
    switch (value) {
      case '1':
        return { icon: '♑', palette: 'capricorn' };
      case '2':
        return { icon: '♒', palette: 'aquarius' };
      case '3':
        return { icon: '♓', palette: 'pisces' };
      case '4':
        return { icon: '♈', palette: 'aries' };
      case '5':
        return { icon: '♉', palette: 'taurus' };
      case '6':
        return { icon: '♊', palette: 'gemini' };
      case '7':
        return { icon: '♋', palette: 'cancer' };
      case '8':
        return { icon: '♌', palette: 'leo' };
      case '9':
        return { icon: '♍', palette: 'virgo' };
      case '10':
        return { icon: '♎', palette: 'libra' };
      case '11':
        return { icon: '♏', palette: 'scorpio' };
      case '12':
        return { icon: '♐', palette: 'sagittarius' };
      default:
        return { icon: 'calendar_month', palette: 'amber' };
    }
  }

  private scheduleFrequencyMenuItems(): readonly AppMenuItem<string, unknown>[] {
    return this.scheduleFrequencyOptions().map(frequency => {
      const normalized = ActivityEventDetailDTO.normalizeFrequency(frequency);
      return {
        id: normalized,
        value: normalized,
        kind: 'radio',
        label: this.scheduleFrequencyLabel(normalized),
        icon: this.scheduleFrequencyIcon(normalized),
        palette: this.scheduleFrequencyPalette(normalized),
        surface: 'tinted'
      };
    });
  }

  private scheduleFrequencyLabel(frequency: string): string {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        return 'Custom';
      case 'Daily':
        return 'Naponta';
      case 'Weekly':
        return 'Hetente';
      case 'Bi-weekly':
        return 'Kéthetente';
      case 'Monthly':
        return 'Havonta';
      case 'Yearly':
        return 'Évente';
      default:
        return 'Custom';
    }
  }

  private scheduleFrequencyIcon(frequency: string): string {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        return 'event';
      case 'Daily':
        return 'today';
      case 'Weekly':
        return 'calendar_view_week';
      case 'Bi-weekly':
        return 'date_range';
      case 'Monthly':
        return 'calendar_month';
      case 'Yearly':
        return 'event_available';
      default:
        return 'event';
    }
  }

  private scheduleFrequencyPalette(frequency: string): AppMenuPalette {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        return 'blue';
      case 'Daily':
        return 'green';
      case 'Weekly':
        return 'cyan';
      case 'Bi-weekly':
        return 'violet';
      case 'Monthly':
        return 'amber';
      case 'Yearly':
        return 'gold';
      default:
        return 'blue';
    }
  }

  private defaultScheduleDraftDate(): Date {
    const baseSlots = this.baseSlotTemplates();
    const previousStart = this.parseDateValue(baseSlots[baseSlots.length - 1]?.startAt);
    if (previousStart) {
      return new Date(previousStart.getTime() + (60 * 60 * 1000));
    }
    return this.parseDateValue(this.resolvedConfig.startAtIso) ?? new Date();
  }

  private buildScheduleDraftStartAt(frequency: string, draft: EventSlotScheduleFormValue): string {
    const eventStart = this.parseDateValue(this.resolvedConfig.startAtIso) ?? new Date();
    const draftStart = this.parseDateValue(draft.startAt) ?? eventStart;
    const timeSource = this.parseScheduleTimeInput(draft.time, draftStart);
    let start = new Date(eventStart);
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        start = new Date(draftStart);
        break;
      case 'Weekly':
      case 'Bi-weekly':
        start = this.nextWeekdayDate(eventStart, this.scheduleInteger(draft.weekday, draftStart.getDay(), 0, 6));
        break;
      case 'Monthly':
        start = this.nextMonthlyDate(eventStart, this.scheduleInteger(draft.day, draftStart.getDate(), 1, 31));
        break;
      case 'Yearly':
        start = this.nextYearlyDate(
          eventStart,
          this.scheduleInteger(draft.month, draftStart.getMonth() + 1, 1, 12),
          this.scheduleInteger(draft.day, draftStart.getDate(), 1, 31)
        );
        break;
      default:
        start = new Date(eventStart);
        break;
    }
    return AppUtils.toIsoDateTimeLocal(this.applyDraftTime(start, timeSource));
  }

  private normalizeScheduleTime(value: unknown, fallbackDate: Date): string {
    const normalized = `${value ?? ''}`.trim();
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : this.formatScheduleTimeInput(fallbackDate);
  }

  private normalizeScheduleWeekday(value: unknown, fallbackDate: Date): string {
    return `${this.scheduleInteger(value, fallbackDate.getDay(), 0, 6)}`;
  }

  private normalizeScheduleMonth(value: unknown, fallbackDate: Date): string {
    return `${this.scheduleInteger(value, fallbackDate.getMonth() + 1, 1, 12)}`;
  }

  private normalizeScheduleDay(value: unknown, frequency: string, month: string, fallbackDate: Date): number {
    const max = this.scheduleDayMaxFor(frequency, month);
    return this.scheduleInteger(value, Math.min(fallbackDate.getDate(), max), 1, max);
  }

  private scheduleDayMax(): number {
    return this.scheduleDayMaxFor(this.scheduleFlowValue.frequency, this.scheduleFlowValue.month);
  }

  private scheduleDayMaxFor(frequency: string, month: string): number {
    if (ActivityEventDetailDTO.normalizeFrequency(frequency) !== 'Yearly') {
      return 31;
    }
    const monthIndex = this.scheduleInteger(month, 1, 1, 12) - 1;
    return new Date(2026, monthIndex + 1, 0).getDate();
  }

  private scheduleInteger(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Math.trunc(Number(value));
    const normalized = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(max, Math.max(min, normalized));
  }

  private formatScheduleTimeInput(value: Date): string {
    return `${value.getHours()}`.padStart(2, '0') + ':' + `${value.getMinutes()}`.padStart(2, '0');
  }

  private parseScheduleTimeInput(value: string, fallbackDate: Date): Date {
    const normalized = this.normalizeScheduleTime(value, fallbackDate);
    const [hours, minutes] = normalized.split(':').map(item => Number(item));
    const next = new Date(fallbackDate);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  private applyDraftTime(date: Date, timeSource: Date): Date {
    const next = new Date(date);
    next.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
    return next;
  }

  private nextWeekdayDate(start: Date, weekday: number): Date {
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const delta = (weekday - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    return next;
  }

  private nextMonthlyDate(start: Date, day: number): Date {
    const next = this.monthlyDate(start.getFullYear(), start.getMonth(), day);
    if (next.getTime() >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) {
      return next;
    }
    return this.monthlyDate(start.getFullYear(), start.getMonth() + 1, day);
  }

  private monthlyDate(year: number, monthIndex: number, day: number): Date {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(Math.max(1, day), lastDay));
  }

  private nextYearlyDate(start: Date, month: number, day: number): Date {
    const monthIndex = Math.min(11, Math.max(0, month - 1));
    const next = this.monthlyDate(start.getFullYear(), monthIndex, day);
    if (next.getTime() >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) {
      return next;
    }
    return this.monthlyDate(start.getFullYear() + 1, monthIndex, day);
  }

  private normalizeSlotTemplatesForConfig(emitChanges: boolean): void {
    const before = this.slotTemplatesSignature(this.slotTemplates);
    if (!this.resolvedConfig.enabled) {
      this.slotTemplates = [];
    } else {
      this.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(
        this.slotTemplates.map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }))
      );
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
