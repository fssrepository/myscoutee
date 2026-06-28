import type { SmartListFilters } from '../../smart-list.types';
import type {
  SmartListPageCardModel,
  SmartListPageMode
} from '../../smart-list-page.adapter';

export type CalendarCardMode = SmartListPageMode;

export type CalendarCardModel<T, TFilters extends SmartListFilters = SmartListFilters>
  = SmartListPageCardModel<T, TFilters>;
