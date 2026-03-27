import { Directive } from '@angular/core';

import { AppUtils } from '../../../shared/app-utils';
import type {
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../../../shared/core/base/interfaces/activity-feed.interface';
import type { ActivitiesEventSyncPayload } from '../../../shared/core/base/models';
import type * as AppTypes from '../../../shared/core/base/models';
import type {
  InfoCardData,
  InfoCardMenuAction,
  InfoCardMenuActionEvent
} from '../../../shared/ui';
import {
  ActivityEventBuilder,
  ActivityMembersBuilder
} from '../../../shared/core';
import { ActivitiesPopupBase } from './activities-popup.base';

type ActivityInfoCardActionId = 'publish' | 'primary' | 'view' | 'approve' | 'secondary' | 'restore';

@Directive()
export abstract class ActivitiesPopupEventsBase extends ActivitiesPopupBase {
  protected override activityLeadingIcon(row: AppTypes.ActivityListRow): string {
    if (this.isPendingActivityRow(row)) {
      return 'pending_actions';
    }
    if (row.type === 'hosting' || row.type === 'events') {
      return this.eventVisibilityIcon(this.activityVisibility(row));
    }
    return this.activityTypeIcon(row);
  }

  private activityVisibility(row: AppTypes.ActivityListRow): AppTypes.EventVisibility {
    return ((row.source as { visibility?: AppTypes.EventVisibility }).visibility)
      ?? this.eventVisibilityById[row.id]
      ?? (row.type === 'hosting' ? 'Invitation only' : 'Public');
  }

  protected activityTypeIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'event';
    }
    if (row.type === 'hosting') {
      return 'stadium';
    }
    if (row.type === 'invitations') {
      return 'mail';
    }
    if (row.type === 'rates') {
      return 'star';
    }
    return 'chat';
  }

  private eventVisibilityIcon(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'public';
      case 'Friends only':
        return 'groups';
      default:
        return 'mail_lock';
    }
  }

  protected override activityLeadingIconTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    if (this.isPendingActivityRow(row)) {
      return 'pending';
    }
    if (row.type !== 'hosting' && row.type !== 'events') {
      return 'default';
    }
    const visibility = this.activityVisibility(row);
    if (visibility === 'Public') {
      return 'public';
    }
    if (visibility === 'Friends only') {
      return 'friends';
    }
    return 'invitation';
  }

  protected override isPendingActivityRow(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'events') {
      return false;
    }
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return false;
    }
    const source = row.source as { pendingMemberUserIds?: readonly string[] };
    return Array.isArray(source.pendingMemberUserIds) && source.pendingMemberUserIds.includes(activeUserId);
  }

  protected override activityEventInfoCardMenuActions(row: AppTypes.ActivityListRow): readonly InfoCardMenuAction[] {
    if (!this.canManageActivityRow(row)) {
      return [];
    }
    if (this.isActivityRowTrashed(row)) {
      return this.shouldShowActivityRestoreAction(row)
        ? [{ id: 'restore', label: 'Restore', icon: 'restore_from_trash' }]
        : [];
    }

    const actions: InfoCardMenuAction[] = [];
    if (this.shouldShowActivityPublishAction(row)) {
      actions.push({ id: 'publish', label: 'Publish', icon: 'campaign', tone: 'accent' });
    }
    if (this.shouldShowActivityPrimaryAction(row)) {
      actions.push({
        id: 'primary',
        label: this.activityPrimaryActionLabel(row),
        icon: this.activityPrimaryActionIcon(row)
      });
    }
    if (this.shouldShowActivityViewAction(row)) {
      actions.push({ id: 'view', label: 'View Event', icon: 'visibility' });
    }
    if (this.shouldShowActivityApproveAction(row)) {
      actions.push({ id: 'approve', label: 'Accept', icon: 'done', tone: 'accent' });
    }
    if (this.shouldShowActivitySecondaryAction(row)) {
      actions.push({
        id: 'secondary',
        label: this.activitySecondaryActionLabel(row),
        icon: this.activitySecondaryActionIcon(row),
        tone: this.isExitActivityRow(row) ? 'warning' : 'destructive'
      });
    }
    return actions;
  }

  protected canManageActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type !== 'chats' && row.type !== 'rates';
  }

  protected shouldShowActivityPublishAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'hosting' && !!row.isAdmin && !this.isHostingPublished(row.id);
  }

  protected shouldShowActivityPrimaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isActivityRowTrashed(row)) {
      return false;
    }
    if ((row.type === 'hosting' || row.type === 'events') && !row.isAdmin) {
      return false;
    }
    return true;
  }

  protected shouldShowActivityViewAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && (row.type === 'hosting' || row.type === 'events');
  }

  protected shouldShowActivityApproveAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'invitations';
  }

  protected shouldShowActivitySecondaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isActivityRowTrashed(row)) {
      return false;
    }
    if (row.type === 'hosting' && !row.isAdmin) {
      return false;
    }
    return true;
  }

  protected shouldShowActivityRestoreAction(row: AppTypes.ActivityListRow): boolean {
    return this.isActivityRowTrashed(row);
  }

  protected isExitActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events';
  }

  protected activityPrimaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') { return 'edit'; }
    if (row.type === 'invitations') { return 'visibility'; }
    return 'edit';
  }

  protected activityPrimaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') { return 'Edit Event'; }
    if (row.type === 'invitations') { return 'View Invitation'; }
    return 'Edit Event';
  }

  protected activitySecondaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') { return 'exit_to_app'; }
    if (row.type === 'hosting') { return 'delete'; }
    return 'block';
  }

  protected activitySecondaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') { return 'Leave Event'; }
    if (row.type === 'hosting') { return 'Delete Event'; }
    return 'Reject Invitation';
  }

  protected onActivityEventInfoCardMenuAction(row: AppTypes.ActivityListRow, action: InfoCardMenuActionEvent): void {
    switch (action.action.id as ActivityInfoCardActionId) {
      case 'publish':
        this.runActivityItemPublishAction(row);
        break;
      case 'primary':
        this.runActivityItemPrimaryAction(row);
        break;
      case 'view':
        this.runActivityItemViewAction(row);
        break;
      case 'approve':
        this.runActivityItemApproveAction(row);
        break;
      case 'secondary':
        this.runActivityItemSecondaryAction(row);
        break;
      case 'restore':
        this.runActivityItemRestoreAction(row);
        break;
    }
  }

  protected runActivityItemPrimaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, false);
  }

  protected runActivityItemViewAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  protected runActivityItemApproveAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    if (row.type !== 'invitations') {
      this.openActivityRowInEventModule(row, true);
      return;
    }
    this.confirmationDialogService.open({
      title: 'Accept invitation?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Accept',
      busyConfirmLabel: 'Accepting...',
      confirmTone: 'accent',
      failureMessage: 'Unable to accept invitation.',
      onConfirm: () => this.confirmActivityInvitationApproval(row)
    });
  }

  protected runActivityItemRestoreAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    void this.restoreActivityRow(row);
  }

  protected runActivityItemSecondaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.confirmationDialogService.open({
      title: this.activitySecondaryConfirmTitle(row),
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: this.activitySecondaryConfirmActionLabel(row),
      busyConfirmLabel: this.activitySecondaryConfirmBusyLabel(row),
      confirmTone: 'danger',
      failureMessage: this.activitySecondaryConfirmFailureMessage(row),
      onConfirm: () => this.confirmActivitySecondaryAction(row)
    });
  }

  protected runActivityItemPublishAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.confirmationDialogService.open({
      title: 'Publish event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Publish',
      busyConfirmLabel: 'Publishing...',
      confirmTone: 'accent',
      failureMessage: 'Unable to publish event.',
      onConfirm: () => this.confirmActivityPublish(row)
    });
  }

  private async confirmActivityPublish(row: AppTypes.ActivityListRow): Promise<void> {
    await this.eventsService.publishItem(this.activeUser.id, row.type as any, row.id);
    this.publishedHostingIds = new Set([...this.publishedHostingIds, row.id]);

    this.hostingItems = this.hostingItems.map(item =>
      item.id === row.id ? { ...item, published: true } : item
    );

    if (this.activitiesEventScope === 'drafts') {
      this.removeVisibleActivityRow(row);
    } else {
      const smartList = this.activitiesSmartList;
      if (smartList) {
        const currentItems = [...smartList.itemsSnapshot()];
        const rowIndex = currentItems.findIndex(item => item.id === row.id);
        if (rowIndex >= 0) {
          const updatedRow = { ...currentItems[rowIndex] };
          updatedRow.source = { ...updatedRow.source as any, published: true };
          const nextItems = [...currentItems];
          nextItems[rowIndex] = updatedRow;
          this.replaceVisibleActivityItems(nextItems, 0);
        }
      }
    }

    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private activitySecondaryConfirmTitle(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'Leave event?';
    }
    if (row.type === 'invitations') {
      return 'Reject invitation?';
    }
    return 'Delete event?';
  }

  private activitySecondaryConfirmActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'Leave';
    }
    if (row.type === 'invitations') {
      return 'Reject';
    }
    return 'Delete';
  }

  private activitySecondaryConfirmBusyLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'Leaving...';
    }
    if (row.type === 'invitations') {
      return 'Rejecting...';
    }
    return 'Deleting...';
  }

  private activitySecondaryConfirmFailureMessage(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') {
      return 'Unable to leave event.';
    }
    if (row.type === 'invitations') {
      return 'Unable to reject invitation.';
    }
    return 'Unable to delete event.';
  }

  private async confirmActivitySecondaryAction(row: AppTypes.ActivityListRow): Promise<void> {
    await this.persistActivityRowTrash(row);
    this.markActivityRowTrashed(row);
    this.removeVisibleActivityRow(row);
    this.cdr.markForCheck();
  }

  private async confirmActivityInvitationApproval(row: AppTypes.ActivityListRow): Promise<void> {
    const syncPayload = await this.buildAcceptedInvitationSyncPayload(row);
    await Promise.all([
      this.eventsService.syncEventSnapshot(syncPayload),
      this.activityMembersService.syncEventMembersFromEventSnapshot(syncPayload)
    ]);
    this.applyActivitiesEventSync(syncPayload);
    this.cdr.markForCheck();
  }

  private async buildAcceptedInvitationSyncPayload(
    row: AppTypes.ActivityListRow
  ): Promise<Omit<ActivitiesEventSyncPayload, 'syncKey'>> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      throw new Error('Unable to resolve active user.');
    }

    const invitationSource = row.source as InvitationMenuItem;
    const relatedSource = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    }) ?? ActivityEventBuilder.buildInvitationPreviewEventSource(invitationSource);
    const record = await this.eventsService.queryKnownItemById(activeUserId, row.id);

    const existingAcceptedMemberUserIds = this.uniqueUserIds([
      ...(record?.acceptedMemberUserIds ?? relatedSource.acceptedMemberUserIds ?? [])
    ]);
    const existingPendingMemberUserIds = this.uniqueUserIds([
      ...(record?.pendingMemberUserIds ?? relatedSource.pendingMemberUserIds ?? [])
    ]);
    const activeUserWasAccepted = existingAcceptedMemberUserIds.includes(activeUserId);
    const activeUserWasPending = existingPendingMemberUserIds.includes(activeUserId) || !activeUserWasAccepted;
    const nextAcceptedMemberUserIds = activeUserWasAccepted
      ? [...existingAcceptedMemberUserIds]
      : this.uniqueUserIds([...existingAcceptedMemberUserIds, activeUserId]);
    const nextPendingMemberUserIds = existingPendingMemberUserIds.filter(userId => userId !== activeUserId);

    const acceptedMembersBase = this.chatCountValue(record?.acceptedMembers ?? relatedSource.acceptedMembers);
    const pendingMembersBase = this.chatCountValue(
      record?.pendingMembers
      ?? relatedSource.pendingMembers
      ?? (activeUserWasPending ? 1 : nextPendingMemberUserIds.length)
    );
    const nextAcceptedMembers = activeUserWasAccepted
      ? Math.max(acceptedMembersBase, nextAcceptedMemberUserIds.length)
      : Math.max(nextAcceptedMemberUserIds.length, acceptedMembersBase + 1);
    const nextPendingMembers = activeUserWasAccepted
      ? Math.max(pendingMembersBase, nextPendingMemberUserIds.length)
      : Math.max(0, Math.max(pendingMembersBase, activeUserWasPending ? 1 : 0) - 1);

    const title = record?.title ?? relatedSource.title ?? invitationSource.description ?? row.title;
    const shortDescription = record?.subtitle
      ?? relatedSource.shortDescription
      ?? row.subtitle
      ?? `Invited by ${invitationSource.inviter}`;
    const timeframe = record?.timeframe ?? relatedSource.timeframe ?? invitationSource.when ?? row.detail;
    const startAt = record?.startAtIso ?? relatedSource.startAt ?? invitationSource.startAt ?? row.dateIso;
    const endAt = record?.endAtIso ?? relatedSource.endAt ?? invitationSource.endAt ?? startAt;
    const distanceKmRaw = record?.distanceKm ?? relatedSource.distanceKm ?? invitationSource.distanceKm ?? row.distanceKm;
    const distanceKm = Number.isFinite(Number(distanceKmRaw)) ? Math.max(0, Number(distanceKmRaw)) : 0;
    const creatorName = record?.creatorName?.trim() || invitationSource.inviter?.trim() || title;
    const creatorInitials = record?.creatorInitials?.trim() || relatedSource.avatar?.trim() || AppUtils.initialsFromText(creatorName);
    const capacityTotal = Math.max(
      nextAcceptedMembers,
      this.chatCountValue(record?.capacityTotal ?? relatedSource.capacityTotal ?? relatedSource.capacityMax)
    );

    return {
      id: row.id,
      target: 'events',
      title,
      shortDescription,
      timeframe,
      activity: this.chatCountValue(record?.activity ?? relatedSource.activity ?? invitationSource.unread ?? row.unread),
      isAdmin: false,
      startAt,
      endAt,
      distanceKm,
      imageUrl: record?.imageUrl ?? relatedSource.imageUrl ?? invitationSource.imageUrl ?? '',
      acceptedMembers: nextAcceptedMembers,
      pendingMembers: nextPendingMembers,
      capacityTotal,
      capacityMin: record?.capacityMin ?? relatedSource.capacityMin ?? null,
      capacityMax: record?.capacityMax ?? relatedSource.capacityMax ?? capacityTotal,
      autoInviter: record?.autoInviter ?? relatedSource.autoInviter,
      frequency: record?.frequency ?? relatedSource.frequency,
      ticketing: record?.ticketing ?? relatedSource.ticketing,
      visibility: record?.visibility ?? relatedSource.visibility,
      blindMode: record?.blindMode ?? relatedSource.blindMode,
      published: record?.published ?? relatedSource.published ?? true,
      creatorUserId: record?.creatorUserId ?? relatedSource.creatorUserId,
      creatorName,
      creatorInitials,
      creatorGender: record?.creatorGender,
      creatorCity: record?.creatorCity,
      location: record?.location ?? relatedSource.location ?? invitationSource.location,
      locationCoordinates: record?.locationCoordinates ?? relatedSource.locationCoordinates ?? invitationSource.locationCoordinates,
      sourceLink: record?.sourceLink ?? relatedSource.sourceLink ?? invitationSource.sourceLink,
      acceptedMemberUserIds: nextAcceptedMemberUserIds,
      pendingMemberUserIds: nextPendingMemberUserIds,
      topics: [...(record?.topics ?? relatedSource.topics ?? [])],
      subEvents: Array.isArray(record?.subEvents)
        ? this.cloneSyncedSubEventForms(record.subEvents)
        : (Array.isArray(relatedSource.subEvents) ? this.cloneSyncedSubEventForms(relatedSource.subEvents) : undefined),
      subEventsDisplayMode: record?.subEventsDisplayMode ?? relatedSource.subEventsDisplayMode
    };
  }

  protected override isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean {
    return Boolean(this.trashedActivityRowsByKey[`${type}:${id}`]);
  }

  protected isActivityRowTrashed(row: AppTypes.ActivityListRow): boolean {
    if (Boolean((row.source as { isTrashed?: boolean }).isTrashed)) {
      return true;
    }
    return this.isActivityIdentityTrashed(row.type, row.id);
  }

  private trashedActivityRows(): AppTypes.ActivityListRow[] {
    return Object.values(this.trashedActivityRowsByKey);
  }

  protected override trashedActivityCount(): number {
    return this.trashedActivityRows().length;
  }

  private markActivityRowTrashed(row: AppTypes.ActivityListRow): void {
    this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = { ...row };
    this.refreshSectionBadges();
  }

  private unmarkActivityRowTrashed(row: AppTypes.ActivityListRow): void {
    delete this.trashedActivityRowsByKey[this.activityRowIdentity(row)];
    this.refreshSectionBadges();
  }

  private async persistActivityRowTrash(row: AppTypes.ActivityListRow): Promise<void> {
    if (row.type === 'events' || row.type === 'hosting' || row.type === 'invitations') {
      await this.eventsService.trashItem(this.activeUser.id, row.type, row.id);
    }
  }

  private async restoreActivityRow(row: AppTypes.ActivityListRow): Promise<void> {
    if (row.type === 'events' || row.type === 'hosting' || row.type === 'invitations') {
      await this.eventsService.restoreItem(this.activeUser.id, row.type, row.id);
    }
    this.unmarkActivityRowTrashed(row);
    this.removeVisibleActivityRow(row);
    this.cdr.markForCheck();
  }

  protected override onActivityRowClick(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    if (row.type === 'chats') {
      this.openActivityChat(row.source as ChatMenuItem);
      return;
    }
    if (row.type === 'rates') {
      this.openActivityRateEditor(row, event as Event);
      return;
    }
    this.openActivityRowInEventModule(row, true);
  }

  protected override openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.popupCtx.requestActivitiesNavigation({
      type: 'members',
      ownerId: row.id,
      ownerType: 'event',
      subtitle: row.title,
      canManage: row.isAdmin === true
    });
  }

  protected canShowActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.canApproveActivityMember(entry) || this.canDeleteActivityMember(entry);
  }

  protected toggleActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canShowActivityMemberActionMenu(entry)) {
      return;
    }
    if (this.inlineItemActionMenu?.scope === 'activityMember' && this.inlineItemActionMenu.id === entry.userId) {
      this.inlineItemActionMenu = null;
      return;
    }
    this.inlineItemActionMenu = {
      scope: 'activityMember',
      id: entry.userId,
      title: entry.name,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isActivityMemberActionMenuOpen(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember' && this.inlineItemActionMenu.id === entry.userId;
  }

  protected isActivityMemberActionMenuOpenUp(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember'
      && this.inlineItemActionMenu.id === entry.userId
      && this.inlineItemActionMenu.openUp;
  }

  protected canApproveActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin !== true) {
      return false;
    }
    return entry.status === 'pending' && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  protected canDeleteActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin === true) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected activityMemberMenuDeleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  protected activityMemberAge(entry: AppTypes.ActivityMemberEntry): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  protected activityMemberRoleLabel(entry: AppTypes.ActivityMemberEntry): string {
    return entry.role === 'Admin' ? 'Admin' : 'Member';
  }

  protected activityMemberStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  protected memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'admin_panel_settings' : 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  protected memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  protected memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  protected memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'Admin' : 'Member';
    }
    return this.activityMemberStatusLabel(entry);
  }

  protected approveActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canApproveActivityMember(entry)) {
      return;
    }
    const nowIso = AppUtils.toIsoDateTime(new Date());
    this.selectedActivityMembers = ActivityMembersBuilder.sortActivityMembersByActionTimeAsc(this.selectedActivityMembers.map(item =>
      item.id === entry.id
        ? {
            ...item,
            status: 'accepted',
            pendingSource: null,
            requestKind: null,
            actionAtIso: nowIso
          }
        : item
    ));
    this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    this.persistSelectedActivityMembers();
    this.inlineItemActionMenu = null;
  }

  protected removeActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canDeleteActivityMember(entry)) {
      return;
    }
    this.pendingActivityMemberDelete = entry;
    this.inlineItemActionMenu = null;
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileView || typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const actionWrap = (trigger?.closest('.experience-item-actions') as HTMLElement | null) ?? trigger;
    if (!actionWrap) {
      return false;
    }
    const rect = actionWrap.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 248;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }

  protected override openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void {
    const source = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    });
    if (!source) {
      return;
    }
    const effectiveReadOnly = row.type === 'invitations'
      ? true
      : readOnly;
    if (effectiveReadOnly) {
      this.eventEditorService.openView(source);
      return;
    }
    this.eventEditorService.openEdit(source);
  }
}
