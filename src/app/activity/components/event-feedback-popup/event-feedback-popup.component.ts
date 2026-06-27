import { Component, TemplateRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';

import {
  AppMenuComponent,
  AppContext,
  AppPopupContext,
  EventFeedbackFormFlowConverter,
  EventFeedbackFilterMenuConverter,
  EventFeedbackInfoCardConverter,
  EventFeedbackListPresentationConverter,
  EventFeedbackOrganizerCarouselSectionConverter,
  EventFeedbackOrganizerInfoCardConverter,
  EventFeedbackOrganizerItemConverter,
  EventFeedbackOrganizerMessageGroupConverter,
  FormFlowComponent,
  ProgressIndicatorComponent,
  type FormFlowSaveEvent,
  type AppMenuItemSelectEvent,
  type EventFeedbackFilterMenuContext,
  type EventFeedbackOrganizerCarouselSectionData,
  type EventFeedbackOrganizerItemData,
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
import * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import type { EventFeedbackListFilter } from '../../../shared/core/common/constants';
import { EventsService } from '../../../shared/core/base';
import {
  ConfirmationDialogService,
  type ConfirmationDialogConfig
} from '../../../shared/ui/services/confirmation-dialog.service';

type EventFeedbackStackedPopupMode = 'eventFeedback' | 'eventFeedbackNote' | 'organizerEventFeedback' | null;

interface EventFeedbackListFilters {
  filter: EventFeedbackListFilter;
  userId: string;
}

type EventFeedbackMenuContext = EventFeedbackFilterMenuContext | {
  menu: 'info-card';
  card: InfoCardData;
  action: CardMenuAction;
};

type EventFeedbackConfirmationDialogAction = 'remove' | 'restore';

interface EventFeedbackConfirmationDialogContent extends Omit<ConfirmationDialogConfig, 'onConfirm' | 'onCancel'> {}

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
    ProgressIndicatorComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent {
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly eventsService = inject(EventsService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private lastHandledNavigatorEventFeedbackRequestMs = 0;
  private lastAppliedEventFeedbackSubmitUpdatedMs = 0;
  protected readonly isPopupOpen = signal(false);
  protected readonly isStackedPopupOpen = signal(false);
  protected readonly stackedPopupMode = signal<EventFeedbackStackedPopupMode>(null);
  protected readonly eventFeedbackListFilter = signal<EventFeedbackListFilter>('pending');
  protected readonly eventFeedbackListSubmitMessage = signal('');
  protected readonly selectedEventFeedbackEventId = signal<string | null>(null);
  protected readonly selectedOrganizerEventFeedbackEventId = signal<string | null>(null);
  protected readonly eventFeedbackNoteForm = signal({ eventId: '', text: '' });
  protected readonly eventFeedbackNoteSubmitted = signal(false);
  protected readonly eventFeedbackNoteSubmitMessage = signal('');
  private readonly eventFeedbackPageResult = signal<ActivityContracts.EventFeedbackPageResultDto | null>(null);
  protected readonly eventFeedbackDetailDto = signal<ActivityContracts.EventFeedbackDetailDto | null>(null);
  protected readonly eventFeedbackDetailValue = signal<ActivityContracts.EventFeedbackDetailDto>(
    new ActivityContracts.EventFeedbackDetailDto()
  );
  protected readonly eventFeedbackDetailLoading = signal(false);
  protected readonly eventFeedbackSubmitting = signal(false);
  protected readonly eventFeedbackSubmitMessage = signal('');
  protected readonly eventFeedbackSubmitted = signal(false);
  protected readonly hasEventFeedbackCards = computed(() => (this.eventFeedbackDetailDto()?.cards.length ?? 0) > 0);
  private readonly eventFeedbackFilterCountDelta = signal<Partial<Record<EventFeedbackListFilter, number>>>({});

  protected readonly eventFeedbackFilterMenu = computed(() => EventFeedbackFilterMenuConverter.convert({
    result: this.eventFeedbackPageResult(),
    activeFilter: this.eventFeedbackListFilter(),
    delta: this.eventFeedbackFilterCountDelta()
  }));
  protected readonly organizerEventFeedbackItems = computed<EventFeedbackOrganizerItemData[]>(() => {
    const result = this.eventFeedbackPageResult();
    return result ? EventFeedbackOrganizerItemConverter.convertList(result.organizerItems, { result }) : [];
  });
  protected readonly selectedOrganizerEventFeedbackItem = computed<EventFeedbackOrganizerItemData | null>(() => {
    const eventId = this.selectedOrganizerEventFeedbackEventId()?.trim() ?? '';
    if (!eventId) {
      return null;
    }
    return this.organizerEventFeedbackItems().find(item => item.eventId === eventId) ?? null;
  });
  protected readonly selectedOrganizerEventFeedbackInfoCard = computed<InfoCardData | null>(() => {
    const item = this.selectedOrganizerEventFeedbackItem();
    return item ? EventFeedbackOrganizerInfoCardConverter.convert(item, { showAction: false }) : null;
  });
  protected readonly organizerEventFeedbackMessageGroups = computed(() =>
    EventFeedbackOrganizerMessageGroupConverter.convert({
      result: this.eventFeedbackPageResult(),
      eventId: this.selectedOrganizerEventFeedbackEventId() ?? ''
    })
  );
  protected readonly organizerEventFeedbackCarouselIndex = signal(0);
  protected readonly organizerEventFeedbackCarouselSections = computed<EventFeedbackOrganizerCarouselSectionData[]>(() =>
    EventFeedbackOrganizerCarouselSectionConverter.convert({
      result: this.eventFeedbackPageResult(),
      eventId: this.selectedOrganizerEventFeedbackEventId() ?? ''
    })
  );
  protected readonly organizerEventFeedbackActiveCarouselSection = computed<EventFeedbackOrganizerCarouselSectionData | null>(() => {
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
    emptyDescription: (query) => EventFeedbackListPresentationConverter.convert({
      result: this.eventFeedbackPageResult(),
      filter: query.filters?.filter ?? 'pending'
    }).emptyDescription,
    showStickyHeader: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: (item, query) => EventFeedbackListPresentationConverter.convert({
      result: this.eventFeedbackPageResult(),
      itemId: item.id,
      filter: query.filters?.filter ?? this.eventFeedbackListFilter()
    }).groupLabel,
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

  protected onEventFeedbackMenuSelect(event: AppMenuItemSelectEvent<string, EventFeedbackMenuContext>): void {
    if (event.context?.menu !== 'filter') {
      return;
    }
    this.selectEventFeedbackListFilter(event.context.filter, event.sourceEvent);
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

  constructor() {
    effect(() => {
      const request = this.popupCtx.navigatorEventFeedbackRequest();
      if (!request || request.updatedMs <= this.lastHandledNavigatorEventFeedbackRequestMs) {
        return;
      }
      this.lastHandledNavigatorEventFeedbackRequestMs = request.updatedMs;
      this.popupCtx.clearNavigatorEventFeedbackRequest();
      this.openPopup();
    });

    effect(() => {
      const filter = this.eventFeedbackListFilter();
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
      const selectedEventId = this.selectedOrganizerEventFeedbackEventId();
      const stackedMode = this.stackedPopupMode();
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

  protected openPopup(): void {
    this.eventFeedbackListFilter.set('pending');
    this.eventFeedbackListSubmitMessage.set('');
    this.selectedEventFeedbackEventId.set(null);
    this.selectedOrganizerEventFeedbackEventId.set(null);
    this.eventFeedbackPageResult.set(null);
    this.eventFeedbackFilterCountDelta.set({});
    this.isPopupOpen.set(true);
  }

  protected closePopup(): void {
    this.isPopupOpen.set(false);
  }

  protected closeStackedPopup(): void {
    this.isStackedPopupOpen.set(false);
    this.stackedPopupMode.set(null);
    this.selectedOrganizerEventFeedbackEventId.set(null);
  }

  private selectEventFeedbackListFilter(filter: EventFeedbackListFilter, event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackListFilter.set(filter);
    this.selectedOrganizerEventFeedbackEventId.set(null);
  }

  protected eventFeedbackCurrentEventTitle(): string {
    const eventId =
      this.selectedOrganizerEventFeedbackEventId()
      ?? this.selectedEventFeedbackEventId()
      ?? this.eventFeedbackNoteForm().eventId;
    return this.eventFeedbackPageResult()?.eventTitleById(eventId) ?? 'this event';
  }

  private openEventFeedbackDetail(item: ActivityContracts.EventFeedbackDto, event?: Event): void {
    event?.stopPropagation();
    this.selectedEventFeedbackEventId.set(item.eventId);
    this.stackedPopupMode.set('eventFeedback');
    this.isStackedPopupOpen.set(true);
  }

  private isEventFeedbackDetailLoadCurrent(eventId: string): boolean {
    return this.selectedEventFeedbackEventId() === eventId.trim()
      && this.stackedPopupMode() === 'eventFeedback';
  }

  private completeEmptyEventFeedbackDetail(title: string): void {
    this.eventFeedbackListSubmitMessage.set(`${title} is already in Feedbacked.`);
    this.eventFeedbackListFilter.set('feedbacked');
    this.closeStackedPopup();
  }

  private openEventFeedbackNotePopup(item: ActivityContracts.EventFeedbackDto, event?: Event): void {
    event?.stopPropagation();
    this.selectedEventFeedbackEventId.set(item.eventId);
    this.eventFeedbackNoteForm.set({
      eventId: item.eventId,
      text: this.eventFeedbackPageResult()?.state.organizerNotesByEventId[item.eventId]?.trim() ?? ''
    });
    this.eventFeedbackNoteSubmitted.set(false);
    this.eventFeedbackNoteSubmitMessage.set('');
    this.stackedPopupMode.set('eventFeedbackNote');
    this.isStackedPopupOpen.set(true);
  }

  protected canSubmitEventFeedbackNote(): boolean {
    return this.eventFeedbackNoteForm().text.trim().length >= 8;
  }

  private applyEventFeedbackNoteSubmitted(): void {
    if (!this.canSubmitEventFeedbackNote()) {
      return;
    }
    const noteForm = this.eventFeedbackNoteForm();
    const eventId = noteForm.eventId.trim();
    const trimmedText = noteForm.text.trim();
    this.eventFeedbackPageResult.update(result => result?.patchOrganizerNote(eventId, trimmedText) ?? null);
    this.eventFeedbackNoteSubmitted.set(true);
    const message = `Organizer feedback saved for ${this.eventFeedbackCurrentEventTitle()}.`;
    this.eventFeedbackNoteSubmitMessage.set(message);
    this.eventFeedbackListSubmitMessage.set(message);
  }

  private patchEventFeedbackItem(
    before: ActivityContracts.EventFeedbackDto,
    after: ActivityContracts.EventFeedbackDto
  ): void {
    const pageResult = this.eventFeedbackPageResult();
    const delta = pageResult?.filterCountDelta(before, after) ?? {};
    this.eventFeedbackFilterCountDelta.update(current => ({
      ...current,
      'own-events': (current['own-events'] ?? 0) + (delta['own-events'] ?? 0),
      pending: (current.pending ?? 0) + (delta.pending ?? 0),
      feedbacked: (current.feedbacked ?? 0) + (delta.feedbacked ?? 0),
      removed: (current.removed ?? 0) + (delta.removed ?? 0)
    }));
    this.eventFeedbackPageResult.set(pageResult?.patchItem(after) ?? null);
  }

  private applyEventFeedbackItemRemoved(item: ActivityContracts.EventFeedbackDto): void {
    const pageResult = this.eventFeedbackPageResult();
    this.patchEventFeedbackItem(item, pageResult?.removeItem(item) ?? item);
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved to Removed without feedback.`);
  }

  private applyEventFeedbackItemRestored(item: ActivityContracts.EventFeedbackDto): void {
    const pageResult = this.eventFeedbackPageResult();
    this.patchEventFeedbackItem(item, pageResult?.restoreItem(item) ?? item);
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved back to Pending.`);
  }

  protected onEventFeedbackCardPrimaryAction(card: InfoCardData): void {
    const item = this.eventFeedbackPageResult()?.itemById(card.id) ?? null;
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      this.openOrganizerEventFeedback(item.eventId);
      return;
    }
    if (!(this.eventFeedbackPageResult()?.itemMatchesFilter(item, 'pending') ?? false)) {
      return;
    }
    void this.startEventFeedback(item);
  }

  protected onEventFeedbackCardMenuAction(card: InfoCardData, event: CardMenuActionEvent<InfoCardData>): void {
    const item = this.eventFeedbackPageResult()?.itemById(card.id) ?? null;
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
    this.openEventFeedbackNotePopup(item);
  }

  private openRemoveEventFeedbackDialog(item: ActivityContracts.EventFeedbackDto): void {
    this.openEventFeedbackConfirmationDialog(
      this.eventFeedbackConfirmationDialogContent('remove'),
      async () => {
        await this.eventsService.removeEventFeedbackEvent(this.activeUserId(), item.eventId);
        this.applyEventFeedbackItemRemoved(item);
        this.removeVisibleEventFeedbackItem(item.eventId);
      }
    );
  }

  private openRestoreEventFeedbackDialog(item: ActivityContracts.EventFeedbackDto): void {
    this.openEventFeedbackConfirmationDialog(
      this.eventFeedbackConfirmationDialogContent('restore'),
      async () => {
        await this.eventsService.restoreEventFeedbackEvent(this.activeUserId(), item.eventId);
        this.applyEventFeedbackItemRestored(item);
        this.removeVisibleEventFeedbackItem(item.eventId);
      }
    );
  }

  private openEventFeedbackConfirmationDialog(
    content: EventFeedbackConfirmationDialogContent,
    onConfirm: () => Promise<void>
  ): void {
    this.confirmationDialogService.open({
      ...content,
      onConfirm
    });
  }

  private eventFeedbackConfirmationDialogContent(
    action: EventFeedbackConfirmationDialogAction
  ): EventFeedbackConfirmationDialogContent {
    if (action === 'remove') {
      return {
        title: 'event.feedback.confirm.remove.title',
        message: 'event.feedback.confirm.remove.message',
        warningMessage: 'event.feedback.confirm.remove.warning',
        confirmLabel: 'remove',
        busyConfirmLabel: 'removing',
        confirmTone: 'danger',
        failureMessage: 'event.feedback.confirm.remove.failure'
      };
    }
    return {
      title: 'event.feedback.confirm.restore.title',
      message: 'event.feedback.confirm.restore.message',
      confirmLabel: 'restore.feedback',
      busyConfirmLabel: 'restoring',
      confirmTone: 'accent',
      failureMessage: 'event.feedback.confirm.restore.failure'
    };
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
    const filter = query.filters?.filter ?? this.eventFeedbackListFilter();
    const normalizedUserId = (query.filters?.userId?.trim() || this.activeUserId()).trim();
    if (!normalizedUserId) {
      this.eventFeedbackPageResult.set(null);
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
    const pageResult = new ActivityContracts.EventFeedbackPageResultDto(result);
    this.eventFeedbackPageResult.set(pageResult);
    this.eventFeedbackFilterCountDelta.set({});
    return {
      items: EventFeedbackInfoCardConverter.convertList(pageResult.items, { state: pageResult.state }),
      total: result.total
    };
  }

  private activeUserId(): string {
    return this.appCtx.activeUserProfile()?.id?.trim() || this.appCtx.activeUserId().trim();
  }

  private async startEventFeedback(item: ActivityContracts.EventFeedbackDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!(this.eventFeedbackPageResult()?.itemMatchesFilter(item, 'pending') ?? false)) {
      return;
    }
    const userId = this.activeUserId();
    const eventId = item.eventId.trim();
    this.openEventFeedbackDetail(item);
    this.clearLoadedEventFeedbackDetail(eventId);
    this.eventFeedbackDetailLoading.set(true);
    this.eventFeedbackSubmitting.set(false);
    this.eventFeedbackSubmitted.set(false);
    this.eventFeedbackSubmitMessage.set('');
    if (!userId || !eventId) {
      this.applyLoadedEventFeedbackDetail(new ActivityContracts.EventFeedbackDetailDto({
        eventId,
        title: item.title,
        cards: []
      }), item.title);
      this.eventFeedbackDetailLoading.set(false);
      return;
    }
    try {
      const detail = await this.eventsService.loadEventFeedback({ userId, eventId });
      this.applyLoadedEventFeedbackDetail(detail, item.title);
    } finally {
      if (this.isEventFeedbackDetailLoadCurrent(eventId)) {
        this.eventFeedbackDetailLoading.set(false);
      }
    }
  }

  protected readonly eventFeedbackFlowModel = computed(() => EventFeedbackFormFlowConverter.convert(
    this.eventFeedbackDetailDto(),
    { eventTitle: this.eventFeedbackCurrentEventTitle() }
  ));

  protected async onEventFeedbackFlowSave(event: FormFlowSaveEvent): Promise<void> {
    if (this.eventFeedbackSubmitted() || this.eventFeedbackSubmitting()) {
      return;
    }
    const submittedAtIso = new Date().toISOString();
    const feedback = new ActivityContracts.EventFeedbackDetailDto(
      this.eventFeedbackDetailDto()
    ).withFormValue(event.value).submitted({ submittedAtIso });
    if (!feedback.eventId || feedback.cards.length === 0) {
      return;
    }
    this.eventFeedbackDetailValue.set(feedback);
    this.eventFeedbackSubmitting.set(true);
    try {
      await this.eventsService.submitEventFeedback(this.activeUserId(), feedback);
      this.appCtx.emitActivityEventFeedbackSubmit(feedback);
      this.eventFeedbackSubmitted.set(true);
      this.eventFeedbackSubmitMessage.set(`Feedback submitted successfully for ${this.eventFeedbackCurrentEventTitle()}.`);
      this.clearLoadedEventFeedbackDetail(feedback.eventId);
    } finally {
      this.eventFeedbackSubmitting.set(false);
    }
  }

  private applyLoadedEventFeedbackDetail(
    detail: ActivityContracts.EventFeedbackDetailDto,
    fallbackTitle: string
  ): void {
    if (!this.isEventFeedbackDetailLoadCurrent(detail.eventId)) {
      return;
    }
    const pendingDetail = detail.pending({
      activeUserId: this.activeUserId(),
      fallbackTitle
    });
    if (pendingDetail.cards.length === 0) {
      this.clearLoadedEventFeedbackDetail(pendingDetail.eventId);
      this.completeEmptyEventFeedbackDetail(fallbackTitle);
      return;
    }
    this.eventFeedbackDetailDto.set(pendingDetail);
    this.eventFeedbackDetailValue.set(pendingDetail.withEmptyAnswers());
  }

  private clearLoadedEventFeedbackDetail(eventId = ''): void {
    this.eventFeedbackDetailDto.set(null);
    this.eventFeedbackDetailValue.set(new ActivityContracts.EventFeedbackDetailDto({ eventId }));
    this.eventFeedbackSubmitting.set(false);
  }

  private applyActivityEventFeedbackSubmitSync(dto: ActivityContracts.EventFeedbackDetailDto): void {
    const eventId = dto.eventId.trim();
    if (!eventId) {
      return;
    }
    const pageResult = this.eventFeedbackPageResult();
    const sourceItem = pageResult?.itemById(eventId) ?? null;
    if (!pageResult || !sourceItem || sourceItem.isOwnEvent) {
      return;
    }
    const nextItem = pageResult.applySubmitToItem(sourceItem, dto);
    this.patchEventFeedbackItem(sourceItem, nextItem);
    if (!this.eventFeedbackSmartList) {
      return;
    }
    const currentItems = [...this.eventFeedbackSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(item => item.id === eventId);
    if (currentIndex < 0) {
      return;
    }
    const nextItems = [...currentItems];
    if (!pageResult.itemMatchesFilter(nextItem, this.eventFeedbackListFilter())) {
      nextItems.splice(currentIndex, 1);
      this.eventFeedbackSmartList.replaceVisibleItems(nextItems, {
        total: Math.max(nextItems.length, this.eventFeedbackSmartList.totalItemCount() - 1)
      });
      return;
    }
    nextItems[currentIndex] = EventFeedbackInfoCardConverter.convert(nextItem, {
      state: this.eventFeedbackPageResult()?.state ?? null
    });
    this.eventFeedbackSmartList.replaceVisibleItems(nextItems, {
      total: this.eventFeedbackSmartList.totalItemCount()
    });
  }

  protected submitEventFeedbackNote(): void {
    if (!this.canSubmitEventFeedbackNote()) {
      return;
    }
    const userId = this.activeUserId();
    const noteForm = this.eventFeedbackNoteForm();
    const eventId = noteForm.eventId.trim();
    const text = noteForm.text.trim();
    if (!userId || !eventId) {
      return;
    }
    void this.eventsService.saveEventFeedbackNote({ userId, eventId, text });
    this.applyEventFeedbackNoteSubmitted();
  }

  protected openOrganizerEventFeedback(eventId: string): void {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return;
    }
    this.eventFeedbackListFilter.set('own-events');
    this.selectedOrganizerEventFeedbackEventId.set(normalizedEventId);
    this.stackedPopupMode.set('organizerEventFeedback');
    this.isStackedPopupOpen.set(true);
  }

  protected selectOrganizerEventFeedbackCarousel(index: number): void {
    const sections = this.organizerEventFeedbackCarouselSections();
    if (index < 0 || index >= sections.length) {
      return;
    }
    this.organizerEventFeedbackCarouselIndex.set(index);
  }

}
