import type {
  ListQuery,
  SmartListFilters
} from '../../smart-list.types';
import type {
  SmartListPage,
  SmartListPageMode,
  SmartListPageVariant
} from '../../smart-list-page.adapter';

export type CalendarCardMode = SmartListPageMode;

export interface CalendarCardModel<T, TFilters extends SmartListFilters = SmartListFilters> {
  mode: CalendarCardMode;
  pages: readonly SmartListPage<T>[];
  config: unknown | null;
  query: ListQuery<TFilters>;
  variant: SmartListPageVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  onItemSelect?: ((item: T, event?: Event) => void) | null;
}
