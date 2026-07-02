
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';

import type { ActivityRateDTO } from '../../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import {
  type AppMenuItemSelectEvent,
  type AppMenuItem,
  type CardMenuRequestEvent,
  PairCardComponent,
  type CardProfileViewData,
  type AppMenuRateConfig,
  SingleCardComponent,
  type CardBadgeConfig,
  type ImageCardData,
  type PairCardData,
  type SmartListItemMenuRequest,
  type SingleCardData
} from '../../../../../shared/ui';
import {
  ActivityRatePairCardConverter,
  ActivityRateSingleCardConverter,
  ActivityRateMenuConverter,
  ActivityRateMenuSelectionConverter,
  isActivityRatePairCardRow
} from '../../../../../shared/ui/converters';
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
  isActivitiesPairReceivedRateItem,
  matchesActivitiesRateFilter,
  normalizeActivitiesRateScore,
  pendingActivitiesRateDirectionAfterRating,
  selectedActivitiesRateRow
} from './activities-rate-state.presenter';
export interface ActivitiesRateTemplateContext {
  getActiveUserGender: () => 'woman' | 'man';
  getRateItemById: (itemId: string) => ActivityRateDTO | null;
  getDisplayedDirection: (item: ActivityRateDTO) => ActivityRateDTO['direction'];
  isSelectedActivityRateRow: (row: ImageCardData) => boolean;
  isActivityRateBlinking: (row: ImageCardData) => boolean;
  normalizeRateScore: (value: number) => number;
  hasOwnRating: (item: ActivityRateDTO) => boolean;
  pairReceivedAverageScore: (item: ActivityRateDTO) => number;
  rateOwnScore: (item: ActivityRateDTO) => number;
  getActivityRateMenuItems: (row: ImageCardData) => readonly AppMenuItem<string, unknown>[];
  isFullscreenPaginationAnimating: () => boolean;
}

