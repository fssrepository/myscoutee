import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
import {
  HeaderProgressBarComponent,
  type HeaderProgressBarConfig,
  type HeaderProgressBarPlacement
} from '../header-progress-bar';
import {
  RatingStarBarComponent,
  type RatingStarBarConfig
} from '../rating-star-bar';
import {
  buildSmartListCalendarItemsByDate,
  buildSmartListCalendarMonthPage,
  buildSmartListCalendarWeekPage,
  countSmartListCalendarOverlaps
} from './smart-list-calendar-builder.helper';
import { SmartListPaginationHelper } from './smart-list-pagination.helper';
import type {
  ListDirection,
  ListQuery,
  PageResult,
  SmartListCursorState,
  SmartListFilters,
  SmartListCalendarConfig,
  SmartListCalendarDateRange,
  SmartListCalendarDay,
  SmartListCalendarMonthPage,
  SmartListCalendarMonthSpan,
  SmartListCalendarMonthWeek,
  SmartListCalendarTimedBadge,
  SmartListCalendarVariant,
  SmartListCalendarWeekPage,
  SmartListClassValue,
  SmartListConfig,
  SmartListGroup,
  SmartListInitialScrollAnchor,
  SmartListItemRenderState,
  SmartListItemSelectEvent,
  SmartListItemTemplateContext,
  SmartListLoadTriggerEdge,
  SmartListLoadPage,
  SmartListLoaders,
  SmartListMergeStrategy,
  SmartListPaginationMode,
  SmartListPresentation,
  SmartListPrependRestoreMode,
  SmartListStateChange,
  SmartListViewConfig,
  SmartListViewMode
} from './smart-list.types';

