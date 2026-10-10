import {
  UiLinkUtils,
  type CardMenuActionId,
  type CardRenderState,
  type InfoCardData,
  type UiListConverter
} from '@myscoutee/components';
import { AppUtils } from '../../../core/base/app-utils';
import type * as ContractTypes from '../../../core/contracts';
import type * as AppConstants from '../../../core/common/constants';
import type { ActivityEventRecord } from '../../../core/contracts/activity.interface';

export type EventExploreTopicToneGroup = {
  toneClass: string;
  options: readonly string[];
};

export interface EventExploreInfoCardConverterOptions {
  groupLabel?: string | null;
  topicToneGroups?: readonly EventExploreTopicToneGroup[];
  state?: CardRenderState | null;
  activeUserId?: string | null;
}

export class EventExploreInfoCardConverter {
  static convert(
    record: ActivityEventRecord,
    options: EventExploreInfoCardConverterOptions = {}
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
        tone: 'cool',
        interactive: true,
        ariaLabel: `View ${record.creatorName || 'organizer'} profile`,
        leadingAccessory: {
          label: this.creatorInitials(record),
          tone: this.creatorAvatarOverlayTone(record)
        }
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
      menuActions: this.menuActionsForRecord(record, options.activeUserId ?? null),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  static convertList(
    records: readonly ActivityEventRecord[],
    options: EventExploreInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return records.map(record => this.convert(record, options));
  }

  private static menuActionsForRecord(
    record: ActivityEventRecord,
    activeUserId: string | null
  ): readonly CardMenuActionId[] {
    const normalizedUserId = `${activeUserId ?? ''}`.trim();
    const watchActions = this.canWatchEvent(record, normalizedUserId)
      ? [this.watchActionId(record)]
      : [];
    const externalActions: CardMenuActionId[] = UiLinkUtils.normalizeHttpUrl(record.sourceLink) ? ['externalInfo'] : [];
    if (normalizedUserId && record.creatorUserId === normalizedUserId) {
      return ['view', ...externalActions, 'notifyParticipants'];
    }
    if (normalizedUserId && this.hasVisibleCheckoutBasket(record, normalizedUserId)) {
      return ['view', ...externalActions, 'continueBookingPending', ...watchActions, 'askOrganizer', 'shareEvent', 'reportOrganizer'];
    }
    const actions: CardMenuActionId[] = ['view', ...externalActions];
    if (!(record.slotsEnabled === true && this.isFull(record))) {
      actions.push(this.joinActionId(record));
    }
    actions.push(...watchActions);
    actions.push('askOrganizer');
    actions.push('shareEvent');
    actions.push('reportOrganizer');
    return actions;
  }

  private static hasVisibleCheckoutBasket(record: ActivityEventRecord, activeUserId: string): boolean {
    return activeUserId.length > 0
      && record.checkoutResultState != null
      && record.checkoutResultState !== 'deleted'
      && !(record.slotsEnabled === true && this.isFull(record));
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
    const source = `${record.creatorInitials ?? ''}`.trim()
      || `${record.creatorName ?? ''}`.trim()
      || record.title;
    return AppUtils.initialsFromText(source);
  }

  private static membersLabel(record: ActivityEventRecord): string {
    if (record.slotsEnabled === true) {
      return 'Multislot';
    }
    if (record.capacityTotal <= 0) {
      return '0 / 0';
    }
    return `${record.acceptedMembers} / ${record.capacityTotal}`;
  }

  private static isFull(record: ActivityEventRecord): boolean {
    return record.full === true;
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

  private static watchActionId(record: ActivityEventRecord): CardMenuActionId {
    return record.watched === true ? 'removeWatchlist' : 'addWatchlist';
  }

  private static canWatchEvent(record: ActivityEventRecord, activeUserId: string): boolean {
    if (!activeUserId || record.creatorUserId === activeUserId) {
      return false;
    }
    return record.currentUserMembershipStatus !== 'accepted'
      && !(record.acceptedMemberUserIds ?? []).some(userId => userId.trim() === activeUserId);
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

  private static resolveTopicToneClass(topic: string, groups: readonly EventExploreTopicToneGroup[] | undefined): string {
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

export const eventExploreInfoCardConverter =
  EventExploreInfoCardConverter satisfies UiListConverter<
    ActivityEventRecord,
    InfoCardData,
    EventExploreInfoCardConverterOptions
  >;
