import { Observable } from 'rxjs';

export type ListDirection = 'asc' | 'desc';
export type SmartListViewMode = 'list' | 'month' | 'week';
export type SmartListClassValue = string | string[] | Set<string> | Record<string, boolean> | null;
export type SmartListCalendarVariant = 'default' | 'rate-counts';
export type SmartListFilters = object;
export type SmartListLoadTriggerEdge = 'end' | 'start';
export type SmartListMergeStrategy = 'append' | 'prepend';
export type SmartListInitialScrollAnchor = 'start' | 'end';
export type SmartListConfigValue<TValue, TFilters extends SmartListFilters = SmartListFilters>
  = TValue | ((query: ListQuery<TFilters>) => TValue);

export interface ListQuery<TFilters extends SmartListFilters = SmartListFilters> {
  page: number;
  pageSize: number;
  sort?: string;
  direction?: ListDirection;
  filters?: TFilters;
  groupBy?: string;
  view?: string;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export type SmartListLoadPage<T, TFilters extends SmartListFilters = SmartListFilters>
  = (query: ListQuery<TFilters>) => Observable<PageResult<T>>;
export type SmartListLoaders<T, TFilters extends SmartListFilters = SmartListFilters>
  = Partial<Record<string, SmartListLoadPage<T, TFilters>>>;

export interface SmartListGroup<T> {
  label: string;
  items: T[];
}

export interface SmartListStateChange<T, TFilters extends SmartListFilters = SmartListFilters> {
  items: ReadonlyArray<T>;
  groups: ReadonlyArray<SmartListGroup<T>>;
  query: ListQuery<TFilters>;
  total: number;
  currentView: string | null;
  hasMore: boolean;
  loading: boolean;
  initialLoading: boolean;
  progress: number;
  loadingProgress: number;
  loadingOverdue: boolean;
  scrollable: boolean;
  stickyLabel: string;
}

export interface SmartListItemTemplateContext<T, TFilters extends SmartListFilters = SmartListFilters> {
  $implicit: T;
  index: number;
  groupLabel: string;
  query: ListQuery<TFilters>;
}

export interface SmartListCalendarDateRange {
  start: Date;
  end: Date;
}

export interface SmartListCalendarDay<T> {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  items: T[];
}

export interface SmartListCalendarMonthSpan<T> {
  key: string;
  item: T;
  startCol: number;
  endCol: number;
  lane: number;
}

export interface SmartListCalendarMonthWeek<T> {
  start: Date;
  end: Date;
  days: SmartListCalendarDay<T>[];
  spans: SmartListCalendarMonthSpan<T>[];
}

export interface SmartListCalendarMonthPage<T> {
  key: string;
  label: string;
  anchor: Date;
  weeks: SmartListCalendarMonthWeek<T>[];
}

export interface SmartListCalendarWeekPage<T> {
  key: string;
  label: string;
  anchor: Date;
  days: SmartListCalendarDay<T>[];
}

export interface SmartListCalendarTimedBadge<T> {
  item: T;
  topPct: number;
  heightPct: number;
}

export interface SmartListCalendarConfig<T, TFilters extends SmartListFilters = SmartListFilters> {
  weekdayLabels?: ReadonlyArray<string>;
  weekStartHour?: number;
  weekEndHour?: number;
  anchorRadius?: number;
  resolveDateRange: (item: T, query: ListQuery<TFilters>) => SmartListCalendarDateRange | null;
  badgeLabel?: (item: T, query: ListQuery<TFilters>) => string;
  badgeToneClass?: (item: T, query: ListQuery<TFilters>) => SmartListClassValue;
}

export interface SmartListViewConfig<T, TFilters extends SmartListFilters = SmartListFilters> {
  key: string;
  label: string;
  icon?: string;
  mode?: SmartListViewMode;
  groupBy?: string;
  pageSize?: number;
  loadPage?: SmartListLoadPage<T, TFilters>;
}

export interface SmartListGroupMarkerContext<T, TFilters extends SmartListFilters = SmartListFilters> {
  group: SmartListGroup<T>;
  groupIndex: number;
  query: ListQuery<TFilters>;
  scrollable: boolean;
  totalGroups: number;
}

export interface SmartListItemSelectEvent<T, TFilters extends SmartListFilters = SmartListFilters> {
  item: T;
  query: ListQuery<TFilters>;
  currentView: string | null;
  currentViewMode: SmartListViewMode;
}

export interface SmartListConfig<T, TFilters extends SmartListFilters = SmartListFilters> {
  pageSize?: number;
  initialPageCount?: number;
  preloadOffsetPx?: number;
  loadingDelayMs?: number;
  loadingWindowMs?: number;
  defaultView?: string;
  defaultSort?: string;
  defaultDirection?: ListDirection;
  defaultFilters?: TFilters;
  defaultGroupBy?: string;
  trackBy?: (index: number, item: T) => unknown;
  groupBy?: ((item: T, query: ListQuery<TFilters>) => string) | null;
  emptyLabel?: string | ((query: ListQuery<TFilters>) => string);
  emptyDescription?: string | ((query: ListQuery<TFilters>) => string);
  emptyStickyLabel?: string | ((query: ListQuery<TFilters>) => string);
  showStickyHeader?: boolean;
  showFirstGroupMarker?: boolean;
  showGroupMarker?: (context: SmartListGroupMarkerContext<T, TFilters>) => boolean;
  loadTriggerEdge?: SmartListLoadTriggerEdge;
  mergeStrategy?: SmartListMergeStrategy;
  initialScrollAnchor?: SmartListInitialScrollAnchor;
  views?: ReadonlyArray<SmartListViewConfig<T, TFilters>>;
  calendar?: SmartListCalendarConfig<T, TFilters>;
  containerClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  stickyHeaderClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  groupMarkerClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  footerSpacerHeight?: SmartListConfigValue<string | null, TFilters>;
  calendarVariant?: SmartListConfigValue<SmartListCalendarVariant, TFilters>;
}
