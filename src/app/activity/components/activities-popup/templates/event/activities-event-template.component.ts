
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { AppUtils } from '../../../../../shared/app-utils';
import type { ChatMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { ActivitiesEventSyncPayload } from '../../../../../shared/core/base/models';
import type * as AppTypes from '../../../../../shared/core/base/models';
import {
  ActivityEventBuilder,
  ActivityMembersBuilder
} from '../../../../../shared/core';
import {
  InfoCardComponent,
  type InfoCardData,
  type InfoCardMenuActionEvent,
  type InfoCardMenuRequestEvent
} from '../../../../../shared/ui';

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
  @Input() cardRevision = 0;

  @Output() readonly mediaEndClick = new EventEmitter<void>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();
  @Output() readonly menuRequest = new EventEmitter<InfoCardMenuRequestEvent>();

  protected card: InfoCardData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['cardRevision']) {
      this.card = this.buildCard();
    }
  }

  private buildCard(): InfoCardData | null {
    const row = this.row;
    if (!row?.infoCard) {
      return null;
    }
    return {
      ...row.infoCard,
      groupLabel: this.groupLabel
    };
  }

  protected onMediaEndClick(): void {
    this.mediaEndClick.emit();
  }

  protected onMenuAction(event: InfoCardMenuActionEvent): void {
    this.menuAction.emit(event);
  }

  protected onMenuRequest(event: InfoCardMenuRequestEvent): void {
    this.menuRequest.emit(event);
  }
}

type ActivityInfoCardActionId =
  | 'accept'
  | 'askOrganizer'
  | 'contactOrganizer'
  | 'deleteEvent'
  | 'editEvent'
  | 'leaveEvent'
  | 'notifyParticipants'
  | 'publish'
  | 'rejectInvitation'
  | 'reportOrganizer'
  | 'restore'
  | 'shareEvent'
  | 'takeOver'
  | 'view'
  | 'viewInvitation';
type ActivitiesEventsHost = any;
type ActivityEventRecordLike = any;
type InvitationApprovalSyncResult = {
  syncPayload: Omit<ActivitiesEventSyncPayload, 'syncKey'>;
  nextMembers: AppTypes.ActivityMemberEntry[] | null;
  capacityTotal: number;
};

export class ActivitiesEventsController {
  constructor(private readonly host: ActivitiesEventsHost) {}

  private get activeUser() { return this.host.activeUser as any; }
  private get activitiesContext() { return this.host.activitiesContext; }
  private get activitiesEventScope() { return this.host.activitiesEventScope as AppTypes.ActivitiesEventScope; }
  private set activitiesEventScope(value: AppTypes.ActivitiesEventScope) { this.host.activitiesEventScope = value; }
  private get activitiesRates() { return this.host.activitiesRates; }
  private get activitiesSmartList() { return this.host.activitiesSmartList; }
  private get activityMembersByRowId() { return this.host.activityMembersByRowId as Record<string, AppTypes.ActivityMemberEntry[]>; }
  private get activityMembersService() { return this.host.activityMembersService; }
  private get cdr() { return this.host.cdr; }
  private get confirmationDialogService() { return this.host.confirmationDialogService; }
  private get eventCheckoutDraftService() { return this.host.eventCheckoutDraftService; }
  private get eventCheckoutDialogService() { return this.host.eventCheckoutDialogService; }
  private get eventEditorService() { return this.host.eventEditorService; }
  private get eventItems() { return this.host.eventItems as ActivityEventRecordLike[]; }
  private set eventItems(value: ActivityEventRecordLike[]) { this.host.eventItems = value; }
  private get eventsService() { return this.host.eventsService; }
  private get hostingItems() { return this.host.hostingItems as ActivityEventRecordLike[]; }
  private set hostingItems(value: ActivityEventRecordLike[]) { this.host.hostingItems = value; }
  private get inlineItemActionMenu() { return this.host.inlineItemActionMenu; }
  private set inlineItemActionMenu(value: any) { this.host.inlineItemActionMenu = value; }
  private get invitationItems() { return this.host.invitationItems as ActivityEventRecordLike[]; }
  private set invitationItems(value: ActivityEventRecordLike[]) { this.host.invitationItems = value; }
  private get isMobileView() { return this.host.isMobileView as boolean; }
  private get pendingActivityMemberDelete() { return this.host.pendingActivityMemberDelete as AppTypes.ActivityMemberEntry | null; }
  private set pendingActivityMemberDelete(value: AppTypes.ActivityMemberEntry | null) { this.host.pendingActivityMemberDelete = value; }
  private get popupCtx() { return this.host.popupCtx; }
  private get navigatorService() { return this.host.navigatorService; }
  private get shareTokensService() { return this.host.shareTokensService; }
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
  private openActivityChat(chat: ChatMenuItem): void { this.host.openActivityChat(chat); }
  private persistSelectedActivityMembers(): void { this.host.persistSelectedActivityMembers(); }
  private refreshSectionBadges(): void { this.host.refreshSectionBadges(); }
  private removeVisibleActivityRow(row: AppTypes.ActivityListRow): void { this.host.removeVisibleActivityRow(row); }
  private replaceVisibleActivityItems(items: readonly AppTypes.ActivityListRow[], totalDelta = 0): void {
    this.host.replaceVisibleActivityItems(items, totalDelta);
  }
  private uniqueUserIds(userIds: readonly string[]): string[] { return this.host.uniqueUserIds(userIds); }
  private withActivityEventInfoCard(row: AppTypes.ActivityListRow): AppTypes.ActivityListRow {
    return this.host.withActivityEventInfoCard(row);
  }
  private refreshActivityEventInfoCard(row: AppTypes.ActivityListRow): void {
    this.host.refreshActivityEventInfoCard(row);
  }

