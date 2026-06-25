import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { ActivityEventSeedItem } from '../entity';

export class ActivityEventSeedMapper {
  static fromActivityEventRecord(
    record: ActivityEventRecord,
    options: { avatar?: string } = {}
  ): ActivityEventSeedItem {
    return {
      id: record.id,
      avatar: options.avatar ?? record.avatar,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: (record.adminIds ?? []).includes(record.userId) || record.creatorUserId === record.userId,
      adminIds: [...(record.adminIds ?? [])],
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      acceptedMembers: record.acceptedMembers,
      pendingMembers: record.pendingMembers,
      capacityTotal: record.capacityTotal,
      pendingReason: record.pendingReason,
      visibility: record.visibility,
      blindMode: record.blindMode,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      locationCoordinates: record.locationCoordinates ? { ...record.locationCoordinates } : undefined,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      autoInviter: record.autoInviter,
      frequency: record.frequency,
      pricing: record.pricing,
      policiesEnabled: record.policiesEnabled,
      policies: record.policies ? [...record.policies] : undefined,
      slotsEnabled: record.slotsEnabled,
      slotTemplates: record.slotTemplates ? record.slotTemplates.map(slot => ({
        ...slot,
        subEventDefinitions: slot.subEventDefinitions ? slot.subEventDefinitions.map(item => ({
          ...item,
          groups: (item.groups ?? []).map(group => ({ ...group }))
        })) : undefined
      })) : undefined,
      parentEventId: record.parentEventId,
      slotTemplateId: record.slotTemplateId,
      generated: record.generated,
      eventType: record.eventType,
      nextSlot: record.nextSlot,
      upcomingSlots: record.upcomingSlots ? [...record.upcomingSlots] : undefined,
      topics: [...record.topics],
      subEventsEnabled: record.subEventsEnabled !== false,
      subEventDefinitions: record.subEventDefinitions ? record.subEventDefinitions.map(item => ({
        ...item,
        groups: (item.groups ?? []).map(group => ({ ...group }))
      })) : undefined,
      subEvents: record.subEvents ? [...record.subEvents] : undefined,
      mode: record.mode,
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity,
      ticketing: record.ticketing
    };
  }
}
