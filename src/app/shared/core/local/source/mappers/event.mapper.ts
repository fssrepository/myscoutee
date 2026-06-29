import type { DtoListMapper, DtoMapper } from './mapper.types';
import { AppUtils } from '../../../../app-utils';
import { PricingBuilder } from '../../../base/builders';
import {
  ActivityEventDetailDTO,
  type ActivityEventDTO,
  type ActivityEventRecord,
  type ActivityEventPageResultDTO,
  type ActivitySubEventStageRuntimeStateDTO,
  type ActivitySubEventStageRuntimeStateRefDTO,
  type ActivitySubEventResourceStateDTO,
  type SubEventDefinitionDTO,
  type SubEventsSlotDTO
} from '../../../contracts/activity.interface';
import type * as AppConstants from '../../../common/constants';
import type * as EventContracts from '../../../contracts/event.interface';
import type * as PricingContracts from '../../../contracts/pricing.interface';
import type { LocationCoordinates } from '../../../contracts/user.interface';

export interface SubEventResourceLookup {
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

export interface SubEventStateLookups {
  resourceLookups: SubEventResourceLookup[];
  stageRuntimeLookups: ActivitySubEventStageRuntimeStateRefDTO[];
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
      mode: ActivityEventDetailDTO.normalizeMode(record.mode),
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

  static toSubEventsSlots(
    parentEventId: string,
    records: readonly ActivityEventRecord[]
  ): SubEventsSlotDTO[] {
    const normalizedParentEventId = `${parentEventId ?? ''}`.trim();
    return records.map(record => this.toSubEventsSlot(normalizedParentEventId, record));
  }

  private static toSubEventsSlot(
    parentEventId: string,
    record: ActivityEventRecord
  ): SubEventsSlotDTO {
    const subEventItems = this.subEventItemsForSlot(record);
    return {
      id: this.subEventsSlotId(parentEventId, record),
      parentEventId,
      slotSourceId: this.isGeneratedSlotRecord(record) ? `${record.id ?? ''}`.trim() || null : null,
      slotTemplateId: `${record.slotTemplateId ?? ''}`.trim() || null,
      title: this.isGeneratedSlotRecord(record) ? `${record.title ?? ''}`.trim() || null : null,
      timeframe: this.isGeneratedSlotRecord(record) ? `${record.timeframe ?? ''}`.trim() || null : null,
      startAt: `${record.startAtIso ?? ''}`.trim() || null,
      endAt: `${record.endAtIso ?? ''}`.trim() || null,
      subEventItems
    };
  }

  static subEventResourceLookups(
    slots: readonly SubEventsSlotDTO[],
    assetOwnerUserId: string
  ): SubEventResourceLookup[] {
    return this.subEventStateLookups(slots, assetOwnerUserId).resourceLookups;
  }

  static subEventStateLookups(
    slots: readonly SubEventsSlotDTO[],
    assetOwnerUserId: string
  ): SubEventStateLookups {
    const normalizedAssetOwnerUserId = `${assetOwnerUserId ?? ''}`.trim();
    const resourceLookups: SubEventResourceLookup[] = [];
    const stageRuntimeLookups: ActivitySubEventStageRuntimeStateRefDTO[] = [];
    for (const slot of slots ?? []) {
      const ownerId = this.subEventResourceOwnerIdFromSlot(slot);
      if (!ownerId) {
        continue;
      }
      for (let index = 0; index < (slot.subEventItems ?? []).length; index += 1) {
        const item = slot.subEventItems[index];
        const subEventId = `${item.id ?? ''}`.trim() || this.fallbackSubEventId(index);
        if (!subEventId) {
          continue;
        }
        stageRuntimeLookups.push({ ownerId, subEventId });
        if (normalizedAssetOwnerUserId) {
          resourceLookups.push({ ownerId, subEventId, assetOwnerUserId: normalizedAssetOwnerUserId });
        }
      }
    }
    return {
      resourceLookups,
      stageRuntimeLookups
    };
  }

  static subEventResourceRecordKey(ref: SubEventResourceLookup): string {
    const ownerId = `${ref.ownerId ?? ''}`.trim();
    const subEventId = `${ref.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref.assetOwnerUserId ?? ''}`.trim();
    return ownerId && subEventId && assetOwnerUserId
      ? `${ownerId}:${subEventId}:${assetOwnerUserId}`
      : '';
  }

  static withSubEventResourceRecords(
    slots: readonly SubEventsSlotDTO[],
    resourcesByKey: ReadonlyMap<string, ActivitySubEventResourceStateDTO>,
    assetOwnerUserId: string
  ): SubEventsSlotDTO[] {
    return this.withSubEventStates(slots, resourcesByKey, new Map(), assetOwnerUserId);
  }

  static subEventStageRuntimeRecordKey(ref: ActivitySubEventStageRuntimeStateRefDTO): string {
    const ownerId = `${ref.ownerId ?? ''}`.trim();
    const subEventId = `${ref.subEventId ?? ''}`.trim();
    return ownerId && subEventId ? `${ownerId}:${subEventId}` : '';
  }

