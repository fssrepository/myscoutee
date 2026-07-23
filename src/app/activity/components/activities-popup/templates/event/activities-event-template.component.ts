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
import type { UserMenuCounterDeltasDto } from '../../../../../shared/core/contracts/user.interface';
import {
  ActivityMembersBuilder
} from '../../../../../shared/core';
import {
  type ActivityCounterKey,
  type ActivityCounters,
  InfoCardComponent,
  type InfoCardData,
  type AppMenuPalette,
  type CardMenuAction,
  type CardMenuActionEvent,
  type CardMenuRequestEvent
} from '../../../../../shared/ui';
import {
  ActivityEventInfoCardMenuConverter,
  type ActivityEventEditorAction,
  type ActivityEventInfoCardMenuSubject
} from '../../../../../shared/ui/converters';

import type * as AppConstants from '../../../../../shared/core/common/constants';
import type { MemberMenuStore } from '../../../../../shared/ui/context/stores/member-menu.store';
import type { EventSubeventsPopupStore } from '../../../../../shared/ui/context/stores/event-subevents-popup.store';
import type { EventCheckoutDraft } from '../../../../../shared/ui/context/stores/event-checkout-draft.store';


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
  | 'continueBooking'
  | 'deleteEvent'
  | 'editEvent'
  | 'leaveEvent'
  | 'manageEvent'
  | 'notifyParticipants'
  | 'paymentSummary'
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
type ActivityEventCounterKey = keyof NonNullable<ActivityCounters['event']>;
type InvitationApprovalSaveResult = {
  eventDetailDTO: ActivityEventDetailDTO;
  nextMembers: ActivityContracts.ActivityMemberDTO[] | null;
  capacityTotal: number;
};
type InvitationApprovalContext = {
  record: ActivityContracts.ActivityEventRecord | null;
  currentMembers: ActivityContracts.ActivityMemberDTO[];
  requiresAdminApproval: boolean;
};

export class ActivitiesEventsController {
  constructor(private readonly host: ActivitiesEventsHost) {}

  private get activeUser() { return this.host.activeUser as any; }
  private get activitiesEventScope() { return this.host.activitiesEventScope as ContractTypes.ActivitiesEventScope; }
  private set activitiesEventScope(value: ContractTypes.ActivitiesEventScope) { this.host.activitiesEventScope = value; }
  private get activitiesSmartList() { return this.host.activitiesSmartList; }
  private get activityMembersByRowId() { return this.host.activityMembersByRowId as Record<string, ActivityContracts.ActivityMemberDTO[]>; }
  private get activityMembersService() { return this.host.activityMembersService; }
  private get activityStore() { return this.host.activityStore; }
  private get chatsService() { return this.host.chatsService; }
  private get cdr() { return this.host.cdr; }
  private get dialogStore() { return this.host.dialogStore; }
  private get eventCheckoutDraftStore() { return this.host.eventCheckoutDraftStore; }
  private get eventCheckoutDialogStore() { return this.host.eventCheckoutDialogStore; }
  private get eventsService() { return this.host.eventsService; }
  private get activitiesStore() { return this.host.activitiesStore; }
  private get usersService() { return this.host.usersService; }
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
  private chatCountValue(value: unknown): number { return this.host.chatCountValue(value); }
  private cloneSyncedSubEventForms(items: ContractTypes.SubEventDTO[]): ContractTypes.SubEventDTO[] { return this.host.cloneSyncedSubEventForms(items); }
  private openActivityChat(chat: ChatDTO): void { this.host.openActivityChat(chat); }
  private persistSelectedActivityMembers(): void { this.host.persistSelectedActivityMembers(); }
  private refreshSectionBadges(): void { this.host.refreshSectionBadges(); }
  private applyActivityEventCounterDeltas(
    primaryDelta: Record<string, number> = {},
    eventDelta: Record<string, number> = {}
  ): void {
    const activeUser = this.activeUser;
    const activeUserId = `${activeUser?.id ?? ''}`.trim();
    if (!activeUserId) {
      return;
    }
    const delta = this.activityCounterDeltaFromDeltas(primaryDelta, eventDelta);
    if (!delta) {
      return;
    }
    this.signalActivityCounterDelta(activeUserId, delta);
    void this.persistLocalActivityCounterDelta(activeUserId, delta);
  }

  private activityCounterDeltaFromDeltas(
    primaryDelta: Record<string, number>,
    eventDelta: Record<string, number>
  ): UserMenuCounterDeltasDto | null {
    const delta: UserMenuCounterDeltasDto = {};
    for (const [key, value] of Object.entries(primaryDelta) as Array<[ActivityCounterKey, number | undefined]>) {
      if (!Number.isFinite(value) || Number(value) === 0) {
        continue;
      }
      (delta as Record<string, number>)[key] = Number(value);
    }
    if (Object.keys(eventDelta).length > 0) {
      const eventCounters: Record<string, number> = {};
      for (const [key, value] of Object.entries(eventDelta) as Array<[ActivityEventCounterKey, number | undefined]>) {
        if (!Number.isFinite(value) || Number(value) === 0) {
          continue;
        }
        eventCounters[key] = Number(value);
      }
      if (Object.keys(eventCounters).length > 0) {
        delta.event = eventCounters;
      }
    }
    return Object.keys(delta).length > 0 ? delta : null;
  }

  private signalActivityCounterDelta(activeUserId: string, delta: UserMenuCounterDeltasDto | null): void {
    if (!delta) {
      return;
    }
    this.activityStore.patchUserCounterDeltas(activeUserId, delta, this.activeUser?.activities ?? null);
  }

