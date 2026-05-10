import { AppUtils } from '../../../app-utils';
import type {
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../interfaces/activity-feed.interface';
import type * as AppTypes from '../models';
import type {
  InfoCardData,
  InfoCardMenuAction,
  InfoCardOverlayTone
} from '../../../ui';

type ActivityEventSource = EventMenuItem | HostingMenuItem | InvitationMenuItem;

export interface ActivityEventInfoCardOptions {
  activeUserId?: string | null;
  groupLabel?: string | null;
  state?: InfoCardData['state'];
}

export class ActivityEventInfoCardBuilder {
  static build(
    row: AppTypes.ActivityListRow,
    options: ActivityEventInfoCardOptions = {}
  ): InfoCardData {
    const source = row.source as Partial<ActivityEventSource> & { isTrashed?: boolean; city?: string; creatorCity?: string };
    const status = this.statusCode(source.status);
    const statusTone = this.statusTone(status);
    const statusBadgeLabel = this.statusBadgeLabel(status);
    const pending = this.isPending(row, options.activeUserId ?? '');
    const pendingStatusLabel = this.pendingStatusLabel(source);
    const full = this.isFull(row);
    const draft = this.isDraft(row);

    return {
      rowId: this.rowId(row),
      groupLabel: options.groupLabel ?? null,
      title: row.title,
      imageUrl: this.imageUrl(source),
      placeholderLabel: this.imageUrl(source) ? null : row.title,
      metaRows: [
        this.dateRangeLabel(row),
        ...this.locationMetaRows(row)
      ],
      description: row.subtitle,
      footerChips: this.footerChips(statusBadgeLabel, statusTone, pending, pendingStatusLabel),
      surfaceTone: statusTone ?? (draft ? 'draft' : pending ? this.pendingSurfaceTone(source) : full ? 'full' : 'default'),
      leadingIcon: {
        icon: this.leadingIcon(row, statusTone, pending),
        tone: this.leadingIconTone(row, statusTone, pending)
      },
      mediaStart: this.mediaStart(row),
      mediaEnd: {
        variant: 'badge',
        tone: statusTone ?? (full ? 'full' : 'default'),
        label: statusBadgeLabel || this.capacityLabel(row),
        ariaLabel: statusBadgeLabel || 'Open members',
        interactive: !statusBadgeLabel,
        pendingCount: statusBadgeLabel ? 0 : this.pendingMemberCount(row)
      },
      menuActions: this.menuActions(row, options.activeUserId ?? ''),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  private static rowId(row: AppTypes.ActivityListRow): string {
    return `${row.type}:${row.id}`;
  }

  private static imageUrl(source: Partial<ActivityEventSource>): string | null {
    const value = `${source.imageUrl ?? ''}`.trim();
    return value || null;
  }

  private static dateRangeLabel(row: AppTypes.ActivityListRow): string {
    const source = row.source as Partial<EventMenuItem & HostingMenuItem & InvitationMenuItem>;
    const start = this.validDate(source.startAt ?? row.dateIso);
    const end = this.validDate(source.endAt ?? null);
    if (!start) {
      return source.timeframe ?? (source as InvitationMenuItem).when ?? 'Date unavailable';
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

  private static locationMetaRows(row: AppTypes.ActivityListRow): string[] {
    const source = row.source as Partial<ActivityEventSource> & { city?: string; creatorCity?: string };
    const location = `${source.location ?? source.city ?? source.creatorCity ?? ''}`.trim();
    const distanceLabel = this.distanceLabel(row);
    const line = location && distanceLabel
      ? `${location} · ${distanceLabel}`
      : location || distanceLabel;
    return line ? [line] : [];
  }

  private static distanceLabel(row: AppTypes.ActivityListRow): string {
    if (Number.isFinite(Number(row.distanceKm))) {
      return `${row.distanceKm} km`;
    }
    const source = row.source as { distanceKm?: number; distanceMetersExact?: number };
    if (Number.isFinite(Number(source.distanceKm))) {
      return `${source.distanceKm} km`;
    }
    const meters = Number(row.distanceMetersExact ?? source.distanceMetersExact);
    if (!Number.isFinite(meters) || meters < 0) {
      return '';
    }
    return `${Math.round((meters / 1000) * 10) / 10} km`;
  }

  private static footerChips(
    statusBadgeLabel: string,
    statusTone: InfoCardData['surfaceTone'] | null,
    pending: boolean,
    pendingStatusLabel: string
  ): NonNullable<InfoCardData['footerChips']> {
    if (statusBadgeLabel) {
      return [{
        label: statusBadgeLabel,
        toneClass: `status-${statusTone ?? 'review'}`
      }];
    }
    if (!pending) {
      return [];
    }
    const waitlist = pendingStatusLabel.toLowerCase().includes('waiting list');
    return [{
      label: pendingStatusLabel || 'Waiting for approval',
      toneClass: waitlist ? 'status-waitlist' : 'status-pending'
    }];
  }

  private static mediaStart(row: AppTypes.ActivityListRow): InfoCardData['mediaStart'] {
    if (row.type !== 'events' && row.type !== 'invitations') {
      return null;
    }
    return {
      variant: 'avatar',
      tone: this.sourceAvatarTone(row),
      label: this.sourceAvatarLabel(row),
      interactive: false
    };
  }

  private static sourceAvatarTone(row: AppTypes.ActivityListRow): Extract<InfoCardOverlayTone, `tone-${number}`> | 'default' {
    const source = row.source as Partial<EventMenuItem & InvitationMenuItem>;
    const toneSeed = row.type === 'invitations'
      ? `${row.id}-${source.inviter ?? ''}`
      : `${row.id}-${row.title}`;
    const toneIndex = (AppUtils.hashText(toneSeed) % 8) + 1;
    const tone = `tone-${toneIndex}`;
    switch (tone) {
      case 'tone-1':
      case 'tone-2':
      case 'tone-3':
      case 'tone-4':
      case 'tone-5':
      case 'tone-6':
      case 'tone-7':
      case 'tone-8':
        return tone;
      default:
        return 'default';
    }
  }

  private static sourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    const source = row.source as Partial<EventMenuItem & HostingMenuItem & InvitationMenuItem>;
    if (row.type === 'invitations') {
      return AppUtils.initialsFromText(source.inviter ?? source.creatorName ?? row.title);
    }
    if (row.type === 'events' || row.type === 'hosting') {
      return AppUtils.initialsFromText(source.avatar ?? source.creatorName ?? source.title ?? row.title);
    }
    return AppUtils.initialsFromText(row.title);
  }

  private static isDraft(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'hosting') {
      return false;
    }
    const source = row.source as Partial<HostingMenuItem>;
    return source.published === false || this.statusCode(source.status) === 'DR';
  }

  private static isPending(row: AppTypes.ActivityListRow, activeUserId: string): boolean {
    if (this.isPendingReview(row)) {
      return true;
    }
    if (row.type !== 'events') {
      return false;
    }
    const userId = activeUserId.trim();
    if (!userId) {
      return false;
    }
    const source = row.source as Partial<EventMenuItem>;
    if (source.acceptedMemberUserIds?.includes(userId)) {
      return false;
    }
    return source.pendingMemberUserIds?.includes(userId) === true;
  }

  private static pendingStatusLabel(source: Partial<ActivityEventSource>): string {
    return source.pendingReason === 'waitlist'
      ? 'Waiting list'
      : 'Waiting for approval';
  }

  private static pendingSurfaceTone(source: Partial<ActivityEventSource>): InfoCardData['surfaceTone'] {
    return source.pendingReason === 'waitlist' ? 'waitlist' : 'pending';
  }

  private static isFull(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'events') {
      return false;
    }
    const acceptedMembers = this.acceptedMemberCount(row);
    const capacityTotal = this.capacityTotal(row, acceptedMembers);
    return capacityTotal > 0 && acceptedMembers >= capacityTotal;
  }

  private static capacityLabel(row: AppTypes.ActivityListRow): string {
    const acceptedMembers = this.acceptedMemberCount(row);
    return `${acceptedMembers} / ${this.capacityTotal(row, acceptedMembers)}`;
  }

  private static acceptedMemberCount(row: AppTypes.ActivityListRow): number {
    const source = row.source as Partial<ActivityEventSource>;
    if (Number.isFinite(Number(source.acceptedMembers))) {
      return Math.max(0, Math.trunc(Number(source.acceptedMembers)));
    }
    return Math.max(0, Array.isArray(source.acceptedMemberUserIds) ? source.acceptedMemberUserIds.length : 0);
  }

  private static pendingMemberCount(row: AppTypes.ActivityListRow): number {
    const source = row.source as Partial<ActivityEventSource>;
    if (Number.isFinite(Number(source.pendingMembers))) {
      return Math.max(0, Math.trunc(Number(source.pendingMembers)));
    }
    return Math.max(0, Array.isArray(source.pendingMemberUserIds) ? source.pendingMemberUserIds.length : 0);
  }

  private static capacityTotal(row: AppTypes.ActivityListRow, fallbackBase = 0): number {
    const source = row.source as Partial<ActivityEventSource>;
    const capacityMax = Number(source.capacityMax);
    if (Number.isFinite(capacityMax) && capacityMax >= 0) {
      return Math.max(fallbackBase, Math.trunc(capacityMax));
    }
    const capacityTotal = Number(source.capacityTotal);
    if (Number.isFinite(capacityTotal) && capacityTotal >= 0) {
      return Math.max(fallbackBase, Math.trunc(capacityTotal));
    }
    return fallbackBase;
  }

  private static leadingIcon(
    row: AppTypes.ActivityListRow,
    statusTone: InfoCardData['surfaceTone'] | null,
    pending: boolean
  ): string {
    if (statusTone === 'review') {
      return 'pending_actions';
    }
    if (statusTone === 'blocked') {
      return 'block';
    }
    if (statusTone === 'deleted') {
      return 'delete';
    }
    if (statusTone === 'inactive') {
      return 'visibility_off';
    }
    if (pending) {
      return 'pending_actions';
    }
    if (row.type === 'hosting' || row.type === 'events') {
      return this.visibilityIcon(this.visibility(row));
    }
    if (row.type === 'invitations') {
      return 'mail';
    }
    return 'event';
  }

  private static leadingIconTone(
    row: AppTypes.ActivityListRow,
    statusTone: InfoCardData['surfaceTone'] | null,
    pending: boolean
  ): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    if (statusTone === 'review' || pending) {
      return 'pending';
    }
    if (statusTone === 'blocked' || statusTone === 'deleted' || statusTone === 'inactive') {
      return 'default';
    }
    if (row.type !== 'hosting' && row.type !== 'events') {
      return 'default';
    }
    const visibility = this.visibility(row);
    if (visibility === 'Public') {
      return 'public';
    }
    if (visibility === 'Friends only') {
      return 'friends';
    }
    return 'invitation';
  }

  private static visibility(row: AppTypes.ActivityListRow): AppTypes.EventVisibility {
    return ((row.source as { visibility?: AppTypes.EventVisibility }).visibility)
      ?? (row.type === 'hosting' ? 'Invitation only' : 'Public');
  }

  private static visibilityIcon(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  private static menuActions(row: AppTypes.ActivityListRow, activeUserId: string): readonly InfoCardMenuAction[] {
    if (row.type === 'chats' || row.type === 'rates') {
      return [];
    }
    if (this.isTrashed(row)) {
      return this.shouldRestore(row) ? ['restore'] : [];
    }

    const actions: InfoCardMenuAction[] = [];
    if (this.shouldTakeOver(row)) {
      actions.push('takeOver');
    }
    if (this.shouldPublish(row)) {
      actions.push('publish');
    }
    if (this.shouldPrimaryAction(row)) {
      actions.push(row.type === 'invitations' ? 'viewInvitation' : 'editEvent');
    }
    if (this.shouldView(row)) {
      actions.push('view');
    }
    if (this.shouldServiceChat(row)) {
      actions.push(this.serviceChatActionId(row));
    }
    if (this.shouldShare(row)) {
      actions.push('shareEvent');
    }
    if (this.shouldReport(row, activeUserId)) {
      actions.push('reportOrganizer');
    }
    if (row.type === 'invitations') {
      actions.push('accept');
    }
    if (this.shouldSecondaryAction(row)) {
      actions.push(row.type === 'events' ? 'leaveEvent' : row.type === 'hosting' ? 'deleteEvent' : 'rejectInvitation');
    }
    return actions;
  }

  private static serviceChatActionId(row: AppTypes.ActivityListRow): InfoCardMenuAction {
    if (row.type === 'hosting' && row.isAdmin) {
      return 'notifyParticipants';
    }
    if (row.type === 'invitations') {
      return 'askOrganizer';
    }
    return 'contactOrganizer';
  }

  private static shouldTakeOver(row: AppTypes.ActivityListRow): boolean {
    return this.statusCode((row.source as { status?: string | null }).status) === 'UR'
      && row.isAdmin === true
      && (row.type === 'hosting' || row.type === 'events');
  }

  private static shouldPublish(row: AppTypes.ActivityListRow): boolean {
    return !this.isTrashed(row)
      && !this.isPendingReview(row)
      && row.type === 'hosting'
      && row.isAdmin === true
      && this.isDraft(row);
  }

  private static shouldPrimaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isTrashed(row) || this.isPendingReview(row)) {
      return false;
    }
    if ((row.type === 'hosting' || row.type === 'events') && !row.isAdmin) {
      return false;
    }
    return true;
  }

  private static shouldView(row: AppTypes.ActivityListRow): boolean {
    return !this.isTrashed(row) && (row.type === 'hosting' || row.type === 'events');
  }

  private static shouldServiceChat(row: AppTypes.ActivityListRow): boolean {
    return !this.isTrashed(row)
      && (row.type === 'hosting' || row.type === 'events' || row.type === 'invitations');
  }

  private static shouldShare(row: AppTypes.ActivityListRow): boolean {
    return !this.isTrashed(row)
      && (row.type === 'hosting' || row.type === 'events' || row.type === 'invitations');
  }

  private static shouldReport(row: AppTypes.ActivityListRow, activeUserId: string): boolean {
    if (this.isTrashed(row) || (row.type !== 'hosting' && row.type !== 'events' && row.type !== 'invitations')) {
      return false;
    }
    const creatorUserId = `${(row.source as { creatorUserId?: string }).creatorUserId ?? ''}`.trim();
    return !!creatorUserId && creatorUserId !== activeUserId.trim();
  }

  private static shouldSecondaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isTrashed(row)) {
      return false;
    }
    if (this.isPendingReview(row) && row.type !== 'events') {
      return false;
    }
    if (row.type === 'hosting' && !row.isAdmin) {
      return false;
    }
    return true;
  }

  private static shouldRestore(row: AppTypes.ActivityListRow): boolean {
    const status = this.statusCode((row.source as { status?: string | null }).status);
    return status === 'T';
  }

  private static isPendingReview(row: AppTypes.ActivityListRow): boolean {
    const status = this.statusCode((row.source as { status?: string | null }).status);
    return status === 'UR' || status === 'B';
  }

  private static isTrashed(row: AppTypes.ActivityListRow): boolean {
    if ((row.source as { isTrashed?: boolean }).isTrashed === true) {
      return true;
    }
    const status = this.statusCode((row.source as { status?: string | null }).status);
    return status === 'T' || status === 'D' || status === 'I';
  }

  private static statusBadgeLabel(status: string): string {
    switch (status) {
      case 'UR':
        return 'Under Review';
      case 'B':
        return 'Blocked User';
      case 'T':
        return 'Deleted';
      case 'D':
        return 'Deleted User';
      case 'I':
        return 'Inactive User';
      default:
        return '';
    }
  }

  private static statusTone(status: string): Extract<NonNullable<InfoCardData['surfaceTone']>, 'review' | 'blocked' | 'deleted' | 'inactive'> | null {
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
        return null;
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
