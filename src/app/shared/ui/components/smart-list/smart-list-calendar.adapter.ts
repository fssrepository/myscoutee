import { AppUtils } from '../../../app-utils';
import type {
  ListQuery,
  SmartListCalendarConfig,
  SmartListCalendarDateRange,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarWeekPage,
  SmartListConfig,
  SmartListFilters
} from './smart-list.types';
import type {
  AnySmartListPageAdapter,
  SmartListPageAdapter,
  SmartListPageBuildContext,
  SmartListPageMode
} from './smart-list-page.adapter';

export type SmartListCalendarMode = 'month' | 'week';
export type SmartListCalendarPage<T> = SmartListCalendarMonthPage<T> | SmartListCalendarWeekPage<T>;

export type SmartListCalendarPageBuildContext<T, TFilters extends SmartListFilters = SmartListFilters>
  = SmartListPageBuildContext<T, TFilters, SmartListCalendarConfig<T, TFilters>>;

export type SmartListCalendarPageAdapter<T, TFilters extends SmartListFilters = SmartListFilters>
  = SmartListPageAdapter<
    T,
    TFilters,
    SmartListCalendarConfig<T, TFilters>,
    SmartListCalendarPage<T>
  > & { mode: SmartListCalendarMode };

interface SmartListCalendarBuilderKeys<T> {
  trackByKey: (item: T) => string;
  dateKey: (value: Date) => string;
  monthKey: (value: Date) => string;
}

const smartListMonthCalendarAdapter = createMonthCalendarAdapter<unknown, SmartListFilters>();
const smartListWeekCalendarAdapter = createWeekCalendarAdapter<unknown, SmartListFilters>();

export const SmartListCalendarAdapter = {
  getInstance<T, TFilters extends SmartListFilters = SmartListFilters>(
    mode: SmartListPageMode
  ): AnySmartListPageAdapter<T, TFilters> | null {
    if (mode === 'month') {
      return smartListMonthCalendarAdapter as unknown as SmartListCalendarPageAdapter<T, TFilters>;
    }
    if (mode === 'week') {
      return smartListWeekCalendarAdapter as unknown as SmartListCalendarPageAdapter<T, TFilters>;
    }
    return null;
  }
} as const;

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

function createMonthCalendarAdapter<
  T,
  TFilters extends SmartListFilters
>(): SmartListCalendarPageAdapter<T, TFilters> {
  return {
    mode: 'month',
    config: calendarConfig,
    variant: calendarVariant,
    anchorRadius,
    initialAnchor,
    initialAnchorKey,
    normalizeAnchor: anchor => AppUtils.startOfMonth(anchor),
    keyForAnchor: anchor => AppUtils.monthKey(AppUtils.startOfMonth(anchor)),
    shiftAnchor: (anchor, direction) => AppUtils.addMonths(AppUtils.startOfMonth(anchor), direction),
    queryForAnchor: (query, anchor) => queryForAnchor(query, AppUtils.startOfMonth(anchor), monthRangeForAnchor),
    anchorForPage: page => page.anchor,
    labelForPage: page => page.label,
    buildPage: context => {
      const anchor = AppUtils.startOfMonth(context.anchor);
      const resolveDateRange = (item: T) => context.viewConfig.resolveDateRange(item, context.query);
      const items = [...context.items];
      const itemsByDate = buildCalendarItemsByDate(items, resolveDateRange, value => AppUtils.dateKey(value));
      return buildCalendarMonthPage(anchor, itemsByDate, items, resolveDateRange, {
        trackByKey: context.trackByKey,
        dateKey: value => AppUtils.dateKey(value),
        monthKey: value => AppUtils.monthKey(value)
      });
    }
  };
}

function createWeekCalendarAdapter<
  T,
  TFilters extends SmartListFilters
