import {
  CommonModule
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  effect,
  inject
} from '@angular/core';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from,
  of
} from 'rxjs';

import {
  AppUtils
} from '../../../shared/app-utils';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  ActivityEventDetailDTO,
  type ActivityEventStageActionResultDTO,
  type ActivityEventSubEventsQueryDTO,
  type ActivityEventSubEventRuntimeDTO
} from '../../../shared/core/contracts/activity.interface';
import type { EventTournamentStageDTO } from '../../../shared/core/contracts/event.interface';
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
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  EventSubeventRuntimeInfoCardConverter,
  EventSubeventRuntimeMenuConverter,
  type EventSubeventRuntimeMenuContext,
  type EventSubeventRuntimeMenuItemId
} from '../../../shared/ui/converters';
import {
  EventsService
} from '../../../shared/core';
import type { SubEventResourceFilter } from '../../../shared/core/common/constants';
import {
  ConfirmationDialogStore
} from '../../../shared/ui/context/stores/confirmation-dialog.store';
import {
  EventEditorPopupStore
} from '../../../shared/ui/context/stores/event-editor-popup.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { PopupStore } from '../../../shared/ui/context/stores/popup.store';

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
  isSlot: boolean;
  items: ActivityEventSubEventRuntimeDTO[];
}

@Component({
  selector: 'app-event-subevents-list-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-subevents-list-popup.component.html',
  styleUrl: './event-subevents-list-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventSubeventsListPopupComponent {
  private readonly eventsService = inject(EventsService);
  private readonly eventEditorStore = inject(EventEditorPopupStore);
  private readonly confirmationDialogStore = inject(ConfirmationDialogStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly popupStore = inject(PopupStore);
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
    menuItems: context => context.item
      ? this.subEventMenuItems(context.item) as readonly AppMenuItem<string, unknown>[]
      : [],
    trackBy: (_index, item) => item.runtimeId
  };

  private readonly flatSubEventsSmartListConfig: SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = {
    pageSize: 120,
    defaultView: 'list',
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No sub events in this event',
    emptyDescription: '',
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'proximity',
    menuItems: context => context.item
      ? this.subEventMenuItems(context.item) as readonly AppMenuItem<string, unknown>[]
      : [],
    trackBy: (_index, item) => item.runtimeId
  };

  protected readonly loadSubEventsPage: SmartListLoadPage<EventSubeventsSlotSection, EventSubeventsListFilters> = query => {
    return from(this.loadSubEventsPageResult(query));
  };

  constructor() {
    this.syncMobileViewFromViewport();
    effect(() => {
      const request = this.popupStore.eventSubeventsListPopup();
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
      this.bumpQuery();
    });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileViewFromViewport();
  }

  protected isOpen(): boolean {
    return Boolean(this.popupStore.eventSubeventsListPopup());
  }

  protected close(): void {
    this.popupStore.closeEventSubeventsListPopup();
  }

  protected popupTitle(): string {
    return 'Sub Events';
  }

  protected popupSubtitle(): string {
    const requestTitle = this.popupStore.eventSubeventsListPopup()?.title ?? '';
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
    const canEdit = this.popupStore.eventSubeventsListPopup()?.canEdit === true;
    const memberCount = this.eventMembersCount();
    return [
      {
        id: canEdit ? 'edit' : 'view',
        label: canEdit ? 'Szerkesztés' : 'Megtekintés',
        icon: canEdit ? 'edit' : 'visibility',
        palette: canEdit ? 'amber' : 'teal',
        surface: 'tinted',
        layout: 'action'
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
    const request = this.popupStore.eventSubeventsListPopup();
    if (!request) {
      return;
    }
    const canEdit = request.canEdit === true;
    this.popupStore.requestActivitiesNavigation({
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
    this.popupStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: event.id,
      ownerType: 'event',
      subtitle: event.title,
      canManage: this.popupStore.eventSubeventsListPopup()?.canEdit === true,
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
    const sync = this.activityStore.activityMembersSync();
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
    const sequence = this.runtimeSequence(item);
    return EventSubeventRuntimeInfoCardConverter.convert(item, {
      event: this.event,
      mode: this.event?.mode,
      groupLabel,
      sequenceNumber: sequence.number,
      sequenceTotal: sequence.total,
      isStageActive: this.isRuntimeStageActive(item),
      isStageScheduled: this.isRuntimeStageScheduled(item),
      isStageBlocked: this.isRuntimeStageBlocked(item),
      hasMenuOptions: true,
      menuTitle: item.name,
      menuBadgeCount: EventSubeventRuntimeMenuConverter.pendingBadgeCount(item, {
        event: this.event,
        mode: this.event?.mode
      })
    });
  }

  protected subEventMenuContext(item: ActivityEventSubEventRuntimeDTO): { runtimeId: string } {
    return { runtimeId: item.runtimeId };
  }

  protected subEventMenuItems(
    item: ActivityEventSubEventRuntimeDTO
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const sequence = this.runtimeSequence(item);
    return EventSubeventRuntimeMenuConverter.convert(item, {
      event: this.event,
      mode: this.event?.mode,
      canManageTournament: this.canManageRuntimeActions(),
      sourceId: this.runtimeActionSourceId(item),
      subEventIndex: this.runtimeSourceIndex(item),
      stageNumber: sequence.number,
      isStageActive: this.isRuntimeStageActive(item),
      canStartStage: this.canStartRuntimeStage(item),
      siblingItems: this.runtimeSiblings(item),
      nowMs: Date.now()
    });
  }

  protected onSubEventMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const menuEvent = event as AppMenuItemSelectEvent<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>;
    const context = menuEvent.context;
    if (!context) {
      return;
    }
    menuEvent.sourceEvent.stopPropagation();
    switch (context.scope) {
      case 'stage-status':
        this.requestStageStatusAction(context);
        return;
      case 'stage-dashboard':
        this.openTournamentGroupsPopup(context.item, menuEvent.sourceEvent);
        return;
      case 'resource':
        this.openSubEventResourcePopup(context.resourceType, context.item, menuEvent.sourceEvent);
        return;
      default:
        return;
    }
  }

  private requestStageStatusAction(context: Extract<EventSubeventRuntimeMenuContext, { scope: 'stage-status' }>): void {
    if (!this.canManageRuntimeActions()) {
      return;
    }
    this.confirmationDialogStore.open({
      title: context.title,
      message: context.description,
      cancelLabel: 'Cancel',
      confirmLabel: context.confirmLabel,
      busyConfirmLabel: context.busyLabel,
      confirmTone: context.destructive ? 'danger' : 'accent',
      confirmPalette: context.confirmPalette,
      failureMessage: 'Action failed.',
      onConfirm: async () => {
        await this.applyStageStatusAction(context);
      }
    });
  }

  private async applyStageStatusAction(context: Extract<EventSubeventRuntimeMenuContext, { scope: 'stage-status' }>): Promise<void> {
    const userId = this.activeUserId();
    const sourceId = `${context.sourceId ?? ''}`.trim();
    const action = `${context.action ?? ''}`.trim();
    if (!userId || !sourceId || !action) {
      throw new Error('Missing stage action target.');
    }
    const result = await this.eventsService.applyStageAction({
      userId,
      sourceId,
      subEventId: context.subEventId,
      subEventIndex: context.subEventIndex,
      action,
      reason: context.reason
    });
    if (!result) {
      throw new Error('Stage action was not applied.');
    }
    this.patchRuntimeStageActionResult(context.item, result);
  }

  private patchRuntimeStageActionResult(
    item: ActivityEventSubEventRuntimeDTO,
    result: ActivityEventStageActionResultDTO
  ): void {
    const resultId = `${result.subEventId ?? ''}`.trim();
    const itemId = `${item.id ?? ''}`.trim();
    const index = this.runtimeSourceIndex(item);
    if (resultId && itemId && resultId !== itemId) {
      return;
    }
    if (!resultId && Number.isFinite(Number(result.subEventIndex)) && Math.trunc(Number(result.subEventIndex)) !== index) {
      return;
    }
    item.stageStatus = `${result.stageStatus ?? ''}`.trim() || item.stageStatus;
    item.stageStatusReason = `${result.stageStatusReason ?? ''}`.trim() || null;
    item.stageStatusUpdatedAt = `${result.stageStatusUpdatedAt ?? ''}`.trim() || null;
    item.stageFinalizedAt = `${result.stageFinalizedAt ?? ''}`.trim() || null;
    item.stageFinalizedByUserId = `${result.stageFinalizedByUserId ?? ''}`.trim() || null;
    if (this.event && result.autoInviter !== undefined && result.autoInviter !== null) {
      this.event.autoInviter = result.autoInviter === true;
    }
    this.cdr.markForCheck();
  }

  private openSubEventResourcePopup(
    type: SubEventResourceFilter,
    item: ActivityEventSubEventRuntimeDTO,
    event: Event
  ): void {
    event.stopPropagation();
    const ownerId = this.runtimeActionSourceId(item);
    if (!ownerId) {
      return;
    }
    this.eventEditorStore.requestSubEventResourcePopup({
      type,
      ownerId,
      parentTitle: this.popupSubtitle(),
      subEvent: {
        ...item,
        id: `${item.id ?? ''}`.trim() || item.runtimeId
      }
    });
  }

  private openTournamentGroupsPopup(item: ActivityEventSubEventRuntimeDTO, event: Event): void {
    event.stopPropagation();
    const eventId = `${item.parentEventId ?? this.event?.id ?? this.runtimeActionSourceId(item)}`.trim();
    const slotId = `${item.slotSourceId ?? ''}`.trim() || null;
    if (!eventId) {
      return;
    }
    this.popupStore.openEventTournamentGroupsPopup({
      eventId,
      slotId,
      title: this.popupSubtitle(),
      canManage: this.canManageRuntimeActions(),
      stages: this.runtimeSiblings(item).map((stage, index) => this.runtimeTournamentStage(stage, index)),
      selectedStageId: `${item.id ?? ''}`.trim() || null
    });
  }

  private runtimeTournamentStage(item: ActivityEventSubEventRuntimeDTO, index: number): EventTournamentStageDTO {
    const stageNumber = Math.max(1, index + 1);
    return {
      subEventId: `${item.id ?? `stage-${stageNumber}`}`.trim() || `stage-${stageNumber}`,
      title: `${item.name ?? `Stage ${stageNumber}`}`.trim() || `Stage ${stageNumber}`,
      description: `${item.description ?? ''}`.trim(),
      location: `${item.location ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      stageNumber,
      stageStatus: `${item.stageStatus ?? ''}`.trim(),
      leaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      advancePerGroup: Math.max(0, Math.trunc(Number(item.tournamentAdvancePerGroup) || 0)),
      groups: []
    };
  }

  private runtimeActionSourceId(item: ActivityEventSubEventRuntimeDTO): string {
    return `${item.slotSourceId ?? item.parentEventId ?? this.event?.id ?? ''}`.trim();
  }

  private runtimeSourceIndex(item: ActivityEventSubEventRuntimeDTO): number {
    const siblings = this.runtimeSiblings(item);
    const index = siblings.findIndex(candidate => candidate.runtimeId === item.runtimeId);
    return index >= 0 ? index : 0;
  }

  private isRuntimeStageActive(item: ActivityEventSubEventRuntimeDTO): boolean {
    if (this.normalizeRuntimeStageStatus(item.stageStatus) !== 'A') {
      return false;
    }
    if (!this.isRuntimeStageAssignmentOpen(item)) {
      return false;
    }
    const startMs = this.dateMs(item.startAt);
    return !Number.isFinite(startMs) || startMs <= Date.now();
  }

  private isRuntimeStageScheduled(item: ActivityEventSubEventRuntimeDTO): boolean {
    const status = this.normalizeRuntimeStageStatus(item.stageStatus);
    if (status !== 'A' && status !== 'RS') {
      return false;
    }
    if (!this.isRuntimeStageAssignmentOpen(item)) {
      return false;
    }
    const startMs = this.dateMs(item.startAt);
    return Number.isFinite(startMs) && startMs > Date.now();
  }

  private isRuntimeStageBlocked(item: ActivityEventSubEventRuntimeDTO): boolean {
    if (this.normalizeRuntimeStageStatus(item.stageStatus) !== 'RS') {
      return false;
    }
    if (!this.isRuntimeStageAssignmentOpen(item)) {
      return false;
    }
    const startMs = this.dateMs(item.startAt);
    return Number.isFinite(startMs) && startMs <= Date.now();
  }

  private canStartRuntimeStage(item: ActivityEventSubEventRuntimeDTO): boolean {
    return this.normalizeRuntimeStageStatus(item.stageStatus) === 'RS'
      && this.runtimeSourceIndex(item) === 0
      && this.isRuntimeStageAssignmentOpen(item);
  }

  private isRuntimeStageAssignmentOpen(item: ActivityEventSubEventRuntimeDTO): boolean {
    const siblings = this.runtimeSiblings(item);
    const index = siblings.findIndex(candidate => candidate.runtimeId === item.runtimeId);
    if (index <= 0) {
      return true;
    }
    return this.normalizeRuntimeStageStatus(siblings[index - 1]?.stageStatus) === 'F';
  }

  private normalizeRuntimeStageStatus(status: string | null | undefined): 'A' | 'RS' | 'SR' | 'F' | 'S' {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    if (normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S') {
      return normalized;
    }
    return 'A';
  }

  private runtimeSiblings(item: ActivityEventSubEventRuntimeDTO): readonly ActivityEventSubEventRuntimeDTO[] {
    const sourceId = this.runtimeActionSourceId(item);
    const section = this.slotSections.find(candidate =>
      candidate.items.some(sectionItem => sectionItem.runtimeId === item.runtimeId)
    );
    const scoped = section?.items ?? this.items.filter(candidate => this.runtimeActionSourceId(candidate) === sourceId);
    return [...scoped].sort((left, right) => this.dateMs(left.startAt) - this.dateMs(right.startAt));
  }

  private canManageRuntimeActions(): boolean {
    const event = this.event;
    const activeUserId = this.activeUserId();
    if (!event || !activeUserId) {
      return false;
    }
    const creatorId = `${event.creatorUserId ?? event.userId ?? ''}`.trim();
    const ownerId = `${event.userId ?? ''}`.trim();
    const adminIds = Array.isArray(event.adminIds) ? event.adminIds.map(id => `${id}`.trim()) : [];
    return activeUserId === creatorId || activeUserId === ownerId || adminIds.includes(activeUserId);
  }

  private activeUserId(): string {
    return this.userProfileStore.activeUserProfile()?.id?.trim() || this.userProfileStore.activeUserId().trim() || this.userProfileStore.getActiveUserId().trim();
  }

  private invalidateLoadedRuntime(): void {
    this.loadedEventId = '';
    this.loadedQueryKey = '';
    this.loadingEventId = '';
    this.loadingQueryKey = '';
    this.loadingPromise = null;
    this.bumpQuery();
    this.cdr.markForCheck();
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
    const config: SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = section.isSlot
      ? { ...this.baseSlotSectionSmartListConfig }
      : { ...this.flatSubEventsSmartListConfig };
    this.slotSectionConfigs.set(sectionId, config);
    return config;
  }

  private async loadSubEventsPageResult(
    query: ListQuery<EventSubeventsListFilters>
  ): Promise<PageResult<EventSubeventsSlotSection>> {
    const eventId = this.popupStore.eventSubeventsListPopup()?.eventId.trim() ?? '';
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
    const userId = this.userProfileStore.activeUserProfile()?.id?.trim() ?? '';
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
      if (this.popupStore.eventSubeventsListPopup()?.eventId !== eventId) {
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

  private runtimeSequence(item: ActivityEventSubEventRuntimeDTO): { number: number; total: number } {
    const section = this.slotSections.find(candidate =>
      candidate.items.some(sectionItem => sectionItem.runtimeId === item.runtimeId)
    );
    const items = section?.items ?? this.items;
    const index = items.findIndex(candidate => candidate.runtimeId === item.runtimeId);
    return {
      number: index >= 0 ? index + 1 : 1,
      total: Math.max(items.length, 1)
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
        isSlot: this.runtimeItemHasSlot(item),
        items: [item]
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
      section.isSlot = firstItem ? this.runtimeItemHasSlot(firstItem) : section.isSlot;
      const label = this.joinSlotHeaderLabel(section.title, section.subtitle);
      section.items.forEach(item => this.slotSectionHeaderLabels.set(item.runtimeId, label));
    });
  }

  protected slotSectionToneClass(section: EventSubeventsSlotSection): Record<string, boolean> {
    return {
      [`event-subevents-slot-section--${section.tone}`]: true,
      'event-subevents-slot-section--flat': !section.isSlot
    };
  }

  private joinSlotHeaderLabel(title: string, subtitle: string): string {
    const normalizedTitle = `${title ?? ''}`.trim();
    const normalizedSubtitle = `${subtitle ?? ''}`.trim();
    return normalizedSubtitle ? `${normalizedTitle} - ${normalizedSubtitle}` : normalizedTitle;
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

  private runtimeItemHasSlot(item: ActivityEventSubEventRuntimeDTO): boolean {
    return Boolean(`${item.slotSourceId ?? ''}`.trim() || `${item.slotTemplateId ?? ''}`.trim());
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
      userId: this.userProfileStore.activeUserProfile()?.id?.trim() ?? '',
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
