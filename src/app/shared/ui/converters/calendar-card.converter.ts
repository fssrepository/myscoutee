import type {
  ListQuery,
  SmartListCalendarConfig,
  SmartListCalendarMonthPage,
  SmartListCalendarVariant,
  SmartListCalendarWeekPage,
  SmartListFilters,
  SmartListViewMode
} from '../components/smart-list/smart-list.types';
import type { CalendarCardModel } from '../components/smart-list/card/calendar-card';
import type { UiConverter } from './converter.types';

export interface CalendarCardConverterInput<T, TFilters extends SmartListFilters = SmartListFilters> {
  viewMode: SmartListViewMode;
  monthPages: readonly SmartListCalendarMonthPage<T>[];
  weekPages: readonly SmartListCalendarWeekPage<T>[];
  calendar: SmartListCalendarConfig<T, TFilters> | null;
  query: ListQuery<TFilters>;
  variant: SmartListCalendarVariant;
  touching: boolean;
  trackByItem?: ((index: number, item: T) => unknown) | null;
  onItemSelect?: ((item: T, event?: Event) => void) | null;
}

export class CalendarCardConverter {
  static convert<T, TFilters extends SmartListFilters = SmartListFilters>(
    input: CalendarCardConverterInput<T, TFilters>
  ): CalendarCardModel<T, TFilters> {
    return {
      mode: input.viewMode === 'week' ? 'week' : 'month',
      monthPages: input.monthPages,
      weekPages: input.weekPages,
      calendar: input.calendar,
      query: input.query,
      variant: input.variant,
      touching: input.touching,
      trackByItem: input.trackByItem ?? null,
      onItemSelect: input.onItemSelect ?? null
    };
  }
}

export const calendarCardConverter =
  CalendarCardConverter satisfies UiConverter<
    CalendarCardConverterInput<unknown>,
    CalendarCardModel<unknown>
  >;
