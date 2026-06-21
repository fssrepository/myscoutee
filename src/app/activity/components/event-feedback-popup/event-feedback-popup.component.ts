import { Component, TemplateRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';

import {
  AppMenuComponent,
  AppContext,
  EventFeedbackFormFlowConverter,
  type EventFeedbackFormValue,
  EventFeedbackInfoCardConverter,
  FormFlowComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuAction,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import type { EventFeedbackListFilter } from '../../../shared/core/common/constants';
import { EventsService } from '../../../shared/core/base';
import { EventFeedbackPopupStateService, type EventFeedbackListFilters } from '../../services/event-feedback-popup-state.service';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';

type EventFeedbackMenuContext = {
  menu: 'filter';
  filter: EventFeedbackListFilter;
} | {
  menu: 'info-card';
  card: InfoCardData;
  action: CardMenuAction;
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
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    AppMenuComponent,
    FormFlowComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent {
  public readonly feedback = inject(EventFeedbackPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private lastAppliedEventFeedbackSubmitUpdatedMs = 0;
  protected readonly eventFeedbackDeckDto = signal<ActivityContracts.EventFeedbackDeckResultDto | null>(null);
  protected readonly eventFeedbackDeckValue = signal<EventFeedbackFormValue>(EventFeedbackFormFlowConverter.emptyValue());
  protected readonly eventFeedbackDeckLoading = signal(false);
  protected readonly eventFeedbackSubmitMessage = signal('');
  protected readonly eventFeedbackSubmitted = signal(false);
  protected readonly hasEventFeedbackCards = computed(() => (this.eventFeedbackDeckDto()?.cards.length ?? 0) > 0);
  private readonly eventFeedbackFilterCountDelta = signal<Partial<Record<EventFeedbackListFilter, number>>>({});

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
    SmartListItemTemplateContext<InfoCardData, EventFeedbackListFilters>
  >;

  @ViewChild('eventFeedbackItemTemplate', { read: TemplateRef })
  private set eventFeedbackItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<InfoCardData, EventFeedbackListFilters>> | undefined
  ) {
    this.eventFeedbackItemTemplateRef = value;
  }

  @ViewChild('eventFeedbackSmartList')
  private eventFeedbackSmartList?: SmartListComponent<InfoCardData, EventFeedbackListFilters>;

  protected readonly eventFeedbackSmartListLoadPage: SmartListLoadPage<
    InfoCardData,
    EventFeedbackListFilters
  > = (query) => from(this.loadEventFeedbackPage(query));

  protected readonly eventFeedbackSmartListConfig: SmartListConfig<
    InfoCardData,
    EventFeedbackListFilters
  > = {
    pageSize: 12,
    defaultView: 'list',
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.isOnline() ? 'active' : 'inactive'
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
    const count = this.eventFeedbackFilterCount(filter);
    return {
      label: this.feedback.eventFeedbackFilterLabel(),
      icon: this.feedback.eventFeedbackFilterIcon(),
      ariaLabel: 'Open event feedback filter',
      palette: this.eventFeedbackFilterPalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      layout: 'pill'
    };
  }

  protected eventFeedbackFilterMenuItems(): readonly AppMenuItem<string, EventFeedbackMenuContext>[] {
    const active = this.feedback.eventFeedbackListFilter();
    return this.feedback.eventFeedbackListFilters.map(option => {
      const count = this.eventFeedbackFilterCount(option.key);
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
    this.onEventFeedbackCardMenuAction(context.card, {
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

    effect(() => {
      const sync = this.appCtx.activityEventFeedbackSubmitSync();
      if (!sync || sync.updatedMs <= this.lastAppliedEventFeedbackSubmitUpdatedMs) {
        return;
      }
      this.lastAppliedEventFeedbackSubmitUpdatedMs = sync.updatedMs;
      this.applyActivityEventFeedbackSubmitSync(sync.dto);
    });
  }

  protected onEventFeedbackCardPrimaryAction(card: InfoCardData): void {
    const item = this.feedback.eventFeedbackItemById(card.id);
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
    void this.startEventFeedback(item);
  }

  protected onEventFeedbackCardMenuAction(card: InfoCardData, event: CardMenuActionEvent<InfoCardData>): void {
    const item = this.feedback.eventFeedbackItemById(card.id);
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      return;
    }
    if (event.actionId === 'startFeedback') {
      void this.startEventFeedback(item);
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
        await this.eventsService.removeEventFeedbackEvent(this.activeUserId(), item.eventId);
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
        await this.eventsService.restoreEventFeedbackEvent(this.activeUserId(), item.eventId);
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

  private async loadEventFeedbackPage(
    query: ListQuery<EventFeedbackListFilters>
  ): Promise<PageResult<InfoCardData>> {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const filter = query.filters?.filter ?? this.feedback.eventFeedbackListFilter();
    const normalizedUserId = (query.filters?.userId?.trim() || this.activeUserId()).trim();
    if (!normalizedUserId) {
      this.feedback.clearEventFeedbackListView('');
      return { items: [], total: 0 };
    }
    const result = await this.eventsService.loadEventFeedbackPage({
      userId: normalizedUserId,
      filter,
      page,
      pageSize
    });
    if (this.activeUserId() !== normalizedUserId) {
      return { items: [], total: 0 };
    }
    const viewModel = EventFeedbackInfoCardConverter.convertPage(result, {
      hasOrganizerNote: eventId => this.feedback.hasEventFeedbackOrganizerNote(eventId)
    });
    this.feedback.applyEventFeedbackPageViewModel(normalizedUserId, viewModel);
    this.eventFeedbackFilterCountDelta.set({});
    const items = this.feedback.eventFeedbackVisibleItems().map(item =>
      EventFeedbackInfoCardConverter.convert(item, {
        hasOrganizerNote: eventId => this.feedback.hasEventFeedbackOrganizerNote(eventId)
      })
    );
    return {
      items: items.slice(page * pageSize, (page * pageSize) + pageSize),
      total: items.length
    };
  }

  private activeUserId(): string {
    return this.appCtx.activeUserProfile()?.id?.trim() || this.appCtx.activeUserId().trim();
  }

  private async startEventFeedback(item: AppTypes.EventFeedbackEventCard, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.feedback.isEventFeedbackStartAvailable(item)) {
      return;
    }
    const userId = this.activeUserId();
    const eventId = item.eventId.trim();
    this.feedback.openEventFeedbackDeck(item);
    this.clearLoadedEventFeedbackDeck(eventId);
    this.eventFeedbackDeckLoading.set(true);
    this.eventFeedbackSubmitted.set(false);
    this.eventFeedbackSubmitMessage.set('');
    if (!userId || !eventId) {
      this.applyLoadedEventFeedbackDeck({
        eventId,
        title: item.title,
        cards: []
      }, item.title);
      this.eventFeedbackDeckLoading.set(false);
      return;
    }
    try {
      const deck = await this.eventsService.loadEventFeedbackDeck({ userId, eventId });
      this.applyLoadedEventFeedbackDeck(deck, item.title);
    } finally {
      if (this.feedback.isEventFeedbackDeckLoadCurrent(eventId)) {
        this.eventFeedbackDeckLoading.set(false);
      }
    }
  }

  protected readonly eventFeedbackFlowModel = computed(() => EventFeedbackFormFlowConverter.convert(
    this.eventFeedbackDeckDto(),
    { eventTitle: this.feedback.eventFeedbackCurrentEventTitle() }
  ));

  protected async onEventFeedbackFlowSave(): Promise<void> {
    if (this.eventFeedbackSubmitted()) {
      return;
    }
    const submittedAtIso = new Date().toISOString();
    const submitResult = EventFeedbackFormFlowConverter.submitResult({
      userId: this.activeUserId(),
      deck: this.eventFeedbackDeckDto(),
      value: this.eventFeedbackDeckValue(),
      submittedAtIso
    });
    if (!submitResult) {
      return;
    }
    await this.eventsService.submitEventFeedback(submitResult.request);
    this.appCtx.emitActivityEventFeedbackSubmit(submitResult.request);
    this.eventFeedbackSubmitted.set(true);
    this.eventFeedbackSubmitMessage.set(`Feedback submitted successfully for ${this.feedback.eventFeedbackCurrentEventTitle()}.`);
    this.clearLoadedEventFeedbackDeck(submitResult.request.eventId);
  }

  protected setEventFeedbackDeckValue(value: unknown): void {
    this.eventFeedbackDeckValue.set(EventFeedbackFormFlowConverter.normalizeValue(value, this.eventFeedbackDeckDto()));
  }

  private applyLoadedEventFeedbackDeck(
    deck: ActivityContracts.EventFeedbackDeckResultDto,
    fallbackTitle: string
  ): void {
    if (!this.feedback.isEventFeedbackDeckLoadCurrent(deck.eventId)) {
      return;
    }
    const pendingDeck = this.pendingEventFeedbackDeck({
      ...deck,
      title: deck.title?.trim() || fallbackTitle.trim()
    });
    if (pendingDeck.cards.length === 0) {
      this.clearLoadedEventFeedbackDeck(pendingDeck.eventId);
      this.feedback.completeEmptyEventFeedbackDeck(fallbackTitle);
      return;
    }
    this.eventFeedbackDeckDto.set(pendingDeck);
    this.eventFeedbackDeckValue.set(EventFeedbackFormFlowConverter.initialValue(pendingDeck));
  }

  private pendingEventFeedbackDeck(
    deck: ActivityContracts.EventFeedbackDeckResultDto
  ): ActivityContracts.EventFeedbackDeckResultDto {
    const eventId = deck.eventId?.trim() ?? '';
    return {
      eventId,
      title: deck.title?.trim() ?? '',
      cards: (deck.cards ?? [])
        .map(card => ({
          ...card,
          id: card.id?.trim() ?? '',
          eventId: card.eventId?.trim() ?? '',
          attendeeUserId: card.attendeeUserId?.trim() || undefined
        }))
        .filter(card =>
          card.id.length > 0
          && card.eventId === eventId
          && !(card.kind === 'attendee' && card.attendeeUserId === this.activeUserId())
        )
    };
  }

  private clearLoadedEventFeedbackDeck(eventId = ''): void {
    this.eventFeedbackDeckDto.set(null);
    this.eventFeedbackDeckValue.set(EventFeedbackFormFlowConverter.emptyValue(eventId));
  }

  private applyActivityEventFeedbackSubmitSync(dto: ActivityContracts.EventFeedbackSubmitRequestDto): void {
    const userId = dto.userId.trim();
    const eventId = dto.eventId.trim();
    if (!userId || userId !== this.activeUserId() || !eventId) {
      return;
    }
    const sourceItem = this.feedback.eventFeedbackItemById(eventId);
    if (!sourceItem || sourceItem.isOwnEvent) {
      return;
    }
    const submittedAtMs = this.eventFeedbackSubmitTimestampMs(dto);
    const pendingCards = Math.max(0, sourceItem.pendingCards - dto.answers.length);
    const nextItem: AppTypes.EventFeedbackEventCard = {
      ...sourceItem,
      pendingCards,
      isRemoved: false,
      isFeedbacked: pendingCards === 0,
      feedbackedAtMs: pendingCards === 0 ? submittedAtMs : sourceItem.feedbackedAtMs,
      removedAtMs: null
    };
    this.applyEventFeedbackFilterCountDelta(sourceItem, nextItem);
    if (!this.eventFeedbackSmartList) {
      return;
    }
    const currentItems = [...this.eventFeedbackSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(item => item.id === eventId);
    if (currentIndex < 0) {
      return;
    }
    const nextItems = [...currentItems];
    if (!this.eventFeedbackItemMatchesFilter(nextItem, this.feedback.eventFeedbackListFilter())) {
      nextItems.splice(currentIndex, 1);
      this.eventFeedbackSmartList.replaceVisibleItems(nextItems, {
        total: Math.max(nextItems.length, this.eventFeedbackSmartList.totalItemCount() - 1)
      });
      return;
    }
    nextItems[currentIndex] = EventFeedbackInfoCardConverter.convert(nextItem, {
      hasOrganizerNote: feedbackEventId => this.feedback.hasEventFeedbackOrganizerNote(feedbackEventId)
    });
    this.eventFeedbackSmartList.replaceVisibleItems(nextItems, {
      total: this.eventFeedbackSmartList.totalItemCount()
    });
  }

  private eventFeedbackFilterCount(filter: EventFeedbackListFilter): number {
    return Math.max(0, this.feedback.eventFeedbackFilterCount(filter) + (this.eventFeedbackFilterCountDelta()[filter] ?? 0));
  }

  private applyEventFeedbackFilterCountDelta(
    before: AppTypes.EventFeedbackEventCard,
    after: AppTypes.EventFeedbackEventCard
  ): void {
    const beforePending = !before.isRemoved && before.pendingCards > 0;
    const afterPending = !after.isRemoved && after.pendingCards > 0;
    const beforeFeedbacked = before.isFeedbacked;
    const afterFeedbacked = after.isFeedbacked;
    if (beforePending === afterPending && beforeFeedbacked === afterFeedbacked) {
      return;
    }
    this.eventFeedbackFilterCountDelta.update(current => ({
      ...current,
      pending: (current.pending ?? 0) + (beforePending && !afterPending ? -1 : !beforePending && afterPending ? 1 : 0),
      feedbacked: (current.feedbacked ?? 0) + (!beforeFeedbacked && afterFeedbacked ? 1 : beforeFeedbacked && !afterFeedbacked ? -1 : 0)
    }));
  }

  private eventFeedbackItemMatchesFilter(
    item: AppTypes.EventFeedbackEventCard,
    filter: EventFeedbackListFilter
  ): boolean {
    switch (filter) {
      case 'own-events':
        return item.isOwnEvent === true;
      case 'feedbacked':
        return item.isFeedbacked === true;
      case 'removed':
        return item.isRemoved === true;
      case 'pending':
      default:
        return !item.isRemoved && item.pendingCards > 0;
    }
  }

  private eventFeedbackSubmitTimestampMs(dto: ActivityContracts.EventFeedbackSubmitRequestDto): number {
    const submittedAtIso = dto.answers.map(answer => answer.submittedAtIso.trim()).find(Boolean) ?? '';
    const submittedAtMs = submittedAtIso ? new Date(submittedAtIso).getTime() : Date.now();
    return Number.isNaN(submittedAtMs) ? Date.now() : submittedAtMs;
  }

  protected submitEventFeedbackNote(): void {
    if (!this.feedback.canSubmitEventFeedbackNote()) {
      return;
    }
    const userId = this.activeUserId();
    const noteForm = this.feedback.eventFeedbackNoteForm();
    const eventId = noteForm.eventId.trim();
    const text = noteForm.text.trim();
    if (!userId || !eventId) {
      return;
    }
    void this.eventsService.saveEventFeedbackNote({ userId, eventId, text });
    this.feedback.applyEventFeedbackNoteSubmitted();
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
    return EventFeedbackInfoCardConverter.organizerEventFeedbackCard(item, { showAction: false });
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

  private eventFeedbackGroupLabel(
    item: InfoCardData,
    filter: EventFeedbackListFilter
  ): string {
    const detail = this.feedback.eventFeedbackItemById(item.id);
    const timestampMs = detail
      ? this.eventFeedbackGroupTimestampMs(detail, filter)
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
