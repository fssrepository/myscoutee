import { Component, ElementRef, OnDestroy, TemplateRef, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';

import { AppContext, EventsService, GameService, UsersService, type UserDto } from '../../../shared/core';
import type { EventMenuItem } from '../../../shared/core/base/interfaces/activity-feed.interface';
import {
  CounterBadgePipe,
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import { EventFeedbackPopupStateService, type EventFeedbackPopupSource } from '../../services/event-feedback-popup-state.service';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';

interface EventFeedbackListFilters {
  filter: AppTypes.EventFeedbackListFilter;
  userId: string;
}

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
    SmartListComponent,
    InfoCardComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent implements OnDestroy, EventFeedbackPopupSource {
  public readonly feedback = inject(EventFeedbackPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);
  private readonly usersService = inject(UsersService);
  private readonly eventRecordsRef = signal<DemoEventRecord[]>([]);
  private lastLoadedUserId = '';
  private loadRequestVersion = 0;
  private eventRecordsLoadPromise: Promise<void> | null = null;
  private eventRecordsLoadUserId = '';
  private eventFeedbackViewportScrollLockTargetIndex: number | null = null;
  private eventFeedbackViewportScrollLockTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isMobileEventFeedbackViewport = signal(this.readViewportWidth() <= 720);
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
    SmartListItemTemplateContext<AppTypes.EventFeedbackEventCard, EventFeedbackListFilters>
  >;

  @ViewChild('eventFeedbackItemTemplate', { read: TemplateRef })
  private set eventFeedbackItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.EventFeedbackEventCard, EventFeedbackListFilters>> | undefined
  ) {
    this.eventFeedbackItemTemplateRef = value;
  }

  @ViewChild('eventFeedbackViewport')
  private eventFeedbackViewportRef?: ElementRef<HTMLDivElement>;

  protected readonly eventFeedbackSmartListLoadPage: SmartListLoadPage<
    AppTypes.EventFeedbackEventCard,
    EventFeedbackListFilters
  > = (query) => from(this.loadEventFeedbackPage(query));

  protected readonly eventFeedbackSmartListConfig: SmartListConfig<
    AppTypes.EventFeedbackEventCard,
    EventFeedbackListFilters
  > = {
    pageSize: 12,
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/events/feedback'),
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
    trackBy: (_index, item) => item.eventId
  };

  constructor() {
    this.feedback.registerSource(this);

    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      if (activeUserId) {
        return;
      }
      this.lastLoadedUserId = '';
      this.eventRecordsLoadUserId = '';
      this.eventRecordsLoadPromise = null;
      this.eventRecordsRef.set([]);
    });

    effect(() => {
      const isPopupOpen = this.feedback.isPopupOpen();
      if (!isPopupOpen) {
        return;
      }
      this.lastLoadedUserId = '';
      this.eventRecordsLoadUserId = '';
      this.eventRecordsLoadPromise = null;
      const activeUserId = this.appCtx.activeUserId().trim();
      if (activeUserId) {
        void this.loadEventRecords(activeUserId);
      }
    });

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

  public get eventItems(): EventMenuItem[] {
    return this.uniqueEventRecords()
      .filter(record => record.type === 'events' && !record.isTrashed && !record.isInvitation && !record.isAdmin)
      .map(record => this.toEventMenuItem(record));
  }

  public get ownedEventItems(): EventMenuItem[] {
    return this.uniqueEventRecords()
      .filter(record => !record.isTrashed && !record.isInvitation && !!record.isAdmin)
      .map(record => this.toEventMenuItem(record));
  }

  private get fallbackUsers(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  public get users(): UserDto[] {
    const activeUser = this.appCtx.activeUserProfile();
    const snapshot = this.gameService.getGameCardsUsersSnapshot();
    const base = snapshot.length > 0 ? snapshot : this.fallbackUsers;
    const next = [...base];
    if (activeUser && !next.some(user => user.id === activeUser.id)) {
      next.unshift(activeUser);
    }
    return next;
  }

  public get activeUser(): UserDto {
    return this.appCtx.activeUserProfile() ?? this.users[0] ?? this.createFallbackUser();
  }

  public get eventDatesById(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const record of this.uniqueEventRecords()) {
      if (!record.startAtIso) {
        continue;
      }
      next[record.id] = record.startAtIso;
    }
    return next;
  }

  public get activityImageById(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const record of this.uniqueEventRecords()) {
      if (!record.imageUrl?.trim()) {
        continue;
      }
      next[record.id] = record.imageUrl;
    }
    return next;
  }

  public eventStartAtMs(eventId: string): number | null {
    const record = this.eventRecordById(eventId);
    if (!record?.startAtIso) {
      return null;
    }
    const value = new Date(record.startAtIso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  public eventTitleById(eventId: string): string {
    return this.eventRecordById(eventId)?.title ?? 'this event';
  }

  protected eventFeedbackInfoCard(item: AppTypes.EventFeedbackEventCard): InfoCardData {
    if (item.isOwnEvent) {
      return this.organizerEventFeedbackCardData({
        eventId: item.eventId,
        title: item.title,
        subtitle: item.subtitle,
        timeframe: item.timeframe,
        imageUrl: item.imageUrl,
        responseCount: item.pendingCards,
        noteCount: 0
      }, true);
    }
    const detailRows = item.isFeedbacked
      ? [item.timeframe]
      : [item.timeframe, this.feedback.eventFeedbackItemStatusLine(item)];
    return {
      rowId: item.eventId,
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows,
      leadingIcon: {
        icon: this.eventFeedbackLeadingIcon(item)
      },
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.eventFeedbackStartBadgeLabel(item),
        interactive: this.feedback.isEventFeedbackStartAvailable(item),
        ariaLabel: this.feedback.isEventFeedbackStartAvailable(item)
          ? 'Start event feedback'
          : 'Event feedback unavailable'
      },
      menuActions: this.eventFeedbackMenuActions(item),
      clickable: false
    };
  }

  protected onEventFeedbackCardPrimaryAction(item: AppTypes.EventFeedbackEventCard): void {
    if (item.isOwnEvent) {
      this.openOrganizerEventFeedback(item.eventId);
      return;
    }
    if (!this.feedback.isEventFeedbackStartAvailable(item)) {
      return;
    }
    this.feedback.startEventFeedback(item);
  }

  protected onEventFeedbackCardMenuAction(item: AppTypes.EventFeedbackEventCard, event: InfoCardMenuActionEvent): void {
    if (item.isOwnEvent) {
      return;
    }
    if (event.actionId === 'start') {
      this.feedback.startEventFeedback(item);
      return;
    }
    if (event.actionId === 'remove') {
      this.feedback.removeEventFeedbackItem(item);
      return;
    }
    if (event.actionId === 'restore') {
      this.feedback.restoreRemovedEventFeedbackItem(item);
      return;
    }
    this.feedback.openEventFeedbackNotePopup(item);
  }

  protected eventFeedbackCarouselInfoCard(card: AppTypes.EventFeedbackCard): InfoCardData {
    const detailRows = [card.identityTitle].filter((row): row is string => !!row?.trim());
    return {
      rowId: card.id,
      title: card.heading,
      imageUrl: card.imageUrl,
      metaRows: [card.subheading],
      metaRowsLimit: 1,
      detailRows,
      leadingIcon: {
        icon: card.icon
      },
      clickable: false
    };
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
    return this.organizerEventFeedbackCardData(item, true);
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
    return this.organizerEventFeedbackCardData(item, false);
  }

  private organizerEventFeedbackCardData(item: {
    eventId: string;
    title: string;
    subtitle: string;
    timeframe: string;
    imageUrl: string;
    responseCount: number;
    noteCount: number;
  }, showAction: boolean): InfoCardData {
    return {
      rowId: item.eventId,
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows: [item.timeframe],
      leadingIcon: {
        icon: 'stadium'
      },
      mediaEnd: showAction
        ? {
          variant: 'badge',
          tone: 'default',
          label: 'View Feedbacks',
          pendingCount: item.responseCount,
          interactive: true,
          ariaLabel: `Open feedback details for ${item.title}`
        }
        : null,
      clickable: false
    };
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
    this.feedback.eventFeedbackIndex.set(nextIndex);
  }

  ngOnDestroy(): void {
    this.clearEventFeedbackViewportScrollLock();
    this.feedback.registerSource(null);
  }

  private async loadEventFeedbackPage(
    query: ListQuery<EventFeedbackListFilters>
  ): Promise<{ items: AppTypes.EventFeedbackEventCard[]; total: number }> {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    const userId = query.filters?.userId?.trim() || this.appCtx.activeUserId().trim();

    if (!userId) {
      this.lastLoadedUserId = '';
      this.eventRecordsLoadUserId = '';
      this.eventRecordsLoadPromise = null;
      this.eventRecordsRef.set([]);
      return { items: [], total: 0 };
    }

    await this.loadEventRecords(userId);

    const items = this.feedback.eventFeedbackVisibleItems();
    return {
      items: items.slice(start, start + pageSize),
      total: items.length
    };
  }

  private async loadEventRecords(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      this.lastLoadedUserId = '';
      this.eventRecordsLoadUserId = '';
      this.eventRecordsLoadPromise = null;
      this.eventRecordsRef.set([]);
      return;
    }

    if (this.eventRecordsLoadPromise && this.eventRecordsLoadUserId === normalizedUserId) {
      return this.eventRecordsLoadPromise;
    }

    if (this.lastLoadedUserId === normalizedUserId && this.eventRecordsRef().length > 0) {
      return;
    }

    const requestVersion = ++this.loadRequestVersion;
    this.eventRecordsLoadUserId = normalizedUserId;
    this.eventRecordsLoadPromise = (async () => {
      const records = await this.eventsService.queryItemsByUser(normalizedUserId);
      if (requestVersion !== this.loadRequestVersion) {
        return;
      }
      this.lastLoadedUserId = normalizedUserId;
      this.eventRecordsRef.set(records);
      void this.usersService.warmCachedUsers(this.collectEventRecordUserIds(records));
    })();

    try {
      await this.eventRecordsLoadPromise;
    } finally {
      if (this.eventRecordsLoadUserId === normalizedUserId) {
        this.eventRecordsLoadPromise = null;
      }
    }
  }

  private eventRecordById(eventId: string): DemoEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.uniqueEventRecords().find(record => record.id === normalizedEventId) ?? null;
  }

  private uniqueEventRecords(): DemoEventRecord[] {
    const byId = new Map<string, DemoEventRecord>();
    for (const record of this.eventRecordsRef()) {
      const recordId = record.id?.trim() ?? '';
      if (!recordId) {
        continue;
      }
      const current = byId.get(recordId);
      if (!current || this.shouldPreferEventRecord(record, current)) {
        byId.set(recordId, record);
      }
    }
    return [...byId.values()];
  }

  private shouldPreferEventRecord(candidate: DemoEventRecord, current: DemoEventRecord): boolean {
    const score = (record: DemoEventRecord) =>
      (record.isAdmin ? 8 : 0)
      + (record.type === 'hosting' ? 4 : 0)
      + (!record.isInvitation ? 2 : 0)
      + (!record.isTrashed ? 1 : 0);
    return score(candidate) > score(current);
  }

  private collectEventRecordUserIds(records: readonly DemoEventRecord[]): string[] {
    return [...new Set(records.flatMap(record => [
      `${record.creatorUserId ?? ''}`.trim(),
      ...(record.acceptedMemberUserIds ?? []).map(userId => `${userId}`.trim()),
      ...(record.pendingMemberUserIds ?? []).map(userId => `${userId}`.trim())
    ]).filter(userId => userId.length > 0))];
  }

  private createFallbackUser(): UserDto {
    return {
      id: this.appCtx.activeUserId().trim(),
      name: 'User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: 'U',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
        feedback: 0
      }
    };
  }

  private eventFeedbackLeadingIcon(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isOwnEvent) {
      return 'stadium';
    }
    if (item.isFeedbacked) {
      return 'task_alt';
    }
    if (item.isRemoved) {
      return 'delete_outline';
    }
    return 'rate_review';
  }

  private eventFeedbackStartBadgeLabel(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isOwnEvent) {
      return 'View Feedbacks';
    }
    if (item.isRemoved) {
      return 'Removed';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked';
    }
    return 'Start Feedback';
  }

  private eventFeedbackMenuActions(item: AppTypes.EventFeedbackEventCard): readonly InfoCardMenuAction[] {
    if (item.isOwnEvent) {
      return [];
    }
    const actions: InfoCardMenuAction[] = [];

    if (this.feedback.isEventFeedbackStartAvailable(item)) {
      actions.push({
        id: 'start',
        label: 'Start Feedback',
        icon: 'play_arrow'
      });
    }

    if (!item.isRemoved && !item.isFeedbacked) {
      actions.push({
        id: 'remove',
        label: 'Remove',
        icon: 'remove_circle',
        tone: 'destructive'
      });
    }

    if (item.isRemoved) {
      actions.push({
        id: 'restore',
        label: 'Restore',
        icon: 'restore'
      });
    }

    actions.push({
      id: 'note',
      label: this.feedback.hasEventFeedbackOrganizerNote(item.eventId) ? 'Edit Organizer Note' : 'Add Organizer Note',
      icon: 'edit_note'
    });

    return actions;
  }

  private eventFeedbackGroupLabel(
    item: AppTypes.EventFeedbackEventCard,
    filter: AppTypes.EventFeedbackListFilter
  ): string {
    const timestampMs = this.eventFeedbackGroupTimestampMs(item, filter);
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
    filter: AppTypes.EventFeedbackListFilter
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
      return;
    }

    const cards = this.feedback.eventFeedbackCards();
    if (cards.length === 0) {
      this.clearEventFeedbackViewportScrollLock();
      return;
    }

    const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, cards.length - 1));
    if (behavior === 'smooth') {
      this.eventFeedbackViewportScrollLockTargetIndex = normalizedTargetIndex;
      this.scheduleEventFeedbackViewportScrollLockRelease();
    } else {
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

  private readViewportWidth(): number {
    return typeof window === 'undefined' ? 1280 : window.innerWidth;
  }

  private eventFeedbackEmptyDescription(filter: AppTypes.EventFeedbackListFilter): string {
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

  private toEventMenuItem(record: DemoEventRecord): EventMenuItem {
    return {
      id: record.id,
      avatar: record.avatar,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: record.isAdmin,
      creatorUserId: record.creatorUserId,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      capacityTotal: record.capacityTotal,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      visibility: record.visibility,
      blindMode: record.blindMode,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      locationCoordinates: record.locationCoordinates ? { ...record.locationCoordinates } : undefined,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      autoInviter: record.autoInviter,
      frequency: record.frequency,
      topics: [...record.topics],
      subEvents: record.subEvents ? [...record.subEvents] : undefined,
      subEventsDisplayMode: record.subEventsDisplayMode,
      rating: record.rating,
      relevance: record.relevance,
      affinity: record.affinity,
      ticketing: record.ticketing,
      published: record.published
    };
  }
}
