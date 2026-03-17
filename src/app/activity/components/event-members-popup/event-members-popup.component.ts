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

import { AppDemoGenerators } from '../../../shared/app-demo-generators';
import type * as AppTypes from '../../../shared/app-types';
import { AppUtils } from '../../../shared/app-utils';
import type { ActivityMembersSyncState } from '../../../shared/core';
import { ActivityMembersService, AppContext, EventsService } from '../../../shared/core';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { ActivitiesDbContextService } from '../../services/activities-db-context.service';

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
    SmartListComponent
  ],
  templateUrl: './event-members-popup.component.html',
  styleUrls: ['./event-members-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventMembersPopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);

  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  private readonly userByIdMap = new Map(this.users.map(user => [user.id, user]));
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
  protected pendingDelete: AppTypes.ActivityMemberEntry | null = null;

  private ownerRecord: DemoEventRecord | null = null;
  private canManageMembers = false;
  private inlineItemActionMenu: InlineMemberActionMenu | null = null;
  private selectedMembersVisible: ReadonlyArray<AppTypes.ActivityMemberEntry> = [];
  private membersListReady = false;
  private pendingSummaryState: MembersSummaryState = {
    acceptedCount: 0,
    pendingCount: 0,
    capacityTotal: 0
  };

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
    loadingDelayMs: 0,
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
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
      if (request.type === 'members') {
        this.openMembersPopup(request.ownerId);
        return;
      }
      this.openMembersPopup(request.row.id, {
        subtitle: request.row.title,
        canManage: request.row.isAdmin === true
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
    if (!this.isOpen || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.pendingDelete) {
      this.pendingDelete = null;
      this.cdr.markForCheck();
      return;
    }
    if (this.inlineItemActionMenu) {
      this.inlineItemActionMenu = null;
      this.cdr.markForCheck();
      return;
    }
    this.closeMembersPopup();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen || !this.inlineItemActionMenu) {
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
    this.pendingDelete = null;
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
    this.ownerRecord = null;
    this.inlineItemActionMenu = null;
    this.pendingDelete = null;
    this.pendingOnly = false;
    this.canManageMembers = false;
    this.canShowInviteButton = false;
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
    this.appCtx.openActivityInvitePopup({
      ownerId: this.ownerId,
      title: this.subtitle
    });
  }

  protected canShowActionMenu(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.canApproveMember(entry) || this.canDeleteMember(entry);
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
    const nextMembers = this.currentOwnerMembers().map(member =>
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
    this.persistMembers(nextMembers);
  }

  protected requestRemoveMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canDeleteMember(entry)) {
      return;
    }
    this.inlineItemActionMenu = null;
    this.pendingDelete = entry;
    this.cdr.markForCheck();
  }

  protected cancelDelete(event?: Event): void {
    event?.stopPropagation();
    this.pendingDelete = null;
    this.cdr.markForCheck();
  }

  protected confirmDelete(event?: Event): void {
    event?.stopPropagation();
    const pendingDelete = this.pendingDelete;
    if (!pendingDelete) {
      return;
    }
    const nextMembers = this.currentOwnerMembers().filter(member => member.id !== pendingDelete.id);
    this.pendingDelete = null;
    this.persistMembers(nextMembers);
  }

  protected pendingDeleteTitle(): string {
    return 'Remove member';
  }

  protected pendingDeleteLabel(): string {
    if (!this.pendingDelete) {
      return '';
    }
    return `Remove ${this.pendingDelete.name} from this event?`;
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

  protected memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
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

  protected memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'Admin' : 'Member';
    }
    return this.pendingStatusLabel(entry);
  }

  protected age(entry: AppTypes.ActivityMemberEntry): number {
    return this.userByIdMap.get(entry.userId)?.age ?? 0;
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
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return 'Invitation Pending';
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

  private openMembersPopup(
    ownerId: string,
    options?: {
      subtitle?: string;
      canManage?: boolean;
    }
  ): void {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this.isOpen = true;
    this.ownerId = normalizedOwnerId;
    this.ownerRecord = null;
    this.title = 'Members';
    this.subtitle = options?.subtitle?.trim() || 'Event';
    this.pendingOnly = false;
    this.pendingDelete = null;
    this.inlineItemActionMenu = null;
    this.selectedMembersVisible = [];
    this.membersCacheByOwnerId.delete(normalizedOwnerId);
    this.resetSummaryState();
    this.canManageMembers = options?.canManage === true;
    this.canShowInviteButton = this.canManageMembers;
    this.syncMembersSmartListQuery();
    this.cdr.markForCheck();

    if (this.openMembersHydrationTimer) {
      clearTimeout(this.openMembersHydrationTimer);
    }
    this.openMembersHydrationTimer = setTimeout(() => {
      this.openMembersHydrationTimer = null;
      if (!this.isOpen || this.ownerId !== normalizedOwnerId) {
        return;
      }

      void this.resolveOwnerPresentation(normalizedOwnerId, options);
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
    this.canManageMembers = this.canManageMembers || options?.canManage === true || record.creatorUserId === this.activeUserId();
    this.canShowInviteButton = this.canManageMembers;
    if (this.acceptedCount <= 0 && this.pendingCount <= 0 && this.capacityTotal <= 0) {
      this.applySummary(record.acceptedMembers, record.pendingMembers, record.capacityTotal);
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
      const loadedMembers = await this.activityMembersService.queryMembersByOwnerId(ownerId);
      members = this.sortMembersByActionTimeDesc(loadedMembers);
      this.membersCacheByOwnerId.set(ownerId, members);
      if (this.isOpen && this.ownerId === ownerId) {
        const summary = this.activityMembersService.peekSummaryByOwnerId(ownerId);
        if (summary) {
          this.applySummary(summary.acceptedMembers, summary.pendingMembers, summary.capacityTotal);
        } else {
          this.applySummaryFromMembers(members);
        }
      }
    }

    const filteredMembers = query.filters?.pendingOnly
      ? members.filter(member => member.status === 'pending')
      : members;
    const pageSize = Math.max(1, Number(query.pageSize) || 16);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: filteredMembers.slice(startIndex, startIndex + pageSize),
      total: filteredMembers.length
    };
  }

  private persistMembers(members: readonly AppTypes.ActivityMemberEntry[]): void {
    if (!this.ownerId) {
      return;
    }
    const normalizedMembers = this.sortMembersByActionTimeDesc(members);
    this.membersCacheByOwnerId.set(this.ownerId, normalizedMembers);
    this.applySummaryFromMembers(normalizedMembers);
    this.pendingDelete = null;
    this.inlineItemActionMenu = null;
    this.syncMembersSmartListQuery();
    this.membersSmartList?.reload();
    void this.activityMembersService.replaceMembersByOwnerId(
      this.ownerId,
      normalizedMembers,
      Math.max(this.acceptedCount, this.capacityTotal)
    );
    this.cdr.markForCheck();
  }

  private currentOwnerMembers(): AppTypes.ActivityMemberEntry[] {
    return [...(this.membersCacheByOwnerId.get(this.ownerId) ?? [])];
  }

  protected canApproveMember(entry: AppTypes.ActivityMemberEntry): boolean {
    return this.canManageMembers
      && entry.status === 'pending'
      && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  protected canDeleteMember(entry: AppTypes.ActivityMemberEntry): boolean {
    if (this.canManageMembers) {
      return true;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  private applySummaryFromMembers(members: readonly AppTypes.ActivityMemberEntry[]): void {
    const acceptedCount = members.filter(member => member.status === 'accepted').length;
    const pendingCount = members.filter(member => member.status === 'pending').length;
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
    if (sync.id !== this.ownerId) {
      return;
    }
    this.membersCacheByOwnerId.delete(sync.id);
    this.applySummary(sync.acceptedMembers, sync.pendingMembers, sync.capacityTotal);
    if (this.isOpen) {
      this.membersSmartList?.reload();
    }
    this.cdr.markForCheck();
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
    this.isMobileView = window.innerWidth <= 860;
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim() || 'u1';
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
}
