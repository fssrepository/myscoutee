import type * as AppTypes from '../../../core/base/models';
import type { ActivityEventDTO } from '../../contracts/activity.interface';
import {
  ActivityEventRowInfoCardConverter,
  type ActivityEventRowInfoCardConverterOptions
} from './activity-event-row-info-card.converter';

export function toActivityEventRow(
  dto: ActivityEventDTO,
  options: ActivityEventRowInfoCardConverterOptions = {}
): AppTypes.ActivityListRow {
  const rowType = resolveActivityEventRowType(dto);
  const displayItem = ActivityEventRowInfoCardConverter.convert(dto, {
    ...options,
    rowType
  });
  return {
    ...displayItem,
    id: dto.id,
    type: rowType,
    status: dto.status,
    title: dto.title,
    subtitle: rowType === 'invitations'
      ? dto.creatorName
      : dto.eventType === 'slot'
        ? `Slot occurrence${dto.subtitle ? ' · ' + dto.subtitle : ''}`
        : dto.subtitle,
    detail: dto.timeframe,
    dateIso: dto.startAtIso,
    distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
    unread: Math.max(0, Math.trunc(Number(dto.activity) || 0)),
    metricScore: Math.max(0, Number(dto.boost) || 0),
    isAdmin: isActivityEventAdmin(dto),
    ownerId: dto.creatorUserId,
    ownerUserId: dto.creatorUserId,
    avatarInitials: dto.creatorInitials,
    startAt: dto.startAtIso,
    endAt: dto.endAtIso,
    boost: dto.boost,
    imageUrl: dto.imageUrl,
    visibility: dto.visibility,
    creatorInitials: dto.creatorInitials,
    acceptedMembers: dto.acceptedMembers,
    pendingMembers: dto.pendingMembers,
    capacityTotal: dto.capacityTotal,
    capacityMin: dto.capacityMin,
    capacityMax: dto.capacityMax,
    isTrashed: isActivityEventTrashed(dto)
  };
}

function resolveActivityEventRowType(dto: ActivityEventDTO): AppTypes.ActivityInfoCardRow['type'] {
  if (dto.type === 'invitations') {
    return 'invitations';
  }
  if (dto.type === 'hosting') {
    return 'hosting';
  }
  return 'events';
}

function isActivityEventAdmin(dto: ActivityEventDTO): boolean {
  const userId = `${dto.userId ?? ''}`.trim();
  return !!userId && (
    dto.creatorUserId === userId
    || (dto.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === userId)
  );
}

function isActivityEventTrashed(dto: ActivityEventDTO): boolean {
  return normalizeEventStatusCode(dto.status) === 'T';
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
