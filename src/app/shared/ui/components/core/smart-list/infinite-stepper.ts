export interface InfiniteStepperLoadOptions {
  replacePending?: boolean;
  force?: boolean;
}

export interface InfiniteStepperRecenterOptions {
  loadAfterRecenter?: boolean;
}

export interface InfiniteStepperPageBuildContext<TAnchor, TItem, TQuery, TViewConfig> {
  anchor: TAnchor;
  items: readonly TItem[];
  query: TQuery;
  viewConfig: TViewConfig;
  trackByKey: (item: TItem) => string;
}

export interface InfiniteStepperPageAdapter<TAnchor, TPage, TItem, TQuery, TViewConfig> {
  anchorRadius: (viewConfig: TViewConfig | null) => number;
  initialAnchor: (viewConfig: TViewConfig | null, query: TQuery) => TAnchor | null;
  initialAnchorKey: (viewConfig: TViewConfig | null, query: TQuery) => string;
  normalizeAnchor: (anchor: TAnchor, viewConfig: TViewConfig | null, query: TQuery) => TAnchor;
  keyForAnchor: (anchor: TAnchor, viewConfig: TViewConfig | null, query: TQuery) => string;
  shiftAnchor: (anchor: TAnchor, direction: -1 | 1, viewConfig: TViewConfig | null, query: TQuery) => TAnchor;
  queryForAnchor: (query: TQuery, anchor: TAnchor, viewConfig: TViewConfig | null) => TQuery;
  buildPage: (context: InfiniteStepperPageBuildContext<TAnchor, TItem, TQuery, TViewConfig>) => TPage;
  anchorForPage: (page: TPage) => TAnchor;
  labelForPage: (page: TPage) => string;
}

export interface InfiniteStepperSnapshot<TAnchor, TPage, TItem> {
  pages: readonly TPage[];
  activeAnchor: TAnchor | null;
  activeItems: readonly TItem[];
  activeTotal: number;
  stickyLabel: string;
}

export interface InfiniteStepperCallbacks<TAnchor, TPage, TItem, TQuery, TViewConfig> {
  isActive: () => boolean;
  isTouchingSurface: () => boolean;
  scrollElement: () => HTMLDivElement | null;
  pageAdapter: () => InfiniteStepperPageAdapter<TAnchor, TPage, TItem, TQuery, TViewConfig> | null;
  viewConfig: () => TViewConfig | null;
  baseQuery: () => TQuery;
  fallbackAnchor: () => TAnchor;
  trackByKey: (item: TItem) => string;
  cancelPendingPageLoad: () => void;
  cancelPendingPreload: () => void;
  loadPage: (anchor: TAnchor, query: TQuery, options: InfiniteStepperLoadOptions) => void;
  preloadPage: (anchor: TAnchor, query: TQuery) => void;
  currentProgress: () => number;
  applySnapshot: (snapshot: InfiniteStepperSnapshot<TAnchor, TPage, TItem>) => void;
  applySurfaceState: (
    state: InfiniteStepperSurfaceState,
    scrollElement?: HTMLDivElement | null
  ) => void;
  afterSnapshotApplied?: () => void;
  detectChanges: () => void;
  emitState: () => void;
  markForCheck: () => void;
}

export interface InfiniteStepperConfig {
  pageSelector: string;
  scrollEndDebounceMs?: number;
  scrollStableDelayMs?: number;
  scrollSettleTolerancePx?: number;
  directionCommitMinPx?: number;
  directionCommitRatio?: number;
}

export interface InfiniteStepperSurfaceState {
  scrollable: boolean;
  progress: number;
  pageIndex: number;
  label: string;
}

export class InfiniteStepper<TAnchor, TPage, TItem, TQuery, TViewConfig> {
  private static readonly DEFAULT_SCROLL_END_DEBOUNCE_MS = 96;
  private static readonly DEFAULT_SCROLL_STABLE_DELAY_MS = 64;
  private static readonly DEFAULT_SCROLL_SETTLE_TOLERANCE_PX = 1;
  private static readonly DEFAULT_DIRECTION_COMMIT_MIN_PX = 32;
  private static readonly DEFAULT_DIRECTION_COMMIT_RATIO = 0.12;

  private readonly pageItems = new Map<string, TItem[]>();
  private readonly pageTotals = new Map<string, number>();
  private readonly deferredPageKeys = new Set<string>();
  private pagesValue: TPage[] = [];
  private edgeSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private postSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private windowAnchorsValue: TAnchor[] = [];
  private focusAnchorValue: TAnchor | null = null;
  private initialPageIndexOverrideValue: number | null = null;
  private pendingPageKeyValue: string | null = null;
  private pendingPageAnchorValue: TAnchor | null = null;
  private preloadingPageKeyValue: string | null = null;
  private pendingVisualKeyValue: string | null = null;
  private frozenProgressValue: number | null = null;
  private programmaticTargetKeyValue: string | null = null;
  private lastSettledPageKey: string | null = null;
  private scrollStartLeft: number | null = null;
  private scrollDirection: -1 | 1 | null = null;
  private preparedAheadPageKey: string | null = null;
  private scrollInProgressValue = false;
  private renderDeferredValue = false;
  private suppressSettleValue = false;

  constructor(
    private readonly config: InfiniteStepperConfig,
    private readonly callbacks: InfiniteStepperCallbacks<TAnchor, TPage, TItem, TQuery, TViewConfig>
  ) {}

  public get scrollInProgress(): boolean {
    return this.scrollInProgressValue;
  }

  public set scrollInProgress(value: boolean) {
    this.scrollInProgressValue = value;
  }

