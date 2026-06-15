import type * as AppTypes from '../../../core/base/models';
import type { ActivityEventCardRecord } from '../../contracts/activity.interface';
import {
  ActivityEventInfoCardBuilder,
  type ActivityEventInfoCardOptions
} from '../builders/activity-event-info-card.builder';

export function toActivityEventRow(
  record: ActivityEventCardRecord,
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
    isTrashed: record.isTrashed
  };
}

function resolveActivityEventRowType(record: ActivityEventCardRecord): AppTypes.ActivityListRow['type'] {
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
    case 'A':
      return 'A';
    case 'DR':
      return 'DR';
    case 'T':
      return 'T';
    case 'UR':
      return 'UR';
    case 'B':
      return 'B';
    case 'D':
      return 'D';
    case 'I':
      return 'I';
    default:
      return 'A';
  }
}
