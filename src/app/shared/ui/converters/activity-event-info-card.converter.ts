import { AppUtils } from '../../app-utils';
import type {
  ActivityEventDTO
} from '../../core/contracts/activity.interface';
import type {
  EventVisibility
} from '../../core/common/constants';
import type {
  InfoCardData,
  InfoCardMenuAction
} from '../components/card';

export interface ActivityEventInfoCardConverterOptions {
  activeUserId?: string | null;
  groupLabel?: string | null;
  state?: InfoCardData['state'];
}

export class ActivityEventInfoCardConverter {
  static convert(
    dto: ActivityEventDTO,
    options: ActivityEventInfoCardConverterOptions = {}
  ): InfoCardData {
    const status = this.statusCode(dto.status);
    const statusBadgeLabelKey = this.statusBadgeLabelKey(status);
    const pending = this.isPending(dto, options.activeUserId ?? '');
    const title = dto.title;

    return {
      id: dto.id,
      dateIso: dto.startAtIso,
      distanceMetersExact: Math.max(0, Math.round((Number(dto.distanceKm) || 0) * 1000)),
      status,
      ownerId: dto.creatorUserId,
      ownerUserId: dto.creatorUserId,
      groupLabel: options.groupLabel ?? null,
      title,
      surfaceTone: this.surfaceTone(status, dto),
      imageUrl: dto.imageUrl?.trim() || null,
      placeholderLabel: dto.imageUrl?.trim() ? null : title,
      metaRows: [
        this.dateRangeLabel(dto),
        ...this.locationMetaRows(dto)
      ],
      description: dto.type === 'invitations'
        ? dto.creatorName
        : dto.eventType === 'slot'
          ? `Slot occurrence${dto.subtitle ? ' · ' + dto.subtitle : ''}`
          : dto.subtitle,
      footerChips: this.footerChips(statusBadgeLabelKey, pending),
      leadingIcon: {
        icon: this.leadingIcon(dto, status, pending)
      },
      mediaStart: this.mediaStart(dto),
      mediaEnd: {
        variant: 'badge',
        tone: this.mediaEndTone(status, dto),
        label: statusBadgeLabelKey || this.capacityLabel(dto),
        ariaLabel: statusBadgeLabelKey || 'open.members',
        interactive: !statusBadgeLabelKey,
        pendingCount: statusBadgeLabelKey ? 0 : this.pendingMemberCount(dto)
      },
      menuActions: this.menuActions(dto, options.activeUserId ?? ''),
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

  private static dateRangeLabel(dto: ActivityEventDTO): string {
    const start = this.validDate(dto.startAtIso);
    const end = this.validDate(dto.endAtIso);
    if (!start) {
      return dto.timeframe || 'Date unavailable';
    }
    const safeEnd = end && end.getTime() > start.getTime()
      ? end
      : new Date(start.getTime() + (2 * 60 * 60 * 1000));
    const sameDay = start.toDateString() === safeEnd.toDateString();
    const startDateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTimeLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeLabel = safeEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (sameDay) {
      return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel}`;
    }
    const endDateLabel = safeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startDateLabel}, ${startTimeLabel} - ${endDateLabel}, ${endTimeLabel}`;
  }

  private static validDate(value: string | null | undefined): Date | null {
    const date = new Date(`${value ?? ''}`);
    return Number.isFinite(date.getTime()) ? date : null;
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
    if (dto.type !== 'events' && dto.type !== 'invitations') {
      return null;
    }
    return {
      variant: 'avatar',
      label: dto.type === 'invitations'
        ? AppUtils.initialsFromText(dto.inviter ?? dto.creatorName ?? dto.title)
        : AppUtils.initialsFromText(dto.creatorInitials ?? dto.creatorName ?? dto.title),
      interactive: false
    };
  }

  private static isDraft(dto: ActivityEventDTO): boolean {
    return dto.type === 'hosting' && (dto.published === false || this.statusCode(dto.status) === 'DR');
  }

  private static isPending(dto: ActivityEventDTO, activeUserId: string): boolean {
    if (this.isPendingReview(dto)) {
      return true;
    }
    if (dto.type !== 'events') {
      return false;
    }
    const userId = activeUserId.trim();
    if (!userId) {
      return false;
    }
    return dto.pendingReason === 'approval' || dto.pendingReason === 'waitlist';
  }

  private static isFull(dto: ActivityEventDTO): boolean {
    return dto.type === 'events'
      && dto.capacityTotal > 0
      && dto.acceptedMembers >= dto.capacityTotal;
  }

  private static capacityLabel(dto: ActivityEventDTO): string {
    return `${Math.max(0, dto.acceptedMembers)} / ${Math.max(dto.acceptedMembers, dto.capacityTotal)}`;
  }

  private static pendingMemberCount(dto: ActivityEventDTO): number {
    return Math.max(0, Math.trunc(Number(dto.pendingMembers) || 0));
  }

  private static surfaceTone(
    status: string,
    dto: ActivityEventDTO
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
        if (dto.type === 'hosting' && !this.isDraft(dto)) {
          return 'published';
        }
        return 'default';
    }
  }

  private static mediaEndTone(
    status: string,
    dto: ActivityEventDTO
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
        return this.isFull(dto) ? 'full' : 'default';
    }
  }

