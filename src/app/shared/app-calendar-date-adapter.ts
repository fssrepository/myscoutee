import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class AppCalendarDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const match = normalized.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})\.?$/);
      if (match) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          try {
            const date = this.createDate(year, month - 1, day);
            // NativeDateAdapter only rejects overflow in development builds.
            return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
              ? date : this.invalid();
          } catch {
            return this.invalid();
          }
        }
      }
      // Do not reinterpret partial or day-first input through the browser's US parser.
      return this.invalid();
    }
    return super.parse(value);
  }

  override format(date: Date, displayFormat: object): string {
    if (`${displayFormat}` === 'ymdInput') {
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${date.getFullYear()}/${month}/${day}`;
    }
    if (`${displayFormat}` === 'hmInput') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return super.format(date, displayFormat);
  }
}

export class AppCalendarDateFormats {
  static readonly dateTime = {
    parse: {
      dateInput: 'ymdInput',
      timeInput: 'hmInput'
    },
    display: {
      dateInput: 'ymdInput',
      timeInput: 'hmInput',
      timeOptionLabel: 'hmInput',
      monthYearLabel: 'MMM yyyy',
      dateA11yLabel: 'LL',
      monthYearA11yLabel: 'MMMM yyyy'
    }
  };

  static readonly dateOnly = {
    parse: {
      dateInput: 'ymdInput'
    },
    display: {
      dateInput: 'ymdInput',
      monthYearLabel: 'MMM yyyy',
      dateA11yLabel: 'LL',
      monthYearA11yLabel: 'MMMM yyyy'
    }
  };
}
