import { Injectable, inject } from '@angular/core';

import { AppCalendarHelpers } from '../../../app-calendar-helpers';
import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../app-types';
import type {
  ActivitiesFeedFilters,
  ActivitiesPageRequest,
  EventExploreFeedFilters
} from '../../../activities-models';
import { DEMO_USERS, type ChatMenuItem } from '../../../demo-data';
import type { ListQuery, PageResult } from '../../../ui';
import {
  buildActivityEventRows,
  buildActivityRateRows
} from '../converters';
import { AppContext } from '../context';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { ChatsService } from './chats.service';
import { EventsService } from './events.service';
import { RatesService } from './rates.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService {
  private readonly sessionService = inject(SessionService);
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly ratesService = inject(RatesService);
  private readonly appCtx = inject(AppContext);
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);

  async loadActivities(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { chatItems?: readonly ChatMenuItem[] } = {}
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const request = this.toActivitiesPageRequest(query);
    if (request.primaryFilter === 'rates') {
      return this.loadRates(request);
    }
    if (request.primaryFilter === 'events') {
      return this.loadEvents(request);
    }

    return this.loadChats(request, options);
  }

  toActivitiesPageRequest(query: ListQuery<ActivitiesFeedFilters>): ActivitiesPageRequest {
    const filters = query.filters;
    const primaryFilter = this.normalizeActivitiesPrimaryFilter((filters?.primaryFilter ?? 'chats') as AppTypes.ActivitiesPrimaryFilter);
    const secondaryFilter = this.normalizeActivitiesSecondaryFilter(filters?.secondaryFilter, primaryFilter);
    const view = this.normalizeActivitiesView(query.view);

    return {
      primaryFilter,
      eventScopeFilter: this.normalizeActivitiesEventScopeFilter(filters?.eventScopeFilter),
      secondaryFilter,
      chatContextFilter: this.normalizeActivitiesChatContextFilter(filters?.chatContextFilter),
      hostingPublicationFilter: this.normalizeHostingPublicationFilter(filters?.hostingPublicationFilter),
      rateFilter: this.normalizeRateFilter(filters?.rateFilter),
      view,
      page: Math.max(0, Math.trunc(query.page)),
      pageSize: Math.max(1, Math.trunc(query.pageSize)),
      cursor: query.cursor ?? null,
      sort: this.resolveActivitiesPageSort(primaryFilter, secondaryFilter, view),
      direction: this.resolveActivitiesPageSortDirection(primaryFilter, secondaryFilter, view),
      groupBy: query.groupBy,
      anchorDate: query.anchorDate,
      rangeStart: query.rangeStart,
      rangeEnd: query.rangeEnd
    };
  }

  async loadExplore(query: ListQuery<EventExploreFeedFilters>): Promise<PageResult<DemoEventRecord>> {
    const filters = this.resolveExploreFilters(query.filters);
    const result = await this.eventsService.queryEventExplorePage({
      ...filters,
      limit: this.resolveExplorePageSize(query.pageSize),
      cursor: query.cursor ?? null
    });
    return {
      items: result.records.map(record => this.cloneExploreRecord(record)),
      total: result.total,
      nextCursor: result.nextCursor
    };
  }

  private async loadRates(request: ActivitiesPageRequest): Promise<PageResult<AppTypes.ActivityListRow>> {
    const activeUserId = this.resolveActiveUserId();
    const page = await this.ratesService.queryActivitiesRatePage(activeUserId, request);
    return {
      items: buildActivityRateRows(page.items, {
        activeUserId,
        users: this.users,
        filter: request.rateFilter,
        secondaryFilter: request.secondaryFilter,
        view: request.view,
        preserveOrder: true
      }),
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }

  private async loadEvents(request: ActivitiesPageRequest): Promise<PageResult<AppTypes.ActivityListRow>> {
    const activeUserId = this.resolveActiveUserId();
    const page = await this.eventsService.queryActivitiesEventPage({
      userId: activeUserId,
      filter: request.eventScopeFilter ?? 'active-events',
      hostingPublicationFilter: request.hostingPublicationFilter,
      secondaryFilter: request.secondaryFilter,
      sort: this.normalizeEventActivitiesSort(request.sort),
      view: request.view,
      limit: request.pageSize,
      cursor: request.cursor ?? null
    });
    const rows = buildActivityEventRows(page.records);
    if (this.isCalendarActivitiesView(request.view)) {
      return this.paginateActivitiesRows(rows, request);
    }
    return {
      items: rows,
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  private async loadChats(
    request: ActivitiesPageRequest,
    options: { chatItems?: readonly ChatMenuItem[] }
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    return this.chatsService.queryActivitiesChatPage(this.resolveActiveUserId(), request, {
      chatItems: options.chatItems,
      users: this.users
    });
  }

  private resolveActiveUserId(): string {
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo' && session.userId.trim().length > 0) {
      return session.userId.trim();
    }
    if (session?.kind === 'firebase' && session.profile.id.trim().length > 0) {
      return session.profile.id.trim();
    }
    return DEMO_USERS[0]?.id ?? 'u1';
  }

  private normalizeActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): AppTypes.ActivitiesPrimaryFilter {
    if (filter === 'hosting' || filter === 'invitations') {
      return 'events';
    }
    return filter;
  }

  private normalizeActivitiesEventScopeFilter(value: unknown): AppTypes.ActivitiesEventScope {
    return value === 'all'
      || value === 'invitations'
      || value === 'my-events'
      || value === 'drafts'
      || value === 'trash'
      ? value
      : 'active-events';
  }

  private normalizeActivitiesSecondaryFilter(
    value: unknown,
    primaryFilter?: AppTypes.ActivitiesPrimaryFilter
  ): AppTypes.ActivitiesSecondaryFilter {
    const normalized = value === 'relevant' || value === 'past' ? value : 'recent';
    return primaryFilter === 'events' && normalized === 'relevant'
      ? 'recent'
      : normalized;
  }

  private normalizeActivitiesChatContextFilter(value: unknown): AppTypes.ActivitiesChatContextFilter {
    return value === 'event' || value === 'subEvent' || value === 'group' ? value : 'all';
  }

  private normalizeHostingPublicationFilter(value: unknown): AppTypes.HostingPublicationFilter {
    return value === 'drafts' ? 'drafts' : 'all';
  }

  private normalizeRateFilter(value: unknown): AppTypes.RateFilterKey {
    return value === 'individual-received'
      || value === 'individual-mutual'
      || value === 'individual-met'
      || value === 'pair-given'
      || value === 'pair-received'
      ? value
      : 'individual-given';
  }

  private normalizeActivitiesView(value: unknown): AppTypes.ActivitiesView {
    return value === 'week' || value === 'month' || value === 'distance' ? value : 'day';
  }

  private resolveActivitiesPageSort(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter,
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
    view: AppTypes.ActivitiesView
  ): string {
    if (primaryFilter === 'rates') {
      if (view === 'distance') {
        return 'distance';
      }
      if (secondaryFilter === 'relevant') {
        return 'relevance';
      }
      return 'happenedAt';
    }

    if (primaryFilter === 'events') {
      if (view === 'distance') {
        return 'distance';
      }
      if (secondaryFilter === 'relevant') {
        return 'relevance';
      }
      return 'date';
    }

    return view === 'distance' ? 'distance' : 'date';
  }

  private resolveActivitiesPageSortDirection(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter,
    secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
    view: AppTypes.ActivitiesView
  ): 'asc' | 'desc' {
    if (primaryFilter === 'rates') {
      if (view === 'distance') {
        return 'asc';
      }
      if (secondaryFilter === 'relevant') {
        return 'desc';
      }
      return 'desc';
    }

    if (primaryFilter === 'events') {
      if (view === 'distance') {
        return 'asc';
      }
      if (secondaryFilter === 'past') {
        return 'desc';
      }
      if (secondaryFilter === 'relevant') {
        return 'asc';
      }
      return 'asc';
    }

    return view === 'distance' ? 'asc' : 'desc';
  }

  private normalizeEventActivitiesSort(value: string | undefined): 'date' | 'distance' | 'relevance' {
    return value === 'distance' || value === 'relevance' ? value : 'date';
  }

  private resolveExploreFilters(
    input: Partial<EventExploreFeedFilters> | null | undefined
  ): EventExploreFeedFilters {
    return {
      userId: input?.userId?.trim() || this.appCtx.getActiveUserId().trim() || 'u1',
      order: this.normalizeEventExploreOrder(input?.order),
      view: this.normalizeEventExploreView(input?.view),
      friendsOnly: input?.friendsOnly === true,
      openSpotsOnly: input?.openSpotsOnly === true,
      topic: this.normalizeEventExploreTopic(input?.topic ?? '')
    };
  }

  private normalizeEventExploreOrder(value: unknown): AppTypes.EventExploreOrder {
    return value === 'past-events'
      || value === 'nearby'
      || value === 'most-relevant'
      || value === 'top-rated'
      ? value
      : 'upcoming';
  }

  private normalizeEventExploreView(value: unknown): AppTypes.EventExploreView {
    return value === 'distance' ? 'distance' : 'day';
  }

  private normalizeEventExploreTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private resolveExplorePageSize(value: number): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private cloneExploreRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics]
    };
  }

  private paginateActivitiesRows(
    rows: readonly AppTypes.ActivityListRow[],
    request: ActivitiesPageRequest
  ): PageResult<AppTypes.ActivityListRow> {
    if (this.isCalendarActivitiesView(request.view)) {
      const range = this.activitiesQueryRange(request);
      const filteredRows = range
        ? rows.filter(row => this.doesActivityRowOverlapRange(row, range.start, range.end))
        : [...rows];
      return {
        items: filteredRows,
        total: filteredRows.length
      };
    }

    const startIndex = request.page * request.pageSize;
    return {
      items: rows.slice(startIndex, startIndex + request.pageSize),
      total: rows.length
    };
  }

  private activitiesQueryRange(request: ActivitiesPageRequest): { start: Date; end: Date } | null {
    const start = this.parseSmartListDate(request.rangeStart);
    const end = this.parseSmartListDate(request.rangeEnd);
    if (!start || !end) {
      return null;
    }
    return {
      start,
      end: AppUtils.dateOnly(end)
    };
  }

  private doesActivityRowOverlapRange(row: AppTypes.ActivityListRow, start: Date, end: Date): boolean {
    const range = this.resolveActivityRowRange(row);
    if (!range) {
      return false;
    }
    return AppCalendarHelpers.dateRangeOverlaps(
      AppUtils.dateOnly(range.start),
      AppUtils.dateOnly(range.end),
      start,
      end
    );
  }

  private resolveActivityRowRange(row: AppTypes.ActivityListRow): { start: Date; end: Date } | null {
    if (row.type === 'rates') {
      const point = new Date(row.dateIso);
      if (Number.isNaN(point.getTime())) {
        return null;
      }
      return { start: point, end: new Date(point.getTime() + 60 * 1000) };
    }
    const source = row.source as { startAt?: string; endAt?: string };
    const start = new Date(source.startAt ?? row.dateIso);
    const end = new Date(source.endAt ?? new Date(start.getTime() + (2 * 60 * 60 * 1000)).toISOString());
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return end.getTime() > start.getTime()
      ? { start, end }
      : { start, end: new Date(start.getTime() + (2 * 60 * 60 * 1000)) };
  }

  private isCalendarActivitiesView(view: AppTypes.ActivitiesView): boolean {
    return view === 'week' || view === 'month';
  }

  private parseSmartListDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10) - 1;
      const day = Number.parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return AppUtils.dateOnly(parsed);
  }
}
