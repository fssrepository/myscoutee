import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from, of } from 'rxjs';

import { AppUtils } from '../../../shared/app-utils';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import {
  ActivityEventDetailDTO,
  type ActivityEventSubEventsQueryDTO,
  type ActivityEventSubEventRuntimeDTO
} from '../../../shared/core/contracts/activity.interface';
import type { SubEventLeaderboardState } from '../../../shared/core/contracts/event.interface';
import {
  AppMenuComponent,
  InfoCardComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type InfoCardData,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListHeaderAction,
  type SmartListHeaderActionSelectEvent,
  type SmartListLoadPage
} from '../../../shared/ui';
import { AppContext, AppPopupContext } from '../../../shared/ui/context';
import { EventSubeventRuntimeInfoCardConverter } from '../../../shared/ui/converters';
import { EventsService } from '../../../shared/core';
import { EventSubeventsListPopupStateService } from '../../services/event-subevents-list-popup-state.service';
import {
  EventSubeventLeaderboardPopupComponent,
  type EventSubeventLeaderboardFifaMatch,
  type EventSubeventLeaderboardFifaRow,
  type EventSubeventLeaderboardGroup,
  type EventSubeventLeaderboardMember,
  type EventSubeventLeaderboardPopupModel,
  type EventSubeventLeaderboardScoreEntry,
  type EventSubeventLeaderboardScoreRow
} from '../event-subevent-leaderboard-popup/event-subevent-leaderboard-popup.component';

type EventSubeventsListView = 'day' | 'week' | 'month';
type EventSubeventsListOrder = 'upcoming' | 'past';
type EventSubeventsListContextAction = 'edit' | 'view' | 'members';
type EventSubeventsSlotTone = 'blue' | 'green' | 'cyan' | 'violet' | 'amber' | 'gold';

interface EventSubeventsListFilters {
  revision: number;
}

interface EventSubeventsSlotSection {
  id: string;
  title: string;
  subtitle: string;
  startAt: string | null;
  endAt: string | null;
  tone: EventSubeventsSlotTone;
  items: ActivityEventSubEventRuntimeDTO[];
  canOpenTournamentResults: boolean;
}