  public get renderDeferred(): boolean {
    return this.renderDeferredValue;
  }

  public get suppressSettle(): boolean {
    return this.suppressSettleValue;
  }

  public set suppressSettle(value: boolean) {
    this.suppressSettleValue = value;
    if (value) {
      this.clearSettleTimers();
    }
  }

  public get pendingPageKey(): string | null {
    return this.pendingPageKeyValue;
  }

  public get pendingPageAnchor(): TAnchor | null {
    return this.pendingPageAnchorValue;
  }

  public get preloadingPageKey(): string | null {
    return this.preloadingPageKeyValue;
  }

  public get pendingVisualKey(): string | null {
    return this.pendingVisualKeyValue;
  }

  public get frozenProgress(): number | null {
    return this.frozenProgressValue;
  }

  public get programmaticTargetKey(): string | null {
    return this.programmaticTargetKeyValue;
  }

  public get focusAnchor(): TAnchor | null {
    return this.focusAnchorValue;
  }

  public anchorWindow(): readonly TAnchor[] {
    return this.windowAnchorsValue;
  }

  public pages(): readonly TPage[] {
    return this.pagesValue;
  }

  public pageKey(anchor: TAnchor): string {
    const adapter = this.callbacks.pageAdapter();
    const normalizedAnchor = this.normalizeAnchor(anchor);
    return adapter
      ? adapter.keyForAnchor(normalizedAnchor, this.callbacks.viewConfig(), this.callbacks.baseQuery())
      : String(normalizedAnchor);
  }

  public normalizeAnchor(anchor: TAnchor): TAnchor {
    return this.callbacks.pageAdapter()?.normalizeAnchor(
      anchor,
      this.callbacks.viewConfig(),
      this.callbacks.baseQuery()
    ) ?? anchor;
  }

  public shiftAnchor(anchor: TAnchor, direction: -1 | 1): TAnchor {
    return this.callbacks.pageAdapter()?.shiftAnchor(
      anchor,
      direction,
      this.callbacks.viewConfig(),
      this.callbacks.baseQuery()
    ) ?? anchor;
  }

  public pageKeyForPage(page: TPage): string {
    return this.pageKey(this.anchorForPage(page));
  }

  public anchorForPage(page: TPage): TAnchor {
    const adapter = this.callbacks.pageAdapter();
    if (!adapter) {
      return this.callbacks.fallbackAnchor();
    }
    return this.normalizeAnchor(adapter.anchorForPage(page));
  }

  public hasPageData(pageKey: string): boolean {
    return this.pageItems.has(pageKey);
  }

  public itemsForAnchor(anchor: TAnchor): TItem[] {
    const pageKey = this.pageKey(anchor);
    if (this.deferredPageKeys.has(pageKey)) {
      return [];
    }
    return this.pageItems.get(pageKey) ?? [];
  }

  public totalForAnchor(anchor: TAnchor, fallback: number): number {
    return this.pageTotals.get(this.pageKey(anchor)) ?? fallback;
  }

  public setPageResult(
    anchor: TAnchor,
    items: ReadonlyArray<TItem>,
    total: number,
    options: { deferRender?: boolean } = {}
  ): void {
    const pageKey = this.pageKey(anchor);
    const safeTotal = Math.max(items.length, Math.max(0, Math.trunc(total)));
    this.pageItems.set(pageKey, [...items]);
    this.pageTotals.set(pageKey, safeTotal);
    if (options.deferRender === true) {
      this.deferredPageKeys.add(pageKey);
      this.renderDeferredValue = true;
      return;
    }
    this.deferredPageKeys.delete(pageKey);
    this.renderDeferredValue = this.deferredPageKeys.size > 0;
  }

  public setEmptyPage(anchor: TAnchor, options: { deferRender?: boolean } = {}): void {
    this.setPageResult(anchor, [], 0, options);
  }

  public flushDeferredPages(): void {
    this.deferredPageKeys.clear();
    this.renderDeferredValue = false;
  }

  public setWindowFocus(anchor: TAnchor, options: { useInitialPageIndex?: boolean } = {}): void {
    const normalizedAnchor = this.normalizeAnchor(anchor);
    this.focusAnchorValue = normalizedAnchor;
    this.windowAnchorsValue = this.buildAnchorWindow(normalizedAnchor);
    if (options.useInitialPageIndex === true) {
      this.initialPageIndexOverrideValue = this.desiredPageIndex(this.windowAnchorsValue.length);
    }
  }

  public initialAnchor(): TAnchor {
    return this.callbacks.pageAdapter()?.initialAnchor(this.callbacks.viewConfig(), this.callbacks.baseQuery())
      ?? this.callbacks.fallbackAnchor();
  }

  public initialAnchorKey(): string {
    return this.callbacks.pageAdapter()?.initialAnchorKey(this.callbacks.viewConfig(), this.callbacks.baseQuery()) ?? '';
  }

  public ensureWindow(): void {
    if (this.windowAnchorsValue.length > 0) {
      return;
    }
    this.setWindowFocus(this.initialAnchor(), { useInitialPageIndex: true });
  }

  public clearWindow(): void {
    this.windowAnchorsValue = [];
    this.focusAnchorValue = null;
    this.initialPageIndexOverrideValue = null;
    this.pagesValue = [];
  }

  public desiredPageIndex(totalPages = this.windowAnchorsValue.length): number {
    if (totalPages <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(totalPages - 1, this.normalizedAnchorRadius()));
  }

