import { PricingBuilder } from '../../core/base/builders';
import type { ActivityEventDTO } from '../../core/contracts/activity.interface';
import type { SubEventFormItem } from '../../core/contracts/event.interface';
import type { EventForm, EventFormSubEventItem } from '../models';

export class ActivityEventEditorFormConverter {
  static convert(dto: ActivityEventDTO): EventForm {
    const subEvents = this.cloneSubEvents(dto.subEvents ?? []);

    return {
      id: dto.id,
      title: dto.title,
      description: dto.subtitle,
      imageUrl: dto.imageUrl,
      activity: dto.activity,
      isAdmin: (dto.adminIds ?? []).includes(dto.userId),
      distanceKm: dto.distanceKm,
      status: dto.status ?? 'A',
      creatorUserId: dto.creatorUserId,
      creatorName: dto.creatorName,
      creatorInitials: dto.creatorInitials,
      creatorGender: dto.creatorGender,
      creatorCity: dto.creatorCity,
      locationCoordinates: dto.locationCoordinates ?? null,
      sourceLink: dto.sourceLink ?? '',
      parentEventId: dto.parentEventId ?? null,
      slotTemplateId: dto.slotTemplateId ?? null,
      generated: dto.generated ?? false,
      eventType: dto.eventType ?? 'main',
      visibility: dto.visibility,
      frequency: dto.frequency ?? 'One-time',
      location: dto.location,
      capacityMin: dto.capacityMin,
      capacityMax: dto.capacityMax,
      blindMode: dto.blindMode ?? 'Open Event',
      autoInviter: dto.autoInviter === true,
      ticketing: dto.ticketing,
      pricing: dto.pricing ? PricingBuilder.clonePricingConfig(dto.pricing) : PricingBuilder.createDefaultPricingConfig('event'),
      policies: (dto.policies ?? []).map(policy => ({ ...policy })),
      slotsEnabled: dto.slotsEnabled === true,
      slotTemplates: (dto.slotTemplates ?? []).map(template => ({ ...template })),
      topics: [...dto.topics],
      subEvents,
      subEventsDisplayMode: dto.subEventsDisplayMode ?? 'Casual',
      startAt: dto.startAtIso,
      endAt: dto.endAtIso
    };
  }

  private static cloneSubEvents(items: readonly SubEventFormItem[]): EventFormSubEventItem[] {
    return items.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group })),
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
    }));
  }
}
