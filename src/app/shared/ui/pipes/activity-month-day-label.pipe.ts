import { Pipe, PipeTransform } from '@angular/core';

export function formatActivityMonthDayLabel(isoValue: string | null | undefined): string {
  const date = new Date(isoValue ?? '');
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

@Pipe({
  name: 'activityMonthDayLabel',
  standalone: true
})
export class ActivityMonthDayLabelPipe implements PipeTransform {
  transform(isoValue: string | null | undefined): string {
    return formatActivityMonthDayLabel(isoValue);
  }
}
