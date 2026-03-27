import type { RateMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../../../shared/core/base/interfaces/user.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import type { RatingStarBarConfig } from '../../../../../shared/ui';
import { ActivitiesRateEditorPresenter } from './activities-rate-editor.presenter';
import {
  isActivitiesRateBlinking,
  triggerActivitiesRateBlink
} from './activities-rate-blink.presenter';
import {
  animateActivitiesRateEditorScrollTo,
  syncActivitiesRatesListPositionToRow
} from './activities-rate-motion.presenter';
import {
  activitiesPairReceivedAverageScore,
  activitiesRateHasOwnRating,
  activitiesRateOwnRatingValue,
  activitiesRateOwnScore,
  collectPendingActivitiesRateDirectionOverrides,
  displayedActivitiesRateDirection,
  isActivitiesPairReceivedRateRow,
  matchesActivitiesRateFilter,
  normalizeActivitiesRateScore,
  pendingActivitiesRateDirectionAfterRating,
  selectedActivitiesRateRow
} from './activities-rate-state.presenter';
import type { ActivitiesRateTemplateContext } from './activities-rate-template.component';

interface ActivitiesRatesControllerDeps {
  getUsers: () => readonly DemoUser[];
  getActiveUserGender: () => 'woman' | 'man';
  getActivitiesPrimaryFilter: () => AppTypes.ActivitiesPrimaryFilter;
  getActivitiesRateFilter: () => AppTypes.RateFilterKey;
  getActivitiesRateSocialBadgeEnabled: () => boolean;
  getFilteredActivityRows: () => readonly AppTypes.ActivityListRow[];
  getRateItems: () => readonly RateMenuItem[];
  getSmartListCursorItem: () => AppTypes.ActivityListRow | null;
  getActivitiesListScrollElement: () => HTMLElement | null;
  getPaginationHostElement: () => HTMLElement | null;
  isMobileView: () => boolean;
  isCalendarLayoutView: () => boolean;
  shouldShowFullscreenToggle: () => boolean;
  isFullscreenPaginationAnimating: () => boolean;
  getRatingScale: () => readonly number[];
  getActivityRateEditorSlideDurationMs: () => number;
  getSelectedRateId: () => string | null;
  setSelectedRateId: (value: string | null) => void;
  getEditorClosing: () => boolean;
  setEditorClosing: (value: boolean) => void;
  getEditorCloseTimer: () => ReturnType<typeof setTimeout> | null;
  setEditorCloseTimer: (value: ReturnType<typeof setTimeout> | null) => void;
  getEditorLiftAnimationFrame: () => number | null;
  setEditorLiftAnimationFrame: (value: number | null) => void;
  getEditorOpenScrollTop: () => number | null;
  setEditorOpenScrollTop: (value: number | null) => void;
  getLastEditorLiftDelta: () => number;
  setLastEditorLiftDelta: (value: number) => void;
  getLastIndicatorPulseRowId: () => string | null;
  setLastIndicatorPulseRowId: (value: string | null) => void;
  getFullscreenMode: () => boolean;
  setFullscreenMode: (value: boolean) => void;
  getActivityRateBlinkUntilByRowId: () => Record<string, number>;
  getActivityRateBlinkTimeoutByRowId: () => Record<string, ReturnType<typeof setTimeout> | null>;
  getActivityRateDraftById: () => Record<string, number>;
  getActivityRateDirectionOverrideById: () => Partial<Record<string, RateMenuItem['direction']>>;
  getPendingActivityRateDirectionOverrideById: () => Partial<Record<string, RateMenuItem['direction']>>;
  setSelectedRateIdInContext: (value: string | null) => void;
  setFullscreenModeInContext: (value: boolean) => void;
  recordActivityRate: (item: RateMenuItem, score: number, direction: RateMenuItem['direction']) => void;
  markForCheck: () => void;
  runAfterNextPaint: (task: () => void) => void;
  runAfterRender: (task: () => void) => void;
}

export class ActivitiesRatesController {
  readonly templateContext: ActivitiesRateTemplateContext = {
    getUsers: () => this.deps.getUsers(),
    getActiveUserGender: () => this.deps.getActiveUserGender(),
    getDisplayedDirection: item => this.displayedDirection(item),
    isSelectedActivityRateRow: row => this.isSelectedRow(row),
    isActivityRateBlinking: row => this.isBlinking(row),
    getActivityRateDraftValue: itemId => this.activityRateDraftById()[itemId],
    normalizeRateScore: value => this.normalizeScore(value),
    hasOwnRating: item => this.hasOwnRating(item),
    pairReceivedAverageScore: item => this.pairReceivedAverageScore(item),
    rateOwnScore: item => this.rateOwnScore(item),
    isFullscreenPaginationAnimating: () => this.deps.isFullscreenPaginationAnimating()
  };

  private readonly rateEditorPresenter: ActivitiesRateEditorPresenter;

  constructor(private readonly deps: ActivitiesRatesControllerDeps) {
    this.rateEditorPresenter = new ActivitiesRateEditorPresenter({
      getActivitiesRateFilter: () => this.deps.getActivitiesRateFilter(),
      getSelectedRow: () => this.selectedRow(),
      getFocusedRow: () => this.isFullscreenModeActive()
        ? this.currentFullscreenRow()
        : this.selectedRow(),
      isFullscreenModeActive: () => this.isFullscreenModeActive(),
      isEditorClosing: () => this.isEditorClosing(),
      isEditorOpen: () => this.isEditorOpen(),
      getRatingScale: () => this.deps.getRatingScale(),
      getOwnRatingValue: row => this.ownRatingValue(row),
      isPairReceivedRateRow: row => this.isPairReceivedRow(row)
    });
  }

  ratingBarConfig(): RatingStarBarConfig {
    return this.rateEditorPresenter.barConfig();
  }

  ratingBarValue(): number {
    return this.rateEditorPresenter.selectedValue();
  }

  openEditor(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    if (row.type !== 'rates') {
      return;
    }
    if (this.isPairReceivedRow(row)) {
      return;
    }
    this.cancelEditorCloseTransition();
    const wasOpen = this.isEditorOpen();
    if (this.selectedRateId() === row.id) {
      this.clearEditorState();
      return;
    }
    const scrollElement = this.deps.getActivitiesListScrollElement();
    if (!wasOpen) {
      this.deps.setEditorOpenScrollTop(scrollElement ? scrollElement.scrollTop : null);
    }
    this.setSelectedRateId(row.id);
    this.deps.setEditorClosing(false);
    this.cancelEditorLiftAnimation();
    this.deps.runAfterNextPaint(() => {
      if (!this.isEditorOpen() || this.selectedRateId() !== row.id) {
        return;
      }
      this.smoothRevealSelectedRateRowWhenNeeded(row.id);
    });
  }

  closeEditorFromUserScroll(): void {
    if (!this.isEditorOpen()) {
      return;
    }
    this.clearEditorState(true);
  }

  isEditorDockVisible(): boolean {
    if (this.isFullscreenModeActive()) {
      if (this.isFullscreenReadOnlyNavigation()) {
        return false;
      }
      return this.currentFullscreenRow() !== null;
    }
    return this.deps.getActivitiesPrimaryFilter() === 'rates'
      && (!!this.selectedRateId() || this.isEditorClosing());
  }

  shouldRenderEditorDock(): boolean {
    if (this.deps.isCalendarLayoutView() || this.deps.getActivitiesPrimaryFilter() !== 'rates') {
      return false;
    }
    if (!this.isFullscreenModeActive()) {
      return true;
    }
    if (this.isFullscreenReadOnlyNavigation()) {
      return false;
    }
    return this.currentFullscreenRow() !== null;
  }

  isEditorOpen(): boolean {
    if (this.isFullscreenModeActive()) {
      return true;
    }
    return this.deps.getActivitiesPrimaryFilter() === 'rates'
      && !!this.selectedRateId()
      && !this.isEditorClosing();
  }

  isEditorClosing(): boolean {
    return this.deps.getEditorClosing();
  }

  editorSpacerHeight(): string | null {
    if (
      this.deps.getActivitiesPrimaryFilter() !== 'rates'
      || this.deps.isCalendarLayoutView()
      || this.isFullscreenModeActive()
    ) {
      return null;
    }
    return this.isEditorDockVisible()
      ? 'calc(5.2rem + env(safe-area-inset-bottom))'
      : '0px';
  }

  isSelectedRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'rates' && this.isEditorOpen() && this.selectedRateId() === row.id;
  }

  setSelectedOwnRating(score: number): void {
    const normalized = this.normalizeScore(score);
    const row = this.isFullscreenModeActive()
      ? this.currentFullscreenRow()
      : this.selectedRow();
    if (!row || row.type !== 'rates') {
      return;
    }
    if (this.isPairReceivedRow(row)) {
      return;
    }
    this.setSelectedRateId(row.id);
    this.activityRateDraftById()[row.id] = normalized;
    const rateItem = row.source as RateMenuItem;
    const nextDirection = this.pendingDirectionAfterRating(rateItem);
    if (nextDirection) {
      this.pendingActivityRateDirectionOverrideById()[rateItem.id] = nextDirection;
    }
    this.deps.recordActivityRate(
      rateItem,
      normalized,
      nextDirection ?? this.displayedDirection(rateItem)
    );
    this.triggerBlinks(row.id);
  }

  clearEditorState(preserveScrollPosition = false): void {
    if (this.isFullscreenModeActive()) {
      return;
    }
    if (!this.selectedRateId() && !this.isEditorClosing()) {
      return;
    }
    if (this.isEditorClosing()) {
      return;
    }
    const scrollElement = this.deps.getActivitiesListScrollElement();
    const restoreTop = this.deps.getEditorOpenScrollTop();
    const hasRestoreTop = Number.isFinite(restoreTop as number);
    const shouldReverseLift =
      !preserveScrollPosition
      && this.deps.getActivitiesPrimaryFilter() === 'rates'
      && !!scrollElement
      && (hasRestoreTop
        ? scrollElement.scrollTop > (restoreTop as number) + 0.5
        : this.deps.getLastEditorLiftDelta() > 0);
    const previousInlineSnapType = shouldReverseLift ? scrollElement.style.scrollSnapType : '';
    const reverseDelta = this.deps.getLastEditorLiftDelta();
    this.deps.setEditorClosing(true);
    this.cancelEditorCloseTransition();
    this.cancelEditorLiftAnimation();
    this.deps.setEditorCloseTimer(setTimeout(() => {
      this.deps.setEditorCloseTimer(null);
      this.deps.setEditorClosing(false);
      this.setSelectedRateId(null);
      this.deps.setLastIndicatorPulseRowId(null);
      this.deps.setLastEditorLiftDelta(0);
      this.deps.setEditorOpenScrollTop(null);
    }, this.deps.getActivityRateEditorSlideDurationMs()));
    if (!shouldReverseLift || !scrollElement) {
      return;
    }
    this.deps.runAfterRender(() => {
      const targetTop = Number.isFinite(restoreTop as number)
        ? Math.max(0, restoreTop as number)
        : Math.max(0, scrollElement.scrollTop - reverseDelta);
      scrollElement.style.scrollSnapType = 'none';
      this.animateEditorScrollTo(scrollElement, targetTop, () => {
        scrollElement.style.scrollSnapType = previousInlineSnapType;
      });
    });
  }

  isBlinking(row: AppTypes.ActivityListRow): boolean {
    return isActivitiesRateBlinking(row, this.deps.getActivityRateBlinkUntilByRowId());
  }

  isFullscreenReadOnlyNavigation(): boolean {
    return this.isFullscreenModeActive() && this.deps.getActivitiesRateFilter() === 'pair-received';
  }

  currentFullscreenRow(): AppTypes.ActivityListRow | null {
    if (!this.isFullscreenModeActive()) {
      return null;
    }
    const smartListRow = this.deps.getSmartListCursorItem();
    if (smartListRow?.type === 'rates') {
      return smartListRow;
    }
    return null;
  }

  toggleFullscreenMode(event: Event): void {
    event.stopPropagation();
    if (!this.deps.shouldShowFullscreenToggle()) {
      return;
    }
    if (this.deps.getFullscreenMode()) {
      this.disableFullscreenMode();
      return;
    }
    this.resetEditorStateForFullscreenEntry();
    this.setFullscreenMode(true);
    this.deps.runAfterRender(() => {
      this.syncFullscreenSelection();
      this.deps.markForCheck();
    });
    this.deps.markForCheck();
  }

  disableFullscreenMode(): void {
    if (!this.deps.getFullscreenMode()) {
      return;
    }
    const selectedRateId = this.selectedRateId();
    this.setFullscreenMode(false);
    this.deps.setEditorClosing(false);
    this.deps.setLastEditorLiftDelta(0);
    this.deps.setLastIndicatorPulseRowId(null);
    this.deps.setSelectedRateIdInContext(this.selectedRateId());
    this.deps.markForCheck();
    if (!selectedRateId) {
      return;
    }
    this.deps.runAfterRender(() => {
      this.syncListPositionToRow(selectedRateId);
      this.smoothRevealSelectedRateRowWhenNeeded(selectedRateId);
    });
  }

  syncFullscreenSelection(): void {
    if (!this.deps.getFullscreenMode()) {
      return;
    }
    const currentRow = this.currentFullscreenRow();
    if (!currentRow) {
      this.setSelectedRateId(null);
      return;
    }
    this.setSelectedRateId(currentRow.id);
  }

  matchesFilter(item: RateMenuItem, filter: AppTypes.RateFilterKey): boolean {
    return matchesActivitiesRateFilter(
      item,
      filter,
      this.deps.getActivitiesRateSocialBadgeEnabled(),
      candidate => this.displayedDirection(candidate)
    );
  }

  displayedDirection(item: RateMenuItem): RateMenuItem['direction'] {
    return displayedActivitiesRateDirection(item, this.deps.getActivityRateDirectionOverrideById());
  }

  commitPendingDirectionOverrides(targetFilter?: AppTypes.RateFilterKey): void {
    const pendingById = this.pendingActivityRateDirectionOverrideById();
    const directionOverrides = this.deps.getActivityRateDirectionOverrideById();
    for (const [itemId, pendingDirection] of collectPendingActivitiesRateDirectionOverrides(
      targetFilter,
      pendingById,
      this.deps.getRateItems()
    )) {
      directionOverrides[itemId] = pendingDirection;
      delete pendingById[itemId];
    }
  }

  selectedRow(): AppTypes.ActivityListRow | null {
    return selectedActivitiesRateRow(this.selectedRateId(), this.deps.getFilteredActivityRows());
  }

  normalizeScore(value: number): number {
    return normalizeActivitiesRateScore(value);
  }

  rateOwnScore(item: RateMenuItem): number {
    return activitiesRateOwnScore(item);
  }

  hasOwnRating(item: RateMenuItem): boolean {
    return activitiesRateHasOwnRating(
      item,
      this.activityRateDraftById()[item.id],
      candidate => this.displayedDirection(candidate)
    );
  }

  pairReceivedAverageScore(item: RateMenuItem): number {
    return activitiesPairReceivedAverageScore(
      item,
      this.deps.getRateItems(),
      candidate => this.displayedDirection(candidate)
    );
  }

  isPairReceivedRow(row: AppTypes.ActivityListRow): boolean {
    return isActivitiesPairReceivedRateRow(row, candidate => this.displayedDirection(candidate));
  }

  ownRatingValue(row: AppTypes.ActivityListRow): number {
    return activitiesRateOwnRatingValue(
      row,
      this.activityRateDraftById(),
      candidate => this.displayedDirection(candidate),
      this.deps.getRateItems()
    );
  }

  isFullscreenModeActive(): boolean {
    return this.deps.shouldShowFullscreenToggle() && this.deps.getFullscreenMode();
  }

  private cancelEditorCloseTransition(): void {
    const timer = this.deps.getEditorCloseTimer();
    if (timer) {
      clearTimeout(timer);
      this.deps.setEditorCloseTimer(null);
    }
  }

  private cancelEditorLiftAnimation(): void {
    const frameId = this.deps.getEditorLiftAnimationFrame();
    if (frameId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(frameId);
    }
    this.deps.setEditorLiftAnimationFrame(null);
  }

  private smoothRevealSelectedRateRowWhenNeeded(rowId: string, attempt = 0): void {
    if (!this.isEditorOpen()) {
      return;
    }
    const scrollElement = this.deps.getActivitiesListScrollElement();
    if (!scrollElement) {
      return;
    }
    const targetRow = scrollElement.querySelector<HTMLElement>(`[data-activity-rate-row-id="${rowId}"]`);
    if (!targetRow) {
      return;
    }
    const rateRows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.activities-rate-profile-card.activities-row-item'));
    const rowTop = targetRow.offsetTop;
    const sameRowCards = rateRows.filter(card => Math.abs(card.offsetTop - rowTop) <= 1);
    const dock = this.deps.getPaginationHostElement();
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowBottom = (sameRowCards.length > 0 ? sameRowCards : [targetRow]).reduce((maxBottom, card) => {
      return Math.max(maxBottom, card.getBoundingClientRect().bottom);
    }, targetRow.getBoundingClientRect().bottom);
    const dockHeight = Math.max(72, dock?.offsetHeight ?? 72);
    const dockTop = scrollRect.bottom - dockHeight;
    const breathingRoom = this.deps.isMobileView() ? 6 : 8;
    const revealBottom = dockTop - breathingRoom;
    if (rowBottom <= revealBottom) {
      if (!Number.isFinite(this.deps.getEditorOpenScrollTop() as number)) {
        this.deps.setLastEditorLiftDelta(0);
      }
      return;
    }
    const delta = rowBottom - revealBottom;
    const startTop = scrollElement.scrollTop;
    const targetTop = startTop + delta;
    if (targetTop <= scrollElement.scrollTop + 0.5) {
      this.deps.setLastEditorLiftDelta(0);
      if (attempt < 1) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(rowId, attempt + 1), 120);
      }
      return;
    }
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    this.animateEditorScrollTo(scrollElement, targetTop, () => {
      this.deps.setLastEditorLiftDelta(Math.max(0, scrollElement.scrollTop - startTop));
      scrollElement.style.scrollSnapType = previousSnapType;
    });
  }

  private animateEditorScrollTo(scrollElement: HTMLElement, targetTop: number, onComplete?: () => void): void {
    this.cancelEditorLiftAnimation();
    animateActivitiesRateEditorScrollTo(
      scrollElement,
      targetTop,
      this.deps.getActivityRateEditorSlideDurationMs(),
      frameId => { this.deps.setEditorLiftAnimationFrame(frameId); },
      onComplete
    );
  }

  private triggerBlinks(rowId: string, onStart?: () => void): void {
    triggerActivitiesRateBlink(
      rowId,
      this.deps.getActivityRateBlinkUntilByRowId(),
      this.deps.getActivityRateBlinkTimeoutByRowId(),
      () => this.deps.markForCheck(),
      onStart
    );
  }

  private pendingDirectionAfterRating(item: RateMenuItem): RateMenuItem['direction'] | null {
    return pendingActivitiesRateDirectionAfterRating(item, candidate => this.displayedDirection(candidate));
  }

  private resetEditorStateForFullscreenEntry(): void {
    this.cancelEditorCloseTransition();
    this.cancelEditorLiftAnimation();
    this.deps.setEditorClosing(false);
    this.deps.setEditorOpenScrollTop(null);
    this.deps.setLastEditorLiftDelta(0);
    this.deps.setLastIndicatorPulseRowId(null);
    if (!this.selectedRateId()) {
      return;
    }
    this.setSelectedRateId(null);
  }

  private syncListPositionToRow(rowId: string): void {
    const scrollElement = this.deps.getActivitiesListScrollElement();
    if (!scrollElement) {
      return;
    }
    syncActivitiesRatesListPositionToRow(
      scrollElement,
      rowId,
      this.deps.isMobileView(),
      () => this.deps.markForCheck()
    );
  }

  private selectedRateId(): string | null {
    return this.deps.getSelectedRateId();
  }

  private setSelectedRateId(value: string | null): void {
    this.deps.setSelectedRateId(value);
    this.deps.setSelectedRateIdInContext(value);
  }

  private setFullscreenMode(value: boolean): void {
    this.deps.setFullscreenMode(value);
    this.deps.setFullscreenModeInContext(value);
  }

  private activityRateDraftById(): Record<string, number> {
    return this.deps.getActivityRateDraftById();
  }

  private pendingActivityRateDirectionOverrideById(): Partial<Record<string, RateMenuItem['direction']>> {
    return this.deps.getPendingActivityRateDirectionOverrideById();
  }
}
