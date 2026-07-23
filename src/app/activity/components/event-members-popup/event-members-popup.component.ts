import {
  CommonModule
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  TemplateRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import type * as AppUiTypes from '../../../shared/ui/models';
import {
  AppUtils
} from '../../../shared/app-utils';
import type { ActivityMembersSyncState } from '../../../shared/ui';
import {
  ActivityMembersBuilder,
  ActivityMembersService,
  ChatsService,
  EventsService,
  I18nService,
  UsersService
} from '../../../shared/core';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import {
  ImageCardComponent,
  PopupComponent,
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
  type PopupActionEvent,
  type PopupModel,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  ActivityMemberImageCardConverter
} from '../../../shared/ui/converters';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import type { ActivityMemberOwnerType } from '../../../shared/core/common/constants';
import type { ActivityMemberOwnerRef } from '../../../shared/core/contracts/activity.interface';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import type { UserMenuCounterDeltasDto } from '../../../shared/core/contracts/user.interface';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import {
  ActivityStore,
  type ActivityCounters
} from '../../../shared/ui/context/stores/activity.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { ActivityInvitePopupStore } from '../../../shared/ui/context/stores/activity-invite-popup.store';

interface MembersSmartListFilters {
  ownerId?: string;
  pendingOnly?: boolean;
}

type MemberMenuAction =
  | 'approve'
  | 'remove'
  | 'leave'
  | 'disqualify'
  | 'reinstate'
  | 'promoteAdmin'
  | 'stepDownAdmin'
  | 'report'
  | 'involvement';

type PersistedMemberAction =
  | 'accept'
  | 'remove'
  | 'disqualify'
  | 'reinstate'
  | 'promote-admin'
  | 'step-down-admin';

type MemberMenuContext = {
  menu: 'member-action';
  member: ActivityContracts.ActivityMemberDTO;
  action: MemberMenuAction;
};

type MembersSummaryState = {
  acceptedCount: number;
  pendingCount: number;
  capacityTotal: number;
};

interface MemberInvolvementPopupState {
  memberName: string;
  rows: ActivityContracts.ActivityMemberInvolvementDTO[];
}

@Component({
  selector: 'app-event-members-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PopupComponent,
    SmartListComponent,
    ImageCardComponent
  ],
  templateUrl: './event-members-popup.component.html',
  styleUrls: ['./event-members-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventMembersPopupComponent {
  private static readonly DEFAULT_POPUP_Z_INDEX = 3800;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(I18nService);
  private readonly dialogStore = inject(DialogStore);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly chatsService = inject(ChatsService);
  private readonly eventsService = inject(EventsService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly activitiesPopupStore = inject(ActivitiesPopupStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly activityInviteStore = inject(ActivityInvitePopupStore);
  private readonly usersService = inject(UsersService);
  private readonly profileStore = inject(ProfileStore);
  private readonly membersCacheByOwnerId = new Map<string, ActivityContracts.ActivityMemberDTO[]>();
  private readonly pendingInitialMembersDelayOwnerIds = new Set<string>();
  private lastAppliedActivityMembersUpdatedMs = 0;
  private openMembersHydrationTimer: ReturnType<typeof setTimeout> | null = null;

  protected isOpen = false;
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
  protected memberInvolvementPopup: MemberInvolvementPopupState | null = null;
  private lookupRef: AppUiTypes.PopupHeaderLookup | null = null;

  private ownerRecord: ActivityEventRecord | null = null;
  private ownerRef: ActivityMemberOwnerRef | null = null;
  private parentOwnerRef: ActivityMemberOwnerRef | null = null;
  private memberEventId = '';
  private memberSubEventId = '';
  private canManageMembers = false;
  private selectedMembersVisible: ReadonlyArray<ActivityContracts.ActivityMemberDTO> = [];
  private membersListReady = false;
  private pendingSummaryState: MembersSummaryState = {
    acceptedCount: 0,
    pendingCount: 0,
    capacityTotal: 0
  };
  private isLocalMembersSource = false;
  private membersChangeHandler: ((members: readonly ActivityContracts.ActivityMemberDTO[]) => void) | null = null;
  private suppressedOwnerSyncId: string | null = null;
  private requestedCanManageMembers = false;
  private viewOnlyMode = false;
  private memberMetricIdentity = '';
  private lastEmittedMemberMetricBucketSignature = '';

  protected membersSmartListQuery: Partial<ListQuery<MembersSmartListFilters>> = {};

  @Input() parentZIndex: number | null = null;

  @ViewChild('membersSmartList')
  private membersSmartList?: SmartListComponent<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters>;

  protected membersItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters>>;

  @ViewChild('memberItemTemplate', { read: TemplateRef })
  protected set membersItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters>> | undefined
  ) {
    this.membersItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly membersSmartListConfig: SmartListConfig<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters> = {
    pageSize: 16,
    defaultView: 'list',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
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

  protected readonly membersSmartListLoaders: SmartListLoaders<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters> = {
    list: query => from(this.loadMembersPage(query))
  };

  constructor() {
    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      this.memberMenuStore.clearActivitiesNavigationRequest();
      if (request.type === 'members') {
        this.openMembersPopup(request.ownerId, {
          ownerType: request.ownerType ?? 'event',
          parentOwnerId: request.parentOwnerId,
          parentOwnerType: request.parentOwnerType,
          eventId: request.eventId,
          subEventId: request.subEventId,
          subtitle: request.subtitle,
          canManage: request.canManage,
          viewOnly: request.viewOnly,
          acceptedMembers: request.acceptedMembers,
          pendingMembers: request.pendingMembers,
          capacityTotal: request.capacityTotal,
          metricIdentity: request.metricIdentity,
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
      const sync = this.activityStore.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSync(sync);
    });
  }

  protected membersPopupZIndex(): number {
    const parentZIndex = Math.trunc(Number(this.parentZIndex) || 0);
    if (parentZIndex <= 0) {
      return EventMembersPopupComponent.DEFAULT_POPUP_Z_INDEX;
    }
    return Math.max(EventMembersPopupComponent.DEFAULT_POPUP_Z_INDEX, parentZIndex + 100);
  }

  protected membersPopupModel(): PopupModel {
    return {
      title: this.title,
      subtitle: this.subtitle,
      translateSubtitle: false,
      ariaLabel: this.title,
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerBadge: this.isSummaryVisible ? this.localizedSummaryLabel() : null,
      translateHeaderBadge: false,
      toolbarControls: [
        ...(this.canShowInviteButton ? [{
          id: 'invite',
          align: 'end' as const,
          icon: 'person_add',
          label: 'Invite',
          ariaLabel: 'Invite friends',
          palette: 'blue' as const,
          compactOnMobile: true
        }] : []),
        {
          id: 'pending-only',
          align: 'end',
          icon: 'pending_actions',
          label: 'Pending only',
          ariaLabel: this.pendingOnly ? 'Show all members' : 'Show pending members only',
          palette: 'rose',
          active: this.pendingOnly,
          counter: this.pendingCount > 0 ? this.pendingCount : null,
          compactOnMobile: true
        }
      ],
      onClose: event => this.closeMembersPopup(event),
      onAction: event => this.onMembersPopupAction(event)
    };
  }

  private onMembersPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'invite') {
      this.handleInvite(event.sourceEvent);
      return;
    }
    if (event.action.id === 'pending-only') {
      this.togglePendingOnly(event.sourceEvent);
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || keyboardEvent.defaultPrevented || this.isSuspendedForAssetInvite()) {
      return;
    }
    if (this.dialogStore.dialog()) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.memberInvolvementPopup) {
      this.closeMemberInvolvementPopup();
      return;
    }
    if (this.membersSmartList?.menuOpen() ?? false) {
      this.membersSmartList?.closeMenu();
      this.cdr.markForCheck();
      return;
    }
    this.closeMembersPopup();
  }

  protected onMembersSmartListStateChange(
    change: SmartListStateChange<ActivityContracts.ActivityMemberDTO, MembersSmartListFilters>
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
      this.invalidateMembersCacheForOwner(this.ownerId);
    }
    this.isOpen = false;
    this.ownerId = '';
    this.ownerRef = null;
    this.parentOwnerRef = null;
    this.memberEventId = '';
    this.memberSubEventId = '';
    this.lookupRef = null;
    this.ownerRecord = null;
    this.membersSmartList?.closeMenu();
    this.pendingOnly = false;
    this.canManageMembers = false;
    this.canShowInviteButton = false;
    this.memberInvolvementPopup = null;
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
    this.activityInviteStore.openActivityInvitePopup({
      ownerId: this.ownerId,
      ownerType: this.ownerRef?.ownerType ?? 'event',
      parentOwner: this.parentOwnerRef,
      title: this.subtitle,
      onApply: selectedCandidates => this.applyInvites(selectedCandidates),
      closeOwnerPopupOnClose: false
    });
  }

  protected isSuspendedForAssetInvite(): boolean {
    const invitePopup = this.activityInviteStore.activityInvitePopup();
    return !!invitePopup && invitePopup.ownerId === this.ownerId;
  }

  protected canShowActionMenu(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return this.canShowMemberInvolvement(entry)
      || this.canApproveMember(entry)
      || this.canDeleteMember(entry)
      || this.canLeaveEvent(entry)
      || this.canDisqualifyMember(entry)
      || this.canReinstateMember(entry)
      || this.canPromoteAdmin(entry)
      || this.canStepDownAdmin(entry)
      || this.canReportMember(entry);
  }

  protected isActionMenuOpen(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return this.membersSmartList?.isMenuOpen(this.memberActionMenuId(entry)) ?? false;
  }

  protected memberActionMenuId(entry: ActivityContracts.ActivityMemberDTO): string {
    return `activity-member:${entry.id}`;
  }

  protected memberActionMenuTrigger(entry: ActivityContracts.ActivityMemberDTO): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: this.memberActionMenuPalette(entry),
      ariaLabel: `Open actions for ${entry.name}`
    };
  }

  protected memberActionMenuPalette(entry: ActivityContracts.ActivityMemberDTO): AppMenuPalette {
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

  protected memberActionMenuItems(entry: ActivityContracts.ActivityMemberDTO): readonly AppMenuItem<string, MemberMenuContext>[] {
    const items: AppMenuItem<string, MemberMenuContext>[] = [];
    if (this.canShowMemberInvolvement(entry)) {
      items.push({
        id: `member-action-involvement-${entry.id}`,
        label: 'event.participation',
        icon: 'assignment_ind',
        palette: 'teal',
        context: { menu: 'member-action', member: entry, action: 'involvement' }
      });
    }
    if (this.canPromoteAdmin(entry)) {
      items.push({
        id: `member-action-promote-admin-${entry.id}`,
        label: 'Promote to admin',
        icon: 'admin_panel_settings',
        palette: 'blue',
        context: { menu: 'member-action', member: entry, action: 'promoteAdmin' }
      });
    }
    if (this.canStepDownAdmin(entry)) {
      items.push({
        id: `member-action-step-down-admin-${entry.id}`,
        label: 'Step down as admin',
        icon: 'person',
        palette: 'warning',
        context: { menu: 'member-action', member: entry, action: 'stepDownAdmin' }
      });
    }
    if (this.canLeaveEvent(entry)) {
      items.push({
        id: `member-action-leave-${entry.id}`,
        label: 'Leave event',
        icon: 'logout',
        palette: 'danger',
        context: { menu: 'member-action', member: entry, action: 'leave' }
      });
    }
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
      case 'involvement':
        this.openMemberInvolvementPopup(context.member, event.sourceEvent);
        break;
      case 'approve':
        this.approveMember(context.member, event.sourceEvent);
        break;
      case 'remove':
        this.requestRemoveMember(context.member, event.sourceEvent);
        break;
      case 'leave':
        this.requestLeaveEvent(context.member, event.sourceEvent);
        break;
      case 'disqualify':
        this.requestDisqualifyMember(context.member, event.sourceEvent);
        break;
      case 'reinstate':
        this.requestReinstateMember(context.member, event.sourceEvent);
        break;
      case 'promoteAdmin':
        this.requestPromoteAdmin(context.member, event.sourceEvent);
        break;
      case 'stepDownAdmin':
        this.requestStepDownAdmin(context.member, event.sourceEvent);
        break;
      case 'report':
        this.reportMember(context.member, event.sourceEvent);
        break;
    }
  }

  protected approveMember(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canApproveMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.dialogStore.open({
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

  protected requestRemoveMember(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canDeleteMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.dialogStore.open({
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

  protected requestLeaveEvent(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canLeaveEvent(entry)) {
      return;
    }
    const successor = this.successorAdminFor(entry);
    const ownershipTransferMessage = entry.userId === this.eventOwnerUserId() && successor
      ? ` Ownership will be transferred to ${successor.name}.`
      : '';
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.dialogStore.open({
      title: 'Leave event?',
      message: `You will leave this event and lose access to its admin tools.${ownershipTransferMessage}`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Leave event',
      busyConfirmLabel: 'Leaving...',
      confirmTone: 'danger',
      failureMessage: 'Unable to leave event. Another accepted admin must remain.',
      onConfirm: () => this.confirmLeaveEvent(entry, successor)
    });
  }

  protected requestDisqualifyMember(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canDisqualifyMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.dialogStore.open({
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

  protected requestReinstateMember(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canReinstateMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.cdr.markForCheck();
    this.dialogStore.open({
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

  protected requestPromoteAdmin(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canPromoteAdmin(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.dialogStore.open({
      title: 'Promote member to admin?',
      message: `${entry.name} will be able to manage this event and invite or approve members.`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Promote',
      busyConfirmLabel: 'Promoting...',
      confirmTone: 'accent',
      failureMessage: 'Unable to promote member.',
      onConfirm: () => this.confirmMemberAction(entry, 'promote-admin')
    });
  }

  protected requestStepDownAdmin(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canStepDownAdmin(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.dialogStore.open({
      title: 'Step down as admin?',
      message: 'You will remain a member, but will no longer be able to manage this event.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Step down',
      busyConfirmLabel: 'Stepping down...',
      confirmTone: 'warning',
      failureMessage: 'Unable to step down as admin.',
      onConfirm: () => this.confirmMemberAction(entry, 'step-down-admin')
    });
  }

  protected reportMember(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canReportMember(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.profileStore.openReportUserPopup({
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

  protected canShowMemberInvolvement(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return Array.isArray(entry.involvements) && entry.involvements.length > 0;
  }

  protected openMemberInvolvementPopup(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    if (!this.canShowMemberInvolvement(entry)) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.memberInvolvementPopup = {
      memberName: `${entry.name ?? ''}`.trim() || 'Member',
      rows: this.memberInvolvementRows(entry)
    };
    this.cdr.markForCheck();
  }

  protected closeMemberInvolvementPopup(event?: Event): void {
    event?.stopPropagation();
    this.memberInvolvementPopup = null;
    this.cdr.markForCheck();
  }

  protected memberInvolvementPopupModel(state: MemberInvolvementPopupState): PopupModel {
    return {
      title: 'event.participation',
      subtitle: state.memberName,
      size: 'small',
      closeOnBackdrop: true,
      backdropTone: 'dim',
      onClose: event => this.closeMemberInvolvementPopup(event)
    };
  }

  protected memberInvolvementPopupZIndex(): number {
    return this.membersPopupZIndex() + 40;
  }

  protected memberInvolvementRows(
    entry: ActivityContracts.ActivityMemberDTO
  ): ActivityContracts.ActivityMemberInvolvementDTO[] {
    return (entry.involvements ?? []).map(involvement => ({ ...involvement }));
  }

  protected memberInvolvementIcon(entry: ActivityContracts.ActivityMemberInvolvementDTO): string {
    switch (entry.ownerType) {
      case 'event':
        return 'event';
      case 'subEvent':
        return 'view_agenda';
      case 'group':
        return 'groups';
      case 'asset':
        return 'inventory_2';
    }
  }

  protected memberInvolvementToneClass(entry: ActivityContracts.ActivityMemberInvolvementDTO): string {
    if (entry.status === 'pending') {
      return 'activity-members-involvement-row--pending';
    }
    if (entry.status === 'disqualified' || entry.status === 'deleted') {
      return 'activity-members-involvement-row--muted';
    }
    if (entry.ownerType === 'group') {
      return 'activity-members-involvement-row--group';
    }
    if (entry.ownerType === 'asset') {
      return 'activity-members-involvement-row--asset';
    }
    return 'activity-members-involvement-row--accepted';
  }

  protected canViewMemberProfile(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return Boolean(`${entry.userId ?? ''}`.trim());
  }

  protected memberImageCard(entry: ActivityContracts.ActivityMemberDTO): ImageCardData {
    return ActivityMemberImageCardConverter.convert(entry, {
      ownerType: this.ownerRef?.ownerType ?? 'event',
      menuOpen: this.isActionMenuOpen(entry)
    });
  }

  protected memberImageCardMediaActions(entry: ActivityContracts.ActivityMemberDTO): readonly ImageCardMediaAction[] {
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

  protected memberImageCardSharedMenuItems(entry: ActivityContracts.ActivityMemberDTO): readonly AppMenuItem<string, unknown>[] {
    return this.canShowActionMenu(entry) ? this.memberActionMenuItems(entry) : [];
  }

  protected onMemberImageCardMediaAction(
    entry: ActivityContracts.ActivityMemberDTO,
    event: ImageCardMediaActionEvent
  ): void {
    if (event.action.id === 'view-profile') {
      this.viewMemberProfile(entry, event.sourceEvent);
    }
  }

  protected viewMemberProfile(entry: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    const userId = `${entry.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.membersSmartList?.closeMenu();
    this.profileStore.openProfileView({
      userId,
      label: entry.name
    });
    this.cdr.markForCheck();
  }

  private async confirmApproveMember(entry: ActivityContracts.ActivityMemberDTO): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const owner = this.ownerRef && this.ownerRef.ownerId === this.ownerId ? this.ownerRef : null;
    if (owner?.ownerType === 'event') {
      await this.runMemberActionAfterUiYield(owner, entry.userId, 'accept', previousMembers);
      return;
    }
    const nextMembers = previousMembers.map(member => member.id === entry.id
      ? {
          ...member,
          status: 'accepted' as const,
          pendingSource: null,
          requestKind: null,
          actionAtIso: AppUtils.toIsoDateTime(new Date())
        }
      : member);
    await this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
  }

  private async confirmRemoveMember(entry: ActivityContracts.ActivityMemberDTO): Promise<void> {
    const previousMembers = this.currentOwnerMembers();
    const owner = this.ownerRef && this.ownerRef.ownerId === this.ownerId ? this.ownerRef : null;
    if (owner?.ownerType === 'event') {
      await this.runMemberActionAfterUiYield(owner, entry.userId, 'remove', previousMembers);
      return;
    }
    const nextMembers = previousMembers.filter(member => member.id !== entry.id);
    await this.runMemberUpdateAfterUiYield(nextMembers, previousMembers);
  }

  private async confirmLeaveEvent(
    entry: ActivityContracts.ActivityMemberDTO,
    successor: ActivityContracts.ActivityMemberDTO | null
  ): Promise<void> {
    const previousOwnerUserId = this.eventOwnerUserId();
    const sourceRecord = this.ownerRecord
      ?? this.eventsService.peekKnownRecordById(this.activeUserId(), this.ownerId);
    const counterDelta = this.eventAdminLeaveCounterDelta(sourceRecord);
    await this.confirmRemoveMember(entry);
    this.activitiesPopupStore.emitActivityEventRemoval(this.ownerId);
    this.patchEventLeaveCounterDelta(counterDelta);
    if (this.ownerRecord && entry.userId === previousOwnerUserId && successor) {
      this.ownerRecord = {
        ...this.ownerRecord,
        creatorUserId: successor.userId,
        creatorName: successor.name,
        creatorInitials: successor.initials,
        creatorCity: successor.city,
        adminIds: this.currentOwnerMembers()
          .filter(member => member.status === 'accepted' && member.role === 'Admin')
          .map(member => member.userId)
      };
    }
  }

  private eventAdminLeaveCounterDelta(
    record: ActivityEventRecord | null
  ): UserMenuCounterDeltasDto {
    return {
      hosting: -1,
      event: {
        all: -1,
        hosting: -1,
        ...(record?.status === 'DR' ? { drafts: -1 } : {}),
        trash: 1
      }
    };
  }

  private patchEventLeaveCounterDelta(delta: UserMenuCounterDeltasDto): void {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    this.activityStore.patchUserCounterDeltas(
      activeUserId,
      delta,
      (this.userProfileStore.activeUserProfile()?.activities ?? null) as Partial<ActivityCounters> | null
    );
    void this.usersService.patchLocalUserActivityCounterDeltas(activeUserId, delta);
  }

  private async confirmMemberAction(
    entry: ActivityContracts.ActivityMemberDTO,
    action: PersistedMemberAction
  ): Promise<void> {
    const owner = this.ownerRef && this.ownerRef.ownerId === this.ownerId ? this.ownerRef : null;
    if (!owner) {
      return;
    }
    const previousMembers = this.currentOwnerMembers();
    const actionPromise = this.runMemberActionAfterUiYield(owner, entry.userId, action, previousMembers);
    await actionPromise;
  }

  private memberRemovalTitle(entry: ActivityContracts.ActivityMemberDTO): string {
    if (this.isJoinRequest(entry)) {
      return 'Reject request?';
    }
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return 'Remove admin?';
    }
    if (entry.status === 'accepted') {
      return 'Remove member?';
    }
    return 'Delete invitation?';
  }

  private memberRemovalMessage(entry: ActivityContracts.ActivityMemberDTO): string {
    if (this.isJoinRequest(entry)) {
      return `Reject ${entry.name}'s request to join this ${this.ownerScopeLabel()}?`;
    }
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return `Remove ${entry.name} as an admin and from this ${this.ownerScopeLabel()}?`;
    }
    if (entry.status === 'accepted') {
      return `Remove ${entry.name} from this ${this.ownerScopeLabel()}?`;
    }
    return `Delete ${entry.name}'s invitation to this ${this.ownerScopeLabel()}?`;
  }

  private memberRemovalConfirmLabel(entry: ActivityContracts.ActivityMemberDTO): string {
    if (this.isJoinRequest(entry)) {
      return 'Reject';
    }
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return 'Remove admin';
    }
    return entry.status === 'accepted' ? 'Remove' : 'Delete';
  }

  private memberRemovalBusyLabel(entry: ActivityContracts.ActivityMemberDTO): string {
    if (this.isJoinRequest(entry)) {
      return 'Rejecting...';
    }
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return 'Removing admin...';
    }
    return entry.status === 'accepted' ? 'Removing...' : 'Deleting...';
  }

  private memberRemovalFailureMessage(entry: ActivityContracts.ActivityMemberDTO): string {
    if (this.isJoinRequest(entry)) {
      return 'Unable to reject request.';
    }
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return 'Unable to remove admin.';
    }
    if (entry.status === 'accepted') {
      return 'Unable to remove member.';
    }
    return 'Unable to delete invitation.';
  }

  protected deleteLabel(entry: ActivityContracts.ActivityMemberDTO): string {
    if (entry.status === 'accepted' && entry.role === 'Admin') {
      return 'Remove admin';
    }
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (this.isJoinRequest(entry)) {
      return 'Reject request';
    }
    return 'Delete invitation';
  }


  private async applyInvites(selectedCandidates: readonly ActivityContracts.ActivityMemberDTO[]): Promise<void> {
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
      parentOwnerId?: string;
      parentOwnerType?: ActivityMemberOwnerType;
      eventId?: string;
      subEventId?: string;
      lookup?: AppUiTypes.PopupHeaderLookup;
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      metricIdentity?: string;
      initialMembers?: readonly ActivityContracts.ActivityMemberDTO[];
      onMembersChanged?: (members: readonly ActivityContracts.ActivityMemberDTO[]) => void;
    }
  ): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const ownerType = options?.ownerType ?? 'event';
    const lookup = options?.lookup ?? null;
    const providedInitialMembers = ownerType !== 'event' && Array.isArray(options?.initialMembers)
      ? this.sortMembersByActionTimeDesc(options.initialMembers)
      : null;
    const isScopedAssetOwner = ownerType === 'asset'
      && `${options?.eventId ?? ''}`.trim().length > 0
      && `${options?.subEventId ?? ''}`.trim().length > 0;
    const initialMembers = this.activityMembersService.usesLocalDataSource() && !isScopedAssetOwner
      ? providedInitialMembers
      : null;
    this.isOpen = true;
    this.ownerId = normalizedOwnerId;
    this.memberMetricIdentity = `${options?.metricIdentity ?? ''}`.trim();
    this.lastEmittedMemberMetricBucketSignature = '';
    this.lookupRef = lookup ? { ...lookup } : null;
    this.ownerRef = lookup?.type === 'chat'
      ? null
      : {
          ownerType,
          ownerId: normalizedOwnerId
        };
    this.memberEventId = `${options?.eventId ?? ''}`.trim();
    this.memberSubEventId = `${options?.subEventId ?? ''}`.trim();
    const explicitParentOwnerId = `${options?.parentOwnerId ?? ''}`.trim();
    const fallbackParentOwnerId = ownerType === 'event' ? '' : this.memberEventId;
    const parentOwnerId = explicitParentOwnerId || fallbackParentOwnerId;
    this.parentOwnerRef = parentOwnerId
      ? {
          ownerId: parentOwnerId,
          ownerType: options?.parentOwnerType ?? 'event'
        }
      : null;
    this.ownerRecord = null;
    this.title = 'Members';
    this.subtitle = options?.subtitle?.trim() || 'Event';
    this.pendingOnly = false;
    this.membersSmartList?.closeMenu();
    this.selectedMembersVisible = [];
    this.invalidateMembersCacheForOwner(normalizedOwnerId);
    this.resetSummaryState();
    this.requestedCanManageMembers = options?.canManage === true;
    this.viewOnlyMode = options?.viewOnly === true;
    this.canManageMembers = !this.viewOnlyMode && lookup?.type !== 'chat' && this.requestedCanManageMembers;
    this.canShowInviteButton = this.canManageMembers;
    this.isLocalMembersSource = initialMembers !== null;
    if (initialMembers) {
      this.membersCacheByOwnerId.set(this.membersCacheKey(normalizedOwnerId), initialMembers);
      this.membersCacheByOwnerId.set(
        this.membersCacheKey(normalizedOwnerId, true),
        initialMembers.filter(member => member.status === 'pending')
      );
      this.pendingInitialMembersDelayOwnerIds.add(normalizedOwnerId);
      void this.usersService.warmCachedUsers(
        initialMembers
          .map(member => `${member.userId ?? ''}`.trim())
          .filter(userId => userId.length > 0)
      );
      this.syncCanManageMembers(initialMembers);
    } else {
      this.pendingInitialMembersDelayOwnerIds.delete(normalizedOwnerId);
    }
    this.membersChangeHandler = options?.onMembersChanged ?? null;
    this.membersSmartListQuery = {};
    if (providedInitialMembers && !Number.isFinite(Number(options?.acceptedMembers)) && !Number.isFinite(Number(options?.pendingMembers)) && !Number.isFinite(Number(options?.capacityTotal))) {
      this.applySummaryFromMembers(providedInitialMembers);
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

  private invalidateMembersCacheForOwner(ownerId: string): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this.membersCacheByOwnerId.delete(this.membersCacheKey(normalizedOwnerId));
    this.membersCacheByOwnerId.delete(this.membersCacheKey(normalizedOwnerId, true));
    this.pendingInitialMembersDelayOwnerIds.delete(normalizedOwnerId);
  }

  private membersCacheKey(ownerId: string, pendingOnly = false): string {
    return `${ownerId.trim()}::pending:${pendingOnly ? '1' : '0'}`;
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
  ): Promise<PageResult<ActivityContracts.ActivityMemberDTO>> {
    const ownerId = query.filters?.ownerId?.trim() ?? '';
    const pendingOnly = query.filters?.pendingOnly === true;
    if (!ownerId) {
      return {
        items: [],
        total: 0
      };
    }

    if (this.lookupRef?.type === 'chat' && this.lookupRef.id === ownerId) {
      return this.chatsService.queryChatMemberEntriesPage(ownerId, query);
    }

    const cacheKey = this.membersCacheKey(ownerId, pendingOnly);
    let members = this.membersCacheByOwnerId.get(cacheKey);
    if (!pendingOnly && members && this.pendingInitialMembersDelayOwnerIds.delete(ownerId)) {
      await this.activityMembersService.waitForMembersRouteDelay();
      if (!this.isOpen || this.ownerId !== ownerId) {
        return {
          items: [],
          total: 0
        };
      }
      members = this.membersCacheByOwnerId.get(cacheKey) ?? members;
    }
    if (!members) {
      const owner = this.ownerRef && this.ownerRef.ownerId === ownerId
        ? this.ownerRef
        : null;
      const loadedMembers = owner
        ? await this.activityMembersService.queryMembersByOwner(owner, {
            pendingOnly,
            eventId: this.memberEventId,
            subEventId: this.memberSubEventId
          })
        : await this.activityMembersService.queryMembersByOwnerId(ownerId, {
            pendingOnly,
            eventId: this.memberEventId,
            subEventId: this.memberSubEventId
          });
      members = this.sortMembersByActionTimeDesc(loadedMembers);
      void this.usersService.warmCachedUsers(members.map(member => member.userId));
      this.membersCacheByOwnerId.set(cacheKey, members);
      if (!pendingOnly && this.isOpen && this.ownerId === ownerId) {
        this.syncCanManageMembers(members);
        this.applySummaryFromMembers(members);
      }
    }

    const pageSize = Math.max(1, Number(query.pageSize) || 16);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: members.slice(startIndex, startIndex + pageSize),
      total: members.length
    };
  }

  private async commitMembers(
    members: readonly ActivityContracts.ActivityMemberDTO[],
    previousMembers: readonly ActivityContracts.ActivityMemberDTO[] = this.currentOwnerMembers()
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
          await this.activityMembersService.replaceMembersByOwner(owner, normalizedMembers, capacityTotal, {
            eventId: this.memberEventId,
            subEventId: this.memberSubEventId
          });
        } catch (error) {
          if (this.suppressedOwnerSyncId === this.ownerId) {
            this.suppressedOwnerSyncId = null;
          }
          throw error;
        }
      } else {
        try {
          await this.activityMembersService.replaceMembersByOwnerId(this.ownerId, normalizedMembers, capacityTotal, {
            eventId: this.memberEventId,
            subEventId: this.memberSubEventId
          });
        } catch (error) {
          if (this.suppressedOwnerSyncId === this.ownerId) {
            this.suppressedOwnerSyncId = null;
          }
          throw error;
        }
      }
    }
    this.membersCacheByOwnerId.set(this.membersCacheKey(this.ownerId), normalizedMembers);
    this.membersCacheByOwnerId.delete(this.membersCacheKey(this.ownerId, true));
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
    previousMembers: readonly ActivityContracts.ActivityMemberDTO[],
    nextMembers: readonly ActivityContracts.ActivityMemberDTO[]
  ): void {
    if (!this.membersListReady || !this.membersSmartList) {
      return;
    }
    if (this.pendingOnly && this.ownerId) {
      this.membersCacheByOwnerId.delete(this.membersCacheKey(this.ownerId, true));
      this.membersSmartList.reload();
      return;
    }
    const previousFilteredMembers = [...previousMembers];
    const nextFilteredMembers = [...nextMembers];
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

  private currentOwnerMembers(): ActivityContracts.ActivityMemberDTO[] {
    return [...(this.membersCacheByOwnerId.get(this.membersCacheKey(this.ownerId)) ?? [])];
  }

  protected canApproveMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    return this.canManageMembers
      && entry.status === 'pending'
      && this.isJoinRequest(entry);
  }

  protected canDeleteMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (this.viewOnlyMode) {
      return false;
    }
    if (entry.status === 'disqualified') {
      return false;
    }
    if (this.ownerRef?.ownerType === 'event' && entry.userId === this.eventOwnerUserId()) {
      return false;
    }
    if (this.ownerRef?.ownerType === 'event' && entry.status === 'accepted' && entry.role === 'Admin') {
      return this.isActiveUserEventOwner() && !this.isCurrentUser(entry);
    }
    if (this.canManageMembers) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  protected canDisqualifyMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (this.lookupRef?.type === 'chat' || this.viewOnlyMode || this.ownerRef?.ownerType !== 'event' || !this.canManageMembers) {
      return false;
    }
    return entry.status === 'accepted'
      && !this.isCurrentUser(entry)
      && !this.isProtectedManagerMember(entry);
  }

  protected canReinstateMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    if (this.lookupRef?.type === 'chat' || this.viewOnlyMode || this.ownerRef?.ownerType !== 'event' || !this.canManageMembers) {
      return false;
    }
    return entry.status === 'disqualified';
  }

  protected canPromoteAdmin(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return !this.viewOnlyMode
      && this.ownerRef?.ownerType === 'event'
      && this.isActiveUserEventAdmin()
      && entry.status === 'accepted'
      && entry.role !== 'Admin'
      && !this.isCurrentUser(entry);
  }

  protected canStepDownAdmin(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return !this.viewOnlyMode
      && this.ownerRef?.ownerType === 'event'
      && entry.status === 'accepted'
      && entry.role === 'Admin'
      && this.isCurrentUser(entry)
      && entry.userId !== this.eventOwnerUserId();
  }

  protected canLeaveEvent(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return !this.viewOnlyMode
      && this.ownerRef?.ownerType === 'event'
      && entry.status === 'accepted'
      && entry.role === 'Admin'
      && this.isCurrentUser(entry)
      && this.successorAdminFor(entry) !== null;
  }

  protected canReportMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
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

  private syncCanManageMembers(members: readonly ActivityContracts.ActivityMemberDTO[] = this.currentOwnerMembers()): void {
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
    this.canShowInviteButton = this.canManageMembers
      || (this.ownerRef?.ownerType !== 'asset' && !!activeMember);
  }

  private applySummaryFromMembers(members: readonly ActivityContracts.ActivityMemberDTO[]): void {
    const visibleMembers = [...members];
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
      this.invalidateMembersCacheForOwner(sync.id);
      this.applySummary(sync.acceptedMembers, 0, sync.capacityTotal);
      this.cdr.markForCheck();
      return;
    }
    const previousMembers = this.currentOwnerMembers();
    void this.activityMembersService.queryMembersByOwner(owner, {
      eventId: this.memberEventId,
      subEventId: this.memberSubEventId
    })
      .then(members => {
        if (!this.isOpen || this.ownerId !== sync.id || !this.ownerRef || this.ownerRef.ownerId !== sync.id) {
          return;
        }
        const normalizedMembers = this.sortMembersByActionTimeDesc(members);
        this.membersCacheByOwnerId.set(this.membersCacheKey(sync.id), normalizedMembers);
        this.membersCacheByOwnerId.delete(this.membersCacheKey(sync.id, true));
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

  private isJoinRequest(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return entry.requestKind === 'join'
      || entry.requestKind === 'approval'
      || (entry.requestKind == null && entry.pendingSource === 'member');
  }

  private isWaitlistMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return entry.requestKind === 'waitlist' || entry.requestKind === 'waitlist-invite';
  }

  private sortMembersByActionTimeDesc(
    entries: readonly ActivityContracts.ActivityMemberDTO[]
  ): ActivityContracts.ActivityMemberDTO[] {
    return ActivityMembersBuilder.sortActivityMembersForManagement(entries);
  }

  private async runMemberUpdateAfterUiYield(
    nextMembers: readonly ActivityContracts.ActivityMemberDTO[],
    previousMembers: readonly ActivityContracts.ActivityMemberDTO[]
  ): Promise<void> {
    await this.waitForMemberActionRender();
    await this.commitMembers(nextMembers, previousMembers);
  }

  private async runMemberActionAfterUiYield(
    owner: ActivityMemberOwnerRef,
    targetUserId: string,
    action: PersistedMemberAction,
    previousMembers: readonly ActivityContracts.ActivityMemberDTO[]
  ): Promise<void> {
    await this.waitForMemberActionRender();
    if (!this.ownerId) {
      return;
    }
    this.suppressedOwnerSyncId = this.ownerId;
    let normalizedMembers: ActivityContracts.ActivityMemberDTO[];
    try {
      normalizedMembers = this.sortMembersByActionTimeDesc(await this.activityMembersService.applyMemberAction(owner, targetUserId, action));
    } catch (error) {
      if (this.suppressedOwnerSyncId === this.ownerId) {
        this.suppressedOwnerSyncId = null;
      }
      throw error;
    }
    this.membersCacheByOwnerId.set(this.membersCacheKey(this.ownerId), normalizedMembers);
    this.membersCacheByOwnerId.delete(this.membersCacheKey(this.ownerId, true));
    this.syncCanManageMembers(normalizedMembers);
    this.applySummaryFromMembers(normalizedMembers);
    this.membersSmartList?.closeMenu();
    this.syncVisibleMembers(previousMembers, normalizedMembers);
    if (this.membersChangeHandler) {
      this.membersChangeHandler(normalizedMembers);
    }
    this.cdr.markForCheck();
  }

  private isCurrentUser(entry: ActivityContracts.ActivityMemberDTO): boolean {
    return entry.userId === this.activeUserId();
  }

  private successorAdminFor(
    entry: ActivityContracts.ActivityMemberDTO
  ): ActivityContracts.ActivityMemberDTO | null {
    return this.currentOwnerMembers()
      .filter(member => member.userId !== entry.userId)
      .filter(member => member.status === 'accepted' && member.role === 'Admin')
      .sort((left, right) =>
        AppUtils.toSortableDate(left.actionAtIso)
        - AppUtils.toSortableDate(right.actionAtIso)
      )[0] ?? null;
  }

  private eventOwnerUserId(): string {
    return `${this.ownerRecord?.creatorUserId ?? ''}`.trim();
  }

  private isActiveUserEventOwner(): boolean {
    const activeUserId = this.activeUserId();
    return Boolean(activeUserId) && activeUserId === this.eventOwnerUserId();
  }

  private isActiveUserEventAdmin(): boolean {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return false;
    }
    if (this.isActiveUserEventOwner() || (this.ownerRecord?.adminIds ?? []).includes(activeUserId)) {
      return true;
    }
    return this.currentOwnerMembers().some(member =>
      member.userId === activeUserId
      && member.status === 'accepted'
      && member.role === 'Admin'
    );
  }

  private isProtectedManagerMember(entry: ActivityContracts.ActivityMemberDTO): boolean {
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
    return this.userProfileStore.activeUserId().trim();
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
    this.lastEmittedMemberMetricBucketSignature = '';
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
    this.emitMemberMetricBucketPatch();
  }

  private localizedSummaryLabel(): string {
    this.i18n.revision();
    const members = this.i18n.translateParams('members.count', { count: this.acceptedCount });
    if (this.pendingCount <= 0) {
      return members;
    }
    const pending = this.i18n.translateParams('pending.count', { count: this.pendingCount });
    return `${members} · ${pending}`;
  }

  private emitMemberMetricBucketPatch(): void {
    const identity = this.memberMetricIdentity.trim();
    if (!identity) {
      return;
    }
    const signature = `${identity}:${this.acceptedCount}:${this.pendingCount}:${this.capacityTotal}`;
    if (signature === this.lastEmittedMemberMetricBucketSignature) {
      return;
    }
    this.lastEmittedMemberMetricBucketSignature = signature;
    this.activityStore.emitActivityChatMetricBucketPatch({
      identity,
      bucketType: 'members',
      bucket: {
        accepted: this.acceptedCount,
        pending: this.pendingCount,
        capacityMin: 0,
        capacityMax: this.capacityTotal
      }
    });
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
