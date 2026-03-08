import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface EventSubeventLeaderboardGroup {
  key: string;
  title: string;
  pending: number;
  advancePerGroup: number;
}

interface EventSubeventLeaderboardMember {
  id: string;
  name: string;
  score: number;
  updates: number;
  isAdvance: boolean;
}

interface EventSubeventLeaderboardSelection {
  groupTitle: string;
  rank: number;
  member: EventSubeventLeaderboardMember;
}

@Component({
  selector: 'app-event-subevent-leaderboard-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './event-subevent-leaderboard-popup.component.html',
  styleUrls: ['./event-subevent-leaderboard-popup.component.scss']
})
export class EventSubeventLeaderboardPopupComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Leaderboard';
  @Input() subtitle = 'Stage standings and results';
  @Input() groups: readonly EventSubeventLeaderboardGroup[] = [];

  @Output() readonly close = new EventEmitter<Event>();

  protected openGroups: Record<string, boolean> = {};
  protected selectedMember: EventSubeventLeaderboardSelection | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groups'] || changes['open']) {
      this.resetOpenGroups();
    }
    if (changes['open'] && !this.open) {
      this.selectedMember = null;
    }
  }

  protected toggleGroup(groupKey: string, event: Event): void {
    event.stopPropagation();
    this.openGroups[groupKey] = !this.isGroupOpen(groupKey);
  }

  protected isGroupOpen(groupKey: string): boolean {
    return this.openGroups[groupKey] !== false;
  }

  protected openMember(group: EventSubeventLeaderboardGroup, member: EventSubeventLeaderboardMember, rank: number, event: Event): void {
    event.stopPropagation();
    this.selectedMember = {
      groupTitle: group.title,
      rank,
      member
    };
  }

  protected closeMember(event?: Event): void {
    event?.stopPropagation();
    this.selectedMember = null;
  }

  protected membersForGroup(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardMember[] {
    const pending = Math.max(0, Math.trunc(Number(group.pending) || 0));
    const totalRows = Math.max(6, pending);
    const advanceCount = Math.max(0, Math.trunc(Number(group.advancePerGroup) || 0));

    return Array.from({ length: totalRows }, (_, index) => ({
      id: `${group.key}-member-${index + 1}`,
      name: `Member ${index + 1}`,
      score: 0,
      updates: 0,
      isAdvance: index < pending && index < advanceCount
    }));
  }

  protected hasGroupMembers(group: EventSubeventLeaderboardGroup): boolean {
    return Math.max(0, Math.trunc(Number(group.pending) || 0)) > 0;
  }

  protected trackByGroup(_: number, group: EventSubeventLeaderboardGroup): string {
    return group.key;
  }

  protected trackByMember(_: number, member: EventSubeventLeaderboardMember): string {
    return member.id;
  }

  private resetOpenGroups(): void {
    this.openGroups = this.groups.reduce((acc, group) => {
      acc[group.key] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }
}
