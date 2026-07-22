import {
  CommonModule
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  effect,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  ActivityResourceBuilder,
  AssetDefaultsBuilder,
  ActivityResourcesService,
  EventsService
} from '../../../shared/core';
import type * as AppDTOs from '../../../shared/core/contracts';
import type * as ContractTypes from '../../../shared/core/contracts';
import * as AppConstants from '../../../shared/core/common/constants';
import type { AssetType, SubEventResourceFilter } from '../../../shared/core/common/constants';
import {
  AccordionComponent,
  FormFlowComponent,
  IndicatorComponent,
  PopupComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  type FormFlowControlModel,
  type FormFlowModel,
  type UiAccordionActionMenuSelectEvent,
  type UiAccordionItem,
  type UiAccordionModel,
  type UiAccordionToggleEvent
} from '../../../shared/ui';
import type { EventTournamentGroupsPopupRequest } from '../../../shared/ui/context/stores/event-subevents-popup.store';
import {
  EventTournamentGroupsPopupConverter,
  ActivityChatSingleRowConverter,
  type EventTournamentGroupsAccordionContext,
  type EventTournamentGroupsPopupModel,
  type EventTournamentGroupsStageMenuContext
} from '../../../shared/ui/converters';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  EventSubeventGroupFormPopupComponent
} from '../event-subevent-group-form-popup/event-subevent-group-form-popup.component';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';
import { SubEventResourcePopupStore } from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';

type TournamentGroupsAction =
  | 'add-entry'
  | 'edit-group'
  | 'delete-group'
  | 'members'
  | 'transport'
  | 'accommodation'
  | 'supplies';
