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

import { AppUtils } from '../../../../app-utils';
import {
  IndicatorComponent,
  type IndicatorBarConfig,
  type IndicatorPlacement
} from '../indicator';
import {
  CalendarCardComponent as SmartListPageCardComponent
} from './card/calendar-card';
import { ROUTE_CONFIG } from '../../../../core/base/config';
import {
  AppMenuDispatcher,
  AppMenuOutletComponent,
  type AppMenuDispatchState,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuRateConfig
} from '../menu';
import {
  type AnySmartListPageAdapter,
  type SmartListPage,
  type SmartListPageCardModel,
  type SmartListPageMode
} from './smart-list-page.adapter';
import { SmartListCalendarAdapter } from './smart-list-calendar.adapter';
import {
  compareSmartListLocalSortKeys,
  smartListLocalSortKeyFromItem
} from './smart-list-local-sort';
import { smartListItemKeyFromItem } from './smart-list-item-key';
import {
  InfiniteStepper as Stepper,
  type InfiniteStepperLoadOptions as StepperLoadOptions,
  type InfiniteStepperSnapshot as StepperSnapshot,
  type InfiniteStepperSurfaceState as StepperSurfaceState
} from './infinite-stepper';
import { FiniteStepper } from './finite-stepper';
import { UiTaskScheduler } from '../../../scheduler';
import type {
  ListDirection,
  ListQuery,
  PageResult,
  SmartListCacheableConfig,
  SmartListConverter,
  SmartListCursorState,
  SmartListFilters,
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
  SmartListPaginationStep,
  SmartListPresentation,
  SmartListPrependRestoreMode,
  SmartListSortableConfig,
  SmartListStateChange,
  SmartListViewConfig,
  SmartListViewMode
} from './smart-list.types';