@Component({
  selector: 'app-activities-rate-template',
  standalone: true,
  imports: [SingleCardComponent, PairCardComponent],
  templateUrl: './activities-rate-template.component.html',
  styleUrl: './activities-rate-template.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesRateTemplateComponent implements OnChanges {
  @Input() row: ImageCardData | null = null;
  @Input() groupLabel: string | null = null;
  @Input() presentation: SingleCardData['presentation'] | PairCardData['presentation'] = 'list';
  @Input() state: SingleCardData['state'] | PairCardData['state'] = 'default';
  @Input() context: ActivitiesRateTemplateContext | null = null;
  @Input() openMenu: ((request: SmartListItemMenuRequest) => void) | null = null;
  @Input() cardRevision: string | number = 0;

  @Output() readonly detailClick = new EventEmitter<CardProfileViewData>();

  protected pairCard: PairCardData | null = null;
  protected singleCard: SingleCardData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['row']
      || changes['groupLabel']
      || changes['presentation']
      || changes['state']
      || changes['context']
      || changes['cardRevision']
    ) {
      this.rebuildCards();
    }
  }

  protected onMenuRequest(event: CardMenuRequestEvent<SingleCardData | PairCardData>): void {
    const row = this.row;
    const context = this.context;
    if (!row || !context || !this.openMenu) {
      return;
    }
    const items = context.getActivityRateMenuItems(row);
    if (items.length === 0) {
      return;
    }
    this.openMenu({
      id: row.id,
      kind: 'select',
      items,
      triggerRect: event.triggerRect,
      openUp: false,
      panelMode: 'dock',
      closeOnSelect: true,
      closeTrigger: event.closeTrigger
    });
  }

  protected onDetailClick(event: CardProfileViewData): void {
    this.detailClick.emit(event);
  }

  private rebuildCards(): void {
    const row = this.row;
    const context = this.context;
    if (!row || !context) {
      this.pairCard = null;
      this.singleCard = null;
      return;
    }

    const sharedOptions = {
      groupLabel: this.groupLabel,
      presentation: this.presentation,
      state: this.state,
      displayedDirection: this.displayedDirectionForRow(row, context),
      activeUserGender: context.getActiveUserGender(),
      fullscreenSplitEnabled: !context.isFullscreenPaginationAnimating()
    } as const;

    if (isActivityRatePairCardRow(row)) {
      this.pairCard = ActivityRatePairCardConverter.convert(row, {
        ...sharedOptions,
        badge: this.activityRateBadgeConfig(row, context, {
          layout: this.presentation === 'fullscreen' ? 'pair-overlap' : 'between',
          interactive: this.presentation !== 'fullscreen',
          forceActive: this.presentation === 'fullscreen'
        })
      });
      this.singleCard = null;
      return;
    }

    this.singleCard = ActivityRateSingleCardConverter.convert(row, {
      ...sharedOptions,
      badge: this.activityRateBadgeConfig(row, context, {
        layout: 'floating',
        interactive: this.presentation !== 'fullscreen',
        forceActive: this.presentation === 'fullscreen'
      })
    });
    this.pairCard = null;
  }

  private isPairReceivedRateRow(row: ImageCardData, context: ActivitiesRateTemplateContext): boolean {
    const rate = this.rateItemForRow(row, context);
    if (rate) {
      return rate.mode === 'pair' && context.getDisplayedDirection(rate) === 'received';
    }
    return row.mode === 'pair' && this.displayedDirectionForRow(row, context) === 'received';
  }

  private activityRateBadgeConfig(
    row: ImageCardData,
    context: ActivitiesRateTemplateContext,
    options?: {
      layout?: CardBadgeConfig['layout'];
      interactive?: boolean;
      forceActive?: boolean;
    }
  ): CardBadgeConfig {
    return {
      label: this.activityRateBadgeLabel(row, context),
      ariaLabel: this.activityRateBadgeAriaLabel(row, context),
      active: options?.forceActive ? true : context.isSelectedActivityRateRow(row),
      pending: this.isActivityRatePending(row, context),
      disabled: this.isPairReceivedRateRow(row, context),
      blink: context.isActivityRateBlinking(row),
      interactive: options?.interactive ?? true,
      menuRequest: options?.interactive ?? true,
      layout: options?.layout ?? 'floating'
    };
  }

  private activityOwnRatingValue(row: ImageCardData, context: ActivitiesRateTemplateContext): number {
    const item = this.rateItemForRow(row, context);
    if (!item) {
      return Number.isFinite(row.scoreGiven) ? context.normalizeRateScore(Number(row.scoreGiven)) : 0;
    }
    if (!context.hasOwnRating(item)) {
      if (context.getDisplayedDirection(item) === 'received' && item.mode === 'pair') {
        return context.pairReceivedAverageScore(item);
      }
      return 0;
    }
    return context.rateOwnScore(item);
  }

  private activityOwnRatingLabel(row: ImageCardData, context: ActivitiesRateTemplateContext): string {
    const value = this.activityOwnRatingValue(row, context);
    return value > 0 ? `${value}` : '';
  }

  private isActivityRatePending(row: ImageCardData, context: ActivitiesRateTemplateContext): boolean {
    const item = this.rateItemForRow(row, context);
    if (!item) {
      return false;
    }
    if (context.getDisplayedDirection(item) === 'met') {
      return false;
    }
    if (!context.hasOwnRating(item) && context.getDisplayedDirection(item) === 'received' && item.mode === 'pair') {
      return context.pairReceivedAverageScore(item) <= 0;
    }
    return !context.hasOwnRating(item);
  }

  private activityRateBadgeLabel(row: ImageCardData, context: ActivitiesRateTemplateContext): string {
    const ownLabel = this.activityOwnRatingLabel(row, context);
    return ownLabel ? ownLabel : 'Rate';
  }

  private activityRateBadgeAriaLabel(row: ImageCardData, context: ActivitiesRateTemplateContext): string {
    if (this.isPairReceivedRateRow(row, context)) {
      return 'Received pair rating';
    }
    return this.isActivityRatePending(row, context) ? 'Add your rating' : 'Edit your rating';
  }

  private rateItemForRow(row: ImageCardData, context: ActivitiesRateTemplateContext): ActivityRateDTO | null {
    return context.getRateItemById(row.id);
  }

  private displayedDirectionForRow(
    row: ImageCardData,
    context: ActivitiesRateTemplateContext
  ): ActivityRateDTO['direction'] {
    const item = this.rateItemForRow(row, context);
    if (item) {
      return context.getDisplayedDirection(item);
    }
    if (row.displayedDirection === 'received' || row.displayedDirection === 'mutual' || row.displayedDirection === 'met') {
      return row.displayedDirection;
    }
    if (row.direction === 'received' || row.direction === 'mutual' || row.direction === 'met') {
      return row.direction;
    }
    return 'given';
  }
}

