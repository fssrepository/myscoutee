import { Injectable, inject } from '@angular/core';

import type { ActivityEventDetailDTO, ActivityEventRecord } from '../../contracts/activity.interface';
import { PricingBuilder } from '../../base/builders';
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

  async loadFullItemById(userId: string, itemId: string): Promise<ActivityEventDetailDTO | null> {
    const normalizedItemId = itemId.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !normalizedItemId) {
      return null;
    }
    const record = await this.queryKnownItemById(normalizedUserId, normalizedItemId);
    return record ? this.toDetailDTO(record) : null;
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

  private toDetailDTO(record: ActivityEventRecord): ActivityEventDetailDTO {
    return {
      ...record,
      adminIds: [...(record.adminIds ?? [])],
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record.pendingRequestMemberUserIds ?? [])],
      topics: [...(record.topics ?? [])],
      blindMode: record.blindMode ?? 'Open Event',
      sourceLink: record.sourceLink ?? '',
      locationCoordinates: record.locationCoordinates ? { ...record.locationCoordinates } : null,
      autoInviter: record.autoInviter ?? false,
      frequency: record.frequency ?? 'One-time',
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : null,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotsEnabled: record.slotsEnabled === true,
      slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
      parentEventId: record.parentEventId ?? null,
      slotTemplateId: record.slotTemplateId ?? null,
      generated: record.generated === true,
      eventType: record.eventType ?? 'main',
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      subEvents: (record.subEvents ?? []).map(item => ({
        ...item,
        groups: (item.groups ?? []).map(group => ({ ...group })),
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
      })),
      subEventsDisplayMode: record.subEventsDisplayMode ?? 'Casual',
      paymentSessionId: null
    };
  }
}
