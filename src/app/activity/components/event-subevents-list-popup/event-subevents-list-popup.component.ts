import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';

import { AppUtils } from '../../../shared/app-utils';
import {
  type ActivityEventDetailDTO,
  type ActivityEventSubEventRuntimeDTO
} from '../../../shared/core/contracts/activity.interface';
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
import { AppContext, AppPopupContext } from '../../../shared/ui/context';
import { EventSubeventRuntimeInfoCardConverter } from '../../../shared/ui/converters';
import { EventsService } from '../../../shared/core';
import { EventSubeventsListPopupStateService } from '../../services/event-subevents-list-popup-state.service';

type EventSubeventsListView = 'day' | 'week' | 'month';
type EventSubeventsListOrder = 'upcoming' | 'past';
type EventSubeventsListContextAction = 'edit' | 'view' | 'members';

interface EventSubeventsListFilters {
  revision: number;
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
  protected readonly state = inject(EventSubeventsListPopupStateService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoading = false;
  protected event: ActivityEventDetailDTO | null = null;
  protected items: ActivityEventSubEventRuntimeDTO[] = [];
  protected view: EventSubeventsListView = 'day';
  protected order: EventSubeventsListOrder = 'upcoming';
  protected query: Partial<ListQuery<EventSubeventsListFilters>> = {
    view: 'day',
    filters: { revision: 0 }
  };

  private revision = 0;
  private lastLoadedEventId = '';

  protected readonly smartListConfig: SmartListConfig<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = {
    pageSize: 24,
    defaultView: 'day',
    showStickyHeader: true,
    emptyLabel: 'No sub events yet',
    emptyDescription: '',
    listLayout: 'card-grid',
    desktopColumns: 3,
    mobileStepper: true,
    pagination: { mode: 'arrows' },
    groupBy: (item, query) => this.groupLabel(item, query.view as EventSubeventsListView),
    showGroupMarker: ({ group }) => Boolean(group.label),
    trackBy: (_index, item) => item.runtimeId
  };

  protected readonly loadSubEventsPage: SmartListLoadPage<ActivityEventSubEventRuntimeDTO, EventSubeventsListFilters> = query => {
    const sorted = this.sortedItems();
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 24));
    const start = page * pageSize;
    return of({
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      nextCursor: start + pageSize < sorted.length ? `${page + 1}` : null
    } satisfies PageResult<ActivityEventSubEventRuntimeDTO>);
  };

  constructor() {
    effect(() => {
      const request = this.state.request();
      if (!request) {
        this.lastLoadedEventId = '';
        this.event = null;
        this.items = [];
        return;
      }
      if (request.eventId === this.lastLoadedEventId) {
        return;
      }
      this.lastLoadedEventId = request.eventId;
      void this.loadSubEvents(request.eventId);
    });
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
      layout: 'pill'
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
      layout: 'pill'
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
      label: canEdit ? 'Esemény szerkesztése' : 'Esemény megtekintése',
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

  private async loadSubEvents(eventId: string): Promise<void> {
    const userId = this.appCtx.activeUserProfile()?.id?.trim() ?? '';
    if (!userId) {
      return;
    }
    this.isLoading = true;
    this.cdr.markForCheck();
    const result = await this.eventsService.loadSubEventsById(userId, eventId);
    this.event = result?.event ?? null;
    this.items = [...(result?.items ?? [])];
    this.isLoading = false;
    this.bumpQuery();
    this.cdr.markForCheck();
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

  private groupLabel(item: ActivityEventSubEventRuntimeDTO, view: EventSubeventsListView): string {
    const date = AppUtils.parseDate(item.startAt);
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

  private bumpQuery(): void {
    this.revision += 1;
    this.query = {
      ...this.query,
      view: this.view,
      filters: { revision: this.revision }
    };
  }
}
