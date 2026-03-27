import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type {
  ActivitiesFeedFilters,
  ActivitiesPageRequest,
  EventExploreFeedFilters
} from '../../../core/base/models';
import type { ChatMenuItem } from '../interfaces/activity-feed.interface';
import type { ListQuery, PageResult } from '../../../ui';
import {
  buildActivityEventRows,
  buildActivityRateRows,
  toActivitiesPageRequest
} from '../converters';
import { AppContext } from '../context';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { ChatsService } from './chats.service';
import { EventsService } from './events.service';
import { RatesService } from './rates.service';
import { SessionService } from './session.service';
import { DemoUsersRepository } from '../../demo';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService {
  private readonly sessionService = inject(SessionService);
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly ratesService = inject(RatesService);
  private readonly appCtx = inject(AppContext);
  private readonly demoUsersRepository = inject(DemoUsersRepository);

  async loadActivities(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { chatItems?: readonly ChatMenuItem[] } = {}
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const request = toActivitiesPageRequest(query);
    if (request.primaryFilter === 'rates') {
      return this.loadRates(request);
    }
    if (request.primaryFilter === 'events') {
      return this.loadEvents(request);
    }

    return this.loadChats(request, options);
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
        users: this.demoUsersRepository.queryAllUsers(),
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
      users: this.demoUsersRepository.queryAllUsers()
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
    const activeUserId = this.appCtx.getActiveUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
    return this.isDemoModeEnabled('/activities/events')
      ? (this.demoUsersRepository.queryAllUsers()[0]?.id ?? '')
      : '';
  }

  private normalizeEventActivitiesSort(value: string | undefined): 'date' | 'distance' | 'relevance' {
    return value === 'distance' || value === 'relevance' ? value : 'date';
  }

  private resolveExploreFilters(
    input: Partial<EventExploreFeedFilters> | null | undefined
  ): EventExploreFeedFilters {
    return {
      userId: input?.userId?.trim() || this.resolveActiveUserId(),
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
    return this.dateRangeOverlaps(
      AppUtils.dateOnly(range.start),
      AppUtils.dateOnly(range.end),
      start,
      end
    );
  }


  private dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
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