@Component({
  selector: 'app-smart-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    IndicatorComponent,
    AppMenuOutletComponent,
    SmartListPageCardComponent
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

  @ViewChild('paginationMenuOutlet')
  private paginationMenuOutlet?: AppMenuOutletComponent<string, unknown>;

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
  protected pages: SmartListPage<T>[] = [];
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
  private sourceItemByIdentity = new Map<string, unknown>();
  private listItemIndexByObject = new WeakMap<object, number>();
  private resolvedListTrackKeyByObject = new WeakMap<object, string | number>();
  private fallbackTrackKeySequence = 0;
  private converterContext: unknown = null;

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
  private stepperInitialAnchorKey = '';
  private stepperPageLoadAbortController: AbortController | null = null;
  private stepperPreloadAbortController: AbortController | null = null;
  private activePageAdapter: AnySmartListPageAdapter<T, TFilters> | null = null;
  private weekRateViewportPageKey: string | null = null;
  private forceAnimatedLoadingCompletion = false;
  private hostedFullscreenPendingDelta = 0;
  private hostedFullscreenCompletingTransition = false;
  private hostedFullscreenTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pollScheduler = new UiTaskScheduler<ListQuery<TFilters>>({
    intervalMs: () => this.resolvedPollIntervalMs(),
    state: () => this.visiblePollQuery(),
    task: ({ state, signal }) => this.pollVisibleItems(state, signal)
  });

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
    this.stepper.clearSettleTimers();

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

    if (this.isPageMode()) {
      this.stepper.scheduleScrollEnd(scrollElement);
    }
  }

  private readonly finiteStepper = new FiniteStepper<T>({
    items: () => this.items,
    total: () => this.total,
    hasMore: () => this.hasMore,
    loading: () => this.loading,
    markDirty: () => {
      this.emitState();
      this.cdr.markForCheck();
    }
  });
  private readonly stepper = new Stepper<
    Date,
    SmartListPage<T>,
    T,
    ListQuery<TFilters>,
    any
  >(
    {
      pageSelector: '.smart-list__page'
    },
    {
      isActive: () => this.isPageMode(),
      isTouchingSurface: () => this.isTouchingSurface,
      scrollElement: () => this.scrollHostRef?.nativeElement ?? null,
      pageAdapter: () => this.activePageAdapter,
      viewConfig: () => this.activePageAdapter?.config(this.config) ?? null,
      baseQuery: () => this.currentBaseQuery(),
      fallbackAnchor: () => AppUtils.dateOnly(new Date()),
      trackByKey: item => this.pageTrackKey(0, item),
      cancelPendingPageLoad: () => this.cancelPendingAnchorPageLoad(),
      cancelPendingPreload: () => this.cancelPendingAnchorPreload(),
      loadPage: (anchor, query, options) => {
        void this.loadAnchorPage(anchor, query, false, options);
      },
      preloadPage: (anchor, query) => {
        void this.preloadAnchorPage(anchor, query);
      },
      currentProgress: () => this.progress,
      applySnapshot: snapshot => this.applyPageSnapshot(snapshot),
      applySurfaceState: (state, scrollElement) => this.applyPageSurfaceState(state, scrollElement),
      afterSnapshotApplied: () => this.focusVisibleWeekRateHourSoon(),
      detectChanges: () => this.cdr.detectChanges(),
      emitState: () => this.emitState(),
      markForCheck: () => this.cdr.markForCheck()
    }
  );

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
    this.activePageAdapter = this.isPageMode()
      ? SmartListCalendarAdapter.getInstance<T, TFilters>(this.currentViewMode as SmartListPageMode)
      : null;
    this.previousPresentation = this.resolvedPresentation();

    const pageDataInputsChanged = Boolean(
      changes['config']
      || changes['loadPage']
      || changes['loaders']
      || changes['query']
      || changes['sort']
      || changes['direction']
      || changes['filters']
      || changes['groupBy']
    );

    if (pageDataInputsChanged) {
      this.clearPageViewCache();
    }

    const nextInitialAnchorKey = this.stepper.initialAnchorKey();
    const initialAnchorChanged = nextInitialAnchorKey !== this.stepperInitialAnchorKey;
    this.stepperInitialAnchorKey = nextInitialAnchorKey;

    if (
      (changes['view'] && previousViewKey !== this.currentViewKey)
      || (initialAnchorChanged && this.isPageMode())
    ) {
      this.stepper.clearSettleTimers();
      this.stepper.suppressSettle = false;
      if (this.isPageMode()) {
        this.stepper.setWindowFocus(this.stepper.initialAnchor(), { useInitialPageIndex: true });
      } else {
        this.stepper.clearWindow();
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
    this.pollScheduler.destroy();
    this.stepper.reset();
    this.clearListSnapSettleTimers();
    this.clearHorizontalCursorScrollLock();
    this.clearLoadingAnimation();
    this.clearHostedFullscreenTransitionTimer();
    this.clearPaginationAutoplay();
    this.finiteStepper.destroy();
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

  public indicatorBarConfig(
    overrides: Partial<IndicatorBarConfig> = {},
    mode: 'surface' | 'cursor' = 'surface'
  ): IndicatorBarConfig {
    const cursor = this.finiteStepper.state();
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

  protected shouldRenderHostedIndicator(): boolean {
    if (this.config.headerProgress && this.config.headerProgress.enabled !== undefined) {
      return this.resolveConfigValue(this.config.headerProgress.enabled, false);
    }
    return this.resolvedLoadingDelayMs() > 0;
  }

  protected hostedIndicatorConfig(): IndicatorBarConfig {
    const placement = this.resolveConfigValue<IndicatorPlacement>(this.config.headerProgress?.placement, 'inline');
    const state = this.resolveConfigValue<SmartListHeaderProgressState>(this.config.headerProgress?.state, 'active');
    return this.indicatorBarConfig({
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
    return this.resolvedPaginationMode() === 'arrows' && !this.shouldRenderStickyPaginationActions();
  }

  protected shouldRenderStickyPaginationActions(): boolean {
    return this.resolvedPaginationMode() === 'arrows'
      && this.resolveConfigValue(this.config.pagination?.headerControls, false)
      && this.shouldShowStickyHeader();
  }

  protected shouldRenderListHeaderOutsideScroll(): boolean {
    return this.currentViewMode === 'list'
      && this.isHorizontalList()
      && this.shouldRenderStickyPaginationActions();
  }

  protected canMovePagination(direction: -1 | 1): boolean {
    const delta = this.paginationCursorDelta(direction);
    return delta !== 0 && this.finiteStepper.canMove(delta);
  }

  protected shouldRenderHorizontalPaginationDots(): boolean {
    return this.isHorizontalList() && this.finiteStepper.state().total > 1;
  }

  protected horizontalPaginationDotIndexes(): number[] {
    const total = this.finiteStepper.state().total;
    return Array.from({ length: Math.max(0, total) }, (_item, index) => index);
  }

  protected isHorizontalPaginationDotActive(index: number): boolean {
    return this.finiteStepper.state().index === index;
  }

  protected resolvedPaginationRatingBarConfig(): AppMenuRateConfig | null {
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
      kind: 'rate',
      closeOnSelect: false,
      value: this.resolvedPaginationRatingBarValue(),
      rateConfig: config,
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
    void this.moveCursor(this.paginationCursorDelta(-1));
  }

  protected onPaginationNext(event: Event): void {
    event.stopPropagation();
    this.pausePaginationAutoplay();
    if (this.shouldUseHostedFullscreenPagination()) {
      this.interruptHostedFullscreenTransition();
      void this.advanceHostedFullscreenPagination(1);
      return;
    }
    void this.moveCursor(this.paginationCursorDelta(1));
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

  public visibleItemCount(): number {
    return this.items.length;
  }

  public findVisibleItem(predicate: (item: T, index: number) => boolean): T | null {
    return this.items.find(predicate) ?? null;
  }

  public paginationMenuHeightPx(): number {
    return this.shouldRenderPaginationRatingBar()
      ? this.paginationMenuOutlet?.heightPx() ?? 0
      : 0;
  }

  public isPaginationMenuTarget(target: EventTarget | null | undefined): boolean {
    return this.shouldRenderPaginationRatingBar()
      && (this.paginationMenuOutlet?.containsTarget(target) ?? false);
  }

  public cursorState(): SmartListCursorState<T> {
    return this.finiteStepper.state();
  }

  public cursorItem(): T | null {
    return this.finiteStepper.state().item;
  }

  public isLoadingActive(): boolean {
    return !this.suppressVisibleLoadingProgress && (this.loading || this.loadingProgress > 0);
  }

  public isFullscreenPaginationAnimating(): boolean {
    return this.finiteStepper.animating;
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
    this.finiteStepper.setEmptyCursor(false, { notify: false });
    this.clearLoadingAnimation();
    this.loading = false;
    this.initialLoading = false;
    this.clearAwaitScrollReset();
    this.items = this.orderSortableItems(items);
    this.total = Number.isFinite(options.total)
      ? Math.max(this.items.length, Math.trunc(Number(options.total)))
      : this.items.length;
    this.hasMore = this.items.length < this.total;
    this.syncGroups();
    this.finiteStepper.syncBounds();
    this.emitState();
    this.cdr.markForCheck();
    this.refreshSurfaceSoon();
  }

  public syncVisibleItems(
    items: readonly T[],
    options: {
      total?: number;
      equals?: (current: T, next: T, index: number) => boolean;
      trackBy?: (index: number, item: T) => unknown;
    } = {}
  ): boolean {
    if (this.currentViewMode !== 'list') {
      return false;
    }
    const nextItems = this.orderSortableItems(items);
    const nextTotal = Number.isFinite(options.total)
      ? Math.max(nextItems.length, Math.trunc(Number(options.total)))
      : nextItems.length;
    const sameShape = this.total === nextTotal
      && this.items.length === nextItems.length
      && this.items.every((item, index) =>
        this.cacheTrackKey(item, index, options.trackBy)
          === this.cacheTrackKey(nextItems[index], index, options.trackBy)
      );

    if (!sameShape) {
      this.replaceVisibleItems(nextItems, { total: nextTotal });
      return true;
    }

    const query = this.currentQuery();
    const adapterEquals = this.cacheableConfig()?.equals;
    const equals = options.equals ?? ((current: T, next: T, index: number) =>
      adapterEquals ? adapterEquals(current, next, index, query) : current === next);
    let changed = false;
    const patchedItems = this.items.map((item, index) => {
      const nextItem = nextItems[index];
      if (nextItem === undefined || equals(item, nextItem, index)) {
        return item;
      }
      changed = true;
      return nextItem;
    });
    if (!changed) {
      return false;
    }
    this.items = patchedItems;
    this.syncGroups();
    this.finiteStepper.syncBounds();
    this.emitState();
    this.cdr.markForCheck();
    return true;
  }

  public convertItems<TSource>(sources: readonly TSource[], context?: unknown): T[] {
    const query = this.currentQuery();
    this.converterContext = context ?? null;
    const converter = this.resolvedConverter<TSource>(query);
    if (!converter) {
      return [];
    }
    const items = converter.convertList(sources, this.converterOptions(query));
    this.cacheSourceItems(items, sources);
    return items;
  }

  public async moveCursor(delta: number): Promise<boolean> {
    if (!Number.isFinite(delta) || delta === 0) {
      return false;
    }
    return this.setCursorIndex(this.finiteStepper.state().index + Math.trunc(delta));
  }

  private resolvedPaginationStep(): SmartListPaginationStep {
    return this.resolveConfigValue(this.config.pagination?.step, 'item');
  }

  private paginationCursorDelta(direction: -1 | 1): number {
    return this.finiteStepper.deltaFor(direction, this.resolvedPaginationStep(), this.paginationPageSize());
  }

  private paginationPageSize(): number {
    if (this.isHorizontalList() && this.shouldUseHorizontalMobileStepper()) {
      return 1;
    }
    const columns = Number(this.resolvedDesktopColumns());
    if (Number.isFinite(columns) && columns > 0) {
      return Math.max(1, Math.trunc(columns));
    }
    const pageSize = Number(this.currentQuery().pageSize);
    return Number.isFinite(pageSize) && pageSize > 0 ? Math.max(1, Math.trunc(pageSize)) : 1;
  }

  public async setCursorIndex(index: number): Promise<boolean> {
    const normalizedIndex = Math.max(0, Math.trunc(index));
    this.finiteStepper.setIndex(normalizedIndex, { notify: false });
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

    this.finiteStepper.syncBounds();
    this.scrollHorizontalListItemIntoView(normalizedIndex, 'smooth');
    this.emitState();
    this.cdr.markForCheck();
    return this.finiteStepper.state().index === normalizedIndex;
  }

  protected isPageMode(): boolean {
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

  protected onPageScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.stepper.onScroll(target);
  }

  protected onPageScrollEnd(event: Event): void {
    this.stepper.onScrollEnd(event.target as HTMLDivElement);
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
      sourceItem: this.sourceItemForItem(item, index),
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
    return this.finiteStepper.leavingItem ?? this.hostedFullscreenResolvedCursor().item;
  }

  protected hostedFullscreenCurrentItemIndex(): number {
    return this.hostedFullscreenResolvedCursor().index;
  }

  protected hostedFullscreenCurrentRenderState(): SmartListItemRenderState {
    return this.finiteStepper.animating ? 'leaving' : 'active';
  }

  protected hostedFullscreenStackItem(slotOffset: number): T | null {
    const index = this.hostedFullscreenStackItemIndex(slotOffset);
    if (index < 0 || index >= this.items.length) {
      return null;
    }
    return this.items[index] ?? null;
  }

  protected hostedFullscreenStackRenderState(slotOffset: number): SmartListItemRenderState {
    if (slotOffset === 1 && this.finiteStepper.animating && this.hostedFullscreenPendingDelta !== 0) {
      return 'active';
    }
    return 'default';
  }

  protected hostedFullscreenIsCurling(): boolean {
    return this.finiteStepper.animating && this.hostedFullscreenPendingDelta !== 0;
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
    index = this.finiteStepper.state().index
  ): SmartListItemTemplateContext<T, TFilters> {
    return {
      $implicit: item,
      index,
      sourceItem: this.sourceItemForItem(item, index),
      groupLabel: '',
      query: this.currentQuery(),
      selectMode: this.resolvedSelectMode(),
      presentation: 'fullscreen',
      renderState,
      selectItem: event => this.selectSmartListItem(item, event),
      openMenu: request => this.openItemMenu(item, request)
    };
  }

  private hostedFullscreenResolvedCursor(): SmartListCursorState<T> {
    const cursor = this.finiteStepper.state();
    if (cursor.item !== null || this.items.length === 0) {
      return cursor;
    }
    const fallbackIndex = Math.max(0, Math.min(cursor.index, this.items.length - 1));
    return {
      ...cursor,
      index: fallbackIndex,
      item: this.items[fallbackIndex] ?? null
    };
  }

  private selectSmartListItem(item: T, event?: Event): void {
    event?.stopPropagation();
    const itemIndex = this.items.indexOf(item);
    this.itemSelect.emit({
      item,
      sourceItem: this.sourceItemForItem(item, itemIndex),
      query: this.currentQuery(),
      currentView: this.currentViewKey,
      currentViewMode: this.currentViewMode,
      selectMode: this.resolvedSelectMode(),
      sourceEvent: event
    });
  }

  private cacheSourceItems<TSource>(items: readonly T[], sources: readonly TSource[]): void {
    for (const [index, item] of items.entries()) {
      const identity = `${this.cacheTrackKey(item, index)}`.trim();
      if (!identity) {
        continue;
      }
      this.sourceItemByIdentity.set(identity, sources[index]);
    }
  }

  private sourceItemForItem(item: T, index: number): unknown {
    const identity = `${this.cacheTrackKey(item, Math.max(0, index))}`.trim();
    return identity ? this.sourceItemByIdentity.get(identity) : undefined;
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

  protected hasPageItems(): boolean {
    return this.pages.length > 0;
  }

  protected isRateCountPageVariant(): boolean {
    return this.activePageAdapter?.variant(this.config, this.currentBaseQuery()) === 'rate-counts';
  }

  protected pageCardModel(): SmartListPageCardModel<T, TFilters> {
    return {
      mode: this.currentViewMode as SmartListPageMode,
      pages: this.pages,
      config: this.activePageAdapter?.config(this.config) ?? null,
      query: this.currentQuery(),
      variant: this.isRateCountPageVariant() ? 'rate-counts' : 'default',
      touching: this.isTouchingSurface,
      trackByItem: (index, item) => this.pageTrackKey(index, item),
      onItemSelect: this.selectPageCardItem
    };
  }

  private readonly selectPageCardItem = (item: T, event?: Event): void => {
    this.selectSmartListItem(item, event);
  };

  protected readonly navigatePageHeader = (direction: -1 | 1, event?: Event): void => {
    event?.stopPropagation();
    this.stepper.navigateBy(direction);
  };

  private resetAndReload(): void {
    this.resetHostedFullscreenTransition();
    this.clearHorizontalCursorScrollLock();
    this.clearLoadingAnimation();
    this.stepper.reset();
    this.suspendSnapReactivation = false;
    this.deferSnapReactivationUntilScroll = false;
    this.lastResolvedBaseSnapMode = null;
    this.loading = false;
    this.loadSequence += 1;
    this.suppressVisibleLoadingProgress = false;
    this.finiteStepper.reset({ notify: false });
    this.items = [];
    this.groups = [];
    this.pages = [];
    this.total = 0;
    this.pageIndex = 0;
    this.nextPageCursor = null;
    this.hasMore = this.currentViewMode === 'list';
    this.initialLoading = true;
    this.clearAwaitScrollReset();
    this.stickyLabel = this.resolveEmptyStickyLabel();
    this.progress = 0;
    this.scrollable = false;
    this.weekRateViewportPageKey = null;
    this.pollScheduler.restart();

    if (this.currentViewMode === 'list') {
      this.stepper.clearWindow();
      this.emitState();
      this.resetScrollSoon();
      void this.loadInitialListPages();
      return;
    }
    this.stepper.ensureWindow();
    this.stepper.applySnapshot();
    this.seedPageProgress();
    this.emitState();
    this.resetScrollSoon();
    void this.loadPageWindow();
  }

  private visiblePollQuery(): ListQuery<TFilters> {
    const pageSize = Math.max(1, this.items.length || this.resolveEffectivePageSize());
    return {
      ...this.currentQuery(0),
      page: 0,
      pageSize,
      cursor: undefined
    };
  }

  private async pollVisibleItems(query: ListQuery<TFilters>, signal?: AbortSignal): Promise<void> {
    const loader = this.resolveLoadPage();
    if (
      signal?.aborted
      || !loader
      || this.currentViewMode !== 'list'
      || this.initialLoading
      || this.loading
    ) {
      return;
    }

    const sequence = this.loadSequence;
    const result = await firstValueFrom(loader(query, { signal }));
    if (signal?.aborted || sequence !== this.loadSequence || this.currentViewMode !== 'list') {
      return;
    }

    const items = Array.isArray(result?.items) ? result.items : [];
    const total = Number.isFinite(result?.total)
      ? Math.max(0, Math.trunc(Number(result?.total)))
      : undefined;
    this.syncVisibleItems(items, { total });
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

  private async loadPageWindow(): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isPageMode()) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }
    const anchor = this.currentPageAnchor();
    if (!anchor) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }
    this.stepper.setLastSettledPageKey(this.stepper.pageKey(anchor));
    await this.loadAnchorPage(anchor, this.stepper.queryForAnchor(anchor), true);
  }

  private applyListPageResult(result: PageResult<T> | null | undefined, isInitial: boolean): void {
    // Lock the snap reactivation if we were suppressing it at the bottom
    if (!isInitial && this.listMergeStrategy() !== 'prepend' && this.suppressListSnapNearEnd) {
      this.suspendSnapReactivation = true;
    }

    const nextItems = Array.isArray(result?.items) ? result.items : [];
    const hasExplicitNextCursor = Boolean(result && Object.prototype.hasOwnProperty.call(result, 'nextCursor'));
    if (isInitial) {
      this.items = this.orderSortableItems(nextItems);
    } else if (this.listMergeStrategy() === 'prepend') {
      this.items = this.orderSortableItems([...nextItems, ...this.items]);
    } else {
      this.items = this.orderSortableItems([...this.items, ...nextItems]);
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
    this.finiteStepper.syncBounds();
  }

  private applyAnchorPageResult(
    anchor: Date,
    result: PageResult<T> | null | undefined,
    options: { deferRender?: boolean } = {}
  ): void {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    const total = Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : nextItems.length;
    this.stepper.setPageResult(anchor, nextItems, total, options);
    this.initialLoading = false;
    if (options.deferRender === true) {
      return;
    }
    this.items = this.orderSortableItems(nextItems);
    this.total = Math.max(nextItems.length, total);
    this.pageIndex = 0;
    this.hasMore = false;
    this.groups = [];
    this.finiteStepper.syncBounds();
    this.stepper.applySnapshot();
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

    const itemElements = this.ownedListElements<HTMLElement>(scrollElement, '[data-smart-list-index]');
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

  private ownedListElements<TElement extends HTMLElement>(
    scrollElement: HTMLElement,
    selector: string
  ): TElement[] {
    return Array.from(scrollElement.querySelectorAll<TElement>(selector))
      .filter(element => element.closest('.smart-list') === scrollElement);
  }

  private ownedListElement<TElement extends HTMLElement>(
    scrollElement: HTMLElement,
    selector: string
  ): TElement | null {
    return this.ownedListElements<TElement>(scrollElement, selector)[0] ?? null;
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
      ? this.ownedListElement<HTMLElement>(scrollElement, '.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
    const includeStickyGroupMarker = options.includeStickyGroupMarker !== false;
    const baseInset = Math.max(stickyHeaderHeight, scrollPaddingTop);

    if (!includeStickyGroupMarker) {
      return baseInset;
    }

    const stickyGroupMarker = this.ownedListElements<HTMLElement>(scrollElement, '.smart-list__group-marker')
      .find(marker => {
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
    const anchors = this.ownedListElements<HTMLElement>(scrollElement, '.smart-list__item-shell[data-smart-list-anchor]');
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
    const itemShells = this.ownedListElements<HTMLElement>(scrollElement, '.smart-list__item-shell[data-smart-list-anchor]')
      .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
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
        const firstBoundary = this.ownedListElement<HTMLElement>(scrollElement, '.smart-list__group-marker, .smart-list__item-shell');
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
    const anchorElement = this.ownedListElements<HTMLElement>(scrollElement, '.smart-list__item-shell[data-smart-list-anchor]')
      .find(element => (element.dataset['smartListAnchor'] ?? '') === restoreContext.anchorKey) ?? null;
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

  private orderSortableItems(items: readonly T[]): T[] {
    const sortable = this.sortableConfig();
    if (!sortable) {
      return [...items];
    }
    const query = this.currentQuery();
    return items
      .map((item, index) => ({
        item,
        index,
        sortKey: this.localSortKeyForItem(item, query, index)
      }))
      .sort((left, right) =>
        compareSmartListLocalSortKeys(left.sortKey, right.sortKey)
        || left.index - right.index
      )
      .map(entry => entry.item);
  }

  private localSortKeyForItem(item: T, query: ListQuery<TFilters>, index: number): ReturnType<typeof smartListLocalSortKeyFromItem> {
    return this.sortableConfig()?.sortKey?.(item, index, query)
      ?? smartListLocalSortKeyFromItem(item);
  }

  private cacheableConfig(): SmartListCacheableConfig<T, TFilters> | null {
    const cacheable = this.config.cacheable;
    if (cacheable === true) {
      return {};
    }
    return cacheable && typeof cacheable === 'object' ? cacheable : null;
  }

  private sortableConfig(): SmartListSortableConfig<T, TFilters> | null {
    const sortable = this.config.sortable;
    if (sortable === true) {
      return {};
    }
    return sortable && typeof sortable === 'object' ? sortable : null;
  }

  private resolvedConverter<TSource>(
    query: ListQuery<TFilters>
  ): SmartListConverter<TSource, T, TFilters> | null {
    const converter = this.config.converter;
    if (!converter) {
      return null;
    }
    const resolved = typeof converter === 'function' ? converter(query) : converter;
    return resolved as SmartListConverter<TSource, T, TFilters> | null;
  }

  private converterOptions(query: ListQuery<TFilters>): ListQuery<TFilters> {
    return this.converterContext === null || this.converterContext === undefined
      ? query
      : {
        ...query,
        context: this.converterContext
      } as ListQuery<TFilters>;
  }

  private cacheTrackKey(
    item: T | undefined,
    index: number,
    trackBy?: (index: number, item: T) => unknown
  ): string | number {
    if (item === undefined || trackBy) {
      return this.visibleSyncTrackKey(item, index, trackBy);
    }
    const identity = this.cacheableConfig()?.identity;
    if (!identity) {
      return this.visibleSyncTrackKey(item, index);
    }
    const key = identity(item, index, this.currentQuery());
    if (key === null || key === undefined) {
      return this.visibleSyncTrackKey(item, index);
    }
    const normalized = `${key}`.trim();
    if (normalized.length > 0) {
      return normalized;
    }
    const itemKey = smartListItemKeyFromItem(item);
    return itemKey ?? this.visibleSyncTrackKey(item, index);
  }

  private visibleSyncTrackKey(
    item: T | undefined,
    index: number,
    trackBy?: (index: number, item: T) => unknown
  ): string | number {
    if (item === undefined) {
      return `smart-list-sync:missing:${index}`;
    }
    const key = trackBy?.(index, item) ?? this.config.trackBy?.(index, item);
    if (key === null || key === undefined) {
      return smartListItemKeyFromItem(item) ?? index;
    }
    const normalized = String(key).trim();
    return normalized.length > 0 ? normalized : smartListItemKeyFromItem(item) ?? index;
  }

  private fallbackResolvedTrackKey(index: number, item: T): string {
    return `smart-list-track:${this.trackItemInstanceToken(item, index)}`;
  }

  private pageTrackKey(index: number, item: T): string {
    const itemKey = smartListItemKeyFromItem(item);
    return this.normalizedConfiguredTrackKey(index, item)
      ?? (itemKey === null ? null : `${itemKey}`)
      ?? this.fallbackResolvedTrackKey(index, item);
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

  private applyPageSnapshot(snapshot: StepperSnapshot<Date, SmartListPage<T>, T>): void {
    if (!this.isPageMode()) {
      this.pages = [];
      this.items = [];
      this.total = 0;
      this.stickyLabel = this.resolveEmptyStickyLabel();
      return;
    }

    this.pages = [...snapshot.pages];
    this.items = [...snapshot.activeItems];
    this.total = snapshot.activeTotal;
    this.pageIndex = 0;
    this.hasMore = false;
    this.groups = [];
    this.stickyLabel = snapshot.stickyLabel || this.resolveEmptyStickyLabel();
    this.finiteStepper.syncBounds();
  }

  private seedPageProgress(): void {
    if (!this.isPageMode()) {
      this.progress = 0;
      this.scrollable = false;
      return;
    }
    if (this.pages.length === 0) {
      this.progress = 0;
      this.scrollable = false;
      return;
    }
    const surface = this.stepper.surfaceState(this.scrollHostRef?.nativeElement ?? null);
    this.scrollable = surface.scrollable;
    this.progress = surface.progress;
  }

  private clearPageViewCache(): void {
    this.stepper.reset();
    this.pages = [];
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
    const stickyHeader = this.ownedListElement<HTMLElement>(scrollElement, '.smart-list__sticky');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    this.stickyHeaderHeightPx = stickyHeaderHeight;
    const targetTop = scrollTop + stickyHeaderHeight;
    const boundaries = this.ownedListElements<HTMLElement>(
      scrollElement,
      '.smart-list__item-shell[data-group-label], .smart-list__group-marker[data-group-label]'
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

  private applyPageSurfaceState(
    stateOrScrollElement?: StepperSurfaceState | HTMLDivElement | null,
    scrollElement?: HTMLDivElement | null
  ): void {
    const hasSurfaceState = Boolean(
      stateOrScrollElement
      && 'progress' in stateOrScrollElement
      && 'pageIndex' in stateOrScrollElement
    );
    const target = hasSurfaceState
      ? scrollElement ?? this.scrollHostRef?.nativeElement ?? null
      : stateOrScrollElement as HTMLDivElement | null | undefined ?? this.scrollHostRef?.nativeElement ?? null;
    const surface = hasSurfaceState
      ? stateOrScrollElement as StepperSurfaceState
      : this.stepper.surfaceState(target);

    if (!target || this.pages.length === 0) {
      this.stickyHeaderHeightPx = 0;
      this.scrollable = false;
      this.progress = 0;
      this.stickyLabel = surface.label || this.pages[0]?.label || this.resolveEmptyStickyLabel();
      return;
    }

    this.stickyHeaderHeightPx = this.shouldShowStickyHeader()
      ? this.ownedListElement<HTMLElement>(target, '.smart-list__sticky')?.offsetHeight ?? 0
      : 0;
    this.scrollable = surface.scrollable;
    this.progress = surface.progress;
    this.stickyLabel = surface.label || this.pages[surface.pageIndex]?.label || this.pages[0]?.label || this.resolveEmptyStickyLabel();
  }

  private refreshSurfaceSoon(): void {
    const refresh = () => {
      if (this.isPageMode()) {
        this.applyPageSurfaceState();
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
    if (!this.isWeekMode() || !this.isRateCountPageVariant()) {
      this.weekRateViewportPageKey = null;
      return;
    }

    const scrollElement = this.scrollHostRef?.nativeElement;
    const pages = this.pages;
    if (!scrollElement || pages.length === 0) {
      return;
    }

    const pageIndex = this.stepper.currentPageIndex(scrollElement, pages.length);
    const visiblePageKey = pages[pageIndex]?.key ?? null;
    if (!visiblePageKey || this.weekRateViewportPageKey === visiblePageKey) {
      return;
    }

    const run = () => {
      const currentScrollElement = this.scrollHostRef?.nativeElement;
      if (!currentScrollElement || !this.isWeekMode() || !this.isRateCountPageVariant()) {
        return;
      }
      const pageElements = Array.from(
        currentScrollElement.querySelectorAll<HTMLElement>('.smart-list__page--week')
      );
      const currentPages = this.pages;
      const currentPageIndex = this.stepper.currentPageIndex(currentScrollElement, currentPages.length);
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
      this.applyPageSurfaceState(currentScrollElement);
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
    const itemElement = this.ownedListElement<HTMLElement>(
      scrollElement,
      `.smart-list__item-shell[data-smart-list-index="${itemIndex}"]`
    );
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
    const outlet = this.paginationMenuOutlet;
    return outlet?.isDocked() ? outlet.heightPx() : 0;
  }

  private listCardSnapTargets(scrollElement: HTMLDivElement): HTMLElement[] {
    if (this.isHorizontalList()) {
      return this.ownedListElements<HTMLElement>(scrollElement, '.smart-list__item-shell[data-smart-list-index]');
    }
    return this.ownedListElements<HTMLElement>(scrollElement, SmartListComponent.LIST_CARD_SNAP_TARGET_SELECTOR);
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
      ? this.ownedListElement<HTMLElement>(scrollElement, '.smart-list__sticky')?.offsetHeight ?? 0
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
      if (this.isPageMode()) {
        const initialIndex = this.stepper.initialPageIndex();
        this.stepper.clearInitialPageIndexOverride();
        const targetLeft = this.stepper.pageOffsetLeft(scrollElement, initialIndex);
        if (targetLeft >= 0) {
          this.stepper.suppressSettle = true;
          const previousScrollBehavior = scrollElement.style.scrollBehavior;
          const previousSnapType = scrollElement.style.scrollSnapType;
          scrollElement.style.scrollBehavior = 'auto';
          scrollElement.style.scrollSnapType = 'none';
          scrollElement.scrollLeft = targetLeft;
          scrollElement.style.scrollBehavior = previousScrollBehavior;
          const release = () => {
            scrollElement.style.scrollSnapType = previousSnapType;
            this.stepper.suppressSettle = false;
            this.applyPageSurfaceState(scrollElement);
            this.emitState();
            this.cdr.markForCheck();
          };
          if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => release());
          } else {
            setTimeout(release, 0);
          }
        } else {
          this.applyPageSurfaceState(scrollElement);
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
        const cursor = this.finiteStepper.state();
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
    const loadingVisible = this.isVisiblePageLoading();
    const cursor = this.finiteStepper.state();
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
      loadingProgress: loadingVisible ? Math.max(this.loadingProgress, this.stepper.pendingVisualKey ? 0.02 : 0) : 0,
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
    if (visibleIndex === null || visibleIndex === this.finiteStepper.state().index) {
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
    if (visibleIndex === null || visibleIndex === this.finiteStepper.state().index) {
      return;
    }
    this.finiteStepper.setIndex(visibleIndex, { notify: false });
    this.cdr.markForCheck();
  }

  private firstVisibleHorizontalListItemIndex(scrollElement: HTMLDivElement): number | null {
    const listRect = scrollElement.getBoundingClientRect();
    const visibleLeft = listRect.left + 1;
    const itemElements = this.ownedListElements<HTMLElement>(scrollElement, '[data-smart-list-index]');
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
      const itemElement = this.ownedListElement<HTMLElement>(
        scrollElement,
        `.smart-list__item-shell[data-smart-list-index="${index}"]`
      );
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
    this.scrollHorizontalListItemIntoView(this.finiteStepper.state().index, 'auto');
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
      if (finalIndex === null || finalIndex === this.finiteStepper.index) {
        return;
      }
      this.finiteStepper.setIndex(finalIndex, { notify: false });
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
    const itemElements = this.ownedListElements<HTMLElement>(scrollElement, '[data-smart-list-index]');
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
    const canMoveToNextItem = this.finiteStepper.canMove(1);
    const canMoveToEmptyState = !canMoveToNextItem
      && this.shouldUseHostedFullscreenPagination()
      && this.finiteStepper.canMoveToEmptyCursor();
    if (!canMoveToNextItem && !canMoveToEmptyState) {
      return;
    }
    if (this.ratingAdvanceInFlight) {
      return;
    }
    this.ratingAdvanceInFlight = true;
    try {
      await this.wait(120);
      if (!this.shouldUseHostedFullscreenPagination() || this.finiteStepper.animating) {
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
    if (!this.shouldUseHostedFullscreenPagination() || this.finiteStepper.animating) {
      return false;
    }
    const normalizedDelta = Math.trunc(delta);
    const allowEmptyTarget = options.allowEmptyTarget === true
      && normalizedDelta > 0
      && this.shouldUseHostedFullscreenPagination()
      && this.finiteStepper.canMoveToEmptyCursor();
    if (!this.finiteStepper.canMove(normalizedDelta) && !allowEmptyTarget) {
      return false;
    }
    const currentIndex = this.finiteStepper.state().index;
    const targetIndex = currentIndex + normalizedDelta;
    const targetIsEmptyState = allowEmptyTarget && targetIndex === this.finiteStepper.cursorTotal();
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
    this.finiteStepper.setEmptyCursor(targetIsEmptyState, { notify: false });
    this.finiteStepper.setIndex(targetIndex, { notify: false });
    this.finiteStepper.syncBounds();
    this.emitState();
    this.cdr.markForCheck();
    this.hostedFullscreenPendingDelta = normalizedDelta;
    this.hostedFullscreenCompletingTransition = false;
    this.finiteStepper.beginTransition(currentItem);
    if (this.currentViewMode === 'list' && this.resolvedPresentation() === 'fullscreen' && this.hasMore && !this.loading) {
      const remaining = this.items.length - (this.finiteStepper.index + 1);
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

  private isVisiblePageLoading(): boolean {
    if (!this.isPageMode()) {
      return this.loading || this.loadingProgress > 0;
    }
    if (this.stepper.pendingVisualKey) {
      return true;
    }
    if (this.initialLoading) {
      return this.loading || this.loadingProgress > 0;
    }
    if (!this.stepper.pendingPageKey) {
      return false;
    }
    const visibleAnchor = this.stepper.currentAnchor() ?? this.currentPageAnchor();
    if (!visibleAnchor) {
      return false;
    }
    return this.stepper.pageKey(visibleAnchor) === this.stepper.pendingPageKey && (this.loading || this.loadingProgress > 0);
  }

  private currentQuery(page = this.pageIndex): ListQuery<TFilters> {
    const query = this.currentBaseQuery(page);
    if (!this.isPageMode()) {
      return query;
    }
    const anchor = this.stepper.currentAnchor() ?? this.currentPageAnchor();
    return anchor ? this.stepper.queryForAnchor(anchor, this.currentBaseQuery(0)) : query;
  }

  private currentBaseQuery(page = this.pageIndex): ListQuery<TFilters> {
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
    return query;
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

  private resolvedPollIntervalMs(): number {
    return Math.max(0, Math.trunc(Number(this.resolveConfigValue(this.config.pollIntervalMs, null)) || 0));
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
    const baseIndex = this.finiteStepper.state().index;
    if (!this.finiteStepper.animating || this.hostedFullscreenPendingDelta === 0) {
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
    if (!this.finiteStepper.animating) {
      return;
    }
    this.clearHostedFullscreenTransitionTimer();
    this.hostedFullscreenPendingDelta = 0;
    this.hostedFullscreenCompletingTransition = false;
    this.finiteStepper.finishTransition();
  }

  private resetHostedFullscreenTransition(): void {
    this.interruptHostedFullscreenTransition();
    this.finiteStepper.reset();
  }

  private async completeHostedFullscreenPaginationTransition(): Promise<void> {
    if (!this.finiteStepper.animating || this.hostedFullscreenPendingDelta === 0 || this.hostedFullscreenCompletingTransition) {
      return;
    }
    this.hostedFullscreenPendingDelta = 0;
    this.hostedFullscreenCompletingTransition = true;
    this.clearHostedFullscreenTransitionTimer();
    this.hostedFullscreenCompletingTransition = false;
    this.finiteStepper.finishTransition();
  }

  private currentPageAnchor(): Date | null {
    if (this.isPageMode()) {
      this.stepper.ensureWindow();
    }
    return this.stepper.focusAnchor;
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

  private async loadAnchorPage(
    anchor: Date,
    query: ListQuery<TFilters>,
    isInitial = false,
    options: StepperLoadOptions = {}
  ): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isPageMode()) {
      this.loading = false;
      this.initialLoading = false;
      this.hasMore = false;
      this.emitState();
      this.cdr.markForCheck();
      return;
    }

    const pageKey = this.stepper.pageKey(anchor);
    if (options.force === true && this.stepper.preloadingPageKey) {
      this.cancelPendingAnchorPreload();
    }
    if (this.stepper.hasPageData(pageKey) && options.force !== true) {
      if (isInitial) {
        this.initialLoading = false;
        this.items = [...this.stepper.itemsForAnchor(anchor)];
        this.total = this.stepper.totalForAnchor(anchor, this.items.length);
        this.emitState();
        this.cdr.markForCheck();
      }
      return;
    }
    if (this.stepper.pendingPageKey) {
      if (this.stepper.pendingPageKey !== pageKey && options.replacePending === true) {
        this.cancelPendingAnchorPageLoad();
      } else {
        return;
      }
    }
    if (this.stepper.pendingPageKey) {
      return;
    }

    const sequence = ++this.loadSequence;
    const abortController = typeof AbortController === 'undefined' ? null : new AbortController();
    this.stepperPageLoadAbortController = abortController;
    this.stepper.beginPendingPage(this.stepper.normalizeAnchor(anchor), this.progress);
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

      this.applyAnchorPageResult(anchor, result, {
        deferRender: !isInitial && this.stepper.scrollInProgress
      });
    } catch (error) {
      if (sequence !== this.loadSequence) {
        return;
      }
      if (this.isAbortError(error)) {
        return;
      }
      this.stepper.setEmptyPage(anchor, {
        deferRender: !isInitial && this.stepper.scrollInProgress
      });
      if (!isInitial && this.stepper.scrollInProgress) {
        this.initialLoading = false;
        return;
      }
      this.items = [];
      this.total = 0;
      this.initialLoading = false;
      this.hasMore = false;
      this.stepper.applySnapshot();
    } finally {
      if (sequence !== this.loadSequence) {
        return;
      }
      if (this.stepperPageLoadAbortController === abortController) {
        this.stepperPageLoadAbortController = null;
      }
      this.stepper.clearPendingPage();
      this.loading = false;
      this.endLoadingAnimation();
      if (!this.stepper.renderDeferred) {
        this.refreshSurfaceSoon();
      }
      this.emitState();
      this.cdr.markForCheck();
      if (!this.stepper.scrollInProgress) {
        this.stepper.maybeLoadCurrentPage();
      }
    }
  }

  private cancelPendingAnchorPageLoad(): void {
    if (!this.stepper.pendingPageKey) {
      return;
    }
    this.loadSequence += 1;
    this.stepperPageLoadAbortController?.abort();
    this.stepperPageLoadAbortController = null;
    this.stepper.clearPendingPage({ clearProgrammaticTarget: true });
    this.loading = false;
    this.clearLoadingAnimation();
    this.emitState();
    this.cdr.markForCheck();
  }

  public patchVisibleItem(
    predicate: (item: T, index: number) => boolean,
    patch: Partial<T> | ((item: T, index: number) => T)
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
    const nextItem = typeof patch === 'function'
      ? patch(currentItem, index)
      : {
        ...(currentItem as object),
        ...(patch as object)
      } as T;
    if (nextItem === currentItem) {
      return false;
    }
    const nextItems = [...this.items];
    nextItems[index] = nextItem;
    this.items = this.orderSortableItems(nextItems);
    this.syncGroups();
    this.finiteStepper.syncBounds();
    this.emitState();
    this.cdr.markForCheck();
    return true;
  }

  public patchConvertedVisibleItem<TSource>(
    source: TSource,
    options: {
      predicate?: (item: T, index: number) => boolean;
    } = {}
  ): boolean {
    const query = this.currentQuery();
    const converter = this.resolvedConverter<TSource>(query);
    if (!converter) {
      return false;
    }
    const nextItem = converter.convert(source, this.converterOptions(query));
    const normalizedIdentity = `${smartListItemKeyFromItem(nextItem) ?? ''}`.trim();
    const predicate = options.predicate
      ?? (normalizedIdentity
        ? (item: T, index: number) => `${this.cacheTrackKey(item, index)}`.trim() === normalizedIdentity
        : null);
    if (!predicate) {
      return false;
    }
    return this.patchVisibleItem(predicate, () => nextItem);
  }

  public upsertConvertedVisibleItem<TSource>(
    source: TSource,
    options: {
      predicate?: (item: T, index: number) => boolean;
      totalDelta?: number;
    } = {}
  ): boolean {
    const query = this.currentQuery();
    const converter = this.resolvedConverter<TSource>(query);
    if (!converter) {
      return false;
    }
    const nextItem = converter.convert(source, this.converterOptions(query));
    const normalizedIdentity = `${smartListItemKeyFromItem(nextItem) ?? ''}`.trim();
    const predicate = options.predicate
      ?? (normalizedIdentity
        ? (item: T, index: number) => `${this.cacheTrackKey(item, index)}`.trim() === normalizedIdentity
        : null);
    if (predicate && this.patchVisibleItem(predicate, () => nextItem)) {
      return true;
    }
    return this.reinsertVisibleItem(nextItem, { totalDelta: options.totalDelta });
  }

  public removeVisibleItems(
    predicate: (item: T, index: number) => boolean,
    options: { totalDelta?: number } = {}
  ): boolean {
    if (this.currentViewMode !== 'list') {
      return false;
    }
    const nextItems = this.items.filter((item, index) => !predicate(item, index));
    if (nextItems.length === this.items.length) {
      return false;
    }
    this.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, this.total + (options.totalDelta ?? -1))
    });
    return true;
  }

  public removeVisibleItemByIdentity(
    identity: string | number,
    options: { totalDelta?: number } = {}
  ): boolean {
    const normalizedIdentity = `${identity}`.trim();
    return this.removeVisibleItems(
      (item, index) => `${this.cacheTrackKey(item, index)}`.trim() === normalizedIdentity,
      options
    );
  }

  public reinsertVisibleItem(item: T, options: { totalDelta?: number } = {}): boolean {
    if (this.currentViewMode !== 'list') {
      return false;
    }
    const identity = `${this.cacheTrackKey(item, this.items.length)}`.trim();
    if (this.items.some((currentItem, index) => `${this.cacheTrackKey(currentItem, index)}`.trim() === identity)) {
      return false;
    }
    this.replaceVisibleItems([...this.items, item], {
      total: Math.max(this.items.length + 1, this.total + (options.totalDelta ?? 1))
    });
    return true;
  }

  private cancelPendingAnchorPreload(): void {
    this.stepperPreloadAbortController?.abort();
    this.stepperPreloadAbortController = null;
    this.stepper.clearPreloadingPage();
  }

  private async preloadAnchorPage(anchor: Date, query: ListQuery<TFilters>): Promise<void> {
    const loader = this.resolveLoadPage();
    if (!loader || !this.isPageMode()) {
      return;
    }
    const pageKey = this.stepper.pageKey(anchor);
    if (this.stepper.hasPageData(pageKey) || this.stepper.pendingPageKey === pageKey) {
      return;
    }
    if (this.stepper.preloadingPageKey === pageKey) {
      return;
    }
    if (this.stepper.preloadingPageKey) {
      this.stepperPreloadAbortController?.abort();
      this.stepperPreloadAbortController = null;
      this.stepper.clearPreloadingPage();
    }

    const abortController = typeof AbortController === 'undefined' ? null : new AbortController();
    this.stepperPreloadAbortController = abortController;
    this.stepper.beginPreloadingPage(anchor);

    try {
      const result = await firstValueFrom(
        loader(query, { signal: abortController?.signal })
      );
      if (this.stepper.preloadingPageKey !== pageKey || abortController?.signal.aborted) {
        return;
      }
      this.applyAnchorPageResult(anchor, result, { deferRender: true });
    } catch (error) {
      if (this.stepper.preloadingPageKey !== pageKey || abortController?.signal.aborted) {
        return;
      }
      if (!this.isAbortError(error)) {
        this.stepper.setEmptyPage(anchor, { deferRender: true });
      }
    } finally {
      if (this.stepper.preloadingPageKey === pageKey) {
        this.stepperPreloadAbortController = null;
        this.stepper.clearPreloadingPage(pageKey);
      }
      if (!this.stepper.scrollInProgress && this.stepper.renderDeferred) {
        this.flushDeferredPageRender();
        this.emitState();
        this.cdr.markForCheck();
      }
    }
  }

  private flushDeferredPageRender(scrollElement?: HTMLDivElement | null): void {
    if (!this.stepper.renderDeferred) {
      return;
    }
    this.stepper.applySnapshot({ flushDeferred: true });
    this.applyPageSurfaceState(scrollElement);
  }

}
