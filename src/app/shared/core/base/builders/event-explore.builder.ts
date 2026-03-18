import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../app-types';
import type { InfoCardData, InfoCardMenuAction } from '../../../ui';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { toActivityEventRow } from '../converters/activities-event.converter';

export function buildEventExploreInfoCard(
  record: DemoEventRecord,
  options: {
    groupLabel?: string | null;
    resolveTopicToneClass?: (topic: string) => string;
  } = {}
): InfoCardData {
  const openEvent = isEventExploreOpenEvent(record);
  const full = isEventExploreFull(record);
  const visibility = record.visibility;

  return {
    rowId: record.id,
    groupLabel: options.groupLabel ?? null,
    title: record.title,
    imageUrl: record.imageUrl,
    metaRows: [
      `${eventExploreTypeLabel(record)} · ${visibility} · ${eventExploreDistanceLabel(record)}`
    ],
    description: record.subtitle,
    detailRows: [record.timeframe],
    detailStyle: 'mono',
    footerChips: record.topics.map(topic => ({
      label: `#${eventExploreTopicLabel(topic)}`,
      toneClass: options.resolveTopicToneClass?.(topic) ?? ''
    })),
    surfaceTone: full ? 'full' : 'default',
    leadingIcon: {
      icon: eventVisibilityIcon(visibility),
      tone: eventExploreVisibilityTone(record)
    },
    mediaStart: {
      variant: 'badge',
      layout: 'avatar-metric',
      tone: eventExploreCreatorOverlayTone(record),
      interactive: true,
      ariaLabel: 'Open host impressions',
      leadingAccessory: {
        label: eventExploreCreatorInitials(record),
        tone: eventExploreCreatorAvatarOverlayTone(record)
      },
      detailLabel: record.rating.toFixed(1),
      detailIcon: 'star'
    },
    mediaEnd: {
      variant: 'badge',
      layout: 'badge-with-leading-accessory',
      tone: openEvent ? (full ? 'full' : 'default') : 'inactive',
      interactive: openEvent,
      disabled: !openEvent,
      ariaLabel: openEvent ? 'Open event members' : 'Members hidden for this event',
      label: eventExploreMembersLabel(record),
      leadingAccessory: {
        icon: eventBlindModeIcon(record.blindMode),
        tone: record.blindMode === 'Open Event' ? 'positive' : 'negative'
      }
    },
    menuActions: eventExploreInfoCardMenuActions(record),
    clickable: false
  };
}

export function buildEventExploreGroupLabel(
  record: DemoEventRecord,
  view: AppTypes.EventExploreView
): string {
  if (view === 'distance') {
    const bucket = Math.max(5, Math.ceil(record.distanceKm / 5) * 5);
    return `${bucket} km`;
  }
  const parsed = new Date(record.startAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable';
  }
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function buildEventExploreActivityRow(record: DemoEventRecord): AppTypes.ActivityListRow {
  const row = toActivityEventRow(record);
  return row.type === 'hosting'
    ? {
        ...row,
        isAdmin: false
      }
    : {
        ...row,
        isAdmin: false
      };
}

function eventExploreInfoCardMenuActions(record: DemoEventRecord): readonly InfoCardMenuAction[] {
  return [
    {
      id: 'view',
      label: record.type === 'hosting' ? 'View hosted event' : 'View event',
      icon: eventVisibilityIcon(record.visibility)
    },
    {
      id: 'join',
      label: 'Request join',
      icon: 'person_add',
      tone: 'accent'
    }
  ];
}

function eventExploreCreatorOverlayTone(record: DemoEventRecord): 'cool' | 'cool-mid' | 'neutral' | 'warm-mid' | 'warm' {
  const rating = AppUtils.clampNumber(record.rating, 0, 10);
  if (rating <= 3.0) {
    return 'cool';
  }
  if (rating <= 5.5) {
    return 'cool-mid';
  }
  if (rating <= 7.2) {
    return 'neutral';
  }
  if (rating <= 8.6) {
    return 'warm-mid';
  }
  return 'warm';
}

function eventExploreCreatorAvatarOverlayTone(
  record: DemoEventRecord
): 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8' {
  const toneIndex = (AppDemoGenerators.hashText(`${record.type}:${record.id}:${eventExploreCreatorInitials(record)}`) % 8) + 1;
  return `tone-${toneIndex}` as 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8';
}

function eventExploreVisibilityTone(record: DemoEventRecord): 'public' | 'friends' | 'invitation' {
  if (record.visibility === 'Friends only') {
    return 'friends';
  }
  if (record.visibility === 'Invitation only') {
    return 'invitation';
  }
  return 'public';
}

function eventExploreDistanceLabel(record: DemoEventRecord): string {
  const rounded = Math.round(record.distanceKm * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
}

function eventExploreTypeLabel(record: DemoEventRecord): string {
  return record.type === 'hosting' ? 'Hosting' : 'Event';
}

function eventExploreCreatorInitials(record: DemoEventRecord): string {
  return record.creatorInitials || AppUtils.initialsFromText(record.creatorName || record.title);
}

function eventExploreMembersLabel(record: DemoEventRecord): string {
  if (record.capacityTotal <= 0) {
    return '0 / 0';
  }
  return `${record.acceptedMembers} / ${record.capacityTotal}`;
}

function isEventExploreFull(record: DemoEventRecord): boolean {
  return record.capacityTotal > 0 && record.acceptedMembers >= record.capacityTotal;
}

function isEventExploreOpenEvent(record: DemoEventRecord): boolean {
  return record.blindMode === 'Open Event';
}

function eventExploreTopicLabel(topic: string): string {
  return topic.replace(/^#+\s*/, '');
}

function eventVisibilityIcon(visibility: AppTypes.EventVisibility): string {
  if (visibility === 'Friends only') {
    return 'groups';
  }
  if (visibility === 'Invitation only') {
    return 'mail_lock';
  }
  return 'public';
}

function eventBlindModeIcon(mode: AppTypes.EventBlindMode): string {
  if (mode === 'Open Event') {
    return 'groups';
  }
  if (mode === 'Blind Event') {
    return 'visibility_off';
  }
  return 'shield';
}
