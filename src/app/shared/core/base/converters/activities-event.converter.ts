import type * as AppTypes from '../../../app-types';
import type {
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../../../demo-data';
import type { DemoEventRecord } from '../../demo/models/events.model';

export function buildActivityEventRows(records: readonly DemoEventRecord[]): AppTypes.ActivityListRow[] {
  return records.map(record => toActivityEventRow(record));
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
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
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
    visibility: record.visibility,
    blindMode: record.blindMode,
    imageUrl: record.imageUrl,
    sourceLink: record.sourceLink,
    location: record.location,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
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
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0))
  };
}
