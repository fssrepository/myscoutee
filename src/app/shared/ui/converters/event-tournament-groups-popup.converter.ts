import { AppUtils } from '../../app-utils';
import type {
  EventTournamentGroupDTO,
  EventTournamentGroupsStateDTO,
  EventTournamentStageDTO
} from '../../core/contracts/event.interface';
import type { UiAccordionItem, UiAccordionModel } from '../components/accordion';
import type { AppMenuItem, AppMenuPalette, AppMenuTrigger } from '../components/menu';
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

export interface EventTournamentGroupsPopupModel {
  title: string;
  subtitle: string;
  selectedStage: EventTournamentStageDTO | null;
  canManage: boolean;
  stageTrigger: AppMenuTrigger;
  stageItems: readonly AppMenuItem<string, EventTournamentGroupsStageMenuContext>[];
  accordion: UiAccordionModel<string, EventTournamentGroupsAccordionContext>;
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
          ? selectedStage.groups.map((group, index) => this.groupAccordionItem(selectedStage, group, index, openIds))
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
    return {
      label: stage?.title ?? 'Stage',
      icon: 'emoji_events',
      palette: stage ? this.stagePalette(stage.stageNumber) : 'blue',
      layout: 'pill',
      ariaLabel: 'Select stage'
    };
  }

  private static stageItem(
    stage: EventTournamentStageDTO,
    selectedStageId: string | null
  ): AppMenuItem<string, EventTournamentGroupsStageMenuContext> {
    return {
      id: stage.subEventId,
      label: stage.title,
      description: this.stageSubtitle(stage),
      icon: 'emoji_events',
      palette: this.stagePalette(stage.stageNumber),
      surface: 'tinted',
      kind: 'radio',
      active: stage.subEventId === selectedStageId,
      counter: stage.groups.length > 0 ? { value: stage.groups.length, max: 99 } : null,
      context: { stageId: stage.subEventId }
    };
  }

  private static groupAccordionItem(
    stage: EventTournamentStageDTO,
    group: EventTournamentGroupDTO,
    index: number,
    openIds: ReadonlySet<string>
  ): UiAccordionItem<string, EventTournamentGroupsAccordionContext> {
    const capacity = this.groupCapacityLabel(group);
    return {
      id: group.id,
      title: group.name || `Group ${String.fromCharCode(65 + (index % 26))}`,
      subtitle: group.source === 'manual' ? `Manual · ${capacity}` : capacity,
      icon: 'groups',
      badge: `${group.membersAccepted} / ${group.capacityMin} - ${group.capacityMax}`,
      palette: this.groupPalette(index),
      open: openIds.has(group.id),
      context: {
        groupId: group.id,
        stageId: stage.subEventId
      }
    };
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
}

export const eventTournamentGroupsPopupConverter =
  EventTournamentGroupsPopupConverter satisfies UiConverter<
    EventTournamentGroupsPopupConverterInput,
    EventTournamentGroupsPopupModel
  >;
