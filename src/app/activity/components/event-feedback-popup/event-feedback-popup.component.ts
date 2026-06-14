import { Component, ElementRef, OnDestroy, TemplateRef, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';

import {
  AppMenuComponent,
  AppContext,
  EventFeedbackDeckConverter,
  EventFeedbackInfoCardConverter,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type EventFeedbackInfoCardData,
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuActionEvent,
  type InfoCardResolvedMenuAction,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import type { EventFeedbackListFilter } from '../../../shared/core/common/constants';
import { EventFeedbackPopupStateService, type EventFeedbackListFilters } from '../../services/event-feedback-popup-state.service';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';

type EventFeedbackMenuContext = {
  menu: 'filter';
  filter: EventFeedbackListFilter;
} | {
  menu: 'info-card';
  item: AppTypes.EventFeedbackEventCard | null;
  card: EventFeedbackInfoCardData;
  action: InfoCardResolvedMenuAction;
};

interface OrganizerEventFeedbackCarouselStatItem {
  key: string;
  label: string;
  icon: string;
  count: number;
}

interface OrganizerEventFeedbackCarouselSection {
  key: string;
  label: string;
  icon: string;
  subtitle: string;
  toneClass: string;
  topLabel: string;
  topCount: number;
  optionCount: number;
  responseCount: number;
  progressPercent: number;
  items: OrganizerEventFeedbackCarouselStatItem[];
}

@Component({
  selector: 'app-event-feedback-popup',
  standalone: true,
  host: {
    '(window:resize)': 'onViewportResize()'
  },
  imports: [
    CommonModule,
    FormsModule,
    MatRippleModule,
    MatIconModule,
    MatButtonModule,
    AppMenuComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent implements OnDestroy {
  public readonly feedback = inject(EventFeedbackPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private eventFeedbackViewportScrollLockTargetIndex: number | null = null;
  private eventFeedbackViewportScrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private eventFeedbackSurfaceSwipePointerId: number | null = null;
  private eventFeedbackSurfaceSwipeStartX = 0;
  private eventFeedbackSurfaceSwipeStartY = 0;
  private eventFeedbackSurfaceSwipeStartScrollLeft = 0;
  private eventFeedbackSurfaceSwipeActive = false;

  protected readonly isMobileEventFeedbackViewport = signal(this.readViewportWidth() <= 720);
  protected readonly eventFeedbackPendingIndicatorIndex = signal<number | null>(null);
  protected readonly organizerEventFeedbackCarouselIndex = signal(0);
  protected readonly organizerEventFeedbackCarouselSections = computed<OrganizerEventFeedbackCarouselSection[]>(() => {
    const totalEntries = this.feedback.selectedOrganizerEventFeedbackEntries().length;
    const buildSection = (
      key: string,
      label: string,
      icon: string,
      subtitle: string,
      toneClass: string,
      items: readonly { key: string; label: string; icon: string; count: number }[]
    ): OrganizerEventFeedbackCarouselSection | null => {
      if (items.length === 0) {
        return null;
      }
      const topItem = items[0];
      const topCount = Math.max(0, topItem?.count ?? 0);
      const progressPercent = totalEntries > 0
        ? Math.max(8, Math.min(100, Math.round((topCount / totalEntries) * 100)))
        : 0;
      return {
        key,
        label,
        icon,
        subtitle,
        toneClass,
        topLabel: topItem?.label ?? label,
        topCount,
        optionCount: items.length,
        responseCount: totalEntries,
        progressPercent,
        items: items.map(item => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          count: item.count
        }))
      };
    };

    return [
      buildSection(
        'overall',
        'Overall',
        'sentiment_satisfied',
        'Most selected event impression',
        'event-feedback-organizer-carousel-card-tone-overall',
        this.feedback.organizerEventFeedbackOverallStats()
      ),
      buildSection(
        'improve',
        'Improve Next',
        'campaign',
        'Most requested improvement next time',
        'event-feedback-organizer-carousel-card-tone-improve',
        this.feedback.organizerEventFeedbackImproveStats()
      ),
      buildSection(
        'traits',
        'Host Traits',
        'groups',
        'Traits attendees mentioned most',
        'event-feedback-organizer-carousel-card-tone-traits',
        this.feedback.organizerEventFeedbackTraitStats()
      )
    ].filter((section): section is OrganizerEventFeedbackCarouselSection => section !== null);
  });
  protected readonly organizerEventFeedbackActiveCarouselSection = computed<OrganizerEventFeedbackCarouselSection | null>(() => {
    const sections = this.organizerEventFeedbackCarouselSections();
    if (sections.length === 0) {
      return null;
    }
    return sections[this.organizerEventFeedbackCarouselIndex()] ?? sections[0] ?? null;
  });

  protected eventFeedbackSmartListQuery: Partial<ListQuery<EventFeedbackListFilters>> = {
    filters: {
      filter: 'pending',
      userId: ''
    }
  };

  protected eventFeedbackItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<EventFeedbackInfoCardData, EventFeedbackListFilters>
  >;

  @ViewChild('eventFeedbackItemTemplate', { read: TemplateRef })
  private set eventFeedbackItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<EventFeedbackInfoCardData, EventFeedbackListFilters>> | undefined
  ) {
    this.eventFeedbackItemTemplateRef = value;
  }

  @ViewChild('eventFeedbackViewport')
  private eventFeedbackViewportRef?: ElementRef<HTMLDivElement>;

  @ViewChild('eventFeedbackSmartList')
  private eventFeedbackSmartList?: SmartListComponent<EventFeedbackInfoCardData, EventFeedbackListFilters>;

  protected readonly eventFeedbackSmartListLoadPage: SmartListLoadPage<
    EventFeedbackInfoCardData,
    EventFeedbackListFilters
  > = (query) => from(this.feedback.loadEventFeedbackPage(query));

  protected readonly eventFeedbackSmartListConfig: SmartListConfig<
    EventFeedbackInfoCardData,
    EventFeedbackListFilters
  > = {
    pageSize: 12,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'Event Feedback',
    emptyDescription: (query) => this.eventFeedbackEmptyDescription(query.filters?.filter ?? 'pending'),
    showStickyHeader: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: (item, query) => this.eventFeedbackGroupLabel(item, query.filters?.filter ?? this.feedback.eventFeedbackListFilter()),
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    stickyHeaderClass: 'event-feedback-sticky-header',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'event-feedback-event-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected eventFeedbackFilterMenuTrigger(): AppMenuTrigger {
    const filter = this.feedback.eventFeedbackListFilter();
    const count = this.feedback.eventFeedbackFilterCount(filter);
    return {
      label: this.feedback.eventFeedbackFilterLabel(),
      icon: this.feedback.eventFeedbackFilterIcon(),
      ariaLabel: 'Open event feedback filter',
      palette: this.eventFeedbackFilterPalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      shape: 'pill'
    };
  }

  protected eventFeedbackFilterMenuItems(): readonly AppMenuItem<string, EventFeedbackMenuContext>[] {
    const active = this.feedback.eventFeedbackListFilter();
    return this.feedback.eventFeedbackListFilters.map(option => {
      const count = this.feedback.eventFeedbackFilterCount(option.key);
      return {
        id: `feedback-filter-${option.key}`,
        label: option.label,
        icon: option.icon,
        kind: 'radio',
        active: option.key === active,
        checked: option.key === active,
        palette: this.eventFeedbackFilterPalette(option.key),
        surface: 'tinted',
        counter: count > 0 ? { value: count, max: 99 } : null,
        context: { menu: 'filter', filter: option.key }
      };
    });
  }

  protected onEventFeedbackMenuSelect(event: AppMenuItemSelectEvent<string, EventFeedbackMenuContext>): void {
    if (event.context?.menu !== 'filter') {
      return;
    }
    this.feedback.selectEventFeedbackListFilter(event.context.filter, event.sourceEvent);
  }

  protected onEventFeedbackDispatchedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventFeedbackMenuContext | undefined;
    if (context?.menu !== 'info-card') {
      return;
    }
    if (!context.item) {
      return;
    }
    this.onEventFeedbackCardMenuAction(context.item, {
      id: context.card.id,
      actionId: context.action.id,
      action: context.action,
      card: context.card
    });
  }

  private eventFeedbackFilterPalette(filter: EventFeedbackListFilter): AppMenuPalette {
    switch (filter) {
      case 'feedbacked':
        return 'green';
      case 'removed':
        return 'slate';
      case 'own-events':
        return 'violet';
      default:
        return 'amber';
    }
  }

  constructor() {
    effect(() => {
      const filter = this.feedback.eventFeedbackListFilter();
      const userId = this.appCtx.activeUserId().trim();
      const currentFilters = this.eventFeedbackSmartListQuery.filters;
      if (currentFilters?.filter === filter && currentFilters?.userId === userId) {
        return;
      }

      this.eventFeedbackSmartListQuery = {
        filters: {
          filter,
          userId
        }
      };
    });

    effect(() => {
      const isFeedbackPopupOpen = this.feedback.isStackedPopupOpen() && this.feedback.stackedPopupMode() === 'eventFeedback';
      const isMobileViewport = this.isMobileEventFeedbackViewport();
      const cardCount = this.feedback.eventFeedbackCards().length;

      if (!isFeedbackPopupOpen || !isMobileViewport || cardCount === 0) {
        this.clearEventFeedbackViewportScrollLock();
        return;
      }

      const targetIndex = untracked(() => this.feedback.eventFeedbackIndex());
      this.queueMobileEventFeedbackViewportSync('auto', targetIndex);
    });

    effect(() => {
      const selectedEventId = this.feedback.selectedOrganizerEventFeedbackEventId();
      const stackedMode = this.feedback.stackedPopupMode();
      if (stackedMode !== 'organizerEventFeedback' || !selectedEventId) {
        return;
      }
      this.organizerEventFeedbackCarouselIndex.set(0);
    });

    effect(() => {
      const sections = this.organizerEventFeedbackCarouselSections();
      const currentIndex = this.organizerEventFeedbackCarouselIndex();
      if (sections.length === 0) {
        if (currentIndex !== 0) {
          this.organizerEventFeedbackCarouselIndex.set(0);
        }
        return;
      }
      if (currentIndex >= sections.length) {
        this.organizerEventFeedbackCarouselIndex.set(sections.length - 1);
      }
    });
  }

  protected onEventFeedbackCardPrimaryAction(card: EventFeedbackInfoCardData): void {
    const item = card.eagerDetail ?? null;
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      this.openOrganizerEventFeedback(item.eventId);
      return;
    }
    if (!this.feedback.isEventFeedbackStartAvailable(item)) {
      return;
    }
    this.feedback.startEventFeedback(item);
  }

  protected onEventFeedbackCardMenuAction(item: AppTypes.EventFeedbackEventCard | null, event: InfoCardMenuActionEvent): void {
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      return;
    }
    if (event.actionId === 'startFeedback') {
      this.feedback.startEventFeedback(item);
      return;
    }
    if (event.actionId === 'removeFeedback') {
      this.openRemoveEventFeedbackDialog(item);
      return;
    }
    if (event.actionId === 'restoreFeedback') {
      this.openRestoreEventFeedbackDialog(item);
      return;
    }
    this.feedback.openEventFeedbackNotePopup(item);
  }

  private openRemoveEventFeedbackDialog(item: AppTypes.EventFeedbackEventCard): void {
    this.confirmationDialogService.open({
      title: 'Remove feedback?',
      message: `${item.title} will be moved to Removed without feedback.`,
      warningMessage: 'You can restore it later from the Removed filter.',
      confirmLabel: 'Remove',
      busyConfirmLabel: 'Removing...',
      confirmTone: 'danger',
      failureMessage: 'Unable to remove this feedback item.',
      onConfirm: async () => {
        await this.feedback.removeEventFeedbackItem(item);
        this.removeVisibleEventFeedbackItem(item.eventId);
      }
    });
  }

  private openRestoreEventFeedbackDialog(item: AppTypes.EventFeedbackEventCard): void {
    this.confirmationDialogService.open({
      title: 'Restore feedback?',
      message: `${item.title} will move back to Pending.`,
      confirmLabel: 'Restore',
      busyConfirmLabel: 'Restoring...',
      confirmTone: 'accent',
      failureMessage: 'Unable to restore this feedback item.',
      onConfirm: async () => {
        await this.feedback.restoreRemovedEventFeedbackItem(item);
        this.removeVisibleEventFeedbackItem(item.eventId);
      }
    });
  }

  private removeVisibleEventFeedbackItem(eventId: string): void {
    const smartList = this.eventFeedbackSmartList;
    const normalizedEventId = eventId.trim();
    if (!smartList || !normalizedEventId) {
      return;
    }
    const currentItems = [...smartList.itemsSnapshot()];
    const nextItems = currentItems.filter(item => item.id !== normalizedEventId);
    if (nextItems.length === currentItems.length) {
      return;
    }
    smartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, smartList.totalItemCount() - 1)
    });
  }

  protected eventFeedbackCarouselInfoCard(card: AppTypes.EventFeedbackCard): InfoCardData {
    return EventFeedbackDeckConverter.infoCard(card);
  }

  protected organizerEventFeedbackInfoCard(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }): InfoCardData {
    return EventFeedbackInfoCardConverter.organizerEventFeedbackInfoCard(item);
  }

  protected organizerEventFeedbackDetailInfoCard(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }): InfoCardData {
    return EventFeedbackInfoCardConverter.organizerEventFeedbackDetailInfoCard(item);
  }

  protected openOrganizerEventFeedback(eventId: string): void {
    this.feedback.openOrganizerEventFeedback(eventId);
  }

  protected selectOrganizerEventFeedbackCarousel(index: number): void {
    const sections = this.organizerEventFeedbackCarouselSections();
    if (index < 0 || index >= sections.length) {
      return;
    }
    this.organizerEventFeedbackCarouselIndex.set(index);
  }

  protected onViewportResize(): void {
    const nextIsMobileViewport = this.readViewportWidth() <= 720;
    if (nextIsMobileViewport === this.isMobileEventFeedbackViewport()) {
      return;
    }
    this.isMobileEventFeedbackViewport.set(nextIsMobileViewport);
    if (!nextIsMobileViewport) {
      this.clearEventFeedbackViewportScrollLock();
      this.resetEventFeedbackViewportScroll();
      return;
    }
    this.queueMobileEventFeedbackViewportSync('auto');
  }

  protected previousEventFeedbackSlide(event: Event): void {
    if (this.isMobileEventFeedbackViewport()) {
      event.stopPropagation();
      const currentIndex = this.feedback.eventFeedbackIndex();
      if (currentIndex <= 0) {
        return;
      }
      this.queueMobileEventFeedbackViewportSync('smooth', currentIndex - 1);
      return;
    }
    this.feedback.previousEventFeedbackSlide(event);
  }

  protected nextEventFeedbackSlide(event: Event): void {
    if (this.isMobileEventFeedbackViewport()) {
      event.stopPropagation();
      const currentIndex = this.feedback.eventFeedbackIndex();
      const lastIndex = this.feedback.eventFeedbackCards().length - 1;
      if (currentIndex >= lastIndex) {
        return;
      }
      this.queueMobileEventFeedbackViewportSync('smooth', currentIndex + 1);
      return;
    }
    this.feedback.nextEventFeedbackSlide(event);
  }

  protected selectEventFeedbackSlide(index: number, event: Event): void {
    if (this.isMobileEventFeedbackViewport()) {
      event.stopPropagation();
      const cards = this.feedback.eventFeedbackCards();
      if (index < 0 || index >= cards.length || index === this.feedback.eventFeedbackIndex()) {
        return;
      }
      this.queueMobileEventFeedbackViewportSync('smooth', index);
      return;
    }
    this.feedback.selectEventFeedbackSlide(index, event);
  }

  protected onEventFeedbackViewportScroll(): void {
    if (!this.isMobileEventFeedbackViewport()) {
      return;
    }
    const viewport = this.eventFeedbackViewportRef?.nativeElement;
    if (!viewport) {
      return;
    }
    if (this.eventFeedbackViewportScrollLockTargetIndex !== null) {
      this.scheduleEventFeedbackViewportScrollLockRelease();
      return;
    }
    const nextIndex = this.currentMobileEventFeedbackSlideIndex(viewport);
    if (nextIndex === this.feedback.eventFeedbackIndex()) {
      return;
    }
    this.eventFeedbackPendingIndicatorIndex.set(null);
    this.feedback.eventFeedbackIndex.set(nextIndex);
  }

  protected eventFeedbackVisibleSlideIndex(): number {
    const cards = this.feedback.eventFeedbackCards();
    if (cards.length === 0) {
      return 0;
    }
    const pendingIndex = this.eventFeedbackPendingIndicatorIndex();
    const rawIndex = pendingIndex ?? this.feedback.eventFeedbackIndex();
    return Math.max(0, Math.min(rawIndex, cards.length - 1));
  }

  protected eventFeedbackVisibleSlideCounterLabel(): string {
    const cards = this.feedback.eventFeedbackCards();
    if (cards.length === 0) {
      return '';
    }
    return `${this.eventFeedbackVisibleSlideIndex() + 1} / ${cards.length}`;
  }

  protected isEventFeedbackDotActive(index: number): boolean {
    return this.eventFeedbackVisibleSlideIndex() === index;
  }

  protected beginEventFeedbackSurfaceSwipe(event: PointerEvent): void {
    if (!this.isMobileEventFeedbackViewport() || event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (this.isEventFeedbackInteractiveSwipeTarget(event.target)) {
      return;
    }
    const viewport = this.eventFeedbackViewportRef?.nativeElement;
    if (!viewport) {
      return;
    }
    this.eventFeedbackSurfaceSwipePointerId = event.pointerId;
    this.eventFeedbackSurfaceSwipeStartX = event.clientX;
    this.eventFeedbackSurfaceSwipeStartY = event.clientY;
    this.eventFeedbackSurfaceSwipeStartScrollLeft = viewport.scrollLeft;
    this.eventFeedbackSurfaceSwipeActive = false;
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  protected moveEventFeedbackSurfaceSwipe(event: PointerEvent): void {
    if (this.eventFeedbackSurfaceSwipePointerId !== event.pointerId) {
      return;
    }
    const viewport = this.eventFeedbackViewportRef?.nativeElement;
    if (!viewport) {
      this.resetEventFeedbackSurfaceSwipe();
      return;
    }
    const deltaX = event.clientX - this.eventFeedbackSurfaceSwipeStartX;
    const deltaY = event.clientY - this.eventFeedbackSurfaceSwipeStartY;
    if (!this.eventFeedbackSurfaceSwipeActive) {
      if (Math.abs(deltaX) < 10 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }
      this.eventFeedbackSurfaceSwipeActive = true;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    viewport.scrollLeft = this.eventFeedbackSurfaceSwipeStartScrollLeft - deltaX;
  }

  protected endEventFeedbackSurfaceSwipe(event: PointerEvent): void {
    if (this.eventFeedbackSurfaceSwipePointerId !== event.pointerId) {
      return;
    }
    const viewport = this.eventFeedbackViewportRef?.nativeElement;
    const wasActive = this.eventFeedbackSurfaceSwipeActive;
    this.resetEventFeedbackSurfaceSwipe();
    if (!viewport || !wasActive) {
      return;
    }
    const nextIndex = this.currentMobileEventFeedbackSlideIndex(viewport);
    this.queueMobileEventFeedbackViewportSync('smooth', nextIndex);
  }

  protected cancelEventFeedbackSurfaceSwipe(event: PointerEvent): void {
    if (this.eventFeedbackSurfaceSwipePointerId !== event.pointerId) {
      return;
    }
    this.resetEventFeedbackSurfaceSwipe();
  }

  ngOnDestroy(): void {
    this.clearEventFeedbackViewportScrollLock();
    this.resetEventFeedbackSurfaceSwipe();
  }

  private eventFeedbackGroupLabel(
    item: EventFeedbackInfoCardData,
    filter: EventFeedbackListFilter
  ): string {
    const timestampMs = item.eagerDetail
      ? this.eventFeedbackGroupTimestampMs(item.eagerDetail, filter)
      : null;
    if (!timestampMs || Number.isNaN(timestampMs)) {
      return 'No date';
    }
    return new Date(timestampMs).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private eventFeedbackGroupTimestampMs(
    item: AppTypes.EventFeedbackEventCard,
    filter: EventFeedbackListFilter
  ): number | null {
    switch (filter) {
      case 'feedbacked':
        return this.validEventFeedbackTimestamp(item.feedbackedAtMs ?? item.startAtMs);
      case 'removed':
        return this.validEventFeedbackTimestamp(item.removedAtMs ?? item.feedbackedAtMs ?? item.startAtMs);
      case 'own-events':
      case 'pending':
      default:
        return this.validEventFeedbackTimestamp(item.startAtMs);
    }
  }

  private validEventFeedbackTimestamp(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }

  private queueMobileEventFeedbackViewportSync(behavior: ScrollBehavior, targetIndex = this.feedback.eventFeedbackIndex()): void {
    if (!this.isMobileEventFeedbackViewport()) {
      this.clearEventFeedbackViewportScrollLock();
      this.resetEventFeedbackViewportScroll();
      return;
    }

    const cards = this.feedback.eventFeedbackCards();
    if (cards.length === 0) {
      this.clearEventFeedbackViewportScrollLock();
      return;
    }

    const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, cards.length - 1));
    if (behavior === 'smooth' && normalizedTargetIndex !== this.feedback.eventFeedbackIndex()) {
      this.eventFeedbackPendingIndicatorIndex.set(normalizedTargetIndex);
    }
    if (behavior === 'smooth') {
      this.eventFeedbackViewportScrollLockTargetIndex = normalizedTargetIndex;
      this.scheduleEventFeedbackViewportScrollLockRelease();
    } else {
      this.eventFeedbackPendingIndicatorIndex.set(null);
      this.clearEventFeedbackViewportScrollLock();
    }

    const sync = () => {
      const viewport = this.eventFeedbackViewportRef?.nativeElement;
      if (!viewport) {
        return;
      }
      const targetLeft = this.mobileEventFeedbackSlideOffsetLeft(viewport, normalizedTargetIndex);
      if (targetLeft < 0) {
        return;
      }
      const previousScrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = behavior;
      viewport.scrollLeft = targetLeft;
      const restore = () => {
        viewport.style.scrollBehavior = previousScrollBehavior;
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => restore());
      } else {
        setTimeout(restore, 0);
      }
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(sync));
      return;
    }
    setTimeout(sync, 0);
  }

  private scheduleEventFeedbackViewportScrollLockRelease(): void {
    if (this.eventFeedbackViewportScrollLockTimer) {
      clearTimeout(this.eventFeedbackViewportScrollLockTimer);
    }
    this.eventFeedbackViewportScrollLockTimer = setTimeout(() => {
      this.eventFeedbackViewportScrollLockTimer = null;
      const viewport = this.eventFeedbackViewportRef?.nativeElement;
      const finalIndex = viewport
        ? this.currentMobileEventFeedbackSlideIndex(viewport)
        : this.eventFeedbackViewportScrollLockTargetIndex;
      this.eventFeedbackViewportScrollLockTargetIndex = null;
      this.eventFeedbackPendingIndicatorIndex.set(null);
      if (finalIndex === null || finalIndex === this.feedback.eventFeedbackIndex()) {
        return;
      }
      this.feedback.eventFeedbackIndex.set(finalIndex);
    }, 96);
  }

  private clearEventFeedbackViewportScrollLock(): void {
    if (this.eventFeedbackViewportScrollLockTimer) {
      clearTimeout(this.eventFeedbackViewportScrollLockTimer);
      this.eventFeedbackViewportScrollLockTimer = null;
    }
    this.eventFeedbackViewportScrollLockTargetIndex = null;
    this.eventFeedbackPendingIndicatorIndex.set(null);
  }

  private resetEventFeedbackSurfaceSwipe(): void {
    this.eventFeedbackSurfaceSwipePointerId = null;
    this.eventFeedbackSurfaceSwipeStartX = 0;
    this.eventFeedbackSurfaceSwipeStartY = 0;
    this.eventFeedbackSurfaceSwipeStartScrollLeft = 0;
    this.eventFeedbackSurfaceSwipeActive = false;
  }

  private isEventFeedbackInteractiveSwipeTarget(target: EventTarget | null): boolean {
    const element = target instanceof Element ? target : null;
    return !!element?.closest('button, a, input, textarea, select, [role="button"], .event-feedback-form');
  }

  private currentMobileEventFeedbackSlideIndex(viewport: HTMLDivElement): number {
    const slides = Array.from(viewport.querySelectorAll<HTMLElement>('.event-feedback-card-slide'));
    if (slides.length === 0) {
      return 0;
    }
    const currentLeft = viewport.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - currentLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return Math.max(0, Math.min(closestIndex, slides.length - 1));
  }

  private mobileEventFeedbackSlideOffsetLeft(viewport: HTMLDivElement, slideIndex: number): number {
    const slides = Array.from(viewport.querySelectorAll<HTMLElement>('.event-feedback-card-slide'));
    if (slides.length === 0) {
      return -1;
    }
    const normalizedIndex = Math.max(0, Math.min(slideIndex, slides.length - 1));
    const targetSlide = slides[normalizedIndex] ?? null;
    return targetSlide ? Math.max(0, targetSlide.offsetLeft) : -1;
  }

  private resetEventFeedbackViewportScroll(): void {
    const viewport = this.eventFeedbackViewportRef?.nativeElement;
    if (viewport && viewport.scrollLeft !== 0) {
      viewport.scrollLeft = 0;
    }
  }

  private readViewportWidth(): number {
    return typeof window === 'undefined' ? 1280 : window.innerWidth;
  }

  private eventFeedbackEmptyDescription(filter: EventFeedbackListFilter): string {
    switch (filter) {
      case 'own-events':
        return 'No own events yet. Hosted events with received feedback will show here.';
      case 'feedbacked':
        return 'No feedbacked events yet.';
      case 'removed':
        return 'No removed events.';
      case 'pending':
      default:
        return 'No pending events yet. New items appear about 2 hours after event start.';
    }
  }
}
