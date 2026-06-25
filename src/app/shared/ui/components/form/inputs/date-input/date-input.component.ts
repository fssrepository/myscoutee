import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepicker, MatTimepickerModule } from '@angular/material/timepicker';

import { AppUtils } from '../../../../../app-utils';
import type { DateRangeDto } from '../../../../../core/contracts/date.interface';

export type DateInputMode = 'single' | 'range';
export type DateInputPrecision = 'date' | 'minute';
export type DateInputValueFormat = 'iso-date' | 'iso-date-time';
export type DateInputRangeValue = DateRangeDto;
export type DateInputMetaKind = 'horoscope';
export type DateInputMetaPalette =
  | 'aquarius'
  | 'aries'
  | 'blue'
  | 'brown'
  | 'cancer'
  | 'capricorn'
  | 'gemini'
  | 'green'
  | 'leo'
  | 'libra'
  | 'muted'
  | 'orange'
  | 'pink'
  | 'pisces'
  | 'purple'
  | 'sagittarius'
  | 'scorpio'
  | 'taurus'
  | 'teal'
  | 'violet'
  | 'virgo';
type DateInputPickerKey = 'single-date' | 'single-time' | 'start-date' | 'start-time' | 'end-date' | 'end-time';

export type DateInputValue = string | DateInputRangeValue | null;
export type DateInputBoundary = string | Date | null | undefined;

export interface DateInputFieldModel {
  label?: string;
  placeholder?: string;
  required?: boolean;
  min?: DateInputBoundary;
  max?: DateInputBoundary;
}

export interface DateInputRangeBoundsModel {
  start?: DateInputBoundary;
  end?: DateInputBoundary;
}

export interface DateInputRangeModel {
  start?: DateInputFieldModel;
  end?: DateInputFieldModel;
  bounds?: DateInputRangeBoundsModel | null;
}

export interface DateInputMetaModel {
  kind?: DateInputMetaKind;
  label?: string;
  icon?: string;
  palette?: DateInputMetaPalette;
  emptyLabel?: string;
}

export interface DateInputMetaValue {
  label?: string | null;
  icon?: string | null;
  palette?: DateInputMetaPalette;
}