  public initialPageIndex(totalPages = this.pagesValue.length): number {
    if (totalPages <= 1) {
      return 0;
    }
    if (this.initialPageIndexOverrideValue !== null) {
      return clampIndex(this.initialPageIndexOverrideValue, totalPages);
    }
    if (this.focusAnchorValue) {
      const focusKey = this.pageKey(this.focusAnchorValue);
      const pages = this.pagesValue;
      const pageIndex = pages.findIndex(page => this.pageKeyForPage(page) === focusKey);
      if (pageIndex >= 0) {
        return pageIndex;
      }
    }
    return this.desiredPageIndex(totalPages);
  }

  public clearInitialPageIndexOverride(): void {
    this.initialPageIndexOverrideValue = null;
  }

  public queryForAnchor(anchor: TAnchor, baseQuery: TQuery = this.callbacks.baseQuery()): TQuery {
    const viewConfig = this.callbacks.viewConfig();
    return this.callbacks.pageAdapter()?.queryForAnchor(baseQuery, this.normalizeAnchor(anchor), viewConfig) ?? baseQuery;
  }

  public applySnapshot(options: { flushDeferred?: boolean } = {}): InfiniteStepperSnapshot<TAnchor, TPage, TItem> {
    const snapshot = this.snapshot(options);
    this.callbacks.applySnapshot(snapshot);
    this.callbacks.afterSnapshotApplied?.();
    return snapshot;
  }

  public snapshot(options: { flushDeferred?: boolean } = {}): InfiniteStepperSnapshot<TAnchor, TPage, TItem> {
    if (options.flushDeferred === true) {
      this.flushDeferredPages();
    }
    const adapter = this.callbacks.pageAdapter();
    const viewConfig = this.callbacks.viewConfig();
    if (!this.callbacks.isActive() || !adapter || !viewConfig) {
      this.pagesValue = [];
      return this.emptySnapshot();
    }

    this.ensureWindow();
    if (this.windowAnchorsValue.length === 0) {
      this.pagesValue = [];
      return this.emptySnapshot();
    }

    const baseQuery = this.callbacks.baseQuery();
    this.pagesValue = this.windowAnchorsValue.map(anchor => {
      const normalizedAnchor = this.normalizeAnchor(anchor);
      return adapter.buildPage({
        anchor: normalizedAnchor,
        items: this.itemsForAnchor(normalizedAnchor),
        query: adapter.queryForAnchor(baseQuery, normalizedAnchor, viewConfig),
        viewConfig,
        trackByKey: this.callbacks.trackByKey
      });
    });

    const scrollElement = this.callbacks.scrollElement();
    const activeAnchor = (scrollElement ? this.currentAnchor(scrollElement) : null)
      ?? this.focusAnchorValue
      ?? this.windowAnchorsValue[this.desiredPageIndex(this.windowAnchorsValue.length)]
      ?? this.windowAnchorsValue[0]
      ?? null;
    const activeItems = activeAnchor ? [...this.itemsForAnchor(activeAnchor)] : [];
    const activeTotal = activeAnchor ? this.totalForAnchor(activeAnchor, activeItems.length) : 0;
    const activePageKey = activeAnchor ? this.pageKey(activeAnchor) : null;
    const stickyPage = this.pagesValue.find(page => this.pageKeyForPage(page) === activePageKey)
      ?? this.pagesValue[this.initialPageIndex(this.pagesValue.length)]
      ?? null;
    const stickyLabel = stickyPage ? adapter.labelForPage(stickyPage) : '';

    return {
      pages: this.pagesValue,
      activeAnchor,
      activeItems,
      activeTotal,
      stickyLabel
    };
  }

  public applySurfaceState(scrollElement: HTMLDivElement | null = this.callbacks.scrollElement()): void {
    this.callbacks.applySurfaceState(this.surfaceState(scrollElement), scrollElement);
  }

  public shiftWindow(direction: -1 | 1): void {
    if (this.windowAnchorsValue.length === 0) {
      return;
    }
    if (direction < 0) {
      const first = this.windowAnchorsValue[0];
      const nextAnchor = this.normalizeAnchor(this.shiftAnchor(first, -1));
      this.windowAnchorsValue = [nextAnchor, ...this.windowAnchorsValue.slice(0, -1)];
      return;
    }
    const last = this.windowAnchorsValue[this.windowAnchorsValue.length - 1];
    const nextAnchor = this.normalizeAnchor(this.shiftAnchor(last, 1));
    this.windowAnchorsValue = [...this.windowAnchorsValue.slice(1), nextAnchor];
  }

  public navigateBy(delta: number, behavior: ScrollBehavior = 'smooth'): void {
    if (!this.callbacks.isActive()) {
      return;
    }
    this.callbacks.cancelPendingPageLoad();
    const scrollElement = this.callbacks.scrollElement();
    const pages = this.pagesValue;
    if (!scrollElement || pages.length === 0) {
      this.navigateFocusBy(delta);
      return;
    }
    const step = delta < 0 ? -1 : 1;
    const currentIndex = this.currentPageIndex(scrollElement, pages.length);
    const targetIndex = currentIndex + step;
    if (targetIndex >= 0 && targetIndex < pages.length) {
      this.scrollToPage(targetIndex, behavior);
      return;
    }
    const holdIndex = step < 0 ? 1 : Math.max(0, pages.length - 2);
    this.suppressSettle = true;
    this.shiftWindow(step);
    this.applySnapshot();
    this.callbacks.emitState();
    this.callbacks.markForCheck();
    setTimeout(() => {
      const nextElement = this.callbacks.scrollElement();
      if (!nextElement) {
        this.suppressSettle = false;
        return;
      }
      const holdLeft = this.pageOffsetLeft(nextElement, holdIndex);
      if (holdLeft < 0) {
        this.suppressSettle = false;
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
        this.suppressSettle = false;
        this.applySurfaceState(nextElement);
        this.callbacks.emitState();
        this.callbacks.markForCheck();
        this.scrollToPage(holdIndex + step, behavior);
      };
      this.releaseAfterSettle(slide);
    }, 0);
  }

