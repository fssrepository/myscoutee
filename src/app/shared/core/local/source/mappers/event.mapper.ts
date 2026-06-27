import type { DtoListMapper, DtoMapper } from '../../../base/mappers/mapper.types';
import { AppUtils } from '../../../../app-utils';
import { PricingBuilder } from '../../../base/builders';
import {
  ActivityEventDetailDTO,
  type ActivityEventDTO,
  type ActivityEventRecord,
  type ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';
import type * as AppConstants from '../../../common/constants';
import type * as EventContracts from '../../../contracts/event.interface';
import type * as PricingContracts from '../../../contracts/pricing.interface';
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

  static toDtoPage(page: {
    records: readonly ActivityEventRecord[];
    total: number;
    nextCursor?: string | null;
  }): ActivityEventPageResultDTO {
    return {
      items: page.records.map(record => this.toDto(record)),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }
}

export class LocalActivityEventDetailsMapper {
  static toRecord(payload: ActivityEventDetailDTO): ActivityEventRecord {
    const id = payload.id.trim();
    const creatorUserId = payload.creatorUserId.trim() || payload.userId.trim();
    const creatorName = payload.creatorName.trim() || 'Unknown Host';
    const creatorInitials = payload.creatorInitials.trim() || AppUtils.initialsFromText(creatorName);
    const startAtIso = payload.startAtIso.trim() || new Date().toISOString();
    const endAtIso = payload.endAtIso.trim()
      || new Date(new Date(startAtIso).getTime() + (2 * 60 * 60 * 1000)).toISOString();
    const title = payload.title.trim() || 'Untitled draft event';
    const subtitle = payload.subtitle.trim() || 'Draft event in progress';
    const type = this.normalizeRepositoryItemType(payload.type);
    const visibility = this.normalizeVisibility(payload.visibility);
    const blindMode = this.normalizeBlindMode(payload.blindMode);
    const frequency = this.normalizeFrequency(payload.frequency);
    const hasSlots = payload.slotsEnabled === true;
    const topics = this.normalizeTopics(payload.topics);
    const slotTemplates = hasSlots ? this.normalizeSlotTemplates(payload.slotTemplates) : [];
    const subEventsEnabled = payload.subEventsEnabled !== false;
    const subEventDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(payload.subEventDefinitions);
    const subEvents = this.normalizeSubEvents(payload.subEvents);
    const policiesEnabled = payload.policiesEnabled === true;
    const policies = this.normalizePolicies(payload.policies);
    const slotCatalog = PricingBuilder.slotCatalogFromEventSlotTemplates(slotTemplates);
    const ticketing = payload.ticketing === true;
    const pricing = PricingBuilder.syncSlotOverrides(
      PricingBuilder.normalizePricingConfig(payload.pricing, {
        context: 'event',
        slotCatalog
      }),
      slotCatalog
    );
    const acceptedMembers = this.nonNegativeInteger(payload.acceptedMembers);
    const pendingMembers = this.nonNegativeInteger(payload.pendingMembers);
    const capacityTotal = Math.max(
      acceptedMembers,
      this.normalizeCount(payload.capacityTotal)
        ?? this.normalizeCount(payload.capacityMax)
        ?? acceptedMembers
    );
    const rating = this.nonNegativeInteger(payload.rating) || (6 + ((AppUtils.hashText(`${id}:${title}`) % 35) / 10));
    const boost = this.nonNegativeInteger(payload.boost) || (50 + (AppUtils.hashText(`${id}:${title}`) % 51));
    const affinity = this.nonNegativeInteger(payload.affinity) || this.resolveEventAffinity({
      id,
      title,
      subtitle,
      topics,
      visibility,
      blindMode,
      rating,
      acceptedMembers,
      capacityTotal
    });

    return {
      id,
      userId: payload.userId.trim() || creatorUserId,
      type,
      status: this.normalizeEventStatus(payload.status),
      avatar: payload.avatar.trim() || creatorInitials,
      title,
      subtitle,
      timeframe: payload.timeframe.trim() || this.buildTimeframeLabel(startAtIso, endAtIso, frequency),
      inviter: payload.inviter ?? null,
      unread: this.nonNegativeInteger(payload.unread),
      activity: this.nonNegativeInteger(payload.activity),
      trashedAtIso: payload.trashedAtIso ?? null,
      creatorUserId,
      creatorName,
      creatorInitials,
      creatorGender: payload.creatorGender ?? 'man',
      creatorCity: payload.creatorCity,
      visibility,
      blindMode,
      startAtIso,
      endAtIso,
      distanceKm: Math.max(0, Number(payload.distanceKm) || 0),
      imageUrl: payload.imageUrl.trim(),
      sourceLink: payload.sourceLink.trim(),
      location: this.normalizeLocation(payload.location),
      locationCoordinates: this.normalizeLocationCoordinates(payload.locationCoordinates),
      capacityMin: this.normalizeCount(payload.capacityMin) ?? 0,
      capacityMax: this.normalizeCount(payload.capacityMax) ?? capacityTotal,
      capacityTotal,
      autoInviter: payload.autoInviter === true,
      frequency,
      ticketing,
      pricing,
      policiesEnabled,
      policies,
      slotsEnabled: hasSlots,
      slotTemplates,
      parentEventId: payload.parentEventId ?? null,
      slotTemplateId: payload.slotTemplateId ?? null,
      generated: payload.generated === true,
      eventType: payload.eventType ?? 'main',
      nextSlot: payload.nextSlot ? { ...payload.nextSlot } : null,
      upcomingSlots: payload.upcomingSlots.map(item => ({ ...item })),
      acceptedMembers,
      pendingMembers,
      acceptedMemberUserIds: [...payload.acceptedMemberUserIds],
      pendingMemberUserIds: [...payload.pendingMemberUserIds],
      invitedMemberUserIds: [...payload.invitedMemberUserIds],
      pendingRequestMemberUserIds: [...payload.pendingRequestMemberUserIds],
      pendingReason: payload.pendingReason,
      topics,
      subEventsEnabled,
      subEventDefinitions,
      subEvents,
      mode: this.normalizeEventMode(
        payload.mode
          ?? this.inferredEventMode(subEvents)
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
      policiesEnabled: record.policiesEnabled === true,
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
      mode: this.normalizeEventMode(record.mode),
      rating: record.rating,
      boost: record.boost,
      affinity: record.affinity,
      paymentSessionId: null
    });
  }

  private static inferredEventMode(items: readonly { optional?: boolean; groups?: readonly unknown[] }[]): EventContracts.EventMode {
    if (items.some(item => !item.optional && (item.groups?.length ?? 0) > 0)) {
      return 'Tournament';
    }
    return 'Casual';
  }

  private static normalizeEventMode(value: unknown): EventContracts.EventMode {
    return `${value ?? ''}`.trim().toLowerCase() === 'tournament' ? 'Tournament' : 'Casual';
  }

  private static resolveEventAffinity(options: {
    id: string;
    title: string;
    subtitle?: string | null;
    topics: readonly string[];
    visibility: string;
    blindMode: string;
    rating?: number | null;
    acceptedMembers?: number | null;
    capacityTotal?: number | null;
  }): number {
    const tokens = this.uniqueAffinityTokens([
      options.title,
      options.subtitle ?? '',
      ...options.topics,
      options.visibility,
      options.blindMode
    ]);
    return (
      this.resolveAffinityTokenScore(tokens, `event:${options.id}`) * 89
      + Math.round(AppUtils.clampNumber(Number(options.rating) || 0, 0, 10) * 100) * 29
      + Math.max(0, Math.trunc(Number(options.acceptedMembers) || 0)) * 19
      + Math.max(0, Math.trunc(Number(options.capacityTotal) || 0)) * 7
    );
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
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
          closed: true,
          subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(item.subEventDefinitions ?? [])
        };
      }
      const normalizedStart = `${item.startAt ?? ''}`.trim();
      const parsedStart = this.parseDate(normalizedStart) ?? new Date();
      return {
        id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
        startAt: this.parseDate(normalizedStart) ? normalizedStart : this.toIsoDateTimeLocal(parsedStart),
        overrideDate: this.normalizeSlotOverrideDate(item.overrideDate),
        closed: false,
        subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(item.subEventDefinitions ?? [])
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
