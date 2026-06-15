import type * as ContractTypes from '../../contracts';
import { AppUtils } from '../../../app-utils';
import { EventEditorConverter } from '../converters/event-editor.converter';
import { PricingBuilder } from './pricing.builder';

interface EventEditorSubEventGroupInput {
  id?: string;
  name?: string;
  source?: string;
  capacityMin?: unknown;
  capacityMax?: unknown;
}

interface EventEditorSubEventInput {
  description?: string;
  id?: string;
  name?: string;
  title?: string;
  location?: string;
  optional?: boolean;
  startAt?: string;
  endAt?: string;
  capacityMin?: unknown;
  capacityMax?: unknown;
  groups?: readonly EventEditorSubEventGroupInput[];
  membersPending?: unknown;
  membersAccepted?: unknown;
  pricing?: ContractTypes.PricingConfig | null;
  carsPending?: unknown;
  accommodationPending?: unknown;
  suppliesPending?: unknown;
  slotStartOffsetMinutes?: unknown;
  slotDurationMinutes?: unknown;
}

interface EventEditorCapacityInput {
  capacityMin: unknown;
  capacityMax: unknown;
}

export class EventEditorBuilder {
  static cloneEventEditorPolicies(
    items: readonly ContractTypes.EventPolicyItem[]
  ): ContractTypes.EventPolicyItem[] {
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

  static cloneEventEditorSubEvents<T extends EventEditorSubEventInput>(
    items: readonly T[]
  ): T[] {
    return items.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group })),
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
    }) as T);
  }

  static cloneEventEditorSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplate[]
  ): ContractTypes.EventSlotTemplate[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      overrideDate: EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate),
      closed: item.closed === true
    }));
  }

  static sortEventEditorSubEventRefsByStartAsc<T extends EventEditorSubEventInput>(
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

  static firstEventEditorSubEventByOrder<T extends EventEditorSubEventInput>(
    items: readonly T[]
  ): T | null {
    return this.sortEventEditorSubEventRefsByStartAsc(items)[0] ?? null;
  }

  static withFirstEventEditorSubEventLocation<T extends EventEditorSubEventInput>(
    items: readonly T[],
    location: string
  ): T[] {
    if (items.length === 0) {
      return [];
    }
    const first = this.firstEventEditorSubEventByOrder(items);
    if (!first?.id) {
      return this.cloneEventEditorSubEvents(items);
    }
    const normalizedLocation = EventEditorConverter.normalizeEventEditorLocation(location);
    return items.map(item => item.id === first.id
      ? { ...item, location: normalizedLocation, groups: (item.groups ?? []).map(group => ({ ...group })) }
      : { ...item, groups: (item.groups ?? []).map(group => ({ ...group })) }) as T[];
  }

  static normalizedEventEditorCapacityRange(
    form: EventEditorCapacityInput
  ): ContractTypes.EventCapacityRange {
    const min = this.normalizedEventEditorCapacityValueWithFloor(form.capacityMin, 0);
    const maxCandidate = this.normalizedEventEditorCapacityValueWithFloor(form.capacityMax, 0);
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
    items: readonly EventEditorSubEventInput[]
  ): ContractTypes.SubEventFormItem[] {
    return items.map((item, index) => {
      const rawItem = item as EventEditorSubEventInput & Record<string, unknown>;
      const capacityMin = Math.max(0, Math.trunc(Number(item.capacityMin) || 0));
      const capacityMax = Math.max(capacityMin, Math.trunc(Number(item.capacityMax) || capacityMin));

      return {
        id: item.id?.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? item.title ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: `${item.startAt ?? ''}`.trim(),
        endAt: `${item.endAt ?? ''}`.trim(),
        location: EventEditorConverter.normalizeEventEditorLocation(item.location),
        optional: Boolean(item.optional),
        pricing: item.pricing
          ? PricingBuilder.compactPricingConfig(item.pricing, { context: 'subevent', allowSlotFeatures: false })
          : undefined,
        capacityMin,
        capacityMax,
        tournamentGroupCount: Number.isFinite(Number(rawItem['tournamentGroupCount']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCount'])))
          : undefined,
        tournamentGroupCapacityMin: Number.isFinite(Number(rawItem['tournamentGroupCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCapacityMin'])))
          : undefined,
        tournamentGroupCapacityMax: Number.isFinite(Number(rawItem['tournamentGroupCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCapacityMax'])))
          : undefined,
        tournamentLeaderboardType: rawItem['tournamentLeaderboardType'] === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: Number.isFinite(Number(rawItem['tournamentAdvancePerGroup']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentAdvancePerGroup'])))
          : undefined,
        stageStatus: `${rawItem['stageStatus'] ?? ''}`.trim() || undefined,
        stageStatusReason: `${rawItem['stageStatusReason'] ?? ''}`.trim() || undefined,
        stageStatusUpdatedAt: `${rawItem['stageStatusUpdatedAt'] ?? ''}`.trim() || undefined,
        stageFinalizedAt: `${rawItem['stageFinalizedAt'] ?? ''}`.trim() || undefined,
        stageFinalizedByUserId: `${rawItem['stageFinalizedByUserId'] ?? ''}`.trim() || undefined,
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
        carsAccepted: Number.isFinite(Number(rawItem['carsAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsAccepted'])))
          : undefined,
        accommodationAccepted: Number.isFinite(Number(rawItem['accommodationAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationAccepted'])))
          : undefined,
        suppliesAccepted: Number.isFinite(Number(rawItem['suppliesAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesAccepted'])))
          : undefined,
        carsCapacityMin: Number.isFinite(Number(rawItem['carsCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsCapacityMin'])))
          : undefined,
        carsCapacityMax: Number.isFinite(Number(rawItem['carsCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsCapacityMax'])))
          : undefined,
        accommodationCapacityMin: Number.isFinite(Number(rawItem['accommodationCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationCapacityMin'])))
          : undefined,
        accommodationCapacityMax: Number.isFinite(Number(rawItem['accommodationCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationCapacityMax'])))
          : undefined,
        suppliesCapacityMin: Number.isFinite(Number(rawItem['suppliesCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesCapacityMin'])))
          : undefined,
        suppliesCapacityMax: Number.isFinite(Number(rawItem['suppliesCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesCapacityMax'])))
          : undefined,
        slotStartOffsetMinutes: Number.isFinite(Number(rawItem['slotStartOffsetMinutes']))
          ? Math.max(0, Math.trunc(Number(rawItem['slotStartOffsetMinutes'])))
          : undefined,
        slotDurationMinutes: Number.isFinite(Number(rawItem['slotDurationMinutes']))
          ? Math.max(0, Math.trunc(Number(rawItem['slotDurationMinutes'])))
          : undefined
      };
    });
  }

  static buildPersistedEventEditorSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplate[]
  ): ContractTypes.EventSlotTemplate[] {
    return items.map((item, index) => {
      if (item.closed === true) {
        return {
          id: `${item.id ?? `slot-${index + 1}`}`.trim() || `slot-${index + 1}`,
          startAt: '',
          endAt: '',
          overrideDate: EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate),
          closed: true
        };
      }
      const normalizedStart = `${item.startAt ?? ''}`.trim();
      const parsedStart = EventEditorConverter.parseEventEditorDateValue(normalizedStart) ?? new Date();
      const normalizedEnd = `${item.endAt ?? ''}`.trim();
      const parsedEndRaw = EventEditorConverter.parseEventEditorDateValue(normalizedEnd) ?? new Date(parsedStart.getTime() + (60 * 60 * 1000));
      const parsedEnd = parsedEndRaw.getTime() <= parsedStart.getTime()
        ? new Date(parsedStart.getTime() + (60 * 60 * 1000))
        : parsedEndRaw;
      const overrideDate = EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate);
      const startAt = EventEditorConverter.parseEventEditorDateValue(normalizedStart)
        ? normalizedStart
        : AppUtils.toIsoDateTimeLocal(parsedStart);
      const endAt = EventEditorConverter.parseEventEditorDateValue(normalizedEnd)
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
    items: readonly ContractTypes.EventPolicyItem[]
  ): ContractTypes.EventPolicyItem[] {
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
    const start = EventEditorConverter.parseEventEditorDateValue(startAt);
    const end = EventEditorConverter.parseEventEditorDateValue(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = EventEditorConverter.normalizeEventEditorFrequency(frequency);

    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }

    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
  }
}
