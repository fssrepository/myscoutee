import * as AppConstants from '../../common/constants';
export type FeedbackBucket = 'pending' | 'feedbacked' | 'removed' | 'received';
export interface FeedbackEvaluation {
  id:string; baseGroupId:string; caseId:string; caseTitle:string; serviceId:string|null;
  providerAccountId:string; viewerAccountId:string; status:Exclude<FeedbackBucket,'received'>;
  criteria:Record<string,number>; average:number|null; comment:string; createdAtIso:string; submittedAtIso:string|null;
}
export interface FeedbackEvaluationItem { feedback:FeedbackEvaluation; providerName:string; reviewerName:string; serviceTitle?:string|null; serviceImageUrl?:string|null; }
export interface FeedbackCommand { userId:string; action:'submit'|'remove'|'restore'; criteria?:Record<string,number>; comment?:string; }
export interface FeedbackStats { count:number; average:number; criteria:Record<string,number>; }
export interface IFeedbackService {
  queryStates(userId: string): Promise<FeedbackStateDto[]>;
  queryReceived(userId: string): Promise<FeedbackReceivedEventDto[]>;
  loadPage(query: FeedbackPageQueryDto): Promise<FeedbackPageResultDto>;
  loadStatistics(query: FeedbackStatQueryDto): Promise<FeedbackStatDto>;
  loadDetail(query: FeedbackQueryDto): Promise<FeedbackDetailDto>;
  submit(userId: string, request: FeedbackDetailDto): Promise<FeedbackDetailDto>;
  saveNote(request: FeedbackNoteRequestDto): Promise<void>;
  remove(userId: string, eventId: string): Promise<void>;
  restore(userId: string, eventId: string): Promise<void>;
  action(id:string,command:FeedbackCommand):Promise<void>;
  stats(userId:string,provider:string,signal?:AbortSignal):Promise<FeedbackStats>;
}

export interface FeedbackPreparationContext {
  reviewers: string[];
  providers: { accountId: string; serviceId: string | null }[];
  createdAtIso: string;
  caseTitle: string;
}

export interface SubmittedFeedbackAnswer {
  cardId: string;
  eventId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: AppConstants.ActivityMemberRole;
  primaryValue: string;
  secondaryValue: string;
  eventComment: string;
  personalityTraitIds: string[];
  tags: string[];
  submittedAtIso: string;
}

export interface FeedbackStateDto {
  eventId: string;
  removed: boolean;
  submittedAtIso: string;
  removedAtIso?: string;
  organizerNote: string;
  answersByCardId?: Record<string, SubmittedFeedbackAnswer>;
}

export interface FeedbackPageQueryDto {
  campaignId?: string | null;
  userId: string;
  filter: AppConstants.FeedbackListFilter;
  page: number;
  pageSize: number;
}

export interface FeedbackQueryDto {
  userId: string;
  eventId: string;
}

export type FeedbackStatSectionKey = 'overall' | 'improve' | 'traits';

export interface FeedbackStatQueryDto {
  userId: string;
  eventId: string;
}

export interface FeedbackStatOptionDto {
  key: string;
  count: number;
}

export interface FeedbackStatSectionDto {
  key: FeedbackStatSectionKey;
  responseCount: number;
  options: FeedbackStatOptionDto[];
}

export interface FeedbackStatDto {
  eventId: string;
  totalResponses: number;
  sections: FeedbackStatSectionDto[];
}

export interface FeedbackPageCountsDto {
  ownEvents: number;
  pending: number;
  feedbacked: number;
  removed: number;
}

export interface FeedbackPageStateSnapshotDto {
  submittedCardsById: Record<string, true>;
  submittedAnswersByCardId: Record<string, SubmittedFeedbackAnswer>;
  submittedEventsById: Record<string, string>;
  removedEventsById: Record<string, true>;
  removedEventDatesById: Record<string, string>;
  organizerNotesByEventId: Record<string, string>;
}

