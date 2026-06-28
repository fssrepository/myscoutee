import type { ListQuery } from '../../../../core/contracts/list.interface';
import type {
  InfiniteStepperPageAdapter,
  InfiniteStepperPageBuildContext
} from './infinite-stepper';
import type {
  SmartListConfig,
  SmartListFilters,
  SmartListViewMode
} from './smart-list.types';

export type SmartListPageMode = Exclude<SmartListViewMode, 'list'>;
export type SmartListPageVariant = string;

export interface SmartListPage<T> {
  key: string;
  label: string;
  anchor: Date;
}

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

export type SmartListPageBuildContext<
  T,
  TFilters extends SmartListFilters = SmartListFilters,
  TConfig = unknown
> = InfiniteStepperPageBuildContext<Date, T, ListQuery<TFilters>, TConfig>;

export interface SmartListPageAdapter<
  T,
  TFilters extends SmartListFilters = SmartListFilters,
  TConfig = unknown,
  TPage extends SmartListPage<T> = SmartListPage<T>
> extends InfiniteStepperPageAdapter<Date, TPage, T, ListQuery<TFilters>, TConfig> {
  mode: SmartListPageMode;
  config: (config: SmartListConfig<T, TFilters>) => TConfig | null;
  variant: (config: SmartListConfig<T, TFilters>, query: ListQuery<TFilters>) => SmartListPageVariant;
}

export type AnySmartListPageAdapter<
  T,
  TFilters extends SmartListFilters = SmartListFilters
> = SmartListPageAdapter<T, TFilters, any, any>;