  private static leadingIcon(
    dto: ActivityEventDTO,
    status: string,
    pending: boolean
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
    if (dto.type === 'hosting' || dto.type === 'events') {
      return this.visibilityIcon(dto.visibility);
    }
    if (dto.type === 'invitations') {
      return 'mail';
    }
    return 'event';
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

  private static menuActions(dto: ActivityEventDTO, activeUserId: string): readonly InfoCardMenuAction[] {
    if (this.isTrashed(dto)) {
      return this.shouldRestore(dto) ? ['restore'] : [];
    }
    const actions: InfoCardMenuAction[] = [];
    if (this.shouldTakeOver(dto)) {
      actions.push('takeOver');
    }
    if (this.shouldPublish(dto)) {
      actions.push('publish');
    }
    if (this.shouldPrimaryAction(dto)) {
      actions.push(this.primaryActionId(dto));
    }
    if (this.shouldView(dto)) {
      actions.push('view');
    }
    if (dto.type === 'hosting' || dto.type === 'events' || dto.type === 'invitations') {
      actions.push(this.serviceChatActionId(dto));
      actions.push('shareEvent');
    }
    if (this.shouldUnpublish(dto)) {
      actions.push('unpublish');
    }
    if (this.shouldReport(dto, activeUserId)) {
      actions.push('reportOrganizer');
    }
    if (dto.type === 'invitations') {
      actions.push('accept');
    }
    if (this.shouldSecondaryAction(dto)) {
      actions.push(dto.type === 'events' ? 'leaveEvent' : dto.type === 'hosting' ? 'deleteEvent' : 'rejectInvitation');
    }
    return actions;
  }

  private static serviceChatActionId(dto: ActivityEventDTO): InfoCardMenuAction {
    if (dto.type === 'hosting' && dto.isAdmin) {
      return 'notifyParticipants';
    }
    if (dto.type === 'invitations') {
      return 'askOrganizer';
    }
    return 'contactOrganizer';
  }

  private static primaryActionId(dto: ActivityEventDTO): InfoCardMenuAction {
    if (dto.type === 'invitations') {
      return 'viewInvitation';
    }
    return this.isDraft(dto) ? 'editEvent' : 'manageEvent';
  }

  private static shouldTakeOver(dto: ActivityEventDTO): boolean {
    return this.statusCode(dto.status) === 'UR'
      && dto.isAdmin === true
      && (dto.type === 'hosting' || dto.type === 'events');
  }

  private static shouldPublish(dto: ActivityEventDTO): boolean {
    return !this.isTrashed(dto)
      && !this.isPendingReview(dto)
      && dto.type === 'hosting'
      && dto.isAdmin === true
      && this.isDraft(dto);
  }

  private static shouldUnpublish(dto: ActivityEventDTO): boolean {
    return !this.isTrashed(dto)
      && !this.isPendingReview(dto)
      && dto.type === 'hosting'
      && dto.isAdmin === true
      && !this.isDraft(dto);
  }

  private static shouldPrimaryAction(dto: ActivityEventDTO): boolean {
    if (this.isTrashed(dto) || this.isPendingReview(dto)) {
      return false;
    }
    if ((dto.type === 'hosting' || dto.type === 'events') && !dto.isAdmin) {
      return false;
    }
    return true;
  }

  private static shouldView(dto: ActivityEventDTO): boolean {
    return !this.isTrashed(dto) && (dto.type === 'hosting' || dto.type === 'events');
  }

  private static shouldReport(dto: ActivityEventDTO, activeUserId: string): boolean {
    const creatorUserId = dto.creatorUserId.trim();
    return !this.isTrashed(dto) && !!creatorUserId && creatorUserId !== activeUserId.trim();
  }

  private static shouldSecondaryAction(dto: ActivityEventDTO): boolean {
    if (this.isTrashed(dto)) {
      return false;
    }
    if (this.isPendingReview(dto) && dto.type !== 'events') {
      return false;
    }
    if (dto.type === 'hosting' && !dto.isAdmin) {
      return false;
    }
    return true;
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
    return dto.isTrashed === true || status === 'T' || status === 'D' || status === 'I';
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
        return status || 'A';
    }
  }
}
