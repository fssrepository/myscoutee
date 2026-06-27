import { AppUtils } from '../../../../app-utils';
import type { ActivityMemberRole, EventFeedbackListFilter } from '../../../common/constants';
import { EventFeedbackDetailDto, EventFeedbackPageResultDto } from '../../../contracts/activity.interface';
import type {
  ActivityEventDTO,
  EventFeedbackCardDto,
  EventFeedbackDto,
  EventFeedbackPageCountsDto,
  EventFeedbackPageQueryDto,
  EventFeedbackPageStateSnapshotDto,
  EventFeedbackQueryDto,
  EventFeedbackReceivedEntryDto,
  EventFeedbackReceivedEventDto,
  EventFeedbackStateDto,
  SubmittedEventFeedbackAnswer
} from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';

export class LocalEventFeedbackMapper {
  private static readonly DEFAULT_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;

  static toPageResult(options: {
    query: EventFeedbackPageQueryDto;
    events: readonly ActivityEventDTO[];
    users: readonly UserDto[];
    activeUser: UserDto;
    states: readonly EventFeedbackStateDto[];
    receivedEvents: readonly EventFeedbackReceivedEventDto[];
    eventFeedbackUnlockDelayMs?: number;
    nowMs?: number;
  }): EventFeedbackPageResultDto {
    const query = this.normalizeQuery(options.query);
    const events = this.uniqueEvents(options.events);
    const users = this.uniqueUsers(options.users, options.activeUser);
    const state = this.stateSnapshotFromDtos(options.states);
    const receivedEvents = this.cloneReceivedEvents(options.receivedEvents);
    const receivedByEventId = new Map(receivedEvents.map(item => [item.eventId, item.entries]));
    const unlockDelayMs = options.eventFeedbackUnlockDelayMs ?? this.DEFAULT_UNLOCK_DELAY_MS;
    const nowMs = options.nowMs ?? Date.now();
    const feedbackCards = this.toFeedbackCards({
      events,
      users,
      activeUser: options.activeUser,
      eventFeedbackUnlockDelayMs: unlockDelayMs,
      nowMs
    });
    const cardsByEventId = this.cardsByEventId(feedbackCards);
    const allItems = this.toFeedbackEventItems({
      events,
      cardsByEventId,
      state,
      activeUserId: options.activeUser.id,
      eventFeedbackUnlockDelayMs: unlockDelayMs,
      nowMs
    });
    const organizerItems = this.toOrganizerItems(events, receivedByEventId);
    const filtered = this.filterItems(query.filter, allItems, organizerItems);
    const pageItems = filtered.slice(query.page * query.pageSize, (query.page * query.pageSize) + query.pageSize);

    return new EventFeedbackPageResultDto({
      items: pageItems,
      total: filtered.length,
      allItems,
      organizerItems,
      receivedEvents,
      state,
      counts: this.counts(allItems, organizerItems)
    });
  }

  static toDetail(options: {
    query: EventFeedbackQueryDto;
    events: readonly ActivityEventDTO[];
    users: readonly UserDto[];
    activeUser: UserDto;
    eventFeedbackUnlockDelayMs?: number;
    nowMs?: number;
  }): EventFeedbackDetailDto {
    const eventId = options.query.eventId.trim();
    const userId = options.query.userId.trim();
    if (!userId || !eventId) {
      return new EventFeedbackDetailDto({ eventId });
    }
    const events = this.uniqueEvents(options.events);
    const event = events.find(item => item.id === eventId) ?? null;
    if (!event) {
      return new EventFeedbackDetailDto({ eventId });
    }
    const users = this.uniqueUsers(options.users, options.activeUser);
    const cards = this.toFeedbackCards({
      events: [event],
      users,
      activeUser: options.activeUser,
      eventFeedbackUnlockDelayMs: options.eventFeedbackUnlockDelayMs ?? this.DEFAULT_UNLOCK_DELAY_MS,
      nowMs: options.nowMs ?? Date.now()
    }).filter(card => card.eventId === eventId);
    return new EventFeedbackDetailDto({
      eventId,
      title: event.title,
      cards
    });
  }