  public currentAnchor(scrollElement: HTMLDivElement | null = this.callbacks.scrollElement()): TAnchor | null {
    const page = this.currentPage(scrollElement);
    if (page) {
      return this.anchorForPage(page);
    }
    return this.focusAnchorValue;
  }

  private navigateFocusBy(delta: number): void {
    const direction: -1 | 1 = delta < 0 ? -1 : 1;
    let nextAnchor = this.currentAnchor() ?? this.focusAnchorValue ?? this.initialAnchor();
    for (let index = 0; index < Math.max(1, Math.abs(delta)); index += 1) {
      nextAnchor = this.shiftAnchor(nextAnchor, direction);
    }
    this.setWindowFocus(nextAnchor, { useInitialPageIndex: true });
    this.applySnapshot();
    this.callbacks.emitState();
    this.callbacks.markForCheck();
  }

  public beginPendingPage(anchor: TAnchor, currentProgress: number): string {
    const normalizedAnchor = this.normalizeAnchor(anchor);
    const pageKey = this.pageKey(normalizedAnchor);
    this.pendingPageKeyValue = pageKey;
    this.pendingPageAnchorValue = normalizedAnchor;
    this.showPendingVisual(normalizedAnchor, currentProgress);
    return pageKey;
  }

  public showPendingVisual(anchor: TAnchor, currentProgress: number): string {
    const pageKey = this.pageKey(anchor);
    if (this.pendingVisualKeyValue !== pageKey) {
      this.frozenProgressValue = currentProgress;
    }
    this.pendingVisualKeyValue = pageKey;
    return pageKey;
  }

  public clearPendingVisual(): void {
    this.pendingVisualKeyValue = null;
    this.frozenProgressValue = null;
  }

  public clearPendingPage(options: { clearProgrammaticTarget?: boolean } = {}): void {
    this.pendingPageKeyValue = null;
    this.pendingPageAnchorValue = null;
    this.clearPendingVisual();
    if (options.clearProgrammaticTarget === true) {
      this.programmaticTargetKeyValue = null;
    }
  }

  public beginPreloadingPage(anchor: TAnchor): string {
    const pageKey = this.pageKey(anchor);
    this.preloadingPageKeyValue = pageKey;
    return pageKey;
  }

  public clearPreloadingPage(pageKey?: string): void {
    if (pageKey && this.preloadingPageKeyValue !== pageKey) {
      return;
    }
    this.preloadingPageKeyValue = null;
  }

  public setLastSettledPageKey(key: string | null): void {
    this.lastSettledPageKey = key;
  }

  public clearProgrammaticTarget(): void {
    this.programmaticTargetKeyValue = null;
  }

  public clearPageCache(): void {
    this.pageItems.clear();
    this.pageTotals.clear();
    this.deferredPageKeys.clear();
    this.renderDeferredValue = false;
    this.pendingPageKeyValue = null;
    this.pendingPageAnchorValue = null;
    this.preloadingPageKeyValue = null;
    this.pendingVisualKeyValue = null;
    this.frozenProgressValue = null;
    this.programmaticTargetKeyValue = null;
    this.lastSettledPageKey = null;
    this.pagesValue = [];
    this.resetScrollTracking();
  }

  public reset(): void {
    this.clearSettleTimers();
    this.suppressSettleValue = false;
    this.callbacks.cancelPendingPageLoad();
    this.callbacks.cancelPendingPreload();
    this.clearPageCache();
  }

  public resetScrollTracking(): void {
    this.scrollStartLeft = null;
    this.scrollDirection = null;
    this.preparedAheadPageKey = null;
    this.scrollInProgressValue = false;
  }

  private emptySnapshot(): InfiniteStepperSnapshot<TAnchor, TPage, TItem> {
    return {
      pages: [],
      activeAnchor: null,
      activeItems: [],
      activeTotal: 0,
      stickyLabel: ''
    };
  }

  public clearSettleTimers(): void {
    if (this.edgeSettleTimer) {
      clearTimeout(this.edgeSettleTimer);
      this.edgeSettleTimer = null;
    }
    if (this.postSettleTimer) {
      clearTimeout(this.postSettleTimer);
      this.postSettleTimer = null;
    }
  }

  private flushDeferredSnapshot(scrollElement?: HTMLDivElement | null): void {
    if (!this.renderDeferredValue) {
      return;
    }
    this.applySnapshot({ flushDeferred: true });
    this.applySurfaceState(scrollElement ?? this.callbacks.scrollElement());
  }

