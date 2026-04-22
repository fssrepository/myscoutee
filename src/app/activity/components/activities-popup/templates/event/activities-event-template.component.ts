
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { AppUtils } from '../../../../../shared/app-utils';
import type {
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { ActivitiesEventSyncPayload } from '../../../../../shared/core/base/models';
import type * as AppTypes from '../../../../../shared/core/base/models';
import {
  ActivityEventBuilder,
  ActivityMembersBuilder
} from '../../../../../shared/core';
import {
  InfoCardComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent
} from '../../../../../shared/ui';
import { buildActivitiesEventInfoCard } from './activities-event-template.builder';

export interface ActivitiesEventTemplateContext {
  getActivityRowIdentity: (row: AppTypes.ActivityListRow) => string;
  getActivityImageUrl: (row: AppTypes.ActivityListRow) => string | null;
  getActivityCalendarDateRange: (row: AppTypes.ActivityListRow) => { start: Date; end: Date } | null;
  isActivityDraft: (row: AppTypes.ActivityListRow) => boolean;
  isPendingActivityRow: (row: AppTypes.ActivityListRow) => boolean;
  isActivityFull: (row: AppTypes.ActivityListRow) => boolean;
  getActivityLeadingIcon: (row: AppTypes.ActivityListRow) => string;
  getActivityLeadingIconTone: (row: AppTypes.ActivityListRow) => NonNullable<InfoCardData['leadingIcon']>['tone'];
  shouldShowActivitySourceIcon: (row: AppTypes.ActivityListRow) => boolean;
  getActivitySourceAvatarTone: (row: AppTypes.ActivityListRow) => NonNullable<InfoCardData['mediaStart']>['tone'] | null | undefined;
  getActivitySourceAvatarLabel: (row: AppTypes.ActivityListRow) => string;
  getActivityCapacityLabel: (row: AppTypes.ActivityListRow) => string;
  getActivityPendingMemberCount: (row: AppTypes.ActivityListRow) => number;
  getActivityEventInfoCardMenuActions: (row: AppTypes.ActivityListRow) => readonly InfoCardMenuAction[];
}

@Component({
  selector: 'app-activities-event-template',
  standalone: true,
  imports: [InfoCardComponent],
  templateUrl: './activities-event-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventTemplateComponent implements OnChanges {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() context: ActivitiesEventTemplateContext | null = null;
  @Input() cardRevision = 0;

  @Output() readonly mediaEndClick = new EventEmitter<void>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();

  protected card: InfoCardData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['context'] || changes['cardRevision']) {
      this.card = this.buildCard();
    }
  }

  private buildCard(): InfoCardData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context) {
      return null;
    }
    return buildActivitiesEventInfoCard(row, {
      groupLabel: this.groupLabel,
      rowId: context.getActivityRowIdentity(row),
      imageUrl: context.getActivityImageUrl(row),
      range: context.getActivityCalendarDateRange(row),
      isDraft: context.isActivityDraft(row),
      isPending: context.isPendingActivityRow(row),
      isFull: context.isActivityFull(row),
      leadingIcon: context.getActivityLeadingIcon(row),
      leadingTone: context.getActivityLeadingIconTone(row),
      showSourceIcon: context.shouldShowActivitySourceIcon(row),
      sourceAvatarTone: context.getActivitySourceAvatarTone(row),
      sourceAvatarLabel: context.getActivitySourceAvatarLabel(row),
      capacityLabel: context.getActivityCapacityLabel(row),
      pendingCount: context.getActivityPendingMemberCount(row),
      menuActions: context.getActivityEventInfoCardMenuActions(row)
    });
  }

  protected onMediaEndClick(): void {
    this.mediaEndClick.emit();
  }

  protected onMenuAction(event: InfoCardMenuActionEvent): void {
    this.menuAction.emit(event);
  }
}

type ActivityInfoCardActionId = 'publish' | 'primary' | 'view' | 'approve' | 'secondary' | 'restore';
type ActivitiesEventsHost = any;

export class ActivitiesEventsController {
  constructor(private readonly host: ActivitiesEventsHost) {}

