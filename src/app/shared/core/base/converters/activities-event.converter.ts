import type * as AppTypes from '../../../core/base/models';
import type {
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../interfaces/activity-feed.interface';
import type { DemoEventRecord } from '../../demo/models/events.model';
import {
  ActivityEventInfoCardBuilder,
  type ActivityEventInfoCardOptions
} from '../builders/activity-event-info-card.builder';
import { PricingBuilder } from '../builders/pricing.builder';

export function buildActivityEventRows(
  records: readonly DemoEventRecord[],
  options: ActivityEventInfoCardOptions = {}
): AppTypes.ActivityListRow[] {
  return records.map(record => toActivityEventRow(record, options));
}

export function toActivityEventRowFromMenuItem(
  item: EventMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
    activeUserId?: string | null;
  } = {}
): AppTypes.ActivityListRow {
  const distanceKm = options.distanceKm ?? item.distanceKm ?? 0;
  return withActivityEventInfoCard({
    id: item.id,
    type: 'events',
    title: item.title,
    subtitle: item.shortDescription,
    detail: item.timeframe,
    dateIso: options.dateIso ?? item.startAt ?? '',
    distanceKm,
    distanceMetersExact: resolveDistanceMetersExact(distanceKm),
    unread: item.activity,
    metricScore: (item.isAdmin ? 20 : 0) + item.activity,
    isAdmin: item.isAdmin,
    source: item
  }, options);
}

export function toActivityHostingRowFromMenuItem(
  item: HostingMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
    activeUserId?: string | null;
  } = {}
): AppTypes.ActivityListRow {
  const distanceKm = options.distanceKm ?? item.distanceKm ?? 0;
  return withActivityEventInfoCard({
    id: item.id,
    type: 'hosting',
    title: item.title,
    subtitle: item.shortDescription,
    detail: item.timeframe,
    dateIso: options.dateIso ?? item.startAt ?? '',
    distanceKm,
    distanceMetersExact: resolveDistanceMetersExact(distanceKm),
    unread: item.activity,
    metricScore: 20 + item.activity,
    isAdmin: item.isAdmin,
    source: item
  }, options);
}

export function toActivityInvitationRowFromMenuItem(
  item: InvitationMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
    activeUserId?: string | null;
  } = {}
): AppTypes.ActivityListRow {
  const distanceKm = options.distanceKm ?? item.distanceKm ?? 0;
  return withActivityEventInfoCard({
    id: item.id,
    type: 'invitations',
    title: item.description,
    subtitle: item.inviter,
    detail: item.when,
    dateIso: options.dateIso ?? item.startAt ?? '',
    distanceKm,
    distanceMetersExact: resolveDistanceMetersExact(distanceKm),
    unread: item.unread,
    metricScore: item.unread * 10,
    source: item
  }, options);
}

export function toActivitySourceRowFromMenuItem(
  source: EventMenuItem | HostingMenuItem,
  options: {
    isHosting: boolean;
    dateIso?: string;
    distanceKm?: number;
    metricScore?: number;
    activeUserId?: string | null;
  }
): AppTypes.ActivityListRow {
  const metricScore = typeof options.metricScore === 'number' && Number.isFinite(options.metricScore)
    ? options.metricScore
    : null;
  if (options.isHosting) {
    const row = toActivityHostingRowFromMenuItem(source as HostingMenuItem, {
      dateIso: options.dateIso,
      distanceKm: options.distanceKm,
      activeUserId: options.activeUserId
    });
    return {
      ...row,
      metricScore: metricScore ?? row.metricScore,
      infoCard: ActivityEventInfoCardBuilder.build({
        ...row,
        metricScore: metricScore ?? row.metricScore
      }, options)
    };
  }
  const row = toActivityEventRowFromMenuItem(source as EventMenuItem, {
    dateIso: options.dateIso,
    distanceKm: options.distanceKm,
    activeUserId: options.activeUserId
  });
  return {
    ...row,
    metricScore: metricScore ?? row.metricScore,
    infoCard: ActivityEventInfoCardBuilder.build({
      ...row,
      metricScore: metricScore ?? row.metricScore
    }, options)
  };
}

export function toActivityEventRow(
  record: DemoEventRecord,
  options: ActivityEventInfoCardOptions = {}
): AppTypes.ActivityListRow {
  const rowType = resolveActivityEventRowType(record);
  return withActivityEventInfoCard({
    id: record.id,
    type: rowType,
    title: rowType === 'invitations' ? record.title : record.title,
    subtitle: rowType === 'invitations'
      ? record.creatorName
      : record.eventType === 'slot'
        ? `Slot occurrence${record.subtitle ? ' · ' + record.subtitle : ''}`
        : record.subtitle,
    detail: record.timeframe,
    dateIso: record.startAtIso,
    distanceKm: record.distanceKm,
    distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0)),
    metricScore: Math.max(0, Number(record.boost) || 0),
    isAdmin: record.isAdmin,
    source: rowType === 'invitations'
      ? toInvitationMenuItem(record)
      : rowType === 'hosting'
        ? toHostingMenuItem(record)
        : toEventMenuItem(record)
  }, options);
}

