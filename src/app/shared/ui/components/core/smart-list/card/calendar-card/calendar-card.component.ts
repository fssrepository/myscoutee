import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostBinding, Input, TemplateRef } from '@angular/core';

import {
  countSmartListCalendarOverlaps
} from '../../smart-list-calendar.adapter';
import type {
  ListQuery,
  SmartListCalendarConfig,
  SmartListCalendarCounter,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarTimedBadge,
  SmartListCalendarWeekPage,
  SmartListClassValue,
  SmartListFilters,
  SmartListItemTemplateContext,
  SmartListTimelineConfig,
  SmartListTimelinePage,
  SmartListTimelineSpan,
  SmartListTimelineTick
} from '../../smart-list.types';
import type { CalendarCardModel } from './calendar-card.types';

@Component({
  selector: 'app-calendar-card, app-smart-list-page-card',
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
    page: SmartListCalendarMonthPage<T> | SmartListCalendarWeekPage<T> | SmartListTimelinePage<T>
  ): string => page.key;

  protected readonly trackByCalendarMonthWeekKey = (_index: number, week: SmartListCalendarMonthWeek<T>): string =>
    `${week.start.toISOString()}-${week.end.toISOString()}`;

  protected readonly trackByCalendarDayKey = (_index: number, day: SmartListCalendarDay<T>): string => day.key;

  protected readonly trackByCalendarSpanKey = (_index: number, span: SmartListCalendarMonthSpan<T>): string => span.key;

  protected readonly trackByCalendarTimedBadge = (index: number, badge: SmartListCalendarTimedBadge<T>): unknown =>
    this.calendarTrackKey(index, badge.item);

  protected readonly trackByTimelineTickKey = (_index: number, tick: SmartListTimelineTick): string => tick.key;

  protected readonly trackByTimelineSpanKey = (_index: number, span: SmartListTimelineSpan<T>): string => span.key;

  protected monthPages(): readonly SmartListCalendarMonthPage<T>[] {
    if (this.model?.mode !== 'month') {
      return [];
    }
    return (this.model?.pages ?? []) as readonly SmartListCalendarMonthPage<T>[];
  }

  protected weekPages(): readonly SmartListCalendarWeekPage<T>[] {
    if (this.model?.mode !== 'week') {
      return [];
    }
    return (this.model?.pages ?? []) as readonly SmartListCalendarWeekPage<T>[];
  }

  protected timelinePages(): readonly SmartListTimelinePage<T>[] {
    if (this.model?.mode !== 'timeline') {
      return [];
    }
    return (this.model?.pages ?? []) as readonly SmartListTimelinePage<T>[];
  }

  protected isMonthMode(): boolean {
    return this.model?.mode === 'month';
  }

  protected isWeekMode(): boolean {
    return this.model?.mode === 'week';
  }

  protected isCounterCalendarVariant(): boolean {
    return this.model?.variant === 'counter';
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

  protected calendarCounterGranularity(): 'day' | 'hour' {
    return this.calendar()?.counterGranularity ?? 'hour';
  }

  protected calendarDayCounter(day: SmartListCalendarDay<T>): SmartListCalendarCounter | null {
    const calendar = this.calendar();
    const query = this.query();
    if (!query) {
      return null;
    }
    const customCounter = calendar?.dayCounter?.(day, query) ?? null;
    if (customCounter) {
      return customCounter;
    }
    const count = day.items.length;
    return count > 0 ? this.counterFromCount(count) : null;
  }

  protected calendarHourCounter(day: SmartListCalendarDay<T>, hour: number): SmartListCalendarCounter | null {
    const calendar = this.calendar();
    const query = this.query();
    if (!calendar || !query) {
      return null;
    }
    const customCounter = calendar.hourCounter?.(day, hour, query) ?? null;
    if (customCounter) {
      return customCounter;
    }
    const slotStart = new Date(day.date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    const count = countSmartListCalendarOverlaps(
      day.items,
      slotStart,
      slotEnd,
      item => calendar.resolveDateRange(item, query)
    );
    return count > 0 ? this.counterFromCount(count) : null;
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

  protected counterHeatClassByCount(count: number): string {
    if (count <= 0) {
      return 'calendar-counter-heat-0';
    }
    const clamped = Math.min(100, count);
    const normalized = (clamped - 1) / 99;
    if (normalized <= 0.16) {
      return 'calendar-counter-heat-1';
    }
    if (normalized <= 0.32) {
      return 'calendar-counter-heat-2';
    }
    if (normalized <= 0.5) {
      return 'calendar-counter-heat-3';
    }
    if (normalized <= 0.68) {
      return 'calendar-counter-heat-4';
    }
    if (normalized <= 0.84) {
      return 'calendar-counter-heat-5';
    }
    return 'calendar-counter-heat-6';
  }

  protected counterLabel(value: number): string {
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

  protected calendarCounterClass(counter: SmartListCalendarCounter | null): SmartListClassValue {
    return counter?.toneClass ?? null;
  }

  protected selectCalendarDay(day: SmartListCalendarDay<T>, sourceEvent?: Event): void {
    sourceEvent?.preventDefault();
    sourceEvent?.stopPropagation();
    const item = day.items[0] ?? null;
    if (!item) {
      return;
    }
    this.selectItem(item, sourceEvent, {
      calendarDate: new Date(day.date),
      calendarDateIso: day.key
    });
  }

  protected selectItem(
    item: T,
    sourceEvent?: Event,
    context?: {
      calendarDate?: Date;
      calendarDateIso?: string;
      timelineStartOffsetMinutes?: number;
      timelineEndOffsetMinutes?: number;
    }
  ): void {
    this.model?.onItemSelect?.(item, sourceEvent, context);
  }

  protected selectTimelineSpan(span: SmartListTimelineSpan<T>, sourceEvent?: Event): void {
    if (!this.timelineItemInteractive()) {
      return;
    }
    sourceEvent?.preventDefault();
    sourceEvent?.stopPropagation();
    this.selectItem(span.item, sourceEvent, {
      timelineStartOffsetMinutes: span.startOffsetMinutes,
      timelineEndOffsetMinutes: span.endOffsetMinutes
    });
  }

  protected onTimelineSpanKeydown(span: SmartListTimelineSpan<T>, event: KeyboardEvent): void {
    if (!this.timelineItemInteractive()) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    this.selectTimelineSpan(span, event);
  }

  protected timelineRows(page: SmartListTimelinePage<T>): number[] {
    return Array.from({ length: Math.max(1, page.rowCount) }, (_item, index) => index);
  }

  protected timelineItemContext(
    span: SmartListTimelineSpan<T>,
    index: number
  ): SmartListItemTemplateContext<T, TFilters> | null {
    return this.model?.itemContext?.(span.item, index) ?? null;
  }

  protected timelineItemTemplate(): TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null {
    if (!this.shouldUseTimelineItemTemplate()) {
      return null;
    }
    return this.model?.itemTemplate ?? null;
  }

  protected timelineItemInteractive(): boolean {
    const config = this.timeline();
    const query = this.query();
    const value = config?.itemInteractive;
    if (typeof value === 'function' && query) {
      return value(query) === true;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return !this.shouldUseTimelineItemTemplate();
  }

  private shouldUseTimelineItemTemplate(): boolean {
    const config = this.timeline();
    const query = this.query();
    const value = config?.useItemTemplate;
    if (typeof value === 'function' && query) {
      return value(query) === true;
    }
    return value === true;
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
    return (this.model?.config ?? null) as SmartListCalendarConfig<T, TFilters> | null;
  }

  private timeline(): SmartListTimelineConfig<T, TFilters> | null {
    return (this.model?.config ?? null) as SmartListTimelineConfig<T, TFilters> | null;
  }

  private query(): ListQuery<TFilters> | null {
    return this.model?.query ?? null;
  }

  private counterFromCount(count: number): SmartListCalendarCounter {
    return {
      label: this.counterLabel(count),
      toneClass: this.counterHeatClassByCount(count)
    };
  }
}
