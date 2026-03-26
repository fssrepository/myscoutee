import { Injectable, computed, inject, signal } from '@angular/core';
import type * as AppTypes from '../../shared/core/base/models';
import { AppUtils } from '../../shared/app-utils';
import { APP_STATIC_DATA } from '../../shared/app-static-data';
import { DemoEventFeedbackBuilder } from '../../shared/core/demo/builders';
import { AppMemoryDb, EventsService } from '../../shared/core/base';
import { EVENT_FEEDBACK_TABLE_NAME } from '../../shared/core/demo/models/event-feedback.model';
import type { UserDto } from '../../shared/core';
import type { EventMenuItem } from '../../shared/core/base/interfaces/activity-feed.interface';

export interface EventFeedbackPopupSource {
  eventItems: EventMenuItem[];
  users: UserDto[];
  activeUser: UserDto;
  eventDatesById: Record<string, string>;
  activityImageById: Record<string, string>;
  eventStartAtMs(eventId: string): number | null;
  eventTitleById(eventId: string): string;
}

@Injectable({
  providedIn: 'root'
})
export class EventFeedbackPopupStateService {
  private readonly eventFeedbackUnlockDelayMs = 2 * 60 * 60 * 1000;
  private readonly sourceRef = signal<EventFeedbackPopupSource | null>(null);
  private readonly eventsService = inject(EventsService);
  private readonly memoryDb = inject(AppMemoryDb);

  public registerSource(source: EventFeedbackPopupSource | null): void {
    this.sourceRef.set(source);
    this.hydrateEventFeedbackState();
  }

  public readonly isPopupOpen = signal<boolean>(false);
  public readonly isStackedPopupOpen = signal<boolean>(false);
  public readonly stackedPopupMode = signal<'eventFeedback' | 'eventFeedbackNote' | null>(null);

  public readonly eventFeedbackCards = signal<AppTypes.EventFeedbackCard[]>([]);
  public readonly eventFeedbackIndex = signal<number>(0);
  public readonly eventFeedbackListFilter = signal<AppTypes.EventFeedbackListFilter>('pending');
  public readonly showEventFeedbackFilterPicker = signal<boolean>(false);
  public readonly eventFeedbackListSubmitMessage = signal<string>('');
  public readonly eventFeedbackCardMenuEventId = signal<string | null>(null);
  public readonly selectedEventFeedbackEventId = signal<string | null>(null);
  public readonly eventFeedbackSubmittedState = signal<boolean>(false);
  public readonly eventFeedbackSubmitMessage = signal<string>('');
  public readonly eventFeedbackSlideAnimClass = signal<string>('');
  
  public readonly eventFeedbackNoteForm = signal({ eventId: '', text: '' });
  public readonly eventFeedbackNoteSubmitted = signal<boolean>(false);
  public readonly eventFeedbackNoteSubmitMessage = signal<string>('');

  private eventFeedbackTouchStartX: number | null = null;
  private eventFeedbackTouchStartY: number | null = null;
  private eventFeedbackSlideAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly submittedEventFeedbackByUser = signal<Record<string, Record<string, true>>>({});
  private readonly submittedEventFeedbackAnswersByUser = signal<Record<string, Record<string, AppTypes.SubmittedEventFeedbackAnswer>>>({});
  private readonly submittedEventFeedbackEventsByUser = signal<Record<string, Record<string, string>>>({});
  private readonly removedEventFeedbackEventsByUser = signal<Record<string, Record<string, true>>>({});
  private readonly organizerEventFeedbackNotesByUser = signal<Record<string, Record<string, string>>>({});

  public readonly eventFeedbackEventOverallOptions = APP_STATIC_DATA.eventFeedbackEventOverallOptions;
  public readonly eventFeedbackHostImproveOptions = APP_STATIC_DATA.eventFeedbackHostImproveOptions;
  public readonly eventFeedbackAttendeeCollabOptions = APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions;
  public readonly eventFeedbackAttendeeRejoinOptions = APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions;
  public readonly eventFeedbackListFilters: Array<{ key: AppTypes.EventFeedbackListFilter; label: string; icon: string }> = APP_STATIC_DATA.eventFeedbackListFilters;

