import { Injectable, inject } from '@angular/core';

import type { EventExploreFeedFilters } from '../../../activities-models';
import type * as AppTypes from '../../../app-types';
import { AppUtils } from '../../../app-utils';
import type { ListQuery, PageResult } from '../../../ui';
import { AppContext } from '../context';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { EventsService } from './events.service';

@Injectable({
  providedIn: 'root'
})
export class EventExploreService {
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);

  async loadPage(
    query: ListQuery<EventExploreFeedFilters>
  ): Promise<PageResult<DemoEventRecord>> {
    const filters = this.resolveFilters(query.filters);
    const result = await this.eventsService.queryEventExplorePage({
      ...filters,
      limit: this.resolvePageSize(query.pageSize),
      cursor: query.cursor ?? null
    });
    return {
      items: result.records.map(record => this.cloneRecord(record)),
      total: result.total,
      nextCursor: result.nextCursor
    };
  }

  peekPage(filters: EventExploreFeedFilters): DemoEventRecord[] {
    const normalizedFilters = this.resolveFilters(filters);
    const result = this.eventsService.peekEventExplorePage({
      ...normalizedFilters,
      limit: 10,
      cursor: null
    });
    return result.records.map(record => this.cloneRecord(record));
  }

  private resolveFilters(
    input: Partial<EventExploreFeedFilters> | null | undefined
  ): EventExploreFeedFilters {
    return {
      userId: input?.userId?.trim() || this.appCtx.getActiveUserId().trim() || 'u1',
      order: this.normalizeOrder(input?.order),
      view: this.normalizeView(input?.view),
      friendsOnly: input?.friendsOnly === true,
      openSpotsOnly: input?.openSpotsOnly === true,
      topic: this.normalizeTopic(input?.topic ?? '')
    };
  }

  private normalizeOrder(value: unknown): AppTypes.EventExploreOrder {
    return value === 'past-events'
      || value === 'nearby'
      || value === 'most-relevant'
      || value === 'top-rated'
      ? value
      : 'upcoming';
  }

  private normalizeView(value: unknown): AppTypes.EventExploreView {
    return value === 'distance' ? 'distance' : 'day';
  }

  private normalizeTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private resolvePageSize(value: number): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics]
    };
  }
}