interface ActivitiesRatesControllerDeps {
  getActiveUserGender: () => 'woman' | 'man';
  getActivitiesPrimaryFilter: () => ContractTypes.ActivitiesPrimaryFilter;
  getActivitiesRateFilter: () => ContractTypes.RateFilterKey;
  getActivitiesRateSocialBadgeEnabled: () => boolean;
  getActivitiesRateSocialBadgeEnabledForFilter: (filter: ContractTypes.RateFilterKey) => boolean;
  getFilteredActivityRows: () => readonly ImageCardData[];
  getRateItems: () => readonly ActivityRateDTO[];
  getSmartListCursorItem: () => ImageCardData | null;
  getActivitiesListScrollElement: () => HTMLElement | null;
  getPaginationMenuHeight: () => number;
  isPaginationMenuTarget: (target: EventTarget | null | undefined) => boolean;
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
  setSelectedRateIdInContext: (value: string | null) => void;
  setFullscreenModeInContext: (value: boolean) => void;
  recordActivityRate: (item: ActivityRateDTO, score: number, direction: ActivityRateDTO['direction']) => void;
  syncVisibleRateItem: (item: ActivityRateDTO) => void;
  refreshRateCards: (rowId?: string | null) => void;
  markForCheck: () => void;
  runAfterNextPaint: (task: () => void) => void;
  runAfterRender: (task: () => void) => void;
}

export class ActivitiesRatesController {
  private static readonly SCORE_SELECTION_DOCK_GUARD_MS = 220;
  private static readonly EDITOR_DOCK_VISIBILITY_HOLD_MS = 120;
  private ratingBarBlinkTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRatingBarBlinking = false;

  readonly templateContext: ActivitiesRateTemplateContext = {
    getActiveUserGender: () => this.deps.getActiveUserGender(),
    getRateItemById: itemId => this.rateItemById(itemId),
    getDisplayedDirection: item => this.displayedDirection(item),
    isSelectedActivityRateRow: row => this.isSelectedRow(row),
    isActivityRateBlinking: row => this.isBlinking(row),
    normalizeRateScore: value => this.normalizeScore(value),
    hasOwnRating: item => this.hasOwnRating(item),
    pairReceivedAverageScore: item => this.pairReceivedAverageScore(item),
    rateOwnScore: item => this.rateOwnScore(item),
    getActivityRateMenuItems: row => this.activityRateMenuItems(row),
    isFullscreenPaginationAnimating: () => this.deps.isFullscreenPaginationAnimating()
  };

  private readonly rateEditorPresenter: ActivitiesRateEditorPresenter;
  private selectedListRateRow: ImageCardData | null = null;
  private suppressDockCloseUntilMs = 0;
  private dockVisibilityHoldUntilMs = 0;
  private dockVisibilityHoldTimer: ReturnType<typeof setTimeout> | null = null;

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

  ratingBarConfig(): AppMenuRateConfig {
    return {
      ...this.rateEditorPresenter.barConfig(),
      blinkOnSelect: false,
      animation: this.isRatingBarBlinking ? 'blink' : 'default'
    };
  }

  ratingMenuConfig(row: ImageCardData): AppMenuRateConfig {
    const modeLabel = row.mode === 'pair' ? 'Pair' : 'Single';
    return {
      scale: this.deps.getRatingScale(),
      value: this.ownRatingValue(row),
      readonly: this.isPairReceivedRow(row),
      label: `Affinity · ${modeLabel} · ${row.title || 'Rate'}`,
      actionLabel: 'save',
      blinkOnSelect: false,
      animation: this.isRatingBarBlinking ? 'blink' : 'default',
      dock: null
    };
  }

  activityRateMenuItems(row: ImageCardData): readonly AppMenuItem<string, unknown>[] {
    if (this.isPairReceivedRow(row)) {
      return [];
    }
    return ActivityRateMenuConverter.convert({
      menu: 'activity-rate-card',
      id: row.id,
      value: this.ownRatingValue(row),
      ratingBarConfig: this.ratingMenuConfig(row)
    });
  }

  handleMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): boolean {
    const selection = ActivityRateMenuSelectionConverter.convert(event);
    if (!selection) {
      return false;
    }
    this.setOwnRatingForRowId(selection.rowId, selection.value);
    return true;
  }

  ratingBarValue(): number {
    return this.rateEditorPresenter.selectedValue();
  }

  openEditor(row: ImageCardData, event?: Event): void {
    event?.stopPropagation();
    if (this.isPairReceivedRow(row)) {
      return;
    }
    this.cancelEditorCloseTransition();
    this.cancelDockVisibilityHold();
    const wasOpen = this.isEditorOpen();
    if (this.selectedRateId() === row.id) {
      if (this.isSuppressingDockClose()) {
        return;
      }
      this.clearEditorState();
      return;
    }
    const scrollElement = this.deps.getActivitiesListScrollElement();
    if (!wasOpen) {
      this.deps.setEditorOpenScrollTop(scrollElement ? scrollElement.scrollTop : null);
    }
    this.selectedListRateRow = row;
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

  closeEditorFromUserScroll(event?: Event): void {
    const target = event?.target;
    if (this.deps.isPaginationMenuTarget(target)) {
      return;
    }
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
      && (!!this.selectedRateId() || this.isEditorClosing() || this.isHoldingDockVisibility());
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
    if (this.isSuppressingDockClose()) {
      return false;
    }
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

  isSelectedRow(row: ImageCardData): boolean {
    return this.isEditorOpen() && this.selectedRateId() === row.id;
  }

  setSelectedOwnRating(score: number): void {
    const row = this.isFullscreenModeActive()
      ? this.currentFullscreenRow()
      : this.selectedRow();
    if (!row) {
      return;
    }
    this.recordOwnRatingForRow(row, score, true);
  }

  setOwnRatingForRowId(rowId: string, score: number): void {
    const normalizedRowId = rowId.trim();
    if (!normalizedRowId) {
      return;
    }
    const row = selectedActivitiesRateRow(normalizedRowId, this.deps.getFilteredActivityRows())
      ?? (this.selectedListRateRow?.id === normalizedRowId ? this.selectedListRateRow : null);
    if (!row) {
      return;
    }
    this.recordOwnRatingForRow(row, score, false);
  }

  private recordOwnRatingForRow(
    row: ImageCardData,
    score: number,
    syncSelectedEditor: boolean
  ): void {
    if (this.isPairReceivedRow(row)) {
      return;
    }
    const rateItem = this.rateItemForRow(row);
    if (!rateItem) {
      return;
    }
    const normalized = this.normalizeScore(score);
    if (syncSelectedEditor) {
      this.holdDockOpenForScoreSelection();
      this.setSelectedRateId(row.id);
    }
    const nextDirection = this.pendingDirectionAfterRating(rateItem);
    this.deps.recordActivityRate(
      rateItem,
      normalized,
      nextDirection ?? rateItem.direction
    );
    const syncedRateItem = this.rateItemById(rateItem.id) ?? {
      ...rateItem,
      direction: nextDirection ?? rateItem.direction,
      scoreGiven: normalized
    };
    this.deps.syncVisibleRateItem(syncedRateItem);
    this.refreshRateCards(row.id);
    this.triggerRatingBarBlink();
    this.triggerBlinks(row.id);
    if (syncSelectedEditor) {
      this.closeEditorAfterScoreCommit();
    }
  }

  clearEditorState(preserveScrollPosition = true): void {
    if (this.isFullscreenModeActive()) {
      return;
    }
    if (this.isSuppressingDockClose()) {
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
      this.holdDockVisibilityAfterClose();
      this.setSelectedRateId(null);
      this.selectedListRateRow = null;
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

  isBlinking(row: ImageCardData): boolean {
    return isActivitiesRateBlinking(row, this.deps.getActivityRateBlinkUntilByRowId());
  }

  isFullscreenReadOnlyNavigation(): boolean {
    return this.isFullscreenModeActive() && this.deps.getActivitiesRateFilter() === 'pair-received';
  }

  currentFullscreenRow(): ImageCardData | null {
    if (!this.isFullscreenModeActive()) {
      return null;
    }
    return this.deps.getSmartListCursorItem();
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
    this.deps.runAfterNextPaint(() => {
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
    this.deps.runAfterNextPaint(() => {
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
      this.selectedListRateRow = null;
      this.setSelectedRateId(null);
      return;
    }
    this.selectedListRateRow = currentRow;
    this.setSelectedRateId(currentRow.id);
  }

  matchesFilter(item: ActivityRateDTO, filter: ContractTypes.RateFilterKey): boolean {
    return matchesActivitiesRateFilter(
      item,
      filter,
      this.deps.getActivitiesRateSocialBadgeEnabledForFilter(filter)
    );
  }

  displayedDirection(item: ActivityRateDTO): ActivityRateDTO['direction'] {
    return item.direction;
  }

  selectedRow(): ImageCardData | null {
    const selectedRateId = this.selectedRateId();
    const fromVisibleRows = selectedActivitiesRateRow(selectedRateId, this.deps.getFilteredActivityRows());
    if (fromVisibleRows) {
      this.selectedListRateRow = fromVisibleRows;
      return fromVisibleRows;
    }
    return this.selectedListRateRow && this.selectedListRateRow.id === selectedRateId
      ? this.selectedListRateRow
      : null;
  }

  normalizeScore(value: number): number {
    return normalizeActivitiesRateScore(value);
  }

  rateOwnScore(item: ActivityRateDTO): number {
    return activitiesRateOwnScore(item);
  }

  hasOwnRating(item: ActivityRateDTO): boolean {
    return activitiesRateHasOwnRating(item);
  }

  pairReceivedAverageScore(item: ActivityRateDTO): number {
    return activitiesPairReceivedAverageScore(
      item,
      this.deps.getRateItems()
    );
  }

  isPairReceivedRow(row: ImageCardData): boolean {
    const item = this.rateItemForRow(row);
    return item ? isActivitiesPairReceivedRateItem(item) : false;
  }

  ownRatingValue(row: ImageCardData): number {
    return activitiesRateOwnRatingValue(
      this.rateItemForRow(row),
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

  private holdDockOpenForScoreSelection(): void {
    this.suppressDockCloseUntilMs = Date.now() + ActivitiesRatesController.SCORE_SELECTION_DOCK_GUARD_MS;
    this.cancelEditorCloseTransition();
    this.cancelDockVisibilityHold();
    this.deps.setEditorClosing(false);
  }

  private isSuppressingDockClose(): boolean {
    return Date.now() < this.suppressDockCloseUntilMs;
  }

  private holdDockVisibilityAfterClose(): void {
    this.cancelDockVisibilityHold();
    this.dockVisibilityHoldUntilMs = Date.now() + ActivitiesRatesController.EDITOR_DOCK_VISIBILITY_HOLD_MS;
    this.dockVisibilityHoldTimer = setTimeout(() => {
      this.dockVisibilityHoldTimer = null;
      this.dockVisibilityHoldUntilMs = 0;
      this.deps.markForCheck();
    }, ActivitiesRatesController.EDITOR_DOCK_VISIBILITY_HOLD_MS);
  }

  private cancelDockVisibilityHold(): void {
    this.dockVisibilityHoldUntilMs = 0;
    if (!this.dockVisibilityHoldTimer) {
      return;
    }
    clearTimeout(this.dockVisibilityHoldTimer);
    this.dockVisibilityHoldTimer = null;
  }

  private isHoldingDockVisibility(): boolean {
    return Date.now() < this.dockVisibilityHoldUntilMs;
  }

  private closeEditorAfterScoreCommit(): void {
    if (this.isFullscreenModeActive()) {
      return;
    }
    this.suppressDockCloseUntilMs = 0;
    this.clearEditorState(true);
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
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowBottom = (sameRowCards.length > 0 ? sameRowCards : [targetRow]).reduce((maxBottom, card) => {
      return Math.max(maxBottom, card.getBoundingClientRect().bottom);
    }, targetRow.getBoundingClientRect().bottom);
    const dockHeight = Math.max(72, this.deps.getPaginationMenuHeight() || 72);
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

  private pendingDirectionAfterRating(item: ActivityRateDTO): ActivityRateDTO['direction'] | null {
    return pendingActivitiesRateDirectionAfterRating(item);
  }

  private resetEditorStateForFullscreenEntry(): void {
    this.cancelEditorCloseTransition();
    this.cancelDockVisibilityHold();
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
    const previousValue = this.deps.getSelectedRateId();
    if (!value) {
      this.selectedListRateRow = null;
    }
    if (previousValue === value) {
      return;
    }
    this.deps.setSelectedRateId(value);
    this.deps.setSelectedRateIdInContext(value);
    this.refreshRateCards();
  }

  private rateItemForRow(row: ImageCardData): ActivityRateDTO | null {
    return this.rateItemById(row.id);
  }

  private rateItemById(itemId: string): ActivityRateDTO | null {
    const normalizedId = itemId.trim();
    if (!normalizedId) {
      return null;
    }
    return this.deps.getRateItems().find(item => item.id === normalizedId) ?? null;
  }

  private setFullscreenMode(value: boolean): void {
    if (this.deps.getFullscreenMode() === value) {
      return;
    }
    this.deps.setFullscreenMode(value);
    this.deps.setFullscreenModeInContext(value);
    this.refreshRateCards();
  }

  private refreshRateCards(rowId?: string | null): void {
    this.deps.refreshRateCards(rowId);
  }

  private triggerRatingBarBlink(): void {
    if (this.ratingBarBlinkTimeout) {
      clearTimeout(this.ratingBarBlinkTimeout);
      this.ratingBarBlinkTimeout = null;
    }
    this.isRatingBarBlinking = false;
    this.deps.markForCheck();
    const startBlink = () => {
      this.isRatingBarBlinking = true;
      this.deps.markForCheck();
      this.ratingBarBlinkTimeout = setTimeout(() => {
        this.isRatingBarBlinking = false;
        this.ratingBarBlinkTimeout = null;
        this.deps.markForCheck();
      }, 420);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }

}
