import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'counterBadge',
  standalone: true
})
export class CounterBadgePipe implements PipeTransform {
  transform(value: unknown, max = 9): string {
    const normalizedMax = Math.max(1, Math.trunc(Number(max) || 9));
    const normalizedValue = Math.max(0, Math.trunc(Number(value) || 0));
    return normalizedValue > normalizedMax ? `${normalizedMax}+` : `${normalizedValue}`;
  }
}