  public openPopup(): void {
    this.eventFeedbackListFilter.set('pending');
    this.showEventFeedbackFilterPicker.set(false);
    this.eventFeedbackListSubmitMessage.set('');
    this.eventFeedbackCardMenuEventId.set(null);
    this.selectedEventFeedbackEventId.set(null);
    this.eventFeedbackCards.set([]);
    this.eventFeedbackIndex.set(0);
    this.eventFeedbackSubmittedState.set(false);
    this.eventFeedbackSubmitMessage.set('');
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass.set('');
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    this.hydrateEventFeedbackState();
    this.isPopupOpen.set(true);
  }

  public closePopup(): void {
    this.isPopupOpen.set(false);
  }

  public closeStackedPopup(): void {
    this.isStackedPopupOpen.set(false);
    this.stackedPopupMode.set(null);
  }

  public toggleEventFeedbackFilterPicker(event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker.update(v => !v);
  }

  public selectEventFeedbackListFilter(filter: AppTypes.EventFeedbackListFilter, event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackListFilter.set(filter);
    this.showEventFeedbackFilterPicker.set(false);
    this.eventFeedbackCardMenuEventId.set(null);
  }

  public closeEventFeedbackFilterPicker(event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker.set(false);
  }

  public isEventFeedbackCardMenuOpen(item: AppTypes.EventFeedbackEventCard): boolean {
    return this.eventFeedbackCardMenuEventId() === item.eventId;
  }

  public toggleEventFeedbackCardMenu(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.showEventFeedbackFilterPicker.set(false);
    this.eventFeedbackCardMenuEventId.set(this.eventFeedbackCardMenuEventId() === item.eventId ? null : item.eventId);
  }

  public closeEventFeedbackCardMenu(event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackCardMenuEventId.set(null);
  }

