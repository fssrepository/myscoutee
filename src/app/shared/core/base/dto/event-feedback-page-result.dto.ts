import type { EventFeedbackListFilter } from '../../common/constants';
import type {
  EventFeedbackDto,
  EventFeedbackPageResultDto,
  EventFeedbackReceivedEntryDto,
  EventFeedbackDetailDto
} from '../../contracts/activity.interface';

export type EventFeedbackFilterCountDelta = Partial<Record<EventFeedbackListFilter, number>>;

export class EventFeedbackPageResult {
  constructor(readonly dto: EventFeedbackPageResultDto) {}

  static fromDto(dto: EventFeedbackPageResultDto): EventFeedbackPageResult {
    return new EventFeedbackPageResult(dto);
  }

  get items(): readonly EventFeedbackDto[] {
    return this.dto.items;
  }

  get total(): number {
    return this.dto.total;
  }

  get allItems(): readonly EventFeedbackDto[] {
    return this.dto.allItems;
  }

  get organizerItems(): readonly EventFeedbackDto[] {
    return this.dto.organizerItems;
  }

  itemById(eventId: string): EventFeedbackDto | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return [
      ...this.dto.items,
      ...this.dto.allItems,
      ...this.dto.organizerItems
    ].find(item => item.eventId === normalizedEventId) ?? null;
  }

  eventTitleById(eventId: string): string {
    return this.itemById(eventId)?.title?.trim() || 'this event';
  }

  filterCount(filter: EventFeedbackListFilter): number {
    switch (filter) {
      case 'own-events':
        return Math.max(0, Math.trunc(Number(this.dto.counts?.ownEvents) || 0));
      case 'feedbacked':
        return Math.max(0, Math.trunc(Number(this.dto.counts?.feedbacked) || 0));
      case 'removed':
        return Math.max(0, Math.trunc(Number(this.dto.counts?.removed) || 0));
      case 'pending':
      default:
        return Math.max(0, Math.trunc(Number(this.dto.counts?.pending) || 0));
    }
  }

  filterCountWithDelta(
    filter: EventFeedbackListFilter,
    delta: EventFeedbackFilterCountDelta = {}
  ): number {
    return Math.max(0, this.filterCount(filter) + (delta[filter] ?? 0));
  }

  itemMatchesFilter(item: EventFeedbackDto, filter: EventFeedbackListFilter): boolean {
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

  applySubmitToItem(
    item: EventFeedbackDto,
    dto: EventFeedbackDetailDto
  ): EventFeedbackDto {
    const submittedAtMs = this.submitTimestampMs(dto);
    const pendingCards = Math.max(0, item.pendingCards - dto.cards.length);
    return {
      ...item,
      pendingCards,
      isRemoved: false,
      isFeedbacked: pendingCards === 0,
      feedbackedAtMs: pendingCards === 0 ? submittedAtMs : item.feedbackedAtMs,
      removedAtMs: null
    };
  }

  filterCountDelta(
    before: EventFeedbackDto,
    after: EventFeedbackDto
  ): EventFeedbackFilterCountDelta {
    return {
      pending: this.filterMembershipDelta(before, after, 'pending'),
      feedbacked: this.filterMembershipDelta(before, after, 'feedbacked'),
      removed: this.filterMembershipDelta(before, after, 'removed'),
      'own-events': this.filterMembershipDelta(before, after, 'own-events')
    };
  }

  patchItem(item: EventFeedbackDto): EventFeedbackPageResult {
    const patchList = (items: readonly EventFeedbackDto[]) =>
      items.map(current => current.eventId === item.eventId ? { ...item } : { ...current });
    return new EventFeedbackPageResult({
      ...this.dto,
      items: patchList(this.dto.items),
      allItems: patchList(this.dto.allItems),
      organizerItems: patchList(this.dto.organizerItems)
    });
  }

  patchOrganizerNote(eventId: string, text: string): EventFeedbackPageResult {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return this;
    }
    const organizerNotesByEventId = { ...this.dto.state.organizerNotesByEventId };
    const trimmedText = text.trim();
    if (trimmedText) {
      organizerNotesByEventId[normalizedEventId] = trimmedText;
    } else {
      delete organizerNotesByEventId[normalizedEventId];
    }
    return new EventFeedbackPageResult({
      ...this.dto,
      state: {
        ...this.dto.state,
        organizerNotesByEventId
      }
    });
  }

  receivedEntries(eventId: string): readonly EventFeedbackReceivedEntryDto[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.dto.receivedEvents.find(item => item.eventId === normalizedEventId)?.entries ?? [];
  }

  organizerEntries(eventId: string): EventFeedbackReceivedEntryDto[] {
    return [...this.receivedEntries(eventId)]
      .sort((left, right) => this.entryTimestampMs(right) - this.entryTimestampMs(left));
  }

  entriesLatestAtMs(entries: readonly EventFeedbackReceivedEntryDto[]): number | null {
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

  groupTimestampMs(item: EventFeedbackDto, filter: EventFeedbackListFilter): number | null {
    switch (filter) {
      case 'feedbacked':
        return this.numberOrNull(item.feedbackedAtMs ?? item.startAtMs);
      case 'removed':
        return this.numberOrNull(item.removedAtMs ?? item.feedbackedAtMs ?? item.startAtMs);
      case 'own-events':
      case 'pending':
      default:
        return this.numberOrNull(item.startAtMs);
    }
  }

  private submitTimestampMs(dto: EventFeedbackDetailDto): number {
    const submittedAtIso = dto.submittedAtIso.trim();
    const submittedAtMs = submittedAtIso ? new Date(submittedAtIso).getTime() : Date.now();
    return Number.isNaN(submittedAtMs) ? Date.now() : submittedAtMs;
  }

  private filterMembershipDelta(
    before: EventFeedbackDto,
    after: EventFeedbackDto,
    filter: EventFeedbackListFilter
  ): number {
    const wasVisible = this.itemMatchesFilter(before, filter);
    const isVisible = this.itemMatchesFilter(after, filter);
    return wasVisible === isVisible ? 0 : wasVisible ? -1 : 1;
  }

  private entryTimestampMs(entry: EventFeedbackReceivedEntryDto): number {
    const iso = entry.updatedAtIso?.trim()
      || entry.submittedAtIso?.trim()
      || (entry.answers ?? []).map(answer => answer.submittedAtIso?.trim() ?? '').find(Boolean)
      || '';
    const value = iso ? new Date(iso).getTime() : 0;
    return Number.isNaN(value) ? 0 : value;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }
}
