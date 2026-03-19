import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AppDemoGenerators } from '../../../shared/app-demo-generators';
import { AppContext, EventsService, GameService, type UserDto } from '../../../shared/core';
import type { EventMenuItem } from '../../../shared/demo-data';
import { LazyBgImageDirective } from '../../../shared/ui';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import { EventFeedbackPopupService, type EventFeedbackPopupSource } from '../../event-feedback-popup.service';

@Component({
  selector: 'app-event-feedback-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    LazyBgImageDirective
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent implements OnDestroy, EventFeedbackPopupSource {
  public readonly feedback = inject(EventFeedbackPopupService);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);
  private readonly eventRecordsRef = signal<DemoEventRecord[]>([]);
  private readonly fallbackUsers = AppDemoGenerators.buildExpandedDemoUsers(50);
  private lastLoadedUserId = '';
  private loadRequestVersion = 0;

  constructor() {
    this.feedback.registerSource(this);

    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      const isPopupOpen = this.feedback.isPopupOpen();

      if (!activeUserId) {
        this.lastLoadedUserId = '';
        this.eventRecordsRef.set([]);
        return;
      }

      if (!isPopupOpen && this.lastLoadedUserId === activeUserId && this.eventRecordsRef().length > 0) {
        return;
      }

      void this.loadEventRecords(activeUserId);
    }, { allowSignalWrites: true });
  }

  public isMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 860;
  }

  public get eventItems(): EventMenuItem[] {
    return this.eventRecordsRef()
      .filter(record => !record.isTrashed && !record.isInvitation)
      .map(record => this.toEventMenuItem(record));
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

  protected trackByEventFeedbackItem(index: number, item: any): string {
    return item.eventId;
  }

  ngOnDestroy(): void {
    this.feedback.registerSource(null);
  }

  private async loadEventRecords(userId: string): Promise<void> {
    const requestVersion = ++this.loadRequestVersion;
    const records = await this.eventsService.queryEventItemsByUser(userId);
    if (requestVersion !== this.loadRequestVersion) {
      return;
    }
    this.lastLoadedUserId = userId;
    this.eventRecordsRef.set(records);
  }

  private eventRecordById(eventId: string): DemoEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return this.eventRecordsRef().find(record => record.id === normalizedEventId) ?? null;
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
