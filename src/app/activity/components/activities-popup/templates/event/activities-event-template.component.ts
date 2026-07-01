import type * as ActivityContracts from '../../../../../shared/core/contracts/activity.interface';

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import {
  AppUtils
} from '../../../../../shared/app-utils';
import type { ChatDTO } from '../../../../../shared/core/contracts/chat.interface';
import {
  ActivityEventDetailDTO
} from '../../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import {
  ActivityMembersBuilder
} from '../../../../../shared/core';
import {
  InfoCardComponent,
  type InfoCardData,
  type AppMenuPalette,
  type CardMenuAction,
  type CardMenuActionEvent,
  type CardMenuRequestEvent
} from '../../../../../shared/ui';
import {
  ActivityEventInfoCardMenuConverter,
  type ActivityEventInfoCardMenuSubject
} from '../../../../../shared/ui/converters';

import type * as AppConstants from '../../../../../shared/core/common/constants';
import type { MemberMenuStore } from '../../../../../shared/ui/context/stores/member-menu.store';
import type { EventSubeventsPopupStore } from '../../../../../shared/ui/context/stores/event-subevents-popup.store';


@Component({
  selector: 'app-activities-event-template',
  standalone: true,
  imports: [InfoCardComponent],
  templateUrl: './activities-event-template.component.html',
  styleUrl: './activities-event-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventTemplateComponent implements OnChanges {
  @Input() row: InfoCardData | null = null;
  @Input() groupLabel: string | null = null;
  @Input() cardRevision = 0;

  @Output() readonly mediaEndClick = new EventEmitter<void>();
  @Output() readonly menuAction = new EventEmitter<CardMenuActionEvent<InfoCardData>>();
  @Output() readonly menuRequest = new EventEmitter<CardMenuRequestEvent<InfoCardData>>();

  protected card: InfoCardData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['cardRevision']) {
      this.card = this.buildCard();
    }
  }

  private buildCard(): InfoCardData | null {
    const row = this.row;
    if (!row) {
      return null;
    }
    return {
      ...row,
      groupLabel: this.groupLabel
    };
  }

  protected onMediaEndClick(): void {
    this.mediaEndClick.emit();
  }

  protected onMenuAction(event: CardMenuActionEvent<InfoCardData>): void {
    this.menuAction.emit(event);
  }

  protected onMenuRequest(event: CardMenuRequestEvent<InfoCardData>): void {
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
  | 'manageEvent'
  | 'notifyParticipants'
  | 'publish'
  | 'rejectInvitation'
  | 'reportOrganizer'
  | 'restore'
  | 'shareEvent'
  | 'takeOver'
  | 'unpublish'
  | 'view'
  | 'viewInvitation';
type ActivitiesEventsHost = any;
type ActivityEventRecordLike = any;
type InvitationApprovalSaveResult = {
  eventDetailDTO: ActivityEventDetailDTO;
  nextMembers: ActivityContracts.ActivityMemberDTO[] | null;
  capacityTotal: number;
};

export class ActivitiesEventsController {
  constructor(private readonly host: ActivitiesEventsHost) {}

  private get activeUser() { return this.host.activeUser as any; }
  private get activitiesStore() { return this.host.activitiesStore; }
  private get activitiesEventScope() { return this.host.activitiesEventScope as ContractTypes.ActivitiesEventScope; }
  private set activitiesEventScope(value: ContractTypes.ActivitiesEventScope) { this.host.activitiesEventScope = value; }
  private get activitiesSmartList() { return this.host.activitiesSmartList; }
  private get activityMembersByRowId() { return this.host.activityMembersByRowId as Record<string, ActivityContracts.ActivityMemberDTO[]>; }
  private get activityMembersService() { return this.host.activityMembersService; }
  private get chatsService() { return this.host.chatsService; }
  private get cdr() { return this.host.cdr; }
  private get dialogStore() { return this.host.dialogStore; }
  private get eventCheckoutDraftStore() { return this.host.eventCheckoutDraftStore; }
  private get eventCheckoutDialogStore() { return this.host.eventCheckoutDialogStore; }
  private get eventsService() { return this.host.eventsService; }
  private get hostingPublicationFilter() { return this.host.hostingPublicationFilter as ContractTypes.HostingPublicationFilter; }
  private get pendingActivityMemberDelete() { return this.host.pendingActivityMemberDelete as ActivityContracts.ActivityMemberDTO | null; }
  private set pendingActivityMemberDelete(value: ActivityContracts.ActivityMemberDTO | null) { this.host.pendingActivityMemberDelete = value; }
  private get memberMenuStore() { return this.host.memberMenuStore as MemberMenuStore; }
  private get eventSubeventsStore() { return this.host.eventSubeventsStore as EventSubeventsPopupStore; }
  private get profileStore() { return this.host.profileStore; }
  private get shareTokensService() { return this.host.shareTokensService; }
  private get activeHostingIds() { return this.host.activeHostingIds as ReadonlySet<string>; }
  private set activeHostingIds(value: ReadonlySet<string>) { this.host.activeHostingIds = value; }
  private get selectedActivityMembers() { return this.host.selectedActivityMembers as ActivityContracts.ActivityMemberDTO[]; }
  private set selectedActivityMembers(value: ActivityContracts.ActivityMemberDTO[]) { this.host.selectedActivityMembers = value; }
  private get selectedActivityMembersRow() { return this.host.selectedActivityMembersRow as InfoCardData | null; }
  private get selectedActivityMembersRowId() { return this.host.selectedActivityMembersRowId as string | null; }
  private get trashedActivityRowsByKey() { return this.host.trashedActivityRowsByKey as Record<string, InfoCardData>; }

  private activityRowIdentity(row: InfoCardData): string { return this.host.activityRowIdentity(row); }
  private applyActivityEventSave(sync: ActivityContracts.ActivityEventDTO): void {
    this.host.applyActivityEventSave(sync);
  }
  private emitActivityEventSave(payload: ActivityEventDetailDTO): Promise<void> {
    return this.eventsService.saveActivityEvent(payload)
      .then((displaySync: ActivityContracts.ActivityEventDTO | null) => {
        if (displaySync) {
          this.activitiesStore.emitActivityEventSaveResult(displaySync);
        }
      })
      .catch(() => {
        // Demo persistence is best-effort; UI state stays optimistic.
      });
  }
  private chatCountValue(value: unknown): number { return this.host.chatCountValue(value); }
  private cloneSyncedSubEventForms(items: ContractTypes.SubEventDTO[]): ContractTypes.SubEventDTO[] { return this.host.cloneSyncedSubEventForms(items); }
  private openActivityChat(chat: ChatDTO): void { this.host.openActivityChat(chat); }
  private persistSelectedActivityMembers(): void { this.host.persistSelectedActivityMembers(); }
  private refreshSectionBadges(): void { this.host.refreshSectionBadges(); }
  private uniqueUserIds(userIds: readonly string[]): string[] {
    const unique: string[] = [];
    for (const userId of userIds) {
      const normalizedUserId = `${userId ?? ''}`.trim();
      if (!normalizedUserId || unique.includes(normalizedUserId)) {
        continue;
      }
      unique.push(normalizedUserId);
    }
    return unique;
  }
  private activityMemberUserIdsByStatus(
    members: readonly ActivityContracts.ActivityMemberDTO[],
    status: AppConstants.ActivityMemberStatus
  ): string[] {
    return this.uniqueUserIds(
      members
        .filter(member => member.status === status)
        .map(member => member.userId)
    );
  }
  private withActivityEventInfoCard(row: InfoCardData): InfoCardData {
    return this.host.withActivityEventInfoCard(row);
  }
  private refreshActivityEventInfoCard(row: InfoCardData): void {
    this.host.refreshActivityEventInfoCard(row);
  }

  private activeUserId(): string {
    return `${this.activeUser?.id ?? ''}`.trim();
  }

  private activityEventDTOForRow(row: InfoCardData): ActivityContracts.ActivityEventDTO | null {
    const fromHost = typeof this.host.activityEventDTOForRow === 'function'
      ? this.host.activityEventDTOForRow(row)
      : null;
    if (fromHost) {
      return fromHost as ActivityContracts.ActivityEventDTO;
    }
    const activeUserId = this.activeUserId();
    return activeUserId
      ? this.eventsService.peekKnownItemById(activeUserId, row.id) ?? null
      : null;
  }

  private isActivityEventListType(value: unknown): value is ActivityContracts.ActivityEventRepositoryItemType {
    return value === 'events' || value === 'hosting' || value === 'invitations';
  }

  private activityEventListTypeForRow(row: InfoCardData): ActivityContracts.ActivityEventRepositoryItemType {
    const fromHost = typeof this.host.activityEventListTypeForRow === 'function'
      ? this.host.activityEventListTypeForRow(row)
      : null;
    if (this.isActivityEventListType(fromHost)) {
      return fromHost;
    }
    const dto = this.activityEventDTOForRow(row);
    return dto ? this.resolveActivityEventListTypeFromDTO(dto) : 'events';
  }

  private resolveActivityEventListTypeFromDTO(
    dto: ActivityContracts.ActivityEventDTO
  ): ActivityContracts.ActivityEventRepositoryItemType {
    const activeUserId = this.activeUserId();
    if (activeUserId && (dto.invitedMemberUserIds ?? []).includes(activeUserId)) {
      return 'invitations';
    }
    if (activeUserId && (dto.adminIds ?? []).includes(activeUserId)) {
      return 'hosting';
    }
    return 'events';
  }

  private isActivityRowAdmin(row: InfoCardData): boolean {
    const dto = this.activityEventDTOForRow(row);
    const activeUserId = this.activeUserId();
    return !!activeUserId && (dto?.adminIds ?? []).includes(activeUserId);
  }

  private activityRowTimeframe(row: InfoCardData): string | null {
    const dto = this.activityEventDTOForRow(row);
    return dto?.timeframe?.trim()
      || row.metaRows?.[0]?.trim()
      || row.description?.trim()
      || null;
  }

  private activityRowStartAt(row: InfoCardData): string | null {
    return this.activityEventDTOForRow(row)?.startAtIso ?? row.dateIso ?? null;
  }

  private activityRowEndAt(row: InfoCardData): string | null {
    return this.activityEventDTOForRow(row)?.endAtIso ?? this.activityRowStartAt(row);
  }

  private activityRowSubtitle(row: InfoCardData): string {
    const dto = this.activityEventDTOForRow(row);
    return dto?.subtitle?.trim() || row.description?.trim() || '';
  }

  private activityRowActivityCount(row: InfoCardData): number {
    const dto = this.activityEventDTOForRow(row);
    return this.chatCountValue(dto?.activity ?? row.badgeCount);
  }

  private activityRowCreatorInitials(row: InfoCardData): string {
    const dto = this.activityEventDTOForRow(row);
    return dto?.creatorInitials?.trim()
      || row.mediaStart?.label?.trim()
      || AppUtils.initialsFromText(dto?.creatorName ?? row.title);
  }

  private activityRowVisibility(row: InfoCardData): AppConstants.EventVisibility {
    return this.activityEventDTOForRow(row)?.visibility ?? 'Public';
  }

  private activityStatusCode(row: InfoCardData): string {
    return this.normalizeActivityStatusCode(row.status);
  }

  private normalizeActivityStatusCode(statusValue: string | null | undefined): string {
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

  public isExitActivityRow(row: InfoCardData): boolean {
    return !this.isActivityRowAdmin(row) && !this.isActivityInvitationRow(row);
  }

  public activityServiceChatActionLabel(row: InfoCardData): string {
    if (this.isActivityRowAdmin(row)) {
      return 'Notify Participants';
    }
    if (this.isActivityInvitationRow(row)) {
      return 'Ask Organizer';
    }
    return 'Contact Organizer';
  }

  private isActivityInvitationRow(row: InfoCardData): boolean {
    return this.activityEventListTypeForRow(row) === 'invitations';
  }

  public onActivityEventCardMenuAction(row: InfoCardData, action: CardMenuActionEvent<InfoCardData>): void {
    switch (action.actionId as ActivityInfoCardActionId) {
      case 'publish':
        this.runActivityItemPublishAction(row, undefined, action.action);
        break;
      case 'unpublish':
        this.runActivityItemUnpublishAction(row, undefined, action.action);
        break;
      case 'takeOver':
        this.runActivityItemTakeOverAction(row, undefined, action.action);
        break;
      case 'editEvent':
      case 'manageEvent':
      case 'viewInvitation':
        this.runActivityItemPrimaryAction(row);
        break;
      case 'view':
        this.runActivityItemViewAction(row);
        break;
      case 'notifyParticipants':
      case 'askOrganizer':
      case 'contactOrganizer':
        this.runActivityItemServiceChatAction(row, action.card);
        break;
      case 'shareEvent':
        this.runActivityItemShareAction(row, action.card);
        break;
      case 'reportOrganizer':
        this.runActivityItemReportAction(row, action.card);
        break;
      case 'accept':
        this.runActivityItemApproveAction(row);
        break;
      case 'leaveEvent':
      case 'deleteEvent':
      case 'rejectInvitation':
        this.runActivityItemSecondaryAction(row, undefined, action.action);
        break;
      case 'restore':
        this.runActivityItemRestoreAction(row, undefined, action.action);
        break;
    }
  }

  public runActivityItemPrimaryAction(row: InfoCardData, event?: Event): void {
    event?.stopPropagation();
    this.openActivityRowInEventModule(row, false);
  }

  public runActivityItemViewAction(row: InfoCardData, event?: Event): void {
    event?.stopPropagation();
    this.eventSubeventsStore.openEventSubeventsListPopup({
      eventId: row.id,
      host: 'activities',
      target: this.isActivityRowAdmin(row) || this.activityEventListTypeForRow(row) === 'hosting' ? 'hosting' : 'events',
      title: row.title,
      timeframe: this.activityRowTimeframe(row),
      startAtIso: this.activityRowStartAt(row),
      endAtIso: this.activityRowEndAt(row),
      canEdit: this.canEditActivityEvent(row)
    });
  }

  private canEditActivityEvent(row: InfoCardData): boolean {
    return ActivityEventInfoCardMenuConverter.canEditEvent(this.activityEventMenuSubjectFromRow(row), {
      activeUserId: this.activeUser.id
    });
  }

  private activityEventMenuSubjectFromRow(row: InfoCardData): ActivityEventInfoCardMenuSubject {
    const dto = this.activityEventDTOForRow(row);
    return {
      menu: 'activity-event-card',
      id: row.id,
      status: dto?.status ?? row.status ?? null,
      ownerUserId: dto?.creatorUserId ?? row.ownerUserId ?? row.ownerId ?? null,
      adminIds: [...(dto?.adminIds ?? [])],
      acceptedMemberUserIds: [...(dto?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto?.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(dto?.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(dto?.pendingRequestMemberUserIds ?? [])]
    };
  }

  public runActivityItemServiceChatAction(
    row: InfoCardData,
    card: InfoCardData | null = null,
    event?: Event
  ): void {
    event?.stopPropagation();
    const chat = this.resolveActivityServiceChat(row, card);
    if (!chat) {
      return;
    }
    this.openActivityChat(chat);
  }

  public runActivityItemShareAction(
    row: InfoCardData,
    card: InfoCardData | null = null,
    event?: Event
  ): void {
    event?.stopPropagation();
    const entityId = this.resolveActivityShareEntityId(row, card);
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
      this.dialogStore.open({
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

  private resolveActivityShareEntityId(row: InfoCardData, card: InfoCardData | null = null): string {
    return `${this.activityInfoCardEntityId(card ?? this.activityInfoCardForRow(row)) || row.id || ''}`.trim();
  }

  public runActivityItemReportAction(
    row: InfoCardData,
    card: InfoCardData | null = null,
    event?: Event
  ): void {
    event?.stopPropagation();
    const target = this.resolveActivityReportTarget(row, card ?? this.activityInfoCardForRow(row));
    if (!target || target.userId === this.activeUser.id.trim()) {
      return;
    }
    const entityId = this.resolveActivityShareEntityId(row, card);
    this.profileStore.openReportUserPopup({
      targetUserId: target.userId,
      targetName: target.name,
      eventId: entityId || row.id,
      eventTitle: row.title,
      eventStartAtIso: target.startAtIso,
      eventTimeframe: target.timeframe,
      ownerType: 'event'
    });
    this.cdr.markForCheck();
  }

  private resolveActivityReportTarget(row: InfoCardData, card: InfoCardData | null = null): {
    userId: string;
    name: string;
    startAtIso?: string | null;
    timeframe?: string | null;
  } | null {
    const source = this.activityDisplaySourceForRow(row) as (ActivityEventRecordLike & {
      creatorName?: string;
      inviter?: string;
      startAt?: string | null;
      timeframe?: string | null;
      when?: string | null;
    }) | null;
    const ownerId = `${source?.creatorUserId ?? this.activityInfoCardOwnerId(card)}`.trim();
    if (!ownerId) {
      return null;
    }
    const ownerName = `${source?.creatorName ?? ''}`.trim()
      || (this.isActivityInvitationRow(row) ? `${source?.inviter ?? ''}`.trim() : '')
      || 'Organizer';
    return {
      userId: ownerId,
      name: ownerName,
      startAtIso: source?.startAt ?? row.dateIso ?? null,
      timeframe: source?.timeframe ?? source?.when ?? this.activityRowTimeframe(row)
    };
  }

  private resolveActivityServiceChat(row: InfoCardData, card: InfoCardData | null = null): ChatDTO | null {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return null;
    }
    const source = this.activityDisplaySourceForRow(row) as (ActivityEventRecordLike & { creatorName?: string }) | null;
    const eventId = `${source?.id ?? this.resolveActivityShareEntityId(row, card)}`.trim();
    const ownerId = `${source?.creatorUserId ?? this.activityInfoCardOwnerId(card ?? this.activityInfoCardForRow(row))}`.trim();
    if (!eventId || !ownerId) {
      return null;
    }
    const title = row.title?.trim()
      || `${source?.title ?? source?.description ?? ''}`.trim()
      || card?.title?.trim()
      || this.activityInfoCardForRow(row)?.title?.trim()
      || 'Event';
    return this.chatsService.buildActivityServiceChat({
      activeUserId,
      eventId,
      ownerId,
      title,
      actionLabel: this.activityServiceChatActionLabel(row),
      creatorName: source?.creatorName ?? null,
      hosting: this.isActivityRowAdmin(row),
      notification: this.isActivityRowAdmin(row)
    });
  }

  private activityInfoCardEntityId(card: InfoCardData | null | undefined): string {
    return `${card?.id ?? ''}`.trim();
  }

  private activityInfoCardOwnerId(card: InfoCardData | null | undefined): string {
    return `${card?.ownerId ?? ''}`.trim();
  }

  private activityInfoCardForRow(row: InfoCardData): InfoCardData | null {
    return row;
  }

  private activityRowDistanceKm(row: InfoCardData): number {
    const meters = Number.isFinite(row.distanceMetersExact)
      ? Math.max(0, Math.trunc(Number(row.distanceMetersExact)))
      : 0;
    return Math.round((meters / 1000) * 10) / 10;
  }

  private activityDisplaySourceForRow(row: InfoCardData): ActivityEventRecordLike {
    const dto = this.activityEventDTOForRow(row);
    if (dto) {
      return {
        ...dto,
        avatar: dto.creatorInitials ?? '',
        description: dto.title,
        shortDescription: dto.subtitle,
        when: dto.timeframe,
        unread: dto.activity,
        isAdmin: this.isActivityRowAdmin(row),
        startAt: dto.startAtIso,
        endAt: dto.endAtIso,
        capacityMax: dto.capacityMax ?? dto.capacityTotal,
        capacityMin: dto.capacityMin ?? null
      };
    }
    return {
      id: row.id,
      avatar: this.activityRowCreatorInitials(row),
      title: row.title,
      description: row.title,
      shortDescription: this.activityRowSubtitle(row),
      timeframe: this.activityRowTimeframe(row),
      when: this.activityRowTimeframe(row),
      activity: this.activityRowActivityCount(row),
      unread: this.activityRowActivityCount(row),
      isAdmin: this.isActivityRowAdmin(row),
      creatorUserId: row.ownerId ?? row.ownerUserId ?? '',
      creatorName: row.description || row.title,
      startAt: this.activityRowStartAt(row),
      endAt: this.activityRowEndAt(row),
      distanceKm: this.activityRowDistanceKm(row),
      acceptedMembers: 0,
      pendingMembers: 0,
      capacityTotal: 0,
      capacityMin: null,
      capacityMax: null,
      imageUrl: row.imageUrl ?? '',
      visibility: this.activityRowVisibility(row)
    };
  }

  public runActivityItemApproveAction(row: InfoCardData, event?: Event): void {
    event?.stopPropagation();
    if (!this.isActivityInvitationRow(row)) {
      this.openActivityRowInEventModule(row, true);
      return;
    }
    void this.openInvitationApprovalFlow(row);
  }

  private async openInvitationApprovalFlow(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    const record = activeUserId ? await this.eventsService.queryKnownRecordById(activeUserId, row.id) : null;
    const relatedSource = this.activityDisplaySourceForRow(row);
    const requiresAdminApproval = await this.resolveInvitationRequiresAdminApproval(
      row.id,
      record?.creatorUserId ?? relatedSource.creatorUserId
    );
    if (record && this.shouldUseCheckoutFlow(record)) {
      this.eventCheckoutDialogStore.open({
        mode: 'invitation',
        userId: activeUserId,
        record,
        requiresApprovalBeforePayment: requiresAdminApproval,
        title: 'Accept invitation?',
        subtitle: record.timeframe,
        confirmLabel: 'Accept',
        busyConfirmLabel: 'Accepting...',
        failureMessage: 'Unable to accept invitation.',
        onSubmit: (selection: ActivityContracts.EventCheckoutSelection) => this.confirmActivityInvitationApproval(row, selection)
      });
      return;
    }
    this.dialogStore.open({
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

  public runActivityItemRestoreAction(row: InfoCardData, event?: Event, action?: CardMenuAction | null): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: 'Restore event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Restore',
      busyConfirmLabel: 'Restoring...',
      confirmTone: 'accent',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: 'Unable to restore event.',
      onConfirm: () => this.restoreActivityRow(row)
    });
  }

  public runActivityItemSecondaryAction(row: InfoCardData, event?: Event, action?: CardMenuAction | null): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: this.activitySecondaryConfirmTitle(row),
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: this.activitySecondaryConfirmActionLabel(row),
      busyConfirmLabel: this.activitySecondaryConfirmBusyLabel(row),
      confirmTone: 'danger',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: this.activitySecondaryConfirmFailureMessage(row),
      onConfirm: () => this.confirmActivitySecondaryAction(row)
    });
  }

  public runActivityItemPublishAction(row: InfoCardData, event?: Event, action?: CardMenuAction | null): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: 'Publish event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Publish',
      busyConfirmLabel: 'Publishing...',
      confirmTone: 'accent',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: 'Unable to publish event.',
      onConfirm: () => this.confirmActivityPublish(row)
    });
  }

  public runActivityItemUnpublishAction(row: InfoCardData, event?: Event, action?: CardMenuAction | null): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: 'Unpublish event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Unpublish',
      busyConfirmLabel: 'Unpublishing...',
      confirmTone: 'neutral',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: 'Unable to unpublish event.',
      onConfirm: () => this.confirmActivityUnpublish(row)
    });
  }

  public runActivityItemTakeOverAction(row: InfoCardData, event?: Event, action?: CardMenuAction | null): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: 'Take over event?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Take Over',
      busyConfirmLabel: 'Taking over...',
      confirmTone: 'accent',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: 'Unable to take over event.',
      onConfirm: () => this.confirmActivityTakeOver(row)
    });
  }

  private async confirmActivityTakeOver(row: InfoCardData): Promise<void> {
    await this.eventsService.takeOverItem(this.activeUser.id, row.id);
    const nextStatus = this.restoredActivityStatus();
    if (this.activitiesEventScope === 'pending') {
      this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    } else {
      this.activitiesSmartList?.patchVisibleItem(
        (item: InfoCardData) => item.id === row.id,
        (item: InfoCardData) => {
          const updatedRow = { ...item, status: nextStatus };
          this.refreshActivityEventInfoCard(updatedRow);
          return updatedRow;
        }
      );
    }
    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private restoredActivityStatus(): string {
    return 'A';
  }

  private confirmationPaletteForCardAction(action: CardMenuAction | null | undefined): AppMenuPalette | null {
    switch (action?.tone) {
      case 'accent':
        return 'brown';
      case 'warning':
      case 'review':
        return 'orange';
      case 'destructive':
        return 'danger';
      default:
        return null;
    }
  }

  private async confirmActivityPublish(row: InfoCardData): Promise<void> {
    await this.eventsService.publishItem(this.activeUser.id, row.id);
    this.activeHostingIds = new Set([...this.activeHostingIds, row.id]);

    if (this.shouldRemovePublishedRowFromCurrentScope()) {
      this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    } else {
      this.patchVisibleActivityEventRow(row, {
        status: 'A'
      });
    }

    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private async confirmActivityUnpublish(row: InfoCardData): Promise<void> {
    await this.eventsService.unpublishItem(this.activeUser.id, row.id);
    const nextActiveIds = new Set(this.activeHostingIds);
    nextActiveIds.delete(row.id);
    this.activeHostingIds = nextActiveIds;
    this.patchVisibleActivityEventRow(row, {
      status: 'DR'
    });
    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private shouldRemovePublishedRowFromCurrentScope(): boolean {
    return this.activitiesEventScope === 'drafts'
      || (this.activitiesEventScope === 'my-events' && this.hostingPublicationFilter === 'drafts');
  }

  private patchVisibleActivityEventRow(
    row: InfoCardData,
    patch: Partial<InfoCardData>
  ): void {
    const smartList = this.activitiesSmartList;
    if (!smartList) {
      return;
    }
    const rowKey = this.activityRowIdentity(row);
    smartList.patchVisibleItem(
      (item: InfoCardData) => this.activityRowIdentity(item) === rowKey,
      (item: InfoCardData) => {
        const updatedRow = {
          ...item,
          ...patch
        };
        this.refreshActivityEventInfoCard(updatedRow);
        return updatedRow;
      }
    );
  }

  private activitySecondaryConfirmTitle(row: InfoCardData): string {
    if (this.isActivityInvitationRow(row)) {
      return 'Reject invitation?';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leave event?';
    }
    return 'Delete event?';
  }

  private activitySecondaryConfirmActionLabel(row: InfoCardData): string {
    if (this.isActivityInvitationRow(row)) {
      return 'Reject';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leave';
    }
    return 'Delete';
  }

  private activitySecondaryConfirmBusyLabel(row: InfoCardData): string {
    if (this.isActivityInvitationRow(row)) {
      return 'Rejecting...';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leaving...';
    }
    return 'Deleting...';
  }

  private activitySecondaryConfirmFailureMessage(row: InfoCardData): string {
    if (this.isActivityInvitationRow(row)) {
      return 'Unable to reject invitation.';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Unable to leave event.';
    }
    return 'Unable to delete event.';
  }

  private async confirmActivitySecondaryAction(row: InfoCardData): Promise<void> {
    if (!this.isActivityRowAdmin(row) && !this.isActivityInvitationRow(row)) {
      await this.confirmActivityLeave(row);
      return;
    }
    await this.persistActivityRowTrash(row);
    this.markActivityRowTrashed(row);
    this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    this.cdr.markForCheck();
  }

  private async confirmActivityLeave(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    const eventDetailDTO = await this.buildLeftActivityEventDetailDTO(row);
    if (!eventDetailDTO) {
      this.eventCheckoutDraftStore.clear(activeUserId, row.id);
      this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
      this.refreshSectionBadges();
      this.cdr.markForCheck();
      return;
    }

    this.eventCheckoutDraftStore.clear(activeUserId, row.id);
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(row.id);
    const nextMembers = currentMembers.filter((member: ActivityContracts.ActivityMemberDTO) => member.userId !== activeUserId);
    const capacityTotal = Math.max(
      Math.max(0, Math.trunc(Number(eventDetailDTO.acceptedMembers) || 0)),
      Math.max(0, Math.trunc(Number(eventDetailDTO.capacityTotal) || 0))
    );
    const persistence = Promise.all([
      this.emitActivityEventSave(eventDetailDTO),
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
    upcomingSlots?: ContractTypes.EventSlotOccurrenceDTO[] | null;
    policiesEnabled?: boolean | null;
    policies?: ContractTypes.EventPolicyDTO[] | null;
    subEvents?: ContractTypes.SubEventDTO[] | null;
    pricing?: ContractTypes.PricingConfig | null;
  }): boolean {
    if ((record?.upcomingSlots?.length ?? 0) > 0) {
      return true;
    }
    if (record?.policiesEnabled === true && (record?.policies?.length ?? 0) > 0) {
      return true;
    }
    if ((record?.subEvents ?? []).some((item: ContractTypes.SubEventDTO) => item.optional)) {
      return true;
    }
    return Boolean(record?.pricing?.enabled && (Number(record?.pricing?.basePrice) || 0) > 0);
  }

  private async confirmActivityInvitationApproval(
    row: InfoCardData,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): Promise<void> {
    const { eventDetailDTO, nextMembers, capacityTotal } = await this.buildAcceptedInvitationSaveResult(row, selection);
    const [displaySync] = await Promise.all([
      this.eventsService.saveActivityEvent(eventDetailDTO),
      nextMembers
        ? this.activityMembersService.replaceMembersByOwnerId(eventDetailDTO.id, nextMembers, capacityTotal)
        : Promise.resolve()
    ]);
    if (!displaySync) {
      return;
    }
    this.removeInvitationItem(eventDetailDTO.id);
    this.applyActivityEventSave(displaySync);
    this.cdr.markForCheck();
  }

  private async buildAcceptedInvitationSaveResult(
    row: InfoCardData,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): Promise<InvitationApprovalSaveResult> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      throw new Error('Unable to resolve active user.');
    }

    const relatedSource = this.activityDisplaySourceForRow(row);
    const record = await this.eventsService.queryKnownRecordById(activeUserId, row.id);
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(row.id);
    const activeInviteEntry = currentMembers.find((member: ActivityContracts.ActivityMemberDTO) =>
      member.userId === activeUserId
      && member.status === 'pending'
      && member.requestKind === 'invite'
    ) ?? null;
    const requiresAdminApproval = this.invitationRequiresAdminApproval(
      activeInviteEntry,
      currentMembers,
      record?.creatorUserId ?? relatedSource.creatorUserId
    );

    const existingAcceptedMemberUserIds = this.activityMemberUserIdsByStatus(currentMembers, 'accepted');
    const existingPendingMemberUserIds = this.activityMemberUserIdsByStatus(currentMembers, 'pending')
      .filter(userId => !existingAcceptedMemberUserIds.includes(userId));
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

    const title = record?.title ?? relatedSource.title ?? relatedSource.description ?? row.title;
    const shortDescription = record?.subtitle
      ?? relatedSource.shortDescription
      ?? this.activityRowSubtitle(row)
      ?? `Invited by ${relatedSource.inviter ?? relatedSource.creatorName ?? row.title}`;
    const timeframe = record?.timeframe ?? relatedSource.timeframe ?? relatedSource.when ?? this.activityRowTimeframe(row);
    const startAt = record?.startAtIso ?? relatedSource.startAt ?? this.activityRowStartAt(row);
    const endAt = record?.endAtIso ?? relatedSource.endAt ?? this.activityRowEndAt(row) ?? startAt;
    const distanceKmRaw = record?.distanceKm ?? relatedSource.distanceKm ?? this.activityRowDistanceKm(row);
    const distanceKm = Number.isFinite(Number(distanceKmRaw)) ? Math.max(0, Number(distanceKmRaw)) : 0;
    const creatorName = record?.creatorName?.trim() || `${relatedSource.inviter ?? relatedSource.creatorName ?? ''}`.trim() || title;
    const creatorInitials = record?.creatorInitials?.trim() || relatedSource.avatar?.trim() || AppUtils.initialsFromText(creatorName);
    const capacityTotal = Math.max(
      nextAcceptedMembers,
      this.chatCountValue(record?.capacityTotal ?? relatedSource.capacityTotal ?? relatedSource.capacityMax)
    );
    const selectedSlot = selection?.slotSourceId
      ? (record?.upcomingSlots ?? []).find((item: ContractTypes.EventSlotOccurrenceDTO) => item.id === selection.slotSourceId) ?? null
      : null;

    return {
      eventDetailDTO: new ActivityEventDetailDTO().apply({
        id: row.id,
        type: 'events',
        title,
        subtitle: shortDescription,
        timeframe,
        activity: this.chatCountValue(record?.activity ?? relatedSource.activity ?? relatedSource.unread ?? this.activityRowActivityCount(row)),
        startAtIso: startAt,
        endAtIso: endAt,
        distanceKm,
        imageUrl: record?.imageUrl ?? relatedSource.imageUrl ?? row.imageUrl ?? '',
        acceptedMembers: nextAcceptedMembers,
        pendingMembers: nextPendingMembers,
        capacityTotal,
        capacityMin: record?.capacityMin ?? relatedSource.capacityMin ?? null,
        capacityMax: record?.capacityMax ?? relatedSource.capacityMax ?? capacityTotal,
        autoInviter: record?.autoInviter ?? relatedSource.autoInviter,
        frequency: record?.frequency ?? relatedSource.frequency,
        ticketing: record?.ticketing ?? relatedSource.ticketing,
        pricing: record?.pricing ?? relatedSource.pricing,
        policiesEnabled: record?.policiesEnabled ?? relatedSource.policiesEnabled ?? false,
        policies: Array.isArray(record?.policies)
          ? record.policies.map((item: ContractTypes.EventPolicyDTO) => ({ ...item }))
          : (Array.isArray(relatedSource.policies) ? relatedSource.policies.map((item: ContractTypes.EventPolicyDTO) => ({ ...item })) : undefined),
        slotsEnabled: record?.slotsEnabled ?? relatedSource.slotsEnabled,
        slotTemplates: Array.isArray(record?.slotTemplates)
          ? record.slotTemplates.map((item: ContractTypes.EventSlotTemplateDTO) => ({ ...item }))
          : (Array.isArray(relatedSource.slotTemplates) ? relatedSource.slotTemplates.map((item: ContractTypes.EventSlotTemplateDTO) => ({ ...item })) : undefined),
        parentEventId: record?.parentEventId ?? relatedSource.parentEventId,
        slotTemplateId: record?.slotTemplateId ?? relatedSource.slotTemplateId,
        generated: record?.generated ?? relatedSource.generated,
        eventType: record?.eventType ?? relatedSource.eventType,
        nextSlot: selectedSlot
          ? { ...selectedSlot }
          : (record?.nextSlot ? { ...record.nextSlot } : (relatedSource.nextSlot ? { ...relatedSource.nextSlot } : undefined)),
        upcomingSlots: Array.isArray(record?.upcomingSlots)
          ? record.upcomingSlots.map((item: ContractTypes.EventSlotOccurrenceDTO) => ({ ...item }))
          : (Array.isArray(relatedSource.upcomingSlots) ? relatedSource.upcomingSlots.map((item: ContractTypes.EventSlotOccurrenceDTO) => ({ ...item })) : undefined),
        visibility: record?.visibility ?? relatedSource.visibility,
        blindMode: record?.blindMode ?? relatedSource.blindMode,
        status: record?.status ?? relatedSource.status ?? 'A',
        creatorUserId: record?.creatorUserId ?? relatedSource.creatorUserId,
        creatorName,
        creatorInitials,
        creatorGender: record?.creatorGender,
        creatorCity: record?.creatorCity,
        location: record?.location ?? relatedSource.location,
        locationCoordinates: record?.locationCoordinates ?? relatedSource.locationCoordinates,
        sourceLink: record?.sourceLink ?? relatedSource.sourceLink,
        topics: [...(record?.topics ?? relatedSource.topics ?? [])],
        subEvents: Array.isArray(record?.subEvents)
          ? this.cloneSyncedSubEventForms(record.subEvents)
          : (Array.isArray(relatedSource.subEvents) ? this.cloneSyncedSubEventForms(relatedSource.subEvents) : undefined),
        mode: record?.mode ?? relatedSource.mode,
        paymentSessionId: selection?.paymentSessionId ?? null
      }),
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
    const activeInviteEntry = currentMembers.find((member: ActivityContracts.ActivityMemberDTO) =>
      member.userId === activeUserId
      && member.status === 'pending'
      && member.requestKind === 'invite'
    ) ?? null;
    return this.invitationRequiresAdminApproval(activeInviteEntry, currentMembers, creatorUserId);
  }

  private invitationRequiresAdminApproval(
    activeInviteEntry: ActivityContracts.ActivityMemberDTO | null,
    currentMembers: readonly ActivityContracts.ActivityMemberDTO[],
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
    members: readonly ActivityContracts.ActivityMemberDTO[],
    activeUserId: string,
    requiresAdminApproval: boolean
  ): ActivityContracts.ActivityMemberDTO[] | null {
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
    delete this.activityMembersByRowId[`invitations:${sourceId}`];
  }

  private async buildLeftActivityEventDetailDTO(
    row: InfoCardData
  ): Promise<ActivityEventDetailDTO | null> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return null;
    }

    const relatedSource = this.activityDisplaySourceForRow(row);
    const record = await this.eventsService.queryKnownRecordById(activeUserId, row.id);
    const source = relatedSource;
    const creatorUserId = record?.creatorUserId ?? source.creatorUserId ?? row.ownerId ?? row.ownerUserId ?? '';
    if (!creatorUserId.trim()) {
      return null;
    }

    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(row.id);
    const existingAcceptedMemberUserIds = this.activityMemberUserIdsByStatus(currentMembers, 'accepted');
    const existingPendingMemberUserIds = this.activityMemberUserIdsByStatus(currentMembers, 'pending')
      .filter(userId => !existingAcceptedMemberUserIds.includes(userId));
    const activeUserWasAccepted = existingAcceptedMemberUserIds.includes(activeUserId);
    const activeUserWasPending = existingPendingMemberUserIds.includes(activeUserId);
    const nextAcceptedMemberUserIds = existingAcceptedMemberUserIds.filter(userId => userId !== activeUserId);
    const nextPendingMemberUserIds = existingPendingMemberUserIds
      .filter(userId => userId !== activeUserId && !nextAcceptedMemberUserIds.includes(userId));

    const acceptedMembersBase = this.chatCountValue(
      record?.acceptedMembers
      ?? source.acceptedMembers
    );
    const pendingMembersBase = this.chatCountValue(
      record?.pendingMembers
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

    const title = record?.title ?? source.title ?? row.title;
    const shortDescription = record?.subtitle
      ?? source.shortDescription
      ?? this.activityRowSubtitle(row)
      ?? '';
    const timeframe = record?.timeframe ?? source.timeframe ?? this.activityRowTimeframe(row);
    const startAt = record?.startAtIso ?? source.startAt ?? this.activityRowStartAt(row);
    const endAt = record?.endAtIso ?? source.endAt ?? this.activityRowEndAt(row) ?? startAt;
    const distanceKmRaw = record?.distanceKm ?? source.distanceKm ?? this.activityRowDistanceKm(row);
    const distanceKm = Number.isFinite(Number(distanceKmRaw)) ? Math.max(0, Number(distanceKmRaw)) : 0;
    const creatorName = record?.creatorName?.trim() || title;
    const creatorInitials = record?.creatorInitials?.trim()
      || source.avatar?.trim()
      || this.activityRowCreatorInitials(row)
      || AppUtils.initialsFromText(creatorName);
    const capacityTotal = Math.max(
      nextAcceptedMembers,
      this.chatCountValue(
        record?.capacityTotal
        ?? source.capacityTotal
        ?? source.capacityMax
      )
    );

    return new ActivityEventDetailDTO().apply({
      id: row.id,
      type: 'events',
      title,
      subtitle: shortDescription,
      timeframe,
      activity: this.chatCountValue(record?.activity ?? source.activity ?? this.activityRowActivityCount(row)),
      startAtIso: startAt,
      endAtIso: endAt,
      distanceKm,
      imageUrl: record?.imageUrl ?? source.imageUrl ?? row.imageUrl ?? '',
      acceptedMembers: nextAcceptedMembers,
      pendingMembers: nextPendingMembers,
      capacityTotal,
      capacityMin: record?.capacityMin ?? source.capacityMin ?? null,
      capacityMax: record?.capacityMax ?? source.capacityMax ?? capacityTotal,
      autoInviter: record?.autoInviter ?? source.autoInviter,
      frequency: record?.frequency ?? source.frequency,
      ticketing: record?.ticketing ?? source.ticketing,
      pricing: record?.pricing ?? source.pricing,
      policiesEnabled: record?.policiesEnabled ?? source.policiesEnabled ?? false,
      policies: Array.isArray(record?.policies)
        ? record.policies.map((item: ContractTypes.EventPolicyDTO) => ({ ...item }))
        : (Array.isArray(source.policies) ? source.policies.map((item: ContractTypes.EventPolicyDTO) => ({ ...item })) : undefined),
      slotsEnabled: record?.slotsEnabled ?? source.slotsEnabled,
      slotTemplates: Array.isArray(record?.slotTemplates)
        ? record.slotTemplates.map((item: ContractTypes.EventSlotTemplateDTO) => ({ ...item }))
        : (Array.isArray(source.slotTemplates) ? source.slotTemplates.map((item: ContractTypes.EventSlotTemplateDTO) => ({ ...item })) : undefined),
      parentEventId: record?.parentEventId ?? source.parentEventId,
      slotTemplateId: record?.slotTemplateId ?? source.slotTemplateId,
      generated: record?.generated ?? source.generated,
      eventType: record?.eventType ?? source.eventType,
      nextSlot: record?.nextSlot
        ? { ...record.nextSlot }
        : (source.nextSlot ? { ...source.nextSlot } : undefined),
      upcomingSlots: Array.isArray(record?.upcomingSlots)
        ? record.upcomingSlots.map((item: ContractTypes.EventSlotOccurrenceDTO) => ({ ...item }))
        : (Array.isArray(source.upcomingSlots) ? source.upcomingSlots.map((item: ContractTypes.EventSlotOccurrenceDTO) => ({ ...item })) : undefined),
      visibility: record?.visibility ?? source.visibility ?? this.activityRowVisibility(row),
      blindMode: record?.blindMode ?? source.blindMode,
      status: record?.status ?? source.status ?? 'A',
      creatorUserId,
      creatorName,
      creatorInitials,
      creatorGender: record?.creatorGender,
      creatorCity: record?.creatorCity,
      location: record?.location ?? source.location,
      locationCoordinates: record?.locationCoordinates ?? source.locationCoordinates,
      sourceLink: record?.sourceLink ?? source.sourceLink,
      topics: [...(record?.topics ?? source.topics ?? [])],
      subEvents: Array.isArray(record?.subEvents)
        ? this.cloneSyncedSubEventForms(record.subEvents)
        : (Array.isArray(source.subEvents) ? this.cloneSyncedSubEventForms(source.subEvents) : undefined),
      mode: record?.mode ?? source.mode,
      paymentSessionId: null
    });
  }

  public isActivityIdentityTrashed(type: ActivityContracts.ActivityEventRepositoryItemType, id: string): boolean {
    return Boolean(this.trashedActivityRowsByKey[`${type}:${id}`]);
  }

  public isActivityRowTrashed(row: InfoCardData): boolean {
    const status = this.activityStatusCode(row);
    if (status === 'T' || status === 'D' || status === 'I') {
      return true;
    }
    return this.isActivityIdentityTrashed(this.activityEventListTypeForRow(row), row.id);
  }

  public trashedActivityCount(): number {
    return Object.keys(this.trashedActivityRowsByKey).length;
  }

  private markActivityRowTrashed(row: InfoCardData): void {
    this.trashedActivityRowsByKey[this.activityRowIdentity(row)] = this.withActivityEventInfoCard({
      ...row,
      status: 'T'
    });
    this.refreshSectionBadges();
  }

  private unmarkActivityRowTrashed(row: InfoCardData): void {
    delete this.trashedActivityRowsByKey[this.activityRowIdentity(row)];
    this.refreshSectionBadges();
  }

  private async persistActivityRowTrash(row: InfoCardData): Promise<void> {
    await this.eventsService.trashItem(this.activeUser.id, row.id);
  }

  private async restoreActivityRow(row: InfoCardData): Promise<void> {
    await this.eventsService.restoreItem(this.activeUser.id, row.id);
    this.unmarkActivityRowTrashed(row);
    this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    this.cdr.markForCheck();
  }

  public onActivityRowClick(row: InfoCardData, event?: Event): void {
    event?.stopPropagation();
    this.openActivityRowInEventModule(row, true);
  }

  public openActivityMembers(row: InfoCardData, event?: Event): void {
    event?.stopPropagation();
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: row.id,
      ownerType: 'event',
      subtitle: row.title,
      canManage: this.isActivityRowAdmin(row)
    });
  }

  public canApproveActivityMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (!this.selectedActivityMembersRow || !this.isActivityRowAdmin(this.selectedActivityMembersRow)) {
      return false;
    }
    return entry.status === 'pending' && this.isActivityJoinRequest(entry);
  }

  public canDeleteActivityMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (this.isActivityWaitlistMember(entry)) {
      return false;
    }
    if (this.selectedActivityMembersRow && this.isActivityRowAdmin(this.selectedActivityMembersRow)) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  public activityMemberMenuDeleteLabel(entry: ActivityContracts.ActivityMemberDTO): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  private isActivityJoinRequest(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return entry.requestKind === 'join'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private isActivityWaitlistMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite';
  }

  public approveActivityMember(entry: ActivityContracts.ActivityMemberDTO, event?: Event): void {
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
  }

  public removeActivityMember(entry: ActivityContracts.ActivityMemberDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedActivityMembersRowId || !this.canDeleteActivityMember(entry)) {
      return;
    }
    this.pendingActivityMemberDelete = entry;
  }

  public openActivityRowInEventModule(row: InfoCardData, readOnly: boolean): void {
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'eventEditor',
      eventId: row.id,
      target: this.isActivityRowAdmin(row) || this.activityEventListTypeForRow(row) === 'hosting' ? 'hosting' : 'events',
      readOnly: this.isActivityInvitationRow(row) ? true : readOnly
    });
  }
}