  private activityStatusCode(row: AppTypes.ActivityListRow): string {
    return this.normalizeActivityStatusCode((row.source as { status?: string | null })?.status);
  }

  private normalizeActivityStatusCode(statusValue: string | null | undefined): string {
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

  public isExitActivityRow(row: AppTypes.ActivityListRow): boolean {
    return row.type === 'events';
  }

  public activityServiceChatActionLabel(row: AppTypes.ActivityListRow): string {
    if (row.type === 'hosting' && row.isAdmin) {
      return 'Notify Participants';
    }
    if (row.type === 'invitations') {
      return 'Ask Organizer';
    }
    return 'Contact Organizer';
  }

  public onActivityEventInfoCardMenuAction(row: AppTypes.ActivityListRow, action: InfoCardMenuActionEvent): void {
    switch (action.actionId as ActivityInfoCardActionId) {
      case 'publish':
        this.runActivityItemPublishAction(row);
        break;
      case 'takeOver':
        this.runActivityItemTakeOverAction(row);
        break;
      case 'editEvent':
      case 'viewInvitation':
        this.runActivityItemPrimaryAction(row);
        break;
      case 'view':
        this.runActivityItemViewAction(row);
        break;
      case 'notifyParticipants':
      case 'askOrganizer':
      case 'contactOrganizer':
        this.runActivityItemServiceChatAction(row);
        break;
      case 'shareEvent':
        this.runActivityItemShareAction(row);
        break;
      case 'reportOrganizer':
        this.runActivityItemReportAction(row);
        break;
      case 'accept':
        this.runActivityItemApproveAction(row);
        break;
      case 'leaveEvent':
      case 'deleteEvent':
      case 'rejectInvitation':
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

  public runActivityItemServiceChatAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    const chat = this.buildActivityServiceChat(row);
    if (!chat) {
      return;
    }
    this.openActivityChat(chat);
  }

  public runActivityItemShareAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    const entityId = this.resolveActivityShareEntityId(row);
    if (!entityId) {
      return;
    }
    void this.shareTokensService.createToken({
      kind: 'event',
      entityId,
      ownerUserId: this.activeUser.id.trim()
    }).then((token: string) => {
      if (!token) {
        return;
      }
      this.confirmationDialogService.open({
        title: 'Share event',
        message: token,
        confirmLabel: 'Copy link',
        cancelLabel: 'Cancel',
        confirmTone: 'accent',
        onConfirm: async () => {
          await navigator.clipboard?.writeText(token);
        }
      });
    });
  }

  private resolveActivityShareEntityId(row: AppTypes.ActivityListRow): string {
    const source = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    }) ?? (row.source as ActivityEventRecordLike);
    return `${source.id ?? row.id ?? ''}`.trim();
  }

  public runActivityItemReportAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    const target = this.resolveActivityReportTarget(row);
    if (!target || target.userId === this.activeUser.id.trim()) {
      return;
    }
    this.navigatorService.openReportUserPopup({
      targetUserId: target.userId,
      targetName: target.name,
      eventId: row.id,
      eventTitle: row.title,
      eventStartAtIso: target.startAtIso,
      eventTimeframe: target.timeframe,
      ownerType: 'event'
    });
    this.cdr.markForCheck();
  }

  private resolveActivityReportTarget(row: AppTypes.ActivityListRow): {
    userId: string;
    name: string;
    startAtIso?: string | null;
    timeframe?: string | null;
  } | null {
    const source = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    }) ?? (row.source as ActivityEventRecordLike & {
      creatorName?: string;
    });
    const creatorUserId = `${source.creatorUserId ?? ''}`.trim();
    if (!creatorUserId) {
      return null;
    }
    const creatorName = `${source.creatorName ?? ''}`.trim()
      || this.users.find(user => user.id === creatorUserId)?.name?.trim()
      || (row.type === 'invitations' ? `${(row.source as ActivityEventRecordLike).inviter ?? ''}`.trim() : '')
      || 'Organizer';
    return {
      userId: creatorUserId,
      name: creatorName,
      startAtIso: source.startAt ?? null,
      timeframe: source.timeframe ?? (row.source as ActivityEventRecordLike).when ?? null
    };
  }

  private buildActivityServiceChat(row: AppTypes.ActivityListRow): ChatMenuItem | null {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return null;
    }
    const source = row.source as ActivityEventRecordLike & {
      creatorName?: string;
      creatorInitials?: string;
    };
    const title = row.title?.trim() || source.title?.trim() || source.description?.trim() || 'Event';
    const organizerUserId = `${source.creatorUserId ?? ''}`.trim();
    const isOrganizerNotificationChannel = row.type === 'hosting' && row.isAdmin;
    const acceptedAdmins = row.type === 'hosting'
      ? this.uniqueUserIds([organizerUserId, activeUserId])
      : this.uniqueUserIds([organizerUserId]);
    const memberIds = this.uniqueUserIds([
      activeUserId,
      ...acceptedAdmins,
      ...(isOrganizerNotificationChannel ? (source.acceptedMemberUserIds ?? []) : []),
      ...(isOrganizerNotificationChannel ? (source.pendingMemberUserIds ?? []) : [])
    ]);
    const chat: ChatMenuItem & { ownerUserId?: string } = {
      id: `c-service-event-${row.id}-${activeUserId}`,
      avatar: AppUtils.initialsFromText(source.creatorName?.trim() || title),
      title: `${this.activityServiceChatActionLabel(row)} · ${title}`,
      lastMessage: isOrganizerNotificationChannel
        ? 'Notification channel for cancellations, postponements, and urgent event updates.'
        : `Service chat with the organizer for ${title}.`,
      lastSenderId: organizerUserId || activeUserId,
      memberIds: memberIds.length > 0 ? memberIds : [activeUserId],
      unread: 0,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: isOrganizerNotificationChannel ? 'notification' : 'event',
      eventId: row.id,
      ownerUserId: activeUserId
    };
    return chat;
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
    const relatedSource = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    }) ?? ActivityEventBuilder.buildInvitationPreviewEventSource(row.source as ActivityEventRecordLike);
    const requiresAdminApproval = await this.resolveInvitationRequiresAdminApproval(
      row.id,
      record?.creatorUserId ?? relatedSource.creatorUserId
    );
    if (record && this.shouldUseCheckoutFlow(record)) {
      this.eventCheckoutDialogService.open({
        mode: 'invitation',
        userId: activeUserId,
        record,
        requiresApprovalBeforePayment: requiresAdminApproval,
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

  public runActivityItemTakeOverAction(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.inlineItemActionMenu = null;
    this.confirmationDialogService.open({
      title: 'Take over event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Take Over',
      busyConfirmLabel: 'Taking over...',
      confirmTone: 'accent',
      failureMessage: 'Unable to take over event.',
      onConfirm: () => this.confirmActivityTakeOver(row)
    });
  }

  private async confirmActivityTakeOver(row: AppTypes.ActivityListRow): Promise<void> {
    await this.eventsService.takeOverItem(this.activeUser.id, row.type as any, row.id);
    const nextStatus = this.restoredActivityStatus(row);
    this.hostingItems = this.hostingItems.map(item =>
      item.id === row.id ? { ...item, status: nextStatus } : item
    );
    this.eventItems = this.eventItems.map(item =>
      item.id === row.id ? { ...item, status: nextStatus } : item
    );
    if (this.activitiesEventScope === 'pending') {
      this.removeVisibleActivityRow(row);
    } else {
      const smartList = this.activitiesSmartList;
      if (smartList) {
        const currentItems = [...smartList.itemsSnapshot()];
        const rowIndex = currentItems.findIndex(item => item.id === row.id && item.type === row.type);
        if (rowIndex >= 0) {
          const updatedRow = { ...currentItems[rowIndex] };
          updatedRow.source = { ...(updatedRow.source as any), status: nextStatus };
          this.refreshActivityEventInfoCard(updatedRow);
          const nextItems = [...currentItems];
          nextItems[rowIndex] = updatedRow;
          this.replaceVisibleActivityItems(nextItems, 0);
        }
      }
    }
    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private restoredActivityStatus(row: AppTypes.ActivityListRow): string {
    return row.type === 'hosting' ? 'H' : 'A';
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
          this.refreshActivityEventInfoCard(updatedRow);
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
    if (row.type === 'events') {
      await this.confirmActivityLeave(row);
      return;
    }
    await this.persistActivityRowTrash(row);
    this.markActivityRowTrashed(row);
    this.removeVisibleActivityRow(row);
    this.cdr.markForCheck();
  }

  private async confirmActivityLeave(row: AppTypes.ActivityListRow): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    const syncPayload = await this.buildLeftEventSyncPayload(row);
    if (!syncPayload) {
      this.eventCheckoutDraftService.clear(activeUserId, row.id);
      this.removeVisibleActivityRow(row);
      this.refreshSectionBadges();
      this.cdr.markForCheck();
      return;
    }

    this.eventCheckoutDraftService.clear(activeUserId, row.id);
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(row.id);
    const nextMembers = currentMembers.filter((member: AppTypes.ActivityMemberEntry) => member.userId !== activeUserId);
    const capacityTotal = Math.max(
      Math.max(0, Math.trunc(Number(syncPayload.acceptedMembers) || 0)),
      Math.max(0, Math.trunc(Number(syncPayload.capacityTotal) || 0))
    );
    const persistence = Promise.all([
      this.activitiesContext.emitActivitiesEventSync(syncPayload),
      currentMembers.length > nextMembers.length
        ? this.activityMembersService.replaceMembersByOwnerId(row.id, nextMembers, capacityTotal)
        : Promise.resolve()
    ]);

    if (this.selectedActivityMembersRowId === this.activityRowIdentity(row)) {
      this.selectedActivityMembers = ActivityMembersBuilder.sortActivityMembersByActionTimeAsc(
        this.selectedActivityMembers.filter(member => member.userId !== activeUserId)
      );
      this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    }

    this.cdr.markForCheck();
    await persistence;
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
    const { syncPayload, nextMembers, capacityTotal } = await this.buildAcceptedInvitationSyncResult(row, selection);
    await Promise.all([
      this.eventsService.syncEventSnapshot(syncPayload),
      nextMembers
        ? this.activityMembersService.replaceMembersByOwnerId(syncPayload.id, nextMembers, capacityTotal)
        : Promise.resolve()
    ]);
    this.removeInvitationItem(syncPayload.id);
    this.applyActivitiesEventSync(syncPayload);
    this.cdr.markForCheck();
  }

  private async buildAcceptedInvitationSyncResult(
    row: AppTypes.ActivityListRow,
    selection?: AppTypes.EventCheckoutSelection | null
  ): Promise<InvitationApprovalSyncResult> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      throw new Error('Unable to resolve active user.');
    }

    const invitationSource = row.source as ActivityEventRecordLike;
    const relatedSource = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    }) ?? ActivityEventBuilder.buildInvitationPreviewEventSource(invitationSource);
    const record = await this.eventsService.queryKnownItemById(activeUserId, row.id);
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(row.id);
    const activeInviteEntry = currentMembers.find((member: AppTypes.ActivityMemberEntry) =>
      member.userId === activeUserId
      && member.status === 'pending'
      && member.requestKind === 'invite'
    ) ?? null;
    const requiresAdminApproval = this.invitationRequiresAdminApproval(
      activeInviteEntry,
      currentMembers,
      record?.creatorUserId ?? relatedSource.creatorUserId
    );

    const existingAcceptedMemberUserIds = this.uniqueUserIds([
      ...(record?.acceptedMemberUserIds ?? relatedSource.acceptedMemberUserIds ?? [])
    ]);
    const existingPendingMemberUserIds = this.uniqueUserIds([
      ...(record?.pendingMemberUserIds ?? relatedSource.pendingMemberUserIds ?? [])
    ]);
    const activeUserWasAccepted = existingAcceptedMemberUserIds.includes(activeUserId);
    const activeUserWasPending = existingPendingMemberUserIds.includes(activeUserId);
    const nextAcceptedMemberUserIds = requiresAdminApproval
      ? existingAcceptedMemberUserIds.filter(userId => userId !== activeUserId)
      : (activeUserWasAccepted
        ? [...existingAcceptedMemberUserIds]
        : this.uniqueUserIds([...existingAcceptedMemberUserIds, activeUserId]));
    const nextPendingMemberUserIds = requiresAdminApproval
      ? this.uniqueUserIds([...existingPendingMemberUserIds, activeUserId])
      : existingPendingMemberUserIds.filter(userId => userId !== activeUserId);

    const acceptedMembersBase = Math.max(
      this.chatCountValue(record?.acceptedMembers ?? relatedSource.acceptedMembers),
      existingAcceptedMemberUserIds.length
    );
    const pendingMembersBase = this.chatCountValue(
      record?.pendingMembers
      ?? relatedSource.pendingMembers
      ?? (activeUserWasPending ? 1 : existingPendingMemberUserIds.length)
    );
    const nextAcceptedMembers = Math.max(
      nextAcceptedMemberUserIds.length,
      acceptedMembersBase + (nextAcceptedMemberUserIds.length - existingAcceptedMemberUserIds.length)
    );
    const nextPendingMembers = Math.max(
      nextPendingMemberUserIds.length,
      pendingMembersBase + (nextPendingMemberUserIds.length - existingPendingMemberUserIds.length)
    );

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
      syncPayload: {
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
        topics: [...(record?.topics ?? relatedSource.topics ?? [])],
        subEvents: Array.isArray(record?.subEvents)
          ? this.cloneSyncedSubEventForms(record.subEvents)
          : (Array.isArray(relatedSource.subEvents) ? this.cloneSyncedSubEventForms(relatedSource.subEvents) : undefined),
        subEventsDisplayMode: record?.subEventsDisplayMode ?? relatedSource.subEventsDisplayMode,
        paymentSessionId: selection?.paymentSessionId ?? null
      },
      nextMembers: this.buildAcceptedInvitationMembers(currentMembers, activeUserId, requiresAdminApproval),
      capacityTotal
    };
  }

  private async resolveInvitationRequiresAdminApproval(ownerId: string, creatorUserId?: string | null): Promise<boolean> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return false;
    }
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(ownerId);
    const activeInviteEntry = currentMembers.find((member: AppTypes.ActivityMemberEntry) =>
      member.userId === activeUserId
      && member.status === 'pending'
      && member.requestKind === 'invite'
    ) ?? null;
    return this.invitationRequiresAdminApproval(activeInviteEntry, currentMembers, creatorUserId);
  }

  private invitationRequiresAdminApproval(
    activeInviteEntry: AppTypes.ActivityMemberEntry | null,
    currentMembers: readonly AppTypes.ActivityMemberEntry[],
    creatorUserId?: string | null
  ): boolean {
    const inviterUserId = `${activeInviteEntry?.invitedByUserId ?? ''}`.trim();
    if (!inviterUserId) {
      return false;
    }
    if (inviterUserId === `${creatorUserId ?? ''}`.trim()) {
      return false;
    }
    const inviterEntry = currentMembers.find(member =>
      member.userId === inviterUserId
      && member.status === 'accepted'
    );
    return inviterEntry?.role !== 'Admin' && inviterEntry?.role !== 'Manager';
  }

  private buildAcceptedInvitationMembers(
    members: readonly AppTypes.ActivityMemberEntry[],
    activeUserId: string,
    requiresAdminApproval: boolean
  ): AppTypes.ActivityMemberEntry[] | null {
    const nowIso = AppUtils.toIsoDateTime(new Date());
    let didUpdate = false;
    const nextMembers = members.map(member => {
      if (member.userId !== activeUserId) {
        return { ...member };
      }
      didUpdate = true;
      if (requiresAdminApproval) {
        return {
          ...member,
          status: 'pending' as const,
          pendingSource: 'admin' as const,
          requestKind: 'join' as const,
          invitedByUserId: null,
          invitedByActiveUser: false,
          statusText: 'Waiting for admin approval.',
          actionAtIso: nowIso
        };
      }
      return {
        ...member,
        status: 'accepted' as const,
        pendingSource: null,
        requestKind: null,
        invitedByUserId: null,
        invitedByActiveUser: false,
        statusText: member.statusText?.trim() || 'Accepted',
        actionAtIso: nowIso
      };
    });
    return didUpdate
      ? ActivityMembersBuilder.sortActivityMembersByActionTimeDesc(nextMembers)
      : null;
  }

  private removeInvitationItem(sourceId: string): void {
    this.invitationItems = this.invitationItems.filter(item => item.id !== sourceId);
    delete this.activityMembersByRowId[`invitations:${sourceId}`];
  }

  private async buildLeftEventSyncPayload(
    row: AppTypes.ActivityListRow
  ): Promise<Omit<ActivitiesEventSyncPayload, 'syncKey'> | null> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return null;
    }

    const relatedSource = ActivityEventBuilder.resolveEditorSource(row, {
      eventItems: this.eventItems,
      hostingItems: this.hostingItems,
      invitationItems: this.invitationItems
    });
    const record = await this.eventsService.queryKnownItemById(activeUserId, row.id);
    const source = row.source as ActivityEventRecordLike;
    const creatorUserId = record?.creatorUserId ?? relatedSource?.creatorUserId ?? source.creatorUserId ?? '';
    if (!creatorUserId.trim()) {
      return null;
    }

    const existingAcceptedMemberUserIds = this.uniqueUserIds([
      ...(record?.acceptedMemberUserIds ?? relatedSource?.acceptedMemberUserIds ?? source.acceptedMemberUserIds ?? [])
    ]);
    const existingPendingMemberUserIds = this.uniqueUserIds([
      ...(record?.pendingMemberUserIds ?? relatedSource?.pendingMemberUserIds ?? source.pendingMemberUserIds ?? [])
    ]);
    const activeUserWasAccepted = existingAcceptedMemberUserIds.includes(activeUserId);
    const activeUserWasPending = existingPendingMemberUserIds.includes(activeUserId);
    const nextAcceptedMemberUserIds = existingAcceptedMemberUserIds.filter(userId => userId !== activeUserId);
    const nextPendingMemberUserIds = existingPendingMemberUserIds
      .filter(userId => userId !== activeUserId && !nextAcceptedMemberUserIds.includes(userId));

    const acceptedMembersBase = this.chatCountValue(
      record?.acceptedMembers
      ?? relatedSource?.acceptedMembers
      ?? source.acceptedMembers
    );
    const pendingMembersBase = this.chatCountValue(
      record?.pendingMembers
      ?? relatedSource?.pendingMembers
      ?? source.pendingMembers
    );
    const nextAcceptedMembers = Math.max(
      nextAcceptedMemberUserIds.length,
      Math.max(0, acceptedMembersBase - (activeUserWasAccepted ? 1 : 0))
    );
    const nextPendingMembers = Math.max(
      nextPendingMemberUserIds.length,
      Math.max(0, pendingMembersBase - (activeUserWasPending ? 1 : 0))
    );

    const title = record?.title ?? relatedSource?.title ?? source.title ?? row.title;
    const shortDescription = record?.subtitle
      ?? relatedSource?.shortDescription
      ?? source.shortDescription
      ?? row.subtitle
      ?? '';
    const timeframe = record?.timeframe ?? relatedSource?.timeframe ?? source.timeframe ?? row.detail;
    const startAt = record?.startAtIso ?? relatedSource?.startAt ?? source.startAt ?? row.dateIso;
    const endAt = record?.endAtIso ?? relatedSource?.endAt ?? source.endAt ?? startAt;
    const distanceKmRaw = record?.distanceKm ?? relatedSource?.distanceKm ?? source.distanceKm ?? row.distanceKm;
    const distanceKm = Number.isFinite(Number(distanceKmRaw)) ? Math.max(0, Number(distanceKmRaw)) : 0;
    const creatorName = record?.creatorName?.trim() || title;
    const creatorInitials = record?.creatorInitials?.trim()
      || relatedSource?.avatar?.trim()
      || source.avatar?.trim()
      || AppUtils.initialsFromText(creatorName);
    const capacityTotal = Math.max(
      nextAcceptedMembers,
      this.chatCountValue(
        record?.capacityTotal
        ?? relatedSource?.capacityTotal
        ?? source.capacityTotal
        ?? relatedSource?.capacityMax
        ?? source.capacityMax
      )
    );

    return {
      id: row.id,
      target: 'events',
      title,
      shortDescription,
      timeframe,
      activity: this.chatCountValue(record?.activity ?? relatedSource?.activity ?? source.activity ?? row.unread),
      isAdmin: false,
      startAt,
      endAt,
      distanceKm,
      imageUrl: record?.imageUrl ?? relatedSource?.imageUrl ?? source.imageUrl ?? '',
      acceptedMembers: nextAcceptedMembers,
      pendingMembers: nextPendingMembers,
      capacityTotal,
      capacityMin: record?.capacityMin ?? relatedSource?.capacityMin ?? source.capacityMin ?? null,
      capacityMax: record?.capacityMax ?? relatedSource?.capacityMax ?? source.capacityMax ?? capacityTotal,
      autoInviter: record?.autoInviter ?? relatedSource?.autoInviter ?? source.autoInviter,
      frequency: record?.frequency ?? relatedSource?.frequency ?? source.frequency,
      ticketing: record?.ticketing ?? relatedSource?.ticketing ?? source.ticketing,
      pricing: record?.pricing ?? relatedSource?.pricing ?? source.pricing,
      policies: Array.isArray(record?.policies)
        ? record.policies.map((item: AppTypes.EventPolicyItem) => ({ ...item }))
        : (Array.isArray(relatedSource?.policies)
            ? relatedSource.policies.map((item: AppTypes.EventPolicyItem) => ({ ...item }))
            : (Array.isArray(source.policies) ? source.policies.map((item: AppTypes.EventPolicyItem) => ({ ...item })) : undefined)),
      slotsEnabled: record?.slotsEnabled ?? relatedSource?.slotsEnabled ?? source.slotsEnabled,
      slotTemplates: Array.isArray(record?.slotTemplates)
        ? record.slotTemplates.map((item: AppTypes.EventSlotTemplate) => ({ ...item }))
        : (Array.isArray(relatedSource?.slotTemplates)
            ? relatedSource.slotTemplates.map((item: AppTypes.EventSlotTemplate) => ({ ...item }))
            : (Array.isArray(source.slotTemplates) ? source.slotTemplates.map((item: AppTypes.EventSlotTemplate) => ({ ...item })) : undefined)),
      parentEventId: record?.parentEventId ?? relatedSource?.parentEventId ?? source.parentEventId,
      slotTemplateId: record?.slotTemplateId ?? relatedSource?.slotTemplateId ?? source.slotTemplateId,
      generated: record?.generated ?? relatedSource?.generated ?? source.generated,
      eventType: record?.eventType ?? relatedSource?.eventType ?? source.eventType,
      nextSlot: record?.nextSlot
        ? { ...record.nextSlot }
        : (relatedSource?.nextSlot ? { ...relatedSource.nextSlot } : (source.nextSlot ? { ...source.nextSlot } : undefined)),
      upcomingSlots: Array.isArray(record?.upcomingSlots)
        ? record.upcomingSlots.map((item: AppTypes.EventSlotOccurrence) => ({ ...item }))
        : (Array.isArray(relatedSource?.upcomingSlots)
            ? relatedSource.upcomingSlots.map((item: AppTypes.EventSlotOccurrence) => ({ ...item }))
            : (Array.isArray(source.upcomingSlots) ? source.upcomingSlots.map((item: AppTypes.EventSlotOccurrence) => ({ ...item })) : undefined)),
      visibility: record?.visibility ?? relatedSource?.visibility ?? source.visibility,
      blindMode: record?.blindMode ?? relatedSource?.blindMode ?? source.blindMode,
      published: record?.published ?? relatedSource?.published ?? source.published ?? true,
      creatorUserId,
      creatorName,
      creatorInitials,
      creatorGender: record?.creatorGender,
      creatorCity: record?.creatorCity,
      location: record?.location ?? relatedSource?.location ?? source.location,
      locationCoordinates: record?.locationCoordinates ?? relatedSource?.locationCoordinates ?? source.locationCoordinates,
      sourceLink: record?.sourceLink ?? relatedSource?.sourceLink ?? source.sourceLink,
      topics: [...(record?.topics ?? relatedSource?.topics ?? source.topics ?? [])],
      subEvents: Array.isArray(record?.subEvents)
        ? this.cloneSyncedSubEventForms(record.subEvents)
        : (Array.isArray(relatedSource?.subEvents)
            ? this.cloneSyncedSubEventForms(relatedSource.subEvents)
            : (Array.isArray(source.subEvents) ? this.cloneSyncedSubEventForms(source.subEvents) : undefined)),
      subEventsDisplayMode: record?.subEventsDisplayMode ?? relatedSource?.subEventsDisplayMode ?? source.subEventsDisplayMode,
      paymentSessionId: null
    };
  }

  public isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean {
    return Boolean(this.trashedActivityRowsByKey[`${type}:${id}`]);
  }

  public isActivityRowTrashed(row: AppTypes.ActivityListRow): boolean {
    if (Boolean((row.source as { isTrashed?: boolean }).isTrashed)) {
      return true;
    }
    const status = this.activityStatusCode(row);
    if (status === 'T' || status === 'D' || status === 'I') {
      return true;
    }
    return this.isActivityIdentityTrashed(row.type, row.id);
  }

  private trashedActivityRows(): AppTypes.ActivityListRow[] {
    return Object.values(this.trashedActivityRowsByKey);
  }

  public trashedActivityCount(): number {
    const trashedKeys = new Set(Object.keys(this.trashedActivityRowsByKey));
    for (const item of this.eventItems) {
      if (this.isTrashScopeMenuItem(item)) {
        trashedKeys.add(`events:${item.id}`);
      }
    }
    for (const item of this.hostingItems) {
      if (this.isTrashScopeMenuItem(item)) {
        trashedKeys.add(`hosting:${item.id}`);
      }
    }
    for (const item of this.invitationItems) {
      if (this.isTrashScopeMenuItem(item)) {
        trashedKeys.add(`invitations:${item.id}`);
      }
    }
    return trashedKeys.size;
  }

  private isTrashScopeMenuItem(item: ActivityEventRecordLike): boolean {
    const status = this.normalizeActivityStatusCode(item.status);
    return status === 'T' || status === 'D' || status === 'I';
  }

  private markActivityRowTrashed(row: AppTypes.ActivityListRow): void {
    this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = this.withActivityEventInfoCard({
      ...row,
      source: { ...(row.source as any), status: 'T' }
    });
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
    return entry.status === 'pending' && this.isActivityJoinRequest(entry);
  }

  public canDeleteActivityMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.isActivityWaitlistMember(entry)) {
      return false;
    }
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
    if (this.isActivityWaitlistMember(entry)) {
      return 'Waiting list';
    }
    if (this.isActivityJoinRequest(entry)) {
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
    if (this.isActivityJoinRequest(entry)) {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  public memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (this.isActivityJoinRequest(entry)) {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  public memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (this.isActivityJoinRequest(entry)) {
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

  private isActivityJoinRequest(entry: AppTypes.ActivityMemberEntry): boolean {
    return entry.requestKind === 'join'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private isActivityWaitlistMember(entry: AppTypes.ActivityMemberEntry): boolean {
    return entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite';
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
