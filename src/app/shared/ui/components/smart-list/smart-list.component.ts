import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Injector,
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
  ProgressIndicatorComponent,
  type ProgressIndicatorBarConfig,
  type ProgressIndicatorPlacement
} from '../progress-indicator';
import { CalendarCardComponent, type CalendarCardModel } from './card/calendar-card';
import { ROUTE_CONFIG } from '../../../core/base/config';
import {
  type RatingStarBarConfig
} from '../rating-star-bar';
import {
  AppMenuDispatcher,
  AppMenuOutletComponent,
  type AppMenuDispatchState,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../menu';
import { CalendarCardConverter } from '../../converters/calendar-card.converter';
import {
  buildSmartListCalendarItemsByDate,
  buildSmartListCalendarMonthPage,
  buildSmartListCalendarWeekPage
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
  SmartListCalendarMonthPage,
  SmartListCalendarVariant,
  SmartListCalendarWeekPage,
  SmartListClassValue,
  SmartListConfig,
  SmartListGroup,
  SmartListHeaderProgressState,
  SmartListInitialScrollAnchor,
  SmartListItemMenuContext,
  SmartListItemMenuRequest,
  SmartListItemRenderState,
  SmartListItemSelectEvent,
  SmartListItemTemplateContext,
  SmartListLoadTriggerEdge,
  SmartListLoadPage,
  SmartListLoaders,
  SmartListMergeStrategy,
  SmartListOrientation,
  SmartListPaginationMode,
  SmartListPresentation,
  SmartListPrependRestoreMode,
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
    MatIconModule,
    ProgressIndicatorComponent,
    AppMenuOutletComponent,
    CalendarCardComponent
  ],
  providers: [AppMenuDispatcher],
  templateUrl: './smart-list.component.html',
  styleUrl: './smart-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmartListComponent<T, TFilters extends SmartListFilters = SmartListFilters> implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly DEFAULT_LOADING_DELAY_MS = 0;
  private static readonly DEFAULT_LOADING_WINDOW_MS = ROUTE_CONFIG.defaultRequestTimeoutMs;
  private static readonly DEFAULT_MOBILE_BREAKPOINT_PX = 760;
  private static readonly DEFAULT_MOBILE_PAGE_SIZE_CAP = 6;
  private static readonly QUICK_COMPLETE_THRESHOLD_MS = 120;
  private static readonly HOSTED_FULLSCREEN_STACK_SIZE = 3;
  private static readonly HOSTED_FULLSCREEN_PAGE_CURL_DURATION_MS = 420;
  private static readonly LIST_SNAP_SETTLE_DELAY_MS = 250;
  private static readonly LIST_SNAP_SETTLE_GUARD_MS = 280;
  private static readonly CALENDAR_SCROLL_END_DEBOUNCE_MS = 96;
  private static readonly CALENDAR_SCROLL_STABLE_DELAY_MS = 64;
  private static readonly CALENDAR_SCROLL_SETTLE_TOLERANCE_PX = 1;
  private static readonly CALENDAR_DIRECTION_COMMIT_MIN_PX = 32;
  private static readonly CALENDAR_DIRECTION_COMMIT_RATIO = 0.12;
  private static readonly PAGINATION_RATING_MENU_ID = 'smart-list-pagination-rating';
  private static readonly PAGINATION_RATING_ITEM_ID = 'pagination-rating';
  private static readonly LIST_CARD_SNAP_TARGET_SELECTOR =
    '.activities-row-item, .asset-item-card, .activities-card, .event-explore-card, .experience-item-card';
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  protected readonly itemTemplateInjector = inject(Injector);
  private readonly itemMenuDispatcher = inject(AppMenuDispatcher);
  private restoreAnchorSequence = 0;
  private readonly ngZone = inject(NgZone);

  @ViewChild('scrollHost', { read: ElementRef })
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
  @Output() readonly menuItemSelect = new EventEmitter<AppMenuItemSelectEvent<string, unknown>>();

  protected items: T[] = [];
  protected groups: SmartListGroup<T>[] = [];
  protected prependRestoreSpacerAnchorKey: string | null = null;
  protected prependRestoreSpacerId: string | null = null;
  protected prependRestoreSpacerHeight = 0;
  protected calendarMonthPages: SmartListCalendarMonthPage<T>[] = [];
  protected calendarWeekPages: SmartListCalendarWeekPage<T>[] = [];
  protected stickyLabel = '';
  protected stickyHeaderHeightPx = 0;
  protected autoFooterSpacerHeightPx = 0;
  protected loading = false;
  protected initialLoading = true;
  protected suppressListSnapNearEnd = false;
  protected horizontalListScrollInProgress = false;

  private total = 0;
  private resolvedListTrackKeys: Array<string | number> = [];
  private fallbackTrackKeyByObject = new WeakMap<object, string>();
  private listItemIndexByObject = new WeakMap<object, number>();
  private resolvedListTrackKeyByObject = new WeakMap<object, string | number>();
  private fallbackTrackKeySequence = 0;

  totalItemCount(): number {
    return this.total;
  }

  protected onDispatchedMenuItemSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    this.menuItemSelect.emit(event);
  }

  protected onMenuOutletItemSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.isPaginationRatingMenuSelect(event)) {
      const score = Number(event.value);
      if (Number.isFinite(score)) {
        this.onPaginationRatingSelect(score);
      }
      return;
    }
    this.refreshSurfaceSoon();
    this.onDispatchedMenuItemSelect(event);
  }

  protected dispatchedMenuItems(): readonly AppMenuItem<string, unknown>[] | null {
    const menu = this.itemMenuDispatcher.activeMenu() as AppMenuDispatchState<string, unknown> | null;
    if (!menu) {
      return null;
    }
    const itemMenu = this.itemMenuContext(menu.context);
    return this.config.menuItems?.({
      menu,
      query: this.currentQuery(),
      items: this.items,
      item: itemMenu?.item ?? null,
      itemId: itemMenu?.itemId ?? null,
      request: itemMenu?.request ?? null
    }) ?? menu.items;
  }

  private itemMenuContext(context: unknown): SmartListItemMenuContext<T> | null {
    if (!context || typeof context !== 'object') {
      return null;
    }
    const candidate = context as Partial<SmartListItemMenuContext<T>>;
    return candidate.menu === 'smart-list-item' && typeof candidate.itemId === 'string'
      ? candidate as SmartListItemMenuContext<T>
      : null;
  }

  protected openItemMenu(item: T, request: SmartListItemMenuRequest): void {
    const itemId = `${request.id ?? ''}`.trim();
    if (!itemId) {
      return;
    }
    const menuId = `smart-list-item:${itemId}`;
    if (this.itemMenuDispatcher.isOpen(menuId)) {
      this.itemMenuDispatcher.close(menuId);
      this.refreshSurfaceSoon();
      return;
    }
    this.itemMenuDispatcher.open({
      id: menuId,
      kind: request.kind ?? 'select',
      title: request.title ?? null,
      items: request.items ?? [],
      context: {
        menu: 'smart-list-item',
        itemId,
        item,
        request
      },
      triggerRect: request.triggerRect ?? null,
      openUp: request.openUp === true,
      panelAlign: request.panelAlign ?? 'auto',
      panelMode: request.panelMode ?? 'auto',
      closeOnSelect: request.closeOnSelect !== false,
      onClose: () => {
        request.closeTrigger?.();
        this.refreshSurfaceSoon();
      }
    }, null);
    if (request.panelMode === 'dock' && this.resolvedPresentation() !== 'fullscreen') {
      this.revealDockedItemMenuSoon(item);
    }
  }

  menuOpen(): boolean {
    return this.itemMenuDispatcher.activeMenu() !== null;
  }

  isMenuOpen(id: string): boolean {
    return this.itemMenuDispatcher.isOpen(id);
  }

  closeMenu(id?: string): void {
    this.itemMenuDispatcher.close(id);
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.refreshSurfaceSoon();
    this.syncHorizontalViewportAfterResize();
  }

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
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private autoplayPaused = false;
  private loadingInterval: ReturnType<typeof setInterval> | null = null;
  private loadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressVisibleLoadingProgress = false;
  private listSnapSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private listSnapSettleGuardTimer: ReturnType<typeof setTimeout> | null = null;
  private horizontalListScrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  private horizontalCursorScrollLockTargetIndex: number | null = null;
  private horizontalCursorScrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressListSnapSettle = false;
  private flushScheduled = false;
  private awaitScrollReset = false;
  private awaitScrollResetBaselineTop: number | null = null;
  private awaitScrollResetBaselineReverseDistance: number | null = null;
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
  private calendarLoadAbortController: AbortController | null = null;
  private calendarPreloadAbortController: AbortController | null = null;
  private calendarPreloadPageKey: string | null = null;
  private calendarPendingPageKey: string | null = null;
  private calendarPendingPageAnchor: Date | null = null;
  private calendarPendingVisualKey: string | null = null;
  private calendarProgrammaticTargetKey: string | null = null;
  private calendarLastSettledPageKey: string | null = null;
  private calendarScrollStartLeft: number | null = null;
  private calendarScrollDirection: -1 | 1 | null = null;
  private calendarPreparedAheadPageKey: string | null = null;
  private calendarScrollInProgress = false;
  private calendarRenderDeferred = false;
  private readonly calendarDeferredPageKeys = new Set<string>();
  private calendarFrozenProgress: number | null = null;
  private weekRateViewportPageKey: string | null = null;
  private forceAnimatedLoadingCompletion = false;
  private hostedFullscreenPendingDelta = 0;
  private hostedFullscreenCompletingTransition = false;
  private hostedFullscreenEmptyCursor = false;
  private hostedFullscreenTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  private suspendSnapReactivation = false;
  private deferSnapReactivationUntilScroll = false;
  private lastResolvedBaseSnapMode: 'none' | 'proximity' | 'mandatory' | null = null;

  private releaseDeferredSnapOnScroll(): void {
    if (!this.suspendSnapReactivation && !this.deferSnapReactivationUntilScroll) {
      return;
    }
    this.suspendSnapReactivation = false;
    this.deferSnapReactivationUntilScroll = false;
    this.cdr.markForCheck();
  }

  protected isTouchingSurface = false;
  private touchStartScrollSnapType: string | null = null;

  protected onSurfaceTouchStart(): void {
    this.isTouchingSurface = true;
    if (this.isHorizontalList()) {
      this.pausePaginationAutoplay();
    }
    this.cdr.markForCheck();

    this.clearListSnapSettleTimers();
    this.clearCalendarSettleTimers();

    const scrollElement = this.scrollHostRef?.nativeElement;
    if (scrollElement) {
      if (this.shouldUseHorizontalMobileStepper()) {
        return;
      }

      const currentTop = scrollElement.scrollTop;
      const currentLeft = scrollElement.scrollLeft;

      scrollElement.style.scrollBehavior = 'auto';
      if (this.touchStartScrollSnapType === null) {
        this.touchStartScrollSnapType = scrollElement.style.scrollSnapType;
      }
      scrollElement.style.scrollSnapType = 'none';
      scrollElement.scrollTop = currentTop;
      scrollElement.scrollLeft = currentLeft;
      scrollElement.style.scrollBehavior = '';
    }
  }

  protected onSurfaceTouchEnd(): void {
    this.isTouchingSurface = false;
    this.cdr.markForCheck();

    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement) {
      this.touchStartScrollSnapType = null;
      return;
    }
    if (!this.shouldUseHorizontalMobileStepper()) {
      scrollElement.style.scrollSnapType = this.touchStartScrollSnapType ?? '';
      this.touchStartScrollSnapType = null;
    }

    if (this.currentViewMode === 'list') {
      if (this.isHorizontalList() && !this.shouldUseHorizontalMobileStepper()) {
        this.clearHorizontalListScrollEndTimer();
      }
      if (this.shouldUseHorizontalMobileStepper()) {
        this.touchStartScrollSnapType = null;
        return;
      }
      this.scheduleListSnapSettle(scrollElement);
      return;
    }

    if (this.isCalendarMode()) {
      this.scheduleCalendarScrollEnd(scrollElement);
    }
  }

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
      this.resetPaginationAutoplay();
      this.resetAndReload();
    }

    if (previousPresentation !== this.previousPresentation && this.previousPresentation === 'fullscreen') {
      this.syncCursorIndexToVisibleListItem();
    }

    if (!this.shouldUseHostedFullscreenPagination()) {
      this.resetHostedFullscreenTransition();
    }
  }

  ngOnDestroy(): void {
    this.loadSequence += 1;
    this.calendarLoadAbortController?.abort();
    this.calendarLoadAbortController = null;
    this.calendarPreloadAbortController?.abort();
    this.calendarPreloadAbortController = null;
    this.calendarPreloadPageKey = null;
    this.calendarLastSettledPageKey = null;
    this.calendarScrollInProgress = false;
    this.calendarScrollStartLeft = null;
    this.calendarScrollDirection = null;
    this.calendarPreparedAheadPageKey = null;
    this.calendarRenderDeferred = false;
    this.calendarDeferredPageKeys.clear();
    this.clearListSnapSettleTimers();
    this.clearHorizontalCursorScrollLock();
    this.clearCalendarSettleTimers();
    this.clearLoadingAnimation();
    this.clearHostedFullscreenTransitionTimer();
    this.clearPaginationAutoplay();
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

  public progressIndicatorBarConfig(
    overrides: Partial<ProgressIndicatorBarConfig> = {},
    mode: 'surface' | 'cursor' = 'surface'
  ): ProgressIndicatorBarConfig {
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

  protected shouldRenderHostedProgressIndicator(): boolean {
    if (this.config.headerProgress && this.config.headerProgress.enabled !== undefined) {
      return this.resolveConfigValue(this.config.headerProgress.enabled, false);
    }
    return this.resolvedLoadingDelayMs() > 0;
  }

  protected hostedProgressIndicatorConfig(): ProgressIndicatorBarConfig {
    const placement = this.resolveConfigValue<ProgressIndicatorPlacement>(this.config.headerProgress?.placement, 'inline');
    const state = this.resolveConfigValue<SmartListHeaderProgressState>(this.config.headerProgress?.state, 'active');
    return this.progressIndicatorBarConfig({
      tone: this.resolveConfigValue(this.config.headerProgress?.tone, 'default'),
      placement,
      ...(state === 'inactive' ? { state: 'inactive' } : {})
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

  protected shouldRenderHorizontalPaginationDots(): boolean {
    return this.isHorizontalList() && this.buildCursorState().total > 1;
  }

  protected horizontalPaginationDotIndexes(): number[] {
    const total = this.buildCursorState().total;
    return Array.from({ length: Math.max(0, total) }, (_item, index) => index);
  }

  protected isHorizontalPaginationDotActive(index: number): boolean {
    return this.buildCursorState().index === index;
  }

  protected onHorizontalPaginationDotClick(index: number, event: Event): void {
    event.stopPropagation();
    this.pausePaginationAutoplay();
    void this.setCursorIndex(index);
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

  protected paginationRatingMenu(): AppMenuDispatchState<string, unknown> | null {
    if (!this.shouldRenderPaginationRatingBar()) {
      return null;
    }
    return {
      id: SmartListComponent.PAGINATION_RATING_MENU_ID,
      kind: 'select',
      layout: 'row',
      title: null,
      filterable: false,
      items: this.paginationRatingMenuItems(),
      model: null,
      groups: [],
      value: null,
      trigger: null,
      context: { menu: SmartListComponent.PAGINATION_RATING_MENU_ID },
      openUp: false,
      panelAlign: 'auto',
      panelMode: this.shouldUseHostedFullscreenPagination() ? 'fixed' : 'dock',
      mobileBreakpointPx: 760,
      closeOnSelect: false,
      triggerElement: null,
      triggerRect: null,
      onClose: null
    };
  }

  protected paginationRatingMenuItems(): readonly AppMenuItem<string, unknown>[] {
    const config = this.resolvedPaginationRatingBarConfig();
    if (!config) {
      return [];
    }
    return [{
      id: SmartListComponent.PAGINATION_RATING_ITEM_ID,
      kind: 'rating-bar',
      closeOnSelect: false,
      value: this.resolvedPaginationRatingBarValue(),
      ratingBarConfig: config,
      context: { menu: SmartListComponent.PAGINATION_RATING_MENU_ID }
    }];
  }

  protected resolvedPaginationRatingBarValue(): number {
    const value = this.config.pagination?.ratingBarValue?.(this.cursorItem(), this.currentQuery()) ?? 0;
    return Number.isFinite(value) ? value : 0;
  }

  protected onPaginationPrev(event: Event): void {
    event.stopPropagation();
    this.pausePaginationAutoplay();
    if (this.shouldUseHostedFullscreenPagination()) {
      this.interruptHostedFullscreenTransition();
      void this.advanceHostedFullscreenPagination(-1);
      return;
    }
    void this.moveCursor(-1);
  }

  protected onPaginationNext(event: Event): void {
    event.stopPropagation();
    this.pausePaginationAutoplay();
    if (this.shouldUseHostedFullscreenPagination()) {
      this.interruptHostedFullscreenTransition();
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

  private isPaginationRatingMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): boolean {
    const context = event.context as { menu?: string } | null | undefined;
    return context?.menu === SmartListComponent.PAGINATION_RATING_MENU_ID
      && event.id === SmartListComponent.PAGINATION_RATING_ITEM_ID;
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
    return !this.suppressVisibleLoadingProgress && (this.loading || this.loadingProgress > 0);
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
    this.hostedFullscreenEmptyCursor = false;
    this.clearLoadingAnimation();
    this.loading = false;
    this.initialLoading = false;
    this.clearAwaitScrollReset();
    this.items = [...items];
    this.total = Number.isFinite(options.total)
      ? Math.max(this.items.length, Math.trunc(Number(options.total)))
      : this.items.length;
    this.hasMore = this.items.length < this.total;
    this.syncGroups();
    this.syncCursorBounds();
    this.emitState();
    this.cdr.markForCheck();
    this.refreshSurfaceSoon();
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
    return targetIndex < cursor.total;
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
      if (remaining <= SmartListComponent.HOSTED_FULLSCREEN_STACK_SIZE - 1) {
        void this.loadNextPage();
      }
    }

    this.syncCursorBounds();
    this.scrollHorizontalListItemIntoView(normalizedIndex, 'smooth');
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
    const configuredHeight = this.resolveConfigValue(this.config.footerSpacerHeight, null);
    if (this.autoFooterSpacerHeightPx <= 0) {
      return configuredHeight;
    }
    const autoHeight = `${this.autoFooterSpacerHeightPx}px`;
    return configuredHeight ? `calc(${configuredHeight} + ${autoHeight})` : autoHeight;
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

  protected resolvedOrientation(): SmartListOrientation {
    return this.resolveConfigValue(this.config.orientation, 'vertical');
  }

  protected isHorizontalList(): boolean {
    return this.currentViewMode === 'list' && this.resolvedOrientation() === 'horizontal';
  }

  protected shouldUseCompactHorizontal(): boolean {
    return this.isHorizontalList() && this.resolveConfigValue(this.config.compactHorizontal, false);
  }

  protected shouldSuspendHorizontalSnap(): boolean {
    return this.horizontalListScrollInProgress
      && this.isCompactHorizontalViewport()
      && !this.shouldUseHorizontalMobileStepper();
  }

  protected shouldSuppressSnapDuringTouch(): boolean {
    return this.isTouchingSurface && !this.shouldUseHorizontalMobileStepper();
  }

  protected resolvedMobileStepper(): boolean {
    return this.resolveConfigValue(this.config.mobileStepper, false);
  }

  protected isReversedListFlow(): boolean {
    return this.resolveConfigValue(this.config.listFlow, 'normal') === 'reverse';
  }

  protected resolvedDesktopColumns(): string | null {
    const value = this.resolveConfigValue(this.config.desktopColumns, null);
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return `${Math.max(1, Math.trunc(Number(value)))}`;
  }

  protected resolvedSnapMode(): 'none' | 'proximity' | 'mandatory' {
    const baseSnapMode = this.resolveConfigValue(this.config.snapMode, 'none');
    const snapMode = this.shouldUseHorizontalMobileStepper() ? 'mandatory' : baseSnapMode;
    this.trackSnapModeTransition(snapMode);
    return this.deferSnapReactivationUntilScroll ? 'none' : snapMode;
  }

  private trackSnapModeTransition(snapMode: 'none' | 'proximity' | 'mandatory'): void {
    if (this.currentViewMode !== 'list') {
      this.lastResolvedBaseSnapMode = snapMode;
      this.deferSnapReactivationUntilScroll = false;
      return;
    }

    const previousSnapMode = this.lastResolvedBaseSnapMode;
    if (previousSnapMode !== null && previousSnapMode === 'none' && snapMode !== 'none') {
      this.deferSnapReactivationUntilScroll = true;
      this.clearListSnapSettleTimer();
    }
    if (snapMode === 'none') {
      this.deferSnapReactivationUntilScroll = false;
    }
    this.lastResolvedBaseSnapMode = snapMode;
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

  protected onHorizontalWheel(event: WheelEvent): void {
    if (!this.isHorizontalList()) {
      return;
    }
    const target = event.currentTarget as HTMLDivElement | null;
    if (!target) {
      return;
    }
    const maxScrollLeft = Math.max(0, target.scrollWidth - target.clientWidth);
    if (maxScrollLeft <= 1) {
      return;
    }
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }
    const rawDelta = event.deltaX;
    const delta = this.normalizedWheelDelta(rawDelta, event.deltaMode, target);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) {
      return;
    }
    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, target.scrollLeft + delta));
    if (Math.abs(nextScrollLeft - target.scrollLeft) < 0.5) {
      return;
    }
    this.pausePaginationAutoplay();
    this.beginHorizontalListScroll(target);
    event.preventDefault();
    target.scrollLeft = nextScrollLeft;
    this.syncListScrollState(target, { scheduleSnap: false });
    this.scheduleHorizontalListScrollEnd(target);
  }

  private normalizedWheelDelta(delta: number, deltaMode: number, target: HTMLDivElement): number {
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return delta * 16;
    }
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return delta * target.clientWidth;
    }
    return delta;
  }

  protected onListScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    const isHorizontal = this.isHorizontalList();
    if (isHorizontal) {
      this.beginHorizontalListScroll(target);
    }
    this.syncListScrollState(target, { scheduleSnap: !isHorizontal });
    if (isHorizontal) {
      this.scheduleHorizontalListScrollEnd(target);
    }
  }

  protected onListScrollEnd(event: Event): void {
    const target = event.target as HTMLDivElement;
    if (this.isHorizontalList()) {
      this.finishHorizontalListScroll(target);
    }
  }

  private syncListScrollState(
    target: HTMLDivElement,
    options: { scheduleSnap?: boolean } = {}
  ): void {
    this.releaseDeferredSnapOnScroll();
    if (this.shouldShowStickyHeader()) {
      this.updateStickyLabel(target.scrollTop);
    } else {
      this.stickyHeaderHeightPx = 0;
    }
    this.updateListSnapNearEndSuppression(target);
    this.updateScrollProgress(target);
    this.syncHorizontalCursorIndexToVisibleListItem(target);
    this.emitState();
    this.maybeLoadMore(target);
    if (options.scheduleSnap !== false) {
      this.scheduleListSnapSettle(target);
    }
  }

  protected onCalendarScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    if (!this.calendarScrollInProgress) {
      this.calendarScrollStartLeft = this.currentCalendarPageOffsetLeft(target);
      this.calendarPreparedAheadPageKey = null;
    }
    this.calendarScrollInProgress = true;
    this.prepareCalendarPageAheadForScroll(target);
    this.updateCalendarSurface(target);
    this.emitState();
    const visiblePage = this.currentCalendarPage(target);
    if (
      visiblePage
      && this.calendarPendingPageKey
      && this.calendarPendingPageKey !== visiblePage.key
      && (!this.calendarProgrammaticTargetKey || this.calendarProgrammaticTargetKey === visiblePage.key)
    ) {
      this.cancelPendingCalendarPageLoad();
    }
    if (this.isTouchingSurface) {
      return;
    }
    if (this.calendarProgrammaticTargetKey && visiblePage?.key !== this.calendarProgrammaticTargetKey) {
      this.scheduleCalendarScrollEnd(target);
      return;
    }
    if (visiblePage?.key === this.calendarProgrammaticTargetKey) {
      this.calendarProgrammaticTargetKey = null;
    }
    this.scheduleCalendarScrollEnd(target);
  }

  protected onCalendarScrollEnd(event: Event): void {
    this.handleCalendarScrollEnd(event.target as HTMLDivElement);
  }

  protected readonly trackByGroup = (_index: number, group: SmartListGroup<T>): string => `${group.startIndex}:${group.label}`;

  protected readonly trackByItem = (index: number, item: T): unknown =>
    this.config.trackBy ? this.resolvedListTrackKeyForItem(index, item) : index;

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
      renderState: 'list',
      selectItem: event => this.selectSmartListItem(item, event),
      openMenu: request => this.openItemMenu(item, request)
    };
  }

  protected resolvedFullscreenItemTemplate(): TemplateRef<SmartListItemTemplateContext<T, TFilters>> | null {
    return this.fullscreenItemTemplate ?? this.itemTemplate;
  }

  protected shouldRenderHostedFullscreenOverlay(): boolean {
    return this.shouldUseHostedFullscreenPagination() && this.resolvedFullscreenItemTemplate() !== null;
  }

  protected hostedFullscreenCurrentItem(): T | null {
    return this.paginationHelper.leavingItem ?? this.cursorItem();
  }

  protected hostedFullscreenCurrentRenderState(): SmartListItemRenderState {
    return this.paginationHelper.animating ? 'leaving' : 'active';
  }

  protected hostedFullscreenStackItem(slotOffset: number): T | null {
    const index = this.hostedFullscreenStackItemIndex(slotOffset);
    if (index < 0 || index >= this.items.length) {
      return null;
    }
    return this.items[index] ?? null;
  }

  protected hostedFullscreenStackRenderState(slotOffset: number): SmartListItemRenderState {
    if (slotOffset === 1 && this.paginationHelper.animating && this.hostedFullscreenPendingDelta !== 0) {
      return 'active';
    }
    return 'default';
  }

  protected hostedFullscreenIsCurling(): boolean {
    return this.paginationHelper.animating && this.hostedFullscreenPendingDelta !== 0;
  }

  protected hostedFullscreenIsCurlingBackwards(): boolean {
    return this.hostedFullscreenIsCurling() && this.hostedFullscreenPendingDelta < 0;
  }

  protected onHostedFullscreenActiveCardAnimationEnd(event: AnimationEvent): void {
    if (event.animationName !== 'smart-list-fullscreen-page-curl') {
      return;
    }
    if (event.currentTarget !== event.target || !this.hostedFullscreenIsCurling()) {
      return;
    }
    void this.completeHostedFullscreenPaginationTransition();
  }

  protected hostedFullscreenItemContext(
    item: T,
    renderState: SmartListItemRenderState,
    index = this.buildCursorState().index
  ): SmartListItemTemplateContext<T, TFilters> {
    return {
      $implicit: item,
      index,
      groupLabel: '',
      query: this.currentQuery(),
      selectMode: this.resolvedSelectMode(),
      presentation: 'fullscreen',
      renderState,
      selectItem: event => this.selectSmartListItem(item, event),
      openMenu: request => this.openItemMenu(item, request)
    };
  }

  private selectSmartListItem(item: T, event?: Event): void {
    event?.stopPropagation();
    this.itemSelect.emit({
      item,
      query: this.currentQuery(),
      currentView: this.currentViewKey,
      currentViewMode: this.currentViewMode,
      selectMode: this.resolvedSelectMode(),
      sourceEvent: event
    });
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

  protected isRateCountCalendarVariant(): boolean {
    return this.resolveConfigValue(this.config.calendarVariant, 'default') === 'rate-counts';
  }

  protected calendarCardModel(): CalendarCardModel<T, TFilters> {
    return CalendarCardConverter.convert({
      viewMode: this.currentViewMode,
      monthPages: this.calendarMonthPages,
      weekPages: this.calendarWeekPages,
      calendar: this.calendarConfig(),
      query: this.currentQuery(),
      variant: this.isRateCountCalendarVariant() ? 'rate-counts' : 'default',
      touching: this.isTouchingSurface,
      trackByItem: (index, item) => this.calendarTrackKey(index, item),
      onItemSelect: this.selectCalendarCardItem
    });
  }

  private readonly selectCalendarCardItem = (item: T, event?: Event): void => {
    this.selectSmartListItem(item, event);
  };

  protected readonly navigateCalendarHeader = (direction: -1 | 1, event?: Event): void => {
    event?.stopPropagation();
    this.navigateCalendarBy(direction);
  };

  private resetAndReload(): void {
    this.resetHostedFullscreenTransition();
    this.clearCalendarSettleTimers();
    this.clearHorizontalCursorScrollLock();
    this.suppressCalendarEdgeSettle = false;
    this.clearLoadingAnimation();
    this.calendarLoadAbortController?.abort();
    this.calendarLoadAbortController = null;
    this.calendarPreloadAbortController?.abort();
    this.calendarPreloadAbortController = null;
    this.calendarPreloadPageKey = null;
    this.suspendSnapReactivation = false;
    this.deferSnapReactivationUntilScroll = false;
    this.lastResolvedBaseSnapMode = null;
    this.loading = false;
    this.loadSequence += 1;
    this.suppressVisibleLoadingProgress = false;
    this.hostedFullscreenEmptyCursor = false;
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
    this.clearAwaitScrollReset();
    this.stickyLabel = this.resolveEmptyStickyLabel();
    this.progress = 0;
    this.scrollable = false;
    this.calendarPendingPageKey = null;
    this.calendarPendingPageAnchor = null;
    this.calendarPendingVisualKey = null;
    this.calendarProgrammaticTargetKey = null;
    this.calendarLastSettledPageKey = null;
    this.calendarScrollInProgress = false;
    this.calendarScrollStartLeft = null;
    this.calendarScrollDirection = null;
    this.calendarPreparedAheadPageKey = null;
    this.calendarRenderDeferred = false;
    this.calendarDeferredPageKeys.clear();
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
    const shouldSuppressVisibleLoadingProgress = !isInitial
      && this.currentViewMode === 'list'
      && this.resolvedPresentation() === 'fullscreen'
      && this.items.length > 0
      && !this.resolveConfigValue(this.config.showBackgroundLoadingProgress, false);
    this.suppressVisibleLoadingProgress = shouldSuppressVisibleLoadingProgress;
    this.loading = true;
    if (!shouldSuppressVisibleLoadingProgress) {
      this.startLoadingAnimation();
    }
    this.emitState();

    const shouldUseManualPrependRestore = !isInitial
      && this.listMergeStrategy() === 'prepend'
      && this.prependRestoreMode() === 'manual';
    const shouldUseReverseAppendAnchorRestore = !isInitial
      && this.listMergeStrategy() === 'append'
      && this.isReversedListFlow()
      && this.listLoadTriggerEdge() === 'end';
    const shouldUseNativePrependReveal = !isInitial
      && this.listMergeStrategy() === 'prepend'
      && this.prependRestoreMode() === 'native';
    const restoreContext = shouldUseManualPrependRestore
      ? this.captureListRestoreContext(isInitial)
      : null;
    let reverseAppendAnchorContext = shouldUseReverseAppendAnchorRestore
      ? this.captureReverseAppendAnchorContext(isInitial)
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
      if (shouldUseReverseAppendAnchorRestore) {
        reverseAppendAnchorContext = this.captureReverseAppendAnchorContext(isInitial) ?? reverseAppendAnchorContext;
      }
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
      this.suppressVisibleLoadingProgress = false;
      this.awaitScrollReset = true;
      this.awaitScrollResetBaselineTop = null;
      this.awaitScrollResetBaselineReverseDistance = null;
      this.endLoadingAnimation({
        forceAnimatedCompletion: shouldAnimateEmptyAppendCompletion
      });
      this.syncGroups();
      if (handledManualPrepend && restoreContext) {
        this.cdr.detectChanges();
        this.scheduleManualPrependRestore(restoreContext);
      } else if (reverseAppendAnchorContext) {
        this.cdr.detectChanges();
        this.scheduleReverseAppendAnchorRestore(reverseAppendAnchorContext, applyInitialAnchor);
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
    this.calendarLastSettledPageKey = this.calendarPageKey(anchor);
    await this.loadCalendarPage(anchor, true);
  }

  private applyListPageResult(result: PageResult<T> | null | undefined, isInitial: boolean): void {
    // Lock the snap reactivation if we were suppressing it at the bottom
    if (!isInitial && this.listMergeStrategy() !== 'prepend' && this.suppressListSnapNearEnd) {
      this.suspendSnapReactivation = true;
    }

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

  private applyCalendarResult(
    anchor: Date,
    result: PageResult<T> | null | undefined,
    options: { deferRender?: boolean } = {}
  ): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    const pageKey = this.calendarPageKey(anchor);
    this.rememberCalendarPageAnchor(anchor);
    this.calendarPageItems.set(pageKey, [...nextItems]);
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : nextItems.length;
    this.calendarPageTotals.set(pageKey, Math.max(nextItems.length, total));
    this.initialLoading = false;
    if (options.deferRender === true) {
      this.calendarDeferredPageKeys.add(pageKey);
      this.calendarRenderDeferred = true;
      return;
    }
    this.calendarDeferredPageKeys.delete(pageKey);
    this.calendarRenderDeferred = this.calendarDeferredPageKeys.size > 0;
    this.items = [...nextItems];
    this.total = Math.max(nextItems.length, total);
    this.pageIndex = 0;
    this.hasMore = false;
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
    if (this.isHorizontalList()) {
      this.maybeLoadMoreHorizontal(scrollElement, threshold, triggerEdge);
      return;
    }
    const maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    const distanceToVisualTop = this.reverseDistanceToVisualTop(scrollElement, maxVerticalScroll);

    if (this.awaitScrollReset) {
      if (this.isReversedListFlow() && triggerEdge === 'end') {
        const resetThreshold = Math.max(120, threshold * 2);
        const baselineTop = this.awaitScrollResetBaselineTop;
        const baselineDistance = this.awaitScrollResetBaselineReverseDistance;
        const topDelta = baselineTop === null ? 0 : Math.abs(scrollElement.scrollTop - baselineTop);
        const distanceDelta = baselineDistance === null ? 0 : Math.abs(distanceToVisualTop - baselineDistance);
        if (distanceToVisualTop > resetThreshold
          || maxVerticalScroll <= resetThreshold
          || topDelta > 12
          || distanceDelta > 12) {
          this.clearAwaitScrollReset();
        }
      } else {
        const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
        if (triggerEdge === 'start') {
          if (scrollElement.scrollTop > Math.max(120, threshold * 2)) {
            this.clearAwaitScrollReset();
          }
        } else {
          const resetThreshold = Math.max(360, threshold);
          if (remainingPx > resetThreshold || maxVerticalScroll <= resetThreshold) {
            this.clearAwaitScrollReset();
          }
        }
      }
      if (this.awaitScrollReset) {
        return;
      }
    }

    if (this.isReversedListFlow() && triggerEdge === 'end') {
      if (!this.shouldStartReverseAppendPreload(scrollElement, threshold)) {
        return;
      }
      void this.loadNextPage();
      return;
    }

    const remainingPx = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
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

  private maybeLoadMoreHorizontal(
    scrollElement: HTMLDivElement,
    threshold: number,
    triggerEdge: SmartListLoadTriggerEdge
  ): void {
    const maxHorizontalScroll = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
    if (maxHorizontalScroll <= 1) {
      return;
    }

    if (this.awaitScrollReset) {
      this.clearAwaitScrollReset();
    }

    const scrollLeft = Math.max(0, scrollElement.scrollLeft);
    if (triggerEdge === 'start') {
      if (scrollLeft > threshold) {
        return;
      }
      void this.loadNextPage();
      return;
    }

    const remainingPx = maxHorizontalScroll - scrollLeft;
    if (remainingPx > threshold) {
      return;
    }
    void this.loadNextPage();
  }

  private shouldStartReverseAppendPreload(
    scrollElement: HTMLDivElement,
    threshold: number
  ): boolean {
    const maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    if (maxVerticalScroll <= 1) {
      return false;
    }
    const distanceToVisualTop = this.reverseDistanceToVisualTop(scrollElement, maxVerticalScroll);
    return distanceToVisualTop <= Math.max(48, threshold);
  }

  private reverseDistanceToVisualTop(
    scrollElement: HTMLDivElement,
    maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
  ): number {
    return Math.max(0, maxVerticalScroll - Math.abs(scrollElement.scrollTop));
  }

  private captureAwaitScrollResetBaseline(scrollElement: HTMLDivElement): void {
    if (!this.awaitScrollReset || !this.isReversedListFlow() || this.listLoadTriggerEdge() !== 'end') {
      return;
    }
    this.awaitScrollResetBaselineTop = scrollElement.scrollTop;
    this.awaitScrollResetBaselineReverseDistance = this.reverseDistanceToVisualTop(scrollElement);
  }

  private clearAwaitScrollReset(): void {
    this.awaitScrollReset = false;
    this.awaitScrollResetBaselineTop = null;
    this.awaitScrollResetBaselineReverseDistance = null;
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

  private listTopInset(
    scrollElement: HTMLElement,
    options: {
      includeStickyGroupMarker?: boolean;
    } = {}
  ): number {
    const threadRect = scrollElement.getBoundingClientRect();
    const styles = getComputedStyle(scrollElement);
    const scrollPaddingTop = Number.parseFloat(styles.scrollPaddingTop || '0') || 0;
    const stickyHeaderHeight = this.shouldShowStickyHeader()
      ? scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
    const includeStickyGroupMarker = options.includeStickyGroupMarker !== false;
    const baseInset = Math.max(stickyHeaderHeight, scrollPaddingTop);

    if (!includeStickyGroupMarker) {
      return baseInset;
    }

    const stickyGroupMarker = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__group-marker')
    ).find(marker => {
      const rect = marker.getBoundingClientRect();
      return rect.top <= threadRect.top + 1 && rect.bottom > threadRect.top + 1;
    }) ?? null;

    if (!stickyGroupMarker) {
      return baseInset;
    }

    const markerStyles = getComputedStyle(stickyGroupMarker);
    const markerMarginBottom = Number.parseFloat(markerStyles.marginBottom || '0') || 0;
    return baseInset + stickyGroupMarker.getBoundingClientRect().height + markerMarginBottom;
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
    const visibleTop = threadRect.top + this.listTopInset(scrollElement, {
      includeStickyGroupMarker: false
    });
    const anchors = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__item-shell[data-smart-list-anchor]')
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

  private captureReverseAppendAnchorContext(
    isInitial: boolean
  ): {
    anchorKey: string;
    offsetTop: number;
  } | null {
    if (isInitial || !this.isReversedListFlow() || this.listMergeStrategy() !== 'append') {
      return null;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement) {
      return null;
    }
    const threadRect = scrollElement.getBoundingClientRect();
    const visibleTop = threadRect.top + this.listTopInset(scrollElement, {
      includeStickyGroupMarker: false
    });
    const anchorElement = this.topVisibleItemShell(scrollElement, visibleTop);
    const anchorKey = anchorElement?.dataset['smartListAnchor']?.trim() ?? '';
    if (!anchorElement || !anchorKey) {
      return null;
    }
    return {
      anchorKey,
      offsetTop: anchorElement.getBoundingClientRect().top - visibleTop
    };
  }

  private topVisibleItemShell(
    scrollElement: HTMLDivElement,
    visibleTop = scrollElement.getBoundingClientRect().top + this.listTopInset(scrollElement)
  ): HTMLElement | null {
    const itemShells = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__item-shell[data-smart-list-anchor]')
    ).sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
    return itemShells.find(element => element.getBoundingClientRect().bottom > visibleTop + 1)
      ?? itemShells.find(element => element.getBoundingClientRect().top >= visibleTop - 1)
      ?? itemShells.find(element => element.getBoundingClientRect().bottom > scrollElement.getBoundingClientRect().top + 1)
      ?? null;
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
      } else if (applyInitialAnchor && this.initialListScrollAnchor() === 'start' && this.isReversedListFlow()) {
        scrollElement.scrollTop = 0;
      } else if (applyInitialAnchor && this.initialListScrollAnchor() === 'first-item' && this.groups.length > 0) {
        const firstBoundary = scrollElement.querySelector<HTMLElement>('.smart-list__group-marker, .smart-list__item-shell');
        if (firstBoundary) {
          scrollElement.scrollTop = firstBoundary.offsetTop;
        }
      }
      this.finalizePostListLoad(scrollElement);
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

  private scheduleReverseAppendAnchorRestore(
    restoreContext: {
      anchorKey: string;
      offsetTop: number;
    },
    applyInitialAnchor: boolean
  ): void {
    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || this.currentViewMode !== 'list') {
        return;
      }
      this.applyReverseAppendAnchorRestore(restoreContext);
      if (applyInitialAnchor && this.initialListScrollAnchor() === 'start') {
        scrollElement.scrollTop = Math.min(0, scrollElement.scrollTop);
      }
      this.finalizePostListLoad(scrollElement);
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

  private applyReverseAppendAnchorRestore(
    restoreContext: {
      anchorKey: string;
      offsetTop: number;
    }
  ): void {
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement || this.currentViewMode !== 'list') {
      return;
    }
    const threadRect = scrollElement.getBoundingClientRect();
    const visibleTop = threadRect.top + this.listTopInset(scrollElement, {
      includeStickyGroupMarker: false
    });
    const anchorElement = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__item-shell[data-smart-list-anchor]')
    ).find(element => (element.dataset['smartListAnchor'] ?? '') === restoreContext.anchorKey) ?? null;
    if (!anchorElement) {
      return;
    }
    const currentOffsetTop = anchorElement.getBoundingClientRect().top - visibleTop;
    const offsetDelta = currentOffsetTop - restoreContext.offsetTop;
    if (Math.abs(offsetDelta) <= 0.5) {
      return;
    }
    scrollElement.scrollTop += offsetDelta;
  }

  private finalizePostListLoad(scrollElement: HTMLDivElement): void {
    if (this.shouldShowStickyHeader()) {
      this.updateStickyLabel(scrollElement.scrollTop);
    } else {
      this.stickyHeaderHeightPx = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
    }
    this.captureAwaitScrollResetBaseline(scrollElement);
    this.updateListSnapNearEndSuppression(scrollElement);
    this.updateAutoFooterSpacerHeight(scrollElement);
    this.updateScrollProgress(scrollElement);
    this.emitState();
    this.cdr.markForCheck();
    this.maybeAutoloadToFillViewport(scrollElement);
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

    // 1. Calculate the exact delta of the newly inserted items
    const heightDelta = scrollElement.scrollHeight - restoreContext.scrollHeight;
    
    // 2. Adjust the scrollTop mathematically to absorb the new height
    let nextScrollTop = Math.max(0, restoreContext.scrollTop + Math.max(0, heightDelta));

    if (restoreContext.restoreAnchorId) {
      const restoredAnchor = document.getElementById(restoreContext.restoreAnchorId);
      if (restoredAnchor instanceof HTMLElement && scrollElement.contains(restoredAnchor)) {
        if (restoredAnchor.classList.contains('smart-list__prepend-restore-spacer')) {
          const revealPx = restoredAnchor.offsetHeight;
          if (revealPx > 0) {
            this.animatePrependRestoreSpacer(restoredAnchor, scrollElement, revealPx);
          } else {
            this.clearPrependRestoreSpacerState(restoredAnchor.id);
          }
        } 
        
        // Let the mathematical nextScrollTop handle the position 
        if (restoreContext.restoreAnchorCreatedId && restoredAnchor.id === restoreContext.restoreAnchorId) {
          restoredAnchor.removeAttribute('id');
        }
      }
    }
    
    // 3. Apply the mathematical scroll top
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
    if (!this.config.trackBy) {
      return null;
    }
    return String(this.resolvedListTrackKeyForItem(index, item));
  }

  private rebuildResolvedListTrackKeys(): void {
    if (!this.config.trackBy) {
      this.resolvedListTrackKeys = [];
      return;
    }

    this.listItemIndexByObject = new WeakMap<object, number>();
    this.resolvedListTrackKeyByObject = new WeakMap<object, string | number>();

    const rawKeys = this.items.map((item, index) => this.normalizedConfiguredTrackKey(index, item));
    const rawKeyCounts = new Map<string, number>();
    for (const rawKey of rawKeys) {
      if (!rawKey) {
        continue;
      }
      rawKeyCounts.set(rawKey, (rawKeyCounts.get(rawKey) ?? 0) + 1);
    }

    this.resolvedListTrackKeys = rawKeys.map((rawKey, index) => {
      const item = this.items[index];
      if (!rawKey) {
        const resolvedFallback = this.fallbackResolvedTrackKey(index, item);
        this.rememberResolvedListTrackKey(item, index, resolvedFallback);
        return resolvedFallback;
      }
      const resolvedKey = (rawKeyCounts.get(rawKey) ?? 0) > 1
        ? `${rawKey}::${this.trackItemInstanceToken(item, index)}`
        : rawKey;
      this.rememberResolvedListTrackKey(item, index, resolvedKey);
      return resolvedKey;
    });
  }

  private rememberResolvedListTrackKey(item: T, index: number, resolvedKey: string | number): void {
    if (!item || (typeof item !== 'object' && typeof item !== 'function')) {
      return;
    }
    const reference = item as object;
    this.listItemIndexByObject.set(reference, index);
    this.resolvedListTrackKeyByObject.set(reference, resolvedKey);
  }

  private resolvedListTrackKeyForItem(index: number, item: T): string | number {
    if (item && (typeof item === 'object' || typeof item === 'function')) {
      const reference = item as object;
      const resolvedKey = this.resolvedListTrackKeyByObject.get(reference);
      if (resolvedKey !== undefined) {
        return resolvedKey;
      }
      const absoluteIndex = this.listItemIndexByObject.get(reference);
      if (absoluteIndex !== undefined) {
        return this.resolvedListTrackKeys[absoluteIndex] ?? this.fallbackResolvedTrackKey(absoluteIndex, item);
      }
    }
    return this.resolvedListTrackKeys[index] ?? this.fallbackResolvedTrackKey(index, item);
  }

  private normalizedConfiguredTrackKey(index: number, item: T): string | null {
    const key = this.config.trackBy?.(index, item);
    if (key === null || key === undefined) {
      return null;
    }
    const normalized = String(key).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private fallbackResolvedTrackKey(index: number, item: T): string {
    return `smart-list-track:${this.trackItemInstanceToken(item, index)}`;
  }

  private calendarTrackKey(index: number, item: T): string {
    return this.normalizedConfiguredTrackKey(index, item) ?? this.fallbackResolvedTrackKey(index, item);
  }

  private trackItemInstanceToken(item: T, index: number): string {
    if (item && (typeof item === 'object' || typeof item === 'function')) {
      const reference = item as object;
      let token = this.fallbackTrackKeyByObject.get(reference);
      if (!token) {
        token = `obj-${++this.fallbackTrackKeySequence}`;
        this.fallbackTrackKeyByObject.set(reference, token);
      }
      return `${token}:${index}`;
    }
    return `idx-${index}:${String(item)}`;
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
      this.resolvedListTrackKeys = [];
      this.groups = [];
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    this.rebuildResolvedListTrackKeys();

    const groupBy = this.config.groupBy;
    if (!groupBy) {
      this.groups = this.items.length > 0 ? [{ label: '', items: [...this.items], startIndex: 0 }] : [];
      if (!this.items.length || !this.shouldShowStickyHeader()) {
        this.stickyLabel = this.resolveEmptyStickyLabel();
      }
      return;
    }

    const query = this.currentQuery();
    const nextGroups: SmartListGroup<T>[] = [];
    let itemIndex = 0;
    for (const item of this.items) {
      const label = groupBy(item, query);
      const lastGroup = nextGroups[nextGroups.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        nextGroups.push({
          label,
          items: [item],
          startIndex: itemIndex
        });
      } else {
        lastGroup.items.push(item);
      }
      itemIndex += 1;
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

  private syncCalendarPages(options: { flushDeferred?: boolean } = {}): void {
    if (options.flushDeferred === true) {
      this.calendarDeferredPageKeys.clear();
      this.calendarRenderDeferred = false;
    }
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
        const itemsByDate = buildSmartListCalendarItemsByDate(pageItems, resolveDateRange, value => AppUtils.dateKey(value));
        return buildSmartListCalendarMonthPage(anchor, itemsByDate, pageItems, resolveDateRange, {
          trackByKey: item => this.calendarTrackKey(0, item),
          dateKey: value => AppUtils.dateKey(value),
          monthKey: value => AppUtils.monthKey(value)
        });
      });
      this.calendarWeekPages = [];
      this.items = [...this.calendarItemsForAnchor(activeAnchor)];
      this.total = this.calendarPageTotals.get(this.calendarPageKey(activeAnchor)) ?? this.items.length;
      this.stickyLabel = this.calendarMonthPages.find(page => page.key === AppUtils.monthKey(activeAnchor))?.label
        ?? this.calendarMonthPages[this.initialCalendarPageIndex()]?.label
        ?? this.resolveEmptyStickyLabel();
      return;
    }

    this.calendarWeekPages = window.anchors.map(anchor => {
      const pageItems = this.calendarItemsForAnchor(anchor);
      const pageQuery = this.calendarQueryForAnchor(anchor);
      const resolveDateRange = (item: T) => this.calendarConfig()?.resolveDateRange(item, pageQuery) ?? null;
      const itemsByDate = buildSmartListCalendarItemsByDate(pageItems, resolveDateRange, value => AppUtils.dateKey(value));
      return buildSmartListCalendarWeekPage(anchor, itemsByDate, value => AppUtils.dateKey(value));
    });
    this.calendarMonthPages = [];
    this.items = [...this.calendarItemsForAnchor(activeAnchor)];
    this.total = this.calendarPageTotals.get(this.calendarPageKey(activeAnchor)) ?? this.items.length;
    this.stickyLabel = this.calendarWeekPages.find(page => page.key === AppUtils.dateKey(AppUtils.startOfWeekMonday(activeAnchor)))?.label
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
    this.calendarLoadAbortController?.abort();
    this.calendarLoadAbortController = null;
    this.calendarPreloadAbortController?.abort();
    this.calendarPreloadAbortController = null;
    this.calendarPreloadPageKey = null;
    this.calendarPageItems.clear();
    this.calendarPageTotals.clear();
    this.calendarMonthPageAnchors.clear();
    this.calendarWeekPageAnchors.clear();
    this.calendarPendingPageKey = null;
    this.calendarPendingPageAnchor = null;
    this.calendarPendingVisualKey = null;
    this.calendarProgrammaticTargetKey = null;
    this.calendarLastSettledPageKey = null;
    this.calendarScrollInProgress = false;
    this.calendarScrollStartLeft = null;
    this.calendarScrollDirection = null;
    this.calendarPreparedAheadPageKey = null;
    this.calendarRenderDeferred = false;
    this.calendarDeferredPageKeys.clear();
    this.calendarFrozenProgress = null;
  }

  private updateStickyLabel(scrollTop: number): void {
    if (!this.shouldShowStickyHeader()) {
      this.stickyHeaderHeightPx = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }
    if (this.groups.length === 0) {
      this.stickyHeaderHeightPx = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }
    const scrollElement = this.scrollHostRef?.nativeElement;
    if (!scrollElement) {
      this.stickyHeaderHeightPx = 0;
      this.stickyLabel = this.groups[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.smart-list__sticky');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    this.stickyHeaderHeightPx = stickyHeaderHeight;
    const targetTop = scrollTop + stickyHeaderHeight;
    const boundaries = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__item-shell[data-group-label], .smart-list__group-marker[data-group-label]')
    );
    if (boundaries.length === 0) {
      this.stickyLabel = this.groups[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }
    if (scrollTop <= 1) {
      this.stickyLabel = boundaries[0]?.dataset['groupLabel'] ?? this.groups[0].label;
      return;
    }

    let activeBoundary = boundaries[0];
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i].offsetTop <= targetTop + 1) {
        activeBoundary = boundaries[i];
        break;
      }
    }

    this.stickyLabel = activeBoundary?.dataset['groupLabel'] ?? this.groups[0].label;
  }

  private updateScrollProgress(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    if (!target) {
      this.scrollable = false;
      this.progress = 0;
      return;
    }
    if (this.isHorizontalList()) {
      const maxHorizontalScroll = Math.max(0, target.scrollWidth - target.clientWidth);
      const scrollOffset = Math.max(0, target.scrollLeft);
      this.scrollable = maxHorizontalScroll > 1;
      this.progress = maxHorizontalScroll > 1
        ? AppUtils.clampNumber(scrollOffset / maxHorizontalScroll, 0, 1)
        : 0;
      return;
    }
    const maxVerticalScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    const scrollOffset = this.isReversedListFlow()
      ? Math.abs(target.scrollTop)
      : target.scrollTop;
    this.scrollable = maxVerticalScroll > 1;
    this.progress = maxVerticalScroll > 1
      ? AppUtils.clampNumber(scrollOffset / maxVerticalScroll, 0, 1)
      : 0;
  }

  private maybeAutoloadToFillViewport(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    if (!target || this.currentViewMode !== 'list' || this.loading || !this.hasMore) {
      return;
    }
    if (this.shouldRenderHostedFullscreenOverlay()) {
      // Hosted fullscreen pagination preloads from cursor position instead of scroll height.
      // The occluded backing list can be heightless, which would otherwise eagerly drain all pages on mount.
      return;
    }
    const maxScroll = this.isHorizontalList()
      ? Math.max(0, target.scrollWidth - target.clientWidth)
      : Math.max(0, target.scrollHeight - target.clientHeight);
    if (maxScroll > 1) {
      return;
    }
    void this.loadNextPage();
  }

  private updateCalendarSurface(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    const pages = this.currentCalendarPages();
    if (!target || pages.length === 0) {
      this.stickyHeaderHeightPx = 0;
      this.scrollable = false;
      this.progress = 0;
      this.stickyLabel = pages[0]?.label ?? this.resolveEmptyStickyLabel();
      return;
    }

    this.stickyHeaderHeightPx = this.shouldShowStickyHeader()
      ? target.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
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
          this.stickyHeaderHeightPx = 0;
          this.stickyLabel = this.resolveEmptyStickyLabel();
        }
        this.updateListSnapNearEndSuppression();
        this.updateAutoFooterSpacerHeight();
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
      if (this.isHorizontalList() || scrollElement.scrollTop > 1) {
        return;
      }
      const firstSnapTarget = this.listCardSnapTargets(scrollElement)[0] ?? null;
      if (!firstSnapTarget) {
        return;
      }
      const maxVerticalScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      if (maxVerticalScroll <= 1) {
        return;
      }
      const finalTop = this.listSnapTargetPosition(scrollElement, firstSnapTarget);
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
        this.guardListSnapSettle();
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
    return !this.isHorizontalList()
      && this.resolvedListLayout() === 'card-grid'
      && this.resolvedSnapMode() !== 'none';
  }

  private scheduleListSnapSettle(scrollElement: HTMLDivElement): void {
    if (!this.shouldUseSmoothListSnapSettle(scrollElement)) {
      this.clearListSnapSettleTimer();
      return;
    }

    this.clearListSnapSettleTimer();
    this.listSnapSettleTimer = setTimeout(() => {
      this.listSnapSettleTimer = null;
      this.settleListSnapSmoothly(scrollElement);
    }, SmartListComponent.LIST_SNAP_SETTLE_DELAY_MS);
  }

  private shouldUseSmoothListSnapSettle(scrollElement: HTMLDivElement): boolean {
    return !this.suppressListSnapSettle
      && !this.suppressListSnapNearEnd
      && !this.isTouchingSurface
      && !this.horizontalListScrollInProgress
      && this.currentViewMode === 'list'
      && this.resolvedListLayout() === 'card-grid'
      && (!this.isHorizontalList() || this.isCompactHorizontalViewport())
      && this.resolvedSnapMode() !== 'none'
      && scrollElement === this.scrollHostRef?.nativeElement;
  }

  private isCompactHorizontalViewport(): boolean {
    return this.isMobileViewport();
  }

  private shouldUseHorizontalMobileStepper(): boolean {
    return this.currentViewMode === 'list'
      && this.isHorizontalList()
      && this.resolvedMobileStepper()
      && this.isMobileViewport();
  }

  private isMobileViewport(): boolean {
    const breakpointPx = SmartListComponent.DEFAULT_MOBILE_BREAKPOINT_PX;
    const matcher = globalThis.matchMedia?.(`(max-width: ${breakpointPx}px)`);
    if (matcher) {
      return matcher.matches;
    }
    return (globalThis.innerWidth ?? Number.POSITIVE_INFINITY) <= breakpointPx;
  }

  private beginHorizontalListScroll(scrollElement: HTMLDivElement): void {
    if (!this.isHorizontalList() || scrollElement !== this.scrollHostRef?.nativeElement) {
      return;
    }
    this.clearListSnapSettleTimer();
    if (this.horizontalListScrollInProgress) {
      return;
    }
    this.horizontalListScrollInProgress = true;
    this.cdr.markForCheck();
  }

  private scheduleHorizontalListScrollEnd(scrollElement: HTMLDivElement): void {
    if (!this.isHorizontalList() || scrollElement !== this.scrollHostRef?.nativeElement) {
      this.clearHorizontalListScrollEndTimer();
      return;
    }
    if (this.horizontalListScrollEndTimer) {
      clearTimeout(this.horizontalListScrollEndTimer);
    }
    this.horizontalListScrollEndTimer = setTimeout(() => {
      this.horizontalListScrollEndTimer = null;
      this.finishHorizontalListScroll(scrollElement);
    }, SmartListComponent.LIST_SNAP_SETTLE_DELAY_MS);
  }

  private finishHorizontalListScroll(scrollElement: HTMLDivElement): void {
    if (this.horizontalListScrollEndTimer) {
      clearTimeout(this.horizontalListScrollEndTimer);
      this.horizontalListScrollEndTimer = null;
    }
    if (!this.isHorizontalList() || scrollElement !== this.scrollHostRef?.nativeElement) {
      this.clearHorizontalListScrollEndTimer();
      return;
    }
    if (this.horizontalListScrollInProgress) {
      this.horizontalListScrollInProgress = false;
      this.cdr.markForCheck();
    }
    if (this.shouldUseHorizontalMobileStepper()) {
      return;
    }
    this.settleListSnapSmoothly(scrollElement);
  }

  private settleListSnapSmoothly(scrollElement: HTMLDivElement): void {
    if (!this.shouldUseSmoothListSnapSettle(scrollElement)) {
      return;
    }

    const nearestTarget = this.nearestListSnapTarget(scrollElement);
    if (!nearestTarget) {
      return;
    }

    const targetPosition = this.listSnapTargetPosition(scrollElement, nearestTarget);
    const currentPosition = this.listSnapScrollPosition(scrollElement);
    if (Math.abs(currentPosition - targetPosition) <= 2) {
      return;
    }

    this.guardListSnapSettle();
    this.scrollToListSnapPosition(scrollElement, targetPosition, 'smooth');
  }

  private nearestListSnapTarget(scrollElement: HTMLDivElement): HTMLElement | null {
    const targets = this.listCardSnapTargets(scrollElement);
    if (targets.length === 0) {
      return null;
    }

    const currentPosition = this.listSnapScrollPosition(scrollElement);
    return targets.reduce<HTMLElement>((nearest, candidate) => {
      const nearestDistance = Math.abs(this.listSnapTargetPosition(scrollElement, nearest) - currentPosition);
      const candidateDistance = Math.abs(this.listSnapTargetPosition(scrollElement, candidate) - currentPosition);
      return candidateDistance < nearestDistance ? candidate : nearest;
    }, targets[0]);
  }

  private guardListSnapSettle(): void {
    this.suppressListSnapSettle = true;
    if (this.listSnapSettleGuardTimer) {
      clearTimeout(this.listSnapSettleGuardTimer);
    }
    this.listSnapSettleGuardTimer = setTimeout(() => {
      this.listSnapSettleGuardTimer = null;
      this.suppressListSnapSettle = false;
    }, SmartListComponent.LIST_SNAP_SETTLE_GUARD_MS);
  }

  private clearListSnapSettleTimer(): void {
    if (!this.listSnapSettleTimer) {
      return;
    }
    clearTimeout(this.listSnapSettleTimer);
    this.listSnapSettleTimer = null;
  }

  private clearListSnapSettleTimers(): void {
    this.clearListSnapSettleTimer();
    this.clearHorizontalListScrollEndTimer();
    if (this.listSnapSettleGuardTimer) {
      clearTimeout(this.listSnapSettleGuardTimer);
      this.listSnapSettleGuardTimer = null;
    }
    this.suppressListSnapSettle = false;
  }

  private clearHorizontalListScrollEndTimer(): void {
    if (this.horizontalListScrollEndTimer) {
      clearTimeout(this.horizontalListScrollEndTimer);
      this.horizontalListScrollEndTimer = null;
    }
    if (this.horizontalListScrollInProgress) {
      this.horizontalListScrollInProgress = false;
      this.cdr.markForCheck();
    }
  }

  private updateAutoFooterSpacerHeight(scrollElement?: HTMLDivElement | null): void {
    void scrollElement;
    if (this.resolvedPresentation() === 'fullscreen') {
      this.autoFooterSpacerHeightPx = 0;
      return;
    }
    this.autoFooterSpacerHeightPx = this.activeDockedMenuHeightPx();
  }

  private revealDockedItemMenuSoon(item: T): void {
    const prepare = () => {
      this.updateAutoFooterSpacerHeight();
      this.cdr.markForCheck();
      const reveal = () => this.revealDockedItemMenu(item);
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(reveal);
        return;
      }
      setTimeout(reveal, 0);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(prepare));
      return;
    }
    setTimeout(prepare, 0);
  }

  private revealDockedItemMenu(item: T): void {
    const scrollElement = this.scrollHostRef?.nativeElement;
    const dockHeight = this.activeDockedMenuHeightPx();
    if (!scrollElement || dockHeight <= 0) {
      return;
    }
    const itemIndex = this.items.indexOf(item);
    if (itemIndex < 0) {
      return;
    }
    const itemElement = scrollElement.querySelector<HTMLElement>(`.smart-list__item-shell[data-smart-list-index="${itemIndex}"]`);
    if (!itemElement) {
      return;
    }
    const scrollRect = scrollElement.getBoundingClientRect();
    const itemRect = itemElement.getBoundingClientRect();
    const safeBottom = scrollRect.bottom - dockHeight - 8;
    if (itemRect.bottom <= safeBottom) {
      return;
    }
    scrollElement.scrollTop += itemRect.bottom - safeBottom;
    this.updateScrollProgress(scrollElement);
    this.emitState();
    this.cdr.markForCheck();
  }

  private activeDockedMenuHeightPx(): number {
    const dock = (this.hostRef.nativeElement as HTMLElement).querySelector('.app-menu-outlet--dock') as HTMLElement | null;
    if (!dock) {
      return 0;
    }
    const height = dock.getBoundingClientRect().height;
    return Number.isFinite(height) ? Math.max(0, Math.ceil(height)) : 0;
  }

  private listCardSnapTargets(scrollElement: HTMLDivElement): HTMLElement[] {
    if (this.isHorizontalList()) {
      return Array.from(
        scrollElement.querySelectorAll<HTMLElement>('.smart-list__item-shell[data-smart-list-index]')
      );
    }
    return Array.from(
      scrollElement.querySelectorAll<HTMLElement>(SmartListComponent.LIST_CARD_SNAP_TARGET_SELECTOR)
    );
  }

