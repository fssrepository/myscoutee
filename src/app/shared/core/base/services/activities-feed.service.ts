import { Injectable, inject } from '@angular/core';

import { ACTIVITIES_DATA_SOURCE } from '../../../activities-data-source';
import { AppCalendarHelpers } from '../../../app-calendar-helpers';
import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../app-types';
import type {
  ActivitiesFeedFilters,
  ActivitiesPageRequest
} from '../../../activities-models';
import { DEMO_USERS } from '../../../demo-data';
import type { ListQuery, PageResult } from '../../../ui';
import {
  buildActivityChatRows,
  buildActivityEventRows,
  buildActivityRateRows,
  activityChatContextFilterKey
} from '../converters';
import { DemoRatesService } from '../../demo';
import { ChatsService } from './chats.service';
import { EventsService } from './events.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesFeedService {
  private readonly dataSource = inject(ACTIVITIES_DATA_SOURCE);
  private readonly sessionService = inject(SessionService);
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly demoRatesService = inject(DemoRatesService);
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);

  async loadActivities(query: ListQuery<ActivitiesFeedFilters>): Promise<PageResult<AppTypes.ActivityListRow>> {
    const request = this.toActivitiesPageRequest(query);
    if (this.dataSource.mode === 'http') {
      const result = await this.dataSource.loadActivitiesPage(request);
      return {
        items: result?.rows ?? [],
        total: Number.isFinite(result?.total) ? Math.max(0, Math.trunc(Number(result?.total))) : 0,
        nextCursor: result?.nextCursor ?? null
      };
    }

    if (request.primaryFilter === 'rates') {
      return this.loadDemoRates(request);
    }
    if (request.primaryFilter === 'events') {
      return this.loadDemoEvents(request);
    }

    return this.loadDemoChats(request);
  }

  toActivitiesPageRequest(query: ListQuery<ActivitiesFeedFilters>): ActivitiesPageRequest {
    const filters = query.filters;
    const primaryFilter = this.normalizeActivitiesPrimaryFilter((filters?.primaryFilter ?? 'chats') as AppTypes.ActivitiesPrimaryFilter);
    const secondaryFilter = this.normalizeActivitiesSecondaryFilter(filters?.secondaryFilter);
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

  private async loadDemoRates(request: ActivitiesPageRequest): Promise<PageResult<AppTypes.ActivityListRow>> {
    const activeUserId = this.resolveActiveUserId();
    const page = await this.demoRatesService.queryActivitiesRatePage(activeUserId, request);
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

  private async loadDemoEvents(request: ActivitiesPageRequest): Promise<PageResult<AppTypes.ActivityListRow>> {
    const activeUserId = this.resolveActiveUserId();
    const records = await this.eventsService.queryEventItemsByFilter(
      activeUserId,
      request.eventScopeFilter ?? 'active-events',
      request.hostingPublicationFilter
    );
    const rows = buildActivityEventRows(records);
    const sorted = this.sortDemoEventRows(rows, request);
    return this.paginateActivitiesRows(sorted, request);
  }

  private async loadDemoChats(request: ActivitiesPageRequest): Promise<PageResult<AppTypes.ActivityListRow>> {
    const activeUserId = this.resolveActiveUserId();
    const items = await this.chatsService.queryChatItemsByUser(activeUserId);
    const filteredItems = items.filter(item =>
      request.chatContextFilter === 'all'
        ? true
        : activityChatContextFilterKey(item) === request.chatContextFilter
    );
    const rows = buildActivityChatRows(filteredItems, {
      users: this.users,
      activeUserId
    });
    const sorted = this.sortDemoChatRows(rows, request);
    return this.paginateActivitiesRows(sorted, request);
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

  private sortDemoEventRows(
    rows: readonly AppTypes.ActivityListRow[],
    request: ActivitiesPageRequest
  ): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (request.view === 'distance') {
      return sorted.sort((left, right) => this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right));
    }
    if (request.secondaryFilter === 'recent') {
      if (request.eventScopeFilter !== 'invitations') {
        return sorted.sort((left, right) => AppUtils.toSortableDate(left.dateIso) - AppUtils.toSortableDate(right.dateIso));
      }
      return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
    }
    if (request.secondaryFilter === 'past') {
      return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
    }
    if (request.eventScopeFilter !== 'invitations') {
      return sorted.sort((left, right) =>
        right.metricScore - left.metricScore
        || AppUtils.toSortableDate(left.dateIso) - AppUtils.toSortableDate(right.dateIso)
      );
    }
    return sorted.sort((left, right) =>
      right.metricScore - left.metricScore
      || AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso)
    );
  }

  private sortDemoChatRows(
    rows: readonly AppTypes.ActivityListRow[],
    request: ActivitiesPageRequest
  ): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (request.view === 'distance') {
      return sorted.sort((left, right) => this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right));
    }
    if (request.secondaryFilter === 'past') {
      return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
    }
    if (request.secondaryFilter === 'relevant') {
      return sorted.sort((left, right) =>
        right.metricScore - left.metricScore
        || AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso)
      );
    }
    return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
  }

  private activityRowDistanceOrderValue(row: AppTypes.ActivityListRow): number {
    if (Number.isFinite(row.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(row.distanceMetersExact)));
    }
    return Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
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

  private normalizeActivitiesSecondaryFilter(value: unknown): AppTypes.ActivitiesSecondaryFilter {
    return value === 'relevant' || value === 'past' ? value : 'recent';
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

    return view === 'distance' ? 'asc' : 'desc';
  }
}
