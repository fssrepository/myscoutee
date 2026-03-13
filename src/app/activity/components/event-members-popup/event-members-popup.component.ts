import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type * as AppTypes from '../../../shared/app-types';

export interface EventMembersPopupPresenter {
  toneClass(entry: AppTypes.ActivityMemberEntry): string;
  statusClass(entry: AppTypes.ActivityMemberEntry): string;
  statusLabel(entry: AppTypes.ActivityMemberEntry): string;
  statusIcon(entry: AppTypes.ActivityMemberEntry): string;
  age(entry: AppTypes.ActivityMemberEntry): number;
  roleLabel(entry: AppTypes.ActivityMemberEntry): string;
  pendingStatusLabel(entry: AppTypes.ActivityMemberEntry): string;
  canShowActionMenu(entry: AppTypes.ActivityMemberEntry): boolean;
  isActionMenuOpen(entry: AppTypes.ActivityMemberEntry): boolean;
  isActionMenuOpenUp(entry: AppTypes.ActivityMemberEntry): boolean;
  canApprove(entry: AppTypes.ActivityMemberEntry): boolean;
  canDelete(entry: AppTypes.ActivityMemberEntry): boolean;
  deleteLabel(entry: AppTypes.ActivityMemberEntry): string;
  canEditRole(entry: AppTypes.ActivityMemberEntry): boolean;
  roleIcon(entry: AppTypes.ActivityMemberEntry): string;
  roleMenuLabel(entry: AppTypes.ActivityMemberEntry): string;
  isRolePickerOpen(entry: AppTypes.ActivityMemberEntry): boolean;
}

export interface EventMembersPopupActionMenuEvent {
  entry: AppTypes.ActivityMemberEntry;
  event: Event;
}

export interface EventMembersPopupRoleEvent {
  entry: AppTypes.ActivityMemberEntry;
  event: Event;
}

export interface EventMembersPopupRoleSelectionEvent {
  entry: AppTypes.ActivityMemberEntry;
  role: AppTypes.ActivityMemberRole;
  event: Event;
}

@Component({
  selector: 'app-event-members-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './event-members-popup.component.html',
  styleUrls: ['./event-members-popup.component.scss']
})
export class EventMembersPopupComponent {
  @Input() title = 'Members';
  @Input() subtitle = 'Event';
  @Input() summaryLabel = '';
  @Input() pendingOnly = false;
  @Input() pendingCount = 0;
  @Input() canShowInviteButton = false;
  @Input() isMobileView = false;
  @Input() members: ReadonlyArray<AppTypes.ActivityMemberEntry> = [];
  @Input() pendingDelete: AppTypes.ActivityMemberEntry | null = null;
  @Input() pendingDeleteTitle = 'Remove member';
  @Input() pendingDeleteLabel = '';
  @Input() presenter!: EventMembersPopupPresenter;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly invite = new EventEmitter<void>();
  @Output() readonly togglePendingOnly = new EventEmitter<void>();
  @Output() readonly toggleMemberActionMenu = new EventEmitter<EventMembersPopupActionMenuEvent>();
  @Output() readonly approveMember = new EventEmitter<AppTypes.ActivityMemberEntry>();
  @Output() readonly removeMember = new EventEmitter<AppTypes.ActivityMemberEntry>();
  @Output() readonly toggleRolePicker = new EventEmitter<EventMembersPopupRoleEvent>();
  @Output() readonly setMemberRole = new EventEmitter<EventMembersPopupRoleSelectionEvent>();
  @Output() readonly cancelDelete = new EventEmitter<void>();
  @Output() readonly confirmDelete = new EventEmitter<void>();

  protected trackByMember(_: number, entry: AppTypes.ActivityMemberEntry): string {
    return entry.id;
  }

  protected handleInvite(event: Event): void {
    event.stopPropagation();
    this.invite.emit();
  }

  protected handleTogglePendingOnly(event: Event): void {
    event.stopPropagation();
    this.togglePendingOnly.emit();
  }

  protected handleClose(event?: Event): void {
    event?.stopPropagation();
    this.close.emit();
  }

  protected handleToggleMemberActionMenu(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    this.toggleMemberActionMenu.emit({ entry, event });
  }

  protected handleApproveMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    this.approveMember.emit(entry);
  }

  protected handleRemoveMember(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    this.removeMember.emit(entry);
  }

  protected handleToggleRolePicker(entry: AppTypes.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    this.toggleRolePicker.emit({ entry, event });
  }

  protected handleSetMemberRole(entry: AppTypes.ActivityMemberEntry, role: AppTypes.ActivityMemberRole, event: Event): void {
    event.stopPropagation();
    this.setMemberRole.emit({ entry, role, event });
  }

  protected handleCancelDelete(event?: Event): void {
    event?.stopPropagation();
    this.cancelDelete.emit();
  }

  protected handleConfirmDelete(event?: Event): void {
    event?.stopPropagation();
    this.confirmDelete.emit();
  }
}