export function withActivityEventInfoCard(
  row: AppTypes.ActivityListRow,
  options: ActivityEventInfoCardOptions = {}
): AppTypes.ActivityListRow {
  return {
    ...row,
    infoCard: ActivityEventInfoCardBuilder.build(row, options)
  };
}

function resolveDistanceMetersExact(distanceKm: number): number {
  return Math.max(0, Math.round((Number(distanceKm) || 0) * 1000));
}

function resolveActivityEventRowType(record: DemoEventRecord): AppTypes.ActivityListRow['type'] {
  const status = normalizeEventStatusCode(record.status);
  if (status === 'INV') {
    return 'invitations';
  }
  if (status === 'H' || status === 'DR') {
    return 'hosting';
  }
  if (record.isInvitation || record.type === 'invitations') {
    return 'invitations';
  }
  if (record.type === 'hosting' || record.isHosting) {
    return 'hosting';
  }
  return 'events';
}

function toEventMenuItem(record: DemoEventRecord): EventMenuItem {
  return {
    id: record.id,
    status: normalizeEventStatusCode(record.status),
    avatar: record.creatorInitials,
    title: record.title,
    shortDescription: record.subtitle,
    timeframe: record.timeframe,
    activity: record.activity,
    isAdmin: record.isAdmin,
    creatorUserId: record.creatorUserId,
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    distanceKm: record.distanceKm,
    acceptedMembers: record.acceptedMembers,
    pendingMembers: record.pendingMembers,
    capacityTotal: record.capacityTotal,
    acceptedMemberUserIds: [...record.acceptedMemberUserIds],
    pendingMemberUserIds: [...record.pendingMemberUserIds],
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    autoInviter: record.autoInviter,
    frequency: record.frequency,
    pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
    slotsEnabled: record.slotsEnabled,
    slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
    parentEventId: record.parentEventId ?? null,
    slotTemplateId: record.slotTemplateId ?? null,
    generated: record.generated,
    eventType: record.eventType,
    nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
    upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
    ticketing: record.ticketing,
    policies: (record.policies ?? []).map(item => ({ ...item })),
    topics: [...record.topics],
    subEvents: (record.subEvents ?? []).map(item => ({
      ...item,
      groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
    })),
    subEventsDisplayMode: record.subEventsDisplayMode,
    rating: record.rating,
    boost: record.boost,
    published: record.published
  };
}

function toHostingMenuItem(record: DemoEventRecord): HostingMenuItem {
  return {
    id: record.id,
    status: normalizeEventStatusCode(record.status),
    avatar: record.creatorInitials,
    title: record.title,
    shortDescription: record.subtitle,
    timeframe: record.timeframe,
    activity: record.activity,
    creatorUserId: record.creatorUserId,
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    distanceKm: record.distanceKm,
    acceptedMembers: record.acceptedMembers,
    pendingMembers: record.pendingMembers,
    capacityTotal: record.capacityTotal,
    acceptedMemberUserIds: [...record.acceptedMemberUserIds],
    pendingMemberUserIds: [...record.pendingMemberUserIds],
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    autoInviter: record.autoInviter,
    frequency: record.frequency,
    pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
    slotsEnabled: record.slotsEnabled,
    slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
    parentEventId: record.parentEventId ?? null,
    slotTemplateId: record.slotTemplateId ?? null,
    generated: record.generated,
    eventType: record.eventType,
    nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
    upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
    ticketing: record.ticketing,
    policies: (record.policies ?? []).map(item => ({ ...item })),
    topics: [...record.topics],
    subEvents: (record.subEvents ?? []).map(item => ({
      ...item,
      groups: Array.isArray(item.groups) ? item.groups.map(group => ({ ...group })) : [],
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined
    })),
    subEventsDisplayMode: record.subEventsDisplayMode,
    rating: record.rating,
    boost: record.boost,
    published: record.published,
    isAdmin: record.isAdmin
  };
}

function toInvitationMenuItem(record: DemoEventRecord): InvitationMenuItem {
  return {
    id: record.id,
    status: normalizeEventStatusCode(record.status),
    avatar: record.creatorInitials,
    inviter: record.creatorName,
    description: record.title,
    when: record.timeframe,
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0)),
    creatorUserId: record.creatorUserId,
    creatorName: record.creatorName,
    acceptedMembers: record.acceptedMembers,
    pendingMembers: record.pendingMembers,
    capacityTotal: record.capacityTotal,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    acceptedMemberUserIds: [...record.acceptedMemberUserIds],
    pendingMemberUserIds: [...record.pendingMemberUserIds],
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    distanceKm: record.distanceKm,
    distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    locationCoordinates: record.locationCoordinates ?? undefined,
    policies: (record.policies ?? []).map(item => ({ ...item }))
  };
}

function normalizeEventStatusCode(status: string | null | undefined): string {
  const normalized = `${status ?? ''}`.trim();
  switch (normalized) {
    case 'active':
      return 'A';
    case 'hosting':
      return 'H';
    case 'invitation':
      return 'INV';
    case 'draft':
      return 'DR';
    case 'trashed':
    case 'trash':
      return 'T';
    case 'under-review':
    case 'under review':
      return 'UR';
    case 'blocked':
      return 'B';
    case 'deleted':
      return 'D';
    case 'inactive':
      return 'I';
    default:
      return normalized || 'A';
  }
}
