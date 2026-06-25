export type DateRangePrecision = 'date' | 'minute';

export interface DateRangeDto {
  startAt: string;
  endAt: string;
  precision?: DateRangePrecision;
}