  static withSubEventStates(
    slots: readonly SubEventsSlotDTO[],
    resourcesByKey: ReadonlyMap<string, ActivitySubEventResourceStateDTO>,
    stageRuntimeByKey: ReadonlyMap<string, ActivitySubEventStageRuntimeStateDTO>,
    assetOwnerUserId: string
  ): SubEventsSlotDTO[] {
    return slots.map(slot => this.withSubEventStatesForSlot(slot, resourcesByKey, stageRuntimeByKey, assetOwnerUserId));
  }

  private static withSubEventStatesForSlot(
    slot: SubEventsSlotDTO,
    resourcesByKey: ReadonlyMap<string, ActivitySubEventResourceStateDTO>,
    stageRuntimeByKey: ReadonlyMap<string, ActivitySubEventStageRuntimeStateDTO>,
    assetOwnerUserId: string
  ): SubEventsSlotDTO {
    const ownerId = this.subEventResourceOwnerIdFromSlot(slot);
    return {
      ...slot,
      subEventItems: (slot.subEventItems ?? []).map((item, index) => {
        const subEventId = `${item.id ?? ''}`.trim() || this.fallbackSubEventId(index);
        const resource = resourcesByKey.get(this.subEventResourceRecordKey({
          ownerId,
          subEventId,
          assetOwnerUserId
        })) ?? null;
        const stageRuntime = stageRuntimeByKey.get(this.subEventStageRuntimeRecordKey({
          ownerId,
          subEventId
        })) ?? null;
        return this.withSubEventStageRuntime(this.withSubEventResource(item, resource), stageRuntime);
      })
    };
  }

  private static subEventItemsForSlot(record: ActivityEventRecord): EventContracts.SubEventDTO[] {
    const slotStart = AppUtils.parseDate(`${record.startAtIso ?? ''}`.trim()) ?? new Date();
    return this.subEventDefinitionTimeline(record.subEventDefinitions ?? [])
      .map(({ item, startOffsetMinutes, durationMinutes }, index) => {
        const startAt = new Date(slotStart.getTime() + (startOffsetMinutes * 60 * 1000));
        const endAt = new Date(startAt.getTime() + (durationMinutes * 60 * 1000));
        const isTournamentStage = this.isTournamentStageDefinition(item);
        const stageStatus = isTournamentStage
          ? (index === 0 ? 'RS' : 'A')
          : undefined;
        return {
          id: `${item.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`,
          name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
          description: `${item.description ?? ''}`.trim(),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          location: `${item.location ?? ''}`.trim(),
          groups: (item.groups ?? []).map(group => ({ ...group })),
          tournamentGroupCount: item.tournamentGroupCount,
          tournamentGroupCapacityMin: item.tournamentGroupCapacityMin,
          tournamentGroupCapacityMax: item.tournamentGroupCapacityMax,
          tournamentLeaderboardType: item.tournamentLeaderboardType,
          tournamentAdvancePerGroup: item.tournamentAdvancePerGroup,
          optional: item.optional,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
          capacityMin: item.capacityMin,
          capacityMax: item.capacityMax,
          membersAccepted: 0,
          membersPending: 0,
          carsPending: 0,
          accommodationPending: 0,
          suppliesPending: 0,
          slotStartOffsetMinutes: startOffsetMinutes,
          slotDurationMinutes: durationMinutes,
          stageStatus,
          stageStatusReason: stageStatus === 'RS' ? 'awaiting-tournament-start' : undefined
        };
      });
  }

  private static subEventDefinitionTimeline(
    items: readonly SubEventDefinitionDTO[]
  ): Array<{ item: SubEventDefinitionDTO; startOffsetMinutes: number; durationMinutes: number }> {
    let previousStartOffsetMinutes = 0;
    let previousEndOffsetMinutes = 0;
    let hasPrevious = false;
    return ActivityEventDetailDTO.normalizeSubEventDefinitions(items).map(item => {
      const durationMinutes = Math.max(0, Math.trunc(Number(item.durationMinutes) || 0));
      const offsetMinutes = Math.max(0, Math.trunc(Number(item.offsetMinutes) || 0));
      const timing = ActivityEventDetailDTO.normalizeSubEventDefinitionTiming(item.timing);
      const startOffsetMinutes = !hasPrevious
        ? offsetMinutes
        : timing === 'During'
          ? previousStartOffsetMinutes + offsetMinutes
          : previousEndOffsetMinutes + offsetMinutes;
      previousStartOffsetMinutes = startOffsetMinutes;
      previousEndOffsetMinutes = startOffsetMinutes + durationMinutes;
      hasPrevious = true;
      return { item, startOffsetMinutes, durationMinutes };
    });
  }

  private static isTournamentStageDefinition(item: SubEventDefinitionDTO): boolean {
    return item.optional !== true
      && (
        (item.groups?.length ?? 0) > 0
        || (item.tournamentGroupCount ?? 0) > 0
        || item.tournamentLeaderboardType === 'Score'
        || item.tournamentLeaderboardType === 'Fifa'
      );
  }

