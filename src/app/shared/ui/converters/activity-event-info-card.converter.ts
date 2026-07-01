import { AppUtils } from '../../app-utils';
import type {
  ActivityEventDTO,
  ActivityMemberOwnerRef,
  ActivityMembersSummaryDto
} from '../../core/contracts/activity.interface';
import type {
  EventVisibility
} from '../../core/common/constants';
import type {
  InfoCardData
} from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityEventInfoCardConverterOptions {
  activeUserId?: string | null;
  groupLabel?: string | null;
  state?: InfoCardData['state'];
}

export interface ActivityEventInfoCardSummaryOptions {
  capacityByRowId?: Readonly<Record<string, string | null | undefined>>;
  pendingMembersByRowId?: Readonly<Record<string, number | null | undefined>>;
  capacityTotal?: number | null;
}

export class ActivityEventInfoCardConverter {
  static convert(
    dto: ActivityEventDTO,
    options: ActivityEventInfoCardConverterOptions = {}
  ): InfoCardData {
    const activeUserId = options.activeUserId ?? '';
    const status = this.statusCode(dto.status);
    const statusBadgeLabelKey = this.statusBadgeLabelKey(status);
    const pending = this.isPending(dto, activeUserId);
    const invited = this.isInvited(dto, activeUserId);
    const title = dto.title;

    return {
      id: dto.id,
      smartListKey: `${this.rowType(dto, activeUserId)}:${dto.id}`,
      dateIso: dto.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
      status,
      ownerId: dto.creatorUserId,
      ownerUserId: dto.creatorUserId,
      groupLabel: options.groupLabel ?? null,
      title,
      surfaceTone: this.surfaceTone(status, dto, activeUserId),
      imageUrl: dto.imageUrl?.trim() || null,
      placeholderLabel: dto.imageUrl?.trim() ? null : title,
      metaRows: [
        AppUtils.dateTimeRangeLabel(dto.startAtIso, dto.endAtIso, dto.timeframe || 'Date unavailable'),
        ...this.locationMetaRows(dto)
      ],
      description: invited
        ? dto.creatorName
        : dto.eventType === 'slot'
          ? `Slot occurrence${dto.subtitle ? ' · ' + dto.subtitle : ''}`
          : dto.subtitle,
      footerChips: this.footerChips(statusBadgeLabelKey, pending),
      leadingIcon: {
        icon: this.leadingIcon(dto, status, pending, activeUserId)
      },
      mediaStart: this.mediaStart(dto),
      mediaEnd: {
        variant: 'badge',
        tone: this.mediaEndTone(status, dto, activeUserId),
        label: statusBadgeLabelKey || this.capacityLabel(dto),
        ariaLabel: statusBadgeLabelKey || 'open.members',
        interactive: !statusBadgeLabelKey,
        pendingCount: statusBadgeLabelKey ? 0 : this.pendingMemberCount(dto)
      },
      hasMenuOptions: this.hasMenuOptions(dto),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  static convertList(
    dtos: readonly ActivityEventDTO[],
    options: ActivityEventInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return dtos.map(dto => this.convert(dto, options));
  }

  static toActivityMembersOwner(card: Pick<InfoCardData, 'id'>): ActivityMemberOwnerRef {
    return {
      ownerType: 'event',
      ownerId: card.id
    };
  }

  static toActivityMembersSummary(
    card: InfoCardData,
    options: ActivityEventInfoCardSummaryOptions = {}
  ): ActivityMembersSummaryDto | null {
    const capacity = this.parseCapacityLabel(
      options.capacityByRowId?.[card.id] ?? card.mediaEnd?.label
    );
    const acceptedMembers = capacity?.acceptedMembers ?? 0;
    const pendingMembers = this.summaryPendingMembers(card, options);
    const capacityTotal = Math.max(
      acceptedMembers,
      capacity?.capacityTotal ?? this.normalizeCount(options.capacityTotal) ?? acceptedMembers
    );
    if (acceptedMembers <= 0 && pendingMembers <= 0 && capacityTotal <= 0) {
      return null;
    }
    return {
      ...this.toActivityMembersOwner(card),
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: []
    };
  }

  private static locationMetaRows(dto: ActivityEventDTO): string[] {
    const location = `${dto.location ?? dto.creatorCity ?? ''}`.trim();
    const distanceLabel = this.distanceLabel(dto);
    const line = location && distanceLabel
      ? `${location} · ${distanceLabel}`
      : location || distanceLabel;
    return line ? [line] : [];
  }

  private static distanceLabel(dto: ActivityEventDTO): string {
    const distanceKm = Number(dto.distanceKm);
    if (!Number.isFinite(distanceKm)) {
      return '';
    }
    return `${distanceKm} km`;
  }

  private static footerChips(
    statusBadgeLabelKey: string,
    pending: boolean
  ): NonNullable<InfoCardData['footerChips']> {
    if (statusBadgeLabelKey) {
      return [{ label: statusBadgeLabelKey }];
    }
    if (!pending) {
      return [];
    }
    return [{ label: 'waiting.for.approval' }];
  }

  private static mediaStart(dto: ActivityEventDTO): InfoCardData['mediaStart'] {
    return {
      variant: 'avatar',
      label: AppUtils.initialsFromText(dto.creatorInitials ?? dto.creatorName ?? dto.inviter ?? dto.title),
      interactive: false
    };
  }

  private static rowType(dto: ActivityEventDTO, activeUserId: string): 'events' | 'hosting' | 'invitations' {
    const userId = activeUserId.trim();
    if (userId && this.includesUserId(dto.invitedMemberUserIds, userId)) {
      return 'invitations';
    }
    if (userId && this.includesUserId(dto.adminIds, userId)) {
      return 'hosting';
    }
    return 'events';
  }

  private static isPending(dto: ActivityEventDTO, activeUserId: string): boolean {
    if (this.isPendingReview(dto)) {
      return true;
    }
    const userId = activeUserId.trim();
    if (!userId) {
      return false;
    }
    return this.includesUserId(dto.pendingRequestMemberUserIds, userId)
      || dto.pendingReason === 'approval'
      || dto.pendingReason === 'waitlist';
  }

  private static isFull(dto: ActivityEventDTO): boolean {
    return this.statusCode(dto.status) === 'A'
      && dto.capacityTotal > 0
      && dto.acceptedMembers >= dto.capacityTotal;
  }

  private static capacityLabel(dto: ActivityEventDTO): string {
    return `${Math.max(0, dto.acceptedMembers)} / ${Math.max(dto.acceptedMembers, dto.capacityTotal)}`;
  }

  private static pendingMemberCount(dto: ActivityEventDTO): number {
    return Math.max(0, Math.trunc(Number(dto.pendingMembers) || 0));
  }

  private static summaryPendingMembers(
    card: InfoCardData,
    options: ActivityEventInfoCardSummaryOptions
  ): number {
    return this.normalizeCount(options.pendingMembersByRowId?.[card.id])
      ?? this.normalizeCount(card.mediaEnd?.pendingCount)
      ?? 0;
  }

  private static parseCapacityLabel(
    label: string | number | null | undefined
  ): { acceptedMembers: number; capacityTotal: number } | null {
    const normalizedLabel = `${label ?? ''}`.trim();
    if (!normalizedLabel.includes('/')) {
      return null;
    }
    const parts = normalizedLabel.split('/').map(part => Number.parseInt(part.trim(), 10));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
      return null;
    }
    const acceptedMembers = Math.max(0, Math.trunc(parts[0]));
    return {
      acceptedMembers,
      capacityTotal: Math.max(acceptedMembers, Math.trunc(parts[1]))
    };
  }

  private static normalizeCount(value: unknown): number | null {
    const count = Number(value);
    return Number.isFinite(count)
      ? Math.max(0, Math.trunc(count))
      : null;
  }

  private static surfaceTone(
    status: string,
    dto: ActivityEventDTO,
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
        if (this.isInvited(dto, activeUserId)) {
          return 'pending';
        }
        if (this.statusCode(dto.status) === 'A') {
          return 'published';
        }
        return 'default';
    }
  }