export interface DateInputModel {
  mode?: DateInputMode;
  precision?: DateInputPrecision;
  valueFormat?: DateInputValueFormat;
  field?: DateInputFieldModel;
  range?: DateInputRangeModel;
  meta?: DateInputMetaModel | null;
  readOnly?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'app-date-input',
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
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true
    }
  ]
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() model: DateInputModel | null = null;

  private static readonly horoscopeMetaBySign: Record<string, DateInputMetaValue> = {
    Aries: { label: 'Kos', icon: '♈', palette: 'aries' },
    Taurus: { label: 'Bika', icon: '♉', palette: 'taurus' },
    Gemini: { label: 'Ikrek', icon: '♊', palette: 'gemini' },
    Cancer: { label: 'Rák', icon: '♋', palette: 'cancer' },
    Leo: { label: 'Oroszlán', icon: '♌', palette: 'leo' },
    Virgo: { label: 'Szűz', icon: '♍', palette: 'virgo' },
    Libra: { label: 'Mérleg', icon: '♎', palette: 'libra' },
    Scorpio: { label: 'Skorpió', icon: '♏', palette: 'scorpio' },
    Sagittarius: { label: 'Nyilas', icon: '♐', palette: 'sagittarius' },
    Capricorn: { label: 'Bak', icon: '♑', palette: 'capricorn' },
    Aquarius: { label: 'Vízöntő', icon: '♒', palette: 'aquarius' },
    Pisces: { label: 'Halak', icon: '♓', palette: 'pisces' }
  };

  protected singleDateValue: Date | null = null;
  protected singleTimeValue: Date | null = null;
  protected startDateValue: Date | null = null;
  protected startTimeValue: Date | null = null;
  protected endDateValue: Date | null = null;
  protected endTimeValue: Date | null = null;

  private readonly openPickers = new Set<DateInputPickerKey>();
  private controlDisabled = false;
  private currentValue: DateInputValue = null;
  private onValueChange: (value: DateInputValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  writeValue(value: DateInputValue | undefined): void {
    this.currentValue = value ?? null;
    this.syncControlsFromValue();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: DateInputValue) => void): void {
    this.onValueChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected isRange(): boolean {
    return this.mode === 'range';
  }

  protected hasTime(): boolean {
    return this.precision === 'minute';
  }

  protected inputDisabled(): boolean {
    return this.disabled || this.readOnly || this.controlDisabled;
  }

  protected get label(): string {
    return `${this.singleField.label ?? ''}`;
  }

  protected get startLabel(): string {
    return `${this.startField.label ?? 'Start'}`;
  }

  protected get endLabel(): string {
    return `${this.endField.label ?? 'End'}`;
  }

  protected get placeholder(): string {
    return `${this.singleField.placeholder ?? 'YYYY/MM/DD'}`;
  }

  protected get startPlaceholder(): string {
    return `${this.startField.placeholder ?? 'YYYY/MM/DD'}`;
  }

  protected get endPlaceholder(): string {
    return `${this.endField.placeholder ?? 'YYYY/MM/DD'}`;
  }

  protected get required(): boolean {
    return this.singleField.required === true;
  }

  protected get startRequired(): boolean {
    return this.startField.required === true;
  }

  protected get endRequired(): boolean {
    return this.endField.required === true;
  }

  private get mode(): DateInputMode {
    return this.model?.mode ?? 'single';
  }

  private get precision(): DateInputPrecision {
    return this.model?.precision ?? 'date';
  }

  private get valueFormat(): DateInputValueFormat {
    return this.model?.valueFormat ?? 'iso-date-time';
  }

  private get readOnly(): boolean {
    return this.model?.readOnly === true;
  }

  private get disabled(): boolean {
    return this.model?.disabled === true;
  }

  private get singleField(): DateInputFieldModel {
    return this.model?.field ?? {};
  }

  private get range(): DateInputRangeModel {
    return this.model?.range ?? {};
  }

  private get startField(): DateInputFieldModel {
    return this.range.start ?? {};
  }

  private get endField(): DateInputFieldModel {
    return this.range.end ?? {};
  }

  private get bounds(): DateInputRangeBoundsModel | null | undefined {
    return this.range.bounds;
  }

  private get meta(): DateInputMetaModel | null | undefined {
    return this.model?.meta;
  }

  protected resolvedSingleMin(): Date | null {
    return this.toDatePickerBoundary(this.singleField.min);
  }

  protected resolvedSingleMax(): Date | null {
    return this.toDatePickerBoundary(this.singleField.max);
  }

  protected resolvedStartMin(): Date | null {
    return this.toDatePickerBoundary(this.bounds?.start ?? this.startField.min);
  }

  protected resolvedStartMax(): Date | null {
    return this.toDatePickerBoundary(this.bounds?.end ?? this.startField.max);
  }

  protected resolvedEndMin(): Date | null {
    return this.toDatePickerBoundary(this.startDateValue ?? this.bounds?.start ?? this.endField.min);
  }

  protected resolvedEndMax(): Date | null {
    return this.toDatePickerBoundary(this.bounds?.end ?? this.endField.max);
  }

  protected onSingleDateChange(value: Date | null): void {
    this.singleDateValue = value;
    this.emitSingleValue();
  }

  protected onSingleTimeChange(value: Date | null): void {
    this.singleTimeValue = value;
    this.emitSingleValue();
  }

  protected onStartDateChange(value: Date | null): void {
    this.startDateValue = value;
    this.emitRangeValue();
  }

  protected onStartTimeChange(value: Date | null): void {
    this.startTimeValue = value;
    this.emitRangeValue();
  }

  protected onEndDateChange(value: Date | null): void {
    this.endDateValue = value;
    this.emitRangeValue();
  }

  protected onEndTimeChange(value: Date | null): void {
    this.endTimeValue = value;
    this.emitRangeValue();
  }

  protected markTouched(): void {
    this.onTouched();
  }

  protected isPickerOpen(key: DateInputPickerKey): boolean {
    return this.openPickers.has(key);
  }

  protected pickerIcon(key: DateInputPickerKey, closedIcon: string): string {
    return this.isPickerOpen(key) ? 'close' : closedIcon;
  }

  protected hasMeta(): boolean {
    return this.meta !== null && this.meta !== undefined;
  }

  protected metaLabel(): string {
    return `${this.meta?.label ?? ''}`.trim();
  }

  protected metaIcon(): string {
    return this.resolvedMetaValue()?.icon?.trim()
      || `${this.meta?.icon ?? ''}`.trim();
  }

  protected metaValue(): string {
    const value = this.resolvedMetaValue();
    return `${value?.label ?? ''}`.trim() || `${this.meta?.emptyLabel ?? ''}`.trim();
  }

  protected metaPalette(): string {
    return this.resolvedMetaValue()?.palette?.trim()
      || `${this.meta?.palette ?? 'blue'}`.trim()
      || 'blue';
  }

  protected setPickerOpen(key: DateInputPickerKey, open: boolean): void {
    if (open) {
      this.openPickers.add(key);
    } else {
      this.openPickers.delete(key);
    }
    this.cdr.markForCheck();
  }

  protected toggleDatePicker(picker: MatDatepicker<Date>, key: DateInputPickerKey, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.inputDisabled()) {
      return;
    }
    if (picker.opened || this.isPickerOpen(key)) {
      picker.close();
      return;
    }
    picker.open();
  }

  protected toggleTimePicker(picker: MatTimepicker<Date>, key: DateInputPickerKey, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.inputDisabled()) {
      return;
    }
    if (this.isPickerOpen(key)) {
      picker.close();
      return;
    }
    picker.open();
  }

  private emitSingleValue(): void {
    if (this.inputDisabled()) {
      return;
    }
    const value = this.datePartsToValue(this.singleDateValue, this.singleTimeValue);
    this.currentValue = value;
    this.onValueChange(value);
    this.onTouched();
  }

  private emitRangeValue(): void {
    if (this.inputDisabled()) {
      return;
    }
    const value = {
      startAt: this.datePartsToValue(this.startDateValue, this.startTimeValue),
      endAt: this.datePartsToValue(this.endDateValue, this.endTimeValue),
      precision: this.precision
    };
    const normalized = this.normalizedRange(value);
    this.currentValue = normalized;
    this.syncControlsFromValue();
    this.onValueChange(normalized);
    this.onTouched();
  }

  private syncControlsFromValue(): void {
    if (this.mode === 'range') {
      const range = this.isRangeValue(this.currentValue) ? this.currentValue : { startAt: '', endAt: '', precision: this.precision };
      const start = this.toDate(range.startAt);
      const end = this.toDate(range.endAt);
      this.startDateValue = start;
      this.startTimeValue = start;
      this.endDateValue = end;
      this.endTimeValue = end;
      return;
    }

    const date = typeof this.currentValue === 'string' ? this.toDate(this.currentValue) : null;
    this.singleDateValue = date;
    this.singleTimeValue = date;
  }

  private datePartsToValue(dateValue: Date | null, timeValue: Date | null): string {
    if (!dateValue) {
      return '';
    }
    const next = new Date(dateValue);
    if (this.precision === 'minute') {
      const time = timeValue ?? dateValue;
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      return AppUtils.toIsoDateTimeLocal(next);
    }

    next.setHours(0, 0, 0, 0);
    return this.valueFormat === 'iso-date' ? AppUtils.toIsoDate(next) : AppUtils.toIsoDateTimeLocal(next);
  }

  private toDate(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? new Date(value) : null;
    }
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const [year, month, day] = normalized.split('-').map(item => Number.parseInt(item, 10));
      const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    return AppUtils.isoLocalDateTimeToDate(normalized);
  }

  private toDatePickerBoundary(value: string | Date | null | undefined): Date | null {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private normalizedRange(value: DateInputRangeValue): DateInputRangeValue {
    const start = this.toDate(value.startAt);
    let end = this.toDate(value.endAt);
    const min = this.toDate(this.bounds?.start ?? this.startField.min);
    const max = this.toDate(this.bounds?.end ?? this.endField.max);
    if (!start) {
      return {
        startAt: '',
        endAt: '',
        precision: this.precision
      };
    }

    let safeStart = new Date(start);
    if (min && safeStart.getTime() < min.getTime()) {
      safeStart = new Date(min);
    }
    if (max && safeStart.getTime() > max.getTime()) {
      safeStart = new Date(max);
    }

    const minDurationMs = 60 * 60 * 1000;
    if (!end || end.getTime() <= safeStart.getTime()) {
      end = new Date(safeStart.getTime() + minDurationMs);
    }
    if (max && end.getTime() > max.getTime()) {
      end = new Date(max);
    }
    if (end.getTime() <= safeStart.getTime()) {
      safeStart = min && max && max.getTime() > min.getTime()
        ? new Date(Math.max(min.getTime(), max.getTime() - minDurationMs))
        : safeStart;
      end = max && max.getTime() > safeStart.getTime()
        ? new Date(max)
        : new Date(safeStart.getTime() + minDurationMs);
    }

    return {
      startAt: this.dateToValue(safeStart),
      endAt: this.dateToValue(end),
      precision: this.precision
    };
  }

  private dateToValue(value: Date): string {
    if (this.precision === 'minute') {
      return AppUtils.toIsoDateTimeLocal(value);
    }
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return this.valueFormat === 'iso-date' ? AppUtils.toIsoDate(date) : AppUtils.toIsoDateTimeLocal(date);
  }

  private isRangeValue(value: DateInputValue): value is DateInputRangeValue {
    return !!value
      && typeof value === 'object'
      && 'startAt' in value
      && 'endAt' in value;
  }

  private resolvedMetaValue(): DateInputMetaValue | null {
    if (!this.meta) {
      return null;
    }
    if (this.meta.kind === 'horoscope') {
      return this.horoscopeMetaValue();
    }
    return {
      label: this.meta.emptyLabel ?? '',
      icon: this.meta.icon ?? '',
      palette: this.meta.palette ?? 'blue'
    };
  }

  private horoscopeMetaValue(): DateInputMetaValue | null {
    const date = this.singleDateValue ?? (typeof this.currentValue === 'string' ? this.toDate(this.currentValue) : null);
    if (!date) {
      return null;
    }
    const horoscope = AppUtils.horoscopeByDate(date);
    return DateInputComponent.horoscopeMetaBySign[horoscope] ?? DateInputComponent.horoscopeMetaBySign['Pisces'];
  }
}
