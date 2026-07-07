import type { DtoListMapper, DtoMapper } from './mapper.types';
import { AppUtils } from '../../../../app-utils';
import { PricingBuilder } from '../../../base/builders';
import {
  ActivityEventDetailDTO,
  type ActivityEventDTO,
  type ActivityEventRecord,
  type ActivityEventPageResultDTO,
  type ActivityEventSubEventsQueryDTO,
  type ActivitySubEventStageRuntimeStateDTO,
  type ActivitySubEventStageRuntimeStateRefDTO,
  type ActivitySubEventResourceStateDTO,
  type SubEventDefinitionDTO,
  type SubEventsSlotDTO
} from '../../../contracts/activity.interface';
import * as AppConstants from '../../../common/constants';
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

export interface SubEventResourceMetric {
  accepted: number;
  pending: number;
}

interface SubEventsSlotSource {
  id: string;
  parentEventId: string;
  slotSourceId: string | null;
  slotTemplateId: string | null;
  title: string | null;
  timeframe: string | null;
  startAt: string | null;
  endAt: string | null;
  definitions: SubEventDefinitionDTO[];
}

export class LocalActivityEventsMapper {
  static toDto(record: ActivityEventRecord): ActivityEventDTO {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      status: record.status,
      statusBeforeSuppression: record.statusBeforeSuppression ?? null,
      trashedAtIso: record.trashedAtIso ?? null,
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
    parentRecord: ActivityEventRecord,
    query?: ActivityEventSubEventsQueryDTO | null
  ): SubEventsSlotDTO[] {
    const normalizedParentEventId = `${parentEventId ?? ''}`.trim();
    const direction = `${query?.order ?? ''}`.trim().toLowerCase() === 'past' ? -1 : 1;
    const nowMs = Date.now();
    const sources = this.subEventsSlotSources(normalizedParentEventId, parentRecord, query)
      .filter(source => source.definitions.length > 0)
      .filter(source => this.slotSourceMatchesOrder(source, query, nowMs))
      .filter(source => this.slotSourceOverlapsRange(source, query))
      .sort((left, right) => direction * (this.dateMs(left.startAt) - this.dateMs(right.startAt)));
    const groupCountsBySource = this.stageGroupCountsBySource(sources, parentRecord.capacityMax);
    return sources.map(source => this.toSubEventsSlot(
      source,
      groupCountsBySource.get(source) ?? new Map<string, number>()
    ));
  }