  private static toFeedbackCards(options: {
    events: readonly ActivityEventDTO[];
    users: readonly UserDto[];
    activeUser: UserDto;
    eventFeedbackUnlockDelayMs: number;
    nowMs: number;
  }): EventFeedbackCardDto[] {
    const cards: EventFeedbackCardDto[] = [];
    for (const event of options.events) {
      if (!this.isFeedbackAttendeeEvent(event)) {
        continue;
      }
      const startMs = this.eventStartAtMs(event);
      if (startMs === null || options.nowMs < startMs + options.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const eventLabel = this.eventFeedbackWhenLabel(event);
      const host = this.feedbackHostUserForEvent(event, options.users, options.activeUser);
      const attendees = this.feedbackAttendeesForEvent(event, host.id, options.users, options.activeUser.id);
      cards.push({
        id: `feedback-event-${event.id}`,
        eventId: event.id,
        kind: 'event',
        targetUserId: host.id,
        targetRole: 'Admin',
        eventTitle: event.title,
        eventSubtitle: event.subtitle,
        eventImageUrl: event.imageUrl?.trim() || '',
        eventTimeframe: event.timeframe,
        eventStartAtIso: event.startAtIso?.trim() ?? '',
        eventLabel,
        targetName: host.name,
        targetAge: host.age,
        targetCity: host.city,
        targetGender: host.gender,
        targetTraitLabel: host.traitLabel,
        targetImageUrl: AppUtils.firstImageUrl(host.images)
      });
      for (const attendee of attendees) {
        const attendeeRole = this.feedbackRoleForAttendee(event.id, attendee.id);
        cards.push({
          id: `feedback-attendee-${event.id}-${attendee.id}`,
          eventId: event.id,
          kind: 'attendee',
          attendeeUserId: attendee.id,
          targetUserId: attendee.id,
          targetRole: attendeeRole,
          eventTitle: event.title,
          eventSubtitle: event.subtitle,
          eventImageUrl: event.imageUrl?.trim() || '',
          eventTimeframe: event.timeframe,
          eventStartAtIso: event.startAtIso?.trim() ?? '',
          eventLabel,
          targetName: attendee.name,
          targetAge: attendee.age,
          targetCity: attendee.city,
          targetGender: attendee.gender,
          targetTraitLabel: attendee.traitLabel,
          targetImageUrl: AppUtils.firstImageUrl(attendee.images)
        });
      }
    }
    return cards;
  }

  private static toFeedbackEventItems(options: {
    events: readonly ActivityEventDTO[];
    cardsByEventId: Record<string, EventFeedbackCardDto[]>;
    state: EventFeedbackPageStateSnapshotDto;
    activeUserId: string;
    eventFeedbackUnlockDelayMs: number;
    nowMs: number;
  }): EventFeedbackDto[] {
    const items: EventFeedbackDto[] = [];
    for (const event of options.events) {
      if (!this.isFeedbackAttendeeEvent(event)) {
        continue;
      }
      const startMs = this.eventStartAtMs(event);
      if (startMs === null || options.nowMs < startMs + options.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const cards = (options.cardsByEventId[event.id] ?? [])
        .filter(card => !(card.kind === 'attendee' && card.attendeeUserId === options.activeUserId));
      if (cards.length === 0) {
        continue;
      }
      const eventSubmitted = Boolean(options.state.submittedEventsById[event.id]);
      const pendingCards = eventSubmitted
        ? 0
        : cards.filter(card => !options.state.submittedCardsById[card.id]).length;
      const isRemoved = Boolean(options.state.removedEventsById[event.id]);
      items.push({
        eventId: event.id,
        title: event.title,
        subtitle: event.subtitle,
        timeframe: event.timeframe,
        imageUrl: event.imageUrl?.trim() || `https://picsum.photos/seed/event-feedback-${event.id}/1200/700`,
        startAtMs: startMs,
        pendingCards,
        totalCards: cards.length,
        isRemoved,
        isFeedbacked: !isRemoved && pendingCards === 0,
        feedbackedAtMs: this.isoToMs(options.state.submittedEventsById[event.id]),
        removedAtMs: this.isoToMs(options.state.removedEventDatesById[event.id])
      });
    }
    return this.sortPendingItems(items);
  }

  private static toOrganizerItems(
    events: readonly ActivityEventDTO[],
    receivedByEventId: Map<string, readonly EventFeedbackReceivedEntryDto[]>
  ): EventFeedbackDto[] {
    return events
      .filter(event => !this.isTrashedEvent(event) && !this.isInvitationEvent(event) && this.isEventAdmin(event))
      .map(event => {
        const entries = receivedByEventId.get(event.id) ?? [];
        return {
          eventId: event.id,
          title: event.title,
          subtitle: event.subtitle,
          timeframe: event.timeframe,
          imageUrl: event.imageUrl?.trim() || '',
          startAtMs: this.eventStartAtMs(event) ?? 0,
          pendingCards: entries.length,
          totalCards: entries.length,
          isRemoved: false,
          isFeedbacked: false,
          feedbackedAtMs: this.entriesLatestAtMs(entries),
          removedAtMs: null,
          isOwnEvent: true
        };
      })
      .filter(item => item.eventId.length > 0 && item.totalCards > 0)
      .sort((left, right) =>
        this.compareDates(left.startAtMs, right.startAtMs, 'asc')
        || left.title.localeCompare(right.title)
        || right.totalCards - left.totalCards
        || this.compareDates(left.feedbackedAtMs, right.feedbackedAtMs, 'desc')
      );
  }

  private static filterItems(
    filter: EventFeedbackListFilter,
    allItems: readonly EventFeedbackDto[],
    organizerItems: readonly EventFeedbackDto[]
  ): EventFeedbackDto[] {
    switch (filter) {
      case 'own-events':
        return organizerItems.map(item => ({ ...item }));
      case 'feedbacked':
        return allItems
          .filter(item => item.isFeedbacked)
          .sort((left, right) =>
            this.compareDates(left.feedbackedAtMs ?? left.startAtMs, right.feedbackedAtMs ?? right.startAtMs, 'desc')
            || right.title.localeCompare(left.title)
          );
      case 'removed':
        return allItems
          .filter(item => item.isRemoved)
          .sort((left, right) =>
            this.compareDates(left.removedAtMs ?? left.feedbackedAtMs ?? left.startAtMs, right.removedAtMs ?? right.feedbackedAtMs ?? right.startAtMs, 'desc')
            || right.title.localeCompare(left.title)
          );
      case 'pending':
      default:
        return this.sortPendingItems(allItems.filter(item => !item.isRemoved && item.pendingCards > 0));
    }
  }

  private static sortPendingItems(items: readonly EventFeedbackDto[]): EventFeedbackDto[] {
    return [...items].sort((left, right) =>
      this.compareDates(left.startAtMs, right.startAtMs, 'asc')
      || left.title.localeCompare(right.title)
    );
  }

  private static counts(
    allItems: readonly EventFeedbackDto[],
    organizerItems: readonly EventFeedbackDto[]
  ): EventFeedbackPageCountsDto {
    return {
      ownEvents: organizerItems.length,
      pending: allItems.filter(item => !item.isRemoved && item.pendingCards > 0).length,
      feedbacked: allItems.filter(item => item.isFeedbacked).length,
      removed: allItems.filter(item => item.isRemoved).length
    };
  }

  private static stateSnapshotFromDtos(states: readonly EventFeedbackStateDto[]): EventFeedbackPageStateSnapshotDto {
    const snapshot = this.emptyStateSnapshot();
    for (const state of states) {
      const eventId = state.eventId?.trim() ?? '';
      if (!eventId) {
        continue;
      }
      if (state.removed) {
        snapshot.removedEventsById[eventId] = true;
        const removedAtIso = state.removedAtIso?.trim() ?? '';
        if (removedAtIso) {
          snapshot.removedEventDatesById[eventId] = removedAtIso;
        }
      }
      const submittedAtIso = state.submittedAtIso?.trim() ?? '';
      if (submittedAtIso) {
        snapshot.submittedEventsById[eventId] = submittedAtIso;
      }
      const organizerNote = state.organizerNote?.trim() ?? '';
      if (organizerNote) {
        snapshot.organizerNotesByEventId[eventId] = organizerNote;
      }
      for (const [cardId, answer] of Object.entries(state.answersByCardId ?? {})) {
        const normalizedCardId = cardId.trim();
        if (!normalizedCardId || !answer) {
          continue;
        }
        snapshot.submittedCardsById[normalizedCardId] = true;
        snapshot.submittedAnswersByCardId[normalizedCardId] = this.cloneSubmittedEventFeedbackAnswer(answer);
      }
    }
    return snapshot;
  }

  private static emptyStateSnapshot(): EventFeedbackPageStateSnapshotDto {
    return {
      submittedCardsById: {},
      submittedAnswersByCardId: {},
      submittedEventsById: {},
      removedEventsById: {},
      removedEventDatesById: {},
      organizerNotesByEventId: {}
    };
  }

  private static cloneReceivedEvents(events: readonly EventFeedbackReceivedEventDto[] | undefined): EventFeedbackReceivedEventDto[] {
    return (events ?? [])
      .map(item => {
        const eventId = item.eventId?.trim() ?? '';
        return {
          eventId,
          entries: (item.entries ?? []).map(entry => ({
            viewerUserId: entry.viewerUserId?.trim() ?? '',
            viewerName: entry.viewerName?.trim() ?? '',
            viewerInitials: entry.viewerInitials?.trim() ?? '',
            viewerGender: entry.viewerGender === 'woman' ? 'woman' as const : 'man' as const,
            viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
            eventId: entry.eventId?.trim() || eventId,
            submittedAtIso: entry.submittedAtIso?.trim() ?? '',
            updatedAtIso: entry.updatedAtIso?.trim() ?? '',
            organizerNote: entry.organizerNote?.trim() ?? '',
            answers: (entry.answers ?? []).map(answer => this.cloneSubmittedEventFeedbackAnswer(answer))
          })).filter(entry => entry.viewerUserId.length > 0)
        };
      })
      .filter(item => item.eventId.length > 0);
  }

  private static cardsByEventId(cards: readonly EventFeedbackCardDto[]): Record<string, EventFeedbackCardDto[]> {
    const next: Record<string, EventFeedbackCardDto[]> = {};
    for (const card of cards) {
      const eventId = card.eventId?.trim() ?? '';
      if (!eventId) {
        continue;
      }
      next[eventId] = [...(next[eventId] ?? []), { ...card }];
    }
    return next;
  }

  private static uniqueEvents(events: readonly ActivityEventDTO[]): ActivityEventDTO[] {
    const byId = new Map<string, ActivityEventDTO>();
    for (const event of events) {
      const eventId = event.id?.trim() ?? '';
      if (!eventId) {
        continue;
      }
      const current = byId.get(eventId);
      if (!current || this.eventPreferenceScore(event) > this.eventPreferenceScore(current)) {
        byId.set(eventId, event);
      }
    }
    return [...byId.values()];
  }

  private static eventPreferenceScore(event: ActivityEventDTO): number {
    return (this.isEventAdmin(event) ? 8 : 0)
      + (event.type === 'hosting' ? 4 : 0)
      + (!this.isInvitationEvent(event) ? 2 : 0)
      + (!this.isTrashedEvent(event) ? 1 : 0);
  }

  private static isFeedbackAttendeeEvent(event: ActivityEventDTO): boolean {
    return event.type === 'events'
      && !this.isTrashedEvent(event)
      && !this.isInvitationEvent(event)
      && !this.isEventAdmin(event);
  }

  private static isEventAdmin(event: ActivityEventDTO): boolean {
    const userId = `${event.userId ?? ''}`.trim();
    return !!userId && (
      event.creatorUserId === userId
      || (event.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === userId)
    );
  }

  private static isInvitationEvent(event: ActivityEventDTO): boolean {
    return event.type === 'invitations';
  }

  private static isTrashedEvent(event: ActivityEventDTO): boolean {
    return event.status === 'T';
  }

  private static uniqueUsers(users: readonly UserDto[], activeUser: UserDto): UserDto[] {
    const byId = new Map<string, UserDto>();
    for (const user of [activeUser, ...users]) {
      const userId = user.id?.trim() ?? '';
      if (userId) {
        byId.set(userId, user);
      }
    }
    return [...byId.values()];
  }

  private static normalizeQuery(query: EventFeedbackPageQueryDto): EventFeedbackPageQueryDto {
    return {
      userId: query.userId.trim(),
      filter: query.filter,
      page: Math.max(0, Math.trunc(Number(query.page) || 0)),
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
    };
  }

  private static feedbackHostUserForEvent(event: ActivityEventDTO, users: readonly UserDto[], activeUser: UserDto): UserDto {
    const creatorUserId = event.creatorUserId?.trim() ?? '';
    if (creatorUserId) {
      const creator = users.find(user => user.id === creatorUserId);
      if (creator) {
        return creator;
      }
    }
    const candidates = users.filter(user => user.id !== activeUser.id);
    if (candidates.length === 0) {
      return activeUser;
    }
    const index = AppUtils.hashText(`feedback-host:${event.id}`) % candidates.length;
    return candidates[index] ?? candidates[0];
  }

  private static feedbackAttendeesForEvent(
    event: ActivityEventDTO,
    hostId: string,
    users: readonly UserDto[],
    activeUserId: string
  ): UserDto[] {
    const attendeeIds = [...new Set([
      ...(event.acceptedMemberUserIds ?? []),
      ...(event.pendingMemberUserIds ?? [])
    ].map(userId => `${userId}`.trim()).filter(Boolean))]
      .filter(userId => userId !== activeUserId && userId !== hostId);
    if (attendeeIds.length > 0) {
      const usersById = new Map(users.map(user => [user.id, user]));
      const resolved = attendeeIds
        .map(userId => usersById.get(userId))
        .filter((user): user is UserDto => Boolean(user));
      if (resolved.length > 0) {
        return resolved.slice(0, Math.min(5, resolved.length));
      }
    }

    const candidates = users.filter(user => user.id !== activeUserId && user.id !== hostId);
    if (candidates.length === 0) {
      return [];
    }
    const seed = AppUtils.hashText(`feedback-attendees:${event.id}`);
    const desired = Math.min(candidates.length, 3 + (seed % 4));
    const picked: UserDto[] = [];
    for (let index = 0; index < candidates.length && picked.length < desired; index += 1) {
      const candidate = candidates[(seed + (index * 3)) % candidates.length];
      if (!candidate || candidate.id === activeUserId || picked.some(item => item.id === candidate.id)) {
        continue;
      }
      picked.push(candidate);
    }
    return picked;
  }

  private static feedbackRoleForAttendee(eventId: string, attendeeUserId: string): ActivityMemberRole {
    const seed = AppUtils.hashText(`feedback-role:${eventId}:${attendeeUserId}`);
    if (seed % 11 === 0) {
      return 'Admin';
    }
    if (seed % 4 === 0) {
      return 'Manager';
    }
    return 'Member';
  }

  private static eventStartAtMs(event: ActivityEventDTO): number | null {
    const iso = event.startAtIso?.trim() ?? '';
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private static eventFeedbackWhenLabel(event: ActivityEventDTO): string {
    const startMs = this.eventStartAtMs(event);
    if (startMs === null) {
      return 'Recent event';
    }
    const parsed = new Date(startMs);
    const day = parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  }

  private static entriesLatestAtMs(entries: readonly EventFeedbackReceivedEntryDto[]): number | null {
    let latestAtMs: number | null = null;
    for (const entry of entries) {
      const candidateMs = this.entryTimestampMs(entry);
      if (candidateMs <= 0) {
        continue;
      }
      latestAtMs = latestAtMs === null ? candidateMs : Math.max(latestAtMs, candidateMs);
    }
    return latestAtMs;
  }

  private static entryTimestampMs(entry: EventFeedbackReceivedEntryDto): number {
    const iso = entry.updatedAtIso?.trim()
      || entry.submittedAtIso?.trim()
      || (entry.answers ?? []).map(answer => answer.submittedAtIso?.trim() ?? '').find(Boolean)
      || '';
    return this.isoToMs(iso) ?? 0;
  }

  private static cloneSubmittedEventFeedbackAnswer(answer: SubmittedEventFeedbackAnswer): SubmittedEventFeedbackAnswer {
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

  private static isoToMs(iso: string | null | undefined): number | null {
    const normalizedIso = iso?.trim() ?? '';
    if (!normalizedIso) {
      return null;
    }
    const value = new Date(normalizedIso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private static compareDates(
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
}
