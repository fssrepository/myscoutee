import { Injectable, inject } from '@angular/core';

import type { ActivityMemberOwnerRef, ActivityMembersSummary } from '../../../core/base/models';
import type { DemoEventRecord } from '../models/events.model';
import { DemoActivityMembersService } from './activity-members.service';
import { DemoEventsService } from './events.service';

@Injectable({
  providedIn: 'root'
})
export class DemoEventEditorDataService {
  private readonly eventsService = inject(DemoEventsService);
  private readonly activityMembersService = inject(DemoActivityMembersService);

  peekKnownItemById(userId: string, itemId: string): DemoEventRecord | null {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const known = [
      ...this.eventsService.peekItemsByUser(userId),
      ...this.eventsService.peekExploreItems(userId)
    ];
    return known.find(record => record.id === normalizedItemId) ?? null;
  }

  async queryKnownItemById(userId: string, itemId: string): Promise<DemoEventRecord | null> {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const cached = this.peekKnownItemById(userId, normalizedItemId);
    if (cached) {
      return cached;
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
