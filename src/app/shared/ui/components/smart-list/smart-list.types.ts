import { Observable } from 'rxjs';

export type ListDirection = 'asc' | 'desc';
export type SmartListViewMode = 'list' | 'month' | 'week';
export type SmartListClassValue = string | string[] | Set<string> | Record<string, boolean> | null;
export type SmartListCalendarVariant = 'default' | 'rate-counts';

export interface ListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  direction?: ListDirection;
  filters?: Record<string, unknown>;
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

export type SmartListLoadPage<T> = (query: ListQuery) => Observable<PageResult<T>>;
export type SmartListLoaders<T> = Partial<Record<string, SmartListLoadPage<T>>>;

export interface SmartListGroup<T> {
  label: string;
  items: T[];
}

export interface SmartListStateChange<T> {
  items: ReadonlyArray<T>;
  groups: ReadonlyArray<SmartListGroup<T>>;
  query: ListQuery;
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

export interface SmartListItemTemplateContext<T> {
  $implicit: T;
  index: number;
  groupLabel: string;
  query: ListQuery;
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

export interface SmartListCalendarConfig<T> {
  weekdayLabels?: ReadonlyArray<string>;
  weekStartHour?: number;
  weekEndHour?: number;
  anchorRadius?: number;
  resolveDateRange: (item: T, query: ListQuery) => SmartListCalendarDateRange | null;
  badgeLabel?: (item: T, query: ListQuery) => string;
  badgeToneClass?: (item: T, query: ListQuery) => SmartListClassValue;
}

export interface SmartListViewConfig<T> {
  key: string;
  label: string;
  icon?: string;
  mode?: SmartListViewMode;
  groupBy?: string;
  pageSize?: number;
  loadPage?: SmartListLoadPage<T>;
}

export interface SmartListGroupMarkerContext<T> {
  group: SmartListGroup<T>;
  groupIndex: number;
  query: ListQuery;
  scrollable: boolean;
  totalGroups: number;
}

export interface SmartListItemSelectEvent<T> {
  item: T;
  query: ListQuery;
  currentView: string | null;
  currentViewMode: SmartListViewMode;
}

export interface SmartListConfig<T> {
  pageSize?: number;
  preloadOffsetPx?: number;
  loadingDelayMs?: number;
  loadingWindowMs?: number;
  defaultView?: string;
  defaultSort?: string;
  defaultDirection?: ListDirection;
  defaultFilters?: Record<string, unknown>;
  defaultGroupBy?: string;
  trackBy?: (index: number, item: T) => unknown;
  groupBy?: ((item: T, query: ListQuery) => string) | null;
  emptyLabel?: string | ((query: ListQuery) => string);
  emptyDescription?: string | ((query: ListQuery) => string);
  emptyStickyLabel?: string | ((query: ListQuery) => string);
  showFirstGroupMarker?: boolean;
  showGroupMarker?: (context: SmartListGroupMarkerContext<T>) => boolean;
  views?: ReadonlyArray<SmartListViewConfig<T>>;
  calendar?: SmartListCalendarConfig<T>;
}
