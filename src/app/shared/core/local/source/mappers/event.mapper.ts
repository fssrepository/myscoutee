import type { DtoListMapper, DtoMapper } from '../../../base/mappers/mapper.types';
import { PricingBuilder } from '../../../base/builders';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventDTO,
  ActivityEventDetailDTO,
  ActivityEventRecord,
  ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';
import type { SubEventDTO } from '../../../contracts/event.interface';
import type { LocationCoordinates } from '../../../contracts/user.interface';

export class LocalActivityEventsMapper {
  static toDto(record: ActivityEventRecord): ActivityEventDTO {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      status: record.status,
      adminIds: [...(record.adminIds ?? [])],
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      inviter: record.inviter ?? null,
      activity: record.activity,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorCity: record.creatorCity,
      visibility: record.visibility,
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      location: record.location,
      capacityTotal: record.capacityTotal,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      eventType: record.eventType,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record.pendingRequestMemberUserIds ?? [])],
      pendingReason: record.pendingReason,
      boost: record.boost
    };
  }

  static toDtoList(records: readonly ActivityEventRecord[]): ActivityEventDTO[] {
    return records.map(record => this.toDto(record));
  }

  static toDtoPage(page: ActivityEventActivitiesListQueryResult): ActivityEventPageResultDTO {
    return {
      items: page.records.map(item => ({ ...item })),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }
}

export class LocalActivityEventDetailsMapper {
  static toDto(record: ActivityEventRecord): ActivityEventDetailDTO {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      status: record.status,
      statusBeforeSuppression: 'statusBeforeSuppression' in record ? record.statusBeforeSuppression ?? null : undefined,
      adminIds: [...(record.adminIds ?? [])],
      avatar: record.avatar,
      title: record.title,
      subtitle: record.subtitle,
      timeframe: record.timeframe,
      inviter: record.inviter ?? null,
      unread: record.unread,
      activity: record.activity,
      trashedAtIso: 'trashedAtIso' in record ? record.trashedAtIso ?? null : undefined,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials,
      creatorGender: 'creatorGender' in record ? record.creatorGender : undefined,
      creatorCity: record.creatorCity,
      visibility: record.visibility,
      blindMode: record.blindMode ?? 'Open Event',
      startAtIso: record.startAtIso,
      endAtIso: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink ?? '',
      location: record.location,
      locationCoordinates: this.cloneLocationCoordinates(record.locationCoordinates),
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      capacityTotal: record.capacityTotal,
      autoInviter: record.autoInviter ?? false,
      frequency: record.frequency ?? 'One-time',
      ticketing: record.ticketing,
      pricing: record.pricing
        ? PricingBuilder.clonePricingConfig(record.pricing)
        : null,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotsEnabled: record.slotsEnabled === true,
      slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
      parentEventId: record.parentEventId ?? null,
      slotTemplateId: record.slotTemplateId ?? null,
      generated: record.generated === true,
      eventType: record.eventType ?? 'main',
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record.pendingRequestMemberUserIds ?? [])],
      pendingReason: record.pendingReason,
      topics: [...(record.topics ?? [])],
      subEvents: this.cloneSubEvents(record.subEvents ?? []),
      subEventsDisplayMode: record.subEventsDisplayMode ?? 'Casual',
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity,
      paymentSessionId: null
    };
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | null | undefined
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  private static cloneSubEvents(items: readonly SubEventDTO[]): SubEventDTO[] {
    return items.map(item => ({
      ...item,
      groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
    }));
  }
}

export const localActivityEventsMapper =
  LocalActivityEventsMapper satisfies DtoListMapper<ActivityEventRecord, ActivityEventDTO>;

export const localActivityEventDetailsMapper =
  LocalActivityEventDetailsMapper satisfies DtoMapper<ActivityEventRecord, ActivityEventDetailDTO>;
