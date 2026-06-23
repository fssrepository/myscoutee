import { EventEditorBuilder, PricingBuilder } from '../../core/base/builders';
import { EventEditorFormNormalizer } from '../../core/base/normalizers';
import type * as ContractTypes from '../../core/contracts';
import type { EventForm } from '../models';
import type { UiConverter } from './converter.types';

export interface ActivityEventSaveConverterInput {
  form: EventForm;
  memberSummary: {
    acceptedMembers: number;
    pendingMembers: number;
    capacityTotal: number;
  };
  activeUserId: string | null;
  activeUserProfile: {
    name?: string;
    initials?: string;
    gender?: 'woman' | 'man';
    city?: string;
  } | null;
}

export class ActivityEventSaveConverter {
  static convert(input: ActivityEventSaveConverterInput): ContractTypes.ActivityEventSaveDTO {
    const persistedSlotTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(input.form.slotTemplates);
    const hasSlots = EventEditorFormNormalizer.normalizeEventEditorFrequency(input.form.frequency) !== 'One-time';

    return {
      id: input.form.id,
      title: input.form.title.trim(),
      shortDescription: input.form.description.trim(),
      timeframe: EventEditorBuilder.buildEventEditorTimeframeLabel(
        input.form.startAt,
        input.form.endAt,
        input.form.frequency
      ),
      activity: input.form.activity ?? 0,
      startAt: input.form.startAt,
      endAt: input.form.endAt,
      distanceKm: input.form.distanceKm ?? 0,
      imageUrl: input.form.imageUrl,
      acceptedMembers: input.memberSummary.acceptedMembers,
      pendingMembers: input.memberSummary.pendingMembers,
      capacityTotal: Math.max(input.memberSummary.acceptedMembers, input.memberSummary.capacityTotal),
      capacityMin: input.form.capacityMin,
      capacityMax: input.form.capacityMax,
      autoInviter: input.form.autoInviter,
      frequency: input.form.frequency,
      ticketing: input.form.ticketing,
      pricing: PricingBuilder.compactPricingConfig(
        PricingBuilder.syncSlotOverrides(
          input.form.pricing,
          PricingBuilder.slotCatalogFromEventSlotTemplates(persistedSlotTemplates)
        ),
        {
          context: 'event',
          slotCatalog: PricingBuilder.slotCatalogFromEventSlotTemplates(persistedSlotTemplates),
          allowSlotFeatures: true
        }
      ),
      policies: EventEditorBuilder.buildPersistedEventEditorPolicies(input.form.policies),
      slotsEnabled: hasSlots,
      slotTemplates: hasSlots ? persistedSlotTemplates : [],
      visibility: input.form.visibility,
      blindMode: input.form.blindMode,
      status: input.form.status ?? 'DR',
      creatorUserId: input.form.creatorUserId ?? input.activeUserId ?? undefined,
      creatorName: input.form.creatorName ?? input.activeUserProfile?.name,
      creatorInitials: input.form.creatorInitials ?? input.activeUserProfile?.initials,
      creatorGender: input.form.creatorGender ?? input.activeUserProfile?.gender,
      creatorCity: input.form.creatorCity ?? input.activeUserProfile?.city,
      location: input.form.location.trim(),
      locationCoordinates: input.form.locationCoordinates ?? undefined,
      sourceLink: input.form.sourceLink ?? '',
      parentEventId: input.form.parentEventId ?? null,
      slotTemplateId: input.form.slotTemplateId ?? null,
      generated: input.form.generated ?? false,
      eventType: input.form.eventType ?? 'main',
      topics: [...input.form.topics],
      subEvents: EventEditorBuilder.buildPersistedEventEditorSubEvents(input.form.subEvents),
      subEventsDisplayMode: input.form.subEventsDisplayMode ?? 'Casual'
    };
  }
}

export const activityEventSaveConverter =
  ActivityEventSaveConverter satisfies UiConverter<
    ActivityEventSaveConverterInput,
    ContractTypes.ActivityEventSaveDTO
  >;
