import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EventEditorActivityInviteFriendsPopupComponent } from './event-editor-activity-invite-friends-popup.component';
import {
  EventEditorActivityMemberRequestKind,
  EventEditorActivityMemberRole,
  EventEditorActivityMemberStatus,
  EventEditorActivityPendingSource,
  EventEditorMembersPopupMember,
  EventEditorMembersPopupRow,
  EventEditorMembersPopupUser
} from './event-editor-members-popup.models';

@Component({
  selector: 'app-event-editor-members-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, EventEditorActivityInviteFriendsPopupComponent],
  templateUrl: './event-editor-members-popup.component.html'
})
export class EventEditorMembersPopupComponent {
  @Input() members: EventEditorMembersPopupMember[] = [];
  @Input() orderedMembers: EventEditorMembersPopupMember[] = [];
  @Input() users: EventEditorMembersPopupUser[] = [];
  @Input() activeUserId = '';
  @Input() membersRow: EventEditorMembersPopupRow | null = null;
  @Input() membersRowId: string | null = null;
  @Input() readOnly = false;
  @Input() isMobileView = false;
  @Input() inviteOpen = false;
  @Input() eventInvitationId: string | null = null;
  @Input() isSubEventAssetContext = false;
  @Input() managerUserIds: string[] = [];

  @Output() approveMember = new EventEmitter<EventEditorMembersPopupMember>();
  @Output() removeMember = new EventEmitter<EventEditorMembersPopupMember>();
  @Output() closeInvite = new EventEmitter<void>();
  @Output() confirmInvite = new EventEmitter<string[]>();

