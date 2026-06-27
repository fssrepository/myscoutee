export type ListDirection = 'asc' | 'desc';

export type ListFilters = object;

export interface ListQuery<TFilters extends ListFilters = ListFilters> {
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
