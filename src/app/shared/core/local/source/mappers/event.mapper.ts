import type { DtoListMapper, DtoMapper } from '../../../base/mappers/mapper.types';
import { AppUtils } from '../../../../app-utils';
import { ActivityEventRecordBuilder, PricingBuilder } from '../../../base/builders';
import {
  ActivityEventDetailDTO,
  type ActivityEventActivitiesListQueryResult,
  type ActivityEventDTO,
  type ActivityEventRecord,
  type ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';
import type * as AppConstants from '../../../common/constants';
import type * as EventContracts from '../../../contracts/event.interface';
import type * as PricingContracts from '../../../contracts/pricing.interface';
import type { LocationCoordinates, UserDto } from '../../../contracts/user.interface';

interface LocalActivityEventToRecordContext {
  existing?: ActivityEventRecord | null;
  userId: string;
  creatorName: string;
  creatorInitials: string;
  startAtIso: string;
  endAtIso: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  acceptedMemberUserIds: readonly string[];
  pendingMemberUserIds: readonly string[];
  invitedMemberUserIds: readonly string[];
  pendingRequestMemberUserIds: readonly string[];
  creator?: Partial<UserDto> | null;
  acceptedUsers?: ReadonlyArray<Partial<UserDto> | null | undefined>;
}

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
  static toRecord(payload: ActivityEventDetailDTO, context: LocalActivityEventToRecordContext): ActivityEventRecord {
    const existing = context.existing ?? null;
    const id = payload.id.trim();
    const title = payload.title.trim() || existing?.title.trim() || 'Untitled draft event';
    const subtitle = payload.subtitle.trim() || existing?.subtitle.trim() || 'Draft event in progress';
    const type = this.normalizeRepositoryItemType(payload.type ?? existing?.type);
    const visibility = this.normalizeVisibility(payload.visibility ?? existing?.visibility);
    const blindMode = this.normalizeBlindMode(payload.blindMode ?? existing?.blindMode);
    const frequency = this.normalizeFrequency(payload.frequency ?? existing?.frequency);
    const hasSlots = payload.slotsEnabled ?? existing?.slotsEnabled ?? false;
    const topics = this.normalizeTopics(payload.topics ?? existing?.topics ?? []);
    const slotTemplates = hasSlots ? this.normalizeSlotTemplates(payload.slotTemplates ?? existing?.slotTemplates ?? []) : [];
    const subEventsEnabled = payload.subEventsEnabled ?? existing?.subEventsEnabled ?? true;
    const subEventDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(payload.subEventDefinitions ?? existing?.subEventDefinitions ?? []);
    const subEvents = this.normalizeSubEvents(payload.subEvents ?? existing?.subEvents ?? []);
    const policies = this.normalizePolicies(payload.policies ?? existing?.policies ?? []);
    const slotCatalog = PricingBuilder.slotCatalogFromEventSlotTemplates(slotTemplates);
    const ticketing = payload.ticketing ?? existing?.ticketing ?? false;
    const pricing = PricingBuilder.syncSlotOverrides(
      PricingBuilder.normalizePricingConfig(payload.pricing ?? existing?.pricing, {
        context: 'event',
        slotCatalog
      }),
      slotCatalog
    );
    const rating = existing?.rating ?? (6 + ((AppUtils.hashText(`${id}:${title}`) % 35) / 10));
    const boost = existing?.boost ?? (50 + (AppUtils.hashText(`${id}:${title}`) % 51));
    const affinity = ActivityEventRecordBuilder.resolveEventAffinity({
      id,
      title,
      subtitle,
      topics,
      visibility,
      blindMode,
      creator: context.creator,
      acceptedUsers: context.acceptedUsers,
      rating,
      acceptedMembers: context.acceptedMembers,
      capacityTotal: context.capacityTotal
    });

    return {
      id,
      userId: context.userId,
      type,
      status: this.normalizeEventStatus(payload.status ?? existing?.status),
      avatar: context.creatorInitials,
      title,
      subtitle,
      timeframe: payload.timeframe.trim() || existing?.timeframe.trim() || this.buildTimeframeLabel(context.startAtIso, context.endAtIso, frequency),
      inviter: null,
      unread: 0,
      activity: this.nonNegativeInteger(payload.activity),
      trashedAtIso: existing?.trashedAtIso ?? null,
      creatorUserId: context.userId,
      creatorName: context.creatorName,
      creatorInitials: context.creatorInitials,
      creatorGender: payload.creatorGender ?? existing?.creatorGender ?? 'man',
      creatorCity: payload.creatorCity ?? existing?.creatorCity ?? '',
      visibility,
      blindMode,
      startAtIso: context.startAtIso,
      endAtIso: context.endAtIso,
      distanceKm: Math.max(0, Number(payload.distanceKm) || 0),
      imageUrl: payload.imageUrl?.trim() || existing?.imageUrl || `https://picsum.photos/seed/event-explore-${id}/1200/700`,
      sourceLink: payload.sourceLink?.trim() || existing?.sourceLink || '',
      location: this.normalizeLocation(payload.location) || existing?.location || '',
      locationCoordinates: this.normalizeLocationCoordinates(payload.locationCoordinates)
        ?? this.normalizeLocationCoordinates(existing?.locationCoordinates),
      capacityMin: this.normalizeCount(payload.capacityMin) ?? existing?.capacityMin ?? 0,
      capacityMax: this.normalizeCount(payload.capacityMax) ?? existing?.capacityMax ?? context.capacityTotal,
      capacityTotal: context.capacityTotal,
      autoInviter: typeof payload.autoInviter === 'boolean'
        ? payload.autoInviter
        : (typeof existing?.autoInviter === 'boolean' ? existing.autoInviter : false),
      frequency,
      ticketing,
      pricing,
      policies,
      slotsEnabled: hasSlots,
      slotTemplates,
      parentEventId: payload.parentEventId ?? existing?.parentEventId ?? null,
      slotTemplateId: payload.slotTemplateId ?? existing?.slotTemplateId ?? null,
      generated: payload.generated ?? existing?.generated ?? false,
      eventType: payload.eventType ?? existing?.eventType ?? 'main',
      nextSlot: payload.nextSlot ? { ...payload.nextSlot } : (existing?.nextSlot ? { ...existing.nextSlot } : null),
      upcomingSlots: (payload.upcomingSlots ?? existing?.upcomingSlots ?? []).map(item => ({ ...item })),
      acceptedMembers: context.acceptedMembers,
      pendingMembers: context.pendingMembers,
      acceptedMemberUserIds: [...context.acceptedMemberUserIds],
      pendingMemberUserIds: [...context.pendingMemberUserIds],
      invitedMemberUserIds: [...context.invitedMemberUserIds],
      pendingRequestMemberUserIds: [...context.pendingRequestMemberUserIds],
      topics,
      subEventsEnabled,
      subEventDefinitions,
      subEvents,
      mode: ActivityEventRecordBuilder.normalizeEventMode(
        payload.mode
          ?? existing?.mode
          ?? ActivityEventRecordBuilder.inferredEventMode(subEvents)
      ),
      rating,
      boost,
      affinity
    };
  }

  static toDto(record: ActivityEventRecord): ActivityEventDetailDTO {
    return new ActivityEventDetailDTO().apply({
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
      pricing: record.pricing ?? null,
      policies: record.policies ?? [],
      slotsEnabled: record.slotsEnabled === true,
      slotTemplates: record.slotTemplates ?? [],
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
      subEventsEnabled: record.subEventsEnabled !== false,
      subEventDefinitions: record.subEventDefinitions ?? [],
      subEvents: record.subEvents ?? [],
      mode: ActivityEventRecordBuilder.normalizeEventMode(record.mode),
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity,
      paymentSessionId: null
    });
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

  private static normalizeEventStatus(status: string | null | undefined): ActivityEventRecord['status'] {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'A':
      case 'DR':
      case 'T':
      case 'UR':
      case 'B':
      case 'D':
      case 'I':
        return normalized;
      default:
        return 'A';
    }
  }

  private static normalizeTopics(topics: readonly string[]): string[] {
    return Array.from(new Set(topics
      .map(topic => `${topic ?? ''}`.trim().replace(/^#+/, ''))
      .filter(topic => topic.length > 0)
      .slice(0, 5)));
  }

  private static normalizeRepositoryItemType(value: unknown): ActivityEventRecord['type'] {
    return value === 'hosting' || value === 'invitations' ? value : 'events';
  }

  private static normalizeVisibility(value: unknown): AppConstants.EventVisibility {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'private' || normalized.includes('friend')) {
      return 'Friends only';
    }
    if (normalized.includes('invitation')) {
      return 'Invitation only';
    }
    return 'Public';
  }

  private static normalizeBlindMode(value: unknown): EventContracts.EventBlindMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('blind') ? 'Blind Event' : 'Open Event';
  }

  private static normalizeFrequency(value: unknown): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'custom') {
      return 'Custom';
    }
    if (normalized === 'daily') {
      return 'Daily';
    }
    if (normalized === 'weekly') {
      return 'Weekly';
    }
    if (normalized.includes('bi-week') || normalized.includes('bi week')) {
      return 'Bi-weekly';
    }
    if (normalized === 'monthly') {
      return 'Monthly';
    }
    if (normalized === 'yearly' || normalized === 'annual' || normalized === 'annually') {
      return 'Yearly';
    }
    return 'One-time';
  }

  private static buildTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = this.parseDate(startAt);
    const end = this.parseDate(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = this.normalizeFrequency(frequency);
    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }
    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
  }

  private static normalizePolicies(items: readonly EventContracts.EventPolicyDTO[]): EventContracts.EventPolicyDTO[] {
    return items.map((item, index) => ({
      id: `${item.id ?? `policy-${index + 1}`}`.trim() || `policy-${index + 1}`,
      title: `${item.title ?? ''}`.trim() || `Policy ${index + 1}`,
      description: `${item.description ?? ''}`.trim(),
      required: item.required !== false
    })).filter(item => item.id || item.title || item.description);
  }

  private static normalizeSlotTemplates(items: readonly EventContracts.EventSlotTemplateDTO[]): EventContracts.EventSlotTemplateDTO[] {
    return items.map((item, index) => {
      if (item.closed === true) {
        return {
          id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
          startAt: '',
          overrideDate: this.normalizeSlotOverrideDate(item.overrideDate),
          closed: true
        };
      }
      const normalizedStart = `${item.startAt ?? ''}`.trim();
      const parsedStart = this.parseDate(normalizedStart) ?? new Date();
      return {
        id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
        startAt: this.parseDate(normalizedStart) ? normalizedStart : this.toIsoDateTimeLocal(parsedStart),
        overrideDate: this.normalizeSlotOverrideDate(item.overrideDate),
        closed: false
      };
    });
  }

  private static normalizeSubEvents(items: readonly EventContracts.SubEventDTO[]): EventContracts.SubEventDTO[] {
    return items.map((item, index) => {
      const capacityMin = this.nonNegativeInteger(item.capacityMin);
      const capacityMax = Math.max(capacityMin, this.nonNegativeInteger(item.capacityMax));
      return {
        id: `${item.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: `${item.startAt ?? ''}`.trim(),
        endAt: `${item.endAt ?? ''}`.trim(),
        location: this.normalizeLocation(item.location),
        createdByUserId: item.createdByUserId?.trim() || undefined,
        optional: item.optional === true,
        pricing: this.clonePricingConfig(item.pricing),
        capacityMin,
        capacityMax,
        groups: this.cloneSubEventGroups(item.groups, index),
        tournamentGroupCount: this.optionalNonNegativeInteger(item.tournamentGroupCount),
        tournamentGroupCapacityMin: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
        tournamentGroupCapacityMax: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
        tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
        membersAccepted: this.nonNegativeInteger(item.membersAccepted),
        membersPending: this.nonNegativeInteger(item.membersPending),
        carsPending: this.nonNegativeInteger(item.carsPending),
        accommodationPending: this.nonNegativeInteger(item.accommodationPending),
        suppliesPending: this.nonNegativeInteger(item.suppliesPending),
        carsAccepted: this.optionalNonNegativeInteger(item.carsAccepted),
        accommodationAccepted: this.optionalNonNegativeInteger(item.accommodationAccepted),
        suppliesAccepted: this.optionalNonNegativeInteger(item.suppliesAccepted),
        carsCapacityMin: this.optionalNonNegativeInteger(item.carsCapacityMin),
        carsCapacityMax: this.optionalNonNegativeInteger(item.carsCapacityMax),
        accommodationCapacityMin: this.optionalNonNegativeInteger(item.accommodationCapacityMin),
        accommodationCapacityMax: this.optionalNonNegativeInteger(item.accommodationCapacityMax),
        suppliesCapacityMin: this.optionalNonNegativeInteger(item.suppliesCapacityMin),
        suppliesCapacityMax: this.optionalNonNegativeInteger(item.suppliesCapacityMax),
        slotStartOffsetMinutes: this.optionalNonNegativeInteger(item.slotStartOffsetMinutes),
        slotDurationMinutes: this.optionalNonNegativeInteger(item.slotDurationMinutes),
        stageStatus: `${item.stageStatus ?? ''}`.trim() || undefined,
        stageStatusReason: `${item.stageStatusReason ?? ''}`.trim() || undefined,
        stageStatusUpdatedAt: `${item.stageStatusUpdatedAt ?? ''}`.trim() || undefined,
        stageFinalizedAt: `${item.stageFinalizedAt ?? ''}`.trim() || undefined,
        stageFinalizedByUserId: `${item.stageFinalizedByUserId ?? ''}`.trim() || undefined
      };
    });
  }

  private static cloneSubEventGroups(
    groups: readonly EventContracts.SubEventGroupDTO[] | undefined,
    subEventIndex = 0
  ): EventContracts.SubEventGroupDTO[] {
    return (groups ?? []).map((group, groupIndex) => ({
      id: `${group.id ?? `group-${subEventIndex + 1}-${groupIndex + 1}`}`.trim() || `group-${subEventIndex + 1}-${groupIndex + 1}`,
      name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
      source: group.source === 'manual' ? 'manual' : 'generated',
      capacityMin: this.optionalNonNegativeInteger(group.capacityMin),
      capacityMax: this.optionalNonNegativeInteger(group.capacityMax)
    }));
  }

  private static clonePricingConfig(value: PricingContracts.PricingConfig | null | undefined): PricingContracts.PricingConfig | null {
    if (!value) {
      return null;
    }
    return {
      ...value,
      demandRules: (value.demandRules ?? []).map(rule => ({ ...rule, action: { ...rule.action }, slotIds: [...(rule.slotIds ?? [])] })),
      timeRules: (value.timeRules ?? []).map(rule => ({ ...rule, action: { ...rule.action }, slotIds: [...(rule.slotIds ?? [])] })),
      cancellationPolicy: {
        ...value.cancellationPolicy,
        rules: (value.cancellationPolicy?.rules ?? []).map(rule => ({ ...rule }))
      },
      slotOverrides: (value.slotOverrides ?? []).map(slot => ({ ...slot })),
      audience: {
        ...value.audience,
        promoCodes: (value.audience?.promoCodes ?? []).map(code => ({ ...code, action: { ...code.action } }))
      }
    };
  }

  private static normalizeLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private static normalizeSlotOverrideDate(value: unknown): string | null {
    const parsed = this.parseDateOnly(value);
    return parsed ? this.toIsoDate(parsed) : null;
  }

  private static normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static nonNegativeInteger(value: unknown): number {
    return this.normalizeCount(value) ?? 0;
  }

  private static optionalNonNegativeInteger(value: unknown): number | undefined {
    return this.normalizeCount(value) ?? undefined;
  }

  private static normalizeLocationCoordinates(value: unknown): ActivityEventRecord['locationCoordinates'] {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const latitude = Number((value as { latitude?: unknown }).latitude);
    const longitude = Number((value as { longitude?: unknown }).longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return {
      latitude,
      longitude
    };
  }

  private static parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static parseDateOnly(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const dateOnlyMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private static toIsoDateTimeLocal(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private static toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}

export const localActivityEventsMapper =
  LocalActivityEventsMapper satisfies DtoListMapper<ActivityEventRecord, ActivityEventDTO>;

export const localActivityEventDetailsMapper =
  LocalActivityEventDetailsMapper satisfies DtoMapper<ActivityEventRecord, ActivityEventDetailDTO>;
