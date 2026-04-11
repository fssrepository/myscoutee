import type * as AppTypes from '../models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { AppUtils } from '../../../app-utils';
import { EventEditorConverter } from '../converters/event-editor.converter';
import { PricingBuilder } from './pricing.builder';

export class EventEditorBuilder {
  static buildCreatedEventEditorId(
    target: AppTypes.EventEditorTarget,
    timestampMs = Date.now()
  ): string {
    return target === 'hosting' ? `h${timestampMs}` : `e${timestampMs}`;
  }

  static cloneEventEditorSubEvents(
    items: readonly AppTypes.EventEditorSubEventItem[]
  ): AppTypes.EventEditorSubEventItem[] {
    return items.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group })),
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
    }));
  }

  static cloneEventEditorSlotTemplates(
    items: readonly AppTypes.EventSlotTemplate[]
  ): AppTypes.EventSlotTemplate[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      overrideDate: EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate),
      closed: item.closed === true
    }));
  }

  static sortEventEditorSubEventRefsByStartAsc(
    items: readonly AppTypes.EventEditorSubEventItem[]
  ): AppTypes.EventEditorSubEventItem[] {
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

  static firstEventEditorSubEventByOrder(
    items: readonly AppTypes.EventEditorSubEventItem[]
  ): AppTypes.EventEditorSubEventItem | null {
    return this.sortEventEditorSubEventRefsByStartAsc(items)[0] ?? null;
  }

  static withFirstEventEditorSubEventLocation(
    items: readonly AppTypes.EventEditorSubEventItem[],
    location: string
  ): AppTypes.EventEditorSubEventItem[] {
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
      : { ...item, groups: (item.groups ?? []).map(group => ({ ...group })) });
  }

  static normalizedEventEditorCapacityRange(
    form: Pick<AppTypes.EventEditorDraftForm, 'capacityMin' | 'capacityMax'>
  ): AppTypes.EventCapacityRange {
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
    items: readonly AppTypes.EventEditorSubEventItem[]
  ): AppTypes.SubEventFormItem[] {
    return items.map((item, index) => {
      const rawItem = item as AppTypes.EventEditorSubEventItem & Record<string, unknown>;
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
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined,
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
          : undefined
      };
    });
  }

  static buildPersistedEventEditorSlotTemplates(
    items: readonly AppTypes.EventSlotTemplate[]
  ): AppTypes.EventSlotTemplate[] {
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
        startAt: overrideDate
          ? AppUtils.applyDatePartToIsoLocal(startAt, EventEditorConverter.parseEventEditorOverrideDate(overrideDate))
          : startAt,
        endAt: overrideDate
          ? AppUtils.applyDatePartToIsoLocal(endAt, EventEditorConverter.parseEventEditorOverrideDate(overrideDate))
          : endAt,
        overrideDate,
        closed: false
      };
    });
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

  static buildEventEditorSyncPayload(params: {
    eventId: string;
    target: AppTypes.EventEditorTarget;
    form: AppTypes.EventEditorDraftForm;
    subEventsDisplayMode: AppTypes.SubEventsDisplayMode;
    acceptedMembers: number;
    pendingMembers: number;
    capacityTotal: number;
    existingRecord: DemoEventRecord | null;
    activeUserId: string | null;
    activeUserProfile: {
      name?: string;
      initials?: string;
      gender?: 'woman' | 'man';
      city?: string;
    } | null;
    acceptedMemberUserIds: readonly string[];
    pendingMemberUserIds: readonly string[];
  }): Omit<AppTypes.ActivitiesEventSyncPayload, 'syncKey'> {
    return {
      id: params.eventId,
      target: params.target,
      title: params.form.title.trim(),
      shortDescription: params.form.description.trim(),
      timeframe: this.buildEventEditorTimeframeLabel(params.form.startAt, params.form.endAt, params.form.frequency),
      activity: params.existingRecord?.activity ?? 0,
      isAdmin: params.existingRecord?.isAdmin ?? (params.target === 'hosting'),
      startAt: params.form.startAt,
      endAt: params.form.endAt,
      distanceKm: params.existingRecord?.distanceKm ?? 0,
      imageUrl: params.form.imageUrl || params.existingRecord?.imageUrl || '',
      acceptedMembers: params.acceptedMembers,
      pendingMembers: params.pendingMembers,
      capacityTotal: Math.max(params.acceptedMembers, params.capacityTotal),
      capacityMin: params.form.capacityMin,
      capacityMax: params.form.capacityMax,
      autoInviter: params.form.autoInviter,
      frequency: params.form.frequency,
      ticketing: params.form.ticketing,
      pricing: PricingBuilder.syncSlotOverrides(
        params.form.pricing,
        PricingBuilder.slotCatalogFromEventSlotTemplates(this.buildPersistedEventEditorSlotTemplates(params.form.slotTemplates))
      ),
      slotsEnabled: params.form.slotsEnabled,
      slotTemplates: this.buildPersistedEventEditorSlotTemplates(params.form.slotTemplates),
      visibility: params.form.visibility,
      blindMode: params.form.blindMode,
      published: params.target === 'hosting'
        ? (params.existingRecord?.published ?? false)
        : true,
      creatorUserId: params.existingRecord?.creatorUserId ?? params.activeUserId ?? undefined,
      creatorName: params.existingRecord?.creatorName ?? params.activeUserProfile?.name,
      creatorInitials: params.existingRecord?.creatorInitials ?? params.activeUserProfile?.initials,
      creatorGender: params.existingRecord?.creatorGender ?? params.activeUserProfile?.gender,
      creatorCity: params.existingRecord?.creatorCity ?? params.activeUserProfile?.city,
      location: params.form.location.trim(),
      locationCoordinates: params.existingRecord?.locationCoordinates ?? undefined,
      sourceLink: params.existingRecord?.sourceLink ?? '',
      parentEventId: params.existingRecord?.parentEventId ?? null,
      slotTemplateId: params.existingRecord?.slotTemplateId ?? null,
      generated: params.existingRecord?.generated ?? false,
      eventType: params.existingRecord?.eventType ?? 'main',
      acceptedMemberUserIds: Array.from(new Set(params.acceptedMemberUserIds.filter(id => id.trim().length > 0))),
      pendingMemberUserIds: Array.from(new Set(params.pendingMemberUserIds.filter(id => id.trim().length > 0))),
      topics: [...params.form.topics],
      subEvents: this.buildPersistedEventEditorSubEvents(params.form.subEvents),
      subEventsDisplayMode: params.subEventsDisplayMode
    };
  }
}