  private static toSubEventsSlot(
    source: SubEventsSlotSource,
    groupCountsByStageId: ReadonlyMap<string, number>
  ): SubEventsSlotDTO {
    const subEventItems = this.subEventItemsForSlot(source.startAt, source.definitions, groupCountsByStageId);
    return {
      id: source.id,
      parentEventId: source.parentEventId,
      slotSourceId: source.slotSourceId,
      slotTemplateId: source.slotTemplateId,
      title: source.title,
      timeframe: source.timeframe,
      startAt: source.startAt,
      endAt: source.endAt,
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

  static subEventResourceMetricKey(
    ownerIdValue: string | null | undefined,
    subEventIdValue: string | null | undefined,
    typeValue: string | null | undefined
  ): string {
    const ownerId = `${ownerIdValue ?? ''}`.trim();
    const subEventId = `${subEventIdValue ?? ''}`.trim();
    const type = `${typeValue ?? ''}`.trim();
    return ownerId && subEventId && type ? `${ownerId}:${subEventId}:${type}` : '';
  }

  static withSubEventStates(
    slots: readonly SubEventsSlotDTO[],
    resourcesByKey: ReadonlyMap<string, ActivitySubEventResourceStateDTO>,
    stageRuntimeByKey: ReadonlyMap<string, ActivitySubEventStageRuntimeStateDTO>,
    assetOwnerUserId: string,
    resourceMetricsByKey: ReadonlyMap<string, SubEventResourceMetric> = new Map()
  ): SubEventsSlotDTO[] {
    return slots.map(slot => this.withSubEventStatesForSlot(
      slot,
      resourcesByKey,
      stageRuntimeByKey,
      assetOwnerUserId,
      resourceMetricsByKey
    ));
  }

  private static withSubEventStatesForSlot(
    slot: SubEventsSlotDTO,
    resourcesByKey: ReadonlyMap<string, ActivitySubEventResourceStateDTO>,
    stageRuntimeByKey: ReadonlyMap<string, ActivitySubEventStageRuntimeStateDTO>,
    assetOwnerUserId: string,
    resourceMetricsByKey: ReadonlyMap<string, SubEventResourceMetric>
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
        return this.withSubEventStageRuntime(this.withSubEventResource(item, resource, resourceMetricsByKey), stageRuntime);
      })
    };
  }

  private static subEventsSlotSources(
    parentEventId: string,
    parentRecord: ActivityEventRecord,
    query: ActivityEventSubEventsQueryDTO | null | undefined
  ): SubEventsSlotSource[] {
    if (!parentRecord) {
      return [];
    }
    if (this.isGeneratedSlotRecord(parentRecord)) {
      return [this.recordSlotSource(parentEventId, parentRecord)];
    }
    if (parentRecord.subEventsEnabled === false) {
      return [];
    }
    const templates = parentRecord.slotsEnabled === true ? parentRecord.slotTemplates ?? [] : [];
    if (templates.length > 0) {
      return this.templateSlotSources(parentEventId, parentRecord, templates, query);
    }
    const definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(parentRecord.subEventDefinitions ?? []);
    return definitions.length > 0
      ? [{
          id: `${parentEventId}:default`,
          parentEventId,
          slotSourceId: null,
          slotTemplateId: null,
          title: null,
          timeframe: null,
          startAt: `${parentRecord.startAtIso ?? ''}`.trim() || null,
          endAt: `${parentRecord.endAtIso ?? ''}`.trim() || null,
          definitions
        }]
      : [];
  }

  private static recordSlotSource(parentEventId: string, record: ActivityEventRecord): SubEventsSlotSource {
    return {
      id: `${record.id ?? ''}`.trim() || `${parentEventId}:slot`,
      parentEventId,
      slotSourceId: `${record.id ?? ''}`.trim() || null,
      slotTemplateId: `${record.slotTemplateId ?? ''}`.trim() || null,
      title: `${record.title ?? ''}`.trim() || null,
      timeframe: `${record.timeframe ?? ''}`.trim() || null,
      startAt: `${record.startAtIso ?? ''}`.trim() || null,
      endAt: `${record.endAtIso ?? ''}`.trim() || null,
      definitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(record.subEventDefinitions ?? [])
    };
  }

  private static templateSlotSources(
    parentEventId: string,
    parentRecord: ActivityEventRecord,
    templates: readonly EventContracts.EventSlotTemplateDTO[],
    query: ActivityEventSubEventsQueryDTO | null | undefined
  ): SubEventsSlotSource[] {
    const parentStart = AppUtils.parseDate(`${parentRecord.startAtIso ?? ''}`.trim());
    const parentEnd = AppUtils.parseDate(`${parentRecord.endAtIso ?? ''}`.trim());
    if (!parentStart || !parentEnd || parentEnd.getTime() < parentStart.getTime()) {
      return [];
    }
    const horizon = this.slotGenerationHorizon(parentStart, parentEnd, query);
    if (!horizon) {
      return [];
    }
    const sources: SubEventsSlotSource[] = [];
    const overrideDates = new Set(
      templates
        .map(template => this.slotOverrideDateKey(template.overrideDate))
        .filter((value): value is string => Boolean(value))
    );
    for (const template of templates) {
      if (template.closed === true || this.slotOverrideDateKey(template.overrideDate)) {
        continue;
      }
      const templateStart = AppUtils.parseDate(`${template.startAt ?? ''}`.trim());
      if (!templateStart) {
        continue;
      }
      const definitions = this.slotTemplateSubEventDefinitions(parentRecord, template);
      const durationMs = this.subEventDefinitionsDurationMinutes(definitions) * 60 * 1000;
      for (const startAt of this.generateSlotOccurrenceStarts(parentRecord.frequency ?? 'One-time', templateStart, horizon.start, horizon.end)) {
        const occurrenceDateKey = this.slotOccurrenceAnchorDateKey(startAt, templateStart, parentStart);
        if (occurrenceDateKey && overrideDates.has(occurrenceDateKey)) {
          continue;
        }
        const endAt = new Date(startAt.getTime() + durationMs);
        if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
          continue;
        }
        sources.push(this.templateSlotSource(parentEventId, parentRecord, template, definitions, startAt, endAt));
      }
    }
    for (const template of templates) {
      if (template.closed === true || !this.slotOverrideDateKey(template.overrideDate)) {
        continue;
      }
      const startAt = AppUtils.parseDate(`${template.startAt ?? ''}`.trim());
      if (!startAt) {
        continue;
      }
      const definitions = this.slotTemplateSubEventDefinitions(parentRecord, template);
      const endAt = new Date(startAt.getTime() + (this.subEventDefinitionsDurationMinutes(definitions) * 60 * 1000));
      if (startAt.getTime() < horizon.start.getTime() || startAt.getTime() > horizon.end.getTime()) {
        continue;
      }
      if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
        continue;
      }
      sources.push(this.templateSlotSource(parentEventId, parentRecord, template, definitions, startAt, endAt));
    }
    return sources;
  }

  private static templateSlotSource(
    parentEventId: string,
    parentRecord: ActivityEventRecord,
    template: EventContracts.EventSlotTemplateDTO,
    definitions: readonly SubEventDefinitionDTO[],
    startAt: Date,
    endAt: Date
  ): SubEventsSlotSource {
    const slotTemplateId = `${template.id ?? ''}`.trim();
    const sourceId = this.generatedSlotSourceId(parentEventId, slotTemplateId, startAt);
    return {
      id: sourceId,
      parentEventId,
      slotSourceId: sourceId,
      slotTemplateId,
      title: `${parentRecord.title ?? ''}`.trim() || null,
      timeframe: this.generatedSlotTimeframe(startAt, endAt),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      definitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(definitions)
    };
  }

  private static slotTemplateSubEventDefinitions(
    parentRecord: ActivityEventRecord,
    template: EventContracts.EventSlotTemplateDTO
  ): SubEventDefinitionDTO[] {
    const overrideDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(template.subEventDefinitions ?? []);
    return overrideDefinitions.length > 0
      ? overrideDefinitions
      : ActivityEventDetailDTO.normalizeSubEventDefinitions(parentRecord.subEventDefinitions ?? []);
  }

  private static slotGenerationHorizon(
    parentStart: Date,
    parentEnd: Date,
    query: ActivityEventSubEventsQueryDTO | null | undefined
  ): { start: Date; end: Date } | null {
    const rangeStart = this.queryRangeStart(query);
    const rangeEnd = this.queryRangeEnd(query);
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const isPast = `${query?.order ?? ''}`.trim().toLowerCase() === 'past';
    const defaultStart = new Date(nowMs - ((isPast ? 45 : 1) * dayMs));
    const defaultEnd = new Date(nowMs + ((isPast ? 1 : 45) * dayMs));
    const start = new Date(Math.max(parentStart.getTime(), (rangeStart ?? defaultStart).getTime()));
    const end = new Date(Math.min(parentEnd.getTime(), (rangeEnd ?? defaultEnd).getTime()));
    return end.getTime() < start.getTime() ? null : { start, end };
  }

  private static slotSourceMatchesOrder(
    source: SubEventsSlotSource,
    query: ActivityEventSubEventsQueryDTO | null | undefined,
    nowMs: number
  ): boolean {
    const start = this.dateMs(source.startAt);
    let end = this.dateMs(source.endAt);
    if (!Number.isFinite(end) || end <= 0) {
      end = start;
    }
    if (!Number.isFinite(end) || end <= 0) {
      return false;
    }
    const isPast = end < nowMs;
    return `${query?.order ?? ''}`.trim().toLowerCase() === 'past' ? isPast : !isPast;
  }

  private static slotSourceOverlapsRange(
    source: SubEventsSlotSource,
    query: ActivityEventSubEventsQueryDTO | null | undefined
  ): boolean {
    const rangeStart = this.queryRangeStart(query);
    const rangeEnd = this.queryRangeEnd(query);
    if (!rangeStart && !rangeEnd) {
      return true;
    }
    const start = this.dateMs(source.startAt);
    let end = this.dateMs(source.endAt);
    if (!Number.isFinite(end) || end <= 0) {
      end = start;
    }
    if (rangeStart && end < rangeStart.getTime()) {
      return false;
    }
    if (rangeEnd && start > rangeEnd.getTime()) {
      return false;
    }
    return true;
  }

  private static subEventDefinitionsDurationMinutes(definitions: readonly SubEventDefinitionDTO[]): number {
    return this.subEventDefinitionTimeline(definitions)
      .reduce((maxEnd, entry) => Math.max(maxEnd, entry.startOffsetMinutes + entry.durationMinutes), 0);
  }

  private static generateSlotOccurrenceStarts(
    frequency: string,
    templateStart: Date,
    horizonStart: Date,
    horizonEnd: Date
  ): Date[] {
    const normalizedFrequency = `${frequency ?? ''}`.trim().toLowerCase();
    if (!normalizedFrequency || normalizedFrequency === 'one-time' || normalizedFrequency === 'custom') {
      return templateStart.getTime() >= horizonStart.getTime() && templateStart.getTime() <= horizonEnd.getTime()
        ? [new Date(templateStart)]
        : [];
    }
    const starts: Date[] = [];
    const cursor = new Date(horizonStart);
    cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(horizonEnd);
    endDate.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endDate.getTime()) {
      if (this.matchesSlotFrequency(cursor, templateStart, normalizedFrequency)) {
        const next = new Date(cursor);
        next.setHours(
          templateStart.getHours(),
          templateStart.getMinutes(),
          templateStart.getSeconds(),
          templateStart.getMilliseconds()
        );
        if (next.getTime() >= horizonStart.getTime() && next.getTime() <= horizonEnd.getTime()) {
          starts.push(next);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return starts;
  }

  private static matchesSlotFrequency(date: Date, templateStart: Date, frequency: string): boolean {
    if (frequency === 'daily') {
      return true;
    }
    if (frequency === 'weekly') {
      return date.getDay() === templateStart.getDay();
    }
    if (frequency === 'bi-weekly' || frequency === 'biweekly') {
      if (date.getDay() !== templateStart.getDay()) {
        return false;
      }
      const diffDays = Math.floor((date.getTime() - AppUtils.dateOnly(templateStart).getTime()) / (24 * 60 * 60 * 1000));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    }
    if (frequency === 'monthly') {
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    if (frequency === 'yearly' || frequency === 'annual' || frequency === 'annually') {
      if (date.getMonth() !== templateStart.getMonth()) {
        return false;
      }
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    return false;
  }

  private static generatedSlotSourceId(parentEventId: string, slotTemplateId: string, startAt: Date): string {
    return `${parentEventId}:slot:${slotTemplateId}:${startAt.toISOString()}`;
  }

  private static generatedSlotTimeframe(startAt: Date, endAt: Date): string {
    const dateLabel = startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startLabel = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endLabel = endAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateLabel} · ${startLabel} - ${endLabel}`;
  }

  private static queryRangeStart(query: ActivityEventSubEventsQueryDTO | null | undefined): Date | null {
    const value = `${query?.rangeStart ?? ''}`.trim();
    const parsed = AppUtils.parseDateOnly(value);
    return parsed ? AppUtils.dateOnly(parsed) : null;
  }

  private static queryRangeEnd(query: ActivityEventSubEventsQueryDTO | null | undefined): Date | null {
    const value = `${query?.rangeEnd ?? ''}`.trim();
    const parsed = AppUtils.parseDateOnly(value);
    if (!parsed) {
      return null;
    }
    const end = AppUtils.dateOnly(parsed);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private static slotOverrideDateKey(value: string | null | undefined): string | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = AppUtils.parseDate(raw.includes('T') ? raw : `${raw}T00:00`);
    if (!parsed) {
      return null;
    }
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static slotOccurrenceAnchorDateKey(
    occurrenceStart: Date,
    templateStart: Date,
    parentStart: Date
  ): string | null {
    const templateOffsetMs = templateStart.getTime() - parentStart.getTime();
    return this.slotOverrideDateKey(new Date(occurrenceStart.getTime() - templateOffsetMs).toISOString());
  }

  private static dateMs(value: string | null | undefined): number {
    return AppUtils.parseDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
  }

  private static subEventItemsForSlot(
    slotStartIso: string | null | undefined,
    definitions: readonly SubEventDefinitionDTO[],
    groupCountsByStageId: ReadonlyMap<string, number>
  ): EventContracts.SubEventDTO[] {
    const slotStart = AppUtils.parseDate(`${slotStartIso ?? ''}`.trim()) ?? new Date();
    return this.subEventDefinitionTimeline(definitions)
      .map(({ item, startOffsetMinutes, durationMinutes }, index) => {
        const startAt = new Date(slotStart.getTime() + (startOffsetMinutes * 60 * 1000));
        const endAt = new Date(startAt.getTime() + (durationMinutes * 60 * 1000));
        const isTournamentStage = this.isTournamentStageDefinition(item);
        const stageStatus = isTournamentStage ? 'RS' : undefined;
        const stageId = `${item.id ?? this.fallbackSubEventId(index)}`.trim() || this.fallbackSubEventId(index);
        return {
          id: stageId,
          name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
          description: `${item.description ?? ''}`.trim(),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          location: `${item.location ?? ''}`.trim(),
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
          groupsCount: groupCountsByStageId.get(stageId),
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
        (item.tournamentGroupCapacityMin ?? 0) > 0
        || (item.tournamentGroupCapacityMax ?? 0) > 0
        || item.tournamentLeaderboardType === 'Score'
        || item.tournamentLeaderboardType === 'Fifa'
      );
  }

  private static stageGroupCountsByStageId(
    definitions: readonly SubEventDefinitionDTO[],
    eventCapacityMax: number | null | undefined
  ): Map<string, number> {
    const countsByStageId = new Map<string, number>();
    let incomingCapacityMax = this.nonNegativeInteger(eventCapacityMax);
    this.subEventDefinitionTimeline(definitions).forEach(({ item }, index) => {
      const stageId = `${item.id ?? this.fallbackSubEventId(index)}`.trim() || this.fallbackSubEventId(index);
      const groupCount = this.autoTournamentGroupCountForIncoming(item, incomingCapacityMax);
      countsByStageId.set(stageId, groupCount);
      if (!this.isTournamentStageDefinition(item)) {
        return;
      }
      const advancePerGroup = this.nonNegativeInteger(item.tournamentAdvancePerGroup);
      incomingCapacityMax = groupCount > 0 && advancePerGroup > 0 ? groupCount * advancePerGroup : 0;
    });
    return countsByStageId;
  }

  private static stageGroupCountsBySource(
    sources: readonly SubEventsSlotSource[],
    eventCapacityMax: number | null | undefined
  ): Map<SubEventsSlotSource, Map<string, number>> {
    const countsBySource = new Map<SubEventsSlotSource, Map<string, number>>();
    const countsByDefinitionsKey = new Map<string, Map<string, number>>();
    for (const source of sources) {
      const key = this.stageGroupCalculationKey(source.definitions, eventCapacityMax);
      let countsByStageId = countsByDefinitionsKey.get(key);
      if (!countsByStageId) {
        countsByStageId = this.stageGroupCountsByStageId(source.definitions, eventCapacityMax);
        countsByDefinitionsKey.set(key, countsByStageId);
      }
      countsBySource.set(source, countsByStageId);
    }
    return countsBySource;
  }

  private static stageGroupCalculationKey(
    definitions: readonly SubEventDefinitionDTO[],
    eventCapacityMax: number | null | undefined
  ): string {
    return [
      this.nonNegativeInteger(eventCapacityMax),
      ...ActivityEventDetailDTO.normalizeSubEventDefinitions(definitions).map((item, index) => [
        `${item.id ?? this.fallbackSubEventId(index)}`.trim() || this.fallbackSubEventId(index),
        item.optional === true ? '1' : '0',
        this.nonNegativeInteger(item.tournamentGroupCapacityMin),
        this.nonNegativeInteger(item.tournamentGroupCapacityMax),
        `${item.tournamentLeaderboardType ?? ''}`.trim(),
        this.nonNegativeInteger(item.tournamentAdvancePerGroup)
      ].join(':'))
    ].join('|');
  }

  private static autoTournamentGroupCountForIncoming(
    item: SubEventDefinitionDTO,
    incomingCapacityMax: number
  ): number {
    if (!this.isTournamentStageDefinition(item)) {
      return 0;
    }
    const groupCapacityMax = this.nonNegativeInteger(item.tournamentGroupCapacityMax);
    if (groupCapacityMax <= 0) {
      return 0;
    }
    return Math.ceil(this.nonNegativeInteger(incomingCapacityMax) / groupCapacityMax);
  }

  private static withSubEventResource(
    item: EventContracts.SubEventDTO,
    resource: ActivitySubEventResourceStateDTO | null,
    resourceMetricsByKey: ReadonlyMap<string, SubEventResourceMetric>
  ): EventContracts.SubEventDTO {
    const car = this.resourceMetric(resource, AppConstants.ASSET_TYPE_TRANSPORT, {
      accepted: item.carsAccepted,
      pending: item.carsPending,
      capacityMin: item.carsCapacityMin,
      capacityMax: item.carsCapacityMax
    }, resourceMetricsByKey);
    const accommodation = this.resourceMetric(resource, AppConstants.ASSET_TYPE_ACCOMMODATION, {
      accepted: item.accommodationAccepted,
      pending: item.accommodationPending,
      capacityMin: item.accommodationCapacityMin,
      capacityMax: item.accommodationCapacityMax
    }, resourceMetricsByKey);
    const supplies = this.resourceMetric(resource, AppConstants.ASSET_TYPE_SUPPLIES, {
      accepted: item.suppliesAccepted,
      pending: item.suppliesPending,
      capacityMin: item.suppliesCapacityMin,
      capacityMax: item.suppliesCapacityMax
    }, resourceMetricsByKey);
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
      stageFinalizedByUserId: `${stageRuntime.stageFinalizedByUserId ?? ''}`.trim() || item.stageFinalizedByUserId,
      groupsCount: stageRuntime.groupsCount ?? item.groupsCount
    };
  }

  private static resourceMetric(
    resource: ActivitySubEventResourceStateDTO | null,
    type: AppConstants.AssetType,
    fallback: {
      accepted?: number | null;
      pending?: number | null;
      capacityMin?: number | null;
      capacityMax?: number | null;
    },
    resourceMetricsByKey: ReadonlyMap<string, SubEventResourceMetric>
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
    const assetIds = this.normalizedAssetIds(assignedIds.length > 0 ? assignedIds : Object.keys(settingsById));
    const capacityMin = assetIds.reduce((sum, assetId) => (
      sum + this.nonNegativeInteger(settingsById[assetId]?.capacityMin)
    ), 0);
    const capacityMax = assetIds.reduce((sum, assetId) => (
      sum + this.nonNegativeInteger(settingsById[assetId]?.capacityMax)
    ), 0);
    const accepted = type === AppConstants.ASSET_TYPE_SUPPLIES
      ? assetIds.reduce((sum, assetId) => (
          sum + (resource.supplyContributionEntriesByAssetId[assetId] ?? [])
            .reduce((entrySum, entry) => entrySum + this.nonNegativeInteger(entry.quantity), 0)
        ), 0)
      : assetIds.length;
    const pending = 0;
    const metric = resourceMetricsByKey.get(this.subEventResourceMetricKey(resource.ownerId, resource.subEventId, type));
    return {
      accepted: metric ? this.nonNegativeInteger(metric.accepted) : accepted,
      pending: metric ? this.nonNegativeInteger(metric.pending) : pending,
      capacityMin,
      capacityMax
    };
  }

  private static normalizedAssetIds(source: readonly string[]): string[] {
    const ids = new Set<string>();
    source.forEach(item => {
      const assetId = `${item ?? ''}`.trim();
      if (assetId) {
        ids.add(assetId);
      }
    });
    return [...ids];
  }

  private static subEventResourceOwnerIdFromSlot(slot: SubEventsSlotDTO): string {
    return `${slot.slotSourceId ?? ''}`.trim()
      || `${slot.parentEventId ?? ''}`.trim()
      || `${slot.id ?? ''}`.trim();
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
    const adminIds = this.uniqueUserIds([
      ...(payload.adminIds ?? []),
      creatorUserId
    ]);
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
      statusBeforeSuppression: payload.statusBeforeSuppression ?? null,
      adminIds,
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
      checkoutBasket: ActivityEventDetailDTO.cloneCheckoutBasket(payload.checkoutBasket),
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
      checkoutBasket: ActivityEventDetailDTO.cloneCheckoutBasket(record.checkoutBasket),
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

  private static inferredEventMode(
    items: readonly {
      optional?: boolean;
      tournamentGroupCapacityMin?: number | null;
      tournamentGroupCapacityMax?: number | null;
      tournamentLeaderboardType?: string | null;
    }[]
  ): EventContracts.EventMode {
    if (items.some(item => !item.optional && (
      (item.tournamentGroupCapacityMin ?? 0) > 0
      || (item.tournamentGroupCapacityMax ?? 0) > 0
      || item.tournamentLeaderboardType === 'Score'
      || item.tournamentLeaderboardType === 'Fifa'
    ))) {
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
        tournamentGroupCapacityMin: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
        tournamentGroupCapacityMax: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
        tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
        groupsCount: this.optionalNonNegativeInteger(item.groupsCount),
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

  private static uniqueUserIds(userIds: readonly string[]): string[] {
    const unique: string[] = [];
    for (const userId of userIds) {
      const normalizedUserId = `${userId ?? ''}`.trim();
      if (!normalizedUserId || unique.includes(normalizedUserId)) {
        continue;
      }
      unique.push(normalizedUserId);
    }
    return unique;
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