@Component({
  selector: 'app-event-subevents-list-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    SmartListComponent,
    InfoCardComponent,
    EventSubeventLeaderboardPopupComponent
  ],
  templateUrl: './event-subevents-list-popup.component.html',
  styleUrl: './event-subevents-list-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventSubeventsListPopupComponent {
  protected readonly state = inject(EventSubeventsListPopupStateService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoading = false;
  protected event: ActivityEventDetailDTO | null = null;
  protected items: ActivityEventSubEventRuntimeDTO[] = [];
  protected slotSections: EventSubeventsSlotSection[] = [];
  protected view: EventSubeventsListView = 'day';
  protected order: EventSubeventsListOrder = 'upcoming';
  protected isMobileView = false;
  protected query: Partial<ListQuery<EventSubeventsListFilters>> = {
    view: 'day',
    filters: { revision: 0 }
  };
  protected leaderboardPopupModel: EventSubeventLeaderboardPopupModel & { loadingKey: string } = this.closedLeaderboardPopupModel();

  private revision = 0;
  private lastLoadedEventId = '';
  private loadedEventId = '';
  private loadingEventId = '';
  private loadedQueryKey = '';
  private loadingQueryKey = '';
  private loadingPromise: Promise<void> | null = null;

  private readonly slotSectionLoaders = new Map<string, SmartListLoadPage<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters>>();
  private readonly slotSectionConfigs = new Map<string, SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters>>();
  private readonly slotSectionHeaderLabels = new Map<string, string>();

  protected readonly smartListConfig: SmartListConfig<EventSubeventsSlotSection, EventSubeventsListFilters> = {
    pageSize: 12,
    defaultView: 'day',
    views: [
      { key: 'day', label: 'Day', mode: 'list', pageSize: 12 },
      { key: 'week', label: 'Week', mode: 'week', pageSize: 240 },
      { key: 'month', label: 'Month', mode: 'month', pageSize: 240 }
    ],
    calendar: {
      weekdayLabels: APP_STATIC_DATA.calendarWeekdayLabels,
      weekStartHour: 0,
      weekEndHour: 23,
      anchorRadius: 2,
      initialAnchor: () => this.calendarInitialAnchor(),
      resolveDateRange: section => this.slotSectionCalendarRange(section),
      badgeLabel: section => section.title,
      badgeToneClass: section => `event-subevents-calendar-badge--${section.tone}`
    },
    showStickyHeader: true,
    emptyLabel: 'No sub events yet',
    emptyDescription: '',
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    headerProgress: { enabled: true, placement: 'inline', tone: 'accent' },
    groupBy: (section, query) => this.groupLabel(section.startAt, query.view as EventSubeventsListView),
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    trackBy: (_index, section) => section.id
  };

  private readonly baseSlotSectionSmartListConfig: SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = {
    pageSize: 120,
    defaultView: 'list',
    showStickyHeader: true,
    showGroupMarker: () => false,
    emptyLabel: 'No sub events in this slot',
    emptyDescription: '',
    listLayout: 'card-grid',
    orientation: 'horizontal',
    desktopColumns: 3,
    snapMode: 'mandatory',
    mobileStepper: true,
    stickyHeaderClass: 'smart-list__sticky--slot-section',
    pagination: {
      mode: 'arrows',
      step: 'page',
      headerControls: true
    },
    groupBy: item => this.slotHeaderLabel(item),
    trackBy: (_index, item) => item.runtimeId
  };

  protected readonly loadSubEventsPage: SmartListLoadPage<EventSubeventsSlotSection, EventSubeventsListFilters> = query => {
    return from(this.loadSubEventsPageResult(query));
  };

  constructor() {
    this.syncMobileViewFromViewport();
    effect(() => {
      const request = this.state.request();
      if (!request) {
        this.lastLoadedEventId = '';
        this.loadedEventId = '';
        this.loadingEventId = '';
        this.loadedQueryKey = '';
        this.loadingQueryKey = '';
        this.loadingPromise = null;
        this.event = null;
        this.items = [];
        this.slotSections = [];
        this.slotSectionLoaders.clear();
        this.slotSectionConfigs.clear();
        this.slotSectionHeaderLabels.clear();
        this.resetLeaderboardPopup();
        return;
      }
      if (request.eventId === this.lastLoadedEventId) {
        return;
      }
      this.lastLoadedEventId = request.eventId;
      this.loadedEventId = '';
      this.loadingEventId = '';
      this.loadedQueryKey = '';
      this.loadingQueryKey = '';
      this.loadingPromise = null;
      this.event = null;
      this.items = [];
      this.slotSections = [];
      this.slotSectionLoaders.clear();
      this.slotSectionConfigs.clear();
      this.slotSectionHeaderLabels.clear();
      this.resetLeaderboardPopup();
      this.bumpQuery();
    });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileViewFromViewport();
  }

  protected close(): void {
    this.state.close();
  }

  protected popupTitle(): string {
    return 'Sub Events';
  }

  protected popupSubtitle(): string {
    const requestTitle = this.state.request()?.title ?? '';
    return this.event?.title || requestTitle || 'Event';
  }

  protected eventRangeLabel(): string {
    const event = this.event;
    if (!event) {
      return '';
    }
    return AppUtils.dateTimeRangeLabel(event.startAtIso, event.endAtIso, event.timeframe || '');
  }

  protected orderTrigger(): AppMenuTrigger {
    const item = this.orderMenuItems().find(option => option.id === this.order);
    return {
      icon: item?.icon ?? 'schedule',
      label: (item?.label as string | null | undefined) ?? 'Upcoming',
      palette: item?.palette ?? 'blue',
      layout: 'pill',
      hideLabel: this.isMobileView
    };
  }

  protected orderMenuItems(): readonly AppMenuItem<EventSubeventsListOrder>[] {
    return [
      { id: 'upcoming', label: 'Upcoming', icon: 'schedule', palette: 'blue', surface: 'tinted' },
      { id: 'past', label: 'Past', icon: 'history', palette: 'slate', surface: 'tinted' }
    ];
  }

  protected onOrderSelect(event: AppMenuItemSelectEvent<EventSubeventsListOrder>): void {
    this.order = event.item.id;
    this.bumpQuery();
  }

  protected viewTrigger(): AppMenuTrigger {
    const item = this.viewMenuItems().find(option => option.id === this.view);
    return {
      icon: item?.icon ?? 'today',
      label: (item?.label as string | null | undefined) ?? 'Day',
      palette: item?.palette ?? 'blue',
      layout: 'pill',
      hideLabel: this.isMobileView
    };
  }

  protected viewMenuItems(): readonly AppMenuItem<EventSubeventsListView>[] {
    return [
      { id: 'month', label: 'Month', icon: 'calendar_month', palette: 'gold', surface: 'tinted' },
      { id: 'week', label: 'Week', icon: 'date_range', palette: 'green', surface: 'tinted' },
      { id: 'day', label: 'Day', icon: 'today', palette: 'blue', surface: 'tinted' }
    ];
  }

  protected onViewSelect(event: AppMenuItemSelectEvent<EventSubeventsListView>): void {
    this.view = event.item.id;
    this.bumpQuery();
  }

  protected contextMenuItems(): readonly AppMenuItem<EventSubeventsListContextAction>[] {
    const canEdit = this.state.request()?.canEdit === true;
    const memberCount = this.eventMembersCount();
    return [
      {
        id: canEdit ? 'edit' : 'view',
        label: canEdit ? 'Szerkesztés' : 'Megtekintés',
        icon: canEdit ? 'edit' : 'visibility',
        palette: canEdit ? 'amber' : 'teal',
        surface: 'tinted',
        layout: 'pill'
      },
      {
        id: 'members',
        label: 'Tagok',
        icon: 'groups',
        palette: 'violet',
        surface: 'tinted',
        layout: 'action',
        disabled: this.membersDisabled(),
        counter: memberCount > 0 ? memberCount : null
      }
    ];
  }

  protected onContextMenuSelect(event: AppMenuItemSelectEvent<EventSubeventsListContextAction>): void {
    if (event.item.id === 'members') {
      this.openMembers();
      return;
    }
    this.openEventEditor();
  }

  protected openEventEditor(): void {
    const request = this.state.request();
    if (!request) {
      return;
    }
    const canEdit = request.canEdit === true;
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      eventId: request.eventId,
      target: request.target ?? 'events',
      readOnly: !canEdit
    });
  }

  protected openMembers(): void {
    const event = this.event;
    if (!event || this.membersDisabled()) {
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'members',
      ownerId: event.id,
      ownerType: 'event',
      subtitle: event.title,
      canManage: this.state.request()?.canEdit === true,
      acceptedMembers: event.acceptedMembers,
      pendingMembers: event.pendingMembers,
      capacityTotal: event.capacityTotal
    });
  }

  protected membersDisabled(): boolean {
    return this.isLoading || !`${this.event?.id ?? ''}`.trim();
  }

  protected eventPendingMembersCount(): number {
    const event = this.event;
    if (!event) {
      return 0;
    }
    const eventId = `${event.id ?? ''}`.trim();
    const sync = this.appCtx.activityMembersSync();
    const pendingRaw = sync && eventId && sync.id === eventId
      ? sync.pendingMembers
      : (event as any).pendingMembersCount
        ?? (event as any).pendingCount
        ?? event.pendingMembers
        ?? (event as any).pending
        ?? (event as any).pendingInvites
        ?? 0;
    const pendingCount = Number(pendingRaw);
    if (!Number.isFinite(pendingCount) || pendingCount <= 0) {
      return 0;
    }
    return Math.floor(pendingCount);
  }

  protected eventMembersCount(): number {
    const event = this.event;
    if (!event) {
      return 0;
    }
    const pending = this.eventPendingMembersCount();
    const accepted = Math.max(0, Number(event.acceptedMembers) || 0);
    return accepted + pending;
  }

  protected cardFor(item: ActivityEventSubEventRuntimeDTO, groupLabel: string | null): InfoCardData {
    return EventSubeventRuntimeInfoCardConverter.convert(item, {
      event: this.event,
      mode: this.event?.mode,
      groupLabel
    });
  }

  protected trackByRuntimeId(_index: number, item: ActivityEventSubEventRuntimeDTO): string {
    return item.runtimeId;
  }

  protected slotSectionLoadPage(section: EventSubeventsSlotSection): SmartListLoadPage<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> {
    const sectionId = section.id;
    const existing = this.slotSectionLoaders.get(sectionId);
    if (existing) {
      return existing;
    }
    const loader: SmartListLoadPage<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = query =>
      of(this.slotSectionPageResult(sectionId, query));
    this.slotSectionLoaders.set(sectionId, loader);
    return loader;
  }

  protected slotSectionSmartListConfigFor(section: EventSubeventsSlotSection): SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> {
    const sectionId = section.id;
    const existing = this.slotSectionConfigs.get(sectionId);
    if (existing) {
      return existing;
    }
    const config: SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = {
      ...this.baseSlotSectionSmartListConfig,
      stickyHeaderActions: () => this.slotSectionHeaderActions(sectionId)
    };
    this.slotSectionConfigs.set(sectionId, config);
    return config;
  }

  protected onSlotSectionHeaderAction(
    section: EventSubeventsSlotSection,
    event: SmartListHeaderActionSelectEvent<EventSubeventsListFilters>
  ): void {
    if (event.action.id !== 'tournament-results') {
      return;
    }
    this.openSlotTournamentResults(section, event.sourceEvent);
  }

  protected closeLeaderboardPopup(event?: Event): void {
    event?.stopPropagation();
    this.resetLeaderboardPopup();
  }

  private async loadSubEventsPageResult(
    query: ListQuery<EventSubeventsListFilters>
  ): Promise<PageResult<EventSubeventsSlotSection>> {
    const eventId = this.state.request()?.eventId.trim() ?? '';
    if (!eventId) {
      return { items: [], total: 0, nextCursor: null };
    }
    await this.ensureSubEventsLoaded(eventId, query);
    const sorted = this.buildSlotSections();
    this.slotSections = sorted;
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 12));
    const start = page * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      nextCursor: start + pageSize < sorted.length ? `${page + 1}` : null
    };
  }

  private async ensureSubEventsLoaded(
    eventId: string,
    query: ListQuery<EventSubeventsListFilters>
  ): Promise<void> {
    const queryKey = this.subEventsLoadQueryKey(eventId, query);
    if (this.loadedEventId === eventId && this.loadedQueryKey === queryKey) {
      return;
    }
    if (this.loadingEventId === eventId && this.loadingQueryKey === queryKey && this.loadingPromise) {
      return this.loadingPromise;
    }
    const userId = this.appCtx.activeUserProfile()?.id?.trim() ?? '';
    if (!userId) {
      this.event = null;
      this.items = [];
      this.slotSections = [];
      this.slotSectionHeaderLabels.clear();
      this.loadedEventId = eventId;
      this.loadedQueryKey = queryKey;
      return;
    }
    this.loadingEventId = eventId;
    this.loadingQueryKey = queryKey;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.loadingPromise = (async () => {
      const result = await this.eventsService.loadSubEventsById(userId, eventId, this.subEventsLoadQuery(eventId, query));
      if (this.state.request()?.eventId !== eventId) {
        return;
      }
      this.event = result?.event ?? null;
      this.items = [...(result?.items ?? [])];
      this.slotSections = this.buildSlotSections();
      this.loadedEventId = eventId;
      this.loadedQueryKey = queryKey;
    })().finally(() => {
      if (this.loadingEventId === eventId && this.loadingQueryKey === queryKey) {
        this.loadingEventId = '';
        this.loadingQueryKey = '';
        this.loadingPromise = null;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
    return this.loadingPromise;
  }

  private slotSectionPageResult(
    sectionId: string,
    query: ListQuery<EventSubeventsListFilters>
  ): PageResult<ActivityEventSubEventRuntimeDTO> {
    const section = this.slotSections.find(candidate => candidate.id === sectionId) ?? null;
    const items = section?.items ?? [];
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 120));
    const start = page * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
      nextCursor: start + pageSize < items.length ? `${page + 1}` : null
    };
  }

  private buildSlotSections(): EventSubeventsSlotSection[] {
    const sections = new Map<string, EventSubeventsSlotSection>();
    this.sortedItems().forEach(item => {
      const key = this.slotSectionKey(item);
      const existing = sections.get(key);
      if (existing) {
        existing.items.push(item);
        if (!existing.startAt || this.dateMs(item.startAt) < this.dateMs(existing.startAt)) {
          existing.startAt = item.startAt ?? existing.startAt;
        }
        if (!existing.endAt || this.dateMs(item.endAt) > this.dateMs(existing.endAt)) {
          existing.endAt = item.endAt ?? existing.endAt;
        }
        return;
      }
      sections.set(key, {
        id: key,
        title: this.slotSectionTitle(item, sections.size + 1),
        subtitle: this.slotSectionSubtitle(item),
        startAt: item.startAt ?? null,
        endAt: item.endAt ?? item.startAt ?? null,
        tone: this.slotSectionTone(item),
        items: [item],
        canOpenTournamentResults: false
      });
    });
    const sorted = Array.from(sections.values()).sort((left, right) => {
      const dateCompare = this.order === 'past'
        ? this.dateMs(right.startAt) - this.dateMs(left.startAt)
        : this.dateMs(left.startAt) - this.dateMs(right.startAt);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return left.id.localeCompare(right.id);
    });
    this.syncSlotSectionHeaderLabels(sorted);
    return sorted;
  }

  private slotSectionKey(item: ActivityEventSubEventRuntimeDTO): string {
    return `${item.slotSourceId ?? ''}`.trim()
      || `${item.parentEventId ?? this.event?.id ?? 'event'}:${item.slotTimeframe ?? 'default'}`;
  }

  private slotSectionTitle(item: ActivityEventSubEventRuntimeDTO, fallbackIndex: number): string {
    const templateId = `${item.slotTemplateId ?? ''}`.trim();
    const templateIndex = templateId
      ? (this.event?.slotTemplates ?? []).findIndex(template => `${template.id ?? ''}`.trim() === templateId)
      : -1;
    return `Slot ${templateIndex >= 0 ? templateIndex + 1 : fallbackIndex}`;
  }

  private slotSectionSubtitle(item: ActivityEventSubEventRuntimeDTO): string {
    const templateStart = AppUtils.parseDate(this.slotTemplateForItem(item)?.startAt) ?? AppUtils.parseDate(item.startAt);
    const frequency = ActivityEventDetailDTO.normalizeFrequency(this.event?.frequency ?? '');
    if (templateStart && frequency !== 'One-time' && frequency !== 'Custom') {
      return this.formatRecurringSlotLabel(frequency, templateStart);
    }
    return `${item.slotTimeframe ?? ''}`.trim() || AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, '');
  }

  private slotHeaderLabel(item: ActivityEventSubEventRuntimeDTO): string {
    const mapped = this.slotSectionHeaderLabels.get(item.runtimeId);
    if (mapped) {
      return mapped;
    }
    return this.joinSlotHeaderLabel(this.slotSectionTitle(item, 1), this.slotSectionSubtitle(item));
  }

  private syncSlotSectionHeaderLabels(sections: readonly EventSubeventsSlotSection[]): void {
    this.slotSectionHeaderLabels.clear();
    sections.forEach((section, index) => {
      const firstItem = section.items[0] ?? null;
      section.title = firstItem ? this.slotSectionTitle(firstItem, index + 1) : `Slot ${index + 1}`;
      section.subtitle = firstItem ? this.slotSectionSubtitle(firstItem) : section.subtitle;
      section.tone = firstItem ? this.slotSectionTone(firstItem) : section.tone;
      section.canOpenTournamentResults = this.finalTournamentResultsItem(section) !== null;
      const label = this.joinSlotHeaderLabel(section.title, section.subtitle);
      section.items.forEach(item => this.slotSectionHeaderLabels.set(item.runtimeId, label));
    });
  }

  protected slotSectionToneClass(section: EventSubeventsSlotSection): Record<string, boolean> {
    return {
      [`event-subevents-slot-section--${section.tone}`]: true
    };
  }

  private joinSlotHeaderLabel(title: string, subtitle: string): string {
    const normalizedTitle = `${title ?? ''}`.trim();
    const normalizedSubtitle = `${subtitle ?? ''}`.trim();
    return normalizedSubtitle ? `${normalizedTitle} - ${normalizedSubtitle}` : normalizedTitle;
  }

  private slotSectionHeaderActions(sectionId: string): readonly SmartListHeaderAction<EventSubeventsListFilters>[] {
    const section = this.slotSections.find(candidate => candidate.id === sectionId) ?? null;
    if (!section?.canOpenTournamentResults) {
      return [];
    }
    return [{
      id: 'tournament-results',
      icon: 'emoji_events',
      ariaLabel: 'Open tournament results',
      className: 'smart-list__sticky-action-btn--tournament-results'
    }];
  }

  private finalTournamentResultsItem(section: EventSubeventsSlotSection | null): ActivityEventSubEventRuntimeDTO | null {
    if (!section || this.event?.mode !== 'Tournament' || section.items.length === 0) {
      return null;
    }
    const finalItem = [...section.items].sort((left, right) => {
      const dateCompare = this.dateMs(left.startAt) - this.dateMs(right.startAt);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return left.runtimeId.localeCompare(right.runtimeId);
    }).at(-1) ?? null;
    return this.isFinalizedTournamentRuntimeStage(finalItem) ? finalItem : null;
  }

  private stageStatusCode(value: unknown): string {
    return `${value ?? ''}`.trim().toUpperCase();
  }

  private isFinalizedTournamentRuntimeStage(item: ActivityEventSubEventRuntimeDTO | null): item is ActivityEventSubEventRuntimeDTO {
    if (!item || this.stageStatusCode(item.stageStatus) !== 'F') {
      return false;
    }
    const finalizedAtMs = AppUtils.parseDate(item.stageFinalizedAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    return Number.isFinite(finalizedAtMs) && finalizedAtMs <= Date.now();
  }

  private openSlotTournamentResults(section: EventSubeventsSlotSection, event: Event): void {
    event.stopPropagation();
    const finalItem = this.finalTournamentResultsItem(section);
    if (!finalItem) {
      return;
    }
    this.leaderboardPopupModel = {
      ...this.closedLeaderboardPopupModel(),
      open: true,
      subtitle: `${finalItem.name ?? section.title ?? ''}`.trim() || section.title,
      mode: finalItem.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      groups: this.buildLeaderboardGroups(finalItem)
    };
    this.cdr.markForCheck();
    void this.loadLeaderboardState(finalItem);
  }

  private resetLeaderboardPopup(): void {
    this.leaderboardPopupModel = this.closedLeaderboardPopupModel();
    this.cdr.markForCheck();
  }

  private closedLeaderboardPopupModel(): EventSubeventLeaderboardPopupModel & { loadingKey: string } {
    return {
      open: false,
      title: 'Tournament Results',
      subtitle: '',
      readOnly: true,
      mode: 'Score',
      groups: [],
      resultsMode: true,
      loadingKey: ''
    };
  }

  private buildLeaderboardGroups(item: ActivityEventSubEventRuntimeDTO): EventSubeventLeaderboardGroup[] {
    const groups = (item.groups?.length ? item.groups : this.localGeneratedGroups(item));
    const fallbackCapacity = Math.max(0, Math.trunc(Number(item.tournamentGroupCapacityMax ?? item.capacityMax) || 0));
    const advancePerGroup = Math.max(1, Math.trunc(Number(item.tournamentAdvancePerGroup) || 1));
    return groups.map((group, index) => {
      const key = `${group.id ?? `${item.id}-group-${index + 1}`}`.trim() || `${item.id}-group-${index + 1}`;
      return {
        key,
        title: `${group.name ?? `Group ${index + 1}`}`.trim() || `Group ${index + 1}`,
        pending: 0,
        advancePerGroup,
        memberCount: Math.max(0, Math.trunc(Number(group.capacityMax ?? fallbackCapacity) || 0))
      };
    });
  }

  private localGeneratedGroups(item: ActivityEventSubEventRuntimeDTO) {
    const groupCount = Math.max(1, Math.trunc(Number(item.tournamentGroupCount) || 1));
    const fallbackCapacity = Math.max(0, Math.trunc(Number(item.tournamentGroupCapacityMax ?? item.capacityMax) || 0));
    return Array.from({ length: groupCount }, (_entry, index) => ({
      id: `${item.id || 'stage'}-group-${index + 1}`,
      name: `Group ${index + 1}`,
      capacityMax: fallbackCapacity
    }));
  }

  private async loadLeaderboardState(item: ActivityEventSubEventRuntimeDTO): Promise<void> {
    const eventId = `${this.event?.id ?? item.parentEventId ?? ''}`.trim();
    const subEventId = `${item.id ?? ''}`.trim();
    const loadingKey = `${eventId}:${subEventId}`;
    if (!eventId || !subEventId) {
      return;
    }
    this.leaderboardPopupModel = {
      ...this.leaderboardPopupModel,
      loadingKey
    };
    try {
      const state = await this.eventsService.querySubEventLeaderboard(eventId, subEventId);
      if (!state || !this.leaderboardPopupModel.open || this.leaderboardPopupModel.loadingKey !== loadingKey) {
        return;
      }
      const mappedGroups = this.mapLeaderboardStateGroups(state);
      this.leaderboardPopupModel = {
        ...this.leaderboardPopupModel,
        groups: mappedGroups.length > 0 ? mappedGroups : this.leaderboardPopupModel.groups,
        mode: state.leaderboardType === 'Fifa' ? 'Fifa' : 'Score'
      };
      this.cdr.markForCheck();
    } catch {
      // Keep the locally synthesized preview if the leaderboard endpoint is not available.
    }
  }

  private mapLeaderboardStateGroups(state: SubEventLeaderboardState): EventSubeventLeaderboardGroup[] {
    return (state.groups ?? []).map((group, index) => ({
      key: `${group.groupId ?? `group-${index + 1}`}`.trim() || `group-${index + 1}`,
      title: `${group.title ?? `Group ${index + 1}`}`.trim() || `Group ${index + 1}`,
      pending: 0,
      advancePerGroup: Math.max(1, Math.trunc(Number(group.advancePerGroup) || 1)),
      memberCount: Math.max(0, Math.trunc(Number(group.memberCount) || 0)),
      advancingMemberIds: group.advancingMemberIds ?? [],
      members: this.mapLeaderboardMembers(group.members),
      scoreEntries: this.mapLeaderboardScoreEntries(group.scoreEntries, group.groupId),
      fifaMatches: this.mapLeaderboardFifaMatches(group.fifaMatches, group.groupId),
      scoreRows: this.mapLeaderboardScoreRows(group.scoreRows),
      fifaRows: this.mapLeaderboardFifaRows(group.fifaRows)
    }));
  }

  private mapLeaderboardMembers(members: readonly { id: string; name: string }[] | null | undefined): EventSubeventLeaderboardMember[] {
    return (members ?? [])
      .map(member => ({
        id: `${member.id ?? ''}`.trim(),
        name: `${member.name ?? ''}`.trim() || 'Member'
      }))
      .filter(member => member.id);
  }

  private mapLeaderboardScoreEntries(
    entries: readonly {
      id: string;
      memberId: string;
      value: number;
      note: string;
      createdAtMs: number;
    }[] | null | undefined,
    groupId: string
  ): EventSubeventLeaderboardScoreEntry[] {
    return (entries ?? [])
      .map((entry, index) => ({
        id: `${entry.id ?? `${groupId}-score-${index + 1}`}`.trim() || `${groupId}-score-${index + 1}`,
        memberId: `${entry.memberId ?? ''}`.trim(),
        value: Math.trunc(Number(entry.value) || 0),
        note: `${entry.note ?? ''}`.trim(),
        createdAtMs: Math.max(0, Math.trunc(Number(entry.createdAtMs) || Date.now()))
      }))
      .filter(entry => entry.memberId);
  }

  private mapLeaderboardFifaMatches(
    matches: readonly {
      id: string;
      homeMemberId: string;
      awayMemberId: string;
      homeScore: number;
      awayScore: number;
      note: string;
      createdAtMs: number;
    }[] | null | undefined,
    groupId: string
  ): EventSubeventLeaderboardFifaMatch[] {
    return (matches ?? [])
      .map((match, index) => ({
        id: `${match.id ?? `${groupId}-match-${index + 1}`}`.trim() || `${groupId}-match-${index + 1}`,
        homeMemberId: `${match.homeMemberId ?? ''}`.trim(),
        awayMemberId: `${match.awayMemberId ?? ''}`.trim(),
        homeScore: Math.max(0, Math.trunc(Number(match.homeScore) || 0)),
        awayScore: Math.max(0, Math.trunc(Number(match.awayScore) || 0)),
        note: `${match.note ?? ''}`.trim(),
        createdAtMs: Math.max(0, Math.trunc(Number(match.createdAtMs) || Date.now()))
      }))
      .filter(match => match.homeMemberId && match.awayMemberId);
  }

  private mapLeaderboardScoreRows(
    rows: readonly {
      memberId: string;
      memberName: string;
      total: number;
      updates: number;
      isPlaceholder?: boolean;
    }[] | null | undefined
  ): EventSubeventLeaderboardScoreRow[] {
    return (rows ?? [])
      .map(row => ({
        memberId: `${row.memberId ?? ''}`.trim(),
        memberName: `${row.memberName ?? ''}`.trim() || 'Member',
        total: Math.trunc(Number(row.total) || 0),
        updates: Math.max(0, Math.trunc(Number(row.updates) || 0)),
        isPlaceholder: row.isPlaceholder === true
      }))
      .filter(row => row.memberId);
  }

  private mapLeaderboardFifaRows(
    rows: readonly {
      memberId: string;
      memberName: string;
      points: number;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDiff: number;
      isPlaceholder?: boolean;
    }[] | null | undefined
  ): EventSubeventLeaderboardFifaRow[] {
    return (rows ?? [])
      .map(row => ({
        memberId: `${row.memberId ?? ''}`.trim(),
        memberName: `${row.memberName ?? ''}`.trim() || 'Member',
        points: Math.trunc(Number(row.points) || 0),
        played: Math.max(0, Math.trunc(Number(row.played) || 0)),
        wins: Math.max(0, Math.trunc(Number(row.wins) || 0)),
        draws: Math.max(0, Math.trunc(Number(row.draws) || 0)),
        losses: Math.max(0, Math.trunc(Number(row.losses) || 0)),
        goalsFor: Math.trunc(Number(row.goalsFor) || 0),
        goalsAgainst: Math.trunc(Number(row.goalsAgainst) || 0),
        goalDiff: Math.trunc(Number(row.goalDiff) || 0),
        isPlaceholder: row.isPlaceholder === true
      }))
      .filter(row => row.memberId);
  }

  private syncMobileViewFromViewport(): void {
    const next = typeof window !== 'undefined' && window.innerWidth <= 760;
    if (next === this.isMobileView) {
      return;
    }
    this.isMobileView = next;
    this.cdr.markForCheck();
  }

  private slotTemplateForItem(item: ActivityEventSubEventRuntimeDTO) {
    const templateId = `${item.slotTemplateId ?? ''}`.trim();
    if (!templateId) {
      return null;
    }
    return (this.event?.slotTemplates ?? []).find(template => `${template.id ?? ''}`.trim() === templateId) ?? null;
  }

  private slotSectionTone(_item: ActivityEventSubEventRuntimeDTO): EventSubeventsSlotTone {
    switch (ActivityEventDetailDTO.normalizeFrequency(this.event?.frequency ?? '')) {
      case 'Daily':
        return 'green';
      case 'Weekly':
        return 'cyan';
      case 'Bi-weekly':
        return 'violet';
      case 'Monthly':
        return 'amber';
      case 'Yearly':
        return 'gold';
      default:
        return 'blue';
    }
  }

  private formatRecurringSlotLabel(frequency: string, start: Date): string {
    const time = this.formatSlotTimeLabel(start);
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Daily':
        return `Every day at ${time}`;
      case 'Weekly':
        return `Every ${this.formatSlotWeekday(start)} at ${time}`;
      case 'Bi-weekly':
        return `Every second ${this.formatSlotWeekday(start)} at ${time}`;
      case 'Monthly':
        return `Every month on day ${start.getDate()} at ${time}`;
      case 'Yearly':
        return `Every year on ${this.formatSlotMonthDay(start)} at ${time}`;
      default:
        return AppUtils.dateTimeRangeLabel(start.toISOString(), '', '');
    }
  }

  private formatSlotTimeLabel(value: Date): string {
    return value.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private formatSlotWeekday(value: Date): string {
    return value.toLocaleDateString('en-US', {
      weekday: 'long'
    });
  }

  private formatSlotMonthDay(value: Date): string {
    return value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  private sortedItems(): ActivityEventSubEventRuntimeDTO[] {
    return [...this.items].sort((left, right) => {
      const dateCompare = this.order === 'past'
        ? this.dateMs(right.startAt) - this.dateMs(left.startAt)
        : this.dateMs(left.startAt) - this.dateMs(right.startAt);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return left.runtimeId.localeCompare(right.runtimeId);
    });
  }

  private groupLabel(value: string | null | undefined, view: EventSubeventsListView): string {
    const date = AppUtils.parseDate(value);
    if (!date) {
      return 'Date unavailable';
    }
    if (view === 'month') {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const start = AppUtils.startOfWeekMonday(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${AppUtils.shortMonthDayLabel(start)} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return AppUtils.smartListDayLabel(date);
  }

  private dateMs(value: string | null | undefined): number {
    return AppUtils.parseDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
  }

  private slotSectionCalendarRange(section: EventSubeventsSlotSection) {
    const start = AppUtils.parseDate(section.startAt);
    const end = AppUtils.parseDate(section.endAt) ?? start;
    if (!start || !end) {
      return null;
    }
    return {
      start,
      end: end.getTime() >= start.getTime() ? end : start
    };
  }

  private calendarInitialAnchor(): string | Date | null {
    const event = this.event;
    if (!event) {
      return null;
    }
    return this.order === 'past'
      ? (event.endAtIso || event.startAtIso || null)
      : (event.startAtIso || event.endAtIso || null);
  }

  private subEventsLoadQueryKey(eventId: string, query: ListQuery<EventSubeventsListFilters>): string {
    const loadQuery = this.subEventsLoadQuery(eventId, query);
    return [
      loadQuery.eventId,
      loadQuery.order ?? '',
      loadQuery.view ?? '',
      loadQuery.anchorDate ?? '',
      loadQuery.rangeStart ?? '',
      loadQuery.rangeEnd ?? ''
    ].join('|');
  }

  private subEventsLoadQuery(
    eventId: string,
    query: ListQuery<EventSubeventsListFilters>
  ): ActivityEventSubEventsQueryDTO {
    return {
      userId: this.appCtx.activeUserProfile()?.id?.trim() ?? '',
      eventId,
      order: this.order,
      view: (query.view as EventSubeventsListView | undefined) ?? this.view,
      anchorDate: query.anchorDate ?? null,
      rangeStart: query.rangeStart ?? null,
      rangeEnd: query.rangeEnd ?? null
    };
  }

  private bumpQuery(): void {
    this.revision += 1;
    this.query = {
      ...this.query,
      view: this.view,
      direction: this.order === 'past' ? 'desc' : 'asc',
      filters: { revision: this.revision }
    };
  }
}
