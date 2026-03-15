import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { AppUtils } from '../../../app-utils';
import type {
  ListDirection,
  ListQuery,
  PageResult,
  SmartListCalendarConfig,
  SmartListCalendarDateRange,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarTimedBadge,
  SmartListCalendarWeekPage,
  SmartListClassValue,
  SmartListConfig,
  SmartListGroup,
  SmartListItemSelectEvent,
  SmartListItemTemplateContext,
  SmartListLoadPage,
  SmartListLoaders,
  SmartListStateChange,
  SmartListViewConfig,
  SmartListViewMode
} from './smart-list.types';

type SmartListCalendarPage<T> = SmartListCalendarMonthPage<T> | SmartListCalendarWeekPage<T>;
type SmartListCalendarWindow = {
  anchors: Date[];
  focus: Date;
  start: Date;
  end: Date;
};

@Component({
  selector: 'app-smart-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './smart-list.component.html',
  styleUrl: './smart-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmartListComponent<T> implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  @ViewChild('scrollHost')
  private scrollHostRef?: ElementRef<HTMLDivElement>;

  @ContentChild('smartListItemTemplate', { read: TemplateRef })
  private projectedItemTemplate?: TemplateRef<SmartListItemTemplateContext<T>>;

  @Input() config: SmartListConfig<T> = {};
  @Input() loadPage: SmartListLoadPage<T> | null = null;
  @Input() loaders: SmartListLoaders<T> | null = null;
  @Input() itemTemplate: TemplateRef<SmartListItemTemplateContext<T>> | null = null;
  @Input() view: string | null = null;
  @Input() sort: string | null = null;
  @Input() direction: ListDirection | null = null;
  @Input() filters: Record<string, unknown> | null = null;
  @Input() groupBy: string | null = null;
  @Input() containerClass: SmartListClassValue = null;
  @Input() stickyHeaderClass: SmartListClassValue = null;
  @Input() groupMarkerClass: SmartListClassValue = null;

  @Output() readonly stateChange = new EventEmitter<SmartListStateChange<T>>();
  @Output() readonly viewChange = new EventEmitter<string>();
  @Output() readonly itemSelect = new EventEmitter<SmartListItemSelectEvent<T>>();

  protected items: T[] = [];
  protected groups: SmartListGroup<T>[] = [];
  protected calendarMonthPages: SmartListCalendarMonthPage<T>[] = [];
  protected calendarWeekPages: SmartListCalendarWeekPage<T>[] = [];
  protected stickyLabel = '';
  protected loading = false;
  protected initialLoading = true;

  private total = 0;
  private hasMore = true;
  private pageIndex = 0;
  private scrollable = false;
  private progress = 0;
  private loadingProgress = 0;
  private loadingOverdue = false;
  private currentViewKey: string | null = null;
  private currentViewMode: SmartListViewMode = 'list';
  private afterViewInit = false;
  private loadSequence = 0;
  private loadingCounter = 0;
  private loadingStartedAtMs = 0;
  private loadingInterval: ReturnType<typeof setInterval> | null = null;
  private loadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private flushScheduled = false;
  private awaitScrollReset = false;
  private calendarMonthFocusDate: Date | null = null;
  private calendarWeekFocusDate: Date | null = null;

  ngAfterViewInit(): void {
    this.afterViewInit = true;
    this.refreshSurfaceSoon();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const nextViewKey = this.resolveViewKey();
    const previousViewKey = this.currentViewKey;
    this.currentViewKey = nextViewKey;
    this.currentViewMode = this.resolveViewMode(nextViewKey);

    if (previousViewKey && previousViewKey !== this.currentViewKey && this.currentViewKey) {
      this.viewChange.emit(this.currentViewKey);
    }

    if (
      changes['config']
      || changes['loadPage']
      || changes['loaders']
      || changes['view']
      || changes['sort']
      || changes['direction']
      || changes['filters']
      || changes['groupBy']
    ) {
      this.resetAndReload();
    }
  }

  ngOnDestroy(): void {
    this.loadSequence += 1;
    this.clearLoadingAnimation();
  }

  public reload(): void {
    this.resetAndReload();
  }

  public scrollElement(): HTMLDivElement | null {
    return this.scrollHostRef?.nativeElement ?? null;
  }

  public setView(viewKey: string): void {
    if (!viewKey.trim() || this.currentViewKey === viewKey) {
      return;
    }
    this.currentViewKey = viewKey;
    this.currentViewMode = this.resolveViewMode(viewKey);
    this.viewChange.emit(viewKey);
    this.reload();
  }

  protected isCalendarMode(): boolean {
    return this.currentViewMode === 'month' || this.currentViewMode === 'week';
  }

  protected isMonthMode(): boolean {
    return this.currentViewMode === 'month';
  }

  protected isWeekMode(): boolean {
    return this.currentViewMode === 'week';
  }

  protected onListScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.updateStickyLabel(target.scrollTop);
    this.updateScrollProgress(target);
    this.emitState();
    this.maybeLoadMore(target);
  }

  protected onCalendarScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.updateCalendarSurface(target);
    this.emitState();
  }

  protected readonly trackByGroup = (_index: number, group: SmartListGroup<T>): string => group.label;

  protected readonly trackByItem = (index: number, item: T): unknown =>
    this.config.trackBy ? this.config.trackBy(index, item) : index;

  protected readonly trackByCalendarPageKey = (_index: number, page: SmartListCalendarPage<T>): string => page.key;

  protected readonly trackByCalendarMonthWeekKey = (_index: number, week: SmartListCalendarMonthWeek<T>): string =>
    this.dateKey(week.start);

  protected readonly trackByCalendarDayKey = (_index: number, day: SmartListCalendarDay<T>): string => day.key;

  protected readonly trackByCalendarSpanKey = (_index: number, span: SmartListCalendarMonthSpan<T>): string => span.key;

  protected readonly trackByCalendarTimedBadge = (index: number, badge: SmartListCalendarTimedBadge<T>): unknown =>
    this.config.trackBy ? this.config.trackBy(index, badge.item) : index;

  protected shouldShowGroupMarker(group: SmartListGroup<T>, groupIndex: number): boolean {
    if (this.config.showGroupMarker) {
      return this.config.showGroupMarker({
        group,
        groupIndex,
        query: this.currentQuery(),
        scrollable: this.scrollable,
        totalGroups: this.groups.length
      });
    }
    if (groupIndex > 0) {
      return true;
    }
    return this.config.showFirstGroupMarker !== false;
  }

  protected itemContext(item: T, index: number, groupLabel: string): SmartListItemTemplateContext<T> {
    return {
      $implicit: item,
      index,
      groupLabel,
      query: this.currentQuery()
    };
  }

  protected emptyLabel(): string {
    return this.resolveText(this.config.emptyLabel, 'No items');
  }

  protected emptyDescription(): string {
    return this.resolveText(this.config.emptyDescription, '');
  }

  protected resolvedItemTemplate(): TemplateRef<SmartListItemTemplateContext<T>> | null {
    return this.itemTemplate ?? this.projectedItemTemplate ?? null;
  }

  protected hasCalendarItems(): boolean {
    return this.items.length > 0 && this.currentCalendarPages().length > 0;
  }

  protected calendarWeekdayLabels(): ReadonlyArray<string> {
    return this.config.calendar?.weekdayLabels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

  protected weekDayTimedBadges(day: SmartListCalendarDay<T>): SmartListCalendarTimedBadge<T>[] {
    const calendar = this.calendarConfig();
    if (!calendar) {
      return [];
    }
    const dayStart = new Date(day.date);
    dayStart.setHours(this.calendarWeekStartHour(), 0, 0, 0);
    const dayEnd = new Date(day.date);
    dayEnd.setHours(this.calendarWeekEndHour() + 1, 0, 0, 0);
    const totalMinutes = Math.max(1, (dayEnd.getTime() - dayStart.getTime()) / 60000);
    const badges: SmartListCalendarTimedBadge<T>[] = [];

    for (const item of day.items) {
      const range = calendar.resolveDateRange(item, this.currentQuery());
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

  protected calendarBadgeLabel(item: T): string {
    const label = this.calendarConfig()?.badgeLabel?.(item, this.currentQuery());
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
    return this.calendarConfig()?.badgeToneClass?.(item, this.currentQuery()) ?? null;
  }

  protected onCalendarItemClick(item: T, event?: Event): void {
    event?.stopPropagation();
    this.itemSelect.emit({
      item,
      query: this.currentQuery(),
      currentView: this.currentViewKey,
      currentViewMode: this.currentViewMode
    });
  }

  protected calendarPrev(event?: Event): void {
    event?.stopPropagation();
    this.shiftCalendarFocus(-1);
  }

  protected calendarToday(event?: Event): void {
    event?.stopPropagation();
    const today = AppUtils.dateOnly(new Date());
    if (this.isMonthMode()) {
      this.calendarMonthFocusDate = AppUtils.startOfMonth(today);
    } else if (this.isWeekMode()) {
      this.calendarWeekFocusDate = AppUtils.startOfWeekMonday(today);
    }
    this.resetAndReload();
  }

  protected calendarNext(event?: Event): void {
    event?.stopPropagation();
    this.shiftCalendarFocus(1);
  }

  private resetAndReload(): void {
    this.clearLoadingAnimation();
    this.loading = false;
    this.loadSequence += 1;
    this.items = [];
    this.groups = [];
    this.calendarMonthPages = [];
    this.calendarWeekPages = [];
    this.total = 0;
    this.pageIndex = 0;
    this.hasMore = this.currentViewMode === 'list';
    this.initialLoading = true;
    this.awaitScrollReset = false;
    this.stickyLabel = this.resolveEmptyStickyLabel();
    this.progress = 0;
    this.scrollable = false;
    this.emitState();
    this.resetScrollSoon();

    if (this.currentViewMode === 'list') {
      void this.loadNextPage(true);
      return;
    }
    void this.loadCalendarWindow();
  }

  private async loadNextPage(isInitial = false): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || this.currentViewMode !== 'list') {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    const query = this.currentQuery(this.pageIndex);
    const sequence = ++this.loadSequence;
    this.loading = true;
    this.startLoadingAnimation();
    this.emitState();

    try {
      const [result] = await Promise.all([
        firstValueFrom(loader(query)),
        this.wait(this.config.loadingDelayMs ?? 0)
      ]);

      if (sequence !== this.loadSequence) {
        return;
      }

      this.applyListPageResult(result, isInitial);
    } catch {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.initialLoading = false;
      this.hasMore = false;
    } finally {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.loading = false;
      this.awaitScrollReset = true;
      this.endLoadingAnimation();
      this.syncGroups();
      this.refreshSurfaceSoon();
      this.emitState();
      this.cdr.markForCheck();
    }
  }

  private async loadCalendarWindow(): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isCalendarMode()) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    const query = this.currentQuery(0);
    const sequence = ++this.loadSequence;
    this.loading = true;
    this.startLoadingAnimation();
    this.emitState();

    try {
      const [result] = await Promise.all([
        firstValueFrom(loader(query)),
        this.wait(this.config.loadingDelayMs ?? 0)
      ]);

      if (sequence !== this.loadSequence) {
        return;
      }

      this.applyCalendarResult(result);
    } catch {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.items = [];
      this.calendarMonthPages = [];
      this.calendarWeekPages = [];
      this.initialLoading = false;
      this.hasMore = false;
    } finally {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.loading = false;
      this.endLoadingAnimation();
      this.refreshSurfaceSoon();
      this.emitState();
      this.cdr.markForCheck();
    }
  }

  private applyListPageResult(result: PageResult<T> | null | undefined, isInitial: boolean): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    if (isInitial) {
      this.items = [...nextItems];
    } else {
      this.items = [...this.items, ...nextItems];
    }
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : this.items.length;
    this.total = Math.max(this.items.length, total);
    this.hasMore = nextItems.length > 0 && this.items.length < this.total;
    if (nextItems.length > 0) {
      this.pageIndex += 1;
    } else {
      this.hasMore = false;
    }
    this.initialLoading = false;
  }

  private applyCalendarResult(result: PageResult<T> | null | undefined): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    this.items = [...nextItems];
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : nextItems.length;
    this.total = Math.max(nextItems.length, total);
    this.pageIndex = 0;
    this.hasMore = false;
    this.initialLoading = false;
    this.groups = [];
    this.syncCalendarPages();
  }

  private maybeLoadMore(scrollElement: HTMLDivElement): void {
    if (this.currentViewMode !== 'list' || this.loading || !this.hasMore) {
      return;
    }
    const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    if (this.awaitScrollReset) {
      if (remainingPx > 360) {
        this.awaitScrollReset = false;
      }
      return;
    }
    if (remainingPx > Math.max(240, this.config.preloadOffsetPx ?? 520)) {
      return;
    }
    void this.loadNextPage();
  }

  private syncGroups(): void {
    if (this.currentViewMode !== 'list') {
      this.groups = [];
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    const groupBy = this.config.groupBy;
    if (!groupBy) {
      this.groups = this.items.length > 0 ? [{ label: '', items: [...this.items] }] : [];
      if (!this.items.length) {
        this.stickyLabel = this.resolveEmptyStickyLabel();
      }
      return;
    }

    const query = this.currentQuery();
    const nextGroups: SmartListGroup<T>[] = [];
    for (const item of this.items) {
      const label = groupBy(item, query);
      const lastGroup = nextGroups[nextGroups.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        nextGroups.push({ label, items: [item] });
        continue;
      }
      lastGroup.items.push(item);
    }
    this.groups = nextGroups;
    if (nextGroups.length === 0) {
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }
    if (!this.stickyLabel || this.stickyLabel === this.resolveEmptyStickyLabel()) {
      this.stickyLabel = nextGroups[0].label;
    }
  }

  private syncCalendarPages(): void {
    if (!this.isCalendarMode() || !this.calendarConfig()) {
      this.calendarMonthPages = [];
      this.calendarWeekPages = [];
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    const window = this.currentCalendarWindow();
    if (!window) {
      this.calendarMonthPages = [];
      this.calendarWeekPages = [];
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    const resolveDateRange = (item: T) => this.calendarConfig()?.resolveDateRange(item, this.currentQuery()) ?? null;
    const itemsByDate = this.buildItemsByDate(this.items, resolveDateRange);

    if (this.isMonthMode()) {
      this.calendarMonthPages = window.anchors.map(anchor =>
        this.buildMonthPage(anchor, itemsByDate, this.items, resolveDateRange)
      );
      this.calendarWeekPages = [];
      this.stickyLabel = this.calendarMonthPages[this.initialCalendarPageIndex()]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }

    this.calendarWeekPages = window.anchors.map(anchor => this.buildWeekPage(anchor, itemsByDate));
    this.calendarMonthPages = [];
    this.stickyLabel = this.calendarWeekPages[this.initialCalendarPageIndex()]?.label ?? this.resolveEmptyStickyLabel();
  }

  private updateStickyLabel(scrollTop: number): void {
    if (this.groups.length === 0) {
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement) {
      this.stickyLabel = this.groups[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.smart-list__sticky');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = scrollTop + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('[data-group-label]'));
    if (rows.length === 0) {
      this.stickyLabel = this.groups[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }
    if (scrollTop <= 1) {
      this.stickyLabel = rows[0]?.dataset['groupLabel'] ?? this.groups[0].label;
      return;
    }
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - 2) ??
      rows[rows.length - 1];
    this.stickyLabel = activeRow?.dataset['groupLabel'] ?? this.groups[0].label;
  }

  private updateScrollProgress(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    if (!target) {
      this.scrollable = false;
      this.progress = 0;
      return;
    }
    const maxVerticalScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    this.scrollable = maxVerticalScroll > 1;
    this.progress = maxVerticalScroll > 1
      ? this.clamp(target.scrollTop / maxVerticalScroll)
      : 0;
  }

  private updateCalendarSurface(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    const pages = this.currentCalendarPages();
    if (!target || pages.length === 0) {
      this.scrollable = false;
      this.progress = 0;
      this.stickyLabel = pages[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }

    const maxHorizontalScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    this.scrollable = maxHorizontalScroll > 1;
    this.progress = maxHorizontalScroll > 1
      ? this.clamp(target.scrollLeft / maxHorizontalScroll)
      : 0;

    const pageIndex = this.currentCalendarPageIndex(target, pages.length);
    this.stickyLabel = pages[pageIndex]?.label ?? pages[0]?.label ?? this.resolveEmptyStickyLabel();
  }

  private refreshSurfaceSoon(): void {
    const refresh = () => {
      if (this.isCalendarMode()) {
        this.updateCalendarSurface();
      } else {
        this.updateStickyLabel(this.scrollHostRef?.nativeElement?.scrollTop ?? 0);
        this.updateScrollProgress();
      }
      this.emitState();
      this.cdr.markForCheck();
    };
    if (!this.afterViewInit) {
      refresh();
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(refresh));
      return;
    }
    setTimeout(refresh, 0);
  }

  private resetScrollSoon(): void {
    const reset = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement) {
        return;
      }
      scrollElement.scrollTop = 0;
      if (this.isCalendarMode()) {
        const initialIndex = this.initialCalendarPageIndex();
        const pageWidth = scrollElement.clientWidth || 0;
        if (pageWidth > 0) {
          scrollElement.scrollLeft = Math.max(0, initialIndex * pageWidth);
        }
        this.updateCalendarSurface(scrollElement);
      } else {
        scrollElement.scrollLeft = 0;
        this.updateStickyLabel(0);
        this.updateScrollProgress(scrollElement);
      }
      this.emitState();
      this.cdr.markForCheck();
    };
    if (!this.afterViewInit) {
      return;
    }
    setTimeout(reset, 0);
  }

  private startLoadingAnimation(): void {
    this.loadingCounter += 1;
    if (this.loadingCounter > 1) {
      return;
    }
    this.loadingProgress = 0.02;
    this.loadingOverdue = false;
    this.loadingStartedAtMs = performance.now();
    if (this.loadingCompleteTimer) {
      clearTimeout(this.loadingCompleteTimer);
      this.loadingCompleteTimer = null;
    }
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    this.updateLoadingWindow();
    this.flushSoon();
    this.loadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.updateLoadingWindow();
        this.emitState();
        this.flushSoon();
      }, 16)
    );
  }

  private endLoadingAnimation(): void {
    if (this.loadingCounter === 0) {
      return;
    }
    this.loadingCounter = Math.max(0, this.loadingCounter - 1);
    if (this.loadingCounter !== 0) {
      return;
    }
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    this.loadingProgress = 1;
    this.loadingOverdue = false;
    this.emitState();
    this.flushSoon();
    if (this.loadingCompleteTimer) {
      clearTimeout(this.loadingCompleteTimer);
    }
    this.loadingCompleteTimer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.loadingCounter !== 0) {
            return;
          }
          this.loadingProgress = 0;
          this.loadingOverdue = false;
          this.loadingStartedAtMs = 0;
          this.loadingCompleteTimer = null;
          this.emitState();
          this.flushSoon();
          this.cdr.markForCheck();
        });
      }, 100)
    );
  }

  private clearLoadingAnimation(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    if (this.loadingCompleteTimer) {
      clearTimeout(this.loadingCompleteTimer);
      this.loadingCompleteTimer = null;
    }
    this.loadingCounter = 0;
    this.loadingProgress = 0;
    this.loadingOverdue = false;
    this.loadingStartedAtMs = 0;
  }

  private updateLoadingWindow(): void {
    if (!this.loading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.loadingStartedAtMs);
    const windowMs = Math.max(600, this.config.loadingWindowMs ?? 3000);
    const nextProgress = Math.min(1, Math.max(0, elapsed / windowMs));
    this.loadingProgress = Math.max(this.loadingProgress, nextProgress);
    this.loadingOverdue = elapsed >= windowMs && this.loadingCounter > 0;
  }

  private flushSoon(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    this.ngZone.runOutsideAngular(() => {
      const flush = () => {
        this.ngZone.run(() => {
          this.flushScheduled = false;
          this.cdr.markForCheck();
        });
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => flush());
        return;
      }
      setTimeout(flush, 0);
    });
  }

  private emitState(): void {
    this.stateChange.emit(this.buildStateChange());
  }

  private buildStateChange(): SmartListStateChange<T> {
    return {
      items: this.items,
      groups: this.groups,
      query: this.currentQuery(),
      total: this.total,
      currentView: this.currentViewKey,
      hasMore: this.hasMore,
      loading: this.loading || this.loadingProgress > 0,
      initialLoading: this.initialLoading,
      progress: this.progress,
      loadingProgress: this.loadingProgress,
      loadingOverdue: this.loadingOverdue,
      scrollable: this.scrollable,
      stickyLabel: this.stickyLabel || this.resolveEmptyStickyLabel()
    };
  }

  private currentQuery(page = this.pageIndex): ListQuery {
    const activeView = this.activeViewConfig();
    const nextFilters = {
      ...(this.config.defaultFilters ?? {}),
      ...(this.filters ?? {})
    };
    const query: ListQuery = {
      page: this.currentViewMode === 'list' ? page : 0,
      pageSize: Math.max(1, Math.trunc(activeView?.pageSize ?? this.config.pageSize ?? 10)),
      sort: this.sort ?? this.config.defaultSort,
      direction: this.direction ?? this.config.defaultDirection,
      filters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
      groupBy: this.currentViewMode === 'list'
        ? this.groupBy ?? activeView?.groupBy ?? this.config.defaultGroupBy
        : undefined,
      view: this.currentViewKey ?? undefined
    };

    const calendarWindow = this.currentCalendarWindow();
    if (!calendarWindow) {
      return query;
    }

    return {
      ...query,
      anchorDate: this.dateKey(calendarWindow.focus),
      rangeStart: this.dateKey(calendarWindow.start),
      rangeEnd: this.dateKey(calendarWindow.end)
    };
  }

  private resolveLoadPage(): SmartListLoadPage<T> | null {
    const viewKey = this.currentViewKey ?? '';
    return this.activeViewConfig()?.loadPage
      ?? this.loaders?.[viewKey]
      ?? this.loadPage;
  }

  private resolveViewKey(): string | null {
    const explicit = this.view?.trim();
    if (explicit) {
      return explicit;
    }
    const configDefault = this.config.defaultView?.trim();
    if (configDefault) {
      return configDefault;
    }
    return this.config.views?.[0]?.key ?? null;
  }

  private resolveViewMode(viewKey: string | null = this.currentViewKey): SmartListViewMode {
    const activeView = this.activeViewConfig(viewKey);
    if (activeView?.mode) {
      return activeView.mode;
    }
    if (viewKey === 'month' || viewKey === 'week') {
      return viewKey;
    }
    return 'list';
  }

  private activeViewConfig(viewKey: string | null = this.currentViewKey): SmartListViewConfig<T> | null {
    if (!viewKey) {
      return null;
    }
    return this.config.views?.find(view => view.key === viewKey) ?? null;
  }

  private resolveEmptyStickyLabel(): string {
    return this.resolveText(this.config.emptyStickyLabel, 'No items');
  }

  private resolveText(value: string | ((query: ListQuery) => string) | undefined, fallback: string): string {
    if (typeof value === 'function') {
      const resolved = value(this.currentQuery());
      return typeof resolved === 'string' && resolved.trim() ? resolved : fallback;
    }
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return fallback;
  }

  private wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private calendarConfig(): SmartListCalendarConfig<T> | null {
    return this.config.calendar ?? null;
  }

  private calendarAnchorRadius(): number {
    return Math.max(0, Math.trunc(this.calendarConfig()?.anchorRadius ?? 1));
  }

  private calendarWeekStartHour(): number {
    return Math.max(0, Math.min(23, Math.trunc(this.calendarConfig()?.weekStartHour ?? 0)));
  }

  private calendarWeekEndHour(): number {
    return Math.max(this.calendarWeekStartHour(), Math.min(23, Math.trunc(this.calendarConfig()?.weekEndHour ?? 23)));
  }

  private currentCalendarWindow(): SmartListCalendarWindow | null {
    if (!this.isCalendarMode()) {
      return null;
    }
    if (this.isMonthMode()) {
      const focus = this.monthFocusDate();
      const anchors = AppUtils.buildMonthAnchorWindow(focus, this.calendarAnchorRadius());
      const first = anchors[0] ?? focus;
      const last = anchors[anchors.length - 1] ?? focus;
      return {
        anchors,
        focus,
        start: AppUtils.startOfWeekMonday(AppUtils.startOfMonth(first)),
        end: AppUtils.endOfWeekSunday(AppUtils.endOfMonth(last))
      };
    }

    const focus = this.weekFocusDate();
    const anchors = AppUtils.buildWeekAnchorWindow(focus, this.calendarAnchorRadius());
    const first = anchors[0] ?? focus;
    const last = anchors[anchors.length - 1] ?? focus;
    return {
      anchors,
      focus,
      start: AppUtils.startOfWeekMonday(first),
      end: AppUtils.endOfWeekSunday(last)
    };
  }

  private monthFocusDate(): Date {
    const today = AppUtils.dateOnly(new Date());
    const base = this.calendarMonthFocusDate ?? today;
    return AppUtils.startOfMonth(base);
  }

  private weekFocusDate(): Date {
    const today = AppUtils.dateOnly(new Date());
    const base = this.calendarWeekFocusDate ?? today;
    return AppUtils.startOfWeekMonday(base);
  }

  private shiftCalendarFocus(delta: number): void {
    const reference = this.currentVisibleCalendarAnchor();
    if (this.isMonthMode()) {
      const base = reference ? AppUtils.startOfMonth(reference) : this.monthFocusDate();
      this.calendarMonthFocusDate = AppUtils.addMonths(base, delta);
    } else if (this.isWeekMode()) {
      const base = reference ? AppUtils.startOfWeekMonday(reference) : this.weekFocusDate();
      this.calendarWeekFocusDate = AppUtils.addDays(base, delta * 7);
    }
    this.resetAndReload();
  }

  private currentVisibleCalendarAnchor(): Date | null {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return null;
    }
    const pageIndex = this.currentCalendarPageIndex();
    return pages[pageIndex]?.anchor ?? null;
  }

  private currentCalendarPages(): SmartListCalendarPage<T>[] {
    if (this.isMonthMode()) {
      return this.calendarMonthPages;
    }
    if (this.isWeekMode()) {
      return this.calendarWeekPages;
    }
    return [];
  }

  private initialCalendarPageIndex(): number {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return 0;
    }
    const focusKey = this.isMonthMode()
      ? this.monthKey(this.monthFocusDate())
      : this.dateKey(this.weekFocusDate());
    const pageIndex = pages.findIndex(page => page.key === focusKey);
    if (pageIndex >= 0) {
      return pageIndex;
    }
    return Math.min(this.calendarAnchorRadius(), Math.max(0, pages.length - 1));
  }

  private currentCalendarPageIndex(
    scrollElement: HTMLDivElement | null = this.scrollHostRef?.nativeElement ?? null,
    totalPages = this.currentCalendarPages().length
  ): number {
    if (!scrollElement || totalPages <= 1) {
      return 0;
    }
    const pageWidth = scrollElement.clientWidth || 1;
    return Math.max(0, Math.min(totalPages - 1, Math.round(scrollElement.scrollLeft / pageWidth)));
  }

  private buildItemsByDate(
    items: T[],
    resolveDateRange: (item: T) => SmartListCalendarDateRange | null
  ): Map<string, T[]> {
    const byDate = new Map<string, T[]>();
    for (const item of items) {
      const range = resolveDateRange(item);
      if (!range) {
        continue;
      }
      let cursor = AppUtils.dateOnly(range.start);
      const endDate = AppUtils.dateOnly(range.end);
      while (cursor.getTime() <= endDate.getTime()) {
        const key = this.dateKey(cursor);
        const current = byDate.get(key) ?? [];
        current.push(item);
        byDate.set(key, current);
        cursor = AppUtils.addDays(cursor, 1);
      }
    }
    return byDate;
  }

  private buildMonthPage(
    anchor: Date,
    itemsByDate: Map<string, T[]>,
    items: T[],
    resolveDateRange: (item: T) => SmartListCalendarDateRange | null
  ): SmartListCalendarMonthPage<T> {
    const firstDay = AppUtils.startOfMonth(anchor);
    const firstWeekStart = AppUtils.startOfWeekMonday(firstDay);
    const monthEnd = AppUtils.endOfMonth(anchor);
    const lastWeekEnd = AppUtils.endOfWeekSunday(monthEnd);
    const weeks: SmartListCalendarMonthWeek<T>[] = [];
    let cursor = AppUtils.dateOnly(firstWeekStart);

    while (cursor.getTime() <= lastWeekEnd.getTime()) {
      const weekStart = AppUtils.dateOnly(cursor);
      const weekEnd = AppUtils.addDays(weekStart, 6);
      const days: SmartListCalendarDay<T>[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = AppUtils.addDays(cursor, day);
        days.push(this.buildCalendarDay(date, itemsByDate, firstDay.getMonth()));
      }
      weeks.push({
        start: weekStart,
        end: weekEnd,
        days,
        spans: this.buildMonthWeekSpans(weekStart, weekEnd, items, resolveDateRange)
      });
      cursor = AppUtils.addDays(cursor, 7);
    }

    return {
      key: this.monthKey(anchor),
      label: anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      anchor: AppUtils.startOfMonth(anchor),
      weeks
    };
  }

  private buildWeekPage(
    anchor: Date,
    itemsByDate: Map<string, T[]>
  ): SmartListCalendarWeekPage<T> {
    const start = AppUtils.startOfWeekMonday(anchor);
    const days: SmartListCalendarDay<T>[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = AppUtils.addDays(start, day);
      days.push(this.buildCalendarDay(date, itemsByDate, date.getMonth()));
    }
    const end = AppUtils.addDays(start, 6);
    return {
      key: this.dateKey(start),
      label: this.weekRangeLabel(start, end),
      anchor: start,
      days
    };
  }

  private buildMonthWeekSpans(
    weekStart: Date,
    weekEnd: Date,
    items: T[],
    resolveDateRange: (item: T) => SmartListCalendarDateRange | null
  ): SmartListCalendarMonthSpan<T>[] {
    const spansBase: Array<{ item: T; startCol: number; endCol: number }> = [];
    for (const item of items) {
      const range = resolveDateRange(item);
      if (!range) {
        continue;
      }
      const startDate = AppUtils.dateOnly(range.start);
      const endDate = AppUtils.dateOnly(range.end);
      if (!this.dateRangeOverlaps(startDate, endDate, weekStart, weekEnd)) {
        continue;
      }
      const visibleStart = startDate.getTime() < weekStart.getTime() ? weekStart : startDate;
      const visibleEnd = endDate.getTime() > weekEnd.getTime() ? weekEnd : endDate;
      spansBase.push({
        item,
        startCol: Math.max(0, this.dayDiff(weekStart, visibleStart)),
        endCol: Math.min(6, this.dayDiff(weekStart, visibleEnd))
      });
    }

    spansBase.sort((first, second) => first.startCol - second.startCol || second.endCol - first.endCol);
    const lanes: Array<Array<{ startCol: number; endCol: number }>> = [];
    const spans: SmartListCalendarMonthSpan<T>[] = [];

    for (const span of spansBase) {
      let laneIndex = 0;
      while (laneIndex < lanes.length) {
        const conflict = lanes[laneIndex].some(item => !(span.endCol < item.startCol || span.startCol > item.endCol));
        if (!conflict) {
          break;
        }
        laneIndex += 1;
      }
      if (!lanes[laneIndex]) {
        lanes[laneIndex] = [];
      }
      lanes[laneIndex].push({ startCol: span.startCol, endCol: span.endCol });
      spans.push({
        key: `${this.trackByItem(0, span.item)}-${this.dateKey(weekStart)}-${span.startCol}-${span.endCol}-${laneIndex}`,
        item: span.item,
        startCol: span.startCol,
        endCol: span.endCol,
        lane: laneIndex
      });
    }

    return spans;
  }

  private buildCalendarDay(
    date: Date,
    itemsByDate: Map<string, T[]>,
    currentMonthIndex: number
  ): SmartListCalendarDay<T> {
    const safeDate = AppUtils.dateOnly(date);
    const key = this.dateKey(safeDate);
    const todayKey = this.dateKey(AppUtils.dateOnly(new Date()));
    return {
      key,
      date: safeDate,
      dayNumber: safeDate.getDate(),
      inCurrentMonth: safeDate.getMonth() === currentMonthIndex,
      isToday: key === todayKey,
      items: itemsByDate.get(key) ?? []
    };
  }

  private weekRangeLabel(start: Date, end: Date): string {
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  private dateKey(value: Date): string {
    const copy = AppUtils.dateOnly(value);
    const year = copy.getFullYear();
    const month = `${copy.getMonth() + 1}`.padStart(2, '0');
    const day = `${copy.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private monthKey(value: Date): string {
    const copy = AppUtils.startOfMonth(value);
    const year = copy.getFullYear();
    const month = `${copy.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private dayDiff(from: Date, to: Date): number {
    const ms = AppUtils.dateOnly(to).getTime() - AppUtils.dateOnly(from).getTime();
    return Math.floor(ms / 86400000);
  }

  private dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
