import { Injectable, computed, inject, signal } from '@angular/core';
import type * as AppTypes from '../../shared/core/base/models';
import type * as ActivityContracts from '../../shared/core/contracts/activity.interface';
import { AppUtils } from '../../shared/app-utils';
import { APP_STATIC_DATA } from '../../shared/app-static-data';
import {
  AppContext,
  type EventFeedbackPageViewModel,
} from '../../shared/ui';
import type { EventFeedbackListFilter } from '../../shared/core/common/constants';

export interface EventFeedbackListFilters {
  filter: EventFeedbackListFilter;
  userId: string;
}

interface OrganizerEventFeedbackItem {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number | null;
  responseCount: number;
  noteCount: number;
  latestActivityAtMs: number | null;
}

interface OrganizerEventFeedbackStatItem {
  key: string;
  label: string;
  icon: string;
  count: number;
}

interface OrganizerEventFeedbackMessageItem {
  id: string;
  viewerUserId: string;
  viewerName: string;
  viewerInitials: string;
  viewerGender: string;
  viewerImageUrl: string;
  timestampIso: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  organizerNote: string;
  overallLabel: string | null;
  improveLabel: string | null;
  traitLabels: string[];
  responseCount: number;
}

interface OrganizerEventFeedbackMessageGroup {
  dayKey: string;
  label: string;
  items: OrganizerEventFeedbackMessageItem[];
}

interface EventFeedbackStateOverride {
  removed?: boolean;
  removedAtIso?: string | null;
  submittedAtIso?: string;
  organizerNote?: string;
  answersByCardId?: Record<string, ActivityContracts.SubmittedEventFeedbackAnswer>;
}

@Injectable({
  providedIn: 'root'
})
export class EventFeedbackPopupStateService {
  private readonly appCtx = inject(AppContext);

  public readonly isPopupOpen = signal<boolean>(false);
  public readonly isStackedPopupOpen = signal<boolean>(false);
  public readonly stackedPopupMode = signal<'eventFeedback' | 'eventFeedbackNote' | 'organizerEventFeedback' | null>(null);

  public readonly eventFeedbackListFilter = signal<EventFeedbackListFilter>('pending');
  public readonly eventFeedbackListSubmitMessage = signal<string>('');
  public readonly selectedEventFeedbackEventId = signal<string | null>(null);
  public readonly selectedOrganizerEventFeedbackEventId = signal<string | null>(null);
  public readonly eventFeedbackSubmittedState = signal<boolean>(false);
  public readonly eventFeedbackSubmitMessage = signal<string>('');
  
  public readonly eventFeedbackNoteForm = signal({ eventId: '', text: '' });
  public readonly eventFeedbackNoteSubmitted = signal<boolean>(false);
  public readonly eventFeedbackNoteSubmitMessage = signal<string>('');

  private readonly submittedEventFeedbackByUser = signal<Record<string, Record<string, true>>>({});
  private readonly submittedEventFeedbackAnswersByUser = signal<Record<string, Record<string, ActivityContracts.SubmittedEventFeedbackAnswer>>>({});
  private readonly submittedEventFeedbackEventsByUser = signal<Record<string, Record<string, string>>>({});
  private readonly removedEventFeedbackEventsByUser = signal<Record<string, Record<string, true>>>({});
  private readonly removedEventFeedbackEventDatesByUser = signal<Record<string, Record<string, string>>>({});
  private readonly organizerEventFeedbackNotesByUser = signal<Record<string, Record<string, string>>>({});
  private readonly eventFeedbackStateOverridesByUser = signal<Record<string, Record<string, EventFeedbackStateOverride>>>({});
  private readonly receivedEventFeedbackByEventId = signal<Record<string, ActivityContracts.EventFeedbackReceivedEventDto>>({});
  private readonly loadedEventFeedbackItems = signal<AppTypes.EventFeedbackEventCard[]>([]);
  private readonly loadedOrganizerEventFeedbackItems = signal<AppTypes.EventFeedbackEventCard[]>([]);
  private readonly loadedEventFeedbackTitleById = signal<Record<string, string>>({});

  public readonly eventFeedbackEventOverallOptions = APP_STATIC_DATA.eventFeedbackEventOverallOptions;
  public readonly eventFeedbackHostImproveOptions = APP_STATIC_DATA.eventFeedbackHostImproveOptions;
  public readonly eventFeedbackAttendeeCollabOptions = APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions;
  public readonly eventFeedbackAttendeeRejoinOptions = APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions;
  public readonly eventFeedbackPersonalityTraitOptions = APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions;
  public readonly eventFeedbackListFilters: Array<{ key: EventFeedbackListFilter; label: string; icon: string }> = APP_STATIC_DATA.eventFeedbackListFilters;

