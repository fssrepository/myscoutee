import { PricingBuilder } from '../../../base/builders';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventCardRecord,
  ActivityEventDTO,
  ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';
import type { SubEventFormItem } from '../../../contracts/event.interface';

export class LocalActivityEventsMapper {
  static toDTO(record: ActivityEventCardRecord): ActivityEventDTO {
    const type = this.resolveDTOType(record);
    return {
      id: record.id,
      userId: record.userId,
      type,
      status: record.status,
      statusBeforeSuppression: 'statusBeforeSuppression' in record ? record.statusBeforeSuppression ?? null : undefined,
      avatar: record.avatar,
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      inviter: record.inviter ?? null,
      unread: record.unread,
      activity: record.activity,
      isAdmin: record.isAdmin,
      isInvitation: record.isInvitation,
      isHosting: record.isHosting,
      isTrashed: record.isTrashed,
      published: record.published,
      trashedAtIso: 'trashedAtIso' in record ? record.trashedAtIso ?? null : undefined,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorGender: 'creatorGender' in record ? record.creatorGender : undefined,
      creatorCity: record.creatorCity,
      visibility: record.visibility,
      blindMode: 'blindMode' in record ? record.blindMode : undefined,
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      sourceLink: 'sourceLink' in record ? record.sourceLink : undefined,
      location: record.location,
      locationCoordinates: 'locationCoordinates' in record ? this.cloneLocationCoordinates(record.locationCoordinates) : undefined,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      capacityTotal: record.capacityTotal,
      autoInviter: 'autoInviter' in record ? record.autoInviter : undefined,
      frequency: 'frequency' in record ? record.frequency : undefined,
      ticketing: record.ticketing,
      pricing: 'pricing' in record && record.pricing
        ? PricingBuilder.clonePricingConfig(record.pricing)
        : ('pricing' in record ? null : undefined),
      policies: 'policies' in record ? (record.policies ?? []).map(item => ({ ...item })) : undefined,
      slotsEnabled: 'slotsEnabled' in record ? record.slotsEnabled : undefined,
      slotTemplates: 'slotTemplates' in record ? (record.slotTemplates ?? []).map(item => ({ ...item })) : undefined,
      parentEventId: 'parentEventId' in record ? record.parentEventId ?? null : undefined,
      slotTemplateId: 'slotTemplateId' in record ? record.slotTemplateId ?? null : undefined,
      generated: 'generated' in record ? record.generated : undefined,
      eventType: record.eventType,
      nextSlot: 'nextSlot' in record && record.nextSlot ? { ...record.nextSlot } : ('nextSlot' in record ? null : undefined),
      upcomingSlots: 'upcomingSlots' in record ? (record.upcomingSlots ?? []).map(item => ({ ...item })) : undefined,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      pendingReason: record.pendingReason,
      topics: [...(record.topics ?? [])],
      subEvents: 'subEvents' in record ? this.cloneSubEvents(record.subEvents ?? []) : undefined,
      subEventsDisplayMode: 'subEventsDisplayMode' in record ? record.subEventsDisplayMode : undefined,
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity
    };
  }

  static toDTOList(records: readonly ActivityEventCardRecord[]): ActivityEventDTO[] {
    return records.map(record => this.toDTO(record));
  }

  static toDTOPage(page: ActivityEventActivitiesListQueryResult): ActivityEventPageResultDTO {
    return {
      items: this.toDTOList(page.records),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

  private static resolveDTOType(record: ActivityEventCardRecord): ActivityEventDTO['type'] {
    if (record.isInvitation || record.type === 'invitations') {
      return 'invitations';
    }
    if (record.isHosting || record.type === 'hosting') {
      return 'hosting';
    }
    return 'events';
  }

  private static cloneLocationCoordinates(
    value: ActivityEventDTO['locationCoordinates']
  ): ActivityEventDTO['locationCoordinates'] {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  private static cloneSubEvents(items: readonly SubEventFormItem[]): SubEventFormItem[] {
    return items.map(item => ({
      ...item,
      groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
    }));
  }
}
