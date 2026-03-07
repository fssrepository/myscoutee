import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventEditorMembersPopupMember } from './event-editor-members-popup.models';

type ActivityInviteSort = 'recent' | 'relevant';

@Component({
  selector: 'app-event-editor-activity-invite-friends-popup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './event-editor-activity-invite-friends-popup.component.html'
})
export class EventEditorActivityInviteFriendsPopupComponent implements OnChanges {
  @Input() open = false;
  @Input() candidates: EventEditorMembersPopupMember[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string[]>();

  protected activityInviteSort: ActivityInviteSort = 'recent';
  protected showActivityInviteSortPicker = false;
  protected selectedActivityInviteUserIds: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true && changes['open']?.previousValue !== true) {
      this.resetInviteState();
    }
    if (changes['candidates']) {
      const candidateIds = new Set(this.candidates.map(candidate => candidate.userId));
      this.selectedActivityInviteUserIds = this.selectedActivityInviteUserIds.filter(id => candidateIds.has(id));
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open || !this.showActivityInviteSortPicker) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.friends-picker-sort') && !target.closest('.popup-view-fab')) {
      this.showActivityInviteSortPicker = false;
    }
  }

  protected onCloseInvite(event?: Event): void {
    event?.stopPropagation();
    this.showActivityInviteSortPicker = false;
    this.close.emit();
  }

  protected canConfirmActivityInviteSelection(): boolean {
    return this.selectedActivityInviteUserIds.length > 0;
  }

  protected confirmActivityInviteSelection(event?: Event): void {
    event?.stopPropagation();
    if (!this.canConfirmActivityInviteSelection()) {
      return;
    }
    this.confirm.emit([...this.selectedActivityInviteUserIds]);
    this.resetInviteState();
  }

  protected toggleActivityInviteSortPicker(event?: Event): void {
    event?.stopPropagation();
    this.showActivityInviteSortPicker = !this.showActivityInviteSortPicker;
  }

  protected selectActivityInviteSort(sort: ActivityInviteSort): void {
    this.activityInviteSort = sort;
    this.showActivityInviteSortPicker = false;
  }

  protected toggleActivityInviteFriend(userId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedActivityInviteUserIds.includes(userId)) {
      this.selectedActivityInviteUserIds = this.selectedActivityInviteUserIds.filter(id => id !== userId);
      return;
    }
    this.selectedActivityInviteUserIds = [...this.selectedActivityInviteUserIds, userId];
  }

  protected isActivityInviteFriendSelected(userId: string): boolean {
    return this.selectedActivityInviteUserIds.includes(userId);
  }

  protected activityInviteMetLabel(entry: EventEditorMembersPopupMember): string {
    const dateText = new Date(entry.metAtIso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `${entry.metWhere} · ${dateText}`;
  }

  protected get activityInviteCandidates(): EventEditorMembersPopupMember[] {
    return [...this.candidates].sort((a, b) => {
      if (this.activityInviteSort === 'relevant' && b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return this.toSortableDate(b.metAtIso) - this.toSortableDate(a.metAtIso);
    });
  }

  protected get selectedActivityInviteChips(): EventEditorMembersPopupMember[] {
    const selected = new Set(this.selectedActivityInviteUserIds);
    return this.activityInviteCandidates.filter(item => selected.has(item.userId));
  }

  protected trackByUserId(_: number, candidate: EventEditorMembersPopupMember): string {
    return candidate.userId;
  }

  private resetInviteState(): void {
    this.activityInviteSort = 'recent';
    this.showActivityInviteSortPicker = false;
    this.selectedActivityInviteUserIds = [];
  }

  private toSortableDate(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const stamp = new Date(value).getTime();
    return Number.isNaN(stamp) ? 0 : stamp;
  }
}
