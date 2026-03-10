import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

export type EventSubeventLeaderboardMode = 'Score' | 'Fifa';

export interface EventSubeventLeaderboardGroup {
  key: string;
  title: string;
  pending: number;
  advancePerGroup: number;
  memberCount: number;
}

interface EventSubeventLeaderboardMember {
  id: string;
  name: string;
}

interface EventSubeventLeaderboardScoreEntry {
  id: string;
  memberId: string;
  value: number;
  note: string;
  createdAtMs: number;
}

interface EventSubeventLeaderboardFifaMatch {
  id: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number;
  awayScore: number;
  note: string;
  createdAtMs: number;
}

interface EventSubeventLeaderboardFormModel {
  groupId: string;
  memberId: string;
  scoreValue: number | null;
  note: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface EventSubeventLeaderboardScoreRow {
  memberId: string;
  memberName: string;
  total: number;
  updates: number;
  isPlaceholder?: boolean;
}

interface EventSubeventLeaderboardFifaRow {
  memberId: string;
  memberName: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  isPlaceholder?: boolean;
}

@Component({
  selector: 'app-event-subevent-leaderboard-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSelectModule],
  templateUrl: './event-subevent-leaderboard-popup.component.html',
  styleUrls: ['./event-subevent-leaderboard-popup.component.scss']
})
export class EventSubeventLeaderboardPopupComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Leaderboard';
  @Input() subtitle = 'Stage standings and results';
  @Input() readOnly = false;
  @Input() mode: EventSubeventLeaderboardMode = 'Score';
  @Input() groups: readonly EventSubeventLeaderboardGroup[] = [];

  @Output() readonly close = new EventEmitter<Event>();

  protected openGroups: Record<string, boolean> = {};
  protected showEntryForm = false;
  protected editingGroupKey: string | null = null;
  protected form: EventSubeventLeaderboardFormModel = this.defaultForm();