  private static mediaEndTone(
    status: string,
    dto: ActivityEventDTO,
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
        if (this.isInvited(dto, activeUserId)) {
          return 'invitation';
        }
        return this.isFull(dto) ? 'full' : 'default';
    }
  }

  private static leadingIcon(
    dto: ActivityEventDTO,
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
    if (this.isInvited(dto, activeUserId)) {
      return 'mail';
    }
    return this.visibilityIcon(dto.visibility);
  }

  private static visibilityIcon(option: EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  private static hasMenuOptions(dto: ActivityEventDTO): boolean {
    if (this.isTrashed(dto)) {
      return this.shouldRestore(dto);
    }
    return !!dto.id;
  }

  private static shouldRestore(dto: ActivityEventDTO): boolean {
    return this.statusCode(dto.status) === 'T';
  }

  private static isPendingReview(dto: ActivityEventDTO): boolean {
    const status = this.statusCode(dto.status);
    return status === 'UR' || status === 'B';
  }

  private static isTrashed(dto: ActivityEventDTO): boolean {
    const status = this.statusCode(dto.status);
    return status === 'T';
  }

  private static isInvited(dto: ActivityEventDTO, activeUserId: string): boolean {
    return this.includesUserId(dto.invitedMemberUserIds, activeUserId);
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

export const activityEventInfoCardConverter =
  ActivityEventInfoCardConverter satisfies UiListConverter<
    ActivityEventDTO,
    InfoCardData,
    ActivityEventInfoCardConverterOptions | undefined
  >;