type TournamentGroupsHeaderAction = 'add-group';
type TournamentGroupsTab = 'standings' | 'history';
type TournamentLeaderboardMode = 'Score' | 'Fifa';
const TOURNAMENT_RESOURCE_TYPES: readonly AssetType[] = AppConstants.ASSET_TYPES;
const TOURNAMENT_MEMBER_PALETTES: readonly AppMenuPalette[] = [
  'blue',
  'green',
  'amber',
  'violet',
  'cyan',
  'orange',
  'pink',
  'teal'
];

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
    AccordionComponent,
    FormFlowComponent,
    IndicatorComponent,
    PopupComponent,
    EventSubeventGroupFormPopupComponent
  ],
  templateUrl: './event-tournament-groups-popup.component.html',
  styleUrl: './event-tournament-groups-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventTournamentGroupsPopupComponent {
  private readonly eventSubeventsStore = inject(EventSubeventsPopupStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly eventsService = inject(EventsService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly dialogStore = inject(DialogStore);
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
  private handledMembersSyncMs = 0;
  private handledResourceSyncMs = 0;
  private handledResourceMetricsRevision = 0;
  private loadSequence = 0;
  private leaderboardSequence = 0;

  constructor() {
    effect(() => {
      const request = this.eventSubeventsStore.eventTournamentGroupsPopup();
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

    effect(() => {
      const sync = this.activityStore.activityMembersSync();
      if (!sync || sync.updatedMs === this.handledMembersSyncMs) {
        return;
      }
      this.handledMembersSyncMs = sync.updatedMs;
      if (!this.isOpen()) {
        return;
      }
      this.syncGroupMemberSummaryFromSignal(
        sync.id,
        sync.acceptedMembers,
        sync.pendingMembers
      );
    });

    effect(() => {
      const sync = this.activityStore.activityResourceSync();
      if (!sync || sync.updatedMs === this.handledResourceSyncMs) {
        return;
      }
      this.handledResourceSyncMs = sync.updatedMs;
      if (!this.isOpen()) {
        return;
      }
      const match = this.groupResourceScope(sync.ownerId, sync.subEventId);
      if (match) {
        this.syncResourceCountersFromCache(match.stage.subEventId, match.group.id, sync.assetOwnerUserId);
      }
    });

    effect(() => {
      const update = this.resourcePopupStore.subEventResourceMetricsUpdate();
      if (!update || update.revision === this.handledResourceMetricsRevision) {
        return;
      }
      this.handledResourceMetricsRevision = update.revision;
      if (!this.isOpen()) {
        return;
      }
      const match = this.groupResourceScope(update.ownerId, update.subEventId);
      if (!match) {
        return;
      }
      this.state = this.updateGroupResourceMetrics(
        this.state,
        match.stage.subEventId,
        match.group.id,
        {
          [AppConstants.ASSET_TYPE_TRANSPORT]: {
            accepted: Number(update.subEvent.carsAccepted) || 0,
            pending: Number(update.subEvent.carsPending) || 0,
            capacityMin: Number(update.subEvent.carsCapacityMin) || 0,
            capacityMax: Number(update.subEvent.carsCapacityMax) || 0
          },
          [AppConstants.ASSET_TYPE_ACCOMMODATION]: {
            accepted: Number(update.subEvent.accommodationAccepted) || 0,
            pending: Number(update.subEvent.accommodationPending) || 0,
            capacityMin: Number(update.subEvent.accommodationCapacityMin) || 0,
            capacityMax: Number(update.subEvent.accommodationCapacityMax) || 0
          },
          [AppConstants.ASSET_TYPE_SUPPLIES]: {
            accepted: Number(update.subEvent.suppliesAccepted) || 0,
            pending: Number(update.subEvent.suppliesPending) || 0,
            capacityMin: Number(update.subEvent.suppliesCapacityMin) || 0,
            capacityMax: Number(update.subEvent.suppliesCapacityMax) || 0
          }
        }
      );
      this.cdr.markForCheck();
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
    return Boolean(this.eventSubeventsStore.eventTournamentGroupsPopup());
  }

  protected close(): void {
    this.eventSubeventsStore.closeEventTournamentGroupsPopup();
  }

  protected viewModel(): EventTournamentGroupsPopupModel {
    return EventTournamentGroupsPopupConverter.convert({
      state: this.state,
      selectedStageId: this.selectedStageId,
      openGroupIds: this.openGroupIds,
      pendingTotalsByGroupId: this.groupPendingTotals()
    });
  }

  protected tournamentGroupsPopupModel(vm: EventTournamentGroupsPopupModel): PopupModel<unknown> {
    const toolbarControls = this.tournamentGroupsToolbarControls();
    return {
      title: vm.title,
      subtitle: vm.subtitle,
      ariaLabel: vm.title,
      closeAriaLabel: 'Close tournament groups',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerControls: [{
        kind: 'menu',
        id: 'tournament-stage',
        menuKind: 'select',
        trigger: vm.stageTrigger,
        items: vm.stageItems,
        panelAlign: 'end'
      }],
      toolbarControls,
      onClose: () => this.close(),
      onMenuSelect: event => this.onTournamentGroupsPopupMenuSelect(event)
    };
  }

  private tournamentGroupsToolbarControls(): readonly PopupControl<unknown>[] {
    const items = this.headerActionItems();
    if (items.length === 0) {
      return [];
    }
    return [{
      kind: 'menu',
      id: 'tournament-actions',
      align: 'end',
      menuKind: 'inline',
      items,
      closeOnSelect: false
    }];
  }

  private onTournamentGroupsPopupMenuSelect(event: PopupMenuSelectEvent<unknown>): void {
    if (event.control.id === 'tournament-stage') {
      this.onStageSelect(event.itemSelect as AppMenuItemSelectEvent<string, EventTournamentGroupsStageMenuContext>);
      return;
    }
    if (event.control.id === 'tournament-actions') {
      this.onHeaderActionSelect(event.itemSelect as AppMenuItemSelectEvent<string, TournamentGroupsHeaderActionContext>);
    }
  }

  protected accordionModel(
    vm: EventTournamentGroupsPopupModel
  ): UiAccordionModel<string, EventTournamentGroupsAccordionContext, TournamentGroupsActionContext> {
    return {
      ...vm.accordion,
      items: vm.accordion.items.map(item => {
        const accordionItem = item as UiAccordionItem<
          string,
          EventTournamentGroupsAccordionContext,
          TournamentGroupsActionContext
        >;
        const groupId = item.context?.groupId ?? item.id;
        const group = this.groupById(vm.selectedStage, groupId);
        if (!vm.selectedStage || !group) {
          return accordionItem;
        }
        return {
          ...accordionItem,
          actionMenu: {
            kind: 'select',
            trigger: this.groupActionTrigger(vm.selectedStage, group),
            model: this.groupActionModelFor(vm.selectedStage, group),
            panelAlign: 'auto',
            mobileBreakpointPx: 900
          }
        };
      })
    };
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

  protected onAccordionActionSelect(
    event: UiAccordionActionMenuSelectEvent<string, EventTournamentGroupsAccordionContext, TournamentGroupsActionContext>
  ): void {
    this.onGroupActionSelect(event.itemSelect);
  }

  protected groupActionTrigger(
    _stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO
  ): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      counter: null,
      ariaLabel: `Open actions for ${group.name}`
    };
  }

  private groupActionModelFor(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO
  ): AppMenuModel<string, TournamentGroupsActionContext> {
    const contextBase = { stageId: stage.subEventId, groupId: group.id };
    const actionItems: AppMenuItem<string, TournamentGroupsActionContext>[] = [];
    if (this.canManageGroups()) {
      if (this.canAddScoreToStage(stage)) {
        actionItems.push({
          id: 'add-entry',
          label: this.entryActionLabel(stage),
          icon: this.entryActionIcon(stage),
          palette: 'blue',
          context: { ...contextBase, action: 'add-entry' }
        });
      }
      actionItems.push(
        {
          id: 'edit-group',
          label: 'edit',
          icon: 'edit',
          context: { ...contextBase, action: 'edit-group' }
        },
        {
          id: 'delete-group',
          label: 'delete',
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
            this.resourceMenuItem(
              'members',
              'Tagok',
              this.canInviteGroupMembers(group) ? 'group_add' : 'groups',
              'blue',
              contextBase,
              `${group.membersAccepted} / ${group.capacityMin} - ${group.capacityMax}`,
              group.membersPending
            )
          ]
        },
        {
          id: 'assets',
          label: 'Assets',
          items: [
            this.resourceMenuItem('transport', AssetDefaultsBuilder.assetTypeLabel(AppConstants.ASSET_TYPE_TRANSPORT), 'directions_car', 'sky', contextBase, this.resourceMetricLabel(stage.subEventId, group.id, AppConstants.ASSET_TYPE_TRANSPORT), this.resourceMetricPending(stage.subEventId, group.id, AppConstants.ASSET_TYPE_TRANSPORT)),
            this.resourceMenuItem('accommodation', AssetDefaultsBuilder.assetTypeLabel(AppConstants.ASSET_TYPE_ACCOMMODATION), 'apartment', 'green', contextBase, this.resourceMetricLabel(stage.subEventId, group.id, AppConstants.ASSET_TYPE_ACCOMMODATION), this.resourceMetricPending(stage.subEventId, group.id, AppConstants.ASSET_TYPE_ACCOMMODATION)),
            this.resourceMenuItem('supplies', AssetDefaultsBuilder.assetTypeLabel(AppConstants.ASSET_TYPE_SUPPLIES), 'inventory_2', 'brown', contextBase, this.resourceMetricLabel(stage.subEventId, group.id, AppConstants.ASSET_TYPE_SUPPLIES), this.resourceMetricPending(stage.subEventId, group.id, AppConstants.ASSET_TYPE_SUPPLIES))
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
      case 'transport':
        this.openResourcePopup(AppConstants.ASSET_TYPE_TRANSPORT, stage, group, event.sourceEvent);
        return;
      case 'accommodation':
        this.openResourcePopup(AppConstants.ASSET_TYPE_ACCOMMODATION, stage, group, event.sourceEvent);
        return;
      case 'supplies':
        this.openResourcePopup(AppConstants.ASSET_TYPE_SUPPLIES, stage, group, event.sourceEvent);
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
        const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
        if (memberOrder !== 0) {
          return memberOrder;
        }
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
      const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
      if (memberOrder !== 0) {
        return memberOrder;
      }
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
        const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
        if (memberOrder !== 0) {
          return memberOrder;
        }
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
      const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
      if (memberOrder !== 0) {
        return memberOrder;
      }
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

  protected onGroupFormModelChange(model: TournamentGroupFormModel): void {
    const capacityMin = Math.max(0, Math.trunc(Number(model.capacityMin) || 0));
    const capacityMax = Math.max(capacityMin, Math.trunc(Number(model.capacityMax) || capacityMin));
    this.groupForm = {
      name: `${model.name ?? ''}`,
      capacityMin,
      capacityMax
    };
  }

  protected async saveGroupForm(event: Event): Promise<void> {
    event.stopPropagation();
    const stageId = this.groupFormStageId ?? this.viewModel().selectedStage?.subEventId ?? '';
    if (!this.canSaveGroupForm() || !stageId) {
      return;
    }
    this.isMutating = true;
    let reloadLeaderboardStageId: string | null = null;
    try {
      const nextState = await this.eventsService.saveTournamentGroup({
        actorUserId: this.activeUserId(),
        eventId: this.requestEventId(),
        slotId: this.requestSlotId(),
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
        this.leaderboardState = null;
        reloadLeaderboardStageId = stageId;
        await this.loadGroupsForStage(stageId);
        this.emitGroupsUpdate(stageId);
      }
      this.closeGroupForm();
    } finally {
      this.isMutating = false;
      this.cdr.markForCheck();
    }
    if (reloadLeaderboardStageId) {
      void this.loadLeaderboardForStage(reloadLeaderboardStageId);
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

  protected entryFormSubtitle(): string {
    return this.selectedStageMode() === 'Fifa' ? 'Match result' : 'Score update';
  }

  protected tournamentEntryPopupModel(): PopupModel<unknown> {
    const title = this.entryGroupLabel();
    return {
      title,
      subtitle: this.entryFormSubtitle(),
      ariaLabel: title,
      closeAriaLabel: 'Close leaderboard editor',
      closeOnBackdrop: true,
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      bodyLayout: 'overflow',
      backdropTone: 'dim',
      headerControls: [{
        kind: 'menu',
        id: 'tournament-entry-save',
        menuKind: 'inline',
        items: this.entrySaveMenuItems(),
        closeOnSelect: false
      }],
      onClose: event => this.closeEntryForm(event),
      onMenuSelect: event => this.onTournamentEntryPopupMenuSelect(event)
    };
  }

  protected entryMemberTrigger(menu: 'score' | 'home' | 'away'): AppMenuTrigger {
    return {
      label: this.memberNameForEntry(menu),
      icon: 'person',
      palette: this.entryMemberPalette(menu),
      layout: 'field',
      ariaLabel: 'Select member'
    };
  }

  protected leaderboardMemberPalette(
    group: ContractTypes.EventTournamentGroupDTO,
    memberId: string
  ): AppMenuPalette {
    return this.memberPalette(memberId, this.membersForGroup(group));
  }

  protected entryFormFlowModel(): FormFlowModel {
    const isFifa = this.selectedStageMode() === 'Fifa';
    return {
      title: this.entryGroupLabel(),
      subtitle: this.entryFormSubtitle(),
      layout: 'grouped',
      header: false,
      allowMenuOverflow: true,
      summary: { enabled: false },
      completion: { controls: 'required' },
      save: null,
      steps: [
        {
          id: 'entry',
          title: 'Entry',
          controls: isFifa
            ? [
                this.entryMemberControl('home', 'Member A'),
                this.entryMemberControl('away', 'Member B'),
                {
                  id: 'homeScore',
                  bind: 'homeScore',
                  kind: 'number',
                  layout: 'half',
                  label: 'Score A',
                  min: 0,
                  step: 1,
                  placeholder: '0',
                  required: true
                },
                {
                  id: 'awayScore',
                  bind: 'awayScore',
                  kind: 'number',
                  layout: 'half',
                  label: 'Score B',
                  min: 0,
                  step: 1,
                  placeholder: '0',
                  required: true
                },
                this.entryNoteControl()
              ]
            : [
                this.entryMemberControl('score', 'Tag'),
                {
                  id: 'scoreValue',
                  bind: 'scoreValue',
                  kind: 'number',
                  layout: 'half',
                  label: 'Score',
                  step: 1,
                  placeholder: '+3',
                  required: true
                },
                this.entryNoteControl()
              ]
        }
      ]
    };
  }

  protected entrySaveMenuItems(): readonly AppMenuItem<'save-entry'>[] {
    return [{
      id: 'save-entry',
      icon: 'done',
      kind: 'action',
      palette: this.isMutating || this.canSubmitEntry() ? 'success' : 'danger',
      disabled: !this.canSubmitEntry(),
      ariaLabel: 'Save leaderboard entry',
      progress: this.isMutating
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : null
    }];
  }

  private onTournamentEntryPopupMenuSelect(event: PopupMenuSelectEvent<unknown>): void {
    if (event.itemSelect.id === 'save-entry') {
      void this.saveEntryForm(event.itemSelect.sourceEvent);
    }
  }

  protected onEntryFormFlowChange(value: unknown): void {
    const record = this.recordValue(value);
    const members = this.entryMembers();
    const firstMemberId = members[0]?.id ?? '';
    const secondMemberId = members.find(member => member.id !== firstMemberId)?.id ?? firstMemberId;
    const homeMemberId = this.entryMemberIdValue(record['homeMemberId'], firstMemberId);
    let awayMemberId = this.entryMemberIdValue(record['awayMemberId'], secondMemberId);
    if (homeMemberId && homeMemberId === awayMemberId) {
      awayMemberId = members.find(member => member.id !== homeMemberId)?.id ?? '';
    }
    this.entryForm = {
      groupId: this.entryForm.groupId,
      memberId: this.entryMemberIdValue(record['memberId'], firstMemberId),
      scoreValue: this.integerOrNull(record['scoreValue']),
      homeMemberId,
      awayMemberId,
      homeScore: this.integerOrNull(record['homeScore'], true),
      awayScore: this.integerOrNull(record['awayScore'], true),
      note: `${record['note'] ?? ''}`
    };
  }

  private entryMemberControl(menu: 'score' | 'home' | 'away', label: string): FormFlowControlModel {
    const bind = menu === 'score' ? 'memberId' : `${menu}MemberId`;
    return {
      id: bind,
      bind,
      kind: 'menu',
      layout: 'half',
      label,
      required: true,
      config: {
        kind: 'select',
        layout: 'row',
        panelMode: 'auto',
        closeOnSelect: true,
        trigger: this.entryMemberTrigger(menu),
        items: this.entryMemberFlowItems(menu)
      }
    };
  }

  private entryNoteControl(): FormFlowControlModel {
    return {
      id: 'note',
      bind: 'note',
      kind: 'text',
      layout: 'wide',
      label: 'Note',
      placeholder: 'Reason / context'
    };
  }

  private entryMemberFlowItems(menu: 'score' | 'home' | 'away'): readonly AppMenuItem<string, { menu: 'score' | 'home' | 'away'; memberId: string }>[] {
    const selectedId = this.entrySelectedMemberId(menu);
    const members = this.entryMembers();
    return members.map(member => ({
      id: member.id,
      label: member.name,
      icon: 'person',
      kind: 'radio',
      palette: this.memberPalette(member.id, members),
      surface: 'tinted',
      active: member.id === selectedId,
      context: { menu, memberId: member.id }
    }));
  }

  protected canSubmitEntry(): boolean {
    if (!this.canManageGroups() || this.isMutating) {
      return false;
    }
    if (!this.canAddScoreToStage(this.viewModel().selectedStage)) {
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
      canManage: base.canManage === true || loaded.canManage === true,
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
    const request = this.eventSubeventsStore.eventTournamentGroupsPopup();
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

  private syncResourceCountersFromCache(
    stageId: string | null | undefined,
    groupId: string | null | undefined,
    assetOwnerUserId?: string | null
  ): void {
    const normalizedStageId = this.normalizeId(stageId);
    const normalizedGroupId = this.normalizeId(groupId);
    const normalizedAssetOwnerUserId = this.normalizeId(assetOwnerUserId)
      || this.activityResourcesService.activeAssetOwnerUserId();
    if (!normalizedStageId || !normalizedGroupId || !normalizedAssetOwnerUserId) {
      return;
    }
    const ownerId = this.groupMemberOwnerId(normalizedStageId, normalizedGroupId);
    this.applyResourceCounters(
      ownerId,
      normalizedStageId,
      normalizedGroupId,
      normalizedAssetOwnerUserId,
      this.activityResourcesService.peekSubEventResourceState(ownerId, normalizedStageId, normalizedAssetOwnerUserId)
    );
  }

  private applyResourceCounters(
    ownerId: string,
    stageId: string,
    groupId: string,
    assetOwnerUserId: string,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null
  ): void {
    if (ownerId !== this.groupMemberOwnerId(stageId, groupId)
      || assetOwnerUserId !== this.activityResourcesService.activeAssetOwnerUserId()) {
      return;
    }
    if (!state?.resourceMetricsByType) {
      return;
    }
    this.state = this.updateGroupResourceMetrics(
      this.state,
      stageId,
      groupId,
      state.resourceMetricsByType
    );
    this.cdr.markForCheck();
  }

  private resourceMetricLabel(stageId: string, groupId: string, type: AssetType): string {
    const metrics = this.groupById(this.stageById(stageId), groupId)?.resourceMetricsByType?.[type] ?? null;
    if (!metrics) {
      return '0 / 0 - 0';
    }
    return `${metrics.accepted} / ${metrics.capacityMin} - ${metrics.capacityMax}`;
  }

  private resourceMetricPending(stageId: string, groupId: string, type: AssetType): number {
    const metrics = this.groupById(this.stageById(stageId), groupId)?.resourceMetricsByType?.[type] ?? null;
    return Math.max(0, Math.trunc(Number(metrics?.pending) || 0));
  }

  private groupPendingTotals(): Readonly<Record<string, number>> {
    const stage = this.stageById(this.selectedStageId) ?? this.viewModelStageFallback();
    if (!stage) {
      return {};
    }
    return Object.fromEntries(stage.groups.map(group => [group.id, this.groupPendingTotal(stage, group)]));
  }

  private viewModelStageFallback(): ContractTypes.EventTournamentStageDTO | null {
    return this.state?.stages[0] ?? null;
  }

  private groupPendingTotal(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO
  ): number {
    const resourcePending = TOURNAMENT_RESOURCE_TYPES.reduce(
      (total, type) => total + this.resourceMetricPending(stage.subEventId, group.id, type),
      0
    );
    return Math.max(0, Math.trunc(Number(group.membersPending) || 0)) + resourcePending;
  }

  protected canManageGroups(): boolean {
    return this.viewModel().canManage === true;
  }

  private canInviteGroupMembers(group: ContractTypes.EventTournamentGroupDTO): boolean {
    void group;
    return this.canManageGroups();
  }

  private canAddScoreToStage(stage: ContractTypes.EventTournamentStageDTO | null | undefined): boolean {
    return `${stage?.stageStatus ?? ''}`.trim().toUpperCase() === 'SR';
  }

  private activeUserId(): string {
    return this.userProfileStore.activeUserProfile()?.id?.trim() || this.userProfileStore.activeUserId().trim() || this.userProfileStore.getActiveUserId().trim();
  }

  private eventId(): string {
    const request = this.eventSubeventsStore.eventTournamentGroupsPopup();
    return `${request?.slotId ?? request?.eventId ?? ''}`.trim();
  }

  private requestEventId(): string {
    return `${this.eventSubeventsStore.eventTournamentGroupsPopup()?.eventId ?? ''}`.trim();
  }

  private requestSlotId(): string | null {
    const slotId = `${this.eventSubeventsStore.eventTournamentGroupsPopup()?.slotId ?? ''}`.trim();
    return slotId || null;
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

  private entryMemberPalette(menu: 'score' | 'home' | 'away'): AppMenuPalette {
    const members = this.entryMembers();
    return this.memberPalette(this.entrySelectedMemberId(menu), members);
  }

  private memberPalette(
    memberId: string,
    members: readonly ContractTypes.SubEventLeaderboardMember[]
  ): AppMenuPalette {
    const memberIndex = members.findIndex(member => member.id === memberId);
    if (memberIndex >= 0) {
      return TOURNAMENT_MEMBER_PALETTES[memberIndex % TOURNAMENT_MEMBER_PALETTES.length] ?? 'blue';
    }
    const stableIndex = Array.from(`${memberId ?? ''}`).reduce(
      (total, character) => ((total * 31) + (character.codePointAt(0) ?? 0)) >>> 0,
      0
    ) % TOURNAMENT_MEMBER_PALETTES.length;
    return TOURNAMENT_MEMBER_PALETTES[stableIndex] ?? 'blue';
  }

  private memberNameForEntry(menu: 'score' | 'home' | 'away'): string {
    const selectedId = this.entrySelectedMemberId(menu);
    return this.entryMembers().find(member => member.id === selectedId)?.name ?? 'Select member';
  }

  private recordValue(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private entryMemberIdValue(value: unknown, fallback: string): string {
    const memberId = `${value ?? ''}`.trim();
    if (memberId && this.entryMembers().some(member => member.id === memberId)) {
      return memberId;
    }
    return fallback;
  }

  private integerOrNull(value: unknown, nonNegative = false): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const integer = Math.trunc(parsed);
    return nonNegative ? Math.max(0, integer) : integer;
  }

  private normalizeId(value: string | null | undefined): string {
    return `${value ?? ''}`.trim();
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
    this.dialogStore.open({
      title: 'Delete Group',
      message: `Delete ${group.name}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Group delete failed.',
      onConfirm: async () => {
        this.isMutating = true;
        let reloadLeaderboardStageId: string | null = null;
        try {
          const nextState = await this.eventsService.deleteTournamentGroup({
            actorUserId: this.activeUserId(),
            eventId: this.requestEventId(),
            slotId: this.requestSlotId(),
            subEventId: stage.subEventId,
            groupId: group.id
          });
          if (nextState) {
            this.state = this.mergeGroupsState(this.state, nextState);
            this.selectedStageId = stage.subEventId;
            const nextGroup = this.state?.stages.find(item => item.subEventId === stage.subEventId)?.groups[0] ?? null;
            this.selectedGroupId = nextGroup?.id ?? null;
            this.openGroupIds = nextGroup ? [nextGroup.id] : [];
            this.leaderboardState = null;
            reloadLeaderboardStageId = nextGroup ? stage.subEventId : null;
            await this.loadGroupsForStage(stage.subEventId);
            this.emitGroupsUpdate(stage.subEventId);
          }
        } finally {
          this.isMutating = false;
          this.cdr.markForCheck();
        }
        if (reloadLeaderboardStageId) {
          void this.loadLeaderboardForStage(reloadLeaderboardStageId);
        }
      }
    });
  }

  private emitGroupsUpdate(stageId: string): void {
    const groupsCount = this.state?.stages
      .find(stage => stage.subEventId === stageId)?.groups.length ?? 0;
    this.eventSubeventsStore.emitEventTournamentGroupsUpdate({
      eventId: this.requestEventId(),
      slotId: this.requestSlotId(),
      stageId,
      groupsCount
    });
  }

  private openResourcePopup(
    type: SubEventResourceFilter,
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO,
    event?: Event
  ): void {
    event?.stopPropagation();
    const isMembersPopup = type === 'Members';
    const parentTitle = `${this.state?.title ?? ''}`.trim();
    const stageTitle = `${stage.title ?? ''}`.trim();
    const groupLabel = `${group.name ?? ''}`.trim();
    if (isMembersPopup) {
      const memberOwnerId = this.groupMemberOwnerId(stage.subEventId, group.id);
      void this.activitiesStore.ensureEventMembersPopupLoaded();
      this.memberMenuStore.requestActivitiesNavigation({
        type: 'members',
        ownerId: memberOwnerId,
        ownerType: 'group',
        parentOwnerId: this.eventId(),
        parentOwnerType: 'event',
        eventId: this.eventId(),
        subEventId: stage.subEventId,
        subtitle: groupLabel || stageTitle || parentTitle || 'Members',
        canManage: this.canInviteGroupMembers(group),
        viewOnly: !this.canInviteGroupMembers(group),
        acceptedMembers: group.membersAccepted,
        pendingMembers: group.membersPending,
        capacityTotal: group.capacityMax,
        metricIdentity: ActivityChatSingleRowConverter.smartListKeyForIdentity(
          'groupSubEvent',
          memberOwnerId,
          memberOwnerId
        ),
        onMembersChanged: members => this.syncGroupMembersFromPopup(stage.subEventId, group.id, members)
      });
      return;
    }
    this.resourcePopupStore.requestSubEventResourcePopup({
      type,
      ownerId: this.groupMemberOwnerId(stage.subEventId, group.id),
      parentTitle: this.state?.title ?? '',
      subEventId: stage.subEventId,
      popupHeader: {
        title: this.joinDistinctResourcePopupHeaderLabels([parentTitle, stageTitle, groupLabel])
          || parentTitle
          || stageTitle
          || groupLabel
          || 'Event',
        subtitle: ActivityResourceBuilder.assetRequestTimeframeLabel(
          `${stage.startAt ?? ''}`.trim(),
          `${stage.endAt ?? ''}`.trim()
        ) || null
      },
      subEventHeader: {
        name: stage.title,
        title: stage.title,
        description: stage.description,
        location: stage.location,
        startAt: stage.startAt,
        endAt: stage.endAt
      },
      group: {
        id: group.id,
        groupLabel: group.name,
        source: group.source,
        accepted: group.membersAccepted,
        pending: group.membersPending,
        capacityMin: group.capacityMin,
        capacityMax: group.capacityMax,
        canManage: false
      }
    });
  }

  private joinDistinctResourcePopupHeaderLabels(parts: readonly string[]): string {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const part of parts) {
      const value = `${part ?? ''}`.trim();
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) {
        continue;
      }
      seen.add(key);
      labels.push(value);
    }
    return labels.join(' - ');
  }

  private syncGroupMembersFromPopup(
    stageId: string,
    groupId: string,
    members: readonly ContractTypes.ActivityMemberDTO[]
  ): void {
    const acceptedMembers = members.filter(member => member.status === 'accepted');
    const pendingMembers = members.filter(member => member.status === 'pending');
    this.state = this.updateGroupCounts(this.state, stageId, groupId, acceptedMembers.length, pendingMembers.length);
    this.syncLeaderboardMembers(groupId, acceptedMembers);
    this.cdr.markForCheck();
  }

  private syncGroupMemberSummaryFromSignal(
    memberOwnerId: string,
    accepted: number,
    pending: number
  ): void {
    const match = this.state?.stages.flatMap(stage => stage.groups.map(group => ({ stage, group })))
      .find(({ stage, group }) => (
        group.id === memberOwnerId
        || this.groupMemberOwnerId(stage.subEventId, group.id) === memberOwnerId
      )) ?? null;
    if (!match) {
      return;
    }
    this.state = this.updateGroupCounts(
      this.state,
      match.stage.subEventId,
      match.group.id,
      Math.max(0, Math.trunc(Number(accepted) || 0)),
      Math.max(0, Math.trunc(Number(pending) || 0))
    );
    this.cdr.markForCheck();
  }

  private groupMemberOwnerId(stageId: string, groupId: string): string {
    const ownerId = this.eventId();
    const normalizedStageId = this.normalizeId(stageId);
    const normalizedGroupId = this.normalizeId(groupId);
    return ownerId && normalizedStageId && normalizedGroupId
      ? `${ownerId}:${normalizedStageId}:${normalizedGroupId}`
      : normalizedGroupId;
  }

  private groupResourceScope(
    ownerId: string | null | undefined,
    stageId: string | null | undefined
  ): { stage: ContractTypes.EventTournamentStageDTO; group: ContractTypes.EventTournamentGroupDTO } | null {
    const normalizedOwnerId = this.normalizeId(ownerId);
    const normalizedStageId = this.normalizeId(stageId);
    if (!normalizedOwnerId || !normalizedStageId) {
      return null;
    }
    const stage = this.stageById(normalizedStageId);
    const group = stage?.groups.find(item => this.groupMemberOwnerId(normalizedStageId, item.id) === normalizedOwnerId) ?? null;
    return stage && group ? { stage, group } : null;
  }

  private updateGroupCounts(
    state: ContractTypes.EventTournamentGroupsStateDTO | null,
    stageId: string,
    groupId: string,
    accepted: number,
    pending: number
  ): ContractTypes.EventTournamentGroupsStateDTO | null {
    if (!state) {
      return null;
    }
    return {
      ...state,
      stages: state.stages.map(stage => stage.subEventId === stageId
        ? {
            ...stage,
            groups: stage.groups.map(group => group.id === groupId
              ? {
                  ...group,
                  membersAccepted: Math.max(0, accepted),
                  membersPending: Math.max(0, pending)
                }
              : group)
          }
        : stage)
    };
  }

  private updateGroupResourceMetrics(
    state: ContractTypes.EventTournamentGroupsStateDTO | null,
    stageId: string,
    groupId: string,
    metricsByType: Partial<Record<AssetType, AppDTOs.SubEventResourceMetricDTO>>
  ): ContractTypes.EventTournamentGroupsStateDTO | null {
    if (!state) {
      return null;
    }
    const resourceMetricsByType = Object.fromEntries(TOURNAMENT_RESOURCE_TYPES.map(type => {
      const metric = metricsByType[type];
      return [type, {
        accepted: Math.max(0, Math.trunc(Number(metric?.accepted) || 0)),
        pending: Math.max(0, Math.trunc(Number(metric?.pending) || 0)),
        capacityMin: Math.max(0, Math.trunc(Number(metric?.capacityMin) || 0)),
        capacityMax: Math.max(0, Math.trunc(Number(metric?.capacityMax) || 0))
      }];
    }));
    return {
      ...state,
      stages: state.stages.map(stage => stage.subEventId === stageId
        ? {
            ...stage,
            groups: stage.groups.map(group => group.id === groupId
              ? { ...group, resourceMetricsByType }
              : group)
          }
        : stage)
    };
  }

  private syncLeaderboardMembers(
    groupId: string,
    acceptedMembers: readonly ContractTypes.ActivityMemberDTO[]
  ): void {
    if (!this.leaderboardState) {
      return;
    }
    const nextMembers = acceptedMembers
      .map(member => ({
        id: member.userId.trim() || member.id.trim(),
        name: member.name.trim() || 'Member'
      }))
      .filter(member => member.id.length > 0);
    this.leaderboardState = {
      ...this.leaderboardState,
      groups: this.leaderboardState.groups.map(group => group.groupId === groupId
        ? {
            ...group,
            memberCount: nextMembers.length,
            advancingMemberIds: group.advancingMemberIds.filter(memberId => nextMembers.some(member => member.id === memberId)),
            members: nextMembers,
            scoreRows: this.scoreRowsForMembers(nextMembers, group.scoreEntries),
            fifaRows: this.fifaRowsForMembers(nextMembers, group.fifaMatches)
          }
        : group)
    };
  }

  private scoreRowsForMembers(
    members: readonly ContractTypes.SubEventLeaderboardMember[],
    entries: readonly ContractTypes.SubEventLeaderboardScoreEntry[]
  ): ContractTypes.SubEventLeaderboardScoreStandingRow[] {
    const rows = new Map<string, ContractTypes.SubEventLeaderboardScoreStandingRow>();
    for (const member of members) {
      rows.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        total: 0,
        updates: 0
      });
    }
    for (const entry of entries) {
      const row = rows.get(entry.memberId);
      if (!row) {
        continue;
      }
      row.total += Math.trunc(Number(entry.value) || 0);
      row.updates += 1;
    }
    return [...rows.values()].sort((left, right) => {
      const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
      if (memberOrder !== 0) {
        return memberOrder;
      }
      if (left.total !== right.total) {
        return right.total - left.total;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  private fifaRowsForMembers(
    members: readonly ContractTypes.SubEventLeaderboardMember[],
    matches: readonly ContractTypes.SubEventLeaderboardFifaMatch[]
  ): ContractTypes.SubEventLeaderboardFifaStandingRow[] {
    const rows = new Map<string, ContractTypes.SubEventLeaderboardFifaStandingRow>();
    for (const member of members) {
      rows.set(member.id, {
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
      });
    }
    for (const match of matches) {
      const home = rows.get(match.homeMemberId);
      const away = rows.get(match.awayMemberId);
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
      home.goalDiff = home.goalsFor - home.goalsAgainst;
      away.goalDiff = away.goalsFor - away.goalsAgainst;
    }
    return [...rows.values()].sort((left, right) => {
      const memberOrder = this.realMembersFirst(left.memberName, right.memberName);
      if (memberOrder !== 0) {
        return memberOrder;
      }
      if (left.points !== right.points) {
        return right.points - left.points;
      }
      if (left.goalDiff !== right.goalDiff) {
        return right.goalDiff - left.goalDiff;
      }
      return left.memberName.localeCompare(right.memberName);
    });
  }

  private realMembersFirst(leftName: string, rightName: string): number {
    const leftPlaceholder = leftName.trim() === '-----';
    const rightPlaceholder = rightName.trim() === '-----';
    return leftPlaceholder === rightPlaceholder ? 0 : leftPlaceholder ? 1 : -1;
  }

  private openEntryForm(
    stage: ContractTypes.EventTournamentStageDTO,
    group: ContractTypes.EventTournamentGroupDTO,
    event?: Event
  ): void {
    event?.stopPropagation();
    if (!this.canManageGroups() || !this.canAddScoreToStage(stage)) {
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
    description = '0 / 0 - 0',
    pending = 0
  ): AppMenuItem<string, TournamentGroupsActionContext> {
    const pendingCount = Math.max(0, Math.trunc(Number(pending) || 0));
    return {
      id,
      label,
      description,
      icon,
      palette,
      surface: 'tinted',
      layout: 'pill',
      counter: pendingCount > 0
        ? { value: pendingCount, max: 99, ariaLabel: `${pendingCount} pending` }
        : null,
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
