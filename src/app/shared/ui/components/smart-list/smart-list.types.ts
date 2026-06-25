import { Observable } from 'rxjs';
import type {
  ProgressIndicatorPlacement,
  ProgressIndicatorTone
} from '../progress-indicator';
import type {
  AppMenuAnchorRect,
  AppMenuDispatchState,
  AppMenuItem,
  AppMenuKind,
  AppMenuPanelAlign,
  AppMenuPanelMode
} from '../menu';
import type { RatingStarBarConfig } from '../rating-star-bar';

export type ListDirection = 'asc' | 'desc';
export type SmartListViewMode = 'list' | 'month' | 'week';
export type SmartListPresentation = 'list' | 'fullscreen';
export type SmartListClassValue = string | string[] | Set<string> | Record<string, boolean> | null;
export type SmartListCalendarVariant = 'default' | 'rate-counts';
export type SmartListListLayout = 'stack' | 'card-grid' | 'thread';
export type SmartListListFlow = 'normal' | 'reverse';
export type SmartListOrientation = 'vertical' | 'horizontal';
export type SmartListSnapMode = 'none' | 'proximity' | 'mandatory';
export type SmartListPaginationMode = 'scroll' | 'arrows' | 'rating-stars';
export type SmartListPaginationStep = 'item' | 'page';
export type SmartListItemRenderState = 'list' | 'default' | 'active' | 'leaving';
export type SmartListHeaderProgressState = 'active' | 'inactive';
export type SmartListFilters = object;
export type SmartListLoadTriggerEdge = 'end' | 'start';
export type SmartListMergeStrategy = 'append' | 'prepend';
export type SmartListInitialScrollAnchor = 'start' | 'end' | 'first-item';
export type SmartListPrependRestoreMode = 'manual' | 'native';
export type SmartListConfigValue<TValue, TFilters extends SmartListFilters = SmartListFilters>
  = TValue | ((query: ListQuery<TFilters>) => TValue);

