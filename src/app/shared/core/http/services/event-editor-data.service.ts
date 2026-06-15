import { Injectable, inject } from '@angular/core';

import type { ActivityEventDTO, ActivityEventRecord } from '../../contracts/activity.interface';
import { HttpActivityMembersService } from './activity-members.service';
import { HttpEventsService } from './events.service';
import type { ActivityMemberOwnerRef, ActivityMembersSummary } from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpEventEditorDataService {
  private readonly eventsService = inject(HttpEventsService);
  private readonly activityMembersService = inject(HttpActivityMembersService);

  peekKnownItemById(_userId: string, _itemId: string): ActivityEventRecord | null {
    return null;
  }

  async queryKnownItemById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const [owned, explore] = await Promise.all([
      this.eventsService.queryItemsByUser(userId),
      this.eventsService.queryExploreItems(userId)
    ]);
    return [...owned, ...explore].find(record => record.id === normalizedItemId) ?? null;
  }

  async loadFullItemById(userId: string, itemId: string): Promise<ActivityEventDTO | null> {
    const normalizedItemId = itemId.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !normalizedItemId) {
      return null;
    }
    const pages = await Promise.all([
      this.eventsService.queryActivitiesEventDTOPage({
        userId: normalizedUserId,
        filter: 'all',
        hostingPublicationFilter: 'all',
        secondaryFilter: 'recent',
        sort: 'date',
        view: 'day',
        limit: 200,
        cursor: null
      }),
      this.eventsService.queryActivitiesEventDTOPage({
        userId: normalizedUserId,
        filter: 'drafts',
        hostingPublicationFilter: 'drafts',
        secondaryFilter: 'recent',
        sort: 'date',
        view: 'day',
        limit: 200,
        cursor: null
      })
    ]);
    return pages.flatMap(page => page.items).find(item => item.id === normalizedItemId) ?? null;
  }

  async querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummary | null> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    const owner = this.ownerRef(normalizedOwnerId);
    const cached = this.activityMembersService.peekSummaryByOwner(owner);
    if (cached) {
      return cached;
    }
    await this.activityMembersService.queryMembersByOwner(owner);
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  private ownerRef(ownerId: string): ActivityMemberOwnerRef {
    return {
      ownerType: 'event',
      ownerId
    };
  }
}
