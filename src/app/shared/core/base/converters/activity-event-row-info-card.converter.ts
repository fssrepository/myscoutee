import { AppUtils } from '../../../app-utils';
import type { ActivityEventDTO } from '../../contracts/activity.interface';
import type * as AppTypes from '../models';
import type { InfoCardData } from '../../../ui';

import type * as AppConstants from '../../common/constants';
export interface ActivityEventRowInfoCardConverterOptions {
  activeUserId?: string | null;
  groupLabel?: string | null;
  state?: InfoCardData['state'];
  rowType?: AppTypes.ActivityListRow['type'];
}

export class ActivityEventRowInfoCardConverter {
  static convert(
    record: ActivityEventDTO,
    options: ActivityEventRowInfoCardConverterOptions = {}
  ): InfoCardData {
    void options.rowType;
    const activeUserId = options.activeUserId ?? '';
    const status = this.statusCode(record.status);
    const statusBadgeLabelKey = this.statusBadgeLabelKey(status);
    const pending = this.isPending(record, activeUserId);
    const invited = this.isInvited(record, activeUserId);
    const pendingStatusLabelKey = this.pendingStatusLabelKey();
    const title = record.title;

    return {
      id: record.id,
      dateIso: record.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000)),
      status,
      ownerId: record.creatorUserId,
      groupLabel: options.groupLabel ?? null,
      title,
      surfaceTone: this.surfaceTone(status, record, activeUserId),
      imageUrl: record.imageUrl?.trim() || null,
      placeholderLabel: record.imageUrl?.trim() ? null : title,
      metaRows: [
        AppUtils.dateTimeRangeLabel(record.startAtIso, record.endAtIso, record.timeframe || 'Date unavailable'),
        ...this.locationMetaRows(record)
      ],
      description: invited
        ? record.creatorName
        : record.eventType === 'slot'
          ? `Slot occurrence${record.subtitle ? ' · ' + record.subtitle : ''}`
          : record.subtitle,
      footerChips: this.footerChips(statusBadgeLabelKey, pending, pendingStatusLabelKey),
      leadingIcon: {
        icon: this.leadingIcon(record, status, pending, activeUserId)
      },
      mediaStart: this.mediaStart(record),
      mediaEnd: {
        variant: 'badge',
        tone: this.mediaEndTone(status, record, activeUserId),
        label: statusBadgeLabelKey || this.capacityLabel(record),
        ariaLabel: statusBadgeLabelKey || 'open.members',
        interactive: !statusBadgeLabelKey,
        pendingCount: statusBadgeLabelKey ? 0 : this.pendingMemberCount(record)
      },
      hasMenuOptions: this.hasMenuOptions(record),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  private static locationMetaRows(record: ActivityEventDTO): string[] {
    const location = `${record.location ?? record.creatorCity ?? ''}`.trim();
    const distanceLabel = this.distanceLabel(record);
    const line = location && distanceLabel
      ? `${location} · ${distanceLabel}`
      : location || distanceLabel;
    return line ? [line] : [];
  }

  private static distanceLabel(record: ActivityEventDTO): string {
    const distanceKm = Number(record.distanceKm);
    if (!Number.isFinite(distanceKm)) {
      return '';
    }
    return `${distanceKm} km`;
  }

  private static footerChips(
    statusBadgeLabelKey: string,
    pending: boolean,
    pendingStatusLabelKey: string
  ): NonNullable<InfoCardData['footerChips']> {
    if (statusBadgeLabelKey) {
      return [{ label: statusBadgeLabelKey }];
    }
    if (!pending) {
      return [];
    }
    return [{ label: pendingStatusLabelKey }];
  }

  private static mediaStart(record: ActivityEventDTO): InfoCardData['mediaStart'] {
    return {
      variant: 'avatar',
      label: AppUtils.initialsFromText(record.creatorInitials ?? record.creatorName ?? record.inviter ?? record.title),
      interactive: false
    };
  }

  private static isDraft(record: ActivityEventDTO): boolean {
    return this.statusCode(record.status) === 'DR';
  }

