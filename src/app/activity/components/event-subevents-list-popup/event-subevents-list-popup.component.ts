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
  type ActivityEventSubEventsResultDTO,
  type ActivityEventStageActionResultDTO,
  type ActivityEventSubEventsQueryDTO
} from '../../../shared/core/contracts/activity.interface';
import type { EventMode, EventSlotTemplateDTO, EventTournamentStageDTO, SubEventDTO } from '../../../shared/core/contracts/event.interface';
import {
  InfoCardComponent,
  PopupComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type InfoCardData,
  type ListQuery,
  type PageResult,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  EventSubeventRuntimeInfoCardConverter,
  EventSubeventRuntimeMenuConverter,
  EventSubeventsSlotConverter,
  type EventSubeventsSlotModel,
  type EventSubeventRuntimeMenuContext,
  type EventSubeventRuntimeMenuItemId
} from '../../../shared/ui/converters';
import {
  EventsService
} from '../../../shared/core';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';
import {
  SubEventResourcePopupStore,
  type SubEventResourceMetricsUpdate
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';

type EventSubeventsListView = 'day' | 'week' | 'month';
type EventSubeventsListOrder = 'upcoming' | 'past';
type EventSubeventsListContextAction = 'edit' | 'view' | 'members';
type EventSubeventsListPopupMenuContext =
  | { menu: 'order'; order: EventSubeventsListOrder }
  | { menu: 'view'; view: EventSubeventsListView }
  | { menu: 'context'; action: EventSubeventsListContextAction };

interface EventSubeventsListFilters {
  revision: number;
}

interface EventSubeventsParentContext {
  id: string;
  title: string | null;
  timeframe?: string | null;
  startAtIso?: string | null;
  endAtIso?: string | null;
  location?: string | null;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  creatorUserId?: string | null;
  userId?: string | null;
  adminIds?: string[];
  autoInviter?: boolean;
  frequency?: string | null;
  mode?: EventMode | null;
  slotTemplates?: EventSlotTemplateDTO[];
}

@Component({
  selector: 'app-event-subevents-list-popup',
  standalone: true,
  imports: [
    CommonModule,
    PopupComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-subevents-list-popup.component.html',
  styleUrl: './event-subevents-list-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventSubeventsListPopupComponent {
  private readonly eventsService = inject(EventsService);
  private readonly dialogStore = inject(DialogStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  protected readonly eventSubeventsStore = inject(EventSubeventsPopupStore);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoading = false;
  protected event: EventSubeventsParentContext | null = null;
  protected items: SubEventDTO[] = [];
  protected slotSections: EventSubeventsSlotModel[] = [];
  protected view: EventSubeventsListView = 'day';
  protected order: EventSubeventsListOrder = 'upcoming';
  protected isMobileView = false;
  protected query: Partial<ListQuery<EventSubeventsListFilters>> = {
    view: 'day',
    filters: { revision: 0 }
  };
  protected slotSectionQuery: Partial<ListQuery<EventSubeventsListFilters>> = {
    filters: { revision: 0 }
  };

  private revision = 0;
  private lastLoadedEventId = '';
  private loadedEventId = '';
  private loadingEventId = '';
  private loadedQueryKey = '';
  private loadingQueryKey = '';
  private loadingPromise: Promise<void> | null = null;

  private readonly slotSectionLoaders = new Map<string, SmartListLoadPage<SubEventDTO, EventSubeventsListFilters>>();
  private readonly slotSectionConfigs = new Map<string, SmartListConfig<SubEventDTO, EventSubeventsListFilters>>();
  private readonly slotSectionHeaderLabels = new Map<string, string>();

  protected readonly smartListConfig: SmartListConfig<EventSubeventsSlotModel, EventSubeventsListFilters> = {
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
    emptyLabel: 'event.subevents.empty.label',
    emptyDescription: () => this.subEventsEmptyDescription(),
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    headerProgress: { enabled: true, placement: 'inline', tone: 'accent' },
    groupBy: (section, query) => this.groupLabel(section.startAt, query.view as EventSubeventsListView),
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    trackBy: (_index, section) => section.id
  };

  private readonly baseSlotSectionSmartListConfig: SmartListConfig<SubEventDTO, EventSubeventsListFilters> = {
    pageSize: 120,
    defaultView: 'list',
    showStickyHeader: true,
    showGroupMarker: () => false,
    emptyLabel: 'event.subevents.empty.slot.label',
    emptyDescription: () => this.subEventsEmptyDescription(),
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
    trackBy: (index, item) => this.subEventItemKey(item, index)
  };

  private readonly flatSubEventsSmartListConfig: SmartListConfig<SubEventDTO, EventSubeventsListFilters> = {
    pageSize: 120,
    defaultView: 'list',
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'event.subevents.empty.event.label',
    emptyDescription: () => this.subEventsEmptyDescription(),
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'proximity',
    menuItems: context => context.item
      ? this.subEventMenuItems(context.item) as readonly AppMenuItem<string, unknown>[]
      : [],
    trackBy: (index, item) => this.subEventItemKey(item, index)
  };

  protected readonly loadSubEventsPage: SmartListLoadPage<EventSubeventsSlotModel, EventSubeventsListFilters> = query => {
    return from(this.loadSubEventsPageResult(query));
  };

  constructor() {
    this.syncMobileViewFromViewport();
    effect(() => {
      const request = this.eventSubeventsStore.eventSubeventsListPopup();
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

    effect(() => {
      const request = this.eventSubeventsStore.eventTournamentGroupsPopup();
      if (!request || !this.isOpen()) {
        return;
      }
      void this.eventSubeventsStore.ensureEventTournamentGroupsPopupLoaded();
    });

    effect(() => {
      const request = this.resourcePopupStore.subEventResourcePopupRequest();
      if (!request || !this.isOpen()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      if (!this.shouldHostResourcePopup()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      if (!this.shouldHostResourcePopup() || !this.resourcePopupStore.assetExplorePopupRef()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourceAssetExploreLoaded();
    });

    effect(() => {
      if (!this.shouldHostResourcePopup()
        || this.resourcePopupStore.assetExploreOnlyRef()
        || !this.resourcePopupStore.supplyPopupRef()) {
        return;
      }
      void this.resourcePopupStore.ensureEventSupplyContributionsPopupLoaded();
    });

    effect(() => {
      const update = this.resourcePopupStore.subEventResourceMetricsUpdate();
      if (!update || !this.isOpen()) {
        return;
      }
      this.applySubEventResourceMetricsUpdate(update);
    });

    effect(() => {
      const sync = this.activitiesStore.activityEventSave();
      const request = this.eventSubeventsStore.eventSubeventsListPopup();
      if (!sync || !request || !this.isOpen()) {
        return;
      }
      const savedEventId = `${sync.id ?? ''}`.trim();
      const openEventId = `${request.eventId ?? ''}`.trim();
      if (!savedEventId || savedEventId !== openEventId) {
        return;
      }
      this.invalidateLoadedRuntime();
    });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileViewFromViewport();
  }

  protected isOpen(): boolean {
    return Boolean(this.eventSubeventsStore.eventSubeventsListPopup());
  }

  protected shouldHostResourcePopup(): boolean {
    return this.isOpen()
      && (this.resourcePopupStore.subEventResourcePopupRequest() !== null
        || this.resourcePopupStore.popupContextRef()?.origin === 'subEventResource');
  }

  protected shouldHostSupplyContributionsPopup(): boolean {
    return this.shouldHostResourcePopup()
      && !this.resourcePopupStore.assetExploreOnlyRef()
      && this.resourcePopupStore.supplyPopupRef() !== null;
  }

  protected close(): void {
    this.eventSubeventsStore.closeEventSubeventsListPopup();
  }

  protected popupModel(): PopupModel<EventSubeventsListPopupMenuContext> {
    return {
      title: this.popupSubtitle(),
      subtitle: this.popupHeaderSubtitle(),
      ariaLabel: this.popupSubtitle(),
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.popupHeaderControls(),
      toolbarControls: this.popupToolbarControls(),
      onClose: () => this.close(),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected popupTitle(): string {
    return 'Sub Events';
  }

  protected popupSubtitle(): string {
    const requestTitle = this.eventSubeventsStore.eventSubeventsListPopup()?.title ?? '';
    return this.event?.title || requestTitle || 'Event';
  }

  private subEventsEmptyDescription(): string {
    return this.order === 'past'
      ? 'event.subevents.empty.past.description'
      : 'event.subevents.empty.upcoming.description';
  }

  protected popupHeaderSubtitle(): string {
    return this.eventRangeLabel() || this.popupTitle();
  }

  protected eventRangeLabel(): string {
    const event = this.event;
    if (!event) {
      return '';
    }
    return AppUtils.dateTimeRangeLabel(event.startAtIso, event.endAtIso, event.timeframe || '');
  }

  private popupHeaderControls(): PopupControl<EventSubeventsListPopupMenuContext>[] {
    return [
      {
        kind: 'menu',
        id: 'order',
        trigger: this.orderTrigger(),
        items: this.orderMenuItems()
      },
      {
        kind: 'menu',
        id: 'view',
        trigger: this.viewTrigger(),
        items: this.viewMenuItems()
      }
    ];
  }

  private popupToolbarControls(): PopupControl<EventSubeventsListPopupMenuContext>[] {
    return [
      {
        kind: 'menu',
        id: 'context',
        align: 'end',
        menuKind: 'inline',
        items: this.contextMenuItems()
      }
    ];
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<EventSubeventsListPopupMenuContext>): void {
    const context = event.itemSelect.context;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'order':
        this.selectOrder(context.order);
        return;
      case 'view':
        this.selectView(context.view);
        return;
      case 'context':
        this.selectContextAction(context.action);
        return;
    }
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

  protected orderMenuItems(): readonly AppMenuItem<string, EventSubeventsListPopupMenuContext>[] {
    return [
      {
        id: 'upcoming',
        label: 'Upcoming',
        icon: 'schedule',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'order', order: 'upcoming' }
      },
      {
        id: 'past',
        label: 'Past',
        icon: 'history',
        palette: 'slate',
        surface: 'tinted',
        context: { menu: 'order', order: 'past' }
      }
    ];
  }

  private selectOrder(order: EventSubeventsListOrder): void {
    this.order = order;
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

  protected viewMenuItems(): readonly AppMenuItem<string, EventSubeventsListPopupMenuContext>[] {
    return [
      {
        id: 'month',
        label: 'Month',
        icon: 'calendar_month',
        palette: 'gold',
        surface: 'tinted',
        context: { menu: 'view', view: 'month' }
      },
      {
        id: 'week',
        label: 'Week',
        icon: 'date_range',
        palette: 'green',
        surface: 'tinted',
        context: { menu: 'view', view: 'week' }
      },
      {
        id: 'day',
        label: 'Day',
        icon: 'today',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'view', view: 'day' }
      }
    ];
  }

  private selectView(view: EventSubeventsListView): void {
    this.view = view;
    this.bumpQuery();
  }

  protected contextMenuItems(): readonly AppMenuItem<string, EventSubeventsListPopupMenuContext>[] {
    const canEdit = this.eventSubeventsStore.eventSubeventsListPopup()?.canEdit === true;
    const memberCount = this.eventMembersCount();
    return [
      {
        id: canEdit ? 'edit' : 'view',
        label: canEdit ? 'Szerkesztés' : 'Megtekintés',
        icon: canEdit ? 'edit' : 'visibility',
        palette: canEdit ? 'amber' : 'teal',
        surface: 'tinted',
        layout: 'action',
        context: { menu: 'context', action: canEdit ? 'edit' : 'view' }
      },
      {
        id: 'members',
        label: 'Tagok',
        icon: 'groups',
        palette: 'violet',
        surface: 'tinted',
        layout: 'action',
        disabled: this.membersDisabled(),
        counter: memberCount > 0 ? memberCount : null,
        context: { menu: 'context', action: 'members' }
      }
    ];
  }

  private selectContextAction(action: EventSubeventsListContextAction): void {
    if (action === 'members') {
      this.openMembers();
      return;
    }
    this.openEventEditor();
  }

  protected openEventEditor(): void {
    const request = this.eventSubeventsStore.eventSubeventsListPopup();
    if (!request) {
      return;
    }
    const canEdit = request.canEdit === true;
    this.memberMenuStore.requestActivitiesNavigation({
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
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: event.id,
      ownerType: 'event',
      subtitle: event.title ?? '',
      canManage: this.eventSubeventsStore.eventSubeventsListPopup()?.canEdit === true,
      acceptedMembers: Math.max(0, Math.trunc(Number(event.acceptedMembers) || 0)),
      pendingMembers: Math.max(0, Math.trunc(Number(event.pendingMembers) || 0)),
      capacityTotal: Math.max(0, Math.trunc(Number(event.capacityTotal) || 0))
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

  protected cardFor(item: SubEventDTO, groupLabel: string | null): InfoCardData {
    const section = this.slotSectionForItem(item);
    const sequence = this.subEventSequence(item);
    return EventSubeventRuntimeInfoCardConverter.convert(item, {
      event: this.event,
      mode: this.event?.mode,
      cardId: this.subEventItemKey(item),
      slotTimeframe: section?.slot.timeframe ?? null,
      groupLabel,
      sequenceNumber: sequence.number,
      sequenceTotal: sequence.total,
      hasMenuOptions: true,
      menuTitle: item.name,
      menuBadgeCount: EventSubeventRuntimeMenuConverter.pendingBadgeCount(item, {
        event: this.event,
        mode: this.event?.mode
      })
    });
  }

  protected subEventMenuContext(item: SubEventDTO): { itemKey: string } {
    return { itemKey: this.subEventItemKey(item) };
  }

  protected subEventMenuItems(
    item: SubEventDTO
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const section = this.slotSectionForItem(item);
    const sequence = this.subEventSequence(item);
    return EventSubeventRuntimeMenuConverter.convert(item, {
      event: this.event,
      mode: this.event?.mode,
      canManageTournament: this.canManageRuntimeActions(),
      parentEventId: section?.slot.parentEventId ?? this.event?.id ?? null,
      slotId: section?.slot.slotSourceId ?? null,
      sourceId: this.subEventOwnerId(item),
      subEventIndex: this.subEventIndex(item),
      stageNumber: sequence.number,
      siblingItems: this.subEventSiblings(item),
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
        this.openTournamentGroupsPopup(context, menuEvent.sourceEvent);
        return;
      case 'resource':
        this.openSubEventResourcePopup(context, menuEvent.sourceEvent);
        return;
      default:
        return;
    }
  }

  private requestStageStatusAction(context: Extract<EventSubeventRuntimeMenuContext, { scope: 'stage-status' }>): void {
    if (!this.canManageRuntimeActions()) {
      return;
    }
    this.dialogStore.open({
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
    const section = this.slotSectionForItem(context.item);
    const sourceId = `${context.parentEventId ?? section?.slot.parentEventId ?? this.event?.id ?? context.sourceId ?? ''}`.trim();
    const slotSourceId = `${context.slotId ?? section?.slot.slotSourceId ?? ''}`.trim() || null;
    const action = `${context.action ?? ''}`.trim();
    if (!userId || !sourceId || !action) {
      throw new Error('Missing stage action target.');
    }
    const result = await this.eventsService.applyStageAction({
      userId,
      sourceId,
      slotSourceId,
      subEventId: context.subEventId,
      subEventIndex: context.subEventIndex,
      action,
      reason: context.reason
    });
    if (!result) {
      throw new Error('Stage action was not applied.');
    }
    if (`${result.stageStatus ?? ''}`.trim() !== context.nextStatus) {
      throw new Error('Stage action was not applied.');
    }
    this.patchSubEventStageActionResult(context.item, result);
  }

  private patchSubEventStageActionResult(
    item: SubEventDTO,
    result: ActivityEventStageActionResultDTO
  ): void {
    const resultId = `${result.subEventId ?? ''}`.trim();
    const itemId = `${item.id ?? ''}`.trim();
    const index = this.subEventIndex(item);
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
    context: Extract<EventSubeventRuntimeMenuContext, { scope: 'resource' }>,
    event: Event
  ): void {
    event.stopPropagation();
    const ownerId = `${context.sourceId ?? ''}`.trim();
    const item = context.item;
    if (!ownerId) {
      return;
    }
    const parentTitle = this.popupSubtitle();
    const itemTitle = `${item.name ?? ''}`.trim();
    const timeframe = AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, '');
    this.resourcePopupStore.requestSubEventResourcePopup({
      type: context.resourceType,
      ownerId,
      parentTitle: this.popupSubtitle(),
      subEventId: `${item.id ?? ''}`.trim(),
      subEventIndex: context.subEventIndex,
      popupHeader: {
        title: this.joinDistinctResourcePopupHeaderLabels([parentTitle, itemTitle]) || parentTitle || itemTitle || 'Event',
        subtitle: timeframe || null
      },
      subEventHeader: {
        name: item.name,
        description: item.description,
        location: item.location,
        startAt: item.startAt,
        endAt: item.endAt
      }
    });
  }

  private joinDistinctResourcePopupHeaderLabels(parts: readonly string[]): string {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const part of parts) {
      const value = `${part ?? ''}`.trim();
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) {
        continue;
      }
      seen.add(key);
      labels.push(value);
    }
    return labels.join(' - ');
  }

  private openTournamentGroupsPopup(
    context: Extract<EventSubeventRuntimeMenuContext, { scope: 'stage-dashboard' }>,
    event: Event
  ): void {
    event.stopPropagation();
    const eventId = `${context.parentEventId ?? this.event?.id ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this.eventSubeventsStore.openEventTournamentGroupsPopup({
      eventId,
      slotId: context.slotId,
      title: this.popupSubtitle(),
      canManage: this.canManageRuntimeActions(),
      stages: this.subEventSiblings(context.item).map((stage, index) => this.subEventTournamentStage(stage, index)),
      selectedStageId: `${context.item.id ?? ''}`.trim() || null
    });
  }

  private subEventTournamentStage(item: SubEventDTO, index: number): EventTournamentStageDTO {
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

  private subEventOwnerId(item: SubEventDTO): string {
    const section = this.slotSectionForItem(item);
    return section
      ? EventSubeventsSlotConverter.slotOwnerId(section)
      : `${this.event?.id ?? ''}`.trim();
  }

  private applySubEventResourceMetricsUpdate(update: SubEventResourceMetricsUpdate): void {
    const ownerId = `${update.ownerId ?? ''}`.trim();
    const subEventId = `${update.subEventId ?? ''}`.trim();
    if (!ownerId || !subEventId) {
      return;
    }

    let changed = false;
    const patchItem = (item: SubEventDTO): SubEventDTO => {
      const itemOwnerId = this.subEventOwnerId(item);
      const itemId = `${item.id ?? ''}`.trim();
      if (itemOwnerId !== ownerId || itemId !== subEventId) {
        return item;
      }
      changed = true;
      return {
        ...item,
        carsAccepted: update.subEvent.carsAccepted,
        carsPending: update.subEvent.carsPending,
        carsCapacityMin: update.subEvent.carsCapacityMin,
        carsCapacityMax: update.subEvent.carsCapacityMax,
        accommodationAccepted: update.subEvent.accommodationAccepted,
        accommodationPending: update.subEvent.accommodationPending,
        accommodationCapacityMin: update.subEvent.accommodationCapacityMin,
        accommodationCapacityMax: update.subEvent.accommodationCapacityMax,
        suppliesAccepted: update.subEvent.suppliesAccepted,
        suppliesPending: update.subEvent.suppliesPending,
        suppliesCapacityMin: update.subEvent.suppliesCapacityMin,
        suppliesCapacityMax: update.subEvent.suppliesCapacityMax
      };
    };

    const nextSlotSections = this.slotSections.map(section => {
      const nextItems = section.items.map(patchItem);
      return {
        ...section,
        items: nextItems,
        slot: {
          ...section.slot,
          subEventItems: nextItems
        }
      };
    });
    if (!changed) {
      return;
    }
    this.slotSections = nextSlotSections;
    this.items = nextSlotSections.flatMap(section => section.items);
    this.bumpQuery();
    this.cdr.markForCheck();
  }

  private subEventIndex(item: SubEventDTO): number {
    const siblings = this.subEventSiblings(item);
    const index = siblings.findIndex(candidate => candidate === item);
    return index >= 0 ? index : 0;
  }

  private subEventSiblings(item: SubEventDTO): readonly SubEventDTO[] {
    const sourceId = this.subEventOwnerId(item);
    const section = this.slotSectionForItem(item);
    const scoped = section?.items ?? this.items.filter(candidate => this.subEventOwnerId(candidate) === sourceId);
    return [...scoped].sort((left, right) => this.dateMs(left.startAt) - this.dateMs(right.startAt));
  }

  private canManageRuntimeActions(): boolean {
    if (this.eventSubeventsStore.eventSubeventsListPopup()?.canEdit === true) {
      return true;
    }
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

  protected trackBySubEventItem(index: number, item: SubEventDTO): string {
    return this.subEventItemKey(item, index);
  }

  protected slotSectionLoadPage(section: EventSubeventsSlotModel): SmartListLoadPage<SubEventDTO, EventSubeventsListFilters> {
    const sectionId = section.id;
    const existing = this.slotSectionLoaders.get(sectionId);
    if (existing) {
      return existing;
    }
    const loader: SmartListLoadPage<SubEventDTO, EventSubeventsListFilters> = query =>
      of(this.slotSectionPageResult(sectionId, query));
    this.slotSectionLoaders.set(sectionId, loader);
    return loader;
  }

  protected slotSectionSmartListConfigFor(section: EventSubeventsSlotModel): SmartListConfig<SubEventDTO, EventSubeventsListFilters> {
    const sectionId = section.id;
    const existing = this.slotSectionConfigs.get(sectionId);
    if (existing) {
      return existing;
    }
    const config: SmartListConfig<SubEventDTO, EventSubeventsListFilters> = section.isSlot
      ? { ...this.baseSlotSectionSmartListConfig }
      : { ...this.flatSubEventsSmartListConfig };
    this.slotSectionConfigs.set(sectionId, config);
    return config;
  }

  private async loadSubEventsPageResult(
    query: ListQuery<EventSubeventsListFilters>
  ): Promise<PageResult<EventSubeventsSlotModel>> {
    const eventId = this.eventSubeventsStore.eventSubeventsListPopup()?.eventId.trim() ?? '';
    if (!eventId) {
      return { items: [], total: 0, nextCursor: null };
    }
    await this.ensureSubEventsLoaded(eventId, query);
    const sorted = this.slotSections;
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
      if (this.eventSubeventsStore.eventSubeventsListPopup()?.eventId !== eventId) {
        return;
      }
      this.applyLoadedSubEventsSlots(eventId, result, query);
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

  private applyLoadedSubEventsSlots(
    eventId: string,
    result: ActivityEventSubEventsResultDTO | null,
    query: ListQuery<EventSubeventsListFilters>
  ): void {
    const requestEvent = this.parentContextFromRequest(eventId);
    const event = {
      ...requestEvent,
      mode: result?.mode ?? null
    };
    const slots = result?.slots ?? [];
    this.event = event;
    this.slotSections = EventSubeventsSlotConverter.convertList(slots, {
      event,
      order: this.order
    });
    this.syncSlotSectionHeaderLabels(this.slotSections);
    this.items = this.slotSections.flatMap(section => section.items);
    this.loadedEventId = eventId;
    this.loadedQueryKey = this.subEventsLoadQueryKey(eventId, query);
    this.cdr.markForCheck();
  }

  private parentContextFromRequest(eventId: string): EventSubeventsParentContext {
    const request = this.eventSubeventsStore.eventSubeventsListPopup();
    return {
      id: eventId,
      title: request?.title ?? null,
      timeframe: request?.timeframe ?? null,
      startAtIso: request?.startAtIso ?? null,
      endAtIso: request?.endAtIso ?? null,
      mode: request?.mode ?? null
    };
  }

  private slotSectionPageResult(
    sectionId: string,
    query: ListQuery<EventSubeventsListFilters>
  ): PageResult<SubEventDTO> {
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

  private subEventSequence(item: SubEventDTO): { number: number; total: number } {
    const section = this.slotSectionForItem(item);
    const items = section?.items ?? this.items;
    const index = items.findIndex(candidate => candidate === item);
    return {
      number: index >= 0 ? index + 1 : 1,
      total: Math.max(items.length, 1)
    };
  }

  private slotSectionForItem(item: SubEventDTO): EventSubeventsSlotModel | null {
    return this.slotSections.find(section => section.items.some(candidate => candidate === item)) ?? null;
  }

  private subEventItemKey(item: SubEventDTO, fallbackIndex = 0): string {
    const section = this.slotSectionForItem(item);
    if (!section) {
      return `${item.id ?? ''}`.trim() || `subevent-${fallbackIndex + 1}`;
    }
    const itemIndex = section.items.findIndex(candidate => candidate === item);
    return EventSubeventsSlotConverter.itemKey(section, item, itemIndex >= 0 ? itemIndex : fallbackIndex);
  }

  private slotHeaderLabel(item: SubEventDTO): string {
    const mapped = this.slotSectionHeaderLabels.get(this.subEventItemKey(item));
    if (mapped) {
      return mapped;
    }
    const section = this.slotSectionForItem(item);
    return section ? EventSubeventsSlotConverter.headerLabel(section) : 'Sub events';
  }

  private syncSlotSectionHeaderLabels(sections: readonly EventSubeventsSlotModel[]): void {
    this.slotSectionHeaderLabels.clear();
    sections.forEach(section => {
      const label = EventSubeventsSlotConverter.headerLabel(section);
      section.items.forEach((item, index) => {
        this.slotSectionHeaderLabels.set(EventSubeventsSlotConverter.itemKey(section, item, index), label);
      });
    });
  }

  protected slotSectionToneClass(section: EventSubeventsSlotModel): Record<string, boolean> {
    return {
      [`event-subevents-slot-section--${section.tone}`]: true,
      'event-subevents-slot-section--flat': !section.isSlot
    };
  }

  private syncMobileViewFromViewport(): void {
    const next = typeof window !== 'undefined' && window.innerWidth <= 760;
    if (next === this.isMobileView) {
      return;
    }
    this.isMobileView = next;
    this.cdr.markForCheck();
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

  private slotSectionCalendarRange(section: EventSubeventsSlotModel) {
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

  private invalidateLoadedRuntime(): void {
    this.loadedEventId = '';
    this.loadedQueryKey = '';
    this.loadingEventId = '';
    this.loadingQueryKey = '';
    this.loadingPromise = null;
    this.bumpQuery();
    this.cdr.markForCheck();
  }

  private bumpQuery(): void {
    this.revision += 1;
    const revisionFilter = { revision: this.revision };
    this.query = {
      ...this.query,
      view: this.view,
      direction: this.order === 'past' ? 'desc' : 'asc',
      filters: revisionFilter
    };
    this.slotSectionQuery = {
      filters: revisionFilter
    };
  }
}