  private async persistLocalActivityCounterDelta(
    activeUserId: string,
    delta: UserMenuCounterDeltasDto | null
  ): Promise<void> {
    if (!delta || typeof this.usersService?.patchLocalUserActivityCounterDeltas !== 'function') {
      return;
    }
    await this.usersService.patchLocalUserActivityCounterDeltas(activeUserId, delta);
  }

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
    if (this.activitiesEventScope === 'drafts') {
      return 'hosting';
    }
    const fromHost = typeof this.host.activityEventListTypeForRow === 'function'
      ? this.host.activityEventListTypeForRow(row)
      : null;
    const dto = this.activityEventDTOForRow(row);
    if (dto && this.resolveActivityEventListTypeFromDTO(dto) === 'hosting') {
      return 'hosting';
    }
    if (this.isActivityEventListType(fromHost)) {
      return fromHost;
    }
    return dto ? this.resolveActivityEventListTypeFromDTO(dto) : 'events';
  }

  private resolveActivityEventListTypeFromDTO(
    dto: ActivityContracts.ActivityEventDTO
  ): ActivityContracts.ActivityEventRepositoryItemType {
    const activeUserId = this.activeUserId();
    if (activeUserId && (dto.invitedMemberUserIds ?? []).includes(activeUserId)) {
      return 'invitations';
    }
    if (activeUserId && (`${dto.creatorUserId ?? ''}`.trim() === activeUserId || (dto.adminIds ?? []).includes(activeUserId))) {
      return 'hosting';
    }
    return 'events';
  }

  private isActivityRowAdmin(row: InfoCardData): boolean {
    if (this.activitiesEventScope === 'drafts') {
      return true;
    }
    const dto = this.activityEventDTOForRow(row);
    const activeUserId = this.activeUserId();
    return !!activeUserId
      && (
        `${dto?.creatorUserId ?? ''}`.trim() === activeUserId
        || (dto?.adminIds ?? []).includes(activeUserId)
        || `${row.ownerUserId ?? row.ownerId ?? ''}`.trim() === activeUserId
        || this.activityEventListTypeForRow(row) === 'hosting'
      );
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
    const dto = this.activityEventDTOForRow(row);
    return this.normalizeActivityStatusCode(dto?.status ?? row.status);
  }

  private isActivityDraftRow(row: InfoCardData): boolean {
    return this.activityStatusCode(row) === 'DR' || this.activitiesEventScope === 'drafts';
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
    return 'Ask Organizer';
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
        this.runActivityItemPrimaryAction(row);
        break;
      case 'viewInvitation':
      case 'view':
        this.runActivityItemViewAction(row);
        break;
      case 'continueBooking':
        this.runActivityItemCheckoutAction(row, false);
        break;
      case 'paymentSummary':
        this.runActivityItemCheckoutAction(row, true);
        break;
      case 'notifyParticipants':
      case 'askOrganizer':
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
    const dto = this.activityEventDTOForRow(row);
    this.eventSubeventsStore.openEventSubeventsListPopup({
      eventId: row.id,
      host: 'activities',
      target: this.isActivityRowAdmin(row) || this.activityEventListTypeForRow(row) === 'hosting' ? 'hosting' : 'events',
      title: row.title,
      timeframe: this.activityRowTimeframe(row),
      startAtIso: this.activityRowStartAt(row),
      endAtIso: this.activityRowEndAt(row),
      mode: dto?.mode ?? null,
      editorAction: this.isActivityInvitationRow(row) ? 'view' : this.activityEventEditorAction(row)
    });
  }

  private activityEventEditorAction(row: InfoCardData): ActivityEventEditorAction {
    return ActivityEventInfoCardMenuConverter.eventEditorAction(this.activityEventMenuSubjectFromRow(row), {
      activeUserId: this.activeUser.id
    });
  }

  public runActivityItemCheckoutAction(row: InfoCardData, readOnlySummary: boolean, event?: Event): void {
    event?.stopPropagation();
    void this.openActivityCheckout(row, readOnlySummary);
  }

  private async openActivityCheckout(row: InfoCardData, readOnlySummary: boolean): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    const relatedSource = this.activityDisplaySourceForRow(row);
    const draft = this.eventCheckoutDraftStore.read(activeUserId, row.id);
    const loadingDialog = this.eventCheckoutDialogStore.open({
      mode: 'join',
      userId: activeUserId,
      record: this.buildActivityCheckoutLoadingRecord(row, activeUserId, relatedSource),
      loading: true,
      readOnlySummary,
      title: readOnlySummary ? 'event.checkout.payment.summary' : 'event.checkout.continue.booking',
      confirmLabel: 'Join',
      busyConfirmLabel: 'Joining...',
      failureMessage: readOnlySummary ? 'Unable to open payment summary.' : 'Unable to continue booking.',
      onSubmit: (selection: ActivityContracts.EventCheckoutSelection) => this.submitActivityCheckoutContinuation(row, selection)
    });
    const loadingDialogId = loadingDialog?.id ?? null;
    const record = await this.eventsService.queryKnownRecordById(activeUserId, row.id);
    if (!this.eventCheckoutDialogStore.isCurrent(loadingDialogId)) {
      return;
    }
    if (!record) {
      this.eventCheckoutDialogStore.close();
      this.dialogStore.openInfo('This checkout can no longer be restored.', {
        title: 'Basket unavailable',
        confirmTone: 'neutral'
      });
      this.cdr.markForCheck();
      return;
    }

    const currentDraft = this.eventCheckoutDraftStore.read(activeUserId, row.id) ?? draft;
    const approvalGranted = readOnlySummary || this.activityCheckoutApprovalGranted(record, currentDraft, row);
    const pendingReason = readOnlySummary || approvalGranted
      ? null
      : this.activityCheckoutPendingReason(currentDraft, record);
    this.eventCheckoutDialogStore.update(loadingDialogId, {
      mode: 'join',
      userId: activeUserId,
      record,
      readOnlySummary,
      requiresApprovalBeforePayment: this.activityCheckoutRequiresApprovalBeforePayment(record, currentDraft),
      approvalGranted,
      pendingReason,
      title: readOnlySummary ? 'event.checkout.payment.summary' : 'event.checkout.continue.booking',
      subtitle: record.timeframe,
      confirmLabel: 'Join',
      busyConfirmLabel: 'Joining...',
      failureMessage: readOnlySummary ? 'Unable to open payment summary.' : 'Unable to continue booking.',
      onSubmit: (selection: ActivityContracts.EventCheckoutSelection) => this.submitActivityCheckoutContinuation(row, selection)
    });
  }

  private buildActivityCheckoutLoadingRecord(
    row: InfoCardData,
    activeUserId: string,
    source: ActivityEventRecordLike
  ): ActivityContracts.ActivityEventRecord {
    return {
      ...this.buildInvitationCheckoutLoadingRecord(row, activeUserId, source),
      type: this.activityEventListTypeForRow(row)
    };
  }

  private activityCheckoutPendingReason(
    draft: EventCheckoutDraft | null | undefined,
    record: ActivityContracts.ActivityEventRecord | null | undefined
  ): AppConstants.ActivityPendingReason {
    if (draft?.pendingReason === 'waitlist' || draft?.checkoutState === 'waiting') {
      return 'waitlist';
    }
    if (draft?.pendingReason === 'approval' || draft?.checkoutState === 'approval-pending') {
      return 'approval';
    }
    if (record?.pendingReason === 'waitlist' || record?.pendingReason === 'approval') {
      return record.pendingReason;
    }
    return null;
  }

  private activityCheckoutRequiresApprovalBeforePayment(
    record: ActivityContracts.ActivityEventRecord | null,
    draft: EventCheckoutDraft | null = null
  ): boolean {
    return record?.approvalRequired === true || draft?.pendingReason === 'approval';
  }

  private activityCheckoutApprovalGranted(
    record: ActivityContracts.ActivityEventRecord,
    draft: EventCheckoutDraft | null,
    row: InfoCardData
  ): boolean {
    const activeUserId = this.activeUserId();
    return (
      record.acceptedMemberUserIds ?? []
    ).includes(activeUserId)
      || this.activityCheckoutMemberStatus(row.id) === 'accepted'
      || draft?.checkoutState === 'approved'
      || draft?.checkoutState === 'confirmed'
      || draft?.checkoutState === 'pay';
  }

  private activityCheckoutMemberStatus(sourceId: string): 'accepted' | 'pending' | 'none' {
    const activeUserId = this.activeUserId();
    const ownerId = sourceId.trim();
    if (!activeUserId || !ownerId) {
      return 'none';
    }
    const members = this.activityMembersService.peekMembersByOwner({
      ownerType: 'event',
      ownerId
    });
    const member = members.find((item: ActivityContracts.ActivityMemberDTO) => item.userId === activeUserId);
    if (member?.status === 'accepted') {
      return 'accepted';
    }
    if (member?.status === 'pending') {
      return 'pending';
    }
    return 'none';
  }

  private async submitActivityCheckoutContinuation(
    row: InfoCardData,
    selection: ActivityContracts.EventCheckoutSelection
  ): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      throw new Error('Unable to resolve active user.');
    }
    const joinResult = await this.eventsService.requestJoin(activeUserId, row.id, {
      slotSourceId: selection?.slotSourceId ?? null,
      optionalSubEventIds: selection?.optionalSubEventIds ?? [],
      assetSelections: selection?.assetSelections ?? [],
      acceptedPolicyIds: selection?.acceptedPolicyIds ?? [],
      appliedPromoCodes: selection?.appliedPromoCodes ?? [],
      paymentSessionId: selection?.paymentSessionId ?? null,
      bookingConfirmed: selection?.bookingConfirmed !== false,
      pendingReason: selection?.pendingReason ?? null,
      checkoutState: selection?.checkoutState,
      basketItems: selection?.basketItems?.length ? selection.basketItems : undefined,
      pricingSummaryRows: selection?.basketItems?.length ? (selection.pricingSummaryRows ?? []) : undefined,
      lineItems: selection?.basketItems?.length ? selection.lineItems : undefined,
      totalAmount: selection?.basketItems?.length ? selection.totalAmount : undefined,
      currency: selection?.basketItems?.length ? selection.currency : undefined,
      skipLocalRouteDelay: Boolean(selection?.paymentSessionId)
    });
    if (!joinResult || joinResult.membershipStatus === 'unchanged') {
      throw new Error('Unable to continue booking.');
    }
    this.emitAcceptedCheckoutActivityEventSync(row, activeUserId, joinResult);
  }

  private emitAcceptedCheckoutActivityEventSync(
    row: InfoCardData,
    activeUserId: string,
    result: ActivityContracts.EventParticipationActionResultDTO
  ): void {
    if (result.membershipStatus !== 'accepted') {
      return;
    }
    const dto = this.activityEventDTOForRow(row);
    if (!dto) {
      return;
    }
    const acceptedMemberUserIds = this.uniqueUserIds([
      ...(dto.acceptedMemberUserIds ?? []),
      activeUserId
    ]);
    const pendingMemberUserIds = this.uniqueUserIds(dto.pendingMemberUserIds ?? [])
      .filter(userId => userId !== activeUserId);
    const invitedMemberUserIds = this.uniqueUserIds(dto.invitedMemberUserIds ?? [])
      .filter(userId => userId !== activeUserId);
    const pendingRequestMemberUserIds = this.uniqueUserIds(dto.pendingRequestMemberUserIds ?? [])
      .filter(userId => userId !== activeUserId);
    const acceptedMembers = Math.max(
      this.nonNegativeInteger(result.acceptedMembers),
      acceptedMemberUserIds.length
    );
    const pendingMembers = Math.max(
      this.nonNegativeInteger(result.pendingMembers),
      pendingMemberUserIds.length,
      pendingRequestMemberUserIds.length
    );
    const capacityTotal = Math.max(
      acceptedMembers,
      this.nonNegativeInteger(result.capacityTotal),
      this.nonNegativeInteger(dto.capacityTotal)
    );
    this.activitiesStore.emitActivityEventSync({
      ...dto,
      status: dto.status ?? 'A',
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      full: result.full === true || (capacityTotal > 0 && acceptedMembers >= capacityTotal),
      acceptedMemberUserIds,
      pendingMemberUserIds,
      invitedMemberUserIds,
      pendingRequestMemberUserIds,
      pendingReason: null,
      checkoutResultState: 'succeeded'
    });
  }

  private nonNegativeInteger(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private activityEventMenuSubjectFromRow(row: InfoCardData): ActivityEventInfoCardMenuSubject {
    const dto = this.activityEventDTOForRow(row);
    const draft = this.eventCheckoutDraftStore.read(this.activeUserId(), row.id);
    return {
      menu: 'activity-event-card',
      id: row.id,
      status: dto?.status ?? row.status ?? null,
      ownerUserId: dto?.creatorUserId ?? row.ownerUserId ?? row.ownerId ?? null,
      adminIds: [...(dto?.adminIds ?? [])],
      acceptedMemberUserIds: [...(dto?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto?.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(dto?.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(dto?.pendingRequestMemberUserIds ?? [])],
      eventScope: this.activitiesEventScope,
      checkoutState: draft?.checkoutState ?? null
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
    void this.openInvitationApprovalFlow(row);
  }

  private async openInvitationApprovalFlow(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    const relatedSource = this.activityDisplaySourceForRow(row);
    const loadingDialog = this.eventCheckoutDialogStore.open({
      mode: 'invitation',
      userId: activeUserId,
      record: this.buildInvitationCheckoutLoadingRecord(row, activeUserId, relatedSource),
      loading: true,
      title: 'Accept invitation?',
      confirmLabel: 'Accept',
      busyConfirmLabel: 'Accepting...',
      failureMessage: 'Unable to accept invitation.',
      onSubmit: (selection: ActivityContracts.EventCheckoutSelection) => this.confirmActivityInvitationApproval(row, selection)
    });
    const loadingDialogId = loadingDialog?.id ?? null;
    const invitationContext = await this.eventsService.loadInvitationContext(activeUserId, row.id);
    const record = invitationContext?.record ?? null;
    const currentMembers = invitationContext?.members ?? [];
    const requiresAdminApproval = this.resolveInvitationRequiresAdminApprovalFromMembers(
      currentMembers,
      record?.creatorUserId ?? relatedSource.creatorUserId
    );
    if (!this.eventCheckoutDialogStore.isCurrent(loadingDialogId)) {
      return;
    }
    const approvalContext: InvitationApprovalContext = {
      record,
      currentMembers,
      requiresAdminApproval
    };
    if (record && this.shouldUseCheckoutFlow(record)) {
      this.eventCheckoutDialogStore.update(loadingDialogId, {
        mode: 'invitation',
        userId: activeUserId,
        record,
        preloadedCheckoutBasket: invitationContext?.checkoutBasket ?? null,
        requiresApprovalBeforePayment: requiresAdminApproval,
        title: 'Accept invitation?',
        subtitle: record.timeframe,
        confirmLabel: 'Accept',
        busyConfirmLabel: 'Accepting...',
        failureMessage: 'Unable to accept invitation.',
        onSubmit: (selection: ActivityContracts.EventCheckoutSelection) => this.confirmActivityInvitationApproval(row, selection, approvalContext)
      });
      return;
    }
    this.eventCheckoutDialogStore.close();
    this.dialogStore.open({
      title: 'Accept invitation?',
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Accept',
      busyConfirmLabel: 'Accepting...',
      confirmTone: 'accent',
      failureMessage: 'Unable to accept invitation.',
      onConfirm: () => this.confirmActivityInvitationApproval(row, null, approvalContext)
    });
  }

  private buildInvitationCheckoutLoadingRecord(
    row: InfoCardData,
    activeUserId: string,
    source: ActivityEventRecordLike
  ): ActivityContracts.ActivityEventRecord {
    const title = `${source?.title ?? row.title ?? ''}`.trim() || 'Event';
    const timeframe = `${source?.timeframe ?? source?.when ?? this.activityRowTimeframe(row) ?? ''}`.trim();
    const startAtIso = `${source?.startAtIso ?? source?.startAt ?? this.activityRowStartAt(row) ?? ''}`.trim();
    const endAtIso = `${source?.endAtIso ?? source?.endAt ?? this.activityRowEndAt(row) ?? startAtIso}`.trim();
    const creatorName = `${source?.creatorName ?? row.description ?? title}`.trim() || title;
    const creatorInitials = `${source?.creatorInitials ?? source?.avatar ?? this.activityRowCreatorInitials(row)}`.trim()
      || AppUtils.initialsFromText(creatorName);
    const capacityTotal = this.chatCountValue(source?.capacityTotal ?? source?.capacityMax);
    const detail = new ActivityEventDetailDTO().apply({
      id: row.id,
      userId: activeUserId,
      type: 'invitations',
      status: this.activityStatusCode(row) as ActivityContracts.ActivityEventStatus,
      title,
      subtitle: `${source?.shortDescription ?? source?.subtitle ?? this.activityRowSubtitle(row)}`.trim(),
      timeframe,
      activity: this.chatCountValue(source?.activity ?? source?.unread ?? row.badgeCount),
      startAtIso,
      endAtIso,
      distanceKm: Number.isFinite(Number(source?.distanceKm))
        ? Math.max(0, Number(source.distanceKm))
        : this.activityRowDistanceKm(row),
      imageUrl: `${source?.imageUrl ?? row.imageUrl ?? ''}`.trim(),
      creatorUserId: `${source?.creatorUserId ?? row.ownerId ?? row.ownerUserId ?? ''}`.trim(),
      creatorName,
      creatorInitials,
      creatorGender: source?.creatorGender === 'woman' ? 'woman' : 'man',
      creatorCity: `${source?.creatorCity ?? ''}`.trim(),
      visibility: source?.visibility ?? this.activityRowVisibility(row),
      blindMode: source?.blindMode ?? 'Open Event',
      sourceLink: `${source?.sourceLink ?? ''}`.trim(),
      location: `${source?.location ?? ''}`.trim(),
      locationCoordinates: source?.locationCoordinates ?? null,
      capacityMin: source?.capacityMin ?? null,
      capacityMax: source?.capacityMax ?? capacityTotal,
      capacityTotal,
      autoInviter: source?.autoInviter === true,
      frequency: source?.frequency ?? 'One-time',
      ticketing: source?.ticketing === true,
      approvalRequired: source?.approvalRequired === true,
      pricing: source?.pricing ?? null,
      policiesEnabled: source?.policiesEnabled === true,
      policies: Array.isArray(source?.policies) ? source.policies.map((item: ContractTypes.EventPolicyDTO) => ({ ...item })) : [],
      slotsEnabled: source?.slotsEnabled === true,
      slotTemplates: Array.isArray(source?.slotTemplates) ? source.slotTemplates.map((item: ContractTypes.EventSlotTemplateDTO) => ({ ...item })) : [],
      parentEventId: source?.parentEventId ?? null,
      slotTemplateId: source?.slotTemplateId ?? null,
      generated: source?.generated === true,
      eventType: source?.eventType ?? 'main',
      nextSlot: source?.nextSlot ? { ...source.nextSlot } : null,
      upcomingSlots: Array.isArray(source?.upcomingSlots) ? source.upcomingSlots.map((item: ContractTypes.EventSlotOccurrenceDTO) => ({ ...item })) : [],
      acceptedMembers: this.chatCountValue(source?.acceptedMembers),
      pendingMembers: this.chatCountValue(source?.pendingMembers),
      acceptedMemberUserIds: [...(source?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(source?.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(source?.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(source?.pendingRequestMemberUserIds ?? [])],
      pendingReason: source?.pendingReason,
      topics: [...(source?.topics ?? [])],
      subEventsEnabled: source?.subEventsEnabled ?? true,
      subEventDefinitions: [...(source?.subEventDefinitions ?? [])],
      subEvents: Array.isArray(source?.subEvents)
        ? this.cloneSyncedSubEventForms(source.subEvents)
        : [],
      mode: source?.mode ?? 'Casual',
      rating: this.chatCountValue(source?.rating),
      boost: this.chatCountValue(source?.boost),
      affinity: this.chatCountValue(source?.affinity)
    });

    return {
      ...detail,
      userId: activeUserId,
      type: 'invitations',
      avatar: `${source?.avatar ?? creatorInitials}`.trim(),
      inviter: source?.inviter ?? null,
      unread: this.chatCountValue(source?.unread ?? source?.activity ?? row.badgeCount),
      trashedAtIso: null,
      creatorGender: source?.creatorGender === 'woman' ? 'woman' : 'man',
      adminIds: [...(source?.adminIds ?? [])]
    } as ActivityContracts.ActivityEventRecord;
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
    const isRejectInvitation = action?.id === 'rejectInvitation' || this.isActivityInvitationRow(row);
    this.dialogStore.open({
      title: this.activitySecondaryConfirmTitle(row, isRejectInvitation),
      message: row.title,
      cancelLabel: 'Cancel',
      confirmLabel: this.activitySecondaryConfirmActionLabel(row, isRejectInvitation),
      busyConfirmLabel: this.activitySecondaryConfirmBusyLabel(row, isRejectInvitation),
      confirmTone: 'danger',
      confirmPalette: this.confirmationPaletteForCardAction(action),
      failureMessage: this.activitySecondaryConfirmFailureMessage(row, isRejectInvitation),
      onConfirm: () => this.confirmActivitySecondaryAction(row, isRejectInvitation)
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
    this.applyActivityEventCounterDeltas({}, { pending: -1 });
    if (this.activitiesEventScope === 'pending') {
      this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    } else {
      this.activitiesSmartList?.patchVisibleItem(
        (item: InfoCardData) => item.id === row.id,
        { status: nextStatus }
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
    const activeUserId = this.activeUserId();
    const counterDelta = this.publishedEventCounterDelta(row);
    const persistence = this.eventsService.publishItem(this.activeUser.id, row.id, {
      counterDelta
    });
    await persistence;
    this.activeHostingIds = new Set([...this.activeHostingIds, row.id]);

    if (this.shouldRemovePublishedRowFromCurrentScope()) {
      this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    } else {
      this.patchVisiblePublicationState(row, 'A');
    }

    this.signalActivityCounterDelta(activeUserId, counterDelta);
    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private async confirmActivityUnpublish(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUserId();
    const counterDelta = this.unpublishedEventCounterDelta(row);
    const persistence = this.eventsService.unpublishItem(this.activeUser.id, row.id, {
      counterDelta
    });
    await persistence;
    const nextActiveIds = new Set(this.activeHostingIds);
    nextActiveIds.delete(row.id);
    this.activeHostingIds = nextActiveIds;
    this.patchVisiblePublicationState(row, 'DR');
    this.signalActivityCounterDelta(activeUserId, counterDelta);
    this.refreshSectionBadges();
    this.cdr.markForCheck();
  }

  private patchVisiblePublicationState(row: InfoCardData, status: ActivityContracts.ActivityEventStatus): void {
    const identity = this.activityRowIdentity(row);
    this.activitiesSmartList?.patchVisibleItem(
      (item: InfoCardData) => this.activityRowIdentity(item) === identity,
      (item: InfoCardData) => ({
        ...item,
        status,
        surfaceTone: status === 'DR' ? 'draft' : 'published',
        mediaEnd: item.mediaEnd
          ? {
            ...item.mediaEnd,
            tone: status === 'DR' ? 'inactive' : item.mediaEnd.tone
          }
          : item.mediaEnd
      })
    );
  }

  private shouldRemovePublishedRowFromCurrentScope(): boolean {
    return this.activitiesEventScope === 'drafts'
      || (this.activitiesEventScope === 'my-events' && this.hostingPublicationFilter === 'drafts');
  }

  private activitySecondaryConfirmTitle(row: InfoCardData, isRejectInvitation = false): string {
    if (isRejectInvitation) {
      return 'Reject invitation?';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leave event?';
    }
    return 'Delete event?';
  }

  private activitySecondaryConfirmActionLabel(row: InfoCardData, isRejectInvitation = false): string {
    if (isRejectInvitation) {
      return 'Reject Invitation';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leave';
    }
    return 'Delete';
  }

  private activitySecondaryConfirmBusyLabel(row: InfoCardData, isRejectInvitation = false): string {
    if (isRejectInvitation) {
      return 'Rejecting...';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Leaving...';
    }
    return 'Deleting...';
  }

  private activitySecondaryConfirmFailureMessage(row: InfoCardData, isRejectInvitation = false): string {
    if (isRejectInvitation) {
      return 'Unable to reject invitation.';
    }
    if (!this.isActivityRowAdmin(row)) {
      return 'Unable to leave event.';
    }
    return 'Unable to delete event.';
  }

  private acceptedInvitationCounterDelta(
    _row: InfoCardData,
    detail: Pick<ActivityEventDetailDTO, 'pendingRequestMemberUserIds' | 'acceptedMemberUserIds'>
  ): UserMenuCounterDeltasDto | null {
    const activeUserId = this.activeUserId();
    const movedToPending = activeUserId.length > 0
      && (detail.pendingRequestMemberUserIds ?? []).includes(activeUserId)
      && !(detail.acceptedMemberUserIds ?? []).includes(activeUserId);
    return this.acceptedInvitationCounterDeltaForMembership(movedToPending);
  }

  private acceptedInvitationCounterDeltaFromResult(
    result: ActivityContracts.EventParticipationActionResultDTO
  ): UserMenuCounterDeltasDto | null {
    const membershipStatus = `${result.membershipStatus ?? ''}`.trim();
    return this.acceptedInvitationCounterDeltaForMembership(membershipStatus !== 'accepted');
  }

  private acceptedInvitationCounterDeltaForMembership(
    movedToPending: boolean
  ): UserMenuCounterDeltasDto | null {
    return this.activityCounterDeltaFromDeltas(
      movedToPending
        ? { invitations: -1 }
        : { invitations: -1, events: 1 },
      movedToPending
        ? { invitations: -1, pending: 1 }
        : { invitations: -1, active: 1 }
    );
  }

  private trashedEventCounterDelta(
    row: InfoCardData,
    forcedType: ActivityContracts.ActivityEventRepositoryItemType | null = null
  ): UserMenuCounterDeltasDto | null {
    const primaryDelta: Record<string, number> = {};
    const eventDelta: Record<string, number> = { all: -1, trash: 1 };
    const type = forcedType ?? this.activityEventListTypeForRow(row);
    if (type === 'invitations') {
      primaryDelta['invitations'] = -1;
      eventDelta['invitations'] = -1;
    } else if (type === 'hosting') {
      primaryDelta['hosting'] = -1;
      eventDelta['hosting'] = -1;
      if (this.isActivityDraftRow(row)) {
        eventDelta['drafts'] = -1;
      }
    } else if (this.isActivityPendingParticipationRow(row)) {
      eventDelta['pending'] = -1;
    } else {
      primaryDelta['events'] = -1;
      eventDelta['active'] = -1;
    }
    return this.activityCounterDeltaFromDeltas(primaryDelta, eventDelta);
  }

  private leftEventCounterDelta(row: InfoCardData): UserMenuCounterDeltasDto | null {
    if (this.isActivityPendingParticipationRow(row)) {
      return this.activityCounterDeltaFromDeltas(
        {},
        { all: -1, pending: -1, trash: 1 }
      );
    }
    return this.activityCounterDeltaFromDeltas(
      { events: -1 },
      { active: -1, all: -1, trash: 1 }
    );
  }

  private restoredEventCounterDelta(row: InfoCardData): UserMenuCounterDeltasDto | null {
    const primaryDelta: Record<string, number> = {};
    const eventDelta: Record<string, number> = { all: 1, trash: -1 };
    const type = this.activityEventListTypeForRow(row);
    if (type === 'invitations') {
      primaryDelta['invitations'] = 1;
      eventDelta['invitations'] = 1;
    } else if (type === 'hosting') {
      primaryDelta['hosting'] = 1;
      eventDelta['hosting'] = 1;
      if (this.activityRestoredStatusCode(row) === 'DR' || this.activitiesEventScope === 'drafts') {
        eventDelta['drafts'] = 1;
      }
    } else if (this.isActivityPendingParticipationRow(row)) {
      eventDelta['pending'] = 1;
    } else {
      primaryDelta['events'] = 1;
      eventDelta['active'] = 1;
    }
    return this.activityCounterDeltaFromDeltas(primaryDelta, eventDelta);
  }

  private publishedEventCounterDelta(row: InfoCardData): UserMenuCounterDeltasDto | null {
    if (!this.isActivityDraftRow(row)) {
      return null;
    }
    return this.activityCounterDeltaFromDeltas(
      {},
      { drafts: -1 }
    );
  }

  private unpublishedEventCounterDelta(row: InfoCardData): UserMenuCounterDeltasDto | null {
    if (this.activityStatusCode(row) === 'DR') {
      return null;
    }
    return this.activityCounterDeltaFromDeltas(
      {},
      { drafts: 1 }
    );
  }

  private isActivityPendingParticipationRow(row: InfoCardData): boolean {
    const activeUserId = this.activeUserId();
    const dto = this.activityEventDTOForRow(row);
    if (!activeUserId || !dto) {
      return false;
    }
    if ((dto.acceptedMemberUserIds ?? []).includes(activeUserId)) {
      return false;
    }
    return (dto.pendingRequestMemberUserIds ?? []).includes(activeUserId)
      || (dto.pendingMemberUserIds ?? []).includes(activeUserId);
  }

  private activityRestoredStatusCode(row: InfoCardData): string {
    const dto = this.activityEventDTOForRow(row);
    const status = this.normalizeActivityStatusCode(dto?.status ?? row.status);
    if (status !== 'T') {
      return status;
    }
    const previous = this.normalizeActivityStatusCode(dto?.statusBeforeSuppression);
    return ['UR', 'B', 'D', 'I', 'T'].includes(previous) ? 'A' : previous;
  }

  private async confirmActivitySecondaryAction(row: InfoCardData, isRejectInvitation = false): Promise<void> {
    if (!isRejectInvitation && !this.isActivityRowAdmin(row) && !this.isActivityInvitationRow(row)) {
      await this.confirmActivityLeave(row);
      return;
    }
    const activeUserId = this.activeUserId();
    const counterDelta = this.trashedEventCounterDelta(row, isRejectInvitation ? 'invitations' : null);
    await this.persistActivityRowTrash(row, counterDelta);
    this.activitiesStore.emitActivityEventRemoval(row.id);
    this.signalActivityCounterDelta(activeUserId, counterDelta);
    this.cdr.markForCheck();
  }

  private async confirmActivityLeave(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return;
    }
    const counterDelta = this.leftEventCounterDelta(row);
    const leaveResult = await this.eventsService.leaveEvent(activeUserId, row.id, {
      removeMembershipOnly: true,
      checkoutState: 'cancelled',
      checkoutResultState: 'deleted',
      counterDelta
    });
    if (!leaveResult || leaveResult.membershipStatus === 'unchanged') {
      throw new Error('Unable to leave event.');
    }
    this.activitiesStore.emitActivityEventRemoval(row.id);
    this.signalActivityCounterDelta(activeUserId, counterDelta);

    if (this.selectedActivityMembersRowId === this.activityRowIdentity(row)) {
      this.selectedActivityMembers = this.selectedActivityMembers
        .filter(member => member.userId !== activeUserId);
      this.activityMembersByRowId[this.selectedActivityMembersRowId] = [...this.selectedActivityMembers];
    }

    this.emitActivityLeaveMembersSync(row, leaveResult);
    this.eventCheckoutDraftStore.clear(activeUserId, row.id);
    this.cdr.markForCheck();
  }

  private emitActivityLeaveMembersSync(
    row: InfoCardData,
    result: ActivityContracts.EventParticipationActionResultDTO | null
  ): void {
    const sourceId = `${result?.sourceId ?? row.id ?? ''}`.trim();
    if (!sourceId || !result) {
      return;
    }
    const acceptedMembers = Math.max(0, Math.trunc(Number(result.acceptedMembers) || 0));
    const pendingMembers = Math.max(0, Math.trunc(Number(result.pendingMembers) || 0));
    this.activityStore.emitActivityMembersSync({
      id: sourceId,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(acceptedMembers, Math.trunc(Number(result.capacityTotal) || 0)),
      viewerMembershipRemoved: true
    });
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
    selection?: ActivityContracts.EventCheckoutSelection | null,
    context?: InvitationApprovalContext | null
  ): Promise<void> {
    const activeUserId = this.activeUserId();
    const { eventDetailDTO } = await this.buildAcceptedInvitationSaveResult(row, selection, context);
    const pendingReason = this.acceptedInvitationPendingReason(activeUserId, eventDetailDTO, selection);
    const counterDelta = this.acceptedInvitationCounterDeltaForMembership(pendingReason !== null)
      ?? this.acceptedInvitationCounterDelta(row, eventDetailDTO);
    const joinResult = await this.eventsService.requestJoin(activeUserId, eventDetailDTO.id, {
      slotSourceId: selection?.slotSourceId ?? null,
      optionalSubEventIds: selection?.optionalSubEventIds ?? [],
      assetSelections: selection?.assetSelections ?? [],
      acceptedPolicyIds: selection?.acceptedPolicyIds ?? [],
      appliedPromoCodes: selection?.appliedPromoCodes ?? [],
      paymentSessionId: selection?.paymentSessionId ?? null,
      bookingConfirmed: pendingReason == null && selection?.bookingConfirmed !== false,
      pendingReason,
      checkoutState: selection?.checkoutState,
      basketItems: selection?.basketItems?.length ? selection.basketItems : undefined,
      pricingSummaryRows: selection?.basketItems?.length ? (selection.pricingSummaryRows ?? []) : undefined,
      lineItems: selection?.basketItems?.length ? selection.lineItems : undefined,
      totalAmount: selection?.basketItems?.length ? selection.totalAmount : undefined,
      currency: selection?.basketItems?.length ? selection.currency : undefined,
      skipLocalRouteDelay: Boolean(selection?.paymentSessionId),
      counterDelta
    });
    if (!joinResult || joinResult.membershipStatus === 'unchanged') {
      throw new Error('Unable to accept invitation.');
    }
    this.emitAcceptedCheckoutActivityEventSync(row, activeUserId, joinResult);
    const resolvedDelta = this.acceptedInvitationCounterDeltaFromResult(joinResult) ?? counterDelta;
    this.removeInvitationItem(eventDetailDTO.id);
    this.activitiesSmartList?.removeVisibleItemByIdentity(this.activityRowIdentity(row));
    this.signalActivityCounterDelta(activeUserId, resolvedDelta);
    this.cdr.markForCheck();
  }

  private acceptedInvitationPendingReason(
    activeUserId: string,
    detail: Pick<ActivityEventDetailDTO, 'pendingRequestMemberUserIds' | 'acceptedMemberUserIds'>,
    selection?: ActivityContracts.EventCheckoutSelection | null
  ): AppConstants.ActivityPendingReason {
    if (selection?.pendingReason === 'waitlist') {
      return 'waitlist';
    }
    if (selection?.pendingReason === 'approval') {
      return 'approval';
    }
    const movedToPending = activeUserId.length > 0
      && (detail.pendingRequestMemberUserIds ?? []).includes(activeUserId)
      && !(detail.acceptedMemberUserIds ?? []).includes(activeUserId);
    return movedToPending ? 'approval' : null;
  }

  private async buildAcceptedInvitationSaveResult(
    row: InfoCardData,
    selection?: ActivityContracts.EventCheckoutSelection | null,
    context?: InvitationApprovalContext | null
  ): Promise<InvitationApprovalSaveResult> {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      throw new Error('Unable to resolve active user.');
    }

    const relatedSource = this.activityDisplaySourceForRow(row);
    const invitationContext = context
      ? null
      : await this.eventsService.loadInvitationContext(activeUserId, row.id);
    const record = context?.record ?? invitationContext?.record ?? null;
    const currentMembers = context?.currentMembers ?? invitationContext?.members ?? [];
    const activeInviteEntry = currentMembers.find((member: ActivityContracts.ActivityMemberDTO) =>
      member.userId === activeUserId
      && member.status === 'pending'
      && member.requestKind === 'invite'
    ) ?? null;
    const requiresAdminApproval = context?.requiresAdminApproval
      ?? this.invitationRequiresAdminApproval(
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
    const existingInvitedMemberUserIds = this.uniqueUserIds([
      ...(record?.invitedMemberUserIds ?? []),
      ...(relatedSource.invitedMemberUserIds ?? [])
    ]);
    const existingPendingRequestMemberUserIds = this.uniqueUserIds([
      ...(record?.pendingRequestMemberUserIds ?? []),
      ...(relatedSource.pendingRequestMemberUserIds ?? []),
      ...existingPendingMemberUserIds
    ]);
    const nextInvitedMemberUserIds = existingInvitedMemberUserIds
      .filter(userId => userId !== activeUserId);
    const nextPendingRequestMemberUserIds = requiresAdminApproval
      ? this.uniqueUserIds([
          ...existingPendingRequestMemberUserIds.filter(userId => userId !== activeUserId),
          activeUserId
        ])
      : existingPendingRequestMemberUserIds.filter(userId => userId !== activeUserId);

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
        approvalRequired: record?.approvalRequired ?? relatedSource.approvalRequired,
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
        status: 'A',
        statusBeforeSuppression: null,
        trashedAtIso: null,
        creatorUserId: record?.creatorUserId ?? relatedSource.creatorUserId,
        creatorName,
        creatorInitials,
        creatorGender: record?.creatorGender,
        creatorCity: record?.creatorCity,
        location: record?.location ?? relatedSource.location,
        locationCoordinates: record?.locationCoordinates ?? relatedSource.locationCoordinates,
        sourceLink: record?.sourceLink ?? relatedSource.sourceLink,
        topics: [...(record?.topics ?? relatedSource.topics ?? [])],
        acceptedMemberUserIds: nextAcceptedMemberUserIds,
        pendingMemberUserIds: nextPendingMemberUserIds,
        invitedMemberUserIds: nextInvitedMemberUserIds,
        pendingRequestMemberUserIds: nextPendingRequestMemberUserIds,
        pendingReason: requiresAdminApproval ? 'approval' : undefined,
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

  private resolveInvitationRequiresAdminApprovalFromMembers(
    currentMembers: readonly ActivityContracts.ActivityMemberDTO[],
    creatorUserId?: string | null
  ): boolean {
    const activeUserId = this.activeUser.id.trim();
    if (!activeUserId) {
      return false;
    }
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
    return inviterEntry?.role !== 'Admin';
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
      ? nextMembers
      : null;
  }

  private removeInvitationItem(sourceId: string): void {
    delete this.activityMembersByRowId[`invitations:${sourceId}`];
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

  private async persistActivityRowTrash(row: InfoCardData, counterDelta: UserMenuCounterDeltasDto | null): Promise<void> {
    await this.eventsService.trashItem(this.activeUser.id, row.id, {
      counterDelta
    });
  }

  private async restoreActivityRow(row: InfoCardData): Promise<void> {
    const activeUserId = this.activeUserId();
    const counterDelta = this.restoredEventCounterDelta(row);
    await this.eventsService.restoreItem(this.activeUser.id, row.id, {
      counterDelta
    });
    this.activitiesStore.emitActivityEventRemoval(row.id);
    this.signalActivityCounterDelta(activeUserId, counterDelta);
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
    this.selectedActivityMembers = this.selectedActivityMembers.map(item =>
      item.id === entry.id
        ? {
            ...item,
            status: 'accepted',
            pendingSource: null,
            requestKind: null,
            actionAtIso: nowIso
          }
        : item
    );
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
