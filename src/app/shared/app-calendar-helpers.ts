import type {
  ActivityDateTimeRange,
  ActivityListRow,
  CalendarDayCell,
  CalendarMonthPage,
  CalendarMonthSpan,
  CalendarWeekPage
} from './core/base/models';
import { AppUtils } from './app-utils';

type ActivityDateRange = { start: Date; end: Date };
export type ActivityDateRangeResolver = (row: ActivityListRow) => ActivityDateRange | null;

export class AppCalendarHelpers {
  static activityDateRange(
    row: ActivityListRow,
    activityDateTimeRangeById: Record<string, ActivityDateTimeRange>
  ): ActivityDateRange | null {
    if (row.type === 'rates') {
      const point = new Date(row.dateIso);
      if (Number.isNaN(point.getTime())) {
        return null;
      }
      // Rates are point-in-time events for calendar heat/count views.
      return { start: point, end: new Date(point.getTime() + 60 * 1000) };
    }
    const explicit = activityDateTimeRangeById[row.id];
    if (explicit) {
      const start = new Date(explicit.startIso);
      const end = new Date(explicit.endIso);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
        return { start, end };
      }
    }
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const fallbackEnd = new Date(parsed.getTime() + 2 * 60 * 60 * 1000);
    return { start: parsed, end: fallbackEnd };
  }

  static buildActivityRowsByDate(
    rows: ActivityListRow[],
    resolveDateRange: ActivityDateRangeResolver
  ): Map<string, ActivityListRow[]> {
    const byDate = new Map<string, ActivityListRow[]>();
    for (const row of rows) {
      const range = resolveDateRange(row);
      if (!range) {
        continue;
      }
      let cursor = AppUtils.dateOnly(range.start);
      const endDate = AppUtils.dateOnly(range.end);
      while (cursor.getTime() <= endDate.getTime()) {
        const key = this.dateKey(cursor);
        const current = byDate.get(key) ?? [];
        current.push(row);
        byDate.set(key, current);
        cursor = AppUtils.addDays(cursor, 1);
      }
    }
    return byDate;
  }

  static calendarRowsSignature(
    rows: ActivityListRow[],
    activityDateTimeRangeById: Record<string, ActivityDateTimeRange>
  ): string {
    return rows
      .map(row => {
        const range = activityDateTimeRangeById[row.id];
        const rangeSignature = range ? `${range.startIso}:${range.endIso}` : '';
        return `${row.type}:${row.id}:${row.dateIso}:${rangeSignature}`;
      })
      .join(',');
  }

  static buildMonthPage(
    anchor: Date,
    rowsByDate: Map<string, ActivityListRow[]>,
    rows: ActivityListRow[],
    resolveDateRange: ActivityDateRangeResolver
  ): CalendarMonthPage {
    const firstDay = AppUtils.startOfMonth(anchor);
    const firstWeekStart = AppUtils.startOfWeekMonday(firstDay);
    const monthEnd = AppUtils.endOfMonth(anchor);
    const lastWeekEnd = AppUtils.endOfWeekSunday(monthEnd);
    const weeks: CalendarMonthPage['weeks'] = [];
    let cursor = AppUtils.dateOnly(firstWeekStart);
    while (cursor.getTime() <= lastWeekEnd.getTime()) {
      const weekStart = AppUtils.dateOnly(cursor);
      const weekEnd = AppUtils.addDays(weekStart, 6);
      const days: CalendarDayCell[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = AppUtils.addDays(cursor, day);
        days.push(this.buildCalendarDayCell(date, rowsByDate, firstDay.getMonth()));
      }
      weeks.push({
        start: weekStart,
        end: weekEnd,
        days,
        spans: this.buildMonthWeekSpans(weekStart, weekEnd, rows, resolveDateRange)
      });
      cursor = AppUtils.addDays(cursor, 7);
    }
    return {
      key: this.monthKey(anchor),
      label: anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      weeks
    };
  }

  static buildWeekPage(anchor: Date, rowsByDate: Map<string, ActivityListRow[]>): CalendarWeekPage {
    const start = AppUtils.startOfWeekMonday(anchor);
    const days: CalendarDayCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = AppUtils.addDays(start, day);
      days.push(this.buildCalendarDayCell(date, rowsByDate, date.getMonth()));
    }
    const end = AppUtils.addDays(start, 6);
    return {
      key: this.dateKey(start),
      label: this.weekRangeLabel(start, end),
      days
    };
  }

  static buildMonthWeekSpans(
    weekStart: Date,
    weekEnd: Date,
    rows: ActivityListRow[],
    resolveDateRange: ActivityDateRangeResolver
  ): CalendarMonthSpan[] {
    const spansBase: Array<{ row: ActivityListRow; startCol: number; endCol: number }> = [];
    for (const row of rows) {
      const range = resolveDateRange(row);
      if (!range) {
        continue;
      }
      const startDate = AppUtils.dateOnly(range.start);
      const endDate = AppUtils.dateOnly(range.end);
      if (!this.dateRangeOverlaps(startDate, endDate, weekStart, weekEnd)) {
        continue;
      }
      const visibleStart = startDate.getTime() < weekStart.getTime() ? weekStart : startDate;
      const visibleEnd = endDate.getTime() > weekEnd.getTime() ? weekEnd : endDate;
      spansBase.push({
        row,
        startCol: Math.max(0, this.dayDiff(weekStart, visibleStart)),
        endCol: Math.min(6, this.dayDiff(weekStart, visibleEnd))
      });
    }

    spansBase.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);
    const lanes: Array<Array<{ startCol: number; endCol: number }>> = [];
    const spans: CalendarMonthSpan[] = [];

    for (const span of spansBase) {
      let laneIndex = 0;
      while (laneIndex < lanes.length) {
        const conflict = lanes[laneIndex].some(item => !(span.endCol < item.startCol || span.startCol > item.endCol));
        if (!conflict) {
          break;
        }
        laneIndex += 1;
      }
      if (!lanes[laneIndex]) {
        lanes[laneIndex] = [];
      }
      lanes[laneIndex].push({ startCol: span.startCol, endCol: span.endCol });
      spans.push({
        key: `${span.row.id}-${this.dateKey(weekStart)}-${span.startCol}-${span.endCol}-${laneIndex}`,
        row: span.row,
        startCol: span.startCol,
        endCol: span.endCol,
        lane: laneIndex
      });
    }

    return spans;
  }

  static buildCalendarDayCell(
    date: Date,
    rowsByDate: Map<string, ActivityListRow[]>,
    currentMonthIndex: number
  ): CalendarDayCell {
    const safeDate = AppUtils.dateOnly(date);
    const key = this.dateKey(safeDate);
    const todayKey = this.dateKey(AppUtils.dateOnly(new Date()));
    return {
      key,
      date: safeDate,
      dayNumber: safeDate.getDate(),
      inCurrentMonth: safeDate.getMonth() === currentMonthIndex,
      isToday: key === todayKey,
      rows: rowsByDate.get(key) ?? []
    };
  }

  static weekRangeLabel(start: Date, end: Date): string {
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  static dayDiff(from: Date, to: Date): number {
    const ms = AppUtils.dateOnly(to).getTime() - AppUtils.dateOnly(from).getTime();
    return Math.floor(ms / 86400000);
  }

  static dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
  }

  static countOverlappingRows(
    rows: ActivityListRow[],
    start: Date,
    end: Date,
    resolveDateRange: ActivityDateRangeResolver
  ): number {
    let count = 0;
    for (const row of rows) {
      const range = resolveDateRange(row);
      if (!range) {
        continue;
      }
      if (range.start.getTime() < end.getTime() && range.end.getTime() > start.getTime()) {
        count += 1;
      }
    }
    return count;
  }

  static rateHeatClass(count: number): string {
    if (count <= 0) {
      return 'activities-rate-heat-0';
    }
    const clamped = Math.min(100, count);
    const normalized = (clamped - 1) / 99;
    if (normalized <= 0.16) {
      return 'activities-rate-heat-1';
    }
    if (normalized <= 0.32) {
      return 'activities-rate-heat-2';
    }
    if (normalized <= 0.5) {
      return 'activities-rate-heat-3';
    }
    if (normalized <= 0.68) {
      return 'activities-rate-heat-4';
    }
    if (normalized <= 0.84) {
      return 'activities-rate-heat-5';
    }
    return 'activities-rate-heat-6';
  }

  static dateKey(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static monthKey(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  static parseDateKey(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return AppUtils.dateOnly(new Date(year, month - 1, day));
  }

  static parseMonthKey(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return null;
    }
    return AppUtils.startOfMonth(new Date(year, month - 1, 1));
  }
}