  private get activeUser() { return this.host.activeUser as any; }
  private get activitiesEventScope() { return this.host.activitiesEventScope as AppTypes.ActivitiesEventScope; }
  private set activitiesEventScope(value: AppTypes.ActivitiesEventScope) { this.host.activitiesEventScope = value; }
  private get activitiesRates() { return this.host.activitiesRates; }
  private get activitiesSmartList() { return this.host.activitiesSmartList; }
  private get activityMembersByRowId() { return this.host.activityMembersByRowId as Record<string, AppTypes.ActivityMemberEntry[]>; }
  private get activityMembersService() { return this.host.activityMembersService; }
  private get cdr() { return this.host.cdr; }
  private get confirmationDialogService() { return this.host.confirmationDialogService; }
  private get eventCheckoutDialogService() { return this.host.eventCheckoutDialogService; }
  private get eventEditorService() { return this.host.eventEditorService; }
  private get eventItems() { return this.host.eventItems as EventMenuItem[]; }
  private get eventVisibilityById() { return this.host.eventVisibilityById as Record<string, AppTypes.EventVisibility>; }
  private get eventsService() { return this.host.eventsService; }
  private get hostingItems() { return this.host.hostingItems as HostingMenuItem[]; }
  private set hostingItems(value: HostingMenuItem[]) { this.host.hostingItems = value; }
  private get inlineItemActionMenu() { return this.host.inlineItemActionMenu; }
  private set inlineItemActionMenu(value: any) { this.host.inlineItemActionMenu = value; }
  private get invitationItems() { return this.host.invitationItems as InvitationMenuItem[]; }
  private get isMobileView() { return this.host.isMobileView as boolean; }
  private get pendingActivityMemberDelete() { return this.host.pendingActivityMemberDelete as AppTypes.ActivityMemberEntry | null; }
  private set pendingActivityMemberDelete(value: AppTypes.ActivityMemberEntry | null) { this.host.pendingActivityMemberDelete = value; }
  private get popupCtx() { return this.host.popupCtx; }
  private get publishedHostingIds() { return this.host.publishedHostingIds as ReadonlySet<string>; }
  private set publishedHostingIds(value: ReadonlySet<string>) { this.host.publishedHostingIds = value; }
  private get selectedActivityMembers() { return this.host.selectedActivityMembers as AppTypes.ActivityMemberEntry[]; }
  private set selectedActivityMembers(value: AppTypes.ActivityMemberEntry[]) { this.host.selectedActivityMembers = value; }
  private get selectedActivityMembersRow() { return this.host.selectedActivityMembersRow as AppTypes.ActivityListRow | null; }
  private get selectedActivityMembersRowId() { return this.host.selectedActivityMembersRowId as string | null; }
  private get trashedActivityRowsByKey() { return this.host.trashedActivityRowsByKey as Record<string, AppTypes.ActivityListRow>; }
  private get users() { return this.host.users as any[]; }

  private activityRowIdentity(row: AppTypes.ActivityListRow): string { return this.host.activityRowIdentity(row); }
  private applyActivitiesEventSync(sync: ActivitiesEventSyncPayload): void { this.host.applyActivitiesEventSync(sync); }
  private chatCountValue(value: unknown): number { return this.host.chatCountValue(value); }
  private cloneSyncedSubEventForms(items: AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] { return this.host.cloneSyncedSubEventForms(items); }
  private isHostingPublished(id: string): boolean { return this.host.isHostingPublished(id); }
  private openActivityChat(chat: ChatMenuItem): void { this.host.openActivityChat(chat); }
  private persistSelectedActivityMembers(): void { this.host.persistSelectedActivityMembers(); }
  private refreshSectionBadges(): void { this.host.refreshSectionBadges(); }
  private removeVisibleActivityRow(row: AppTypes.ActivityListRow): void { this.host.removeVisibleActivityRow(row); }
  private replaceVisibleActivityItems(items: readonly AppTypes.ActivityListRow[], totalDelta = 0): void {
    this.host.replaceVisibleActivityItems(items, totalDelta);
  }
  private uniqueUserIds(userIds: readonly string[]): string[] { return this.host.uniqueUserIds(userIds); }

  public activityLeadingIcon(row: AppTypes.ActivityListRow): string {
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

  public activityTypeIcon(row: AppTypes.ActivityListRow): string {
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

  public activityLeadingIconTone(row: AppTypes.ActivityListRow): NonNullable<InfoCardData['leadingIcon']>['tone'] {
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

  public isPendingActivityRow(row: AppTypes.ActivityListRow): boolean {
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

  public activityEventInfoCardMenuActions(row: AppTypes.ActivityListRow): readonly InfoCardMenuAction[] {
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

  public canManageActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type !== 'chats' && row.type !== 'rates';
  }

  public shouldShowActivityPublishAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'hosting' && !!row.isAdmin && !this.isHostingPublished(row.id);
  }

  public shouldShowActivityPrimaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isActivityRowTrashed(row)) {
      return false;
    }
    if ((row.type === 'hosting' || row.type === 'events') && !row.isAdmin) {
      return false;
    }
    return true;
  }

  public shouldShowActivityViewAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && (row.type === 'hosting' || row.type === 'events');
  }