>(): SmartListCalendarPageAdapter<T, TFilters> {
  return {
    mode: 'week',
    config: calendarConfig,
    variant: calendarVariant,
    anchorRadius,
    initialAnchor,
    initialAnchorKey,
    normalizeAnchor: anchor => AppUtils.startOfWeekMonday(anchor),
    keyForAnchor: anchor => AppUtils.dateKey(AppUtils.startOfWeekMonday(anchor)),
    shiftAnchor: (anchor, direction) => AppUtils.addDays(AppUtils.startOfWeekMonday(anchor), direction * 7),
    queryForAnchor: (query, anchor) => queryForAnchor(query, AppUtils.startOfWeekMonday(anchor), weekRangeForAnchor),
    anchorForPage: page => page.anchor,
    labelForPage: page => page.label,
    buildPage: context => {
      const anchor = AppUtils.startOfWeekMonday(context.anchor);
      const resolveDateRange = (item: T) => context.viewConfig.resolveDateRange(item, context.query);
      const itemsByDate = buildCalendarItemsByDate([...context.items], resolveDateRange, value => AppUtils.dateKey(value));
      return buildCalendarWeekPage(anchor, itemsByDate, value => AppUtils.dateKey(value));
    }
  };
}

function calendarConfig<T, TFilters extends SmartListFilters>(
  config: SmartListConfig<T, TFilters>
): SmartListCalendarConfig<T, TFilters> | null {
  return config.calendar ?? null;
}

function calendarVariant<T, TFilters extends SmartListFilters>(
  config: SmartListConfig<T, TFilters>,
  query: ListQuery<TFilters>
): string {
  const value = config.calendarVariant;
  if (typeof value === 'function') {
    return value(query);
  }
  return value ?? 'default';
}

function anchorRadius<T, TFilters extends SmartListFilters>(
  calendar: SmartListCalendarConfig<T, TFilters> | null
): number {
  return Math.max(0, Math.trunc(calendar?.anchorRadius ?? 1));
}

function initialAnchor<T, TFilters extends SmartListFilters>(
  calendar: SmartListCalendarConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): Date | null {
  const parsed = AppUtils.parseDate(resolveInitialAnchorValue(calendar, query));
  return parsed ? AppUtils.dateOnly(parsed) : null;
}

function initialAnchorKey<T, TFilters extends SmartListFilters>(
  calendar: SmartListCalendarConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): string {
  const parsed = AppUtils.parseDate(resolveInitialAnchorValue(calendar, query));
  return parsed ? AppUtils.dateKey(parsed) : '';
}

function resolveInitialAnchorValue<T, TFilters extends SmartListFilters>(
  calendar: SmartListCalendarConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): string | Date | null | undefined {
  const value = calendar?.initialAnchor;
  if (typeof value === 'function') {
    return value(query);
  }
  return value ?? null;
}

function queryForAnchor<TFilters extends SmartListFilters>(
  query: ListQuery<TFilters>,
  normalizedAnchor: Date,
  rangeForAnchor: (anchor: Date) => { start: Date; end: Date }
): ListQuery<TFilters> {
  const range = rangeForAnchor(normalizedAnchor);
  return {
    ...query,
    page: 0,
    anchorDate: AppUtils.dateKey(normalizedAnchor),
    rangeStart: AppUtils.dateKey(range.start),
    rangeEnd: AppUtils.dateKey(range.end)
  };
}

function monthRangeForAnchor(anchor: Date): { start: Date; end: Date } {
  const monthStart = AppUtils.startOfMonth(anchor);
  return {
    start: AppUtils.startOfWeekMonday(monthStart),
    end: AppUtils.endOfWeekSunday(AppUtils.endOfMonth(monthStart))
  };
}

function weekRangeForAnchor(anchor: Date): { start: Date; end: Date } {
  const weekStart = AppUtils.startOfWeekMonday(anchor);
  return {
    start: weekStart,
    end: AppUtils.endOfWeekSunday(weekStart)
  };
}

function buildCalendarItemsByDate<T>(
  items: readonly T[],
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

function buildCalendarMonthPage<T>(
  anchor: Date,
  itemsByDate: Map<string, T[]>,
  items: readonly T[],
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

function buildCalendarWeekPage<T>(
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
  items: readonly T[],
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
    if (!AppUtils.dateRangeOverlaps(startDate, endDate, weekStart, weekEnd)) {
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
