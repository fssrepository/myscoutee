import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../app-types';
import type { InfoCardData, InfoCardMenuAction } from '../../../ui';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { toActivityEventRow } from '../converters/activities-event.converter';

type TopicToneGroup = {
  toneClass: string;
  options: readonly string[];
};

export class EventExploreBuilder {
  static buildInfoCard(
    record: DemoEventRecord,
    options: {
      groupLabel?: string | null;
      topicToneGroups?: readonly TopicToneGroup[];
    } = {}
  ): InfoCardData {
    const openEvent = this.isOpenEvent(record);
    const full = this.isFull(record);
    const visibility = record.visibility;

    return {
      rowId: record.id,
      groupLabel: options.groupLabel ?? null,
      title: record.title,
      imageUrl: record.imageUrl,
      metaRows: [
        `${this.typeLabel(record)} · ${visibility} · ${this.distanceLabel(record)}`
      ],
      description: record.subtitle,
      detailRows: [record.timeframe],
      detailStyle: 'mono',
      footerChips: record.topics.map(topic => ({
        label: `#${this.topicLabel(topic)}`,
        toneClass: this.resolveTopicToneClass(topic, options.topicToneGroups)
      })),
      surfaceTone: full ? 'full' : 'default',
      leadingIcon: {
        icon: this.visibilityIcon(visibility),
        tone: this.visibilityTone(record)
      },
      mediaStart: {
        variant: 'badge',
        layout: 'avatar-metric',
        tone: this.creatorOverlayTone(record),
        interactive: true,
        ariaLabel: 'Open host impressions',
        leadingAccessory: {
          label: this.creatorInitials(record),
          tone: this.creatorAvatarOverlayTone(record)
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
        label: this.membersLabel(record),
        leadingAccessory: {
          icon: this.blindModeIcon(record.blindMode),
          tone: record.blindMode === 'Open Event' ? 'positive' : 'negative'
        }
      },
      menuActions: this.infoCardMenuActions(record),
      clickable: false
    };
  }

  static buildGroupLabel(
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

  static buildActivityRow(record: DemoEventRecord): AppTypes.ActivityListRow {
    const row = toActivityEventRow(record);
    return {
      ...row,
      isAdmin: false
    };
  }

  private static infoCardMenuActions(record: DemoEventRecord): readonly InfoCardMenuAction[] {
    return [
      {
        id: 'view',
        label: record.type === 'hosting' ? 'View hosted event' : 'View event',
        icon: this.visibilityIcon(record.visibility)
      },
      {
        id: 'join',
        label: 'Request join',
        icon: 'person_add',
        tone: 'accent'
      }
    ];
  }

  private static creatorOverlayTone(record: DemoEventRecord): 'cool' | 'cool-mid' | 'neutral' | 'warm-mid' | 'warm' {
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

  private static creatorAvatarOverlayTone(
    record: DemoEventRecord
  ): 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8' {
    const toneIndex = (AppDemoGenerators.hashText(`${record.type}:${record.id}:${this.creatorInitials(record)}`) % 8) + 1;
    return `tone-${toneIndex}` as 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8';
  }

  private static visibilityTone(record: DemoEventRecord): 'public' | 'friends' | 'invitation' {
    if (record.visibility === 'Friends only') {
      return 'friends';
    }
    if (record.visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private static distanceLabel(record: DemoEventRecord): string {
    const rounded = Math.round(record.distanceKm * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  private static typeLabel(record: DemoEventRecord): string {
    return record.type === 'hosting' ? 'Hosting' : 'Event';
  }

  private static creatorInitials(record: DemoEventRecord): string {
    return record.creatorInitials || AppUtils.initialsFromText(record.creatorName || record.title);
  }

  private static membersLabel(record: DemoEventRecord): string {
    if (record.capacityTotal <= 0) {
      return '0 / 0';
    }
    return `${record.acceptedMembers} / ${record.capacityTotal}`;
  }

  private static isFull(record: DemoEventRecord): boolean {
    return record.capacityTotal > 0 && record.acceptedMembers >= record.capacityTotal;
  }

  private static isOpenEvent(record: DemoEventRecord): boolean {
    return record.blindMode === 'Open Event';
  }

  private static topicLabel(topic: string): string {
    return topic.replace(/^#+\s*/, '');
  }

  private static normalizeTopic(topic: string): string {
    return AppUtils.normalizeText(`${topic}`.replace(/^#+\s*/, '').trim());
  }

  private static resolveTopicToneClass(topic: string, groups: readonly TopicToneGroup[] | undefined): string {
    if (!groups?.length) {
      return '';
    }
    const normalizedTopic = this.normalizeTopic(topic);
    if (!normalizedTopic) {
      return '';
    }
    for (const group of groups) {
      if (group.options.some(option => this.normalizeTopic(option) === normalizedTopic)) {
        return group.toneClass;
      }
    }
    return '';
  }

  private static visibilityIcon(visibility: AppTypes.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private static blindModeIcon(mode: AppTypes.EventBlindMode): string {
    if (mode === 'Open Event') {
      return 'groups';
    }
    if (mode === 'Blind Event') {
      return 'visibility_off';
    }
    return 'shield';
  }
}