private updateListSnapNearEndSuppression(scrollElement?: HTMLDivElement | null): void {
    const target = scrollElement ?? this.scrollHostRef?.nativeElement;
    let nextValue = this.shouldSuppressListSnapNearEnd(target);

    // If locked, force it to stay suppressed even though we are no longer at the end
    if (this.suspendSnapReactivation && this.suppressListSnapNearEnd && !nextValue) {
      nextValue = true;
    }

    if (this.suppressListSnapNearEnd === nextValue) {
      return;
    }
    this.suppressListSnapNearEnd = nextValue;
    if (nextValue) {
      this.clearListSnapSettleTimer();
    }
    this.cdr.markForCheck();
  }

  private shouldSuppressListSnapNearEnd(scrollElement?: HTMLDivElement | null): boolean {
    if (
      !scrollElement
      || this.currentViewMode !== 'list'
      || this.resolvedListLayout() !== 'card-grid'
      || this.resolvedSnapMode() === 'none'
    ) {
      return false;
    }

    const maxScroll = this.listMaxScroll(scrollElement);
    if (maxScroll <= 1) {
      return false;
    }

    const lastReachableSnapPosition = this.lastReachableListSnapTargetPosition(scrollElement, maxScroll);
    if (lastReachableSnapPosition === null || maxScroll <= lastReachableSnapPosition + 1) {
      return false;
    }

    return this.listSnapScrollPosition(scrollElement) > lastReachableSnapPosition + 1;
  }

  private lastReachableListSnapTargetPosition(scrollElement: HTMLDivElement, maxScroll?: number): number | null {
    const maxPosition = maxScroll ?? this.listMaxScroll(scrollElement);
    const reachablePositions = this.listCardSnapTargets(scrollElement)
      .map(target => this.listSnapTargetPosition(scrollElement, target))
      .filter(position => position <= maxPosition + 1);
    if (reachablePositions.length === 0) {
      return null;
    }
    return Math.max(...reachablePositions);
  }

  private listMaxScroll(scrollElement: HTMLDivElement): number {
    return this.isHorizontalList()
      ? Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth)
      : Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  }

  private listSnapScrollPosition(scrollElement: HTMLDivElement): number {
    return this.isHorizontalList()
      ? Math.max(0, scrollElement.scrollLeft)
      : Math.max(0, scrollElement.scrollTop);
  }

  private listSnapTargetPosition(scrollElement: HTMLDivElement, target: HTMLElement): number {
    const scrollPadding = this.listSnapPaddingStart(scrollElement);
    const targetOffset = this.isHorizontalList() ? target.offsetLeft : target.offsetTop;
    return Math.max(0, targetOffset - scrollPadding);
  }

  private scrollToListSnapPosition(
    scrollElement: HTMLDivElement,
    position: number,
    behavior: ScrollBehavior
  ): void {
    if (this.isHorizontalList()) {
      scrollElement.scrollTo({ left: position, behavior });
      return;
    }
    scrollElement.scrollTo({ top: position, behavior });
  }

  private listSnapPaddingStart(scrollElement: HTMLDivElement): number {
    const computed = globalThis.getComputedStyle?.(scrollElement);
    const rawScrollPadding = this.isHorizontalList()
      ? computed?.scrollPaddingLeft || computed?.getPropertyValue('scroll-padding-left')
      : computed?.scrollPaddingTop || computed?.getPropertyValue('scroll-padding-top')
      || '';
    const parsedScrollPadding = Number.parseFloat(rawScrollPadding);
    const stickyHeaderHeight = this.shouldShowStickyHeader()
      ? scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
    if (Number.isFinite(parsedScrollPadding)) {
      return parsedScrollPadding;
    }
    return this.isHorizontalList() ? 0 : stickyHeaderHeight;
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
    const windowMs = Math.max(600, this.config.loadingWindowMs ?? SmartListComponent.DEFAULT_LOADING_WINDOW_MS);
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
    this.syncPaginationAutoplay();
  }

  private resolvedPaginationAutoplayMs(): number | null {
    const value = this.resolveConfigValue(this.config.pagination?.autoplayMs, null);
    const normalized = Math.trunc(Number(value));
    return Number.isFinite(normalized) && normalized >= 1000 ? normalized : null;
  }

  private syncPaginationAutoplay(): void {
    const autoplayMs = this.resolvedPaginationAutoplayMs();
    const canAutoplay = autoplayMs !== null
      && !this.autoplayPaused
      && this.currentViewMode === 'list'
      && this.isHorizontalList()
      && this.items.length > 1;
    if (!canAutoplay) {
      this.clearPaginationAutoplay();
      return;
    }
    if (this.autoplayTimer !== null) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.autoplayTimer = setInterval(() => {
        const cursor = this.buildCursorState();
        if (cursor.total <= 1) {
          this.clearPaginationAutoplay();
          return;
        }
        const nextIndex = cursor.index >= cursor.total - 1 ? 0 : cursor.index + 1;
        this.ngZone.run(() => {
          void this.setCursorIndex(nextIndex);
        });
      }, autoplayMs);
    });
  }

  private pausePaginationAutoplay(): void {
    this.autoplayPaused = true;
    this.clearPaginationAutoplay();
  }

  private resetPaginationAutoplay(): void {
    this.autoplayPaused = false;
    this.clearPaginationAutoplay();
  }

  private clearPaginationAutoplay(): void {
    if (this.autoplayTimer === null) {
      return;
    }
    clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
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

  private syncHorizontalCursorIndexToVisibleListItem(scrollElement: HTMLDivElement): void {
    if (!this.isHorizontalList() || this.items.length === 0) {
      return;
    }
    if (this.horizontalCursorScrollLockTargetIndex !== null) {
      this.scheduleHorizontalCursorScrollLockRelease(scrollElement);
      return;
    }
    const visibleIndex = this.firstVisibleHorizontalListItemIndex(scrollElement);
    if (visibleIndex === null || visibleIndex === this.buildCursorState().index) {
      return;
    }
    this.cursorIndex = visibleIndex;
    this.syncCursorBounds();
    this.cdr.markForCheck();
  }

  private firstVisibleHorizontalListItemIndex(scrollElement: HTMLDivElement): number | null {
    const listRect = scrollElement.getBoundingClientRect();
    const visibleLeft = listRect.left + 1;
    const itemElements = Array.from(scrollElement.querySelectorAll<HTMLElement>('[data-smart-list-index]'));
    const anchorElement =
      itemElements.find(element => element.getBoundingClientRect().right > visibleLeft)
      ?? itemElements.find(element => element.getBoundingClientRect().left >= listRect.left - 1)
      ?? itemElements[0]
      ?? null;
    if (!anchorElement) {
      return null;
    }
    const rawIndex = Number.parseInt(anchorElement.dataset['smartListIndex'] ?? '', 10);
    return Number.isFinite(rawIndex) ? Math.max(0, rawIndex) : null;
  }

  private scrollHorizontalListItemIntoView(index: number, behavior: ScrollBehavior): void {
    if (!this.isHorizontalList()) {
      return;
    }
    const run = () => {
      const scrollElement = this.scrollHostRef?.nativeElement;
      if (!scrollElement || !this.isHorizontalList()) {
        return;
      }
      const itemElement = scrollElement.querySelector<HTMLElement>(`.smart-list__item-shell[data-smart-list-index="${index}"]`);
      if (!itemElement) {
        return;
      }
      if (behavior === 'smooth') {
        this.horizontalCursorScrollLockTargetIndex = index;
        this.scheduleHorizontalCursorScrollLockRelease(scrollElement);
      } else {
        this.clearHorizontalCursorScrollLock();
      }
      this.scrollToListSnapPosition(scrollElement, this.listSnapTargetPosition(scrollElement, itemElement), behavior);
      this.updateScrollProgress(scrollElement);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private syncHorizontalViewportAfterResize(): void {
    if (!this.afterViewInit || !this.isHorizontalList()) {
      return;
    }
    if (!this.shouldUseCompactHorizontal() && !this.shouldUseHorizontalMobileStepper()) {
      return;
    }
    this.scrollHorizontalListItemIntoView(this.buildCursorState().index, 'auto');
  }

  private scheduleHorizontalCursorScrollLockRelease(scrollElement: HTMLDivElement): void {
    if (this.horizontalCursorScrollLockTimer) {
      clearTimeout(this.horizontalCursorScrollLockTimer);
    }
    this.horizontalCursorScrollLockTimer = setTimeout(() => {
      this.horizontalCursorScrollLockTimer = null;
      const targetIndex = this.horizontalCursorScrollLockTargetIndex;
      this.horizontalCursorScrollLockTargetIndex = null;
      const currentScrollElement = this.scrollHostRef?.nativeElement;
      if (!currentScrollElement || currentScrollElement !== scrollElement || !this.isHorizontalList()) {
        return;
      }
      const finalIndex = this.firstVisibleHorizontalListItemIndex(currentScrollElement) ?? targetIndex;
      if (finalIndex === null || finalIndex === this.cursorIndex) {
        return;
      }
      this.cursorIndex = finalIndex;
      this.syncCursorBounds();
      this.emitState();
      this.cdr.markForCheck();
    }, 120);
  }

  private clearHorizontalCursorScrollLock(): void {
    if (this.horizontalCursorScrollLockTimer) {
      clearTimeout(this.horizontalCursorScrollLockTimer);
      this.horizontalCursorScrollLockTimer = null;
    }
    this.horizontalCursorScrollLockTargetIndex = null;
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
    this.interruptHostedFullscreenTransition();
    await this.config.pagination?.onRatingSelect?.(this.cursorItem(), score, this.currentQuery());
    if (!this.shouldUseHostedFullscreenPagination()) {
      return;
    }
    const canMoveToNextItem = this.canMoveCursor(1);
    const canMoveToEmptyState = !canMoveToNextItem && this.canMoveHostedFullscreenCursorToEmptyState();
    if (!canMoveToNextItem && !canMoveToEmptyState) {
      return;
    }
    if (this.ratingAdvanceInFlight) {
      return;
    }
    this.ratingAdvanceInFlight = true;
    try {
      await this.wait(120);
      if (!this.shouldUseHostedFullscreenPagination() || this.paginationHelper.animating) {
        return;
      }
      await this.advanceHostedFullscreenPagination(1, { allowEmptyTarget: canMoveToEmptyState });
    } finally {
      this.ratingAdvanceInFlight = false;
    }
  }

  private async advanceHostedFullscreenPagination(
    delta: number,
    options: { allowEmptyTarget?: boolean } = {}
  ): Promise<boolean> {
    if (!this.shouldUseHostedFullscreenPagination() || this.paginationHelper.animating) {
      return false;
    }
    const normalizedDelta = Math.trunc(delta);
    const allowEmptyTarget = options.allowEmptyTarget === true
      && normalizedDelta > 0
      && this.canMoveHostedFullscreenCursorToEmptyState();
    if (!this.canMoveCursor(normalizedDelta) && !allowEmptyTarget) {
      return false;
    }
    const currentIndex = this.buildCursorState().index;
    const targetIndex = currentIndex + normalizedDelta;
    const targetIsEmptyState = allowEmptyTarget && targetIndex === this.hostedFullscreenCursorTotal();
    if (!targetIsEmptyState && !await this.ensureHostedFullscreenTargetLoaded(targetIndex)) {
      return false;
    }
    if (normalizedDelta > 0) {
      const previewIndex = currentIndex + (SmartListComponent.HOSTED_FULLSCREEN_STACK_SIZE - 1);
      await this.ensureHostedFullscreenTargetLoaded(previewIndex);
    }
    const currentItem = this.cursorItem();
    if (!currentItem) {
      return this.moveCursor(normalizedDelta);
    }
    this.cursorIndex = targetIndex;
    this.hostedFullscreenEmptyCursor = targetIsEmptyState;
    this.syncCursorBounds();
    this.emitState();
    this.cdr.markForCheck();
    this.hostedFullscreenPendingDelta = normalizedDelta;
    this.hostedFullscreenCompletingTransition = false;
    this.paginationHelper.beginTransition(currentItem);
    if (this.currentViewMode === 'list' && this.resolvedPresentation() === 'fullscreen' && this.hasMore && !this.loading) {
      const remaining = this.items.length - (this.cursorIndex + 1);
      if (remaining <= SmartListComponent.HOSTED_FULLSCREEN_STACK_SIZE - 1) {
        void this.loadNextPage();
      }
    }
    this.startHostedFullscreenTransitionTimer();
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

  private buildCursorState(indexOverride = this.cursorIndex): SmartListCursorState<T> {
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
    const lastItemIndex = Math.max(0, total - 1);
    const maxCursorIndex = this.canUseHostedFullscreenEmptyCursor() ? total : lastItemIndex;
    const index = Math.max(0, Math.min(indexOverride, maxCursorIndex));
    return {
      index,
      total,
      progress: index >= total ? 1 : lastItemIndex > 0 ? AppUtils.clampNumber(index / lastItemIndex, 0, 1) : 0,
      canPrev: index > 0,
      canNext: index < lastItemIndex,
      item: index < this.items.length ? (this.items[index] ?? null) : null
    };
  }

  private syncCursorBounds(): void {
    const total = Math.max(0, Math.max(this.total, this.items.length));
    if (total === 0) {
      this.cursorIndex = 0;
      return;
    }
    const maxCursorIndex = this.canUseHostedFullscreenEmptyCursor() ? total : total - 1;
    this.cursorIndex = Math.max(0, Math.min(this.cursorIndex, maxCursorIndex));
  }

  private hostedFullscreenCursorTotal(): number {
    return Math.max(0, Math.max(this.total, this.items.length));
  }

  private canUseHostedFullscreenEmptyCursor(): boolean {
    return this.hostedFullscreenEmptyCursor
      && this.cursorIndex >= this.hostedFullscreenCursorTotal()
      && this.hostedFullscreenCursorTotal() > 0
      && !this.hasMore
      && !this.loading;
  }

  private canMoveHostedFullscreenCursorToEmptyState(): boolean {
    const cursor = this.buildCursorState();
    return this.shouldUseHostedFullscreenPagination()
      && cursor.item !== null
      && cursor.total > 0
      && cursor.index === cursor.total - 1
      && !this.hasMore
      && !this.loading;
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
    const pageSize = this.resolveEffectivePageSize(this.currentViewKey);
    const query: ListQuery<TFilters> = {
      page: this.currentViewMode === 'list' ? page : 0,
      pageSize,
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
      pageSize: this.resolveEffectiveInitialPageSize(query.pageSize, Number(initialPageSize))
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

  private wait(delayMs: number, signal?: AbortSignal): Promise<void> {
    if (delayMs <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, delayMs);
      const onAbort = () => {
        cleanup();
        reject(this.createAbortError());
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  protected hostedFullscreenStackItemIndex(slotOffset: number): number {
    const baseIndex = this.buildCursorState().index;
    if (!this.paginationHelper.animating || this.hostedFullscreenPendingDelta === 0) {
      return baseIndex + slotOffset;
    }
    const direction = this.hostedFullscreenPendingDelta < 0 ? -1 : 1;
    return baseIndex + ((slotOffset - 1) * direction);
  }

  private startHostedFullscreenTransitionTimer(): void {
    this.clearHostedFullscreenTransitionTimer();
    this.hostedFullscreenTransitionTimer = setTimeout(() => {
      this.hostedFullscreenTransitionTimer = null;
      void this.completeHostedFullscreenPaginationTransition();
    }, SmartListComponent.HOSTED_FULLSCREEN_PAGE_CURL_DURATION_MS + 48);
  }

  private clearHostedFullscreenTransitionTimer(): void {
    if (!this.hostedFullscreenTransitionTimer) {
      return;
    }
    clearTimeout(this.hostedFullscreenTransitionTimer);
    this.hostedFullscreenTransitionTimer = null;
  }

  private interruptHostedFullscreenTransition(): void {
    if (!this.paginationHelper.animating) {
      return;
    }
    this.clearHostedFullscreenTransitionTimer();
    this.hostedFullscreenPendingDelta = 0;
    this.hostedFullscreenCompletingTransition = false;
    this.paginationHelper.finishTransition();
  }

  private resetHostedFullscreenTransition(): void {
    this.interruptHostedFullscreenTransition();
    this.paginationHelper.reset();
  }

  private async completeHostedFullscreenPaginationTransition(): Promise<void> {
    if (!this.paginationHelper.animating || this.hostedFullscreenPendingDelta === 0 || this.hostedFullscreenCompletingTransition) {
      return;
    }
    this.hostedFullscreenPendingDelta = 0;
    this.hostedFullscreenCompletingTransition = true;
    this.clearHostedFullscreenTransitionTimer();
    this.hostedFullscreenCompletingTransition = false;
    this.paginationHelper.finishTransition();
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
      anchorDate: AppUtils.dateKey(normalizedAnchor),
      rangeStart: AppUtils.dateKey(range.start),
      rangeEnd: AppUtils.dateKey(range.end)
    };
  }

  private resolveEffectivePageSize(viewKey: string | null = this.currentViewKey): number {
    const configuredPageSize = Math.max(
      1,
      Math.trunc(this.activeViewConfig(viewKey)?.pageSize ?? this.config.pageSize ?? 10)
    );
    const mobileCap = this.mobilePageSizeCapForView(viewKey);
    return mobileCap === null ? configuredPageSize : Math.min(configuredPageSize, mobileCap);
  }

  private resolveEffectiveInitialPageSize(queryPageSize: number, configuredInitialPageSize: number): number {
    const normalizedInitialPageSize = Math.max(1, Math.trunc(configuredInitialPageSize));
    const mobileCap = this.mobilePageSizeCapForView();
    if (mobileCap === null) {
      return normalizedInitialPageSize;
    }
    return Math.max(1, Math.trunc(queryPageSize));
  }

  private mobilePageSizeCapForView(viewKey: string | null = this.currentViewKey): number | null {
    if (typeof window === 'undefined' || !this.isMobileViewport()) {
      return null;
    }
    if (this.resolveViewMode(viewKey) !== 'list') {
      return null;
    }
    const configuredCap = this.config.mobilePageSizeCap;
    if (configuredCap === null) {
      return null;
    }
    return Math.max(1, Math.trunc(configuredCap ?? SmartListComponent.DEFAULT_MOBILE_PAGE_SIZE_CAP));
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
      ? AppUtils.monthKey(AppUtils.startOfMonth(anchor))
      : AppUtils.dateKey(AppUtils.startOfWeekMonday(anchor));
  }

  private calendarItemsForAnchor(anchor: Date): T[] {
    const pageKey = this.calendarPageKey(anchor);
    if (this.calendarDeferredPageKeys.has(pageKey)) {
      return [];
    }
    return this.calendarPageItems.get(pageKey) ?? [];
  }

  private maybeLoadCurrentCalendarPage(
    scrollElement: HTMLDivElement | null = this.scrollHostRef?.nativeElement ?? null,
    options: { replacePending?: boolean } = {}
  ): void {
    if (!this.isCalendarMode() || !scrollElement) {
      return;
    }
    const page = this.currentCalendarPage(scrollElement);
    if (!page) {
      return;
    }
    if (this.calendarProgrammaticTargetKey) {
      if (page.key !== this.calendarProgrammaticTargetKey) {
        return;
      }
      this.calendarProgrammaticTargetKey = null;
    }
    if (
      this.calendarPageItems.has(page.key)
      || this.calendarPendingPageKey === page.key
      || this.calendarPreloadPageKey === page.key
    ) {
      return;
    }
    void this.loadCalendarPage(page.anchor, false, options);
  }

  private async loadCalendarPage(
    anchor: Date,
    isInitial = false,
    options: { replacePending?: boolean; force?: boolean } = {}
  ): Promise<void> {
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
    if (options.force === true && this.calendarPreloadPageKey) {
      this.cancelPendingCalendarPreload();
    }
    if (this.calendarPageItems.has(pageKey) && options.force !== true) {
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
      if (this.calendarPendingPageKey !== pageKey && options.replacePending === true) {
        this.cancelPendingCalendarPageLoad();
      } else {
        return;
      }
    }
    if (this.calendarPendingPageKey) {
      return;
    }

    const query = this.calendarQueryForAnchor(anchor);
    const sequence = ++this.loadSequence;
    const abortController = typeof AbortController === 'undefined' ? null : new AbortController();
    this.calendarLoadAbortController = abortController;
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
        firstValueFrom(loader(query, { signal: abortController?.signal })),
        this.wait(this.resolvedLoadingDelayMs(), abortController?.signal)
      ]);

      if (sequence !== this.loadSequence) {
        return;
      }

      this.applyCalendarResult(anchor, result, {
        deferRender: !isInitial && this.calendarScrollInProgress
      });
    } catch (error) {
      if (sequence !== this.loadSequence) {
        return;
      }
      if (this.isAbortError(error)) {
        return;
      }
      this.rememberCalendarPageAnchor(anchor);
      this.calendarPageItems.set(pageKey, []);
      this.calendarPageTotals.set(pageKey, 0);
      if (!isInitial && this.calendarScrollInProgress) {
        this.calendarDeferredPageKeys.add(pageKey);
        this.calendarRenderDeferred = true;
        this.initialLoading = false;
        return;
      }
      this.items = [];
      this.total = 0;
      this.initialLoading = false;
      this.hasMore = false;
      this.syncCalendarPages();
    } finally {
      if (sequence !== this.loadSequence) {
        return;
      }
      if (this.calendarLoadAbortController === abortController) {
        this.calendarLoadAbortController = null;
      }
      this.calendarPendingPageKey = null;
      this.calendarPendingPageAnchor = null;
      this.calendarPendingVisualKey = null;
      this.calendarFrozenProgress = null;
      this.loading = false;
      this.endLoadingAnimation();
      if (!this.calendarRenderDeferred) {
        this.refreshSurfaceSoon();
      }
      this.emitState();
      this.cdr.markForCheck();
      if (!this.calendarScrollInProgress) {
        this.maybeLoadCurrentCalendarPage();
      }
    }
  }

  private cancelPendingCalendarPageLoad(): void {
    if (!this.calendarPendingPageKey) {
      return;
    }
    this.loadSequence += 1;
    this.calendarLoadAbortController?.abort();
    this.calendarLoadAbortController = null;
    this.calendarPendingPageKey = null;
    this.calendarPendingPageAnchor = null;
    this.calendarPendingVisualKey = null;
    this.calendarProgrammaticTargetKey = null;
    this.calendarFrozenProgress = null;
    this.loading = false;
    this.clearLoadingAnimation();
    this.emitState();
    this.cdr.markForCheck();
  }

  public patchVisibleItem(
    predicate: (item: T, index: number) => boolean,
    patcher: (item: T, index: number) => T
  ): boolean {
    if (this.currentViewMode !== 'list') {
      return false;
    }
    const index = this.items.findIndex(predicate);
    if (index < 0) {
      return false;
    }
    const currentItem = this.items[index];
    if (currentItem === undefined) {
      return false;
    }
    const nextItem = patcher(currentItem, index);
    if (nextItem === currentItem) {
      return false;
    }
    const nextItems = [...this.items];
    nextItems[index] = nextItem;
    this.items = nextItems;
    this.syncGroups();
    this.emitState();
    this.cdr.markForCheck();
    return true;
  }

  private cancelPendingCalendarPreload(): void {
    this.calendarPreloadAbortController?.abort();
    this.calendarPreloadAbortController = null;
    this.calendarPreloadPageKey = null;
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
    this.cancelPendingCalendarPageLoad();
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
      this.releaseCalendarSnapAfterRecenter(slide);
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
      ? AppUtils.monthKey(normalizedAnchor)
      : AppUtils.dateKey(normalizedAnchor);
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
    const targetPage = pages[targetIndex] ?? null;
    const targetLeft = this.calendarPageOffsetLeft(scrollElement, targetIndex);
    if (targetLeft < 0) {
      this.calendarProgrammaticTargetKey = null;
      return;
    }
    const currentIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    const isSmoothPageMove = behavior === 'smooth' && currentIndex !== targetIndex;
    const targetPageAnchorToLoad = targetPage && !this.calendarPageItems.has(targetPage.key)
      ? targetPage.anchor
      : null;
    this.calendarProgrammaticTargetKey = currentIndex === targetIndex
      ? null
      : targetPage?.key ?? null;
    this.calendarScrollInProgress = this.calendarScrollInProgress || isSmoothPageMove;
    scrollElement.scrollTo({
      left: targetLeft,
      behavior
    });
    this.emitState();
    this.cdr.markForCheck();
    if (targetPageAnchorToLoad) {
      this.loadCalendarPageAfterScrollStarts(targetPageAnchorToLoad);
    }
  }

  private loadCalendarPageAfterScrollStarts(anchor: Date): void {
    setTimeout(() => {
      void this.loadCalendarPage(anchor, false, { replacePending: true });
    }, 0);
  }

  private async preloadCalendarPage(anchor: Date): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isCalendarMode()) {
      return;
    }
    const pageKey = this.calendarPageKey(anchor);
    if (this.calendarPageItems.has(pageKey) || this.calendarPendingPageKey === pageKey) {
      return;
    }
    if (this.calendarPreloadPageKey === pageKey) {
      return;
    }
    if (this.calendarPreloadPageKey) {
      this.calendarPreloadAbortController?.abort();
      this.calendarPreloadAbortController = null;
      this.calendarPreloadPageKey = null;
    }

    const abortController = typeof AbortController === 'undefined' ? null : new AbortController();
    this.calendarPreloadAbortController = abortController;
    this.calendarPreloadPageKey = pageKey;

    try {
      const result = await firstValueFrom(
        loader(this.calendarQueryForAnchor(anchor), { signal: abortController?.signal })
      );
      if (this.calendarPreloadPageKey !== pageKey || abortController?.signal.aborted) {
        return;
      }
      this.applyCalendarResult(anchor, result, { deferRender: true });
    } catch (error) {
      if (this.calendarPreloadPageKey !== pageKey || abortController?.signal.aborted) {
        return;
      }
      if (!this.isAbortError(error)) {
        this.rememberCalendarPageAnchor(anchor);
        this.calendarPageItems.set(pageKey, []);
        this.calendarPageTotals.set(pageKey, 0);
        this.calendarDeferredPageKeys.add(pageKey);
        this.calendarRenderDeferred = true;
      }
    } finally {
      if (this.calendarPreloadPageKey === pageKey) {
        this.calendarPreloadAbortController = null;
        this.calendarPreloadPageKey = null;
      }
      if (!this.calendarScrollInProgress && this.calendarRenderDeferred) {
        this.flushDeferredCalendarRender();
        this.emitState();
        this.cdr.markForCheck();
      }
    }
  }

  private currentVisibleCalendarAnchor(): Date | null {
    return this.currentCalendarPage()?.anchor ?? null;
  }

  private currentCalendarPage(
    scrollElement: HTMLDivElement | null = this.scrollHostRef?.nativeElement ?? null
  ): SmartListCalendarPage<T> | null {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return null;
    }
    return pages[this.currentCalendarPageIndex(scrollElement, pages.length)] ?? null;
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
      ? AppUtils.monthKey(this.monthFocusDate())
      : AppUtils.dateKey(this.weekFocusDate());
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
    return AppUtils.clampNumber(this.calendarProgressIndex(anchor, modelAnchors) / Math.max(1, modelAnchors.length - 1), 0, 1);
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
    const fraction = AppUtils.clampNumber(rawPageIndex - lowerIndex, 0, 1);
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
    return AppUtils.clampNumber(interpolatedIndex / Math.max(1, modelAnchors.length - 1), 0, 1);
  }

  private currentCalendarPageOffsetLeft(scrollElement: HTMLDivElement): number {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return scrollElement.scrollLeft;
    }
    const pageIndex = this.currentCalendarPageIndex(scrollElement, pages.length);
    const pageLeft = this.calendarPageOffsetLeft(scrollElement, pageIndex);
    return pageLeft >= 0 ? pageLeft : scrollElement.scrollLeft;
  }

  private prepareCalendarPageAheadForScroll(scrollElement: HTMLDivElement): void {
    const pages = this.currentCalendarPages();
    if (pages.length < 2 || this.suppressCalendarEdgeSettle) {
      return;
    }
    const baselineLeft = this.calendarScrollStartLeft ?? this.currentCalendarPageOffsetLeft(scrollElement);
    this.calendarScrollStartLeft = baselineLeft;
    const pageWidth = this.calendarViewportWidth(scrollElement);
    const directionThreshold = Math.max(8, pageWidth * 0.02);
    const delta = scrollElement.scrollLeft - baselineLeft;
    if (Math.abs(delta) < directionThreshold) {
      return;
    }
    const direction: -1 | 1 = delta > 0 ? 1 : -1;
    this.calendarScrollDirection = direction;
    const projectedIndex = Math.max(
      0,
      Math.min(pages.length - 1, Math.round(scrollElement.scrollLeft / Math.max(1, pageWidth)))
    );
    const projectedPage = pages[projectedIndex] ?? null;
    const anchor = projectedPage && !this.calendarPageItems.has(projectedPage.key)
      ? projectedPage.anchor
      : (direction > 0
          ? this.calendarAdjacentAnchor(pages[pages.length - 1]!.anchor, 1)
          : this.calendarAdjacentAnchor(pages[0]!.anchor, -1));
    const pageKey = this.calendarPageKey(anchor);
    if (
      this.calendarPreparedAheadPageKey === pageKey
      || this.calendarPageItems.has(pageKey)
      || this.calendarPendingPageKey === pageKey
      || this.calendarPreloadPageKey === pageKey
    ) {
      return;
    }
    this.calendarPreparedAheadPageKey = pageKey;
    void this.preloadCalendarPage(anchor);
  }

  private calendarAdjacentAnchor(anchor: Date, direction: -1 | 1): Date {
    return this.isMonthMode()
      ? AppUtils.addMonths(AppUtils.startOfMonth(anchor), direction)
      : AppUtils.addDays(AppUtils.startOfWeekMonday(anchor), direction * 7);
  }

  private setCalendarAnchorPages(anchors: ReadonlyArray<Date>, focus: Date): void {
    if (this.isMonthMode()) {
      this.calendarMonthFocusDate = AppUtils.startOfMonth(focus);
      this.calendarMonthAnchorPages = anchors.map(anchor => AppUtils.startOfMonth(anchor));
      return;
    }
    if (this.isWeekMode()) {
      this.calendarWeekFocusDate = AppUtils.startOfWeekMonday(focus);
      this.calendarWeekAnchorPages = anchors.map(anchor => AppUtils.startOfWeekMonday(anchor));
    }
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

  private scheduleCalendarScrollEnd(scrollElement: HTMLDivElement): void {
    if (!this.isCalendarMode()) {
      this.clearCalendarSettleTimers();
      return;
    }
    if (this.suppressCalendarEdgeSettle) {
      this.calendarScrollInProgress = false;
      this.clearCalendarSettleTimers();
      return;
    }
    if (this.calendarPostSettleTimer) {
      clearTimeout(this.calendarPostSettleTimer);
      this.calendarPostSettleTimer = null;
    }
    if (this.calendarEdgeSettleTimer) {
      clearTimeout(this.calendarEdgeSettleTimer);
    }
    // Touch-driven scroll snapping can miss native scrollend; keep the timer as a guard.
    this.calendarEdgeSettleTimer = setTimeout(() => {
      this.calendarEdgeSettleTimer = null;
      this.handleCalendarScrollEnd(scrollElement);
    }, SmartListComponent.CALENDAR_SCROLL_END_DEBOUNCE_MS);
  }

  private handleCalendarScrollEnd(scrollElement: HTMLDivElement): void {
    if (
      !this.isCalendarMode()
      || this.isTouchingSurface
      || this.suppressCalendarEdgeSettle
      || scrollElement !== this.scrollHostRef?.nativeElement
    ) {
      return;
    }
    if (!this.isCalendarScrollPageAligned(scrollElement)) {
      this.scheduleCalendarStableScrollEnd(scrollElement);
      return;
    }
    this.clearCalendarSettleTimers();
    this.calendarScrollInProgress = false;
    this.calendarPreparedAheadPageKey = null;
    const visiblePage = this.currentCalendarPage(scrollElement);
    if (!visiblePage || visiblePage.key !== this.calendarProgrammaticTargetKey) {
      if (
        this.calendarProgrammaticTargetKey
        && this.calendarPendingPageKey === this.calendarProgrammaticTargetKey
        && visiblePage?.key !== this.calendarProgrammaticTargetKey
      ) {
        this.cancelPendingCalendarPageLoad();
      }
      this.calendarProgrammaticTargetKey = null;
    }
    if (this.settleCalendarWindow(scrollElement)) {
      this.calendarScrollStartLeft = null;
      this.calendarScrollDirection = null;
      this.flushDeferredCalendarRender(scrollElement);
      this.emitState();
      this.cdr.markForCheck();
      return;
    }
    this.calendarScrollStartLeft = null;
    this.calendarScrollDirection = null;
    this.updateCalendarSurface(scrollElement);
    this.flushDeferredCalendarRender(scrollElement);
    this.emitState();
    this.cdr.markForCheck();
  }

  private scheduleCalendarStableScrollEnd(scrollElement: HTMLDivElement): void {
    if (this.calendarPostSettleTimer) {
      clearTimeout(this.calendarPostSettleTimer);
    }
    const scrollLeftSnapshot = scrollElement.scrollLeft;
    this.calendarPostSettleTimer = setTimeout(() => {
      this.calendarPostSettleTimer = null;
      if (!this.isCalendarMode() || this.suppressCalendarEdgeSettle || scrollElement !== this.scrollHostRef?.nativeElement) {
        return;
      }
      const scrollDelta = Math.abs(scrollElement.scrollLeft - scrollLeftSnapshot);
      if (scrollDelta > SmartListComponent.CALENDAR_SCROLL_SETTLE_TOLERANCE_PX) {
        this.scheduleCalendarScrollEnd(scrollElement);
        return;
      }
      if (!this.isCalendarScrollPageAligned(scrollElement)) {
        this.alignCalendarScrollToSettledPage(scrollElement);
      }
      this.handleCalendarScrollEnd(scrollElement);
    }, SmartListComponent.CALENDAR_SCROLL_STABLE_DELAY_MS);
  }

  private isCalendarScrollPageAligned(scrollElement: HTMLDivElement): boolean {
    const targetPageLeft = this.settledCalendarPageLeft(scrollElement);
    if (targetPageLeft === null) {
      return true;
    }
    return Math.abs(scrollElement.scrollLeft - targetPageLeft) <= SmartListComponent.CALENDAR_SCROLL_SETTLE_TOLERANCE_PX;
  }

  private alignCalendarScrollToSettledPage(scrollElement: HTMLDivElement): void {
    const targetPageLeft = this.settledCalendarPageLeft(scrollElement);
    if (targetPageLeft === null) {
      return;
    }
    scrollElement.scrollTo({ left: targetPageLeft, behavior: 'smooth' });
  }

  private settledCalendarPageLeft(scrollElement: HTMLDivElement): number | null {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return null;
    }
    const pageIndex = this.settledCalendarPageIndex(scrollElement, pages.length);
    const pageLeft = this.calendarPageOffsetLeft(scrollElement, pageIndex);
    return pageLeft < 0 ? null : pageLeft;
  }

  private settledCalendarPageIndex(scrollElement: HTMLDivElement, totalPages: number): number {
    if (!this.calendarScrollDirection || this.calendarScrollStartLeft === null) {
      return this.currentCalendarPageIndex(scrollElement, totalPages);
    }
    const startIndex = this.calendarPageIndexForLeft(scrollElement, totalPages, this.calendarScrollStartLeft);
    const currentIndex = this.currentCalendarPageIndex(scrollElement, totalPages);
    if (currentIndex !== startIndex) {
      return currentIndex;
    }
    const delta = Math.abs(scrollElement.scrollLeft - this.calendarScrollStartLeft);
    if (delta < this.calendarDirectionCommitThresholdPx(scrollElement)) {
      return startIndex;
    }
    return Math.max(0, Math.min(totalPages - 1, startIndex + this.calendarScrollDirection));
  }

  private calendarDirectionCommitThresholdPx(scrollElement: HTMLDivElement): number {
    return Math.max(
      SmartListComponent.CALENDAR_DIRECTION_COMMIT_MIN_PX,
      this.calendarViewportWidth(scrollElement) * SmartListComponent.CALENDAR_DIRECTION_COMMIT_RATIO
    );
  }

  private flushDeferredCalendarRender(scrollElement?: HTMLDivElement | null): void {
    if (!this.calendarRenderDeferred) {
      return;
    }
    this.syncCalendarPages({ flushDeferred: true });
    this.updateCalendarSurface(scrollElement);
    this.focusVisibleWeekRateHourSoon();
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

  private settleCalendarWindow(scrollElement: HTMLDivElement): boolean {
    const pages = this.currentCalendarPages();
    if (pages.length === 0) {
      return false;
    }
    const currentIndex = this.settledCalendarPageIndex(scrollElement, pages.length);
    const activePage = pages[currentIndex];
    if (!activePage) {
      return false;
    }
    this.loadCalendarPageForSettledPage(activePage);
    const desiredIndex = this.desiredCalendarPageIndex(pages.length);
    if (currentIndex !== desiredIndex && (currentIndex === 0 || currentIndex === pages.length - 1)) {
      this.recenterCalendarWindow(activePage.anchor, desiredIndex, { loadAfterRecenter: false });
      return true;
    }
    return false;
  }

  private loadCalendarPageForSettledPage(page: SmartListCalendarPage<T>): void {
    const settledPageChanged = this.calendarLastSettledPageKey !== page.key;
    this.calendarLastSettledPageKey = page.key;
    if (settledPageChanged) {
      if (this.calendarPendingPageKey === page.key) {
        return;
      }
      this.cancelPendingCalendarPreload();
      void this.loadCalendarPage(page.anchor, false, { replacePending: true, force: true });
      return;
    }
    if (
      this.calendarPageItems.has(page.key)
      || this.calendarPendingPageKey === page.key
      || this.calendarPreloadPageKey === page.key
    ) {
      return;
    }
    void this.loadCalendarPage(page.anchor, false, { replacePending: true });
  }

  private recenterCalendarWindow(
    anchor: Date,
    targetIndex: number,
    options: { loadAfterRecenter?: boolean } = {}
  ): void {
    const loadAfterRecenter = options.loadAfterRecenter !== false;
    const targetPageKey = this.calendarPageKey(anchor);
    if (!loadAfterRecenter || this.calendarPageItems.has(targetPageKey)) {
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
    const nextElement = this.scrollHostRef?.nativeElement ?? null;
    const previousScrollBehavior = nextElement?.style.scrollBehavior ?? '';
    const previousSnapType = nextElement?.style.scrollSnapType ?? '';
    if (nextElement) {
      nextElement.style.scrollBehavior = 'auto';
      nextElement.style.scrollSnapType = 'none';
    }
    this.syncCalendarPages();
    this.cdr.detectChanges();

    if (!nextElement) {
      this.suppressCalendarEdgeSettle = false;
      if (loadAfterRecenter) {
        this.maybeLoadCurrentCalendarPage();
      }
      this.emitState();
      this.cdr.markForCheck();
      return;
    }
    const targetLeft = this.calendarPageOffsetLeft(nextElement, targetIndex);
    if (targetLeft < 0) {
      nextElement.style.scrollBehavior = previousScrollBehavior;
      nextElement.style.scrollSnapType = previousSnapType;
      this.suppressCalendarEdgeSettle = false;
      if (loadAfterRecenter) {
        this.maybeLoadCurrentCalendarPage(nextElement);
      }
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    nextElement.scrollLeft = targetLeft;
    nextElement.style.scrollBehavior = previousScrollBehavior;
    const release = () => {
      nextElement.style.scrollSnapType = previousSnapType;
      this.suppressCalendarEdgeSettle = false;
      this.updateCalendarSurface(nextElement);
      this.emitState();
      this.cdr.markForCheck();
      if (loadAfterRecenter) {
        this.maybeLoadCurrentCalendarPage(nextElement);
      }
    };
    this.releaseCalendarSnapAfterRecenter(release);
  }

  private releaseCalendarSnapAfterRecenter(callback: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(callback));
      return;
    }
    setTimeout(callback, SmartListComponent.CALENDAR_SCROLL_STABLE_DELAY_MS);
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

  private calendarPageIndexForLeft(
    scrollElement: HTMLDivElement,
    totalPages: number,
    left: number
  ): number {
    if (totalPages <= 1) {
      return 0;
    }
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.smart-list__calendar-page')
    ).slice(0, totalPages);
    if (pageElements.length === 0) {
      const pageWidth = this.calendarViewportWidth(scrollElement) || 1;
      return Math.max(0, Math.min(totalPages - 1, Math.round(left / pageWidth)));
    }
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < pageElements.length; index += 1) {
      const distance = Math.abs(left - pageElements[index].offsetLeft);
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

}
