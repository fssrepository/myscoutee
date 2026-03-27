import { Directive } from '@angular/core';

import { AppUtils } from '../../../shared/app-utils';
import type { RateMenuItem } from '../../../shared/core/base/interfaces/activity-feed.interface';
import type * as AppTypes from '../../../shared/core/base/models';
import { ActivitiesPopupEventsBase } from './activities-popup-events.base';

@Directive()
export abstract class ActivitiesPopupRatesBase extends ActivitiesPopupEventsBase {
  protected override openActivityRateEditor(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    if (row.type !== 'rates') {
      return;
    }
    if (this.templatePresenter.isPairReceivedRateRow(row)) {
      return;
    }
    this.cancelActivityRateEditorCloseTransition();
    const wasOpen = this.isActivityRateEditorOpen();
    if (this.selectedActivityRateId === row.id) {
      this.clearActivityRateEditorState();
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    if (!wasOpen) {
      this.activityRateEditorOpenScrollTop = scrollElement ? scrollElement.scrollTop : null;
    }
    this.selectedActivityRateId = row.id;
    this.activitiesContext.setActivitiesSelectedRateId(row.id);
    this.activityRateEditorClosing = false;
    this.cancelActivityRateEditorLiftAnimation();
    this.runAfterActivitiesNextPaint(() => {
      if (!this.isActivityRateEditorOpen() || this.selectedActivityRateId !== row.id) {
        return;
      }
      this.smoothRevealSelectedRateRowWhenNeeded(row.id);
    });
  }

  protected closeActivityRateEditorFromUserScroll(): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    this.clearActivityRateEditorState(true);
  }

