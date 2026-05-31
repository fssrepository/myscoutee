import type * as AppTypes from '../../../core/base/models';
import type { DemoEventCardRecord } from '../../demo/models/events.model';
import {
  ActivityEventInfoCardBuilder,
  type ActivityEventInfoCardOptions
} from '../builders/activity-event-info-card.builder';

export function buildActivityEventRows(
  records: readonly DemoEventCardRecord[],
  options: ActivityEventInfoCardOptions = {}
): AppTypes.ActivityListRow[] {
  return records.map(record => toActivityEventRow(record, options));
}

export function toActivityEventRow(
  record: DemoEventCardRecord,
  options: ActivityEventInfoCardOptions = {}
): AppTypes.ActivityListRow {
  const rowType = resolveActivityEventRowType(record);
  const displayItem = ActivityEventInfoCardBuilder.build(record, {
    ...options,
    rowType
  });
  return {
    ...displayItem,
    id: record.id,
    type: rowType,
    status: record.status,
    title: record.title,
    subtitle: rowType === 'invitations'
      ? record.creatorName
      : record.eventType === 'slot'
        ? `Slot occurrence${record.subtitle ? ' · ' + record.subtitle : ''}`
        : record.subtitle,
    detail: record.timeframe,
    dateIso: record.startAtIso,
    distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
    unread: Math.max(0, Math.trunc(Number(record.activity) || 0)),
    metricScore: Math.max(0, Number(record.boost) || 0),
    isAdmin: record.isAdmin,
    ownerId: record.creatorUserId,
    ownerUserId: record.creatorUserId,
    avatarInitials: record.creatorInitials,
    startAt: record.startAtIso,
    endAt: record.endAtIso,
    boost: record.boost,
    imageUrl: record.imageUrl,
    visibility: record.visibility,
    creatorInitials: record.creatorInitials,
    acceptedMembers: record.acceptedMembers,
    pendingMembers: record.pendingMembers,
    capacityTotal: record.capacityTotal,
    capacityMin: record.capacityMin,
    capacityMax: record.capacityMax,
    isTrashed: record.isTrashed,
    published: record.published
  };
}

function resolveActivityEventRowType(record: DemoEventCardRecord): AppTypes.ActivityListRow['type'] {
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
