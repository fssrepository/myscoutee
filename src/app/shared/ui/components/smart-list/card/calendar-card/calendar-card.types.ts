import type {
  ListQuery,
  SmartListCalendarConfig,
  SmartListCalendarMonthPage,
  SmartListCalendarVariant,
  SmartListCalendarWeekPage,
  SmartListFilters
} from '../../smart-list.types';

export type CalendarCardMode = 'month' | 'week';

export interface CalendarCardModel<T, TFilters extends SmartListFilters = SmartListFilters> {
  mode: CalendarCardMode;
  monthPages: readonly SmartListCalendarMonthPage<T>[];
  weekPages: readonly SmartListCalendarWeekPage<T>[];
  calendar: SmartListCalendarConfig<T, TFilters> | null;
  query: ListQuery<TFilters>;
  variant: SmartListCalendarVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  onItemSelect?: ((item: T, event?: Event) => void) | null;
}
