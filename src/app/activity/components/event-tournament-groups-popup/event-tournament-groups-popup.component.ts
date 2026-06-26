import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../shared/app-utils';
import { EventsService } from '../../../shared/core';
import type * as ContractTypes from '../../../shared/core/contracts';
import type { SubEventResourceFilter } from '../../../shared/core/common/constants';
import {
  AccordionComponent,
  AppMenuComponent,
  ProgressIndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  type UiAccordionItem,
  type UiAccordionToggleEvent
} from '../../../shared/ui';
import { AppContext, AppPopupContext } from '../../../shared/ui/context';
import type { EventTournamentGroupsPopupRequest } from '../../../shared/ui/context/app-popup.context';
import {
  EventTournamentGroupsPopupConverter,
  type EventTournamentGroupsAccordionContext,
  type EventTournamentGroupsPopupModel,
  type EventTournamentGroupsStageMenuContext
} from '../../../shared/ui/converters';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { EventSubeventGroupFormPopupComponent } from '../event-subevent-group-form-popup/event-subevent-group-form-popup.component';

type TournamentGroupsAction =
  | 'add-entry'
  | 'edit-group'
  | 'delete-group'
  | 'members'
  | 'car'
  | 'accommodation'
  | 'supplies';
type TournamentGroupsHeaderAction = 'add-group';
type TournamentGroupsTab = 'standings' | 'history';
type TournamentLeaderboardMode = 'Score' | 'Fifa';

interface TournamentGroupsActionContext {
  action: TournamentGroupsAction;
  stageId: string;
  groupId: string;
}

interface TournamentGroupsHeaderActionContext {
  action: TournamentGroupsHeaderAction;
}

interface TournamentGroupFormModel {
  name: string;
  capacityMin: number;
  capacityMax: number;
}

interface TournamentEntryFormModel {
  groupId: string;
  memberId: string;
  scoreValue: number | null;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number | null;
  awayScore: number | null;
  note: string;
}

interface ScoreRow {
  memberId: string;
  memberName: string;
  total: number;
  updates: number;
  isPlaceholder?: boolean;
}

