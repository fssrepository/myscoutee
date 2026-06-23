import type * as ContractTypes from '../../contracts';
import { AppUtils } from '../../../app-utils';
import { PricingBuilder } from './pricing.builder';

export class EventEditorBuilder {
  static cloneEventEditorPolicies(
    items: readonly ContractTypes.EventPolicyDTO[]
  ): ContractTypes.EventPolicyDTO[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      description: `${item.description ?? ''}`.trim(),
      required: item.required !== false
    })).filter(item => item.id || item.title || item.description);
  }

  static buildCreatedEventEditorId(
    target: ContractTypes.EventEditorTarget,
    timestampMs = Date.now()
  ): string {
    return target === 'hosting' ? `h${timestampMs}` : `e${timestampMs}`;
  }

  static cloneEventEditorSubEvents(
    items: readonly ContractTypes.SubEventDTO[]
  ): ContractTypes.SubEventDTO[] {
    return items.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group })),
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
    }));
  }

  static cloneEventEditorSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplateDTO[]
  ): ContractTypes.EventSlotTemplateDTO[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      overrideDate: this.normalizeEventEditorSlotOverrideDate(item.overrideDate),
      closed: item.closed === true
    }));
  }

  static sortEventEditorSubEventRefsByStartAsc<T extends Pick<ContractTypes.SubEventDTO, 'startAt'>>(
    items: readonly T[]
  ): T[] {
    return [...items]
      .map((item, index) => ({
        item,
        index,
        startMs: new Date(item.startAt ?? '').getTime()
      }))
      .sort((a, b) => {
        const aTime = Number.isNaN(a.startMs) ? Number.POSITIVE_INFINITY : a.startMs;
        const bTime = Number.isNaN(b.startMs) ? Number.POSITIVE_INFINITY : b.startMs;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }

  static firstEventEditorSubEventByOrder<T extends Pick<ContractTypes.SubEventDTO, 'startAt'>>(
    items: readonly T[]
  ): T | null {
    return this.sortEventEditorSubEventRefsByStartAsc(items)[0] ?? null;
  }

  static withFirstEventEditorSubEventLocation(
    items: readonly ContractTypes.SubEventDTO[],
    location: string
  ): ContractTypes.SubEventDTO[] {
    if (items.length === 0) {
      return [];
    }
    const first = this.firstEventEditorSubEventByOrder(items);
    if (!first?.id) {
      return this.cloneEventEditorSubEvents(items);
    }
    const normalizedLocation = this.normalizeEventEditorLocation(location);
    return items.map(item => item.id === first.id
      ? { ...item, location: normalizedLocation, groups: (item.groups ?? []).map(group => ({ ...group })) }
      : { ...item, groups: (item.groups ?? []).map(group => ({ ...group })) });
  }

  static normalizedEventEditorCapacityRange(
    capacityMin: unknown,
    capacityMax: unknown
  ): ContractTypes.EventCapacityRange {
    const min = this.normalizedEventEditorCapacityValueWithFloor(capacityMin, 0);
    const maxCandidate = this.normalizedEventEditorCapacityValueWithFloor(capacityMax, 0);
    const max = min !== null && maxCandidate !== null
      ? Math.max(min, maxCandidate)
      : (maxCandidate ?? min);
    return {
      min,
      max
    };
  }

  static normalizedEventEditorCapacityValueWithFloor(value: unknown, floor: number): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(floor, Math.trunc(parsed));
  }

  static buildPersistedEventEditorSubEvents(
    items: readonly ContractTypes.SubEventDTO[]
  ): ContractTypes.SubEventDTO[] {
    return items.map((item, index) => {
      const capacityMin = Math.max(0, Math.trunc(Number(item.capacityMin) || 0));
      const capacityMax = Math.max(capacityMin, Math.trunc(Number(item.capacityMax) || capacityMin));

      return {
        id: item.id?.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: `${item.startAt ?? ''}`.trim(),
        endAt: `${item.endAt ?? ''}`.trim(),
        location: this.normalizeEventEditorLocation(item.location),
        optional: Boolean(item.optional),
        pricing: item.pricing
          ? PricingBuilder.compactPricingConfig(item.pricing, { context: 'subevent', allowSlotFeatures: false })
          : undefined,
        capacityMin,
        capacityMax,
        tournamentGroupCount: Number.isFinite(Number(item.tournamentGroupCount))
          ? Math.max(0, Math.trunc(Number(item.tournamentGroupCount)))
          : undefined,
        tournamentGroupCapacityMin: Number.isFinite(Number(item.tournamentGroupCapacityMin))
          ? Math.max(0, Math.trunc(Number(item.tournamentGroupCapacityMin)))
          : undefined,
        tournamentGroupCapacityMax: Number.isFinite(Number(item.tournamentGroupCapacityMax))
          ? Math.max(0, Math.trunc(Number(item.tournamentGroupCapacityMax)))
          : undefined,
        tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: Number.isFinite(Number(item.tournamentAdvancePerGroup))
          ? Math.max(0, Math.trunc(Number(item.tournamentAdvancePerGroup)))
          : undefined,
        stageStatus: `${item.stageStatus ?? ''}`.trim() || undefined,
        stageStatusReason: `${item.stageStatusReason ?? ''}`.trim() || undefined,
        stageStatusUpdatedAt: `${item.stageStatusUpdatedAt ?? ''}`.trim() || undefined,
        stageFinalizedAt: `${item.stageFinalizedAt ?? ''}`.trim() || undefined,
        stageFinalizedByUserId: `${item.stageFinalizedByUserId ?? ''}`.trim() || undefined,
        groups: (item.groups ?? []).map((group, groupIndex) => {
          const groupCapacityMin = Number.isFinite(Number(group.capacityMin))
            ? Math.max(0, Math.trunc(Number(group.capacityMin)))
            : undefined;
          const groupCapacityMax = Number.isFinite(Number(group.capacityMax))
            ? Math.max(groupCapacityMin ?? 0, Math.trunc(Number(group.capacityMax)))
            : groupCapacityMin;
          return {
            id: group.id?.trim() || `group-${index + 1}-${groupIndex + 1}`,
            name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
            source: group.source === 'manual' ? 'manual' : 'generated',
            capacityMin: groupCapacityMin,
            capacityMax: groupCapacityMax
          };
        }),
        membersAccepted: Math.max(0, Math.trunc(Number(item.membersAccepted) || 0)),
        membersPending: Math.max(0, Math.trunc(Number(item.membersPending) || 0)),
        carsPending: Math.max(0, Math.trunc(Number(item.carsPending) || 0)),
        accommodationPending: Math.max(0, Math.trunc(Number(item.accommodationPending) || 0)),
        suppliesPending: Math.max(0, Math.trunc(Number(item.suppliesPending) || 0)),
        carsAccepted: Number.isFinite(Number(item.carsAccepted))
          ? Math.max(0, Math.trunc(Number(item.carsAccepted)))
          : undefined,
        accommodationAccepted: Number.isFinite(Number(item.accommodationAccepted))
          ? Math.max(0, Math.trunc(Number(item.accommodationAccepted)))
          : undefined,
        suppliesAccepted: Number.isFinite(Number(item.suppliesAccepted))
          ? Math.max(0, Math.trunc(Number(item.suppliesAccepted)))
          : undefined,
        carsCapacityMin: Number.isFinite(Number(item.carsCapacityMin))
          ? Math.max(0, Math.trunc(Number(item.carsCapacityMin)))
          : undefined,
        carsCapacityMax: Number.isFinite(Number(item.carsCapacityMax))
          ? Math.max(0, Math.trunc(Number(item.carsCapacityMax)))
          : undefined,
        accommodationCapacityMin: Number.isFinite(Number(item.accommodationCapacityMin))
          ? Math.max(0, Math.trunc(Number(item.accommodationCapacityMin)))
          : undefined,
        accommodationCapacityMax: Number.isFinite(Number(item.accommodationCapacityMax))
          ? Math.max(0, Math.trunc(Number(item.accommodationCapacityMax)))
          : undefined,
        suppliesCapacityMin: Number.isFinite(Number(item.suppliesCapacityMin))
          ? Math.max(0, Math.trunc(Number(item.suppliesCapacityMin)))
          : undefined,
        suppliesCapacityMax: Number.isFinite(Number(item.suppliesCapacityMax))
          ? Math.max(0, Math.trunc(Number(item.suppliesCapacityMax)))
          : undefined,
        slotStartOffsetMinutes: Number.isFinite(Number(item.slotStartOffsetMinutes))
          ? Math.max(0, Math.trunc(Number(item.slotStartOffsetMinutes)))
          : undefined,
        slotDurationMinutes: Number.isFinite(Number(item.slotDurationMinutes))
          ? Math.max(0, Math.trunc(Number(item.slotDurationMinutes)))
          : undefined
      };
    });
  }

  static buildPersistedEventEditorSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplateDTO[]
  ): ContractTypes.EventSlotTemplateDTO[] {
    return items.map((item, index) => {
      if (item.closed === true) {
        return {
          id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
          startAt: '',
          endAt: '',
          overrideDate: this.normalizeEventEditorSlotOverrideDate(item.overrideDate),
          closed: true
        };
      }
      const normalizedStart = `${item.startAt ?? ''}`.trim();
      const parsedStart = AppUtils.parseDate(normalizedStart) ?? new Date();
      const normalizedEnd = `${item.endAt ?? ''}`.trim();
      const parsedEndRaw = AppUtils.parseDate(normalizedEnd) ?? new Date(parsedStart.getTime() + (60 * 60 * 1000));
      const parsedEnd = parsedEndRaw.getTime() <= parsedStart.getTime()
        ? new Date(parsedStart.getTime() + (60 * 60 * 1000))
        : parsedEndRaw;
      const overrideDate = this.normalizeEventEditorSlotOverrideDate(item.overrideDate);
      const startAt = AppUtils.parseDate(normalizedStart)
        ? normalizedStart
        : AppUtils.toIsoDateTimeLocal(parsedStart);
      const endAt = AppUtils.parseDate(normalizedEnd)
        ? normalizedEnd
        : AppUtils.toIsoDateTimeLocal(parsedEnd);
      return {
        id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
        startAt,
        endAt,
        overrideDate,
        closed: false
      };
    });
  }

  static buildPersistedEventEditorPolicies(
    items: readonly ContractTypes.EventPolicyDTO[]
  ): ContractTypes.EventPolicyDTO[] {
    return items
      .map((item, index) => ({
        id: `${item.id ?? `policy-${index + 1}`}`.trim() || `policy-${index + 1}`,
        title: `${item.title ?? ''}`.trim() || `Policy ${index + 1}`,
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.title.length > 0 || item.description.length > 0);
  }

  static buildEventEditorTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = AppUtils.parseDate(startAt);
    const end = AppUtils.parseDate(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = this.normalizeEventEditorFrequency(frequency);

    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }

    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
  }

  private static normalizeEventEditorLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private static normalizeEventEditorFrequency(value: unknown): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
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

  private static normalizeEventEditorSlotOverrideDate(value: unknown): string | null {
    const parsed = AppUtils.parseDateOnly(value);
    return parsed ? AppUtils.toIsoDate(parsed) : null;
  }
}