export interface FeedbackDto {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number;
  pendingCards: number;
  totalCards: number;
  isRemoved: boolean;
  isFeedbacked: boolean;
  feedbackedAtMs: number | null;
  removedAtMs?: number | null;
  isOwnEvent?: boolean;
}

export interface FeedbackCardDto {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: AppConstants.ActivityMemberRole;
  eventTitle: string;
  eventSubtitle: string;
  eventImageUrl: string;
  eventTimeframe: string;
  eventStartAtIso: string;
  eventLabel: string;
  targetName: string;
  targetAge?: number;
  targetCity?: string;
  targetGender?: AppConstants.UserGender;
  targetTraitLabel?: string;
  targetImageUrl?: string;
  answerPrimary?: string;
  answerSecondary?: string;
  eventComment?: string;
  selectedTraitIds?: string[];
}

export interface FeedbackReceivedEntryDto {
  viewerUserId: string;
  viewerName: string;
  viewerInitials: string;
  viewerGender: AppConstants.UserGender;
  viewerImageUrl: string;
  eventId: string;
  submittedAtIso: string;
  updatedAtIso: string;
  organizerNote: string;
  answers: SubmittedFeedbackAnswer[];
}

export interface FeedbackReceivedEventDto {
  eventId: string;
  entries: FeedbackReceivedEntryDto[];
}

export type FeedbackFilterCountDelta = Partial<Record<AppConstants.FeedbackListFilter, number>>;

export class FeedbackPageResultDto {
  readonly evaluations: FeedbackEvaluationItem[];
  readonly evaluationCounts: Record<string, number>;
  readonly items: FeedbackDto[];
  readonly total: number;
  readonly allItems: FeedbackDto[];
  readonly organizerItems: FeedbackDto[];
  readonly receivedEvents: FeedbackReceivedEventDto[];
  readonly state: FeedbackPageStateSnapshotDto;
  readonly counts: FeedbackPageCountsDto;

  constructor(result: Partial<FeedbackPageResultDto> | null | undefined = null) {
    this.evaluations = structuredClone(result?.evaluations ?? []);
    this.evaluationCounts = { ...result?.evaluationCounts };
    const allItems = FeedbackPageResultDto.clonePageItems(result?.allItems);
    const organizerItems = FeedbackPageResultDto.clonePageItems(result?.organizerItems);
    this.items = FeedbackPageResultDto.clonePageItems(result?.items);
    this.total = Math.max(0, Math.trunc(Number(result?.total) || 0));
    this.allItems = allItems;
    this.organizerItems = organizerItems;
    this.receivedEvents = FeedbackPageResultDto.cloneReceivedEvents(result?.receivedEvents);
    this.state = FeedbackPageResultDto.cloneStateSnapshot(result?.state);
    this.counts = {
      ownEvents: Math.max(0, Math.trunc(Number(result?.counts?.ownEvents) || 0)),
      pending: Math.max(0, Math.trunc(Number(result?.counts?.pending) || 0)),
      feedbacked: Math.max(0, Math.trunc(Number(result?.counts?.feedbacked) || 0)),
      removed: Math.max(0, Math.trunc(Number(result?.counts?.removed) || 0))
    };
  }