  protected isActivityRateEditorDockVisible(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      if (this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
        return false;
      }
      return this.currentActivitiesRatesFullscreenRow() !== null;
    }
    return this.activitiesPrimaryFilter === 'rates' && (!!this.selectedActivityRateId || this.activityRateEditorClosing);
  }

  protected override shouldRenderActivityRateEditorDock(): boolean {
    if (this.isCalendarLayoutView() || this.activitiesPrimaryFilter !== 'rates') {
      return false;
    }
    if (!this.isRatesFullscreenModeActive()) {
      return true;
    }
    if (this.isActivitiesRatesFullscreenReadOnlyNavigation()) {
      return false;
    }
    return this.currentActivitiesRatesFullscreenRow() !== null;
  }

  protected override isActivityRateEditorOpen(): boolean {
    if (this.isRatesFullscreenModeActive()) {
      return true;
    }
    return this.activitiesPrimaryFilter === 'rates' && !!this.selectedActivityRateId && !this.activityRateEditorClosing;
  }

  protected override isActivityRateEditorClosing(): boolean {
    return this.activityRateEditorClosing;
  }

  protected override activityRateEditorSpacerHeight(): string | null {
    if (this.activitiesPrimaryFilter !== 'rates' || this.isCalendarLayoutView() || this.isRatesFullscreenModeActive()) {
      return null;
    }
    return this.isActivityRateEditorDockVisible()
      ? 'calc(5.2rem + env(safe-area-inset-bottom))'
      : '0px';
  }

  protected override isSelectedActivityRateRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'rates' && this.isActivityRateEditorOpen() && this.selectedActivityRateId === row.id;
  }

  protected override setSelectedActivityOwnRating(score: number): void {
    const normalized = this.normalizeRateScore(score);
    const row = this.isRatesFullscreenModeActive()
      ? this.currentActivitiesRatesFullscreenRow()
      : this.selectedActivityRateRow();
    if (!row || row.type !== 'rates') {
      return;
    }
    if (this.templatePresenter.isPairReceivedRateRow(row)) {
      return;
    }
    this.selectedActivityRateId = row.id;
    this.activitiesContext.setActivitiesSelectedRateId(row.id);
    this.activityRateDraftById[row.id] = normalized;
    const rateItem = row.source as RateMenuItem;
    const nextDirection = this.pendingDirectionAfterRating(rateItem);
    if (nextDirection) {
      this.pendingActivityRateDirectionOverrideById[rateItem.id] = nextDirection;
    }
    this.ratesService.recordActivityRate(
      this.activeUser.id,
      rateItem,
      normalized,
      nextDirection ?? this.displayedRateDirection(rateItem)
    );
    this.triggerActivityRateBlinks(row.id);
  }

  protected override clearActivityRateEditorState(preserveScrollPosition = false): void {
    if (this.isRatesFullscreenModeActive()) {
      return;
    }
    if (!this.selectedActivityRateId && !this.activityRateEditorClosing) {
      return;
    }
    if (this.activityRateEditorClosing) {
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
    const restoreTop = this.activityRateEditorOpenScrollTop;
    const hasRestoreTop = Number.isFinite(restoreTop as number);
    const shouldReverseLift =
      !preserveScrollPosition &&
      this.activitiesPrimaryFilter === 'rates' &&
      !!scrollElement &&
      (hasRestoreTop
        ? scrollElement.scrollTop > (restoreTop as number) + 0.5
        : this.lastActivityRateEditorLiftDelta > 0);
    const previousInlineSnapType = shouldReverseLift ? scrollElement.style.scrollSnapType : '';
    const reverseDelta = this.lastActivityRateEditorLiftDelta;
    this.activityRateEditorClosing = true;
    this.cancelActivityRateEditorCloseTransition();
    this.cancelActivityRateEditorLiftAnimation();
    this.activityRateEditorCloseTimer = setTimeout(() => {
      this.activityRateEditorCloseTimer = null;
      this.activityRateEditorClosing = false;
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      this.lastRateIndicatorPulseRowId = null;
      this.lastActivityRateEditorLiftDelta = 0;
      this.activityRateEditorOpenScrollTop = null;
    }, this.activityRateEditorSlideDurationMs);
    if (!shouldReverseLift || !scrollElement) {
      return;
    }
    this.runAfterActivitiesRender(() => {
      const targetTop = Number.isFinite(restoreTop as number)
        ? Math.max(0, restoreTop as number)
        : Math.max(0, scrollElement.scrollTop - reverseDelta);
      scrollElement.style.scrollSnapType = 'none';
      this.animateActivityRateEditorScrollTo(scrollElement, targetTop, () => {
        scrollElement.style.scrollSnapType = previousInlineSnapType;
      });
    });
  }

  private cancelActivityRateEditorCloseTransition(): void {
    if (this.activityRateEditorCloseTimer) {
      clearTimeout(this.activityRateEditorCloseTimer);
      this.activityRateEditorCloseTimer = null;
    }
  }

  private cancelActivityRateEditorLiftAnimation(): void {
    if (this.activityRateEditorLiftAnimationFrame !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.activityRateEditorLiftAnimationFrame);
    }
    this.activityRateEditorLiftAnimationFrame = null;
  }

  private smoothRevealSelectedRateRowWhenNeeded(rowId: string, attempt = 0): void {
    if (!this.isActivityRateEditorOpen()) {
      return;
    }
    const scrollElement = this.activitiesListScrollElement();
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
    const dock = this.activitiesSmartList?.paginationHostElement() ?? null;
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowBottom = (sameRowCards.length > 0 ? sameRowCards : [targetRow]).reduce((maxBottom, card) => {
      return Math.max(maxBottom, card.getBoundingClientRect().bottom);
    }, targetRow.getBoundingClientRect().bottom);
    const dockHeight = Math.max(72, dock?.offsetHeight ?? 72);
    const dockTop = scrollRect.bottom - dockHeight;
    const breathingRoom = this.isMobileView ? 6 : 8;
    const revealBottom = dockTop - breathingRoom;
    if (rowBottom <= revealBottom) {
      if (!Number.isFinite(this.activityRateEditorOpenScrollTop as number)) {
        this.lastActivityRateEditorLiftDelta = 0;
      }
      return;
    }
    const delta = rowBottom - revealBottom;
    const startTop = scrollElement.scrollTop;
    const targetTop = startTop + delta;
    if (targetTop <= scrollElement.scrollTop + 0.5) {
      this.lastActivityRateEditorLiftDelta = 0;
      if (attempt < 1) {
        setTimeout(() => this.smoothRevealSelectedRateRowWhenNeeded(rowId, attempt + 1), 120);
      }
      return;
    }
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    this.animateActivityRateEditorScrollTo(scrollElement, targetTop, () => {
      this.lastActivityRateEditorLiftDelta = Math.max(0, scrollElement.scrollTop - startTop);
      scrollElement.style.scrollSnapType = previousSnapType;
    });
  }

  private animateActivityRateEditorScrollTo(scrollElement: HTMLElement, targetTop: number, onComplete?: () => void): void {
    const startTop = scrollElement.scrollTop;
    const delta = targetTop - startTop;
    if (Math.abs(delta) <= 0.5) {
      scrollElement.scrollTop = targetTop;
      onComplete?.();
      return;
    }
    this.cancelActivityRateEditorLiftAnimation();
    if (typeof globalThis.requestAnimationFrame !== 'function' || typeof globalThis.performance === 'undefined') {
      scrollElement.scrollTop = targetTop;
      onComplete?.();
      return;
    }
    const startTime = globalThis.performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / this.activityRateEditorSlideDurationMs);
      scrollElement.scrollTop = startTop + (delta * this.activityRateEditorLiftEasedProgress(progress));
      if (progress < 1) {
        this.activityRateEditorLiftAnimationFrame = globalThis.requestAnimationFrame(step);
        return;
      }
      this.activityRateEditorLiftAnimationFrame = null;
      scrollElement.scrollTop = targetTop;
      onComplete?.();
    };
    step(startTime);
  }

  private activityRateEditorLiftEasedProgress(progress: number): number {
    return this.sampleCubicBezierYForX(AppUtils.clampNumber(progress, 0, 1), 0.22, 1, 0.36, 1);
  }

  private sampleCubicBezierYForX(x: number, x1: number, y1: number, x2: number, y2: number): number {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }

    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
    const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
    const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

    let t = x;
    for (let index = 0; index < 4; index += 1) {
      const currentX = sampleCurveX(t) - x;
      const derivative = sampleCurveDerivativeX(t);
      if (Math.abs(currentX) < 0.0001 || Math.abs(derivative) < 0.0001) {
        break;
      }
      t -= currentX / derivative;
    }

    let lowerBound = 0;
    let upperBound = 1;
    while (upperBound - lowerBound > 0.0001) {
      const currentX = sampleCurveX(t);
      if (Math.abs(currentX - x) < 0.0001) {
        break;
      }
      if (currentX > x) {
        upperBound = t;
      } else {
        lowerBound = t;
      }
      t = (lowerBound + upperBound) / 2;
    }

    return sampleCurveY(AppUtils.clampNumber(t, 0, 1));
  }

  protected override isActivityRateBlinking(row: AppTypes.ActivityListRow): boolean {
    const until = this.activityRateBlinkUntilByRowId[row.id] ?? 0;
    return until > Date.now();
  }

  private triggerActivityRateBlinks(rowId: string, onStart?: () => void): void {
    const durationMs = 420;
    const existingTimer = this.activityRateBlinkTimeoutByRowId[rowId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    delete this.activityRateBlinkUntilByRowId[rowId];
    this.cdr.markForCheck();

    const startBlink = () => {
      this.activityRateBlinkUntilByRowId[rowId] = Date.now() + durationMs;
      onStart?.();
      this.cdr.markForCheck();
      this.activityRateBlinkTimeoutByRowId[rowId] = setTimeout(() => {
        if ((this.activityRateBlinkUntilByRowId[rowId] ?? 0) <= Date.now()) {
          delete this.activityRateBlinkUntilByRowId[rowId];
        }
        const timer = this.activityRateBlinkTimeoutByRowId[rowId];
        if (timer) {
          clearTimeout(timer);
        }
        delete this.activityRateBlinkTimeoutByRowId[rowId];
        this.cdr.markForCheck();
      }, durationMs + 32);
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }

  protected override isActivitiesRatesFullscreenReadOnlyNavigation(): boolean {
    return this.isRatesFullscreenModeActive() && this.activitiesRateFilter === 'pair-received';
  }

  protected override currentActivitiesRatesFullscreenRow(): AppTypes.ActivityListRow | null {
    if (!this.isRatesFullscreenModeActive()) {
      return null;
    }
    const smartListRow = this.activitiesSmartList?.cursorItem();
    if (smartListRow?.type === 'rates') {
      return smartListRow;
    }
    return null;
  }

  protected toggleActivitiesRatesFullscreenMode(event: Event): void {
    event.stopPropagation();
    if (!this.shouldShowRatesFullscreenToggle()) {
      return;
    }
    if (this.activitiesRatesFullscreenMode) {
      this.disableActivitiesRatesFullscreenMode();
      return;
    }
    this.resetActivityRateEditorStateForFullscreenEntry();
    this.activitiesRatesFullscreenMode = true;
    this.activitiesContext.setActivitiesRatesFullscreenMode(true);
    this.runAfterActivitiesRender(() => {
      this.syncActivitiesRatesFullscreenSelection();
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  protected disableActivitiesRatesFullscreenMode(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const selectedRateId = this.selectedActivityRateId;
    this.activitiesRatesFullscreenMode = false;
    this.activityRateEditorClosing = false;
    this.lastActivityRateEditorLiftDelta = 0;
    this.lastRateIndicatorPulseRowId = null;
    this.activitiesContext.setActivitiesRatesFullscreenMode(false);
    this.activitiesContext.setActivitiesSelectedRateId(this.selectedActivityRateId);
    this.cdr.markForCheck();
    if (!selectedRateId) {
      return;
    }
    this.runAfterActivitiesRender(() => {
      this.syncActivitiesRatesListPositionToRow(selectedRateId);
      this.smoothRevealSelectedRateRowWhenNeeded(selectedRateId);
    });
  }

  protected override syncActivitiesRatesFullscreenSelection(): void {
    if (!this.activitiesRatesFullscreenMode) {
      return;
    }
    const currentRow = this.currentActivitiesRatesFullscreenRow();
    if (!currentRow) {
      this.selectedActivityRateId = null;
      this.activitiesContext.setActivitiesSelectedRateId(null);
      return;
    }
    this.selectedActivityRateId = currentRow.id;
    this.activitiesContext.setActivitiesSelectedRateId(this.selectedActivityRateId);
  }

  private resetActivityRateEditorStateForFullscreenEntry(): void {
    this.cancelActivityRateEditorCloseTransition();
    this.cancelActivityRateEditorLiftAnimation();
    this.activityRateEditorClosing = false;
    this.activityRateEditorOpenScrollTop = null;
    this.lastActivityRateEditorLiftDelta = 0;
    this.lastRateIndicatorPulseRowId = null;
    if (!this.selectedActivityRateId) {
      return;
    }
    this.selectedActivityRateId = null;
    this.activitiesContext.setActivitiesSelectedRateId(null);
  }

  private syncActivitiesRatesListPositionToRow(rowId: string): void {
    const scrollElement = this.activitiesListScrollElement();
    if (!scrollElement) {
      return;
    }
    const targetRow = scrollElement.querySelector<HTMLElement>(`[data-activity-rate-row-id="${rowId}"]`);
    if (!targetRow) {
      return;
    }
    const stickyHeaderHeight = scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0;
    const targetTop = Math.max(0, targetRow.offsetTop - stickyHeaderHeight - (this.isMobileView ? 4 : 6));
    if (Math.abs(scrollElement.scrollTop - targetTop) <= 1) {
      return;
    }
    const previousSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    scrollElement.scrollTop = targetTop;
    const releaseSnap = () => {
      scrollElement.style.scrollSnapType = previousSnapType;
      this.cdr.markForCheck();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => releaseSnap());
      return;
    }
    setTimeout(releaseSnap, 0);
  }

  protected override matchesRateFilter(item: RateMenuItem, filter: AppTypes.RateFilterKey): boolean {
    const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
    if (item.mode !== modeKey || this.displayedRateDirection(item) !== directionKey) {
      return false;
    }
    if (!this.activitiesRateSocialBadgeEnabled || modeKey !== 'pair') {
      return true;
    }
    if (filter === 'pair-given') {
      return item.socialContext === 'separated-friends';
    }
    if (filter === 'pair-received') {
      return item.socialContext === 'friends-in-common';
    }
    return true;
  }

  protected override displayedRateDirection(item: RateMenuItem): RateMenuItem['direction'] {
    return this.activityRateDirectionOverrideById[item.id] ?? item.direction;
  }

  private pendingDirectionAfterRating(item: RateMenuItem): RateMenuItem['direction'] | null {
    const direction = this.displayedRateDirection(item);
    if (item.mode === 'individual') {
      if (direction === 'given') {
        return item.scoreReceived > 0 ? 'mutual' : 'given';
      }
      if (direction === 'received') {
        return 'mutual';
      }
      return null;
    }
    if (direction === 'received' || direction === 'met') {
      return 'given';
    }
    return null;
  }

  protected override commitPendingRateDirectionOverrides(targetFilter?: AppTypes.RateFilterKey): void {
    const target = targetFilter ? this.parseRateFilterKey(targetFilter) : null;
    for (const [itemId, pendingDirection] of Object.entries(this.pendingActivityRateDirectionOverrideById)) {
      if (!pendingDirection) {
        continue;
      }
      if (target) {
        const item = this.rateItems.find(candidate => candidate.id === itemId);
        if (!item) {
          continue;
        }
        if (item.mode !== target.mode || pendingDirection !== target.direction) {
          continue;
        }
      }
      this.activityRateDirectionOverrideById[itemId] = pendingDirection;
      delete this.pendingActivityRateDirectionOverrideById[itemId];
    }
  }

  private parseRateFilterKey(filter: AppTypes.RateFilterKey): { mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] } {
    const [mode, direction] = filter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
    return { mode, direction };
  }

  protected override selectedActivityRateRow(): AppTypes.ActivityListRow | null {
    if (!this.selectedActivityRateId) {
      return null;
    }
    return this.filteredActivityRows.find(row => row.type === 'rates' && row.id === this.selectedActivityRateId) ?? null;
  }

  protected override normalizeRateScore(value: number): number {
    return Math.min(10, Math.max(1, Math.round(value)));
  }

  protected override rateOwnScore(item: RateMenuItem): number {
    if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
      return this.normalizeRateScore(item.scoreGiven);
    }
    return 5;
  }

  protected override hasOwnRating(item: RateMenuItem): boolean {
    const drafted = this.activityRateDraftById[item.id];
    if (Number.isFinite(drafted) && drafted > 0) {
      return true;
    }
    if (this.displayedRateDirection(item) === 'received') {
      return false;
    }
    return Number.isFinite(item.scoreGiven) && item.scoreGiven > 0;
  }

  protected override pairReceivedAverageScore(item: RateMenuItem): number {
    const matching = this.rateItems.filter(candidate =>
      candidate.mode === 'pair' &&
      this.samePairUsers(candidate, item) &&
      this.displayedRateDirection(candidate) === 'received' &&
      Number.isFinite(candidate.scoreReceived) &&
      candidate.scoreReceived > 0
    );
    if (matching.length === 0) {
      return 0;
    }
    const total = matching.reduce((sum, candidate) => sum + candidate.scoreReceived, 0);
    return this.normalizeRateScore(total / matching.length);
  }

  private samePairUsers(left: RateMenuItem, right: RateMenuItem): boolean {
    const leftIds = [left.userId, left.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
    const rightIds = [right.userId, right.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
    return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
  }
}