  private static withSubEventResource(
    item: EventContracts.SubEventDTO,
    resource: ActivitySubEventResourceStateDTO | null
  ): EventContracts.SubEventDTO {
    const car = this.resourceMetric(resource, 'Car', {
      accepted: item.carsAccepted,
      pending: item.carsPending,
      capacityMin: item.carsCapacityMin,
      capacityMax: item.carsCapacityMax
    });
    const accommodation = this.resourceMetric(resource, 'Accommodation', {
      accepted: item.accommodationAccepted,
      pending: item.accommodationPending,
      capacityMin: item.accommodationCapacityMin,
      capacityMax: item.accommodationCapacityMax
    });
    const supplies = this.resourceMetric(resource, 'Supplies', {
      accepted: item.suppliesAccepted,
      pending: item.suppliesPending,
      capacityMin: item.suppliesCapacityMin,
      capacityMax: item.suppliesCapacityMax
    });
    return {
      ...item,
      carsAccepted: car.accepted,
      carsPending: car.pending,
      carsCapacityMin: car.capacityMin,
      carsCapacityMax: car.capacityMax,
      accommodationAccepted: accommodation.accepted,
      accommodationPending: accommodation.pending,
      accommodationCapacityMin: accommodation.capacityMin,
      accommodationCapacityMax: accommodation.capacityMax,
      suppliesAccepted: supplies.accepted,
      suppliesPending: supplies.pending,
      suppliesCapacityMin: supplies.capacityMin,
      suppliesCapacityMax: supplies.capacityMax
    };
  }

  private static withSubEventStageRuntime(
    item: EventContracts.SubEventDTO,
    stageRuntime: ActivitySubEventStageRuntimeStateDTO | null
  ): EventContracts.SubEventDTO {
    if (!stageRuntime) {
      return item;
    }
    return {
      ...item,
      stageStatus: `${stageRuntime.stageStatus ?? ''}`.trim() || item.stageStatus,
      stageStatusReason: `${stageRuntime.stageStatusReason ?? ''}`.trim() || item.stageStatusReason,
      stageStatusUpdatedAt: `${stageRuntime.stageStatusUpdatedAt ?? ''}`.trim() || item.stageStatusUpdatedAt,
      stageFinalizedAt: `${stageRuntime.stageFinalizedAt ?? ''}`.trim() || item.stageFinalizedAt,
      stageFinalizedByUserId: `${stageRuntime.stageFinalizedByUserId ?? ''}`.trim() || item.stageFinalizedByUserId
    };
  }

  private static resourceMetric(
    resource: ActivitySubEventResourceStateDTO | null,
    type: 'Car' | 'Accommodation' | 'Supplies',
    fallback: {
      accepted?: number | null;
      pending?: number | null;
      capacityMin?: number | null;
      capacityMax?: number | null;
    }
  ): { accepted: number; pending: number; capacityMin: number; capacityMax: number } {
    if (!resource) {
      return {
        accepted: this.nonNegativeInteger(fallback.accepted),
        pending: this.nonNegativeInteger(fallback.pending),
        capacityMin: this.nonNegativeInteger(fallback.capacityMin),
        capacityMax: this.nonNegativeInteger(fallback.capacityMax)
      };
    }
    const settingsById = resource.assetSettingsByType[type] ?? {};
    const assignedIds = resource.assetAssignmentIds[type] ?? [];
    const assetIds = assignedIds.length > 0 ? assignedIds : Object.keys(settingsById);
    const capacityMin = assetIds.reduce((sum, assetId) => (
      sum + this.nonNegativeInteger(settingsById[assetId]?.capacityMin)
    ), 0);
    const capacityMax = assetIds.reduce((sum, assetId) => (
      sum + this.nonNegativeInteger(settingsById[assetId]?.capacityMax)
    ), 0);
    const accepted = type === 'Supplies'
      ? assetIds.reduce((sum, assetId) => (
          sum + (resource.supplyContributionEntriesByAssetId[assetId] ?? [])
            .reduce((entrySum, entry) => entrySum + this.nonNegativeInteger(entry.quantity), 0)
        ), 0)
      : 0;
    return {
      accepted,
      pending: 0,
      capacityMin,
      capacityMax
    };
  }

  private static subEventResourceOwnerIdFromSlot(slot: SubEventsSlotDTO): string {
    return `${slot.slotSourceId ?? ''}`.trim() || `${slot.id ?? ''}`.trim();
  }

  private static subEventsSlotId(parentEventId: string, record: ActivityEventRecord): string {
    return this.isGeneratedSlotRecord(record)
      ? `${record.id ?? ''}`.trim()
      : `${parentEventId ?? ''}`.trim() + ':default';
  }

  private static fallbackSubEventId(index: number): string {
    return `subevent-${index + 1}`;
  }

  private static isGeneratedSlotRecord(record: ActivityEventRecord | null | undefined): boolean {
    return record?.generated === true || record?.eventType === 'slot' || Boolean(record?.parentEventId);
  }

  private static nonNegativeInteger(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.trunc(parsed));
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
