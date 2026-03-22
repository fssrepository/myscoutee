import type * as AppTypes from '../../../core/base/models';
import type {
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../interfaces/activity-feed.interface';
import type { DemoEventRecord } from '../../demo/models/events.model';

export function buildActivityEventRows(records: readonly DemoEventRecord[]): AppTypes.ActivityListRow[] {
  return records.map(record => toActivityEventRow(record));
}

export function toActivityEventRowFromMenuItem(
  item: EventMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
  } = {}
): AppTypes.ActivityListRow {
  return {
    id: item.id,
    type: 'events',
    title: item.title,
    subtitle: item.shortDescription,
    detail: item.timeframe,
    dateIso: options.dateIso ?? '2026-03-01T09:00:00',
    distanceKm: options.distanceKm ?? 10,
    distanceMetersExact: resolveDistanceMetersExact(options.distanceKm ?? 10),
    unread: item.activity,
    metricScore: (item.isAdmin ? 20 : 0) + item.activity,
    isAdmin: item.isAdmin,
    source: item
  };
}

export function toActivityHostingRowFromMenuItem(
  item: HostingMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
  } = {}
): AppTypes.ActivityListRow {
  return {
    id: item.id,
    type: 'hosting',
    title: item.title,
    subtitle: item.shortDescription,
    detail: item.timeframe,
    dateIso: options.dateIso ?? '2026-03-01T09:00:00',
    distanceKm: options.distanceKm ?? 10,
    distanceMetersExact: resolveDistanceMetersExact(options.distanceKm ?? 10),
    unread: item.activity,
    metricScore: 20 + item.activity,
    isAdmin: true,
    source: item
  };
}

export function toActivityInvitationRowFromMenuItem(
  item: InvitationMenuItem,
  options: {
    dateIso?: string;
    distanceKm?: number;
  } = {}
): AppTypes.ActivityListRow {
  return {
    id: item.id,
    type: 'invitations',
    title: item.description,
    subtitle: item.inviter,
    detail: item.when,
    dateIso: options.dateIso ?? item.startAt ?? '2026-02-21T09:00:00',
    distanceKm: options.distanceKm ?? item.distanceKm ?? 5,
    distanceMetersExact: resolveDistanceMetersExact(options.distanceKm ?? item.distanceKm ?? 5),
    unread: item.unread,
    metricScore: item.unread * 10,
    source: item
  };
}

export function toActivitySourceRowFromMenuItem(
  source: EventMenuItem | HostingMenuItem,
  options: {
    isHosting: boolean;
    dateIso?: string;
    distanceKm?: number;
    metricScore?: number;
  }
): AppTypes.ActivityListRow {
  const metricScore = typeof options.metricScore === 'number' && Number.isFinite(options.metricScore)
    ? options.metricScore
    : null;
  if (options.isHosting) {
    const row = toActivityHostingRowFromMenuItem(source as HostingMenuItem, {
      dateIso: options.dateIso,
      distanceKm: options.distanceKm
    });
    return {
      ...row,
      metricScore: metricScore ?? row.metricScore
    };
  }
  const row = toActivityEventRowFromMenuItem(source as EventMenuItem, {
    dateIso: options.dateIso,
    distanceKm: options.distanceKm
  });
  return {
    ...row,
    metricScore: metricScore ?? row.metricScore
  };
}

export function toActivityEventRow(record: DemoEventRecord): AppTypes.ActivityListRow {
  const rowType = resolveActivityEventRowType(record);
  return {
    id: record.id,
    type: rowType,
    title: rowType === 'invitations' ? record.title : record.title,
    subtitle: rowType === 'invitations' ? record.creatorName : record.subtitle,
    detail: record.timeframe,
    dateIso: record.startAtIso,
    distanceKm: record.distanceKm,
    distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0)),
    metricScore: Math.max(0, Number(record.relevance) || 0),
    isAdmin: rowType === 'hosting' ? true : record.isAdmin,
    source: rowType === 'invitations'
      ? toInvitationMenuItem(record)
      : rowType === 'hosting'
        ? toHostingMenuItem(record)
        : toEventMenuItem(record)
  };
}

function resolveDistanceMetersExact(distanceKm: number): number {
  return Math.max(0, Math.round((Number(distanceKm) || 0) * 1000));
}

function resolveActivityEventRowType(record: DemoEventRecord): AppTypes.ActivityListRow['type'] {
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
    acceptedMemberUserIds: [...record.acceptedMemberUserIds],
    pendingMemberUserIds: [...record.pendingMemberUserIds],
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    ticketing: record.ticketing,
    topics: [...record.topics],
    rating: record.rating,
    relevance: record.relevance,
    published: record.published
  };
}

function toHostingMenuItem(record: DemoEventRecord): HostingMenuItem {
  return {
    id: record.id,
    avatar: record.creatorInitials,
    title: record.title,
    shortDescription: record.subtitle,
    timeframe: record.timeframe,
    activity: record.activity,
    creatorUserId: record.creatorUserId,
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    distanceKm: record.distanceKm,
    acceptedMemberUserIds: [...record.acceptedMemberUserIds],
    pendingMemberUserIds: [...record.pendingMemberUserIds],
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    ticketing: record.ticketing,
    topics: [...record.topics],
    rating: record.rating,
    relevance: record.relevance,
    published: record.published
  };
}

function toInvitationMenuItem(record: DemoEventRecord): InvitationMenuItem {
  return {
    id: record.id,
    avatar: record.creatorInitials,
    inviter: record.creatorName,
    description: record.title,
    when: record.timeframe,
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0)),
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    distanceKm: record.distanceKm,
    distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    locationCoordinates: record.locationCoordinates ?? undefined
  };
}