  public onScroll(scrollElement: HTMLDivElement): void {
    if (!this.scrollInProgressValue) {
      this.scrollStartLeft = this.currentPageOffsetLeft(scrollElement);
      this.preparedAheadPageKey = null;
    }
    this.scrollInProgressValue = true;
    this.preparePageAheadForScroll(scrollElement);
    this.applySurfaceState(scrollElement);
    this.callbacks.emitState();

    const visiblePage = this.currentPage(scrollElement);
    const visiblePageKey = visiblePage ? this.pageKeyForPage(visiblePage) : null;
    if (
      visiblePageKey
      && this.pendingPageKeyValue
      && this.pendingPageKeyValue !== visiblePageKey
      && (!this.programmaticTargetKeyValue || this.programmaticTargetKeyValue === visiblePageKey)
    ) {
      this.callbacks.cancelPendingPageLoad();
    }
    if (this.callbacks.isTouchingSurface()) {
      return;
    }
    if (this.programmaticTargetKeyValue && visiblePageKey !== this.programmaticTargetKeyValue) {
      this.scheduleScrollEnd(scrollElement);
      return;
    }
    if (visiblePageKey === this.programmaticTargetKeyValue) {
      this.programmaticTargetKeyValue = null;
    }
    this.scheduleScrollEnd(scrollElement);
  }

  public onScrollEnd(scrollElement: HTMLDivElement): void {
    this.handleScrollEnd(scrollElement);
  }

  public scheduleScrollEnd(scrollElement: HTMLDivElement): void {
    if (!this.callbacks.isActive()) {
      this.clearSettleTimers();
      return;
    }
    if (this.suppressSettleValue) {
      this.scrollInProgressValue = false;
      this.clearSettleTimers();
      return;
    }
    if (this.postSettleTimer) {
      clearTimeout(this.postSettleTimer);
      this.postSettleTimer = null;
    }
    if (this.edgeSettleTimer) {
      clearTimeout(this.edgeSettleTimer);
    }
    this.edgeSettleTimer = setTimeout(() => {
      this.edgeSettleTimer = null;
      this.handleScrollEnd(scrollElement);
    }, this.scrollEndDebounceMs());
  }

  public handleScrollEnd(scrollElement: HTMLDivElement): void {
    if (
      !this.callbacks.isActive()
      || this.callbacks.isTouchingSurface()
      || this.suppressSettleValue
      || scrollElement !== this.callbacks.scrollElement()
    ) {
      return;
    }
    if (!this.isScrollPageAligned(scrollElement)) {
      this.scheduleStableScrollEnd(scrollElement);
      return;
    }
    this.clearSettleTimers();
    this.scrollInProgressValue = false;
    this.preparedAheadPageKey = null;

    const visiblePage = this.currentPage(scrollElement);
    const visiblePageKey = visiblePage ? this.pageKeyForPage(visiblePage) : null;
    if (!visiblePageKey || visiblePageKey !== this.programmaticTargetKeyValue) {
      if (
        this.programmaticTargetKeyValue
        && this.pendingPageKeyValue === this.programmaticTargetKeyValue
        && visiblePageKey !== this.programmaticTargetKeyValue
      ) {
        this.callbacks.cancelPendingPageLoad();
      }
      this.programmaticTargetKeyValue = null;
    }

    if (this.settleWindow(scrollElement)) {
      this.scrollStartLeft = null;
      this.scrollDirection = null;
      this.flushDeferredSnapshot(scrollElement);
      this.callbacks.emitState();
      this.callbacks.markForCheck();
      return;
    }
    this.scrollStartLeft = null;
    this.scrollDirection = null;
    this.applySurfaceState(scrollElement);
    this.flushDeferredSnapshot(scrollElement);
    this.callbacks.emitState();
    this.callbacks.markForCheck();
  }

  public maybeLoadCurrentPage(
    scrollElement: HTMLDivElement | null = this.callbacks.scrollElement(),
    options: InfiniteStepperLoadOptions = {}
  ): void {
    if (!this.callbacks.isActive() || !scrollElement) {
      return;
    }
    const page = this.currentPage(scrollElement);
    if (!page) {
      return;
    }
    const pageKey = this.pageKeyForPage(page);
    if (this.programmaticTargetKeyValue) {
      if (pageKey !== this.programmaticTargetKeyValue) {
        return;
      }
      this.programmaticTargetKeyValue = null;
    }
    if (
      this.hasPageData(pageKey)
      || this.pendingPageKeyValue === pageKey
      || this.preloadingPageKeyValue === pageKey
    ) {
      return;
    }
    const anchor = this.anchorForPage(page);
    this.callbacks.loadPage(anchor, this.queryForAnchor(anchor), options);
  }

  public scrollToPage(pageIndex: number, behavior: ScrollBehavior): void {
    const scrollElement = this.callbacks.scrollElement();
    const pages = this.pagesValue;
    if (!scrollElement || pages.length === 0) {
      return;
    }
    const targetIndex = clampIndex(pageIndex, pages.length);
    const targetPage = pages[targetIndex] ?? null;
    const targetPageKey = targetPage ? this.pageKeyForPage(targetPage) : null;
    const targetLeft = this.pageTargetLeft(scrollElement, targetIndex, pages.length);
    if (targetLeft < 0) {
      this.programmaticTargetKeyValue = null;
      return;
    }
    const currentIndex = this.currentPageIndex(scrollElement, pages.length);
    const isSmoothPageMove = behavior === 'smooth' && currentIndex !== targetIndex;
    const targetPageToLoad = targetPage && targetPageKey && !this.hasPageData(targetPageKey)
      ? targetPage
      : null;
    this.programmaticTargetKeyValue = currentIndex === targetIndex
      ? null
      : targetPageKey;
    this.scrollInProgressValue = this.scrollInProgressValue || isSmoothPageMove;
    scrollElement.scrollTo({
      left: targetLeft,
      behavior
    });
    this.callbacks.emitState();
    this.callbacks.markForCheck();
    if (targetPageToLoad) {
      this.loadPageAfterScrollStarts(this.anchorForPage(targetPageToLoad));
    }
  }

