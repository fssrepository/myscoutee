import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type * as ContractTypes from '../../contracts';
import type { ActivitiesFeedFilters, ActivitiesPageRequest, EventExploreFeedFilters } from '../../contracts';
import type { ChatDTO, ChatRecord } from '../../contracts/chat.interface';
import type { UserDto } from '../../contracts/user.interface';
import type { ListQuery, PageResult } from '../../../ui';
import {
  toActivitiesPageRequest
} from '../mappers';
import { AppContext } from '../../../ui/context';
import type { ActivityEventDTO, ActivityEventRecord, ActivityRateDTO } from '../../contracts/activity.interface';
import { ChatsService } from './chats.service';
import { EventsService } from './events.service';
import { RatesService } from './rates.service';
import { SessionService } from './session.service';
import { UsersService } from './users.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService extends BaseRouteModeService {
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly ratesService = inject(RatesService);
  private readonly appCtx = inject(AppContext);
  private readonly usersService = inject(UsersService);

  async loadExplore(query: ListQuery<EventExploreFeedFilters>): Promise<PageResult<ActivityEventRecord>> {
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

  async loadActivityEvents(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PageResult<ActivityEventDTO>> {
    const request = toActivitiesPageRequest(query);
    const activeUserId = this.resolveActiveUserId();
    const page = await this.eventsService.queryActivitiesEventDTOPage({
      userId: activeUserId,
      filter: request.eventScopeFilter ?? 'active-events',
      hostingPublicationFilter: request.hostingPublicationFilter,
      secondaryFilter: request.secondaryFilter,
      sort: this.normalizeEventActivitiesSort(request.sort),
      view: request.view,
      limit: request.pageSize,
      cursor: request.cursor ?? null,
      anchorDate: request.anchorDate,
      rangeStart: request.rangeStart,
      rangeEnd: request.rangeEnd
    }, options.signal);
    if (this.isCalendarActivitiesView(request.view)) {
      return this.paginateActivityEventDTOs(page.items, request);
    }
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  async loadActivityChats(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { chatItems?: readonly ChatRecord[]; signal?: AbortSignal } = {}
  ): Promise<PageResult<ChatDTO>> {
    const request = toActivitiesPageRequest(query);
    return this.chatsService.queryActivitiesChatPage(this.resolveActiveUserId(), request, {
      chatItems: options.chatItems
    });
  }

  async loadActivityRates(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PageResult<ActivityRateDTO, { users: UserDto[] }>> {
    const request = toActivitiesPageRequest(query);
    const activeUserId = this.resolveActiveUserId();
    const page = await this.ratesService.queryActivitiesRatePage(activeUserId, request, options.signal);
    const users = this.resolveActivityUsers(page.users);
    this.cacheActivityUsers(users);
    return {
      items: page.items.map(item => ({ ...item })),
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      context: { users }
    };
  }

  async saveActivityEvent(
    payload: ContractTypes.ActivityEventSaveDTO,
    _options: {
      activeUserId?: string | null;
    } = {}
  ): Promise<ActivityEventDTO> {
    const eventDTO = await this.eventsService.saveActivityEvent(payload);
    if (!eventDTO) {
      throw new Error('Event sync did not return an event DTO.');
    }
    return eventDTO;
  }

  private resolveActiveUserId(): string {
    const activeUserProfileId = this.appCtx.activeUserProfile()?.id?.trim();
    if (activeUserProfileId) {
      return activeUserProfileId;
    }
    const activeUserId = this.appCtx.getActiveUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo' && session.userId.trim().length > 0) {
      return session.userId.trim();
    }
    if (session?.kind === 'firebase' && session.profile.id.trim().length > 0) {
      return session.profile.id.trim();
    }
    return this.usersService.peekCachedUsers()[0]?.id ?? '';
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
      topic: this.normalizeEventExploreTopic(input?.topic ?? ''),
      excludedSourceIds: this.normalizeEventExploreExcludedSourceIds(input?.excludedSourceIds)
    };
  }

  private normalizeEventExploreOrder(value: unknown): ContractTypes.EventExploreOrder {
    return value === 'past-events'
      || value === 'nearby'
      || value === 'most-relevant'
      || value === 'top-rated'
      ? value
      : 'upcoming';
  }

  private normalizeEventExploreView(value: unknown): ContractTypes.EventExploreView {
    return value === 'distance' ? 'distance' : 'day';
  }

  private normalizeEventExploreTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private normalizeEventExploreExcludedSourceIds(value: readonly string[] | null | undefined): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(value
      .map(sourceId => `${sourceId ?? ''}`.trim())
      .filter(sourceId => sourceId.length > 0))];
  }

  private resolveExplorePageSize(value: number): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private cloneExploreRecord(record: ActivityEventRecord): ActivityEventRecord {
    return {
      ...record,
      topics: [...record.topics]
    };
  }

  private cacheActivityUsers(users: readonly UserDto[] | null | undefined): void {
    for (const user of users ?? []) {
      if (!user?.id?.trim()) {
        continue;
      }
      this.appCtx.setUserProfile(user);
    }
  }

  private resolveActivityUsers(preferredUsers?: readonly UserDto[] | null): UserDto[] {
    if (preferredUsers && preferredUsers.length > 0) {
      return preferredUsers.map(user => ({ ...user, images: [...(user.images ?? [])] }));
    }
    return this.usersService.peekCachedUsers();
  }

  private paginateActivityEventDTOs(
    items: readonly ActivityEventDTO[],
    request: ActivitiesPageRequest
  ): PageResult<ActivityEventDTO> {
    if (this.isCalendarActivitiesView(request.view)) {
      const range = this.activitiesQueryRange(request);
      const filteredItems = range
        ? items.filter(item => this.doesActivityEventDTOOverlapRange(item, range.start, range.end))
        : [...items];
      return {
        items: filteredItems,
        total: filteredItems.length
      };
    }

    const startIndex = request.page * request.pageSize;
    return {
      items: items.slice(startIndex, startIndex + request.pageSize),
      total: items.length
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

  private doesActivityEventDTOOverlapRange(item: ActivityEventDTO, start: Date, end: Date): boolean {
    const range = this.resolveActivityEventDTORange(item);
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
  private resolveActivityEventDTORange(item: ActivityEventDTO): { start: Date; end: Date } | null {
    const start = new Date(item.startAtIso);
    const end = new Date(item.endAtIso || new Date(start.getTime() + (2 * 60 * 60 * 1000)).toISOString());
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return end.getTime() > start.getTime()
      ? { start, end }
      : { start, end: new Date(start.getTime() + (2 * 60 * 60 * 1000)) };
  }

  private isCalendarActivitiesView(view: ContractTypes.ActivitiesView): boolean {
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