  private static isPending(record: ActivityEventDTO, activeUserId: string): boolean {
    if (this.isPendingReview(record)) {
      return true;
    }
    const userId = activeUserId.trim();
    if (!userId) {
      return false;
    }
    return this.includesUserId(record.pendingRequestMemberUserIds, userId)
      || record.pendingReason === 'approval'
      || record.pendingReason === 'waitlist';
  }

  private static pendingStatusLabelKey(): string {
    return 'waiting.for.approval';
  }

  private static isFull(record: ActivityEventDTO): boolean {
    return this.statusCode(record.status) === 'A'
      && record.capacityTotal > 0
      && record.acceptedMembers >= record.capacityTotal;
  }

  private static capacityLabel(record: ActivityEventDTO): string {
    return `${Math.max(0, record.acceptedMembers)} / ${Math.max(record.acceptedMembers, record.capacityTotal)}`;
  }

  private static pendingMemberCount(record: ActivityEventDTO): number {
    return Math.max(0, Math.trunc(Number(record.pendingMembers) || 0));
  }

  private static surfaceTone(
    status: string,
    record: ActivityEventDTO,
    activeUserId: string
  ): InfoCardData['surfaceTone'] {
    switch (status) {
      case 'UR':
        return 'review';
      case 'B':
        return 'blocked';
      case 'D':
      case 'T':
        return 'deleted';
      case 'I':
        return 'inactive';
      case 'DR':
        return 'draft';
      default:
        if (this.isInvited(record, activeUserId)) {
          return 'pending';
        }
        if (this.statusCode(record.status) === 'A') {
          return 'published';
        }
        return 'default';
    }
  }

  private static mediaEndTone(
    status: string,
    record: ActivityEventDTO,
    activeUserId: string
  ): NonNullable<InfoCardData['mediaEnd']>['tone'] {
    switch (status) {
      case 'UR':
        return 'review';
      case 'B':
        return 'blocked';
      case 'D':
      case 'T':
        return 'deleted';
      case 'I':
        return 'inactive';
      default:
        if (this.isInvited(record, activeUserId)) {
          return 'invitation';
        }
        return this.isFull(record) ? 'full' : 'default';
    }
  }

  private static leadingIcon(
    record: ActivityEventDTO,
    status: string,
    pending: boolean,
    activeUserId: string
  ): string {
    if (status === 'UR') {
      return 'pending_actions';
    }
    if (status === 'B') {
      return 'block';
    }
    if (status === 'D' || status === 'T') {
      return 'delete';
    }
    if (status === 'I') {
      return 'visibility_off';
    }
    if (pending) {
      return 'pending_actions';
    }
    if (this.isInvited(record, activeUserId)) {
      return 'mail';
    }
    return this.visibilityIcon(record.visibility);
  }

  private static visibilityIcon(option: AppConstants.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  private static hasMenuOptions(record: ActivityEventDTO): boolean {
    if (this.isTrashed(record)) {
      return this.shouldRestore(record);
    }
    return !!record.id;
  }

  private static shouldRestore(record: ActivityEventDTO): boolean {
    return this.statusCode(record.status) === 'T';
  }

  private static isPendingReview(record: ActivityEventDTO): boolean {
    const status = this.statusCode(record.status);
    return status === 'UR' || status === 'B';
  }

  private static isTrashed(record: ActivityEventDTO): boolean {
    const status = this.statusCode(record.status);
    return status === 'T';
  }

  private static isInvited(record: ActivityEventDTO, activeUserId: string): boolean {
    return this.includesUserId(record.invitedMemberUserIds, activeUserId);
  }

  private static includesUserId(userIds: readonly string[] | null | undefined, activeUserId: string): boolean {
    const userId = activeUserId.trim();
    return !!userId && (userIds ?? []).some(candidate => `${candidate ?? ''}`.trim() === userId);
  }

  private static statusBadgeLabelKey(status: string): string {
    switch (status) {
      case 'UR':
        return 'under.review';
      case 'B':
        return 'blocked.user';
      case 'T':
        return 'deleted';
      case 'D':
        return 'deleted.user';
      case 'I':
        return 'inactive.user';
      default:
        return '';
    }
  }

  private static statusCode(statusValue: string | null | undefined): string {
    const status = `${statusValue ?? ''}`.trim();
    switch (status) {
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
}