  public normalizePageAlignment(scrollElement: HTMLDivElement): void {
    const pages = this.pagesValue;
    if (pages.length === 0) {
      return;
    }
    const nearestPageIndex = this.currentPageIndex(scrollElement, pages.length);
    const nearestPageLeft = this.pageOffsetLeft(scrollElement, nearestPageIndex);
    if (nearestPageLeft < 0) {
      return;
    }
    if (Math.abs(scrollElement.scrollLeft - nearestPageLeft) > 0.75) {
      return;
    }
    const previousScrollBehavior = scrollElement.style.scrollBehavior;
    scrollElement.style.scrollBehavior = 'auto';
    scrollElement.scrollLeft = nearestPageLeft;
    scrollElement.style.scrollBehavior = previousScrollBehavior;
  }

  public currentPage(scrollElement: HTMLDivElement | null = this.callbacks.scrollElement()): TPage | null {
    const pages = this.pagesValue;
    if (pages.length === 0) {
      return null;
    }
    return pages[this.currentPageIndex(scrollElement, pages.length)] ?? null;
  }

  public surfaceState(scrollElement: HTMLDivElement | null = this.callbacks.scrollElement()): InfiniteStepperSurfaceState {
    const pages = this.pagesValue;
    const adapter = this.callbacks.pageAdapter();
    if (!scrollElement || pages.length === 0) {
      return {
        scrollable: false,
        progress: 0,
        pageIndex: 0,
        label: pages[0] && adapter ? adapter.labelForPage(pages[0]) : ''
      };
    }
    const pageIndex = this.currentPageIndex(scrollElement, pages.length);
    const page = pages[pageIndex] ?? pages[0];
    return {
      scrollable: pages.length > 1,
      progress: this.surfaceProgress(scrollElement, pages.length),
      pageIndex,
      label: page && adapter ? adapter.labelForPage(page) : ''
    };
  }

  public currentPageIndex(
    scrollElement: HTMLDivElement | null = this.callbacks.scrollElement(),
    totalPages = this.pagesValue.length
  ): number {
    if (!scrollElement || totalPages <= 1) {
      return 0;
    }
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>(this.config.pageSelector)
    ).slice(0, totalPages);
    if (pageElements.length === 0) {
      const pageWidth = this.viewportWidth(scrollElement) || 1;
      return clampIndex(Math.round(scrollElement.scrollLeft / pageWidth), totalPages);
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
    return clampIndex(nearestIndex, totalPages);
  }

  public pageIndexForLeft(scrollElement: HTMLDivElement, totalPages: number, left: number): number {
    if (totalPages <= 1) {
      return 0;
    }
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>(this.config.pageSelector)
    ).slice(0, totalPages);
    if (pageElements.length === 0) {
      const pageWidth = this.viewportWidth(scrollElement) || 1;
      return clampIndex(Math.round(left / pageWidth), totalPages);
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
    return clampIndex(nearestIndex, totalPages);
  }

  public pageOffsetLeft(scrollElement: HTMLDivElement, pageIndex: number): number {
    const pageElements = Array.from(
      scrollElement.querySelectorAll<HTMLElement>(this.config.pageSelector)
    );
    const pageElement = pageElements[pageIndex];
    if (pageElement) {
      return pageElement.offsetLeft;
    }
    const pageWidth = this.viewportWidth(scrollElement);
    if (pageWidth <= 0) {
      return -1;
    }
    return pageWidth * pageIndex;
  }

  public pageTargetLeft(scrollElement: HTMLDivElement, pageIndex: number, totalPages = this.pagesValue.length): number {
    const safeTotal = Math.max(0, Math.trunc(totalPages));
    const safeIndex = clampIndex(pageIndex, safeTotal);
    if (safeTotal <= 1) {
      return 0;
    }
    const measuredLeft = this.pageOffsetLeft(scrollElement, safeIndex);
    if (measuredLeft > 0 || safeIndex === 0) {
      return measuredLeft;
    }
    const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
    if (maxScrollLeft > 0) {
      return (maxScrollLeft / Math.max(1, safeTotal - 1)) * safeIndex;
    }
    return measuredLeft;
  }

  public viewportWidth(scrollElement: HTMLDivElement): number {
    const rectWidth = scrollElement.getBoundingClientRect().width;
    if (Number.isFinite(rectWidth) && rectWidth > 0) {
      return rectWidth;
    }
    return scrollElement.clientWidth || 0;
  }

  private surfaceProgress(scrollElement: HTMLDivElement, totalPages: number): number {
    if (this.pendingVisualKeyValue && this.frozenProgressValue !== null) {
      return this.frozenProgressValue;
    }
    if (totalPages <= 0) {
      return 0;
    }
    if (totalPages === 1) {
      return 0.5;
    }
    const pageWidth = this.viewportWidth(scrollElement);
    if (pageWidth <= 0) {
      return clampNumber(this.currentPageIndex(scrollElement, totalPages) / Math.max(1, totalPages - 1), 0, 1);
    }
    const rawPageIndex = scrollElement.scrollLeft / pageWidth;
    return clampNumber(rawPageIndex / Math.max(1, totalPages - 1), 0, 1);
  }

  public currentPageOffsetLeft(scrollElement: HTMLDivElement): number {
    const pages = this.pagesValue;
    if (pages.length === 0) {
      return scrollElement.scrollLeft;
    }
    const pageIndex = this.currentPageIndex(scrollElement, pages.length);
    const pageLeft = this.pageOffsetLeft(scrollElement, pageIndex);
    return pageLeft >= 0 ? pageLeft : scrollElement.scrollLeft;
  }