  public isEventFeedbackStartAvailable(item: AppTypes.EventFeedbackEventCard): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  public eventFeedbackItemStatusLine(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  public eventFeedbackCurrentEventTitle(): string {
    const eventId = this.selectedEventFeedbackEventId() ?? this.eventFeedbackNoteForm().eventId;
    return this.sourceRef()?.eventTitleById(eventId) ?? 'this event';
  }

  public hasEventFeedbackOrganizerNote(eventId: string): boolean {
    const user = this.sourceRef()?.activeUser;
    if (!user) return false;
    return Boolean(this.organizerEventFeedbackNotesByUser()[user.id]?.[eventId]?.trim());
  }

  public startEventFeedback(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.closeEventFeedbackCardMenu();
    this.showEventFeedbackFilterPicker.set(false);
    this.restoreEventFeedbackEvent(item.eventId);
    this.persistEventRemovedState(item.eventId, false);
    this.selectedEventFeedbackEventId.set(item.eventId);
    
    const cards = this.pendingEventFeedbackCardsForEvent(item.eventId).map(card => ({ ...card }));
    this.eventFeedbackCards.set(cards);
    this.eventFeedbackIndex.set(0);
    this.eventFeedbackSubmittedState.set(false);
    this.eventFeedbackSubmitMessage.set('');
    
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass.set('');
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    
    if (cards.length === 0) {
      this.eventFeedbackListSubmitMessage.set(`${item.title} is already in Feedbacked.`);
      this.eventFeedbackListFilter.set('feedbacked');
      return;
    }
    
    this.stackedPopupMode.set('eventFeedback');
    this.isStackedPopupOpen.set(true);
  }

  public removeEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.markEventFeedbackEventRemoved(item.eventId);
    this.persistEventRemovedState(item.eventId, true);
    this.closeEventFeedbackCardMenu();
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved to Removed without feedback.`);
    this.eventFeedbackListFilter.set('removed');
  }

  public restoreRemovedEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.restoreEventFeedbackEvent(item.eventId);
    this.persistEventRemovedState(item.eventId, false);
    this.closeEventFeedbackCardMenu();
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved back to Pending.`);
    this.eventFeedbackListFilter.set('pending');
  }

  public openEventFeedbackNotePopup(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.closeEventFeedbackCardMenu();
    this.showEventFeedbackFilterPicker.set(false);
    this.selectedEventFeedbackEventId.set(item.eventId);
    
    const user = this.sourceRef()?.activeUser;
    this.eventFeedbackNoteForm.set({
      eventId: item.eventId,
      text: user ? (this.organizerEventFeedbackNotesByUser()[user.id]?.[item.eventId] ?? '') : ''
    });
    
    this.eventFeedbackNoteSubmitted.set(false);
    this.eventFeedbackNoteSubmitMessage.set('');
    this.stackedPopupMode.set('eventFeedbackNote');
    this.isStackedPopupOpen.set(true);
  }

  public canSubmitEventFeedbackNote(): boolean {
    return this.eventFeedbackNoteForm().text.trim().length >= 8;
  }

  public submitEventFeedbackNote(): void {
    if (!this.canSubmitEventFeedbackNote()) {
      return;
    }
    const user = this.sourceRef()?.activeUser;
    if (!user) return;

    const noteForm = this.eventFeedbackNoteForm();
    const eventId = noteForm.eventId;
    const trimmedText = noteForm.text.trim();

    this.organizerEventFeedbackNotesByUser.update(state => {
      const nextByUser = { ...(state[user.id] ?? {}) };
      nextByUser[eventId] = trimmedText;
      return { ...state, [user.id]: nextByUser };
    });
    this.updatePersistedEventFeedbackState(user.id, eventId, current => ({
      ...current,
      removed: false,
      organizerNote: trimmedText
    }));
    void this.eventsService.saveEventFeedbackNote({
      userId: user.id,
      eventId,
      text: trimmedText
    });

    this.eventFeedbackNoteSubmitted.set(true);
    const msg = `Organizer feedback saved for ${this.sourceRef()?.eventTitleById(eventId)}.`;
    this.eventFeedbackNoteSubmitMessage.set(msg);
    this.eventFeedbackListSubmitMessage.set(msg);
  }

  public selectEventFeedbackSlide(index: number, event?: Event): void {
    event?.stopPropagation();
    const cards = this.eventFeedbackCards();
    if (index < 0 || index >= cards.length) {
      return;
    }
    const currentIndex = this.eventFeedbackIndex();
    if (index === currentIndex) {
      return;
    }
    const direction = index > currentIndex ? 'next' : 'prev';
    this.eventFeedbackIndex.set(index);
    this.playEventFeedbackSlideAnimation(direction);
  }

  public previousEventFeedbackSlide(event?: Event): void {
    event?.stopPropagation();
    const currentIndex = this.eventFeedbackIndex();
    if (!this.hasEventFeedbackCards() || currentIndex <= 0) {
      return;
    }
    this.eventFeedbackIndex.set(currentIndex - 1);
    this.playEventFeedbackSlideAnimation('prev');
  }

  public nextEventFeedbackSlide(event?: Event): void {
    event?.stopPropagation();
    const currentIndex = this.eventFeedbackIndex();
    if (!this.hasEventFeedbackCards() || currentIndex >= this.eventFeedbackCards().length - 1) {
      return;
    }
    this.eventFeedbackIndex.set(currentIndex + 1);
    this.playEventFeedbackSlideAnimation('next');
  }

  public selectEventFeedbackPrimary(optionValue: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.activeEventFeedbackCard();
    if (!card || !card.primaryOptions.some(option => option.value === optionValue)) {
      return;
    }
    this.eventFeedbackCards.update(cards => {
      const idx = this.eventFeedbackIndex();
      const updated = [...cards];
      updated[idx] = { ...updated[idx], answerPrimary: optionValue };
      return updated;
    });
  }

  public selectEventFeedbackSecondary(optionValue: string, event?: Event): void {
    event?.stopPropagation();
    const card = this.activeEventFeedbackCard();
    if (!card || !card.secondaryOptions.some(option => option.value === optionValue)) {
      return;
    }
    this.eventFeedbackCards.update(cards => {
      const idx = this.eventFeedbackIndex();
      const updated = [...cards];
      updated[idx] = { ...updated[idx], answerSecondary: optionValue };
      return updated;
    });
  }

  public isEventFeedbackPrimarySelected(optionValue: string): boolean {
    return this.activeEventFeedbackCard()?.answerPrimary === optionValue;
  }

  public isEventFeedbackSecondarySelected(optionValue: string): boolean {
    return this.activeEventFeedbackCard()?.answerSecondary === optionValue;
  }

  public eventFeedbackOptionToneClass(card: AppTypes.EventFeedbackCard, option: AppTypes.EventFeedbackOption): string {
    const tone = this.feedbackToneFromOptionValue(option.value);
    return `event-feedback-option-tone-${tone}`;
  }

  private feedbackToneFromOptionValue(optionValue: string): string {
    switch (optionValue.trim().toLowerCase()) {
      case 'excellent':
      case 'great':
      case 'yes':
        return 'sky';
      case 'good':
      case 'reliable':
        return 'aqua';
      case 'mixed':
      case 'communication':
      case 'neutral':
      case 'maybe':
        return 'violet';
      case 'needs-work':
      case 'resources':
      case 'context':
        return 'mint';
      case 'timing':
      case 'rough':
        return 'amber';
      case 'none':
      case 'no':
        return 'slate';
      default:
        return 'sky';
    }
  }

  public canSubmitActiveEventFeedback(): boolean {
    const card = this.activeEventFeedbackCard();
    if (!card) {
      return false;
    }
    return !this.isSelfAttendeeFeedbackCard(card);
  }

  public submitActiveEventFeedback(): void {
    if (this.eventFeedbackSubmittedState()) {
      return;
    }
    const user = this.sourceRef()?.activeUser;
    const card = this.activeEventFeedbackCard();
    if (!user || !card || this.isSelfAttendeeFeedbackCard(card)) {
      return;
    }
    this.eventFeedbackSubmittedState.set(true);
    const eventId = card.eventId;
    const eventTitle = this.sourceRef()?.eventTitleById(eventId) ?? '';
    const cardsToSubmit = [...this.eventFeedbackCards()];
    const submittedAtIso = AppUtils.toIsoDateTime(new Date());
    const persistedAnswers: Record<string, AppTypes.SubmittedEventFeedbackAnswer> = {};
    const requestAnswers: AppTypes.EventFeedbackAnswerSubmitDto[] = [];
    for (const feedbackCard of cardsToSubmit) {
      const impressionSummary = this.selectedImpressionTagsForCard(feedbackCard);
      this.markEventFeedbackSubmitted(feedbackCard.id);
      const submittedAnswer = this.recordSubmittedEventFeedbackAnswer(feedbackCard, impressionSummary, submittedAtIso);
      persistedAnswers[submittedAnswer.cardId] = submittedAnswer;
      requestAnswers.push({
        cardId: submittedAnswer.cardId,
        kind: submittedAnswer.kind,
        targetUserId: submittedAnswer.targetUserId,
        targetRole: submittedAnswer.targetRole,
        primaryValue: submittedAnswer.primaryValue,
        secondaryValue: submittedAnswer.secondaryValue,
        tags: [...submittedAnswer.tags],
        submittedAtIso: submittedAnswer.submittedAtIso
      });
    }
    this.markEventFeedbackEventSubmitted(eventId);
    this.restoreEventFeedbackEvent(eventId);
    this.updatePersistedEventFeedbackState(user.id, eventId, current => ({
      ...current,
      removed: false,
      submittedAtIso,
      answersByCardId: {
        ...current.answersByCardId,
        ...persistedAnswers
      }
    }));
    void this.eventsService.submitEventFeedback({
      userId: user.id,
      eventId,
      answers: requestAnswers
    });
    this.eventFeedbackCards.set([]);
    this.eventFeedbackIndex.set(0);
    this.eventFeedbackSubmitMessage.set(`Feedback submitted successfully for ${eventTitle}.`);
    this.eventFeedbackListSubmitMessage.set(`${eventTitle} moved to Feedbacked.`);
    this.eventFeedbackListFilter.set('feedbacked');
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass.set('');
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
  }

  public onEventFeedbackTouchStart(event: TouchEvent): void {
    if (!this.hasEventFeedbackCards()) {
      return;
    }
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    this.eventFeedbackTouchStartX = touch.clientX;
    this.eventFeedbackTouchStartY = touch.clientY;
  }

  public onEventFeedbackTouchEnd(event: TouchEvent): void {
    if (!this.hasEventFeedbackCards() || this.eventFeedbackTouchStartX === null || this.eventFeedbackTouchStartY === null) {
      this.eventFeedbackTouchStartX = null;
      this.eventFeedbackTouchStartY = null;
      return;
    }
    const touch = event.changedTouches?.[0];
    if (!touch) {
      this.eventFeedbackTouchStartX = null;
      this.eventFeedbackTouchStartY = null;
      return;
    }
    const deltaX = touch.clientX - this.eventFeedbackTouchStartX;
    const deltaY = touch.clientY - this.eventFeedbackTouchStartY;
    this.eventFeedbackTouchStartX = null;
    this.eventFeedbackTouchStartY = null;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) {
      return;
    }
    if (deltaX < 0) {
      this.nextEventFeedbackSlide();
      return;
    }
    this.previousEventFeedbackSlide();
  }

  private hydrateEventFeedbackState(): void {
    const userId = this.sourceRef()?.activeUser?.id?.trim();
    if (!userId) {
      return;
    }
    this.applyPersistedEventFeedbackSignals(userId);
    void this.refreshEventFeedbackStateFromServer(userId);
  }

  private async refreshEventFeedbackStateFromServer(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const states = await this.eventsService.queryEventFeedbackStates(normalizedUserId);
    if ((this.sourceRef()?.activeUser?.id?.trim() ?? '') !== normalizedUserId) {
      return;
    }
    this.mergeServerEventFeedbackStates(normalizedUserId, states);
  }

  private mergeServerEventFeedbackStates(userId: string, states: AppTypes.EventFeedbackStateDto[]): void {
    this.memoryDb.write(current => {
      const table = current[EVENT_FEEDBACK_TABLE_NAME];
      const nextById = { ...table.byId };
      const nextIds = [...table.ids];
      for (const state of states) {
        const eventId = state.eventId?.trim() ?? '';
        if (!eventId) {
          continue;
        }
        const recordId = this.eventFeedbackStateRecordId(userId, eventId);
        const existing = nextById[recordId] ?? this.createEmptyPersistedEventFeedbackState(userId, eventId);
        nextById[recordId] = {
          ...existing,
          removed: Boolean(state.removed),
          submittedAtIso: state.submittedAtIso?.trim() || null,
          organizerNote: state.organizerNote?.trim() ?? existing.organizerNote
        };
        if (!nextIds.includes(recordId)) {
          nextIds.push(recordId);
        }
      }
      return {
        ...current,
        [EVENT_FEEDBACK_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      };
    });
    this.applyPersistedEventFeedbackSignals(userId);
  }

  private applyPersistedEventFeedbackSignals(userId: string): void {
    const submittedCards: Record<string, true> = {};
    const submittedAnswers: Record<string, AppTypes.SubmittedEventFeedbackAnswer> = {};
    const submittedEvents: Record<string, string> = {};
    const removedEvents: Record<string, true> = {};
    const organizerNotes: Record<string, string> = {};

    for (const record of this.readPersistedEventFeedbackStates(userId)) {
      if (record.removed) {
        removedEvents[record.eventId] = true;
      }
      if (record.submittedAtIso) {
        submittedEvents[record.eventId] = record.submittedAtIso;
      }
      if (record.organizerNote.trim()) {
        organizerNotes[record.eventId] = record.organizerNote.trim();
      }
      for (const [cardId, answer] of Object.entries(record.answersByCardId ?? {})) {
        submittedCards[cardId] = true;
        submittedAnswers[cardId] = {
          ...answer,
          tags: [...(answer.tags ?? [])]
        };
      }
    }

    this.submittedEventFeedbackByUser.update(state => ({ ...state, [userId]: submittedCards }));
    this.submittedEventFeedbackAnswersByUser.update(state => ({ ...state, [userId]: submittedAnswers }));
    this.submittedEventFeedbackEventsByUser.update(state => ({ ...state, [userId]: submittedEvents }));
    this.removedEventFeedbackEventsByUser.update(state => ({ ...state, [userId]: removedEvents }));
    this.organizerEventFeedbackNotesByUser.update(state => ({ ...state, [userId]: organizerNotes }));
  }

  private readPersistedEventFeedbackStates(userId: string): AppTypes.EventFeedbackPersistedState[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is AppTypes.EventFeedbackPersistedState => Boolean(record) && record.userId === normalizedUserId)
      .map(record => ({
        ...record,
        answersByCardId: { ...(record.answersByCardId ?? {}) }
      }));
  }

  private updatePersistedEventFeedbackState(
    userId: string,
    eventId: string,
    updater: (current: AppTypes.EventFeedbackPersistedState) => AppTypes.EventFeedbackPersistedState
  ): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.memoryDb.write(current => {
      const table = current[EVENT_FEEDBACK_TABLE_NAME];
      const recordId = this.eventFeedbackStateRecordId(normalizedUserId, normalizedEventId);
      const existing = table.byId[recordId] ?? this.createEmptyPersistedEventFeedbackState(normalizedUserId, normalizedEventId);
      const nextRecord = updater({
        ...existing,
        answersByCardId: { ...(existing.answersByCardId ?? {}) }
      });
      return {
        ...current,
        [EVENT_FEEDBACK_TABLE_NAME]: {
          byId: {
            ...table.byId,
            [recordId]: nextRecord
          },
          ids: table.ids.includes(recordId) ? table.ids : [...table.ids, recordId]
        }
      };
    });
    this.applyPersistedEventFeedbackSignals(normalizedUserId);
  }

  private persistEventRemovedState(eventId: string, removed: boolean): void {
    const userId = this.sourceRef()?.activeUser?.id?.trim();
    const normalizedEventId = eventId.trim();
    if (!userId || !normalizedEventId) {
      return;
    }
    this.updatePersistedEventFeedbackState(userId, normalizedEventId, current => ({
      ...current,
      removed
    }));
    if (removed) {
      void this.eventsService.removeEventFeedbackEvent(userId, normalizedEventId);
      return;
    }
    void this.eventsService.restoreEventFeedbackEvent(userId, normalizedEventId);
  }

  private createEmptyPersistedEventFeedbackState(userId: string, eventId: string): AppTypes.EventFeedbackPersistedState {
    return {
      id: this.eventFeedbackStateRecordId(userId, eventId),
      userId,
      eventId,
      removed: false,
      submittedAtIso: null,
      organizerNote: '',
      answersByCardId: {}
    };
  }

  private eventFeedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

  // --- Computed Properties ---

  public readonly hasEventFeedbackCards = computed(() => this.eventFeedbackCards().length > 0);
  
  public readonly activeEventFeedbackCard = computed(() => this.eventFeedbackCards()[this.eventFeedbackIndex()] ?? null);
  
  public readonly eventFeedbackDotIndices = computed(() => this.eventFeedbackCards().map((_, index) => index));
  
  public readonly eventFeedbackOnLastSlide = computed(() => this.hasEventFeedbackCards() && this.eventFeedbackIndex() >= this.eventFeedbackCards().length - 1);
  
  public readonly eventFeedbackSlideCounterLabel = computed(() => {
    if (!this.hasEventFeedbackCards()) {
      return '0 / 0';
    }
    return `${this.eventFeedbackIndex() + 1} / ${this.eventFeedbackCards().length}`;
  });

  public readonly eventFeedbackFilterLabel = computed(() => 
    this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter())?.label ?? 'Pending'
  );

  public readonly eventFeedbackFilterIcon = computed(() => 
    this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter())?.icon ?? 'schedule'
  );

  public readonly eventFeedbackPendingCount = computed(() => this.eventFeedbackPendingItems().length);
  public readonly eventFeedbackFeedbackedCount = computed(() => this.eventFeedbackFeedbackedItems().length);
  public readonly eventFeedbackRemovedCount = computed(() => this.eventFeedbackRemovedItems().length);

  public eventFeedbackFilterCount(filter: AppTypes.EventFeedbackListFilter): number {
    switch (filter) {
      case 'feedbacked': return this.eventFeedbackFeedbackedCount();
      case 'removed': return this.eventFeedbackRemovedCount();
      case 'pending':
      default: return this.eventFeedbackPendingCount();
    }
  }

  public eventFeedbackFilterOptionClass(filter: AppTypes.EventFeedbackListFilter): string {
    switch (filter) {
      case 'feedbacked': return 'event-feedback-filter-option-feedbacked';
      case 'removed': return 'event-feedback-filter-option-removed';
      case 'pending':
      default: return 'event-feedback-filter-option-pending';
    }
  }

  public eventFeedbackFilterBadgeClass(filter: AppTypes.EventFeedbackListFilter): string {
    switch (filter) {
      case 'feedbacked': return 'event-feedback-filter-badge-feedbacked';
      case 'removed': return 'event-feedback-filter-badge-removed';
      case 'pending':
      default: return 'event-feedback-filter-badge-pending';
    }
  }

  public readonly eventFeedbackVisibleItems = computed(() => {
    switch (this.eventFeedbackListFilter()) {
      case 'feedbacked': return this.eventFeedbackFeedbackedItems();
      case 'removed': return this.eventFeedbackRemovedItems();
      case 'pending':
      default: return this.eventFeedbackPendingItems();
    }
  });

  private playEventFeedbackSlideAnimation(direction: 'next' | 'prev'): void {
    const nextClass = direction === 'next'
      ? 'event-feedback-slide-enter-next'
      : 'event-feedback-slide-enter-prev';
    if (this.eventFeedbackSlideAnimationTimer) {
      clearTimeout(this.eventFeedbackSlideAnimationTimer);
      this.eventFeedbackSlideAnimationTimer = null;
    }
    this.eventFeedbackSlideAnimClass.set('');
    // Ideally use cdr here, but signal change should trigger CD naturally
    setTimeout(() => {
      this.eventFeedbackSlideAnimClass.set(nextClass);
      this.eventFeedbackSlideAnimationTimer = setTimeout(() => {
        this.eventFeedbackSlideAnimClass.set('');
        this.eventFeedbackSlideAnimationTimer = null;
      }, 260);
    }, 0);
  }

  // --- Internal Data Helpers ---
  
  private buildEventFeedbackCardsData(): AppTypes.EventFeedbackCard[] {
    const source = this.sourceRef();
    if (!source) return [];
    return DemoEventFeedbackBuilder.buildEventFeedbackCards({
      eventItems: source.eventItems,
      users: source.users,
      activeUser: source.activeUser,
      eventDatesById: source.eventDatesById,
      activityImageById: source.activityImageById,
      eventFeedbackUnlockDelayMs: this.eventFeedbackUnlockDelayMs,
      eventOverallOptions: this.eventFeedbackEventOverallOptions,
      hostImproveOptions: this.eventFeedbackHostImproveOptions,
      attendeeCollabOptions: this.eventFeedbackAttendeeCollabOptions,
      attendeeRejoinOptions: this.eventFeedbackAttendeeRejoinOptions
    });
  }

  private pendingEventFeedbackCardsForEvent(eventId: string): AppTypes.EventFeedbackCard[] {
    return this.buildEventFeedbackCardsData().filter(card =>
      card.eventId === eventId &&
      !this.isSelfAttendeeFeedbackCard(card) &&
      !this.isEventFeedbackEventSubmitted(card.eventId) &&
      !this.isEventFeedbackSubmitted(card.id)
    );
  }

  private isSelfAttendeeFeedbackCard(card: AppTypes.EventFeedbackCard): boolean {
    const user = this.sourceRef()?.activeUser;
    return card.kind === 'attendee' && card.attendeeUserId === user?.id;
  }

  private isEventFeedbackSubmitted(cardId: string): boolean {
    const user = this.sourceRef()?.activeUser;
    if (!user) return false;
    return Boolean(this.submittedEventFeedbackByUser()[user.id]?.[cardId]);
  }

  private markEventFeedbackSubmitted(cardId: string): void {
    const user = this.sourceRef()?.activeUser;
    if (!user) return;
    this.submittedEventFeedbackByUser.update(state => {
      const current = { ...(state[user.id] ?? {}) };
      current[cardId] = true;
      return { ...state, [user.id]: current };
    });
  }

  private markEventFeedbackEventSubmitted(eventId: string): void {
    const user = this.sourceRef()?.activeUser;
    if (!user) return;
    this.submittedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[user.id] ?? {}) };
      current[eventId] = new Date().toISOString();
      return { ...state, [user.id]: current };
    });
  }

  private eventFeedbackEventSubmittedAtMs(eventId: string): number | null {
    const user = this.sourceRef()?.activeUser;
    if (!user) return null;
    const iso = this.submittedEventFeedbackEventsByUser()[user.id]?.[eventId];
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private isEventFeedbackEventSubmitted(eventId: string): boolean {
    const user = this.sourceRef()?.activeUser;
    if (!user) return false;
    return Boolean(this.submittedEventFeedbackEventsByUser()[user.id]?.[eventId]);
  }

  private isEventFeedbackEventRemoved(eventId: string): boolean {
    const user = this.sourceRef()?.activeUser;
    if (!user) return false;
    return Boolean(this.removedEventFeedbackEventsByUser()[user.id]?.[eventId]);
  }

  private markEventFeedbackEventRemoved(eventId: string): void {
    const user = this.sourceRef()?.activeUser;
    if (!user) return;
    this.removedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[user.id] ?? {}) };
      current[eventId] = true;
      return { ...state, [user.id]: current };
    });
  }

  private restoreEventFeedbackEvent(eventId: string): void {
    const user = this.sourceRef()?.activeUser;
    if (!user) return;
    this.removedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[user.id] ?? {}) };
      delete current[eventId];
      return { ...state, [user.id]: current };
    });
  }

  private selectedImpressionTagsForCard(card: AppTypes.EventFeedbackCard): string[] {
    const tags = new Set<string>();
    const primary = card.primaryOptions.find(option => option.value === card.answerPrimary)?.impressionTag;
    const secondary = card.secondaryOptions.find(option => option.value === card.answerSecondary)?.impressionTag;
    if (primary) tags.add(primary);
    if (secondary) tags.add(secondary);
    return [...tags];
  }

  private recordSubmittedEventFeedbackAnswer(
    card: AppTypes.EventFeedbackCard,
    tags: string[],
    submittedAtIso: string
  ): AppTypes.SubmittedEventFeedbackAnswer {
    const submittedAnswer: AppTypes.SubmittedEventFeedbackAnswer = {
      cardId: card.id,
      eventId: card.eventId,
      kind: card.kind,
      targetUserId: card.targetUserId ?? null,
      targetRole: card.targetRole ?? 'Member',
      primaryValue: card.answerPrimary,
      secondaryValue: card.answerSecondary,
      tags: [...tags],
      submittedAtIso
    };
    const user = this.sourceRef()?.activeUser;
    if (user) {
      this.submittedEventFeedbackAnswersByUser.update(state => {
        const byUser = { ...(state[user.id] ?? {}) };
        byUser[card.id] = submittedAnswer;
        return { ...state, [user.id]: byUser };
      });
    }
    return submittedAnswer;
  }

  public readonly eventFeedbackAllItems = computed(() => {
    const source = this.sourceRef();
    if (!source) return [];
    const countsByEvent = new Map<string, { pending: number; total: number }>();
    for (const card of this.buildEventFeedbackCardsData()) {
      if (this.isSelfAttendeeFeedbackCard(card)) continue;
      const current = countsByEvent.get(card.eventId) ?? { pending: 0, total: 0 };
      current.total += 1;
      if (!this.isEventFeedbackEventSubmitted(card.eventId) && !this.isEventFeedbackSubmitted(card.id)) current.pending += 1;
      countsByEvent.set(card.eventId, current);
    }

    const items: AppTypes.EventFeedbackEventCard[] = [];
    const nowMs = Date.now();
    for (const item of source.eventItems) {
      if (item.isAdmin) continue;
      const startMs = source.eventStartAtMs(item.id);
      if (startMs === null || nowMs < startMs + this.eventFeedbackUnlockDelayMs) continue;
      
      const counts = countsByEvent.get(item.id);
      if (!counts || counts.total === 0) continue;
      
      const isRemoved = this.isEventFeedbackEventRemoved(item.id);
      const feedbackedAtMs = this.eventFeedbackEventSubmittedAtMs(item.id);
      items.push({
        eventId: item.id,
        title: item.title,
        subtitle: item.shortDescription,
        timeframe: item.timeframe,
        imageUrl: source.activityImageById[item.id] ?? `https://picsum.photos/seed/event-feedback-${item.id}/1200/700`,
        startAtMs: startMs,
        pendingCards: counts.pending,
        totalCards: counts.total,
        isRemoved,
        isFeedbacked: !isRemoved && counts.pending === 0,
        feedbackedAtMs
      });
    }
    return items;
  });

  public readonly eventFeedbackPendingItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => !item.isRemoved && item.pendingCards > 0)
      .sort((a, b) => a.startAtMs - b.startAtMs);
  });

  public readonly eventFeedbackFeedbackedItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => item.isFeedbacked)
      .sort((a, b) => {
        const first = a.feedbackedAtMs ?? a.startAtMs;
        const second = b.feedbackedAtMs ?? b.startAtMs;
        return second - first;
      });
  });

  public readonly eventFeedbackRemovedItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => item.isRemoved)
      .sort((a, b) => b.startAtMs - a.startAtMs);
  });
}
