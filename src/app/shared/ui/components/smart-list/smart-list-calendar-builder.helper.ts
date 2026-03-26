import { AppUtils } from '../../../app-utils';
import type {
  SmartListCalendarDateRange,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarWeekPage
} from './smart-list.types';

interface SmartListCalendarBuilderKeys<T> {
  trackByKey: (item: T) => string;
  dateKey: (value: Date) => string;
  monthKey: (value: Date) => string;
}

export function buildSmartListCalendarItemsByDate<T>(
  items: T[],
  resolveDateRange: (item: T) => SmartListCalendarDateRange | null,
  dateKey: (value: Date) => string
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const range = resolveDateRange(item);
    if (!range) {
      continue;
    }
    let cursor = AppUtils.dateOnly(range.start);
    const endDate = AppUtils.dateOnly(range.end);
    while (cursor.getTime() <= endDate.getTime()) {
      const key = dateKey(cursor);
      const current = byDate.get(key) ?? [];
      current.push(item);
      byDate.set(key, current);
      cursor = AppUtils.addDays(cursor, 1);
    }
  }
  return byDate;
}

export function countSmartListCalendarOverlaps<T>(
  items: readonly T[],
  start: Date,
  end: Date,
  resolveDateRange: (item: T) => SmartListCalendarDateRange | null
): number {
  let count = 0;
  for (const item of items) {
    const range = resolveDateRange(item);
    if (!range) {
      continue;
    }
    if (range.start.getTime() < end.getTime() && range.end.getTime() > start.getTime()) {
      count += 1;
    }
  }
  return count;
}

export function buildSmartListCalendarMonthPage<T>(
  anchor: Date,
  itemsByDate: Map<string, T[]>,
  items: T[],
  resolveDateRange: (item: T) => SmartListCalendarDateRange | null,
  keys: SmartListCalendarBuilderKeys<T>
): SmartListCalendarMonthPage<T> {
  const firstDay = AppUtils.startOfMonth(anchor);
  const firstWeekStart = AppUtils.startOfWeekMonday(firstDay);
  const monthEnd = AppUtils.endOfMonth(anchor);
  const lastWeekEnd = AppUtils.endOfWeekSunday(monthEnd);
  const weeks: SmartListCalendarMonthWeek<T>[] = [];
  let cursor = AppUtils.dateOnly(firstWeekStart);

  while (cursor.getTime() <= lastWeekEnd.getTime()) {
    const weekStart = AppUtils.dateOnly(cursor);
    const weekEnd = AppUtils.addDays(weekStart, 6);
    const days: SmartListCalendarDay<T>[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = AppUtils.addDays(cursor, day);
      days.push(buildCalendarDay(date, itemsByDate, firstDay.getMonth(), keys.dateKey));
    }
    weeks.push({
      start: weekStart,
      end: weekEnd,
      days,
      spans: buildMonthWeekSpans(weekStart, weekEnd, items, resolveDateRange, keys)
    });
    cursor = AppUtils.addDays(cursor, 7);
  }

  return {
    key: keys.monthKey(anchor),
    label: anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    anchor: AppUtils.startOfMonth(anchor),
    weeks
  };
}

export function buildSmartListCalendarWeekPage<T>(
  anchor: Date,
  itemsByDate: Map<string, T[]>,
  dateKey: (value: Date) => string
): SmartListCalendarWeekPage<T> {
  const start = AppUtils.startOfWeekMonday(anchor);
  const days: SmartListCalendarDay<T>[] = [];
  for (let day = 0; day < 7; day += 1) {
    const date = AppUtils.addDays(start, day);
    days.push(buildCalendarDay(date, itemsByDate, date.getMonth(), dateKey));
  }
  const end = AppUtils.addDays(start, 6);
  return {
    key: dateKey(start),
    label: weekRangeLabel(start, end),
    anchor: start,
    days
  };
}

function buildMonthWeekSpans<T>(
  weekStart: Date,
  weekEnd: Date,
  items: T[],
  resolveDateRange: (item: T) => SmartListCalendarDateRange | null,
  keys: SmartListCalendarBuilderKeys<T>
): SmartListCalendarMonthSpan<T>[] {
  const spansBase: Array<{ item: T; startCol: number; endCol: number }> = [];
  for (const item of items) {
    const range = resolveDateRange(item);
    if (!range) {
      continue;
    }
    const startDate = AppUtils.dateOnly(range.start);
    const endDate = AppUtils.dateOnly(range.end);
    if (!dateRangeOverlaps(startDate, endDate, weekStart, weekEnd)) {
      continue;
    }
    const visibleStart = startDate.getTime() < weekStart.getTime() ? weekStart : startDate;
    const visibleEnd = endDate.getTime() > weekEnd.getTime() ? weekEnd : endDate;
    spansBase.push({
      item,
      startCol: Math.max(0, dayDiff(weekStart, visibleStart)),
      endCol: Math.min(6, dayDiff(weekStart, visibleEnd))
    });
  }

  spansBase.sort((first, second) => first.startCol - second.startCol || second.endCol - first.endCol);
  const lanes: Array<Array<{ startCol: number; endCol: number }>> = [];
  const spans: SmartListCalendarMonthSpan<T>[] = [];

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
      key: `${keys.trackByKey(span.item)}-${keys.dateKey(weekStart)}-${span.startCol}-${span.endCol}-${laneIndex}`,
      item: span.item,
      startCol: span.startCol,
      endCol: span.endCol,
      lane: laneIndex
    });
  }

  return spans;
}

function buildCalendarDay<T>(
  date: Date,
  itemsByDate: Map<string, T[]>,
  currentMonthIndex: number,
  dateKey: (value: Date) => string
): SmartListCalendarDay<T> {
  const safeDate = AppUtils.dateOnly(date);
  const key = dateKey(safeDate);
  const todayKey = dateKey(AppUtils.dateOnly(new Date()));
  return {
    key,
    date: safeDate,
    dayNumber: safeDate.getDate(),
    inCurrentMonth: safeDate.getMonth() === currentMonthIndex,
    isToday: key === todayKey,
    items: itemsByDate.get(key) ?? []
  };
}

function weekRangeLabel(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function dayDiff(from: Date, to: Date): number {
  const ms = AppUtils.dateOnly(to).getTime() - AppUtils.dateOnly(from).getTime();
  return Math.floor(ms / 86400000);
}

function dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
}