  public settledPageIndex(scrollElement: HTMLDivElement, totalPages: number): number {
    if (!this.scrollDirection || this.scrollStartLeft === null) {
      return this.currentPageIndex(scrollElement, totalPages);
    }
    const startIndex = this.pageIndexForLeft(scrollElement, totalPages, this.scrollStartLeft);
    const currentIndex = this.currentPageIndex(scrollElement, totalPages);
    if (currentIndex !== startIndex) {
      return currentIndex;
    }
    const delta = Math.abs(scrollElement.scrollLeft - this.scrollStartLeft);
    if (delta < this.directionCommitThresholdPx(scrollElement)) {
      return startIndex;
    }
    return clampIndex(startIndex + this.scrollDirection, totalPages);
  }

  public releaseAfterSettle(callback: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(callback));
      return;
    }
    setTimeout(callback, this.scrollStableDelayMs());
  }

  private buildAnchorWindow(focusAnchor: TAnchor): TAnchor[] {
    const radius = this.normalizedAnchorRadius();
    const anchors: TAnchor[] = [focusAnchor];
    let previousAnchor = focusAnchor;
    for (let index = 0; index < radius; index += 1) {
      previousAnchor = this.normalizeAnchor(this.shiftAnchor(previousAnchor, -1));
      anchors.unshift(previousAnchor);
    }
    let nextAnchor = focusAnchor;
    for (let index = 0; index < radius; index += 1) {
      nextAnchor = this.normalizeAnchor(this.shiftAnchor(nextAnchor, 1));
      anchors.push(nextAnchor);
    }
    const anchorsByKey = new Map<string, TAnchor>();
    for (const anchor of anchors) {
      anchorsByKey.set(this.pageKey(anchor), anchor);
    }
    return [...anchorsByKey.values()];
  }

  private normalizedAnchorRadius(): number {
    return Math.max(0, Math.trunc(this.callbacks.pageAdapter()?.anchorRadius(this.callbacks.viewConfig()) ?? 0));
  }

  private recenterWindow(
    anchor: TAnchor,
    targetIndex: number,
    options: InfiniteStepperRecenterOptions = {}
  ): void {
    const loadAfterRecenter = options.loadAfterRecenter !== false;
    const normalizedAnchor = this.normalizeAnchor(anchor);
    const targetPageKey = this.pageKey(normalizedAnchor);
    if (!loadAfterRecenter || this.hasPageData(targetPageKey)) {
      this.clearPendingVisual();
    } else {
      this.showPendingVisual(normalizedAnchor, this.callbacks.currentProgress());
    }

    this.setWindowFocus(normalizedAnchor);
    this.suppressSettle = true;
    const nextElement = this.callbacks.scrollElement();
    const previousScrollBehavior = nextElement?.style.scrollBehavior ?? '';
    const previousSnapType = nextElement?.style.scrollSnapType ?? '';
    if (nextElement) {
      nextElement.style.scrollBehavior = 'auto';
      nextElement.style.scrollSnapType = 'none';
    }
    this.applySnapshot();
    this.callbacks.detectChanges();

    if (!nextElement) {
      this.suppressSettle = false;
      if (loadAfterRecenter) {
        this.maybeLoadCurrentPage();
      }
      this.callbacks.emitState();
      this.callbacks.markForCheck();
      return;
    }

    const targetLeft = this.pageOffsetLeft(nextElement, targetIndex);
    if (targetLeft < 0) {
      nextElement.style.scrollBehavior = previousScrollBehavior;
      nextElement.style.scrollSnapType = previousSnapType;
      this.suppressSettle = false;
      if (loadAfterRecenter) {
        this.maybeLoadCurrentPage(nextElement);
      }
      this.callbacks.emitState();
      this.callbacks.markForCheck();
      return;
    }

    nextElement.scrollLeft = targetLeft;
    nextElement.style.scrollBehavior = previousScrollBehavior;
    const release = () => {
      nextElement.style.scrollSnapType = previousSnapType;
      this.suppressSettle = false;
      this.applySurfaceState(nextElement);
      this.callbacks.emitState();
      this.callbacks.markForCheck();
      if (loadAfterRecenter) {
        this.maybeLoadCurrentPage(nextElement);
      }
    };
    this.releaseAfterSettle(release);
  }

  private scheduleStableScrollEnd(scrollElement: HTMLDivElement): void {
    if (this.postSettleTimer) {
      clearTimeout(this.postSettleTimer);
    }
    const scrollLeftSnapshot = scrollElement.scrollLeft;
    this.postSettleTimer = setTimeout(() => {
      this.postSettleTimer = null;
      if (
        !this.callbacks.isActive()
        || this.suppressSettleValue
        || scrollElement !== this.callbacks.scrollElement()
      ) {
        return;
      }
      const scrollDelta = Math.abs(scrollElement.scrollLeft - scrollLeftSnapshot);
      if (scrollDelta > this.scrollSettleTolerancePx()) {
        this.scheduleScrollEnd(scrollElement);
        return;
      }
      if (!this.isScrollPageAligned(scrollElement)) {
        this.alignScrollToSettledPage(scrollElement);
      }
      this.handleScrollEnd(scrollElement);
    }, this.scrollStableDelayMs());
  }

  private isScrollPageAligned(scrollElement: HTMLDivElement): boolean {
    const targetPageLeft = this.settledPageLeft(scrollElement);
    if (targetPageLeft === null) {
      return true;
    }
    return Math.abs(scrollElement.scrollLeft - targetPageLeft) <= this.scrollSettleTolerancePx();
  }

  private alignScrollToSettledPage(scrollElement: HTMLDivElement): void {
    const targetPageLeft = this.settledPageLeft(scrollElement);
    if (targetPageLeft === null) {
      return;
    }
    scrollElement.scrollTo({ left: targetPageLeft, behavior: 'smooth' });
  }

  private settledPageLeft(scrollElement: HTMLDivElement): number | null {
    const pages = this.pagesValue;
    if (pages.length === 0) {
      return null;
    }
    const pageIndex = this.settledPageIndex(scrollElement, pages.length);
    const pageLeft = this.pageOffsetLeft(scrollElement, pageIndex);
    return pageLeft < 0 ? null : pageLeft;
  }

  private settleWindow(scrollElement: HTMLDivElement): boolean {
    const pages = this.pagesValue;
    if (pages.length === 0) {
      return false;
    }
    const currentIndex = this.settledPageIndex(scrollElement, pages.length);
    const activePage = pages[currentIndex];
    if (!activePage) {
      return false;
    }
    this.loadPageForSettledPage(activePage);
    const desiredIndex = this.desiredPageIndex(pages.length);
    if (currentIndex !== desiredIndex && (currentIndex === 0 || currentIndex === pages.length - 1)) {
      this.recenterWindow(this.anchorForPage(activePage), desiredIndex, { loadAfterRecenter: false });
      return true;
    }
    return false;
  }

  private loadPageForSettledPage(page: TPage): void {
    const pageKey = this.pageKeyForPage(page);
    const settledPageChanged = this.lastSettledPageKey !== pageKey;
    this.lastSettledPageKey = pageKey;
    if (settledPageChanged) {
      if (this.pendingPageKeyValue === pageKey) {
        return;
      }
      this.callbacks.cancelPendingPreload();
      const anchor = this.anchorForPage(page);
      this.callbacks.loadPage(anchor, this.queryForAnchor(anchor), { replacePending: true, force: true });
      return;
    }
    if (
      this.hasPageData(pageKey)
      || this.pendingPageKeyValue === pageKey
      || this.preloadingPageKeyValue === pageKey
    ) {
      return;
    }
    const anchor = this.anchorForPage(page);
    this.callbacks.loadPage(anchor, this.queryForAnchor(anchor), { replacePending: true });
  }

  private preparePageAheadForScroll(scrollElement: HTMLDivElement): void {
    const pages = this.pagesValue;
    if (pages.length < 2 || this.suppressSettleValue) {
      return;
    }
    const baselineLeft = this.scrollStartLeft ?? this.currentPageOffsetLeft(scrollElement);
    this.scrollStartLeft = baselineLeft;
    const pageWidth = this.viewportWidth(scrollElement);
    const directionThreshold = Math.max(8, pageWidth * 0.02);
    const delta = scrollElement.scrollLeft - baselineLeft;
    if (Math.abs(delta) < directionThreshold) {
      return;
    }
    const direction: -1 | 1 = delta > 0 ? 1 : -1;
    this.scrollDirection = direction;
    const projectedIndex = clampIndex(
      Math.round(scrollElement.scrollLeft / Math.max(1, pageWidth)),
      pages.length
    );
    const projectedPage = pages[projectedIndex] ?? null;
    const projectedPageKey = projectedPage ? this.pageKeyForPage(projectedPage) : null;
    const anchor = projectedPage && projectedPageKey && !this.hasPageData(projectedPageKey)
      ? this.anchorForPage(projectedPage)
      : (direction > 0
          ? this.shiftAnchor(this.anchorForPage(pages[pages.length - 1]!), 1)
          : this.shiftAnchor(this.anchorForPage(pages[0]!), -1));
    const pageKey = this.pageKey(anchor);
    if (
      this.preparedAheadPageKey === pageKey
      || this.hasPageData(pageKey)
      || this.pendingPageKeyValue === pageKey
      || this.preloadingPageKeyValue === pageKey
    ) {
      return;
    }
    this.preparedAheadPageKey = pageKey;
    this.callbacks.preloadPage(anchor, this.queryForAnchor(anchor));
  }

  private loadPageAfterScrollStarts(anchor: TAnchor): void {
    setTimeout(() => {
      this.callbacks.loadPage(anchor, this.queryForAnchor(anchor), { replacePending: true });
    }, 0);
  }

  private directionCommitThresholdPx(scrollElement: HTMLDivElement): number {
    return Math.max(
      this.directionCommitMinPx(),
      this.viewportWidth(scrollElement) * this.directionCommitRatio()
    );
  }

  private scrollEndDebounceMs(): number {
    return this.config.scrollEndDebounceMs ?? InfiniteStepper.DEFAULT_SCROLL_END_DEBOUNCE_MS;
  }

  private scrollStableDelayMs(): number {
    return this.config.scrollStableDelayMs ?? InfiniteStepper.DEFAULT_SCROLL_STABLE_DELAY_MS;
  }

  private scrollSettleTolerancePx(): number {
    return this.config.scrollSettleTolerancePx ?? InfiniteStepper.DEFAULT_SCROLL_SETTLE_TOLERANCE_PX;
  }

  private directionCommitMinPx(): number {
    return this.config.directionCommitMinPx ?? InfiniteStepper.DEFAULT_DIRECTION_COMMIT_MIN_PX;
  }

  private directionCommitRatio(): number {
    return this.config.directionCommitRatio ?? InfiniteStepper.DEFAULT_DIRECTION_COMMIT_RATIO;
  }
}

function clampIndex(index: number, total: number): number {
  return Math.max(0, Math.min(Math.max(0, total - 1), index));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
