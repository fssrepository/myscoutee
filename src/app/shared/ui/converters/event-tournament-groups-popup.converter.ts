import { AppUtils } from '../../app-utils';
import { AssetDefaultsBuilder } from '../../core/base/builders/asset-defaults.builder';
import * as AppConstants from '../../core/common/constants';
import type { AssetType } from '../../core/common/constants';
import type {
  EventTournamentGroupDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentStageDTO
} from '../../core/contracts/event.interface';
import type { UiAccordionItem, UiAccordionModel } from '../components/core/accordion';
import type {
  AppMenuItem,
  AppMenuModel,
  AppMenuPalette,
  AppMenuTrigger
} from '../components/core/menu';
import type { UiConverter } from './converter.types';

export interface EventTournamentGroupsPopupConverterInput {
  state: EventTournamentGroupsStateDTO | null;
  selectedStageId: string | null;
  openGroupIds: readonly string[];
}

export interface EventTournamentGroupsStageMenuContext {
  stageId: string;
}

export interface EventTournamentGroupsAccordionContext {
  groupId: string;
  stageId: string;
}

export type EventTournamentGroupsAction =
  | 'add-entry'
  | 'edit-group'
  | 'delete-group'
  | 'members'
  | 'transport'
  | 'accommodation'
  | 'supplies';

export interface EventTournamentGroupsActionContext {
  action: EventTournamentGroupsAction;
  stageId: string;
  groupId: string;
}

export interface EventTournamentGroupsPopupModel {
  title: string;
  subtitle: string;
  selectedStage: EventTournamentStageDTO | null;
  canManage: boolean;
  stageTrigger: AppMenuTrigger;
  stageItems: readonly AppMenuItem<string, EventTournamentGroupsStageMenuContext>[];
  accordion: UiAccordionModel<
    string,
    EventTournamentGroupsAccordionContext,
    EventTournamentGroupsActionContext
  >;
}