  protected pendingActivityMemberDelete: EventEditorMembersPopupMember | null = null;
  private activityMemberActionMenu: { userId: string; openUp: boolean } | null = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.activityMemberActionMenu) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      this.activityMemberActionMenu = null;
      return;
    }
    if (!target.closest('.subevent-member-action-menu') && !target.closest('.experience-action-menu-trigger')) {
      this.activityMemberActionMenu = null;
    }
  }

  protected trackByMemberId(_: number, member: EventEditorMembersPopupMember): string {
    return member.id;
  }

  protected get membersToRender(): EventEditorMembersPopupMember[] {
    return this.orderedMembers.length > 0 ? this.orderedMembers : this.members;
  }

  protected activityMemberAge(entry: EventEditorMembersPopupMember): number {
    return this.users.find(user => user.id === entry.userId)?.age ?? 0;
  }

  protected activityMemberRoleLabel(entry: EventEditorMembersPopupMember): EventEditorActivityMemberRole {
    return this.activityMemberRole(entry);
  }

  protected activityMemberStatusLabel(entry: EventEditorMembersPopupMember): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return this.isSubEventAssetContext ? 'Waiting For Admin Approval' : 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  protected memberCardStatusIcon(entry: EventEditorMembersPopupMember): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'admin_panel_settings';
      }
      if (role === 'Manager') {
        return 'manage_accounts';
      }
      return 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  protected memberCardStatusClass(entry: EventEditorMembersPopupMember): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'member-status-admin';
      }
      if (role === 'Manager') {
        return 'member-status-manager';
      }
      return 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  protected memberCardToneClass(entry: EventEditorMembersPopupMember): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      if (role === 'Admin') {
        return 'member-card-tone-admin';
      }
      if (role === 'Manager') {
        return 'member-card-tone-manager';
      }
      return 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  protected memberCardStatusLabel(entry: EventEditorMembersPopupMember): string {
    const role = this.activityMemberRole(entry);
    if (entry.status === 'accepted') {
      return role;
    }
    return this.activityMemberStatusLabel(entry);
  }

  protected canShowActivityMemberActionMenu(entry: EventEditorMembersPopupMember): boolean {
    if (this.readOnly) {
      return false;
    }
    return this.canApproveActivityMember(entry) || this.canDeleteActivityMember(entry);
  }

  protected toggleActivityMemberActionMenu(entry: EventEditorMembersPopupMember, event: Event): void {
    event.stopPropagation();
    if (!this.canShowActivityMemberActionMenu(entry)) {
      return;
    }
    if (this.activityMemberActionMenu?.userId === entry.userId) {
      this.activityMemberActionMenu = null;
      return;
    }
    this.activityMemberActionMenu = {
      userId: entry.userId,
      openUp: this.shouldOpenMenuUp(event)
    };
  }

  protected isActivityMemberActionMenuOpen(entry: EventEditorMembersPopupMember): boolean {
    return this.activityMemberActionMenu?.userId === entry.userId;
  }

  protected isActivityMemberActionMenuOpenUp(entry: EventEditorMembersPopupMember): boolean {
    return this.activityMemberActionMenu?.userId === entry.userId && this.activityMemberActionMenu.openUp;
  }

  protected approveActivityMember(entry: EventEditorMembersPopupMember, event?: Event): void {
    event?.stopPropagation();
    if (!this.canApproveActivityMember(entry)) {
      return;
    }
    this.activityMemberActionMenu = null;
    this.approveMember.emit(entry);
  }

  protected removeActivityMember(entry: EventEditorMembersPopupMember, event?: Event): void {
    event?.stopPropagation();
    if (!this.canDeleteActivityMember(entry)) {
      return;
    }
    this.pendingActivityMemberDelete = entry;
    this.activityMemberActionMenu = null;
  }

  protected cancelRemoveActivityMember(): void {
    this.pendingActivityMemberDelete = null;
  }

  protected confirmRemoveActivityMember(): void {
    if (!this.pendingActivityMemberDelete) {
      return;
    }
    this.removeMember.emit(this.pendingActivityMemberDelete);
    this.pendingActivityMemberDelete = null;
  }

  protected pendingActivityMemberDeleteTitle(): string {
    return 'Remove member';
  }

  protected pendingActivityMemberDeleteLabel(): string {
    if (!this.pendingActivityMemberDelete) {
      return '';
    }
    if (this.isSubEventAssetContext) {
      return `Remove ${this.pendingActivityMemberDelete.name} from this asset?`;
    }
    return `Remove ${this.pendingActivityMemberDelete.name} from this event?`;
  }

  protected activityMemberMenuDeleteLabel(entry: EventEditorMembersPopupMember): string {
    if (entry.status === 'accepted') {
      return 'Remove member';
    }
    if (entry.requestKind === 'join') {
      return 'Reject request';
    }
    return 'Delete invitation';
  }

  protected onCloseInvite(): void {
    this.closeInvite.emit();
  }

  protected onConfirmInvite(userIds: string[]): void {
    this.confirmInvite.emit(userIds);
  }

  protected get inviteCandidates(): EventEditorMembersPopupMember[] {
    if (!this.membersRow || !this.membersRowId) {
      return [];
    }
    const existing = new Set(this.members.map(member => member.userId));
    return this.users
      .filter(user => user.id !== this.activeUserId && !existing.has(user.id))
      .map(user => this.toActivityMemberEntry(user, this.membersRow!, this.membersRowId!, {
        status: 'pending',
        pendingSource: this.membersRow?.isAdmin ? 'admin' : 'member',
        invitedByActiveUser: true
      }));
  }

  protected canApproveActivityMember(entry: EventEditorMembersPopupMember): boolean {
    if (this.membersRow?.isAdmin !== true) {
      return false;
    }
    return entry.status === 'pending' && (entry.pendingSource === 'member' || entry.requestKind === 'join');
  }

  protected canDeleteActivityMember(entry: EventEditorMembersPopupMember): boolean {
    if (this.membersRow?.isAdmin === true) {
      return true;
    }
    if (this.eventInvitationId) {
      return false;
    }
    return entry.status === 'pending'
      && entry.requestKind === 'invite'
      && entry.invitedByActiveUser === true;
  }

  private activityMemberRole(entry: EventEditorMembersPopupMember): EventEditorActivityMemberRole {
    if (entry.role === 'Admin') {
      return 'Admin';
    }
    if (entry.role === 'Manager') {
      return 'Manager';
    }
    if (this.managerUserIds.includes(entry.userId)) {
      return 'Manager';
    }
    return 'Member';
  }

  private shouldOpenMenuUp(event: Event): boolean {
    const trigger = event.currentTarget as HTMLElement | null;
    if (!trigger) {
      return false;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const estimatedMenuHeight = 196;
    return rect.bottom + estimatedMenuHeight > viewportHeight;
  }

  private toActivityMemberEntry(
    user: EventEditorMembersPopupUser,
    row: EventEditorMembersPopupRow,
    rowKey: string,
    defaults: { status: EventEditorActivityMemberStatus; pendingSource: EventEditorActivityPendingSource; invitedByActiveUser: boolean }
  ): EventEditorMembersPopupMember {
    const seed = this.hashText(`${rowKey}:${user.id}`);
    const metAt = this.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const metPlaces = ['City Center Meetup', 'Board Game Night', 'Coffee Social', 'Hiking Group', 'Music Event', 'Brunch Table'];
    const place = metPlaces[seed % metPlaces.length];
    const metAtIso = this.toIsoDateTime(metAt);
    const requestKind: EventEditorActivityMemberRequestKind = defaults.status === 'pending' ? 'invite' : null;
    return {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      role: row.isAdmin && user.id === this.activeUserId ? 'Admin' : 'Member',
      status: defaults.status,
      pendingSource: defaults.pendingSource,
      requestKind,
      invitedByActiveUser: defaults.invitedByActiveUser,
      metAtIso,
      actionAtIso: metAtIso,
      metWhere: place,
      relevance: 40 + (seed % 61),
      avatarUrl: user.images?.[0] || `https://i.pravatar.cc/1200?img=${(seed % 70) + 1}`
    };
  }

  private hashText(input: string): number {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toIsoDateTime(value: Date): string {
    const time = value.getTime();
    if (Number.isNaN(time)) {
      return new Date().toISOString();
    }
    return new Date(time).toISOString();
  }
}