  private readonly membersByGroupKey: Record<string, EventSubeventLeaderboardMember[]> = {};
  private readonly scoreEntriesByGroupKey: Record<string, EventSubeventLeaderboardScoreEntry[]> = {};
  private readonly fifaMatchesByGroupKey: Record<string, EventSubeventLeaderboardFifaMatch[]> = {};
  private readonly detailMemberByGroupKey: Record<string, string | null> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groups']) {
      this.syncGroupsState();
    }

    if (changes['open']) {
      if (this.open) {
        this.resetGroupVisibilityToFirst();
      } else {
        this.showEntryForm = false;
        this.editingGroupKey = null;
      }
    }

    if ((changes['open'] || changes['mode']) && this.showEntryForm) {
      this.syncEntryFormForCurrentGroup();
    }
  }

  protected get resolvedGroups(): readonly EventSubeventLeaderboardGroup[] {
    return this.groups;
  }

  protected trackByGroup(_: number, group: EventSubeventLeaderboardGroup): string {
    return group.key;
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  protected isGroupOpen(groupKey: string): boolean {
    return this.openGroups[groupKey] === true;
  }

  protected toggleGroup(group: EventSubeventLeaderboardGroup, event?: Event): void {
    event?.stopPropagation();
    const current = this.isGroupOpen(group.key);
    for (const entry of this.resolvedGroups) {
      this.openGroups[entry.key] = false;
    }
    this.openGroups[group.key] = !current;
  }

  protected openEntryPopup(group: EventSubeventLeaderboardGroup, event?: Event): void {
    event?.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.editingGroupKey = group.key;
    this.showEntryForm = true;
    this.syncEntryFormForCurrentGroup();
  }

  protected closeEntryPopup(event?: Event): void {
    event?.stopPropagation();
    this.showEntryForm = false;
    this.editingGroupKey = null;
    this.form = this.defaultForm();
  }

  protected entryGroupLabel(): string {
    return this.currentEntryGroup()?.title ?? 'Group';
  }

  protected currentEntryMembers(): EventSubeventLeaderboardMember[] {
    const group = this.currentEntryGroup();
    if (!group) {
      return [];
    }
    return this.membersForGroup(group);
  }

  protected onScoreValueChange(value: number | string | null | undefined): void {
    if (value === '' || value === null || value === undefined) {
      this.form.scoreValue = null;
      return;
    }
    const parsed = Number(value);
    this.form.scoreValue = Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  protected onHomeScoreChange(value: number | string | null | undefined): void {
    if (value === '' || value === null || value === undefined) {
      this.form.homeScore = null;
      return;
    }
    const parsed = Number(value);
    this.form.homeScore = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  protected onAwayScoreChange(value: number | string | null | undefined): void {
    if (value === '' || value === null || value === undefined) {
      this.form.awayScore = null;
      return;
    }
    const parsed = Number(value);
    this.form.awayScore = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  protected onEntryHomeMemberChange(value: string | null | undefined): void {
    const group = this.currentEntryGroup();
    if (!group) {
      return;
    }
    const members = this.membersForGroup(group);
    const nextHome = members.find(member => member.id === value)?.id ?? members[0]?.id ?? '';
    this.form.homeMemberId = nextHome;
    if (this.form.awayMemberId === nextHome) {
      this.form.awayMemberId = members.find(member => member.id !== nextHome)?.id ?? '';
    }
    this.syncFifaFormFromLatestMatch(group);
  }

  protected onEntryAwayMemberChange(value: string | null | undefined): void {
    const group = this.currentEntryGroup();
    if (!group) {
      return;
    }
    const members = this.membersForGroup(group);
    const nextAway = members.find(member => member.id === value)?.id ?? members[1]?.id ?? members[0]?.id ?? '';
    this.form.awayMemberId = nextAway;
    if (this.form.homeMemberId === nextAway) {
      this.form.homeMemberId = members.find(member => member.id !== nextAway)?.id ?? '';
    }
    this.syncFifaFormFromLatestMatch(group);
  }

  protected canSubmitEntry(): boolean {
    const group = this.currentEntryGroup();
    if (!group) {
      return false;
    }
    const members = this.membersForGroup(group);
    if (members.length === 0) {
      return false;
    }

    if (this.mode === 'Score') {
      const validMember = members.some(member => member.id === this.form.memberId);
      return validMember && this.form.scoreValue !== null && Number.isFinite(this.form.scoreValue);
    }

    const validHome = members.some(member => member.id === this.form.homeMemberId);
    const validAway = members.some(member => member.id === this.form.awayMemberId);
    return validHome
      && validAway
      && this.form.homeMemberId !== this.form.awayMemberId
      && this.form.homeScore !== null
      && this.form.awayScore !== null
      && Number.isFinite(this.form.homeScore)
      && Number.isFinite(this.form.awayScore)
      && this.form.homeScore >= 0
      && this.form.awayScore >= 0;
  }

  protected saveEntryFromPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.canSubmitEntry()) {
      return;
    }
    this.saveEntry();
    this.closeEntryPopup();
  }

  protected openMemberDetails(group: EventSubeventLeaderboardGroup, memberId: string, event?: Event): void {
    event?.stopPropagation();
    if (!memberId) {
      return;
    }
    this.detailMemberByGroupKey[group.key] = memberId;
  }

  protected closeMemberDetails(group: EventSubeventLeaderboardGroup, event?: Event): void {
    event?.stopPropagation();
    this.detailMemberByGroupKey[group.key] = null;
  }

  protected hasMemberDetails(group: EventSubeventLeaderboardGroup): boolean {
    return Boolean(this.detailMemberByGroupKey[group.key]);
  }

  protected detailMemberName(group: EventSubeventLeaderboardGroup): string {
    const memberId = this.detailMemberByGroupKey[group.key];
    if (!memberId) {
      return 'Member';
    }
    return this.memberName(group, memberId);
  }

  protected scoreHistory(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardScoreEntry[] {
    const selectedMemberId = this.detailMemberByGroupKey[group.key];
    if (!selectedMemberId) {
      return [];
    }
    return this.scoreEntriesForGroup(group)
      .filter(entry => entry.memberId === selectedMemberId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  protected fifaHistory(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardFifaMatch[] {
    const selectedMemberId = this.detailMemberByGroupKey[group.key];
    if (!selectedMemberId) {
      return [];
    }
    return this.fifaMatchesForGroup(group)
      .filter(match => match.homeMemberId === selectedMemberId || match.awayMemberId === selectedMemberId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  protected scoreValueLabel(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  protected scoreRows(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardScoreRow[] {
    const members = this.membersForGroup(group);
    const filledMemberCount = this.assignedMemberCount(group, members.length);
    const lookup = new Map<string, EventSubeventLeaderboardScoreRow>();
    const activeRows: EventSubeventLeaderboardScoreRow[] = [];
    const placeholderRows: EventSubeventLeaderboardScoreRow[] = [];

    members.forEach((member, index) => {
      if (index < filledMemberCount) {
        const row: EventSubeventLeaderboardScoreRow = {
          memberId: member.id,
          memberName: member.name,
          total: 0,
          updates: 0
        };
        lookup.set(member.id, row);
        activeRows.push(row);
        return;
      }
      placeholderRows.push({
        memberId: '',
        memberName: '',
        total: 0,
        updates: 0,
        isPlaceholder: true
      });
    });

    if (activeRows.length === 0) {
      return placeholderRows;
    }

    for (const entry of this.scoreEntriesForGroup(group)) {
      const row = lookup.get(entry.memberId);
      if (!row) {
        continue;
      }
      row.total += entry.value;
      row.updates += 1;
    }

    const sortedRows = [...activeRows].sort((a, b) => {
      if (a.total !== b.total) {
        return b.total - a.total;
      }
      return a.memberName.localeCompare(b.memberName);
    });

    return [...sortedRows, ...placeholderRows];
  }

  protected fifaRows(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardFifaRow[] {
    const members = this.membersForGroup(group);
    const filledMemberCount = this.assignedMemberCount(group, members.length);
    const lookup = new Map<string, EventSubeventLeaderboardFifaRow>();
    const activeRows: EventSubeventLeaderboardFifaRow[] = [];
    const placeholderRows: EventSubeventLeaderboardFifaRow[] = [];

    members.forEach((member, index) => {
      if (index < filledMemberCount) {
        const row: EventSubeventLeaderboardFifaRow = {
          memberId: member.id,
          memberName: member.name,
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0
        };
        lookup.set(member.id, row);
        activeRows.push(row);
        return;
      }
      placeholderRows.push({
        memberId: '',
        memberName: '',
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        isPlaceholder: true
      });
    });

    if (activeRows.length === 0) {
      return placeholderRows;
    }

    for (const match of this.fifaMatchesForGroup(group)) {
      const home = lookup.get(match.homeMemberId);
      const away = lookup.get(match.awayMemberId);
      if (!home || !away) {
        continue;
      }

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    for (const row of activeRows) {
      row.goalDiff = row.goalsFor - row.goalsAgainst;
    }

    const sortedRows = [...activeRows].sort((a, b) => {
      if (a.points !== b.points) {
        return b.points - a.points;
      }
      if (a.goalDiff !== b.goalDiff) {
        return b.goalDiff - a.goalDiff;
      }
      if (a.goalsFor !== b.goalsFor) {
        return b.goalsFor - a.goalsFor;
      }
      return a.memberName.localeCompare(b.memberName);
    });

    return [...sortedRows, ...placeholderRows];
  }

  protected isAdvanceRow(group: EventSubeventLeaderboardGroup, rowIndex: number): boolean {
    return rowIndex < this.toNonNegativeInt(group.advancePerGroup);
  }

  protected memberName(group: EventSubeventLeaderboardGroup, memberId: string): string {
    const member = this.membersForGroup(group).find(entry => entry.id === memberId);
    return member?.name ?? 'Member';
  }

  private saveEntry(): void {
    const group = this.currentEntryGroup();
    if (!group) {
      return;
    }

    if (this.mode === 'Score') {
      const nextValue = Number(this.form.scoreValue);
      const entry: EventSubeventLeaderboardScoreEntry = {
        id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        memberId: this.form.memberId,
        value: Number.isFinite(nextValue) ? Math.trunc(nextValue) : 0,
        note: this.form.note.trim(),
        createdAtMs: Date.now()
      };
      this.scoreEntriesByGroupKey[group.key] = [...this.scoreEntriesForGroup(group), entry];
      this.form.scoreValue = null;
      this.form.note = '';
      return;
    }

    const homeMemberId = this.form.homeMemberId;
    const awayMemberId = this.form.awayMemberId;
    const matches = [...this.fifaMatchesForGroup(group)];
    const pairKey = this.matchPairKey(homeMemberId, awayMemberId);
    const existingIndex = matches.findIndex(
      match => this.matchPairKey(match.homeMemberId, match.awayMemberId) === pairKey
    );

    const nextMatch: EventSubeventLeaderboardFifaMatch = {
      id: existingIndex >= 0
        ? matches[existingIndex]?.id ?? `fifa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        : `fifa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      homeMemberId,
      awayMemberId,
      homeScore: Math.max(0, Number.isFinite(Number(this.form.homeScore)) ? Math.trunc(Number(this.form.homeScore)) : 0),
      awayScore: Math.max(0, Number.isFinite(Number(this.form.awayScore)) ? Math.trunc(Number(this.form.awayScore)) : 0),
      note: this.form.note.trim(),
      createdAtMs: Date.now()
    };

    if (existingIndex >= 0) {
      matches[existingIndex] = nextMatch;
    } else {
      matches.push(nextMatch);
    }

    this.fifaMatchesByGroupKey[group.key] = matches;
    this.form.homeScore = null;
    this.form.awayScore = null;
    this.form.note = '';
  }

  private syncGroupsState(): void {
    const keys = new Set(this.resolvedGroups.map(group => group.key));

    for (const key of Object.keys(this.membersByGroupKey)) {
      if (!keys.has(key)) {
        delete this.membersByGroupKey[key];
      }
    }
    for (const key of Object.keys(this.scoreEntriesByGroupKey)) {
      if (!keys.has(key)) {
        delete this.scoreEntriesByGroupKey[key];
      }
    }
    for (const key of Object.keys(this.fifaMatchesByGroupKey)) {
      if (!keys.has(key)) {
        delete this.fifaMatchesByGroupKey[key];
      }
    }
    for (const key of Object.keys(this.detailMemberByGroupKey)) {
      if (!keys.has(key)) {
        delete this.detailMemberByGroupKey[key];
      }
    }
    for (const key of Object.keys(this.openGroups)) {
      if (!keys.has(key)) {
        delete this.openGroups[key];
      }
    }

    for (const group of this.resolvedGroups) {
      this.ensureMembersForGroup(group);
      if (this.detailMemberByGroupKey[group.key]) {
        const members = this.membersForGroup(group);
        const selected = this.detailMemberByGroupKey[group.key];
        if (!members.some(member => member.id === selected)) {
          this.detailMemberByGroupKey[group.key] = null;
        }
      }
    }

    if (this.editingGroupKey && !keys.has(this.editingGroupKey)) {
      this.showEntryForm = false;
      this.editingGroupKey = null;
      this.form = this.defaultForm();
    }
  }

  private ensureMembersForGroup(group: EventSubeventLeaderboardGroup): void {
    const targetCount = this.groupMemberCount(group);
    const existing = this.membersByGroupKey[group.key] ?? [];
    if (existing.length === targetCount) {
      this.membersByGroupKey[group.key] = existing.map((member, index) => ({
        ...member,
        name: `Member ${index + 1}`
      }));
      return;
    }

    this.membersByGroupKey[group.key] = Array.from({ length: targetCount }, (_, index) => ({
      id: `${group.key}-m-${index + 1}`,
      name: `Member ${index + 1}`
    }));
  }

  private resetGroupVisibilityToFirst(): void {
    this.openGroups = {};
    this.resolvedGroups.forEach((group, index) => {
      this.openGroups[group.key] = index === 0;
    });
  }

  private groupMemberCount(group: EventSubeventLeaderboardGroup): number {
    const explicit = this.toNonNegativeInt(group.memberCount);
    if (explicit > 0) {
      return Math.max(2, explicit);
    }
    const pending = this.toNonNegativeInt(group.pending);
    return Math.max(2, Math.max(6, pending));
  }

  private membersForGroup(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardMember[] {
    this.ensureMembersForGroup(group);
    return this.membersByGroupKey[group.key] ?? [];
  }

  private scoreEntriesForGroup(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardScoreEntry[] {
    return this.scoreEntriesByGroupKey[group.key] ?? [];
  }

  private fifaMatchesForGroup(group: EventSubeventLeaderboardGroup): EventSubeventLeaderboardFifaMatch[] {
    return [...(this.fifaMatchesByGroupKey[group.key] ?? [])]
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  private assignedMemberCount(group: EventSubeventLeaderboardGroup, capacity: number): number {
    const safeCapacity = Math.max(0, Math.trunc(capacity));
    if (safeCapacity <= 0) {
      return 0;
    }

    const pending = this.toNonNegativeInt(group.pending);
    const referenced = this.referencedMemberCount(group);
    const next = Math.max(pending, referenced);
    return Math.max(0, Math.min(safeCapacity, next));
  }

  private referencedMemberCount(group: EventSubeventLeaderboardGroup): number {
    const members = this.membersForGroup(group);
    const memberIds = new Set<string>(members.map(member => member.id));
    const referenced = new Set<string>();

    for (const entry of this.scoreEntriesForGroup(group)) {
      if (memberIds.has(entry.memberId)) {
        referenced.add(entry.memberId);
      }
    }
    for (const match of this.fifaMatchesForGroup(group)) {
      if (memberIds.has(match.homeMemberId)) {
        referenced.add(match.homeMemberId);
      }
      if (memberIds.has(match.awayMemberId)) {
        referenced.add(match.awayMemberId);
      }
    }

    return referenced.size;
  }

  private currentEntryGroup(): EventSubeventLeaderboardGroup | null {
    if (!this.editingGroupKey) {
      return null;
    }
    return this.resolvedGroups.find(group => group.key === this.editingGroupKey) ?? null;
  }

  private syncEntryFormForCurrentGroup(): void {
    this.form = this.defaultForm();

    const group = this.currentEntryGroup();
    if (!group) {
      return;
    }

    const members = this.membersForGroup(group);
    const firstId = members[0]?.id ?? '';

    this.form.memberId = firstId;
    this.form.homeMemberId = firstId;
    this.form.awayMemberId = members.find(member => member.id !== firstId)?.id ?? firstId;

    this.syncFifaFormFromLatestMatch(group);
  }

  private syncFifaFormFromLatestMatch(group: EventSubeventLeaderboardGroup): void {
    if (this.mode !== 'Fifa') {
      return;
    }

    const homeMemberId = this.form.homeMemberId;
    const awayMemberId = this.form.awayMemberId;
    if (!homeMemberId || !awayMemberId || homeMemberId === awayMemberId) {
      this.form.homeScore = null;
      this.form.awayScore = null;
      this.form.note = '';
      return;
    }

    const pairKey = this.matchPairKey(homeMemberId, awayMemberId);
    const latestMatch = this.fifaMatchesForGroup(group).find(
      match => this.matchPairKey(match.homeMemberId, match.awayMemberId) === pairKey
    );

    if (!latestMatch) {
      this.form.homeScore = null;
      this.form.awayScore = null;
      this.form.note = '';
      return;
    }

    const isSameOrder = latestMatch.homeMemberId === homeMemberId && latestMatch.awayMemberId === awayMemberId;
    this.form.homeScore = isSameOrder ? latestMatch.homeScore : latestMatch.awayScore;
    this.form.awayScore = isSameOrder ? latestMatch.awayScore : latestMatch.homeScore;
    this.form.note = latestMatch.note ?? '';
  }

  private matchPairKey(memberAId: string, memberBId: string): string {
    const pair = [memberAId, memberBId].sort((a, b) => a.localeCompare(b));
    return `${pair[0]}::${pair[1]}`;
  }

  private toNonNegativeInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private defaultForm(): EventSubeventLeaderboardFormModel {
    return {
      groupId: '',
      memberId: '',
      scoreValue: null,
      note: '',
      homeMemberId: '',
      awayMemberId: '',
      homeScore: null,
      awayScore: null
    };
  }
}
