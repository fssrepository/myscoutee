import { AppUtils } from '../../../app-utils';
import type { DemoEventRecord } from '../../demo/models/events.model';
import type * as AppTypes from '../models';
import type {
  InfoCardData,
  InfoCardMenuAction
} from '../../../ui';

export interface ActivityEventInfoCardOptions {
  activeUserId?: string | null;
  groupLabel?: string | null;
  state?: InfoCardData['state'];
  rowType?: AppTypes.ActivityListRow['type'];
}

export class ActivityEventInfoCardBuilder {
  static build(
    record: DemoEventRecord,
    options: ActivityEventInfoCardOptions = {}
  ): InfoCardData {
    const rowType = options.rowType ?? this.resolveRowType(record);
    const status = this.statusCode(record.status);
    const statusBadgeLabelKey = this.statusBadgeLabelKey(status);
    const pending = this.isPending(record, rowType, options.activeUserId ?? '');
    const pendingStatusLabelKey = this.pendingStatusLabelKey();
    const title = record.title;

    return {
      rowId: `${rowType}:${record.id}`,
      status,
      groupLabel: options.groupLabel ?? null,
      title,
      surfaceTone: this.surfaceTone(status),
      imageUrl: record.imageUrl?.trim() || null,
      placeholderLabel: record.imageUrl?.trim() ? null : title,
      metaRows: [
        this.dateRangeLabel(record),
        ...this.locationMetaRows(record)
      ],
      description: rowType === 'invitations'
        ? record.creatorName
        : record.eventType === 'slot'
          ? `Slot occurrence${record.subtitle ? ' · ' + record.subtitle : ''}`
          : record.subtitle,
      footerChips: this.footerChips(statusBadgeLabelKey, pending, pendingStatusLabelKey),
      leadingIcon: {
        icon: this.leadingIcon(record, rowType, status, pending)
      },
      mediaStart: this.mediaStart(record, rowType),
      mediaEnd: {
        variant: 'badge',
        tone: this.mediaEndTone(status, record, rowType),
        label: statusBadgeLabelKey || this.capacityLabel(record),
        ariaLabel: statusBadgeLabelKey || 'open.members',
        interactive: !statusBadgeLabelKey,
        pendingCount: statusBadgeLabelKey ? 0 : this.pendingMemberCount(record)
      },
      menuActions: this.menuActions(record, rowType, options.activeUserId ?? ''),
      clickable: false,
      state: options.state ?? 'default'
    };
  }

  private static resolveRowType(record: DemoEventRecord): AppTypes.ActivityListRow['type'] {
    const status = this.statusCode(record.status);
    if (status === 'INV' || record.isInvitation || record.type === 'invitations') {
      return 'invitations';
    }
    if (status === 'H' || status === 'DR' || record.type === 'hosting' || record.isHosting) {
      return 'hosting';
    }
    return 'events';
  }