export class EventTournamentGroupsPopupConverter
  implements UiConverter<EventTournamentGroupsPopupConverterInput, EventTournamentGroupsPopupModel> {
  static convert(input: EventTournamentGroupsPopupConverterInput): EventTournamentGroupsPopupModel {
    const state = input.state;
    const stages = state?.stages ?? [];
    const selectedStage = this.selectedStage(stages, input.selectedStageId);
    const openIds = new Set(input.openGroupIds.map(id => id.trim()).filter(Boolean));
    return {
      title: state?.title?.trim() || 'Groups',
      subtitle: selectedStage
        ? this.stageSubtitle(selectedStage)
        : state?.subtitle?.trim() || 'Tournament groups',
      selectedStage,
      canManage: state?.canManage === true,
      stageTrigger: this.stageTrigger(selectedStage),
      stageItems: stages.map(stage => this.stageItem(stage, selectedStage?.subEventId ?? null)),
      accordion: {
        items: selectedStage
          ? selectedStage.groups.map((group, index) => this.groupAccordionItem(
              selectedStage,
              group,
              index,
              openIds,
              state?.canManage === true
            ))
          : [],
        multi: false,
        emptyTitle: selectedStage ? 'No groups yet' : 'No tournament stage',
        emptyDescription: selectedStage ? 'Add a group from the header action.' : 'Select a tournament stage to manage groups.'
      }
    };
  }

  convert(input: EventTournamentGroupsPopupConverterInput): EventTournamentGroupsPopupModel {
    return EventTournamentGroupsPopupConverter.convert(input);
  }

  static stagePalette(stageNumber: number): AppMenuPalette {
    const palettes: AppMenuPalette[] = ['blue', 'green', 'amber', 'violet', 'teal', 'gold'];
    const index = Math.max(0, Math.trunc(Number(stageNumber) || 1) - 1);
    return palettes[index % palettes.length] ?? 'blue';
  }

  static groupPalette(groupIndex: number): AppMenuPalette {
    const palettes: AppMenuPalette[] = ['amber', 'green', 'mint', 'teal'];
    const index = Math.max(0, Math.trunc(Number(groupIndex) || 0));
    return palettes[index % palettes.length] ?? 'amber';
  }

  private static selectedStage(
    stages: readonly EventTournamentStageDTO[],
    selectedStageId: string | null
  ): EventTournamentStageDTO | null {
    const id = `${selectedStageId ?? ''}`.trim();
    if (id) {
      const selected = stages.find(stage => stage.subEventId === id);
      if (selected) {
        return selected;
      }
    }
    return stages[0] ?? null;
  }

  private static stageTrigger(stage: EventTournamentStageDTO | null): AppMenuTrigger {
    const pending = this.stagePendingTotal(stage);
    return {
      label: stage?.title ?? 'Stage',
      icon: 'emoji_events',
      palette: stage ? this.stagePalette(stage.stageNumber) : 'blue',
      layout: 'pill',
      counter: pending > 0
        ? { value: pending, max: 99, ariaLabel: `${pending} pending changes` }
        : null,
      ariaLabel: 'Select stage'
    };
  }

  private static stageItem(
    stage: EventTournamentStageDTO,
    selectedStageId: string | null
  ): AppMenuItem<string, EventTournamentGroupsStageMenuContext> {
    const pending = this.stagePendingTotal(stage);
    return {
      id: stage.subEventId,
      label: stage.title,
      description: this.stageSubtitle(stage),
      icon: 'emoji_events',
      palette: this.stagePalette(stage.stageNumber),
      surface: 'tinted',
      kind: 'radio',
      active: stage.subEventId === selectedStageId,
      counter: pending > 0
        ? { value: pending, max: 99, ariaLabel: `${pending} pending changes` }
        : null,
      counterTone: 'alert',
      context: { stageId: stage.subEventId }
    };
  }

  private static groupAccordionItem(
    stage: EventTournamentStageDTO,
    group: EventTournamentGroupDTO,
    index: number,
    openIds: ReadonlySet<string>,
    canManage: boolean
  ): UiAccordionItem<
    string,
    EventTournamentGroupsAccordionContext,
    EventTournamentGroupsActionContext
  > {
    const capacity = this.groupCapacityLabel(group);
    const accepted = Math.max(0, Math.trunc(Number(group.membersAccepted) || 0));
    const pendingTotal = this.groupPendingTotal(group);
    const memberLabel = accepted === 1 ? '1 member' : `${accepted} members`;
    const pendingLabel = pendingTotal === 1 ? '1 pending' : `${pendingTotal} pending`;
    return {
      id: group.id,
      title: group.name || `Group ${String.fromCharCode(65 + (index % 26))}`,
      subtitle: [
        group.source === 'manual' ? 'Manual' : '',
        memberLabel,
        pendingTotal > 0 ? pendingLabel : ''
      ].filter(Boolean).join(' · '),
      icon: 'groups',
      badges: [
        {
          id: 'members-capacity',
          label: `${accepted} / ${group.capacityMin} - ${group.capacityMax}`,
          palette: this.groupPalette(index),
          ariaLabel: `Members ${accepted} of ${group.capacityMin} to ${group.capacityMax}`,
          title: capacity
        }
      ],
      palette: this.groupPalette(index),
      open: openIds.has(group.id),
      actionMenu: this.groupActionMenu(stage, group, canManage, pendingTotal),
      context: {
        groupId: group.id,
        stageId: stage.subEventId
      }
    };
  }

  private static groupActionMenu(
    stage: EventTournamentStageDTO,
    group: EventTournamentGroupDTO,
    canManage: boolean,
    pendingTotal: number
  ): {
    kind: 'select';
    trigger: AppMenuTrigger;
    model: AppMenuModel<string, EventTournamentGroupsActionContext>;
    panelAlign: 'auto';
    mobileBreakpointPx: number;
  } {
    const contextBase = { stageId: stage.subEventId, groupId: group.id };
    const actions: AppMenuItem<string, EventTournamentGroupsActionContext>[] = [];
    if (canManage) {
      if (`${stage.stageStatus ?? ''}`.trim().toUpperCase() === 'SR') {
        actions.push({
          id: 'add-entry',
          label: stage.leaderboardType === 'Fifa' ? 'Add Match' : 'Add Score',
          icon: stage.leaderboardType === 'Fifa' ? 'add_circle' : 'add',
          palette: 'blue',
          context: { ...contextBase, action: 'add-entry' }
        });
      }
      actions.push(
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
      kind: 'select',
      trigger: {
        icon: 'more_vert',
        closeIcon: 'close',
        hideLabel: true,
        layout: 'icon',
        counter: pendingTotal > 0
          ? { value: pendingTotal, max: 99, ariaLabel: `${pendingTotal} pending changes` }
          : null,
        ariaLabel: `Open actions for ${group.name}`
      },
      model: {
        nodes: [
          ...(actions.length > 0 ? [{ id: 'actions', items: actions }] : []),
          {
            id: 'members',
            items: [
              this.pendingMenuItem(
                'members',
                'Tagok',
                canManage ? 'group_add' : 'groups',
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
            items: AppConstants.ASSET_TYPES.map(type => this.resourceMenuItem(type, group, contextBase))
          }
        ]
      },
      panelAlign: 'auto',
      mobileBreakpointPx: 900
    };
  }

  private static resourceMenuItem(
    type: AssetType,
    group: EventTournamentGroupDTO,
    contextBase: { stageId: string; groupId: string }
  ): AppMenuItem<string, EventTournamentGroupsActionContext> {
    const action = type === AppConstants.ASSET_TYPE_TRANSPORT
      ? 'transport'
      : type === AppConstants.ASSET_TYPE_ACCOMMODATION
        ? 'accommodation'
        : 'supplies';
    const palette: AppMenuPalette = type === AppConstants.ASSET_TYPE_TRANSPORT
      ? 'sky'
      : type === AppConstants.ASSET_TYPE_ACCOMMODATION
        ? 'green'
        : 'brown';
    const metric = group.resourceMetricsByType?.[type];
    const accepted = this.count(metric?.accepted);
    const capacityMin = this.count(metric?.capacityMin);
    const capacityMax = Math.max(capacityMin, this.count(metric?.capacityMax));
    return this.pendingMenuItem(
      action,
      AssetDefaultsBuilder.assetTypeLabel(type),
      AssetDefaultsBuilder.assetTypeIcon(type),
      palette,
      contextBase,
      `${accepted} / ${capacityMin} - ${capacityMax}`,
      metric?.pending
    );
  }

  private static pendingMenuItem(
    id: EventTournamentGroupsAction,
    label: string,
    icon: string,
    palette: AppMenuPalette,
    contextBase: { stageId: string; groupId: string },
    description: string,
    pendingValue: number | null | undefined
  ): AppMenuItem<string, EventTournamentGroupsActionContext> {
    const pending = this.count(pendingValue);
    return {
      id,
      label,
      description,
      icon,
      palette,
      surface: 'tinted',
      layout: 'pill',
      counter: pending > 0
        ? { value: pending, max: 99, ariaLabel: `${pending} pending` }
        : null,
      counterTone: 'alert',
      context: {
        ...contextBase,
        action: id
      }
    };
  }

  static groupPendingTotal(group: EventTournamentGroupDTO | null | undefined): number {
    if (!group) {
      return 0;
    }
    const resourcePending = AppConstants.ASSET_TYPES.reduce(
      (total, type) => total + this.count(group.resourceMetricsByType?.[type]?.pending),
      0
    );
    return this.count(group.membersPending) + resourcePending;
  }

  static stagePendingTotal(stage: EventTournamentStageDTO | null | undefined): number {
    return (stage?.groups ?? []).reduce(
      (total, group) => total + this.groupPendingTotal(group),
      0
    );
  }

  static withResourcePendingDelta(
    state: EventTournamentGroupsStateDTO | null,
    stageId: string,
    groupId: string,
    resourceType: AssetType,
    pendingDelta: number
  ): EventTournamentGroupsStateDTO | null {
    const normalizedStageId = `${stageId ?? ''}`.trim();
    const normalizedGroupId = `${groupId ?? ''}`.trim();
    const delta = Math.trunc(Number(pendingDelta) || 0);
    if (!state || !normalizedStageId || !normalizedGroupId || delta === 0) {
      return state;
    }

    let changed = false;
    const stages = state.stages.map(stage => stage.subEventId === normalizedStageId
      ? {
          ...stage,
          groups: stage.groups.map(group => {
            if (group.id !== normalizedGroupId) {
              return group;
            }
            const current = group.resourceMetricsByType?.[resourceType];
            changed = true;
            return {
              ...group,
              resourceMetricsByType: {
                ...group.resourceMetricsByType,
                [resourceType]: {
                  accepted: this.count(current?.accepted),
                  pending: Math.max(0, this.count(current?.pending) + delta),
                  capacityMin: this.count(current?.capacityMin),
                  capacityMax: this.count(current?.capacityMax)
                }
              }
            };
          })
        }
      : stage);
    return changed ? { ...state, stages } : state;
  }

  private static stageSubtitle(stage: EventTournamentStageDTO): string {
    const range = AppUtils.dateTimeRangeLabel(stage.startAt, stage.endAt, '');
    const groupLabel = stage.groups.length === 1 ? '1 group' : `${stage.groups.length} groups`;
    return [range, groupLabel].filter(Boolean).join(' · ');
  }

  private static groupCapacityLabel(group: EventTournamentGroupDTO): string {
    const min = Math.max(0, Math.trunc(Number(group.capacityMin) || 0));
    const max = Math.max(min, Math.trunc(Number(group.capacityMax) || min));
    return `Capacity ${min} - ${max}`;
  }

  private static count(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}

export const eventTournamentGroupsPopupConverter =
  EventTournamentGroupsPopupConverter satisfies UiConverter<
    EventTournamentGroupsPopupConverterInput,
    EventTournamentGroupsPopupModel
  >;
