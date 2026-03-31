import type * as AppTypes from '../../../../../shared/core/base/models';
import type { InfoCardData, InfoCardMenuAction } from '../../../../../shared/ui';

interface BuildActivitiesEventInfoCardOptions {
  groupLabel?: string | null;
  rowId: string;
  imageUrl: string | null;
  range: { start: Date; end: Date } | null;
  isDraft: boolean;
  isPending: boolean;
  isFull: boolean;
  leadingIcon: string;
  leadingTone: NonNullable<InfoCardData['leadingIcon']>['tone'];
  showSourceIcon: boolean;
  sourceAvatarTone: NonNullable<InfoCardData['mediaStart']>['tone'] | null | undefined;
  sourceAvatarLabel: string;
  capacityLabel: string;
  pendingCount: number;
  menuActions: readonly InfoCardMenuAction[];
}

export function buildActivitiesEventInfoCard(
  row: AppTypes.ActivityListRow,
  options: BuildActivitiesEventInfoCardOptions
): InfoCardData {
  const locationMetaLine = buildActivitiesLocationMetaLine(row);

  return {
    rowId: options.rowId,
    groupLabel: options.groupLabel ?? null,
    title: row.title,
    imageUrl: options.imageUrl,
    placeholderLabel: options.imageUrl ? null : row.title,
    metaRows: [
      buildActivitiesEventDateRangeLabel(row, options.range),
      ...(locationMetaLine ? [locationMetaLine] : [])
    ],
    description: row.subtitle,
    surfaceTone: options.isDraft
      ? 'draft'
      : options.isPending
        ? 'pending'
        : options.isFull
          ? 'full'
          : 'default',
    leadingIcon: {
      icon: options.leadingIcon,
      tone: options.leadingTone
    },
    mediaStart: options.showSourceIcon
      ? {
          variant: 'avatar',
          tone: options.sourceAvatarTone,
          label: options.sourceAvatarLabel,
          interactive: false
        }
      : null,
    mediaEnd: {
      variant: 'badge',
      tone: options.isFull ? 'full' : 'default',
      label: options.capacityLabel,
      ariaLabel: 'Open members',
      interactive: true,
      pendingCount: options.pendingCount
    },
    menuActions: options.menuActions,
    clickable: false
  };
}

function buildActivitiesLocationMetaLine(row: AppTypes.ActivityListRow): string {
  const source = row.source as { location?: string; city?: string; creatorCity?: string };
  const location = source.location?.trim() || source.city?.trim() || source.creatorCity?.trim() || '';
  const distanceLabel = Number.isFinite(Number(row.distanceKm)) ? `${row.distanceKm} km` : '';
  if (location && distanceLabel) {
    return `${location} · ${distanceLabel}`;
  }
  return location || distanceLabel;
}

function buildActivitiesEventDateRangeLabel(
  row: AppTypes.ActivityListRow,
  range: { start: Date; end: Date } | null
): string {
  if (!range) {
    return (row.source as { timeframe?: string })?.timeframe ?? 'Date unavailable';
  }

  const start = range.start;
  const end = range.end;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return (row.source as { timeframe?: string })?.timeframe ?? 'Date unavailable';
  }

  const sameDay = start.toDateString() === end.toDateString();
  const startDateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const startTimeLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTimeLabel = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) {
    return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel}`;
  }

  const endDateLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startDateLabel}, ${startTimeLabel} - ${endDateLabel}, ${endTimeLabel}`;
}
