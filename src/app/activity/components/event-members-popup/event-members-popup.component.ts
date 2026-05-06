import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
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

import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import type { ActivityMemberOwnerRef, ActivityMemberOwnerType } from '../../../shared/core/base/models';
import type { ActivityMembersSyncState } from '../../../shared/core';
import { ActivityMembersService, AppContext, AppPopupContext, EventsService, UsersService } from '../../../shared/core';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import {
  CounterBadgePipe,
  LazyBgImageDirective,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { NavigatorService } from '../../../navigator';

interface MembersSmartListFilters {
  ownerId?: string;
  pendingOnly?: boolean;
}

type InlineMemberActionMenu = {
  id: string;
  openUp: boolean;
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
    LazyBgImageDirective,
    CounterBadgePipe
  ],
  templateUrl: './event-members-popup.component.html',
  styleUrls: ['./event-members-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventMembersPopupComponent {
  private static readonly DELETE_PENDING_WINDOW_MS = 1500;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly usersService = inject(UsersService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly membersCacheByOwnerId = new Map<string, AppTypes.ActivityMemberEntry[]>();
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

  private ownerRecord: DemoEventRecord | null = null;
  private ownerRef: ActivityMemberOwnerRef | null = null;
  private canManageMembers = false;
  private inlineItemActionMenu: InlineMemberActionMenu | null = null;
  private selectedMembersVisible: ReadonlyArray<AppTypes.ActivityMemberEntry> = [];
  private membersListReady = false;
  private pendingSummaryState: MembersSummaryState = {
    acceptedCount: 0,
    pendingCount: 0,
    capacityTotal: 0
  };
  private isLocalMembersSource = false;
  private membersChangeHandler: ((members: readonly AppTypes.ActivityMemberEntry[]) => void) | null = null;
  private suppressedOwnerSyncId: string | null = null;
  private requestedCanManageMembers = false;
  private viewOnlyMode = false;

  protected membersSmartListQuery: Partial<ListQuery<MembersSmartListFilters>> = {};

  @ViewChild('membersSmartList')
  private membersSmartList?: SmartListComponent<AppTypes.ActivityMemberEntry, MembersSmartListFilters>;

  protected membersItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityMemberEntry, MembersSmartListFilters>>;

  @ViewChild('memberItemTemplate', { read: TemplateRef })
  private set membersItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityMemberEntry, MembersSmartListFilters>> | undefined
  ) {
    this.membersItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly membersSmartListConfig: SmartListConfig<AppTypes.ActivityMemberEntry, MembersSmartListFilters> = {
    pageSize: 16,
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/events/members'),
    loadingWindowMs: 3000,
    defaultView: 'list',
    headerProgress: {
      enabled: true
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

  protected readonly membersSmartListLoaders: SmartListLoaders<AppTypes.ActivityMemberEntry, MembersSmartListFilters> = {
    list: query => from(this.loadMembersPage(query))
  };

  constructor() {
    this.syncMobileViewFromViewport();

    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      this.popupCtx.clearActivitiesNavigationRequest();
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
          onMembersChanged: request.onMembersChanged
        });
        return;
      }
      this.openMembersPopup(request.row.id, {
        subtitle: request.row.title,
        canManage: request.row.isAdmin === true,
        ownerType: 'event'
      });
    });

    effect(() => {
      const sync = this.appCtx.activityMembersSync();
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
    if (this.confirmationDialogService.dialog()) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.inlineItemActionMenu) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
      return;
    }
    this.closeMembersPopup();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen || this.isSuspendedForAssetInvite() || !this.inlineItemActionMenu) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.subevent-member-menu-anchor')) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
    }
  }

  protected onMembersSmartListStateChange(
    change: SmartListStateChange<AppTypes.ActivityMemberEntry, MembersSmartListFilters>
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
    this.inlineItemActionMenu = null;
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
    this.ownerRecord = null;
    this.inlineItemActionMenu = null;
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
    this.popupCtx.openActivityInvitePopup({
      ownerId: this.ownerId,
      ownerType: this.ownerRef?.ownerType ?? 'event',
      title: this.subtitle,
      onApply: selectedCandidates => this.applyInvites(selectedCandidates),
      closeOwnerPopupOnClose: false
    });
  }

  protected isSuspendedForAssetInvite(): boolean {
    const invitePopup = this.popupCtx.activityInvitePopup();
    return !!invitePopup && invitePopup.ownerId === this.ownerId;
  }

  protected canShowActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.canApproveMember(entry)
      || this.canDeleteMember(entry)
      || this.canReportMember(entry);
  }

  protected toggleMemberActionMenu(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canShowActionMenu(entry)) {
      return;
    }
    if (this.inlineItemActionMenu?.id === entry.id) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
      return;
    }
    this.inlineItemActionMenu = {
      id: entry.id,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
    this.cdr.markForCheck();
  }

  protected isActionMenuOpen(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.id === entry.id;
  }

  protected isActionMenuOpenUp(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.inlineItemActionMenu?.id === entry.id && this.inlineItemActionMenu.openUp;
  }

  protected approveMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canApproveMember(entry)) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.cdr.markForCheck();
    this.confirmationDialogService.open({
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

  protected requestRemoveMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canDeleteMember(entry)) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.cdr.markForCheck();
    this.confirmationDialogService.open({
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

  protected reportMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canReportMember(entry)) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.navigatorService.openReportUserPopup({
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

  protected canViewMemberProfile(entry: AppTypes.ActivityMemberEntry): boolean {
    return Boolean(`${entry.userId ?? ''}`.trim());
  }

  protected viewMemberProfile(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    const userId = `${entry.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.navigatorService.openProfileView({
      userId,
      user: entry.profile ?? this.usersService.peekCachedUserById(userId),
      label: entry.name
    });
    this.cdr.markForCheck();
  }

  private async confirmApproveMember(entry: AppTypes.ActivityMemberEntry): Promise<void> {
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
    const pendingWindowPromise = this.minimumDeletePendingWindow();
    const approvePromise = this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
    await Promise.all([pendingWindowPromise, approvePromise]);
  }

  private async confirmRemoveMember(entry: AppTypes.ActivityMemberEntry): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const nextMembers = previousMembers.filter(member => member.id !== entry.id);
    const pendingWindowPromise = this.minimumDeletePendingWindow();
    const deletePromise = this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
    await Promise.all([pendingWindowPromise, deletePromise]);
  }

  private memberRemovalTitle(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Reject request?';
    }
    if (entry.status === 'accepted') {
      return 'Remove member?';
    }
    return 'Delete invitation?';
  }

  private memberRemovalMessage(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return `Reject ${entry.name}'s request to join this ${this.ownerScopeLabel()}?`;
    }
    if (entry.status === 'accepted') {
      return `Remove ${entry.name} from this ${this.ownerScopeLabel()}?`;
    }
    return `Delete ${entry.name}'s invitation to this ${this.ownerScopeLabel()}?`;
  }

  private memberRemovalConfirmLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Reject';
    }
    return entry.status === 'accepted' ? 'Remove' : 'Delete';
  }

  private memberRemovalBusyLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Rejecting...';
    }
    return entry.status === 'accepted' ? 'Removing...' : 'Deleting...';
  }

  private memberRemovalFailureMessage(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.requestKind === 'join') {
      return 'Unable to reject request.';
    }
    if (entry.status === 'accepted') {
      return 'Unable to remove member.';
    }
    return 'Unable to delete invitation.';
  }

  protected memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
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

  protected memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
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

  protected memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
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

  protected memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return this.roleLabel(entry);
    }
    return this.pendingStatusLabel(entry);
  }

  protected age(entry: AppTypes.ActivityMemberEntry): number {
    return entry.profile?.age ?? this.usersService.peekCachedUserById(entry.userId)?.age ?? 0;
  }

  protected roleLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.role === 'Admin') {
      return 'Admin';
    }
    if (entry.role === 'Manager') {
      return 'Manager';
    }
    return 'Member';
  }

  protected pendingStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
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

  protected deleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }


  private async applyInvites(selectedCandidates: readonly AppTypes.ActivityMemberEntry[]): Promise<void> {
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
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      initialMembers?: readonly AppTypes.ActivityMemberEntry[];
      onMembersChanged?: (members: readonly AppTypes.ActivityMemberEntry[]) => void;
    }
  ): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const ownerType = options?.ownerType ?? 'event';
    const initialMembers = ownerType !== 'event' && Array.isArray(options?.initialMembers)
      ? this.sortMembersByActionTimeDesc(options.initialMembers)
      : null;
    this.isOpen = true;
    this.ownerId = normalizedOwnerId;
    this.ownerRef = {
      ownerType,
      ownerId: normalizedOwnerId
    };
    this.ownerRecord = null;
    this.title = 'Members';
    this.subtitle = options?.subtitle?.trim() || 'Event';
    this.pendingOnly = false;
    this.inlineItemActionMenu = null;
    this.selectedMembersVisible = [];
    this.membersCacheByOwnerId.delete(normalizedOwnerId);
    this.resetSummaryState();
    this.requestedCanManageMembers = options?.canManage === true;
    this.viewOnlyMode = options?.viewOnly === true;
    this.canManageMembers = !this.viewOnlyMode && this.requestedCanManageMembers;
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
      if (options?.ownerType !== 'asset') {
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
    const cachedRecord = this.eventsService.peekKnownItemById(activeUserId, ownerId);
    if (cachedRecord) {
      this.applyOwnerRecord(cachedRecord, options);
      return;
    }

    const record = await this.eventsService.queryKnownItemById(activeUserId, ownerId);
    if (!record || !this.isOpen || this.ownerId !== ownerId) {
      return;
    }
    this.applyOwnerRecord(record, options);
  }

  private applyOwnerRecord(
    record: DemoEventRecord,
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
  ): Promise<PageResult<AppTypes.ActivityMemberEntry>> {
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
      const loadedMembers = owner
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
    members: readonly AppTypes.ActivityMemberEntry[],
    previousMembers: readonly AppTypes.ActivityMemberEntry[] = this.currentOwnerMembers()
  ): Promise<void> {
    if (!this.ownerId) {
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
    this.inlineItemActionMenu = null;
    this.syncVisibleMembers(previousMembers, normalizedMembers);
    if (this.membersChangeHandler) {
      this.membersChangeHandler(normalizedMembers);
    }
    this.cdr.markForCheck();
  }


  private syncVisibleMembers(
    previousMembers: readonly AppTypes.ActivityMemberEntry[],
    nextMembers: readonly AppTypes.ActivityMemberEntry[]
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
      nextVisibleCount = Math.min(nextFilteredMembers.length, visibleCount + 1);
    }
    this.membersSmartList.replaceVisibleItems(nextFilteredMembers.slice(0, nextVisibleCount), {
      total: nextFilteredMembers.length
    });
  }

  private filterMembersForView(
    members: readonly AppTypes.ActivityMemberEntry[],
    pendingOnly = this.pendingOnly
  ): AppTypes.ActivityMemberEntry[] {
    const visibleMembers = members.filter(member => !this.isWaitlistMember(member));
    return pendingOnly
      ? visibleMembers.filter(member => member.status === 'pending')
      : [...visibleMembers];
  }

  private currentOwnerMembers(): AppTypes.ActivityMemberEntry[] {
    return [...(this.membersCacheByOwnerId.get(this.ownerId) ?? [])];
  }

  protected canApproveMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    return this.canManageMembers
      && entry.status === 'pending'
      && this.isJoinRequest(entry);
  }

  protected canDeleteMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    if (this.canManageMembers) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected canReportMember(entry: AppTypes.ActivityMemberEntry): boolean {
    const activeUserId = this.activeUserId();
    if (!activeUserId || entry.userId === activeUserId || entry.status !== 'accepted') {
      return false;
    }
    return this.currentOwnerMembers().some(member =>
      member.userId === activeUserId
      && member.status === 'accepted'
    );
  }

  private syncCanManageMembers(members: readonly AppTypes.ActivityMemberEntry[] = this.currentOwnerMembers()): void {
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
      || this.ownerRecord.isAdmin === true
    );
    this.canManageMembers = this.requestedCanManageMembers || ownerRecordCanManage || activeMemberCanManage;
    this.canShowInviteButton = this.canManageMembers || !!activeMember;
  }

  private applySummaryFromMembers(members: readonly AppTypes.ActivityMemberEntry[]): void {
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

  private isJoinRequest(entry: AppTypes.ActivityMemberEntry): boolean {
    return entry.requestKind === 'join'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private isWaitlistMember(entry: AppTypes.ActivityMemberEntry): boolean {
    return entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite';
  }

  private sortMembersByActionTimeDesc(
    entries: readonly AppTypes.ActivityMemberEntry[]
  ): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((left, right) =>
      AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso)
    );
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileView || typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const actionWrap = (trigger?.closest('.subevent-member-menu-anchor') as HTMLElement | null) ?? trigger;
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

  private syncMobileViewFromViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileView = false;
      return;
    }
    this.isMobileView = window.innerWidth <= 760;
  }

  private minimumDeletePendingWindow(): Promise<void> {
    return this.demoModeEnabled
      ? this.wait(EventMembersPopupComponent.DELETE_PENDING_WINDOW_MS)
      : Promise.resolve();
  }

  private async runMemberUpdateAfterUiYield(
    nextMembers: readonly AppTypes.ActivityMemberEntry[],
    previousMembers: readonly AppTypes.ActivityMemberEntry[]
  ): Promise<void> {
    await this.waitForAnimationKickoff();
    await this.commitMembers(nextMembers, previousMembers);
  }

  private async waitForAnimationKickoff(): Promise<void> {
    await this.waitForNextPaint();
    await this.wait(this.demoModeEnabled ? 96 : 16);
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private async waitForNextPaint(): Promise<void> {
    await new Promise<void>(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(() => resolve(), 0);
    });
  }

  private get demoModeEnabled(): boolean {
    return environment.activitiesDataSource === 'demo';
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
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