export interface ListQuery<TFilters extends SmartListFilters = SmartListFilters> {
  page: number;
  pageSize: number;
  cursor?: string | null;
  sort?: string;
  direction?: ListDirection;
  filters?: TFilters;
  groupBy?: string;
  view?: string;
  anchorDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface PageResult<T, TContext = unknown> {
  items: T[];
  total: number;
  nextCursor?: string | null;
  context?: TContext;
}

export interface SmartListLoadContext {
  signal?: AbortSignal;
}

export type SmartListLoadPage<T, TFilters extends SmartListFilters = SmartListFilters>
  = (query: ListQuery<TFilters>, context?: SmartListLoadContext) => Observable<PageResult<T>>;
export type SmartListLoaders<T, TFilters extends SmartListFilters = SmartListFilters>
  = Partial<Record<string, SmartListLoadPage<T, TFilters>>>;

export interface SmartListGroup<T> {
  label: string;
  items: T[];
  startIndex: number;
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
  cursorIndex: number;
  cursorTotal: number;
  cursorProgress: number;
  cursorCanPrev: boolean;
  cursorCanNext: boolean;
}

export interface SmartListHeaderAction<TFilters extends SmartListFilters = SmartListFilters> {
  id: string;
  icon: string;
  label?: string | null;
  ariaLabel?: string | null;
  className?: SmartListClassValue;
  hidden?: SmartListConfigValue<boolean, TFilters>;
  disabled?: SmartListConfigValue<boolean, TFilters>;
}

export interface SmartListHeaderActionSelectEvent<TFilters extends SmartListFilters = SmartListFilters> {
  action: SmartListHeaderAction<TFilters>;
  query: ListQuery<TFilters>;
  sourceEvent: Event;
}

export interface SmartListCursorState<T> {
  index: number;
  total: number;
  progress: number;
  canPrev: boolean;
  canNext: boolean;
  item: T | null;
}

export interface SmartListItemTemplateContext<T, TFilters extends SmartListFilters = SmartListFilters> {
  $implicit: T;
  index: number;
  groupLabel: string;
  query: ListQuery<TFilters>;
  selectMode: boolean;
  presentation: SmartListPresentation;
  renderState: SmartListItemRenderState;
  selectItem: (event?: Event) => void;
  openMenu: (request: SmartListItemMenuRequest) => void;
}

export interface SmartListItemMenuRequest {
  id: string;
  kind?: AppMenuKind;
  title?: string | null;
  items?: readonly AppMenuItem<string, unknown>[];
  triggerRect?: AppMenuAnchorRect | null;
  openUp?: boolean;
  panelAlign?: AppMenuPanelAlign;
  panelMode?: AppMenuPanelMode;
  closeOnSelect?: boolean;
  closeTrigger?: (() => void) | null;
}

export interface SmartListItemMenuContext<T> {
  menu: 'smart-list-item';
  itemId: string;
  item: T;
  request: SmartListItemMenuRequest;
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
  initialAnchor?: SmartListConfigValue<string | Date | null | undefined, TFilters>;
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
  selectMode: boolean;
  sourceEvent?: Event;
}

export interface SmartListMenuItemsContext<T, TFilters extends SmartListFilters = SmartListFilters> {
  menu: AppMenuDispatchState<string, unknown>;
  query: ListQuery<TFilters>;
  items: readonly T[];
  item: T | null;
  itemId: string | null;
  request: SmartListItemMenuRequest | null;
}

export type SmartListMenuItemsResolver<T, TFilters extends SmartListFilters = SmartListFilters> =
  (context: SmartListMenuItemsContext<T, TFilters>) => readonly AppMenuItem<string, unknown>[];

export interface SmartListConfig<T, TFilters extends SmartListFilters = SmartListFilters> {
  pageSize?: number;
  mobilePageSizeCap?: number | null;
  compactHorizontal?: SmartListConfigValue<boolean, TFilters>;
  mobileStepper?: SmartListConfigValue<boolean, TFilters>;
  initialPageCount?: number;
  initialPageSize?: number;
  preloadOffsetPx?: number;
  showBackgroundLoadingProgress?: SmartListConfigValue<boolean, TFilters>;
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
  menuItems?: SmartListMenuItemsResolver<T, TFilters>;
  loadTriggerEdge?: SmartListLoadTriggerEdge;
  mergeStrategy?: SmartListMergeStrategy;
  initialScrollAnchor?: SmartListInitialScrollAnchor;
  prependRestoreMode?: SmartListPrependRestoreMode;
  prependRevealPx?: number;
  views?: ReadonlyArray<SmartListViewConfig<T, TFilters>>;
  calendar?: SmartListCalendarConfig<T, TFilters>;
  containerClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  stickyHeaderClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  stickyHeaderActions?: SmartListConfigValue<readonly SmartListHeaderAction<TFilters>[], TFilters>;
  groupMarkerClass?: SmartListConfigValue<SmartListClassValue, TFilters>;
  footerSpacerHeight?: SmartListConfigValue<string | null, TFilters>;
  calendarVariant?: SmartListConfigValue<SmartListCalendarVariant, TFilters>;
  presentation?: SmartListConfigValue<SmartListPresentation, TFilters>;
  selectMode?: SmartListConfigValue<boolean, TFilters>;
  listLayout?: SmartListConfigValue<SmartListListLayout, TFilters>;
  listFlow?: SmartListConfigValue<SmartListListFlow, TFilters>;
  orientation?: SmartListConfigValue<SmartListOrientation, TFilters>;
  desktopColumns?: SmartListConfigValue<number | null, TFilters>;
  snapMode?: SmartListConfigValue<SmartListSnapMode, TFilters>;
  scrollPaddingTop?: SmartListConfigValue<string | null, TFilters>;
  headerProgress?: {
    enabled?: SmartListConfigValue<boolean, TFilters>;
    tone?: SmartListConfigValue<ProgressIndicatorTone, TFilters>;
    placement?: SmartListConfigValue<ProgressIndicatorPlacement, TFilters>;
    state?: SmartListConfigValue<SmartListHeaderProgressState, TFilters>;
  };
  pagination?: {
    mode?: SmartListPaginationMode | ((item: T | null, query: ListQuery<TFilters>) => SmartListPaginationMode);
    step?: SmartListConfigValue<SmartListPaginationStep, TFilters>;
    headerControls?: SmartListConfigValue<boolean, TFilters>;
    autoplayMs?: SmartListConfigValue<number | null, TFilters>;
    ratingBarConfig?: (item: T | null, query: ListQuery<TFilters>) => RatingStarBarConfig | null;
    ratingBarValue?: (item: T | null, query: ListQuery<TFilters>) => number;
    onRatingSelect?: (item: T | null, score: number, query: ListQuery<TFilters>) => void | Promise<void>;
  };
}