  public shouldShowActivityApproveAction(row: AppTypes.ActivityListRow): boolean {
    return !this.isActivityRowTrashed(row) && row.type === 'invitations';
  }

  public shouldShowActivitySecondaryAction(row: AppTypes.ActivityListRow): boolean {
    if (this.isActivityRowTrashed(row)) {
      return false;
    }
    if (row.type === 'hosting' && !row.isAdmin) {
      return false;
    }
    return true;
  }

  public shouldShowActivityRestoreAction(row: AppTypes.ActivityListRow): boolean {
    return this.isActivityRowTrashed(row);
  }

  public isExitActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events';
  }

  public activityPrimaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') { return 'edit'; }
    if (row.type === 'invitations') { return 'visibility'; }
    return 'edit';
  }

  public activityPrimaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting') { return 'Edit Event'; }
    if (row.type === 'invitations') { return 'View Invitation'; }
    return 'Edit Event';
  }

  public activitySecondaryActionIcon(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') { return 'exit_to_app'; }
    if (row.type === 'hosting') { return 'delete'; }
    return 'block';
  }

  public activitySecondaryActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'events') { return 'Leave Event'; }
    if (row.type === 'hosting') { return 'Delete Event'; }
    return 'Reject Invitation';
  }

  public onActivityEventInfoCardMenuAction(row: AppTypes.ActivityListRow, action: InfoCardMenuActionEvent): void {
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

  public runActivityItemPrimaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.openActivityRowInEventModule(row, false);
  }

  public runActivityItemViewAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  public runActivityItemApproveAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    if (row.type !== 'invitations') {
      this.openActivityRowInEventModule(row, true);
      return;
    }
    void this.openInvitationApprovalFlow(row);
  }

  private async openInvitationApprovalFlow(row: AppTypes.ActivityListRow): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    const record = activeUserId ? await this.eventsService.queryKnownItemById(activeUserId, row.id) : null;
    if (record && this.shouldUseCheckoutFlow(record)) {
      this.eventCheckoutDialogService.open({
        mode: 'invitation',
        userId: activeUserId,
        record,
        title: 'Accept invitation?',
        subtitle: record.timeframe,
        confirmLabel: 'Accept',
        busyConfirmLabel: 'Accepting...',
        failureMessage: 'Unable to accept invitation.',
        onSubmit: (selection: AppTypes.EventCheckoutSelection) => this.confirmActivityInvitationApproval(row, selection)
      });
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

  public runActivityItemRestoreAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    void this.restoreActivityRow(row);
  }

  public runActivityItemSecondaryAction(row: AppTypes.ActivityListRow, event?: Event): void {
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

  public runActivityItemPublishAction(row: AppTypes.ActivityListRow, event?: Event): void {
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

  private shouldUseCheckoutFlow(record: {
    upcomingSlots?: AppTypes.EventSlotOccurrence[] | null;
    policies?: AppTypes.EventPolicyItem[] | null;
    subEvents?: AppTypes.SubEventFormItem[] | null;
    pricing?: AppTypes.PricingConfig | null;
  }): boolean {
    if ((record?.upcomingSlots?.length ?? 0) > 0) {
      return true;
    }
    if ((record?.policies?.length ?? 0) > 0) {
      return true;
    }
    if ((record?.subEvents ?? []).some((item: AppTypes.SubEventFormItem) => item.optional)) {
      return true;
    }
    return Boolean(record?.pricing?.enabled && (Number(record?.pricing?.basePrice) || 0) > 0);
  }

  private async confirmActivityInvitationApproval(
    row: AppTypes.ActivityListRow,
    selection?: AppTypes.EventCheckoutSelection | null
  ): Promise<void> {
    const syncPayload = await this.buildAcceptedInvitationSyncPayload(row, selection);
    await Promise.all([
      this.eventsService.syncEventSnapshot(syncPayload),
      this.activityMembersService.syncEventMembersFromEventSnapshot(syncPayload)
    ]);
    this.applyActivitiesEventSync(syncPayload);
    this.cdr.markForCheck();
  }

  private async buildAcceptedInvitationSyncPayload(
    row: AppTypes.ActivityListRow,
    selection?: AppTypes.EventCheckoutSelection | null
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
    const selectedSlot = selection?.slotSourceId
      ? (record?.upcomingSlots ?? []).find((item: AppTypes.EventSlotOccurrence) => item.id === selection.slotSourceId) ?? null
      : null;

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
      pricing: record?.pricing ?? relatedSource.pricing,
      policies: Array.isArray(record?.policies)
        ? record.policies.map((item: AppTypes.EventPolicyItem) => ({ ...item }))
        : (Array.isArray(relatedSource.policies) ? relatedSource.policies.map((item: AppTypes.EventPolicyItem) => ({ ...item })) : undefined),
      slotsEnabled: record?.slotsEnabled ?? relatedSource.slotsEnabled,
      slotTemplates: Array.isArray(record?.slotTemplates)
        ? record.slotTemplates.map((item: AppTypes.EventSlotTemplate) => ({ ...item }))
        : (Array.isArray(relatedSource.slotTemplates) ? relatedSource.slotTemplates.map((item: AppTypes.EventSlotTemplate) => ({ ...item })) : undefined),
      parentEventId: record?.parentEventId ?? relatedSource.parentEventId,
      slotTemplateId: record?.slotTemplateId ?? relatedSource.slotTemplateId,
      generated: record?.generated ?? relatedSource.generated,
      eventType: record?.eventType ?? relatedSource.eventType,
      nextSlot: selectedSlot
        ? { ...selectedSlot }
        : (record?.nextSlot ? { ...record.nextSlot } : (relatedSource.nextSlot ? { ...relatedSource.nextSlot } : undefined)),
      upcomingSlots: Array.isArray(record?.upcomingSlots)
        ? record.upcomingSlots.map((item: AppTypes.EventSlotOccurrence) => ({ ...item }))
        : (Array.isArray(relatedSource.upcomingSlots) ? relatedSource.upcomingSlots.map((item: AppTypes.EventSlotOccurrence) => ({ ...item })) : undefined),
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
      subEventsDisplayMode: record?.subEventsDisplayMode ?? relatedSource.subEventsDisplayMode,
      paymentSessionId: selection?.paymentSessionId ?? null
    };
  }

  public isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean {
    return Boolean(this.trashedActivityRowsByKey[`${type}:${id}`]);
  }

  public isActivityRowTrashed(row: AppTypes.ActivityListRow): boolean {
    if (Boolean((row.source as { isTrashed?: boolean }).isTrashed)) {
      return true;
    }
    return this.isActivityIdentityTrashed(row.type, row.id);
  }

  private trashedActivityRows(): AppTypes.ActivityListRow[] {
    return Object.values(this.trashedActivityRowsByKey);
  }

  public trashedActivityCount(): number {
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

  public onActivityRowClick(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    if (row.type === 'chats') {
      this.openActivityChat(row.source as ChatMenuItem);
      return;
    }
    if (row.type === 'rates') {
      this.activitiesRates.openEditor(row, event as Event);
      return;
    }
    this.openActivityRowInEventModule(row, true);
  }

  public openActivityMembers(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.popupCtx.requestActivitiesNavigation({
      type: 'members',
      ownerId: row.id,
      ownerType: 'event',
      subtitle: row.title,
      canManage: row.isAdmin === true
    });
  }

  public canShowActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.canApproveActivityMember(entry) || this.canDeleteActivityMember(entry);
  }

  public toggleActivityMemberActionMenu(entry: AppTypes.ActivityMemberEntry, event: Event): void {
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

  public isActivityMemberActionMenuOpen(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember' && this.inlineItemActionMenu.id === entry.userId;
  }

  public isActivityMemberActionMenuOpenUp(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.scope === 'activityMember'
      && this.inlineItemActionMenu.id === entry.userId
      && this.inlineItemActionMenu.openUp;
  }

  public canApproveActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin !== true) {
      return false;
    }
    return entry.status === 'pending' && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  public canDeleteActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.selectedActivityMembersRow?.isAdmin === true) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  public activityMemberMenuDeleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  public activityMemberAge(entry: AppTypes.ActivityMemberEntry): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  public activityMemberRoleLabel(entry: AppTypes.ActivityMemberEntry): string {
    return entry.role === 'Admin' ? 'Admin' : 'Member';
  }

  public activityMemberStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
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

  public memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'admin_panel_settings' : 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  public memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  public memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  public memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'Admin' : 'Member';
    }
    return this.activityMemberStatusLabel(entry);
  }

  public approveActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
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

  public removeActivityMember(entry: AppTypes.ActivityMemberEntry, event?: Event): void {
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

  public openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void {
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