  public openPopup(): void {
    this.eventFeedbackListFilter.set('pending');
    this.eventFeedbackListSubmitMessage.set('');
    this.selectedEventFeedbackEventId.set(null);
    this.selectedOrganizerEventFeedbackEventId.set(null);
    this.eventFeedbackSubmittedState.set(false);
    this.eventFeedbackSubmitMessage.set('');
    this.clearEventFeedbackListView(this.activeUserId());
    this.isPopupOpen.set(true);
  }

  public closePopup(): void {
    this.isPopupOpen.set(false);
  }

  public closeStackedPopup(): void {
    this.isStackedPopupOpen.set(false);
    this.stackedPopupMode.set(null);
    this.selectedOrganizerEventFeedbackEventId.set(null);
  }

  public selectEventFeedbackListFilter(filter: EventFeedbackListFilter, event?: Event): void {
    event?.stopPropagation();
    this.eventFeedbackListFilter.set(filter);
    this.selectedOrganizerEventFeedbackEventId.set(null);
  }

  public isEventFeedbackStartAvailable(item: AppTypes.EventFeedbackEventCard): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  public eventFeedbackCurrentEventTitle(): string {
    const eventId =
      this.selectedOrganizerEventFeedbackEventId()
      ?? this.selectedEventFeedbackEventId()
      ?? this.eventFeedbackNoteForm().eventId;
    return this.eventTitleById(eventId);
  }

  public hasEventFeedbackOrganizerNote(eventId: string): boolean {
    const userId = this.activeUserId();
    if (!userId) return false;
    return Boolean(this.organizerEventFeedbackNotesByUser()[userId]?.[eventId]?.trim());
  }

