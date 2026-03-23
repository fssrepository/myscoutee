import { Injectable, inject } from '@angular/core';

import type { ActivityMemberOwnerRef, ActivityMembersSummary } from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { HttpActivityMembersService } from './activity-members.service';
import { HttpEventsService } from './events.service';

@Injectable({
  providedIn: 'root'
})
export class HttpEventEditorDataService {
  private readonly eventsService = inject(HttpEventsService);
  private readonly activityMembersService = inject(HttpActivityMembersService);

  peekKnownItemById(_userId: string, _itemId: string): DemoEventRecord | null {
    return null;
  }

  async queryKnownItemById(userId: string, itemId: string): Promise<DemoEventRecord | null> {
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