interface FifaRow {
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
  selector: 'app-event-tournament-groups-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    AccordionComponent,
    ProgressIndicatorComponent,
    EventSubeventGroupFormPopupComponent
  ],
  templateUrl: './event-tournament-groups-popup.component.html',
  styleUrl: './event-tournament-groups-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventTournamentGroupsPopupComponent {
  private readonly popupCtx = inject(AppPopupContext);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected state: ContractTypes.EventTournamentGroupsStateDTO | null = null;
  protected selectedStageId: string | null = null;
  protected selectedGroupId: string | null = null;
  protected openGroupIds: string[] = [];
  protected isLoading = false;
  protected isMutating = false;
  protected loadError = '';
  protected leaderboardState: ContractTypes.SubEventLeaderboardState | null = null;
  protected leaderboardLoading = false;
  protected groupTabs: Record<string, TournamentGroupsTab> = {};
  protected detailMemberByGroupId: Record<string, string | null> = {};
  protected showGroupForm = false;
  protected groupFormStageId: string | null = null;
  protected groupFormGroupId: string | null = null;
  protected groupForm: TournamentGroupFormModel = this.emptyGroupForm();
  protected showEntryForm = false;
  protected entryForm: TournamentEntryFormModel = this.emptyEntryForm();

  private handledRequestMs = 0;
  private loadSequence = 0;
  private leaderboardSequence = 0;

  constructor() {
    effect(() => {
      const request = this.popupCtx.eventTournamentGroupsPopup();
      if (!request) {
        this.resetState();
        return;
      }
      if (request.updatedMs === this.handledRequestMs) {
        return;
      }
      this.handledRequestMs = request.updatedMs;
      this.selectedStageId = request.selectedStageId ?? null;
      this.selectedGroupId = request.selectedGroupId ?? null;
      this.openGroupIds = request.selectedGroupId ? [request.selectedGroupId] : [];
      this.state = this.contextState(request);
      this.selectedStageId = this.resolveSelectedStageId(this.selectedStageId);
      this.leaderboardState = null;
      void this.loadGroupsForSelectedStage();
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.isOpen()) {
      return;
    }
    if (this.showEntryForm) {
      this.closeEntryForm(event);
      return;
    }
    if (this.showGroupForm) {
      this.closeGroupForm(event);
      return;
    }
    this.close();
  }

  protected isOpen(): boolean {
    return Boolean(this.popupCtx.eventTournamentGroupsPopup());
  }

  protected close(): void {
    this.popupCtx.closeEventTournamentGroupsPopup();
  }

  protected viewModel(): EventTournamentGroupsPopupModel {
    return EventTournamentGroupsPopupConverter.convert({
      state: this.state,
      selectedStageId: this.selectedStageId,
      openGroupIds: this.openGroupIds
    });
  }

  protected headerActionItems(): readonly AppMenuItem<string, TournamentGroupsHeaderActionContext>[] {
    const canManage = this.viewModel().canManage && Boolean(this.viewModel().selectedStage);
    if (!canManage) {
      return [];
    }
    return [
      {
        id: 'add-group',
        label: 'Add Group',
        icon: 'group_add',
        palette: 'green',
        surface: 'tinted',
        layout: 'action',
        disabled: this.isMutating,
        context: { action: 'add-group' }
      }
    ];
  }

  protected onHeaderActionSelect(event: AppMenuItemSelectEvent<string, TournamentGroupsHeaderActionContext>): void {
    if (event.context?.action !== 'add-group') {
      return;
    }
    const stage = this.viewModel().selectedStage;
    if (!stage || !this.canManageGroups()) {
      return;
    }
    this.openCreateGroupForm(stage, event.sourceEvent);
  }

  protected onStageSelect(event: AppMenuItemSelectEvent<string, EventTournamentGroupsStageMenuContext>): void {
    const stageId = event.context?.stageId ?? event.id;
    if (!stageId || stageId === this.selectedStageId) {
      return;
    }
    this.selectedStageId = stageId;
    this.selectedGroupId = null;
    this.openGroupIds = [];
    this.leaderboardState = null;
    void this.loadGroupsForStage(stageId);
    this.cdr.markForCheck();
  }

  protected onAccordionToggle(event: UiAccordionToggleEvent<string, EventTournamentGroupsAccordionContext>): void {
    const groupId = event.item.context?.groupId ?? event.id;
    this.selectedGroupId = groupId;
    this.openGroupIds = event.open ? [groupId] : [];
    if (event.open && this.selectedStageId && !this.leaderboardState && !this.leaderboardLoading) {
      void this.loadLeaderboardForStage(this.selectedStageId);
    }
    this.cdr.markForCheck();
  }

  protected groupActionTrigger(group: ContractTypes.EventTournamentGroupDTO): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      ariaLabel: `Open actions for ${group.name}`
    };
  }

  protected groupActionModel(
    item: UiAccordionItem<string, EventTournamentGroupsAccordionContext>
  ): AppMenuModel<string, TournamentGroupsActionContext> {
    const stage = this.viewModel().selectedStage;
    const group = this.groupForItem(item);
    if (!stage || !group) {
      return { nodes: [] };
    }
    const contextBase = { stageId: stage.subEventId, groupId: group.id };
    const actionItems: AppMenuItem<string, TournamentGroupsActionContext>[] = [];
    if (this.canManageGroups()) {
      actionItems.push(
        {
          id: 'add-entry',
          label: this.entryActionLabel(stage),
          icon: this.entryActionIcon(stage),
          palette: 'blue',
          context: { ...contextBase, action: 'add-entry' }
        },
        {
          id: 'edit-group',
          label: 'Szerkesztés',
          icon: 'edit',
          context: { ...contextBase, action: 'edit-group' }
        },
        {
          id: 'delete-group',
          label: 'Törlés',
          icon: 'delete',
          palette: 'danger',
          context: { ...contextBase, action: 'delete-group' }
        }
      );
    }
    return {
      nodes: [
        ...(actionItems.length > 0 ? [{ id: 'actions', items: actionItems }] : []),
        {
          id: 'members',
          items: [
            this.resourceMenuItem('members', 'Members', 'groups', 'blue', contextBase, `${group.membersAccepted} / ${group.capacityMin} - ${group.capacityMax}`)
          ]
        },
        {
          id: 'assets',
          label: 'Assets',
          items: [
            this.resourceMenuItem('car', 'Car', 'directions_car', 'sky', contextBase),
            this.resourceMenuItem('accommodation', 'Ingatlan', 'apartment', 'green', contextBase),
            this.resourceMenuItem('supplies', 'Kellékek', 'inventory_2', 'brown', contextBase)
          ]
        }
      ]
    };
  }

  protected onGroupActionSelect(event: AppMenuItemSelectEvent<string, TournamentGroupsActionContext>): void {
    const context = event.context;
    if (!context) {
      return;
    }
    const stage = this.stageById(context.stageId);
    const group = this.groupById(stage, context.groupId);
    if (!stage || !group) {
      return;
    }
    switch (context.action) {
      case 'add-entry':
        this.openEntryForm(stage, group, event.sourceEvent);
        return;
      case 'edit-group':
        this.openEditGroupForm(stage, group, event.sourceEvent);
        return;
      case 'delete-group':
        this.confirmDeleteGroup(stage, group);
        return;
      case 'members':
        this.openResourcePopup('Members', stage, group, event.sourceEvent);
        return;
      case 'car':
        this.openResourcePopup('Car', stage, group, event.sourceEvent);
        return;
      case 'accommodation':
        this.openResourcePopup('Accommodation', stage, group, event.sourceEvent);
        return;
      case 'supplies':
        this.openResourcePopup('Supplies', stage, group, event.sourceEvent);
        return;
    }
  }

  protected selectedStageMode(): TournamentLeaderboardMode {
    const stage = this.viewModel().selectedStage;
    return stage?.leaderboardType === 'Fifa' ? 'Fifa' : 'Score';
  }

  protected tabFor(groupId: string): TournamentGroupsTab {
    return this.groupTabs[groupId] ?? 'standings';
  }

  protected selectTab(groupId: string, tab: TournamentGroupsTab, event?: Event): void {
    event?.stopPropagation();
    this.groupTabs = {
      ...this.groupTabs,
      [groupId]: tab
    };
    this.cdr.markForCheck();
  }

  protected openMemberHistory(groupId: string, memberId: string, event?: Event): void {
    event?.stopPropagation();
    if (!memberId) {
      return;
    }
    this.detailMemberByGroupId = {
      ...this.detailMemberByGroupId,
      [groupId]: memberId
    };
    this.selectTab(groupId, 'history');
  }

  protected scoreRows(group: ContractTypes.EventTournamentGroupDTO): ScoreRow[] {
    const leaderboardGroup = this.leaderboardGroup(group.id);
    if (leaderboardGroup?.scoreRows?.length) {
      return leaderboardGroup.scoreRows.map(row => ({ ...row })).sort((left, right) => {
        if (left.total !== right.total) {
          return right.total - left.total;
        }
        return left.memberName.localeCompare(right.memberName);
      });
    }
    const rows = this.membersForGroup(group).map(member => ({
      memberId: member.id,
      memberName: member.name,
      total: 0,
      updates: 0
    }));
    for (const entry of leaderboardGroup?.scoreEntries ?? []) {
      const row = rows.find(item => item.memberId === entry.memberId);
      if (!row) {
        continue;
      }
      row.total += Math.trunc(Number(entry.value) || 0);
      row.updates += 1;
    }
    return rows.sort((left, right) => {
      if (left.total !== right.total) {
        return right.total - left.total;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  protected fifaRows(group: ContractTypes.EventTournamentGroupDTO): FifaRow[] {
    const leaderboardGroup = this.leaderboardGroup(group.id);
    if (leaderboardGroup?.fifaRows?.length) {
      return leaderboardGroup.fifaRows.map(row => ({ ...row })).sort((left, right) => {
        if (left.points !== right.points) {
          return right.points - left.points;
        }
        if (left.goalDiff !== right.goalDiff) {
          return right.goalDiff - left.goalDiff;
        }
        return left.memberName.localeCompare(right.memberName);
      });
    }
    const rows = this.membersForGroup(group).map(member => ({
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
    }));
    for (const match of leaderboardGroup?.fifaMatches ?? []) {
      const home = rows.find(row => row.memberId === match.homeMemberId);
      const away = rows.find(row => row.memberId === match.awayMemberId);
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
    for (const row of rows) {
      row.goalDiff = row.goalsFor - row.goalsAgainst;
    }
    return rows.sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }
      if (left.goalDiff !== right.goalDiff) {
        return right.goalDiff - left.goalDiff;
      }
      if (left.goalsFor !== right.goalsFor) {
        return right.goalsFor - left.goalsFor;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  protected scoreHistory(group: ContractTypes.EventTournamentGroupDTO): ContractTypes.SubEventLeaderboardScoreEntry[] {
    const selectedMemberId = this.detailMemberByGroupId[group.id] ?? '';
    const entries = this.leaderboardGroup(group.id)?.scoreEntries ?? [];
    return entries
      .filter(entry => !selectedMemberId || entry.memberId === selectedMemberId)
      .map(entry => ({ ...entry }))
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  protected fifaHistory(group: ContractTypes.EventTournamentGroupDTO): ContractTypes.SubEventLeaderboardFifaMatch[] {
    const selectedMemberId = this.detailMemberByGroupId[group.id] ?? '';
    const matches = this.leaderboardGroup(group.id)?.fifaMatches ?? [];
    return matches
      .filter(match => !selectedMemberId || match.homeMemberId === selectedMemberId || match.awayMemberId === selectedMemberId)
      .map(match => ({ ...match }))
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  protected detailMemberName(group: ContractTypes.EventTournamentGroupDTO): string {
    const selectedMemberId = this.detailMemberByGroupId[group.id] ?? '';
    if (!selectedMemberId) {
      return 'All updates';
    }
    return this.memberName(group, selectedMemberId);
  }

  protected memberName(group: ContractTypes.EventTournamentGroupDTO, memberId: string): string {
    return this.membersForGroup(group).find(member => member.id === memberId)?.name ?? 'Member';
  }

  protected isAdvanceRow(group: ContractTypes.EventTournamentGroupDTO, rowIndex: number): boolean {
    const stage = this.viewModel().selectedStage;
    const leaderboardGroup = this.leaderboardGroup(group.id);
    const advancingIds = (leaderboardGroup?.advancingMemberIds ?? []).map(id => id.trim()).filter(Boolean);
    const rows = this.selectedStageMode() === 'Fifa' ? this.fifaRows(group) : this.scoreRows(group);
    const row = rows[rowIndex] ?? null;
    if (row && advancingIds.length > 0) {
      return advancingIds.includes(row.memberId);
    }
    return rowIndex < Math.max(0, Math.trunc(Number(stage?.advancePerGroup) || 0));
  }

  protected scoreValueLabel(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  protected selectedGroupFromItem(item: UiAccordionItem<string, EventTournamentGroupsAccordionContext>): ContractTypes.EventTournamentGroupDTO | null {
    return this.groupForItem(item);
  }

  protected groupFormTitle(): string {
    return this.groupFormGroupId ? 'Edit Group' : 'Create Group';
  }

  protected groupFormStageTitle(): string {
    return this.stageById(this.groupFormStageId)?.title ?? '';
  }

  protected canSaveGroupForm(): boolean {
    return this.canManageGroups() && this.groupForm.name.trim().length > 0 && !this.isMutating;
  }

  protected groupFieldInvalid(): boolean {
    return !this.groupForm.name.trim();
  }

  protected onGroupCapacityMinChange(value: number | string): void {
    const parsed = Number(value);
    const nextMin = Math.max(0, Number.isFinite(parsed) ? Math.trunc(parsed) : this.groupForm.capacityMin);
    this.groupForm = {
      ...this.groupForm,
      capacityMin: nextMin,
      capacityMax: Math.max(nextMin, this.groupForm.capacityMax)
    };
  }

  protected onGroupCapacityMaxChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      return;
    }
    const parsed = Number(value);
    this.groupForm = {
      ...this.groupForm,
      capacityMax: Math.max(this.groupForm.capacityMin, Number.isFinite(parsed) ? Math.trunc(parsed) : this.groupForm.capacityMax)
    };
  }

  protected async saveGroupForm(event: Event): Promise<void> {
    event.stopPropagation();
    const stageId = this.groupFormStageId ?? this.viewModel().selectedStage?.subEventId ?? '';
    if (!this.canSaveGroupForm() || !stageId) {
      return;
    }
    this.isMutating = true;
    try {
      const nextState = await this.eventsService.saveTournamentGroup({
        actorUserId: this.activeUserId(),
        eventId: this.eventId(),
        subEventId: stageId,
        groupId: this.groupFormGroupId,
        name: this.groupForm.name,
        capacityMin: this.groupForm.capacityMin,
        capacityMax: this.groupForm.capacityMax
      });
      if (nextState) {
        this.state = this.mergeGroupsState(this.state, nextState);
        this.selectedStageId = stageId;
        if (this.groupFormGroupId) {
          this.selectedGroupId = this.groupFormGroupId;
          this.openGroupIds = [this.groupFormGroupId];
        } else {
          const added = nextState.stages.find(stage => stage.subEventId === stageId)?.groups
            .find(group => group.name === this.groupForm.name.trim()) ?? null;
          if (added) {
            this.selectedGroupId = added.id;
            this.openGroupIds = [added.id];
          }
        }
      }
      this.closeGroupForm();
      await this.loadLeaderboardForStage(stageId);
    } finally {
      this.isMutating = false;
      this.cdr.markForCheck();
    }
  }

  protected closeGroupForm(event?: Event): void {
    event?.stopPropagation();
    this.showGroupForm = false;
    this.groupFormStageId = null;
    this.groupFormGroupId = null;
    this.groupForm = this.emptyGroupForm();
  }

  protected entryGroupLabel(): string {
    return this.groupById(this.viewModel().selectedStage, this.entryForm.groupId)?.name ?? 'Group';
  }

  protected entryMemberTrigger(menu: 'score' | 'home' | 'away'): AppMenuTrigger {
    return {
      label: this.memberNameForEntry(menu),
      icon: 'person',
      palette: 'blue',
      layout: 'field',
      ariaLabel: 'Select member'
    };
  }

  protected entryMemberItems(menu: 'score' | 'home' | 'away'): readonly AppMenuItem<string, { menu: 'score' | 'home' | 'away'; memberId: string }>[] {
    const selectedId = this.entrySelectedMemberId(menu);
    return this.entryMembers().map(member => ({
      id: `${menu}-${member.id}`,
      label: member.name,
      icon: 'person',
      kind: 'radio',
      active: member.id === selectedId,
      context: { menu, memberId: member.id }
    }));
  }

  protected onEntryMemberSelect(event: AppMenuItemSelectEvent<string, { menu: 'score' | 'home' | 'away'; memberId: string }>): void {
    const context = event.context;
    if (!context) {
      return;
    }
    if (context.menu === 'score') {
      this.entryForm.memberId = context.memberId;
      return;
    }
    if (context.menu === 'home') {
      this.entryForm.homeMemberId = context.memberId;
      if (this.entryForm.awayMemberId === context.memberId) {
        this.entryForm.awayMemberId = this.entryMembers().find(member => member.id !== context.memberId)?.id ?? '';
      }
      return;
    }
    this.entryForm.awayMemberId = context.memberId;
    if (this.entryForm.homeMemberId === context.memberId) {
      this.entryForm.homeMemberId = this.entryMembers().find(member => member.id !== context.memberId)?.id ?? '';
    }
  }

  protected onScoreValueChange(value: number | string | null | undefined): void {
    this.entryForm.scoreValue = value === '' || value === null || value === undefined
      ? null
      : Math.trunc(Number(value) || 0);
  }

  protected onHomeScoreChange(value: number | string | null | undefined): void {
    this.entryForm.homeScore = value === '' || value === null || value === undefined
      ? null
      : Math.max(0, Math.trunc(Number(value) || 0));
  }

  protected onAwayScoreChange(value: number | string | null | undefined): void {
    this.entryForm.awayScore = value === '' || value === null || value === undefined
      ? null
      : Math.max(0, Math.trunc(Number(value) || 0));
  }

  protected canSubmitEntry(): boolean {
    if (!this.canManageGroups() || this.isMutating) {
      return false;
    }
    const members = this.entryMembers();
    if (this.selectedStageMode() === 'Fifa') {
      return members.some(member => member.id === this.entryForm.homeMemberId)
        && members.some(member => member.id === this.entryForm.awayMemberId)
        && this.entryForm.homeMemberId !== this.entryForm.awayMemberId
        && this.entryForm.homeScore !== null
        && this.entryForm.awayScore !== null;
    }
    return members.some(member => member.id === this.entryForm.memberId)
      && this.entryForm.scoreValue !== null;
  }

  protected async saveEntryForm(event: Event): Promise<void> {
    event.stopPropagation();
    const stage = this.viewModel().selectedStage;
    if (!stage || !this.canSubmitEntry()) {
      return;
    }
    this.isMutating = true;
    try {
      const nextLeaderboard = await this.eventsService.upsertSubEventLeaderboardEntry({
        actorUserId: this.activeUserId(),
        eventId: this.eventId(),
        subEventId: stage.subEventId,
        groupId: this.entryForm.groupId,
        mode: this.selectedStageMode(),
        memberId: this.entryForm.memberId,
        scoreValue: this.entryForm.scoreValue,
        note: this.entryForm.note,
        homeMemberId: this.entryForm.homeMemberId,
        awayMemberId: this.entryForm.awayMemberId,
        homeScore: this.entryForm.homeScore,
        awayScore: this.entryForm.awayScore
      });
      if (nextLeaderboard) {
        this.leaderboardState = nextLeaderboard;
      }
      this.closeEntryForm();
    } finally {
      this.isMutating = false;
      this.cdr.markForCheck();
    }
  }

  protected closeEntryForm(event?: Event): void {
    event?.stopPropagation();
    this.showEntryForm = false;
    this.entryForm = this.emptyEntryForm();
  }

  protected trackByGroupId(_: number, item: { id: string } | { groupId: string }): string {
    return 'id' in item ? item.id : item.groupId;
  }

  protected trackByMemberId(_: number, item: { memberId: string }): string {
    return item.memberId;
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  private contextState(request: EventTournamentGroupsPopupRequest): ContractTypes.EventTournamentGroupsStateDTO {
    const eventId = `${request.slotId ?? request.eventId ?? ''}`.trim();
    const stages = request.stages.map((stage, index) => ({
      ...stage,
      subEventId: `${stage.subEventId ?? ''}`.trim() || `stage-${index + 1}`,
      title: `${stage.title ?? ''}`.trim() || `Stage ${index + 1}`,
      description: `${stage.description ?? ''}`.trim(),
      location: `${stage.location ?? ''}`.trim(),
      startAt: `${stage.startAt ?? ''}`.trim(),
      endAt: `${stage.endAt ?? ''}`.trim(),
      stageNumber: Math.max(1, Math.trunc(Number(stage.stageNumber) || index + 1)),
      leaderboardType: stage.leaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      advancePerGroup: Math.max(0, Math.trunc(Number(stage.advancePerGroup) || 0)),
      groups: []
    }));
    return {
      eventId,
      title: request.title?.trim() || 'Groups',
      subtitle: '',
      canManage: request.canManage === true,
      stages
    };
  }

  private resolveSelectedStageId(stageId: string | null | undefined): string | null {
    const requestedId = `${stageId ?? ''}`.trim();
    if (requestedId && this.state?.stages.some(stage => stage.subEventId === requestedId)) {
      return requestedId;
    }
    return this.state?.stages[0]?.subEventId ?? null;
  }

  private stateWithStageGroups(
    state: ContractTypes.EventTournamentGroupsStateDTO | null,
    stageId: string,
    groups: readonly ContractTypes.EventTournamentGroupDTO[]
  ): ContractTypes.EventTournamentGroupsStateDTO | null {
    if (!state) {
      return null;
    }
    return {
      ...state,
      stages: state.stages.map(stage => stage.subEventId === stageId
        ? {
            ...stage,
            groups: groups.map(group => ({ ...group }))
          }
        : stage)
    };
  }

  private mergeGroupsState(
    base: ContractTypes.EventTournamentGroupsStateDTO | null,
    loaded: ContractTypes.EventTournamentGroupsStateDTO | null
  ): ContractTypes.EventTournamentGroupsStateDTO | null {
    if (!base) {
      return loaded;
    }
    if (!loaded) {
      return base;
    }
    const loadedStagesById = new Map(loaded.stages.map(stage => [stage.subEventId, stage]));
    return {
      ...base,
      canManage: loaded.canManage === true,
      stages: base.stages.map(stage => ({
        ...stage,
        groups: loadedStagesById.get(stage.subEventId)?.groups.map(group => ({ ...group })) ?? stage.groups
      }))
    };
  }

  private async loadGroupsForSelectedStage(): Promise<void> {
    const stageId = this.selectedStageId ?? this.viewModel().selectedStage?.subEventId ?? null;
    if (!stageId) {
      return;
    }
    await this.loadGroupsForStage(stageId);
  }

  private async loadGroupsForStage(stageId: string): Promise<void> {
    const request = this.popupCtx.eventTournamentGroupsPopup();
    const eventId = `${request?.eventId ?? ''}`.trim();
    const normalizedStageId = `${stageId ?? ''}`.trim();
    if (!eventId || !normalizedStageId) {
      return;
    }
    const sequence = ++this.loadSequence;
    this.isLoading = true;
    this.loadError = '';
    this.leaderboardState = null;
    this.cdr.markForCheck();
    try {
      const groups = await this.eventsService.queryTournamentStageGroups({
        eventId,
        slotId: request?.slotId ?? null,
        stageId: normalizedStageId
      });
      if (sequence !== this.loadSequence) {
        return;
      }
      this.state = this.stateWithStageGroups(this.state, normalizedStageId, groups);
      this.selectedStageId = normalizedStageId;
      const selectedStage = this.stageById(normalizedStageId);
      if (this.selectedGroupId && selectedStage?.groups.some(group => group.id === this.selectedGroupId)) {
        this.openGroupIds = [this.selectedGroupId];
      } else {
        this.selectedGroupId = null;
        this.openGroupIds = [];
      }
    } catch {
      this.loadError = 'Groups are not available right now.';
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async loadLeaderboardForStage(stageId: string): Promise<void> {
    const eventId = this.eventId();
    if (!eventId || !stageId) {
      return;
    }
    const sequence = ++this.leaderboardSequence;
    this.leaderboardLoading = true;
    this.cdr.markForCheck();
    try {
      const state = await this.eventsService.querySubEventLeaderboard(eventId, stageId).catch(() => null);
      if (sequence !== this.leaderboardSequence || this.selectedStageId !== stageId) {
        return;
      }
      this.leaderboardState = state;
    } finally {
      if (sequence === this.leaderboardSequence) {
        this.leaderboardLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private canManageGroups(): boolean {
    return this.viewModel().canManage === true;
  }

  private activeUserId(): string {
    return this.appCtx.activeUserProfile()?.id?.trim() || this.appCtx.activeUserId().trim() || this.appCtx.getActiveUserId().trim();
  }

  private eventId(): string {
    const request = this.popupCtx.eventTournamentGroupsPopup();
    return `${request?.slotId ?? request?.eventId ?? ''}`.trim();
  }

  private stageById(stageId: string | null | undefined): ContractTypes.EventTournamentStageDTO | null {
    const id = `${stageId ?? ''}`.trim();
    if (!id) {
      return null;
    }
    return this.state?.stages.find(stage => stage.subEventId === id) ?? null;
  }

  private groupById(
    stage: ContractTypes.EventTournamentStageDTO | null | undefined,
    groupId: string | null | undefined
  ): ContractTypes.EventTournamentGroupDTO | null {
    const id = `${groupId ?? ''}`.trim();
    if (!stage || !id) {
      return null;
    }
    return stage.groups.find(group => group.id === id) ?? null;
  }

  private groupForItem(
    item: UiAccordionItem<string, EventTournamentGroupsAccordionContext>
  ): ContractTypes.EventTournamentGroupDTO | null {
    const stage = this.stageById(item.context?.stageId ?? this.selectedStageId);
    return this.groupById(stage, item.context?.groupId ?? item.id);
  }

  private leaderboardGroup(groupId: string): ContractTypes.SubEventLeaderboardGroupState | null {
    return this.leaderboardState?.groups.find(group => group.groupId === groupId) ?? null;
  }

  private membersForGroup(group: ContractTypes.EventTournamentGroupDTO): ContractTypes.SubEventLeaderboardMember[] {
    const leaderboardGroup = this.leaderboardGroup(group.id);
    if (leaderboardGroup?.members?.length) {
      return leaderboardGroup.members.map(member => ({ ...member }));
    }
    const memberCount = Math.max(2, Math.trunc(Number(leaderboardGroup?.memberCount ?? group.capacityMax) || 2));
    return Array.from({ length: memberCount }, (_, index) => ({
      id: `${group.id}-member-${index + 1}`,
      name: `Member ${index + 1}`
    }));
  }

  private entryMembers(): ContractTypes.SubEventLeaderboardMember[] {
    const group = this.groupById(this.viewModel().selectedStage, this.entryForm.groupId);
    return group ? this.membersForGroup(group) : [];
  }

  private entrySelectedMemberId(menu: 'score' | 'home' | 'away'): string {
    switch (menu) {
      case 'home':
        return this.entryForm.homeMemberId;
      case 'away':
        return this.entryForm.awayMemberId;
      case 'score':
      default:
        return this.entryForm.memberId;
    }
  }

  private memberNameForEntry(menu: 'score' | 'home' | 'away'): string {
    const selectedId = this.entrySelectedMemberId(menu);
    return this.entryMembers().find(member => member.id === selectedId)?.name ?? 'Select member';
  }

  private openCreateGroupForm(stage: ContractTypes.EventTournamentStageDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canManageGroups()) {
      return;
    }
    this.groupFormStageId = stage.subEventId;
    this.groupFormGroupId = null;
    this.groupForm = {
      name: this.nextGroupName(stage),
      capacityMin: Math.max(0, Math.trunc(Number(stage.groups[0]?.capacityMin) || 4)),
      capacityMax: Math.max(0, Math.trunc(Number(stage.groups[0]?.capacityMax) || 7))
    };
    this.showGroupForm = true;
  }

  private openEditGroupForm(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO,
    event?: Event
  ): void {
    event?.stopPropagation();
    if (!this.canManageGroups()) {
      return;
    }
    this.groupFormStageId = stage.subEventId;
    this.groupFormGroupId = group.id;
    this.groupForm = {
      name: group.name,
      capacityMin: group.capacityMin,
      capacityMax: group.capacityMax
    };
    this.showGroupForm = true;
  }

  private confirmDeleteGroup(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO
  ): void {
    if (!this.canManageGroups()) {
      return;
    }
    this.confirmationDialog.open({
      title: 'Delete Group',
      message: `Delete ${group.name}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Group delete failed.',
      onConfirm: async () => {
        this.isMutating = true;
        try {
          const nextState = await this.eventsService.deleteTournamentGroup({
            actorUserId: this.activeUserId(),
            eventId: this.eventId(),
            subEventId: stage.subEventId,
            groupId: group.id
          });
          if (nextState) {
            this.state = this.mergeGroupsState(this.state, nextState);
            this.selectedStageId = stage.subEventId;
            const nextGroup = this.state?.stages.find(item => item.subEventId === stage.subEventId)?.groups[0] ?? null;
            this.selectedGroupId = nextGroup?.id ?? null;
            this.openGroupIds = nextGroup ? [nextGroup.id] : [];
          }
          await this.loadLeaderboardForStage(stage.subEventId);
        } finally {
          this.isMutating = false;
          this.cdr.markForCheck();
        }
      }
    });
  }

  private openResourcePopup(
    type: SubEventResourceFilter,
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.eventEditorService.requestSubEventResourcePopup({
      type,
      ownerId: this.eventId(),
      parentTitle: this.state?.title ?? '',
      subEvent: {
        id: stage.subEventId,
        name: stage.title,
        title: stage.title,
        description: stage.description,
        location: stage.location,
        startAt: stage.startAt,
        endAt: stage.endAt,
        groups: stage.groups
      },
      group: {
        id: group.id,
        groupLabel: group.name,
        pending: group.membersPending,
        capacityMin: group.capacityMin,
        capacityMax: group.capacityMax
      }
    });
  }

  private openEntryForm(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO,
    event?: Event
  ): void {
    event?.stopPropagation();
    if (!this.canManageGroups()) {
      return;
    }
    const members = this.membersForGroup(group);
    this.entryForm = {
      groupId: group.id,
      memberId: members[0]?.id ?? '',
      scoreValue: null,
      homeMemberId: members[0]?.id ?? '',
      awayMemberId: members[1]?.id ?? members[0]?.id ?? '',
      homeScore: null,
      awayScore: null,
      note: ''
    };
    this.selectedStageId = stage.subEventId;
    this.selectedGroupId = group.id;
    this.openGroupIds = [group.id];
    this.showEntryForm = true;
  }

  private resourceMenuItem(
    id: TournamentGroupsAction,
    label: string,
    icon: string,
    palette: AppMenuPalette,
    base: { stageId: string; groupId: string },
    description = '0 / 0 - 0'
  ): AppMenuItem<string, TournamentGroupsActionContext> {
    return {
      id,
      label,
      description,
      icon,
      palette,
      surface: 'tinted',
      layout: 'pill',
      context: {
        ...base,
        action: id
      }
    };
  }

  private entryActionLabel(stage: ContractTypes.EventTournamentStageDTO): string {
    return stage.leaderboardType === 'Fifa' ? 'Add Match' : 'Add Score';
  }

  private entryActionIcon(stage: ContractTypes.EventTournamentStageDTO): string {
    return stage.leaderboardType === 'Fifa' ? 'add_circle' : 'add';
  }

  private nextGroupName(stage: ContractTypes.EventTournamentStageDTO): string {
    const index = stage.groups.length;
    return `Group ${String.fromCharCode(65 + (index % 26))}`;
  }

  private emptyGroupForm(): TournamentGroupFormModel {
    return {
      name: '',
      capacityMin: 4,
      capacityMax: 7
    };
  }

  private emptyEntryForm(): TournamentEntryFormModel {
    return {
      groupId: '',
      memberId: '',
      scoreValue: null,
      homeMemberId: '',
      awayMemberId: '',
      homeScore: null,
      awayScore: null,
      note: ''
    };
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.leaderboardSequence += 1;
    this.state = null;
    this.selectedStageId = null;
    this.selectedGroupId = null;
    this.openGroupIds = [];
    this.isLoading = false;
    this.isMutating = false;
    this.loadError = '';
    this.leaderboardState = null;
    this.leaderboardLoading = false;
    this.groupTabs = {};
    this.detailMemberByGroupId = {};
    this.showGroupForm = false;
    this.showEntryForm = false;
  }
}
