import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';

import { AppUtils } from '../../../../../app-utils';

export type DateInputMode = 'single' | 'range';
export type DateInputPrecision = 'date' | 'minute';
export type DateInputValueFormat = 'iso-date' | 'iso-date-time';

export interface DateInputRangeValue {
  startAt: string;
  endAt: string;
}

export type DateInputValue = string | DateInputRangeValue | null;

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
  @Input() mode: DateInputMode = 'single';
  @Input() precision: DateInputPrecision = 'date';
  @Input() valueFormat: DateInputValueFormat = 'iso-date-time';
  @Input() label = '';
  @Input() startLabel = 'Start';
  @Input() endLabel = 'End';
  @Input() placeholder = 'YYYY/MM/DD';
  @Input() required = false;
  @Input() readOnly = false;
  @Input() disabled = false;
  @Input() min: string | Date | null | undefined = null;
  @Input() max: string | Date | null | undefined = null;
  @Input() startMin: string | Date | null | undefined = null;
  @Input() startMax: string | Date | null | undefined = null;
  @Input() endMin: string | Date | null | undefined = null;
  @Input() endMax: string | Date | null | undefined = null;

  protected singleDateValue: Date | null = null;
  protected singleTimeValue: Date | null = null;
  protected startDateValue: Date | null = null;
  protected startTimeValue: Date | null = null;
  protected endDateValue: Date | null = null;
  protected endTimeValue: Date | null = null;

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

  protected resolvedSingleMin(): Date | null {
    return this.toDate(this.min);
  }

  protected resolvedSingleMax(): Date | null {
    return this.toDate(this.max);
  }

  protected resolvedStartMin(): Date | null {
    return this.toDate(this.startMin ?? this.min);
  }

  protected resolvedStartMax(): Date | null {
    return this.toDate(this.startMax ?? this.max);
  }

  protected resolvedEndMin(): Date | null {
    return this.toDate(this.endMin ?? this.min);
  }

  protected resolvedEndMax(): Date | null {
    return this.toDate(this.endMax ?? this.max);
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
      endAt: this.datePartsToValue(this.endDateValue, this.endTimeValue)
    };
    this.currentValue = value;
    this.onValueChange(value);
    this.onTouched();
  }

  private syncControlsFromValue(): void {
    if (this.mode === 'range') {
      const range = this.isRangeValue(this.currentValue) ? this.currentValue : { startAt: '', endAt: '' };
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

  private isRangeValue(value: DateInputValue): value is DateInputRangeValue {
    return !!value
      && typeof value === 'object'
      && 'startAt' in value
      && 'endAt' in value;
  }
}
