import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

import {
  countSmartListCalendarOverlaps
} from '../../smart-list-calendar-builder.helper';
import type {
  ListQuery,
  SmartListCalendarConfig,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarTimedBadge,
  SmartListCalendarVariant,
  SmartListCalendarWeekPage,
  SmartListClassValue,
  SmartListFilters
} from '../../smart-list.types';
import type { CalendarCardModel } from './calendar-card.types';

@Component({
  selector: 'app-calendar-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-card.component.html',
  styleUrl: './calendar-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarCardComponent<T, TFilters extends SmartListFilters = SmartListFilters> {
  @Input() model: CalendarCardModel<T, TFilters> | null = null;

  @HostBinding('class.is-touching')
  protected get isTouching(): boolean {
    return this.model?.touching === true;
  }

  protected readonly trackByCalendarPageKey = (
    _index: number,
    page: SmartListCalendarMonthPage<T> | SmartListCalendarWeekPage<T>
  ): string => page.key;

  protected readonly trackByCalendarMonthWeekKey = (_index: number, week: SmartListCalendarMonthWeek<T>): string =>
    `${week.start.toISOString()}-${week.end.toISOString()}`;

  protected readonly trackByCalendarDayKey = (_index: number, day: SmartListCalendarDay<T>): string => day.key;

  protected readonly trackByCalendarSpanKey = (_index: number, span: SmartListCalendarMonthSpan<T>): string => span.key;

  protected readonly trackByCalendarTimedBadge = (index: number, badge: SmartListCalendarTimedBadge<T>): unknown =>
    this.calendarTrackKey(index, badge.item);

  protected monthPages(): readonly SmartListCalendarMonthPage<T>[] {
    return this.model?.monthPages ?? [];
  }

  protected weekPages(): readonly SmartListCalendarWeekPage<T>[] {
    return this.model?.weekPages ?? [];
  }

  protected isMonthMode(): boolean {
    return this.model?.mode !== 'week';
  }

  protected isRateCountCalendarVariant(): boolean {
    return this.model?.variant === 'rate-counts';
  }

  protected calendarWeekdayLabels(): readonly string[] {
    return this.calendar()?.weekdayLabels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  protected calendarWeekHours(): number[] {
    const startHour = this.calendarWeekStartHour();
    const endHour = this.calendarWeekEndHour();
    return Array.from(
      { length: Math.max(0, endHour - startHour + 1) },
      (_value, index) => startHour + index
    );
  }

  protected weekHourLabel(hour: number): string {
    return `${`${hour}`.padStart(2, '0')}:00`;
  }

  protected monthRateCount(day: SmartListCalendarDay<T>): number {
    return day.items.length;
  }

  protected weekRateDayCount(day: SmartListCalendarDay<T>): number {
    return day.items.length;
  }

  protected weekRateHourCount(day: SmartListCalendarDay<T>, hour: number): number {
    const calendar = this.calendar();
    const query = this.query();
    if (!calendar || !query) {
      return 0;
    }
    const slotStart = new Date(day.date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return countSmartListCalendarOverlaps(
      day.items,
      slotStart,
      slotEnd,
      item => calendar.resolveDateRange(item, query)
    );
  }

  protected weekDayTimedBadges(day: SmartListCalendarDay<T>): SmartListCalendarTimedBadge<T>[] {
    const calendar = this.calendar();
    const query = this.query();
    if (!calendar || !query) {
      return [];
    }
    const dayStart = new Date(day.date);
    dayStart.setHours(this.calendarWeekStartHour(), 0, 0, 0);
    const dayEnd = new Date(day.date);
    dayEnd.setHours(this.calendarWeekEndHour() + 1, 0, 0, 0);
    const totalMinutes = Math.max(1, (dayEnd.getTime() - dayStart.getTime()) / 60000);
    const badges: SmartListCalendarTimedBadge<T>[] = [];

    for (const item of day.items) {
      const range = calendar.resolveDateRange(item, query);
      if (!range) {
        continue;
      }
      const segmentStart = new Date(Math.max(range.start.getTime(), dayStart.getTime()));
      const segmentEnd = new Date(Math.min(range.end.getTime(), dayEnd.getTime()));
      if (segmentEnd.getTime() <= segmentStart.getTime()) {
        continue;
      }
      const minutesFromTop = (segmentStart.getTime() - dayStart.getTime()) / 60000;
      const durationMinutes = (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
      badges.push({
        item,
        topPct: (minutesFromTop / totalMinutes) * 100,
        heightPct: Math.max(2.2, (durationMinutes / totalMinutes) * 100)
      });
    }

    return badges;
  }

  protected rateHeatClassByCount(count: number): string {
    if (count <= 0) {
      return 'activities-rate-heat-0';
    }
    const clamped = Math.min(100, count);
    const normalized = (clamped - 1) / 99;
    if (normalized <= 0.16) {
      return 'activities-rate-heat-1';
    }
    if (normalized <= 0.32) {
      return 'activities-rate-heat-2';
    }
    if (normalized <= 0.5) {
      return 'activities-rate-heat-3';
    }
    if (normalized <= 0.68) {
      return 'activities-rate-heat-4';
    }
    if (normalized <= 0.84) {
      return 'activities-rate-heat-5';
    }
    return 'activities-rate-heat-6';
  }

  protected rateCountLabel(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    return value > 99 ? '99+' : `${value}`;
  }

  protected calendarBadgeLabel(item: T): string {
    const query = this.query();
    const label = query ? this.calendar()?.badgeLabel?.(item, query) : null;
    if (typeof label === 'string' && label.trim()) {
      return label;
    }
    if (typeof item === 'string' || typeof item === 'number') {
      return String(item);
    }
    if (item && typeof item === 'object') {
      const candidate = (item as { title?: unknown; name?: unknown; label?: unknown }).title
        ?? (item as { name?: unknown }).name
        ?? (item as { label?: unknown }).label;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return 'Item';
  }

  protected calendarBadgeToneClass(item: T): SmartListClassValue {
    const query = this.query();
    return query ? this.calendar()?.badgeToneClass?.(item, query) ?? null : null;
  }

  protected selectItem(item: T, sourceEvent?: Event): void {
    this.model?.onItemSelect?.(item, sourceEvent);
  }

  private calendarWeekStartHour(): number {
    return Math.max(0, Math.min(23, Math.trunc(this.calendar()?.weekStartHour ?? 0)));
  }

  private calendarWeekEndHour(): number {
    return Math.max(this.calendarWeekStartHour(), Math.min(23, Math.trunc(this.calendar()?.weekEndHour ?? 23)));
  }

  private calendarTrackKey(index: number, item: T): unknown {
    return this.model?.trackByItem?.(index, item) ?? index;
  }

  private calendar(): SmartListCalendarConfig<T, TFilters> | null {
    return this.model?.calendar ?? null;
  }

  private query(): ListQuery<TFilters> | null {
    return this.model?.query ?? null;
  }
}