  itemById(eventId: string): FeedbackDto | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    return [
      ...this.items,
      ...this.allItems,
      ...this.organizerItems
    ].find(item => item.eventId === normalizedEventId) ?? null;
  }

  eventTitleById(eventId: string): string {
    return this.itemById(eventId)?.title?.trim() || 'this event';
  }

  filterCount(filter: AppConstants.FeedbackListFilter): number {
    switch (filter) {
      case 'own-events':
        return Math.max(0, Math.trunc(Number(this.counts.ownEvents) || 0));
      case 'feedbacked':
        return Math.max(0, Math.trunc(Number(this.counts.feedbacked) || 0));
      case 'removed':
        return Math.max(0, Math.trunc(Number(this.counts.removed) || 0));
      case 'pending':
      default:
        return Math.max(0, Math.trunc(Number(this.counts.pending) || 0));
    }
  }

  filterCountWithDelta(
    filter: AppConstants.FeedbackListFilter,
    delta: FeedbackFilterCountDelta = {}
  ): number {
    return Math.max(0, this.filterCount(filter) + (delta[filter] ?? 0));
  }

  itemMatchesFilter(item: FeedbackDto, filter: AppConstants.FeedbackListFilter): boolean {
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
    item: FeedbackDto,
    dto: FeedbackDetailDto
  ): FeedbackDto {
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

  removeItem(item: FeedbackDto, removedAtMs = Date.now()): FeedbackDto {
    return {
      ...item,
      isRemoved: true,
      isFeedbacked: false,
      removedAtMs
    };
  }

  restoreItem(item: FeedbackDto): FeedbackDto {
    return {
      ...item,
      isRemoved: false,
      isFeedbacked: item.pendingCards === 0,
      removedAtMs: null
    };
  }

  filterCountDelta(
    before: FeedbackDto,
    after: FeedbackDto
  ): FeedbackFilterCountDelta {
    return {
      pending: this.filterMembershipDelta(before, after, 'pending'),
      feedbacked: this.filterMembershipDelta(before, after, 'feedbacked'),
      removed: this.filterMembershipDelta(before, after, 'removed'),
      'own-events': this.filterMembershipDelta(before, after, 'own-events')
    };
  }

  patchItem(item: FeedbackDto): FeedbackPageResultDto {
    const patchList = (items: readonly FeedbackDto[]) =>
      items.map(current => current.eventId === item.eventId ? { ...item } : { ...current });
    return new FeedbackPageResultDto({
      ...this,
      items: patchList(this.items),
      allItems: patchList(this.allItems),
      organizerItems: patchList(this.organizerItems)
    });
  }

  patchOrganizerNote(eventId: string, text: string): FeedbackPageResultDto {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return this;
    }
    const organizerNotesByEventId = { ...this.state.organizerNotesByEventId };
    const trimmedText = text.trim();
    if (trimmedText) {
      organizerNotesByEventId[normalizedEventId] = trimmedText;
    } else {
      delete organizerNotesByEventId[normalizedEventId];
    }
    return new FeedbackPageResultDto({
      ...this,
      state: {
        ...this.state,
        organizerNotesByEventId
      }
    });
  }

  receivedEntries(eventId: string): readonly FeedbackReceivedEntryDto[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.receivedEvents.find(item => item.eventId === normalizedEventId)?.entries ?? [];
  }

  organizerEntries(eventId: string): FeedbackReceivedEntryDto[] {
    return [...this.receivedEntries(eventId)]
      .sort((left, right) => this.entryTimestampMs(right) - this.entryTimestampMs(left));
  }

  entriesLatestAtMs(entries: readonly FeedbackReceivedEntryDto[]): number | null {
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

  groupTimestampMs(item: FeedbackDto, filter: AppConstants.FeedbackListFilter): number | null {
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

  private static clonePageItems(items: readonly FeedbackDto[] | undefined): FeedbackDto[] {
    return (items ?? []).map(item => ({
      eventId: item.eventId?.trim() ?? '',
      title: item.title?.trim() ?? '',
      subtitle: item.subtitle?.trim() ?? '',
      timeframe: item.timeframe?.trim() ?? '',
      imageUrl: item.imageUrl?.trim() ?? '',
      startAtMs: Math.max(0, Math.trunc(Number(item.startAtMs) || 0)),
      pendingCards: Math.max(0, Math.trunc(Number(item.pendingCards) || 0)),
      totalCards: Math.max(0, Math.trunc(Number(item.totalCards) || 0)),
      isRemoved: item.isRemoved === true,
      isFeedbacked: item.isFeedbacked === true,
      feedbackedAtMs: FeedbackPageResultDto.numberOrNullStatic(item.feedbackedAtMs),
      removedAtMs: FeedbackPageResultDto.numberOrNullStatic(item.removedAtMs),
      isOwnEvent: item.isOwnEvent === true
    })).filter(item => item.eventId.length > 0);
  }

  private static cloneReceivedEvents(
    events: readonly FeedbackReceivedEventDto[] | undefined
  ): FeedbackReceivedEventDto[] {
    return (events ?? [])
      .map(item => {
        const eventId = item.eventId?.trim() ?? '';
        return {
          eventId,
          entries: (item.entries ?? []).map(entry => ({
            viewerUserId: entry.viewerUserId?.trim() ?? '',
            viewerName: entry.viewerName?.trim() ?? '',
            viewerInitials: entry.viewerInitials?.trim() ?? '',
            viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as AppConstants.UserGender,
            viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
            eventId: entry.eventId?.trim() || eventId,
            submittedAtIso: entry.submittedAtIso?.trim() ?? '',
            updatedAtIso: entry.updatedAtIso?.trim() ?? '',
            organizerNote: entry.organizerNote?.trim() ?? '',
            answers: (entry.answers ?? []).map(answer => FeedbackPageResultDto.cloneSubmittedAnswer(answer))
          })).filter(entry => entry.viewerUserId.length > 0)
        };
      })
      .filter(item => item.eventId.length > 0);
  }

  private static cloneStateSnapshot(
    state: Partial<FeedbackPageStateSnapshotDto> | null | undefined
  ): FeedbackPageStateSnapshotDto {
    const next: FeedbackPageStateSnapshotDto = {
      submittedCardsById: {},
      submittedAnswersByCardId: {},
      submittedEventsById: {},
      removedEventsById: {},
      removedEventDatesById: {},
      organizerNotesByEventId: {}
    };
    for (const [key, value] of Object.entries(state?.submittedCardsById ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.submittedCardsById[normalizedKey] = true;
      }
    }
    for (const [key, value] of Object.entries(state?.submittedAnswersByCardId ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.submittedAnswersByCardId[normalizedKey] = FeedbackPageResultDto.cloneSubmittedAnswer(value);
      }
    }
    for (const [key, value] of Object.entries(state?.submittedEventsById ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.submittedEventsById[normalizedKey] = normalizedValue;
      }
    }
    for (const [key, value] of Object.entries(state?.removedEventsById ?? {})) {
      const normalizedKey = key.trim();
      if (normalizedKey && value) {
        next.removedEventsById[normalizedKey] = true;
      }
    }
    for (const [key, value] of Object.entries(state?.removedEventDatesById ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.removedEventDatesById[normalizedKey] = normalizedValue;
      }
    }
    for (const [key, value] of Object.entries(state?.organizerNotesByEventId ?? {})) {
      const normalizedKey = key.trim();
      const normalizedValue = value?.trim() ?? '';
      if (normalizedKey && normalizedValue) {
        next.organizerNotesByEventId[normalizedKey] = normalizedValue;
      }
    }
    return next;
  }

  private static cloneSubmittedAnswer(answer: SubmittedFeedbackAnswer): SubmittedFeedbackAnswer {
    return {
      ...answer,
      cardId: answer.cardId?.trim() ?? '',
      eventId: answer.eventId?.trim() ?? '',
      kind: answer.kind === 'attendee' ? 'attendee' : 'event',
      targetUserId: answer.targetUserId?.trim() || null,
      targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
      primaryValue: answer.primaryValue?.trim() ?? '',
      secondaryValue: answer.secondaryValue?.trim() ?? '',
      eventComment: answer.kind === 'event' ? answer.eventComment?.trim() ?? '' : '',
      personalityTraitIds: [...(answer.personalityTraitIds ?? [])],
      tags: [...(answer.tags ?? [])],
      submittedAtIso: answer.submittedAtIso?.trim() ?? ''
    };
  }

  private static numberOrNullStatic(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }

  private submitTimestampMs(dto: FeedbackDetailDto): number {
    const submittedAtIso = dto.submittedAtIso.trim();
    const submittedAtMs = submittedAtIso ? new Date(submittedAtIso).getTime() : Date.now();
    return Number.isNaN(submittedAtMs) ? Date.now() : submittedAtMs;
  }

  private filterMembershipDelta(
    before: FeedbackDto,
    after: FeedbackDto,
    filter: AppConstants.FeedbackListFilter
  ): number {
    const wasVisible = this.itemMatchesFilter(before, filter);
    const isVisible = this.itemMatchesFilter(after, filter);
    return wasVisible === isVisible ? 0 : wasVisible ? -1 : 1;
  }

  private entryTimestampMs(entry: FeedbackReceivedEntryDto): number {
    const iso = entry.updatedAtIso?.trim()
      || entry.submittedAtIso?.trim()
      || (entry.answers ?? []).map(answer => answer.submittedAtIso?.trim() ?? '').find(Boolean)
      || '';
    const value = iso ? new Date(iso).getTime() : 0;
    return Number.isNaN(value) ? 0 : value;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    return FeedbackPageResultDto.numberOrNullStatic(value);
  }
}

export interface FeedbackDetailPendingOptions {
  activeUserId?: string | null;
  fallbackTitle?: string | null;
}

export class FeedbackDetailDto {
  readonly eventId: string;
  readonly title: string;
  readonly submittedAtIso: string;
  readonly organizerNote: string;
  readonly cards: FeedbackCardDto[];

  constructor(result: Partial<FeedbackDetailDto> | null | undefined = null) {
    this.eventId = result?.eventId?.trim() ?? '';
    this.title = result?.title?.trim() ?? '';
    this.submittedAtIso = result?.submittedAtIso?.trim() ?? '';
    this.organizerNote = result?.organizerNote?.trim() ?? '';
    this.cards = FeedbackDetailDto.cloneCards(result?.cards);
  }

  pending(options: FeedbackDetailPendingOptions = {}): FeedbackDetailDto {
    const activeUserId = options.activeUserId?.trim() ?? '';
    return new FeedbackDetailDto({
      ...this,
      title: this.title || options.fallbackTitle?.trim() || '',
      cards: this.cards.filter(card =>
        card.eventId === this.eventId
        && !(card.kind === 'attendee' && card.attendeeUserId === activeUserId)
      )
    });
  }

  submitted(options: { submittedAtIso: string }): FeedbackDetailDto {
    return new FeedbackDetailDto({
      ...this,
      submittedAtIso: options.submittedAtIso
    });
  }

  withPersistedState(state: FeedbackStateDto | null | undefined): FeedbackDetailDto {
    const answersByCardId = state?.answersByCardId ?? {};
    const answers = Object.values(answersByCardId);
    return new FeedbackDetailDto({
      ...this,
      submittedAtIso: state?.submittedAtIso?.trim() || this.submittedAtIso,
      organizerNote: state ? state.organizerNote?.trim() ?? '' : this.organizerNote,
      cards: this.cards.map(card => {
        const answer = answersByCardId[card.id]
          ?? answers.find(item =>
            item.kind === card.kind
            && (card.kind === 'event' || item.targetUserId === (card.targetUserId ?? null))
          );
        if (!answer) {
          return card;
        }
        return {
          ...card,
          answerPrimary: answer.primaryValue?.trim() ?? '',
          answerSecondary: answer.secondaryValue?.trim() ?? '',
          eventComment: answer.kind === 'event' ? answer.eventComment?.trim() ?? '' : '',
          selectedTraitIds: [...(answer.personalityTraitIds ?? [])]
            .map(traitId => traitId.trim())
            .filter(Boolean)
        };
      })
    });
  }

  withEmptyAnswers(): FeedbackDetailDto {
    return new FeedbackDetailDto({
      ...this,
      cards: this.cards.map(card => ({
        ...card,
        answerPrimary: '',
        answerSecondary: '',
        eventComment: '',
        selectedTraitIds: []
      }))
    });
  }

  withFormValue(value: unknown): FeedbackDetailDto {
    const record = FeedbackDetailDto.isRecord(value) ? value : {};
    const inputCards = Array.isArray(record['cards']) ? record['cards'] : [];
    const cardInputById = new Map<string, Record<string, unknown>>();
    for (const item of inputCards) {
      if (!FeedbackDetailDto.isRecord(item)) {
        continue;
      }
      const cardId = `${item['id'] ?? ''}`.trim();
      if (cardId) {
        cardInputById.set(cardId, item);
      }
    }
    return new FeedbackDetailDto({
      ...this,
      cards: this.cards.map(card => {
        const inputCard = cardInputById.get(card.id) ?? {};
        return {
          ...card,
          answerPrimary: FeedbackDetailDto.stringValue(inputCard['answerPrimary']),
          answerSecondary: FeedbackDetailDto.stringValue(inputCard['answerSecondary']),
          eventComment: card.kind === 'event'
            ? FeedbackDetailDto.stringValue(inputCard['eventComment'])
            : '',
          selectedTraitIds: FeedbackDetailDto.normalizeSelectedTraitIds(inputCard['selectedTraitIds'])
        };
      })
    });
  }

  private static cloneCards(cards: readonly FeedbackCardDto[] | undefined): FeedbackCardDto[] {
    return (cards ?? []).map(card => ({
      id: card.id?.trim() ?? '',
      eventId: card.eventId?.trim() ?? '',
      kind: card.kind === 'attendee' ? 'attendee' as const : 'event' as const,
      attendeeUserId: card.attendeeUserId?.trim() || undefined,
      targetUserId: card.targetUserId?.trim() || undefined,
      targetRole: FeedbackDetailDto.normalizeRole(card.targetRole),
      eventTitle: card.eventTitle?.trim() ?? '',
      eventSubtitle: card.eventSubtitle?.trim() ?? '',
      eventImageUrl: card.eventImageUrl?.trim() ?? '',
      eventTimeframe: card.eventTimeframe?.trim() ?? '',
      eventStartAtIso: card.eventStartAtIso?.trim() ?? '',
      eventLabel: card.eventLabel?.trim() ?? '',
      targetName: card.targetName?.trim() ?? '',
      targetAge: FeedbackDetailDto.numberOrUndefined(card.targetAge),
      targetCity: card.targetCity?.trim() || undefined,
      targetGender: card.targetGender === 'woman' ? 'woman' as const : 'man' as const,
      targetTraitLabel: card.targetTraitLabel?.trim() || undefined,
      targetImageUrl: card.targetImageUrl?.trim() || undefined,
      answerPrimary: card.answerPrimary?.trim() ?? '',
      answerSecondary: card.answerSecondary?.trim() ?? '',
      eventComment: card.kind === 'event' ? card.eventComment?.trim() ?? '' : '',
      selectedTraitIds: [...(card.selectedTraitIds ?? [])]
        .map(traitId => traitId.trim())
        .filter(Boolean)
    })).filter(card => card.id.length > 0 && card.eventId.length > 0);
  }

  private static normalizeRole(role: AppConstants.ActivityMemberRole | undefined): AppConstants.ActivityMemberRole | undefined {
    if (role === 'Admin' || role === 'Manager' || role === 'Member') {
      return role;
    }
    return undefined;
  }

  private static numberOrUndefined(value: number | null | undefined): number | undefined {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
  }

  private static stringValue(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private static normalizeSelectedTraitIds(value: unknown): string[] {
    const requestedValues = Array.isArray(value)
      ? value
      : value === null || value === undefined || value === ''
        ? []
        : [value];
    const selectedTraitIds: string[] = [];
    for (const requestedValue of requestedValues) {
      const traitId = `${requestedValue ?? ''}`.trim();
      if (!traitId || selectedTraitIds.includes(traitId)) {
        continue;
      }
      selectedTraitIds.push(traitId);
      if (selectedTraitIds.length >= 3) {
        break;
      }
    }
    return selectedTraitIds;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export interface FeedbackNoteRequestDto {
  userId: string;
  eventId: string;
  text: string;
}

export interface FeedbackToggleRequestDto {
  userId: string;
  eventId: string;
}

