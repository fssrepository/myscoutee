import { AppUtils } from '../../../app-utils';
import type * as ContractTypes from '../../contracts';
import type { CardRenderState, InfoCardData, CardMenuActionId } from '../../../ui';
import type { ActivityEventRecord } from '../../contracts/activity.interface';

import type * as AppConstants from '../../common/constants';
type TopicToneGroup = {
  toneClass: string;
  options: readonly string[];
};

export class EventExploreBuilder {
  static buildInfoCard(
    record: ActivityEventRecord,
    options: {
      groupLabel?: string | null;
      topicToneGroups?: readonly TopicToneGroup[];
      state?: CardRenderState | null;
    } = {}
  ): InfoCardData {
    const membersPreviewVisible = this.canPreviewMembers(record);
    const full = this.isFull(record);
    const visibility = record.visibility;

    return {
      id: record.id,
      status: record.status,
      dateIso: record.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
      ownerId: record.creatorUserId,
      groupLabel: options.groupLabel ?? null,
      title: record.title,
      imageUrl: record.imageUrl,
      metaRows: [
        `${record.slotsEnabled ? 'Series' : this.typeLabel(record)} · ${visibility} · ${this.distanceLabel(record)}`
      ],
      description: record.subtitle,
      detailRows: [record.slotsEnabled && record.nextSlot
        ? `Next slot · ${record.nextSlot.timeframe}`
        : record.timeframe],
      detailStyle: 'mono',
      footerChips: [
        ...(record.slotsEnabled ? [{ label: 'Series' }] : []),
        ...record.topics.map(topic => ({
          label: `#${this.topicLabel(topic)}`,
          toneClass: this.resolveTopicToneClass(topic, options.topicToneGroups)
        }))
      ],
      surfaceTone: full ? 'full' : record.slotsEnabled ? 'series' : 'default',
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
        tone: membersPreviewVisible ? (full ? 'full' : 'default') : 'inactive',
        interactive: membersPreviewVisible,
        disabled: !membersPreviewVisible,
        ariaLabel: membersPreviewVisible ? 'Open event members' : 'Members hidden for this event',
        label: this.membersLabel(record),
        pendingCount: Math.max(0, Math.trunc(Number(record.pendingMembers) || 0)),
        leadingAccessory: {
          icon: this.blindModeIcon(record.blindMode),
          tone: record.blindMode === 'Open Event' ? 'positive' : 'negative'
        }
      },
      menuActions: this.menuActionsForRecord(record),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  static buildGroupLabel(
    record: ActivityEventRecord,
    view: ContractTypes.EventExploreView
  ): string {
    if (view === 'distance') {
      const bucket = Math.max(5, Math.ceil(record.distanceKm / 5) * 5);
      return `${bucket} km`;
    }
    const parsed = new Date(record.startAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return AppUtils.smartListDayLabel(parsed);
  }

  private static menuActionsForRecord(record: ActivityEventRecord): readonly CardMenuActionId[] {
    const full = this.isFull(record);
    const actions: CardMenuActionId[] = [
      'view'
    ];
    actions.push(this.joinActionId(record));
    actions.push('contactOrganizer');
    actions.push('shareEvent');
    actions.push('reportOrganizer');
    return actions;
  }

  private static creatorOverlayTone(record: ActivityEventRecord): 'cool' | 'cool-mid' | 'neutral' | 'warm-mid' | 'warm' {
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
    record: ActivityEventRecord
  ): 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8' {
    const toneIndex = (AppUtils.hashText(`${record.type}:${record.id}:${this.creatorInitials(record)}`) % 8) + 1;
    return `tone-${toneIndex}` as 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8';
  }

  private static visibilityTone(record: ActivityEventRecord): 'public' | 'friends' | 'invitation' {
    if (record.visibility === 'Friends only') {
      return 'friends';
    }
    if (record.visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private static distanceLabel(record: ActivityEventRecord): string {
    const rounded = Math.round(record.distanceKm * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  private static typeLabel(record: ActivityEventRecord): string {
    return record.type === 'hosting' ? 'Hosting' : 'Event';
  }

  private static creatorInitials(record: ActivityEventRecord): string {
    return record.creatorInitials || AppUtils.initialsFromText(record.creatorName || record.title);
  }

  private static membersLabel(record: ActivityEventRecord): string {
    if (record.capacityTotal <= 0) {
      return '0 / 0';
    }
    return `${record.acceptedMembers} / ${record.capacityTotal}`;
  }

  private static isFull(record: ActivityEventRecord): boolean {
    return record.capacityTotal > 0 && record.acceptedMembers >= record.capacityTotal;
  }

  private static canPreviewMembers(record: ActivityEventRecord): boolean {
    return record.blindMode === 'Open Event';
  }

  private static joinActionId(record: ActivityEventRecord): CardMenuActionId {
    if (this.isFull(record)) {
      return 'joinWaitlist';
    }
    return this.requiresBookingFlow(record)
      ? 'bookEvent'
      : 'requestJoin';
  }

  private static requiresBookingFlow(record: ActivityEventRecord): boolean {
    if (record.ticketing === true) {
      return true;
    }
    return Boolean(record.pricing?.enabled && (Number(record.pricing?.basePrice) || 0) > 0);
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

  private static visibilityIcon(visibility: AppConstants.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private static blindModeIcon(mode: ContractTypes.EventBlindMode): string {
    if (mode === 'Open Event') {
      return 'groups';
    }
    if (mode === 'Blind Event') {
      return 'visibility_off';
    }
    return 'shield';
  }
}
