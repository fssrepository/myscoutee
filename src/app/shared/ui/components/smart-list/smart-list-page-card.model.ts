import type { ListQuery, SmartListFilters, SmartListViewMode } from './smart-list.types';
import type {
  SmartListPage,
  SmartListPageMode,
  SmartListPageVariant
} from './smart-list-page.adapter';

export interface SmartListPageCardModel<T, TFilters extends SmartListFilters = SmartListFilters> {
  mode: SmartListPageMode;
  pages: readonly SmartListPage<T>[];
  config: unknown | null;
  query: ListQuery<TFilters>;
  variant: SmartListPageVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  onItemSelect?: ((item: T, event?: Event) => void) | null;
}

export interface SmartListPageCardConverterInput<T, TFilters extends SmartListFilters = SmartListFilters> {
  viewMode: SmartListViewMode;
  pages: readonly SmartListPage<T>[];
  config: unknown | null;
  query: ListQuery<TFilters>;
  variant: SmartListPageVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  onItemSelect?: ((item: T, event?: Event) => void) | null;
}

export class SmartListPageCardConverter {
  static convert<T, TFilters extends SmartListFilters = SmartListFilters>(
    input: SmartListPageCardConverterInput<T, TFilters>
  ): SmartListPageCardModel<T, TFilters> {
    return {
      mode: input.viewMode === 'week' ? 'week' : 'month',
      pages: input.pages,
      config: input.config,
      query: input.query,
      variant: input.variant,
      touching: input.touching,
      trackByItem: input.trackByItem ?? null,
      onItemSelect: input.onItemSelect ?? null
    };
  }
}
