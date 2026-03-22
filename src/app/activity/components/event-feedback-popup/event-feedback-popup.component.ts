import { Component, OnDestroy, TemplateRef, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';

import { AppContext, EventsService, GameService, type UserDto } from '../../../shared/core';
import type { EventMenuItem } from '../../../shared/core/base/interfaces/activity-feed.interface';
import {
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
import { DemoUsersRepository } from '../../../shared/core/demo';

interface EventFeedbackListFilters {
  filter: AppTypes.EventFeedbackListFilter;
  userId: string;
}

@Component({
  selector: 'app-event-feedback-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent implements OnDestroy, EventFeedbackPopupSource {
  public readonly feedback = inject(EventFeedbackPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);
  private readonly eventRecordsRef = signal<DemoEventRecord[]>([]);
  private lastLoadedUserId = '';
  private loadRequestVersion = 0;
  private eventRecordsLoadPromise: Promise<void> | null = null;
  private eventRecordsLoadUserId = '';

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

  protected readonly eventFeedbackSmartListLoadPage: SmartListLoadPage<
    AppTypes.EventFeedbackEventCard,
    EventFeedbackListFilters
  > = (query) => from(this.loadEventFeedbackPage(query));

  protected readonly eventFeedbackSmartListConfig: SmartListConfig<
    AppTypes.EventFeedbackEventCard,
    EventFeedbackListFilters
  > = {
    pageSize: 12,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'Event Feedback',
    emptyDescription: (query) => this.eventFeedbackEmptyDescription(query.filters?.filter ?? 'pending'),
    showStickyHeader: false,
    showGroupMarker: () => false,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'none',
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
  }

  public get eventItems(): EventMenuItem[] {
    return this.eventRecordsRef()
      .filter(record => !record.isTrashed && !record.isInvitation)
      .map(record => this.toEventMenuItem(record));
  }

  private get fallbackUsers(): UserDto[] {
    return this.demoUsersRepository.queryAllUsers();
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
    return this.appCtx.activeUserProfile() ?? this.users[0] ?? this.fallbackUsers[0];
  }

  public get eventDatesById(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const record of this.eventRecordsRef()) {
      if (!record.startAtIso) {
        continue;
      }
      next[record.id] = record.startAtIso;
    }
    return next;
  }

  public get activityImageById(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const record of this.eventRecordsRef()) {
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
    return {
      rowId: item.eventId,
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows: [item.timeframe, this.feedback.eventFeedbackItemStatusLine(item)],
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

  protected startEventFeedbackFromCard(item: AppTypes.EventFeedbackEventCard): void {
    if (!this.feedback.isEventFeedbackStartAvailable(item)) {
      return;
    }
    this.feedback.startEventFeedback(item);
  }

  protected onEventFeedbackCardMenuAction(item: AppTypes.EventFeedbackEventCard, event: InfoCardMenuActionEvent): void {
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

  ngOnDestroy(): void {
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
      const records = await this.eventsService.queryEventItemsByUser(normalizedUserId);
      if (requestVersion !== this.loadRequestVersion) {
        return;
      }
      this.lastLoadedUserId = normalizedUserId;
      this.eventRecordsRef.set(records);
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
    return this.eventRecordsRef().find(record => record.id === normalizedEventId) ?? null;
  }

  private eventFeedbackLeadingIcon(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isFeedbacked) {
      return 'task_alt';
    }
    if (item.isRemoved) {
      return 'delete_outline';
    }
    return 'rate_review';
  }

  private eventFeedbackStartBadgeLabel(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isRemoved) {
      return 'Removed';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked';
    }
    return 'Start Feedback';
  }

  private eventFeedbackMenuActions(item: AppTypes.EventFeedbackEventCard): readonly InfoCardMenuAction[] {
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

  private eventFeedbackEmptyDescription(filter: AppTypes.EventFeedbackListFilter): string {
    switch (filter) {
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