  private static dateRangeLabel(record: DemoEventRecord): string {
    const start = this.validDate(record.startAtIso);
    const end = this.validDate(record.endAtIso);
    if (!start) {
      return record.timeframe || 'Date unavailable';
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

  private static locationMetaRows(record: DemoEventRecord): string[] {
    const location = `${record.location ?? record.creatorCity ?? ''}`.trim();
    const distanceLabel = this.distanceLabel(record);
    const line = location && distanceLabel
      ? `${location} · ${distanceLabel}`
      : location || distanceLabel;
    return line ? [line] : [];
  }

  private static distanceLabel(record: DemoEventRecord): string {
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

  private static mediaStart(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): InfoCardData['mediaStart'] {
    if (rowType !== 'events' && rowType !== 'invitations') {
      return null;
    }
    return {
      variant: 'avatar',
      label: rowType === 'invitations'
        ? AppUtils.initialsFromText(record.inviter ?? record.creatorName ?? record.title)
        : AppUtils.initialsFromText(record.creatorInitials ?? record.creatorName ?? record.title),
      interactive: false
    };
  }

  private static isDraft(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    return rowType === 'hosting' && (record.published === false || this.statusCode(record.status) === 'DR');
  }

  private static isPending(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type'], activeUserId: string): boolean {
    if (this.isPendingReview(record)) {
      return true;
    }
    if (rowType !== 'events') {
      return false;
    }
    const userId = activeUserId.trim();
    if (!userId || record.acceptedMemberUserIds.includes(userId)) {
      return false;
    }
    return record.pendingMemberUserIds.includes(userId);
  }

  private static pendingStatusLabelKey(): string {
    return 'waiting.for.approval';
  }

  private static isFull(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    return rowType === 'events'
      && record.capacityTotal > 0
      && record.acceptedMembers >= record.capacityTotal;
  }

  private static capacityLabel(record: DemoEventRecord): string {
    return `${Math.max(0, record.acceptedMembers)} / ${Math.max(record.acceptedMembers, record.capacityTotal)}`;
  }

  private static pendingMemberCount(record: DemoEventRecord): number {
    return Math.max(0, Math.trunc(Number(record.pendingMembers) || 0));
  }

  private static surfaceTone(status: string): InfoCardData['surfaceTone'] {
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
        return 'default';
    }
  }

  private static mediaEndTone(
    status: string,
    record: DemoEventRecord,
    rowType: AppTypes.ActivityListRow['type']
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
        return this.isFull(record, rowType) ? 'full' : 'default';
    }
  }

  private static leadingIcon(
    record: DemoEventRecord,
    rowType: AppTypes.ActivityListRow['type'],
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
    if (rowType === 'hosting' || rowType === 'events') {
      return this.visibilityIcon(record.visibility);
    }
    if (rowType === 'invitations') {
      return 'mail';
    }
    return 'event';
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

  private static menuActions(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type'], activeUserId: string): readonly InfoCardMenuAction[] {
    if (this.isTrashed(record)) {
      return this.shouldRestore(record) ? ['restore'] : [];
    }
    const actions: InfoCardMenuAction[] = [];
    if (this.shouldTakeOver(record, rowType)) {
      actions.push('takeOver');
    }
    if (this.shouldPublish(record, rowType)) {
      actions.push('publish');
    }
    if (this.shouldPrimaryAction(record, rowType)) {
      actions.push(rowType === 'invitations' ? 'viewInvitation' : 'editEvent');
    }
    if (this.shouldView(record, rowType)) {
      actions.push('view');
    }
    if (rowType === 'hosting' || rowType === 'events' || rowType === 'invitations') {
      actions.push(this.serviceChatActionId(rowType, record.isAdmin));
      actions.push('shareEvent');
    }
    if (this.shouldReport(record, activeUserId)) {
      actions.push('reportOrganizer');
    }
    if (rowType === 'invitations') {
      actions.push('accept');
    }
    if (this.shouldSecondaryAction(record, rowType)) {
      actions.push(rowType === 'events' ? 'leaveEvent' : rowType === 'hosting' ? 'deleteEvent' : 'rejectInvitation');
    }
    return actions;
  }

  private static serviceChatActionId(rowType: AppTypes.ActivityListRow['type'], isAdmin: boolean): InfoCardMenuAction {
    if (rowType === 'hosting' && isAdmin) {
      return 'notifyParticipants';
    }
    if (rowType === 'invitations') {
      return 'askOrganizer';
    }
    return 'contactOrganizer';
  }

  private static shouldTakeOver(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    return this.statusCode(record.status) === 'UR'
      && record.isAdmin === true
      && (rowType === 'hosting' || rowType === 'events');
  }

  private static shouldPublish(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    return !this.isTrashed(record)
      && !this.isPendingReview(record)
      && rowType === 'hosting'
      && record.isAdmin === true
      && this.isDraft(record, rowType);
  }

  private static shouldPrimaryAction(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    if (this.isTrashed(record) || this.isPendingReview(record)) {
      return false;
    }
    if ((rowType === 'hosting' || rowType === 'events') && !record.isAdmin) {
      return false;
    }
    return true;
  }

  private static shouldView(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    return !this.isTrashed(record) && (rowType === 'hosting' || rowType === 'events');
  }

  private static shouldReport(record: DemoEventRecord, activeUserId: string): boolean {
    const creatorUserId = record.creatorUserId.trim();
    return !this.isTrashed(record) && !!creatorUserId && creatorUserId !== activeUserId.trim();
  }

  private static shouldSecondaryAction(record: DemoEventRecord, rowType: AppTypes.ActivityListRow['type']): boolean {
    if (this.isTrashed(record)) {
      return false;
    }
    if (this.isPendingReview(record) && rowType !== 'events') {
      return false;
    }
    if (rowType === 'hosting' && !record.isAdmin) {
      return false;
    }
    return true;
  }

  private static shouldRestore(record: DemoEventRecord): boolean {
    return this.statusCode(record.status) === 'T';
  }

  private static isPendingReview(record: DemoEventRecord): boolean {
    const status = this.statusCode(record.status);
    return status === 'UR' || status === 'B';
  }

  private static isTrashed(record: DemoEventRecord): boolean {
    const status = this.statusCode(record.status);
    return record.isTrashed === true || status === 'T' || status === 'D' || status === 'I';
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
