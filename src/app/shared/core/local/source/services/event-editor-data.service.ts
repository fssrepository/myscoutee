import { Injectable, inject } from '@angular/core';

import type { ActivityEventDTO, ActivityEventRecord } from '../../../contracts/activity.interface';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsService } from './events.service';
import { LocalActivityEventsMapper } from '../mappers';
import type { ActivityMemberOwnerRef, ActivityMembersSummary } from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalEventEditorDataService {
  private readonly eventsService = inject(LocalEventsService);
  private readonly activityMembersService = inject(LocalActivityMembersService);

  peekKnownItemById(userId: string, itemId: string): ActivityEventRecord | null {
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

  async queryKnownItemById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
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

  async loadFullItemById(userId: string, itemId: string): Promise<ActivityEventDTO | null> {
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      return null;
    }
    const [owned, explore] = await Promise.all([
      this.eventsService.queryItemsByUser(userId),
      this.eventsService.queryExploreItems(userId)
    ]);
    const record = [...owned, ...explore].find(item => item.id === normalizedItemId) ?? null;
    return record ? LocalActivityEventsMapper.toDto(record) : null;
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
