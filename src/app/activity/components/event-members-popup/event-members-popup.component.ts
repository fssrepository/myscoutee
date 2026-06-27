import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  TemplateRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import type * as AppUiTypes from '../../../shared/ui/models';
import { AppUtils } from '../../../shared/app-utils';
import type { ActivityMembersSyncState } from '../../../shared/ui';
import { AppContext, AppPopupContext } from '../../../shared/ui';
import { ActivityMembersService, ChatsService, EventsService, UsersService } from '../../../shared/core';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import {
  CounterBadgePipe,
  ImageCardComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type ImageCardData,
  type ImageCardMediaAction,
  type ImageCardMediaActionEvent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { ConfirmationDialogStore } from '../../../shared/ui/context/stores/confirmation-dialog.store';
import { NavigatorStore } from '../../../shared/ui/context/stores/navigator.store';
import type { ActivityMemberOwnerType } from '../../../shared/core/common/constants';
import type { ActivityMemberOwnerRef } from '../../../shared/core/contracts/activity.interface';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

interface MembersSmartListFilters {
  ownerId?: string;
  pendingOnly?: boolean;
}

type MemberMenuAction = 'approve' | 'remove' | 'disqualify' | 'reinstate' | 'report';

type MemberMenuContext = {
  menu: 'member-action';
  member: ActivityContracts.ActivityMemberEntry;
  action: MemberMenuAction;
};

type MembersSummaryState = {
  acceptedCount: number;
  pendingCount: number;
  capacityTotal: number;
};

@Component({
  selector: 'app-event-members-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    SmartListComponent,
    ImageCardComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-members-popup.component.html',
  styleUrls: ['./event-members-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventMembersPopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly confirmationDialogStore = inject(ConfirmationDialogStore);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly chatsService = inject(ChatsService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly usersService = inject(UsersService);
  private readonly navigatorStore = inject(NavigatorStore);
  private readonly membersCacheByOwnerId = new Map<string, ActivityContracts.ActivityMemberEntry[]>();
  private lastAppliedActivityMembersUpdatedMs = 0;
  private openMembersHydrationTimer: ReturnType<typeof setTimeout> | null = null;

  protected isOpen = false;
  protected isMobileView = false;
  protected ownerId = '';
  protected title = 'Members';
  protected subtitle = 'Event';
  protected summaryLabel = '0 members';
  protected isSummaryVisible = false;
  protected pendingOnly = false;
  protected pendingCount = 0;
  protected acceptedCount = 0;
  protected capacityTotal = 0;
  protected canShowInviteButton = false;
  private lookupRef: AppUiTypes.PopupHeaderLookup | null = null;

  private ownerRecord: ActivityEventRecord | null = null;
  private ownerRef: ActivityMemberOwnerRef | null = null;
  private canManageMembers = false;
  private selectedMembersVisible: ReadonlyArray<ActivityContracts.ActivityMemberEntry> = [];
  private membersListReady = false;
  private pendingSummaryState: MembersSummaryState = {
    acceptedCount: 0,
    pendingCount: 0,
    capacityTotal: 0
  };
  private isLocalMembersSource = false;
  private membersChangeHandler: ((members: readonly ActivityContracts.ActivityMemberEntry[]) => void) | null = null;
  private suppressedOwnerSyncId: string | null = null;
  private requestedCanManageMembers = false;
  private viewOnlyMode = false;

  protected membersSmartListQuery: Partial<ListQuery<MembersSmartListFilters>> = {};

  @ViewChild('membersSmartList')
  private membersSmartList?: SmartListComponent<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters>;

  protected membersItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters>>;

  @ViewChild('memberItemTemplate', { read: TemplateRef })
  private set membersItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters>> | undefined
  ) {
    this.membersItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly membersSmartListConfig: SmartListConfig<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters> = {
    pageSize: 16,
    defaultView: 'list',
    headerProgress: {
      enabled: true,
      state: () => this.appCtx.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No members yet.',
    emptyDescription: 'Check back later or invite people in.',
    listLayout: 'card-grid',
    desktopColumns: 4,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'activity-members-list-shell': true
    },
    trackBy: (_index, member) => member.id
  };

  protected readonly membersSmartListLoaders: SmartListLoaders<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters> = {
    list: query => from(this.loadMembersPage(query))
  };

  constructor() {
    this.syncMobileViewFromViewport();

    effect(() => {
      const request = this.popupCtx.popupStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      this.popupCtx.popupStore.clearActivitiesNavigationRequest();
      if (request.type === 'members') {
        this.openMembersPopup(request.ownerId, {
          ownerType: request.ownerType ?? 'event',
          subtitle: request.subtitle,
          canManage: request.canManage,
          viewOnly: request.viewOnly,
          acceptedMembers: request.acceptedMembers,
          pendingMembers: request.pendingMembers,
          capacityTotal: request.capacityTotal,
          initialMembers: request.members,
          lookup: request.lookup,
          onMembersChanged: request.onMembersChanged
        });
        return;
      }
      this.openMembersPopup(request.ownerId, {
        subtitle: request.title,
        canManage: request.canManage === true,
        ownerType: 'event'
      });
    });

    effect(() => {
      const sync = this.appCtx.activityStore.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSync(sync);
    });
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncMobileViewFromViewport();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || keyboardEvent.defaultPrevented || this.isSuspendedForAssetInvite()) {
      return;
    }
    if (this.confirmationDialogStore.dialog()) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.membersSmartList?.menuOpen() ?? false) {
      this.membersSmartList?.closeMenu();
      this.cdr.markForCheck();
      return;
    }
    this.closeMembersPopup();
  }

  protected onMembersSmartListStateChange(
    change: SmartListStateChange<ActivityContracts.ActivityMemberEntry, MembersSmartListFilters>
  ): void {
    this.selectedMembersVisible = [...change.items];
    if (!change.initialLoading) {
      this.membersListReady = true;
      this.flushPendingSummary();
    }
    this.cdr.markForCheck();
  }

  protected togglePendingOnly(event: Event): void {
    event.stopPropagation();
    if (!this.ownerId) {
      return;
    }
    this.pendingOnly = !this.pendingOnly;
    this.membersSmartList?.closeMenu();
    this.syncMembersSmartListQuery();
    this.cdr.markForCheck();
  }

  protected closeMembersPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.openMembersHydrationTimer) {
      clearTimeout(this.openMembersHydrationTimer);
      this.openMembersHydrationTimer = null;
    }
    if (this.ownerId) {
      this.membersCacheByOwnerId.delete(this.ownerId);
    }
    this.isOpen = false;
    this.ownerId = '';
    this.ownerRef = null;
    this.lookupRef = null;
    this.ownerRecord = null;
    this.membersSmartList?.closeMenu();
    this.pendingOnly = false;
    this.canManageMembers = false;
    this.canShowInviteButton = false;
    this.isLocalMembersSource = false;
    this.membersChangeHandler = null;
    this.suppressedOwnerSyncId = null;
    this.requestedCanManageMembers = false;
    this.viewOnlyMode = false;
    this.subtitle = 'Event';
    this.resetSummaryState();
    this.selectedMembersVisible = [];
    this.membersSmartListQuery = {};
    this.cdr.markForCheck();
  }

  protected handleInvite(event: Event): void {
    event.stopPropagation();
    if (!this.canShowInviteButton || !this.ownerId) {
      return;
    }
    this.popupCtx.popupStore.openActivityInvitePopup({
      ownerId: this.ownerId,
      ownerType: this.ownerRef?.ownerType ?? 'event',
      title: this.subtitle,
      onApply: selectedCandidates => this.applyInvites(selectedCandidates),
      closeOwnerPopupOnClose: false
    });
  }

  protected isSuspendedForAssetInvite(): boolean {
    const invitePopup = this.popupCtx.popupStore.activityInvitePopup();
    return !!invitePopup && invitePopup.ownerId === this.ownerId;
  }

  protected canShowActionMenu(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return this.canApproveMember(entry)
      || this.canDeleteMember(entry)
      || this.canDisqualifyMember(entry)
      || this.canReinstateMember(entry)
      || this.canReportMember(entry);
  }

  protected isActionMenuOpen(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return this.membersSmartList?.isMenuOpen(this.memberActionMenuId(entry)) ?? false;
  }

  protected memberActionMenuId(entry: ActivityContracts.ActivityMemberEntry): string {
    return `activity-member:${entry.id}`;
  }

  protected memberActionMenuTrigger(entry: ActivityContracts.ActivityMemberEntry): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: this.memberActionMenuPalette(entry),
      ariaLabel: `Open actions for ${entry.name}`
    };
  }

  protected memberActionMenuPalette(entry: ActivityContracts.ActivityMemberEntry): AppMenuPalette {
    if (entry.status === 'disqualified') {
      return 'danger';
    }
    if (this.canApproveMember(entry)) {
      return 'warning';
    }
    if (this.canReinstateMember(entry)) {
      return 'success';
    }
    return 'blue';
  }

  protected memberActionMenuItems(entry: ActivityContracts.ActivityMemberEntry): readonly AppMenuItem<string, MemberMenuContext>[] {
    const items: AppMenuItem<string, MemberMenuContext>[] = [];
    if (this.canApproveMember(entry)) {
      items.push({
        id: `member-action-approve-${entry.id}`,
        label: 'Approve',
        icon: 'check_circle',
        palette: 'success',
        context: { menu: 'member-action', member: entry, action: 'approve' }
      });
    }
    if (this.canDeleteMember(entry)) {
      items.push({
        id: `member-action-remove-${entry.id}`,
        label: this.deleteLabel(entry),
        icon: 'delete',
        palette: 'danger',
        context: { menu: 'member-action', member: entry, action: 'remove' }
      });
    }
    if (this.canDisqualifyMember(entry)) {
      items.push({
        id: `member-action-disqualify-${entry.id}`,
        label: 'Disqualify',
        icon: 'gavel',
        palette: 'danger',
        context: { menu: 'member-action', member: entry, action: 'disqualify' }
      });
    }
    if (this.canReinstateMember(entry)) {
      items.push({
        id: `member-action-reinstate-${entry.id}`,
        label: 'Reinstate',
        icon: 'undo',
        palette: 'success',
        context: { menu: 'member-action', member: entry, action: 'reinstate' }
      });
    }
    if (this.canReportMember(entry)) {
      items.push({
        id: `member-action-report-${entry.id}`,
        label: 'Report user',
        icon: 'flag',
        palette: 'default',
        context: { menu: 'member-action', member: entry, action: 'report' }
      });
    }
    return items;
  }

  protected onMemberActionMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as MemberMenuContext | undefined;
    if (context?.menu !== 'member-action') {
      return;
    }
    switch (context.action) {
      case 'approve':
        this.approveMember(context.member, event.sourceEvent);
        break;
      case 'remove':
        this.requestRemoveMember(context.member, event.sourceEvent);
        break;
      case 'disqualify':
        this.requestDisqualifyMember(context.member, event.sourceEvent);
        break;
      case 'reinstate':
        this.requestReinstateMember(context.member, event.sourceEvent);
        break;
      case 'report':
        this.reportMember(context.member, event.sourceEvent);
        break;
    }
  }

  protected approveMember(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canApproveMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.confirmationDialogStore.open({
      title: 'Approve request?',
      message: `Approve ${entry.name} for this ${this.ownerScopeLabel()}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Approve',
      busyConfirmLabel: 'Approving...',
      confirmTone: 'accent',
      failureMessage: 'Unable to approve request.',
      onConfirm: () => this.confirmApproveMember(entry)
    });
  }

  protected requestRemoveMember(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canDeleteMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.confirmationDialogStore.open({
      title: this.memberRemovalTitle(entry),
      message: this.memberRemovalMessage(entry),
      cancelLabel: 'Cancel',
      confirmLabel: this.memberRemovalConfirmLabel(entry),
      busyConfirmLabel: this.memberRemovalBusyLabel(entry),
      confirmTone: 'danger',
      failureMessage: this.memberRemovalFailureMessage(entry),
      onConfirm: () => this.confirmRemoveMember(entry)
    });
  }

  protected requestDisqualifyMember(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canDisqualifyMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.confirmationDialogStore.open({
      title: 'Disqualify member?',
      message: `Disqualify ${entry.name} from this ${this.ownerScopeLabel()}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Disqualify',
      busyConfirmLabel: 'Disqualifying...',
      confirmTone: 'danger',
      failureMessage: 'Unable to disqualify member.',
      onConfirm: () => this.confirmMemberAction(entry, 'disqualify')
    });
  }

  protected requestReinstateMember(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canReinstateMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.confirmationDialogStore.open({
      title: 'Reinstate member?',
      message: `Reinstate ${entry.name} to this ${this.ownerScopeLabel()}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Reinstate',
      busyConfirmLabel: 'Reinstating...',
      confirmTone: 'accent',
      failureMessage: 'Unable to reinstate member.',
      onConfirm: () => this.confirmMemberAction(entry, 'reinstate')
    });
  }

  protected reportMember(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canReportMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.navigatorStore.openReportUserPopup({
      targetUserId: entry.userId,
      targetName: entry.name,
      memberEntryId: entry.id,
      eventId: this.ownerId,
      eventTitle: this.ownerRecord?.title?.trim() || this.subtitle.trim() || 'Event',
      eventStartAtIso: this.ownerRecord?.startAtIso ?? null,
      eventTimeframe: this.ownerRecord?.timeframe ?? null,
      ownerType: this.ownerRef?.ownerType ?? 'event'
    });
    this.cdr.markForCheck();
  }

  protected canViewMemberProfile(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return Boolean(`${entry.userId ?? ''}`.trim());
  }

  protected memberImageCard(entry: ActivityContracts.ActivityMemberEntry): ImageCardData {
    const age = this.age(entry);
    const pendingDetail = entry.status === 'pending' || entry.status === 'disqualified'
      ? this.pendingStatusLabel(entry)
      : null;
    return {
      id: entry.id,
      title: age > 0 ? `${entry.name}, ${age}` : entry.name,
      subtitle: `${this.roleLabel(entry)} · ${entry.city}`,
      detail: pendingDetail,
      imageUrl: entry.avatarUrl,
      placeholderIcon: 'highlight_off',
      placeholderLabel: entry.initials,
      layout: 'overlay',
      toneClass: [
        'subevent-member-image-card',
        'activity-member-image-card',
        this.memberCardToneClass(entry),
        this.isActionMenuOpen(entry) ? 'menu-open' : ''
      ].filter(Boolean).join(' '),
      statusChip: {
        icon: this.memberCardStatusIcon(entry),
        title: this.memberCardStatusLabel(entry),
        ariaLabel: this.memberCardStatusLabel(entry),
        palette: this.memberCardStatusPalette(entry),
        className: this.memberCardStatusClass(entry)
      }
    };
  }

  protected memberImageCardMediaActions(entry: ActivityContracts.ActivityMemberEntry): readonly ImageCardMediaAction[] {
    if (!this.canViewMemberProfile(entry)) {
      return [];
    }
    return [{
      id: 'view-profile',
      icon: 'visibility',
      ariaLabel: 'View profile',
      position: 'bottom-right',
      tone: 'info'
    }];
  }

  protected memberImageCardSharedMenuItems(entry: ActivityContracts.ActivityMemberEntry): readonly AppMenuItem<string, unknown>[] {
    return this.canShowActionMenu(entry) ? this.memberActionMenuItems(entry) : [];
  }

  protected onMemberImageCardMediaAction(
    entry: ActivityContracts.ActivityMemberEntry,
    event: ImageCardMediaActionEvent
  ): void {
    if (event.action.id === 'view-profile') {
      this.viewMemberProfile(entry, event.sourceEvent);
    }
  }

  protected viewMemberProfile(entry: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    const userId = `${entry.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.navigatorStore.openProfileView({
      userId,
      label: entry.name
    });
    this.cdr.markForCheck();
  }

  private async confirmApproveMember(entry: ActivityContracts.ActivityMemberEntry): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const nextMembers = previousMembers.map(member =>
      member.id === entry.id
        ? {
            ...member,
            status: 'accepted' as const,
            pendingSource: null,
            requestKind: null,
            actionAtIso: AppUtils.toIsoDateTime(new Date())
          }
        : member
    );
    const approvePromise = this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
    await approvePromise;
  }

  private async confirmRemoveMember(entry: ActivityContracts.ActivityMemberEntry): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const nextMembers = previousMembers.filter(member => member.id !== entry.id);
    const deletePromise = this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
    await deletePromise;
  }

  private async confirmMemberAction(
    entry: ActivityContracts.ActivityMemberEntry,
    action: 'disqualify' | 'reinstate'
  ): Promise<void> {
    const owner = this.ownerRef && this.ownerRef.ownerId === this.ownerId ? this.ownerRef : null;
    if (!owner) {
      return;
    }
    const previousMembers = this.currentOwnerMembers();
    const actionPromise = this.runMemberActionAfterUiYield(owner, entry.userId, action, previousMembers);
    await actionPromise;
  }

  private memberRemovalTitle(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Reject request?';
    }
    if (entry.status === 'accepted') {
      return 'Remove member?';
    }
    return 'Delete invitation?';
  }

  private memberRemovalMessage(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return `Reject ${entry.name}'s request to join this ${this.ownerScopeLabel()}?`;
    }
    if (entry.status === 'accepted') {
      return `Remove ${entry.name} from this ${this.ownerScopeLabel()}?`;
    }
    return `Delete ${entry.name}'s invitation to this ${this.ownerScopeLabel()}?`;
  }

  private memberRemovalConfirmLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Reject';
    }
    return entry.status === 'accepted' ? 'Remove' : 'Delete';
  }

  private memberRemovalBusyLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Rejecting...';
    }
    return entry.status === 'accepted' ? 'Removing...' : 'Deleting...';
  }

  private memberRemovalFailureMessage(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Unable to reject request.';
    }
    if (entry.status === 'accepted') {
      return 'Unable to remove member.';
    }
    return 'Unable to delete invitation.';
  }

  protected memberCardToneClass(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'disqualified') {
      return 'member-card-tone-disqualified';
    }
    if (entry.status === 'accepted') {
      if (entry.role === 'Admin') {
        return 'member-card-tone-admin';
      }
      if (entry.role === 'Manager') {
        return 'member-card-tone-manager';
      }
      return 'member-card-tone-accepted';
    }
    if (this.isJoinRequest(entry)) {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  protected memberCardStatusClass(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'disqualified') {
      return 'member-status-disqualified';
    }
    if (entry.status === 'accepted') {
      if (entry.role === 'Admin') {
        return 'member-status-admin';
      }
      if (entry.role === 'Manager') {
        return 'member-status-manager';
      }
      return 'member-status-member';
    }
    if (this.isJoinRequest(entry)) {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  protected memberCardStatusIcon(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'disqualified') {
      return 'gavel';
    }
    if (entry.status === 'accepted') {
      if (entry.role === 'Admin') {
        return 'admin_panel_settings';
      }
      if (entry.role === 'Manager') {
        return 'badge';
      }
      return 'person';
    }
    if (this.isJoinRequest(entry)) {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  protected memberCardStatusLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'disqualified') {
      return 'Disqualified';
    }
    if (entry.status === 'accepted') {
      return this.roleLabel(entry);
    }
    return this.pendingStatusLabel(entry);
  }

  protected memberCardStatusPalette(entry: ActivityContracts.ActivityMemberEntry): AppMenuPalette {
    if (entry.status === 'disqualified') {
      return 'muted';
    }
    if (entry.status === 'accepted') {
      if (entry.role === 'Admin') {
        return 'blue';
      }
      if (entry.role === 'Manager') {
        return 'gold';
      }
      return 'green';
    }
    if (this.isJoinRequest(entry)) {
      return 'red';
    }
    return 'orange';
  }

  protected age(entry: ActivityContracts.ActivityMemberEntry): number {
    return entry.profile?.age ?? this.usersService.peekCachedUserById(entry.userId)?.age ?? 0;
  }

  protected roleLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.role === 'Admin') {
      return 'Admin';
    }
    if (entry.role === 'Manager') {
      return 'Manager';
    }
    return 'Member';
  }

  protected pendingStatusLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'disqualified') {
      return 'Disqualified';
    }
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (this.isJoinRequest(entry)) {
      return entry.pendingSource === 'admin'
        ? 'Waiting For Admin Approval'
        : 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return this.ownerRef?.ownerType === 'asset' ? 'Waiting For Admin Approval' : 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  protected deleteLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }


  private async applyInvites(selectedCandidates: readonly ActivityContracts.ActivityMemberEntry[]): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const existingPendingInvites = previousMembers.filter(member =>
      member.status === 'pending' && member.requestKind === 'invite'
    );
    const preservedMembers = previousMembers.filter(member =>
      !(member.status === 'pending' && member.requestKind === 'invite')
    );
    const existingPendingInviteByUserId = new Map(existingPendingInvites.map(member => [member.userId, member]));
    const selectedUserIds = selectedCandidates.map(candidate => candidate.userId);
    const selectionChanged = selectedUserIds.length !== existingPendingInvites.length
      || selectedUserIds.some(userId => !existingPendingInviteByUserId.has(userId));
    if (!selectionChanged) {
      return;
    }
    const activeUserId = this.activeUserId();
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const nextPendingInvites = selectedCandidates.map(candidate => {
      const existing = existingPendingInviteByUserId.get(candidate.userId);
      if (existing) {
        return {
          ...existing,
          ...candidate,
          id: existing.id,
          status: 'pending' as const,
          pendingSource: 'admin' as const,
          requestKind: 'invite' as const,
          invitedByActiveUser: true,
          invitedByUserId: activeUserId,
          actionAtIso: existing.actionAtIso || nowIso
        };
      }
      return {
        ...candidate,
        status: 'pending' as const,
        pendingSource: 'admin' as const,
        requestKind: 'invite' as const,
        invitedByActiveUser: true,
        invitedByUserId: activeUserId,
        statusText: candidate.statusText?.trim() || 'Waiting for admin approval.',
        actionAtIso: nowIso
      };
    });
    await this.commitMembers([...preservedMembers, ...nextPendingInvites], previousMembers);
  }

  private openMembersPopup(
    ownerId: string,
    options?: {
      subtitle?: string;
      canManage?: boolean;
      viewOnly?: boolean;
      ownerType?: ActivityMemberOwnerType;
      lookup?: AppUiTypes.PopupHeaderLookup;
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      initialMembers?: readonly ActivityContracts.ActivityMemberEntry[];
      onMembersChanged?: (members: readonly ActivityContracts.ActivityMemberEntry[]) => void;
    }
  ): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const ownerType = options?.ownerType ?? 'event';
    const lookup = options?.lookup ?? null;
    const initialMembers = ownerType !== 'event' && Array.isArray(options?.initialMembers)
      ? this.sortMembersByActionTimeDesc(options.initialMembers)
      : null;
    this.isOpen = true;
    this.ownerId = normalizedOwnerId;
    this.lookupRef = lookup ? { ...lookup } : null;
    this.ownerRef = lookup?.type === 'chat'
      ? null
      : {
          ownerType,
          ownerId: normalizedOwnerId
        };
    this.ownerRecord = null;
    this.title = 'Members';
    this.subtitle = options?.subtitle?.trim() || 'Event';
    this.pendingOnly = false;
    this.membersSmartList?.closeMenu();
    this.selectedMembersVisible = [];
    this.membersCacheByOwnerId.delete(normalizedOwnerId);
    this.resetSummaryState();
    this.requestedCanManageMembers = options?.canManage === true;
    this.viewOnlyMode = options?.viewOnly === true;
    this.canManageMembers = !this.viewOnlyMode && lookup?.type !== 'chat' && this.requestedCanManageMembers;
    this.canShowInviteButton = this.canManageMembers;
    this.isLocalMembersSource = initialMembers !== null;
    if (initialMembers) {
      this.membersCacheByOwnerId.set(normalizedOwnerId, initialMembers);
      void this.usersService.warmCachedUsers(
        initialMembers
          .map(member => `${member.userId ?? ''}`.trim())
          .filter(userId => userId.length > 0)
      );
      this.syncCanManageMembers(initialMembers);
    }
    this.membersChangeHandler = options?.onMembersChanged ?? null;
    this.membersSmartListQuery = {};
    if (initialMembers && !Number.isFinite(Number(options?.acceptedMembers)) && !Number.isFinite(Number(options?.pendingMembers)) && !Number.isFinite(Number(options?.capacityTotal))) {
      this.applySummaryFromMembers(initialMembers);
    }
    const hasProvidedSummary =
      Number.isFinite(Number(options?.acceptedMembers))
      || Number.isFinite(Number(options?.pendingMembers))
      || Number.isFinite(Number(options?.capacityTotal));
    if (hasProvidedSummary) {
      this.applySummary(
        Number(options?.acceptedMembers) || 0,
        ownerType === 'event' && !initialMembers ? 0 : Number(options?.pendingMembers) || 0,
        Number(options?.capacityTotal) || 0
      );
    }
    this.cdr.markForCheck();

    if (this.openMembersHydrationTimer) {
      clearTimeout(this.openMembersHydrationTimer);
    }
    this.openMembersHydrationTimer = setTimeout(() => {
      this.openMembersHydrationTimer = null;
      if (!this.isOpen || this.ownerId !== normalizedOwnerId) {
        return;
      }

      this.syncMembersSmartListQuery();
      if (this.lookupRef?.type !== 'chat' && options?.ownerType !== 'asset' && options?.ownerType !== 'group') {
        void this.resolveOwnerPresentation(normalizedOwnerId, options);
      }
      this.cdr.markForCheck();
    }, 0);
  }

  private syncMembersSmartListQuery(): void {
    this.membersSmartListQuery = {
      filters: {
        ownerId: this.ownerId,
        pendingOnly: this.pendingOnly
      }
    };
  }

  private async resolveOwnerPresentation(
    ownerId: string,
    options?: {
      subtitle?: string;
      canManage?: boolean;
    }
  ): Promise<void> {
    const activeUserId = this.activeUserId();
    const cachedRecord = this.eventsService.peekKnownRecordById(activeUserId, ownerId);
    if (cachedRecord) {
      this.applyOwnerRecord(cachedRecord, options);
      return;
    }

    const record = await this.eventsService.queryKnownRecordById(activeUserId, ownerId);
    if (!record || !this.isOpen || this.ownerId !== ownerId) {
      return;
    }
    this.applyOwnerRecord(record, options);
  }

  private applyOwnerRecord(
    record: ActivityEventRecord,
    options?: {
      subtitle?: string;
      canManage?: boolean;
    }
  ): void {
    this.ownerRecord = record;
    this.subtitle = record.title.trim() || options?.subtitle?.trim() || 'Event';
    this.syncCanManageMembers();
    if (this.acceptedCount <= 0 && this.pendingCount <= 0 && this.capacityTotal <= 0) {
      this.applySummary(record.acceptedMembers, 0, record.capacityTotal);
    }
    this.cdr.markForCheck();
  }

  private async loadMembersPage(
    query: ListQuery<MembersSmartListFilters>
  ): Promise<PageResult<ActivityContracts.ActivityMemberEntry>> {
    const ownerId = query.filters?.ownerId?.trim() ?? '';
    if (!ownerId) {
      return {
        items: [],
        total: 0
      };
    }

    let members = this.membersCacheByOwnerId.get(ownerId);
    if (!members) {
      const owner = this.ownerRef && this.ownerRef.ownerId === ownerId
        ? this.ownerRef
        : null;
      const loadedMembers = this.lookupRef?.type === 'chat' && this.lookupRef.id === ownerId
        ? await this.chatsService.queryChatMemberEntries(ownerId)
        : owner
        ? await this.activityMembersService.queryMembersByOwner(owner)
        : await this.activityMembersService.queryMembersByOwnerId(ownerId);
      members = this.sortMembersByActionTimeDesc(loadedMembers);
      void this.usersService.warmCachedUsers(members.map(member => member.userId));
      this.membersCacheByOwnerId.set(ownerId, members);
      if (this.isOpen && this.ownerId === ownerId) {
        this.syncCanManageMembers(members);
        this.applySummaryFromMembers(members);
      }
    }

    const filteredMembers = this.filterMembersForView(members, query.filters?.pendingOnly === true);
    const pageSize = Math.max(1, Number(query.pageSize) || 16);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: filteredMembers.slice(startIndex, startIndex + pageSize),
      total: filteredMembers.length
    };
  }

  private async commitMembers(
    members: readonly ActivityContracts.ActivityMemberEntry[],
    previousMembers: readonly ActivityContracts.ActivityMemberEntry[] = this.currentOwnerMembers()
  ): Promise<void> {
    if (!this.ownerId) {
      return;
    }
    if (this.lookupRef?.type === 'chat') {
      return;
    }
    const normalizedMembers = this.sortMembersByActionTimeDesc(members);
    const owner = this.ownerRef && this.ownerRef.ownerId === this.ownerId ? this.ownerRef : null;
    const capacityTotal = Math.max(
      normalizedMembers.filter(member => member.status === 'accepted').length,
      this.capacityTotal
    );
    if (!this.isLocalMembersSource) {
      this.suppressedOwnerSyncId = this.ownerId;
      if (owner) {
        try {
          await this.activityMembersService.replaceMembersByOwner(owner, normalizedMembers, capacityTotal);
        } catch (error) {
          if (this.suppressedOwnerSyncId === this.ownerId) {
            this.suppressedOwnerSyncId = null;
          }
          throw error;
        }
      } else {
        try {
          await this.activityMembersService.replaceMembersByOwnerId(this.ownerId, normalizedMembers, capacityTotal);
        } catch (error) {
          if (this.suppressedOwnerSyncId === this.ownerId) {
            this.suppressedOwnerSyncId = null;
          }
          throw error;
        }
      }
    }
    this.membersCacheByOwnerId.set(this.ownerId, normalizedMembers);
    this.syncCanManageMembers(normalizedMembers);
    this.applySummaryFromMembers(normalizedMembers);
    this.membersSmartList?.closeMenu();
    this.syncVisibleMembers(previousMembers, normalizedMembers);
    if (this.membersChangeHandler) {
      this.membersChangeHandler(normalizedMembers);
    }
    this.cdr.markForCheck();
  }


  private syncVisibleMembers(
    previousMembers: readonly ActivityContracts.ActivityMemberEntry[],
    nextMembers: readonly ActivityContracts.ActivityMemberEntry[]
  ): void {
    if (!this.membersListReady || !this.membersSmartList) {
      return;
    }
    const previousFilteredMembers = this.filterMembersForView(previousMembers);
    const nextFilteredMembers = this.filterMembersForView(nextMembers);
    const visibleCount = Math.max(this.selectedMembersVisible.length, this.membersSmartList.itemsSnapshot().length);
    const allMembersWereVisible = visibleCount >= previousFilteredMembers.length;
    let nextVisibleCount = Math.min(nextFilteredMembers.length, visibleCount);
    if (nextFilteredMembers.length > previousFilteredMembers.length && allMembersWereVisible) {
      nextVisibleCount = nextFilteredMembers.length;
    }
    this.membersSmartList.replaceVisibleItems(nextFilteredMembers.slice(0, nextVisibleCount), {
      total: nextFilteredMembers.length
    });
  }

  private filterMembersForView(
    members: readonly ActivityContracts.ActivityMemberEntry[],
    pendingOnly = this.pendingOnly
  ): ActivityContracts.ActivityMemberEntry[] {
    const visibleMembers = members.filter(member => !this.isWaitlistMember(member));
    return pendingOnly
      ? visibleMembers.filter(member => member.status === 'pending')
      : [...visibleMembers];
  }

  private currentOwnerMembers(): ActivityContracts.ActivityMemberEntry[] {
    return [...(this.membersCacheByOwnerId.get(this.ownerId) ?? [])];
  }

  protected canApproveMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    return this.canManageMembers
      && entry.status === 'pending'
      && this.isJoinRequest(entry);
  }

  protected canDeleteMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    if (entry.status === 'disqualified') {
      return false;
    }
    if (this.canManageMembers) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected canDisqualifyMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    if (this.lookupRef?.type === 'chat' || this.viewOnlyMode || this.ownerRef?.ownerType !== 'event' || !this.canManageMembers) {
      return false;
    }
    return entry.status === 'accepted'
      && !this.isCurrentUser(entry)
      && !this.isProtectedManagerMember(entry);
  }

  protected canReinstateMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    if (this.lookupRef?.type === 'chat' || this.viewOnlyMode || this.ownerRef?.ownerType !== 'event' || !this.canManageMembers) {
      return false;
    }
    return entry.status === 'disqualified';
  }

  protected canReportMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    if (this.lookupRef?.type === 'chat') {
      return false;
    }
    const activeUserId = this.activeUserId();
    if (!activeUserId || entry.userId === activeUserId || entry.status !== 'accepted') {
      return false;
    }
    return this.currentOwnerMembers().some(member =>
      member.userId === activeUserId
      && member.status === 'accepted'
    );
  }

  private syncCanManageMembers(members: readonly ActivityContracts.ActivityMemberEntry[] = this.currentOwnerMembers()): void {
    if (this.viewOnlyMode) {
      this.canManageMembers = false;
      this.canShowInviteButton = false;
      return;
    }
    const activeUserId = this.activeUserId();
    const activeMember = members.find(member => member.userId === activeUserId && member.status === 'accepted');
    const activeMemberCanManage = activeMember?.role === 'Admin' || activeMember?.role === 'Manager';
    const ownerRecordCanManage = !!this.ownerRecord && (
      this.ownerRecord.creatorUserId === activeUserId
      || (this.ownerRecord.adminIds ?? []).includes(activeUserId)
    );
    this.canManageMembers = this.requestedCanManageMembers || ownerRecordCanManage || activeMemberCanManage;
    this.canShowInviteButton = this.canManageMembers || !!activeMember;
  }

  private applySummaryFromMembers(members: readonly ActivityContracts.ActivityMemberEntry[]): void {
    const visibleMembers = members.filter(member => !this.isWaitlistMember(member));
    const acceptedCount = visibleMembers.filter(member => member.status === 'accepted').length;
    const pendingCount = visibleMembers.filter(member => member.status === 'pending').length;
    this.applySummary(
      acceptedCount,
      pendingCount,
      Math.max(
        acceptedCount,
        this.capacityTotal,
        this.ownerRecord?.capacityTotal ?? 0
      )
    );
  }

  private applySummary(acceptedCount: number, pendingCount: number, capacityTotal: number): void {
    const nextAcceptedCount = Math.max(0, Math.trunc(Number(acceptedCount) || 0));
    const nextPendingCount = Math.max(0, Math.trunc(Number(pendingCount) || 0));
    this.pendingSummaryState = {
      acceptedCount: nextAcceptedCount,
      pendingCount: nextPendingCount,
      capacityTotal: Math.max(nextAcceptedCount, Math.trunc(Number(capacityTotal) || 0))
    };
    this.flushPendingSummary();
  }

  private applyActivityMembersSync(sync: ActivityMembersSyncState): void {
    if (this.isLocalMembersSource) {
      return;
    }
    if (this.lookupRef?.type === 'chat') {
      return;
    }
    if (sync.id === this.suppressedOwnerSyncId) {
      this.suppressedOwnerSyncId = null;
      return;
    }
    if (sync.id !== this.ownerId) {
      return;
    }
    const owner = this.ownerRef && this.ownerRef.ownerId === sync.id ? this.ownerRef : null;
    if (!owner) {
      this.membersCacheByOwnerId.delete(sync.id);
      this.applySummary(sync.acceptedMembers, 0, sync.capacityTotal);
      this.cdr.markForCheck();
      return;
    }
    const previousMembers = this.currentOwnerMembers();
    void this.activityMembersService.queryMembersByOwner(owner)
      .then(members => {
        if (!this.isOpen || this.ownerId !== sync.id || !this.ownerRef || this.ownerRef.ownerId !== sync.id) {
          return;
        }
        const normalizedMembers = this.sortMembersByActionTimeDesc(members);
        this.membersCacheByOwnerId.set(sync.id, normalizedMembers);
        this.syncCanManageMembers(normalizedMembers);
        this.applySummaryFromMembers(normalizedMembers);
        this.syncVisibleMembers(previousMembers, normalizedMembers);
        this.cdr.markForCheck();
      })
      .catch(() => {
        if (!this.isOpen || this.ownerId !== sync.id) {
          return;
        }
        this.applySummary(sync.acceptedMembers, 0, sync.capacityTotal);
        this.cdr.markForCheck();
      });
  }

  private isJoinRequest(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return entry.requestKind === 'join'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private isWaitlistMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite';
  }

  private sortMembersByActionTimeDesc(
    entries: readonly ActivityContracts.ActivityMemberEntry[]
  ): ActivityContracts.ActivityMemberEntry[] {
    return [...entries].sort((left, right) =>
      AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso)
    );
  }

  private syncMobileViewFromViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileView = false;
      return;
    }
    this.isMobileView = window.innerWidth <= 760;
  }

  private async runMemberUpdateAfterUiYield(
    nextMembers: readonly ActivityContracts.ActivityMemberEntry[],
    previousMembers: readonly ActivityContracts.ActivityMemberEntry[]
  ): Promise<void> {
    await this.waitForMemberActionRender();
    await this.commitMembers(nextMembers, previousMembers);
  }

  private async runMemberActionAfterUiYield(
    owner: ActivityMemberOwnerRef,
    targetUserId: string,
    action: 'disqualify' | 'reinstate',
    previousMembers: readonly ActivityContracts.ActivityMemberEntry[]
  ): Promise<void> {
    await this.waitForMemberActionRender();
    if (!this.ownerId) {
      return;
    }
    this.suppressedOwnerSyncId = this.ownerId;
    let normalizedMembers: ActivityContracts.ActivityMemberEntry[];
    try {
      normalizedMembers = this.sortMembersByActionTimeDesc(await this.activityMembersService.applyMemberAction(owner, targetUserId, action));
    } catch (error) {
      if (this.suppressedOwnerSyncId === this.ownerId) {
        this.suppressedOwnerSyncId = null;
      }
      throw error;
    }
    this.membersCacheByOwnerId.set(this.ownerId, normalizedMembers);
    this.syncCanManageMembers(normalizedMembers);
    this.applySummaryFromMembers(normalizedMembers);
    this.membersSmartList?.closeMenu();
    this.syncVisibleMembers(previousMembers, normalizedMembers);
    if (this.membersChangeHandler) {
      this.membersChangeHandler(normalizedMembers);
    }
    this.cdr.markForCheck();
  }

  private isCurrentUser(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return entry.userId === this.activeUserId();
  }

  private isProtectedManagerMember(entry: ActivityContracts.ActivityMemberEntry): boolean {
    return entry.role === 'Admin' || entry.role === 'Manager';
  }

  private async waitForMemberActionRender(): Promise<void> {
    await new Promise<void>(resolve => {
      const run = () => resolve();
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
        return;
      }
      setTimeout(run, 0);
    });
  }

  private activeUserId(): string {
    return this.appCtx.userProfileStore.activeUserId().trim();
  }

  private resetSummaryState(): void {
    this.membersListReady = false;
    this.isSummaryVisible = false;
    this.summaryLabel = '0 members';
    this.pendingCount = 0;
    this.acceptedCount = 0;
    this.capacityTotal = 0;
    this.pendingSummaryState = {
      acceptedCount: 0,
      pendingCount: 0,
      capacityTotal: 0
    };
  }

  private flushPendingSummary(): void {
    if (!this.membersListReady) {
      return;
    }
    this.acceptedCount = this.pendingSummaryState.acceptedCount;
    this.pendingCount = this.pendingSummaryState.pendingCount;
    this.capacityTotal = this.pendingSummaryState.capacityTotal;
    this.summaryLabel = this.pendingCount > 0
      ? `${this.acceptedCount} members · ${this.pendingCount} pending`
      : `${this.acceptedCount} members`;
    this.isSummaryVisible = true;
  }

  private ownerScopeLabel(): string {
    if (this.lookupRef?.type === 'chat') {
      return 'chat';
    }
    if (this.ownerRef?.ownerType === 'asset') {
      return 'asset';
    }
    if (this.ownerRef?.ownerType === 'subEvent') {
      return 'sub event';
    }
    if (this.ownerRef?.ownerType === 'group') {
      return 'group';
    }
    return 'event';
  }
}
