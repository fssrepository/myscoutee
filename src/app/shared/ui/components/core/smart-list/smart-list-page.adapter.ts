import type { Injector, TemplateRef } from '@angular/core';
import type { ListQuery } from '../../../../core/contracts/list.interface';
import type {
  InfiniteStepperPageAdapter,
  InfiniteStepperPageBuildContext
} from './infinite-stepper';
import type {
  SmartListConfig,
  SmartListFilters,
  SmartListItemSelectEvent,
  SmartListItemTemplateContext,
  SmartListViewMode
} from './smart-list.types';

export type SmartListPageMode = Exclude<SmartListViewMode, 'list'>;
export type SmartListPageVariant = string;

export interface SmartListPage {
  key: string;
  label: string;
  anchor: Date;
}

export interface SmartListPageCardModel<T, TFilters extends SmartListFilters = SmartListFilters> {
  mode: SmartListPageMode;
  pages: readonly SmartListPage[];
  config: unknown | null;
  query: ListQuery<TFilters>;
  variant: SmartListPageVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  itemTemplate?: TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null;
  itemTemplateInjector?: Injector | null;
  itemContext?: ((item: T, index: number) => SmartListItemTemplateContext<T, TFilters>) | null;
  onItemSelect?: ((
    item: T,
    event?: Event,
    context?: Pick<
      SmartListItemSelectEvent<T, TFilters>,
      'calendarDate' | 'calendarDateIso' | 'timelineStartOffsetMinutes' | 'timelineEndOffsetMinutes'
    >
  ) => void) | null;
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
  TPage extends SmartListPage = SmartListPage
> extends InfiniteStepperPageAdapter<Date, TPage, T, ListQuery<TFilters>, TConfig> {
  mode: SmartListPageMode;
  config: (config: SmartListConfig<T, TFilters>) => TConfig | null;
  variant: (config: SmartListConfig<T, TFilters>, query: ListQuery<TFilters>) => SmartListPageVariant;
}

export type AnySmartListPageAdapter<
  T,
  TFilters extends SmartListFilters = SmartListFilters
> = SmartListPageAdapter<T, TFilters, any, any>;