  public eventFeedbackItemById(eventId: string): AppTypes.EventFeedbackEventCard | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.eventFeedbackVisibleItems().find(item => item.eventId === normalizedEventId)
      ?? this.loadedEventFeedbackItems().find(item => item.eventId === normalizedEventId)
      ?? this.organizerEventFeedbackCards().find(item => item.eventId === normalizedEventId)
      ?? null;
  }

  public openOrganizerEventFeedback(eventId: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return;
    }
    this.eventFeedbackListFilter.set('own-events');
    this.selectedOrganizerEventFeedbackEventId.set(normalizedEventId);
    this.stackedPopupMode.set('organizerEventFeedback');
    this.isStackedPopupOpen.set(true);
  }

  public openEventFeedbackDeck(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.selectedEventFeedbackEventId.set(item.eventId);
    this.eventFeedbackSubmittedState.set(false);
    this.eventFeedbackSubmitMessage.set('');
    this.stackedPopupMode.set('eventFeedback');
    this.isStackedPopupOpen.set(true);
  }

  public isEventFeedbackDeckLoadCurrent(eventId: string): boolean {
    return this.selectedEventFeedbackEventId() === eventId.trim()
      && this.stackedPopupMode() === 'eventFeedback';
  }

  public completeEmptyEventFeedbackDeck(title: string): void {
    this.eventFeedbackListSubmitMessage.set(`${title} is already in Feedbacked.`);
    this.eventFeedbackListFilter.set('feedbacked');
    this.closeStackedPopup();
  }

  public async removeEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.markEventFeedbackEventRemoved(item.eventId);
    this.mergeEventFeedbackStateOverride(this.activeUserId(), item.eventId, {
      removed: true,
      removedAtIso: AppUtils.toIsoDateTime(new Date())
    });
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved to Removed without feedback.`);
  }

  public async restoreRemovedEventFeedbackItem(item: AppTypes.EventFeedbackEventCard, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.restoreEventFeedbackEvent(item.eventId);
    this.mergeEventFeedbackStateOverride(this.activeUserId(), item.eventId, {
      removed: false,
      removedAtIso: null
    });
    this.eventFeedbackListSubmitMessage.set(`${item.title} moved back to Pending.`);
  }

  public openEventFeedbackNotePopup(item: AppTypes.EventFeedbackEventCard, event?: Event): void {
    event?.stopPropagation();
    this.selectedEventFeedbackEventId.set(item.eventId);
    
    const userId = this.activeUserId();
    this.eventFeedbackNoteForm.set({
      eventId: item.eventId,
      text: userId ? (this.organizerEventFeedbackNotesByUser()[userId]?.[item.eventId] ?? '') : ''
    });
    
    this.eventFeedbackNoteSubmitted.set(false);
    this.eventFeedbackNoteSubmitMessage.set('');
    this.stackedPopupMode.set('eventFeedbackNote');
    this.isStackedPopupOpen.set(true);
  }

  public canSubmitEventFeedbackNote(): boolean {
    return this.eventFeedbackNoteForm().text.trim().length >= 8;
  }

  public applyEventFeedbackNoteSubmitted(): void {
    if (!this.canSubmitEventFeedbackNote()) {
      return;
    }
    const userId = this.activeUserId();
    if (!userId) return;

    const noteForm = this.eventFeedbackNoteForm();
    const eventId = noteForm.eventId;
    const trimmedText = noteForm.text.trim();

    this.organizerEventFeedbackNotesByUser.update(state => {
      const nextByUser = { ...(state[userId] ?? {}) };
      nextByUser[eventId] = trimmedText;
      return { ...state, [userId]: nextByUser };
    });
    this.mergeEventFeedbackStateOverride(userId, eventId, {
      organizerNote: trimmedText
    });

    this.eventFeedbackNoteSubmitted.set(true);
    const msg = `Organizer feedback saved for ${this.eventTitleById(eventId)}.`;
    this.eventFeedbackNoteSubmitMessage.set(msg);
    this.eventFeedbackListSubmitMessage.set(msg);
  }

  public clearEventFeedbackListView(userId: string): void {
    this.receivedEventFeedbackByEventId.set({});
    this.loadedEventFeedbackItems.set([]);
    this.loadedOrganizerEventFeedbackItems.set([]);
    this.loadedEventFeedbackTitleById.set({});
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.submittedEventFeedbackByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
    this.submittedEventFeedbackAnswersByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
    this.submittedEventFeedbackEventsByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
    this.removedEventFeedbackEventsByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
    this.removedEventFeedbackEventDatesByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
    this.organizerEventFeedbackNotesByUser.update(state => ({ ...state, [normalizedUserId]: {} }));
  }

  public applyEventFeedbackPageViewModel(userId: string, result: EventFeedbackPageViewModel): void {
    const submittedCards = { ...result.state.submittedCardsById };
    const submittedAnswers = this.clonePersistedAnswersByCardId(result.state.submittedAnswersByCardId);
    const submittedEvents = { ...result.state.submittedEventsById };
    const removedEvents = { ...result.state.removedEventsById };
    const removedEventDates = { ...result.state.removedEventDatesById };
    const organizerNotes = { ...result.state.organizerNotesByEventId };
    this.applyEventFeedbackStateOverrides(
      userId,
      submittedCards,
      submittedAnswers,
      submittedEvents,
      removedEvents,
      removedEventDates,
      organizerNotes
    );

    const titleById: Record<string, string> = {};
    for (const item of [...result.allItems, ...result.organizerItems]) {
      const eventId = item.eventId?.trim() ?? '';
      if (eventId) {
        titleById[eventId] = item.title;
      }
    }

    this.loadedEventFeedbackItems.set(result.allItems.map(item => ({ ...item })));
    this.loadedOrganizerEventFeedbackItems.set(result.organizerItems.map(item => ({ ...item })));
    this.loadedEventFeedbackTitleById.set(titleById);
    this.applyReceivedEventFeedbackEvents(result.receivedEvents);
    this.submittedEventFeedbackByUser.update(state => ({ ...state, [userId]: submittedCards }));
    this.submittedEventFeedbackAnswersByUser.update(state => ({ ...state, [userId]: submittedAnswers }));
    this.submittedEventFeedbackEventsByUser.update(state => ({ ...state, [userId]: submittedEvents }));
    this.removedEventFeedbackEventsByUser.update(state => ({ ...state, [userId]: removedEvents }));
    this.removedEventFeedbackEventDatesByUser.update(state => ({ ...state, [userId]: removedEventDates }));
    this.organizerEventFeedbackNotesByUser.update(state => ({ ...state, [userId]: organizerNotes }));
  }

  private applyReceivedEventFeedbackEvents(events: ActivityContracts.EventFeedbackReceivedEventDto[]): void {
    const next: Record<string, ActivityContracts.EventFeedbackReceivedEventDto> = {};
    for (const item of events) {
      const eventId = item.eventId?.trim() ?? '';
      if (!eventId) {
        continue;
      }
      next[eventId] = {
        eventId,
        entries: (item.entries ?? []).map(entry => ({
          viewerUserId: entry.viewerUserId?.trim() ?? '',
          viewerName: entry.viewerName?.trim() ?? '',
          viewerInitials: entry.viewerInitials?.trim() ?? '',
          viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
          viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
          eventId: entry.eventId?.trim() ?? eventId,
          submittedAtIso: entry.submittedAtIso?.trim() ?? '',
          updatedAtIso: entry.updatedAtIso?.trim() ?? '',
          organizerNote: entry.organizerNote?.trim() ?? '',
          answers: (entry.answers ?? []).map(answer => this.cloneSubmittedEventFeedbackAnswer(answer))
        })).filter(entry => entry.viewerUserId.length > 0)
      };
    }
    this.receivedEventFeedbackByEventId.set(next);
  }

  private mergeEventFeedbackStateOverride(
    userId: string,
    eventId: string,
    override: EventFeedbackStateOverride
  ): void {
    const normalizedUserId = userId.trim();
    const normalizedEventId = eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return;
    }
    this.eventFeedbackStateOverridesByUser.update(state => {
      const byUser = { ...(state[normalizedUserId] ?? {}) };
      const current = byUser[normalizedEventId] ?? {};
      const next: EventFeedbackStateOverride = { ...current, ...override };
      if (override.answersByCardId) {
        next.answersByCardId = {
          ...(current.answersByCardId ?? {}),
          ...this.clonePersistedAnswersByCardId(override.answersByCardId)
        };
      } else if (current.answersByCardId) {
        next.answersByCardId = current.answersByCardId;
      }
      byUser[normalizedEventId] = next;
      return { ...state, [normalizedUserId]: byUser };
    });
  }

  private applyEventFeedbackStateOverrides(
    userId: string,
    submittedCards: Record<string, true>,
    submittedAnswers: Record<string, ActivityContracts.SubmittedEventFeedbackAnswer>,
    submittedEvents: Record<string, string>,
    removedEvents: Record<string, true>,
    removedEventDates: Record<string, string>,
    organizerNotes: Record<string, string>
  ): void {
    const overrides = this.eventFeedbackStateOverridesByUser()[userId] ?? {};
    for (const [eventId, override] of Object.entries(overrides)) {
      const normalizedEventId = eventId.trim();
      if (!normalizedEventId) {
        continue;
      }
      if (override.removed !== undefined) {
        if (override.removed) {
          removedEvents[normalizedEventId] = true;
          const removedAtIso = override.removedAtIso?.trim() ?? '';
          if (removedAtIso) {
            removedEventDates[normalizedEventId] = removedAtIso;
          }
        } else {
          delete removedEvents[normalizedEventId];
          delete removedEventDates[normalizedEventId];
        }
      }
      const submittedAtIso = override.submittedAtIso?.trim() ?? '';
      if (submittedAtIso) {
        submittedEvents[normalizedEventId] = submittedAtIso;
      }
      if (override.organizerNote !== undefined) {
        const organizerNote = override.organizerNote.trim();
        if (organizerNote) {
          organizerNotes[normalizedEventId] = organizerNote;
        } else {
          delete organizerNotes[normalizedEventId];
        }
      }
      for (const [cardId, answer] of Object.entries(this.clonePersistedAnswersByCardId(override.answersByCardId))) {
        submittedCards[cardId] = true;
        submittedAnswers[cardId] = this.cloneSubmittedEventFeedbackAnswer(answer);
      }
    }
  }

  private cloneSubmittedEventFeedbackAnswer(
    answer: ActivityContracts.SubmittedEventFeedbackAnswer
  ): ActivityContracts.SubmittedEventFeedbackAnswer {
    return {
      ...answer,
      cardId: answer.cardId?.trim() ?? '',
      eventId: answer.eventId?.trim() ?? '',
      kind: answer.kind === 'attendee' ? 'attendee' : 'event',
      targetUserId: answer.targetUserId?.trim() || null,
      targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
      primaryValue: answer.primaryValue?.trim() ?? '',
      secondaryValue: answer.secondaryValue?.trim() ?? '',
      personalityTraitIds: [...(answer.personalityTraitIds ?? [])],
      tags: [...(answer.tags ?? [])],
      submittedAtIso: answer.submittedAtIso?.trim() ?? ''
    };
  }

  private clonePersistedAnswersByCardId(
    answersByCardId: Record<string, ActivityContracts.SubmittedEventFeedbackAnswer> | undefined
  ): Record<string, ActivityContracts.SubmittedEventFeedbackAnswer> {
    const next: Record<string, ActivityContracts.SubmittedEventFeedbackAnswer> = {};
    const source = (answersByCardId ?? {}) as Record<string, ActivityContracts.SubmittedEventFeedbackAnswer>;
    for (const [cardId, answer] of Object.entries(source)) {
      const normalizedCardId = cardId.trim();
      if (!normalizedCardId || !answer) {
        continue;
      }
      next[normalizedCardId] = this.cloneSubmittedEventFeedbackAnswer(answer);
    }
    return next;
  }

  // --- Computed Properties ---

  public readonly eventFeedbackFilterLabel = computed(() => 
    this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter())?.label ?? 'Pending'
  );

  public readonly eventFeedbackFilterIcon = computed(() => 
    this.eventFeedbackListFilters.find(item => item.key === this.eventFeedbackListFilter())?.icon ?? 'schedule'
  );

  public readonly eventFeedbackOwnEventsCount = computed(() => this.organizerEventFeedbackCards().length);
  public readonly eventFeedbackPendingCount = computed(() => this.eventFeedbackPendingItems().length);
  public readonly eventFeedbackFeedbackedCount = computed(() => this.eventFeedbackFeedbackedItems().length);
  public readonly eventFeedbackRemovedCount = computed(() => this.eventFeedbackRemovedItems().length);
  public readonly organizerEventFeedbackItems = computed<OrganizerEventFeedbackItem[]>(() =>
    this.loadedOrganizerEventFeedbackItems()
      .map(item => {
        const eventId = item.eventId?.trim() ?? '';
        const received = this.receivedEventFeedbackByEventId()[eventId]?.entries ?? [];
        return {
          eventId,
          title: item.title,
          subtitle: item.subtitle,
          timeframe: item.timeframe,
          imageUrl: item.imageUrl,
          startAtMs: item.startAtMs,
          responseCount: received.length || item.totalCards,
          noteCount: received.filter(entry => entry.organizerNote.trim().length > 0).length,
          latestActivityAtMs: this.organizerEventFeedbackEntriesLatestAtMs(received) ?? item.feedbackedAtMs
        };
      })
      .filter(item => item.eventId.length > 0 && item.responseCount > 0)
      .sort((left, right) =>
        this.compareEventFeedbackDates(left.startAtMs, right.startAtMs, 'asc')
        || left.title.localeCompare(right.title)
        || right.responseCount - left.responseCount
        || right.noteCount - left.noteCount
        || this.compareEventFeedbackDates(left.latestActivityAtMs, right.latestActivityAtMs, 'desc')
      )
  );
  public readonly organizerEventFeedbackCards = computed<AppTypes.EventFeedbackEventCard[]>(() =>
    this.organizerEventFeedbackItems().map(item => ({
      eventId: item.eventId,
      title: item.title,
      subtitle: item.subtitle,
      timeframe: item.timeframe,
      imageUrl: item.imageUrl,
      startAtMs: item.startAtMs ?? 0,
      pendingCards: item.responseCount,
      totalCards: item.responseCount,
      isRemoved: false,
      isFeedbacked: false,
      feedbackedAtMs: item.latestActivityAtMs,
      removedAtMs: null,
      isOwnEvent: true
    }))
  );
  public readonly organizerEventFeedbackBadgeCount = computed(() =>
    this.organizerEventFeedbackItems().reduce((total, item) => total + item.responseCount, 0)
  );
  public readonly selectedOrganizerEventFeedbackItem = computed(() =>
    this.organizerEventFeedbackItems().find(item => item.eventId === this.selectedOrganizerEventFeedbackEventId()) ?? null
  );
  public readonly selectedOrganizerEventFeedbackEntries = computed(() => {
    const eventId = this.selectedOrganizerEventFeedbackEventId()?.trim() ?? '';
    if (!eventId) {
      return [];
    }
    return [...(this.receivedEventFeedbackByEventId()[eventId]?.entries ?? [])]
      .sort((left, right) => this.organizerEventFeedbackEntryTimestampMs(right) - this.organizerEventFeedbackEntryTimestampMs(left));
  });
  public readonly organizerEventFeedbackOverallStats = computed(() =>
    this.buildOrganizerEventFeedbackOptionStats(
      this.eventFeedbackEventOverallOptions,
      this.selectedOrganizerEventFeedbackEntries().map(entry => this.organizerEventFeedbackEntryEventAnswer(entry)?.primaryValue ?? '')
    )
  );
  public readonly organizerEventFeedbackImproveStats = computed(() =>
    this.buildOrganizerEventFeedbackOptionStats(
      this.eventFeedbackHostImproveOptions,
      this.selectedOrganizerEventFeedbackEntries().map(entry => this.organizerEventFeedbackEntryEventAnswer(entry)?.secondaryValue ?? '')
    )
  );
  public readonly organizerEventFeedbackSummaryStats = computed<OrganizerEventFeedbackStatItem[]>(() => {
    const entries = this.selectedOrganizerEventFeedbackEntries();
    if (entries.length === 0) {
      return [];
    }
    return [
      {
        key: 'responses',
        label: 'Feedback entries',
        icon: 'forum',
        count: entries.length
      },
      {
        key: 'event-ratings',
        label: 'Event ratings',
        icon: 'poll',
        count: entries.filter(entry => Boolean(this.organizerEventFeedbackEntryEventAnswer(entry))).length
      },
      {
        key: 'notes',
        label: 'Written notes',
        icon: 'edit_note',
        count: entries.filter(entry => entry.organizerNote.trim().length > 0).length
      }
    ];
  });
  public readonly organizerEventFeedbackTraitStats = computed(() => {
    const countsByTraitId = new Map<string, number>();
    for (const entry of this.selectedOrganizerEventFeedbackEntries()) {
      const answer = this.organizerEventFeedbackEntryEventAnswer(entry);
      if (!answer) {
        continue;
      }
      for (const traitId of answer.personalityTraitIds ?? []) {
        const normalizedTraitId = traitId.trim();
        if (!normalizedTraitId) {
          continue;
        }
        countsByTraitId.set(normalizedTraitId, (countsByTraitId.get(normalizedTraitId) ?? 0) + 1);
      }
    }
    return this.eventFeedbackPersonalityTraitOptions
      .map(option => ({
        key: option.id,
        label: option.label,
        icon: option.icon,
        count: countsByTraitId.get(option.id) ?? 0
      }))
      .filter(item => item.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  });
  public readonly organizerEventFeedbackMessageGroups = computed<OrganizerEventFeedbackMessageGroup[]>(() => {
    const groups = new Map<string, OrganizerEventFeedbackMessageGroup>();
    for (const entry of this.selectedOrganizerEventFeedbackEntries()) {
      const timestampIso = this.organizerEventFeedbackEntryTimestampIso(entry);
      const timestampDate = timestampIso ? new Date(timestampIso) : null;
      const hasValidTimestamp = Boolean(timestampDate) && !Number.isNaN(timestampDate!.getTime());
      const answer = this.organizerEventFeedbackEntryEventAnswer(entry);
      const viewerName = entry.viewerName?.trim() || entry.viewerUserId.trim() || 'Member';
      const viewerInitials = entry.viewerInitials?.trim()
        || AppUtils.initialsFromText(viewerName);
      const viewerGender = entry.viewerGender === 'woman' ? 'woman' : 'man';
      const viewerImageUrl = entry.viewerImageUrl?.trim() || '';
      const dayKey = hasValidTimestamp ? AppUtils.toIsoDate(timestampDate as Date) : 'undated';
      const dayLabel = hasValidTimestamp
        ? (timestampDate as Date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'No date';
      const timeLabel = hasValidTimestamp
        ? (timestampDate as Date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';
      const group = groups.get(dayKey) ?? { dayKey, label: dayLabel, items: [] };
      group.items.push({
        id: `${entry.viewerUserId}:${timestampIso || dayKey}`,
        viewerUserId: entry.viewerUserId,
        viewerName,
        viewerInitials,
        viewerGender,
        viewerImageUrl,
        timestampIso,
        dayKey,
        dayLabel,
        timeLabel,
        organizerNote: entry.organizerNote.trim(),
        overallLabel: answer ? (this.organizerEventFeedbackOptionLabel(answer.primaryValue, this.eventFeedbackEventOverallOptions) ?? null) : null,
        improveLabel: answer ? (this.organizerEventFeedbackOptionLabel(answer.secondaryValue, this.eventFeedbackHostImproveOptions) ?? null) : null,
        traitLabels: answer
          ? answer.personalityTraitIds
            .map(traitId => this.eventFeedbackPersonalityTraitOptions.find(option => option.id === traitId)?.label ?? '')
            .filter(label => label.length > 0)
          : [],
        responseCount: entry.answers.length
      });
      groups.set(dayKey, group);
    }
    return [...groups.values()]
      .map(group => ({
        ...group,
        items: [...group.items].sort((left, right) => {
          const leftMs = left.timestampIso ? new Date(left.timestampIso).getTime() : 0;
          const rightMs = right.timestampIso ? new Date(right.timestampIso).getTime() : 0;
          return rightMs - leftMs || left.viewerName.localeCompare(right.viewerName);
        })
      }))
      .sort((left, right) => {
        if (left.dayKey === 'undated') {
          return 1;
        }
        if (right.dayKey === 'undated') {
          return -1;
        }
        return right.dayKey.localeCompare(left.dayKey);
      });
  });

  public eventFeedbackFilterCount(filter: EventFeedbackListFilter): number {
    switch (filter) {
      case 'own-events':
        return this.eventFeedbackOwnEventsCount();
      case 'pending':
        return this.eventFeedbackPendingCount();
      case 'feedbacked':
        return this.eventFeedbackFeedbackedCount();
      case 'removed':
        return this.eventFeedbackRemovedCount();
      default:
        return 0;
    }
  }

  public readonly eventFeedbackVisibleItems = computed(() => {
    switch (this.eventFeedbackListFilter()) {
      case 'own-events': return this.organizerEventFeedbackCards();
      case 'feedbacked': return this.eventFeedbackFeedbackedItems();
      case 'removed': return this.eventFeedbackRemovedItems();
      case 'pending':
      default: return this.eventFeedbackPendingItems();
    }
  });

  // --- Internal Data Helpers ---

  private activeUserId(): string {
    return this.appCtx.activeUserProfile()?.id?.trim() || this.appCtx.activeUserId().trim();
  }

  private eventTitleById(eventId: string): string {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return 'this event';
    }
    return this.loadedEventFeedbackTitleById()[normalizedEventId]?.trim() || 'this event';
  }

  private organizerEventFeedbackEntriesLatestAtMs(entries: readonly ActivityContracts.EventFeedbackReceivedEntryDto[]): number | null {
    let latestAtMs: number | null = null;
    for (const entry of entries) {
      const candidateMs = this.organizerEventFeedbackEntryTimestampMs(entry);
      if (candidateMs <= 0) {
        continue;
      }
      latestAtMs = latestAtMs === null ? candidateMs : Math.max(latestAtMs, candidateMs);
    }
    return latestAtMs;
  }

  private organizerEventFeedbackEntryTimestampIso(entry: ActivityContracts.EventFeedbackReceivedEntryDto): string {
    const updatedAtIso = entry.updatedAtIso?.trim() ?? '';
    if (updatedAtIso) {
      return updatedAtIso;
    }
    const submittedAtIso = entry.submittedAtIso?.trim() ?? '';
    if (submittedAtIso) {
      return submittedAtIso;
    }
    for (const answer of entry.answers ?? []) {
      const answerIso = answer.submittedAtIso?.trim() ?? '';
      if (answerIso) {
        return answerIso;
      }
    }
    return '';
  }

  private organizerEventFeedbackEntryTimestampMs(entry: ActivityContracts.EventFeedbackReceivedEntryDto): number {
    const timestampIso = this.organizerEventFeedbackEntryTimestampIso(entry);
    if (!timestampIso) {
      return 0;
    }
    const value = new Date(timestampIso).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  private organizerEventFeedbackEntryEventAnswer(
    entry: ActivityContracts.EventFeedbackReceivedEntryDto
  ): ActivityContracts.SubmittedEventFeedbackAnswer | null {
    return (entry.answers ?? []).find(answer => answer.kind === 'event') ?? null;
  }

  private buildOrganizerEventFeedbackOptionStats(
    options: readonly AppTypes.EventFeedbackOption[],
    values: readonly string[]
  ): OrganizerEventFeedbackStatItem[] {
    const countsByValue = new Map<string, number>();
    for (const value of values) {
      const normalizedValue = value.trim();
      if (!normalizedValue) {
        continue;
      }
      countsByValue.set(normalizedValue, (countsByValue.get(normalizedValue) ?? 0) + 1);
    }
    return options
      .map(option => ({
        key: option.value,
        label: option.label,
        icon: option.icon,
        count: countsByValue.get(option.value) ?? 0
      }))
      .filter(item => item.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  private organizerEventFeedbackOptionLabel(
    value: string,
    options: readonly AppTypes.EventFeedbackOption[]
  ): string | null {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    return options.find(option => option.value === normalizedValue)?.label ?? null;
  }

  private isEventFeedbackSubmitted(cardId: string): boolean {
    const userId = this.activeUserId();
    if (!userId) return false;
    return Boolean(this.submittedEventFeedbackByUser()[userId]?.[cardId]);
  }

  private markEventFeedbackSubmittedAnswers(
    userId: string,
    submittedAnswersByCardId: Record<string, ActivityContracts.SubmittedEventFeedbackAnswer>
  ): void {
    const cardIds = Object.keys(submittedAnswersByCardId).map(cardId => cardId.trim()).filter(Boolean);
    if (!userId || cardIds.length === 0) {
      return;
    }
    this.submittedEventFeedbackByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      for (const cardId of cardIds) {
        current[cardId] = true;
      }
      return { ...state, [userId]: current };
    });
    this.submittedEventFeedbackAnswersByUser.update(state => {
      const byUser = { ...(state[userId] ?? {}) };
      for (const [cardId, answer] of Object.entries(this.clonePersistedAnswersByCardId(submittedAnswersByCardId))) {
        byUser[cardId] = answer;
      }
      return { ...state, [userId]: byUser };
    });
  }

  private markEventFeedbackEventSubmitted(eventId: string): void {
    const userId = this.activeUserId();
    if (!userId) return;
    this.submittedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      current[eventId] = new Date().toISOString();
      return { ...state, [userId]: current };
    });
  }

  private eventFeedbackEventSubmittedAtMs(eventId: string): number | null {
    const userId = this.activeUserId();
    if (!userId) return null;
    const iso = this.submittedEventFeedbackEventsByUser()[userId]?.[eventId];
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private eventFeedbackEventRemovedAtMs(eventId: string): number | null {
    const userId = this.activeUserId();
    if (!userId) return null;
    const iso = this.removedEventFeedbackEventDatesByUser()[userId]?.[eventId];
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private isEventFeedbackEventSubmitted(eventId: string): boolean {
    const userId = this.activeUserId();
    if (!userId) return false;
    return Boolean(this.submittedEventFeedbackEventsByUser()[userId]?.[eventId]);
  }

  private isEventFeedbackEventRemoved(eventId: string): boolean {
    const userId = this.activeUserId();
    if (!userId) return false;
    return Boolean(this.removedEventFeedbackEventsByUser()[userId]?.[eventId]);
  }

  private markEventFeedbackEventRemoved(eventId: string): void {
    const userId = this.activeUserId();
    if (!userId) return;
    const removedAtIso = new Date().toISOString();
    this.removedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      current[eventId] = true;
      return { ...state, [userId]: current };
    });
    this.removedEventFeedbackEventDatesByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      current[eventId] = removedAtIso;
      return { ...state, [userId]: current };
    });
  }

  private restoreEventFeedbackEvent(eventId: string): void {
    const userId = this.activeUserId();
    if (!userId) return;
    this.removedEventFeedbackEventsByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      delete current[eventId];
      return { ...state, [userId]: current };
    });
    this.removedEventFeedbackEventDatesByUser.update(state => {
      const current = { ...(state[userId] ?? {}) };
      delete current[eventId];
      return { ...state, [userId]: current };
    });
  }

  private compareEventFeedbackDates(
    leftMs: number | null | undefined,
    rightMs: number | null | undefined,
    direction: 'asc' | 'desc'
  ): number {
    const left = Number.isFinite(leftMs) && (leftMs ?? 0) > 0 ? Number(leftMs) : null;
    const right = Number.isFinite(rightMs) && (rightMs ?? 0) > 0 ? Number(rightMs) : null;
    if (left === null && right === null) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    return direction === 'asc' ? left - right : right - left;
  }

  public readonly eventFeedbackAllItems = computed(() => {
    return this.loadedEventFeedbackItems().map(item => {
      const eventId = item.eventId.trim();
      const eventSubmitted = this.isEventFeedbackEventSubmitted(eventId);
      const pendingCards = eventSubmitted ? 0 : item.pendingCards;
      const isRemoved = this.isEventFeedbackEventRemoved(eventId);
      const feedbackedAtMs = this.eventFeedbackEventSubmittedAtMs(eventId) ?? item.feedbackedAtMs;
      return {
        ...item,
        pendingCards,
        isRemoved,
        isFeedbacked: !isRemoved && pendingCards === 0,
        feedbackedAtMs,
        removedAtMs: this.eventFeedbackEventRemovedAtMs(eventId) ?? item.removedAtMs ?? null
      };
    });
  });

  public readonly eventFeedbackPendingItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => !item.isRemoved && item.pendingCards > 0)
      .sort((left, right) =>
        this.compareEventFeedbackDates(left.startAtMs, right.startAtMs, 'asc')
        || left.title.localeCompare(right.title)
      );
  });

  public readonly eventFeedbackFeedbackedItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => item.isFeedbacked)
      .sort((left, right) =>
        this.compareEventFeedbackDates(left.feedbackedAtMs ?? left.startAtMs, right.feedbackedAtMs ?? right.startAtMs, 'desc')
        || right.title.localeCompare(left.title)
      );
  });

  public readonly eventFeedbackRemovedItems = computed(() => {
    return this.eventFeedbackAllItems()
      .filter(item => item.isRemoved)
      .sort((left, right) =>
        this.compareEventFeedbackDates(left.removedAtMs ?? left.feedbackedAtMs ?? left.startAtMs, right.removedAtMs ?? right.feedbackedAtMs ?? right.startAtMs, 'desc')
        || right.title.localeCompare(left.title)
      );
  });
}