type SmartListCalendarPage<T> = SmartListCalendarMonthPage<T> | SmartListCalendarWeekPage<T>;
function smartListRateHeatClass(count: number): string {
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
    MatIconModule,
    HeaderProgressBarComponent,
    RatingStarBarComponent
  ],
  templateUrl: './smart-list.component.html',
  styleUrl: './smart-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmartListComponent<T, TFilters extends SmartListFilters = SmartListFilters> implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly DEFAULT_LOADING_DELAY_MS = 1500;
  private static readonly QUICK_COMPLETE_THRESHOLD_MS = 120;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private restoreAnchorSequence = 0;
  private readonly ngZone = inject(NgZone);

  @ViewChild('scrollHost')
  private scrollHostRef?: ElementRef<HTMLDivElement>;

  @Input() config: SmartListConfig<T, TFilters> = {};
  @Input() loadPage: SmartListLoadPage<T, TFilters> | null = null;
  @Input() loaders: SmartListLoaders<T, TFilters> | null = null;
  @Input() itemTemplate: TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null = null;
  @Input() fullscreenItemTemplate: TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null = null;
  @Input() query: Partial<ListQuery<TFilters>> | null = null;
  @Input() view: string | null = null;
  @Input() presentation: SmartListPresentation | null = null;
  @Input() sort: string | null = null;
  @Input() direction: ListDirection | null = null;
  @Input() filters: TFilters | null = null;
  @Input() groupBy: string | null = null;

  @Output() readonly stateChange = new EventEmitter<SmartListStateChange<T, TFilters>>();
  @Output() readonly viewChange = new EventEmitter<string>();
  @Output() readonly itemSelect = new EventEmitter<SmartListItemSelectEvent<T, TFilters>>();

  protected items: T[] = [];
  protected groups: SmartListGroup<T>[] = [];
  protected prependRestoreSpacerAnchorKey: string | null = null;
  protected prependRestoreSpacerId: string | null = null;
  protected prependRestoreSpacerHeight = 0;
  protected calendarMonthPages: SmartListCalendarMonthPage<T>[] = [];
  protected calendarWeekPages: SmartListCalendarWeekPage<T>[] = [];
  protected stickyLabel = '';
  protected loading = false;
  protected initialLoading = true;

  private total = 0;
  private hasMore = true;
  private pageIndex = 0;
  private nextPageCursor: string | null = null;
  private cursorIndex = 0;
  private scrollable = false;
  private progress = 0;
  private loadingProgress = 0;
  private loadingOverdue = false;
  private currentViewKey: string | null = null;
  private currentViewMode: SmartListViewMode = 'list';
  private previousPresentation: SmartListPresentation = 'list';
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
  private calendarEdgeSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private calendarPostSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private calendarInitialPageIndexOverride: number | null = null;
  private suppressCalendarEdgeSettle = false;
  private calendarMonthAnchorPages: Date[] | null = null;
  private calendarWeekAnchorPages: Date[] | null = null;
  private readonly calendarMonthPageAnchors = new Map<string, Date>();
  private readonly calendarWeekPageAnchors = new Map<string, Date>();
  private readonly calendarPageItems = new Map<string, T[]>();
  private readonly calendarPageTotals = new Map<string, number>();
  private calendarPendingPageKey: string | null = null;
  private calendarPendingPageAnchor: Date | null = null;
  private calendarPendingVisualKey: string | null = null;
  private calendarFrozenProgress: number | null = null;
  private weekRateViewportPageKey: string | null = null;
  private forceAnimatedLoadingCompletion = false;
  private readonly paginationHelper = new SmartListPaginationHelper<T>(() => {
    this.emitState();
    this.cdr.markForCheck();
  });

  ngAfterViewInit(): void {
    this.afterViewInit = true;
    this.refreshSurfaceSoon();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const previousPresentation = this.previousPresentation;
    const nextViewKey = this.resolveViewKey();
    const previousViewKey = this.currentViewKey;
    this.currentViewKey = nextViewKey;
    this.currentViewMode = this.resolveViewMode(nextViewKey);
    this.previousPresentation = this.resolvedPresentation();

    const calendarDataInputsChanged = Boolean(
      changes['config']
      || changes['loadPage']
      || changes['loaders']
      || changes['query']
      || changes['sort']
      || changes['direction']
      || changes['filters']
      || changes['groupBy']
    );

    if (calendarDataInputsChanged) {
      this.clearCalendarPageCache();
    }

    if (changes['view'] && previousViewKey !== this.currentViewKey) {
      this.clearCalendarSettleTimers();
      this.suppressCalendarEdgeSettle = false;
      const today = AppUtils.dateOnly(new Date());
      if (this.currentViewKey === 'month') {
        this.calendarMonthFocusDate = AppUtils.startOfMonth(today);
        this.calendarMonthAnchorPages = null;
        this.calendarInitialPageIndexOverride = this.calendarAnchorRadius();
      } else if (this.currentViewKey === 'week') {
        this.calendarWeekFocusDate = AppUtils.startOfWeekMonday(today);
        this.calendarWeekAnchorPages = null;
        this.calendarInitialPageIndexOverride = this.calendarAnchorRadius();
      } else {
        this.calendarInitialPageIndexOverride = null;
      }
    }

    if (previousViewKey && previousViewKey !== this.currentViewKey && this.currentViewKey) {
      this.viewChange.emit(this.currentViewKey);
    }

    if (
      changes['config']
      || changes['loadPage']
      || changes['loaders']
      || changes['query']
      || changes['view']
      || changes['sort']
      || changes['direction']
      || changes['filters']
      || changes['groupBy']
    ) {
      this.resetAndReload();
    }

    if (previousPresentation !== this.previousPresentation && this.previousPresentation === 'fullscreen') {
      this.syncCursorIndexToVisibleListItem();
    }

    if (!this.shouldUseHostedFullscreenPagination()) {
      this.paginationHelper.reset();
    }
  }

  ngOnDestroy(): void {
    this.loadSequence += 1;
    this.clearCalendarSettleTimers();
    this.clearLoadingAnimation();
    this.paginationHelper.destroy();
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

  public headerProgressBarConfig(
    overrides: Partial<HeaderProgressBarConfig> = {},
    mode: 'surface' | 'cursor' = 'surface'
  ): HeaderProgressBarConfig {
    const cursor = this.buildCursorState();
    const loadingActive = this.isLoadingActive();
    const position = mode === 'cursor'
      ? cursor.progress
      : this.progress;
    return {
      position: loadingActive ? this.loadingProgress : position,
      state: loadingActive
        ? (this.loadingOverdue ? 'loading-overdue' : 'loading')
        : 'scrolling',
      ...overrides
    };
  }

  protected shouldRenderHostedHeaderProgressBar(): boolean {
    if (this.config.headerProgress && this.config.headerProgress.enabled !== undefined) {
      return this.resolveConfigValue(this.config.headerProgress.enabled, false);
    }
    return this.resolvedLoadingDelayMs() > 0;
  }

  protected hostedHeaderProgressBarConfig(): HeaderProgressBarConfig {
    const placement = this.resolveConfigValue<HeaderProgressBarPlacement>(this.config.headerProgress?.placement, 'inline');
    return this.headerProgressBarConfig({
      tone: this.resolveConfigValue(this.config.headerProgress?.tone, 'default'),
      placement
    }, this.resolvedHeaderProgressMode());
  }

  protected resolvedPaginationMode(): SmartListPaginationMode {
    const value = this.config.pagination?.mode;
    if (typeof value === 'function') {
      return value(this.cursorItem(), this.currentQuery());
    }
    return value ?? 'scroll';
  }

  protected shouldRenderPaginationArrows(): boolean {
    return this.resolvedPaginationMode() === 'arrows';
  }

  protected resolvedPaginationRatingBarConfig(): RatingStarBarConfig | null {
    const baseConfig = this.config.pagination?.ratingBarConfig?.(this.cursorItem(), this.currentQuery()) ?? null;
    if (!baseConfig) {
      return null;
    }
    if (!this.shouldUseHostedFullscreenPagination()) {
      return baseConfig;
    }
    return {
      ...baseConfig,
      presentation: 'fullscreen',
      dock: {
        enabled: true,
        state: 'permanent'
      }
    };
  }

  protected shouldRenderPaginationRatingBar(): boolean {
    return this.resolvedPaginationMode() === 'rating-stars' && this.resolvedPaginationRatingBarConfig() !== null;
  }

  protected resolvedPaginationRatingBarValue(): number {
    const value = this.config.pagination?.ratingBarValue?.(this.cursorItem(), this.currentQuery()) ?? 0;
    return Number.isFinite(value) ? value : 0;
  }

  protected onPaginationPrev(event: Event): void {
    event.stopPropagation();
    if (this.shouldUseHostedFullscreenPagination()) {
      void this.advanceHostedFullscreenPagination(-1);
      return;
    }
    void this.moveCursor(-1);
  }

  protected onPaginationNext(event: Event): void {
    event.stopPropagation();
    if (this.shouldUseHostedFullscreenPagination()) {
      void this.advanceHostedFullscreenPagination(1);
      return;
    }
    void this.moveCursor(1);
  }

  protected onPaginationRatingSelect(score: number): void {
    if (this.shouldUseHostedFullscreenPagination()) {
      void this.handleHostedFullscreenRatingSelect(score);
      return;
    }
    void this.config.pagination?.onRatingSelect?.(this.cursorItem(), score, this.currentQuery());
  }

  public itemsSnapshot(): ReadonlyArray<T> {
    return this.items;
  }

  public paginationHostElement(): HTMLElement | null {
    return this.hostRef.nativeElement.querySelector('.rating-star-bar-host') as HTMLElement | null;
  }

  public cursorState(): SmartListCursorState<T> {
    return this.buildCursorState();
  }

  public cursorItem(): T | null {
    return this.buildCursorState().item;
  }

  public isLoadingActive(): boolean {
    return this.loading || this.loadingProgress > 0;
  }

  public isFullscreenPaginationAnimating(): boolean {
    return this.paginationHelper.animating;
  }

  public beginHostedLoading(): void {
    this.startLoadingAnimation();
    this.emitState();
    this.cdr.markForCheck();
  }

  public endHostedLoading(): void {
    this.endLoadingAnimation();
    this.cdr.markForCheck();
  }

  public clearHostedLoading(): void {
    this.clearLoadingAnimation();
    this.emitState();
    this.cdr.markForCheck();
  }

  public replaceVisibleItems(items: readonly T[], options: { total?: number } = {}): void {
    if (this.currentViewMode !== 'list') {
      return;
    }
    this.clearLoadingAnimation();
    this.loading = false;
    this.initialLoading = false;
    this.awaitScrollReset = false;
    this.items = [...items];
    this.total = Number.isFinite(options.total)
      ? Math.max(this.items.length, Math.trunc(Number(options.total)))
      : this.items.length;
    this.hasMore = this.items.length < this.total;
    this.syncGroups();
    this.syncCursorBounds();
    this.emitState();
    this.cdr.markForCheck();
  }

  public canMoveCursor(delta: number): boolean {
    const cursor = this.buildCursorState();
    if (!Number.isFinite(delta) || delta === 0) {
      return false;
    }
    const targetIndex = cursor.index + Math.trunc(delta);
    if (targetIndex < 0) {
      return false;
    }
    return targetIndex <= cursor.total;
  }

  public async moveCursor(delta: number): Promise<boolean> {
    if (!Number.isFinite(delta) || delta === 0) {
      return false;
    }
    return this.setCursorIndex(this.buildCursorState().index + Math.trunc(delta));
  }

  public async setCursorIndex(index: number): Promise<boolean> {
    const normalizedIndex = Math.max(0, Math.trunc(index));
    this.cursorIndex = normalizedIndex;
    this.syncCursorBounds();
    this.emitState();
    this.cdr.markForCheck();

    while (this.currentViewMode === 'list' && this.items.length <= normalizedIndex && this.hasMore && !this.loading) {
      await this.loadNextPage();
    }

    if (this.currentViewMode === 'list' && this.resolvedPresentation() === 'fullscreen' && this.hasMore && !this.loading) {
      const remaining = this.items.length - (normalizedIndex + 1);
      if (remaining <= 1) {
        void this.loadNextPage();
      }
    }

    this.syncCursorBounds();
    this.emitState();
    this.cdr.markForCheck();
    return this.buildCursorState().index === normalizedIndex;
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

  protected resolvedContainerClass(): SmartListClassValue {
    return this.resolveConfigValue(this.config.containerClass, null);
  }

  protected resolvedStickyHeaderClass(): SmartListClassValue {
    return this.resolveConfigValue(this.config.stickyHeaderClass, null);
  }

  protected resolvedGroupMarkerClass(): SmartListClassValue {
    return this.resolveConfigValue(this.config.groupMarkerClass, null);
  }

  protected resolvedFooterSpacerHeight(): string | null {
    return this.resolveConfigValue(this.config.footerSpacerHeight, null);
  }

  protected resolvedPresentation(): SmartListPresentation {
    return this.presentation ?? this.resolveConfigValue(this.config.presentation, 'list');
  }

  protected resolvedSelectMode(): boolean {
    return this.resolveConfigValue(this.config.selectMode, false);
  }

  protected resolvedListLayout(): 'stack' | 'card-grid' | 'thread' {
    return this.resolveConfigValue(this.config.listLayout, 'stack');
  }

  protected resolvedDesktopColumns(): string | null {
    const value = this.resolveConfigValue(this.config.desktopColumns, null);
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return `${Math.max(1, Math.trunc(Number(value)))}`;
  }

  protected resolvedSnapMode(): 'none' | 'proximity' | 'mandatory' {
    return this.resolveConfigValue(this.config.snapMode, 'none');
  }

  protected resolvedScrollPaddingTop(): string | null {
    return this.resolveConfigValue(this.config.scrollPaddingTop, null);
  }

  protected shouldShowStickyHeader(): boolean {
    return this.config.showStickyHeader !== false;
  }

  protected shouldRenderPrependRestoreSpacer(item: T, index: number): boolean {
    if (!this.prependRestoreSpacerAnchorKey || this.prependRestoreSpacerHeight <= 0) {
      return false;
    }
    return this.itemAnchorKey(item, index) === this.prependRestoreSpacerAnchorKey;
  }

  protected onListScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    if (this.shouldShowStickyHeader()) {
      this.updateStickyLabel(target.scrollTop);
    }
    this.updateScrollProgress(target);
    this.emitState();
    this.maybeLoadMore(target);
  }

  protected onCalendarScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.updateCalendarSurface(target);
    this.emitState();
    if (!this.isCalendarMode() || this.suppressCalendarEdgeSettle) {
      return;
    }
    this.clearCalendarSettleTimers();
    this.calendarEdgeSettleTimer = setTimeout(() => {
      this.calendarEdgeSettleTimer = null;
      if (this.suppressCalendarEdgeSettle) {
        return;
      }
      this.normalizeCalendarScrollPageAlignment(target);
      const scrollLeftSnapshot = target.scrollLeft;
      this.calendarPostSettleTimer = setTimeout(() => {
        this.calendarPostSettleTimer = null;
        if (this.suppressCalendarEdgeSettle || !this.isCalendarMode()) {
          return;
        }
        if (Math.abs(target.scrollLeft - scrollLeftSnapshot) > 1) {
          return;
        }
        this.normalizeCalendarScrollPageAlignment(target);
        this.settleCalendarWindow(target);
      }, 100);
    }, 120);
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

  protected itemContext(item: T, index: number, groupLabel: string): SmartListItemTemplateContext<T, TFilters> {
    return {
      $implicit: item,
      index,
      groupLabel,
      query: this.currentQuery(),
      selectMode: this.resolvedSelectMode(),
      presentation: 'list',
      renderState: 'list'
    };
  }

  protected itemDomIndex(item: T): number {
    const index = this.items.indexOf(item);
    return index >= 0 ? index : 0;
  }

  protected resolvedFullscreenItemTemplate(): TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null {
    return this.fullscreenItemTemplate ?? this.itemTemplate;
  }

  protected shouldRenderHostedFullscreenOverlay(): boolean {
    return this.shouldUseHostedFullscreenPagination() && this.resolvedFullscreenItemTemplate() !== null;
  }

  protected hostedFullscreenCurrentItem(): T | null {
    return this.cursorItem();
  }

  protected hostedFullscreenLeavingItem(): T | null {
    return this.paginationHelper.leavingItem;
  }

  protected hostedFullscreenItemContext(
    item: T,
    renderState: SmartListItemRenderState
  ): SmartListItemTemplateContext<T, TFilters> {
    return {
      $implicit: item,
      index: this.buildCursorState().index,
      groupLabel: '',
      query: this.currentQuery(),
      selectMode: this.resolvedSelectMode(),
      presentation: 'fullscreen',
      renderState
    };
  }

  protected hostedFullscreenEmptyLabel(): string {
    if (this.isLoadingActive()) {
      return 'Loading more items';
    }
    if (this.config.emptyLabel !== undefined) {
      return this.emptyLabel();
    }
    if (this.items.length > 0 || this.total > 0) {
      return 'No cards available';
    }
    return this.emptyLabel();
  }

  protected hostedFullscreenEmptyDescription(): string {
    if (this.isLoadingActive()) {
      return 'Preloading the next stack in the background.';
    }
    if (this.config.emptyDescription !== undefined) {
      return this.emptyDescription();
    }
    if (this.items.length > 0 || this.total > 0) {
      return 'Wait for more cards to load or adjust the current filter.';
    }
    return this.emptyDescription();
  }

  protected onHostedFullscreenLeaveAnimationEnd(event: AnimationEvent): void {
    if (event.animationName !== 'smart-list-fullscreen-page-curl') {
      return;
    }
    if (event.currentTarget !== event.target) {
      return;
    }
    this.paginationHelper.finishTransition();
  }

  protected emptyLabel(): string {
    return this.resolveText(this.config.emptyLabel, 'No items');
  }

  protected emptyDescription(): string {
    return this.resolveText(this.config.emptyDescription, '');
  }

  protected resolvedItemTemplate(): TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null {
    return this.itemTemplate;
  }

  protected hasCalendarItems(): boolean {
    return this.currentCalendarPages().length > 0;
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

  protected isRateCountCalendarVariant(): boolean {
    return this.resolveConfigValue(this.config.calendarVariant, 'default') === 'rate-counts';
  }

  protected monthRateCount(day: SmartListCalendarDay<T>): number {
    return day.items.length;
  }

  protected weekRateDayCount(day: SmartListCalendarDay<T>): number {
    return day.items.length;
  }

  protected weekRateHourCount(day: SmartListCalendarDay<T>, hour: number): number {
    const calendar = this.calendarConfig();
    if (!calendar) {
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
      item => calendar.resolveDateRange(item, this.currentQuery())
    );
  }

  protected rateHeatClassByCount(count: number): string {
    return smartListRateHeatClass(count);
  }

  protected rateCountLabel(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    return value > 99 ? '99+' : `${value}`;
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
    this.navigateCalendarBy(-1);
  }

  protected calendarToday(event?: Event): void {
    event?.stopPropagation();
    const today = AppUtils.dateOnly(new Date());
    if (this.scrollCalendarToAnchor(today)) {
      return;
    }
    if (this.isMonthMode()) {
      this.calendarMonthFocusDate = AppUtils.startOfMonth(today);
    } else if (this.isWeekMode()) {
      this.calendarWeekFocusDate = AppUtils.startOfWeekMonday(today);
    }
    this.resetAndReload();
  }

  protected calendarNext(event?: Event): void {
    event?.stopPropagation();
    this.navigateCalendarBy(1);
  }

  private resetAndReload(): void {
    this.paginationHelper.reset();
    this.clearCalendarSettleTimers();
    this.suppressCalendarEdgeSettle = false;
    this.clearLoadingAnimation();
    this.loading = false;
    this.loadSequence += 1;
    this.items = [];
    this.groups = [];
    this.calendarMonthPages = [];
    this.calendarWeekPages = [];
    this.total = 0;
    this.pageIndex = 0;
    this.nextPageCursor = null;
    this.cursorIndex = 0;
    this.hasMore = this.currentViewMode === 'list';
    this.initialLoading = true;
    this.awaitScrollReset = false;
    this.stickyLabel = this.resolveEmptyStickyLabel();
    this.progress = 0;
    this.scrollable = false;
    this.calendarPendingPageKey = null;
    this.calendarPendingVisualKey = null;
    this.calendarFrozenProgress = null;
    this.weekRateViewportPageKey = null;

    if (this.currentViewMode === 'list') {
      this.calendarInitialPageIndexOverride = null;
      this.emitState();
      this.resetScrollSoon();
      void this.loadInitialListPages();
      return;
    }
    this.clearCalendarProgressAnchors();
    this.syncCalendarPages();
    this.seedCalendarProgress();
    this.emitState();
    this.resetScrollSoon();
    void this.loadCalendarWindow();
  }

  private async loadInitialListPages(): Promise<void> {
    const initialPageCount = this.initialPageCount();
    for (let page = 0; page < initialPageCount; page += 1) {
      await this.loadNextPage({
        isInitial: page === 0,
        applyInitialAnchor: true
      });
      if (!this.hasMore) {
        this.scheduleFinalInitialListAnchor();
        return;
      }
    }
    this.scheduleFinalInitialListAnchor();
  }

  private async loadNextPage(options: { isInitial?: boolean; applyInitialAnchor?: boolean } = {}): Promise<void> {
    const isInitial = options.isInitial === true;
    const applyInitialAnchor = options.applyInitialAnchor === true;
    const loader = this.resolveLoadPage();
    if (!loader || this.currentViewMode !== 'list') {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    const query = this.loadQuery(this.pageIndex, isInitial);
    const sequence = ++this.loadSequence;
    this.loading = true;
    this.startLoadingAnimation();
    this.emitState();

    const shouldUseManualPrependRestore = !isInitial
      && this.listMergeStrategy() === 'prepend'
      && this.prependRestoreMode() === 'manual';
    const shouldUseNativePrependReveal = !isInitial
      && this.listMergeStrategy() === 'prepend'
      && this.prependRestoreMode() === 'native';
    const restoreContext = shouldUseManualPrependRestore
      ? this.captureListRestoreContext(isInitial)
      : null;
    let handledManualPrepend = false;
    let shouldAnimateEmptyAppendCompletion = false;

    try {
      const [result] = await Promise.all([
        firstValueFrom(loader(query)),
        this.wait(this.resolvedLoadingDelayMs())
      ]);

      if (sequence !== this.loadSequence) {
        return;
      }

      const nextItems = Array.isArray(result?.items) ? result.items : [];
      shouldAnimateEmptyAppendCompletion = !isInitial && nextItems.length === 0;
      this.applyListPageResult(result, isInitial);
      if (sequence !== this.loadSequence) {
        return;
      }
      if (restoreContext && shouldUseManualPrependRestore) {
        handledManualPrepend = true;
      }
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
      this.endLoadingAnimation({
        forceAnimatedCompletion: shouldAnimateEmptyAppendCompletion
      });
      this.syncGroups();
      if (handledManualPrepend && restoreContext) {
        this.cdr.detectChanges();
        this.scheduleManualPrependRestore(restoreContext);
      } else if (shouldUseNativePrependReveal) {
        this.cdr.detectChanges();
        this.scheduleNativePrependReveal();
      } else {
        this.schedulePostListLoadAdjustments(null, applyInitialAnchor);
      }
      if (applyInitialAnchor && (isInitial || (this.scrollHostRef?.nativeElement?.scrollTop ?? 0) <= 1)) {
        this.scheduleInitialListSnap();
      }
      this.emitState();
      this.cdr.markForCheck();
    }
  }

  private scheduleManualPrependRestore(
    restoreContext: {
      scrollHeight: number;
      scrollTop: number;
      restoreAnchorId: string | null;
      restoreAnchorCreatedId: boolean;
    }
  ): void {
    const run = () => {
      this.applyPrependRestore(restoreContext);
      this.emitState();
      this.cdr.markForCheck();
    };

    if (!this.afterViewInit) {
      run();
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
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
    const anchor = this.currentCalendarQueryAnchor();
    if (!anchor) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }
    await this.loadCalendarPage(anchor, true);
  }

  private applyListPageResult(result: PageResult<T> | null | undefined, isInitial: boolean): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    const hasExplicitNextCursor = Boolean(result && Object.prototype.hasOwnProperty.call(result, 'nextCursor'));
    if (isInitial) {
      this.items = [...nextItems];
    } else if (this.listMergeStrategy() === 'prepend') {
      this.items = [...nextItems, ...this.items];
    } else {
      this.items = [...this.items, ...nextItems];
    }
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : this.items.length;
    this.total = Math.max(this.items.length, total);
    this.nextPageCursor = hasExplicitNextCursor
      ? (typeof result?.nextCursor === 'string' && result.nextCursor.trim().length > 0 ? result.nextCursor : null)
      : null;
    this.hasMore = hasExplicitNextCursor
      ? this.nextPageCursor !== null
      : (nextItems.length > 0 && this.items.length < this.total);
    if (nextItems.length > 0) {
      this.pageIndex += 1;
    } else {
      this.hasMore = false;
    }
    this.initialLoading = false;
    this.syncCursorBounds();
  }

  private applyCalendarResult(anchor: Date, result: PageResult<T> | null | undefined): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    const pageKey = this.calendarPageKey(anchor);
    this.rememberCalendarPageAnchor(anchor);
    this.calendarPageItems.set(pageKey, [...nextItems]);
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : nextItems.length;
    this.calendarPageTotals.set(pageKey, Math.max(nextItems.length, total));
    this.items = [...nextItems];
    this.total = Math.max(nextItems.length, total);
    this.pageIndex = 0;
    this.hasMore = false;
    this.initialLoading = false;
    this.groups = [];
    this.syncCursorBounds();
    this.syncCalendarPages();
  }

  private maybeLoadMore(scrollElement: HTMLDivElement): void {
    if (this.currentViewMode !== 'list' || this.loading || !this.hasMore) {
      return;
    }
    const triggerEdge = this.listLoadTriggerEdge();
    const threshold = Math.max(0, this.config.preloadOffsetPx ?? (triggerEdge === 'start' ? 48 : 520));
    const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    const maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    if (this.awaitScrollReset) {
      if (triggerEdge === 'start') {
        if (scrollElement.scrollTop > Math.max(120, threshold * 2)) {
          this.awaitScrollReset = false;
        }
      } else {
        const resetThreshold = Math.max(360, threshold);
        if (remainingPx > resetThreshold || maxVerticalScroll <= resetThreshold) {
          this.awaitScrollReset = false;
        }
      }
      if (this.awaitScrollReset) {
        return;
      }
    }

    if (triggerEdge === 'start') {
      if (scrollElement.scrollTop > threshold) {
        return;
      }
      void this.loadNextPage();
      return;
    }

    if (!this.shouldStartAppendPreload(scrollElement, remainingPx, threshold)) {
      return;
    }
    void this.loadNextPage();
  }

  private shouldStartAppendPreload(
    scrollElement: HTMLDivElement,
    remainingPx: number,
    threshold: number
  ): boolean {
    if (remainingPx <= Math.max(240, threshold)) {
      return true;
    }

    const itemElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('[data-smart-list-index]')
    );
    if (itemElements.length === 0) {
      return false;
    }
    if (itemElements.length <= 3) {
      return true;
    }

    const preloadAnchor = itemElements[Math.max(0, itemElements.length - 3)];
    const viewportBottom = scrollElement.scrollTop + scrollElement.clientHeight;
    return viewportBottom >= preloadAnchor.offsetTop;
  }

  private initialPageCount(): number {
    return Math.max(1, Math.trunc(this.config.initialPageCount ?? 1));
  }

  private listLoadTriggerEdge(): SmartListLoadTriggerEdge {
    return this.config.loadTriggerEdge ?? 'end';
  }

  private listMergeStrategy(): SmartListMergeStrategy {
    return this.config.mergeStrategy ?? (this.listLoadTriggerEdge() === 'start' ? 'prepend' : 'append');
  }

  private initialListScrollAnchor(): SmartListInitialScrollAnchor {
    return this.config.initialScrollAnchor ?? (this.listLoadTriggerEdge() === 'start' ? 'end' : 'start');
  }

  private prependRestoreMode(): SmartListPrependRestoreMode {
    return this.config.prependRestoreMode ?? 'manual';
  }

  private prependRevealPx(): number {
    return Math.max(0, Number(this.config.prependRevealPx) || 0);
  }

  private listTopInset(scrollElement: HTMLElement): number {
    const threadRect = scrollElement.getBoundingClientRect();
    const stickyHeaderHeight = this.shouldShowStickyHeader()
      ? scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
    const stickyGroupMarker = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__group-marker')
    ).find(marker => {
      const rect = marker.getBoundingClientRect();
      return rect.top <= threadRect.top + 1 && rect.bottom > threadRect.top + 1;
    }) ?? null;
    if (!stickyGroupMarker) {
      return stickyHeaderHeight;
    }
    const styles = getComputedStyle(stickyGroupMarker);
    const markerMarginBottom = Number.parseFloat(styles.marginBottom || '0') || 0;
    return stickyHeaderHeight + stickyGroupMarker.getBoundingClientRect().height + markerMarginBottom;
  }

  private captureListRestoreContext(
    isInitial: boolean
  ): {
    scrollHeight: number;
    scrollTop: number;
    restoreAnchorId: string | null;
    restoreAnchorCreatedId: boolean;
  } | null {
    if (isInitial || this.listMergeStrategy() !== 'prepend') {
      return null;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement) {
      return null;
    }
    const threadRect = scrollElement.getBoundingClientRect();
    const visibleTop = threadRect.top + this.listTopInset(scrollElement);
    const anchors = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('[data-smart-list-anchor]')
    );
    const anchorElement = anchors.find(element => element.getBoundingClientRect().bottom > threadRect.top + 1)
      ?? anchors.find(element => element.getBoundingClientRect().top >= visibleTop - 1)
      ?? anchors.find(element => element.getBoundingClientRect().bottom > visibleTop + 1)
      ?? null;
    let restoreAnchorId: string | null = null;
    let restoreAnchorCreatedId = false;
    if (anchorElement) {
      const anchorKey = anchorElement.dataset['smartListAnchor'] ?? null;
      const topInset = this.listTopInset(scrollElement);
      this.clearPrependRestoreSpacerState();
      if (anchorKey && topInset > 0) {
        this.prependRestoreSpacerAnchorKey = anchorKey;
        this.prependRestoreSpacerId = `smart-list-restore-spacer-${++this.restoreAnchorSequence}`;
        this.prependRestoreSpacerHeight = topInset;
        this.cdr.detectChanges();
        scrollElement.scrollTop += topInset;
        restoreAnchorId = this.prependRestoreSpacerId;
      } else {
        restoreAnchorId = anchorElement.id;
        if (!restoreAnchorId) {
          restoreAnchorId = `smart-list-restore-anchor-${++this.restoreAnchorSequence}`;
          anchorElement.id = restoreAnchorId;
          restoreAnchorCreatedId = true;
        }
      }
    }
    return {
      scrollHeight: scrollElement.scrollHeight,
      scrollTop: scrollElement.scrollTop,
      restoreAnchorId,
      restoreAnchorCreatedId
    };
  }

  private schedulePostListLoadAdjustments(
    restoreContext: {
      scrollHeight: number;
      scrollTop: number;
      restoreAnchorId: string | null;
      restoreAnchorCreatedId: boolean;
    } | null,
    applyInitialAnchor: boolean
  ): void {
    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || this.currentViewMode !== 'list') {
        return;
      }
      if (restoreContext) {
        this.applyPrependRestore(restoreContext);
      } else if (applyInitialAnchor && this.initialListScrollAnchor() === 'end') {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
      if (this.shouldShowStickyHeader()) {
        this.updateStickyLabel(scrollElement.scrollTop);
      } else {
        this.stickyLabel = this.resolveEmptyStickyLabel();
      }
      this.updateScrollProgress(scrollElement);
      this.emitState();
      this.cdr.markForCheck();
    };

    if (!this.afterViewInit) {
      run();
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private applyPrependRestore(
    restoreContext: {
      scrollHeight: number;
      scrollTop: number;
      restoreAnchorId: string | null;
      restoreAnchorCreatedId: boolean;
    }
  ): void {
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement || this.currentViewMode !== 'list') {
      return;
    }

    let nextScrollTop = Math.max(0, restoreContext.scrollTop + Math.max(0, scrollElement.scrollHeight - restoreContext.scrollHeight));
    if (restoreContext.restoreAnchorId) {
      const restoredAnchor = document.getElementById(restoreContext.restoreAnchorId);
      if (restoredAnchor instanceof HTMLElement && scrollElement.contains(restoredAnchor)) {
        if (restoredAnchor.classList.contains('smart-list__prepend-restore-spacer')) {
          const revealPx = restoredAnchor.offsetHeight;
          restoredAnchor.scrollIntoView({ block: 'start', inline: 'nearest' });
          if (revealPx > 0) {
            this.animatePrependRestoreSpacer(restoredAnchor, scrollElement, revealPx);
          } else {
            this.clearPrependRestoreSpacerState(restoredAnchor.id);
          }
        } else {
          restoredAnchor.scrollIntoView({ block: 'start', inline: 'nearest' });
        }
        nextScrollTop = scrollElement.scrollTop;
        if (restoreContext.restoreAnchorCreatedId && restoredAnchor.id === restoreContext.restoreAnchorId) {
          restoredAnchor.removeAttribute('id');
        }
      }
    }
    scrollElement.scrollTop = nextScrollTop;

    if (this.shouldShowStickyHeader()) {
      this.updateStickyLabel(scrollElement.scrollTop);
    } else {
      this.stickyLabel = this.resolveEmptyStickyLabel();
    }
    this.updateScrollProgress(scrollElement);
  }

  private clearPrependRestoreSpacerState(expectedSpacerId: string | null = null): void {
    if (expectedSpacerId && this.prependRestoreSpacerId !== expectedSpacerId) {
      return;
    }
    this.prependRestoreSpacerAnchorKey = null;
    this.prependRestoreSpacerId = null;
    this.prependRestoreSpacerHeight = 0;
  }

  private animatePrependRestoreSpacer(spacer: HTMLElement, scrollElement: HTMLElement, revealPx: number): void {
    const remove = () => {
      this.clearPrependRestoreSpacerState(spacer.id);
      this.cdr.markForCheck();
    };

    const collapse = (startedAt: number, startScrollTop: number) => {
      if (!spacer.isConnected) {
        return;
      }
      const durationMs = 180;
      const elapsedMs = Math.max(0, performance.now() - startedAt);
      const progress = Math.min(1, elapsedMs / durationMs);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      spacer.style.height = `${Math.max(0, revealPx * (1 - easedProgress))}px`;
      scrollElement.scrollTop = Math.max(0, startScrollTop - (revealPx * easedProgress));
      if (progress >= 1) {
        remove();
        return;
      }
      globalThis.requestAnimationFrame(() => collapse(startedAt, startScrollTop));
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      const startScrollTop = scrollElement.scrollTop;
      const startedAt = performance.now();
      globalThis.requestAnimationFrame(() => collapse(startedAt, startScrollTop));
      return;
    }
    spacer.style.height = '0px';
    scrollElement.scrollTop = Math.max(0, scrollElement.scrollTop - revealPx);
    remove();
  }

  protected itemAnchorKey(item: T, index: number): string | null {
    const trackBy = this.config.trackBy;
    if (!trackBy) {
      return null;
    }
    const key = trackBy(index, item);
    return key === null || key === undefined ? null : String(key);
  }

  private scheduleNativePrependReveal(): void {
    const revealPx = this.prependRevealPx();
    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || this.currentViewMode !== 'list') {
        return;
      }
      if (revealPx > 0) {
        scrollElement.scrollTop = Math.max(0, scrollElement.scrollTop - revealPx);
      }
      if (this.shouldShowStickyHeader()) {
        this.updateStickyLabel(scrollElement.scrollTop);
      } else {
        this.stickyLabel = this.resolveEmptyStickyLabel();
      }
      this.updateScrollProgress(scrollElement);
      this.emitState();
      this.cdr.markForCheck();
    };

    if (!this.afterViewInit) {
      run();
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private scheduleFinalInitialListAnchor(): void {
    if (this.initialListScrollAnchor() !== 'end') {
      return;
    }

    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || this.currentViewMode !== 'list') {
        return;
      }
      scrollElement.scrollTop = scrollElement.scrollHeight;
      if (this.shouldShowStickyHeader()) {
        this.updateStickyLabel(scrollElement.scrollTop);
      } else {
        this.stickyLabel = this.resolveEmptyStickyLabel();
      }
      this.updateScrollProgress(scrollElement);
      this.emitState();
      this.cdr.markForCheck();
    };

    if (!this.afterViewInit) {
      run();
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(run)
        )
      );
      return;
    }
    setTimeout(run, 0);
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
      if (!this.items.length || !this.shouldShowStickyHeader()) {
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
    if (nextGroups.length === 0 || !this.shouldShowStickyHeader()) {
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
      this.items = [];
      this.total = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    const window = this.currentCalendarWindow();
    if (!window) {
      this.calendarMonthPages = [];
      this.calendarWeekPages = [];
      this.items = [];
      this.total = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    this.rememberCalendarWindowAnchors(window.anchors);

    const activeAnchor = this.currentVisibleCalendarAnchor() ?? window.focus;

    if (this.isMonthMode()) {
      this.calendarMonthPages = window.anchors.map(anchor => {
        const pageItems = this.calendarItemsForAnchor(anchor);
        const pageQuery = this.calendarQueryForAnchor(anchor);
        const resolveDateRange = (item: T) => this.calendarConfig()?.resolveDateRange(item, pageQuery) ?? null;
        const itemsByDate = buildSmartListCalendarItemsByDate(pageItems, resolveDateRange, value => this.dateKey(value));
        return buildSmartListCalendarMonthPage(anchor, itemsByDate, pageItems, resolveDateRange, {
          trackByKey: item => String(this.trackByItem(0, item)),
          dateKey: value => this.dateKey(value),
          monthKey: value => this.monthKey(value)
        });
      });
      this.calendarWeekPages = [];
      this.items = [...this.calendarItemsForAnchor(activeAnchor)];
      this.total = this.calendarPageTotals.get(this.calendarPageKey(activeAnchor)) ?? this.items.length;
      this.stickyLabel = this.calendarMonthPages.find(page => page.key === this.monthKey(activeAnchor))?.label
        ?? this.calendarMonthPages[this.initialCalendarPageIndex()]?.label
        ?? this.resolveEmptyStickyLabel();
      return;
    }

    this.calendarWeekPages = window.anchors.map(anchor => {
      const pageItems = this.calendarItemsForAnchor(anchor);
      const pageQuery = this.calendarQueryForAnchor(anchor);
      const resolveDateRange = (item: T) => this.calendarConfig()?.resolveDateRange(item, pageQuery) ?? null;
      const itemsByDate = buildSmartListCalendarItemsByDate(pageItems, resolveDateRange, value => this.dateKey(value));
      return buildSmartListCalendarWeekPage(anchor, itemsByDate, value => this.dateKey(value));
    });
    this.calendarMonthPages = [];
    this.items = [...this.calendarItemsForAnchor(activeAnchor)];
    this.total = this.calendarPageTotals.get(this.calendarPageKey(activeAnchor)) ?? this.items.length;
    this.stickyLabel = this.calendarWeekPages.find(page => page.key === this.dateKey(AppUtils.startOfWeekMonday(activeAnchor)))?.label
      ?? this.calendarWeekPages[this.initialCalendarPageIndex()]?.label
      ?? this.resolveEmptyStickyLabel();
  }

  private seedCalendarProgress(): void {
    if (!this.isCalendarMode()) {
      this.progress = 0;
      this.scrollable = false;
      return;
    }
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      this.progress = 0;
      this.scrollable = false;
      return;
    }
    this.scrollable = pages.length > 1;
    this.progress = this.calendarProgressForAnchor(this.currentCalendarQueryAnchor() ?? pages[this.desiredCalendarPageIndex(pages.length)]?.anchor ?? null);
  }

  private clearCalendarPageCache(): void {
    this.calendarPageItems.clear();
    this.calendarPageTotals.clear();
    this.calendarMonthPageAnchors.clear();
    this.calendarWeekPageAnchors.clear();
    this.calendarPendingPageKey = null;
    this.calendarPendingPageAnchor = null;
    this.calendarPendingVisualKey = null;
    this.calendarFrozenProgress = null;
  }

  private updateStickyLabel(scrollTop: number): void {
    if (!this.shouldShowStickyHeader()) {
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }
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
    const rows = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('[data-group-label]:not(.smart-list__group-marker)')
    );
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

    this.scrollable = pages.length > 1;
    if (this.calendarPendingVisualKey && this.calendarFrozenProgress !== null) {
      this.progress = this.calendarFrozenProgress;
    } else {
      this.progress = this.calendarProgressForSurface(target, pages);
    }

    const pageIndex = this.currentCalendarPageIndex(target, pages.length);
    this.stickyLabel = pages[pageIndex]?.label ?? pages[0]?.label ?? this.resolveEmptyStickyLabel();
  }

  private refreshSurfaceSoon(): void {
    const refresh = () => {
      if (this.isCalendarMode()) {
        this.updateCalendarSurface();
        this.focusVisibleWeekRateHourSoon();
      } else {
        if (this.shouldShowStickyHeader()) {
          this.updateStickyLabel(this.scrollHostRef?.nativeElement?.scrollTop ?? 0);
        } else {
          this.stickyLabel = this.resolveEmptyStickyLabel();
        }
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

  private focusVisibleWeekRateHourSoon(): void {
    if (!this.isWeekMode() || !this.isRateCountCalendarVariant()) {
      this.weekRateViewportPageKey = null;
      return;
    }

    const scrollElement = this.scrollHostRef?.nativeElement;
    const pages = this.currentCalendarPages();
    if (!scrollElement || pages.length === 0) {
      return;
    }

    const pageIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    const visiblePageKey = pages[pageIndex]?.key ?? null;
    if (!visiblePageKey || this.weekRateViewportPageKey === visiblePageKey) {
      return;
    }

    const run = () => {
      const currentScrollElement = this.scrollHostRef?.nativeElement;
      if (!currentScrollElement || !this.isWeekMode() || !this.isRateCountCalendarVariant()) {
        return;
      }
      const pageElements = Array.from(
        currentScrollElement.querySelectorAll<HTMLElement>('.smart-list__calendar-page--week')
      );
      const currentPages = this.currentCalendarPages();
      const currentPageIndex = this.currentCalendarPageIndex(currentScrollElement, currentPages.length);
      const currentVisiblePageKey = currentPages[currentPageIndex]?.key ?? null;
      if (!currentVisiblePageKey || currentVisiblePageKey !== visiblePageKey) {
        return;
      }
      const pageElement = pageElements[currentPageIndex];
      if (!pageElement) {
        return;
      }
      const firstBadge = pageElement.querySelector<HTMLElement>('.smart-list__week-rate-badge');
      this.weekRateViewportPageKey = currentVisiblePageKey;
      if (!firstBadge) {
        return;
      }
      const slot = firstBadge.closest<HTMLElement>('.smart-list__week-rate-slot');
      if (!slot) {
        return;
      }
      const targetTop = Math.max(0, slot.offsetTop - 10);
      if (Math.abs(currentScrollElement.scrollTop - targetTop) <= 1) {
        return;
      }
      currentScrollElement.scrollTop = targetTop;
      this.updateCalendarSurface(currentScrollElement);
      this.emitState();
      this.cdr.markForCheck();
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private scheduleInitialListSnap(): void {
    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || this.currentViewMode !== 'list') {
        return;
      }
      if (!this.shouldBootstrapInitialListSnap(scrollElement)) {
        return;
      }
      if (scrollElement.scrollTop > 1) {
        return;
      }
      const firstSnapTarget = scrollElement.querySelector<HTMLElement>(
        '.activities-row-item, .asset-item-card, .activities-card'
      );
      if (!firstSnapTarget) {
        return;
      }
      const maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      if (maxVerticalScroll <= 1) {
        return;
      }
      const finalTop = this.listSnapTargetTop(scrollElement, firstSnapTarget);
      const overshootTop = Math.min(maxVerticalScroll, finalTop + 28);
      if (overshootTop <= finalTop + 1) {
        return;
      }

      const previousScrollBehavior = scrollElement.style.scrollBehavior;
      scrollElement.style.scrollBehavior = 'auto';
      scrollElement.scrollTop = overshootTop;

      const settle = () => {
        const currentScrollElement = this.scrollHostRef?.nativeElement;
        if (!currentScrollElement || currentScrollElement !== scrollElement) {
          return;
        }
        scrollElement.style.scrollBehavior = previousScrollBehavior;
        scrollElement.scrollTo({ top: finalTop, behavior: 'smooth' });
      };

      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => settle());
        return;
      }
      setTimeout(settle, 0);
    };

    if (!this.afterViewInit) {
      return;
    }
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private shouldBootstrapInitialListSnap(_scrollElement: HTMLDivElement): boolean {
    return this.resolvedListLayout() === 'card-grid' && this.resolvedSnapMode() !== 'none';
  }

  private listSnapTargetTop(scrollElement: HTMLDivElement, target: HTMLElement): number {
    const computed = globalThis.getComputedStyle?.(scrollElement);
    const rawScrollPaddingTop = computed?.scrollPaddingTop
      || computed?.getPropertyValue('scroll-padding-top')
      || '';
    const parsedScrollPaddingTop = Number.parseFloat(rawScrollPaddingTop);
    const scrollPaddingTop = Number.isFinite(parsedScrollPaddingTop)
      ? parsedScrollPaddingTop
      : scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0;
    return Math.max(0, target.offsetTop - scrollPaddingTop);
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
        this.calendarInitialPageIndexOverride = null;
        const targetLeft = this.calendarPageOffsetLeft(scrollElement, initialIndex);
        if (targetLeft >= 0) {
          this.suppressCalendarEdgeSettle = true;
          const previousScrollBehavior = scrollElement.style.scrollBehavior;
          const previousSnapType = scrollElement.style.scrollSnapType;
          scrollElement.style.scrollBehavior = 'auto';
          scrollElement.style.scrollSnapType = 'none';
          scrollElement.scrollLeft = targetLeft;
          scrollElement.style.scrollBehavior = previousScrollBehavior;
          const release = () => {
            scrollElement.style.scrollSnapType = previousSnapType;
            this.suppressCalendarEdgeSettle = false;
            this.updateCalendarSurface(scrollElement);
            this.emitState();
            this.cdr.markForCheck();
          };
          if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => release());
          } else {
            setTimeout(release, 0);
          }
        } else {
          this.updateCalendarSurface(scrollElement);
        }
      } else {
        scrollElement.scrollLeft = 0;
        if (this.shouldShowStickyHeader()) {
          this.updateStickyLabel(0);
        } else {
          this.stickyLabel = this.resolveEmptyStickyLabel();
        }
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

  private endLoadingAnimation(options: { forceAnimatedCompletion?: boolean } = {}): void {
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
    const elapsed = Math.max(0, performance.now() - this.loadingStartedAtMs);
    const forceAnimatedCompletion = options.forceAnimatedCompletion === true;
    if (!forceAnimatedCompletion && elapsed < SmartListComponent.QUICK_COMPLETE_THRESHOLD_MS) {
      this.loadingProgress = 0;
      this.loadingOverdue = false;
      this.loadingStartedAtMs = 0;
      this.emitState();
      this.flushSoon();
      return;
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

  private resolvedLoadingDelayMs(): number {
    const configured = Number(this.config.loadingDelayMs);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.max(0, Math.trunc(configured));
    }
    return SmartListComponent.DEFAULT_LOADING_DELAY_MS;
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

  private buildStateChange(): SmartListStateChange<T, TFilters> {
    const loadingVisible = this.isVisibleCalendarPageLoading();
    const cursor = this.buildCursorState();
    return {
      items: this.items,
      groups: this.groups,
      query: this.currentQuery(),
      total: this.total,
      currentView: this.currentViewKey,
      hasMore: this.hasMore,
      loading: loadingVisible,
      initialLoading: this.initialLoading,
      progress: this.progress,
      loadingProgress: loadingVisible ? Math.max(this.loadingProgress, this.calendarPendingVisualKey ? 0.02 : 0) : 0,
      loadingOverdue: loadingVisible ? this.loadingOverdue : false,
      scrollable: this.scrollable,
      stickyLabel: this.stickyLabel || this.resolveEmptyStickyLabel(),
      cursorIndex: cursor.index,
      cursorTotal: cursor.total,
      cursorProgress: cursor.progress,
      cursorCanPrev: cursor.canPrev,
      cursorCanNext: cursor.canNext
    };
  }

  private resolvedHeaderProgressMode(): 'surface' | 'cursor' {
    return this.resolvedPresentation() === 'fullscreen' && this.resolvedPaginationMode() !== 'scroll'
      ? 'cursor'
      : 'surface';
  }

  private shouldUseHostedFullscreenPagination(): boolean {
    return this.currentViewMode === 'list'
      && this.resolvedPresentation() === 'fullscreen'
      && this.resolvedPaginationMode() !== 'scroll';
  }

  private syncCursorIndexToVisibleListItem(): void {
    if (!this.shouldUseHostedFullscreenPagination()) {
      return;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement || this.items.length === 0) {
      return;
    }
    const visibleIndex = this.firstVisibleListItemIndex(scrollElement);
    if (visibleIndex === null || visibleIndex === this.buildCursorState().index) {
      return;
    }
    void this.setCursorIndex(visibleIndex);
  }

  private firstVisibleListItemIndex(scrollElement: HTMLDivElement): number | null {
    const threadRect = scrollElement.getBoundingClientRect();
    const visibleTop = threadRect.top + this.listTopInset(scrollElement);
    const itemElements = Array.from(scrollElement.querySelectorAll<HTMLElement>('[data-smart-list-index]'));
    const anchorElement =
      itemElements.find(element => element.getBoundingClientRect().bottom > visibleTop + 1)
      ?? itemElements.find(element => element.getBoundingClientRect().top >= visibleTop - 1)
      ?? itemElements[0]
      ?? null;
    if (!anchorElement) {
      return null;
    }
    const rawIndex = Number.parseInt(anchorElement.dataset['smartListIndex'] ?? '', 10);
    return Number.isFinite(rawIndex) ? Math.max(0, rawIndex) : null;
  }

  private ratingAdvanceInFlight = false;

  private async handleHostedFullscreenRatingSelect(score: number): Promise<void> {
    await this.config.pagination?.onRatingSelect?.(this.cursorItem(), score, this.currentQuery());
    if (!this.shouldUseHostedFullscreenPagination() || !this.canMoveCursor(1)) {
      return;
    }
    if (this.paginationHelper.animating || this.ratingAdvanceInFlight) {
      return;
    }
    this.ratingAdvanceInFlight = true;
    try {
      await this.wait(120);
      if (!this.shouldUseHostedFullscreenPagination() || this.paginationHelper.animating) {
        return;
      }
      await this.advanceHostedFullscreenPagination(1);
    } finally {
      this.ratingAdvanceInFlight = false;
    }
  }

  private async advanceHostedFullscreenPagination(delta: number): Promise<boolean> {
    if (!this.shouldUseHostedFullscreenPagination() || this.paginationHelper.animating) {
      return false;
    }
    if (!this.canMoveCursor(delta)) {
      return false;
    }
    const targetIndex = this.buildCursorState().index + Math.trunc(delta);
    if (!await this.ensureHostedFullscreenTargetLoaded(targetIndex)) {
      return false;
    }
    const currentItem = this.cursorItem();
    if (!currentItem) {
      return this.moveCursor(delta);
    }
    this.paginationHelper.beginTransition(currentItem);
    const moved = await this.moveCursor(delta);
    if (!moved) {
      this.paginationHelper.finishTransition();
      return false;
    }
    return true;
  }

  private async ensureHostedFullscreenTargetLoaded(index: number): Promise<boolean> {
    const normalizedIndex = Math.max(0, Math.trunc(index));
    if (!this.shouldUseHostedFullscreenPagination() || normalizedIndex < this.items.length || normalizedIndex === this.total) {
      return true;
    }
    let waitTicks = 0;
    while (this.items.length <= normalizedIndex) {
      if (!this.hasMore && !this.loading) {
        return false;
      }
      if (!this.loading) {
        await this.loadNextPage();
        waitTicks = 0;
        continue;
      }
      await this.wait(16);
      waitTicks += 1;
      if (waitTicks >= 320 && this.items.length <= normalizedIndex) {
        return false;
      }
    }
    return true;
  }

  private buildCursorState(): SmartListCursorState<T> {
    const total = Math.max(0, Math.max(this.total, this.items.length));
    if (total === 0) {
      return {
        index: 0,
        total: 0,
        progress: 0,
        canPrev: false,
        canNext: false,
        item: null
      };
    }
    const index = Math.max(0, Math.min(this.cursorIndex, total));
    return {
      index,
      total,
      progress: this.clamp(index / total),
      canPrev: index > 0,
      canNext: index < total,
      item: index < this.items.length ? (this.items[index] ?? null) : null
    };
  }

  private syncCursorBounds(): void {
    const total = Math.max(0, Math.max(this.total, this.items.length));
    if (total === 0) {
      this.cursorIndex = 0;
      return;
    }
    this.cursorIndex = Math.max(0, Math.min(this.cursorIndex, total));
  }

  private isVisibleCalendarPageLoading(): boolean {
    if (!this.isCalendarMode()) {
      return this.loading || this.loadingProgress > 0;
    }
    if (this.calendarPendingVisualKey) {
      return true;
    }
    if (this.initialLoading) {
      return this.loading || this.loadingProgress > 0;
    }
    if (!this.calendarPendingPageKey) {
      return false;
    }
    const visibleAnchor = this.currentVisibleCalendarAnchor() ?? this.currentCalendarQueryAnchor();
    if (!visibleAnchor) {
      return false;
    }
    return this.calendarPageKey(visibleAnchor) === this.calendarPendingPageKey && (this.loading || this.loadingProgress > 0);
  }

  private currentQuery(page = this.pageIndex): ListQuery<TFilters> {
    const activeView = this.activeViewConfig();
    const baseQuery = this.query ?? {};
    const nextFilters = {
      ...((this.config.defaultFilters ?? {}) as TFilters),
      ...(((baseQuery.filters ?? {}) as TFilters)),
      ...((this.filters ?? {}) as TFilters)
    } as TFilters;
    const query: ListQuery<TFilters> = {
      page: this.currentViewMode === 'list' ? page : 0,
      pageSize: Math.max(1, Math.trunc(activeView?.pageSize ?? this.config.pageSize ?? 10)),
      cursor: this.currentViewMode === 'list' ? this.nextPageCursor : undefined,
      sort: this.sort ?? baseQuery.sort ?? this.config.defaultSort,
      direction: this.direction ?? baseQuery.direction ?? this.config.defaultDirection,
      filters: Object.keys(nextFilters as object).length > 0 ? nextFilters : undefined,
      groupBy: this.currentViewMode === 'list'
        ? this.groupBy ?? baseQuery.groupBy ?? activeView?.groupBy ?? this.config.defaultGroupBy
        : undefined,
      view: this.currentViewKey ?? baseQuery.view ?? undefined
    };

    if (!this.isCalendarMode()) {
      return query;
    }
    const anchor = this.currentVisibleCalendarAnchor() ?? this.currentCalendarQueryAnchor();
    return anchor ? this.calendarQueryForAnchor(anchor) : query;
  }

  private loadQuery(page = this.pageIndex, isInitial = false): ListQuery<TFilters> {
    const query = this.currentQuery(page);
    if (!isInitial) {
      return query;
    }
    const initialPageSize = this.config.initialPageSize;
    if (!Number.isFinite(initialPageSize)) {
      return query;
    }
    return {
      ...query,
      pageSize: Math.max(1, Math.trunc(Number(initialPageSize)))
    };
  }

  private resolveLoadPage(): SmartListLoadPage<T, TFilters> | null {
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
    const queryView = this.query?.view?.trim();
    if (queryView) {
      return queryView;
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

  private activeViewConfig(viewKey: string | null = this.currentViewKey): SmartListViewConfig<T, TFilters> | null {
    if (!viewKey) {
      return null;
    }
    return this.config.views?.find(view => view.key === viewKey) ?? null;
  }

  private resolveEmptyStickyLabel(): string {
    return this.resolveText(this.config.emptyStickyLabel, 'No items');
  }

  private resolveText(value: string | ((query: ListQuery<TFilters>) => string) | undefined, fallback: string): string {
    if (typeof value === 'function') {
      const resolved = value(this.currentQuery());
      return typeof resolved === 'string' && resolved.trim() ? resolved : fallback;
    }
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return fallback;
  }

  private resolveConfigValue<TValue>(value: TValue | ((query: ListQuery<TFilters>) => TValue) | undefined, fallback: TValue): TValue {
    if (typeof value === 'function') {
      return (value as (query: ListQuery<TFilters>) => TValue)(this.currentQuery());
    }
    return value ?? fallback;
  }

  private wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private calendarConfig(): SmartListCalendarConfig<T, TFilters> | null {
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
      if (!this.calendarMonthAnchorPages || this.calendarMonthAnchorPages.length === 0) {
        this.calendarMonthAnchorPages = AppUtils.buildMonthAnchorWindow(focus, this.calendarAnchorRadius());
      }
      const anchors = [...this.calendarMonthAnchorPages];
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
    if (!this.calendarWeekAnchorPages || this.calendarWeekAnchorPages.length === 0) {
      this.calendarWeekAnchorPages = AppUtils.buildWeekAnchorWindow(focus, this.calendarAnchorRadius());
    }
    const anchors = [...this.calendarWeekAnchorPages];
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

  private currentCalendarQueryAnchor(): Date | null {
    if (this.isMonthMode()) {
      return this.monthFocusDate();
    }
    if (this.isWeekMode()) {
      return this.weekFocusDate();
    }
    return null;
  }

  private calendarQueryForAnchor(anchor: Date): ListQuery<TFilters> {
    const activeView = this.activeViewConfig();
    const baseQuery = this.query ?? {};
    const nextFilters = {
      ...((this.config.defaultFilters ?? {}) as TFilters),
      ...(((baseQuery.filters ?? {}) as TFilters)),
      ...((this.filters ?? {}) as TFilters)
    } as TFilters;
    const normalizedAnchor = this.isMonthMode()
      ? AppUtils.startOfMonth(anchor)
      : AppUtils.startOfWeekMonday(anchor);
    const range = this.calendarRangeForAnchor(normalizedAnchor);
    return {
      page: 0,
      pageSize: Math.max(1, Math.trunc(activeView?.pageSize ?? this.config.pageSize ?? 10)),
      sort: this.sort ?? baseQuery.sort ?? this.config.defaultSort,
      direction: this.direction ?? baseQuery.direction ?? this.config.defaultDirection,
      filters: Object.keys(nextFilters as object).length > 0 ? nextFilters : undefined,
      view: this.currentViewKey ?? baseQuery.view ?? undefined,
      anchorDate: this.dateKey(normalizedAnchor),
      rangeStart: this.dateKey(range.start),
      rangeEnd: this.dateKey(range.end)
    };
  }

  private calendarRangeForAnchor(anchor: Date): { start: Date; end: Date } {
    if (this.isMonthMode()) {
      const monthStart = AppUtils.startOfMonth(anchor);
      return {
        start: AppUtils.startOfWeekMonday(monthStart),
        end: AppUtils.endOfWeekSunday(AppUtils.endOfMonth(monthStart))
      };
    }
    const weekStart = AppUtils.startOfWeekMonday(anchor);
    return {
      start: weekStart,
      end: AppUtils.endOfWeekSunday(weekStart)
    };
  }

  private calendarPageKey(anchor: Date): string {
    return this.isMonthMode()
      ? this.monthKey(AppUtils.startOfMonth(anchor))
      : this.dateKey(AppUtils.startOfWeekMonday(anchor));
  }

  private calendarItemsForAnchor(anchor: Date): T[] {
    return this.calendarPageItems.get(this.calendarPageKey(anchor)) ?? [];
  }

  private maybeLoadCurrentCalendarPage(scrollElement: HTMLDivElement | null = this.scrollHostRef?.nativeElement ?? null): void {
    if (!this.isCalendarMode() || !scrollElement) {
      return;
    }
    if (this.calendarPendingPageKey) {
      return;
    }
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return;
    }
    const page = pages[this.currentCalendarPageIndex(scrollElement, pages.length)];
    if (!page) {
      return;
    }
    if (this.calendarPageItems.has(page.key) || this.calendarPendingPageKey === page.key) {
      return;
    }
    void this.loadCalendarPage(page.anchor);
  }

  private async loadCalendarPage(anchor: Date, isInitial = false): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isCalendarMode()) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    const pageKey = this.calendarPageKey(anchor);
    if (this.calendarPageItems.has(pageKey)) {
      if (isInitial) {
        this.initialLoading = false;
        this.items = [...(this.calendarPageItems.get(pageKey) ?? [])];
        this.total = this.calendarPageTotals.get(pageKey) ?? this.items.length;
        this.emitState();
        this.cdr.markForCheck();
      }
      return;
    }
    if (this.calendarPendingPageKey) {
      return;
    }

    const query = this.calendarQueryForAnchor(anchor);
    const sequence = ++this.loadSequence;
    this.calendarPendingPageKey = pageKey;
    this.calendarPendingPageAnchor = this.normalizeCalendarAnchor(anchor);
    if (this.calendarPendingVisualKey !== pageKey) {
      this.calendarFrozenProgress = this.progress;
    }
    this.calendarPendingVisualKey = pageKey;
    this.loading = true;
    this.startLoadingAnimation();
    this.emitState();

    try {
      const [result] = await Promise.all([
        firstValueFrom(loader(query)),
        this.wait(this.resolvedLoadingDelayMs())
      ]);

      if (sequence !== this.loadSequence) {
        return;
      }

      this.applyCalendarResult(anchor, result);
    } catch {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.rememberCalendarPageAnchor(anchor);
      this.calendarPageItems.set(pageKey, []);
      this.calendarPageTotals.set(pageKey, 0);
      this.items = [];
      this.total = 0;
      this.initialLoading = false;
      this.hasMore = false;
      this.syncCalendarPages();
    } finally {
      if (sequence !== this.loadSequence) {
        return;
      }
      this.calendarPendingPageKey = null;
      this.calendarPendingPageAnchor = null;
      this.calendarPendingVisualKey = null;
      this.calendarFrozenProgress = null;
      this.loading = false;
      this.endLoadingAnimation();
      this.refreshSurfaceSoon();
      this.emitState();
      this.cdr.markForCheck();
      this.maybeLoadCurrentCalendarPage();
    }
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

  private navigateCalendarBy(delta: number): void {
    if (!this.isCalendarMode()) {
      return;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    const pages = this.currentCalendarPages();
    if (!scrollElement || pages.length === 0) {
      this.shiftCalendarFocus(delta);
      return;
    }
    const step = delta < 0 ? -1 : 1;
    const currentIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    const targetIndex = currentIndex + step;
    if (targetIndex >= 0 && targetIndex < pages.length) {
      this.scrollCalendarToPage(targetIndex, 'smooth');
      return;
    }
    const holdIndex = step < 0 ? 1 : Math.max(0, pages.length - 2);
    this.suppressCalendarEdgeSettle = true;
    this.shiftCalendarAnchorPages(step);
    this.syncCalendarPages();
    this.emitState();
    this.cdr.markForCheck();
    setTimeout(() => {
      const nextElement = this.scrollHostRef?.nativeElement;
      if (!nextElement) {
        this.suppressCalendarEdgeSettle = false;
        return;
      }
      const holdLeft = this.calendarPageOffsetLeft(nextElement, holdIndex);
      if (holdLeft < 0) {
        this.suppressCalendarEdgeSettle = false;
        return;
      }
      const previousScrollBehavior = nextElement.style.scrollBehavior;
      const previousSnapType = nextElement.style.scrollSnapType;
      nextElement.style.scrollBehavior = 'auto';
      nextElement.style.scrollSnapType = 'none';
      nextElement.scrollLeft = holdLeft;
      nextElement.style.scrollBehavior = previousScrollBehavior;
      const slide = () => {
        nextElement.style.scrollSnapType = previousSnapType;
        this.suppressCalendarEdgeSettle = false;
        this.updateCalendarSurface(nextElement);
        this.emitState();
        this.cdr.markForCheck();
        this.scrollCalendarToPage(holdIndex + step, 'smooth');
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => slide());
      } else {
        setTimeout(slide, 0);
      }
    }, 0);
  }

  private scrollCalendarToAnchor(anchor: Date): boolean {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return false;
    }
    const normalizedAnchor = this.isMonthMode()
      ? AppUtils.startOfMonth(anchor)
      : AppUtils.startOfWeekMonday(anchor);
    const targetKey = this.isMonthMode()
      ? this.monthKey(normalizedAnchor)
      : this.dateKey(normalizedAnchor);
    const pageIndex = pages.findIndex(page => page.key === targetKey);
    if (pageIndex < 0) {
      return false;
    }
    this.scrollCalendarToPage(pageIndex, 'smooth');
    return true;
  }

  private scrollCalendarToPage(pageIndex: number, behavior: ScrollBehavior): void {
    const scrollElement = this.scrollHostRef?.nativeElement;
    const pages = this.currentCalendarPages();
    if (!scrollElement || pages.length === 0) {
      return;
    }
    const targetIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
    const targetLeft = this.calendarPageOffsetLeft(scrollElement, targetIndex);
    if (targetLeft < 0) {
      return;
    }
    scrollElement.scrollTo({
      left: targetLeft,
      behavior
    });
    this.emitState();
    this.cdr.markForCheck();
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
    if (this.calendarInitialPageIndexOverride !== null) {
      return Math.max(0, Math.min(pages.length - 1, this.calendarInitialPageIndexOverride));
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

  private desiredCalendarPageIndex(totalPages = this.currentCalendarPages().length): number {
    if (totalPages <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(totalPages - 1, this.calendarAnchorRadius()));
  }

  private normalizeCalendarAnchor(anchor: Date): Date {
    return this.isMonthMode()
      ? AppUtils.startOfMonth(anchor)
      : AppUtils.startOfWeekMonday(anchor);
  }

  private currentCalendarPageAnchorStore(): Map<string, Date> {
    return this.isMonthMode()
      ? this.calendarMonthPageAnchors
      : this.calendarWeekPageAnchors;
  }

  private clearCalendarProgressAnchors(): void {
    this.calendarMonthPageAnchors.clear();
    this.calendarWeekPageAnchors.clear();
    this.calendarPendingPageAnchor = null;
  }

  private rememberCalendarPageAnchor(anchor: Date): void {
    const normalizedAnchor = this.normalizeCalendarAnchor(anchor);
    this.currentCalendarPageAnchorStore().set(this.calendarPageKey(normalizedAnchor), normalizedAnchor);
  }

  private rememberCalendarWindowAnchors(anchors: ReadonlyArray<Date>): void {
    const store = this.currentCalendarPageAnchorStore();
    for (const anchor of anchors) {
      const normalizedAnchor = this.normalizeCalendarAnchor(anchor);
      store.set(this.calendarPageKey(normalizedAnchor), normalizedAnchor);
    }
  }

  private calendarProgressAnchors(extraAnchors: ReadonlyArray<Date> = []): Date[] {
    const anchorsByKey = new Map<string, Date>();
    for (const [key, value] of this.currentCalendarPageAnchorStore().entries()) {
      anchorsByKey.set(key, new Date(value));
    }
    if (this.calendarPendingPageAnchor) {
      const pendingAnchor = this.normalizeCalendarAnchor(this.calendarPendingPageAnchor);
      anchorsByKey.set(this.calendarPageKey(pendingAnchor), pendingAnchor);
    }
    const currentAnchor = this.currentVisibleCalendarAnchor() ?? this.currentCalendarQueryAnchor();
    if (currentAnchor) {
      const normalizedCurrent = this.normalizeCalendarAnchor(currentAnchor);
      anchorsByKey.set(this.calendarPageKey(normalizedCurrent), normalizedCurrent);
    }
    for (const anchor of extraAnchors) {
      const normalizedAnchor = this.normalizeCalendarAnchor(anchor);
      anchorsByKey.set(this.calendarPageKey(normalizedAnchor), normalizedAnchor);
    }
    return [...anchorsByKey.values()].sort((left, right) => left.getTime() - right.getTime());
  }

  private calendarProgressIndex(anchor: Date | null, modelAnchors: ReadonlyArray<Date>): number {
    if (!anchor || modelAnchors.length === 0) {
      return 0;
    }
    const normalizedAnchor = this.normalizeCalendarAnchor(anchor);
    const targetTime = normalizedAnchor.getTime();
    const exactIndex = modelAnchors.findIndex(modelAnchor => modelAnchor.getTime() === targetTime);
    if (exactIndex >= 0) {
      return exactIndex;
    }
    const nextIndex = modelAnchors.findIndex(modelAnchor => modelAnchor.getTime() > targetTime);
    if (nextIndex < 0) {
      return modelAnchors.length - 1;
    }
    if (nextIndex === 0) {
      return 0;
    }
    return nextIndex - 1;
  }

  private calendarProgressForAnchor(anchor: Date | null): number {
    const modelAnchors = this.calendarProgressAnchors(anchor ? [anchor] : []);
    if (modelAnchors.length === 0) {
      return 0;
    }
    if (modelAnchors.length === 1) {
      return 0.5;
    }
    return this.clamp(this.calendarProgressIndex(anchor, modelAnchors) / Math.max(1, modelAnchors.length - 1));
  }

  private calendarProgressForSurface(
    scrollElement: HTMLDivElement,
    pages: ReadonlyArray<SmartListCalendarPage<T>>
  ): number {
    if (pages.length === 0) {
      return 0;
    }
    const pageWidth = this.calendarViewportWidth(scrollElement);
    const pageIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    if (pageWidth <= 0 || pages.length === 1) {
      return this.calendarProgressForAnchor(pages[pageIndex]?.anchor ?? null);
    }
    const rawPageIndex = scrollElement.scrollLeft / pageWidth;
    const lowerIndex = Math.max(0, Math.min(pages.length - 1, Math.floor(rawPageIndex)));
    const upperIndex = Math.max(0, Math.min(pages.length - 1, Math.ceil(rawPageIndex)));
    const fraction = this.clamp(rawPageIndex - lowerIndex);
    const lowerAnchor = pages[lowerIndex]?.anchor ?? null;
    const upperAnchor = pages[upperIndex]?.anchor ?? lowerAnchor;
    const modelAnchors = this.calendarProgressAnchors(
      [lowerAnchor, upperAnchor].filter((anchor): anchor is Date => anchor instanceof Date)
    );
    if (modelAnchors.length === 0) {
      return 0;
    }
    if (modelAnchors.length === 1) {
      return 0.5;
    }
    const lowerProgressIndex = this.calendarProgressIndex(lowerAnchor, modelAnchors);
    const upperProgressIndex = this.calendarProgressIndex(upperAnchor, modelAnchors);
    const interpolatedIndex = lowerProgressIndex + ((upperProgressIndex - lowerProgressIndex) * fraction);
    return this.clamp(interpolatedIndex / Math.max(1, modelAnchors.length - 1));
  }

  private clearCalendarSettleTimers(): void {
    if (this.calendarEdgeSettleTimer) {
      clearTimeout(this.calendarEdgeSettleTimer);
      this.calendarEdgeSettleTimer = null;
    }
    if (this.calendarPostSettleTimer) {
      clearTimeout(this.calendarPostSettleTimer);
      this.calendarPostSettleTimer = null;
    }
  }

  private normalizeCalendarScrollPageAlignment(calendarElement: HTMLDivElement): void {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return;
    }
    const nearestPageIndex = this.currentCalendarPageIndex(calendarElement, pages.length);
    const nearestPageLeft = this.calendarPageOffsetLeft(calendarElement, nearestPageIndex);
    if (nearestPageLeft < 0) {
      return;
    }
    if (Math.abs(calendarElement.scrollLeft - nearestPageLeft) > 0.75) {
      return;
    }
    const previousScrollBehavior = calendarElement.style.scrollBehavior;
    calendarElement.style.scrollBehavior = 'auto';
    calendarElement.scrollLeft = nearestPageLeft;
    calendarElement.style.scrollBehavior = previousScrollBehavior;
  }

  private settleCalendarWindow(scrollElement: HTMLDivElement): void {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return;
    }
    const currentIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    const activePage = pages[currentIndex];
    if (!activePage) {
      return;
    }
    const desiredIndex = this.desiredCalendarPageIndex(pages.length);
    if (currentIndex !== desiredIndex && (currentIndex === 0 || currentIndex === pages.length - 1)) {
      this.recenterCalendarWindow(activePage.anchor, desiredIndex);
      return;
    }
    this.maybeLoadCurrentCalendarPage(scrollElement);
  }

  private recenterCalendarWindow(anchor: Date, targetIndex: number): void {
    const targetPageKey = this.calendarPageKey(anchor);
    if (this.calendarPageItems.has(targetPageKey)) {
      this.calendarPendingVisualKey = null;
      this.calendarFrozenProgress = null;
    } else {
      this.calendarFrozenProgress = this.progress;
      this.calendarPendingVisualKey = targetPageKey;
    }
    if (this.isMonthMode()) {
      const normalizedAnchor = AppUtils.startOfMonth(anchor);
      this.calendarMonthFocusDate = normalizedAnchor;
      this.calendarMonthAnchorPages = AppUtils.buildMonthAnchorWindow(normalizedAnchor, this.calendarAnchorRadius());
    } else if (this.isWeekMode()) {
      const normalizedAnchor = AppUtils.startOfWeekMonday(anchor);
      this.calendarWeekFocusDate = normalizedAnchor;
      this.calendarWeekAnchorPages = AppUtils.buildWeekAnchorWindow(normalizedAnchor, this.calendarAnchorRadius());
    } else {
      return;
    }

    this.suppressCalendarEdgeSettle = true;
    this.syncCalendarPages();
    this.emitState();
    this.cdr.markForCheck();

    setTimeout(() => {
      const nextElement = this.scrollHostRef?.nativeElement;
      if (!nextElement) {
        this.suppressCalendarEdgeSettle = false;
        this.maybeLoadCurrentCalendarPage();
        this.emitState();
        this.cdr.markForCheck();
        return;
      }
      const targetLeft = this.calendarPageOffsetLeft(nextElement, targetIndex);
      if (targetLeft < 0) {
        this.suppressCalendarEdgeSettle = false;
        this.maybeLoadCurrentCalendarPage(nextElement);
        this.emitState();
        this.cdr.markForCheck();
        return;
      }
      const previousScrollBehavior = nextElement.style.scrollBehavior;
      const previousSnapType = nextElement.style.scrollSnapType;
      nextElement.style.scrollBehavior = 'auto';
      nextElement.style.scrollSnapType = 'none';
      nextElement.scrollLeft = targetLeft;
      nextElement.style.scrollBehavior = previousScrollBehavior;
      const release = () => {
        nextElement.style.scrollSnapType = previousSnapType;
        this.suppressCalendarEdgeSettle = false;
        this.updateCalendarSurface(nextElement);
        this.emitState();
        this.cdr.markForCheck();
        this.maybeLoadCurrentCalendarPage(nextElement);
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => release());
      } else {
        setTimeout(release, 0);
      }
    }, 0);
  }

  private shiftCalendarAnchorPages(direction: -1 | 1): void {
    if (this.isMonthMode()) {
      const pages = this.calendarMonthAnchorPages ?? AppUtils.buildMonthAnchorWindow(this.monthFocusDate(), this.calendarAnchorRadius());
      if (pages.length === 0) {
        return;
      }
      if (direction < 0) {
        const first = pages[0];
        this.calendarMonthAnchorPages = [AppUtils.addMonths(first, -1), ...pages.slice(0, pages.length - 1)];
      } else {
        const last = pages[pages.length - 1];
        this.calendarMonthAnchorPages = [...pages.slice(1), AppUtils.addMonths(last, 1)];
      }
      return;
    }
    if (!this.isWeekMode()) {
      return;
    }
    const pages = this.calendarWeekAnchorPages ?? AppUtils.buildWeekAnchorWindow(this.weekFocusDate(), this.calendarAnchorRadius());
    if (pages.length === 0) {
      return;
    }
    if (direction < 0) {
      const first = pages[0];
      this.calendarWeekAnchorPages = [AppUtils.addDays(first, -7), ...pages.slice(0, pages.length - 1)];
    } else {
      const last = pages[pages.length - 1];
      this.calendarWeekAnchorPages = [...pages.slice(1), AppUtils.addDays(last, 7)];
    }
  }

  private currentCalendarPageIndex(
    scrollElement: HTMLDivElement | null = this.scrollHostRef?.nativeElement ?? null,
    totalPages = this.currentCalendarPages().length
  ): number {
    if (!scrollElement || totalPages <= 1) {
      return 0;
    }
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__calendar-page')
    ).slice(0, totalPages);
    if (pageElements.length === 0) {
      const pageWidth = this.calendarViewportWidth(scrollElement) || 1;
      return Math.max(0, Math.min(totalPages - 1, Math.round(scrollElement.scrollLeft / pageWidth)));
    }
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < pageElements.length; index += 1) {
      const distance = Math.abs(scrollElement.scrollLeft - pageElements[index].offsetLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    return Math.max(0, Math.min(totalPages - 1, nearestIndex));
  }

  private calendarPageOffsetLeft(scrollElement: HTMLDivElement, pageIndex: number): number {
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__calendar-page')
    );
    const pageElement = pageElements[pageIndex];
    if (pageElement) {
      return pageElement.offsetLeft;
    }
    const pageWidth = this.calendarViewportWidth(scrollElement);
    if (pageWidth <= 0) {
      return -1;
    }
    return pageWidth * pageIndex;
  }

  private calendarViewportWidth(scrollElement: HTMLDivElement): number {
    const rectWidth = scrollElement.getBoundingClientRect().width;
    if (Number.isFinite(rectWidth) && rectWidth > 0) {
      return rectWidth;
    }
    return scrollElement.clientWidth || 0;
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

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
